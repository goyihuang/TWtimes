import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { patch, M, G } from './materials.js';
import { Kit, T } from './kit.js';
import { hAt, slopeFast } from './terrain.js';
import { mulberry, riverInfo, nearRoad, nearSando, isMountain, fbm, noise2, ZHONGSHAN, polylineDist, CORE } from './geo.js';

function houseGeo() {
  const body = new THREE.BoxGeometry(1, 1, 1); body.translate(0, 0.5, 0);
  const roof = new THREE.BufferGeometry();
  const v = [-0.56, 1, -0.6, 0.56, 1, -0.6, 0, 1.45, -0.6, -0.56, 1, 0.6, 0, 1.45, 0.6, 0.56, 1, 0.6];
  const P = (i) => v.slice(i * 3, i * 3 + 3);
  const tris = [[0, 2, 1], [3, 5, 4], [0, 3, 4], [0, 4, 2], [1, 2, 4], [1, 4, 5]];
  roof.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat().flatMap(P), 3)); roof.computeVertexNormals();
  roof.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(18 * 2), 2));
  const b = body.toNonIndexed();
  const g = mergeGeometries([b, roof]);
  const col = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < g.attributes.position.count; i++) col.set(i < b.attributes.position.count ? [1, 1, 1] : [0.42, 0.4, 0.4], i * 3);
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

function instanced(geo, mat, items) {
  const mesh = new THREE.InstancedMesh(geo.clone(), mat, items.length); const m4 = new THREE.Matrix4(), c = new THREE.Color(); const mask = new Float32Array(items.length * 4);
  items.forEach((it, i) => { m4.compose(new THREE.Vector3(it.x, it.y, it.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, it.r, 0)), new THREE.Vector3(it.w, it.h, it.d)); mesh.setMatrixAt(i, m4); mesh.setColorAt(i, c.set(it.c)); mask.set(it.mask, i * 4); });
  mesh.geometry.setAttribute('aMask', new THREE.InstancedBufferAttribute(mask, 4));
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.userData.mask = [1, 1, 1, 1];
  return mesh;
}

