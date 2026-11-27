// 臺南驛前各年代街景：地面、道路、街廓、樹木、路燈、鐵道、列車、人車。
// 歷史街屋只以現代主要道路兩側的建物外框位置「示意密度」，高度與外觀依年代推估，非測繪成果。
import * as T from 'three';
import { rng, merge, tex, canvasTex, facadeTextures, groundTexture, signTexture, glowTex, puddleTex, ribbon, obb, extrudeFootprint, roofCap, paint } from './kit.js';
import { distToRoads } from './osm.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const ISLAND = { x: 5, z: 88, rx: 33, rz: 39 };          // 站前圓環（北門路環道內側）
const inIsland = (x, z, pad = 0) => ((x - ISLAND.x) / (ISLAND.rx + pad)) ** 2 + ((z - ISLAND.z) / (ISLAND.rz + pad)) ** 2 < 1;
const inRailZone = (x, z) => z < 24 && z > -64 && x > -190 && x < 190;   // 站房、月臺與地面軌道
export const TRACKS = [-37.9, -51.6, -55.8];
export const PLATFORMS = [{ z0: -35, z1: -21, h: 0.9 }, { z0: -48.6, z1: -40.9, h: 0.9 }];

function std(opts) { return new T.MeshStandardMaterial({ roughness: 0.85, ...opts }); }
function shade(o, cast = true) { o.traverse(m => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = true; } }); return o; }
function instanced(geo, mat, mats, colors) {
  const m = new T.InstancedMesh(geo, mat, mats.length); mats.forEach((x, i) => m.setMatrixAt(i, x));
  if (colors) colors.forEach((c, i) => m.setColorAt(i, new T.Color(c)));
  m.castShadow = m.receiveShadow = true; return m;
}
const M4 = (x, y, z, ry = 0, s = 1, sy = s) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(0, ry, 0)), new T.Vector3(s, sy, s));

// ── 共用幾何（物件 + 頂點色）──
function boxG(w, h, d, x, y, z, c) { const g = new T.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z); return paint(g, c); }
function cylG(r0, r1, h, x, y, z, c, seg = 10, rx = 0, rz = 0) { const g = new T.CylinderGeometry(r1, r0, h, seg); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); g.translate(x, y + (rx || rz ? 0 : h / 2), z); return paint(g, c); }

