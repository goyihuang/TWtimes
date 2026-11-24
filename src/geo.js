// 經緯度 ↔ 場景座標（公尺）。原點設在臺中驛（舊站）前，x 向東、z 向南、y 向上。
export const ORIGIN = { lon: 120.68526, lat: 24.13691 };
const M_PER_DEG_LAT = 110574;
const M_PER_DEG_LON = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);

export function lonLatToXZ(lon, lat) {
  return [(lon - ORIGIN.lon) * M_PER_DEG_LON, -(lat - ORIGIN.lat) * M_PER_DEG_LAT];
}
export function xzToLonLat(x, z) {
  return [ORIGIN.lon + x / M_PER_DEG_LON, ORIGIN.lat - z / M_PER_DEG_LAT];
}

// 多邊形工具
export function polygonArea(pts) {
  // 標準鞋帶公式：正值代表在 (x, z) 平面上為逆時針
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  return a / 2;
}
export function centroid(pts) {
  let x = 0, z = 0;
  for (const p of pts) { x += p[0]; z += p[1]; }
  return [x / pts.length, z / pts.length];
}
export function pointInPolygon(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
// 穩定的偽亂數（同一棟建物每次載入都長得一樣）
export function hash01(n, salt = 0) {
  let h = (n ^ (salt * 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
