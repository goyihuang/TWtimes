// 獨立引擎場景（臺南、圓山）接到首頁共用框架：城市列、取景地點、街景索引、主畫布。
// 首頁原有場景（臺中、彰化、臺北、高雄）由 public/app.js 自己畫這些元素。
const el = id => document.getElementById(id);

// 全站街景目錄：城市列與街景索引共用。key 即 ?place= 的值。
export const CATALOG = [
  { key: 'station', city: 'taichung', name: '臺中車站與站前廣場', en: 'TAICHŪ STATION', thumb: 'archive-station.jpg' },
  { key: 'river', city: 'taichung', name: '綠川河岸', en: 'GREEN RIVER', thumb: 'archive-river.jpg' },
  { key: 'market', city: 'taichung', name: '第一市場街區', en: 'FIRST MARKET', thumb: 'archive-market.jpg' },
  { key: 'changhua', city: 'changhua', name: '彰化車站與站前廣場', en: 'CHANGHUA STATION', thumb: 'archive-changhua.jpg' },
  { key: 'roundhouse', city: 'changhua', name: '彰化扇形車庫', en: 'CHANGHUA ROUNDHOUSE', thumb: 'scene-roundhouse.jpg' },
  { key: 'taipei', city: 'taipei', name: '臺北車站與館前路口', en: 'TAIPEI MAIN STATION', thumb: 'scene-taipei.jpg' },
  { key: 'yuanshan', city: 'taipei', name: '圓山・劍潭', en: 'MARUYAMA · KENTAN', thumb: 'thumbs/yuanshan.jpg' },
  { key: 'tainan', city: 'tainan', name: '臺南車站與站前廣場', en: 'TAINAN STATION', thumb: 'thumbs/tainan-station.jpg' },
  { key: 'anping', city: 'tainan', name: '安平古堡・熱蘭遮城', en: 'FORT ZEELANDIA', thumb: 'thumbs/anping.jpg' },
  { key: 'kaohsiung', city: 'kaohsiung', name: '高雄車站與站前廣場', en: 'KAOHSIUNG STATION', thumb: 'scene-kaohsiung.jpg' },
];
const CITY_FIRST = { taichung: 'station', changhua: 'changhua', taipei: 'taipei', tainan: 'tainan', kaohsiung: 'kaohsiung' };

export const placeButton = (p, active) => `<button class="place ${active ? 'active' : ''}" aria-pressed="${active}" data-key="${p.key}"><span class="place-thumb" style="background-image:url(${p.thumb})"></span><span><strong>${p.name}</strong><small>${p.en}</small></span><span class="goto">${active ? '●' : '›'}</span></button>`;

export function setupModuleFrame({ key, heading, cityEn, english, canvasLabel }) {
  const me = CATALOG.find(p => p.key === key) || { key, city: null };
  document.body.classList.add('module-platform');
  el('stage').innerHTML = `<canvas id="scene" aria-label="${canvasLabel}"></canvas>`;
  el('cityHeading').textContent = heading; el('cityEn').textContent = cityEn; el('viewEnglish').textContent = english;
  for (const city of Object.keys(CITY_FIRST)) {
    const b = el(city + 'City'); if (!b) continue;
    b.setAttribute('aria-pressed', String(city === me.city));
    b.onclick = () => { if (CITY_FIRST[city] !== key) location.assign('?place=' + CITY_FIRST[city]); };
  }
  const dest = el('destination'); dest.value = key;
  dest.onchange = e => { const v = e.target.value; const p = /^\d+$/.test(v) ? null : v; location.assign('?place=' + (p || ['station', 'river', 'market', 'changhua', 'roundhouse', 'taipei', 'kaohsiung'][+v])); };
  const places = CATALOG.filter(p => p.city === me.city);
  el('places').innerHTML = places.map(p => placeButton(p, p.key === key)).join('');
  el('places').querySelectorAll('button').forEach(b => b.onclick = () => { if (b.dataset.key !== key) location.assign('?place=' + b.dataset.key); });
  // 首頁原本的環繞／步行按鈕交給共用面板接手
  return el('scene');
}
