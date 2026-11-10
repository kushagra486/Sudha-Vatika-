#!/usr/bin/env python3
"""Builds the printable / shareable marketing kit from the website's curated media.

    python3 site/tools/make_marketing_kit.py

Writes site/downloads/: the brochure and one-page space sheets (PDF), posters (JPG) and a short
showreel (MP4). No prices and no food on purpose. Needs Playwright (Chromium) and ffmpeg.
Photos and videos come from site/media.json (see media.py), so a rebuild picks up new media.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
OUT = SITE / "downloads"
FONT = SITE / "tools" / "fonts" / "playfair-display-600.ttf"
MEDIA = json.loads((SITE / "media.json").read_text())["spaces"]

NAME = "Sudha Vatika"
WEB = "kushagra486.github.io/Sudha-Vatika-"
PHONES = ["+91 94516 36524", "+91 98893 44818"]
ADDRESS = "58 A/31 Dhoomanganj, Old N.H.-02 (Kanpur Road), near Dhoomanganj Police Station, Prayagraj (Allahabad), Uttar Pradesh 211011"
INSTAGRAM = "@sudha.vatika"

# key in media.json -> sheet / poster definition
SPACES = [
    dict(slug="pandaal", key="pandaal", title="Pandaal", chip="Up to 1,500 guests",
         lead="A grand covered pandaal for weddings and receptions: golden drapes, crystal chandeliers, hanging-flower canopies and a full floral stage.",
         facts=["Up to 1,500 guests", "Decorated stage", "Chandeliers & fairy lights", "DJ & dance floor"]),
    dict(slug="ashoka-hall", key="ashoka", title="Ashoka Hall", chip="Up to 300 guests",
         lead="An air-conditioned indoor hall for receptions, engagements and family functions: crystal chandeliers, lit floral wall panels and a decorated stage.",
         facts=["Up to 300 guests", "Air-conditioned", "Decorated stage", "DJ setup"]),
    dict(slug="lawn", key="lawn", title="Lawn", chip="Up to 300 guests",
         lead="An open-air lawn under the palms for receptions, sangeet, haldi and evening functions: lit pavilions with golden drapes and lounge seating.",
         facts=["Up to 300 guests", "Lit pavilions", "Lounge seating", "Open-air setting"]),
    dict(slug="conference-hall", key="conference", title="Meeting & Conference Hall", chip="Up to 200 guests",
         lead="An air-conditioned hall for meetings, seminars and corporate events, set up theatre-style or with round tables to suit your programme.",
         facts=["Up to 200 guests", "Air-conditioned", "Theatre or round-table seating", "Head table & stage"]),
    dict(slug="guest-house", key="rooms", key2="dorm", title="Guest House", chip="VIP rooms · Dormitory",
         lead="Comfortable stay right at the venue so the family and the baraat stay together: VIP rooms with attached bathrooms, and a dormitory for larger groups.",
         facts=["3 VIP rooms, more opening soon", "Attached bathrooms, hot water", "Extra beds for families", "Dormitory for large groups"]),
    dict(slug="decor", key="stages", key2="passage", title="Decor & Stages", chip="Entrance · Passages · Stages",
         lead="Grand entrances, lit passages and floral stages. Our own decor team dresses the venue to your theme, from the gate to the stage.",
         facts=["Flower-covered entrance gates", "Lit canopy passages", "Floral stage sets", "Styled to your theme"]),
]


def photos(key, n=99):
    out = []
    for p in MEDIA[key]["photos"]:
        if p.get("hidden"):
            continue
        sub = {"ashoka": "ashoka", "dorm": "dorm"}.get(key, key)
        out.append(f"file://{SITE}/images/{sub}/{p['file']}.jpg")
    return out[:n]


def space_photos(s, n=6):
    ph = photos(s["key"])
    if s.get("key2"):
        ph = ph[: (n + 1) // 2] + photos(s["key2"])[: n // 2]
    return ph[:n]


def qr(name):
    return f"file://{SITE}/images/qr/{name}.svg"


CSS = f"""
@font-face {{ font-family: 'PV'; src: url('file://{FONT}'); font-weight: 600 700; }}
:root {{ --maroon:#6b1d2a; --gold:#c19a4b; --cream:#f4ece0; --ink:#2b2220; --muted:#6d625c; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
@page {{ size: A4; margin: 0; }}
body {{ font-family: 'Inter', sans-serif; color: var(--ink); -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
h1,h2,h3,.serif {{ font-family: 'PV', Georgia, serif; font-weight: 600; }}
.page {{ width: 210mm; height: 297mm; position: relative; overflow: hidden; page-break-after: always; background: var(--cream); }}
.page:last-child {{ page-break-after: auto; }}
.eyebrow {{ font-size: 9pt; letter-spacing: .22em; text-transform: uppercase; color: var(--gold); font-weight: 600; }}
.cover {{ background: var(--maroon); color: #fff; }}
.cover img.bg {{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }}
.cover .shade {{ position:absolute; inset:0; background: linear-gradient(180deg, rgba(60,10,20,.55) 0%, rgba(40,8,16,.25) 35%, rgba(40,8,16,.88) 100%); }}
.cover .top {{ position:absolute; top:16mm; left:18mm; right:18mm; display:flex; align-items:center; gap:5mm; }}
.cover .top img {{ height:22mm; }}
.cover .top span {{ font-family:'PV'; font-size:22pt; }}
.cover .bottom {{ position:absolute; left:18mm; right:18mm; bottom:22mm; }}
.cover h1 {{ font-size:46pt; line-height:1.05; margin:4mm 0 6mm; }}
.cover p {{ font-size:13pt; line-height:1.5; max-width:150mm; color:#f3e8d6; }}
.bar {{ position:absolute; left:0; right:0; bottom:0; background: var(--maroon); color:#fff; padding:7mm 16mm; display:flex; justify-content:space-between; font-size:10pt; }}
.bar b {{ color: #e7cf96; }}
.pad {{ padding: 18mm 16mm 26mm; }}
.pad h2 {{ font-size:28pt; color: var(--maroon); margin:2mm 0 5mm; line-height:1.1; }}
.pad p {{ font-size:11.5pt; line-height:1.65; color: var(--ink); margin-bottom:4mm; }}
.grid3 {{ display:grid; grid-template-columns:repeat(3,1fr); gap:4mm; margin-top:6mm; }}
.grid2 {{ display:grid; grid-template-columns:repeat(2,1fr); gap:4mm; margin-top:6mm; }}
.ph {{ width:100%; object-fit:cover; border-radius:3mm; display:block; }}
.stats {{ display:grid; grid-template-columns:repeat(4,1fr); gap:4mm; margin-top:8mm; }}
.stat {{ background:#fff; border-radius:3mm; padding:5mm 3mm; text-align:center; }}
.stat b {{ display:block; font-family:'PV'; font-size:22pt; color:var(--maroon); }}
.stat span {{ font-size:8.5pt; color:var(--muted); }}
.card {{ background:#fff; border-radius:3mm; overflow:hidden; }}
.card .body {{ padding:4mm 5mm 5mm; }}
.card h3 {{ font-size:14pt; color:var(--maroon); }}
.card .chip {{ font-size:9pt; color: var(--gold); font-weight:600; letter-spacing:.05em; }}
.facts {{ list-style:none; display:flex; flex-wrap:wrap; gap:2.5mm; margin:4mm 0 2mm; }}
.facts li {{ background:#fff; border:1px solid #e3d7c3; border-radius:20mm; padding:2mm 4mm; font-size:9.5pt; color:var(--maroon); font-weight:600; }}
.contact {{ display:grid; grid-template-columns:1fr 1fr; gap:8mm; margin-top:6mm; }}
.qrs {{ display:grid; grid-template-columns:repeat(2,1fr); gap:5mm; }}
.qrs div {{ background:#fff; border-radius:3mm; padding:4mm; text-align:center; font-size:8.5pt; color:var(--muted); }}
.qrs img {{ width:34mm; height:34mm; display:block; margin:0 auto 2mm; }}
.sheet-hero {{ position:relative; height:112mm; }}
.sheet-hero img {{ width:100%; height:100%; object-fit:cover; }}
.sheet-hero .shade {{ position:absolute; inset:0; background:linear-gradient(180deg,rgba(40,8,16,.1),rgba(40,8,16,.8)); }}
.sheet-hero .t {{ position:absolute; left:16mm; right:16mm; bottom:9mm; color:#fff; }}
.sheet-hero h1 {{ font-size:34pt; line-height:1.05; margin-top:2mm; }}
.foot {{ position:absolute; left:0; right:0; bottom:0; background:var(--maroon); color:#fff; padding:6mm 16mm; display:flex; align-items:center; justify-content:space-between; font-size:10pt; }}
.foot img {{ height:20mm; width:20mm; background:#fff; padding:1.5mm; border-radius:2mm; }}
"""

LOGO = f"file://{SITE}/images/logo-ganesh.png"
CONTACT_LINE = f"<b>Atin Gupta</b> &nbsp; {PHONES[0]} &nbsp;·&nbsp; {PHONES[1]}"


def html(body):
    return f"<!doctype html><html><head><meta charset='utf-8'><style>{CSS}</style></head><body>{body}</body></html>"


def foot(extra=""):
    return f"""<div class="foot"><div>{CONTACT_LINE}<br><span style="color:#e7cf96">{WEB} &nbsp;·&nbsp; Instagram {INSTAGRAM}</span></div>
    <img src="{qr('contact')}" alt=""></div>"""


def brochure():
    P = {s["slug"]: s for s in SPACES}
    cover = f"""<div class="page cover"><img class="bg" src="{photos('pandaal')[0]}"><div class="shade"></div>
      <div class="top"><img src="{LOGO}"><span>{NAME}</span></div>
      <div class="bottom"><div class="eyebrow">Weddings · Parties · Events · Functions · Meetings</div>
        <h1>Celebrate at<br>Sudha Vatika</h1>
        <p>Halls, a lawn and a pandaal for up to 1,500 guests, with rooms for your family to stay and our own decor team.</p></div>
      <div class="bar"><div>{CONTACT_LINE}</div><div>Dhoomanganj, Prayagraj</div></div></div>"""
    ph = photos("pandaal")
    about = f"""<div class="page"><div class="pad"><div class="eyebrow">About us</div>
      <h2>A venue for your family's biggest days</h2>
      <p>Sudha Vatika is a family-run venue on the old Kanpur Road in Dhoomanganj, Prayagraj. We host weddings, receptions, engagements, parties, functions and meetings.</p>
      <p>Everything is in one place: a grand pandaal, an air-conditioned hall, an open lawn, a meeting hall, a guest house with rooms and a dormitory, and a decor team that dresses it all for your function.</p>
      <div class="stats"><div class="stat"><b>1,500</b><span>guests in the pandaal</span></div><div class="stat"><b>4</b><span>event spaces</span></div>
      <div class="stat"><b>3</b><span>VIP rooms</span></div><div class="stat"><b>1</b><span>dormitory</span></div></div>
      <div class="grid3"><img class="ph" style="height:62mm" src="{ph[1]}"><img class="ph" style="height:62mm" src="{photos('ashoka')[0]}"><img class="ph" style="height:62mm" src="{photos('lawn')[0]}"></div>
      <div class="grid2"><img class="ph" style="height:60mm" src="{photos('stages')[0]}"><img class="ph" style="height:60mm" src="{photos('passage')[1]}"></div></div>{foot()}</div>"""
    cards = ""
    for s in SPACES[:5]:
        cards += f"""<div class="card"><img class="ph" style="height:46mm;border-radius:0" src="{space_photos(s,1)[0]}"><div class="body"><h3>{s['title']}</h3><div class="chip">{s['chip']}</div></div></div>"""
    glance = f"""<div class="page"><div class="pad"><div class="eyebrow">Our spaces</div><h2>Find the right space for your guest list</h2>
      <div class="grid2" style="margin-top:4mm">{cards}
      <div class="card" style="background:var(--maroon);color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;padding:6mm"><div><div class="serif" style="font-size:16pt">Plus decor</div><div style="font-size:10pt;margin-top:2mm;color:#e7cf96">Entrance, passages and stages by our own team</div></div></div></div></div>{foot()}</div>"""

    def detail(slugs, title, eyebrow):
        parts = ""
        for sl in slugs:
            s = P[sl]
            imgs = space_photos(s, 3)
            parts += f"""<div style="margin-bottom:8mm"><div class="eyebrow">{s['chip']}</div><h2 style="font-size:22pt;margin:1mm 0 3mm">{s['title']}</h2>
              <p style="margin-bottom:3mm">{s['lead']}</p>
              <div class="grid3" style="margin-top:2mm">{''.join(f'<img class="ph" style="height:72mm" src="{i}">' for i in imgs)}</div></div>"""
        return f"""<div class="page"><div class="pad" style="padding-top:14mm">{parts}</div>{foot()}</div>"""

    stay = P["guest-house"]
    gh = f"""<div class="page"><div class="pad"><div class="eyebrow">The Guest House</div><h2>A comfortable stay, right at the venue</h2>
      <p>{stay['lead']}</p>
      <ul class="facts">{''.join(f'<li>{f}</li>' for f in stay['facts'])}</ul>
      <div class="grid3">{''.join(f'<img class="ph" style="height:56mm" src="{i}">' for i in photos('rooms')[:3])}</div>
      <div class="grid3">{''.join(f'<img class="ph" style="height:56mm" src="{i}">' for i in photos('dorm')[:3])}</div></div>{foot()}</div>"""
    decor = P["decor"]
    dpage = f"""<div class="page"><div class="pad"><div class="eyebrow">Decor we can arrange</div><h2>Entrances, passages and stages</h2>
      <p>{decor['lead']}</p><ul class="facts">{''.join(f'<li>{f}</li>' for f in decor['facts'])}</ul>
      <div class="grid2">{''.join(f'<img class="ph" style="height:70mm" src="{i}">' for i in (photos('stages')[:2] + photos('passage')[:2]))}</div></div>{foot()}</div>"""
    loc = f"""<div class="page"><div class="pad"><div class="eyebrow">Visit us</div><h2>Plan your function with us</h2>
      <p>Call, WhatsApp or visit us. Tell us your event, date and guest count and we will call you back, usually the same day.</p>
      <div class="contact"><div><p><b>Atin Gupta</b><br>{PHONES[0]}<br>{PHONES[1]}</p><p style="color:var(--muted);font-size:10.5pt">{ADDRESS}</p>
        <p style="font-size:10.5pt">About 3 km from Subedarganj station and 7 km from Prayagraj Junction, on the main Kanpur Road.</p>
        <p style="font-size:10.5pt">Website: {WEB}<br>Instagram: {INSTAGRAM}</p></div>
        <div class="qrs"><div><img src="{qr('contact')}">Save our contact</div><div><img src="{qr('website')}">Our website</div><div><img src="{qr('maps')}">Open in Maps</div><div><img src="file://{SITE}/images/qr/instagram-official.png">Instagram</div></div></div></div>{foot()}</div>"""
    return html(cover + about + glance + detail(["pandaal", "ashoka-hall"], "", "") + detail(["lawn", "conference-hall"], "", "") + gh + dpage + loc)


def sheet(s):
    imgs = space_photos(s, 6)
    return html(f"""<div class="page"><div class="sheet-hero"><img src="{imgs[0]}"><div class="shade"></div>
      <div class="t"><div class="eyebrow">{NAME} · {s['chip']}</div><h1>{s['title']}</h1></div></div>
      <div class="pad" style="padding-top:9mm"><p style="font-size:12.5pt">{s['lead']}</p>
      <ul class="facts">{''.join(f'<li>{f}</li>' for f in s['facts'])}</ul>
      <div class="grid3" style="margin-top:7mm">{''.join(f'<img class="ph" style="height:54mm" src="{i}">' for i in imgs[1:4])}</div>
      <div class="grid2" style="margin-top:4mm">{''.join(f'<img class="ph" style="height:56mm" src="{i}">' for i in imgs[4:6])}</div></div>{foot()}</div>""")


def poster(s=None, square=False):
    w, h = (1080, 1080) if square else (1080, 1350)
    if s is None:
        img, title, chip, lead = photos("pandaal")[0], "Celebrate at Sudha Vatika", "Weddings · Parties · Events · Functions · Meetings", "Halls, a lawn and a pandaal for up to 1,500 guests, with rooms for your family to stay."
    else:
        img, title, chip, lead = space_photos(s, 1)[0], s["title"], s["chip"], s["lead"].split(":")[0].split(".")[0]
    return f"""<!doctype html><html><head><meta charset='utf-8'><style>{CSS}
      body{{width:{w}px;height:{h}px;overflow:hidden;position:relative;background:#6b1d2a}}
      .bg{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}}
      .sh{{position:absolute;inset:0;background:linear-gradient(180deg,rgba(50,8,18,.55),rgba(50,8,18,.0) 30%,rgba(50,8,18,.92) 100%)}}
      .t{{position:absolute;left:64px;top:56px;display:flex;align-items:center;gap:18px;color:#fff;font-family:PV;font-size:34px}}.t img{{height:70px}}
      .m{{position:absolute;left:64px;right:64px;bottom:150px;color:#fff}}
      .m .e{{font-size:22px;letter-spacing:.2em;text-transform:uppercase;color:#e7cf96;font-weight:600}}
      .m h1{{font-size:{74 if not square else 66}px;line-height:1.05;margin:16px 0 18px}}
      .m p{{font-size:28px;line-height:1.45;color:#f3e8d6;max-width:860px}}
      .f{{position:absolute;left:0;right:0;bottom:0;background:#6b1d2a;color:#fff;padding:30px 64px;font-size:27px;display:flex;justify-content:space-between}}
      .f b{{color:#e7cf96}}</style></head><body>
      <img class="bg" src="{img}"><div class="sh"></div><div class="t"><img src="{LOGO}">{NAME}</div>
      <div class="m"><div class="e">{chip}</div><h1>{title}</h1><p>{lead}.</p></div>
      <div class="f"><div><b>Atin Gupta</b> &nbsp;{PHONES[0]}</div><div>{PHONES[1]}</div></div></body></html>"""


def render_all(jobs):
    """jobs: (html, outfile, kind, w, h). Uses Playwright from node."""
    tmp = Path(tempfile.mkdtemp(prefix="kit-"))
    spec = []
    for i, (h, out, kind, w, ht) in enumerate(jobs):
        f = tmp / f"{i}.html"
        f.write_text(h)
        spec.append(dict(html=str(f), out=str(out), kind=kind, w=w, h=ht))
    (tmp / "spec.json").write_text(json.dumps(spec))
    (tmp / "render.cjs").write_text("""
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const spec = JSON.parse(fs.readFileSync(process.argv[2]));
  const b = await chromium.launch(); const ctx = await b.newContext({ deviceScaleFactor: 1 });
  for (const j of spec) { const p = await ctx.newPage(); await p.setViewportSize({ width: j.w || 1240, height: j.h || 1754 });
    await p.goto('file://' + j.html, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready);
    if (j.kind === 'pdf') await p.pdf({ path: j.out, format: 'A4', printBackground: true, preferCSSPageSize: true });
    else await p.screenshot({ path: j.out, type: 'jpeg', quality: 88 });
    await p.close(); }
  await b.close(); })();""")
    env = dict(os.environ, NODE_PATH=subprocess.run(["npm", "root", "-g"], capture_output=True, text=True).stdout.strip())
    subprocess.run(["node", str(tmp / "render.cjs"), str(tmp / "spec.json")], check=True, env=env)
    shutil.rmtree(tmp, ignore_errors=True)


def showreel():
    clips = [("pandaal", "pandaal-video-01"), ("pandaal", "pandaal-video-03"), ("ashoka", "ashoka-video-01"),
             ("ashoka", "ashoka-video-03"), ("lawn", "lawn-video-01"), ("lawn", "lawn-video-02"),
             ("passage", "passage-video-01"), ("stages", "stages-video-01"), ("pandaal", "pandaal-video-05")]
    tmp = Path(tempfile.mkdtemp(prefix="reel-"))
    # title + end cards from the poster style
    cards = []
    for name, (img, t, sub) in {"open": (photos("pandaal")[0], "Sudha Vatika", "Weddings · Parties · Events"),
                                "end": (photos("pandaal")[1], "Plan your function with us", f"Atin Gupta · {PHONES[0]} · {PHONES[1]}")}.items():
        h = f"""<!doctype html><html><head><meta charset=utf-8><style>{CSS}body{{width:1280px;height:720px;position:relative;overflow:hidden;background:#6b1d2a}}
        img.bg{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}}.sh{{position:absolute;inset:0;background:rgba(50,8,18,.62)}}
        .c{{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center}}
        .c img{{height:110px;margin-bottom:18px}}.c h1{{font-size:68px}}.c p{{font-size:28px;color:#e7cf96;margin-top:14px;letter-spacing:.04em}}</style></head>
        <body><img class=bg src="{img}"><div class=sh></div><div class=c><img src="{LOGO}"><h1>{t}</h1><p>{sub}</p></div></body></html>"""
        f = tmp / f"{name}.html"
        f.write_text(h)
        cards.append((h, tmp / f"{name}.jpg", "jpg", 1280, 720))
    render_all(cards)
    inputs, filt = [], []
    for k, name in enumerate(["open", "end"]):
        pass
    seg = []
    args = ["ffmpeg", "-y", "-loglevel", "error"]
    args += ["-loop", "1", "-t", "3", "-i", str(tmp / "open.jpg")]
    for key, c in clips:
        args += ["-ss", "1", "-t", "4", "-i", str(SITE / "videos" / f"{c}.mp4")]
    args += ["-loop", "1", "-t", "4", "-i", str(tmp / "end.jpg")]
    n = len(clips) + 2
    fc = ";".join(f"[{i}:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=25,setsar=1,format=yuv420p[v{i}]" for i in range(n))
    fc += ";" + "".join(f"[v{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0[out]"
    out = OUT / "Sudha-Vatika-Showreel.mp4"
    args += ["-filter_complex", fc, "-map", "[out]", "-c:v", "libx264", "-crf", "27", "-preset", "medium", "-movflags", "+faststart", "-an", str(out)]
    subprocess.run(args, check=True)
    shutil.rmtree(tmp, ignore_errors=True)


def main():
    OUT.mkdir(exist_ok=True)
    jobs = [(brochure(), OUT / "Sudha-Vatika-Brochure.pdf", "pdf", None, None)]
    for s in SPACES:
        jobs.append((sheet(s), OUT / f"Sudha-Vatika-{s['title'].replace(' & ', '-and-').replace(' ', '-')}-Sheet.pdf", "pdf", None, None))
        jobs.append((poster(s), OUT / f"poster-{s['slug']}.jpg", "jpg", 1080, 1350))
    jobs.append((poster(None), OUT / "poster-welcome.jpg", "jpg", 1080, 1350))
    jobs.append((poster(None, square=True), OUT / "poster-welcome-square.jpg", "jpg", 1080, 1080))
    render_all(jobs)
    showreel()
    for f in sorted(OUT.iterdir()):
        print(f"{f.stat().st_size/1e6:6.2f} MB  {f.name}")


if __name__ == "__main__":
    sys.exit(main())
