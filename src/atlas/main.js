// 全臺地圖首頁：MAP／ATLAS／TIME 三模式共用搜尋與篩選狀態
import './atlas.css';
import { indexScene, runQuery, FILTER_GROUPS } from './search.js';
import { BASEMAPS, HISTORY_LAYERS } from './layers.js';
import { sceneHref } from '../shared/registry.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUS_LABEL = { live: '已上線', dev: '開發中', planned: '候選地景' };
const CONF_LABEL = { A: '直接佐證', B: '照片推估', C: '示意' };

const state = { mode: 'map', q: '', filters: {}, sel: null, base: 'emap', hist: null, op: 0.85, swipe: null, view: null };
let registry, entries = [], periods = [], results = [], mapApi = null, mapReady = null;

// ---------- 網址狀態（返回地圖時保留位置與篩選） ----------
function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (['map', 'atlas', 'time'].includes(p.get('mode'))) state.mode = p.get('mode');
  state.q = p.get('q') || '';
  for (const g of FILTER_GROUPS) { const v = p.get(g.key); state.filters[g.key] = v ? v.split(',').filter(Boolean) : []; }
  state.sel = p.get('sel');
  if (p.get('base')) state.base = p.get('base');
  state.hist = p.get('hist');
  if (p.get('op')) state.op = Math.min(1, Math.max(0.1, +p.get('op') || 0.85));
  state.swipe = p.has('swipe') ? Math.min(1, Math.max(0, +p.get('swipe'))) : null;
  const v = (p.get('v') || '').split(',').map(Number);
  state.view = v.length === 3 && v.every(Number.isFinite) ? v : null;
}
function writeHash() {
  const p = new URLSearchParams();
  if (state.mode !== 'map') p.set('mode', state.mode);
  if (state.q) p.set('q', state.q);
  for (const g of FILTER_GROUPS) if (state.filters[g.key]?.length) p.set(g.key, state.filters[g.key].join(','));
  if (state.sel) p.set('sel', state.sel);
  if (state.base !== 'emap') p.set('base', state.base);
  if (state.hist) { p.set('hist', state.hist); if (state.op !== 0.85) p.set('op', state.op.toFixed(2)); if (state.swipe != null) p.set('swipe', state.swipe.toFixed(2)); }
  if (state.view) p.set('v', state.view.map((n, i) => n.toFixed(i === 2 ? 2 : 4)).join(','));
  const hash = p.toString();
  history.replaceState(null, '', hash ? '#' + hash : location.pathname + location.search);
}

// ---------- 篩選面板 ----------
function groupValues(key) {
  const tax = registry.taxonomy;
  if (key === 'period') return periods.map(p => [p.id, p.label]);
  if (key === 'status') return Object.entries(tax.status);
  if (key === 'city') return [...new Set(registry.scenes.map(s => s.city))].sort((a, b) => cityOrder(a) - cityOrder(b)).map(c => [c, c]);
  if (key === 'type') return tax.types.map(t => [t, t]);
  if (key === 'theme') return tax.themes.map(t => [t, t]);
  if (key === 'building') return tax.buildingStatus.map(t => [t, t]);
  return [];
}
const NORTH_TO_SOUTH = ['基隆市', '臺北市', '新北市', '桃園市', '新竹市', '新竹縣', '苗栗縣', '臺中市', '彰化縣', '南投縣', '雲林縣', '嘉義市', '嘉義縣', '臺南市', '高雄市', '屏東縣', '宜蘭縣', '花蓮縣', '臺東縣', '澎湖縣', '金門縣', '連江縣'];
const cityOrder = c => { const i = NORTH_TO_SOUTH.indexOf(c); return i < 0 ? 99 : i; };

