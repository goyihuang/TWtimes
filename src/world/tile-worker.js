// 全臺立體地景：背景執行緒。下載一張圖磚的向量資料（OpenMapTiles）與地形（Terrarium PNG），
// 產生地形網格、地表貼圖（高程色＋陰影＋土地覆蓋＋道路）、建物量體、立體道路、樹木與地名，
// 以可轉移的 TypedArray 交回主執行緒，主執行緒只負責組 three.js 物件。
import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import earcut from 'earcut';
import { terrarium } from './tiles.js';
import { buildingHeight, hash01, FLOOR } from './heights.js';
import { TILE_CACHE, TILE_TTL } from './sources.js';

const BAY = 3.4;
const ROAD_W = { motorway: 24, trunk: 20, primary: 16, secondary: 13, tertiary: 10, minor: 7, service: 4.5, track: 3, path: 2, busway: 7, raceway: 8, pier: 4 };
const PATH_W = { pedestrian: 6, footway: 2.2, cycleway: 2.4, steps: 2.4, path: 1.6, bridleway: 2 };
const MAJOR = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary']);
const WALLS = ['#d9d2c3', '#e7e2d6', '#c9c3b5', '#dacbb3', '#c0c5bf', '#e4d8c9', '#cdd5d1', '#d7c1b0', '#b8bab3', '#ece8de', '#d9b8a6', '#a9bead', '#c7b49b'];
const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const WALL_RGB = WALLS.map(hex);

// ── 地表配色 ──
const LANDCOVER = { wood: '#56714a', forest: '#56714a', grass: '#8ea468', farmland: '#b4b98b', wetland: '#7f9c8a', sand: '#d9cfab', rock: '#9e978a', ice: '#eef1f2', scrub: '#7c9160' };
const LANDUSE = { residential: '#a8a294', suburb: '#a8a294', neighbourhood: '#a8a294', commercial: '#ad9f94', retail: '#af9e92', industrial: '#a09b92', railway: '#b3aca2', cemetery: '#a3ae8d', school: '#d0c4aa', university: '#d0c4aa', college: '#d0c4aa', kindergarten: '#d0c4aa', hospital: '#d3c2b5', stadium: '#9fb67b', pitch: '#9fb67b', playground: '#a9bb83', military: '#b4ad95', quarry: '#b2a898', garages: '#b9b4ab', dam: '#a8a59c', track: '#b5805c', zoo: '#93aa72', theme_park: '#a8b583', bus_station: '#b3aca2' };
const PARK = '#86a266', WATER = '#4d7380', ROAD_MAJOR = '#5a5c59', ROAD_MINOR = '#6c6d69', PATH = '#b6a88f', RAIL = '#5b5550', RUNWAY = '#8f908c', BLD = '#a39c92';

function hypso(h, slope) {
  // 平原農地 → 丘陵林地 → 高山林 → 高山岩屑
  const stops = [[-50, [0.25, 0.39, 0.44]], [2, [0.56, 0.58, 0.42]], [60, [0.52, 0.57, 0.39]], [400, [0.45, 0.55, 0.36]], [1500, [0.34, 0.45, 0.29]], [2600, [0.40, 0.44, 0.33]], [3300, [0.55, 0.53, 0.47]], [4000, [0.62, 0.60, 0.56]]];
  let c = stops[stops.length - 1][1];
  for (let i = 1; i < stops.length; i++) if (h < stops[i][0]) { const [h0, a] = stops[i - 1], [h1, b] = stops[i], t = Math.max(0, (h - h0) / (h1 - h0)); c = a.map((v, k) => v + (b[k] - v) * t); break; }
  const s = Math.min(1, Math.max(0, (slope - 0.7) / 0.8)); // 陡坡露岩
  return c.map((v, k) => v + ([0.52, 0.49, 0.43][k] - v) * s * 0.55);
}

