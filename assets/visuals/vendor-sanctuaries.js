/* Grim Run v0.15.2 — world-space merchant sanctuaries and first-encounter cinema. */
(function(scope){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
  const INTRO_MS=3000,HALF_METERS=25,VENDOR_SCALE=1.75;
  function preload(s){
    for(const kind of ['angel','devil']){
      s.load.image('sanctuary-'+kind+'-floor','assets/vendors/v0152/'+kind+'-floor.png?v=0.15.2');
      s.load.spritesheet('sanctuary-'+kind+'-architecture','assets/vendors/v0152/'+kind+'-architecture.png?v=0.15.2',
        {frameWidth:384,frameHeight:768,endFrame:1});
    }
    s.load.spritesheet('vendor-reaper-approach','assets/vendors/v0152/reaper-approach.png?v=0.15.2',
      {frameWidth:512,frameHeight:512,endFrame:11});
    s.load.spritesheet('relic-grip-overlay','assets/vendors/v0152/relic-grip-overlay.png?v=0.15.2',
      {frameWidth:512,frameHeight:512,endFrame:23});
  }
  function approachAt(t){
    const travel=clamp((t-.12)/1.48,0,1);
    // A moving gait gives way to four increasingly settled looking-up poses.
    const frame=t<1.6?Math.floor(clamp((t-.12)/1.48,0,.99999)*16)%8:
      t<2.15?8+Math.min(3,Math.floor((t-1.6)/.55*4)):11;
    return {frame,travel:smooth(travel),presence:smooth((t-1.9)/.5)};
  }
  function drawAura(g,x,y,devil,t,scale=1){
    if(!g)return;
    const pulse=1+Math.sin(t*2.1)*.075,s=scale;
    if(devil){
      g.fillStyle(0x270820,.17);g.fillEllipse(x,y-78*s,192*pulse*s,181*pulse*s);
      g.fillStyle(0x7a1944,.14);g.fillEllipse(x,y-76*s,148*pulse*s,153*pulse*s);
      g.lineStyle(5*s,0xad2947,.28);g.strokeEllipse(x,y-80*s,130*pulse*s,141*pulse*s);
      for(let n=0;n<8;n++){
        const a=n*2.4+t*.68;g.fillStyle(n%2?0xe84f37:0xb73572,.32);
        g.fillCircle(x+Math.sin(a)*66*s,y-(38+n*17%105-Math.sin(a*2)*7)*s,(n%3+2)*pulse*s);
      }
    }else{
      g.fillStyle(0xf7e5ab,.10);g.fillEllipse(x,y-83*s,207*pulse*s,188*pulse*s);
      g.fillStyle(0xb5d9ee,.13);g.fillEllipse(x,y-80*s,166*pulse*s,163*pulse*s);
      g.lineStyle(3*s,0xffe9a8,.31);g.strokeEllipse(x,y-84*s,146*pulse*s,155*pulse*s);
      for(let n=0;n<9;n++){
        const a=n*Math.PI*2/9+t*.11;g.lineStyle((n%2?2:3)*s,0xffeac0,.19);
        g.lineBetween(x+Math.cos(a)*73*s,y-88*s+Math.sin(a)*73*s,
          x+Math.cos(a)*104*pulse*s,y-88*s+Math.sin(a)*101*pulse*s);
      }
    }
  }
  class VendorSanctuaries{
    constructor(scene){
      this.scene=scene;this.views=new Map();this.cinema=[];
      const image=(key,depth,frame)=>{
        if(!scene.textures.exists(key))return null;
        const v=scene.add.image(0,0,key,frame).setDepth(depth).setScrollFactor(0).setVisible(false);this.cinema.push(v);return v;
      };
      this.shade=scene.add.graphics().setScrollFactor(0).setDepth(26);
      this.back=scene.add.graphics().setScrollFactor(0).setDepth(26.1);
      this.floor=image('sanctuary-angel-floor',27);
      this.columns=[image('sanctuary-angel-architecture',26.3,0),image('sanctuary-angel-architecture',26.3,1)];
      this.merchant=image('vendor-angel',28);
      this.approachReady=scene.textures.exists('vendor-reaper-approach');
      this.reaper=image(this.approachReady?'vendor-reaper-approach':'power-reaper',29,this.approachReady?0:12);
      this.light=scene.add.graphics().setScrollFactor(0).setDepth(29.2);
      scene.events.once('shutdown',()=>this.destroy());
    }
    renderWorld(){
      const s=this.scene,active=new Set();
      if(Number.isFinite(s.startX)&&s.state!=='menu')for(let k=1;k<=14;k++){
        const x=s.startX+k*scope.GRIM_CONFIG.vendorEveryMeters*scope.GRIM_CONFIG.pxPerMeter;
        if(Math.abs(x-s.player.x)>s.width*1.5+300)continue;
        const kind=k>=8?'devil':'angel',key='sanctuary-'+kind,y=s.terrain.groundAt(x)??s.terrain.anchorAt(x);
        if(!s.textures.exists(key+'-floor'))continue;
        let view=this.views.get(k);
        if(!view){
          view={floor:s.add.image(x,y,key+'-floor').setOrigin(.5,0).setDepth(2.1),
            columns:[0,1].map(frame=>s.add.image(0,0,key+'-architecture',frame).setOrigin(.5,740/768).setDepth(.53))};
          this.views.set(k,view);
        }
        view.floor.setPosition(x,y-3).setDisplaySize(HALF_METERS*2*scope.GRIM_CONFIG.pxPerMeter,85).setVisible(true);
        view.columns.forEach((v,i)=>v.setPosition(x+(i?220:-220),y+12).setDisplaySize(180,350).setVisible(true));
        active.add(k);
      }
      for(const [k,view] of this.views)if(!active.has(k)){view.floor.destroy();view.columns.forEach(v=>v.destroy());this.views.delete(k);}
    }
    renderCinema(){
      const s=this.scene;this.shade.clear();this.back.clear();this.light.clear();
      this.cinema.forEach(v=>v.setVisible(false));
      if(s.state!=='vendorIntro')return;
      const t=clamp((INTRO_MS-s.vendorIntroMs)/1000,0,3),motion=approachAt(t);
      const w=s.width,h=s.height,devil=s.vendorType==='devil',kind=devil?'devil':'angel';
      const ground=h*.84,vx=w*.66,rx=w*(.12+.24*motion.travel);
      // Small framing motion is shared by every staged element.
      const push=smooth(t/3)*h*.016;
      this.shade.fillStyle(devil?0x120811:0x071321,.88);this.shade.fillRect(0,0,w,h);
      this.shade.fillStyle(0x020710,.7);this.shade.fillRect(0,0,w,h*.11);this.shade.fillRect(0,h*.91,w,h*.09);
      drawAura(this.back,vx,ground,devil,t,h*.72/142*(1+motion.presence*.05));
      this.floor?.setTexture('sanctuary-'+kind+'-floor').setOrigin(.5,0).setPosition(w*.5,ground-3)
        .setDisplaySize(w*.94+push,h*.19).setVisible(true);
      this.columns.forEach((v,i)=>v?.setTexture('sanctuary-'+kind+'-architecture',i).setOrigin(.5,740/768)
        .setPosition(vx+(i?1:-1)*w*.20,ground+9).setDisplaySize(w*.21+push,h*.82+push).setVisible(true));
      const breath=1+Math.sin(t*2.3)*.006;
      this.merchant?.setTexture(devil?'vendor-demon':'vendor-angel').setOrigin(.5,1).setPosition(vx,ground+5)
        .setDisplaySize(h*(devil?.88:.85)*breath+push,h*.72*breath+push).setVisible(true);
      this.reaper?.setFrame(this.approachReady?motion.frame:12)
        .setOrigin(this.approachReady?300/512:288/512,this.approachReady?480/512:400/512).setPosition(rx,ground)
        .setScale(h/(this.approachReady?800:950)).setVisible(true);
      const beat=Math.sin(clamp((t-2)/.9,0,1)*Math.PI)*motion.presence;
      for(let i=0;i<4;i++){
        this.light.fillStyle(devil?0xc54631:0xffe2a1,beat*.035*(4-i));
        this.light.fillEllipse(vx-h*.12,ground-h*.45,h*(.09+i*.045),h*(.11+i*.05));
      }
      // Hide world actors underneath the staged encounter, including equipped wings.
      s.actor?.clear();s.powerArt?.hideBase();
      for(const v of [s.powerArt?.action,s.powerArt?.weapon,s.powerArt?.cloakRoot,
        ...(s.powerArt?.wingSprites||[]),...(s.powerArt?.nearWings||[]),...(s.vendorSpriteObjects?.values()||[])])v?.setVisible(false);
      for(const view of this.views.values()){view.floor.setVisible(false);view.columns.forEach(v=>v.setVisible(false));}
      const title=scope.document?.getElementById('vendor-intro-title'),caption=scope.document?.getElementById('vendor-intro-caption');
      if(title)title.textContent=devil?'THE INFERNAL BARGAIN':'THE HEAVENLY MERCHANT';
      if(caption)caption.textContent=devil?'A PRICE FOR POWER':'A MOMENT OF SANCTUARY';
    }
    destroy(){for(const view of this.views.values()){view.floor.destroy();view.columns.forEach(v=>v.destroy());}
      this.views.clear();[...this.cinema,this.shade,this.back,this.light].forEach(v=>v?.destroy());this.cinema=[];}
  }
  scope.GRIM_VENDOR_ART={preload,VendorSanctuaries,drawAura,approachAt,INTRO_MS,HALF_METERS,VENDOR_SCALE};
})(typeof window!=='undefined'?window:globalThis);
