/* Station-local x follows the southern frontage. Dimensions outside the mapped
   modern footprint are estimated from the station photographs. */
window.addTaipeiStation=function(T,group,modern){
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
  if(modern){
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
    label('臺　北　車　站',0,14.58,11.84,15,1.85,'#d6c7a6','#794538');
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
  group.add(building);
};
