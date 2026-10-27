'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),html=read('index.html');
function node(){let n;n=new Proxy({textContent:'',disabled:false,style:{setProperty(){}},classList:{add(){},remove(){},toggle(){},contains(){return false}},addEventListener(){},setAttribute(){},appendChild(){},replaceChildren(){},destroy(){}},{get:(o,k)=>k in o?o[k]:(...args)=>n,set:(o,k,v)=>(o[k]=v,true)});return n;}
const els=new Map(),el=id=>{if(!els.has(id))els.set(id,node());return els.get(id);};
const w={document:{getElementById:el,createElement:node,write(){},addEventListener(){}},localStorage:{getItem(){return null},setItem(){}},Phaser:{Scene:class{},Game:class{},AUTO:1,Scale:{RESIZE:1,CENTER_BOTH:1}},location:{search:'?seed=33'},URLSearchParams,addEventListener(){},innerWidth:950,innerHeight:430};w.window=w;vm.createContext(w);
for(const [,attrs,body]of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!/\bsrc\s*=/.test(attrs))vm.runInContext(body,w);
const C=w.GRIM_CONFIG;
function game(){const s=new w.GrimGameScene();s.scale={width:950,height:430,on(){},off(){}};s.events={once(){}};s.add={graphics:node,text:node};s.cameras={main:{setScroll(){}}};s.create();s.drawScene=()=>{};s.startRun();return s;}
// Contact, rather than the merchant center or an airborne distance crossing,
// must own both types of first encounter.
for(const k of [1,8]){
 const s=game(),left=s.startX+(k*666-25)*12;s.hasTeleported=k>=8;s.shrineClaimed=true;s.nextVendorNumber=k;s.lastVendorNumber=k-1;
 s.player.x=left-15;s.player.y=s.terrain.groundAt(s.player.x);s.player.grounded=true;
 assert.equal(s.touchingVendorFloor(k),false);s.update(0,0);assert.equal(s.state,'playing');
 s.player.x=left+20;s.player.y=s.terrain.groundAt(s.player.x)-20;s.player.grounded=false;s.player.velocityY=0;
 s.update(0,0);assert.equal(s.state,'playing','Passing over floor does not snap the player down');
 s.player.y=s.terrain.groundAt(s.player.x)-1;s.player.velocityY=300;s.update(0,10);
 assert.equal(s.state,'vendorIntro');assert.equal(s.vendorIntroMs,3000);assert(s.player.grounded);
}
// The original cards survive purchase and healing. Currency/health effects
// remain independent, and no transaction reopens reward eligibility.
for(const k of [1,8]){
 const s=game();s.player.hp=3;s.player.maxHp=5;s.coinCount=24;s.triggerVendor(k);s.finishVendorIntro();
 const offers=s.pendingOffers,ids=offers.map(o=>o.id),offer=offers.find(o=>o.type==='power');assert(offer);
 s.chooseUpgrade(offer.id);assert.equal(s.state,'upgrade');assert.equal(s.pendingOffers,offers);assert.deepEqual(s.pendingOffers.map(o=>o.id),ids);assert.equal(s.vendorAcquiredId,offer.id);
 const before={gold:s.coinCount,hp:s.player.hp,level:s.powerManager.level(offer.id)};s.chooseUpgrade(offer.id);
 assert.deepEqual({gold:s.coinCount,hp:s.player.hp,level:s.powerManager.level(offer.id)},before);
 assert(s.healFromVendor());assert.equal(s.coinCount,before.gold-8);assert.equal(s.player.hp,before.hp+1);assert.equal(s.pendingOffers,offers);assert.equal(s.rerollVendor(),false);
}
// A real renderer delays only presentation of death; the world and game RNG
// stay frozen, and free/paid resurrection still have their original costs.
const life=game();life.combatArt={ready:{'reaper-hurt-death':true},reset(){},tick(){},snapshot(){return [];}};
life.freeLifeAvailable=true;life.player.hp=1;life.takeDamage(1,'rock');assert.equal(life.state,'dying');
const frozen={x:life.player.x,elapsed:life.elapsed,rng:life.rng.state};w.document.hidden=true;life.update(0,250);assert.equal(life.deathPoseMs,0);w.document.hidden=false;
for(let i=0;i<3;i++)life.update(0,250);assert.equal(life.state,'dying');assert.equal(life.freeLifeUsed,false);
assert.deepEqual({x:life.player.x,elapsed:life.elapsed,rng:life.rng.state},frozen);life.update(0,130);
assert.equal(life.state,'respawning');assert(life.freeLifeUsed);assert.equal(life.respawnMs,1500);assert.equal(life.respawnNextMode,'countdown');
life.state='playing';life.player.hp=1;life.takeDamage(1,'rock');for(const d of [250,250,250,130])life.update(0,d);assert.equal(life.state,'revive');
life.reviveUsed=true;life.state='playing';life.player.hp=1;life.takeDamage(1,'rock');for(const d of [250,250,250,130])life.update(0,d);assert.equal(life.state,'dead');
// Original source bytes and all runtime PNG chunks must survive export/push.
const m=JSON.parse(read('assets/combat/v0170/manifest.json'));
function crc32(b){let c=0xffffffff;for(const byte of b){c^=byte;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
for(const [group,folder]of [['sources','source/'],['runtime','']])for(const [name,meta]of Object.entries(m[group])){
 const b=fs.readFileSync(path.join(root,'assets/combat/v0170',folder+name));assert.equal(b.length,meta.bytes,name);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),meta.sha256,name);
 let p=8,idat=[],ended=false;while(p<b.length){const n=b.readUInt32BE(p),type=b.toString('ascii',p+4,p+8);assert(p+n+12<=b.length,name+' chunk boundary');assert.equal(crc32(b.subarray(p+4,p+n+8)),b.readUInt32BE(p+n+8),name+' '+type);if(type==='IDAT')idat.push(b.subarray(p+8,p+8+n));if(type==='IEND')ended=true;p+=n+12;}
 assert(ended&&p===b.length,name+' has complete IEND');assert.equal(b[25],6,name+' has true RGBA');assert(zlib.inflateSync(Buffer.concat(idat)).length>1000);
}
assert.equal(m.registration['bat-flight'].frames,16);assert(m.registration['reaper-slide-cut'].frames>=8);assert.equal(m.registration['reaper-crossbow'].frames,16);
const art={};art.window=art;vm.createContext(art);vm.runInContext(read('assets/combat/v0170/animation-data.js'),art);vm.runInContext(read('assets/visuals/combat-animations.js'),art);
const A=art.GRIM_COMBAT_ART,frames=new Set();for(let i=0;i<160;i++)frames.add(A.batMotion(i/160*A.BAT_CYCLE_SECONDS).a);assert.equal(frames.size,16);assert.equal(A.batMotion(A.BAT_CYCLE_SECONDS).a,0);
for(const count of [10,12]){assert.equal(A.attackFrame(.20,count),3);assert.equal(A.attackFrame(.79,count),count-4);assert.equal(A.attackFrame(1,count),count-1);}
const abyss=game();abyss.combatArt={ready:{'reaper-hurt-death':true},reset(){},tick(){},snapshot(){return [];}};
let scroll;abyss.cameras.main.setScroll=(x,y)=>{scroll=[x,y];};abyss.player.hp=1;abyss.player.x=abyss.terrain.sequences[0].startX+30;abyss.rescueFromAbyss();
assert.equal(abyss.state,'dying');assert.deepEqual(scroll,[abyss.cameraX,abyss.cameraY],'Lethal abyss defeat is visible at the safe recovery camera');
const fake={player:{visualHurtMs:340},enemies:[],add:{},terrain:{groundAt(){return 300;},anchorAt(){return 300;}}};
const v=new A.CombatAnimations(fake);const imp={kind:'imp',x:100,y:280};v.enemyHit(imp,false);assert.equal(imp.visualHitMs,240);assert.equal(v.corpses.length,0);
for(let i=0;i<20;i++)v.enemyHit({...imp,x:i*10},true);assert.equal(v.corpses.length,12);const saved=v.snapshot();v.tick(100);assert.equal(fake.player.visualHurtMs,240);assert(v.corpses.every(c=>c.age===100));v.restore(saved);assert(v.corpses.every(c=>c.age===0));v.tick(800);assert.equal(v.corpses.length,0);
console.log('PASS v0.17: floor-contact/airborne entry, persistent Angel/Devil cards and healing, 880ms frozen death before free/paid/results, complete source/runtime PNG CRC/SHA, 16-pose bat loop, detached bounded defeat views and rewind restore.');