function renderFilters() {
  const counts = key => { const out = {}; for (const e of entries) for (const v of FILTER_GROUPS.find(g => g.key === key).get(e.scene)) out[v] = (out[v] || 0) + 1; return out; };
  $('filters').innerHTML = FILTER_GROUPS.map(g => {
    const c = counts(g.key);
    return `<fieldset><legend>${g.label}</legend><div class="chips">${groupValues(g.key).map(([v, label]) =>
      `<button type="button" class="chip" data-group="${g.key}" data-value="${esc(v)}" aria-pressed="${state.filters[g.key]?.includes(v) ? 'true' : 'false'}">${esc(label)}<small>${c[v] || 0}</small></button>`).join('')}</div></fieldset>`;
  }).join('');
}
function toggleFilter(key, value, only = false) {
  const list = state.filters[key] || (state.filters[key] = []);
  const i = list.indexOf(value);
  if (only) state.filters[key] = i >= 0 && list.length === 1 ? [] : [value];
  else if (i >= 0) list.splice(i, 1); else list.push(value);
  update({ fit: true });
}
function activeChips() {
  const chips = [];
  if (state.q) chips.push(`<button class="active-chip" data-clear="q">搜尋「${esc(state.q)}」 ×</button>`);
  for (const g of FILTER_GROUPS) for (const v of state.filters[g.key] || []) {
    const label = g.key === 'period' ? periods.find(p => p.id === v)?.label : g.key === 'status' ? STATUS_LABEL[v] : v;
    chips.push(`<button class="active-chip" data-clear="${g.key}" data-value="${esc(v)}">${g.label}：${esc(label)} ×</button>`);
  }
  $('active').innerHTML = chips.length ? chips.join('') + '<button class="clear-all" data-clear="all">清除全部</button>' : '<span class="hint">同一類標籤任一符合，不同類需全部符合</span>';
}

// ---------- 結果清單、預覽卡 ----------
const thumb = s => s.thumbnail ? `<img src="${esc(s.thumbnail)}" alt="" loading="lazy">` : `<span class="seal">${esc(s.name.slice(0, 1))}</span>`;
const eraLine = s => (s.eras || []).map(e => esc(e.year)).join(' · ');
function enterButton(s, cls = '') {
  if (s.status === 'live' && s.entry) return `<a class="enter ${cls}" href="${esc(s.entry)}">進入 3D 街景 <span>↗</span></a>`;
  // 未上線但有座標：先用 OSM 自動生成的現代街景
  if (Number.isFinite(s.lat)) return `<a class="enter modern ${cls}" href="${esc(sceneHref(s))}" title="依 OpenStreetMap 自動生成，歷史年代尚未建模">看現代街景 3D <span>↗</span></a>`;
  return `<span class="enter disabled ${cls}">${STATUS_LABEL[s.status] || '籌備中'}・尚未開放</span>`;
}
function renderList() {
  $('count').textContent = `${results.length} 處地景`;
  const noCoord = results.filter(r => r.scene.lat == null).length;
  $('countNote').textContent = noCoord ? `其中 ${noCoord} 處座標待查，未標於地圖` : '';
  $('results').innerHTML = results.length ? results.map(({ scene: s }) => `
    <li><button class="result ${s.id === state.sel ? 'on' : ''} ${s.status}" data-id="${s.id}" aria-pressed="${s.id === state.sel}">
      <span class="r-thumb">${thumb(s)}</span>
      <span class="r-body"><strong>${esc(s.name)}</strong><small>${esc(s.city)}${s.district ? '・' + esc(s.district) : ''}</small><em>${eraLine(s)}</em></span>
      <span class="badge ${s.status}">${STATUS_LABEL[s.status]}</span></button></li>`).join('')
    : '<li class="empty">沒有符合的地景。試試別名（如「台中車站」「臺灣神社」）或清除部分標籤。</li>';
}
function renderPreview() {
  const s = registry.scenes.find(x => x.id === state.sel);
  const card = $('preview');
  if (!s) { card.hidden = true; return; }
  card.hidden = false;
  card.innerHTML = `
    <button class="pv-close" aria-label="關閉預覽">×</button>
    <div class="pv-media">${thumb(s)}<span class="badge ${s.status}">${STATUS_LABEL[s.status]}</span></div>
    <div class="pv-text">
      <div class="kicker">${esc(s.nameEn || '')}</div>
      <h2>${esc(s.name)}</h2>
      <p class="pv-place">${esc(s.city)}${s.district ? '・' + esc(s.district) : ''}${s.lat == null ? '・<b>座標待查</b>' : ''}</p>
      <div class="pv-eras">${(s.eras || []).map(e => `<span data-period="${e.period}">${esc(e.year)}</span>`).join('')}</div>
      <p class="pv-summary">${esc(s.summary)}</p>
      <div class="pv-tags">${[...(s.types || []), ...(s.themes || []), s.buildingStatus].filter(Boolean).map(t => `<span>${esc(t)}</span>`).join('')}</div>
      <div class="pv-actions">${enterButton(s)}${s.extra ? `<a class="ghost" href="${esc(s.extra.href)}">${esc(s.extra.label)} ↗</a>` : ''}</div>
      <p class="pv-meta">${s.confidence ? `重建可信度：${s.confidence}（${CONF_LABEL[s.confidence]}）` : '尚未建模'}${s.sources?.length ? '・來源：' + s.sources.map(x => `<a href="${esc(x.url)}" target="_blank" rel="noreferrer">${esc(x.label)}</a>`).join('、') : ''}</p>
    </div>`;
}

