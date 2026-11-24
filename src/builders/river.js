import * as THREE from 'three';
import { hash01 } from '../geo.js';

// 綠川／柳川：下凹約 3 公尺的河道。
// 1935：卵石斜坡護岸、岸頂樹籬、兩岸垂柳；現今：混凝土護岸＋步道平台、金屬欄杆。
// 暗渠（culvert）段就是橋：橋面延續街道，兩端立石欄杆與圓球柱頭（新盛橋、櫻橋的樣式）。
export const RIVER = { top: 12, bottom: 7.5, depth: 3.2 };
const widthOf = w => (w.tags.name === '柳川' ? { top: 11, bottom: 6.5 } : { top: RIVER.top, bottom: RIVER.bottom });

let maskCache = null;
// 河道遮罩：地面、人行道、公園在這裡挖空，露出下凹的河道
export function riverMask(base) {
  if (maskCache) return maskCache;
  const open = base.waterways.filter(w => !w.tags.tunnel);
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
  for (const w of open) for (const [x, z] of w.line) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  x0 -= 20; z0 -= 20; x1 += 20; z1 += 20;
  const S = 2048; const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S); g.strokeStyle = '#fff'; g.lineCap = 'butt'; g.lineJoin = 'round';
  const sx = S / (x1 - x0), sz = S / (z1 - z0);
  for (const w of open) {
    g.lineWidth = widthOf(w).top * Math.max(sx, sz);
    g.beginPath(); w.line.forEach(([x, z], i) => (i ? g.lineTo : g.moveTo).call(g, (x - x0) * sx, (z - z0) * sz)); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.NoColorSpace; tex.flipY = false; tex.generateMipmaps = false; tex.minFilter = tex.magFilter = THREE.LinearFilter;
  maskCache = { tex, bounds: new THREE.Vector4(x0, z0, x1 - x0, z1 - z0) };
  return maskCache;
}
// 讓材質在河道遮罩內不畫（discard）
export function carve(material, mask) {
  material.onBeforeCompile = sh => {
    sh.uniforms.riverMask = { value: mask.tex }; sh.uniforms.riverBounds = { value: mask.bounds };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCarveW;').replace('#include <project_vertex>', '#include <project_vertex>\nvCarveW = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vCarveW; uniform sampler2D riverMask; uniform vec4 riverBounds;')
      .replace('void main() {', 'void main() {\n vec2 cuv = (vCarveW.xz - riverBounds.xy) / riverBounds.zw; if (cuv.x > 0.0 && cuv.x < 1.0 && cuv.y > 0.0 && cuv.y < 1.0 && texture2D(riverMask, cuv).r > 0.5) discard;');
  };
  material.customProgramCacheKey = () => 'carve';
  return material;
}

function offset(line, d) {
  return line.map((p, i) => { const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)]; let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; return [p[0] - (tz / l) * d, p[1] + (tx / l) * d]; });
}
function cv(w, h, f) { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; }
const cobble = () => cv(256, 128, (x, w, h) => { x.fillStyle = '#6d6a5e'; x.fillRect(0, 0, w, h); for (let k = 0; k < 260; k++) { const r = 5 + Math.random() * 7; x.fillStyle = `hsl(${40 + Math.random() * 20},${8 + Math.random() * 10}%,${38 + Math.random() * 25}%)`; x.beginPath(); x.ellipse(Math.random() * w, Math.random() * h, r, r * 0.75, Math.random() * 3, 0, 7); x.fill(); } for (let k = 0; k < 120; k++) { x.fillStyle = `rgba(70,100,40,${Math.random() * 0.5})`; x.fillRect(Math.random() * w, Math.random() * h * 0.5, 4, 3); } });
const concrete = () => cv(256, 128, (x, w, h) => { x.fillStyle = '#9d9a92'; x.fillRect(0, 0, w, h); for (let j = 0; j < h; j += 32) { x.fillStyle = 'rgba(0,0,0,0.2)'; x.fillRect(0, j, w, 2); } for (let k = 0; k < 3000; k++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } x.fillStyle = 'rgba(40,60,30,0.35)'; x.fillRect(0, h - 18, w, 18); });

