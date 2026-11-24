/* 臺中驛, an interpretive architectural model. Ground plan aligned with OSM.
   Elevation reference: 臺中市文化資產處「臺中火車站」, and 國定古蹟臺中火車站保存計畫.
   Local metres: +Y up, +Z toward the station forecourt, +X towards the southwest. */
window.makeStation = function makeStation(THREE, modern) {
  const group = new THREE.Group();
  group.name = modern ? '臺中驛與高架站' : '臺中驛';
  const batches=new Map();
  const paint = new Map();
  const brick = '#a85844', darkBrick = '#834535', plaster = '#e5d6b9', stone = '#c2b598';
  const slate = '#655f5d', patina = '#576d67', glass = '#344c4e', shadow = '#393936';
  function triangle(a, b, c, color) {
    const key=color===brick||color===darkBrick?'brick':color===slate?'slate':'plain';
    if(!batches.has(key))batches.set(key,{positions:[],colors:[],uv:[]});
    const batch=batches.get(key);
    const tint=key==='plain'?color:color===darkBrick?'#a79b8c':key==='brick'?'#e3b1a4':'#bbbfc1';
    if(!paint.has(tint))paint.set(tint,new THREE.Color(tint));
    const ink=paint.get(tint);
    batch.positions.push(...a,...b,...c);
    for(let n=0;n<3;n++)batch.colors.push(ink.r,ink.g,ink.b);
    if(key!=='plain'){
      const norm=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).cross(new THREE.Vector3(...c).sub(new THREE.Vector3(...a)));
      const major=Math.abs(norm.y)>Math.max(Math.abs(norm.x),Math.abs(norm.z))?'up':Math.abs(norm.x)>Math.abs(norm.z)?'side':'front';
      for(const [x,y,z] of [a,b,c])batch.uv.push((major==='side'?z:x)/2.7,(major==='up'?z:y)/2.7);
    }
  }
  function quad(a, b, c, d, color) {
    triangle(a, b, d, color);
    triangle(b, c, d, color);
  }
  function box(x,y,z,w,h,d,color) {
    const l=x-w/2,r=x+w/2,b=y-h/2,t=y+h/2,n=z-d/2,f=z+d/2;
    quad([l,b,f],[r,b,f],[r,t,f],[l,t,f],color);
    quad([r,b,n],[l,b,n],[l,t,n],[r,t,n],color);
    quad([r,b,f],[r,b,n],[r,t,n],[r,t,f],color);
    quad([l,b,n],[l,b,f],[l,t,f],[l,t,n],color);
    quad([l,t,f],[r,t,f],[r,t,n],[l,t,n],color);
    quad([l,b,n],[r,b,n],[r,b,f],[l,b,f],color);
  }
  function beam(a,b,width,depth,color) {
    const endA = new THREE.Vector3(...a), endB = new THREE.Vector3(...b);
    const direction = endB.clone().sub(endA).normalize();
    const guide = Math.abs(direction.y) > .95 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,1,0);
    const u = direction.clone().cross(guide).normalize().multiplyScalar(depth/2);
    const v = direction.clone().cross(u).normalize().multiplyScalar(width/2);
    function corners(p) {
      return [[1,1],[-1,1],[-1,-1],[1,-1]].map(([i,j]) =>
        p.clone().addScaledVector(u,i).addScaledVector(v,j).toArray());
    }
    const c=corners(endA), d=corners(endB);
    for(let i=0;i<4;i++) quad(c[i],c[(i+1)%4],d[(i+1)%4],d[i],color);
    quad(...c.slice().reverse(), color);
    quad(...d,color);
  }
  function hip(x,y,z,w,d,h,cut,color) {
    const a=[x-w/2,y,z+d/2], b=[x+w/2,y,z+d/2];
    const c=[x+w/2,y,z-d/2], f=[x-w/2,y,z-d/2];
    const l=[x-w/2+cut,y+h,z], r=[x+w/2-cut,y+h,z];
    quad(a,b,r,l,color); triangle(b,c,r,color); quad(c,f,l,r,color); triangle(f,a,l,color);
    beam(l,r,.14,.14,stone);
    for (const [p,q] of [[a,l],[b,r],[c,r],[f,l]]) beam(p,q,.13,.12,stone);
  }
  function disk(x,y,z,r,color) {
    for (let i=0;i<24;i++) {
      const a=Math.PI*i/12,b=Math.PI*(i+1)/12;
      triangle([x,y,z],[x+r*Math.cos(a),y+r*Math.sin(a),z],[x+r*Math.cos(b),y+r*Math.sin(b),z],color);
    }
  }
  function opening(x,bottom,z,w,h,arch,trim,color=glass) {
    const r=w/2, spring=bottom+h-arch, segments=14;
    box(x,(bottom+spring)/2,z,w,spring-bottom,.10,color);
    for(let i=0;i<segments;i++) {
      const a=Math.PI*i/segments, b=Math.PI*(i+1)/segments;
      const point=(angle,radius,rise,offset)=>[x+radius*Math.cos(angle),spring+rise*Math.sin(angle),z+offset];
      triangle([x,spring,z+.05],point(a,r,arch,.05),point(b,r,arch,.05),color);
      quad(point(a,r,arch,.08),point(a,r+trim,arch+trim,.08),
        point(b,r+trim,arch+trim,.08),point(b,r,arch,.08),i===6||i===7 ? plaster : stone);
    }
    for(const side of [-1,1]) box(x+side*(r+trim/2),(spring+bottom)/2,z+.05,trim,spring-bottom,.14,stone);
    box(x,bottom-.09,z+.10,w+trim*2+.12,.18,.28,plaster);
    box(x,bottom+h*.48,z+.11,w,.075,.07,stone);
    box(x,bottom+h/2,z+.12,.075,h,.07,stone);
  }
  // The central hall and flanking bays share a continuous entablature.
  box(0,.17,0,58.6,.34,15.6,stone);
  box(0,4,0,58,7.6,15,brick);
  box(0,.67,0,58.15,.65,15.12,darkBrick);
  for (const [y,h] of [[1.09,.16],[4.10,.22],[6.99,.20],[7.29,.11],[7.66,.30]]) {
    box(0,y,0,58.23,h,15.22,plaster);
  }
  for(const x of [-27,-22.3,-17.6,-12.9,-8.2,8.2,12.9,17.6,22.3,27]) {
    for(const face of [-1,1]) {
      // Far-side relief is recessed into the wall and reads through the platform canopy.
      const z=face*7.57;
      if(face===1) {
        opening(x,4.40,z,2.12,2.25,.36,.18);
        opening(x,1.18,z,1.65,2.36,.22,.12,'#5f6b61');
      } else box(x,4.0,z,1.8,3.7,.12,glass);
      box(x-1.95,5.65,z,.25,3.50,.34,stone);
      box(x-1.95,7.15,z,.49,.30,.42,plaster);
    }
  }
  // Slate hip with parapet and accent battens.
  hip(0,7.88,0,59.1,16.05,5.25,8.4,slate);
  for(let i=-18;i<=18;i+=1.5) {
    for(const sign of [-1,1]) beam([i,7.92,sign*7.96],[i,13.16,0],.035,.035,'#77716a');
  }
  box(0,7.84,0,59.18,.25,16.13,stone);
  // Four projecting gables, with the broad tripartite arched light over the entrance.
  function gable(z,face) {
    const f=z+face*.10;
    box(0,8,z,12.5,7.2,.57,brick);
    triangle([-6.25,11.55,f],[6.25,11.55,f],[0,15.1,f],plaster);
    box(0,11.32,z,12.5,.7,.60,plaster);
    for(const side of [-1,1]){
      const x=side*6.10;
      box(x,8.15,z,.83,7.8,.88,darkBrick);
      for(const y of [4.52,4.93,10.52,10.91,11.36]) box(x,y,z,1,.22,.97,plaster);
      box(x,11.76,z,1.35,.30,1.17,stone);
      beam([x,11.63,f],[0,15.23,f],.36,.57,stone);
    }
    if(face===1){
      for(const x of [-2.23,0,2.23])opening(x,4.84,z+.35,1.83,x===0?5.86:5.55,.80,.16,glass);
      for(const x of [-1.115,1.115]) box(x,7.72,z+.50,.29,5.80,.24,plaster);
      for(const y of [5.70,6.58,7.46,8.34,9.22]) box(0,y,z+.46,6.60,.044,.085,patina);
      box(0,12.30,z+.43,2.5,2.02,.35,stone);
      disk(0,12.5,z+.65,.73,plaster);disk(0,12.5,z+.68,.46,glass);
      for(const x of [-6.10,6.10]){
        disk(x,11.47,z+.50,.51,plaster);disk(x,11.47,z+.53,.29,stone);
      }
    }
  }
  gable(7.60,1); gable(-7.60,-1);
  for(const side of [-1,1]){
    const x=side*6.3;
    triangle([x,10.05,-5.85],[x,10.05,5.85],[x,14.55,0],plaster);
    beam([x,10.05,-5.85],[x,14.55,0],.30,.35,stone);
    beam([x,10.05,5.85],[x,14.55,0],.30,.35,stone);
  }
  hip(0,10.1,0,13.45,16.0,5.38,6.55,'#656362');
  box(0,15.36,0,2.5,2.79,2.22,stone);
  for(const x of [-1,1]) box(x,15.4,1.14,.22,2.38,.23,plaster);
  if(modern) {
    disk(0,15.58,1.17,.84,shadow);disk(0,15.58,1.20,.68,'#f0e8cf');
    for(let i=0;i<12;i++) {
      const a=i*Math.PI/6;
      beam([.53*Math.sin(a),15.58+.53*Math.cos(a),1.24],
           [.63*Math.sin(a),15.58+.63*Math.cos(a),1.24],.05,.05,shadow);
    }
    beam([0,15.58,1.26],[-.37,15.82,1.26],.08,.05,shadow);
    beam([0,15.58,1.27],[.27,15.97,1.27],.055,.05,shadow);
  } else {
    // The Taichu Station postcard shows dark louvers below the spire.
    for(const face of [-1,1]){
      box(0,15.49,face*1.17,1.54,1.94,.10,shadow);
      for(let y=14.65;y<16.4;y+=.19) box(0,y,face*1.24,1.48,.064,.085,patina);
    }
  }
  box(0,16.86,0,3.05,.42,2.77,patina);
  hip(0,17.1,0,2.70,2.55,1.32,1.29,patina);
  box(0,18.88,0,.065,1.07,.065,shadow);
  // A long, shallow carriage porch on slender columns faces the forecourt.
  box(0,.19,9.95,58.8,.30,5.26,stone);
  for(let x=-27;x<=27;x+=4.5) {
    box(x,2.04,11.85,.20,3.76,.22,plaster);
    box(x,.46,11.85,.37,.60,.37,stone);
    box(x,3.73,11.85,.46,.25,.42,plaster);
    beam([x,3.28,11.85],[x+.65,3.96,11.85],.09,.08,stone);
    beam([x,3.28,11.85],[x-.65,3.96,11.85],.09,.08,stone);
  }
  quad([-29.9,4.48,7.45],[29.9,4.48,7.45],[29.9,3.99,12.47],[-29.9,3.99,12.47],'#8a8374');
  box(0,3.95,12.43,59.9,.19,.19,plaster);
  for(let x=-29.4;x<=29.4;x+=.7) beam([x,4.50,7.5],[x,4.01,12.43],.037,.042,'#a39a87');
  for(const x of [-3.64,0,3.64]){
    opening(x,.42,7.95,2.56,3.42,.38,.14,'#343533');
    box(x,1.91,8.06,.07,2.84,.08,'#94806a');
  }
  function platform(cx,z,length) {
    box(cx,.50,z,length,1,6.30,'#b8ab95');
    for(let x=cx-length/2+3;x<cx+length/2;x+=6){
      box(x,2.80,z,.19,3.65,.20,patina);
      for(const s of [-1,1]) beam([x,3.62,z],[x,4.65,z+s*2.72],.13,.14,patina);
    }
    hip(cx,4.62,z,length,6.70,.58,.9,'#827c70');
  }
  platform(-10,-11,91);
  if(!modern) {
    platform(-14,-23,89);
    for(const z of [-16.35,-15.28,-28.5,-27.43]){
      box(-13,.19,z,111,.20,.12,'#58524a');
    }
    for(let x=-68;x<43;x+=.88) for(const z of [-15.82,-27.96]){
      box(x,.085,z,.18,.14,2.12,'#795f4b');
    }
  } else {
    window.buildElevatedStation(THREE,group,{box,quad,triangle,beam});
  }
  for(const [key,batch] of batches){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(batch.positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(batch.colors,3));
    if(batch.uv.length)geometry.setAttribute('uv',new THREE.Float32BufferAttribute(batch.uv,2));
    geometry.computeVertexNormals();geometry.computeBoundingSphere();
    const m=new THREE.MeshStandardMaterial({map:key==='plain'?null:streetTexture(key),vertexColors:true,roughness:.82,metalness:.04,side:THREE.DoubleSide});
    const station=new THREE.Mesh(geometry,m);station.castShadow=station.receiveShadow=true;group.add(station);
  }
  return group;
};

