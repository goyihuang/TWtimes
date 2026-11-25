// 圓山・劍潭 場景的地理骨架：基隆河河道、劍潭山稜線、圓山、神社台地與參道。
// 單位公尺，+x 東、-z 北、y 高。原點＝明治橋（中山橋）橋心，水面 y = 0。

export const CORE = 2000;          // 精細地形半邊長
export const WATER_Y = 0.0;

// ---------- 小工具 ----------
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export function mulberry(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// value noise
const PERM = new Uint8Array(512);
{ const r = mulberry(1901); const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]; }
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
function grad(h, x, y) { const g = h & 7; const u = g < 4 ? x : y, v = g < 4 ? y : x; return ((g & 1) ? -u : u) + ((g & 2) ? -2 * v : 2 * v); }
export function noise2(x, y) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y);
  const u = fade(x), v = fade(y), a = PERM[X] + Y, b = PERM[X + 1] + Y;
  return lerp(lerp(grad(PERM[a], x, y), grad(PERM[b], x - 1, y), u), lerp(grad(PERM[a + 1], x, y - 1), grad(PERM[b + 1], x - 1, y - 1), u), v) * 0.25;
}
export function fbm(x, y, oct = 5) { let s = 0, a = 1, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); n += a; a *= 0.5; f *= 2.03; } return s / n; }
export function ridged(x, y, oct = 5) { let s = 0, a = 1, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * (1 - Math.abs(noise2(x * f + 31.7, y * f - 12.3) * 2)); n += a; a *= 0.5; f *= 2.1; } return s / n; }

// ---------- 折線 ----------
function catmull(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]); const n = Math.max(2, Math.ceil(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), ...(p1.length > 2 ? p1.slice(2).map((v, j) => lerp(v, p2[j + 2], t)) : [])]);
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}
export const spline = catmull;

function distToPolyline(pl, x, z) {
  let best = 1e9, bi = 0, bt = 0;
  for (let i = 0; i < pl.length - 1; i++) {
    const ax = pl[i][0], az = pl[i][1], bx = pl[i + 1][0], bz = pl[i + 1][1];
    const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / L, 0, 1);
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best) { best = d; bi = i; bt = t; }
  }
  return { d: best, i: bi, t: bt };
}
export function polylineDist(pl, x, z) { return distToPolyline(pl, x, z); }

// ---------- 基隆河 ----------
// [x, z, 寬度]：自東而來，沿劍潭山南麓，於明治橋下轉向西北，繞過劍潭往大龍峒
export const RIVER = catmull([
  [2600, 230, 190], [1900, 180, 175], [1350, 120, 165], [900, 70, 150], [520, 40, 140], [250, 15, 132],
  [0, 0, 128], [-200, -35, 140], [-380, -150, 155], [-500, -330, 165], [-640, -520, 175],
  [-880, -640, 185], [-1200, -690, 200], [-1650, -620, 220], [-2100, -480, 240], [-2700, -420, 260],
], 12);

// 河道距離場（10 m 解析度），供地形與佈景查詢
const DF_N = 440, DF_R = 2200, DF_S = (2 * DF_R) / DF_N;
const DF = new Float32Array((DF_N + 1) * (DF_N + 1));
const DW = new Float32Array((DF_N + 1) * (DF_N + 1));
{
  for (let j = 0; j <= DF_N; j++) for (let i = 0; i <= DF_N; i++) {
    const x = -DF_R + i * DF_S, z = -DF_R + j * DF_S;
    const r = distToPolyline(RIVER, x, z);
    const a = RIVER[r.i], b = RIVER[r.i + 1];
    DF[j * (DF_N + 1) + i] = r.d; DW[j * (DF_N + 1) + i] = lerp(a[2], b[2], r.t);
  }
}
function sampleField(F, x, z) {
  const fx = clamp((x + DF_R) / DF_S, 0, DF_N - 0.001), fz = clamp((z + DF_R) / DF_S, 0, DF_N - 0.001);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, W = DF_N + 1;
  return lerp(lerp(F[j * W + i], F[j * W + i + 1], u), lerp(F[(j + 1) * W + i], F[(j + 1) * W + i + 1], u), v);
}
export function riverInfo(x, z) {
  if (Math.abs(x) > DF_R || Math.abs(z) > DF_R) { const r = distToPolyline(RIVER, x, z); return { d: r.d, w: 230 }; }
  return { d: sampleField(DF, x, z), w: sampleField(DW, x, z) };
}

