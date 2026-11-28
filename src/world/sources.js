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

// 圖磚快取（tile-worker.js 寫入，保存 7 天）：每次開啟全臺地景時清掉過期與超過上限的項目。
// Cache Storage 的 keys() 依寫入順序排列，超過上限時刪最早寫入的。
export const TILE_CACHE = 'twtimes-tiles-v1', TILE_TTL = 7 * 864e5, TILE_CACHE_MAX = 3000;
export async function pruneTileCache(max = TILE_CACHE_MAX) {
  if (!globalThis.caches) return 0;
  try {
    const c = await caches.open(TILE_CACHE), keys = await c.keys(); let n = 0;
    const over = Math.max(0, keys.length - max);
    for (let i = 0; i < keys.length; i++) {
      if (i < over) { await c.delete(keys[i]); n++; continue; }
      if (i % 25) continue; // 抽查過期：寫入順序即時間順序，找到第一個未過期就停
      const r = await c.match(keys[i]); if (r && Date.now() - +(r.headers.get('x-tw-t') || 0) < TILE_TTL) break;
      for (let k = Math.max(over, i - 24); k <= i; k++) { await c.delete(keys[k]); n++; }
    }
    return n;
  } catch { return 0; }
}
