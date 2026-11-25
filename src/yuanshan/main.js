import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './yuanshan.css';
import { G, LAMPS } from './materials.js';
import { RIVER, SANDO, shrineLocal, mulberry } from './geo.js';
import { buildGrid, eraCanvases, buildTerrain, hAt } from './terrain.js';
import { buildWater } from './water.js';
import { buildForest, palms } from './forest.js';
import { buildTown, buildBoats, buildExtras } from './town.js';
import { buildShrine, buildJingu, buildGokoku, buildMartyrs, buildEarlyHotel, buildGrandHotel } from './landmarks.js';
import { buildMeiji1, buildMeiji2, ghostOf, buildModernRoads, buildRailBridge } from './bridges.js';
import { Atmosphere, WEATHER } from './atmosphere.js';
import { Post } from './post.js';
import { ERAS, SHOTS, LABELS } from './eras.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const mobile = matchMedia('(pointer: coarse)').matches;
const quality = params.get('q') || (mobile ? 'low' : 'high');
const tick = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
const status = async (msg, pct) => { $('loadMsg').textContent = msg; $('loadBar').style.width = pct + '%'; await tick(); };

// ---------- 光暈：燈籠頭的光點＋地面光池 ----------
function buildGlows(lights) {
  const N = lights.length; const group = new THREE.Group();
  if (!N) return group;
  const pos = new Float32Array(N * 3), mask = new Float32Array(N * 4), info = new Float32Array(N * 2);
  lights.forEach((l, i) => { pos.set([l.p.x, l.p.y, l.p.z], i * 3); mask.set(l.mask, i * 4); info.set([l.r, i * 0.37 % 1], i * 2); });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aMask', new THREE.Float32BufferAttribute(mask, 4)); g.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 2));
  const U = { uEra: G.uEra, uNight: G.uNight, uTime: G.uTime, uPx: { value: 1 } };
  const halo = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: U,
    vertexShader: `attribute vec4 aMask; attribute vec2 aInfo; uniform vec4 uEra; uniform float uNight; uniform float uTime; uniform float uPx; varying float vA;
      void main(){ vec4 r = aMask * uEra; float e = max(max(r.x, r.y), max(r.z, r.w)); vec4 mv = viewMatrix * vec4(position, 1.0);
        vA = e * uNight * (0.85 + 0.15 * sin(uTime * 3.0 + aInfo.y * 30.0)); gl_PointSize = clamp(aInfo.x * 55.0 * uPx / -mv.z, 0.0, 90.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = exp(-d * d * 5.0) + exp(-d * 18.0) * 0.8; gl_FragColor = vec4(vec3(1.0, 0.72, 0.38) * a * vA * 1.4, 1.0); }` });
  const pts = new THREE.Points(g, halo); pts.frustumCulled = false; group.add(pts);
  // 地面光池
  const quad = new THREE.PlaneGeometry(1, 1); quad.rotateX(-Math.PI / 2);
  const pool = new THREE.InstancedMesh(quad, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, uniforms: U,
    vertexShader: `attribute vec4 aMask; uniform vec4 uEra; uniform float uNight; varying float vA; varying vec2 vUv; void main(){ vUv = uv; vec4 r = aMask * uEra; vA = max(max(r.x, r.y), max(r.z, r.w)) * uNight; gl_Position = projectionMatrix * viewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying float vA; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(vec3(1.0, 0.62, 0.3) * pow(max(1.0 - d, 0.0), 2.2) * vA * 0.55, 1.0); }` }), N);
  const m4 = new THREE.Matrix4();
  lights.forEach((l, i) => { const onBridge = Math.abs(l.p.z) < 70 && Math.abs(l.p.x) < 14 && l.p.y > 9; const gy = onBridge ? (l.mask[0] ? 9.65 : 10.55) : hAt(l.p.x, l.p.z); m4.compose(new THREE.Vector3(l.p.x, gy + 0.15, l.p.z), new THREE.Quaternion(), new THREE.Vector3(l.r * 2, 1, l.r * 2)); pool.setMatrixAt(i, m4); });
  quad.setAttribute('aMask', new THREE.InstancedBufferAttribute(mask, 4)); pool.frustumCulled = false; group.add(pool);
  group.userData.U = U;
  return group;
}

