/* global document, window, navigator, fetch, HTMLAnchorElement */
// Mobile menu, footer year, hero video and the photo lightbox.

const toggle = document.querySelector('.menu-toggle');
const nav = document.getElementById('nav');
toggle?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
});
nav?.addEventListener('click', (e) => {
  if (e.target instanceof HTMLAnchorElement && nav.classList.contains('open')) {
    nav.classList.remove('open');
    toggle?.setAttribute('aria-expanded', 'false');
  }
});

const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());

// The hero loop is decoration: skip it for reduced motion or data saver.
const hero = document.querySelector('.hero-video');
if (hero) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection?.saveData;
  if (reduce || saveData) {
    hero.removeAttribute('autoplay');
    hero.pause();
  }
}

// Videos are silent highlight clips: they play by themselves while on screen and
// pause when scrolled away, so a phone only downloads what is being watched.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clips = [...document.querySelectorAll('video[autoplay]')].filter((v) => v !== hero);
clips.forEach((v) => {
  v.muted = true;
  v.removeAttribute('autoplay');
});
if (!reduceMotion && 'IntersectionObserver' in window) {
  const io = new window.IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.play().catch(() => {});
        else e.target.pause();
      }),
    { threshold: 0.4 },
  );
  clips.forEach((v) => io.observe(v));
}

// Lightbox: links with data-lightbox="group" open full size, with prev/next,
// arrow keys and swipe.
const links = [...document.querySelectorAll('a[data-lightbox]')];
if (links.length) {
  const box = document.createElement('dialog');
  box.className = 'lightbox';
  box.setAttribute('aria-label', 'Photo viewer');
  box.innerHTML = `
    <figure><img alt="" /><figcaption></figcaption></figure>
    <button class="lb-btn lb-close" aria-label="Close">×</button>
    <button class="lb-btn lb-prev" aria-label="Previous photo">‹</button>
    <button class="lb-btn lb-next" aria-label="Next photo">›</button>`;
  document.body.append(box);
  const img = box.querySelector('img');
  const cap = box.querySelector('figcaption');
  let group = [];
  let i = 0;

  const show = (n) => {
    i = (n + group.length) % group.length;
    const a = group[i];
    img.src = a.href;
    img.alt = a.querySelector('img')?.alt ?? '';
    cap.textContent = `${a.dataset.caption ?? ''}  (${i + 1}/${group.length})`;
  };

  links.forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      group = links.filter((l) => l.dataset.lightbox === a.dataset.lightbox);
      show(group.indexOf(a));
      box.showModal();
    }),
  );
  box.querySelector('.lb-close').addEventListener('click', () => box.close());
  box.querySelector('.lb-prev').addEventListener('click', () => show(i - 1));
  box.querySelector('.lb-next').addEventListener('click', () => show(i + 1));
  box.addEventListener('click', (e) => {
    if (e.target === box || e.target.tagName === 'FIGURE') box.close();
  });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(i - 1);
    if (e.key === 'ArrowRight') show(i + 1);
  });
  let startX = null;
  box.addEventListener('touchstart', (e) => (startX = e.touches[0].clientX), { passive: true });
  box.addEventListener('touchend', (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) show(dx < 0 ? i + 1 : i - 1);
    startX = null;
  });
}

// Location page: venue and nearby places on an OpenStreetMap map (Leaflet).
const mapEl = document.getElementById('venue-map');
if (mapEl) {
  const start = () => {
    const L = window.L;
    if (!L) return;
    fetch(mapEl.dataset.nearby)
      .then((r) => r.json())
      .then((d) => {
        const v = d.venue;
        const map = L.map(mapEl, { scrollWheelZoom: false }).setView([v.lat, v.lon], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '© OpenStreetMap contributors',
        }).addTo(map);
        const venueIcon = L.divIcon({
          className: 'pin pin-venue',
          html: '<img src="images/logo-ganesh-sm.png" alt="" />',
          iconSize: [44, 44],
          iconAnchor: [22, 44],
        });
        L.marker([v.lat, v.lon], { icon: venueIcon, zIndexOffset: 1000 })
          .addTo(map)
          .bindPopup(`<strong>${v.name}</strong><br>${v.address}`)
          .openPopup();
        const pts = [[v.lat, v.lon]];
        d.groups.forEach((g) =>
          g.places.forEach((p) => {
            const icon = L.divIcon({
              className: 'pin',
              html: `<span>${g.icon}</span>`,
              iconSize: [30, 30],
              iconAnchor: [15, 15],
            });
            L.marker([p.lat, p.lon], { icon })
              .addTo(map)
              .bindPopup(`<strong>${p.name}</strong><br>About ${Math.round(p.km)} km by road`);
            pts.push([p.lat, p.lon]);
          }),
        );
        map.fitBounds(pts, { padding: [24, 24] });
      })
      .catch(() => {
        mapEl.textContent = 'The map could not load. Use “Open in Google Maps” above.';
      });
  };
  if (window.L) start();
  else window.addEventListener('load', start);
}

