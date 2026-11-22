'use strict';
// Walk complete seeded courses with the production spawner and selector. Replay
// each naturally encountered branch to exercise the four controls independently.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function node(){
  let element;
  element=new Proxy({style:{setProperty(){}},classList:{contains(){return false;},toggle(){},add(){},remove(){}}},
    {get:(o,k)=>k in o?o[k]:(()=>element)});
  return element;
}
const w={document:{getElementById:node,createElement:node,write(){},addEventListener(){}},
  localStorage:{getItem(){return null;},setItem(){}},
  Phaser:{Scene:class{},Game:class{},AUTO:1,Scale:{RESIZE:1,CENTER_BOTH:1}},
  location:{search:''},URLSearchParams,addEventListener(){},innerWidth:740,innerHeight:360};
w.window=w;vm.createContext(w);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const [,attrs,body] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
  if(!/\bsrc\s*=/.test(attrs))vm.runInContext(body,w);
}
vm.runInContext(fs.readFileSync(path.join(root,'assets/visuals/obstacle-catalog.js'),'utf8'),w);
function game(seed){
  w.location.search='?seed='+seed;
  const s=new w.GrimGameScene();
  s.scale={width:740,height:360,on(){},off(){}};
  s.events={once(){}};s.add={graphics:node,text:node};s.cameras={main:{setScroll(){}}};
  s.create();s.drawScene=()=>{};s.startRun();
  return s;
}
const found=new Map(),expected=w.GRIM_OBSTACLE_SPRITES.filter(s=>s.category==='slide');
const seeds=[33,34,35,36,37,38,39,41,46,59,12,104,...Array.from({length:32},(_,i)=>i+60)];
const counts=new Map();
let courses=0;
for(const seed of seeds){
  courses++;
  const s=game(seed);
  s.godMode=true;
  const seen=new WeakSet(),bag=new Set();
  let previous=null,biome=null;
  for(let frame=0;frame<26000 && s.distance<11800;frame++){
    if(s.state==='upgrade')s.leaveVendor();
    const gap=s.terrain.segments.find(q=>q.kind==='gap'&&q.start>=s.player.x-5);
    if(s.player.grounded&&gap&&gap.start-s.player.x<=20)s.jump();
    s.update(0,1000/60);
    for(const ob of s.obstacles){
      if(ob.type==='branch' && !seen.has(ob)){
        seen.add(ob);
        counts.set(ob.slideSkin,(counts.get(ob.slideSkin)??0)+1);
        const skin=s.obstacleSkinFor(ob);
        if(skin.biome!==biome){bag.clear();previous=null;biome=skin.biome;}
        assert.notEqual(skin.id,previous,'no repeat across refill or intervening encounters');
        assert.ok(!bag.has(skin.id),'five distinct designs before refill');
        bag.add(skin.id);
        if(bag.size===5)bag.clear();
        previous=skin.id;
      }
      if(ob.type!=='branch'||ob.destroyed||ob.x-s.player.x<120||ob.x-s.player.x>190)continue;
      // Pick a natural encounter where the standing collider meets the lip
      // throughout the span. Sharp downhill crowns can clear a standing box.
      const at=s.terrain.groundAt,core=w.GRIM_CORE;
      if(![0,.25,.5,.75,1].every(t=>{
        const x=ob.x+t*ob.width;
        return core.branchHits(core.collisionBox(x,at(x),false),ob,at,w.GRIM_CONFIG.slideClearancePx);
      }))continue;
      const skin=s.obstacleSkinFor(ob);
      if(!found.has(skin.id))found.set(skin.id,{id:skin.id,seed,x:ob.x,variant:ob.variant,slideSkin:ob.slideSkin});
    }
  }
  if(found.size===expected.length)break;
}
assert.deepEqual([...found.keys()].sort(),Array.from(expected,s=>s.id).sort(),'every catalog design appears ahead in normal play');
for(const {id,seed,x,variant,slideSkin} of found.values()){
  for(const action of ['slide','stand','jump','cut']){
    const s=game(seed);
    s.terrain.advance(x+2000);
    const p=s.player,C=w.GRIM_CONFIG;
    let approach=x;
    while(approach>x-102 && s.terrain.groundAt(approach-1)!==null)approach--;
    Object.assign(p,{x:approach,y:s.terrain.groundAt(approach)});
    s.distance=(approach-s.startX)/C.pxPerMeter;s.speed=w.GRIM_CORE.runSpeed(s.distance);
    s.hasTeleported=x>=s.terrain.portalX;s.shrineClaimed=true;
    s.godMode=true;s.nextVendorNumber=Math.min(15,Math.floor(s.distance/C.vendorEveryMeters)+1);
    s.lastVendorNumber=s.nextVendorNumber-1;
    s.nextEncounterX=s.nextEnemySpawnX=s.nextGroundSpawnX=s.nextSnapSpawnX=x+2800;
    const ob=w.GRIM_CORE.obstacle('branch',x,s.terrain.groundAt(x),variant,C.slideClearancePx,s.height);
    ob.slideSkin=slideSkin;
    assert.equal(s.obstacleSkinFor(ob).id,id);
    s.obstacles=[ob];s.enemies=[];
    let actuated=false,low=false,air=false,swing=false;
    for(let frame=0;frame<95 && p.x<x+ob.width+28;frame++){
      if(!actuated && x-p.x<=80){
        if(action==='slide')s.startSlide();
        if(action==='jump')s.jump();
        if(action==='cut')s.attack();
        actuated=true;
      }
      s.update(0,1000/60);
      low||=p.sliding;air||=!p.grounded;swing||=p.attackMs>0;
    }
    assert.ok(actuated && p.x>=x+ob.width+28,id+' '+action+' traversed the complete span');
    assert.equal(ob.dealtDamage,action!=='slide',id+' '+action+' contact');
    assert.ok(!ob.destroyed,id+' keeps its structure through '+action);
    if(action==='slide')assert.ok(low);
    if(action==='jump')assert.ok(air);
    if(action==='cut')assert.ok(swing);
  }
}
// Exercise a partial bag, a refill and a biome change around a real rewind snapshot.
const replay=game(33);
function place(type,meters){
  let x=replay.startX+meters*w.GRIM_CONFIG.pxPerMeter;
  replay.terrain.advance(x+1800);
  while(replay.terrain.groundAt(x)===null||replay.vendorObstacleBlocked(type,x,74))x+=10;
  replay.placeEncounter(type,x);
  const ob=replay.obstacles.at(-1);
  assert.equal(ob.x,x,'accepted encounter at '+meters);
  return [ob.variant,ob.slideSkin];
}
function sequence(){
  return [740,748,756,764,772,780,788,796,804,812,906,914,922,930,938].map(m=>{
    place('rock',m-2);
    return place('branch',m);
  });
}
// A restored branch without an assigned ID follows the pre-bag position hash.
const legacyIds=w.GRIM_OBSTACLE_SPRITES.filter(s=>s.biome==='forest' && s.category==='slide').slice(0,3).map(s=>s.id);
for(let x=1200;x<1260;x++){
  const token='forest:slide:'+Math.round((x-replay.startX)*10);
  let hash=2166136261;
  for(const ch of token)hash=Math.imul(hash^ch.charCodeAt(0),16777619);
  assert.equal(replay.obstacleSkinFor({type:'branch',x}).id,legacyIds[(hash>>>0)%3]);
}
const opening=place('branch',720);
replay.godMode=true;replay.captureRewind();
const saved=replay.rewindFrames.at(-1),expectedReplay=sequence(),rng=replay.rng.state;
for(let i=0;i<2;i++){
  replay.applyRewindSnapshot(saved);
  assert.deepEqual(sequence(),expectedReplay);
  assert.equal(replay.rng.state,rng);
}
replay.startRun();
assert.deepEqual(place('branch',720),opening);
assert.deepEqual(sequence(),expectedReplay,'same-seed restart');
const forest=[opening,...expectedReplay.slice(0,10)].map(row=>row[1]);
assert.equal(new Set(forest.slice(0,5)).size,5);
assert.equal(new Set(forest.slice(5,10)).size,5);
assert.notEqual(forest[4],forest[5]);
assert.notEqual(forest[9],forest[10]);
assert.equal(new Set(expectedReplay.slice(-5).map(row=>row[1])).size,5);
console.log('PASS 40 naturally spawned landforms and 160 moving input replays across '+courses+' seeded courses');
console.log(JSON.stringify(Object.fromEntries(counts)));
console.log(JSON.stringify([...found.values()]));
