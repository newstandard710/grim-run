/* v0.17.0 — registered painted combat, shared bat flight and detached defeat views. */
(function(scope){
  'use strict';
  const ROOT='assets/combat/v0170/',DATA=scope.GRIM_COMBAT_DATA?.sheets||{};
  const FIRE_MS=260,HURT_MS=340,DEATH_MS=880,DEFEAT_MS=760,MAX_DEFEATS=12;
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const RESPONSE={bat:'bat-response',skeletalBat:'skeletal-response',crawler:'crawler-response',imp:'imp-response'};
  function preload(s){
    if(!s.load?.spritesheet)return;
    for(const [name,m]of Object.entries(DATA))s.load.spritesheet('combat-'+name,ROOT+name+'.png?v=0.17.0',
      {frameWidth:m.cell[0],frameHeight:m.cell[1],endFrame:m.frames-1});
  }
  function sample(t,count,loop=false){
    const f=loop?((t%count)+count)%count:clamp(t,0,count-1);
    const a=Math.floor(f),b=loop?(a+1)%count:Math.min(count-1,a+1);
    return {a,b,mix:f-a};
  }
  function batMotion(seconds,phase=0){
    // Sixteen distinct drawings at 24 poses/sec; body/eyes have one fixed root.
    return sample(seconds*24+phase*2.54648,16,true);
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
      this.reaper=[];this.bats=[];this.responses=[];this.effects=[];this.echoes=[];
      if(!s.add?.image||!s.textures?.exists)return;
      for(const [name,m]of Object.entries(DATA))this.ready[name]=Boolean(s.textures.exists('combat-'+name)&&
        Array.from({length:m.frames},(_,i)=>s.textures.get('combat-'+name).has(i)).every(Boolean));
      const pair=(depth)=>[0,1].map(()=>s.add.image(0,0,'combat-reaper-slide-cut',0).setDepth(depth).setVisible(false));
      if(this.ready['reaper-slide-cut']){
        this.reaper=pair(12.05);
        for(let i=0;i<12;i++)this.bats.push(pair(9.2));
        for(let i=0;i<16;i++)this.responses.push(pair(9.4));
        for(let i=0;i<20;i++)this.effects.push(pair(14.8));
        for(let i=0;i<4;i++)this.echoes.push(pair(11.8));
      }
      s.events?.once?.('shutdown',()=>this.destroy());
    }
    all(){return [...this.reaper,...this.bats.flat(),...this.responses.flat(),...this.effects.flat(),...this.echoes.flat()];}
    reset(){this.corpses=[];this.sequence=0;this.reaperState=null;for(const v of this.all())v.setVisible(false);}
    snapshot(){return this.corpses.map(v=>({...v}));}
    restore(values=[]){this.corpses=values.map(v=>({...v}));}
    enemyHit(e,defeated){
      if(!RESPONSE[e.kind])return;
      e.visualHitMs=240;
      if(!defeated)return;
      const flying=e.kind==='bat'||e.kind==='skeletalBat';
      const y=flying?e.y:(this.scene.terrain.groundAt(e.x)??this.scene.terrain.anchorAt(e.x));
      this.corpses.push({kind:e.kind,x:e.x,y,age:0,seed:++this.sequence,flying});
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
      const span=frames||Array.from({length:m.frames},(_,i)=>i),f=sample(t,span.length);
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
    renderReaper(){
      const s=this.scene,p=s.player;if(!p||!s.visuals?.reaperReady||!this.reaper.length)return;
      const dead=['dying','dead','revive'].includes(s.state);
      if(dead&&this.ready['reaper-hurt-death']){
        const progress=s.state==='dying'?clamp((s.deathPoseMs||0)/DEATH_MS):1;
        const floor=s.terrain.groundAt(p.x),fall=Number.isFinite(floor)&&floor>s.feetY?clamp(progress*1.5)**2:0;
        const y=s.feetY+(Number.isFinite(floor)?floor-s.feetY:0)*fall;
        this.hideReaper();this.blend(this.reaper,'reaper-hurt-death',progress*7,p.x,y,.45,1,0,[4,5,6,7,8,9,10,11]);
        this.reaperState={name:'death',progress};return;
      }
      if(!['playing','paused','rewinding','countdown'].includes(s.state))return;
      let name,t,scale,frames;
      if((p.visualHurtMs||0)>0){
        if(s.lowProfile){name='reaper-slide-cut';frames=[0];t=0;scale=.385;}
        else {name='reaper-hurt-death';frames=[0,1,2,3];t=(1-p.visualHurtMs/HURT_MS)*3;scale=.45;}
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
        this.blend(this.reaper,name,t,p.x,s.feetY,scale,alpha,0,frames);this.reaperState={name,frame:t};
      }
    }
    renderBats(){
      const s=this.scene;if(!this.bats.length||!this.ready['bat-flight']||!s.visuals?.reviewV2||!s.visuals?.batReady)return;
      if(!['playing','paused','rewinding','countdown','dying'].includes(s.state))return;
      for(const v of s.visuals.batPool)v.setVisible(false);
      let n=0;
      for(const e of s.enemies||[]){
        if(e.kind!=='bat'||e.dead||e.x<s.cameraX-130||e.x>s.cameraX+s.width+130||n>=this.bats.length)continue;
        const pair=this.bats[n++];if(e.visualHitMs>0&&this.ready['bat-response'])continue;
        if(e.mode==='dive'){
          const m=scope.GRIM_VISUALS.V2_BAT.dive,v=pair[0];
          const enter=clamp((e.timer||0)/.12),flight=batMotion(s.elapsed||0,e.phase||0);
          v.setTexture(m.key).setOrigin(m.anchor[0]/2304,m.anchor[1]/1280).setScale(m.scale)
            .setPosition(e.x,e.y).setAlpha(enter).setRotation(.1*enter).setVisible(true);
          if(enter<1)pair[1].setTexture('combat-bat-flight',flight.a).setOrigin(330/512,292/512).setScale(.32)
            .setPosition(e.x,e.y).setAlpha(1-enter).setRotation(0).setVisible(true);
        }else{
          const f=batMotion(s.elapsed||0,e.phase||0);
          this.blend(pair,'bat-flight',f.a+f.mix,e.x,e.y,.32);
          // Close the loop by blending the final drawing into the first.
          if(f.a===15&&f.mix>0){pair[1].setTexture('combat-bat-flight',0).setAlpha(f.mix).setVisible(true);pair[0].setAlpha(1-f.mix);}
          if(e.mode==='recover'&&(e.timer||0)<.12){
            const recovery=clamp((e.timer||0)/.12),m=scope.GRIM_VISUALS.V2_BAT.dive;
            pair[0].setAlpha(recovery);
            pair[1].setTexture(m.key).setOrigin(m.anchor[0]/2304,m.anchor[1]/1280).setScale(m.scale)
              .setPosition(e.x,e.y).setRotation(.1*(1-recovery)).setAlpha(1-recovery).setVisible(true);
          }
        }
      }
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
        const scale={bat:.26,skeletalBat:.30,crawler:.43,imp:.24}[item.kind];
        const alpha=dead?clamp((1-progress)/.24):1;
        const pair=this.responses[n++];this.blend(pair,name,progress*(frames.length-1),item.x,y,scale,alpha,0,frames);
        if(item.kind==='crawler')for(const v of pair)v.setFlipX(true);
      };
      for(const e of s.enemies||[])if(!e.dead&&e.visualHitMs>0&&e.x>=s.cameraX-150&&e.x<=s.cameraX+s.width+150){
        for(const pool of [s.visuals?.skeletalBatPool,s.visuals?.boneCrawlerPool,s.visuals?.emberImpPool])
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
      const base=Object.values(s.visuals?.reaperPoseSprites||{}).find(v=>v.visible);if(!base)return;
      for(let i=0;i<3;i++){
        const v=this.echoes[i]?.[0];if(!v)continue;
        v.setTexture(base.texture.key,base.frame.name).setOrigin(base.originX,base.originY).setScale(base.scaleX,base.scaleY)
          .setPosition(base.x-(i+1)*13,base.y).setRotation(base.rotation).setTint(s.state==='rewinding'?0xc7aaff:0x9bdcff)
          .setAlpha(.12-i*.032).setVisible(true);
      }
    }
    render(){
      for(const v of this.all())v.setVisible(false);this.reaperState=null;
      this.renderBats();this.renderResponses();this.renderReaper();this.renderEffects();this.renderTimeEchoes();
    }
    destroy(){for(const v of this.all())v.destroy();this.corpses=[];}
  }
  scope.GRIM_COMBAT_ART={CombatAnimations,preload,sample,batMotion,muzzle,attackFrame,FIRE_MS,HURT_MS,DEATH_MS,DEFEAT_MS,MAX_DEFEATS};
})(typeof window!=='undefined'?window:globalThis);