// ── 下載 ──
// 圖磚在瀏覽器 Cache Storage 保存 7 天（與現代街景的 Overpass 快取相同），再看同一處不必重新下載。
// 上限由主執行緒 pruneTileCache() 控制（sources.js）。
let cacheP = null;
const tileCache = () => cacheP ??= (self.caches ? caches.open(TILE_CACHE).catch(() => null) : Promise.resolve(null));
async function cachedFetch(url, signal) {
  const c = await tileCache();
  if (c) try { const hit = await c.match(url); if (hit && Date.now() - +(hit.headers.get('x-tw-t') || 0) < TILE_TTL) return hit; } catch { }
  const r = await fetch(url, { signal }); if (!r.ok) return r;
  if (c) try { const b = await r.clone().blob(); await c.put(url, new Response(b, { headers: { 'content-type': r.headers.get('content-type') || 'application/octet-stream', 'x-tw-t': String(Date.now()) } })); } catch { }
  return r;
}
async function getBuf(url, signal) { const r = await cachedFetch(url, signal); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); }
async function getDem(url, signal) {
  const r = await cachedFetch(url, signal); if (!r.ok) throw new Error(`地形 HTTP ${r.status}`);
  const bmp = await createImageBitmap(await r.blob());
  const c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0);
  const px = g.getImageData(0, 0, bmp.width, bmp.height).data, n = bmp.width, out = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) out[i] = terrarium(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
  return { n, h: out };
}

// ── 幾何工具 ──
const ringArea = r => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return s / 2; };
function polygons(geom) {
  // MVT 外環與內環繞向相反；依第一個環的方向分組
  const out = []; let sign = 0;
  for (const ring of geom) {
    const pts = ring.map(p => [p.x, p.y]); if (pts.length > 1 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1]) pts.pop();
    if (pts.length < 3) continue;
    const a = ringArea(pts); if (!a) continue;
    if (!sign) sign = Math.sign(a);
    if (Math.sign(a) === sign || !out.length) out.push([pts]); else out.at(-1).push(pts);
  }
  return out;
}
// Sutherland–Hodgman：把環裁到 [0,E]² （圖磚邊界），跨圖磚的建物各畫一半，不重疊
function clipRing(ring, E) {
  let pts = ring;
  for (const [axis, keepMax, v] of [[0, false, 0], [0, true, E], [1, false, 0], [1, true, E]]) {
    const inside = p => keepMax ? p[axis] <= v : p[axis] >= v, out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], ia = inside(a), ib = inside(b);
      if (ia) out.push(a);
      if (ia !== ib) { const t = (v - a[axis]) / (b[axis] - a[axis]); out.push(axis === 0 ? [v, a[1] + (b[1] - a[1]) * t] : [a[0] + (b[0] - a[0]) * t, v]); }
    }
    pts = out; if (pts.length < 3) return [];
  }
  return pts;
}
function inRing([x, z], pts) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }
function clipLine(pts, lo, hi) {
  const runs = []; let cur = [];
  const ins = p => p[0] >= lo && p[0] <= hi && p[1] >= lo && p[1] <= hi;
  for (const p of pts) { if (ins(p)) cur.push(p); else { if (cur.length > 1) runs.push(cur); cur = []; } }
  if (cur.length > 1) runs.push(cur); return runs;
}
function densify(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / step); for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]); }
  return out;
}

