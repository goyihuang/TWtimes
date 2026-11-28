// 片場工具：所有場景同一組（共用面板 scene-panel.js 呼叫 mountStudio）。依場景 API 的能力自動顯示：
//   轉場方式／轉場時間  api.transitions（['grow','fade','cut'] 的子集）
//   縮時              api.setHour
//   緩緩環繞          api.setSpin／api.controls（OrbitControls），場景自己有「緩緩環繞」開關時不重複
//   構圖框            一律提供；快門拍下的照片依構圖框裁切
//   白模檢視          api.scene＋api.THREE，場景自己有白模開關時不重複
//   匯出 GLB          api.exportRoot()，場景自己有匯出動作時不重複
//   畫面風格        api.post（src/yuanshan/post.js）：畫法（彩色／線稿／網點）、年代調色表、移軸、柔和陰影（look.js）
//   短片            api.post＋MediaRecorder：9:16／4:5／1:1／16:9，運鏡、紙雕彈起開場（api.replayPop）、縮時（clip.js）
//   どこでもロケハン  api.focusLatLng()：在新分頁開同一地點（只連結，不嵌入）
// 這些工具只改「怎麼看」，不改模型本身。
import { TRANSITION, TRANSITION_MODES, setTransition, canPatch } from './era-grow.js';
import { installLook, lookFromQuery, lookToQuery, DRAW_MODES, LUTS, LOOK_DEFAULT } from './look.js';
import { recordClip, canRecord, CLIP_SIZES, CLIP_MOVES } from './clip.js';
import { stampGLB, creditsOf, creditLine, rokehanURL } from './credits.js';

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
    let buf = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: true, maxTextureSize: 2048 });
    const cr = creditLine(creditsOf(api)); if (cr) buf = stampGLB(buf, cr);
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
  const look = api.post?.composer ? installLook(api.post, api) : null, canClip = canRecord(api);
  const L = look ? lookFromQuery(new URLSearchParams(location.search)) : null;
  const eraNow = () => api.eras?.[api.state?.era];
  if (modes.length && !modes.includes(TRANSITION.mode)) { /* 此場景不支援目前方式：用第一個，但不改全站設定 */ }
  host.innerHTML = `<p class="sp-studio-h">片場工具</p>
${modes.length > 1 ? `<label class="sp-row">年代轉場<select id="trMode">${modes.map(k => `<option value="${k}">${esc(TRANSITION_MODES[k])}</option>`).join('')}</select></label>
<label class="sp-row" id="trSecRow">轉場時間 <output id="trSecOut"></output><input id="trSec" type="range" min="0.8" max="6" step="0.2"></label>` : ''}
<label class="sp-row">構圖框<select id="guide">${Object.entries(GUIDES).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('')}</select></label>
${look ? `<p class="sp-studio-h">畫面風格</p>
<label class="sp-row">畫法<select id="lkDraw">${Object.entries(DRAW_MODES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
<label class="sp-row" id="lkLineRow">線條粗細 <output id="lkLineOut"></output><input id="lkLine" type="range" min="0.6" max="3" step="0.1"></label>
<label class="sp-row" id="lkToneRow">網點大小 <output id="lkToneOut"></output><input id="lkTone" type="range" min="3" max="12" step="0.5"></label>
<label class="sp-row" id="lkLutRow">調色表<select id="lkLut"><option value="auto">依年代自動</option>${Object.entries(LUTS).map(([k, v]) => `<option value="${k}">${esc(v.name)}</option>`).join('')}</select></label>
<label class="sp-row">移軸微距 <output id="lkTiltOut"></output><input id="lkTilt" type="range" min="0" max="1" step="0.05" title="上下模糊、中間清楚，街區看起來像桌上的模型"></label>
<label class="sp-row" id="lkFocusRow">對焦高度 <output id="lkFocusOut"></output><input id="lkFocus" type="range" min="0.15" max="0.85" step="0.01"></label>
<label class="sp-row">柔和陰影 <output id="lkSoftOut"></output><input id="lkSoft" type="range" min="0" max="1" step="0.05" title="陰影邊緣變柔、略淡，像陰天或紙模型的散射光"></label>
<div class="sp-toggles"><button id="lkReset" class="sp-action" title="畫面風格回到預設">風格還原</button></div>` : ''}
${canClip ? `<p class="sp-studio-h">短片</p>
<label class="sp-row">比例<select id="clAspect">${Object.keys(CLIP_SIZES).map(k => `<option value="${k}">${k}${k === '9:16' ? ' 短影音' : ''}</option>`).join('')}</select></label>
<label class="sp-row">運鏡<select id="clMove">${Object.entries(CLIP_MOVES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
<label class="sp-row">長度 <output id="clSecOut"></output><input id="clSec" type="range" min="4" max="30" step="1" value="10"></label>
<div class="sp-toggles">${api.replayPop ? '<button id="clPop" aria-pressed="true" title="開場時建物從焦點往外依序彈起">彈起開場</button>' : ''}${api.setHour ? '<button id="clLapse" aria-pressed="false" title="錄影期間時刻前進 3 小時">縮時</button>' : ''}<button id="clRec" class="sp-action sp-rec" title="錄下畫面並自動蓋上資料出處">● 錄製短片</button></div>` : ''}
${api.focusLatLng ? `<div class="sp-links"><a id="rokehan" href="#" target="_blank" rel="noopener noreferrer" title="在どこでもロケハン（MIYADAIKU／おやすみゲーム開発部）開同一地點：漫畫線稿背景、遠景與角色">在どこでもロケハン開啟此處　↗</a></div>` : ''}
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
  // ── 畫面風格 ──
  const syncLook = () => {
    if (!look) return; const v = look.get();
    $('lkDraw').value = v.draw; $('lkLine').value = v.lineW; $('lkTone').value = v.tone; $('lkLut').value = v.lut; $('lkTilt').value = v.tilt; $('lkFocus').value = v.focus; $('lkSoft').value = v.soft;
    $('lkLineOut').textContent = (+v.lineW).toFixed(1) + ' px'; $('lkToneOut').textContent = (+v.tone).toFixed(1) + ' px';
    $('lkTiltOut').textContent = Math.round(v.tilt * 100) + '%'; $('lkFocusOut').textContent = Math.round(v.focus * 100) + '%'; $('lkSoftOut').textContent = Math.round(v.soft * 100) + '%';
    $('lkLineRow').hidden = v.draw === 'color'; $('lkToneRow').hidden = v.draw !== 'lineTone'; $('lkLutRow').hidden = v.draw === 'line' || v.draw === 'lineTone'; $('lkFocusRow').hidden = v.tilt < 0.01;
  };
  const setLook = patch => { look.set(patch, eraNow()); syncLook(); api.redraw?.(); };
  if (look) {
    look.set(L, eraNow()); syncLook();
    $('lkDraw').onchange = () => { setLook({ draw: $('lkDraw').value }); status(`畫法：${DRAW_MODES[$('lkDraw').value]}`); };
    $('lkLut').onchange = () => { setLook({ lut: $('lkLut').value }); status(`調色表：${LUTS[look.lutKey]?.name || ''}${$('lkLut').value === 'auto' ? '（依年代）' : ''}`); };
    for (const [id, k] of [['lkLine', 'lineW'], ['lkTone', 'tone'], ['lkTilt', 'tilt'], ['lkFocus', 'focus'], ['lkSoft', 'soft']]) $(id).oninput = () => setLook({ [k]: +$(id).value });
    $('lkReset').onclick = () => { setLook({ ...LOOK_DEFAULT }); status('畫面風格已還原'); };
  }
  // ── 短片 ──
  let clip = null;
  if (canClip) {
    const sec = () => { $('clSecOut').textContent = $('clSec').value + ' 秒'; }; sec(); $('clSec').oninput = sec;
    if (api.state?.walk) $('clMove').value = 'still';
    for (const id of ['clPop', 'clLapse']) if ($(id)) $(id).onclick = () => press($(id), $(id).getAttribute('aria-pressed') !== 'true');
    $('clRec').onclick = async () => {
      if (clip) { clip.stop(); return; }
      api.grow?.finish(); window.eraGrow?.finish(); stopLapse(); press($('lapse'), false);
      const fname = (title || 'twtimes').replace(/[\\/:*?"<>|\s]+/g, '-');
      clip = recordClip(api, { aspect: $('clAspect').value, seconds: +$('clSec').value, move: $('clMove').value, pop: $('clPop')?.getAttribute('aria-pressed') === 'true', lapse: $('clLapse')?.getAttribute('aria-pressed') === 'true', name: fname }, status);
      $('clRec').textContent = '■ 停止錄製'; press($('clRec'), true);
      const { blob, name, mime } = await clip.done; clip = null;
      $('clRec').textContent = '● 錄製短片'; press($('clRec'), false);
      window.lastClip = { size: blob.size, mime, name };
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      status(`已下載短片 ${name}（${(blob.size / 1048576).toFixed(1)} MB，${mime.includes('mp4') ? 'MP4' : 'WebM'}），畫面右下已蓋上資料出處`);
    };
  }
  // ── どこでもロケハン ──
  if ($('rokehan')) { const upd = () => { $('rokehan').href = rokehanURL(api.focusLatLng()); }; upd(); for (const ev of ['pointerenter', 'pointerdown', 'focus', 'click']) $('rokehan').addEventListener(ev, upd); }
  return {
    // 年代或地點改變後：白模要套到新出現的網格；手動拉時刻時停止縮時；調色表「依年代自動」跟著換
    refresh() { if (clayOn(api)) clay(api, true); if (look && look.get().lut === 'auto') { look.set({}, eraNow()); } },
    decorateURL(u) { return look ? lookToQuery(look.get(), new URL(u)).href : u; },
    stopLapse() { if (lapse) { stopLapse(); press($('lapse'), false); } },
  };
}
