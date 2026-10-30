"""Builds one page per space (pandaal.html, ashoka-hall.html) from the lists below.

Add a photo or video to a space: put the files in site/images/<space>/ or
site/videos/, add a line below, then run:  python3 site/tools/build_space_pages.py
"""
import json
from html import escape
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent

# Page text per space. Photos and videos come from site/media.json (see media.py),
# in the order kept there; items marked "hidden" (near-duplicates) are left out.
SPACES = [
    {
        "file": "pandaal.html",
        "key": "pandaal",
        "name": "Pandaal",
        "capacity": "Up to 1,500 guests",
        "kicker": "Our largest space",
        "intro": (
            "A grand covered pandaal for weddings and receptions: golden drapes, crystal "
            "chandeliers, hanging-flower canopies and a full floral stage, with room for up to "
            "1,500 guests."
        ),
        "facts": ["Up to 1,500 guests", "Decorated stage", "Chandeliers & fairy lights", "DJ & dance floor"],
        "hero": "pandaal-04",
    },
    {
        "file": "ashoka-hall.html",
        "key": "ashoka",
        "name": "Ashoka Hall",
        "capacity": "Up to 300 guests",
        "kicker": "Indoor banquet hall",
        "intro": (
            "An air-conditioned indoor hall for receptions, engagements and family functions: crystal "
            "chandeliers, lit floral wall panels, a decorated stage and seating for up to 300 guests."
        ),
        "facts": ["Up to 300 guests", "Air-conditioned", "Decorated stage", "DJ setup"],
        "hero": "ashoka-01",
    },
    {
        "file": "lawn.html",
        "key": "lawn",
        "name": "Lawn",
        "capacity": "Up to 300 guests",
        "kicker": "Open-air celebrations",
        "intro": (
            "An open-air lawn under the palms for receptions, sangeet, haldi and dinners: lit "
            "pavilions with golden drapes, lounge seating and buffet counters around the grass."
        ),
        "facts": ["Up to 300 guests", "Lit pavilions", "Lounge seating", "Buffet counters"],
        "hero": "lawn-01",
    },
]

SPACES.append(
    {
        "file": "rooms.html",
        "key": "rooms",
        "name": "VIP Rooms",
        "capacity": "8 rooms at the venue",
        "kicker": "Stay with us",
        "intro": (
            "Clean, comfortable rooms right at the venue so the family and the baraat can stay "
            "together: double beds, extra beds for families, attached bathrooms with hot water and a "
            "quiet sitting area."
        ),
        "facts": ["8 rooms", "Attached bathrooms", "Hot water", "Extra beds for families", "AC rooms available"],
        "hero": "rooms-02",
    }
)

SPACES.append(
    {
        "file": "dormitory.html",
        "key": "dorm",
        "name": "Dormitory",
        "capacity": "Stay for large groups",
        "kicker": "Stay with us",
        "intro": (
            "Budget-friendly group stay at the venue for the baraat and large families: big halls "
            "and rooms with beds, fresh linen and blankets, fans, and shared washrooms close by."
        ),
        "facts": ["Large groups", "Beds with fresh linen", "Blankets", "Shared washrooms"],
        "hero": "dorm-01",
    }
)

MEDIA = json.loads((SITE / "media.json").read_text())["spaces"]
PAGES = [s["file"] for s in SPACES]


def media(s):
    sp = MEDIA.get(s["key"], {"photos": [], "videos": []})
    photos = [p for p in sp["photos"] if not p.get("hidden")]
    videos = [v for v in sp["videos"] if not v.get("hidden")]
    return photos, videos


HEADER = """    <a class="skip" href="#main">Skip to content</a>
    <header class="site-header">
      <div class="wrap header-row">
        <a href="index.html" class="brand" aria-label="Sudha Vatika home">
          <span class="brand-mark" aria-hidden="true">SV</span>
          <span class="brand-name">Sudha Vatika</span>
        </a>
        <button class="menu-toggle" aria-expanded="false" aria-controls="nav" aria-label="Menu">
          <span></span><span></span><span></span>
        </button>
        <nav id="nav" class="nav" aria-label="Main">
{links}
          <a href="index.html#gallery">Gallery</a>
          <a href="index.html#contact">Contact</a>
          <a href="index.html#enquire" class="btn btn-gold nav-cta">Check your date</a>
        </nav>
      </div>
    </header>"""


VIDEO = """            <figure class="video-card {orient}">
              <video muted autoplay loop playsinline preload="none" poster="videos/{v}.jpg" aria-label="{cap}">
                <source src="videos/{v}.mp4" type="video/mp4" />
              </video>
              <figcaption>{cap}</figcaption>
            </figure>"""


def videos_html(videos):
    # Silent highlight clips that play on their own while on screen (main.js).
    return "\n".join(
        VIDEO.format(orient=v["orientation"], v=v["file"], cap=escape(v["caption"])) for v in videos
    )


