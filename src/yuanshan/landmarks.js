import * as THREE from 'three';
import { Kit, T, roofGeo, irimoya, canvasTex, tileTex } from './kit.js';
import { E } from './materials.js';
import { SHRINE, shrineLocal, shrineYaw, SANDO, mulberry, TERRACES } from './geo.js';
const [HT0, HT1, HT2] = TERRACES.map(t => t.h);
import { hAt } from './terrain.js';

// ---------- 材質 ----------
const COPPER = () => ({ color: '#6f9c86', roughness: 0.55, metalness: 0.35, map: tileTex('#7aa58f', '#5e8a76', 'copper') });
const WOOD = { color: '#b49371', roughness: 0.78 };
const WOOD_DARK = { color: '#6b5540', roughness: 0.8 };
const GOLD = { color: '#d2aa52', roughness: 0.32, metalness: 0.9 };
const STONE = { color: '#bdb5a3', roughness: 0.92 };
const STONE_DARK = { color: '#9a9283', roughness: 0.95 };
const WHITE = { color: '#efe9db', roughness: 0.85 };
const PLASTER = { color: '#e8e1d0', roughness: 0.9 };
const VERMILION = { color: '#b2412a', roughness: 0.6 };
const RED_TILE = () => ({ color: '#b2553a', roughness: 0.6, map: tileTex('#b85b3e', '#8e3e28', 'red') });
const YELLOW_TILE = () => ({ color: '#e0a83a', roughness: 0.38, metalness: 0.15, map: tileTex('#e8b445', '#b97d22', 'yellow') });
const GREEN_TILE = () => ({ color: '#2f7552', roughness: 0.4, map: tileTex('#3a8560', '#235a3f', 'green') });
const LAMP = { color: '#fff1d0', emissive: '#ffb45c', emissiveIntensity: 0, roughness: 0.6, lamp: 3.2 };
const CLOTH = { color: '#f4f0e6', roughness: 0.95, side: 2 };
const BRONZE = { color: '#4f5b45', roughness: 0.45, metalness: 0.7 };
const TORII = { color: '#c7b38c', roughness: 0.7 };
const WATER_BLUE = { color: '#4ab3d0', roughness: 0.08, metalness: 0.1 };

// ---------- 神明造社殿 ----------
function shinmei(k, { w, d, floor = 1.6, wall = 4.5, roofH, over = 1.6, katsuogi = 6, posts = true }) {
  k.box(w + 3, 0.5, d + 3, STONE, 0, 0, 0);
  k.box(w + 1.2, 0.18, d + 1.2, WOOD_DARK, 0, floor - 0.18, 0); // 縁
  if (posts) for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(0.32, 0.32, floor + wall + 0.4, WOOD, sx * w / 2, 0, sz * d / 2, 12);
  for (let i = -2; i <= 2; i++) k.cyl(0.22, 0.22, floor, WOOD, i * w / 5, 0, d / 2 + 0.5, 8);
  k.box(w, wall, d, WOOD, 0, floor, 0);
  k.box(w * 0.35, wall * 0.78, 0.2, WOOD_DARK, 0, floor, d / 2 + 0.06); // 扉
  // 高欄
  k.box(w + 1.0, 0.1, 0.1, WOOD_DARK, 0, floor + 0.85, d / 2 + 0.55); k.box(w + 1.0, 0.1, 0.1, WOOD_DARK, 0, floor + 0.85, -d / 2 - 0.55);
  // 階
  for (let i = 0; i < 5; i++) k.box(w * 0.3, floor / 5, 0.45, WOOD, 0, i * floor / 5, d / 2 + 1.0 + (4 - i) * 0.42);
  const y0 = floor + wall;
  k.push(0, y0, 0);
  k.add(roofGeo({ W: w / 2 + over, D: d / 2 + over, H: roofH, style: 'gable', curve: 1.05, thick: 0.55 }), { ...COPPER(), side: 2 });
  k.box(w + 2 * over + 0.6, 0.7, 0.9, WOOD_DARK, 0, roofH - 0.1, 0);
  // 鰹木
  for (let i = 0; i < katsuogi; i++) { const x = (i - (katsuogi - 1) / 2) * (w + over) / katsuogi; k.add(new THREE.CylinderGeometry(0.32, 0.32, 1.4, 10), WOOD, T(x, roofH + 0.75, 0, 0, 1, 1, 1, Math.PI / 2)); k.add(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 10), GOLD, T(x, roofH + 0.75, 0.7, 0, 1, 1, 1, Math.PI / 2)); k.add(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 10), GOLD, T(x, roofH + 0.75, -0.7, 0, 1, 1, 1, Math.PI / 2)); }
  // 千木：山牆兩端交叉
  const slope = Math.atan2(roofH, d / 2 + over);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    k.add(new THREE.BoxGeometry(0.25, 0.5, 4.2), WOOD, T(sx * (w / 2 + over + 0.1), roofH + 0.4, sz * 0.9, 0, 1, 1, 1, sz * slope));
  }
  k.pop();
}

