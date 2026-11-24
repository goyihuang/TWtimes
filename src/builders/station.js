import * as THREE from 'three';

// 臺中驛（1917 第二代站房）專屬模型，依舊照比例重建：
// 紅磚白帶（辰野式）、兩層樓主體＋高聳寄棟屋頂、中央凸出山牆與三扇高拱窗、
// 屋脊上的方形鐘塔與尖頂、正面整排木柱長廊（雨庇）、兩端角樓。
// 以 OSM 輪廓的最小外接矩形定位，正面朝西北（站前廣場）。

const BRICK = '#9b3b26', WHITE = '#efe8d8', SLATE = '#4a4846';
function cv(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; }
function brickBase(x, w, h) {
  x.fillStyle = BRICK; x.fillRect(0, 0, w, h);
  for (let j = 0; j < h; j += 5) { x.fillStyle = 'rgba(0,0,0,0.10)'; x.fillRect(0, j, w, 1); for (let i = ((j / 5) % 2) * 6; i < w; i += 12) x.fillRect(i, j, 1, 5); }
  const img = x.getImageData(0, 0, w, h); const d = img.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 22; d[i] += n; d[i + 1] += n * 0.6; d[i + 2] += n * 0.5; } x.putImageData(img, 0, 0);
}
// 一個開間（4.5m 寬 × 10m 高）：石基座、一樓方窗、白帶、二樓拱窗、簷口
function bayTexture() {
  return cv(128, 284, (x, w, h) => {
    const m = h / 10; brickBase(x, w, h);
    const band = (y, t) => { x.fillStyle = WHITE; x.fillRect(0, h - y * m, w, t * m); };
    x.fillStyle = '#b8b2a6'; x.fillRect(0, h - 0.8 * m, w, 0.8 * m);
    band(4.6, 0.35); band(5.6, 0.15); band(9.6, 0.6); band(7.4, 0.12);
    // 一樓窗
    x.fillStyle = WHITE; x.fillRect(w * 0.28 - 4, h - 4.0 * m - 4, w * 0.44 + 8, 2.6 * m + 8);
    x.fillStyle = '#2a2724'; x.fillRect(w * 0.28, h - 4.0 * m, w * 0.44, 2.6 * m);
    x.fillStyle = '#d9d2c2'; x.fillRect(w * 0.5 - 1, h - 4.0 * m, 2, 2.6 * m);
    // 二樓拱窗
    const ww = w * 0.40, wx = (w - ww) / 2, top = h - 8.7 * m, bot = h - 6.0 * m;
    x.fillStyle = WHITE; x.beginPath(); x.arc(w / 2, top + ww / 2, ww / 2 + 6, Math.PI, 0); x.fill(); x.fillRect(wx - 6, top + ww / 2, ww + 12, bot - top - ww / 2 + 6);
    x.fillStyle = '#26303a'; x.beginPath(); x.arc(w / 2, top + ww / 2, ww / 2, Math.PI, 0); x.fill(); x.fillRect(wx, top + ww / 2, ww, bot - top - ww / 2);
    x.strokeStyle = '#e8e2d4'; x.lineWidth = 2; x.beginPath(); x.moveTo(w / 2, top); x.lineTo(w / 2, bot); x.moveTo(wx, top + ww * 0.9); x.lineTo(wx + ww, top + ww * 0.9); x.stroke();
    // 白色隅石（開間邊）
    x.fillStyle = WHITE; for (let y = 0.9; y < 9.5; y += 0.9) { x.fillRect(0, h - y * m - 8, 5, 8); x.fillRect(w - 5, h - y * m - 8, 5, 8); }
  });
}
// 中央山牆正面（14m 寬 × 13m 高）：三扇通高拱窗、白色壁柱
function pavilionTexture() {
  return cv(448, 416, (x, w, h) => {
    const m = h / 13; brickBase(x, w, h);
    x.fillStyle = '#b8b2a6'; x.fillRect(0, h - 0.8 * m, w, 0.8 * m);
    x.fillStyle = WHITE; x.fillRect(0, h - 4.6 * m, w, 0.4 * m); x.fillRect(0, h - 12.4 * m, w, 0.6 * m);
    for (const px of [0, w * 0.22, w * 0.78, w - 22]) { x.fillRect(px, 0, 22, h); for (let y = 1; y < 12; y += 1.1) { x.fillStyle = '#d8cfbd'; x.fillRect(px, h - y * m, 22, 3); x.fillStyle = WHITE; } }
    for (let i = 0; i < 3; i++) {
      const cx = w * (0.36 + i * 0.14), ww = w * 0.1, top = h - 11.2 * m, bot = h - 5.2 * m;
      x.fillStyle = WHITE; x.beginPath(); x.arc(cx, top + ww / 2, ww / 2 + 7, Math.PI, 0); x.fill(); x.fillRect(cx - ww / 2 - 7, top + ww / 2, ww + 14, bot - top - ww / 2 + 7);
      x.fillStyle = '#25303b'; x.beginPath(); x.arc(cx, top + ww / 2, ww / 2, Math.PI, 0); x.fill(); x.fillRect(cx - ww / 2, top + ww / 2, ww, bot - top - ww / 2);
      x.strokeStyle = '#e8e2d4'; x.lineWidth = 2; for (let k = 1; k < 3; k++) { x.beginPath(); x.moveTo(cx - ww / 2 + (ww * k) / 3, top); x.lineTo(cx - ww / 2 + (ww * k) / 3, bot); x.stroke(); }
      for (let y = top + ww; y < bot; y += 18) { x.beginPath(); x.moveTo(cx - ww / 2, y); x.lineTo(cx + ww / 2, y); x.stroke(); }
    }
    // 一樓入口
    x.fillStyle = WHITE; x.fillRect(w * 0.3, h - 4.2 * m, w * 0.4, 3.4 * m); x.fillStyle = '#2b2622'; x.fillRect(w * 0.32, h - 4.0 * m, w * 0.36, 3.2 * m);
    x.fillStyle = '#c9b48a'; x.fillRect(w * 0.34, h - 5.0 * m, w * 0.32, 0.6 * m); x.fillStyle = '#3a2a1a'; x.font = `bold ${Math.round(0.45 * m)}px "Noto Serif TC",serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('臺 中 驛', w / 2, h - 4.7 * m);
  });
}
function gableTexture() {
  return cv(256, 128, (x, w, h) => {
    brickBase(x, w, h); x.fillStyle = WHITE;
    x.beginPath(); x.moveTo(0, h); x.lineTo(w / 2, 0); x.lineTo(w, h); x.lineTo(w - 14, h); x.lineTo(w / 2, 14); x.lineTo(14, h); x.fill();
    x.beginPath(); x.ellipse(w / 2, h * 0.62, 22, 26, 0, 0, 7); x.fill(); x.fillStyle = '#8a7a5e'; x.beginPath(); x.ellipse(w / 2, h * 0.62, 12, 15, 0, 0, 7); x.fill();
  });
}
function slateTexture() {
  return cv(256, 256, (x, w, h) => { x.fillStyle = SLATE; x.fillRect(0, 0, w, h); for (let j = 0; j < h; j += 6) { x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0, j, w, 1); for (let i = ((j / 6) % 2) * 5; i < w; i += 10) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.06})`; x.fillRect(i, j + 1, 10, 5); } } });
}
function towerTexture() {
  return cv(128, 192, (x, w, h) => {
    x.fillStyle = '#9a9b8c'; x.fillRect(0, 0, w, h);
    for (let j = 0; j < h; j += 12) { x.fillStyle = 'rgba(0,0,0,0.15)'; x.fillRect(0, j, w, 1); for (let i = ((j / 12) % 2) * 16; i < w; i += 32) x.fillRect(i, j, 1, 12); }
    x.fillStyle = '#6f7064'; x.fillRect(0, 0, 14, h); x.fillRect(w - 14, 0, 14, h); x.fillRect(0, 0, w, 14);
    x.fillStyle = '#eeeae0'; x.beginPath(); x.arc(w / 2, h * 0.45, 30, 0, 7); x.fill(); x.strokeStyle = '#333'; x.lineWidth = 3; x.stroke();
    x.lineWidth = 3; x.beginPath(); x.moveTo(w / 2, h * 0.45); x.lineTo(w / 2, h * 0.45 - 20); x.moveTo(w / 2, h * 0.45); x.lineTo(w / 2 + 14, h * 0.45 + 4); x.stroke();
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; x.fillStyle = '#333'; x.fillRect(w / 2 + Math.cos(a) * 25 - 1, h * 0.45 + Math.sin(a) * 25 - 1, 3, 3); }
  });
}

