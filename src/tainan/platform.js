// 把臺南引擎接到首頁共用框架（城市列、主畫布、年代列、我的攝影）。
import { ERAS } from './eras.js';
const el = id => document.getElementById(id);
document.body.classList.add('tainan-platform');
el('stage').innerHTML = '<canvas id="scene" aria-label="臺南車站立體街景"></canvas><div id="walkHint" hidden>W A S D／方向鍵移動・拖曳轉向・Shift 快走｜手機：左半邊拖曳前進、右半邊轉向</div>';
el('cityHeading').textContent = '臺南驛前'; el('cityEn').textContent = 'TAINAN CITY · TAIWAN';
el('viewEnglish').textContent = 'TAINAN STATION'; el('destination').value = 'tainan';
for (const key of ['taichung', 'changhua', 'taipei', 'kaohsiung', 'tainan']) {
  const b = el(key + 'City'); b.setAttribute('aria-pressed', String(key === 'tainan'));
  if (key !== 'tainan') b.onclick = () => location.assign('?place=' + ({ taichung: 'station', changhua: 'changhua', taipei: 'taipei', kaohsiung: 'kaohsiung' })[key]);
}
el('destination').onchange = e => { if (e.target.value !== 'tainan') location.assign('?place=' + places[Number(e.target.value)].key) };
el('places').innerHTML = `<strong>臺南車站與站前廣場</strong><p id="story"></p>
<label>鏡位<select id="shot"></select></label>
<label>焦距 <output id="mmOut">35 mm</output><input id="mm" type="range" min="16" max="105" step="1" value="35"></label>
<label>天氣<select id="weather"></select></label>
<label>時刻 <output id="clock"></output><input id="hour" type="range" min="0" max="23.75" step=".25" value="15.5"></label>
<div class="tn-actions"><button id="tnWalk" aria-pressed="false">漫步</button><button id="compare">今昔並排</button><button id="share">複製場景網址</button></div>
<details id="evidence"><summary>重建依據與可信度</summary><table id="evTable"></table><p class="tn-note">A：照片或官方文字直接佐證　B：依照片比例推估　C：示意</p></details>
<p id="status" role="status">載入中…</p>`;
for (const [key, v] of Object.entries({ clear: '晴天', cloudy: '多雲', rain: '雨天', fog: '晨霧' })) el('weather').add(new Option(v, key));
const bar = document.querySelector('.time-switch'); bar.id = 'eras'; bar.replaceChildren();
ERAS.forEach((e, i) => { const b = document.createElement('button'); b.textContent = e.year + ' ' + e.name; b.setAttribute('aria-pressed', 'false'); b.onclick = () => api.setEra(i); bar.append(b); });
const style = document.createElement('style');
style.textContent = `.tainan-platform .tn-actions{display:flex;gap:6px;flex-wrap:wrap}.tainan-platform .tn-actions button{flex:1}.tainan-platform #tnWalk[aria-pressed=true]{background:#243b35;color:#f4ead3}
.tainan-platform #evidence{font-size:.78rem;line-height:1.45}.tainan-platform #evidence summary{cursor:pointer;font-weight:600}.tainan-platform #evTable td{padding:3px 4px;vertical-align:top;border-bottom:1px solid #ddd8c6}.tainan-platform #evTable td:nth-child(2){font-weight:700;color:#a74e35}.tn-note{color:#6b6a5e;font-size:.72rem}
#walkHint{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);background:#17221dd9;color:#f0e6cf;font-size:.78rem;padding:6px 12px;border-radius:4px;pointer-events:none;white-space:nowrap}
@media(max-width:760px){#walkHint{white-space:normal;width:90%;text-align:center}}`;
document.head.append(style);

