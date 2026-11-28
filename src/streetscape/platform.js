// 現代街景（OSM 自動生成）接到首頁共用框架與共用場景面板。
// 網址：?place=osm&id=<101 清單或地景資料庫 id>，或 ?place=osm&lat=&lng=&name=（地圖上任意點）
import { mountScenePanel, showLoadError } from '../shared/scene-panel.js';
import { setupModuleFrame } from '../shared/platform-frame.js';
import { findPlaceById } from '../shared/places.js';
const el = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const q = new URLSearchParams(location.search);
// id 先找全臺 101 處清單，再找今昔地景資料庫（src/shared/places.js）
let place = await findPlaceById(q.get('id'));
const lat = Number(q.get('lat')), lng = Number(q.get('lng'));
if (!place && Number.isFinite(lat) && Number.isFinite(lng) && lat > 21.5 && lat < 26.6 && lng > 118 && lng < 122.5) place = { id: null, name: (q.get('name') || '').slice(0, 24) || '自選地點', city: '', lat, lng };
document.body.classList.add('osm-platform');

const name = place?.name || '現代街景';
const canvas = setupModuleFrame({ key: 'osm', heading: name, cityEn: place?.city ? `${place.city} · TAIWAN` : `${(lat || 0).toFixed(3)}° N · ${(lng || 0).toFixed(3)}° E`, english: (place?.nameEn || 'MODERN STREETSCAPE').toUpperCase(), canvasLabel: `${name} 現代街景（依 OpenStreetMap 自動生成）：拖曳旋轉、右鍵平移、滾輪縮放` });
const panel = mountScenePanel({ title: name, en: 'MODERN STREETSCAPE' });
el('loading').hidden = false; el('loading').textContent = `${name}　依 OpenStreetMap 生成現代街景中…`;
if (!place || !Number.isFinite(place.lat)) {
  showLoadError('現代街景', new Error(place ? '這個景點的座標尚未查證' : '找不到這個景點，請從景點目錄重新選擇'));
} else {
  let api;
  try {
    const { createStreetscape } = await import('./main.js');
    api = await createStreetscape(canvas, panel.ui, place);
  } catch (err) { showLoadError(name + '現代街景', err); throw err; }
  window.streetscape = api;
  panel.bind(api);
  const mapHref = place.id ? `./map.html#sel=${encodeURIComponent(place.id)}` : `./map.html#v=${place.lat.toFixed(4)},${place.lng.toFixed(4)},17.00`;
  el('sourceBtn').onclick = () => openDialog('MODERN STREETSCAPE', `${esc(name)}：資料來源`, `<div class="prose"><p>道路、建物外框、鐵道、水域與綠地：© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>（ODbL），${esc(api.data.how)}${api.data.fetched ? '，資料日期 ' + esc(api.data.fetched) : ''}。</p><p>建物高度：有 OSM 高度或樓層者照用，其餘依用途與面積推估；立面窗格、店面招牌、鐵窗、頂樓水塔、行道樹與路燈為程序化示意，不代表實景。</p><p>這是現代底稿：之後依 <code>docs/source-cards.md</code> 整理史料，再把歷史年代加進同一個座標。</p><p><a href="${mapHref}">在全臺地圖上查看這裡 ↗</a></p></div>`);
  el('help').onclick = () => openDialog('CAMERA', '現代街景操作', '<div class="prose"><p>拖曳旋轉、右鍵平移、滾輪縮放；「漫步」以人眼高度走在街上。右側「片場參數」可調推估樓高、路寬與範圍，「白模檢視」方便看量體，「匯出 GLB」可把街廓帶進 Blender 搭景。複製場景網址會記住所有參數與鏡頭。</p></div>');
}
