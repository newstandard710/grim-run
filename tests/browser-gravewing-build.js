'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'test-results');fs.mkdirSync(dir,{recursive:true});
const server=http.createServer((req,res)=>{try{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1))||'index.html');if(!file.startsWith(root+path.sep))return res.writeHead(403).end();res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));}catch(e){res.writeHead(404).end();}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader']});
 const context=await browser.newContext({viewport:{width:950,height:430},hasTouch:true,recordVideo:{dir,size:{width:950,height:430}}});
 const page=await context.newPage(),errors=[],failures=[];page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)failures.push(r.url());});
 const shot=async name=>{await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:path.join(dir,'gravewing-'+name+'.png')});};
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/?seed=33',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.GRIM_FRONTEND?.ready&&window.grimRun?.scene?.scenes?.[0]?.visuals?.reaperReady,null,{timeout:60000});
  assert(await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];return s.powerArt.ready['revision-plant']&&s.powerArt.ready['gravewing-wings']&&s.combatArt.ready['bat-flight'];}));
  await page.locator('#home-enter-btn').click();await page.locator('#start-btn').click();
  await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.sys.sceneUpdate=()=>{};s.setGodMode(true);s.nextVendorNumber=15;s.obstacles=[];s.enemies=[];s.bullets=[];s.fireballs=[];s.player.invulMs=0;});
  for(const [scale,label]of [[.5,'0.5× SPEED'],[.25,'0.25× SPEED'],[0,'TIME PAUSED'],[1,'1× SPEED']]){
   await page.locator('#practice-slow-btn').tap();assert.equal(await page.evaluate(()=>window.grimRun.scene.scenes[0].practiceScale()),scale);assert.equal(await page.locator('#practice-time-label').textContent(),label);
   if(scale===0){
    const freeze=await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0],before=JSON.stringify({p:s.player,elapsed:s.elapsed,frame:s.frame,rng:s.rng.state,camera:s.cameraY});for(let i=0;i<60;i++)s.update(0,16);return before===JSON.stringify({p:s.player,elapsed:s.elapsed,frame:s.frame,rng:s.rng.state,camera:s.cameraY});});assert(freeze);await shot('time-paused');
   }
  }
  // A screen tap skips once, with no purchase or reroll behind it.
  await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.coinCount=30;s.triggerVendor(1);s.drawScene();});
  assert.equal(await page.evaluate(()=>window.grimRun.scene.scenes[0].vendorIntroMs),10000);await shot('angel-introduction');
  await page.touchscreen.tap(100,100);assert.equal(await page.evaluate(()=>window.grimRun.scene.scenes[0].state),'upgrade');assert.equal(await page.evaluate(()=>window.grimRun.scene.scenes[0].coinCount),30);
  const repeat=await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.leaveVendor();s.player.x=s.startX+(2*666-25)*12;s.player.y=s.terrain.groundAt(s.player.x);s.player.grounded=true;s.nextVendorNumber=2;const early=s.readyForVendor(2);s.player.x=s.startX+2*666*12-48;s.player.y=s.terrain.groundAt(s.player.x);const atMerchant=s.readyForVendor(2);s.update(0,0);return {early,atMerchant,state:s.state};});assert(!repeat.early&&repeat.atMerchant&&repeat.state==='upgrade');
  // Renderer follows every one of the sixteen bite poses at one fixed root.
  await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.leaveVendor();s.state='paused';s.ui.setMode('playing');s.player.x=s.startX+3400*12;s.distance=3400;s.terrain.advance(s.player.x+1500);const x=s.player.x+190;s.obstacles=[{type:'snappingBramble',x,y:s.terrain.anchorAt(x)-62,width:62,height:62,variant:0,destroyed:false,dealtDamage:false}];s.player.y=s.terrain.groundAt(s.player.x);s.cameraX=s.player.x-s.width*.32;s.cameraY=s.player.y-s.groundY;s.cameras.main.setScroll(s.cameraX,s.cameraY);});
  const frames=new Set(),positions=[];
  for(let i=0;i<16;i++){
   const info=await page.evaluate(i=>{const s=window.grimRun.scene.scenes[0],o=s.obstacles[0];if(i<3){o.plantState='idle';s.elapsed=(Math.acos(1-i)+Math.PI*8)/.9;}else if(i<6){o.plantState='windup';o.plantMs=(i-2)/3*420;}else if(i<12){o.plantState='strike';o.plantMs=(i-5)/6*260;}else{o.plantState='recover';o.plantMs=(i-11)/4*600;}s.drawScene();const v=s.obstacleSpriteObjects.get(o);return {frame:Number(v.frame.name),x:v.x,y:v.y,origin:[v.originX,v.originY],size:[v.displayWidth,v.displayHeight],alpha:v.alpha};},i);
   frames.add(info.frame);positions.push([info.x,info.y]);assert.deepEqual(info.origin,[245/384,375/400]);assert(Math.abs(info.size[0]-294.912)<.001&&Math.abs(info.size[1]-307.2)<.001);
   if([0,5,9,15].includes(i))await shot('plant-'+i);await page.waitForTimeout(45);
  }
  assert.equal(frames.size,16);assert(positions.every(p=>JSON.stringify(p)===JSON.stringify(positions[0])));
  // Inspect a sub-frame blend as well as exact poses; it must not inherit alpha/origin.
  const blend=await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0],o=s.obstacles[0];o.plantState='strike';o.plantMs=100;s.drawScene();const a=s.obstacleSpriteObjects.get(o);return {sum:a.alpha+a.plantNext.alpha,same:a.x===a.plantNext.x&&a.y===a.plantNext.y&&a.originX===a.plantNext.originX};});assert(Math.abs(blend.sum-1)<1e-9&&blend.same);
  // Acquiring the second wing displays the named offer and transforms into its own art.
  await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.obstacles=[];s.enemies=[];s.state='playing';s.player.hp=s.player.maxHp=8;s.powerManager.levels.ravenWings=1;s.vendorIntroSeen.devil=true;s.lastVendorNumber=7;s.triggerVendor(8);s.pendingOffers=[s.powerManager.devilEligible().find(o=>o.id==='skeletalWings')];s.showVendor();s.drawScene();});
  assert.equal(await page.locator('.reward-name').textContent(),'GRAVEWING ASCENSION');await shot('combo-offer');await page.locator('.reward-card').tap();
  assert.equal(await page.evaluate(()=>window.grimRun.scene.scenes[0].powerManager.level('skeletalWings')),1);await shot('combo-acquired');
  await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.leaveVendor();s.state='paused';s.ui.setMode('playing');s.player.grounded=false;s.player.onSoulPlatform=false;s.player.y=s.terrain.anchorAt(s.player.x)-70;s.player.invulMs=0;s.player.visualHurtMs=0;s.elapsed=.14;s.drawScene();});
  for(const tuck of [false,true]){
   const wings=await page.evaluate(tuck=>{const s=window.grimRun.scene.scenes[0];s.player.airTuck=tuck;s.player.hovering=!tuck;s.drawScene();return s.powerArt.wingSprites.filter(v=>v.visible).map(v=>({key:v.texture.key,frame:Number(v.frame.name),scale:v.scaleX}));},tuck);
   assert(wings.length>=1&&wings.every(v=>v.key==='gravewing-wings'&&(tuck?v.frame>=8:v.frame<8)));await shot(tuck?'combo-tuck':'combo-hover');
  }
  await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.player.grounded=true;s.player.airTuck=false;s.player.hovering=false;s.player.y=s.terrain.anchorAt(s.player.x);s.powerArt.reset();s.powerManager.levels.brittleBones=4;s.powerArt.trigger('brittleBones',s.player.x,s.feetY-45,'blast',4);s.powerArt.tick(350);s.drawScene();});await shot('bones');
  const bones=await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];return s.powerArt.bonePool.filter(v=>v.visible).map(v=>v.displayWidth);});assert.equal(bones.length,44);assert(bones.every(v=>v>=45&&v<=105));
  // Actual upgraded projectiles use the 3x render path at their real muzzle.
  await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.powerArt.reset();s.gunUnlocked=true;s.gunCooldownMs=0;s.player.visualFireMs=0;s.state='playing';s.powerManager.levels.rapidFire=3;s.powerManager.levels.powerShot=3;s.fireCrossbow();s.updateCombat(60,.06);s.state='paused';s.drawScene();});await shot('crossbow-projectile');
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);console.log('PASS Chromium v0.19: loaded authored art, four touch time states/freeze, full-screen vendor skip, repeat merchant timing, sixteen fixed-root bite poses/blends, named acquisition, integrated hover/tuck wings, large bones and crossbow capture.');
 }finally{const video=page.video();await context.close();if(video)fs.renameSync(await video.path(),path.join(dir,'gravewing-animation-preview.webm'));await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