// 寄棟（四坡）屋頂：長 L、深 D、高 R，底面中心在原點
function hipRoof(L, D, R) {
  const r = Math.min(L, D) / 2, hl = L / 2, hd = D / 2, ridge = Math.max(0, hl - r);
  const v = { a: [-hl, 0, -hd], b: [hl, 0, -hd], c: [hl, 0, hd], d: [-hl, 0, hd], e: [-ridge, R, 0], f: [ridge, R, 0] };
  const tris = [['a', 'e', 'f'], ['a', 'f', 'b'], ['b', 'f', 'c'], ['c', 'f', 'e'], ['c', 'e', 'd'], ['d', 'e', 'a']];
  return triGeom(tris.map(t => t.map(k => v[k])), 6);
}
// 人字（切妻）屋頂，屋脊沿 z 方向
function gableRoof(W, D, R) {
  const hw = W / 2, hd = D / 2;
  const P = { a: [-hw, 0, -hd], b: [hw, 0, -hd], c: [hw, 0, hd], d: [-hw, 0, hd], e: [0, R, -hd], f: [0, R, hd] };
  return triGeom([['a', 'e', 'f'], ['a', 'f', 'd'], ['b', 'c', 'f'], ['b', 'f', 'e']].map(t => t.map(k => P[k])), 6);
}
function triGeom(tris, uvScale) {
  const pos = [], uv = [];
  for (const [a, b, c] of tris) {
    const n = new THREE.Vector3().subVectors(new THREE.Vector3(...b), new THREE.Vector3(...a)).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...c), new THREE.Vector3(...a)));
    const tri = n.y < 0 ? [a, c, b] : [a, b, c];
    for (const p of tri) { pos.push(...p); uv.push((p[0] + p[2]) / uvScale, (p[1] * 1.6 + Math.abs(p[2]) * 0.3) / uvScale); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
}
function gableTri(W, H) { // 立面三角山牆，面朝 -z
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-W / 2, 0, 0, 0, H, 0, W / 2, 0, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0.5, 1, 1, 0], 2)); g.computeVertexNormals(); return g;
}

