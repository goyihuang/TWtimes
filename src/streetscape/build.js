// 把 OSM 街廓變成 three.js 場景：建物（程序化臺灣街屋立面）、道路、人行道、鐵道、水域、綠地、行道樹、
// 頂樓水塔與加蓋、路燈。全部依種子決定，種子相同 → 同一個場景（可分享、可重現）。
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, ribbon as kitRibbon, obb, glowTex } from '../tainan/kit.js';
import { FLOOR, BAY, heightOf, roadWidth, MAJOR, WALKWAY, num } from './rules.js';
export { FLOOR, BAY, heightOf, roadWidth };

// 平面幾何一律朝上（逐三角形檢查繞向；down=true 則朝下）
export function faceUp(g, down = false) {
  const p = g.attributes.position, ix = g.index ? g.index.array : null, n = ix ? ix.length : p.count;
  const v = i => (ix ? ix[i] : i);
  for (let i = 0; i < n; i += 3) {
    const a = v(i), b = v(i + 1), c = v(i + 2);
    const ux = p.getX(b) - p.getX(a), uz = p.getZ(b) - p.getZ(a), wx = p.getX(c) - p.getX(a), wz = p.getZ(c) - p.getZ(a);
    const ny = uz * wx - ux * wz; // (u × w).y
    if ((ny < 0) !== down && ny !== 0) { if (ix) { ix[i + 1] = c; ix[i + 2] = b; } else for (const k of ['position', 'normal', 'uv']) { const at = g.attributes[k]; if (!at) continue; for (let d = 0; d < at.itemSize; d++) { const t = at.array[(i + 1) * at.itemSize + d]; at.array[(i + 1) * at.itemSize + d] = at.array[(i + 2) * at.itemSize + d]; at.array[(i + 2) * at.itemSize + d] = t; } } }
  }
  const nn = g.attributes.normal; if (nn) for (let i = 0; i < nn.count; i++) nn.setXYZ(i, 0, down ? -1 : 1, 0);
  return g;
}
const ribbon = (...a) => faceUp(kitRibbon(...a));


// ── 幾何工具 ──
const closeRing = pts => { const p = pts.slice(); const a = p[0], b = p[p.length - 1]; if (p.length > 2 && Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6) p.pop(); return p; };
export const areaOf = pts => { let s = 0; for (let i = 0; i < pts.length; i++) { const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length]; s += ax * bz - bx * az; } return s / 2; };
const centroid = pts => { let x = 0, z = 0; for (const p of pts) { x += p[0]; z += p[1]; } return [x / pts.length, z / pts.length]; };
export function inside([x, z], pts) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }
function offsetLine(pts, d) {
  return pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz) || 1; return [p[0] - dz / L * d, p[1] + dx / L * d]; });
}
// 只保留範圍內的折線段（範圍外的路段切掉）
function clipRuns(pts, R) { const runs = []; let cur = []; for (const p of pts) { if (Math.hypot(p[0], p[1]) <= R) cur.push(p); else { if (cur.length > 1) runs.push(cur); cur = []; } } if (cur.length > 1) runs.push(cur); return runs; }
function walkLine(pts, step, fn) { let carry = step / 2; for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az); if (!L) continue; let t = carry; while (t < L) { fn(ax + (bx - ax) * t / L, az + (bz - az) * t / L, (bx - ax) / L, (bz - az) / L); t += step; } carry = t - L; } }
function flatPoly(pts, y) {
  const ring = closeRing(pts); if (ring.length < 3) return null;
  const v2 = ring.map(([x, z]) => new T.Vector2(x, z));
  let tris; try { tris = T.ShapeUtils.triangulateShape(v2, []); } catch { return null; }
  if (!tris.length) return null;
  const pos = new Float32Array(ring.length * 3), uv = new Float32Array(ring.length * 2);
  ring.forEach(([x, z], i) => { pos.set([x, y, z], i * 3); uv.set([x / 8, z / 8], i * 2); });
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2));
  const idx = []; for (const [a, b, c] of tris) idx.push(a, b, c); g.setIndex(idx); g.setAttribute('normal', new T.BufferAttribute(new Float32Array(ring.length * 3), 3));
  return faceUp(g);
}
const mergeOr = list => { const gs = list.filter(Boolean).map(g => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); return g.index ? g.toNonIndexed() : g; }); return gs.length ? mergeGeometries(gs, false) : null; };

