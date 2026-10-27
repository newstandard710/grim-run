'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),html=read('index.html');
function node(){let n;n=new Proxy({textContent:'',disabled:false,style:{setProperty(){}},classList:{add(){},remove(){},toggle(){},contains(){return false}},addEventListener(){},setAttribute(){},appendChild(){},replaceChildren(){},destroy(){}},{get:(o,k)=>k in o?o[k]:(...a)=>n,set:(o,k,v)=>(o[k]=v,true)});return n;}
const els=new Map(),el=id=>{if(!els.has(id))els.set(id,node());return els.get(id);};
const w={document:{getElementById:el,createElement:node,write(){},addEventListener(){}},localStorage:{getItem(){return null},setItem(){}},Phaser:{Scene:class{},Game:class{},AUTO:1,Scale:{RESIZE:1,CENTER_BOTH:1}},location:{search:'?seed=33'},URLSearchParams,addEventListener(){},innerWidth:950,innerHeight:430};w.window=w;vm.createContext(w);
for(const [,attrs,body]of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!/\bsrc\s*=/.test(attrs))vm.runInContext(body,w);
vm.runInContext(read('assets/encounters/v0190/animation-data.js'),w);
const C=w.GRIM_CONFIG;
function game(){const s=new w.GrimGameScene();s.scale={width:950,height:430,on(){},off(){}};s.events={once(){}};s.add={graphics:node,text:node};s.cameras={main:{setScroll(){}}};s.create();s.drawScene=()=>{};s.startRun();s.nextVendorNumber=15;return s;}

// All time controls scale the same actual simulation; pause freezes every clock.
const full=game(),half=game(),quarter=game(),paused=game();
for(const g of [full,half,quarter,paused])g.setGodMode(true);
half.togglePracticeSlow();quarter.togglePracticeSlow();quarter.togglePracticeSlow();
for(let i=0;i<3;i++)paused.togglePracticeSlow();
paused.player.attackMs=200;paused.player.invulMs=900;paused.player.slowMs=400;
const before=JSON.stringify({p:paused.player,clock:paused.elapsed,rng:paused.rng.state,frame:paused.frame,camera:paused.cameraY});
paused.jump();paused.attack();paused.startSlide();assert(!paused.fireCrossbow());assert(!paused.rewind());
for(let i=0;i<120;i++)for(const g of [full,half,quarter,paused])g.update(0,16);
assert.equal(JSON.stringify({p:paused.player,clock:paused.elapsed,rng:paused.rng.state,frame:paused.frame,camera:paused.cameraY}),before);
assert(Math.abs(half.elapsed/full.elapsed-.5)<1e-9);assert(Math.abs(quarter.elapsed/full.elapsed-.25)<1e-9);
paused.togglePracticeSlow();assert.equal(paused.practiceScale(),1);paused.update(0,16);assert(paused.elapsed>0);assert.equal(paused.player.attackMs,184);
for(let i=0;i<3;i++)paused.togglePracticeSlow();paused.setGodMode(false);assert.equal(paused.practiceScale(),1);assert.equal(paused.practiceTimeMode,0);

// The early floor trigger belongs only to the first encounter of each kind.
for(const [first,later]of [[1,2],[8,9]]){
 const s=game();s.hasTeleported=first===8;s.shrineClaimed=true;
 for(const k of [first,later]){
  s.nextVendorNumber=k;s.lastVendorNumber=k-1;s.player.x=s.startX+(k*666-25)*12;
  s.player.y=s.terrain.groundAt(s.player.x);s.player.grounded=true;s.player.onSoulPlatform=false;
  assert(s.touchingVendorFloor(k));
  if(k===first){
   assert(s.readyForVendor(k));s.update(0,0);assert.equal(s.state,'vendorIntro');
   for(let i=0;i<39;i++)s.update(0,250);assert.equal(s.state,'vendorIntro');assert.equal(s.vendorIntroMs,250);
   s.update(0,250);assert.equal(s.state,'upgrade');s.leaveVendor();
  }else{
   assert(!s.readyForVendor(k));s.update(0,16);assert.equal(s.state,'playing');
   s.player.x=s.startX+k*666*12-48;s.player.y=s.terrain.groundAt(s.player.x);
   assert(s.readyForVendor(k));s.update(0,0);assert.equal(s.state,'upgrade');
  }
 }
}

