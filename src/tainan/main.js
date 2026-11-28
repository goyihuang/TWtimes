// 臺南驛前：五年代立體街景引擎（Three.js）。UI 由 platform.js 接到首頁共用框架。
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { Post } from '../yuanshan/post.js';
import { createEraGrow, TRANSITION } from '../shared/era-grow.js';
import { OSM_CREDIT } from '../shared/credits.js';
import { ERAS, SHOTS, mmToFov } from './eras.js';
import { loadOSM } from './osm.js';
import { buildEra, PLATFORMS } from './scenery.js';
import { signTexture, canvasTex, cloudTex, rng } from './kit.js';

const LAT = 22.997 * Math.PI / 180, ANG = Math.atan2(84 * 111320 * Math.cos(LAT), 452 * 110540);
// 太陽方向（本地座標）：hour 為當地時刻，decl 太陽赤緯（度）
function sunDir(hour, decl = 8) {
  const d = decl * Math.PI / 180, H = (hour - 12) * 15 * Math.PI / 180;
  const sinE = Math.sin(LAT) * Math.sin(d) + Math.cos(LAT) * Math.cos(d) * Math.cos(H), E = Math.asin(sinE);
  let A = Math.acos(Math.max(-1, Math.min(1, (Math.sin(d) - Math.sin(E) * Math.sin(LAT)) / (Math.cos(E) * Math.cos(LAT))))); if (H > 0) A = 2 * Math.PI - A;
  const de = Math.sin(A) * Math.cos(E), dn = Math.cos(A) * Math.cos(E);
  return { v: new T.Vector3(-dn * Math.cos(ANG) - de * Math.sin(ANG), Math.sin(E), dn * Math.sin(ANG) - de * Math.cos(ANG)).normalize(), elev: E * 180 / Math.PI };
}
// 站房、門廊與兩翼的碰撞盒（漫步模式）
const SOLIDS = [[-27, 24.2, -17.3, 14.3], [-13.8, 5.8, 14, 23], [-37, 32.5, -6.5, 6.5], [-180, 180, -21.2, -17.2]];

