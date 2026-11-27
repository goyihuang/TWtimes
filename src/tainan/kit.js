// 臺南場景共用：亂數、貼圖載入、Canvas 程序貼圖、合併幾何。
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function merge(list) {
  if (!list.length) return null;
  const gs = list.map(g => g.index ? g.toNonIndexed() : g);
  const want = ['position', 'normal', 'uv', 'color'].filter(k => gs.some(g => g.attributes[k]));
  for (const g of gs) {
    for (const k of Object.keys(g.attributes)) if (!want.includes(k)) g.deleteAttribute(k);
    const n = g.attributes.position.count;
    if (want.includes('normal') && !g.attributes.normal) g.computeVertexNormals();
    if (want.includes('uv') && !g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(n * 2), 2));
    if (want.includes('color') && !g.attributes.color) g.setAttribute('color', new T.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  }
  return mergeGeometries(gs, false);
}

const loader = new T.TextureLoader();
const cache = new Map();
export function tex(file, repeat = 1, srgb = true) {
  const key = file + repeat + srgb; if (cache.has(key)) return cache.get(key);
  const t = loader.load('textures/' + file); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 8;
  if (srgb) t.colorSpace = T.SRGBColorSpace; cache.set(key, t); return t;
}
export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = T.SRGBColorSpace; return t;
}

// ── 立面貼圖（白底以頂點色調色；夜間另有窗光貼圖）──
// 每張貼圖代表：寬 bay 公尺 × 高 floor 公尺（一層）；u = 沿牆公尺 / bay，v = 高度 / floor
export function facadeTextures(kind) {
  const W = 256, H = 256, r = rng(kind.length * 97);
  const day = canvasTex(W, H, (g) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) { const v = 235 + r() * 20 | 0; g.fillStyle = `rgb(${v},${v},${v - 4})`; g.fillRect(r() * W, r() * H, 3, 3); }
    if (kind === 'modern') {
      g.fillStyle = '#cfd2d3'; g.fillRect(0, 196, W, 26);                      // 樓板帶
      g.fillStyle = '#3b4650'; g.fillRect(28, 40, 200, 140);                    // 鋁窗
      g.fillStyle = '#56636d'; g.fillRect(28, 40, 200, 18);
      g.fillStyle = '#d8dcdc'; g.fillRect(124, 40, 8, 140); g.fillRect(28, 176, 200, 6);
      g.fillStyle = '#9aa1a3'; g.fillRect(40, 186, 176, 8);                    // 冷氣／窗台
    } else if (kind === 'postwar') {
      g.fillStyle = '#d9d2c1'; g.fillRect(0, 200, W, 24);
      g.fillStyle = '#3c4440'; g.fillRect(40, 50, 176, 130);
      g.fillStyle = '#ece6d6'; for (let k = 0; k < 4; k++) g.fillRect(40 + k * 58, 50, 6, 130); g.fillRect(40, 112, 176, 6);
      g.fillStyle = 'rgba(90,80,60,.25)'; g.fillRect(36, 182, 184, 10);
    } else { // shophouse：日治街屋二樓，拱形窗與山牆線腳
      g.fillStyle = '#d6cbb2'; g.fillRect(0, 0, W, 22); g.fillRect(0, 214, W, 12);
      g.fillStyle = '#3a3f39'; g.beginPath(); g.moveTo(70, 196); g.lineTo(70, 96); g.arc(128, 96, 58, Math.PI, 0); g.lineTo(186, 196); g.fill();
      g.strokeStyle = '#e9e0cc'; g.lineWidth = 7; g.beginPath(); g.moveTo(128, 40); g.lineTo(128, 196); g.moveTo(70, 120); g.lineTo(186, 120); g.stroke();
      g.fillStyle = '#c9bea4'; g.fillRect(58, 196, 140, 14);
      g.fillStyle = '#e6dcc6'; g.fillRect(0, 22, 14, 192); g.fillRect(W - 14, 22, 14, 192);
    }
  });
  const night = canvasTex(W, H, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const lit = kind === 'shophouse' ? [70, 40, 116, 156] : kind === 'postwar' ? [46, 50, 164, 130] : [34, 58, 188, 118];
    const warm = r() > 0.3 ? '#ffcf8a' : '#d9e6ff';
    g.fillStyle = warm; g.fillRect(...lit);
  });
  day.userData = { kind };
  return { day, night };
}
// 店面（一樓）：亭仔腳陰影與店招底
export function groundTexture(kind) {
  return canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    if (kind === 'modern') { g.fillStyle = '#20262b'; g.fillRect(10, 60, 236, 196); g.fillStyle = '#7f8b92'; g.fillRect(10, 60, 236, 10); g.fillStyle = '#e5e2da'; g.fillRect(0, 0, W, 40); }
    else { g.fillStyle = '#2a2622'; g.fillRect(24, 70, 208, 186); g.fillStyle = '#efe7d3'; g.fillRect(0, 0, 24, H); g.fillRect(W - 24, 0, 24, H); g.fillStyle = '#d8ccb0'; g.fillRect(0, 0, W, 48); g.fillStyle = '#5b4b3a'; g.fillRect(36, 84, 184, 10); }
  });
}