// The new leftward strike cannot overhang either sanctuary's protected ground.
for(const k of [1,5,8,14]){
 const g=game(),end=g.startX+(k*666+50)*12;
 assert(g.vendorObstacleBlocked('snappingBramble',end+130,62));
 assert(!g.vendorObstacleBlocked('snappingBramble',end+200,62));
}

// Proximity, explicit attack windows, roots, cutting, and rewind own plant state.
const s=game();s.player.x=s.startX+3400*12;s.terrain.advance(s.player.x+2000);s.player.y=s.terrain.groundAt(s.player.x);s.player.grounded=true;
const plant={type:'snappingBramble',x:s.player.x+500,width:62,height:62,variant:0,destroyed:false,dealtDamage:false};s.obstacles=[plant];
s.updatePlants(100);assert.equal(plant.plantState,'idle');
s.player.x=plant.x-180;s.updatePlants(0);assert.equal(plant.plantState,'windup');
s.updatePlants(419);assert.equal(plant.plantState,'windup');
let geom=s.plantGeometry(plant);assert(!s.plantHits({x:geom.jaw.x+2,y:geom.jaw.y+2,width:6,height:6},plant),'Windup does not deal early jaw damage');
s.updatePlants(1);assert.equal(plant.plantState,'strike');s.updatePlants(170);geom=s.plantGeometry(plant);
assert(s.plantHits({x:geom.jaw.x+2,y:geom.jaw.y+2,width:6,height:6},plant));assert(s.plantHits({...geom.root},plant));
const rootBefore={...geom.root};s.updatePlants(100);assert.equal(plant.plantState,'recover');assert(!s.plantHits({x:s.plantGeometry(plant).jaw.x+2,y:s.plantGeometry(plant).jaw.y+2,width:6,height:6},plant));assert.equal(JSON.stringify(s.plantGeometry(plant).root),JSON.stringify(rootBefore));
s.setGodMode(true);s.state='playing';s.captureRewind();const saved=s.rewindFrames.at(-1);s.updatePlants(500);s.applyRewindSnapshot(saved);assert.equal(s.obstacles[0].plantState,'recover');assert.equal(s.obstacles[0].plantMs,10);
const cutting=s.obstacles[0];s.player.x=cutting.x-30;s.player.y=s.terrain.anchorAt(cutting.x);s.player.attackMs=150;s.cutNearby();assert(cutting.destroyed,'The new plant remains scythe-cuttable');

// Either acquisition order gives the named combination without extra cost or ranks.
for(const first of ['ravenWings','skeletalWings']){
 const m=w.GRIM_POWERS.makePowerManager(),second=first==='ravenWings'?'skeletalWings':'ravenWings';
 m.apply(first,{},()=>{});const offer=[...m.eligible(),...m.devilEligible()].find(v=>v.id===second);
 assert.equal(offer.name,'GRAVEWING ASCENSION');assert(offer.completesCombo);m.apply(second,{},()=>{});
 assert.equal(m.level('ravenWings'),1);assert.equal(m.level('skeletalWings'),1);assert.equal(m.summary().length,1);assert.equal(m.summary()[0].id,'gravewingAscension');
 m.apply('skeletalWings',{},()=>{});assert(m.summary()[0].detail.includes('Skeletal 2'));
}

