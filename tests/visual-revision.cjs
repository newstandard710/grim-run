'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/powers/revision-v2/manifest.json')));
for(const [kind,entries] of Object.entries(manifest).filter(([k])=>k==='sources'||k==='runtime'))for(const [name,meta] of Object.entries(entries)){
  const file=kind==='sources'?path.join(root,'assets/powers/source/revision-v2',name):path.join(root,name);
  const bytes=fs.readFileSync(file);assert.equal(bytes.length,meta.bytes,name+' byte count');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),meta.sha256,name+' checksum');
  assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(bytes[25],6,name+' alpha');
  if(meta.size)assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],meta.size);
}
const scope={GRIM_CONFIG:{attackDurationMs:260}};scope.window=scope;vm.createContext(scope);
for(const file of ['revision-art.js','cutscene-motion.js','power-animations.js'])vm.runInContext(fs.readFileSync(path.join(root,'assets/visuals',file),'utf8'),scope);
const A=scope.GRIM_POWER_ART,frames=new Set();let last=0;
for(let ms=0;ms<=4000;ms+=1){const frame=A.relicMotionAt(ms/1000).frame;frames.add(frame);assert(frame>=0&&frame<169);assert(frame>=last&&frame-last<=1,'Acquisition advances continuously without skipping poses');last=frame;}
assert.equal(frames.size,169);assert.equal(A.relicMotionAt(3).frame,168,'Overhead reveal holds');
assert.equal(scope.GRIM_REVISION_ART.relicHands.length,24);
assert.deepEqual(Array.from(scope.GRIM_REVISION_ART.relicAnchor),[256,456]);
// Load the actual scene method and seeded terrain without creating a renderer.
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),node=()=>new Proxy({}, {get:()=>()=>{}});
const w={Phaser:{Scene:class{},Game:class{},AUTO:1,Scale:{RESIZE:1,CENTER_BOTH:1}},
 document:{getElementById:node,createElement:node,addEventListener(){},write(){}},
 localStorage:{getItem(){return null},setItem(){}},location:{search:'?seed=1'},URLSearchParams,addEventListener(){},innerWidth:950,innerHeight:430};w.window=w;vm.createContext(w);
for(const [,attrs,body] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!/\bsrc\s*=/.test(attrs))vm.runInContext(body,w);
let wallsChecked=0;
for(const seed of [1,7,19,33,42,99]){
 const terrain=w.GRIM_TERRAIN.makeTerrain(seed,339,200,12),scene=new w.GrimGameScene();
 Object.assign(scene,{terrain,height:430});
 const before=JSON.stringify(terrain.segments);
 for(const [i,gap] of terrain.segments.entries()){
  if(gap.kind!=='gap')continue;
  const x=(gap.start+gap.end)/2;
  assert.equal(terrain.groundAt(x),null);assert.equal(scene.groundFogSurfaceAt(x),null);
  const signature=[];
  for(const [side,bank] of [['left',terrain.segments[i-1]],['right',terrain.segments[i+1]]]){
   assert(bank);
   const wall=scene.abyssWallProfile(gap,bank,side);
   const y=side==='left'?gap.y0:gap.y1;
   const edge=side==='left'?gap.start:gap.end;
   assert.equal(wall.points[0].x,edge);
   assert.equal(wall.points[0].y,y);
   assert.equal(scene.abyssWallProfile(gap,bank,side),wall);
   assert(wall.points.slice(1).every((p,i)=>p.y>wall.points[i].y));
   assert(wall.points.at(-1).y>y+430);
   assert(wall.points.some(p=>p.y>y+430&&Math.abs(p.x-edge)>1));
   const gapReach=(gap.end-gap.start)*.19+.00001;
   assert(wall.points.every(p=>(p.x-edge)*wall.direction<=gapReach));
   const slice=scene.abyssWallSlice(wall,y,y+450);
   assert.equal(slice.at(-1).y,y+450);
   signature.push(wall.signature);
  }
  assert.notEqual(...signature);
  wallsChecked++;
 }
 assert.equal(JSON.stringify(terrain.segments),before,'Rendering never mutates a terrain section');
 assert(scene.abyssWallCache.size<=64);
}
assert(wallsChecked>100);
console.log('PASS revision assets, 169 relic poses, full-depth wall anchors and preservation of seeded terrain.');