export function signTexture(text, { bg = '#f4f1e6', fg = '#1e3f8a', font = '900 200px "Noto Serif TC", "Songti TC", serif', w = 256, h = 256, border } = {}) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); if (border) { g.strokeStyle = border; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); }
    g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + h * 0.03);
  });
}

// 地面光池（夜間路燈投在地上的暖光）
export const glowTex = canvasTex(128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,220,160,1)'); gr.addColorStop(0.35, 'rgba(255,190,120,.45)'); gr.addColorStop(1, 'rgba(255,170,90,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});

// 雲層
export const cloudTex = canvasTex(1024, 1024, (g, W, H) => {
  const r = rng(7); g.clearRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    const x = r() * W, y = r() * H, rad = 30 + r() * 120, a = 0.05 + r() * 0.12;
    for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) {
      const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x + dx, y + dy, rad, 0, Math.PI * 2); g.fill();
    }
  }
}, false);

// 雨天地面：濕度斑塊（作為 roughnessMap 調變）
export const puddleTex = canvasTex(512, 512, (g, W, H) => {
  const r = rng(21); g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) {
    const x = r() * W, y = r() * H, rad = 10 + r() * 60, gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(20,20,20,.9)'); gr.addColorStop(1, 'rgba(20,20,20,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}, false);

// 沿折線產生帶狀（道路、路緣）幾何，貼圖 u 沿寬、v 沿長（公尺 / tile）
export function ribbon(pts, width, y = 0, tile = 8) {
  const pos = [], uv = [], idx = []; let dist = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    if (i) dist += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
    const nx = -dz * width / 2, nz = dx * width / 2;
    pos.push(x + nx, y, z + nz, x - nx, y, z - nz); uv.push(0, dist / tile, width / tile, dist / tile);
    if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals(); const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); return g;
}

// 最小外接矩形（建物屋頂方向）
export function obb(pts) {
  let best = null;
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length]; const ang = Math.atan2(bz - az, bx - ax), c = Math.cos(ang), s = Math.sin(ang);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of pts) { const u = x * c + z * s, v = -x * s + z * c; x0 = Math.min(x0, u); x1 = Math.max(x1, u); z0 = Math.min(z0, v); z1 = Math.max(z1, v); }
    const area = (x1 - x0) * (z1 - z0); if (!best || area < best.area) best = { area, ang, x0, x1, z0, z1 };
  }
  const c = Math.cos(best.ang), s = Math.sin(best.ang), u = (best.x0 + best.x1) / 2, v = (best.z0 + best.z1) / 2;
  return { cx: u * c - v * s, cz: u * s + v * c, len: best.x1 - best.x0, wid: best.z1 - best.z0, ang: best.ang };
}

// 立面 UV：牆面 u = 沿牆距離 / bay、v = 高度 / floor；屋頂 u,v = 平面座標
export function extrudeFootprint(pts, h, bay, floor, y0 = 0) {
  const pos = [], uv = [], col = [];
  let area = 0; for (let i = 0; i < pts.length; i++) { const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length]; area += ax * bz - bx * az; }
  const ccw = area > 0; let run = 0;
  for (let i = 0; i < pts.length; i++) {
    let [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length]; if (!ccw) [ax, az, bx, bz] = [bx, bz, ax, az];
    const L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
    const u0 = Math.round(run / bay) , u1 = u0 + Math.max(1, Math.round(L / bay)); run += L;
    // 外側：沿 CCW（xz 平面，y 向上）時法線朝外需要調換頂點順序
    pos.push(ax, y0, az, bx, y0 + h, bz, bx, y0, bz, ax, y0, az, ax, y0 + h, az, bx, y0 + h, bz);
    const v1 = h / floor; uv.push(u0, 0, u1, v1, u1, 0, u0, 0, u0, v1, u1, v1);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  return g;
}
export function roofCap(pts, y) {
  const shape = new T.Shape(pts.map(([x, z]) => new T.Vector2(x, -z)));
  const g = new T.ShapeGeometry(shape); g.rotateX(-Math.PI / 2); g.translate(0, y, 0);
  const p = g.attributes.position, uv = []; for (let i = 0; i < p.count; i++) uv.push(p.getX(i) / 6, p.getZ(i) / 6); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  return g;
}
export function paint(g, color) {
  const c = new T.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new T.BufferAttribute(a, 3)); return g;
}
