// 時間軸：取代一排年代按鈕。所有場景共用（掛在 scene-panel.js 的年代列位置）。
//
// ‧ 拖曳把手：年代之間連續過渡（場景 API 有 scrub(a, b, k) 時，建物跟著手指一點一點長出／沉下）；放開後滑到最近的年代。
// ‧ 點年代刻度：播放轉場到該年代；按住 ▶：依序走過每個年代（每站停留後自動往下）。
// ‧ 鍵盤：焦點在時間軸上時 ← → 換年代、Home／End 跳到最早／最近；滾輪在時間軸上也能換。
// ‧ 沒有 scrub 的場景（臺北五代站房等）：拖曳時越過中點就切換，放開對齊。
//
// 場景 API（docs/scene-contract.md）：eras、state.era、setEra(i)；選配 scrub(a, b, k)、endScrub(target)
import { TRANSITION } from './era-grow.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, k => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[k]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

export function mountTimeline(host) {
  host.classList.add('tl'); host.replaceChildren();
  host.innerHTML = `<button class="tl-play" type="button" aria-label="依序播放每個年代" title="依序播放每個年代（空白鍵）">▶</button>
<div class="tl-track" role="slider" tabindex="0" aria-label="年代時間軸：拖曳在年代之間連續過渡" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0">
  <div class="tl-rail"><i class="tl-fill"></i></div><div class="tl-stops"></div><div class="tl-thumb" aria-hidden="true"><b></b></div>
</div>`;
  const play = host.querySelector('.tl-play'), track = host.querySelector('.tl-track'), stops = host.querySelector('.tl-stops');
  const thumb = host.querySelector('.tl-thumb'), fill = host.querySelector('.tl-fill'), thumbLabel = thumb.querySelector('b');
  let api = null, n = 1, pos = 0, era = 0, drag = null, glide = null, tour = null, wheelT = 0, discreteAt = -1;

  const xOf = p => n > 1 ? p / (n - 1) : 0.5;            // 0–1
  function paint() {
    const f = xOf(pos);
    thumb.style.left = fill.style.width = (f * 100) + '%';
    const near = clamp(Math.round(pos), 0, n - 1);
    [...stops.children].forEach((s, i) => { s.classList.toggle('on', i === near); s.classList.toggle('past', i < pos - 0.001); });
    const e = api?.eras[near];
    if (e) { thumbLabel.textContent = e.year; track.setAttribute('aria-valuenow', String(near)); track.setAttribute('aria-valuetext', `${e.year} ${e.name}`); }
  }
  // 把手平滑滑到目標（跟引擎轉場同步的時間）
  function glideTo(target, seconds) {
    cancelAnimationFrame(glide?.raf || 0);
    const from = pos, dur = Math.max(0.001, seconds) * 1000, t0 = performance.now();
    if (reduced() || seconds <= 0.01) { pos = target; paint(); glide = null; return; }
    glide = { target };
    const step = now => {
      const k = clamp((now - t0) / dur, 0, 1), e = k * k * (3 - 2 * k);
      pos = from + (target - from) * e; paint();
      if (k < 1) glide.raf = requestAnimationFrame(step); else glide = null;
    };
    glide.raf = requestAnimationFrame(step);
  }
  const tSec = () => TRANSITION.mode === 'cut' ? 0 : TRANSITION.seconds;
  const canScrub = () => !!api?.scrub && TRANSITION.mode !== 'cut';

  function go(i, { fromTour = false } = {}) {
    if (!api) return;
    if (!fromTour) stopTour();
    i = clamp(i, 0, n - 1);
    if (i === era && Math.abs(pos - i) < 0.001) return;
    const jump = Math.abs(i - pos);
    api.setEra(i);
    glideTo(i, tSec() * Math.min(1, jump));
  }

  // ── 拖曳 ──
  const posAt = clientX => { const r = stops.getBoundingClientRect(); return clamp((clientX - r.left) / Math.max(1, r.width), 0, 1) * (n - 1); };
  track.addEventListener('pointerdown', e => {
    if (!api || n < 2 || e.button > 0) return;
    stopTour(); cancelAnimationFrame(glide?.raf || 0); glide = null;
    track.setPointerCapture(e.pointerId);
    const onThumb = e.target.closest('.tl-thumb');
    drag = { id: e.pointerId, x: e.clientX, moved: false, start: pos, grabOffset: onThumb ? pos - posAt(e.clientX) : 0, stop: e.target.closest('.tl-stop') };
    host.classList.add('dragging');
  });
  track.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && Math.abs(e.clientX - drag.x) < 5) return;
    drag.moved = true;
    pos = clamp(posAt(e.clientX) + drag.grabOffset, 0, n - 1); paint();
    if (canScrub()) {
      // 在 a、a+1 兩個年代之間的進度 k（一律由早到晚；往回拖就是 k 變小）
      let a = Math.floor(pos), k = pos - a; if (a >= n - 1) { a = n - 2; k = 1; }
      api.scrub(a, a + 1, k);
      drag.scrubbing = true;
    } else {
      const near = Math.round(pos);
      if (near !== discreteAt && near !== era) { discreteAt = near; api.setEra(near); }
    }
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null; host.classList.remove('dragging'); discreteAt = -1;
    if (!d.moved) {
      // 點一下：點到刻度就去那個年代，點到軌道空白就去最近的年代
      const i = d.stop ? +d.stop.dataset.i : Math.round(posAt(e.clientX));
      go(i); return;
    }
    const target = clamp(Math.round(pos), 0, n - 1);
    if (d.scrubbing && api.endScrub) {
      const rest = Math.abs(target - pos);
      api.endScrub(target);
      glideTo(target, tSec() * rest);
    } else { if (target !== era) api.setEra(target); glideTo(target, 0.18); }
  };
  track.addEventListener('pointerup', end); track.addEventListener('pointercancel', end);

  // ── 鍵盤、滾輪 ──
  track.addEventListener('keydown', e => {
    const k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowUp') go(Math.round(pos) + 1);
    else if (k === 'ArrowLeft' || k === 'ArrowDown') go(Math.round(pos) - 1);
    else if (k === 'Home') go(0);
    else if (k === 'End') go(n - 1);
    else if (k === ' ' || k === 'Enter') toggleTour();
    else return;
    e.preventDefault(); e.stopPropagation();
  });
  track.addEventListener('wheel', e => {
    if (!api || n < 2) return;
    e.preventDefault();
    const now = performance.now(); if (now - wheelT < 420) return; wheelT = now;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    go(Math.round(glide ? glide.target : pos) + Math.sign(d));
  }, { passive: false });

  // ── 依序播放 ──
  function stopTour() { if (!tour) return; clearTimeout(tour.t); tour = null; play.textContent = '▶'; play.setAttribute('aria-pressed', 'false'); host.classList.remove('touring'); }
  function toggleTour() {
    if (tour) { stopTour(); return; }
    if (!api || n < 2) return;
    tour = {}; play.textContent = '❚❚'; play.setAttribute('aria-pressed', 'true'); host.classList.add('touring');
    const next = () => {
      if (!tour) return;
      const i = era >= n - 1 ? 0 : era + 1;
      go(i, { fromTour: true });
      if (i >= n - 1) { tour.t = setTimeout(stopTour, tSec() * 1000 + 200); return; }
      tour.t = setTimeout(next, (tSec() + 2.6) * 1000);
    };
    // 已在最後一站：先回到第一站再開始
    if (era >= n - 1) { go(0, { fromTour: true }); tour.t = setTimeout(next, (tSec() + 1.6) * 1000); } else next();
  }
  play.onclick = toggleTour;

  return {
    bind(a) {
      api = a; n = a.eras.length; era = clamp(a.state?.era ?? 0, 0, n - 1); pos = era; stopTour();
      host.hidden = false; host.classList.toggle('tl-single', n < 2); play.hidden = n < 2;
      track.setAttribute('aria-valuemax', String(n - 1));
      stops.replaceChildren(...a.eras.map((e, i) => {
        const s = document.createElement('span'); s.className = 'tl-stop'; s.dataset.i = i; s.style.left = (xOf(i) * 100) + '%';
        s.title = `${e.year} ${e.name}`;
        s.innerHTML = `<i></i><b>${esc(e.year)}</b><em>${esc(e.name)}</em>`;
        return s;
      }));
      paint();
    },
    // 引擎回報年代改變（按鍵、網址、轉場結束）
    setEra(i) {
      era = i;
      if (drag || glide) return;
      if (Math.abs(pos - i) > 0.001) glideTo(i, tSec() * Math.min(1, Math.abs(pos - i)));
      else paint();
    },
    stopTour, toggleTour,
    get touring() { return !!tour; },
  };
}
