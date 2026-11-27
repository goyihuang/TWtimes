const el=id=>document.getElementById(id);
document.body.classList.add('tainan-platform');
el('stage').innerHTML='<canvas id="scene" aria-label="臺南車站立體街景"></canvas>';
el('cityHeading').textContent='臺南驛前';el('cityEn').textContent='TAINAN CITY · TAIWAN';
el('viewEnglish').textContent='TAINAN STATION';el('destination').value='tainan';
for(const key of ['taichung','changhua','taipei','kaohsiung','tainan']){
 const b=el(key+'City');b.setAttribute('aria-pressed',String(key==='tainan'));
 if(key!=='tainan')b.onclick=()=>location.assign('?place='+({taichung:'station',changhua:'changhua',taipei:'taipei',kaohsiung:'kaohsiung'})[key]);
}
el('destination').onchange=e=>{if(e.target.value!=='tainan')location.assign('?place='+places[Number(e.target.value)].key)};
el('places').innerHTML='<strong>臺南車站與站前廣場</strong><p id="story"></p><label>鏡位<select id="shot"></select></label><label>天氣<select id="weather"></select></label><label>時刻 <output id="clock"></output><input id="hour" type="range" min="0" max="23.75" step=".25" value="15"></label><button id="share">複製場景網址</button><p id="status" role="status"></p><button id="photo" hidden></button>';
['站前正面','斜側街景','鳥瞰','鐵路側','門廊斜側','第一月臺位置'].forEach((v,i)=>el('shot').add(new Option(v,i)));
for(const [key,v] of Object.entries({clear:'晴天',cloudy:'多雲',rain:'雨天',fog:'霧天'}))el('weather').add(new Option(v,key));
document.querySelector('.time-switch').id='eras';el('eras').replaceChildren();
const {renderer,scene,camera,controls,eras,setShot}=await import('./main.js');
function caption(){const i=[...el('eras').children].findIndex(b=>b.getAttribute('aria-pressed')==='true');el('viewYear').textContent=eras[i][0];el('viewName').textContent=eras[i][1];el('modelInfo').textContent=eras[i][2]}
caption();el('eras').addEventListener('click',caption);
el('loading').hidden=true;
el('resetView').onclick=()=>setShot(+el('shot').value);
for(const [id,f] of [['plus',.82],['minus',1.22]])el(id).onclick=()=>{camera.position.sub(controls.target).multiplyScalar(f).add(controls.target);controls.update()};
el('shutter').onclick=()=>{renderer.render(scene,camera);window.saveTainanPhoto(el('scene'),el('viewYear').textContent+' · '+el('viewName').textContent)};
el('full').onclick=()=>document.fullscreenElement?document.exitFullscreen():el('viewer').requestFullscreen();
el('sourceBtn').onclick=()=>openDialog('TAINAN STATION','臺南站房與街區','<p>現代街區依 OpenStreetMap 資料對位。歷史站房參照落成影像，月臺柱距與棚架尺寸依照片推估。</p>');
el('help').onclick=()=>openDialog('CAMERA','臺南取景','<p>拖曳環繞、右鍵平移、滾輪縮放。從街景索引選鏡位，或按下方年代保留鏡頭比較。拍攝的畫面會存入我的攝影。</p>');

async function drawStationMap(){
 const data=await (await fetch('data/tainan-station.osm.json')).json();
 const map=el('mini'),ctx=map.getContext('2d');map.width=480;map.height=240;
 const point=([x,y])=>[(data.origin[0]+x*data.scale-120.2125815)*102400*.72+240,120-(data.origin[1]+y*data.scale-22.9971425)*110540*.72];
 ctx.fillStyle='#e6e3d3';ctx.fillRect(0,0,480,240);
 for(const [,tags,points] of data.ways){
  if(!tags.highway&&!tags.building)continue;
  ctx.beginPath();points.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](...point(p)));
  if(tags.building){ctx.fillStyle='#c5cbb9';ctx.fill()}else{ctx.strokeStyle='#faf8ed';ctx.lineWidth=tags.highway==='primary'?8:3;ctx.stroke()}
 }
 ctx.fillStyle='#a74e35';ctx.beginPath();ctx.arc(240,120,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#294537';ctx.font='18px sans-serif';ctx.fillText('臺南車站',250,125);
 el('coord').textContent='22.997° N / 120.213° E';map.setAttribute('aria-label','臺南車站現代街區定位');map.onclick=()=>setShot(+el('shot').value);
 document.body.classList.add('tainan-map-ready');
}
drawStationMap().catch(()=>{});
