/* global document, window, navigator, HTMLAnchorElement */
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