function canopyGeo(seed, r) {
  const ico = new T.IcosahedronGeometry(1, 3); ico.deleteAttribute('normal'); ico.deleteAttribute('uv'); const g = mergeVertices(ico), p = g.attributes.position, rnd = rng(seed), col = [];
  const base = new T.Color(r() > 0.5 ? 0x4f6b3a : 0x5d7440);
  for (let i = 0; i < p.count; i++) {
    const v = new T.Vector3().fromBufferAttribute(p, i), n = Math.sin(v.x * 4.1 + seed) * Math.cos(v.z * 3.7) * Math.sin(v.y * 5.3 + seed * 2);
    v.multiplyScalar(1 + n * 0.22 + (rnd() - 0.5) * 0.08); v.y *= 0.72; p.setXYZ(i, v.x, v.y, v.z);
    const c = base.clone().offsetHSL((rnd() - 0.5) * 0.03, 0, (v.y - 0.1) * 0.12 + (rnd() - 0.5) * 0.06); col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
function palmGeo() {
  const parts = [cylG(0.38, 0.3, 14, 0, 0, 0, 0x9c978c, 9)];
  parts.push(cylG(0.32, 0.36, 2.2, 0, 14, 0, 0x6f8a3c, 9));                  // 冠莖（大王椰子）
  for (let k = 0; k < 11; k++) {
    const a = k / 11 * Math.PI * 2, pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([Math.cos(a) * t * 4.6, 16.3 + Math.sin(t * 2.4) * 1.1 - t * t * 2.6, Math.sin(a) * t * 4.6]); }
    for (let i = 0; i < 8; i++) {
      const [x0, y0, z0] = pts[i], [x1, y1, z1] = pts[i + 1], w = 0.9 * Math.sin((i + 0.5) / 8 * Math.PI) + 0.15, nx = -Math.sin(a) * w, nz = Math.cos(a) * w;
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([x0 - nx, y0, z0 - nz, x0 + nx, y0, z0 + nz, x1 + nx, y1, z1 + nz, x0 - nx, y0, z0 - nz, x1 + nx, y1, z1 + nz, x1 - nx, y1, z1 - nz], 3));
      g.computeVertexNormals(); parts.push(paint(g, i < 3 ? 0x4e7432 : 0x3f6a2c));
    }
  }
  return merge(parts);
}
function personGeo() {
  return merge([cylG(0.16, 0.2, 0.62, 0, 0.82, 0, 0xffffff, 8), cylG(0.07, 0.08, 0.82, -0.09, 0, 0, 0x2f2d2a, 6), cylG(0.07, 0.08, 0.82, 0.09, 0, 0, 0x2f2d2a, 6), paint(new T.SphereGeometry(0.12, 10, 8).translate(0, 1.58, 0), 0xc69a76)]);
}
// 車輛（長軸 +x）
function vehicleGeo(kind, c) {
  const wheel = (x, z, r = 0.34, w = 0.22) => cylG(r, r, w, x, r, z, 0x1e1f1f, 12, Math.PI / 2);
  if (kind === 'car') return merge([boxG(4.3, 0.75, 1.75, 0, 0.32, 0, c), boxG(2.3, 0.62, 1.6, -0.2, 1.07, 0, c), boxG(2.25, 0.5, 1.62, -0.2, 1.1, 0, 0x2b3438), wheel(1.35, 0.8), wheel(-1.35, 0.8), wheel(1.35, -0.8), wheel(-1.35, -0.8)]);
  if (kind === 'oldcar') return merge([boxG(3.9, 0.7, 1.6, 0, 0.45, 0, c), boxG(1.9, 0.95, 1.5, -0.6, 1.15, 0, c), boxG(1.8, 0.5, 1.52, -0.6, 1.35, 0, 0x222826), wheel(1.25, 0.78, 0.4), wheel(-1.3, 0.78, 0.4), wheel(1.25, -0.78, 0.4), wheel(-1.3, -0.78, 0.4)]);
  if (kind === 'bus') return merge([boxG(11, 2.6, 2.5, 0, 0.35, 0, c), boxG(10.6, 0.9, 2.52, 0, 1.55, 0, 0x2b3438), boxG(11.02, 0.25, 2.52, 0, 0.9, 0, 0xd8d2c2), wheel(3.8, 1.15, 0.5, 0.3), wheel(-3.4, 1.15, 0.5, 0.3), wheel(3.8, -1.15, 0.5, 0.3), wheel(-3.4, -1.15, 0.5, 0.3)]);
  if (kind === 'oldbus') return merge([boxG(6.8, 2.1, 2.1, -0.6, 0.55, 0, c), boxG(1.6, 1.1, 1.7, 3.3, 0.55, 0, c), boxG(6.4, 0.7, 2.12, -0.6, 1.5, 0, 0x2a2d2a), wheel(3.2, 0.95, 0.45, 0.25), wheel(-2.4, 0.95, 0.45, 0.25), wheel(3.2, -0.95, 0.45, 0.25), wheel(-2.4, -0.95, 0.45, 0.25)]);
  if (kind === 'scooter') return merge([boxG(1.7, 0.5, 0.45, 0, 0.3, 0, c), boxG(0.5, 0.7, 0.35, 0.65, 0.5, 0, c), wheel(0.65, 0, 0.26, 0.12), wheel(-0.6, 0, 0.26, 0.12), cylG(0.16, 0.18, 0.6, -0.2, 0.85, 0, 0x3b4a5a, 8), paint(new T.SphereGeometry(0.15, 8, 6).translate(-0.18, 1.6, 0), 0xdddddd)]);
  if (kind === 'bike') return merge([boxG(1.5, 0.06, 0.06, 0, 0.62, 0, 0x2b2b2b), wheel(0.6, 0, 0.34, 0.05), wheel(-0.6, 0, 0.34, 0.05), cylG(0.16, 0.18, 0.62, -0.1, 0.9, 0, c, 8), paint(new T.SphereGeometry(0.13, 8, 6).translate(-0.05, 1.65, 0), 0xc69a76)]);
  if (kind === 'rickshaw') return merge([boxG(1.0, 0.55, 1.0, -0.2, 0.55, 0, 0x2b2521), boxG(0.1, 0.9, 1.0, -0.65, 1.05, 0, 0x2b2521), boxG(0.9, 0.08, 1.05, -0.35, 1.9, 0, 0x3a332c), cylG(0.6, 0.6, 0.06, -0.2, 0.6, 0.58, 0x3c3127, 16, Math.PI / 2), cylG(0.6, 0.6, 0.06, -0.2, 0.6, -0.58, 0x3c3127, 16, Math.PI / 2), boxG(1.9, 0.05, 0.05, 1.1, 0.8, 0.45, 0x3c3127), boxG(1.9, 0.05, 0.05, 1.1, 0.8, -0.45, 0x3c3127), cylG(0.15, 0.18, 0.6, 1.9, 0.82, 0, 0xe8e2d2, 8), cylG(0.06, 0.07, 0.82, 1.9, 0, 0, 0x2f2d2a, 6), paint(new T.SphereGeometry(0.13, 8, 6).translate(1.9, 1.56, 0), 0xb98a66)]);
}
// 列車（長軸 +x，置於軌道中心）
function coachTex(win, band) {
  return canvasTex(512, 128, (g, W, H) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    if (band) { g.fillStyle = band; g.fillRect(0, 86, W, 14); }
    for (let x = 30; x < W - 20; x += 46) { g.fillStyle = win; g.fillRect(x, 26, 32, 40); }
    g.fillStyle = '#2b2b2b'; g.fillRect(6, 20, 26, 90); g.fillRect(W - 32, 20, 26, 90);
  });
}
function trainSet(kind) {
  const grp = new T.Group();
  const spec = { steam: { body: 0x5a3a26, roof: 0x2f2f2d, n: 4, len: 17, h: 3.2, win: '#2a2a28', band: null },
                 diesel: { body: 0x2f5872, roof: 0x3a3d3d, n: 5, len: 20, h: 3.4, win: '#1d2326', band: '#e9e2c8' },
                 emu: { body: 0xe6e6e2, roof: 0x9a9d9c, n: 6, len: 20, h: 3.6, win: '#1a2227', band: '#1d5fa8' } }[kind];
  const t = coachTex(spec.win, spec.band), bodyM = std({ map: t, vertexColors: true, roughness: 0.55, metalness: kind === 'emu' ? 0.3 : 0.05 });
  const parts = []; let x = 0;
  if (kind === 'steam') {   // 機關車（示意，不指涉特定車型）
    parts.push(cylG(0.85, 0.85, 7.5, 3.6, 2.1, 0, 0x1b1c1c, 16, 0, Math.PI / 2), boxG(2.6, 2.6, 2.7, -0.9, 1.3, 0, 0x1b1c1c), boxG(3, 0.15, 2.9, -0.9, 3.9, 0, 0x262626), cylG(0.35, 0.45, 1.3, 6.4, 2.8, 0, 0x151515, 10), cylG(0.5, 0.5, 0.6, 4.2, 2.9, 0, 0x151515, 10), boxG(9.8, 0.5, 2.6, 2.1, 0.7, 0, 0x202020), boxG(4.2, 2.2, 2.6, -4.6, 0.8, 0, 0x1b1c1c));
    for (const wx of [5.6, 4.1, 2.6, 1.1]) for (const s of [-1, 1]) parts.push(cylG(0.75, 0.75, 0.15, wx, 0.75, s * 1.0, 0x7a2b24, 16, Math.PI / 2));
    grp.add(shade(new T.Mesh(merge(parts), std({ vertexColors: true, roughness: 0.45, metalness: 0.35 })))); x = -7.2 - spec.len / 2;
  } else {
    const nose = kind === 'emu' ? 0xe6e6e2 : 0xd8a63a;
    parts.push(boxG(18, spec.h, 3, 0, 0.9, 0, kind === 'emu' ? 0xe6e6e2 : 0x2f5872), boxG(0.6, 1.2, 2.9, 9.2, 2.1, 0, nose), boxG(17.6, 0.2, 2.9, 0, 0.9 + spec.h, 0, spec.roof));
    if (kind === 'emu') parts.push(boxG(2.4, 0.5, 2.2, 3, 4.7, 0, 0x2a2a2a));
    grp.add(shade(new T.Mesh(merge(parts), std({ vertexColors: true, roughness: 0.5, metalness: 0.2 })))); x = -9.2 - spec.len / 2 - 0.6;
  }
  for (let k = 0; k < spec.n; k++) {
    const g = new T.BoxGeometry(spec.len, spec.h, 3); g.translate(0, 0.9 + spec.h / 2, 0); paint(g, spec.body);
    const m = new T.Mesh(g, bodyM); m.position.x = x; grp.add(shade(m));
    const roof = new T.Mesh(boxG(spec.len - 0.2, 0.25, 2.9, 0, 0.9 + spec.h, 0, spec.roof), std({ vertexColors: true })); roof.position.x = x; grp.add(shade(roof));
    for (const bx of [-spec.len / 2 + 2.5, spec.len / 2 - 2.5]) { const b = new T.Mesh(boxG(2.4, 0.8, 2.4, bx, 0.15, 0, 0x1c1c1c), std({ vertexColors: true })); b.position.x = x; grp.add(b); }
    x -= spec.len + 0.6;
  }
  return grp;
}

