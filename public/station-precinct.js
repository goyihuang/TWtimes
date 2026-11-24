/* Plaza, pedestrian crossings, rail warehouses and bus islands in map metres. */
window.addStationPrecinct=function(T,world){
 const D=STATION_PRECINCT, group=new T.Group();group.name='臺中車站廣場與轉運區';
 const surfaces=new Map(), blocks=new Map(),poles=[];
 function material(name,color,tex){
   if(surfaces.has(name))return surfaces.get(name);
   const m=new T.MeshStandardMaterial({color,map:tex?window.streetTexture(tex):null,roughness:.88,metalness:.035,side:T.DoubleSide});
   surfaces.set(name,m);return m;
 }
 const paving=material('paving','#d3d2c9','pavers'),kerb=material('edge','#a8aaa2','concrete');
 const grass=material('lawn','#719054','gravel'), white=material('marking','#f4f2df');
 const metal=material('steel','#747e7c'), stone=material('stone','#969d96','concrete');
 function surface(p,y,m,period=4){
   if(p.length<3)return;
   const indices=T.ShapeUtils.triangulateShape(p.map(v=>new T.Vector2(...v)),[]);
   const vertices=[],uv=[];for(const ids of indices)for(const i of [ids[2],ids[1],ids[0]]){
     vertices.push(p[i][0],y,p[i][1]);uv.push(p[i][0]/period,p[i][1]/period);
   }
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();
   const mesh=new T.Mesh(g,m);mesh.receiveShadow=true;group.add(mesh);
 }
 function box(m,x,y,z,w,h,d,yaw=0){const o=new T.Object3D();o.position.set(x,y,z);o.scale.set(w,h,d);o.rotation.y=yaw;o.updateMatrix();if(!blocks.has(m))blocks.set(m,[]);blocks.get(m).push(o.matrix)}
 function line(a,b,y,m,w,h){
   const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
   if(length>.02)box(m,(a[0]+b[0])/2,y,(a[1]+b[1])/2,w,h,length,Math.atan2(dx,dz));
 }
 // The western square extends between Jianguo Road, the heritage station and the new concourse.
 surface([[32,153],[48,139],[98,138],[160,109],[179,113],[202,155],[193,171],[89,211],[38,227],[8,202],[-3,190],[10,163]],.018,paving);
 for(const p of D.paving)surface(p,.065,paving);
 for(const p of D.grass){surface(p,.125,grass,5);p.forEach((q,i)=>line(q,p[(i+1)%p.length],.105,kerb,.20,.20))}
 for(const p of D.islands){
   surface(p,.19,paving);p.forEach((q,i)=>line(q,p[(i+1)%p.length],.115,kerb,.21,.23));
   const a=p[0],b=p[Math.floor(p.length/2)],x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
   box(metal,x,1.46,z,.08,2.6,.08);box(material('stop','#356d65'),x,2.52,z,.55,.64,.08);
 }
 for(const path of D.crosswalks){
   for(let j=1;j<path.length;j++){const a=path[j-1],b=path[j],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);
     for(let s=.42;s<l;s+=.93)box(white,a[0]+dx*s/l,.105,a[1]+dz*s/l,3.25,.012,.43,Math.atan2(dx,dz));
   }
 }
 // Branching street luminaires and signals on the Jianguo Road approach.
 for(const [x,z,yaw] of [[26.3,143,-.3],[64.5,118,-.6],[97.8,143.1,.4],[134,115,.4],...D.lamps.map(p=>[...p,0])]){
   function tube(a,b,r,top=r){
     const u=new T.Vector3(...a),v=new T.Vector3(...b),d=v.clone().sub(u);
     const mesh=new T.Mesh(new T.CylinderGeometry(top,r,d.length(),8),metal);
     mesh.position.copy(u).lerp(v,.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());
     mesh.castShadow=true;poles.push(mesh);
   }
   tube([x,.1,z],[x,5.85,z],.13,.084);
   for(const side of [-1,1]){
     const dx=Math.cos(yaw)*side,dz=Math.sin(yaw)*side;
     const path=[[0,5.55],[.18,6.49],[.57,7.15],[1.23,7.63],[2.12,7.92],[3.2,7.99]];
     for(let i=1;i<path.length;i++)tube([x+dx*path[i-1][0],path[i-1][1],z+dz*path[i-1][0]],[x+dx*path[i][0],path[i][1],z+dz*path[i][0]],.067);
     box(stone,x+dx*3.2,7.95,z+dz*3.2,.8,.12,.32,-yaw);
   }
 }
 for(const [x,z] of [[26.3,143],[64.5,118],[97.8,143.1]]){
   line([x,z],[x-4.1,z-2.2],5.4,metal,.14,.14);
   box(material('housing','#343c39'),x-4,5.27,z-2.1,.97,.39,.31,-.5);
   box(material('red','#a94b41'),x-4.28,5.28,z-2.05,.15,.16,.2,-.5);
 }
 for(const [m,list] of blocks){const mesh=new T.InstancedMesh(new T.BoxGeometry(),m,list.length);list.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.castShadow=mesh.receiveShadow=true;group.add(mesh)}
 group.add(...poles);world.add(group);
};

