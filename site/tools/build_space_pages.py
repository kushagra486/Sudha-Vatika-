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
            "Comfortable group stay at the venue for the baraat and large families: big halls "
            "and rooms with beds, fresh linen and blankets, fans, and shared washrooms close by."
        ),
        "facts": ["Large groups", "Beds with fresh linen", "Blankets", "Shared washrooms"],
        "hero": "dorm-01",
    }
)

SPACES.insert(
    3,
    {
        "file": "conference.html",
        "key": "conference",
        "name": "Meeting & Conference Hall",
        "capacity": "Up to 200 guests",
        "kicker": "Meetings · Seminars · Corporate events",
        "intro": (
            "An air-conditioned hall for meetings, seminars and corporate events: theatre-style "
            "rows with a head table, or round tables with sofa seating, set up to suit your programme."
        ),
        "facts": ["Up to 200 guests", "Air-conditioned", "Theatre or round-table seating", "Head table & stage"],
        "hero": "conference-01",
    },
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
          <img class="brand-logo" src="images/logo-ganesh-sm.png" alt="" width="34" height="46" />
          <span class="brand-name">Sudha Vatika</span>
        </a>
        <button class="menu-toggle" aria-expanded="false" aria-controls="nav" aria-label="Menu">
          <span></span><span></span><span></span>
        </button>
        <nav id="nav" class="nav" aria-label="Main">
{links}
          <a href="enquiry.html" class="btn btn-gold nav-cta">Check your date</a>
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
    links = [(o["file"], o["name"]) for o in SPACES] + [("decor.html", "Decor"), ("about.html", "About"), ("location.html", "Location"), ("contact.html", "Contact")]
    cur = ' aria-current="page"'
    return HEADER.replace(
        "{links}",
        "\n".join(
            f'          <a href="{f}"{cur if f == current else ""}>{escape(n.replace("Meeting & Conference Hall", "Conference"))}</a>' for f, n in links
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
    <link rel="icon" type="image/png" href="favicon.png" />
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
            <a href="enquiry.html" class="btn btn-gold">Check your date</a>
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
            <a href="enquiry.html" class="btn btn-maroon">Check your date</a>
          </div>
          <div class="other-spaces">
{cards}
          </div>
        </div>
      </section>
    </main>

{FOOTER}

    <script src="main.js" defer></script>
  </body>
</html>
"""


FOOTER = """    <footer class="site-footer">
      <div class="wrap footer-grid">
        <div>
          <p class="footer-brand">
            <img src="images/logo-ganesh-sm.png" alt="" width="28" height="38" /> Sudha Vatika
          </p>
          <p>Celebrating weddings, parties, events, functions, meetings and more.</p>
        </div>
        <div>
          <p class="footer-head">Visit</p>
          <p>58 A/31 Dhoomanganj, Old N.H.-02 (Kanpur Road),<br />Prayagraj (Allahabad) 211011</p>
          <p><a href="location.html">Map &amp; nearby places →</a></p>
        </div>
        <div>
          <p class="footer-head">Call or WhatsApp</p>
          <p>
            <a href="tel:+919451636524">94516 36524</a> (WhatsApp) ·
            <a href="tel:+919889344818">98893 44818</a><br />
            <a href="mailto:sudhavatika@gmail.com">sudhavatika@gmail.com</a><br />
            <a href="https://www.instagram.com/sudha.vatika/">Instagram @sudha.vatika</a> ·
            <a href="contact.html">All contacts →</a>
          </p>
        </div>
      </div>
      <div class="wrap footer-row">
        <p>© <span id="year">2026</span> Sudha Vatika</p>
      </div>
    </footer>"""

NEARBY = json.loads((SITE / "data" / "nearby.json").read_text())


def location_page():
    v = NEARBY["venue"]
    directions = f"https://www.google.com/maps/dir/?api=1&destination={v['lat']},{v['lon']}"
    groups = []
    for g in NEARBY["groups"]:
        items = "\n".join(
            f"""              <li>
                <span class="near-name">{escape(p['name'])}</span>
                <span class="near-km">{p['km']:.0f} km</span>
                <a class="near-route" href="https://www.google.com/maps/dir/?api=1&origin={v['lat']},{v['lon']}&destination={p['lat']},{p['lon']}" target="_blank" rel="noopener">Route</a>
              </li>"""
            for p in sorted(g["places"], key=lambda p: p["km"])
        )
        groups.append(f"""          <div class="near-group">
            <h3><span aria-hidden="true">{g['icon']}</span> {escape(g['title'])}</h3>
            <ul class="near-list">
{items}
            </ul>
          </div>""")
    body = f"""      <section id="map" class="section">
        <div class="wrap">
          <p class="eyebrow">Location</p>
          <h2>Find us in Prayagraj</h2>
          <p class="muted">{escape(v['address'])}</p>
          <div class="hero-actions">
            <a class="btn btn-maroon" href="{v['maps_url']}" target="_blank" rel="noopener">Open in Google Maps</a>
            <a class="btn btn-ghost-dark" href="{directions}" target="_blank" rel="noopener">Get directions</a>
          </div>
          <iframe class="gmap" title="Sudha Vatika on Google Maps" loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
            src="https://www.google.com/maps?q=25.4490316,81.7775213&z=16&output=embed"></iframe>
          <h3 class="map-sub">Stations, airport and places to visit around us</h3>
          <div id="venue-map" class="venue-map" data-nearby="data/nearby.json" role="img"
            aria-label="Map of Sudha Vatika with nearby stations, the airport and places to visit"></div>
        </div>
      </section>
      <section id="nearby" class="section section-alt">
        <div class="wrap">
          <p class="eyebrow">Nearby</p>
          <h2>How far is everything?</h2>
          <p class="muted">Approximate distances by road from Sudha Vatika.</p>
          <div class="near-grid">
{chr(10).join(groups)}
          </div>
        </div>
      </section>
"""
    page = {
        "file": "location.html",
        "name": "Location",
        "kicker": "Dhoomanganj, Prayagraj",
        "capacity": "On Old N.H.-02 (Kanpur Road)",
        "intro": (
            "On the old Kanpur Road (N.H.-02) in Dhoomanganj, near Dhoomanganj Police Station: "
            "about 3 km from Subedarganj station and 7 km from Prayagraj Junction."
        ),
        "facts": ["3 km from Subedarganj station", "7 km from Prayagraj Junction", "8 km from the airport", "8 km from Civil Lines"],
    }
    out = shell(page, "images/passage/passage-01.jpg", "map", body, other_cards(""))
    return out.replace("</head>", """    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin="" defer></script>
  </head>""", 1)


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

(SITE / "location.html").write_text(location_page())
print("wrote location.html")


# ------------------------------------------------------------------ about, contact, enquiry

WA = "https://wa.me/message/2NBASVQH2K5EJ1"  # official WhatsApp Business chat link (from their QR)
IG = "https://www.instagram.com/sudha.vatika/"
MAPS = "https://maps.app.goo.gl/UULQUpDEhLZk1mDw8"
DIRECTIONS = "https://www.google.com/maps/dir/?api=1&destination=25.4490316,81.7775213"
ADDRESS = (
    "58 A/31 Dhoomanganj, Old N.H.-02 (Kanpur Road), near Dhoomanganj Police Station, "
    "Prayagraj (Allahabad), Uttar Pradesh 211011"
)


def about_page():
    cards = "\n".join(
        f"""            <a class="about-space" href="{o['file']}">
              <img src="images/{o['key']}/{o['hero']}-sm.jpg" alt="" loading="lazy" />
              <span><strong>{escape(o['name'])}</strong><br />{escape(o['capacity'])}</span>
            </a>"""
        for o in SPACES
    )
    body = f"""      <section id="story" class="section">
        <div class="wrap two-col">
          <div>
            <p class="eyebrow">About us</p>
            <h2>One venue for every part of your celebration</h2>
            <p>
              Sudha Vatika is a family-run wedding and event venue on the old Kanpur Road (N.H.-02)
              in Dhoomanganj, Prayagraj. Weddings, receptions, engagements, birthdays, family functions
              and corporate meetings are all hosted here, from an intimate gathering to a grand
              wedding of 1,500 guests.
            </p>
            <p>
              Everything is in one place: a grand pandaal, the air-conditioned Ashoka Hall, an open
              lawn, a meeting and conference hall, VIP rooms and a dormitory for the baraat and
              family. Our decor team dresses the entrance, the passages and the stage to your theme.
            </p>
            <p>
              Talk to <strong>Atin Gupta</strong> to plan your function: visit us, call, or send a
              WhatsApp message any time.
            </p>
            <div class="hero-actions">
              <a href="enquiry.html" class="btn btn-maroon">Send an enquiry</a>
              <a href="{WA}" class="btn btn-ghost-dark" target="_blank" rel="noopener">WhatsApp us</a>
            </div>
          </div>
          <a href="pandaal.html" class="stay-photo"><img src="images/pandaal/pandaal-04-sm.jpg" alt="The pandaal under golden drapes" loading="lazy" /></a>
        </div>
      </section>
      <section class="section section-alt">
        <div class="wrap">
          <p class="eyebrow">What we host</p>
          <h2>Celebrating weddings, parties, events, functions and meetings</h2>
          <ul class="features">
            <li><span class="icon" aria-hidden="true">💍</span>Weddings &amp; receptions</li>
            <li><span class="icon" aria-hidden="true">💐</span>Engagement, haldi &amp; mehendi</li>
            <li><span class="icon" aria-hidden="true">🎶</span>Sangeet &amp; DJ nights</li>
            <li><span class="icon" aria-hidden="true">🎂</span>Birthdays &amp; anniversaries</li>
            <li><span class="icon" aria-hidden="true">🪔</span>Family &amp; religious functions</li>
            <li><span class="icon" aria-hidden="true">💼</span>Meetings &amp; seminars</li>
          </ul>
        </div>
      </section>
      <section class="section">
        <div class="wrap">
          <p class="eyebrow">Our spaces</p>
          <h2>Halls, lawn, pandaal and rooms</h2>
          <div class="about-spaces">
{cards}
          </div>
        </div>
      </section>
      <section class="section section-alt">
        <div class="wrap">
          <p class="eyebrow">Why families choose us</p>
          <h2>Easy for you and your guests</h2>
          <ul class="ticks why">
            <li><strong>Everything in one place:</strong> the function, the decor and the stay.</li>
            <li><strong>Rooms for the family and the baraat</strong>, right at the venue.</li>
            <li><strong>Easy to reach:</strong> on the main Kanpur Road, about 3 km from Subedarganj station and 7 km from Prayagraj Junction.</li>
            <li><strong>Decor by our own team</strong>, from the entrance gate to the stage.</li>
          </ul>
        </div>
      </section>
"""
    page = {
        "file": "about.html",
        "name": "About Sudha Vatika",
        "kicker": "Our story",
        "capacity": "Dhoomanganj, Prayagraj",
        "intro": "A family-run venue for weddings, parties, events, functions and meetings in Prayagraj.",
        "facts": ["Weddings & receptions", "Up to 1,500 guests", "Rooms & dormitory", "Decor by our team"],
    }
    return shell(page, "images/pandaal/pandaal-02.jpg", "story", body, other_cards(""))


def qr(img, title, sub, href):
    return f"""            <a class="qr-card" href="{href}" target="_blank" rel="noopener">
              <img src="images/qr/{img}" alt="QR code: {escape(title)}" width="160" height="160" />
              <strong>{escape(title)}</strong>
              <span>{escape(sub)}</span>
            </a>"""


def contact_page():
    body = f"""      <section id="reach" class="section">
        <div class="wrap two-col contact-top">
          <div class="contact-card">
            <p class="eyebrow">Contact</p>
            <h2>Sudha Vatika</h2>
            <p class="contact-person">Atin Gupta</p>
            <address>{escape(ADDRESS)}</address>
            <ul class="contact-lines">
              <li>📞 <a href="tel:+919451636524">+91 94516 36524</a> <span class="tag">WhatsApp</span></li>
              <li>📞 <a href="tel:+919889344818">+91 98893 44818</a></li>
              <li>✉️ <a href="mailto:sudhavatika@gmail.com">sudhavatika@gmail.com</a></li>
              <li>📷 <a href="{IG}" target="_blank" rel="noopener">@sudha.vatika</a> on Instagram</li>
            </ul>
            <div class="contact-buttons">
              <a class="btn btn-gold" href="{WA}" target="_blank" rel="noopener">💬 WhatsApp chat</a>
              <a class="btn btn-maroon" href="tel:+919451636524">📞 Call now</a>
              <a class="btn btn-ghost-dark" href="{IG}" target="_blank" rel="noopener">📷 Instagram</a>
              <a class="btn btn-ghost-dark" href="{DIRECTIONS}" target="_blank" rel="noopener">🧭 Directions</a>
              <a class="btn btn-ghost-dark" href="sudha-vatika.vcf" download="Atin Gupta (SUDHA VATIKA).vcf">👤 Save contact</a>
            </div>
          </div>
          <iframe class="gmap" title="Sudha Vatika on Google Maps" loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
            src="https://www.google.com/maps?q=25.4490316,81.7775213&z=16&output=embed"></iframe>
        </div>
      </section>
      <section id="scan" class="section section-alt">
        <div class="wrap">
          <p class="eyebrow">Scan with your phone</p>
          <h2>QR codes</h2>
          <p class="muted">Point your phone camera at a code, or tap it.</p>
          <div class="qr-grid">
{qr("whatsapp-official.png", "WhatsApp chat", "+91 94516 36524", WA)}
{qr("instagram-official.png", "Instagram", "@sudha.vatika", IG)}
{qr("maps.svg", "Google Maps", "Location & directions", MAPS)}
{qr("contact.svg", "Save contact", "Atin Gupta (SUDHA VATIKA)", "sudha-vatika.vcf")}
          </div>
        </div>
      </section>
"""
    page = {
        "file": "contact.html",
        "name": "Contact us",
        "kicker": "Call · WhatsApp · Visit",
        "capacity": "+91 94516 36524 · +91 98893 44818",
        "intro": "Call, WhatsApp or visit us at Dhoomanganj on the old Kanpur Road, Prayagraj.",
        "facts": ["WhatsApp 94516 36524", "Call 98893 44818", "sudhavatika@gmail.com", "@sudha.vatika"],
    }
    out = shell(page, "images/passage/passage-01.jpg", "reach", body, other_cards(""))
    return out.replace('class="btn btn-ghost">Watch &amp; see photos', 'class="btn btn-ghost">Address &amp; map')


def enquiry_page():
    spaces = "".join(f'<option>{escape(o["name"])}</option>' for o in SPACES)
    body = f"""      <section id="form" class="section">
        <div class="wrap enquiry-wrap">
          <form id="enquiry-form" class="enquiry enquiry-big" novalidate>
            <h2>Tell us about your celebration</h2>
            <p class="muted">Takes about a minute. We will call you back, usually the same day.</p>
            <input type="text" name="company" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true" />

            <fieldset>
              <legend>About you</legend>
              <div class="row">
                <label>Your name *<input name="name" autocomplete="name" required minlength="2" /></label>
                <label>Phone (WhatsApp) *<input name="phone" type="tel" inputmode="tel" autocomplete="tel" required placeholder="98765 43210" /></label>
              </div>
              <label>Email <span class="opt">(optional)</span><input name="email" type="email" autocomplete="email" /></label>
            </fieldset>

            <fieldset>
              <legend>Your event</legend>
              <div class="row">
                <label>Event type *
                  <select name="event_type" required>
                    <option value="">Choose…</option>
                    <option>Wedding</option><option>Reception</option><option>Engagement / Roka</option>
                    <option>Haldi / Mehendi / Sangeet</option><option>Birthday</option><option>Anniversary</option>
                    <option>Family / religious function</option><option>Meeting / Seminar</option><option>Other</option>
                  </select>
                </label>
                <label>Event date<input name="event_date" type="date" /></label>
              </div>
              <label class="check"><input type="checkbox" name="flexible_date" /> My date is flexible</label>
              <div class="row">
                <label>Number of guests<input name="guests" type="number" min="1" max="5000" inputmode="numeric" placeholder="e.g. 300" /></label>
                <label>Time of day
                  <select name="time_of_day"><option value="">Any</option><option>Morning</option><option>Lunch</option><option>Evening</option><option>Dinner</option><option>Full day</option></select>
                </label>
              </div>
              <div class="row">
                <label>Preferred space
                  <select name="space"><option>Not sure</option>{spaces}</select>
                </label>
                <label>Your budget in mind (₹) <span class="opt">(optional)</span>
                  <input name="budget" type="number" min="0" step="1000" inputmode="numeric" placeholder="e.g. 200000" />
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend>What would you like?</legend>
              <div class="chips">
                <label class="chip"><input type="checkbox" name="services" value="Decor" /> Decor</label>
                <label class="chip"><input type="checkbox" name="services" value="Catering" /> Catering</label>
                <label class="chip"><input type="checkbox" name="services" value="DJ & music" /> DJ &amp; music</label>
                <label class="chip"><input type="checkbox" name="services" value="Photography" /> Photography</label>
                <label class="chip"><input type="checkbox" name="services" value="Stage" /> Stage</label>
                <label class="chip"><input type="checkbox" name="services" value="Lighting" /> Lighting</label>
              </div>
              <label>Stay for guests
                <select name="rooms"><option value="">Not needed</option><option>VIP rooms</option><option>Dormitory</option><option>Rooms and dormitory</option></select>
              </label>
              <label class="check"><input type="checkbox" name="site_visit" /> I would like to visit the venue first</label>
            </fieldset>

            <fieldset>
              <legend>Anything else?</legend>
              <label>Your questions<textarea name="questions" rows="4" maxlength="1500" placeholder="Ask us anything: dates, decor ideas, parking, rooms…"></textarea></label>
              <div class="row">
                <label>Best time to call
                  <select name="call_time"><option value="">Any time</option><option>Morning (9–12)</option><option>Afternoon (12–4)</option><option>Evening (4–8)</option></select>
                </label>
                <label>How did you hear about us?
                  <select name="heard_from"><option value="">Choose…</option><option>Instagram</option><option>Google</option><option>Friends / family</option><option>Attended an event here</option><option>Passing by</option><option>Other</option></select>
                </label>
              </div>
            </fieldset>

            <p class="form-error" role="alert" hidden></p>
            <button type="submit" class="btn btn-gold btn-big">Send enquiry</button>
            <p class="muted small">We use your details only to reply to this enquiry.</p>
          </form>
          <div class="enquiry-done" hidden>
            <p class="done-mark" aria-hidden="true">🙏</p>
            <h2>Thank you! We have your enquiry.</h2>
            <p>We will call you back soon. For a quicker reply, message us on WhatsApp.</p>
            <a class="btn btn-gold" href="{WA}" target="_blank" rel="noopener">💬 WhatsApp us</a>
          </div>
          <aside class="enquiry-side">
            <img src="images/stages/stages-04-sm.jpg" alt="" loading="lazy" />
            <p><strong>Prefer to talk?</strong></p>
            <p>📞 <a href="tel:+919451636524">94516 36524</a><br />📞 <a href="tel:+919889344818">98893 44818</a></p>
            <a class="btn btn-maroon" href="{WA}" target="_blank" rel="noopener">WhatsApp chat</a>
          </aside>
        </div>
      </section>
"""
    page = {
        "file": "enquiry.html",
        "name": "Plan your celebration",
        "kicker": "Enquiry",
        "capacity": "We reply quickly, usually the same day",
        "intro": "Share a few details about your event and we will call you back to talk about dates, spaces, decor and stay.",
        "facts": ["Free site visit", "Help with decor ideas", "Rooms for your guests"],
    }
    out = shell(page, "images/stages/stages-03.jpg", "form", body, other_cards(""))
    return out.replace('class="btn btn-ghost">Watch &amp; see photos', 'class="btn btn-ghost">Fill the form').replace(
        '<a href="enquiry.html" class="btn btn-gold">Check your date</a>', '<a href="#form" class="btn btn-gold">Check your date</a>', 1)


for name, fn in [("about.html", about_page), ("contact.html", contact_page), ("enquiry.html", enquiry_page)]:
    (SITE / name).write_text(fn())
    print("wrote", name)
