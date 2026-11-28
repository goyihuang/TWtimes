// 畫面風格與片場工具 e2e：線稿＋網點、年代調色表、移軸、柔和陰影、紙雕彈起、9:16 短片、出處標示、どこでもロケハン連結。
// 圖磚模擬方式同 world-e2e.mjs。用法：npm run build && npx vite preview --port 4173 & node tests/look-e2e.mjs [輸出資料夾]
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
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, acceptDownloads: true });
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

const T = '?place=tw&id=tainan-station&d=330&pt=26&hd=-35';
const shots = [
  ['look-base', T],
  ['look-colorline-showa', T + '&draw=colorLine&lut=showa'],
  ['look-linetone', T + '&draw=lineTone'],
  ['look-line', T + '&draw=line&lw=1.6'],
  ['look-miniature', '?place=tw&id=tainan-station&d=700&pt=40&hd=-35&tilt=0.85&tf=0.5'],
  ['look-soft-dusk', '?place=tw&id=tainan-station&d=330&pt=26&hd=150&t=16.5&soft=1&lut=fade60'],
];
const report = {};
const ONLY = process.env.ONLY; // 例：ONLY=look-miniature 只截這一張
for (const [name, q] of shots.filter(([n]) => !ONLY || n === ONLY)) {
  await page.goto(BASE + q, { waitUntil: 'load' }); await settle();
  await page.waitForTimeout(1500); // 紙雕彈起動畫結束
  await page.screenshot({ path: `${OUT}/${name}.jpg`, quality: 82, type: 'jpeg' });
  report[name] = await page.evaluate(() => ({ credit: document.getElementById('creditLine')?.textContent, draw: document.getElementById('lkDraw')?.value, lut: document.getElementById('lkLut')?.value, tilt: document.getElementById('lkTilt')?.value }));
}
if (ONLY) { console.log(JSON.stringify({ report, errors })); await browser.close(); process.exit(errors.length ? 1 : 0); }
// 紙雕彈起：重播後 0.3 秒截圖（建物還在長）
await page.goto(BASE + T, { waitUntil: 'load' }); await settle(); await page.waitForTimeout(1500);
const popH = await page.evaluate(async () => {
  window.world.replayPop(); await new Promise(r => setTimeout(r, 280));
  return true;
});
await page.screenshot({ path: `${OUT}/look-pop-mid.jpg`, quality: 82, type: 'jpeg' });
// 面板（片場工具展開）
const panel = await page.$('#spStudio'); if (panel) await panel.screenshot({ path: `${OUT}/look-panel.jpg`, quality: 85, type: 'jpeg' });
// どこでもロケハン連結
await page.dispatchEvent('#rokehan', 'pointerenter').catch(() => { });
const rokehan = await page.getAttribute('#rokehan', 'href').catch(() => null);
// 分享網址帶畫面風格
await page.selectOption('#lkDraw', 'lineTone'); await page.fill('#lkTilt', '0.5').catch(() => { });
await page.$eval('#lkTilt', e => { e.value = '0.5'; e.dispatchEvent(new Event('input')); });
await page.click('#share').catch(() => { });
const shareUrl = await page.evaluate(() => location.href);
// 9:16 短片 3 秒
await page.selectOption('#lkDraw', 'color');
await page.$eval('#clSec', e => { e.value = '4'; e.dispatchEvent(new Event('input')); });
const dl = page.waitForEvent('download', { timeout: 240000 }).catch(e => null);
await page.click('#clRec');
await page.waitForTimeout(1800);
await page.screenshot({ path: `${OUT}/look-recording.jpg`, quality: 80, type: 'jpeg' });
const d = await dl; let clip = null;
if (d) { const p = `${OUT}/${d.suggestedFilename()}`; await d.saveAs(p); clip = { name: d.suggestedFilename(), ...(await page.evaluate(() => window.lastClip)) }; }
const canvasAfter = await page.evaluate(() => { const c = document.querySelector('#stage canvas'); return { css: c.style.cssText, w: c.width, h: c.height }; });
// 臺南驛前（有年代）：調色表依年代自動
await page.goto(BASE + '?place=tainan&lut=auto&draw=colorLine', { waitUntil: 'load' });
await page.waitForFunction(() => document.getElementById('lkLut'), null, { timeout: 180000 }).catch(() => { });
await page.waitForTimeout(6000);
await page.screenshot({ path: `${OUT}/look-tainan-auto.jpg`, quality: 82, type: 'jpeg' });
const tainan = await page.evaluate(() => ({ credit: document.getElementById('creditLine')?.textContent, lut: document.getElementById('lkLut')?.value, status: document.getElementById('status')?.textContent }));
console.log(JSON.stringify({ report, rokehan, shareUrl, clip, canvasAfter, tainan, vecHits, demHits, errors: errors.slice(0, 10) }, null, 1));
await browser.close();
if (errors.some(e => !/favicon|ERR_|net::/.test(e))) process.exitCode = 1;
