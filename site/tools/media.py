"""Curates venue photos and videos for the website.

    python3 site/tools/media.py add <space> <file> [<file> ...]
    python3 site/tools/media.py list [<space>]

For every file added to a space (pandaal, ashoka, ...):
  * photos: auto-oriented, location/camera data stripped, scored for sharpness,
    exposure and size, given a gentle warm grade, saved full size (1600px) and as
    a thumbnail. Blurry, dark or tiny shots are rejected.
  * near-duplicates (same scene, re-sent, resized or re-encoded) are detected with a
    perceptual hash across everything already in the space; the better copy wins.
  * videos: same grade, H.264 720p for phones, poster taken from the sharpest frame,
    duplicates found by length and first frames.
Results are kept in site/media.json, which build_space_pages.py reads.
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps, ImageStat

SITE = Path(__file__).resolve().parent.parent
MANIFEST = SITE / "media.json"
DUP_DISTANCE = 12  # dhash bits (of 64) within which two pictures are "the same shot"
MIN_SCORE = 35  # below this a photo is not good enough for the website
VIDEO_EXT = {".mov", ".mp4", ".m4v", ".3gp", ".webm"}


# ------------------------------------------------------------------ helpers


def load() -> dict:
    return json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {"spaces": {}}


def save(m: dict) -> None:
    MANIFEST.write_text(json.dumps(m, indent=2, ensure_ascii=False) + "\n")


def dhash(im: Image.Image) -> int:
    g = im.convert("L").resize((9, 8), Image.LANCZOS)
    px = list(g.get_flattened_data() if hasattr(g, "get_flattened_data") else g.getdata())
    bits = 0
    for row in range(8):
        for col in range(8):
            bits = (bits << 1) | (px[row * 9 + col] > px[row * 9 + col + 1])
    return bits


def distance(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def sharpness(im: Image.Image) -> float:
    g = im.convert("L")
    g.thumbnail((800, 800))
    return ImageStat.Stat(g.filter(ImageFilter.FIND_EDGES)).var[0]


def score(im: Image.Image) -> float:
    """0-100: sharp, well exposed and large enough scores high."""
    sharp = min(sharpness(im) / 900, 1.0) * 50  # edge variance; soft phone shots ~200
    mean = ImageStat.Stat(im.convert("L")).mean[0]
    exposure = max(0.0, 1 - abs(mean - 115) / 115) * 30  # night venue shots sit ~80-130
    size = min(min(im.size) / 1080, 1.0) * 20
    return round(sharp + exposure + size, 1)


def grade(im: Image.Image) -> Image.Image:
    """Gentle cinematic grade: a little contrast, warmth and colour; never a filter look."""
    im = ImageOps.autocontrast(im, cutoff=0.5)
    im = ImageEnhance.Contrast(im).enhance(1.06)
    im = ImageEnhance.Color(im).enhance(1.10)
    r, g, b = im.split()
    r = r.point(lambda v: min(255, int(v * 1.03)))
    b = b.point(lambda v: int(v * 0.97))
    im = Image.merge("RGB", (r, g, b))
    return im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=40, threshold=3))


def run(*args: str) -> str:
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


# ------------------------------------------------------------------ photos


def add_photo(space: dict, key: str, src: Path) -> str:
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    h = dhash(im)
    s = score(im)
    if s < MIN_SCORE:
        return f"skip {src.name}: quality {s} (blurry, dark or small)"
    for p in space["photos"]:
        if distance(h, int(p["hash"], 16)) <= DUP_DISTANCE:
            if s <= p["score"]:
                return f"skip {src.name}: duplicate of {p['file']} (kept, {p['score']} >= {s})"
            # Better copy of the same shot: replace the files, keep caption/order.
            write_photo(im, key, p["file"])
            p.update(hash=f"{h:016x}", score=s, width=im.width, height=im.height, source=src.name)
            return f"replace {p['file']} with better copy {src.name} ({s})"
    n = 1 + max([int(p["file"].rsplit("-", 1)[1]) for p in space["photos"]] or [0])
    name = f"{key}-{n:02d}"
    w, hgt = write_photo(im, key, name)
    space["photos"].append(
        {"file": name, "hash": f"{h:016x}", "score": s, "width": w, "height": hgt,
         "alt": "", "source": src.name}
    )
    return f"add {name} from {src.name} ({s})"


def write_photo(im: Image.Image, key: str, name: str) -> tuple[int, int]:
    out = SITE / "images" / key
    out.mkdir(parents=True, exist_ok=True)
    g = grade(im)
    full = g.copy()
    full.thumbnail((1600, 1600), Image.LANCZOS)
    # New JPEGs carry no EXIF: no GPS, no camera serials.
    full.save(out / f"{name}.jpg", "JPEG", quality=82, optimize=True, progressive=True)
    th = g.copy()
    th.thumbnail((720, 720), Image.LANCZOS)
    th.save(out / f"{name}-sm.jpg", "JPEG", quality=78, optimize=True, progressive=True)
    return full.size


# ------------------------------------------------------------------ videos


def probe(src: Path) -> tuple[float, int, int]:
    out = run("ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
              "stream=width,height:stream_side_data=rotation:format=duration", "-of", "json", str(src))
    j = json.loads(out)
    st = j["streams"][0]
    w, h = st["width"], st["height"]
    rot = next((abs(int(d.get("rotation", 0))) for d in st.get("side_data_list", [])), 0)
    if rot in (90, 270):
        w, h = h, w
    return float(j["format"]["duration"]), w, h


def frames(src: Path, duration: float, n: int = 6) -> list[Image.Image]:
    ims = []
    with tempfile.TemporaryDirectory() as tmp:
        for i in range(n):
            t = duration * (i + 0.5) / n
            f = Path(tmp) / f"{i}.jpg"
            run("ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", str(src), "-frames:v", "1", str(f))
            if f.exists():
                ims.append(Image.open(f).convert("RGB"))
    return ims


def add_video(space: dict, key: str, src: Path) -> str:
    duration, w, h = probe(src)
    shots = frames(src, duration)
    if not shots:
        return f"skip {src.name}: unreadable"
    cw, ch, cx, cy = bars(shots)
    crop = ""
    if (cw, ch) != shots[0].size:
        crop = f"crop={cw}:{ch}:{cx}:{cy},"
        shots = [f.crop((cx, cy, cx + cw, cy + ch)) for f in shots]
        w, h = cw, ch
    sig = [f"{dhash(f):016x}" for f in shots[:3]]
    best = max(shots, key=sharpness)
    s = score(best)
    for v in space["videos"]:
        same_len = abs(v["duration"] - duration) < 0.3
        looks = sum(distance(int(a, 16), int(b, 16)) <= DUP_DISTANCE for a, b in zip(sig, v["sig"]))
        # Same clip re-sent: the frames match. Length alone is not enough (many clips are ~10 s).
        if looks >= 2 or (same_len and looks >= 1):
            if s <= v["score"]:
                return f"skip {src.name}: duplicate of {v['file']}"
            encode(src, key, v["file"], best, crop)
            v.update(score=s, sig=sig, duration=round(duration, 2), source=src.name)
            return f"replace {v['file']} with better copy {src.name}"
    n = 1 + max([int(v["file"].rsplit("-", 1)[1]) for v in space["videos"]] or [0])
    name = f"{key}-video-{n:02d}"
    encode(src, key, name, best, crop)
    space["videos"].append(
        {"file": name, "duration": round(duration, 2), "orientation": "portrait" if h > w else "landscape",
         "score": s, "sig": sig, "caption": "", "source": src.name}
    )
    return f"add {name} from {src.name} ({duration:.0f}s)"


def bars(shots: list[Image.Image]) -> tuple[int, int, int, int]:
    """Solid-colour bars at the edges (a portrait clip padded to wide): crop w, h, x, y."""
    w, h = shots[0].size

    def flat(box) -> bool:
        return all(max(ImageStat.Stat(f.crop(box)).stddev) < 6 for f in shots)

    left = 0
    while left < w * 0.4 and flat((left, 0, left + 4, h)):
        left += 4
    right = 0
    while right < w * 0.4 and flat((w - right - 4, 0, w - right, h)):
        right += 4
    top = 0
    while top < h * 0.4 and flat((0, top, w, top + 4)):
        top += 4
    bottom = 0
    while bottom < h * 0.4 and flat((0, h - bottom - 4, w, h - bottom)):
        bottom += 4
    # The bar's edge blends into the picture over a few pixels: trim a little more.
    pad = 6
    left, right = (left + pad if left else 0), (right + pad if right else 0)
    top, bottom = (top + pad if top else 0), (bottom + pad if bottom else 0)
    cw, ch = (w - left - right) // 2 * 2, (h - top - bottom) // 2 * 2
    return cw, ch, left, top


def highlights(src: Path, duration: float, crop: str) -> list[tuple[float, float]]:
    """The clip's best moments: sharp, steady, well-lit stretches.

    Every half second gets a score (sharpness and exposure, minus shake: a big
    change from the previous frame means the phone was swinging). Short clips keep
    their best 8 s; clips over 20 s keep their two best 5 s stretches, in order.
    """
    if duration <= 6:
        return [(0.0, duration)]
    step = 0.5
    scores: list[float] = []
    prev = None
    with tempfile.TemporaryDirectory() as tmp:
        run("ffmpeg", "-v", "error", "-i", str(src), "-vf", f"{crop}fps=2,scale=320:-2",
            "-q:v", "5", f"{tmp}/%04d.jpg")
        for f in sorted(Path(tmp).glob("*.jpg")):
            im = Image.open(f).convert("L")
            sharp = ImageStat.Stat(im.filter(ImageFilter.FIND_EDGES)).var[0]
            mean = ImageStat.Stat(im).mean[0]
            small = list(im.resize((16, 9)).get_flattened_data())
            # Shake: how much the picture changed since half a second ago.
            shake = sum(abs(x - y) for x, y in zip(small, prev)) / len(small) if prev else 0.0
            prev = small
            scores.append(min(sharp, 1500) / 15 + max(0.0, 40 - abs(mean - 110) / 2) - shake * 1.5)
    if not scores:
        return [(0.0, min(duration, 8.0))]
    n, length = (2, 5.0) if duration > 20 else (1, min(8.0, duration))
    win = max(1, int(length / step))
    sums = [sum(scores[i:i + win]) / win for i in range(0, max(1, len(scores) - win + 1))]
    picked: list[int] = []
    for i in sorted(range(len(sums)), key=lambda i: -sums[i]):
        if all(abs(i - j) >= win for j in picked):
            picked.append(i)
        if len(picked) == n:
            break
    return [(i * step, min(duration, i * step + length)) for i in sorted(picked)]


def encode(src: Path, key: str, name: str, poster: Image.Image, crop: str = "") -> None:
    out = SITE / "videos"
    out.mkdir(parents=True, exist_ok=True)
    vf = crop + ("scale='if(gt(iw,ih),-2,min(720,iw))':'if(gt(iw,ih),min(720,ih),-2)',fps=30,"
          "eq=contrast=1.05:saturation=1.12:gamma=1.02,colorbalance=rs=.03:bs=-.03")
    duration = probe(src)[0]
    parts = highlights(src, duration, crop)
    # Trim to the best moments and join them; no audio track at all (the site plays videos silently).
    chains = "".join(
        f"[0:v]trim={a:.2f}:{b:.2f},setpts=PTS-STARTPTS,{vf}[v{i}];" for i, (a, b) in enumerate(parts)
    )
    joined = "".join(f"[v{i}]" for i in range(len(parts)))
    graph = chains + (f"{joined}concat=n={len(parts)}:v=1:a=0[out]" if len(parts) > 1 else "")
    out_label = "[out]" if len(parts) > 1 else "[v0]"
    run("ffmpeg", "-v", "error", "-y", "-i", str(src), "-map_metadata", "-1",
        "-filter_complex", graph.rstrip(";"), "-map", out_label, "-an",
        "-c:v", "libx264", "-profile:v", "main", "-crf", "26", "-preset", "slow", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", str(out / f"{name}.mp4"))
    if crop:
        cw, ch, x, y = (int(n) for n in crop[5:-1].split(":"))
        poster = poster.crop((x, y, x + cw, y + ch))
    p = grade(poster)
    p.thumbnail((1280, 1280), Image.LANCZOS)
    p.save(out / f"{name}.jpg", "JPEG", quality=80, optimize=True, progressive=True)


# ------------------------------------------------------------------ cli


def main(argv: list[str]) -> None:
    m = load()
    if argv and argv[0] == "reencode":
        # Re-cut every video of a space from its originals (kept outside the repo).
        src_dir = Path(argv[2])
        for v in m["spaces"][argv[1]]["videos"]:
            src = src_dir / v["source"]
            duration, w, h = probe(src)
            shots = frames(src, duration)
            cw, ch, cx, cy = bars(shots)
            crop = f"crop={cw}:{ch}:{cx}:{cy}," if (cw, ch) != shots[0].size else ""
            if crop:
                shots = [f.crop((cx, cy, cx + cw, cy + ch)) for f in shots]
            encode(src, argv[1], v["file"], max(shots, key=sharpness), crop)
            v["clip"] = [list(p) for p in highlights(src, duration, crop)]
            print("re-cut", v["file"], v["clip"])
        save(m)
        return
    if not argv or argv[0] not in {"add", "list", "reencode"}:
        sys.exit(__doc__)
    if argv[0] == "list":
        for key, sp in m["spaces"].items():
            if len(argv) > 1 and key != argv[1]:
                continue
            print(f"{key}: {len(sp['photos'])} photos, {len(sp['videos'])} videos")
            for p in sorted(sp["photos"], key=lambda p: -p["score"]):
                print(f"  {p['file']:<16} {p['score']:>5}  {p['width']}x{p['height']}  {p['alt'][:50]}")
            for v in sp["videos"]:
                print(f"  {v['file']:<22} {v['duration']:>5}s {v['orientation']:<9} {v['caption'][:40]}")
        return
    key, files = argv[1], [Path(f) for f in argv[2:]]
    space = m["spaces"].setdefault(key, {"photos": [], "videos": []})
    for f in files:
        msg = add_video(space, key, f) if f.suffix.lower() in VIDEO_EXT else add_photo(space, key, f)
        print(msg)
        save(m)  # after each file, so a long batch can be resumed


if __name__ == "__main__":
    main(sys.argv[1:])
