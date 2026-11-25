import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

// 時代調色＋光芒＋暗角＋紙紋＋顆粒
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 },
    uSat: { value: 1 }, uCon: { value: 1 }, uWarm: { value: 0 }, uSepia: { value: 0 }, uLift: { value: 0 }, uVig: { value: 0.3 }, uGrain: { value: 0.03 }, uPaper: { value: 0 }, uTeal: { value: 0 },
    uSun: { value: new THREE.Vector2(0.5, 0.5) }, uSunVis: { value: 0 }, uSunCol: { value: new THREE.Color(1, 0.9, 0.7) }, uFade: { value: 0 }, uFlash: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uTime;
    uniform float uSat, uCon, uWarm, uSepia, uLift, uVig, uGrain, uPaper, uTeal, uSunVis, uFade, uFlash;
    uniform vec2 uSun; uniform vec3 uSunCol; varying vec2 vUv;
    float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h12(i), h12(i+vec2(1,0)), f.x), mix(h12(i+vec2(0,1)), h12(i+vec2(1,1)), f.x), f.y); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      // 光芒（螢幕空間放射模糊）
      if (uSunVis > 0.001) {
        vec2 d = (uSun - vUv) / 40.0; vec2 p = vUv; float acc = 0.0; float w = 1.0;
        for (int i = 0; i < 40; i++) { p += d; vec3 s = texture2D(tDiffuse, p).rgb; float l = dot(s, vec3(0.3, 0.6, 0.1)); acc += smoothstep(0.72, 1.0, l) * w; w *= 0.965; }
        float asp = uRes.x / uRes.y; float r = length((vUv - uSun) * vec2(asp, 1.0));
        c += uSunCol * acc / 40.0 * uSunVis * 1.35 * (1.0 - smoothstep(0.0, 1.1, r));
      }
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, uSat);
      c = (c - 0.5) * uCon + 0.5;
      c += uLift * vec3(0.9, 0.95, 1.0) * (1.0 - l);
      // 暖調、青橙分離
      c *= mix(vec3(1.0), vec3(1.07, 1.0, 0.88), uWarm);
      c = mix(c, c * vec3(0.9, 1.0, 1.08) , uTeal * (1.0 - smoothstep(0.2, 0.6, l)));
      c = mix(c, c * vec3(1.06, 1.0, 0.92), uTeal * smoothstep(0.45, 0.9, l));
      // 褐調
      vec3 sep = vec3(l) * vec3(1.12, 0.98, 0.78) + vec3(0.04, 0.02, 0.0);
      c = mix(c, sep, uSepia);
      // 紙紋與手彩不均
      if (uPaper > 0.0) {
        float fib = vn(vUv * uRes / 3.0) * 0.6 + vn(vUv * uRes / 40.0) * 0.4;
        c = mix(c, c * (0.92 + 0.12 * fib) + vec3(0.03, 0.025, 0.0), uPaper);
        c = mix(c, c * vec3(1.02, 1.0, 0.95), uPaper * vn(vUv * 6.0));
      }
      // 暗角
      vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y * 0.7;
      c *= 1.0 - uVig * smoothstep(0.25, 0.95, length(q) * 1.25);
      // 顆粒
      float g = h12(vUv * uRes + fract(uTime) * 113.0) - 0.5; c += g * uGrain * (0.6 + 0.4 * (1.0 - l));
      c = mix(c, vec3(1.0, 0.96, 0.88), uFlash);
      c = mix(c, vec3(0.06, 0.05, 0.04), uFade);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

// 膠彩／水彩筆觸：Kuwahara 濾鏡
const KuwaharaShader = {
  uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uR: { value: 4 } },
  vertexShader: GradeShader.vertexShader,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uR; varying vec2 vUv;
    void main(){
      vec2 px = 1.0 / uRes; vec3 m[4]; vec3 s[4];
      for (int k = 0; k < 4; k++) { m[k] = vec3(0.0); s[k] = vec3(0.0); }
      const int R = 4; float n = float((R + 1) * (R + 1));
      for (int j = -R; j <= 0; j++) for (int i = -R; i <= 0; i++) {
        vec3 c;
        c = texture2D(tDiffuse, vUv + vec2(i, j) * px * uR / 4.0).rgb; m[0] += c; s[0] += c * c;
        c = texture2D(tDiffuse, vUv + vec2(-i, j) * px * uR / 4.0).rgb; m[1] += c; s[1] += c * c;
        c = texture2D(tDiffuse, vUv + vec2(i, -j) * px * uR / 4.0).rgb; m[2] += c; s[2] += c * c;
        c = texture2D(tDiffuse, vUv + vec2(-i, -j) * px * uR / 4.0).rgb; m[3] += c; s[3] += c * c;
      }
      float best = 1e9; vec3 outc = vec3(0.0);
      for (int k = 0; k < 4; k++) { vec3 mu = m[k] / n; vec3 v = abs(s[k] / n - mu * mu); float sv = v.r + v.g + v.b; if (sv < best) { best = sv; outc = mu; } }
      gl_FragColor = vec4(outc, 1.0);
    }`,
};

export class Post {
  constructor(renderer, scene, camera, quality) {
    this.renderer = renderer;
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: quality === 'low' ? 0 : 4 });
    this.composer = new EffectComposer(renderer, rt);
    this.render = new RenderPass(scene, camera); this.composer.addPass(this.render);
    this.clean = new ShaderPass({ uniforms: { tDiffuse: { value: null } }, vertexShader: GradeShader.vertexShader,
      fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0); gl_FragColor = vec4(min(c.rgb, vec3(60.0)), 1.0); }' });
    this.composer.addPass(this.clean);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.28, 0.42, 2.2); this.composer.addPass(this.bloom);
    this.output = new OutputPass(); this.composer.addPass(this.output);
    this.kuwa = new ShaderPass(KuwaharaShader); this.kuwa.enabled = false; this.composer.addPass(this.kuwa);
    this.grade = new ShaderPass(GradeShader); this.composer.addPass(this.grade);
    if (quality === 'low') { this.smaa = new SMAAPass(); this.composer.addPass(this.smaa); }
  }
  setSize(w, h, pr) {
    this.composer.setPixelRatio(pr); this.composer.setSize(w, h);
    this.grade.uniforms.uRes.value.set(w * pr, h * pr); this.kuwa.uniforms.uRes.value.set(w * pr, h * pr);
    this.kuwa.uniforms.uR.value = Math.max(3, 4 * pr * 0.75);
  }
  setGrade(g) { const u = this.grade.uniforms; u.uSat.value = g.sat; u.uCon.value = g.con; u.uWarm.value = g.warm; u.uSepia.value = g.sepia; u.uLift.value = g.lift; u.uVig.value = g.vig; u.uGrain.value = g.grain; u.uPaper.value = g.paper; u.uTeal.value = g.teal; }
}
