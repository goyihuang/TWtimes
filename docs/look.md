# 畫面風格、紙雕彈起與短片輸出（2026-11-28）

使用者需求：評估 opengame、papercraft、Sprite Fusion、どこでもロケハン之後，同意的整套內容一次做完：rokehan 外連、移軸鏡頭、柔和陰影、年代調色表、線稿＋網點畫面模式、紙雕彈起動畫、9:16 短片輸出；畫面與匯出檔自動標示 OSM／OpenMapTiles 出處；街區資料在瀏覽器快取 7 天。

截圖：`docs/look/*.jpg`。

## 1. 參考工具評估結論

| 工具 | 授權 | 結論 |
|---|---|---|
| どこでもロケハン（MIYADAIKU／おやすみゲーム開発部） | 無 API、無原始碼；輸出可用於作品（含商用，須標出處），但原樣或稍改後當素材再配布／販售禁止。回應標頭 `frame-ancestors 'self' https://oyasumi-gamedev.com`，**iframe 嵌入會被瀏覽器擋下** | 不能嵌入、不取用它的臺灣資料。只做「在どこでもロケハン開啟此處」連結（新分頁）。資料來源與我們相同（OSM、OpenFreeMap、AWS 地形），線稿＋網點畫法由我們自己寫 |
| papercraft（xikhar） | MIT | 借做法：移軸微距鏡頭、柔和陰影、鉸鏈彈簧彈起、固定格式的短片輸出。沒有複製它的程式 |
| opengame（nexu-io） | Apache 2.0 | AI 小遊戲工作室，方向不合，不採用 |
| Sprite Fusion（Game Dev Atlas、像素 MCP） | MCP 付費點數，頁面無產出授權說明 | 不採用；只借「Color Lookup 調色表」概念，自己生成 LUT |

## 2. 功能（共用面板「片場工具」內）

所有用 `src/yuanshan/post.js` 後製的場景都有：全臺立體地景、現代街景、臺南驛前、安平・大員。app.js 舊場景（臺中、彰化、臺北、高雄）與圓山暫無。

| 功能 | 說明 | 分享網址參數 |
|---|---|---|
| 畫法 | 彩色／彩色＋線稿／線稿／線稿＋網點。線條取自另畫的一張法線＋深度圖（Sobel：深度二次差找輪廓、法線差找折角）；網點為 45° 網格，點的大小依暗度，很暗處塗黑（ベタ）。天空、地名、半透明物件不描邊 | `draw`、`lw`（線寬）、`tone`（網點大小 px） |
| 年代調色表 | 3D LUT（32³，程式生成）：原色、清末手彩照片、日治銀鹽（褐調）、戰後褪色正片、八〇年代彩色負片、今日數位；「依年代自動」依目前年代年份選（<1905、<1950、<1975、<2000、之後） | `lut`（`auto` 或鍵名）、`la`（強度） |
| 移軸微距 | 上下模糊、中間清楚，可調對焦高度；街區看起來像桌上的模型 | `tilt`、`tf` |
| 柔和陰影 | 太陽陰影 PCF 取樣半徑 1 → 9 texel，濃度降 22% | `soft` |
| 紙雕彈起（全臺地景） | 圖磚載入時，建物與樹從焦點往外依序彈起（彈簧過衝約 5% 後定住，每棟 0.85 秒）；「重播彈起」可拍開場。陰影跟著長。開關與減少動態效果設定連動 | `pop=0` 關閉 |
| 短片 | 比例 9:16（1080×1920）、4:5、1:1、16:9；運鏡：緩緩環繞、推近、升空拉遠、定鏡；4–30 秒；可加「彈起開場」「縮時（3 小時）」。錄影時畫布改成目標比例並提高像素比，畫完一幀就複製到輸出畫布並蓋出處；支援 MP4 的瀏覽器（新版 Chrome、Edge、Safari）錄 MP4，否則 WebM | — |
| どこでもロケハン | 只開新分頁：`#ll=緯度,經度&s=範圍&tod=時段&n=名稱`；時段依目前時刻（傍晚 dusk、夜 night、深夜 late），範圍取最接近的 100–1000 m | — |

## 3. 出處標示

- 場景 API 提供 `credits`：全臺地景「© OpenStreetMap contributors（ODbL）　© OpenMapTiles　地形 Mapzen／AWS Terrain Tiles」；現代街景「© OpenStreetMap contributors（ODbL）」；臺南、安平「街廓 © OpenStreetMap contributors（ODbL）」。
- 自動帶上的地方：畫面右下（`#creditLine`）、快門照片、今昔並排、短片每一幀、匯出 GLB 的 `asset.copyright`（glTF 2.0 標準欄位，Blender 匯入後在場景屬性可看到）。
- 程式：`src/shared/credits.js`（`stampCredits`、`showCredits`、`stampGLB`、`rokehanURL`）。

## 4. 快取

- 全臺地景的向量圖磚與地形圖磚：`tile-worker.js` 寫入 Cache Storage `twtimes-tiles-v1`，7 天有效；每次開啟全臺地景 8 秒後清掉過期項目與超過 3,000 筆的最舊項目（`sources.js` 的 `pruneTileCache`）。
- 現代街景的 Overpass 結果原本就快取 7 天（`src/streetscape/osm.js`）。

## 5. 程式

| 檔案 | 內容 |
|---|---|
| `src/shared/look.js` | LUT 生成（`lutData`、`lutForYear`）、移軸、線稿＋網點通道、柔和陰影；`installLook(post, api)` 插到後製組合器（輸出之後、膠彩與時代調色之前） |
| `src/shared/clip.js` | 短片錄影（`recordClip`、運鏡 `movePose`、格式 `pickMime`） |
| `src/shared/credits.js` | 出處、GLB 寫入出處、どこでもロケハン連結 |
| `src/world/pop.js` | 紙雕彈起著色器（建物每頂點 `pop`、樹每實例 `aPop`）與陰影深度材質 |
| `src/shared/scene-tools.js` | 面板 UI：畫面風格、短片、どこでもロケハン |

## 6. 測試

- `tests/look-tools.test.mjs`（併入 `npm test`）：LUT 恆等與範圍、依年代選表、網址參數來回、GLB 寫入出處後結構正確、どこでもロケハン連結、運鏡起訖、彈簧曲線。
- `tests/look-e2e.mjs`（需 `npm run build` 與 `npx vite preview --port 4173`）：無頭 Chromium 截各畫法、移軸、柔和陰影、彈起中途、錄 4 秒 9:16 短片並下載、臺南依年代自動調色。

## 7. 已知限制

- 線稿是螢幕空間描邊：極遠處與很細的物件線條會斷續；紙雕彈起期間線稿取的是完整高度。
- 柔和陰影是 PCF 加大半徑，不是接觸硬化（PCSS）；半徑很大時陰影邊有細顆粒。
- 錄影解析度受顯示卡限制：低階裝置錄 9:16 會掉幀，可先降「遠近細緻度」。無頭測試環境（軟體繪圖）只驗證錄得出 1080×1920 MP4、每幀右下有出處；軟體繪圖一幀要數秒，所以測試錄到的幀數很少，要在真的瀏覽器看流暢度。
- 舊場景（app.js）與圓山尚未接上畫面風格與短片。