// ═════ 年代街景 ═════
export function buildEra(era, osm, models) {
  const g = new T.Group(); g.name = 'era-' + era.id;
  const r = rng(Number(era.year)); const nightMats = [], wetMats = [], glows = [], movers = [], lampSpots = [];
  const wet = m => { wetMats.push({ m, rough: m.roughness, color: m.color.clone() }); return m; };

  // ── 地面 ──
  const groundMat = wet(std({ map: tex(era.roads === 'asphalt' ? 'brushed_concrete_03.jpg' : 'gravel_road.jpg', 160), color: era.roads === 'earth' ? 0xc2ab8a : era.roads === 'gravel' ? 0xc8b89c : 0xb9b4a8, roughness: 0.95 }));
  const ground = new T.Mesh(new T.PlaneGeometry(1600, 1600), groundMat); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; g.add(ground);
  // 站前廣場鋪面
  const plazaMat = wet(std({ map: tex(era.plaza === 'earth' ? 'gravel_road.jpg' : 'plaza-pavers.jpg', 1), color: era.plaza === 'earth' ? 0xb79e7a : era.plaza === 'gravel' ? 0xcdbd9e : 0xd8d0c0, roughness: 0.8 }));
  const pg = new T.PlaneGeometry(98, 22); pg.rotateX(-Math.PI / 2); pg.translate(-4, 0.04, 31.5); const uvp = pg.attributes.uv; for (let i = 0; i < uvp.count; i++) uvp.setXY(i, uvp.getX(i) * 98 / 6, uvp.getY(i) * 22 / 6);
  g.add(shade(new T.Mesh(pg, plazaMat), false));
  // 道路
  const roadMat = wet(std({ map: tex(era.roads === 'asphalt' ? 'worn_asphalt.jpg' : 'gravel_road.jpg', 1), color: era.roads === 'earth' ? 0xa88d6c : era.roads === 'gravel' ? 0xb4a587 : 0x8d8d8a, roughness: era.roads === 'asphalt' ? 0.9 : 0.97 }));
  const curbMat = wet(std({ color: era.roads === 'asphalt' ? 0xbdb8ab : 0xb7a990, roughness: 0.9 }));
  const roadList = osm ? osm.roads.filter(rd => era.blocks === 'osm' ? true : era.blocks === 'postwar' ? rd.kind !== 'service' : rd.main && /^(北門路|中山路)/.test(rd.name)) : [];
  const roadG = [], curbG = [], lineG = [];
  for (const rd of roadList) {
    roadG.push(ribbon(rd.pts, rd.width, 0.06, 10));
    if (era.roads === 'asphalt' && rd.kind !== 'service') {
      for (const s of [-1, 1]) { const off = rd.pts.map((p, i) => { const a = rd.pts[Math.max(0, i - 1)], b = rd.pts[Math.min(rd.pts.length - 1, i + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [p[0] - (b[1] - a[1]) / L * s * (rd.width / 2 + 1.6), p[1] + (b[0] - a[0]) / L * s * (rd.width / 2 + 1.6)]; }); curbG.push(ribbon(off, 3.2, 0.14, 4)); }
      if (rd.width > 7) lineG.push(ribbon(rd.pts, 0.15, 0.075, 1));
    }
  }
  if (roadG.length) g.add(shade(new T.Mesh(merge(roadG), roadMat), false));
  if (curbG.length) g.add(shade(new T.Mesh(merge(curbG), curbMat), false));
  if (lineG.length) g.add(new T.Mesh(merge(lineG), std({ color: 0xe8e2cf, roughness: 0.6 })));
  // 圓環
  if (era.plaza === 'roundabout') {
    const isl = new T.Mesh(new T.CylinderGeometry(1, 1, 0.45, 64), wet(std({ color: 0xbdb5a3, roughness: 0.85 }))); isl.scale.set(ISLAND.rx, 1, ISLAND.rz); isl.position.set(ISLAND.x, 0.22, ISLAND.z); g.add(shade(isl, false));
    const lawn = new T.Mesh(new T.CylinderGeometry(1, 1, 0.5, 64), std({ color: era.id === '1970' ? 0x5f7a43 : 0x587a3a, roughness: 1 })); lawn.scale.set(ISLAND.rx - 1.5, 1, ISLAND.rz - 1.5); lawn.position.set(ISLAND.x, 0.25, ISLAND.z); g.add(shade(lawn, false));
    // 花帶（2009 照片可見彩色花壇）
    const flowers = []; for (let k = 0; k < 220; k++) { const a = r() * Math.PI * 2, d = 0.55 + r() * 0.12; flowers.push(M4(ISLAND.x + Math.cos(a) * ISLAND.rx * d, 0.5, ISLAND.z + Math.sin(a) * ISLAND.rz * d, r() * 3, 0.6 + r() * 0.5)); }
    g.add(instanced(new T.IcosahedronGeometry(0.6, 1), std({ roughness: 0.9 }), flowers, flowers.map(() => [0xc7384a, 0xe8b13a, 0xd96b8f, 0xf0e6d2][r() * 4 | 0])));
  }

  // ── 街廓 ──
  if (osm) buildBlocks(g, era, osm, r, nightMats);

  // ── 樹木、棕櫚 ──
  const trees = [], palms = [];
  for (const rd of roadList.filter(x => x.main)) for (let k = 1; k < rd.pts.length; k++) {
    const [ax, az] = rd.pts[k - 1], [bx, bz] = rd.pts[k], L = Math.hypot(bx - ax, bz - az);
    for (let d = 6; d < L; d += era.year < 1950 ? 16 : 11) for (const s of [-1, 1]) {
      const t = d / L, x = ax + (bx - ax) * t - (bz - az) / L * s * (rd.width / 2 + 2.4), z = az + (bz - az) * t + (bx - ax) / L * s * (rd.width / 2 + 2.4);
      if (inRailZone(x, z) || Math.hypot(x, z) > 330 || inIsland(x, z, 2) || (z < 46 && z > 16 && Math.abs(x + 4) < 80)) continue;
      if (r() < 0.75) trees.push([x, z, 0.8 + r() * 0.5]);
    }
  }
  if (era.plaza === 'roundabout') for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; if (Math.sin(a) < -0.55) continue; palms.push([ISLAND.x + Math.cos(a) * (ISLAND.rx - 5), ISLAND.z + Math.sin(a) * (ISLAND.rz - 5), 0.95 + r() * 0.15]); }
  if (era.year > 1950) for (const x of [-46, -38, 30, 38]) palms.push([x, 26 + (x > 0 ? 2 : 0), 1 + r() * 0.1]);
  // 1936 正面構圖：左側棕櫚、右側大冠幅樹（全台車站〈10台南〉參考）
  if (era.id === '1936') { palms.push([-34, 30, 0.8]); trees.push([30, 30, 1.6], [42, 34, 1.3]); }
  if (era.id === '1920') trees.push([-40, 34, 1.4], [36, 33, 1.2]);
  if (trees.length) {
    const trunkM = std({ color: 0x5a4636, roughness: 0.95 }), leafM = std({ vertexColors: true, roughness: 0.9 });
    const tm = [], cm = [[], [], []];
    for (const [x, z, s] of trees) { tm.push(M4(x, 0, z, 0, s)); cm[(r() * 3) | 0].push(new T.Matrix4().compose(new T.Vector3(x, 5.6 * s, z), new T.Quaternion().setFromEuler(new T.Euler(0, r() * 6, 0)), new T.Vector3(4.2 * s, 3.6 * s * (0.9 + r() * 0.3), 4.2 * s))); }
    g.add(instanced(cylG(0.35, 0.22, 5.2, 0, 0, 0, 0x5a4636, 7), trunkM, tm));
    cm.forEach((list, i) => list.length && g.add(instanced(canopyGeo(i * 11 + 3, r), leafM, list)));
  }
  if (palms.length) g.add(instanced(palmGeo(), std({ vertexColors: true, roughness: 0.85, side: T.DoubleSide }), palms.map(([x, z, s]) => M4(x, 0.3, z, r() * 6, s))));

  // ── 站前銅像 ──
  if (era.statue) {
    const bronze = std({ color: era.statue === 'goto' ? 0x3c3a32 : 0x4a4436, roughness: 0.4, metalness: 0.75 });
    const stone = wet(std({ color: era.statue === 'goto' ? 0xbdb3a0 : 0xa9a296, roughness: 0.75 }));
    const sx = era.statue === 'goto' ? -27 : ISLAND.x, sz = era.statue === 'goto' ? 56 : ISLAND.z;   // 後藤像確切位置未查得（明信片可見位於廣場一側），推估
    const ped = era.statue === 'goto' ? merge([boxG(7, 0.5, 7, sx, 0, sz, 0xffffff), boxG(5.4, 0.5, 5.4, sx, 0.5, sz, 0xffffff), boxG(2.6, 4.6, 2.6, sx, 1.0, sz, 0xffffff), boxG(3.1, 0.4, 3.1, sx, 5.6, sz, 0xffffff)]) : merge([boxG(4, 0.6, 4, sx, 0.45, sz, 0xffffff), boxG(2.2, 4, 2.2, sx, 1.05, sz, 0xffffff), boxG(2.6, 0.3, 2.6, sx, 5.05, sz, 0xffffff)]);
    g.add(shade(new T.Mesh(ped, stone)));
    const top = era.statue === 'goto' ? 6.0 : 5.35;
    const fig = merge([cylG(0.42, 0.55, 1.6, sx, top + 0.9, sz, 0xffffff, 12), cylG(0.48, 0.4, 0.95, sx, top, sz, 0xffffff, 12), cylG(0.2, 0.24, 0.35, sx, top + 2.5, sz, 0xffffff, 8), new T.SphereGeometry(0.3, 12, 10).translate(sx, top + 3.05, sz), cylG(0.12, 0.12, 1.2, sx + 0.55, top + 1.4, sz, 0xffffff, 6, 0, 0.3), cylG(0.12, 0.12, 1.2, sx - 0.55, top + 1.4, sz, 0xffffff, 6, 0, -0.3)].map(x => { if (!x.attributes.color) paint(x, 0xffffff); return x; }));
    g.add(shade(new T.Mesh(fig, bronze)));
  }

  // ── 路燈 ──
  const lampPts = [];
  for (let x = -46; x <= 40; x += 14) lampPts.push([x, 40.5]);
  if (era.plaza === 'roundabout') for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 + 0.3; lampPts.push([ISLAND.x + Math.cos(a) * (ISLAND.rx + 9), ISLAND.z + Math.sin(a) * (ISLAND.rz + 9)]); }
  for (const rd of roadList.filter(x => x.main)) for (let k = 1; k < rd.pts.length; k++) { const [ax, az] = rd.pts[k - 1], [bx, bz] = rd.pts[k], L = Math.hypot(bx - ax, bz - az); for (let d = 10; d < L; d += 32) { const t = d / L, x = ax + (bx - ax) * t - (bz - az) / L * (rd.width / 2 + 1), z = az + (bz - az) * t + (bx - ax) / L * (rd.width / 2 + 1); if (!inRailZone(x, z) && Math.hypot(x, z) < 300 && !inIsland(x, z, 3)) lampPts.push([x, z]); } }
  const H = era.year < 1950 ? 4.6 : era.year < 2000 ? 7.5 : 9;
  const poleG = era.year < 1950 ? merge([cylG(0.13, 0.08, H, 0, 0, 0, 0x2f322e, 8), cylG(0.24, 0.24, 0.6, 0, 0, 0, 0x2f322e, 8), boxG(0.9, 0.08, 0.08, 0, H - 0.2, 0, 0x2f322e)]) : merge([cylG(0.14, 0.1, H, 0, 0, 0, 0x8c918f, 8), boxG(1.8, 0.12, 0.12, 0.9, H - 0.1, 0, 0x8c918f), boxG(0.7, 0.16, 0.36, 1.75, H - 0.25, 0, 0x6c706f)]);
  g.add(instanced(poleG, std({ vertexColors: true, roughness: 0.5, metalness: 0.5 }), lampPts.map(([x, z]) => M4(x, 0, z, Math.atan2(-(z - 88), x - 5)))));
  const bulbM = new T.MeshStandardMaterial({ color: 0xfff4dd, emissive: 0xffc27a, emissiveIntensity: 0.1 }); nightMats.push({ m: bulbM, k: 8, kind: 'bulb' });
  const bulbOff = era.year < 1950 ? [0, H + 0.15, 0] : [1.75, H - 0.38, 0];
  g.add(instanced(era.year < 1950 ? new T.SphereGeometry(0.28, 12, 8) : new T.BoxGeometry(0.6, 0.06, 0.3), bulbM, lampPts.map(([x, z]) => { const a = Math.atan2(-(z - 88), x - 5); return M4(x + Math.cos(a) * bulbOff[0], bulbOff[1], z - Math.sin(a) * bulbOff[0]); })));
  const poolM = new T.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0, color: 0xffd9a0 });
  const pool = new T.PlaneGeometry(1, 1); pool.rotateX(-Math.PI / 2);
  g.add(instanced(pool, poolM, lampPts.map(([x, z]) => { const a = Math.atan2(-(z - 88), x - 5); return M4(x + Math.cos(a) * bulbOff[0], 0.16, z - Math.sin(a) * bulbOff[0], 0, era.year < 1950 ? 10 : 15, 1); })));
  glows.push(poolM); lampPts.forEach(p => lampSpots.push([p[0], bulbOff[1], p[1]]));

  // ── 鐵道 ──
  if (era.rail) buildRail(g, era, models, wet, r);
  if (era.works) buildWorks(g, r);
  if (era.rearStation) {
    const rs = new T.Mesh(boxG(60, 9, 16, 10, 0, -96, 0xe9e6dd), std({ vertexColors: true })); g.add(shade(rs));
    const sign = new T.Mesh(new T.PlaneGeometry(10, 1.8), std({ map: signTexture('臺南後站', { w: 512, h: 96, font: '900 72px serif', fg: '#1d4c8f' }) })); sign.position.set(10, 7.4, -87.9); g.add(sign);
  }
  if (era.id === '2026') {   // 臨時後站（2021 啟用）與地下站出入口（示意）
    g.add(shade(new T.Mesh(boxG(30, 6, 12, 20, 0, -96, 0xd9dcda), std({ vertexColors: true }))));
    for (const x of [-60, 60]) g.add(shade(new T.Mesh(merge([boxG(9, 0.25, 6, x, 3.2, -14, 0x6f7a7c), boxG(0.25, 3.2, 0.25, x - 4.3, 0, -11.2, 0x6f7a7c), boxG(0.25, 3.2, 0.25, x + 4.3, 0, -11.2, 0x6f7a7c), boxG(8, 3.1, 0.1, x, 0, -16.9, 0x9fb5bd)]), std({ vertexColors: true, roughness: 0.3, metalness: 0.4 }))));
  }

  // ── 人與車 ──
  buildTraffic(g, era, r, movers);
  buildPeople(g, era, r, movers);

  return { group: g, nightMats, wetMats, glows, movers, lampSpots };
}

