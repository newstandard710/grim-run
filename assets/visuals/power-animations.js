/* Grim Run v0.15.0 — illustrated actions, articulated wings and restrained power FX.
 * This layer never advances physics, changes hitboxes or consumes gameplay RNG.
 * Timers live on the player so the existing rewind snapshots register poses too.
 */
(function(scope){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const ORDER=['soulCleave','ravenWings','deathsDelay','brittleBones','deathsReversal',
    'skeletalWings','infernalBoots','rapidFire','powerShot','chainShot','vitalEssence','soulMend'];
  const COLORS=[0xa5fbef,0xc5b5ff,0x9bdcff,0xe7efff,0xc7aaff,0xffb08e,
    0xffb65f,0xb2ecff,0xffca84,0xd9c0ff,0xffc2c9,0xe0c9ff];
  const SHEETS=[['power-reaper','reaper-actions.png',512,512,15],
    ['power-wings','wings.png',512,384,12],['power-effects','power-effects.png',256,256,12]];
  const SHRINE_METERS=4900,SHRINE_MS=6000,MAX_BURSTS=20;
  function preload(scene){
    if(!scene.load?.spritesheet)return;
    for(const [key,file,w,h,count] of SHEETS)
      scene.load.spritesheet(key,'assets/powers/'+file+'?v=0.15.0',
        {frameWidth:w,frameHeight:h,endFrame:count-1});
    for(const name of ['summit-shrine','summit-shrine-open','bone-crossbow'])
      scene.load.image('power-'+name,'assets/powers/'+name+'.png?v=0.15.0');
  }
  function actionFrame(s){
    const p=s.player;
    if(!p||['dead','revive','won','menu'].includes(s.state)||p.grounded||p.onSoulPlatform!==false)return null;
    const tucked=p.airTuck||p.holdSlide;
    if(p.attackMs>0){
      const progress=clamp(1-p.attackMs/scope.GRIM_CONFIG.attackDurationMs,0,.99999);
      return (tucked?8:4)+Math.floor(progress*4);
    }
    if(tucked){
      const age=p.visualTuckMs||0;
      return age<75?0:age<140?1:1+Math.floor(age/125)%2;
    }
    if(p.visualTuckReleaseMs>0)return 3;
    return null;
  }
  class PowerAnimations{
    constructor(scene){
      this.scene=scene;this.bursts=[];this.sequence=0;this.pool=[];this.wingSprites=[];
      this.ready={};this.disposed=false;
      if(!scene.add?.image||!scene.textures?.exists)return;
      for(const [key,,, ,count] of SHEETS){
        const texture=scene.textures.exists(key)&&scene.textures.get(key);
        this.ready[key]=Boolean(texture&&Array.from({length:count},(_,i)=>i).every(i=>texture.has(i)));
      }
      const image=(key,depth,frame)=>scene.textures.exists(key)?
        scene.add.image(0,0,key,frame).setDepth(depth).setVisible(false):null;
      if(this.ready['power-reaper'])this.action=image('power-reaper',12,0)?.setOrigin(288/512,400/512).setScale(.375);
      if(this.ready['power-wings']){
        for(let i=0;i<2;i++)this.wingSprites.push(image('power-wings',11.5,0)?.setOrigin(.5,260/384));
      }
      if(this.ready['power-effects']){
        for(let i=0;i<MAX_BURSTS;i++)this.pool.push(image('power-effects',14.7,0));
      }
      this.fx=scene.add.graphics().setDepth(14.6);
      this.shrine=image('power-summit-shrine',8);
      this.cinema=scene.add.graphics().setScrollFactor(0).setDepth(22);
      this.cinemaShrine=image('power-summit-shrine',23)?.setScrollFactor(0);
      this.cinemaShrineOpen=image('power-summit-shrine-open',23.1)?.setScrollFactor(0);
      if(this.cinemaShrineOpen){
        // Use only the edited chest region. The authoritative closed shrine
        // supplies the architecture and clean outer alpha in both states.
        const source=scene.textures.get('power-summit-shrine-open').getSourceImage();
        this.cinemaShrineOpen.setCrop(source.width*.36,source.height*.48,source.width*.28,source.height*.37);
      }
      this.cinemaReaper=image('power-reaper',24,12)?.setScrollFactor(0).setOrigin(288/512,400/512);
      this.cinemaBow=image('power-bone-crossbow',25)?.setScrollFactor(0);
      this.cinemaFX=scene.add.graphics().setScrollFactor(0).setDepth(25.5);
      this.weapon=image('power-bone-crossbow',14.3);
      this.enabled=true;
      scene.events?.once?.('shutdown',()=>this.destroy());
    }
    get wingsReady(){return Boolean(this.ready['power-wings']);}
    level(id){return this.scene.powerManager?.level(id)||0;}
    reset(){
      this.bursts=[];this.sequence=0;
      for(const sprite of this.pool)sprite?.setVisible(false);
      this.fx?.clear();
    }
    trigger(id,x,y,kind='use',level){
      if(!this.enabled||this.scene.state==='rewinding')return;
      const index=ORDER.indexOf(id);if(index<0)return;
      const p=this.scene.player;
      const item={id,index,x:x??p.x,y:y??(p.y-55),age:0,
        level:level??this.level(id),kind,seed:++this.sequence,
        duration:kind==='purchase'?780:kind==='blast'?600:id==='brittleBones'?780:420};
      if(this.bursts.length>=MAX_BURSTS)this.bursts.shift();
      this.bursts.push(item);
    }
    purchase(id,level){
      this.trigger(id,undefined,undefined,'purchase',level);
      if(['vitalEssence','soulMend'].includes(id)){
        const stats=scope.document?.getElementById?.('vendor-stats');
        if(stats){stats.classList.remove('healing');void stats.offsetWidth;stats.classList.add('healing');}
      }
    }
    tick(ms){
      const s=this.scene,p=s.player;if(!p)return;
      const tuck=!p.grounded&&(p.airTuck||p.holdSlide);
      if(tuck){p.visualTuckMs=(p.visualTuckMs||0)+ms;p.visualTuckReleaseMs=0;}
      else{
        if(p.visualTuckMs>0&&!p.grounded)p.visualTuckReleaseMs=85;
        p.visualTuckMs=0;p.visualTuckReleaseMs=Math.max(0,(p.visualTuckReleaseMs||0)-ms);
      }
      if(p.grounded&&p.visualWasAirborne)p.visualLandingMs=115;
      else p.visualLandingMs=Math.max(0,(p.visualLandingMs||0)-ms);
      p.visualWasAirborne=!p.grounded;
      for(const b of this.bursts)b.age+=ms;
      this.bursts=this.bursts.filter(b=>b.age<b.duration);
    }
    hideBase(){
      const v=this.scene.visuals;
      for(const sprite of Object.values(v?.reaperPoseSprites||{}))sprite.setVisible(false);
      v?.reaper?.setVisible(false);
      this.scene.actor?.clear();
    }
    renderAction(){
      const s=this.scene,p=s.player,frame=actionFrame(s);
      this.action?.setVisible(false);
      if(frame!==null&&this.action&&s.visuals?.reaperReady){
        this.hideBase();
        this.action.setFrame(frame).setPosition(p.x,s.feetY).setVisible(true)
          .setAlpha(p.invulMs>0&&Math.floor(s.frame/5)%2===0?.58:1)
          .setTint(p.slowMs>0?0xb9ecff:0xffffff);
        // Keep the attack trail even when the normal procedural actor is suppressed.
        if(p.attackMs>0&&scope.GRIM_CORE.attackActive(p.attackMs,260,.20,.79)){
          const t=1-p.attackMs/260,cy=s.feetY-(s.lowProfile?30:65);
          this.fx.lineStyle(2,0xa5fbef,.58).beginPath();
          this.fx.arc(p.x+15,cy,94*(1+s.powerManager.attackBonus()),3.8+t*2.4,4.5+t*2.4).strokePath();
        }
      }else if(p.visualLandingMs>0&&p.grounded&&!p.sliding){
        // A small visual weight shift; collision and ground contact stay fixed.
        const sprite=Object.values(s.visuals?.reaperPoseSprites||{}).find(v=>v.visible);
        if(sprite)sprite.y+=Math.sin(p.visualLandingMs/115*Math.PI)*2;
      }
      if(this.weapon){
        // The accepted firing drawing already contains its crossbow. Add the
        // separate weapon only when a compact action pose is replacing it.
        const visible=s.gunUnlocked&&p.visualFireMs>0&&this.action?.visible&&p.attackMs<=0&&
          ['playing','paused','rewinding'].includes(s.state)&&!p.sliding;
        this.weapon.setVisible(visible);
        if(visible){
          const recoil=3*Math.sin(clamp(p.visualFireMs/180,0,1)*Math.PI);
          this.weapon.setPosition(p.x+22-recoil,s.feetY-(s.lowProfile?30:61))
            .setDisplaySize(49,49).setRotation(-.05-recoil*.01);
        }
      }
      if(p.visualFireMs>0&&!this.action?.visible){
        const sprite=Object.values(s.visuals?.reaperPoseSprites||{}).find(v=>v.visible);
        if(sprite)sprite.x-=2*Math.sin(clamp(p.visualFireMs/180,0,1)*Math.PI);
      }
    }
    renderWings(){
      const s=this.scene,p=s.player,air=!p.grounded&&['playing','paused','rewinding','countdown'].includes(s.state);
      for(const sprite of this.wingSprites)sprite?.setVisible(false);
      if(!air||!this.wingsReady)return;
      const raven=this.level('ravenWings'),bone=this.level('skeletalWings');
      const phase=Math.floor(s.elapsed*(p.hovering?8:7))%4;
      const tucked=Boolean(p.airTuck||p.holdSlide),rootY=s.feetY-(tucked?41:70);
      let used=0;
      if(raven){
        const jumpStroke=p.airJumpUsed&&p.jumpAgeMs<280?Math.min(3,Math.floor(p.jumpAgeMs/70)):phase;
        this.wingSprites[used++]?.setFrame(jumpStroke).setPosition(p.x-12,rootY-3)
          .setScale(tucked?.25:.34).setRotation(tucked?-.12:0).setAlpha(.95).setVisible(true);
      }
      if(bone){
        const row=raven?8:4;
        this.wingSprites[used++]?.setFrame(row+phase).setPosition(p.x-12,rootY+(raven?14:0))
          .setScale(tucked?.24:.34).setRotation(tucked?.1:0)
          .setAlpha(p.hovering?1:.8).setVisible(true);
        const ratio=clamp(p.hoverBudgetMs/Math.max(1,s.powerManager.skeletalHoverMs()),0,1);
        this.fx.fillStyle(0x0d1424,.78);this.fx.fillRoundedRect(p.x-32,rootY-83,64,7,3);
        if(ratio>0){this.fx.fillStyle(0xd5e2e0,.93);this.fx.fillRoundedRect(p.x-30,rootY-81,60*ratio,3,1.5);}
      }
    }
    motes(x,y,id,count,spread,phase,alpha){
      const g=this.fx,index=ORDER.indexOf(id);if(index<0)return;
      g.fillStyle(COLORS[index],alpha);
      for(let i=0;i<count;i++){
        const a=i*2.399963+phase*.7,r=(.3+.7*((i*.618+phase*.15)%1))*spread;
        const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r*.7;
        if(id==='brittleBones')g.fillTriangle(px-2,py+2,px+3,py,px,py-3);
        else if(id==='ravenWings')g.fillEllipse(px,py,2,5);
        else g.fillCircle(px,py,1+(i%2)*.45);
      }
    }
    renderEffects(){
      const s=this.scene,p=s.player,g=this.fx;
      for(const sprite of this.pool)sprite?.setVisible(false);
      if(!['playing','paused','rewinding','countdown','upgrade'].includes(s.state))return;
      let used=0;
      if(s.state!=='rewinding')for(const b of this.bursts){
        const t=b.age/b.duration,a=Math.sin(Math.PI*t)*.7;
        const purchase=b.kind==='purchase',blast=b.kind==='blast';
        const x=purchase?p.x:b.x,y=purchase?s.feetY-60-t*20:b.y;
        const size=purchase?42:blast?115:b.id==='brittleBones'?82:30;
        const sprite=this.pool[used++];
        if(sprite)sprite.setFrame(b.index).setPosition(x,y).setDisplaySize(size*(.75+t*.5),size*(.75+t*.5))
          .setRotation((b.id==='deathsReversal'?-1:1)*t*.6).setAlpha(a).setVisible(true);
        this.motes(x,y,b.id,Math.min(10,3+b.level+(purchase?2:0)),(purchase?45:24)+t*23,b.seed+t*3,a);
        if(blast){g.lineStyle(2,COLORS[b.index],(1-t)*.28);g.strokeEllipse(x,y,70+t*270,35+t*130);}
      }
      // Upgraded abilities add action-local accents; never ten simultaneous auras.
      const t=s.elapsed;
      if(p.attackMs>0&&this.level('soulCleave')>=2)this.motes(p.x+40,s.feetY-(s.lowProfile?30:70),'soulCleave',this.level('soulCleave')+1,25,t,.55);
      if(!p.grounded&&this.level('ravenWings')>=2&&p.airJumpUsed)this.motes(p.x-30,s.feetY-70,'ravenWings',this.level('ravenWings'),24,t,.35);
      if(p.hovering&&this.level('skeletalWings')>=2)this.motes(p.x-15,s.feetY-66,'skeletalWings',this.level('skeletalWings'),36,t,.4);
      if(p.slowMs>0){
        for(let i=0;i<3;i++){g.lineStyle(1,0x9bdcff,.12-i*.025);g.strokeEllipse(p.x-i*15,s.feetY-27,35+i*6,22);}
        if(this.level('deathsDelay')>=2)this.motes(p.x-30,s.feetY-28,'deathsDelay',this.level('deathsDelay'),30,t,.38);
      }
      if(this.level('infernalBoots')>0&&p.grounded){
        this.motes(p.x-12,s.feetY-5,'infernalBoots',this.level('infernalBoots')>=2?4:2,13,t,
          p.fireproofCooldownMs<=0?.45:.13);
      }
      if(s.state==='rewinding'){
        // Pure functions of the restored clock: no particles from the future.
        for(let i=0;i<3;i++){g.lineStyle(1,0xc7aaff,.2-i*.04);g.strokeEllipse(p.x-20-i*13,s.feetY-54,35+i*13,70);}
        this.motes(p.x,s.feetY-55,'deathsReversal',3+Math.max(1,s.rewindLevel()),42,-t,.4);
      }
      if(this.level('powerShot')>0)for(const b of s.bullets||[]){
        g.lineStyle(2,0xffca84,.48);g.lineBetween(b.x,b.y,b.x-19,b.y);
        if(this.level('powerShot')>=2){g.fillStyle(0xffe0a6,.3);g.fillCircle(b.x,b.y,6);}
      }
      // Jagged, short-lived arcs preserve every actual chain target.
      for(const a of s.chainArcs||[]){
        g.lineStyle(1,0xf0dcff,clamp(a.lifeMs/250,0,1)*.8);g.beginPath();g.moveTo(a.x1,a.y1);
        for(let i=1;i<6;i++){const f=i/6;g.lineTo(a.x1+(a.x2-a.x1)*f,a.y1+(a.y2-a.y1)*f+Math.sin(i*13.7+t*11)*5);}
        g.lineTo(a.x2,a.y2);g.strokePath();
      }
    }
    renderShrine(){
      const s=this.scene,p=s.player;
      if(this.shrine){
        const x=s.startX+SHRINE_METERS*scope.GRIM_CONFIG.pxPerMeter;
        const visible=Boolean(s.startX)&&Math.abs(p.x-x)<s.width+300&&!s.hasTeleported&&s.state!=='chest'&&s.state!=='menu';
        this.shrine.setVisible(visible);
        if(visible)this.shrine.setPosition(x,s.terrain.groundAt(x)+12).setOrigin(.5,1).setDisplaySize(315,210);
      }
      const active=s.state==='chest';
      this.cinema?.clear();this.cinemaFX?.clear();
      for(const sprite of [this.cinemaShrine,this.cinemaShrineOpen,this.cinemaReaper,this.cinemaBow])sprite?.setVisible(false);
      if(!active)return;
      const w=s.width,h=s.height,t=clamp((SHRINE_MS-s.chestMs)/1000,0,6),reveal=clamp((t-1.5)/1.5,0,1);
      this.cinema.fillStyle(0x030914,.76);this.cinema.fillRect(0,0,w,h);
      this.cinema.fillStyle(0x03101c,.65);this.cinema.fillRect(0,0,w,h*.115);this.cinema.fillRect(0,h*.88,w,h*.12);
      const shrineX=w*.57,ground=h*.82;
      if(this.cinemaShrine){
        const open=this.cinemaShrineOpen?clamp((t-1.5)/.35,0,1):0;
        this.cinemaShrine.setOrigin(.5,1).setPosition(shrineX,ground+13)
          .setDisplaySize(h*.90,h*.60).setAlpha(1).setVisible(true);
        this.cinemaShrineOpen?.setOrigin(.5,1).setPosition(shrineX,ground+13)
          .setDisplaySize(h*.90,h*.60).setAlpha(open).setVisible(open>0);
      }
      if(this.cinemaReaper&&this.ready['power-reaper']){
        const frame=t<1.9?12:t<4.9?13:14;
        this.cinemaReaper.setFrame(frame).setPosition(w*.37,ground).setScale(h/950).setVisible(true);
        this.hideBase();this.action?.setVisible(false);this.weapon?.setVisible(false);
        for(const sprite of this.wingSprites)sprite?.setVisible(false);
      }
      const bx=shrineX-(shrineX-w*.38)*clamp((t-2.7)/.8,0,1);
      const by=ground-h*.18-reveal*h*.27;
      if(this.cinemaBow&&t>1.5){
        const lower=clamp((t-5.0)/.8,0,1);
        this.cinemaBow.setPosition(bx,by+lower*h*.17).setDisplaySize(h*.24,h*.24)
          .setRotation(Math.sin(t*1.4)*.04).setAlpha(reveal).setVisible(true);
      }
      const g=this.cinemaFX;
      if(reveal>0){
        for(let i=0;i<7;i++){
          const a=i*Math.PI*2/7+t*.15,r=h*(.12+.03*Math.sin(t*2));
          g.lineStyle(2,0xbaf8e5,.14*reveal);g.lineBetween(bx+Math.cos(a)*r*.35,by+Math.sin(a)*r*.35,bx+Math.cos(a)*r,by+Math.sin(a)*r);
        }
        for(let i=0;i<16;i++){
          const phase=(t*.22+i*.618)%1,a=i*2.399;
          g.fillStyle(i%3?0xc0fff0:0xffdba5,.35*reveal*(1-phase));
          g.fillCircle(bx+Math.cos(a)*(18+phase*60),by+Math.sin(a)*25-phase*25,1.5);
        }
      }
      const title=scope.document?.getElementById?.('relic-title'),button=scope.document?.getElementById?.('chest-continue-btn');
      if(title)title.textContent=t<3.1?'THE SUMMIT RELIQUARY':'BONE CROSSBOW ACQUIRED';
      if(button)button.textContent=t<3.1?'SKIP ▶':'CONTINUE ▶';
    }
    render(){
      if(!this.enabled||this.disposed)return;
      this.fx.clear();this.renderAction();this.renderWings();this.renderEffects();this.renderShrine();
    }
    destroy(){
      if(this.disposed)return;this.disposed=true;
      for(const sprite of [this.action,this.weapon,this.shrine,this.cinemaShrine,this.cinemaShrineOpen,this.cinemaReaper,this.cinemaBow,
        this.fx,this.cinema,this.cinemaFX,...this.wingSprites,...this.pool])sprite?.destroy();
      this.bursts=[];this.pool=[];this.wingSprites=[];
    }
  }
  scope.GRIM_POWER_ART={preload,PowerAnimations,actionFrame,ORDER,COLORS,SHRINE_METERS,SHRINE_MS,MAX_BURSTS,SHEETS};
})(typeof window!=='undefined'?window:globalThis);
