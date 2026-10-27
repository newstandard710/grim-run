'use strict';
/* Run: node tests/visual-foundation.cjs */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('index.html'),visual=read('assets/visuals/visual-system.js');
const worldArt=read('assets/visuals/world-art.js');
const reaper=read('assets/characters/reaper/reaper-sheet.svg'),bat=read('assets/enemies/cavern-bat/bat-sheet.svg');
assert.ok(html.includes('<script src="assets/visuals/world-art.js?v=0.13.6-abyss-fog"></script>'),
 'Versioned world-art JS avoids stale mobile cached art');
assert.ok(html.includes('<script src="assets/visuals/visual-system.js?v=0.19.0"></script>'),
 'Versioned character-art JS avoids stale mobile cached loader');
assert.ok(html.includes('ABYSS_BACKDROP_FILES')&&
 html.includes("this.load.image(key,'assets/visuals/terrain/'+key+'.webp?v=0.13.6-abyss-fog')"),
 'Biome-specific abyss paintings load in the production scene');
assert.ok(html.includes("this.load.image('abyss-fog','assets/visuals/terrain/abyss-fog-v1.webp?v=0.13.6-abyss-fog')")&&
 html.includes('const ABYSS_FOG_LAYER_ALPHA=.34')&&
 html.includes('this.abyssFogView(section,shape,id,alpha,activeAbyssFogViews)')&&
 html.includes('.setDepth(.46)')&&html.includes('this.pruneAbyssFogViews(activeAbyssFogViews)'),
 'Shared translucent fog stays above the abyss art, below ground, and is pruned with offscreen gaps');
assert.ok(fs.statSync(path.join(__dirname,'..','assets','visuals','terrain','abyss-fog-v1.webp')).size>50000,
 'Transparent abyss fog texture is present as a full-resolution runtime asset');
assert.ok(html.includes('this.add.image(0,0,textureKey)')&&
 html.includes('this.abyssBackdropView(section,shape,')&&
 !html.includes('abyssTextureView('),
 'Abyss art uses individual background images instead of repeated tile textures');
assert.ok(html.includes('left.push({x:section.start,y:y0}')&&
 html.includes('right.push({x:section.end,y:y1}')&&
 !html.includes('drawAbyssRim'),
 'The art opening starts at the real terrain endpoints and shapes its own small lip');
assert.ok(!html.includes('abyss-canyon-v1.webp')&&!html.includes('abyss-lava-v1.webp')&&
 !html.includes('UNDERWORLD_ABYSS_PALETTE')&&!html.includes('lavaY='),
 'The previous canyon texture and flat lava treatments are removed');
for(const asset of ['abyss-depth-forest.webp','abyss-depth-foothills.webp',
 'abyss-depth-tundra.webp','abyss-depth-caves.webp','abyss-depth-crystals.webp',
 'abyss-depth-ashlands.webp','abyss-depth-lava.webp','abyss-depth-boss.webp'])
 assert.ok(fs.statSync(path.join(__dirname,'..','assets','visuals','terrain',asset)).size>50000,
   `${asset} is a complete biome-specific depth illustration`);
for(const asset of ['abyss-canyon-gap-01.webp','abyss-canyon-gap-02.webp',
 'abyss-lava-gap-01.webp','abyss-lava-gap-02.webp'])
 assert.ok(!fs.existsSync(path.join(__dirname,'..','assets','visuals','terrain',asset)),
   `${asset} is removed from the old shared-art attempt`);
assert.ok(html.includes('const ABYSS_BACKDROP_BLEED_MIN=36')&&
 html.includes('const displayWidth=displayHeight*aspect')&&
 html.includes('const ABYSS_ART_TOP_INSET_PX=34')&&
 html.includes('const ABYSS_ART_TOP_JITTER_PX=14')&&
 html.includes('Math.ceil(width/14)')&&
 html.includes('setOrigin(.5,0)')&&html.includes('setRotation(rotation)')&&
 html.includes('abyssBackdropTopEdge(section,ABYSS_ART_TOP_INSET_PX)')&&
 html.includes('shape.right.slice().reverse()')&&
 html.includes('x:point.x-bleed')&&html.includes('x:point.x+bleed'),
 'Cropped abyss plates retain proportions, align to both lips, trace a valid mask, and overlap beneath both edges');
