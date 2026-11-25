import * as THREE from 'three';
import { CORE, heightAt, baseHeight, riverInfo, fbm, noise2, smooth, clamp, SANDO, ROAD_N_EAST, ROAD_N_WEST, ZHONGSHAN, RAIL, RIVER, shrineLocal, TERRACES, SHRINE, mulberry } from './geo.js';
import { G, patch } from './materials.js';

// ---------- 高程快取格網 ----------
const GN = 640; const GS = (2 * CORE) / GN;
export const HGRID = new Float32Array((GN + 1) * (GN + 1));
let gridReady = false;
export function buildGrid() {
  for (let j = 0; j <= GN; j++) for (let i = 0; i <= GN; i++) HGRID[j * (GN + 1) + i] = heightAt(-CORE + i * GS, -CORE + j * GS);
  gridReady = true;
}
export function hAt(x, z) {
  if (!gridReady || Math.abs(x) >= CORE || Math.abs(z) >= CORE) return heightAt(x, z);
  const fx = (x + CORE) / GS, fz = (z + CORE) / GS, i = Math.min(GN - 1, Math.floor(fx)), j = Math.min(GN - 1, Math.floor(fz)), u = fx - i, v = fz - j, W = GN + 1;
  const a = HGRID[j * W + i], b = HGRID[j * W + i + 1], c = HGRID[(j + 1) * W + i], d = HGRID[(j + 1) * W + i + 1];
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
export function slopeFast(x, z) { const e = 5; return Math.hypot(hAt(x + e, z) - hAt(x - e, z), hAt(x, z + e) - hAt(x, z - e)) / (2 * e); }

// ---------- 地表彩圖（每個時期一張） ----------
const TEX = 2048;
const w2c = (x, z) => [(x + CORE) / (2 * CORE) * TEX, (z + CORE) / (2 * CORE) * TEX];
const PX = TEX / (2 * CORE);

function baseCanvas() {
  const N = 1024, img = new ImageData(N, N), d = img.data;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -CORE + (i + 0.5) / N * 2 * CORE, z = -CORE + (j + 0.5) / N * 2 * CORE;
    const h = hAt(x, z), s = slopeFast(x, z), n = fbm(x * 0.02, z * 0.02, 3), n2 = noise2(x * 0.11, z * 0.11);
    const { d: rd, w } = riverInfo(x, z);
    let r, g, b;
    if (h > 11 || s > 0.35) { // 山林地被
      const t = clamp(n * 0.8 + 0.5, 0, 1);
      r = 34 + t * 22 + n2 * 8; g = 58 + t * 30 + n2 * 10; b = 30 + t * 12;
      if (s > 0.9) { r += 40; g += 26; b += 14; }
    } else { // 平地草地
      r = 104 + n * 30 + n2 * 10; g = 122 + n * 26 + n2 * 10; b = 66 + n * 12;
    }
    // 河岸沙洲與泥灘
    const shore = 1 - smooth(w * 0.5 - 14, w * 0.5 + 12, rd);
    if (shore > 0) { r = r * (1 - shore) + (150 + n2 * 14) * shore; g = g * (1 - shore) + (138 + n2 * 12) * shore; b = b * (1 - shore) + (108 + n2 * 10) * shore; }
    const k = (j * N + i) * 4; d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255;
  }
  const c = document.createElement('canvas'); c.width = c.height = N; c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

function strokePath(ctx, pl, width, color, dash) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width * PX; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); pl.forEach((p, i) => { const [u, v] = w2c(p[0], p[1]); i ? ctx.lineTo(u, v) : ctx.moveTo(u, v); }); ctx.stroke(); ctx.restore();
}
function poly(ctx, pts, color) { ctx.fillStyle = color; ctx.beginPath(); pts.forEach((p, i) => { const [u, v] = w2c(p[0], p[1]); i ? ctx.lineTo(u, v) : ctx.moveTo(u, v); }); ctx.closePath(); ctx.fill(); }

