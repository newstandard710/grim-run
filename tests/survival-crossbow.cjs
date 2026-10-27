'use strict';
/* node tests/survival-crossbow.cjs - no dependencies */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let n=()=>{let z;z=new Proxy({textContent:'',disabled:false,style:{setProperty(){}},
  classList:{toggle(){},add(){},remove(){},contains(){return false}},
  addEventListener(){},setAttribute(){},appendChild(){},replaceChildren(){},destroy(){}},
  {get(o,k){return k in o?o[k]:(...a)=>z;},set(o,k,v){o[k]=v;return true}});return z};
const elems=new Map(),get=id=>{if(!elems.has(id))elems.set(id,n());return elems.get(id)};
const storage=new Map([['grim-run-v05-souls','60']]);
const w={document:{getElementById:get,createElement:n,addEventListener(){},write(){}},
  localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v))},
  Phaser:{Scene:class{},Game:class{},AUTO:1,Scale:{RESIZE:1,CENTER_BOTH:1}},
  location:{search:'?seed=22'},URLSearchParams,addEventListener(){},innerWidth:950,innerHeight:430};
w.window=w;vm.createContext(w);
for(const [,attrs,body] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
 if(!/\bsrc\s*=/.test(attrs))vm.runInContext(body,w,{filename:'index.html'});
}
const M=w.GRIM_META,C=w.GRIM_CONFIG,Combat=w.GRIM_COMBAT;
assert.equal(C.version,'0.15.1');
const wallet=M.load();assert.equal(wallet.souls,60);
assert.equal(wallet.levels.graveGlide,0);
for(const [lvl,cost] of [[1,5],[2,10],[3,25]]){
 const p=M.purchase(wallet,'graveGlide');assert.equal(p.ok,true);
 assert.equal(p.cost,cost);assert.equal(wallet.levels.graveGlide,lvl);
 assert.equal(M.slideDuration(850,wallet),850+lvl*150);
}
assert.equal(wallet.souls,20);assert.equal(M.load().levels.graveGlide,3);
assert.equal(M.purchase(wallet,'graveGlide').ok,false);
function game(seed=22){
 w.location.search='?seed='+seed;
 const s=new w.GrimGameScene();s.scale={width:950,height:430,on(){},off(){}};
 s.events={once(){}};s.add={graphics:n,text:n};s.cameras={main:{setScroll(){}}};
 s.create();s.drawScene=()=>{};s.startRun();return s;
}
const tick=(s,count,d=34)=>{for(let i=0;i<count;i++)s.update(0,d)};
const a=game();assert.equal(a.player.hp,3);assert.equal(a.gunUnlocked,false);
assert.equal(M.slideDuration(850,a.meta),1300);
a.collectSoul();a.collectSoul();const before=a.meta.souls;
a.player.maxHp=7;a.player.hp=1;
a.powerManager.apply('rapidFire',a.player,()=>{},1);
a.takeDamage(1,'rock');
assert.equal(a.state,'revive');assert.equal(get('revive-yes-btn').disabled,false);
assert.equal(a.revive(),true);assert.equal(a.state,'countdown');
assert.equal(a.player.hp,3);assert.equal(a.player.maxHp,3);
assert.equal(a.powerManager.level('rapidFire'),1,'Temporary power retained on revive');
assert.equal(a.lastRevivePayment.currentRun,2);assert.equal(a.lastRevivePayment.priorRuns,1);
assert.equal(a.runSoulsAvailable,0);assert.equal(a.meta.souls,before-3);
assert.equal(M.load().souls,before-3);assert.equal(a.revive(),false);
tick(a,13,250);assert.equal(a.state,'playing');
a.player.invulMs=0;a.takeDamage(3,'bat');assert.equal(a.state,'dead');

