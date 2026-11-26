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
function defeat(s){
 assert.equal(s.state,'dying');
 tick(s,9);s.update(0,149);assert.equal(s.state,'dying');s.update(0,1);
}
function vendor(s,number){s.state='playing';s.triggerVendor(number);if(s.state==='vendorIntro')s.finishVendorIntro();assert.equal(s.state,'upgrade');}
// Old saves retain their purchases. Each definition owns its rank and price limits.
const old=M.normalize({souls:37,levels:{boneheart:2,graveWealth:3,deathsLeap:1,graveGlide:2}});
assert.equal(old.levels.graveWealth,3);assert.equal(old.levels.fatesBargain,0);assert.equal(old.levels.deathDenied,0);assert.equal(M.startingGold(old),6);
assert.equal(M.DEFINITIONS.filter(d=>d.id==='graveWealth').length,1);assert.equal(M.DEFINITIONS.length,7);
const account=M.normalize({souls:300,levels:{}});
for(const d of M.DEFINITIONS){for(let i=1;i<d.amounts.length;i++){const bought=M.purchase(account,d.id);assert.equal(bought.ok,true);assert.equal(bought.cost,(d.costs||M.COSTS)[i-1]);}assert.equal(M.purchase(account,d.id).ok,false);}
assert.equal(account.souls,80);assert.equal(M.investedSouls(account),220);assert.equal(account.levels.deathDenied,1);
assert.equal(account.levels.soulReach,1);
assert.equal(account.equipped.length,6);
assert.equal(M.setEquipped(account,'soulReach',true),false);
assert.equal(M.activeLoadout(account).levels.soulReach,0);
assert(M.setEquipped(account,'graveWealth',false));
assert(M.setEquipped(account,'soulReach',true));
assert.equal(M.activeLoadout(M.load()).levels.soulReach,1);
assert.equal(M.load().levels.deathDenied,1);assert.equal(M.refundAll(account).ok,true);assert.equal(account.souls,299);assert.equal(M.investedSouls(account),0);
const poor=M.normalize({souls:14});assert.equal(M.purchase(poor,'deathDenied').ok,false);assert.equal(poor.souls,14);
// Owned levels and selected effects have distinct lifetimes.
const legacy={version:1,souls:40,levels:{boneheart:2,deathsLeap:2,deathDenied:1},openingSouls:4,brambleSouls:3};
store.set(M.KEY,JSON.stringify(legacy));
const loadout=M.load();
assert.equal(M.SLOT_LIMIT,6);
assert.deepEqual([...loadout.equipped],['boneheart','deathsLeap','deathDenied']);
assert.equal(M.setEquipped(loadout,'graveWealth',true),false);
assert.equal(M.setEquipped(loadout,'missing',true),false);
for(const id of [...loadout.equipped])assert(M.setEquipped(loadout,id,false));
assert.deepEqual([...M.load().equipped],[]);
assert.equal(M.load().souls,40);
assert.equal(M.activeLoadout(loadout).levels.deathsLeap,0);
assert(M.purchase(loadout,'deathsLeap').ok);
assert.equal(loadout.levels.deathsLeap,3);
assert.equal(loadout.equipped.includes('deathsLeap'),false);
assert(M.purchase(loadout,'graveWealth').ok);
assert.deepEqual([...M.load().equipped],['graveWealth']);
const normalized=M.normalize({...loadout,equipped:['graveGlide','deathsLeap','deathsLeap','unknown']});
assert.deepEqual([...normalized.equipped],['deathsLeap']);
assert(M.refundAll(loadout).ok);
assert.deepEqual([...M.load().equipped],[]);
assert.equal(M.load().openingSouls,4);
assert.equal(M.load().brambleSouls,3);
const mixed=game({boneheart:2,graveWealth:2,deathsLeap:2,graveGlide:2,fatesBargain:2,deathDenied:1});
assert.equal(mixed.meta.equipped.length,6);
assert.equal(mixed.setMetaEquipped('deathDenied',false),false,'A run locks the loadout');
mixed.goToMenu();mixed.openReliquary();
for(const id of ['boneheart','deathDenied','fatesBargain'])assert(mixed.setMetaEquipped(id,false));
mixed.closeReliquary();mixed.startRun();
assert.equal(mixed.player.maxHp,3);assert.equal(mixed.coinCount,4);
assert.equal(mixed.rerollsRemaining,0);assert.equal(mixed.freeLifeAvailable,false);
mixed.takeDamage(3,'rock');defeat(mixed);assert.equal(mixed.state,'revive');
assert(mixed.revive());assert.equal(mixed.meta.souls,97);
assert.equal(mixed.rerollsRemaining,0);assert.equal(mixed.freeLifeAvailable,false);
mixed.startRun();assert.equal(mixed.rerollsRemaining,0);assert.equal(mixed.freeLifeAvailable,false);
// Only a jumping Reaper gets extra vertical reach. Horizontal aim and Gold use their original bounds.
for(const enabled of [false,true]){
 const s=game({soulReach:Number(enabled)}),p=s.player;
 for(const [dx,dy,grounded,expected] of [
   [0,40,false,true],[0,41,false,enabled],[33,-58,false,enabled],
   [0,59,false,false],[34,0,false,false],[0,45,true,false]
 ]){
   p.grounded=grounded;
   const placed={x:p.x+dx,baseY:p.y-43+dy,offset:0,taken:false};
   s.souls=[{...placed}];s.coins=[{...placed}];
   s.checkCollectibles();
   assert.equal(s.souls[0].taken,expected);
   assert.equal(s.coins[0].taken,Math.abs(dx)<34&&Math.abs(dy)<41);
 }
 const persistent=s.meta.souls;
 s.checkCollectibles();
 assert.equal(s.meta.souls,persistent);
}
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
// Comparisons, quotes and outcomes use the same capped ranks and live HP.
const rankCheck=game();
const snapshot=s=>JSON.stringify({player:s.player,gold:s.coinCount,offers:s.pendingOffers,levels:s.powerManager.levels,
  rng:s.rng.state,rewind:s.rewindFrames,rerolls:s.rerollsRemaining,purchased:s.vendorPurchased,save:[...store]});