assert.ok(html.includes('const ABYSS_OPENING_LIP_MAX=13')&&
 html.includes('ABYSS_BACKDROP_BLEED_RATIO=.18')&&
 !html.includes('abyssCliffEdgeView(')&&!html.includes('abyssCliffStyle('),
 'The paintings make their own jagged opening lip and no separate filler face is rendered');
assert.ok(!fs.existsSync(path.join(__dirname,'..','assets','visuals','terrain','abyss-canyon-v1.webp'))&&
 !fs.existsSync(path.join(__dirname,'..','assets','visuals','terrain','abyss-lava-v1.webp')),
 'The previous tiled canyon and lava assets are removed from the release');
assert.ok(html.includes('slideClearancePx: 76'),'Raised slide opening stays below the 79px standing collider');
assert.ok(html.includes('else this.visuals.beginReviewV2()'),'Twelve-pose Reaper motion art is the main-game default');
assert.ok(html.includes("artMode==='illustrated'"),'Previous illustrated art remains available for comparison');
assert.ok(html.includes("artMode==='procedural'"),'v0.10.3 procedural art remains an explicit fallback');
assert.ok(html.includes("artMode==='experimental'"),'Earlier experimental vector atlas remains available');
assert.ok(html.includes('this.visuals.skeletalBatArtEnabled=true'),'Approved Skeletal Bat art is the default');
assert.ok(html.includes('this.visuals.boneCrawlerReviewRequested=true'),'Approved Bone Crawler art is the default');
assert.ok(html.includes('this.visuals.emberImpReviewRequested=true'),'Approved Ember Imp art is the default');
assert.ok(html.includes('this.updateBiomeBackdrops();'),'Approved biome image layers draw in the main scene');
assert.ok(!html.includes('drawAtmosphere('),'Legacy procedural skies and silhouettes are removed from the renderer');
assert.ok(!html.includes('drawWorldDetails'),'Legacy procedural overlays are not called over the biome images');
assert.ok(!html.includes('worldReviewMode'),'Old background review routes are removed');
assert.ok(html.includes('scope.GRIM_WORLD_ART.drawOpeningGround'),'Opening-forest ground art remains a drawing-only layer');
assert.ok(html.includes('scope.GRIM_WORLD_ART.drawFoothillsGround'),'Foothills ground art remains a drawing-only layer');
assert.ok(html.includes('scope.GRIM_WORLD_ART.drawTundraGround'),'Tundra ground art remains a drawing-only layer');
const worldScope={};vm.runInNewContext(worldArt,{window:worldScope,globalThis:worldScope});
assert.equal(typeof worldScope.GRIM_WORLD_ART.drawOpeningGround,'function');
assert.equal(typeof worldScope.GRIM_WORLD_ART.drawFoothillsGround,'function');
assert.equal(typeof worldScope.GRIM_WORLD_ART.drawTundraGround,'function');
for(const legacyBackground of ['drawRidge','drawPines','drawRollingHills','drawMountainRange',
 'drawOpeningForest','drawFoothills(','drawTundra(','drawCavernSilhouettes',
 'drawAshlandSilhouettes','drawLavaAtmosphere','drawCastleSilhouettes',
 'drawUnderworldDetails','drawSurfaceDetails','drawWorldDetails'])
 assert.ok(!worldArt.includes(legacyBackground),`Legacy background routine ${legacyBackground} is removed`);
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
assert.equal(V.V2_REAPER_RUN_BOB_PX,1.75,'Run bob stays within a subtle 1.75px range');
assert.equal(V.V2_REAPER_RUN_BOBS_PER_CYCLE,2,'Head bob follows both steps of each stride');
assert.ok(Math.abs((1421-430)*(V.V2_REAPER.hurt.scale)-120)<.2,
 'Damage pose is normalized to the same 120px visible height as the standard Reaper');
