import * as THREE from 'three';
import { centroid, hash01, pointInPolygon } from '../geo.js';
import { WALL_TILE, GROUND_TILE } from '../textures.js';

export const GROUND_FLOOR_H = 4.0;
export const FLOOR_H = 3.2;

// 把一個時代的建物全部合併成少數幾個 Mesh（每種材質一個），手機也跑得動。
// 每個三角形記錄它屬於哪一棟，點選編輯時用來反查。
export class Acc {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.owner = []; }
  tri(a, b, c, ua, ub, uc, owner) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    this.pos.push(...a, ...b, ...c); this.nor.push(nx, ny, nz, nx, ny, nz, nx, ny, nz); this.uv.push(...ua, ...ub, ...uc); this.owner.push(owner);
  }
  quad(a0, b0, b1, a1, uv, owner) { // a0,b0 底；a1,b1 頂（從外面看逆時針：a0→b1→b0、a0→a1→b1）
    this.tri(a0, b1, b0, uv[0], uv[2], uv[1], owner); this.tri(a0, a1, b1, uv[0], uv[3], uv[2], owner);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    return g;
  }
}

export function walls(acc, ring, y0, y1, vOrigin, tileW, tileH, owner) {
  let u = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 0.2) continue;
    const u0 = -u / tileW, u1 = -(u + len) / tileW; u += len; // 負號：從外面看文字不會左右顛倒
    const v0 = (y0 - vOrigin) / tileH, v1 = (y1 - vOrigin) / tileH;
    acc.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], owner);
  }
}
export function cap(acc, ring, y, owner, scale = 8) {
  const contour = ring.map(p => new THREE.Vector2(p[0], p[1]));
  let faces; try { faces = THREE.ShapeUtils.triangulateShape(contour, []); } catch { return; }
  for (const [i, j, k] of faces) {
    const a = [ring[i][0], y, ring[i][1]], b = [ring[j][0], y, ring[j][1]], c = [ring[k][0], y, ring[k][1]];
    const cr = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]); // y 分量
    const uv = p => [p[0] / scale, p[2] / scale];
    if (cr >= 0) acc.tri(a, b, c, uv(a), uv(b), uv(c), owner); else acc.tri(a, c, b, uv(a), uv(c), uv(b), owner);
  }
}
function hipRoof(acc, ring, y, rise, shrink, owner) {
  const [cx, cz] = centroid(ring);
  const top = ring.map(p => [cx + (p[0] - cx) * shrink, cz + (p[1] - cz) * shrink]);
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    const a0 = [ring[i][0], y, ring[i][1]], b0 = [ring[j][0], y, ring[j][1]];
    const a1 = [top[i][0], y + rise, top[i][1]], b1 = [top[j][0], y + rise, top[j][1]];
    const len = Math.hypot(b0[0] - a0[0], b0[2] - a0[2]) / 8, sl = Math.hypot(rise, (1 - shrink) * 6) / 8;
    acc.quad(a0, b0, b1, a1, [[0, 0], [len, 0], [len, sl], [0, sl]], owner);
  }
  cap(acc, top, y + rise, owner);
}
function square(cx, cz, w) { const h = w / 2; return [[cx - h, cz - h], [cx + h, cz - h], [cx + h, cz + h], [cx - h, cz + h]]; }

