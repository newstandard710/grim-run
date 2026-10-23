/* Grim Run — Macabre Storybook visual system, v0.10.4
 * The legacy SVG atlas remains available as an experimental option. The
 * illustrated runtime uses anchored PNG poses and short Reaper/Bat cycles.
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
  const ILLUSTRATED_RUN=Object.freeze(['run_02','run_03','run_04','run_05']);
  const ILLUSTRATED_BAT_FLAP=Object.freeze(['raised','midstroke','lowered','neutral']);
  const ILLUSTRATED_RUN_FPS=10;
  const ILLUSTRATED_BAT_FPS=9;
  const CDN_PATHS=Object.freeze({
    reaper:'assets/characters/reaper/reaper-sheet.svg',
    bat:'assets/enemies/cavern-bat/bat-sheet.svg'
  });
  // Transparent PNG poses with per-image anchors documented in manifest.json.
  const ILLUSTRATED=Object.freeze({
    reaper:{
      master:{key:'gr_ill_reaper_master',file:'reaper_master.png',scale:.157895,anchor:[320,827.5]},
      idle:{key:'gr_ill_reaper_idle',file:'reaper_idle.png',scale:.157687,anchor:[320,827.5]},
      run:{key:'gr_ill_reaper_run',file:'reaper_run.png',scale:.186047,anchor:[320,827.5]},
      run_02:{key:'gr_ill_reaper_run_02',file:'reaper_run_02.png',scale:.183486,anchor:[512,710]},
      run_03:{key:'gr_ill_reaper_run_03',file:'reaper_run_03.png',scale:.180451,anchor:[512,710]},
      run_04:{key:'gr_ill_reaper_run_04',file:'reaper_run_04.png',scale:.180451,anchor:[512,710]},
      run_05:{key:'gr_ill_reaper_run_05',file:'reaper_run_05.png',scale:.180451,anchor:[512,710]},
      jump:{key:'gr_ill_reaper_jump',file:'reaper_jump.png',scale:.167131,anchor:[320,827.5]},
      fall:{key:'gr_ill_reaper_fall',file:'reaper_fall.png',scale:.180451,anchor:[320,827.5]},
      slide:{key:'gr_ill_reaper_slide',file:'reaper_slide_crouch_v2.png',scale:.078585,anchor:[768,798]},
      scythe_attack:{key:'gr_ill_reaper_scythe_attack_clean',file:'reaper_scythe_attack_clean_v2.png',scale:.162822,anchor:[768,894]},
      crossbow_fire:{key:'gr_ill_reaper_crossbow_fire',file:'reaper_crossbow_fire.png',scale:.26087,anchor:[512,920]},
      hurt:{key:'gr_ill_reaper_hurt',file:'reaper_hurt.png',scale:.243902,anchor:[512,920]},
      death:{key:'gr_ill_reaper_death',file:'reaper_death.png',scale:.364742,anchor:[512,920]},
      hover:{key:'gr_ill_reaper_hover',file:'reaper_hover.png',scale:.159574,anchor:[512,920]}
    },
    bat:{
      neutral:{key:'gr_ill_bat_neutral',file:'bat_neutral.png',scale:.121281,anchor:[512,320]},
      raised:{key:'gr_ill_bat_raised',file:'bat_wings_raised.png',scale:.122827,anchor:[512,320]},
      midstroke:{key:'gr_ill_bat_midstroke',file:'bat_flap_midstroke.png',scale:.111579,anchor:[512,320]},
      lowered:{key:'gr_ill_bat_lowered',file:'bat_wings_lowered.png',scale:.127557,anchor:[443.5,222]},
      dive_anticipation:{key:'gr_ill_bat_dive_anticipation',file:'bat_dive_anticipation.png',scale:.111579,anchor:[512,320]},
      dive:{key:'gr_ill_bat_dive',file:'bat_dive.png',scale:.155198,anchor:[512,320]},
      hit:{key:'gr_ill_bat_hit',file:'bat_hit.png',scale:.125296,anchor:[443.5,222]},
      death:{key:'gr_ill_bat_death',file:'bat_death.png',scale:.167987,anchor:[512,320]}
    }
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
      this.illustrated=false;
      this.reaperPoseSprites={};
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
    beginIllustrated(){
      const s=this.scene;
      if(!s.load||typeof s.load.image!=='function'||!s.textures||
         typeof s.textures.exists!=='function'||!s.add||typeof s.add.image!=='function')return false;
      if(this.loadRequested)return true;
      this.loadRequested=true;this.illustrated=true;
      // Load current state poses plus the short run and Bat wing cycles.
      const runtimeReaper=['idle',...ILLUSTRATED_RUN,'jump','fall','slide','scythe_attack',
        'crossbow_fire','hurt','death','hover'].map(name=>ILLUSTRATED.reaper[name]);
      const runtimeBat=['neutral','raised','midstroke','lowered','dive'].map(name=>ILLUSTRATED.bat[name]);
      const all=[...runtimeReaper,...runtimeBat];
      const errors=new Set();
      const fail=file=>{if(file&&file.key)errors.add(file.key);};
      const done=()=>{
        if(typeof s.load.off==='function')s.load.off('loaderror',fail);
        try{
          for(const name of ['idle',...ILLUSTRATED_RUN,'jump','fall','slide','scythe_attack',
            'crossbow_fire','hurt','death','hover']){
            const meta=ILLUSTRATED.reaper[name];
            if(errors.has(meta.key)||!s.textures.exists(meta.key))continue;
            const image=s.add.image(0,0,meta.key).setOrigin(0,0).setDepth(12).setVisible(false);
            this.reaperPoseSprites[name]=image;
          }
          if(this.reaperPoseSprites.idle){this.reaper=this.reaperPoseSprites.idle;this.reaperReady=true;}
          for(const name of ['neutral','raised','midstroke','lowered','dive']){
            const meta=ILLUSTRATED.bat[name];
            if(errors.has(meta.key)||!s.textures.exists(meta.key))this.failedAssets.push('Bat PNG unavailable: '+name);
          }
          if(runtimeBat.every(meta=>s.textures.exists(meta.key)&&!errors.has(meta.key))){
            for(let i=0;i<12;i++)this.batPool.push(s.add.image(0,0,ILLUSTRATED.bat.neutral.key)
              .setOrigin(0,0).setDepth(9).setVisible(false));
            this.batReady=true;
          }
          if(!this.reaperReady)this.failedAssets.push('Illustrated Reaper PNGs unavailable');
          this.loaded=true;
        }catch(e){
          for(const sprite of Object.values(this.reaperPoseSprites))sprite.destroy();
          this.reaperPoseSprites={};this.reaper=null;this.reaperReady=false;
          for(const sprite of this.batPool)sprite.destroy();this.batPool=[];this.batReady=false;
          this.failedAssets.push('Illustrated sprite creation: '+String(e));
        }
      };
      try{
        if(typeof s.load.on==='function')s.load.on('loaderror',fail);
        s.load.once('complete',done);
        for(const meta of all)s.load.image(meta.key,'assets/characters/illustrated/'+
          (meta.key.includes('_bat_')?'bat/':'reaper/')+meta.file);
        s.load.start();
      }catch(e){this.failedAssets.push('Illustrated loader: '+String(e));return false;}
      return true;
    }
    illustratedReaperPose(){
      const s=this.scene,p=s.player;
      if(!p)return 'idle';
      if(s.state==='dead'||s.state==='revive')return 'death';
      if(s.state==='won')return 'idle';
      if(p.sliding||p.airTuck)return 'slide';
      if(p.attackMs>0)return 'scythe_attack';
      if(p.visualFireMs>0)return 'crossbow_fire';
      if(s.damageFlashMs>0&&p.invulMs>0)return 'hurt';
      if(!p.grounded&&!p.onSoulPlatform){if(p.hovering)return 'hover';return p.velocityY<0?'jump':'fall';}
      if(['playing','rewinding','countdown'].includes(s.state))return 'run';
      return 'idle';
    }
    renderIllustrated(){
      const s=this.scene,p=s.player;
      const pose=this.illustratedReaperPose();
      let resolvedPose=pose;
      if(pose==='run'){
        const available=ILLUSTRATED_RUN.filter(name=>this.reaperPoseSprites[name]);
        if(available.length){
          const frame=Math.floor(Math.max(0,s.elapsed||0)*ILLUSTRATED_RUN_FPS)%available.length;
          resolvedPose=available[frame];
        }
      }
      resolvedPose=this.reaperPoseSprites[resolvedPose]?resolvedPose:
        (this.reaperPoseSprites.idle?'idle':Object.keys(this.reaperPoseSprites)[0]);
      const playerVisible=Boolean(p)&&!['reliquary','refundConfirm'].includes(s.state);
      for(const [name,sprite] of Object.entries(this.reaperPoseSprites))
        sprite.setVisible(name===resolvedPose&&playerVisible);
      const image=this.reaperPoseSprites[resolvedPose];
      if(image&&p&&!['reliquary','refundConfirm'].includes(s.state)){
        const resolvedMeta=ILLUSTRATED.reaper[resolvedPose],scale=resolvedMeta.scale,[ax,ay]=resolvedMeta.anchor;
        image.setScale(scale).setPosition(p.x-ax*scale,(s.feetY||p.y)-ay*scale)
          .setVisible(true).setAlpha(p.invulMs>0&&Math.floor(s.frame/5)%2===0?.58:1)
          .setTint(p.slowMs>0?0xb9ecff:0xffffff);
      }
      let used=0;
      if(!['menu','reliquary','refundConfirm'].includes(s.state)){
        const left=s.cameraX-100,right=s.cameraX+s.width+100;
        for(const e of s.enemies||[]){
          if(e.kind!=='bat'||e.dead||e.x<left||e.x>right||used>=this.batPool.length)continue;
          const flapFrame=Math.floor(Math.max(0,s.elapsed||0)*ILLUSTRATED_BAT_FPS+
            (e.phase||0))%ILLUSTRATED_BAT_FLAP.length;
          const name=e.mode==='dive'?'dive':ILLUSTRATED_BAT_FLAP[flapFrame];
          const meta=ILLUSTRATED.bat[name],sprite=this.batPool[used++];
          const [ax,ay]=meta.anchor;
          sprite.setTexture(meta.key).setOrigin(0,0).setScale(meta.scale)
            .setPosition(e.x-ax*meta.scale,e.y-ay*meta.scale).setVisible(true)
            .setAlpha(e.hp<1?.5:1).setRotation(e.mode==='dive'?.10:0);
        }
      }
      for(let i=used;i<this.batPool.length;i++)this.batPool[i].setVisible(false);
    }
    render(){
      const s=this.scene;
      const p=s.player;
      if(this.illustrated){this.renderIllustrated();return;}
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
      for(const sprite of Object.values(this.reaperPoseSprites))if(sprite!==this.reaper)sprite.destroy();
      this.reaperPoseSprites={};
      for(const sprite of this.batPool)sprite.destroy();
      this.batPool=[];
      this.reaperReady=false;this.batReady=false;
    }
  }
  scope.GRIM_VISUALS={GrimVisualSystem,reaperPose,cavernBatFrame,REAPER,BAT,CDN_PATHS,ILLUSTRATED,
    ILLUSTRATED_RUN,ILLUSTRATED_BAT_FLAP,ILLUSTRATED_RUN_FPS,ILLUSTRATED_BAT_FPS};
})(typeof window!=='undefined'?window:globalThis);
