'use strict';
/* node tests/godmode-tools.cjs — zero external dependencies */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const store=new Map(),nodes=new Map();
function fakeNode(){let n;n=new Proxy({value:'5000',checked:false,disabled:false,textContent:'',style:{setProperty(){}},
 classList:{toggle(){},add(){},remove(){},contains(){return false}},addEventListener(){},setAttribute(){},appendChild(){},replaceChildren(){},destroy(){}},
 {get(o,k){return k in o?o[k]:(...args)=>n},set(o,k,v){o[k]=v;return true}});return n;}
const getNode=id=>{if(!nodes.has(id))nodes.set(id,fakeNode());return nodes.get(id)};
const s={document:{getElementById:getNode,createElement:fakeNode,addEventListener(){},write(){}},
 localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))},
 Phaser:{Scene:class{},Game:class{},AUTO:1,Scale:{RESIZE:1,CENTER_BOTH:1}},
 location:{search:'?seed=7'},URLSearchParams,innerWidth:950,innerHeight:430,addEventListener(){}};
s.window=s;vm.createContext(s);
for(const [,attrs,source] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))
 if(!/\bsrc\s*=/.test(attrs))vm.runInContext(source,s,{filename:'index.html'});
const C=s.GRIM_CONFIG;
assert.equal(C.version,'0.19.20');
assert.ok(html.includes('id="god-teleport-range"'));
assert.ok(html.includes('step="500"'), '500m increments are explicit');
function game(seed){
 s.location.search='?seed='+seed;
 const g=new s.GrimGameScene();
 g.scale={width:950,height:430,on(){},off(){}};
 g.events={once(){}};g.add={graphics:fakeNode,text:fakeNode};
 g.cameras={main:{setScroll(){}}};g.create();g.drawScene=()=>{};g.startRun();
 return g;
}
const run=game(100);
assert.equal(run.togglePracticeSlow(),false,'Cannot toggle slow time without God Mode');
run.setGodMode(true);
assert.equal(run.togglePracticeSlow(),true);
assert.equal(run.practiceSlow,true);
assert.equal(getNode('practice-slow-btn').title,'Tap for 25% speed');
assert.equal(run.togglePracticeSlow(),true);assert.equal(run.practiceScale(),.25);
assert.equal(run.togglePracticeSlow(),true);assert.equal(run.practiceScale(),0);
assert.equal(run.togglePracticeSlow(),true);assert.equal(run.practiceSlow,false);
run.togglePracticeSlow();run.setGodMode(false);
assert.equal(run.practiceSlow,false,'Disabling God Mode resets slow time');
const full=game(29),half=game(29);
for(const g of [full,half]){g.setGodMode(true);g.nextVendorNumber=15;g.lastVendorNumber=14;}
half.togglePracticeSlow();
for(let i=0;i<65;i++){full.update(0,30);half.update(0,30);}
const fullProgress=full.player.x-full.startX,slowProgress=half.player.x-half.startX;
assert.ok(slowProgress/fullProgress>.48&&slowProgress/fullProgress<.52,
 'Slow time must scale actual simulation movement by approximately 50%');
assert.ok(half.elapsed/full.elapsed>.48&&half.elapsed/full.elapsed<.52,
 'World animation/clock speed must also slow 50%');

const unauthorized=game(5);unauthorized.state='paused';
assert.equal(unauthorized.askTeleport(5000),false,'God Mode required');
unauthorized.setGodMode(true);
for(const invalid of [0,1,499,1001,9998,20001,20500]){
 assert.equal(unauthorized.askTeleport(invalid),false,'Invalid 500m step: '+invalid);
}
assert.equal(unauthorized.askTeleport(5000),true);
assert.equal(unauthorized.state,'teleportConfirm');
unauthorized.cancelTeleport();
assert.equal(unauthorized.state,'paused','Cancel remains paused');
assert.equal(unauthorized.pendingTeleport,null);

