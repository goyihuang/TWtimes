// 把臺南引擎接到首頁共用框架（城市列、主畫布、年代列、我的攝影）與共用場景面板。
import { mountScenePanel, showLoadError } from '../shared/scene-panel.js';
import { setupModuleFrame } from '../shared/platform-frame.js';
const el = id => document.getElementById(id);

const canvas = setupModuleFrame({ key: 'tainan', heading: '臺南驛前', cityEn: 'TAINAN CITY · TAIWAN', english: 'TAINAN STATION', canvasLabel: '臺南車站立體街景' });
const panel = mountScenePanel({ title: '臺南車站與站前廣場', en: 'TAINAN STATION' });
let api;
try {
  const { createTainan } = await import('./main.js');
  api = await createTainan(canvas, panel.ui);
} catch (err) { showLoadError('臺南街景', err); throw err; }
window.tainan = api;   // 供測試與除錯
panel.bind(api);

el('sourceBtn').onclick = () => openDialog('TAINAN STATION', '臺南站房與街區：資料來源', `<p>站房：依館藏落成照、明信片與 2009／2024 年照片，以 Blender 重建（tools/blender/tainan_station_1936.py、tainan_station_1900.py）。樓高與出挑為照片比例推估。</p><p>街廓與路網：© OpenStreetMap contributors（ODbL），僅用於現代年代；1920–1970 年代街屋以主要道路兩側位置示意密度，非當年測繪。</p><p>2026 年現況：交通部鐵道局 2026-10-19 新聞稿（地下化第一階段通車）、聯合新聞網 2026-03-26（古蹟修復停擺、站體包覆）。</p><p>館藏照片授權未確認，僅作建模參考，未於網站轉載。</p>`);
el('help').onclick = () => openDialog('CAMERA', '臺南取景', '<p>拖曳環繞、右鍵平移、滾輪縮放。切換年代時鏡頭不動，可直接比較今昔。「漫步」以人眼高度走進廣場或月臺；「今昔並排」會把目前鏡頭的兩個年代並排存入我的攝影；「複製場景網址」會記住年代、天氣、時刻與鏡頭位置；「純畫面」或 H 鍵隱藏畫面按鈕。</p>');

async function drawStationMap() {
  const data = await (await fetch('data/tainan-station.osm.json')).json();
  const map = el('mini'), ctx = map.getContext('2d'); map.width = 480; map.height = 240;
  const point = ([x, y]) => [(data.origin[0] + x * data.scale - 120.2125815) * 102400 * .72 + 240, 120 - (data.origin[1] + y * data.scale - 22.9971425) * 110540 * .72];
  ctx.fillStyle = '#e6e3d3'; ctx.fillRect(0, 0, 480, 240);
  for (const [, tags, points] of data.ways) {
    if (!tags.highway && !tags.building) continue;
    ctx.beginPath(); points.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](...point(p)));
    if (tags.building) { ctx.fillStyle = '#c5cbb9'; ctx.fill() } else { ctx.strokeStyle = '#faf8ed'; ctx.lineWidth = tags.highway === 'primary' ? 8 : 3; ctx.stroke() }
  }
  ctx.fillStyle = '#a74e35'; ctx.beginPath(); ctx.arc(240, 120, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#294537'; ctx.font = '18px sans-serif'; ctx.fillText('臺南車站', 250, 125);
  el('coord').textContent = '22.997° N / 120.213° E'; map.setAttribute('aria-label', '臺南車站現代街區定位'); map.onclick = () => api.setShot(+el('shot').value);
  document.body.classList.add('module-map-ready');
}
drawStationMap().catch(() => { });
