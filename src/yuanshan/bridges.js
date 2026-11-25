import * as THREE from 'three';
import { Kit, T, roofGeo } from './kit.js';
import { G } from './materials.js';
import { RAIL, riverInfo } from './geo.js';

const STEEL = { color: '#7d8470', roughness: 0.55, metalness: 0.55 };
const STEEL_DARK = { color: '#4b5248', roughness: 0.6, metalness: 0.5 };
const MASONRY = { color: '#a89c86', roughness: 0.95 };
const GRANITE = { color: '#c4bba8', roughness: 0.82 };
const GRANITE_SH = { color: '#b3a994', roughness: 0.85 };
const DECK = { color: '#8c877c', roughness: 0.9 };
const ASPHALT = { color: '#4a4a4c', roughness: 0.85 };
const CONC = { color: '#b9b7b0', roughness: 0.88 };
const BRONZE = { color: '#3f4a3c', roughness: 0.45, metalness: 0.7 };
const GLOBE = { color: '#fff6e0', emissive: '#ffcf86', emissiveIntensity: 0, roughness: 0.3, lamp: 4 };
const LANTERN = { color: '#fff2d6', emissive: '#ffb25a', emissiveIntensity: 0, roughness: 0.5, lamp: 3.5 };

// 兩點之間的梁
function beam(k, a, b, s, mat) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
  const g = new THREE.BoxGeometry(s, s, L); const m = new THREE.Matrix4().lookAt(A, B, new THREE.Vector3(0, 1, 0));
  m.setPosition(A.clone().add(B).multiplyScalar(0.5)); k.add(g, mat, m);
}

// ======================= 第一代明治橋（1901 鋼桁架橋） =======================
export function buildMeiji1(mask) {
  const k = new Kit(mask, 'meiji-1');
  const Y = 9.6, HW = 3.3;
  const z0 = -46, z1 = 26, N = 10, span = z1 - z0;
  // 桁架
  const top = t => Y + 4.2 + 6.2 * Math.sin(Math.PI * t);
  for (const sx of [-1, 1]) {
    const x = sx * HW;
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N, za = z0 + span * t0, zb = z0 + span * t1;
      beam(k, [x, Y, za], [x, Y, zb], 0.55, STEEL);
      if (i > 0 && i < N - 1) beam(k, [x, top(t0), za], [x, top(t1), zb], 0.6, STEEL);
      if (i > 0) beam(k, [x, Y, za], [x, top(t0), za], 0.35, STEEL);
      // 斜桿朝中央
      if (i < N / 2) beam(k, [x, i === 0 ? Y : top(t0), za], [x, Y, zb], 0.26, STEEL_DARK); else beam(k, [x, Y, za], [x, top(t1), zb], 0.26, STEEL_DARK);
      if (i > 0 && i < N - 1) { if (i < N / 2) beam(k, [x, top(t1), zb], [x, Y + 0.5, za + span / N * 0.5], 0.14, STEEL_DARK); }
    }
    beam(k, [x, Y, z0], [x, top(1 / N), z0 + span / N], 0.65, STEEL);
    beam(k, [x, Y, z1], [x, top(1 - 1 / N), z1 - span / N], 0.65, STEEL);
  }
  // 上橫撐
  for (let i = 1; i < N; i++) { const t = i / N, z = z0 + span * t; beam(k, [-HW, top(t), z], [HW, top(t), z], 0.3, STEEL_DARK); if (i < N - 1) { const t2 = (i + 1) / N, z2 = z0 + span * t2; beam(k, [-HW, top(t), z], [HW, top(t2), z2], 0.15, STEEL_DARK); } }
  // 門型框與匾額「明治橋」
  for (const [zz, t] of [[z0 + span / N, 1 / N], [z1 - span / N, 1 - 1 / N]]) { k.box(5.2, 1.3, 0.25, { color: '#efe8d6', roughness: 0.7 }, 0, top(t) - 1.6, zz); }
  // 橋面與欄杆
  k.box(HW * 2 + 0.6, 0.5, 150, DECK, 0, Y - 0.5, -10);
  for (const sx of [-1, 1]) { k.box(0.12, 1.0, 150, { color: '#3c4038', roughness: 0.6, metalness: 0.5, transparent: true, opacity: 0.9 }, sx * (HW + 0.25), Y, -10); }
  // 引橋鈑梁
  for (const [a, b] of [[z1, 52], [52, 76], [-70, z0], [-86, -70]]) { for (const sx of [-1, 1]) k.box(0.35, 1.3, b - a, STEEL_DARK, sx * HW * 0.8, Y - 1.8, (a + b) / 2); }
  // 石造橋墩（含尖形破水）
  for (const z of [z0, z1, 52, -70]) {
    k.box(9, Y - 1.8 + 6, 4, MASONRY, 0, -6, z);
    k.add(new THREE.CylinderGeometry(2.0, 2.0, Y - 1.8 + 6, 3), MASONRY, T(-5.2, (Y - 1.8 + 6) / 2 - 6, z, Math.PI / 2));
    k.add(new THREE.CylinderGeometry(2.0, 2.0, Y - 1.8 + 6, 3), MASONRY, T(5.2, (Y - 1.8 + 6) / 2 - 6, z, -Math.PI / 2));
  }
  // 橋頭燈柱
  for (const z of [z0 - 1, z1 + 1]) for (const sx of [-1, 1]) { k.cyl(0.12, 0.16, 4.2, BRONZE, sx * (HW + 0.7), Y, z, 8); k.box(0.55, 0.75, 0.55, GLOBE, sx * (HW + 0.7), Y + 4.2, z); k.add(new THREE.ConeGeometry(0.5, 0.4, 4), BRONZE, T(sx * (HW + 0.7), Y + 5.15, z, Math.PI / 4)); k.light(sx * (HW + 0.7), Y + 4.5, z, 9, '#ffd49a'); }
  return k.build();
}

