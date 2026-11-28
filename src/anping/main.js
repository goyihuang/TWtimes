// 安平・大員：四年代立體街景引擎（Three.js）。光影、天氣、轉場、漫步與分享沿用臺南引擎的做法（docs/art-direction.md 第 3 節）。
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { Post } from '../yuanshan/post.js';
import { createEraGrow, TRANSITION } from '../shared/era-grow.js';
import { OSM_CREDIT } from '../shared/credits.js';
import { cloudTex, rng } from '../tainan/kit.js';
import { ERAS, SHOTS, mmToFov } from './eras.js';
import { buildEra, inPoly } from './world.js';

const LAT = 23.0015 * Math.PI / 180;
// 太陽方向：場景座標 x 向東、z 向南
function sunDir(hour, decl = 8) {
  const d = decl * Math.PI / 180, H = (hour - 12) * 15 * Math.PI / 180;
  const E = Math.asin(Math.sin(LAT) * Math.sin(d) + Math.cos(LAT) * Math.cos(d) * Math.cos(H));
  let A = Math.acos(Math.max(-1, Math.min(1, (Math.sin(d) - Math.sin(E) * Math.sin(LAT)) / (Math.cos(E) * Math.cos(LAT))))); if (H > 0) A = 2 * Math.PI - A;
  return { v: new T.Vector3(Math.sin(A) * Math.cos(E), Math.sin(E), -Math.cos(A) * Math.cos(E)).normalize(), elev: E * 180 / Math.PI };
}

