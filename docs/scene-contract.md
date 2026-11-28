# 場景 API 與共用面板（給開發者）

所有 3D 場景都把引擎包成同一個「場景 API」，交給 `src/shared/scene-panel.js` 的共用面板。介面行為只寫一次，新場景只要實作這個物件。

## 檔案

| 檔案 | 作用 |
|---|---|
| `src/shared/tokens.css` | 顏色、字體、間距變數（`docs/art-direction.md` 第 2 節） |
| `src/shared/scene-panel.js`／`.css` | 共用面板：年代列、鏡位、焦距、天氣、時刻、漫步、今昔並排、分享、純畫面、場景開關、重建依據表 |
| `src/shared/platform-frame.js` | 獨立引擎（臺南、圓山、現代街景）接上首頁框架：城市列、取景地點、街景索引；全站街景目錄 `CATALOG` |
| `src/shared/scene-switcher.js`／`registry.js` | 景點列與景點目錄（Ctrl＋K），資料取自 `scene-registry.json` |
| `src/streetscape/` | 現代街景引擎（OSM 自動生成），`?place=osm&id=<registry id>` 或 `?place=osm&lat=&lng=&name=` |
| `src/shared/legacy-bridge.js` | 首頁原有場景（`public/app.js`：臺中三處、彰化兩處、臺北、高雄）轉成場景 API |
| `src/tainan/platform.js`、`src/yuanshan/platform.js` | 兩個獨立引擎的掛載點 |

`index.html` 依 `?place=` 載入：`tainan` → 臺南、`yuanshan` → 圓山、其他 → `app.js`＋`legacy-bridge.js`。

## 場景 API

```js
{
  eras: [{ id, year, name, en?, story, evidence: [['項目', 'A'|'B'|'C', '依據'], …] }],
  shots: [{ name }],
  state: { era, shot, mm?, weather?, hour?, walk? },   // 可用 getter
  setEra(i), setShot(i), snapshot() /* → canvas */, compare() /* → { canvas, title } */, shareURL() /* → string */,
  // 選配：沒有就不顯示對應控制項
  setFocal(mm), setWeather(key), weathers: { key: '名稱' }, setHour(h), toggleWalk(), zoom(f),
  toggles: [{ id, label, title?, on(), set(v) }],   // 場景特有開關，例：圓山的膠彩筆觸
  extraLinks: [{ label, href }],
  params: [{ id, label, min, max, step, unit, get(), set(v) }],   // 片場參數滑桿（例：現代街景的推估樓高、路寬）
  actions: [{ label, title?, run() }],                            // 一次性動作（例：重擲推估高度、匯出 GLB）
  walkHint: '漫步操作提示',
  keepCaption: false,   // true：左下標題由引擎自己管（app.js）
  frameButtons: true,   // false：快門、縮放、重設、全螢幕保留引擎原本的處理（app.js）
}
```

引擎在狀態改變時呼叫面板給的回呼：`ui.onEra(i)`、`ui.onShot(i)`、`ui.onWalk(on)`、`ui.onHour(h)`、`ui.onWeather(w)`、`ui.onToggle()`、`ui.status(text)`。

```js
const canvas = setupModuleFrame({ key: 'xxx', heading: '…', cityEn: '…', english: '…', canvasLabel: '…' });
const panel = mountScenePanel({ title: '…', en: '…' });
const api = await createXxx(canvas, panel.ui);
panel.bind(api);
```

## 分享網址（全部向下相容）

| 場景 | 新參數 | 仍支援的舊網址 |
|---|---|---|
| 臺中、彰化、高雄 | `?place=<key>&era=past|now&shot=n&mm=&t=&w=&cam=px,py,pz,tx,ty,tz&walk=1` | `?place=<key>`、`?place=station&view=arcade&era=past|now` |
| 臺北 | `?place=taipei&generation=1–5&shot=…&cam=…` | `?place=taipei&generation=n` |
| 臺南 | `?place=tainan&era=1920…2026&t=&w=&mm=&cam=&walk=1` | `tainan.html?era=0&shot=4`（轉址） |
| 現代街景 | `?place=osm&id=<id>`（或 `&lat=&lng=&name=`）`&t=&w=&mm=&cam=&walk=1&seed=&hs=&rs=&r=&clay=1&trees=0&props=0` | — |
| 圓山 | `?place=yuanshan&era=1–4&t=&w=&mm=&cam=` | `yuanshan.html?era=…&shot=…&paint=1`（轉址）、`?place=yuanshan` |
| 臺中 1935（已退場） | — | `taichung-1935.html#era=1935&t=&w=&v=`、`./#era=…` 轉到 `?place=station`（或 `river`）並帶 `era`、`t`、`w` |

`shot` 從 0 起算（圓山沿用舊的 1 起算）。`cam` 存在時優先於 `shot`。
