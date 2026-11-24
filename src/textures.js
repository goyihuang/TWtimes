import * as THREE from 'three';

// 所有材質都在瀏覽器裡用 Canvas 程序化繪製：不需要下載圖檔，也沒有版權問題。
// 牆面貼圖一張 = 4 開間 × 3 層樓（16m × 9.6m）；地面層一張 = 4 開間 × 1 層（16m × 4m）。
export const WALL_TILE = { w: 16, h: 9.6 };
export const GROUND_TILE = { w: 16, h: 4 };

const FONT = '"Noto Sans TC","Microsoft JhengHei","PingFang TC","Heiti TC",sans-serif';
const SERIF = '"Noto Serif TC","PMingLiU","Songti TC",serif';

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296; }
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function noise(ctx, w, h, amt, r) { const img = ctx.getImageData(0, 0, w, h); const d = img.data; for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; } ctx.putImageData(img, 0, 0); }
function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}
function streaks(ctx, w, h, r, alpha = 0.08) { // 雨水垂流痕跡
  for (let i = 0; i < 40; i++) { const x = r() * w; ctx.fillStyle = `rgba(40,35,30,${alpha * r()})`; ctx.fillRect(x, r() * h * 0.5, 1 + r() * 2, h * (0.2 + r() * 0.6)); }
}

const SIGN_WORDS = ['藥局', '咖啡', '銀樓', '旅社', '眼鏡', '診所', '餐廳', '茶行', '鞋店', '服飾', '冰果室', '書局', '牙醫', '麵店', '大飯店', '當舖', '鐘錶', '補習班', '銀行', 'KTV', '珍珠奶茶', '小吃', '五金', '電器', '照相館', '中藥行'];
const OLD_WORDS = ['商行', '吳服店', '寫真館', '藥舖', '茶舖', '旅館', '金物店', '時計店', '書房', '米商', '雜貨', '料理', '菓子', '醫院'];
const SIGN_COLORS = ['#c8102e', '#0057a8', '#f2a900', '#00843d', '#e4572e', '#ffffff', '#222', '#7b2d8b', '#ff6f00', '#1aa3a3'];