// ======================= 第二代明治橋／中山橋（1933 鋼筋混凝土拱橋） =======================
function archShape(z0, z1, ys, rise, thick, deckY) {
  // 拱環：外拱背 → 內拱腹
  const s = new THREE.Shape(); const n = 36;
  const zc = (z0 + z1) / 2, half = (z1 - z0) / 2;
  const intr = t => { const z = z0 + (z1 - z0) * t; const u = (z - zc) / half; return [z, ys + rise * (1 - u * u) ** 0.85]; };
  for (let i = 0; i <= n; i++) { const [z, y] = intr(i / n); const yy = y + thick * (1 + 0.6 * Math.abs((i / n) * 2 - 1) ** 2); i ? s.lineTo(z, yy) : s.moveTo(z - 0.6, yy - 0.3); }
  for (let i = n; i >= 0; i--) { const [z, y] = intr(i / n); s.lineTo(z, y); }
  s.closePath();
  return { s, intr };
}
function spandrelShape(z0, z1, ys, rise, deckY, openings) {
  const s = new THREE.Shape(); const n = 36; const zc = (z0 + z1) / 2, half = (z1 - z0) / 2;
  s.moveTo(z0 - 2, ys); s.lineTo(z0 - 2, deckY); s.lineTo(z1 + 2, deckY); s.lineTo(z1 + 2, ys);
  for (let i = n; i >= 0; i--) { const z = z0 + (z1 - z0) * i / n; const u = (z - zc) / half; s.lineTo(z, ys + rise * (1 - u * u) ** 0.85 + 1.0); }
  s.closePath();
  // 拱肩開口
  for (const [za, zb] of openings) {
    const uA = Math.max(Math.abs(za - zc), Math.abs(zb - zc)) / half; const yTop = deckY - 1.4, yBot = ys + rise * (1 - uA * uA) ** 0.85 + 2.0;
    if (yTop - yBot < 1.2) continue;
    const h = new THREE.Path(); h.moveTo(za, yBot); h.lineTo(zb, yBot); h.lineTo(zb, yTop - 0.6); h.quadraticCurveTo((za + zb) / 2, yTop + 0.2, za, yTop - 0.6); h.closePath(); s.holes.push(h);
  }
  return s;
}

function pylon(k, x, z, y, h, big) {
  const w = big ? 2.4 : 1.7;
  k.box(w + 0.6, 1.0, w + 0.6, GRANITE_SH, x, y, z);
  k.add(new THREE.BoxGeometry(w, h, w), GRANITE, T(x, y + 1 + h / 2, z));
  for (let i = 1; i < 4; i++) k.box(w + 0.15, 0.18, w + 0.15, GRANITE_SH, x, y + 1 + h * i / 4, z);
  // 燈籠頂（宮燈式）
  const yt = y + 1 + h;
  k.box(w + 0.5, 0.45, w + 0.5, GRANITE_SH, x, yt, z);
  k.box(w * 0.62, 1.4, w * 0.62, LANTERN, x, yt + 0.45, z);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.22, 1.4, 0.22, GRANITE, x + sx * w * 0.33, yt + 0.45, z + sz * w * 0.33);
  k.push(x, yt + 1.85, z); k.add(roofGeo({ W: w * 0.62, D: w * 0.62, H: 0.9, style: 'hip', curve: 1.4, lift: 0.25, thick: 0.18 }), { ...GRANITE_SH, side: 2 }); k.pop();
  k.add(new THREE.SphereGeometry(0.22, 10, 8), GRANITE, T(x, yt + 2.9, z));
  k.light(x, yt + 1, z, big ? 18 : 12);
}