const status = t => { el('status').textContent = t; };
let api;
try {
  const { createTainan } = await import('./main.js');
  api = await createTainan(el('scene'), {
    status,
    onEra(i) {
      const e = ERAS[i]; [...bar.children].forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
      el('viewYear').textContent = e.year; el('viewName').textContent = e.name; el('modelInfo').textContent = e.story; el('story').textContent = e.story;
      el('evTable').innerHTML = e.evidence.map(([k, c, s]) => `<tr><td>${k}</td><td>${c}</td><td>${s}</td></tr>`).join('');
    },
    onShot(i) { el('shot').value = i; el('mm').value = api?.state.mm ?? 35; el('mmOut').textContent = (api?.state.mm ?? 35) + ' mm'; },
    onWalk(on) { el('tnWalk').setAttribute('aria-pressed', String(on)); el('walkHint').hidden = !on; },
  });
} catch (err) {
  console.error(err); el('loading').hidden = false; el('loading').textContent = '臺南街景載入失敗：' + (err?.message || err) + '。請確認瀏覽器已開啟硬體加速後重新整理。'; throw err;
}
window.tainan = api;   // 供測試與除錯
api.shots.forEach((s, i) => el('shot').add(new Option(s.name, i)));
el('shot').value = String(api.state.shot ?? 0);
el('weather').value = api.state.weather; el('hour').value = api.state.hour; el('mm').value = api.state.mm; el('mmOut').textContent = api.state.mm + ' mm';
const fmt = h => String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.round(h % 1 * 60)).padStart(2, '0');
el('clock').textContent = fmt(api.state.hour);
el('loading').hidden = true;
el('shot').onchange = () => api.setShot(+el('shot').value);
el('mm').oninput = () => { api.setFocal(+el('mm').value); el('mmOut').textContent = el('mm').value + ' mm'; };
el('weather').onchange = () => api.setWeather(el('weather').value);
el('hour').oninput = () => { api.setHour(+el('hour').value); el('clock').textContent = fmt(+el('hour').value); };
el('tnWalk').onclick = () => api.toggleWalk();
el('compare').onclick = () => { const { canvas, title } = api.compare(); window.saveTainanPhoto(canvas, title); status('今昔並排已存入「我的攝影」'); };
el('share').onclick = async () => { const u = api.shareURL(); history.replaceState(null, '', u); try { await navigator.clipboard.writeText(u); status('已複製場景網址（含年代、天氣、時刻與鏡頭位置）'); } catch { status(u); } };
el('resetView').onclick = () => api.setShot(+el('shot').value);
el('plus').onclick = () => api.zoom(0.82); el('minus').onclick = () => api.zoom(1.22);
el('shutter').onclick = () => { const c = api.snapshot(); window.saveTainanPhoto(c, el('viewYear').textContent + ' · ' + el('viewName').textContent); };
el('full').onclick = () => document.fullscreenElement ? document.exitFullscreen() : el('viewer').requestFullscreen();
el('sourceBtn').onclick = () => openDialog('TAINAN STATION', '臺南站房與街區：資料來源', `<p>站房：依館藏落成照、明信片與 2009／2024 年照片，以 Blender 重建（tools/blender/tainan_station_1936.py、tainan_station_1900.py）。樓高與出挑為照片比例推估。</p><p>街廓與路網：© OpenStreetMap contributors（ODbL），僅用於現代年代；1920–1970 年代街屋以主要道路兩側位置示意密度，非當年測繪。</p><p>2026 年現況：交通部鐵道局 2026-10-19 新聞稿（地下化第一階段通車）、聯合新聞網 2026-03-26（古蹟修復停擺、站體包覆）。</p><p>館藏照片授權未確認，僅作建模參考，未於網站轉載。</p>`);
el('help').onclick = () => openDialog('CAMERA', '臺南取景', '<p>拖曳環繞、右鍵平移、滾輪縮放。切換年代時鏡頭不動，可直接比較今昔。「漫步」以人眼高度走進廣場或月臺；「今昔並排」會把目前鏡頭的兩個年代並排存入我的攝影；「複製場景網址」會記住年代、天氣、時刻與鏡頭位置。</p>');

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
  document.body.classList.add('tainan-map-ready');
}
drawStationMap().catch(() => { });
