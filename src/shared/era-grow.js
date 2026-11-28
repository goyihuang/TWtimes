// 年代轉場「建物長出來」：所有場景共用（臺中、彰化、臺北、高雄走 public/app.js 的舊版 three，臺南、安平、現代街景走 npm three）。
//
// 只做動畫，不改模型：轉場期間把網格的材質暫時換成「加了轉場著色器」的複本，結束後換回原材質，
// 幾何、座標、尺寸一律不動，所以轉場結束的畫面與直接切換完全相同。
//
// 效果（與圓山 src/yuanshan/materials.js 同一套語彙）：
//   ‧ 以鏡頭注視點為圓心，一圈波紋向外推進（近處先變、遠處後變，邊緣帶低頻雜訊，不會是死板的圓）。
//   ‧ 舊年代的建物先沉回地面，新年代的建物再從地面長高；長高時沿每 3.2 m 亮一條金色「樓層線」。
//   ‧ 貼地的東西（地面、道路、水面、廣場鋪面）不縮放，改成兩個年代互補溶解，金色溶解邊；同一點只會出現一個年代，不會疊影閃爍。
//   ‧ 陰影跟著長（同時替換陰影深度材質）。
//   ‧ 線、點、精靈、自訂 ShaderMaterial 等無法安全改寫的物件，在波紋中點直接切換。
//
// 用法：
//   const grow = createEraGrow(THREE);                 // 傳入場景所用的 three 命名空間
//   grow.start(fromObj, toObj, center, { ground: 0 }); // fromObj 或 toObj 可為 null（只長出／只沉下）
//   每幀：grow.update(dt)；grow.active 為 true 時要持續重畫
//   拍照、今昔並排、切換地點之前：grow.finish()
//
// 全站轉場設定（共用面板「轉場」可改，存在 localStorage）：TRANSITION.mode = 'grow' | 'fade' | 'cut'，TRANSITION.seconds

