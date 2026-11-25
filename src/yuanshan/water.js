import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { G } from './materials.js';

// 可平鋪的水面法線圖：整數頻率正弦波疊加
function waterNormals(N = 256) {
  const H = new Float32Array(N * N);
  const waves = [];
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 48; k++) { const f = 1 + Math.floor(rnd() * (k < 10 ? 4 : 18)); const a = rnd() * Math.PI * 2; waves.push([Math.round(Math.cos(a) * f), Math.round(Math.sin(a) * f), rnd() * 6.28, 1 / (f * 0.9 + 0.6)]); }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { let h = 0; for (const [fx, fy, p, amp] of waves) h += Math.sin((fx * i + fy * j) / N * Math.PI * 2 + p) * amp; H[j * N + i] = h; }
  const d = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const hx = H[j * N + (i + 1) % N] - H[j * N + (i - 1 + N) % N], hy = H[((j + 1) % N) * N + i] - H[((j - 1 + N) % N) * N + i];
    const v = new THREE.Vector3(-hx * 0.9, -hy * 0.9, 1).normalize();
    const k = (j * N + i) * 4; d[k] = (v.x * 0.5 + 0.5) * 255; d[k + 1] = (v.y * 0.5 + 0.5) * 255; d[k + 2] = (v.z * 0.5 + 0.5) * 255; d[k + 3] = 255;
  }
  const t = new THREE.DataTexture(d, N, N); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

export function buildWater(scene, quality) {
  const geo = new THREE.PlaneGeometry(40000, 40000);
  const res = quality === 'low' ? 512 : 1024;
  const water = new Water(geo, {
    textureWidth: res, textureHeight: res, waterNormals: waterNormals(), sunDirection: new THREE.Vector3(0.5, 0.5, 0), sunColor: 0xffffff,
    waterColor: 0x2c4a44, distortionScale: 2.2, fog: true,
  });
  water.rotation.x = -Math.PI / 2; water.position.y = 0.0; water.name = 'river';
  const m = water.material;
  m.defines = { ...(m.defines || {}), USE_MIST: '' };
  Object.assign(m.uniforms, { uMist: G.uMist, uMistColor: G.uMistColor, uRf0: { value: 0.12 }, uRain: { value: 0 }, uSilt: { value: new THREE.Color('#5d6b4f') } });
  m.fragmentShader = m.fragmentShader
    .replace('uniform vec3 waterColor;', `uniform vec3 waterColor; uniform float uRf0; uniform float uRain; uniform vec3 uSilt;
float wh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rainRip(vec2 p, float t){
  vec2 c = floor(p); float acc = 0.0;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
    vec2 g = c + vec2(i, j); float r = wh(g); vec2 o = g + vec2(wh(g + 3.1), wh(g + 7.7));
    float ph = fract(t * 0.9 + r); float d = length(p - o);
    acc += sin((d - ph * 1.2) * 28.0) * (1.0 - ph) * step(d, ph * 1.2 + 0.05) * step(ph * 1.2 - 0.25, d);
  }
  return acc;
}`)
    .replace('vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );', `vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );
if (uRain > 0.01) {
  vec2 rp = worldPosition.xz * 0.9; float e = 0.05;
  float r0 = rainRip(rp, time), rx = rainRip(rp + vec2(e, 0.0), time), rz = rainRip(rp + vec2(0.0, e), time);
  surfaceNormal = normalize(surfaceNormal + vec3(r0 - rx, 0.0, r0 - rz) * 0.6 * uRain);
}`)
    .replace('float rf0 = 0.02;', 'float rf0 = uRf0;')
    .replace('vec3 scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ) * waterColor;', `float silt = 0.5 + 0.5 * sin(worldPosition.x * 0.004 + worldPosition.z * 0.006);
vec3 scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ) * mix(waterColor, uSilt, silt * 0.35);`);
  m.needsUpdate = true;
  scene.add(water);
  return water;
}
