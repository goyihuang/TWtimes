// 共用場景介面：所有 3D 場景（臺中、彰化、臺北、高雄、臺南、圓山）都用這一組控制項。
// 以臺南為標準：年代列、鏡位、焦距、天氣、時刻、漫步、今昔並排、拍照、分享、純畫面、重建依據與可信度。
//
// 用法：
//   const panel = mountScenePanel({ title, en, story? });
//   const api = await createXxx(canvas, panel.ui);   // 引擎在狀態改變時呼叫 panel.ui.onEra / onShot / onWalk
//   panel.bind(api);
//
// 場景 API（引擎回傳的物件，見 docs/scene-contract.md）：
//   eras: [{ id, year, name, en?, story, evidence: [[項目, 'A'|'B'|'C', 依據], …] }]
//   shots: [{ name }]
//   state: { era, shot, mm?, weather?, hour?, walk? }
//   setEra(i) setShot(i) snapshot() → canvas  compare() → { canvas, title }  shareURL() → string
//   選配：setFocal(mm) setWeather(key) weathers { key: 名稱 } setHour(h) toggleWalk() zoom(f) toggles [{ id, label, title?, on, set(on) }]
//         extraLinks [{ label, href }]
import './scene-panel.css';

const el = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, k => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[k]));
export const fmtHour = h => String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.round((h % 1) * 60) % 60).padStart(2, '0');
export const CONFIDENCE = { A: '照片或官方文字直接佐證', B: '依照片比例推估', C: '示意' };