// ---------- 劍潭山 ----------
// 稜線 [x, z, 高, 半寬]
const RIDGE = catmull([
  [-520, -430, 22, 160], [-300, -480, 80, 210], [-60, -570, 132, 240], [220, -660, 172, 250], [480, -720, 196, 260],
  [820, -700, 160, 250], [1150, -780, 190, 290], [1500, -860, 170, 320], [1900, -920, 140, 340], [2400, -1000, 120, 380],
], 20);

// ---------- 神社軸線 ----------
// 本殿位置與朝向（面向西南，遙對明治橋）
export const SHRINE = { x: 225, z: -432, dir: [-0.50, 0.866] };
export const shrineLocal = (s, u) => [SHRINE.x + SHRINE.dir[0] * s - SHRINE.dir[1] * u, SHRINE.z + SHRINE.dir[1] * s + SHRINE.dir[0] * u];
export const shrineYaw = Math.atan2(SHRINE.dir[0], SHRINE.dir[1]); // 物件 +z 朝向參道方向

// 階段式台地 [沿軸 s, 寬 u, 深, 高]
export const TERRACES = [
  { s: 0, u: 0, w: 46, d: 40, h: 52 },    // 本殿
  { s: 46, u: 0, w: 60, d: 30, h: 41 },   // 拜殿
  { s: 100, u: 0, w: 90, d: 62, h: 29 },  // 外苑（社務所、手水舍）
];

// 參道：明治橋北端 → 一之鳥居 → 爬坡 → 外苑。 [x, z, y]
export const SANDO = catmull([
  [0, -78, 10.2], [6, -118, 9.6], [22, -165, 11], [48, -208, 14], [84, -248, 19.5], [116, -276, 24.6], [shrineLocal(140, 0)[0], shrineLocal(140, 0)[1], 28.6],
], 4);

// 沿河道路（北岸，劍潭山南麓）、中山北路（南岸）
export const ROAD_N_EAST = catmull([[34, -82, 9.6], [200, -95, 7.5], [420, -70, 6.5], [700, -40, 6.2], [1000, -12, 6], [1500, 40, 6], [2100, 90, 6]], 10);
export const ROAD_N_WEST = catmull([[-10, -82, 9.6], [-120, -150, 6.5], [-260, -280, 6], [-330, -450, 6], [-360, -700, 7], [-300, -1100, 8], [-250, -1700, 10]], 10);
export const ZHONGSHAN = catmull([[0, 74, 10.2], [-2, 140, 7], [-4, 220, 6], [-14, 600, 6], [-30, 1100, 6], [-48, 1700, 6], [-62, 2300, 6]], 10);
// 縱貫線淡水線（鐵道、今捷運）
export const RAIL = catmull([[-470, 2200], [-430, 1200], [-410, 600], [-395, 200], [-380, -100], [-360, -400], [-330, -900], [-300, -1600]], 12);

// ---------- 高程 ----------
const FLATS = [];
for (const t of TERRACES) { const [x, z] = shrineLocal(t.s, t.u); FLATS.push({ x, z, w: t.w / 2, d: t.d / 2, h: t.h, f: 20, rot: true }); }
// 二代神宮台地（後山東側）、護國神社／忠烈祠台地、圓山飯店前庭
FLATS.push({ x: 330, z: -505, w: 48, d: 30, h: 92, f: 26, rot: true });
FLATS.push({ x: 900, z: -150, w: 70, d: 60, h: 9, f: 30, rot: false });

function flatWeight(F, x, z) {
  let dx = x - F.x, dz = z - F.z;
  if (F.rot) { const a = SHRINE.dir; const s = dx * a[0] + dz * a[1], u = -dx * a[1] + dz * a[0]; dx = u; dz = s; }
  const ex = Math.max(0, Math.abs(dx) - F.w), ez = Math.max(0, Math.abs(dz) - F.d);
  return 1 - smooth(0, F.f, Math.hypot(ex, ez));
}

function corridor(pl, x, z, half, blend) {
  const r = distToPolyline(pl, x, z); if (r.d > half + blend) return null;
  const a = pl[r.i], b = pl[r.i + 1];
  return { w: 1 - smooth(half, half + blend, r.d), y: a.length > 2 ? lerp(a[2], b[2], r.t) : null };
}

