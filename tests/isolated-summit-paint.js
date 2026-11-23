'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{PNG}=require('pngjs');
const mode=process.argv[2];
(async()=>{
 const flags=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
 if(mode==='cpu2d')flags.push('--disable-accelerated-2d-canvas');
 const browser=await chromium.launch({args:flags});
 try{
  const dir='sample-tiles/paint-default';
  const inputs=fs.readdirSync(dir).filter(f=>f.endsWith('.png')).map(f=>[f,PNG.sync.read(fs.readFileSync(path.join(dir,f)))]).filter(([,p])=>p.width===768&&p.height===768);
  assert.equal(inputs.length,2);
  for(const rev of ['before','after']){
   const page=await browser.newPage({viewport:{width:740,height:360},hasTouch:true});
   try{
    await page.goto('http://127.0.0.1:'+(rev==='before'?'8764':'8765')+'/?seed=33');
    await page.waitForFunction(()=>GRIM_FRONTEND?.ready&&grimRun.scene.scenes[0]?.visuals?.reaperReady,null,{timeout:90000});
    await page.evaluate(()=>{
     const g=grimRun,s=g.scene.scenes[0];clearInterval(s.loopWatchdogId);s.sys.sceneUpdate=()=>{};s.goToMenu();s.startRun();g.loop.sleep();
     const m=4888,x=s.startX+m*GRIM_CONFIG.pxPerMeter,y=s.terrain.groundAt(x);
     Object.assign(s.player,{x,y,grounded:true,onSoulPlatform:false,velocityY:0});
     Object.assign(s,{distance:m,shrineClaimed:true,cameraX:x-s.width*GRIM_CONFIG.reaperXRatio,cameraY:y-s.groundY});
     s.syncWorldScroll();s.drawScene();
    });
    await page.waitForFunction(()=>{const s=grimRun.scene.scenes[0],z=s.terrain.sectionAt(s.player.x);return s.terrainTextureViews.get([z.kind,z.start,z.end,'tundra'].join(':'))?.compositeTextureKey;},null,{timeout:20000});
    for(const [file,png] of inputs){
     const digests=await page.evaluate(async b64=>{
      const s=grimRun.scene.scenes[0],z=s.terrain.sectionAt(s.player.x),key=[z.kind,z.start,z.end,'tundra'].join(':');
      const material=s.textures.get('terrain-material-tundra'),bytes=Uint8ClampedArray.from(atob(b64),c=>c.charCodeAt(0));
      material.getContext().putImageData(new ImageData(bytes,768,768),0,0);
      const values=[];
      for(let i=0;i<3;i++){
       s.removeTerrainTextureView(key,s.terrainTextureViews.get(key));s.drawScene();
       const t=s.textures.get(s.terrainTextureViews.get(key).compositeTextureKey);
       const raw=t.getContext().getImageData(0,0,t.width,360).data;
       values.push(Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join(''));
      }
      return values;
     },png.data.toString('base64'));
     console.log('REPLAY',mode,rev,file.slice(0,16),JSON.stringify(digests));
    }
   }finally{await page.close();}
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
