// 短片輸出：把場景錄成 9:16（短影音）、4:5、1:1 或 16:9 的影片，自動蓋上資料出處。
// 參考 papercraft 的 capture.py（固定格式尺寸、鏡頭時間軸），改成在瀏覽器裡直接錄：
//   1. 畫布暫時改成目標比例、提高像素比，讓畫面以接近 1080×1920 的解析度渲染
//   2. 每次後製組合器畫完一幀，就複製到輸出畫布並蓋出處
//   3. 輸出畫布 captureStream → MediaRecorder（支援 MP4 的瀏覽器錄 MP4，否則 WebM）
// 運鏡：緩緩環繞、推近、升空拉遠、定鏡；可加「紙雕彈起開場」與「縮時」。
import { stampCredits, creditsOf } from './credits.js';

export const CLIP_SIZES = { '9:16': [1080, 1920], '4:5': [1080, 1350], '1:1': [1080, 1080], '16:9': [1920, 1080] };
export const CLIP_MOVES = { orbit: '緩緩環繞', push: '推近', rise: '升空拉遠', still: '定鏡' };
const ease = t => t * t * (3 - 2 * t);
export function pickMime(isOk = t => globalThis.MediaRecorder?.isTypeSupported?.(t)) {
  for (const t of ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']) if (isOk(t)) return t;
  return '';
}
export const canRecord = api => !!(api?.post?.composer && api.renderer && api.camera && globalThis.MediaRecorder && HTMLCanvasElement.prototype.captureStream && pickMime());

/** 鏡頭在時間 t（0–1）的位置：回傳相對注視點的 [方位角增量, 距離倍率, 俯角增量(弧度)] */
export function movePose(move, t) {
  const e = ease(Math.min(1, Math.max(0, t)));
  if (move === 'orbit') return [e * 0.7, 1, 0];
  if (move === 'push') return [e * 0.12, 1 - 0.38 * e, -0.08 * e];
  if (move === 'rise') return [e * 0.25, 0.75 + 0.85 * e, 0.22 * e];
  return [0, 1, 0];
}

/**
 * 開始錄影。opts：{ aspect, seconds, move, pop, lapse, name }；回傳 { stop(), done: Promise<{ blob, name, mime }> }
 */
export function recordClip(api, opts, status = () => { }) {
  const { aspect = '9:16', seconds = 10, move = 'orbit', pop = false, lapse = false, name = 'twtimes' } = opts;
  const [W, H] = CLIP_SIZES[aspect] || CLIP_SIZES['9:16'];
  const canvas = api.renderer.domElement, parent = canvas.parentElement, comp = api.post.composer, cam = api.camera, ctl = api.controls;
  const saved = { css: canvas.style.cssText, pr: api.renderer.getPixelRatio(), render: comp.render, spin: ctl?.autoRotate };
  // 1. 畫布改成目標比例，置中
  const pw = parent.clientWidth, ph = parent.clientHeight, r = W / H;
  const bw = pw / ph > r ? ph * r : pw, bh = bw / r;
  Object.assign(canvas.style, { position: 'absolute', left: (pw - bw) / 2 + 'px', top: (ph - bh) / 2 + 'px', width: bw + 'px', height: bh + 'px' });
  api.renderer.setPixelRatio(Math.min(3, Math.max(1, H / bh)));
  document.body.classList.add('clip-recording');
  dispatchEvent(new Event('resize'));
  // 2. 輸出畫布
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const g = out.getContext('2d'), credits = creditsOf(api);
  let recording = false;
  comp.render = function (...a) {
    saved.render.apply(this, a);
    if (recording) { g.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, W, H); stampCredits(out, credits); }
  };
  // 3. 錄影
  const mime = pickMime(), stream = out.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12e6 }), chunks = [];
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  // 運鏡起點
  const walk = !!api.state?.walk, tg = ctl?.target?.clone(), off = tg ? cam.position.clone().sub(tg) : null;
  const R0 = off?.length() || 1, az0 = off ? Math.atan2(off.x, off.z) : 0, el0 = off ? Math.asin(Math.min(1, Math.max(-1, off.y / R0))) : 0;
  const h0 = +api.state?.hour || 12;
  if (ctl) ctl.autoRotate = false;
  let raf = 0, t0 = 0, stopped = false, resolve;
  const done = new Promise(res => { resolve = res; });
  function step(now) {
    if (stopped) return;
    const t = (now - t0) / 1000 / seconds;
    if (!walk && off && move !== 'still') {
      const [da, k, de] = movePose(move, t), el = Math.min(1.45, Math.max(0.03, el0 + de)), R = R0 * k;
      cam.position.set(tg.x + Math.sin(az0 + da) * Math.cos(el) * R, tg.y + Math.sin(el) * R, tg.z + Math.cos(az0 + da) * Math.cos(el) * R);
      ctl.target.copy(tg); ctl.update?.();
    }
    if (lapse && api.setHour) api.setHour((h0 + t * 3) % 24);
    status(`錄影中 ${Math.min(seconds, (now - t0) / 1000).toFixed(1)} / ${seconds} 秒（${aspect}）`);
    if (t >= 1) return finish();
    raf = requestAnimationFrame(step);
  }
  function restore() {
    cancelAnimationFrame(raf); recording = false; comp.render = saved.render;
    canvas.style.cssText = saved.css; api.renderer.setPixelRatio(saved.pr); document.body.classList.remove('clip-recording');
    if (ctl) ctl.autoRotate = saved.spin; dispatchEvent(new Event('resize'));
  }
  function finish() {
    if (stopped) return; stopped = true;
    rec.onstop = () => {
      restore();
      const ext = mime.includes('mp4') ? 'mp4' : 'webm', blob = new Blob(chunks, { type: mime.split(';')[0] });
      resolve({ blob, mime, name: `${name}-${aspect.replace(':', 'x')}.${ext}` });
    };
    rec.state !== 'inactive' ? rec.stop() : rec.onstop();
  }
  // 等畫布換好尺寸（兩幀）再開始
  requestAnimationFrame(() => requestAnimationFrame(now => {
    if (stopped) return;
    if (pop) api.replayPop?.();
    recording = true; rec.start(500); t0 = now; raf = requestAnimationFrame(step);
  }));
  return { stop: finish, done };
}
