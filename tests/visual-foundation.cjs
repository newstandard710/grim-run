'use strict';
/* Run: node tests/visual-foundation.cjs */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('index.html'),visual=read('assets/visuals/visual-system.js');
const reaper=read('assets/characters/reaper/reaper-sheet.svg'),bat=read('assets/enemies/cavern-bat/bat-sheet.svg');
assert.ok(html.includes('<script src="assets/visuals/visual-system.js?v=0.10.8-balanced-run-cycle-v1"></script>'), 'Versioned art JS avoids stale mobile cached loader');
assert.ok(html.includes('slideClearancePx: 76'),'Raised slide opening stays below the 79px standing collider');
assert.ok(html.includes('else this.visuals.beginReviewV2()'),'Twelve-pose Reaper motion art is the main-game default');
assert.ok(html.includes("artMode==='illustrated'"),'Previous illustrated art remains available for comparison');
assert.ok(html.includes("artMode==='procedural'"),'v0.10.3 procedural art remains an explicit fallback');
assert.ok(html.includes("artMode==='experimental'"),'Earlier experimental vector atlas remains available');
for(const [svg,width,height,frames] of [[reaper,768,768,16],[bat,640,256,8]]){
 assert.ok(svg.startsWith('<svg')&&svg.includes('width="'+width+'" height="'+height+'"'));
 assert.equal((svg.match(/<g(?:\s|>)/g)||[]).length,(svg.match(/<\/g>/g)||[]).length);
 assert.ok((svg.match(/<path\s/g)||[]).length>frames*3,'SVG art detail expected');
}
for(let i=0;i<16;i++)
 assert.ok(reaper.includes('<g transform="translate('+(i%4)*192+' '+Math.floor(i/4)*192+')">'));
assert.ok(reaper.includes('Slide pose occupies the actual 29px clearance'));
const ref={};vm.runInNewContext(visual,{window:ref,globalThis:ref});
const V=ref.GRIM_VISUALS;
assert.equal(V.REAPER.run.length,5);assert.equal(V.BAT.flap.length,6);
const p={grounded:true,onSoulPlatform:false,sliding:false,airTuck:false,attackMs:0,
 visualFireMs:0,invulMs:0,slowMs:0,velocityY:0,hovering:false};
const pose=(state='playing',elapsed=0,damageFlashMs=0)=>
 V.reaperPose({player:p,state,elapsed,damageFlashMs,attackDurationMs:260});
assert.ok(V.REAPER.run.includes(pose().frame));
assert.ok(Object.keys(V.ILLUSTRATED.reaper).includes('slide'));
assert.ok(Math.abs(511*V.ILLUSTRATED.reaper.slide.scale-40)<.2,'Crouch art uses the revised 40px profile');
assert.equal(V.ILLUSTRATED_RUN.length,4);assert.equal(V.ILLUSTRATED_BAT_FLAP.length,4);
assert.equal(V.ILLUSTRATED_RUN_FPS,10);assert.equal(V.ILLUSTRATED_BAT_FPS,9);
assert.deepEqual(Array.from(V.V2_REAPER_RUN),Array.from({length:8},(_,i)=>'run_pose_'+String(i+1).padStart(2,'0')));
assert.equal(V.V2_REAPER_RUN_FPS,12);
assert.ok(Math.abs(V.V2_REAPER_RUN_CYCLE_MS-666.667)<.01,'Run stride duration stays at the previous 0.67 seconds');
assert.ok(Math.abs((1421-430)*(V.V2_REAPER.hurt.scale)-120)<.2,
 'Damage pose is normalized to the same 120px visible height as the standard Reaper');
assert.deepEqual(Array.from(V.V2_REAPER_SWING),['scythe_attack','scythe_attack_02','scythe_attack_03','scythe_attack_04']);
assert.ok(V.V2_REAPER.scythe_attack_02.file.includes('scythe-swing-v2/sweep_tip-leading_v2.png'),
  'The first forward swing uses the point-leading scythe pose');
assert.equal(V.V2_REAPER_SWING_MS,260,'The new scythe sequence uses the existing attack duration');
assert.equal(V.V2_BAT_FLAP.length,8);assert.equal(V.V2_BAT_FLAP_FPS,12);
for(const pose of V.V2_REAPER_RUN)
 assert.ok(V.V2_REAPER[pose],`v2 Reaper cycle frame ${pose} has metadata`);
for(const pose of V.V2_BAT_FLAP)
 assert.ok(V.V2_BAT[pose],`v2 Bat cycle frame ${pose} has metadata`);
assert.equal(pose('paused').name,'idle');
p.grounded=false;p.velocityY=-200;assert.equal(pose().name,'jump');
p.velocityY=140;assert.equal(pose().name,'fall');
p.hovering=true;assert.equal(pose().name,'hover');
p.grounded=true;p.hovering=false;p.sliding=true;assert.equal(pose().frame,8);
p.sliding=false;p.attackMs=220;assert.equal(pose().frame,9);
p.attackMs=70;assert.equal(pose().frame,10);
p.attackMs=0;p.visualFireMs=100;assert.equal(pose().name,'fire');
p.visualFireMs=0;p.invulMs=650;assert.equal(pose('playing',1,300).name,'hurt');
assert.equal(pose('dead').name,'death');
assert.ok([4,5].includes(V.cavernBatFrame({mode:'dive',timer:.3,hp:1},1)));

