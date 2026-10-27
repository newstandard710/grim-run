'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'test-results');fs.mkdirSync(dir,{recursive:true});
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png','.webp':'image/webp'};
const server=http.createServer((req,res)=>{try{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1))||'index.html');if(!file.startsWith(root+path.sep))return res.writeHead(403).end();res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));}catch(e){res.writeHead(404).end();}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader']});
 const context=await browser.newContext({viewport:{width:950,height:430},recordVideo:{dir,size:{width:950,height:430}}});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const shot=async name=>{await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:path.join(dir,'motion-'+name+'.png')});};
 try{
  await page.goto(origin+'/?seed=33',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.grimRun?.scene?.scenes?.[0]?.visuals?.loaded&&window.GRIM_FRONTEND?.ready,null,{timeout:60000});
  assert(await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];return s.motionArt.ready&&!s.cameras.main.visible;}),'Home uses its own canvas without an underlying world render');
  await shot('home-bat');
  const pixels=await page.evaluate(()=>{
   const s=window.grimRun.scene.scenes[0],out={};
   for(const name of Object.keys(window.GRIM_MOTION_DATA.sheets)){
    const c=document.createElement('canvas');c.width=c.height=320;const g=c.getContext('2d'),source=s.textures.get('motion-'+name).getSourceImage();out[name]=[];
    for(let i=0;i<24;i++){g.clearRect(0,0,320,320);g.drawImage(source,i%6*320,Math.floor(i/6)*320,320,320,0,0,320,320);const a=g.getImageData(0,0,320,320).data;let n=0,bottom=0;for(let p=3;p<a.length;p+=4)if(a[p]>64){n++;bottom=Math.max(bottom,Math.floor(p/4/320));}out[name].push({n,bottom});}
   }return out;
  });
  for(const [name,counts]of Object.entries(pixels))assert(counts.length===24&&counts.every(v=>v.n>10000&&v.n<60000),name+' has 24 decoded complete transparent poses');
  assert(pixels['reaper-run'].every(v=>v.bottom<=280),'No running boot penetrates the floor');
  assert(pixels['reaper-jump'].slice(18).every(v=>Math.abs(v.bottom-279)<=1),'All grounded landing drawings register to the same foot line');
  await page.locator('#home-enter-btn').click();await page.locator('#start-btn').click();
  await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.sys.sceneUpdate=()=>{};s.state='paused';s.ui.setMode('playing');s.player.invulMs=0;s.player.visualHurtMs=0;s.obstacles=[];s.enemies=[];s.powerManager.levels.soulCleave=0;});
  // Exercise the solid run path at every subpose, not just authored keyframes.
  const solid=await page.evaluate(()=>{
   const s=window.grimRun.scene.scenes[0],R=window.GRIM_RUN_DATA,A=window.GRIM_MOTION_ART;
   const c=document.createElement('canvas');c.width=c.height=R.cell;const g=c.getContext('2d');
   const source=s.textures.get('motion-reaper-run-solid').getSourceImage();let minHead=255,seen=new Set();
   for(let i=0;i<R.frames;i++){
    s.player.x=s.startX+A.STRIDE_PX*(i+.1)/R.frames;s.player.grounded=true;s.player.visualLandingMs=0;
    s.drawScene();const visible=s.motionArt.body.filter(v=>v.visible);
    if(visible.length!==1||visible[0].alpha!==1||visible[0].texture.key!=='motion-reaper-run-solid')throw Error('Faded or doubled Reaper '+i);
    seen.add(s.motionArt.state.atlasFrame);
    g.clearRect(0,0,R.cell,R.cell);g.drawImage(source,i%R.columns*R.cell,Math.floor(i/R.columns)*R.cell,R.cell,R.cell,0,0,R.cell,R.cell);
    const bytes=g.getImageData(110,80,20,28).data,alpha=[];for(let j=3;j<bytes.length;j+=4)alpha.push(bytes[j]);alpha.sort((a,b)=>a-b);minHead=Math.min(minHead,alpha[Math.floor(alpha.length/2)]);
   }
   return {ready:s.motionArt.runReady,frames:seen.size,minHead};
  });assert(solid.ready);assert.equal(solid.frames,192);assert(solid.minHead>=250,'The hood remains opaque between paintings');
  const frames=new Set();
  for(let i=0;i<24;i++){
   const pose=await page.evaluate(i=>{const s=window.grimRun.scene.scenes[0],p=s.player;p.x=s.startX+window.GRIM_MOTION_ART.STRIDE_PX*i/24;p.y=s.terrain.groundAt(p.x);p.grounded=true;p.visualLandingMs=0;s.cameraX=p.x-s.width*.32;s.cameras.main.setScroll(s.cameraX,s.cameraY);s.drawScene();return {frame:s.motionArt.state.frame,name:s.motionArt.state.name,old:Object.values(s.visuals.reaperPoseSprites).some(v=>v.visible),visible:s.motionArt.body.some(v=>v.visible)};},i);
   assert.equal(pose.name,'reaper-run');assert(pose.visible&&!pose.old);frames.add(Math.round(pose.frame));if([0,6,12,18].includes(i))await shot('run-'+i);
  }assert.equal(frames.size,24);
  for(const [name,vy,age,landing]of [['launch',-610,15,0],['rise',-400,130,0],['apex',0,390,0],['fall',450,650,0],['contact',0,0,175],['compress',0,0,100],['recover',0,0,20]]){
   const value=await page.evaluate(({vy,age,landing})=>{const s=window.grimRun.scene.scenes[0],p=s.player;p.grounded=landing>0;p.jumpAgeMs=age;p.velocityY=vy;p.visualLandingMs=landing;p.y=s.terrain.groundAt(p.x)-(p.grounded?0:65);s.drawScene();return s.motionArt.state;},{vy,age,landing});assert.equal(value.name,'reaper-jump');await shot(name);
  }
  const windowScale=await page.evaluate(()=>window.GRIM_MOTION_ART.WEAPON_SCALE);
  let weaponScale;
  for(const progress of [0,.10,.20,.35,.50,.65,.79,.92,.999]){
   const value=await page.evaluate(progress=>{const s=window.grimRun.scene.scenes[0],p=s.player;p.grounded=true;p.y=s.terrain.groundAt(p.x);p.visualLandingMs=0;p.attackMs=260*(1-progress);s.drawScene();const a=s.motionArt;return {name:a.state?.name,weapon:a.weapon.visible,angle:a.weapon.rotation,scale:[a.weapon.scaleX,a.weapon.scaleY],feet:s.feetY,body:a.body.filter(v=>v.visible).map(v=>v.y)};},progress);
   assert.equal(value.name,'reaper-cut-body');assert(value.weapon&&value.scale[0]<0&&value.scale[1]>0);assert(value.body.every(y=>y===value.feet));weaponScale??=value.scale;assert.deepEqual(value.scale,weaponScale,'The scythe scale stays identical through every phase');assert(Math.abs(value.scale[1]-windowScale)<1e-9);await shot('cut-'+Math.round(progress*100));
  }
  const cadence=await page.evaluate(()=>{const a=window.GRIM_MOTION_ART;return [300,362.5,425].map(speed=>({speed,frame:a.runFrame(speed),expected:speed/a.STRIDE_PX*24}));});
  for(const sample of cadence)assert(Math.abs(sample.frame-sample.expected)<1e-8);
  const arc=await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0],p=s.player;p.attackMs=130;s.drawScene();const r=window.GRIM_MOTION_ART.cutRig(.5),D=window.GRIM_MOTION_DATA,A=window.GRIM_MOTION_ART;const tip=A.weaponPoint(r,D.weapon.tip),edge=A.sweepPoint(r,D.weapon.tip);return {drawn:s.motionArt.trail.commandBuffer.length>0,reach:Math.hypot(edge.x-r.x,edge.y-r.y)/Math.hypot(tip.x-r.x,tip.y-r.y)};});assert(arc.drawn&&Math.abs(arc.reach-1/.6)<1e-8);
  const timers=await page.evaluate(()=>{
   const s=window.grimRun.scene.scenes[0],p=s.player;s.motionArt.hide();s.state='playing';p.attackMs=0;p.grounded=true;p.y=s.terrain.groundAt(p.x);p.visualLandingMs=175;s.update(0,16);const remaining=p.visualLandingMs;s.jump();const launched={grounded:p.grounded,landing:p.visualLandingMs};s.state='paused';const x=p.x,phase=s.motionArt.state;s.update(0,100);return {remaining,launched,frozen:p.x===x};
  });assert.equal(timers.remaining,159);assert(!timers.launched.grounded&&timers.launched.landing===0&&timers.frozen);
  const perf=await page.evaluate(()=>{
   const s=window.grimRun.scene.scenes[0];s.startRun();s.setGodMode(true);const samples=[];for(let i=0;i<180;i++){const t=performance.now();s.update(0,1000/60);samples.push(performance.now()-t);}samples.sort((a,b)=>a-b);return {scope:'Simulation and draw preparation CPU; excludes GPU presentation',viewport:[s.width,s.height],n:samples.length,mean:samples.reduce((a,b)=>a+b)/samples.length,p95:samples[Math.floor(samples.length*.95)],max:samples.at(-1)};
  });fs.writeFileSync(path.join(dir,'motion-performance.json'),JSON.stringify(perf,null,2));console.log('Motion CPU timings',JSON.stringify(perf));
  await page.goto(origin+'/assets/motion/v0180/review.html');await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Ready'));await page.locator('#play').click();await shot('pose-review');
  assert.deepEqual(errors,[]);
  console.log('PASS Chromium v0.18: all 72 nonblank poses, distance-phase run, seven jump/landing states, seven rigid scythe poses, interruptible single-clock landing, pause freeze, home render suspension and phone CPU report.');
 }finally{const video=page.video();await context.close();if(video)fs.renameSync(await video.path(),path.join(dir,'motion-animation-preview.webm'));await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
