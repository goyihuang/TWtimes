// 首頁原有場景（臺中三處、彰化兩處、臺北五代、高雄）接上共用場景面板。
// 引擎仍是 public/app.js；這裡只把它的狀態轉成與臺南相同的場景 API（docs/scene-contract.md）。
import { mountScenePanel } from './scene-panel.js';
import { CATALOG, placeButton } from './platform-frame.js';

const SA = () => window.streetAtlas;

// 每個地點兩個年代的說明與重建依據。可信度：A 照片或官方文字直接佐證、B 依照片比例推估、C 示意。
const DATA = {
  station: {
    past: { name: '臺中驛', story: '1917 年落成的紅磚站房，正面整排門廊、中央山牆高窗與屋脊小塔，站前是人力車往來的廣場。', evidence: [['站房立面、門廊、山牆與小塔', 'A', '約 1931 年〈臺中驛前的人力車〉，國家文化記憶庫，PDM'], ['站房外框與方位', 'A', 'OpenStreetMap 建物外框'], ['屋架斷面、樓高', 'B', '照片比例推估'], ['騎樓街屋、商號', 'C', '示意；部分表面細節依 AI 概念圖詮釋']] },
    now: { name: '臺中車站', story: '2016 年高架新站啟用，大跨距鋼棚伸向廣場；紅磚舊站保留在原址，可比較兩個屋頂的方向與廣場開口。', evidence: [['高架站外形與位置', 'A', '2024 年現地照片（Wikimedia Commons）、鐵道局工程資料、OSM'], ['月臺、軌道與廣場', 'A', '現況圖資對位'], ['屋架斷面', 'B', '照片推估'], ['行人與車輛', 'C', '示意']] },
  },
  river: {
    past: { name: '綠川・新盛橋', story: '兩排柳樹向水面傾垂，卵石護岸與小橋把兩岸街屋連在一起。', evidence: [['河道、柳樹與護岸', 'A', '《臺中綠川》明信片，國立臺灣歷史博物館，PDM'], ['橋的位置', 'B', '館藏未標定拍攝橋位，依路網推定'], ['沿岸街屋', 'C', '示意，沿用現代路網']] },
    now: { name: '綠川・中山綠橋', story: '整治後的綠川水岸與宮原眼科轉角。', evidence: [['河道與建物位置', 'A', 'OpenStreetMap'], ['建物高度', 'B', 'OSM 樓層或估算']] },
  },
  market: {
    past: { name: '第一市場', story: '牛車走過櫻橋，遠處是第一市場的斜屋頂和入口山牆；櫻橋通即今臺灣大道一段。', evidence: [['市場屋頂與入口山牆', 'A', '〈臺中市第一市場〉，國家文化記憶庫，PDM'], ['市場平面', 'B', '依現代街廓推定'], ['周邊街屋', 'C', '示意']] },
    now: { name: '東協廣場', story: '市場街廓後來建起第一廣場，今稱東協廣場。', evidence: [['建物位置與高度', 'A', 'OpenStreetMap（缺高度者估算）']] },
  },
  changhua: {
    past: { name: '彰化驛', story: '木造站房中央的唐破風雨庇向前伸出，兩側屋簷下可見旅客與人力車。', evidence: [['站房外觀', 'A', '《彰化火車站》，國立臺灣歷史博物館，PDM'], ['站房尺寸', 'B', '照片比例推估'], ['周邊街屋', 'C', '示意']] },
    now: { name: '彰化車站', story: '2021 年整修後的玻璃正面與連續弧形雨棚。', evidence: [['站房外觀', 'A', '國家文化記憶庫 1935／2021 對照'], ['位置與軌道', 'A', 'OpenStreetMap']] },
  },
  roundhouse: {
    past: { name: '彰化機關庫', story: '1933 年擴建後的十二股扇形車庫，站在轉車臺前可逐一找到庫門。', evidence: [['車庫與轉車臺格局', 'A', '國定古蹟紀錄、OSM 軌道'], ['機車種類與停放位置', 'C', '情境示意']] },
    now: { name: '彰化扇形車庫', story: '臺灣仍在使用的扇形車庫，可比較觀景臺與柴電機車。', evidence: [['格局', 'A', 'OSM、2007 年現地照片（Wikimedia Commons）'], ['機車與人物', 'C', '示意']] },
  },
  kaohsiung: {
    past: { name: '高雄驛', story: '1941 年帝冠式站房，正面時鐘在屋頂下方，寬雨庇通往候車大廳；月臺與鐵軌都在地面。', evidence: [['站房外觀', 'A', '1941、1948 年站前照片（高雄市政府新舊站對照）'], ['屋高、月臺配置', 'B', '影像推估'], ['周邊街屋', 'C', '示意']] },
    now: { name: '高雄車站', story: '老站房坐落南側入口，後方是綠色天棚和商辦、旅館兩棟大樓。', evidence: [['天棚、雙塔與保留站房位置', 'A', '現代圖資'], ['屋高', 'B', '影像推估']] },
  },
};

function eras() {
  const s = SA(), key = s.place.key;
  if (s.isTaipei) return window.TAIPEI_GENERATIONS.map((r, i) => ({
    id: String(i + 1), year: r.year, name: r.short, story: r.note,
    evidence: [['站房外觀', i === 3 ? 'B' : 'A', r.reference], ['站址', i === 0 || i === 3 ? 'B' : 'A', i === 0 || i === 3 ? '概略定位' : 'OpenStreetMap 與館前路軸線'], ['周邊街屋、人物', 'C', '示意']],
  }));
  const d = DATA[key];
  return [{ id: 'past', year: s.pastYear() + ' 年代', ...d.past }, { id: 'now', year: '當代', ...d.now }];
}

const panel = mountScenePanel({ title: '', en: '' });
let boundKey = null;
const api = {
  keepCaption: true, frameButtons: false,
  get state() { const s = SA(); return { era: s.isTaipei ? (s.modern ? 4 : s.tpPast - 1) : (s.modern ? 1 : 0), shot: s.shot, mm: s.mm, walk: s.walking, hour: s.hour, weather: s.weather }; },
  weathers: { clear: '晴天', cloudy: '多雲', rain: '雨天', fog: '霧' },
  setHour: h => SA().setHour(h), setWeather: w => SA().setWeather(w),
  setEra(i) { const s = SA(); if (s.isTaipei) s.setGeneration(i + 1); else if (i) s.setNow(); else s.setPast(); },
  setShot: i => SA().setShot(i), setFocal: mm => SA().setFocal(mm), toggleWalk: () => SA().toggleWalk(), zoom: f => SA().zoom(f),
  compare: () => SA().compare(), snapshot: () => SA().snapshot(), shareURL: () => SA().shareURL(),
};

function refresh() {
  const s = SA(); if (!s?.ready) return;
  // 臺北的街景索引加上圓山
  if (s.city === 'taipei' && !document.querySelector('#places [data-key=yuanshan]')) {
    document.getElementById('places').insertAdjacentHTML('beforeend', placeButton(CATALOG.find(p => p.key === 'yuanshan'), false));
    document.querySelector('#places [data-key=yuanshan]').onclick = () => location.assign('?place=yuanshan');
  }
  const key = s.place.key;
  if (key !== boundKey) {
    boundKey = key; api.eras = eras(); api.shots = s.shots();
    api.extraLinks = key === 'taipei' ? [{ label: '五代站房影像對照', href: 'taipei.html' }] : [];
    panel.bind(api);
  } else { panel.sync(); panel.ui.onHour(s.hour); panel.ui.onWeather(s.weather); }
}
addEventListener('atlas-change', refresh);
refresh();
