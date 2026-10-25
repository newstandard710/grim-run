'use strict';
/* node tests/rewind.cjs — standalone regression checks for Grim Run v0.9.0 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const store=new Map(),ui=new Map();
function elem(){let n;n=new Proxy({textContent:'',style:{setProperty(){}},
 classList:{add(){},remove(){},toggle(){},contains(){return false}},
 addEventListener(){},setAttribute(){},appendChild(){},replaceChildren(){},destroy(){}},
 {get:(o,k)=>k in o?o[k]:(...args)=>n,set:(o,k,v)=>(o[k]=v,true)});return n;}
function node(id){if(!ui.has(id))ui.set(id,elem());return ui.get(id);}
const w={document:{getElementById:node,createElement:elem,addEventListener(){},write(){}},
 localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))},
 Phaser:{Scene:class{},Game:class{},AUTO:1,Scale:{RESIZE:1,CENTER_BOTH:1}},
 location:{search:'?seed=78'},URLSearchParams,addEventListener(){},innerWidth:950,innerHeight:430};
w.window=w;vm.createContext(w);
for(const [,attrs,body] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))
 if(!/\bsrc\s*=/.test(attrs))vm.runInContext(body,w,{filename:'index.html'});
const C=w.GRIM_CONFIG,P=w.GRIM_POWERS,Core=w.GRIM_CORE;
assert.equal(C.version,'0.12.0');
assert.ok(P.POWER_ORDER.includes('deathsReversal'),'Rewind must be Angel vendor power');
const m=P.makePowerManager();
for(const [lvl,seconds,cooldown] of [[1,5,60000],[2,6,55000],[3,7,50000],[4,8,45000]]){
 assert.equal(m.apply('deathsReversal',{},()=>{},1),true);
 assert.equal(m.rewindSeconds(),seconds);
 assert.equal(m.rewindCooldownMs(),cooldown);
}
assert.equal(m.apply('deathsReversal',{},()=>{},1),false,'Rewind caps at four levels');
function game(seed=78){
 w.location.search='?seed='+seed;
 const s=new w.GrimGameScene();
 s.scale={width:950,height:430,on(){},off(){}};
 s.events={once(){}};s.add={graphics:elem,text:elem};
 s.cameras={main:{setScroll(){}}};s.create();s.drawScene=()=>{};s.startRun();
 return s;
}
const step=(s,n,d=34)=>{for(let i=0;i<n;i++)s.update(0,d)};
function finishPlayback(scene){
  assert.equal(scene.state,'rewinding','The real snapshot sequence should animate first');
  let frames=0;
  while(scene.state==='rewinding'&&frames++<100)scene.update(0,34);
  assert.equal(scene.state,'playing','Rewind animation must finish');
  return frames*34;
}

const inactive=game(82);
step(inactive,20);
assert.equal(inactive.rewindFrames.length,0,'No snapshot memory used without power');
assert.equal(inactive.rewind(),false);

const g=game(78);
assert.equal(g.rewindLevel(),0);
g.nextVendorNumber=15;g.setGodMode(true);
assert.equal(g.rewindLevel(),4,'God Mode gives a fully upgraded Rewind');
assert.equal(g.powerManager.level('deathsReversal'),0,'God Mode does not buy the ability');
assert.equal(g.rewindLengthMs(),8000);assert.equal(g.rewindRechargeMs(),45000);
step(g,265);
assert.ok(g.rewindFrames.length>60,'Rolling snapshot history gathered');
const oldX=g.player.x,oldHP=g.player.hp;
assert.equal(g.rewind(),true,'Rewind activation');
assert.equal(g.state,'rewinding','Rewind must not teleport instantly');
const visualDuration=finishPlayback(g);
assert.ok(visualDuration>2500&&visualDuration<3000,'Eight seconds plays backward at 3x speed');
assert.ok(g.player.x<oldX-1400,'Rewind moved Reaper back several seconds');
assert.equal(g.player.hp,oldHP,'Rewind restores HP');
assert.equal(g.rewindCooldownMs,0,'God Mode has no cooldown');
assert.equal(g.rewind(),false,'Still requires full new history after use');
assert.ok(g.rewindFrames.length<=2,'Old future timeline discarded');
step(g,10);assert.equal(g.rewindCooldownMs,0);
step(g,255);
assert.equal(g.rewind(),true,'God Mode can rewind again after accumulating new eight-second history');
finishPlayback(g);
assert.equal(g.rewindCooldownMs,0);
g.setGodMode(false);
assert.equal(g.rewindLevel(),0);
assert.equal(g.powerManager.level('deathsReversal'),0);
step(g,5);
assert.equal(g.rewindFrames.length,0,'Disabling free ability releases snapshot memory');

const p=game(31);
p.powerManager.apply('deathsReversal',p.player,()=>{},1);
p.nextVendorNumber=15;
p.player.hp=8;p.player.maxHp=8;
p.captureRewind();step(p,165);
assert.ok(p.rewindClockMs>=5000);
assert.equal(p.rewind(),true);
const level1Duration=finishPlayback(p);
assert.ok(level1Duration>1550&&level1Duration<1900,'Five-second history animates at 3x');
assert.equal(p.rewindCooldownMs,60000,'Level 1 starts 60s cooldown');
assert.ok(p.player.x<p.startX+100*12,'Level 1 moved time back roughly 5 seconds');
const cool=p.rewindCooldownMs;
p.resetRewindHistory();
assert.equal(p.rewindCooldownMs,cool,'Irreversible event cannot reset ability cooldown');

const entities=game(55);
entities.powerManager.apply('deathsReversal',entities.player,()=>{},1);
entities.nextVendorNumber=15;
entities.player.hp=3;entities.player.maxHp=3;
const e={kind:'bat',x:entities.player.x+180,y:entities.player.y-140,
 homeY:entities.player.y-140,hp:2,dead:false,phase:0,mode:'done',timer:0};
const hazard={type:'rock',x:entities.player.x+310,y:entities.player.y-40,width:50,height:40,destroyed:false};
entities.enemies=[e];entities.obstacles=[hazard];
entities.bullets=[{kind:'enemy',x:entities.player.x+50,y:e.y,ref:e,ageMs:0,damage:1}];
entities.fireballs=[{x:e.x,y:e.y,owner:e,ageMs:0,reflected:false}];
entities.coinCount=8;entities.goldCollected=10;
entities.resetRewindHistory();entities.captureRewind();
entities.enemies=[];entities.obstacles=[];entities.bullets=[];entities.fireballs=[];
entities.player.hp=1;entities.coinCount=0;entities.goldCollected=2;
entities.rewindClockMs=5100;entities.captureRewind();
assert.equal(entities.rewind(),true);
finishPlayback(entities);
assert.equal(entities.player.hp,3,'Health restored in snapshot');
assert.equal(entities.coinCount,8,'Gold returned to earlier value');
assert.equal(entities.goldCollected,10,'Score-related collected gold restored');
assert.equal(entities.enemies.length,1);assert.equal(entities.obstacles.length,1);
assert.equal(entities.bullets[0].ref,entities.enemies[0],'Projectile target relinked');
assert.equal(entities.fireballs[0].owner,entities.enemies[0],'Enemy projectile owner relinked');

const terrain=game(48);terrain.powerManager.apply('deathsReversal',terrain.player,()=>{},1);
terrain.powerManager.apply('brittleBones',terrain.player,()=>{},1);
const section=terrain.terrain.segments.find(s=>s.kind==='gap'&&s.start>terrain.startX+1600*C.pxPerMeter);
assert.ok(section,'Needs real procedural gap');
terrain.player.x=section.start-100;
terrain.player.y=terrain.terrain.anchorAt(terrain.player.x);
const original={kind:section.kind,y0:section.y0,y1:section.y1};
terrain.resetRewindHistory();terrain.captureRewind();
terrain.triggerBrittleBones();
assert.equal(section.kind,'rubble','Brittle Bones built a bridge');
terrain.rewindClockMs=5200;terrain.captureRewind();
assert.equal(terrain.rewind(),true);
finishPlayback(terrain);
assert.equal(section.kind,original.kind,'Rewind removes bridge built afterward');
assert.equal(section.y0,original.y0);
assert.equal(section.y1,original.y1);

const barriers=game(60);barriers.powerManager.apply('deathsReversal',barriers.player,()=>{},1);
barriers.rewindClockMs=6000;barriers.captureRewind();
const soulsBefore=barriers.meta.souls;
barriers.collectSoul();
assert.equal(barriers.meta.souls,soulsBefore+1);
assert.equal(barriers.rewind(),false,'Cannot rewind before a banked Soul');
assert.equal(barriers.meta.souls,soulsBefore+1,'Banked Souls never reversed');
barriers.triggerVendor(1);
assert.equal(barriers.state,'upgrade');
assert.equal(barriers.rewindFrames.length,0,'Vendor resets history');
barriers.leaveVendor();
assert.equal(barriers.rewind(),false);
barriers.player.x=barriers.startX+5000*C.pxPerMeter;
barriers.enterUnderworld();
assert.equal(barriers.state,'portal');
assert.equal(barriers.rewindFrames.length,0,'Portal resets history');
step(barriers,6,250);
assert.equal(barriers.state,'chest');
barriers.finishChest();
assert.equal(barriers.state,'playing');assert.equal(barriers.rewind(),false);

console.log('PASS v0.12.0: Angel tiers, God Mode level-4 override, snapshot rewind, non-rewindable cooldown, referenced projectiles, Brittle Bones terrain rollback, Soul/vendor/portal boundaries.');
