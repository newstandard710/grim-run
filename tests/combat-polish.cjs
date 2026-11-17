'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),html=read('index.html');
function node(){let n;n=new Proxy({textContent:'',disabled:false,style:{setProperty(){}},classList:{add(){},remove(){},toggle(){},contains(){return false}},addEventListener(){},setAttribute(){},appendChild(){},replaceChildren(){},destroy(){}},{get:(o,k)=>k in o?o[k]:(...args)=>n,set:(o,k,v)=>(o[k]=v,true)});return n;}
const els=new Map(),el=id=>{if(!els.has(id))els.set(id,node());return els.get(id);};
const w={document:{getElementById:el,createElement:node,write(){},addEventListener(){}},localStorage:{getItem(){return null},setItem(){}},Phaser:{Scene:class{},Game:class{},AUTO:1,Scale:{RESIZE:1,CENTER_BOTH:1}},location:{search:'?seed=33'},URLSearchParams,addEventListener(){},innerWidth:950,innerHeight:430};w.window=w;vm.createContext(w);
for(const [,attrs,body]of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!/\bsrc\s*=/.test(attrs))vm.runInContext(body,w);
const C=w.GRIM_CONFIG;
vm.runInContext(read('assets/visuals/enemy-motion.js'),w);
const Ground=w.GRIM_ENEMY_MOTION;
const mScale=100/1065;
for(const grade of [-.73,0,.73]){
  const estimate=(x)=>240+(x-180)*grade;
  const ground={segments:[{kind:'ground',start:0,end:400}],surfaceAt:(_,x)=>estimate(x)};
  for(const claws of [...Ground.CRAWL_CLAWS,...Ground.CRAWL_MIDS]){
    const pose=Ground.crawlerPose(ground,180,240,1477,1065,mScale,claws);
    const c=Math.cos(pose.angle), sin=Math.sin(pose.angle);
    for(let i=0;i<4;i+=2){
      const dx=(1477*.5-claws[i])*mScale,dy=(claws[i+1]-1065*.5)*mScale;
      assert(Math.abs(pose.y+dx*sin+dy*c-estimate(pose.x+dx*c-dy*sin))<.05,
        'Crawler claws share the ground at either end of a slope');
    }
  }
}
const crawlerReference={width:1477,height:1065,scale:mScale,claws:Ground.CRAWL_CLAWS[0]};
for(const grade of [-.73,-.25,0,.42,.73]){
  const height=x=>240+(x-180)*grade;
  const terrain={segments:[{kind:'ground',start:0,end:400}],surfaceAt:(_,x)=>height(x)};
  const crawl=Ground.crawlerPose(terrain,180,240,1477,1065,mScale,crawlerReference.claws);
  for(const claws of Ground.RESPONSE_CLAWS){
    const response={width:512,height:512,scale:.30,claws};
    const pose=Ground.responsePose(terrain,180,240,response,crawlerReference);
    assert(Math.abs(Ground.clawX(pose,response,0)-Ground.clawX(crawl,crawlerReference,0))<.05,
      'A recoil or defeat painting remains pinned to the same bearing claw');
    assert(Math.abs(pose.angle-Math.atan(grade))<.05,'The response follows the grade instead of flattening');
    for(const j of [0,2]){
      const x=Ground.clawX(pose,response,j);
      const dx=(256-claws[j])*.30,dy=(claws[j+1]-256)*.30;
      assert(Math.abs(pose.y+dx*Math.sin(pose.angle)+dy*Math.cos(pose.angle)-height(x))<.05,
        'Both response support landmarks align to the slope');
    }
  }
}
const ledge={segments:[{kind:'ground',start:0,end:180},{kind:'gap',start:180,end:320}],
  surfaceAt:()=>240};
