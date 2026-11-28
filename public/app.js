'use strict';
const $=id=>document.getElementById(id),icon=id=>'<svg aria-hidden="true"><use href="#'+id+'"/></svg>';
const places=[
 {name:['臺中驛','臺中舊站'],district:'臺中車站與站前廣場',en:'TAICHŪ STATION',key:'station',camera:[20,9.7,158],walk:[43,131.6]},
 {name:['綠川・新盛橋','綠川・中山綠橋'],district:'綠川河岸',en:'GREEN RIVER',key:'river',camera:[-170,16,126],walk:[-143.4,106.7]},
 {name:['第一市場','東協廣場'],district:'第一市場街區',en:'FIRST MARKET',key:'market',camera:[-147,50,31],walk:[-116.2,-25.2]},
 {city:'changhua',name:['彰化驛','彰化車站'],district:'彰化車站與站前廣場',en:'CHANGHUA STATION',key:'changhua',camera:[56,7.6,225],walk:[29,204],look:[-9,5.5,196]},
 {city:'changhua',name:['彰化機關庫','彰化扇形車庫'],district:'彰化扇形車庫',en:'CHANGHUA ROUNDHOUSE',key:'roundhouse',camera:[182,9.7,-220],walk:[184,-253.5],look:[164,3.6,-275]},
 {city:'taipei',name:['臺北第三代站房','臺北車站'],district:'臺北車站與館前路口',en:'TAIPEI MAIN STATION',key:'taipei',camera:[-261,17.5,107],walk:[-231,89],look:[-100,10,8],era:1970,thumb:'scene-taipei'},
 {city:'kaohsiung',name:['高雄驛','高雄車站'],district:'高雄車站與站前廣場',en:'KAOHSIUNG STATION',key:'kaohsiung',camera:[-23,11.6,79],walk:[-10,43],look:[0,12,-10],era:1940,thumb:'scene-kaohsiung'}
];
let index=0,modern=true,walking=false,wide=false,dirty=true,renderer,scene,camera,sun,worlds=[],mapState,drag,focus={x:0,y:5,z:0},distance=60,theta=0,elevation=.24,heading=0,pitch=0,eye={x:0,z:0},toastTimer,photos=[],ready=false;
let arcadeLens=false,entranceLens=false,plazaLens=true, crowdTime=0, crowdMoving=!matchMedia('(prefers-reduced-motion: reduce)').matches, stageVisible=true;
try{const saved=localStorage.getItem('street-atlas-motion');if(saved!==null)crowdMoving=saved==='on'}catch{}
function placeTitle(){if(isTaipei())return tpActive().name;if(index===0&&arcadeLens)return modern?"臺中站前・騎樓舊址視角":"臺中驛・騎樓望站房";return index===0&&plazaLens?(entranceLens?(modern?'高架站入口':'舊線站場'):(modern?'臺中車站':'臺中驛站區')):places[index].name[+modern]}
function updateMotion(){$('crowdMotion').textContent=crowdMoving?'暫停行人':'繼續行走';$('crowdMotion').setAttribute('aria-pressed',String(crowdMoving))}
$('crowdMotion').onclick=()=>{crowdMoving=!crowdMoving;try{localStorage.setItem('street-atlas-motion',crowdMoving?'on':'off')}catch{}updateMotion();dirty=true};
updateMotion();
for(const button of ['plazaView','entranceView','heritageView'])$(button).onclick=()=>{if(arcadeLens)walking=false;arcadeLens=false;entranceLens=button==='entranceView';plazaLens=button!=='heritageView';choose(0)};
function enterArcade(){
  if(!ready)return;
  arcadeLens=true;plazaLens=false;entranceLens=false;walking=true;
  setEra(false);choose(0);
}
$('arcadeView').onclick=enterArcade;
$('arcadeStudy').onclick=()=>openDialog('VISUAL STUDY','臺中驛・騎樓望站房','<figure class="arcade-study"><img src="taichu-arcade-study.jpg" alt="站在騎樓下看向臺中驛的 AI 寫實概念圖"><figcaption>依老明信片製作的 AI 概念圖。店面、人物與光線為情境推估。關閉可回到相同 3D 鏡位。</figcaption></figure>');
function setArcadePose(){
  const station=worlds[+modern].userData.stationObject;
  const pos=station.localToWorld(new THREE.Vector3(22,1.63,53.35));
  const aim=station.localToWorld(new THREE.Vector3(-5,7.7,4.2));
  focus={x:aim.x,y:aim.y,z:aim.z};eye={x:pos.x,z:pos.z};
  const offset=pos.clone().sub(aim);distance=offset.length();
  theta=Math.atan2(offset.x,offset.z);elevation=Math.asin(offset.y/distance);
  heading=Math.atan2(-offset.x,-offset.z);pitch=-elevation;
  if(walking)camera.fov=53;
}
function syncArcadeLink(url){
  if(index===0&&arcadeLens){url.searchParams.set('view','arcade');url.searchParams.set('era',modern?'now':'past')}
  else if(url.searchParams.get('view')==='arcade'){url.searchParams.delete('view');url.searchParams.delete('era')}
  if(isTaipei())url.searchParams.set('generation',modern?5:tpPast);else url.searchParams.delete('generation');
  if(!(index===0&&arcadeLens)&&!isTaipei()&&url.searchParams.has('era'))url.searchParams.set('era',modern?'now':'past');
  if(window.streetAtlas?.restored)for(const k of ['shot','cam','walk'])url.searchParams.delete(k);
  history.replaceState(null,'',url);
}
window.addEventListener('street-texture-ready',()=>{dirty=true});
const cachedDistricts=new Map();
const cityOf=i=>places[i].city||'taichung';
const cities={
  taichung:{map:window.GEODATA,title:'臺中舊城',name:'臺中',en:'TAICHUNG'},
  changhua:{map:window.CHANGHUA,title:'彰化鐵道街區',name:'彰化',en:'CHANGHUA'},
  taipei:{map:window.TAIPEI,title:'臺北站前',name:'臺北',en:'TAIPEI'},
  kaohsiung:{map:window.KAOHSIUNG,title:'高雄站前',name:'高雄',en:'KAOHSIUNG'}
};
const activeMap=()=>cities[cityOf(index)].map;
const cityTitle=()=>cities[cityOf(index)].title;
const pastYear=()=>places[index].era||1930;
let tpPast=3;
const isTaipei=()=>places[index].key==='taipei';
const tpActive=()=>TAIPEI_GENERATIONS[(modern?5:tpPast)-1];
const pastLabel=()=>isTaipei()?TAIPEI_GENERATIONS[tpPast-1].period:pastYear()+' 年代';
TAIPEI_GENERATIONS.forEach((r,i)=>$('tpGeneration').append(new Option(r.year+'　'+r.name,i+1)));
function showTaipeiStation(){
  const historical=worlds[0],stations=historical?.userData.taipeiStations;
  if(!stations)return;
  for(const [n,station] of stations)station.visible=n===tpPast;
  const {early,postwar}=historical.userData.stationCrowds,record=TAIPEI_GENERATIONS[tpPast-1];
  early.group.visible=tpPast<=2;postwar.group.visible=tpPast>=3;
  if(early.group.visible)early.group.position.set(record.x,0,record.z);
  else postwar.group.position.set(record.x+199,0,record.z-11);
  historical.userData.people=early.group.visible?early:postwar;
}
function frameTaipei(wide=false){
  const r=tpActive(),[dx,y,dz]=r.offset,factor=wide?1.55:1;
  aimStation([r.x+dx*factor,wide?r.height+dz*.54:y,r.z+dz*factor],[r.x,r.height,r.z]);
}
function changeTaipei(n){
  if(!ready||!isTaipei()||n===(modern?5:tpPast))return;
  const previous=tpActive();
  window.atlasWorkshop?.beforeEra();
  if(n<5)tpPast=n;
  modern=n===5;
  worlds.forEach((w,i)=>w.visible=i===Number(modern));
  showTaipeiStation();
  if($('tpFollow').checked){
    const next=tpActive();
    const scale=Math.hypot(next.offset[0],next.offset[2])/Math.hypot(previous.offset[0],previous.offset[2]);
    focus={x:next.x+(focus.x-previous.x)*scale,y:next.height+(focus.y-previous.height)*scale,z:next.z+(focus.z-previous.z)*scale};
    eye={x:next.x+(eye.x-previous.x)*scale,z:next.z+(eye.z-previous.z)*scale};
    distance*=scale;
  }
  syncArcadeLink(new URL(location.href));
  updateLabels();window.atlasWorkshop?.eraChanged();dirty=true;
}
$('tpGeneration').onchange=e=>changeTaipei(Number(e.target.value));
const bookmarks={taichung:0,changhua:3,taipei:5,kaohsiung:6};
function browsePlace(i){if(!ready)return;if(window.atlasWorkshop?.active())$('browseTab').click();choose(i)}
for(const city of Object.keys(cities)){
  $(city+'City').onclick=()=>browsePlace(bookmarks[city]);
  const group=document.createElement('optgroup');group.label=cities[city].name;
  places.forEach((p,i)=>{if(cityOf(i)===city)group.append(new Option(p.district,i))});
  $('destination').append(group);
}
$('destination').onchange=e=>browsePlace(Number(e.target.value));
$('tpWide').onclick=()=>{
  if(cityOf(index)==='kaohsiung') aimStation([57,73,107],[0,9,-46]);
  else frameTaipei(true);
};
$('tpClose').onclick=()=>{
  if(isTaipei()){frameTaipei();return}
  const kh=cityOf(index)==='kaohsiung';
  const aim=kh?[0,7,3]:modern?[11.5,15,4]:[-199,7,11];
  const pos=kh?[-12,3.3,42]:modern?[-79,11.5,129]:[-172,4,83];
  aimStation(pos,aim);
};
function aimStation(pos,aim){
  if(walking)setMode(false);
  focus={x:aim[0],y:aim[1],z:aim[2]};const dx=pos[0]-aim[0],dy=pos[1]-aim[1],dz=pos[2]-aim[2];
  distance=Math.hypot(dx,dy,dz);theta=Math.atan2(dx,dz);elevation=Math.asin(dy/distance);
  eye={x:pos[0],z:pos[2]};heading=Math.atan2(-dx,-dz);pitch=.07;dirty=true;
};
const drawer=$('dialog'), stage=$('stage'),mini=$('mini'), held=new Set(), landmarks=[...window.GEODATA.landmarks,...window.CHANGHUA.landmarks,...window.TAIPEI.landmarks,...window.KAOHSIUNG.landmarks];
const esc=s=>String(s).replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
try{photos=JSON.parse(localStorage.getItem('street-atlas-photos-v1')||'[]').filter(p=>typeof p.image==='string'&&p.image.startsWith('data:image/jpeg;base64,'))}catch{}
$('count').textContent=photos.length;
function toast(text){$('toast').textContent=text;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').textContent='',3300)}
function openDialog(en,title,body){$('dialogEn').textContent=en;$('dialogTitle').textContent=title;$('dialogBody').innerHTML=body;if(!drawer.open)drawer.showModal()}
$('close').onclick=()=>drawer.close();drawer.addEventListener('click',e=>{if(e.target===drawer){const r=drawer.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)drawer.close()}});
$('explore').onclick=()=>{if(drawer.open)drawer.close();stage.focus({preventScroll:true});$('viewer').scrollIntoView({block:'nearest'})};
const currentStationRecord='<article><h3>從站前看新、舊站</h3><p>高架站的大跨距鋼棚向廣場伸出，紅磚舊站仍在原址。可比較兩個屋頂的方向、廣場開口與舊站塔樓的位置。</p><p><a href="https://commons.wikimedia.org/wiki/File:Taichung_Old_%26_New_Station,_Aug_2024.jpg" target="_blank" rel="noreferrer">2024 年現地照片 · Ralff Nestor Nacor ↗</a>　<a href="https://www.rb.gov.tw/zh-TW/CREO/CREO_55/CREO_58/20250507_103214/" target="_blank" rel="noreferrer">鐵道局工程資料 ↗</a></p></article>';
function generationRecords(all){
  if(!all&&!isTaipei())return '';
  return (all?TAIPEI_GENERATIONS:[tpActive()]).map(r=>'<article><h3>'+r.year+'　'+esc(r.name)+'</h3><p>'+esc(r.note)+'</p><p class="credit">'+esc(r.reference)+'</p><a href="'+esc(r.source)+'" target="_blank" rel="noreferrer">公開史料 ↗</a></article>').join('');
}
function records(all){const rows=all?window.ARCHIVES||[]:(window.ARCHIVES||[]).filter(r=>r.id===places[index].key);return generationRecords(all)+((all||(modern&&index===0))?currentStationRecord:'')+rows.map(r=>'<article><h3>'+esc(r.title)+'</h3><div class="credit">'+esc(r.era)+'</div><figure><img loading="lazy" src="'+esc(r.image)+'" alt="'+esc(r.title)+'"><figcaption>'+esc(r.credit)+' <a target="_blank" rel="noreferrer" href="'+esc(r.source)+'">'+esc(r.sourceLabel||'館藏原件')+' ↗</a> '+esc(r.license)+'</figcaption></figure><p>'+esc(r.description)+'</p><p class="credit">'+esc(r.localReference)+'</p>'+(r.more?'<p><a target="_blank" rel="noreferrer" href="'+esc(r.more)+'">'+esc(r.moreLabel)+' ↗</a></p>':'')+'</article>').join('')}
$('plate').onclick=()=>openDialog('ARCHIVE PLATE',places[index].district,'<div class="prose">'+records(false)+'</div>');
$('notes').onclick=()=>openDialog('FIELD NOTES','時空手記','<div class="prose">'+records(true)+'</div>');
$('sourceBtn').onclick=()=>openDialog('SOURCES & METHOD','街景與資料來源','<div class="prose"><h3>街道如何對位</h3><p>臺北、臺中、彰化與高雄各自使用當地圖資。道路、建物輪廓、綠川和軌道使用同一套現代 OpenStreetMap 座標。建物高度依高度標記、樓層或估算值繪製。</p><p><a target="_blank" rel="noreferrer" href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors · ODbL</a>　<a href="geodata.js" download>臺中圖資</a>　<a href="changhua-map.js" download>彰化圖資</a>　<a href="taipei-map.js" download>臺北圖資</a>　<a href="kaohsiung-map.js" download>高雄圖資</a></p><h3>年代如何重建</h3><p>高雄以 1941、1948 年站前影像重建 1940 年代的帝冠站房，現代天棚外緣、開口與兩棟大樓依地圖定位。臺北五代站房含地下化臨時站，第一代及臨時站站址為概略定位。第三代呈現戰後的站前廣場。臺中與彰化以 1930 年代為基準。臺中驛的門廊、山牆與塔身參照照片，綠川與市場參照不同年份的日治影像。未見於照片的街屋、立面、樹木和商號為示意；歷史層沿用現代路網。高架站、月臺、軌道與廣場依現況圖資對位。屋架斷面、立面、樓高未標記處及人物動作為推估。鋪面、磚牆、屋瓦與植栽採用 <a href="https://polyhaven.com/license" target="_blank" rel="noreferrer">Poly Haven 實拍素材（CC0）</a>。 <a href="precinct-data.js" download>下載車站廣場圖資</a>。臺中天空取自 <a href="https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky" target="_blank" rel="noreferrer">Poly Haven 實拍全景（CC0）</a>。騎樓及站房表面部分細節依 AI 概念圖詮釋。</p>'+records(false)+'<p class="credit">3D 引擎採用 <a href="three-LICENSE.txt">Three.js (MIT)</a>。</p></div>');
$('help').onclick=()=>openDialog('CAMERA CONTROLS','操作說明','<div class="prose"><h3>環繞街景</h3><p>拖曳旋轉鏡位，使用滾輪、雙指捏合或 ＋／− 調整距離。按住 Shift 拖曳可平移。方向鍵可旋轉鏡頭。</p><h3>步行取景</h3><p>切換「步行」後拖曳轉頭，以 WASD、方向鍵或畫面上的箭頭沿地面移動。點選街景索引或地圖紅點可跳至其他街區。</p><h3>街屋工坊</h3><p>從「街屋工坊」選一棟街屋，可調整樓層、騎樓、材質、陽台與招牌。個人編輯以年代分別儲存。「匯出 Atlas 鏡位」會下載 Chisel API 用的 JSON，內含 1280 × 720 深度與相機參數。檔案在本機產生。</p><h3>同角度看今昔</h3><p>點選「昔」或「今」保留當前機位。「拍攝街景」會將照片存在本裝置，可在「我的攝影」下載。重設鏡位可回到街區起點。</p></div>');
function renderGallery(){const rows=photos.map((p,i)=>'<figure class="photo-card"><img src="'+p.image+'" alt="'+esc(p.title)+'"><div><b>'+esc(p.title)+'</b><a href="'+p.image+'" download="'+esc(p.title)+'-'+p.id+'.jpg">下載 JPG</a><button data-remove="'+i+'">移除</button></div></figure>').join('');openDialog('CONTACT SHEET','我的攝影',rows||'<div class="prose empty">'+icon('camera')+'尚無照片。選好鏡位後，按「拍攝街景」留下第一張。</div>');$('dialogBody').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{photos.splice(+b.dataset.remove,1);try{localStorage.setItem('street-atlas-photos-v1',JSON.stringify(photos))}catch{}$('count').textContent=photos.length;renderGallery()})}
$('gallery').onclick=renderGallery;
function updateLabels(){let place=places[index],era=modern?1:0;const city=cityOf(index);
$('cityHeading').textContent=cityTitle();$('cityEn').textContent=cities[city].en+' CITY · TAIWAN';
$('tpGenerations').hidden=!isTaipei();
if(isTaipei()){const r=tpActive();$('tpGeneration').value=String(modern?5:tpPast);$('tpNote').textContent=r.note;$('tpEvidence').href=r.source;
 const n=modern?5:tpPast;
 $('tpPreview').src='taipei-views/'+n+'-front.jpg';
 $('tpPreview').alt=r.name+(n===1?'棚口老照片':'站前情境重建圖');
 $('tpCompare').href='taipei.html?left='+(modern?tpPast:n)+'&right=5';
}
for(const key of Object.keys(cities))$(key+'City').setAttribute('aria-pressed',String(key===city));
$('destination').value=String(index);$('taipeiLenses').hidden=!['taipei','kaohsiung'].includes(city);$('tpWide').textContent=city==='kaohsiung'?'俯瞰站區':'站區全景';$('tpClose').textContent=city==='kaohsiung'?'近看帝冠站房':'近看本年代站房';$('old').querySelector('span').textContent=pastLabel();$('viewName').textContent=placeTitle();$('stationLenses').hidden=index!==0;$('plazaView').setAttribute('aria-pressed',String(plazaLens&&!entranceLens));$('entranceView').setAttribute('aria-pressed',String(entranceLens));$('heritageView').setAttribute('aria-pressed',String(!plazaLens&&!arcadeLens));$('arcadeView').setAttribute('aria-pressed',String(arcadeLens));$('arcadeStudy').hidden=!arcadeLens;$('viewYear').textContent=modern?'Present day':isTaipei()?tpActive().period:pastYear()+'s';$('viewEnglish').textContent=index===0&&modern&&plazaLens?'TAICHUNG STATION':place.en;$('old').setAttribute('aria-pressed',String(!modern));$('now').setAttribute('aria-pressed',String(modern));$('modelInfo').textContent=modern?'當代圖資 · 依地圖與影像重建':pastLabel()+'意象 · 依照片與現代街廓重建';$('places').innerHTML=places.map((p,i)=>cityOf(i)!==cityOf(index)?'':'<button class="place '+(i===index?'active':'')+'" aria-pressed="'+(i===index)+'" data-index="'+i+'"><span class="place-thumb" style="background-image:url('+ (p.thumb||(p.key==='roundhouse'?'scene-roundhouse':'archive-'+p.key))+'.jpg)"></span><span><strong>'+p.district+'</strong><small>'+p.en+'</small></span><span class="goto">'+(i===index?'●':'›')+'</span></button>').join('');$('places').querySelectorAll('button').forEach(b=>b.onclick=()=>choose(+b.dataset.index));if(landmarks[index])$('coord').textContent=landmarks[index].lat.toFixed(3)+'° N / '+landmarks[index].lon.toFixed(3)+'° E';if(isTaipei()){const r=tpActive();$('coord').textContent='約 '+(25.04775-r.z/111320).toFixed(3)+'° N / '+(121.517+r.x/100850).toFixed(3)+'° E'}$('orbitBtn').classList.toggle('on',!walking);$('walkBtn').classList.toggle('on',walking);$('orbitBtn').setAttribute('aria-pressed',String(!walking));$('walkBtn').setAttribute('aria-pressed',String(walking));$('walkControls').hidden=!walking;window.atlasWorkshop?.updateCaption();window.dispatchEvent(new Event('atlas-change'))}

