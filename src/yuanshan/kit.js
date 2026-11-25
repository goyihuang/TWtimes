import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { M } from './materials.js';

// ---------- 合併建構器：同材質的零件合成一個網格 ----------
export class Kit {
  constructor(mask, name = 'kit') { this.mask = mask; this.name = name; this.parts = new Map(); this.stack = [new THREE.Matrix4()]; this.lights = []; }
  light(x, y, z, r = 8, color = '#ffb45c') { const v = new THREE.Vector3(x, y, z).applyMatrix4(this.m); this.lights.push({ p: v, r, color, mask: this.mask }); return this; }
  get m() { return this.stack[this.stack.length - 1]; }
  push(x = 0, y = 0, z = 0, ry = 0, s = 1) { const n = this.m.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, s, s))); this.stack.push(n); return this; }
  pushM(mat) { this.stack.push(this.m.clone().multiply(mat)); return this; }
  pop() { this.stack.pop(); return this; }
  add(geo, mat, local) {
    const key = JSON.stringify(mat, (k, v) => (v && v.uuid ? v.uuid : v));
    if (!this.parts.has(key)) this.parts.set(key, { mat, geos: [] });
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (local) g.applyMatrix4(local);
    g.applyMatrix4(this.m);
    this.parts.get(key).geos.push(g);
    return this;
  }
  box(w, h, d, mat, x = 0, y = 0, z = 0, ry = 0) { return this.add(new THREE.BoxGeometry(w, h, d), mat, T(x, y + h / 2, z, ry)); }
  cyl(r1, r2, h, mat, x = 0, y = 0, z = 0, seg = 10) { return this.add(new THREE.CylinderGeometry(r1, r2, h, seg), mat, T(x, y + h / 2, z)); }
  build(opts = {}) {
    const g = new THREE.Group(); g.name = this.name; g.userData.mask = this.mask;
    for (const { mat, geos } of this.parts.values()) {
      const merged = mergeGeometries(geos, false); merged.computeBoundingSphere();
      const material = mat.isMaterial ? mat : M(mat, this.mask);
      const mesh = new THREE.Mesh(merged, material); mesh.castShadow = opts.cast !== false && !(mat.emissiveIntensity > 0 && !mat.color); mesh.receiveShadow = true;
      g.add(mesh);
    }
    g.userData.lights = this.lights;
    return g;
  }
}
export function T(x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
}

