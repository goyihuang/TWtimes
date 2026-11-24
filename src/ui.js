import * as THREE from 'three';
import { ERAS, ERA_ORDER, LANDMARKS } from './eras.js';
import { WEATHERS } from './env.js';
import { FILTERS } from './render.js';
import { VIEWPOINTS } from './viewpoints.js';
import { sceneStore } from './edits.js';
import { centroid } from './geo.js';

const STYLE_NAMES = { modernTile: '現代・白磁磚', modernBeige: '現代・米色磁磚', modernConcrete: '現代・清水模', glass: '現代・玻璃帷幕', shophouse1935a: '昭和・洗石子街屋', shophouse1935b: '昭和・灰泥街屋', shophouse1935c: '昭和・橫帶街屋', brick: '紅磚洋樓', tatsuno: '辰野式紅磚', govt: '官廳・灰泥', wood: '日式木造', temple: '廟宇', qing: '清代閩南' };
const h = (tag, attrs = {}, ...kids) => { const el = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (k === 'class') el.className = v; else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null) el.append(c.nodeType ? c : document.createTextNode(c)); return el; };
const fmtTime = t => `${String(Math.floor(t)).padStart(2, '0')}:${String(Math.round((t % 1) * 60)).padStart(2, '0')}`;

export function buildUI(app) {
  const root = document.getElementById('ui');
  const ui = {};

  // ── 品牌與時代切換 ──
  const brand = h('div', { class: 'brand' }, h('div', { class: 'brand-title' }, '今昔時空'), h('div', { class: 'brand-sub' }, '臺中驛前　', h('span', { id: 'place' }, '')));
  const eraBtns = ERA_ORDER.map(id => h('button', { class: 'era-btn', 'data-era': id, onclick: () => app.setEra(id) }, h('b', {}, ERAS[id].short), h('span', {}, ERAS[id].label)));
  const eraBar = h('div', { class: 'era-bar' }, eraBtns[0], h('button', { class: 'era-swap', title: '切換時代（T）', onclick: () => toggleEra() }, '⇄'), eraBtns[1]);
  const toggleEra = () => { const i = ERA_ORDER.indexOf(app.eraId); app.setEra(ERA_ORDER[(i + 1) % ERA_ORDER.length]); };
  addEventListener('keydown', e => { if (e.target.closest('input,select,textarea')) return; if (e.code === 'KeyT') toggleEra(); if (e.code === 'KeyP') togglePhoto(); if (e.code === 'Escape' && app.photo.on) togglePhoto(); });

  // ── 面板 ──
  const timeIn = h('input', { type: 'range', min: 0, max: 24, step: 0.25, value: app.env.time, oninput: e => { app.env.setTime(+e.target.value); timeLbl.textContent = fmtTime(+e.target.value); } });
  const timeLbl = h('span', { class: 'val' }, fmtTime(app.env.time));
  const timePresets = h('div', { class: 'chips' }, ...[['清晨', 6.3], ['正午', 12], ['黃昏', 17.6], ['夜晚', 20.5]].map(([n, t]) => h('button', { onclick: () => { app.env.setTime(t); syncAll(); } }, n)));
  const weatherBtns = Object.entries(WEATHERS).map(([k, w]) => h('button', { 'data-w': k, onclick: () => { app.env.setWeather(k); syncAll(); } }, w.label));
  const envSec = h('section', {}, h('h3', {}, '時間與天氣'), h('label', { class: 'row' }, '時間', timeIn, timeLbl), timePresets, h('div', { class: 'chips weather' }, ...weatherBtns));

  const modeBtns = [['orbit', '鳥瞰'], ['walk', '漫步']].map(([m, n]) => h('button', { 'data-mode': m, onclick: () => { app.rig.setMode(m); syncAll(); } }, n));
  const vpList = h('div', { class: 'vp-list' }, ...VIEWPOINTS.map(v => h('button', { onclick: () => app.goto(v) }, v.title)));
  const viewSec = h('section', {}, h('h3', {}, '視角'), h('div', { class: 'chips' }, ...modeBtns), h('p', { class: 'hint walk-hint' }, '漫步：WASD／方向鍵移動、拖曳轉頭、Shift 加速、Q/E 升降'), h('h4', {}, '景點'), vpList, h('label', { class: 'row check' }, h('input', { type: 'checkbox', checked: true, onchange: e => labels.classList.toggle('off', !e.target.checked) }), '顯示地標名稱'));

  // 編輯
  const swIn = h('input', { type: 'range', min: 0.5, max: 2, step: 0.05, value: app.edits.global.streetWidth, oninput: e => { swLbl.textContent = '×' + (+e.target.value).toFixed(2); app.edits.setGlobal('streetWidth', +e.target.value); } });
  const swLbl = h('span', { class: 'val' }, '×' + app.edits.global.streetWidth.toFixed(2));
  const fdIn = h('input', { type: 'range', min: -4, max: 15, step: 1, value: app.edits.floorsDelta(app.eraId), oninput: e => { fdLbl.textContent = (e.target.value > 0 ? '+' : '') + e.target.value; app.edits.setFloorsDelta(app.eraId, +e.target.value); } });
  const fdLbl = h('span', { class: 'val' }, String(app.edits.floorsDelta(app.eraId)));
  const editToggle = h('input', { type: 'checkbox', onchange: e => { ui.editing = e.target.checked; document.body.classList.toggle('editing', ui.editing); if (!ui.editing) select(null); } });
  const selBox = h('div', { class: 'sel' }, h('p', { class: 'hint' }, '開啟「點選建物」後，在場景中點一棟房子即可調整樓層、外觀或隱藏。'));
  const editCount = h('span', { class: 'badge' });
  const fileIn = h('input', { type: 'file', accept: 'application/json', hidden: true, onchange: async e => { try { app.edits.import(await e.target.files[0].text()); syncAll(); toast('已匯入街景設定'); } catch (err) { toast('匯入失敗：' + err.message); } } });
  const editSec = h('section', {}, h('h3', {}, '編輯街景 ', editCount),
    h('p', { class: 'hint' }, '原始今昔街景不會被改動，所有修改都存在另一層，可隨時還原。'),
    h('label', { class: 'row' }, '街道寬度', swIn, swLbl), h('label', { class: 'row' }, '樓層增減', fdIn, fdLbl), h('p', { class: 'hint' }, '樓層增減只影響目前時代，古蹟不受影響。'),
    h('label', { class: 'row check' }, editToggle, '點選建物編輯（目前時代）'), selBox,
    h('div', { class: 'chips' }, h('button', { onclick: () => { if (confirm('還原成原始街景？所有編輯會清除。')) { app.edits.resetAll(); syncAll(); } } }, '全部還原'),
      h('button', { onclick: () => download(new Blob([app.edits.export()], { type: 'application/json' }), 'twtimes-街景設定.json') }, '匯出'), h('button', { onclick: () => fileIn.click() }, '匯入'), fileIn));

  // 場景存檔
  const sceneList = h('div', { class: 'scene-list' });
  const sceneName = h('input', { type: 'text', placeholder: '場景名稱，例如「雨夜綠川」' });
  const sceneSec = h('section', {}, h('h3', {}, '拍攝場景存檔'), h('div', { class: 'row' }, sceneName, h('button', { onclick: () => { const n = sceneName.value.trim() || `場景 ${new Date().toLocaleString('zh-TW')}`; sceneStore.save(app.snapshot(n)); sceneName.value = ''; renderScenes(); toast('已存檔：' + n); } }, '存檔')), sceneList,
    h('div', { class: 'chips' }, h('button', { onclick: async () => { const url = app.shareURL(); try { await navigator.clipboard.writeText(url); toast('已複製分享連結'); } catch { prompt('分享連結', url); } } }, '複製分享連結')));
  const renderScenes = () => { sceneList.replaceChildren(...sceneStore.list().map(s => h('div', { class: 'scene-item' }, h('button', { class: 'load', onclick: () => { app.restore(s); toast('已載入：' + s.name); } }, h('b', {}, s.name), h('small', {}, `${ERAS[s.era]?.short} · ${fmtTime(s.time)} · ${WEATHERS[s.weather]?.label}`)), h('button', { class: 'del', title: '刪除', onclick: () => { sceneStore.remove(s.name); renderScenes(); } }, '✕')))); };
  renderScenes();

  const about = h('section', { class: 'about' }, h('h3', {}, '關於'), h('p', {}, '街道與建物輪廓來自 OpenStreetMap；1935 年的街景依史料與舊照規則化重建，屬「重建示意」，非精確史實。'), h('p', {}, '© OpenStreetMap contributors（ODbL）'));

  const tabs = [['環境', envSec], ['視角', viewSec], ['編輯', editSec], ['場景', sceneSec], ['關於', about]];
  const tabBar = h('div', { class: 'tabs' }, ...tabs.map(([n], i) => h('button', { 'data-tab': i, onclick: () => showTab(i) }, n)));
  const body = h('div', { class: 'panel-body' }, ...tabs.map(t => t[1]));
  const panel = h('aside', { class: 'panel' }, h('button', { class: 'panel-toggle', onclick: () => panel.classList.toggle('collapsed') }, '☰'), tabBar, body);
  const showTab = i => { tabs.forEach(([, s], k) => s.hidden = k !== i); tabBar.querySelectorAll('button').forEach((b, k) => b.classList.toggle('on', k === i)); };
  showTab(0);
  if (innerWidth < 700) panel.classList.add('collapsed');

  // ── 拍照模式 ──
  const focalIn = h('input', { type: 'range', min: 14, max: 200, step: 1, value: app.photo.focal, oninput: e => { app.photo.focal = +e.target.value; focalLbl.textContent = e.target.value + 'mm'; } });
  const focalLbl = h('span', { class: 'val' }, app.photo.focal + 'mm');
  const apIn = h('input', { type: 'range', min: 0, max: 1, step: 0.02, value: app.photo.aperture, oninput: e => { app.photo.aperture = +e.target.value; apLbl.textContent = apText(); } });
  const apText = () => app.photo.aperture <= 0 ? '全清晰' : 'f/' + (16 - app.photo.aperture * 14.6).toFixed(1);
  const apLbl = h('span', { class: 'val' }, apText());
  const filterBtns = FILTERS.map(f => h('button', { 'data-f': f.id, onclick: () => { app.photo.filter = f.id; syncAll(); } }, f.label));
  const grainIn = h('input', { type: 'range', min: 0, max: 0.15, step: 0.005, value: app.photo.grain, oninput: e => app.photo.grain = +e.target.value });
  const vigIn = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: app.photo.vignette, oninput: e => app.photo.vignette = +e.target.value });
  const scaleSel = h('select', { onchange: e => app.photo.scale = +e.target.value }, ...[[1, '一般'], [2, '高畫質 2×'], [3, '超高 3×']].map(([v, n]) => h('option', { value: v, selected: v === app.photo.scale }, n)));
  const stampIn = h('input', { type: 'checkbox', checked: app.photo.stamp, onchange: e => app.photo.stamp = e.target.checked });
  const gallery = h('div', { class: 'gallery' });
  const shoot = async compare => {
    flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
    const blob = await app.capture({ compare }); const url = URL.createObjectURL(blob);
    const name = `今昔時空_${app.placeName()}_${compare ? '今昔對照' : ERAS[app.eraId].short}_${Date.now()}.jpg`;
    gallery.prepend(h('a', { href: url, download: name, title: '點一下下載' }, h('img', { src: url })));
    download(blob, name);
  };
  const photoBar = h('div', { class: 'photo-bar' },
    h('div', { class: 'pb-row' }, h('label', {}, '焦距', focalIn, focalLbl), h('label', {}, '景深', apIn, apLbl), h('button', { class: 'small', onclick: () => { app.photo.focus = app.autoFocus(); toast(`對焦 ${app.photo.focus.toFixed(0)} 公尺`); } }, '中心對焦')),
    h('div', { class: 'pb-row chips' }, ...filterBtns),
    h('div', { class: 'pb-row' }, h('label', {}, '顆粒', grainIn), h('label', {}, '暗角', vigIn), h('label', {}, scaleSel), h('label', { class: 'check' }, stampIn, '地點年代戳記')),
    h('div', { class: 'pb-row shoot' }, h('button', { class: 'ghost', onclick: () => togglePhoto() }, '離開'), h('button', { class: 'shutter', title: '拍照', onclick: () => shoot(false) }), h('button', { class: 'ghost', onclick: () => shoot(true) }, '今昔對照')),
    gallery);
  const flash = h('div', { class: 'flash' });
  const camBtn = h('button', { class: 'cam-btn', title: '拍照模式（P）', onclick: () => togglePhoto() }, '📷');
  const togglePhoto = () => { app.photo.on = !app.photo.on; document.body.classList.toggle('photo', app.photo.on); if (app.photo.on) { app.photo.focus = app.autoFocus(); } syncAll(); };
  const grid = h('div', { class: 'grid3' });

  // ── 手機漫步搖桿 ──
  const knob = h('div', { class: 'knob' }); const stick = h('div', { class: 'stick' }, knob);
  let sid = null, sx = 0, sy = 0;
  stick.addEventListener('pointerdown', e => { sid = e.pointerId; sx = e.clientX; sy = e.clientY; stick.setPointerCapture(sid); e.stopPropagation(); });
  stick.addEventListener('pointermove', e => { if (e.pointerId !== sid) return; const dx = THREE.MathUtils.clamp((e.clientX - sx) / 50, -1, 1), dy = THREE.MathUtils.clamp((e.clientY - sy) / 50, -1, 1); app.rig.stick.x = dx; app.rig.stick.y = dy; knob.style.transform = `translate(${dx * 30}px,${dy * 30}px)`; });
  const endStick = () => { sid = null; app.rig.stick.x = app.rig.stick.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);

  // ── 地標標籤 ──
  const labels = h('div', { class: 'labels' });
  const labelEls = [];
  for (const lm of LANDMARKS) {
    const b = app.landmarkFound[lm.key]; if (!b || !lm.label) continue;
    const [x, z] = centroid(b.ring); const el = h('div', { class: 'label' }); labels.append(el);
    labelEls.push({ lm, el, pos: new THREE.Vector3(x, 0, z) });
  }
  const v = new THREE.Vector3();
  ui.updateLabels = () => {
    const era = app.eraId;
    for (const L of labelEls) {
      const text = L.lm.label[era];
      const entry = app.eraGroups[era].buildings.index.find(e => e.b.id === app.landmarkFound[L.lm.key].id);
      if (!text || !entry || entry.hidden) { L.el.style.display = 'none'; continue; }
      v.copy(L.pos); v.y = app.heightOf(entry) + 6;
      const d = v.distanceTo(app.camera.position); v.project(app.camera);
      if (v.z > 1 || d > 700 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) { L.el.style.display = 'none'; continue; }
      L.el.style.display = ''; L.el.textContent = text;
      L.el.style.transform = `translate(-50%,-100%) translate(${(v.x * 0.5 + 0.5) * innerWidth}px,${(-v.y * 0.5 + 0.5) * innerHeight}px)`;
      L.el.style.opacity = String(THREE.MathUtils.clamp(1.4 - d / 500, 0.35, 1));
    }
  };

  // ── 點選建物 ──
  let selected = null; const box = new THREE.Box3Helper(new THREE.Box3(), 0xffd36b); box.visible = false; box.layers.enableAll(); app.scene.add(box);
  let down = null;
  app.renderer.domElement.addEventListener('pointerdown', e => down = [e.clientX, e.clientY]);
  app.renderer.domElement.addEventListener('pointerup', e => {
    if (!ui.editing || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const hit = app.pick(e.clientX, e.clientY); select(hit ? hit.entry.b.id : null);
  });
  const select = id => { selected = id; ui.refreshSelection(); };
  ui.refreshSelection = () => {
    editCount.textContent = app.edits.count() ? `已修改 ${app.edits.count()} 項` : '';
    if (!selected) { box.visible = false; selBox.replaceChildren(h('p', { class: 'hint' }, '開啟「點選建物」後，在場景中點一棟房子即可調整樓層、外觀或隱藏。')); return; }
    const entry = app.eraGroups[app.eraId].buildings.index.find(e => e.b.id === selected);
    if (!entry) { select(null); return; }
    const b = entry.b; const ed = app.edits.building(app.eraId, b.id) || {};
    const H = entry.hidden ? 4 : app.heightOf(entry);
    box.box.setFromArray([b.bbox[0], 0, b.bbox[1], b.bbox[2], H + 0.5, b.bbox[3]]); box.visible = true;
    const lv = h('input', { type: 'range', min: 1, max: 40, step: 1, value: entry.levels || 1, oninput: e => { lvl.textContent = e.target.value + ' 層'; app.edits.setBuilding(app.eraId, b.id, { levels: +e.target.value }); } });
    const lvl = h('span', { class: 'val' }, (entry.levels || 1) + ' 層');
    const st = h('select', { onchange: e => app.edits.setBuilding(app.eraId, b.id, { style: e.target.value || null }) }, h('option', { value: '' }, '（依時代自動）'), ...Object.entries(STYLE_NAMES).map(([k, n]) => h('option', { value: k, selected: ed.style === k }, n)));
    selBox.replaceChildren(
      h('div', { class: 'sel-title' }, b.tags.name || entry.lm?.label?.[app.eraId] || '未命名建物', h('small', {}, ` OSM ${b.id}`)),
      h('label', { class: 'row' }, '樓層', lv, lvl), h('label', { class: 'row' }, '外觀', st),
      h('div', { class: 'chips' }, h('button', { onclick: () => app.edits.setBuilding(app.eraId, b.id, { hidden: entry.hidden ? null : true }) }, entry.hidden ? '顯示' : '隱藏（變空地）'), h('button', { onclick: () => app.edits.resetBuilding(app.eraId, b.id) }, '還原這棟'), h('button', { onclick: () => select(null) }, '取消選取')));
  };

  // ── 提示 ──
  const toastEl = h('div', { class: 'toast' }); let tt;
  const toast = msg => { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => toastEl.classList.remove('show'), 2200); };
  const help = h('div', { class: 'help' }, h('b', {}, '歡迎來到今昔時空'), h('p', {}, '按下方的 ⇄（或鍵盤 T）在 1935 與現今之間切換；右側面板可以調時間、天氣、改街景；📷 進入拍照模式。'), h('button', { onclick: () => { help.remove(); localStorage.setItem('twtimes.help', '1'); } }, '開始探索'));

  root.append(labels, brand, eraBar, panel, camBtn, photoBar, grid, stick, flash, toastEl, h('div', { class: 'credit' }, '© OpenStreetMap contributors'));
  if (!localStorage.getItem('twtimes.help')) root.append(help);

  const syncAll = () => {
    eraBtns.forEach(b => b.classList.toggle('on', b.dataset.era === app.eraId));
    document.getElementById('place').textContent = ERAS[app.eraId].label;
    timeIn.value = app.env.time; timeLbl.textContent = fmtTime(app.env.time);
    weatherBtns.forEach(b => b.classList.toggle('on', b.dataset.w === app.env.weather));
    modeBtns.forEach(b => b.classList.toggle('on', b.dataset.mode === app.rig.mode));
    document.body.classList.toggle('walk', app.rig.mode === 'walk');
    filterBtns.forEach(b => b.classList.toggle('on', +b.dataset.f === app.photo.filter));
    swIn.value = app.edits.global.streetWidth; swLbl.textContent = '×' + (+app.edits.global.streetWidth).toFixed(2);
    const fdv = app.edits.floorsDelta(app.eraId); fdIn.value = fdv; fdLbl.textContent = (fdv > 0 ? '+' : '') + fdv;
    focalIn.value = app.photo.focal; focalLbl.textContent = app.photo.focal + 'mm'; apIn.value = app.photo.aperture; apLbl.textContent = apText();
    ui.refreshSelection();
  };
  ui.syncAll = syncAll; ui.syncEra = () => { syncAll(); if (selected) ui.refreshSelection(); };
  syncAll();
  return ui;
}

function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); }