assert.deepEqual(Array.from(V.V2_REAPER_SWING),['scythe_attack','scythe_attack_02','scythe_attack_03','scythe_attack_04']);
assert.ok(V.V2_REAPER.scythe_attack_02.file.includes('scythe-swing-v2/sweep_tip-leading_v2.png'),
  'The first forward swing uses the point-leading scythe pose');
assert.equal(V.V2_REAPER_SWING_MS,260,'The new scythe sequence uses the existing attack duration');
assert.equal(V.V2_BAT_FLAP.length,8);assert.equal(V.V2_BAT_FLAP_FPS,12);
assert.equal(V.V2_SKELETAL_BAT_ATLAS.width,1254);assert.equal(V.V2_SKELETAL_BAT_ATLAS.height,1254);
assert.ok(Math.abs(314*V.V2_SKELETAL_BAT_ATLAS.scale-58)<.01,
  'Skeletal Bat target silhouette is slightly larger than the 52px Cavern Bat');
assert.equal(V.V2_SKELETAL_BAT_FRAMES.length,8);
assert.deepEqual(Array.from(V.V2_SKELETAL_BAT_FLAP),['flap_raised','flap_mid_down','flap_lowered','flap_mid_up']);
assert.equal(V.V2_SKELETAL_BAT_FLAP_FPS,12);
assert.equal(V.V2_BONE_CRAWLER_FRAMES.length,4);
assert.equal(V.V2_BONE_CRAWLER_FPS,8);
assert.ok(Math.abs(V.V2_BONE_CRAWLER_SCALE*1065-100)<.01,
  'Bone Crawler canvas scale is 2.5x the original phone-review size');
assert.ok(V.V2_BONE_CRAWLER_FRAMES.every(frame=>frame.width===1477&&frame.height===1065),
  'Bone Crawler frames share a stable canvas and registration');
assert.deepEqual([V.V2_EMBER_IMP_ATLAS.width,V.V2_EMBER_IMP_ATLAS.height],[768,512]);
assert.equal(V.V2_EMBER_IMP_FRAMES.length,6);
assert.deepEqual(Array.from(V.V2_EMBER_IMP_RUN),['run_01','run_02','run_03','run_04']);
assert.equal(V.V2_EMBER_IMP_FPS,8);
assert.ok(Math.abs(175*V.V2_EMBER_IMP_ATLAS.scale-55)<.01,
  'Ember Imp target silhouette is about 55px at gameplay scale');
assert.deepEqual(Array.from(V.V2_EMBER_IMP_ATLAS.origin),[.5,245/256]);
for(const frame of V.V2_EMBER_IMP_FRAMES)
 assert.ok(frame.x>=0&&frame.y>=0&&frame.x+frame.width<=768&&frame.y+frame.height<=512,
   `Ember Imp frame ${frame.name} stays inside the source atlas`);
for(const frame of V.V2_SKELETAL_BAT_FRAMES){
 assert.ok(frame.x>=0&&frame.y>=0&&frame.x+frame.width<=1254&&frame.y+frame.height<=1254,
   `Skeletal Bat frame ${frame.name} stays inside the source atlas`);
}
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
const CoreApi=scope.window.GRIM_CORE,CombatApi=scope.window.GRIM_COMBAT,
 slideClearance=scope.window.GRIM_CONFIG.slideClearancePx;
const testBranch=CoreApi.obstacle('branch',180,300,0,slideClearance,430);
assert.equal(testBranch.y+testBranch.height,300-slideClearance,'Raised branch is positioned 76px above ground');
assert.equal(CoreApi.branchHits(CoreApi.collisionBox(200,300,false),testBranch,()=>300,slideClearance,false),true,
 'Standing Reaper still collides with the raised branch');
assert.equal(CoreApi.branchHits(CoreApi.collisionBox(200,300,true),testBranch,()=>300,slideClearance,true),false,
 'Ground slide still passes under the raised branch without changing collision boxes');
