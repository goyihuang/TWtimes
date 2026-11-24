/* Local Chisel frame. The logarithmic depth PNG and camera share a 1280 × 720 pixel grid. */
(() => {
  'use strict';
  const width=1280,height=720;
  const table=Uint32Array.from({length:256},(_,i)=>{
    for(let j=0;j<8;j++)i=(i>>>1)^((i&1)?0xedb88320:0);
    return i>>>0;
  });
  function pngChunk(label,bytes){
    const part=new Uint8Array(12+bytes.length),view=new DataView(part.buffer);
    view.setUint32(0,bytes.length);part.set(new TextEncoder().encode(label),4);part.set(bytes,8);
    let crc=0xffffffff;
    for(let i=4;i<part.length-4;i++)crc=(crc>>>8)^table[(crc^part[i])&255];
    view.setUint32(part.length-4,(crc^0xffffffff)>>>0);return part;
  }
  async function encodeDepth(pixels){
    const depth=new Float32Array(width*height);let near=Infinity,far=0;
    for(let i=0;i<depth.length;i++){
      const base=i*4;
      const z=(pixels[base]*65536+pixels[base+1]*256+pixels[base+2])/1024;
      depth[i]=z;
      if(z>0){near=Math.min(near,z);far=Math.max(far,z)}
    }
    if(!far)throw Error('這個鏡位沒有街景，請將鏡頭轉向街面。');
    const logRange=Math.log(far/near)||1, stride=1+width*2;
    const scanlines=new Uint8Array(stride*height);
    for(let y=0;y<height;y++){
      for(let x=0;x<width;x++){
        const z=depth[(height-y-1)*width+x], p=z?Math.max(1,Math.round(65535*(1-Math.log(z/near)/logRange))):0;
        const i=y*stride+1+2*x;scanlines[i]=p>>8;scanlines[i+1]=p&255;
      }
    }
    const header=new Uint8Array(13),hv=new DataView(header.buffer);
    hv.setUint32(0,width);hv.setUint32(4,height);header[8]=16;
    const stream=new Blob([scanlines]).stream().pipeThrough(new CompressionStream('deflate'));
    const compressed=new Uint8Array(await new Response(stream).arrayBuffer());
    const png=new Blob([Uint8Array.of(137,80,78,71,13,10,26,10),pngChunk('IHDR',header),pngChunk('IDAT',compressed),pngChunk('IEND',new Uint8Array())],{type:'image/png'});
    const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(png)});
    return {logDepthAsset:{base64},zMin:near,zMax:far};
  }
  function readDepth(view){
    const T=THREE, target=new T.WebGLRenderTarget(width,height,{minFilter:T.NearestFilter,magFilter:T.NearestFilter});
    const material=new T.ShaderMaterial({side:T.DoubleSide,vertexShader:`
      #include <common>
      #include <skinning_pars_vertex>
      #ifdef LEAF_MASK
        varying vec2 leafUv;
      #endif
      varying float forwardDepth;
      void main(){
        #ifdef LEAF_MASK
        leafUv=uv;
        #endif
        #include <skinbase_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        vec4 local=vec4(transformed,1.);
        #ifdef USE_INSTANCING
          local=instanceMatrix*local;
        #endif
        vec4 eye=modelViewMatrix*local;
        forwardDepth=-eye.z;
        gl_Position=projectionMatrix*eye;
      }`,fragmentShader:`
      #ifdef LEAF_MASK
        varying vec2 leafUv;
        uniform sampler2D leafMap;
      #endif
      varying float forwardDepth;
      void main(){
        #ifdef LEAF_MASK
        if(texture2D(leafMap,leafUv).a<.37)discard;
        #endif
        float v=floor(forwardDepth*1024.+.5);
        gl_FragColor=vec4(floor(v/65536.),mod(floor(v/256.),256.),mod(v,256.),255.)/255.;
      }`});
    const leafMaterial=material.clone();
    leafMaterial.defines={LEAF_MASK:1};
    leafMaterial.uniforms={leafMap:{value:streetTexture('leaves')}};
    const originals=[];
    const prev={target:renderer.getRenderTarget(),background:scene.background,override:scene.overrideMaterial,shadows:renderer.shadowMap.enabled};
    const sky=scene.getObjectByName('skyBackdrop');
    const pixels=new Uint8Array(width*height*4);
    try{
      if(sky)sky.visible=false;
      scene.background=new T.Color(0);scene.overrideMaterial=null;
      scene.traverseVisible(o=>{if(o.isMesh){originals.push([o,o.material]);o.material=o.userData.foliage?leafMaterial:material}});
      renderer.shadowMap.enabled=false;renderer.setRenderTarget(target);
      renderer.render(scene,view);renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
    }finally{
      for(const [mesh,m] of originals)mesh.material=m;
      leafMaterial.dispose();renderer.setRenderTarget(prev.target);scene.overrideMaterial=prev.override;scene.background=prev.background;
      renderer.shadowMap.enabled=prev.shadows;if(sky)sky.visible=true;material.dispose();target.dispose();dirty=true;
    }
    return pixels;
  }
  const button=$('exportAtlas');
  button.onclick=async()=>{
    if(!ready)return;
    button.disabled=true;
    try{
      atlasWorkshop.beforeEra();render();
      const view=camera.clone();view.aspect=width/height;view.updateProjectionMatrix();view.updateMatrixWorld(true);
      const f=height/(2*Math.tan(THREE.MathUtils.degToRad(view.fov)/2));
      const shot={extrinsics:{position:view.position.toArray(),quaternion:view.quaternion.toArray(),coordinateSystem:'rub'},
        intrinsics:{width,height,fx:f,fy:f,cx:width/2,cy:height/2}};
      const subject=atlasWorkshop.photoName()||placeTitle(), period=modern?'當代':pastLabel();
      const depth=await encodeDepth(readDepth(view));
      const request={targetFrames:[{camera:shot,depth}],prompt:period+'的'+cityTitle()+'，'+subject+'。依深度圖保留建築輪廓、街道尺度與相機視角。依年代呈現臺灣街屋材質、街面與自然光。',enhancePrompt:false};
      const url=URL.createObjectURL(new Blob([JSON.stringify(request)],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;link.download='atlas-chisel-'+subject+'-'+period+'.json';link.click();
      setTimeout(()=>URL.revokeObjectURL(url),30000);toast('已匯出 Chisel API 用的鏡位與深度檔。');
    }catch(error){console.error(error);toast('無法匯出深度鏡位，請將鏡頭朝向街面並使用新版瀏覽器。')}
    finally{button.disabled=false}
  };
})();
