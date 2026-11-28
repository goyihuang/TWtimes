// 景點切換選單（registry.js）與現代街景（osm.js、rules.js）的純函式測試
import fs from 'fs';
import { REGIONS, regionOf, modeOf, placeKey, sceneHref, currentScene, geoOrder, project, MINI } from '../src/shared/registry.js';
import { fromOverpass, fromCompact, overpassQuery, projector } from '../src/streetscape/osm.js';
import { heightOf, roadWidth } from '../src/streetscape/rules.js';
const reg = JSON.parse(fs.readFileSync(new URL('../public/data/scene-registry.json', import.meta.url)));
const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1 } else console.log('ok', m) };
const S = reg.scenes, by = id => S.find(s => s.id === id);

// 每個地景的縣市都屬於某個區域
for (const s of S) assert(REGIONS.some(r => r.cities.includes(s.city)), `${s.id} city ${s.city} has region`);
assert(regionOf('台南市') === 'south' && regionOf('花蓮縣') === 'east' && regionOf('金門縣') === 'islands', 'regionOf 臺/台');
// 呈現方式與入口
assert(modeOf(by('tainan-station')) === 'history3d' && sceneHref(by('tainan-station')) === './?place=tainan', 'live → 原本的 3D 場景');
assert(modeOf(by('keelung-station')) === 'modern' && sceneHref(by('keelung-station')) === './?place=osm&id=keelung-station', '有座標的候選 → 現代街景');
assert(modeOf(by('hsinchu-station')) === 'card' && sceneHref(by('hsinchu-station')).startsWith('./map.html#sel=hsinchu-station'), '座標待查 → 地圖圖鑑');
// 已上線景點的 place key 不重複，且都能從網址找回
const keys = S.filter(s => s.status === 'live').map(placeKey);
assert(new Set(keys).size === keys.length && keys.every(Boolean), 'live place keys unique: ' + keys.join(','));
for (const s of S.filter(s => s.status === 'live')) assert(currentScene(S, '?place=' + placeKey(s))?.id === s.id, `currentScene ?place=${placeKey(s)}`);
assert(currentScene(S, '?place=osm&id=keelung-station')?.id === 'keelung-station', 'currentScene osm id');
assert(currentScene(S, '?place=nowhere') === null, 'currentScene unknown → null');
// 北到南
const order = geoOrder(S.filter(s => s.lat != null)).map(s => regionOf(s.city));
assert(order.join() === [...order].sort((a, b) => REGIONS.findIndex(r => r.id === a) - REGIONS.findIndex(r => r.id === b)).join(), 'geoOrder 依區域北到南');
// 首頁設定
assert(by(reg.home.scene)?.status === 'live' && placeKey(by(reg.home.scene)) === 'tainan', 'home.scene 是臺南（index.html 寫死 ?place=tainan，兩邊要一致）');
assert(reg.home.featured.every(id => by(id)?.thumbnail), 'home.featured 都有縮圖');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert(html.includes(`'?place=${placeKey(by(reg.home.scene))}'`), 'index.html 首頁場景與 registry.home 一致');
// 小地圖投影在畫布內
for (const s of S.filter(s => s.lat != null && s.lng > MINI.lng0)) { const [x, y] = project(s.lng, s.lat); assert(x >= 0 && x <= MINI.w && y >= 0 && y <= MINI.h, `${s.id} 小地圖座標在範圍內`); }

// Overpass → 本地公尺
const P = projector(23, 120.2); const [x, z] = P(23.001, 120.201);
assert(Math.abs(x - 102.47) < 0.5 && Math.abs(z + 110.54) < 0.5, `projector 東 +x、北 -z：${x.toFixed(1)},${z.toFixed(1)}`);
const ov = { elements: [
  { type: 'node', id: 1, lat: 23, lon: 120.2 }, { type: 'node', id: 2, lat: 23, lon: 120.2001 }, { type: 'node', id: 3, lat: 23.0001, lon: 120.2001 },
  { type: 'node', id: 4, lat: 23.0002, lon: 120.2, tags: { natural: 'tree' } },
  { type: 'way', id: 10, nodes: [1, 2, 3, 1], tags: { building: 'yes' } }, { type: 'way', id: 11, nodes: [1, 2, 3, 1] }, { type: 'way', id: 12, nodes: [1, 2], tags: { highway: 'primary' } },
  { type: 'relation', id: 20, tags: { type: 'multipolygon', natural: 'water' }, members: [{ type: 'way', ref: 11, role: 'outer' }] },
] };
const d = fromOverpass(ov, 23, 120.2);
assert(d.ways.length === 3 && d.ways.some(w => w.id === 11 && w.tags.natural === 'water'), 'multipolygon 外環帶上關係標籤');
assert(d.nodes.length === 1 && d.nodes[0].tags.natural === 'tree', '單株樹');
const compact = JSON.parse(fs.readFileSync(new URL('../public/data/tainan-station.osm.json', import.meta.url)));
const c = fromCompact(compact, 22.9971, 120.2126);
assert(c.ways.length > 1000 && c.ways.every(w => w.pts.every(p => Math.abs(p[0]) < 30000 && Math.abs(p[1]) < 30000) && c.ways.filter(w => w.tags.building).every(w => Math.hypot(...w.pts[0]) < 1500)), `fetch-osm 格式可直接用（${c.ways.length} 筆）`);
assert(/around:350,22\.997100,120\.212600/.test(overpassQuery(22.9971, 120.2126, 350)) && overpassQuery(23, 120, 300).includes('out body'), 'Overpass 查詢字串');

// 高度與路寬推估
const r = () => 0.5;
assert(heightOf({ building: 'yes', height: '42' }, 300, r).h === 42 && !heightOf({ building: 'yes', height: '42' }, 300, r).guessed, 'height 標籤優先');
assert(Math.abs(heightOf({ building: 'yes', 'building:levels': '5' }, 300, r).h - 17.1) < 0.01, 'building:levels × 3.3 + 0.6');
const hotel = heightOf({ 'building:part': 'hotel', height: '140', min_height: '24' }, 1700, r);
assert(hotel.y0 === 24 && hotel.h === 116, 'min_height：底部抬高、量體高度扣除');
const g = heightOf({ building: 'yes' }, 120, r); assert(g.guessed && g.h > 9 && g.h < 18, '無資料的街屋推估 3–5 層：' + g.h.toFixed(1));
assert(heightOf({ building: 'temple' }, 200, r).h === 8, '廟宇一層高');
assert(roadWidth({ highway: 'primary' }) === 16 && roadWidth({ highway: 'residential', width: '9' }) === 9 && roadWidth({ highway: 'primary' }, 1.5) === 24 && roadWidth({ highway: 'footway' }, 1.5) === 2.2, '路寬：標籤、等級、倍率（人行道不放大）');
// 烘焙格式可被引擎讀回，座標一致
const { toCompact } = await import('../src/streetscape/osm.js');
const back = fromCompact(toCompact(ov, 23, 120.2, 500), 23, 120.2);
assert(back.ways.length === 3 && back.nodes.length === 1 && Math.abs(back.ways.find(w => w.id === 10).pts[1][0] - d.ways.find(w => w.id === 10).pts[1][0]) < 0.2, '烘焙 → 讀回座標一致');