function torii(k, x, z, y, yaw, s = 1, mat = TORII) {
  k.push(x, y, z, yaw, s);
  const H = 9, span = 7.2;
  for (const sx of [-1, 1]) { k.add(new THREE.CylinderGeometry(0.42, 0.5, H, 16), mat, T(sx * span / 2, H / 2, 0, 0, 1, 1, 1, 0, -sx * 0.035)); k.cyl(0.62, 0.62, 0.7, STONE_DARK, sx * span / 2 + sx * 0.0, 0, 0, 14); }
  k.box(span + 1.6, 0.55, 0.7, mat, 0, H - 2.2, 0); // 貫
  k.box(0.5, 1.2, 0.5, mat, 0, H - 1.65, 0);
  const kas = new THREE.BoxGeometry(span + 4.2, 0.8, 1.0, 20, 1, 1); const p = kas.attributes.position;
  for (let i = 0; i < p.count; i++) { const xx = p.getX(i); p.setY(i, p.getY(i) + Math.pow(Math.abs(xx) / ((span + 4.2) / 2), 2.4) * 0.65); }
  kas.computeVertexNormals(); k.add(kas, mat, T(0, H - 0.25, 0));
  k.box(span + 3.4, 0.45, 0.85, mat, 0, H - 1.0, 0);
  k.pop();
}

function lantern(k, x, z, y, s = 1, yaw = 0) {
  k.push(x, y, z, yaw, s);
  k.box(1.3, 0.35, 1.3, STONE_DARK, 0, 0, 0); k.cyl(0.45, 0.55, 0.3, STONE, 0, 0.35, 0, 8);
  k.cyl(0.22, 0.26, 1.5, STONE, 0, 0.65, 0, 8); k.box(1.0, 0.25, 1.0, STONE, 0, 2.15, 0);
  k.box(0.72, 0.7, 0.72, STONE, 0, 2.4, 0); k.box(0.5, 0.45, 0.76, LAMP, 0, 2.52, 0); k.box(0.76, 0.45, 0.5, LAMP, 0, 2.52, 0);
  k.add(new THREE.ConeGeometry(0.85, 0.55, 6), STONE, T(0, 3.37, 0)); k.add(new THREE.SphereGeometry(0.16, 8, 6), STONE, T(0, 3.72, 0));
  k.light(0, 2.6, 0, 6);
  k.pop();
}

// 石垣（含中央石階）
function stoneWall(k, s, y0, y1, width, stairW = 8) {
  const h = y1 - y0 + 0.4;
  const side = (width - stairW) / 2;
  for (const sx of [-1, 1]) k.box(side, h, 2.5, STONE_DARK, sx * (stairW / 2 + side / 2), y0 - 0.4, s);
  const steps = Math.ceil((y1 - y0) / 0.3);
  for (let i = 0; i < steps; i++) k.box(stairW, (i + 1) * (y1 - y0) / steps, 0.55, STONE, 0, y0, s + 1.25 + (steps - 1 - i) * 0.5 - 0.25);
  for (const sx of [-1, 1]) k.box(0.5, h + 0.6, steps * 0.5 + 1.2, STONE_DARK, sx * (stairW / 2 + 0.25), y0 - 0.4, s + steps * 0.25 + 0.8);
}

