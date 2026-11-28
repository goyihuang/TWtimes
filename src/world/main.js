// 全臺立體地景引擎：全臺預先切好的圖磚，鏡頭看到哪裡就載到哪裡（四分樹 LOD）。
// 地形：AWS Terrain Tiles（Terrarium）；建物、道路、水域、土地覆蓋、地名：OpenStreetMap 經 OpenMapTiles 切片（OpenFreeMap 提供）。
// 每張圖磚在背景執行緒（tile-worker.js）下載與生成，主執行緒只組 three.js 物件。場景 API 同 docs/scene-contract.md。
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { Post } from '../yuanshan/post.js';
import { facadeMaterial } from '../streetscape/build.js';
import { makeFrame, selectTiles, rootTiles, tileKey, tileSize, covers, parentOf, MAX_Z, TAIWAN } from './tiles.js';
import { SOURCES, resolveVector, pruneTileCache } from './sources.js';
import { patchPop, popDepth, popStart } from './pop.js';
import { OSM_CREDIT, OMT_CREDIT, stampGLB, creditLine } from '../shared/credits.js';

const mmToFov = mm => 2 * Math.atan(12 / mm) * 180 / Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function sunDir(hour, lat, decl = 8) {
  const L = lat * Math.PI / 180, d = decl * Math.PI / 180, H = (hour - 12) * 15 * Math.PI / 180;
  const E = Math.asin(Math.sin(L) * Math.sin(d) + Math.cos(L) * Math.cos(d) * Math.cos(H));
  let A = Math.acos(clamp((Math.sin(d) - Math.sin(E) * Math.sin(L)) / (Math.cos(E) * Math.cos(L)), -1, 1)); if (H > 0) A = 2 * Math.PI - A;
  return { v: new T.Vector3(Math.sin(A) * Math.cos(E), Math.sin(E), -Math.cos(A) * Math.cos(E)).normalize(), elev: E * 180 / Math.PI };
}

// 地名標籤（透明底、白邊字）
function labelTexture(text, kind) {
  const big = kind === 'city' ? 1.25 : kind === 'town' ? 1.05 : kind === 'peak' ? 0.9 : 0.85;
  const fs = Math.round(44 * big), c = document.createElement('canvas'), g = c.getContext('2d');
  g.font = `700 ${fs}px "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + 28 + (kind === 'peak' || kind === 'station' ? fs : 0); c.width = w; c.height = fs + 24;
  g.font = `700 ${fs}px "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif`; g.textBaseline = 'middle'; g.lineJoin = 'round';
  let x = 14; if (kind === 'peak' || kind === 'station') { g.fillStyle = kind === 'peak' ? '#7a4a2a' : '#a34730'; g.beginPath(); if (kind === 'peak') { g.moveTo(x, c.height / 2 + fs * 0.32); g.lineTo(x + fs * 0.4, c.height / 2 - fs * 0.34); g.lineTo(x + fs * 0.8, c.height / 2 + fs * 0.32); } else g.arc(x + fs * 0.38, c.height / 2, fs * 0.3, 0, 7); g.fill(); x += fs; }
  g.strokeStyle = 'rgba(20,28,26,.78)'; g.lineWidth = 7; g.strokeText(text, x, c.height / 2); g.fillStyle = kind === 'city' ? '#fff8e6' : '#f4f1e8'; g.fillText(text, x, c.height / 2);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.minFilter = T.LinearFilter; t.generateMipmaps = false;
  return { tex: t, w: c.width, h: c.height };
}