// ── 現代：磁磚外牆 + 鋁窗、鐵窗、冷氣 ──
function modernWall(base, seed, { glass = false } = {}) {
  const W = 512, H = 307; const [c, x] = canvas(W, H); const [ce, xe] = canvas(W, H); const r = rng(seed);
  x.fillStyle = base; x.fillRect(0, 0, W, H);
  // 磁磚格線
  x.strokeStyle = 'rgba(0,0,0,0.06)'; x.lineWidth = 1;
  for (let i = 0; i < W; i += 6) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); }
  for (let j = 0; j < H; j += 4) { x.beginPath(); x.moveTo(0, j); x.lineTo(W, j); x.stroke(); }
  noise(x, W, H, 14, r);
  xe.fillStyle = '#000'; xe.fillRect(0, 0, W, H);
  const bw = W / 4, fh = H / 3;
  for (let b = 0; b < 4; b++) for (let f = 0; f < 3; f++) {
    const x0 = b * bw, y0 = f * fh;
    if (glass) {
      const g = x.createLinearGradient(0, y0, 0, y0 + fh); g.addColorStop(0, '#5d7f99'); g.addColorStop(1, '#2c4256');
      x.fillStyle = g; x.fillRect(x0 + 2, y0 + 6, bw - 4, fh - 12);
      x.fillStyle = 'rgba(255,255,255,0.15)'; x.fillRect(x0 + 2, y0 + 6, (bw - 4) * 0.3, fh - 12);
      x.fillStyle = '#9aa3ab'; x.fillRect(x0, y0 + fh - 6, bw, 6);
      if (r() < 0.55) { xe.fillStyle = `rgba(255,${210 + r() * 40},${150 + r() * 60},${0.5 + r() * 0.5})`; xe.fillRect(x0 + 2, y0 + 6, bw - 4, fh - 12); }
      continue;
    }
    const ww = bw * (0.5 + r() * 0.25), wh = fh * 0.52, wx = x0 + (bw - ww) / 2, wy = y0 + fh * 0.2;
    const g = x.createLinearGradient(0, wy, 0, wy + wh); g.addColorStop(0, '#4a5a66'); g.addColorStop(1, '#1d262d');
    x.fillStyle = '#c9ccce'; x.fillRect(wx - 3, wy - 3, ww + 6, wh + 6); // 鋁框
    x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
    x.fillStyle = '#c9ccce'; x.fillRect(wx + ww / 2 - 1, wy, 2, wh);
    if (r() < 0.5) { x.fillStyle = 'rgba(240,240,230,0.55)'; x.fillRect(wx + 2, wy + 2, ww * 0.45, wh - 4); } // 窗簾
    if (r() < 0.6) { // 鐵窗
      x.strokeStyle = r() < 0.5 ? '#3a3a3a' : '#e8e8e8'; x.lineWidth = 2;
      x.strokeRect(wx - 6, wy - 6, ww + 12, wh + 12);
      for (let k = wx - 6; k < wx + ww + 6; k += 8) { x.beginPath(); x.moveTo(k, wy - 6); x.lineTo(k, wy + wh + 6); x.stroke(); }
    }
    if (r() < 0.55) { // 冷氣室外機
      x.fillStyle = '#e9ebe9'; const ax = x0 + (r() < 0.5 ? 8 : bw - 46), ay = wy + wh + 10; x.fillRect(ax, ay, 38, 22);
      x.strokeStyle = '#999'; x.lineWidth = 1; x.beginPath(); x.arc(ax + 13, ay + 11, 8, 0, 7); x.stroke();
    }
    if (r() < 0.6) { xe.fillStyle = `rgba(255,${200 + r() * 50},${140 + r() * 80},${0.55 + r() * 0.45})`; xe.fillRect(wx, wy, ww, wh); }
  }
  streaks(x, W, H, r, 0.06);
  return { map: tex(c), emissiveMap: tex(ce) };
}

