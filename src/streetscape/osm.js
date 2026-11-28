// 現代街景的資料來源：OpenStreetMap（ODbL）。
// 1. 先找預先下載的街區檔 data/osm/<id>.json（與 scripts/fetch-osm.mjs 同格式，正式上線的景點建議烘焙）
// 2. 沒有就在瀏覽器向 Overpass API 即時查詢，結果存進 Cache Storage 7 天，同一地點不重複查詢
// 輸出統一成本地公尺座標：x 向東、z 向南（three.js 慣例，-z 為北）。
export const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const CACHE = 'twtimes-osm-v1', TTL = 7 * 86400e3;

export function overpassQuery(lat, lng, r) {
  const a = `(around:${Math.round(r)},${lat.toFixed(6)},${lng.toFixed(6)})`;
  return `[out:json][timeout:45];(
way["building"]${a};way["building:part"]${a};relation["building"]${a};
way["highway"]${a};way["railway"~"^(rail|light_rail|subway|tram|narrow_gauge|platform)$"]${a};
way["waterway"]${a};way["natural"~"^(water|wood|scrub|grassland|tree_row|beach)$"]${a};relation["natural"="water"]${a};
way["leisure"~"^(park|garden|pitch|playground|stadium)$"]${a};way["landuse"~"^(grass|forest|recreation_ground|cemetery|meadow)$"]${a};
way["amenity"~"^(parking|school)$"]${a};node["natural"="tree"]${a};
);(._;>;);out body qt;`;
}

// 經緯度 → 本地公尺
export function projector(lat0, lng0) {
  const kx = 111320 * Math.cos(lat0 * Math.PI / 180), kz = 110540;
  return (lat, lng) => [(lng - lng0) * kx, -(lat - lat0) * kz];
}

// Overpass JSON → { ways:[{id,tags,pts}], nodes:[{tags,p}] }
export function fromOverpass(json, lat0, lng0) {
  const P = projector(lat0, lng0), nodes = new Map(), ways = new Map(), out = [], pts = [];
  for (const e of json.elements || []) { if (e.type === 'node') nodes.set(e.id, e); else if (e.type === 'way') ways.set(e.id, e); }
  const geom = w => w.nodes.map(id => nodes.get(id)).filter(Boolean).map(n => P(n.lat, n.lon));
  const used = new Set();
  for (const r of json.elements || []) {
    if (r.type !== 'relation' || !r.tags) continue;
    for (const m of r.members || []) if (m.type === 'way' && m.role !== 'inner' && ways.has(m.ref)) { out.push({ id: m.ref, tags: { ...ways.get(m.ref).tags, ...r.tags }, pts: geom(ways.get(m.ref)) }); used.add(m.ref); }
  }
  for (const w of ways.values()) if (w.tags && !used.has(w.id)) out.push({ id: w.id, tags: w.tags, pts: geom(w) });
  for (const n of nodes.values()) if (n.tags?.natural === 'tree') pts.push({ tags: n.tags, p: P(n.lat, n.lon) });
  return { ways: out.filter(w => w.pts.length > 1), nodes: pts };
}

// scripts/fetch-osm.mjs 的精簡格式（origin + 1e-6 度整數座標）→ 同上
export function fromCompact(data, lat0, lng0) {
  const P = projector(lat0, lng0), [ox, oy] = data.origin, k = data.scale || 1e-6;
  const ways = data.ways.map(([id, tags, pts]) => ({ id, tags, pts: pts.map(([x, y]) => P(oy + y * k, ox + x * k)) })).filter(w => w.pts.length > 1);
  const nodes = (data.nodes || []).map(([, tags, [x, y]]) => ({ tags, p: P(oy + y * k, ox + x * k) }));
  return { ways, nodes };
}

async function cached(key) {
  try { const c = await caches.open(CACHE), r = await c.match(key); if (!r) return null; const j = await r.json(); return Date.now() - j.t < TTL ? j.data : null; } catch { return null; }
}
async function store(key, data) {
  try { const c = await caches.open(CACHE); await c.put(key, new Response(JSON.stringify({ t: Date.now(), data }), { headers: { 'content-type': 'application/json' } })); } catch { }
}