// 一條「牆帶」：上緣 line 偏移 dTop、高度 yTop；下緣偏移 dBot、高度 yBot
function band(pos, uv, line, dTop, yTop, dBot, yBot, vScale = 4) {
  const A = offset(line, dTop), B = offset(line, dBot); let dist = 0;
  for (let i = 1; i < line.length; i++) {
    const l = Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
    const u0 = dist / vScale, u1 = (dist + l) / vScale; dist += l;
    const a0 = [A[i - 1][0], yTop, A[i - 1][1]], a1 = [A[i][0], yTop, A[i][1]], b0 = [B[i - 1][0], yBot, B[i - 1][1]], b1 = [B[i][0], yBot, B[i][1]];
    pos.push(...a0, ...b0, ...a1, ...a1, ...b0, ...b1); uv.push(u0, 1, u0, 0, u1, 1, u1, 1, u0, 0, u1, 0);
  }
}
function segX(p1, p2, p3, p4) { // 兩線段交點
  const d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]); if (Math.abs(d) < 1e-9) return null;
  const t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d, u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])] : null;
}
function geo(pos, uv) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g; }

export function buildRiver(base, era, opts = {}) {
  const old = era.id === '1935';
  const group = new THREE.Group(); group.name = 'river';
  const open = base.waterways.filter(w => !w.tags.tunnel && w.line.length > 1);
  const wallPos = [], wallUv = [], waterPos = [], waterUv = [], hedgePos = [], hedgeUv = [], terPos = [], terUv = [];
  const D = RIVER.depth, ends = [];
  for (const w of open) {
    const { top, bottom } = widthOf(w); const t = top / 2, b = bottom / 2;
    for (const s of [-1, 1]) {
      if (old) band(wallPos, wallUv, w.line, s * t, 0, s * b, -D); // 斜坡卵石護岸
      else { // 現今：垂直護岸 + 親水平台 + 下層護岸
        band(wallPos, wallUv, w.line, s * t, 0, s * t, -1.6);
        band(terPos, terUv, w.line, s * t, -1.6, s * (b + 0.6), -1.6, 3);
        band(wallPos, wallUv, w.line, s * (b + 0.6), -1.6, s * b, -D);
      }
      if (old) { band(hedgePos, hedgeUv, w.line, s * (t + 0.2), 1.1, s * (t + 0.2), 0, 3); band(hedgePos, hedgeUv, w.line, s * (t + 1.3), 1.1, s * (t + 0.2), 1.1, 3); band(hedgePos, hedgeUv, w.line, s * (t + 1.3), 0, s * (t + 1.3), 1.1, 3); }
    }
    band(waterPos, waterUv, w.line, -b - 0.3, -D + 0.55, b + 0.3, -D + 0.55, 10);
    ends.push({ p: w.line[0], q: w.line[1], top }, { p: w.line[w.line.length - 1], q: w.line[w.line.length - 2], top });
  }
  const wallMat = new THREE.MeshStandardMaterial({ map: old ? cobble() : concrete(), roughness: 0.95, side: THREE.DoubleSide });
  const walls = new THREE.Mesh(geo(wallPos, wallUv), wallMat); walls.receiveShadow = true; group.add(walls);
  if (terPos.length) { const tm = new THREE.MeshStandardMaterial({ color: 0xb9b2a4, roughness: 0.9, side: THREE.DoubleSide }); const ter = new THREE.Mesh(geo(terPos, terUv), tm); ter.receiveShadow = true; group.add(ter); }
  const waterMat = new THREE.MeshStandardMaterial({ color: old ? 0x2f4a3a : 0x2a4342, roughness: 0.05, metalness: 0.1, envMapIntensity: 0.3, side: THREE.DoubleSide });
  waterMat.userData.water = true;
  group.add(new THREE.Mesh(geo(waterPos, waterUv), waterMat));
  // 河床（水面下的深色底）
  if (hedgePos.length) { const hm = new THREE.MeshStandardMaterial({ color: 0x3d5e2a, roughness: 1, side: THREE.DoubleSide }); const he = new THREE.Mesh(geo(hedgePos, hedgeUv), hm); he.castShadow = he.receiveShadow = true; group.add(he); }
  // 河道兩端（暗渠口）擋牆 + 欄杆
  const endPos = [], endUv = [];
  const rails = []; // {x,z,ax,az,len}：中心、長軸方向、長度
  for (const e of ends) {
    const dx = e.q[0] - e.p[0], dz = e.q[1] - e.p[1], l = Math.hypot(dx, dz) || 1; const nx = -dz / l, nz = dx / l; const h = e.top / 2 + 0.1;
    const A = [e.p[0] + nx * h, e.p[1] + nz * h], B = [e.p[0] - nx * h, e.p[1] - nz * h];
    endPos.push(A[0], 0, A[1], B[0], 0, B[1], A[0], -D, A[1], A[0], -D, A[1], B[0], 0, B[1], B[0], -D, B[1]); endUv.push(0, 1, 3, 1, 0, 0, 0, 0, 3, 1, 3, 0);
    rails.push({ x: e.p[0] - dx / l * 0.3, z: e.p[1] - dz / l * 0.3, ax: nx, az: nz, len: e.top + 2 });
  }
  group.add(new THREE.Mesh(geo(endPos, endUv), wallMat));
  // 跨河的橋：橋身（看得到厚度的石造橋板）＋兩側石欄杆
  const slabs = [];
  if (opts.roads) for (const r of opts.roads) for (let i = 1; i < r.line.length; i++) {
    const a = r.line[i - 1], c = r.line[i];
    for (const w of open) for (let j = 1; j < w.line.length; j++) {
      const hit = segX(a, c, w.line[j - 1], w.line[j]); if (!hit) continue;
      const dx = c[0] - a[0], dz = c[1] - a[1], l = Math.hypot(dx, dz) || 1; const ux = dx / l, uz = dz / l;
      // 橋與河的夾角 → 橋跨長度
      const wx = w.line[j][0] - w.line[j - 1][0], wz = w.line[j][1] - w.line[j - 1][1], wl = Math.hypot(wx, wz) || 1;
      const sin = Math.max(0.35, Math.abs(ux * wz / wl - uz * wx / wl)); const span = widthOf(w).top / sin + 3;
      const rw = Math.max(2, opts.width(r)); const minor = rw < 4;
      slabs.push({ x: hit[0], z: hit[1], ax: ux, az: uz, len: span, w: rw + 1 });
      for (const s of [-1, 1]) rails.push({ x: hit[0] - uz * s * (rw / 2 + 0.3), z: hit[1] + ux * s * (rw / 2 + 0.3), ax: ux, az: uz, len: span, minor });
    }
  }
  const stone = new THREE.MeshStandardMaterial({ color: old ? 0x9c9586 : 0xaaa498, roughness: 0.9 });
  const m = new THREE.Matrix4(), X = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3();
  const place = (im, i, x, y, z, ax, az, sx, sy, sz) => { X.set(ax, 0, az); Z.set(-az, 0, ax); m.makeBasis(X, Y, Z); m.scale(new THREE.Vector3(sx, sy, sz)); m.setPosition(x, y, z); im.setMatrixAt(i, m); };
  if (slabs.length) {
    const sg = new THREE.BoxGeometry(1, 1, 1);
    const sm = new THREE.InstancedMesh(sg, new THREE.MeshStandardMaterial({ color: old ? 0xa9a293 : 0xb7b2a8, roughness: 0.9 }), slabs.length);
    slabs.forEach((b, i) => place(sm, i, b.x, -0.25, b.z, b.ax, b.az, b.len, 1.1, b.w));
    sm.castShadow = sm.receiveShadow = true; group.add(sm);
  }
  // 欄杆：實心石欄＋方柱＋圓球柱頭（新盛橋、櫻橋的樣式）
  const railG = new THREE.BoxGeometry(1, 1, 1); railG.translate(0, 0.5, 0);
  const capG = new THREE.BoxGeometry(1, 0.12, 1); capG.translate(0, 1.0, 0);
  const rm = new THREE.InstancedMesh(railG, stone, rails.length), cm = new THREE.InstancedMesh(capG, stone, rails.length);
  const posts = [];
  rails.forEach((r, i) => {
    const H = r.minor ? 0.95 : 0.9;
    place(rm, i, r.x, 0.3, r.z, r.ax, r.az, r.len, H, 0.35); place(cm, i, r.x, 0.3, r.z, r.ax, r.az, r.len + 0.1, H, 0.5);
    for (const s of [-1, 1]) posts.push([r.x + r.ax * s * r.len / 2, r.z + r.az * s * r.len / 2, r.ax, r.az]);
  });
  rm.castShadow = cm.castShadow = true; group.add(rm, cm);
  const postG = new THREE.BoxGeometry(0.75, 1.4, 0.75); postG.translate(0, 0.7, 0);
  const neckG = new THREE.CylinderGeometry(0.18, 0.28, 0.25, 12); neckG.translate(0, 1.52, 0);
  const ballG = new THREE.SphereGeometry(0.36, 16, 10); ballG.translate(0, 1.95, 0);
  const pm = new THREE.InstancedMesh(postG, stone, posts.length), nm = new THREE.InstancedMesh(neckG, stone, posts.length), bm = new THREE.InstancedMesh(ballG, stone, posts.length);
  posts.forEach(([x, z, ax, az], i) => { for (const im of [pm, nm, bm]) place(im, i, x, 0.3, z, ax, az, 1, 1, 1); });
  pm.castShadow = bm.castShadow = true; group.add(pm, nm, bm);
  // 現今：岸邊金屬欄杆
  if (!old) {
    const rp = [], ru = [];
    for (const w of open) { const t = widthOf(w).top / 2; for (const s of [-1, 1]) band(rp, ru, w.line, s * t, 1.05, s * t, 0.95, 2); }
    group.add(new THREE.Mesh(geo(rp, ru), new THREE.MeshStandardMaterial({ color: 0x55595c, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide })));
  }
  // 垂柳（1935）／行道樹（現今）沿岸
  const trees = [];
  for (const w of open) { const t = widthOf(w).top / 2 + (old ? 2.4 : 2.0); for (const s of [-1, 1]) { const L = offset(w.line, s * t); for (let i = 1; i < L.length; i++) { const a = L[i - 1], b = L[i]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let k = 4; k < l - 2; k += old ? 11 : 12) trees.push([a[0] + (b[0] - a[0]) * k / l, a[1] + (b[1] - a[1]) * k / l]); } } }
  const clear = trees.filter(([x, z]) => !slabs.some(b => Math.hypot(x - b.x, z - b.z) < b.w / 2 + 6) && !ends.some(e => Math.hypot(x - e.p[0], z - e.p[1]) < 7));
  trees.length = 0; trees.push(...clear);
  if (old) group.add(willows(trees));
  group.userData.trees = trees;
  return group;
}

