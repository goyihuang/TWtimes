# 今昔時空 TWtimes

[進入今昔街影](https://goyihuang.github.io/TWtimes/)：首頁直接是 3D 街景（臺南驛前），上方景點列可切換全部景點，Ctrl＋K 開景點目錄；[全臺地圖](https://goyihuang.github.io/TWtimes/map.html)可在地圖、圖鑑與時間軸上找景點、疊中研院百年歷史地圖。也可用 `?place=` 直接開啟，例如[臺北車站](https://goyihuang.github.io/TWtimes/?place=taipei)、[高雄車站](https://goyihuang.github.io/TWtimes/?place=kaohsiung)、[安平・大員](https://goyihuang.github.io/TWtimes/?place=anping)。

## 首頁、景點切換與現代街景

- 根目錄直接開 3D 街景，導覽卡介紹景點列、景點目錄與全臺地圖。
- 景點列與景點目錄全部由 `scene-registry.json` 產生：搜尋、地區／呈現方式／年代／類型篩選、臺灣小地圖、最近看過。
- 有座標但還沒建模的景點，依 OpenStreetMap 自動生成現代 3D 街景（`?place=osm&id=…`），可調推估樓高、路寬、範圍、白模檢視並匯出 GLB；地圖上放大後點任一處也能生成。
- 部署時 `npm run bake-osm` 預先下載候選景點的街區。細節與兩個參考工具的研究見 [docs/streetscape.md](docs/streetscape.md)。

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
- 時刻 0–24 時（太陽軌跡、晨霧、夜間燈籠與光池、螢火蟲、星空）、晴／雲／雨／霧、六個鏡位、膠彩筆觸濾鏡、拍照存入「我的攝影」、今昔並排。
- 網址參數：`era=1..4`、`t=時刻`、`w=clear|cloudy|rain|fog`、`shot=1..6`、`paint=1`、`mm=焦距`、`cam=相機`、`q=low`（舊的 `yuanshan.html?…` 會轉到 `?place=yuanshan`）。
- 程式在 `src/yuanshan/`：`geo.js` 河道與地形骨架、`terrain.js` 地形與各時代地表、`forest.js` 樹林、`landmarks.js` 社殿與飯店、`bridges.js` 兩代橋、`atmosphere.js` 天空光影天氣、`post.js` 調色後製、`eras.js` 時代敘事與鏡位。

## 臺中驛前（原 1935 版已退場）

原本的 `taichung-1935.html` 站房與 1931 年舊照不符（比對見 [docs/scene-inventory.md](docs/scene-inventory.md)），2026-11-28 退場。它的時刻與天氣已移植到首頁框架（臺中、彰化、臺北、高雄都可用），舊網址會自動轉到 `?place=station` 並保留年代、時刻、天氣。

## 開發

```bash
npm install
npm run dev        # 本機預覽 http://localhost:5173
npm run build      # 輸出到 dist/
npm test           # 地景資料庫與搜尋測試
npm run fetch-osm -- 西,南,東,北 public/data/<街區>.osm.json   # 下載 OSM 資料
npm run bake-osm   # 預先下載候選景點的現代街景街區（public/data/osm/，不提交）
```

推到 `main` 後，`.github/workflows/deploy.yml` 會自動建置並部署到 GitHub Pages（需在 repo 的 Settings → Pages 把 Source 設為 GitHub Actions）。

## 架構

```
index.html + style.css        首頁框架（景點列、主畫面、側欄、時空切換）
src/shared/scene-switcher.js  景點列與景點目錄（registry.js 為共用純函式）
src/streetscape/              現代街景（OSM 自動生成）
public/app.js 等              臺中、彰化、臺北、高雄的引擎（three.min.js）
src/shared/                   共用場景面板、設計變數、框架接口（docs/scene-contract.md）
src/tainan/、src/anping/、src/yuanshan/    臺南、安平、圓山的獨立引擎（npm three）
src/atlas/ + map.html         全臺地圖首頁
public/data/                  OSM 資料、地景資料庫
tools/blender/                地標建模腳本
```

## 資料與授權

- 街道與建物：© OpenStreetMap contributors，ODbL 授權。
- 歷史街景為依史料與舊照重建的**示意**，不是精確史實；各年代依據見場景內「重建依據與可信度」。
- 本專案不內嵌任何來源不明的舊照片。

## 地標 3D 模型（Blender）

重要地標用 Blender 依照片建模，匯出 GLB 放在 `public/models/`。模型以公尺建模、原點在 OSM 輪廓外接矩形中心、長邊沿 x、正面朝 Blender +y。共用函式在 `tools/blender/common.py`。
## 安平・大員

首頁 `?place=anping`（景點列或景點目錄可切換）。四個年代：1644 荷蘭熱蘭遮城與大員市鎮、1871 湯姆生拍下的殘牆、1935 日治史料館與燈塔、2026 今日安平古堡與老街。

- 平面：城堡（上層主堡、下層主堡、外堡）與市鎮街廓 A–P 描自成大博物館今昔疊圖，以 OSM 現存外堡南牆校正（`src/anping/plan.js`，方法見重建依據表第 1 節）。
- 現況：`public/data/anping.osm.json`（OSM，ODbL，2026-11-28 下載）。
- 程式：`src/anping/main.js`（引擎）、`world.js`（四年代地景，全部程式生成，沒有外部模型）、`eras.js`（年代、鏡位、依據）、`plan.js`、`platform.js`（接首頁 UI）。
- 功能：六鏡位、焦距、天氣（晴／雲／雨／海霧）、時刻、夜間照明、漫步（可走上城堡平臺）、今昔並排、分享網址還原鏡頭。
- 重建依據與可信度：[docs/anping-evidence.md](docs/anping-evidence.md)；史料卡 `docs/sources/anping-zeelandia/cards.json`；截圖 `docs/anping/`。

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