// ── 主流程 ──
async function buildTile(job, signal) {
  const { z, x, y, S, vecURL, demURL, opts } = job;
  const demZ = Math.min(z, 13), sub = 2 ** (z - demZ), qx = x % sub, qy = y % sub;
  const [dem, vbuf] = await Promise.all([
    getDem(demURL.replace('{z}', demZ).replace('{x}', x >> (z - demZ)).replace('{y}', y >> (z - demZ)), signal),
    opts.vector ? getBuf(vecURL.replace('{z}', z).replace('{x}', x).replace('{y}', y), signal).catch(e => ({ error: e.message })) : Promise.resolve(null),
  ]);
  const ex = opts.exaggeration;
  // DEM 取樣（u, v ∈ [0,1] 為本圖磚內位置）
  const demAt = (u, v) => {
    const n = dem.n, fx = Math.min(n - 1, Math.max(0, ((qx + u) / sub) * n - 0.5)), fy = Math.min(n - 1, Math.max(0, ((qy + v) / sub) * n - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(n - 1, x0 + 1), y1 = Math.min(n - 1, y0 + 1), tx = fx - x0, ty = fy - y0, H = dem.h;
    const a = H[y0 * n + x0], b = H[y0 * n + x1], c = H[y1 * n + x0], d = H[y1 * n + x1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };
  // 地形網格
  const N = z >= 14 ? 128 : z >= 12 ? 64 : 48, cell = S / N, grid = new Float32Array((N + 1) * (N + 1));
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const h = demAt(i / N, j / N); grid[j * (N + 1) + i] = (h < -2 ? Math.max(-40 + h * 0.3, -160) : h) * ex; /* 海床壓深，避免與海面互相穿插 */ }
  // 與網格三角形一致的高度（道路、建物、樹貼地用）
  const H = (lx, lz) => {
    const fx = Math.min(N - 1e-6, Math.max(0, lx / cell)), fz = Math.min(N - 1e-6, Math.max(0, lz / cell)), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, W = N + 1;
    const a = grid[j * W + i], b = grid[j * W + i + 1], c = grid[(j + 1) * W + i], d = grid[(j + 1) * W + i + 1];
    return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
  };
  const terrain = terrainMesh(grid, N, S);

  // 向量資料
  let vt = null, vecError = vbuf?.error || null;
  if (vbuf && !vbuf.error) { try { vt = new VectorTile(new Pbf(vbuf)); } catch (e) { vecError = e.message; } }
  const layer = n => vt?.layers[n] || null;
  const each = (n, fn) => { const L = layer(n); if (!L) return; for (let i = 0; i < L.length; i++) { const f = L.feature(i); fn(f, f.properties, L.extent); } };

  // 地表貼圖
  const T = opts.texSize, tex = new OffscreenCanvas(T, T), g = tex.getContext('2d');
  // 高程色與地形陰影先畫在 256² 底圖（DEM 本身約 30 m，夠用），再放大鋪滿；向量圖層用全解析度畫在上面
  const B = Math.min(T, 256), base = new OffscreenCanvas(B, B), bg = base.getContext('2d'), img = bg.createImageData(B, B), d = img.data, mpp = S / B;
  for (let j = 0; j < B; j++) for (let i = 0; i < B; i++) {
    const u = (i + 0.5) / B, v = (j + 0.5) / B, h = demAt(u, v);
    const dx = (demAt(u + 1 / B, v) - demAt(u - 1 / B, v)) / (2 * mpp), dz = (demAt(u, v + 1 / B) - demAt(u, v - 1 / B)) / (2 * mpp);
    const slope = Math.hypot(dx, dz), c = hypso(h, slope);
    // 西北光的地形陰影，補足網格解析度以下的稜線細節
    const shade = Math.max(0.55, Math.min(1.25, 1 + (-dx * 0.7 - dz * 0.7) * 0.45 / (1 + slope * 0.3)));
    const k = (j * B + i) * 4; d[k] = c[0] * shade * 255; d[k + 1] = c[1] * shade * 255; d[k + 2] = c[2] * shade * 255; d[k + 3] = 255;
  }
  bg.putImageData(img, 0, 0); g.imageSmoothingQuality = 'high'; g.drawImage(base, 0, 0, T, T);
  const pxPerM = T / S;
  if (vt) {
    const drawPoly = (f, E, fill, alpha = 1) => { const sc = T / E; g.globalAlpha = alpha; g.fillStyle = fill; g.beginPath(); for (const ring of f.loadGeometry()) { ring.forEach((p, i) => i ? g.lineTo(p.x * sc, p.y * sc) : g.moveTo(p.x * sc, p.y * sc)); g.closePath(); } g.fill('evenodd'); g.globalAlpha = 1; };
    const drawLine = (f, E, stroke, wM, minPx = 0, alpha = 1) => { const sc = T / E; g.globalAlpha = alpha; g.strokeStyle = stroke; g.lineWidth = Math.max(minPx, wM * pxPerM); g.lineCap = g.lineJoin = 'round'; g.beginPath(); for (const line of f.loadGeometry()) line.forEach((p, i) => i ? g.lineTo(p.x * sc, p.y * sc) : g.moveTo(p.x * sc, p.y * sc)); g.stroke(); g.globalAlpha = 1; };
    each('landcover', (f, p, E) => { const c = LANDCOVER[p.subclass] || LANDCOVER[p.class]; if (c && f.type === 3) drawPoly(f, E, c, 0.8); });
    each('landuse', (f, p, E) => { const c = LANDUSE[p.class]; if (c && f.type === 3) drawPoly(f, E, c, 0.75); });
    each('park', (f, p, E) => { if (f.type === 3) drawPoly(f, E, PARK, 0.6); });
    each('water', (f, p, E) => { if (f.type === 3 && p.brunnel !== 'tunnel') drawPoly(f, E, WATER, 1); });
    each('waterway', (f, p, E) => { if (p.brunnel !== 'tunnel') drawLine(f, E, WATER, { river: 22, canal: 12, stream: 4, drain: 3, ditch: 2 }[p.class] || 3, p.class === 'river' ? 1 : 0); });
    each('aeroway', (f, p, E) => { if (f.type === 3) drawPoly(f, E, p.class === 'runway' ? RUNWAY : '#a9a79e', 0.9); else drawLine(f, E, RUNWAY, p.class === 'runway' ? 45 : 18, 1); });
    if (z >= 13) each('building', (f, p, E) => { if (f.type === 3) drawPoly(f, E, BLD, 0.9); });
    each('transportation', (f, p, E) => {
      if (p.brunnel === 'tunnel' || f.type !== 2) return;
      if (p.class === 'rail' || p.class === 'transit') return drawLine(f, E, RAIL, 3.4, z >= 10 ? 0.8 : 0);
      if (p.class === 'path') return drawLine(f, E, PATH, PATH_W[p.subclass] || 2, 0, 0.9);
      const w = (p.ramp ? 7 : ROAD_W[p.class] || 5) * (opts.roadScale || 1);
      drawLine(f, E, MAJOR.has(p.class) ? ROAD_MAJOR : ROAD_MINOR, w, MAJOR.has(p.class) && z >= 9 ? 1 : 0, 0.95);
    });
  }
  const bitmap = tex.transferToImageBitmap();

  const res = { key: job.key, terrain, grid, N, bitmap, vecError, stats: { buildings: 0, guessed: 0, tallest: 0 }, labels: [] };
  const transfer = [terrain.position.buffer, terrain.normal.buffer, terrain.uv.buffer, terrain.index.buffer, grid.buffer, bitmap];

  // 地名、山峰、車站
  if (vt) {
    const zh = p => p['name:zh-Hant'] || p['name:zh'] || p.name || p['name:latin'];
    const want = z <= 10 ? ['city', 'town'] : z <= 12 ? ['city', 'town', 'village', 'suburb'] : ['city', 'town', 'village', 'suburb', 'quarter', 'neighbourhood', 'hamlet'];
    const pt = (f, E) => { const q = f.loadGeometry()[0]?.[0]; return q && q.x >= 0 && q.x <= E && q.y >= 0 && q.y <= E ? [q.x / E * S, q.y / E * S] : null; };
    each('place', (f, p, E) => { if (!want.includes(p.class)) return; const q = pt(f, E), n = zh(p); if (q && n) res.labels.push({ n, x: q[0], z: q[1], y: H(q[0], q[1]), kind: p.class, rank: p.rank ?? 10 }); });
    each('mountain_peak', (f, p, E) => { const q = pt(f, E), n = zh(p); if (q && n && (z >= 12 || (p.rank ?? 9) <= 2 || p.ele > 3000)) res.labels.push({ n: p.ele ? `${n} ${Math.round(p.ele)}m` : n, x: q[0], z: q[1], y: H(q[0], q[1]), kind: 'peak', rank: p.rank ?? 5 }); });
    if (z >= 13) each('poi', (f, p, E) => { if (p.class !== 'railway' || !(p.subclass === 'station' || p.subclass === 'halt')) return; const q = pt(f, E), n = zh(p); if (q && n) res.labels.push({ n, x: q[0], z: q[1], y: H(q[0], q[1]), kind: 'station', rank: 1 }); });
  }

  // z14：立體建物、道路、樹
  if (vt && z >= 14) {
    const B = buildings(layer('building'), S, H, opts);
    const R = roads(layer('transportation'), S, H, opts);
    const TR = opts.trees ? trees(vt, S, H, opts, x, y) : new Float32Array(0);
    Object.assign(res, { buildings: B.arrays, roads: R, trees: TR }); res.stats = B.stats;
    transfer.push(...Object.values(B.arrays).map(a => a.buffer), TR.buffer);
    for (const k of Object.keys(R)) transfer.push(...Object.values(R[k]).map(a => a.buffer));
  }
  return { res, transfer };
}

function terrainMesh(grid, N, S) {
  // 網格＋四邊裙邊（往下垂 60 m，遮住相鄰不同 LOD 圖磚之間的縫）
  const W = N + 1, nv = W * W + 4 * W, pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), cell = S / N;
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const k = j * W + i, h = grid[k];
    pos.set([i * cell, h, j * cell], k * 3); uv.set([i / N, j / N], k * 2);
    const hl = grid[j * W + Math.max(0, i - 1)], hr = grid[j * W + Math.min(N, i + 1)], hu = grid[Math.max(0, j - 1) * W + i], hd = grid[Math.min(N, j + 1) * W + i];
    const nx = (hl - hr) / (cell * ((i > 0) + (i < N))), nz = (hu - hd) / (cell * ((j > 0) + (j < N))), L = Math.hypot(nx, 1, nz);
    nor.set([nx / L, 1 / L, nz / L], k * 3);
  }
  const idx = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * W + i, b = a + 1, c = a + W, d = c + 1; idx.push(a, c, b, b, c, d); }
  // 裙邊：沿四邊的頂點往下複製
  const edges = [[...Array(W).keys()].map(i => i), [...Array(W).keys()].map(i => N * W + i), [...Array(W).keys()].map(j => j * W), [...Array(W).keys()].map(j => j * W + N)];
  let base = W * W;
  edges.forEach((e, ei) => {
    e.forEach((k, t) => { const s = base + t; pos.set([pos[k * 3], pos[k * 3 + 1] - 60, pos[k * 3 + 2]], s * 3); nor.set([nor[k * 3], nor[k * 3 + 1], nor[k * 3 + 2]], s * 3); uv.set([uv[k * 2], uv[k * 2 + 1]], s * 2); });
    for (let t = 0; t < N; t++) { const a = e[t], b = e[t + 1], c = base + t, d = base + t + 1; if (ei === 0 || ei === 3) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); }
    base += W;
  });
  return { position: pos, normal: nor, uv, index: new Uint32Array(idx) };
}