function choose(i){
 if(!places[i])return;shotNo=0;
 if(i!==0&&arcadeLens){arcadeLens=false;walking=false;camera.fov=44}
 const nextCity=cityOf(i),changed=worlds!==cachedDistricts.get(nextCity);
 if(changed&&worlds.length){window.atlasWorkshop?.resetSelection();worlds.forEach(w=>scene.remove(w))}
 index=i;bookmarks[nextCity]=i;
 if(ready&&changed){
   const dome=scene.getObjectByName("skyBackdrop");dome.material.map=(dome.userData.skies[nextCity]||dome.userData.skies.changhua);
   const first=!cachedDistricts.has(nextCity);
   if(first)cachedDistricts.set(nextCity,[buildDistrict(false,activeMap()),buildDistrict(true,activeMap())]);
   worlds=cachedDistricts.get(nextCity);worlds.forEach((w,j)=>w.visible=j===Number(modern));scene.add(...worlds);
   if(first)window.atlasWorkshop?.start();
 }
 if(ready&&isTaipei())showTaipeiStation();
 if(ready){const url=new URL(location.href);url.searchParams.set('place',places[i].key);try{syncArcadeLink(url)}catch{}}
 const p=places[i],loc=landmarks[i];updateLabels();if(!loc)return;focus={x:i===1?-115:loc.x,y:i===0?5:i===2?14:4,z:i===1?82:loc.z};const plaza=i===0&&plazaLens;
if(p.look)focus={x:p.look[0],y:p.look[1],z:p.look[2]};
if(plaza)focus=entranceLens?{x:191,y:16,z:131}:{x:115,y:11.5,z:192};
const view=plaza?(entranceLens?[102,4.2,145]:[10,4.3,145]):p.camera;
let dx=view[0]-focus.x,dy=view[1]-focus.y,dz=view[2]-focus.z;distance=Math.hypot(dx,dy,dz);theta=Math.atan2(dx,dz);elevation=Math.asin(dy/distance);eye=index===0&&plazaLens?(entranceLens?{x:111,z:144}:{x:53,z:146}):{x:p.walk[0],z:p.walk[1]};heading=Math.atan2(focus.x-eye.x,focus.z-eye.z);pitch=.045;if(isTaipei())frameTaipei();if(i===0&&arcadeLens)setArcadePose();dirty=true;window.atlasWorkshop?.placeChanged()}
function setEra(next){if(!ready||modern===next)return;if(isTaipei()){changeTaipei(next?5:tpPast);return}window.atlasWorkshop?.beforeEra();modern=next;syncArcadeLink(new URL(location.href));worlds.forEach((w,i)=>w.visible=i===Number(modern));updateLabels();window.atlasWorkshop?.eraChanged();dirty=true}
$('old').onclick=()=>setEra(false);$('now').onclick=()=>setEra(true);
function setMode(value){if(walking===value)return;walking=value;held.clear();if(walking){const p=places[index];eye=index===0&&plazaLens?(entranceLens?{x:111,z:144}:{x:53,z:146}):{x:p.walk[0],z:p.walk[1]};heading=Math.atan2(focus.x-eye.x,focus.z-eye.z);pitch=.04;if(isTaipei()){const r=tpActive();eye={x:r.x+r.offset[0],z:r.z+r.offset[2]};heading=Math.atan2(r.x-eye.x,r.z-eye.z);pitch=Math.atan2(r.height-1.75,Math.hypot(r.offset[0],r.offset[2]))}if(index===0&&arcadeLens)setArcadePose()}updateLabels();dirty=true}
$('orbitBtn').onclick=()=>setMode(false);$('walkBtn').onclick=()=>setMode(true);$('resetView').onclick=()=>choose(index);
function zoom(n){if(!ready)return;if(walking)camera.fov=Math.max(24,Math.min(84,camera.fov+n*5));else distance=Math.max(12,Math.min(425,distance*Math.exp(n*.13)));dirty=true}
$('plus').onclick=()=>zoom(-1);$('minus').onclick=()=>zoom(1);
$('full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('viewer').requestFullscreen()}catch{wide=!wide;$('viewer').classList.toggle('mobile-full',wide);resize()}};
function move(dir,step=2){if(!walking){if(dir==='left')theta-=.09;if(dir==='right')theta+=.09;if(dir==='forward')elevation=Math.min(1.45,elevation+.06);if(dir==='back')elevation=Math.max(.055,elevation-.06)}else{let a=heading+({left:Math.PI/2,right:-Math.PI/2,forward:0,back:Math.PI}[dir]);let b=isTaipei()?[-930,-500,350,320]:activeMap().bounds;eye.x=Math.max(b[0],Math.min(b[2],eye.x+Math.sin(a)*step));eye.z=Math.max(b[1],Math.min(b[3],eye.z+Math.cos(a)*step))}dirty=true}
document.querySelectorAll('[data-move]').forEach(b=>{const dir=b.dataset.move;b.onpointerdown=e=>{b.setPointerCapture(e.pointerId);move(dir,.8);held.add(dir)};b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>held.delete(dir)});
const keyDirs={w:'forward',s:'back',a:'left',d:'right',ArrowUp:'forward',ArrowDown:'back',ArrowLeft:'left',ArrowRight:'right'};
stage.onkeydown=e=>{const k=keyDirs[e.key];if(k){e.preventDefault();if(walking)held.add(k);else move(k)}};window.addEventListener('keyup',e=>held.delete(keyDirs[e.key]));window.addEventListener('blur',()=>held.clear());stage.onblur=()=>held.clear();
const touches=new Map();let lastPinch=0;
stage.onpointerdown=e=>{stage.focus({preventScroll:true});stage.setPointerCapture(e.pointerId);touches.set(e.pointerId,[e.clientX,e.clientY]);drag={x:e.clientX,y:e.clientY};lastPinch=0};
stage.onpointermove=e=>{if(!touches.has(e.pointerId))return;touches.set(e.pointerId,[e.clientX,e.clientY]);if(touches.size===2){let [a,b]=[...touches.values()],l=Math.hypot(a[0]-b[0],a[1]-b[1]);if(lastPinch>0&&l>1)zoom(Math.log(lastPinch/l)*7);lastPinch=l;return}
 if(!drag){drag={x:e.clientX,y:e.clientY};return}let dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag={x:e.clientX,y:e.clientY};if(walking){heading+=dx*.005;pitch=Math.max(-.95,Math.min(.95,pitch+dy*.004))}else if(e.shiftKey||e.buttons===2){let f=distance*.0018;focus.x+=(-dx*Math.cos(theta)-dy*Math.sin(theta))*f;focus.z+=(dx*Math.sin(theta)-dy*Math.cos(theta))*f}else{theta-=dx*.005;elevation=Math.max(.045,Math.min(1.49,elevation+dy*.004))}dirty=true};
stage.onpointerup=stage.onpointercancel=e=>{touches.delete(e.pointerId);drag=null;lastPinch=0};stage.oncontextmenu=e=>e.preventDefault();stage.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.sign(e.deltaY)*.7)},{passive:false});
function paintMap(){if(!window.GEODATA)return;const box=mini.getBoundingClientRect(),w=box.width,h=box.height;if(!w||!h)return;const dpr=Math.min(devicePixelRatio,2);mini.width=Math.round(w*dpr);mini.height=Math.round(h*dpr);let ctx=mini.getContext('2d');ctx.scale(dpr,dpr);const ch=cityOf(index)==='changhua',geo=activeMap();let k=ch?Math.min((w-70)/420,(h-25)/560):Math.min((w-36)/420,(h-21)/295),cx=ch?65:25,cz=ch?-26:76;if(cityOf(index)==='taipei'){cx=tpActive().x;cz=tpActive().z;k=Math.min((w-55)/440,(h-25)/270)}if(cityOf(index)==='kaohsiung'){cx=0;cz=-55;k=Math.min((w-38)/400,(h-14)/315)}const xy=([x,z])=>[w/2+(x-cx)*k,h/2+(z-cz)*k];mapState={xy,w,h};ctx.fillStyle='#e8e7d7';ctx.fillRect(0,0,w,h);function lines(rows,color,width){ctx.strokeStyle=color;ctx.lineCap='round';for(let r of rows){ctx.lineWidth=width(r);ctx.beginPath();r.points.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](...xy(p)));ctx.stroke()}}
 if(geo===window.KAOHSIUNG&&modern){
   ctx.fillStyle='#b5c1a5';ctx.beginPath();
   for(const ring of geo.canopy){ring.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](...xy(p)));ctx.closePath()}
   ctx.fill('evenodd');
 }
 ctx.fillStyle='#d6d8c6';for(let b of geo.buildings){if(geo===window.KAOHSIUNG&&!modern&&['1298938833','1298938834'].includes(b.id))continue;ctx.beginPath();b.points.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](...xy(p)));ctx.closePath();ctx.fill()}lines(geo.roads,'#faf8ed',r=>Math.max(.6,r.width*k*.75));if(isTaipei()&&!modern&&tpPast===1)lines(TAIPEI_FIRST_ROADS,'#faf8ed',r=>Math.max(1,r.width*k));lines(geo.water,'#96b5a7',r=>Math.max(2,r.width*k));if(ch)lines(geo.rails,'#9e9a88',()=>.7);landmarks.forEach((p,i)=>{if(cityOf(i)!==cityOf(index))return;let [x,y]=xy(i===5?[tpActive().x,tpActive().z]:[p.x,p.z]);ctx.beginPath();ctx.arc(x,y,i===index?5:4,0,Math.PI*2);ctx.fillStyle=i===index?'#a34b34':'#586f5d';ctx.fill();ctx.strokeStyle='#fff9eb';ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle='#394e40';ctx.font='bold 9px sans-serif';ctx.fillText(['臺中驛','綠川','市場','彰化站','車庫','臺北站','高雄站'][i],x+7,y+3)});if(cityOf(index)==='taichung'&&modern){const [x,y]=xy([199,132]);ctx.fillStyle='#456575';ctx.fillRect(x-3,y-3,6,6);ctx.font='bold 9px sans-serif';ctx.fillText('高架站',x-14,y-7)}if(camera&&ready){let [x,y]=xy([camera.position.x,camera.position.z]);let v=new THREE.Vector3();camera.getWorldDirection(v);let a=Math.atan2(v.z,v.x);ctx.beginPath();ctx.moveTo(x,y);ctx.arc(x,y,10,a-.4,a+.4);ctx.closePath();ctx.fillStyle='#8d443da8';ctx.fill()}}
