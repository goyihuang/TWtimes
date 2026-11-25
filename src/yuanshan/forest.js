import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { patch } from './materials.js';
import { hAt, slopeFast } from './terrain.js';
import { mulberry, riverInfo, nearSando, nearRoad, inTerrace, isMountain, noise2, fbm, ZHONGSHAN, polylineDist, shrineLocal, SHRINE } from './geo.js';

// 樹冠：數個多面體團塊，法線向外球面化，頂亮底暗
function canopyGeo(seed, blobs = 6, detail = 1) {
  const r = mulberry(seed); const parts = [];
  for (let i = 0; i < blobs; i++) {
    const a = r() * Math.PI * 2, rad = i === 0 ? 0 : 0.35 + r() * 0.35, y = 0.55 + r() * 0.35 + (i === 0 ? 0.15 : 0);
    const s = i === 0 ? 0.62 : 0.38 + r() * 0.22;
    const g = new THREE.IcosahedronGeometry(1, detail); g.scale(s, s * 0.82, s); g.translate(Math.cos(a) * rad, y, Math.sin(a) * rad);
    parts.push(g);
  }
  const trunk = new THREE.CylinderGeometry(0.045, 0.075, 0.6, 5); trunk.translate(0, 0.3, 0);
  const g = mergeGeometries([...parts.map(p => p.toNonIndexed()), trunk.toNonIndexed()]);
  const pos = g.attributes.position, nrm = g.attributes.normal, col = new Float32Array(pos.count * 3);
  const c = new THREE.Vector3(0, 0.75, 0), v = new THREE.Vector3(), n = new THREE.Vector3();
  const trunkStart = pos.count - trunk.toNonIndexed().attributes.position.count;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (i >= trunkStart) { col.set([0.32, 0.26, 0.2], i * 3); continue; }
    n.fromBufferAttribute(nrm, i); const sph = v.clone().sub(c).normalize(); n.lerp(sph, 0.75).normalize(); nrm.setXYZ(i, n.x, n.y, n.z);
    const ao = THREE.MathUtils.clamp(0.45 + (v.y - 0.3) * 0.75, 0.35, 1.15);
    col.set([ao, ao, ao], i * 3);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
function coniferGeo() {
  const parts = [];
  for (let i = 0; i < 4; i++) { const g = new THREE.ConeGeometry(0.42 - i * 0.08, 0.42, 7); g.translate(0, 0.32 + i * 0.2, 0); parts.push(g.toNonIndexed()); }
  const t = new THREE.CylinderGeometry(0.03, 0.05, 0.4, 5); t.translate(0, 0.2, 0); parts.push(t.toNonIndexed());
  const g = mergeGeometries(parts); const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); const isT = i >= pos.count - parts[4].attributes.position.count; const a = isT ? 0.4 : 0.55 + y * 0.45; col.set(isT ? [0.3, 0.24, 0.18] : [a, a, a], i * 3); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
}
function palmGeo() {
  const parts = []; const t = new THREE.CylinderGeometry(0.03, 0.045, 1, 6); t.translate(0, 0.5, 0); parts.push(t.toNonIndexed());
  for (let i = 0; i < 9; i++) { const f = new THREE.PlaneGeometry(0.1, 0.45, 1, 3); f.translate(0, 0.22, 0); const p = f.attributes.position; for (let k = 0; k < p.count; k++) { const y = p.getY(k); p.setZ(k, -y * y * 0.9); } f.rotateX(-0.9); f.rotateY(i / 9 * Math.PI * 2); f.translate(0, 1, 0); parts.push(f.toNonIndexed()); }
  const g = mergeGeometries(parts); const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) col.set(i < parts[0].attributes.position.count ? [0.75, 0.72, 0.66] : [0.55, 0.75, 0.4], i * 3);
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
}