assert.equal(Ground.floor(ledge,180),null);
const edgeResponse={width:512,height:512,scale:.30,claws:Ground.RESPONSE_CLAWS[2]};
const edge=Ground.responsePose(ledge,179,240,edgeResponse,crawlerReference);
assert(Number.isFinite(edge.y)&&Ground.clawX(edge,edgeResponse,2)<180,'The rear claw bears a response at a ledge');
assert(Number.isFinite(Ground.crawlerPose(ledge,179,240,1477,1065,mScale,Ground.CRAWL_CLAWS[0]).y));
assert.equal(Ground.cycle(104,0,104),0);

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
 assert.equal(s.state,'vendorIntro');assert.equal(s.vendorIntroMs,4000);assert(s.player.grounded);
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
const life=game();
life.freeLifeAvailable=true;life.player.hp=1;life.takeDamage(1,'rock');assert.equal(life.state,'dying');
const frozen={x:life.player.x,elapsed:life.elapsed,rng:life.rng.state};w.document.hidden=true;life.update(0,250);assert.equal(life.deathPoseMs,0);w.document.hidden=false;
for(let i=0;i<9;i++)life.update(0,250);life.update(0,149);assert.equal(life.state,'dying');assert.equal(life.freeLifeUsed,false);
assert.deepEqual({x:life.player.x,elapsed:life.elapsed,rng:life.rng.state},frozen);assert.equal(life.deathPoseMs,2399);assert.equal(life.revive(),false);life.update(0,1);
assert.equal(life.state,'respawning');assert(life.freeLifeUsed);assert.equal(life.respawnMs,1500);assert.equal(life.respawnNextMode,'countdown');
life.state='playing';life.player.hp=1;life.takeDamage(1,'rock');for(let i=0;i<12;i++)life.update(0,200);assert.equal(life.state,'revive');
life.reviveUsed=true;life.state='playing';life.player.hp=1;life.takeDamage(1,'rock');for(let i=0;i<12;i++)life.update(0,200);assert.equal(life.state,'dead');
// Original source bytes and all runtime PNG chunks must survive export/push.
const m=JSON.parse(read('assets/combat/v0170/manifest.json'));
function crc32(b){let c=0xffffffff;for(const byte of b){c^=byte;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
for(const [group,folder]of [['sources','source/'],['runtime','']])for(const [name,meta]of Object.entries(m[group])){
 const b=fs.readFileSync(path.join(root,'assets/combat/v0170',folder+name));assert.equal(b.length,meta.bytes,name);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),meta.sha256,name);
 let p=8,idat=[],ended=false;while(p<b.length){const n=b.readUInt32BE(p),type=b.toString('ascii',p+4,p+8);assert(p+n+12<=b.length,name+' chunk boundary');assert.equal(crc32(b.subarray(p+4,p+n+8)),b.readUInt32BE(p+n+8),name+' '+type);if(type==='IDAT')idat.push(b.subarray(p+8,p+8+n));if(type==='IEND')ended=true;p+=n+12;}
 assert(ended&&p===b.length,name+' has complete IEND');assert.equal(b[25],6,name+' has true RGBA');assert(zlib.inflateSync(Buffer.concat(idat)).length>1000);
}
assert.equal(m.registration['bat-flight'].frames,16);assert(m.registration['reaper-slide-cut'].frames>=8);assert.equal(m.registration['reaper-crossbow'].frames,16);
const art={};art.window=art;vm.createContext(art);vm.runInContext(read('assets/combat/v0170/animation-data.js'),art);vm.runInContext(read('assets/visuals/bat-flight.js'),art);vm.runInContext(read('assets/visuals/combat-animations.js'),art);
const A=art.GRIM_COMBAT_ART,frames=new Set();for(let i=0;i<160;i++)frames.add(A.batMotion(i/160*A.BAT_CYCLE_SECONDS).a);assert.equal(frames.size,96);assert.equal(A.batMotion(A.BAT_CYCLE_SECONDS).a,0);
for(const count of [10,12]){assert.equal(A.attackFrame(.20,count),3);assert.equal(A.attackFrame(.79,count),count-4);assert.equal(A.attackFrame(1,count),count-1);}
const abyss=game();
let scroll;abyss.cameras.main.setScroll=(x,y)=>{scroll=[x,y];};abyss.player.hp=1;abyss.player.x=abyss.terrain.sequences[0].startX+30;abyss.rescueFromAbyss();
assert.equal(abyss.state,'dying');assert.deepEqual(scroll,[abyss.cameraX,abyss.cameraY],'Lethal abyss defeat is visible at the safe recovery camera');
const fake={player:{visualHurtMs:340},enemies:[],elapsed:0,add:{},terrain:{groundAt(){return 300;},anchorAt(){return 300;}}};
const v=new A.CombatAnimations(fake),imp={kind:'imp',hp:1,x:100,y:280};
assert.equal(v.enemyHit(imp,false),true);assert.equal(imp.visualHitUntil,.105);assert.equal(v.corpses.length,0);
fake.elapsed=.104;assert(v.enemyFlashing(imp));fake.elapsed=.105;assert(!v.enemyFlashing(imp));
assert.equal(v.enemyHit({kind:'bat',hp:1},false),false);
assert.equal(v.enemyHit({kind:'crawler',hp:1},false),false);
fake.visuals={emberImpReady:true};assert.equal(v.enemyHit(imp,false),false,'An unavailable flash does not select a different pose');
v.enemyFlashReady=true;v.reducedMotion={matches:true};fake.elapsed=0;
assert.equal(v.enemyHit(imp,false),true);assert.equal(imp.visualHitUntil,.075);
for(let i=0;i<20;i++)v.enemyHit({...imp,x:i*10},true);assert.equal(v.corpses.length,12);const saved=v.snapshot();v.tick(100);assert.equal(fake.player.visualHurtMs,240);assert(v.corpses.every(c=>c.age===100));v.restore(saved);assert(v.corpses.every(c=>c.age===0));v.tick(800);assert.equal(v.corpses.length,0);
console.log('PASS combat polish: response scale/grade registration, floor-contact/airborne entry, persistent Angel/Devil cards and healing, 2,400ms frozen death before free/paid/results, complete source/runtime PNG CRC/SHA, 96-pose bat loop, surviving 2HP flash and bounded rewindable defeats.');