function willows(pts) {
  const g = new THREE.Group();
  const trunkG = new THREE.CylinderGeometry(0.2, 0.35, 5, 6); trunkG.translate(0, 2.5, 0);
  // 垂柳樹冠：上窄下寬、垂到接近地面的鐘形
  const crownG = new THREE.LatheGeometry([new THREE.Vector2(0.1, 7.4), new THREE.Vector2(1.4, 7.1), new THREE.Vector2(2.4, 6.2), new THREE.Vector2(2.8, 4.6), new THREE.Vector2(2.9, 2.6), new THREE.Vector2(2.7, 1.4), new THREE.Vector2(2.2, 1.2)], 10);
  const pos = crownG.attributes.position; for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < 3) pos.setY(i, y + (Math.random() - 0.5) * 1.4); pos.setX(i, pos.getX(i) * (0.9 + Math.random() * 0.2)); } crownG.computeVertexNormals();
  const tr = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x4c3b2a, roughness: 1 }), pts.length);
  const cr = new THREE.InstancedMesh(crownG, new THREE.MeshStandardMaterial({ color: 0x587a34, roughness: 0.95, flatShading: true, side: THREE.DoubleSide }), pts.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  pts.forEach(([x, z], i) => { const r = hash01(Math.round(x * 31 + z * 7), 4); e.set(0, r * 6.28, 0); q.setFromEuler(e); v.set(x, 0, z); const k = 0.75 + r * 0.3; s.set(k, k, k); m.compose(v, q, s); tr.setMatrixAt(i, m); cr.setMatrixAt(i, m); c.setRGB(0.85 + r * 0.3, 0.9 + r * 0.2, 0.8 + r * 0.2); cr.setColorAt(i, c); });
  tr.castShadow = cr.castShadow = true; cr.receiveShadow = true; g.add(tr, cr); return g;
}
