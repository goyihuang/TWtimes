import { lonLatToXZ, polygonArea } from './geo.js';

// 讀入預先下載的 OpenStreetMap 資料，轉成場景用的「原始街景」(base)。
// base 永遠不被修改；使用者的編輯放在 edits 圖層（見 edits.js）。
export async function loadBase(url) {
  const res = await fetch(url);
  const raw = await res.json();
  const [olon, olat] = raw.origin;
  const s = raw.scale;
  const base = { buildings: [], roads: [], waterways: [], rails: [], areas: [], source: raw.source };
  const seen = new Set();
  for (const [id, tags, coords] of raw.ways) {
    const pts = coords.map(([x, y]) => lonLatToXZ(olon + x * s, olat + y * s));
    const closed = pts.length > 3 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1];
    const key = id + (tags._rel ? ':' + tags._rel : '');
    if (seen.has(key)) continue;
    seen.add(key);
    if ((tags.building || tags['building:part']) && closed) {
      const ring = pts.slice(0, -1);
      if (polygonArea(ring) < 0) ring.reverse(); // 統一為逆時針（x 東 z 南的座標系）
      base.buildings.push({ id, tags, ring, area: Math.abs(polygonArea(ring)) });
    } else if (tags.highway) {
      if (tags.highway === 'elevator' || tags.highway === 'platform' || tags.area === 'yes') continue;
      base.roads.push({ id, tags, line: pts });
    } else if (tags.waterway) {
      base.waterways.push({ id, tags, line: pts });
    } else if (tags.railway) {
      if (tags.railway === 'platform') { if (closed) base.areas.push({ id, tags, kind: 'platform', ring: pts.slice(0, -1) }); continue; }
      base.rails.push({ id, tags, line: pts });
    } else if (closed) {
      const kind = areaKind(tags);
      if (kind) base.areas.push({ id, tags, kind, ring: pts.slice(0, -1) });
    }
  }
  return base;
}

function areaKind(t) {
  if (t.natural === 'water' || t.landuse === 'basin') return 'water';
  if (t.leisure === 'park' || t.leisure === 'garden') return 'park';
  if (t.landuse === 'grass' || t.natural === 'grassland' || t.landuse === 'greenfield' || t.leisure === 'playground') return 'grass';
  if (t.leisure === 'pitch' || t.leisure === 'track') return 'pitch';
  if (t.landuse === 'construction' || t.landuse === 'brownfield') return 'dirt';
  if (t.amenity === 'parking') return 'paved';
  return null;
}
