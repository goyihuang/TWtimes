'use strict';
(() => {
  const byId=id=>document.getElementById(id);
  const records=window.TAIPEI_GENERATIONS;
  const query=new URLSearchParams(location.search);
  const valid=n=>/^[1-5]$/.test(n);
  let left=valid(query.get('left'))?Number(query.get('left')):2;
  let right=valid(query.get('right'))?Number(query.get('right')):5;
  if(right===left)right=left===5?2:5;
  let angle=query.get('angle')||'front';
  let paired=query.get('mode')==='pair';
  let revision=0;
  const names={front:'站前',air:'鳥瞰',rail:'站場全景'};
  const slider=byId('split'),canvas=byId('canvas'),status=byId('status');
  for(const side of ['left','right']){
    records.forEach((r,i)=>byId(side).add(new Option(r.year+'　'+r.short,i+1)));
  }
  function setSplit(value){
    slider.value=value;
    canvas.style.setProperty('--split',slider.value+'%');
    slider.setAttribute('aria-valuetext','左圖 '+slider.value+'%，右圖 '+(100-slider.value)+'%');
  }
  setSplit(query.has('split')&&Number.isFinite(+query.get('split'))?+query.get('split'):50);
  function saveLink(){
    const url=new URL(location.href);
    url.search=new URLSearchParams({left,right,angle,mode:paired?'pair':'wipe',split:slider.value});
    history.replaceState(null,'',url);
  }
  function showRecord(side,n){
    const r=records[n-1],shot=angle==='rail'&&n!==3?'air':angle;
    const tag=byId(side+'Tag'),info=byId(side+'Info');
    tag.textContent=r.period+'　'+r.short;
    const gen=document.createElement('small'),title=document.createElement('h2'),note=document.createElement('p');
    gen.textContent=(side==='left'?'左圖':'右圖')+'　／　'+(n===1?'收藏老照片':'情境重建圖')+' · '+names[shot];
    title.textContent=r.name;
    note.textContent=r.note;
    const walk=document.createElement('a'),source=document.createElement('a');
    walk.href='./?place=taipei&generation='+n;walk.textContent='進入這一代的 3D 街景 ↗';
    source.href=r.source;source.textContent='查看史料 ↗';source.target='_blank';source.rel='noreferrer';
    info.replaceChildren(gen,title,note,walk,source);
    const img=byId(side+'Img');
    img.alt=r.name+'，'+(n===1?'棚口與鐵軌老照片':names[shot]+'情境重建');
    img.src='taipei-views/'+n+'-'+shot+'.jpg';
    return img.decode();
  }
  async function update(){
    const ticket=++revision;
    byId('left').value=left;byId('right').value=right;
    const first=left===1||right===1,third=left===3||right===3;
    const angleSelect=byId('angle');
    angleSelect.options[1].disabled=first;
    angleSelect.options[2].disabled=first||!third;
    if(!Object.hasOwn(names,angle)||first)angle='front';
    if(angle==='rail'&&!third)angle='air';
    angleSelect.value=angle;
    canvas.classList.toggle('pair',paired);
    byId('wipe').setAttribute('aria-pressed',String(!paired));
    byId('pair').setAttribute('aria-pressed',String(paired));
    byId('back').href='./?place=taipei&generation='+left;
    byId('hint').textContent=(paired?'兩張全圖依序呈現。':'左右拖曳，或用方向鍵移動分隔線。')+(first?'第一代位於大稻埕，使用棚口老照片。':'兩圖依站房構圖比較，拍攝位置與比例各異。');
    saveLink();
    status.textContent='載入影像中…';status.hidden=false;
    try{
      await Promise.all([showRecord('left',left),showRecord('right',right)]);
      if(ticket===revision)status.hidden=true;
    }catch{
      if(ticket===revision){status.textContent='影像載入失敗，';const retry=document.createElement('button');retry.textContent='重新載入';retry.onclick=update;status.append(retry)}
    }
  }
  byId('left').onchange=e=>{const n=+e.target.value;if(n===right)right=left;left=n;update()};
  byId('right').onchange=e=>{const n=+e.target.value;if(n===left)left=right;right=n;update()};
  byId('swap').onclick=()=>{[left,right]=[right,left];update()};
  byId('wipe').onclick=()=>{paired=false;update()};
  byId('pair').onclick=()=>{paired=true;update()};
  byId('angle').onchange=e=>{angle=e.target.value;update()};
  slider.oninput=()=>setSplit(slider.value);slider.onchange=saveLink;
  function drag(e){const b=canvas.getBoundingClientRect();setSplit(Math.round(100*(e.clientX-b.left)/b.width))}
  slider.onpointerdown=e=>{e.preventDefault();slider.focus({preventScroll:true});slider.setPointerCapture(e.pointerId);drag(e)};
  slider.onpointermove=e=>{if(slider.hasPointerCapture(e.pointerId))drag(e)};
  slider.onlostpointercapture=saveLink;
  slider.onpointerup=e=>{if(slider.hasPointerCapture(e.pointerId))slider.releasePointerCapture(e.pointerId)};
  byId('share').onclick=async()=>{saveLink();try{await navigator.clipboard.writeText(location.href);byId('share').textContent='已複製連結';setTimeout(()=>byId('share').textContent='複製此對照連結',1800)}catch{prompt('複製此對照連結',location.href)}};
  update();
})();