// place: { id, name, nameEn, city, lat, lng }
export async function createWorld(canvas, ui = {}, place) {
  const status = ui.status || (() => { });
  const lowEnd = matchMedia('(max-width: 760px)').matches || (navigator.hardwareConcurrency || 8) <= 4;
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }); }
  catch (e) { status('此裝置無法啟用 WebGL，請開啟瀏覽器硬體加速後重新整理。'); throw e; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, lowEnd ? 1.25 : 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.85;
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(mmToFov(28), 1, 1, 100000);
  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, { enableDamping: true, maxPolarAngle: Math.PI * 0.49, minDistance: 8, maxDistance: 900000, screenSpacePanning: false, zoomToCursor: true, zoomSpeed: 1.4 });
  const post = new Post(renderer, scene, camera, lowEnd ? 'low' : 'high');
  post.setGrade({ sat: 1.03, con: 1.05, warm: 0.1, sepia: 0, lift: 0.03, vig: 0.2, grain: 0.018, paper: 0, teal: 0.16 });

  // ── 狀態（網址參數可還原）──
  const q = new URLSearchParams(location.search);
  const qn = (k, a, b, d) => { const v = Number(q.get(k)); return q.has(k) && q.get(k) !== '' && Number.isFinite(v) ? clamp(v, a, b) : d; };
  const ll = (q.get('ll') || '').split(',').map(Number);
  const start = ll.length === 2 && ll.every(Number.isFinite) && ll[0] > TAIWAN.s && ll[0] < TAIWAN.n && ll[1] > TAIWAN.w && ll[1] < TAIWAN.e ? { lat: ll[0], lng: ll[1] } : { lat: place.lat, lng: place.lng };
  const state = {
    era: 0, shot: 0, mm: qn('mm', 14, 135, 28), hour: qn('t', 0, 23.75, 15.5), weather: ['clear', 'cloudy', 'rain', 'fog'].includes(q.get('w')) ? q.get('w') : 'clear', walk: false, night: 0,
    seed: qn('seed', 1, 9999, 1) | 0, heightScale: qn('hs', 0.5, 2, 1), roadScale: qn('rs', 0.6, 1.6, 1), exaggeration: qn('ex', 1, 3, 1), detail: qn('det', 0.5, 2, lowEnd ? 0.75 : 1),
    clay: q.get('clay') === '1', trees: q.get('trees') !== '0', labels: q.get('labels') !== '0',
    pop: q.has('pop') ? q.get('pop') !== '0' : !matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
  const frame = makeFrame(start.lat, start.lng);

  // ── 天空、光源、海面 ──
  const sky = new Sky(); scene.add(sky); const su = sky.material.uniforms;
  const sun = new T.DirectionalLight(0xfff1dc, 3); sun.castShadow = true; const sm = lowEnd ? 2048 : 4096; sun.shadow.mapSize.set(sm, sm);
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.08; scene.add(sun, sun.target);
  const hemi = new T.HemisphereLight(0xcfe0f2, 0x8a7a62, 0.6); scene.add(hemi);
  const pmrem = new T.PMREMGenerator(renderer), envScene = new T.Scene(), envSky = new Sky(); envSky.scale.setScalar(1000); envScene.add(envSky);
  let envRT = null;
  const sea = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: 0x2f5562, roughness: 0.12, metalness: 0.1, envMapIntensity: 1.1 }));
  sea.position.y = -0.3; sea.receiveShadow = true; scene.add(sea);
  const RN = lowEnd ? 2500 : 6000, rainPos = new Float32Array(RN * 6);
  for (let i = 0; i < RN; i++) { const x = (Math.random() - 0.5) * 140, y = Math.random() * 60, z = (Math.random() - 0.5) * 140; rainPos.set([x, y, z, x + 0.05, y + 0.9, z + 0.03], i * 6); }
  const rainGeo = new T.BufferGeometry(); rainGeo.setAttribute('position', new T.BufferAttribute(rainPos, 3));
  const rain = new T.LineSegments(rainGeo, new T.LineBasicMaterial({ color: 0xc8d6de, transparent: true, opacity: 0.4, fog: false })); rain.frustumCulled = false; rain.visible = false; scene.add(rain);

  // ── 共用材質 ──
  const fm = facadeMaterial();
  const roadMat = (color, rough = 0.9, factor = -2) => new T.MeshStandardMaterial({ color, roughness: rough, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: factor, polygonOffsetUnits: factor * 2 });
  const mats = { asphalt: roadMat(0x4c4e4b), minor: roadMat(0x5c5d59), path: roadMat(0xb9ad96, 0.9, -3), rail: roadMat(0x5f5850, 1, -3), pier: new T.MeshStandardMaterial({ color: 0xa8a49b, roughness: 0.9 }), crown: new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), trunk: new T.MeshStandardMaterial({ color: 0x5a4a3a }) };
  const wetMats = [mats.asphalt, mats.minor, mats.path, mats.rail].map(m => ({ m, rough: m.roughness, color: m.color.clone() }));
  const crownGeo = (() => { const g = new T.IcosahedronGeometry(2.6, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 0.82 + 0.3 * Math.sin(p.getX(i) * 2.1 + p.getZ(i) * 1.7); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.85, p.getZ(i) * k); } g.computeVertexNormals(); g.translate(0, 4.6, 0); return g; })();
  const trunkGeo = new T.CylinderGeometry(0.16, 0.24, 3, 6).translate(0, 1.5, 0), pierGeo = new T.BoxGeometry(1.8, 1, 1.8).translate(0, 0.5, 0);
  const terrainMats = new Set();
  // 紙雕彈起：建物、樹的頂點著色器依開始時間縮放高度（pop.js）；陰影深度材質同步
  const uPopNow = { value: 0 };
  patchPop(T, fm, 'bld', uPopNow); patchPop(T, mats.crown, 'inst', uPopNow); patchPop(T, mats.trunk, 'inst', uPopNow);
  const depthBld = popDepth(T, 'bld', uPopNow), depthInst = popDepth(T, 'inst', uPopNow);
  // 依焦點距離排開始時間；off：直接完成
  function popTimes(t, now, on = state.pop) {
    const g = t.group; if (!g) return;
    const tx = controls.target.x, tz = controls.target.z;
    for (const o of g.children) {
      if (o.name === 'buildings') { const a = o.geometry.attributes.pop, A = a.array; for (let i = 0; i < A.length; i += 4) A[i + 3] = on ? popStart(now, A[i + 1], A[i + 2], t.ox, t.oz, tx, tz) : -100; a.needsUpdate = true; }
      else if (o.isInstancedMesh && o.geometry.attributes.aPop) { const a = o.geometry.attributes.aPop, A = a.array, m = o.instanceMatrix.array; for (let i = 0; i < A.length; i++) A[i] = on ? popStart(now + 0.25, m[i * 16 + 12], m[i * 16 + 14], t.ox, t.oz, tx, tz) : -100; a.needsUpdate = true; }
    }
  }

  // ── 圖磚管理 ──
  let vecURL = null;
  try { vecURL = await resolveVector(); } catch (e) { console.warn(e); status('街道與建物圖磚暫時連不上，先顯示地形。'); }
  const workers = Array.from({ length: lowEnd ? 2 : Math.min(4, Math.max(2, (navigator.hardwareConcurrency || 4) - 2)) }, () => new Worker(new URL('./tile-worker.js', import.meta.url), { type: 'module' }));
  const tiles = new Map(); // key → { z,x,y, state:'loading'|'ready'|'error', group, grid, N, S, ox, oz, stats, labels, used }
  const queue = []; let busy = 0, gen = 1;
  const world = new T.Group(); scene.add(world);
  const labelGroup = new T.Group(); scene.add(labelGroup);
  const optsFor = z => ({ vector: !!vecURL, exaggeration: state.exaggeration, texSize: z >= 14 ? (lowEnd ? 512 : 1024) : z >= 11 ? 512 : 256, seed: state.seed, heightScale: state.heightScale, roadScale: state.roadScale, trees: state.trees, treeMax: lowEnd ? 1500 : 3500, clay: state.clay });
  const pending = new Map();
  workers.forEach(w => w.onmessage = e => onTile(e.data));
  let rr = 0;
  function pump() {
    while (busy < workers.length * 2 && queue.length) {
      const t = queue.shift(); if (t.state !== 'queued') continue;
      t.state = 'loading'; busy++;
      const [ox, oz, S] = frame.tileOrigin(t.z, t.x, t.y); Object.assign(t, { ox, oz, S });
      const w = workers[rr++ % workers.length]; pending.set(t.key, { w, gen: t.gen });
      w.postMessage({ key: t.key, z: t.z, x: t.x, y: t.y, S, vecURL, demURL: SOURCES.terrain.url, opts: { ...optsFor(t.z), ox: t.x * S, oz: t.y * S } });
    }
  }
  function onTile(r) {
    busy--; const t = tiles.get(r.key), p = pending.get(r.key); pending.delete(r.key);
    if (!t || !p || p.gen !== t.gen) { r.bitmap?.close?.(); pump(); return; }
    if (r.error) { t.state = r.error === 'abort' ? 'none' : 'error'; t.err = r.error; t.retry = performance.now() + 8000; pump(); return; }
    assemble(t, r); t.state = 'ready'; pump(); dirty = true;
  }
  function assemble(t, r) {
    const g = new T.Group(); g.position.set(t.ox, 0, t.oz); g.name = t.key;
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(r.terrain.position, 3)); geo.setAttribute('normal', new T.BufferAttribute(r.terrain.normal, 3)); geo.setAttribute('uv', new T.BufferAttribute(r.terrain.uv, 2)); geo.setIndex(new T.BufferAttribute(r.terrain.index, 1));
    geo.computeBoundingSphere();
    const tex = new T.Texture(r.bitmap); tex.flipY = false; tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 8; tex.needsUpdate = true; tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping;
    const tm = new T.MeshStandardMaterial({ map: state.clay ? null : tex, color: state.clay ? 0xd9d6cf : 0xffffff, roughness: 0.96, side: T.DoubleSide });
    tm.userData.tex = tex; terrainMats.add(tm);
    const ground = new T.Mesh(geo, tm); ground.receiveShadow = true; g.add(ground); // 地形不投影（雙面材質會把自己整片遮暗）；山的明暗由貼圖裡的地形陰影負責
    if (r.buildings && r.buildings.position.length) {
      const bg = new T.BufferGeometry();
      for (const [k, n] of [['position', 3], ['normal', 3], ['fuv', 2], ['color', 3], ['pop', 4]]) bg.setAttribute(k, new T.BufferAttribute(r.buildings[k], n));
      bg.computeBoundingSphere(); const bm = new T.Mesh(bg, fm); bm.castShadow = bm.receiveShadow = true; bm.name = 'buildings'; bm.customDepthMaterial = depthBld; g.add(bm);
    }
    if (r.roads) for (const k of ['asphalt', 'minor', 'path', 'rail']) {
      const a = r.roads[k]; if (!a?.position.length) continue;
      const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.BufferAttribute(a.position, 3)); rg.setAttribute('normal', new T.BufferAttribute(a.normal, 3)); rg.computeBoundingSphere();
      const m = new T.Mesh(rg, mats[k]); m.receiveShadow = true; m.renderOrder = 2; g.add(m);
    }
    const piers = r.roads?.piers?.data;
    if (piers?.length) { const n = piers.length / 4, im = new T.InstancedMesh(pierGeo, mats.pier, n), m4 = new T.Matrix4(); for (let i = 0; i < n; i++) im.setMatrixAt(i, m4.makeScale(1, piers[i * 4 + 3], 1).setPosition(piers[i * 4], piers[i * 4 + 1], piers[i * 4 + 2])); im.castShadow = true; im.computeBoundingSphere(); g.add(im); }
    if (r.trees?.length) {
      const n = r.trees.length / 4, cg = crownGeo.clone(), tg = trunkGeo.clone(), ap = new T.InstancedBufferAttribute(new Float32Array(n), 1); cg.setAttribute('aPop', ap); tg.setAttribute('aPop', ap);
      const ci = new T.InstancedMesh(cg, mats.crown, n), ti = new T.InstancedMesh(tg, mats.trunk, n), m4 = new T.Matrix4(), qq = new T.Quaternion(), col = new T.Color(), up = new T.Vector3(0, 1, 0);
      for (let i = 0; i < n; i++) { const s = r.trees[i * 4 + 3]; m4.compose(new T.Vector3(r.trees[i * 4], r.trees[i * 4 + 1] - 0.3, r.trees[i * 4 + 2]), qq.setFromAxisAngle(up, i * 2.4), new T.Vector3(s, s * (0.9 + (i % 7) * 0.05), s)); ci.setMatrixAt(i, m4); ti.setMatrixAt(i, m4); ci.setColorAt(i, col.setHSL(0.24 + (i % 11) * 0.007, 0.3 + (i % 5) * 0.04, 0.2 + (i % 9) * 0.014)); }
      ci.castShadow = ti.castShadow = true; ci.receiveShadow = true; ci.customDepthMaterial = ti.customDepthMaterial = depthInst; ci.computeBoundingSphere(); ti.computeBoundingSphere(); ci.name = 'trees'; ti.name = 'trees'; ci.visible = ti.visible = state.trees; g.add(ci, ti);
    }
    Object.assign(t, { group: g, grid: r.grid, N: r.N, stats: r.stats, labels: r.labels, vecError: r.vecError });
    g.visible = false; world.add(g);
    popTimes(t, time);
  }
  function disposeTile(t) {
    if (t.group) { world.remove(t.group); t.group.traverse(o => { if (o.isMesh || o.isInstancedMesh) { if (o.geometry !== crownGeo && o.geometry !== trunkGeo && o.geometry !== pierGeo) o.geometry.dispose(); if (o.material?.userData?.tex) { o.material.userData.tex.dispose(); terrainMats.delete(o.material); o.material.dispose(); } } }); }
    for (const l of t.sprites || []) { labelGroup.remove(l); l.material.map.dispose(); l.material.dispose(); }
    if (t.state === 'loading') { const p = pending.get(t.key); p?.w.postMessage({ cancel: t.key }); }
    tiles.delete(t.key);
  }
  function want(z, x, y, prio) {
    const key = tileKey(z, x, y); let t = tiles.get(key);
    if (!t) { t = { key, z, x, y, state: 'none', gen }; tiles.set(key, t); }
    t.used = frameNo; t.prio = prio;
    if ((t.state === 'none' || (t.state === 'error' && performance.now() > t.retry))) { t.state = 'queued'; t.gen = gen; queue.push(t); }
    return t;
  }

  // 高度查詢：最細的已載入圖磚（與網格三角形一致）
  function heightAt(x, z) {
    const mx = x / frame.k + frame.mx0, my = z / frame.k + frame.my0;
    for (let zz = MAX_Z; zz >= 8; zz--) {
      const S = tileSize(zz), tx = Math.floor(mx / S), ty = Math.floor(my / S), t = tiles.get(tileKey(zz, tx, ty));
      if (!t || t.state !== 'ready') continue;
      const N = t.N, cell = t.S / N, lx = x - t.ox, lz = z - t.oz, fx = clamp(lx / cell, 0, N - 1e-6), fz = clamp(lz / cell, 0, N - 1e-6), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, W = N + 1, G = t.grid;
      const a = G[j * W + i], b = G[j * W + i + 1], c = G[(j + 1) * W + i], d = G[(j + 1) * W + i + 1];
      return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
    }
    return 0;
  }

  // 每次鏡頭變動：選圖磚、排隊下載、決定顯示哪些（缺的先用已載入的上一層或下一層補）
  let frameNo = 0, dirty = true, shown = new Set(), labelsShown = new Map();
  const roots = rootTiles();
  function updateTiles() {
    frameNo++;
    const c = camera.position, sel = selectTiles(frame, [c.x, c.y, c.z], { detail: state.detail, roots, groundY: heightAt(c.x, c.z) });
    const tgt = controls.target;
    const prio = (z, x, y) => { const [ox, oz, S] = frame.tileOrigin(z, x, y); return Math.hypot(ox + S / 2 - tgt.x, oz + S / 2 - tgt.z) / S - z * 0.5; };
    const vis = new Set();
    for (const [z, x, y] of sel) {
      const t = want(z, x, y, prio(z, x, y));
      if (t.state === 'ready') { vis.add(t); continue; }
      // 先找已載入的子圖磚（拉遠時），再找祖先（拉近時）
      const kids = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b]) => tiles.get(tileKey(z + 1, x * 2 + a, y * 2 + b)));
      if (z < MAX_Z && kids.every(k => k?.state === 'ready')) { kids.forEach(k => { k.used = frameNo; vis.add(k); }); continue; }
      let p = [z, x, y];
      while (p[0] > 8) { p = parentOf(p); const a = tiles.get(tileKey(...p)); if (a?.state === 'ready') { a.used = frameNo; vis.add(a); break; } }
    }
    // 祖先與子孫同時顯示會重疊：有祖先時藏起子孫
    const list = [...vis];
    for (const t of list) if (list.some(a => a !== t && a.z < t.z && covers([a.z, a.x, a.y], [t.z, t.x, t.y]))) vis.delete(t);
    queue.sort((a, b) => a.prio - b.prio); pump();
    for (const t of shown) if (!vis.has(t) && t.group) t.group.visible = false;
    for (const t of vis) t.group.visible = true;
    shown = vis;
    // 快取上限：超過就丟最久沒用到的
    if (tiles.size > 260) { const old = [...tiles.values()].filter(t => !vis.has(t) && t.used < frameNo - 2).sort((a, b) => a.used - b.used); for (const t of old.slice(0, tiles.size - 220)) disposeTile(t); }
    updateLabels(vis);
    const loading = [...tiles.values()].filter(t => t.state === 'loading' || t.state === 'queued').length;
    ui.onLoad?.(loading);
    if (loading) status(`載入圖磚中…（還有 ${loading} 張）`); else if (statusIdle) status(statusIdle());
  }
  // 地名：只顯示目前可見圖磚的標籤，同名同地點去重
  function updateLabels(vis) {
    const keep = new Set();
    if (state.labels) for (const t of vis) {
      if (!t.labels?.length) continue;
      if (!t.sprites) t.sprites = t.labels.slice(0, t.z >= 14 ? 14 : 24).map(l => {
        const { tex, w, h } = labelTexture(l.n, l.kind), sp = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: true, depthWrite: false, transparent: true, fog: false }));
        const s = 0.00032; sp.scale.set(w * s, h * s, 1); sp.material.sizeAttenuation = false; sp.center.set(0.5, 0); sp.renderOrder = 20;
        sp.position.set(t.ox + l.x, l.y + 12, t.oz + l.z); sp.userData = { id: l.n + '@' + Math.round((t.ox + l.x) / 800) + ',' + Math.round((t.oz + l.z) / 800), kind: l.kind, rank: l.rank };
        return sp;
      });
      for (const sp of t.sprites) { if (keep.has(sp.userData.id)) continue; keep.add(sp.userData.id); if (!sp.parent) labelGroup.add(sp); sp.visible = true; labelsShown.set(sp.userData.id, sp); }
    }
    for (const sp of [...labelGroup.children]) if (!keep.has(sp.userData.id) || ![...vis].some(t => t.sprites?.includes(sp))) { sp.visible = false; labelGroup.remove(sp); }
  }
  function reloadAll(onlyZ14 = false) {
    gen++;
    for (const t of [...tiles.values()]) if (!onlyZ14 || t.z >= MAX_Z) { disposeTile(t); shown.delete(t); }
    queue.length = 0; dirty = true;
  }

  // ── 天氣與時刻 ──
  function climate() {
    const { v, elev } = sunDir(state.hour, frame.lat0), w = state.weather;
    const day = T.MathUtils.smoothstep(elev, -6, 8), golden = 1 - T.MathUtils.smoothstep(elev, 4, 30);
    const overcast = w === 'rain' ? 1 : w === 'cloudy' ? 0.6 : w === 'fog' ? 0.5 : 0;
    state.night = 1 - day; state.sun = v;
    for (const u of [su, envSky.material.uniforms]) { u.sunPosition.value.copy(v).multiplyScalar(1000); u.turbidity.value = 3 + overcast * 6; u.rayleigh.value = 1.2 + golden * 1.4 - overcast * 0.9; u.mieCoefficient.value = 0.004 + overcast * 0.004; u.mieDirectionalG.value = 0.78; }
    sun.color.setHSL(0.09 - golden * 0.04, 0.6 + golden * 0.3, 0.9 - golden * 0.18);
    sun.intensity = Math.max(0, day * (3.4 - golden * 0.9) * (1 - overcast * 0.82));
    hemi.intensity = 0.28 + day * (0.3 + overcast * 0.45); hemi.color.setHSL(0.58, 0.45 * day + 0.2, 0.55 + day * 0.25); hemi.groundColor.setHSL(0.09, 0.25, 0.18 + day * 0.28);
    if (!day) hemi.color.set(0x324a78);
    renderer.toneMappingExposure = 0.52 + day * 0.16 + (1 - day) * 0.36;
    const fogCol = new T.Color().setHSL(0.58 - golden * 0.5 * day, 0.15 + 0.1 * day, 0.08 + day * (0.62 - overcast * 0.12));
    if (golden > 0.5 && day > 0.2) fogCol.lerp(new T.Color(0xd9b48c), (golden - 0.5) * 0.6);
    if (day < 0.5) fogCol.lerp(new T.Color(0x0d1524), 1 - day * 2);
    if (w === 'fog') fogCol.lerp(new T.Color(0xc9ced0), day * 0.6);
    state.fogCol = fogCol; state.fogK = w === 'fog' ? 6 : w === 'rain' ? 3.2 : w === 'cloudy' ? 1.6 : 1;
    sky.visible = w !== 'fog' && w !== 'rain'; scene.background = sky.visible ? null : fogCol;
    scene.fog = new T.FogExp2(fogCol, 0.0001);
    fm.userData.uniforms.uNight.value = state.night; fm.userData.uniforms.uWet.value = w === 'rain' ? 1 : w === 'fog' ? 0.3 : 0;
    const wet = w === 'rain' ? 1 : 0; for (const { m, rough, color } of wetMats) { m.roughness = rough * (1 - wet * 0.75); m.color.copy(color).multiplyScalar(1 - wet * 0.3); }
    rain.visible = w === 'rain';
    post.bloom.strength = 0.08 + state.night * 0.32; post.bloom.threshold = 3.0 - state.night * 1.8; post.bloom.radius = 0.45;
    updateEnv();
  }
  let envTimer = 0; function updateEnv() { clearTimeout(envTimer); envTimer = setTimeout(() => { envRT?.dispose(); envRT = pmrem.fromScene(envScene, 0.02); scene.environment = envRT.texture; scene.environmentIntensity = 0.06 + (1 - state.night) * 0.24; }, 60); }

  // ── 鏡位：以目前焦點為中心；「全臺」看整座島 ──
  const shots = [{ name: '鳥瞰街區' }, { name: '斜俯近景' }, { name: '街口人眼' }, { name: '城市遠望' }, { name: '全臺俯瞰' }];
  function lookFrom(target, dist, pitchDeg, headingDeg) {
    const p = pitchDeg * Math.PI / 180, h = headingDeg * Math.PI / 180;
    controls.target.copy(target); camera.position.set(target.x - Math.sin(h) * Math.cos(p) * dist, target.y + Math.sin(p) * dist, target.z + Math.cos(h) * Math.cos(p) * dist);
    controls.update(); dirty = true;
  }
  function setFocal(mm) { state.mm = mm; camera.fov = mmToFov(mm); camera.updateProjectionMatrix(); }
  function heading() { const d = new T.Vector3().subVectors(controls.target, camera.position); return Math.atan2(d.x, -d.z) * 180 / Math.PI; }
  function setShot(i) {
    exitWalk(); state.shot = i; const tg = controls.target.clone(); tg.y = heightAt(tg.x, tg.z);
    const hd = heading();
    if (i === 0) lookFrom(tg, 950, 48, hd);
    else if (i === 1) lookFrom(tg, 320, 28, hd);
    else if (i === 2) { lookFrom(tg, 60, 8, hd); enterWalk(); }
    else if (i === 3) lookFrom(tg, 9000, 22, hd);
    else if (i === 4) { const [x, z] = frame.toWorld(120.95, 23.65); lookFrom(new T.Vector3(x, 0, z), 520000, 62, 0); }
    if (i !== 2) setFocal(i === 4 ? 35 : 28);
    ui.onShot?.(i);
  }
  function flyTo(lat, lng, dist = 950) { const [x, z] = frame.toWorld(lng, lat); lookFrom(new T.Vector3(x, heightAt(x, z), z), dist, 48, heading()); }

  // ── 漫步：貼地人眼高度 ──
  const keys = new Set(); let yaw = 0, pitch = 0, drag = null, stick = null;
  const EYE = 1.65;
  function enterWalk() {
    state.walk = true; controls.enabled = false;
    const d = new T.Vector3().subVectors(controls.target, camera.position); yaw = Math.atan2(d.x, d.z); pitch = 0;
    const p = controls.target; camera.position.set(p.x, heightAt(p.x, p.z) + EYE, p.z); ui.onWalk?.(true); dirty = true;
  }
  function exitWalk() { if (!state.walk) return; state.walk = false; controls.enabled = true; controls.target.copy(camera.position).addScaledVector(new T.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), 12); controls.target.y = heightAt(controls.target.x, controls.target.z); controls.update(); ui.onWalk?.(false); }
  addEventListener('keydown', e => { if (state.walk && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) { keys.add(e.key.toLowerCase()); if (e.key.startsWith('Arrow')) e.preventDefault(); } });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  canvas.addEventListener('pointerdown', e => { if (!state.walk) return; canvas.setPointerCapture(e.pointerId); const r = canvas.getBoundingClientRect(); if (e.pointerType === 'touch' && e.clientX - r.left < r.width / 2) stick = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; else drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointermove', e => { if (stick && e.pointerId === stick.id) { stick.dx = (e.clientX - stick.x) / 60; stick.dy = (e.clientY - stick.y) / 60; } else if (drag && e.pointerId === drag.id) { yaw -= (e.clientX - drag.x) * 0.004; pitch = clamp(pitch - (e.clientY - drag.y) * 0.004, -1.2, 1.2); drag.x = e.clientX; drag.y = e.clientY; } });
  const endPtr = e => { if (stick?.id === e.pointerId) stick = null; if (drag?.id === e.pointerId) drag = null; };
  canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
  function walkStep(dt) {
    let f = 0, s = 0; const run = keys.has('shift') ? 4 : 1;
    if (keys.has('w') || keys.has('arrowup')) f += 1; if (keys.has('s') || keys.has('arrowdown')) f -= 1;
    if (keys.has('a')) s -= 1; if (keys.has('d')) s += 1;
    if (keys.has('arrowleft') || keys.has('q')) yaw += dt * 1.6; if (keys.has('arrowright') || keys.has('e')) yaw -= dt * 1.6;
    if (stick) { f -= clamp(stick.dy, -1, 1); s += clamp(stick.dx, -1, 1); }
    const sp = 4.5 * run * dt, fx = Math.sin(yaw), fz = Math.cos(yaw);
    const x = camera.position.x + (fx * f - fz * s) * sp, z = camera.position.z + (fz * f + fx * s) * sp, y = heightAt(x, z) + EYE;
    camera.position.set(x, y, z);
    camera.lookAt(x + Math.sin(yaw) * Math.cos(pitch), y + Math.sin(pitch), z + Math.cos(yaw) * Math.cos(pitch));
    if (f || s) dirty = true;
  }

  // ── 中心標記（景點名稱）──
  const pin = new T.Group(); scene.add(pin);
  if (place.name) {
    const { tex, w, h } = labelTexture(place.name, 'city');
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false, transparent: true, fog: false })); sp.scale.set(w * 0.0004, h * 0.0004, 1); sp.center.set(0.5, 0); sp.material.sizeAttenuation = false; sp.renderOrder = 30;
    const stem = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 1, 6), new T.MeshBasicMaterial({ color: 0xa34730, depthTest: false, transparent: true, opacity: 0.8 })); stem.renderOrder = 30;
    pin.add(sp, stem); pin.userData = { sp, stem };
    const [px, pz] = frame.toWorld(place.lng, place.lat); pin.position.set(px, 0, pz);
  }

  // ── 渲染 ──
  function resize() { const { width, height } = canvas.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height, false); post.setSize(width, height, renderer.getPixelRatio()); camera.aspect = width / height; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(canvas); resize();
  controls.addEventListener('change', () => { dirty = true; });
  const clock = new T.Clock(); let time = 0, lastUpdate = 0, statusIdle = null;
  function frameLoop() {
    const dt = Math.min(0.05, clock.getDelta()); time += dt;
    if (state.walk) walkStep(dt); else {
      controls.update();
      // 焦點貼地、鏡頭不鑽進地面
      const gy = heightAt(controls.target.x, controls.target.z); if (Math.abs(controls.target.y - gy) > 0.5) { const d = gy - controls.target.y; controls.target.y += d * 0.25; camera.position.y += d * 0.25; }
      const cg = heightAt(camera.position.x, camera.position.z) + 3; if (camera.position.y < cg) camera.position.y = cg;
    }
    const alt = Math.max(2, camera.position.y - heightAt(camera.position.x, camera.position.z));
    camera.near = clamp(alt * 0.04, 0.4, 400); camera.far = clamp(alt * 260 + 60000, 60000, 1500000); camera.updateProjectionMatrix();
    sky.position.copy(camera.position); sky.scale.setScalar(camera.far * 0.8);
    sea.position.x = camera.position.x; sea.position.z = camera.position.z; sea.scale.setScalar(camera.far * 2);
    scene.fog.density = 1 / Math.max(2500, alt * 9 + camera.position.distanceTo(controls.target) * 1.5) * state.fogK;
    // 陰影跟著焦點
    const fd = state.walk ? 300 : clamp(camera.position.distanceTo(controls.target) * 0.9, 200, 3200), f0 = state.walk ? camera.position : controls.target;
    if (state.sun) { sun.position.copy(f0).addScaledVector(state.sun, fd * 3); sun.target.position.copy(f0); Object.assign(sun.shadow.camera, { left: -fd, right: fd, top: fd, bottom: -fd, near: fd * 0.5, far: fd * 6 }); sun.shadow.camera.updateProjectionMatrix(); }
    if (pin.userData.sp) { const h = clamp(camera.position.distanceTo(pin.position) * 0.06, 20, 4000); pin.position.y = heightAt(pin.position.x, pin.position.z); pin.userData.sp.position.y = h + 3; pin.userData.stem.scale.set(clamp(h / 60, 0.5, 30), h, clamp(h / 60, 0.5, 30)); pin.userData.stem.position.y = h / 2; pin.visible = !state.walk && !document.body.classList.contains('clean-view'); }
    labelGroup.visible = state.labels && !document.body.classList.contains('clean-view');
    if (rain.visible) { const p = rainGeo.attributes.position.array; for (let i = 0; i < p.length; i += 6) { p[i + 1] -= dt * 26; p[i + 4] -= dt * 26; if (p[i + 1] < 0) { p[i + 1] += 60; p[i + 4] += 60; } } rainGeo.attributes.position.needsUpdate = true; rain.position.set(camera.position.x, camera.position.y - 30, camera.position.z); }
    if ((dirty && time - lastUpdate > 0.15) || time - lastUpdate > 1) { dirty = false; lastUpdate = time; updateTiles(); }
    post.grade.uniforms.uTime.value = time; uPopNow.value = time;
    post.composer.render(dt);
  }

  // ── 依據表、分享、匯出 ──
  const credits = [OSM_CREDIT, OMT_CREDIT, '地形 Mapzen／AWS Terrain Tiles'];
  const era = { id: 'now', year: '現況', name: '全臺立體地景', en: 'TAIWAN IN 3D', story: '', evidence: [] };
  function nearStats() { let b = 0, g = 0; for (const t of shown) if (t.z >= MAX_Z && t.stats) { b += t.stats.buildings; g += t.stats.guessed; } return { b, g }; }
  statusIdle = () => { const { b, g } = nearStats(), [lng, lat] = frame.toLngLat(controls.target.x, controls.target.z); return `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E｜海拔 ${Math.round(heightAt(controls.target.x, controls.target.z) / state.exaggeration)} m｜近景 ${b.toLocaleString()} 棟建物（${g.toLocaleString()} 棟高度為推估）`; };
  function updateEvidence() {
    const { b, g } = nearStats();
    era.story = '全臺預先切好的圖磚，看到哪裡就載到哪裡：地形、道路、水域、土地覆蓋與地名全島都有，近景約 2–4 公里內長出立體建物。歷史年代與故事之後疊在這層上面。';
    era.evidence = [
      ['道路、建物外框、水域、土地覆蓋、地名', 'A', `OpenStreetMap（經 OpenMapTiles 切片，${SOURCES.vector.name} 提供）`],
      ['地形高低', 'A', `${SOURCES.terrain.name}（約 30 公尺網格；起伏倍率 ${state.exaggeration}×）`],
      ['建物高度', b && (b - g) / b > 0.5 ? 'B' : 'C', b ? `近景 ${b} 棟中 ${b - g} 棟取自 OSM 高度／樓層，${g} 棟依面積與街區密度推估` : '有 OSM 高度或樓層者照用，其餘依面積與街區密度推估'],
      ['立面、行道樹、林木', 'C', '程序化示意，非實景'],
    ];
    ui.onEra?.(0);
  }
  function shareURL() {
    const u = new URL(location.href), S = (k, v, d) => { if (v === d) u.searchParams.delete(k); else u.searchParams.set(k, v); };
    const [lng, lat] = frame.toLngLat(controls.target.x, controls.target.z), dist = camera.position.distanceTo(controls.target);
    const pt = Math.asin(clamp((camera.position.y - controls.target.y) / dist, -1, 1)) * 180 / Math.PI;
    u.searchParams.set('place', 'tw'); u.searchParams.set('ll', `${lat.toFixed(5)},${lng.toFixed(5)}`);
    u.searchParams.set('d', Math.round(dist)); u.searchParams.set('hd', Math.round(heading())); u.searchParams.set('pt', Math.round(pt));
    S('t', state.hour, 15.5); S('w', state.weather, 'clear'); S('mm', state.mm, 28); S('seed', state.seed, 1); S('hs', state.heightScale, 1); S('rs', state.roadScale, 1); S('ex', state.exaggeration, 1);
    S('pop', state.pop ? '1' : '0', '1'); S('clay', state.clay ? '1' : '0', '0'); S('trees', state.trees ? '1' : '0', '1'); S('labels', state.labels ? '1' : '0', '1'); S('walk', state.walk ? '1' : '0', '0');
    u.searchParams.delete('shot'); u.searchParams.delete('cam');
    return u.href;
  }
  function snapshot() { post.composer.render(0); const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height; c.getContext('2d').drawImage(canvas, 0, 0); return c; }
  async function exportGLB() {
    status('匯出 GLB 中…');
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    const root = new T.Group(); for (const t of shown) if (t.z >= 13 && t.group) root.add(t.group.clone());
    const buf = stampGLB(await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: true }), creditLine(credits));
    const [lng, lat] = frame.toLngLat(controls.target.x, controls.target.z);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'model/gltf-binary' })); a.download = `taiwan-3d-${lat.toFixed(4)}_${lng.toFixed(4)}.glb`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    status('已匯出近景圖磚（地形、建物、道路）。資料 © OpenStreetMap contributors、地形 Mapzen／AWS Terrain Tiles，發表時須標示。');
  }

  // ── 初始鏡頭 ──
  climate();
  const [sx, sz] = frame.toWorld(start.lng, start.lat);
  lookFrom(new T.Vector3(sx, 0, sz), qn('d', 10, 900000, 950), qn('pt', 3, 89, 48), qn('hd', -360, 360, -20));
  setFocal(state.mm);
  // 先等焦點附近的地形載入，再交給使用者（最多 12 秒）
  status('載入全臺地形與街道圖磚…');
  updateTiles();
  await new Promise(res => { const t0 = performance.now(); const tick = () => { updateTiles(); const ready = [...shown].some(t => t.z >= 12); if (ready || performance.now() - t0 > 12000) res(); else setTimeout(tick, 150); }; tick(); });
  controls.target.y = heightAt(controls.target.x, controls.target.z); lookFrom(controls.target.clone(), qn('d', 10, 900000, 950), qn('pt', 3, 89, 48), qn('hd', -360, 360, -20));
  if (q.get('walk') === '1') enterWalk();
  renderer.setAnimationLoop(frameLoop);
  setTimeout(() => pruneTileCache().then(n => n && console.info(`圖磚快取：清掉 ${n} 筆過期或超量項目`)), 8000);
  updateEvidence(); setInterval(() => { if (!document.hidden) updateEvidence(); }, 4000);

  const later = (fn => { let t = 0; return f => { clearTimeout(t); t = setTimeout(f, 350); }; })();
  const toggle = (id, label, title, key, fn) => ({ id, label, title, on: () => state[key], set: v => { state[key] = v; fn(v); } });
  function replayPop() { const now = time; for (const t of shown) if (t.z >= MAX_Z) popTimes(t, now + 0.1, true); }
  return {
    renderer, scene, camera, controls, post, state, sun, eras: [era], shots, frame, tiles, heightAt, flyTo, credits, replayPop,
    focusLatLng() { const [lng, lat] = frame.toLngLat(controls.target.x, controls.target.z); return { lat, lng, name: place.name || '', hour: state.hour, size: clamp(camera.position.distanceTo(controls.target) * 0.6, 100, 1000) }; },
    get shown() { return shown; },
    stats: () => ({ ...nearStats(), tiles: shown.size, loading: [...tiles.values()].filter(t => t.state === 'loading' || t.state === 'queued').length, errors: [...tiles.values()].filter(t => t.state === 'error').map(t => t.key + ':' + t.err), vecErrors: [...shown].filter(t => t.vecError).length }),
    walkHint: 'W A S D／方向鍵移動・拖曳轉向・Shift 快走｜手機：左半邊拖曳前進、右半邊轉向',
    weathers: { clear: '晴天', cloudy: '多雲', rain: '雨天', fog: '霧' },
    setEra() { ui.onEra?.(0); }, setShot, setFocal, snapshot, shareURL,
    setHour(h) { state.hour = h; climate(); }, setWeather(w) { state.weather = w; climate(); },
    toggleWalk() { state.walk ? exitWalk() : enterWalk(); return state.walk; },
    zoom(f) { if (state.walk) { setFocal(clamp(state.mm / f, 14, 135)); return; } camera.position.sub(controls.target).multiplyScalar(f).add(controls.target); controls.update(); dirty = true; },
    params: [
      { id: 'ex', label: '地形起伏', min: 1, max: 3, step: 0.25, unit: '×', get: () => state.exaggeration, set: v => { state.exaggeration = v; later(() => reloadAll()); } },
      { id: 'hs', label: '推估樓高', min: 0.5, max: 2, step: 0.05, unit: '×', get: () => state.heightScale, set: v => { state.heightScale = v; later(() => reloadAll(true)); } },
      { id: 'rs', label: '路寬', min: 0.6, max: 1.6, step: 0.05, unit: '×', get: () => state.roadScale, set: v => { state.roadScale = v; later(() => reloadAll(true)); } },
      { id: 'det', label: '遠近細緻度', min: 0.5, max: 2, step: 0.25, unit: '×', get: () => state.detail, set: v => { state.detail = v; dirty = true; } },
    ],
    toggles: [
      toggle('clay', '白模檢視', '建物與地面改成單一白色，方便看量體與光影', 'clay', v => { fm.userData.uniforms.uClay.value = v ? 1 : 0; for (const m of terrainMats) { m.map = v ? null : m.userData.tex; m.color.set(v ? 0xd9d6cf : 0xffffff); m.needsUpdate = true; } reloadAll(true); }),
      toggle('trees', '樹木', '林地、公園與校園的樹', 'trees', v => { for (const t of tiles.values()) t.group?.traverse(o => { if (o.name === 'trees') o.visible = v; }); if (v) reloadAll(true); }),
      toggle('labels', '地名', '城鎮、山峰與車站名稱', 'labels', () => { dirty = true; }),
      toggle('pop', '紙雕彈起', '圖磚載入時建物與樹像立體書一樣從地面彈起', 'pop', v => { if (!v) for (const t of tiles.values()) popTimes(t, 0, false); }),
    ],
    actions: [
      { label: '重擲推估高度', title: '沒有 OSM 高度的建物換一組推估樓層', run: () => { state.seed = (state.seed % 9999) + 1; reloadAll(true); status(`種子 #${state.seed}：重擲近景建物的推估高度`); } },
      { label: '重播彈起', title: '近景建物與樹從焦點往外依序彈起（拍片開場用）', run: () => { replayPop(); status('紙雕彈起：從焦點往外依序彈起'); } },
      { label: '匯出 GLB', title: '下載目前近景（地形、建物、道路）的 3D 模型，可帶進 Blender 搭景', run: exportGLB },
    ],
  };
}