// ---------- 圖鑑 ----------
function renderAtlas() {
  $('atlasGrid').innerHTML = results.length ? results.map(({ scene: s }) => `
    <article class="card ${s.status}">
      <button class="card-media" data-id="${s.id}" aria-label="在地圖上查看 ${esc(s.name)}">${thumb(s)}<span class="badge ${s.status}">${STATUS_LABEL[s.status]}</span></button>
      <div class="card-body">
        <div class="kicker">${esc(s.city)}${s.district ? '・' + esc(s.district) : ''}</div>
        <h3>${esc(s.name)}</h3>
        <p>${esc(s.summary)}</p>
        <div class="pv-eras">${(s.eras || []).map(e => `<span data-period="${e.period}">${esc(e.year)}</span>`).join('')}</div>
        <div class="card-foot">${enterButton(s, 'small')}<button class="ghost small" data-locate="${s.id}">${s.lat == null ? '座標待查' : '地圖定位'}</button></div>
      </div>
    </article>`).join('') : '<p class="empty">沒有符合的地景。</p>';
}

// ---------- 時間軸 ----------
function renderTime() {
  const want = state.filters.period || [];
  $('timeline').innerHTML = periods.map(p => {
    const rows = results.filter(r => r.scene.eras?.some(e => e.period === p.id));
    const on = want.includes(p.id);
    return `<section class="period ${on ? 'on' : ''} ${want.length && !on ? 'dim' : ''}">
      <button class="period-head" data-period="${p.id}" aria-pressed="${on}"><span class="kicker">${p.en}</span><strong>${p.label}</strong><small>${p.from}–${p.id === 'future' ? '' : p.to}</small><em>${rows.length} 處</em></button>
      <ol>${rows.map(({ scene: s }) => `<li><button class="t-item ${s.status}" data-id="${s.id}">
        <span class="t-years">${s.eras.filter(e => e.period === p.id).map(e => esc(e.year)).join('・')}</span>
        <strong>${esc(s.name)}</strong><small>${esc(s.city)}・${STATUS_LABEL[s.status]}</small></button></li>`).join('') || '<li class="t-empty">尚無此年代的場景。不代表每一年都有模型，只列出實際具備的年代。</li>'}</ol>
      ${HISTORY_LAYERS.some(h => h.period === p.id) ? `<button class="ghost small t-layer" data-layer-period="${p.id}">在地圖疊上${p.label}古地圖</button>` : ''}
    </section>`;
  }).join('');
}