export function buildMeiji2(mask, opts = {}) {
  const k = new Kit(mask, opts.name || 'meiji-2');
  const DY = 10.4, HW = 9.2, ys = -0.6;
  const spans = [[-58, -32, 6.6], [-28, 28, 7.2 - 0.0], [32, 58, 6.6]];
  const rises = [5.4, 8.6, 5.4];
  spans.forEach(([z0, z1], i) => {
    const rise = rises[i];
    const { s } = archShape(z0, z1, ys, rise, 1.1, DY);
    const g = new THREE.ExtrudeGeometry(s, { depth: HW * 2 - 0.4, bevelEnabled: false, curveSegments: 4 }); g.rotateY(Math.PI / 2); g.translate(-HW + 0.2, 0, 0);
    k.add(g, { color: '#7d7566', roughness: 0.95 });
    const op = []; const n = Math.round((z1 - z0) / 4.2); for (let j = 0; j < n; j++) { const a = z0 + j * (z1 - z0) / n + 0.55, b = z0 + (j + 1) * (z1 - z0) / n - 0.55; op.push([a, b]); }
    const sp = spandrelShape(z0, z1, ys, rise, DY - 0.9, op);
    for (const sx of [-1, 1]) { const sg = new THREE.ExtrudeGeometry(sp, { depth: 0.8, bevelEnabled: false, curveSegments: 3 }); sg.rotateY(Math.PI / 2); sg.translate(sx > 0 ? HW - 0.8 : -HW, 0, 0); k.add(sg, GRANITE_SH); }
  });
  // 橋墩
  for (const z of [-30, 30]) { k.box(HW * 2 + 1.2, 9.6, 4.6, GRANITE_SH, 0, -6, z); for (const sx of [-1, 1]) k.add(new THREE.CylinderGeometry(2.3, 2.3, 9.6, 3), GRANITE_SH, T(sx * (HW + 0.9), 2.8, z, sx * -Math.PI / 2)); }
  for (const z of [-62, 62]) k.box(HW * 2 + 2, DY + 2, 8, GRANITE_SH, 0, -2, z);
  // 橋面
  k.box(HW * 2 + 1.2, 1.0, 132, GRANITE, 0, DY - 1.0, 0);
  k.box(HW * 2 + 1.6, 0.45, 132, GRANITE_SH, 0, DY - 1.2, 0); // 簷口線腳
  if (!opts.simple) for (let z = -64; z <= 64; z += 2.2) for (const sx of [-1, 1]) k.box(0.7, 0.5, 0.5, GRANITE_SH, sx * (HW + 0.55), DY - 1.7, z); // 托架
  k.box(HW * 2 - 6, 0.12, 132, opts.asphalt ? ASPHALT : DECK, 0, DY, 0);
  for (const sx of [-1, 1]) k.box(3.0, 0.3, 132, GRANITE_SH, sx * (HW - 1.5), DY, 0);
  // 欄杆：瓶形欄杆
  for (const sx of [-1, 1]) {
    k.box(0.55, 0.3, 132, GRANITE, sx * (HW - 0.1), DY + 1.05, 0);
    k.box(0.6, 0.25, 132, GRANITE_SH, sx * (HW - 0.1), DY + 0.3, 0);
    if (!opts.simple) for (let z = -65.5; z <= 65.5; z += 0.42) k.add(new THREE.CylinderGeometry(0.1, 0.14, 0.75, 6), GRANITE, T(sx * (HW - 0.1), DY + 0.67, z));
    for (let z = -60; z <= 60; z += 8) k.box(0.75, 1.5, 0.75, GRANITE, sx * (HW - 0.1), DY, z);
  }
  // 塔燈：橋墩上四座大塔、兩端四座
  for (const z of [-30, 30]) for (const sx of [-1, 1]) pylon(k, sx * (HW + 0.6), z, DY, 8.5, true);
  for (const z of [-66, 66]) for (const sx of [-1, 1]) pylon(k, sx * (HW + 0.6), z, DY, 4.2, false);
  // 銅製街燈
  if (!opts.simple) for (let z = -48; z <= 48; z += 16) if (Math.abs(z) > 6) for (const sx of [-1, 1]) {
    const x = sx * (HW - 0.4); k.cyl(0.14, 0.2, 5.0, BRONZE, x, DY + 1.2, z, 8);
    for (const dz of [-0.55, 0.55]) k.add(new THREE.SphereGeometry(0.34, 12, 8), GLOBE, T(x, DY + 6.3, z + dz));
    k.box(0.12, 0.12, 1.3, BRONZE, x, DY + 5.95, z);
    k.light(x, DY + 6.3, z, 12, '#ffd49a');
  }
  return k.build();
}

