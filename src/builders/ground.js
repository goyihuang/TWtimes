import * as THREE from 'three';
import { hash01, pointInPolygon } from '../geo.js';

const ROAD_W = { trunk: 26, primary: 22, secondary: 16, tertiary: 12, unclassified: 8, residential: 8, living_street: 6, service: 5, busway: 7, pedestrian: 6, footway: 2.5, path: 2, cycleway: 2.5, steps: 2.5, secondary_link: 8, tertiary_link: 7 };
const MAJOR = new Set(['trunk', 'primary', 'secondary', 'tertiary']);
const WITH_SIDEWALK = new Set(['trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential']);

export function roadWidth(r, scale = 1) {
  const t = r.tags; const w = parseFloat(t.width);
  const base = w > 0 ? w : (ROAD_W[t.highway] ?? 5);
  const minor = ['footway', 'path', 'steps', 'cycleway'].includes(t.highway);
  return minor ? base : base * scale;
}

class Ribbon {
  constructor() { this.pos = []; this.uv = []; this.idx = []; }
  add(line, w, y, vScale = 10, uSpan = 1) {
    if (line.length < 2) return;
    const n = line.length; const base = this.pos.length / 3; let dist = 0;
    for (let i = 0; i < n; i++) {
      const p = line[i], a = line[Math.max(0, i - 1)], b = line[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      let nx = -tz, nz = tx; let m = 1;
      if (i > 0 && i < n - 1) { // 轉角斜接，限制長度避免尖刺
        const d1x = p[0] - a[0], d1z = p[1] - a[1], l1 = Math.hypot(d1x, d1z) || 1;
        const n1x = -d1z / l1, n1z = d1x / l1; m = 1 / Math.max(0.35, nx * n1x + nz * n1z);
      }
      if (i > 0) dist += Math.hypot(p[0] - line[i - 1][0], p[1] - line[i - 1][1]);
      const h = (w / 2) * m;
      this.pos.push(p[0] + nx * h, y, p[1] + nz * h, p[0] - nx * h, y, p[1] - nz * h);
      this.uv.push(0, dist / vScale, uSpan, dist / vScale);
      if (i > 0) { const k = base + (i - 1) * 2; this.idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
  }
  mesh(mat, { shadow = true } = {}) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx); g.computeVertexNormals();
    // 統一法線朝上（帶狀面在斜接處可能翻轉）
    const nrm = g.attributes.normal; for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
    const m = new THREE.Mesh(g, mat); m.receiveShadow = shadow; return m;
  }
}
function offsetLine(line, d) {
  return line.map((p, i) => {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1;
    return [p[0] - (tz / l) * d, p[1] + (tx / l) * d];
  });
}
function flatPolys(rings, y, mat, uvScale = 10) {
  const pos = [], uv = [];
  for (const ring of rings) {
    let faces; try { faces = THREE.ShapeUtils.triangulateShape(ring.map(p => new THREE.Vector2(p[0], p[1])), []); } catch { continue; }
    for (const f of faces) {
      const [a, b, c] = f.map(i => ring[i]);
      const cr = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
      const tri = cr >= 0 ? [a, b, c] : [a, c, b];
      for (const p of tri) { pos.push(p[0], y, p[1]); uv.push(p[0] / uvScale, p[1] / uvScale); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m;
}
const std = (map, o = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.95, ...o });

export function buildGround(base, era, edits, tex, existing) {
  const group = new THREE.Group(); group.name = 'ground';
  const old = era.road.surface === 'dirt';
  const scale = edits.global.streetWidth || 1;
  const roads = base.roads.filter(r => era.roadIncluded(r));

  // 地面
  const gtex = (old ? tex.ground1935 : tex.ground).clone(); gtex.repeat.set(300, 300); gtex.needsUpdate = true;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), std(gtex));
  plane.rotation.x = -Math.PI / 2; plane.receiveShadow = true; group.add(plane);

  // 區域（公園、水池、球場…）
  const byKind = {};
  for (const a of base.areas) (byKind[a.kind] ||= []).push(a.ring);
  const grassMat = std(tex.grass, { color: old ? 0xd8e0b0 : 0xffffff });
  if (byKind.park) group.add(flatPolys(byKind.park, 0.012, grassMat));
  if (byKind.grass) group.add(flatPolys(byKind.grass, 0.014, grassMat));
  if (byKind.pitch && !old) group.add(flatPolys(byKind.pitch, 0.016, std(tex.grass, { color: 0x9fd27a })));
  if (byKind.dirt) group.add(flatPolys(byKind.dirt, 0.013, std(tex.earth)));
  if (byKind.paved && !old) group.add(flatPolys(byKind.paved, 0.013, std(tex.asphalt)));
  const waterMat = new THREE.MeshStandardMaterial({ color: old ? 0x4a6a5c : 0x3c5c63, roughness: 0.06, metalness: 0.2 });
  waterMat.userData.water = true;
  if (byKind.water) group.add(flatPolys(byKind.water, 0.02, waterMat));
  if (byKind.platform && !old) group.add(flatPolys(byKind.platform, 10.9, std(tex.ground, { color: 0xbbbbbb })));

  // 人行道（現今：地磚；1935：土）
  const side = new Ribbon(), road = new Ribbon(), minor = new Ribbon(), mark = new Ribbon(), bridge = new Ribbon();
  for (const r of roads) {
    const w = roadWidth(r, scale); const hw = r.tags.highway;
    if (['footway', 'path', 'steps', 'cycleway'].includes(hw)) { minor.add(r.line, w, 0.022, 4); continue; }
    if (r.tags.bridge === 'yes') { bridge.add(r.line, w + 1.5, 0.32, 8); continue; }
    if (WITH_SIDEWALK.has(hw)) side.add(r.line, w + 6, 0.012, 4);
    road.add(r.line, w, MAJOR.has(hw) ? 0.034 : 0.03, 12);
    if (era.road.markings && MAJOR.has(hw) && w >= 10) mark.add(r.line, 0.25, 0.045, 8);
  }
  const roadMat = std(old ? tex.dirt : tex.asphalt, { polygonOffset: true, polygonOffsetFactor: -1 });
  roadMat.userData.wet = !old;
  group.add(side.mesh(std(old ? tex.earth : tex.tile)));
  group.add(road.mesh(roadMat));
  group.add(minor.mesh(std(old ? tex.earth : tex.tile, { color: old ? 0xffffff : 0xdddddd })));
  group.add(bridge.mesh(std(old ? tex.dirt : tex.asphalt, { color: 0xcccccc })));
  if (era.road.markings) { const mm = new THREE.MeshBasicMaterial({ map: tex.markings, transparent: true, alphaTest: 0.3, depthWrite: false }); group.add(mark.mesh(mm, { shadow: false })); }

  // 河川：綠川、柳川
  const water = new Ribbon(), bank = new Ribbon();
  for (const w of base.waterways) {
    const width = parseFloat(w.tags.width) || (w.tags.name === '柳川' ? 11 : 10);
    water.add(w.line, width, 0.025, 10);
    bank.add(offsetLine(w.line, width / 2 + 0.7), 1.4, 0.4, 2);
    bank.add(offsetLine(w.line, -width / 2 - 0.7), 1.4, 0.4, 2);
  }
  group.add(water.mesh(waterMat, { shadow: true }));
  group.add(bank.mesh(old ? grassMat : std(tex.ground, { color: 0xb5b0a5 })));

  // 鐵道
  const deck = new Ribbon(), ballastHi = new Ribbon(), ballastLo = new Ribbon(), green = new Ribbon(), greenPath = new Ribbon();
  const pillars = [];
  for (const r of base.rails) {
    const spec = era.railway(r); if (!spec) continue;
    if (spec.kind === 'elevated') {
      deck.add(r.line, 7, 10, 10);
      ballastHi.add(r.line, 3.2, 10.06, 4);
      let acc = 0; for (let i = 1; i < r.line.length; i++) { const a = r.line[i - 1], b = r.line[i]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s = (30 - acc % 30) % 30; s < l; s += 30) pillars.push([a[0] + (b[0] - a[0]) * s / l, a[1] + (b[1] - a[1]) * s / l]); acc += l; }
    } else if (spec.kind === 'ground') ballastLo.add(r.line, 3.2, 0.05, 4);
    else if (spec.kind === 'greenway') { green.add(r.line, 9, 0.02, 6); greenPath.add(r.line, 2.6, 0.03, 4); }
  }
  const concrete = std(tex.ground, { color: 0xc9c6bf });
  if (deck.pos.length) {
    const top = deck.mesh(concrete); top.castShadow = true; group.add(top);
    const under = deck.mesh(concrete); under.scale.y = 0.92; under.material = concrete.clone(); under.material.side = THREE.BackSide; under.castShadow = true; group.add(under);
    group.add(ballastHi.mesh(std(tex.ballast)));
    const pg = new THREE.BoxGeometry(2.2, 9.2, 2.2); pg.translate(0, 4.6, 0);
    const pm = new THREE.InstancedMesh(pg, concrete, pillars.length);
    const mm = new THREE.Matrix4(); pillars.forEach((p, i) => { mm.makeTranslation(p[0], 0, p[1]); pm.setMatrixAt(i, mm); });
    pm.castShadow = pm.receiveShadow = true; group.add(pm);
  }
  if (ballastLo.pos.length) group.add(ballastLo.mesh(std(tex.ballast)));
  if (green.pos.length) { group.add(green.mesh(grassMat)); group.add(greenPath.mesh(std(tex.tile))); }

