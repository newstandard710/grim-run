/* Optional pose strips must never hold up the game's first playable scene. */
(function(scope){
  'use strict';
  function load(scene,art,ready){
    const textures=scene.textures;
    if(textures?.exists?.(art.key)){ready();return;}
    if(!scope.Image||!textures?.addSpriteSheet)return;
    if(art.key==='reaper-landing' && scope.Phaser &&
       scene.sys?.game?.renderer?.type===scope.Phaser.CANVAS &&
       typeof scope.fetch==='function' && typeof scope.createImageBitmap==='function'){
      loadLandingBitmap(scene,art,ready);
    }else{
      loadImage(scene,art,ready);
    }
  }
  function loadImage(scene,art,ready){
    const textures=scene.textures;
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
  // Chromium Canvas can defer an HTML image's first WebP decode until the
  // landing is painted. Give Phaser decoded pixels without blocking Start.
  async function loadLandingBitmap(scene,art,ready){
    const textures=scene.textures,events=scene.events,gameEvents=scene.sys.game.events;
    let stopped=false,bitmap;
    const stop=()=>{stopped=true;};
    events.once('shutdown',stop);
    events.once('destroy',stop);
    try{
      const response=await scope.fetch(art.url);
      if(!response.ok)throw new Error('Landing atlas request failed');
      bitmap=await scope.createImageBitmap(await response.blob());
      if(stopped)return;
      if(!textures.exists(art.key)){
        if(bitmap.width!==art.width*art.columns ||
           bitmap.height!==art.height*Math.ceil(art.frames/art.columns)){
          throw new Error('Unexpected landing atlas dimensions');
        }
        const texture=textures.addSpriteSheet(art.key,bitmap,{
          frameWidth:art.width,frameHeight:art.height,endFrame:art.frames-1
        });
        if(!texture)throw new Error('Landing atlas registration failed');
        const source=bitmap,removeKey=scope.Phaser.Textures.Events.REMOVE_KEY+art.key;
        const close=()=>{
          textures.off(removeKey,close);
          gameEvents.off('destroy',close);
          source.close();
        };
        textures.once(removeKey,close);
        gameEvents.once('destroy',close);
        bitmap=null; // The texture owns the source across scene restarts.
      }
    }catch{
      if(!stopped)loadImage(scene,art,ready);
      return;
    }finally{
      events.off('shutdown',stop);
      events.off('destroy',stop);
      bitmap?.close();
    }
    ready();
  }
  scope.GRIM_ACTOR_TEXTURES={load};
})(typeof window!=='undefined'?window:globalThis);