// ── 立面材質：一張 MeshStandardMaterial，著色器依 fuv（u＝沿牆開間、v＝樓層）畫窗、店面、招牌帶、鐵窗；夜間窗光 ──
export function facadeMaterial() {
  const m = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0, envMapIntensity: 0.6 });
  const uni = { uNight: { value: 0 }, uClay: { value: 0 }, uWet: { value: 0 } };
  m.userData.uniforms = uni;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 fuv; varying vec2 vF; varying float vUp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvF = fuv; vUp = normal.y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec2 vF; varying float vUp; uniform float uNight, uClay, uWet;
      float fh(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      float bx(vec2 c, float x0, float x1, float y0, float y1){ return step(x0, c.x) * step(c.x, x1) * step(y0, c.y) * step(c.y, y1); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      vec3 fEmit = vec3(0.); float fGlass = 0.;
      if (uClay < .5) {
        float roof = step(.5, vUp);
        vec2 c = fract(vF), id = floor(vF); float fl = id.y, bld = floor(vF.x / 997.);
        float hb = fh(vec2(bld, 7.1)), hw = fh(id + 0.37), hs = fh(vec2(id.x, bld) + 3.3);
        // 屋頂：水泥、防水漆斑
        if (roof > .5) { diffuseColor.rgb *= .74 + .16 * fh(floor(vF * 2.)) ; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.55,.6,.58), step(.82, hb) * .5); }
        else if (fl < .5) {
          // 一樓：店面玻璃、鐵捲門、招牌帶
          float glass = bx(c, .06, .94, 0., .64), shutter = step(.72, hs) * glass, band = bx(c, 0., 1., .7, .94) * step(.25, hb + .3 * hs);
          vec3 sc = hs < .2 ? vec3(.72,.14,.11) : hs < .4 ? vec3(.12,.27,.6) : hs < .55 ? vec3(.88,.68,.14) : hs < .7 ? vec3(.12,.46,.32) : vec3(.92,.91,.86);
          diffuseColor.rgb = mix(diffuseColor.rgb * .78, vec3(.13,.15,.16), glass * (1. - shutter));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.62,.63,.6) * (.85 + .15 * step(.5, fract(c.y * 14.))), shutter);
          diffuseColor.rgb = mix(diffuseColor.rgb, sc, band);
          fGlass = glass * (1. - shutter);
          fEmit = vec3(1., .84, .62) * glass * (1. - shutter) * step(.3, hw) * .5 + sc * band * .4;
        } else {
          // 樓上：窗、窗台、鐵窗（約半數）、冷氣
          float win = bx(c, .17, .83, .3, .82), bars = step(.5, hw) * win * max(step(.88, fract(c.x * 6.)), step(.86, fract(c.y * 5.)));
          float ac = step(.84, hw) * bx(c, .62, .8, .14, .28);
          diffuseColor.rgb *= 1. - .1 * bx(c, .14, .86, .26, .3);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.17,.2,.22), win);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.33,.34,.33), bars);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.86,.86,.84), ac);
          fGlass = win * (1. - bars);
          fEmit = vec3(1., .76, .48) * win * (1. - bars * .6) * step(fh(id + bld) , .3) * .45;
        }
        diffuseColor.rgb *= 1. - .12 * fh(floor(vF * vec2(1., 3.))) * (1. - roof);
      }
      diffuseColor.rgb *= 1. - uWet * .25;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor * (1. - uWet * .5), .12, fGlass);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += fEmit * uNight;');
  };
  m.customProgramCacheKey = () => 'twtimes-facade-v1';
  return m;
}

const WALLS = ['#d9d2c3', '#e7e2d6', '#c9c3b5', '#dacbb3', '#c0c5bf', '#e4d8c9', '#cdd5d1', '#d7c1b0', '#b8bab3', '#ece8de', '#d9b8a6', '#a9bead', '#c7b49b'];

