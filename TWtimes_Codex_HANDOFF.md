# 今昔街影 TWtimes｜Codex 開發交接

更新：2026-11-27（臺灣時間）  
用途：將本文件交給 Codex，接續既有專案實作、測試及發布，不重新製作已完成場景。

## 1. 專案定位與優先級

《今昔街影》是臺灣歷史地景互動圖鑑（FORMOSA STREET ATLAS），以史料、地理資料與即時 3D 重建，讓使用者在同一鏡位比較不同年代，並自由探索與攝影。保留原品牌名稱。

**當前最高優先：完成臺南火車站，達到可發布的精緻作品品質。** 全臺 MAP、搜尋、標籤與歷史圖層為下一階段，不應阻礙臺南完成。不要只交付方案或概念圖；實際修改程式、運行、測試、修復並交付可體驗版本。

- Repository：https://github.com/goyihuang/TWtimes
- 正式網站：https://goyihuang.github.io/TWtimes/
- 臺南開發分支：`feat/tainan-station`
- 草稿 PR #5：https://github.com/goyihuang/TWtimes/pull/5
- 本交接最後已知提交：`ef5b48a1bdee416af45e5c593427f5ef8ecd15f2`（須重新查詢是否已有更新）。
- 最後已知狀態：臺南尚未合併 main，未正式發布，未實機驗證。不可將原型當成完成品。

## 2. 開工前必做

1. 在使用者既有 TWtimes 工作區執行 `git status`，確認未提交修改，不覆蓋、不 reset、不強制推送。
2. `git fetch origin`，檢查 main、`origin/feat/tainan-station` 與 PR #5 的最新狀態；如有他人新增工作，先整合再續作。
3. 閱讀 README、package.json、lockfile、vite.config.js、index.html、部署 workflow，以及 `src/tainan/`、`src/yuanshan/` 和既有地標建模腳本。
4. 使用獨立分支延續臺南開發。若本機尚無該分支，且工作區乾淨，可用 `git switch --track origin/feat/tainan-station`。若已存在則直接切換，避免建立重複分支。
5. 確認 Node、npm、Blender/bpy 可用性及公司資安限制；不得擅自繞過限制或安裝未授權工具。若環境無法執行，清楚記錄阻塞與可行替代方案。

## 3. 既有技術架構（最後已知，需核對）

- Three.js（package.json 曾為 `^0.187.0`）、Vite（曾為 `^8.3.8`）、JavaScript ES modules。
- GitHub Pages 子路徑部署，Vite `base: './'`；main push 觸發 `.github/workflows/deploy.yml`，Node 22、npm ci、npm run build。
- `index.html` 原首頁；`taichung-1935.html` 原有臺中專頁；`yuanshan.html` 圓山劍潭四時代專頁；`tainan.html` 新增臺南專頁。
- `src/data.js` 讀取 OSM，`src/eras.js` 年代規則，`src/builders/` 建物、道路、模型等，`src/edits.js` 編輯圖層，`src/env.js` 環境，`src/render.js` 渲染，`src/controls.js` 操作。
- `src/yuanshan/` 為獨立多年代模組，可參考其地形、建築、天氣、光影、後製、鏡位與 UI，但不可破壞現有場景。
- `public/data/*.osm.json` 原始地理資料；`public/models/` GLB；`tools/blender/` 建模腳本；`scripts/fetch-osm.mjs` 下載並壓縮 OSM 資料。
- 臺南採獨立頁面與模組，已在 Vite input 加入 `tainan.html`，首頁增加入口及 `?place=tainan` 轉址。保留其他地點的 URL 與分享參數。

## 4. 臺南目前已提交的成果

| 檔案 | 最後已知內容 |
|---|---|
| `tainan.html` | 全畫面畫布、五年代選單、時刻、天氣、四鏡位、拍照、分享、純畫面模式；深綠與暖金介面 |
| `src/tainan/main.js` | Three.js 場景、OrbitControls、五組程序化年代、站房、廣場、鐵路、光影、雨線、URL 參數及截圖 |
| `src/tainan/osm.js` | 可選擇載入 `public/data/tainan-station.osm.json`；解析現代道路與建物，失敗回退示意場景 |
| `src/tainan/art.js` | 程序化鋪面、榕樹、街燈、騎樓、車廂、車輛與行人示意，夜間發光 |
| `index.html` | 臺南入口與 query redirect |
| `vite.config.js` | 新增臺南 build entry |
| `README.md` | 臺南原型及已知限制說明 |

### 已知提交索引

