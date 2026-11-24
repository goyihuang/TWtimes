/* Articulated pedestrians, in metres. Each neighbourhood is one skinned draw call.
   The reversible clock controls route progress, gait, and idle gestures together. */
window.makePedestrians = function makePedestrians(T, modern, city) {
  'use strict';
  const group = new T.Group();
  group.name = modern ? '當代街上行人' : '舊城街上行人';
  group.userData.isPedestrianCrowd = true;
  const actors = [], routesByArea = city==='taipei'?[[]]:city==='changhua'?[[],[]]:[[],[],[]];
  let seed = modern ? 1031 : 932;
  const rnd = () => ((seed = (Math.imul(seed,1664525)+1013904223) >>> 0) / 4294967296);
  const choose = a => a[Math.floor(rnd()*a.length)];
  const tau = Math.PI*2;
  const clamp = (x,a,b) => Math.min(b,Math.max(a,x));
  const smooth = x => x*x*(3-2*x);
  function route(area,a,b,count,ground=0.09) {
    const len = Math.hypot(b[0]-a[0],b[1]-a[1]);
    const nx = -(b[1]-a[1])/len, nz = (b[0]-a[0])/len;
    for(let i=0;i<count;i++){
      const lane = (i%2 ? -.4 : .32)*(1+rnd());
      routesByArea[area].push({
        a:[a[0]+nx*lane,a[1]+nz*lane], b:[b[0]+nx*lane,b[1]+nz*lane],
        ground, length:len, speed:.79+rnd()*.48, phase:(i+.2+rnd()*.47)/count,
        wait:1.7+rnd()*4.2, heading:Math.atan2(b[0]-a[0],b[1]-a[1])
      });
    }
  }
  function waiting(area,x,z,heading,ground=.09) {
    routesByArea[area].push({a:[x,z],heading,ground,length:0,phase:rnd(),speed:0});
  }
  // The near forecourt lies ahead of the rickshaw rank. The far traverse follows
  // the mapped station footpath. The short diagonal brings walkers into the foreground.
  if(city==='taipei'){
    if(modern){route(0,[-53,60],[39,77],8);route(0,[-92,42],[-100,75],4)}
    else{route(0,[-236,38],[-180,45],6);route(0,[-196,61],[-179,64],3)}
  }else if(city==='changhua'){
    route(0,[5,220],[20,196],modern?5:4);
    route(0,[22,172],[42,184],3);
    waiting(0,5.8,205.8,-1.7);
    route(1,[183.0,-254.8],[190.1,-265.9],modern?3:2);
    waiting(1,183,-254,-1.9);
  }else{
  if(modern)route(0,[31,164],[65,166.5],4);else route(0,[29.6,165.4],[58.4,154.6],3);
  route(0,[39.8,191.4],[88.5,170.9],modern?5:3);
  route(0,[51.5,183.2],[66,172.2],2);
  if(modern){route(0,[100.25,141.82],[142.71,149.65],5);route(0,[143.6,149.3],[165.64,141.94],3)}
  waiting(0,40.6,175.1,1.0);
  waiting(0,41.65,175.6,-2.05);
  waiting(0,60.5,189,2.41);
  // Mapped bridge deck, east bank, and west bank. At a bridge the animated
  // soles use deck elevation instead of the water or the road underneath.
  function roadWalk(area,id,segment,side,count,ground,clip=1.5){
    const r=window.GEODATA.roads.find(item=>item.id===id);
    if(!r||!r.points[segment+1])return;
    const p=r.points[segment],q=r.points[segment+1],len=Math.hypot(q[0]-p[0],q[1]-p[1]);
    const dx=(q[0]-p[0])/len,dz=(q[1]-p[1])/len;
    const lateral=side*(r.width*.5-.72);
    route(area,[p[0]+dx*clip-dz*lateral,p[1]+dz*clip+dx*lateral],
      [q[0]-dx*clip-dz*lateral,q[1]-dz*clip+dx*lateral],count,ground);
  }
  roadWalk(1,'271452255',0,1,2,.22);
  roadWalk(1,'335537952',0,1,modern?4:3,.085,3.5);
  roadWalk(1,'271086443',3,-1,3,.085,4);
  waiting(1,-149.7,98.6,-.67,.22);
  // The longer diagonal is the Taiwan Boulevard footway, followed by
  // the opposite edge of the market side of the boulevard.
  roadWalk(2,'665248903',0,0,modern?4:3,.09);
  roadWalk(2,'1317160619',1,-1,3,.09,2.2);
  roadWalk(2,'610888605',1,-1,modern?4:3,.09,2);
  waiting(2,-110.2,-30.1,2.7);
  waiting(2,-109.5,-31.3,-.4);

  }
  if(city==='taipei')modern=true;
  const historicalShirt=['#e3dac5','#aeac9d','#75868a','#6c7471','#a59a7f','#475c68'];
  const modernShirt=['#d2c7b4','#b3c4c4','#879992','#535e69','#9c6e5e','#b1a6a0','#ded5bf'];
  const tint = new Map();
  function color(hex){
    if(!tint.has(hex))tint.set(hex,new T.Color(hex));
    return tint.get(hex);
  }
  function makeSection(paths,area){
    const positions=[],colors=[],indices=[],skinIDs=[],weights=[],bones=[],roots=[];
    function bone(parent,x,y,z){
      const node=new T.Bone();
      node.position.set(x,y,z);
      if(parent)parent.add(node);else roots.push(node);
      node.userData.boneIndex=bones.length;
      bones.push(node);return node;
    }
    function vertex(x,y,z,col,boneNode,brightness=1){
      const c=color(col);positions.push(x,y,z);colors.push(c.r*brightness,c.g*brightness,c.b*brightness);
      skinIDs.push(boneNode.userData.boneIndex,0,0,0);weights.push(1,0,0,0);
      return positions.length/3-1;
    }
    // Rings form a continuous, slightly irregular drape. The radius of each
    // ring follows shoulders, waist, calves and shoes rather than simple capsules.
    function loft(node,col,x,z,rings,n=12,fold=0){
      let prev=null;
      for(let j=0;j<rings.length;j++){
        const [y,rx,rz,ox=0,oz=0]=rings[j],row=[];
        for(let i=0;i<n;i++){
          const a=tau*i/n, wr=1+fold*Math.sin(a*5+j*.34)+fold*.37*Math.cos(a*3-j*.47);
          const shade=(1-.055*Math.cos(a*4+j*.37)*Math.min(1,fold*28))*(j===0?.84:1);
          row.push(vertex(x+ox+rx*wr*Math.cos(a),y,z+oz+rz*wr*Math.sin(a),col,node,shade));
        }
        if(prev)for(let i=0;i<n;i++){const k=(i+1)%n;indices.push(prev[i],row[i],row[k],prev[i],row[k],prev[k]);}
        else for(let i=1;i<n-1;i++)indices.push(row[0],row[i],row[i+1]);
        prev=row;
      }
      for(let i=1;i<n-1;i++)indices.push(prev[0],prev[i+1],prev[i]);
    }
    function oval(node,col,x,y,z,rx,ry,rz){
      const rings=[];
      for(let i=0;i<=6;i++){let t=Math.PI*i/6;const r=Math.max(.04,Math.sin(t));rings.push([y-ry*Math.cos(t),rx*r,rz*r]);}
      loft(node,col,x,z,rings,10);
    }
    function patch(node,col,points){
      const ids=points.map(v=>vertex(...v,col,node));for(let i=1;i<ids.length-1;i++)indices.push(ids[0],ids[i],ids[i+1]);
      // The cloth triangles and collar are visible from either side.
    }
    for(let p=0;p<paths.length;p++){
      const path=paths[p],woman=(p+area)%3===0;
      const root=bone(null,0,0,0),torso=bone(root,0,.955,0),head=bone(torso,0,.50,0);
      const right={},left={};
      const skin=choose(['#bb8e71','#cc9d7b','#b68968','#d0a586','#c59b7d']);
      const hair=choose(['#35312d','#383733','#494039','#282b2b']);
      const jacket=choose(modern?modernShirt:historicalShirt);
      const trousers=choose(['#3a4140','#4a4c46','#3f474f','#525754','#5c5549']);
      const footwear=choose(['#403c36','#49443c','#363a39']);
      const detailedCoat=(modern?p%4===1:p%4===0);
      const shortSleeve=modern&&p%3!==0,skirt=woman&&p%2===0;
      const scale=(woman?.9:.95)+rnd()*.115,shoulder=woman?.168:.19;
      const collar=modern?'#d0c9b8':'#ded4bc';
      // Pelvis and torso overlap, with shoulder slope and a tapered nape.
      loft(torso,jacket,0,-.001,[
        [.91,.17,.115],[.956,.184,.126],[1.02,.174,.126],[1.075,.158,.116],
        [1.175,.166,.122],[1.295,.184,.132,0,.011],[1.36,shoulder+.01,.121,0,.01],
        [1.392,shoulder-.012,.11],[1.423,.085,.084],[1.428,.060,.063]],16,.035);
      loft(torso,skin,0,.006,[[1.39,.061,.059],[1.468,.066,.062],[1.505,.077,.075]],12);
      const coatLapels=detailedCoat?'#b6ad99':collar;
      patch(torso,coatLapels,[[-.072,1.421,.064],[-.12,1.389,.093],[-.065,1.318,.128],[-.016,1.375,.117]]);
      patch(torso,coatLapels,[[.072,1.421,.064],[.015,1.375,.117],[.063,1.318,.128],[.12,1.389,.093]]);
      if(detailedCoat){
        patch(torso,'#e2d5bc',[[-.07,1.41,.101],[.073,1.41,.101],[.007,1.25,.147]]);
        patch(torso,'#555852',[[-.018,1.38,.128],[.01,1.377,.132],[.027,1.27,.146],[.005,1.242,.15],[-.01,1.273,.148]]);
      }
      if(!modern||!shortSleeve)for(let i=0;i<3;i++)oval(torso,'#817966',0,1.1+i*.073,.13,.007,.008,.005);
      if(!skirt)loft(root,trousers,0,-.005,[[.78,.138,.092],[.84,.168,.115],[.946,.176,.113],[.976,.17,.11]],14,.025);
      if(skirt)loft(torso,modern?'#706a63':'#485459',0,0,[[modern?.55:.425,.19,.144],[.63,.197,.135],[.82,.186,.122],[.96,.165,.11]],16,.055);
      for(const [part,sign] of [[left,-1],[right,1]]){
        const ax=shoulder*sign,hx=.09*sign;
        part.arm=bone(torso,ax,.408,0);part.fore=bone(part.arm,.044*sign,-.268,.01);
        part.hip=bone(root,hx,.85,0);part.shin=bone(part.hip,0,-.392,.017);part.foot=bone(part.shin,0,-.371,-.017);
        const elbow=ax+.044*sign,wrist=elbow-.006*sign;
        loft(part.arm,jacket,ax,0,[[shortSleeve?1.184:1.072,.057,.059,.041*sign,.013],[1.214,.067,.071,.033*sign,.011],[1.295,.078,.080,.02*sign,.003],[1.355,.08,.09],[1.398,.053,.062,-.015*sign],[1.405,.028,.039,-.022*sign]],12,.03);
        if(shortSleeve)loft(part.arm,skin,elbow,.013,[[1.075,.047,.050],[1.183,.056,.06],[1.202,.055,.063]],10);
        loft(part.fore,shortSleeve?skin:jacket,wrist,.014,[[.842,.038,.040,0,.03],[.897,.044,.05,0,.031],[1.006,.059,.061,.003*sign,.019],[1.08,.052,.054,.006*sign],[1.107,.04,.043,.006*sign]],12,.016);
        if(!shortSleeve)loft(part.fore,collar,wrist,.043,[[.833,.039,.04],[.858,.043,.043]],10);
        loft(part.fore,skin,wrist,.045,[[.741,.019,.019,0,.011],[.756,.03,.029],[.796,.038,.038],[.828,.035,.04],[.85,.026,.027]],10);
        oval(part.fore,skin,wrist-sign*.027,.796,.067,.016,.03,.018);
        const legMaterial=skirt?skin:trousers;
        loft(part.hip,legMaterial,hx,0,[[.432,.061,.068,0,.014],[.502,.073,.081,0,.01],[.625,.082,.086],[.748,.097,.11],[.845,.095,.122],[.908,.082,.102]],12,skirt?0:.046);
        loft(part.shin,legMaterial,hx,0,[[.083,.05,.054],[.141,.057,.057],[.251,.069,.077,0,-.009],[.329,.071,.083,0,-.012],[.415,.06,.064,0,.012],[.478,.064,.068,0,.016]],12,skirt?0:.04);
        const shoeColor=modern&&shortSleeve&&p%2?'#b6b5a8':footwear;
        loft(part.foot,'#3b3932',hx,.046,[[.006,.057,.124],[.026,.061,.138],[.041,.061,.134]],12);
        loft(part.foot,shoeColor,hx,.045,[[.032,.061,.131],[.056,.061,.132],[.083,.058,.099,0,-.012],[.11,.048,.065,0,-.04],[.117,.044,.056,0,-.045]],12);
      }
      // A forehead, cheekbones, tapered jaw and separate nose preserve the facial silhouette.
      loft(head,skin,0,.008,[[1.469,.041,.046,0,.025],[1.48,.061,.067,0,.021],[1.508,.079,.081,0,.016],
        [1.543,.091,.093,0,.009],[1.58,.097,.099],[1.618,.096,.1],[1.663,.088,.093,0,-.004],
        [1.693,.064,.07,0,-.005],[1.709,.029,.043,0,-.007]],16);
      for(const s of [-1,1]){
        oval(head,skin,s*.093,1.565,.003,.017,.027,.015);
        oval(head,'#51423a',s*.037,1.588,.102,.012,.004,.0036);
        patch(head,hair,[[s*.019,1.605,.105],[s*.055,1.609,.089],[s*.058,1.604,.09],[s*.021,1.6,.106]]);
      }
      loft(head,skin,0,.103,[[1.547,.014,.016],[1.553,.024,.025],[1.567,.014,.022],[1.599,.006,.007]],8);
      patch(head,'#936c59',[[-.023,1.525,.099],[-.002,1.527,.105],[.022,1.525,.099],[0,1.522,.105]]);
      // A sloped hairline covers the nape and leaves the temple and forehead visible.
      let previous;
      for(let j=0;j<=5;j++){
        const row=[];
        for(let i=0;i<18;i++){
          const a=i*tau/18,f=j/5,sina=Math.sin(a),base=1.53+.09*((sina+1)*.5)+.014*Math.cos(a*2+.6);
          const r=Math.cos(f*Math.PI/2)*.099+.002;
          row.push(vertex(r*Math.cos(a),base+(1.719-base)*Math.sin(f*Math.PI/2),-.002+r*sina,hair,head,.76+.22*f));
        }
        if(previous)for(let i=0;i<18;i++){const k=(i+1)%18;indices.push(previous[i],row[i],row[k],previous[i],row[k],previous[k]);}
        previous=row;
      }
      if(woman){oval(head,hair,0,1.544,-.09,.062,.066,.048);if(modern&&p%2)oval(head,hair,0,1.461,-.111,.04,.086,.034);}
      if(!modern&&p%4===1){
        loft(head,'#a99a76',0,-.001,[[1.661,.163,.169],[1.67,.168,.173],[1.679,.146,.154],[1.694,.098,.107],[1.746,.094,.10],[1.756,.073,.08]],18);
        loft(head,'#645646',0,-.001,[[1.685,.1,.108],[1.702,.098,.105]],18);
      }
      if((p+area)%3===1){
        const bag=modern?'#78634e':'#876f49';
        patch(torso,bag,[[-.153,1.392,.077],[-.123,1.395,.114],[.164,.959,.115],[.151,.924,.079]]);
        loft(torso,bag,.163,.057,[[.735,.046,.085],[.756,.052,.102],[.925,.055,.1],[.957,.052,.087]],8);
      }else if(modern&&p%4===2){
        loft(torso,'#596765',0,-.124,[[1.02,.097,.055],[1.071,.123,.08],[1.308,.122,.073],[1.37,.083,.06]],12);
        for(const s of [-1,1])patch(torso,'#526465',[[s*.103,1.408,.063],[s*.131,1.397,.078],[s*.14,1.16,.093],[s*.125,1.14,.102]]);
      }
      const actor={root,torso,head,left,right,path,scale,seed:rnd()*8,area,stride:.58+rnd()*.13};
      actors.push(actor);
    }
    const geom=new T.BufferGeometry();
    geom.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    geom.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    geom.setAttribute('skinIndex',new T.Uint16BufferAttribute(skinIDs,4));
    geom.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
    geom.setIndex(indices);geom.computeVertexNormals();
    const mesh=new T.SkinnedMesh(geom,new T.MeshStandardMaterial({
      vertexColors:true,roughness:.86,metalness:0,side:T.DoubleSide
    }));
    mesh.name=['站前旅人','綠川行人','市場街人流'][area];
    for(const r of roots)mesh.add(r);
    mesh.updateMatrixWorld(true);mesh.bind(new T.Skeleton(bones));
    // Bone motion places the bind geometry around three different city locations.
    const limits=new T.Box3();
    for(const p of paths)for(const pt of [p.a,p.b||p.a]){
      limits.expandByPoint(new T.Vector3(pt[0]-1,-.2,pt[1]-1));
      limits.expandByPoint(new T.Vector3(pt[0]+1,2.4,pt[1]+1));
    }
    mesh.boundingBox=limits;mesh.boundingSphere=limits.getBoundingSphere(new T.Sphere());
    mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  routesByArea.forEach(makeSection);
  function update(timeSeconds) {
    const t=Number.isFinite(timeSeconds)?timeSeconds:0;
    for(const actor of actors){
      const {root,torso,head,left,right,path,scale,seed,stride}=actor;
      let x=path.a[0],z=path.a[1],heading=path.heading,effort=0,phase=seed;
      if(path.length) {
        const move=path.length/path.speed,half=move+path.wait,cycle=half*2;
        const clock=((t+path.phase*cycle)%cycle+cycle)%cycle,back=clock>=half;
        const u=back?clock-half:clock,ratio=clamp(u/move,0,1);
        const along=back?1-ratio:ratio;
        x+=(path.b[0]-x)*along;z+=(path.b[1]-z)*along;
        const turn=smooth(clamp((u-move)/path.wait,0,1));
        heading+=Math.PI*((back?1:0)+turn);
        effort=smooth(clamp(Math.min(u,move-u)/.48,0,1));
        phase=seed+Math.min(u,move)*path.speed*Math.PI/(stride*scale);
      } else {
        heading+=.07*Math.sin(t*.29+seed);
      }
      const sin=Math.sin(phase), cos=Math.cos(phase),idle=1-effort;
      root.scale.setScalar(scale);
      root.position.set(x,path.ground+scale*(effort*(.019+.013*Math.cos(phase*2))+.004*idle*Math.sin(t*1.8+seed)),z);
      root.rotation.set(0,heading,.012*sin*effort);
      torso.rotation.set(.049*effort+.018*idle,.088*sin*effort+.028*Math.sin(t*.51+seed)*idle,-.014*cos*effort);
      head.rotation.set(-.027*effort+.042*Math.sin(t*.62+seed)*idle,-torso.rotation.y+.19*Math.sin(t*.49+seed)*idle,.025*Math.cos(t*.45+seed));
      for(const [limb,sign] of [[left,-1],[right,1]]){
        const wave=sign*sin;
        limb.hip.rotation.x=effort*(-.37*wave-.07)+idle*(.013*sign);
        limb.shin.rotation.x=effort*(.08+.7*Math.max(0,-sign*cos))+.028;
        limb.foot.rotation.x=effort*(.15*wave-.19*Math.max(0,-sign*cos));
        limb.arm.rotation.x=effort*.31*wave+.047+.025*Math.sin(t*.73+seed)*idle;
        limb.arm.rotation.z=sign*(.046+.02*effort*Math.cos(phase));
        limb.fore.rotation.x=-.17-.12*effort*(1-wave)-idle*.07*(1+Math.sin(t*.47+seed));
      }
    }
  }
  update(0);
  return {group,update};
};
