// 畫面風格（所有用 src/yuanshan/post.js 後製的場景共用）：
//   ‧ 年代調色表（3D LUT，程式生成，不用外部 .cube 檔）：清末手彩、日治銀鹽、戰後褪色正片、八〇年代負片、今日數位
//   ‧ 移軸微距鏡頭（tilt-shift）：上下模糊、中間清楚，街區看起來像桌上的模型（參考 papercraft 的 macro lens）
//   ‧ 畫法：彩色／彩色＋線稿／線稿／線稿＋網點（參考どこでもロケハン的漫畫背景；做法是自己寫的法線＋深度描邊與網點）
//   ‧ 柔和陰影：調整太陽陰影的取樣半徑與濃淡
// 只改「怎麼看」，不動模型。
import * as T from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { LUTPass } from 'three/addons/postprocessing/LUTPass.js';

// ── 年代調色表 ──
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const mix = (a, b, t) => a + (b - a) * t;
const sat = (c, s) => { const l = lum(...c); return c.map(v => l + (v - l) * s); };
const curve = (v, toe, shoulder) => { const x = Math.min(1, Math.max(0, v)); return toe + (shoulder - toe) * (x * x * (3 - 2 * x) * 0.55 + x * 0.45); };
export const LUTS = {
  none: { name: '原色', year: null, f: c => c },
  qing: { name: '清末手彩照片', year: 1895, f: ([r, g, b]) => { const l = lum(r, g, b), tone = [l * 1.04 + 0.05, l * 0.97 + 0.04, l * 0.82 + 0.02]; const hand = sat([r, g, b], 0.55).map((v, i) => mix(v, tone[i], 0.55)); return hand.map(v => curve(v, 0.1, 0.9)); } },
  showa: { name: '日治銀鹽（褐調）', year: 1935, f: ([r, g, b]) => { const l = curve(lum(r, g, b), 0.06, 0.94), tone = [l * 1.1 + 0.02, l * 0.98, l * 0.8]; return tone.map((v, i) => mix(v, [r, g, b][i], 0.12)); } },
  fade60: { name: '戰後褪色正片', year: 1965, f: ([r, g, b]) => { const c = sat([r, g, b], 0.8); return [curve(c[0] * 1.06 + 0.03, 0.08, 0.96), curve(c[1] * 0.96 + 0.02, 0.07, 0.92), curve(c[2] * 0.82 + 0.06, 0.12, 0.84)]; } },
  film85: { name: '八〇年代彩色負片', year: 1985, f: ([r, g, b]) => { const l = lum(r, g, b), c = sat([r, g, b], 1.12); return [curve(c[0] * 1.03 + 0.02, 0.04, 0.98), curve(c[1] + (l < 0.4 ? 0.03 : 0), 0.05, 0.97), curve(c[2] * 0.9 + 0.01, 0.06, 0.92)]; } },
  now: { name: '今日數位', year: 2020, f: ([r, g, b]) => { const l = lum(r, g, b), c = sat([r, g, b], 1.06), k = Math.min(1, Math.max(0, (l - 0.35) * 2.2)); return [c[0] * (1 + 0.05 * k) - 0.02 * (1 - k), c[1], c[2] * (1 - 0.05 * k) + 0.03 * (1 - k)].map(v => curve(v, 0, 1)); } },
};
/** 依年代自動選調色表：年代字串取第一個四位數年份 */
export function lutForYear(year) {
  const y = +String(year ?? '').match(/\d{4}/)?.[0]; if (!y) return 'now';
  return y < 1905 ? 'qing' : y < 1950 ? 'showa' : y < 1975 ? 'fade60' : y < 2000 ? 'film85' : 'now';
}
/** 產生 N³ 的 RGBA8 資料（純函式，可在 Node 測試） */
export function lutData(key, N = 32) {
  const f = (LUTS[key] || LUTS.none).f, d = new Uint8Array(N * N * N * 4);
  for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) {
    const o = f([r / (N - 1), g / (N - 1), b / (N - 1)]), i = (b * N * N + g * N + r) * 4;
    for (let k = 0; k < 3; k++) d[i + k] = Math.round(Math.min(1, Math.max(0, o[k])) * 255);
    d[i + 3] = 255;
  }
  return d;
}
const lutCache = new Map();
function lutTexture(key) {
  if (lutCache.has(key)) return lutCache.get(key);
  const N = 32, t = new T.Data3DTexture(lutData(key, N), N, N, N);
  Object.assign(t, { format: T.RGBAFormat, type: T.UnsignedByteType, minFilter: T.LinearFilter, magFilter: T.LinearFilter, wrapS: T.ClampToEdgeWrapping, wrapT: T.ClampToEdgeWrapping, wrapR: T.ClampToEdgeWrapping, unpackAlignment: 1, needsUpdate: true });
  lutCache.set(key, t); return t;
}

