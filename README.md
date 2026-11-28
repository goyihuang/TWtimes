# 今昔時空 TWtimes

[進入全臺地景地圖](https://goyihuang.github.io/TWtimes/)：在臺灣地圖、圖鑑與時間軸上找到每一處地景，疊上中研院百年歷史地圖，再進入 3D 街景切換今昔。舊的街景首頁仍可用 `?place=` 直接開啟，例如[臺北車站](https://goyihuang.github.io/TWtimes/?place=taipei)、[高雄車站](https://goyihuang.github.io/TWtimes/?place=kaohsiung)、[臺南驛前](https://goyihuang.github.io/TWtimes/?place=tainan)。

## 全臺地圖首頁（map.html）

- 地圖／圖鑑／時間軸三種瀏覽方式，共用搜尋與多重標籤篩選（縣市、類型、主題、年代、建築現況、完成狀態；同類任一、跨類全部）。
- 搜尋支援臺／台、舊名與別名、羅馬拼音與模糊比對。
- 中研院歷史圖層 9 種（1897–1956），可調透明度、用古今滑桿比對（CC BY-NC，限非商業）。
- 地景資料在 `public/data/scene-registry.json`，新增一筆即同步出現在三種模式。細節見 [docs/atlas.md](docs/atlas.md)。

## 統一介面與美術規範

所有 3D 場景都在首頁框架 `?place=<key>` 開啟，共用同一組控制項（年代列、鏡位、焦距、天氣、時刻、漫步、今昔並排、分享、純畫面、重建依據與可信度），程式在 `src/shared/`。

- [docs/art-direction.md](docs/art-direction.md)：美術與介面規範、新場景驗收表
- [docs/scene-contract.md](docs/scene-contract.md)：場景 API 與分享網址
- [docs/scene-inventory.md](docs/scene-inventory.md)：各場景盤點、臺中兩版本比對、待辦
- [docs/source-cards.md](docs/source-cards.md)：新景點先做平面圖文整理的格式與進 3D 門檻

## 圓山・劍潭　四時代（臺灣八景）

[進入圓山・劍潭](https://goyihuang.github.io/TWtimes/?place=yuanshan)（舊網址 `yuanshan.html` 會自動轉過來）：臺灣神社與明治橋、基隆河、劍潭山的四個時代。

| 時代 | 場景 |
| --- | --- |
| 1901–1933 | 臺灣神社（神明造社殿、鳥居、石燈籠參道）＋第一代鋼桁架明治橋 |
| 1933–1945 | 神社極盛、後山臺灣神宮、護國神社＋第二代鋼筋混凝土拱橋（宮燈塔柱） |
| 1950–1960 年代 | 臺灣大飯店中式樓閣、泳池網球場、牌樓＋中山橋、再春游泳池、兒童樂園 |
| 今 | 宮殿式圓山大飯店、忠烈祠、高架與捷運；中山橋已拆除（可開「舊橋殘影」） |

- 時間軸切換時，建築以金色光邊溶解浮現、樹木與街屋逐棵長出，地表與調色同步過渡（1901 手彩繪葉書、1933 膠彩畫意、1960 年代柯達克羅姆、今日當代）。
- 時刻 0–24 時（太陽軌跡、晨霧、夜間燈籠與光池、螢火蟲、星空）、晴／雲／雨／霧、六個鏡位、膠彩筆觸濾鏡、拍照下載。
- 網址參數：`era=1..4`、`t=時刻`、`w=clear|cloudy|rain|fog`、`shot=1..6`、`paint=1`、`ui=0`、`q=low`。
- 程式在 `src/yuanshan/`：`geo.js` 河道與地形骨架、`terrain.js` 地形與各時代地表、`forest.js` 樹林、`landmarks.js` 社殿與飯店、`bridges.js` 兩代橋、`atmosphere.js` 天空光影天氣、`post.js` 調色後製、`eras.js` 時代敘事與鏡位。

## 臺中驛前 1935・天氣與日夜版

[進入臺中驛前](https://goyihuang.github.io/TWtimes/taichung-1935.html)可體驗下列功能。

在瀏覽器裡漫步臺灣街區，**即時切換 1935 年與現今**的立體街景，可以調整時間、天氣，修改街景（樓層、街寬、外觀），並在場景中拍照。

第一個街區：**臺中驛前**（臺中車站、綠川、中山路／新盛橋通、宮原眼科、臺中州廳、第二市場、臺中公園）。

## 功能

| 功能 | 說明 |
| --- | --- |
| 時代切換 | 1935 昭和十年 ⇄ 現今，以「時光泡泡」從畫面中央擴散轉場（鍵盤 T） |
| 真實街道 | 道路、建物輪廓、綠川、柳川、鐵道來自 OpenStreetMap；OSM 沒畫建物的街廓會沿街推估補上街屋 |
| 視角 | 鳥瞰（拖曳旋轉、滾輪縮放）、漫步（WASD／方向鍵、拖曳轉頭、Shift 加速、Q/E 升降；手機有搖桿）、景點一鍵飛到 |
| 時間與天氣 | 0–24 時的太陽軌跡、夜間窗光與路燈、晴／多雲／雨／霧 |
| 編輯街景 | 街道寬度、各時代樓層增減、點選建物改樓層／外觀／隱藏；原始街景不變，可全部還原、匯出／匯入 JSON |
| 拍照 | 焦距 14–200mm、景深、6 種濾鏡、顆粒、暗角、三分構圖線、地點年代戳記、2×/3× 高畫質、「今昔對照」並排照 |
| 場景存檔 | 把編輯＋時代＋時間＋天氣＋鏡頭存成拍攝場景，隨時叫回 |

## 開發

```bash
npm install
npm run dev        # 本機預覽 http://localhost:5173
npm run build      # 輸出到 dist/
npm test           # 地景資料庫與搜尋測試
npm run fetch-osm  # 重新下載臺中車站周邊 OSM 資料
```

推到 `main` 後，`.github/workflows/deploy.yml` 會自動建置並部署到 GitHub Pages（需在 repo 的 Settings → Pages 把 Source 設為 GitHub Actions）。

## 架構：原始街景 → 時代規則 → 編輯圖層

```
public/data/*.osm.json   原始街景（OSM，唯讀）
src/data.js              讀入並轉成公尺座標
src/infill.js            推估補建街屋（依街寬重新排列）
src/eras.js              時代規則：哪些建物存在、外觀風格、鐵道型式、地標年代
src/edits.js             編輯圖層（localStorage／JSON），不改動原始資料
src/builders/            建物（合併網格＋招牌）、道路／河川／鐵道／樹木／路燈
src/textures.js          全部材質以 Canvas 程序化繪製（無圖檔版權問題）
src/env.js               太陽、天空、霧、天氣、夜空
src/render.js            兩個時代分別離屏繪製後混合；景深、濾鏡、色調映射
src/controls.js          鳥瞰／漫步
src/ui.js                介面
```

**新增時代**（例如 1965）：在 `src/eras.js` 的 `ERAS` 加一筆規則，並在 `ERA_ORDER` 排入。
**新增街區**：用 `npm run fetch-osm -- 西,南,東,北 public/data/新街區.osm.json` 下載資料，再在 `src/viewpoints.js` 加景點。
**新增地標**：在 `LANDMARKS` 加名稱或座標、建成年份、風格、塔樓等。

## 資料與授權

- 街道與建物：© OpenStreetMap contributors，ODbL 授權。
- 1935 年街景為依史料與舊照規則化的**重建示意**，不是精確史實。
- 本專案不內嵌任何來源不明的舊照片。

## 地標 3D 模型（Blender）

重要地標用 Blender 依照片建模，匯出 GLB 放在 `public/models/`，再在 `src/eras.js` 的地標加上 `model`：

```js
model: { all: { url: 'models/station1917.glb', native: true } }   // 或 { today: ..., '1935': ... } 依時代
```

`native: true` 表示模型以公尺建模、原點在 OSM 輪廓外接矩形中心、長邊沿 x、正面朝 Blender +y。
模型載入失敗時，會退回程式產生的版本。重建模型：

```bash
pip install bpy
python3 tools/blender/station1917.py   # 臺中驛（1917）
python3 tools/blender/station2016.py   # 臺中車站（2016 高架新站）
```

## 臺南驛前

首頁 `?place=tainan`（舊網址 `tainan.html` 會轉回首頁）。五個年代：1920 第一代木造站房、1936 第二代站房、1970 戰後、2019 地下化前、2026 地下站啟用。

- 站房：`tools/blender/tainan_station_1936.py`、`tainan_station_1900.py` 依館藏舊照以 Blender 建模，輸出 `public/models/tainan-1936.glb`、`tainan-1900.glb`、`tainan-canopy.glb`（月臺鋼軌雨棚單元）。模型直接使用站區本地座標，網頁端不需旋轉。
- 街廓：`public/data/tainan-station.osm.json`（OSM，ODbL）。現代年代用實際外框與樓層；歷史年代只示意密度。
- 程式：`src/tainan/main.js`（引擎）、`scenery.js`（各年代街景）、`eras.js`（年代、鏡位、依據）、`osm.js`、`kit.js`、`platform.js`（接首頁 UI）。
- 功能：六鏡位、焦距、天氣（晴／雲／雨／晨霧）、時刻與太陽位置、夜間照明、雨天濕地、漫步（WASD／手機雙區觸控）、今昔並排、分享網址還原鏡頭。
- 重建依據與可信度：[docs/tainan-evidence.md](docs/tainan-evidence.md)；實測截圖在 `docs/tainan/`。
- 史料：[國家文化資產網](https://nchdb.boch.gov.tw/assets/overview/monument/19981218000001)、[鐵道局通車公告](https://www.rb.gov.tw/zh-TW/main/main_188/news/main_347/20261005_082504/)、[鐵道局 2026-10-19 新聞稿](https://www.rb.gov.tw/zh-TW/main/main_188/news/main_347/20261019_105610/)。

```bash
python3 tools/blender/tainan_station_1936.py   # 1936 站房
python3 tools/blender/tainan_station_1900.py   # 1900 站房 + 月臺雨棚
```
