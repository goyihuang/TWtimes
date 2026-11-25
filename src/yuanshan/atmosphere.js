import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { G } from './materials.js';
import { RIVER, SANDO, mulberry, SHRINE } from './geo.js';
import { hAt } from './terrain.js';

const C = (h) => new THREE.Color(h);
const lerpC = (a, b, t) => a.clone().lerp(b, t);

// 依太陽高度角取得光色（度）
function palette(elev) {
  const keys = [
    [-14, { sun: C('#1d2a44'), sunI: 0.0, hemiS: C('#3c4f80'), hemiG: C('#151a24'), hemiI: 0.8, fog: C('#121a28'), mist: C('#1c2638') }],
    [-4, { sun: C('#5e5a8a'), sunI: 0.0, hemiS: C('#4a4f78'), hemiG: C('#1a1820'), hemiI: 0.45, fog: C('#4a4a66'), mist: C('#5f5f78') }],
    [1, { sun: C('#ff7a3d'), sunI: 1.2, hemiS: C('#8f88a8'), hemiG: C('#3d2f28'), hemiI: 0.6, fog: C('#c98c6c'), mist: C('#d8a888') }],
    [7, { sun: C('#ffb36b'), sunI: 2.1, hemiS: C('#93a3c0'), hemiG: C('#4a3e30'), hemiI: 0.5, fog: C('#e0bc98'), mist: C('#ead4bc') }],
    [20, { sun: C('#fff0d8'), sunI: 2.1, hemiS: C('#9fbad8'), hemiG: C('#5a5242'), hemiI: 0.55, fog: C('#a9c0d6'), mist: C('#d5dee2') }],
    [60, { sun: C('#fffaf0'), sunI: 2.2, hemiS: C('#a4c0e0'), hemiG: C('#5d5848'), hemiI: 0.58, fog: C('#a6bfd8'), mist: C('#d8e2e8') }],
  ];
  let i = 0; while (i < keys.length - 2 && elev > keys[i + 1][0]) i++;
  const [e0, a] = keys[i], [e1, b] = keys[i + 1]; const t = THREE.MathUtils.clamp((elev - e0) / (e1 - e0), 0, 1);
  const out = {}; for (const k of Object.keys(a)) out[k] = typeof a[k] === 'number' ? a[k] + (b[k] - a[k]) * t : lerpC(a[k], b[k], t);
  return out;
}

export const WEATHER = {
  clear: { name: '晴', cloud: 0.25, dark: 0, haze: 1.0, mist: 0.15, rain: 0, wind: 0.8 },
  cloudy: { name: '雲', cloud: 0.75, dark: 0.35, haze: 1.3, mist: 0.35, rain: 0, wind: 1.2 },
  rain: { name: '雨', cloud: 1.0, dark: 0.6, haze: 1.9, mist: 0.9, rain: 1, wind: 1.8 },
  fog: { name: '霧', cloud: 0.5, dark: 0.25, haze: 2.4, mist: 3.2, rain: 0, wind: 0.4 },
};

function cloudTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const r = mulberry(3);
  for (let i = 0; i < 46; i++) {
    const px = 128 + (r() - 0.5) * 150, py = 140 + (r() - 0.5) * 60 - Math.abs(px - 128) * 0.15, rad = 22 + r() * 46;
    const g = x.createRadialGradient(px, py, 0, px, py, rad); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(0.6, 'rgba(255,255,255,.2)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(px, py, rad, 0, 7); x.fill();
  }
  const t = new THREE.CanvasTexture(c); return t;
}
function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}

export class Atmosphere {
  constructor(renderer, scene, quality) {
    this.renderer = renderer; this.scene = scene; this.quality = quality;
    this.hour = 16.8; this.weather = 'clear'; this.w = { ...WEATHER.clear }; this.wTarget = WEATHER.clear;
    this.sky = new Sky(); this.sky.scale.setScalar(36000); scene.add(this.sky);
    const u = this.sky.material.uniforms; u.turbidity.value = 6; u.rayleigh.value = 1.6; u.mieCoefficient.value = 0.006; u.mieDirectionalG.value = 0.86;
    this.sun = new THREE.DirectionalLight('#fff', 3); this.sun.castShadow = true;
    const sm = quality === 'low' ? 2048 : 4096; this.sun.shadow.mapSize.set(sm, sm);
    const sc = this.sun.shadow.camera; sc.left = -520; sc.right = 520; sc.top = 520; sc.bottom = -520; sc.near = 10; sc.far = 4200;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.6; this.sun.shadow.radius = 2;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight('#bcd', '#554', 0.8); scene.add(this.hemi);
    scene.fog = new THREE.FogExp2('#c9d7e0', 0.00012);
    this.sunDir = new THREE.Vector3(); this.pmrem = new THREE.PMREMGenerator(renderer); this.envScene = new THREE.Scene();
    this.envSky = new Sky(); this.envSky.scale.setScalar(1000); this.envScene.add(this.envSky);
    this.lastEnv = -99; this.envRT = null;
    this.buildClouds(); this.buildStars(); this.buildRain(); this.buildMotes(); this.buildBirds();
  }