// 建物：一個合併幾何（位置、法線、fuv、頂點色）
function buildings(ways, P, r) {
  const pos = [], nor = [], fuv = [], col = [], info = [];
  const color = new T.Color();
  for (const w of ways) {
    const t = w.tags; if (!(t.building || t['building:part']) || t.location === 'underground' || t.building === 'no') continue;
    if (t.building && w.hasParts) continue;
    let ring = closeRing(w.pts); if (ring.length < 3) continue;
    let A = areaOf(ring); if (Math.abs(A) < 6) continue;
    const c = centroid(ring); if (Math.hypot(c[0], c[1]) > P.radius * 1.05) continue;
    if (A < 0) { ring = ring.slice().reverse(); A = -A; }  // 統一逆時針（x 東 z 南的平面上）
    const { h: h0, y0, guessed } = heightOf(t, A, r); const h = guessed ? h0 * P.heightScale : h0;
    const top = y0 + h, uOff = Math.floor(r() * 400) * 997;
    color.set(t['building:colour'] && /^#?[0-9a-f]{6}$/i.test(t['building:colour']) ? (t['building:colour'][0] === '#' ? '' : '#') + t['building:colour'] : WALLS[Math.floor(r() * WALLS.length)]);
    if (P.clay) color.set('#bab6ad');
    const push = (x, y, z, nx, ny, nz, u, v) => { pos.push(x, y, z); nor.push(nx, ny, nz); fuv.push(u, v); col.push(color.r, color.g, color.b); };
    // 牆：逆時針環的外法線 = (dz, -dx)
    let run = 0;
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length], L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
      const nx = (bz - az) / L, nz = -(bx - ax) / L, u0 = uOff + Math.round(run / BAY), u1 = u0 + Math.max(1, Math.round(L / BAY)); run += L;
      const v0 = 0, v1 = h / FLOOR;
      push(ax, y0, az, nx, 0, nz, u0, v0); push(bx, top, bz, nx, 0, nz, u1, v1); push(bx, y0, bz, nx, 0, nz, u1, v0);
      push(ax, y0, az, nx, 0, nz, u0, v0); push(ax, top, az, nx, 0, nz, u0, v1); push(bx, top, bz, nx, 0, nz, u1, v1);
    }
    // 屋頂
    let tris = []; try { tris = T.ShapeUtils.triangulateShape(ring.map(([x, z]) => new T.Vector2(x, z)), []); } catch { }
    for (const tri of tris) {
      const [a, b, c] = tri.map(k => ring[k]); const ny = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
      for (const [x, z] of ny >= 0 ? [a, b, c] : [a, c, b]) push(x, top, z, 0, 1, 0, x / 3 + uOff, z / 3);
    }
    info.push({ ring, top, area: A, floors: Math.round(h / FLOOR), guessed, name: t.name, c });
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  g.setAttribute('fuv', new T.Float32BufferAttribute(fuv, 2)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return { geometry: g, info };
}

const dashTex = (() => { const c = document.createElement('canvas'); c.width = 8; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 8, 36); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t; })();
const noiseTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), r = rng(9); g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 2600; i++) { const v = 100 + r() * 70; g.fillStyle = `rgba(${v},${v},${v},${0.25 + r() * 0.3})`; g.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 3); } for (let i = 0; i < 18; i++) { g.strokeStyle = `rgba(60,60,60,${0.08 + r() * 0.1})`; g.lineWidth = 3 + r() * 12; g.beginPath(); g.moveTo(r() * 256, 0); g.lineTo(r() * 256, 256); g.stroke(); } const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; return t; })();