const raven=rankCheck.powerManager.eligible().find(o=>o.id==='ravenWings');
const rare=P.addRarity(raven,{next:()=>.05});
assert.equal(rare.levelTo,2);assert.match(P.compareOffer(rare,rankCheck.player).join(' '),/0 s → 1\.05 s/);
rankCheck.powerManager.levels.ravenWings=3;
const capped=P.addRarity(rankCheck.powerManager.eligible().find(o=>o.id==='ravenWings'),{next:()=>0});
assert.equal(capped.levelsGained,1);assert.equal(capped.levelTo,4);
assert.match(P.compareOffer(capped,rankCheck.player).join(' '),/1\.40 s → 1\.75 s/);
for(const id of [...P.POWER_ORDER,...P.DEVIL_ORDER]){
 const cap=rankCheck.powerManager.maxFor(id);
 for(let rank=0;rank<=cap;rank++)assert.equal(P.describePowerRank(id,rank).rank,rank);
 assert.equal(P.describePowerRank(id,cap+1),null);
}
assert.equal(P.describePowerRank('gravewingAscension',1),null);
rankCheck.coinCount=4;vendor(rankCheck,1);
rankCheck.pendingOffers=[capped];rankCheck.showVendor();
let frozenOffer=snapshot(rankCheck);
rankCheck.chooseUpgrade('ravenWings');rankCheck.chooseUpgrade('ravenWings');
assert.equal(snapshot(rankCheck),frozenOffer);assert.match(get('vendor-feedback').textContent,/Not enough gold.*You have 4/);
rankCheck.coinCount=5;rankCheck.chooseUpgrade('ravenWings');
assert.equal(rankCheck.player.hoverBudgetMs,1750);assert.equal(rankCheck.coinCount,0);
assert.equal(get('vendor-feedback').textContent,'');rankCheck.leaveVendor();
rankCheck.player.hp=2;rankCheck.coinCount=7;vendor(rankCheck,8);
rankCheck.pendingOffers=[rankCheck.powerManager.devilEligible().find(o=>o.id==='skeletalWings')];rankCheck.showVendor();
frozenOffer=snapshot(rankCheck);rankCheck.chooseUpgrade('skeletalWings');
assert.equal(snapshot(rankCheck),frozenOffer);assert.match(get('vendor-feedback').textContent,/Not enough health.*keep 1 HP/);
assert.equal(rankCheck.healFromVendor(),false);assert.match(get('vendor-feedback').textContent,/Need 8 gold/);
assert.equal(snapshot(rankCheck),frozenOffer);rankCheck.coinCount=8;assert(rankCheck.healFromVendor());
rankCheck.chooseUpgrade('skeletalWings');assert.equal(rankCheck.player.hp,1);assert.equal(rankCheck.coinCount,0);
assert.equal(rankCheck.powerManager.secondJumpVelocity(),-610);
assert.equal(rankCheck.powerManager.level('ravenWings'),4);assert.equal(rankCheck.powerManager.level('skeletalWings'),1);
const healing=game();healing.coinCount=13;Object.assign(healing.player,{hp:8,maxHp:9});vendor(healing,1);
const mend={...P.FALLBACKS.soulMend,type:'recovery'},essence={...P.HEALTH,type:'health'};
healing.pendingOffers=[mend,essence];healing.showVendor();
for(const o of healing.pendingOffers)assert.match(P.compareOffer(o,healing.player).join(' '),/8\/9 → 9\/9 HP/);
assert(healing.healFromVendor());frozenOffer=snapshot(healing);
for(const o of healing.pendingOffers)healing.chooseUpgrade(o.id);
assert.equal(snapshot(healing),frozenOffer);assert.match(get('vendor-feedback').textContent,/Health is already full/);
// One pool spans Angel and Devil merchants; rerolls are fresh and not refunded by Rewind.
const reroll=game({fatesBargain:3,graveWealth:3,deathDenied:1});assert.equal(reroll.coinCount,6);assert.equal(reroll.goldCollected,0);assert.equal(reroll.points,0);
vendor(reroll,1);const first=reroll.pendingOffers.map(v=>v.id),gold=reroll.coinCount,hp=reroll.player.hp;assert(reroll.rerollVendor());assert.equal(reroll.rerollsRemaining,2);assert(reroll.pendingOffers.every(v=>!first.includes(v.id)));assert.equal(reroll.coinCount,gold);assert.equal(reroll.player.hp,hp);
reroll.leaveVendor();vendor(reroll,8);assert.equal(reroll.rerollsRemaining,2);assert(reroll.rerollVendor());assert.equal(reroll.rerollsRemaining,1);assert(reroll.pendingOffers.some(v=>P.GUN_IDS.includes(v.id)));assert(reroll.pendingOffers.every(v=>v.rarity==='common'&&v.levelsGained===1));
assert(reroll.rerollVendor());assert.equal(reroll.rerollVendor(),false);assert.equal(reroll.rerollsRemaining,0);reroll.leaveVendor();reroll.state='playing';reroll.takeDamage(3,'rock');defeat(reroll);assert(reroll.freeLifeUsed);assert.equal(reroll.rerollsRemaining,0);
const locked=game({fatesBargain:1});vendor(locked,1);locked.coinCount=5;locked.chooseUpgrade(locked.pendingOffers.find(v=>v.type==='power').id);assert.equal(locked.rerollVendor(),false);assert.equal(locked.rerollsRemaining,1);
const empty=game({fatesBargain:1});for(const id of P.POWER_ORDER)empty.powerManager.apply(id,empty.player,()=>{},4);empty.player.maxHp=P.HEALTH_CAP;empty.player.hp=P.HEALTH_CAP;vendor(empty,1);assert.equal(empty.rerollVendor(),false);assert.equal(empty.rerollsRemaining,1);
// Free death, paid death, third death; both formation scenes freeze gameplay then count down.
const life=game({deathDenied:1,fatesBargain:2});life.powerManager.apply('rapidFire',life.player,()=>{},1);const bank=life.meta.souls;life.takeDamage(3,'rock');defeat(life);assert.equal(life.state,'respawning');assert.equal(life.meta.souls,bank);assert(life.freeLifeUsed);assert.equal(life.reviveUsed,false);assert.equal(life.player.hp,3);assert.equal(life.player.invulMs,2300);
const frozen={x:life.player.x,elapsed:life.elapsed,invul:life.player.invulMs,rng:life.rng.state};w.document.hidden=true;life.update(0,250);assert.equal(life.respawnMs,1500);w.document.hidden=false;tick(life,5);assert.equal(life.state,'respawning');assert.equal(life.player.x,frozen.x);assert.equal(life.elapsed,frozen.elapsed);assert.equal(life.player.invulMs,frozen.invul);assert.equal(life.rng.state,frozen.rng);tick(life,1);assert.equal(life.state,'countdown');tick(life,12);assert.equal(life.state,'playing');
life.player.invulMs=0;life.takeDamage(3,'rock');defeat(life);assert.equal(life.state,'revive');assert(life.revive());assert.equal(life.state,'respawning');assert.equal(life.meta.souls,bank-3);assert.equal(life.lastResurrection,'paid');assert.equal(life.powerManager.level('rapidFire'),1);tick(life,18);assert.equal(life.state,'playing');life.player.invulMs=0;life.takeDamage(3,'rock');defeat(life);assert.equal(life.state,'dead');life.startRun();assert.equal(life.freeLifeUsed,false);assert.equal(life.rerollsRemaining,2);
// A lethal chasm must not overwrite the shared resurrection with surviving-fall timers.
const fall=game({deathDenied:1});fall.player.hp=1;fall.player.x=fall.terrain.sequences[0].startX+40;fall.player.y=fall.terrain.anchorAt(fall.player.x)+500;fall.rescueFromAbyss();defeat(fall);assert.equal(fall.state,'respawning');assert.equal(fall.respawnNextMode,'countdown');assert.equal(fall.player.hp,3);assert.equal(fall.player.invulMs,2300);assert.equal(fall.meta.souls,100);
// Distance curve is continuous at 5km and cannot accelerate again after teleport/resurrection.
assert.equal(Core.runSpeed(-100),300);assert.equal(Core.runSpeed(0),300);assert.equal(Core.runSpeed(2500),362.5);assert.equal(Core.runSpeed(5000),425);for(const m of [5001,6666,9999,20000])assert.equal(Core.runSpeed(m),425);assert(Math.abs(Core.runSpeed(5000)-Core.runSpeed(4999))<.04);
console.log('PASS Beyond Death: seven upgrades, old-save migration, 15-Soul single rank, exact 220 invested Souls, Angel purchase/heal permutations, shared fresh rerolls and exhausted pool, 3→2→1→0 quotas, free/paid/third death, lethal chasm, frozen smoke + countdown, 5km acceleration plateau.');