export function buildTown(quality) {
  const group = new THREE.Group(); group.name = 'town';
  const R = mulberry(77);
  const houses = [], towers = [];
  const sp = 15;
  for (let z = -CORE + 40; z < CORE - 40; z += sp) for (let x = -CORE + 40; x < CORE - 40; x += sp) {
    const jx = x + (R() - 0.5) * 6, jz = z + (R() - 0.5) * 6;
    if (isMountain(jx, jz)) continue;
    const h = hAt(jx, jz); if (h > 9 || slopeFast(jx, jz) > 0.12) continue;
    const rv = riverInfo(jx, jz); if (rv.d < rv.w * 0.5 + 20) continue;
    if (nearRoad(jx, jz, 3) || nearSando(jx, jz, 6)) continue;
    if (Math.hypot(jx + 300, jz - 190) < 115) continue; // 圓山
    if (Math.abs(jx + 50) < 110 && jz > 60 && jz < 170) continue; // 橋南廣場
    const dz = polylineDist(ZHONGSHAN, jx, jz).d;
    const village = fbm(jx * 0.006 + 3, jz * 0.006 - 5, 3);
    const u = 0.55 * Math.exp(-dz / 260) + 0.35 * (jz > 0 ? Math.min(1, jz / 1400) : 0) + village * 0.6 + (R() - 0.5) * 0.25;
    const yaw = Math.round(noise2(jx * 0.002, jz * 0.002) * 2) * 0.12 + (R() < 0.5 ? 0 : Math.PI / 2);
    const mask = [u > 0.52 && village > 0.08 ? 1 : 0, u > 0.36 ? 1 : 0, u > 0.18 ? 1 : 0, 0];
    const south = jz > 140 || jx < -460;
    if (south && jz > 260 && (u > 0.05 || jz > 400)) {
      const tall = Math.max(0, Math.min(1, (jz - 150) / 1300)) * 0.6 + Math.exp(-dz / 200) * 0.4;
      if (R() < 0.62) towers.push({ x: jx, y: h - 0.5, z: jz, r: yaw, w: 9 + R() * 8, d: 9 + R() * 8, h: 10 + Math.pow(R(), 2.2) * (25 + tall * 75), c: ['#c9c6bf', '#b7b5ae', '#d8d2c4', '#a9aeb2', '#c2b8a6', '#9ea3a6'][Math.floor(R() * 6)], mask: [0, 0, 0, 1] });
      else houses.push({ x: jx, y: h - 0.3, z: jz, r: yaw, w: 8, d: 10, h: 7 + R() * 6, c: '#c6c0b4', mask: [0, 0, 0, 1] });
    }
    if (!mask.some(Boolean)) continue;
    const cl = R();
    const wall = cl < 0.35 ? '#a8664e' : cl < 0.6 ? '#ddd3c0' : cl < 0.8 ? '#7d6650' : '#c4b29a';
    const big = mask[2] && !mask[1] && R() < 0.25; // 戰後美軍營舍、長條平房
    houses.push({ x: jx, y: h - 0.3, z: jz, r: yaw, w: big ? 30 : 7 + R() * 5, d: big ? 10 : 6 + R() * 5, h: big ? 4 : 3.2 + R() * (mask[1] ? 3.5 : 1.5), c: big ? '#d8d4c8' : wall, mask });
  }
  const hmat = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), { instMask: true, grow: true, key: 'house', wet: true });
  const hdepth = patch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), { instMask: true, grow: true, dissolve: false, grime: false, key: 'houseD' });
  const hm = instanced(houseGeo(), hmat, houses); hm.customDepthMaterial = hdepth; group.add(hm);

  // 大樓：程序化窗格，夜間亮燈
  const tgeo = new THREE.BoxGeometry(1, 1, 1); tgeo.translate(0, 0.5, 0);
  const tmat = patch(new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.15 }), {
    instMask: true, grow: true, key: 'tower', wet: true, uniforms: { uNight: G.uNight },
    frag: s => s.replace('#include <common>', '#include <common>\nuniform float uNight;').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  vec3 nW = normalize(cross(dFdx(vWPos), dFdy(vWPos)));
  float side = 1.0 - abs(nW.y);
  vec2 q = abs(nW.x) > 0.5 ? vWPos.zy : vWPos.xy;
  vec2 cell = vec2(q.x / 3.2, q.y / 3.3);
  vec2 f = fract(cell);
  float win = step(0.18, f.x) * step(f.x, 0.86) * step(0.25, f.y) * step(f.y, 0.82);
  float lit = step(0.62, fract(sin(dot(floor(cell) + floor(vWPos.xz / 40.0), vec2(12.9898, 78.233))) * 43758.5453));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.45 + vec3(0.06, 0.08, 0.1), win * side * 0.8);
  vec3 wc = mix(vec3(1.0, 0.7, 0.4), vec3(0.75, 0.85, 1.0), step(0.7, fract(sin(dot(floor(vWPos.xz / 40.0), vec2(4.1, 7.7))) * 9.1)));
  totalEmissiveRadiance += wc * win * lit * side * uNight * 0.5;
}`),
  });
  const tdepth = patch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), { instMask: true, grow: true, dissolve: false, grime: false, key: 'towerD' });
  // 遠方城市（核心外，今）
  for (let n = 0; n < (quality === 'low' ? 900 : 2200); n++) {
    const a = -0.2 + R() * (Math.PI + 0.9), r = 2100 + Math.pow(R(), 0.7) * 5200; const x = Math.cos(a) * r * 0.9, z = Math.sin(a) * r;
    if (z < 250) continue; const hh = hAt(x, z); if (hh > 30) continue;
    const rv = riverInfo(x, z); if (rv.d < rv.w * 0.5 + 30) continue;
    towers.push({ x, y: hh - 1, z, r: R() * 0.3, w: 14 + R() * 18, d: 14 + R() * 18, h: 14 + Math.pow(R(), 2) * 110, c: ['#c4c2bc', '#aab0b4', '#d6d0c4', '#9a9fa4'][Math.floor(R() * 4)], mask: [0, 0, 0, 1] });
    if (R() < 0.18) towers.push({ x, y: hh - 1, z, r: 0, w: 16, d: 16, h: 8, c: '#b9b2a2', mask: [0, 0, 1, 0] });
  }
  // 台北 101（遠景地標）
  towers.push({ x: 5600, y: 5, z: 6400, r: 0.3, w: 62, d: 62, h: 300, c: '#7f9aa0', mask: [0, 0, 0, 1] });
  towers.push({ x: 5600, y: 300, z: 6400, r: 0.3, w: 40, d: 40, h: 160, c: '#7f9aa0', mask: [0, 0, 0, 1] });
  towers.push({ x: 5600, y: 460, z: 6400, r: 0.3, w: 6, d: 6, h: 60, c: '#9aa5a8', mask: [0, 0, 0, 1] });
  const tm = instanced(tgeo, tmat, towers); tm.customDepthMaterial = tdepth; group.add(tm);
  group.userData.count = houses.length + towers.length;
  return group;
}

// ---------- 雜項：船、泳池、摩天輪、堤防 ----------
export function buildBoats(quality) {
  const group = new THREE.Group(); group.name = 'boats';
  const hull = new THREE.CylinderGeometry(0.8, 0.5, 9, 8, 1, false, 0, Math.PI); hull.rotateX(Math.PI / 2); hull.rotateZ(Math.PI); hull.scale(1, 0.7, 1);
  const sail = new THREE.PlaneGeometry(4.2, 6.2, 4, 4); const p = sail.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / 4.2 + 0.5) * Math.PI) * 0.5); sail.translate(0, 4.2, 0);
  const mast = new THREE.CylinderGeometry(0.06, 0.08, 8, 5); mast.translate(0, 4, 0);
  const awning = new THREE.CylinderGeometry(1.0, 1.0, 3.2, 10, 1, true, -Math.PI / 2, Math.PI); awning.rotateX(Math.PI / 2); awning.translate(0, 0.6, -0.8);
  const boats = [];
  const specs = [[0.1, [1, 1, 1, 0], true], [0.22, [1, 1, 0, 0], false], [0.35, [1, 1, 1, 0], false], [0.5, [1, 1, 1, 0], true], [0.62, [0, 1, 1, 0], false], [0.75, [1, 0, 0, 0], true], [0.86, [0, 0, 0, 1], false]];
  for (const [t0, mask, hasSail] of specs) {
    const k = new Kit(mask, 'boat');
    k.add(hull, { color: '#5b4632', roughness: 0.85 });
    if (hasSail) { k.add(mast, { color: '#4d3c2c', roughness: 0.8 }); k.add(sail, { color: '#c8a77a', roughness: 0.95, side: 2 }); }
    else k.add(awning, { color: '#3d3a33', roughness: 0.9, side: 2 });
    const g = k.build(); g.userData.t0 = t0; g.userData.speed = 0.0035 + (t0 * 37 % 1) * 0.004; g.userData.lane = ((t0 * 91) % 1 - 0.5) * 50;
    boats.push(g); group.add(g);
  }
  group.userData.boats = boats;
  return group;
}

export function buildExtras() {
  const out = [];
  // 再春游泳池（1966，橋南岸下方）
  const k3 = new Kit([0, 0, 1, 0], 'pool');
  k3.box(70, 0.6, 34, { color: '#ddd8cc', roughness: 0.8 }, -52, 5.2, 96);
  k3.box(48, 0.1, 18, { color: '#39b4d8', roughness: 0.05, metalness: 0.1 }, -58, 5.8, 92); k3.box(14, 0.1, 12, { color: '#6fd0e6', roughness: 0.05 }, -24, 5.8, 98);
  for (let i = 0; i < 8; i++) k3.box(1.4, 0.2, 2.2, { color: ['#d94f3b', '#f0c419', '#2f87c8'][i % 3] }, -80 + i * 6, 5.85, 108);
  // 兒童樂園摩天輪（圓山腳）
  const fw = new Kit([0, 0, 1, 0], 'wheel'); fw.push(-200, hAt(-200, 120), 120, 0.4);
  const ring = new THREE.TorusGeometry(11, 0.25, 6, 40); fw.add(ring, { color: '#d9d3c4', roughness: 0.5, metalness: 0.4 }, T(0, 13, -0.8)); fw.add(ring, { color: '#d9d3c4', roughness: 0.5, metalness: 0.4 }, T(0, 13, 0.8));
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; fw.box(0.4, 0.4, 2, { color: '#cfc6b4' }, Math.cos(a) * 11, 13 + Math.sin(a) * 11 - 0.2, 0); fw.box(1.4, 1.4, 1.4, { color: ['#d94f3b', '#f0c419', '#2f87c8', '#4caf6a'][i % 4], roughness: 0.6, emissive: '#ffcc88', emissiveIntensity: 0, lamp: 0.6 }, Math.cos(a) * 11, 11.6 + Math.sin(a) * 11, 0); }
  for (const s of [-1, 1]) fw.add(new THREE.CylinderGeometry(0.3, 0.4, 15, 6), { color: '#bdb6a6' }, T(s * 4, 6.5, 0, 0, 1, 1, 1, 0, s * 0.3));
  fw.pop();
  out.push(k3.build(), fw.build());
  return out;
}
