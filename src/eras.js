import { hash01 } from './geo.js';

// 時代定義。每個時代都從同一份「原始街景」(OSM) 推導，
// 再套用該時代的規則（哪些建物存在、外觀風格、道路鋪面、鐵道型式）。
// 未來新增時代（例如 1965）只要在這裡加一筆。

export function yearOf(tags) {
  const m = /(\d{4})/.exec(tags.start_date || '');
  return m ? +m[1] : null;
}

// 地標：用名稱或座標辨識 OSM 建物，給予特定年代與風格。
// lon/lat 用來找沒有名稱的建物（例如宮原眼科）。
export const LANDMARKS = [
  { key: 'station1917', osmName: '臺中驛', custom: 'station', front: [120.68420, 24.13760], built: 1917, style: 'tatsuno', levels: 2, roof: 'hip', tower: { h: 9, w: 7 },
    label: { '1935': '臺中驛（1917）', today: '臺中車站舊站（1917 古蹟）' } },
  { key: 'prefecture', osmName: '臺中州廳', built: 1913, style: 'govt', roof: 'mansard',
    label: { '1935': '臺中州廳', today: '臺中州廳（古蹟）' } },
  { key: 'cityhall', osmName: '臺中市役所', built: 1911, style: 'govt', roof: 'hip', tower: { h: 7, w: 6, dome: true },
    label: { '1935': '臺中市役所', today: '臺中市役所（古蹟）' } },
  // OSM 沒有宮原眼科的完整輪廓：依中山路與綠川東街的街角自訂（斜切角朝新盛橋）
  { key: 'miyahara', custom: 'miyahara', built: 1927, style: 'brick', levels: 2,
    footprint: [[120.6833953, 24.1377921], [120.683625, 24.1376786], [120.6837735, 24.1378234], [120.6835135, 24.1379519], [120.6833886, 24.1378302]], corner: [120.6833649, 24.1378071],
    label: { '1935': '宮原眼科（1927）', today: '宮原眼科' } },
  { key: 'hexagon', osmName: '六角樓', built: 1917, style: 'govt', roof: 'hip', levels: 2,
    label: { '1935': '新富町市場 六角樓', today: '第二市場 六角樓' } },
  { key: 'market2', osmName: '第二市場', built: 1917, style: 'wood', levels: 1, roof: 'hip' },
  { key: 'pavilion', osmName: '湖心亭', built: 1908, style: 'pavilion', levels: 1, roof: 'hip',
    label: { '1935': '臺中公園 池亭（湖心亭）', today: '臺中公園 湖心亭' } },
  { key: 'exam', osmName: '臺灣府儒考棚', built: 1889, style: 'qing', levels: 1, roof: 'hip' },
  { key: 'station2016', osmName: '臺中車站', built: 2016, style: 'glass', label: { today: '臺中車站（2016 高架新站）' } },
];

const SHOP_1935 = ['shophouse1935a', 'shophouse1935b', 'shophouse1935c', 'brick'];
const MODERN = ['modernTile', 'modernBeige', 'modernConcrete', 'modernTile', 'modernBeige'];

function estimateLevels(b) {
  const t = b.tags;
  const lv = parseFloat(t['building:levels']);
  if (lv > 0) return lv;
  const h = parseFloat(t.height);
  if (h > 1) return Math.max(1, Math.round(h / 3.3));
  const r = hash01(b.id, 1);
  switch (t.building) {
    case 'roof': return 1;
    case 'temple': case 'church': return 1 + Math.round(r);
    case 'parking': return 5;
    case 'school': case 'public': case 'government': case 'office': return 4 + Math.round(r * 3);
    case 'hotel': return 6 + Math.round(r * 6);
    case 'apartments': return 7 + Math.round(r * 5);
  }
  if (b.area < 60) return 2 + Math.round(r * 2);
  if (b.area < 200) return 3 + Math.round(r * 2);
  if (b.area < 800) return 4 + Math.round(r * 4);
  return 5 + Math.round(r * 7);
}

