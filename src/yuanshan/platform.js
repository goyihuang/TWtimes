// 圓山・劍潭接到首頁共用框架與共用場景面板（與臺南相同）。
import { mountScenePanel, showLoadError } from '../shared/scene-panel.js';
import { setupModuleFrame } from '../shared/platform-frame.js';
const el = id => document.getElementById(id);

const canvas = setupModuleFrame({ key: 'yuanshan', heading: '圓山・劍潭', cityEn: 'TAIPEI CITY · TAIWAN', english: 'MARUYAMA · KENTAN', canvasLabel: '圓山劍潭立體場景：拖曳旋轉、右鍵平移、滾輪縮放' });
const panel = mountScenePanel({ title: '圓山・劍潭', en: 'MARUYAMA · KENTAN' });
el('loading').hidden = false; el('loading').textContent = '圓山・劍潭　準備中…';
let api;
try {
  const { createYuanshan } = await import('./main.js');
  api = await createYuanshan(canvas, panel.ui);
} catch (err) { showLoadError('圓山・劍潭', err); throw err; }
window.yuanshan = api;
panel.bind(api);
// 時代切換後，面板上的開關（氛圍、筆觸）可能被引擎改動
const setEra = api.setEra; api.setEra = i => { setEra(i); panel.sync(); };

el('sourceBtn').onclick = () => openDialog('MARUYAMA · KENTAN', '圓山・劍潭：資料來源', '<div class="prose"><p>依舊照、繪葉書、鄉原古統〈明治橋遠眺〉、吉田初三郎鳥瞰圖與航照重建的示意場景，非精確史實。程序化重建，未內嵌館藏影像。</p><p>地形、河道與建物位置以現代地圖推估；各時代的依據與可信度見右側「重建依據與可信度」。</p></div>');
el('help').onclick = () => openDialog('CAMERA', '圓山取景', '<div class="prose"><p>拖曳旋轉、右鍵平移、滾輪縮放；數字鍵 1–4 或 ← → 切換時代，P 拍照，G 膠彩筆觸，H 純畫面。「時代氛圍」開啟時，切換時代會一併套用該時代的時刻與天氣。</p></div>');
