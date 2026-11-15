/* Optional pose strips must never hold up the game's first playable scene. */
(function(scope){
  'use strict';
  function load(scene,art,ready){
    const textures=scene.textures;
    if(textures?.exists?.(art.key)){ready();return;}
    if(!scope.Image||!textures?.addSpriteSheet)return;
    const image=new scope.Image();
    const clear=()=>{
      image.onload=null;image.onerror=null;
      scene.events?.off?.('shutdown',clear);
    };
    scene.events?.once?.('shutdown',clear);
    image.onerror=clear;
    image.onload=()=>{
      clear();
      if(image.naturalWidth!==art.width*art.columns||
         image.naturalHeight!==art.height*Math.ceil(art.frames/art.columns))return;
      if(!textures.exists(art.key))textures.addSpriteSheet(art.key,image,{
        frameWidth:art.width,frameHeight:art.height,endFrame:art.frames-1
      });
      if(textures.exists(art.key))ready();
    };
    image.src=art.url;
  }
  scope.GRIM_ACTOR_TEXTURES={load};
})(typeof window!=='undefined'?window:globalThis);
