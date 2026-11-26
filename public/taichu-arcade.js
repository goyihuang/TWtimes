/* A photo-textured interpretation of the 1930s forecourt. The atlas is the AI
   study shown in the reference viewer. Geometry uses station-local metres. */
window.buildTaichuArcade = function (T) {
  const group = new T.Group();
  group.name = '臺中驛・騎樓取景';
  const texture = new T.TextureLoader().load('taichu-arcade-study.jpg', () =>
    window.dispatchEvent(new Event('street-texture-ready')));
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  const photo = new T.MeshStandardMaterial({map:texture,roughness:.91,side:T.DoubleSide});
  const uv = ([x,y]) => [x/1672,1-y/941];
  const vertices = [], coords = [];
  function panel(corners, pixels) {
    for(const i of [0,1,2,0,2,3]){
      vertices.push(...corners[i]);coords.push(...uv(pixels[i]));
    }
  }
  function facade(x0,x1,y0,y1,z,pixels) {
    panel([[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z]],pixels);
  }
  // Brick bays and the masonry crest remain on separate projecting faces.
  facade(-28.9,-6.45,4.13,7.76,7.96,[[798,489],[951,486],[951,404],[798,416]]);
  facade(6.45,28.9,4.13,7.76,7.96,[[1148,475],[1375,466],[1375,377],[1148,396]]);
  facade(-5.67,5.67,4.57,11.47,8.35,[[984,481],[1107,478],[1107,327],[984,332]]);
  const bottomLeft=[-5.67,11.47,8.35],bottomRight=[5.67,11.47,8.35],tip=[0,14.93,8.35];
  panel([bottomLeft,bottomRight,tip,tip],[[984,332],[1107,327],[1043,273],[1043,273]]);
  // Shadowed transoms and flooring sit behind the free-standing porch columns.
  for(let j=-6;j<=6;j++){
    const x=j*4.45;
    facade(x-2.14,x+2.14,.4,4.05,8.27,[[1047,552],[1086,552],[1086,516],[1047,516]]);
    facade(x-1.05,x+1.05,1.58,3.38,8.30,[[1057,558],[1079,558],[1079,533],[1057,533]]);
  }
  // A waiting puller at the shafts. Cross-sections give the coat, head and
  // bent limbs volume even when the viewer walks around the photographed side.
  const scale=1.69/435;
  function draped(rings,back,depthBias=0){
    const sides=18;
    function sample(row,i,backside){
      const [y,l,r,depth]=row,a=2*Math.PI*i/sides,x=(l+r)/2+Math.cos(a)*(r-l)/2;
      const position=[14.4+(x-123)*scale,(457-y)*scale+.04,42.45+depthBias+depth*Math.sin(a)];
      const pixel=backside?[back[0]+(Math.cos(a)+1)*5,back[1]+y*.015]:[724+x/2,522+y/2];
      return [position,pixel];
    }
    for(let j=1;j<rings.length;j++)for(let i=0;i<sides;i++){
      const backFace=i>=sides/2,q=[sample(rings[j-1],i,backFace),sample(rings[j-1],i+1,backFace),sample(rings[j],i+1,backFace),sample(rings[j],i,backFace)];
      panel(q.map(v=>v[0]),q.map(v=>v[1]));
    }
  }
  const coat=[760,584],pants=[783,675],skin=[788,556],scarf=[775,541];
  draped([[98,91,147,.075],[109,72,157,.11],[129,65,163,.13],[177,65,164,.14],[211,69,159,.12],[245,71,158,.14],[270,73,165,.145]],coat);
  draped([[29,113,132,.04],[34,104,140,.09],[44,100,146,.105],[58,99,147,.11],[71,99,149,.107],[88,103,145,.095],[99,111,137,.075],[116,116,137,.06]],scarf,.015);
  for(const rows of [[[113,65,89,.061],[140,54,80,.07],[178,46,72,.063],[205,44,68,.055]],[[112,148,161,.05],[138,153,171,.062],[177,159,178,.064],[205,166,190,.051]]])draped(rows,coat);
  draped([[205,49,67,.05],[232,51,63,.039],[255,53,64,.031],[268,50,68,.039],[280,53,65,.023]],skin,.02);
  draped([[207,172,187,.05],[232,180,193,.041],[248,187,198,.031],[260,190,205,.037],[270,196,205,.021]],skin,.02);
  draped([[268,76,122,.09],[308,68,114,.103],[343,62,106,.09],[372,61,99,.077]],pants);
  draped([[268,121,154,.088],[308,117,155,.10],[345,115,156,.091],[370,115,154,.075]],pants);
  for(const rows of [[[371,65,90,.063],[402,64,84,.052],[431,63,80,.043],[444,60,82,.059],[454,59,86,.072]],[[369,120,146,.066],[400,120,141,.053],[434,118,135,.041],[444,117,151,.065],[454,114,164,.075]]])draped(rows,skin);
  const facadeCount=vertices.length;
  const propShift=[5.3,0,16.5];
  const patches={
    wood:[368,875,420,905],
    basket:[30,710,125,756],shelf:[4,273,123,433],floor:[307,894,348,929]
  };
  const geo={box:new T.BoxGeometry(),cylinder:new T.CylinderGeometry(1,1,1,12),
    fruit:new T.SphereGeometry(1,12,8),hoop:new T.TorusGeometry(1,.043,6,36)};
  const batches=new Map();
  function mappedGeometry(kind,patch){
    const key=kind+'-'+patch;
    if(!geo[key]){
      const g=geo[kind].clone(),uvs=g.attributes.uv;
      const [u,v,r,b]=patches[patch];
      for(let i=0;i<uvs.count;i++){
        const a=uvs.getX(i),h=uvs.getY(i);
        uvs.setXY(i,(u+(r-u)*a)/1672,1-(b-(b-v)*h)/941);
      }
      geo[key]=g;
    }
    return geo[key];
  }
  function part(kind,material,position,scale,rotation=[0,0,0]){
    const key=kind+' '+material;
    if(!batches.has(key))batches.set(key,{kind,material,matrices:[]});
    const o=new T.Object3D();o.position.set(...position);o.scale.set(...scale);
    o.rotation.set(...rotation);o.updateMatrix();batches.get(key).matrices.push(o.matrix);
  }
  function box(mat,x,y,z,w,h,d){part('box',mat,[x,y,z],[w,h,d])}
  function rod(mat,a,b,r){
    const start=new T.Vector3(...a),end=new T.Vector3(...b),axis=end.clone().sub(start);
    const rot=new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),axis.clone().normalize()));
    part('cylinder',mat,start.lerp(end,.5).toArray(),[r,axis.length(),r],rot.toArray().slice(0,3));
  }
  const profile=[[.38,0],[.38,.14],[.34,.19],[.35,.24],[.30,.32],[.265,.42],[.25,2.99],[.29,3.07],[.33,3.12],[.36,3.20],[.36,3.34]];
  geo.pillar=new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),40);
  geo.bowl=new T.LatheGeometry([[.49,0],[.61,.15],[.72,.40],[.73,.46],[.69,.46],[.54,.13]].map(([r,y])=>new T.Vector2(r,y)),36);
  // The shop looks onto the square from the left edge of the sight line.
  box('floor',8,.11,41,10,.2,12.4);
  box('#40382b',6.4,1.77,41,.45,3.4,12.4);
  box('wood',9.25,3.51,41,8.85,.34,12.6);
  for(const z of [35.2,39.45,43.7,47]){
    part('pillar','stone',[13.22,.2,z],[1,1,1]);
    box('wood',6.78,1.7,z,.25,3,.15);
  }
  for(const z of [37.2,41.55,45.35]){
    panel([[6.68,.65,z+1.84],[6.68,.65,z-1.84],[6.68,2.96,z-1.84],[6.68,2.96,z+1.84]],
      [[4,429],[123,429],[123,274],[4,274]]);
    for(const y of [.73,1.25,1.8,2.42])box('wood',6.82,y,z,.48,.06,3.75);
  }
  // Slightly sagging woven awning, supported by timber poles at both ends.
  const clothPoint=(t,z)=>[12.8+2.45*t,3.53-.60*t-.22*Math.sin(t*Math.PI)+.045*Math.cos(z*3),z];
  for(let bay=0;bay<5;bay++)for(let k=0;k<10;k++){
    const a=k/10,b=(k+1)/10,z=34.9+bay*2.45,Z=z+2.45;
    panel([clothPoint(a,z),clothPoint(b,z),clothPoint(b,Z),clothPoint(a,Z)],
      [[562+88*a,79],[562+88*b,79],[562+88*b,147],[562+88*a,147]]);
  }
  rod('wood',[15.25,2.96,34.7],[15.25,2.96,47.5],.045);
  for(let z=35;z<47.3;z+=.76)rod('wood',clothPoint(0,z),clothPoint(1,z),.018);
  for(const z of [35.2,39.45,43.7,47])rod('wood',[13.2,2.02,z],[15.23,2.94,z],.042);
  let seed=451;function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
  for(const [x,z] of [[11.2,35.6],[11.9,37.2],[12.1,39.2],[11.3,42.1]]){
    for(const y of [.28,.49,.70])for(const dx of [-.46,.46])box('wood',x+dx,y,z,.08,.17,.83);
    for(const dz of [-.39,.39])for(const y of [.28,.49,.70])box('wood',x,y,z+dz,.94,.17,.08);
    part('bowl','basket',[x,.77,z],[.82,.82,.82]);
    for(const y of [.94,1.13])part('hoop','#92764d',[x,y,z],[.58,.58,.58],[Math.PI/2,0,0]);
    for(let j=0;j<38;j++){
      const a=j*2.4,r=.53*Math.sqrt(j/38);
      part('fruit',['#754939','#875d49','#94624d','#97674e'][j%4],
        [x+r*Math.cos(a),1.12+.13*(1-r/.55)+rand()*.055,z+r*Math.sin(a)],
        [.063,.049,.12],[rand(),a,rand()]);
    }
  }
  // A leafy branch and its moving-view parallax frame the sunlit square.
  const leafMatrices=[];const o=new T.Object3D();
  const trunk=[20.8,.14,26.4];
  rod('#696450',trunk,[20.9,3.45,26.3],.135);
  for(let i=0;i<10;i++){
    const a=i*2.4,reach=1.7+rand()*1.7,b=[20.9+reach*Math.cos(a),5.3+rand()*1.35,26.2+reach*Math.sin(a)];
    rod('#6a6453',[20.9,3.25+rand()*.8,26.3],b,.05);
    for(let j=0;j<14;j++){
      o.position.set(b[0]+rand()*1.8-.9,b[1]+rand()*1.25-.6,b[2]+rand()*1.8-.9);
      o.rotation.setFromQuaternion(new T.Quaternion().setFromEuler(new T.Euler(-1.05+rand()*1.5,rand()*6.28,rand()*3.14,'YXZ')));o.scale.setScalar(1+rand()*.65);
      o.updateMatrix();leafMatrices.push(o.matrix.clone());
    }
  }
  const leafMaterial=new T.MeshLambertMaterial({color:'#e1e3ce',map:streetTexture('leaves'),alphaTest:.43,side:T.DoubleSide});
  const leaves=new T.InstancedMesh(new T.PlaneGeometry(),leafMaterial,leafMatrices.length);
  leafMatrices.forEach((m,i)=>leaves.setMatrixAt(i,m));leaves.castShadow=leaves.receiveShadow=true;
  leaves.userData.foliage=true;leaves.position.set(...propShift);group.add(leaves);
  const shopGroup=new T.Group();shopGroup.position.set(...propShift);group.add(shopGroup);
  // Size terrazzo chips in local metres, including the tall single span of the shaft.
  const terrazzo=new T.TextureLoader().load('textures/arcade-terrazzo.jpg',()=>
    window.dispatchEvent(new Event('street-texture-ready')));
  terrazzo.wrapS=terrazzo.wrapT=T.RepeatWrapping;terrazzo.colorSpace=T.SRGBColorSpace;terrazzo.anisotropy=4;
  const stoneMaterial=new T.MeshStandardMaterial({map:terrazzo,bumpMap:terrazzo,bumpScale:.006,roughness:.69});
  const puv=geo.pillar.attributes.uv;
  for(let i=0;i<puv.count;i++)puv.setXY(i,puv.getX(i)*1.7,geo.pillar.attributes.position.getY(i)*1.05);
  for(const {kind,material,matrices} of batches.values()){
    const textured=material!=='stone'&&!!patches[material],g=textured?mappedGeometry(kind,material):geo[kind];
    const mat=material==='stone'?stoneMaterial:textured?photo:new T.MeshStandardMaterial({color:material,roughness:.86});
    const mesh=new T.InstancedMesh(g,mat,matrices.length);
    matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=mesh.receiveShadow=true;shopGroup.add(mesh);
  }
  for(let i=facadeCount;i<vertices.length;i+=3){vertices[i]+=propShift[0];vertices[i+2]+=propShift[2]}
  const faces=new T.BufferGeometry();
  faces.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  faces.setAttribute('uv',new T.Float32BufferAttribute(coords,2));faces.computeVertexNormals();
  const mesh=new T.Mesh(faces,photo);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
  // Stone flags at the edge of the shop; the broad approach beyond remains unpaved.
  const pavement=streetTexture('pavers');
  const walk=new T.PlaneGeometry(5.9,14),tiles=walk.attributes.uv;
  for(let i=0;i<tiles.count;i++)tiles.setXY(i,tiles.getX(i)*2.2,tiles.getY(i)*5);
  const paving=new T.Mesh(walk,new T.MeshStandardMaterial({color:'#d9c9af',map:pavement,bumpMap:pavement,bumpScale:.035,roughness:.88}));
  paving.rotation.x=-Math.PI/2;paving.position.set(12.5,.225,41);paving.receiveShadow=true;shopGroup.add(paving);
  return group;
};