// Every generated gap has a conservative held base jump at the new speed.
let gaps=0;
for(let seed=1;seed<=40;seed++){
 const terrain=w.GRIM_TERRAIN.makeTerrain(seed,339,200,12);terrain.advance(200+20000*12);
 for(let i=0;i<terrain.segments.length;i++){
  const a=terrain.segments[i];if(a.kind!=='gap')continue;
  const b=terrain.segments[i+1],rise=a.y0-b.y0,speed=w.GRIM_CORE.runSpeed((a.start-200)/12),v=Math.abs(C.jumpVelocity);
  const flight=(v+Math.sqrt(v*v-2*C.gravity*rise))/C.gravity;
  assert(speed*flight-(a.end-a.start)>=23,'Unupgraded gap margin, seed '+seed+' at '+a.start);gaps++;
 }
}
assert(gaps>3000);
const art={};art.window=art;vm.createContext(art);vm.runInContext(read('assets/visuals/power-animations.js'),art);
const g={player:{x:0,y:300},width:950,height:430,state:'playing',powerManager:{level:()=>4}},a=new art.GRIM_POWER_ART.PowerAnimations(g);a.enabled=true;a.trigger('brittleBones',0,0,'blast',4);
const blast=a.bursts[0];assert.equal(blast.duration,1900);assert(blast.bones.every(v=>v.size>=45&&v.size<=105));
const reach=Math.hypot(950,430)*1.45;assert(Math.abs(Math.hypot(blast.bones[0].vx,blast.bones[0].vy)-reach*.5)<1e-8);
assert(blast.bones.some(v=>v.vx*1.9>950)&&blast.bones.some(v=>v.vx*1.9<-950));
const manifest=JSON.parse(read('assets/encounters/v0190/manifest.json'));
for(const [group,sub]of [['sources','source/'],['runtime','']])for(const [name,m]of Object.entries(manifest[group])){
 const b=fs.readFileSync(path.join(root,'assets/encounters/v0190',sub+name));assert.equal(b.length,m.bytes);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),m.sha256);assert.equal(b[25],6);
}
assert.deepEqual(manifest.registration.bat.corrections,{'6':[-34,-23],'8':[-33,-18]});assert.equal(manifest.registration.plant.frames,16);assert.equal(manifest.registration.gravewing.frames,12);
// Flight/dive/recovery keep one registered position and total opacity through every handoff.
vm.runInContext(read('assets/combat/v0170/animation-data.js'),art);vm.runInContext(read('assets/visuals/bat-flight.js'),art);vm.runInContext(read('assets/visuals/combat-animations.js'),art);
art.GRIM_VISUALS={V2_BAT:{dive:{key:'legacy-dive',anchor:[1600,650],scale:.08}}};
function image(){const o={alpha:1,visible:false};return new Proxy(o,{get:(x,k)=>k in x?x[k]:(...v)=>{if(k==='setAlpha')x.alpha=v[0];if(k==='setVisible')x.visible=v[0];if(k==='setPosition'){x.x=v[0];x.y=v[1];}if(k==='setOrigin')x.origin=v;if(k==='setTexture')x.key=v[0];return o.proxy;}});}
const flightScene={state:'paused',elapsed:0,width:950,cameraX:0,enemies:[],visuals:{reviewV2:true,batReady:true,batPool:[]},
 textures:{exists:()=>true,get:()=>({has:()=>true})},add:{image:()=>{const v=image();v.proxy=v;return v;}},events:{once(){}}};
const flight=new art.GRIM_COMBAT_ART.CombatAnimations(flightScene);
for(const mode of ['glide','dive','recover'])for(const t of [0,.03,.06,.09,.119,.12,.18])for(const elapsed of [0,.48,.90,.95]){
 flightScene.enemies=[{kind:'bat',x:480,y:160,phase:0,mode,timer:t}];flightScene.elapsed=elapsed;flight.renderBats();
 const views=flight.bats[0].filter(v=>v.visible);assert(Math.abs(views.reduce((n,v)=>n+v.alpha,0)-1)<1e-9);
 assert(views.every(v=>v.x===480&&v.y===160));
 for(const v of views)assert.equal(JSON.stringify(v.origin),JSON.stringify(v.key==='legacy-dive'?[1600/2304,650/1280]:[178/256,128/256]));
}
console.log('PASS v0.19: four real time scales + complete freeze/resume, ten-second/center-trigger vendors, proximity bite/hit windows/cutting/rewind, both wing orders, '+gaps+' reachable gaps, large slow four-edge bones and asset hashes.');
