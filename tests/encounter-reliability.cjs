'use strict';
/* Run with: node tests/encounter-reliability.cjs — no npm dependencies. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const node=()=>{let element;
  element=new Proxy({textContent:'',style:{setProperty(){}},
    classList:{toggle(){},add(){},remove(){},contains(){return false}},
    addEventListener(){},setAttribute(){},appendChild(){},replaceChildren(){},destroy(){}},
    {get(o,p){return p in o?o[p]:(...args)=>element;},set(o,p,v){o[p]=v;return true;}});
  return element;
};
const nodes=new Map();
const getNode=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
const sandbox={
  document:{getElementById:getNode,createElement:node,write(){},addEventListener(){}},
  localStorage:{getItem:()=>null,setItem(){}},
  Phaser:{Scene:class{},Game:class{},AUTO:1,Scale:{RESIZE:1,CENTER_BOTH:1}},
  location:{search:''},URLSearchParams,
  innerWidth:950,innerHeight:430,addEventListener(){}
};
sandbox.window=sandbox;
vm.createContext(sandbox);
const scripts=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
for(const [,attributes,source] of scripts){
  if(/\bsrc\s*=/.test(attributes))continue;
  vm.runInContext(source,sandbox,{filename:'index.html inline script'});
}
const C=sandbox.GRIM_CONFIG,Core=sandbox.GRIM_CORE,Terrain=sandbox.GRIM_TERRAIN;
const Powers=sandbox.GRIM_POWERS,Combat=sandbox.GRIM_COMBAT,GameScene=sandbox.GrimGameScene;
assert.equal(C.version,'0.8.1');

for(let k=1;k<=14;k++){
  const x=200+k*666*C.pxPerMeter;
  assert.equal(Core.intersectsVendorCorridor(x,100,200,666,12),true);
  assert.equal(Core.intersectsVendorCorridor(x+49*12,25,200,666,12),true);
  assert.equal(Core.intersectsVendorCorridor(x+50*12,25,200,666,12),false);
  assert.equal(Core.intersectsVendorCorridor(x-25,20,200,666,12),false);
}
const counts={},totals=[];
for(let seed=1;seed<=300;seed++){
  const scene=new GameScene();
  Object.assign(scene,{
    seed,startX:200,rng:Core.makeRng(seed),
    terrain:Terrain.makeTerrain(seed,339,200,C.pxPerMeter),width:950,height:430,
    coins:[],obstacles:[],enemies:[],soulPlatform:null,tips:[],
    encounterTelemetry:{attempts:0,spawned:0,dropped:0,rejectedVendor:0,
      rejectedGeometry:0,rejectedOverlap:0,enteredView:0,visibleFor650ms:0,kills:0,byKind:{}},
    hasTeleported:true,nextEnemySpawnX:200+5070*C.pxPerMeter,nextSnapSpawnX:200+3260*C.pxPerMeter,
    player:{x:200+5000*C.pxPerMeter},
    makeTip(){}
  });
  scene.soulPlatform=scene.makeSoulPlatform();
  scene.populateGold();
  scene.populateComboObstacles();
  const tucks=scene.obstacles.filter(o=>o.type==='tuckGate');
  counts[tucks.length]=(counts[tucks.length]||0)+1;
  assert.ok(tucks.length>=2&&tucks.length<=3,'Seed '+seed+' got '+tucks.length+' tuck gates');
  assert.ok(tucks.every(o=>!Core.intersectsVendorCorridor(o.x,o.width,scene.startX,666,12)),
    'Tuck gate overlaps post-vendor corridor');
  for(let m=5070;m<9830;m+=55){
    scene.player.x=scene.startX+m*C.pxPerMeter;
    scene.spawnCombatAhead(scene.player.x+1170);
  }
  const stats=scene.encounterTelemetry;
  assert.ok(stats.spawned>=25,'Too few enemies at seed '+seed+': '+stats.spawned);
  assert.ok(stats.byKind.bat>0&&stats.byKind.skeletalBat>0,
    'Seed '+seed+' missing one of the two flying enemy variants');
  assert.ok(scene.enemies.every(e=>!Core.intersectsVendorCorridor(e.x-23,46,scene.startX,666,12)),
    'Enemy intersects a vendor safe corridor');
  totals.push(stats.spawned);
}
assert.ok(counts[2]>0&&counts[3]>0,'Both two and three tuck layouts should occur');

const bat={kind:'bat',x:520,y:180,hp:1,dead:false,visibleMs:649};
assert.equal(Combat.pickTarget([bat],[],200,0,950,0),null,'A bat must first be visible');
bat.visibleMs=650;
assert.equal(Combat.pickTarget([bat],[],200,0,950,0).ref,bat,'Visible bat becomes targetable');

const scene=new GameScene();
let gapBridges=0;
Object.assign(scene,{
  player:{x:1000,y:310,hp:3,maxHp:3},godMode:true,
  powerManager:Powers.makePowerManager(),rng:Core.makeRng(5),puff(){},
  terrain:{fillGaps(){gapBridges++},anchorAt(){return 330}},
  tips:[],obstacles:[],brittleClearUntilX:0
});
scene.powerManager.apply('brittleBones',scene.player,()=>{},1);
scene.takeDamage(1,'rock');
assert.equal(scene.player.hp,3,'God Mode must not deduct hearts');
assert.ok(gapBridges>=1&&scene.brittleClearUntilX>scene.player.x,'Brittle Bones must activate in God Mode');
assert.ok(scene.damageFlashMs>0,'Damage feedback must activate in God Mode');
scene.godMode=false;
scene.takeDamage(1,'rock');
assert.equal(scene.player.hp,2,'Normal damage should still deduct one heart');

function graphic(){return node();}
const visibility=[];
for(const seed of [1,7,42,99,314]){
  sandbox.location.search='?seed='+seed;
  const world=new GameScene();
  world.scale={width:950,height:430,on(){},off(){}};
  world.events={once(){}};
  world.add={graphics:graphic,text:graphic};
  world.cameras={main:{setScroll(){}}};
  world.create();
  world.drawScene=()=>{}; // Simulate gameplay, not actual pixels.
  world.startRun();
  world.player.x=world.startX+5000*C.pxPerMeter;world.distance=5000;
  world.enterUnderworld();
  world.godMode=true;world.nextVendorNumber=8;world.lastVendorNumber=7;
  for(let n=0;n<6;n++)world.update(0,250);
  let frames=0;
  while(world.state!=='won'&&frames<6000){
    if(world.state==='upgrade')world.leaveVendor();
    assert.notEqual(world.state,'dead','Unexpected death in God Mode: seed '+seed);
    world.update(0,34);frames++;
  }
  assert.equal(world.state,'won','Full run must reach 9,999m: seed '+seed);
  assert.ok(world.encounterTelemetry.enteredView>=15,
    'Enemies spawned but did not enter viewport: seed '+seed);
  assert.ok(world.encounterTelemetry.visibleFor650ms>=12,
    'Enemies disappeared before a readable encounter: seed '+seed);
  visibility.push(world.encounterTelemetry.visibleFor650ms);
}
console.log('Full-run encounter visibility: '+visibility.join(', '));

console.log('v0.8.1 PASS: 300 seeded worlds; air-tuck gate counts '+JSON.stringify(counts)+
  '; enemy spawns '+Math.min(...totals)+'–'+Math.max(...totals)+
  '; 50m vendor rules, visibility gate, and God Mode damage effects.');
