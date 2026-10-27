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
assert.equal(C.version,'0.15.0');
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
assert.equal(getNode('practice-slow-btn').title,'Return to normal speed');
assert.equal(run.togglePracticeSlow(),true);
assert.equal(run.practiceSlow,false);
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
console.log('PASS v0.13.6: 50% world speed, toggle guard, 500m selection, confirmation/cancel, '+checks+' teleports across eight seeds through 20,000m, skipped vendors, unchanged best scores.');