function buildBlocks(g, era, osm, r, nightMats) {
  const kind = era.blocks, tint = { tile: [0xc9b897, 0xb9a785, 0xd4c4a2], shophouse: [0xe1d6bd, 0xd3c3a2, 0xcab9a0, 0xe4dccb, 0xbfb299], postwar: [0xe3ddcf, 0xd2cfc2, 0xc9c1ae, 0xb8bfba, 0xd9d2bf], osm: [0xe4e1d9, 0xd0cfca, 0xbfc2c0, 0xd8d0c0, 0xc8c3b6, 0xa9afaf] }[kind];
  const facKind = kind === 'osm' ? 'modern' : kind === 'postwar' ? 'postwar' : 'shophouse';
  const { day, night } = facadeTextures(facKind), gtex = groundTexture(facKind === 'modern' ? 'modern' : 'old');
  const wallM = new T.MeshStandardMaterial({ map: day, vertexColors: true, roughness: 0.85, side: T.DoubleSide, emissiveMap: night, emissive: 0xffffff, emissiveIntensity: 0 });
  nightMats.push({ m: wallM, k: 1.1, kind: 'window' });
  const groundM = new T.MeshStandardMaterial({ map: gtex, vertexColors: true, roughness: 0.8, side: T.DoubleSide });
  const roofM = new T.MeshStandardMaterial({ color: kind === 'tile' ? 0x55595a : 0x9a968c, roughness: 0.95, side: T.DoubleSide });
  const tileRoofM = new T.MeshStandardMaterial({ map: tex('roof_09.jpg', 1), color: 0x6c6a66, roughness: 0.8, side: T.DoubleSide });
  const walls = [], grounds = [], roofs = [], tileRoofs = [];
  const mainRoads = osm.roads.filter(x => x.main);
  for (const b of osm.buildings) {
    const p = b.pts.slice(0, -1); if (p.length < 3) continue;
    const cx = p.reduce((s, v) => s + v[0], 0) / p.length, cz = p.reduce((s, v) => s + v[1], 0) / p.length, R = Math.hypot(cx, cz);
    if (R > 560 || inRailZone(cx, cz) || inIsland(cx, cz, 4)) continue;
    let area = 0; for (let i = 0; i < p.length; i++) { const [ax, az] = p[i], [bx, bz] = p[(i + 1) % p.length]; area += ax * bz - bx * az; } area = Math.abs(area / 2);
    let h, floor0 = 3.6, levels;
    if (kind === 'osm') { levels = b.levels || (b.height ? b.height / 3.4 : 2 + ((cx * 7 + cz * 13) & 3)); h = b.height || levels * 3.4; }
    else {
      if (area > (kind === 'postwar' ? 2600 : 900) || area < 25) continue;
      const d = distToRoads(cx, cz, mainRoads); if (d > (kind === 'postwar' ? 60 : kind === 'shophouse' ? 26 : 20)) continue;
      levels = kind === 'tile' ? 1 : kind === 'shophouse' ? (r() < 0.25 ? 3 : 2) : 3 + (r() * 3 | 0);
      if (kind === 'tile' && r() < 0.3) continue;
      h = kind === 'tile' ? 4.2 : levels * 3.5;
    }
    if (b.name === '遠東百貨' && kind === 'osm') { h = 24; }
    const col = tint[(r() * tint.length) | 0], floor = kind === 'osm' ? 3.4 : 3.5, bay = kind === 'osm' ? 3.2 : 3.8;
    grounds.push(paint(extrudeFootprint(p, floor0, bay, floor0), col));
    if (h > floor0 + 0.5) walls.push(paint(extrudeFootprint(p, h - floor0, bay, floor, floor0), col));
    if (kind === 'tile') {
      const o = obb(p), rise = Math.min(o.wid, 9) * 0.32, sh = new T.Shape([new T.Vector2(-o.wid / 2 - 0.5, 0), new T.Vector2(o.wid / 2 + 0.5, 0), new T.Vector2(0, rise)]);
      const rg = new T.ExtrudeGeometry(sh, { depth: o.len + 0.8, bevelEnabled: false }); rg.translate(0, 0, -(o.len + 0.8) / 2); rg.rotateY(Math.PI / 2 - o.ang); rg.translate(o.cx, h, o.cz);
      const uv = rg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 3, uv.getY(i) / 3); tileRoofs.push(rg);
    } else {
      roofs.push(roofCap(p, h));
      if (kind === 'shophouse') walls.push(paint(extrudeFootprint(p, 0.9, bay, floor, h), col));   // 女兒牆
    }
  }
  if (kind === 'osm') {   // 遠東百貨圓柱雙塔（OSM 僅有裙樓與頂部；外形依照片推估）
    const glassM = new T.MeshStandardMaterial({ color: 0x5f8f9c, roughness: 0.12, metalness: 0.65, map: canvasTex(64, 256, (c, W, H2) => { c.fillStyle = '#e8eef0'; c.fillRect(0, 0, W, H2); for (let y = 0; y < H2; y += 8) { c.fillStyle = '#9fb3b8'; c.fillRect(0, y, W, 2); } }) });
    glassM.map.repeat.set(8, 6);
    for (const [x, z, rad, hh] of [[45, -176, 13, 146], [60, -186, 14.5, 134]]) { const t = new T.Mesh(new T.CylinderGeometry(rad, rad, hh, 40), glassM); t.position.set(x, hh / 2 + 20, z); g.add(shade(t)); }
    nightMats.push({ m: glassM, k: 0, kind: 'none' });
  }
  if (grounds.length) g.add(shade(new T.Mesh(merge(grounds), groundM)));
  if (walls.length) g.add(shade(new T.Mesh(merge(walls), wallM)));
  if (roofs.length) g.add(shade(new T.Mesh(merge(roofs), roofM)));
  if (tileRoofs.length) g.add(shade(new T.Mesh(merge(tileRoofs), tileRoofM)));
  // 亭仔腳／騎樓遮陽與店招（只寫行業別，示意）
  if (kind === 'postwar' || kind === 'osm') {
    const words = kind === 'postwar' ? ['旅社', '西藥', '冰果室', '布行', '五金', '照相', '書局', '餅舖', '鐘錶'] : ['便利商店', '咖啡', '藥局', '眼鏡', '手機', '旅店', '牛肉湯', '早餐'];
    const signs = new T.Group(); let n = 0;
    for (const b of osm.buildings) {
      if (n > 90) break; const p = b.pts; const cx = p.reduce((s, v) => s + v[0], 0) / p.length, cz = p.reduce((s, v) => s + v[1], 0) / p.length;
      if (Math.hypot(cx, cz) > 260 || inRailZone(cx, cz) || inIsland(cx, cz, 4) || distToRoads(cx, cz, mainRoads) > 14 || r() < 0.4) continue;
      let best = null; for (let i = 1; i < p.length; i++) { const [ax, az] = p[i - 1], [bx, bz] = p[i], mx = (ax + bx) / 2, mz = (az + bz) / 2, d = distToRoads(mx, mz, mainRoads); if (Math.hypot(bx - ax, bz - az) > 4 && (!best || d < best.d)) best = { d, ax, az, bx, bz, mx, mz }; }
      if (!best) continue;
      const word = words[(r() * words.length) | 0], vertical = kind === 'postwar' || r() < 0.5;
      const bg = ['#b8312f', '#f3efe4', '#1f4e8c', '#e2b23c', '#2e6b4f'][(r() * 5) | 0], fg = bg === '#f3efe4' || bg === '#e2b23c' ? '#7d1d18' : '#fbf6e8';
      const tx = vertical ? canvasTex(96, 96 * word.length, (c, W, H2) => { c.fillStyle = bg; c.fillRect(0, 0, W, H2); c.fillStyle = fg; c.font = '900 78px serif'; c.textAlign = 'center'; [...word].forEach((ch, i) => c.fillText(ch, W / 2, 80 + i * 96)); }) : signTexture(word, { bg, fg, w: 128 * word.length, h: 128, font: '900 96px sans-serif' });
      const m = new T.Mesh(vertical ? new T.BoxGeometry(0.15, 1 * word.length, 1) : new T.PlaneGeometry(1.1 * word.length, 1.1), new T.MeshStandardMaterial({ map: tx, emissiveMap: tx, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.6 }));
      const nx = -(best.bz - best.az), nz = best.bx - best.ax, L = Math.hypot(nx, nz), cxn = best.mx - cx, czn = best.mz - cz, sgn = (nx * cxn + nz * czn) > 0 ? 1 : -1;
      const ux = nx / L * sgn, uz = nz / L * sgn;
      if (vertical) { m.position.set(best.mx + ux * 0.8, 4.2 + word.length * 0.5, best.mz + uz * 0.8); m.rotation.y = Math.atan2(ux, uz) + Math.PI / 2; m.material.map.repeat.set(1, 1); }
      else { m.position.set(best.mx + ux * 0.12, 3.9, best.mz + uz * 0.12); m.rotation.y = Math.atan2(ux, uz); }
      signs.add(m); nightMats.push({ m: m.material, k: 0.9, kind: 'sign' }); n++;
    }
    g.add(signs);
  }
}