assert.equal(JSON.stringify(CoreApi.collisionBox(200,300,false)),JSON.stringify({x:180,y:221,width:42,height:79}));
assert.equal(JSON.stringify(CoreApi.collisionBox(200,300,true)),JSON.stringify({x:173,y:271,width:56,height:29}));
assert.deepEqual(JSON.parse(JSON.stringify(CombatApi.CRAWLER_HITBOX)),{width:95,height:105,footOffset:46},
 'Crawler collision dimensions grow 2.5x with the visible art');
const crawlerCollision=CombatApi.rectFor({kind:'crawler',x:250,y:600-CombatApi.CRAWLER_HITBOX.footOffset});
assert.deepEqual(JSON.parse(JSON.stringify(crawlerCollision)),{x:202.5,y:495,width:95,height:105},
 'Larger crawler hitbox stays centered and aligned to the ground');
assert.equal(crawlerCollision.y+crawlerCollision.height,600);
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
staticScene.combatArt={ready:{'bat-flight':true}};
staticScene.enemies=[{kind:'bat',x:450,y:120,mode:'glide',hp:2,phase:0,dead:false}];
staticRenderer.renderIllustrated();
assert.equal(staticRenderer.batPool[0].visible,true,'The explicit illustrated fallback keeps its bats when the default combat atlas is loaded');
staticRenderer.shutdown();

const skeletalEnemy={kind:'skeletalBat',x:450,y:120,mode:'glide',hp:2,phase:0,dead:false};
const skeletalScene={state:'playing',cameraX:0,width:950,elapsed:0,enemies:[skeletalEnemy]};
const skeletonFrame=()=>({setOrigin(){return this},setScale(v){this.scale=v;return this},
 setPosition(x,y){this.x=x;this.y=y;return this},setFrame(v){this.frame=v;return this},
 setVisible(v){this.visible=v;return this},setAlpha(v){this.alpha=v;return this},
 setRotation(v){this.rotation=v;return this},destroy(){this.destroyed=true}});
const skeletalRenderer=new V.GrimVisualSystem(skeletalScene);
skeletalRenderer.skeletalBatReady=true;
skeletalRenderer.skeletalBatPool=Array.from({length:12},skeletonFrame);
skeletalRenderer.renderSkeletalBats();
assert.equal(skeletalRenderer.skeletalBatPool[0].frame,'flap_raised');
assert.ok(Math.abs(314*skeletalRenderer.skeletalBatPool[0].scale-58)<.01);
skeletalEnemy.mode='telegraph';skeletalRenderer.renderSkeletalBats();
assert.equal(skeletalRenderer.skeletalBatPool[0].frame,'telegraph');
skeletalEnemy.mode='dive';skeletalRenderer.renderSkeletalBats();
assert.equal(skeletalRenderer.skeletalBatPool[0].frame,'dive');
skeletalEnemy.hp=1;skeletalScene.elapsed=.04;skeletalRenderer.renderSkeletalBats();
assert.equal(skeletalRenderer.skeletalBatPool[0].frame,'hit');
skeletalEnemy.dead=true;skeletalScene.elapsed=.06;skeletalRenderer.renderSkeletalBats();
assert.equal(skeletalRenderer.skeletalBatPool[0].frame,'death');
skeletalScene.elapsed=.5;skeletalRenderer.renderSkeletalBats();
assert.equal(skeletalRenderer.skeletalBatPool[0].visible,false,'Defeat pose ends and returns the enemy to normal cleanup');
skeletalRenderer.shutdown();

const crawlerEnemy={kind:'crawler',x:450,y:280,phase:0,dead:false};
const crawlerScene={state:'playing',cameraX:0,width:950,elapsed:0,enemies:[crawlerEnemy]};
const crawlerFrame=()=>({setTexture(v){this.key=v;return this},setOrigin(x,y){this.origin=[x,y];return this},
 setScale(v){this.scale=v;return this},setPosition(x,y){this.x=x;this.y=y;return this},
 setFlipX(v){this.flipX=v;return this},
 setVisible(v){this.visible=v;return this},setAlpha(v){this.alpha=v;return this},
 setRotation(v){this.rotation=v;return this},destroy(){this.destroyed=true}});