mini.onclick=e=>{if(!mapState)return;let r=mini.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const q=mapState.xy([199,132]);if(cityOf(index)==='taichung'&&modern&&Math.hypot(q[0]-x,q[1]-y)<12){arcadeLens=false;entranceLens=true;plazaLens=true;choose(0);return}let options=landmarks.map((p,i)=>{let q=mapState.xy(i===5?[tpActive().x,tpActive().z]:[p.x,p.z]);return [Math.hypot(q[0]-x,q[1]-y),i]}).filter(row=>cityOf(row[1])===cityOf(index)).sort((a,b)=>a[0]-b[0]);if(options[0][0]<30)choose(options[0][1])};
function sky(){const cv=document.createElement('canvas');cv.width=2048;cv.height=512;let ctx=cv.getContext('2d'),grad=ctx.createLinearGradient(0,0,0,512);grad.addColorStop(0,'#7e9fb7');grad.addColorStop(.53,'#c5d7df');grad.addColorStop(.88,'#e3e8e6');grad.addColorStop(1,'#d6ded9');ctx.fillStyle=grad;ctx.fillRect(0,0,2048,512);
 // A periodic noise field keeps the cloud layer continuous at the panorama seam.
 const w=768,h=192,clouds=document.createElement('canvas');clouds.width=w;clouds.height=h;
 const cloudCtx=clouds.getContext('2d'),pixels=cloudCtx.createImageData(w,h);
 function noise(x,y,n){const hash=(i,j)=>{let v=Math.imul(((i%n+n)%n)+j*379,374761393);v=Math.imul(v^(v>>>13),1274126177);return ((v^(v>>>16))>>>0)/4294967296};
   const i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j,ax=u*u*(3-2*u),ay=v*v*(3-2*v);
   return (hash(i,j)*(1-ax)+hash(i+1,j)*ax)*(1-ay)+(hash(i,j+1)*(1-ax)+hash(i+1,j+1)*ax)*ay}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let value=0;for(const [k,weight] of [[5,.53],[10,.27],[20,.14],[40,.06]])value+=weight*noise(x/w*k,y/h*k*.64+9,k);
   const off=4*(y*w+x),p=pixels.data;p[off]=243;p[off+1]=244;p[off+2]=239;p[off+3]=Math.min(175,Math.max(0,(value-.26)*440))*Math.min(1,(h-y)/32)}
 cloudCtx.putImageData(pixels,0,0);ctx.drawImage(clouds,0,0,2048,512);
 const chCanvas=document.createElement('canvas');chCanvas.width=cv.width;chCanvas.height=cv.height;chCanvas.getContext('2d').drawImage(cv,0,0);
 const chSky=new THREE.CanvasTexture(chCanvas);chSky.colorSpace=THREE.SRGBColorSpace;
 const tx=new THREE.TextureLoader().load('textures/taichu-sky.jpg',()=>{dirty=true});
 tx.colorSpace=THREE.SRGBColorSpace;tx.wrapS=THREE.RepeatWrapping;tx.repeat.y=.525;tx.offset.set(-.27,.475);const dome=new THREE.SphereGeometry(1450,96,48),uv=dome.attributes.uv;for(let i=0;i<uv.count;i++)uv.setY(i,Math.max(0,(uv.getY(i)-.475)/.525));const s=new THREE.Mesh(dome,new THREE.MeshBasicMaterial({map:tx,side:THREE.BackSide,fog:false}));s.name="skyBackdrop";s.userData.skies={taichung:tx,changhua:chSky};s.position.y=0;scene.add(s);scene.background=new THREE.Color('#becfca')}
