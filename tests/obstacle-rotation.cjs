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
for(const seed of [33,34,35,36,39,41,46,59]){
  const s=game(seed);
  s.godMode=true;
  for(let frame=0;frame<26000 && s.distance<11800 && found.size<expected.length;frame++){
    if(s.state==='upgrade')s.leaveVendor();
    const gap=s.terrain.segments.find(q=>q.kind==='gap'&&q.start>=s.player.x-5);
    if(s.player.grounded&&gap&&gap.start-s.player.x<=20)s.jump();
    s.update(0,1000/60);
    for(const ob of s.obstacles){
      if(ob.type!=='branch'||ob.destroyed||ob.x-s.player.x<120||ob.x-s.player.x>190)continue;
      // Pick a natural encounter where the standing collider meets the lip
      // throughout the span. Sharp downhill crowns can clear a standing box.
      const at=s.terrain.groundAt,core=w.GRIM_CORE;
      if(![0,.25,.5,.75,1].every(t=>{
        const x=ob.x+t*ob.width;
        return core.branchHits(core.collisionBox(x,at(x),false),ob,at,w.GRIM_CONFIG.slideClearancePx);
      }))continue;
      const skin=s.obstacleSkinFor(ob);
      if(!found.has(skin.id))found.set(skin.id,{id:skin.id,seed,x:ob.x,variant:ob.variant});
    }
  }
}
assert.deepEqual([...found.keys()].sort(),Array.from(expected,s=>s.id).sort(),'every catalog design appears ahead in normal play');
for(const {id,seed,x,variant} of found.values()){
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
console.log('PASS 24 naturally spawned landforms and 96 moving input replays');
console.log(JSON.stringify([...found.values()]));
