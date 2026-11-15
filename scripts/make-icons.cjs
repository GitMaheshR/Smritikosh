/**
 * Renders the Smritikosh logo (open book with a rising spark) to every icon the apps need.
 * Run:  apps/desktop/node_modules/.bin/electron scripts/make-icons.cjs
 * Outputs: Android launcher icons, the iPhone app icon (1024px, no transparency) and launch screen, Windows icon.ico / icon.png,
 * tray + window icon data URLs, docs/design/logo-512.png.
 */
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const INDIGO = '#3547A6';
const SPARK = '#5FD6C9';

const GLYPH = `
  <path fill="#fff" d="M9 20 C18 15 26 16 31 22 V54 C26 48 18 47 9 51 Z"/>
  <path fill="#fff" d="M55 20 C46 15 38 16 33 22 V54 C38 48 46 47 55 51 Z"/>
  <g fill="${INDIGO}" opacity=".3"><rect x="14" y="26" width="12" height="3" rx="1.5"/><rect x="14" y="33" width="12" height="3" rx="1.5"/><rect x="38" y="26" width="12" height="3" rx="1.5"/><rect x="38" y="33" width="12" height="3" rx="1.5"/></g>
  <circle cx="32" cy="10.5" r="4.4" fill="${SPARK}"/><circle cx="22" cy="12" r="2.2" fill="${SPARK}" opacity=".7"/><circle cx="42" cy="12" r="2.2" fill="${SPARK}" opacity=".7"/>`;

const svg = (kind, s) => {
  if (kind === 'tile') return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${INDIGO}"/><g transform="translate(0 2)">${GLYPH}</g></svg>`;
  // iPhone: a full square (iOS rounds the corners itself), glyph a little smaller so it clears the mask
  if (kind === 'ios') return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 64 64"><rect width="64" height="64" fill="${INDIGO}"/><g transform="translate(32 32) scale(.86) translate(-32 -30)">${GLYPH}</g></svg>`;
  // iPhone launch screen: indigo with the book small in the middle (cropped to fit any screen, so keep it central)
  if (kind === 'splash') return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 64 64"><rect width="64" height="64" fill="${INDIGO}"/><g transform="translate(32 32) scale(.16) translate(-32 -30)">${GLYPH}</g></svg>`;
  if (kind === 'round') return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="${INDIGO}"/><g transform="translate(32 32) scale(.88) translate(-32 -30)">${GLYPH}</g></svg>`;
  // adaptive-icon foreground: transparent, glyph inside the central safe zone
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="-14 -16 92 92">${GLYPH}</svg>`;
};

const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const res = path.join(ROOT, 'apps/mobile/android/app/src/main/res');

const jobs = [];
for (const [d, k] of Object.entries(DENS)) {
  jobs.push({ kind: 'tile', size: Math.round(48 * k), out: path.join(res, `mipmap-${d}`, 'ic_launcher.png') });
  jobs.push({ kind: 'round', size: Math.round(48 * k), out: path.join(res, `mipmap-${d}`, 'ic_launcher_round.png') });
  jobs.push({ kind: 'fg', size: Math.round(108 * k), out: path.join(res, `mipmap-${d}`, 'ic_launcher_foreground.png') });
}
jobs.push({ kind: 'ios', size: 1024, out: path.join(ROOT, 'apps/mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'), opaque: true });
for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  jobs.push({ kind: 'splash', size: 2732, out: path.join(ROOT, 'apps/mobile/ios/App/App/Assets.xcassets/Splash.imageset', f), opaque: true });
}
const ICO_SIZES = [16, 32, 48, 64, 128, 256];
const buffers = new Map();
for (const s of [...ICO_SIZES, 512]) jobs.push({ kind: 'tile', size: s, key: `tile${s}` });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let win;
const TILE = 512; // the window size; larger images are captured in 512px tiles (a bigger window gets squashed on small screens)

async function capture(html, size) {
  await win.webContents.executeJavaScript(`document.body.innerHTML = ${JSON.stringify(html)}`);
  await sleep(180);
  let img = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size });
  const got = img.getSize();
  if (got.width !== size || got.height !== size) img = img.resize({ width: size, height: size, quality: 'best' });
  return img;
}

async function render(kind, size, opaque = false) {
  if (size <= TILE) {
    const img = await capture(svg(kind, size), size);
    return opaque ? opaquePng(img.toBitmap(), size, size) : img.toPNG();
  }
  // Big image: shift the drawing under the window one tile at a time and stitch the tiles (BGRA) together.
  const out = Buffer.alloc(size * size * 4);
  for (let ty = 0; ty < size; ty += TILE) {
    for (let tx = 0; tx < size; tx += TILE) {
      const html = `<div style="position:absolute;left:${-tx}px;top:${-ty}px">${svg(kind, size)}</div>`;
      const tile = (await capture(html, TILE)).toBitmap();
      for (let y = 0; y < TILE && ty + y < size; y++) {
        tile.copy(out, ((ty + y) * size + tx) * 4, y * TILE * 4, (y * TILE + Math.min(TILE, size - tx)) * 4);
      }
    }
  }
  if (!opaque) throw new Error('large transparent icons are not needed');
  return opaquePng(out, size, size);
}

// Apple refuses an app icon with an alpha channel, so the iPhone icon is re-encoded as plain RGB.
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function opaquePng(bgra, width, height) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4, o = y * (width * 3 + 1) + 1 + x * 3;
      raw[o] = bgra[i + 2]; raw[o + 1] = bgra[i + 1]; raw[o + 2] = bgra[i];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', require('node:zlib').deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function ico(pngs) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); e.writeUInt8(0, 3); e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8); e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([head, ...entries, ...pngs.map((p) => p.data)]);
}

const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); };

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  win = new BrowserWindow({
    show: false, width: 512, height: 512, useContentSize: true, frame: false, transparent: true,
    webPreferences: { offscreen: true },
  });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<!doctype html><html><body style="margin:0;background:transparent;overflow:hidden"></body></html>'));
  for (const j of jobs) {
    const png = await render(j.kind, j.size, j.opaque);
    if (j.out) write(j.out, png); else buffers.set(j.key, png);
  }
  write(path.join(ROOT, 'apps/desktop/build/icon.png'), buffers.get('tile512'));
  write(path.join(ROOT, 'docs/design/logo-512.png'), buffers.get('tile512'));
  write(path.join(ROOT, 'apps/desktop/build/icon.ico'), ico(ICO_SIZES.map((s) => ({ size: s, data: buffers.get(`tile${s}`) }))));
  const url = (b) => `data:image/png;base64,${b.toString('base64')}`;
  write(path.join(ROOT, 'apps/desktop/src/trayIcon.ts'),
    `// Generated by scripts/make-icons.cjs. Do not edit.\nexport const TRAY_ICON_DATA_URL = '${url(buffers.get('tile32'))}';\nexport const APP_ICON_DATA_URL = '${url(buffers.get('tile256'))}';\n`);
  console.log('icons written:', jobs.length, 'images');
  app.quit();
});