// 平原地塊：南岸與西北岸，避開河、丘、道路
function* plots(seed, cell = 34) {
  const r = mulberry(seed);
  for (let z = -CORE; z < CORE; z += cell) for (let x = -CORE; x < CORE; x += cell * 1.4) {
    const cx = x + cell * 0.7, cz = z + cell * 0.5;
    const h = hAt(cx, cz), rv = riverInfo(cx, cz);
    if (h > 8.5 || rv.d < rv.w * 0.5 + 16 || slopeFast(cx, cz) > 0.12) continue;
    yield { x, z, w: cell * 1.4, d: cell, r: r(), cx, cz };
  }
}

function paddies(ctx, seed, keep) {
  for (const p of plots(seed)) {
    if (!keep(p.cx, p.cz, p.r)) continue;
    const ang = 0.12 + noise2(p.cx * 0.002, p.cz * 0.002) * 0.4;
    const [u, v] = w2c(p.cx, p.cz);
    ctx.save(); ctx.translate(u, v); ctx.rotate(ang);
    const W = p.w * PX, D = p.d * PX, t = p.r;
    const cols = t < 0.18 ? ['#7c9a6a', '#8eab74'] : t < 0.4 ? ['#a9b86c', '#b9c57a'] : t < 0.55 ? ['#c7b979', '#d2c487'] : t < 0.7 ? ['#6f8f88', '#89a6a0'] : ['#93ad62', '#a1bb6d'];
    ctx.fillStyle = cols[0]; ctx.fillRect(-W / 2, -D / 2, W, D);
    ctx.fillStyle = cols[1]; for (let k = 0; k < 4; k++) ctx.fillRect(-W / 2 + k * W / 4 + 1, -D / 2 + 1, W / 4 - 2, D - 2);
    ctx.strokeStyle = 'rgba(92,80,52,.55)'; ctx.lineWidth = 1.2; ctx.strokeRect(-W / 2, -D / 2, W, D);
    ctx.restore();
  }
}

function urban(ctx, seed, dens, color, keep) {
  const r = mulberry(seed);
  for (const p of plots(seed + 7, 26)) {
    if (!keep(p.cx, p.cz, p.r)) continue;
    if (p.r > dens) continue;
    const [u, v] = w2c(p.cx, p.cz); const W = p.w * PX, D = p.d * PX;
    const g = Math.floor(r() * 26);
    ctx.fillStyle = color(g); ctx.fillRect(u - W / 2, v - D / 2, W, D);
  }
}

function precinct(ctx, era) {
  // 神社台地：白砂
  for (const t of TERRACES) {
    const [x, z] = shrineLocal(t.s, t.u); const [u, v] = w2c(x, z);
    ctx.save(); ctx.translate(u, v); ctx.rotate(-Math.atan2(SHRINE.dir[0], SHRINE.dir[1]));
    ctx.fillStyle = era <= 1 ? '#d8d2c0' : era === 2 ? '#b8b3a6' : '#8f8d88';
    ctx.fillRect(-t.w / 2 * PX, -t.d / 2 * PX, t.w * PX, t.d * PX); ctx.restore();
  }
}

