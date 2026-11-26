'use strict';
// Exercise the live simulation and vendor rules with a headless scene.
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
function game(seed=78){
 w.location.search='?seed='+seed;
 const s=new w.GrimGameScene();
 s.scale={width:950,height:430,on(){},off(){}};
 s.events={once(){}};s.add={graphics:elem,text:elem};
 s.cameras={main:{setScroll(){}}};s.create();s.drawScene=()=>{};s.startRun();
 return s;
}
const step=(s,n,d=34)=>{for(let i=0;i<n;i++)s.update(0,d)};
function owned(){
  const s=game();
  assert.equal(s.startGraveRush(),false);
  assert(s.powerManager.eligible().some(offer=>offer.id==='graveRush'));
  s.powerManager.apply('graveRush',s.player);
  assert(!s.powerManager.eligible().some(offer=>offer.id==='graveRush'));
  assert(!s.powerManager.devilEligible().some(offer=>offer.id==='graveRush'));
  return s;
}
function launch(s){
  assert(s.startGraveRush());
  const target=s.graveRush.toX;
  assert.equal(s.startGraveRush(),false);
  for(let i=0;i<40&&s.graveRush;i++)s.update(0,1000/60);
  assert.equal(s.graveRush,null);
  assert.equal(s.player.grounded,true);
  assert.equal(s.player.y,s.terrain.groundAt(s.player.x));
  assert.equal(s.player.hp,3);
  return target;
}
const flat=owned(),start=flat.player.x;
assert.equal(launch(flat),start+C.rushMeters*C.pxPerMeter);
assert.equal(flat.startGraveRush(),false);
const charge=flat.rushCooldownMs;
flat.togglePause();step(flat,30);assert.equal(flat.rushCooldownMs,charge);
flat.startRun();assert.equal(flat.powerManager.level('graveRush'),0);
assert.equal(flat.rushCooldownMs,0);

const cluster=owned(),nominal=cluster.player.x+C.rushMeters*C.pxPerMeter;
const ground=cluster.terrain.groundAt(nominal);
const fire={type:'fire',x:nominal-8,y:ground-45,width:60,height:45};
const branch={type:'branch',x:nominal+76,y:ground-145,width:75,height:72};
cluster.obstacles.push(fire,branch);
cluster.fireballs.push({x:branch.x+branch.width+32,y:ground-40,vx:0,vy:0,ageMs:0});
assert.equal(launch(cluster),branch.x+branch.width+32+9+25);
assert(!branch.destroyed&&!fire.destroyed);

const fight=owned(),p=fight.player;
const enemy={kind:'crawler',x:p.x+104,y:p.y-46,hp:3};
fight.enemies.push(enemy);
launch(fight);assert.equal(enemy.hp,1,'One impact per enemy per dash');
const gap=owned(),opening=gap.terrain.segments.find(z=>z.kind==='gap');
gap.player.x=opening.start-130;
gap.player.y=gap.terrain.groundAt(gap.player.x);
assert(launch(gap)>opening.end+20);

const boss=owned();
boss.enemies.push({kind:'boss',x:boss.player.x+150,y:boss.player.y-40,hp:30});
assert.equal(boss.startGraveRush(),false);
assert.equal(boss.rushCooldownMs,0);
assert.equal(node('rush-status').textContent,'BOSS');
assert.equal(boss.enemies[0].hp,30);
boss.enemies[0].dead=true;assert(boss.startGraveRush());

const interlock=owned();
interlock.powerManager.apply('deathsReversal',interlock.player);
interlock.powerManager.apply('powerShot',interlock.player);
interlock.gunUnlocked=true;
step(interlock,170);
assert(interlock.startGraveRush());assert(!interlock.rewind());
assert(interlock.fireCrossbow());assert(interlock.bullets[0].flame);
step(interlock,9);assert(interlock.rewind());
const spent=interlock.rushCooldownMs;
while(interlock.state==='rewinding')interlock.update(0,100);
assert.equal(interlock.rushCooldownMs,spent);
assert.equal(interlock.startGraveRush(),false);

for(const [meters,expected] of [[666,'vendorIntro'],[4900,'chest'],[5000,'portal'],[9999,'won']]){
  const s=owned();
  s.nextVendorNumber=meters===666?1:15;
  s.shrineClaimed=meters>=5000;s.hasTeleported=meters>5000;
  s.player.x=s.startX+meters*C.pxPerMeter-100;
  s.player.y=s.terrain.groundAt(s.player.x);
  assert.equal(s.startGraveRush(),true,expected);
  for(let i=0;i<24&&s.state==='playing';i++)s.update(0,1000/60);
  assert.equal(s.state,expected);
}
console.log('PASS Grave Rush: acquisition, cooldown, pause, reset, fireball/solid cluster, gap, impact, boss guard, Rewind, Flame and mandatory encounters.');
