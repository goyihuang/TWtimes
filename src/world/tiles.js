// 全臺立體地景：圖磚座標與 LOD（純函式，Node 可測試）。
// 世界座標：Web Mercator 公尺 × cos(原點緯度)，x 向東、z 向南（three.js 慣例，-z 為北），y 為海拔（公尺）。
export const C = 40075016.686;            // 赤道周長（Web Mercator 的世界寬度，公尺）
export const TAIWAN = { w: 118.1, s: 21.75, e: 122.2, n: 26.45 }; // 含金門、馬祖、澎湖、蘭嶼
export const ROOT_Z = 8, MAX_Z = 14;
export const FACTOR = { near: 0.5, far: 0.8 }; // 切細門檻：離圖磚距離 < 邊長 × 倍率

export const merc = (lng, lat) => {
  const s = Math.sin(lat * Math.PI / 180);
  return [(lng + 180) / 360 * C, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * C];
};
export const unmerc = (mx, my) => [mx / C * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * my / C))) * 180 / Math.PI];
export const tileSize = z => C / 2 ** z;   // 圖磚邊長（Mercator 公尺）
export const tileKey = (z, x, y) => `${z}/${x}/${y}`;
export const parseKey = k => k.split('/').map(Number);

// 以某個經緯度為原點的世界座標換算
export function makeFrame(lat0, lng0) {
  const [mx0, my0] = merc(lng0, lat0), k = Math.cos(lat0 * Math.PI / 180);
  return {
    lat0, lng0, mx0, my0, k,
    toWorld: (lng, lat) => { const [mx, my] = merc(lng, lat); return [(mx - mx0) * k, (my - my0) * k]; },
    toLngLat: (x, z) => unmerc(x / k + mx0, z / k + my0),
    // 圖磚西北角的世界座標、邊長（世界公尺）
    tileOrigin: (z, x, y) => { const S = tileSize(z); return [(x * S - mx0) * k, (y * S - my0) * k, S * k]; },
  };
}

export function lngLatToTile(lng, lat, z) {
  const [mx, my] = merc(lng, lat), S = tileSize(z);
  return [Math.floor(mx / S), Math.floor(my / S)];
}

// 涵蓋臺灣的根圖磚（z8）
export function rootTiles(b = TAIWAN, z = ROOT_Z) {
  const [x0, y0] = lngLatToTile(b.w, b.n, z), [x1, y1] = lngLatToTile(b.e, b.s, z), out = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push([z, x, y]);
  return out;
}

// 四分樹選圖磚：鏡頭離圖磚越近切得越細。
// cam：世界座標 [x, y, z]（y 為離地高度＋地面海拔皆可，這裡只用來算距離）
// detail：細緻倍率（1 = 預設；越大越遠的地方也切細）
// 回傳不重疊、完整覆蓋根圖磚的圖磚清單
export function selectTiles(frame, cam, { detail = 1, maxZ = MAX_Z, roots = rootTiles(), groundY = 0 } = {}) {
  const out = [];
  const split = (z, x, y) => {
    if (z >= maxZ) return false;
    const [ox, oz, S] = frame.tileOrigin(z, x, y);
    const dx = Math.max(ox - cam[0], 0, cam[0] - (ox + S)), dz = Math.max(oz - cam[2], 0, cam[2] - (oz + S));
    const dy = Math.max(0, cam[1] - groundY);
    const d = Math.hypot(dx, dz, dy);
    // 建物圖磚（z14）較重，門檻較嚴；其他層級 2 倍邊長內就切細
    const f = (z + 1 >= maxZ ? FACTOR.near : FACTOR.far) * detail;
    return d < S * f;
  };
  const walk = (z, x, y) => {
    if (split(z, x, y)) for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) walk(z + 1, x * 2 + cx, y * 2 + cy);
    else out.push([z, x, y]);
  };
  for (const [z, x, y] of roots) walk(z, x, y);
  return out;
}

// a 是否為 b 的祖先（或相同）
export function covers([za, xa, ya], [zb, xb, yb]) {
  if (za > zb) return false;
  const s = 2 ** (zb - za);
  return Math.floor(xb / s) === xa && Math.floor(yb / s) === ya;
}
export const parentOf = ([z, x, y]) => [z - 1, x >> 1, y >> 1];

// 地形編碼：Terrarium PNG（AWS Terrain Tiles）
export const terrarium = (r, g, b) => r * 256 + g + b / 256 - 32768;