class App {
  async init() {
    const canvas = $('scene');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.pr = Math.min(devicePixelRatio || 1, quality === 'low' ? 1 : 1.5);
    this.renderer.setPixelRatio(this.pr);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 0.62;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 1.5, 60000);
    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.07, minDistance: 8, maxDistance: 4200, maxPolarAngle: Math.PI * 0.495, zoomSpeed: 0.9, rotateSpeed: 0.55, panSpeed: 0.8, screenSpacePanning: false });
    this.controls.autoRotateSpeed = 0.25;

    await status('丈量劍潭山與基隆河…', 8);
    buildGrid();
    await status('鋪上田園、街道與參道…', 22);
    const canvases = eraCanvases();
    await status('堆疊地形…', 34);
    this.terrain = buildTerrain(canvases, quality); this.scene.add(this.terrain.group);
    this.water = buildWater(this.scene, quality);
    await status('植樹：相思樹、樟樹與杉林…', 46);
    const hotel = shrineLocal(30, 0), gh = shrineLocal(14, 0);
    const exclusions = [
      { x: hotel[0], z: hotel[1], r: 82, mask: [0, 0, 1, 1] }, { x: gh[0], z: gh[1], r: 96, mask: [0, 0, 0, 1] },
      { x: 330, z: -505, r: 46, mask: [0, 1, 0, 0] }, { x: 900, z: -150, r: 62, mask: [0, 1, 1, 1] },
    ]; exclusions.SANDO = SANDO;
    this.forest = buildForest(quality, exclusions); this.scene.add(this.forest);
    await status('築起街屋與城市…', 58);
    this.town = buildTown(quality); this.scene.add(this.town);
    await status('營造社殿、鳥居與石燈籠…', 68);
    const H = shrineLocal(80, 0);
    const objs = [
      buildShrine([1, 0, 0, 0]), buildShrine([0, 1, 0, 0], true), buildJingu([0, 1, 0, 0]),
      buildGokoku([0, 1, 1, 0]), buildMartyrs([0, 0, 0, 1]),
      buildEarlyHotel([0, 0, 1, 0]), buildGrandHotel([0, 0, 0, 1]),
      palms([[H[0] - 30, H[1] + 8, 9], [H[0] - 24, H[1] + 14, 11], [H[0] + 4, H[1] + 18, 10], [H[0] - 8, H[1] - 14, 9]], [0, 0, 1, 1]),
    ];
    await status('架橋：鋼桁明治橋與拱橋…', 80);
    const m2 = buildMeiji2([0, 1, 0, 0]), m3 = buildMeiji2([0, 0, 1, 0], { name: 'zhongshan', asphalt: true });
    objs.push(buildMeiji1([1, 0, 0, 0]), m2, m3, buildModernRoads([0, 0, 0, 1]), buildRailBridge([1, 1, 1, 0]), buildRailBridge([0, 0, 0, 1], true), ...buildExtras());
    this.ghost = ghostOf(buildMeiji2([0, 0, 0, 1], { simple: true, name: 'ghost-src' })); this.ghost.userData.mask = [0, 0, 0, 1]; this.scene.add(this.ghost);
    this.boats = buildBoats(quality); this.scene.add(this.boats);
    for (const o of objs) this.scene.add(o);
    const lights = []; for (const o of objs) if (o.userData.lights) lights.push(...o.userData.lights);
    this.glows = buildGlows(lights); this.scene.add(this.glows);
    this.eraObjs = []; this.scene.traverse(o => { if (o.userData.mask && o !== this.scene) this.eraObjs.push(o); });

    await status('調和天光與雲霧…', 90);
    this.atmo = new Atmosphere(this.renderer, this.scene, quality);
    this.post = new Post(this.renderer, this.scene, this.camera, quality);
    this.era = 0; this.eraFrom = 0; this.eraT = 1; this.ghostOn = true; this.labelsOn = true; this.autoMood = true;
    if (mobile || innerWidth < 760) document.body.classList.remove('panel-open');
    this.buildUI();
    const e0 = Math.min(3, Math.max(0, (+params.get('era') || 2) - 1));
    this.setEra(e0, true);
    if (params.has('t')) this.setHour(+params.get('t'));
    if (params.has('w') && WEATHER[params.get('w')]) this.setWeather(params.get('w'));
    this.goShot(Math.min(SHOTS.length - 1, Math.max(0, (+params.get('shot') || 1) - 1)), true);
    if (params.get('paint') === '1') this.togglePaint(true);
    if (params.get('ui') === '0') document.body.classList.add('clean');
    this.resize(); addEventListener('resize', () => this.resize());
    await status('完成', 100);
    // 預先編譯並暖機
    this.renderer.compile(this.scene, this.camera);
    this.clock = new THREE.Clock(); this.t = 0; this.frames = 0; this.slow = 0;
    if (params.get('test') === '1') { this.step = (n = 1, dt = 0.1) => { for (let i = 0; i < n; i++) { this.clock.getDelta = () => dt; this.frame(); } return this.frames; }; }
    else this.renderer.setAnimationLoop(() => this.frame());
    setTimeout(() => $('loader').classList.add('done'), 300);
    window.__yuanshan = this;
  }

  resize() {
    const w = innerWidth, h = innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.post.setSize(w, h, this.renderer.getPixelRatio());
  }

  // ---------- 時代 ----------
  setEra(i, instant = false) {
    if (i === this.era && !instant) return;
    this.eraFrom = instant ? i : this.era; this.era = i; this.eraT = instant ? 1 : 0;
    const U = this.terrain.mat.userData.U, texs = this.terrain.mat.userData.texs;
    U.tB.value = texs[this.eraFrom]; U.tA.value = texs[i]; U.uMix.value = instant ? 1 : 0;
    U.uUrban.value = [0.05, 0.25, 0.55, 1][i];
    G.uWave.value.copy(this.controls.target);
    const e = ERAS[i];
    if (this.autoMood && !instant) { this.tweenHour(e.mood.hour); this.setWeather(e.mood.weather); }
    if (instant) { this.setHour(e.mood.hour); this.setWeather(e.mood.weather); }
    if (this.autoMood && quality !== 'low' && !params.has('paint')) this.togglePaint(i <= 1);
    this.water.material.uniforms.waterColor.value.set(['#3d5548', '#2f4c47', '#38504a', '#2a3f44'][i]);
    this.water.material.uniforms.uSilt.value.set(['#6d6a4c', '#5d6b4f', '#5f5f48', '#4d5a52'][i]);
    // 介面
    document.querySelectorAll('.era-node').forEach((b, k) => { b.classList.toggle('on', k === i); b.setAttribute('aria-pressed', String(k === i)); });
    $('eraTitle').textContent = e.title; $('eraText').textContent = e.text; $('eraRange').textContent = e.range; $('eraLook').textContent = e.look;
    const card = $('eraCard'); card.classList.remove('show'); void card.offsetWidth; card.classList.add('show');
    document.body.dataset.era = e.id;
    this.updateLabels(true);
    if (!instant) this.flash = 1;
    const url = new URL(location.href); url.searchParams.set('era', i + 1); history.replaceState(null, '', url);
  }

  setHour(h) { this.atmo.hour = ((h % 24) + 24) % 24; this.hourTween = null; this.syncTime(); }
  tweenHour(h) { let from = this.atmo.hour, to = h; if (Math.abs(to - from) > 12) to += to < from ? 24 : -24; this.hourTween = { from, to, t: 0 }; }
  syncTime() {
    const h = this.atmo.hour; $('hour').value = h.toFixed(2);
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    const names = [[5, '夜半'], [6.5, '破曉'], [9, '晨光'], [15, '晝'], [17.6, '午後斜陽'], [19, '黃昏'], [24, '夜']];
    $('hourVal').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}　${names.find(n => h < n[0])[1]}`;
  }
  setWeather(w) { this.atmo.setWeather(w); document.querySelectorAll('[data-weather]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.weather === w))); this.water.material.uniforms.uRain.value = w === 'rain' ? 1 : 0; }

  goShot(i, instant = false) {
    const s = SHOTS[i]; this.shot = i;
    const cam = new THREE.Vector3(...s.cam), tgt = new THREE.Vector3(...s.tgt);
    document.querySelectorAll('[data-shot]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.shot === i)));
    if (instant) { this.camera.position.copy(cam); this.controls.target.copy(tgt); this.camera.fov = s.fov; this.camera.updateProjectionMatrix(); this.controls.update(); return; }
    this.fly = { p0: this.camera.position.clone(), t0: this.controls.target.clone(), f0: this.camera.fov, p1: cam, t1: tgt, f1: s.fov, k: 0, dur: 3.2 };
  }

  togglePaint(on) { this.post.kuwa.enabled = on; $('paint').setAttribute('aria-pressed', String(on)); }

  // ---------- 介面 ----------
  buildUI() {
    const tl = $('timeline');
    tl.innerHTML = ERAS.map((e, i) => `<button class="era-node" data-era="${i}" aria-pressed="false"><span class="dot"></span><b>${e.year}</b><small>${e.short}</small></button>`).join('');
    tl.querySelectorAll('.era-node').forEach(b => b.onclick = () => this.setEra(+b.dataset.era));
    $('shots').innerHTML = SHOTS.map((s, i) => `<button data-shot="${i}" title="${s.desc}" aria-pressed="false">${s.name}</button>`).join('');
    $('shots').querySelectorAll('button').forEach(b => b.onclick = () => this.goShot(+b.dataset.shot));
    $('weather').innerHTML = Object.entries(WEATHER).map(([k, w]) => `<button data-weather="${k}" aria-pressed="false">${w.name}</button>`).join('');
    $('weather').querySelectorAll('button').forEach(b => b.onclick = () => this.setWeather(b.dataset.weather));
    $('hour').oninput = e => { this.setHour(+e.target.value); };
    $('paint').onclick = () => this.togglePaint(!this.post.kuwa.enabled);
    $('ghost').onclick = () => { this.ghostOn = !this.ghostOn; $('ghost').setAttribute('aria-pressed', String(this.ghostOn)); };
    $('labels').onclick = () => { this.labelsOn = !this.labelsOn; $('labels').setAttribute('aria-pressed', String(this.labelsOn)); this.updateLabels(true); };
    $('tour').onclick = () => { this.controls.autoRotate = !this.controls.autoRotate; $('tour').setAttribute('aria-pressed', String(this.controls.autoRotate)); };
    $('mood').onclick = () => { this.autoMood = !this.autoMood; $('mood').setAttribute('aria-pressed', String(this.autoMood)); if (this.autoMood) { const e = ERAS[this.era]; this.tweenHour(e.mood.hour); this.setWeather(e.mood.weather); } };
    $('photo').onclick = () => this.photo();
    $('hide').onclick = () => document.body.classList.toggle('clean');
    $('panelToggle').onclick = () => document.body.classList.toggle('panel-open');
    // 標註
    this.labelEls = LABELS.map(L => { const d = document.createElement('div'); d.className = 'tag'; d.innerHTML = '<span></span>'; $('tags').append(d); return { L, d, v: new THREE.Vector3(...L.pos) }; });
    addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key >= '1' && e.key <= '4') this.setEra(+e.key - 1);
      if (e.key === 'ArrowRight') this.setEra(Math.min(3, this.era + 1));
      if (e.key === 'ArrowLeft') this.setEra(Math.max(0, this.era - 1));
      if (e.key === 'p' || e.key === 'P') this.photo();
      if (e.key === 'h' || e.key === 'H') document.body.classList.toggle('clean');
      if (e.key === 'g' || e.key === 'G') this.togglePaint(!this.post.kuwa.enabled);
    });
    this.controls.addEventListener('start', () => { this.fly = null; $('hint').classList.add('gone'); });
  }

  updateLabels(force) {
    if (!this.labelEls) return;
    const w = innerWidth, h = innerHeight; const v = new THREE.Vector3();
    for (const o of this.labelEls) {
      const txt = o.L.text[this.era]; if (force) o.d.firstChild.textContent = txt;
      v.copy(o.v).project(this.camera);
      const vis = this.labelsOn && txt && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      o.d.style.opacity = vis ? '1' : '0';
      if (vis) o.d.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px)`;
    }
  }

  photo() {
    this.post.grade.uniforms.uFlash.value = 0;
    this.post.composer.render();
    const src = this.renderer.domElement; const out = document.createElement('canvas');
    const bar = Math.round(src.width * 0.045); out.width = src.width; out.height = src.height + bar; const c = out.getContext('2d');
    c.drawImage(src, 0, 0); c.fillStyle = '#f3eee2'; c.fillRect(0, src.height, out.width, bar);
    const e = ERAS[this.era]; c.fillStyle = '#2b2a26'; c.font = `600 ${Math.round(bar * 0.36)}px "Noto Serif TC", serif`;
    c.fillText(`圓山・劍潭　${e.range}　${e.name}`, bar * 0.4, src.height + bar * 0.5);
    c.font = `${Math.round(bar * 0.24)}px sans-serif`; c.fillStyle = '#6b665b';
    c.fillText(`${$('hourVal').textContent}　${WEATHER[this.atmo.weather].name}　今昔街影 · 依史料與舊照重建的示意場景`, bar * 0.4, src.height + bar * 0.82);
    const a = document.createElement('a'); a.download = `圓山-${e.year}-${Date.now()}.png`; a.href = out.toDataURL('image/png'); a.click();
    this.flash = 1;
  }

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta()); this.t += dt; G.uTime.value = this.t;
    // 自動降解析度
    this.frames++; if (dt > 0.045) this.slow++; if (this.frames % 90 === 0) { if (this.slow > 60 && this.pr > 0.7) { this.pr = Math.max(0.7, this.pr - 0.2); this.renderer.setPixelRatio(this.pr); this.resize(); } this.slow = 0; }
    // 時代轉場
    if (this.eraT < 1) this.eraT = Math.min(1, this.eraT + dt / 2.6);
    const k = this.eraT, ease = k * k * (3 - 2 * k);
    const ev = [0, 0, 0, 0]; ev[this.era] = ease; if (this.eraFrom !== this.era) ev[this.eraFrom] = Math.max(ev[this.eraFrom], 1 - ease); else ev[this.era] = 1;
    G.uEra.value.set(...ev);
    this.terrain.mat.userData.U.uMix.value = ease;
    const g = {}; const keys = Object.keys(ERAS[0].grade); for (const key of keys) g[key] = ERAS[this.eraFrom].grade[key] * (1 - ease) + ERAS[this.era].grade[key] * ease;
    this.post.setGrade(g);
    for (const o of this.eraObjs) { const m = o.userData.mask; o.visible = m[0] * ev[0] + m[1] * ev[1] + m[2] * ev[2] + m[3] * ev[3] > 0.0005; }
    this.ghost.visible = this.ghostOn && ev[3] > 0.01; this.ghost.userData.mat.uniforms.uAmt.value = ev[3] * (0.35 + 0.5 * G.uNight.value);
    // 時刻
    if (this.hourTween) { const h = this.hourTween; h.t = Math.min(1, h.t + dt / 3.0); const e2 = h.t * h.t * (3 - 2 * h.t); this.atmo.hour = ((h.from + (h.to - h.from) * e2) % 24 + 24) % 24; this.syncTime(); if (h.t >= 1) this.hourTween = null; }
    // 飛行鏡頭
    if (this.fly) {
      const f = this.fly; f.k = Math.min(1, f.k + dt / f.dur); const e3 = f.k < 0.5 ? 4 * f.k ** 3 : 1 - Math.pow(-2 * f.k + 2, 3) / 2;
      const lift = Math.sin(f.k * Math.PI) * Math.min(220, f.p0.distanceTo(f.p1) * 0.25);
      this.camera.position.lerpVectors(f.p0, f.p1, e3).y += lift; this.controls.target.lerpVectors(f.t0, f.t1, e3);
      this.camera.fov = f.f0 + (f.f1 - f.f0) * e3; this.camera.updateProjectionMatrix(); if (f.k >= 1) this.fly = null;
    }
    this.controls.update();
    const cp = this.camera.position; const ground = Math.max(hAt(cp.x, cp.z), 0) + 2.2; if (cp.y < ground) cp.y = ground;
    // 大氣
    const fire = ERAS[this.eraFrom].fire * (1 - ease) + ERAS[this.era].fire * ease;
    const A = this.atmo.update(dt, this.t, this.camera, this.controls.target, fire);
    const night = G.uNight.value;
    for (const m of LAMPS) m.emissiveIntensity = m.userData.lamp * night;
    this.post.bloom.strength = 0.1 + 0.5 * night; this.post.bloom.threshold = 7 - 6 * Math.min(1, night * 1.3);
    this.glows.userData.U && (this.glows.userData.U.uPx.value = this.renderer.getPixelRatio());
    // 水面
    const wu = this.water.material.uniforms; wu.time.value = this.t * 0.35; wu.sunDirection.value.copy(this.atmo.sunDir.y > 0 ? this.atmo.sunDir : new THREE.Vector3(0.3, 0.6, -0.5).normalize());
    wu.sunColor.value.copy(this.atmo.sun.color).multiplyScalar(Math.min(1.4, this.atmo.sun.intensity * 0.45)); wu.distortionScale.value = 1.6 + this.atmo.w.wind * 1.2 + this.atmo.w.rain * 2;
    wu.uRf0.value = 0.1 + 0.08 * (1 - this.atmo.w.dark);
    // 船
    for (const b of this.boats.userData.boats) {
      const m = b.userData.mask; b.visible = m.some((x, j) => x && ev[j] > 0.01);
      const u = ((b.userData.t0 + this.t * b.userData.speed * 0.25) % 1) * 0.6 + 0.2; const fi = u * (RIVER.length - 1); const i0 = Math.floor(fi), p = RIVER[i0], q = RIVER[i0 + 1], fr = fi - i0;
      const x = p[0] + (q[0] - p[0]) * fr, z = p[1] + (q[1] - p[1]) * fr, dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz);
      b.position.set(x - dz / L * b.userData.lane, 0.15 + Math.sin(this.t * 1.3 + b.userData.t0 * 9) * 0.08, z + dx / L * b.userData.lane);
      b.rotation.set(Math.sin(this.t + b.userData.t0 * 20) * 0.03, Math.atan2(-dx, -dz), 0);
    }
    // 光芒：太陽螢幕位置
    const gu = this.post.grade.uniforms; gu.uTime.value = this.t;
    const sp = this.camera.position.clone().addScaledVector(this.atmo.sunDir, 20000).project(this.camera);
    const facing = this.atmo.sunDir.dot(this.camera.getWorldDirection(new THREE.Vector3()));
    gu.uSun.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5); gu.uSunVis.value = Math.max(0, facing) * (A.elevDeg > -2 ? 1 : 0) * (1 - this.atmo.w.dark) * THREE.MathUtils.smoothstep(A.elevDeg, -2, 4) * (sp.z < 1 ? 1 : 0) * 0.9;
    gu.uSunCol.value.copy(this.atmo.sun.color);
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 1.8); gu.uFlash.value = this.flash * 0.35; }
    this.updateLabels(false);
    this.post.composer.render(dt);
  }
}

const app = new App();
app.init().catch(err => { console.error(err); $('loadMsg').textContent = '無法建立立體場景：' + err.message + '。請使用支援 WebGL 2 的瀏覽器並開啟硬體加速。'; });
