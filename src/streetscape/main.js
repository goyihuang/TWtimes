// 現代街景引擎：任何有座標的地點，依 OpenStreetMap 自動生成可操作的 3D 街區。
// 作為「先有現代底稿，再逐步加入歷史年代」的基礎；場景 API 與臺南相同（docs/scene-contract.md）。
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { Post } from '../yuanshan/post.js';
import { cloudTex, rng, signTexture } from '../tainan/kit.js';
import { loadStreet } from './osm.js';
import { buildStreet } from './build.js';

const mmToFov = mm => 2 * Math.atan(12 / mm) * 180 / Math.PI;
function sunDir(hour, lat, decl = 8) {
  const L = lat * Math.PI / 180, d = decl * Math.PI / 180, H = (hour - 12) * 15 * Math.PI / 180;
  const E = Math.asin(Math.sin(L) * Math.sin(d) + Math.cos(L) * Math.cos(d) * Math.cos(H));
  let A = Math.acos(Math.max(-1, Math.min(1, (Math.sin(d) - Math.sin(E) * Math.sin(L)) / (Math.cos(E) * Math.cos(L))))); if (H > 0) A = 2 * Math.PI - A;
  return { v: new T.Vector3(Math.sin(A) * Math.cos(E), Math.sin(E), -Math.cos(A) * Math.cos(E)).normalize(), elev: E * 180 / Math.PI };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// place: { id, name, nameEn, city, lat, lng, summary }
export async function createStreetscape(canvas, ui = {}, place) {
  const status = ui.status || (() => { });
  const lowEnd = matchMedia('(max-width: 760px)').matches || (navigator.hardwareConcurrency || 8) <= 4;
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }); }
  catch (e) { status('此裝置無法啟用 WebGL，請開啟瀏覽器硬體加速後重新整理。'); throw e; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, lowEnd ? 1.25 : 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.85;
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(mmToFov(28), 1, 0.5, 8000);
  const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.495; controls.minDistance = 3; controls.maxDistance = 1600;
  const post = new Post(renderer, scene, camera, lowEnd ? 'low' : 'high');
  post.setGrade({ sat: 1.02, con: 1.05, warm: 0.12, sepia: 0, lift: 0.03, vig: 0.24, grain: 0.022, paper: 0, teal: 0.18 });

  // ── 天空、光源 ──
  const sky = new Sky(); sky.scale.setScalar(6000); scene.add(sky);
  const su = sky.material.uniforms;
  const sun = new T.DirectionalLight(0xfff1dc, 3); sun.castShadow = true; const sm = lowEnd ? 2048 : 4096; sun.shadow.mapSize.set(sm, sm);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06; scene.add(sun, sun.target);
  const hemi = new T.HemisphereLight(0xcfe0f2, 0x8a7a62, 0.6); scene.add(hemi);
  const pmrem = new T.PMREMGenerator(renderer), envScene = new T.Scene(), envSky = new Sky(); envSky.scale.setScalar(1000); envScene.add(envSky);
  let envRT = null;
  const clouds = new T.Mesh(new T.PlaneGeometry(8000, 8000), new T.MeshBasicMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.5 }));
  cloudTex.repeat.set(3, 3); clouds.rotation.x = Math.PI / 2; clouds.position.y = 900; scene.add(clouds);
  const RN = lowEnd ? 2500 : 6000, rainPos = new Float32Array(RN * 6), rr = rng(5);
  for (let i = 0; i < RN; i++) { const x = (rr() - 0.5) * 140, y = rr() * 60, z = (rr() - 0.5) * 140; rainPos.set([x, y, z, x + 0.05, y + 0.9, z + 0.03], i * 6); }
  const rainGeo = new T.BufferGeometry(); rainGeo.setAttribute('position', new T.BufferAttribute(rainPos, 3));
  const rain = new T.LineSegments(rainGeo, new T.LineBasicMaterial({ color: 0xc8d6de, transparent: true, opacity: 0.4, fog: false })); rain.frustumCulled = false; rain.visible = false; scene.add(rain);

  // ── 狀態（網址參數可還原）──
  const q = new URLSearchParams(location.search);
  const qn = (k, a, b, d) => { const v = Number(q.get(k)); return q.has(k) && Number.isFinite(v) ? clamp(v, a, b) : d; };
  const state = {
    era: 0, shot: 0, mm: 28, hour: qn('t', 0, 23.75, 15.5), weather: ['clear', 'cloudy', 'rain', 'fog'].includes(q.get('w')) ? q.get('w') : 'clear', walk: false, night: 0,
    seed: qn('seed', 1, 9999, 1) | 0, heightScale: qn('hs', 0.5, 2, 1), roadScale: qn('rs', 0.6, 1.6, 1), radius: qn('r', 150, 500, 350) | 0,
    clay: q.get('clay') === '1', trees: q.get('trees') !== '0', props: q.get('props') !== '0',
  };

  // ── 資料 ──
  status('準備街廓資料…');
  const data = await loadStreet({ id: place.id, lat: place.lat, lng: place.lng, radius: 500, status });
  let street = null;
  const pin = new T.Group(); scene.add(pin);
  function rebuild() {
    if (street) { scene.remove(street.root); street.dispose(); }
    street = buildStreet(data, { seed: state.seed, heightScale: state.heightScale, roadScale: state.roadScale, radius: state.radius, clay: state.clay, trees: state.trees, props: state.props });
    scene.add(street.root);
    const R = state.radius; Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 10, far: R * 4 }); sun.shadow.camera.updateProjectionMatrix();
    climate(); updateEvidence();
  }
  // 中心標記：景點名稱
  if (place.name) {
    const tex = signTexture(place.name, { w: 512, h: 128, font: '700 64px "Noto Serif TC", "Songti TC", serif', fg: '#fffdf5', bg: 'rgba(37,61,53,.88)' });
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false, transparent: true, fog: false })); sp.scale.set(0.22, 0.055, 1); sp.material.sizeAttenuation = false; sp.renderOrder = 10;
    const stem = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 1, 6), new T.MeshBasicMaterial({ color: 0xa34730, depthTest: false, transparent: true, opacity: 0.8 })); stem.renderOrder = 10;
    pin.add(sp, stem); pin.userData = { sp, stem };
  }

  function climate() {
    const { v, elev } = sunDir(state.hour, place.lat), w = state.weather;
    const day = T.MathUtils.smoothstep(elev, -6, 8), golden = 1 - T.MathUtils.smoothstep(elev, 4, 30);
    const overcast = w === 'rain' ? 1 : w === 'cloudy' ? 0.6 : w === 'fog' ? 0.5 : 0;
    state.night = 1 - day;
    for (const u of [su, envSky.material.uniforms]) {
      u.sunPosition.value.copy(v).multiplyScalar(1000); u.turbidity.value = 3 + overcast * 6;
      u.rayleigh.value = 1.2 + golden * 1.4 - overcast * 0.9; u.mieCoefficient.value = 0.004 + overcast * 0.004; u.mieDirectionalG.value = 0.78;
    }
    sun.color.setHSL(0.09 - golden * 0.04, 0.6 + golden * 0.3, 0.9 - golden * 0.18);
    sun.intensity = Math.max(0, day * (2.6 - golden * 0.7) * (1 - overcast * 0.82));
    const R = state.radius; sun.position.copy(v).multiplyScalar(R * 2); sun.target.position.set(0, 0, 0);
    hemi.intensity = 0.32 + day * (0.44 + overcast * 0.4); hemi.color.setHSL(0.58, 0.45 * day + 0.2, 0.55 + day * 0.25); hemi.groundColor.setHSL(0.09, 0.25, 0.18 + day * 0.28);
    if (!day) hemi.color.set(0x324a78);
    renderer.toneMappingExposure = 0.52 + day * 0.16 + (1 - day) * 0.36;
    const fogCol = new T.Color().setHSL(0.58 - golden * 0.5 * day, 0.15 + 0.1 * day, 0.08 + day * (0.62 - overcast * 0.12));
    if (golden > 0.5 && day > 0.2) fogCol.lerp(new T.Color(0xd9b48c), (golden - 0.5) * 0.6);
    if (day < 0.5) fogCol.lerp(new T.Color(0x0d1524), 1 - day * 2);
    if (w === 'fog') fogCol.lerp(new T.Color(0xc9ced0), day * 0.6);
    sky.visible = w !== 'fog' && w !== 'rain'; scene.background = sky.visible ? null : fogCol;
    const base = 0.24 / state.radius;
    scene.fog = new T.FogExp2(fogCol, w === 'fog' ? 0.006 : w === 'rain' ? 0.0042 : w === 'cloudy' ? base * 1.6 : base);
    clouds.material.opacity = (0.25 + overcast * 0.6) * (0.25 + day * 0.75); clouds.material.color.setHSL(0.6, 0.05, 0.25 + day * 0.7 - overcast * 0.25);
    street?.setNight(state.night); street?.setWet(w === 'rain' ? 1 : w === 'fog' ? 0.3 : 0);
    rain.visible = w === 'rain';
    post.bloom.strength = 0.08 + state.night * 0.32; post.bloom.threshold = 3.0 - state.night * 1.8; post.bloom.radius = 0.45;
    updateEnv();
  }
  let envTimer = 0; function updateEnv() { clearTimeout(envTimer); envTimer = setTimeout(() => { envRT?.dispose(); envRT = pmrem.fromScene(envScene, 0.02); scene.environment = envRT.texture; scene.environmentIntensity = 0.06 + (1 - state.night) * 0.24; }, 60); }

  // ── 鏡位 ──
  const shots = [{ name: '鳥瞰街區' }, { name: '斜俯近景' }, { name: '街口人眼' }, { name: '高空全景' }, { name: '頂樓視角' }];
  function shotPose(i) {
    const R = state.radius, e = street?.eye || [R * 0.2, R * 0.2];
    return [
      { pos: [R * 0.55, R * 0.58, R * 0.72], target: [0, 0, 0], mm: 28 },
      { pos: [-70, 62, 110], target: [0, 4, 0], mm: 35 },
      { pos: [e[0], 1.65, e[1]], target: [e[0] * 0.2, 8, e[1] * 0.2], mm: 24 },
      { pos: [0, R * 1.7, R * 0.55], target: [0, 0, 0], mm: 35 },
      { pos: [R * 0.18, Math.max(24, (street?.stats.tallest || 30) * 0.7), -R * 0.22], target: [0, 6, 0], mm: 24 },
    ][i];
  }
  function setFocal(mm) { state.mm = mm; camera.fov = mmToFov(mm); camera.updateProjectionMatrix(); }
  function setShot(i) { const s = shotPose(i); if (!s) return; exitWalk(); state.shot = i; camera.position.set(...s.pos); controls.target.set(...s.target); setFocal(s.mm); controls.update(); ui.onShot?.(i); }

  // ── 漫步（無碰撞，人眼高度）──
  const keys = new Set(); let yaw = 0, pitch = 0, drag = null, stick = null;
  function enterWalk() {
    state.walk = true; controls.enabled = false;
    const d = new T.Vector3().subVectors(controls.target, camera.position); yaw = Math.atan2(d.x, d.z); pitch = 0;
    if (camera.position.y > 3) { const e = street?.eye || [0, 30]; camera.position.set(e[0], 1.65, e[1]); yaw = Math.atan2(-e[0], -e[1]); }
    camera.position.y = 1.65; ui.onWalk?.(true);
  }
  function exitWalk() { if (!state.walk) return; state.walk = false; controls.enabled = true; controls.target.copy(camera.position).addScaledVector(new T.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), 12); controls.update(); ui.onWalk?.(false); }
  addEventListener('keydown', e => { if (state.walk && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) { keys.add(e.key.toLowerCase()); if (e.key.startsWith('Arrow')) e.preventDefault(); } });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  canvas.addEventListener('pointerdown', e => { if (!state.walk) return; canvas.setPointerCapture(e.pointerId); const r = canvas.getBoundingClientRect(); if (e.pointerType === 'touch' && e.clientX - r.left < r.width / 2) stick = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; else drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointermove', e => { if (stick && e.pointerId === stick.id) { stick.dx = (e.clientX - stick.x) / 60; stick.dy = (e.clientY - stick.y) / 60; } else if (drag && e.pointerId === drag.id) { yaw -= (e.clientX - drag.x) * 0.004; pitch = clamp(pitch - (e.clientY - drag.y) * 0.004, -1.2, 1.2); drag.x = e.clientX; drag.y = e.clientY; } });
  const endPtr = e => { if (stick?.id === e.pointerId) stick = null; if (drag?.id === e.pointerId) drag = null; };
  canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
  function walkStep(dt) {
    let f = 0, s = 0; const run = keys.has('shift') ? 2.5 : 1;
    if (keys.has('w') || keys.has('arrowup')) f += 1; if (keys.has('s') || keys.has('arrowdown')) f -= 1;
    if (keys.has('a')) s -= 1; if (keys.has('d')) s += 1;
    if (keys.has('arrowleft') || keys.has('q')) yaw += dt * 1.6; if (keys.has('arrowright') || keys.has('e')) yaw -= dt * 1.6;
    if (stick) { f -= clamp(stick.dy, -1, 1); s += clamp(stick.dx, -1, 1); }
    const sp = 4.5 * run * dt, fx = Math.sin(yaw), fz = Math.cos(yaw), R = state.radius * 1.3;
    const x = clamp(camera.position.x + (fx * f - fz * s) * sp, -R, R), z = clamp(camera.position.z + (fz * f + fx * s) * sp, -R, R);
    camera.position.set(x, 1.65, z);
    camera.lookAt(x + Math.sin(yaw) * Math.cos(pitch), 1.65 + Math.sin(pitch), z + Math.cos(yaw) * Math.cos(pitch));
  }

  // ── 渲染 ──
  function resize() { const { width, height } = canvas.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height, false); post.setSize(width, height, renderer.getPixelRatio()); camera.aspect = width / height; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(canvas); resize();
  const clock = new T.Clock(); let time = 0;
  function frame() {
    const dt = Math.min(0.05, clock.getDelta()); time += dt;
    if (state.walk) walkStep(dt); else controls.update();
    if (pin.userData.sp) { const h = clamp(camera.position.distanceTo(controls.target) * 0.12, 12, 70); pin.userData.sp.position.y = h + 3; pin.userData.stem.scale.y = h; pin.userData.stem.position.y = h / 2; pin.visible = !state.walk && !document.body.classList.contains('clean-view'); }
    if (rain.visible) { const p = rainGeo.attributes.position.array; for (let i = 0; i < p.length; i += 6) { p[i + 1] -= dt * 26; p[i + 4] -= dt * 26; if (p[i + 1] < 0) { p[i + 1] += 60; p[i + 4] += 60; } } rainGeo.attributes.position.needsUpdate = true; rain.position.set(camera.position.x, 0, camera.position.z); }
    cloudTex.offset.x += dt * 0.0015; post.grade.uniforms.uTime.value = time;
    post.composer.render(dt);
  }

  // ── 依據表、分享、匯出 ──
  const era = { id: 'now', year: '現況', name: (place.name || '自選地點') + '・現代街景', en: place.nameEn || 'MODERN STREETSCAPE', story: '', evidence: [] };
  function updateEvidence() {
    const s = street.stats, known = s.buildings - s.guessed;
    era.story = `依 OpenStreetMap 自動生成的現代街區底稿：半徑 ${state.radius} 公尺內 ${s.buildings} 棟建物、${s.trees} 棵樹。歷史年代尚未建模，之後依史料卡逐步加入。`;
    era.evidence = [
      ['道路、建物外框、水域與綠地', 'A', `OpenStreetMap（${data.how}${data.fetched ? '，資料日期 ' + data.fetched : ''}）`],
      ['建物高度', known / Math.max(1, s.buildings) > 0.5 ? 'B' : 'C', `${known} 棟取自 OSM 高度／樓層，${s.guessed} 棟依用途與面積推估（可用「重擲推估高度」換一組）`],
      ['立面、招牌、鐵窗、水塔、行道樹', 'C', '程序化示意，非實景'],
    ];
    ui.onEra?.(0);
  }
  function shareURL() {
    const u = new URL(location.href), p = camera.position, t = state.walk ? camera.position.clone().add(new T.Vector3(Math.sin(yaw) * 5, Math.sin(pitch) * 5, Math.cos(yaw) * 5)) : controls.target;
    const S = (k, v, d) => { if (v === d) u.searchParams.delete(k); else u.searchParams.set(k, v); };
    u.searchParams.set('place', 'osm'); S('t', state.hour, 15.5); S('w', state.weather, 'clear'); u.searchParams.set('mm', state.mm);
    S('seed', state.seed, 1); S('hs', state.heightScale, 1); S('rs', state.roadScale, 1); S('r', state.radius, 350); S('clay', state.clay ? '1' : '0', '0'); S('trees', state.trees ? '1' : '0', '1'); S('props', state.props ? '1' : '0', '1');
    u.searchParams.set('cam', [p.x, p.y, p.z, t.x, t.y, t.z].map(v => v.toFixed(1)).join(',')); if (state.walk) u.searchParams.set('walk', '1'); else u.searchParams.delete('walk'); u.searchParams.delete('shot');
    return u.href;
  }
  function snapshot() { post.composer.render(0); const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height; c.getContext('2d').drawImage(canvas, 0, 0); return c; }
  async function exportGLB() {
    status('匯出 GLB 中…');
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    const buf = await new GLTFExporter().parseAsync(street.root, { binary: true, onlyVisible: true });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'model/gltf-binary' })); a.download = `${place.id || 'streetscape'}-osm-${state.radius}m.glb`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    status('已匯出 GLB（街廓幾何，立面窗格為即時著色，不含在模型內）。資料 © OpenStreetMap contributors，發表時須標示。');
  }

  // ── 初始 ──
  rebuild();
  const shotQ = Number(q.get('shot')); setShot(Number.isInteger(shotQ) && shotQ >= 0 && shotQ < shots.length ? shotQ : 0);
  const cam = (q.get('cam') || '').split(',').map(Number);
  if (cam.length === 6 && cam.every(Number.isFinite)) { camera.position.set(cam[0], cam[1], cam[2]); controls.target.set(cam[3], cam[4], cam[5]); controls.update(); }
  if (Number(q.get('mm')) >= 14 && Number(q.get('mm')) <= 135) setFocal(Number(q.get('mm')));
  if (q.get('walk') === '1') enterWalk();
  renderer.setAnimationLoop(frame);
  const s = street.stats;
  status(`街廓：${data.source}・${data.how}｜${s.buildings} 棟建物（${s.guessed} 棟高度為推估）`);

  let rebuildTimer = 0; const later = () => { clearTimeout(rebuildTimer); rebuildTimer = setTimeout(rebuild, 160); };
  const toggle = (id, label, title, key) => ({ id, label, title, on: () => state[key], set: v => { state[key] = v; later(); } });
  return {
    renderer, scene, camera, controls, state, eras: [era], shots, data,
    get stats() { return street.stats; },
    walkHint: 'W A S D／方向鍵移動・拖曳轉向・Shift 快走｜手機：左半邊拖曳前進、右半邊轉向',
    weathers: { clear: '晴天', cloudy: '多雲', rain: '雨天', fog: '霧' },
    setEra() { ui.onEra?.(0); }, setShot, setFocal, snapshot, shareURL,
    setHour(h) { state.hour = h; climate(); }, setWeather(w) { state.weather = w; climate(); },
    toggleWalk() { state.walk ? exitWalk() : enterWalk(); return state.walk; },
    zoom(f) { if (state.walk) { setFocal(clamp(state.mm / f, 14, 135)); return; } camera.position.sub(controls.target).multiplyScalar(f).add(controls.target); controls.update(); },
    // 片場參數（共用面板的 params／actions）
    params: [
      { id: 'hs', label: '推估樓高', min: 0.5, max: 2, step: 0.05, unit: '×', get: () => state.heightScale, set: v => { state.heightScale = v; later(); } },
      { id: 'rs', label: '路寬', min: 0.6, max: 1.6, step: 0.05, unit: '×', get: () => state.roadScale, set: v => { state.roadScale = v; later(); } },
      { id: 'r', label: '範圍半徑', min: 150, max: 500, step: 10, unit: ' m', get: () => state.radius, set: v => { state.radius = v; later(); } },
    ],
    toggles: [toggle('clay', '白模檢視', '所有建物與地面改成單一白色，方便看量體與光影', 'clay'), toggle('trees', '樹木', '行道樹與公園樹', 'trees'), toggle('props', '街道道具', '頂樓水塔、加蓋鐵皮屋、路燈', 'props')],
    actions: [
      { label: '重擲推估高度', title: '沒有 OSM 高度的建物換一組推估樓層', run: () => { state.seed = (state.seed % 9999) + 1; rebuild(); status(`種子 #${state.seed}：已重擲 ${street.stats.guessed} 棟推估高度`); } },
      { label: '匯出 GLB', title: '下載目前街廓的 3D 模型，可帶進 Blender 搭景', run: exportGLB },
    ],
  };
}