export async function loadStreet({ id, lat, lng, radius = 380, status = () => { } }) {
  // 1. 預先下載的街區檔
  if (id) {
    try {
      const r = await fetch(new URL(`data/osm/${id}.json`, document.baseURI));
      if (r.ok && /json/.test(r.headers.get('content-type') || '')) { const d = await r.json(); return { ...fromCompact(d, lat, lng), source: '© OpenStreetMap contributors（ODbL）', fetched: d.fetched, how: '預先下載' }; }
    } catch { }
  }
  // 2. Overpass（含快取）
  const key = `https://twtimes.local/osm/${lat.toFixed(5)},${lng.toFixed(5)},${Math.round(radius)}`;
  let json = await cached(key), how = '本機快取';
  if (!json) {
    const body = 'data=' + encodeURIComponent(overpassQuery(lat, lng, radius));
    let lastErr;
    for (const url of OVERPASS) {
      status(`向 OpenStreetMap 下載街廓（${new URL(url).host}）…`);
      try {
        const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 75000);
        const r = await fetch(url, { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal: ctl.signal });
        clearTimeout(timer);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        json = await r.json(); how = 'Overpass 即時查詢'; await store(key, json); break;
      } catch (e) { lastErr = e; }
    }
    if (!json) throw new Error('無法連線 OpenStreetMap（' + (lastErr?.message || '逾時') + '）');
  }
  return { ...fromOverpass(json, lat, lng), source: '© OpenStreetMap contributors（ODbL）', fetched: (json.osm3s?.timestamp_osm_base || '').slice(0, 10), how };
}

// Overpass JSON → 精簡格式（scripts/bake-osm.mjs 烘焙用；與 scripts/fetch-osm.mjs 相同，另加單株樹 nodes）
const KEEP = ['building', 'building:levels', 'height', 'highway', 'name', 'name:en', 'waterway', 'railway', 'natural', 'leisure', 'amenity', 'lanes', 'width', 'layer', 'bridge', 'tunnel', 'min_height', 'building:min_level', 'building:part', 'building:colour', 'landuse', 'area', 'oneway', 'public_transport', 'water', 'location'];
export function toCompact(json, lat, lng, radius) {
  const pick = t => { const o = {}; for (const k of KEEP) if (t?.[k] != null) o[k] = t[k]; return o; };
  const OX = Math.floor(lng * 100) / 100, OY = Math.floor(lat * 100) / 100, xy = n => [Math.round((n.lon - OX) * 1e6), Math.round((n.lat - OY) * 1e6)];
  const nodes = new Map(), ways = new Map(), out = [], used = new Set(), trees = [];
  for (const e of json.elements || []) { if (e.type === 'node') nodes.set(e.id, e); else if (e.type === 'way') ways.set(e.id, e); }
  const g = w => w.nodes.map(id => nodes.get(id)).filter(Boolean).map(xy);
  for (const r of json.elements || []) {
    if (r.type !== 'relation' || !r.tags) continue;
    for (const m of r.members || []) if (m.type === 'way' && m.role !== 'inner' && ways.has(m.ref)) { out.push([m.ref, { ...pick(ways.get(m.ref).tags), ...pick(r.tags), _rel: r.id }, g(ways.get(m.ref))]); used.add(m.ref); }
  }
  for (const w of ways.values()) if (w.tags && !used.has(w.id)) out.push([w.id, pick(w.tags), g(w)]);
  for (const n of nodes.values()) if (n.tags?.natural === 'tree') trees.push([n.id, { natural: 'tree' }, xy(n)]);
  return { origin: [OX, OY], scale: 1e-6, source: '© OpenStreetMap contributors (ODbL)', fetched: (json.osm3s?.timestamp_osm_base || '').slice(0, 10), center: [lat, lng], radius, ways: out, nodes: trees };
}
