'use strict';
// Actual Chromium + Phaser smoke test. Run via GitHub Actions browser workflow.
// This catches the green missing-texture box that mock graphics tests missed.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  const rel=decodeURIComponent(url.pathname.replace(/^\/+/,'')||'index.html');
  const requested=path.resolve(root,rel);
  if(requested!==root&&!requested.startsWith(root+path.sep)){
   res.writeHead(403).end('Forbidden');return;
  }
  const data=fs.readFileSync(requested);
  res.writeHead(200,{'Content-Type':types[path.extname(requested)]||'application/octet-stream'});
  res.end(data);
 }catch(e){res.writeHead(404).end(String(e));}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1400,height:750}});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(origin+'/?art=experimental&seed=33',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>{
   const s=window.grimRun?.scene?.scenes?.[0];
   return s?.visuals?.loaded===true;
  },null,{timeout:45000});
  const before=await page.evaluate(()=>{
   const s=window.grimRun.scene.scenes[0],v=s.visuals;
   function opacity(textureKey,w,h){
    const image=s.textures.get(textureKey).getSourceImage();
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const context=canvas.getContext('2d',{willReadFrequently:true});
    context.drawImage(image,0,0);
    const data=context.getImageData(0,0,w,h).data;
    let visible=0;
    for(let i=3;i<data.length;i+=4*12)if(data[i]>80)visible++;
    return visible;
   }
   return {
    reaperReady:v.reaperReady,batReady:v.batReady,errors:v.failedAssets,
    reaperTexture:v.reaper?.texture?.key,batTexture:v.batPool[0]?.texture?.key,
    reaperFrame:v.reaper?.frame?.name,bats:v.batPool.length,
    alphaReaper:opacity('gr_reaper_sheet_source',768,768),
    alphaBat:opacity('gr_bat_sheet_source',640,256)
   };
  });
  console.log('Actual Phaser loaded assets:',JSON.stringify(before));
  assert.equal(before.reaperReady,true,'Reaper asset failed real Phaser load');
  assert.equal(before.batReady,true,'Bat asset failed real Phaser load');
  assert.equal(before.reaperTexture,'gr_reaper_frames','Reaper uses Phaser green missing texture');
  assert.equal(before.batTexture,'gr_bat_frames','Bat uses Phaser green missing texture');
  assert.equal(before.reaperFrame,0,'Missing starting frame');
  assert.equal(before.bats,12);
  assert.ok(before.alphaReaper>50,'Reaper SVG rasterized blank!');
  assert.ok(before.alphaBat>25,'Bat SVG rasterized blank!');
  await page.click('#start-btn');
  await page.waitForTimeout(800);
  const playing=await page.evaluate(()=>{
   const s=window.grimRun.scene.scenes[0],v=s.visuals;
   return {state:s.state,visible:v.reaper.visible,frame:v.reaper.frame.name,
    playerX:s.player.x,spriteX:v.reaper.x,
    spriteY:v.reaper.y,footY:s.feetY};
  });
  console.log('Actual Phaser playing state:',JSON.stringify(playing));
  assert.equal(playing.state,'playing');
  assert.equal(playing.visible,true);
  assert.ok([2,3,4,5,15].includes(playing.frame),'Not running through Reaper art frames');
  assert.equal(playing.spriteX,playing.playerX,'Player sprite must follow collision origin');
  assert.ok(Math.abs(playing.spriteY-playing.footY)<=13);
  assert.deepEqual(errors,[],'Browser console errors');
  // Review the painted, transparent PNGs in the real Phaser runtime without
  // changing the default release path or using any animated frame sequence.
  await page.goto(origin+'/?art=illustrated&seed=33',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.grimRun?.scene?.scenes?.[0]?.visuals?.loaded===true,null,{timeout:45000});
  const illustratedLoaded=await page.evaluate(()=>{
    const s=window.grimRun.scene.scenes[0],v=s.visuals;
    return {ready:v.reaperReady&&v.batReady,illustrated:v.illustrated,
      textures:Object.values(window.GRIM_VISUALS.ILLUSTRATED.reaper).every(m=>s.textures.exists(m.key))&&
        Object.values(window.GRIM_VISUALS.ILLUSTRATED.bat).every(m=>s.textures.exists(m.key)),
      poses:Object.keys(v.reaperPoseSprites).length,bats:v.batPool.length};
  });
  assert.deepEqual(illustratedLoaded,{ready:true,illustrated:true,textures:true,poses:15,bats:12});
  await page.click('#start-btn');
  await page.waitForFunction(()=>window.grimRun.scene.scenes[0].state==='playing');
  const staticReview=await page.evaluate(()=>{
    const s=window.grimRun.scene.scenes[0],v=s.visuals;
    const run=v.reaperPoseSprites.run,meta=window.GRIM_VISUALS.ILLUSTRATED.reaper.run;
    s.player.sliding=true;v.render();
    const slide=v.reaperPoseSprites.slide,sm=window.GRIM_VISUALS.ILLUSTRATED.reaper.slide;
    const slideAnchorY=slide.y+sm.anchor[1]*sm.scale;
    s.player.sliding=false;
    s.enemies=[{kind:'bat',x:s.cameraX+320,y:160,mode:'glide',hp:1,phase:0,dead:false}];
    v.render();
    return {runVisible:run.visible,runKey:run.texture.key,
      runGroundError:Math.abs(run.y+meta.anchor[1]*meta.scale-s.feetY),
      slideVisible:slide.visible,slideGroundError:Math.abs(slideAnchorY-s.feetY),
      slideArtHeight:322*sm.scale,batVisible:v.batPool[0].visible,
      batKey:v.batPool[0].texture.key};
  });
  assert.equal(staticReview.runVisible,true);assert.equal(staticReview.runKey,'gr_ill_reaper_run');
  assert.ok(staticReview.runGroundError<.1,'Reaper baseline anchor aligns to gameplay feet');
  assert.equal(staticReview.slideVisible,true);assert.ok(staticReview.slideGroundError<.1);
  assert.ok(staticReview.slideArtHeight<=29.01,'Low-profile slide artwork fits unchanged 29px clearance');
  assert.equal(staticReview.batVisible,true);assert.equal(staticReview.batKey,'gr_ill_bat_neutral');
  // Default game currently uses procedural fallback while painted art is reviewed.
  // The previous SVGs remain available as opt-in experimental art.
  await page.goto(origin+'/?seed=33',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.grimRun?.scene?.scenes?.[0]?.state==='menu',null,{timeout:30000});
  const fallback=await page.evaluate(()=>{
   const s=window.grimRun.scene.scenes[0];
   return {state:s.state,reaperReady:s.visuals?.reaperReady,batReady:s.visuals?.batReady};
  });
  assert.equal(fallback.reaperReady,false);
  assert.equal(fallback.batReady,false);
  await page.click('#start-btn');
  await page.click('#pause-btn');
  await page.locator('#god-mode-checkbox').check();
  await page.waitForFunction(()=>{
    const s=window.grimRun.scene.scenes[0];
    return s.godMode===true;
  });
  await page.evaluate(()=>{
    const picker=document.getElementById('god-teleport-range');
    picker.value='5000';picker.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.click('#god-teleport-confirm-open');
  assert.equal(await page.locator('#teleport-confirm').isVisible(),true);
  await page.click('#teleport-confirm-yes');
  const location=await page.evaluate(()=>{
    const s=window.grimRun.scene.scenes[0];
    return {meters:s.distance,state:s.state,underworld:s.hasTeleported,
      gun:s.gunUnlocked,countdownMs:s.countdownMs,teleportUsed:s.teleportUsed};
  });
  assert.equal(location.state,'playing');
  assert.ok(location.meters>=5000&&location.meters<5100);
  assert.equal(location.underworld,true);
  assert.equal(location.gun,true);
  assert.equal(location.countdownMs,0);
  assert.equal(location.teleportUsed,true);
  await page.click('#practice-slow-btn');
  assert.equal(await page.evaluate(()=>window.grimRun.scene.scenes[0].practiceSlow),true);
  await page.click('#practice-slow-btn');
  assert.equal(await page.evaluate(()=>window.grimRun.scene.scenes[0].practiceSlow),false);
  await page.click('#pause-btn');
  await page.locator('#god-mode-checkbox').uncheck();
  assert.equal(await page.evaluate(()=>window.grimRun.scene.scenes[0].practiceSlow),false);
  assert.deepEqual(errors,[],'Browser console errors including new God Mode tools');
  console.log('PASS actual Chromium: legacy and illustrated opt-ins, PNG transparency anchors, static pose selection, safe default fallback and God Mode tools.');
 }finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