export const ERAS = {
  '1935': {
    id: '1935', year: 1935, label: '1935 昭和十年', short: '1935',
    road: { surface: 'dirt', markings: false, sidewalk: 'earth' },
    rail: 'ground', trees: 0.5, signs: false, lamps: 'gas', tint: [1.04, 1.0, 0.9],
    building(b, lm) {
      if (lm) {
        if (lm.built > this.year) return null;
        return { style: lm.style, levels: lm.levels ?? estimateLevels(b), roof: lm.roof || 'flat', tower: lm.tower, custom: lm.custom };
      }
      const t = b.tags; const y = yearOf(t);
      if (b.infill) { const r = hash01(b.id, 7); return { style: SHOP_1935[Math.floor(hash01(b.id, 3) * 3)], levels: r < 0.15 ? 1 : r < 0.85 ? 2 : 3, roof: 'flat', arcade: true }; }
      if (t.historic && (!y || y <= this.year)) return { style: 'govt', levels: Math.min(estimateLevels(b), 3), roof: 'hip' };
      if (y && y > this.year && ['train_station', 'parking', 'construction', 'transportation'].includes(t.building)) return null;
      if (['construction', 'roof', 'parking', 'transportation', 'service'].includes(t.building)) return null;
      if (t['building:part']) return null;
      const r = hash01(b.id, 7);
      if (b.area > 2500) return r < 0.5 ? null : { style: 'wood', levels: 1, roof: 'hip' };
      const levels = r < 0.08 ? 1 : r < 0.72 ? 2 : 3;
      const style = b.area < 400 ? SHOP_1935[Math.floor(hash01(b.id, 3) * SHOP_1935.length)] : (r < 0.5 ? 'wood' : 'shophouse1935b');
      return { style, levels, roof: style === 'wood' ? 'hip' : 'flat', arcade: style !== 'wood' };
    },
    railway(r) {
      const t = r.tags;
      if (['abandoned', 'disused'].includes(t.railway)) return { kind: 'ground' };
      if (t.railway === 'rail' && !yearOf(t)) return null; // 現行高架線
      return null;
    },
    roadIncluded(r) { const y = yearOf(r.tags); return !(y && y > this.year) && r.tags.highway !== 'busway'; },
  },
  today: {
    id: 'today', year: 2026, label: '現今', short: '今',
    road: { surface: 'asphalt', markings: true, sidewalk: 'tile' },
    rail: 'elevated', trees: 1, signs: true, lamps: 'led', tint: [1, 1, 1],
    building(b, lm) {
      if (lm) return { style: lm.style, levels: lm.levels ?? estimateLevels(b), roof: lm.roof || 'flat', tower: lm.tower, custom: lm.custom };
      const t = b.tags; const y = yearOf(t);
      if (b.infill) { const r = hash01(b.id, 7); return { style: MODERN[Math.floor(hash01(b.id, 3) * MODERN.length)], levels: r < 0.2 ? 3 : r < 0.7 ? 4 : r < 0.9 ? 5 : 7, roof: 'flat', storefront: true }; }
      if (y && y > this.year) return null;
      if (t.historic) return { style: 'govt', levels: estimateLevels(b), roof: 'hip' };
      const levels = estimateLevels(b);
      let style = MODERN[Math.floor(hash01(b.id, 3) * MODERN.length)];
      if (levels >= 11 && hash01(b.id, 4) < 0.6) style = 'glass';
      if (t.building === 'roof') return { style: 'canopy', levels: 1, roof: 'flat', canopy: true };
      if (t.building === 'temple') return { style: 'temple', levels, roof: 'hip' };
      const minLevel = parseFloat(t['building:min_level']) || 0;
      return { style, levels, roof: 'flat', storefront: levels <= 14, minLevel };
    },
    railway(r) {
      const t = r.tags;
      if (t.railway === 'rail') return { kind: 'elevated' };
      if (['abandoned', 'disused'].includes(t.railway)) return { kind: 'greenway' };
      return null;
    },
    roadIncluded(r) { return true; },
  },
};
export const ERA_ORDER = ['1935', 'today'];
