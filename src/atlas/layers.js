// 底圖與中研院歷史圖層設定。
// 中研院「臺灣百年歷史地圖」圖磚以 CC BY-NC（姓名標示－非商業性使用）釋出；
// 商業使用須另向中研院智財技轉處洽談授權（https://ticket.apps.sinica.edu.tw/tech/20T-1100319）。
// 圖磚網址依 https://gis.sinica.edu.tw/tileserver/wmts 的 GetCapabilities（TileMatrixSet：GoogleMapsCompatible）。

export const BASEMAPS = [
  {
    id: 'emap', label: '臺灣通用電子地圖',
    url: 'https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}',
    attribution: '底圖 © <a href="https://maps.nlsc.gov.tw/" target="_blank" rel="noreferrer">內政部國土測繪中心</a>（政府資料開放授權）',
    maxNativeZoom: 19,
  },
  {
    id: 'osm', label: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '底圖 © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> 貢獻者',
    maxNativeZoom: 19,
  },
  { id: 'none', label: '僅縣市輪廓（離線）', url: null, attribution: '' },
];

const SINICA = id => `https://gis.sinica.edu.tw/tileserver/file-exists.php?img=${id}-{z}-{x}-{y}`;
export const HISTORY_ATTRIBUTION = '歷史圖層 © <a href="https://gissrv4.sinica.edu.tw/gis/twhgis/" target="_blank" rel="noreferrer">中央研究院 臺灣百年歷史地圖</a>（CC BY-NC）';

// period 對應 scene-registry 的 taxonomy.periods
// maxNativeZoom：2026-11-28 在使用者瀏覽器實測臺南、臺中、臺北三處圖磚，取仍有實際內容的最高層級，更高層級由 Leaflet 放大。
export const HISTORY_LAYERS = [
  { id: 'JM200K_1897', year: 1897, period: 'japanese', label: '1897 臺灣假製二十萬分一圖', maxNativeZoom: 15, url: SINICA('JM200K_1897_new-png') },
  { id: 'JM20K_1904', year: 1904, period: 'japanese', label: '1904 臺灣堡圖（明治版）', maxNativeZoom: 16, url: SINICA('JM20K_1904-jpg') },
  { id: 'JM20K_1921', year: 1921, period: 'japanese', label: '1921 臺灣堡圖（大正版）', maxNativeZoom: 16, note: '部分地區（如臺南市區）缺 z13 以上圖磚', url: SINICA('JM20K_1921-jpg') },
  { id: 'JM25K_1921', year: 1921, period: 'japanese', label: '1921 二萬五千分一地形圖', maxNativeZoom: 16, url: SINICA('JM25K_1921-png') },
  { id: 'JM50K_1924', year: 1924, period: 'japanese', label: '1924 五萬分一地形圖', maxNativeZoom: 15, url: SINICA('JM50K_1924-jpg') },
  { id: 'JM300K_1934', year: 1934, period: 'japanese', label: '1934 臺灣全圖（第三版）', maxNativeZoom: 12, url: SINICA('JM300K_1934-jpg') },
  { id: 'AM50K_1944', year: 1944, period: 'japanese', label: '1944 美軍五萬分一地形圖', maxNativeZoom: 16, url: SINICA('AM50K_1944-png') },
  { id: 'AMCityPlan_1945', year: 1945, period: 'japanese', label: '1945 美軍城市地圖', maxNativeZoom: 17, note: '只涵蓋主要城市，請放大到市區', url: SINICA('AMCityPlan_1945-png') },
  { id: '1956_Landuse', year: 1956, period: 'postwar', label: '1956 土地利用及林型圖', maxNativeZoom: 15, url: SINICA('1956_Landuse-png') },
];
