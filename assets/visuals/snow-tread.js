/* Tundra powder rides on the registered contacts of the solid run atlas. */
(function(scope){
  'use strict';
  const CONTACTS=Object.freeze([[2,-8],[24,-4],[37,-23],[71,-10],
    [96,2],[123,-11],[145,-23],[176,-5]]);
  const SIZE=32, COLORS=[0xe3f3fb,0xb6d6ea,0xeff7ff];
  function snowHash(value,salt){
    let x=Math.imul(value^salt,0x45d9f3b);
    x=Math.imul(x^(x>>>16),0x45d9f3b);
    return ((x^(x>>>16))>>>0)/4294967296;
  }
  function isRunning(p){
    return p.grounded&&p.onSoulPlatform===false&&!p.sliding&&!p.airTuck&&
      !p.attackMs&&!p.visualFireMs&&!p.visualLandingMs&&!p.visualHurtMs;
  }
  class SnowTread{
    constructor(scene){
      this.scene=scene;
      this.flecks=Array.from({length:SIZE},()=>({life:0}));
      this.graphics=scene.add.graphics().setDepth(12.07);
      this.cursor=0;
      scene.events?.once?.('shutdown',()=>this.graphics.destroy());
    }
    clear(){
      this.cursor=0;
      for(const fleck of this.flecks)fleck.life=0;
      this.graphics.clear();
    }
    materialAt(x){
      const s=this.scene;
      const weight=s.snowCoverAt(x);
      if(weight<=0)return 0;
      const section=s.terrain.sectionAt(x);
      if(section?.kind!=='ground')return 0;
      const meter=(x-s.startX)/scope.GRIM_CONFIG.pxPerMeter;
      const vendor=scope.GRIM_CONFIG.vendorEveryMeters;
      if(Math.abs(meter-Math.round(meter/vendor)*vendor)<scope.GRIM_CONFIG.vendorSanctuaryHalfMeters)return 0;
      return weight;
    }
    emit(x,offset,salt,landing=false){
      const s=this.scene, worldX=x+offset;
      const weight=this.materialAt(worldX),y=weight?s.terrain.groundAt(worldX):null;
      if(!Number.isFinite(y))return;
      const key=Math.round(x*16)^salt,count=landing?5:3;
      for(let i=0;i<count;i++){
        const fleck=this.flecks[this.cursor++%SIZE],r=snowHash(key,71+i);
        const life=.115+snowHash(key,181+i)*.105;
        Object.assign(fleck,{x:worldX-2+i*.8,y:y-2-r*2,
          vx:-28-r*(landing?87:64),vy:-22-snowHash(key,97+i)*(landing?83:55),
          radius:1.1+1.6*r,weight,life,maxLife:life,color:COLORS[i%COLORS.length]});
      }
    }
    step(dt,previousX,wasRunning,landed){
      if(dt<=0)return;
      for(const p of this.flecks){
        if(p.life<=0)continue;
        p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=205*dt;
      }
      const s=this.scene,p=s.player,run=scope.GRIM_RUN_DATA;
      if(landed&&p.onSoulPlatform===false){
        this.emit(p.x,0,733,true);return;
      }
      if(!run||!s.motionArt?.runReady||!wasRunning||!isRunning(p)||!s.snowCoverAt(p.x))return;
      const stride=run.distancePerSheet,from=previousX-s.startX,to=p.x-s.startX;
      const lap=Math.floor(from/stride);
      for(const [frame,offset] of CONTACTS){
        let at=(lap+frame/run.frames)*stride;
        if(at<=from)at+=stride;
        if(at<=to)this.emit(s.startX+at,offset,frame);
      }
    }
    draw(){
      const g=this.graphics;g.clear();
      for(const p of this.flecks){
        if(p.life<=0)continue;
        g.fillStyle(p.color,p.weight*.86*Math.min(1,p.life/p.maxLife*1.6));
        g.fillEllipse(p.x,p.y,p.radius*2,p.radius*1.35);
      }
    }
  }
  scope.GRIM_SNOW_TREAD={SnowTread,isRunning};
})(typeof window!=='undefined'?window:globalThis);
