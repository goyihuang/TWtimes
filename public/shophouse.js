/* Editable street houses. All geometry is in the local map's east/south metre coordinates. */
(function () {
  'use strict';
  const surfaces = new WeakMap();
  const roadFaces = new WeakMap();
  const brick = ['#a86a51','#a86e57','#96624f','#b47a5f'];
  const tile = ['#b5c8bb','#c1bda9','#b9c4cb','#adbbaf'];
  const plaster = ['#d4c6a8','#d6cab3','#c2bba9','#d3bba5'];
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function seeded(seed) {
    return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  }

  function surfaceMap(T, kind, variant) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const c = cv.getContext('2d');
    const rng = seeded(817 + variant);
    const background = {brick:'#baa794', tile:'#a3a79d', plaster:plaster[variant]}[kind];
    c.fillStyle = background;
    c.fillRect(0,0,256,256);
    if (kind !== 'plaster') {
      const rowH = kind === 'brick' ? 16 : 32;
      const colW = kind === 'brick' ? 48 : 32;
      for (let y=0; y<256; y+=rowH) {
        const offset = kind === 'brick' && y % (2*rowH) ? -colW/2 : 0;
        for (let x=offset; x<256; x+=colW) {
          c.fillStyle = (kind === 'brick' ? brick : tile)[variant];
          c.fillRect(x+1,y+1,colW-2,rowH-2);
          c.fillStyle = rng()>.5 ? 'rgba(255,243,219,'+rng()*.16+')' : 'rgba(62,49,38,'+rng()*.15+')';
          c.fillRect(x+1,y+1,colW-2,rowH-2);
          c.fillStyle = '#fff7de37'; c.fillRect(x+1,y+1,colW-2,1);
          c.fillStyle = '#4f534c38'; c.fillRect(x+1,y+rowH-2,colW-2,1);
        }
      }
    }
    for (let i=0;i<4600;i++) {
      c.fillStyle = rng()>.45 ? '#4a4d3b23' : '#fff8d726';
      c.fillRect(rng()*256,rng()*256,1+rng()*2,1+rng()*2);
    }
    const tx = new T.CanvasTexture(cv);
    tx.wrapS = tx.wrapT = T.RepeatWrapping;
    tx.colorSpace = T.SRGBColorSpace;
    tx.anisotropy = 4;
    return tx;
  }

  function shared(T, key, create) {
    if (!surfaces.has(T)) surfaces.set(T,new Map());
    const cache=surfaces.get(T);
    if (!cache.has(key)) cache.set(key,{material:create(),count:0});
    const entry=cache.get(key);
    entry.count++;
    return {material:entry.material, release() {
      if (--entry.count === 0) {
        entry.material.map?.dispose();
        entry.material.dispose();
        cache.delete(key);
      }
    }};
  }

  function signMap(T, name, modern) {
    const cv=document.createElement('canvas');
    cv.width=768; cv.height=192;
    const c=cv.getContext('2d');
    c.fillStyle=modern?'#174e50':'#503d32'; c.fillRect(0,0,cv.width,cv.height);
    c.strokeStyle=modern?'#ccd5bb':'#cbad6f'; c.lineWidth=4; c.strokeRect(9,9,750,174);
    c.lineWidth=1.5; c.strokeRect(16,16,736,160);
    c.fillStyle=modern?'#f2ede1':'#f1d7a3'; c.textAlign='center'; c.textBaseline='middle';
    c.font='bold 108px "Microsoft JhengHei",serif';
    c.fillText(name,384,100,680);
    const tx=new T.CanvasTexture(cv);
    tx.colorSpace=T.SRGBColorSpace; tx.anisotropy=8;
    return tx;
  }

  // Normalize winding so increasing edge distance reads left to right from the street.
  function outline(points) {
    const p=points.filter((v,i)=>Math.hypot(v[0]-points[(i+1)%points.length][0],v[1]-points[(i+1)%points.length][1])>.025);
    const twiceArea=p.reduce((a,v,i)=>a+v[0]*p[(i+1)%p.length][1]-p[(i+1)%p.length][0]*v[1],0);
    return twiceArea>0 ? p.reverse() : p;
  }

  function edge(a,b) {
    const width=Math.hypot(b[0]-a[0],b[1]-a[1]), ux=(b[0]-a[0])/width, uz=(b[1]-a[1])/width;
    return {a,b,width,ux,uz,nx:-uz,nz:ux,
      at(u,y,d=0) {return [a[0]+u*ux-d*uz,y,a[1]+u*uz+d*ux];}
    };
  }

  function streetEdge(building, edges) {
    if (roadFaces.has(building)) return roadFaces.get(building);
    const roads=activeMap()?.roads || [];
    let best=0,bestScore=Infinity;
    // A party wall often lies closer to the road than a narrow shopfront.
    // Sample the outward pavement before preferring an edge by road distance.
    const others=(activeMap()?.buildings||[]).filter(b=>b!==building);
    function covered(x,z){
      return others.some(b=>{
        let inside=false;
        for(let i=0,j=b.points.length-1;i<b.points.length;j=i++){
          const a=b.points[i],v=b.points[j];
          if((a[1]>z)!==(v[1]>z)&&x<(v[0]-a[0])*(z-a[1])/(v[1]-a[1])+a[0])inside=!inside;
        }
        return inside;
      });
    }
    edges.forEach((side,i)=>{
      if (side.width<2.5) return;
      const mid=side.at(side.width/2,0);
      let nearest=Infinity;
      for (const road of roads) {
        if (['path','steps'].includes(road.type)) continue;
        for (let j=1;j<road.points.length;j++) {
          const a=road.points[j-1], b=road.points[j], dx=b[0]-a[0], dz=b[1]-a[1], len2=dx*dx+dz*dz;
          const f=clamp(((mid[0]-a[0])*dx+(mid[2]-a[1])*dz)/(len2||1),0,1);
          const x=a[0]+f*dx-mid[0], z=a[1]+f*dz-mid[2], distance=Math.hypot(x,z);
          const alignment=(x*side.nx+z*side.nz)/(distance||1);
          if (alignment<.36) continue;
          const score=Math.max(.5,distance-road.width*.5)+(1-alignment)*14+(road.type==='service'?3:road.type==='footway'?5:0);
          nearest=Math.min(nearest,score);
        }
      }
      let obstruction=0;
      for(const distance of [1,3.5,6]){
        const test=side.at(side.width/2,0,distance);
        if(covered(test[0],test[2]))obstruction+=distance<2?80:20;
      }
      const score=nearest+obstruction-Math.min(12,side.width)*.08;
      if(score<bestScore) {best=i;bestScore=score;}
    });
    if(!Number.isFinite(bestScore)) best=edges.reduce((a,b,i)=>b.width>edges[a].width?i:a,0);
    roadFaces.set(building,best);
    return best;
  }

  function batch(T) {
    const xyz=[],rgb=[],uv=[];
    const colors=new Map();
    function tri(a,b,c,tint,tex) {
      if(!colors.has(tint)) colors.set(tint,new T.Color(tint));
      const {r,g,b:blue}=colors.get(tint);
      xyz.push(...a,...b,...c); rgb.push(r,g,blue,r,g,blue,r,g,blue); uv.push(...tex);
    }
    function quad(a,b,c,d,tint,w=1,h=1) {
      tri(a,b,c,tint,[0,0,w,0,w,h]); tri(a,c,d,tint,[0,0,w,h,0,h]);
    }
    return {tri,quad, mesh(material) {
      if(!xyz.length) return null;
      const geom=new T.BufferGeometry();
      geom.setAttribute('position',new T.Float32BufferAttribute(xyz,3));
      geom.setAttribute('color',new T.Float32BufferAttribute(rgb,3));
      geom.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
      geom.computeVertexNormals(); geom.computeBoundingSphere();
      const mesh=new T.Mesh(geom,material); mesh.castShadow=mesh.receiveShadow=true; return mesh;
    }};
  }

  function face(target,e,u0,u1,y0,y1,depth,color,textureScale=0) {
    target.quad(e.at(u0,y0,depth),e.at(u1,y0,depth),e.at(u1,y1,depth),e.at(u0,y1,depth),color,
      textureScale?(u1-u0)/textureScale:1,textureScale?(y1-y0)/textureScale:1);
  }

  function block(target,e,u0,u1,y0,y1,d0,d1,color) {
    const a=e.at(u0,y0,d0), b=e.at(u1,y0,d0), c=e.at(u1,y1,d0), d=e.at(u0,y1,d0);
    const A=e.at(u0,y0,d1), B=e.at(u1,y0,d1), C=e.at(u1,y1,d1), D=e.at(u0,y1,d1);
    target.quad(A,B,C,D,color); target.quad(b,a,d,c,color);
    target.quad(d,D,C,c,color); target.quad(a,b,B,A,color);
    target.quad(b,c,C,B,color); target.quad(a,A,D,d,color);
  }

  function arch(target,e,u,y,r,depth,color) {
    for(let i=0;i<12;i++) {
      const p=i*Math.PI/12, q=(i+1)*Math.PI/12;
      const at=(angle,radius)=>e.at(u+Math.cos(angle)*radius,y+Math.sin(angle)*radius,depth);
      target.quad(at(p,r),at(p,r+.19),at(q,r+.19),at(q,r),color);
      target.quad(e.at(u,y,depth-.035),e.at(u+Math.cos(p)*r,y+Math.sin(p)*r,depth-.035),
        e.at(u+Math.cos(q)*r,y+Math.sin(q)*r,depth-.035),e.at(u,y,depth-.035),'#58645b');
    }
  }

  window.makeShopHouse=function makeShopHouse(T,building,config,modern) {
    const group=new T.Group(), p=outline(building.points);
    if(p.length<3) return group;
    const id=String(building.id);
    const seed=[...id].reduce((a,char)=>(a*31+char.charCodeAt(0))>>>0,0);
    const variant=seed%4, floors=clamp(Math.round(Number(config.floors)||1),1,30);
    const finish=['brick','tile','plaster'].includes(config.finish)?config.finish:'plaster';
    const trim=modern?'#d2cab3':'#e2cd9f', frame=modern?'#c5cdbe':'#72543f';
    const metal=modern?'#526261':'#655b47', glass=modern?'#698a88':'#627369';
    const baseH=3.85, storey=modern?3.15:3.5, height=baseH+(floors-1)*storey;
    const edges=p.map((a,i)=>edge(a,p[(i+1)%p.length])), front=edges[streetEdge(building,edges)];
    const mid=front.at(front.width/2,0);
    group.userData.front={x:mid[0],z:mid[2],nx:front.nx,nz:front.nz,width:front.width,height};
    group.userData.buildingId=id;
    const shell=batch(T), details=batch(T), signs=batch(T);
    const unique=[], rented=[];
    function material(key,creator){const lease=shared(T,key,creator);rented.push(lease);return lease.material;}
    const body=material(finish+variant,()=>new T.MeshStandardMaterial({
      map:surfaceMap(T,finish,variant),roughness:finish==='tile'?.57:.92,side:T.DoubleSide,vertexColors:true
    }));
    const detailMaterial=material('trim',()=>new T.MeshStandardMaterial({vertexColors:true,roughness:.78,side:T.DoubleSide}));
    const add=mesh=>{if(mesh)group.add(mesh);};
    const floorTriangles=T.ShapeUtils.triangulateShape(p.map(v=>new T.Vector2(...v)),[]);
    for (const [i,j,k] of floorTriangles) {
      const pt=(idx,y)=>[p[idx][0],y,p[idx][1]];
      details.tri(pt(i,height),pt(j,height),pt(k,height),modern?'#aaa895':'#8d8269',[0,0,1,0,0,1]);
      details.tri(pt(i,.085),pt(j,.085),pt(k,.085),modern?'#b4b5a6':'#bea988',[0,0,1,0,0,1]);
    }

    // Clip the recessed entrance against the parcel at each end. Acute corners
    // can support a shorter arcade than the wide centre section.
    function inside(x,z) {
      let on=false;
      for(let i=0,j=p.length-1;i<p.length;j=i++){
        let a=p[i],b=p[j];
        if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])on=!on;
      }
      return on;
    }
    function validDepth(u,max) {
      let d=max;
      while(d>.05) {const q=front.at(u,.1,-d);if(inside(q[0],q[2])) break;d-=.15;}
      return Math.max(0,d);
    }
    const arcade=clamp(Number(config.arcade)||0,0,3);
    const bays=clamp(Math.round(front.width/4.4),1,16), bay=front.width/bays;
    const soffit='#b7ac91', fascia=modern?'#c6c2a8':'#dbbf89';
    for(const e of edges) {
      if(e!==front || arcade<.1) face(shell,e,0,e.width,.08,height,0,'#ffffff',2.2);
      else if(height>baseH) face(shell,e,0,e.width,baseH,height,0,'#ffffff',2.2);
      block(details,e,0,e.width,height-.19,height+.08,-.08,.19,trim);
      block(details,e,0,e.width,height+.08,height+(modern?.56:.34),-.1,.015,modern?'#b5b6a6':'#ba9d78');
      if(e!==front){
        const bays=Math.min(7,Math.floor(e.width/4.4));
        for(let level=1;level<floors;level++){
          const y=baseH+(level-1)*storey+.85;
          for(let i=0;i<bays;i++){
            const u=(i+.5)*e.width/bays,w=Math.min(2.4,e.width/bays*.58);
            face(details,e,u-w/2,u+w/2,y,y+1.64,.018,metal);
            face(details,e,u-w/2+.07,u-.035,y+.08,y+1.56,.025,glass);
            face(details,e,u+.035,u+w/2-.07,y+.08,y+1.56,.025,glass);
            block(details,e,u-w/2-.09,u+w/2+.09,y-.09,y,.005,.15,trim);
          }
        }
      }
    }
    const name=String(config.sign??'').trim().slice(0,18);
    let previousDepth=0;
    for(let i=0;i<bays;i++){
      const left=i*bay,right=(i+1)*bay,u=(left+right)/2;
      const depth=Math.min(validDepth(left+.16,arcade),validDepth(right-.16,arcade));
      const back=-depth, jamb=Math.min(.25,bay*.06);
      if(arcade>.05){
        face(shell,front,left,right,.08,baseH,back,'#ffffff',2.2);
        const a=front.at(left,baseH-.14,back),b=front.at(right,baseH-.14,back);
        details.quad(a,b,front.at(right,baseH-.14,.04),front.at(left,baseH-.14,.04),soffit);
        // Only close the ends and steps in the back wall, leaving the walkway open across bays.
        const returnWall=(t,d0,d1)=>details.quad(front.at(t,.08,d0),front.at(t,.08,d1),front.at(t,baseH,d1),front.at(t,baseH,d0),soffit);
        if(Math.abs(previousDepth-depth)>.02)returnWall(left,-previousDepth,back);
        if(i===bays-1&&depth>.02)returnWall(right,back,0);
        previousDepth=depth;
        if(depth>.12){
          const paving=(i%2===0 ? '#b1a894' : '#aba594');
          details.quad(front.at(left,.091,0),front.at(right,.091,0),front.at(right,.091,back),front.at(left,.091,back),paving);
        }
        if(depth>.12){
          const col=(t)=>{block(details,front,t-jamb*.67,t+jamb*.67,.1,baseH,-.14,.12,trim);
            block(details,front,t-jamb,t+jamb,.1,.48,-.2,.18,'#908775');
            block(details,front,t-jamb,t+jamb,baseH-.35,baseH-.15,-.21,.2,fascia);};
          col(left+jamb);if(i===bays-1)col(right-jamb);
        }
      }
      const a=left+jamb*1.15,b=right-jamb*1.15;
      face(details,front,a,b,.12,3.05,back+.025,'#3d4943');
      block(details,front,a,a+.11,.12,2.97,back+.03,back+.17,frame);
      block(details,front,b-.11,b,.12,2.97,back+.03,back+.17,frame);
      block(details,front,a,b,2.75,2.93,back+.03,back+.2,frame);
      for(let pane=0;pane<3;pane++){
        const l=a+.14+pane*(b-a-.28)/3,r=a+.14+(pane+1)*(b-a-.28)/3;
        face(details,front,l+.03,r-.03,.2,2.57,back+.065,pane===1?'#50665d':glass);
        block(details,front,l,l+.055,.19,2.68,back+.08,back+.14,frame);
        face(details,front,l+.035,r-.035,.19,.73,back+.145,modern?'#b1b6a7':'#826449');
        if(!modern)block(details,front,l+.03,r-.03,1.89,1.95,back+.09,back+.15,frame);
      }
      if(modern && (i+variant)%3===1){
        face(details,front,a,b,1.91,2.77,back+.22,'#a0a7a1');
        for(let y=1.95;y<2.75;y+=.13)face(details,front,a,b,y,y+.019,back+.23,'#717d78');
      }
      // Sloping striped fabric and the stitched, vertical valance.
      const shadeWidth=b-a, stripeCount=modern?10:8;
      for(let s=0;s<stripeCount;s++){
        const l=a+shadeWidth*s/stripeCount,r=a+shadeWidth*(s+1)/stripeCount;
        const tone=s%2===0?'#ddcdb0':(modern?['#527a74','#9e6255','#708071','#a77e50']:['#786447','#937458','#687468','#a17d58'])[variant];
        details.quad(front.at(l,3.24,.06),front.at(r,3.24,.06),front.at(r,2.95,.93),front.at(l,2.95,.93),tone);
        face(details,front,l,r,2.81,2.95,.93,tone);
      }
      for(let level=1;level<floors;level++){
        const base=baseH+(level-1)*storey, y=base+.62;
        const w=Math.min(bay*.65,3.15), l=u-w/2,r=u+w/2;
        const top=y+(modern?1.82:1.73);
        face(details,front,l-.14,r+.14,y-.09,top+.11,.025,'#675f50');
        face(details,front,l,r,y,top,.043,glass);
        face(details,front,l+.06,u-.06,y+.09,top-.1,.05,modern?'#92aaa1':'#8c9c87');
        for(let xx of [l,u,r])block(details,front,xx-.044,xx+.044,y,top,0,.15,frame);
        block(details,front,l-.08,r+.08,y-.1,y+.025,0,.23,trim);
        block(details,front,l-.08,r+.08,top-.04,top+.05,0,.16,frame);
        block(details,front,l,r,y+1.17,y+1.24,.06,.16,frame);
        if(!modern){
          const radius=Math.min(w*.36,.56);
          arch(details,front,u,top+.04,radius,.09,trim);
          block(details,front,u-.09,u+.09,top+radius-.04,top+radius+.27,.035,.2,fascia);
        }
        if(config.balcony){
          const sideDepth=.86;
          block(details,front,l-.24,r+.24,base+.08,base+.23,-.04,sideDepth,trim);
          block(details,front,l-.23,r+.23,base+1.13,base+1.2,.77,.89,metal);
          for(const xx of [l-.2,r+.2])block(details,front,xx-.03,xx+.03,base+1.12,base+1.18,.06,.86,metal);
          const count=Math.max(3,Math.ceil((w+.4)/.32));
          for(let j=0;j<=count;j++){
            const xx=l-.2+(w+.4)*j/count;
            block(details,front,xx-.025,xx+.025,base+.22,base+1.14,.8,.86,metal);
          }
        }
        if(modern && (level+i+variant)%3===0 && bay>3){
          const acX=r-.54;
          block(details,front,acX-.41,acX+.41,top-.04,top+.39,.02,.43,'#c4c5b8');
          for(let slat=0;slat<5;slat++)face(details,front,acX-.3,acX+.3,top+.024+slat*.055,top+.044+slat*.055,.438,'#71817b');
        }
      }
    }

    // Cornices, pilasters and central pediment give the historic facade its silhouette.
    block(details,front,0,front.width,3.38,baseH+.035,-.02,.22,fascia);
    for(let i=0;i<=bays;i++){
      const u=clamp(i*bay,.12,front.width-.12);
      if(height>baseH+.08)block(details,front,u-.1,u+.1,baseH,height-.08,.005,.17,trim);
      if(!modern)block(details,front,u-.15,u+.15,height-.25,height+.35,-.04,.25,fascia);
    }
    if(!modern){
      const centre=front.width/2,w=Math.min(front.width*.38,3);
      details.tri(front.at(centre-w,height+.1,.12),front.at(centre+w,height+.1,.12),front.at(centre,height+1.45,.12),trim,[0,0,1,0,.5,1]);
      details.tri(front.at(centre-w*.67,height+.21,.13),front.at(centre+w*.67,height+.21,.13),front.at(centre,height+1.06,.13),fascia,[0,0,1,0,.5,1]);
    }
    if(name){
      const w=Math.max(1.2,Math.min(front.width-.28,Math.max(3,Array.from(name).length*1.04))),u=front.width/2;
      const h=clamp(w*.24,.58,1.08), bottom=3.16;
      block(details,front,u-w/2-.08,u+w/2+.08,bottom-.045,bottom+h+.045,.07,.38,modern?'#7d8271':'#8f774c');
      face(signs,front,u-w/2,u+w/2,bottom,bottom+h,.39,'#ffffff');
      const tex=signMap(T,name,modern);
      const plate=new T.MeshStandardMaterial({map:tex,side:T.DoubleSide,roughness:modern?.4:.78});
      unique.push(plate); add(signs.mesh(plate));
    }
    add(shell.mesh(body));add(details.mesh(detailMaterial));
    group.userData.releaseSurface=()=>{for(const lease of rented)lease.release();for(const mat of unique){mat.map.dispose();mat.dispose();}};
    return group;
  };
  window.disposeShopHouse=function disposeShopHouse(group){
    if(!group || group.userData.shopDisposed)return;
    group.userData.shopDisposed=true;
    group.traverse(part=>part.geometry?.dispose());
    group.userData.releaseSurface?.();
    group.clear();
  };
})();


