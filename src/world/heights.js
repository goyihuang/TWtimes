// 建物高度（純函式，Node 可測試）。
// OpenMapTiles 的 building 圖層只留 render_height／render_min_height：有 OSM height 或 building:levels 才是實際值，
// 兩者都沒有時預設 5 公尺（planetiler-openmaptiles 的作法）。臺灣大多數建物沒標樓層，所以 5 公尺視為「未知」，
// 依面積與街區密度推估，並用位置雜湊決定樓層（同一棟每次載入都一樣；換種子可重擲）。
export const FLOOR = 3.3;
export const UNKNOWN_H = 5;

// 由座標得到 0–1 的穩定亂數
export function hash01(x, y, seed = 1) {
  let h = Math.imul((Math.round(x * 10) | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((Math.round(y * 10) | 0) + seed * 0x27d4eb2f, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

// density：同一張 z14 圖磚的建物覆蓋率（0–1），用來分辨市區與鄉間
export function estimateFloors(area, density, r) {
  const urban = density > 0.22 ? 2 : density > 0.1 ? 1 : 0;
  let [a, b] =
    area < 40 ? [1, 2] :
    area < 160 ? [[2, 3], [3, 4], [3, 5]][urban] :     // 透天厝、街屋
    area < 600 ? [[2, 4], [4, 7], [5, 9]][urban] :     // 公寓、小型大樓
    area < 2500 ? [[2, 5], [5, 12], [7, 16]][urban] :  // 大樓、學校
    [[1, 3], [2, 6], [3, 10]][urban];                  // 工廠、倉庫、商場
  return a + Math.floor(r * (b - a + 1));
}

// props：{ render_height, render_min_height, hide_3d }，回傳 { h, y0, guessed }（公尺）
export function buildingHeight(props, area, density, r, scale = 1) {
  const rh = Number(props.render_height), rm = Number(props.render_min_height) || 0;
  const known = Number.isFinite(rh) && rh > 0 && !(rh === UNKNOWN_H && rm === 0);
  if (known) return { h: Math.max(2.5, rh - rm), y0: rm, guessed: false };
  return { h: estimateFloors(area, density, r) * FLOOR * scale + 0.6, y0: 0, guessed: true };
}
