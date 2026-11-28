// 全臺 101 處現代街景清單（public/data/places-101.json）與 src/shared/places.js 的測試
import fs from 'fs';
import { REGIONS } from '../src/shared/registry.js';
import { CITY_ORDER, groupByCity, placeHref, placeLabel, randomPlace, searchPlaces } from '../src/shared/places.js';
const read = f => JSON.parse(fs.readFileSync(new URL(`../public/data/${f}`, import.meta.url)));
const { places, ...meta } = read('places-101.json'), reg = read('scene-registry.json');
const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1 } else console.log('ok', m) };
const dist = (a, b) => { const k = Math.PI / 180, x = (b.lng - a.lng) * k * Math.cos(a.lat * k), y = (b.lat - a.lat) * k; return Math.hypot(x, y) * 6371000; };

assert(places.length === 101, `清單共 101 處（${places.length}）`);
assert(new Set(places.map(p => p.id)).size === places.length, 'id 不重複');
assert(places.every(p => /^[a-z0-9-]+$/.test(p.id)), 'id 只用小寫英數與連字號（當檔名）');
assert(meta.license && /ODbL/.test(meta.license), '標示 OSM ODbL 出處');
for (const p of places) {
  const inTw = p.lat > 21.8 && p.lat < 26.4 && p.lng > 118.1 && p.lng < 122.1;
  assert(inTw && p.name && p.kind && CITY_ORDER.includes(p.city), `${p.id} 座標在臺灣、縣市有效（${p.city}）`);
}
// 22 個縣市都有
assert(new Set(places.map(p => p.city)).size === CITY_ORDER.length, `涵蓋全部 ${CITY_ORDER.length} 個縣市`);
// 每處約 1 公里見方，彼此至少隔 400 公尺，避免重複下載同一塊
for (let i = 0; i < places.length; i++) for (let j = i + 1; j < places.length; j++) {
  const d = dist(places[i], places[j]); if (d < 400) assert(false, `${places[i].id} 與 ${places[j].id} 只隔 ${d.toFixed(0)} 公尺`);
}
// 與今昔地景同 id 的，座標要一致（同一個街區只下載一次）
for (const p of places) {
  const s = reg.scenes.find(s => s.id === p.id); if (!s || !Number.isFinite(s.lat)) continue;
  assert(dist(p, s) < 300, `${p.id} 與今昔地景座標相差 ${dist(p, s).toFixed(0)} 公尺`);
}
// 分組：依北→南的縣市順序，總數不變
const g = groupByCity(places);
assert(g[0].city === '臺北市' && g.at(-1).city === '連江縣', '分組由臺北市開始、連江縣結束');
assert(g.reduce((n, x) => n + x.list.length, 0) === 101, '分組後總數 101');
assert(g.map(x => x.city).join() === CITY_ORDER.filter(c => g.some(x => x.city === c)).join(), '分組依 REGIONS 順序');
assert([...REGIONS.flatMap(r => r.cities)].sort().join() === [...CITY_ORDER].sort().join(), 'CITY_ORDER 與 REGIONS 是同一組縣市');
// 網址與名稱
const xm = places.find(p => p.id === 'taipei-ximending');
assert(placeHref(xm) === './?place=osm&id=taipei-ximending', 'placeHref → 現代街景');
assert(placeLabel(xm) === '臺北・西門町', 'placeLabel「臺北・西門町」');
// 隨機：不會抽到目前這處
let same = 0; for (let i = 0; i < 200; i++) if (randomPlace(places, 'taipei-ximending').id === 'taipei-ximending') same++;
assert(same === 0, '隨機抽一處會避開目前地點');
assert(randomPlace(places, null, () => 0).id === places[0].id && randomPlace(places, null, () => 0.99999).id === places.at(-1).id, 'randomPlace 範圍');
assert(randomPlace([], null) === null, '空清單回傳 null');
// 搜尋：台／臺通用、別名、多詞
assert(searchPlaces(places, '台北101').some(p => p.id === 'taipei-101'), '搜尋「台北101」');
assert(searchPlaces(places, '紅樓').some(p => p.id === 'taipei-ximending'), '搜尋別名「紅樓」→ 西門町');
assert(searchPlaces(places, '臺南 老街').every(p => p.city === '臺南市'), '多詞搜尋「臺南 老街」');
assert(searchPlaces(places, '').length === 101, '空白搜尋回傳全部');
