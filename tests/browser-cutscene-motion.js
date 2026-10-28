'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'test-results');fs.mkdirSync(dir,{recursive:true});
const server=http.createServer((req,res)=>{
 try{const f=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname.replace(/^\/+/,''))||'index.html');
  if(!f.startsWith(root+path.sep))return res.writeHead(403).end();
  res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.ttf':'font/ttf'})[path.extname(f)]||'application/octet-stream'});res.end(fs.readFileSync(f));
 }catch(e){res.writeHead(404).end(String(e));}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader']});
 try{
  for(const [width,height]of [[950,430],[740,360]]){
   const context=await browser.newContext({viewport:{width,height},recordVideo:{dir,size:{width,height}}}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   try{
    await page.goto('http://127.0.0.1:'+server.address().port+'/?seed=33');
    await page.waitForFunction(()=>window.grimRun?.scene.scenes[0]?.visuals?.reaperReady,null,{timeout:90000});
    await page.locator('#home-enter-btn').click({force:true});await page.locator('#start-btn').click({force:true});
    const eyes=await page.evaluate(()=>{
     const s=window.grimRun.scene.scenes[0],texture=s.textures.get('cutscene-bow');
     const canvas=document.createElement('canvas');canvas.width=224;canvas.height=224;const ctx=canvas.getContext('2d');
     return window.GRIM_CUTSCENE_DATA.bow.rig.map((rig,i)=>{
      const f=texture.get(i);ctx.clearRect(0,0,224,224);ctx.drawImage(f.source.image,f.cutX,f.cutY,224,224,0,0,224,224);
      const p=ctx.getImageData(0,0,224,224).data;let n=0,far=0;
      for(let y=0;y<224;y++)for(let x=0;x<224;x++){const at=(y*224+x)*4;
       if(p[at]<130&&p[at+1]>140&&p[at+2]>100&&p[at+3]>180){n++;far=Math.max(far,Math.hypot(x-rig.eye[0],y-rig.eye[1]));}}
      const point=rig.eye,distance=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],u=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(point[0]-a[0]-u*dx,point[1]-a[1]-u*dy);};
      const hands=window.GRIM_CUTSCENE_DATA.bow.hands[i];
      const occluded=[0,1].some(j=>distance(rig.shoulders[j],rig.elbows[j])<8||distance(rig.elbows[j],hands[j])<8);
      return {n,far,occluded};
     });
    });
    assert(eyes.every(e=>(e.n>0||e.occluded)&&e.far<6),'Every decoded pose has one registered head; only modeled arm occlusion may cover its eye, with no stray second eye');
    await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s._cutsceneRealUpdate=s.sys.sceneUpdate;s.sys.sceneUpdate=function(){};clearInterval(s.loopWatchdogId);window.grimRun.loop.sleep();s.state='playing';s.obstacles=[];s.enemies=[];s.fireballs=[];});
    for(const [kind,k]of [['angel',1],['devil',8]]){
     const initial=await page.evaluate(k=>{const s=window.grimRun.scene.scenes[0];s.triggerVendor(k);window.grimRun.loop.sleep();s.drawScene();
      return {x:s.player.x,hp:s.player.hp,coins:s.coinCount,elapsed:s.elapsed,rng:s.rng.state,offers:JSON.stringify(s.pendingOffers)};},k);
     const used=new Set();
     for(let i=0;i<=200;i++){
      const t=i*.0499;
      const info=await page.evaluate(t=>{const s=window.grimRun.scene.scenes[0];s.vendorIntroMs=10000-t*1000;s.drawScene();window.grimRun.step(performance.now(),0);
       const a=s.vendorArt;return {frame:Number(a.reaper.frame.name),key:a.reaper.texture.key,y:a.reaper.y,mesh:a.merchantMesh.visible,dip:a.merchantMesh.cutscenePose.dip};},t);
      used.add(info.frame);assert.equal(info.key,'cutscene-vendor');assert(info.mesh);assert.equal(info.y,height*.84);
      if([20,55,100,160,195].includes(i))await page.screenshot({path:path.join(dir,`cutscene-${kind}-${width}-${i}.png`)});
      await page.waitForTimeout(20);
     }
     assert(used.size>85,'Dense walking/settle/idle frames are actually drawn');
     const after=await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];return {x:s.player.x,hp:s.player.hp,coins:s.coinCount,elapsed:s.elapsed,rng:s.rng.state,offers:JSON.stringify(s.pendingOffers)};});
     assert.deepEqual(after,initial,'Cinema freezes gameplay and selected offers');
     await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.vendorIntroMs=1;s.update(0,1);if(s.state!=='upgrade')throw Error('Vendor failed to complete');s.leaveVendor();});
    }
    await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.hasTeleported=false;s.shrineClaimed=false;s.gunUnlocked=false;s.state='playing';s.startChest();window.grimRun.loop.sleep();});
    const poses=new Set();
    for(let i=0;i<800;i++){
     const info=await page.evaluate(t=>{const s=window.grimRun.scene.scenes[0];s.chestMs=4000-t*1000;s.drawScene();window.grimRun.step(performance.now(),0);
      const a=s.powerArt,m=window.GRIM_CUTSCENES.relicMotionAt(t),b=a.cinemaBow,grips=window.GRIM_CUTSCENE_DATA.bow.hands[m.frame],scale=s.height/370;
      const stock=window.GRIM_VENDOR_DATA.bowStockGrip,forward=window.GRIM_VENDOR_DATA.bowForwardGrip;
      const dx=(forward[0]-stock[0])*b.displayWidth,dy=(forward[1]-stock[1])*b.displayHeight,c=Math.cos(b.rotation),sn=Math.sin(b.rotation);
      const expected=grips.map(p=>[a.cinemaReaper.x+(p[0]-136)*scale,a.cinemaReaper.y+(p[1]-214)*scale]);
      return {frame:Number(a.cinemaReaper.frame.name),bow:b.visible,glow:m.glow,key:a.cinemaReaper.texture.key,
       rearError:Math.hypot(b.x-expected[0][0],b.y-expected[0][1]),frontError:Math.hypot(b.x+c*dx-sn*dy-expected[1][0],b.y+sn*dx+c*dy-expected[1][1])};},i/200);
     poses.add(info.frame);assert.equal(info.key,'cutscene-bow');assert.equal(info.bow,i>=330);if(i<600)assert.equal(info.glow,0);
     if(info.bow)assert(info.rearError<.001&&info.frontError<.001,'Both physical crossbow grip points remain in the corresponding palms throughout the lift');
     if([0,80,160,220,300,330,360,420,450,480,520,550,580,600,700,799].includes(i))await page.screenshot({path:path.join(dir,`cutscene-bow-${width}-${i}.png`)});
     await page.waitForTimeout(6);
    }
    assert.equal(poses.size,169);
    const holds=[];
    for(const t of [3,3.25,3.5,3.999])holds.push(await page.evaluate(t=>{const s=window.grimRun.scene.scenes[0];s.chestMs=4000-t*1000;s.drawScene();const a=s.powerArt;
     return {frame:a.cinemaReaper.frame.name,x:a.cinemaBow.x,y:a.cinemaBow.y,angle:a.cinemaBow.rotation,scale:a.cinemaReaper.scaleX};},t));
    assert(holds.every(h=>JSON.stringify(h)===JSON.stringify(holds[0])),'The raised pose is still throughout its one-second glow');
    await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.chestMs=1000;for(let i=0;i<4;i++)s.update(0,249);
     if(s.state!=='chest'||s.chestMs!==4)throw Error('Hold ended early');s.update(0,4);
     if(s.state!=='playing'||!s.gunUnlocked||!s.shrineClaimed)throw Error('Hold did not end with exactly one reward');
     s.finishChest();s.drawScene();if(s.powerArt.cinemaReaper.visible||s.powerArt.cinemaHands.visible||s.powerArt.cinemaChestFront.visible)throw Error('Cinematic sprites leaked');});
    if(width===950){
     // Real engine clock: review complete normal-speed playback, rather than
     // inferring timing from manually sampled stills alone.
     const marks=[];
     for(const k of [1,8]){
      await page.evaluate(k=>{const s=window.grimRun.scene.scenes[0];s.sys.sceneUpdate=s._cutsceneRealUpdate;s.startRun();s.state='playing';s.triggerVendor(k);},k);
      const start=Date.now();await page.waitForFunction(()=>window.grimRun.scene.scenes[0].state==='upgrade',null,{timeout:16000});
      marks.push({scene:k===1?'angel':'devil',ms:Date.now()-start});
      assert(marks.at(-1).ms>=9800&&marks.at(-1).ms<14000);
      await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.leaveVendor();s.state='paused';});
     }
     await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.hasTeleported=false;s.shrineClaimed=false;s.state='playing';s.startChest();});
     const start=Date.now();await page.waitForFunction(()=>window.grimRun.scene.scenes[0].gunUnlocked&&window.grimRun.scene.scenes[0].state!=='chest',null,{timeout:10000});
     marks.push({scene:'bow',ms:Date.now()-start});assert(marks.at(-1).ms>=3900&&marks.at(-1).ms<6500);
     await page.evaluate(()=>{window.grimRun.scene.scenes[0].state='paused';});
     fs.writeFileSync(path.join(dir,'cutscene-realtime.json'),JSON.stringify(marks,null,2));
    }
    assert.deepEqual(errors,[]);
   }finally{
    const video=page.video();await context.close();if(video)fs.renameSync(await video.path(),path.join(dir,`cutscene-motion-${width}.webm`));
   }
  }
  console.log('PASS actual Chromium: both articulated vendor cinemas, dense planted Reaper/scythe motion, reach/grip/lift and exact one-second glowing hold at two phone sizes; frozen gameplay, automatic reward and cleanup.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
