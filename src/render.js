import * as THREE from 'three';

// 後製管線：兩個時代各自畫到離屏畫布，再用「時光泡泡」漸層混合；
// 同一個 shader 也負責景深、濾鏡、顆粒、暗角與色調映射。
export const FILTERS = [
  { id: 0, label: '原色' }, { id: 1, label: '黑白' }, { id: 2, label: '復古褐' },
  { id: 3, label: '手彩明信片' }, { id: 4, label: '彩色底片' }, { id: 5, label: '藍調夜色' },
];

const vert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const frag = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tA, tB, tDepth;
uniform float progress, aspect, time, exposure, grain, vignette, focusDist, aperture, near, far;
uniform int transition, filterId, dof;
uniform vec2 center, texel;
uniform vec3 tintA, tintB;

float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
float linDepth(float d){ float z = d * 2.0 - 1.0; return (2.0 * near * far) / (far + near - z * (far - near)); }
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }

vec3 sampleDof(sampler2D t, vec2 uv){
  vec3 base = texture2D(t, uv).rgb;
  if (dof == 0) return base;
  float d = linDepth(texture2D(tDepth, uv).r);
  float coc = clamp(abs(d - focusDist) / max(d, 0.1) * aperture, 0.0, 1.0);
  if (coc < 0.02) return base;
  vec3 acc = base; float w = 1.0;
  for (int i = 0; i < 32; i++) {
    float a = float(i) * 2.39996; float r = sqrt(float(i) + 0.5) / sqrt(32.0);
    vec2 o = vec2(cos(a), sin(a)) * r * coc * 18.0 * texel * vec2(1.0, 1.0);
    vec2 suv = uv + o;
    float sd = linDepth(texture2D(tDepth, suv).r);
    float scoc = clamp(abs(sd - focusDist) / max(sd, 0.1) * aperture, 0.0, 1.0);
    float ww = smoothstep(0.0, 0.2, scoc + 0.05);
    acc += texture2D(t, suv).rgb * ww; w += ww;
  }
  return acc / w;
}

void main(){
  vec3 a = sampleDof(tA, vUv) * tintA;
  vec3 col = a;
  float ring = 0.0;
  if (transition == 1) {
    vec3 b = texture2D(tB, vUv).rgb * tintB;
    vec2 p = (vUv - center) * vec2(aspect, 1.0);
    float d = length(p) + (hash(floor(vUv * 90.0)) - 0.5) * 0.025;
    float r = progress * 1.9;
    float m = smoothstep(r - 0.05, r, d);
    col = mix(b, a, m);
    ring = exp(-pow((d - r) / 0.018, 2.0)) * (1.0 - progress);
  }
  col *= exposure;
  col = aces(col);
  col += vec3(1.0, 0.78, 0.45) * ring * 0.9;
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  if (filterId == 1) col = vec3(pow(l, 1.1)) * 1.04;
  else if (filterId == 2) { col = vec3(l) * vec3(1.07, 0.92, 0.72) + vec3(0.04, 0.03, 0.0); col = mix(col, vec3(0.82, 0.74, 0.6), 0.12); }
  else if (filterId == 3) { col = mix(vec3(l), col, 0.55) * vec3(1.05, 0.98, 0.86) + 0.05; col = mix(col, vec3(0.95,0.9,0.8), 0.1); }
  else if (filterId == 4) { col = (col - 0.5) * 1.12 + 0.5; col = mix(col, col * vec3(0.9, 1.0, 1.08), 1.0 - l); col *= vec3(1.06, 1.0, 0.92); }
  else if (filterId == 5) { col = col * vec3(0.8, 0.92, 1.15); }
  vec2 q = vUv - 0.5; col *= 1.0 - vignette * smoothstep(0.25, 0.85, length(q * vec2(aspect, 1.0) * 0.9));
  col += (hash(vUv * 1000.0 + fract(time) * 37.0) - 0.5) * grain;
  gl_FragColor = vec4(toSRGB(clamp(col, 0.0, 1.0)), 1.0);
}`;

export class Pipeline {
  constructor(renderer) {
    this.renderer = renderer;
    const mk = () => { const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 }); rt.depthTexture = new THREE.DepthTexture(4, 4); return rt; };
    this.rtA = mk(); this.rtB = mk();
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, depthTest: false, depthWrite: false,
      uniforms: {
        tA: { value: null }, tB: { value: null }, tDepth: { value: null }, progress: { value: 0 }, aspect: { value: 1 }, time: { value: 0 }, exposure: { value: 1 },
        grain: { value: 0.025 }, vignette: { value: 0.35 }, focusDist: { value: 30 }, aperture: { value: 0 }, near: { value: 0.1 }, far: { value: 5000 },
        transition: { value: 0 }, filterId: { value: 0 }, dof: { value: 0 }, center: { value: new THREE.Vector2(0.5, 0.5) }, texel: { value: new THREE.Vector2() },
        tintA: { value: new THREE.Vector3(1, 1, 1) }, tintB: { value: new THREE.Vector3(1, 1, 1) },
      },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat); this.quad.frustumCulled = false;
    this.qScene = new THREE.Scene(); this.qScene.add(this.quad); this.qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  setSize(w, h) {
    const pr = this.renderer.getPixelRatio();
    this.rtA.setSize(w * pr, h * pr); this.rtB.setSize(w * pr, h * pr);
    this.mat.uniforms.aspect.value = w / h; this.mat.uniforms.texel.value.set(1 / (w * pr), 1 / (h * pr));
  }
  // layerA：目前（或轉場的「舊」）時代；layerB：轉場目標時代
  render(scene, camera, { layerA, layerB = null, progress = 0, tintA, tintB, time = 0 }) {
    const r = this.renderer; const u = this.mat.uniforms;
    const tm = r.toneMapping; r.toneMapping = THREE.NoToneMapping;
    camera.layers.set(0); camera.layers.enable(layerA);
    r.setRenderTarget(this.rtA); r.render(scene, camera);
    if (layerB !== null) { camera.layers.set(0); camera.layers.enable(layerB); r.setRenderTarget(this.rtB); r.render(scene, camera); }
    camera.layers.set(0); camera.layers.enable(layerB ?? layerA);
    u.tA.value = this.rtA.texture; u.tB.value = this.rtB.texture; u.tDepth.value = this.rtA.depthTexture;
    u.transition.value = layerB !== null ? 1 : 0; u.progress.value = progress; u.time.value = time;
    u.near.value = camera.near; u.far.value = camera.far; u.exposure.value = r.toneMappingExposure;
    u.tintA.value.set(...tintA); u.tintB.value.set(...(tintB || tintA));
    r.setRenderTarget(null); r.render(this.qScene, this.qCam);
    r.toneMapping = tm;
  }
}
