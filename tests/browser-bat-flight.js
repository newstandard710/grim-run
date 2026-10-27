'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'test-results');fs.mkdirSync(dir,{recursive:true});
const server=http.createServer((req,res)=>{try{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1))||'index.html');if(!file.startsWith(root+path.sep))return res.writeHead(403).end();res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));}catch(e){res.writeHead(404).end();}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader']});
 const page=await browser.newPage({viewport:{width:950,height:430}}),errors=[],failures=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)failures.push(r.url());});
 const present=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 try{
  await page.goto(origin+'/?seed=33',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.GRIM_FRONTEND?.ready&&window.grimRun?.scene?.scenes[0]?.combatArt?.ready['bat-flight'],null,{timeout:60000});
  const stats=await page.evaluate(async()=>{
   const A=window.GRIM_BAT_FLIGHT,im=new Image();im.src=A.FILE;await im.decode();
   const c=document.createElement('canvas');c.width=c.height=A.CELL;const g=c.getContext('2d',{willReadFrequently:true});
   const alpha=[],heads=[],eyes=[],counts=[];
   for(let i=0;i<A.FRAMES;i++){
    g.clearRect(0,0,A.CELL,A.CELL);g.drawImage(im,i%8*A.CELL,Math.floor(i/8)*A.CELL,A.CELL,A.CELL,0,0,A.CELL,A.CELL);
    const d=g.getImageData(0,0,A.CELL,A.CELL).data,a=[];let h=0,n=0,ex=0,ey=0,en=0;
    for(let y=0;y<A.CELL;y++)for(let x=0;x<A.CELL;x++){
     const p=(y*A.CELL+x)*4;a.push(d[p+3]);if(d[p+3]>32)n++;
     if(x>=172&&x<=182&&y>=124&&y<=133)h+=d[p+3];
     if(x>=168&&x<=188&&y>=120&&y<=141&&d[p]>180&&d[p+2]>120&&d[p]>d[p+1]*1.35&&d[p+3]>160){ex+=x;ey+=y;en++;}
    }
    if(!en)throw Error('No painted eye in pose '+i);alpha.push(a);heads.push(h);eyes.push([ex/en,ey/en]);counts.push(n);
   }
   const differences=alpha.map((a,i)=>a.reduce((sum,n,p)=>sum+Math.abs(n-alpha[(i+1)%A.FRAMES][p]),0)/a.length);
   return {counts,heads,eyes,differences,width:im.width,height:im.height};
  });
  assert.equal(stats.width,2048);assert.equal(stats.height,3072);assert(stats.counts.every(n=>n>3000));
  const headVariation=(Math.max(...stats.heads)-Math.min(...stats.heads))/Math.max(...stats.heads);
  assert(headVariation<.01,'Solid face coverage stays stable rather than pulsing at every blend');
  for(const axis of [0,1])assert(Math.max(...stats.eyes.map(v=>v[axis]))-Math.min(...stats.eyes.map(v=>v[axis]))<2,'Eye remains registered');
  assert(stats.differences.at(-1)<Math.max(...stats.differences.slice(0,-1))*1.05,'Loop seam has no larger jump than ordinary neighbors');
  // Instrument the real title renderer, keeping its layout and canvas path intact.
  await page.evaluate(()=>{const A=window.GRIM_BAT_FLIGHT,draw=A.drawFrame;A.drawFrame=function(g,im,seconds,...args){window._homeBatFrames=(window._homeBatFrames||0)+1;window._homeBatClock=seconds;return draw(g,im,window._batClock??seconds,...args);};});
  await page.waitForFunction(()=>window._homeBatFrames>=4&&window._homeBatClock>0,null,{timeout:15000});
  for(const [width,height]of [[950,430],[1440,900],[430,932]]){
   await page.setViewportSize({width,height});
   for(const i of [0,24,48,72]){await page.evaluate(i=>{window._batClock=(i+.1)/96*1.6;},i);await present();await page.screenshot({path:path.join(dir,`bat-home-${width}-${i}.png`)});}
  }
  await page.setViewportSize({width:950,height:430});await page.locator('#home-enter-btn').click();await page.locator('#start-btn').click();
  await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.sys.sceneUpdate=()=>{};s.state='paused';s.ui.setMode('playing');s.obstacles=[];s.enemies=[{kind:'bat',x:s.player.x+260,y:s.player.y-130,mode:'glide',phase:0,hp:4,dead:false}];});
  for(let i=0;i<96;i++){
   const v=await page.evaluate(i=>{const s=window.grimRun.scene.scenes[0];s.elapsed=(i+.1)/96*1.6;s.drawScene();return s.combatArt.bats.flat().filter(v=>v.visible).map(v=>({alpha:v.alpha,frame:Number(v.frame.name),key:v.texture.key,origin:[v.originX,v.originY]}));},i);
   assert.equal(v.length,1,'Exactly one solid flight sprite, with no leftover blend view');assert.equal(v[0].alpha,1);assert.equal(v[0].frame,i);assert.equal(v[0].key,'combat-bat-flight');assert.deepEqual(v[0].origin,[178/256,128/256]);
   if([0,24,48,72,95].includes(i)){await present();await page.screenshot({path:path.join(dir,`bat-game-${i}.png`)});}
  }
  await page.goto(origin+'/assets/bat/v0192/review.html');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('/ 96'));
  await page.locator('#pose').fill('48');await page.screenshot({path:path.join(dir,'bat-pose-review.png')});
  fs.writeFileSync(path.join(dir,'bat-flight-quality.json'),JSON.stringify({headVariation,eyeRange:[0,1].map(axis=>Math.max(...stats.eyes.map(v=>v[axis]))-Math.min(...stats.eyes.map(v=>v[axis]))),maxAdjacentAlphaDifference:Math.max(...stats.differences),seamAlphaDifference:stats.differences.at(-1)},null,2));
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);console.log('PASS Chromium fluid bat: 96 decoded poses, stable opaque head/eye, continuous seam, real home at three sizes, one solid gameplay view per pose and shared review.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