function buildings(L, S, H, opts) {
  const pos = [], nor = [], fuv = [], col = [], pop = [], stats = { buildings: 0, guessed: 0, tallest: 0 };
  if (L) {
    const E = L.extent, sc = S / E, feats = [];
    let cover = 0;
    for (let i = 0; i < L.length; i++) {
      const f = L.feature(i), p = f.properties; if (f.type !== 3 || p.hide_3d) continue;
      for (const poly of polygons(f.loadGeometry())) {
        const rings = poly.map(r => clipRing(r, E).map(([a, b]) => [a * sc, b * sc])).filter(r => r.length >= 3);
        if (!rings.length || rings[0].length < 3) continue;
        const A = Math.abs(ringArea(rings[0])); if (A < 8) continue;
        cover += A; feats.push({ p, rings, A, id: f.id });
      }
    }
    const density = cover / (S * S);
    for (const { p, rings, A, id } of feats) {
      let cx = 0, cz = 0; for (const [a, b] of rings[0]) { cx += a; cz += b; } cx /= rings[0].length; cz /= rings[0].length;
      const r = id != null ? hash01(id % 1e7, Math.floor(id / 1e7), opts.seed) : hash01(cx + opts.ox, cz + opts.oz, opts.seed);
      const { h, y0, guessed } = buildingHeight(p, A, density, r, opts.heightScale);
      let gmin = Infinity; for (const ring of rings) for (const [a, b] of ring) gmin = Math.min(gmin, H(a, b));
      const gc = H(cx, cz), base = y0 > 0 ? gc + y0 : gmin - 0.4, top = gc + y0 + h;
      const rgb = opts.clay ? [0.73, 0.71, 0.68] : (/^#[0-9a-f]{6}$/i.test(p.colour || '') && !guessed ? hex(p.colour) : WALL_RGB[Math.floor(hash01(cx, cz, 3) * WALL_RGB.length)]);
      const uOff = Math.floor(r * 400) * 997;
      const push = (X, Y, Z, nx, ny, nz, u, v) => { pos.push(X, Y, Z); nor.push(nx, ny, nz); fuv.push(u, v); col.push(rgb[0], rgb[1], rgb[2]); pop.push(base, cx, cz, 0); }; // pop：紙雕彈起（底部高度、中心、開始時間由主執行緒填）
      for (const ring of rings) {
        // MVT 外環在 y 向下座標中為順時針；牆的外法線依環面積正負決定
        const hole = ring !== rings[0]; let run = 0;
        for (let i = 0; i < ring.length; i++) {
          const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length], Lw = Math.hypot(bx - ax, bz - az); if (Lw < 0.05) continue;
          // 圖磚邊界上的切線不畫牆（建物在隔壁圖磚延續）
          if ((ax <= 1e-3 && bx <= 1e-3) || (az <= 1e-3 && bz <= 1e-3) || (ax >= S - 1e-3 && bx >= S - 1e-3) || (az >= S - 1e-3 && bz >= S - 1e-3)) { run += Lw; continue; }
          // 外法線：往外推一點不應落在建物內（外環）／應落在中庭內（內環）
          let nx = -(bz - az) / Lw, nz = (bx - ax) / Lw;
          if (inRing([(ax + bx) / 2 + nx * 0.05, (az + bz) / 2 + nz * 0.05], ring) !== hole) { nx = -nx; nz = -nz; }
          const u0 = uOff + Math.round(run / BAY), u1 = u0 + Math.max(1, Math.round(Lw / BAY)); run += Lw;
          const v0 = (base - gc) / FLOOR, v1 = (top - gc) / FLOOR;
          // 讓三角形正面朝外
          const A1 = [ax, base, az], B1 = [bx, top, bz], C1 = [bx, base, bz], D1 = [ax, top, az];
          const tri = (P, Q, R, uvs) => { const ux = Q[0] - P[0], uz = Q[2] - P[2], uy = Q[1] - P[1], wx = R[0] - P[0], wy = R[1] - P[1], wz = R[2] - P[2]; const cnx = uy * wz - uz * wy, cnz = ux * wy - uy * wx; const flip = cnx * nx + cnz * nz < 0; const L3 = flip ? [P, R, Q] : [P, Q, R], U3 = flip ? [uvs[0], uvs[2], uvs[1]] : uvs; L3.forEach((V, k) => push(V[0], V[1], V[2], nx, 0, nz, U3[k][0], U3[k][1])); };
          tri(A1, B1, C1, [[u0, v0], [u1, v1], [u1, v0]]); tri(A1, D1, B1, [[u0, v0], [u0, v1], [u1, v1]]);
        }
      }
      // 屋頂
      const flat = [], holes = []; for (const ring of rings) { if (flat.length) holes.push(flat.length / 2); for (const [a, b] of ring) flat.push(a, b); }
      const tris = earcut(flat, holes);
      for (let t = 0; t < tris.length; t += 3) {
        let ia = tris[t], ib = tris[t + 1], ic = tris[t + 2];
        const ny = (flat[ib * 2 + 1] - flat[ia * 2 + 1]) * (flat[ic * 2] - flat[ia * 2]) - (flat[ib * 2] - flat[ia * 2]) * (flat[ic * 2 + 1] - flat[ia * 2 + 1]);
        if (ny < 0) [ib, ic] = [ic, ib];
        for (const k of [ia, ib, ic]) push(flat[k * 2], top, flat[k * 2 + 1], 0, 1, 0, flat[k * 2] / 3 + uOff, flat[k * 2 + 1] / 3);
      }
      stats.buildings++; if (guessed) stats.guessed++; stats.tallest = Math.max(stats.tallest, top - gc);
    }
  }
  return { arrays: { position: new Float32Array(pos), normal: new Float32Array(nor), fuv: new Float32Array(fuv), color: new Float32Array(col), pop: new Float32Array(pop) }, stats };
}

