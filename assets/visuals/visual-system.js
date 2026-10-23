/* Grim Run — Macabre Storybook visual system, v0.10.1
 * Data-driven 16-pose Reaper + 8-pose Cavern Bat SVG atlases, rasterized
 * once by Phaser, with stable deterministic frame selection.
 * NO movement, collision, currency or gameplay changes.
 */
(function(scope){
  'use strict';
  const REAPER={
    idle:[0,1],run:[2,3,4,5,15],jump:[6],fall:[7],
    slide:[8],slash:[9,10],fire:[11],hurt:[12],death:[13],hover:[14]
  };
  const BAT={
    flap:[0,1,2,3,2,1],dive:[4,5],hurt:[6],death:[7]
  };
  const CDN_PATHS=Object.freeze({
    reaper:'assets/characters/reaper/reaper-sheet.svg',
    bat:'assets/enemies/cavern-bat/bat-sheet.svg'
  });
  const snapFrame=(arr,time,fps)=>arr[Math.floor(Math.max(0,time)*fps)%arr.length];

  function reaperPose(scene){
    const p=scene.player;
    if(!p)return {name:'idle',frame:0};
    if(scene.state==='dead'||scene.state==='revive')return {name:'death',frame:13};
    if(scene.state==='won')return {name:'idle',frame:0};
    if(p.sliding||p.airTuck)return {name:'slide',frame:8};
    if(p.attackMs>0){
      const progress=1-p.attackMs/scene.attackDurationMs;
      return {name:'slash',frame:progress<.47?9:10};
    }
    if(p.visualFireMs>0)return {name:'fire',frame:11};
    if(scene.damageFlashMs>0&&p.invulMs>0)return {name:'hurt',frame:12};
    if(!p.grounded&&!p.onSoulPlatform){
      if(p.hovering)return {name:'hover',frame:14};
      return {name:p.velocityY<0?'jump':'fall',frame:p.velocityY<0?6:7};
    }
    const moving=['playing','rewinding','countdown'].includes(scene.state);
    if(moving){
      return {name:'run',frame:snapFrame(REAPER.run,scene.elapsed,10)};
    }
    return {name:'idle',frame:snapFrame(REAPER.idle,scene.elapsed,2.4)};
  }
  function cavernBatFrame(enemy,elapsed){
    if(enemy.dead)return 7;
    if(enemy.hp<=0)return 6;
    if(enemy.mode==='dive')return snapFrame(BAT.dive,enemy.timer||0,7);
    if(enemy.mode==='recover')return snapFrame(BAT.flap,elapsed+(enemy.phase||0),6);
    return snapFrame(BAT.flap,elapsed+(enemy.phase||0),9);
  }

  class GrimVisualSystem{
    constructor(scene){
      this.scene=scene;
      this.reaperReady=false;
      this.batReady=false;
      this.loaded=false;
      this.reaper=null;
      this.batPool=[];
      this.failedAssets=[];
      this.loadRequested=false;
    }
    begin(){
      const s=this.scene;
      // No loader/texture manager in simulation harness or unsupported hosts:
      // retain original procedural art and never block gameplay.
      if(!s.load||typeof s.load.svg!=='function'||
         !s.textures||typeof s.textures.addSpriteSheet!=='function'||
         !s.add||typeof s.add.sprite!=='function')return false;
      if(this.loadRequested)return true;
      this.loadRequested=true;
      const errors=new Set();
      const fail=file=>{if(file&&file.key)errors.add(file.key);};
      const done=()=>{
        if(typeof s.load.off==='function')s.load.off('loaderror',fail);
        if(s.textures.exists('gr_reaper_sheet_source')&&!errors.has('gr_reaper_sheet_source')){
          try{
            const sourceTexture=s.textures.get('gr_reaper_sheet_source');
            const sourceImage=sourceTexture.getSourceImage();
            // Phaser 3.90 expects an image/canvas source when adding a new
            // sprite-sheet key, NOT a Phaser Texture (unless key is '').
            // Passing the Texture previously yielded the tiny green missing-
            // texture square, while incorrectly disabling the old drawing.
            if(!sourceImage||!sourceImage.width||!sourceImage.height)
              throw new Error('SVG image was not rasterized');
            const sheet=s.textures.addSpriteSheet('gr_reaper_frames',sourceImage,
              {frameWidth:192,frameHeight:192,endFrame:15});
            if(!sheet||!s.textures.exists('gr_reaper_frames')||
                !sheet.has(0)||!sheet.has(8)||!sheet.has(15))
              throw new Error('Reaper sprite sheet has missing animation frames');
            const sprite=s.add.sprite(0,0,'gr_reaper_frames',0)
              .setOrigin(.5,1).setScale(.74).setDepth(12).setVisible(false);
            if(!sprite.texture||sprite.texture.key!=='gr_reaper_frames'||
               !sprite.frame||sprite.frame.name==='__MISSING'){
              sprite.destroy();
              throw new Error('Reaper resolved to Phaser missing texture');
            }
            this.reaper=sprite;
            this.reaperReady=true;
          }catch(e){
            if(this.reaper){this.reaper.destroy();this.reaper=null;}
            this.reaperReady=false;
            this.failedAssets.push('Reaper texture: '+String(e));
          }
        }else this.failedAssets.push('Reaper SVG unavailable');
        if(s.textures.exists('gr_bat_sheet_source')&&!errors.has('gr_bat_sheet_source')){
          try{
            const sourceTexture=s.textures.get('gr_bat_sheet_source');
            const sourceImage=sourceTexture.getSourceImage();
            if(!sourceImage||!sourceImage.width||!sourceImage.height)
              throw new Error('Bat SVG image was not rasterized');
            const sheet=s.textures.addSpriteSheet('gr_bat_frames',sourceImage,
              {frameWidth:160,frameHeight:128,endFrame:7});
            if(!sheet||!s.textures.exists('gr_bat_frames')||
               !sheet.has(0)||!sheet.has(4)||!sheet.has(7))
              throw new Error('Bat sprite sheet has missing animation frames');
            for(let i=0;i<12;i++){
              const sprite=s.add.sprite(0,0,'gr_bat_frames',0)
                .setScale(.66).setDepth(9).setVisible(false);
              if(!sprite.texture||sprite.texture.key!=='gr_bat_frames'||
                !sprite.frame||sprite.frame.name==='__MISSING'){
                sprite.destroy();
                throw new Error('Bat resolved to Phaser missing texture');
              }
              this.batPool.push(sprite);
            }
            this.batReady=true;
          }catch(e){
            for(const sprite of this.batPool)sprite.destroy();
            this.batPool=[];
            this.batReady=false;
            this.failedAssets.push('Bat texture: '+String(e));
          }
        }else this.failedAssets.push('Bat SVG unavailable');
        this.loaded=true;
      };
      try{
        if(typeof s.load.on==='function')s.load.on('loaderror',fail);
        s.load.once('complete',done);
        s.load.svg('gr_reaper_sheet_source',CDN_PATHS.reaper,{width:768,height:768});
        s.load.svg('gr_bat_sheet_source',CDN_PATHS.bat,{width:640,height:256});
        s.load.start();
      }catch(e){
        this.failedAssets.push('Loader: '+String(e));
        return false;
      }
      return true;
    }
    render(){
      const s=this.scene;
      const p=s.player;
      if(this.reaperReady&&this.reaper){
        const visible=Boolean(p)&&!['reliquary','refundConfirm'].includes(s.state);
        this.reaper.setVisible(visible);
        if(visible){
          const pose=reaperPose({
            player:p,state:s.state,elapsed:s.elapsed,
            attackDurationMs:s.attackDurationMs||260,
            damageFlashMs:s.damageFlashMs
          });
          this.reaper.setFrame(pose.frame);
          // Frame cell is 192px high, feet in drawn art are at Y~176.
          // Origin bottom + 12px offset places boots on gameplay terrain.
          this.reaper.setPosition(p.x,s.feetY+12);
          this.reaper.setAlpha(p.invulMs>0&&Math.floor(s.frame/5)%2===0?.58:1);
          this.reaper.setTint(p.slowMs>0?0xb9ecff:0xffffff);
          this.reaper.setScale(.74);
        }
      }
      if(!this.batReady)return;
      let used=0;
      if(!['menu','reliquary','refundConfirm'].includes(s.state)){
        const left=s.cameraX-100,right=s.cameraX+s.width+100;
        for(const e of s.enemies||[]){
          if(e.kind!=='bat'||e.dead||e.x<left||e.x>right)continue;
          if(used>=this.batPool.length)break;
          const sprite=this.batPool[used++];
          sprite.setVisible(true).setPosition(e.x,e.y);
          sprite.setFrame(cavernBatFrame(e,s.elapsed));
          sprite.setAlpha(e.hp<1?.5:1);
          sprite.setRotation(e.mode==='dive'?.10:0);
        }
      }
      for(let i=used;i<this.batPool.length;i++)
        this.batPool[i].setVisible(false);
    }
    shutdown(){
      if(this.reaper){this.reaper.destroy();this.reaper=null;}
      for(const sprite of this.batPool)sprite.destroy();
      this.batPool=[];
      this.reaperReady=false;this.batReady=false;
    }
  }
  scope.GRIM_VISUALS={GrimVisualSystem,reaperPose,cavernBatFrame,REAPER,BAT,CDN_PATHS};
})(typeof window!=='undefined'?window:globalThis);
