'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const bank=new Map(),nodes=new Map();
function node(){let n;n=new Proxy({textContent:'',disabled:false,style:{setProperty(){}},classList:{add(){},remove(){},toggle(){},contains(){return false}},
 addEventListener(){},setAttribute(){},appendChild(){},replaceChildren(){},destroy(){}},
 {get(o,k){return k in o?o[k]:(...args)=>n;},set(o,k,v){o[k]=v;return true;}});return n;}
const el=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
const w={document:{getElementById:el,createElement:node,write(){},addEventListener(){}},
 localStorage:{getItem:k=>bank.get(k)??null,setItem:(k,v)=>bank.set(k,String(v))},
 Phaser:{Scene:class{},Game:class{},AUTO:1,Scale:{RESIZE:1,CENTER_BOTH:1}},
 location:{search:'?seed=33'},URLSearchParams,addEventListener(){},innerWidth:950,innerHeight:430};
w.window=w;vm.createContext(w);
for(const [,attrs,script] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))
 if(!/\bsrc\s*=/.test(attrs))vm.runInContext(script,w,{filename:'index.html'});
const C=w.GRIM_CONFIG,Core=w.GRIM_CORE,M=w.GRIM_META,P=w.GRIM_POWERS;
assert.equal(C.version,'0.19.6');let power=P.makePowerManager();
for(const distance of [150,200,250,300]){
 power.apply('brittleBones',{},()=>{},1);
 assert.equal(power.brittleRangeMeters(),distance);
}
const account=M.normalize({souls:0,levels:{boneheart:3,graveWealth:1,deathsLeap:2,graveGlide:3}});
assert.equal(M.investedSouls(account),100);
assert.equal(M.refundAll(account).ok,false,'Refund requires a pre-existing unspent Soul');
assert.equal(account.levels.boneheart,3,'Failed refund cannot erase levels');
account.souls=1;assert.equal(M.refundAll(account).ok,true);
assert.equal(account.souls,100,'Fee debited from 1 unspent Soul, invested 100 refunded');
assert.equal(M.investedSouls(account),0);
assert.equal(M.load().souls,100,'Reset persists in browser storage');
const flat=()=>300,steep=x=>300-(x-200)*.7,soft=x=>300-(x-200)*.2;
for(const speed of [282,360,465]){
 assert.equal(Core.canClearJumpObstacle(flat,{type:'rock',x:550,y:252,width:54},speed),true);
 assert.equal(Core.canClearJumpObstacle(steep,{type:'rock',x:550,y:steep(550)-48,width:54},speed),false);
 assert.equal(Core.canClearJumpObstacle(soft,{type:'rock',x:550,y:soft(550)-48,width:54},speed),true);
}
function scene(seed){
 w.location.search='?seed='+seed;const g=new w.GrimGameScene();
 g.scale={width:950,height:430,on(){},off(){}};
 g.events={once(){}};g.add={graphics:node,text:node};g.cameras={main:{setScroll(){}}};
 g.create();g.drawScene=()=>{};g.startRun();return g;
}
const g=scene(33);g.goToMenu();
g.meta.souls=0;g.meta.levels.boneheart=2;
g.openReliquary();g.ui.updateReliquary(g.meta);
assert.equal(el('reliquary-reset-btn').disabled,true);
assert.equal(g.openRefund(),false);
g.meta.souls=1;g.ui.updateReliquary(g.meta);
assert.equal(el('reliquary-reset-btn').disabled,false);
assert.equal(g.openRefund(),true);
assert.equal(g.state,'refundConfirm');
assert.ok(el('reset-description').textContent.includes('New balance: 15'));
g.cancelRefund();assert.equal(g.meta.levels.boneheart,2);
assert.equal(g.openRefund(),true);assert.equal(g.confirmRefund(),true);
assert.equal(g.state,'reliquary');assert.equal(g.meta.souls,15);
assert.equal(g.meta.levels.boneheart,0);
g.closeReliquary();g.startRun();g.togglePause();
g.askAbandon();assert.equal(g.state,'abandonConfirm');
g.cancelAbandon();assert.equal(g.state,'paused','Cancel keeps game paused');
g.askAbandon();g.confirmAbandon();assert.equal(g.state,'menu');
assert.ok(html.includes('var(--action-size) + 26px'));
let accepted=0,rejected=0,uphillRejected=0;
for(let seed=1;seed<=75;seed++){
 const terrain=w.GRIM_TERRAIN.makeTerrain(seed,335,200,C.pxPerMeter);
 for(let m=180;m<=9700;m+=32){
  const x=200+m*C.pxPerMeter,width=54;
  if(!terrain.canPlace(x,width))continue;
  const floor=terrain.groundAt(x);if(floor===null)continue;
  const obstacle={type:'rock',x,y:floor-48,width};
  const speed=Math.min(C.maxSpeed,C.initialSpeed+m*C.speedGainPerMeter);
  if(Core.canClearJumpObstacle(terrain.groundAt,obstacle,speed,C.jumpVelocity,C.gravity))accepted++;
  else{
   rejected++;
   const before=terrain.groundAt(x-120),after=terrain.groundAt(x+120);
   if(before!==null&&after!==null&&after<before-60)uphillRejected++;
  }
 }
}
assert.ok(accepted>800,'Keep ordinary rock obstacles');
assert.ok(rejected>100,'Reject impossible placements');
assert.ok(uphillRejected>10,'Reject steep uphill placements');
console.log('PASS v0.13.6: Soul refund precondition, persistence, confirmations, brittle ranges, 75-seed base jump checks: '+accepted+' accepted; '+rejected+' rejected; '+uphillRejected+' steep uphill rejected.');
