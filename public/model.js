/* Procedural architectural interpretation. Coordinates are metres, east and south. */
(function(){
'use strict';
const T=THREE;
const centre=points=>points.reduce((v,p)=>[v[0]+p[0]/points.length,v[1]+p[1]/points.length],[0,0]);
function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
function flat(points,y){return points.map(p=>[p[0],y,p[1]])}
function material(color,texture){return new T.MeshLambertMaterial({color,map:texture||null,side:T.DoubleSide})}
function facade(modern,variant){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const c=canvas.getContext('2d');
  const fills=modern?['#d7c5a6','#d8d2be','#d5c0a5','#bbbca9','#bfc8ba']:['#b5795e','#d9c3a2','#c99a78','#bf8769','#c4b79b'];
  c.fillStyle=fills[variant%5];c.fillRect(0,0,256,256);
  const rng=random(50+variant);for(let i=0;i<2300;i++){c.fillStyle=rng()>.5?'#594c3514':'#fff6dd23';c.fillRect(rng()*256,rng()*256,2+rng()*6,1+rng()*3)}
  if(!modern){c.strokeStyle='#e9ccac61';c.lineWidth=1;for(let y=0;y<256;y+=13){c.beginPath();c.moveTo(0,y);c.lineTo(256,y);c.stroke();for(let x=(y%26?0:16);x<256;x+=32){c.beginPath();c.moveTo(x,y);c.lineTo(x,y+13);c.stroke()}}}
  for(let x of [19,146]){let w=88,bottom=207;c.fillStyle=modern?'#a39b85':'#edd9b5';c.fillRect(x-5,48,w+10,165);c.fillStyle=modern?'#66817e':'#494e43';c.fillRect(x,56,w,146);
    if(!modern){c.fillStyle='#4c5145';c.beginPath();c.ellipse(x+w/2,55,w/2,24,0,Math.PI,2*Math.PI);c.fill();c.fillStyle='#b79a78';c.fillRect(x+8,58,5,144)}
    c.fillStyle=modern?'#acbcb0':'#7b8978';c.fillRect(x+5,60,w*.43,68);c.fillStyle='#d6cdb6';c.fillRect(x+w/2-2,57,4,145);c.fillRect(x,127,w,5);c.fillStyle='#8f8771';c.fillRect(x-4,bottom,w+8,5)}
  c.fillStyle=modern?'#adae9b':'#ecd9bc';c.fillRect(0,0,256,9);c.fillStyle='#6c655449';c.fillRect(0,9,256,5);
  const tx=new T.CanvasTexture(canvas);tx.wrapS=tx.wrapT=T.RepeatWrapping;tx.colorSpace=T.SRGBColorSpace;tx.anisotropy=4;return tx;
}
function signage(title,modern){
 const cv=document.createElement('canvas');cv.width=512;cv.height=128;let c=cv.getContext('2d');c.fillStyle=modern?'#255449':'#e4cd9f';c.fillRect(0,0,512,128);c.strokeStyle=modern?'#bcc298':'#875039';c.lineWidth=6;c.strokeRect(7,7,498,114);c.fillStyle=modern?'#fff2d0':'#724330';c.font='bold 76px serif';c.textAlign='center';c.textBaseline='middle';c.fillText(title,256,70,465);const tx=new T.CanvasTexture(cv);tx.colorSpace=T.SRGBColorSpace;return tx
}
window.buildDistrict=function(modern,geo=window.GEODATA){
 const changhua=geo===window.CHANGHUA,taipei=geo===window.TAIPEI,kaohsiung=geo===window.KAOHSIUNG;
 const group=new T.Group(), bucket=new Map(), materials=new Map(),instances=new Map(), rng=random(31915);
 const buildings=new Map();
 group.userData.buildings=buildings;
 let current=null;
 function markRange(ranges,start,count){
   if(!current)return;
   const end=ranges[ranges.length-1];
   if(end&&end.id===current.id&&end.start+end.count===start)end.count+=count;
   else ranges.push({id:current.id,start,count});
 }
 function track(mesh,ranges,instanced){
   mesh.userData.buildingRanges=ranges;
   for(const range of ranges)buildings.get(range.id).parts.push({mesh,range,instanced});
 }
 function mat(col){if(!materials.has(col))materials.set(col,material(col));return materials.get(col)}
 function triangle(m,a,b,c,uv=[0,0,1,0,0,1]){if(!bucket.has(m))bucket.set(m,{pos:[],uv:[],ranges:[]});const data=bucket.get(m);markRange(data.ranges,data.pos.length/9,1);data.pos.push(...a,...b,...c);data.uv.push(...uv)}
 function quad(m,a,b,c,d,w=1,h=1){triangle(m,a,b,c,[0,0,w,0,w,h]);triangle(m,a,c,d,[0,0,w,h,0,h])}
 function cap(points,y,m){const ids=T.ShapeUtils.triangulateShape(points.map(p=>new T.Vector2(...p)),[]),p=flat(points,y);ids.forEach(([a,b,c])=>triangle(m,p[c],p[b],p[a]))}
 function strip(points,width,y,m){for(let i=1;i<points.length;i++){let [x,z]=points[i-1],[u,v]=points[i],dx=u-x,dz=v-z,dist=Math.hypot(dx,dz);if(dist<.1)continue;let a=-dz/dist*width/2,b=dx/dist*width/2;quad(m,[x+a,y,z+b],[u+a,y,v+b],[u-a,y,v-b],[x-a,y,z-b],dist/3,width/3)}}
 const shapes={box:new T.BoxGeometry(),spray:new T.PlaneGeometry(),leaf:new T.IcosahedronGeometry(1,1),trunk:new T.CylinderGeometry(.7,1,1,7)};
 function inst(shape,color,x,y,z,w,h,d,angle=0){const key=shape+color;if(!instances.has(key))instances.set(key,{shape,color,m:[],ranges:[]});const o=new T.Object3D();o.position.set(x,y,z);o.scale.set(w,h,d);o.rotation.y=angle;o.updateMatrix();const data=instances.get(key);markRange(data.ranges,data.m.length,1);data.m.push(o.matrix)}
 function tree(x,z,scale=1){let h=(4+rng()*2.2)*scale;inst('trunk','#796f52',x,h/2,z,.2*scale,h,.22*scale);for(let j=0;j<24;j++){const a=j*2.39996,r=Math.sqrt((j+.4)/24)*2.15*scale,sz=(2.8+rng()*1.1)*scale;
 const y=h+(.25+1.52*Math.sqrt(1-(r/(2.2*scale))**2)+(rng()-.5)*1.6)*scale;
 inst('spray','#f1f1e8',x+Math.cos(a)*r,y,z+Math.sin(a)*r,sz,sz*.94,1,a);
 }}
 const wall=Array.from({length:5},(_,i)=>material('#ffffff',facade(modern,i)));
 const groundGeometry=new T.PlaneGeometry(6000,6000),uv=groundGeometry.attributes.uv;
 for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*1400,uv.getY(i)*1400);
 const ground=new T.Mesh(groundGeometry,material(modern?'#bdbeb4':'#ceb99e',streetTexture(modern?'concrete':'gravel')));
 ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;group.add(ground);
 const roads=material(modern?'#9c9e9f':'#c2af92',streetTexture(modern?'asphalt':'gravel'));
 const path=material(modern?'#cfd1c9':'#ddd0b4',streetTexture(modern?'concrete':'gravel')),curb=mat(modern?'#b1b3ae':'#c2b398');
 for(let road of geo.roads){let pedestrian=['footway','service','steps','path','pedestrian'].includes(road.type);
 if(changhua&&['211886398','295382030'].includes(road.id))continue;
 if(kaohsiung&&!modern&&(road.name==='站東路'||road.name==='站西路'||road.points.every(p=>Math.abs(p[0])<130&&p[1]<43&&p[1]>-250)))continue;
 if(!modern&&pedestrian)continue;if(pedestrian&&road.points.length>4&&road.points[0].toString()===road.points.at(-1).toString())continue;let width=road.width*(modern?1:.86);if(!pedestrian)strip(road.points,width+.38,.028,curb);strip(road.points,width,pedestrian?.042:.052,pedestrian?path:roads);
 if(modern&&['primary','secondary'].includes(road.type)){for(let j=1;j<road.points.length;j++){const a=road.points[j-1],b=road.points[j],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(l<13)continue;const t=4.5/l;strip([[a[0]+dx*t,a[1]+dz*t],[b[0]-dx*t,b[1]-dz*t]],.14,.074,mat('#c7b789'))}}
 if(!pedestrian&&road.points.length>1){let p=road.points[0],q=road.points[1],len=Math.hypot(q[0]-p[0],q[1]-p[1]);if(len>20&&rng()>.51){let f=.55,x=p[0]+(q[0]-p[0])*f,z=p[1]+(q[1]-p[1])*f,ux=(q[0]-p[0])/len,uz=(q[1]-p[1])/len;
 if(modern){let angle=Math.atan2(ux,uz);inst('box',['#b28467','#ede0b9','#6e8886','#899789'][Math.floor(rng()*4)],x-uz*2,.64,z+ux*2,1.65,.85,3.9,angle);inst('box','#607574',x-uz*2,1.27,z+ux*2,1.42,.65,2.2,angle)}
 if(rng()>.55){tree(x+uz*(width/2+1),z-ux*(width/2+1),.74)}}}}
 for(const river of geo.water){strip(river.points,river.width+3.5,.082,mat('#a59d83'));strip(river.points,river.width,.09,mat(modern?'#85aba1':'#8eaca2'));
 for(let j=1;j<river.points.length;j++){let a=river.points[j-1],b=river.points[j],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);for(let t=1;t<l;t+=2.8){let f=t/l,o=(rng()-.5)*river.width*.83,x=a[0]+dx*f-dz*o/l,z=a[1]+dz*f+dx*o/l;strip([[x-.32,z+.08],[x+.64,z-.12]],.06,.104,mat('#b0c9b6'))}for(let k=5;k<l-3;k+=22){let s=river.width/2+2;tree(a[0]+dx*k/l-dz*s/l,a[1]+dz*k/l+dx*s/l,.82)}}}
 // Raise mapped road crossings above the river surface.
 function crosses(a,b,c,d){const side=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);return side(a,b,c)*side(a,b,d)<0&&side(c,d,a)*side(c,d,b)<0}
 for(const r of geo.roads.filter(r=>!['footway','path','steps'].includes(r.type))){for(let i=1;i<r.points.length;i++){let a=r.points[i-1],b=r.points[i];for(const w of geo.water){for(let j=1;j<w.points.length;j++){let c=w.points[j-1],d=w.points[j];if(!crosses(a,b,c,d))continue;
 let dx=b[0]-a[0],dz=b[1]-a[1],vx=d[0]-c[0],vz=d[1]-c[1],s=((c[0]-a[0])*vz-(c[1]-a[1])*vx)/(dx*vz-dz*vx),length=Math.hypot(dx,dz),x=a[0]+s*dx,z=a[1]+s*dz,u=dx/length,v=dz/length,half=w.width*.5+2;strip([[x-u*half,z-v*half],[x+u*half,z+v*half]],r.width,.19,roads);for(const sign of [-1,1]){let cx=x-v*r.width*.5*sign,cz=z+u*r.width*.5*sign;inst('box','#a49d84',cx,.75,cz,.24,.32,half*2,Math.atan2(u,v));for(let n=-half;n<=half;n+=3)inst('box','#b9ad91',cx+u*n,.58,cz+v*n,.32,1.16,.32)}}}}}
 
 const shopSigns=['布莊','商行','茶行','米店','旅社','雜貨'];const signMats=shopSigns.map(s=>material('#ffffff',signage(s,modern)));
 function shell(p,y0,y1,materialWall,roof){for(let i=0;i<p.length;i++){let a=p[i],b=p[(i+1)%p.length],l=Math.hypot(a[0]-b[0],a[1]-b[1]);quad(materialWall,[a[0],y0,a[1]],[b[0],y0,b[1]],[b[0],y1,b[1]],[a[0],y1,a[1]],Math.max(1,Math.round(l/6)),Math.max(1,Math.round((y1-y0)/3.5)))}cap(p,y1,roof)}
 function pitched(p,cy,top,c,h){let longest=0,ux=1,uz=0;for(let i=0;i<p.length;i++){let a=p[i],b=p[(i+1)%p.length],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(l>longest){longest=l;ux=dx/l;uz=dz/l}}
 const transverse=q=>-uz*q[0]+ux*q[1],ts=p.map(transverse),lo=Math.min(...ts),hi=Math.max(...ts),mid=(lo+hi)/2;
 const height=q=>cy+.012+h*Math.max(0,1-Math.abs(transverse(q)-mid)/Math.max(.01,mid-lo));
 function addFace(points){for(let j=2;j<points.length;j++){const face=[points[0],points[j-1],points[j]];triangle(top,...face.map(q=>[q[0],height(q),q[1]]),face.flatMap(q=>[q[0]/3,q[1]/3]))}}
 const faces=T.ShapeUtils.triangulateShape(p.map(q=>new T.Vector2(...q)),[]);
 for(const ids of faces)for(const sign of [-1,1]){
   const face=ids.map(i=>p[i]),clipped=[];
   for(let i=0;i<3;i++){const a=face[i],b=face[(i+1)%3],da=(transverse(a)-mid)*sign,db=(transverse(b)-mid)*sign;
     if(da>=0)clipped.push(a);
     if(da*db<0){const t=da/(da-db);clipped.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])])}}
   addFace(clipped);
 }
 for(let i=0;i<p.length;i++){
   const a=p[i],b=p[(i+1)%p.length],ta=transverse(a)-mid,tb=transverse(b)-mid,edge=[a];
   if(ta*tb<0){const t=ta/(ta-tb);edge.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])])}edge.push(b);
   for(let j=1;j<edge.length;j++){const q=edge[j-1],r=edge[j];quad(top,[q[0],cy,q[1]],[r[0],cy,r[1]],[r[0],height(r),r[1]],[q[0],height(q),q[1]])}
 }}
 // Street-facing shopfronts have a recessed dark opening, projecting canopy and piers.
 const shopFront=modern?['#6b837b','#a76550','#b29b65','#8a9890']:['#89765e','#a88160','#748173','#a18f70'];
 function frontage(p,c,modern,eye,market){
   for(let j=0;j<p.length;j++){let a=p[j],b=p[(j+1)%p.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<6||len>105)continue;
     let ux=dx/len,uz=dz/len,nx=-uz,nz=ux;if(nx*((a[0]+b[0])/2-c[0])+nz*((a[1]+b[1])/2-c[1])<0){nx=-nx;nz=-nz}
     function point(t,y,d){return [a[0]+ux*t+nx*d,y,a[1]+uz*t+nz*d]}
     let bays=Math.max(1,Math.round(len/(eye?4.4:5.8))),step=len/bays;
     for(let i=0;i<bays;i++){let start=i*step+.18,end=(i+1)*step-.18;let glass=mat(eye?'#4d5547':modern?'#59706b':'#746c58');quad(glass,point(start,.12,.11),point(end,.12,.11),point(end,2.7,.11),point(start,2.7,.11));
       const col=mat(eye?'#ba846c':modern?'#b9b8a6':'#c5b398');quad(col,point(start,.1,.58),point(start+.24,.1,.58),point(start+.24,3.12,.58),point(start,3.12,.58));
       let shade=mat(shopFront[(i+(eye?2:0))%4]);quad(shade,point(start,3.16,.09),point(end,3.16,.09),point(end,2.94,1.14),point(start,2.94,1.14));
       if((market||eye||modern)&&i%3===1){let labels=eye?eyeSign:market?marketSign:signMats[(i+j)%6];quad(labels,point(start+.2,3.18,.15),point(end-.2,3.18,.15),point(end-.2,4.12,.15),point(start+.2,4.12,.15))}
     }
   }
 }
 const eyeSign=material('#ffffff',signage('宮原眼科',modern)),marketSign=material('#ffffff',signage(modern?'東協廣場':'第一市場',modern));
 for(const b of geo.buildings){const p=b.points,c=centre(p);
 if(kaohsiung&&(['257770396','1298938833','1298938834'].includes(b.id)||(!modern&&Math.abs(c[0])<148&&c[1]>-230&&c[1]<10)))continue;
 if(taipei&&b.utility){
   if(modern){shell(p,.06,b.height,mat('#a89f90'),mat('#83877f'));
     for(let j=0;j<p.length;j++){const a=p[j],v=p[(j+1)%p.length],dx=v[0]-a[0],dz=v[1]-a[1],l=Math.hypot(dx,dz);if(l<2.8)continue;
       const off=Math.sign(-dz*((a[0]+v[0])/2-c[0])+dx*((a[1]+v[1])/2-c[1]))||1;
       const at=(t,y)=>[a[0]+dx*t-off*dz*.045/l,y,a[1]+dz*t+off*dx*.045/l];
       for(let y=.65;y<b.height-.5;y+=.36)quad(mat('#717976'),at(.12,y),at(.88,y),at(.88,y+.11),at(.12,y+.11))}}
   continue;
 }
 if(taipei&&(b.id==='23641610'||!modern&&((c[0]>-275&&c[0]<103&&c[1]>-83&&c[1]<72)||b.id==='204711206')))continue;
 if(changhua&&['220285047','254298293','315751658'].includes(b.id))continue;
 if(['223056023','322998166','442234244','888036277','888036278','888036279','888036280','888036281','888315735','888315736','888315737','888315738'].includes(b.id))continue;
 const yard=changhua&&c[0]>85&&c[0]<206&&c[1]<-205&&c[1]>-340;
 const warehouse=yard||['647483982','1320735264','548159080'].includes(b.id),tower=['871515261','1118931348'].includes(b.id),shelter=b.id==='936563604';
 if(!modern&&(tower||shelter))continue;
 const market=b.id==='339737498',eye=b.id==='654378518', floors=rng(),h=modern?b.height:(eye?8:market?5:3.7+(floors>.36?3.4:0)+(floors>.94?2.8:0));
 current=b;
 buildings.set(b.id,{data:b,height:h,parts:[],detail:null,fixed:market||eye||b.historic==='building'||['train_station','station','church','school','hospital','civic','railway'].includes(b.type)});
 const m=wall[eye?0:Math.floor(rng()*wall.length)],roof=mat(modern?'#b9b5a0':['#946e57','#926548','#a16e52','#777665'][Math.floor(rng()*4)]);
 if(modern&&(tower||b.id==='1118931343')){
   const wallTint=mat(tower?'#aaa8a0':'#cbc4b4'),glazing=mat(tower?'#566971':'#636a69'),frame=mat('#d7d5c7'),recess=mat('#595c57');
   shell(p,.10,h,wallTint,roof);
   for(let j=0;j<p.length;j++){const a=p[j],b=p[(j+1)%p.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<2)continue;
     const outward=Math.sign(-dz*((a[0]+b[0])/2-c[0])+dx*((a[1]+b[1])/2-c[1]))||1;
     const pt=(d,y,dep)=>[a[0]+(dx*d-outward*dz*dep)/len,y,a[1]+(dz*d+outward*dx*dep)/len];
     const face=(m,l,r,y,Y,dep)=>quad(m,pt(l,y,dep),pt(r,y,dep),pt(r,Y,dep),pt(l,Y,dep));
     const bays=Math.max(1,Math.floor(len/(tower?3.0:3.5))),step=len/bays;
     for(let floor=0;floor<Math.round(h/3.3);floor++){const y=floor*3.3;
       for(let k=0;k<bays;k++){const l=k*step+.25,r=(k+1)*step-.28;
         face(recess,l,r,y+.6,y+2.96,.07);face(glazing,l+.13,r-.13,y+.76,y+2.82,.09);
         face(frame,(l+r)/2-.035,(l+r)/2+.035,y+.74,y+2.83,.12);
         if(floor>0&&k%3===1)face(wallTint,r-.72,r-.12,y+.46,y+.83,.23)}
       face(frame,0,len,y+.40,y+.52,.16)}
   }
   continue;
 }
 if(warehouse||shelter){
   const height=shelter?Math.min(h,5):Math.min(h,7.5);
   const side=material(warehouse?'#bcb6a7':'#b7c3c1',streetTexture(warehouse?'brick':'concrete'));
   shell(p,.05,height,side,roof);if(warehouse)pitched(p,height,roof,c,1.65);
   for(let j=0;j<p.length;j++){const a=p[j],b=p[(j+1)%p.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<12)continue;
     const side=Math.sign(-dz*((a[0]+b[0])/2-c[0])+dx*((a[1]+b[1])/2-c[1]))||1;
     const pt=(d,y)=>[a[0]+(dx*d-side*dz*.07)/len,y,a[1]+(dz*d+side*dx*.07)/len];
     for(let d=2;d+3.2<len;d+=7.8)quad(mat('#646c69'),pt(d,.2),pt(d+3.2,.2),pt(d+3.2,3.25),pt(d,3.25));
   }
   buildings.get(b.id).fixed=true;continue;
 }
 shell(p,.05,h,m,roof);if((changhua?Math.hypot(c[0]-30,c[1]-197)<95:Math.hypot(c[0]+62,c[1]-55)<220))frontage(p,c,modern,eye,market);
 if(!modern){if(market){let xs=p.map(v=>v[0]),zs=p.map(v=>v[1]);for(let j=-2;j<=2;j++){let dx=j*7;inst('box','#9e6c51',c[0]+dx,h+1,c[1]+dx,7.5,1.8,Math.min(43,Math.max(...zs)-Math.min(...zs)),.81)}}else pitched(p,h,roof,c,eye?1.3:1.8)}
 if((market||tower)&&modern){const band=mat(tower?'#bdc4c4':'#d1c9ac');for(let y=4;y<h;y+=3.5){for(let j=0;j<p.length;j++){let a=p[j],d=p[(j+1)%p.length];let out=q=>[c[0]+(q[0]-c[0])*1.007,c[1]+(q[1]-c[1])*1.007];a=out(a);d=out(d);quad(band,[a[0],y,a[1]],[d[0],y,d[1]],[d[0],y+.75,d[1]],[a[0],y+.75,a[1]])}}}
 if(market&&!modern){const a=p[0],b=p[1],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz),ux=dx/l,uz=dz/l,vx=uz,vz=-ux;for(let i=0;i<6;i++){let x=a[0]+ux*(8+i*10),z=a[1]+uz*(8+i*10);function v(s,y,t){return[x+s*ux+t*vx,y,z+s*uz+t*vz]}let red=mat('#9b684b');triangle(mat('#ceac80'),v(-5,h,0),v(5,h,0),v(0,h+3.1,0));quad(red,v(-5,h,0),v(0,h+3.1,0),v(0,h+3.1,20),v(-5,h,20));quad(red,v(0,h+3.1,0),v(5,h,0),v(5,h,20),v(0,h+3.1,20))}}
 if(modern&&h>6){let inset=p.map(([x,z])=>[c[0]+(x-c[0])*.64,c[1]+(z-c[1])*.64]);if(eye)shell(inset,h,h+3.7,wall[3],mat('#9baba4'));else if(rng()>.48)inst('trunk','#a4a69a',c[0],h+1,c[1],1.15,1.9,1.15)}
 if((eye||rng()>.52)&&!market){let j=0;while(j<p.length-1&&Math.hypot(p[j+1][0]-p[j][0],p[j+1][1]-p[j][1])<4)j++;let a=p[j],d=p[(j+1)%p.length],l=Math.hypot(d[0]-a[0],d[1]-a[1]);if(l>4&&l<65){let s1=.2,s2=Math.min(.8,.2+5/l),ox=(a[0]+d[0])/2-c[0],oz=(a[1]+d[1])/2-c[1],ll=Math.hypot(ox,oz)||1;let v=(s,y)=>[a[0]+(d[0]-a[0])*s+ox/ll*.13,y,a[1]+(d[1]-a[1])*s+oz/ll*.13];quad(signMats[Math.floor(rng()*6)],v(s1,2.8),v(s2,2.8),v(s2,3.9),v(s1,3.9))}}}
 current=null;
 if(taipei&&modern){
   for(const [x,z] of geo.trees)tree(x,z,.76+rng()*.38);
   for(const p of geo.grass)cap(p,.085,mat('#84a56c'));
   for(const p of geo.plazas)cap(p,.063,mat('#b9bab2'));
 }
 if(geo===window.GEODATA){
 if(window.makeStation){let s=window.makeStation(T,modern);s.position.set(...[66.7,.12,209.2]);s.rotation.y=-2.73;group.add(s);group.add(window.stationForecourt(T,modern))}
 // Tree groups and period lighting on the edges of the station forecourt.
 if(modern){for(const [x,z] of STATION_PRECINCT.trees)tree(x,z,.85+rng()*.48)}
 else for(let i=0;i<10;i++){let u=i<5?-1:1,n=i%5;tree(66.7+u*(33+n*3)-n*3,178+u*(-14)-n*4,.7+n*.06)}
 if(!modern)for(let i=-2;i<=2;i++){let x=59+i*12,z=184-i*5;inst('trunk','#676d59',x,2.25,z,.12,4.5,.12);inst('leaf','#eadab2',x,4.7,z,.47,.64,.47)}
 }
 for(const rail of geo===window.GEODATA?geo.rails:[]){if(rail.type==='disused'||['442234245','442234246','574701710','581277606','653778289'].includes(rail.id))continue;strip(rail.points,1.55,.061,mat(modern?'#a5a496':'#948e78'))}
 for(let [m,b] of bucket){let g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(b.uv,2));g.computeVertexNormals();let mesh=new T.Mesh(g,m);track(mesh,b.ranges,false);mesh.receiveShadow=true;mesh.castShadow=m.map!==null||!([roads,curb,path].includes(m));group.add(mesh)}
 for(const b of instances.values()){const foliage=b.shape==='spray';const m=foliage?new T.MeshLambertMaterial({map:streetTexture('leaves'),alphaTest:.37,color:b.color,side:T.DoubleSide}):mat(b.color);const mesh=new T.InstancedMesh(shapes[b.shape],m,b.m.length);if(foliage)mesh.userData.foliage=true;b.m.forEach((m,i)=>mesh.setMatrixAt(i,m));track(mesh,b.ranges,true);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh)}
 if(kaohsiung)addKaohsiungStation(T,group,modern,geo);else if(taipei)addTaipeiStation(T,group,modern);else if(changhua)addChanghuaRail(T,group,modern);else if(modern)addStationPrecinct(T,group);
 const people=makePedestrians(T,modern,kaohsiung?'kaohsiung':taipei?'taipei':changhua?'changhua':'taichung');group.userData.people=people;group.add(people.group);
 return group;
};
})();