export async function createTainan(canvas, ui = {}) {
  const status = ui.status || (() => {});
  const lowEnd = matchMedia('(max-width: 760px)').matches || (navigator.hardwareConcurrency || 8) <= 4;
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }); }
  catch (e) { status('此裝置無法啟用 WebGL，請開啟瀏覽器硬體加速後重新整理。'); throw e; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, lowEnd ? 1.25 : 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(mmToFov(35), 1, 0.3, 6000);
  const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.495; controls.minDistance = 2; controls.maxDistance = 900;
  const post = new Post(renderer, scene, camera, lowEnd ? 'low' : 'high');

  // ── 天空、光源、雲 ──
  const sky = new Sky(); sky.scale.setScalar(5000); scene.add(sky);
  const su = sky.material.uniforms; su.mieDirectionalG.value = 0.8;
  const sun = new T.DirectionalLight(0xfff1dc, 3); sun.castShadow = true; sun.shadow.mapSize.set(lowEnd ? 2048 : 4096, lowEnd ? 2048 : 4096);
  Object.assign(sun.shadow.camera, { left: -140, right: 140, top: 140, bottom: -140, near: 10, far: 900 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const hemi = new T.HemisphereLight(0xcfe0f2, 0x8a7a62, 0.6); scene.add(hemi);
  const pmrem = new T.PMREMGenerator(renderer); const envScene = new T.Scene(); const envSky = new Sky(); envSky.scale.setScalar(1000); envScene.add(envSky);
  let envRT = null;
  const clouds = new T.Mesh(new T.PlaneGeometry(6000, 6000), new T.MeshBasicMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.5 }));
  cloudTex.repeat.set(3, 3); clouds.rotation.x = Math.PI / 2; clouds.position.y = 700; scene.add(clouds);
  // 夜間站前暖光（真實光源，數量受限以顧效能）
  const porchLights = [[-4, 4.2, 24.5, 30], [-14, 4, 26, 18], [6, 4, 26, 18], [-4, 9.5, 40, 40]].map(([x, y, z, d]) => { const l = new T.PointLight(0xffc98a, 0, d, 1.6); l.position.set(x, y, z); scene.add(l); return l; });

  // ── 雨 ──
  const RN = lowEnd ? 2500 : 6000, rainPos = new Float32Array(RN * 6), rr = rng(5);
  for (let i = 0; i < RN; i++) { const x = (rr() - 0.5) * 120, y = rr() * 50, z = (rr() - 0.5) * 120; rainPos.set([x, y, z, x + 0.05, y + 0.9, z + 0.03], i * 6); }
  const rainGeo = new T.BufferGeometry(); rainGeo.setAttribute('position', new T.BufferAttribute(rainPos, 3));
  const rain = new T.LineSegments(rainGeo, new T.LineBasicMaterial({ color: 0xc8d6de, transparent: true, opacity: 0.42, fog: false })); rain.frustumCulled = false; rain.visible = false; scene.add(rain);

  // ── 資產 ──
  status('載入站房模型與街廓資料…');
  const gltf = new GLTFLoader(); const load = f => gltf.loadAsync('models/' + f).then(x => x.scene).catch(() => null);
  const [m1936, m1900, canopy, osm] = await Promise.all([load('tainan-1936.glb'), load('tainan-1900.glb'), load('tainan-canopy.glb'), loadOSM().catch(() => null)]);
  const warn = [];
  if (!m1936 || !m1900) warn.push('站房模型未載入');
  if (!osm) warn.push('OSM 街廓未載入，周邊以空地顯示');
  if (canopy) canopy.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });

  const glassMats = [], stationWet = [], clockFaces = [];
  function stationFor(era) {
    const src = era.station === '1900' ? m1900 : m1936; if (!src) return new T.Group();
    const s = src.clone(true); const swap = new Map();
    s.traverse(o => {
      if (!o.isMesh) return; o.castShadow = o.receiveShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const out = mats.map(m => {
        if (!swap.has(m)) {
          const c = m.clone();
          if (c.name === 'tn_tile' && era.skin === 'paint') { c.color.set(era.id === '1970' ? 0xe9e3d2 : 0xf1efe8); c.map = null; c.roughness = 0.82; }
          if (c.name === 'tn_trim' && era.skin === 'paint') c.color.set(0xf6f4ee);
          if (c.name === 'tn_plinth' && era.skin === 'paint') c.color.set(era.id === '1970' ? 0xbab3a2 : 0xd2cfc6);
          if (/glass/.test(c.name)) { c.emissive = new T.Color(0xffc887); c.emissiveMap = c.map; c.emissiveIntensity = 0; c.envMapIntensity = 1.4; glassMats.push(c); }
          if (/tile|trim|plinth|kawara|roof/.test(c.name)) stationWet.push({ m: c, rough: c.roughness, color: c.color.clone() });
          swap.set(m, c);
        }
        return swap.get(m);
      });
      o.material = Array.isArray(o.material) ? out : out[0];
    });
    const grp = new T.Group(); grp.add(s);
    if (era.sign === '1970') {
      const b = new T.Mesh(new T.BoxGeometry(13, 1.9, 0.3), new T.MeshStandardMaterial({ map: signTexture('臺南車站', { w: 1024, h: 150, font: '900 120px serif', fg: '#9b1c1c', bg: '#f3efe3' }), roughness: 0.6 }));
      b.position.set(-4, 16.0, 14.4); grp.add(b);
    }
    if (era.sign === '2019') {
      const chars = ['台', '南', '車', '站'];
      chars.forEach((ch, i) => { const m = new T.Mesh(new T.BoxGeometry(2.2, 2.2, 0.5), new T.MeshStandardMaterial({ map: signTexture(ch, { fg: '#1f4fa8' }), emissiveMap: signTexture(ch, { fg: '#1f4fa8' }), emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.5 })); m.position.set(-4 + (i - 1.5) * 5.6, 16.6, 13.6); grp.add(m); glassMats.push(m.material); m.material.userData.sign = true; });
      const logo = new T.Mesh(new T.BoxGeometry(1.9, 1.9, 0.5), new T.MeshStandardMaterial({ map: signTexture('㊣', { fg: '#1f4fa8', font: '900 150px sans-serif' }) })); logo.position.set(-17.2, 16.4, 13.6); grp.add(logo);
      const en = new T.Mesh(new T.BoxGeometry(3.2, 1.6, 0.5), new T.MeshStandardMaterial({ map: signTexture('TAINAN STATION', { w: 512, h: 256, fg: '#1f4fa8', font: '900 64px sans-serif' }) })); en.position.set(9.2, 16.3, 13.6); grp.add(en);
      const clkTex = canvasTex(256, 96, () => {}); clockFaces.push(clkTex);
      const clk = new T.Mesh(new T.BoxGeometry(4.8, 1.6, 0.6), new T.MeshStandardMaterial({ color: 0x111111, emissive: 0xff3a2a, emissiveIntensity: 0.8, emissiveMap: clkTex }));
      clk.position.set(-4, 12.6, 14.9); grp.add(clk);
      const pole = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 6), new T.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.7 })); pole.position.set(-4, 18, 8); grp.add(pole);
    }
    if (era.scaffold) grp.add(scaffold());
    return grp;
  }
  function scaffold() {
    // 修復停擺期間的鷹架與帆布（依 2024 新聞稿照片：主體包覆、門廊外露）
    const g = new T.Group(), parts = [], pole = new T.CylinderGeometry(0.05, 0.05, 1, 6);
    const boxes = [[-20.4, 12.4, -17.9, 14.9, 16.6], [12.4, 24.9, -17.9, 6.3, 12.2], [-27.6, -20.4, -17.9, 3.1, 12.2]];
    const sheetTex = canvasTex(256, 256, (c) => { c.fillStyle = '#eef0ee'; c.fillRect(0, 0, 256, 256); c.strokeStyle = 'rgba(120,130,130,.45)'; c.lineWidth = 2; for (let k = 0; k <= 256; k += 32) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k, 256); c.moveTo(0, k); c.lineTo(256, k); c.stroke(); } });
    sheetTex.repeat.set(1, 1);
    const sheet = new T.MeshStandardMaterial({ map: sheetTex, transparent: true, opacity: 0.86, roughness: 0.6, side: T.DoubleSide });
    const ms = [];
    for (const [x0, x1, z0, z1, h] of boxes) {
      for (const [ax, az, bx, bz] of [[x0, z1, x1, z1], [x1, z0, x1, z1], [x0, z0, x0, z1], [x0, z0, x1, z0]]) {
        const L = Math.hypot(bx - ax, bz - az), n = Math.round(L / 1.8);
        for (let k = 0; k <= n; k++) { const t = k / n; ms.push(new T.Matrix4().compose(new T.Vector3(ax + (bx - ax) * t, h / 2, az + (bz - az) * t), new T.Quaternion(), new T.Vector3(1, h, 1))); }
        const p = new T.Mesh(new T.PlaneGeometry(L, h - 2.6), sheet); p.position.set((ax + bx) / 2, 2.6 + (h - 2.6) / 2, (az + bz) / 2); p.rotation.y = Math.atan2(-(bz - az), bx - ax); p.castShadow = true; g.add(p);
        sheet.map.repeat.set(L / 4, h / 4);
        const tin = new T.Mesh(new T.PlaneGeometry(L, 2.6), new T.MeshStandardMaterial({ color: 0x8fa3a0, metalness: 0.5, roughness: 0.5, side: T.DoubleSide })); tin.position.set((ax + bx) / 2, 1.3, (az + bz) / 2); tin.rotation.y = p.rotation.y; tin.castShadow = true; g.add(tin);
      }
    }
    const im = new T.InstancedMesh(pole, new T.MeshStandardMaterial({ color: 0x7d8486, metalness: 0.7, roughness: 0.4 }), ms.length); ms.forEach((m, i) => im.setMatrixAt(i, m)); g.add(im);
    return g;
  }

  // ── 年代群組 ──
  const eras = ERAS.map(era => {
    const s = buildEra(era, osm, { canopy });
    const st = stationFor(era); s.group.add(st); s.group.visible = false; scene.add(s.group); return s;
  });

  // ── 狀態 ──
  const state = { era: 1, hour: 15.5, weather: 'clear', mm: 35, walk: false, night: 0 };
  let fade = 0, fadeTarget = 0, pendingEra = null;
  function applyEra(i) {
    eras.forEach((e, j) => e.group.visible = j === i); state.era = i;
    post.setGrade(ERAS[i].grade); climate(); ui.onEra?.(i);
  }
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
    // 天空
    for (const u of [su, envSky.material.uniforms]) {
      u.sunPosition.value.copy(v).multiplyScalar(1000); u.turbidity.value = 3 + overcast * 6;
      u.rayleigh.value = 1.2 + golden * 1.4 - overcast * 0.9; u.mieCoefficient.value = 0.004 + overcast * 0.004; u.mieDirectionalG.value = 0.78;
    }
    // 光源
    const sunCol = new T.Color().setHSL(0.09 - golden * 0.04, 0.6 + golden * 0.3, 0.9 - golden * 0.18);
    sun.color.copy(sunCol); sun.intensity = Math.max(0, day * (2.5 - golden * 0.7) * (1 - overcast * 0.82));
    sun.position.copy(v).multiplyScalar(400).add(new T.Vector3(-4, 0, 10)); sun.target.position.set(-4, 0, 10);
    hemi.intensity = 0.1 + day * (0.3 + overcast * 0.55); hemi.color.setHSL(0.58, 0.45 * day + 0.2, 0.55 + day * 0.25); hemi.groundColor.setHSL(0.09, 0.25, 0.18 + day * 0.28);
    if (!day) { hemi.color.set(0x324a78); }
    renderer.toneMappingExposure = 0.62 + day * 0.18 + (1 - day) * 0.3;
    // 霧與雲
    const fogCol = new T.Color().setHSL(0.58 - golden * 0.5 * day, 0.15 + 0.1 * day, 0.08 + day * (0.62 - overcast * 0.12));
    if (golden > 0.5 && day > 0.2) fogCol.lerp(new T.Color(0xd9b48c), (golden - 0.5) * 0.6);
    if (day < 0.5) fogCol.lerp(new T.Color(0x0d1524), 1 - day * 2);
    if (w === 'fog') fogCol.lerp(new T.Color(0xc9ced0), day * 0.6);
    sky.visible = w !== 'fog' && w !== 'rain'; scene.background = sky.visible ? null : fogCol;
    scene.fog = new T.FogExp2(fogCol, w === 'fog' ? 0.0062 : w === 'rain' ? 0.0045 : w === 'cloudy' ? 0.0016 : 0.0008);
    clouds.material.opacity = (0.25 + overcast * 0.6) * (0.25 + day * 0.75); clouds.material.color.setHSL(0.6, 0.05, 0.25 + day * 0.7 - overcast * 0.25);
    // 夜間：窗光、路燈、店招
    const n = state.night, e = eras[state.era];
    for (const { m, k, kind } of e.nightMats) m.emissiveIntensity = kind === 'window' ? n * k * (0.55 + 0.45 * overcast) : kind === 'bulb' ? 0.08 + n * k : n * k;
    for (const m of e.glows) m.opacity = n * 0.85;
    for (const m of glassMats) m.emissiveIntensity = m.userData.sign ? n * 0.6 : n * 0.55;
    porchLights.forEach((l, i) => l.intensity = n * (i === 3 ? 45 : 22));
    // 雨天濕面：降低粗糙度、壓暗底色，讓天空與燈光倒映
    const wet = w === 'rain' ? 1 : w === 'fog' ? 0.3 : 0;
    for (const { m, rough, color } of [...e.wetMats, ...stationWet]) { m.roughness = rough * (1 - wet * 0.72); m.color.copy(color).multiplyScalar(1 - wet * 0.32); }
    rain.visible = w === 'rain';
    post.bloom.strength = 0.08 + n * 0.28; post.bloom.threshold = 3.0 - n * 1.6; post.bloom.radius = 0.45;
    const gu = post.grade.uniforms; gu.uSunVis.value = 0;
    for (const t of clockFaces) { const g = t.image.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#fff'; g.font = '900 72px monospace'; g.textAlign = 'center'; g.fillText(String(Math.floor(state.hour)).padStart(2, '0') + ':' + String(Math.round(state.hour % 1 * 60)).padStart(2, '0'), 128, 74); t.needsUpdate = true; }
    updateEnv();
  }
  let envTimer = 0; function updateEnv() { clearTimeout(envTimer); envTimer = setTimeout(() => { envRT?.dispose(); envRT = pmrem.fromScene(envScene, 0.02); scene.environment = envRT.texture; scene.environmentIntensity = 0.05 + (1 - state.night) * 0.12; }, 60); }

  // ── 鏡位、焦距 ──
  function setFocal(mm) { state.mm = mm; camera.fov = mmToFov(mm); camera.updateProjectionMatrix(); }
  function setShot(i) { const s = SHOTS[i]; if (!s) return; exitWalk(); state.shot = i; camera.position.set(...s.pos); controls.target.set(...s.target); setFocal(s.mm); controls.update(); ui.onShot?.(i); }

  // ── 漫步（WASD／方向鍵、拖曳轉向；手機左半拖曳前進、右半轉向）──
  const keys = new Set(); let yaw = 0, pitch = 0, drag = null, stick = null;
  function groundAt(x, z) { for (const p of PLATFORMS) if (ERAS[state.era].rail && z > p.z0 && z < p.z1 && x > -95 && x < 75) return p.h; return 0; }
  function enterWalk() {
    state.walk = true; controls.enabled = false;
    const d = new T.Vector3().subVectors(controls.target, camera.position); yaw = Math.atan2(d.x, d.z); pitch = 0;
    if (camera.position.y > 3) { const p = controls.target.clone().add(new T.Vector3(0, 0, 18)); camera.position.set(p.x, 0, p.z); }
    camera.position.y = groundAt(camera.position.x, camera.position.z) + 1.65; ui.onWalk?.(true);
  }
  function exitWalk() { if (!state.walk) return; state.walk = false; controls.enabled = true; const f = new T.Vector3(Math.sin(yaw), 0, Math.cos(yaw)); controls.target.copy(camera.position).addScaledVector(f, 12); controls.update(); ui.onWalk?.(false); }
  addEventListener('keydown', e => { if (state.walk && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) { keys.add(e.key.toLowerCase()); if (e.key.startsWith('Arrow')) e.preventDefault(); } });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  canvas.addEventListener('pointerdown', e => { if (!state.walk) return; canvas.setPointerCapture(e.pointerId); const r = canvas.getBoundingClientRect(); if (e.pointerType === 'touch' && e.clientX - r.left < r.width / 2) stick = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; else drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointermove', e => { if (stick && e.pointerId === stick.id) { stick.dx = (e.clientX - stick.x) / 60; stick.dy = (e.clientY - stick.y) / 60; } else if (drag && e.pointerId === drag.id) { yaw -= (e.clientX - drag.x) * 0.004; pitch = Math.max(-1.2, Math.min(1.2, pitch - (e.clientY - drag.y) * 0.004)); drag.x = e.clientX; drag.y = e.clientY; } });
  const endPtr = e => { if (stick?.id === e.pointerId) stick = null; if (drag?.id === e.pointerId) drag = null; };
  canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
  function walkStep(dt) {
    let f = 0, s = 0; const run = keys.has('shift') ? 2.2 : 1;
    if (keys.has('w') || keys.has('arrowup')) f += 1; if (keys.has('s') || keys.has('arrowdown')) f -= 1;
    if (keys.has('a')) s -= 1; if (keys.has('d')) s += 1;
    if (keys.has('arrowleft') || keys.has('q')) yaw += dt * 1.6; if (keys.has('arrowright') || keys.has('e')) yaw -= dt * 1.6;
    if (stick) { f -= Math.max(-1, Math.min(1, stick.dy)); s += Math.max(-1, Math.min(1, stick.dx)); }
    const sp = 4.2 * run * dt, fx = Math.sin(yaw), fz = Math.cos(yaw);
    let x = camera.position.x + (fx * f - fz * s) * sp, z = camera.position.z + (fz * f + fx * s) * sp;
    for (const [x0, x1, z0, z1] of SOLIDS) if (x > x0 - 0.4 && x < x1 + 0.4 && z > z0 - 0.4 && z < z1 + 0.4) {
      if (ERAS[state.era].rail === false && z0 === -21.2) continue;
      const dx = Math.min(x - (x0 - 0.4), x1 + 0.4 - x), dz = Math.min(z - (z0 - 0.4), z1 + 0.4 - z);
      if (dx < dz) x = x - (x0 - 0.4) < x1 + 0.4 - x ? x0 - 0.4 : x1 + 0.4; else z = z - (z0 - 0.4) < z1 + 0.4 - z ? z0 - 0.4 : z1 + 0.4;
    }
    x = Math.max(-500, Math.min(500, x)); z = Math.max(-300, Math.min(520, z));
    const gy = groundAt(x, z) + 1.65; camera.position.set(x, camera.position.y + (gy - camera.position.y) * Math.min(1, dt * 8), z);
    camera.lookAt(x + Math.sin(yaw) * Math.cos(pitch), camera.position.y + Math.sin(pitch), z + Math.cos(yaw) * Math.cos(pitch));
  }

  // ── 尺寸、渲染迴圈 ──
  function resize() { const { width, height } = canvas.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height, false); post.setSize(width, height, renderer.getPixelRatio()); camera.aspect = width / height; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(canvas); resize();
  const clock = new T.Clock(); let time = 0;
  function frame() {
    const dt = Math.min(0.05, clock.getDelta()); time += dt;
    if (state.walk) walkStep(dt); else controls.update();
    // 年代轉場：淡出 → 切換 → 淡入（鏡頭不動）
    if (fadeTarget !== fade) { fade += Math.sign(fadeTarget - fade) * Math.min(Math.abs(fadeTarget - fade), dt * 2.4 / TRANSITION.seconds * 4.5); if (fade >= 1 && pendingEra !== null) { applyEra(pendingEra); pendingEra = null; fadeTarget = 0; } }
    grow.update(dt);
    post.grade.uniforms.uFade.value = fade * 0.92; post.grade.uniforms.uTime.value = time;
    for (const m of eras[state.era].movers) m(dt);
    if (rain.visible) { const p = rainGeo.attributes.position.array; for (let i = 0; i < p.length; i += 6) { p[i + 1] -= dt * 26; p[i + 4] -= dt * 26; if (p[i + 1] < 0) { p[i + 1] += 50; p[i + 4] += 50; } } rainGeo.attributes.position.needsUpdate = true; rain.position.set(camera.position.x, 0, camera.position.z); }
    cloudTex.offset.x += dt * 0.0015;
    post.composer.render(dt);
  }
  renderer.setAnimationLoop(frame);

  // ── 拍攝、今昔並排、分享 ──
  function snapshot() { grow.finish(); post.composer.render(0); const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height; c.getContext('2d').drawImage(canvas, 0, 0); return c; }
  function compare(other) {
    grow.finish(); const cur = state.era; other = other ?? (cur >= 3 ? 1 : 3);
    const fadeWas = post.grade.uniforms.uFade.value; post.grade.uniforms.uFade.value = 0;
    const a = snapshot(); applyEra(other); const b = snapshot(); applyEra(cur); post.grade.uniforms.uFade.value = fadeWas;
    const W = a.width, H = a.height, out = document.createElement('canvas'); out.width = W * 2 + 12; out.height = H + 64; const g = out.getContext('2d');
    g.fillStyle = '#20342d'; g.fillRect(0, 0, out.width, out.height); g.drawImage(a, 0, 0); g.drawImage(b, W + 12, 0);
    g.fillStyle = '#f3ead6'; g.font = `600 ${Math.round(H * 0.035)}px serif`; g.fillText(`${ERAS[cur].year} ${ERAS[cur].name}`, 20, H + 42); g.fillText(`${ERAS[other].year} ${ERAS[other].name}`, W + 32, H + 42);
    g.textAlign = 'right'; g.font = `${Math.round(H * 0.022)}px sans-serif`; g.fillText('今昔街影・臺南驛前　歷史數位重建，非原始影像', out.width - 20, H + 42);
    return { canvas: out, title: `${ERAS[cur].year} ↔ ${ERAS[other].year} · 臺南驛前` };
  }
  function shareURL() {
    const u = new URL(location.href); const p = camera.position, t = state.walk ? camera.position.clone().add(new T.Vector3(Math.sin(yaw) * 5, Math.sin(pitch) * 5, Math.cos(yaw) * 5)) : controls.target;
    u.searchParams.set('place', 'tainan'); u.searchParams.set('era', ERAS[state.era].id); u.searchParams.set('t', state.hour); u.searchParams.set('w', state.weather); u.searchParams.set('mm', state.mm);
    u.searchParams.set('cam', [p.x, p.y, p.z, t.x, t.y, t.z].map(v => v.toFixed(1)).join(',')); if (state.walk) u.searchParams.set('walk', '1'); else u.searchParams.delete('walk'); u.searchParams.delete('shot');
    return u.href;
  }

  // ── 初始狀態（分享參數）──
  const q = new URLSearchParams(location.search);
  const eraQ = q.get('era'), ei = ERAS.findIndex(e => e.id === eraQ); state.era = ei >= 0 ? ei : (/^\d$/.test(eraQ || '') ? Math.min(4, +eraQ) : 1);
  if (q.has('t') && Number.isFinite(+q.get('t'))) state.hour = Math.max(0, Math.min(23.75, +q.get('t')));
  if (['clear', 'cloudy', 'rain', 'fog'].includes(q.get('w'))) state.weather = q.get('w');
  const shotQ = Number(q.get('shot')); setShot(Number.isInteger(shotQ) && shotQ >= 0 && shotQ < SHOTS.length ? shotQ : 0);
  const cam = (q.get('cam') || '').split(',').map(Number);
  if (cam.length === 6 && cam.every(Number.isFinite)) { camera.position.set(cam[0], cam[1], cam[2]); controls.target.set(cam[3], cam[4], cam[5]); controls.update(); }
  if (Number(q.get('mm')) >= 14 && Number(q.get('mm')) <= 135) setFocal(Number(q.get('mm')));
  applyEra(state.era);
  if (q.get('walk') === '1') enterWalk();
  status(warn.length ? warn.join('；') : `站房：Blender 重建（依館藏舊照）｜街廓：${osm?.source || 'OSM'}（${osm?.fetched || ''}）`);

  return {
    renderer, scene, camera, controls, post, eras: ERAS, shots: SHOTS, state, THREE: T, grow, credits: ['街廓 ' + OSM_CREDIT],
    transitions: ['grow', 'fade', 'cut'], exportRoot: () => eras[state.era].group,
    walkHint: 'W A S D／方向鍵移動・拖曳轉向・Shift 快走｜手機：左半邊拖曳前進、右半邊轉向',
    weathers: { clear: '晴天', cloudy: '多雲', rain: '雨天', fog: '晨霧' },
    setEra, setShot, setFocal, compare, snapshot, shareURL,
    setHour(h) { state.hour = h; climate(); }, setWeather(w) { state.weather = w; climate(); },
    toggleWalk() { state.walk ? exitWalk() : enterWalk(); return state.walk; },
    zoom(f) { if (state.walk) { setFocal(Math.max(14, Math.min(135, state.mm / f))); return; } camera.position.sub(controls.target).multiplyScalar(f).add(controls.target); controls.update(); },
  };
}