  // 行道樹、公園樹木、路燈／電線桿
  group.add(buildTrees(base, era, roads, scale, existing));
  group.add(buildPoles(roads, era, scale));
  return group;
}

function blocked(x, z, existing) {
  for (const b of existing) { const bb = b.bbox; if (x < bb[0] || x > bb[2] || z < bb[1] || z > bb[3]) continue; if (pointInPolygon(x, z, b.ring)) return true; }
  return false;
}

function buildTrees(base, era, roads, scale, existing) {
  const spots = [];
  const density = era.trees;
  for (const r of roads) {
    if (!MAJOR.has(r.tags.highway) || r.tags.bridge) continue;
    const w = roadWidth(r, scale) / 2 + 1.6;
    const spacing = era.id === '1935' ? 16 : 9;
    for (const side of [-1, 1]) {
      const line = offsetLine(r.line, side * w); let carry = 0;
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1], b = line[i]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let s = carry; s < l; s += spacing) { const x = a[0] + (b[0] - a[0]) * s / l, z = a[1] + (b[1] - a[1]) * s / l; if (hash01(Math.round(x * 13 + z * 7), 3) < density) spots.push([x, z, 0.8]); }
        carry = (carry - l) % spacing; if (carry < 0) carry += spacing;
      }
    }
  }
  for (const w of base.waterways) { // 河岸樹（1935 為垂柳意象）
    for (const side of [-1, 1]) { const line = offsetLine(w.line, side * 7.5); for (let i = 1; i < line.length; i++) { const a = line[i - 1], b = line[i]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s = 0; s < l; s += 11) spots.push([a[0] + (b[0] - a[0]) * s / l, a[1] + (b[1] - a[1]) * s / l, era.id === '1935' ? 1.2 : 0.9]); } }
  }
  for (const a of base.areas) {
    if (a.kind !== 'park') continue;
    let minx = 1e9, minz = 1e9, maxx = -1e9, maxz = -1e9; for (const p of a.ring) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); minz = Math.min(minz, p[1]); maxz = Math.max(maxz, p[1]); }
    const n = Math.min(400, ((maxx - minx) * (maxz - minz)) / 150);
    for (let k = 0; k < n; k++) { const x = minx + hash01(a.id + k, 1) * (maxx - minx), z = minz + hash01(a.id + k, 2) * (maxz - minz); if (pointInPolygon(x, z, a.ring)) spots.push([x, z, 1 + hash01(k, 5) * 0.6]); }
  }
  const pts = spots.filter(([x, z]) => !blocked(x, z, existing) && !inWater(x, z, base)).slice(0, 3000);
  const trunkG = new THREE.CylinderGeometry(0.18, 0.28, 4, 6); trunkG.translate(0, 2, 0);
  const crownG = new THREE.IcosahedronGeometry(2.6, 1); crownG.translate(0, 5.4, 0);
  const trunk = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 }), pts.length);
  const crown = new THREE.InstancedMesh(crownG, new THREE.MeshStandardMaterial({ color: 0x55803a, roughness: 0.95, flatShading: true }), pts.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  pts.forEach(([x, z, k], i) => {
    const r1 = hash01(Math.round(x * 31 + z * 17), 9); const sc = k * (0.75 + r1 * 0.5);
    e.set(0, r1 * 6.28, 0); q.setFromEuler(e); v.set(x, 0, z); s.set(sc, sc * (0.9 + r1 * 0.3), sc); m.compose(v, q, s);
    trunk.setMatrixAt(i, m); crown.setMatrixAt(i, m);
    c.setRGB(0.75 + r1 * 0.4, 0.8 + r1 * 0.35, 0.7 + r1 * 0.3); crown.setColorAt(i, c);
  });
  trunk.castShadow = crown.castShadow = true; crown.receiveShadow = true;
  const g = new THREE.Group(); g.name = 'trees'; g.add(trunk, crown); return g;
}
function inWater(x, z, base) {
  for (const w of base.waterways) for (let i = 1; i < w.line.length; i++) {
    const a = w.line[i - 1], b = w.line[i]; const dx = b[0] - a[0], dz = b[1] - a[1]; const l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)); if (Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < 6) return true;
  }
  return false;
}

