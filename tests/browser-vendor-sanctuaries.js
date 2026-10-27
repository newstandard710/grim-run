'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'test-results');fs.mkdirSync(dir,{recursive:true});
const server=http.createServer((req,res)=>{
 try{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname.replace(/^\/+/,''))||'index.html');
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));
 }catch(e){res.writeHead(404).end(String(e));}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader']});
 const context=await browser.newContext({viewport:{width:950,height:430},recordVideo:{dir,size:{width:950,height:430}}});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/?seed=33',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.grimRun?.scene?.scenes?.[0]?.visuals?.reaperPoseSprites?.jump,null,{timeout:45000});
  await page.locator('#home-enter-btn').click();await page.locator('#start-btn').click();
  await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s._vendorTestUpdate=s.sys.sceneUpdate;s.sys.sceneUpdate=function(){};s.godMode=true;s.coinCount=25;});
  for(const [kind,k]of [['angel',1],['devil',8]]){
   const world=await page.evaluate(({k})=>{
    const s=window.grimRun.scene.scenes[0],x=s.startX+k*666*12;s.terrain.advance(x+1800);
    s.player.x=x-220;s.player.y=s.terrain.groundAt(s.player.x);s.player.grounded=true;s.player.velocityY=0;
    s.obstacles=[];s.enemies=[];s.fireballs=[];s.particles=[];s.state='paused';s.hasTeleported=k>=8;
    s.distance=(s.player.x-s.startX)/12;s.cameraX=s.player.x-s.width*.32;s.cameraY=s.terrain.groundAt(x)-s.groundY;s.cameras.main.setScroll(s.cameraX,s.cameraY);
    s.ui.setMode('playing');s.refreshHud();s.drawScene();window.grimRun.step(performance.now(),0);
    const view=s.vendorArt.views.get(k),vendor=s.vendorSpriteObjects.get(k);
    return {floorWidth:view.floor.displayWidth,floorY:view.floor.y,ground:s.terrain.groundAt(x),depths:view.columns.map(v=>v.depth),
      vendorHeight:vendor.displayHeight,vendorWidth:vendor.displayWidth,vendorDepth:vendor.depth,columns:view.columns.map(v=>({key:v.texture.key,frame:v.frame.name})),floorKey:view.floor.texture.key};
   },{k});
   assert.equal(world.floorWidth,600);assert.equal(world.floorY,world.ground-3);assert(world.depths.every(d=>d===.53));
   assert.equal(world.vendorHeight,142*1.75);assert.equal(world.vendorWidth,(kind==='angel'?160:166)*1.75);assert.equal(world.vendorDepth,10);
   assert.equal(world.floorKey,'sanctuary-'+kind+'-floor');assert.equal(new Set(world.columns.map(v=>Number(v.frame))).size,2);
   await page.waitForTimeout(350);await page.evaluate(()=>window.grimRun.scene.scenes[0].drawScene());
   await page.locator('#game canvas').screenshot({path:path.join(dir,'vendor-world-'+kind+'.png')});
   const entry=await page.evaluate(k=>{
    const s=window.grimRun.scene.scenes[0];s.lastVendorNumber=k-1;s.state='playing';s.triggerVendor(k);s.drawScene();
    return {state:s.state,ms:s.vendorIntroMs,hp:s.player.hp,coins:s.coinCount,rng:s.rng.state,offers:JSON.stringify(s.pendingOffers),x:s.player.x,elapsed:s.elapsed};
   },k);
   assert.equal(entry.state,'vendorIntro');assert.equal(entry.ms,10000);
   assert(await page.locator('#upgrade-screen').evaluate(e=>e.classList.contains('hidden')),'Choices stay hidden during introduction');
   const frames=new Set();
   for(let i=0;i<60;i++){
    const sample=await page.evaluate(i=>{
     const s=window.grimRun.scene.scenes[0];s.vendorIntroMs=10000-i*50;s.drawScene();window.grimRun.step(performance.now(),0);
     return {frame:s.vendorArt.reaper.frame.name,x:s.vendorArt.reaper.x,y:s.vendorArt.reaper.y,ms:s.vendorIntroMs,merchant:s.vendorArt.merchant.displayHeight};
    },i);frames.add(Number(sample.frame));assert.equal(sample.ms,10000-i*50);assert(sample.merchant>300);
    if([12,32,50].includes(i))await page.screenshot({path:path.join(dir,'vendor-intro-'+kind+'-'+i+'.png')});
    await page.waitForTimeout(30);
   }
   assert.equal(frames.size,12,'All twelve approach/settle poses actually render');
   const frozen=await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];return {hp:s.player.hp,coins:s.coinCount,rng:s.rng.state,offers:JSON.stringify(s.pendingOffers),x:s.player.x,elapsed:s.elapsed};});
   for(const key of Object.keys(frozen))assert.equal(frozen[key],entry[key],kind+' intro preserves '+key);
   if(kind==='angel')await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.vendorIntroMs=50;s.update(0,50);});
   else await page.locator('#vendor-intro-skip').click();
   assert.equal(await page.evaluate(()=>window.grimRun.scene.scenes[0].state),'upgrade');
   const subsequent=await page.evaluate(k=>{const s=window.grimRun.scene.scenes[0];s.leaveVendor();s.triggerVendor(k+1);const state=s.state;s.leaveVendor();return state;},k);
   assert.equal(subsequent,'upgrade','Subsequent '+kind+' vendors open choices directly');
  }
  await page.evaluate(()=>{
   const s=window.grimRun.scene.scenes[0];s.startRun();s.sys.sceneUpdate=function(){};
   if(s.vendorIntroSeen.angel||s.vendorIntroSeen.devil)throw Error('Introduction flags survived a new run');
   s.state='playing';s.startChest();
  });
  const holds=[];
  for(const t of [2.3,2.65,2.9,3.2,3.5]){
   const sample=await page.evaluate(t=>{
    const s=window.grimRun.scene.scenes[0];s.chestMs=6000-t*1000;s.drawScene();window.grimRun.step(performance.now(),0);
    const a=s.powerArt,b=a.cinemaBow,hand=window.GRIM_VENDOR_DATA.relicGrips[15][0],offset=window.GRIM_VENDOR_DATA.relicGripOffsets[15],scale=s.height/760;
    return {frame:a.cinemaReaper.frame.name,x:b.x,y:b.y,rotation:b.rotation,width:b.displayWidth,origin:[b.originX,b.originY],hands:a.cinemaHands.visible,
      overlayError:Math.hypot(a.cinemaHands.x-(s.width*.37+(offset[0]-256)*scale),a.cinemaHands.y-(s.height*.82+(offset[1]-456)*scale)),
      gripError:Math.hypot(b.x-(s.width*.37+(hand[0]-256)*scale),b.y-(s.height*.82+(hand[1]-456)*scale)),glow:window.GRIM_POWER_ART.relicMotionAt(t).glow};
   },t);
   assert.equal(Number(sample.frame),15);assert.equal(sample.width,430*.17);assert(sample.hands);assert(sample.gripError<.001&&sample.overlayError<.001);assert(sample.glow>0);
   assert.deepEqual(sample.origin,[128/512,235/512]);holds.push(sample);
   if(t===2.9)await page.screenshot({path:path.join(dir,'vendor-shrine-grip-hold.png')});
   await page.waitForTimeout(180);
  }
  assert(holds.every(v=>v.x===holds[0].x&&v.y===holds[0].y&&v.rotation===holds[0].rotation),'Raised Reaper and held bow stay completely still throughout glow');
  await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.finishChest();if(!s.gunUnlocked)throw Error('Shrine reward missing');});
  assert.deepEqual(errors,[]);
  console.log('PASS actual Chromium: both 600px sanctuary grounds, 1.75x merchants, correctly layered columns/statues, first-only introductions with all 12 poses, freeze/auto/skip/reset, and a smaller hand-anchored crossbow with a still glowing hold.');
 }finally{
  const video=page.video();await context.close();if(video)fs.renameSync(await video.path(),path.join(dir,'vendor-sanctuary-preview.webm'));
  await browser.close();await new Promise(r=>server.close(r));
 }
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