export function eraCanvases() {
  const base = baseCanvas();
  const out = [];
  const inSouth = (x, z) => z > 60 && Math.abs(x) < 1900;
  for (let era = 0; era < 4; era++) {
    const c = document.createElement('canvas'); c.width = c.height = TEX; const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true; ctx.drawImage(base, 0, 0, TEX, TEX);
    // 田與城
    if (era === 0) paddies(ctx, 11, (x, z, r) => r < 0.92 && Math.hypot(x + 300, z - 190) > 120);
    if (era === 1) { paddies(ctx, 11, (x, z, r) => Math.hypot(x + 300, z - 190) > 120 && !(inSouth(x, z) && Math.abs(x) < 380 && z < 900)); urban(ctx, 3, 0.75, g => `rgb(${120 + g},${110 + g},${98 + g})`, (x, z) => inSouth(x, z) && Math.abs(x) < 380 && z < 900); }
    if (era === 2) { paddies(ctx, 11, (x, z, r) => r < 0.6 && (z < -100 || x < -900 || x > 900)); urban(ctx, 5, 0.9, g => `rgb(${112 + g},${108 + g},${100 + g})`, (x, z) => (inSouth(x, z) && Math.abs(x) < 1100) || (z > -100 && x < -420)); }
    if (era === 3) {
      urban(ctx, 9, 1.0, g => `rgb(${96 + g},${98 + g},${100 + g})`, (x, z) => !(Math.hypot(x + 300, z - 190) < 110));
      // 河濱公園：沿兩岸亮綠帶
      strokePath(ctx, RIVER.slice(10, 150), 0, 'rgba(0,0,0,0)');
    }
    // 河濱
    if (era === 3) {
      ctx.save(); ctx.globalCompositeOperation = 'source-over';
      for (const side of [-1, 1]) {
        const pl = RIVER.map((p, i) => { const q = RIVER[Math.min(RIVER.length - 1, i + 1)], o = RIVER[Math.max(0, i - 1)]; const dx = q[0] - o[0], dz = q[1] - o[1], L = Math.hypot(dx, dz) || 1; return [p[0] - dz / L * side * (p[2] * 0.5 + 26), p[1] + dx / L * side * (p[2] * 0.5 + 26)]; });
        strokePath(ctx, pl, 40, '#6f9c57'); strokePath(ctx, pl, 5, '#c9a27a');
      }
      ctx.restore();
    }
    // 道路
    const roadCol = ['#bfae8a', '#c9c1ad', '#6f6d69', '#3e3f42'][era];
    const roadW = [8, 16, 22, 34][era];
    strokePath(ctx, ZHONGSHAN, roadW, roadCol);
    if (era >= 1) strokePath(ctx, ZHONGSHAN, 2, era === 1 ? '#9bab83' : era === 3 ? '#d8d6cf' : '#8a8a80', era === 3 ? [8, 10] : null);
    strokePath(ctx, ROAD_N_EAST, [6, 8, 11, 18][era], roadCol);
    strokePath(ctx, ROAD_N_WEST, [6, 8, 11, 18][era], roadCol);
    strokePath(ctx, RAIL, era === 3 ? 18 : 7, era === 3 ? '#77756f' : '#6e6253');
    // 參道
    strokePath(ctx, SANDO, era <= 1 ? 11 : 9, era <= 1 ? '#e1d9c3' : era === 2 ? '#7a7872' : '#46474a');
    if (era <= 1) strokePath(ctx, SANDO, 13.5, 'rgba(110,100,80,.35)', [2, 7]);
    precinct(ctx, era);
    // 南岸圓山腳廣場（兒童樂園 → 再春游泳池 → 今日美術公園）
    if (era >= 2) { const [u, v] = w2c(-60, 120); ctx.fillStyle = era === 2 ? '#a79f8c' : '#8ea07a'; ctx.fillRect(u - 90 * PX, v - 40 * PX, 160 * PX, 70 * PX); }
    out.push(c);
  }
  return out;
}