const ridgeCache = new Map();
export function baseHeight(x, z) {
  // 平原
  let h = 4.6 + fbm(x * 0.004, z * 0.004, 3) * 2.2;
  // 劍潭山
  const r = distToPolyline(RIDGE, x, z);
  const a = RIDGE[r.i], b = RIDGE[r.i + 1];
  const rh = lerp(a[2], b[2], r.t), rw = lerp(a[3], b[3], r.t);
  const prof = Math.exp(-Math.pow(r.d / rw, 2) * 1.6);
  const rough = ridged(x * 0.006, z * 0.006, 5);
  const gully = fbm(x * 0.012 + 4, z * 0.012 - 7, 4);
  h += rh * prof * (0.78 + 0.42 * rough) + gully * 14 * prof;
  // 圓山（動物園舊址小丘）
  const dy = Math.hypot(x + 300, z - 190); h += 30 * Math.exp(-Math.pow(dy / 105, 2)) * (0.9 + 0.2 * fbm(x * 0.03, z * 0.03, 2));
  // 遠山：北方大屯、七星，東南南港山，西方觀音山
  const R = Math.hypot(x, z);
  if (R > 1500) {
    const far = smooth(1600, 4200, R);
    const mtn = (cx, cz, hh, rr) => hh * Math.exp(-Math.pow(Math.hypot(x - cx, z - cz) / rr, 2));
    let m = mtn(-2600, -8800, 700, 2200) + mtn(2200, -8400, 760, 2000) + mtn(-900, -9600, 620, 1500) + mtn(-3900, -7400, 420, 1300) + mtn(3600, -7000, 420, 1400) + mtn(800, -7600, 380, 1100) + mtn(-2600, -8800, 380, 3600) + mtn(2200, -8400, 380, 3300) + mtn(-300, -6200, 520, 2600) + mtn(5600, -4200, 600, 3000)
      + mtn(6200, 5600, 360, 2400) + mtn(9500, 2200, 420, 2600) + mtn(-9400, -1800, 610, 2400) + mtn(-6800, 7200, 260, 3000) + mtn(-1200, 9800, 380, 3400);
    m *= 0.7 + 0.5 * ridged(x * 0.00045, z * 0.00045, 5);
    h += m * far;
  }
  return h;
}

export function landHeight(x, z) {
  let h = baseHeight(x, z);
  for (const F of FLATS) { const w = flatWeight(F, x, z); if (w > 0) h = lerp(h, F.h, w); }
  // 參道與沿河道路順著坡面
  const s = corridor(SANDO, x, z, 6, 10); if (s) h = lerp(h, s.y - 0.15, s.w);
  { const c = corridor(ZHONGSHAN.slice(0, 30), x, z, 13, 18); if (c) h = lerp(h, c.y, c.w); }
  for (const pl of [ROAD_N_EAST, ROAD_N_WEST]) { const c = corridor(pl, x, z, 7, 14); if (c) h = lerp(h, Math.max(Math.min(h, c.y + 0.5), h - 3), c.w * 0.85); }
  return h;
}

// 河岸：河床 -5，兩岸緩坡，北岸緊貼山腳
export function heightAt(x, z) {
  let h = landHeight(x, z);
  const { d, w } = riverInfo(x, z);
  const half = w * 0.5;
  const bank = smooth(half - 22, half + 18, d);
  const bed = -5.5 + 2.5 * smooth(0, half - 20, d);
  h = lerp(Math.min(bed, h), Math.max(h, 1.2), bank);
  return h;
}

// ---------- 地表分類（供樹木、房屋取樣） ----------
export function slopeAt(x, z, e = 4) {
  const hx = heightAt(x + e, z) - heightAt(x - e, z), hz = heightAt(x, z + e) - heightAt(x, z - e);
  return Math.hypot(hx, hz) / (2 * e);
}
export function nearSando(x, z, pad = 0) { return distToPolyline(SANDO, x, z).d < 8 + pad; }
export function nearRoad(x, z, pad = 0) {
  return distToPolyline(ROAD_N_EAST, x, z).d < 9 + pad || distToPolyline(ROAD_N_WEST, x, z).d < 9 + pad || distToPolyline(ZHONGSHAN, x, z).d < 14 + pad || distToPolyline(RAIL, x, z).d < 9 + pad;
}
export function inTerrace(x, z, pad = 0, count = 99) {
  for (const F of FLATS.slice(0, count)) { const save = F.f; F.f = 1e-3; const w = flatWeight({ ...F, w: F.w + pad, d: F.d + pad }, x, z); F.f = save; if (w > 0.5) return true; }
  return false;
}
export const isMountain = (x, z) => baseHeight(x, z) > 14 && distToPolyline(RIDGE, x, z).d < 650;
