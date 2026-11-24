import * as THREE from 'three';
import { Acc, walls, cap } from './buildings.js';

// 宮原眼科（1927）專屬模型，依日治時期舊照：
// 兩層紅磚、一樓整排半圓拱廊、二樓長方窗配白色楣石與窗台、女兒牆白色壓頂與磚柱，
// 街角（面向綠川與新盛橋）是斜切入口：兩根白色圓柱、上方加高的山頭與巴洛克式裝飾。
const BAY = 4;
function cv(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; }
function brick(x, w, h, base) {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let j = 0; j < h; j += 4) { x.fillStyle = 'rgba(0,0,0,0.13)'; x.fillRect(0, j, w, 1); for (let i = ((j / 4) % 2) * 5; i < w; i += 10) x.fillRect(i, j, 1, 4); }
  const img = x.getImageData(0, 0, w, h); const d = img.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 26; d[i] += n; d[i + 1] += n * 0.6; d[i + 2] += n * 0.5; } x.putImageData(img, 0, 0);
}
const WHITE = '#e9e3d3';
function groundTex(old, lit) { // 4m × 5m：半圓拱
  return cv(128, 160, (x, w, h) => {
    const m = h / 5; brick(x, w, h, old ? '#7a3628' : '#8d3f2c');
    x.fillStyle = '#9c968a'; x.fillRect(0, h - 0.5 * m, w, 0.5 * m);
    const ow = w * 0.62, ox = (w - ow) / 2, top = h - 4.2 * m;
    const fill = lit ? '#e8b46a' : '#1d1814';
    x.fillStyle = '#5a271c'; x.beginPath(); x.arc(w / 2, top + ow / 2, ow / 2 + 6, Math.PI, 0); x.fill();
    x.fillStyle = fill; x.beginPath(); x.arc(w / 2, top + ow / 2, ow / 2, Math.PI, 0); x.fill(); x.fillRect(ox, top + ow / 2, ow, h - top - ow / 2);
    if (!lit) { const g = x.createLinearGradient(0, top, 0, h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(90,70,50,0.5)'); x.fillStyle = g; x.fillRect(ox, top + ow / 2, ow, h - top - ow / 2); }
    x.fillStyle = WHITE; x.fillRect(w / 2 - 5, top - 6, 10, 12); // 拱心石
    x.fillRect(0, 0, w, 0.25 * m); // 樓層白帶
  });
}
function upperTex(old) { // 4m × 4.5m：長方窗、白楣
  return cv(128, 144, (x, w, h) => {
    const m = h / 4.5; brick(x, w, h, old ? '#7a3628' : '#8d3f2c');
    const ww = w * 0.36, wx = (w - ww) / 2, wy = h - 3.7 * m, wh = 2.3 * m;
    x.fillStyle = WHITE; x.fillRect(wx - 8, wy - 0.35 * m, ww + 16, 0.3 * m); x.fillRect(wx - 5, wy + wh, ww + 10, 0.14 * m);
    x.fillStyle = '#efe9dc'; x.fillRect(wx, wy, ww, wh);
    x.fillStyle = '#2b2a28'; x.fillRect(wx + 3, wy + 3, ww - 6, wh * 0.3); x.fillStyle = '#d6cfbf'; x.fillRect(wx + 3, wy + wh * 0.32, ww - 6, wh * 0.66);
    x.fillStyle = '#5e574c'; x.fillRect(w / 2 - 1, wy, 2, wh); x.fillRect(wx, wy + wh * 0.31, ww, 2);
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 0, 6, h); x.fillRect(w - 6, 0, 6, h); // 磚壁柱陰影
  });
}
function parapetTex(old) { // 4m × 1.6m
  return cv(128, 52, (x, w, h) => {
    brick(x, w, h, old ? '#7a3628' : '#8d3f2c');
    x.fillStyle = WHITE; x.fillRect(0, 0, w, 7); x.fillRect(0, h - 6, w, 6);
    x.strokeStyle = '#d8d0bf'; x.lineWidth = 3; x.strokeRect(20, 14, w - 40, h - 26);
    x.fillStyle = '#6a2d21'; x.fillRect(0, 7, 12, h - 13); x.fillRect(w - 12, 7, 12, h - 13);
  });
}

export function buildMiyahara(ring, cornerHint, era) {
  const old = era.id === '1935';
  const g = new THREE.Group(); g.name = 'miyahara';
  const G = 5, U = 9.5, P = 11.1;
  const parts = { ground: new Acc(), upper: new Acc(), parapet: new Acc(), roof: new Acc() };
  walls(parts.ground, ring, 0, G, 0, BAY, G, 0);
  walls(parts.upper, ring, G, U, G, BAY, U - G, 0);
  walls(parts.parapet, ring, U, P, U, BAY, P - U, 0);
  cap(parts.roof, ring, U - 0.1, 0);
  const mats = {
    ground: new THREE.MeshStandardMaterial({ map: groundTex(old, false), emissiveMap: groundTex(old, true), emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.9 }),
    upper: new THREE.MeshStandardMaterial({ map: upperTex(old), roughness: 0.9 }),
    parapet: new THREE.MeshStandardMaterial({ map: parapetTex(old), roughness: 0.9, side: THREE.DoubleSide }),
    roof: new THREE.MeshStandardMaterial({ color: old ? 0x5d5850 : 0x6b665d, roughness: 1 }),
  };
  mats.ground.userData.night = true;
  for (const k in parts) { const m = new THREE.Mesh(parts[k].geometry(), mats[k]); m.castShadow = m.receiveShadow = true; g.add(m); }
  // 街角：找最靠近提示點的頂點
  let ci = 0, bd = 1e9; ring.forEach((p, i) => { const d = Math.hypot(p[0] - cornerHint[0], p[1] - cornerHint[1]); if (d < bd) { bd = d; ci = i; } });
  const C = ring[ci], A = ring[(ci + ring.length - 1) % ring.length], B = ring[(ci + 1) % ring.length];
  const ua = new THREE.Vector2(A[0] - C[0], A[1] - C[1]).normalize(), ub = new THREE.Vector2(B[0] - C[0], B[1] - C[1]).normalize();
  const inward = ua.clone().add(ub).normalize(); const out = inward.clone().negate();
  const side = new THREE.Vector2(-out.y, out.x);
  const white = new THREE.MeshStandardMaterial({ color: 0xe6dfcf, roughness: 0.75 });
  const brickM = new THREE.MeshStandardMaterial({ map: parapetTex(old), roughness: 0.9 });
  const at = (d, s) => [C[0] + inward.x * d + side.x * s, C[1] + inward.y * d + side.y * s];
  const ang = Math.atan2(out.x, out.y); // 讓本地 +z 朝外
  const add = (geo, mat, [x, z], y) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.y = ang; o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  // 斜切入口：白色圓柱與上方橫楣
  for (const s of [-1.9, 1.9]) add(new THREE.CylinderGeometry(0.28, 0.32, G - 0.6, 14), white, at(0.6, s), (G - 0.6) / 2);
  add(new THREE.BoxGeometry(5.4, 0.7, 0.7), white, at(0.6, 0), G - 0.3);
  // 加高的山頭：磚牆 + 白色壓頂 + 巴洛克式渦卷山花 + 柱頭
  add(new THREE.BoxGeometry(6.4, 3.2, 0.6), brickM, at(1.0, 0), P + 1.4);
  add(new THREE.BoxGeometry(6.8, 0.35, 0.9), white, at(1.0, 0), P + 3.05);
  const ped = new THREE.Shape(); ped.moveTo(-2.2, 0); ped.bezierCurveTo(-2.2, 1.2, -0.9, 1.0, -0.6, 1.6); ped.quadraticCurveTo(0, 2.4, 0.6, 1.6); ped.bezierCurveTo(0.9, 1.0, 2.2, 1.2, 2.2, 0); ped.lineTo(-2.2, 0);
  add(new THREE.ExtrudeGeometry(ped, { depth: 0.4, bevelEnabled: false }).translate(0, 0, -0.2), white, at(1.0, 0), P + 3.2);
  for (const s of [-3.4, 3.4, -5.6, 5.6]) {
    const sp = at(1.0, s); const hgt = Math.abs(s) < 4 ? P + 3.4 : P + 1.0;
    add(new THREE.BoxGeometry(0.8, hgt - U, 0.8), white, sp, U + (hgt - U) / 2);
    add(new THREE.SphereGeometry(0.32, 12, 8), white, sp, hgt + 0.3);
  }
  // 斜切面的山頭窗
  g.userData.height = P + 4;
  return g;
}