function fence(k, x0, x1, z, y, h = 1.6, mat = WOOD) {
  const n = Math.max(2, Math.round(Math.abs(x1 - x0) / 1.2));
  for (let i = 0; i <= n; i++) k.box(0.18, h, 0.18, mat, x0 + (x1 - x0) * i / n, y, z);
  k.box(Math.abs(x1 - x0), 0.16, 0.16, mat, (x0 + x1) / 2, y + h - 0.2, z); k.box(Math.abs(x1 - x0), 0.12, 0.12, mat, (x0 + x1) / 2, y + h * 0.4, z);
}
function fenceRect(k, w, d, y, h, mat) { fence(k, -w / 2, w / 2, d / 2, y, h, mat); fence(k, -w / 2, w / 2, -d / 2, y, h, mat); k.push(0, 0, 0, Math.PI / 2); fence(k, -d / 2, d / 2, w / 2, y, h, mat); fence(k, -d / 2, d / 2, -w / 2, y, h, mat); k.pop(); }

// 中式樓閣（臺灣大飯店、忠烈祠、牌樓用）
function chineseHall(k, { w, d, floors = 1, fh = 4.2, roof = RED_TILE(), wall = PLASTER, col = VERMILION, over = 2.4, lift = 1.4, H, base = 1.2, double = false }) {
  k.box(w + 4, base, d + 4, STONE, 0, 0, 0);
  const y0 = base;
  for (let f = 0; f < floors; f++) {
    const yy = y0 + f * fh;
    k.box(w - 1.2, fh - 0.2, d - 1.2, wall, 0, yy, 0);
    const nx = Math.max(2, Math.round(w / 4)), nz = Math.max(2, Math.round(d / 4));
    for (let i = 0; i <= nx; i++) for (const sz of [-1, 1]) k.cyl(0.32, 0.32, fh, col, -w / 2 + i * w / nx, yy, sz * d / 2, 10);
    for (let i = 1; i < nz; i++) for (const sx of [-1, 1]) k.cyl(0.32, 0.32, fh, col, sx * w / 2, yy, -d / 2 + i * d / nz, 10);
    // 窗帶
    k.box(w - 1.1, 1.3, d - 1.1, { color: '#3b4a4f', roughness: 0.25, metalness: 0.3, emissive: '#ffc77a', emissiveIntensity: 0, lamp: 1.1 }, 0, yy + 1.4, 0);
    k.box(w + 0.6, 0.45, d + 0.6, { color: '#2f5f57', roughness: 0.6 }, 0, yy + fh - 0.45, 0); // 額枋彩畫
    if (f < floors - 1) { k.push(0, yy + fh, 0); k.add(roofGeo({ W: w / 2 + 1.4, D: d / 2 + 1.4, H: 1.2, style: 'hip', curve: 1.3, lift: 0.4, thick: 0.25, hipK: 1 }), { ...roof, side: 2 }); k.pop(); }
  }
  const top = y0 + floors * fh;
  k.push(0, top, 0);
  if (double) { k.add(roofGeo({ W: w / 2 + over + 0.6, D: d / 2 + over + 0.6, H: 2.0, style: 'hip', curve: 1.3, lift: lift * 0.8, thick: 0.35 }), { ...roof, side: 2 }); k.box(w * 0.8, 2.2, d * 0.7, col, 0, 1.0, 0); k.push(0, 3.0, 0); }
  irimoya(k, { W: w / 2 + over, D: d / 2 + over, H: H || Math.min(w, d) * 0.42, curve: 1.7, lift, mat: roof, gableMat: { color: '#c8493a', roughness: 0.7 }, ridgeMat: roof });
  if (double) k.pop();
  k.pop();
}

