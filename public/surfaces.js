/* Photographed surface maps from Poly Haven, CC0. Tile dimensions are assigned in metres by each mesh. */
(() => {
  const images={pavers:'plaza-pavers.jpg',concrete:'brushed_concrete_03.jpg',asphalt:'worn_asphalt.jpg',gravel:'gravel_road.jpg',brick:'red_brick.jpg',slate:'roof_09.jpg',leaves:'leaf-spray.png'};
  const cache=new Map();
  const loader=new THREE.TextureLoader();
  window.streetTexture=name=>{
    if(cache.has(name))return cache.get(name);
    const tex=loader.load('textures/'+images[name],()=>window.dispatchEvent(new Event('street-texture-ready')));
    tex.colorSpace=THREE.SRGBColorSpace;
    if(name!=='leaves')tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
    tex.anisotropy=4;
    cache.set(name,tex);
    return tex;
  };
})();
