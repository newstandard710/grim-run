'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function node(){let n;n=new Proxy({style:{setProperty(){}},classList:{add(){},remove(){},toggle(){},contains(){return false}},
 addEventListener(){},setAttribute(){},appendChild(){},replaceChildren(){},destroy(){}},{get:(o,k)=>k in o?o[k]:(...args)=>n,set:(o,k,v)=>(o[k]=v,true)});return n;}
const nodes=new Map(),el=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
const w={document:{getElementById:el,createElement:node,write(){},addEventListener(){}},localStorage:{getItem(){return null},setItem(){}},
 Phaser:{Scene:class{},Game:class{},AUTO:1,Scale:{RESIZE:1,CENTER_BOTH:1}},location:{search:'?seed=33'},URLSearchParams,addEventListener(){},innerWidth:950,innerHeight:430};w.window=w;vm.createContext(w);
for(const [,attr,body]of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!/\bsrc\s*=/.test(attr))vm.runInContext(body,w);
const C=w.GRIM_CONFIG,Core=w.GRIM_CORE;
for(let seed=1;seed<=40;seed++){
 const terrain=w.GRIM_TERRAIN.makeTerrain(seed,339,200,C.pxPerMeter);
 for(let k=1;k<=14;k++){
  const x=200+k*666*12,y=terrain.groundAt(x);
  assert(Number.isFinite(y));
  for(let m=-25;m<=25;m+=2.5)assert(Math.abs(terrain.groundAt(x+m*12)-y)<.001,'Entire sanctuary is solid and level at seed '+seed+' vendor '+k+' offset '+m);
  assert(Core.intersectsVendorCorridor(x-25*12-20,40,200));
  assert(Core.intersectsVendorCorridor(x+25*12,20,200),'Existing post-vendor protection retained');
  assert(!Core.intersectsVendorCorridor(x+50*12,20,200));
 }
}
function game(){const g=new w.GrimGameScene();g.scale={width:950,height:430,on(){},off(){}};g.events={once(){}};g.add={graphics:node,text:node};g.cameras={main:{setScroll(){}}};g.create();g.drawScene=()=>{};g.startRun();return g;}
const g=game();g.player.attackCooldownMs=700;g.coinCount=16;g.player.hp=2;
for(let k=1;k<=14;k++){
 const begin=g.startX+(k*666-25)*12;
 assert(!Core.intersectsVendorCorridor(begin-110,74,g.startX),'Fixture collision is outside sanctuary');
 assert(g.vendorObstacleBlocked('branch',begin-110,74),'Painted hanging obstacle may not overhang sanctuary');
}
g.triggerVendor(1);assert.equal(g.state,'vendorIntro');assert.equal(g.vendorIntroMs,10000);
const before=JSON.stringify({x:g.player.x,hp:g.player.hp,coins:g.coinCount,elapsed:g.elapsed,offers:g.pendingOffers,cooldown:g.player.attackCooldownMs,rng:g.rng.state});
w.document.hidden=true;for(let i=0;i<8;i++)g.update(0,250);assert.equal(g.vendorIntroMs,10000);w.document.hidden=false;
for(let i=0;i<39;i++)g.update(0,250);assert.equal(g.state,'vendorIntro');assert.equal(g.vendorIntroMs,250);
assert.equal(JSON.stringify({x:g.player.x,hp:g.player.hp,coins:g.coinCount,elapsed:g.elapsed,offers:g.pendingOffers,cooldown:g.player.attackCooldownMs,rng:g.rng.state}),before,'Introduction freezes gameplay, choices and randomness');
g.update(0,250);assert.equal(g.state,'upgrade');assert.equal(g.vendorIntroMs,0);assert.equal(g.coinCount,16);
g.leaveVendor();g.triggerVendor(2);assert.equal(g.state,'upgrade','Only the first Angel encounter introduces itself');g.leaveVendor();
g.triggerVendor(8);assert.equal(g.state,'vendorIntro');const offers=JSON.stringify(g.pendingOffers),rng=g.rng.state;
g.finishVendorIntro();g.finishVendorIntro();assert.equal(g.state,'upgrade');assert.equal(JSON.stringify(g.pendingOffers),offers);assert.equal(g.rng.state,rng,'Skipping neither rerolls offers nor purchases');
g.leaveVendor();g.triggerVendor(9);assert.equal(g.state,'upgrade','Only the first Devil encounter introduces itself');
g.startRun();assert(!g.vendorIntroSeen.angel&&!g.vendorIntroSeen.devil);g.triggerVendor(1);assert.equal(g.state,'vendorIntro','New run resets introductions');
g.finishVendorIntro();g.leaveVendor();g.gunUnlocked=true;g.hasTeleported=true;
g.player.x=g.startX+8*666*12;g.player.y=g.terrain.groundAt(g.player.x);g.player.hp=3;
g.enemies=[{kind:'bat',x:g.player.x,y:g.player.y-40,dead:false}];
g.fireballs=[{x:g.player.x,y:g.player.y-40,ageMs:0,vx:0,vy:0,dead:false}];
g.updateCombat(34,.034);assert.equal(g.enemies.length,0);assert.equal(g.fireballs.length,0);assert.equal(g.player.hp,3,'Moving threats are removed before contact damage');
const visual={};visual.window=visual;vm.createContext(visual);
for(const [,src]of html.matchAll(/<script\s+src="([^"]+)"/g))if(/\/(?:vendor-art-data|vendor-sanctuaries|power-animations)\.js/.test(src))
 vm.runInContext(fs.readFileSync(path.join(root,src.split('?')[0]),'utf8'),visual);
assert(visual.GRIM_VENDOR_ART&&visual.GRIM_VENDOR_DATA,'Game HTML loads sanctuary renderer and registration data');
const A=visual.GRIM_POWER_ART,frames=new Set();
for(let ms=0;ms<3000;ms+=10)frames.add(visual.GRIM_VENDOR_ART.approachAt(ms/1000).frame);
assert.equal(frames.size,12);assert.equal(visual.GRIM_VENDOR_ART.approachAt(2.8).frame,11);
for(const t of [2.3,2.6,3,3.4])assert.equal(A.relicMotionAt(t).frame,15,'Body holds the overhead pose');
assert(A.relicMotionAt(2.9).glow>.99);assert.equal(A.relicMotionAt(4).glow,0);
assert.equal(visual.GRIM_VENDOR_DATA.relicGrips.length,24);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/vendors/v0152/manifest.json')));
for(const type of ['sources','runtime'])for(const[file,meta]of Object.entries(manifest[type])){
 const b=fs.readFileSync(path.join(root,file));assert.equal(b.length,meta.bytes);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),meta.sha256);
 assert.deepEqual([b.readUInt32BE(16),b.readUInt32BE(20)],meta.size);assert.equal(b[25],6,'Production sprites retain transparency');
}
console.log('PASS v0.15.2: 560 solid level sanctuaries, protected approaches, first-per-type ten-second introductions, frozen gameplay, safe skip/reset, threat exclusion, hold/glow and art integrity.');