function ribbonInto(out, pts, w, yAt) {
  if (pts.length < 2) return;
  const P = out.position, Nn = out.normal, side = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const l = [pts[i][0] - dz * w / 2, pts[i][1] + dx * w / 2], r = [pts[i][0] + dz * w / 2, pts[i][1] - dx * w / 2];
    side.push([l, yAt(l, i), r, yAt(r, i)]);
  }
  for (let i = 1; i < side.length; i++) {
    const [l0, yl0, r0, yr0] = side[i - 1], [l1, yl1, r1, yr1] = side[i];
    const v = [[l0[0], yl0, l0[1]], [r0[0], yr0, r0[1]], [l1[0], yl1, l1[1]], [r1[0], yr1, r1[1]]];
    for (const k of [0, 2, 1, 1, 2, 3]) { P.push(...v[k]); Nn.push(0, 1, 0); }
  }
}

function roads(L, S, H, opts) {
  const sets = { asphalt: { position: [], normal: [] }, minor: { position: [], normal: [] }, path: { position: [], normal: [] }, rail: { position: [], normal: [] }, piers: { data: [] } };
  if (L) {
    const E = L.extent, sc = S / E, lift = 0.18;
    for (let i = 0; i < L.length; i++) {
      const f = L.feature(i), p = f.properties; if (f.type !== 2 || p.brunnel === 'tunnel' || (p.layer ?? 0) < 0) continue;
      const isRail = p.class === 'rail' || p.class === 'transit', isPath = p.class === 'path';
      const w = isRail ? 3.4 : isPath ? (PATH_W[p.subclass] || 2) : (p.ramp ? 7 : ROAD_W[p.class] || 5) * (opts.roadScale || 1);
      const set = isRail ? sets.rail : isPath ? sets.path : MAJOR.has(p.class) ? sets.asphalt : sets.minor;
      const bridge = p.brunnel === 'bridge', L0 = bridge ? Math.max(1, p.layer || 1) * 5.5 : 0;
      for (const line of f.loadGeometry()) {
        for (const run of clipLine(line.map(q => [q.x, q.y]), -8, E + 8)) {
          const pts = densify(run.map(([a, b]) => [a * sc, b * sc]), 6);
          if (!bridge) { ribbonInto(set, pts, w, (q) => H(q[0], q[1]) + lift + (isPath ? 0.02 : 0)); continue; }
          // 橋：兩端接地，中段離地 L0（依 layer），且不低於兩端連線
          const cum = [0]; for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
          const tot = cum.at(-1) || 1, hs = H(...pts[0]), he = H(...pts.at(-1));
          const yAt = (q, k) => { const t = cum[k] / tot, taper = Math.min(1, cum[k] / 50, (tot - cum[k]) / 50); return Math.max(hs + (he - hs) * t, H(q[0], q[1]) + L0 * taper) + lift + 0.05; };
          ribbonInto(set, pts, w, yAt);
          if (L0 > 3) for (let k = 0, next = 25; k < pts.length; k++) if (cum[k] >= next) { next += 32; const g = H(...pts[k]), top = yAt(pts[k], k); if (top - g > 3) sets.piers.data.push(pts[k][0], g, pts[k][1], top - g - 0.8); }
        }
      }
    }
  }
  const out = {};
  for (const [k, v] of Object.entries(sets)) out[k] = k === 'piers' ? { data: new Float32Array(v.data) } : { position: new Float32Array(v.position), normal: new Float32Array(v.normal) };
  return out;
}

