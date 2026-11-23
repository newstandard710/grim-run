'use strict';
const {chromium}=require('playwright'),{createHash}=require('node:crypto'),assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({args:['--no-sandbox','--disable-webgl']});
 try{
  const p=await b.newPage({viewport:{width:740,height:360},hasTouch:true}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{window.pulses=[];Object.defineProperty(navigator,'vibrate',{value:ms=>{pulses.push(ms);return true;}});});
  const resp=await p.goto('https://newstandard710.github.io/grim-run/?seed=33&release=b7c215da6a1bb807167e2407451ac23fabc1a107');
  assert.equal(createHash('sha256').update(await resp.body()).digest('hex'),'d6d797f56a4e4df4fbed1365932446e43012463efb64fe9211dddd8c7fb7c3cb');
  await p.waitForFunction(()=>GRIM_FRONTEND?.ready&&grimRun.scene.scenes[0]?.visuals?.reaperReady);
  await p.locator('#home-enter-btn').click();await p.locator('#start-btn').press('Enter');
  await p.waitForFunction(()=>grimRun.scene.scenes[0].distance>1);await p.locator('#jump-btn').tap();await p.locator('#attack-btn').tap();
  const report=await p.evaluate(async()=>{
   const g=grimRun,s=g.scene.scenes[0],p=s.player;g.loop.sleep();clearInterval(s.loopWatchdogId);s.sys.sceneUpdate=()=>{};
   const alloc=[];const create=s.textures.createCanvas;
   s.textures.createCanvas=function(k,w,h,...args){const out=create.call(this,k,w,h,...args);if(out&&k.startsWith('terrain-tundra-'))alloc.push([k,w,h]);return out;};
   const place=m=>{
    const x=s.startX+m*GRIM_CONFIG.pxPerMeter,y=s.terrain.groundAt(x);
    Object.assign(p,{x,y,velocityY:0,grounded:true,onSoulPlatform:false});
    Object.assign(s,{state:'playing',distance:m,hasTeleported:m>=5000,shrineClaimed:true,lastVendorNumber:14,nextVendorNumber:15,
       speed:GRIM_CORE.runSpeed(m),cameraX:x-s.width*GRIM_CONFIG.reaperXRatio,cameraY:y-s.groundY});
    s.nextEncounterX=s.nextEnemySpawnX=s.nextGroundSpawnX=s.nextSnapSpawnX=x+4000;s.syncWorldScroll();s.drawScene();
   };
   place(4830);
   for(let i=0;i<100;i++){await new Promise(requestAnimationFrame);if(i===12)s.jump();if(i===18)s.jumpEnd();if(i===48)s.attack();s.update(0,1000/60);g.step(performance.now(),0);}
   const end=s.distance,z=s.terrain.sectionAt(p.x),view=s.terrainTextureViews.get([z.kind,z.start,z.end,'tundra'].join(':'));
   const tex=s.textures.get(view.compositeTextureKey),raw=tex.getContext().getImageData(0,0,tex.width,360).data;
   const paint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
   place(5975);const residual=Object.keys(s.textures.list).filter(k=>k.startsWith('terrain-tundra-'));
   const quiet=pulses.length,hp=p.hp;p.invulMs=0;s.obstacles=[GRIM_CORE.obstacle('rock',p.x,s.terrain.groundAt(p.x))];s.checkHazards();s.checkHazards();
   return {version:GRIM_CONFIG.version,backend:g.renderer.type,end,alloc,pixels:alloc.reduce((v,a)=>v+a[1]*a[2],0),paint,residual,quiet,pulses,hpBefore:hp,hpAfter:p.hp};
  });
  console.log('Public summit and damage',JSON.stringify(report));
  assert.equal(report.version,'0.19.21');assert.equal(report.backend,1);assert(report.end>4888&&report.end<4889);
  assert.equal(report.alloc.length,2);assert.equal(report.pixels,5209920);assert.deepEqual(report.residual,[]);
  assert.equal(report.paint,'1167f5711587e1679d6aa907fa3659cb4a145971e5b6afd3b2260357d8fa2d69');
  assert.equal(report.quiet,0);assert.deepEqual(report.pulses,[30]);assert.equal(report.hpAfter,report.hpBefore-1);assert.deepEqual(errors,[]);
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
