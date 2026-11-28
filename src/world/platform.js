// 全臺立體地景接到首頁共用框架與共用場景面板。
// 網址：?place=tw（預設臺南車站）、?place=tw&id=<地景資料庫 id>、?place=tw&ll=緯度,經度&d=距離&hd=方位&pt=俯角
import { mountScenePanel, showLoadError } from '../shared/scene-panel.js';
import { setupModuleFrame } from '../shared/platform-frame.js';
import { SOURCES } from './sources.js';
const el = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const q = new URLSearchParams(location.search);
let place = null;
try {
  const reg = await fetch(new URL('data/scene-registry.json', document.baseURI)).then(r => r.json());
  place = reg.scenes.find(s => s.id === (q.get('id') || (q.has('ll') ? '' : 'tainan-station'))) || null;
} catch { }
if (!place || !Number.isFinite(place.lat)) place = { id: null, name: q.get('name')?.slice(0, 24) || '', lat: 22.9971, lng: 120.2126 };
document.body.classList.add('osm-platform', 'world-platform');

const canvas = setupModuleFrame({ key: 'tw', heading: '全臺立體地景', cityEn: 'TAIWAN · 3D TERRAIN & CITY', english: 'TAIWAN IN 3D', canvasLabel: '全臺立體地景：拖曳旋轉、右鍵平移、滾輪縮放，鏡頭移到哪裡就載入哪裡' });
const panel = mountScenePanel({ title: '全臺立體地景', en: 'TAIWAN IN 3D' });
el('loading').hidden = false; el('loading').textContent = '載入全臺地形與街道圖磚…';
let api;
try {
  const { createWorld } = await import('./main.js');
  api = await createWorld(canvas, panel.ui, place);
} catch (err) { showLoadError('全臺立體地景', err); throw err; }
window.world = api;
panel.bind(api);
el('loading').hidden = true;
el('sourceBtn').onclick = () => openDialog('TAIWAN IN 3D', '全臺立體地景：資料來源', `<div class="prose">
<p>道路、建物外框與樓高、水域、土地覆蓋、地名：© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>（ODbL），經 <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> 架構切片、由 <a href="${SOURCES.vector.home}" target="_blank" rel="noreferrer">OpenFreeMap</a> 免費提供。</p>
<p>地形：<a href="${SOURCES.terrain.home}" target="_blank" rel="noreferrer">${esc(SOURCES.terrain.name)}</a>，${esc(SOURCES.terrain.attribution)}。</p>
<p>建物高度：有 OSM 高度或樓層者照用，其餘依面積與街區密度推估（可在「片場參數」重擲）。立面窗格、樹木為程序化示意，不代表實景。</p>
<p>全臺圖磚依鏡頭位置載入：遠處用粗的地形圖磚，近處（約 2–4 公里）切到最細並長出立體建物。歷史年代與故事會疊在這層現代底稿上。</p></div>`);
el('help').onclick = () => openDialog('CAMERA', '全臺立體地景操作', '<div class="prose"><p>拖曳旋轉、右鍵（或兩指）平移、滾輪往游標方向縮放。鏡位「全臺俯瞰」看整座島，從景點目錄或全臺地圖可以直接飛到任一處。「漫步」以人眼高度貼地行走。右側「片場參數」可調地形起伏、推估樓高、路寬與遠近細緻度；複製場景網址會記住位置、鏡頭與所有參數。</p></div>');
