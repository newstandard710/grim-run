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
  await page.goto(origin+'/?seed=33',{waitUntil:'domcontentloaded',timeout:45000});
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
  // Art off should still run using procedural art without false ready flags.
  await page.goto(origin+'/?art=off&seed=33',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.grimRun?.scene?.scenes?.[0]?.state==='menu',null,{timeout:30000});
  const fallback=await page.evaluate(()=>{
   const s=window.grimRun.scene.scenes[0];
   return {state:s.state,reaperReady:s.visuals?.reaperReady,batReady:s.visuals?.batReady};
  });
  assert.equal(fallback.reaperReady,false);
  assert.equal(fallback.batReady,false);
  console.log('PASS actual Chromium: illustrated sprites visible, pixel data nonblank, and art=off fallback preserved.');
 }finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