function trees(vt, S, H, opts, tx, ty) {
  // 林地、公園遮罩（256²），扣掉建物、道路與水域，再撒點
  const M = 256, c = new OffscreenCanvas(M, M), g = c.getContext('2d', { willReadFrequently: true });
  const poly = (L, test, fill) => { if (!L) return; const sc = M / L.extent; for (let i = 0; i < L.length; i++) { const f = L.feature(i); if (f.type !== 3 || !test(f.properties)) continue; g.fillStyle = fill; g.beginPath(); for (const r of f.loadGeometry()) { r.forEach((p, k) => k ? g.lineTo(p.x * sc, p.y * sc) : g.moveTo(p.x * sc, p.y * sc)); g.closePath(); } g.fill('evenodd'); } };
  poly(vt.layers.landcover, p => ['wood', 'forest'].includes(p.class) || p.subclass === 'scrub', '#f00');
  poly(vt.layers.park, () => true, '#800'); poly(vt.layers.landuse, p => ['cemetery', 'school', 'university'].includes(p.class), '#400');
  poly(vt.layers.water, () => true, '#000'); poly(vt.layers.building, () => true, '#000');
  const T = vt.layers.transportation; if (T) { const sc = M / T.extent; g.strokeStyle = '#000'; g.lineWidth = 1.5; for (let i = 0; i < T.length; i++) { const f = T.feature(i); if (f.type !== 2) continue; g.beginPath(); for (const l of f.loadGeometry()) l.forEach((p, k) => k ? g.lineTo(p.x * sc, p.y * sc) : g.moveTo(p.x * sc, p.y * sc)); g.stroke(); } }
  const px = g.getImageData(0, 0, M, M).data, out = [], max = opts.treeMax || 3500;
  let s = (tx * 73856093 ^ ty * 19349663) >>> 0; const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let t = 0; t < max * 6 && out.length < max * 4; t++) {
    const u = rnd(), v = rnd(), m = px[(Math.floor(v * M) * M + Math.floor(u * M)) * 4];
    if (m < 40 || rnd() > m / 255) continue;
    const lx = u * S, lz = v * S; out.push(lx, H(lx, lz), lz, 0.8 + rnd() * 0.7);
  }
  return new Float32Array(out);
}

const live = new Map();
self.onmessage = async e => {
  const m = e.data;
  if (m.cancel) { live.get(m.cancel)?.abort(); live.delete(m.cancel); return; }
  const ctl = new AbortController(); live.set(m.key, ctl);
  try { const { res, transfer } = await buildTile(m, ctl.signal); self.postMessage(res, transfer); }
  catch (err) { self.postMessage({ key: m.key, error: err.name === 'AbortError' ? 'abort' : String(err.message || err) }); }
  finally { live.delete(m.key); }
};