function buildRail(g, era, models, wet, r) {
  const ballastM = wet(std({ map: tex('gravel_road.jpg', 1), color: 0x8d877c, roughness: 1 }));
  const bal = []; for (const z of TRACKS) { const b = new T.PlaneGeometry(400, 3.6); b.rotateX(-Math.PI / 2); b.translate(0, 0.08, z); const uv = b.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 100, uv.getY(i)); bal.push(b); }
  g.add(shade(new T.Mesh(merge(bal), ballastM), false));
  const railM = std({ color: 0x6d625a, roughness: 0.35, metalness: 0.8 }), rails = [];
  for (const z of TRACKS) for (const s of [-0.5335, 0.5335]) rails.push(boxG(400, 0.16, 0.08, 0, 0.2, z + s, 0xffffff));
  g.add(shade(new T.Mesh(merge(rails), railM)));
  const sl = []; for (const z of TRACKS) for (let x = -200; x < 200; x += 0.65) sl.push(M4(x, 0.12, z));
  g.add(instanced(new T.BoxGeometry(0.22, 0.12, 2.1), std({ color: era.year < 1980 ? 0x5a4636 : 0x8c8a84, roughness: 0.95 }), sl));
  // 月臺
  const platM = wet(std({ map: tex('brushed_concrete_03.jpg', 1), color: 0xb8b0a0, roughness: 0.85 }));
  for (const p of PLATFORMS) {
    const len = 170, d = p.z1 - p.z0, geo = new T.BoxGeometry(len, p.h, d); geo.translate(-10, p.h / 2, (p.z0 + p.z1) / 2);
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 4, uv.getY(i) * d / 4);
    g.add(shade(new T.Mesh(geo, platM)));
    for (const z of [p.z0 + 0.25, p.z1 - 0.25]) { if (p.z1 === -21 && z > -25) continue; g.add(new T.Mesh(boxG(len, 0.02, era.year > 1990 ? 0.3 : 0.4, -10, p.h, z, era.year > 1990 ? 0xe9c43a : 0xe7e1d0), std({ vertexColors: true }))); }
  }
  // 鋼軌雨棚（GLB 單元，沿 x 每 6 m）
  if (models.canopy) for (const p of PLATFORMS) {
    const zc = p.z1 === -21 ? -28 : (p.z0 + p.z1) / 2, list = [];
    for (let x = -78; x <= 54; x += 6) list.push(x);
    for (const x of list) { const c = models.canopy.clone(); c.position.set(x, p.h, zc); g.add(c); }
  }
  // 1936 落成照：第一月臺地下道入口欄杆
  if (era.year >= 1936) g.add(shade(new T.Mesh(merge([boxG(6, 0.9, 0.06, 14, 0.9, -24.3, 0x222222), boxG(0.06, 0.9, 3.4, 11, 0.9, -26, 0x222222), boxG(0.06, 0.9, 3.4, 17, 0.9, -26, 0x222222), boxG(5.8, 0.05, 3.3, 14, 0.85, -26, 0x111111)]), std({ vertexColors: true, metalness: 0.6, roughness: 0.4 }))));
  // 架空線（2019）
  if (era.catenary) {
    const parts = []; for (let x = -180; x <= 180; x += 45) { parts.push(boxG(0.3, 7.5, 0.3, x, 0, -59, 0x8f9493), boxG(0.12, 0.12, 22, x, 7.1, -48, 0x8f9493)); }
    for (const z of TRACKS) parts.push(boxG(360, 0.03, 0.03, 0, 6.4, z, 0x333333), boxG(360, 0.03, 0.03, 0, 6.95, z, 0x333333));
    g.add(new T.Mesh(merge(parts), std({ vertexColors: true, metalness: 0.6, roughness: 0.4 })));
  }
  // 列車：停靠第一月臺旁股道
  if (era.train) { const tr = trainSet(era.train); tr.position.set(46, 0.25, TRACKS[0]); g.add(tr); }
  // 月臺候車人群在 buildPeople
}