  buildClouds() {
    const tex = cloudTexture(); const N = this.quality === 'low' ? 50 : 90;
    const geo = new THREE.PlaneGeometry(1, 1); const R = mulberry(9);
    this.cloudU = { tCloud: { value: tex }, uSunCol: { value: new THREE.Color() }, uAmb: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3() }, uCover: { value: 0.3 }, uDark: { value: 0 }, uTime: G.uTime, uFog: { value: new THREE.Color() } };
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: this.cloudU,
      vertexShader: `attribute vec4 aCloud; uniform float uTime; varying vec2 vUv; varying float vSeed; varying vec3 vW;
        void main(){ vUv = uv; vSeed = aCloud.w; vec3 c = instanceMatrix[3].xyz; c.x += mod(uTime * (6.0 + aCloud.w * 4.0) + aCloud.w * 9000.0, 24000.0) - 12000.0;
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]); vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec3 p = c + right * position.x * aCloud.x + up * position.y * aCloud.y; vW = p; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `uniform sampler2D tCloud; uniform vec3 uSunCol; uniform vec3 uAmb; uniform vec3 uSunDir; uniform float uCover; uniform float uDark; uniform vec3 uFog; varying vec2 vUv; varying float vSeed; varying vec3 vW;
        void main(){ vec4 t = texture2D(tCloud, vUv); float a = t.a * smoothstep(1.0 - uCover, 1.0 - uCover + 0.25, vSeed * 0.85 + 0.15);
          if (a < 0.01) discard;
          float top = smoothstep(0.2, 0.9, vUv.y);
          vec3 toC = normalize(vW - cameraPosition); float fwd = pow(max(dot(toC, uSunDir), 0.0), 6.0);
          vec3 col = mix(uAmb * 0.85, uSunCol, 0.35 + 0.45 * top) + uSunCol * fwd * 0.8 * (1.0 - t.a);
          col = mix(col, col * 0.45 + uAmb * 0.2, uDark);
          float d = length(vW - cameraPosition); col = mix(col, uFog, smoothstep(6000.0, 18000.0, d) * 0.7);
          gl_FragColor = vec4(col, a * 0.92); }`,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, N); const a = new Float32Array(N * 4); const m4 = new THREE.Matrix4();
    for (let i = 0; i < N; i++) {
      const ang = R() * Math.PI * 2, r = 1500 + R() * 13000, s = 1200 + R() * 2600;
      m4.makeTranslation(Math.cos(ang) * r, 700 + R() * 1300, Math.sin(ang) * r); mesh.setMatrixAt(i, m4); a.set([s, s * (0.35 + R() * 0.25), 0, R()], i * 4);
    }
    geo.setAttribute('aCloud', new THREE.InstancedBufferAttribute(a, 4)); mesh.frustumCulled = false; mesh.renderOrder = -1;
    this.clouds = mesh; this.scene.add(mesh);
  }

  buildStars() {
    const N = 2600, p = new Float32Array(N * 3), s = new Float32Array(N); const R = mulberry(41);
    for (let i = 0; i < N; i++) { const u = R() * 2 - 1, a = R() * Math.PI * 2, r = 30000; const y = Math.abs(u) * 0.95 + 0.05; const q = Math.sqrt(1 - y * y); p.set([Math.cos(a) * q * r, y * r, Math.sin(a) * q * r], i * 3); s[i] = Math.pow(R(), 6) * 3 + 0.6; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('aSize', new THREE.Float32BufferAttribute(s, 1));
    this.starU = { uNight: { value: 0 }, uTime: G.uTime };
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: this.starU,
      vertexShader: `attribute float aSize; uniform float uTime; varying float vTw; void main(){ vTw = 0.6 + 0.4 * sin(uTime * 2.0 + position.x * 0.01); gl_PointSize = aSize * 1.6; gl_Position = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0); }`,
      fragmentShader: `uniform float uNight; varying float vTw; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * vTw * uNight * smoothstep(0.5, 0.0, d), 1.0); }` });
    this.stars = new THREE.Points(g, m); this.stars.frustumCulled = false; this.scene.add(this.stars);
    // 月
    const mm = new THREE.SpriteMaterial({ map: dotTexture(), color: '#fff6e0', transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
    this.moon = new THREE.Sprite(mm); this.moon.scale.setScalar(900); this.scene.add(this.moon);
  }

  buildRain() {
    const N = this.quality === 'low' ? 5000 : 12000; const p = new Float32Array(N * 6); const R = mulberry(5);
    for (let i = 0; i < N; i++) { const x = (R() - 0.5) * 160, y = R() * 90, z = (R() - 0.5) * 160; p.set([x, y, z, x, y, z], i * 6); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    const end = new Float32Array(N * 2); for (let i = 0; i < N; i++) end[i * 2 + 1] = 1; g.setAttribute('aEnd', new THREE.Float32BufferAttribute(end, 1));
    this.rainU = { uTime: G.uTime, uAmt: { value: 0 }, uCam: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color('#c8d2da') } };
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: this.rainU,
      vertexShader: `attribute float aEnd; uniform float uTime; uniform vec3 uCam; varying float vA;
        void main(){ vec3 p = position; p.y = mod(p.y - uTime * 38.0, 90.0); p.xz = mod(p.xz - uCam.xz + 80.0, 160.0) - 80.0; p += vec3(uCam.x, uCam.y - 30.0, uCam.z);
          p += vec3(0.25, 1.0, 0.1) * aEnd * 1.6; p.x -= p.y * 0.0; vA = 1.0 - aEnd * 0.8; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `uniform float uAmt; uniform vec3 uCol; varying float vA; void main(){ gl_FragColor = vec4(uCol, 0.35 * uAmt * vA); }` });
    this.rain = new THREE.LineSegments(g, m); this.rain.frustumCulled = false; this.scene.add(this.rain);
  }

  buildMotes() {
    // 螢火蟲（山腳、參道）＋ 光塵 ＋ 落葉
    const R = mulberry(12); const N = 900; const p = new Float32Array(N * 3), k = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      let x, z;
      if (i < 520) { const s = SANDO[Math.floor(R() * SANDO.length)]; x = s[0] + (R() - 0.5) * 120; z = s[1] + (R() - 0.5) * 120; }
      else { x = SHRINE.x - 240 + R() * 600; z = SHRINE.z + 60 + R() * 380; }
      p.set([x, hAt(x, z) + 1 + R() * 9, z], i * 3); k.set([i < 520 ? 0 : 1, R()], i * 2);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('aK', new THREE.Float32BufferAttribute(k, 2));
    this.moteU = { uTime: G.uTime, uNight: { value: 0 }, uDay: { value: 1 }, uFire: { value: 1 }, tDot: { value: dotTexture() }, uPx: { value: 1 } };
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: this.moteU,
      vertexShader: `attribute vec2 aK; uniform float uTime; uniform float uNight; uniform float uDay; uniform float uFire; uniform float uPx; varying float vA; varying vec3 vC;
        void main(){ vec3 p = position; float s = aK.y * 6.28;
          p += vec3(sin(uTime * 0.35 + s * 3.0) * 4.0, sin(uTime * 0.5 + s) * 1.6, cos(uTime * 0.3 + s * 2.0) * 4.0);
          vec4 mv = viewMatrix * vec4(p, 1.0);
          float blink = pow(0.5 + 0.5 * sin(uTime * (1.5 + aK.y * 2.0) + s * 5.0), 3.0);
          if (aK.x < 0.5) { vA = blink * uNight * uFire; vC = vec3(0.75, 1.0, 0.45); gl_PointSize = 26.0 * uPx / -mv.z * 8.0; }
          else { vA = uDay * 0.35 * (0.5 + 0.5 * sin(uTime * 0.8 + s)); vC = vec3(1.0, 0.9, 0.7); gl_PointSize = 16.0 * uPx / -mv.z * 8.0; }
          gl_PointSize = clamp(gl_PointSize, 0.0, 40.0);
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D tDot; varying float vA; varying vec3 vC; void main(){ vec4 t = texture2D(tDot, gl_PointCoord); gl_FragColor = vec4(vC * t.a * vA * 2.0, 1.0); }` });
    this.motes = new THREE.Points(g, m); this.motes.frustumCulled = false; this.scene.add(this.motes);
  }

  buildBirds() {
    // 白鷺鷥群：沿河盤旋
    const N = 26; const g = new THREE.BufferGeometry();
    const v = [0, 0, 0.5, 0, 0, -0.4, -1.6, 0, -0.1, 0, 0, 0.5, 1.6, 0, -0.1, 0, 0, -0.4, 0, 0, 0.6, 0, 0.05, -0.6, 0, -0.12, 0.2];
    const side = [0, 0, -1, 0, 1, 0, 0, 0, 0];
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1)); g.computeVertexNormals();
    const mat = new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: { uTime: G.uTime, uCol: { value: new THREE.Color('#f4f2ea') }, uLight: { value: 1 } },
      vertexShader: `attribute float aSide; uniform float uTime; varying float vS; void main(){ vec3 p = position; float ph = uTime * 6.0 + float(gl_InstanceID) * 1.7; p.y += abs(aSide) * sin(ph) * 0.9 * abs(p.x) / 1.6; vS = 0.75 + 0.25 * sin(ph); gl_Position = projectionMatrix * viewMatrix * instanceMatrix * vec4(p, 1.0); }`,
      fragmentShader: `uniform vec3 uCol; uniform float uLight; varying float vS; void main(){ gl_FragColor = vec4(uCol * vS * uLight, 1.0); }` });
    this.birds = new THREE.InstancedMesh(g, mat, N); this.birds.frustumCulled = false; this.scene.add(this.birds);
    this.birdSeed = Array.from({ length: N }, (_, i) => ({ a: i / N * 6.28, r: 80 + (i % 7) * 14, h: 28 + (i % 5) * 6, s: 0.08 + (i % 3) * 0.015, o: Math.sin(i * 3.1) * 30 }));
  }

  setWeather(name) { this.weather = name; this.wTarget = WEATHER[name]; }

  update(dt, t, camera, focus, eraFire) {
    // 天氣插值
    const k = 1 - Math.exp(-dt * 1.6); for (const key of ['cloud', 'dark', 'haze', 'mist', 'rain', 'wind']) this.w[key] += (this.wTarget[key] - this.w[key]) * k;
    const w = this.w;
    // 太陽方位：臺北緯度，正午偏南
    const hr = this.hour; const ha = (hr - 12) / 24 * Math.PI * 2;
    const decl = 0.25, lat = 0.437;
    const sinE = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
    const elev = Math.asin(sinE);
    const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat));
    // az 從南起算，往西為正 → 世界座標：南 = +z、西 = -x
    this.sunDir.set(-Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev)).normalize();
    const elevDeg = THREE.MathUtils.radToDeg(elev);
    const P = palette(elevDeg);
    const dark = w.dark;
    const night = THREE.MathUtils.clamp((-elevDeg - 1) / 8, 0, 1);
    G.uNight.value = Math.max(night, THREE.MathUtils.smoothstep(-elevDeg, -6, 2) * 0.6, dark * 0.35 * (1 - THREE.MathUtils.smoothstep(elevDeg, 10, 40)));
    this.night = night;
    // 天空
    const su = this.sky.material.uniforms;
    su.sunPosition.value.copy(this.sunDir).multiplyScalar(1000);
    su.time.value = t; su.cloudCoverage.value = 0.15 + w.cloud * 0.6; su.cloudDensity.value = 0.35 + dark * 0.5;
    su.turbidity.value = 2.2 + w.haze * 1.6 + dark * 6; su.rayleigh.value = 1.5 + w.haze * 0.3 - dark * 0.8; su.mieCoefficient.value = 0.004 + w.haze * 0.003;
    // 主光
    const sunI = P.sunI * (1 - dark * 0.75) * (1 - w.rain * 0.2);
    this.sun.color.copy(P.sun); this.sun.intensity = sunI;
    if (night > 0.5) { this.sun.color.set('#9cb4e6'); this.sun.intensity = 0.9 * (1 - dark * 0.6); }
    const lightDir = night > 0.5 ? new THREE.Vector3(0.3, 0.8, -0.4).normalize() : (this.sunDir.y < 0.03 ? this.sunDir.clone().setY(0.03).normalize() : this.sunDir);
    this.sun.position.copy(focus).addScaledVector(lightDir, 2000); this.sun.target.position.copy(focus);
    this.hemi.color.copy(P.hemiS).lerp(C('#8a9096'), dark * 0.6); this.hemi.groundColor.copy(P.hemiG); this.hemi.intensity = P.hemiI * (1 + dark * 0.3);
    // 霧
    const fogC = P.fog.clone().lerp(C(night > 0.5 ? '#1a2029' : '#9ea6ab'), dark * 0.65);
    this.scene.fog.color.copy(fogC);
    G.uMistColor.value.copy(P.mist).lerp(fogC, dark * 0.5);
    const dawn = Math.exp(-Math.pow((hr - 6.4) / 1.2, 2)) * (1 - w.rain) * 0.55;
    G.uMist.value.set(0.000105 * w.haze, 0.0022 * (w.mist + dawn * 1.4), 2, 22 + (w.mist + dawn) * 14);
    G.uWind.value = w.wind; G.uWet.value = THREE.MathUtils.clamp(w.rain * 1.1, 0, 1);
    this.renderer.toneMappingExposure = 0.6 * (night > 0.5 ? 1.7 : 1) * (1 - dark * 0.1);
    // 雲
    const cu = this.cloudU; cu.uSunCol.value.copy(P.sun).multiplyScalar(night > 0.5 ? 0.15 : 1.1); cu.uAmb.value.copy(P.hemiS).multiplyScalar(night > 0.5 ? 0.25 : 1); cu.uSunDir.value.copy(this.sunDir); cu.uCover.value = w.cloud; cu.uDark.value = dark; cu.uFog.value.copy(fogC);
    this.starU.uNight.value = night * (1 - w.cloud * 0.8);
    this.moon.position.copy(camera.position).add(new THREE.Vector3(-0.5, 0.45, -0.75).normalize().multiplyScalar(26000)); this.moon.material.opacity = night * (1 - w.cloud * 0.7);
    this.rainU.uAmt.value = w.rain; this.rainU.uCam.value.copy(camera.position); this.rain.visible = w.rain > 0.02;
    this.moteU.uNight.value = night * (1 - w.rain); this.moteU.uDay.value = (1 - night) * (1 - dark) * (elevDeg < 25 ? 1 : 0.4); this.moteU.uFire.value = eraFire;
    this.moteU.uPx.value = this.renderer.getPixelRatio();
    // 鳥
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3(1.4, 1.4, 1.4);
    this.birds.visible = night < 0.6 && w.rain < 0.5;
    this.birds.material.uniforms.uLight.value = 0.5 + 0.5 * Math.min(1, sunI / 2);
    this.birdSeed.forEach((b, i) => {
      const a = b.a + t * b.s; pos.set(-120 + Math.cos(a) * b.r * 1.8 + b.o, b.h + Math.sin(t * 0.7 + i) * 3, -40 + Math.sin(a) * b.r * 0.8);
      const dir = new THREE.Vector3(-Math.sin(a) * b.r * 1.8, 0, Math.cos(a) * b.r * 0.8).normalize();
      q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir); m4.compose(pos, q, sc); this.birds.setMatrixAt(i, m4);
    });
    this.birds.instanceMatrix.needsUpdate = true;
    // 環境光照貼圖（依太陽變化重算）
    const envKey = Math.round(elevDeg * 2) + Math.round(dark * 10) * 1000;
    if (envKey !== this.lastEnv) {
      this.lastEnv = envKey; const eu = this.envSky.material.uniforms;
      for (const kk of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) eu[kk].value = su[kk].value;
      eu.sunPosition.value.copy(this.sunDir).multiplyScalar(100); if (this.sunDir.y < -0.05) eu.sunPosition.value.set(0, -1, 0);
      const rt = this.pmrem.fromScene(this.envScene, 0, 0.1, 2000);
      if (this.envRT) this.envRT.dispose(); this.envRT = rt; this.scene.environment = rt.texture;
      this.scene.environmentIntensity = night > 0.5 ? 0.2 : 0.32 * (1 - dark * 0.3);
    }
    return { elevDeg, P, night };
  }
}