function buildPoles(roads, era, scale) {
  const spots = [];
  for (const r of roads) {
    if (!MAJOR.has(r.tags.highway) && r.tags.highway !== 'residential') continue;
    const w = roadWidth(r, scale) / 2 + 0.6; const line = offsetLine(r.line, w); const sp = era.id === '1935' ? 28 : 32;
    for (let i = 1; i < line.length; i++) { const a = line[i - 1], b = line[i]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s = sp / 2; s < l; s += sp) spots.push([a[0] + (b[0] - a[0]) * s / l, a[1] + (b[1] - a[1]) * s / l, Math.atan2(b[0] - a[0], b[1] - a[1])]); }
  }
  const g = new THREE.Group(); g.name = 'poles';
  const old = era.id === '1935';
  const poleG = old ? new THREE.CylinderGeometry(0.12, 0.16, 8, 6) : new THREE.CylinderGeometry(0.08, 0.12, 8, 6); poleG.translate(0, 4, 0);
  const armG = old ? new THREE.BoxGeometry(1.8, 0.12, 0.12) : new THREE.BoxGeometry(0.1, 0.1, 1.6); armG.translate(0, 7.4, old ? 0 : -0.8);
  const headG = new THREE.SphereGeometry(old ? 0.18 : 0.28, 8, 6); headG.translate(0, old ? 6.4 : 7.3, old ? 0.25 : -1.5);
  const mPole = new THREE.MeshStandardMaterial({ color: old ? 0x4a3a2a : 0x6f767c, roughness: old ? 1 : 0.5, metalness: old ? 0 : 0.5 });
  const mHead = new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: old ? 0xffb35a : 0xfff0d0, emissiveIntensity: 0 }); mHead.userData.night = true; mHead.userData.nightBoost = 4;
  const ims = [new THREE.InstancedMesh(poleG, mPole, spots.length), new THREE.InstancedMesh(armG, mPole, spots.length), new THREE.InstancedMesh(headG, mHead, spots.length)];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  spots.forEach(([x, z, ang], i) => { e.set(0, ang + Math.PI / 2, 0); q.setFromEuler(e); v.set(x, 0, z); m.compose(v, q, s); ims.forEach(im => im.setMatrixAt(i, m)); });
  ims[0].castShadow = true; g.add(...ims);
  // 夜間地面光暈（便宜的假光源）
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  const gt = new THREE.CanvasTexture(c);
  const gm = new THREE.MeshBasicMaterial({ map: gt, color: old ? 0xffa850 : 0xffe2b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  gm.userData.glow = true;
  const pg = new THREE.PlaneGeometry(old ? 9 : 14, old ? 9 : 14); pg.rotateX(-Math.PI / 2); pg.translate(0, 0.08, old ? 0 : -1.5);
  const glow = new THREE.InstancedMesh(pg, gm, spots.length);
  spots.forEach(([x0, z, ang], i) => { e.set(0, ang + Math.PI / 2, 0); q.setFromEuler(e); v.set(x0, 0, z); m.compose(v, q, s); glow.setMatrixAt(i, m); });
  g.add(glow); return g;
}
