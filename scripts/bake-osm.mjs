// 預先下載現代街景的 OSM 街區（需要 Node 18+、可連 Overpass API）。
// 用法：npm run bake-osm                       → 全臺 101 處清單＋所有「有座標、未上線」的今昔地景
//       npm run bake-osm -- <id> …             → 指定地點（重新下載）
//       npm run bake-osm -- --budget=900       → 最多跑 900 秒，跑不完的留到下次
//       npm run bake-osm -- --max-age=30       → 已有、且不到 30 天的檔案略過（預設 30；0 表示全部重抓）
// 輸出 public/data/osm/<id>.json（已列入 .gitignore）。背景工作流程 bake-osm.yml 把這個資料夾存進 Actions 快取，
// 每次只補缺的、過期的，補到新的就觸發部署；部署本身不等下載。沒下載到的地點網頁會改用瀏覽器即時查詢。
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { overpassQuery, toCompact, OVERPASS } from '../src/streetscape/osm.js';

const RADIUS = 500; // 約 1 公里見方（與 src/streetscape/main.js 的 loadStreet radius 一致）
const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? Number(a.split('=')[1]) : d; };
const want = args.filter(a => !a.startsWith('--'));
const budget = opt('budget', Infinity) * 1000, maxAge = opt('max-age', 30) * 86400e3;
const t0 = Date.now();

const read = async f => JSON.parse(await readFile(new URL(`../public/data/${f}`, import.meta.url), 'utf8'));
const reg = await read('scene-registry.json'), { places } = await read('places-101.json');
// 101 清單優先（同 id 只下載一次），再補今昔地景中有座標、未上線的
const all = new Map();
for (const p of places) all.set(p.id, p);
for (const s of reg.scenes) if (Number.isFinite(s.lat) && !all.has(s.id) && (want.length || s.status !== 'live')) all.set(s.id, s);
const list = [...all.values()].filter(s => Number.isFinite(s.lat) && (!want.length || want.includes(s.id)));

const dir = new URL('../public/data/osm/', import.meta.url);
await mkdir(dir, { recursive: true });
const fresh = async id => { try { return Date.now() - (await stat(new URL(`${id}.json`, dir))).mtimeMs < maxAge; } catch { return false; } };

let done = 0, skipped = 0, failed = 0, bytes = 0, deferred = 0;
for (const s of list) {
  if (!want.length && await fresh(s.id)) { skipped++; continue; }
  if (Date.now() - t0 > budget) { deferred++; continue; }
  let ok = false;
  for (const url of OVERPASS) {
    try {
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(overpassQuery(s.lat, s.lng, RADIUS)), headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'TWtimes-bake/1.0 (+https://github.com/goyihuang/TWtimes)' }, signal: AbortSignal.timeout(90000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = toCompact(await r.json(), s.lat, s.lng, RADIUS);
      const txt = JSON.stringify(data); bytes += txt.length;
      await writeFile(new URL(`${s.id}.json`, dir), txt);
      console.log(`✓ ${s.id}：${data.ways.length} 筆線面、${data.nodes.length} 棵樹，${(txt.length / 1024).toFixed(0)} KB（${new URL(url).host}）`); ok = true; done++; break;
    } catch (e) { console.warn(`  ${s.id} @ ${new URL(url).host}：${e.message}`); }
  }
  if (!ok) { failed++; console.warn(`✗ ${s.id} 下載失敗，網頁會改用即時查詢`); }
  await new Promise(r => setTimeout(r, 2000)); // 對 Overpass 客氣一點
}
console.log(`共 ${list.length} 處：新下載 ${done}（${(bytes / 1048576).toFixed(1)} MB）、沿用 ${skipped}、失敗 ${failed}、留到下次 ${deferred}，用時 ${Math.round((Date.now() - t0) / 1000)} 秒`);
