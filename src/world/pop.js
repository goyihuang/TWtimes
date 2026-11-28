// 紙雕彈起：圖磚載入或按「重播彈起」時，建物與樹從地面彈起來（參考 papercraft 的鉸鏈彈簧：一次過衝後定住）。
// 只在頂點著色器裡縮放高度，幾何不動；動畫結束後與原本完全相同。
//   建物：每個頂點帶 pop = (底部高度, 中心 x, 中心 z, 開始時間)，y' = 底 + (y − 底) × s(t)
//   樹：每棵帶 aPop（開始時間），整棵依 s(t) 縮放
// 陰影深度材質同步替換，陰影跟著長。

export const POP_SECONDS = 0.85;
/** 彈簧曲線 0→1：快速升起、過衝約 5%、回彈定住 */
export function popSpring(t) {
  if (t <= 0) return 0; if (t >= 1) return 1;
  return 1 - Math.exp(-6.5 * t) * Math.cos(t * 6.9115) * (1 - t);
}
const GLSL = /* glsl */`
uniform float uPopNow;
float popS(float t){ t = clamp(t, 0., 1.); return t >= 1. ? 1. : 1. - exp(-6.5 * t) * cos(t * 6.9115) * (1. - t); }
`;

/** 改寫材質（含陰影深度材質）：kind = 'bld'（每頂點 pop vec4）或 'inst'（每實例 aPop float） */
export function patchPop(T, mat, kind, uNow) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    sh.uniforms.uPopNow = uNow;
    const attr = kind === 'bld' ? 'attribute vec4 pop;' : 'attribute float aPop;';
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n${attr}\n${GLSL}`)
      .replace('#include <begin_vertex>', kind === 'bld'
        ? '#include <begin_vertex>\n{ float s = max(popS((uPopNow - pop.w) / ' + POP_SECONDS.toFixed(2) + '), 0.002); transformed.y = pop.x + (transformed.y - pop.x) * s; }'
        : '#include <begin_vertex>\n{ float s = max(popS((uPopNow - aPop) / ' + POP_SECONDS.toFixed(2) + '), 0.002); transformed *= vec3(mix(0.6, 1., s), s, mix(0.6, 1., s)); }');
  };
  const key0 = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => (key0 ? key0() : '') + '|pop-' + kind;
  mat.needsUpdate = true;
  return mat;
}
export function popDepth(T, kind, uNow) {
  const m = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking });
  return patchPop(T, m, kind, uNow);
}

/**
 * 依與焦點的距離排開始時間：近的先彈，遠的後彈，每棟另有一點亂數。
 * centers：每頂點 (cx, cz)（圖磚區域座標）；ox/oz：圖磚原點；tx/tz：焦點世界座標
 */
export function popStart(now, cx, cz, ox, oz, tx, tz, speed = 900) {
  const d = Math.hypot(cx + ox - tx, cz + oz - tz);
  const j = ((Math.sin(cx * 12.9898 + cz * 78.233) * 43758.5453) % 1 + 1) % 1;
  return now + 0.05 + Math.min(1.6, d / speed) + j * 0.22;
}
