// 出處標示：畫面右下角、快門照片、今昔並排、9:16 短片、匯出的 GLB 都自動帶上場景用到的資料出處。
// 場景 API 提供 credits: string[]（或回傳陣列的函式），例如 ['© OpenStreetMap contributors（ODbL）', '© OpenMapTiles']。
// OpenStreetMap（ODbL）與 OpenMapTiles 都要求公開的畫面與衍生資料標示出處。

export const OSM_CREDIT = '© OpenStreetMap contributors（ODbL）';
export const OMT_CREDIT = '© OpenMapTiles';

export const creditsOf = api => { const c = typeof api?.credits === 'function' ? api.credits() : api?.credits; return Array.isArray(c) ? c.filter(Boolean) : []; };
export const creditLine = list => [...new Set(list)].join('　');

/** 在畫布右下角蓋上出處（就地修改並回傳同一張畫布） */
export function stampCredits(canvas, list) {
  const text = creditLine(list || []); if (!text || !canvas?.getContext) return canvas;
  const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  const fs = Math.max(11, Math.round(Math.min(W, H) * 0.017)), pad = Math.round(fs * 0.6);
  g.save();
  g.font = `500 ${fs}px "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif`;
  const w = Math.min(W - pad * 2, g.measureText(text).width);
  g.fillStyle = 'rgba(16,20,19,.46)'; g.fillRect(W - w - pad * 2, H - fs - pad * 1.6, w + pad * 2, fs + pad * 1.6);
  g.fillStyle = 'rgba(255,252,244,.92)'; g.textBaseline = 'middle'; g.textAlign = 'right';
  g.fillText(text, W - pad, H - (fs + pad * 1.6) / 2, W - pad * 2);
  g.restore();
  return canvas;
}

/** 畫面上的出處列（#stage 右下角），換場景時重畫 */
export function showCredits(list) {
  const st = document.getElementById('stage'); if (!st) return;
  let n = document.getElementById('creditLine');
  if (!n) { n = document.createElement('div'); n.id = 'creditLine'; n.className = 'credit-line'; st.append(n); }
  const text = creditLine(list || []); n.hidden = !text; n.textContent = text;
}

/** 在 GLB 的 asset.copyright 寫入出處（glTF 2.0 規格欄位），回傳新的 ArrayBuffer */
export function stampGLB(buf, copyright) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) return buf; // 'glTF'
  const jsonLen = dv.getUint32(12, true);
  if (dv.getUint32(16, true) !== 0x4e4f534a) return buf; // 'JSON'
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
  json.asset = { ...json.asset, copyright };
  let bytes = new TextEncoder().encode(JSON.stringify(json));
  const padded = Math.ceil(bytes.length / 4) * 4, jb = new Uint8Array(padded).fill(0x20); jb.set(bytes); bytes = jb;
  const rest = new Uint8Array(buf, 20 + jsonLen), total = 12 + 8 + padded + rest.length;
  const out = new Uint8Array(total), o = new DataView(out.buffer);
  o.setUint32(0, 0x46546c67, true); o.setUint32(4, 2, true); o.setUint32(8, total, true);
  o.setUint32(12, padded, true); o.setUint32(16, 0x4e4f534a, true); out.set(bytes, 20); out.set(rest, 20 + padded);
  return out.buffer;
}

/** どこでもロケハン（MIYADAIKU／おやすみゲーム開発部）同一地點的連結。只開新分頁，不嵌入、不取用它的資料。 */
export function rokehanURL({ lat, lng, name = '', hour = null, size = 300 }) {
  const tod = hour == null ? '' : (hour >= 23 || hour < 4) ? 'late' : (hour >= 19 || hour < 5.5) ? 'night' : hour >= 16.5 ? 'dusk' : 'day';
  const s = [100, 200, 300, 400, 600, 800, 1000].reduce((a, b) => Math.abs(b - size) < Math.abs(a - size) ? b : a);
  const p = [`ll=${lat.toFixed(6)},${lng.toFixed(6)}`, `s=${s}`];
  if (tod && tod !== 'day') p.push('tod=' + tod);
  if (name) p.push('n=' + encodeURIComponent(name.slice(0, 40)));
  return 'https://tools.oyasumi-gamedev.com/rokehan/#' + p.join('&').replace(',', '%2C');
}