let checks=0;
for(const seed of [1,7,19,42,99,314,888,1999]){
 for(const meters of [500,1000,2500,4500,5000,5500,7500,9500,20000]){
  const g=game(seed);g.setGodMode(true);g.state='paused';g.ui.setMode('paused');
  assert.equal(g.askTeleport(meters),true);
  assert.equal(g.confirmTeleport(),true);
  assert.equal(g.state,'playing','Instantly resuming without countdown');
  assert.equal(g.countdownMs,0);
  assert.equal(g.teleportUsed,true);
  assert.ok(Math.abs(g.distance-meters)<=125,'Safe landing near requested destination');
  assert.equal(g.player.grounded,true);
  assert.ok(g.terrain.groundAt(g.player.x)!==null,'Solid ground at landing');
  assert.equal(g.hasTeleported,meters>=5000,'Biome/Underworld must match location');
  assert.equal(g.gunUnlocked,meters>=5000,'Crossbow available after portal');
  assert.equal(g.nextVendorNumber,Math.min(14,Math.floor(g.distance/C.vendorEveryMeters))+1,
   'Passed vendors must not re-open without an action, including beyond the final vendor');
  assert.equal(g.rewindFrames.length<=1,true,'Rewind history reset on teleport');
  assert.equal(g.enemies.length,0);
  assert.equal(g.fireballs.length,0);
  assert.equal(g.obstacles.length,0);
  g.update(0,34);
  assert.equal(g.state,'playing','No instant vendor/interstitial trigger on arrival');
  checks++;
 }
}
const currency=game(55);currency.setGodMode(true);currency.state='paused';
currency.askTeleport(9500);currency.confirmTeleport();
const walletBefore=currency.meta.souls;
currency.collectSoul();
assert.equal(currency.meta.souls,walletBefore,'Teleport-assisted Soul cannot increase durable wallet');
assert.equal(currency.runSoulsAvailable,0,'Teleport-assisted Soul cannot subsidize revival');
const best=game(1);
best.setGodMode(true);best.state='paused';best.askTeleport(9500);best.confirmTeleport();
best.points=999999;
best.finishDeath();
assert.equal(store.has('grim-run-v03-best'),false,'Teleport-assisted death cannot set personal best');
const victory=game(2);
victory.setGodMode(true);victory.state='paused';victory.askTeleport(9500);victory.confirmTeleport();
victory.completeRun();
assert.equal(store.has('grim-run-v03-best'),false,'Teleport-assisted victory cannot set personal best');

const editor=game(33);
editor.state='paused';
editor.ui.setMode('paused');
assert.equal(editor.canConfigurePowers(),false);
editor.setGodMode(true);
assert.equal(editor.canConfigurePowers(),true);
assert.equal(editor.setPracticePowerLevel('soulCleave',4),false,'An open editor is required');
editor.ui.abilitiesLauncher={};
const edit=(id,rank)=>assert.equal(editor.setPracticePowerLevel(id,rank),true,id+' rank '+rank);
const powers=s.GRIM_POWERS;
const powerIds=[...powers.POWER_ORDER,...powers.DEVIL_ORDER];
const lootBefore=JSON.stringify([editor.powerManager.eligible(),editor.powerManager.devilEligible()]);
const rngBefore=editor.rng.state;
for(const invalid of ['vitalEssence','soulMend','gravewingAscension','constructor','__proto__'])
 assert.equal(editor.setPracticePowerLevel(invalid,1),false);
for(const invalid of [-1,5,1.5,NaN,undefined,'1'])
 assert.equal(editor.setPracticePowerLevel('soulCleave',invalid),false);
assert.equal(editor.setPracticePowerLevel('rapidFire',4),false);
for(const id of powerIds)edit(id,editor.powerManager.maxFor(id));
assert.equal(editor.powerManager.attackBonus(),.65);
assert.equal(editor.powerManager.brittleRangeMeters(),300);
assert.equal(editor.powerManager.fireCooldownMs(),4000);
assert.equal(editor.powerManager.lavaDamage(),1);
assert.equal(editor.powerManager.slowEffect().durationMs,1550);
assert.equal(editor.rewindLevel(),4);
assert.equal(editor.rewindLengthMs(),8000);
assert.equal(editor.gunUnlocked,false,'Toggling gun abilities cannot unlock the weapon');
assert.equal(editor.powerManager.summary().length,9,'Two wings share one build entry');
assert.equal(JSON.stringify([editor.powerManager.eligible(),editor.powerManager.devilEligible()]),lootBefore);
assert.equal(editor.rng.state,rngBefore,'Ability edits do not consume gameplay RNG');
assert(powerIds.every(id=>editor.powerManager.levels[id]===0),'Overrides do not grant earned ranks');
assert.equal(editor.powerManager.apply('soulCleave',editor.player,()=>{},2),true);
edit('soulCleave',0);
assert.equal(editor.powerManager.level('soulCleave'),0);
assert.equal(editor.powerManager.levels.soulCleave,2,'Purchases remain earned behind an override');
edit('soulCleave',null);
assert.equal(editor.powerManager.level('soulCleave'),2);
assert.equal(editor.player.hp,C.startingHP);