const nodes=new Map(),storage=new Map();
function gfx(){let n;n=new Proxy({textContent:'',style:{setProperty(){}},
 classList:{add(){},remove(){},toggle(){},contains(){return false}},
 addEventListener(){},setAttribute(){},appendChild(){},replaceChildren(){},destroy(){},
 setFrame(frame){this.frame=frame;return this;}},
 {get(o,k){return k in o?o[k]:(...a)=>n;},set(o,k,v){o[k]=v;return true}});
 return n;
}
const node=id=>{if(!nodes.has(id))nodes.set(id,gfx());return nodes.get(id)};
const scope={window:{innerWidth:950,innerHeight:430,GRIM_VISUALS:V,addEventListener(){}},
 document:{getElementById:node,createElement:gfx,addEventListener(){},write(){}},
 localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v))},
 location:{search:'?seed=19'},URLSearchParams,
 Phaser:{Scene:class{},Game:class{},AUTO:1,Scale:{RESIZE:1,CENTER_BOTH:1}}};
vm.createContext(scope);
for(const [,attrs,code] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))
 if(!/\bsrc\s*=/.test(attrs))vm.runInContext(code,scope,{filename:'index.html'});
scope.GrimUI=scope.window.GrimUI; // Node VM global binding for the game's constructor.
const CoreApi=scope.window.GRIM_CORE,slideClearance=scope.window.GRIM_CONFIG.slideClearancePx;
const testBranch=CoreApi.obstacle('branch',180,300,0,slideClearance,430);
assert.equal(testBranch.y+testBranch.height,300-slideClearance,'Raised branch is positioned 76px above ground');
assert.equal(CoreApi.branchHits(CoreApi.collisionBox(200,300,false),testBranch,()=>300,slideClearance,false),true,
 'Standing Reaper still collides with the raised branch');
assert.equal(CoreApi.branchHits(CoreApi.collisionBox(200,300,true),testBranch,()=>300,slideClearance,true),false,
 'Ground slide still passes under the raised branch without changing collision boxes');
