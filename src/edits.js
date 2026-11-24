// 編輯圖層：使用者對街景的所有修改都存在這裡，原始街景 (OSM base) 永遠不變。
// 結構可以序列化成 JSON 匯出／匯入，或存成多個「拍攝場景」。
const KEY = 'twtimes.edits.v1';
const SCENES = 'twtimes.scenes.v1';

export function emptyEdits() {
  return { version: 1, global: { streetWidth: 1, floorsDelta: {} }, eras: {} };
}

export class Edits {
  constructor() {
    this.data = emptyEdits();
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.version === 1) this.data = { ...emptyEdits(), ...s }; } catch {}
    this.listeners = new Set();
  }
  onChange(fn) { this.listeners.add(fn); }
  emit(scope) { localStorage.setItem(KEY, JSON.stringify(this.data)); this.listeners.forEach(f => f(scope)); }
  get global() { return this.data.global; }
  setGlobal(k, v) { this.data.global[k] = v; this.emit('global'); }
  floorsDelta(eraId) { const f = this.data.global.floorsDelta; return typeof f === 'number' ? f : (f?.[eraId] || 0); }
  setFloorsDelta(eraId, v) { let f = this.data.global.floorsDelta; if (typeof f !== 'object' || !f) f = this.data.global.floorsDelta = {}; f[eraId] = v; this.emit(eraId); }
  building(eraId, id) { return this.data.eras[eraId]?.buildings?.[id] || null; }
  setBuilding(eraId, id, patch) {
    const era = (this.data.eras[eraId] ||= { buildings: {} });
    const cur = { ...(era.buildings[id] || {}), ...patch };
    for (const k of Object.keys(cur)) if (cur[k] === undefined || cur[k] === null) delete cur[k];
    if (Object.keys(cur).length) era.buildings[id] = cur; else delete era.buildings[id];
    this.emit(eraId);
  }
  resetBuilding(eraId, id) { if (this.data.eras[eraId]?.buildings) delete this.data.eras[eraId].buildings[id]; this.emit(eraId); }
  resetAll() { this.data = emptyEdits(); this.emit('all'); }
  count() { let n = 0; for (const e of Object.values(this.data.eras)) n += Object.keys(e.buildings || {}).length; const g = this.data.global; return n + (g.streetWidth !== 1) + Object.values(typeof g.floorsDelta === 'object' ? g.floorsDelta : { a: g.floorsDelta }).filter(Boolean).length; }
  export() { return JSON.stringify(this.data, null, 2); }
  import(json) { const d = JSON.parse(json); if (d.version !== 1) throw new Error('格式不符'); this.data = { ...emptyEdits(), ...d }; this.emit('all'); }
}

// 拍攝場景存檔：編輯 + 時代 + 時間 + 天氣 + 鏡頭位置
export const sceneStore = {
  list() { try { return JSON.parse(localStorage.getItem(SCENES)) || []; } catch { return []; } },
  save(entry) { const l = this.list().filter(s => s.name !== entry.name); l.unshift(entry); localStorage.setItem(SCENES, JSON.stringify(l.slice(0, 30))); },
  remove(name) { localStorage.setItem(SCENES, JSON.stringify(this.list().filter(s => s.name !== name))); },
};