const PAL = {
  far: ['#264d22', '#30602a', '#3f6c2a', '#234428', '#4d7429', '#2b5233', '#356530'],
  broad: ['#264d22', '#30602a', '#3f6c2a', '#234428', '#4d7429', '#5e7d2c', '#2b5233', '#356530', '#6a7c2e', '#7a6a2e'],
  conifer: ['#24412c', '#2c4b30', '#1f3a2b'],
  palm: ['#6c9a4a', '#7fa652'],
};

function makeMat(wind) {
  const mat = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, side: THREE.DoubleSide }), {
    instMask: true, grow: true, wind, dissolve: true, wet: true, grime: false, key: ['tree', wind],
    frag: s => s.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * 0.05;`),
  });
  const depth = patch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), { instMask: true, grow: true, wind, dissolve: false, grime: false, key: ['treeD', wind] });
  return { mat, depth };
}

export function buildForest(quality, exclusions) {
  const group = new THREE.Group(); group.name = 'forest';
  const R = mulberry(2024);
  const lists = { broad: [], conifer: [], palm: [], far: [] };
  const excluded = (x, z, era) => exclusions.some(e => e.mask[era] && Math.hypot(x - e.x, z - e.z) < e.r);
  const addTree = (type, x, z, s, mask) => {
    const y = hAt(x, z) - 0.3; lists[type].push({ x, y, z, s, mask, rot: R() * Math.PI * 2, c: PAL[type][Math.floor(R() * PAL[type].length)] });
  };
  const sp = quality === 'low' ? 9.5 : 6.6;
  // 山林：近處密林（6–7 m 間距），遠處以較大、較疏的樹冠覆蓋整條劍潭山稜
  const addMountain = (x0, x1, z0, z1, step, scale, far) => {
    for (let z = z0; z < z1; z += step) for (let x = x0; x < x1; x += step) {
      const jx = x + (R() - 0.5) * step * 1.3, jz = z + (R() - 0.5) * step * 1.3;
      const near = Math.hypot(jx - 150, jz + 380) < 720;
      if (far === near) continue;
      if (!isMountain(jx, jz)) continue;
      const rv = riverInfo(jx, jz); if (rv.d < rv.w * 0.5 + 6) continue;
      const h = hAt(jx, jz); if (h < 5) continue;
      if (slopeFast(jx, jz) > 3) continue;
      if (nearSando(jx, jz, 3) || nearRoad(jx, jz, 1) || inTerrace(jx, jz, 4, 3)) continue;
      const clear = fbm(jx * 0.01, jz * 0.01, 2); if (clear < -0.36) continue;
      const mask = [0, 1, 2, 3].map(e => excluded(jx, jz, e) ? 0 : 1);
      if (!mask.some(Boolean)) continue;
      const s = (5 + R() * 4.5 + Math.max(0, clear) * 4) * scale;
      const ds = Math.hypot(jx - SHRINE.x, jz - SHRINE.z);
      if (ds < 170 && R() < 0.55) addTree('conifer', jx, jz, s * 1.35, mask); else addTree(far ? 'far' : 'broad', jx, jz, s, mask);
    }
  };
  addMountain(-700, 1300, -1300, 200, sp, 1, false);
  addMountain(-700, 2000, -1500, 200, sp * 1.9, 1.75, true);
  // 平地：村落竹林、樹叢（日治）、行道樹（戰後至今）、河濱（今）
  for (let n = 0; n < (quality === 'low' ? 2200 : 4200); n++) {
    const x = (R() - 0.5) * 3600, z = (R() - 0.5) * 3600;
    if (isMountain(x, z)) continue;
    const rv = riverInfo(x, z); if (rv.d < rv.w * 0.5 + 8) continue;
    if (nearRoad(x, z, 2) || nearSando(x, z, 2)) continue;
    const cl = fbm(x * 0.004 + 9, z * 0.004, 3);
    const village = cl > 0.12;
    const mask = [village ? 1 : 0, village ? 1 : 0, cl > 0.2 ? 1 : 0, cl > 0.28 ? 1 : 0];
    if (Math.hypot(x + 300, z - 190) < 110) { mask[0] = mask[1] = mask[2] = mask[3] = 1; }
    if (!mask.some(Boolean) || excluded(x, z, 0) && excluded(x, z, 3)) continue;
    addTree('broad', x, z, 6 + R() * 6, mask);
  }
  // 中山北路行道樹（日治勅使街道即有，今為楓香、樟樹）
  for (let i = 3; i < ZHONGSHAN.length; i += 2) {
    const p = ZHONGSHAN[i], q = ZHONGSHAN[i + 1] || p; const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz) || 1;
    for (const side of [-1, 1]) for (const [e, off] of [[1, 10], [2, 13], [3, 19]]) {
      const x = p[0] - dz / L * side * off, z = p[1] + dx / L * side * off;
      const mask = [0, 0, 0, 0]; mask[e] = 1; if (e === 1) mask[0] = 0;
      addTree('broad', x, z, 7 + R() * 3, mask);
    }
  }
  // 參道杉列（日治）
  for (let i = 4; i < 999; i += 3) {
    const { SANDO } = exclusions; if (!SANDO || i >= SANDO.length - 1) break;
    const p = SANDO[i], q = SANDO[i + 1]; const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz) || 1;
    for (const side of [-1, 1]) addTree('conifer', p[0] - dz / L * side * 13, p[1] + dx / L * side * 13, 13 + R() * 5, [1, 1, 0, 0]);
  }

  const geos = { broad: canopyGeo(5, 6, quality === 'low' ? 0 : 1), far: canopyGeo(8, 4, 0), conifer: coniferGeo(), palm: palmGeo() };
  for (const type of Object.keys(lists)) {
    const L = lists[type]; if (!L.length) continue;
    const { mat, depth } = makeMat(type === 'conifer' ? 0.6 : 1);
    const mesh = new THREE.InstancedMesh(geos[type], mat, L.length);
    const maskArr = new Float32Array(L.length * 4); const m4 = new THREE.Matrix4(), col = new THREE.Color();
    L.forEach((t, i) => {
      const sy = type === 'palm' ? t.s : t.s * (0.85 + (i % 7) * 0.05);
      m4.compose(new THREE.Vector3(t.x, t.y, t.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, t.rot, 0)), new THREE.Vector3(t.s, sy, t.s));
      mesh.setMatrixAt(i, m4); col.set(t.c).offsetHSL((Math.sin(i * 12.9) * 0.5) * 0.02, 0, (Math.cos(i * 7.3)) * 0.04); mesh.setColorAt(i, col);
      maskArr.set(t.mask, i * 4);
    });
    mesh.geometry = mesh.geometry.clone(); mesh.geometry.setAttribute('aMask', new THREE.InstancedBufferAttribute(maskArr, 4));
    mesh.customDepthMaterial = depth; mesh.castShadow = type !== 'far'; mesh.receiveShadow = true; mesh.frustumCulled = false;
    mesh.userData.mask = [1, 1, 1, 1];
    group.add(mesh);
  }
  group.userData.count = lists.broad.length + lists.conifer.length + lists.far.length;
  return group;
}

// 少量棕櫚（飯店泳池、園景）
export function palms(list, mask) {
  const { mat, depth } = makeMat(0.8);
  const mesh = new THREE.InstancedMesh(palmGeo(), mat, list.length); const m4 = new THREE.Matrix4(); const maskArr = new Float32Array(list.length * 4);
  list.forEach(([x, z, s], i) => { m4.compose(new THREE.Vector3(x, hAt(x, z), z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); mesh.setMatrixAt(i, m4); mesh.setColorAt(i, new THREE.Color(PAL.palm[i % 2])); maskArr.set(mask, i * 4); });
  mesh.geometry = mesh.geometry.clone(); mesh.geometry.setAttribute('aMask', new THREE.InstancedBufferAttribute(maskArr, 4));
  mesh.customDepthMaterial = depth; mesh.castShadow = true; mesh.userData.mask = mask; return mesh;
}
