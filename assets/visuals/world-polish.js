/* Grim Run v0.15.3. Visual clocks never consume gameplay RNG or move colliders. */
(function(scope){
  'use strict';
  const BIOMES=['forest','foothills','tundra','caves','crystals','ashlands','lava','boss'];
  const ROOT='assets/world-polish/v0153/';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
  const frac=v=>v-Math.floor(v);
  const hash=(n,s=0)=>frac(Math.sin(n*.073+s*31.13)*43758.5453);
  const COIN_HEIGHT=19*1.75,COIN_WIDTH=17*1.75,SOUL_HEIGHT=23*1.75,SOUL_WIDTH=16*1.75;
  const SHEETS=[['polish-coin','coin-spin.png',128,128,12],
    ['polish-soul','soul-light.png',192,192,8],
    ['polish-fragments','cut-fragments.png',96,96,16],
    ['polish-respawn','reaper-respawn.png',384,384,12]];
  function preload(s){
    if(!s.load?.spritesheet)return;
    for(const [key,file,w,h,count]of SHEETS)s.load.spritesheet(key,ROOT+file+'?v=0.15.3',
      {frameWidth:w,frameHeight:h,endFrame:count-1});
    for(const id of BIOMES)s.load.image('soul-platform-'+id,ROOT+'soul-platform-'+id+'.png?v=0.15.3');
  }
  function coinMotion(time,x){
    const turn=frac(time/1.55+hash(x,4)),angle=turn*Math.PI*2;
    return {frame:Math.floor(turn*12),width:COIN_WIDTH*(.15+.85*Math.abs(Math.cos(angle))),height:COIN_HEIGHT};
  }
  function soulMotion(time,x){
    const phase=time*Math.PI*2/2.6+hash(x,5)*Math.PI*2,light=(Math.sin(phase)+1)/2;
    return {frame:Math.floor(time*8+hash(x,7)*8)%8,breath:1+(light-.5)*.07,light};
  }
  function materialFor(skin,biome){
    const name=skin?.name||'';
    if(biome==='crystals')return 2;
    if(biome==='ashlands'||biome==='lava')return 3;
    if(biome==='boss'||/(?:bone|antler|fossil)/.test(name))return 1;
    return 0;
  }
  class WorldPolish{
    constructor(scene){
      this.scene=scene;this.pickups=new Map();this.platforms=new Map();this.effects=[];this.sequence=0;
      this.fragments=[];this.ghosts=[];this.respawn=[];this.ready={};
      if(!scene.add?.image||!scene.textures?.exists)return;
      for(const [key,,,,count]of SHEETS)this.ready[key]=Boolean(scene.textures.exists(key)&&
        Array.from({length:count},(_,i)=>scene.textures.get(key).has(i)).every(Boolean));
      if(this.ready['polish-fragments'])for(let i=0;i<64;i++)this.fragments.push(
        scene.add.image(0,0,'polish-fragments',0).setDepth(16.2).setVisible(false));
      if(this.ready['polish-respawn'])for(let i=0;i<2;i++)this.respawn.push(
        scene.add.image(0,0,'polish-respawn',0).setOrigin(224/384,360/384).setDepth(14.9).setVisible(false));
      this.light=scene.add.graphics().setDepth(4);
      this.veil=scene.add.graphics().setScrollFactor(0).setDepth(21);
      scene.events?.once?.('shutdown',()=>this.destroy());
    }
    beginFrame(){this.activePickups=new Set();this.activePlatforms=new Set();this.light?.clear();}
    visible(x,width=0){const s=this.scene;return x+width>=s.cameraX-100&&x<=s.cameraX+s.width+100;}
    drawPickup(item,kind){
      const key='polish-'+kind,s=this.scene;
      if(!this.ready[key])return false;
      if(!this.visible(item.x))return true;
      let image=this.pickups.get(item);
      if(!image){image=s.add.image(0,0,key,0).setDepth(4.1);this.pickups.set(item,image);}
      this.activePickups.add(item);
      const x=item.x,y=item.baseY+item.offset,time=s.elapsed||0;
      image.setPosition(x,y).setVisible(true);
      if(kind==='coin'){
        const motion=coinMotion(time,x),widths=scope.GRIM_POLISH_DATA.coinWidths;
        image.setFrame(motion.frame).setDisplaySize(motion.width*128/widths[motion.frame],motion.height*128/108);
        this.light.fillStyle(0xffd47b,.065).fillCircle(x,y,22);
      }else{
        const motion=soulMotion(time,x);
        image.setFrame(motion.frame).setDisplaySize(SOUL_WIDTH*192/124*motion.breath,
          SOUL_HEIGHT*192/168*motion.breath).setAlpha(.92+motion.light*.08);
        // Soft layered falloff avoids a hard halo ring and preserves legibility.
        for(let i=3;i>=1;i--){
          this.light.fillStyle(i===1?0xfff3d0:0x96fff0,(.012+motion.light*.012)*(4-i));
          this.light.fillEllipse(x,y,25+i*17,30+i*18);
        }
        for(let i=0;i<3;i++){
          const phase=frac(time*.33+hash(x,i+11));
          this.light.fillStyle(0xe7fff2,Math.sin(phase*Math.PI)*.38);
          this.light.fillCircle(x+Math.sin(time*.8+i*2.1)*19,y+24-phase*51,1.1);
        }
      }
      return true;
    }
    drawPlatform(plat,forcedBiome){
      const s=this.scene,meters=(plat.x+plat.width/2-s.startX)/12;
      const weights=s.terrainBiomeWeights(meters);
      const biome=forcedBiome||Object.entries(weights).sort((a,b)=>b[1]-a[1])[0]?.[0]||'tundra';
      const key='soul-platform-'+biome;
      if(!s.textures?.exists?.(key))return false;
      let image=this.platforms.get(plat);
      if(!image){image=s.add.image(0,0,key).setDepth(1.6);this.platforms.set(plat,image);}
      image.setTexture(key).setOrigin(0,12/192).setPosition(plat.x,plat.y)
        .setDisplaySize(plat.width,plat.width*192/768).setVisible(true);
      this.activePlatforms.add(plat);return true;
    }
    destroyObstacle(ob){
      const s=this.scene;
      if(!this.ready['polish-fragments']||!this.visible(ob.x,ob.width))return;
      const skin=s.obstacleSkinFor(ob),biome=s.obstacleBiomeFor(ob),material=materialFor(skin,biome);
      const ground=ob.type==='snappingBramble'?s.terrain.anchorAt(ob.x):ob.y+ob.height;
      const y=ob.type==='airBramble'?ob.y+ob.height*.55:ground-38;
      const effect={x:ob.x+ob.width/2,y,age:0,material,seed:++this.sequence,parts:[]};
      // At most eight small effects / sixty-four fragments, including mass clears.
      if(this.effects.length>=8)this.effects.shift();
      for(let i=0;i<8;i++){
        const n=effect.seed*17+i,angle=-Math.PI*.85+hash(n,1)*Math.PI*.85;
        const speed=50+hash(n,2)*105;
        effect.parts.push({frame:material*4+i%4,x:(hash(n,3)-.5)*24,y:(hash(n,4)-.5)*24,
          vx:Math.cos(angle)*speed+25,vy:Math.sin(angle)*speed-15,
          spin:(hash(n,5)-.5)*8,size:6+hash(n,6)*9,life:.38+hash(n,7)*.23});
      }
      this.effects.push(effect);
      const source=s.obstacleSpriteObjects?.get(ob);
      if(source&&this.ghosts.length<4){
        // The cut crown gives a short lean/sink; the collider is already gone.
        const image=s.add.image(source.x,source.y,source.texture.key,source.frame.name)
          .setOrigin(source.originX,source.originY).setScale(source.scaleX,source.scaleY)
          .setRotation(source.rotation).setDepth(16.1).setAlpha(.8);
        this.ghosts.push({image,x:source.x,y:source.y,rotation:source.rotation,age:0,material});
      }
    }
    tick(ms){
      for(const effect of this.effects)effect.age+=ms;
      this.effects=this.effects.filter(v=>v.age<650);
      for(const ghost of this.ghosts)ghost.age+=ms;
      this.ghosts=this.ghosts.filter(g=>{if(g.age<260)return true;g.image.destroy();return false;});
    }
    renderEffects(){
      let used=0;
      for(const effect of this.effects){
        const t=effect.age/1000;
        for(const p of effect.parts){
          if(t>=p.life||used>=this.fragments.length)continue;
          this.fragments[used++].setFrame(p.frame).setPosition(effect.x+p.x+p.vx*t,
            effect.y+p.y+p.vy*t+210*t*t).setRotation(p.spin*t)
            .setDisplaySize(p.size,p.size).setAlpha(1-ease((t/p.life-.45)/.55)).setVisible(true);
        }
      }
      for(let i=used;i<this.fragments.length;i++)this.fragments[i].setVisible(false);
      for(const g of this.ghosts){const t=g.age/260;
        g.image.setPosition(g.x+8*t,g.y+16*t*t).setRotation(g.rotation+(g.material===2?.06:.12)*t)
          .setAlpha(.8*(1-ease(t)));
      }
    }
    renderRespawn(){
      const s=this.scene,p=s.player;
      this.veil?.clear();for(const image of this.respawn)image.setVisible(false);
      if(s.state!=='respawning')return;
      const time=1500-s.respawnMs,t=time/1500;
      // A brief dip conceals the old location while the camera eases to safety.
      this.veil?.fillStyle(0x090e1b,.38*(1-ease(t/.42))).fillRect(0,0,s.width,s.height);
      if(!this.respawn.length){
        // Missing optional art still gets a visible smoke gather and exact timing.
        s.powerArt?.hideBase();const g=this.light;
        for(let i=0;i<9;i++){const a=i*2.4+t*2,r=48*(1-ease(t));
          g.fillStyle(0x8ca9ba,.12+Math.sin(t*Math.PI)*.15).fillEllipse(p.x+Math.cos(a)*r,p.y-42+Math.sin(a)*r,18+25*t,14+30*t);}
        return;
      }
      const reveal=ease((t-.87)/.13);
      const visibleBase=Object.values(s.visuals?.reaperPoseSprites||{}).filter(v=>v.visible);
      if(reveal<1){
        s.powerArt?.hideBase();s.actor?.clear();
        for(const sprite of visibleBase)sprite.setVisible(reveal>0).setAlpha(reveal);
      }
      const position=clamp((time-140)/1190)*11,frame=Math.floor(position),mix=position-frame;
      const alpha=ease(time/200)*(1-reveal),scale=120/254;
      this.respawn[0].setFrame(frame).setScale(scale).setPosition(p.x,p.y).setAlpha(alpha*(1-mix)).setVisible(true);
      this.respawn[1].setFrame(Math.min(11,frame+1)).setScale(scale).setPosition(p.x,p.y).setAlpha(alpha*mix).setVisible(true);
    }
    endFrame(){
      for(const [item,image]of this.pickups)if(!this.activePickups.has(item)){image.destroy();this.pickups.delete(item);}
      for(const [item,image]of this.platforms)if(!this.activePlatforms.has(item)){image.destroy();this.platforms.delete(item);}
      this.renderEffects();this.renderRespawn();
    }
    reset(){
      this.effects=[];this.sequence=0;
      for(const ghost of this.ghosts)ghost.image.destroy();this.ghosts=[];
      for(const image of [...this.fragments,...this.respawn])image.setVisible(false);
      this.veil?.clear();this.light?.clear();
    }
    destroy(){this.reset();for(const image of [...this.pickups.values(),...this.platforms.values(),...this.fragments,...this.respawn])image.destroy();this.pickups.clear();this.platforms.clear();this.light?.destroy();this.veil?.destroy();}
  }
  scope.GRIM_WORLD_POLISH={WorldPolish,preload,coinMotion,soulMotion,materialFor,BIOMES,COIN_HEIGHT,COIN_WIDTH,SOUL_HEIGHT,SOUL_WIDTH,RESPAWN_MS:1500};
})(typeof window!=='undefined'?window:globalThis);