const {hover:hoverId,extraJump:jumpId}=powers.WING_EFFECT_IDS;
assert.equal(hoverId,'ravenWings');
assert.equal(jumpId,'skeletalWings');
editor.player.grounded=false;
editor.player.hoverBudgetMs=850; // 900 ms already spent at rank 4.
editor.player.hovering=true;editor.player.jumpHeld=true;editor.player.hoverHoldMs=150;
editor.player.airJumpUsed=true;editor.player.jumpsUsed=2;editor.player.velocityY=0;
edit(hoverId,0);
assert.deepEqual([editor.player.hoverBudgetMs,editor.player.hovering,editor.player.jumpHeld,
 editor.player.hoverHoldMs,editor.player.velocityY],[0,false,false,0,0]);
edit(hoverId,1);
assert.equal(editor.player.hoverBudgetMs,0);
edit(hoverId,4);
assert.equal(editor.player.hoverBudgetMs,850,'Disable/enable cannot refresh hover');
editor.player.hoverBudgetMs-=250;
edit(hoverId,0);edit(hoverId,4);
assert.equal(editor.player.hoverBudgetMs,600,'Spent time survives multiple edits');
edit(jumpId,0);edit(jumpId,4);
assert.deepEqual([editor.player.airJumpUsed,editor.player.jumpsUsed],[true,2]);
editor.refillFlightHover();
assert.equal(editor.player.hoverBudgetMs,1750);
assert.equal(editor.player.practiceHoverSpentMs,undefined,'A new flight clears the debt');
const wingDeal=game(21);
wingDeal.setGodMode(true);
wingDeal.state='upgrade';wingDeal.vendorPhase='deal';wingDeal.vendorType='angel';
wingDeal.ui.abilitiesLauncher={};
assert(wingDeal.setPracticePowerLevel(hoverId,4));
wingDeal.player.grounded=false;
wingDeal.player.hoverBudgetMs=850;wingDeal.player.practiceHoverSpentMs=900;
wingDeal.coinCount=5;
wingDeal.pendingOffers=[wingDeal.powerManager.eligible().find(offer=>offer.id===hoverId)];
let purchaseCue;
wingDeal.powerArt={purchase:(id,rank)=>{purchaseCue=[id,rank];}};
wingDeal.chooseUpgrade(hoverId);
assert.deepEqual(purchaseCue,[hoverId,1],'Purchase cue reflects earned rank');
assert.equal(wingDeal.powerManager.levels[hoverId],1);
assert.equal(wingDeal.powerManager.level(hoverId),4);
assert.equal(wingDeal.coinCount,0);
assert.equal(wingDeal.player.hoverBudgetMs,850,'Buying a masked rank preserves remaining hover');
assert.equal(wingDeal.player.practiceHoverSpentMs,900);
wingDeal.ui.abilitiesLauncher={};
assert(wingDeal.setPracticePowerLevel(hoverId,null));
assert.equal(wingDeal.player.hoverBudgetMs,0,'Returning to earned rank keeps time already spent');


editor.player.slowMs=1400;editor.player.slowCooldownMs=2200;
editor.player.fireproofCooldownMs=3800;editor.gunCooldownMs=650;editor.blastCooldownMs=7000;
edit('deathsDelay',1);
assert.equal(editor.player.slowMs,800);
edit('deathsDelay',0);
assert.equal(editor.player.slowMs,0);
edit('infernalBoots',0);edit('infernalBoots',4);
edit('rapidFire',0);edit('powerShot',0);
assert.deepEqual([editor.player.slowCooldownMs,editor.player.fireproofCooldownMs,
 editor.gunCooldownMs,editor.blastCooldownMs],[2200,3800,650,7000]);

