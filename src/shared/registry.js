// 地景資料庫的共用工具（純函式，Node 可直接測試）。
// 景點切換選單、首頁與全臺地圖都從 public/data/scene-registry.json 讀資料：新增景點只要加一筆。

// 縣市所屬區域（依國發會區域劃分；離島另列）
export const REGIONS = [
  { id: 'north', label: '北部', cities: ['基隆市', '臺北市', '新北市', '桃園市', '新竹市', '新竹縣', '宜蘭縣'] },
  { id: 'central', label: '中部', cities: ['苗栗縣', '臺中市', '彰化縣', '南投縣', '雲林縣'] },
  { id: 'south', label: '南部', cities: ['嘉義市', '嘉義縣', '臺南市', '高雄市', '屏東縣'] },
  { id: 'east', label: '東部', cities: ['花蓮縣', '臺東縣'] },
  { id: 'islands', label: '離島', cities: ['澎湖縣', '金門縣', '連江縣'] },
];
export const regionOf = city => REGIONS.find(r => r.cities.includes(String(city || '').replace(/^台/, '臺')))?.id || 'north';

// 景點的呈現方式：3D 今昔（已上線）／現代街景（有座標，可用 OSM 自動生成）／僅圖文（座標待查）
export function modeOf(s) {
  if (s.status === 'live' && s.entry) return 'history3d';
  if (Number.isFinite(s.lat) && Number.isFinite(s.lng)) return 'modern';
  return 'card';
}
export const MODE_LABEL = { history3d: '3D 今昔', modern: '現代街景', card: '僅圖文' };

// entry「./?place=station」→ station
export function placeKey(s) {
  if (!s?.entry) return null;
  try { return new URL(s.entry, 'https://x/').searchParams.get('place'); } catch { return null; }
}

// 進入景點的網址：已上線走原本的 3D 場景；其餘有座標的走 OSM 現代街景
export function sceneHref(s) {
  const m = modeOf(s);
  if (m === 'history3d') return s.entry;
  if (m === 'modern') return './?place=osm&id=' + encodeURIComponent(s.id);
  return './map.html#sel=' + encodeURIComponent(s.id) + '&mode=atlas';
}

// 依目前網址找出對應的景點
export function currentScene(scenes, search) {
  const q = new URLSearchParams(search);
  const place = q.get('place');
  if (place === 'osm') return scenes.find(s => s.id === q.get('id')) || null;
  return scenes.find(s => placeKey(s) === place) || null;
}

// 北到南排序（同區內依緯度），讓「上一個／下一個」符合地理直覺
export function geoOrder(scenes) {
  const ri = id => REGIONS.findIndex(r => r.id === id);
  return [...scenes].sort((a, b) => ri(regionOf(a.city)) - ri(regionOf(b.city)) || (b.lat ?? 0) - (a.lat ?? 0));
}

// 經緯度投影到 SVG 小地圖（臺灣本島＋離島，等距圓柱，緯度 23.5° 修正）
export const MINI = { w: 260, h: 360, lng0: 119.2, lng1: 122.1, lat0: 21.85, lat1: 25.35 };
export function project(lng, lat) {
  const k = Math.cos(23.5 * Math.PI / 180);
  const sx = MINI.w / ((MINI.lng1 - MINI.lng0) * k), sy = MINI.h / (MINI.lat1 - MINI.lat0), s = Math.min(sx, sy);
  return [(lng - MINI.lng0) * k * s, (MINI.lat1 - lat) * s];
}