// ── 現代地面層：店面、鐵捲門、橫式招牌 ──
function modernGround(seed) {
  const W = 512, H = 128; const [c, x] = canvas(W, H); const [ce, xe] = canvas(W, H); const r = rng(seed);
  x.fillStyle = '#6b6b68'; x.fillRect(0, 0, W, H); xe.fillStyle = '#000'; xe.fillRect(0, 0, W, H);
  const bw = W / 4;
  for (let b = 0; b < 4; b++) {
    const x0 = b * bw; const signH = 34;
    const col = SIGN_COLORS[Math.floor(r() * SIGN_COLORS.length)];
    x.fillStyle = col; x.fillRect(x0 + 2, 4, bw - 4, signH);
    const word = SIGN_WORDS[Math.floor(r() * SIGN_WORDS.length)];
    const light = col === '#ffffff' || col === '#f2a900';
    x.fillStyle = light ? '#c8102e' : '#fff'; x.font = `bold 24px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(word, x0 + bw / 2, 4 + signH / 2 + 1);
    xe.fillStyle = col; xe.globalAlpha = 0.9; xe.fillRect(x0 + 2, 4, bw - 4, signH); xe.globalAlpha = 1;
    xe.fillStyle = light ? '#c8102e' : '#fff'; xe.font = x.font; xe.textAlign = 'center'; xe.textBaseline = 'middle'; xe.fillText(word, x0 + bw / 2, 4 + signH / 2 + 1);
    const y0 = signH + 10, h = H - y0;
    if (r() < 0.3) { // 鐵捲門
      x.fillStyle = '#a7aaa8'; x.fillRect(x0 + 6, y0, bw - 12, h);
      x.strokeStyle = 'rgba(0,0,0,0.25)'; for (let k = y0; k < H; k += 4) { x.beginPath(); x.moveTo(x0 + 6, k); x.lineTo(x0 + bw - 6, k); x.stroke(); }
    } else { // 玻璃店面
      const g = x.createLinearGradient(0, y0, 0, H); g.addColorStop(0, '#8a7a5c'); g.addColorStop(1, '#3a3026');
      x.fillStyle = g; x.fillRect(x0 + 6, y0, bw - 12, h);
      for (let k = 0; k < 6; k++) { x.fillStyle = `hsl(${r() * 360},50%,${45 + r() * 25}%)`; x.fillRect(x0 + 10 + r() * (bw - 30), y0 + 20 + r() * (h - 30), 8 + r() * 14, 6 + r() * 12); }
      x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(x0 + 6, y0, (bw - 12) * 0.35, h);
      xe.fillStyle = `rgba(255,${215 + r() * 40},${170 + r() * 60},0.85)`; xe.fillRect(x0 + 6, y0, bw - 12, h);
    }
    x.fillStyle = '#8f8f8a'; x.fillRect(x0, signH + 4, 6, H); // 騎樓柱
  }
  noise(x, W, H, 8, r);
  return { map: tex(c), emissiveMap: tex(ce) };
}

// ── 1935：洗石子／灰泥街屋立面，直長窗與線腳 ──
function oldWall(base, trim, seed, { brick = false, bands = false, arched = true } = {}) {
  const W = 512, H = 307; const [c, x] = canvas(W, H); const [ce, xe] = canvas(W, H); const r = rng(seed);
  x.fillStyle = base; x.fillRect(0, 0, W, H);
  if (brick) {
    x.fillStyle = 'rgba(255,255,255,0.10)';
    for (let j = 0; j < H; j += 6) { const off = (j / 6) % 2 ? 6 : 0; for (let i = -12; i < W; i += 12) x.fillRect(i + off, j, 11, 1); x.fillRect(0, j + 5, W, 1); }
  }
  noise(x, W, H, 18, r);
  xe.fillStyle = '#000'; xe.fillRect(0, 0, W, H);
  const bw = W / 4, fh = H / 3;
  for (let f = 0; f < 3; f++) {
    const y0 = f * fh;
    x.fillStyle = trim; x.fillRect(0, y0 + fh - 6, W, 6); x.fillRect(0, y0 + fh - 10, W, 2);
    if (bands) { x.fillStyle = trim; x.fillRect(0, y0 + fh * 0.12, W, 8); x.fillRect(0, y0 + fh * 0.75, W, 6); }
    for (let b = 0; b < 4; b++) {
      const x0 = b * bw, ww = bw * 0.36, wh = fh * 0.55, wx = x0 + (bw - ww) / 2, wy = y0 + fh * 0.18;
      x.fillStyle = trim; x.fillRect(wx - 6, wy - 6, ww + 12, wh + 10);
      if (arched) { x.beginPath(); x.arc(wx + ww / 2, wy, ww / 2 + 6, Math.PI, 0); x.fill(); }
      x.fillStyle = '#2a2520';
      x.fillRect(wx, wy, ww, wh); if (arched) { x.beginPath(); x.arc(wx + ww / 2, wy, ww / 2, Math.PI, 0); x.fill(); }
      x.fillStyle = '#6b4a2e'; x.fillRect(wx - 10, wy, 8, wh); x.fillRect(wx + ww + 2, wy, 8, wh); // 木百葉
      x.fillStyle = '#d9d2c0'; x.fillRect(wx + ww / 2 - 1, wy - (arched ? ww / 2 : 0), 2, wh + (arched ? ww / 2 : 0)); x.fillRect(wx, wy + wh * 0.45, ww, 2);
      x.fillStyle = trim; x.fillRect(wx - 10, wy + wh + 2, ww + 20, 5); // 窗台
      if (r() < 0.45) { xe.fillStyle = `rgba(255,${170 + r() * 40},90,${0.5 + r() * 0.4})`; xe.fillRect(wx, wy, ww, wh); }
    }
  }
  streaks(x, W, H, r, 0.12);
  return { map: tex(c), emissiveMap: tex(ce) };
}

// ── 1935 地面層：亭仔腳拱廊 + 木招牌 ──
function arcadeGround(base, trim, seed) {
  const W = 512, H = 128; const [c, x] = canvas(W, H); const [ce, xe] = canvas(W, H); const r = rng(seed);
  x.fillStyle = base; x.fillRect(0, 0, W, H); noise(x, W, H, 16, r);
  xe.fillStyle = '#000'; xe.fillRect(0, 0, W, H);
  const bw = W / 4;
  for (let b = 0; b < 4; b++) {
    const x0 = b * bw, ox = x0 + 16, ow = bw - 32, oy = 40;
    const g = x.createLinearGradient(0, oy, 0, H); g.addColorStop(0, '#1c1712'); g.addColorStop(1, '#3d3226');
    x.fillStyle = g; x.fillRect(ox, oy, ow, H - oy); x.beginPath(); x.ellipse(ox + ow / 2, oy, ow / 2, 18, 0, Math.PI, 0); x.fill();
    // 店內的布簾、貨品
    if (r() < 0.6) { x.fillStyle = ['#2b3a67', '#7a2e2e', '#efe6d0'][Math.floor(r() * 3)]; x.fillRect(ox + 8, oy + 4, ow - 16, 22); }
    for (let k = 0; k < 5; k++) { x.fillStyle = `hsl(${30 + r() * 30},30%,${30 + r() * 30}%)`; x.fillRect(ox + 6 + r() * (ow - 20), H - 30 + r() * 10, 10 + r() * 10, 10 + r() * 8); }
    // 木招牌（黑底金字）
    x.fillStyle = '#1b1512'; x.fillRect(x0 + 24, 4, bw - 48, 22);
    x.fillStyle = '#d9b75a'; x.font = `bold 16px ${SERIF}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(OLD_WORDS[Math.floor(r() * OLD_WORDS.length)], x0 + bw / 2, 15);
    x.strokeStyle = trim; x.lineWidth = 3; x.strokeRect(x0 + 2, 30, bw - 4, H - 30);
    if (r() < 0.7) { xe.fillStyle = 'rgba(255,170,80,0.7)'; xe.fillRect(ox, oy, ow, H - oy); }
  }
  return { map: tex(c), emissiveMap: tex(ce) };
}

