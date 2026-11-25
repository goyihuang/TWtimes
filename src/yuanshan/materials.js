import * as THREE from 'three';

// 全場共用 uniforms：時間、四個時期的「顯現度」、霧、轉場波紋中心
export const G = {
  uTime: { value: 0 },
  uEra: { value: new THREE.Vector4(1, 0, 0, 0) },
  uWave: { value: new THREE.Vector3(150, 20, -250) },
  uMist: { value: new THREE.Vector4(0.0016, 0.004, 4, 38) }, // 遠景霾密度, 低空霧密度, 霧底高, 霧厚
  uMistColor: { value: new THREE.Color('#cfd8dc') },
  uWind: { value: 1 },
  uWet: { value: 0 },
  uNight: { value: 0 },
};

// 自訂霧：遠景大氣透視 + 貼地河霧（只在 USE_MIST 的材質啟用，以免影響 Water/Sky）
THREE.ShaderChunk.fog_pars_vertex = `#ifdef USE_FOG
varying float vFogDepth;
#ifdef USE_MIST
varying vec3 vMistWorld;
#endif
#endif`;
THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG
vFogDepth = - mvPosition.z;
#ifdef USE_MIST
vMistWorld = transpose(mat3(viewMatrix)) * (mvPosition.xyz - viewMatrix[3].xyz);
#endif
#endif`;
THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
uniform vec3 fogColor;
varying float vFogDepth;
#ifdef FOG_EXP2
uniform float fogDensity;
#else
uniform float fogNear;
uniform float fogFar;
#endif
#ifdef USE_MIST
varying vec3 vMistWorld;
uniform vec4 uMist;
uniform vec3 uMistColor;
#endif
#endif`;
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
#ifdef USE_MIST
float mdist = length(vMistWorld - cameraPosition);
float haze = 1.0 - exp(-pow(uMist.x * mdist, 1.35));
float hy = max(vMistWorld.y - uMist.z, 0.0);
float low = (1.0 - exp(-uMist.y * mdist)) * exp(-hy / uMist.w);
float fogFactor = 1.0 - (1.0 - haze) * (1.0 - low);
vec3 fcol = mix(fogColor, uMistColor, clamp(low / max(fogFactor, 1e-3), 0.0, 1.0));
gl_FragColor.rgb = mix(gl_FragColor.rgb, fcol, fogFactor);
#else
#ifdef FOG_EXP2
float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
#else
float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
#endif
gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif
#endif`;

const NOISE = /* glsl */`
float h31(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float vn3(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z); }
`;

/**
 * 修補標準材質：霧、時期顯現（溶解＋金色邊緣）、可選風動、可選細節。
 * opts.mask: [e0,e1,e2,e3] 屬於哪些時期（非 instanced 用）；instanced 可用 attribute aMask。
 * opts.grow: instanced 物件以縮放方式「長出」而不是溶解。
 * opts.wind: 樹冠擺動強度。
 */
