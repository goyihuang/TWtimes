// 全臺立體地景：圖磚座標、LOD 選擇、建物高度推估（純函式）
import assert from 'node:assert/strict';
import { makeFrame, selectTiles, rootTiles, lngLatToTile, covers, terrarium, tileSize } from '../src/world/tiles.js';
import { buildingHeight, estimateFloors, hash01, UNKNOWN_H } from '../src/world/heights.js';

const f = makeFrame(22.9971, 120.2126);
// 原點換算回經緯度
const [x, z] = f.toWorld(121.5170, 25.0478), [lng, lat] = f.toLngLat(x, z);
assert.ok(Math.abs(lng - 121.517) < 1e-9 && Math.abs(lat - 25.0478) < 1e-9);
// 臺南 → 臺北：北方是 -z，大圓距離約 262 km（Mercator × cos 原點緯度，誤差約 2%）
assert.ok(z < 0 && Math.hypot(x, z) > 256000 && Math.hypot(x, z) < 270000, `臺南臺北距離 ${Math.hypot(x, z)}`);
// 臺南車站所在 z14 圖磚
assert.deepEqual(lngLatToTile(120.2126, 22.9971, 14), [13663, 7116]);
// 根圖磚涵蓋本島與離島
const roots = rootTiles();
for (const [lo, la] of [[121.52, 25.05], [120.21, 23.0], [118.32, 24.44], [119.95, 26.16], [121.55, 22.04], [119.58, 23.57]]) {
  const [tx, ty] = lngLatToTile(lo, la, 8); assert.ok(roots.some(([, a, b]) => a === tx && b === ty), `根圖磚沒涵蓋 ${lo},${la}`);
}
// LOD：近處切到 z14、不重疊、高空只剩根圖磚
const near = selectTiles(f, [0, 700, 700]);
assert.ok(near.some(t => t[0] === 14) && near.length < 200, `近景圖磚數 ${near.length}`);
for (let i = 0; i < near.length; i++) for (let j = 0; j < near.length; j++) if (i !== j) assert.ok(!covers(near[i], near[j]), '圖磚重疊');
assert.equal(selectTiles(f, [0, 520000, 300000]).every(t => t[0] === 8), true);
// 面積總和 = 根圖磚面積（完整覆蓋）
const area = l => l.reduce((s, [zz]) => s + tileSize(zz) ** 2, 0);
assert.ok(Math.abs(area(near) - area(roots)) / area(roots) < 1e-9);
// Terrarium 解碼
assert.equal(terrarium(128, 0, 0), 0); assert.equal(terrarium(143, 112, 0), 3952); // 玉山

// 建物高度：OSM 有高度就照用；5 m 預設值視為未知
assert.deepEqual(buildingHeight({ render_height: 42, render_min_height: 0 }, 300, 0.3, 0.5), { h: 42, y0: 0, guessed: false });
assert.equal(buildingHeight({ render_height: UNKNOWN_H, render_min_height: 0 }, 300, 0.3, 0.5).guessed, true);
assert.deepEqual(buildingHeight({ render_height: 30, render_min_height: 10 }, 300, 0.3, 0.5), { h: 20, y0: 10, guessed: false });
// 市區比鄉間高、同一個亂數結果固定
assert.ok(estimateFloors(400, 0.3, 0.99) > estimateFloors(400, 0.02, 0.99));
assert.ok(estimateFloors(100, 0.3, 0) >= 3 && estimateFloors(100, 0.3, 0.999) <= 5);
assert.equal(hash01(123.4, 567.8, 1), hash01(123.4, 567.8, 1)); assert.notEqual(hash01(123.4, 567.8, 1), hash01(123.4, 567.8, 2));
console.log('world-tiles: ok');