function woodWall(seed) { // 日式木造（雨淋板）
  const W = 512, H = 307; const [c, x] = canvas(W, H); const r = rng(seed);
  x.fillStyle = '#5b4632'; x.fillRect(0, 0, W, H);
  for (let j = 0; j < H; j += 7) { x.fillStyle = `rgba(0,0,0,${0.15 + r() * 0.1})`; x.fillRect(0, j, W, 2); }
  noise(x, W, H, 20, r);
  for (let b = 0; b < 4; b++) { x.fillStyle = '#e8e0cc'; x.fillRect(b * 128 + 30, 40, 68, 60); x.fillStyle = '#3a2a1c'; for (let k = 0; k < 5; k++) x.fillRect(b * 128 + 30 + k * 17, 40, 2, 60); x.fillRect(b * 128 + 30, 70, 68, 2); }
  return { map: tex(c) };
}

function roofTile(color, seed, tiles = true) {
  const W = 256, H = 256; const [c, x] = canvas(W, H); const r = rng(seed);
  x.fillStyle = color; x.fillRect(0, 0, W, H);
  if (tiles) for (let j = 0; j < H; j += 8) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, j, W, 2); for (let i = (j / 8) % 2 * 8; i < W; i += 16) x.fillRect(i, j, 2, 8); }
  noise(x, W, H, 22, r);
  return { map: tex(c) };
}
function concreteRoof(seed) {
  const W = 256, H = 256; const [c, x] = canvas(W, H); const r = rng(seed);
  x.fillStyle = '#8d8a84'; x.fillRect(0, 0, W, H); noise(x, W, H, 30, r);
  for (let k = 0; k < 12; k++) { x.fillStyle = `rgba(60,55,50,${r() * 0.2})`; x.beginPath(); x.ellipse(r() * W, r() * H, 10 + r() * 40, 6 + r() * 20, r() * 3, 0, 7); x.fill(); }
  return { map: tex(c) };
}

