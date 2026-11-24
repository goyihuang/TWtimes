# 今昔時空 TWtimes

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