assert.equal(JSON.stringify(CoreApi.collisionBox(200,300,false)),JSON.stringify({x:180,y:221,width:42,height:79}));
assert.equal(JSON.stringify(CoreApi.collisionBox(200,300,true)),JSON.stringify({x:173,y:271,width:56,height:29}));
const Game=scope.window.GrimGameScene;
const game=new Game();game.scale={width:950,height:430,on(){},off(){}};
game.events={once(){}};game.add={graphics:gfx,text:gfx};game.cameras={main:{setScroll(){}}};
game.create();game.drawScene=()=>{};game.startRun();
assert.equal(game.visuals.reaperReady,false,'No art loader keeps procedural fallback');
game.nextVendorNumber=15;game.setGodMode(true);
for(let i=0;i<40;i++)game.update(0,34);
assert.ok(game.distance>0,'Game unaffected by absent artwork');
const created=[];
let done;
const imageReaper={width:768,height:768,image:true},imageBat={width:640,height:256,image:true};
const textures=new Map([
 ['gr_reaper_sheet_source',{getSourceImage:()=>imageReaper}],
 ['gr_bat_sheet_source',{getSourceImage:()=>imageBat}]
]);
let spriteSheetImageCount=0;
const browserScene={
 load:{svg(key,url,config){created.push({key,url,config});return this;},
 on(){},off(){},once(_key,fn){done=fn;},start(){done();}},
 textures:{exists:key=>textures.has(key),get:key=>textures.get(key),
 addSpriteSheet(key,source,settings){
  assert.ok(source===imageReaper||source===imageBat,
    'Phaser addSpriteSheet must receive actual DOM image, not Texture manager object');
  spriteSheetImageCount++;
  assert.equal(settings.endFrame,key==='gr_reaper_frames'?15:7);
  const sheet={key,has(frame){return Number.isInteger(frame)&&frame>=0&&frame<=settings.endFrame;}};
  textures.set(key,sheet);
  return sheet;
 }},
 add:{sprite(x,y,key,frame){
 const obj=gfx();obj.x=x;obj.y=y;
  obj.frame={name:frame};
  obj.texture=textures.get(key)||{key:'__MISSING'};
 obj.setOrigin=function(){return this};obj.setScale=function(){return this};
 obj.setDepth=function(){return this};obj.setVisible=function(v){this.visible=v;return this};
 obj.setPosition=function(x,y){this.x=x;this.y=y;return this};
 obj.setFrame=function(x){this.frame={name:x};return this};
  obj.setAlpha=function(x){this.alpha=x;return this};
 obj.setTint=function(x){this.tint=x;return this};
 obj.setRotation=function(x){this.rotation=x;return this};
 created.push(obj);return obj;
 }},
 player:{...p,x:200,y:300,grounded:true,attackMs:0,visualFireMs:0,invulMs:0},
 state:'playing',elapsed:0,frame:0,feetY:300,damageFlashMs:0,width:950,cameraX:0,enemies:[]
};
const renderer=new V.GrimVisualSystem(browserScene);
assert.equal(renderer.begin(),true);
assert.equal(renderer.reaperReady,true);assert.equal(renderer.batReady,true);
assert.equal(spriteSheetImageCount,2,'Both SVG textures generated valid sprite sheets');
assert.equal(renderer.reaper.texture.key,'gr_reaper_frames','Never render Phaser missing texture');
assert.equal(renderer.batPool.length,12);
renderer.render();
assert.ok(renderer.reaper.visible);assert.equal(renderer.reaper.y,312);
browserScene.enemies=[{kind:'bat',x:450,y:130,mode:'glide',hp:1,phase:1,dead:false}];
renderer.render();
assert.equal(renderer.batPool.filter(x=>x.visible).length,1);
browserScene.enemies=[];renderer.render();
assert.equal(renderer.batPool.filter(x=>x.visible).length,0);
browserScene.player.sliding=true;renderer.render();
assert.equal(renderer.reaper.frame.name,8);assert.equal(renderer.reaper.x,200);
assert.equal(renderer.reaper.y,312,'Changing pose does not change feet anchor');
renderer.shutdown();assert.equal(renderer.batPool.length,0);
const lost=new V.GrimVisualSystem({
 load:{svg(){},on(){},off(){},once(_k,fn){done=fn},start(){done()}},
 textures:{exists:()=>false,addSpriteSheet(){}},
 add:{sprite(){}}
});
lost.begin();assert.equal(lost.reaperReady,false);
assert.equal(lost.batReady,false);
// Reproduce production regression: texture entry exists, but addSpriteSheet
// returns a null/invalid result. Fallback must remain enabled.
let doneInvalid;
const invalid=new V.GrimVisualSystem({
  load:{svg(){},on(){},off(){},once(k,fn){doneInvalid=fn;},start(){doneInvalid();}},
  textures:{
    exists:key=>key==='gr_reaper_sheet_source'||key==='gr_bat_sheet_source',
    get:key=>({getSourceImage:()=>key==='gr_reaper_sheet_source'?imageReaper:imageBat}),
    addSpriteSheet:()=>null
  },
  add:{sprite(){throw Error('Cannot instantiate an invalid sprite sheet');}}
});
invalid.begin();
assert.equal(invalid.reaperReady,false,'Failure must leave procedural Reaper enabled');
assert.equal(invalid.batReady,false,'Failure must leave procedural Bat enabled');
assert.ok(invalid.failedAssets.length>=2);
console.log('PASS v0.10.3: vector atlas poses, static PNG mapping, safe procedural fallback, bat pool and anchored slide.');

// Previous illustrated art remains available as an explicit comparison mode.
const staticTextures=new Map(),staticNodes=[];let staticDone;
const staticScene={
 load:{image(key,file){staticTextures.set(key,{file});return this;},on(){},off(){},once(_key,fn){staticDone=fn;},start(){staticDone();}},
 textures:{exists:key=>staticTextures.has(key)},
 add:{image(x,y,key){const n=gfx();n.x=x;n.y=y;n.key=key;n.setOrigin=function(){return this};
  n.setScale=function(v){this.scale=v;return this};n.setPosition=function(x,y){this.x=x;this.y=y;return this};
  n.setVisible=function(v){this.visible=v;return this};n.setAlpha=function(v){this.alpha=v;return this};
  n.setTint=function(v){this.tint=v;return this};n.setDepth=function(){return this};
  n.setTexture=function(v){this.key=v;return this};n.setRotation=function(v){this.rotation=v;return this};
  n.destroy=function(){this.destroyed=true};staticNodes.push(n);return n;}},
 player:{...p,x:200,y:300,grounded:true,attackMs:0,visualFireMs:0,invulMs:0,slowMs:0},
 state:'playing',elapsed:0,frame:0,feetY:300,damageFlashMs:0,width:950,cameraX:0,enemies:[]
};
const staticRenderer=new V.GrimVisualSystem(staticScene);
assert.equal(staticRenderer.beginIllustrated(),true);
assert.equal(staticRenderer.reaperReady,true);assert.equal(staticRenderer.batReady,true);
assert.equal(staticRenderer.reaperPoseSprites.idle.key,'gr_ill_reaper_idle');
assert.equal(staticTextures.size,18,'Runtime loads only displayed static poses and movement cycles');
assert.equal(staticRenderer.illustratedReaperPose(),'run');
staticScene.player.sliding=true;assert.equal(staticRenderer.illustratedReaperPose(),'slide');
staticScene.player.sliding=false;staticScene.player.grounded=false;staticScene.player.velocityY=80;
assert.equal(staticRenderer.illustratedReaperPose(),'fall');
staticRenderer.shutdown();
console.log('PASS v0.10.8: balanced eight-pose run cycle, full-size damage pose, and anchored crouch slide.');