// ── 地面：柏油、泥土路、人行道、草地 ──
export function groundTextures() {
  const mk = (W, H, f) => { const [c, x] = canvas(W, H); f(x, W, H, rng(W * 7 + H)); return tex(c); };
  return {
    asphalt: mk(256, 256, (x, W, H, r) => { x.fillStyle = '#3c3d3f'; x.fillRect(0, 0, W, H); noise(x, W, H, 26, r); for (let k = 0; k < 6; k++) { x.fillStyle = `rgba(0,0,0,${r() * 0.15})`; x.fillRect(r() * W, r() * H, 20 + r() * 60, 10 + r() * 30); } }),
    dirt: mk(256, 256, (x, W, H, r) => { x.fillStyle = '#a08a68'; x.fillRect(0, 0, W, H); noise(x, W, H, 34, r); x.fillStyle = 'rgba(90,70,45,0.25)'; x.fillRect(0, H * 0.3, W, 10); x.fillRect(0, H * 0.65, W, 10); for (let k = 0; k < 80; k++) { x.fillStyle = `rgba(230,220,200,${r() * 0.4})`; x.fillRect(r() * W, r() * H, 2, 2); } }),
    tile: mk(256, 256, (x, W, H, r) => { for (let j = 0; j < H; j += 16) for (let i = 0; i < W; i += 32) { x.fillStyle = r() < 0.5 ? '#9c5a48' : '#8e8a82'; x.fillRect(i + ((j / 16) % 2) * 16, j, 31, 15); } noise(x, W, H, 16, r); }),
    earth: mk(256, 256, (x, W, H, r) => { x.fillStyle = '#b39f7c'; x.fillRect(0, 0, W, H); noise(x, W, H, 24, r); }),
    grass: mk(256, 256, (x, W, H, r) => { x.fillStyle = '#4d7a35'; x.fillRect(0, 0, W, H); for (let k = 0; k < 3000; k++) { x.fillStyle = `hsl(${85 + r() * 30},${35 + r() * 20}%,${22 + r() * 22}%)`; x.fillRect(r() * W, r() * H, 1, 2 + r() * 3); } }),
    ground: mk(256, 256, (x, W, H, r) => { x.fillStyle = '#5f5b55'; x.fillRect(0, 0, W, H); noise(x, W, H, 20, r); }),
    ground1935: mk(256, 256, (x, W, H, r) => { x.fillStyle = '#6f6a4c'; x.fillRect(0, 0, W, H); noise(x, W, H, 26, r); for (let k = 0; k < 400; k++) { x.fillStyle = `hsla(90,30%,30%,${r() * 0.4})`; x.fillRect(r() * W, r() * H, 2, 3); } }),
    ballast: mk(256, 64, (x, W, H, r) => { x.fillStyle = '#6e6862'; x.fillRect(0, 0, W, H); noise(x, W, H, 50, r); x.fillStyle = '#4a3522'; for (let i = 0; i < W; i += 12) x.fillRect(i, 8, 6, H - 16); x.fillStyle = '#8a8d90'; x.fillRect(0, 18, W, 3); x.fillRect(0, H - 21, W, 3); }),
    markings: mk(64, 256, (x, W, H) => { x.clearRect(0, 0, W, H); x.fillStyle = '#f4f1e6'; x.fillRect(W / 2 - 3, 0, 6, H * 0.55); }),
  };
}

