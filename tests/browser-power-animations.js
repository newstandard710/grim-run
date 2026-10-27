'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'test-results');
fs.mkdirSync(dir,{recursive:true});
const server=http.createServer((req,res)=>{
  try{
    const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname.replace(/^\/+/,''))||'index.html';
    const file=path.resolve(root,rel);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
    const types={'.html':'text/html','.js':'application/javascript','.png':'image/png','.webp':'image/webp'};
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));
  }catch(e){res.writeHead(404).end(String(e));}
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader']});
  const context=await browser.newContext({viewport:{width:950,height:430},recordVideo:{dir,size:{width:950,height:430}}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  try{
    await page.goto('http://127.0.0.1:'+server.address().port+'/?seed=33',{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForFunction(()=>window.grimRun?.scene?.scenes?.[0]?.visuals?.reaperReady,null,{timeout:45000});
    await page.waitForFunction(()=>window.grimRun.scene.scenes[0].visuals.reaperPoseSprites.hover,null,{timeout:45000});
    await page.locator('#home-enter-btn').click();await page.locator('#start-btn').click();
    await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.state='paused';s.ui.setMode('playing');s.obstacles=[];s.enemies=[];});
    const ready=await page.evaluate(()=>{
      const s=window.grimRun.scene.scenes[0],a=s.powerArt;
      const canv=document.createElement('canvas');canv.width=512;canv.height=512;const c=canv.getContext('2d');
      const coverage=[];
      for(let i=0;i<15;i++){
        c.clearRect(0,0,512,512);const f=s.textures.getFrame('power-reaper',i);
        c.drawImage(f.source.image,f.cutX,f.cutY,f.cutWidth,f.cutHeight,0,0,512,512);
        const bytes=c.getImageData(0,0,512,512).data;let n=0;
        for(let p=3;p<bytes.length;p+=4)if(bytes[p]>90)n++;
        coverage.push(n);
      }
      return {ready:a.ready,coverage,wingDepths:a.wingSprites.map(v=>v.depth),reaperDepth:s.visuals.reaper.depth};
    });
    assert(Object.values(ready.ready).every(Boolean),'All power atlases have decoded Phaser frames');
    assert(ready.wingDepths.every(d=>d<ready.reaperDepth),'Wing attachments must stay behind the Reaper body and face');
    assert(ready.coverage.every(n=>n>3000&&n<512*512*.7),'Every action is nonblank and transparent');
    const setup=async(mode,elapsed=1)=>page.evaluate(({mode,elapsed})=>{
      const s=window.grimRun.scene.scenes[0],p=s.player;s.powerArt.reset();s.state='paused';s.elapsed=elapsed;
      s.distance=2500;p.x=s.startX+2500*12;const ground=s.terrain.anchorAt(p.x);
      s.cameraX=p.x-s.width*.32;s.cameraY=ground-s.groundY;s.cameras.main.setScroll(s.cameraX,s.cameraY);
      p.y=ground-25;p.grounded=false;p.onSoulPlatform=false;p.velocityY=0;p.attackMs=0;p.airTuck=false;p.holdSlide=false;
      p.invulMs=0;p.slowMs=0;p.visualFireMs=0;p.visualTuckReleaseMs=0;p.airJumpUsed=false;
      s.powerManager.levels.ravenWings=4;s.powerManager.levels.skeletalWings=4;
      p.hovering=true;p.hoverBudgetMs=1100;p.visualTuckMs=220;
      if(mode==='tuck'){p.airTuck=true;p.hovering=false;}
      if(mode==='attack'){p.attackMs=150;p.hovering=false;}
      if(mode==='tuck-attack'){p.airTuck=true;p.attackMs=150;p.hovering=false;}
      s.drawScene();window.grimRun.step(performance.now(),0);
      s.ui.update(p.hp,p.maxHp,s.distance,s.soulCount,s.coinCount,s.points,s.powerManager.summary());
      return {frame:s.powerArt.action?.frame.name,visible:s.powerArt.action?.visible,
        wings:s.powerArt.wingSprites.filter(v=>v.visible).map(v=>Number(v.frame.name)),x:p.x,y:p.y};
    },{mode,elapsed});
    const wingFrames=[];
    for(let i=0;i<4;i++){
      const info=await setup('hover',(i+.1)/8);wingFrames.push(info.wings);
      assert.equal(info.wings.length,2);assert(info.wings[0]<4&&info.wings[1]>=8,'Combined loadout selects alternate skeletal set');
      await page.waitForTimeout(180);
    }
    assert.equal(new Set(wingFrames.map(JSON.stringify)).size,4,'Wings articulate through four poses');
    for(const [name,raven,bone,tuck] of [['raven',4,0,false],['skeletal',0,4,false],['combined',4,4,false],['combined-tuck',4,4,true]]){
      await setup(tuck?'tuck':'hover');
      const measure=await page.evaluate(({raven,bone})=>{
        const s=window.grimRun.scene.scenes[0],a=s.powerArt;s.powerManager.levels.ravenWings=raven;s.powerManager.levels.skeletalWings=bone;s.drawScene();
        return {scales:a.wingSprites.filter(v=>v.visible).map(v=>v.scaleX),
          roots:a.nearWings.filter(v=>v.visible).map(v=>({cropped:v.isCropped,depth:v.depth})),
          cloak:a.cloakRoot.visible,cloakDepth:a.cloakRoot.depth,bodyDepth:s.visuals.reaper.depth};
      },{raven,bone});
      const expected=tuck?[.375,.36]:Array(raven&&bone?2:1).fill(.51);
      assert.equal(measure.scales.length,expected.length);measure.scales.forEach((v,i)=>assert(Math.abs(v-expected[i])<.00001,'Each wing type is exactly 50% larger'));
      assert(measure.cloak&&measure.cloakDepth>measure.bodyDepth,'Cloth folds conceal wing joints');
      assert(measure.roots.every(v=>v.cropped&&v.depth>measure.bodyDepth&&v.depth<measure.cloakDepth),'Only the near root emerges between body cloth and its overlap fold');
      await page.locator('#game canvas').screenshot({path:path.join(dir,'revision-wings-'+name+'.png')});
    }
    await setup('hover');
    await page.locator('#game canvas').screenshot({path:path.join(dir,'power-combined-wings-phone.png')});
    for(const mode of ['tuck','attack','tuck-attack']){
      const info=await setup(mode);assert(info.visible,'Dedicated '+mode+' pose is visible');
      assert.equal(info.frame,mode==='tuck'?2:mode==='attack'?5:9);
      await page.locator('#game canvas').screenshot({path:path.join(dir,'power-'+mode+'-phone.png')});
      await page.waitForTimeout(350);
    }
    const powers=await page.evaluate(()=>{
      const s=window.grimRun.scene.scenes[0],a=s.powerArt;
      const results=[];
      for(const id of window.GRIM_POWER_ART.ORDER){
        a.reset();a.purchase(id,4);a.tick(200);s.drawScene();
        results.push({id,burst:a.bursts.length,visible:a.pool.filter(v=>v.visible).length});
      }
      a.reset();for(let i=0;i<100;i++)a.trigger('powerShot');
      const cap=a.bursts.length;s.drawScene();
      return {results,cap};
    });
    assert(powers.results.every(x=>x.burst===1&&x.visible===1),'All twelve vendor power/recovery purchases animate');
    assert.equal(powers.cap,20,'Burst pool remains bounded under stress');
    const explosion=await page.evaluate(()=>{
      const s=window.grimRun.scene.scenes[0],a=s.powerArt;a.reset();s.godMode=true;
      Object.assign(s.player,{attackMs:0,airTuck:false,holdSlide:false,hovering:false,visualTuckMs:0,visualTuckReleaseMs:0});
      s.player.grounded=true;s.player.y=s.terrain.groundAt(s.player.x)??s.terrain.anchorAt(s.player.x);
      s.powerManager.levels.brittleBones=4;const hp=s.player.hp;s.takeDamage(1,'rock');
      const b=a.bursts.find(b=>b.id==='brittleBones');a.tick(300);s.drawScene();
      return {count:b.bones.length,visible:a.bonePool.filter(v=>v.visible).length,hp:s.player.hp===hp,rng:s.rng.state};
    });
    assert.equal(explosion.count,44);assert.equal(explosion.visible,44);assert(explosion.hp,'God Mode damage still visibly activates Brittle Bones');
    await page.locator('#game canvas').screenshot({path:path.join(dir,'revision-brittle-explosion.png')});
    for(let i=0;i<8;i++){await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.powerArt.tick(75);s.drawScene();});await page.waitForTimeout(75);}
    const paused=await page.evaluate(()=>{
      const s=window.grimRun.scene.scenes[0],a=s.powerArt,b=a.bursts.find(b=>b.bones);const before=b.age;
      s.update(0,34);const paused=b.age===before,rng=s.rng.state;a.tick(1000);s.drawScene();
      return {paused,rng,visible:a.bonePool.filter(v=>v.visible).length};
    });
    assert(paused.paused);assert.equal(paused.rng,explosion.rng,'Visual fragment motion consumes no gameplay randomness');assert.equal(paused.visible,0,'Bone pieces expire and return to their fixed pool');
    await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.powerArt.reset();s.takeDamage(1,'rock');});
    for(let i=0;i<16;i++){await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.powerArt.tick(45);s.drawScene();});await page.waitForTimeout(90);}
    await setup('attack');
    await page.evaluate(()=>{
      const s=window.grimRun.scene.scenes[0];for(const id of window.GRIM_POWER_ART.ORDER)s.powerManager.levels[id]=4;
      s.powerArt.trigger('soulCleave',s.player.x+45,s.feetY-70);s.powerArt.tick(180);s.drawScene();
    });
    await page.locator('#game canvas').screenshot({path:path.join(dir,'power-upgraded-scythe-phone.png')});
    // Replay the full shrine visually with the world stopped at 4900m.
    const entry=await page.evaluate(()=>{
      const s=window.grimRun.scene.scenes[0];s.state='playing';s.hasTeleported=false;s.shrineClaimed=false;s.gunUnlocked=false;
      s.nextVendorNumber=8;s.startChest();s.drawScene();
      return {state:s.state,distance:s.distance,x:s.player.x,hp:s.player.hp,coins:s.coinCount};
    });
    assert.equal(entry.state,'chest');assert.equal(entry.distance,4900);
    assert(await page.evaluate(()=>window.grimRun.scene.scenes[0].powerArt.cinemaShrineOpen.isCropped),
      'Only the open chest edit is overlaid; the original shrine keeps its clean transparent edges');
    // Freeze the scene timer while recording selected phases; manually advance
    // the same rendered time so screenshots have reproducible acquisition poses.
    await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s._powerUpdate=s.sys.sceneUpdate;s.sys.sceneUpdate=function(){};});
    const relicFrames=new Set();
    for(let i=0;i<120;i++){
      const sample=await page.evaluate(i=>{
        const s=window.grimRun.scene.scenes[0];s.chestMs=6000-i*50;s.drawScene();window.grimRun.step(performance.now(),0);
        return {frame:s.powerArt.cinemaReaper.frame.name,chestMs:s.chestMs};
      },i);assert.equal(sample.chestMs,6000-i*50,'Phaser fixture clock stays at the requested phase');relicFrames.add(Number(sample.frame));
      if([10,32,68,103].includes(i))await page.screenshot({path:path.join(dir,'revision-shrine-'+i+'.png')});
      await page.waitForTimeout(25);
    }
    assert.equal(relicFrames.size,24,'Actual renderer uses all 24 acquisition poses');
    const exit=await page.evaluate(()=>{
      const s=window.grimRun.scene.scenes[0];const x=s.player.x,hp=s.player.hp,coins=s.coinCount;
      s.finishChest();const granted=s.gunUnlocked;
      s.state='playing';s.player.x=s.startX+5000*12;s.enterUnderworld();const portalGun=s.gunUnlocked;
      s.finishPortal();s.sys.sceneUpdate=s._powerUpdate;
      return {granted,portalGun,state:s.state,unchanged:hp===s.player.hp&&coins===s.coinCount};
    });
    assert(exit.granted&&exit.portalGun&&exit.unchanged);assert.equal(exit.state,'playing');
    assert.deepEqual(errors,[],'No real-browser errors during power/action/shrine rendering');
    console.log('PASS actual Chromium: all illustrated power frames, combined wing variant, aerial combos, 12 purchase effects, bounded particles and 4900m shrine/5000m portal.');
  }finally{
    const video=page.video();await context.close();
    if(video){const file=await video.path();fs.renameSync(file,path.join(dir,'power-animation-preview.webm'));}
    await browser.close();await new Promise(r=>server.close(r));
  }
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
