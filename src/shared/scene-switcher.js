// 景點切換選單：3D 街景頁上方的景點列＋全螢幕景點目錄。資料全部來自 scene-registry.json。
// - 景點列：目前景點、上一個／下一個（北到南）、已上線景點捷徑、搜尋、全臺地圖
// - 景點目錄（Ctrl/⌘＋K 或 /）：搜尋（與地圖共用 search.js）、地區／年代／類型／呈現方式篩選、
//   臺灣小地圖、最近看過；已上線景點進 3D 今昔，其餘有座標的景點直接開 OSM 現代街景
import './scene-switcher.css';
import { indexScene, runQuery } from '../atlas/search.js';
import { REGIONS, regionOf, modeOf, MODE_LABEL, sceneHref, currentScene, geoOrder, project, MINI } from './registry.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const RECENT_KEY = 'twtimes.recent.v1';
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
  const scenes = reg.scenes, ordered = geoOrder(scenes.filter(s => modeOf(s) !== 'card'));
  const entries = scenes.map(scene => ({ scene, fields: indexScene(scene) }));
  const cur = currentScene(scenes, location.search);
  const q = new URLSearchParams(location.search);
  // OSM 現代街景也能用任意座標開啟（地圖上點選空白處）
  const adhoc = !cur && q.get('place') === 'osm' ? { id: null, name: q.get('name') || '自選地點', city: '', lat: +q.get('lat'), lng: +q.get('lng') } : null;

  // 最近看過
  if (cur) { const r = [cur.id, ...readRecent().filter(id => id !== cur.id)].slice(0, 8); try { localStorage.setItem(RECENT_KEY, JSON.stringify(r)); } catch { } }

  // ── 景點列 ──
  const bar = document.createElement('nav');
  bar.className = 'ss-bar'; bar.id = 'sceneSwitcher'; bar.setAttribute('aria-label', '切換景點');
  const me = cur || adhoc;
  const idx = cur ? ordered.findIndex(s => s.id === cur.id) : -1;
  const near = (d) => ordered.length ? ordered[(idx + d + ordered.length) % ordered.length] : null;
  const live = ordered.filter(s => modeOf(s) === 'history3d');
  bar.innerHTML = `
    <button class="ss-current" id="ssOpen" aria-haspopup="dialog" title="開啟景點目錄（Ctrl＋K）">
      <span class="ss-thumb">${me?.thumbnail ? `<img src="${esc(me.thumbnail)}" alt="">` : `<i>${esc((me?.name || '景').slice(0, 1))}</i>`}</span>
      <span class="ss-name"><small>${esc(me ? [me.city, me.district].filter(Boolean).join('・') || '自選座標' : '選擇景點')}${me ? `・${esc(MODE_LABEL[modeOf(me)] || '現代街景')}` : ''}</small><strong>${esc(me?.name || '景點目錄')}</strong></span>
      <span class="ss-caret" aria-hidden="true">▾</span>
    </button>
    <div class="ss-steps">
      <a class="ss-step" id="ssPrev" href="${esc(near(-1) ? sceneHref(near(-1)) : '#')}" title="往北：${esc(near(-1)?.name || '')}" aria-label="上一個景點">‹</a>
      <a class="ss-step" id="ssNext" href="${esc(near(1) ? sceneHref(near(1)) : '#')}" title="往南：${esc(near(1)?.name || '')}" aria-label="下一個景點">›</a>
    </div>
    <div class="ss-strip" role="list" aria-label="已上線的 3D 今昔景點">${live.map(s => `<a role="listitem" class="ss-chip ${s.id === cur?.id ? 'on' : ''}" href="${esc(sceneHref(s))}" ${s.id === cur?.id ? 'aria-current="page"' : ''}><img src="${esc(s.thumbnail)}" alt="" loading="lazy"><span>${esc(shortName(s))}</span></a>`).join('')}</div>
    <button class="ss-search" id="ssSearch" title="搜尋全部景點（Ctrl＋K）">⌕ <span>全部 ${scenes.length} 處</span></button>
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
    <p class="ss-foot">現代街景依 OpenStreetMap 即時生成，作為逐步加入歷史年代的底稿。<a href="./map.html">在全臺地圖上看全部 ↗</a></p>`;
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
  window.__switcher = { open, close: () => dlg.close(), scenes, current: cur };
  return { open, current: cur, registry: reg };
}

const shortName = s => s.name.replace(/[・·].*$/, '').replace(/\s.*$/, '');
