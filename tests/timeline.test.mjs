// 時間軸拖曳：era-grow 的 scrub／settle（倒退收尾留下舊年代、往前收尾留下新年代）
import * as T from 'three';
import assert from 'node:assert/strict';
import { createEraGrow, eraScrubber } from '../src/shared/era-grow.js';
const mk = () => { const g = new T.Group(); g.add(new T.Mesh(new T.BoxGeometry(1, 5, 1), new T.MeshStandardMaterial())); g.add(new T.LineSegments(new T.BufferGeometry(), new T.LineBasicMaterial())); return g; };
const A = mk(), B = mk(); B.visible = false;
const grow = createEraGrow(T);
grow.scrub(A, B, { x: 0, y: 0, z: 0 }, 0.3, { seconds: 1 });
assert.equal(grow.active, true); assert.equal(+grow.progress.toFixed(2), 0.3);
grow.update(0.5); assert.equal(+grow.progress.toFixed(2), 0.3, '拖曳中不會自己前進');
assert.equal(A.children[1].visible, true); assert.equal(B.children[1].visible, false, '中點前：新年代的線條藏起');
grow.scrub(A, B, null, 0.7);
assert.equal(A.children[1].visible, false); assert.equal(B.children[1].visible, true, '越過中點：線條換成新年代');
grow.scrub(A, B, null, 0.4);
assert.equal(A.children[1].visible, true, '拖回中點前：舊年代線條回來');
let done = null; grow.settle(false, w => { done = w; });
for (let i = 0; i < 20; i++) grow.update(0.05);
assert.equal(grow.active, false); assert.equal(done, 'from'); assert.equal(A.visible, true); assert.equal(B.visible, false, '倒退收尾：留下舊年代');
assert(A.children[0].material.isMeshStandardMaterial && !A.children[0].material.onBeforeCompile.toString().includes('inject'), '材質換回原本');
// eraScrubber：放開在新年代
const groups = [mk(), mk(), mk()]; let cur = 0; groups.forEach((g, i) => g.visible = i === 0);
const apply = i => { cur = i; groups.forEach((g, j) => g.visible = j === i); };
const s = eraScrubber({ grow, group: i => groups[i], center: () => ({ x: 0, y: 0, z: 0 }), apply, current: () => cur });
s.scrub(0, 1, 0.2); assert.equal(cur, 0); s.scrub(0, 1, 0.6); assert.equal(cur, 1, '越過中點，目前年代跟著換');
assert(groups[0].visible && groups[1].visible, '拖曳中兩個年代都在場');
s.scrub(1, 2, 0.1); assert.equal(cur, 1); assert(groups[1].visible && groups[2].visible && !groups[0].visible, '換下一段');
s.endScrub(2); for (let i = 0; i < 80; i++) grow.update(0.05);
assert.equal(cur, 2); assert(groups[2].visible && !groups[1].visible);
console.log('timeline：拖曳、倒退與往前收尾檢查通過');
