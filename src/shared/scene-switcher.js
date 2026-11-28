// 景點切換選單：3D 街景頁上方的景點列＋全螢幕景點目錄。資料全部來自 scene-registry.json。
// - 景點列：目前景點、上一個／下一個（北到南）、已上線景點捷徑、搜尋、全臺地圖
// - 臺灣 101 處清單（左側抽屜，依縣市分組）＋隨機抽一處：資料來自 places-101.json
// - 景點目錄（Ctrl/⌘＋K 或 /）：搜尋（與地圖共用 search.js）、地區／年代／類型／呈現方式篩選、
//   臺灣小地圖、最近看過；已上線景點進 3D 今昔，其餘有座標的景點直接開 OSM 現代街景
import './scene-switcher.css';
import { indexScene, runQuery } from '../atlas/search.js';
import { REGIONS, regionOf, modeOf, MODE_LABEL, sceneHref, worldHref, currentScene, geoOrder, project, MINI } from './registry.js';
import { loadPlaces, groupByCity, placeHref, placeLabel, randomPlace, searchPlaces } from './places.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const RECENT_KEY = 'twtimes.recent.v1', DRAWER_KEY = 'twtimes.places.open';
const readRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter(x => typeof x === 'string'); } catch { return []; } };

// 選單自己的篩選維度（同組 OR、跨組 AND）
const GROUPS = [
  { key: 'region', label: '地區', get: s => [regionOf(s.city)], values: () => REGIONS.map(r => [r.id, r.label]) },
  { key: 'mode', label: '呈現', get: s => [modeOf(s)], values: () => Object.entries(MODE_LABEL) },
  { key: 'period', label: '年代', get: s => [...new Set((s.eras || []).map(e => e.period))], values: reg => reg.taxonomy.periods.map(p => [p.id, p.label]) },
  { key: 'type', label: '類型', get: s => s.types || [], values: reg => reg.taxonomy.types.map(t => [t, t]) },
];
export function filterScenes(entries, query, filters) {
  return runQuery(entries, query, {}).filter(({ scene: s }) => GROUPS.every(g => !filters[g.key]?.length || filters[g.key].some(v => g.get(s).includes(v))));
}