export function mountScenePanel({ title, en, story = '', host = el('scenePanel') || el('places'), eraHost } = {}) {
  document.body.classList.add('scene-panel-ready');
  host.classList.add('sp');
  host.innerHTML = `<p id="story" class="sp-story">${esc(story)}</p>
<label class="sp-row" data-need="shots">鏡位<select id="shot"></select></label>
<label class="sp-row" data-need="setFocal">焦距 <output id="mmOut">35 mm</output><input id="mm" type="range" min="16" max="105" step="1" value="35"></label>
<label class="sp-row" data-need="setWeather">天氣<select id="weather"></select></label>
<label class="sp-row" data-need="setHour">時刻 <output id="clock"></output><input id="hour" type="range" min="0" max="23.75" step=".25" value="15.5"></label>
<div class="sp-actions"><button id="tnWalk" data-need="toggleWalk" aria-pressed="false">漫步</button><button id="compare" data-need="compare">今昔並排</button><button id="share" data-need="shareURL">複製場景網址</button><button id="cleanView" aria-pressed="false" title="隱藏畫面上的按鈕與標題（H）">純畫面</button></div>
<div class="sp-params" id="spParams" hidden></div>
<div class="sp-toggles" id="spToggles" hidden></div>
<div class="sp-links" id="spLinks" hidden></div>
<details id="evidence" class="sp-evidence"><summary>重建依據與可信度</summary><table id="evTable"></table><p class="sp-note">A：${CONFIDENCE.A}　B：${CONFIDENCE.B}　C：${CONFIDENCE.C}</p></details>
<p id="status" class="sp-status" role="status">載入中…</p>`;

  // 年代列：沿用首頁「時空切換」的位置
  // 舊的「昔／今」兩鍵留在頁面上（app.js 仍會更新它們）但隱藏，旁邊放新的年代列
  let bar = eraHost || document.querySelector('.time-switch');
  if (bar.querySelector('#old')) { const nb = bar.cloneNode(false); bar.after(nb); bar.hidden = true; bar = nb; }
  bar.id = 'eras'; bar.classList.add('sp-eras'); bar.replaceChildren();

  // 走路提示
  const stage = el('stage');
  if (stage && !el('walkHint')) stage.insertAdjacentHTML('beforeend', '<div id="walkHint" hidden></div>');

  let api = null;
  const status = t => { el('status').textContent = t; };
  const renderEvidence = e => {
    el('evTable').innerHTML = (e.evidence || []).map(([k, c, s]) => `<tr><td>${esc(k)}</td><td class="c-${esc(c)}">${esc(c)}</td><td>${esc(s)}</td></tr>`).join('') || '<tr><td colspan="3">尚未整理</td></tr>';
  };
  const ui = {
    status,
    onEra(i) {
      if (!api) { ui._pendingEra = i; return; }
      const e = api.eras[i]; if (!e) return;
      [...bar.children].forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
      const set = (id, v) => { const n = el(id); if (n && v != null) n.textContent = v; };
      if (!api.keepCaption) { set('viewYear', e.year); set('viewName', e.name); set('viewEnglish', e.en || en); set('modelInfo', e.story); }
      set('story', e.story);
      renderEvidence(e);
    },
    onShot(i) {
      if (!api) return;
      el('shot').value = String(i);
      if (api.setFocal && api.state.mm) { el('mm').value = api.state.mm; el('mmOut').textContent = api.state.mm + ' mm'; }
    },
    onHour(h) { const n = el('hour'); if (n && document.activeElement !== n) n.value = h; const c = el('clock'); if (c) c.textContent = fmtHour(h); },
    onWeather(w) { const n = el('weather'); if (n) n.value = w; },
    onToggle() { (api?.toggles || []).forEach(t => t.button?.setAttribute('aria-pressed', String(!!t.on()))); },
    onWalk(on) { el('tnWalk').setAttribute('aria-pressed', String(on)); el('orbitBtn')?.classList.toggle('on', !on); el('walkBtn')?.classList.toggle('on', !!on); const h = el('walkHint'); if (h) { h.hidden = !on || !api?.walkHint; if (api?.walkHint) h.textContent = api.walkHint; } },
  };

  function bind(a) {
    api = a;
    // 依能力隱藏控制項：不支援的功能不放假按鈕
    host.querySelectorAll('[data-need]').forEach(n => { const k = n.dataset.need; n.hidden = !(k === 'shots' ? a.shots?.length : a[k]); });
    bar.replaceChildren(...a.eras.map((e, i) => {
      const b = document.createElement('button'); b.setAttribute('aria-pressed', 'false');
      b.innerHTML = `<b>${esc(e.year)}</b> <span>${esc(e.name)}</span>`; b.onclick = () => a.setEra(i); return b;
    }));
    el('shot').replaceChildren(...(a.shots || []).map((s, i) => new Option(s.name, i)));
    el('shot').value = String(a.state.shot ?? 0);
    el('shot').onchange = () => a.setShot(+el('shot').value);
    if (a.setFocal) {
      el('mm').value = a.state.mm ?? 35; el('mmOut').textContent = (a.state.mm ?? 35) + ' mm';
      el('mm').oninput = () => { a.setFocal(+el('mm').value); el('mmOut').textContent = el('mm').value + ' mm'; };
    }
    if (a.setWeather) {
      el('weather').replaceChildren(...Object.entries(a.weathers || { clear: '晴天', cloudy: '多雲', rain: '雨天', fog: '晨霧' }).map(([k, v]) => new Option(v, k)));
      el('weather').value = a.state.weather; el('weather').onchange = () => a.setWeather(el('weather').value);
    }
    if (a.setHour) {
      el('hour').value = a.state.hour; el('clock').textContent = fmtHour(a.state.hour);
      el('hour').oninput = () => { a.setHour(+el('hour').value); el('clock').textContent = fmtHour(+el('hour').value); };
    }
    el('tnWalk').onclick = () => a.toggleWalk();
    // 畫面右下的「環繞／步行」與面板的「漫步」同步
    const modes = document.querySelector('.view-modes');
    if (modes) modes.hidden = !a.toggleWalk;
    if (a.toggleWalk) { el('orbitBtn').onclick = () => { if (a.state.walk) a.toggleWalk(); }; el('walkBtn').onclick = () => { if (!a.state.walk) a.toggleWalk(); }; }
    el('compare').onclick = () => { const { canvas, title: t } = a.compare(); window.saveScenePhoto(canvas, t); status('今昔並排已存入「我的攝影」'); };
    el('share').onclick = async () => {
      const u = a.shareURL(); history.replaceState(null, '', u);
      try { await navigator.clipboard.writeText(u); status('已複製場景網址（含年代、鏡位與鏡頭位置）'); } catch { status(u); }
    };
    el('cleanView').onclick = toggleClean;
    const tg = el('spToggles'); tg.hidden = !a.toggles?.length;
    tg.replaceChildren(...(a.toggles || []).map(t => {
      const b = document.createElement('button'); b.textContent = t.label; if (t.title) b.title = t.title; b.setAttribute('aria-pressed', String(!!t.on()));
      b.onclick = () => { t.set(!t.on()); b.setAttribute('aria-pressed', String(!!t.on())); }; t.button = b; return b;
    }));
    // 片場參數（選配）：params [{ id, label, min, max, step, unit, get(), set(v) }]、actions [{ label, title?, run() }]
    const pr = el('spParams'); pr.hidden = !a.params?.length;
    pr.replaceChildren(...(a.params || []).map(p => {
      const row = document.createElement('label'); row.className = 'sp-row';
      const fmt = v => (p.unit === '×' ? (+v).toFixed(2) : v) + (p.unit || '');
      row.innerHTML = `${esc(p.label)} <output>${esc(fmt(p.get()))}</output><input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.get()}" data-param="${esc(p.id)}">`;
      const inp = row.querySelector('input'), out = row.querySelector('output');
      inp.oninput = () => { p.set(+inp.value); out.textContent = fmt(inp.value); };
      return row;
    }));
    for (const act of a.actions || []) {
      const b = document.createElement('button'); b.textContent = act.label; if (act.title) b.title = act.title; b.className = 'sp-action';
      b.onclick = () => act.run(); el('spToggles').append(b); el('spToggles').hidden = false;
    }
    const links = el('spLinks'); links.hidden = !a.extraLinks?.length;
    links.innerHTML = (a.extraLinks || []).map(l => `<a href="${esc(l.href)}">${esc(l.label)}　↗</a>`).join('');
    // 共用框架按鈕（首頁原有場景保留自己的快門與縮放）
    const on = (id, fn) => { const n = el(id); if (n && a.frameButtons !== false) n.onclick = fn; };
    on('resetView', () => a.setShot(+el('shot').value));
    if (a.zoom) { on('plus', () => a.zoom(0.82)); on('minus', () => a.zoom(1.22)); }
    on('shutter', () => { const c = a.snapshot(); window.saveScenePhoto(c, (el('viewYear')?.textContent || '') + ' · ' + (el('viewName')?.textContent || title)); });
    on('full', () => document.fullscreenElement ? document.exitFullscreen() : el('viewer').requestFullscreen());
    ui.onEra(ui._pendingEra ?? a.state.era); ui.onShot(a.state.shot ?? 0); ui.onWalk(!!a.state.walk);
    const loading = el('loading'); if (loading) loading.hidden = true;
    if (el('status').textContent === '載入中…') status('');
  }
  function sync() { if (!api) return; ui.onEra(api.state.era); ui.onShot(api.state.shot ?? 0); ui.onWalk(!!api.state.walk); (api.toggles || []).forEach(t => t.button?.setAttribute('aria-pressed', String(!!t.on()))); }
  function toggleClean() { const c = document.body.classList.toggle('clean-view'); el('cleanView').setAttribute('aria-pressed', String(c)); }
  addEventListener('keydown', e => { if ((e.key === 'h' || e.key === 'H') && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && !api?.state.walk) toggleClean(); });

  return { ui, bind, sync, status, setStory(t) { el('story').textContent = t; } };
}

// 「我的攝影」：首頁框架提供 saveTainanPhoto；沒有框架時直接下載
window.saveScenePhoto = (canvas, title) => {
  if (window.saveTainanPhoto) return window.saveTainanPhoto(canvas, title);
  const a = document.createElement('a'); a.download = (title || '今昔街影') + '.jpg'; a.href = canvas.toDataURL('image/jpeg', 0.9); a.click();
};

// 失敗時的統一訊息
export function showLoadError(name, err) {
  console.error(err);
  const l = el('loading'); if (l) { l.hidden = false; l.textContent = `${name}載入失敗：${err?.message || err}。請確認瀏覽器已開啟硬體加速後重新整理。`; }
}
