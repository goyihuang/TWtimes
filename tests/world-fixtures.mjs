// 測試用向量圖磚：把 repo 內的 OSM 街區檔（臺南站區）轉成 OpenMapTiles 架構的 MVT。
// 雲端測試環境連不到 OpenFreeMap，e2e 測試用這些圖磚模擬；真實圖磚已在使用者瀏覽器確認（docs/world.md）。
import { readFileSync } from 'node:fs';
import geojsonvt from 'geojson-vt';
import vtpbf from 'vt-pbf';

const ROAD = { motorway: 'motorway', trunk: 'trunk', primary: 'primary', secondary: 'secondary', tertiary: 'tertiary', residential: 'minor', unclassified: 'minor', living_street: 'minor', service: 'service', track: 'track', footway: 'path', pedestrian: 'path', path: 'path', cycleway: 'path', steps: 'path' };
for (const k of ['motorway', 'trunk', 'primary', 'secondary', 'tertiary']) ROAD[k + '_link'] = k;

export function omtLayers(files) {
  const L = { building: [], transportation: [], water: [], waterway: [], park: [], landcover: [], landuse: [], place: [], poi: [] };
  for (const f of files) {
    const d = JSON.parse(readFileSync(f, 'utf8')), [ox, oy] = d.origin, k = d.scale || 1e-6;
    for (const [, t, pts] of d.ways) {
      const c = pts.map(([x, y]) => [ox + x * k, oy + y * k]);
      const closed = c.length > 3 && c[0][0] === c.at(-1)[0] && c[0][1] === c.at(-1)[1];
      const poly = { type: 'Polygon', coordinates: [c] }, line = { type: 'LineString', coordinates: c };
      if ((t.building || t['building:part']) && closed) {
        const h = parseFloat(t.height), lv = parseFloat(t['building:levels']);
        L.building.push({ type: 'Feature', geometry: poly, properties: { render_height: h || (lv ? lv * 3.66 : 5), render_min_height: parseFloat(t.min_height) || 0 } });
      } else if (t.highway && ROAD[t.highway] && !closed) {
        const cls = ROAD[t.highway];
        L.transportation.push({ type: 'Feature', geometry: line, properties: { class: cls, ...(cls === 'path' ? { subclass: t.highway } : {}), ...(t.bridge ? { brunnel: 'bridge', layer: +t.layer || 1 } : {}), ...(t.tunnel ? { brunnel: 'tunnel' } : {}), ...(/_link$/.test(t.highway) ? { ramp: 1 } : {}) } });
      } else if (t.railway && ['rail', 'light_rail', 'subway', 'narrow_gauge'].includes(t.railway)) {
        L.transportation.push({ type: 'Feature', geometry: line, properties: { class: t.railway === 'rail' ? 'rail' : 'transit', subclass: t.railway, ...(t.tunnel ? { brunnel: 'tunnel' } : {}), ...(t.bridge ? { brunnel: 'bridge', layer: +t.layer || 1 } : {}) } });
      } else if (closed && (t.natural === 'water' || t.water)) L.water.push({ type: 'Feature', geometry: poly, properties: { class: 'lake' } });
      else if (t.waterway && !closed) L.waterway.push({ type: 'Feature', geometry: line, properties: { class: t.waterway } });
      else if (closed && (t.leisure === 'park' || t.leisure === 'garden')) L.park.push({ type: 'Feature', geometry: poly, properties: { class: 'park' } });
      else if (closed && (t.landuse === 'grass' || t.leisure === 'pitch')) L.landcover.push({ type: 'Feature', geometry: poly, properties: { class: 'grass' } });
      else if (closed && (t.natural === 'wood' || t.landuse === 'forest')) L.landcover.push({ type: 'Feature', geometry: poly, properties: { class: 'wood' } });
      else if (closed && t.amenity === 'school') L.landuse.push({ type: 'Feature', geometry: poly, properties: { class: 'school' } });
    }
  }
  L.place.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [120.2050, 22.9920] }, properties: { class: 'city', name: 'Tainan', 'name:zh-Hant': '臺南', rank: 3 } });
  L.place.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [120.1610, 23.0010] }, properties: { class: 'town', name: 'Anping', 'name:zh-Hant': '安平', rank: 8 } });
  L.poi.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [120.2126, 22.9971] }, properties: { class: 'railway', subclass: 'station', name: '臺南', 'name:zh-Hant': '臺南車站', rank: 1 } });
  return L;
}

export function tileServer(files) {
  const L = omtLayers(files), idx = {};
  for (const [name, features] of Object.entries(L)) idx[name] = new geojsonvt({ type: 'FeatureCollection', features }, { maxZoom: 14, indexMaxZoom: 6, extent: 4096, buffer: 64, tolerance: 1 });
  return (z, x, y) => {
    const layers = {};
    for (const [name, ix] of Object.entries(idx)) { const t = ix.getTile(z, x, y); if (t) layers[name] = t; }
    return Buffer.from(vtpbf.fromGeojsonVt(layers, { version: 2, extent: 4096 }));
  };
}