function paifang(k, x, z, y, yaw, s = 1, scheme = 'white') {
  k.push(x, y, z, yaw, s);
  const colm = scheme === 'white' ? { color: '#f2eee4', roughness: 0.7 } : VERMILION;
  const xs = [-7.5, -2.6, 2.6, 7.5];
  xs.forEach((xx, i) => { const h = i === 0 || i === 3 ? 7 : 9; k.box(1.0, h, 1.0, colm, xx, 0, 0); k.box(1.6, 1.2, 1.6, STONE, xx, 0, 0); });
  k.box(17, 1.0, 0.8, colm, 0, 6.2, 0); k.box(6.2, 1.8, 0.6, { color: '#2a4b7a', roughness: 0.5 }, 0, 6.8, 0);
  for (const [cx, w, y0] of [[0, 7.2, 9], [-5.05, 6, 7], [5.05, 6, 7]]) { k.push(cx, y0, 0); k.add(roofGeo({ W: w / 2, D: 1.3, H: 1.4, style: 'hip', curve: 1.4, lift: 0.6, thick: 0.25 }), { ...(scheme === 'white' ? GREEN_TILE() : YELLOW_TILE()), side: 2 }); k.pop(); }
  k.pop();
}

// ======================= 臺灣神社（1901–1945） =======================
export function buildShrine(mask, era2 = false) {
  const k = new Kit(mask, era2 ? 'shrine-e2' : 'shrine-e1');
  const [hx, hz] = shrineLocal(0, 0);
  k.push(hx, 0, hz, shrineYaw);
  // 本殿台地 46、拜殿 40、外苑 32
  k.push(0, HT0, 0);
  fenceRect(k, 40, 34, 0, 2.0, { color: '#e9e2d2', roughness: 0.85 }); // 瑞垣
  shinmei(k, { w: 12, d: 8.5, floor: 2.0, wall: 4.6, roofH: 5.6, over: 1.8, katsuogi: 8 });
  for (const sx of [-1, 1]) { k.push(sx * 13, 0, -6); shinmei(k, { w: 4.5, d: 3.6, floor: 1.2, wall: 2.4, roofH: 2.6, over: 0.8, katsuogi: 3 }); k.pop(); }
  // 中門
  k.push(0, 0, 17); for (const sx of [-1, 1]) k.cyl(0.38, 0.38, 5.2, WOOD, sx * 2.6, 0, 0, 12); k.box(6.4, 0.6, 0.8, WOOD, 0, 4.6, 0);
  k.push(0, 5.2, 0); k.add(roofGeo({ W: 4.4, D: 2.6, H: 2.0, style: 'gable', curve: 1.05, thick: 0.4 }), { ...COPPER(), side: 2 }); k.pop(); k.pop();
  k.pop();
  stoneWall(k, 21, HT1, HT0, 56, 7);
  // 拜殿
  k.push(0, HT1, 46);
  shinmei(k, { w: 22, d: 11, floor: 1.0, wall: 4.0, roofH: 5.2, over: 2.6, katsuogi: 0 });
  k.box(22.4, 1.6, 0.25, CLOTH, 0, 4.0, 6.0); // 幕
  for (let i = 0; i < 5; i++) k.add(new THREE.CircleGeometry(0.6, 16), { color: '#2b2b2b', roughness: 0.8 }, T(-8 + i * 4, 4.8, 6.15));
  k.pop();
  lantern(k, -9, 40, HT1, 1.1); lantern(k, 9, 40, HT1, 1.1);
  stoneWall(k, 63, HT2, HT1, 80, 10);
  // 外苑：社務所、手水舍、噴水銅龍、燈籠、三之鳥居
  k.push(-30, HT2, 92, Math.PI / 2); chineseHallJapanese(k, 30, 13); k.pop();
  k.push(24, HT2, 104); for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(0.25, 0.25, 3.2, WOOD, sx * 2.4, 0, sz * 1.6, 8);
  k.box(3.6, 0.8, 2.0, STONE, 0, 0, 0); k.push(0, 3.2, 0); k.add(roofGeo({ W: 3.6, D: 2.6, H: 1.8, style: 'irimoya' === 'x' ? 'hip' : 'hip', curve: 1.4, lift: 0.3, thick: 0.3 }), { ...COPPER(), side: 2 }); k.pop(); k.pop();
  // 噴水銅龍
  k.push(30, HT2, 120); k.cyl(2.6, 2.8, 0.8, STONE, 0, 0, 0, 20); k.cyl(2.3, 2.3, 0.05, WATER_BLUE, 0, 0.78, 0, 20); k.cyl(0.35, 0.45, 2.2, STONE, 0, 0.8, 0, 8);
  const coil = new THREE.TorusKnotGeometry(0.55, 0.16, 64, 8, 2, 3); k.add(coil, BRONZE, T(0, 3.4, 0, 0, 1, 1.4, 1)); k.pop();
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) lantern(k, sx * 7.5, 72 + i * 9.5, HT2);
  torii(k, 0, 128, HT2, 0, 1.0);
  torii(k, 0, 66, HT1, 0, 0.72);
  if (era2) {
    // 外苑擴建：神饌所、繪馬殿
    k.push(32, HT2, 84, -Math.PI / 2); chineseHallJapanese(k, 20, 10); k.pop();
    for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) lantern(k, sx * 12, 76 + i * 12, HT2, 1.25);
  }
  k.pop();

  // 參道：鳥居、石燈籠
  const kk = k;
  const torPos = [[2, 0.95], [Math.floor(SANDO.length * 0.48), 0.9]];
  for (const [i, s] of torPos) {
    const p = SANDO[i], q = SANDO[i + 1]; const yaw = Math.atan2(q[0] - p[0], q[1] - p[1]);
    torii(kk, p[0], p[1], hAt(p[0], p[1]) - 0.1, yaw + Math.PI, i === 2 ? (era2 ? 1.55 : 1.4) : s);
  }
  const step = era2 ? 2 : 3;
  for (let i = 6; i < SANDO.length - 4; i += step) {
    const p = SANDO[i], q = SANDO[i + 1]; const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz);
    for (const sd of [-1, 1]) { const x = p[0] - dz / L * sd * 7.6, z = p[1] + dx / L * sd * 7.6; lantern(kk, x, z, hAt(x, z) - 0.1, 0.9, Math.atan2(dx, dz)); }
  }
  // 石階：參道上段
  return k.build();
}

