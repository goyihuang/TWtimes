# 場景 API 與共用面板（給開發者）

所有 3D 場景都把引擎包成同一個「場景 API」，交給 `src/shared/scene-panel.js` 的共用面板。介面行為只寫一次，新場景只要實作這個物件。

## 檔案

| 檔案 | 作用 |
|---|---|
| `src/shared/tokens.css` | 顏色、字體、間距變數（`docs/art-direction.md` 第 2 節） |
| `src/shared/scene-panel.js`／`.css` | 共用面板：年代列、鏡位、焦距、天氣、時刻、漫步、今昔並排、分享、純畫面、場景開關、重建依據表 |
| `src/shared/platform-frame.js` | 獨立引擎（臺南、圓山、現代街景）接上首頁框架：城市列、取景地點、街景索引；全站街景目錄 `CATALOG` |
| `src/shared/scene-switcher.js`／`registry.js` | 景點列與景點目錄（Ctrl＋K），資料取自 `scene-registry.json` |
| `src/world/` | 全臺立體地景（圖磚串流 LOD），`?place=tw` |
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
  // 時間軸拖曳（選配，src/shared/timeline.js）：沒有就改成越過中點直接切換
  scrub(a, b, k), endScrub(target),   // a < b 相鄰年代，k 0–1；放開時 target 是 a 或 b
  // 選配：沒有就不顯示對應控制項
  setFocal(mm), setWeather(key), weathers: { key: '名稱' }, setHour(h), toggleWalk(), zoom(f),
  toggles: [{ id, label, title?, on(), set(v) }],   // 場景特有開關，例：圓山的膠彩筆觸
  extraLinks: [{ label, href }],
  params: [{ id, label, min, max, step, unit, get(), set(v) }],   // 片場參數滑桿（例：現代街景的推估樓高、路寬）
  actions: [{ label, title?, run() }],                            // 一次性動作（例：重擲推估高度、匯出 GLB）
  walkHint: '漫步操作提示',
  // 年代轉場與片場工具（src/shared/era-grow.js、scene-tools.js）
  transitions: ['grow', 'fade', 'cut'],   // 支援的轉場方式；面板只列出這些
  grow,                                   // createEraGrow() 的實例（拍照、白模、匯出前會先 finish）
  scene, THREE,                           // 有這兩個就提供「白模檢視」
  controls,                               // OrbitControls：提供「緩緩環繞」（或改給 setSpin(v)／spin）
  exportRoot: () => object3D,             // 目前年代的根節點：提供「匯出 GLB」
  redraw(),                               // 依需求重畫的引擎（app.js）用
  // 畫面風格、短片、出處（src/shared/look.js、clip.js、credits.js；見 docs/look.md）
  post,                                   // src/yuanshan/post.js 的 Post：提供「畫面風格」（線稿／網點、調色表、移軸、柔和陰影）與「短片」
  credits: ['© OpenStreetMap contributors（ODbL）', …],   // 畫面右下、照片、短片、GLB 自動帶上
  replayPop(),                            // 短片「彈起開場」（全臺地景）
  focusLatLng() /* → { lat, lng, name, hour, size } */,   // 提供「在どこでもロケハン開啟此處」連結
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
| 全臺立體地景 | `?place=tw`（或 `&id=`、`&ll=緯度,經度`）`&d=&hd=&pt=&t=&w=&mm=&seed=&hs=&rs=&ex=&clay=1&trees=0&labels=0&walk=1`（見 `docs/world.md`） | — |
| 圓山 | `?place=yuanshan&era=1–4&t=&w=&mm=&cam=` | `yuanshan.html?era=…&shot=…&paint=1`（轉址）、`?place=yuanshan` |
| 臺中 1935（已退場） | — | `taichung-1935.html#era=1935&t=&w=&v=`、`./#era=…` 轉到 `?place=station`（或 `river`）並帶 `era`、`t`、`w` |

