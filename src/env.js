import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

// 環境：太陽／月光、天空、霧、天氣（晴、多雲、雨、霧）、星空
export const WEATHERS = {
  clear: { label: '晴', turbidity: 3, rayleigh: 1.2, sun: 1, fog: 0.0005, cloud: 0 },
  cloudy: { label: '多雲', turbidity: 12, rayleigh: 2.5, sun: 0.35, fog: 0.0016, cloud: 0.7 },
  rain: { label: '雨', turbidity: 20, rayleigh: 3, sun: 0.12, fog: 0.0035, cloud: 1, rain: true },
  fog: { label: '霧', turbidity: 15, rayleigh: 2, sun: 0.25, fog: 0.009, cloud: 0.8 },
};

export class Environment {
  constructor(renderer, scene) {
    this.renderer = renderer; this.scene = scene;
    this.sky = new Sky(); this.sky.scale.setScalar(20000); scene.add(this.sky);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    const s = this.sun.shadow; s.mapSize.set(4096, 4096); s.camera.near = 10; s.camera.far = 1500;
    Object.assign(s.camera, { left: -260, right: 260, top: 260, bottom: -260 }); s.bias = -0.0004; s.normalBias = 0.6; s.camera.layers.enableAll();
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xcfe3ff, 0x8a7a60, 1.0); scene.add(this.hemi);
    for (const l of [this.sun, this.hemi]) l.layers.enableAll();
    this.fog = new THREE.FogExp2(0xc8d2dc, 0.001); scene.fog = this.fog;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene(); this.envSky = new Sky(); this.envSky.scale.setScalar(1000); this.envScene.add(this.envSky);
    this.stars = makeStars(); scene.add(this.stars);
    this.rain = makeRain(); scene.add(this.rain);
    this.nightDome = makeNightDome(); scene.add(this.nightDome);
    this.glow = new THREE.Group(); // 路燈光暈由 ground builder 加入
    this.glow.material = { opacity: 0 };
    this.time = 15.5; this.weather = 'clear'; this.night = 0; this.nightMaterials = []; this.wetMaterials = []; this.waterMaterials = [];
    this.apply();
  }
  registerMaterials(root) {
    root.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) { if (m.userData.night) this.nightMaterials.push(m); if (m.userData.wet) this.wetMaterials.push(m); if (m.userData.water) this.waterMaterials.push(m); if (m.userData.glow) (this.glowMaterials ||= []).push(m); } });
    this.applyMaterials();
  }
  clearMaterials() { this.glowMaterials = []; this.nightMaterials = []; this.wetMaterials = []; this.waterMaterials = []; }
  setTime(h) { this.time = h; this.apply(); }
  setWeather(w) { this.weather = w; this.apply(); }
  sunDirection(h) {
    // 簡化的太陽軌跡（台中北緯 24°，約春秋分）：6 點日出、12 點最高、18 點日落
    const el = Math.sin(((h - 6) / 12) * Math.PI) * 66 * Math.PI / 180;
    const az = (90 + ((h - 6) / 12) * 180) * Math.PI / 180; // 由北順時針
    return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
  }
  apply() {
    const w = WEATHERS[this.weather]; const h = this.time;
    const dir = this.sunDirection(h);
    const day = THREE.MathUtils.smoothstep(dir.y, -0.08, 0.12);
    this.night = 1 - day;
    for (const sk of [this.sky, this.envSky]) {
      const u = sk.material.uniforms;
      u.turbidity.value = w.turbidity; u.rayleigh.value = w.rayleigh; u.mieCoefficient.value = 0.005 + w.cloud * 0.02; u.mieDirectionalG.value = 0.8;
      u.sunPosition.value.copy(dir.y > -0.2 ? dir : dir.clone().setY(-0.2));
    }
    const golden = THREE.MathUtils.smoothstep(dir.y, 0.0, 0.35);
    const sunCol = new THREE.Color().setRGB(1, 0.62 + golden * 0.36, 0.38 + golden * 0.55);
    if (day > 0.02) {
      this.sun.position.copy(dir).multiplyScalar(600); this.sun.color.copy(sunCol);
      this.sun.intensity = 3.2 * day * w.sun;
    } else { // 月光
      const m = this.sunDirection(h + 12); this.sun.position.copy(m).multiplyScalar(600); this.sun.color.setRGB(0.6, 0.7, 1.0); this.sun.intensity = 0.25 * w.sun;
    }
    const grey = new THREE.Color(0x8d939a);
    this.hemi.color.setRGB(0.75, 0.85, 1.0).lerp(grey, w.cloud * 0.6);
    this.hemi.intensity = THREE.MathUtils.lerp(1.1, 0.45 + w.cloud * 0.6, day);
    if (day < 0.5) this.hemi.color.lerp(new THREE.Color(0x6f86c0), 1 - day * 2);
    this.nightDome.material.uniforms.k.value = this.night; this.glow.material.opacity = this.night * 0.9;
    const fogDay = new THREE.Color(0xc6d3df).lerp(new THREE.Color(0xb6b9bc), w.cloud).lerp(new THREE.Color(0xe7c39a), (1 - golden) * day * 0.5);
    this.fog.color.copy(fogDay.lerp(new THREE.Color(0x1a2236), this.night));
    this.fog.density = w.fog;
    this.stars.material.opacity = this.night * (1 - w.cloud);
    this.rain.visible = !!w.rain;
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(1.5, 0.85, day) * (1 + w.cloud * 0.25);
    this.sky.material.uniforms.rayleigh.value = w.rayleigh * (0.3 + day * 0.7);
    this.updateEnvMap();
    this.applyMaterials();
  }
  applyMaterials() {
    const w = WEATHERS[this.weather]; const night = this.night; const dusk = Math.max(night, (WEATHERS[this.weather].cloud > 0.9 ? 0.25 : 0));
    for (const m of this.nightMaterials) m.emissiveIntensity = dusk * (m.userData.nightBoost || 1) * 0.55;
    for (const m of this.glowMaterials || []) m.opacity = this.night * 0.85;
    for (const m of this.wetMaterials) { m.roughness = w.rain ? 0.25 : 0.95; m.color.setScalar(w.rain ? 0.7 : 1); }
    for (const m of this.waterMaterials) m.roughness = w.rain ? 0.3 : 0.06;
  }
  updateEnvMap() {
    clearTimeout(this._envT);
    this._envT = setTimeout(() => {
      const rt = this.pmrem.fromScene(this.envScene, 0, 1, 2000);
      if (this.scene.environment) this.scene.environment.dispose();
      this.scene.environment = rt.texture;
      this.scene.environmentIntensity = THREE.MathUtils.lerp(0.04, 0.3, 1 - this.night) * (1 - WEATHERS[this.weather].cloud * 0.3);
    }, 30);
  }
  followCamera(camera, dt) {
    // 陰影範圍跟著鏡頭走
    const t = camera.position.clone(); const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    t.addScaledVector(fwd, Math.min(150, 40 + camera.position.y)); t.y = 0;
    const snap = 4; t.x = Math.round(t.x / snap) * snap; t.z = Math.round(t.z / snap) * snap;
    const off = this.sun.position.clone().sub(this.sun.target.position);
    this.sun.target.position.copy(t); this.sun.position.copy(t).add(off);
    this.stars.position.copy(camera.position);
    if (this.rain.visible) {
      this.rain.position.set(camera.position.x, 0, camera.position.z);
      const p = this.rain.geometry.attributes.position; const a = p.array;
      for (let i = 0; i < a.length; i += 6) { a[i + 1] -= dt * 28; a[i + 4] -= dt * 28; if (a[i + 4] < 0) { const y = 30 + Math.random() * 10; a[i + 1] = y; a[i + 4] = y - 0.7; } }
      p.needsUpdate = true;
    }
  }
}
function makeStars() {
  const n = 1500, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection(); v.y = Math.abs(v.y) + 0.05; v.normalize().multiplyScalar(9000); pos.set([v.x, v.y, v.z], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  p.frustumCulled = false; return p;
}
function makeRain() {
  const n = 7000, pos = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) { const x = (Math.random() - 0.5) * 120, z = (Math.random() - 0.5) * 120, y = Math.random() * 40; pos.set([x, y, z, x + 0.05, y - 0.7, z], i * 6); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xaab4c0, transparent: true, opacity: 0.45 }));
  l.frustumCulled = false; l.visible = false; return l;
}

function makeNightDome() {
  // 夜空：天頂深藍、地平線帶一點城市光害的暖色
  const m = new THREE.ShaderMaterial({
    uniforms: { k: { value: 0 } }, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float k; varying vec3 vP; void main(){ float h = clamp(vP.y, 0.0, 1.0); vec3 c = mix(vec3(0.16,0.12,0.11), vec3(0.012,0.02,0.05), pow(h, 0.35)); gl_FragColor = vec4(c, k); }',
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(15000, 32, 16), m); s.renderOrder = -1; s.frustumCulled = false; return s;
}