// 社務所等和風建物（入母屋、白壁）
function chineseHallJapanese(k, w, d) {
  k.box(w + 1.5, 0.6, d + 1.5, STONE, 0, 0, 0);
  k.box(w, 3.6, d, PLASTER, 0, 0.6, 0);
  k.box(w + 0.1, 0.5, d + 0.1, WOOD_DARK, 0, 3.7, 0);
  for (let i = 0; i <= Math.round(w / 3); i++) for (const sz of [-1, 1]) k.box(0.3, 3.6, 0.3, WOOD_DARK, -w / 2 + i * w / Math.round(w / 3), 0.6, sz * d / 2);
  k.push(0, 4.2, 0);
  irimoya(k, { W: w / 2 + 1.8, D: d / 2 + 1.8, H: d * 0.42, curve: 1.5, lift: 0.4, mat: { color: '#59605e', roughness: 0.7, map: tileTex('#5c6463', '#3c4242', 'kawara') }, gableMat: WOOD, ridgeMat: { color: '#3c4242', roughness: 0.7 } });
  k.pop();
}

// ======================= 臺灣神宮（1944 新營，後山台地） =======================
export function buildJingu(mask) {
  const k = new Kit(mask, 'jingu');
  k.push(330, 92, -505, shrineYaw);
  fenceRect(k, 70, 44, 0, 2.4, { color: '#ece6d6', roughness: 0.85 });
  shinmei(k, { w: 16, d: 11, floor: 2.4, wall: 5.4, roofH: 7.0, over: 2.2, katsuogi: 10 });
  k.push(0, 0, 18); shinmei(k, { w: 26, d: 10, floor: 1.2, wall: 4.4, roofH: 5.6, over: 2.6, katsuogi: 0 }); k.pop();
  // 迴廊
  for (const sx of [-1, 1]) { k.box(1.0, 3.0, 40, WOOD, sx * 34, 0, 0); k.push(sx * 34, 3.0, 0, Math.PI / 2); k.add(roofGeo({ W: 21, D: 2.2, H: 1.4, style: 'gable', curve: 1.05, thick: 0.3 }), { ...COPPER(), side: 2 }); k.pop(); }
  k.pop();
  return k.build();
}