// 舊橋殘影（今日時期）：以金色線描浮現原拱橋輪廓
export function ghostOf(group) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: G.uTime, uAmt: { value: 0 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform float uAmt; varying vec3 vW;
      void main(){ float sweep = smoothstep(0.75, 1.0, sin(vW.z * 0.04 - uTime * 0.8) * 0.5 + 0.5);
        float fl = 0.75 + 0.25 * sin(uTime * 3.0 + vW.y);
        gl_FragColor = vec4(vec3(1.0, 0.8, 0.5) * (0.45 + 1.2 * sweep) * fl * uAmt, 1.0); }`,
  });
  const g = new THREE.Group(); g.name = 'ghost-bridge';
  group.updateMatrixWorld(true);
  group.traverse(o => { if (o.isMesh) { const e = new THREE.EdgesGeometry(o.geometry, 25); const l = new THREE.LineSegments(e, mat); l.renderOrder = 5; g.add(l); } });
  g.userData.mat = mat;
  return g;
}

// ======================= 現代：跨河道路橋與高架 =======================
export function buildModernRoads(mask) {
  const k = new Kit(mask, 'modern-roads');
  // 中山北路新跨河橋（箱型梁）
  k.box(30, 2.4, 180, CONC, 52, 6.2, 0);
  k.box(28, 0.15, 180, ASPHALT, 52, 8.6, 0);
  for (const z of [-60, -20, 20, 60]) k.box(16, 12, 3.4, CONC, 52, -6, z);
  for (const sx of [-1, 1]) k.box(0.4, 1.1, 180, CONC, 52 + sx * 14.8, 8.6, 0);
  // 南岸堤頂高架（東西向）
  const path = [];
  for (let x = -1800; x <= 1800; x += 30) path.push([x, 96 + 30 * Math.sin(x / 600) + (x > 600 ? (x - 600) * 0.06 : 0)]);
  for (let i = 0; i < path.length - 1; i++) {
    const [x0, z0] = path[i], [x1, z1] = path[i + 1]; const L = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0);
    k.add(new THREE.BoxGeometry(22, 1.8, L + 0.5), CONC, T((x0 + x1) / 2, 15, (z0 + z1) / 2, yaw));
    k.add(new THREE.BoxGeometry(21, 0.12, L + 0.5), ASPHALT, T((x0 + x1) / 2, 15.95, (z0 + z1) / 2, yaw));
    for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(0.4, 1.1, L + 0.5), CONC, T((x0 + x1) / 2 + Math.cos(yaw) * s * 10.8, 16.4, (z0 + z1) / 2 - Math.sin(yaw) * s * 10.8, yaw));
    if (i % 2 === 0) k.add(new THREE.CylinderGeometry(1.4, 1.6, 22, 10), CONC, T(x0, 3, z0));
  }
  // 南北兩岸堤防
  return k.build();
}

// 鐵道橋（淡水線，1901–1988）／捷運高架（今）
export function buildRailBridge(mask, metro = false) {
  const k = new Kit(mask, metro ? 'metro' : 'rail-bridge');
  let crossing = null;
  for (let i = 0; i < RAIL.length - 1; i++) { const r = riverInfo(RAIL[i][0], RAIL[i][1]); if (r.d < r.w * 0.5) { crossing = crossing || i; } }
  const i0 = Math.max(0, (crossing || 40) - 14), i1 = Math.min(RAIL.length - 1, (crossing || 40) + 14);
  for (let i = i0; i < i1; i++) {
    const [x0, z0] = RAIL[i], [x1, z1] = RAIL[i + 1]; const L = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0); const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (metro) {
      k.add(new THREE.BoxGeometry(9, 2.2, L + 0.3), CONC, T(cx, 14, cz, yaw));
      k.add(new THREE.CylinderGeometry(1.2, 1.3, 20, 10), CONC, T(x0, 4, z0));
    } else {
      k.add(new THREE.BoxGeometry(5, 0.8, L + 0.3), STEEL_DARK, T(cx, 7.6, cz, yaw));
      for (const s of [-1, 1]) {
        const ox = Math.cos(yaw) * s * 2.6, oz = -Math.sin(yaw) * s * 2.6;
        beam(k, [x0 + ox, 12.5, z0 + oz], [x1 + ox, 12.5, z1 + oz], 0.4, STEEL);
        beam(k, [x0 + ox, 8, z0 + oz], [x1 + ox, 12.5, z1 + oz], 0.25, STEEL);
        beam(k, [x0 + ox, 8, z0 + oz], [x0 + ox, 12.5, z0 + oz], 0.25, STEEL);
      }
      if (i % 4 === 0) k.box(6, 14, 3, MASONRY, x0, -6, z0, yaw);
    }
  }
  return k.build();
}
