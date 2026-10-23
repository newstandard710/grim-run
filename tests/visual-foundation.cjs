'use strict';
/* Run: node tests/visual-foundation.cjs */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('index.html'),visual=read('assets/visuals/visual-system.js');
const reaper=read('assets/characters/reaper/reaper-sheet.svg'),bat=read('assets/enemies/cavern-bat/bat-sheet.svg');
assert.ok(html.includes('<script src="assets/visuals/visual-system.js"></script>'));
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
const textures=new Map([['gr_reaper_sheet_source',{}],['gr_bat_sheet_source',{}]]);
const browserScene={
 load:{svg(key,url,config){created.push({key,url,config});return this;},
 on(){},off(){},once(_key,fn){done=fn;},start(){done();}},
 textures:{exists:key=>textures.has(key),get:key=>textures.get(key),
 addSpriteSheet(key,source,settings){textures.set(key,source);
 assert.equal(settings.endFrame,key==='gr_reaper_frames'?15:7);}},
 add:{sprite(x,y,key,frame){
 const obj=gfx();obj.x=x;obj.y=y;obj.frame=frame;obj.texture=key;
 obj.setOrigin=function(){return this};obj.setScale=function(){return this};
 obj.setDepth=function(){return this};obj.setVisible=function(v){this.visible=v;return this};
 obj.setPosition=function(x,y){this.x=x;this.y=y;return this};
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
assert.equal(renderer.batPool.length,12);
renderer.render();
assert.ok(renderer.reaper.visible);assert.equal(renderer.reaper.y,312);
browserScene.enemies=[{kind:'bat',x:450,y:130,mode:'glide',hp:1,phase:1,dead:false}];
renderer.render();
assert.equal(renderer.batPool.filter(x=>x.visible).length,1);
browserScene.enemies=[];renderer.render();
assert.equal(renderer.batPool.filter(x=>x.visible).length,0);
browserScene.player.sliding=true;renderer.render();
assert.equal(renderer.reaper.frame,8);assert.equal(renderer.reaper.x,200);
assert.equal(renderer.reaper.y,312,'Changing pose does not change feet anchor');
renderer.shutdown();assert.equal(renderer.batPool.length,0);
const lost=new V.GrimVisualSystem({
 load:{svg(){},on(){},off(){},once(_k,fn){done=fn},start(){done()}},
 textures:{exists:()=>false,addSpriteSheet(){}},
 add:{sprite(){}}
});
lost.begin();assert.equal(lost.reaperReady,false);
assert.equal(lost.batReady,false);
console.log('PASS v0.10.0: vector atlas poses, visual-gameplay decoupling, safe fallback, deterministic animations, bat pool and anchored slide.');
