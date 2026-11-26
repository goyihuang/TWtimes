/* Station-local x follows the southern frontage. Dimensions outside the mapped
   modern footprint are estimated from the station photographs. */
window.addTaipeiStation=function(T,group,modern,generation=modern?5:3){
  const building=new T.Group(),boxes=new Map(),faces=new Map(),unit=new T.BoxGeometry();
  const stone='#c9b9a3',trim='#ded3bd',bronze='#877562',glass='#556a69',shade='#423e38',roof='#a35134';
  function block(x,y,z,w,h,d,color){
    const o=new T.Object3D();o.position.set(x,y,z);o.scale.set(w,h,d);o.updateMatrix();
    if(!boxes.has(color))boxes.set(color,[]);boxes.get(color).push(o.matrix);
  }
  function panel(a,b,c,d,color){
    if(!faces.has(color))faces.set(color,[]);const f=faces.get(color);for(const q of [a,b,d,b,c,d])f.push(...q);
  }
  function rectangle(w,d,y){return [[-w,y,-d],[w,y,-d],[w,y,d],[-w,y,d]]}
  function rim(w,d,y,h,color){
    for(const k of [-1,1]){block(0,y,k*d,2*w,h,.38,color);block(k*w,y,0,.38,h,2*d,color)}
  }
  function label(text,x,y,z,width,height,bg,fg){
    const c=document.createElement('canvas');c.width=1024;c.height=128;
    const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,1024,128);ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 84px "Microsoft JhengHei",sans-serif';ctx.fillText(text,512,65,985);
    const tx=new T.CanvasTexture(c);tx.colorSpace=T.SRGBColorSpace;const s=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshLambertMaterial({map:tx,side:T.DoubleSide}));s.position.set(x,y,z);building.add(s);
  }
  function round(x,y,z,r,h,color){const m=new T.Mesh(new T.CylinderGeometry(r,r,h,64),new T.MeshStandardMaterial({color,roughness:.74}));m.position.set(x,y,z);m.receiveShadow=m.castShadow=true;building.add(m)}
  // Additional station buildings share the existing batched timber, masonry and
  // roof helpers; each gets its own group so the visitor can change generation.
  function gableRoof(cx,y,cz,halfWidth,halfDepth,rise,color){
    const ridge=y+rise;
    panel([cx-halfWidth,y,cz-halfDepth],[cx,y+rise,cz-halfDepth],[cx,ridge,cz+halfDepth],[cx-halfWidth,y,cz+halfDepth],color);
    panel([cx,ridge,cz-halfDepth],[cx+halfWidth,y,cz-halfDepth],[cx+halfWidth,y,cz+halfDepth],[cx,ridge,cz+halfDepth],color);
  }
  function strut(x1,y1,x2,y2,z,w,color){
    const mesh=new T.Mesh(new T.BoxGeometry(w,Math.hypot(x2-x1,y2-y1),w),new T.MeshStandardMaterial({color}));
    mesh.position.set((x1+x2)/2,(y1+y2)/2,z);mesh.rotation.z=-Math.atan2(x2-x1,y2-y1);
    mesh.castShadow=mesh.receiveShadow=true;building.add(mesh);
  }
  function track(x,z,length){
    for(const dx of [-.53,.53])block(x+dx,.16,z,.08,.14,length,'#62615c');
    for(let i=-length/2;i<length/2;i+=.86)block(x,.078,z+i,2.12,.14,.19,'#746452');
  }
  // Scale the image in metres so the masonry keeps the same bond size around corners.
  function surface(a,b,c,d,texture,width,height,color){
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute([...a,...b,...c,...a,...c,...d],3));
    g.setAttribute('uv',new T.Float32BufferAttribute([0,0,width,0,width,height,0,0,width,height,0,height],2));
    g.computeVertexNormals();
    const m=new T.Mesh(g,new T.MeshStandardMaterial({color,map:streetTexture(texture),roughness:.93,side:T.DoubleSide}));
    m.receiveShadow=true;building.add(m);
  }
  // Frontal studies supply the surface detail. Keep eaves, porticos and piers in relief.
  function facadeDetail(file,x,y,z,width,height,repeat=1){
    const map=new T.TextureLoader().load('taipei-views/'+file+'.jpg',()=>window.dispatchEvent(new Event('street-texture-ready')));
    map.colorSpace=T.SRGBColorSpace;map.wrapS=T.RepeatWrapping;map.repeat.x=repeat;map.anisotropy=4;
    const mesh=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshStandardMaterial({map,roughness:.9}));
    mesh.position.set(x,y,z);mesh.receiveShadow=true;building.add(mesh);
  }
  function earlyDepot(){
    const wood='#75644e',iron='#4d5350';
    gableRoof(0,5.1,-4,9.6,16.8,4.15,'#827d6c');
    for(let z=-19;z<=12;z+=6.2){
      for(const sign of [-1,1]){
        block(sign*8.65,2.5,z,.28,5,.32,wood);
        strut(sign*9,5,0,9, z,.2,wood);
        strut(sign*6.1,6.3,sign*3.3,5,z,.16,wood);
        strut(sign*3.3,5,0,8.65,z,.17,wood);
      }
      block(0,5.04,z,18,.23,.29,wood);block(0,7,z,.16,3.8,.19,wood);
    }
    for(const s of [-1,1]){
      surface([s*9.6,5.13,12.8],[s*9.6,5.13,-20.8],[0,9.28,-20.8],[0,9.28,12.8],'slate',12,4,'#b3ac94');
    }
    for(let i=0;i<11;i++){
      const x=5.2+(i%3)*1.13,z=5-Math.floor(i/3)*1.05,y=.76+(i===10?.56:0);
      block(x,y+.3,z,.97,.58,.8,'#947a54');
      for(const dx of [-.38,.38])block(x+dx,y+.3,z+.41,.075,.57,.04,wood);
      block(x,y+.61,z,.98,.045,.81,'#af956a');
    }
    for(let z=-19;z<12;z+=.47)boxSlat(z);
    function boxSlat(z){block(8.65,2.1,z,.15,4.1,.22,'#948770')}
    for(const x of [-12,-5,1.5])track(x,-2,94);
    block(5.4,.36,-3,4.0,.7,31,'#b6a286');
    // A short freight wagon stands on the shed track.
    block(1.5,1.38,7,2.5,1.15,4.9,wood);
    for(const z of [5.4,8.6])for(const x of [.95,2.05]){
      const wheel=new T.Mesh(new T.CylinderGeometry(.44,.44,.14,18),new T.MeshLambertMaterial({color:iron}));
      wheel.rotation.z=Math.PI/2;wheel.position.set(x,.52,z);building.add(wheel);
    }
    for(let y=1.03;y<1.96;y+=.22)block(1.5,y,9.5,2.48,.05,.05,iron);
    // A steam locomotive at the open end of the yard, as in the shed photograph.
    const boiler=new T.Mesh(new T.CylinderGeometry(.72,.72,4.1,24),new T.MeshStandardMaterial({color:'#424542',roughness:.72}));
    boiler.rotation.x=Math.PI/2;boiler.position.set(-12,1.78,7.2);boiler.castShadow=true;building.add(boiler);
    block(-12,.92,6.9,2.18,.36,7.4,iron);round(-12,2.88,8.65,.22,1.04,iron);round(-12,3.4,8.65,.32,.15,iron);
    block(-12,3.12,4.65,2.34,.21,2.33,iron);
    for(const side of [-1,1]){
      block(-12+side*.94,1.63,4.65,.12,1.2,1.9,wood);
      for(const z of [3.8,5.5])block(-12+side*.94,2.44,z,.12,1.32,.12,iron);
      for(const z of [4.6,6.2,7.8]){
        const wheel=new T.Mesh(new T.CylinderGeometry(.57,.57,.12,20),boiler.material);
        wheel.rotation.z=Math.PI/2;wheel.position.set(-12+side*.78,.7,z);building.add(wheel);
      }
      block(-12+side*.88,.78,6.2,.1,.1,3.4,'#9b9684');
    }
    for(const x of [-30,24]){
      block(x,2,-20,10,4,8,'#a09078');gableRoof(x,4,-20,5.4,4.5,2,wood);
    }
  }
  function renaissanceStation(){
    const brick='#9c5849',stonework='#d1be9e',tiles='#605e56',sash='#4b5149';
    block(0,5.65,0,20,11.3,12,brick);
    surface([-10,0,6.02],[10,0,6.02],[10,11.3,6.02],[-10,11.3,6.02],'brick',10,5.6,'#dfc3ad');
    const roofLayers=[[10.8,6.9,11.4],[8.8,5.3,12.8],[6.1,3.7,14.5]];
    const roofRings=roofLayers.map(r=>rectangle(...r));
    for(let j=0;j<4;j++)for(let i=0;i<2;i++)panel(roofRings[i][j],roofRings[i][(j+1)%4],roofRings[i+1][(j+1)%4],roofRings[i+1][j],tiles);
    block(0,14.5,0,12.2,.16,7.4,tiles);
    for(const s of [-1,1]){
      const cx=s*22;block(cx,2.49,0,24,4.98,10.5,brick);
      surface([cx-12,0,5.27],[cx+12,0,5.27],[cx+12,4.98,5.27],[cx-12,4.98,5.27],'brick',12,2.5,'#e1c5af');
      panel([cx-12.6,5.1,5.9],[cx+12.6,5.1,5.9],[cx+10,7.6,0],[cx-10,7.6,0],tiles);
      panel([cx-12.6,5.1,-5.9],[cx+12.6,5.1,-5.9],[cx+10,7.6,0],[cx-10,7.6,0],tiles);
      for(const side of [-1,1])panel([cx+side*12.6,5.1,5.9],[cx+side*12.6,5.1,-5.9],[cx+side*10,7.6,0],[cx+side*10,7.6,0],tiles);
      for(let k=0;k<6;k++){
        const x=s*(11.9+3.65*k);block(x,2.6,5.34,1.65,2.65,.12,sash);
        block(x,2.6,5.44,.085,2.65,.12,stonework);block(x,3.1,5.44,1.65,.09,.14,stonework);
      }
      block(cx,3.7,7.2,24,.24,4.25,tiles);
      for(let k=0;k<7;k++)block(s*(10.4+k*3.8),1.85,9.1,.17,3.7,.17,stonework);
    }
    for(let y=.85;y<11.4;y+=1.3)block(0,y,0,20.25,.23,12.23,stonework);
    for(let x=-7.4;x<8;x+=3.7){
      block(x,8.15,6.19,2.15,4.15,.23,sash);
      block(x,8.22,6.35,.1,4.08,.1,stonework);block(x,8.65,6.35,2.15,.12,.10,stonework);
    }
    // Arched entrance framed by alternating brick and pale voussoirs.
    block(0,1.12,6.22,3.5,2.25,.26,'#3c4039');
    for(let i=0;i<18;i++){
      const at=(r,a,z)=>[r*Math.cos(a),2.25+r*Math.sin(a),z];
      const a=i*Math.PI/18,b=(i+1)*Math.PI/18;
      panel([0,2.25,6.36],at(1.75,a,6.36),at(1.75,b,6.36),[0,2.25,6.36],'#3c4039');
      panel(at(1.75,a,6.41),at(2.03,a,6.41),at(2.03,b,6.41),at(1.75,b,6.41),i%2?stonework:brick);
    }
    for(const s of [-1,1])strut(-3.4*s,11.3,0,13.3,6.32,.23,stonework);
    // Projecting porch with a walk-in recess under the first-floor terrace.
    for(const side of [-1,1]){
      const x=side*2.85;block(x,2.13,8.2,1.73,4.26,4.0,brick);
      for(let y=.52;y<4.4;y+=.8)block(x,y,8.2,1.79,.24,4.05,stonework);
    }
    block(0,4.54,8.2,7.55,.63,4.17,stonework);
    block(0,5.35,10.2,7.62,.2,.3,stonework);
    for(let x=-3.6;x<=3.6;x+=.46)block(x,5.04,10.2,.16,.55,.22,stonework);
    for(let i=0;i<18;i++){
      const a=i*Math.PI/18,b=(i+1)*Math.PI/18;
      const p=(r,ang,z)=>[r*Math.cos(ang),2.25+r*Math.sin(ang),z];
      panel(p(1.98,a,10.23),p(2.26,a,10.23),p(2.26,b,10.23),p(1.98,b,10.23),i%2?stonework:brick);
      panel(p(1.98,a,10.23),p(1.98,b,10.23),p(1.98,b,6.43),p(1.98,a,6.43),shade);
    }
    facadeDetail('brick-hall',0,8.55,6.47,19.95,5.55);
    panel([-4.5,11.32,6.44],[4.5,11.32,6.44],[0,13.38,6.44],[0,13.38,6.44],stonework);
    for(let x=-5.9;x<=6;x+=.5)block(x,14.95,0,.05,.8,.05,'#55544d');
    block(0,15.25,0,12,.06,.06,'#55544d');
    block(0,.20,7.5,13,.38,3.3,stonework);
  }
  function temporaryStation(){
    const concrete='#c5c2ae',frame='#a49e8e';
    surface([-40,.09,14],[40,.09,14],[40,.09,35],[-40,.09,35],'asphalt',16,4.2,'#cabfaf');
    block(0,3.75,0,57,7.5,13,concrete);
    block(0,4.35,6.62,56.8,4.1,.24,'#566365');
    for(let x=-27;x<=27;x+=3.1){
      block(x,4.6,6.85,.23,5,.38,frame);
      block(x,3.44,6.87,2.87,1.58,.32,'#b3afa0');
      for(let y=2.78;y<4.2;y+=.25)block(x,y,7.04,2.7,.055,.08,'#97998e');
    }
    block(0,7.48,0,58,.38,13.8,frame);
    block(19.7,4.95,6.82,14.3,9.9,.8,'#ddd9c8');
    for(let x=13;x<27;x+=2.0)block(x,5.2,7.24,.05,9.2,.05,frame);
    for(let y=1;y<10;y+=1.35)block(19.7,y,7.25,14.1,.04,.06,frame);
    facadeDetail('window-bay',-7.6,5.05,7.13,39.8,4.42,11);
    label('臺 北 車 站',19.7,6.4,7.31,8.2,1.2,'#d8d7c9','#484741');
    label('12:08',19.7,8.48,7.35,6.5,1.35,'#3d413e','#c6c1a6');
    facadeDetail('clock-wall',19.7,6.26,7.42,14.1,7.32);
    block(0,2.7,8.4,60,.37,5.3,'#71736d');
    for(let x=-26;x<29;x+=6.7){block(x,1.36,10.9,.21,2.72,.25,frame);block(x,1.36,6.9,4.65,2.61,.18,shade)}
    block(0,.17,8.1,59,.30,5.7,frame);
    for(let j=0;j<4;j++)label(['站','車','北','臺'][j],-20+j*7.1,8.29,5.8,1.62,1.55,'#b8b7a9','#494743');
  }
  const entry=TAIPEI_GENERATIONS[generation-1];building.name=entry.name;
  if([1,2,4].includes(generation)){
    building.position.set(entry.x,0,entry.z);building.rotation.y=generation===1?.24:-.12;
    if(generation===1)earlyDepot();
    if(generation===2)renaissanceStation();
    if(generation===4)temporaryStation();
  }else if(modern){
    building.position.set(11.5,0,3.6);building.rotation.y=-.187;
    // Recessed lower colonnade and a continuous projecting upper window band.
    block(0,6.0,0,141,12,108,stone);block(0,17.6,0,149,9.8,117,glass);
    block(0,12.1,0,155,1.0,122,stone);block(0,22.8,0,155,1.1,124,trim);
    for(let side of [-1,1]){
      for(let x=-69;x<=70;x+=4.65){
        block(x,5.9,side*59.1,.88,11.8,1.25,stone);
        block(x,18.0,side*58.9,.25,9.6,.33,bronze);
        block(x+2.24,6.1,side*54.35,3.65,8.0,.25,glass);
        block(x+2.24,5.8,side*54.57,.16,7.4,.18,trim);
      }
      for(let z=-52;z<=53;z+=4.6){
        block(side*74.6,6,z,1.35,12,.94,stone);block(side*74.65,18,z,.31,9.45,.25,bronze);
        block(side*70.72,5.9,z,.25,8.25,3.75,glass);
      }
      for(let y=14;y<22.6;y+=1.95){block(0,y,side*58.94,149,.12,.27,bronze);block(side*74.68,y,0,.24,.12,117,bronze)}
    }
    facadeDetail('concourse',0,17.62,59.13,148.8,9.42,9);
    rim(77.9,61.75,12.8,.43,bronze);rim(79.5,63.55,23.6,.53,trim);
    // Broad glazed-tile roof with swept eaves and a raised flat central crown.
    const layers=[[80,64,23.8],[76,60.8,24.35],[70,55.7,26.0],[62,48.8,29.4],[54,42.0,33.8],[45,34.3,39.0]];
    const corners=layers.map(v=>rectangle(v[0],v[1],v[2]));
    for(let i=1;i<corners.length;i++){
      for(let j=0;j<4;j++){const n=(j+1)%4,p=corners[i-1],q=corners[i];
        panel(p[j],p[n],q[n],q[j],roof);
        const mix=(a,b,t,offset=0)=>a.map((v,k)=>v+(b[k]-v)*t+(k===1?offset:0));
        const count=j%2?106:142;
        for(let k=0;k<count;k++){const t=k/count,u=(k+.13)/count;panel(mix(p[j],p[n],t,.035),mix(p[j],p[n],u,.035),mix(q[j],q[n],u,.035),mix(q[j],q[n],t,.035),'#bc7352')}
        const inset=q[j].map((v,k)=>v+(k===1?.13:.19));const foot=p[j].map((v,k)=>v+(k===1?.13:.19));
        panel(p[j],foot,inset,q[j],trim);
      }
    }
    block(0,39.3,0,90,.75,68.6,trim);block(0,40.7,0,84,2.3,63.8,'#beb8a7');
    label('臺 北 車 站　 TAIPEI MAIN STATION',0,40.85,32.04,35,2.3,'#bcb9ad','#544c43');
    facadeDetail('crown',0,40.72,32.08,83.9,2.28);
    for(let x=-59;x<=60;x+=28.7){block(x,3.95,62,11.7,.33,6.4,bronze);block(x,4.7,54.55,8.6,1.15,.33,shade)}
    for(let j=0;j<3;j++)block(0,.10+j*.13,62.5-j*.57,142,.19,1.2,stone);
  }else{
    building.position.set(-199,0,11);building.rotation.y=-.12;
    const cream='#d6c7a6',frame='#a89c82',sash='#716d5d';
    block(0,5,0,26,10,18,cream);block(0,8.25,1.2,27,16.5,20.6,cream);
    block(0,16.65,1.2,28,.46,21.1,frame);
    for(const sign of [-1,1]){
      block(sign*31,5.15,0,36,10.3,16.9,cream);
      block(sign*30,10.25,0,38,.40,18.7,frame);
      for(let j=0;j<9;j++){let x=sign*(15.5+j*3.66);block(x,6.85,8.7,2.81,2.87,.25,glass);block(x,6.85,8.91,.12,2.9,.12,sash);block(x,2.3,8.71,2.1,3.4,.22,shade)}
      block(sign*32,4.50,10.9,37,.32,4.5,frame);
    }
    for(let i=-3;i<=3;i++){const x=i*2.51;block(x,9.35,11.65,1.92,6.24,.23,glass);block(x,9.25,11.82,.12,6,.13,sash);block(x,2.20,11.62,2.06,3.72,.22,shade)}
    for(const x of [-12.4,12.4]){block(x,8.1,11.8,1.18,15.5,.55,frame);block(x,11.6,12.12,1.72,1.78,.22,stone)}
    facadeDetail('stone-hall',0,11.85,12.3,26.92,9.12);
    for(const [i,char] of [...'台北車站'].entries()){
      const x=(i-1.5)*4.35;
      label(char,x,18.13,9.8,2.37,2.32,'#d0c7b5','#9c3e34');
      block(x,17.14,9.74,.10,1.03,.12,frame);
    }
    block(0,4.8,13.3,30,.46,5.8,frame);for(const x of [-12,-6,6,12])block(x,2.37,15.35,.35,4.75,.35,frame);
    // Low arched spray over the basin, rendered as fine pale lines in the historic layer.
    const jets=[];for(let k=0;k<16;k++){const a=k*Math.PI/8;for(let j=0;j<12;j++){
      for(const t of [j/12,(j+1)/12]){const r=.9+t*4.5;jets.push(Math.sin(a)*r,1.4*(1-t)+2.7*Math.sin(Math.PI*t)+.55,38+Math.cos(a)*r)}}}
    const jetsMesh=new T.InstancedMesh(new T.CylinderGeometry(.021,.021,1,5),new T.MeshLambertMaterial({color:'#d2dbd3'}),jets.length/6);
    const up=new T.Vector3(0,1,0);
    for(let i=0;i<jets.length;i+=6){
      const a=new T.Vector3().fromArray(jets,i),b=new T.Vector3().fromArray(jets,i+3),d=b.clone().sub(a),o=new T.Object3D();
      o.position.copy(a).lerp(b,.5);o.quaternion.setFromUnitVectors(up,d.clone().normalize());o.scale.y=d.length();o.updateMatrix();jetsMesh.setMatrixAt(i/6,o.matrix);
    }
    building.add(jetsMesh);
    for(const [x,z] of [[-46,33],[42,32]]){
      block(x,1.51,z,9.1,2.32,2.4,'#e2d8bd');block(x,1.12,z,9.15,.62,2.46,'#7a6951');
      for(let j=0;j<8;j++)block(x-3.75+j*1.04,2.06,z+1.23,.85,.68,.09,glass);
      for(const dx of [-2.9,2.88]){const wheel=new T.Mesh(new T.CylinderGeometry(.57,.57,2.48,16),new T.MeshLambertMaterial({color:'#393d39'}));wheel.rotation.x=Math.PI/2;wheel.position.set(x+dx,.61,z);building.add(wheel)}
    }
    round(0,.23,38,8.75,.45,frame);round(0,.49,38,8.22,.10,'#859f96');round(0,.87,38,1.1,.70,stone);
    for(const z of [-15,-21,-28]){for(const dz of [-.534,.534])block(0,.13,z+dz,235,.12,.085,'#686563');for(let x=-117;x<118;x+=1.1)block(x,.075,z,.2,.12,2.15,'#817565')}
    block(0,.48,-11.2,134,.9,4.5,frame);block(0,4.1,-11.2,114,.27,5.5,'#66695d');for(let x=-54;x<56;x+=8)block(x,2.2,-11.2,.22,3.9,.25,sash);
  }
  for(const [color,items] of boxes){const mesh=new T.InstancedMesh(unit,new T.MeshStandardMaterial({color,roughness:.82}),items.length);items.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=mesh.receiveShadow=true;building.add(mesh)}
  for(const [color,buf] of faces){const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(buf,3));geom.computeVertexNormals();const mesh=new T.Mesh(geom,new T.MeshStandardMaterial({color,roughness:.89,side:T.DoubleSide}));mesh.castShadow=mesh.receiveShadow=true;building.add(mesh)}
  group.add(building);return building;
};