`shot` 從 0 起算（圓山沿用舊的 1 起算）。`cam` 存在時優先於 `shot`。

## 年代轉場「建物長出來」（`src/shared/era-grow.js`）

所有場景共用。只做動畫、不改模型：轉場期間把網格材質換成加了轉場著色器的複本，結束後換回原材質，所以結束畫面與直接切換完全相同。

```js
import { createEraGrow, TRANSITION } from '../shared/era-grow.js';
const grow = createEraGrow(THREE);            // 傳入場景用的 three（app.js 用舊版 window.THREE）
// 切換年代：
if (TRANSITION.mode === 'grow') { const from = oldGroup; showOnly(newGroup); grow.start(from, newGroup, controls.target); }
// 每幀：grow.update(dt)；拍照／今昔並排前：grow.finish()
```

- 以鏡頭注視點為圓心，波紋向外推進；距離正規化後開根號，鏡頭前的建物有較長的時間慢慢長。
- 高於地面 0.35 m 的部分：舊年代沉回地面，新年代從地面長高，沿每 3.2 m 亮一條金色樓層線。
- 貼地的地面、道路、水面：兩年代互補溶解（同一點只出現一個年代，不會疊影）。
- 陰影一起長（替換陰影深度材質）。線、點、精靈、自訂 ShaderMaterial 在中點直接切換。
- 全站設定 `TRANSITION`（`mode`：grow／fade／cut，`seconds`）存在 localStorage `tw-transition-v1`，面板「年代轉場」可改；系統開啟「減少動態效果」時預設直接切換。
- 圓山沿用自己的著色器（`src/yuanshan/materials.js`，最早的版本），只讀取 `TRANSITION` 的時間與直接切換。
- 測試：`grow.hold = true` 凍結、`grow.seek(k)` 跳到進度 k，可逐格截圖。

## 片場工具（`src/shared/scene-tools.js`）

共用面板底部同一組，依場景 API 能力自動出現：年代轉場與轉場時間、構圖框（三分線、16:9、2.39:1、4:5、9:16、1:1；快門依比例裁切）、縮時（每 2 秒 1 小時）、緩緩環繞、白模檢視、匯出 GLB。場景自己已有同名功能（圓山的環繞、現代街景的白模與匯出）時不重複。

## 時間軸（`src/shared/timeline.js`）

年代列改成一條可拖曳的時間軸（取代一排按鈕），所有場景共用，由 `scene-panel.js` 掛上：

- 拖曳把手：在相鄰兩個年代之間連續過渡。場景有 `scrub(a, b, k)` 時，畫面停在轉場進度 k（建物長到一半、地面溶解到一半）；放開後 `endScrub(target)` 以剩下的進度播完（或倒退回原年代）。
- 點刻度或軌道：播放轉場到該年代；▶：依序走過每個年代（每站停約 2.6 秒）。
- 鍵盤（焦點在時間軸）：← → 換年代、Home／End、空白鍵播放；滾輪在時間軸上也能換年代。
- 減少動態效果或轉場設為「直接切換」時：拖曳越過中點就切換，不做連續過渡。

引擎接法：每個年代一個群組的引擎用 `eraScrubber()`（`era-grow.js`），只要給 `group(i)`、`center()`、`apply(i)`、`current()`，選配 `blend(a, b, k)` 內插調色：

```js
const scrubber = eraScrubber({ grow, group: i => eras[i].group, center: () => controls.target, apply: i => applyEra(i), current: () => state.era });
return { …, scrub: scrubber.scrub, endScrub: scrubber.endScrub };
```

底層是 `grow.scrub(from, to, center, k)`（停在進度 k）與 `grow.settle(forward, onDone)`（放開後往前播完或倒退）。圓山用自己的著色器，`App.scrubEra()` 直接控制 `eraT`。app.js 場景（臺中、彰化、高雄）的昔今兩代支援拖曳；臺北五代站房沒有 scrub。
