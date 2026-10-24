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
    return v?.loaded===true&&v.reviewV2===true;
  },null,{timeout:45000});
  const reviewV2Loaded=await page.evaluate(()=>{
    const s=window.grimRun.scene.scenes[0],v=s.visuals;
    const visuals=window.GRIM_VISUALS;
    return {ready:v.reaperReady&&v.batReady,reviewV2:v.reviewV2,
      reaperPoses:Object.keys(v.reaperPoseSprites).length,bats:v.batPool.length,
      textures:Object.values(visuals.V2_REAPER).every(m=>s.textures.exists(m.key))&&
        Object.values(visuals.V2_BAT).every(m=>s.textures.exists(m.key)),
      failures:v.failedAssets};
  });
  assert.deepEqual(reviewV2Loaded,{ready:true,reviewV2:true,reaperPoses:21,bats:12,
    textures:true,failures:[]});
  await page.click('#start-btn');
  await page.waitForFunction(()=>window.grimRun.scene.scenes[0].state==='playing');
  const v2Anchors=await page.evaluate(()=>{
    const s=window.grimRun.scene.scenes[0],v=s.visuals,m=window.GRIM_VISUALS.V2_REAPER;
    s.player.sliding=true;v.render();
    const slide=v.reaperPoseSprites.slide;
    const slideVisible=slide.visible;
    const slideGround=Math.abs(slide.y+m.slide.anchor[1]*m.slide.scale-s.feetY);
    const slideHeight=651*m.slide.scale;
    const runHeight=272*m.run.scale;
    s.player.sliding=false;s.player.attackMs=120;v.render();
    const attack=v.reaperPoseSprites.scythe_attack;
    const attackVisible=attack.visible;
    const attackGround=Math.abs(attack.y+m.scythe_attack.anchor[1]*m.scythe_attack.scale-s.feetY);
    s.player.attackMs=0;s.elapsed=0;
    v.render();const firstRun=Object.entries(v.reaperPoseSprites).find(([name,sprite])=>
      name.startsWith('run')&&sprite.visible)?.[0];
    s.elapsed=1/18;v.render();const secondRun=Object.entries(v.reaperPoseSprites).find(([name,sprite])=>
      name.startsWith('run')&&sprite.visible)?.[0];
    s.enemies=[{kind:'bat',x:s.cameraX+320,y:160,mode:'glide',hp:2,phase:0,dead:false}];
    s.elapsed=0;v.render();const flying=v.batPool[0],firstBat=flying.texture.key;
    s.elapsed=.09;v.render();const secondBat=flying.texture.key;
    s.enemies[0].mode='dive';v.render();
    return {slideVisible,slideGround,slideHeight,attackVisible,
      attackGround,runHeight,
      runFrame1:firstRun,runFrame2:secondRun,batVisible:flying.visible,
      firstBat,secondBat,diveKey:flying.texture.key};
  });
  assert.equal(v2Anchors.slideVisible,true);assert.ok(v2Anchors.slideGround<.1);
  assert.ok(v2Anchors.slideHeight>46&&v2Anchors.slideHeight<48,
    'v2 slide artwork fills but stays inside the unchanged 48px clearance');
  assert.equal(v2Anchors.attackVisible,true);assert.ok(v2Anchors.attackGround<.1);
  assert.ok(v2Anchors.runHeight>119&&v2Anchors.runHeight<121,
    'v2 standard Reaper pose is enlarged to the approved phone-review scale');
  assert.equal(v2Anchors.runFrame1,'run_contact');
  assert.equal(v2Anchors.runFrame2,'run_contact_mid','Reaper cycle advances to a new in-between pose');
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
      return {name,key:m.key,coverage:opaque/(c.width*c.height),black:black/Math.max(1,opaque),
        height:(maxY-minY+1)*m.scale,width:(maxX-minX+1)*m.scale,
        feetY:(maxY-m.anchor[1])*m.scale,
        eyeX:eyeCount?((eyeX/eyeCount)-m.anchor[0])*m.scale:null,
        eyeY:eyeCount?((eyeY/eyeCount)-m.anchor[1])*m.scale:null};
    });
  });
  for(const p of decoded){assert.ok(p.coverage>.025&&p.coverage<.8,p.key+' silhouette coverage');assert.ok(p.black<.5,p.key+' is not a black rectangle');assert.ok(p.height>20,p.key+' is not a flattened fragment');}
  const runPixelBounds=decoded.filter(p=>p.name.startsWith('run_')||p.name==='run');
  assert.equal(runPixelBounds.length,12,'all twelve run poses were decoded from PNG pixels');
  assert.ok(runPixelBounds.every(p=>p.height>118&&p.height<122),'all run drawings keep the same visible height');
  const attackPixels=decoded.find(p=>p.name==='scythe_attack');
  const runningHeight=runPixelBounds.find(p=>p.name==='run').height;
  assert.ok(attackPixels.height<=runningHeight+1&&attackPixels.height>runningHeight-7,
    'scythe pose remains close in size and does not grow beyond the run pose');
  for(const name of ['run_contact','run','run_transition_01','run_transition_04']){
    const frame=runPixelBounds.find(p=>p.name===name);
    assert.ok(Math.abs(frame.feetY)<1,`${name} visibly reaches the ground line`);
  }
  const eyeOffsets=runPixelBounds.map(p=>p.eyeX).filter(Number.isFinite);
  assert.equal(eyeOffsets.length,12,'all twelve run poses retain a visible cyan eye');
  assert.ok(Math.max(...eyeOffsets)-Math.min(...eyeOffsets)<.35,
    'decoded cyan-eye pixels stay registered across all running poses');
  const artifactDir=path.join(root,'test-results');fs.mkdirSync(artifactDir,{recursive:true});
  await page.setViewportSize({width:950,height:430});
  const renderedRunFrames=[];
  for(const [i,name] of ['contact','contact-mid','transition-01','airborne','airborne-mid','transition-02',
    'recovery','recovery-mid','transition-03','run','stride-mid','transition-04'].entries()){
    const time=i/18;
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
    'actual mobile-sized Phaser canvas renders eight distinct Reaper poses');
  for(let i=1;i<renderedRunFrames.length;i++){
    let changed=0;const a=renderedRunFrames[i-1],b=renderedRunFrames[i];
    for(let p=0;p<a.length;p+=4)if(Math.abs(a[p]-b[p])>18||Math.abs(a[p+1]-b[p+1])>18||Math.abs(a[p+2]-b[p+2])>18)changed++;
    assert.ok(changed>100,'adjacent run poses create visible pixel movement on the game canvas');
  }
  // Delay the art after its compact contact pose. The start control must wait
  // for that verified pose, then gameplay must begin with the Reaper visible
  // while action poses and Bat art are still loading.
  const earlyPage=await browser.newPage({viewport:{width:950,height:430}});
  await earlyPage.route('**/assets/characters/illustrated-v2/**',async route=>{
    if(!route.request().url().includes('run_contact_mobile_v1.png'))
      await new Promise(resolve=>setTimeout(resolve,2500));
    await route.continue();
  });
  await earlyPage.goto(origin+'/?seed=44',{waitUntil:'domcontentloaded',timeout:45000});
  await earlyPage.waitForFunction(()=>{
    const v=window.grimRun?.scene?.scenes?.[0]?.visuals;
    return v?.reviewV2===true&&document.getElementById('start-btn')?.disabled===true;
  },null,{timeout:12000});
  assert.equal(await earlyPage.locator('#start-btn').isEnabled(),false,
    'Do not start a run before the first small Reaper image is ready');
  await earlyPage.waitForFunction(()=>document.getElementById('start-btn')?.disabled===false,
    null,{timeout:12000});
  await earlyPage.click('#start-btn');
  await earlyPage.waitForFunction(()=>{
    const s=window.grimRun?.scene?.scenes?.[0],v=s?.visuals;
    return s?.state==='playing'&&v?.reviewV2===true&&
      v.reaperPoseSprites.run_contact?.visible===true&&v.loaded===false&&s.distance<5;
  },null,{timeout:12000});
  const earlySprite=await earlyPage.evaluate(()=>{
    const s=window.grimRun.scene.scenes[0],v=s.visuals,p=v.reaperPoseSprites.run_contact;
    return {visible:p.visible,texture:s.textures.exists('gr_v2_reaper_run_contact'),loading:!v.loaded,
      distance:s.distance,buttonEnabled:!document.getElementById('start-btn').disabled};
  });
  assert.equal(earlySprite.visible,true);
  assert.equal(earlySprite.texture,true);
  assert.equal(earlySprite.loading,true);
  assert.ok(earlySprite.distance<5,'The Reaper is visible before the run reaches five meters');
  assert.equal(earlySprite.buttonEnabled,true);
  await earlyPage.close();
  // A broken initial pose must not prevent the remaining valid motion art appearing.
  const compactContact=path.join(root,'assets/characters/illustrated-v2/reaper/run-cycle-mobile-v1/run_contact_mobile_v1.png');
  await page.route('**/run_contact_mobile_v1.png*',route=>route.fulfill({status:200,contentType:'image/png',body:fs.readFileSync(compactContact).subarray(0,Math.floor(fs.statSync(compactContact).size/2))}));
  await page.goto(origin+'/?seed=33',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.grimRun?.scene.scenes[0]?.visuals?.loaded);
  const rejected=await page.evaluate(()=>{const v=window.grimRun.scene.scenes[0].visuals;return {ready:v.reaperReady,poses:Object.keys(v.reaperPoseSprites).length,contactPresent:Boolean(v.reaperPoseSprites.run_contact),failed:v.failedAssets.some(x=>x.includes('byte count'))};});
  assert.deepEqual(rejected,{ready:true,poses:20,contactPresent:false,failed:true});
  await page.unroute('**/run_contact_mobile_v1.png*');
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
  console.log('PASS actual Chromium: v0.10.4 main-game motion art, early Reaper visibility, PNG pixel integrity, previous-art comparison, procedural fallback, legacy atlas and God Mode tools.');
 }finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
