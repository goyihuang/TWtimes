import fs from 'fs';
import { indexScene, runQuery, normalize } from '../src/atlas/search.js';
const reg = JSON.parse(fs.readFileSync(new URL('../public/data/scene-registry.json', import.meta.url)));
const entries = reg.scenes.map(scene => ({ scene, fields: indexScene(scene) }));
const q = (s, f = {}) => runQuery(entries, s, f).map(e => e.scene.id).slice(0, 4).join(',');
const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1 } else console.log('ok', m) };
assert(normalize('臺中 車站') === '台中車站', 'normalize 臺/space');
assert(q('台中車站').startsWith('taichung-station'), '台中車站 → 臺中驛 :' + q('台中車站'));
assert(q('臺灣神社').startsWith('yuanshan'), '臺灣神社 → 圓山');
assert(q('taichu').includes('taichung-station'), 'romaji taichu');
assert(q('台南 車站').startsWith('tainan-station'), 'multi-term AND: ' + q('台南 車站'));
assert(q('台南驛前').startsWith('tainan-station'), 'fuzzy 台南驛前: ' + q('台南驛前'));
assert(q('', { city: ['臺南市'], status: ['live'] }) === 'tainan-station', 'filters AND');
assert(q('', { type: ['神社', '市場'] }).split(',').length === 2, 'filters OR in group: ' + q('', { type: ['神社', '市場'] }));
assert(q('', { period: ['qing'] }).includes('taipei-station'), 'period qing');
assert(q('xyzzy') === '', 'no result');
// 資料庫完整性：必要欄位、id 唯一、上線場景必有入口與座標、座標在臺灣範圍內
const ids = new Set();
for (const s of reg.scenes) {
  for (const k of ['id', 'name', 'city', 'eras', 'status', 'summary']) assert(s[k] != null, `${s.id} has ${k}`);
  assert(!ids.has(s.id), `unique id ${s.id}`); ids.add(s.id);
  if (s.status === 'live') assert(s.entry && s.lat != null && s.thumbnail, `${s.id} live has entry/coords/thumbnail`);
  if (s.status !== 'live') assert(s.entry == null, `${s.id} not live → no entry`);
  if (s.lat != null) assert(s.lat > 21.8 && s.lat < 26.4 && s.lng > 118.1 && s.lng < 122.1, `${s.id} coords inside Taiwan`);
  for (const e of s.eras) assert(reg.taxonomy.periods.some(p => p.id === e.period), `${s.id} era period ${e.period}`);
  if (s.thumbnail) assert(fs.existsSync(new URL('../public/' + s.thumbnail, import.meta.url)), `${s.id} thumbnail exists`);
}
