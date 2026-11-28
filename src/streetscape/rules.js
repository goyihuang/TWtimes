// 現代街景的推估規則（純函式，Node 可測試）：建物高度、道路寬度。
export const FLOOR = 3.3, BAY = 3.4;
// ── 高度推估 ──
export const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const TYPE_FLOORS = {
  house: [2, 4], detached: [2, 3], semidetached_house: [2, 4], terrace: [3, 5], residential: [3, 7], apartments: [6, 14],
  commercial: [3, 9], retail: [2, 5], office: [6, 18], hotel: [8, 18], industrial: [1, 3], warehouse: [1, 2],
  school: [3, 5], university: [4, 8], hospital: [5, 12], government: [3, 8], public: [2, 5], civic: [2, 5],
  temple: [1, 1], church: [1, 2], shrine: [1, 1], train_station: [1, 3], transportation: [1, 2], parking: [3, 6],
  roof: [1, 1], carport: [1, 1], garage: [1, 1], garages: [1, 1], shed: [1, 1], hut: [1, 1], kiosk: [1, 1], construction: [1, 1],
};
export function heightOf(tags, area, r) {
  const y0 = num(tags.min_height) ?? (num(tags['building:min_level']) != null ? num(tags['building:min_level']) * FLOOR : 0);
  const h = num(tags.height), lv = num(tags['building:levels']);
  if (h) return { h: Math.max(2.5, h - y0), y0, guessed: false };
  if (lv) return { h: Math.max(1, lv - (num(tags['building:min_level']) || 0)) * FLOOR + 0.6, y0, guessed: false };
  let [a, b] = TYPE_FLOORS[tags.building] || TYPE_FLOORS[tags['building:part']] || (area < 55 ? [2, 4] : area < 220 ? [3, 5] : area < 900 ? [4, 9] : [6, 15]);
  if (tags.building === 'yes' && area > 3000) [a, b] = [2, 6];
  const f = a + Math.floor(r() * (b - a + 1)), special = ['temple', 'shrine', 'church', 'roof', 'carport'].includes(tags.building);
  return { h: special ? (tags.building === 'roof' || tags.building === 'carport' ? 4 : 8) : f * FLOOR + 0.6, y0, guessed: true };
}

const ROAD_W = { motorway: 22, trunk: 20, primary: 16, secondary: 13, tertiary: 10, unclassified: 7, residential: 7, living_street: 5, service: 4.5, pedestrian: 6, footway: 2.2, path: 1.6, cycleway: 2.2, steps: 2.4, track: 3, motorway_link: 8, trunk_link: 8, primary_link: 7, secondary_link: 7, tertiary_link: 6 };
export const MAJOR = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary']);
export const WALKWAY = new Set(['footway', 'path', 'cycleway', 'steps', 'pedestrian', 'track']);
export function roadWidth(t, scale = 1) {
  const w = num(t.width); if (w && w > 1 && w < 60) return w * scale;
  const lanes = num(t.lanes); const base = ROAD_W[t.highway] ?? 5;
  return (lanes && !WALKWAY.has(t.highway) ? Math.max(base * 0.7, lanes * 3.3 + 1) : base) * (WALKWAY.has(t.highway) ? 1 : scale);
}

