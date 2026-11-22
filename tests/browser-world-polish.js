'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright'),{PNG}=require('pngjs');
const execFile=require('node:util').promisify(require('node:child_process').execFile);
const root=path.resolve(__dirname,'..'),dir=path.join(root,'test-results');fs.mkdirSync(dir,{recursive:true});
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
 try{
  const route=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,route.replace(/^\/+/, '')||'index.html');
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  const data=fs.readFileSync(file);
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data);
 }catch{res.writeHead(404).end();}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:false,args:['--no-sandbox','--use-angle=swiftshader']});
 const context=await browser.newContext({viewport:{width:950,height:430},recordVideo:{dir,size:{width:950,height:430}}});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 // Read the X11 compositor independently of Chromium's continuous video recorder.
 async function screenFrame(){
  const {stdout}=await execFile('ffmpeg',['-hide_banner','-loglevel','error','-f','x11grab',
   '-draw_mouse','0','-video_size','1280x800','-i',process.env.DISPLAY,'-frames:v','1',
   '-threads','1','-c:v','png','-f','image2pipe','pipe:1'],{encoding:'buffer',maxBuffer:8*1024*1024,timeout:8000});
  return PNG.sync.read(stdout);
 }
 async function viewportOrigin(){
  await page.evaluate(()=>{
   const marker=document.createElement('div');marker.id='viewport-corner';
   marker.style.cssText='position:fixed;top:0;left:0;width:24px;height:12px;z-index:2147483647;background:linear-gradient(to right,#ff00e1 50%,#00ff9d 50%)';
   document.body.append(marker);
  });
  try{
   for(let attempt=0;attempt<4;attempt++){
    const frame=await screenFrame();
    for(let y=0;y<=frame.height-430;y++)for(let x=0;x<=frame.width-950;x++){
     const i=(y*frame.width+x)*4;
     if(frame.data.readUInt32BE(i)===0xff00e1ff&&frame.data.readUInt32BE(i+44)===0xff00e1ff&&
        frame.data.readUInt32BE(i+48)===0x00ff9dff&&frame.data.readUInt32BE(i+92)===0x00ff9dff)return {x,y};
    }
   }
   throw Error('Cannot locate the 950×430 browser viewport on the display');
  }finally{await page.locator('#viewport-corner').evaluate(el=>el.remove());}
 }
 async function viewportFrame(origin){
  const desktop=await screenFrame(),view=new PNG({width:950,height:430});
  PNG.bitblt(desktop,view,origin.x,origin.y,950,430,0,0);
  return view;
 }
 async function platformVisibility(visible){
  return bounded('platform render',page.evaluate(visible=>{
   const game=window.grimRun,s=game.scene.scenes[0],camera=s.cameras.main;
   if(!document.querySelector('#hud').getClientRects().length)throw Error('Platform HUD missing');
   const boxes=[];
   for(const image of s.worldPolish.platforms.values()){
    const bounds=image.getBounds();image.setVisible(visible);
    boxes.push([bounds.x-camera.scrollX,bounds.y-camera.scrollY,bounds.width,bounds.height]);
   }
   game.step(performance.now(),0);
   if(game.renderer.gl.isContextLost())throw Error('Lost platform WebGL context');
   return boxes;
  },visible));
 }
 async function bounded(stage,operation){
  let timer;
  try{
   return await Promise.race([operation,new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(Error(stage+' exceeded 30s')),30000);
   })]);
  }finally{clearTimeout(timer);}
 }
 const shot=async name=>{
  const floating=name.startsWith('floating-encounter-');
  console.log(name+' Phaser step started');
  await bounded(name+' Phaser step',page.evaluate(()=>window.grimRun.step(performance.now(),0)));
  console.log(name+' Phaser step finished');
  const file=path.join(dir,'polish-'+name+'.png');
  let pixels;
  if(floating){
   const origin=await viewportOrigin();
   let demonstrated=false;
   // Compare the actual game viewport with only the rendered ledges hidden.
   // A stale gallery frame or a changed background cannot satisfy both tests.
   for(let attempt=0;attempt<3&&!demonstrated;attempt++){
    await platformVisibility(false);
    await page.waitForTimeout(180);
    const hidden=await viewportFrame(origin);
    const boxes=await platformVisibility(true);
    for(let sample=0;sample<4&&!demonstrated;sample++){
     const shown=await viewportFrame(origin),colors=new Set();
     let ledgePixels=0,otherPixels=0;
     for(let y=60;y<345;y+=2)for(let x=10;x<940;x+=2){
      const i=4*(y*shown.width+x);
      colors.add(shown.data.readUInt32BE(i));
      const delta=[0,1,2].reduce((n,c)=>n+Math.abs(shown.data[i+c]-hidden.data[i+c]),0);
      if(delta<=30)continue;
      if(boxes.some(([bx,by,w,h])=>x>=bx-2&&x<=bx+w+2&&y>=by-2&&y<=by+h+2))ledgePixels++;
      else otherPixels++;
     }
     if(colors.size>64&&ledgePixels>100&&otherPixels<50){
      pixels=PNG.sync.write(shown);demonstrated=true;
      console.log(name+' verified '+ledgePixels+' changed platform samples, '+otherPixels+' outside');
     }
    }
   }
   assert(demonstrated,name+' must show visible, registered floating ledges in the real viewport');
   fs.writeFileSync(file,pixels);
  }else pixels=await page.screenshot({path:file,timeout:30000});
  console.log(name+' screenshot finished');
  return pixels;
 };
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
 async function startFixture(){
  await page.goto('http://127.0.0.1:'+server.address().port+'/?seed=33',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.grimRun?.scene?.scenes?.[0]?.visuals?.reaperPoseSprites?.jump,null,{timeout:45000});
  await page.locator('#home-enter-btn').click();await page.waitForTimeout(380);await page.locator('#start-btn').click();
  const ready=await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.sys.sceneUpdate=function(){};
   // All subsequent simulation ticks and render submissions belong to this fixture.
   window.grimRun.loop.sleep();clearInterval(s.loopWatchdogId);
   s._polishSkin=s.obstacleSkinFor.bind(s);s.obstacleSkinFor=o=>o.reviewSkin||s._polishSkin(o);return {ready:s.worldPolish.ready,platforms:window.GRIM_WORLD_POLISH.BIOMES.filter(b=>s.textures.exists('soul-platform-'+b))};});
  assert(Object.values(ready.ready).every(Boolean));assert.equal(ready.platforms.length,8);
 }
 try{
  await startFixture();
  await stage(400);
  await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.coins=[{x:s.player.x+145,baseY:s.player.y,offset:-45,taken:false}];s.souls=[{x:s.player.x+280,baseY:s.player.y,offset:-74,taken:false}];});
  let min=100,max=0;const faces=new Set(),soulFrames=new Set();let fixed;
  for(let i=0;i<64;i++){
   const sample=await page.evaluate(i=>{const s=window.grimRun.scene.scenes[0];s.elapsed=i/40;s.drawScene();const c=s.worldPolish.pickups.get(s.coins[0]),a=s.worldPolish.pickups.get(s.souls[0]),m=window.GRIM_WORLD_POLISH.coinMotion(s.elapsed,s.coins[0].x);return {depth:c.depth,x:c.x,y:c.y,h:m.height,w:m.width,frame:Number(c.frame.name),soulFrame:Number(a.frame.name),soulHeight:a.displayHeight};},i);
   assert(sample.depth>15,'Collectible bodies remain legible above the foreground fog');if(!fixed)fixed=[sample.x,sample.y];assert.deepEqual([sample.x,sample.y],fixed);assert.equal(sample.h,33.25);min=Math.min(min,sample.w);max=Math.max(max,sample.w);faces.add(sample.frame);soulFrames.add(sample.soulFrame);assert(sample.soulHeight>88&&sample.soulHeight<96);
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
   // Use a new game context for each distant scene, retaining this tab's video.
   await startFixture();
   await stage(m);
   await page.evaluate(()=>{
    const s=window.grimRun.scene.scenes[0];
    s.syncWorldScroll();s.biomeMidground.prioritizeTeleport(s.distance);s.drawScene();
   });
   await page.waitForFunction(()=>{
    const s=window.grimRun.scene.scenes[0],weights=window.GRIM_WORLD_ART.biomeWeights(s.distance);
    s.drawScene();window.grimRun.step(performance.now(),0);
    return Object.keys(weights).every(id=>id==='forest'||s.biomeMidground.stream.loaded.has(id));
   },null,{polling:180,timeout:45000});
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
    // Every sprite uses the real local terrain at its painted foot.
    for(const [i,skin]of skins.entries()){
     const [foot]=window.GRIM_OBSTACLE_MOUNTS[skin.id];
     const offset=30+(foot-.5)*60*s.obstacleSpriteScaleFor(skin,'bramble').x+(skin.treeOffsetX??0);
     let x=s.player.x+105+i*205;
     for(let j=0;j<120&&s.terrain.groundAt(x+offset)===null;j++)x+=6;
     const floor=s.terrain.groundAt(x+offset);
     const ob={type:'bramble',x,y:floor-288,width:60,height:288,variant:i,destroyed:false,reviewSkin:skin};
     s.obstacles.push(ob);
     out.push({ob,expected:floor+s.obstacleVisualInset(ob,skin),footX:x+offset});
    }
    s.drawScene();return out.map(({ob,expected,footX})=>{
     const im=s.obstacleSpriteObjects.get(ob);
     return {id:ob.reviewSkin.id,masked:Boolean(im.mask),shouldMask:Boolean(ob.reviewSkin.buryRoots),
      x:im.x,y:im.y,expected,footX};
    });
   },biome);for(const v of roots){assert.equal(v.x,v.footX);assert.equal(v.y,v.expected);assert.equal(v.masked,v.shouldMask);}
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
  for(const [biome,m,material]of [['forest',400,0],['caves',5500,1],['crystals',6500,2],['lava',8500,3],['tundra',3400,4]]){
   await stage(m);
   const event=await page.evaluate(({biome,material})=>{
    const s=window.grimRun.scene.scenes[0],skin=window.GRIM_OBSTACLE_SPRITES.find(v=>v.category==='cut'&&v.biome===biome&&GRIM_WORLD_POLISH.cutMaterialFor(v,'bramble')===material);
    const x=s.player.x+70,ob={type:'bramble',x,y:s.player.y-288,width:60,height:288,variant:0,destroyed:false,reviewSkin:skin};s.obstacles=[ob];s.drawScene();s.cutNearby();s.drawScene();
    return {destroyed:ob.destroyed,material:s.worldPolish.effects[0]?.material,particles:s.worldPolish.fragments.length,
      visible:s.worldPolish.fragments.filter(v=>v.visible).length,ghosts:s.worldPolish.ghosts.length};
   },{biome,material});assert.deepEqual(event,{destroyed:true,material,particles:64,visible:6,ghosts:1});
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
  const mistPhases=new Set();
  for(let i=0;i<50;i++){
   const sample=await page.evaluate(()=>{
    const s=window.grimRun.scene.scenes[0];s.update(0,30);
    const mist=s.reaperFormation,body=s.visuals.reaperPoseSprites.idle;
    return {state:s.state,hp:s.player.hp,x:s.player.x,elapsed:s.elapsed,cooldown:s.gunCooldownMs,
     invul:s.player.invulMs,rng:s.rng.state,owns:mist.ownsFall(),
     mist:[mist.rear,mist.front].map(v=>({visible:v.visible,alpha:v.alpha,key:v.texture.key})),
     legacy:s.worldPolish.respawn.some(v=>v.visible),body:body.visible,bodyAlpha:body.alpha};
   });
   if(i<49){
    assert(sample.owns&&!sample.legacy,'Shared formation owns the surviving fall');
    assert(sample.mist.every(v=>v.key==='reaper-formation-mist'));
    if(i<7)assert(sample.mist.every(v=>!v.visible),'Mist waits for the 240 ms formation start');
    if(i>=10&&i<=40)assert(sample.mist.every(v=>v.visible),'Both pooled mist layers form the body');
    if(i>=37)assert.equal(sample.bodyAlpha,1,'The 900 ms formation finishes before the lock releases');
   }
   mistPhases.add(sample.mist.map(v=>v.alpha.toFixed(3)).join(','));
   for(const k of ['hp','x','elapsed','cooldown','invul','rng'])assert.equal(sample[k],entry[k],'Respawn freezes '+k);
   if(i<49)assert.equal(sample.state,'respawning');else assert.equal(sample.state,'playing');
   if(i===3)assert.equal(sample.body,false,'Fallen Reaper remains hidden during smoke gather');
   if([0,8,16,24,32,40,47,49].includes(i))await shot('respawn-'+String(i).padStart(2,'0'));await page.waitForTimeout(16);
  }
  assert(mistPhases.size>20,'The shared mist animates through the surviving-fall lock');assert.deepEqual(errors,[]);
  console.log('PASS actual Chromium: 12 coin/8 Soul frames, fixed 1.75x bodies; 8 finite biome ledges and both live encounters; all 24 cut roots; all 8 abyss layer comparisons; 4 material destructions; grounded rounded crest; exact 1.5s surviving-fall lock with shared two-layer mist, 900ms body formation, frozen world and immediate resume.');
 }finally{const video=page.video();await context.close();if(video)fs.renameSync(await video.path(),path.join(dir,'world-polish-preview.webm'));await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
