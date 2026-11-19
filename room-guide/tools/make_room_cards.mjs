// Builds the printable QR cards for the rooms.
//
//   node room-guide/tools/make_room_cards.mjs            -> one card for every room (generic QR)
//   node room-guide/tools/make_room_cards.mjs 101 102 G1 -> one card per room number, each QR opens
//                                                           the guide with that room filled in
//
// Writes room-guide/cards/*.pdf (A5, one card per page) and the QR as SVG and PNG.
// Needs the `qrcode` and `playwright` npm packages (npm i qrcode in a scratch folder is enough).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const QRCode = require('qrcode');
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(root, 'cards');
mkdirSync(out, { recursive: true });
const BASE = 'https://kushagra486.github.io/Sudha-Vatika-/room/';
const logo = 'data:image/png;base64,' + readFileSync(join(root, 'logo.png')).toString('base64');
const rooms = process.argv.slice(2);

async function qrSvg(url) {
  return QRCode.toString(url, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#4a1119', light: '#ffffff' },
  });
}

function card(svg, room) {
  const chips = [
    ['📞', 'Reception', 'रिसेप्शन'],
    ['🧹', 'Housekeeping', 'हाउसकीपिंग'],
    ['🍽️', 'Food', 'खाना'],
    ['🧳', 'Luggage', 'सामान'],
    ['📶', 'WiFi', 'वाई-फ़ाई'],
    ['⭐', 'Review', 'राय'],
  ]
    .map(([i, e, h]) => `<div class="chip"><span>${i}</span><b>${e}</b><small>${h}</small></div>`)
    .join('');
  return `<section class="card">
    <div class="band"><img src="${logo}"><div><b>Sudha Vatika</b><small>Guest Guide · अतिथि गाइड</small></div></div>
    <h1>Need anything?<br><span>Scan to ask us</span></h1>
    <p class="hi">कुछ चाहिए? स्कैन करें</p>
    <div class="qr">${svg}</div>
    ${room ? `<div class="room">Room ${room}</div>` : `<div class="room plain">Open your camera and point it here</div>`}
    <div class="chips">${chips}</div>
    <div class="call"><small>Prefer to talk? Call Reception</small><b>+91 94516 36524</b></div>
    <div class="url">kushagra486.github.io/Sudha-Vatika-/room</div>
  </section>`;
}

const css = `
@page { size: 148mm 210mm; margin: 0 }
* { box-sizing: border-box; margin: 0; padding: 0 }
body { font-family: Inter, 'Noto Sans', 'Noto Sans Devanagari', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact }
.card { width: 148mm; height: 210mm; position: relative; overflow: hidden; background: #f8f1e6; page-break-after: always; text-align: center; color: #2b2220 }
.band { background: #6b1d2a; color: #fff; display: flex; align-items: center; gap: 4mm; padding: 6mm 8mm; text-align: left }
.band img { height: 15mm }
.band b { display: block; font: 600 18pt Georgia, serif }
.band small { color: #e7cf96; font-size: 9pt }
h1 { font: 700 23pt/1.1 Georgia, serif; color: #6b1d2a; margin-top: 5mm }
h1 span { font-size: 17pt; color: #8a6a1f; font-weight: 600 }
.hi { font-size: 13pt; color: #6d625c; margin-top: 1.5mm; font-weight: 600 }
.qr { width: 58mm; height: 58mm; margin: 3.5mm auto 0; background: #fff; border: 1.2mm solid #c19a4b; border-radius: 5mm; padding: 2mm }
.qr svg { width: 100%; height: 100% }
.room { margin: 3mm auto 0; display: inline-block; background: #6b1d2a; color: #fff; font: 700 20pt Georgia, serif; padding: 1.5mm 9mm; border-radius: 99px }
.room.plain { background: none; color: #6d625c; font: 600 10.5pt Inter, sans-serif; padding: 2mm 0 }
.chips { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2mm; margin: 3.5mm 8mm 0 }
.chip { background: #fff; border-radius: 3mm; padding: 1.4mm 1mm; line-height: 1.1 }
.chip span { display: block; font-size: 15pt }
.chip b { display: block; font-size: 9pt }
.chip small { font-size: 8pt; color: #6d625c }
.call { position: absolute; left: 0; right: 0; bottom: 8mm; background: #17803d; color: #fff; padding: 2mm 0 }
.call small { display: block; font-size: 9pt; color: #dff5e6 }
.call b { font-size: 18pt }
.url { position: absolute; left: 0; right: 0; bottom: 2.5mm; font-size: 7.5pt; color: #6d625c }
`;

const list = rooms.length ? rooms : [null];
const pages = [];
for (const r of list) {
  const url = r ? `${BASE}?room=${encodeURIComponent(r)}` : BASE;
  pages.push(card(await qrSvg(url), r));
}
const html = `<!doctype html><meta charset="utf-8"><style>${css}</style><body>${pages.join('')}</body>`;
writeFileSync(join(out, '_cards.html'), html);

const b = await chromium.launch();
const p = await b.newPage();
await p.goto('file://' + join(out, '_cards.html'), { waitUntil: 'networkidle' });
await p.pdf({
  path: join(out, rooms.length ? 'Sudha-Vatika-Room-Cards.pdf' : 'Sudha-Vatika-Room-Card.pdf'),
  preferCSSPageSize: true,
  printBackground: true,
});
await b.close();
writeFileSync(join(out, 'qr-room-guide.svg'), await qrSvg(BASE));
await QRCode.toFile(join(out, 'qr-room-guide.png'), BASE, {
  width: 1000,
  margin: 2,
  errorCorrectionLevel: 'M',
  color: { dark: '#4a1119', light: '#ffffff' },
});
import { unlinkSync } from 'node:fs';
unlinkSync(join(out, '_cards.html'));
console.log('wrote', out);