function buildWorks(g, r) {
  // 舊軌道拆除後的地面廊帶：整地、施工圍籬、新植樹苗（示意）
  const dirt = new T.PlaneGeometry(400, 40); dirt.rotateX(-Math.PI / 2); dirt.translate(0, 0.07, -42);
  const uv = dirt.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 50, uv.getY(i) * 5);
  g.add(shade(new T.Mesh(dirt, std({ map: tex('gravel_road.jpg', 1), color: 0xa08a6c, roughness: 1 })), false));
  const fence = []; for (let x = -190; x < 190; x += 2.2) for (const z of [-22, -62]) fence.push(boxG(2.15, 2.4, 0.05, x, 0, z, (Math.floor(x / 2.2) & 1) ? 0xe9ece8 : 0x4f8a5a));
  g.add(shade(new T.Mesh(merge(fence), std({ vertexColors: true, roughness: 0.6, metalness: 0.2 }))));
  const sap = []; for (let k = 0; k < 40; k++) sap.push(M4(-150 + k * 7.5 + r() * 2, 0, -46 + r() * 10, 0, 0.5 + r() * 0.2));
  g.add(instanced(merge([cylG(0.12, 0.08, 2.4, 0, 0, 0, 0x5a4636, 6), paint(new T.IcosahedronGeometry(1.1, 1).translate(0, 2.8, 0), 0x6a8a45)]), std({ vertexColors: true }), sap));
  const mach = merge([boxG(6, 2.2, 2.6, 0, 0.6, 0, 0xe0b12f), boxG(2.4, 1.8, 2.2, -1.2, 2.8, 0, 0xe0b12f), boxG(5.5, 0.4, 0.4, 3.4, 3.6, 0, 0xd4a42a), boxG(6.2, 0.6, 2.8, 0, 0, 0, 0x2a2a2a)]);
  g.add(shade(new T.Mesh(mach, std({ vertexColors: true, roughness: 0.6 })).translateX(-40).translateZ(-40)));
}