const crawlerRenderer=new V.GrimVisualSystem(crawlerScene);
crawlerRenderer.boneCrawlerReady=true;
crawlerRenderer.boneCrawlerPool=Array.from({length:12},crawlerFrame);
for(let i=0;i<4;i++){
 crawlerScene.elapsed=i/V.V2_BONE_CRAWLER_FPS;
 crawlerRenderer.renderBoneCrawlers();
 const sprite=crawlerRenderer.boneCrawlerPool[0],meta=V.V2_BONE_CRAWLER_FRAMES[i];
 assert.equal(sprite.key,meta.key,'Crawler animation selects '+meta.name);
 assert.equal(sprite.visible,true);
 assert.deepEqual(sprite.origin,[.5,.5]);
 assert.equal(sprite.flipX,true,'Each crawler pose is mirrored to face right');
 assert.equal(sprite.x,crawlerEnemy.x);assert.equal(sprite.y,crawlerEnemy.y);
 assert.ok(Math.abs(sprite.scale*1065-100)<.01);
}
crawlerEnemy.dead=true;crawlerRenderer.renderBoneCrawlers();
assert.equal(crawlerRenderer.boneCrawlerPool[0].visible,false,'Dead crawler returns to normal cleanup');
crawlerRenderer.shutdown();assert.equal(crawlerRenderer.boneCrawlerReady,false);
const impEnemy={kind:'imp',x:450,y:280,phase:0,dead:false,hp:2,warningMs:0};
const impScene={state:'playing',cameraX:0,width:950,elapsed:0,enemies:[impEnemy],fireballs:[]};
const impFrame=()=>({setOrigin(x,y){this.origin=[x,y];return this},setScale(v){this.scale=v;return this},
 setPosition(x,y){this.x=x;this.y=y;return this},setFrame(v){this.frame=v;return this},
 setVisible(v){this.visible=v;return this},setAlpha(v){this.alpha=v;return this},
 setRotation(v){this.rotation=v;return this},destroy(){this.destroyed=true}});
const impRenderer=new V.GrimVisualSystem(impScene);
impRenderer.emberImpReady=true;impRenderer.emberImpPool=Array.from({length:12},impFrame);
for(let i=0;i<V.V2_EMBER_IMP_RUN.length;i++){
 impScene.elapsed=i/V.V2_EMBER_IMP_FPS;impScene.fireballs=[];impRenderer.renderEmberImps();
 const sprite=impRenderer.emberImpPool[0];
 assert.equal(sprite.frame,V.V2_EMBER_IMP_RUN[i],'Imp run cycle selects '+V.V2_EMBER_IMP_RUN[i]);
 assert.deepEqual(sprite.origin,[.5,245/256]);assert.ok(Math.abs(sprite.scale*175-55)<.01);
 assert.equal(sprite.x,impEnemy.x);assert.equal(sprite.y,impEnemy.y+22);
}
impEnemy.warningMs=470;impRenderer.renderEmberImps();
assert.equal(impRenderer.emberImpPool[0].frame,'warning','Existing warning selects the tell pose');
impEnemy.warningMs=0;impScene.fireballs=[{owner:impEnemy,ageMs:0,dead:false}];
impRenderer.renderEmberImps();
assert.equal(impRenderer.emberImpPool[0].frame,'release','Newly launched fireball selects the release pose');
impScene.fireballs[0].ageMs=261;impRenderer.renderEmberImps();
assert.equal(impRenderer.emberImpPool[0].frame,'run_04','Imp returns to its run cycle after release');
assert.equal(CombatApi.rectFor(impEnemy).width,38);assert.equal(CombatApi.rectFor(impEnemy).height,42);
impEnemy.dead=true;impRenderer.renderEmberImps();
assert.equal(impRenderer.emberImpPool[0].visible,false,'Dead Imp returns to normal cleanup');
impRenderer.shutdown();assert.equal(impRenderer.emberImpReady,false);
console.log('PASS v0.11.10 preview: approved biome images are the only backdrop art; ground art and gameplay geometry remain intact.');
