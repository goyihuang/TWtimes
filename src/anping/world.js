// 安平・大員各年代的地景：沙洲與海、熱蘭遮城（完整／殘牆／平臺）、市鎮街屋、現代街區、船、樹、人。
// 城堡平面依 plan.js（疊圖描線），現代街區依 public/data/anping.osm.json（OSM）。
import * as T from 'three';
import { rng, merge, canvasTex, signTexture, glowTex, ribbon, obb, paint } from '../tainan/kit.js';
import { INNER, TIP_ANGLE, OUTER, OUTER_TOWER, OUTER_BLDG, BLOCKS, CIVIC, UTRECHT, SHORE } from './plan.js';

const std = o => new T.MeshStandardMaterial({ roughness: 0.88, ...o });
const shade = (o, cast = true) => { o.traverse(m => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = true; } }); return o; };
const CEN = INNER.center;

// ── 程序貼圖 ──
const brickTex = (base, mortar, seed, aged = 0) => canvasTex(256, 256, (g, W, H) => {
  const r = rng(seed); g.fillStyle = mortar; g.fillRect(0, 0, W, H);
  for (let row = 0; row < 16; row++) {                       // 荷式砌法：一丁一順交錯
    const header = row % 2, bw = header ? 16 : 32, off = header ? 8 : (row % 4 === 0 ? 0 : 16);
    for (let x = -off; x < W; x += bw) {
      const c = new T.Color(base).offsetHSL((r() - 0.5) * 0.03, (r() - 0.5) * 0.12, (r() - 0.5) * 0.12 - aged * r() * 0.2);
      g.fillStyle = '#' + c.getHexString(); g.fillRect(x + 1, row * 16 + 1, bw - 2, 14);
    }
  }
  if (aged) for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(40,35,25,${0.05 + r() * 0.12})`; g.beginPath(); g.ellipse(r() * W, r() * H, 6 + r() * 30, 3 + r() * 40, r() * 3, 0, 7); g.fill(); }
});
const plasterTex = canvasTex(256, 256, (g, W, H) => {
  const r = rng(3); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 1600; i++) { const v = 228 + r() * 27 | 0; g.fillStyle = `rgb(${v},${v},${v - 6})`; g.fillRect(r() * W, r() * H, 2 + r() * 4, 2 + r() * 4); }
  g.fillStyle = 'rgba(120,110,90,.18)'; g.fillRect(0, H - 18, W, 18);
});
// 立面：一格 = 寬 4 m × 高 3.5 m；窗位於中央
const facadeTex = kind => canvasTex(256, 256, (g, W, H) => {
  const r = rng(kind.length * 31); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) { const v = 232 + r() * 23 | 0; g.fillStyle = `rgb(${v},${v},${v - 5})`; g.fillRect(r() * W, r() * H, 3, 3); }
  if (kind === 'dutch') { g.fillStyle = '#2f2a24'; g.fillRect(92, 70, 72, 96); g.fillStyle = '#5b6d4a'; g.fillRect(68, 70, 22, 96); g.fillRect(166, 70, 22, 96); g.fillStyle = '#e8e0cc'; g.fillRect(88, 166, 80, 8); }
  else if (kind === 'minnan') { g.fillStyle = '#3a2f26'; g.fillRect(100, 92, 56, 70); g.strokeStyle = '#8b6b4a'; g.lineWidth = 4; for (let x = 108; x < 156; x += 10) { g.beginPath(); g.moveTo(x, 92); g.lineTo(x, 162); g.stroke(); } g.fillStyle = 'rgba(150,80,60,.35)'; g.fillRect(0, 210, W, 46); }
  else if (kind === 'shop') { g.fillStyle = '#d9d2c3'; g.fillRect(0, 196, W, 20); g.fillStyle = '#39444c'; g.fillRect(40, 54, 176, 120); g.fillStyle = '#cfd6d8'; g.fillRect(124, 54, 8, 120); g.fillStyle = '#9aa1a3'; g.fillRect(46, 178, 164, 8); }
  else { g.fillStyle = '#41464a'; g.fillRect(36, 60, 184, 116); g.fillStyle = '#c9cdcf'; g.fillRect(36, 116, 184, 6); g.fillRect(126, 60, 5, 116); }
});
const nightTex = (rect, seed) => canvasTex(256, 256, g => { const r = rng(seed); g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256); g.fillStyle = r() > 0.4 ? '#ffcf8a' : '#ffe2b0'; g.fillRect(...rect); });
const roofTex = (base, seed, kind = 'tile') => canvasTex(256, 256, (g, W, H) => {
  const r = rng(seed); g.fillStyle = '#' + new T.Color(base).multiplyScalar(0.7).getHexString(); g.fillRect(0, 0, W, H);
  if (kind === 'thatch') { for (let i = 0; i < 2400; i++) { const c = new T.Color(base).offsetHSL(0, 0, (r() - 0.5) * 0.2); g.strokeStyle = '#' + c.getHexString(); g.beginPath(); const x = r() * W, y = r() * H; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y + 12 + r() * 10); g.stroke(); } return; }
  for (let row = 0; row < 16; row++) for (let x = 0; x < W; x += 16) {
    const c = new T.Color(base).offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.14);
    const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, '#' + c.clone().multiplyScalar(0.65).getHexString()); gr.addColorStop(0.5, '#' + c.getHexString()); gr.addColorStop(1, '#' + c.clone().multiplyScalar(0.7).getHexString());
    g.fillStyle = gr; g.fillRect(x, row * 16, 15, 15);
  }
});
const sandTex = canvasTex(512, 512, (g, W, H) => {
  const r = rng(11); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) { const v = 205 + r() * 50 | 0; g.fillStyle = `rgba(${v},${v - 6},${v - 22},.6)`; g.fillRect(r() * W, r() * H, 2, 2); }
  for (let i = 0; i < 60; i++) { g.strokeStyle = 'rgba(170,150,110,.18)'; g.lineWidth = 3; g.beginPath(); const y = r() * H; g.moveTo(0, y); g.bezierCurveTo(W / 3, y + 20 * (r() - 0.5), W * 2 / 3, y + 20 * (r() - 0.5), W, y); g.stroke(); }
});
const waveNormal = canvasTex(256, 256, (g, W, H) => {
  const img = g.createImageData(W, H), r = rng(4), waves = Array.from({ length: 24 }, () => [r() * 6.28, 1 + r() * 7, 1 + r() * 7, r() * 6.28]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let dx = 0, dy = 0; for (const [, kx, ky, p] of waves) { const ph = (kx * x + ky * y) / W * 6.283 + p, c = Math.cos(ph) / 24; dx += kx * c; dy += ky * c; }
    const i = (y * W + x) * 4; img.data[i] = 128 + dx * 40; img.data[i + 1] = 128 + dy * 40; img.data[i + 2] = 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}, false);
const flagTex = canvasTex(96, 64, g => { ['#d9682b', '#f2efe6', '#2c4f8a'].forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * 21.4, 96, 21.4); }); g.fillStyle = '#1d1d1d'; g.font = 'bold 15px serif'; g.textAlign = 'center'; g.fillText('VOC', 48, 37); });

// ── 幾何工具 ──
const rot = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
function bastioned(half, f, g, tipD, ang = TIP_ANGLE - Math.PI / 4, c = CEN) {
  const d = tipD / Math.SQRT2, base = [[half, half - f], [half + g, half - f], [d, d], [half - f, half + g], [half - f, half]], out = [];
  for (let k = 0; k < 4; k++) for (const p of base) out.push(add(c, rot(rot(p, k * Math.PI / 2), ang)));
  return out;
}
function inside(p, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > p[1]) !== (zj > p[1]) && p[0] < (xj - xi) * (p[1] - zi) / (zj - zi) + xi) c = !c; } return c; }
const centroid = pts => pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
// 斜牆稜體：底部 pts、頂部向中心內縮 batter（m），側面 UV 以公尺 / tile
function prism(pts, y0, y1, batter = 0, tile = 4, cap = true, c = centroid(pts)) {
  const top = pts.map(p => { const dx = p[0] - c[0], dz = p[1] - c[1], L = Math.hypot(dx, dz) || 1; return [p[0] - dx / L * batter, p[1] - dz / L * batter]; });
  let area = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const pos = [], uv = []; let run = 0;
  for (let i = 0; i < pts.length; i++) {
    let j = (i + 1) % pts.length, [a, b, ta, tb] = [pts[i], pts[j], top[i], top[j]]; if (area < 0) [a, b, ta, tb] = [b, a, tb, ta];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), u0 = run / tile, u1 = (run + L) / tile, v = (y1 - y0) / tile; run += L;
    pos.push(a[0], y0, a[1], tb[0], y1, tb[1], b[0], y0, b[1], a[0], y0, a[1], ta[0], y1, ta[1], tb[0], y1, tb[1]);
    uv.push(u0, 0, u1, v, u1, 0, u0, 0, u0, v, u1, v);
  }
  const walls = new T.BufferGeometry(); walls.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); walls.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); walls.computeVertexNormals();
  if (!cap) return { walls, top };
  const sh = new T.ShapeGeometry(new T.Shape(top.map(([x, z]) => new T.Vector2(x, -z)))); sh.rotateX(-Math.PI / 2); sh.translate(0, y1, 0);
  const p = sh.attributes.position, u2 = []; for (let i = 0; i < p.count; i++) u2.push(p.getX(i) / tile, p.getZ(i) / tile); sh.setAttribute('uv', new T.Float32BufferAttribute(u2, 2));
  return { walls, cap: sh, top };
}
// 沿折線的牆（厚度 t、高 h），可選雉堞
function wallAlong(pts, h, t, y0 = 0, closed = true, crenel = 0) {
  const gs = [], n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.3) continue;
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const box = (len, hh, yy, off = 0) => { const g = new T.BoxGeometry(len, hh, t); const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * len / 4, uv.getY(k) * hh / 4); g.translate(off, yy + hh / 2, 0); g.rotateY(-ang); g.translate(mid[0], 0, mid[1]); return g; };
    gs.push(box(L + t, h, y0));
    if (crenel) for (let s = -L / 2 + 1; s < L / 2 - 0.6; s += 2.4) gs.push(box(1.3, crenel, y0 + h, s));
  }
  return merge(gs);
}
// 人字屋頂房屋：中心、方向、寬（沿 ang）、深、簷高、屋脊高
function house(cx, cz, ang, w, d, h, rise, over = 0.45) {
  const c = Math.cos(ang), s = Math.sin(ang), P = (u, y, v) => [cx + u * c - v * s, y, cz + u * s + v * c];
  const wall = new T.BoxGeometry(w, h, d); const uv = wall.attributes.uv; const nrm = wall.attributes.normal;
  for (let k = 0; k < uv.count; k++) { const along = Math.abs(nrm.getX(k)) > 0.5 ? d : w; uv.setXY(k, uv.getX(k) * along / 4, uv.getY(k) * h / 3.5); }
  wall.translate(0, h / 2, 0); wall.rotateY(-ang); wall.translate(cx, 0, cz);
  const W2 = w / 2 + over, D2 = d / 2 + over, pos = [], tuv = [];
  const quad = (a, b, cc, dd, L, Dp) => { pos.push(...a, ...b, ...cc, ...a, ...cc, ...dd); tuv.push(0, 0, L / 3, 0, L / 3, Dp / 3, 0, 0, L / 3, Dp / 3, 0, Dp / 3); };
  const slope = Math.hypot(D2, rise);
  quad(P(-W2, h, D2), P(W2, h, D2), P(W2, h + rise, 0), P(-W2, h + rise, 0), w + over * 2, slope);
  quad(P(W2, h, -D2), P(-W2, h, -D2), P(-W2, h + rise, 0), P(W2, h + rise, 0), w + over * 2, slope);
  const roof = new T.BufferGeometry(); roof.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); roof.setAttribute('uv', new T.Float32BufferAttribute(tuv, 2)); roof.computeVertexNormals();
  const gp = []; for (const sgn of [-1, 1]) gp.push(...P(sgn * w / 2, h, -d / 2), ...P(sgn * w / 2, h, d / 2), ...P(sgn * w / 2, h + rise, 0));
  const gable = new T.BufferGeometry(); gable.setAttribute('position', new T.Float32BufferAttribute(gp, 3)); gable.setAttribute('uv', new T.Float32BufferAttribute(new Array(gp.length / 3 * 2).fill(0.5), 2));
  const gb = gable; gb.computeVertexNormals();
  // 兩面山牆都要雙面可見：再加反向
  const rev = gb.clone(); const rp = rev.attributes.position.array; for (let i = 0; i < rp.length; i += 9) for (let k = 0; k < 3; k++) [rp[i + 3 + k], rp[i + 6 + k]] = [rp[i + 6 + k], rp[i + 3 + k]]; rev.computeVertexNormals();
  return { wall, roof, gable: merge([gb, rev]) };
}
function treeGeo(seed, kind = 'banyan') {
  const r = rng(seed), parts = [];
  const trunk = new T.CylinderGeometry(0.35, 0.55, 4, 7); trunk.translate(0, 2, 0); parts.push(paint(trunk, 0x5b4a3a));
  const n = kind === 'banyan' ? 6 : 3, col = kind === 'banyan' ? 0x3f5d34 : 0x6c7f45;
  for (let i = 0; i < n; i++) { const s = new T.IcosahedronGeometry(1.8 + r() * 1.6, 1); s.scale(1.25, 0.75, 1.25); s.translate((r() - 0.5) * 4, 4.5 + r() * 2.2, (r() - 0.5) * 4); parts.push(paint(s, new T.Color(col).offsetHSL(0, 0, (r() - 0.5) * 0.08))); }
  return merge(parts);
}
function personGeo() {
  const g = (geo, c) => paint(geo, c);
  const body = new T.CylinderGeometry(0.17, 0.21, 0.66, 7); body.translate(0, 1.1, 0);
  const legs = new T.CylinderGeometry(0.15, 0.13, 0.8, 6); legs.translate(0, 0.4, 0);
  const head = new T.SphereGeometry(0.12, 8, 6); head.translate(0, 1.58, 0);
  return merge([g(body, 0xffffff), g(legs, 0x3a352f), g(head, 0xc69a76)]);
}
function shipGeo(kind) {
  const p = [], wood = 0x4d3624, sail = kind === 'junk' ? 0xb98a55 : 0xeee4cc;
  if (kind === 'fluyt') {
    const hull = new T.CylinderGeometry(4, 2.4, 34, 12, 1, false, 0, Math.PI); hull.rotateZ(Math.PI / 2); hull.rotateX(Math.PI); hull.scale(1, 1.1, 1.2); hull.translate(0, 3.6, 0); p.push(paint(hull, wood));
    p.push(paint(new T.BoxGeometry(7, 4, 8.5).translate(-14, 5.5, 0), 0x5e4330), paint(new T.BoxGeometry(30, 0.4, 8.4).translate(1, 3.7, 0), 0x6b5038));
    for (const [x, h] of [[-8, 26], [3, 31], [12, 22]]) { p.push(paint(new T.CylinderGeometry(0.25, 0.35, h, 6).translate(x, 3.6 + h / 2, 0), 0x3a2a1c)); for (const [y, w, hh] of [[0.45, 1, 0.24], [0.72, 0.8, 0.2]]) p.push(paint(new T.BoxGeometry(0.25, h * hh, 9 * w).translate(x + 0.4, 3.6 + h * y, 0), sail)); }
  } else if (kind === 'junk') {
    p.push(paint(new T.BoxGeometry(18, 2.8, 5.5).translate(0, 1.4, 0), 0x5a3d26), paint(new T.BoxGeometry(4, 2.5, 5).translate(-7, 3.6, 0), 0x6b4a2e));
    for (const [x, h] of [[-2, 14], [4, 11]]) { p.push(paint(new T.CylinderGeometry(0.2, 0.28, h, 6).translate(x, 2.8 + h / 2, 0), 0x3a2a1c)); p.push(paint(new T.BoxGeometry(0.2, h * 0.6, 6).translate(x + 0.3, 2.8 + h * 0.55, 0), sail)); }
  } else if (kind === 'raft') {
    for (let i = -3; i <= 3; i++) p.push(paint(new T.CylinderGeometry(0.16, 0.16, 9, 6).rotateZ(Math.PI / 2).translate(0, 0.2, i * 0.34), 0xa68c5c));
    p.push(paint(new T.CylinderGeometry(0.06, 0.08, 5, 5).translate(1, 2.6, 0), 0x6d5a3e), paint(new T.BoxGeometry(0.1, 3, 2.2).translate(1.2, 3, 0), 0xb59b74));
  } else { // sampan／現代漁筏
    p.push(paint(new T.BoxGeometry(7, 1, 2).translate(0, 0.4, 0), kind === 'boat' ? 0x2f6aa8 : 0x5a4330), paint(new T.BoxGeometry(2.4, 1.3, 1.8).translate(-1, 1.5, 0), kind === 'boat' ? 0xe8e8e2 : 0x6b4a2e));
  }
  return merge(p);
}

// ═════ 年代地景 ═════
export function buildEra(era, osm, env) {
  const group = new T.Group(), nightMats = [], glows = [], wetMats = [], movers = [], solids = [];
  const k = era.kind, r = rng(k.length * 13 + 5); trees.length = 0;
  const wet = (m) => { wetMats.push({ m, rough: m.roughness, color: m.color.clone() }); return m; };
  const add = (geo, mat, cast = true) => { if (!geo) return null; const m = new T.Mesh(geo, mat); shade(m, cast); group.add(m); return m; };

  // ── 海、沙洲、地面 ──
  const sea = new T.Mesh(new T.PlaneGeometry(5000, 5000), new T.MeshPhysicalMaterial({ color: k === 'today' ? 0x3e6a70 : 0x4c7470, roughness: 0.12, metalness: 0.1, normalMap: waveNormal, normalScale: new T.Vector2(0.35, 0.35), clearcoat: 0.3 }));
  sea.material.normalMap.repeat.set(220, 220); sea.rotation.x = -Math.PI / 2; sea.position.y = -0.6; sea.receiveShadow = true; group.add(sea);
  movers.push(dt => { sea.material.normalMap.offset.x += dt * 0.004; sea.material.normalMap.offset.y += dt * 0.0025; });
  const groundCol = k === 'today' ? 0x9a978f : k === 'japan' ? 0xb9a985 : 0xd8c8a2;
  const landShape = (k === 'dutch' || k === 'ruin') ? SHORE : modernLand(osm);
  const land = new T.ShapeGeometry(new T.Shape(landShape.map(([x, z]) => new T.Vector2(x, -z)))); land.rotateX(-Math.PI / 2);
  { const p = land.attributes.position, uv = []; for (let i = 0; i < p.count; i++) uv.push(p.getX(i) / 30, p.getZ(i) / 30); land.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); }
  sandTex.repeat.set(1, 1); const groundMat = wet(std({ color: groundCol, map: sandTex, roughness: 0.97 }));
  add(land, groundMat, false);
  // 岸邊淺灘
  const beach = new T.Mesh(ribbon([...landShape, landShape[0]], 14, -0.35, 14), std({ color: 0xc9b98f, map: sandTex, roughness: 0.95 })); beach.receiveShadow = true; group.add(beach);

  if (k === 'dutch') dutchFort(); else if (k === 'ruin') ruins(); else platform();
  if (k === 'dutch') dutchTown(); else townFromOSM();
  if (k !== 'dutch') roads();
  if (k === 'japan' || k === 'today') waters();
  vegetation(); people(); ships();
  return { group, nightMats, glows, wetMats, movers, solids };

  // ── 1644 熱蘭遮城 ──
  function dutchFort() {
    const brick = wet(std({ map: brickTex(0xa0583c, '#b8a68a', 2), roughness: 0.9 }));
    const lime = wet(std({ map: plasterTex, color: 0xe9e1cf, roughness: 0.92 }));
    const top = std({ color: 0xc2a77f, map: sandTex, roughness: 0.96 });
    // 下層主堡：四角星形，高 7.5 m；四邊中段圓塔
    const lower = bastioned(32, 15, 5, INNER.lowerTip);
    const L1 = prism(lower, 0, 7.5, 1.2, 4); add(L1.walls, brick); add(L1.cap, top);
    add(wallAlong(L1.top, 1.1, 0.9, 7.5, true, 0.6), brick);
    for (let i = 0; i < 4; i++) {
      const p = add2(CEN, rot([33, 0], TIP_ANGLE + Math.PI / 4 + i * Math.PI / 2));   // 四邊中段
      const tw = new T.CylinderGeometry(5.2, 5.8, 7.5, 20, 1, true); tw.translate(p[0], 3.75, p[1]); scaleUV(tw, 36 / 4, 7.5 / 4); add(tw, brick);
      add(new T.CircleGeometry(5.2, 20).rotateX(-Math.PI / 2).translate(p[0], 7.5, p[1]), top);
      const pr = new T.CylinderGeometry(5.3, 5.3, 1.1, 20, 1, true); pr.translate(p[0], 8.05, p[1]); add(pr, brick);
    }
    // 上層主堡：方形四稜堡，13.5 m
    const upper = bastioned(INNER.upperHalf, 8, 4, INNER.upperTip);
    const U = prism(upper, 7.5, 13.5, 0.8, 4); add(U.walls, brick); add(U.cap, top);
    add(wallAlong(U.top, 1.2, 0.9, 13.5, true, 0.7), brick);
    solids.push({ poly: upper, h: 13.5 });
    solids.push({ poly: lower, h: 7.5 });
    // 中庭四周營舍（兩層、紅瓦）
    const ang = TIP_ANGLE - Math.PI / 4, walls = [], roofs = [], gables = [];
    for (let i = 0; i < 4; i++) {
      const c = add2(CEN, rot([0, INNER.courtHalf - 3.2], ang + i * Math.PI / 2));
      const hs = house(c[0], c[1], ang + i * Math.PI / 2, INNER.courtHalf * 2 - 2, 6, 6.5, 3.6); walls.push(hs.wall.translate(0, 13.5, 0)); roofs.push(hs.roof.translate(0, 13.5, 0)); gables.push(hs.gable.translate(0, 13.5, 0));
    }
    // 教堂／長官舊宅（中庭內）
    const ch = house(CEN[0], CEN[1], ang, 16, 9, 7.5, 4.6); walls.push(ch.wall.translate(0, 13.5, 0)); roofs.push(ch.roof.translate(0, 13.5, 0)); gables.push(ch.gable.translate(0, 13.5, 0));
    // 西南稜堡瞭望塔與旗桿
    const sw = add2(CEN, rot([INNER.upperTip - 12, 0], TIP_ANGLE + Math.PI));   // 西尖角＝西南稜堡（疊圖方位）
    add(new T.BoxGeometry(4.5, 9, 4.5).translate(sw[0], 13.5 + 4.5, sw[1]), lime);
    add(new T.ConeGeometry(3.6, 4, 4).rotateY(Math.PI / 4).translate(sw[0], 13.5 + 11, sw[1]), std({ color: 0x5c4a3c }));
    const pole = add(new T.CylinderGeometry(0.12, 0.18, 14, 6).translate(CEN[0] + 6, 13.5 + 7, CEN[1] - 4), std({ color: 0x3b2c20 }));
    const flag = new T.Mesh(new T.PlaneGeometry(4.5, 3, 8, 1), std({ map: flagTex, side: T.DoubleSide, roughness: 0.8 })); flag.position.set(CEN[0] + 8.3, 13.5 + 12.5, CEN[1] - 4); group.add(flag);
    const fp = flag.geometry.attributes.position, base = fp.array.slice();
    movers.push((dt, t) => { for (let i = 0; i < fp.count; i++) { const x = base[i * 3] + 2.25; fp.setZ(i, Math.sin(x * 1.6 - t * 5) * 0.18 * x); } fp.needsUpdate = true; });
    // 外堡：周牆 6 m、北側圓塔、堡內建物
    add(wallAlong(OUTER, 6, 2.4, 0, true, 0.7), brick);
    const ot = new T.CylinderGeometry(6, 6.6, 7, 20, 1, true); ot.translate(OUTER_TOWER[0], 3.5, OUTER_TOWER[1]); scaleUV(ot, 40 / 4, 7 / 4); add(ot, brick);
    add(new T.CircleGeometry(6, 20).rotateX(-Math.PI / 2).translate(OUTER_TOWER[0], 7, OUTER_TOWER[1]), top);
    for (const b of OUTER_BLDG) {
      const L = Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1]), a = Math.atan2(b.b[1] - b.a[1], b.b[0] - b.a[0]);
      const hs = house((b.a[0] + b.b[0]) / 2, (b.a[1] + b.b[1]) / 2, a, L, b.w, b.h, b.w * 0.55); walls.push(hs.wall); roofs.push(hs.roof); gables.push(hs.gable);
    }
    // 城門（外堡東側、面向市鎮）
    const gate = add2(CEN, rot([-INNER.upperTip - 4, 0], TIP_ANGLE + Math.PI / 2));
    finishHouses(walls, roofs, gables, 'dutch', 0xe8dfcb, 0x9a4a32);
    // 砲
    const guns = []; for (const p of [...U.top.filter((_, i) => i % 5 === 2), ...L1.top.filter((_, i) => i % 5 === 2)]) { const y = U.top.includes(p) ? 13.5 : 7.5; guns.push(new T.CylinderGeometry(0.22, 0.3, 2.6, 8).rotateZ(Math.PI / 2).rotateY(-Math.atan2(p[1] - CEN[1], p[0] - CEN[0])).translate(p[0], y + 0.9, p[1])); }
    add(merge(guns.map(g => paint(g, 0x2a2826))), std({ vertexColors: true, metalness: 0.6, roughness: 0.5 }));
    void gate; void pole;
    // 烏特勒支堡（湯匙山）
    utrechtHill(true);
  }
  function utrechtHill(withFort) {
    const hill = new T.ConeGeometry(42, 13, 28, 4); const p = hill.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > -6.4) p.setX(i, p.getX(i) * (1 + Math.sin(i) * 0.05)); }
    hill.translate(UTRECHT[0], 6.5, UTRECHT[1]); hill.computeVertexNormals();
    { const uv = hill.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * 2); }
    add(hill, std({ color: k === 'today' ? 0x7c8a5c : 0xcdb98d, map: sandTex, roughness: 0.97 }));
    if (withFort) {
      const b = wet(std({ map: brickTex(0xa0583c, '#b8a68a', 9), roughness: 0.9 }));
      add(new T.BoxGeometry(9, 8, 9).translate(UTRECHT[0], 13 + 4 - 0.5, UTRECHT[1]), b);
      add(wallAlong([[UTRECHT[0] - 4.5, UTRECHT[1] - 4.5], [UTRECHT[0] + 4.5, UTRECHT[1] - 4.5], [UTRECHT[0] + 4.5, UTRECHT[1] + 4.5], [UTRECHT[0] - 4.5, UTRECHT[1] + 4.5]], 1, 0.6, 16.5, true, 0.5), b);
    }
  }
  // ── 1871 殘牆 ──
  function ruins() {
    const brick = wet(std({ map: brickTex(0xa8836a, '#b3a890', 6, 1), roughness: 0.95 }));
    // 沙丘（下層主堡舊址）
    const mound = prism(bastioned(30, 18, 2, 56), 0, 6.5, 9, 6); const sand = std({ color: 0xd7c7a1, map: sandTex, roughness: 0.98 });
    jitter(mound.walls, 1.4, 3); add(mound.walls, sand); add(mound.cap, sand);
    // 殘牆：沿上層主堡輪廓留下不連續、頂部參差的牆段，加上一座拱門
    const up = bastioned(INNER.upperHalf, 8, 4, INNER.upperTip), segs = [];
    for (let i = 0; i < up.length; i++) {
      if (r() < 0.45) continue; const a = up[i], b = up[(i + 1) % up.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 3) continue;
      const n = Math.max(1, Math.round(L / 3)), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      for (let s = 0; s < n; s++) { if (r() < 0.25) continue; const t0 = (s + 0.5) / n, h = 2 + r() * 7.5; const g = new T.BoxGeometry(L / n + 0.2, h, 2.2); scaleUV(g, L / n / 4, h / 4); g.translate(0, 6.5 + h / 2 - 0.5, 0); g.rotateY(-ang); g.translate(a[0] + (b[0] - a[0]) * t0, 0, a[1] + (b[1] - a[1]) * t0); segs.push(g); }
    }
    // 湯姆生照片的城門：厚牆中一個圓拱
    const g0 = add2(CEN, rot([INNER.upperHalf + 1, 0], TIP_ANGLE + Math.PI / 4 - Math.PI / 2));
    const arch = new T.Shape([new T.Vector2(-5, 0), new T.Vector2(5, 0), new T.Vector2(5, 9), new T.Vector2(-5, 9)]); const hole = new T.Path(); hole.moveTo(-1.6, 0); hole.lineTo(-1.6, 3.2); hole.absarc(0, 3.2, 1.6, Math.PI, 0, true); hole.lineTo(1.6, 0); arch.holes.push(hole);
    const ag = new T.ExtrudeGeometry(arch, { depth: 3, bevelEnabled: false }); scaleUV(ag, 1 / 4, 1 / 4); ag.translate(0, 6, -1.5); ag.rotateY(-(TIP_ANGLE + Math.PI / 4)); ag.translate(g0[0], 0, g0[1]); segs.push(ag);
    add(merge(segs), brick);
    // 外堡殘段（南牆）
    add(wallAlong([OUTER[8], OUTER[7]], 4, 2, 0, false), brick);
    // 茅草屋
    const walls = [], roofs = [], gables = [];
    for (let i = 0; i < 16; i++) { const a = r() * 6.28, d = 60 + r() * 60, c = add2(CEN, [Math.cos(a) * d, Math.sin(a) * d]); if (!inside(c, SHORE)) continue; const hs = house(c[0], c[1], r() * 3, 7 + r() * 3, 4.5, 2.6, 2.4); walls.push(hs.wall); roofs.push(hs.roof); gables.push(hs.gable); }
    finishHouses(walls, roofs, gables, 'thatch', 0xb9a888, 0x8f7a55);
    // 菜園：低矮田埂
    for (let i = 0; i < 6; i++) { const c = add2(CEN, [-40 + r() * 80, 60 + r() * 50]); const f = new T.PlaneGeometry(26, 16).rotateX(-Math.PI / 2).rotateY(r() * 3).translate(c[0], 0.03, c[1]); add(f, std({ color: 0x8d8a55, roughness: 1 }), false); }
    utrechtHill(false);
  }
  // ── 1935／今日 平臺 ──
  function platform() {
    const pf = osm?.find(w => w[0] === 'b1' && !w[1] && w[2].length > 15)?.[2] || bastioned(26, 10, 3, 40);
    const H = 5.5, today = k === 'today';
    const brick = wet(std({ map: brickTex(today ? 0x9b4a34 : 0x8e4f3a, '#c2b49a', 8), roughness: 0.88 }));
    const P = prism(pf, 0, H, 0.6, 3); add(P.walls, brick); add(P.cap, std({ color: today ? 0x9aa08a : 0xb6a37f, map: sandTex, roughness: 0.95 }));
    add(wallAlong(P.top, 1.0, 0.45, H, true), std({ color: today ? 0xe9e4d8 : 0xd8d0bf, roughness: 0.8 }));
    solids.push({ poly: pf, h: H });
    // 東側臺階（往老街）
    const c = centroid(pf); let east = pf.reduce((a, p) => p[0] > a[0] ? p : a, pf[0]);
    const stair = []; for (let i = 0; i < 22; i++) { const g = new T.BoxGeometry(0.32, (i + 1) * H / 22, 9); g.translate(east[0] + 6.6 - i * 0.32, (i + 1) * H / 44, east[1]); stair.push(paint(g, today ? 0xa65a42 : 0x9a8f7c)); }
    add(merge(stair), std({ vertexColors: true, roughness: 0.85 }));
    // 洋樓（OSM 安平古堡文物陳列館外框）
    const hallPts = osm?.find(w => w[1] === '安平古堡文物陳列館')?.[2]; const hb = hallPts ? obb(hallPts) : { cx: c[0] + 6, cz: c[1] + 4, len: 20, wid: 14, ang: 0 };
    const hs = house(hb.cx, hb.cz, hb.ang, hb.len, hb.wid, 6.2, 3.4, 0.9);
    const hallWall = wet(std({ map: today ? plasterTex : brickTex(0xa4553c, '#d6cbb4', 12), color: today ? 0xf1ede4 : 0xffffff }));
    add(hs.wall.translate(0, H, 0), hallWall); add(hs.roof.translate(0, H, 0), wet(std({ map: roofTex(today ? 0x8a3a2b : 0x6b4a3d, 14), roughness: 0.75 }))); add(hs.gable.translate(0, H, 0), hallWall);
    // 迴廊柱列
    const cols = []; for (let s = -hb.len / 2 + 1; s <= hb.len / 2 - 1; s += 2.6) for (const side of [-1, 1]) { const x = hb.cx + Math.cos(hb.ang) * s - Math.sin(hb.ang) * side * (hb.wid / 2 + 0.6), z = hb.cz + Math.sin(hb.ang) * s + Math.cos(hb.ang) * side * (hb.wid / 2 + 0.6); cols.push(new T.CylinderGeometry(0.22, 0.25, 6.2, 8).translate(x, H + 3.1, z)); }
    add(merge(cols.map(g => paint(g, 0xf3efe6))), std({ vertexColors: true }));
    // 燈塔（1935）或瞭望臺（今日）：放在平臺西北角
    const nw = pf.reduce((a, p) => (p[0] + p[1]) < (a[0] + a[1]) ? p : a, pf[0]); const tw = [nw[0] * 0.75 + c[0] * 0.25, nw[1] * 0.75 + c[1] * 0.25];
    const white = std({ color: 0xf2f0ea, roughness: 0.7 });
    if (today) {
      add(new T.CylinderGeometry(3.6, 3.9, 12, 8).translate(tw[0], H + 6, tw[1]), white);
      add(new T.CylinderGeometry(4.3, 4.3, 0.5, 8).translate(tw[0], H + 12, tw[1]), white);
      const lantern = add(new T.CylinderGeometry(3.4, 3.4, 2.6, 8).translate(tw[0], H + 13.5, tw[1]), std({ color: 0x40545c, metalness: 0.4, roughness: 0.2, emissive: 0xffd9a0, emissiveIntensity: 0 }));
      nightMats.push({ m: lantern.material, k: 0.9, kind: 'lamp' });
      add(new T.ConeGeometry(5.4, 3.6, 8).translate(tw[0], H + 16.6, tw[1]), wet(std({ color: 0xa23a2a, roughness: 0.6 })));
    } else {
      add(new T.CylinderGeometry(1.7, 2.1, 10, 14).translate(tw[0], H + 5, tw[1]), white);
      add(new T.CylinderGeometry(2.3, 2.3, 0.4, 14).translate(tw[0], H + 10.2, tw[1]), std({ color: 0x2c2c2a }));
      const lamp = add(new T.CylinderGeometry(1.3, 1.3, 1.8, 12).translate(tw[0], H + 11.3, tw[1]), std({ color: 0xe8efe8, metalness: 0.2, roughness: 0.15, emissive: 0xfff0c0, emissiveIntensity: 0 }));
      nightMats.push({ m: lamp.material, k: 2.4, kind: 'lamp' });
      add(new T.ConeGeometry(1.5, 1.3, 12).translate(tw[0], H + 12.8, tw[1]), std({ color: 0x2c2c2a, metalness: 0.5 }));
    }
    solids.push({ circle: [tw[0], tw[1], 4.5], h: 99 });
    // 外堡南牆殘跡（OSM），今日長滿榕樹
    for (const w of osm || []) if (w[1] === '熱蘭遮城殘跡' && w[2].length > 1) {
      add(wallAlong(w[2], today ? 6 : 6.5, 2.3, 0, false), wet(std({ map: brickTex(0x7d4a36, '#8e8670', 15, 1), roughness: 0.95 })));
      if (today) for (let i = 0; i < 3; i++) { const t = (i + 0.5) / 3, a = w[2][0], b = w[2][w[2].length - 1]; treeAt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + 4, 'banyan', 1.3); }
    }
    // 鄭成功像（今日）
    if (today) { const s = osm?.find(w => w[1] === '鄭成功雕像')?.[2][0]; if (s) { add(new T.BoxGeometry(2.4, 2.2, 2.4).translate(s[0], 1.1, s[1]), std({ color: 0x9d9a92 })); add(new T.CylinderGeometry(0.45, 0.6, 2.6, 8).translate(s[0], 3.5, s[1]), std({ color: 0x5b5a4a, metalness: 0.6, roughness: 0.4 })); add(new T.SphereGeometry(0.35, 8, 6).translate(s[0], 5.1, s[1]), std({ color: 0x5b5a4a, metalness: 0.6 })); } }
  }
  // ── 1644 大員市鎮 ──
  function dutchTown() {
    const walls = [], roofs = [], gables = [];
    for (const b of [...BLOCKS]) {
      const o = obb(b.pts), ca = Math.cos(o.ang), sa = Math.sin(o.ang), lotW = 5.5 + r() * 1.5, depth = Math.min(13, o.wid / 2);
      for (const side of [-1, 1]) for (let s = -o.len / 2 + lotW / 2; s < o.len / 2; s += lotW) {
        const v = side * (o.wid / 2 - depth / 2), x = o.cx + ca * s - sa * v, z = o.cz + sa * s + ca * v;
        if (!inside([x, z], b.pts)) continue;
        const h = 3.8 + (r() < 0.3 ? 3.2 : 0), hs = house(x, z, o.ang + Math.PI / 2, depth, lotW - 0.3, h, 2.6 + r() * 0.6);
        walls.push(hs.wall); roofs.push(hs.roof); gables.push(hs.gable);
      }
      // 街廓兩端（短邊）也排屋
      for (const end of [-1, 1]) { const u = end * (o.len / 2 - 4), x = o.cx + ca * u, z = o.cz + sa * u; if (!inside([x, z], b.pts) || o.wid < 18) continue; const hs = house(x, z, o.ang, 7, Math.max(6, o.wid - 2 * depth - 1), 4, 2.4); walls.push(hs.wall); roofs.push(hs.roof); gables.push(hs.gable); }
    }
    for (const c of CIVIC) { const o = obb(c.pts); const hs = house(o.cx, o.cz, o.ang, o.len, o.wid, c.h, o.wid * 0.45); walls.push(hs.wall); roofs.push(hs.roof); gables.push(hs.gable); }
    finishHouses(walls, roofs, gables, 'dutch', 0xece4d2, 0xa04e34);
    // 街道：沙土（街廓之間已是空地，只在城東廣場鋪碎石）
    const sq = new T.CircleGeometry(38, 24).rotateX(-Math.PI / 2).translate(CEN[0] + 115, 0.02, CEN[1] + 5); add(sq, std({ color: 0xbfae8a, map: sandTex, roughness: 0.95 }), false);
  }
  // ── OSM 街屋（1871 閩式、1935 日治、今日）──
  function townFromOSM() {
    const walls = [], roofs = [], gables = [], flats = [], flatWalls = [];
    const fortPoly = osm?.find(w => w[0] === 'lvil' && w[1] === '安平古堡')?.[2] || [];
    const blds = (osm || []).filter(w => w[0][0] === 'b' && w[2].length > 3 && !w[1].includes('古堡') && !(w[0] === 'b1' && !w[1] && w[2].length > 15));
    for (const w of blds) {
      const pts = w[2].slice(0, -1), o = obb(pts), c = [o.cx, o.cz];
      if (o.len * o.wid < 12 || o.len > 90) continue;
      if (k !== 'today' && (Math.hypot(c[0] - 230, c[1] - 90) > 260 || inside(c, fortPoly))) continue;   // 舊時代只保留老街一帶
      const lv = +w[0].slice(1) || (k === 'today' ? 2 + (r() < 0.4 ? 1 : 0) : 1);
      if (k === 'today' && lv >= 2 && o.len * o.wid > 60) {   // 現代平頂樓房
        const h = lv * 3.3; flatWalls.push(prism(pts, 0, h, 0, 4, false).walls); const cap = new T.ShapeGeometry(new T.Shape(pts.map(([x, z]) => new T.Vector2(x, -z)))); cap.rotateX(-Math.PI / 2); cap.translate(0, h, 0); flats.push(cap);
      } else {
        const temple = /宮|殿|廟|亭/.test(w[1]);
        const hs = house(o.cx, o.cz, o.ang, o.len, o.wid, k === 'today' ? 3.4 * Math.max(1, lv) : 3.4, temple ? 3.4 : Math.min(3, o.wid * 0.35)); walls.push(hs.wall); roofs.push(hs.roof); gables.push(hs.gable);
      }
    }
    // OSM 在老街一帶建物稀疏：沿延平街補街屋（示意）
    const yp = osm?.filter(w => w[1] === '延平街').flatMap(w => w[2]) || [];
    for (let i = 0; i < yp.length - 1; i++) {
      const a = yp[i], b = yp[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      for (let s = 3; s < L - 2; s += 4.6) for (const side of [-1, 1]) {
        const x = a[0] + (b[0] - a[0]) * s / L - Math.sin(ang) * side * 8.5, z = a[1] + (b[1] - a[1]) * s / L + Math.cos(ang) * side * 8.5;
        if (blds.some(w => inside([x, z], w[2]))) continue;
        const h = k === 'today' ? 3.4 * (1 + (r() < 0.5)) : 3.4, hs = house(x, z, ang + Math.PI / 2, 11, 4.2, h, 2.2); walls.push(hs.wall); roofs.push(hs.roof); gables.push(hs.gable);
      }
    }
    const kind = k === 'ruin' ? 'minnan' : k === 'japan' ? 'minnan' : 'shop';
    finishHouses(walls, roofs, gables, kind, k === 'today' ? 0xe7e1d6 : 0xd9cdb8, k === 'today' ? 0x9a5040 : 0x8b4b38);
    if (flats.length) {
      const m = std({ map: facadeTex('modern'), color: 0xe9e6df, emissive: 0xffffff, emissiveMap: nightTex([36, 60, 184, 116], 7), emissiveIntensity: 0, roughness: 0.75 }); wet(m); nightMats.push({ m, k: 0.8, kind: 'window' });
      add(merge(flatWalls), m); add(merge(flats), std({ color: 0xb8b4aa, roughness: 0.9 }));
    }
    if (k === 'today') temple();
  }
  function temple() {
    const t = osm?.find(w => w[1] === '安平開臺天后宮'); if (!t) return; const o = obb(t[2].slice(0, -1));
    const hs = house(o.cx, o.cz, o.ang, o.len, o.wid, 6, 3); add(hs.wall, std({ color: 0xb8402e })); add(hs.gable, std({ color: 0xb8402e }));
    add(hs.roof, wet(std({ map: roofTex(0xc98a3a, 17), roughness: 0.55 })));
    // 燕尾脊
    const ridge = new T.BoxGeometry(o.len + 3, 0.5, 0.6).translate(0, 9.2, 0).rotateY(-o.ang).translate(o.cx, 0, o.cz); add(ridge, std({ color: 0x2f6b5a }));
  }
  function finishHouses(walls, roofs, gables, kind, wallCol, roofCol) {
    if (!walls.length) return;
    const nightRect = kind === 'dutch' ? [92, 70, 72, 96] : kind === 'shop' ? [40, 54, 176, 120] : [100, 92, 56, 70];
    const wm = std({ map: kind === 'thatch' ? plasterTex : facadeTex(kind), color: wallCol, emissive: 0xffffff, emissiveMap: nightTex(nightRect, kind.length), emissiveIntensity: 0, roughness: 0.9 });
    if (kind !== 'thatch') nightMats.push({ m: wm, k: kind === 'shop' ? 1.1 : 0.7, kind: 'window' });
    wet(wm); add(merge(walls), wm);
    add(merge(gables), wet(std({ map: plasterTex, color: wallCol, roughness: 0.92 })));
    const rm = wet(std({ map: roofTex(roofCol, kind.length * 7, kind === 'thatch' ? 'thatch' : 'tile'), roughness: kind === 'thatch' ? 1 : 0.78, side: T.DoubleSide })); add(merge(roofs), rm);
    if (kind === 'shop') shopSigns(walls.length);
  }
  function shopSigns() {
    const kinds = ['蝦餅', '蜜餞', '豆花', '劍獅', '伴手禮', '蚵仔煎', '冰品', '茶飲'];
    const yp = osm?.filter(w => w[1] === '延平街').flatMap(w => w[2]) || []; if (yp.length < 2) return;
    const mats = kinds.map(t => std({ map: signTexture(t, { w: 256, h: 96, fg: '#fff8e8', bg: ['#9b2b22', '#1f4d7a', '#3d6b3a', '#7a4a1f'][t.length % 4], font: '900 64px sans-serif' }), emissive: 0xffffff, emissiveIntensity: 0 }));
    mats.forEach(m => { m.emissiveMap = m.map; nightMats.push({ m, k: 0.45, kind: 'sign' }); });
    for (let i = 0; i < yp.length - 1; i++) { const a = yp[i], b = yp[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      for (let s = 4; s < L - 3; s += 9) for (const side of [-1, 1]) { const x = a[0] + (b[0] - a[0]) * s / L - Math.sin(ang) * side * 3.2, z = a[1] + (b[1] - a[1]) * s / L + Math.cos(ang) * side * 3.2;
        const m = new T.Mesh(new T.PlaneGeometry(2.6, 0.95), mats[(r() * mats.length) | 0]); m.position.set(x, 3.1, z); m.rotation.y = -ang + (side > 0 ? Math.PI : 0); group.add(m); } }
  }
  function roads() {
    if (!osm) return;
    const mat = k === 'today' ? wet(std({ color: 0x55585a, roughness: 0.82 })) : std({ color: k === 'japan' ? 0xb5a585 : 0xbfae8a, roughness: 0.98 });
    const gs = [];
    for (const [kk, name, pts] of osm) {
      if (kk[0] !== 'h' || pts.length < 2) continue; const cls = +kk[1];
      if (k !== 'today' && !(name === '延平街' || name === '古堡街' || name === '國勝路' || (k === 'japan' && (name === '安平路' || name === '運河路')))) continue;
      if (cls >= 8 && k !== 'today') continue;
      const w = name === '延平街' ? (k === 'today' ? 7 : 5) : cls <= 3 ? 12 : cls === 4 ? 8 : cls <= 6 ? 5 : 3; gs.push(ribbon(pts, w, 0.03 + (cls <= 3 ? 0.01 : 0), 10));
    }
    const m = add(merge(gs), mat, false);
    // 延平街鋪面（今日：紅磚）
    if (k === 'today') { const yp = osm.filter(w => w[1] === '延平街'); add(merge(yp.map(w => ribbon(w[2], 6.4, 0.05, 6))), wet(std({ map: brickTex(0x9a5a44, '#8f8576', 18), roughness: 0.85 })), false); }
    void m;
  }
  function waters() {   // 臺南運河（1926）與安平港：OSM 水域多邊形
    const mat = new T.MeshPhysicalMaterial({ color: 0x3c5f5c, roughness: 0.1, normalMap: waveNormal, normalScale: new T.Vector2(0.2, 0.2) });
    const gs = [];
    for (const w of osm || []) if (w[0] === 'W' && /運河|安平港/.test(w[1]) && w[2].length > 3) { const g = new T.ShapeGeometry(new T.Shape(w[2].map(([x, z]) => new T.Vector2(x, -z)))); g.rotateX(-Math.PI / 2); g.translate(0, 0.06, 0); gs.push(g); }
    if (gs.length) add(merge(gs), mat, false);
  }
  function treeAt(x, z, kind = 'banyan', s = 1) { trees.push(new T.Matrix4().compose(new T.Vector3(x, groundY(x, z), z), new T.Quaternion().setFromEuler(new T.Euler(0, r() * 6.28, 0)), new T.Vector3(s, s * (0.85 + r() * 0.3), s))); }
  function vegetation() {
    const n = k === 'dutch' ? 25 : k === 'ruin' ? 40 : 70;
    for (let i = 0; i < n; i++) { const x = -150 + r() * 600, z = -120 + r() * 330; if (!inside([x, z], landShape) || nearBuilding(x, z)) continue; treeAt(x, z, 'banyan', 0.8 + r() * 0.7); }
    if (trees.length) { const im = new T.InstancedMesh(treeGeo(5), std({ vertexColors: true, roughness: 0.9 }), trees.length); trees.forEach((m, i) => im.setMatrixAt(i, m)); shade(im); group.add(im); }
  }
  function nearBuilding(x, z) {
    if (Math.hypot(x - CEN[0], z - CEN[1]) < 75) return true;
    if (k === 'dutch') return BLOCKS.some(b => inside([x, z], b.pts)) || inside([x, z], OUTER);
    return (osm || []).some(w => (w[0][0] === 'b' || w[0][0] === 'h') && w[2].some(p => Math.abs(p[0] - x) < 9 && Math.abs(p[1] - z) < 9));
  }
  function groundY() { return 0; }
  function people() {
    const n = k === 'today' ? 160 : k === 'dutch' ? 90 : 50, mats = [];
    const cols = k === 'dutch' ? [0x2b2b30, 0x5b3a2a, 0x2f3d5a, 0xd8cfb8, 0x6a5b45] : k === 'today' ? [0xe8e2d2, 0x2b4d78, 0xb53a3a, 0x303030, 0xf0c860, 0x6aa0c8] : [0xd8cfb8, 0x3a3a38, 0x6a5b45];
    const spots = k === 'dutch' ? BLOCKS.map(b => centroid(b.pts)).concat([[CEN[0] + 115, CEN[1] + 5]]) : (osm?.filter(w => w[1] === '延平街' || w[1] === '古堡街').flatMap(w => w[2]) || [[100, 80]]);
    const walkers = [];
    for (let i = 0; i < n; i++) { const s = spots[(r() * spots.length) | 0]; const p = [s[0] + (r() - 0.5) * 16, s[1] + (r() - 0.5) * 16]; if (k === 'dutch' && BLOCKS.some(b => inside(p, b.pts))) continue; walkers.push({ x: p[0], z: p[1], a: r() * 6.28, v: 0.6 + r() * 0.8, ox: p[0], oz: p[1] }); }
    const im = new T.InstancedMesh(personGeo(), std({ vertexColors: true, roughness: 0.8 }), walkers.length); walkers.forEach((w, i) => im.setColorAt(i, new T.Color(cols[i % cols.length]))); shade(im); group.add(im);
    const m4 = new T.Matrix4(), q = new T.Quaternion(), one = new T.Vector3(1, 1, 1);
    movers.push(dt => { walkers.forEach((w, i) => { w.x += Math.cos(w.a) * w.v * dt; w.z += Math.sin(w.a) * w.v * dt; if (Math.hypot(w.x - w.ox, w.z - w.oz) > 12) w.a += Math.PI; q.setFromEuler(new T.Euler(0, -w.a + Math.PI / 2, 0)); m4.compose(new T.Vector3(w.x, 0, w.z), q, one); im.setMatrixAt(i, m4); }); im.instanceMatrix.needsUpdate = true; });
    void mats;
  }
  function ships() {
    const list = k === 'dutch' ? [['fluyt', -150, -150, 0.4], ['fluyt', -210, -60, 1.2], ['fluyt', -95, -235, 2.4], ['junk', -60, -170, 0.9], ['junk', 30, -150, 2.0], ['junk', 180, -120, 1.5], ['sampan', -40, -120, 0.2], ['sampan', 60, -125, 1.1]]
      : k === 'ruin' ? [['junk', -170, -120, 0.7], ['sampan', -90, -140, 1.4], ['raft', -60, -110, 0.3]]
      : k === 'japan' ? [['raft', 220, 334, 0.02], ['raft', 330, 336, 3.1], ['sampan', 450, 334, 0.05], ['raft', -120, -240, 1.6]]
      : [['boat', 260, 335, 0.02], ['boat', 400, 336, 3.12], ['boat', -100, -260, 1.0]];
    for (const [kind, x, z, a] of list) {
      if ((k === 'dutch' || k === 'ruin') && inside([x, z], landShape)) continue;
      const m = new T.Mesh(shipGeo(kind), std({ vertexColors: true, roughness: 0.8 })); m.position.set(x, -0.6, z); m.rotation.y = a; shade(m); group.add(m);
      const ph = r() * 6; movers.push((dt, t) => { m.position.y = -0.6 + Math.sin(t * 0.8 + ph) * 0.18; m.rotation.z = Math.sin(t * 0.6 + ph) * 0.02; });
    }
  }
}
const trees = []; // 由 buildEra 每次重設
function add2(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
function scaleUV(g, su, sv) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return g; }
function jitter(g, amt, seed) { const r = rng(seed), p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.5) p.setY(i, p.getY(i) + (r() - 0.5) * amt); g.computeVertexNormals(); }
// 現代陸地：以 OSM 海岸線與港區範圍外推的大矩形，扣掉海（簡化：陸地涵蓋整個範圍，海面在其下）
function modernLand() { return [[-260, -200], [720, -200], [720, 430], [-260, 430]]; }
export const inPoly = inside;