// ── 車流（沿圓環與北門路循環）──
function buildTraffic(g, era, r, movers) {
  const types = { rickshaw: [['rickshaw', 0x2b2521, 10]], early: [['bike', 0x3f4b55, 10], ['oldcar', 0x1d1f1f, 3], ['oldbus', 0x5a6e5c, 1], ['rickshaw', 0x2b2521, 4]], postwar: [['bus', 0xd9c9a2, 3], ['scooter', 0x9a3b2e, 14], ['car', 0x2f4f6f, 6], ['bike', 0x3f4b55, 8], ['car', 0xd8d1bf, 3]], modern: [['bus', 0xf0f0ec, 3], ['scooter', 0x777b7f, 24], ['car', 0xf0f0f0, 7], ['car', 0x2a2f33, 7], ['car', 0xf2c21c, 4], ['car', 0x8c1f22, 3]] }[era.traffic];
  const ring = t => [ISLAND.x + Math.cos(t) * (ISLAND.rx + 6.5), ISLAND.z + Math.sin(t) * (ISLAND.rz + 6.5), Math.atan2(Math.cos(t) * (ISLAND.rz + 6.5), -Math.sin(t) * (ISLAND.rx + 6.5)) + Math.PI];
  const street = (dir, lane) => t => { const L = 560, x = ((t * 40) % L + L) % L - L / 2; return [dir > 0 ? x : -x, lane, dir > 0 ? Math.PI * 0 : Math.PI]; };
  for (const [kind, color, n] of types) {
    const geo = vehicleGeo(kind, 0xffffff), cols = [], list = [];
    for (let i = 0; i < n; i++) {
      const pathKind = era.plaza === 'roundabout' ? (r() < 0.45 ? 'ring' : 'street') : (r() < 0.25 ? 'plaza' : 'street');
      const speed = (kind === 'rickshaw' ? 0.06 : kind === 'bike' ? 0.09 : kind === 'scooter' ? 0.2 : 0.16) * (0.8 + r() * 0.4);
      const lane = [36.2, 39.4, 43.0, 45.8][(r() * 4) | 0], dir = lane < 41 ? 1 : -1;
      list.push({ path: pathKind === 'ring' ? ring : pathKind === 'plaza' ? (t => [-4 + Math.cos(t) * 30, 32 + Math.sin(t) * 6, Math.atan2(Math.cos(t) * 6, -Math.sin(t) * 30) + Math.PI]) : street(dir, lane), t: r() * 100, speed: pathKind === 'street' ? speed * 3 : speed });
      const c = new T.Color(color).offsetHSL(0, 0, (r() - 0.5) * 0.08); cols.push(c);
    }
    const mesh = new T.InstancedMesh(geo, std({ vertexColors: true, roughness: 0.45, metalness: kind === 'car' || kind === 'bus' ? 0.35 : 0.1 }), n);
    cols.forEach((c, i) => mesh.setColorAt(i, c)); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
    const m = new T.Matrix4();
    movers.push(dt => { list.forEach((v, i) => { v.t += dt * v.speed; const [x, z, a] = v.path(v.t); mesh.setMatrixAt(i, m.compose(new T.Vector3(x, 0.05, z), new T.Quaternion().setFromEuler(new T.Euler(0, a, 0)), new T.Vector3(1, 1, 1))); }); mesh.instanceMatrix.needsUpdate = true; });
    movers[movers.length - 1](0);
  }
}