edit('deathsReversal',0);
assert.equal(editor.rewindLevel(),0);
edit('deathsReversal',1);
assert.equal(editor.rewindLengthMs(),5000);
editor.state='playing';
editor.captureRewind();
for(let i=0;i<49;i++)editor.tickRewind(100);
assert.equal(editor.rewind(),false,'A rank edit requires fresh history');
editor.tickRewind(100);
editor.rewindCooldownMs=21300;
assert.equal(editor.rewind(),true,'God Mode still bypasses recharge');
assert.equal(editor.setPracticePowerLevel('deathsReversal',4),false,'Playback owns its state');
editor.playRewindFrame(1800);
assert.equal(editor.state,'playing');
assert.equal(editor.rewindCooldownMs,21300,'Practice Rewind cannot erase a normal cooldown');
assert.equal(editor.rewindLevel(),1);

editor.state='paused';
editor.ui.setMode('paused');
editor.setGodMode(false);
assert.equal(editor.rewindLevel(),0);
assert.equal(editor.powerManager.level(hoverId),0);
editor.setGodMode(true);
assert.equal(editor.rewindLevel(),1);
assert.equal(editor.powerManager.level(hoverId),4);
assert.equal(editor.rewindFrames.length,0);
for(const phase of ['playing','vendorIntro','chest','portal','respawning','rewinding','revive','dying','dead','teleportConfirm']){
 editor.state=phase;
 assert.equal(editor.canConfigurePowers(),false,phase);
}
editor.state='upgrade';
editor.vendorPhase='deal';
assert.equal(editor.canConfigurePowers(),true);
editor.state='playing';
const wallet=editor.meta.souls;
assert.equal(editor.teleportUsed,false);
editor.collectSoul();
assert.equal(editor.meta.souls,wallet+1,'Ability overrides do not change existing wallet rules');
editor.distance=250;
editor.finishDeath();
assert.equal(editor.practicePowerLevels,null);
assert.equal(Number(store.get('grim-run-v03-best')),editor.points,'Existing personal-best rules still apply');
editor.startRun();
assert.equal(editor.godMode,false);
assert.equal(editor.practicePowerLevels,null);
assert(powerIds.every(id=>editor.powerManager.level(id)===0));

const sameRun=game(42);
sameRun.state='paused';
sameRun.setGodMode(true);
sameRun.ui.abilitiesLauncher={};
assert.equal(sameRun.setPracticePowerLevel('chainShot',2),true);
sameRun.ui.closeAbilities(false);
assert.equal(sameRun.askTeleport(500),true);
assert.equal(sameRun.confirmTeleport(),true);
assert.equal(sameRun.powerManager.level('chainShot'),2);
sameRun.startChest();
sameRun.togglePause();
assert.equal(sameRun.state,'chest');
sameRun.finishChest();
assert.equal(sameRun.state,'playing');
assert.equal(sameRun.powerManager.level('chainShot'),2);
sameRun.enterUnderworld();
sameRun.togglePause();
assert.equal(sameRun.state,'portal');
sameRun.finishPortal();
assert.equal(sameRun.state,'playing','Portal does not queue Pause');
assert.equal(sameRun.powerManager.level('chainShot'),2);
sameRun.setGodMode(false);
sameRun.resurrect();
assert.equal(sameRun.state,'respawning');
assert.equal(sameRun.powerManager.level('chainShot'),0);
assert.equal(sameRun.practicePowerLevels.chainShot,2,'Revival stays in the same run');
sameRun.goToMenu();
assert.equal(sameRun.practicePowerLevels,null);
console.log('PASS God Mode abilities: ranked pools, earned/effective separation, flight and rewind invariants, lifecycle and existing durable eligibility.');
console.log('PASS v0.13.6: 50% world speed, toggle guard, 500m selection, confirmation/cancel, '+checks+' teleports across eight seeds through 20,000m, skipped vendors, unchanged best scores.');