// ======================= 護國神社（1942）／忠烈祠（1969 改建） =======================
export function buildGokoku(mask) {
  const k = new Kit(mask, 'gokoku'); k.push(900, 9, -160, Math.PI * 0.98);
  fenceRect(k, 50, 40, 0, 1.8, { color: '#e8e0cc' });
  shinmei(k, { w: 12, d: 8, floor: 1.6, wall: 4, roofH: 5, over: 1.6, katsuogi: 6 });
  k.push(0, 0, 22); shinmei(k, { w: 18, d: 9, floor: 0.8, wall: 3.6, roofH: 4.4, over: 2, katsuogi: 0 }); k.pop();
  torii(k, 0, 46, 0, 0, 0.95);
  k.pop(); return k.build();
}
export function buildMartyrs(mask) {
  const k = new Kit(mask, 'martyrs'); k.push(900, 9, -160, Math.PI * 0.98);
  chineseHall(k, { w: 34, d: 18, floors: 1, fh: 8, roof: YELLOW_TILE(), wall: { color: '#c4442f', roughness: 0.6 }, H: 9, lift: 2.2, double: true });
  for (const sx of [-1, 1]) { k.push(sx * 34, 0, 26, 0); chineseHall(k, { w: 8, d: 30, floors: 1, fh: 5, roof: YELLOW_TILE(), wall: { color: '#c4442f' }, H: 3.6, lift: 0.8 }); k.pop(); }
  k.push(0, 0, 62); chineseHall(k, { w: 26, d: 10, floors: 1, fh: 6, roof: YELLOW_TILE(), wall: { color: '#c4442f' }, H: 5, lift: 1.4 }); k.pop();
  k.box(70, 0.3, 50, { color: '#d9d4c6', roughness: 0.8 }, 0, 0, 30);
  k.pop(); return k.build();
}

// ======================= 臺灣大飯店／早期圓山飯店（1952–1960 年代） =======================
export function buildEarlyHotel(mask) {
  const k = new Kit(mask, 'hotel-early');
  const [hx, hz] = shrineLocal(0, 0);
  k.push(hx, 0, hz, shrineYaw);
  // 主樓：拜殿台地上三層中式樓（金龍廳）
  k.push(0, HT1, 44); chineseHall(k, { w: 46, d: 16, floors: 3, fh: 3.8, roof: RED_TILE(), H: 6.2, lift: 1.6 }); k.pop();
  // 本殿台地：麒麟廳（兩層）
  k.push(-6, HT0, 2, 0); chineseHall(k, { w: 40, d: 14, floors: 2, fh: 3.8, roof: RED_TILE(), H: 5.4, lift: 1.3 }); k.pop();
  k.push(22, HT0, -6, Math.PI / 2); chineseHall(k, { w: 22, d: 12, floors: 2, fh: 3.6, roof: GREEN_TILE(), H: 4.6, lift: 1.1 }); k.pop();
  stoneWall(k, 63, HT2, HT1, 80, 10);
  stoneWall(k, 21, HT1, HT0, 56, 7);
  // 外苑：泳池、網球場、牌樓
  k.push(-14, HT2, 98);
  k.box(30, 0.3, 16, { color: '#e9e5dc', roughness: 0.7 }, 0, 0, 0); k.box(24, 0.1, 11, { ...WATER_BLUE, color: '#3fb0d6' }, 0, 0.3, 0);
  k.pop();
  k.push(26, HT2, 100); for (const zz of [-9, 9]) { k.box(14, 0.15, 16, { color: '#b5553a', roughness: 0.9 }, 0, 0, zz); fence(k, -7, 7, zz - 8, 0.15, 3.2, { color: '#3d4a44', roughness: 0.6 }); } k.pop();
  paifang(k, 0, 124, HT2, 0, 1.0, 'white');
  // 尚存的石燈籠
  for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) lantern(k, sx * 7.5, 72 + i * 9.5, HT2);
  k.pop();
  // 改為車道的參道：原鳥居處改牌樓
  const p = SANDO[2], q = SANDO[3]; paifang(k, p[0], p[1], hAt(p[0], p[1]), Math.atan2(q[0] - p[0], q[1] - p[1]) + Math.PI, 0.9, 'white');
  return k.build();
}

