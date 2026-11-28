// 片場工具：所有場景同一組（共用面板 scene-panel.js 呼叫 mountStudio）。依場景 API 的能力自動顯示：
//   轉場方式／轉場時間  api.transitions（['grow','fade','cut'] 的子集）
//   縮時              api.setHour
//   緩緩環繞          api.setSpin／api.controls（OrbitControls），場景自己有「緩緩環繞」開關時不重複
//   構圖框            一律提供；快門拍下的照片依構圖框裁切
//   白模檢視          api.scene＋api.THREE，場景自己有白模開關時不重複
//   匯出 GLB          api.exportRoot()，場景自己有匯出動作時不重複
// 這些工具只改「怎麼看」，不改模型本身。
import { TRANSITION, TRANSITION_MODES, setTransition, canPatch } from './era-grow.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, k => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[k]));
const GUIDES = { none: '無', thirds: '三分線', '16:9': '16:9 橫幅', '2.39:1': '2.39:1 電影寬銀幕', '4:5': '4:5 直式貼文', '9:16': '9:16 短影音', '1:1': '1:1 方形' };
const ratioOf = k => { const m = /^([\d.]+):([\d.]+)$/.exec(k); return m ? +m[1] / +m[2] : 0; };
let guide = 'none';
try { guide = localStorage.getItem('tw-guide') || 'none'; if (!GUIDES[guide]) guide = 'none'; } catch { }

// ── 構圖框：畫面上的遮罩與三分線；快門照片依比例裁切 ──
function stageEl() { return document.getElementById('stage') || document.querySelector('#scene')?.parentElement; }
function guideBox(w, h) {
  const r = ratioOf(guide); if (!r) return { x: 0, y: 0, w, h };
  return w / h > r ? { x: (w - h * r) / 2, y: 0, w: h * r, h } : { x: 0, y: (h - w / r) / 2, w, h: w / r };
}
function drawGuide() {
  const st = stageEl(); if (!st) return;
  let ov = document.getElementById('frameGuide');
  if (!ov) { ov = document.createElement('div'); ov.id = 'frameGuide'; ov.setAttribute('aria-hidden', 'true'); st.append(ov); new ResizeObserver(drawGuide).observe(st); }
  ov.hidden = guide === 'none';
  if (ov.hidden) return;
  const W = st.clientWidth, H = st.clientHeight, b = guideBox(W, H);
  ov.style.setProperty('--gx', b.x + 'px'); ov.style.setProperty('--gy', b.y + 'px'); ov.style.setProperty('--gw', b.w + 'px'); ov.style.setProperty('--gh', b.h + 'px');
  ov.dataset.label = guide === 'thirds' ? '' : guide;
}
window.cropToGuide = src => {
  if (!ratioOf(guide)) return src;
  const b = guideBox(src.width, src.height), c = document.createElement('canvas'); c.width = Math.round(b.w); c.height = Math.round(b.h);
  c.getContext('2d').drawImage(src, b.x, b.y, b.w, b.h, 0, 0, c.width, c.height); return c;
};

// ── 白模檢視：把所有不透明網格的材質換成同一張霧白材質（可還原）──
const clayState = new WeakMap();   // scene → { on, saved: Map(mesh → 原材質), mat }
function clay(api, on) {
  const scene = api.scene, T = api.THREE; if (!scene || !T) return;
  let st = clayState.get(scene); if (!st) { st = { on: false, saved: new Map(), mat: new T.MeshStandardMaterial({ color: 0xe8e5dd, roughness: 0.92, metalness: 0 }) }; clayState.set(scene, st); }
  api.grow?.finish(); window.eraGrow?.finish();
  st.on = on;
  if (on) {
    scene.traverse(o => {
      if (!o.isMesh || st.saved.has(o) || o.isSkinnedMesh) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      if (!ms.every(canPatch) || ms.some(m => m.transparent || m.alphaTest > 0 || m.isMeshBasicMaterial)) return;
      st.saved.set(o, o.material); o.material = st.mat;
    });
  } else { for (const [o, m] of st.saved) o.material = m; st.saved.clear(); }
  api.redraw?.();
}
const clayOn = api => !!(api.scene && clayState.get(api.scene)?.on);

// ── 縮時：時刻自動前進（每 2 秒 1 小時）──
let lapse = null;
function stopLapse() { if (lapse) cancelAnimationFrame(lapse.raf); lapse = null; }
function startLapse(api, ui, onStop) {
  stopLapse(); let h = +api.state.hour || 12, last = performance.now(), sent = 0;
  const step = now => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now; h = (h + dt * 0.5) % 24;
    if (now - sent > 90) { sent = now; api.setHour(h); ui.onHour?.(h); }
    lapse.raf = requestAnimationFrame(step);
  };
  lapse = { raf: requestAnimationFrame(step), onStop };
}