function resize(){if(!renderer)return;let w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();dirty=true}
function render(refreshMap=true){if(!renderer||!ready)return;const lensFov=lensMM?2*Math.atan(12/lensMM)*180/Math.PI:0;if(walking){camera.position.set(eye.x,1.75,eye.z);camera.lookAt(eye.x+Math.sin(heading)*Math.cos(pitch),1.75+Math.sin(pitch),eye.z+Math.cos(heading)*Math.cos(pitch))}else{const plaza=(index===0&&plazaLens||cityOf(index)!=='taichung')&&!window.atlasWorkshop?.active();camera.fov=plaza?THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(22))*Math.max(1,1.85/camera.aspect))):44;const fit=plaza?distance:distance*Math.max(1,1.32/camera.aspect);camera.position.set(focus.x+fit*Math.cos(elevation)*Math.sin(theta),focus.y+fit*Math.sin(elevation),focus.z+fit*Math.cos(elevation)*Math.cos(theta));camera.lookAt(focus.x,focus.y,focus.z)}if(lensFov)camera.fov=lensFov;camera.updateProjectionMatrix();let fx=walking?eye.x:focus.x,fz=walking?eye.z:focus.z;const light=climate.on?climate.offset:(window.atlasWorkshop?.light()||[-95,160,-70]);if(climate.rain)climate.rain.position.set(fx,0,fz);sun.position.set(fx+light[0],light[1],fz+light[2]);sun.target.position.set(fx,0,fz);renderer.render(scene,camera);if(refreshMap)paintMap();dirty=false}
let lastT=0,lastDraw=-Infinity;
function frame(t){
  const dt=Math.min(.08,(t-lastT)/1000);lastT=t;
  if(!document.hidden&&stageVisible&&!drawer.open){
    if(walking)held.forEach(dir=>move(dir,dt*8));
    if(climate.on&&climate.weather==='rain'){climate.fall(dt);dirty=true}
    if(crowdMoving)crowdTime+=dt;
    if(dirty||(crowdMoving&&t-lastDraw>=50)){
      worlds[Number(modern)].userData.people.update(crowdTime);
      render(dirty);lastDraw=t;
    }
  }
  requestAnimationFrame(frame);
}
function start(){try{if(!window.THREE||!window.GEODATA||!window.makeStation)throw Error('模型檔案未載入');renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;stage.append(renderer.domElement);scene=new THREE.Scene();scene.fog=new THREE.FogExp2('#d5dfe2',.0019);camera=new THREE.PerspectiveCamera(44,1,.3,2600);sky();scene.add(new THREE.HemisphereLight('#e7f2fc','#a39e8f',1.75));sun=new THREE.DirectionalLight('#fff1de',2.05);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-110,right:110,top:110,bottom:-110,near:1,far:380});sun.shadow.camera.updateProjectionMatrix();sun.shadow.normalBias=.035;sun.shadow.bias=-.00025;scene.add(sun,sun.target);ready=true;const query=new URLSearchParams(location.search),requested=query.get('place');if(requested==='taipei'&&/^[1-5]$/.test(query.get('generation'))){const n=Number(query.get('generation'));modern=n===5;if(!modern)tpPast=n}if(['past','now'].includes(query.get('era'))&&requested!=='taipei'&&query.get('view')!=='arcade')modern=query.get('era')==='now';if(requested==='station'&&query.get('view')==='arcade'){arcadeLens=true;plazaLens=false;walking=true;modern=query.get('era')==='now'}choose(Math.max(0,places.findIndex(p=>p.key===requested)));restoreShared(query);resize();render();$('loading').hidden=true;new ResizeObserver(resize).observe(stage);new IntersectionObserver(([e])=>{stageVisible=e.isIntersecting;if(stageVisible)dirty=true}).observe(stage);requestAnimationFrame(frame)}catch(e){console.error(e);$('loading').textContent='無法開啟立體街景。請使用支援 WebGL 的瀏覽器並開啟硬體加速。仍可在「時空手記」欣賞影像。';$('shutter').disabled=true;paintMap()}}
$('shutter').onclick=()=>{if(!ready)return;window.atlasWorkshop?.beforeEra();render();let src=renderer.domElement,out=document.createElement('canvas'),factor=Math.min(1,1500/src.width);out.width=Math.round(src.width*factor);const photoH=Math.round(src.height*factor),bar=Math.max(44,Math.round(out.width*.037));out.height=photoH+bar;const c=out.getContext('2d');c.drawImage(src,0,0,out.width,photoH);c.fillStyle='#f4f0e3';c.fillRect(0,photoH,out.width,bar);c.fillStyle='#2a3c31';let size=Math.max(11,Math.round(bar*.33)),title=(window.atlasWorkshop?.photoName()||placeTitle())+' · '+(modern?'當代':pastLabel()+'意象')+(window.atlasWorkshop?.hasEdits()?' · 自訂':'');c.font='bold '+size+'px serif';c.fillText(title,12,photoH+bar*.48);c.font=Math.max(8,Math.round(bar*.23))+'px sans-serif';c.fillText('今昔街影   /   © OpenStreetMap contributors',12,photoH+bar*.82);
 let shot={id:Date.now(),title,image:out.toDataURL('image/jpeg',.86)};photos.unshift(shot);let saved=true;try{localStorage.setItem('street-atlas-photos-v1',JSON.stringify(photos))}catch{saved=false} $('count').textContent=photos.length;const f=document.querySelector('.flash');f.classList.remove('fire');void f.offsetWidth;f.classList.add('fire');toast(saved?'已收藏於「我的攝影」':'本機空間已滿，請在「我的攝影」下載此張照片')};
