// 地景搜尋與篩選（純函式，無 DOM，可在 Node 直接測試）
// 正規化：全形轉半形、臺→台、去除空白與標點、去除拉丁字母重音（Taichū → taichu）
export function normalize(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/臺/g, '台')
    .replace(/[\s・·.,，。、:：;；'"「」『』()（）\-–—/／|｜!！?？]+/g, '');
}

const bigrams = s => { const out = new Set(); for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2)); if (s.length === 1) out.add(s); return out; };
function dice(a, b) {
  const A = bigrams(a), B = bigrams(b); if (!A.size || !B.size) return 0;
  let hit = 0; for (const g of A) if (B.has(g)) hit++;
  return (2 * hit) / (A.size + B.size);
}

// 預先建立索引欄位與權重
export function indexScene(scene) {
  const field = (w, ...vals) => vals.flat().filter(Boolean).map(v => [normalize(v), w]);
  return [
    ...field(100, scene.name),
    ...field(80, scene.aliases || []),
    ...field(60, scene.nameEn),
    ...field(50, scene.city, scene.district),
    ...field(40, scene.types || [], scene.themes || [], scene.tags || [], scene.buildingStatus),
    ...field(30, (scene.eras || []).map(e => e.year)),
    ...field(15, scene.summary),
  ].filter(([v]) => v);
}

// 單一詞的分數：完全相符 > 開頭相符 > 包含 > 模糊（雙字元相似度）
function termScore(term, fields) {
  let best = 0;
  for (const [value, weight] of fields) {
    let s = 0;
    if (value === term) s = weight * 1.2;
    else if (value.startsWith(term)) s = weight;
    else if (value.includes(term)) s = weight * 0.85;
    else if (term.length >= 2 && weight >= 40 && value.length <= 40) {
      const d = dice(term, value);
      if (d >= 0.5) s = weight * 0.5 * d;
    }
    if (s > best) best = s;
  }
  return best;
}

// 查詢以空白分詞，每個詞都要命中（AND）
export function scoreScene(query, fields) {
  const terms = String(query ?? '').trim().split(/\s+/).map(normalize).filter(Boolean);
  if (!terms.length) return 1;
  let total = 0;
  for (const t of terms) { const s = termScore(t, fields); if (!s) return 0; total += s; }
  return total;
}

// 篩選語意：同一組內任一符合（OR），不同組之間全部符合（AND）
export const FILTER_GROUPS = [
  { key: 'city', label: '縣市', get: s => [s.city] },
  { key: 'type', label: '類型', get: s => s.types || [] },
  { key: 'theme', label: '主題', get: s => s.themes || [] },
  { key: 'period', label: '年代', get: s => [...new Set((s.eras || []).map(e => e.period))] },
  { key: 'building', label: '建築現況', get: s => [s.buildingStatus].filter(Boolean) },
  { key: 'status', label: '完成狀態', get: s => [s.status] },
];

export function matchesFilters(scene, filters) {
  for (const g of FILTER_GROUPS) {
    const want = filters[g.key];
    if (!want || !want.length) continue;
    const have = g.get(scene);
    if (!want.some(v => have.includes(v))) return false;
  }
  return true;
}

const STATUS_ORDER = { live: 0, dev: 1, planned: 2 };
export function runQuery(entries, query, filters) {
  return entries
    .map(e => ({ ...e, score: matchesFilters(e.scene, filters) ? scoreScene(query, e.fields) : 0 }))
    .filter(e => e.score > 0)
    .sort((a, b) => (query ? b.score - a.score : 0) || (STATUS_ORDER[a.scene.status] - STATUS_ORDER[b.scene.status]) || ((b.scene.lat ?? 0) - (a.scene.lat ?? 0)));
}
