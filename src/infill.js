import { pointInPolygon, polygonArea } from './geo.js';
import { roadWidth } from './builders/ground.js';

// OSM 在台灣很多街廓沒有畫建物，畫面會出現大片空地。
// 這裡沿著道路兩側推估補上一排排「街屋」(4–5 公尺面寬、12–16 公尺進深)，
// 標記為 _infill（推估補建），可在編輯模式隱藏或調整，原始 OSM 建物不受影響。
const FRONT = new Set(['primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'trunk', 'service']);

export function generateInfill(base, scale = 1) {
  const CELL = 25; const grid = new Map();
  const key = (x, z) => Math.floor(x / CELL) + ',' + Math.floor(z / CELL);
  const addSeg = (a, b, r) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / CELL) + 1; for (let i = 0; i <= n; i++) { const t = i / n; const k = key(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push([a, b, r]); } };
  for (const r of base.roads) { const w = roadWidth(r, scale) / 2 + (FRONT.has(r.tags.highway) ? 2.5 : 1); for (let i = 1; i < r.line.length; i++) addSeg(r.line[i - 1], r.line[i], w); }
  for (const r of base.rails) for (let i = 1; i < r.line.length; i++) addSeg(r.line[i - 1], r.line[i], 9);
  for (const w of base.waterways) for (let i = 1; i < w.line.length; i++) addSeg(w.line[i - 1], w.line[i], 8);
  const nearLine = (x, z) => {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const l = grid.get((Math.floor(x / CELL) + dx) + ',' + (Math.floor(z / CELL) + dz)); if (!l) continue;
      for (const [a, b, r] of l) { const ex = b[0] - a[0], ez = b[1] - a[1]; const L = ex * ex + ez * ez || 1; const t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / L)); if (Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t) < r) return true; }
    }
    return false;
  };
  const bgrid = new Map();
  const occupied = [...base.buildings.map(b => b.ring), ...base.areas.filter(a => ['park', 'water', 'pitch', 'grass', 'platform'].includes(a.kind)).map(a => a.ring)];
  for (const ring of occupied) { let a = 1e9, c = 1e9, d = -1e9, e = -1e9; for (const p of ring) { a = Math.min(a, p[0]); c = Math.min(c, p[1]); d = Math.max(d, p[0]); e = Math.max(e, p[1]); } const item = { ring, bb: [a - 1, c - 1, d + 1, e + 1] }; for (let i = Math.floor(a / CELL); i <= Math.floor(d / CELL); i++) for (let j = Math.floor(c / CELL); j <= Math.floor(e / CELL); j++) { const k = i + ',' + j; let l = bgrid.get(k); if (!l) bgrid.set(k, l = []); l.push(item); } }
  const inside = (x, z) => { const l = bgrid.get(key(x, z)); if (!l) return false; for (const it of l) { if (x < it.bb[0] || x > it.bb[2] || z < it.bb[1] || z > it.bb[3]) continue; if (pointInPolygon(x, z, it.ring)) return true; } return false; };
  const placed = []; const pgrid = new Map();
  const clashPlaced = (ring) => { const [cx, cz] = ring.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4], [0, 0]); const l = pgrid.get(key(cx, cz)) || []; for (const o of [...l, ...neighbors(cx, cz)]) for (const p of ring) if (pointInPolygon(p[0], p[1], o)) return true; for (const o of [...l, ...neighbors(cx, cz)]) if (pointInPolygon(cx, cz, o)) return true; return false; };
  const neighbors = (x, z) => { const out = []; for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (dx || dz) out.push(...(pgrid.get((Math.floor(x / CELL) + dx) + ',' + (Math.floor(z / CELL) + dz)) || [])); return out; };
  let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const out = []; let id = 9e12;
  for (const r of base.roads) {
    if (!FRONT.has(r.tags.highway) || r.tags.bridge || r.tags.tunnel) continue;
    const off = roadWidth(r, scale) / 2 + 3.2;
    for (const side of [-1, 1]) for (let i = 1; i < r.line.length; i++) {
      const a = r.line[i - 1], b = r.line[i]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 6) continue;
      const tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L; const nx = -tz * side, nz = tx * side;
      let s = 3;
      while (s < L - 3) {
        const w = 4 + rnd() * 1.6, d = 11 + rnd() * 6;
        const p0 = [a[0] + tx * s + nx * off, a[1] + tz * s + nz * off];
        const ring = [p0, [p0[0] + tx * w, p0[1] + tz * w], [p0[0] + tx * w + nx * d, p0[1] + tz * w + nz * d], [p0[0] + nx * d, p0[1] + nz * d]];
        const samples = [...ring, [p0[0] + tx * w / 2 + nx * d / 2, p0[1] + tz * w / 2 + nz * d / 2], [p0[0] + tx * w / 2 + nx * 1, p0[1] + tz * w / 2 + nz * 1]];
        const ok = samples.every(([x, z]) => !inside(x, z) && !nearLine(x, z)) && !clashPlaced(ring);
        if (ok) {
          if (polygonArea(ring) < 0) ring.reverse();
          out.push({ id: id++, tags: { building: 'yes', _infill: 'yes' }, ring, area: w * d, infill: true });
          const k = key(p0[0] + nx * d / 2, p0[1] + nz * d / 2); let l = pgrid.get(k); if (!l) pgrid.set(k, l = []); l.push(ring);
        }
        s += w;
      }
    }
  }
  return out;
}
