// 畫面風格、出處標示、短片、紙雕彈起、どこでもロケハン連結的純函式測試
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lutData, lutForYear, LUTS, lookFromQuery, lookToQuery, LOOK_DEFAULT } from '../src/shared/look.js';
import { stampGLB, rokehanURL, creditLine, OSM_CREDIT, OMT_CREDIT } from '../src/shared/credits.js';
import { movePose, pickMime, CLIP_SIZES } from '../src/shared/clip.js';
import { popSpring, popStart } from '../src/world/pop.js';

const ok = (name, fn) => { fn(); console.log('ok', name); };

ok('原色調色表為恆等', () => {
  const N = 8, d = lutData('none', N);
  for (const [r, g, b] of [[0, 0, 0], [7, 7, 7], [3, 5, 1], [7, 0, 2]]) {
    const i = (b * N * N + g * N + r) * 4;
    assert.deepEqual([d[i], d[i + 1], d[i + 2]], [r, g, b].map(v => Math.round(v / 7 * 255)));
  }
});
ok('年代調色表：數值在範圍內、白點不爆、褐調偏暖', () => {
  for (const k of Object.keys(LUTS)) { const d = lutData(k, 9); assert.equal(d.length, 9 ** 3 * 4); }
  const N = 9, d = lutData('showa', N), mid = (4 * N * N + 4 * N + 4) * 4;
  assert.ok(d[mid] > d[mid + 2] + 15, '日治銀鹽灰階中間調 R > B');
  const white = (8 * N * N + 8 * N + 8) * 4; assert.ok(d[white] > 200 && d[white] <= 255);
});
ok('依年代自動選調色表', () => {
  assert.equal(lutForYear('1644'), 'qing'); assert.equal(lutForYear('1895'), 'qing'); assert.equal(lutForYear('1936'), 'showa');
  assert.equal(lutForYear('1970 年代'), 'fade60'); assert.equal(lutForYear(1985), 'film85'); assert.equal(lutForYear('現況'), 'now'); assert.equal(lutForYear('2026'), 'now');
});
ok('畫面風格 ↔ 網址參數', () => {
  const L = { ...LOOK_DEFAULT, draw: 'lineTone', tilt: 0.6, lut: 'auto', soft: 0.5 };
  const u = lookToQuery(L, new URL('https://x.test/?place=tw&tilt=0.1'));
  assert.equal(u.searchParams.get('draw'), 'lineTone'); assert.equal(u.searchParams.get('tilt'), '0.6'); assert.equal(u.searchParams.has('lw'), false);
  assert.deepEqual(lookFromQuery(u.searchParams), L);
  assert.equal(lookFromQuery(new URLSearchParams('draw=bogus&tilt=9')).draw, 'color');
  assert.equal(lookFromQuery(new URLSearchParams('tilt=9')).tilt, 1);
});
ok('GLB 寫入 asset.copyright，其餘不變', () => {
  const json = new TextEncoder().encode(JSON.stringify({ asset: { version: '2.0', generator: 'x' }, buffers: [{ byteLength: 4 }] }) + '  ');
  const jl = Math.ceil(json.length / 4) * 4, bin = new Uint8Array([1, 2, 3, 4]), total = 12 + 8 + jl + 8 + 4;
  const b = new Uint8Array(total), v = new DataView(b.buffer);
  v.setUint32(0, 0x46546c67, true); v.setUint32(4, 2, true); v.setUint32(8, total, true); v.setUint32(12, jl, true); v.setUint32(16, 0x4e4f534a, true);
  b.fill(0x20, 20, 20 + jl); b.set(json, 20); v.setUint32(20 + jl, 4, true); v.setUint32(24 + jl, 0x004e4942, true); b.set(bin, 28 + jl);
  const out = stampGLB(b.buffer, creditLine([OSM_CREDIT, OMT_CREDIT])), o = new DataView(out);
  assert.equal(o.getUint32(8, true), out.byteLength); const ol = o.getUint32(12, true); assert.equal(ol % 4, 0);
  const j = JSON.parse(new TextDecoder().decode(new Uint8Array(out, 20, ol)));
  assert.match(j.asset.copyright, /OpenStreetMap contributors.*OpenMapTiles/); assert.equal(j.asset.generator, 'x');
  assert.equal(o.getUint32(24 + ol, true), 0x004e4942); assert.deepEqual([...new Uint8Array(out, 28 + ol, 4)], [1, 2, 3, 4]);
});
ok('どこでもロケハン連結：座標、範圍、時段、名稱', () => {
  const u = rokehanURL({ lat: 23.0016, lng: 120.1606, name: '臺南·安平古堡', hour: 17.5, size: 280 });
  assert.ok(u.startsWith('https://tools.oyasumi-gamedev.com/rokehan/#ll=23.001600%2C120.160600&s=300&tod=dusk&n='));
  assert.equal(decodeURIComponent(u.split('n=')[1]), '臺南·安平古堡');
  assert.ok(!rokehanURL({ lat: 25, lng: 121.5, hour: 12 }).includes('tod='));
  assert.ok(rokehanURL({ lat: 25, lng: 121.5, hour: 21 }).includes('tod=night'));
  assert.ok(rokehanURL({ lat: 25, lng: 121.5, hour: 2 }).includes('tod=late'));
  assert.ok(rokehanURL({ lat: 25, lng: 121.5, size: 2000 }).includes('s=1000'));
});
ok('短片：尺寸、運鏡起訖、格式選擇', () => {
  assert.deepEqual(CLIP_SIZES['9:16'], [1080, 1920]);
  for (const m of ['orbit', 'push', 'rise', 'still']) assert.deepEqual(movePose(m, 0).map(v => v + 0), [0, m === 'push' ? 1 : m === 'rise' ? 0.75 : 1, 0]);
  assert.ok(movePose('push', 1)[1] < 0.7); assert.ok(movePose('rise', 1)[1] > 1.5);
  assert.equal(pickMime(t => t.startsWith('video/webm')), 'video/webm;codecs=vp9');
  assert.equal(pickMime(t => t === 'video/mp4'), 'video/mp4');
  assert.equal(pickMime(() => false), '');
});
ok('紙雕彈起：彈簧 0→1、過衝不超過 8%、近的先彈', () => {
  assert.equal(popSpring(0), 0); assert.equal(popSpring(1), 1);
  let mx = 0; for (let t = 0; t <= 1; t += 0.01) mx = Math.max(mx, popSpring(t)); assert.ok(mx > 1.01 && mx < 1.08, mx);
  assert.ok(popStart(10, 0, 0, 0, 0, 0, 0) < popStart(10, 0, 0, 1500, 0, 0, 0));
  assert.ok(popStart(10, 0, 0, 9e6, 0, 0, 0) <= 10 + 0.05 + 1.6 + 0.22);
});
ok('著色器字串與 GLSL 版本一致', () => {
  const src = readFileSync(new URL('../src/world/pop.js', import.meta.url), 'utf8');
  assert.ok(src.includes('exp(-6.5 * t) * cos(t * 6.9115) * (1. - t)') && src.includes('Math.exp(-6.5 * t) * Math.cos(t * 6.9115) * (1 - t)'));
});
console.log('look-tools: ok');