// ── 行人（站前廣場、月臺、人行道）──
function buildPeople(g, era, r, movers) {
  const pal = { '1920': [0xe8e4d8, 0x2c3b4f, 0x1f1f1f, 0xd9d0bb, 0x40525e], '1936': [0xeeeae0, 0x2d3a48, 0x262626, 0xc9b994, 0x5d5446], '1970': [0xf0ece2, 0x4a6074, 0x7b4b3a, 0xd5c48f, 0x30373b], '2019': [0x2b2f33, 0xe9e9e4, 0x5a7fa3, 0xb84a3c, 0xd6c6a2, 0x3d5a4b], '2026': [0x2b2f33, 0xe9e9e4, 0x5a7fa3, 0xb84a3c, 0xd6c6a2, 0x6b7d8f] }[era.id];
  const n = era.year < 1950 ? 90 : 140, list = [], geo = personGeo(), cols = [];
  const zones = [[-48, 42, 22, 40, 0], [-35, 30, -30, -22, 0.9]]; if (!era.rail) zones[1] = [-40, 40, 23, 26, 0];
  for (let i = 0; i < n; i++) {
    const zn = i < n * 0.78 ? zones[0] : zones[1], x = zn[0] + r() * (zn[1] - zn[0]), z = zn[2] + r() * (zn[3] - zn[2]);
    list.push({ x, z, y: zn[4], a: r() * Math.PI * 2, v: r() < 0.6 ? 0.8 + r() * 0.6 : 0, zn, s: 0.92 + r() * 0.16 }); cols.push(new T.Color(pal[(r() * pal.length) | 0]));
  }
  const mesh = new T.InstancedMesh(geo, std({ vertexColors: true, roughness: 0.85 }), n); cols.forEach((c, i) => mesh.setColorAt(i, c)); mesh.castShadow = true; g.add(mesh);
  const m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
  movers.push((dt) => {
    list.forEach((p, i) => {
      if (p.v) { p.x += Math.sin(p.a) * p.v * dt; p.z += Math.cos(p.a) * p.v * dt; if (p.x < p.zn[0] || p.x > p.zn[1] || p.z < p.zn[2] || p.z > p.zn[3]) { p.a += Math.PI + (Math.random() - 0.5); p.x = Math.min(p.zn[1], Math.max(p.zn[0], p.x)); p.z = Math.min(p.zn[3], Math.max(p.zn[2], p.z)); } }
      mesh.setMatrixAt(i, m.compose(new T.Vector3(p.x, p.y, p.z), q.setFromEuler(e.set(0, p.a, 0)), new T.Vector3(p.s, p.s, p.s)));
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  movers[movers.length - 1](0);
}
