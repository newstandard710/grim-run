'use strict';
// Actual Chromium + Phaser smoke test. Run via GitHub Actions browser workflow.
// This catches the green missing-texture box that mock graphics tests missed.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
require('./asset-integrity.cjs');

const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
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
  // Create the game at phone dimensions from its first frame. Resizing a
  // running Phaser canvas afterward leaves the scene's ground line at the old
  // desktop height and makes mobile screenshots show the player clipped off.
  const page=await browser.newPage({viewport:{width:950,height:430}});
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
  // The previous illustrated PNG art remains available for comparison.
  await page.goto(origin+'/?art=illustrated&seed=33',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.grimRun?.scene?.scenes?.[0]?.visuals?.loaded===true,null,{timeout:45000});
  const illustratedLoaded=await page.evaluate(()=>{
    const s=window.grimRun.scene.scenes[0],v=s.visuals;
    return {ready:v.reaperReady&&v.batReady,illustrated:v.illustrated,
      textures:['idle','run_02','run_03','run_04','run_05','jump','fall','slide','scythe_attack','crossbow_fire','hurt','death','hover']
        .every(k=>s.textures.exists(window.GRIM_VISUALS.ILLUSTRATED.reaper[k].key))&&
        ['neutral','raised','midstroke','lowered','dive'].every(k=>s.textures.exists(window.GRIM_VISUALS.ILLUSTRATED.bat[k].key)),
      poses:Object.keys(v.reaperPoseSprites).length,bats:v.batPool.length};
  });
  assert.deepEqual(illustratedLoaded,{ready:true,illustrated:true,textures:true,poses:13,bats:12});
  await page.click('#start-btn');
  await page.waitForFunction(()=>window.grimRun.scene.scenes[0].state==='playing');
  const staticReview=await page.evaluate(()=>{
    const s=window.grimRun.scene.scenes[0],v=s.visuals;
    s.player.sliding=true;v.render();
    const slide=v.reaperPoseSprites.slide,sm=window.GRIM_VISUALS.ILLUSTRATED.reaper.slide;
    const slideState={visible:slide.visible,
      groundError:Math.abs(slide.y+sm.anchor[1]*sm.scale-s.feetY),
      artHeight:511*sm.scale};
    s.player.sliding=false;
    s.player.attackMs=120;v.render();
    const attack=v.reaperPoseSprites.scythe_attack,am=window.GRIM_VISUALS.ILLUSTRATED.reaper.scythe_attack;
    const idleMeta=window.GRIM_VISUALS.ILLUSTRATED.reaper.idle;
    const attackState={visible:attack.visible,scale:attack.scale,
      groundError:Math.abs(attack.y+am.anchor[1]*am.scale-s.feetY),
      artHeight:(893-157)*am.scale,idleArtHeight:(828-67)*idleMeta.scale};
    s.player.attackMs=0;
    s.enemies=[{kind:'bat',x:s.cameraX+320,y:160,mode:'glide',hp:1,phase:0,dead:false}];
    s.elapsed=0;v.render();
    const firstRun=Object.entries(v.reaperPoseSprites).find(([name,sprite])=>
      name.startsWith('run_')&&sprite.visible)?.[0];
    const firstBat=v.batPool[0].texture.key;
    s.elapsed=.12;v.render();
    const currentRun=Object.entries(v.reaperPoseSprites).find(([name,sprite])=>
      name.startsWith('run_')&&sprite.visible)?.[0];
    const currentRunSprite=v.reaperPoseSprites[currentRun];
    const currentMeta=window.GRIM_VISUALS.ILLUSTRATED.reaper[currentRun];
    return {runVisible:currentRunSprite.visible,runKey:currentRun,
      runGroundError:Math.abs(currentRunSprite.y+currentMeta.anchor[1]*currentMeta.scale-s.feetY),
      slideVisible:slideState.visible,slideGroundError:slideState.groundError,
      slideArtHeight:slideState.artHeight,batVisible:v.batPool[0].visible,
      batKey:v.batPool[0].texture.key,firstRun,firstBat,attackState};
  });
  assert.equal(staticReview.runVisible,true);assert.equal(staticReview.firstRun,'run_02');
  assert.equal(staticReview.runKey,'run_03','Reaper run advances to a distinct pose');
  assert.ok(staticReview.runGroundError<.1,'Reaper baseline anchor aligns to gameplay feet');
  assert.equal(staticReview.slideVisible,true);assert.ok(staticReview.slideGroundError<.1);
  assert.ok(staticReview.slideArtHeight<=40.2&&staticReview.slideArtHeight>39.8,
    'Crouched slide art uses a 40px silhouette within unchanged 48px overhead clearance');
  assert.equal(staticReview.attackState.visible,true);
  assert.ok(staticReview.attackState.groundError<.1,'Scythe pose shares the ground anchor');
  assert.ok(Math.abs(staticReview.attackState.artHeight-staticReview.attackState.idleArtHeight)<1,
    'Scythe attack art stays the same apparent height as idle');
  assert.equal(staticReview.batVisible,true);assert.equal(staticReview.firstBat,'gr_ill_bat_raised');
  assert.equal(staticReview.batKey,'gr_ill_bat_midstroke','Bat wings visibly advance during flight');
  // The main game now uses the transparent PNG pose set by default.
  await page.goto(origin+'/?seed=33',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>{
    const v=window.grimRun?.scene?.scenes?.[0]?.visuals;
    return v?.loaded===true&&v.reviewV2===true&&v.boneCrawlerReady===true&&v.emberImpReady===true;
  },null,{timeout:45000});
  const reviewV2Loaded=await page.evaluate(()=>{
    const s=window.grimRun.scene.scenes[0],v=s.visuals;
    const visuals=window.GRIM_VISUALS;
    return {ready:v.reaperReady&&v.batReady,reviewV2:v.reviewV2,
      reaperPoses:Object.keys(v.reaperPoseSprites).length,bats:v.batPool.length,
      skeletalBatReady:v.skeletalBatReady,boneCrawlerReady:v.boneCrawlerReady,
      emberImpReady:v.emberImpReady,
      textures:Object.values(visuals.V2_REAPER).every(m=>s.textures.exists(m.key))&&
        Object.values(visuals.V2_BAT).every(m=>s.textures.exists(m.key)),
      failures:v.failedAssets};
  });
  assert.deepEqual(reviewV2Loaded,{ready:true,reviewV2:true,reaperPoses:20,bats:12,
    skeletalBatReady:true,boneCrawlerReady:true,emberImpReady:true,
    textures:true,failures:[]});

  // All accepted enemy illustrations are present in the default game. Exercise
  // them through Phaser at the same phone canvas dimensions.
  const skeletalPage=await browser.newPage({viewport:{width:950,height:430}});
  skeletalPage.on('pageerror',e=>errors.push('Skeletal Bat review: '+String(e)));
  await skeletalPage.goto(origin+'/?seed=33',
    {waitUntil:'domcontentloaded',timeout:45000});
  await skeletalPage.waitForFunction(()=>{
    const v=window.grimRun?.scene?.scenes?.[0]?.visuals;
    return v?.loaded===true&&v.skeletalBatReady===true&&
      v.boneCrawlerReady===true&&v.emberImpReady===true;
  },null,{timeout:45000});
  const skeletalLoaded=await skeletalPage.evaluate(()=>{
    const s=window.grimRun.scene.scenes[0],V=window.GRIM_VISUALS,m=V.V2_SKELETAL_BAT_ATLAS;
    const texture=s.textures.get(m.key),source=texture.getSourceImage();
    return {ready:s.visuals.skeletalBatReady,pool:s.visuals.skeletalBatPool.length,
      crawler:s.visuals.boneCrawlerReady,imp:s.visuals.emberImpReady,
      dimensions:[source.width,source.height],
      frames:V.V2_SKELETAL_BAT_FRAMES.every(frame=>texture.has(frame.name)),
      reviewFlag:new URLSearchParams(location.search).get('enemyReview')};
  });
  assert.deepEqual(skeletalLoaded,{ready:true,pool:12,crawler:true,imp:true,
    dimensions:[1254,1254],frames:true,
    reviewFlag:null});
  await skeletalPage.click('#start-btn');
  await skeletalPage.waitForFunction(()=>window.grimRun?.scene?.scenes?.[0]?.state==='playing',
    null,{timeout:15000});
  await skeletalPage.evaluate(()=>{
    const g=window.grimRun,s=g.scene.scenes[0];
    g.loop.stop();s.state='paused';s.elapsed=0;s.enemies=[];
    s.drawScene();g.step(performance.now(),0);
  });
  const emptyCanvas=PNG.sync.read(await skeletalPage.locator('#game canvas').screenshot());
  const skeletalRect=await skeletalPage.evaluate(()=>{
    const g=window.grimRun,s=g.scene.scenes[0],v=s.visuals;
    const enemy={kind:'skeletalBat',x:s.cameraX+320,y:150,mode:'glide',hp:2,phase:0,dead:false};
    s.enemies=[enemy];s.drawScene();g.step(performance.now(),0);
    const sprite=v.skeletalBatPool[0];
    return {frame:sprite.frame.name,visible:sprite.visible,
      displayWidth:sprite.displayWidth,displayHeight:sprite.displayHeight,
      screenX:Math.round(enemy.x-s.cameraX-sprite.displayWidth*.5),
      screenY:Math.round(enemy.y-sprite.displayHeight*.64)};
  });
  assert.equal(skeletalRect.frame,'flap_raised');assert.equal(skeletalRect.visible,true);
  assert.ok(skeletalRect.displayHeight>57&&skeletalRect.displayHeight<59,
    'Skeletal Bat has the approved 58px target, slightly larger than the Cavern Bat');
  const skeletalArtifactDir=path.join(root,'test-results');fs.mkdirSync(skeletalArtifactDir,{recursive:true});
  await skeletalPage.screenshot({path:path.join(skeletalArtifactDir,'skeletal-bat-phone-scale.png')});
  const skeletalStates=[
    {elapsed:0,mode:'glide',hp:2,dead:false,frame:'flap_raised'},
    {elapsed:1/12,mode:'glide',hp:2,dead:false,frame:'flap_mid_down'},
    {elapsed:2/12,mode:'glide',hp:2,dead:false,frame:'flap_lowered'},
    {elapsed:3/12,mode:'glide',hp:2,dead:false,frame:'flap_mid_up'},
    {elapsed:1,mode:'telegraph',hp:2,dead:false,frame:'telegraph'},
    {elapsed:1.1,mode:'dive',hp:2,dead:false,frame:'dive'},
    {elapsed:1.2,mode:'glide',hp:1,dead:false,frame:'hit'},
    {elapsed:1.3,mode:'glide',hp:1,dead:true,frame:'death'}
  ];
  const skeletalCropHashes=[];
  for(let i=0;i<skeletalStates.length;i++){
    const state=skeletalStates[i];
    const rendered=await skeletalPage.evaluate(({elapsed,mode,hp,dead})=>{
      const g=window.grimRun,s=g.scene.scenes[0],enemy=s.enemies[0],sprite=s.visuals.skeletalBatPool[0];
      s.elapsed=elapsed;Object.assign(enemy,{mode,hp,dead});s.drawScene();g.step(performance.now(),0);
      return {frame:sprite.frame.name,visible:sprite.visible};
    },state);
    assert.deepEqual(rendered,{frame:state.frame,visible:true},
      'Phaser selects and displays the '+state.frame+' frame');
    const canvas=PNG.sync.read(await skeletalPage.locator('#game canvas').screenshot({
      path:path.join(skeletalArtifactDir,'skeletal-bat-canvas-'+String(i+1).padStart(2,'0')+'.png')}));
    const x=Math.max(0,Math.floor(skeletalRect.screenX)),y=Math.max(0,Math.floor(skeletalRect.screenY));
    const width=Math.min(Math.ceil(skeletalRect.displayWidth),canvas.width-x);
    const height=Math.min(Math.ceil(skeletalRect.displayHeight),canvas.height-y);
    const crop=Buffer.alloc(width*height*4);let changed=0;
    for(let row=0;row<height;row++){
      const from=((y+row)*canvas.width+x)*4,to=row*width*4;
      canvas.data.copy(crop,to,from,from+width*4);
      for(let px=0;px<width*4;px+=4){
        const offset=from+px;
        if(Math.abs(canvas.data[offset]-emptyCanvas.data[offset])>14||
           Math.abs(canvas.data[offset+1]-emptyCanvas.data[offset+1])>14||
           Math.abs(canvas.data[offset+2]-emptyCanvas.data[offset+2])>14)changed++;
      }
    }
    assert.ok(changed>100,'Rendered '+state.frame+' art changes visible pixels on the phone canvas');
    skeletalCropHashes.push(crypto.createHash('sha256').update(crop).digest('hex'));
  }
  assert.equal(new Set(skeletalCropHashes).size,8,
    'All four flight drawings and four action drawings produce distinct phone-scale pixels');
  const afterDeath=await skeletalPage.evaluate(()=>{
    const g=window.grimRun,s=g.scene.scenes[0],enemy=s.enemies[0],sprite=s.visuals.skeletalBatPool[0];
    s.elapsed=1.7;s.drawScene();g.step(performance.now(),0);return sprite.visible;
  });
  assert.equal(afterDeath,false,'Defeat art clears after its short visual hold');

  // Exercise all four approved Bone Crawler drawings through real Phaser at
  // 950x430 and compare their actual rendered phone-scale pixels.
  await skeletalPage.goto(origin+'/?enemyReview=bone-crawler&seed=33',
    {waitUntil:'domcontentloaded',timeout:45000});
  await skeletalPage.waitForFunction(()=>{
    const v=window.grimRun?.scene?.scenes?.[0]?.visuals;
    return v?.loaded===true&&v.boneCrawlerReady===true;
  },null,{timeout:45000});
  const crawlerLoaded=await skeletalPage.evaluate(()=>{
    const s=window.grimRun.scene.scenes[0],V=window.GRIM_VISUALS;
    return {ready:s.visuals.boneCrawlerReady,pool:s.visuals.boneCrawlerPool.length,
      textures:V.V2_BONE_CRAWLER_FRAMES.map(meta=>{
        const image=s.textures.get(meta.key).getSourceImage();return [image.width,image.height];
      }),flag:new URLSearchParams(location.search).get('enemyReview')};
  });
  assert.deepEqual(crawlerLoaded,{ready:true,pool:12,textures:Array(4).fill([1477,1065]),flag:'bone-crawler'});
  await skeletalPage.click('#start-btn');
  await skeletalPage.waitForFunction(()=>window.grimRun?.scene?.scenes?.[0]?.state==='playing',
    null,{timeout:15000});
  await skeletalPage.evaluate(()=>{
    const g=window.grimRun,s=g.scene.scenes[0];
    g.loop.stop();s.state='paused';s.elapsed=0;s.enemies=[];
    s.drawScene();g.step(performance.now(),0);
  });
  const crawlerEmpty=PNG.sync.read(await skeletalPage.locator('#game canvas').screenshot());
  const crawlerRect=await skeletalPage.evaluate(()=>{
    const g=window.grimRun,s=g.scene.scenes[0],v=s.visuals;
    const ground=s.terrain.groundAt(s.cameraX+320),x=s.cameraX+320;
    const y=ground-window.GRIM_COMBAT.CRAWLER_HITBOX.footOffset;
    const enemy={kind:'crawler',x,y,phase:0,dead:false,hp:1};
    s.enemies=[enemy];s.drawScene();g.step(performance.now(),0);
    const sprite=v.boneCrawlerPool[0],meta=window.GRIM_VISUALS.V2_BONE_CRAWLER_FRAMES[0];
    return {frame:sprite.texture.key,visible:sprite.visible,x:sprite.x,y:sprite.y,
      displayWidth:sprite.displayWidth,displayHeight:sprite.displayHeight,
      enemyX:enemy.x,enemyY:enemy.y,
      groundY:ground,hitbox:window.GRIM_COMBAT.rectFor(enemy),
      screenX:Math.round(enemy.x-s.cameraX-sprite.displayWidth*.5),
      screenY:Math.round(enemy.y-sprite.displayHeight*.5),scale:sprite.scaleX,
      expectedScale:meta.scale,flipX:sprite.flipX};
  });
  assert.equal(crawlerRect.frame,'gr_v2_crawler_crawl_01');
  assert.equal(crawlerRect.visible,true);assert.equal(crawlerRect.x,crawlerRect.enemyX);
  assert.equal(crawlerRect.y,crawlerRect.enemyY);
  assert.equal(crawlerRect.flipX,true,'Bone Crawler art faces right, in its direction of travel');
  assert.ok(Math.abs(crawlerRect.scale-crawlerRect.expectedScale)<.00001);
  assert.ok(crawlerRect.displayWidth>137&&crawlerRect.displayWidth<141);
  assert.ok(crawlerRect.displayHeight>99&&crawlerRect.displayHeight<101);
  assert.equal(crawlerRect.hitbox.width,95);assert.equal(crawlerRect.hitbox.height,105);
  assert.equal(crawlerRect.hitbox.x+crawlerRect.hitbox.width/2,crawlerRect.enemyX);
  assert.ok(Math.abs(crawlerRect.hitbox.y+crawlerRect.hitbox.height-crawlerRect.groundY)<.01,
    'The enlarged hitbox rests on the same ground baseline as the artwork');
  await skeletalPage.screenshot({path:path.join(skeletalArtifactDir,'bone-crawler-phone-scale.png')});
  const crawlerStates=[
    {elapsed:0,name:'crawl_01'},
    {elapsed:1/8,name:'crawl_02'},
    {elapsed:2/8,name:'crawl_03'},
    {elapsed:3/8,name:'crawl_04'}
  ];
  const crawlerHashes=[];
  for(let i=0;i<crawlerStates.length;i++){
    const state=crawlerStates[i];
    const rendered=await skeletalPage.evaluate(({elapsed,name})=>{
      const g=window.grimRun,s=g.scene.scenes[0],enemy=s.enemies[0],sprite=s.visuals.boneCrawlerPool[0];
      s.elapsed=elapsed;s.drawScene();g.step(performance.now(),0);
      return {frame:sprite.texture.key,visible:sprite.visible};
    },state);
    assert.equal(rendered.frame,'gr_v2_crawler_'+state.name,
      'Phaser selects the '+state.name+' texture');
    assert.equal(rendered.visible,true,'Phaser displays the '+state.name+' texture');
    const canvas=PNG.sync.read(await skeletalPage.locator('#game canvas').screenshot({
      path:path.join(skeletalArtifactDir,'bone-crawler-canvas-'+String(i+1).padStart(2,'0')+'.png')}));
    const x=Math.max(0,Math.floor(crawlerRect.screenX)),y=Math.max(0,Math.floor(crawlerRect.screenY));
    const width=Math.min(Math.ceil(crawlerRect.displayWidth),canvas.width-x);
    const height=Math.min(Math.ceil(crawlerRect.displayHeight),canvas.height-y);
    const crop=Buffer.alloc(width*height*4);let changed=0;
    for(let row=0;row<height;row++){
      const from=((y+row)*canvas.width+x)*4,to=row*width*4;
      canvas.data.copy(crop,to,from,from+width*4);
      for(let px=0;px<width*4;px+=4){
        const offset=from+px;
        if(Math.abs(canvas.data[offset]-crawlerEmpty.data[offset])>14||
           Math.abs(canvas.data[offset+1]-crawlerEmpty.data[offset+1])>14||
           Math.abs(canvas.data[offset+2]-crawlerEmpty.data[offset+2])>14)changed++;
      }
    }
    assert.ok(changed>80,'Rendered '+state.name+' art changes phone-canvas pixels');
    crawlerHashes.push(crypto.createHash('sha256').update(crop).digest('hex'));
  }
  assert.equal(new Set(crawlerHashes).size,4,'All four crawl poses render distinct phone-scale pixels');
  const crawlerAfterDeath=await skeletalPage.evaluate(()=>{
    const g=window.grimRun,s=g.scene.scenes[0],enemy=s.enemies[0],sprite=s.visuals.boneCrawlerPool[0];
    enemy.dead=true;s.drawScene();g.step(performance.now(),0);return sprite.visible;
  });
  assert.equal(crawlerAfterDeath,false,'Dead crawlers return to ordinary enemy cleanup');

  // Exercise all four approved Ember Imp run poses and the existing
  // warning/release states at phone scale while checking the old hitbox.
  await skeletalPage.goto(origin+'/?enemyReview=ember-imp&seed=33',
    {waitUntil:'domcontentloaded',timeout:45000});
  await skeletalPage.waitForFunction(()=>{
    const v=window.grimRun?.scene?.scenes?.[0]?.visuals;
    return v?.loaded===true&&v.emberImpReady===true;
  },null,{timeout:45000});
  const impLoaded=await skeletalPage.evaluate(()=>{
    const s=window.grimRun.scene.scenes[0],V=window.GRIM_VISUALS,m=V.V2_EMBER_IMP_ATLAS;
    const texture=s.textures.get(m.key),source=texture.getSourceImage();
    return {ready:s.visuals.emberImpReady,pool:s.visuals.emberImpPool.length,
      dimensions:[source.width,source.height],
      frames:V.V2_EMBER_IMP_FRAMES.every(frame=>texture.has(frame.name)),
      flag:new URLSearchParams(location.search).get('enemyReview')};
  });
  assert.deepEqual(impLoaded,{ready:true,pool:12,dimensions:[768,512],frames:true,flag:'ember-imp'});
  await skeletalPage.click('#start-btn');
  await skeletalPage.waitForFunction(()=>window.grimRun?.scene?.scenes?.[0]?.state==='playing',
    null,{timeout:15000});
  await skeletalPage.evaluate(()=>{
    const g=window.grimRun,s=g.scene.scenes[0];
    g.loop.stop();s.state='paused';s.elapsed=0;s.enemies=[];s.fireballs=[];
    s.drawScene();g.step(performance.now(),0);
  });
  const impEmpty=PNG.sync.read(await skeletalPage.locator('#game canvas').screenshot());
  const impRect=await skeletalPage.evaluate(()=>{
    const g=window.grimRun,s=g.scene.scenes[0],v=s.visuals,m=window.GRIM_VISUALS.V2_EMBER_IMP_ATLAS;
    const x=s.cameraX+600,ground=s.terrain.groundAt(x),y=ground-30;
    const enemy={kind:'imp',x,y,homeY:y,phase:0,dead:false,hp:2,warningMs:0};
    s.enemies=[enemy];s.fireballs=[];s.drawScene();g.step(performance.now(),0);
    const sprite=v.emberImpPool[0],hitbox=window.GRIM_COMBAT.rectFor(enemy);
    return {frame:sprite.frame.name,visible:sprite.visible,x:sprite.x,y:sprite.y,
      enemyX:enemy.x,enemyY:enemy.y,groundY:ground,hitbox,
      displayWidth:sprite.displayWidth,displayHeight:sprite.displayHeight,
      screenX:Math.round(enemy.x-s.cameraX-sprite.displayWidth*m.origin[0]),
      screenY:Math.round(sprite.y-(s.cameraY||0)-sprite.displayHeight*m.origin[1]),
      scale:sprite.scaleX,expectedScale:m.scale};
  });
  assert.equal(impRect.frame,'run_01');assert.equal(impRect.visible,true);
  assert.equal(impRect.x,impRect.enemyX);assert.equal(impRect.y,impRect.enemyY+22);
  assert.ok(Math.abs(impRect.scale-impRect.expectedScale)<.00001);
  assert.ok(Math.abs(175*impRect.scale-55)<.01,'Ember Imp visible target is 55px');
  assert.equal(impRect.hitbox.width,38);assert.equal(impRect.hitbox.height,42);
  await skeletalPage.screenshot({path:path.join(skeletalArtifactDir,'ember-imp-phone-scale.png')});
  const impStates=[
    {elapsed:0,warningMs:0,ageMs:null,frame:'run_01'},
    {elapsed:1/8,warningMs:0,ageMs:null,frame:'run_02'},
    {elapsed:2/8,warningMs:0,ageMs:null,frame:'run_03'},
    {elapsed:3/8,warningMs:0,ageMs:null,frame:'run_04'},
    {elapsed:.5,warningMs:470,ageMs:null,frame:'warning'},
    {elapsed:.6,warningMs:0,ageMs:0,frame:'release'}
  ];
  const impHashes=[];
  for(let i=0;i<impStates.length;i++){
    const state=impStates[i];
    const rendered=await skeletalPage.evaluate(({elapsed,warningMs,ageMs})=>{
      const g=window.grimRun,s=g.scene.scenes[0],enemy=s.enemies[0],sprite=s.visuals.emberImpPool[0];
      s.elapsed=elapsed;enemy.warningMs=warningMs;
      s.fireballs=ageMs===null?[]:[{owner:enemy,ageMs,dead:false,x:enemy.x-12,y:enemy.y-11}];
      s.drawScene();g.step(performance.now(),0);
      return {frame:sprite.frame.name,visible:sprite.visible,fireballs:s.fireballs.length};
    },state);
    assert.deepEqual(rendered,{frame:state.frame,visible:true,fireballs:state.ageMs===null?0:1},
      'Phaser selects and displays the '+state.frame+' pose');
    const canvas=PNG.sync.read(await skeletalPage.locator('#game canvas').screenshot({
      path:path.join(skeletalArtifactDir,'ember-imp-canvas-'+String(i+1).padStart(2,'0')+'.png')}));
    const x=Math.max(0,Math.floor(impRect.screenX)),y=Math.max(0,Math.floor(impRect.screenY));
    const width=Math.min(Math.ceil(impRect.displayWidth),canvas.width-x);
    const height=Math.min(Math.ceil(impRect.displayHeight),canvas.height-y);
    const crop=Buffer.alloc(width*height*4);let changed=0,minY=height,maxY=-1;
    for(let row=0;row<height;row++){
      const from=((y+row)*canvas.width+x)*4,to=row*width*4;
      canvas.data.copy(crop,to,from,from+width*4);
      for(let px=0;px<width*4;px+=4){
        const offset=from+px;
        if(Math.abs(canvas.data[offset]-impEmpty.data[offset])>14||
           Math.abs(canvas.data[offset+1]-impEmpty.data[offset+1])>14||
           Math.abs(canvas.data[offset+2]-impEmpty.data[offset+2])>14){
          changed++;minY=Math.min(minY,row);maxY=Math.max(maxY,row);
        }
      }
    }
    assert.ok(changed>100,'Rendered '+state.frame+' art changes visible phone-canvas pixels');
    if(i<4){
      const visibleHeight=await skeletalPage.evaluate(()=>{
        const scene=window.grimRun.scene.scenes[0],sprite=scene.visuals.emberImpPool[0];
        const frame=sprite.frame,image=scene.textures.get(sprite.texture.key).getSourceImage();
        const canvas=document.createElement('canvas');
        canvas.width=frame.cutWidth;canvas.height=frame.cutHeight;
        const context=canvas.getContext('2d',{willReadFrequently:true});
        context.drawImage(image,frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight,
          0,0,frame.cutWidth,frame.cutHeight);
        const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
        let minY=canvas.height,maxY=-1;
        for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)
          if(pixels[(y*canvas.width+x)*4+3]>32){minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
        return (maxY-minY+1)*sprite.scaleY;
      });
      assert.ok(visibleHeight>50&&visibleHeight<60,
        'Decoded '+state.frame+' atlas alpha measures about 55 visible pixels tall');
    }
    impHashes.push(crypto.createHash('sha256').update(crop).digest('hex'));
  }
  assert.equal(new Set(impHashes).size,6,'All four run and two attack poses render distinct phone-scale pixels');
  const impAfterDeath=await skeletalPage.evaluate(()=>{
    const g=window.grimRun,s=g.scene.scenes[0],enemy=s.enemies[0],sprite=s.visuals.emberImpPool[0];
    enemy.dead=true;s.drawScene();g.step(performance.now(),0);return sprite.visible;
  });
  assert.equal(impAfterDeath,false,'Dead Imps return to ordinary enemy cleanup');

  // The combined review link remains a supported alias and renders both enemies.
  await skeletalPage.goto(origin+'/?enemyReview=both&seed=33',
    {waitUntil:'domcontentloaded',timeout:45000});
  await skeletalPage.waitForFunction(()=>{
    const v=window.grimRun?.scene?.scenes?.[0]?.visuals;
    return v?.loaded===true&&v.boneCrawlerReady===true&&v.emberImpReady===true;
  },null,{timeout:45000});
  const bothLoaded=await skeletalPage.evaluate(()=>{
    const v=window.grimRun.scene.scenes[0].visuals;
    return {crawler:v.boneCrawlerReady,imp:v.emberImpReady,
      crawlerPool:v.boneCrawlerPool.length,impPool:v.emberImpPool.length,
      flag:new URLSearchParams(location.search).get('enemyReview')};
  });
  assert.deepEqual(bothLoaded,{crawler:true,imp:true,crawlerPool:12,impPool:12,flag:'both'});
  await skeletalPage.click('#start-btn');
  await skeletalPage.waitForFunction(()=>window.grimRun?.scene?.scenes?.[0]?.state==='playing',
    null,{timeout:15000});
  await skeletalPage.evaluate(()=>{
    const g=window.grimRun,s=g.scene.scenes[0];
    g.loop.stop();s.state='paused';s.elapsed=0;s.enemies=[];s.fireballs=[];
    s.drawScene();g.step(performance.now(),0);
  });
  const bothEmpty=PNG.sync.read(await skeletalPage.locator('#game canvas').screenshot());
  const bothRendered=await skeletalPage.evaluate(()=>{
    const g=window.grimRun,s=g.scene.scenes[0];
    const crawlerX=s.cameraX+500,impX=s.cameraX+760;
    const crawlerGround=s.terrain.groundAt(crawlerX),impGround=s.terrain.groundAt(impX);
    const crawler={kind:'crawler',x:crawlerX,
      y:crawlerGround-window.GRIM_COMBAT.CRAWLER_HITBOX.footOffset,
      phase:0,dead:false,hp:1};
    const imp={kind:'imp',x:impX,y:impGround-30,homeY:impGround-30,
      phase:0,dead:false,hp:2,warningMs:0};
    s.enemies=[crawler,imp];s.fireballs=[];s.drawScene();g.step(performance.now(),0);
    const crawlerSprite=s.visuals.boneCrawlerPool[0],impSprite=s.visuals.emberImpPool[0];
    return {crawlerVisible:crawlerSprite.visible,crawlerFrame:crawlerSprite.texture.key,
      crawlerFacesRight:crawlerSprite.flipX,impVisible:impSprite.visible,impFrame:impSprite.frame.name,
      crawlerRect:{x:Math.round(crawlerSprite.x-s.cameraX-crawlerSprite.displayWidth*.5),
        y:Math.round(crawlerSprite.y-(s.cameraY||0)-crawlerSprite.displayHeight*.5),
        width:Math.ceil(crawlerSprite.displayWidth),height:Math.ceil(crawlerSprite.displayHeight)},
      impRect:{x:Math.round(impSprite.x-s.cameraX-impSprite.displayWidth*.5),
        y:Math.round(impSprite.y-(s.cameraY||0)-impSprite.displayHeight*245/256),
        width:Math.ceil(impSprite.displayWidth),height:Math.ceil(impSprite.displayHeight)}};
  });
  assert.equal(bothRendered.crawlerVisible,true);
  assert.equal(bothRendered.crawlerFrame,'gr_v2_crawler_crawl_01');
  assert.equal(bothRendered.crawlerFacesRight,true);
  assert.equal(bothRendered.impVisible,true);assert.equal(bothRendered.impFrame,'run_01');
  const bothCanvas=PNG.sync.read(await skeletalPage.locator('#game canvas').screenshot({
    path:path.join(skeletalArtifactDir,'combined-enemy-phone-scale.png')}));
  const changedPixels=(rect)=>{
    let count=0;
    for(let y=Math.max(0,rect.y);y<Math.min(bothCanvas.height,rect.y+rect.height);y++)
      for(let x=Math.max(0,rect.x);x<Math.min(bothCanvas.width,rect.x+rect.width);x++){
        const i=(y*bothCanvas.width+x)*4;
        if(Math.abs(bothCanvas.data[i]-bothEmpty.data[i])>14||
           Math.abs(bothCanvas.data[i+1]-bothEmpty.data[i+1])>14||
           Math.abs(bothCanvas.data[i+2]-bothEmpty.data[i+2])>14)count++;
      }
    return count;
  };
  assert.ok(changedPixels(bothRendered.crawlerRect)>80,
    'Bone Crawler changes visible pixels beside the Reaper in combined review mode');
  assert.ok(changedPixels(bothRendered.impRect)>50,
    'Ember Imp changes visible pixels in combined review mode');

  // Compare the accepted foothills default and the new Tundra preview at phone scale.
  const worldArtSnapshot=async(query,file,distanceMeters)=>{
    await skeletalPage.goto(origin+'/'+query,
      {waitUntil:'domcontentloaded',timeout:45000});
    await skeletalPage.waitForFunction(()=>{
      const v=window.grimRun?.scene?.scenes?.[0]?.visuals;
      return v?.loaded===true&&v.skeletalBatReady===true&&
        v.boneCrawlerReady===true&&v.emberImpReady===true;
    },null,{timeout:45000});
    await skeletalPage.click('#start-btn');
    await skeletalPage.waitForFunction(()=>window.grimRun?.scene?.scenes?.[0]?.state==='playing',
      null,{timeout:15000});
    const geometry=await skeletalPage.evaluate(distanceMeters=>{
      const g=window.grimRun,s=g.scene.scenes[0];
      g.loop.stop();s.state='paused';s.elapsed=0;s.frame=0;s.distance=distanceMeters;
      s.hasTeleported=false;s.player.x=s.startX+distanceMeters*window.GRIM_CONFIG.pxPerMeter;
      s.player.y=s.terrain.groundAt(s.player.x);
      s.player.grounded=true;s.player.velocityY=0;
      s.cameraX=s.player.x-s.width*window.GRIM_CONFIG.reaperXRatio;
      s.cameraY=s.player.y-s.groundY;
      s.cameras.main.setScroll(s.cameraX,s.cameraY);
      s.refreshHud();
      s.enemies=[];s.fireballs=[];s.obstacles=[];s.coins=[];s.souls=[];s.particles=[];
      s.drawScene();g.step(performance.now(),0);
      return {preview:s.tundraWorldArtReviewRequested,
        ground:[0,70,160,310].map(dx=>s.terrain.groundAt(s.player.x+dx)),
        player:{x:s.player.x,y:s.player.y,hp:s.player.hp,grounded:s.player.grounded}};
    },distanceMeters);
    const image=PNG.sync.read(await skeletalPage.locator('#game canvas').screenshot({path:file}));
    return {geometry,image};
  };
  const foothillsDefault=await worldArtSnapshot('?seed=33',
    path.join(skeletalArtifactDir,'foothills-default-phone-scale.png'),1500);
  const foothillsAlias=await worldArtSnapshot('?worldReview=foothills&seed=33',
    path.join(skeletalArtifactDir,'foothills-alias-phone-scale.png'),1500);
  assert.equal(foothillsDefault.geometry.preview,false);
  assert.equal(foothillsAlias.geometry.preview,false,'Accepted foothills review alias uses the default art');
  assert.deepEqual(foothillsAlias.geometry.ground,foothillsDefault.geometry.ground,
    'Foothills art leaves seeded terrain geometry untouched');
  let aliasPixelsChanged=0;
  for(let i=0;i<foothillsAlias.image.data.length;i+=4){
    if(Math.abs(foothillsAlias.image.data[i]-foothillsDefault.image.data[i])>2||
       Math.abs(foothillsAlias.image.data[i+1]-foothillsDefault.image.data[i+1])>2||
       Math.abs(foothillsAlias.image.data[i+2]-foothillsDefault.image.data[i+2])>2)aliasPixelsChanged++;
  }
  assert.ok(aliasPixelsChanged<50,'Foothills alias matches the accepted default rendering');

  const tundraDefault=await worldArtSnapshot('?seed=33',
    path.join(skeletalArtifactDir,'tundra-default-phone-scale.png'),2600);
  const tundraReview=await worldArtSnapshot('?worldReview=tundra&seed=33',
    path.join(skeletalArtifactDir,'tundra-review-phone-scale.png'),2600);
  assert.equal(tundraDefault.geometry.preview,false);
  assert.equal(tundraReview.geometry.preview,true);
  assert.deepEqual(tundraReview.geometry.ground,tundraDefault.geometry.ground,
    'Tundra artwork leaves seeded terrain geometry untouched');
  assert.deepEqual(tundraReview.geometry.player,tundraDefault.geometry.player,
    'Tundra artwork leaves player position and health untouched');
  assert.deepEqual([tundraReview.image.width,tundraReview.image.height],[950,430]);
  let worldPixelsChanged=0;
  for(let i=0;i<tundraReview.image.data.length;i+=4){
    if(Math.abs(tundraReview.image.data[i]-tundraDefault.image.data[i])>12||
       Math.abs(tundraReview.image.data[i+1]-tundraDefault.image.data[i+1])>12||
       Math.abs(tundraReview.image.data[i+2]-tundraDefault.image.data[i+2])>12)worldPixelsChanged++;
  }
  assert.ok(worldPixelsChanged>15000,
    'Tundra preview visibly changes the phone-scale scene without changing gameplay state');

  // Every ground material must reach the real Phaser scene and sit on a
  // generated solid section. Move a paused seeded run through the eight biomes
  // without changing any terrain or collision data.
  await skeletalPage.goto(origin+'/?seed=33',
    {waitUntil:'domcontentloaded',timeout:45000});
  await skeletalPage.waitForFunction(()=>window.grimRun?.scene?.scenes?.[0]?.visuals?.loaded===true,
    null,{timeout:45000});
  await skeletalPage.click('#start-btn');
  await skeletalPage.waitForFunction(()=>window.grimRun?.scene?.scenes?.[0]?.state==='playing',
    null,{timeout:15000});
  await skeletalPage.evaluate(()=>{
    const game=window.grimRun,scene=game.scene.scenes[0];
    game.loop.stop();scene.state='paused';scene.enemies=[];scene.obstacles=[];
  });
  const terrainTargets=[
    [300,'forest'],[1500,'foothills'],[3400,'tundra'],[5500,'caves'],
    [6500,'crystals'],[7500,'ashlands'],[9000,'lava'],[11000,'boss']
  ];
  for(const [meters,biome] of terrainTargets){
    await skeletalPage.evaluate(m=>{
      const game=window.grimRun,scene=game.scene.scenes[0],ppm=window.GRIM_CONFIG.pxPerMeter;
      scene.distance=m;scene.hasTeleported=m>=5000;
      scene.player.x=scene.startX+m*ppm;
      scene.player.y=scene.terrain.groundAt(scene.player.x)??scene.terrain.anchorAt(scene.player.x);
      scene.player.grounded=true;scene.player.velocityY=0;
      scene.cameraX=scene.player.x-scene.width*window.GRIM_CONFIG.reaperXRatio;
      scene.cameraY=scene.player.y-scene.groundY;
      scene.cameras.main.setScroll(scene.cameraX,scene.cameraY);
      scene.drawScene();game.step(performance.now(),0);
    },meters);
    await skeletalPage.waitForFunction(id=>{
      const scene=window.grimRun?.scene?.scenes?.[0];
      return scene?.terrainMaterialIds?.has(id)&&
        [...scene.terrainTextureViews.values()].some(view=>view.sprite.visible&&
          view.sprite.texture.key==='terrain-material-'+id);
    },biome,{timeout:45000});
    const grounded=await skeletalPage.evaluate(id=>{
      const scene=window.grimRun.scene.scenes[0];
      const visible=[...scene.terrainTextureViews.values()].filter(view=>view.sprite.visible);
      const sections=scene.terrain.visibleSections(scene.cameraX-140,scene.cameraX+scene.width+170);
      const gaps=sections.filter(section=>section.kind==='gap');
      const gapTextureViews=gaps.filter(gap=>[...scene.terrainTextureViews.keys()].some(key=>
        key.startsWith(['gap',gap.start,gap.end].join(':')))).length;
      return {material:visible.some(view=>view.sprite.texture.key==='terrain-material-'+id),
        groundedSections:sections.filter(section=>section.kind!=='gap').length,gaps,gapTextureViews};
    },biome);
    assert.equal(grounded.material,true,biome+' material is drawn on the visible terrain');
    assert.ok(grounded.groundedSections>0,biome+' view includes generated solid terrain');
    assert.equal(grounded.gapTextureViews,0,biome+' leaves generated gaps untextured');
    await skeletalPage.screenshot({path:path.join(skeletalArtifactDir,'terrain-'+biome+'-phone-scale.png')});
  }
  await skeletalPage.close();

  await page.click('#start-btn');
  await page.waitForFunction(()=>window.grimRun.scene.scenes[0].state==='playing');
  const v2Anchors=await page.evaluate(()=>{
    const s=window.grimRun.scene.scenes[0],v=s.visuals,m=window.GRIM_VISUALS.V2_REAPER;
    s.player.sliding=true;v.render();
    const slide=v.reaperPoseSprites.slide;
    const slideVisible=slide.visible;
    const slideGround=Math.abs(slide.y+m.slide.anchor[1]*m.slide.scale-s.feetY);
    const slideHeight=179*m.slide.scale;
    const runHeight=290*m.run_pose_01.scale;
    s.player.sliding=false;s.player.attackMs=120;v.render();
    const attackPose=Object.entries(v.reaperPoseSprites).find(([name,sprite])=>
      name.startsWith('scythe_attack')&&sprite.visible)?.[0];
    const attack=v.reaperPoseSprites[attackPose];
    const attackVisible=attack.visible;
    const attackMeta=m[attackPose];
    const attackGround=Math.abs(attack.y+attackMeta.anchor[1]*attackMeta.scale-s.feetY);
    s.player.attackMs=0;s.elapsed=0;
    v.render();const firstRun=Object.entries(v.reaperPoseSprites).find(([name,sprite])=>
      name.startsWith('run')&&sprite.visible)?.[0];
    s.elapsed=1/12;v.render();const secondRun=Object.entries(v.reaperPoseSprites).find(([name,sprite])=>
      name.startsWith('run')&&sprite.visible)?.[0];
    const runBobYs=[];
    for(let i=0;i<8;i++){
      s.elapsed=i/12;v.render();
      const sprite=Object.entries(v.reaperPoseSprites).find(([name,sprite])=>
        name.startsWith('run_pose_')&&sprite.visible)?.[1];
      runBobYs.push(sprite?.y);
    }
    const runBobRange=Math.max(...runBobYs)-Math.min(...runBobYs);
    s.enemies=[{kind:'bat',x:s.cameraX+320,y:160,mode:'glide',hp:2,phase:0,dead:false}];
    s.elapsed=0;v.render();const flying=v.batPool[0],firstBat=flying.texture.key;
    s.elapsed=.09;v.render();const secondBat=flying.texture.key;
    s.enemies[0].mode='dive';v.render();
    return {slideVisible,slideGround,slideHeight,attackVisible,
      attackGround,attackPose,runHeight,runBobRange,slideClearance:window.GRIM_CONFIG.slideClearancePx,
      runFrame1:firstRun,runFrame2:secondRun,batVisible:flying.visible,
      firstBat,secondBat,diveKey:flying.texture.key};
  });
  assert.equal(v2Anchors.slideVisible,true);assert.ok(v2Anchors.slideGround<.1);
  assert.ok(v2Anchors.slideHeight>72&&v2Anchors.slideHeight<76&&
    v2Anchors.slideHeight<v2Anchors.slideClearance-1,
    'Reaper keeps full-size head/torso art inside the raised 76px opening');
  assert.equal(v2Anchors.attackVisible,true);assert.ok(v2Anchors.attackGround<.1);
  assert.equal(v2Anchors.attackPose,'scythe_attack_03','Attack uses its impact drawing near the swing midpoint');
  assert.ok(v2Anchors.runHeight>119&&v2Anchors.runHeight<121,
    'v2 standard Reaper pose is enlarged to the approved phone-review scale');
  assert.equal(v2Anchors.runFrame1,'run_pose_01');
  assert.equal(v2Anchors.runFrame2,'run_pose_02','Reaper cycle advances one balanced gait position every 1/12 second');
  assert.ok(v2Anchors.runBobRange>3.2&&v2Anchors.runBobRange<3.8,
    'Reaper gets a subtle 3.5px peak-to-peak bob across the full stride without changing scale');
  assert.equal(v2Anchors.batVisible,true);assert.equal(v2Anchors.firstBat,'gr_v2_bat_raised');
  assert.equal(v2Anchors.secondBat,'gr_v2_bat_mid_up','Bat flap advances through aligned in-between art');
  assert.equal(v2Anchors.diveKey,'gr_v2_bat_dive');
  // Check decoded pixels, not only texture keys or metadata constants.
  const decoded=await page.evaluate(()=>{
    const s=window.grimRun.scene.scenes[0],V=window.GRIM_VISUALS;
    return [...Object.entries(V.V2_REAPER).map(([name,m])=>({name,m})),
      ...Object.entries(V.V2_BAT).map(([name,m])=>({name,m}))].map(({name,m})=>{
      const image=s.textures.get(m.key).getSourceImage(),c=document.createElement('canvas');
      c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);
      const d=ctx.getImageData(0,0,c.width,c.height).data;
      let opaque=0,black=0,minX=c.width,maxX=-1,minY=c.height,maxY=-1,eyeX=0,eyeY=0,eyeCount=0;
      for(let i=0;i<d.length;i+=4){
        const x=(i/4)%c.width,y=Math.floor(i/4/c.width);
        if(d[i+3]>32){opaque++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);if(d[i]+d[i+1]+d[i+2]<6)black++;}
        if(d[i+3]>100&&d[i+1]>150&&d[i+2]>160&&d[i+1]>d[i]*1.25&&d[i+2]>d[i]*1.2){eyeX+=x;eyeY+=y;eyeCount++;}
      }
      return {name,key:m.key,coverage:opaque/(c.width*c.height),black:black/Math.max(1,opaque),eyeCount,
        height:(maxY-minY+1)*m.scale,width:(maxX-minX+1)*m.scale,
        feetY:(maxY-m.anchor[1])*m.scale,
        eyeX:eyeCount?((eyeX/eyeCount)-m.anchor[0])*m.scale:null,
        eyeY:eyeCount?((eyeY/eyeCount)-m.anchor[1])*m.scale:null};
    });
  });
  for(const p of decoded){assert.ok(p.coverage>.025&&p.coverage<.8,p.key+' silhouette coverage');assert.ok(p.black<.5,p.key+' is not a black rectangle');assert.ok(p.height>20,p.key+' is not a flattened fragment');}
  const runPixelBounds=decoded.filter(p=>p.name.startsWith('run_pose_'));
  assert.equal(runPixelBounds.length,8,'all eight redesigned run poses were decoded from PNG pixels');
  assert.ok(runPixelBounds.every(p=>p.height>117&&p.height<121),'all run drawings keep a consistent visible scale');
  const hurtPixelBounds=decoded.find(p=>p.name==='hurt');
  assert.ok(hurtPixelBounds&&hurtPixelBounds.height>119&&hurtPixelBounds.height<121,
    'decoded damage artwork keeps the Reaper at the standard 120px visible height');
  const attackPixelBounds=decoded.filter(p=>p.name.startsWith('scythe_attack'));
  assert.equal(attackPixelBounds.length,4,'four scythe attack drawings decode from actual PNG pixels');
  assert.ok(attackPixelBounds.every(p=>p.eyeCount>=10),'all four swing frames retain the Reaper eye and head');
  const eyeCounts=attackPixelBounds.map(p=>p.eyeCount);
  assert.ok(Math.max(...eyeCounts)/Math.min(...eyeCounts)<1.3,
    'the Reaper head stays a consistent size through the scythe swing');
  for(const name of ['run_pose_01','run_pose_02','run_pose_03','run_pose_04','run_pose_08']){
    const frame=runPixelBounds.find(p=>p.name===name);
    assert.ok(Math.abs(frame.feetY)<1,`${name} visibly reaches the ground line`);
  }
  const eyeOffsets=runPixelBounds.map(p=>p.eyeX).filter(Number.isFinite);
  assert.equal(eyeOffsets.length,8,'all eight run poses retain a visible cyan eye');
  assert.ok(Math.max(...eyeOffsets)-Math.min(...eyeOffsets)<1.5,
    'decoded cyan-eye pixels stay aligned horizontally across the run cycle: '+JSON.stringify(eyeOffsets));
  const eyeYOffsets=runPixelBounds.map(p=>p.eyeY).filter(Number.isFinite);
  assert.ok(Math.max(...eyeYOffsets)-Math.min(...eyeYOffsets)<2.5,
    'decoded cyan-eye pixels stay aligned vertically with only a small natural bounce: '+JSON.stringify(eyeYOffsets));
  const artifactDir=path.join(root,'test-results');fs.mkdirSync(artifactDir,{recursive:true});
  await page.setViewportSize({width:950,height:430});
  const renderedRunFrames=[];
  for(const [i,name] of Array.from({length:8},(_,i)=>[i,'pose-'+String(i+1).padStart(2,'0')])){
    const time=i/12;
    await page.evaluate(t=>{
      const g=window.grimRun,s=g.scene.scenes[0];g.loop.stop();
      s.state='playing';s.elapsed=t;s.damageFlashMs=0;Object.assign(s.player,{grounded:true,onSoulPlatform:false,sliding:false,airTuck:false,attackMs:0,visualFireMs:0,invulMs:0,slowMs:0});
      s.enemies=[];
      s.drawScene();g.step(performance.now(),0);
    },time);
    const canvasPng=await page.locator('#game canvas').screenshot({path:path.join(artifactDir,'canvas-run-'+String(i+1).padStart(2,'0')+'.png')});
    renderedRunFrames.push(PNG.sync.read(canvasPng).data);
    await page.screenshot({path:path.join(artifactDir,'mobile-run-'+name+'.png')});
  }
  assert.equal(new Set(renderedRunFrames.map(pixels=>crypto.createHash('sha256').update(pixels).digest('hex'))).size,8,
    'actual mobile-sized Phaser canvas renders eight distinct redesigned Reaper poses');
  for(let i=1;i<renderedRunFrames.length;i++){
    let changed=0;const a=renderedRunFrames[i-1],b=renderedRunFrames[i];
    for(let p=0;p<a.length;p+=4)if(Math.abs(a[p]-b[p])>18||Math.abs(a[p+1]-b[p+1])>18||Math.abs(a[p+2]-b[p+2])>18)changed++;
    assert.ok(changed>100,'adjacent run poses create visible pixel movement on the game canvas');
  }
  const renderedAttackFrames=[],attackPoseChecks=[];
  for(const attackMs of [230,165,100,35]){
    const check=await page.evaluate(ms=>{
      const g=window.grimRun,s=g.scene.scenes[0],v=s.visuals,m=window.GRIM_VISUALS.V2_REAPER;
      g.loop.stop();s.state='playing';s.damageFlashMs=0;
      Object.assign(s.player,{grounded:true,onSoulPlatform:false,sliding:false,airTuck:false,
        attackMs:ms,visualFireMs:0,invulMs:0,slowMs:0});
      s.drawScene();g.step(performance.now(),0);
      const pair=Object.entries(v.reaperPoseSprites).find(([name,sprite])=>
        name.startsWith('scythe_attack')&&sprite.visible);
      const [name,sprite]=pair,meta=m[name];
      return {name,visible:sprite.visible,feetError:Math.abs(sprite.y+meta.anchor[1]*meta.scale-s.feetY),
        xError:Math.abs(sprite.x+meta.anchor[0]*meta.scale-s.player.x)};
    },attackMs);
    attackPoseChecks.push(check);
    renderedAttackFrames.push(await page.locator('#game canvas').screenshot({
      path:path.join(artifactDir,'canvas-scythe-'+String(attackPoseChecks.length)+'.png')}));
  }
  assert.deepEqual(attackPoseChecks.map(x=>x.name),[
    'scythe_attack','scythe_attack_02','scythe_attack_03','scythe_attack_04']);
  assert.ok(attackPoseChecks.every(x=>x.visible&&x.feetError<.1&&x.xError<.1),
    'all swing poses stay attached to the player at the same ground and movement anchors');
  const attackPixelHashes=renderedAttackFrames.map(image=>
    crypto.createHash('sha256').update(PNG.sync.read(image).data).digest('hex'));
  assert.equal(new Set(attackPixelHashes).size,4,'mobile-sized Phaser canvas visibly renders four distinct swing poses');
  for(let i=1;i<renderedAttackFrames.length;i++){
    const a=PNG.sync.read(renderedAttackFrames[i-1]).data,b=PNG.sync.read(renderedAttackFrames[i]).data;let changed=0;
    for(let p=0;p<a.length;p+=4)if(Math.abs(a[p]-b[p])>18||Math.abs(a[p+1]-b[p+1])>18||Math.abs(a[p+2]-b[p+2])>18)changed++;
    assert.ok(changed>100,'adjacent swing poses create visible pixel movement on the game canvas');
  }
  // Delay the art after its compact contact pose. The start control must wait
  // for that verified pose, then gameplay must begin with the Reaper visible
  // while action poses and Bat art are still loading.
  const earlyPage=await browser.newPage({viewport:{width:950,height:430}});
  let releaseFirstPose;
  const firstPoseGate=new Promise(resolve=>{releaseFirstPose=resolve;});
  await earlyPage.route('**/assets/characters/illustrated-v2/**',async route=>{
    if(route.request().url().includes('reaper_run_pose_01_v1.png'))await firstPoseGate;
    else await new Promise(resolve=>setTimeout(resolve,6000));
    await route.continue();
  });
  await earlyPage.goto(origin+'/?seed=44',{waitUntil:'domcontentloaded',timeout:45000});
  await earlyPage.waitForFunction(()=>{
    const v=window.grimRun?.scene?.scenes?.[0]?.visuals;
    return v?.reviewV2===true&&document.getElementById('start-btn')?.disabled===true;
  },null,{timeout:12000});
  assert.equal(await earlyPage.locator('#start-btn').isEnabled(),false,
    'Do not start a run before the first small Reaper image is ready');
  releaseFirstPose();
  await earlyPage.waitForFunction(()=>document.getElementById('start-btn')?.disabled===false,
    null,{timeout:12000});
  await earlyPage.click('#start-btn');
  await earlyPage.waitForFunction(()=>{
    const s=window.grimRun?.scene?.scenes?.[0],v=s?.visuals;
    return s?.state==='playing'&&v?.reviewV2===true&&
      v.reaperPoseSprites.run_pose_01?.visible===true&&v.loaded===false&&s.distance<5;
  },null,{timeout:12000});
  const earlySprite=await earlyPage.evaluate(()=>{
    const s=window.grimRun.scene.scenes[0],v=s.visuals,p=v.reaperPoseSprites.run_pose_01;
    return {visible:p.visible,texture:s.textures.exists('gr_v2_reaper_run_pose_01'),loading:!v.loaded,
      distance:s.distance,buttonEnabled:!document.getElementById('start-btn').disabled};
  });
  assert.equal(earlySprite.visible,true);
  assert.equal(earlySprite.texture,true);
  assert.equal(earlySprite.loading,true);
  assert.ok(earlySprite.distance<5,'The Reaper is visible before the run reaches five meters');
  assert.equal(earlySprite.buttonEnabled,true);
  await earlyPage.close();
  // A broken initial pose must not prevent the remaining valid motion art appearing.
  const compactFirstPose=path.join(root,'assets/characters/illustrated-v2/reaper/run-cycle-balanced-v1/reaper_run_pose_01_v1.png');
  await page.route('**/reaper_run_pose_01_v1.png*',route=>route.fulfill({status:200,contentType:'image/png',body:fs.readFileSync(compactFirstPose).subarray(0,Math.floor(fs.statSync(compactFirstPose).size/2))}));
  await page.goto(origin+'/?seed=33',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.grimRun?.scene.scenes[0]?.visuals?.loaded);
  const rejected=await page.evaluate(()=>{const v=window.grimRun.scene.scenes[0].visuals;return {ready:v.reaperReady,poses:Object.keys(v.reaperPoseSprites).length,firstPosePresent:Boolean(v.reaperPoseSprites.run_pose_01),failed:v.failedAssets.some(x=>x.includes('byte count'))};});
  assert.deepEqual(rejected,{ready:true,poses:19,firstPosePresent:false,failed:true});
  await page.unroute('**/reaper_run_pose_01_v1.png*');
  // The prior procedural presentation remains an explicit fallback option.
  await page.goto(origin+'/?art=procedural&seed=33',{waitUntil:'domcontentloaded',timeout:45000});
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
  console.log('PASS actual Chromium: v0.11.9 accepted forest and foothills art defaults, anchored Tundra mountains render at phone scale, gameplay geometry is unchanged, slide, scythe, and fallbacks.');
 }finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