def photos_html(key, photos):
    return "\n".join(
        f"""            <a href="images/{key}/{p['file']}.jpg" data-lightbox="{key}" data-caption="{escape(p['alt'])}"
              ><img src="images/{key}/{p['file']}-sm.jpg" alt="{escape(p['alt'])}" loading="lazy"
            /></a>"""
        for p in photos
    )


def nav(current):
    links = [(o["file"], o["name"]) for o in SPACES] + [("decor.html", "Decor")]
    cur = ' aria-current="page"'
    return HEADER.replace(
        "{links}",
        "\n".join(
            f'          <a href="{f}"{cur if f == current else ""}>{escape(n)}</a>' for f, n in links
        ),
    )


DECOR = {
    "file": "decor.html",
    "name": "Decor we can arrange",
    "kicker": "Decor",
    "capacity": "Entrance · Passages · Stages",
    "intro": (
        "Grand entrances, lit passages and floral stages: our decor team dresses the venue for "
        "your function. Here is a look at what we can set up for you."
    ),
    "hero_url": "images/passage/passage-02.jpg",
    "facts": ["Flower-covered entrance gates", "Lit canopy passages", "Floral stage sets", "Styled to your theme"],
    "sections": [
        ("passages", "passage", "Entrance & passages",
         "Flower-covered gates, lit canopies and draped walkways that welcome your guests from the road to the venue."),
        ("stages", "stages", "Stages",
         "Floral stage sets with canopies, drapes and lighting, styled to your colours and theme."),
    ],
}


def section(anchor, key, eyebrow, title, text, alt):
    photos, videos = media({"key": key})
    vids = f"""          <div class="video-grid">
{videos_html(videos)}
          </div>
""" if videos else ""
    pics = f"""          <div class="gallery">
{photos_html(key, photos)}
          </div>
""" if photos else ""
    note = f'          <p class="muted">{escape(text)}</p>\n' if text else ""
    return f"""      <section id="{anchor}" class="section{' section-alt' if alt else ''}">
        <div class="wrap">
          <p class="eyebrow">{escape(eyebrow)}</p>
          <h2>{escape(title)}</h2>
{note}{vids}{pics}        </div>
      </section>
"""


def other_cards(exclude):
    return "\n".join(
        f"""            <a class="other-space" href="{o['file']}">
              <img src="images/{o['key']}/{o['hero']}-sm.jpg" alt="" loading="lazy" />
              <span>See <strong>{escape(o['name'])}</strong> →</span>
            </a>"""
        for o in SPACES
        if o["file"] != exclude
    )


def shell(p, hero, first_anchor, body, cards):
    facts = "\n".join(f"            <li>{escape(f)}</li>" for f in p["facts"])
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <!-- TODO at launch: remove this line so Google can list the site. -->
    <meta name="robots" content="noindex" />
    <title>{escape(p['name'])} | Sudha Vatika</title>
    <meta name="description" content="{escape(p['intro'])}" />
    <meta name="theme-color" content="#6b1d2a" />
    <meta property="og:image" content="{hero}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@400;500;600&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
{nav(p['file'])}

    <main id="main">
      <section class="space-hero" style="--hero: url('{hero}')">
        <div class="wrap space-hero-content">
          <p class="eyebrow">{escape(p['kicker'])}</p>
          <h1>{escape(p['name'])}</h1>
          <p class="cap-chip">{escape(p['capacity'])}</p>
          <p class="lead">{escape(p['intro'])}</p>
          <div class="hero-actions">
            <a href="index.html#enquire" class="btn btn-gold">Check your date</a>
            <a href="#{first_anchor}" class="btn btn-ghost">Watch &amp; see photos</a>
          </div>
        </div>
      </section>

      <section class="section section-tight">
        <div class="wrap">
          <ul class="fact-list" aria-label="At a glance">
{facts}
          </ul>
        </div>
      </section>

{body}
      <section class="section section-alt">
        <div class="wrap cta-band">
          <div>
            <h2>Planning an event?</h2>
            <p class="muted">Tell us the date and guest count, and we'll check availability for you.</p>
            <a href="index.html#enquire" class="btn btn-maroon">Check your date</a>
          </div>
          <div class="other-spaces">
{cards}
          </div>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <div class="wrap footer-row">
        <p><strong>Sudha Vatika</strong> · Banquet, Lawn &amp; Stay</p>
        <p>© <span id="year">2026</span> Sudha Vatika</p>
      </div>
    </footer>

    <script src="main.js" defer></script>
  </body>
</html>
"""


for s in SPACES:
    body = section("videos", s["key"], "Videos & photos", f"Inside the {s['name']}", "", True)
    hero = f"images/{s['key']}/{s['hero']}.jpg"
    (SITE / s["file"]).write_text(shell(s, hero, "videos", body, other_cards(s["file"])))
    print("wrote", s["file"])

body = "".join(
    section(anchor, key, "Decor", title, text, i % 2 == 1)
    for i, (anchor, key, title, text) in enumerate(DECOR["sections"])
)
(SITE / DECOR["file"]).write_text(shell(DECOR, DECOR["hero_url"], "passages", body, other_cards("")))
print("wrote", DECOR["file"])