// ======================= 圓山大飯店（1973 宮殿式） =======================
function facadeTex() {
  return canvasTex('gh-facade', 256, 256, (c, w, h) => {
    c.fillStyle = '#ece4d2'; c.fillRect(0, 0, w, h);
    // 一層一格：窗 + 欄杆
    c.fillStyle = '#26333a'; c.fillRect(18, 22, w - 36, 150);
    c.fillStyle = 'rgba(160,190,200,.35)'; c.fillRect(18, 22, w - 36, 40);
    c.fillStyle = '#efe7d6'; c.fillRect(0, 175, w, 81);
    c.fillStyle = '#c9bfa9'; for (let i = 0; i < 16; i++) c.fillRect(8 + i * 15.5, 190, 7, 52);
    c.fillStyle = '#d8cfbb'; c.fillRect(0, 175, w, 10); c.fillRect(0, 242, w, 14);
  });
}
function facadeEmissive() {
  return canvasTex('gh-facade-em', 256, 256, (c, w, h) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    const g = c.createLinearGradient(0, 22, 0, 172); g.addColorStop(0, '#ffcf8a'); g.addColorStop(1, '#ff9a4a'); c.fillStyle = g; c.fillRect(18, 22, w - 36, 150);
  });
}
export function buildGrandHotel(mask) {
  const k = new Kit(mask, 'grand-hotel');
  const [hx, hz] = shrineLocal(10, 0);
  k.push(hx, 0, hz, shrineYaw);
  const W = 108, D = 24, FL = 12, FH = 3.5, BASE = (HT0 + HT1) / 2;
  // 基座（含大廳），台基
  k.box(W + 30, 12, D + 40, { color: '#d9d1bf', roughness: 0.85 }, 0, BASE - 10, 6);
  k.box(W + 26, 1.2, D + 36, { color: '#c4453a', roughness: 0.6 }, 0, BASE + 2, 6);
  const y0 = BASE + 3.2;
  // 樓身：外牆帶窗貼圖，柱與陽台為實體
  const fac = facadeTex(), em = facadeEmissive();
  fac.repeat.set(W / 4.5, FL); em.repeat.set(W / 4.5, FL);
  const body = new THREE.BoxGeometry(W, FL * FH, D); const uv = body.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i));
  k.add(body, { color: '#ffffff', roughness: 0.55, map: fac, emissiveMap: em, emissive: '#ffffff', emissiveIntensity: 0, lamp: 0.3 }, T(0, y0 + FL * FH / 2, 0));
  for (let f = 0; f <= FL; f++) {
    const y = y0 + f * FH;
    k.box(W + 3.0, 0.35, D + 3.0, { color: '#f3ecdc', roughness: 0.7 }, 0, y - 0.35, 0);
    if (f < FL) { k.box(W + 2.8, 1.05, 0.15, { color: '#eee6d3', roughness: 0.7 }, 0, y, D / 2 + 1.4); k.box(W + 2.8, 1.05, 0.15, { color: '#eee6d3', roughness: 0.7 }, 0, y, -D / 2 - 1.4); }
  }
  // 朱紅大柱：通高
  const nCol = 25;
  const GLOWRED = { ...VERMILION, emissive: '#ff4a1c', emissiveIntensity: 0, lamp: 0.28 };
  for (let i = 0; i <= nCol; i++) for (const sz of [-1, 1]) k.cyl(0.62, 0.62, FL * FH, GLOWRED, -W / 2 - 1 + i * (W + 2) / nCol, y0, sz * (D / 2 + 1.9), 12);
  for (let i = 0; i <= 5; i++) for (const sx of [-1, 1]) k.cyl(0.62, 0.62, FL * FH, GLOWRED, sx * (W / 2 + 1.9), y0, -D / 2 + i * D / 5, 12);
  const top = y0 + FL * FH;
  // 斗栱彩帶
  k.box(W + 5, 1.6, D + 5, { color: '#2c6b5c', roughness: 0.55 }, 0, top, 0);
  k.box(W + 5.4, 0.5, D + 5.4, { color: '#c9a043', roughness: 0.4, metalness: 0.5 }, 0, top + 1.6, 0);
  // 下層簷（腰簷）
  k.push(0, top + 2.0, 0);
  k.add(roofGeo({ W: W / 2 + 6.5, D: D / 2 + 6.5, H: 4.2, style: 'hip', curve: 1.25, lift: 2.2, thick: 0.7, hipK: 1 }), { ...YELLOW_TILE(), side: 2, emissive: '#ffb040', emissiveIntensity: 0, lamp: 0.22 });
  k.pop();
  // 頂樓（退縮）＋重簷歇山大屋頂
  const y2 = top + 5.4;
  k.box(W - 14, 6.5, D - 6, { color: '#efe7d4', roughness: 0.6 }, 0, y2, 0);
  for (let i = 0; i <= 18; i++) for (const sz of [-1, 1]) k.cyl(0.55, 0.55, 6.5, VERMILION, -(W - 14) / 2 + i * (W - 14) / 18, y2, sz * ((D - 6) / 2 + 0.6), 10);
  k.box(W - 12, 1.2, D - 4, { color: '#2c6b5c', roughness: 0.55 }, 0, y2 + 6.5, 0);
  k.push(0, y2 + 7.7, 0);
  irimoya(k, { W: (W - 14) / 2 + 6, D: (D - 6) / 2 + 6, H: 15, curve: 1.75, lift: 3.4, mat: { ...YELLOW_TILE(), emissive: '#ffb040', emissiveIntensity: 0, lamp: 0.3 }, gableMat: { color: '#b8392c', roughness: 0.6 }, ridgeMat: { color: '#d9a23a', roughness: 0.4, metalness: 0.3 }, thick: 0.8 });
  // 正脊鴟吻
  for (const sx of [-1, 1]) k.add(new THREE.TorusGeometry(1.4, 0.45, 8, 16, Math.PI * 1.2), { color: '#d9a23a', roughness: 0.4, metalness: 0.3 }, T(sx * ((W - 14) / 2 + 6 - (D - 6) / 2 * 1.35 - 4.6), 15.6, 0, 0, 1, 1, 1, 0, sx * 0.4));
  k.pop();
  // 正門車寄：小歇山
  k.push(0, BASE + 2, D / 2 + 14); chineseHall(k, { w: 22, d: 10, floors: 1, fh: 6, roof: YELLOW_TILE(), wall: { color: '#e9dcc0' }, H: 4.4, lift: 1.6, base: 0.3 }); k.pop();
  // 前庭坡道與牌樓
  k.box(70, 0.4, 56, { color: '#b5ada0', roughness: 0.85 }, 0, HT2, 90);
  paifang(k, 0, 118, HT2, 0, 1.15, 'red');
  k.pop();
  return k.build();
}
