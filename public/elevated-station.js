/* Station-local metres. The five tracks and three platform polygons are from OSM.
   Roof plan control points follow aerial imagery; secondary steelwork is interpretive. */
window.buildElevatedStation = function(T,group,{box,quad,triangle,beam}){
  const concrete='#b3b4ae', cap='#ced0c9', steel='#bfc8c7', dark='#526368', soffit='#889497';
  const cs=Math.cos(-2.73),sn=Math.sin(-2.73);
  function local([x,z]){x-=66.7;z-=209.2;return [x*cs-z*sn,x*sn+z*cs]}
  function slab(p,base,top,side,topColor){
    const face=p.map(([x,z])=>[x,top,z]);
    for(const [a,b,c] of T.ShapeUtils.triangulateShape(p.map(q=>new T.Vector2(...q)),[]))triangle(face[c],face[b],face[a],topColor);
    p.forEach(([x,z],i)=>{const [u,v]=p[(i+1)%p.length];quad([x,base,z],[u,base,v],[u,top,v],[x,top,z],side)});
  }
  function trackStrip(p,width,y,color){
    for(let i=1;i<p.length;i++){const [x,z]=p[i-1],[u,v]=p[i],length=Math.hypot(u-x,v-z);if(length<.03)continue;
      const a=(z-v)/length*width/2,b=(u-x)/length*width/2;
      quad([x+a,y,z+b],[u+a,y,v+b],[u-a,y,v-b],[x-a,y,z-b],color);
    }
  }
  // Under the rail deck is an open concourse supported by paired structural piers.
  const deck=[[-335,-58],[-304,-66],[-190,-69],[-127,-72],[13,-65],[17,-28],[-120,-24],[-320,-20],[-335,-23]];
  slab(deck,12.8,14.3,concrete,'#797d7a');
  const lobby=[[-284,-57],[-148,-67],[-58,-64],[-40,-46],[-117,-35],[-118,-13],[-178,-12],[-191,-34],[-279,-31]];
  slab(lobby,5.4,6.25,'#91968e','#bac0b7');
  for(let x=-319;x<14;x+=14){
    for(let z of [-57,-33]){box(x,6.4,z,1.55,12.8,1.7,concrete);box(x,11.8,z,3.2,1.35,2.6,cap)}
    box(x,12.4,-45,1.56,1.12,31,cap);
  }
  for(const p of STATION_PRECINCT.platforms)slab(p.map(local),14.35,15.22,'#979f9b','#d7d6c9');
  for(const track of STATION_PRECINCT.tracks){
    const p=track.map(local),inside=p.filter(([x])=>x>=-365&&x<=45);
    trackStrip(inside,2.3,14.37,'#676863');
    for(let i=1;i<inside.length;i++){
      const [x,z]=inside[i-1],[u,v]=inside[i],len=Math.hypot(u-x,v-z);if(len<.1)continue;
      for(const side of [-.535,.535]){const a=(z-v)*side/len,b=(u-x)*side/len;beam([x+a,14.48,z+b],[u+a,14.48,v+b],.11,.13,steel)}
    }
  }
  // Recessed glazed concourse and an open west-facing approach beneath the great roof.
  for(let x=-266;x<-47;x+=3.4){const z=-31.2-(x+266)*.021;
    const tone=['#6e898b','#718c8c','#668185','#769091'][Math.abs(Math.floor(x/3.4))%4];
    quad([x,6.4,z],[x+3.3,6.4,z],[x+3.3,12.2,z],[x,12.2,z],tone);
    box(x,9.3,z+.08,.14,6.15,.18,steel);box(x+1.65,9.7,z+.08,3.3,.10,.15,steel);
  }
  slab([[-184,-26],[-116,-26],[-119,-.6],[-181,-.6]],5.45,6.2,'#919998','#c2c4ba');
  // West forecourt stairs/landing; risers and handrails remain legible from street level.
  for(let i=0;i<31;i++){const h=6.18-i*.193;box(-150,h/2,-.3+i*.60,37,h,.61,i%2?'#b7b8ad':'#bfc0b4')}
  for(const x of [-168.4,-150,-131.6]){
    beam([x,7.18,-.5],[x,1.25,18.3],.09,.09,steel);
    for(let i=0;i<=30;i+=3)box(x,6.7-i*.193,-.3+i*.60,.065,.98,.065,steel);
  }
  function sheet(point,nu,nv){
    for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){
      const u=i/nu,v=j/nv,U=(i+1)/nu,V=(j+1)/nv;
      const a=point(u,v),b=point(U,v),c=point(U,V),d=point(u,V);
      const roof=['#c5c9c8','#bfc6c6','#cdd1cf','#c5cbca'][(i*7+j*3)%4];
      quad(a,b,c,d,roof);
      const low=p=>[p[0],p[1]-.42,p[2]];quad(low(d),low(c),low(b),low(a),soffit);
      if(j===0)quad(a,b,low(b),low(a),cap);
      if(j===nv-1)quad(c,d,low(d),low(c),cap);
      if(i===0)quad(d,a,low(a),low(d),cap);
      if(i===nu-1)quad(b,c,low(c),low(b),cap);
    }
  }
  // The tracks run lengthwise. Their two articulated wings stop at the higher transverse roof.
  function wing(left,right){
    const n=Math.max(4,Math.round((right-left)/8));
    function roof(u,v){let x=left+(right-left)*u;
      const front=-24-(x+155)*.035,back=-66-(x+115)*.012;
      const width=front-back;
      return [x,23.3+4.8*Math.sin(v*Math.PI)+1.25*Math.sin((x+308)/48),back+width*v];
    }
    sheet(roof,n,9);
    for(let i=0;i<=n;i++){
      let u=i/n;
      for(let j=0;j<9;j++){
        let a=roof(u,j/9),b=roof(u,(j+1)/9);
        beam([a[0],a[1]-.5,a[2]],[b[0],b[1]-.5,b[2]],.28,.3,dark);
      }
      if(i%2===0){
        const p=roof(u,.5);box(p[0],19.4,p[2],.49,8.4,.53,dark);
        for(const v of [.12,.86]){const q=roof(u,v);beam([p[0],20.7,p[2]],[q[0],q[1]-.6,q[2]],.31,.34,steel)}
      }
    }
    for(let i=0;i<n-1;i++){let u=(i+.15)/n,U=(i+.81)/n;
      for(let j=1;j<=2;j++){let v=.18+j*.13,V=v+.095;
        const rise=p=>[p[0],p[1]+.1,p[2]];quad(rise(roof(u,v)),rise(roof(U,v)),rise(roof(U,V)),rise(roof(u,V)),'#657c86');
      }
    }
  }
  wing(-309,-183);wing(-119,10);
  // The higher roof bridges the tracks in the other direction and projects into the square.
  function crossing(u,v){
    const arch=Math.sin(Math.PI*u),zFront=30+12.6*Math.sin(Math.PI*(u*.9+.03));
    return [-185+64*u+2.1*Math.sin(v*Math.PI),28.1+7.4*arch+1.25*Math.sin(Math.PI*v),-74.6+(zFront+74.6)*v];
  }
  sheet(crossing,20,16);
  for(let j=0;j<=16;j+=2){const v=j/16;
    for(let i=0;i<20;i++){const a=crossing(i/20,v),b=crossing((i+1)/20,v);
      const low=p=>[p[0],p[1]-1.68,p[2]];
      beam(low(a),low(b),.33,.3,dark);beam([a[0],a[1]-.4,a[2]],low(b),.13,.13,steel);
    }
  }
  function underside(x,z){
    let u=Math.min(1,Math.max(0,(x+185)/64)),v=0;
    for(let i=0;i<4;i++){
      const front=crossing(u,1)[2];v=Math.min(1,Math.max(0,(z+74.6)/(front+74.6)));
      u=Math.min(1,Math.max(0,(x+185-2.1*Math.sin(v*Math.PI))/64));
    }
    return crossing(u,v)[1]-.38;
  }
  for(let z of [-62,-39,-16,13,29])for(let x of [-174,-132]){
    const h=z>0?0:15.2;const foot=[x,h,z];
    const fork=[x+.7,h+(27-h)*.53,z-1];beam(foot,fork,.95,.95,'#959f9e');
    for(let s of [-1,1]){const xx=x+s*6.5,zz=z+s*4.1,top=[xx,underside(xx,zz),zz];beam(fork,top,.55,.55,steel)}
  }
  // Fine vertical fins and glazing on the frontal arch above the open portal.
  for(let i=0;i<48;i++){
    const a=crossing(i/48,1),b=crossing((i+1)/48,1),base=26.7;
    quad([a[0],base,a[2]-.8],[b[0],base,b[2]-.8],[b[0],b[1]-.6,b[2]-.8],[a[0],a[1]-.6,a[2]-.8],i%3?'#7c969a':'#8da4a5');
    beam([a[0],base,a[2]-.5],[a[0]+.28,a[1]-.55,a[2]-.5],.14,.17,'#d0d4cd');
  }
  // The deep front fascia carries the glazing. Dark chords below it frame the open approach.
  for(let i=0;i<32;i++){
    const a=crossing(i/32,1),b=crossing((i+1)/32,1);
    const sill=p=>[p[0],26.65,p[2]-.3],edge=p=>[p[0],p[1]-.32,p[2]+.08];
    beam(sill(a),sill(b),.36,.55,'#455358');beam(edge(a),edge(b),.45,.57,cap);
    if(i%2===0)beam(sill(a),edge(b),.12,.18,'#65777a');
  }
  for(const u of [.08,.28,.50,.72,.92]){
    for(let j=0;j<16;j++){const a=crossing(u,j/16),b=crossing(u,(j+1)/16);
      beam([a[0],a[1]-1.6,a[2]],[b[0],b[1]-1.6,b[2]],.22,.23,dark);
    }
  }
  // Longitudinal station enclosure and high strip windows below the platform canopy.
  for(let x=-276;x<-32;x+=4.0){
    const z=-29.7-(x+276)*.025;
    quad([x,7.1,z],[x+3.94,7.1,z],[x+3.94,12.25,z],[x,12.25,z],x%12?'#68838a':'#58727a');
    box(x,9.7,z+.13,.13,5.33,.21,steel);
    for(const y of [7.4,9.2,11.98])box(x+2,y,z+.15,4,.13,.25,cap);
  }
  for(let x=-303;x<6;x+=3.6){
    for(const z of [-65,-26]){box(x,15.75,z,.10,1.35,.11,dark);box(x+1.8,16.37,z,3.65,.085,.085,steel)}
  }
  const n=document.createElement('canvas');n.width=1024;n.height=128;const ctx=n.getContext('2d');
  ctx.fillStyle='#273e40';ctx.fillRect(0,0,1024,128);ctx.fillStyle='#f8f8ed';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 66px "Microsoft JhengHei",sans-serif';ctx.fillText('臺 中 車 站   Taichung Station',512,66,970);
  const tex=new T.CanvasTexture(n);tex.colorSpace=T.SRGBColorSpace;
  const name=new T.Mesh(new T.PlaneGeometry(18,2.25),new T.MeshLambertMaterial({map:tex,side:T.DoubleSide}));name.position.set(-149,11.8,-12.1);group.add(name);
};