const tainanOption=document.createElement('optgroup');tainanOption.label='臺南';tainanOption.append(new Option('臺南車站與站前廣場','tainan'));$('destination').append(tainanOption);
[...$('destination').querySelectorAll('optgroup')].find(g=>g.label==='臺北')?.append(new Option('圓山・劍潭','yuanshan'));
$('tainanCity').onclick=()=>location.assign('?place=tainan');
$('destination').onchange=e=>/^\d+$/.test(e.target.value)?browsePlace(Number(e.target.value)):location.assign('?place='+e.target.value);
const MODULE_PLACES=['tainan','yuanshan'];
if(!MODULE_PLACES.includes(new URLSearchParams(location.search).get('place'))){updateLabels();requestAnimationFrame(()=>setTimeout(start,0))}
window.saveTainanPhoto=(canvas,title)=>{
 photos.unshift({id:Date.now(),title,image:canvas.toDataURL('image/jpeg',.86)});
 try{localStorage.setItem('street-atlas-photos-v1',JSON.stringify(photos));toast('已收藏於「我的攝影」')}catch{toast('本機空間已滿，可在「我的攝影」下載')}
 $('count').textContent=photos.length;
};

// ── 共用場景介面（src/shared/legacy-bridge.js）需要的狀態與操作 ──
// 鏡位：每個地點都有「起始」與「鳥瞰／人眼」，再加上地點特有的鏡位。網址參數 shot、mm、cam 可還原。
let lensMM=0,shotNo=0;
const SHOT_SETS={
 station:[['站前廣場','plaza'],['高架站入口','entrance'],['舊站近看','heritage'],['1930 年代騎樓（人眼）','arcade'],['鳥瞰','aerial']],
 taipei:[['近看本年代站房','start'],['站區全景','wide'],['鳥瞰','aerial'],['人眼高度','eye']],
 kaohsiung:[['站前廣場','start'],['近看帝冠站房','close'],['俯瞰站區','wide'],['人眼高度','eye']],
 default:[['起始鏡位','start'],['鳥瞰','aerial'],['人眼高度','eye']]
};
const shotsFor=()=>SHOT_SETS[places[index].key]||SHOT_SETS.default;
function applyShot(n){
 if(!ready)return;const list=shotsFor(),kind=(list[n]||list[0])[1];
 if(['plaza','entrance','heritage'].includes(kind))$(kind+'View').click();
 else if(kind==='arcade')enterArcade();
 else if(kind==='wide')$('tpWide').click();
 else if(kind==='close')$('tpClose').click();
 else{if(arcadeLens){arcadeLens=false;camera.fov=44}if(index===0){plazaLens=true;entranceLens=false}if(walking)setMode(false);choose(index);
  if(kind==='aerial'){distance=Math.min(425,Math.max(140,distance*2.6));elevation=.8}
  if(kind==='eye')setMode(true)}
 shotNo=list[n]?n:0;dirty=true;updateLabels();
}
function eraCapture(m){
 const keep=modern;modern=m;worlds.forEach((w,i)=>w.visible=i===Number(m));if(isTaipei())showTaipeiStation();
 render(false);const src=renderer.domElement,c=document.createElement('canvas');c.width=src.width;c.height=src.height;c.getContext('2d').drawImage(src,0,0);
 modern=keep;worlds.forEach((w,i)=>w.visible=i===Number(keep));if(isTaipei())showTaipeiStation();render(false);return c;
}
function restoreShared(q){
 const n=Number(q.get('shot'));if(q.get('view')!=='arcade'&&q.has('shot')&&Number.isInteger(n)&&n>0&&n<shotsFor().length)applyShot(n);
 if(q.has('t')||q.has('w'))setClimate(q.has('t')?+q.get('t'):climate.hour,q.get('w')||climate.weather);
 const mm=Number(q.get('mm'));if(mm>=14&&mm<=135)lensMM=mm;
 const cam=(q.get('cam')||'').split(',').map(Number);
 if(cam.length===6&&cam.every(Number.isFinite)){
  const [px,py,pz,tx,ty,tz]=cam;
  if(q.get('walk')==='1'){if(!walking)setMode(true);eye={x:px,z:pz};heading=Math.atan2(tx-px,tz-pz);pitch=Math.atan2(ty-py,Math.hypot(tx-px,tz-pz))}
  else{if(walking)setMode(false);focus={x:tx,y:ty,z:tz};const dx=px-tx,dy=py-ty,dz=pz-tz;distance=Math.hypot(dx,dy,dz)||60;theta=Math.atan2(dx,dz);elevation=Math.asin(dy/distance)}
 }
 dirty=true;window.streetAtlas.restored=true;updateLabels();
}
window.streetAtlas={
 get ready(){return ready},
 get place(){return places[index]},
 get city(){return cityOf(index)},
 get isTaipei(){return isTaipei()},
 get modern(){return modern},
 get tpPast(){return tpPast},
 get walking(){return walking},
 get shot(){return index===0&&arcadeLens?3:shotNo},
 get mm(){return lensMM||Math.max(16,Math.min(105,Math.round(12/Math.tan((camera?camera.fov:44)*Math.PI/360))))},
 pastYear,
 shots:()=>shotsFor().map(([name])=>({name})),
 setShot:applyShot,
 setPast(){setEra(false)},setNow(){setEra(true)},
 setGeneration(n){changeTaipei(n)},
 toggleWalk(){setMode(!walking);return walking},
 setFocal(mm){lensMM=mm;dirty=true},
 get hour(){return climate.hour},get weather(){return climate.weather},
 setHour(h){setClimate(h,climate.weather)},setWeather(w){setClimate(climate.hour,w)},
 zoom(f){zoom(f<1?-1:1)},
 compare(){
  const a=eraCapture(false),b=eraCapture(true),out=document.createElement('canvas');out.width=a.width*2+12;out.height=a.height;
  const c=out.getContext('2d');c.fillStyle='#f4f0e3';c.fillRect(0,0,out.width,out.height);c.drawImage(a,0,0);c.drawImage(b,a.width+12,0);
  return {canvas:out,title:pastLabel()+' ↔ 當代 · '+places[index].district};
 },
 snapshot(){render(false);const src=renderer.domElement,c=document.createElement('canvas');c.width=src.width;c.height=src.height;c.getContext('2d').drawImage(src,0,0);return c},
 shareURL(){
  const u=new URL(location.href);u.searchParams.set('place',places[index].key);
  if(isTaipei())u.searchParams.set('generation',modern?5:tpPast);else u.searchParams.set('era',modern?'now':'past');
  if(index===0&&arcadeLens)u.searchParams.set('view','arcade');else u.searchParams.delete('view');
  if(shotNo&&!arcadeLens)u.searchParams.set('shot',shotNo);else u.searchParams.delete('shot');
  if(lensMM)u.searchParams.set('mm',lensMM);else u.searchParams.delete('mm');
  if(climate.on){u.searchParams.set('t',climate.hour.toFixed(2));u.searchParams.set('w',climate.weather)}else{u.searchParams.delete('t');u.searchParams.delete('w')}
  const p=camera.position,t=walking?{x:eye.x+Math.sin(heading)*5,y:1.75+Math.sin(pitch)*5,z:eye.z+Math.cos(heading)*5}:focus;
  u.searchParams.set('cam',[p.x,p.y,p.z,t.x,t.y,t.z].map(v=>v.toFixed(1)).join(','));
  if(walking)u.searchParams.set('walk','1');else u.searchParams.delete('walk');
  return u.href;
 }
};