// Exercise the real collision callers. Some assign invulnerability immediately before the HP debit.
function checkDamage(scene,label,action,loss){
  const pulses=[],before=scene.player.hp;
  w.navigator={vibrate(ms){pulses.push([ms,scene.player.hp,scene.state]);return true;}};
  action();
  assert.equal(scene.player.hp,before-loss,label+' HP');
  assert.deepEqual(pulses,loss?[[30,before-loss,'playing']]:[],label+' device requests');
}
const contact=game(),player=contact.player;
function hazard(type,offset=0){
  contact.obstacles=[Core.obstacle(type,player.x+offset,player.y,0,C.slideClearancePx,contact.height)];
}
hazard('branch',100);
checkDamage(contact,'near miss',()=>contact.checkHazards(),0);
hazard('branch');
checkDamage(contact,'grounded Slide',()=>{contact.startSlide();contact.checkHazards();contact.endSlide();},0);
player.sliding=false;
checkDamage(contact,'standing contact',()=>{contact.checkHazards();contact.checkHazards();},1);
hazard('rock');
checkDamage(contact,'different hazard during immunity',()=>contact.checkHazards(),0);
player.invulMs=0;
checkDamage(contact,'new contact after immunity',()=>contact.checkHazards(),1);
contact.godMode=true;
hazard('rock');
checkDamage(contact,'God Mode feedback',()=>contact.checkHazards(),0);
assert(contact.damageFlashMs>0);
contact.godMode=false;
checkDamage(contact,'zero damage',()=>contact.takeDamage(0,'rock'),0);