- `156f83329db15027a699f2a16a5d0763572e235b`：臺南頁面。
- `b61f407fb54e80a0418d87ea0f78aa6b763bdfd8`：五年代程序化原型。
- `f696d023802f9f9a687bff1ae49d1b72158d511f`：Vite entry。
- `b52e38b5ef2b819c7d20cd4b413fd0acd1befd92`：首頁整合。
- `efba77462e7c7cae67214da6dd80dc25c519c69f`：README。
- `ba61951027f63abf3edf267acf3e496eebae5b0d`：歷史站房圓拱門窗、壁柱、線腳及時鐘修正。
- `c3cb37fb9662389f6dc3eef3b6ad8c37ce2133dd`：OSM loader。
- `ca2e5ce435832ebac5593e6a2f51fb2ca5e5aa7d`：現代年代整合 loader。
- `ae122e3f5178764163e20271f2676c1cba956566`：街景美術模組。
- `0064dca48111f509a92610b0154a884954336b2a`：街景與光影整合，1936 預設開場。
- `ef5b48a1bdee416af45e5c593427f5ef8ecd15f2`：介面強化與純畫面模式。

上述為對話中 GitHub 回傳的提交紀錄，不等於已通過測試。

## 5. 臺南驛前・百年府城門戶：製作規格

場景以車站及站前街區為核心，約 600 公尺為初始考察範圍；實際高精度區域與外圍簡化區域依效能及史料調整。重點：前後站、站前廣場、北門路、成功路、中山路、民族路、大學路及鐵道設施。不可用現代地圖直接代替歷史街廓。

| 年代 | 美術與考證方向 |
|---|---|
| 1920 前後 | 第一代木造臺南驛、早期站前空間、蒸汽鐵道與符合年代的街景；參考早期照片與地圖 |
| 1936–1938 | 第二代臺南驛、鐵道飯店、對稱立面、中央圓拱門窗與壁柱；預設主視覺 |
| 1970 前後 | 戰後站房招牌、商業街區、復古公車與機車；依選定年份考證 |
| 2019 前後 | 地下化前的現代站房、地面鐵道、站前交通；依實際施工狀態重建 |
| 2026／未來 | 區分實際現況、新站與未完成公共空間規劃；未查證前不得將未來設施當成現況 |

1936 站房立面曾依三座圓拱入口、二樓七扇圓拱長窗、中央壁柱與時鐘等特徵修正，仍須以正面、側面、屋頂及圖面核對。先確認真正的建築比例、朝向、入口與候車棟，而非盲目沿用目前方盒尺寸。2026 地下站啟用日期在舊程式中寫為 2026-10-17；此日期未在本輪重新驗證，必須查官方公告再保留或修正。

### 史料入口（需重新確認連結、內容及授權）

- 中研院臺灣百年歷史地圖：https://gissrv4.sinica.edu.tw/gis/twhgis/
- 中研院圖磚服務：https://gis.sinica.edu.tw/tileserver/
- 國家文化資產網：https://nchdb.boch.gov.tw/
- 國家文化記憶庫：https://tcmb.culture.tw/
- 國家圖書館臺灣記憶：https://tm.ncl.edu.tw/
- 交通部鐵道局：https://www.rb.gov.tw/
- OpenStreetMap：https://www.openstreetmap.org/
- 參考地圖圖層候選：`JM20K_1904`、`Baotu_1904`、`JM50K_1920`、`AMCityPlan_1945`。需查實際 GetCapabilities、覆蓋範圍、年代與圖磚授權，不假定全部可用。

每個重建項目建立 evidence 表：年代、地點、來源連結、照片方向、可信度、推估部分、授權。對照影像只使用可合法發布的素材；不把生成圖片當原始史料。中研院歷史圖磚可能有 CC BY-NC 限制，公開或商業整合前查明各圖層條款與授權。

## 6. 立即執行的開發工作（P0–P6）

### P0：資料與座標

- 查證車站中心座標、站房長軸、正面朝向及 OSM building footprint；舊 loader 使用 `120.2128,22.9971` 和 `[-north,-east]`，只是待核對的初始基準。
- 以站區實際範圍決定 bbox；可參考 `npm run fetch-osm -- 120.2068,22.9911,120.2188,23.0031 public/data/tainan-station.osm.json`（示例範圍，先驗證）。
- 檢查原始資料格式、道路、鐵道、建築、地物及來源 attribution。資料不存在時保留明確示意狀態，不顯示已載入。
- 現代 OSM 與歷史資料獨立，處理座標投影與地面高度一致性；歷史街廓依古圖、航照與照片建立各年代資料。

### P1：地標模型

- Blender/bpy 製作第一代、第二代站房；必要時分離戰後招牌、現代修復外觀等可重用部件。
- 模型以公尺為單位，統一原點、軸向、材質和命名；遵循既有 native GLB 放置規則（原點在 footprint 外接矩形中心、長邊沿 x、Blender 正面 +y），實際依 loader 驗證。
- 建立可重現的建模腳本與 GLB，放 `tools/blender/`、`public/models/`；保留模型 fallback 但清楚標示降級。
- 避免平貼假窗；使用適度凹凸、柱廊、屋頂、真實材質、窗框、玻璃、遮雨棚及磨損細節。尺寸須有來源或明確標示推估。