// ── 時刻與天氣（由臺中 1935 版移植）：使用者調整或網址帶 t、w 後才啟用，預設畫面不變 ──
const climate={on:false,hour:14.5,weather:'clear',offset:[-95,160,-70],rain:null,fall:()=>{}};
const WEATHER={clear:{sun:1,sky:1,fog:.0019},cloudy:{sun:.42,sky:.82,fog:.0026},rain:{sun:.2,sky:.6,fog:.0045},fog:{sun:.32,sky:.86,fog:.009}};
function makeRain(){
 const n=2400,pos=new Float32Array(n*6),seed=new Float32Array(n*3);
 for(let i=0;i<n;i++){seed[i*3]=(Math.random()-.5)*160;seed[i*3+1]=Math.random()*70;seed[i*3+2]=(Math.random()-.5)*160}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
 const lines=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:'#c9d3d8',transparent:true,opacity:.42,fog:false}));
 lines.frustumCulled=false;lines.visible=false;scene.add(lines);
 const place=()=>{for(let i=0;i<n;i++){const x=seed[i*3],y=seed[i*3+1],z=seed[i*3+2];pos.set([x,y,z,x+.18,y+1.3,z+.06],i*6)}g.attributes.position.needsUpdate=true};
 climate.fall=dt=>{for(let i=0;i<n;i++){seed[i*3+1]-=dt*22;if(seed[i*3+1]<0)seed[i*3+1]+=70}place()};place();
 return lines;
}
function setClimate(hour,weather){
 if(!ready)return;
 climate.on=true;climate.hour=((hour%24)+24)%24;climate.weather=WEATHER[weather]?weather:'clear';
 const w=WEATHER[climate.weather],h=climate.hour,arc=Math.PI*(h-6)/12,elev=Math.sin(arc);
 const day=THREE.MathUtils.clamp(elev*1.6+.12,0,1),low=1-THREE.MathUtils.clamp(elev*2.2,0,1);
 climate.offset=[-Math.cos(arc)*190,Math.max(18,elev*190),-70];
 sun.intensity=2.05*day*w.sun;sun.color.set('#fff1de').lerp(new THREE.Color('#ffb070'),low*day);
 const hemi=scene.children.find(o=>o.isHemisphereLight);
 hemi.intensity=1.75*(.16+.84*day)*(.75+.25*w.sky);hemi.color.set('#e7f2fc').lerp(new THREE.Color('#2b3550'),1-day);hemi.groundColor.set('#a39e8f').lerp(new THREE.Color('#1d2128'),1-day);
 const dome=scene.getObjectByName('skyBackdrop');
 dome.material.color.set('#ffffff').multiplyScalar(.18+.82*day*w.sky).lerp(new THREE.Color('#f2b48a'),low*day*.35*w.sun);
 const fogDay=new THREE.Color(climate.weather==='rain'?'#9aa4a9':'#d5dfe2');
 scene.fog.color.copy(fogDay).lerp(new THREE.Color('#1b2230'),1-day);scene.fog.density=w.fog;
 scene.background.copy(scene.fog.color);
 if(!climate.rain)climate.rain=makeRain();climate.rain.visible=climate.weather==='rain';
 dirty=true;window.dispatchEvent(new Event('atlas-change'));
}
