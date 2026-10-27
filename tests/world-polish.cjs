'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
function node(){let n;n=new Proxy({textContent:'',disabled:false,style:{setProperty(){}},classList:{add(){},remove(){},toggle(){},contains(){return false}},addEventListener(){},setAttribute(){},appendChild(){},replaceChildren(){},destroy(){}},{get(o,k){return k in o?o[k]:(...args)=>n;},set(o,k,v){o[k]=v;return true;}});return n;}
const w={document:{getElementById:node,createElement:node,write(){},addEventListener(){}},localStorage:{getItem(){return null},setItem(){}},Phaser:{Scene:class{},Game:class{},AUTO:1,Scale:{RESIZE:1,CENTER_BOTH:1}},location:{search:'?seed=33'},URLSearchParams,addEventListener(){},innerWidth:950,innerHeight:430};w.window=w;vm.createContext(w);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const [,attrs,body]of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!/\bsrc\s*=/.test(attrs))vm.runInContext(body,w);
vm.runInContext(fs.readFileSync(path.join(root,'assets/visuals/obstacle-catalog.js'),'utf8'),w);
const C=w.GRIM_CONFIG;
function scene(seed=33){w.location.search='?seed='+seed;const s=new w.GrimGameScene();s.scale={width:950,height:430,on(){},off(){}};s.events={once(){}};s.add={graphics:node,text:node};s.cameras={main:{setScroll(){}}};s.create();s.drawScene=()=>{};s.startRun();return s;}
let hills=0,crests=0,samples=0,maxChordError=0;
for(let seed=1;seed<=30;seed++){
 const t=w.GRIM_TERRAIN.makeTerrain(seed,339,200,12);t.advance(242000);
 const s=new w.GrimGameScene();s.terrain=t;
 for(let i=0;i<t.segments.length;i++){
  const seg=t.segments[i];if(seg.kind==='gap'){assert.equal(t.groundAt((seg.start+seg.end)/2),null);continue;}
  const lo=Math.min(seg.y0,seg.y1),hi=Math.max(seg.y0,seg.y1);
  const points=s.terrainContour(seg);
  for(let j=0;j<points.length;j++){
   const p=points[j];assert(p.y>=lo-1e-7&&p.y<=hi+1e-7,'Rounded hills cannot overshoot their endpoint elevations');
   if(p.x<seg.end-.0001)assert(Math.abs(p.y-t.groundAt(p.x))<1e-7,'Rendered contour equals the physical surface');
   if(j){const a=points[j-1],mid=(a.x+p.x)/2,error=Math.abs(t.surfaceAt(seg,mid)-(a.y+p.y)/2);maxChordError=Math.max(maxChordError,error);assert(error<.15,'Four-pixel render chords stay below a visible pixel '+JSON.stringify({seed,seg,error,a,p,slopes:t.surfaceSlopes(seg)}));}
   samples++;
  }
  if(seg.kind!=='ground')continue;hills++;
  const next=t.segments[i+1];if(!next||next.kind!=='ground'||Math.abs(seg.y1-next.y0)>.001)continue;
  const e=.00001,l=(t.surfaceAt(seg,seg.end)-t.surfaceAt(seg,seg.end-e))/e,r=(t.surfaceAt(next,next.start+e)-t.surfaceAt(next,next.start))/e;
  assert(Math.abs(l-r)<.001,'Hill joins have a continuous tangent '+JSON.stringify({seed,i,seg,next,l,r,slopes:t.surfaceSlopes(seg),nextSlopes:t.surfaceSlopes(next)}));
  const dl=seg.y1-seg.y0,dr=next.y1-next.y0;
  if(dl*dr<0){crests++;assert(Math.abs(l)<.001&&Math.abs(r)<.001,'Peaks and valleys round to a horizontal tangent');}
 }
}
assert(crests>1000);assert(!/abyssFallback\.fill(?:Points|Style)/.test(html),'Legacy lip backing is removed');
const g=scene(),gap=g.terrain.sequences[0];g.powerManager.apply('deathsReversal',g.player,()=>{},1);g.player.x=gap.startX+30;g.player.y=g.terrain.anchorAt(g.player.x)+500;g.player.hp=3;
g.enemies=[{kind:'bat',x:gap.respawnX+600,y:200,homeY:200,hp:1,phase:0,timer:80}];g.bullets=[{x:10,y:20,ageMs:60}];
g.gunCooldownMs=730;g.blastCooldownMs=6700;g.player.slowCooldownMs=2250;g.player.attackCooldownMs=120;
assert.equal(g.rescueFromAbyss(),true);assert.equal(g.state,'respawning');assert.equal(g.respawnMs,1500);assert.equal(g.player.hp,2);assert.equal(g.fallCount,1);assert.equal(g.player.x,gap.respawnX);assert.equal(g.player.y,g.terrain.groundAt(gap.respawnX));
assert.equal(g.rescueFromAbyss(),false,'Damage cannot repeat during respawn');
const frozen={elapsed:g.elapsed,player:JSON.stringify(g.player),enemies:JSON.stringify(g.enemies),bullets:JSON.stringify(g.bullets),gun:g.gunCooldownMs,blast:g.blastCooldownMs,rng:g.rng.state};
w.document.hidden=true;g.update(0,250);assert.equal(g.respawnMs,1500,'Hidden pages do not spend the animation');w.document.hidden=false;
for(let i=0;i<5;i++){g.update(0,250);assert.equal(g.state,'respawning');assert.equal(JSON.stringify(g.player),frozen.player);assert.equal(JSON.stringify(g.enemies),frozen.enemies);assert.equal(JSON.stringify(g.bullets),frozen.bullets);assert.equal(g.elapsed,frozen.elapsed);assert.equal(g.gunCooldownMs,frozen.gun);assert.equal(g.blastCooldownMs,frozen.blast);assert.equal(g.rng.state,frozen.rng);}
g.update(0,249);assert.equal(g.state,'respawning');assert.equal(g.respawnMs,1);g.update(0,1);assert.equal(g.state,'playing');assert.equal(g.countdownMs,0);assert.equal(g.player.invulMs,C.abyssRespawnInvulnerabilityMs);assert.equal(g.fallCount,1);assert.equal(g.player.hp,2);assert.equal(g.cameraX,g.player.x-g.width*C.reaperXRatio);assert.equal(g.cameraY,g.player.y-g.groundY);assert.equal(g.rewindFrames.length,1,'Respawn is a fresh rewind boundary');
const lethal=scene();lethal.player.hp=1;lethal.player.x=lethal.terrain.sequences[0].startX+30;lethal.rescueFromAbyss();assert.equal(lethal.state,'revive');assert.equal(lethal.respawnMs,0);assert.equal(lethal.player.hp,0);
const lava=scene();lava.player.hp=3;lava.distance=8500;lava.player.x=lava.terrain.sequences.find(v=>(v.startX-lava.startX)/12>8200).startX+20;const damage=lava.powerManager.lavaDamage();lava.rescueFromAbyss();assert.equal(lava.player.hp,3-damage);assert.equal(lava.fallCount,1);
// Coins/Souls retain their original encounter geometry, values and collection range.
const pick=scene();assert.equal(pick.coins.length,105);assert.equal(pick.souls.length,2);assert.equal(pick.soulPlatform.length,9);
const coin=pick.coins[0];pick.player.x=coin.x;pick.player.y=coin.baseY;pick.checkCollectibles();assert(coin.taken);assert.equal(pick.coinCount,1);
const soul=pick.souls[0];pick.player.x=soul.x;pick.player.y=soul.baseY+soul.offset+43;pick.checkCollectibles();assert(soul.taken);assert.equal(pick.soulCount,1);
// Each destruction path removes its collider immediately and uses one shared hook.
const cut=scene();let effects=0;cut.worldPolish={ready:{'polish-fragments':true},destroyObstacle(){effects++;}};
const makeOb=()=>({type:'bramble',x:cut.player.x+65,y:cut.player.y-288,width:60,height:288,destroyed:false,variant:0});
let ob=makeOb();cut.obstacles=[ob];cut.cutNearby();assert(ob.destroyed);assert.equal(effects,1);cut.cutNearby();assert.equal(effects,1);
ob=makeOb();cut.obstacles=[ob];cut.gunUnlocked=true;cut.bullets=[{kind:'obstacle',ref:ob,x:ob.x,y:ob.y+45,damage:2,ageMs:0}];cut.updateCombat(34,.034);assert(ob.destroyed);assert.equal(effects,2);
ob=makeOb();cut.obstacles=[ob];cut.blastSoulcaster();assert(ob.destroyed);assert.equal(effects,3);
cut.powerManager.apply('brittleBones',cut.player,()=>{},1);ob=makeOb();cut.obstacles=[ob];cut.triggerBrittleBones();assert(ob.destroyed);assert.equal(effects,4);
// Validate production alpha atlases and pure motion math independently of Phaser.
vm.runInContext(fs.readFileSync(path.join(root,'assets/visuals/world-polish-data.js'),'utf8'),w);vm.runInContext(fs.readFileSync(path.join(root,'assets/visuals/world-polish.js'),'utf8'),w);
const A=w.GRIM_WORLD_POLISH;assert.equal(A.COIN_HEIGHT,19*1.75);assert.equal(A.SOUL_HEIGHT,23*1.75);
let min=100,max=0;const frames=new Set();for(let i=0;i<160;i++){const m=A.coinMotion(i/100,400);min=Math.min(min,m.width);max=Math.max(max,m.width);frames.add(m.frame);assert.equal(m.height,33.25);}assert(max/min>6);assert.equal(frames.size,12);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/world-polish/v0153/manifest.json')));assert.equal(Object.keys(manifest.sources).length,12);assert.equal(Object.keys(manifest.runtime).length,12);
for(const group of [manifest.sources,manifest.runtime])for(const [file,meta]of Object.entries(group)){const bytes=fs.readFileSync(path.join(root,file));assert.equal(bytes.length,meta.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),meta.sha256);assert.equal(bytes[25],6);assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],meta.size);}
console.log(`PASS v0.15.3: ${hills} rounded hills, ${crests} smooth extrema, ${samples} shared visual/collision samples (max chord error ${maxChordError.toFixed(3)}px); exact 1.5s frozen respawn, damage/death/rewind guards; unchanged pickups/9 ledges; four destruction paths; 12 source/12 runtime hashes.`);