export async function mountSceneSwitcher({ host = document.querySelector('.destination-bar') } = {}) {
  let reg;
  try { reg = await fetch(new URL('data/scene-registry.json', document.baseURI)).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  catch (err) { console.warn('景點資料庫載入失敗，保留原本的城市列', err); return null; }
  // 101 處清單載入失敗不影響原本的景點列
  const places = await loadPlaces().then(d => d.places).catch(err => { console.warn('101 處清單載入失敗', err); return []; });
  const scenes = reg.scenes, ordered = geoOrder(scenes.filter(s => modeOf(s) !== 'card'));
  const entries = scenes.map(scene => ({ scene, fields: indexScene(scene) }));
  const q = new URLSearchParams(location.search);
  // 101 清單的 id 優先（與 streetscape/platform.js 的查找順序一致）
  const curPlace = ['osm', 'tw'].includes(q.get('place')) ? places.find(p => p.id === q.get('id')) || null : null;
  const cur = currentScene(scenes, location.search);
  // OSM 現代街景也能用任意座標開啟（地圖上點選空白處）
  const adhoc = !cur && q.get('place') === 'osm' ? { id: null, name: q.get('name') || '自選地點', city: '', lat: +q.get('lat'), lng: +q.get('lng') } : null;

  // 最近看過
  if (cur) { const r = [cur.id, ...readRecent().filter(id => id !== cur.id)].slice(0, 8); try { localStorage.setItem(RECENT_KEY, JSON.stringify(r)); } catch { } }

  // ── 景點列 ──
  const bar = document.createElement('nav');
  bar.className = 'ss-bar'; bar.id = 'sceneSwitcher'; bar.setAttribute('aria-label', '切換景點');
  const me = curPlace || cur || adhoc;
  // 在 101 清單的地點上，上一個／下一個就沿著 101 清單走；否則沿著今昔地景（北到南）
  const stepList = curPlace ? places : ordered, stepHref = curPlace ? placeHref : sceneHref;
  const idx = curPlace ? places.indexOf(curPlace) : cur ? ordered.findIndex(s => s.id === cur.id) : -1;
  const near = (d) => stepList.length ? stepList[(idx + d + stepList.length) % stepList.length] : null;
  const live = ordered.filter(s => modeOf(s) === 'history3d');
  bar.innerHTML = `${places.length ? `
    <button class="ss-places" id="plOpen" aria-controls="plDrawer" aria-expanded="false" title="臺灣 ${places.length} 處現代街景清單（依縣市分組）"><span aria-hidden="true">☰</span> 臺灣 ${places.length}</button>` : ''}
    <button class="ss-current" id="ssOpen" aria-haspopup="dialog" title="開啟景點目錄（Ctrl＋K）">
      <span class="ss-thumb">${me?.thumbnail ? `<img src="${esc(me.thumbnail)}" alt="">` : `<i>${esc((me?.name || '景').slice(0, 1))}</i>`}</span>
      <span class="ss-name"><small>${esc(me ? [me.city, me.district].filter(Boolean).join('・') || '自選座標' : '選擇景點')}${me ? `・${esc(MODE_LABEL[modeOf(me)] || '現代街景')}` : ''}</small><strong>${esc(me?.name || '景點目錄')}</strong></span>
      <span class="ss-caret" aria-hidden="true">▾</span>
    </button>
    <div class="ss-steps">
      <a class="ss-step" id="ssPrev" href="${esc(near(-1) ? stepHref(near(-1)) : '#')}" title="上一個：${esc(near(-1)?.name || '')}" aria-label="上一個景點">‹</a>
      <a class="ss-step" id="ssNext" href="${esc(near(1) ? stepHref(near(1)) : '#')}" title="下一個：${esc(near(1)?.name || '')}" aria-label="下一個景點">›</a>
    </div>${places.length ? `
    <button class="ss-random" id="plRandom" title="從臺灣 ${places.length} 處隨機抽一個地方"><span aria-hidden="true">🎲</span> 隨機</button>` : ''}
    <div class="ss-strip" role="list" aria-label="已上線的 3D 今昔景點">${live.map(s => `<a role="listitem" class="ss-chip ${s.id === cur?.id ? 'on' : ''}" href="${esc(sceneHref(s))}" ${s.id === cur?.id ? 'aria-current="page"' : ''}><img src="${esc(s.thumbnail)}" alt="" loading="lazy"><span>${esc(shortName(s))}</span></a>`).join('')}</div>
    <button class="ss-search" id="ssSearch" title="搜尋全部景點（Ctrl＋K）">⌕ <span>全部 ${scenes.length} 處</span></button>
    <a class="ss-map ss-world" href="${esc(cur ? worldHref(cur) : './?place=tw')}" title="全臺地形、道路與建物連成一片，鏡頭移到哪裡就載到哪裡"${q.get('place') === 'tw' ? ' aria-current="page"' : ''}>全臺立體 <span>⛰</span></a>
    <a class="ss-map" href="./map.html${cur ? '#sel=' + encodeURIComponent(cur.id) : ''}">全臺地圖 <span>↗</span></a>`;
  host.before(bar); document.body.classList.add('ss-ready');
  bar.querySelector('.ss-chip.on')?.scrollIntoView({ block: 'nearest', inline: 'center' });

  // ── 景點目錄 ──
  const dlg = document.createElement('dialog');
  dlg.className = 'ss-dialog'; dlg.id = 'ssDialog'; dlg.setAttribute('aria-label', '景點目錄');
  dlg.innerHTML = `
    <div class="ss-head">
      <div><div class="ss-kicker">SCENE DIRECTORY · 全臺景點目錄</div><h2>要去哪裡？</h2></div>
      <form class="ss-q" role="search" method="dialog"><input id="ssQ" type="search" placeholder="地名、舊名、別名、年份…（如：台中車站、臺灣神社、1936）" autocomplete="off" enterkeyhint="go"><button type="submit" aria-label="前往第一筆">↵</button></form>
      <button class="ss-close" id="ssClose" aria-label="關閉">×</button>
    </div>
    <div class="ss-filters" id="ssFilters"></div>
    <div class="ss-body">
      <figure class="ss-mini" aria-label="臺灣景點分布"><svg id="ssMap" viewBox="0 0 ${MINI.w} ${MINI.h}" role="img"></svg><figcaption><i class="d history3d"></i>3D 今昔 <i class="d modern"></i>現代街景（OSM 自動生成）</figcaption></figure>
      <div class="ss-list" id="ssList"></div>
    </div>
    <p class="ss-foot">現代街景依 OpenStreetMap 即時生成，作為逐步加入歷史年代的底稿。${places.length ? `<a href="#" id="ssToPlaces">☰ 臺灣 ${places.length} 處現代街景清單</a>` : ''}<a href="./map.html">在全臺地圖上看全部 ↗</a></p>`;
  document.body.append(dlg);

  const st = { q: '', f: {} };
  function renderFilters() {
    $('ssFilters').innerHTML = GROUPS.map(g => `<div class="ss-group"><span>${g.label}</span>${g.values(reg).map(([v, l]) => {
      const n = scenes.filter(s => g.get(s).includes(v)).length; if (!n) return '';
      const on = st.f[g.key]?.includes(v);
      return `<button data-g="${g.key}" data-v="${esc(v)}" aria-pressed="${!!on}">${esc(l)}<small>${n}</small></button>`;
    }).join('')}</div>`).join('');
  }
  function card(s) {
    const m = modeOf(s), here = s.id === cur?.id;
    return `<a class="ss-card ${m} ${here ? 'here' : ''}" href="${esc(sceneHref(s))}" data-id="${esc(s.id)}" ${here ? 'aria-current="page"' : ''}>
      <span class="ss-cthumb">${s.thumbnail ? `<img src="${esc(s.thumbnail)}" alt="" loading="lazy">` : `<i>${esc(s.name.slice(0, 1))}</i>`}</span>
      <span class="ss-cbody"><strong>${esc(s.name)}</strong><small>${esc(s.city)}${s.district ? '・' + esc(s.district) : ''}</small>
      <em>${(s.eras || []).map(e => esc(e.year)).join(' · ')}</em></span>
      <span class="ss-badge ${m}">${here ? '目前位置' : MODE_LABEL[m]}</span></a>`;
  }
  function renderList() {
    const res = filterScenes(entries, st.q, st.f).map(r => r.scene);
    const hasQuery = st.q || Object.values(st.f).some(v => v.length);
    let html = '';
    if (!hasQuery) {
      const rec = readRecent().map(id => scenes.find(s => s.id === id)).filter(Boolean).filter(s => s.id !== cur?.id).slice(0, 4);
      if (rec.length) html += `<section><h3>最近看過</h3><div class="ss-grid">${rec.map(card).join('')}</div></section>`;
      for (const r of REGIONS) {
        const list = geoOrder(res.filter(s => regionOf(s.city) === r.id)); if (!list.length) continue;
        html += `<section><h3>${r.label}<small>${list.length} 處</small></h3><div class="ss-grid">${list.map(card).join('')}</div></section>`;
      }
    } else html = res.length ? `<section><h3>找到 ${res.length} 處</h3><div class="ss-grid">${res.map(card).join('')}</div></section>` : '<p class="ss-empty">沒有符合的景點。試試舊名或別名（如「台中驛」「臺灣神社」），或清除部分篩選。</p>';
    $('ssList').innerHTML = html;
    drawDots(res);
  }
  let outline = null;
  async function drawMap() {
    if (outline !== null) return; outline = '';
    try {
      const geo = await fetch(new URL('data/tw-counties.geo.json', document.baseURI)).then(r => r.json());
      const ring = r => 'M' + r.map(([x, y]) => project(x, y).map(v => v.toFixed(1)).join(',')).join('L') + 'Z';
      outline = geo.features.map(f => `<path d="${(f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).map(p => ring(p[0])).join('')}"><title>${esc(f.properties.name)}</title></path>`).join('');
    } catch { outline = ''; }
    renderList();
  }
  function drawDots(res) {
    const show = new Set(res.map(s => s.id));
    const dots = scenes.filter(s => Number.isFinite(s.lat)).map(s => {
      const [x, y] = project(Math.max(MINI.lng0 + 0.05, s.lng), Math.min(MINI.lat1 - 0.05, s.lat));
      return `<a href="${esc(sceneHref(s))}" data-id="${esc(s.id)}" class="dot ${modeOf(s)} ${show.has(s.id) ? '' : 'dim'} ${s.id === cur?.id ? 'here' : ''}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s.id === cur?.id ? 6 : 4.2}"/><title>${esc(s.name)}</title></a>`;
    }).join('');
    $('ssMap').innerHTML = `<g class="land">${outline || ''}</g>${dots}`;
  }
  const hover = (id, on) => { dlg.querySelectorAll(`[data-id="${CSS.escape(id)}"]`).forEach(n => n.classList.toggle('hot', on)); };
  dlg.addEventListener('pointerover', e => { const n = e.target.closest('[data-id]'); if (n) hover(n.dataset.id, true); });
  dlg.addEventListener('pointerout', e => { const n = e.target.closest('[data-id]'); if (n) hover(n.dataset.id, false); });
  $('ssFilters').onclick = e => {
    const b = e.target.closest('button[data-g]'); if (!b) return;
    const arr = st.f[b.dataset.g] ||= []; const i = arr.indexOf(b.dataset.v); if (i >= 0) arr.splice(i, 1); else arr.push(b.dataset.v);
    renderFilters(); renderList();
  };
  $('ssQ').oninput = () => { st.q = $('ssQ').value; renderList(); };
  dlg.querySelector('.ss-q').onsubmit = e => { e.preventDefault(); const a = $('ssList').querySelector('.ss-card:not(.here)') || $('ssList').querySelector('.ss-card'); if (a) location.assign(a.href); };
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  $('ssClose').onclick = () => dlg.close();

  function open(focus = true) {
    renderFilters(); renderList(); drawMap();
    if (!dlg.open) dlg.showModal();
    if (focus) $('ssQ').focus();
  }
  $('ssOpen').onclick = () => open(); $('ssSearch').onclick = () => open();
  addEventListener('keydown', e => {
    const typing = /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.target.isContentEditable;
    if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) { e.preventDefault(); open(); }
  });
  const drawer = places.length ? mountPlacesDrawer(places, curPlace, scenes) : null;
  if (drawer) {
    $('plOpen').onclick = () => drawer.toggle();
    $('plRandom').onclick = () => drawer.random();
    $('ssToPlaces').onclick = e => { e.preventDefault(); dlg.close(); drawer.toggle(true); };
  }
  window.__switcher = { open, close: () => dlg.close(), scenes, current: cur, places, currentPlace: curPlace, drawer };
  return { open, current: cur, registry: reg, places };
}