// ---------- 曲面屋頂 ----------
// style: 'hip' 廡殿／'gable' 切妻／'irimoya' 入母屋（歇山）；W,D 為簷口半寬半深，H 為屋脊高
// curve > 1 簷口平緩、屋脊陡（凹曲面）；lift 為翼角起翹
export function roofGeo({ W, D, H, style = 'hip', curve = 1.5, lift = 0, thick = 0.4, hipK = 1, nu = 16, nv = 10 }) {
  const P = [], UV = [];
  const ridgeX = style === 'gable' ? W : Math.max(0, W - D * hipK);
  const faces = [];
  // 正面 / 背面（梯形）
  faces.push({ e0: [-W, D], e1: [W, D], r0: [-ridgeX, 0], r1: [ridgeX, 0], len: 2 * W });
  faces.push({ e0: [W, -D], e1: [-W, -D], r0: [ridgeX, 0], r1: [-ridgeX, 0], len: 2 * W });
  if (style !== 'gable') { // 兩側（三角形）
    faces.push({ e0: [W, D], e1: [W, -D], r0: [ridgeX, 0], r1: [ridgeX, 0], len: 2 * D });
    faces.push({ e0: [-W, -D], e1: [-W, D], r0: [-ridgeX, 0], r1: [-ridgeX, 0], len: 2 * D });
  }
  const hOf = (t, s, side) => {
    let h = H * Math.pow(t, curve);
    const c = Math.pow(Math.abs(2 * s - 1), 5);
    h += lift * Math.pow(1 - t, 2.2) * c;
    return h;
  };
  const topTop = (face, s, t) => {
    const ex = face.e0[0] + (face.e1[0] - face.e0[0]) * s, ez = face.e0[1] + (face.e1[1] - face.e0[1]) * s;
    const rx = face.r0[0] + (face.r1[0] - face.r0[0]) * s, rz = face.r0[1] + (face.r1[1] - face.r0[1]) * s;
    // 翼角平面外伸
    const c = Math.pow(Math.abs(2 * s - 1), 5) * (1 - t);
    const ox = Math.sign(ex) * lift * 0.35 * c, oz = Math.sign(ez) * lift * 0.35 * c;
    return [ex + (rx - ex) * t + ox, hOf(t, s), ez + (rz - ez) * t + oz];
  };
  for (const f of faces) {
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const s0 = i / nu, s1 = (i + 1) / nu, t0 = j / nv, t1 = (j + 1) / nv;
      const a = topTop(f, s0, t0), b = topTop(f, s1, t0), c = topTop(f, s1, t1), d = topTop(f, s0, t1);
      const slope = H * 1.2 + D;
      const uv = (s, t) => [s * f.len / 1.0, t * slope / 1.0];
      P.push(...a, ...b, ...c, ...a, ...c, ...d);
      UV.push(...uv(s0, t0), ...uv(s1, t0), ...uv(s1, t1), ...uv(s0, t0), ...uv(s1, t1), ...uv(s0, t1));
    }
    // 簷口厚度（下垂的封簷板）
    for (let i = 0; i < nu; i++) {
      const s0 = i / nu, s1 = (i + 1) / nu; const a = topTop(f, s0, 0), b = topTop(f, s1, 0);
      const a2 = [a[0], a[1] - thick, a[2]], b2 = [b[0], b[1] - thick, b[2]];
      P.push(...a2, ...b2, ...b, ...a2, ...b, ...a); UV.push(0, 0, 1, 0, 1, 0.1, 0, 0, 1, 0.1, 0, 0.1);
    }
  }
  // 山牆（切妻、入母屋）
  if (style === 'gable') for (const sx of [-1, 1]) {
    const n = 12;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const y0 = H * Math.pow(t0, curve), y1 = H * Math.pow(t1, curve);
      const z0 = D * (1 - t0), z1 = D * (1 - t1);
      const x = sx * W * 0.985;
      P.push(x, y0 - thick, z0, x, y1 - thick, z1, x, y1 - thick, -z1, x, y0 - thick, z0, x, y1 - thick, -z1, x, y0 - thick, -z0);
      UV.push(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.computeVertexNormals();
  return g;
}

// 入母屋（歇山）：下層廡殿 + 上層山牆三角
export function irimoya(kit, { W, D, H, curve = 1.6, lift = 0, mat, gableMat, ridgeMat, thick = 0.4 }) {
  kit.add(roofGeo({ W, D, H, style: 'hip', curve, lift, thick, hipK: 1.35 }), { ...mat, side: 2 });
  const rx = Math.max(0.5, W - D * 1.35);
  // 山花：小三角牆，立於側面坡上
  const gh = H * 0.42, gz = D * 0.42;
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([0, H - gh, -gz, 0, H - gh, gz, 0, H, 0], 3)); tri.computeVertexNormals();
  for (const s of [-1, 1]) kit.add(tri, { ...(gableMat || mat), side: 2 }, T(s * (rx + D * 0.42 * 1.35 * 0.35), 0, 0));
  if (ridgeMat) kit.box(2 * rx + 0.4, 0.7, 0.8, ridgeMat, 0, H - 0.2, 0);
}

// ---------- 畫布材質 ----------
const texCache = new Map();
export function canvasTex(key, w, h, draw, repeat = true) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache.set(key, t); return t;
}
export function tileTex(base, line, key) {
  return canvasTex('tile' + key, 128, 128, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { const g = c.createLinearGradient(i * 16, 0, i * 16 + 16, 0); g.addColorStop(0, line); g.addColorStop(0.5, 'rgba(255,255,255,.18)'); g.addColorStop(1, line); c.fillStyle = g; c.fillRect(i * 16, 0, 16, h); }
    c.fillStyle = 'rgba(0,0,0,.22)'; for (let j = 0; j < 4; j++) c.fillRect(0, j * 32, w, 3);
  });
}
