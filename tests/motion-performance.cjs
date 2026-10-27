'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),html=read('index.html');
const writes=new Map(),elements=new Map();
function node(id=''){let n;n=new Proxy({textContent:'',disabled:false,style:{setProperty(){}},classList:{add(){},remove(){},toggle(){},contains(){return false}},addEventListener(){},setAttribute(){},appendChild(){},replaceChildren(){},destroy(){}},{get:(o,k)=>k in o?o[k]:(...args)=>n,set:(o,k,v)=>{if(k==='textContent')writes.set(id,(writes.get(id)||0)+1);o[k]=v;return true;}});return n;}
const el=id=>{if(!elements.has(id))elements.set(id,node(id));return elements.get(id);};
const w={document:{getElementById:el,createElement:node,write(){},addEventListener(){}},localStorage:{getItem(){return null},setItem(){}},Phaser:{Scene:class{},Game:class{},AUTO:1,Scale:{RESIZE:1,CENTER_BOTH:1}},location:{search:'?seed=33'},URLSearchParams,addEventListener(){},innerWidth:950,innerHeight:430};w.window=w;vm.createContext(w);
for(const [,attrs,body]of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!/\bsrc\s*=/.test(attrs))vm.runInContext(body,w);
for(const file of ['assets/motion/v0193/animation-data.js','assets/motion/v0180/animation-data.js','assets/visuals/motion-animations.js','assets/visuals/world-polish.js'])vm.runInContext(read(file),w);
const A=w.GRIM_MOTION_ART,D=w.GRIM_MOTION_DATA;
// Cadence is a function of distance, with no hardcoded dependency on the current
// move-speed config or the display refresh rate.
for(const speed of [140,282,465,600])for(const hz of [30,60,120]){
 let distance=0;for(let i=0;i<hz;i++)distance+=speed/hz;
 assert(Math.abs(A.runFrame(distance)-A.runFrame(speed))<1e-9);
}
assert.equal(A.STRIDE_PX,752);assert.equal(A.PIXELS_PER_GAIT,188);assert.equal(A.GAITS_PER_SHEET,4);
assert.equal(A.runFrame(188),6,'188px advances one gait beat, not the entire sheet');
for(const speed of [300,362.5,425])assert(Math.abs(A.runFrame(speed)-speed/A.STRIDE_PX*24)<1e-9,'Cadence follows actual distance at every movement speed');
assert.equal(A.WEAPON_SCALE,D.weapon.scale*.60);
assert.equal(A.runFrame(A.STRIDE_PX),0);assert(A.runFrame(-1)>=0);
// Sample the actual renderer across every baked pose, including half-way
// transitions that used to expose the background through the Reaper.
function imageSpy(){return {visible:false,alpha:1,setVisible(v){this.visible=v;return this;},
 setTexture(key,frame){this.key=key;this.frame=frame;return this;},
 setOrigin(x,y){this.origin=[x,y];return this;},setPosition(x,y){this.position=[x,y];return this;},
 setScale(v){this.scale=v;return this;},setAlpha(v){this.alpha=v;return this;},setTint(){return this;}};}
const runScene={state:'playing',startX:200,feetY:340,elapsed:0,visuals:{reviewV2:true},
 player:{x:200,grounded:true,attackMs:0,invulMs:0},powerManager:{level:()=>0}};
const render=Object.assign(Object.create(A.MotionAnimations.prototype),{scene:runScene,ready:true,runReady:true,
 body:[imageSpy(),imageSpy()],weapon:imageSpy(),trail:{clear(){}}});
