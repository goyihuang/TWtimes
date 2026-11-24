import * as THREE from 'three';
import './style.css';
import { loadBase } from './data.js';
import { ERAS, ERA_ORDER, LANDMARKS } from './eras.js';
import { facadeLibrary, groundTextures, signAtlas } from './textures.js';
import { buildBuildings, buildSigns, indexLandmarks, GROUND_FLOOR_H, FLOOR_H } from './builders/buildings.js';
import { buildGround, roadWidth } from './builders/ground.js';
import { buildStation } from './builders/station.js';
import { buildRiver } from './builders/river.js';
import { buildMiyahara } from './builders/miyahara.js';
import { loadModel, fitModel } from './builders/models.js';
import { Environment } from './env.js';
import { Pipeline } from './render.js';
import { CameraRig } from './controls.js';
import { Edits, sceneStore } from './edits.js';
import { lonLatToXZ, polygonArea, centroid, pointInPolygon } from './geo.js';
import { VIEWPOINTS } from './viewpoints.js';
import { buildUI } from './ui.js';
import { generateInfill } from './infill.js';

const ERA_LAYER = { '1935': 1, today: 2 };

class App {
  constructor() {
    const canvas = document.getElementById('scene');
    const mobile = matchMedia('(pointer: coarse)').matches;
    this.quality = mobile ? 'low' : 'high';
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMappingExposure = 0.7;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.3, 6000);
    this.camera.position.set(-140, 120, 190);
    this.env = new Environment(this.renderer, this.scene);
    this.pipeline = new Pipeline(this.renderer);
    this.rig = new CameraRig(this.camera, canvas);
    this.rig.orbit.target.set(-40, 0, -20);
    this.edits = new Edits();
    this.eraId = 'today'; this.eraGroups = {}; this.transition = null;
    this.photo = { on: false, filter: 0, grain: 0.025, vignette: 0.35, focal: 35, aperture: 0, focus: 30, stamp: true, scale: 2 };
    this.labels = [];
    this.clock = { last: performance.now(), elapsedTime: 0, getDelta() { const n = performance.now(); const d = (n - this.last) / 1000; this.last = n; this.elapsedTime += d; return d; } };
    addEventListener('resize', () => this.resize()); this.resize();
  }
  async init() {
    this.setStatus('載入街道資料…');
    this.base = await loadBase(new URL('data/taichung-station.osm.json', document.baseURI).href);
    this.addLandmarkFootprints();
    this.osmBuildings = this.base.buildings;
    this.refreshInfill();
    this.setStatus('繪製街屋立面…');
    await new Promise(r => setTimeout(r, 20));
    this.library = facadeLibrary(); this.ground = groundTextures(); this.atlas = signAtlas();
    const lm = indexLandmarks(this.base, LANDMARKS, lonLatToXZ); this.landmarkIndex = lm.map; this.landmarkFound = lm.found;
    for (const id of ERA_ORDER) this.buildEra(id);
    this.edits.onChange(scope => this.scheduleRebuild(scope));
    this.ui = buildUI(this);
    this.applyHash();
    this.setStatus(null);
    this.renderer.setAnimationLoop(() => this.frame());
  }
  // 自訂輪廓的地標（OSM 缺漏者）：加入建物清單，並移除輪廓內零碎的 OSM 小建物
  addLandmarkFootprints() {
    for (const lm of LANDMARKS) {
      if (!lm.footprint) continue;
      const ring = lm.footprint.map(p => lonLatToXZ(...p)); if (polygonArea(ring) < 0) ring.reverse();
      this.base.buildings = this.base.buildings.filter(b => { const [cx, cz] = centroid(b.ring); return !pointInPolygon(cx, cz, ring); });
      this.base.buildings.push({ id: 'lm-' + lm.key, tags: { name: lm.label?.today || lm.key }, ring, area: Math.abs(polygonArea(ring)) });
    }
  }
  // 推估補建的街屋會依街道寬度重新排列（街道加寬，街屋就往後退）
  refreshInfill() {
    const scale = this.edits.global.streetWidth || 1;
    if (this._infillScale === scale) return;
    this._infillScale = scale;
    this.base.buildings = this.osmBuildings;
    const infill = generateInfill(this.base, scale);
    this.base.buildings = [...this.osmBuildings, ...infill];
    for (const b of this.base.buildings) { if (b.bbox) continue; let a = 1e9, c = 1e9, d = -1e9, e = -1e9; for (const p of b.ring) { a = Math.min(a, p[0]); c = Math.min(c, p[1]); d = Math.max(d, p[0]); e = Math.max(e, p[1]); } b.bbox = [a, c, d, e]; }
  }
  setStatus(t) { const el = document.getElementById('status'); if (!el) return; el.textContent = t || ''; el.hidden = !t; }
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.pipeline.setSize(w, h);
  }
  buildEra(id) {
    const era = ERAS[id];
    const old = this.eraGroups[id];
    if (old) { this.scene.remove(old.group); old.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose?.(); }); }
    const group = new THREE.Group(); group.name = 'era-' + id;
    const b = buildBuildings(this.base, era, this.edits.data, this.library, this.landmarkIndex);
    const existing = b.index.filter(x => !x.hidden).map(x => x.b);
    group.add(b.group, buildSigns(b.signs, this.atlas), buildGround(this.base, era, this.edits.data, this.ground, existing), buildRiver(this.base, era, { roads: this.base.roads.filter(r => era.roadIncluded(r) && !/^(steps|elevator|busway)$/.test(r.tags.highway) && !(+r.tags.layer > 0 && r.tags.bridge !== 'yes') && !(+r.tags.layer < 0)), width: r => roadWidth(r, this.edits.global.streetWidth || 1) }));
    for (const c of b.custom) { // 專屬模型地標
      const model = c.lm.model?.[id] || c.lm.model?.all;
      if (model) { this.placeModel(id, group, b.group, c, model); continue; }
      if (c.custom === 'station') { const m = buildStation(c.b.ring, lonLatToXZ(...c.lm.front)); c.height = m.userData.height - 8; b.group.add(m); }
      if (c.custom === 'miyahara') { const m = buildMiyahara(c.b.ring, lonLatToXZ(...c.lm.corner), era); c.height = m.userData.height - 4; b.group.add(m); }
    }
    const layer = ERA_LAYER[id]; group.traverse(o => o.layers.set(layer));
    this.scene.add(group);
    this.eraGroups[id] = { group, buildings: b };
    this.env.clearMaterials(); for (const g of Object.values(this.eraGroups)) this.env.registerMaterials(g.group);
  }
  // 載入地標 glTF 模型；失敗就退回程式模型
  placeModel(id, group, target, c, model) {
    const front = lonLatToXZ(...(model.front || c.lm.front || c.lm.corner || [c.lm.lon, c.lm.lat]));
    loadModel(model.url).then(src => {
      if (this.eraGroups[id]?.group !== group) return; // 已重建
      const m = fitModel(src, c.b.ring, front, model); c.height = m.userData.height;
      m.traverse(o => o.layers.set(ERA_LAYER[id])); target.add(m);
      this.env.registerMaterials(m);
    }).catch(err => {
      console.warn('地標模型載入失敗，改用程式模型', model.url, err);
      const fallback = c.custom === 'station' ? buildStation(c.b.ring, lonLatToXZ(...c.lm.front)) : c.custom === 'miyahara' ? buildMiyahara(c.b.ring, lonLatToXZ(...c.lm.corner), ERAS[id]) : null;
      if (fallback) { fallback.traverse(o => o.layers.set(ERA_LAYER[id])); target.add(fallback); this.env.registerMaterials(fallback); }
    });
  }
  scheduleRebuild(scope) {
    clearTimeout(this._rb);
    this._rb = setTimeout(() => {
      const ids = scope === 'global' || scope === 'all' ? ERA_ORDER : [scope];
      this.refreshInfill();
      for (const id of ids) if (ERAS[id]) this.buildEra(id);
      this.ui?.syncAll?.();
    }, 120);
  }
  setEra(id, { animate = true } = {}) {
    if (id === this.eraId || this.transition) return;
    if (!animate) { this.eraId = id; this.ui?.syncEra(); return; }
    this.transition = { from: this.eraId, to: id, t: 0 };
    this.eraId = id; this.ui?.syncEra();
  }
  frame() {
    const dt = Math.min(0.05, this.clock.getDelta()); const time = this.clock.elapsedTime;
    this.rig.update(dt); this.env.followCamera(this.camera, dt);
    this.applyLens();
    const p = this.photo; const u = this.pipeline.mat.uniforms;
    u.filterId.value = p.on || p.filter ? p.filter : 0; u.grain.value = p.grain; u.vignette.value = p.vignette;
    u.dof.value = p.on && p.aperture > 0 ? 1 : 0; u.aperture.value = p.aperture; u.focusDist.value = p.focus;
    if (this.transition) {
      const tr = this.transition; tr.t += dt / 1.6;
      this.pipeline.render(this.scene, this.camera, { layerA: ERA_LAYER[tr.from], layerB: ERA_LAYER[tr.to], progress: Math.min(1, tr.t), tintA: ERAS[tr.from].tint, tintB: ERAS[tr.to].tint, time });
      if (tr.t >= 1) this.transition = null;
    } else this.pipeline.render(this.scene, this.camera, { layerA: ERA_LAYER[this.eraId], tintA: ERAS[this.eraId].tint, time });
    this.ui?.updateLabels();
  }
  applyLens() {
    // 焦距（35mm 全片幅等效）→ 垂直視角
    const f = this.photo.on ? this.photo.focal : (this.rig.mode === 'walk' ? 28 : 35);
    const fov = THREE.MathUtils.radToDeg(2 * Math.atan(24 / (2 * f)));
    if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
  }
  // 點選建物（編輯模式）
  pick(clientX, clientY) {
    const ray = new THREE.Raycaster(); ray.layers.set(ERA_LAYER[this.eraId]);
    ray.setFromCamera(new THREE.Vector2((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1), this.camera);
    const eg = this.eraGroups[this.eraId];
    const hit = ray.intersectObjects(eg.buildings.meshes, false)[0];
    if (!hit) return null;
    const entry = eg.buildings.index[hit.object.userData.owner[hit.faceIndex]];
    return entry ? { entry, point: hit.point } : null;
  }
  autoFocus() {
    const ray = new THREE.Raycaster(); ray.layers.set(ERA_LAYER[this.eraId]); ray.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const objs = []; this.eraGroups[this.eraId].group.traverse(o => { if (o.isMesh) objs.push(o); });
    const hit = ray.intersectObjects(objs, false)[0];
    return hit ? hit.distance : 200;
  }
  heightOf(entry) { if (entry.height) return entry.height; return GROUND_FLOOR_H + (entry.levels - 1) * FLOOR_H; }
  // 拍照：用較高解析度重畫一張，加上地點與年代戳記
  async capture({ compare = false } = {}) {
    const r = this.renderer; const w = innerWidth, h = innerHeight; const pr0 = r.getPixelRatio();
    const scale = this.photo.scale; r.setPixelRatio(Math.min(4, scale)); this.resize();
    const shots = [];
    const eras = compare ? ERA_ORDER : [this.eraId];
    for (const id of eras) {
      this.pipeline.render(this.scene, this.camera, { layerA: ERA_LAYER[id], tintA: ERAS[id].tint, time: this.clock.elapsedTime });
      shots.push({ id, bmp: await createImageBitmap(r.domElement) });
    }
    r.setPixelRatio(pr0); this.resize();
    const W = shots[0].bmp.width, H = shots[0].bmp.height;
    const out = document.createElement('canvas'); out.width = W * shots.length; out.height = H;
    const x = out.getContext('2d');
    shots.forEach((s, i) => {
      x.drawImage(s.bmp, i * W, 0);
      if (this.photo.stamp) {
        const fs = Math.round(H / 32); x.font = `600 ${fs}px "Noto Serif TC","PMingLiU",serif`; x.textBaseline = 'bottom';
        const txt = `${this.placeName()}　${ERAS[s.id].label}`;
        x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillText(txt, i * W + fs * 1.05 + 2, H - fs * 0.9 + 2);
        x.fillStyle = '#f6efe0'; x.fillText(txt, i * W + fs * 1.05, H - fs * 0.9);
        x.font = `${Math.round(fs * 0.55)}px sans-serif`; x.textAlign = 'right'; x.fillStyle = 'rgba(246,239,224,0.8)';
        x.fillText('今昔時空 TWtimes · © OpenStreetMap contributors', (i + 1) * W - fs, H - fs * 0.9); x.textAlign = 'left';
      }
    });
    return new Promise(res => out.toBlob(res, 'image/jpeg', 0.92));
  }
  placeName() {
    let best = null, bd = 1e9; const p = this.rig.mode === 'walk' ? this.camera.position : this.rig.orbit.target;
    for (const v of VIEWPOINTS) { const [x, z] = lonLatToXZ(v.lon, v.lat); const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = v; } }
    return best && bd < 250 ? best.place : '臺中驛前';
  }
  // 拍攝場景：存下編輯、時代、時間、天氣、鏡頭
  snapshot(name) {
    const c = this.camera, t = this.rig.orbit.target;
    return { name, savedAt: new Date().toISOString(), era: this.eraId, time: this.env.time, weather: this.env.weather, mode: this.rig.mode,
      cam: [c.position.x, c.position.y, c.position.z].map(v => +v.toFixed(2)), target: [t.x, t.y, t.z].map(v => +v.toFixed(2)), yaw: this.rig.yaw, pitch: this.rig.pitch,
      photo: { ...this.photo, on: false }, edits: JSON.parse(this.edits.export()) };
  }
  restore(s) {
    if (s.edits) this.edits.import(JSON.stringify(s.edits));
    this.env.setTime(s.time); this.env.setWeather(s.weather);
    this.setEra(s.era, { animate: false });
    Object.assign(this.photo, s.photo || {}, { on: false });
    this.rig.setMode(s.mode || 'orbit'); this.rig.tween = null;
    this.camera.position.set(...s.cam); this.rig.orbit.target.set(...s.target);
    if (s.mode === 'walk') { this.rig.yaw = s.yaw; this.rig.pitch = s.pitch; this.rig.eye = s.cam[1]; } else this.camera.lookAt(this.rig.orbit.target);
    this.ui.syncAll();
  }
  // 網址可分享：#era=1935&t=17.5&w=rain&v=station
  applyHash() {
    const q = new URLSearchParams(location.hash.slice(1));
    if (q.get('t')) this.env.setTime(+q.get('t'));
    if (q.get('w')) this.env.setWeather(q.get('w'));
    if (q.get('era') && ERAS[q.get('era')]) this.setEra(q.get('era'), { animate: false });
    const v = VIEWPOINTS.find(v => v.key === q.get('v')); if (v) this.goto(v, 0.01);
    this.ui.syncAll();
  }
  shareURL() {
    const q = new URLSearchParams({ era: this.eraId, t: this.env.time.toFixed(1), w: this.env.weather });
    return location.origin + location.pathname + '#' + q.toString();
  }
  goto(v, dur = 2) {
    const [x, z] = lonLatToXZ(v.lon, v.lat);
    const [ex, ez] = lonLatToXZ(v.eye.lon, v.eye.lat);
    const target = new THREE.Vector3(x, v.targetY ?? 6, z);
    if (this.rig.mode === 'walk') {
      const eye = new THREE.Vector3(ex, 1.6, ez); this.rig.eye = 1.6; this.rig.lookFrom(eye, target); this.rig.flyTo(eye, null, dur);
    } else {
      const eye = new THREE.Vector3(ex, v.eye.h ?? 60, ez); this.rig.flyTo(eye, target, dur);
    }
  }
}

const app = new App();
window.twtimes = app;
app.init().catch(e => { console.error(e); app.setStatus('載入失敗：' + e.message); });
