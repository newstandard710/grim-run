'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),store=new Map(),nodes=new Map();
function node(){let n;n=new Proxy({textContent:'',disabled:false,style:{setProperty(){}},classList:{add(){},remove(){},toggle(){},contains(){return true}},addEventListener(){},setAttribute(){},appendChild(){},replaceChildren(){},destroy(){}},{get(o,k){return k in o?o[k]:(...args)=>n;},set(o,k,v){o[k]=v;return true;}});return n;}
const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
const w={document:{getElementById:get,createElement:node,write(){},addEventListener(){}},localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))},Phaser:{Scene:class{},Game:class{},AUTO:1,Scale:{RESIZE:1,CENTER_BOTH:1}},location:{search:'?seed=33'},URLSearchParams,addEventListener(){},innerWidth:950,innerHeight:430};w.window=w;vm.createContext(w);
for(const [,attrs,body]of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!/\bsrc\s*=/.test(attrs))vm.runInContext(body,w);
const M=w.GRIM_META,P=w.GRIM_POWERS,C=w.GRIM_CONFIG,Core=w.GRIM_CORE;
function game(levels={}){
 M.save(M.normalize({souls:100,levels}));const s=new w.GrimGameScene();s.scale={width:950,height:430,on(){},off(){}};s.events={once(){}};s.add={graphics:node,text:node};s.cameras={main:{setScroll(){}}};s.create();assert.equal(s.state,'home');assert(s.enterHome());assert.equal(s.state,'menu');assert.equal(s.enterHome(),false);s.drawScene=()=>{};s.startRun();return s;
}
const tick=(s,n,dt=250)=>{for(let i=0;i<n;i++)s.update(0,dt);};
function vendor(s,number){s.state='playing';s.triggerVendor(number);if(s.state==='vendorIntro')s.finishVendorIntro();assert.equal(s.state,'upgrade');}
// Old saves retain their purchases. Each definition owns its rank and price limits.
const old=M.normalize({souls:37,levels:{boneheart:2,graveWealth:3,deathsLeap:1,graveGlide:2}});
assert.equal(old.levels.graveWealth,3);assert.equal(old.levels.fatesBargain,0);assert.equal(old.levels.deathDenied,0);assert.equal(M.startingGold(old),6);
assert.equal(M.DEFINITIONS.filter(d=>d.id==='graveWealth').length,1);assert.equal(M.DEFINITIONS.length,6);
const account=M.normalize({souls:300,levels:{}});
for(const d of M.DEFINITIONS){for(let i=1;i<d.amounts.length;i++){const bought=M.purchase(account,d.id);assert.equal(bought.ok,true);assert.equal(bought.cost,(d.costs||M.COSTS)[i-1]);}assert.equal(M.purchase(account,d.id).ok,false);}
assert.equal(account.souls,85);assert.equal(M.investedSouls(account),215);assert.equal(account.levels.deathDenied,1);
assert.equal(M.load().levels.deathDenied,1);assert.equal(M.refundAll(account).ok,true);assert.equal(account.souls,299);assert.equal(M.investedSouls(account),0);
const poor=M.normalize({souls:14});assert.equal(M.purchase(poor,'deathDenied').ok,false);assert.equal(poor.souls,14);
// Both orderings of reward and healing, repeat healing, skip and insufficient funds.
for(const healFirst of [true,false]){
 const s=game();s.coinCount=21;s.player.hp=1;vendor(s,1);const offer=s.pendingOffers.find(v=>v.type==='power');assert(offer);
 if(healFirst){assert(s.healFromVendor());assert.equal(s.coinCount,13);assert.equal(s.player.hp,2);}
 s.chooseUpgrade(offer.id);assert.equal(s.state,'upgrade');assert.equal(s.vendorPurchased,true);assert.equal(s.powerManager.level(offer.id),offer.levelsGained||1);
 const remaining=s.coinCount;s.chooseUpgrade(offer.id);assert.equal(s.coinCount,remaining,'One reward per visit');
 while(s.player.hp<s.player.maxHp&&s.coinCount>=8)assert(s.healFromVendor());
 assert.equal(s.player.hp,3);assert.equal(s.coinCount,0);assert.equal(s.healFromVendor(),false);s.leaveVendor();assert.equal(s.state,'playing');
}
const healOnly=game();healOnly.coinCount=8;healOnly.player.hp=1;vendor(healOnly,1);assert(healOnly.healFromVendor());assert.equal(healOnly.player.hp,2);assert.equal(healOnly.vendorPurchased,false);assert.equal(healOnly.healFromVendor(),false);healOnly.leaveVendor();
const skip=game();vendor(skip,1);const skipped=skip.coinCount;skip.leaveVendor();assert.equal(skip.coinCount,skipped);
const full=game();full.coinCount=20;vendor(full,1);assert.equal(full.healFromVendor(),false);assert.equal(full.coinCount,20);
// One pool spans Angel and Devil merchants; rerolls are fresh and not refunded by Rewind.
const reroll=game({fatesBargain:3,graveWealth:3,deathDenied:1});assert.equal(reroll.coinCount,6);assert.equal(reroll.goldCollected,0);assert.equal(reroll.points,0);
vendor(reroll,1);const first=reroll.pendingOffers.map(v=>v.id),gold=reroll.coinCount,hp=reroll.player.hp;assert(reroll.rerollVendor());assert.equal(reroll.rerollsRemaining,2);assert(reroll.pendingOffers.every(v=>!first.includes(v.id)));assert.equal(reroll.coinCount,gold);assert.equal(reroll.player.hp,hp);
reroll.leaveVendor();vendor(reroll,8);assert.equal(reroll.rerollsRemaining,2);assert(reroll.rerollVendor());assert.equal(reroll.rerollsRemaining,1);assert(reroll.pendingOffers.some(v=>P.GUN_IDS.includes(v.id)));assert(reroll.pendingOffers.every(v=>v.rarity==='common'&&v.levelsGained===1));
assert(reroll.rerollVendor());assert.equal(reroll.rerollVendor(),false);assert.equal(reroll.rerollsRemaining,0);reroll.leaveVendor();reroll.state='playing';reroll.takeDamage(3,'rock');assert(reroll.freeLifeUsed);assert.equal(reroll.rerollsRemaining,0);
const locked=game({fatesBargain:1});vendor(locked,1);locked.coinCount=5;locked.chooseUpgrade(locked.pendingOffers.find(v=>v.type==='power').id);assert.equal(locked.rerollVendor(),false);assert.equal(locked.rerollsRemaining,1);
const empty=game({fatesBargain:1});for(const id of P.POWER_ORDER)empty.powerManager.apply(id,empty.player,()=>{},4);empty.player.maxHp=P.HEALTH_CAP;empty.player.hp=P.HEALTH_CAP;vendor(empty,1);assert.equal(empty.rerollVendor(),false);assert.equal(empty.rerollsRemaining,1);
// Free death, paid death, third death; both formation scenes freeze gameplay then count down.
const life=game({deathDenied:1,fatesBargain:2});life.powerManager.apply('rapidFire',life.player,()=>{},1);const bank=life.meta.souls;life.takeDamage(3,'rock');assert.equal(life.state,'respawning');assert.equal(life.meta.souls,bank);assert(life.freeLifeUsed);assert.equal(life.reviveUsed,false);assert.equal(life.player.hp,3);assert.equal(life.player.invulMs,2300);
const frozen={x:life.player.x,elapsed:life.elapsed,invul:life.player.invulMs,rng:life.rng.state};w.document.hidden=true;life.update(0,250);assert.equal(life.respawnMs,1500);w.document.hidden=false;tick(life,5);assert.equal(life.state,'respawning');assert.equal(life.player.x,frozen.x);assert.equal(life.elapsed,frozen.elapsed);assert.equal(life.player.invulMs,frozen.invul);assert.equal(life.rng.state,frozen.rng);tick(life,1);assert.equal(life.state,'countdown');tick(life,12);assert.equal(life.state,'playing');
life.player.invulMs=0;life.takeDamage(3,'rock');assert.equal(life.state,'revive');assert(life.revive());assert.equal(life.state,'respawning');assert.equal(life.meta.souls,bank-3);assert.equal(life.lastResurrection,'paid');assert.equal(life.powerManager.level('rapidFire'),1);tick(life,18);assert.equal(life.state,'playing');life.player.invulMs=0;life.takeDamage(3,'rock');assert.equal(life.state,'dead');life.startRun();assert.equal(life.freeLifeUsed,false);assert.equal(life.rerollsRemaining,2);
// A lethal chasm must not overwrite the shared resurrection with surviving-fall timers.
const fall=game({deathDenied:1});fall.player.hp=1;fall.player.x=fall.terrain.sequences[0].startX+40;fall.player.y=fall.terrain.anchorAt(fall.player.x)+500;fall.rescueFromAbyss();assert.equal(fall.state,'respawning');assert.equal(fall.respawnNextMode,'countdown');assert.equal(fall.player.hp,3);assert.equal(fall.player.invulMs,2300);assert.equal(fall.meta.souls,100);
// Distance curve is continuous at 5km and cannot accelerate again after teleport/resurrection.
assert.equal(Core.runSpeed(-100),282);assert.equal(Core.runSpeed(0),282);assert.equal(Core.runSpeed(2500),373.5);assert.equal(Core.runSpeed(5000),465);for(const m of [5001,6666,9999,20000])assert.equal(Core.runSpeed(m),465);assert(Math.abs(Core.runSpeed(5000)-Core.runSpeed(4999))<.04);
console.log('PASS Beyond Death: six upgrades, old-save migration, 15-Soul single rank, exact 215-Soul refund, Angel purchase/heal permutations, shared fresh rerolls and exhausted pool, 3→2→1→0 quotas, free/paid/third death, lethal chasm, frozen smoke + countdown, 5km acceleration plateau.');