// 找輪廓的最小外接矩形（旋轉卡尺的簡化版：試每條邊方向）
export function orientedBox(ring) {
  let best = null;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length]; const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const c = Math.cos(ang), s = Math.sin(ang); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const p of ring) { const u = p[0] * c + p[1] * s, v = -p[0] * s + p[1] * c; x0 = Math.min(x0, u); x1 = Math.max(x1, u); z0 = Math.min(z0, v); z1 = Math.max(z1, v); }
    const area = (x1 - x0) * (z1 - z0);
    if (!best || area < best.area) best = { area, ang, c, s, x0, x1, z0, z1 };
  }
  let { ang, c, s, x0, x1, z0, z1 } = best; let L = x1 - x0, D = z1 - z0;
  if (D > L) { ang += Math.PI / 2; [L, D] = [D, L]; const cc = Math.cos(ang), ss = Math.sin(ang); c = cc; s = ss; let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9; for (const p of ring) { const u = p[0] * c + p[1] * s, v = -p[0] * s + p[1] * c; a0 = Math.min(a0, u); a1 = Math.max(a1, u); b0 = Math.min(b0, v); b1 = Math.max(b1, v); } x0 = a0; x1 = a1; z0 = b0; z1 = b1; }
  const um = (x0 + x1) / 2, vm = (z0 + z1) / 2;
  return { L, D, cx: um * c - vm * s, cz: um * s + vm * c, ang };
}