// Enquiry form: sends to the dashboard (Supabase function `site-enquiry`).
const form = document.getElementById('enquiry-form');
if (form) {
  const ENDPOINT = 'https://iccdwtjefhwvptohbkha.supabase.co/functions/v1/site-enquiry';
  const startedAt = Date.now();
  const errorEl = form.querySelector('.form-error');
  const done = document.querySelector('.enquiry-done');
  // "WhatsApp number is the same": skip the extra field and copy the phone number into it.
  const phoneInput = form.querySelector('input[name="phone"]');
  const sameBox = form.querySelector('input[name="whatsapp_same"]');
  const waField = form.querySelector('.wa-field');
  const waInput = form.querySelector('input[name="whatsapp"]');
  const syncWhatsapp = () => {
    const same = sameBox.checked;
    waField.hidden = same;
    waInput.required = !same;
    if (same) waInput.value = phoneInput.value;
    else if (waInput.value === phoneInput.value) waInput.value = '';
  };
  sameBox.addEventListener('change', syncWhatsapp);
  phoneInput.addEventListener('input', () => sameBox.checked && (waInput.value = phoneInput.value));
  syncWhatsapp();
  const button = form.querySelector('button[type="submit"]');
  const showError = (msg) => {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    const fd = new window.FormData(form);
    const phone = String(fd.get('phone') || '').replace(/\D/g, '');
    if (String(fd.get('name') || '').trim().length < 2) return showError('Please enter your name.');
    if (!/^(91)?[6-9]\d{9}$/.test(phone.replace(/^0/, '')))
      return showError('Please enter a 10-digit mobile number.');
    const same = sameBox.checked;
    const wa = same ? phone : String(fd.get('whatsapp') || '').replace(/\D/g, '');
    if (!same && !/^(91)?[6-9]\d{9}$/.test(wa.replace(/^0/, '')))
      return showError('Please enter your 10-digit WhatsApp number, or tick "same as phone".');
    if (!fd.get('event_type')) return showError('Please choose the event type.');
    const body = {
      name: String(fd.get('name')).trim(),
      phone,
      whatsapp_same: same,
      whatsapp: same ? '' : wa,
      email: String(fd.get('email') || '').trim(),
      event_type: String(fd.get('event_type')),
      event_date: String(fd.get('event_date') || ''),
      flexible_date: fd.get('flexible_date') === 'on',
      guests: fd.get('guests') ? Number(fd.get('guests')) : '',
      budget: fd.get('budget') ? Number(fd.get('budget')) : '',
      space: String(fd.get('space') || ''),
      time_of_day: String(fd.get('time_of_day') || ''),
      rooms: String(fd.get('rooms') || ''),
      services: fd.getAll('services').map(String),
      heard_from: String(fd.get('heard_from') || ''),
      call_time: String(fd.get('call_time') || ''),
      site_visit: fd.get('site_visit') === 'on',
      questions: String(fd.get('questions') || '').trim(),
      company: String(fd.get('company') || ''),
      started_at: startedAt,
    };
    button.disabled = true;
    button.textContent = 'Sending…';
    try {
      const r = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.status === 429)
        throw new Error('Too many enquiries from this connection. Please call or WhatsApp us.');
      if (!r.ok) throw new Error('Something went wrong. Please call or WhatsApp us.');
      form.hidden = true;
      done.hidden = false;
      done.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      showError(err.message || 'Could not send. Please call or WhatsApp us.');
      button.disabled = false;
      button.textContent = 'Send enquiry';
    }
  });
}
