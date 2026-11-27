// 臺南站區 OSM 解析：只作現代街廓與路網依據，不當成歷史證據。
// 本地座標：x 沿站房長軸（面向站房正面往右為 +x）、z 朝站前（北門路／成功路方向）；單位公尺。
// 原點為 OSM relation 6477070（臺南火車站）外框中心，站房後牆 way 436251041 定方位。
export const ORIGIN = { lon: 120.2125815, lat: 22.9971425 };
const ANGLE = Math.atan2(84 * 111320 * Math.cos(ORIGIN.lat * Math.PI / 180), 452 * 110540);
const KX = 111320 * Math.cos(ORIGIN.lat * Math.PI / 180), KY = 110540;

export function toLocal(lon, lat) {
  const east = (lon - ORIGIN.lon) * KX, north = (lat - ORIGIN.lat) * KY;
  return [-north * Math.cos(ANGLE) - east * Math.sin(ANGLE), north * Math.sin(ANGLE) - east * Math.cos(ANGLE)];
}
export function toLonLat(x, z) {
  // toLocal 的反運算（2×2 旋轉矩陣的逆）
  const c = Math.cos(ANGLE), s = Math.sin(ANGLE);
  const north = -x * c + z * s, east = -x * s - z * c;
  return [ORIGIN.lon + east / KX, ORIGIN.lat + north / KY];
}

const SKIP_ROADS = new Set(['footway', 'steps', 'path', 'cycleway', 'corridor', 'pedestrian', 'construction', 'proposed']);
export const MAIN_ROADS = ['北門路', '中山路', '成功路', '民族路', '前鋒路', '大學路', '公園南路', '東寧路'];

export async function loadOSM(url = 'data/tainan-station.osm.json') {
  const r = await fetch(new URL(url, document.baseURI));
  if (!r.ok) throw Error('OSM data unavailable');
  const d = await r.json();
  if (!Array.isArray(d.ways) || !Array.isArray(d.origin)) throw Error('Invalid OSM schema');
  const scale = d.scale || 1e-6;
  const roads = [], buildings = [], platforms = [];
  for (const [id, t, pts] of d.ways) {
    if (!Array.isArray(pts) || pts.length < 2) continue;
    const p = pts.map(q => toLocal(d.origin[0] + q[0] * scale, d.origin[1] + q[1] * scale));
    if (t._rel === 6477070) continue;                       // 站房由 Blender 模型取代
    if (t.highway && !SKIP_ROADS.has(t.highway) && t.tunnel !== 'yes' && t.layer !== '-1') {
      const lanes = Number(t.lanes) || (t.highway === 'primary' ? 3 : t.highway === 'service' ? 1 : 2);
      const width = Number(t.width) || (t.highway === 'service' ? 4.5 : Math.max(6, lanes * 3.2 + (t.oneway === 'yes' ? 0 : 1)));
      roads.push({ id, pts: p, width, kind: t.highway, name: t.name || '', main: MAIN_ROADS.some(n => (t.name || '').startsWith(n)) });
    } else if ((t.railway === 'platform' || t.public_transport === 'platform') && p.length > 3) {
      platforms.push({ id, pts: p, name: t.name || '' });
    } else if (t.building && p.length >= 4) {
      const levels = parseFloat(t['building:levels']) || 0, h = parseFloat(t.height) || 0;
      buildings.push({ id, pts: p, levels, height: h, name: t.name || '', type: t.building });
    }
  }
  return { roads, buildings, platforms, source: d.source, fetched: d.fetched, bbox: d.bbox };
}

// 點到折線距離（用於判斷建物是否臨主要道路）
export function distToRoads(x, z, roads) {
  let best = Infinity;
  for (const r of roads) for (let k = 1; k < r.pts.length; k++) {
    const [ax, az] = r.pts[k - 1], [bx, bz] = r.pts[k], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)), px = ax + dx * t - x, pz = az + dz * t - z;
    best = Math.min(best, Math.hypot(px, pz) - r.width / 2);
  }
  return best;
}
