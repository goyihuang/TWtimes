import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { orientedBox } from './station.js';

// 地標 3D 模型（glTF/GLB）：比程式拼出來的方塊準確得多。
// 模型放在 public/models/，在 eras.js 的地標加上 model: { url, front?, yaw?, height? }。
// 載入後依地標輪廓的最小外接矩形自動縮放、旋轉、貼地；載入失敗就退回程式模型。
const loader = new GLTFLoader();
const cache = new Map();
export function loadModel(url) {
  if (!cache.has(url)) cache.set(url, loader.loadAsync(new URL(url, document.baseURI).href).then(g => g.scene));
  return cache.get(url);
}

// 把模型擺進輪廓：模型的長邊對齊輪廓長邊，正面（模型本地 -z，可用 yaw 修正）朝 frontPoint
export function fitModel(src, ring, frontPoint, opt = {}) {
  const obj = src.clone(true);
  const wrap = new THREE.Group(); const inner = new THREE.Group(); inner.add(obj); wrap.add(inner);
  inner.rotation.y = opt.yaw || 0;
  inner.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(inner); const size = bb.getSize(new THREE.Vector3());
  const box = orientedBox(ring);
  const longModel = Math.max(size.x, size.z);
  const s = opt.height ? opt.height / size.y : box.L / longModel;
  if (size.z > size.x) inner.rotation.y += Math.PI / 2;
  inner.scale.setScalar(s);
  inner.updateMatrixWorld(true);
  const bb2 = new THREE.Box3().setFromObject(inner); const c = bb2.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -bb2.min.y, -c.z);
  let rot = -box.ang;
  const toFront = new THREE.Vector2(frontPoint[0] - box.cx, frontPoint[1] - box.cz);
  if (toFront.dot(new THREE.Vector2(Math.sin(box.ang), -Math.cos(box.ang))) < 0) rot += Math.PI;
  wrap.rotation.y = rot; wrap.position.set(box.cx, 0, box.cz);
  wrap.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  wrap.userData.height = (bb2.max.y - bb2.min.y);
  return wrap;
}