for(let i=0;i<w.GRIM_RUN_DATA.frames;i++){
 runScene.player.x=200+A.STRIDE_PX*(i+.1)/w.GRIM_RUN_DATA.frames;render.render();
 const active=render.body.filter(v=>v.visible);assert.equal(active.length,1);assert.equal(active[0].alpha,1);
 assert.equal(active[0].key,'motion-reaper-run-solid');assert.equal(active[0].frame,i);
 assert.equal(active[0].scale,w.GRIM_RUN_DATA.scale);assert.equal(active[0].position[1],340);
}
const phase=render.state.phase;runScene.state='paused';render.render();assert.equal(render.state.phase,phase);
runScene.player.grounded=false;runScene.player.velocityY=-300;render.render();
assert.equal(render.state.name,'reaper-jump');assert.equal(render.body.filter(v=>v.visible).length,1);
assert.equal(render.body[0].alpha,1);assert.equal(render.body[0].scale,.52);
runScene.player.grounded=true;runScene.player.sliding=true;render.render();assert(render.body.every(v=>!v.visible));
for(const speed of [300,362.5,425])for(const hz of [30,60,120]){
 for(const timeScale of [1,.5,.25,0]){
  let distance=0;for(let i=0;i<hz;i++)distance+=speed/hz*timeScale;
  assert.equal(A.runAtlasFrame(distance+.00001),A.runAtlasFrame(speed*timeScale+.00001));
 }
}
assert.equal(A.runAtlasFrame(A.STRIDE_PX),0);assert.equal(A.runAtlasFrame(-A.STRIDE_PX/192),191);
assert.equal(A.jumpFrame({grounded:true,visualLandingMs:A.LAND_MS}),18);
assert.equal(A.jumpFrame({grounded:true,visualLandingMs:0}),23);
assert.equal(A.jumpFrame({hovering:true}),10.5);
const frameSet=new Set();for(let t=0;t<=1;t+=.001)frameSet.add(Math.round(A.cutFrame(t)));assert.equal(frameSet.size,24);
// The physical weapon is rigid and carry-sized; a separate spectral arc owns the unchanged damage reach.
// Its pointed end must stay ahead of its socket along the entire active stroke.
let bladeLength;
for(let t=.201;t<.789;t+=.001){
 const rig=A.cutRig(t),tip=A.weaponPoint(rig,D.weapon.tip),socket=A.weaponPoint(rig,D.weapon.socket);
 const length=Math.hypot(tip.x-socket.x,tip.y-socket.y);bladeLength??=length;assert(Math.abs(length-bladeLength)<1e-8);
 const next=A.weaponPoint(A.cutRig(t+.0001),D.weapon.tip);
 assert((next.x-tip.x)*(tip.x-socket.x)+(next.y-tip.y)*(tip.y-socket.y)>0,'Point leads at '+t);
 const butt=A.weaponPoint(rig,[805*384/1254,1210*384/1254]);assert(butt.y<2,'Shaft clears the floor at '+t);
}
function game(){const s=new w.GrimGameScene();s.scale={width:950,height:430,on(){},off(){}};s.events={once(){}};s.add={graphics:node,text:node};s.cameras={main:{setScroll(){}}};s.create();s.drawScene=()=>{};s.startRun();return s;}
const s=game(),p=s.player,baseX=p.x,feet=s.feetY;
const broad=w.GRIM_CORE.attackBox(p.x,feet,0,false);
for(let t=.21;t<.79;t+=.03){
 p.attackMs=260*(1-t);const boxes=A.sweepBoxes(s,p.attackMs+34);assert(boxes.length>0);
 for(const b of boxes){assert(b.x>=broad.x&&b.y>=broad.y);assert(b.x+b.width<=broad.x+broad.width+1e-8);assert(b.y+b.height<=broad.y+broad.height+1e-8);}
 const tip=A.sweepPoint(A.cutRig(t),D.weapon.tip),target={x:p.x+tip.x-2,y:feet+tip.y-2,width:4,height:4};
 if(w.GRIM_CORE.overlaps(broad,target))assert(boxes.some(b=>w.GRIM_CORE.overlaps(b,target)),'Visible edge can hit at '+t);
}
for(let t=.20;t<=.79;t+=.005){
 const rig=A.cutRig(t),physical=A.weaponPoint(rig,D.weapon.tip),arc=A.sweepPoint(rig,D.weapon.tip);
 assert(Math.abs(Math.hypot(physical.x-rig.x,physical.y-rig.y)/Math.hypot(arc.x-rig.x,arc.y-rig.y)-.60)<1e-9);
}
// At the same pose, targets beyond the visible edge cannot be hit simply
// because they are inside the old full rectangular reach envelope.
p.attackMs=260*.75;const early=A.sweepBoxes(s,p.attackMs+16);
assert(!early.some(b=>w.GRIM_CORE.overlaps(b,{x:baseX+130,y:feet-20,width:5,height:5})));
// Dirty-only HUD writes and summary invalidation, including externally restored
// level changes during rewind.
const manager=s.powerManager,summary=manager.summary();assert.equal(manager.summary(),summary);
manager.levels.soulCleave=2;assert.notEqual(manager.summary(),summary);assert.equal(manager.summary()[0].level,2);
const current=manager.summary();s.ui.update(3,3,25,2,5,25,current);writes.clear();
for(let i=0;i<120;i++)s.ui.update(3,3,25.9,2,5,25,current);
assert.equal([...writes.values()].reduce((a,b)=>a+b,0),0,'Static HUD does no text writes');
// Camera easing is equivalent at 30/60/120Hz for equal elapsed time.
function camera(frames,dt){const g=game();g.state='paused';g.cameraY=g.terrain.anchorAt(g.player.x)-g.groundY-1000;for(let i=0;i<frames;i++)g.update(0,dt);return g.cameraY;}
assert(Math.abs(camera(1,1000/30)-camera(2,1000/60))<1e-8);assert(Math.abs(camera(2,1000/60)-camera(4,1000/120))<1e-8);
// Root-mask contour construction is skipped until a visible lowered-root skin
// actually needs it. This does not affect ground or hazard geometry.
let contours=0;const noRoots={scene:{obstacles:[],cameraX:0,cameraY:0,width:950,height:430,terrain:{visibleSections(){contours++;return [];}}},rootMaskGraphics:{clear(){},fillStyle(){}},light:{clear(){}},visible(){return true;}};
for(let i=0;i<120;i++)w.GRIM_WORLD_POLISH.WorldPolish.prototype.beginFrame.call(noRoots);
assert.equal(contours,0);
// Detect truncated/corrupt source or runtime PNGs before they reach a browser,
// whose decoder can otherwise accept a partially drawn sprite sheet.
function crc32(b){let c=0xffffffff;for(const byte of b){c^=byte;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
const manifest=JSON.parse(read('assets/motion/v0180/manifest.json'));
for(const [group,folder]of [['sources','source/'],['runtime','']])for(const [name,m]of Object.entries(manifest[group])){
 const b=fs.readFileSync(path.join(root,'assets/motion/v0180',folder+name));assert.equal(b.length,m.bytes,name);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),m.sha256,name);
 let p=8,ended=false,idat=[];while(p<b.length){const n=b.readUInt32BE(p),type=b.toString('ascii',p+4,p+8);assert(p+n+12<=b.length,name+' chunk boundary');assert.equal(crc32(b.subarray(p+4,p+n+8)),b.readUInt32BE(p+n+8),name+' '+type);if(type==='IDAT')idat.push(b.subarray(p+8,p+8+n));if(type==='IEND')ended=true;p+=n+12;}
 assert(ended&&p===b.length,name+' complete IEND');assert.equal(b[25],6);assert(zlib.inflateSync(Buffer.concat(idat)).length>1000);
}
assert.equal(D.frames,24);assert.equal(Object.keys(D.sheets).length,3);
const runManifest=JSON.parse(read('assets/motion/v0193/manifest.json'));
const solidBytes=fs.readFileSync(path.join(root,'assets/motion/v0193/reaper-run.png'));
assert.equal(solidBytes.length,runManifest.runtime['reaper-run.png'].bytes);
assert.equal(crypto.createHash('sha256').update(solidBytes).digest('hex'),runManifest.runtime['reaper-run.png'].sha256);
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,runManifest.source.path))).digest('hex'),runManifest.source.sha256);
assert.equal(solidBytes.readUInt32BE(16),3072);assert.equal(solidBytes.readUInt32BE(20),2304);
assert.equal(runManifest.runtime['reaper-run.png'].bounds.length,192);
assert(runManifest.runtime['reaper-run.png'].bounds.every(([l,t,r,b])=>l>=0&&t>=0&&r<192&&b<192&&r-l>50&&b-t>70));
assert(!runManifest.keys.some(k=>k.from===13||k.to===13),'Mismatched contact drawing is replaced by registered neighbouring motion');
console.log('PASS v0.18: distance-linked gait at four speeds/three refresh rates, jump/landing phases, 24 cutting poses, rigid point-leading blade through every active sample, swept collision envelope, dirty-only HUD, refresh-independent camera, skipped idle root masks, full PNG CRC/SHA integrity.');