export function buildStation(ring, frontPoint) {
  const box = orientedBox(ring);
  const g = new THREE.Group(); g.name = 'station1917';
  const L = box.L, D = Math.min(box.D, 16), EAVE = 10;
  const mat = (map, rx = 1, ry = 1, o = {}) => { const t = map.clone(); t.repeat.set(rx, ry); t.needsUpdate = true; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, ...o }); };
  const bay = bayTexture(), pav = pavilionTexture(), slate = slateTexture(), gab = gableTexture(), tow = towerTexture();
  const brickPlain = new THREE.MeshStandardMaterial({ color: 0x8e3a26, roughness: 0.9 });
  const white = new THREE.MeshStandardMaterial({ color: 0xeee6d4, roughness: 0.7 });
  const slateM = mat(slate, 4, 4);
  const add = (geo, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  const wallBox = (w, h, d, x, z, frontMat, sideMat) => add(new THREE.BoxGeometry(w, h, d), [sideMat, sideMat, slateM, slateM, sideMat, frontMat], x, h / 2, z);
  // 主體（正面 = -z，背面 = +z；Box 材質順序 +x,-x,+y,-y,+z,-z）
  const bays = Math.round(L / 4.5);
  const front = mat(bay, bays, 1), sideM = mat(bay, Math.round(D / 4.5), 1);
  const main = wallBox(L, EAVE, D, 0, 0, front, sideM); main.material[4] = front;
  add(hipRoof(L + 0.8, D + 0.8, 7.5), slateM, 0, EAVE, 0);
  add(new THREE.BoxGeometry(L + 1, 0.5, D + 1), white, 0, EAVE - 0.1, 0); // 簷口
  // 兩端角樓
  for (const sx of [-1, 1]) {
    const w = 7, x = sx * (L / 2 - w / 2 + 0.3);
    wallBox(w, EAVE + 1.4, 1.2, x, -D / 2 - 0.5, mat(bay, 1.5, 1.14), brickPlain);
    add(hipRoof(w + 0.6, 4, 2.8), slateM, x, EAVE + 1.4, -D / 2 + 1);
    add(new THREE.BoxGeometry(w + 0.6, 0.45, 1.8), white, x, EAVE + 1.3, -D / 2 - 0.4);
  }
  // 中央山牆塊
  const PW = 14, PH = 13.5;
  const pavBox = add(new THREE.BoxGeometry(PW, PH, D + 2), [brickPlain, brickPlain, slateM, slateM, mat(pav), mat(pav)], 0, PH / 2, -1);
  add(gableRoof(PW + 0.8, D + 3, 5.2), slateM, 0, PH, -1);
  add(gableTri(PW, 5.2), new THREE.MeshStandardMaterial({ map: gab, roughness: 0.85, side: THREE.DoubleSide }), 0, PH, -D / 2 - 2.02);
  add(new THREE.BoxGeometry(PW + 1, 0.5, 0.8), white, 0, PH, -D / 2 - 2.1);
  for (const sx of [-1, 1]) { // 山牆兩側的白色裝飾柱頭
    add(new THREE.BoxGeometry(1.2, 2.6, 1.2), white, sx * (PW / 2 - 0.2), PH + 1.1, -D / 2 - 2.1);
    add(new THREE.ConeGeometry(0.7, 1.4, 4), white, sx * (PW / 2 - 0.2), PH + 3.1, -D / 2 - 2.1, Math.PI / 4);
  }
  // 鐘塔＋尖頂
  const TB = PH + 4.2, TW = 3.8, TH = 5.2;
  const towM = mat(tow);
  add(new THREE.BoxGeometry(TW, TH, TW), towM, 0, TB + TH / 2, 2.5);
  add(new THREE.BoxGeometry(TW + 1.4, 0.6, TW + 1.4), new THREE.MeshStandardMaterial({ color: 0x7c7d70, roughness: 0.8 }), 0, TB + TH, 2.5);
  const copper = new THREE.MeshStandardMaterial({ color: 0x6f8f7a, roughness: 0.6, metalness: 0.3 });
  add(new THREE.ConeGeometry(TW * 0.75, 3.6, 4, 1), copper, 0, TB + TH + 2.1, 2.5, Math.PI / 4);
  add(new THREE.CylinderGeometry(0.08, 0.12, 3, 6), copper, 0, TB + TH + 5.2, 2.5);
  // 正面長廊（雨庇）：木柱、波浪板屋頂
  const vd = 5, vh = 4.2;
  const canopy = add(new THREE.BoxGeometry(L + 6, 0.3, vd), new THREE.MeshStandardMaterial({ color: 0x9a7d5c, roughness: 0.8 }), 0, vh, -D / 2 - vd / 2 - 0.2);
  canopy.rotation.x = -0.16; canopy.position.y += 0.3;
  add(new THREE.BoxGeometry(L + 6, 0.5, 0.15), white, 0, vh - 0.25, -D / 2 - vd - 0.2);
  const colG = new THREE.CylinderGeometry(0.13, 0.16, vh, 8);
  const n = Math.round((L + 6) / 4.2);
  const cols = new THREE.InstancedMesh(colG, white, n + 1); const m4 = new THREE.Matrix4();
  for (let i = 0; i <= n; i++) { m4.makeTranslation(-(L + 6) / 2 + (i * (L + 6)) / n, vh / 2, -D / 2 - vd); cols.setMatrixAt(i, m4); }
  cols.castShadow = true; g.add(cols);
  // 定位：盒子的 -z 面朝向站前廣場
  let rot = -box.ang; // 本地 x 對齊輪廓長軸
  const toFront = new THREE.Vector2(frontPoint[0] - box.cx, frontPoint[1] - box.cz);
  const localFront = new THREE.Vector2(Math.sin(box.ang), -Math.cos(box.ang)); // 本地 -z 轉到世界後的方向
  if (toFront.dot(localFront) < 0) rot += Math.PI;
  g.rotation.y = rot; g.position.set(box.cx, 0, box.cz);
  g.userData.height = TB + TH + 6;
  return g;
}