async function exportGLB(api, status, name) {
  const root = api.exportRoot?.(); if (!root) return;
  api.grow?.finish(); window.eraGrow?.finish();
  status('匯出 GLB 中…（模型較大時需要十幾秒）');
  try {
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    const buf = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: true, maxTextureSize: 2048 });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'model/gltf-binary' })); a.download = `${name || 'scene'}.glb`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    status(`已匯出目前年代的 GLB（${(buf.byteLength / 1048576).toFixed(1)} MB），可帶進 Blender 搭景。街廓資料 © OpenStreetMap contributors，發表時須標示。`);
  } catch (e) { console.error(e); status('匯出 GLB 失敗：' + (e?.message || e)); }
}

/** 在 host 裡畫出片場工具；每次 bind 都可重畫。ui：面板回呼；status：狀態列 */
export function mountStudio(host, api, { ui = {}, status = () => { }, title = '' } = {}) {
  stopLapse();
  const tg = api.toggles || [], acts = api.actions || [];
  const modes = (api.transitions || []).filter(k => TRANSITION_MODES[k]);
  const canSpin = !!(api.setSpin || api.controls) && !tg.some(t => t.id === 'tour');
  const canClay = !!(api.scene && api.THREE) && !tg.some(t => t.id === 'clay') && api.clay !== false;
  const canExport = !!api.exportRoot && !acts.some(a => /GLB/.test(a.label));
  if (modes.length && !modes.includes(TRANSITION.mode)) { /* 此場景不支援目前方式：用第一個，但不改全站設定 */ }
  host.innerHTML = `<p class="sp-studio-h">片場工具</p>
${modes.length > 1 ? `<label class="sp-row">年代轉場<select id="trMode">${modes.map(k => `<option value="${k}">${esc(TRANSITION_MODES[k])}</option>`).join('')}</select></label>
<label class="sp-row" id="trSecRow">轉場時間 <output id="trSecOut"></output><input id="trSec" type="range" min="0.8" max="6" step="0.2"></label>` : ''}
<label class="sp-row">構圖框<select id="guide">${Object.entries(GUIDES).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('')}</select></label>
<div class="sp-toggles">${api.setHour ? '<button id="lapse" aria-pressed="false" title="時刻自動前進，每 2 秒 1 小時">縮時</button>' : ''}${canSpin ? '<button id="spin" aria-pressed="false" title="鏡頭繞注視點緩緩旋轉">緩緩環繞</button>' : ''}${canClay ? '<button id="clay" aria-pressed="false" title="所有建物與地面改成單一白色，方便看量體與光影">白模檢視</button>' : ''}${canExport ? '<button id="glb" class="sp-action" title="下載目前年代的 3D 模型，可帶進 Blender 搭景">匯出 GLB</button>' : ''}</div>`;
  const $ = id => host.querySelector('#' + id);
  if ($('trMode')) {
    const cur = modes.includes(TRANSITION.mode) ? TRANSITION.mode : modes[0];
    $('trMode').value = cur;
    const syncSec = () => { $('trSec').value = TRANSITION.seconds; $('trSecOut').textContent = (+TRANSITION.seconds).toFixed(1) + ' 秒'; $('trSecRow').hidden = $('trMode').value === 'cut'; };
    syncSec();
    $('trMode').onchange = () => { setTransition({ mode: $('trMode').value }); syncSec(); status(`年代轉場：${TRANSITION_MODES[TRANSITION.mode]}（全站共用設定）`); };
    $('trSec').oninput = () => { setTransition({ seconds: +$('trSec').value }); syncSec(); };
  }
  $('guide').value = guide;
  $('guide').onchange = () => { guide = $('guide').value; try { localStorage.setItem('tw-guide', guide); } catch { } drawGuide(); if (ratioOf(guide)) status(`構圖框 ${guide}：快門拍下的照片會依此比例裁切`); };
  drawGuide();
  const press = (b, on) => b?.setAttribute('aria-pressed', String(!!on));
  if ($('lapse')) $('lapse').onclick = () => {
    if (lapse) { stopLapse(); press($('lapse'), false); return; }
    startLapse(api, ui); press($('lapse'), true); status('縮時播放中，再按一次停止');
  };
  if ($('spin')) {
    const get = () => api.setSpin ? api.spin : api.controls.autoRotate;
    const set = v => { if (api.setSpin) api.setSpin(v); else { api.controls.autoRotate = v; api.controls.autoRotateSpeed = 0.6; } };
    press($('spin'), get()); $('spin').onclick = () => { set(!get()); press($('spin'), get()); };
  }
  if ($('clay')) { press($('clay'), clayOn(api)); $('clay').onclick = () => { clay(api, !clayOn(api)); press($('clay'), clayOn(api)); }; }
  if ($('glb')) $('glb').onclick = () => exportGLB(api, status, (title || 'scene') + '-' + (api.eras?.[api.state.era]?.id || 'era'));
  return {
    // 年代或地點改變後：白模要套到新出現的網格；手動拉時刻時停止縮時
    refresh() { if (clayOn(api)) clay(api, true); },
    stopLapse() { if (lapse) { stopLapse(); press($('lapse'), false); } },
  };
}