### P2：街區與美術

- 先完成 1936 主鏡位，再延伸其他年代；避免一口氣生成大量低品質建物。
- 修正站前廣場、道路交叉口、月台與鐵軌關係；現在的程序化街屋、列車、人車皆是概略模型，不能當考證結果。
- 現代 OSM 載入時隱藏重疊的示意道路、街屋；同一地點不得有兩層重疊建築。
- 製作具有時代差異的屋頂、騎樓、店面、植栽、交通工具與道路材質。招牌不要亂造歷史店名。
- 高級寫實 PBR 材質、暖色午後、清晨薄霧、雨天濕地反射及夜間照明。不要以過量 bloom、霓虹、低模玩具感掩飾模型缺陷。
- 依效能加入 InstancedMesh、合併幾何、LOD、適當 shadow 範圍、材質共用；限制每年代 draw calls，必要時按需載入年代並釋放資源。

### P3：互動與攝影

- 五年代切換保留同一相機位置及方向，支援真正今昔比較；避免切換後自動跳鏡位，除非使用者選擇。
- 至少六鏡位：站前正面、站前廣場、北門路斜側、成功路方向、月台鐵道、空拍。依實際地理配置修正。
- 補上漫步（WASD／方向鍵，手機操作）、時代切換過渡、純畫面、全螢幕、攝影焦距、今昔並排截圖及分享參數；優先沿用原站已有效實作。
- 增加史料說明面板、重建可信度、錯誤與載入提示。分享應還原實際狀態（相機位置若可行也包含），不只預設鏡位。

### P4：已知程式風險（先檢查再修正）

- OSM loader 目前只準備載入資料，最後已知尚無真實資料檔；現代示意群組與 OSM 群組可能重疊。
- 五組年代一次建立，街景由大量獨立 Mesh 構成，可能有記憶體與 draw-call 問題。
- 圓拱、時鐘、文字招牌、車輪軸向、站房朝向、屋頂形狀、座標符號皆需實際畫面驗證。
- 夜間燈泡目前主要為 emissive 外觀，非真正照明光池；雨天目前僅雨線與霧，尚缺濕地材質與環境效果。
- 純畫面模式、手機控制、分享、截圖、WebGL 初始化失敗與無資料 fallback 尚未實機驗證。
- 舊 `index.html` 轉址可能受其他 hash 導航規則影響；檢查 `?place=tainan` 和分享 URL。
- 未建立或未執行 PR 專用建置檢查；先核對現行 CI，新增不具發布權限的 PR build/test workflow（如有需要），不可把草稿 PR 直接部署覆蓋正式站。

### P5：驗收（必須實測）

```bash
npm ci
npm run build
npm run dev
# 另開終端，必要時 npm run preview 驗證 dist
```

使用本機瀏覽器或已授權的瀏覽器自動化工具：逐一測試臺南五年代、天氣、日夜、鏡位、漫步、純畫面、分享重開、截圖下載、手機窄螢幕、OSM 失敗降級。檢查 console、network、GLB/圖資 404、相機穿模、互相重疊、效能與記憶體。輸出真實畫面截圖（1936 正面、1920、1970、現代、夜雨、手機）與測試紀錄。性能數據以實測裝置為準，不虛構 FPS。

回歸測試原首頁、臺中、彰化、臺北、高雄及圓山劍潭入口與分享 URL；依現有實際路由補齊所有場景。測試 GitHub Pages 子路徑及 Vite dist。

### P6：發布門檻

- 必須有可辨識且考證合理的主要站房、真實地理尺度、明顯年代差異、電影感光影、可操作介面。
- Build 通過、互動驗收完成、未發現阻斷性錯誤；來源及授權清楚，歷史推估與現況分離。
- 更新 README、資料來源、開發紀錄與已知限制；分階段 commit，更新 PR #5，確認 CI 狀態。
- 未達門檻不合併。達標後依使用者授權及專案流程合併 main，驗證 GitHub Actions 與正式網址 `https://goyihuang.github.io/TWtimes/tainan.html`。不要宣稱尚未實測的網址可用。

## 7. 臺南完成後：全臺 MAP V2

建立統一 `scene-registry.json`（或等效模組），每個地景新增一筆資料即可同步出現在地圖、圖鑑、時間軸。保留現有品牌、深綠／象牙白／暖金的歷史攝影編輯風格。

資料欄位：`id, name, nameEn, aliases, city, district, lat, lng, tags, eras, thumbnail, summary, sources, license, entry, status, confidence`。未知座標以 null 表示，不猜測；未完成場景標示開發中，不連到不存在的正式頁面。