const shortName = s => s.name.replace(/[・·].*$/, '').replace(/\s.*$/, '');

// ── 臺灣 101 處：左側抽屜清單（依縣市分組、可搜尋、隨機抽一處）──
// 開合狀態記在 localStorage，換地點後維持原狀，像工具軟體的側欄一樣一路開著。
function mountPlacesDrawer(places, curPlace, scenes) {
  const live = new Map(scenes.filter(s => modeOf(s) === 'history3d').map(s => [s.id, s]));
  const el = document.createElement('aside');
  el.className = 'pl-drawer'; el.id = 'plDrawer'; el.setAttribute('aria-label', `臺灣 ${places.length} 處現代街景`);
  el.innerHTML = `
    <div class="pl-head"><div><small>TAIWAN ${places.length} · MODERN STREETSCAPE</small><strong>臺灣 ${places.length} 處</strong></div><button class="pl-close" id="plClose" aria-label="收合清單">‹</button></div>
    <div class="pl-tools"><input id="plQ" type="search" placeholder="搜尋地名、別名、縣市…" autocomplete="off" aria-label="搜尋 101 處"><button id="plRand" title="隨機抽一個地方">🎲 隨機抽一處</button></div>
    <div class="pl-list" id="plList"></div>
    <p class="pl-foot">點一下就依 © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> 生成現代 3D 街景（約 1 公里見方）。<b class="pl-h">今昔</b> 表示另有 3D 今昔場景。</p>`;
  document.body.append(el);
  const list = el.querySelector('#plList'), input = el.querySelector('#plQ');
  function render() {
    const res = searchPlaces(places, input.value), q = input.value.trim();
    list.innerHTML = res.length ? groupByCity(res).map(({ city, list: ps }) => `
      <details ${q || !curPlace || curPlace.city === city || ps.length < 5 ? 'open' : ''}><summary>${esc(city)}<small>${ps.length}</small></summary><ul>${ps.map(p => {
        const here = p.id === curPlace?.id, h = live.get(p.id);
        return `<li><a class="pl-item ${here ? 'here' : ''}" href="${esc(placeHref(p))}" data-id="${esc(p.id)}" ${here ? 'aria-current="page"' : ''}><span>${esc(placeLabel(p))}</span><em>${esc(p.kind || '')}</em></a>${h ? `<a class="pl-h" href="${esc(h.entry)}" title="${esc(h.name)}：3D 今昔場景">今昔</a>` : ''}</li>`;
      }).join('')}</ul></details>`).join('') : '<p class="pl-empty">沒有符合的地點</p>';
  }
  function toggle(force) {
    const open = force ?? !document.body.classList.contains('pl-open');
    document.body.classList.toggle('pl-open', open);
    document.getElementById('plOpen')?.setAttribute('aria-expanded', String(open));
    try { localStorage.setItem(DRAWER_KEY, open ? '1' : '0'); } catch { }
    if (open) { if (!list.firstChild) render(); list.querySelector('.here')?.scrollIntoView({ block: 'center' }); }
  }
  function random() { const p = randomPlace(places, curPlace?.id); if (p) location.assign(placeHref(p)); }
  input.oninput = render;
  input.onkeydown = e => { if (e.key === 'Enter') { const a = list.querySelector('.pl-item'); if (a) location.assign(a.href); } if (e.key === 'Escape') toggle(false); };
  el.querySelector('#plClose').onclick = () => toggle(false);
  el.querySelector('#plRand').onclick = random;
  let stored = null; try { stored = localStorage.getItem(DRAWER_KEY); } catch { }
  // 第一次來到 101 清單的地點、且螢幕夠寬時預設展開
  if (stored === '1' || (stored === null && curPlace && innerWidth >= 1100)) toggle(true);
  return { toggle, random, render };
}