// ── 主函式 ──
// params: { seed, heightScale, roadScale, radius, clay, trees, props }
export function buildStreet(data, params) {
  const P = { seed: 1, heightScale: 1, roadScale: 1, radius: 350, clay: false, trees: true, props: true, ...params };
  const r = rng(P.seed * 7919 + 13), root = new T.Group(); root.name = 'streetscape';
  const mats = [], wetMats = [], nightMats = [];
  const std = (o, wet = false) => { const m = new T.MeshStandardMaterial({ roughness: 0.9, ...o }); mats.push(m); if (wet) wetMats.push({ m, rough: m.roughness, color: m.color.clone() }); return m; };
  const add = (geo, mat, { shadow = true, cast = false, order = 0 } = {}) => { if (!geo) return null; const me = new T.Mesh(geo, mat); me.receiveShadow = shadow; me.castShadow = cast; me.renderOrder = order; root.add(me); return me; };
  const R = P.radius;

  // 有 building:part 的建物外框不重複畫
  const parts = data.ways.filter(w => w.tags['building:part']);
  if (parts.length) for (const w of data.ways) if (w.tags.building && parts.some(p => inside(centroid(p.pts), closeRing(w.pts)))) w.hasParts = true;

  // 地面
  const ground = new T.Mesh(new T.CircleGeometry(R * 2.4, 72).rotateX(-Math.PI / 2), std({ color: P.clay ? 0xb9b6ae : 0xb9b3a6, map: P.clay ? null : noiseTex }, true));
  if (ground.material.map) { ground.material.map = noiseTex.clone(); ground.material.map.repeat.set(R / 6, R / 6); }
  ground.receiveShadow = true; ground.position.y = -0.02; root.add(ground);

  // 面狀：水域、綠地、停車場、月臺
  const area = { water: [], grass: [], wood: [], park: [], parking: [], platform: [] };
  for (const w of data.ways) {
    const t = w.tags, closed = w.pts.length > 3;
    if (!closed) continue;
    const c = centroid(w.pts); if (Math.hypot(c[0], c[1]) > R * 1.8) continue;
    if (t.natural === 'water' || t.waterway === 'riverbank' || t.water) area.water.push(w.pts);
    else if (t.natural === 'wood' || t.landuse === 'forest') area.wood.push(w.pts);
    else if (t.leisure === 'park' || t.leisure === 'garden' || t.landuse === 'recreation_ground' || t.landuse === 'cemetery') area.park.push(w.pts);
    else if (t.landuse === 'grass' || t.landuse === 'meadow' || t.natural === 'grassland' || t.natural === 'scrub' || t.leisure === 'pitch' || t.leisure === 'playground') area.grass.push(w.pts);
    else if (t.amenity === 'parking' && !t.building) area.parking.push(w.pts);
    else if (t.railway === 'platform' || t.public_transport === 'platform') area.platform.push(w.pts);
  }
  const waterMat = std({ color: 0x33555c, roughness: 0.06, metalness: 0.1, envMapIntensity: 1.2 });
  add(mergeOr(area.park.map(p => flatPoly(p, 0.02))), std({ color: P.clay ? 0xd2d6cc : 0x7f9a63 }), { order: 1 });
  add(mergeOr(area.grass.map(p => flatPoly(p, 0.025))), std({ color: P.clay ? 0xd2d6cc : 0x8aa76b }), { order: 1 });
  add(mergeOr(area.wood.map(p => flatPoly(p, 0.02))), std({ color: P.clay ? 0xc9cec3 : 0x55704a }), { order: 1 });
  add(mergeOr(area.parking.map(p => flatPoly(p, 0.03))), std({ color: 0x8d8a83 }, true), { order: 1 });
  add(mergeOr(area.platform.map(p => { const g = flatPoly(p, 1.05); return g; })), std({ color: 0xbcb6a8 }, true), { cast: true });
  add(mergeOr(area.water.map(p => flatPoly(p, 0.04))), waterMat, { order: 2 });

  // 線狀：道路、人行道、標線、鐵道、河道
  const roads = [], walks = [], sides = [], lines = [], ballast = [], rails = [], rivers = [], bridges = [], streetSpots = [];
  for (const w of data.ways) {
    const t = w.tags;
    if (t.highway && t.area !== 'yes' && t.tunnel !== 'yes' && !(num(t.layer) < 0) && t.highway !== 'construction' && t.highway !== 'proposed') {
      const width = roadWidth(t, P.roadScale), lift = t.bridge && num(t.layer) >= 1 ? num(t.layer) * 6.5 : 0;
      for (const run of clipRuns(w.pts, R * 1.6)) {
        if (lift) { bridges.push({ run, width, lift }); continue; }
        if (WALKWAY.has(t.highway)) { walks.push(ribbon(run, width, 0.07, 4)); continue; }
        roads.push(ribbon(run, width, 0.09, 10));
        if (MAJOR.has(t.highway) || t.highway === 'residential' || t.highway === 'unclassified') sides.push(ribbon(run, width + 3.6, 0.055, 4));
        if (MAJOR.has(t.highway) && t.oneway !== 'yes') lines.push(ribbon(run, 0.18, 0.1, 9));
        if (MAJOR.has(t.highway)) streetSpots.push({ run, width, major: true });
        else if (t.highway === 'residential' || t.highway === 'living_street') streetSpots.push({ run, width, major: false });
      }
    } else if (t.highway && t.area === 'yes' && w.pts.length > 3) walks.push(flatPoly(w.pts, 0.06));
    else if (t.railway && t.railway !== 'platform' && t.tunnel !== 'yes' && !(num(t.layer) < 0)) {
      for (const run of clipRuns(w.pts, R * 1.6)) { ballast.push(ribbon(run, 3.4, 0.06, 4)); rails.push(ribbon(offsetLine(run, 0.72), 0.09, 0.22, 4), ribbon(offsetLine(run, -0.72), 0.09, 0.22, 4)); }
    } else if (t.waterway && !['riverbank', 'dam', 'weir'].includes(t.waterway) && t.tunnel !== 'culvert') {
      const width = num(t.width) || { river: 24, canal: 12, stream: 5, drain: 3.5, ditch: 2 }[t.waterway] || 4;
      for (const run of clipRuns(w.pts, R * 1.8)) rivers.push(ribbon(run, width, 0.045, 10));
    }
  }
  const asphalt = std({ color: P.clay ? 0xb5b3ad : 0x50524f, roughness: 0.92, map: P.clay ? null : noiseTex.clone() }, true);
  if (asphalt.map) asphalt.map.repeat.set(1, 1);
  asphalt.polygonOffset = true; asphalt.polygonOffsetFactor = -2; asphalt.polygonOffsetUnits = -2;
  const side = std({ color: P.clay ? 0xd0cec6 : 0xa9a397, roughness: 0.9 }, true); side.polygonOffset = true; side.polygonOffsetFactor = -1; side.polygonOffsetUnits = -1;
  const walkM = std({ color: P.clay ? 0xd0cec6 : 0xc4b9a5, roughness: 0.88 }, true); walkM.polygonOffset = true; walkM.polygonOffsetFactor = -3; walkM.polygonOffsetUnits = -3;
  const lineM = new T.MeshStandardMaterial({ color: 0xf2efe6, alphaMap: dashTex, transparent: true, alphaTest: 0.5, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }); mats.push(lineM);
  add(mergeOr(sides), side, { order: 2 }); add(mergeOr(roads), asphalt, { order: 3 }); add(mergeOr(walks), walkM, { order: 3 });
  if (!P.clay) add(mergeOr(lines), lineM, { order: 4 });
  add(mergeOr(ballast), std({ color: 0x8a8378, roughness: 1 }), { order: 2 });
  add(mergeOr(rails), std({ color: 0x5d5a57, metalness: 0.7, roughness: 0.4 }));
  add(mergeOr(rivers), waterMat, { order: 2 });

  // 高架道路：橋面＋橋墩
  if (bridges.length) {
    const deck = [], piers = [];
    for (const { run, width, lift } of bridges) {
      const top = ribbon(run, width, lift, 10); deck.push(top);
      deck.push(faceUp(kitRibbon(run, width, lift - 1.2, 10), true));
      walkLine(run, 32, (x, z) => { const g = new T.BoxGeometry(1.6, lift - 1.2, 1.6); g.translate(x, (lift - 1.2) / 2, z); piers.push(g); });
    }
    add(mergeOr(deck), asphalt, { cast: true });
    add(mergeOr(piers), std({ color: 0xa8a49b }), { cast: true });
  }

  // 建物
  const fm = facadeMaterial(); if (P.clay) fm.userData.uniforms.uClay.value = 1;
  const B = buildings(data.ways, P, r);
  const bm = new T.Mesh(B.geometry, fm); bm.castShadow = bm.receiveShadow = true; bm.name = 'buildings'; root.add(bm);
  nightMats.push(fm); mats.push(fm);

  // 建物網格索引（行道樹避開建物）
  const cell = 20, grid = new Map();
  for (const b of B.info) { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const [x, z] of b.ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } for (let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++) for (let j = Math.floor(z0 / cell); j <= Math.floor(z1 / cell); j++) { const k = i + ',' + j; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(b); } }
  const blocked = (x, z) => (grid.get(Math.floor(x / cell) + ',' + Math.floor(z / cell)) || []).some(b => inside([x, z], b.ring));

  // 頂樓水塔、加蓋鐵皮屋（臺灣街景的天際線特徵）
  const tanks = [], sheds = [];
  if (P.props && !P.clay) for (const b of B.info) {
    if (b.floors < 2 || b.floors > 10 || b.area < 35) continue;
    const o = obb(b.ring);
    if (r() < 0.5) { const s = Math.min(o.len, o.wid); const dx = (r() - 0.5) * o.len * 0.4, dz = (r() - 0.5) * o.wid * 0.4; const c = Math.cos(o.ang), si = Math.sin(o.ang); tanks.push([o.cx + dx * c - dz * si, b.top, o.cz + dx * si + dz * c, s > 8 ? 1 : 0.8]); }
    if (b.floors >= 3 && b.floors <= 7 && r() < 0.24 && o.len > 5 && o.wid > 4) sheds.push([o.cx, b.top, o.cz, o.len * (0.45 + r() * 0.3), o.wid * (0.5 + r() * 0.3), o.ang, r()]);
  }
  if (tanks.length) {
    const g = mergeOr([new T.CylinderGeometry(0.75, 0.75, 1.5, 14).translate(0, 2.05, 0), new T.BoxGeometry(1.5, 1.3, 1.5).translate(0, 0.65, 0)]);
    const im = new T.InstancedMesh(g, std({ color: 0xd8dcdc, metalness: 0.55, roughness: 0.35 }), tanks.length); const m4 = new T.Matrix4();
    tanks.forEach(([x, y, z, s], i) => im.setMatrixAt(i, m4.compose(new T.Vector3(x, y, z), new T.Quaternion(), new T.Vector3(s, s, s)))); im.castShadow = true; root.add(im);
  }
  if (sheds.length) {
    const g = new T.BoxGeometry(1, 2.7, 1).translate(0, 1.35, 0);
    const im = new T.InstancedMesh(g, std({ color: 0xffffff, roughness: 0.55, metalness: 0.3 }), sheds.length); const m4 = new T.Matrix4(), q = new T.Quaternion(), col = new T.Color();
    const SHED = ['#7d97a6', '#9fb3a3', '#b9bdb8', '#6f8fa0', '#c9b98f'];
    sheds.forEach(([x, y, z, l, w, a, k], i) => { im.setMatrixAt(i, m4.compose(new T.Vector3(x, y, z), q.setFromAxisAngle(new T.Vector3(0, 1, 0), -a), new T.Vector3(l, 1, w))); im.setColorAt(i, col.set(SHED[Math.floor(k * SHED.length)])); });
    im.castShadow = im.receiveShadow = true; root.add(im);
  }

  // 行道樹、公園樹、單株樹
  const trees = [];
  if (P.trees) {
    for (const n of data.nodes) if (Math.hypot(...n.p) < R * 1.4) trees.push([n.p[0], n.p[1], 0.9 + r() * 0.5]);
    for (const w of data.ways) if (w.tags.natural === 'tree_row') walkLine(w.pts, 7, (x, z) => { if (Math.hypot(x, z) < R * 1.4) trees.push([x, z, 0.8 + r() * 0.4]); });
    for (const [list, per] of [[area.park, 110], [area.wood, 45]]) for (const p of list) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const [x, z] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      const n = Math.min(260, Math.abs(areaOf(closeRing(p))) / per);
      for (let k = 0, tries = 0; k < n && tries < n * 4; tries++) { const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0); if (inside([x, z], p) && Math.hypot(x, z) < R * 1.4 && !blocked(x, z)) { trees.push([x, z, 0.9 + r() * 0.7]); k++; } }
    }
    for (const { run, width, major } of streetSpots) if (major || r() < 0.3) walkLine(run, major ? 11 : 15, (x, z, dx, dz) => {
      for (const s of [1, -1]) { if (r() > 0.62) continue; const d = width / 2 + 1.3; const tx = x - dz * d * s, tz = z + dx * d * s; if (Math.hypot(tx, tz) < R * 1.2 && !blocked(tx, tz)) trees.push([tx, tz, 0.75 + r() * 0.35]); }
    });
  }
  if (trees.length) {
    const list = trees.slice(0, 5000), crown = new T.IcosahedronGeometry(2.6, 1), trunk = new T.CylinderGeometry(0.16, 0.24, 3, 6).translate(0, 1.5, 0);
    const p = crown.attributes.position; for (let i = 0; i < p.count; i++) { const k = 0.82 + 0.3 * Math.sin(p.getX(i) * 2.1 + p.getZ(i) * 1.7); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.82, p.getZ(i) * k); } crown.computeVertexNormals(); crown.translate(0, 4.6, 0);
    const ci = new T.InstancedMesh(crown, std({ color: P.clay ? 0xdfe2da : 0xffffff, roughness: 0.95, flatShading: true }), list.length), ti = new T.InstancedMesh(trunk, std({ color: P.clay ? 0xd4d1c9 : 0x5a4a3a }), list.length);
    const m4 = new T.Matrix4(), q = new T.Quaternion(), col = new T.Color();
    list.forEach(([x, z, s], i) => { m4.compose(new T.Vector3(x, 0, z), q.setFromAxisAngle(new T.Vector3(0, 1, 0), r() * 6.28), new T.Vector3(s, s * (0.9 + r() * 0.3), s)); ci.setMatrixAt(i, m4); ti.setMatrixAt(i, m4); if (!P.clay) ci.setColorAt(i, col.setHSL(0.24 + r() * 0.08, 0.32 + r() * 0.2, 0.24 + r() * 0.12)); });
    ci.castShadow = ti.castShadow = true; ci.receiveShadow = true; root.add(ci, ti);
  }

  // 路燈（夜間發光，交給 bloom）
  const lamps = [];
  if (P.props) for (const { run, width, major } of streetSpots) if (major) walkLine(run, 30, (x, z, dx, dz) => { const d = width / 2 + 0.6; const lx = x - dz * d, lz = z + dx * d; if (Math.hypot(lx, lz) < R * 1.3 && !blocked(lx, lz)) lamps.push([lx, lz, Math.atan2(dz, dx)]); });
  if (lamps.length) {
    const pole = mergeOr([new T.CylinderGeometry(0.09, 0.13, 8, 6).translate(0, 4, 0), new T.BoxGeometry(1.6, 0.12, 0.12).translate(-0.7, 7.9, 0)]);
    const bulbM = new T.MeshStandardMaterial({ color: 0xfff4dc, emissive: 0xffd9a0, emissiveIntensity: 0 }); mats.push(bulbM); nightMats.push({ lamp: bulbM });
    const pi = new T.InstancedMesh(pole, std({ color: 0x6d726f, metalness: 0.6, roughness: 0.45 }), lamps.length), bi = new T.InstancedMesh(new T.BoxGeometry(0.7, 0.18, 0.32).translate(-1.35, 7.8, 0), bulbM, lamps.length);
    const m4 = new T.Matrix4(), q = new T.Quaternion();
    lamps.forEach(([x, z, a], i) => { m4.compose(new T.Vector3(x, 0, z), q.setFromAxisAngle(new T.Vector3(0, 1, 0), -a + Math.PI / 2), new T.Vector3(1, 1, 1)); pi.setMatrixAt(i, m4); bi.setMatrixAt(i, m4); });
    pi.castShadow = true; root.add(pi, bi);
    // 路燈光池（夜間疊加在地面）
    const poolM = new T.MeshBasicMaterial({ map: glowTex, color: 0xffc98a, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }); mats.push(poolM); nightMats.push({ pool: poolM });
    const pool = new T.InstancedMesh(new T.PlaneGeometry(13, 13).rotateX(-Math.PI / 2).translate(-1.3, 0.12, 0), poolM, lamps.length);
    lamps.forEach(([x, z, a], i) => pool.setMatrixAt(i, m4.compose(new T.Vector3(x, 0, z), q.setFromAxisAngle(new T.Vector3(0, 1, 0), -a + Math.PI / 2), new T.Vector3(1, 1, 1)))); pool.renderOrder = 5; root.add(pool);
  }

  // 街口人眼鏡位：離中心最近的主要道路點
  let eye = null, best = Infinity;
  for (const { run, major } of streetSpots) for (const [x, z] of run) { const d = Math.hypot(x, z) + (major ? 0 : 25); if (d < best && d > 25) { best = d; eye = [x, z]; } }

  const stats = { buildings: B.info.length, guessed: B.info.filter(b => b.guessed).length, trees: Math.min(trees.length, 5000), roads: roads.length, tanks: tanks.length, lamps: lamps.length, tallest: B.info.reduce((m, b) => Math.max(m, b.top), 0) };
  return {
    root, stats, eye, wetMats,
    setNight(n) { fm.userData.uniforms.uNight.value = n; for (const x of nightMats) { if (x.lamp) x.lamp.emissiveIntensity = n * 6; if (x.pool) x.pool.opacity = n * 0.55; } },
    setWet(w) { fm.userData.uniforms.uWet.value = w; for (const { m, rough, color } of wetMats) { m.roughness = rough * (1 - w * 0.75); m.color.copy(color).multiplyScalar(1 - w * 0.35); } },
    dispose() { root.traverse(o => { o.geometry?.dispose?.(); }); for (const m of mats) { m.map?.dispose?.(); m.dispose(); } },
  };
}
