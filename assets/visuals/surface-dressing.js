/* Small world-anchored marks on the ridge, with a separate boot-height silhouette. */
(function(scope){
  'use strict';
  const KEY='surface-dressing', WIDTH=128, HEIGHT=64, CELL=113, LIMIT=48;
  const BIOMES=['forest','foothills','tundra','caves','crystals','ashlands','lava','boss'];
  const DENSITY=[.90,.77,.67,.70,.66,.74,.65,.44];
  const EMPTY=[];
  function sample(cell,salt){
    let h=Math.imul(cell^salt,0x45d9f3b);
    h=Math.imul(h^(h>>>16),0x45d9f3b);
    return ((h^(h>>>16))>>>0)/4294967296;
  }
  function bend(t){
    return t>=0&&t<1?Math.sin(Math.PI*Math.pow(t,.64))*(1-t):0;
  }
  function preload(scene){
    scene.load.spritesheet(KEY,'assets/visuals/surface-dressing.png?v=1',
      {frameWidth:WIDTH,frameHeight:HEIGHT});
  }
  class SurfaceDressing {
    constructor(scene){
      this.scene=scene;
      this.layouts=new WeakMap();
      this.slots=[];
      this.epoch=0;
      this.reduced=scope.matchMedia?.('(prefers-reduced-motion: reduce)');
      scene.events.once('shutdown',()=>{
        for(const slot of this.slots){slot.rear.destroy();slot.front.destroy();}
        this.slots.length=0;
      });
    }
    patches(section){
      if(section.kind!=='ground')return EMPTY;
      let patches=this.layouts.get(section);
      if(patches)return patches;
      const s=this.scene,c=scope.GRIM_CONFIG;
      patches=[];
      // Leave room for the complete painted footprint at section ends and gap banks.
      for(let cell=Math.floor(section.start/CELL);cell<=Math.floor(section.end/CELL);cell++){
        const x=(cell+.18+.64*sample(cell,47))*CELL;
        if(x<section.start+40||x>section.end-40)continue;
        const m=(x-s.startX)/c.pxPerMeter;
        const vendor=Math.round(m/c.vendorEveryMeters);
        if(vendor>=1&&vendor<=14&&Math.abs(m-vendor*c.vendorEveryMeters)<c.vendorSanctuaryHalfMeters+4)continue;
        if(m>=4880&&m<=5030)continue;
        const weights=s.terrainBiomeWeights(m);
        let choice=sample(cell,887),id;
        for(const name of BIOMES){
          choice-=weights[name]||0;
          if(choice<0){id=name;break;}
        }
        const row=BIOMES.indexOf(id);
        if(row<0||sample(cell,193)>=DENSITY[row])continue;
        let variant=Math.floor(sample(cell,361)*4);
        if(id==='foothills'&&sample(cell,61)<Math.min(.83,Math.max(0,(m-1050)/1450)))variant=3;
        // Frozen stalks only occur at the lower snow line.
        if(id==='tundra'&&m>2570&&variant===0)variant=2;
        const size=.80+.33*sample(cell,563);
        patches.push({x,frontX:x+7+8*sample(cell,711),id,variant,size,
          frame:row*12+variant*3,frontVisible:sample(cell,109)<.68});
      }
      this.layouts.set(section,patches);
      return patches;
    }
    paintBed(ctx,section,from,surfaceY){
      const sheet=this.scene.textures.get(KEY).getSourceImage();
      for(const patch of this.patches(section)){
        const x=patch.x-from;
        const angle=Math.atan2(surfaceY(x+8)-surfaceY(x-8),16);
        ctx.save();
        ctx.translate(x,surfaceY(x)+7);
        ctx.rotate(angle);
        ctx.scale(patch.size,patch.size);
        ctx.globalAlpha=.76;
        ctx.drawImage(sheet,(patch.frame%12)*WIDTH,Math.floor(patch.frame/12)*HEIGHT,
          WIDTH,HEIGHT,-32,-14,64,32);
        ctx.restore();
      }
    }
    clear(){
      this.epoch++;
      for(const slot of this.slots){
        slot.patch=null;
        slot.rear.setVisible(false);slot.front.setVisible(false);
      }
    }
    step(previousX,wasRunning){
      const s=this.scene,p=s.player,run=scope.GRIM_RUN_DATA;
      if(this.reduced?.matches||!wasRunning||!scope.GRIM_SNOW_TREAD.isRunning(p)||p.x<=previousX)return;
      // Compare the registered sole position with the loose material at the instant of plant.
      let sole=null;
      if(run?.contacts&&s.motionArt?.runReady){
        const stride=run.distancePerSheet,lap=Math.floor((previousX-s.startX)/stride);
        for(const [frame,offset] of run.contacts){
          let at=s.startX+(lap+frame/run.frames)*stride;
          if(at<=previousX)at+=stride;
          if(at<=p.x){sole=at+offset;break;}
        }
      }
      for(const slot of this.slots){
        const patch=slot.patch;
        if(!patch)continue;
        const grass=patch.id==='forest'||(patch.id==='foothills'&&patch.variant!==3);
        if(grass&&previousX+8<patch.x&&p.x+8>=patch.x)patch.rearHit=s.elapsed;
        if(!patch.frontVisible)continue;
        if(patch.id==='forest'&&patch.variant%2===0){
          if(previousX+8<patch.frontX&&p.x+8>=patch.frontX)patch.frontHit=s.elapsed;
        }else if((patch.id==='forest'||patch.id==='ashlands')&&sole!==null&&
          Math.abs(sole-patch.frontX)<13*patch.size)patch.frontHit=s.elapsed;
      }
    }
    slotAt(index){
      if(this.slots[index])return this.slots[index];
      const image=depth=>this.scene.add.image(0,0,KEY,0).setOrigin(.5,.75).setDepth(depth);
      return this.slots[index]={rear:image(10.9),front:image(14.3),patch:null};
    }
    render(sections){
      const s=this.scene,left=s.cameraX-40,right=s.cameraX+s.width+40;
      let used=0;
      for(const section of sections){
        if(section.kind!=='ground'||section.end<left||section.start>right)continue;
        for(const patch of this.patches(section)){
          if(patch.x<left||patch.x>right||used===LIMIT)continue;
          const slot=this.slotAt(used++);
          if(slot.patch!==patch){
            slot.patch=patch;
            if(patch.epoch!==this.epoch){
              patch.epoch=this.epoch;
              patch.rearHit=patch.frontHit=-Infinity;
            }
            slot.rear.setFrame(patch.frame+1);
            slot.front.setFrame(patch.frame+2);
          }
          const x=patch.x,frontX=patch.frontX;
          const y=s.terrainSurfaceY(section,x),frontY=s.terrainSurfaceY(section,frontX);
          const slope=Math.atan2(frontY-y,frontX-x),scale=patch.size*.5;
          const age=s.elapsed-patch.rearHit,frontAge=s.elapsed-patch.frontHit;
          const moving=!this.reduced?.matches;
          const lean=moving?bend(age/.36)*(patch.id==='foothills'?.28:.69):0;
          slot.rear.setVisible(true).setPosition(x,y+1).setScale(scale).setRotation(slope+lean);
          slot.front.setVisible(patch.frontVisible);
          if(!patch.frontVisible)continue;
          let dx=0,dy=0,turn=0,stretch=1;
          if(moving&&frontAge>=0&&frontAge<.38){
            const wave=bend(frontAge/.38);
            if(patch.id==='ashlands'){dx=-6*wave;stretch=1+.8*wave;}
            else if(patch.variant%2){dx=3*wave;dy=-4*wave;turn=.78*wave;}
            else turn=.63*wave;
          }
          slot.front.setPosition(frontX+dx,frontY+1.4+dy+dx*Math.tan(slope))
            .setScale(scale*stretch,scale).setRotation(slope+turn);
        }
      }
      for(let i=used;i<this.slots.length;i++){
        const slot=this.slots[i];
        slot.patch=null;slot.rear.setVisible(false);slot.front.setVisible(false);
      }
    }
  }
  scope.GRIM_SURFACE_DRESSING={preload,SurfaceDressing};
})(window);
