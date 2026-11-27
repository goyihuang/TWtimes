import * as T from 'three';
// Procedural interpretive scenery: not surveyed historical assets.
export function enrich(g,i,{box,mat,label,roof}){
 let seed=1729+i*17;const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
 const b=(x,y,z,w,h,d,c)=>box(g,x,y,z,w,h,d,c);
 const cylinder=(x,y,z,r,h,c,r2=r)=>{const m=new T.Mesh(new T.CylinderGeometry(r2,r,h,10),mat(c));m.position.set(x,y+h/2,z);m.castShadow=true;g.add(m);return m};
 const sphere=(x,y,z,r,c,sx=1,sy=1,sz=1)=>{const m=new T.Mesh(new T.SphereGeometry(r,10,8),mat(c));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;g.add(m);return m};
 // Forecourt: paving, curb, planted island and small period objects.
 for(let x=-48;x<49;x+=3)b(x,.17,35,.055,.025,41,0x8c887b);
 for(let z=16;z<56;z+=3)b(0,.17,z,98,.025,.055,0x8c887b);
 for(let x=-49;x<50;x+=2)b(x,.15,57,1.95,.18,.55,0xc5bba8);
 for(const x of [-38,38]){
   cylinder(x,.16,34,6,.32,0x938c76);cylinder(x,.48,34,5.6,.12,0x526c41);
   cylinder(x,.6,34,.62,7,0x67513b,.38);
   for(let k=0;k<12;k++){const a=k*2.4,r=2+rnd()*4;sphere(x+Math.cos(a)*r,7+rnd()*4,34+Math.sin(a)*r,3+rnd()*1.8,[0x49633c,0x657944,0x77864e][k%3],1.15,.82,1.2)}
 }
 for(let x of [-45,-25,25,45]){cylinder(x,.2,52,.24,5.7,i<3?0x3a413a:0x767c78,.1);b(x,5.7,52,1,.14,.65,0x4b5149);const bulb=new T.Mesh(new T.SphereGeometry(.26,12,8),new T.MeshStandardMaterial({color:0xffe5b7,emissive:0xffb85b,emissiveIntensity:.1}));bulb.position.set(x,5.65,52);bulb.userData.lamp=true;g.add(bulb)}
 // Period streetscape, with arcade pilasters, cornices and shop awnings.
 const colors=[0xb7a28b,0xc5b5a0,0x9caaa3,0xd3c3a5,0xae9484];
 for(let side of [-1,1])for(let k=0;k<9;k++){let x=side*(63+k*10.8),z=95,h=i<2?7.2:9+Math.floor(rnd()*3)*3;let c=colors[k%5];b(x,0,z,10.4,h,14,c);b(x,0,z-7.1,10.4,.3,2,0xb6b0a0);b(x,3.5,z-7.15,10.6,.38,.55,0xd0c5af);for(let a of [-4.5,4.5])b(x+a,0,z-8.1,.65,3.6,.65,0xd0c5af);b(x,0.2,z-7.13,6.8,3.1,.22,0x404a45);for(let y=4.5;y<h-1;y+=3){for(let a of [-3,0,3]){b(x+a,y,z-7.16,1.65,1.9,.2,0x465653);b(x+a,y-.17,z-7.31,2,.18,.45,0xdad0b8)}}b(x,h,z,10.7,.35,14.4,0x887f6e);if(i<2)roof(g,x,h+.35,z,10.8,14.4,2,0x625e53);else b(x,h+.35,z,9.7,.85,13.2,c)}
 // Trackside rolling stock is deliberately generic, not a claimed historical locomotive class.
 if(i<4){for(let n=0;n<3;n++){const x=-1,z=-42-n*19;const col=i<2?0x384a3e:i===2?0x345c72:0xc4c6c3;b(x,.7,z,3.2,3.1,17,col);b(x,3.8,z,3.35,.35,17.2,0x565b56);for(let j=0;j<5;j++){b(x+1.62,2,z-6+j*3,.055,1.05,1.75,0x9cb4b8);b(x-1.62,2,z-6+j*3,.055,1.05,1.75,0x9cb4b8)}}}
 // Vehicles and pedestrians are interpretive silhouettes, not documentary details.
 for(let k=0;k<12;k++){let x=-43+k*8,z=65+(k%2)*6;if(i>=2){const c=[0xd4c2a0,0x617e80,0x8f5d45,0xc0c3bd][k%4];b(x,.45,z,3.9,.65,1.65,c);b(x+.15,1.1,z,2.15,.65,1.5,c);b(x+.15,1.2,z+.76,1.9,.46,.05,0x35494b);for(let a of [-1.25,1.25])for(let s of [-.84,.84]){const w=cylinder(x+a,.1,z+s,.37,.18,0x343735);w.rotation.x=Math.PI/2}}else{b(x,.55,z,1.3,.8,1.1,0x75604b);for(let a of [-.85,.85]){const w=cylinder(x+a,.1,z,.65,.13,0x4b4035);w.rotation.z=Math.PI/2}}}
 for(let k=0;k<28;k++){let x=(rnd()-.5)*82,z=22+rnd()*32;const col=[0x485c62,0xc6b395,0x7c6a59,0x9b7864][k%4];cylinder(x,.55,z,.22,.85,col,.27);sphere(x,1.58,z,.15,0xc8a283);for(let a of [-.1,.1])cylinder(x+a,.12,z,.075,.47,0x484943)}
}
export function setNight(groups,night){for(const g of groups)g.traverse(o=>{if(o.userData.lamp)o.material.emissiveIntensity=night?2.5:.08})}
