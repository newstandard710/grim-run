'use strict';

const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {createHash} = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname,'..');
const base = '7d96d886f0786e759b59ba1599f7e3a30188f892';
const before = execFileSync('git',['show',base+':index.html'],{cwd:root,encoding:'utf8'});
const after = fs.readFileSync(path.join(root,'index.html'),'utf8');
const moduleSource = name => fs.readFileSync(path.join(root,'assets/visuals',name),'utf8');

function element() {
  const target={style:{setProperty(){}},classList:{add(){},remove(){},toggle(){},contains(){return false}}};
  const element = new Proxy(target,{get:(obj,key)=>key in obj?obj[key]:()=>element});
  return element;
}

function image(width,height) {
  return {
    width,height,displayWidth:width,displayHeight:height,depth:-29.92,
    setPosition(x,y){this.x=x;this.y=y;return this;},
    setOrigin(){return this;},
    setScrollFactor(){return this;},
    setVisible(visible){this.visible=visible;return this;},
    setDepth(depth){this.depth=depth;return this;},
    setAlpha(alpha){this.alpha=alpha;return this;},
    setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;},
    destroy(){}
  };
}

function runtime(html,candidate) {
  const elements=new Map(),storage=new Map();
  const w={
    document:{getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},
      createElement:element,addEventListener(){},write(){}},
    localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value))},
    Phaser:{Scene:class{},Game:class{},AUTO:1,Scale:{RESIZE:1,CENTER_BOTH:1}},
    Image:class {
      get naturalWidth(){return 24;} get naturalHeight(){return 64;}
      set src(value){if(value)this.onload();}
      removeAttribute(){}
    },
    location:{search:'?seed=33'},URLSearchParams,addEventListener(){},innerWidth:740,innerHeight:360
  };
  w.window=w;
  vm.createContext(w);
  vm.runInContext(moduleSource('world-art.js'),w);
  if(candidate)vm.runInContext(moduleSource('lavafall-detail.js'),w);
  for(const [,attrs,body] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))
    if(!/\bsrc\s*=/.test(attrs))vm.runInContext(body,w,{filename:'index.html'});
  return w;
}

function run(w,meters,rate,rewind) {
  const s=new w.GrimGameScene(), c=w.GRIM_CONFIG, textures=new Map();
  s.scale={width:740,height:360,on(){},off(){}};
  s.events={once(){}};
  s.add={graphics:element,text:element,image:()=>image(24,64)};
  s.cameras={main:{setScroll(){}}};
  s.textures={exists:key=>textures.has(key),addImage(key,source){textures.set(key,source);return source;},
    remove:key=>textures.delete(key)};
  s.create();
  s.drawScene=()=>s.updateBiomeBackdrops();
  s.startRun();
  s.setGodMode(true);
  let x=s.startX+meters*c.pxPerMeter;
  s.terrain.advance(x+2200);
  while(s.terrain.groundAt(x)===null)x-=8;
  Object.assign(s.player,{x,y:s.terrain.groundAt(x),grounded:true,velocityY:0});
  Object.assign(s,{distance:(x-s.startX)/c.pxPerMeter,elapsed:1.8,speed:w.GRIM_CORE.runSpeed(meters),
    hasTeleported:true,gunUnlocked:true,shrineClaimed:true,cameraX:x-740*c.reaperXRatio,
    cameraY:s.player.y-s.groundY,nextVendorNumber:15,lastVendorNumber:14,
    nextEncounterX:x+700,nextEnemySpawnX:x+480,nextGroundSpawnX:x+950,nextSnapSpawnX:x+990});
  const plate=image(1536,864);
  s.sizeBiomeBackdrop(plate);
  s.biomeBackdrops.lava=plate;
  s.resetRewindHistory();
  s.captureRewind();
  const checkpoint=s.rewindFrames[0];
  const hash=createHash('sha256');
  let ticks=0,visible=0;
  const record=()=>{
    hash.update(JSON.stringify({state:s.state,distance:s.distance,elapsed:s.elapsed,player:s.player,
      speed:s.speed,camera:[s.cameraX,s.cameraY],rng:s.rng.state,reflected:s.fireballs,
      enemies:s.enemies,bullets:s.bullets,obstacles:s.obstacles,coins:s.coins,souls:s.souls,
      rewind:s.rewindFrames.at(-1),frame:s.frame,points:s.points,
      spawn:[s.nextEncounterX,s.nextEnemySpawnX,s.nextGroundSpawnX,s.nextSnapSpawnX],
      cooldown:[s.gunCooldownMs,s.blastCooldownMs,s.rewindCooldownMs]}));
    if(s.lavafallDetail?.view?.visible)visible++;
    ticks++;
  };
  for(let i=0;i<rate*3;i++) {
    if(i===Math.floor(rate*.1))s.jump();
    if(i===Math.floor(rate*.25))s.jumpEnd();
    if(i===Math.floor(rate*.5))s.attack();
    if(i===Math.floor(rate*.9))s.startSlide();
    if(i===Math.floor(rate*1.12))s.endSlide();
    if(i===Math.floor(rate*1.36))s.fireCrossbow();
    s.update(0,1000/rate);
    record();
  }
  if(rewind) {
    assert.equal(s.state,'playing');
    // Supply an older timestamp for an actual captured Lava snapshot.
    checkpoint.at=s.rewindClockMs-s.rewindLengthMs()-1;
    if(s.rewindFrames[0]!==checkpoint)s.rewindFrames.unshift(checkpoint);
    assert(s.rewind());
    for(let i=0;i<rate*4&&s.state==='rewinding';i++){
      s.update(0,1000/rate);
      record();
    }
    assert.equal(s.state,'playing');
    assert.equal(s.elapsed,checkpoint.elapsed);
  }
  hash.update(JSON.stringify(s.terrain.segments));
  return {ticks,hash:hash.digest('hex'),visible};
}

const reference=runtime(before,false),candidate=runtime(after,true);
let matched=0;
for(const rate of [30,60,120]) {
  for(const meters of [8172,8995,9795]) {
    const a=run(reference,meters,rate,meters===8995);
    const b=run(candidate,meters,rate,meters===8995);
    assert.equal(a.ticks,b.ticks);
    assert.equal(a.hash,b.hash,'gameplay and RNG at '+rate+'Hz / '+meters+'m');
    assert.equal(a.visible,0);
    assert(b.visible>0,'the optional backdrop hook runs through the tested gate');
    matched+=a.ticks;
  }
}
console.log('PASS Lava overlays: '+matched+' exact PR95 ticks at 30/60/120 Hz, including native rewind playback');