export async function createAnping(canvas, ui = {}) {
  const status = ui.status || (() => {});
  const lowEnd = matchMedia('(max-width: 760px)').matches || (navigator.hardwareConcurrency || 8) <= 4;
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }); }
  catch (e) { status('此裝置無法啟用 WebGL，請開啟瀏覽器硬體加速後重新整理。'); throw e; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, lowEnd ? 1.25 : 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.85;
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(mmToFov(35), 1, 0.3, 8000);
  const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.495; controls.minDistance = 2; controls.maxDistance = 1400;
  const post = new Post(renderer, scene, camera, lowEnd ? 'low' : 'high');

  const sky = new Sky(); sky.scale.setScalar(6000); scene.add(sky);
  const su = sky.material.uniforms;
  const sun = new T.DirectionalLight(0xfff1dc, 3); sun.castShadow = true; sun.shadow.mapSize.set(lowEnd ? 2048 : 4096, lowEnd ? 2048 : 4096);
  Object.assign(sun.shadow.camera, { left: -260, right: 260, top: 260, bottom: -260, near: 10, far: 1400 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.06;
  scene.add(sun, sun.target);
  const hemi = new T.HemisphereLight(0xcfe0f2, 0x8a7a62, 0.6); scene.add(hemi);
  const pmrem = new T.PMREMGenerator(renderer); const envScene = new T.Scene(); const envSky = new Sky(); envSky.scale.setScalar(1000); envScene.add(envSky);
  let envRT = null;
  const clouds = new T.Mesh(new T.PlaneGeometry(8000, 8000), new T.MeshBasicMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.5 }));
  cloudTex.repeat.set(3, 3); clouds.rotation.x = Math.PI / 2; clouds.position.y = 800; scene.add(clouds);
  // 夜間暖光：城門前廣場與平臺／老街（真實光源，數量受限）
  const lamps = [[95, 6, 5, 60], [190, 5, 80, 50], [300, 5, 115, 50], [10, 18, -8, 70]].map(([x, y, z, d]) => { const l = new T.PointLight(0xffc98a, 0, d, 1.6); l.position.set(x, y, z); scene.add(l); return l; });

  const RN = lowEnd ? 2500 : 6000, rainPos = new Float32Array(RN * 6), rr = rng(5);
  for (let i = 0; i < RN; i++) { const x = (rr() - 0.5) * 140, y = rr() * 60, z = (rr() - 0.5) * 140; rainPos.set([x, y, z, x + 0.05, y + 0.9, z + 0.03], i * 6); }
  const rainGeo = new T.BufferGeometry(); rainGeo.setAttribute('position', new T.BufferAttribute(rainPos, 3));
  const rain = new T.LineSegments(rainGeo, new T.LineBasicMaterial({ color: 0xc8d6de, transparent: true, opacity: 0.42, fog: false })); rain.frustumCulled = false; rain.visible = false; scene.add(rain);

  status('載入街廓資料…');
  const osmData = await fetch('data/anping.osm.json').then(r => r.json()).catch(() => null);
  const osm = osmData?.ways || null;
  const eras = ERAS.map(era => { const s = buildEra(era, osm); s.group.visible = false; scene.add(s.group); return s; });

  const state = { era: 0, hour: 15.5, weather: 'clear', mm: 35, walk: false, night: 0, shot: 0 };
  let fade = 0, fadeTarget = 0, pendingEra = null;
  function applyEra(i) { eras.forEach((e, j) => e.group.visible = j === i); state.era = i; post.setGrade(ERAS[i].grade); climate(); ui.onEra?.(i); }
  // 年代轉場（共用設定 TRANSITION：建物長出／淡出淡入／直接切換），鏡頭不動
  const grow = createEraGrow(T);
  function setEra(i, animate = true) {
    i = Math.max(0, Math.min(ERAS.length - 1, i | 0));
    if (!animate || i === state.era || TRANSITION.mode === 'cut') { grow.finish(); applyEra(i); return; }
    if (TRANSITION.mode === 'fade') { grow.finish(); pendingEra = i; fadeTarget = 1; return; }
    const from = eras[state.era].group; applyEra(i);
    grow.start(from, eras[i].group, state.walk ? camera.position : controls.target);
  }

  function climate() {
    const { v, elev } = sunDir(state.hour), w = state.weather;
    const day = T.MathUtils.smoothstep(elev, -6, 8), golden = 1 - T.MathUtils.smoothstep(elev, 4, 30);
    const overcast = w === 'rain' ? 1 : w === 'cloudy' ? 0.6 : w === 'fog' ? 0.5 : 0;
    state.night = 1 - day;
    for (const u of [su, envSky.material.uniforms]) { u.sunPosition.value.copy(v).multiplyScalar(1000); u.turbidity.value = 3 + overcast * 6; u.rayleigh.value = 1.2 + golden * 1.4 - overcast * 0.9; u.mieCoefficient.value = 0.004 + overcast * 0.004; u.mieDirectionalG.value = 0.78; }
    sun.color.setHSL(0.09 - golden * 0.04, 0.6 + golden * 0.3, 0.9 - golden * 0.18); sun.intensity = Math.max(0, day * (2.5 - golden * 0.7) * (1 - overcast * 0.82));
    const focus = new T.Vector3(controls.target.x, 0, controls.target.z); sun.position.copy(v).multiplyScalar(600).add(focus); sun.target.position.copy(focus);
    hemi.intensity = 0.3 - day * 0.2 + day * (0.3 + overcast * 0.55); /* 夜間保留月光，城堡輪廓仍可辨 */ hemi.color.setHSL(0.58, 0.45 * day + 0.2, 0.55 + day * 0.25); hemi.groundColor.setHSL(0.09, 0.25, 0.18 + day * 0.28); if (!day) hemi.color.set(0x324a78);
    renderer.toneMappingExposure = 0.6 + day * 0.18 + (1 - day) * 0.3;
    const fogCol = new T.Color().setHSL(0.58 - golden * 0.5 * day, 0.15 + 0.1 * day, 0.08 + day * (0.62 - overcast * 0.12));
    if (golden > 0.5 && day > 0.2) fogCol.lerp(new T.Color(0xd9b48c), (golden - 0.5) * 0.6);
    if (day < 0.5) fogCol.lerp(new T.Color(0x0d1524), 1 - day * 2);
    if (w === 'fog') fogCol.lerp(new T.Color(0xc9ced0), day * 0.6);
    sky.visible = w !== 'fog' && w !== 'rain'; scene.background = sky.visible ? null : fogCol;
    // 場景尺度約為臺南的 3 倍，霧濃度依規範按比例調低
    scene.fog = new T.FogExp2(fogCol, w === 'fog' ? 0.0042 : w === 'rain' ? 0.0028 : w === 'cloudy' ? 0.0009 : 0.00045);
    clouds.material.opacity = (0.25 + overcast * 0.6) * (0.25 + day * 0.75); clouds.material.color.setHSL(0.6, 0.05, 0.25 + day * 0.7 - overcast * 0.25);
    const n = state.night, e = eras[state.era];
    for (const { m, k, kind } of e.nightMats) m.emissiveIntensity = kind === 'window' ? n * k * (0.55 + 0.45 * overcast) : n * k;
    lamps.forEach((l, i) => l.intensity = n * (i === 3 ? 60 : 30) * (ERAS[state.era].kind === 'ruin' ? 0.15 : 1));
    const wet = w === 'rain' ? 1 : w === 'fog' ? 0.3 : 0;
    for (const { m, rough, color } of e.wetMats) { m.roughness = rough * (1 - wet * 0.7); m.color.copy(color).multiplyScalar(1 - wet * 0.3); }
    rain.visible = w === 'rain';
    // 開闊天際線的 HDR 天空在白天會讓光暈把整幅畫面泛白，光暈只在夜間開
    post.bloom.strength = n * 0.34; post.bloom.threshold = 3.0 - n * 1.6; post.bloom.radius = 0.45; post.grade.uniforms.uSunVis.value = 0;
    updateEnv();
  }
  let envTimer = 0; function updateEnv() { clearTimeout(envTimer); envTimer = setTimeout(() => { envRT?.dispose(); envRT = pmrem.fromScene(envScene, 0.02); scene.environment = envRT.texture; scene.environmentIntensity = 0.09 + (1 - state.night) * 0.1; }, 60); }

  function setFocal(mm) { state.mm = mm; camera.fov = mmToFov(mm); camera.updateProjectionMatrix(); }
  function setShot(i) { const s = SHOTS[i]; if (!s) return; exitWalk(); state.shot = i; camera.position.set(...s.pos); controls.target.set(...s.target); setFocal(s.mm); controls.update(); climate(); ui.onShot?.(i); }

  // ── 漫步：可走上城堡平臺（地面高度依所在多邊形），塔不可穿越 ──
  const keys = new Set(); let yaw = 0, pitch = 0, drag = null, stick = null;
  function groundAt(x, z) { let h = 0; for (const s of eras[state.era].solids) if (s.poly && inPoly([x, z], s.poly)) h = Math.max(h, s.h); return h; }
  function enterWalk() {
    state.walk = true; controls.enabled = false;
    const d = new T.Vector3().subVectors(controls.target, camera.position); yaw = Math.atan2(d.x, d.z); pitch = 0;
    if (camera.position.y > 3 + groundAt(camera.position.x, camera.position.z)) { const back = new T.Vector3(camera.position.x - controls.target.x, 0, camera.position.z - controls.target.z), L = back.length(); const p = controls.target.clone().addScaledVector(back.normalize(), Math.min(80, L * 0.6)); const fd = Math.hypot(p.x - 3, p.z + 8); if (fd < 78 && !groundAt(p.x, p.z)) { p.x = 3 + (p.x - 3) / fd * 78; p.z = -8 + (p.z + 8) / fd * 78; } camera.position.set(p.x, 0, p.z); yaw = Math.atan2(controls.target.x - p.x, controls.target.z - p.z); /* 從空中進入漫步：落在鏡頭與焦點之間、城牆外，面向焦點 */ }
    camera.position.y = groundAt(camera.position.x, camera.position.z) + 1.7; ui.onWalk?.(true);
  }
  function exitWalk() { if (!state.walk) return; state.walk = false; controls.enabled = true; const f = new T.Vector3(Math.sin(yaw), 0, Math.cos(yaw)); controls.target.copy(camera.position).addScaledVector(f, 12); controls.update(); ui.onWalk?.(false); }
  addEventListener('keydown', e => { if (state.walk && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) { keys.add(e.key.toLowerCase()); if (e.key.startsWith('Arrow')) e.preventDefault(); } });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  canvas.addEventListener('pointerdown', e => { if (!state.walk) return; canvas.setPointerCapture(e.pointerId); const r = canvas.getBoundingClientRect(); if (e.pointerType === 'touch' && e.clientX - r.left < r.width / 2) stick = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; else drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointermove', e => { if (stick && e.pointerId === stick.id) { stick.dx = (e.clientX - stick.x) / 60; stick.dy = (e.clientY - stick.y) / 60; } else if (drag && e.pointerId === drag.id) { yaw -= (e.clientX - drag.x) * 0.004; pitch = Math.max(-1.2, Math.min(1.2, pitch - (e.clientY - drag.y) * 0.004)); drag.x = e.clientX; drag.y = e.clientY; } });
  const endPtr = e => { if (stick?.id === e.pointerId) stick = null; if (drag?.id === e.pointerId) drag = null; };
  canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
  function walkStep(dt) {
    let f = 0, s = 0; const run = keys.has('shift') ? 2.4 : 1;
    if (keys.has('w') || keys.has('arrowup')) f += 1; if (keys.has('s') || keys.has('arrowdown')) f -= 1;
    if (keys.has('a')) s -= 1; if (keys.has('d')) s += 1;
    if (keys.has('arrowleft') || keys.has('q')) yaw += dt * 1.6; if (keys.has('arrowright') || keys.has('e')) yaw -= dt * 1.6;
    if (stick) { f -= Math.max(-1, Math.min(1, stick.dy)); s += Math.max(-1, Math.min(1, stick.dx)); }
    const sp = 4.4 * run * dt, fx = Math.sin(yaw), fz = Math.cos(yaw);
    let x = camera.position.x + (fx * f - fz * s) * sp, z = camera.position.z + (fz * f + fx * s) * sp;
    for (const so of eras[state.era].solids) if (so.circle) { const [cx, cz, rad] = so.circle, d = Math.hypot(x - cx, z - cz); if (d < rad) { x = cx + (x - cx) / d * rad; z = cz + (z - cz) / d * rad; } }
    x = Math.max(-600, Math.min(800, x)); z = Math.max(-500, Math.min(600, z));
    const gy = groundAt(x, z) + 1.7; camera.position.set(x, camera.position.y + (gy - camera.position.y) * Math.min(1, dt * 5), z);
    camera.lookAt(x + Math.sin(yaw) * Math.cos(pitch), camera.position.y + Math.sin(pitch), z + Math.cos(yaw) * Math.cos(pitch));
  }

  function resize() { const { width, height } = canvas.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height, false); post.setSize(width, height, renderer.getPixelRatio()); camera.aspect = width / height; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(canvas); resize();
  const clock = new T.Clock(); let time = 0, lastFocus = new T.Vector3();
  function frame() {
    const dt = Math.min(0.05, clock.getDelta()); time += dt;
    if (state.walk) walkStep(dt); else controls.update();
    const focus = state.walk ? camera.position : controls.target; if (focus.distanceTo(lastFocus) > 40) { lastFocus.copy(focus); const { v } = sunDir(state.hour); const f = new T.Vector3(focus.x, 0, focus.z); sun.position.copy(v).multiplyScalar(600).add(f); sun.target.position.copy(f); }
    if (fadeTarget !== fade) { fade += Math.sign(fadeTarget - fade) * Math.min(Math.abs(fadeTarget - fade), dt * 2.4 / TRANSITION.seconds * 4); if (fade >= 1 && pendingEra !== null) { applyEra(pendingEra); pendingEra = null; fadeTarget = 0; } }
    grow.update(dt);
    post.grade.uniforms.uFade.value = fade * 0.92; post.grade.uniforms.uTime.value = time;
    for (const m of eras[state.era].movers) m(dt, time);
    if (rain.visible) { const p = rainGeo.attributes.position.array; for (let i = 0; i < p.length; i += 6) { p[i + 1] -= dt * 26; p[i + 4] -= dt * 26; if (p[i + 1] < 0) { p[i + 1] += 60; p[i + 4] += 60; } } rainGeo.attributes.position.needsUpdate = true; rain.position.set(camera.position.x, 0, camera.position.z); }
    cloudTex.offset.x += dt * 0.0015;
    post.composer.render(dt);
  }
  renderer.setAnimationLoop(frame);

  function snapshot() { grow.finish(); post.composer.render(0); const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height; c.getContext('2d').drawImage(canvas, 0, 0); return c; }
  function compare(other) {
    grow.finish(); const cur = state.era; other = other ?? (cur === ERAS.length - 1 ? 0 : ERAS.length - 1);
    const fadeWas = post.grade.uniforms.uFade.value; post.grade.uniforms.uFade.value = 0;
    const a = snapshot(); applyEra(other); const b = snapshot(); applyEra(cur); post.grade.uniforms.uFade.value = fadeWas;
    const W = a.width, H = a.height, out = document.createElement('canvas'); out.width = W * 2 + 12; out.height = H + 64; const g = out.getContext('2d');
    g.fillStyle = '#20342d'; g.fillRect(0, 0, out.width, out.height); g.drawImage(a, 0, 0); g.drawImage(b, W + 12, 0);
    g.fillStyle = '#f3ead6'; g.font = `600 ${Math.round(H * 0.035)}px serif`; g.fillText(`${ERAS[cur].year} ${ERAS[cur].name}`, 20, H + 42); g.fillText(`${ERAS[other].year} ${ERAS[other].name}`, W + 32, H + 42);
    g.textAlign = 'right'; g.font = `${Math.round(H * 0.022)}px sans-serif`; g.fillText('今昔街影・安平大員　歷史數位重建，非原始影像', out.width - 20, H + 42);
    return { canvas: out, title: `${ERAS[cur].year} ↔ ${ERAS[other].year} · 安平大員` };
  }
  function shareURL() {
    const u = new URL(location.href); const p = camera.position, t = state.walk ? camera.position.clone().add(new T.Vector3(Math.sin(yaw) * 5, Math.sin(pitch) * 5, Math.cos(yaw) * 5)) : controls.target;
    u.searchParams.set('place', 'anping'); u.searchParams.set('era', ERAS[state.era].id); u.searchParams.set('t', state.hour); u.searchParams.set('w', state.weather); u.searchParams.set('mm', state.mm);
    u.searchParams.set('cam', [p.x, p.y, p.z, t.x, t.y, t.z].map(v => v.toFixed(1)).join(',')); if (state.walk) u.searchParams.set('walk', '1'); else u.searchParams.delete('walk'); u.searchParams.delete('shot');
    return u.href;
  }

  const q = new URLSearchParams(location.search);
  const ei = ERAS.findIndex(e => e.id === q.get('era')); state.era = ei >= 0 ? ei : 0;
  if (q.has('t') && Number.isFinite(+q.get('t'))) state.hour = Math.max(0, Math.min(23.75, +q.get('t')));
  if (['clear', 'cloudy', 'rain', 'fog'].includes(q.get('w'))) state.weather = q.get('w');
  const shotQ = Number(q.get('shot')); setShot(Number.isInteger(shotQ) && shotQ >= 0 && shotQ < SHOTS.length ? shotQ : 0);
  const cam = (q.get('cam') || '').split(',').map(Number);
  if (cam.length === 6 && cam.every(Number.isFinite)) { camera.position.set(cam[0], cam[1], cam[2]); controls.target.set(cam[3], cam[4], cam[5]); controls.update(); }
  if (Number(q.get('mm')) >= 14 && Number(q.get('mm')) <= 135) setFocal(Number(q.get('mm')));
  applyEra(state.era);
  if (q.get('walk') === '1') enterWalk();
  status(osm ? `城堡與市鎮：成大疊圖描線、以外堡南牆校正｜現況：${osmData.source}（${osmData.fetched}）` : 'OSM 街廓未載入，現代年代只顯示平臺');

  return {
    renderer, scene, camera, controls, post, eras: ERAS, shots: SHOTS, state, THREE: T, grow, credits: ['街廓 ' + OSM_CREDIT],
    transitions: ['grow', 'fade', 'cut'], exportRoot: () => eras[state.era].group,
    walkHint: 'W A S D／方向鍵移動・拖曳轉向・Shift 快走｜可走上城堡平臺｜手機：左半邊拖曳前進、右半邊轉向',
    weathers: { clear: '晴天', cloudy: '多雲', rain: '雨天', fog: '海霧' },
    setEra, setShot, setFocal, compare, snapshot, shareURL,
    setHour(h) { state.hour = h; climate(); }, setWeather(w) { state.weather = w; climate(); },
    toggleWalk() { state.walk ? exitWalk() : enterWalk(); return state.walk; },
    zoom(f) { if (state.walk) { setFocal(Math.max(14, Math.min(135, state.mm / f))); return; } camera.position.sub(controls.target).multiplyScalar(f).add(controls.target); controls.update(); },
  };
}