export function patch(mat, opts = {}) {
  const mask = opts.mask || [1, 1, 1, 1];
  mat.defines = { ...(mat.defines || {}), USE_MIST: '' };
  if (opts.instMask) mat.defines.INST_MASK = '';
  if (opts.grow) mat.defines.GROW = '';
  if (opts.wind) mat.defines.WIND = '';
  if (opts.dissolve !== false) mat.defines.DISSOLVE = '';
  if (opts.wet) mat.defines.WETTABLE = '';
  mat.userData.mask = mask;
  const key = JSON.stringify(opts.key || [opts.instMask, opts.grow, opts.wind, opts.dissolve, opts.wet, opts.extraKey]);
  mat.customProgramCacheKey = () => key + mat.type;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    Object.assign(sh.uniforms, { uTime: G.uTime, uEra: G.uEra, uWave: G.uWave, uMist: G.uMist, uMistColor: G.uMistColor, uWind: G.uWind, uWet: G.uWet, uMask: { value: new THREE.Vector4(...mask) }, uWindAmt: { value: opts.wind || 0 } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
uniform float uTime; uniform vec4 uEra; uniform vec4 uMask; uniform float uWind; uniform float uWindAmt;
varying vec3 vWPos; varying float vReveal; varying float vSeed;
#ifdef INST_MASK
attribute vec4 aMask;
#endif
${NOISE}`).replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef INST_MASK
vec4 mk = aMask;
#else
vec4 mk = uMask;
#endif
vec4 rv = mk * uEra;
vReveal = max(max(rv.x, rv.y), max(rv.z, rv.w));
vSeed = 0.0;
#ifdef USE_INSTANCING
vSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
#endif
#ifdef GROW
float g = smoothstep(vSeed * 0.55, vSeed * 0.55 + 0.45, vReveal);
transformed *= g;
#endif
#ifdef WIND
{
  vec3 ip = vec3(0.0);
  #ifdef USE_INSTANCING
  ip = instanceMatrix[3].xyz;
  #endif
  float hgt = max(position.y, 0.0);
  float sway = (sin(uTime * 1.3 + ip.x * 0.05 + ip.z * 0.04) + 0.5 * sin(uTime * 2.7 + ip.z * 0.11)) * uWind;
  transformed.x += sway * uWindAmt * hgt * 0.03;
  transformed.z += sway * uWindAmt * hgt * 0.018;
  transformed += normal * vn3(position * 3.0 + uTime * 1.5) * 0.06 * uWind * uWindAmt;
}
#endif`).replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
{
  vec4 wp4 = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  wp4 = instanceMatrix * wp4;
  #endif
  vWPos = (modelMatrix * wp4).xyz;
}`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uTime; uniform vec3 uWave; uniform float uWet;
varying vec3 vWPos; varying float vReveal; varying float vSeed;
${NOISE}`).replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
float edgeGlow = 0.0;
#ifdef DISSOLVE
#ifndef GROW
{
  float n = vn3(vWPos * 0.18) * 0.6 + vn3(vWPos * 0.9) * 0.25;
  float wave = clamp(length(vWPos - uWave) / 900.0, 0.0, 1.0);
  float c = n * 0.55 + wave * 0.45;
  float th = vReveal * 1.12 - 0.04;
  if (c > th) discard;
  edgeGlow = 1.0 - smoothstep(0.0, 0.035, th - c);
  edgeGlow *= step(vReveal, 0.995);
}
#endif
#endif`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(1.6, 1.05, 0.45) * edgeGlow * 4.0;`);
    if (opts.wet) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.35, uWet * smoothstep(0.6, 0.95, normalize(cross(dFdx(vWPos), dFdy(vWPos))).y + 0.3));`)
        .replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb *= 1.0 - 0.28 * uWet;`);
    }
    if (opts.grime !== false) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb *= 0.86 + 0.22 * vn3(vWPos * 0.45) + 0.08 * vn3(vWPos * 3.1);`);
    }
    if (opts.frag) sh.fragmentShader = opts.frag(sh.fragmentShader);
    if (opts.vert) sh.vertexShader = opts.vert(sh.vertexShader);
    if (opts.uniforms) Object.assign(sh.uniforms, opts.uniforms);
    if (prev) prev(sh, r);
    mat.userData.shader = sh;
  };
  return mat;
}

const cache = new Map();
export const LAMPS = new Set();
/** 建立（或共用）一個指定時期遮罩的材質 */
export function M(params, mask = [1, 1, 1, 1], extra = {}) {
  const k = JSON.stringify([params, mask, extra.key || ''], (kk, v) => (v && v.uuid ? v.uuid : v));
  if (!extra.unique && cache.has(k)) return cache.get(k);
  const p = { ...params }; const lamp = p.lamp; delete p.lamp;
  for (const c of ['color', 'emissive']) if (typeof p[c] === 'string') p[c] = new THREE.Color(p[c]);
  const m = patch(new THREE.MeshStandardMaterial(p), { mask, wet: true, ...extra });
  if (lamp) { m.userData.lamp = lamp; LAMPS.add(m); }
  if (!extra.unique) cache.set(k, m);
  return m;
}

// 時期遮罩
export const E = {
  all: [1, 1, 1, 1], e1: [1, 0, 0, 0], e2: [0, 1, 0, 0], e3: [0, 0, 1, 0], e4: [0, 0, 0, 1],
  e12: [1, 1, 0, 0], e23: [0, 1, 1, 0], e34: [0, 0, 1, 1], e123: [1, 1, 1, 0], e234: [0, 1, 1, 1],
};
export const maskKey = m => m.join('');
