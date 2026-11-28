// 全臺立體地景 e2e：在無頭 Chromium 開 ?place=tw，向量圖磚用 world-fixtures.mjs 模擬（雲端連不到 OpenFreeMap），
// 地形圖磚走真的 AWS（連不到時用平地）。輸出截圖到 OUT 資料夾。
// 用法：npm run build && npx vite preview --port 4173 & node tests/world-e2e.mjs [輸出資料夾]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { tileServer } from './world-fixtures.mjs';

const OUT = process.argv[2] || 'tests/out'; mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4173/';
const vec = tileServer(['public/data/tainan-station.osm.json']);
const CACHE = '/tmp/twtimes-dem'; mkdirSync(CACHE, { recursive: true });

// 平地 PNG（海拔 10 m），地形下載失敗時用
function flatPng() {
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = ~0; for (const v of b) x = t[(x ^ v) & 255] ^ (x >>> 8); return (~x) >>> 0; };
  const chunk = (type, data) => { const b = Buffer.alloc(8 + data.length + 4); b.writeUInt32BE(data.length); b.write(type, 4); data.copy(b, 8); b.writeUInt32BE(crc(Buffer.concat([Buffer.from(type), data])), 8 + data.length); return b; };
  const raw = Buffer.alloc(256 * (1 + 256 * 3)); for (let y = 0; y < 256; y++) { raw[y * 769] = 0; for (let x = 0; x < 256; x++) raw.set([128, 10, 0], y * 769 + 1 + x * 3); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(256); ihdr.writeUInt32BE(256, 4); ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const FLAT = flatPng();
async function dem(url) {
  const f = CACHE + '/' + url.split('/terrarium/')[1].replaceAll('/', '_');
  if (existsSync(f)) return readFileSync(f);
  try { const r = await fetch(url); if (!r.ok) throw new Error(r.status); const b = Buffer.from(await r.arrayBuffer()); writeFileSync(f, b); return b; } catch { return FLAT; }
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
let vecHits = 0, demHits = 0;
await ctx.route('https://tiles.openfreemap.org/**', async route => {
  const u = new URL(route.request().url());
  if (u.pathname === '/planet') return route.fulfill({ json: { tiles: ['https://tiles.openfreemap.org/planet/test/{z}/{x}/{y}.pbf'], maxzoom: 14 }, headers: { 'access-control-allow-origin': '*' } });
  const m = u.pathname.match(/(\d+)\/(\d+)\/(\d+)\.pbf$/); if (!m) return route.fulfill({ status: 404 });
  vecHits++; route.fulfill({ body: vec(+m[1], +m[2], +m[3]), contentType: 'application/x-protobuf', headers: { 'access-control-allow-origin': '*' } });
});
await ctx.route('https://s3.amazonaws.com/elevation-tiles-prod/**', async route => { demHits++; route.fulfill({ body: await dem(route.request().url()), contentType: 'image/png', headers: { 'access-control-allow-origin': '*' } }); });

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const settle = async (ms = 300000) => {
  const t0 = Date.now(); let last = -1;
  while (Date.now() - t0 < ms) {
    const n = await page.evaluate(() => window.world ? window.world.stats().loading : -1).catch(() => -1);
    if (n === 0) { await page.waitForTimeout(2500); return; }
    if (n !== last) { process.stderr.write(`  載入中 ${n}\n`); last = n; }
    await page.waitForTimeout(2000);
  }
  throw new Error('圖磚載入逾時');
};
const shots = [
  ['tw-tainan-bird', '?place=tw&id=tainan-station'],
  ['tw-tainan-oblique', '?place=tw&id=tainan-station&d=330&pt=26&hd=-35'],
  ['tw-tainan-dusk', '?place=tw&id=tainan-station&d=520&pt=32&hd=150&t=17.25'],
  ['tw-yushan', '?place=tw&ll=23.47,120.957&d=14000&pt=24&hd=60&labels=1'],
  ['tw-island', '?place=tw&ll=23.65,120.95&d=520000&pt=62&hd=0'],
];
const report = {};
for (const [name, q] of shots) {
  const t0 = Date.now();
  await page.goto(BASE + q, { waitUntil: 'load' });
    await settle();
  await page.screenshot({ path: `${OUT}/${name}.jpg`, quality: 82, type: 'jpeg' });
  report[name] = { ms: Date.now() - t0, ...(await page.evaluate(() => { const s = window.world.stats(); return { ...s, z: [...window.world.shown].map(t => t.z).sort().join('') .replace(/(\d+)(?=\1)/g, '').slice(0, 40), status: document.getElementById('status')?.textContent }; })) };
}
// 漫步：人眼高度貼地
await page.goto(BASE + '?place=tw&id=tainan-station&d=330&pt=26', { waitUntil: 'load' }); await settle();
await page.evaluate(() => window.world.setShot(2)); await page.waitForTimeout(500); await settle();
const walk = await page.evaluate(() => { const w = window.world, c = w.camera.position; return { eyeAboveGround: +(c.y - w.heightAt(c.x, c.z)).toFixed(2), walk: w.state.walk }; });
await page.screenshot({ path: `${OUT}/tw-tainan-walk.jpg`, quality: 82, type: 'jpeg' });
const share = await page.evaluate(() => window.world.shareURL());
console.log(JSON.stringify({ report, walk, share, vecHits, demHits, errors: errors.slice(0, 10) }, null, 1));
await browser.close();
if (errors.some(e => !/favicon|ERR_|net::/.test(e))) process.exitCode = 1;