- MAP：全臺22縣市及離島，拖曳縮放、地景標記群聚、點擊預覽與進入3D；可考慮 MapLibre GL JS（新增依賴前確認版本及授權）。
- ATLAS：縮圖圖鑑、縣市、分類、多標籤、建築狀態、完成狀態篩選。
- TIME：清領、日治、戰後、現代及未來規劃；選定年代顯示具備對應場景的地景。不要把所有年代區間視為每年皆有模型。
- 搜尋：臺／台正規化、歷史名稱、別名、關鍵字、模糊搜尋；如使用 Fuse.js，先確認依賴。多標籤篩選語意清楚，可清除。
- 主題：臺灣鐵道百年、消失的神社、百貨與商業、城門城牆、港口、公共建築。
- 三模式共用篩選狀態；返回地圖保留位置，手機底部資訊面板。首頁只載入輕量索引，不預載所有 Three.js 模型。
- 中研院 WMTS 歷史圖層：先查 GetCapabilities、CORS、CRS/TileMatrixSet、圖資覆蓋範圍、服務限制及授權；支援透明度疊圖、古今滑桿、年代選單。非商業授權不可直接用於商業產品。
- 參考介面：https://tools.oyasumi-gamedev.com/rokehan/ （先實際查看，先前未成功讀取，不假定其功能）。
- 後續地景：基隆、新竹、嘉義、花蓮、臺東車站、彰化扇形車庫、鹿港、臺南州廳、哈瑪星、離島聚落等；只是候選，非已完成。

## 8. Codex 工作與交接規則

每輪先讀實際 repository 狀態，再直接做最高優先未完成事項。不重做已完成資產；遇到無法取得的史料，標明推估與缺口，先完成可驗證部分。不要為了華麗犧牲地理與歷史正確性。禁止假造測試、截圖、史料、發布成功或模型成果。

每次工作結束更新 `docs/` 內的進度文件（若已有既定交接文件則沿用），記錄：本次修改、檔案、commit、資料來源、實測結果、畫面截圖、剩餘工作、已知問題、下一步。不要只回報計畫；交付可檢查的程式與成果。

### 貼給 Codex 的啟動指令

> 請讀取本份 TWtimes_Codex_HANDOFF.md，先檢查本機及 GitHub 最新狀態，接續 feat/tainan-station 與 PR #5。以臺南車站正式可發布品質為優先，依 P0–P6 實際執行，先完成真實 OSM、歷史考證及高精度站房，再改善街區、互動及光影。必須運行、測試、修復並提供真實畫面證據；保留所有既有場景。達發布門檻後依授權完成部署並驗證。臺南完成後再依第7節進行全臺 MAP V2。不要只提供方案，不要重做已完成項目。

## 9. 本文件限制

本文件依截至 2026-11-27 的對話與當時 GitHub 工具回傳整理，未在產出本文件時重新抓取 repository 或查驗歷史資料、圖資授權、正式網站及 CI 最新狀態。當時實際 OSM 檔、精細 Blender GLB、完整瀏覽器測試與發布均未完成；若已有更新，以最新實際程式與測試為準。本文件不包含模型或圖資檔本身。

## 10. 2026-11-27 臺南實作檢查點
本機實際 Git 工作樹位於 Downloads/新增資料夾/TWtimes。已 fetch 並核對 PR #5 為 draft，起點 ef5b48a；main 為 49682e0。使用既有 scripts/fetch-osm.mjs 匯入 bbox 120.2092,22.9938,120.2164,23.0004，共 1117 筆，僅作現代底圖。OSM attribution 與日期在 JSON。
Blender 5.3 實際輸出兩組門廊部件，腳本 tools/blender/tainan_station.py；樓高、柱距、門廊尺寸為視覺推估。GLB 經 GLTFLoader 附加到原程序站體。調整正面樹列避免遮蔽入口。站房仍需原圖定尺與完整建模。
Node 24、暫存官方 npm CLI 11.6.2 執行 ci、Vite build 成功。本機 Chrome 開啟 dist/tainan.html，1936 畫面及 OSM 載入狀態已核對，截圖 docs/tainan-1936-preview.jpg。此為開發圖。年代交互回歸、手機、地圖對位、歷史街廓、陰雨與夜景、P5 全套測試尚待完成。PR 保持草稿，未部署。MAP V2 待臺南驗收後進行。
史料：鐵道局 1936 二代站房材料說明 https://www.rb.gov.tw/zh-TW/main/main_188/news/main_347/20260910_210407/ ；2026 年10月17日第一階段通車與後續地面復舊工程 https://www.rb.gov.tw/zh-TW/main/main_188/news/main_347/20261019_105610/ 。以上為文字依據，未轉載館藏照片。