// ---------- 地形網格 ----------
export function buildTerrain(canvases, quality) {
  const group = new THREE.Group();
  const seg = quality === 'low' ? 320 : GN;
  const geo = new THREE.PlaneGeometry(2 * CORE, 2 * CORE, seg, seg); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, hAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();

  const texs = canvases.map(c => { const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; });
  const U = { tA: { value: texs[0] }, tB: { value: texs[0] }, uMix: { value: 0 }, uCore: { value: CORE }, uUrban: { value: 0 } };
  const mat = patch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 }), {
    dissolve: false, wet: true, key: 'terrain', uniforms: U,
    frag: s => s.replace('#include <common>', `#include <common>
uniform sampler2D tA; uniform sampler2D tB; uniform float uMix; uniform float uCore; uniform float uUrban;`)
      .replace('#include <map_fragment>', `
vec2 tuv = (vWPos.xz + uCore) / (2.0 * uCore);
vec3 ca = texture2D(tA, tuv).rgb, cb = texture2D(tB, tuv).rgb;
float sweep = smoothstep(uMix * 1.3 - 0.3, uMix * 1.3, vn3(vWPos * 0.01) * 0.4 + clamp(length(vWPos - uWave) / 1400.0, 0.0, 1.0) * 0.6);
vec3 col = mix(ca, cb, sweep);
// 細節：草紋、亮暗斑
float dn = vn3(vWPos * 0.35) * 0.5 + vn3(vWPos * 1.7) * 0.3 + vn3(vWPos * 0.06) * 0.6;
col *= 0.82 + 0.3 * dn;
// 遠方：程序化色彩
vec2 ed = abs(vWPos.xz) - uCore + 120.0;
float outside = smoothstep(0.0, 120.0, max(ed.x, ed.y));
float hgt = vWPos.y;
vec3 nW = normalize(cross(dFdx(vWPos), dFdy(vWPos)));
float slope = 1.0 - nW.y;
vec3 forest = mix(vec3(0.10, 0.17, 0.09), vec3(0.20, 0.27, 0.13), vn3(vWPos * 0.004) );
vec3 plain = mix(vec3(0.42, 0.47, 0.27), vec3(0.55, 0.53, 0.34), vn3(vWPos * 0.003));
vec3 city = mix(vec3(0.42, 0.42, 0.42), vec3(0.58, 0.56, 0.52), vn3(vWPos * 0.02));
vec3 farc = mix(plain, forest, smoothstep(14.0, 40.0, hgt) );
farc = mix(farc, city, uUrban * (1.0 - smoothstep(10.0, 60.0, hgt)));
farc = mix(farc, farc * 0.75 + vec3(0.07, 0.06, 0.04), smoothstep(0.5, 0.9, slope));
col = mix(col, farc * (0.85 + 0.3 * dn), outside);
diffuseColor.rgb *= col;
`),
  });
  mat.userData.U = U; mat.userData.texs = texs;
  const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true; mesh.name = 'terrain';
  group.add(mesh);

  // 外圈遠景地形（極座標，至 18 km）
  const R0 = CORE * 0.97, R1 = 18000, NR = quality === 'low' ? 70 : 110, NA = quality === 'low' ? 180 : 300;
  const fp = [], idx = [];
  for (let j = 0; j <= NR; j++) {
    const t = j / NR, r = R0 + (R1 - R0) * Math.pow(t, 2.1);
    for (let i = 0; i <= NA; i++) {
      const a = i / NA * Math.PI * 2; let x = Math.cos(a) * r, z = Math.sin(a) * r;
      // 方形核心外緣：第一圈貼合正方形邊界
      if (j === 0) { const m = Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))); x = Math.cos(a) / m * (CORE - 2); z = Math.sin(a) / m * (CORE - 2); }
      let y = j === 0 ? hAt(x, z) : baseHeight(x, z);
      if (j > 0) { const rv = riverInfo(x, z); y = Math.min(y, -3 + 6 * smooth(rv.w * 0.45, rv.w * 0.5 + 60, rv.d) + y * smooth(rv.w * 0.5, rv.w * 0.5 + 120, rv.d)); if (Math.abs(x) < CORE && Math.abs(z) < CORE) y -= 3; }
      fp.push(x, y, z);
    }
  }
  for (let j = 0; j < NR; j++) for (let i = 0; i < NA; i++) { const a = j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); fg.setIndex(idx); fg.computeVertexNormals();
  const far = new THREE.Mesh(fg, mat); far.receiveShadow = false; group.add(far);
  return { group, mat, mesh };
}
