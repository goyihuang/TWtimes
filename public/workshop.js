/* Per-building edits are stored independently for each era in this browser. */
(() => {
  'use strict';
  const storeKey = 'formosa-facades-v1';
  const curated = [
    ['1118931354','1118931344','1118931345'],
    ['1118937773','1118937772','1118937771'],
    ['674739984','654380124','654380125'],
    ['529613782','529613783','529613748'],
    ['533104107','533104108','533104109'],
    ['495593094','495593095','384799251']
  ];
  const styles = ['brick','tile','plaster'];
  const tones = {
    day:{offset:[-95,160,-70],sun:'#fff0d5',intensity:2.05,sky:'#fff8df',ambient:1.75},
    am:{offset:[140,65,-65],sun:'#ffe1b9',intensity:2.4,sky:'#e3edf4',ambient:1.28},
    pm:{offset:[-145,52,72],sun:'#ffc187',intensity:2.65,sky:'#f4e4db',ambient:1.12}
  };
  const select = $('shopList'), panel = $('editPanel');
  let active=false, selected=null, time='day', pendingFrame=0;
  let local={};
  try { local=JSON.parse(localStorage.getItem(storeKey)||'{}')||{} } catch {}
  const book=()=>worlds[Number(modern)].userData.buildings;
  const entryKey=(id,era=modern)=>(era?'now/':'old/')+id;
  const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
  function specification(info,era) {
    const seed=Number(info.data.id)%991;
    return {floors:clamp(Math.round(info.height/3.5),1,30),
      finish:era?styles[(seed%2)+1]:styles[seed%3===0?2:0],
      arcade:era?1.5:2,balcony:era||seed%3===1,
      sign:era?(info.data.name||['茶舖','布行','書店','餅舖'][seed%4]):['茶莊','米行','布莊','雜貨商行'][seed%4]};
  }
  function config(info,era) {
    const base=specification(info,era), saved=local[entryKey(info.data.id,era)];
    if(!saved||typeof saved!=='object')return base;
    return {floors:clamp(Math.round(Number(saved.floors)||base.floors),1,30),
      finish:styles.includes(saved.finish)?saved.finish:base.finish,
      arcade:Number.isFinite(saved.arcade)?clamp(saved.arcade,0,3):base.arcade,
      balcony:typeof saved.balcony==='boolean'?saved.balcony:base.balcony,
      sign:typeof saved.sign==='string'?saved.sign.slice(0,12):base.sign};
  }
  function hideOriginal(info) {
    const empty=new THREE.Matrix4().makeScale(0,0,0);
    for(const {mesh,range,instanced} of info.parts) {
      if(instanced) {
        for(let i=range.start;i<range.start+range.count;i++)mesh.setMatrixAt(i,empty);
        mesh.instanceMatrix.needsUpdate=true;
      } else {
        const positions=mesh.geometry.getAttribute('position');
        positions.array.fill(0,range.start*9,(range.start+range.count)*9);
        positions.needsUpdate=true;
      }
    }
  }
  function makeDetail(id,era,refresh=false) {
    const world=worlds[Number(era)], info=world.userData.buildings.get(id);
    if(!info||info.fixed)return null;
    if(info.detail&&!refresh)return info.detail;
    const next=window.makeShopHouse(THREE,info.data,config(info,era),era);
    next.traverse(o=>o.userData.shopId=id);
    if(info.detail) {world.remove(info.detail);window.disposeShopHouse(info.detail)}
    else hideOriginal(info);
    world.add(next);info.detail=next;dirty=true;
    return next;
  }
  function streetName(record) {
    if(record.streetName)return record.streetName;
    const p=record.data.points, x=p.reduce((s,q)=>s+q[0],0)/p.length, z=p.reduce((s,q)=>s+q[1],0)/p.length;
    let distance=Infinity,name='舊城街屋';
    for(const rd of activeMap().roads) {
      if(!rd.name||['footway','path','steps'].includes(rd.type))continue;
      for(let j=1;j<rd.points.length;j++) {
        const [a,b]=rd.points[j-1],[c,d]=rd.points[j],dx=c-a,dz=d-b;
        const t=clamp(((x-a)*dx+(z-b)*dz)/(dx*dx+dz*dz||1),0,1);
        const ds=(a+t*dx-x)**2+(b+t*dz-z)**2;
        if(ds<distance){distance=ds;name=rd.name}
      }
    }
    record.streetName=name;return name;
  }
  function listOptions() {
    const ids=[...new Set([...curated[index],selected])].filter(id=>id&&book().has(id)&&!book().get(id).fixed);
    select.replaceChildren(...ids.map((id,i)=>new Option(streetName(book().get(id))+' · 街屋 '+(i+1),id)));
    select.value=selected;
  }
  function fill() {
    const info=book().get(selected), v=config(info,modern);
    $('floors').value=v.floors;$('floorValue').textContent=v.floors+' 層';
    $('depth').value=v.arcade;$('depthValue').textContent=v.arcade+' m';
    $('finish').value=v.finish;$('balcony').checked=v.balcony;$('shopSign').value=v.sign;
    $('editStatus').textContent=(modern?'當代':pastLabel()+'意象')+' · '+(local[entryKey(selected)]?'此棟已有自訂設計':'可依你的取景需要調整街屋');
  }
  function caption() {
    if(!active||!selected)return;
    $('viewName').textContent=streetName(book().get(selected));
    $('viewEnglish').textContent='FACADE STUDY';
    $('modelInfo').textContent='街屋工坊 · 可編輯立面示意';
  }
  function frameFacade() {
    const detail=book().get(selected)?.detail;
    if(!detail)return;
    if(walking)setMode(false);
    const f=detail.userData.front;
    if(!f)return;
    const h=f.height,w=Math.min(28,f.width);
    const range=clamp(Math.max(13,h*1.5,w*.95),13,95);
    const direction=Math.atan2(f.nx,f.nz);
    focus={x:f.x,y:h*.42,z:f.z};
    // Try slight offsets along the street. Favour a clear view across a narrow lane.
    const ray=new THREE.Raycaster(), aim=new THREE.Vector3(focus.x,focus.y,focus.z);
    const world=worlds[Number(modern)];
    world.updateMatrixWorld(true);
    let best=null;
    for(const [scale,tilt,offset] of [[1,.13,.23],[1,.14,-.26],[.78,.1,0],[.6,.12,.3],[1.12,.5,-.25],[1.15,.8,.2],[.44,.08,0]]) {
      const yaw=direction+offset, len=range*scale;
      const candidate=aim.clone().add(new THREE.Vector3(Math.sin(yaw)*Math.cos(tilt),Math.sin(tilt),Math.cos(yaw)*Math.cos(tilt)).multiplyScalar(len));
      ray.set(candidate,aim.clone().sub(candidate).normalize());ray.far=len+.3;
      const hit=ray.intersectObjects(world.children,true).find(h=>h.distance>.25);
      const score=hit?.object.userData.shopId===selected?len:hit?hit.distance-len:-len;
      if(!best||score>best.score)best={len,tilt,yaw,score};
      if(hit?.object.userData.shopId===selected)break;
    }
    distance=best.len/Math.max(1,1.32/camera.aspect);theta=best.yaw;elevation=best.tilt;dirty=true;caption();
  }
  function selectShop(id,reframe) {
    flush();
    const info=book().get(id);
    if(!info||info.fixed)return;
    selected=id;
    makeDetail(id,modern);listOptions();fill();caption();
    if(reframe)frameFacade();
  }
  function flush() {
    if(!pendingFrame)return;
    cancelAnimationFrame(pendingFrame);pendingFrame=0;
    if(selected)makeDetail(selected,modern,true);
  }
  function save() {
    try {localStorage.setItem(storeKey,JSON.stringify(local));return true}
    catch {return false}
  }
  function change() {
    if(!selected||!active)return;
    const spec={floors:Number($('floors').value),arcade:Number($('depth').value),finish:$('finish').value,
      balcony:$('balcony').checked,sign:$('shopSign').value};
    local[entryKey(selected)]=spec;
    $('floorValue').textContent=spec.floors+' 層';$('depthValue').textContent=spec.arcade+' m';
    $('editStatus').textContent=save()?'自訂設計已儲存於此瀏覽器。':'本次設計已套用，瀏覽器儲存空間不足。';
    if(!pendingFrame)pendingFrame=requestAnimationFrame(()=>{pendingFrame=0;makeDetail(selected,modern,true)});
  }
  $('floors').oninput=$('depth').oninput=$('shopSign').oninput=change;
  $('finish').onchange=$('balcony').onchange=change;
  $('frontView').onclick=()=>{flush();frameFacade()};
  $('resetShop').onclick=()=>{
    flush();delete local[entryKey(selected)];const saved=save();makeDetail(selected,modern,true);fill();
    $('editStatus').textContent=saved?'已還原這棟街屋的年代預設。':'已還原本次畫面，瀏覽器無法儲存。';
  };
  select.onchange=()=>{flush();selectShop(select.value,true)};
  $('sunTime').onchange=()=>{
    time=$('sunTime').value;const light=tones[time];
    sun.color.set(light.sun);sun.intensity=light.intensity;
    const ambient=scene.children.find(o=>o.isHemisphereLight);ambient.color.set(light.sky);ambient.intensity=light.ambient;
    dirty=true;
  };
  function setTab(editing) {
    if(!ready||active===editing)return;
    flush();active=editing;panel.hidden=!editing;$('browsePanel').hidden=editing;
    $('editTab').setAttribute('aria-pressed',String(editing));$('browseTab').setAttribute('aria-pressed',String(!editing));
    if(editing){selectShop(selected||curated[index][0],true)}
    else {selected=null;choose(index)}
  }
  $('browseTab').onclick=()=>setTab(false);$('editTab').onclick=()=>setTab(true);
  let tap=null;
  stage.addEventListener('pointerdown',e=>{
    if(!active||e.button!==0)return;
    if(!e.isPrimary){tap=null;return}
    tap={id:e.pointerId,x:e.clientX,y:e.clientY};
  });
  stage.addEventListener('pointermove',e=>{
    if(tap&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>5)tap=null;
  });
  stage.addEventListener('pointercancel',()=>tap=null);
  stage.addEventListener('pointerup',e=>{
    if(!tap||tap.id!==e.pointerId)return;
    tap=null;const box=stage.getBoundingClientRect();
    const ndc=new THREE.Vector2((e.clientX-box.left)*2/box.width-1,1-(e.clientY-box.top)*2/box.height);
    const ray=new THREE.Raycaster();ray.setFromCamera(ndc,camera);
    const hit=ray.intersectObjects(worlds[Number(modern)].children,true)[0];
    if(!hit)return;
    const slot=hit.instanceId??hit.faceIndex;
    const run=hit.object.userData.buildingRanges?.find(r=>slot>=r.start&&slot<r.start+r.count);
    const id=hit.object.userData.shopId||run?.id;
    if(!id||book().get(id)?.fixed){toast('請點選一般街屋，或從附近街屋清單選取。');return}
    flush();selectShop(id,false);
  });
  window.atlasWorkshop={
    updateCaption:caption,
    resetSelection(){flush();selected=null},
    start(){
      for(const era of [false,true]) {
        const prefix=era?'now/':'old/';
        const saved=Object.keys(local).filter(k=>k.startsWith(prefix)).map(k=>k.slice(prefix.length));
        for(const id of new Set([...curated.flat(),...saved]))makeDetail(id,era);
      }
      $('editTab').disabled=false;
    },
    placeChanged(){if(active)selectShop(curated[index][0],true)},
    eraChanged(){if(active&&selected)selectShop(selected,false)},
    beforeEra:flush,
    light:()=>tones[time].offset,
    photoName:()=>active&&selected?streetName(book().get(selected)):null,
    hasEdits:()=>Object.keys(local).some(k=>k.startsWith(modern?'now/':'old/')),
    active:()=>active
  };
})();