// ---------- 主更新 ----------
function update({ fit = false, flyTo = false } = {}) {
  results = runQuery(entries, state.q, state.filters);
  if (state.sel && !results.some(r => r.scene.id === state.sel)) state.sel = null;
  document.body.dataset.mode = state.mode;
  for (const b of document.querySelectorAll('[data-mode-tab]')) b.setAttribute('aria-pressed', String(b.dataset.modeTab === state.mode));
  renderFilters(); activeChips(); renderList(); renderPreview();
  if (state.mode === 'atlas') renderAtlas();
  if (state.mode === 'time') renderTime();
  if (mapApi) {
    mapApi.setScenes(results.map(r => r.scene), state.sel);
    mapApi.highlightCities(state.filters.city || []);
    const sel = registry.scenes.find(s => s.id === state.sel);
    if (sel && flyTo) mapApi.focusScene(sel);
    else if (fit && state.mode === 'map') mapApi.fitScenes(results.map(r => r.scene));
  }
  writeHash();
}
function select(id, fromMap = false) {
  state.sel = state.sel === id && !fromMap ? null : id;
  update({ flyTo: !!state.sel });
  if (state.sel) document.body.classList.remove('sheet-open');
}
function setMode(mode) {
  state.mode = mode; update();
  if (mode === 'map') ensureMap().then(() => mapApi.invalidate());
}

// ---------- 地圖（延遲載入，不預載任何 Three.js） ----------
function ensureMap() {
  if (mapReady) return mapReady;
  mapReady = import('./map.js').then(({ createMap }) => {
    mapApi = createMap($('map'), {
      onSelect: id => select(id, true),
      onCounty: name => toggleFilter('city', name, true),
      onView: (lat, lng, z) => { state.view = [lat, lng, z]; writeHash(); },
    });
    $('map').addEventListener('basemap-error', e => toast(`「${e.detail.label}」底圖無法連線，暫時改用離線縣市輪廓。`, () => { $('basemap').value = 'none'; mapApi.setBasemap('none'); }));
    mapApi.setBasemap(state.base);
    if (state.view) mapApi.setView(...state.view);
    mapApi.setHistory(state.hist); mapApi.setOpacity(state.op); mapApi.setSwipe(state.swipe);
    update({ flyTo: !state.view && !!state.sel });
    window.__atlas = { state, mapApi, results: () => results.map(r => r.scene.id) };
  });
  return mapReady;
}
let toastTimer;
function toast(text, then) {
  const t = $('toast'); t.textContent = text; t.hidden = false; then?.();
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 5200);
}

// ---------- 圖層控制 ----------
function setupLayerControls() {
  $('basemap').innerHTML = BASEMAPS.map(b => `<option value="${b.id}">${b.label}</option>`).join('');
  $('basemap').value = state.base;
  $('history').innerHTML = '<option value="">不疊圖（今日）</option>' + periods.map(p => {
    const list = HISTORY_LAYERS.filter(h => h.period === p.id);
    return list.length ? `<optgroup label="${p.label}">${list.map(h => `<option value="${h.id}">${h.label}</option>`).join('')}</optgroup>` : '';
  }).join('');
  $('history').value = state.hist || '';
  $('opacity').value = state.op; $('swipe').value = state.swipe ?? 0.5; $('swipeOn').checked = state.swipe != null;
  const sync = () => {
    const on = !!state.hist;
    $('layerExtras').hidden = !on;
    document.querySelector('.swipe-line').hidden = !(on && state.swipe != null);
    if (on && state.swipe != null) document.querySelector('.swipe-line').style.left = (state.swipe * 100) + '%';
  };
  $('basemap').onchange = e => { state.base = e.target.value; mapApi?.setBasemap(state.base); writeHash(); };
  $('history').onchange = e => { state.hist = e.target.value || null; mapApi?.setHistory(state.hist); sync(); writeHash(); const n = HISTORY_LAYERS.find(h => h.id === state.hist)?.note; if (n) toast(n); };
  $('opacity').oninput = e => { state.op = +e.target.value; mapApi?.setOpacity(state.op); writeHash(); };
  $('swipeOn').onchange = e => { state.swipe = e.target.checked ? +$('swipe').value : null; mapApi?.setSwipe(state.swipe); sync(); writeHash(); };
  $('swipe').oninput = e => { state.swipe = +e.target.value; $('swipeOn').checked = true; mapApi?.setSwipe(state.swipe); sync(); writeHash(); };
  // 拖曳畫面上的古今分隔線
  const line = document.querySelector('.swipe-line');
  line.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation(); line.setPointerCapture(e.pointerId);
    const rect = $('map').getBoundingClientRect();
    const move = ev => { state.swipe = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width)); $('swipe').value = state.swipe; mapApi?.setSwipe(state.swipe); sync(); };
    const up = () => { line.removeEventListener('pointermove', move); writeHash(); };
    line.addEventListener('pointermove', move); line.addEventListener('pointerup', up, { once: true });
  });
  sync();
  return sync;
}

