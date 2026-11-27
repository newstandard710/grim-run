/* Grim Run v0.15.2 — world-space merchant sanctuaries and first-encounter cinema. */
(function(scope){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
  const HALF_METERS=25,VENDOR_SCALE=1.75;
  const CANVAS_CELLS=scope.GRIM_CUTSCENES.MERCHANT_CELLS,CANVAS_WIDTH=272,CANVAS_HEIGHT=224;
  const CANVAS_URL='assets/cutscenes/v0197/vendor-canvas.webp?v=vendor-greetings1';
  const textureFor=kind=>kind==='devil'?'vendor-demon':'vendor-angel';
  const cinematicElapsed=s=>Math.max(0,(scope.GRIM_CONFIG.vendorIntroDurationMs-s.vendorIntroMs)/1000);
  function preload(s){
    for(const kind of ['angel','devil']){
      s.load.image('sanctuary-'+kind+'-floor','assets/vendors/v0152/'+kind+'-floor.png?v=0.15.2');
      s.load.spritesheet('sanctuary-'+kind+'-architecture','assets/vendors/v0152/'+kind+'-architecture.png?v=0.15.2',
        {frameWidth:384,frameHeight:768,endFrame:1});
    }
    if(s.sys?.game?.renderer?.type===scope.Phaser?.CANVAS)s.load.spritesheet('vendor-canvas',CANVAS_URL,
      {frameWidth:CANVAS_WIDTH,frameHeight:CANVAS_HEIGHT,endFrame:CANVAS_CELLS*2-1});
    s.load.spritesheet('vendor-reaper-approach','assets/vendors/v0152/reaper-approach.png?v=0.15.2',
      {frameWidth:512,frameHeight:512,endFrame:11});
    s.load.spritesheet('relic-grip-overlay','assets/vendors/v0152/relic-grip-overlay.png?v=0.15.2',
      {frameWidth:128,frameHeight:96,endFrame:23});
  }
  function approachAt(t,devil=false){return scope.GRIM_CUTSCENES.approachAt(t,devil);}
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
      this.image=(key,depth,frame)=>{
        if(!scene.textures.exists(key))return null;
        const v=scene.add.image(0,0,key,frame).setDepth(depth).setScrollFactor(0).setVisible(false);this.cinema.push(v);return v;
      };
      this.shade=scene.add.graphics().setScrollFactor(0).setDepth(26);
      this.back=scene.add.graphics().setScrollFactor(0).setDepth(26.1);
      const initialMerchant=['angel','devil'].map(textureFor).find(key=>scene.textures.exists(key));
      const floor=['angel','devil'].map(kind=>'sanctuary-'+kind+'-floor')
        .find(key=>scene.textures.exists(key));
      this.floor=floor?this.image(floor,27):null;
      const architecture=['angel','devil'].map(kind=>'sanctuary-'+kind+'-architecture')
        .find(key=>scene.textures.exists(key));
      this.columns=architecture?[this.image(architecture,26.3,0),this.image(architecture,26.3,1)]:[];
      this.merchant=initialMerchant?this.image(initialMerchant,28):null;
      this.merchantMesh=initialMerchant?scope.GRIM_CUTSCENES?.createMerchantMesh(scene,initialMerchant,28):null;
      this.canvasMerchant=this.image('vendor-canvas',28,0);
      this.motionPreference=scope.matchMedia?.('(prefers-reduced-motion: reduce)');
      this.introPresentation=null;
      this.approachReady=scene.textures.exists('cutscene-vendor')&&
        ['angel','devil'].every(kind=>Number.isFinite(scope.GRIM_CUTSCENE_DATA?.vendor?.[kind]?.[0]?.travel));
      this.reaper=this.image(this.approachReady?'cutscene-vendor':'vendor-reaper-approach',29,0);
      this.light=scene.add.graphics().setScrollFactor(0).setDepth(29.2);
      scene.events.once('shutdown',()=>this.destroy());
    }
    renderWorld(){
      const s=this.scene,active=new Set();
      if(Number.isFinite(s.startX)&&s.state!=='menu')for(let k=1;k<=(s.vendorCount??14);k++){
        const x=s.startX+k*scope.GRIM_CONFIG.vendorEveryMeters*scope.GRIM_CONFIG.pxPerMeter;
        if(Math.abs(x-s.player.x)>s.width*1.5+300)continue;
        const kind=k>=8?'devil':'angel',key='sanctuary-'+kind,y=s.terrain.groundAt(x)??s.terrain.anchorAt(x);
        if(!s.textures.exists(key+'-floor'))continue;
        let view=this.views.get(k);
        if(!view){
          view={floor:s.add.image(x,y,key+'-floor').setOrigin(.5,0).setDepth(2.1),
            columns:s.textures.exists(key+'-architecture')?[0,1].map(frame=>s.add.image(0,0,key+'-architecture',frame)
              .setOrigin(.5,740/768).setDepth(.53)):[]};
          this.views.set(k,view);
        }
        view.floor.setPosition(x,y-3).setDisplaySize(HALF_METERS*2*scope.GRIM_CONFIG.pxPerMeter,85).setVisible(true);
        view.columns.forEach((v,i)=>v.setPosition(x+(i?220:-220),y+12).setDisplaySize(180,350).setVisible(true));
        active.add(k);
      }
      for(const [k,view] of this.views)if(!active.has(k)){view.floor.destroy();view.columns.forEach(v=>v.destroy());this.views.delete(k);}
    }
    holdingFrame(){
      const s=this.scene,p=this.introPresentation;
      return s.state==='vendorIntro'&&p?.holdWidth===s.width&&p.holdHeight===s.height;
    }
    beginPresentation(kind){
      const s=this.scene,key=textureFor(kind),A=scope.GRIM_CUTSCENES;
      const base=s.textures.exists(key);
      const source=s.textures.exists('vendor-canvas')?s.textures.get('vendor-canvas'):null;
      const offset=kind==='devil'?CANVAS_CELLS:0;
      const canvas=source&&Array.from({length:CANVAS_CELLS},(_,i)=>i+offset).every(i=>source.has(i));
      if(canvas&&!this.canvasMerchant)this.canvasMerchant=this.image('vendor-canvas',28,0);
      if(base&&!this.merchant)this.merchant=this.image(key,28);
      if(base&&!this.merchantMesh)this.merchantMesh=A.createMerchantMesh(s,key,28);
      return {reduced:Boolean(this.motionPreference?.matches),approach:this.approachReady,
        canvas:canvas?this.canvasMerchant:null,mesh:base?this.merchantMesh:null,
        still:base?this.merchant:null,key,
        floor:s.textures.exists('sanctuary-'+kind+'-floor')?this.floor:null,
        columns:s.textures.exists('sanctuary-'+kind+'-architecture')?this.columns:[]};
    }
    renderCinema(){
      const s=this.scene;this.shade.clear();this.back.clear();this.light.clear();
      this.cinema.forEach(v=>v.setVisible(false));
      this.merchantMesh?.setVisible(false);
      if(s.state!=='vendorIntro'){this.introPresentation=null;return;}
      const A=scope.GRIM_CUTSCENES;
      const devil=s.vendorType==='devil',kind=devil?'devil':'angel';
      this.introPresentation??=this.beginPresentation(kind);
      const p=this.introPresentation;
      const t=A.vendorVisualTime(cinematicElapsed(s),p.reduced),motion=approachAt(t,devil);
      if(t===A.VENDOR_ANIMATION_SECONDS){p.holdWidth=s.width;p.holdHeight=s.height;}
      const w=s.width,h=s.height;
      const stage=Math.min(h,w*.70),ground=stage===h?h*.84:h*.52+stage*.32;
      const vx=w*.66,rx=w*.36-scope.GRIM_CUTSCENES.vendorTravel(stage)*(1-motion.travel);
      const leftClearance=Math.min(w*.14,stage*(devil?.24:.28));
      this.shade.fillStyle(devil?0x120811:0x071321,.88);this.shade.fillRect(0,0,w,h);
      this.shade.fillStyle(0x020710,.7);this.shade.fillRect(0,0,w,h*.11);this.shade.fillRect(0,h*.91,w,h*.09);
      drawAura(this.back,vx,ground,devil,A.vendorAmbientTime(t),stage*.72/142*(1+motion.presence*.05));
      p.floor?.setTexture('sanctuary-'+kind+'-floor').setOrigin(.5,0).setPosition(w*.5,ground-3)
        .setDisplaySize(w*.94,stage*.19).setVisible(true);
      p.columns.forEach((v,i)=>v.setTexture('sanctuary-'+kind+'-architecture',i).setOrigin(.5,740/768)
        .setPosition(vx+(i?w*.20:-w*.20-leftClearance),ground+9).setDisplaySize(w*.21,stage*.82).setVisible(true));
      const width=stage*(devil?.88:.85);
      if(p.canvas){
        const cell=A.merchantCellAt(t);
        p.canvas.setFrame(cell+(devil?CANVAS_CELLS:0)).setOrigin(.5,216/CANVAS_HEIGHT)
          .setPosition(vx,ground+5).setDisplaySize(width*CANVAS_WIDTH/256,stage*.72*CANVAS_HEIGHT/208).setVisible(true);
      }else if(!A.placeMerchant(p.mesh,s,p.key,vx,ground+5,width,stage*.72,t,devil)){
        p.still?.setTexture(p.key).setOrigin(.5,1).setPosition(vx,ground+5)
          .setDisplaySize(width,stage*.72).setVisible(true);
      }
      const layout=scope.GRIM_CUTSCENE_DATA?.vendor;
      this.reaper?.setFrame(p.approach?motion.frame:Math.min(11,Math.floor(t*4)))
        .setOrigin(p.approach?layout.anchor[0]/layout.cell[0]:300/512,p.approach?layout.anchor[1]/layout.cell[1]:480/512).setPosition(rx,ground)
        .setScale(stage/(p.approach?420:800)).setVisible(true);
      // The single painted frame includes the supported settle and hood turn.
      this.reaper?.setRotation(0);
      const beat=Math.sin(clamp((t-2)/.9,0,1)*Math.PI)*motion.presence;
      for(let i=0;i<4;i++){
        this.light.fillStyle(devil?0xc54631:0xffe2a1,beat*.035*(4-i));
        this.light.fillEllipse(vx-stage*.12,ground-stage*.45,stage*(.09+i*.045),stage*(.11+i*.05));
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
      this.views.clear();[...this.cinema,this.merchantMesh,this.shade,this.back,this.light].forEach(v=>v?.destroy());this.cinema=[];}
  }
  scope.GRIM_VENDOR_ART={preload,VendorSanctuaries,drawAura,approachAt,HALF_METERS,VENDOR_SCALE};
})(typeof window!=='undefined'?window:globalThis);