const combat=game(),body=combat.player;
combat.gunUnlocked=true;
function fireball(){combat.fireballs=[{x:body.x,y:body.y-25,vx:0,vy:0,ageMs:0}];}
fireball();
checkDamage(combat,'projectile',()=>combat.updateCombat(16,0),1);
body.invulMs=0;
combat.enemies=[{kind:'crawler',x:body.x,y:body.y,hp:1}];
checkDamage(combat,'enemy body',()=>combat.updateCombat(16,0),1);
combat.powerManager.apply('infernalBoots',body,()=>{});
body.invulMs=0;fireball();
checkDamage(combat,'blocked projectile',()=>combat.updateCombat(16,0),0);
body.fireproofCooldownMs=0;body.invulMs=0;
combat.obstacles=[Core.obstacle('fire',body.x,body.y)];
checkDamage(combat,'blocked ground fire',()=>combat.checkHazards(),0);
for(const [meters,hp,loss] of [[200,3,1],[8500,3,2],[8500,1,1]]){
  const fall=game();
  fall.distance=meters;fall.player.hp=hp;
  fall.player.x=fall.terrain.sequences[0].startX+30;
  checkDamage(fall,'fall at '+meters+' m from '+hp+' HP',()=>fall.rescueFromAbyss(),loss);
  assert.equal(fall.state,hp===loss?'dying':'respawning');
}
const other=game(),silent=[];
w.navigator={vibrate(ms){silent.push(ms);return true;}};
other.powerManager.apply('deathsReversal',other.player,()=>{});
other.captureRewind();
const saved=other.rewindFrames.at(-1);
other.collectSoul();vendor(other,8);
other.pendingOffers=[other.powerManager.devilEligible().find(o=>o.id==='skeletalWings')];
other.chooseUpgrade('skeletalWings');
assert.equal(other.player.hp,1,'Devil price was paid');
other.applyRewindSnapshot(saved);
assert.equal(other.player.hp,3,'rewind restored health');
assert.deepEqual(silent,[],'purchases, pickups and rewind restoration are silent');

for(const api of [undefined,{}, {vibrate(){return false;}}, {vibrate(){throw Error('unavailable');}}]){
  w.navigator=api;
  const run=game();
  assert(run.takeDamage(1,'fireball'));assert.equal(run.player.hp,2);
  assert(run.takeDamage(3,'lava'));assert.equal(run.player.hp,0);
  defeat(run);assert.equal(run.state,'revive');
}
console.log('PASS damage pulses: all four damage routes, immunity, zero damage, 2 HP and lethal falls, silent vendor/rewind and browser failures.');
