// 全臺 101 處現代街景清單（public/data/places-101.json）的共用工具。純函式可在 Node 直接測試。
// 這份清單專收「現代街景」的取景點（車站、老街、古蹟、地標…），和 scene-registry.json 的今昔地景分開；
// 同一個地點兩邊都有時用同一個 id（如 tainan-station），清單項目旁會多一個「3D 今昔」捷徑。
import { REGIONS } from './registry.js';

// 縣市順序：臺北市優先，其餘依 REGIONS（北→中→南→東→離島）
export const CITY_ORDER = ['臺北市', ...REGIONS.flatMap(r => r.cities).filter(c => c !== '臺北市')];
export const cityShort = c => String(c || '').replace(/[市縣]$/, '');

// 依縣市分組，組內保持清單原本的順序（清單本身已按知名度／地理排好）
export function groupByCity(places) {
  const m = new Map(CITY_ORDER.map(c => [c, []]));
  for (const p of places) { if (!m.has(p.city)) m.set(p.city, []); m.get(p.city).push(p); }
  return [...m].filter(([, list]) => list.length).map(([city, list]) => ({ city, list }));
}

// 現代街景網址
export const placeHref = p => './?place=osm&id=' + encodeURIComponent(p.id);
// 清單上的顯示名稱：「臺北・西門町」
export const placeLabel = p => `${cityShort(p.city)}・${p.name}`;

// 隨機抽一處（避開目前這處）；rand 可注入以便測試
export function randomPlace(places, excludeId = null, rand = Math.random) {
  const pool = places.filter(p => p.id !== excludeId);
  return pool.length ? pool[Math.floor(rand() * pool.length) % pool.length] : null;
}

// 清單內搜尋：名稱、別名、縣市、鄉鎮、類型；空白分隔的每個詞都要符合
const norm = s => String(s || '').toLowerCase().replace(/台/g, '臺').replace(/\s+/g, '');
export function searchPlaces(places, query) {
  const terms = String(query || '').trim().split(/\s+/).map(norm).filter(Boolean);
  if (!terms.length) return places;
  return places.filter(p => {
    const hay = norm([p.name, p.city, p.district, p.kind, ...(p.aliases || [])].join('|'));
    return terms.every(t => hay.includes(t));
  });
}

let cache = null;
export function loadPlaces(base = document.baseURI) {
  return cache ||= fetch(new URL('data/places-101.json', base)).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch(e => { cache = null; throw e; });
}

// 用 id 找地點：先找 101 清單，再找今昔地景資料庫（現代街景、全臺立體地景共用）
export async function findPlaceById(id, base = document.baseURI) {
  if (!id) return null;
  try { const d = await loadPlaces(base); const p = d.places.find(x => x.id === id); if (p) return p; } catch { }
  try { const reg = await fetch(new URL('data/scene-registry.json', base)).then(r => r.json()); return reg.scenes.find(s => s.id === id) || null; } catch { return null; }
}
