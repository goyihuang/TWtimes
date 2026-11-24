/* Changhua station and roundhouse. Local metres use east for x and south for z. */
window.addChanghuaRail=function(T,world,modern){
  const map=CHANGHUA, group=new T.Group(), boxes=new Map(), faces=new Map(), mats=new Map();
  group.name='彰化鐵道地景';
  const unit=new T.BoxGeometry(), tube=new T.CylinderGeometry(1,1,1,20);
  let origin=[0,0],yaw=0;
  function place(at,angle){origin=at;yaw=angle}
  function xyz(x,y,z){return new T.Vector3(origin[0]+x*Math.cos(yaw)+z*Math.sin(yaw),y,origin[1]-x*Math.sin(yaw)+z*Math.cos(yaw))}
  function material(color){if(!mats.has(color))mats.set(color,new T.MeshStandardMaterial({color,roughness:.78,metalness:.06,side:T.DoubleSide}));return mats.get(color)}
  function instance(shape,color,position,rotation,scale){
    const key=color+shape.uuid;if(!boxes.has(key))boxes.set(key,{shape,color,items:[]});
    boxes.get(key).items.push(new T.Matrix4().compose(position,rotation,new T.Vector3(...scale)));
  }
  const up=new T.Vector3(0,1,0);
  function box(x,y,z,w,h,d,color){instance(unit,color,xyz(x,y,z),new T.Quaternion().setFromAxisAngle(up,yaw),[w,h,d])}
  function beam(a,b,w,d,color,shape=unit){
    const A=xyz(...a),B=xyz(...b),v=B.clone().sub(A);
    instance(shape,color,A.lerp(B,.5),new T.Quaternion().setFromUnitVectors(up,v.clone().normalize()),[w,v.length(),d]);
  }
  function quad(a,b,c,d,color){if(!faces.has(color))faces.set(color,[]);const buf=faces.get(color);
    for(const q of [a,b,d,b,c,d]){const v=xyz(...q);buf.push(v.x,v.y,v.z)}}
  function slab(poly,base,top,color){
    for(const [a,b,c] of T.ShapeUtils.triangulateShape(poly.map(p=>new T.Vector2(...p)),[])){
      const p=poly[a],q=poly[b],r=poly[c];quad([p[0],top,p[1]],[q[0],top,q[1]],[r[0],top,r[1]],[r[0],top,r[1]],color)}
    poly.forEach(([x,z],i)=>{const [u,v]=poly[(i+1)%poly.length];quad([x,base,z],[u,base,v],[u,top,v],[x,top,z],color)});
  }
  function sign(label,x,y,z,w,h,bg,fg){
    const cv=document.createElement('canvas');cv.width=1024;cv.height=128;
    const ctx=cv.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,1024,128);ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 82px "Microsoft JhengHei",sans-serif';ctx.fillText(label,512,65,988);
    const tx=new T.CanvasTexture(cv);tx.colorSpace=T.SRGBColorSpace;
    const mesh=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshLambertMaterial({map:tx,side:T.DoubleSide}));
    mesh.position.copy(xyz(x,y,z));mesh.rotation.y=yaw;group.add(mesh);
  }
  function surface(p,y,color,tex,scale=3){
    const ids=T.ShapeUtils.triangulateShape(p.map(q=>new T.Vector2(...q)),[]),verts=[],uv=[];
    for(const f of ids)for(const i of [...f].reverse()){const [x,z]=p[i];verts.push(x,y,z);uv.push(x/scale,z/scale)}
    const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(verts,3));geom.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geom.computeVertexNormals();
    const mesh=new T.Mesh(geom,new T.MeshStandardMaterial({color,map:streetTexture(tex),side:T.DoubleSide,roughness:.93}));mesh.receiveShadow=true;group.add(mesh);
  }
  const stone='#c0bdae',cream='#e0d8c4',iron='#4b5351',timber='#654437',dark='#353c39',glass='#647e84';
  place([-12.4,197.5],1.02);
  if(modern){
    // Third station with its 2021 glazed centre and a succession of shallow scalloped awnings.
    // The patterned screen sits in front of the upper-storey glazing.
    for(let i=0;i<14;i++){const x=(i+.5)*4.7-32.9;if(Math.abs(x)<7)continue;
      box(x,7.25,9.28,2.25,4.45,.10,'#a4ada9');
      for(let y=5.25;y<9.46;y+=.38)box(x,y,9.37,2.27,.045,.075,stone);
      for(let j=-.98;j<=1;j+=.32)box(x+j,7.28,9.40,.038,4.2,.07,iron);
      box(x-1.28,7.15,9.24,.23,5.15,.4,stone);
    }
    box(0,5.05,0,66,10.1,18,cream);
    for(let x=-31.5;x<32;x+=3){
      box(x,6.85,9.05,2.65,5.05,.12,glass);
      for(let y=4.5;y<9.35;y+=.68)box(x,y,9.15,2.68,.045,.11,stone);
      box(x,2.05,9.08,2.6,3.5,.15,dark);
    }
    box(0,7.2,5.7,14,14.4,8.1,iron);box(0,7.55,9.82,12.9,13.2,.14,'#738a8f');
    for(let x=-6;x<=6;x+=1.5)box(x,7.5,9.92,.078,13.15,.10,stone);
    for(let y=2.1;y<14.2;y+=1.65)box(0,y,9.94,12.85,.065,.10,stone);
    for(let x=-5.7;x<5.8;x+=2.8){beam([x,3.8,10],[x+1.35,8.1,10],.10,.1,iron);beam([x+1.35,8.1,10],[x,12.6,10],.10,.1,iron)}
    sign('彰 化 車 站   Changhua Station',0,11.28,10.05,11.95,1.4,'#bac7c8','#33557c');
    for(let i=0;i<12;i++){const x=-33+i*5.5;
      for(let j=0;j<10;j++){const a=j/10,b=(j+1)/10,y=t=>3.75+1.03*Math.sin(t*Math.PI);
        quad([x+5.5*a,y(a),8.9],[x+5.5*b,y(b),8.9],[x+5.5*b,y(b),14.1],[x+5.5*a,y(a),14.1],cream);
        quad([x+5.5*a,y(a),14.1],[x+5.5*b,y(b),14.1],[x+5.5*b,y(b)-.18,14.1],[x+5.5*a,y(a)-.18,14.1],stone)}
      box(x,1.9,13.1,.45,3.8,.46,stone)}
    box(33,1.9,13.1,.45,3.8,.46,stone);
  }else{
    const roof='#66665e';
    box(0,2.65,0,32,5.3,12,'#c8b89a');
    for(let x=-15;x<=15;x+=2.5){box(x,2.8,6.1,.22,5.1,.24,timber);box(x+1,2.5,6.13,1.45,2.4,.13,'#555b52')}
    for(const side of [-1,1]){
      quad([-17,5.25,side*7.7],[17,5.25,side*7.7],[15.8,8.9,0],[-15.8,8.9,0],roof);
      box(side*23,2.05,-.25,13.4,4.1,9.5,'#c3b494');quad([side*16,4.35,5.4],[side*30,4.35,5.4],[side*30,5.55,-.2],[side*16,5.55,-.2],roof);
      quad([side*16,5.55,-.2],[side*30,5.55,-.2],[side*30,4.2,-5.3],[side*16,4.2,-5.3],roof);
      for(let x=17.5;x<30;x+=2.7)box(side*x,2.1,4.58,1.7,1.85,.14,dark);
    }
    box(0,6.40,5.98,11.45,2.6,.44,'#d7c6a3');
    for(const x of [-4,0,4]){box(x,6.67,6.24,2.97,1.51,.14,dark);
      for(let k=-1;k<=1;k+=.5)box(x+k,6.68,6.33,.045,1.48,.055,stone);
      box(x,6.65,6.34,2.95,.07,.055,stone)}
    for(const x of [-6,-2,2,6])box(x,6.46,6.31,.18,2.5,.16,timber);
    for(const side of [-1,1]){
      quad([-6.4,7.68,side*7.55],[6.4,7.68,side*7.55],[5.8,9.89,0],[-5.8,9.89,0],roof);
      quad([side*5.35,3.65,6.05],[side*16.9,3.65,6.05],[side*16.9,3.08,9.9],[side*5.35,3.08,9.9],roof);
      for(let x=7;x<18;x+=3.1)box(x*side,1.53,9.64,.19,3.06,.21,timber);
    }
    box(0,9.92,0,12.05,.20,.28,timber);
    for(let x=-5.6;x<6;x+=.48)box(x,10.12,0,.10,.32,.19,timber);
    box(0,10.31,0,12.0,.12,.19,timber);
    // Curved karahafu porch with timber framing, projecting beyond the long eaves.
    for(let i=0;i<28;i++){const x=-6.25+i*12.5/28,u=x+12.5/28;
      const top=q=>4.05+1.9*Math.exp(-q*q/8)+.27*(Math.abs(q)/6.25)**3;
      quad([x,top(x)+.5,5.8],[u,top(u)+.5,5.8],[u,top(u),10.2],[x,top(x),10.2],roof);
      quad([x,top(x),10.2],[u,top(u),10.2],[u,top(u)-.28,10.2],[x,top(x)-.28,10.2],timber)}
    for(const x of [-5.8,-3.7,3.7,5.8])box(x,2,9.55,.28,4,.28,timber);
    sign('彰 化 驛',0,4.45,9.65,3.4,1.0,timber,'#f2e3b8');
  }
  place([0,0],0);
  if(modern){
    for(const p of map.squares)surface(p,.079,'#d0cfbf','pavers',4);
    for(const p of map.canopies){
      if(p.length<3)continue;
      const c=p.reduce((v,q)=>[v[0]+q[0]/p.length,v[1]+q[1]/p.length],[0,0]);
      slab(p,2.94,3.12,'#b0b4ae');
      for(let i=0;i<p.length;i++){if(i%2)continue;const x=c[0]+(p[i][0]-c[0])*.85,z=c[1]+(p[i][1]-c[1])*.76;box(x,1.46,z,.10,2.92,.10,iron)}
    }
  }
  for(const p of map.platforms)slab(p,.11,.83,stone);
  // Each mapped approach terminates at a surveyed OSM bay mouth.
  const [cx,cz]=map.pivot;
  surface([[110,-293],[142,-316],[195,-321],[210,-288],[204,-246],[181,-211],[148,-214],[115,-242]],.064,'#9e9c90','gravel',2.2);
  for(const rail of map.rails){if(rail.type==='disused')continue;for(let j=1;j<rail.points.length;j++){
    const [x,z]=rail.points[j-1],[u,v]=rail.points[j],dx=u-x,dz=v-z,l=Math.hypot(dx,dz);if(l<.1)continue;
    for(const s of [-.534,.534]){const a=-dz*s/l,b=dx*s/l;beam([x+a,.15,z+b],[u+a,.15,v+b],.10,.10,'#6c6760')}
    if(Math.hypot((x+u)/2-cx,(z+v)/2-cz)<72)for(let d=.4;d<l;d+=1.1){const X=x+d*dx/l,Z=z+d*dz/l;beam([X-dz/l,.10,Z+dx/l],[X+dz/l,.10,Z-dx/l],.14,.12,'#756a58')}
  }}
  slab(map.turntable,.17,.22,'#535955');
  const railAngles=map.bayMouths.map(([x,z])=>Math.atan2(x-cx,cz-z));
  const concrete=modern?'#b9af96':'#b6aa93',roofing=modern?'#7a7b70':'#776f60';
  const radial=(a,r,y)=>[cx+Math.sin(a)*r,y,cz-Math.cos(a)*r];
  function engine(i,diesel){
    const a=railAngles[i],pt=radial(a,31.3,0);place([pt[0],pt[2]],-a);
    box(0,1.32,-3.6,2.6,.48,11.3,dark);
    for(const x of [-1.08,1.08])for(let z=-7.5;z<=.9;z+=1.75)beam([x-.1,.80,z],[x+.1,.8,z],.62,.62,dark,tube);
    if(diesel){
      box(0,2.6,-3.1,2.10,2.2,8.8,'#be662d');box(0,3.05,-6.8,2.78,2.7,2.6,'#cc7a41');
      box(0,2.19,1.53,2.81,.17,1.03,iron);
      box(0,2.65,1.41,1.94,.21,.11,cream);
      for(const x of [-.92,.92]){beam([x,2.70,1.46],[0,2.23,1.46],.11,.09,cream);
        box(x,1.75,1.82,.11,.9,.1,cream);box(x,2.18,1.65,.11,.11,.4,cream)}
      box(0,3.24,1.39,.41,.31,.14,'#e8dfba');
      for(const x of [-1.4,1.4]){box(x,3.44,-6.75,.05,.73,1.51,glass);
        for(let z=-4.8;z<.61;z+=.7)box(x*.77,2.75,z,.08,.55,.13,dark)}
      box(0,3.6,-5.46,2.25,.78,.09,glass);box(0,2.68,1.34,2.12,.37,.08,cream);
      for(let z=-4.8;z<.8;z+=.48)box(1.07,2.9,z,.065,.71,.12,dark);
    }else{
      beam([0,2.6,-6.6],[0,2.6,.95],1.04,1.04,'#343c39',tube);
      box(0,3.15,-7.1,2.71,2.48,2.48,dark);box(0,4.39,-7.1,2.92,.18,2.75,iron);
      beam([0,3.36,.04],[0,4.46,.04],.27,.27,dark,tube);box(0,3.47,1.04,.38,.38,.19,cream);
    }
    place([0,0],0);
  }
  for(let i=0;i<12;i++){
    const angle=railAngles[i],left=i?(angle+railAngles[i-1])/2:angle-(railAngles[1]-angle)/2;
    const right=i<11?(angle+railAngles[i+1])/2:angle+(angle-railAngles[i-1])/2;
    const radius=Math.hypot(map.bayMouths[i][0]-cx,map.bayMouths[i][1]-cz),back=radius+24;
    const q=(a,r,y)=>radial(a,r,y);
    quad(q(left,radius,7.65),q(right,radius,7.65),q(right,back,6.8),q(left,back,6.8),roofing);
    quad(q(left,radius,5.65),q(right,radius,5.65),q(right,radius,7.72),q(left,radius,7.72),concrete);
    quad(q(left,back,0),q(right,back,0),q(right,back,6.8),q(left,back,6.8),concrete);
    quad(q(left+.009,radius-.035,6.02),q(right-.009,radius-.035,6.02),q(right-.009,radius-.035,7.22),q(left+.009,radius-.035,7.22),'#62747a');
    for(let k=1;k<6;k++){const a=left+(right-left)*k/6;beam(q(a,radius-.09,6),q(a,radius-.09,7.26),.065,.07,stone)}
    for(const a of i===11?[left,right]:[left])beam(q(a,radius,0),q(a,radius,7.8),.47,.55,concrete);
    if(i===0||i===11){const edge=i?right:left;quad(q(edge,radius,0),q(edge,back,0),q(edge,back,6.8),q(edge,radius,7.65),concrete)}
    const centre=q(angle,radius-.18,6);place([centre[0],centre[2]],-angle);
    sign(String(i+1),0,7.45,.04,1.05,.72,'#bfb79c','#4b4c44');
    place([0,0],0);
    for(const r of [radius+4,radius+13,back-.6]){
      const leftPost=q(left,r,0),rightPost=q(right,r,0);
      beam(q(left,r,6.65),q(right,r,6.65),.21,.25,'#5c635b');
      beam(leftPost,q(left,r,6.65),.18,.23,iron);
      if(i===11)beam(rightPost,q(right,r,6.65),.18,.23,iron);
    }
    quad(q(left+.01,back-.14,.34),q(right-.01,back-.14,.34),q(right-.01,back-.14,5.5),q(left+.01,back-.14,5.5),'#525b58');
    beam(q(angle,radius+8,7),q(angle,radius+8,10),.52,.52,concrete,tube);
    beam(q(angle,radius+8,9.93),q(angle,radius+8,10.12),.67,.67,iron,tube);
    for(const delta of [-.53,.53]){const ox=Math.cos(angle)*delta,oz=Math.sin(angle)*delta;
      const a=q(angle,radius,.15),b=q(angle,back,.15);beam([a[0]+ox,.15,a[2]+oz],[b[0]+ox,.15,b[2]+oz],.10,.10,iron)}
  }
  engine(2,false);engine(8,modern);if(modern)engine(5,true);
  const deckAngle=railAngles[modern?5:2];place([cx,cz],-deckAngle);
  box(0,.34,0,2.9,.33,19.2,dark);
  for(const x of [-.534,.534])box(x,.56,0,.10,.14,19.3,'#92978f');
  for(const x of [-1.42,1.42]){box(x,1.38,0,.065,.08,18.8,stone);for(let z=-9;z<=9;z+=2)box(x,.96,z,.075,.86,.075,iron)}
  if(modern){place(map.lookout,0);box(0,2.7,0,4.5,.20,3.2,stone);for(const x of [-2,2])for(const z of [-1.4,1.4])box(x,1.38,z,.16,2.76,.16,iron);for(const x of [-2,2])box(x,3.82,0,.08,.09,3.1,iron)}
  for(const [color,buf] of faces){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(buf,3));g.computeVertexNormals();const mesh=new T.Mesh(g,material(color));mesh.castShadow=mesh.receiveShadow=true;group.add(mesh)}
  for(const {shape,color,items} of boxes.values()){const mesh=new T.InstancedMesh(shape,material(color),items.length);items.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=mesh.receiveShadow=true;group.add(mesh)}
  world.add(group);
};

