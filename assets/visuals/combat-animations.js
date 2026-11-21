/* v0.17.0 — registered painted combat, shared bat flight and detached defeat views. */
(function(scope){
  'use strict';
  const ROOT='assets/combat/v0170/',BAT=scope.GRIM_BAT_FLIGHT;
  const TRANSITION_ROOT='assets/combat/v01912/';
  const BAT_HANDOFF={key:'combat-cavern-bat-handoff',url:TRANSITION_ROOT+'cavern-bat-handoff.webp?v=1',
    width:192,height:128,columns:6,frames:36,anchor:[126,65]};
  const ENEMY_FLASH={key:'combat-enemy-hit-flash',url:'assets/enemies/illustrated-v2/enemy-hit-flash-v1.webp?v=1',
    width:128,height:128,columns:8,frames:16,anchor:[64,90]};
  const SHOT={key:'combat-crossbow-motion',url:'assets/combat/v0201/reaper-crossbow-motion.webp?v=1',
    width:192,height:144,columns:16,frames:189};
  const TURN={key:'enemy-attack-turns',url:'assets/enemies/illustrated-v2/attack-turns.webp?v=1',
    width:128,height:128,columns:12,frames:83};
  const TURN_HIT={...TURN,key:'enemy-attack-turns-hit',url:'assets/enemies/illustrated-v2/attack-turns-hit.webp?v=1'};
  const DATA={...(scope.GRIM_COMBAT_DATA?.sheets||{})};
  delete DATA['reaper-hurt-death'];
  if(BAT)DATA['bat-flight']=BAT.SPEC;
  const FIRE_MS=260,DEFEAT_MS=760,MAX_DEFEATS=12;
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const CRAWLER_ENTRY_MS=48,CRAWLER_RESPONSE_SCALE=.30;
  const RESPONSE={bat:'bat-response',skeletalBat:'skeletal-response',crawler:'crawler-response',imp:'imp-response'};
  const DEFEAT_ENTRY_MS=40,DEFEAT_SETTLE_MS=510;
  const DEFEAT_POSES={
    bat:{scale:.26,foldMs:210,foldFrame:4,fallFrame:5,lastFrame:6},
    skeletalBat:{scale:.30,foldMs:210,foldFrame:5,fallFrame:6,lastFrame:7},
    imp:{scale:.24,foldMs:250,foldFrame:5,fallFrame:6,lastFrame:7}
  };
  // Skull positions in world pixels from the registered live and first defeat origins.
  const SKELETAL_SKULL={flap_raised:[14,-1],flap_mid_down:[9,1],flap_lowered:[18,-5],
    flap_mid_up:[12,0],telegraph:[26,-10],dive:[18,7]};
  const FRAME_RANGES=Object.fromEntries(Object.entries(DATA).map(([name,m])=>[name,Array.from({length:m.frames},(_,i)=>i)]));
  const BAT_CYCLE_SECONDS=BAT?.CYCLE_SECONDS||.96;
  function preload(s){
    if(!s.load?.spritesheet)return;
    for(const [name,m]of Object.entries(DATA))s.load.spritesheet('combat-'+name,name==='bat-flight'?(BAT?.FILE||'assets/encounters/v0190/bat-flight.png?v=0.19.0'):ROOT+name+'.png?v=0.17.0',
      {frameWidth:m.cell[0],frameHeight:m.cell[1],endFrame:m.frames-1});
  }
  function transitionReady(s,art){
    if(!s.textures.exists(art.key))return false;
    const texture=s.textures.get(art.key),image=texture.getSourceImage?.();
    return image?.width===art.width*art.columns&&image.height===art.height*Math.ceil(art.frames/art.columns)&&
      Array.from({length:art.frames},(_,i)=>i).every(i=>texture.has(i));
  }
  function sample(t,count,loop=false){
    const f=loop?((t%count)+count)%count:clamp(t,0,count-1);
    const a=Math.floor(f),b=loop?(a+1)%count:Math.min(count-1,a+1);
    return {a,b,mix:f-a};
  }
  function batMotion(seconds,phase=0){
    if(BAT)return BAT.motion(seconds,phase);
    return sample(seconds*16/BAT_CYCLE_SECONDS+phase*2.54648,16,true);
  }
  function muzzle(s){return {x:s.player.x+52,y:s.player.y-(s.lowProfile?36:65)};}
  function attackFrame(progress,count){
    const p=clamp(progress),lastStrike=count-4;
    if(p<.20)return p/.20*3;
    if(p<.79)return 3+(p-.20)/.59*(lastStrike-3);
    return lastStrike+(p-.79)/.21*(count-1-lastStrike);
  }
  class CombatAnimations{
    constructor(s){
      this.scene=s;this.ready={};this.corpses=[];this.sequence=0;this.reaperState=null;
      this.enemyFlashReady=false;
      this.reducedMotion=scope.matchMedia?.('(prefers-reduced-motion: reduce)');
      this.batHandoffs=new WeakMap();
      this.reaper=[];this.bats=[];this.responses=[];this.effects=[];this.echoes=[];
      if(!s.add?.image||!s.textures?.exists)return;
      for(const [name,m]of Object.entries(DATA))this.ready[name]=Boolean(s.textures.exists('combat-'+name)&&
        Array.from({length:m.frames},(_,i)=>s.textures.get('combat-'+name).has(i)).every(Boolean));
      this.batHandoffReady=transitionReady(s,BAT_HANDOFF);
      scope.GRIM_ACTOR_TEXTURES?.load(s,BAT_HANDOFF,()=>{this.batHandoffReady=transitionReady(s,BAT_HANDOFF);});
      scope.GRIM_ACTOR_TEXTURES?.load(s,ENEMY_FLASH,()=>{this.enemyFlashReady=transitionReady(s,ENEMY_FLASH);});
      for(const art of [SHOT,TURN,TURN_HIT]){
        scope.GRIM_ACTOR_TEXTURES?.load(s,art,()=>{this.ready[art.key]=transitionReady(s,art);});
      }
      const pair=(depth)=>[0,1].map(()=>s.add.image(0,0,'combat-reaper-slide-cut',0).setDepth(depth).setVisible(false));
      if(this.ready['reaper-slide-cut']){
        this.reaper=pair(12.05);
        for(let i=0;i<12;i++)this.bats.push([...pair(9.2),s.add.image(0,0,'combat-reaper-slide-cut',0).setDepth(9.2).setVisible(false)]);
        for(let i=0;i<16;i++)this.responses.push(pair(9.4));
        for(let i=0;i<20;i++)this.effects.push(pair(14.8));
        for(let i=0;i<4;i++)this.echoes.push(pair(11.8));
      }
      s.events?.once?.('shutdown',()=>this.destroy());
    }
    all(){return this.views||(this.views=[...this.reaper,...this.bats.flat(),...this.responses.flat(),...this.effects.flat(),...this.echoes.flat()]);}
    reset(){
      this.corpses=[];this.sequence=0;this.reaperState=null;
      this.batHandoffs=new WeakMap();for(const v of this.all())v.setVisible(false);
    }
    snapshot(){return this.corpses.map(v=>({...v}));}
    restore(values=[]){this.corpses=values.map(v=>({...v}));}
    resizeDefeats(dy){for(const corpse of this.corpses)corpse.y+=dy;}
    enemyFlashing(e){return !e.dead&&(e.visualHitUntil||0)>(this.scene.elapsed||0);}
    paintEnemyFlash(view,frame){
      if(!this.enemyFlashReady)return;
      // The original pose is still the entry image if this hit turns lethal.
      view.__grimBaseKey=view.texture.key;view.__grimBaseFrame=view.frame.name;
      view.__grimBaseOriginX=view.originX;view.__grimBaseOriginY=view.originY;
      view.__grimBaseScale=view.scaleX;
      view.setTexture(ENEMY_FLASH.key,frame).setOrigin(ENEMY_FLASH.anchor[0]/ENEMY_FLASH.width,
        ENEMY_FLASH.anchor[1]/ENEMY_FLASH.height).setScale(1);
    }
    paintTurn(view,frame,enemy){
      if(frame===null||!this.ready[TURN.key]||!this.ready[TURN_HIT.key])return false;
      const hit=this.enemyFlashing(enemy);
      view.setTexture(hit?TURN_HIT.key:TURN.key,frame).setOrigin(.5,90/128).setScale(1);
      return true;
    }
    defeatEntry(e){
      const visuals=this.scene.visuals;
      const pool=e.kind==='bat'?visuals?.batPool:e.kind==='skeletalBat'?visuals?.skeletalBatPool:visuals?.emberImpPool;
      const bat=e.kind==='bat'?this.bats.find(([v])=>v.visible&&v.__grimEntity===e)?.[0]:null;
      const view=bat||pool?.find(v=>v.visible&&v.__grimEntity===e);
      if(!view)return null;
      const flash=view.texture.key===ENEMY_FLASH.key;
      return {
        key:flash?view.__grimBaseKey:view.texture.key===TURN_HIT.key?TURN.key:view.texture.key,frame:flash?view.__grimBaseFrame:view.frame.name,
        originX:flash?view.__grimBaseOriginX:view.originX,originY:flash?view.__grimBaseOriginY:view.originY,
        scale:flash?view.__grimBaseScale:view.scaleX,rotation:view.rotation,flip:view.flipX,
        dx:view.__grimBatOffsetX??0,dy:view.__grimBatOffsetY??0
      };
    }
    enemyHit(e,defeated){
      if(!RESPONSE[e.kind])return false;
      const {visuals,terrain,elapsed}=this.scene;
      if(!defeated){
        if(e.hp!==1||(e.kind!=='skeletalBat'&&e.kind!=='imp'))return false;
        const illustrated=e.kind==='skeletalBat'?visuals?.skeletalBatReady:visuals?.emberImpReady;
        if(illustrated&&!this.enemyFlashReady)return false;
        e.visualHitUntil=(elapsed||0)+(this.reducedMotion?.matches ? .075 : .105);
        return true;
      }
      e.visualHitUntil=0;
      const flying=e.kind==='bat'||e.kind==='skeletalBat';
      // Keep the grounded lookup. For flyers, read only already-generated terrain.
      const ground=flying?(e.x<terrain.generatedThrough?terrain.groundAt(e.x):null):
        (terrain.groundAt(e.x)??terrain.anchorAt(e.x));
      const y=flying?e.y:e.kind==='imp'?e.y+22:ground;
      const corpse={kind:e.kind,x:e.x,y,age:0,seed:++this.sequence,flying};
      if(e.kind==='crawler'){
        const view=visuals?.boneCrawlerPool?.find(v=>v.visible&&v.__grimEntity===e);
        corpse.crawlFrame=view?.__grimCrawlerFrame??null;
      }else{
        corpse.entry=this.defeatEntry(e);
        corpse.drop=flying?(ground==null?84:Math.max(0,Math.min(84,ground-e.y-12))):0;
        const entry=corpse.entry;
        const skull=e.kind==='skeletalBat'&&entry&&(entry.key===TURN.key?
          scope.GRIM_ENEMY_MOTION.turnSkull(Number(entry.frame),SKELETAL_SKULL):SKELETAL_SKULL[entry.frame]);
        if(skull){
          const [x,y]=skull,cos=Math.cos(entry.rotation),sin=Math.sin(entry.rotation);
          corpse.joinX=x*cos-y*sin-18;corpse.joinY=x*sin+y*cos-7;
        }
        // The live Imp faces the Reaper while warning or throwing a fireball.
        corpse.flip=e.kind==='imp'&&(entry?.frame==='warning'||entry?.frame==='release');
      }
      this.corpses.push(corpse);
      if(this.corpses.length>MAX_DEFEATS)this.corpses.shift();
      e.visualDefeatOwned=Boolean(this.responses.length&&this.ready[RESPONSE[e.kind]]);
      return e.visualDefeatOwned;
    }
    tick(ms){
      const p=this.scene.player;if(!p)return;
      p.visualHurtMs=Math.max(0,(p.visualHurtMs||0)-ms);
      for(const c of this.corpses)c.age+=ms;
      if(this.corpses.length)this.corpses=this.corpses.filter(c=>c.age<DEFEAT_MS);
    }
    blend(pair,name,t,x,y,scale,alpha=1,rotation=0,frames=null){
      const m=DATA[name];if(!m||!this.ready[name]||!pair?.length)return false;
      const span=frames||FRAME_RANGES[name],f=sample(t,span.length);
      for(let i=0;i<2;i++){
        const v=pair[i],weight=i?f.mix:1-f.mix;
        v.setTexture('combat-'+name,span[i?f.b:f.a]).setOrigin(m.anchor[0]/m.cell[0],m.anchor[1]/m.cell[1])
          .setScale(scale).setPosition(x,y).setAlpha(alpha*weight).setRotation(rotation).setFlipX(false).clearTint()
          .setVisible(weight>0.001&&alpha>0);
      }
      return true;
    }
    hideReaper(){
      const s=this.scene;s.powerArt?.hideBase();s.powerArt?.action?.setVisible(false);s.powerArt?.weapon?.setVisible(false);
    }
    renderSolidAction(name,t,x,y,scale,alpha,frames){
      const {anchor,cell}=DATA[name],span=frames||FRAME_RANGES[name];
      const frame=span[Math.round(clamp(t,0,span.length-1))];
      // These authored Reaper frames include their weapons. Keep the nearest
      // drawing whole. Blending two misaligned drawings thins the body and
      // draws two partly visible cutting edges or crossbow muzzles.
      this.reaper[0].setTexture('combat-'+name,frame)
        .setOrigin(anchor[0]/cell[0],anchor[1]/cell[1])
        .setScale(scale).setPosition(x,y).setRotation(0).setFlipX(false)
        .clearTint().setAlpha(alpha).setVisible(alpha>0);
      this.reaper[1].setVisible(false);
    }
    get shotReady(){return Boolean(this.ready[SHOT.key]);}
    renderShot(progress){
      const s=this.scene,p=s.player;
      const gait=scope.GRIM_MOTION_ART?.runAtlasFrame(p.x-(s.startX||0))??0;
      const band=s.lowProfile?(p.grounded?19:20):p.grounded?Math.round(gait/6)%16:
        16+(p.velocityY < -100?0:p.velocityY>100?2:1);
      const frame=band*9+Math.round(progress*8);
      const rise=p.grounded&&!s.lowProfile?scope.GRIM_MOTION_ART?.runSupportRise(s,p,gait)||0:0;
      this.reaper[0].setTexture(SHOT.key,frame).setOrigin(112/192,132/144).setScale(1)
        .setPosition(p.x,s.feetY+rise).setAlpha(p.invulMs>0&&Math.floor(s.frame/5)%2===0?.58:1)
        .setRotation(0).setFlipX(false).clearTint().setVisible(true);
      this.reaper[1].setVisible(false);
    }
    renderReaper(){
      const s=this.scene,p=s.player;if(!p||!s.visuals?.reaperReady||!this.reaper.length)return;
      if(!['playing','paused','rewinding','countdown'].includes(s.state))return;
      let name,t,scale,frames;
      if(p.sliding&&p.attackMs>0){
        name='reaper-slide-cut';t=attackFrame(1-p.attackMs/scope.GRIM_CONFIG.attackDurationMs,DATA[name].frames);scale=.385;
      }else if(p.grounded&&p.attackMs>0&&s.powerManager.level('soulCleave')>0&&this.ready['reaper-soul-cleave']){
        name='reaper-soul-cleave';t=attackFrame(1-p.attackMs/scope.GRIM_CONFIG.attackDurationMs,DATA[name].frames);scale=.52;
      }else if(p.visualFireMs>0&&p.attackMs<=0){
        const progress=clamp(1-p.visualFireMs/FIRE_MS);
        if(s.lowProfile){name='reaper-crossbow';frames=[8,9,10,11,12,13,14,15];scale=.385;}
        else if(!p.grounded){name='reaper-air-crossbow';scale=.40;}
        else {name='reaper-crossbow';frames=[0,1,2,3,4,5,6,7];scale=.45;}
        t=progress*((frames?.length||DATA[name].frames)-1);
      }
      if(name&&this.ready[name]){
        this.hideReaper();const alpha=p.invulMs>0&&Math.floor(s.frame/5)%2===0?.58:1;
        if(this.ready[SHOT.key]&&p.visualShotMotion!==false&&name.includes('crossbow'))this.renderShot(clamp(1-p.visualFireMs/FIRE_MS));
        else this.renderSolidAction(name,t,p.x,s.feetY,scale,alpha,frames);
        this.reaperState={name,frame:t};
      }
    }
    renderBats(){
      const s=this.scene;if(!this.bats.length||!this.ready['bat-flight']||!s.visuals?.reviewV2||!s.visuals?.batReady)return;
      if(!['playing','paused','rewinding','countdown','dying'].includes(s.state))return;
      for(const v of s.visuals.batPool)v.setVisible(false);
      let n=0;
      for(const e of s.enemies||[]){
        if(e.kind!=='bat'||e.dead||e.x<s.cameraX-130||e.x>s.cameraX+s.width+130||n>=this.bats.length)continue;
        const pair=this.bats[n++];for(const v of pair)v.setVisible(false).setRotation(0).setFlipX(false).clearTint();
        this.renderCavernBat(pair[0],e);
      }
    }
    renderCavernBat(view,e){
      const elapsed=this.scene.elapsed||0,phase=e.phase||0,timer=e.timer||0;
      const weight=e.mode==='dive'?clamp(timer/.12):e.mode==='recover'?1-clamp(timer/.12):0;
      const pose=Math.round(weight*4);
      let pinned=this.batHandoffs.get(e);
      if(e.mode==='dive'||e.mode==='recover'){
        if(!pinned||pinned.mode!==e.mode||timer<pinned.timer){
          pinned={mode:e.mode,timer,ready:this.batHandoffReady};
          this.batHandoffs.set(e,pinned);
        }
        pinned.timer=timer;
      }else {this.batHandoffs.delete(e);pinned=null;}
      // Select one solid contour. Sample the flight phase at the shared end
      // of the handoff so the strip's starting wing pose stays consistent.
      if(pinned?.ready&&BAT&&pose>0&&pose<4){
        const boundary=elapsed+(e.mode==='dive'?-timer:.12-timer);
        const lead=Math.round(batMotion(boundary,phase).a/8)%12;
        const art=BAT_HANDOFF;
        view.setTexture(art.key,lead*3+pose-1).setOrigin(art.anchor[0]/art.width,art.anchor[1]/art.height)
          .setScale(1).setRotation(0);
      }else if(weight>=.5){
        const m=scope.GRIM_VISUALS.V2_BAT.dive;
        view.setTexture(m.key).setOrigin(m.anchor[0]/2304,m.anchor[1]/1280)
          .setScale(m.scale).setRotation(.1*weight);
      }else{
        const m=DATA['bat-flight'],frame=batMotion(elapsed,phase).a;
        view.setTexture('combat-bat-flight',frame).setOrigin(m.anchor[0]/m.cell[0],m.anchor[1]/m.cell[1])
          .setScale(.32/(BAT?.SOURCE_SCALE||1)).setRotation(0);
      }
      view.__grimEntity=e;
      view.setPosition(e.x,e.y).setAlpha(1).setVisible(true);
    }
    renderCrawlerResponse(view,item,progress,alpha){
      const scene=this.scene,motion=scope.GRIM_ENEMY_MOTION;
      const reference=motion.crawlView(scene,item.crawlFrame);
      const frame=2+Math.min(5,Math.floor(progress*6));
      const paint=reference&&item.age<=CRAWLER_ENTRY_MS?reference:{key:'combat-crawler-response',frame,
        width:512,height:512,scale:CRAWLER_RESPONSE_SCALE,imageScale:CRAWLER_RESPONSE_SCALE,claws:motion.RESPONSE_CLAWS[frame]};
      const pose=motion.responsePose(scene.terrain,item.x,item.y,paint,paint===reference?null:reference);
      view.setTexture(paint.key,paint.frame).setOrigin(.5,.5).setScale(paint.imageScale)
        .setPosition(pose.x,pose.y).setRotation(pose.angle).setAlpha(alpha).setFlipX(true)
        .clearTint().setVisible(alpha>0);
    }
    renderResponses(){
      const s=this.scene;if(!['playing','paused','rewinding','countdown','dying'].includes(s.state))return;
      let n=0;
      for(const item of this.corpses){
        const name=RESPONSE[item.kind];
        if(!this.ready[name]||item.x<s.cameraX-200||item.x>s.cameraX+s.width+200)continue;
        const view=this.responses[n++]?.[0];if(!view)break;
        const {age,entry,x,y}=item,progress=clamp(age/DEFEAT_MS);
        const alpha=item.kind==='crawler'?clamp((1-progress)/.24):clamp((DEFEAT_MS-age)/(DEFEAT_MS-DEFEAT_SETTLE_MS));
        if(item.kind==='crawler'&&scope.GRIM_ENEMY_MOTION){
          this.renderCrawlerResponse(view,item,progress,alpha);continue;
        }
        if(entry&&age<DEFEAT_ENTRY_MS){
          view.setTexture(entry.key,entry.frame).setOrigin(entry.originX,entry.originY).setScale(entry.scale)
            .setPosition(x+entry.dx,y+entry.dy).setRotation(entry.rotation).setFlipX(entry.flip)
            .clearTint().setAlpha(1).setVisible(true);
          continue;
        }
        const {anchor,cell}=DATA[name],poses=DEFEAT_POSES[item.kind];
        let frame=2+Math.round(progress*5),drop=0,scale=CRAWLER_RESPONSE_SCALE;
        if(poses){
          const fold=clamp((age-DEFEAT_ENTRY_MS)/(poses.foldMs-DEFEAT_ENTRY_MS));
          const fall=clamp((age-poses.foldMs)/(DEFEAT_SETTLE_MS-poses.foldMs));
          frame=age>=DEFEAT_SETTLE_MS?poses.lastFrame:Math.round(2+fold*(poses.foldFrame-2)+fall*(poses.fallFrame-poses.foldFrame));
          const descent=clamp((age-DEFEAT_ENTRY_MS)/(DEFEAT_SETTLE_MS-DEFEAT_ENTRY_MS));
          drop=item.drop*descent*descent;scale=poses.scale;
        }
        const join=clamp(1-(age-DEFEAT_ENTRY_MS)/112);
        view.setTexture('combat-'+name,frame).setOrigin(anchor[0]/cell[0],anchor[1]/cell[1]).setScale(scale)
          .setPosition(x+(item.joinX||0)*join,y+drop+(item.joinY||0)*join).setRotation(0)
          .setFlipX(item.kind==='crawler'||item.flip)
          .clearTint().setAlpha(alpha).setVisible(alpha>0);
      }
    }
    handlesEffect(b){return this.effects.length>0&&this.ready['combat-effects']&&b.kind!=='purchase'&&['soulCleave','rapidFire','powerShot','chainShot','infernalBoots'].includes(b.id);}
    renderEffects(){
      const s=this.scene;if(!['playing','paused','countdown','dying','upgrade'].includes(s.state))return;
      let used=0;
      for(const b of s.powerArt?.bursts||[]){
        if(!this.handlesEffect(b)||used>=this.effects.length)continue;
        const progress=b.id==='soulCleave'?scope.GRIM_POWER_ART.soulCleaveActivePhase(s):clamp(b.age/b.duration);
        if(progress===null)continue;
        let start=0,count=4,w=65,h=55,x=b.x,y=b.y;
        if(b.id==='soulCleave'){count=8;w=180*(1+s.powerManager.attackBonus());h=w*.58;x=s.player.x+w*.30;y=s.feetY-(s.lowProfile?31:65);}
        if(b.id==='rapidFire'){start=8;w=65;h=34;}
        if(b.id==='powerShot'){start=12;w=b.kind==='blast'?s.width*.65:80+b.level*9;h=w*.66;}
        if(b.id==='chainShot'){start=16;w=64+b.level*5;h=w;}
        if(b.id==='infernalBoots'){start=20;w=90;h=65;}
        const frames=Array.from({length:count},(_,i)=>start+i);
        const pair=this.effects[used++];this.blend(pair,'combat-effects',progress*(count-1),x,y,1,1-progress*.5,0,frames);
        for(const v of pair)v.setDisplaySize(w,h);
      }
      // Authored flame drawings make healing a continuous holy-light action.
      const healing=(s.powerArt?.bursts||[]).find(b=>['vitalEssence','soulMend'].includes(b.id));
      if(healing&&this.effects[used]&&s.textures.exists('polish-soul')){
        const t=healing.age/healing.duration,v=this.effects[used][0];
        v.setTexture('polish-soul',Math.floor(t*7)).setOrigin(.5).setPosition(s.player.x,s.feetY-35-t*55)
          .setDisplaySize(28,45).setAlpha(Math.sin(t*Math.PI)*.65).setVisible(true);
      }
    }
    renderTimeEchoes(){
      const s=this.scene,p=s.player;
      if(!p||!['playing','paused','rewinding'].includes(s.state)||!(p.slowMs>0||s.state==='rewinding'))return;
      // Keep the echoes on contact and early recovery when Slide covers
      // the landing pose that previously supplied them.
      const slide=s.slideArt;
      const coveredLanding=slide?.fromTuck&&slide.sprite?.visible&&
        (s.motionArt?.state?.name==='reaper-tuck-slide'||(!p.sliding&&p.visualLandingMs>0));
      const reaction=s.reactionArt?.body;
      const rising=s.motionArt?.rising?.sprite;
      const base=(reaction?.visible&&reaction.alpha>.1&&reaction)||
        (rising?.visible&&rising.alpha>.1&&!p.visualFireMs&&rising)||s.motionArt?.body?.find(v=>v.visible&&v.alpha>.1)||(coveredLanding&&slide.sprite)||
        this.reaper.find(v=>v.visible&&v.alpha>.1)||
        Object.values(s.visuals?.reaperPoseSprites||{}).find(v=>v.visible);if(!base)return;
      const rear=s.motionArt?.rearWeaponFor?.(base)||
        (base===reaction&&s.reactionArt.weapon?.visible?s.reactionArt.weapon:null);
      const tint=s.state==='rewinding'?0xc7aaff:0x9bdcff;
      for(let i=0;i<3;i++){
        const pair=this.echoes[i];if(!pair)continue;
        const views=rear?[base,rear]:[base];
        for(const [j,pose] of views.entries()){
          pair[j].setTexture(pose.texture.key,pose.frame.name)
            .setOrigin(pose.originX,pose.originY).setScale(pose.scaleX,pose.scaleY)
            .setPosition(pose.x-(i+1)*13,pose.y).setRotation(pose.rotation).setTint(tint)
            .setDepth(j===1?Math.min(11.79,pose.depth):11.8).setAlpha(.12-i*.032).setVisible(true);
        }
      }
    }
    render(){
      for(const v of this.all())v.setVisible(false);this.reaperState=null;
      this.renderBats();this.renderResponses();this.renderReaper();this.renderEffects();
    }
    destroy(){for(const v of this.all())v.destroy();this.corpses=[];}
  }
  scope.GRIM_COMBAT_ART={CombatAnimations,preload,sample,batMotion,muzzle,attackFrame,FIRE_MS,DEFEAT_MS,MAX_DEFEATS,BAT_CYCLE_SECONDS};
})(typeof window!=='undefined'?window:globalThis);
