// 首頁導覽卡：網站根目錄打開時，3D 街景已在背後載入，這張卡只介紹怎麼換景點與開地圖。
// 點畫面任何地方或「開始探索」就收起；精選景點取自 scene-registry.json 的 home.featured。
import { sceneHref } from './registry.js';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function showWelcome() {
  const viewer = document.getElementById('viewer'); if (!viewer) return;
  let reg = null; try { reg = await fetch(new URL('data/scene-registry.json', document.baseURI)).then(r => r.json()); } catch { }
  const scenes = reg?.scenes || [], live = scenes.filter(s => s.status === 'live').length;
  const featured = (reg?.home?.featured || []).map(id => scenes.find(s => s.id === id)).filter(Boolean).filter(s => s.id !== reg?.home?.scene);
  const card = document.createElement('section');
  card.className = 'home-welcome'; card.setAttribute('aria-label', '首頁導覽');
  card.innerHTML = `
    <div class="hw-kicker">今昔街影・FORMOSA STREET ATLAS</div>
    <h2>走進臺灣的街，<br>在同一個鏡位切換今昔。</h2>
    <p>眼前是<b>臺南驛前</b>：拖曳轉動、下方切換年代。${live} 處 3D 今昔景點，加上 ${scenes.length - live} 處可直接看現代街景的候選地，都在上方的景點列與<b>景點目錄</b>（Ctrl＋K）。</p>
    ${featured.length ? `<div class="hw-picks">${featured.map(s => `<a href="${esc(sceneHref(s))}"><img src="${esc(s.thumbnail)}" alt="" loading="lazy"><span>${esc(s.name.replace(/[・·].*$/, ''))}</span></a>`).join('')}</div>` : ''}
    <div class="hw-actions"><button class="hw-go" type="button">開始探索</button><button class="hw-dir" type="button">景點目錄</button><a href="./map.html">全臺地圖 ↗</a></div>`;
  viewer.append(card);
  const close = () => { card.classList.add('out'); setTimeout(() => card.remove(), 260); };
  card.querySelector('.hw-go').onclick = close;
  card.querySelector('.hw-dir').onclick = () => { close(); window.__switcher?.open(); };
  document.getElementById('stage')?.addEventListener('pointerdown', close, { once: true });
}
