// 全臺立體地景的資料來源。換成自架圖磚（例如部署時切好的 PMTiles／XYZ）只要改這裡。
export const SOURCES = {
  vector: {
    name: 'OpenFreeMap',
    // TileJSON：裡面的 tiles 網址帶版本日期（每週更新），所以先讀 TileJSON 再組網址
    tilejson: 'https://tiles.openfreemap.org/planet',
    maxzoom: 14,
    attribution: '© OpenMapTiles © OpenStreetMap contributors',
    license: 'ODbL（OpenStreetMap）＋ CC-BY 4.0（OpenMapTiles 架構）',
    home: 'https://openfreemap.org/',
  },
  terrain: {
    name: 'AWS Terrain Tiles（Mapzen）',
    url: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
    maxzoom: 15,
    attribution: 'Terrain Tiles：Mapzen、AWS Open Data；含 SRTM（NASA）、GMTED2010（USGS）、ETOPO1（NOAA）等',
    home: 'https://registry.opendata.aws/terrain-tiles/',
  },
};

const KEY = 'twtimes-vector-tiles';
export async function resolveVector() {
  if (globalThis.TW_VECTOR_URL) return globalThis.TW_VECTOR_URL;
  try {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
    const tj = await fetch(SOURCES.vector.tilejson, { signal: ctl.signal }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    clearTimeout(timer);
    const url = tj.tiles?.[0]; if (!url) throw new Error('TileJSON 沒有 tiles');
    try { localStorage.setItem(KEY, url); } catch { }
    return url;
  } catch (e) {
    const last = (() => { try { return localStorage.getItem(KEY); } catch { return null; } })();
    if (last) return last;
    throw e;
  }
}
