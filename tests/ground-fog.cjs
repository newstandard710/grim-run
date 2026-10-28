'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const node=()=>new Proxy({}, {get:()=>()=>{}});
const w={Phaser:{Scene:class{},Game:class{},AUTO:1,Scale:{RESIZE:1,CENTER_BOTH:1}},
 document:{getElementById:node,createElement:node,addEventListener(){},write(){}},
 localStorage:{getItem(){return null},setItem(){}},location:{search:'?seed=33'},
 URLSearchParams,addEventListener(){},innerWidth:950,innerHeight:430};w.window=w;vm.createContext(w);
for(const [,attrs,body]of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))
 if(!/\bsrc\s*=/.test(attrs))vm.runInContext(body,w);
let created=0,destroyed=0;
function image(x,y,key){created++;return {
 x,y,key,visible:true,setOrigin(){return this;},setDepth(v){this.depth=v;return this;},
 setMask(v){this.mask=v;return this;},setTexture(v){this.key=v;return this;},
 setPosition(x,y){this.x=x;this.y=y;return this;},setRotation(v){this.rotation=v;return this;},
 setDisplaySize(w,h){this.width=w;this.height=h;return this;},setFlipX(v){this.flip=v;return this;},
 setTint(v){this.tint=v;return this;},setAlpha(v){this.alpha=v;return this;},
 setVisible(v){this.visible=v;return this;},destroy(){destroyed++;}
};}
const s=new w.GrimGameScene();
Object.assign(s,{startX:200,state:'paused',width:950,cameraX:0,elapsed:5,
 groundFogViews:new Map(),groundFogMask:{},textures:{exists:()=>true},add:{image},
 groundFogMaskGraphics:{clear(){},fillStyle(){},fillPoints(){}},
 terrain:w.GRIM_TERRAIN.makeTerrain(33,339,200,12)});
s.terrainBiomeWeights=()=>({forest:1});s.drawGroundFog();
// Captured alpha values of the original v0.19.3 forest banks. Each new
// depth receives exactly half, independently of texture/position changes.
for(const [index,original]of [0.4004,0.5408,0.4056,0.4212].entries()){
 for(const layer of ['rear','front']){
  const bank=s.groundFogViews.get(layer+':bank:'+index);assert(bank);
  assert(Math.abs(bank.alpha-original/2)<1e-10);
 }
}
const rear=s.groundFogViews.get('rear:bank:1'),front=s.groundFogViews.get('front:bank:1');
assert(rear.depth<11.5&&front.depth>14.9&&front.depth<16,'All character/action renderers fit between mist and obstacles');
assert(Math.abs(rear.x-front.x)>50,'The two banks have distinct world positions');
const snapshot=()=>new Map([...s.groundFogViews].map(([id,v])=>[id,JSON.stringify(v)]));
let before=snapshot(),n=created;s.drawGroundFog();assert.deepEqual(snapshot(),before);
assert.equal(created,n,'Paused/redrawn frames reuse all visible sprites');
// Find a localized bank in real seeded terrain and move the viewport edge
// through its section: the world position must stay fixed.
let checked=0;
for(let x=0;x<25000&&checked<4;x+=300){
 s.cameraX=x;s.drawGroundFog();before=snapshot();s.cameraX+=75;s.drawGroundFog();
 for(const [id,value]of before){
  const bank=s.groundFogViews.get(id);
  if(bank&&id.includes(':section:')){
   assert.equal(JSON.stringify(bank),value,'Localized wisp stays fixed while camera moves');checked++;
  }
 }
}
assert(checked>=4,'Camera regression exercised localized wisps');
assert(s.groundFogViews.size<45,'The two layers stay bounded at phone width');
const alpha=front.alpha;s.elapsed+=1;s.cameraX=0;s.drawGroundFog();
assert.equal(s.groundFogViews.get('front:bank:1').alpha,alpha,'Drift does not pulse opacity');
for(const x of [1000,6000,12000,18000,24000]){
 s.cameraX=x;s.drawGroundFog();assert(s.groundFogViews.size<45);
 assert.equal(created-destroyed,s.groundFogViews.size,'Offscreen banks are released');
}
for(const gap of s.terrain.segments.filter(v=>v.kind==='gap').slice(0,20)){
 const x=(gap.start+gap.end)/2;assert.equal(s.terrain.groundAt(x),null);
 assert(Number.isFinite(s.groundFogSurfaceAt(x)));assert.equal(s.terrain.groundAt(x),null);
}
const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/visuals/ground-fog/manifest-v3.json')));
for(const [file,m]of Object.entries(manifest.runtime)){
 const bytes=fs.readFileSync(path.join(root,file));assert.equal(bytes.length,m.bytes);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),m.sha256);
 assert(Math.abs(m.size[1]-m.source_size[1]*m.size[0]/m.source_size[0])<=.5,'Export preserves original aspect ratio');
 assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WEBP');
}
console.log('PASS two half-opacity fog layers, stable world placement, independent banks, bounded reuse, open gaps and asset hashes.');