const b=game(23);
b.player.x=b.startX+4899*C.pxPerMeter;b.distance=4899;
b.player.slideConsumed=true;b.player.airJumpUsed=true;
b.nextVendorNumber=8;b.lastVendorNumber=7;b.godMode=true;
tick(b,4,34);assert.equal(b.state,'chest');assert.equal(b.distance,4900);
assert.equal(b.gunUnlocked,false);assert.equal(b.fireCrossbow(),false);
const shrineX=b.player.x,hp=b.player.hp,coins=b.coinCount;
tick(b,4,250);assert.equal(b.player.x,shrineX,'Shrine freezes world motion');
assert.equal(b.player.hp,hp);assert.equal(b.coinCount,coins);
b.finishChest();
assert.equal(b.state,'playing');assert.equal(b.gunUnlocked,true);
assert.equal(b.player.slideConsumed,false);assert.equal(b.player.airJumpUsed,false,'Shrine restores neutral input state');
assert.equal(b.fireCrossbow(),true,'Weapon is usable at 4900m, before the portal');
assert.equal(b.shrineClaimed,true);assert.equal(b.startChest(),false,'Reward cannot repeat');
b.player.x=b.startX+5000*C.pxPerMeter;b.distance=5000;b.enterUnderworld();
assert.equal(b.state,'portal');assert.equal(b.gunUnlocked,true,'Portal retains the shrine weapon');
assert.equal(b.fireCrossbow(),false);tick(b,6,250);
assert.equal(b.state,'playing','Portal resumes without another chest');
tick(b,40,34);assert.equal(b.bullets.length,0,'No automatic firing');
assert.equal(b.fireCrossbow(),true);assert.equal(b.bullets.length,1);
assert.equal(b.fireCrossbow(),false);assert.equal(b.gunCooldownMs,1000);
tick(b,30,34);assert.equal(b.fireCrossbow(),true);
b.powerManager.apply('rapidFire',b.player,()=>{},1);b.gunCooldownMs=0;
assert.equal(b.fireCrossbow(),true);assert.equal(b.gunCooldownMs,850);
const bat={kind:'bat',x:b.player.x+230,y:b.player.y-80,hp:1,dead:false,visibleMs:0};
const imp={kind:'imp',x:b.player.x+130,y:b.player.y-80,hp:2,dead:false,visibleMs:0};
b.enemies=[imp,bat];b.gunCooldownMs=0;
assert.equal(Combat.pickTarget(b.enemies,[],b.player.x,b.cameraX,b.cameraX+b.width,0,0).ref,bat);
b.fireCrossbow();assert.equal(b.bullets.at(-1).ref,bat);

const prior=game(26);prior.meta.souls=10;prior.player.hp=1;
prior.takeDamage(1,'rock');assert.equal(prior.revive(),true);
assert.equal(prior.lastRevivePayment.currentRun,0);
assert.equal(prior.lastRevivePayment.priorRuns,3);
const allNew=game(27);allNew.meta.souls=0;
allNew.collectSoul();allNew.collectSoul();allNew.collectSoul();allNew.player.hp=1;
allNew.takeDamage(1,'rock');assert.equal(allNew.revive(),true);
assert.equal(allNew.lastRevivePayment.currentRun,3);
assert.equal(allNew.lastRevivePayment.priorRuns,0);
assert.equal(allNew.meta.souls,0);
const auto=game(28);auto.player.x=auto.startX+4900*C.pxPerMeter;auto.distance=4900;
auto.nextVendorNumber=8;auto.lastVendorNumber=7;auto.startChest();
w.document.hidden=true;tick(auto,8,250);assert.equal(auto.chestMs,6000,'Hidden page cannot silently complete the scene');
w.document.hidden=false;
tick(auto,24,250);
assert.equal(auto.state,'playing','Shrine must auto-continue after its animation');
assert.equal(auto.gunUnlocked,true);
const poor=game(24);poor.meta.souls=2;poor.player.hp=1;poor.takeDamage(1,'rock');
assert.equal(poor.state,'revive');assert.equal(get('revive-yes-btn').disabled,true);
assert.equal(poor.revive(),false);poor.declineRevive();assert.equal(poor.state,'dead');
assert.equal(game(25).reviveUsed,false,'New run resets revive quota');
console.log('PASS v0.13.6: permanent slide tiers, legacy wallet, Soul revival, chest, manual crossbow and cooldowns.');