// 立面風格表：每個風格有 wall/ground/roof 三種材質
export function facadeLibrary() {
  return {
    modernTile: { wall: modernWall('#d8d5cf', 11), ground: modernGround(12), roof: concreteRoof(13) },
    modernBeige: { wall: modernWall('#cbb89a', 21), ground: modernGround(22), roof: concreteRoof(23) },
    modernConcrete: { wall: modernWall('#a9a8a3', 31), ground: modernGround(32), roof: concreteRoof(33) },
    glass: { wall: modernWall('#7c8c99', 41, { glass: true }), ground: modernGround(42), roof: concreteRoof(43) },
    canopy: { wall: roofTile('#8c9196', 51, false), ground: roofTile('#8c9196', 52, false), roof: roofTile('#7f868c', 53, false) },
    temple: { wall: oldWall('#b8432f', '#e3c27a', 61, { arched: false }), ground: arcadeGround('#b8432f', '#e3c27a', 62), roof: roofTile('#c25a2a', 63) },
    shophouse1935a: { wall: oldWall('#d9cfb7', '#eee6d2', 71), ground: arcadeGround('#cfc4aa', '#e8dfc8', 72), roof: roofTile('#4b4a48', 73) },
    shophouse1935b: { wall: oldWall('#bfb7a6', '#dcd5c4', 81, { arched: false }), ground: arcadeGround('#b5ad9b', '#d6cfbe', 82), roof: roofTile('#4d4c49', 83) },
    shophouse1935c: { wall: oldWall('#c9b99a', '#efe3c6', 91, { bands: true }), ground: arcadeGround('#c2b190', '#e6d8b8', 92), roof: roofTile('#504c46', 93) },
    brick: { wall: oldWall('#9a4a35', '#e9e2d0', 101, { brick: true, bands: true }), ground: arcadeGround('#93452f', '#e9e2d0', 102), roof: roofTile('#3f3f42', 103) },
    tatsuno: { wall: oldWall('#a2442c', '#f1ece0', 111, { brick: true, bands: true }), ground: arcadeGround('#a2442c', '#f1ece0', 112), roof: roofTile('#3b4148', 113) },
    govt: { wall: oldWall('#e3dccb', '#f7f3ea', 121, { bands: true }), ground: arcadeGround('#d8cfbb', '#f7f3ea', 122), roof: roofTile('#41474d', 123) },
    wood: { wall: woodWall(131), ground: woodWall(132), roof: roofTile('#3e3e40', 133) },
    pavilion: { wall: oldWall('#efe9dd', '#b33a2a', 141, { arched: false }), ground: arcadeGround('#efe9dd', '#b33a2a', 142), roof: roofTile('#7a2a20', 143) },
    qing: { wall: oldWall('#b8754f', '#d9c4a0', 151, { brick: true, arched: false }), ground: arcadeGround('#b8754f', '#d9c4a0', 152), roof: roofTile('#8a4a33', 153) },
  };
}

// 直立招牌（台灣街景的靈魂）：一張圖集，8 種招牌
export function signAtlas() {
  const W = 512, H = 256; const [c, x] = canvas(W, H); const [ce, xe] = canvas(W, H); const r = rng(999);
  for (let i = 0; i < 8; i++) {
    const x0 = i * 64; const col = SIGN_COLORS[i % SIGN_COLORS.length];
    x.fillStyle = col; x.fillRect(x0 + 2, 2, 60, H - 4); xe.fillStyle = col; xe.fillRect(x0 + 2, 2, 60, H - 4);
    x.strokeStyle = '#fff'; x.lineWidth = 3; x.strokeRect(x0 + 6, 6, 52, H - 12);
    const w = SIGN_WORDS[Math.floor(r() * SIGN_WORDS.length)];
    const fg = col === '#ffffff' || col === '#f2a900' ? '#c8102e' : '#fff';
    for (const ctx of [x, xe]) { ctx.fillStyle = fg; ctx.font = `bold 40px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; [...w].slice(0, 4).forEach((ch, k, arr) => ctx.fillText(ch, x0 + 32, H / 2 + (k - (arr.length - 1) / 2) * 46)); }
  }
  return { map: tex(c), emissiveMap: tex(ce) };
}