// ── 移軸：兩次一維模糊，焦帶內不模糊，越往上下越糊；微幅提高飽和度 ──
const TiltShader = {
  uniforms: { tDiffuse: { value: null }, uDir: { value: new T.Vector2(1, 0) }, uAmt: { value: 0 }, uFocus: { value: 0.5 }, uBand: { value: 0.07 }, uSat: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 uDir; uniform float uAmt, uFocus, uBand, uSat; varying vec2 vUv;
    void main(){
      float k = smoothstep(uBand, uBand + 0.42, abs(vUv.y - uFocus)) * uAmt;
      vec4 s = texture2D(tDiffuse, vUv) * 0.1633;
      float w[4]; w[0] = 0.1531; w[1] = 0.12245; w[2] = 0.0918; w[3] = 0.051;
      for (int i = 1; i <= 4; i++) { vec2 o = uDir * k * float(i) * 1.8; s += (texture2D(tDiffuse, vUv + o) + texture2D(tDiffuse, vUv - o)) * w[i - 1]; }
      vec3 c = s.rgb; float l = dot(c, vec3(0.299, 0.587, 0.114));
      gl_FragColor = vec4(mix(vec3(l), c, uSat), 1.0);
    }`,
};

// ── 線稿＋網點：另畫一張法線＋深度圖，Sobel 找輪廓與折角；網點依亮度分「白／淡網／濃網／ベタ（黑）」──
const DRAW = { color: 0, colorLine: 1, line: 2, lineTone: 3 };
export const DRAW_MODES = { color: '彩色', colorLine: '彩色＋線稿', line: '線稿', lineTone: '線稿＋網點' };
class LineTonePass extends Pass {
  constructor(scene, camera) {
    super();
    this.scene = scene; this.camera = camera;
    this.nrt = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType });
    this.nrt.depthTexture = new T.DepthTexture(1, 1); this.nrt.depthTexture.type = T.UnsignedIntType;
    this.normalMat = new T.MeshNormalMaterial();
    this.quad = new FullScreenQuad(new T.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tN: { value: null }, tD: { value: null }, uRes: { value: new T.Vector2(1, 1) }, uNear: { value: 1 }, uFar: { value: 1000 }, uMode: { value: 1 }, uLineW: { value: 1.2 }, uTone: { value: 5 }, uBeta: { value: 0.12 }, uPaper: { value: new T.Color(0.965, 0.955, 0.93) }, uInk: { value: new T.Color(0.09, 0.09, 0.1) } },
      vertexShader: TiltShader.vertexShader,
      fragmentShader: /* glsl */`
        #include <packing>
        uniform sampler2D tDiffuse, tN, tD; uniform vec2 uRes; uniform float uNear, uFar, uMode, uLineW, uTone, uBeta; uniform vec3 uPaper, uInk; varying vec2 vUv;
        float vz(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tD, uv).x, uNear, uFar); }
        vec3 nn(vec2 uv){ return texture2D(tN, uv).xyz * 2.0 - 1.0; }
        void main(){
          vec3 col = texture2D(tDiffuse, vUv).rgb;
          vec2 px = uLineW / uRes; float z0 = vz(vUv); vec3 n0 = nn(vUv);
          float ed = 0.0, en = 0.0;
          for (int i = 0; i < 4; i++) {
            vec2 o = i == 0 ? vec2(px.x, 0.) : i == 1 ? vec2(0., px.y) : i == 2 ? vec2(px.x, px.y) : vec2(px.x, -px.y);
            float za = vz(vUv + o), zb = vz(vUv - o);
            ed = max(ed, abs(za + zb - 2.0 * z0) / max(z0, 1.0));       // 深度二次差：輪廓與前後遮擋
            en = max(en, max(1.0 - dot(n0, nn(vUv + o)), 1.0 - dot(n0, nn(vUv - o)))); // 法線差：折角
          }
          float far = smoothstep(uFar * 0.25, uFar * 0.6, z0);           // 天空與極遠處不描
          float line = max(smoothstep(0.012, 0.04, ed), smoothstep(0.18, 0.45, en)) * (1.0 - far);
          float l = dot(col, vec3(0.299, 0.587, 0.114));
          vec3 outc = col;
          if (uMode < 1.5) outc = mix(col, uInk, line * 0.82);
          else {
            vec3 paper = uPaper;
            if (uMode > 2.5) {
              // 網點：45° 網格，點的大小隨暗度增加；很暗的地方塗黑（ベタ）
              vec2 p = gl_FragCoord.xy / uTone; p = mat2(0.7071, -0.7071, 0.7071, 0.7071) * p;
              float d = length(fract(p) - 0.5);
              float dark = 1.0 - smoothstep(0.08, 0.78, l);
              float r = sqrt(clamp(dark, 0.0, 1.0)) * 0.62;
              float dotv = (1.0 - smoothstep(r - 0.06, r + 0.06, d)) * step(0.06, dark);
              paper = mix(paper, uInk, dotv * 0.9);
              paper = mix(paper, uInk, 1.0 - smoothstep(uBeta - 0.02, uBeta + 0.02, l));
            }
            outc = mix(paper, uInk, line);
          }
          gl_FragColor = vec4(outc, 1.0);
        }`,
    }));
  }
  setSize(w, h) { this.nrt.setSize(w, h); this.quad.material.uniforms.uRes.value.set(w, h); }
  render(renderer, writeBuffer, readBuffer) {
    // 法線圖：天空、精靈（地名）、線段、點、自訂著色器物件不畫，避免假輪廓
    const hidden = [];
    this.scene.traverseVisible(o => { if (o.isSprite || o.isLine || o.isPoints || (o.isMesh && (o.material?.isShaderMaterial || o.material?.transparent))) hidden.push(o); });
    hidden.forEach(o => { o.visible = false; });
    const bg = this.scene.background, fog = this.scene.fog, ov = this.scene.overrideMaterial;
    this.scene.background = null; this.scene.fog = null; this.scene.overrideMaterial = this.normalMat;
    const cc = renderer.getClearColor(new T.Color()), ca = renderer.getClearAlpha();
    renderer.setRenderTarget(this.nrt); renderer.setClearColor(0x8080ff, 1); renderer.clear(); renderer.render(this.scene, this.camera); renderer.setClearColor(cc, ca);
    this.scene.overrideMaterial = ov; this.scene.background = bg; this.scene.fog = fog; hidden.forEach(o => { o.visible = true; });
    const u = this.quad.material.uniforms;
    u.tDiffuse.value = readBuffer.texture; u.tN.value = this.nrt.texture; u.tD.value = this.nrt.depthTexture; u.uNear.value = this.camera.near; u.uFar.value = this.camera.far;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.quad.render(renderer);
  }
  dispose() { this.nrt.dispose(); this.normalMat.dispose(); this.quad.dispose(); }
}

export const LOOK_DEFAULT = { draw: 'color', lineW: 1.2, tone: 5, lut: 'none', lutAmt: 1, tilt: 0, focus: 0.5, soft: 0 };
// 網址參數 ↔ 畫面風格（分享網址會記住）
export const LOOK_KEYS = { draw: 'draw', lineW: 'lw', tone: 'tone', lut: 'lut', lutAmt: 'la', tilt: 'tilt', focus: 'tf', soft: 'soft' };
export function lookFromQuery(q) {
  const L = { ...LOOK_DEFAULT }, num = (k, a, b) => { const v = Number(q.get(k)); return q.has(k) && Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : null; };
  if (DRAW_MODES[q.get('draw')]) L.draw = q.get('draw');
  if (LUTS[q.get('lut')] || q.get('lut') === 'auto') L.lut = q.get('lut');
  for (const [k, a, b] of [['lineW', 0.6, 3], ['tone', 3, 12], ['lutAmt', 0, 1], ['tilt', 0, 1], ['focus', 0.1, 0.9], ['soft', 0, 1]]) { const v = num(LOOK_KEYS[k], a, b); if (v != null) L[k] = v; }
  return L;
}
export function lookToQuery(L, u) {
  for (const [k, p] of Object.entries(LOOK_KEYS)) { if (L[k] === LOOK_DEFAULT[k]) u.searchParams.delete(p); else u.searchParams.set(p, L[k]); }
  return u;
}

/** 在 Post 的組合器裡裝上風格通道（第一次呼叫時才建立），回傳控制器 */
export function installLook(post, { scene, camera, renderer }) {
  if (post._look) return post._look;
  const comp = post.composer, at = comp.passes.indexOf(post.kuwa);
  const line = new LineTonePass(scene, camera); line.enabled = false;
  const lut = new LUTPass({ lut: lutTexture('none'), intensity: 1 }); lut.enabled = false;
  // 移軸做兩輪（水平、垂直各兩次），模糊夠大又不會出現取樣條紋
  const tilts = [0, 1, 2, 3].map(() => new ShaderPass(TiltShader)); tilts.forEach(p => { p.enabled = false; });
  // 順序：輸出（色調映射後）→ 線稿 → 調色表 → 移軸 → （膠彩）→ 時代調色、暗角、顆粒
  // 組合器 setSize 時會呼叫每個通道的 setSize（實際像素）；insertPass 也會以目前尺寸呼叫一次，所以要先設好
  tilts.forEach((p, i) => { p.setSize = (w, h) => p.uniforms.uDir.value.set(i % 2 ? 0 : 1 / w, i % 2 ? 1 / h : 0); });
  [line, lut, ...tilts].forEach((p, i) => comp.insertPass(p, at + i));
  const L = { ...LOOK_DEFAULT }, base = new WeakMap();
  const ctl = {
    get: () => ({ ...L }),
    /** era：目前年代（調色表選「自動」時依年份） */
    set(patch = {}, era = null) {
      Object.assign(L, patch);
      const mode = DRAW[L.draw] ?? 0, u = line.quad.material.uniforms;
      line.enabled = mode > 0; u.uMode.value = mode; u.uLineW.value = L.lineW; u.uTone.value = L.tone;
      const key = L.lut === 'auto' ? lutForYear(era?.year ?? era) : L.lut;
      lut.enabled = key !== 'none' && L.lutAmt > 0 && mode < 2; lut.lut = lutTexture(key); lut.intensity = L.lutAmt; ctl.lutKey = key;
      tilts.forEach((p, i) => { p.enabled = L.tilt > 0.01; p.uniforms.uAmt.value = L.tilt * 2.4; p.uniforms.uFocus.value = 1 - L.focus; p.uniforms.uSat.value = i ? 1 : 1 + L.tilt * 0.12; });
      // 柔和陰影：PCF 取樣半徑 1 → 9 texel，陰影略淡（像散射光）
      scene.traverse(o => {
        if (!o.isDirectionalLight || !o.castShadow) return;
        if (!base.has(o)) base.set(o, { r: o.shadow.radius, i: o.shadow.intensity ?? 1 });
        const b = base.get(o); o.shadow.radius = b.r + L.soft * 8; o.shadow.intensity = b.i * (1 - L.soft * 0.22);
      });
      renderer?.shadowMap && (renderer.shadowMap.needsUpdate = true);
      return ctl;
    },
  };
  post._look = ctl;
  return ctl;
}
