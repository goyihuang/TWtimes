// 重新下載街區的 OpenStreetMap 資料（需要 Node 18+）。
// 用法：npm run fetch-osm -- [西經,南緯,東經,北緯] [輸出檔名]
// 預設是臺中車站周邊。新增街區時換一組範圍與檔名即可。
import { writeFile } from 'node:fs/promises';

const [bboxArg, outArg] = process.argv.slice(2);
const [w, s, e, n] = (bboxArg || '120.6765,24.1325,120.6915,24.1450').split(',').map(Number);
const out = outArg || 'public/data/taichung-station.osm.json';
const ORIGIN = [Math.floor(w * 100) / 100, Math.floor(s * 100) / 100];

const res = await fetch(`https://api.openstreetmap.org/api/0.6/map.json?bbox=${w},${s},${e},${n}`, { headers: { 'User-Agent': 'TWtimes/0.1 (https://github.com/goyihuang/TWtimes)' } });
if (!res.ok) throw new Error('OSM API ' + res.status);
const j = await res.json();
const nodes = new Map(), ways = new Map();
for (const el of j.elements) { if (el.type === 'node') nodes.set(el.id, el); else if (el.type === 'way') ways.set(el.id, el); }
const keep = ['building', 'building:levels', 'height', 'highway', 'name', 'name:en', 'name:zh', 'waterway', 'railway', 'natural', 'leisure', 'amenity', 'shop', 'lanes', 'width', 'layer', 'bridge', 'tunnel', 'min_height', 'building:min_level', 'building:part', 'historic', 'tourism', 'roof:shape', 'oneway', 'landuse', 'area', 'man_made', 'start_date', 'heritage', 'public_transport'];
const pick = t => { const o = {}; for (const k of keep) if (t?.[k] != null) o[k] = t[k]; return o; };
const wanted = t => t && (t.building || t['building:part'] || t.highway || t.waterway || t.railway || t.natural || t.leisure || t.landuse || t.amenity === 'parking' || t.man_made === 'bridge');
const geom = w => w.nodes.map(id => nodes.get(id)).filter(Boolean).map(nd => [Math.round((nd.lon - ORIGIN[0]) * 1e6), Math.round((nd.lat - ORIGIN[1]) * 1e6)]);
const outWays = [];
for (const wy of ways.values()) if (wanted(wy.tags)) outWays.push([wy.id, pick(wy.tags), geom(wy)]);
for (const r of j.elements) {
  if (r.type !== 'relation' || r.tags?.type !== 'multipolygon' || !wanted(r.tags)) continue;
  for (const m of r.members) if (m.type === 'way' && m.role !== 'inner' && ways.has(m.ref)) outWays.push([m.ref, { ...pick(r.tags), _rel: r.id }, geom(ways.get(m.ref))]);
}
await writeFile(out, JSON.stringify({ origin: ORIGIN, scale: 1e-6, source: '© OpenStreetMap contributors (ODbL)', fetched: new Date().toISOString().slice(0, 10), bbox: [w, s, e, n], ways: outWays }));
console.log(`寫入 ${out}：${outWays.length} 筆`);