// 主要入口：依時代規則 + 編輯圖層，生成建物 Mesh
export function buildBuildings(base, era, edits, library, landmarkIndex) {
  const accs = {}; const get = (style, part) => (accs[style + '|' + part] ||= new Acc());
  const index = []; const signs = [];
  const fd = edits.global.floorsDelta; const floorsDelta = (typeof fd === 'number' ? fd : fd?.[era.id]) || 0;
  const eraEdits = edits.eras[era.id]?.buildings || {};
  // 有專屬模型的地標（如臺中驛）：其輪廓內的其他 OSM 小建物（附屬、雨棚）不重複畫
  const customRings = base.buildings.filter(b => landmarkIndex.get(b.id)?.custom).map(b => b.ring);
  const custom = [];
  for (const b of base.buildings) {
    const lm = landmarkIndex.get(b.id) || null;
    if (!lm && customRings.some(r => { const [cx, cz] = centroid(b.ring); return pointInPolygon(cx, cz, r); })) continue;
    const spec = era.building(b, lm);
    if (!spec) continue;
    const ed = eraEdits[b.id] || {};
    if (ed.hidden) { index.push({ b, spec, lm, hidden: true }); continue; }
    const keep = lm || b.tags.historic; // 古蹟不套用全域樓層增減
    let levels = ed.levels ?? Math.max(1, Math.round(spec.levels + (keep ? 0 : floorsDelta)));
    if (ed.style && library[ed.style]) spec.style = ed.style;
    if (spec.custom) { index.push({ b, spec, lm, levels, custom: spec.custom }); custom.push(index[index.length - 1]); continue; }
    const owner = index.length;
    index.push({ b, spec, lm, levels });
    const style = library[spec.style] ? spec.style : 'modernTile';
    const minH = spec.canopy ? 3 : (spec.minLevel || 0) * FLOOR_H;
    const H = spec.canopy ? 3.6 : minH + GROUND_FLOOR_H + (levels - 1) * FLOOR_H;
    const groundTop = Math.min(H, minH + GROUND_FLOOR_H);
    const shop = spec.storefront || spec.arcade;
    walls(get(style, shop ? 'ground' : 'wall'), b.ring, minH, groundTop, shop ? minH : minH - 0.6, shop ? GROUND_TILE.w : WALL_TILE.w, shop ? GROUND_TILE.h : WALL_TILE.h, owner);
    if (H > groundTop + 0.01) walls(get(style, 'wall'), b.ring, groundTop, H, groundTop, WALL_TILE.w, WALL_TILE.h, owner);
    if (minH > 0) cap(get(style, 'roof'), b.ring.slice().reverse(), minH, owner); // 底面（騎樓頂）
    const roofAcc = get(style, 'roof');
    if (spec.roof === 'hip') hipRoof(roofAcc, b.ring, H, Math.min(7, Math.sqrt(b.area) * 0.22), 0.3, owner);
    else if (spec.roof === 'mansard') hipRoof(roofAcc, b.ring, H, 3.2, 0.78, owner);
    else cap(roofAcc, b.ring, H, owner);
    if (spec.tower) { // 鐘塔／圓頂
      const [cx, cz] = towerSpot(b.ring);
      const sq = square(cx, cz, spec.tower.w);
      walls(get(style, 'wall'), sq, H, H + spec.tower.h, H, WALL_TILE.w, WALL_TILE.h, owner);
      hipRoof(roofAcc, sq, H + spec.tower.h, spec.tower.dome ? 4 : 5, spec.tower.dome ? 0.25 : 0.05, owner);
    }
    if (era.signs && spec.storefront && levels >= 3) collectSigns(b, H, signs);
  }
  const group = new THREE.Group(); group.name = 'buildings';
  const meshes = [];
  for (const [key, acc] of Object.entries(accs)) {
    if (!acc.pos.length) continue;
    const [style, part] = key.split('|');
    const src = library[style][part];
    const mat = new THREE.MeshStandardMaterial({ map: src.map, roughness: style === 'glass' && part === 'wall' ? 0.25 : 0.88, metalness: style === 'glass' && part === 'wall' ? 0.35 : 0.0 });
    if (src.emissiveMap) { mat.emissiveMap = src.emissiveMap; mat.emissive = new THREE.Color(1, 1, 1); mat.emissiveIntensity = 0; mat.userData.night = true; }
    const mesh = new THREE.Mesh(acc.geometry(), mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.owner = Int32Array.from(acc.owner);
    mesh.userData.pickable = true;
    group.add(mesh); meshes.push(mesh);
  }
  return { group, index, meshes, signs, custom };
}

function towerSpot(ring) { // 塔放在最長那一邊的中點內側（通常是正立面）
  let best = 0, bi = 0;
  for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > best) { best = l; bi = i; } }
  const a = ring[bi], b = ring[(bi + 1) % ring.length];
  const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; const [cx, cz] = centroid(ring);
  return [mx + (cx - mx) * 0.25, mz + (cz - mz) * 0.25];
}

function collectSigns(b, H, out) {
  const ring = b.ring;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c = ring[(i + 1) % ring.length];
    const dx = c[0] - a[0], dz = c[1] - a[1]; const len = Math.hypot(dx, dz);
    if (len < 7 || hash01(b.id, 50 + i) > 0.55) continue;
    const t = 0.15 + hash01(b.id, 80 + i) * 0.7;
    const nx = dz / len, nz = -dx / len; // 外法線
    const h = Math.min(5, H - 5.5); if (h < 2) continue;
    out.push({ x: a[0] + dx * t + nx * 0.7, z: a[1] + dz * t + nz * 0.7, y: 4.8 + h / 2, h, angle: Math.atan2(dx, dz), slot: Math.floor(hash01(b.id, 90 + i) * 8) });
  }
}

export function buildSigns(signs, atlas) {
  const group = new THREE.Group(); group.name = 'signs';
  const bySlot = Array.from({ length: 8 }, () => []);
  for (const s of signs) bySlot[s.slot].push(s);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  bySlot.forEach((list, slot) => {
    if (!list.length) return;
    const g = new THREE.PlaneGeometry(1, 1);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, (slot + uv.getX(i) * 0.94 + 0.03) / 8);
    const mat = new THREE.MeshStandardMaterial({ map: atlas.map, emissiveMap: atlas.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0, side: THREE.DoubleSide, roughness: 0.6 });
    mat.userData.night = true; mat.userData.nightBoost = 1.6;
    const im = new THREE.InstancedMesh(g, mat, list.length);
    list.forEach((s, k) => { e.set(0, s.angle, 0); q.setFromEuler(e); v.set(s.x, s.y, s.z); sc.set(1.1, s.h, 1); m.compose(v, q, sc); im.setMatrixAt(k, m); });
    im.castShadow = true;
    group.add(im);
  });
  return group;
}

// 地標對照：OSM 名稱或座標 → 地標定義
export function indexLandmarks(base, landmarks, lonLatToXZ) {
  const map = new Map(); const found = {};
  for (const lm of landmarks) {
    let hit = null;
    if (lm.footprint) hit = base.buildings.find(b => b.id === 'lm-' + lm.key);
    else if (lm.osmName) hit = base.buildings.filter(b => b.tags.name === lm.osmName).sort((a, b) => b.area - a.area)[0];
    else if (lm.lon) { const [x, z] = lonLatToXZ(lm.lon, lm.lat); hit = base.buildings.filter(b => !b.infill && pointInPolygon(x, z, b.ring)).sort((a, b) => a.area - b.area)[0]; }
    if (hit) { map.set(hit.id, lm); found[lm.key] = hit; }
  }
  return { map, found };
}