// ---------- 事件 ----------
function bind(syncLayers) {
  for (const b of document.querySelectorAll('[data-mode-tab]')) b.onclick = () => setMode(b.dataset.modeTab);
  let typing;
  $('q').value = state.q;
  $('q').oninput = e => { clearTimeout(typing); typing = setTimeout(() => { state.q = e.target.value.trim(); update({ fit: true }); }, 140); };
  $('searchForm').onsubmit = e => { e.preventDefault(); state.q = $('q').value.trim(); update({ fit: true }); if (results[0]) select(results[0].scene.id, true); };
  $('filters').onclick = e => { const b = e.target.closest('.chip'); if (b) toggleFilter(b.dataset.group, b.dataset.value); };
  $('active').onclick = e => {
    const b = e.target.closest('[data-clear]'); if (!b) return;
    const k = b.dataset.clear;
    if (k === 'all') { state.q = ''; $('q').value = ''; for (const g of FILTER_GROUPS) state.filters[g.key] = []; }
    else if (k === 'q') { state.q = ''; $('q').value = ''; }
    else state.filters[k] = state.filters[k].filter(v => v !== b.dataset.value);
    update({ fit: true });
  };
  $('results').onclick = e => { const b = e.target.closest('.result'); if (b) { if (state.mode !== 'map') setMode('map'); select(b.dataset.id); } };
  $('preview').onclick = e => { if (e.target.closest('.pv-close')) { state.sel = null; update(); } };
  $('atlasGrid').onclick = e => {
    const b = e.target.closest('[data-id],[data-locate]'); if (!b) return;
    const id = b.dataset.id || b.dataset.locate;
    const s = registry.scenes.find(x => x.id === id);
    state.sel = id; setMode('map'); ensureMap().then(() => s.lat != null && mapApi.focusScene(s));
  };
  $('timeline').onclick = e => {
    const head = e.target.closest('.period-head'); if (head) return toggleFilter('period', head.dataset.period);
    const item = e.target.closest('.t-item'); if (item) { state.sel = item.dataset.id; setMode('map'); ensureMap().then(() => update({ flyTo: true })); return; }
    const lay = e.target.closest('[data-layer-period]');
    if (lay) {
      const h = HISTORY_LAYERS.find(x => x.period === lay.dataset.layerPeriod && x.id === 'JM20K_1904') || HISTORY_LAYERS.find(x => x.period === lay.dataset.layerPeriod);
      state.hist = h.id; $('history').value = h.id; setMode('map'); ensureMap().then(() => { mapApi.setHistory(h.id); syncLayers(); writeHash(); });
    }
  };
  $('sheetHandle').onclick = () => document.body.classList.toggle('sheet-open');
  $('layersBtn').onclick = () => { const p = $('layerPanel'); p.hidden = !p.hidden; $('layersBtn').setAttribute('aria-expanded', String(!p.hidden)); };
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement !== $('q')) { e.preventDefault(); $('q').focus(); }
    if (e.key === 'Escape' && state.sel) { state.sel = null; update(); }
  });
  window.addEventListener('hashchange', () => { readHash(); $('q').value = state.q; update(); });
}

// ---------- 啟動 ----------
async function start() {
  readHash();
  try {
    registry = await fetch(new URL('data/scene-registry.json', document.baseURI)).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  } catch (err) {
    $('results').innerHTML = '<li class="empty">地景資料庫載入失敗，請重新整理。</li>';
    return;
  }
  periods = registry.taxonomy.periods;
  entries = registry.scenes.map(scene => ({ scene, fields: indexScene(scene) }));
  $('liveCount').textContent = registry.scenes.filter(s => s.status === 'live').length;
  $('allCount').textContent = registry.scenes.length;
  const sync = setupLayerControls();
  bind(sync);
  update();
  if (state.mode === 'map') ensureMap(); else document.body.dataset.mode = state.mode;
}
start();
