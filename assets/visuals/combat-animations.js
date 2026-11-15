/* v0.17.0 — registered painted combat, shared bat flight and detached defeat views. */
(function(scope){
  'use strict';
  const ROOT='assets/combat/v0170/',BAT=scope.GRIM_BAT_FLIGHT;
  const TRANSITION_ROOT='assets/combat/v01912/';
  const BAT_HANDOFF={key:'combat-cavern-bat-handoff',url:TRANSITION_ROOT+'cavern-bat-handoff.webp?v=1',
    width:192,height:128,columns:6,frames:36,anchor:[126,65]};
  const REAPER_HANDOFF={key:'combat-reaper-hurt-death-handoff',url:TRANSITION_ROOT+'reaper-hurt-death-handoff.webp?v=1',
    width:224,height:168,columns:5,frames:20,anchor:[112,157]};
  const DATA={...(scope.GRIM_COMBAT_DATA?.sheets||{})};
  if(BAT)DATA['bat-flight']=BAT.SPEC;
  const FIRE_MS=260,HURT_MS=340,DEATH_MS=880,DEFEAT_MS=760,MAX_DEFEATS=12;
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const CRAWLER_ENTRY_MS=48,CRAWLER_RESPONSE_SCALE=.30;
  const RESPONSE={bat:'bat-response',skeletalBat:'skeletal-response',crawler:'crawler-response',imp:'imp-response'};
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
      this.batHandoffs=new WeakMap();this.reaperHandoff=null;
      this.reaper=[];this.bats=[];this.responses=[];this.effects=[];this.echoes=[];
      if(!s.add?.image||!s.textures?.exists)return;
      for(const [name,m]of Object.entries(DATA))this.ready[name]=Boolean(s.textures.exists('combat-'+name)&&
        Array.from({length:m.frames},(_,i)=>s.textures.get('combat-'+name).has(i)).every(Boolean));
      this.batHandoffReady=transitionReady(s,BAT_HANDOFF);
      this.reaperHandoffReady=transitionReady(s,REAPER_HANDOFF);
      scope.GRIM_ACTOR_TEXTURES?.load(s,BAT_HANDOFF,()=>{this.batHandoffReady=transitionReady(s,BAT_HANDOFF);});
      scope.GRIM_ACTOR_TEXTURES?.load(s,REAPER_HANDOFF,()=>{this.reaperHandoffReady=transitionReady(s,REAPER_HANDOFF);});
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
      this.corpses=[];this.sequence=0;this.reaperState=null;this.reaperHandoff=null;
      this.batHandoffs=new WeakMap();for(const v of this.all())v.setVisible(false);
    }
    snapshot(){return this.corpses.map(v=>({...v}));}
    restore(values=[]){this.corpses=values.map(v=>({...v}));}
    enemyHit(e,defeated){
      if(!RESPONSE[e.kind])return;
      e.visualHitMs=240;
      if(e.kind==='crawler')e.visualCrawlerResponse=Boolean(this.ready[RESPONSE.crawler]);
      if(!defeated)return;
      const flying=e.kind==='bat'||e.kind==='skeletalBat';
      const y=flying?e.y:(this.scene.terrain.groundAt(e.x)??this.scene.terrain.anchorAt(e.x));
      const corpse={kind:e.kind,x:e.x,y,age:0,seed:++this.sequence,flying};
      if(e.kind==='crawler'){
        const view=this.scene.visuals?.boneCrawlerPool?.find(v=>v.visible&&v.__grimEntity===e);
        corpse.crawlFrame=view?.__grimCrawlerFrame??null;
        corpse.visualCrawlerResponse=e.visualCrawlerResponse;
      }
      this.corpses.push(corpse);
      if(this.corpses.length>MAX_DEFEATS)this.corpses.shift();
    }
    tick(ms){
      const p=this.scene.player;if(!p)return;
      p.visualHurtMs=Math.max(0,(p.visualHurtMs||0)-ms);
      for(const e of this.scene.enemies||[])e.visualHitMs=Math.max(0,(e.visualHitMs||0)-ms);
      for(const c of this.corpses)c.age+=ms;
      this.corpses=this.corpses.filter(c=>c.age<DEFEAT_MS);
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
    renderHurtDeath(t,x,y,alpha,death=false){
      const count=death?8:4,first=death?4:0,part=clamp(t,0,count-1);
      const slot=Math.floor(part*3),offset=slot%3;
      const view=this.reaper[0];
      if(!this.reaperHandoff||this.reaperHandoff.death!==death||part<this.reaperHandoff.part)
        this.reaperHandoff={death,ready:this.reaperHandoffReady,part};
      this.reaperHandoff.part=part;
      if(offset&&this.reaperHandoff.ready){
        const art=REAPER_HANDOFF,segment=Math.floor(slot/3)+(death?3:0);
        view.setTexture(art.key,segment*2+offset-1)
          .setOrigin(art.anchor[0]/art.width,art.anchor[1]/art.height).setScale(1);
      }else{
        const key='reaper-hurt-death',art=DATA[key];
        view.setTexture('combat-'+key,first+Math.round(part))
          .setOrigin(art.anchor[0]/art.cell[0],art.anchor[1]/art.cell[1]).setScale(.45);
      }
      this.reaper[1].setVisible(false);
      view.setPosition(x,y).setRotation(0).setFlipX(false).clearTint().setAlpha(alpha).setVisible(alpha>0);
    }
    renderReaper(){
      const s=this.scene,p=s.player;if(!p||!s.visuals?.reaperReady||!this.reaper.length)return;
      const dead=['dying','dead','revive'].includes(s.state);
      if(!dead&&(!(p.visualHurtMs>0)||s.lowProfile))this.reaperHandoff=null;
      if(dead&&this.ready['reaper-hurt-death']){
        const progress=s.state==='dying'?clamp((s.deathPoseMs||0)/DEATH_MS):1;
        const floor=s.terrain.groundAt(p.x),fall=Number.isFinite(floor)&&floor>s.feetY?clamp(progress*1.5)**2:0;
        const y=s.feetY+(Number.isFinite(floor)?floor-s.feetY:0)*fall;
        this.hideReaper();this.renderHurtDeath(progress*7,p.x,y,1,true);
        this.reaperState={name:'death',progress};return;
      }
      if(!['playing','paused','rewinding','countdown'].includes(s.state))return;
      let name,t,scale,frames;
      if((p.visualHurtMs||0)>0){
        if(s.lowProfile){name='reaper-slide-cut';frames=[0];t=0;scale=.385;}
        else {name='reaper-hurt-death';t=(1-p.visualHurtMs/HURT_MS)*3;}
      }else if(p.sliding&&p.attackMs>0){
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
        if(name==='reaper-hurt-death')this.renderHurtDeath(t,p.x,s.feetY,alpha);
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
        const pair=this.bats[n++];for(const v of pair)v.setVisible(false).setRotation(0).setFlipX(false).clearTint();if(e.visualHitMs>0&&this.ready['bat-response'])continue;
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
      view.setPosition(e.x,e.y).setAlpha(1).setVisible(true);
    }
    renderCrawlerResponse(pair,item,dead,progress,y,alpha){
      const scene=this.scene,motion=scope.GRIM_ENEMY_MOTION;
      const live=dead?null:scene.visuals?.boneCrawlerPool?.find(v=>v.visible&&v.__grimEntity===item);
      // Retain the real painted crawl at both ends of a surviving hit.
      if(live&&(progress<=.16||progress>=.84))return;
      const reference=motion.crawlView(scene,dead?item.crawlFrame:live?.__grimCrawlerFrame);
      let paint;
      if(dead&&reference&&item.age<=CRAWLER_ENTRY_MS){
        paint=reference;
      }else{
        const frame=dead?2+Math.min(5,Math.floor(progress*6)):Math.min(2,Math.floor(progress*3));
        paint={key:'combat-crawler-response',frame,width:512,height:512,scale:CRAWLER_RESPONSE_SCALE,
          imageScale:CRAWLER_RESPONSE_SCALE,claws:motion.RESPONSE_CLAWS[frame]};
      }
      const pose=motion.responsePose(scene.terrain,item.x,y,paint,paint===reference?null:reference);
      pair[0].setTexture(paint.key,paint.frame).setOrigin(.5,.5).setScale(paint.imageScale)
        .setPosition(pose.x,pose.y).setRotation(pose.angle).setAlpha(alpha).setFlipX(true)
        .clearTint().setVisible(alpha>0);
      live?.setVisible(false);
    }
    renderResponses(){
      const s=this.scene;if(!['playing','paused','rewinding','countdown','dying'].includes(s.state))return;
      let n=0;
      const draw=(item,dead)=>{
        const name=RESPONSE[item.kind];if(!this.ready[name]||n>=this.responses.length)return;
        const flying=item.kind==='bat'||item.kind==='skeletalBat',count=DATA[name].frames;
        const frames=dead?Array.from({length:count-2},(_,i)=>i+2):[0,1,2];
        const progress=dead?clamp(item.age/DEFEAT_MS):1-item.visualHitMs/240;
        const y=flying?(dead?Math.min(item.y+progress*50+progress*progress*90,(s.terrain.groundAt(item.x)??item.y+200)-12):item.y)
          :dead?item.y:(s.terrain.groundAt(item.x)??s.terrain.anchorAt(item.x));
        const alpha=dead?clamp((1-progress)/.24):1;
        const pair=this.responses[n++];
        if(item.kind==='crawler'&&scope.GRIM_ENEMY_MOTION){
          this.renderCrawlerResponse(pair,item,dead,progress,y,alpha);
        }else{
          const scale={bat:.26,skeletalBat:.30,crawler:CRAWLER_RESPONSE_SCALE,imp:.24}[item.kind];
          this.blend(pair,name,progress*(frames.length-1),item.x,y,scale,alpha,0,frames);
          if(item.kind==='crawler')for(const view of pair)view.setFlipX(true);
        }
      };
      for(const e of s.enemies||[])if(!e.dead&&e.visualHitMs>0&&e.x>=s.cameraX-150&&e.x<=s.cameraX+s.width+150){
        for(const pool of [s.visuals?.skeletalBatPool,s.visuals?.emberImpPool,
          scope.GRIM_ENEMY_MOTION?null:s.visuals?.boneCrawlerPool])
          for(const v of pool||[])if(v.__grimEntity===e&&this.ready[RESPONSE[e.kind]])v.setVisible(false);
        draw(e,false);
      }
      for(const c of this.corpses)if(c.x>=s.cameraX-200&&c.x<=s.cameraX+s.width+200)draw(c,true);
    }
    handlesEffect(b){return this.effects.length>0&&this.ready['combat-effects']&&b.kind!=='purchase'&&['soulCleave','rapidFire','powerShot','chainShot','infernalBoots'].includes(b.id);}
    renderEffects(){
      const s=this.scene;if(!['playing','paused','countdown','dying','upgrade'].includes(s.state))return;
      let used=0;
      for(const b of s.powerArt?.bursts||[]){
        if(!this.handlesEffect(b)||used>=this.effects.length)continue;
        let start=0,count=4,w=65,h=55,x=b.x,y=b.y;
        if(b.id==='soulCleave'){count=8;w=180*(1+s.powerManager.attackBonus());h=w*.58;x=s.player.x+w*.30;y=s.feetY-(s.lowProfile?31:65);}
        if(b.id==='rapidFire'){start=8;w=65;h=34;}
        if(b.id==='powerShot'){start=12;w=b.kind==='blast'?s.width*.65:80+b.level*9;h=w*.66;}
        if(b.id==='chainShot'){start=16;w=64+b.level*5;h=w;}
        if(b.id==='infernalBoots'){start=20;w=90;h=65;}
        const frames=Array.from({length:count},(_,i)=>start+i),progress=clamp(b.age/b.duration);
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
      const base=s.motionArt?.body?.find(v=>v.visible&&v.alpha>.1)||this.reaper.find(v=>v.visible&&v.alpha>.1)||
        Object.values(s.visuals?.reaperPoseSprites||{}).find(v=>v.visible);if(!base)return;
      for(let i=0;i<3;i++){
        const v=this.echoes[i]?.[0];if(!v)continue;
        v.setTexture(base.texture.key,base.frame.name).setOrigin(base.originX,base.originY).setScale(base.scaleX,base.scaleY)
          .setPosition(base.x-(i+1)*13,base.y).setRotation(base.rotation).setTint(s.state==='rewinding'?0xc7aaff:0x9bdcff)
          .setAlpha(.12-i*.032).setVisible(true);
      }
    }
    render(){
      for(const v of this.all())v.setVisible(false);this.reaperState=null;
      this.renderBats();this.renderResponses();this.renderReaper();this.renderEffects();
    }
    destroy(){for(const v of this.all())v.destroy();this.corpses=[];}
  }
  scope.GRIM_COMBAT_ART={CombatAnimations,preload,sample,batMotion,muzzle,attackFrame,FIRE_MS,HURT_MS,DEATH_MS,DEFEAT_MS,MAX_DEFEATS,BAT_CYCLE_SECONDS};
})(typeof window!=='undefined'?window:globalThis);
