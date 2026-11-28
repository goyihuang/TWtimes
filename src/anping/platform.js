// 把安平・大員引擎接到首頁共用框架（城市列、主畫布、年代列、我的攝影）與共用場景面板。
import { mountScenePanel, showLoadError } from '../shared/scene-panel.js';
import { setupModuleFrame } from '../shared/platform-frame.js';
const el = id => document.getElementById(id);

const canvas = setupModuleFrame({ key: 'anping', heading: '安平・大員', cityEn: 'TAINAN CITY · TAIWAN', english: 'FORT ZEELANDIA · ANPING', canvasLabel: '熱蘭遮城與安平古堡立體街景' });
const panel = mountScenePanel({ title: '熱蘭遮城・安平古堡', en: 'FORT ZEELANDIA · ANPING' });
let api;
try {
  const { createAnping } = await import('./main.js');
  api = await createAnping(canvas, panel.ui);
} catch (err) { showLoadError('安平街景', err); throw err; }
window.anping = api;   // 供測試與除錯
panel.bind(api);

el('sourceBtn').onclick = () => openDialog('FORT ZEELANDIA', '熱蘭遮城與大員市鎮：資料來源', `<p>城堡與市鎮平面：描自國立成功大學博物館〈熱蘭遮城與大員城下町〉今昔疊圖（比例尺量得每像素 0.532 公尺），以 OpenStreetMap 的安平古堡平臺與現存外堡南牆（熱蘭遮城殘跡）對位，南牆位置誤差小於 3 公尺。疊圖僅作描圖參考，未於網站轉載。</p><p>城堡高度、房屋樣式：依 1635、1644、1648 年景觀圖與鳥瞰圖比例推估（可信度 C）。</p><p>1871 年殘跡：湯姆生（John Thomson）攝熱蘭遮城殘牆與城門（原件公眾領域）。1935 年燈塔與臺階：日治時期照片與明信片。</p><p>今日街廓、道路、運河、古蹟位置：© OpenStreetMap contributors（ODbL），2026-11-28 下載。</p><p>館藏照片授權未確認，僅作建模參考，未於網站轉載。每個年代的「重建依據」列出 A／B／C 可信度；完整說明見 docs/anping-evidence.md。</p>`);
el('help').onclick = () => openDialog('CAMERA', '安平取景', '<p>拖曳環繞、右鍵平移、滾輪縮放。切換年代時鏡頭不動，可以站在同一個位置看 1644 年的城堡、1871 年的殘牆、1935 年的燈塔與今天的瞭望臺。「漫步」以人眼高度走上城堡平臺或市鎮街道；「今昔並排」把目前鏡頭的兩個年代並排存入我的攝影；「複製場景網址」會記住年代、天氣、時刻與鏡頭位置；「純畫面」或 H 鍵隱藏畫面按鈕。</p>');

async function drawMap() {
  const data = await (await fetch('data/anping.osm.json')).json();
  const map = el('mini'), ctx = map.getContext('2d'); map.width = 480; map.height = 240;
  const k = 0.42, point = ([x, z]) => [240 + (x - 110) * k, 120 + (z - 30) * k];
  ctx.fillStyle = '#e6e3d3'; ctx.fillRect(0, 0, 480, 240);
  const draw = (pts, fill, stroke, w) => { ctx.beginPath(); pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](...point(p))); if (fill) { ctx.fillStyle = fill; ctx.fill() } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = w; ctx.stroke() } };
  for (const [kind, , pts] of data.ways) {
    if (kind === 'W') draw(pts, '#b9cdd0');
    else if (kind[0] === 'b') draw(pts, '#c5cbb9');
    else if (kind[0] === 'h') draw(pts, null, '#faf8ed', kind < 'h4' ? 6 : 2.5);
    else if (kind === 'm') draw(pts, null, '#a74e35', 3);
  }
  const [cx, cy] = point([3, -8]);
  ctx.fillStyle = '#a74e35'; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#294537'; ctx.font = '18px sans-serif'; ctx.fillText('安平古堡', cx + 10, cy + 5);
  el('coord').textContent = '23.002° N / 120.161° E'; map.setAttribute('aria-label', '安平古堡與老街現代街區定位'); map.onclick = () => api.setShot(+el('shot').value);
  document.body.classList.add('module-map-ready');
}
drawMap().catch(() => { });
