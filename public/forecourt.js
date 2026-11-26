/* Station forecourt details follow the scale of the historic station photograph. */
window.stationForecourt = function(T,modern) {
 const group=new T.Group(),geos={cube:new T.BoxGeometry(1,1,1),ball:new T.SphereGeometry(1,8,6),wheel:new T.TorusGeometry(1,.052,5,20),post:new T.CylinderGeometry(1,1,1,6)},batch=new Map();
 function add(shape,color,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0){const key=shape+color;if(!batch.has(key))batch.set(key,{shape,color,matrices:[]});let o=new T.Object3D();o.position.set(x,y,z);o.rotation.set(rx,ry,rz);o.scale.set(sx,sy,sz);o.updateMatrix();batch.get(key).matrices.push(o.matrix)}
 function beam(a,b,r,color){let u=new T.Vector3(...a),v=new T.Vector3(...b),line=v.clone().sub(u),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),line.clone().normalize()),e=new T.Euler().setFromQuaternion(q);add('post',color,(u.x+v.x)/2,(u.y+v.y)/2,(u.z+v.z)/2,r,line.length(),r,e.x,e.y,e.z)}
 function rickshaw(x,z){const rim='#474840',wood='#74583d',seat='#824a3e';for(let side of [-1,1]){const wx=x+side*.69;add('wheel',rim,wx,.63,z,.63,.63,.63,0,Math.PI/2);for(let i=0;i<8;i++){let a=i*Math.PI/8;beam([wx,.63+Math.sin(a)*.62,z+Math.cos(a)*.62],[wx,.63-Math.sin(a)*.62,z-Math.cos(a)*.62],.013,'#958b74')}beam([x+side*.5,.64,z-.42],[x+side*.45,.78,z+2.73],.055,wood);beam([x+side*.55,.83,z-.3],[x+side*.57,1.99,z-.4],.035,rim);beam([x+side*.56,1.99,z-.4],[x+side*.56,1.89,z+.57],.042,rim)}
 add('cube',seat,x,.81,z,1.11,.18,.8);add('cube',wood,x,1.18,z-.38,1.1,.7,.12,-.16);add('cube','#43514e',x,1.99,z+.06,1.26,.12,1.1,.09);add('cube',wood,x,.42,z+.6,.94,.12,.46)}
 if(!modern){rickshaw(-12,19);rickshaw(-8.7,19.6);rickshaw(7,21);rickshaw(14.4,40.1);}
 // Slab joints and stone kerbs give the forecourt a readable ground scale.
 for(let x=-34;x<=34;x+=2.8)add('cube','#b2a38a',x,.145,9.7,.022,.018,4.5);
 for(let i=0;i<5;i++){let x=12+i*.7;add('cube','#9a7d59',x,.29,12,.62,.54,.45);add('cube','#655f4f',x-.15,.3,12.24,.045,.5,.025)}
 for(const entry of batch.values()){let m=new T.InstancedMesh(geos[entry.shape],new T.MeshLambertMaterial({color:entry.color}),entry.matrices.length);entry.matrices.forEach((x,i)=>m.setMatrixAt(i,x));m.castShadow=m.receiveShadow=true;group.add(m)}
 group.rotation.y=-2.73;group.position.set(66.7,.12,209.2);return group;
};
