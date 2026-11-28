// 預先下載現代街景的 OSM 街區（需要 Node 18+、可連 Overpass API）。
// 用法：npm run bake-osm            → 所有「有座標、未上線」的地景
//       npm run bake-osm -- <id> …  → 指定地景
// 輸出 public/data/osm/<id>.json（已列入 .gitignore；GitHub Actions 部署前自動執行，失敗不擋部署，網頁會改用瀏覽器即時查詢）。
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { overpassQuery, toCompact, OVERPASS } from '../src/streetscape/osm.js';

const RADIUS = 500;
const reg = JSON.parse(await readFile(new URL('../public/data/scene-registry.json', import.meta.url), 'utf8'));
const want = process.argv.slice(2);
const list = reg.scenes.filter(s => Number.isFinite(s.lat) && (want.length ? want.includes(s.id) : s.status !== 'live'));
await mkdir(new URL('../public/data/osm/', import.meta.url), { recursive: true });
let failed = 0;
for (const s of list) {
  let ok = false;
  for (const url of OVERPASS) {
    try {
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(overpassQuery(s.lat, s.lng, RADIUS)), headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'TWtimes-bake/1.0 (+https://github.com/goyihuang/TWtimes)' }, signal: AbortSignal.timeout(90000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = toCompact(await r.json(), s.lat, s.lng, RADIUS);
      await writeFile(new URL(`../public/data/osm/${s.id}.json`, import.meta.url), JSON.stringify(data));
      console.log(`✓ ${s.id}：${data.ways.length} 筆線面、${data.nodes.length} 棵樹（${new URL(url).host}）`); ok = true; break;
    } catch (e) { console.warn(`  ${s.id} @ ${new URL(url).host}：${e.message}`); }
  }
  if (!ok) { failed++; console.warn(`✗ ${s.id} 下載失敗，網頁會改用即時查詢`); }
  await new Promise(r => setTimeout(r, 2000)); // 對 Overpass 客氣一點
}
console.log(`完成 ${list.length - failed}／${list.length}`);
