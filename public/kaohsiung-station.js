/* All plan coordinates are metres east/south of the preserved hall. The roof and
   twin towers follow OSM polygons. Elevations are interpreted from photographs. */
window.addKaohsiungStation = function (T, group, modern, geo) {
  const batches = new Map(), solids = new Map();
  const plaster = '#d7cbb5', stone = '#b7aa94', shade = '#4a4a41';
  const roof = '#535854', tile = '#656a61', edge = '#d7d6cc';
  const steel = '#b8bcb4', glass = '#596d71', white = '#dedfd7';
  const pose = new T.Object3D();
  const unit = {box:new T.BoxGeometry(), column:new T.CylinderGeometry(1,1,1,12)};
  function face(color,a,b,c) {
    if (!batches.has(color)) batches.set(color,[]);
    batches.get(color).push(...a,...b,...c);
  }
  function quad(color,a,b,c,d) {face(color,a,b,c);face(color,a,c,d)}
  function instance(kind,color,x,y,z,w,h,d,angle=0) {
    const key = kind+color;
    if(!solids.has(key)) solids.set(key,{kind,color,matrices:[]});
    pose.position.set(x,y,z);pose.rotation.set(0,angle,0);pose.scale.set(w,h,d);pose.updateMatrix();
    solids.get(key).matrices.push(pose.matrix.clone());
  }
  function box(x,y,z,w,h,d,color) {instance('box',color,x,y,z,w,h,d)}
  function column(x,y,z,r,h,color) {instance('column',color,x,y,z,r,h,r)}
  function beam(a,b,r,color) {
    const start=new T.Vector3(...a),end=new T.Vector3(...b),dir=end.clone().sub(start);
    instance('column',color,0,0,0,r,dir.length(),r);
    pose.position.copy(start).lerp(end,.5);pose.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());pose.updateMatrix();
    solids.get('column'+color).matrices.pop();solids.get('column'+color).matrices.push(pose.matrix.clone());
  }
  function panel(text,x,y,z,w,h,{clock=false}={}) {
    const canvas=document.createElement('canvas');canvas.width=clock?192:768;canvas.height=192;
    const c=canvas.getContext('2d');c.fillStyle=clock?'#544e42':'#cdc3a9';
    if(clock){
      c.translate(96,96);c.beginPath();c.arc(0,0,91,0,Math.PI*2);c.fill();
      c.fillStyle='#f0e8cf';c.beginPath();c.arc(0,0,82,0,Math.PI*2);c.fill();
      c.strokeStyle='#373b33';for(let i=0;i<12;i++){c.rotate(Math.PI/6);c.lineWidth=4;c.beginPath();c.moveTo(0,-67);c.lineTo(0,-77);c.stroke()}
      c.lineWidth=6;c.beginPath();c.moveTo(-35,-20);c.lineTo(0,0);c.lineTo(29,-53);c.stroke();
    }else{c.fillRect(0,0,768,192);c.fillStyle='#3c413a';c.textAlign='center';c.textBaseline='middle';c.font='bold 100px serif';c.fillText(text,384,100,720)}
    const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;
    const mesh=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshLambertMaterial({map:tex,transparent:clock}));
    mesh.position.set(x,y,z);group.add(mesh);
  }
  // Tall hall, recessed three-bay entrance and the smaller roof above its clock.
  box(0,4.95,-3.3,23.8,9.9,21.9,plaster);
  box(0,.57,-3.2,24.05,1.14,22.05,stone);
  box(0,9.75,-3.25,24.55,.45,22.65,stone);
  box(0,9.46,-3.25,24.35,.15,22.5,'#b2aa98');
  box(0,5.12,-3.25,24.05,.14,22.14,'#c6bba5');
  box(0,4.45,10.65,20.9,.65,8.35,plaster);
  box(0,4.08,11.55,22,.22,8.1,roof);
  for(const x of [-9.1,-3.1,3.1,9.1])box(x,2.08,13.7,1.0,4.16,1.15,stone);
  for(const x of [-6,0,6]) {
    box(x,1.85,7.69,4.05,3.7,.14,shade);
    box(x,6.8,7.69,3.1,2.8,.14,shade);
    box(x,6.8,7.8,.13,2.8,.12,stone);
    for(const dx of [-1.73,1.73]){
      box(x+dx,7.05,7.83,.23,3.65,.29,plaster);
      box(x+dx,8.93,7.86,.47,.24,.38,stone);
    }
    box(x,7.52,7.8,3.1,.13,.12,stone);
    box(x,8.56,7.87,3.65,.24,.34,plaster);
    box(x,2,7.82,.14,3.65,.15,'#706658');
  }
  for(const sign of [-1,1])for(const z of [-11,-6,-1,4]){
    box(sign*11.96,6.7,z,.16,3.4,2.35,shade);
    box(sign*12.08,6.7,z,.15,3.4,.16,stone);
    box(sign*12.08,8.55,z,.34,.21,2.85,stone);
    box(sign*12.02,2.4,z,.18,2.5,1.55,shade);
  }
  box(0,10.45,-3.3,17.6,1.2,16.1,plaster);
  function roofPoint(side,u,v) {
    const x=u*(10.7-7.5*v), z=9.65*(1-v), y=10.88+2.94*v*v+.47*Math.pow(Math.abs(u),5)*(1-v);
    if(side===0||side===2)return [x,y,-3.3+(side===0?z:-z)];
    return [(side===1?1:-1)*(10.7-7.5*v),y,-3.3+u*z];
  }
  for(let side=0;side<4;side++)for(let i=0;i<42;i++)for(let j=0;j<5;j++){
    const u=i/21-1,v=j/5;
    quad(i%3===0?tile:roof,roofPoint(side,u,v),roofPoint(side,u+1/21,v),roofPoint(side,u+1/21,v+.2),roofPoint(side,u,v+.2));
  }
  beam([-3.4,13.85,-3.3],[3.4,13.85,-3.3],.17,tile);
  for(const s of [-1,1]){
    beam([s*3.05,13.84,-3.3],[s*3.31,14.31,-3.3],.13,tile);
    for(const t of [-1,1])for(let k=0;k<8;k++){
      const at=v=>[s*(10.7-7.5*v),11.44+2.51*v*v,-3.3+t*9.65*(1-v)];
      beam(at(k/8),at((k+1)/8),.13,tile);
    }
  }
  for(let i=0;i<40;i++){
    const x=-5+i*.25, profile=x=>9.68+2.45*Math.pow(1-Math.min(1,Math.abs(x)/5),1.45)+.26*Math.pow(Math.abs(x)/5,5);
    const y=profile(x),next=profile(x+.25);
    quad(plaster,[x,8.8,8],[x+.25,8.8,8],[x+.25,next,8],[x,y,8]);
    quad(roof,[x,y+.12,8.4],[x+.25,next+.12,8.4],[x+.25,next+.12,2],[x,y+.12,2]);
    quad(edge,[x,y,8.42],[x+.25,next,8.42],[x+.25,next+.17,8.42],[x,y+.17,8.42]);
  }
  panel('',0,10.08,8.05,1.52,1.52,{clock:true});
  for(const sign of [-1,1]){
    const cx=sign*9.8;for(let i=0;i<24;i++){const a=i*Math.PI/12,b=(i+1)*Math.PI/12;face(shade,[cx,8.02,7.74],[cx+.48*Math.cos(a),8.02+.48*Math.sin(a),7.74],[cx+.48*Math.cos(b),8.02+.48*Math.sin(b),7.74])}
  }
  panel(modern?'高 雄 車 站':'高 雄 驛',0,4.49,14.87,4.5,.68);
  if (!modern) {
    // Lateral station wings and surface platforms visible in the 1940s.
    for(const side of [-1,1]){
      box(side*32,2.9,-7,40,5.8,12,plaster);box(side*32,5.8,-7,40.6,.35,12.7,stone);
      for(let i=0;i<8;i++)box(side*(15+i*4.8),2.45,-.93,2.9,3.1,.14,shade);
    }
    for(const z of [-26,-49]){
      box(0,.36,z,168,.72,5.8,stone);box(0,4,z,154,.33,6.8,roof);
      for(let x=-70;x<=70;x+=10)column(x,2.1,z,.12,3.65,shade);
      for(const off of [5.6,7.05])box(0,.18,z-off,280,.18,.12,shade);
      for(let x=-137;x<138;x+=1.25)box(x,.08,z-6.32,.23,.14,2.6,'#796954');
    }
    for(const x of [-25,25]){
      instance('column','#aba287',x,.12,32,3.05,.23,3.05);
      instance('column','#86905d',x,.25,32,2.87,.08,2.87);
      column(x,3.6,32,.31,7,'#817a64');
      for(let i=0;i<15;i++){
        const a=i*2.4,len=2.8+(i%4)*.43;
        const pt=(t,s,drop=0)=>[x+len*t*Math.cos(a)-s*Math.sin(a),7+2.9*t-4.25*t*t+(i%3)*.38*t-drop,32+len*t*Math.sin(a)+s*Math.cos(a)];
        for(let k=0;k<18;k++){
          const t=k/18,w=.53*Math.sin(Math.PI*t)+.02;
          quad('#677346',pt(t,-.035),pt(t+.06,-.025),pt(t+.06,.025),pt(t,.035));
          for(const sign of [-1,1])face(i%2?'#536641':'#718053',pt(t,0),pt(t+.04,0),pt(t+.11,sign*w,.23));
        }
      }
    }
  } else {
    const corners=[[-21,7],[20,7],[20,24],[11,43],[-11,43],[-21,26]];
    const paving=new T.BufferGeometry(),vertices=[],uv=[];
    const tris=T.ShapeUtils.triangulateShape(corners.map(p=>new T.Vector2(...p)),[]);
    for(const ids of tris)for(const i of ids){
      const [x,z]=corners[i];vertices.push(x,.081,z);uv.push(x/5,z/5);
    }
    paving.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    paving.setAttribute('uv',new T.Float32BufferAttribute(uv,2));paving.computeVertexNormals();
    const plaza=new T.Mesh(paving,new T.MeshLambertMaterial({color:'#d5cec1',map:streetTexture('pavers'),side:T.DoubleSide}));
    plaza.receiveShadow=true;group.add(plaza);
    for(const x of [-19,17])for(const z of [18,25]){
      box(x,.49,z,.69,.17,3.4,'#8e7862');
      for(const off of [-1.12,1.12])box(x,.23,z+off,.52,.45,.22,stone);
    }
    buildCanopy();buildTowers();
  }
  function buildCanopy() {
    const [outer,...holes]=geo.canopy;
    const height=(x,z)=>3.2+9*Math.min(1,Math.max(0,(-z+35)/80)) + 1.2*Math.cos(x*.028);
    const point=(p,dy)=>[p[0],height(...p)+dy,p[1]];
    const rings=[outer,...holes],all=rings.flat(), vec=ring=>ring.map(([x,z])=>new T.Vector2(x,z));
    const triangles=T.ShapeUtils.triangulateShape(vec(outer),holes.map(vec));
    // Split long chords so the roof rises smoothly from its planted southern tips.
    function surface(a,b,c,depth){
      const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
      if(depth<5&&Math.max(Math.hypot(a[0]-b[0],a[1]-b[1]),Math.hypot(b[0]-c[0],b[1]-c[1]),Math.hypot(c[0]-a[0],c[1]-a[1]))>22){
        const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
        for(const tri of [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]])surface(...tri,depth+1);
      }else{face('#899668',point(a,0),point(b,0),point(c,0));face('#ddd9cb',point(a,-1.05),point(c,-1.05),point(b,-1.05))}
    }
    for(const [i,j,k] of triangles)surface(all[i],all[j],all[k],0);
    for(const ring of rings)ring.forEach((p,i)=>{
      const q=ring[(i+1)%ring.length];quad(white,point(p,.2),point(q,.2),point(q,-1.06),point(p,-1.06));
      quad('#92988b',point(p,.5),point(q,.5),point(q,.35),point(p,.35));
    });
    // The planting beds follow the edge of the roof. Keep paths and light wells clear.
    const inside=(x,z,poly)=>{
      let hit=false;
      for(let i=0,j=poly.length-1;i<poly.length;j=i++){
        const [a,b]=poly[i],[c,d]=poly[j];
        if((b>z)!==(d>z)&&x<(c-a)*(z-b)/(d-b)+a)hit=!hit;
      }
      return hit;
    };
    const planted=(x,z)=>inside(x,z,outer)&&!holes.some(h=>inside(x,z,h));
    const greens=['#76885a','#97a36b','#88935f'];
    for(let i=0;i<outer.length;i++){
      const p=outer[i],q=outer[(i+1)%outer.length],len=Math.hypot(q[0]-p[0],q[1]-p[1]);
      if(len<.15)continue;
      let dx=-(q[1]-p[1])/len,dz=(q[0]-p[0])/len;
      const x=(p[0]+q[0])/2,z=(p[1]+q[1])/2;
      if(!planted(x+dx,z+dz)){dx=-dx;dz=-dz}
      const offset=(v,d)=>point([v[0]+dx*d,v[1]+dz*d],.10);
      if(planted(x+dx*2,z+dz*2))quad('#c9bcaa',offset(p,.6),offset(q,.6),offset(q,2.2),offset(p,2.2));
      if(i%2===0&&planted(x+dx*3.6,z+dz*3.6)){
        const cx=x+dx*3.6,cz=z+dz*3.6;
        instance('column',greens[i%3],cx,height(cx,cz)+.33,cz,1.05,.63,.72,i*.7);
      }
    }
    for(const [x,z] of [[-49,14],[46,21],[-46,-34],[45,-32],[-19,-67],[19,-100],[-66,-136],[93,-152],[-106,-157],[8,-188],[29,-219]]){
      const h=height(x,z)-1.1;column(x,h*.28,z,.43,h*.56,steel);
      for(const dx of [-2.5,2.5])beam([x,h*.53,z],[x+dx,h,z+1.2],.27,steel);
    }
  }
  function buildTowers(){
    for(const [id,light,floors] of [['1298938833',true,10],['1298938834',false,10]]){
      const p=geo.buildings.find(b=>b.id===id).points;
      const center=p.reduce((s,q)=>[s[0]+q[0]/p.length,s[1]+q[1]/p.length],[0,0]);
      const at=(q,y,expand=1)=>[center[0]+(q[0]-center[0])*expand,y,center[1]+(q[1]-center[1])*expand];
      const top=13+floors*3.62;
      for(let i=0;i<p.length;i++){
        const a=p[i],b=p[(i+1)%p.length];
        quad(glass,at(a,7),at(b,7),at(b,top),at(a,top));
        for(let k=0;k<floors;k++){
          const y=13+k*3.62, lift=q=>light?Math.max(0,1-Math.abs(q[0]-center[0]+(k%3-1)*9)/17)*1.35:0;
          quad(light?white:'#787b73',at(a,y+lift(a),1.016),at(b,y+lift(b),1.016),at(b,y+lift(b)+(light?1.64:.62),1.016),at(a,y+lift(a)+(light?1.64:.62),1.016));
        }
        const length=Math.hypot(a[0]-b[0],a[1]-b[1]),bays=Math.ceil(length/2);
        for(let j=0;j<bays;j++){const t=j/bays,q=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];const v=at(q,0,1.003);box(v[0],(top+7)/2,v[2],.11,top-7,.11,steel)}
        face('#95988b',at(a,top),at(b,top),[center[0],top,center[1]]);
      }
    }
  }
  for(const [color,vertices] of batches){
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();
    const mesh=new T.Mesh(geo,new T.MeshLambertMaterial({color,side:T.DoubleSide}));mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
  }
  for(const {kind,color,matrices} of solids.values()){
    const mesh=new T.InstancedMesh(unit[kind],new T.MeshLambertMaterial({color}),matrices.length);
    matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
  }
};
