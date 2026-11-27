// Modern OSM context; never reuse as historical evidence.
// Generate the compact data file using the existing fetch-osm script.
import * as T from 'three';
export async function loadModernContext(){
 const r=await fetch(new URL('data/tainan-station.osm.json',document.baseURI));if(!r.ok)throw Error('OSM data unavailable');const d=await r.json();if(!Array.isArray(d.ways)||!Array.isArray(d.origin))throw Error('Invalid OSM schema');
 const lon=120.2128,lat=22.9971,scale=d.scale||1e-6;
 const local=p=>{const east=(d.origin[0]+p[0]*scale-lon)*111320*Math.cos(lat*Math.PI/180),north=(d.origin[1]+p[1]*scale-lat)*110540;return [-north,-east]};
 const group=new T.Group(), roadMat=new T.MeshStandardMaterial({color:0x656b68,roughness:.95}),buildingMat=new T.MeshStandardMaterial({color:0xbcb8a9,roughness:.85});
 for(const [id,t,pts] of d.ways){if(!Array.isArray(pts)||pts.length<2)continue;const p=pts.map(local);
 if(t.highway&&!['footway','steps','path','cycleway','service'].includes(t.highway)&&t.tunnel!=='yes'){const width=Number(t.width)||Math.max(4,(Number(t.lanes)||2)*3);for(let k=1;k<p.length;k++){const [a,b]=p[k-1],[c,e]=p[k],len=Math.hypot(c-a,e-b);if(len<.1)continue;const m=new T.Mesh(new T.BoxGeometry(width,.12,len+.3),roadMat);m.position.set((a+c)/2,.08,(b+e)/2);m.rotation.y=Math.atan2(c-a,e-b);m.receiveShadow=true;group.add(m)}}
 else if(t.building&&p.length>=4){const x=p.reduce((s,v)=>s+v[0],0)/p.length,z=p.reduce((s,v)=>s+v[1],0)/p.length;if(Math.hypot(x,z)<65)continue;const sh=new T.Shape();p.forEach(([a,b],i)=>i?sh.lineTo(a,-b):sh.moveTo(a,-b));sh.closePath();const h=Math.max(3,Math.min(65,parseFloat(t.height)|| (parseFloat(t['building:levels'])||2)*3.3));const m=new T.Mesh(new T.ExtrudeGeometry(sh,{depth:h,bevelEnabled:false}),buildingMat);m.rotation.x=-Math.PI/2;m.castShadow=m.receiveShadow=true;group.add(m)}
 }return group;
}
