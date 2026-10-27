'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright'),{PNG}=require('pngjs');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'test-results');fs.mkdirSync(dir,{recursive:true});
const server=http.createServer((req,res)=>{try{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname.replace(/^\/+/,''))||'index.html');if(!file.startsWith(root+path.sep))return res.writeHead(403).end();res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));}catch(e){res.writeHead(404).end();}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader']});
 const context=await browser.newContext({viewport:{width:950,height:430},recordVideo:{dir,size:{width:950,height:430}}});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const shot=async name=>{await page.evaluate(()=>window.grimRun.step(performance.now(),0));return page.screenshot({path:path.join(dir,'polish-'+name+'.png')});};
 const stage=async meters=>{const x=await page.evaluate(m=>{
  const s=window.grimRun.scene.scenes[0];s.terrain.advance(s.startX+m*12+2400);
  const wanted=s.startX+m*12,ground=s.terrain.visibleSections(wanted,wanted+1400).find(v=>v.kind==='ground'&&v.end-v.start>100);
  const x=s.terrain.groundAt(wanted)!==null?wanted:ground.start+30;
  s.state='paused';s.godMode=true;s.hasTeleported=m>=5000;s.shrineClaimed=true;s.nextVendorNumber=15;s.lastVendorNumber=14;
  Object.assign(s.player,{x,y:s.terrain.groundAt(x),grounded:true,velocityY:0,invulMs:0,hp:3,sliding:false,holdSlide:false,airTuck:false,attackMs:0,visualFireMs:0});
  s.distance=(x-s.startX)/12;s.cameraX=x-s.width*.32;s.cameraY=s.player.y-s.groundY;s.elapsed=0;
  s.obstacles=[];s.enemies=[];s.bullets=[];s.fireballs=[];s.particles=[];s.coins=[];s.souls=[];s.soulPlatform=[];
  s.powerArt.reset();s.worldPolish.reset();s.damageFlashMs=0;s.fallFeedbackMs=0;s.bonesBlastMs=0;
  s.ui.setMode('playing');s.cameras.main.setScroll(s.cameraX,s.cameraY);s.refreshHud();s.drawScene();return x;
 },meters);await page.waitForFunction(group=>{const s=window.grimRun.scene.scenes[0];return s.biomeBackdropReady&&s.biomeBackdropGroup===group;},meters>=5000?'underworld':'surface',{timeout:45000});await page.evaluate(()=>window.grimRun.scene.scenes[0].drawScene());return x;};
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/?seed=33',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.grimRun?.scene?.scenes?.[0]?.visuals?.reaperPoseSprites?.jump,null,{timeout:45000});
  await page.locator('#start-btn').click();
  const ready=await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.sys.sceneUpdate=function(){};s._polishSkin=s.obstacleSkinFor.bind(s);s.obstacleSkinFor=o=>o.reviewSkin||s._polishSkin(o);return {ready:s.worldPolish.ready,platforms:window.GRIM_WORLD_POLISH.BIOMES.filter(b=>s.textures.exists('soul-platform-'+b))};});
  assert(Object.values(ready.ready).every(Boolean));assert.equal(ready.platforms.length,8);
  await stage(400);
  await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.coins=[{x:s.player.x+145,baseY:s.player.y,offset:-45,taken:false}];s.souls=[{x:s.player.x+280,baseY:s.player.y,offset:-74,taken:false}];});
  let min=100,max=0;const faces=new Set(),soulFrames=new Set();let fixed;
  for(let i=0;i<64;i++){
   const sample=await page.evaluate(i=>{const s=window.grimRun.scene.scenes[0];s.elapsed=i/40;s.drawScene();const c=s.worldPolish.pickups.get(s.coins[0]),a=s.worldPolish.pickups.get(s.souls[0]),m=window.GRIM_WORLD_POLISH.coinMotion(s.elapsed,s.coins[0].x);return {x:c.x,y:c.y,h:m.height,w:m.width,frame:Number(c.frame.name),soulFrame:Number(a.frame.name),soulHeight:a.displayHeight};},i);
   if(!fixed)fixed=[sample.x,sample.y];assert.deepEqual([sample.x,sample.y],fixed);assert.equal(sample.h,33.25);min=Math.min(min,sample.w);max=Math.max(max,sample.w);faces.add(sample.frame);soulFrames.add(sample.soulFrame);assert(sample.soulHeight>44&&sample.soulHeight<48);
   if([0,16,32,48].includes(i))await shot('pickup-'+i);await page.waitForTimeout(16);
  }
  assert(max/min>6);assert.equal(faces.size,12);assert.equal(soulFrames.size,8);
  // All eight authored material choices, with their finite transparent undersides.
  const gallery=await page.evaluate(()=>{
   const s=window.grimRun.scene.scenes[0];s.coins=[];s.souls=[];s.drawScene();const out=[];window._polishGallery=[];
   for(const [i,b]of window.GRIM_WORLD_POLISH.BIOMES.entries()){
    const x=18+i%4*235,y=105+Math.floor(i/4)*160;
    const image=s.add.image(x,y,'soul-platform-'+b).setOrigin(0,12/192).setDisplaySize(210,52.5).setScrollFactor(0).setDepth(41);
    const label=s.add.text(x,y-36,b.toUpperCase(),{fontSize:'13px',color:'#e6ebee',stroke:'#07101c',strokeThickness:3}).setScrollFactor(0).setDepth(42);
    window._polishGallery.push(image,label);
    const src=s.textures.get('soul-platform-'+b).getSourceImage(),canvas=document.createElement('canvas');canvas.width=src.width;canvas.height=src.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(src,0,0);const data=ctx.getImageData(0,0,src.width,src.height).data;
    let bottom=0;const tops=[];for(let x=38;x<730;x++){let top=null;for(let y=0;y<192;y++){if(data[(y*768+x)*4+3]>140){if(top===null)top=y;bottom=Math.max(bottom,y);}}if(top!==null)tops.push(top);}
    tops.sort((a,b)=>a-b);out.push({b,top:tops[Math.floor(tops.length/2)],bottom,displayBottom:(bottom-12)*210/768});
   }return out;
  });
  for(const p of gallery){assert(Math.abs(p.top-12)<=2,p.b+' registered top');assert(p.bottom<192&&p.displayBottom<50,p.b+' complete floating underside');}
  await shot('all-eight-platforms');await page.evaluate(()=>window._polishGallery.forEach(v=>v.destroy()));
  for(const m of [4840,9470]){
   await stage(m);
   const platforms=await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.soulPlatform=s.makeSoulPlatform();s.souls=s.soulPlatform.filter(p=>p.id===1||p.id===8).map(p=>({x:p.x+p.width/2,baseY:p.y,offset:-100,taken:false}));s.drawScene();return [...s.worldPolish.platforms.values()].map(v=>({h:v.displayHeight,y:v.y,key:v.texture.key}));});
   assert(platforms.length>=3);assert(platforms.every(p=>p.h<60));await page.waitForTimeout(300);await page.evaluate(()=>window.grimRun.scene.scenes[0].drawScene());await shot('floating-encounter-'+m);
  }
  // All 24 grounded cut skins in their actual renderer, on a controlled flat
  // review pad so roots can be compared consistently. Physics stays untouched.
  const biomeMeters={forest:400,foothills:1500,tundra:3500,caves:5500,crystals:6500,ashlands:7500,lava:8500,boss:11000};
  for(const [biome,m]of Object.entries(biomeMeters)){
   await stage(m);
   const roots=await page.evaluate(biome=>{
    const s=window.grimRun.scene.scenes[0],skins=window.GRIM_OBSTACLE_SPRITES.filter(v=>v.category==='cut'&&v.biome===biome),out=[];
    // Every sprite uses a real local terrain center, including sloping ground.
    for(const [i,skin]of skins.entries()){
     let x=s.player.x+105+i*205;for(let j=0;j<120&&s.terrain.groundAt(x+30)===null;j++)x+=6;
     const floor=s.terrain.groundAt(x+30);const ob={type:'bramble',x,y:floor-288,width:60,height:288,variant:i,destroyed:false,reviewSkin:skin};s.obstacles.push(ob);
    }
    s.drawScene();for(const ob of s.obstacles){const im=s.obstacleSpriteObjects.get(ob);out.push({id:ob.reviewSkin.id,y:im.y,expected:s.terrain.groundAt(ob.x+30)+s.obstacleVisualInset(ob,ob.reviewSkin)});}return out;
   },biome);for(const v of roots)assert.equal(v.y,v.expected);
   await page.waitForTimeout(200);await page.evaluate(()=>window.grimRun.scene.scenes[0].drawScene());await shot('cut-roots-'+biome);
  }
  // Compare the same abyss with the legacy backing ablated versus restored.
  for(const [biome,m]of Object.entries(biomeMeters)){
   await stage(m);
   const probe=await page.evaluate(m=>{
    const s=window.grimRun.scene.scenes[0],wanted=s.startX+m*12,gap=s.terrain.segments.find(v=>v.kind==='gap'&&v.start>=wanted);
    s.player.x=gap.start-105;s.player.y=s.terrain.groundAt(s.player.x)??gap.y0;s.distance=(s.player.x-s.startX)/12;
    s.cameraX=(gap.start+gap.end)/2-475;s.cameraY=Math.min(gap.y0,gap.y1)-275;s.cameras.main.setScroll(s.cameraX,s.cameraY);s.drawScene();window._polishGap=gap;
    return {x:Math.ceil(gap.start-s.cameraX+18),y:Math.ceil(gap.y0-s.cameraY+8),width:Math.floor(gap.end-gap.start-36)};
   },m);
   await page.waitForTimeout(150);await page.evaluate(()=>window.grimRun.scene.scenes[0].drawScene());
   const clean=PNG.sync.read(await shot('abyss-clean-'+biome));
   await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0],gap=window._polishGap,shape=s.abyssGapPolygon(gap);s.abyssFallback.fillStyle(0x0b0d16,.98).fillPoints(s.abyssBackdropPolygon(gap,shape,Math.max(36,Math.ceil(shape.width*.18))),true);});
   const legacy=PNG.sync.read(await shot('abyss-legacy-comparison-'+biome));let changed=0;
   for(let y=probe.y;y<Math.min(430,probe.y+15);y++)for(let x=probe.x;x<Math.min(950,probe.x+probe.width);x++){const j=(y*950+x)*4;if(Math.abs(clean.data[j]-legacy.data[j])+Math.abs(clean.data[j+1]-legacy.data[j+1])+Math.abs(clean.data[j+2]-legacy.data[j+2])>8)changed++;}
   assert(changed>80,biome+' removal visibly restores atmosphere above the canyon, changed '+changed);
  }
  // Run the real scythe path for each material, then animate its bounded pool.
  for(const [biome,m,material]of [['forest',400,0],['caves',5500,1],['crystals',6500,2],['lava',8500,3]]){
   await stage(m);
   const event=await page.evaluate(({biome,material})=>{
    const s=window.grimRun.scene.scenes[0],skin=window.GRIM_OBSTACLE_SPRITES.find(v=>v.category==='cut'&&v.biome===biome&&(material!==1||/fossil/.test(v.name)));
    const x=s.player.x+70,ob={type:'bramble',x,y:s.player.y-288,width:60,height:288,variant:0,destroyed:false,reviewSkin:skin};s.obstacles=[ob];s.drawScene();s.cutNearby();s.drawScene();
    return {destroyed:ob.destroyed,material:s.worldPolish.effects[0]?.material,particles:s.worldPolish.fragments.length,ghosts:s.worldPolish.ghosts.length};
   },{biome,material});assert(event.destroyed);assert.equal(event.material,material);assert.equal(event.particles,64);assert.equal(event.ghosts,1);
   for(let i=0;i<20;i++){await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.worldPolish.tick(30);s.drawScene();});if([2,7,14].includes(i))await shot('cut-'+biome+'-'+i);await page.waitForTimeout(15);}
   const done=await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.worldPolish.tick(100);s.drawScene();return {effects:s.worldPolish.effects.length,ghosts:s.worldPolish.ghosts.length,visible:s.worldPolish.fragments.filter(v=>v.visible).length};});assert.deepEqual(done,{effects:0,ghosts:0,visible:0});
  }
  await stage(1800);
  const curve=await page.evaluate(()=>{
   const s=window.grimRun.scene.scenes[0],segments=s.terrain.segments;
   const i=segments.findIndex((v,i)=>v.kind==='ground'&&v.start>s.startX+1500*12&&v.y1-v.y0<0&&segments[i+1]?.kind==='ground'&&segments[i+1].y1>segments[i+1].y0);
   const peak=segments[i].end;s.player.x=peak-120;s.player.y=s.terrain.groundAt(s.player.x);s.state='playing';s.spawnAhead=()=>{};s.enemies=[];s.obstacles=[];
   let error=0;for(let i=0;i<20;i++){s.update(0,34);error=Math.max(error,Math.abs(s.player.y-s.terrain.groundAt(s.player.x)));}s.state='paused';s.drawScene();return {error};
  });assert(curve.error<.001);await shot('rounded-hill-contact');
  // Surviving abyss: exact one-time damage, all clocks/projectiles frozen,
  // smooth authored interpolation and immediate continuation at 1.5 seconds.
  await stage(400);
  const entry=await page.evaluate(()=>{
   const s=window.grimRun.scene.scenes[0],group=s.terrain.sequences[0];s.player.x=group.startX+40;s.player.y=s.terrain.anchorAt(s.player.x)+500;s.player.hp=3;s.godMode=false;s.state='playing';s.gunCooldownMs=770;s.player.slowCooldownMs=2200;
   s.cameraX=s.player.x-s.width*.32;s.cameraY=s.terrain.anchorAt(s.player.x)-s.groundY;s.cameras.main.setScroll(s.cameraX,s.cameraY);s.rescueFromAbyss();s.drawScene();
   return {state:s.state,hp:s.player.hp,x:s.player.x,elapsed:s.elapsed,cooldown:s.gunCooldownMs,invul:s.player.invulMs,rng:s.rng.state};
  });assert.equal(entry.state,'respawning');assert.equal(entry.hp,2);
  const respawnFrames=new Set();
  for(let i=0;i<50;i++){
   const sample=await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.update(0,30);return {state:s.state,hp:s.player.hp,x:s.player.x,elapsed:s.elapsed,cooldown:s.gunCooldownMs,invul:s.player.invulMs,rng:s.rng.state,frame:Number(s.worldPolish.respawn[0].frame.name),alpha:s.worldPolish.respawn[0].alpha,body:Object.values(s.visuals.reaperPoseSprites).some(v=>v.visible)};});
   respawnFrames.add(sample.frame);for(const k of ['hp','x','elapsed','cooldown','invul','rng'])assert.equal(sample[k],entry[k],'Respawn freezes '+k);
   if(i<49)assert.equal(sample.state,'respawning');else assert.equal(sample.state,'playing');
   if(i===3)assert.equal(sample.body,false,'Fallen Reaper remains hidden during smoke gather');
   if([0,8,16,24,32,40,47,49].includes(i))await shot('respawn-'+String(i).padStart(2,'0'));await page.waitForTimeout(16);
  }
  assert.equal(respawnFrames.size,12);assert.deepEqual(errors,[]);
  console.log('PASS actual Chromium: 12 coin/8 Soul frames, fixed 1.75x bodies; 8 finite biome ledges and both live encounters; all 24 cut roots; all 8 abyss layer comparisons; 4 material destructions; grounded rounded crest; exact 1.5s smoke respawn with 12 poses, frozen world and immediate resume.');
 }finally{const video=page.video();await context.close();if(video)fs.renameSync(await video.path(),path.join(dir,'world-polish-preview.webm'));await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