const STORE = 'tw-transition-v1';
export const TRANSITION_MODES = { grow: '建物長出', fade: '淡出淡入', cut: '直接切換' };
export const TRANSITION = (() => {
  const t = { mode: 'grow', seconds: 3.2 };
  try { Object.assign(t, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch { }
  if (!TRANSITION_MODES[t.mode]) t.mode = 'grow';
  t.seconds = Math.max(0.6, Math.min(8, +t.seconds || 3.2));
  try { if (matchMedia('(prefers-reduced-motion: reduce)').matches && !localStorage.getItem(STORE)) t.mode = 'cut'; } catch { }
  return t;
})();
export function setTransition(patch) {
  Object.assign(TRANSITION, patch);
  try { localStorage.setItem(STORE, JSON.stringify({ mode: TRANSITION.mode, seconds: TRANSITION.seconds })); } catch { }
  dispatchEvent(new CustomEvent('tw-transition', { detail: { ...TRANSITION } }));
}
if (typeof window !== 'undefined') window.TW_TRANSITION = TRANSITION;

// 可改寫的材質：內建 Mesh*Material（都含 project_vertex 與 clipping_planes_fragment）
const PATCHABLE = ['isMeshStandardMaterial', 'isMeshPhysicalMaterial', 'isMeshLambertMaterial', 'isMeshPhongMaterial', 'isMeshBasicMaterial', 'isMeshToonMaterial', 'isMeshMatcapMaterial', 'isMeshDepthMaterial', 'isMeshDistanceMaterial'];
export const canPatch = m => !!m && !m.isShaderMaterial && PATCHABLE.some(k => m[k]);

const GLSL = /* glsl */`
uniform vec3 uGrowC; uniform float uGrowF, uGrowBand, uGrowJit, uGrowR, uGrowSide, uGround, uGrowFlat, uGrowGlow;
varying vec3 vGrowW; varying float vGrowH;
float gHash(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float gNoise(vec2 x){ vec2 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(gHash(i), gHash(i + vec2(1, 0)), f.x), mix(gHash(i + vec2(0, 1)), gHash(i + vec2(1, 1)), f.x), f.y); }
// 這一點的「新年代到達度」0→1；距離經過壓縮，最遠處也會在轉場結束時到齊
float gArrive(vec2 xz){
  // 距離正規化到 0–1 再開根號：近處拉長、遠處壓縮，鏡頭前的建物有足夠時間慢慢長
  float d = sqrt(1. - exp(-length(xz - uGrowC.xz) / uGrowR));
  float n = gNoise(xz * (6. / uGrowR)) * .65 + gNoise(xz * (21. / uGrowR)) * .35;
  return clamp((uGrowF - d - n * uGrowJit) / uGrowBand, 0., 1.);
}
float gSide(vec2 xz){ float a = gArrive(xz); return uGrowSide > .5 ? a : 1. - a; }
`;

const VERT = /* glsl */`
vec4 gW = vec4(transformed, 1.0);
#ifdef USE_BATCHING
gW = batchingMatrix * gW;
#endif
#ifdef USE_INSTANCING
gW = instanceMatrix * gW;
#endif
gW = modelMatrix * gW;
vGrowH = gW.y - uGround;
if (vGrowH > uGrowFlat) {
  float gh = smoothstep(.5, 1., gSide(gW.xz));
  gW.y = uGround + uGrowFlat + (vGrowH - uGrowFlat) * gh * gh * (3. - 2. * gh);
}
vGrowW = gW.xyz;
vec4 mvPosition = viewMatrix * gW;
gl_Position = projectionMatrix * mvPosition;
`;

const FRAG = /* glsl */`
float gGlow = 0.;
{
  float ps = gSide(vGrowW.xz);
  if (vGrowH <= uGrowFlat) {
    // 貼地：兩年代互補溶解（同一點雜訊相同，新年代取 c < 到達度，舊年代取 c > 到達度）
    float c = gNoise(vGrowW.xz * .45) * .7 + gHash(floor(vGrowW.xz * 1.5)) * .3;
    if (uGrowSide < .5) c = 1. - c;
    if (c >= ps) discard;
    gGlow = (1. - smoothstep(0., .06, ps - c)) * step(ps, .999);
  } else {
    float gh = smoothstep(.5, 1., ps);
    if (gh < .003) discard;
    float floorLine = smoothstep(.86, .97, fract(vGrowH / 3.2));
    gGlow = sin(3.14159 * gh) * (.12 + .88 * floorLine);
  }
}
`;

/** 建立一組轉場器。THREE：場景所用的 three 命名空間（舊版 UMD 或 npm 版都可）。 */
export function createEraGrow(THREE, defaults = {}) {
  const clones = new WeakMap();   // 原材質 → { in, out }
  const depthClones = new WeakMap();
  const mkU = side => ({
    uGrowC: { value: new THREE.Vector3() }, uGrowF: { value: 0 }, uGrowBand: { value: 60 }, uGrowJit: { value: 40 }, uGrowR: { value: 300 },
    uGrowSide: { value: side }, uGround: { value: 0 }, uGrowFlat: { value: 0.35 }, uGrowGlow: { value: 1.4 },
  });
  const U = { in: mkU(1), out: mkU(0) };
  const tint = new THREE.Color(1.0, 0.66, 0.28);

  function inject(sh, side) {
    Object.assign(sh.uniforms, U[side], { uGrowTint: { value: tint } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + GLSL).replace('#include <project_vertex>', VERT);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uGrowTint;\n' + GLSL)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + FRAG);
    if (sh.fragmentShader.includes('#include <dithering_fragment>')) sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb += uGrowTint * gGlow * uGrowGlow;');
  }
  // 複製材質但不複製 userData（有些引擎在 userData 放了著色器物件，JSON 複製會失敗）
  function copyFrom(dst, src) {
    const ud = src.userData; src.userData = {};
    try { if (dst) dst.copy(src); else dst = src.clone(); } finally { src.userData = ud; }
    dst.userData = ud;
    if (src.defines) dst.defines = { ...src.defines };
    return dst;
  }
  function cloneFor(orig, side) {
    let rec = clones.get(orig);
    if (!rec) { rec = {}; clones.set(orig, rec); orig.addEventListener?.('dispose', () => { rec.in?.dispose(); rec.out?.dispose(); }); }
    let c = rec[side];
    if (c) { copyFrom(c, orig); c.needsUpdate = true; return c; }
    c = copyFrom(null, orig);
    const prev = Object.prototype.hasOwnProperty.call(orig, 'onBeforeCompile') ? orig.onBeforeCompile : null;
    const prevKey = orig.customProgramCacheKey ? orig.customProgramCacheKey() : '';
    c.onBeforeCompile = (sh, r) => { if (prev) prev.call(c, sh, r); inject(sh, side); };
    c.customProgramCacheKey = () => prevKey + '|eraGrow|' + side;
    rec[side] = c; return c;
  }
  function depthFor(mesh, side) {
    let rec = depthClones.get(mesh.geometry); if (!rec) { rec = {}; depthClones.set(mesh.geometry, rec); }
    if (!rec[side]) {
      const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
      d.onBeforeCompile = sh => inject(sh, side); d.customProgramCacheKey = () => 'eraGrowDepth|' + side; rec[side] = d;
    }
    return rec[side];
  }

  let run = null;
  const swapped = [];   // [mesh, 原材質, 原陰影材質]
  const popped = [];    // [obj, 原 visible, side]

  function prepare(root, side) {
    if (!root) return;
    root.traverse(o => {
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : null;
      if (o.isMesh && mats && mats.every(canPatch) && !o.isSkinnedMesh) {
        swapped.push([o, o.material, o.customDepthMaterial]);
        o.material = Array.isArray(o.material) ? mats.map(m => cloneFor(m, side)) : cloneFor(o.material, side);
        if (o.castShadow && !o.customDepthMaterial) o.customDepthMaterial = depthFor(o, side);
      } else if (o.isMesh || o.isLine || o.isPoints || o.isSprite) {
        popped.push([o, o.visible, side]);
        if (side === 'in') o.visible = false;
      }
    });
  }
  function restore() {
    for (const [o, m, d] of swapped) { o.material = m; o.customDepthMaterial = d; }
    for (const [o, v] of popped) o.visible = v;
    swapped.length = 0; popped.length = 0;
  }

  const api = {
    get active() { return !!run; },
    get progress() { return run ? run.t / run.dur : 1; },
    /**
     * from、to：年代群組（Object3D）或 null。center：波紋圓心（Vector3 或 {x,y,z}）。
     * opts：ground 地面高（預設 0）、seconds、radius（預設依新年代群組範圍）、flat（貼地判定高度，預設 0.35 m）、onDone
     */
    start(from, to, center, opts = {}) {
      api.finish();
      const c = new THREE.Vector3(center?.x || 0, center?.y || 0, center?.z || 0);
      let R = opts.radius;
      if (!R) {
        const box = new THREE.Box3();
        for (const g of [to, from]) if (g) { const vis = g.visible; g.visible = true; box.expandByObject(g); g.visible = vis; }
        R = box.isEmpty() ? 300 : Math.max(...[[box.min.x, box.min.z], [box.max.x, box.min.z], [box.min.x, box.max.z], [box.max.x, box.max.z]].map(([x, z]) => Math.hypot(x - c.x, z - c.z)));
        R = Math.max(60, Math.min(R * 0.5, 600));
      }
      const band = 0.62, jit = 0.2;   // 以正規化距離（0–1）計
      for (const side of ['in', 'out']) {
        const u = U[side]; u.uGrowC.value.copy(c); u.uGrowR.value = R; u.uGrowBand.value = band; u.uGrowJit.value = jit;
        u.uGround.value = opts.ground ?? defaults.ground ?? 0; u.uGrowFlat.value = opts.flat ?? defaults.flat ?? 0.35; u.uGrowF.value = 0;
      }
      prepare(to, 'in'); prepare(from, 'out');
      if (from) from.visible = true; if (to) to.visible = true;
      run = { from, to, t: 0, dur: opts.seconds ?? TRANSITION.seconds, band, jit, R, mid: false, dir: 1, hold: false, onDone: opts.onDone };
      api.update(0);
    },
    update(dt) {
      if (!run) return false;
      if (!api.hold && !run.hold) run.t = Math.max(0, Math.min(run.dur, run.t + dt * run.dir));
      const k = run.t / run.dur, e = k * k * (3 - 2 * k);
      const F = e * (1 + run.jit + run.band);
      U.in.uGrowF.value = U.out.uGrowF.value = F;
      // 線、點、精靈等在中點切換；拖曳時間軸可能來回越過中點，所以每次都依目前一側決定
      const mid = k >= 0.5;
      if (mid !== run.mid) {
        run.mid = mid;
        for (const p of popped) p[0].visible = (p[2] === 'in') === mid ? p[1] : false;
      }
      if (!api.hold && !run.hold) {
        if (run.dir > 0 && run.t >= run.dur) api.finish();
        else if (run.dir < 0 && run.t <= 0) api.finish();
      }
      return true;
    },
    finish() {
      if (!run) return;
      const r = run; run = null;
      restore();
      // 倒退收尾（時間軸拖回原年代）：留下舊年代
      const keep = r.dir < 0 ? r.from : r.to, drop = r.dir < 0 ? r.to : r.from;
      if (drop && drop !== keep) drop.visible = false;
      if (keep) keep.visible = true;
      r.onDone?.(r.dir < 0 ? 'from' : 'to');
    },
    /** 目前這一輪的兩端（給時間軸判斷是否同一段） */
    get pair() { return run ? [run.from, run.to] : null; },
    /**
     * 時間軸拖曳：停在進度 k（0–1），不自己前進。同一對年代重複呼叫只更新進度。
     * opts 同 start。
     */
    scrub(from, to, center, k, opts = {}) {
      if (!run || run.from !== from || run.to !== to) api.start(from, to, center, opts);
      run.hold = true; run.dir = 1;
      run.t = Math.max(0, Math.min(1, k)) * run.dur; api.update(0);
    },
    /** 放開時間軸：forward 為 true 播完到新年代，false 倒退回舊年代；剩下的進度照比例用時 */
    settle(forward, onDone) {
      if (!run) { onDone?.(forward ? 'to' : 'from'); return; }
      run.hold = false; run.dir = forward ? 1 : -1;
      if (onDone) { const prev = run.onDone; run.onDone = w => { prev?.(w); onDone(w); }; }
      api.update(0);
    },
    uniforms: U,
    hold: false,   // 測試用：凍結進度
    /** 跳到進度 k（0–1），測試與逐格截圖用 */
    seek(k) { if (run) { run.t = Math.max(0, Math.min(1, k)) * run.dur; api.update(0); } },
  };
  return api;
}

/**
 * 時間軸拖曳的共用接法（給「每個年代一個群組」的引擎：臺南、安平、app.js）。
 *   group(i)：第 i 個年代的根節點；center()：波紋圓心；apply(i)：切到第 i 個年代（不播動畫，會更新面板）
 *   current()：目前年代；blend(a, b, k)：選配，拖曳時內插調色等連續量
 * 回傳 { scrub(a, b, k), endScrub(target) }，直接放進場景 API。
 */
export function eraScrubber({ grow, group, center, apply, current, opts, blend }) {
  let cur = null;
  const show = () => { if (cur) { const A = group(cur.a), B = group(cur.b); if (A) A.visible = true; if (B) B.visible = true; } };
  return {
    scrub(a, b, k) {
      if (!cur || cur.a !== a || cur.b !== b) { grow.finish(); if (current() !== a && current() !== b) apply(a); cur = { a, b }; }
      grow.scrub(group(a), group(b), center(), k, opts?.());
      const near = k >= 0.5 ? b : a;
      if (current() !== near) apply(near);
      show(); blend?.(a, b, k);   // 調色等連續量：在兩個年代之間內插
    },
    endScrub(target) {
      if (!cur) return;
      const { a, b } = cur; cur = null;
      grow.settle(target === b, w => apply(w === 'to' ? b : a));
    },
  };
}
