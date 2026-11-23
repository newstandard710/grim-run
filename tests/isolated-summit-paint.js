'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{PNG}=require('pngjs');
const mode=process.argv[2],out='test-results/paint-'+mode;
fs.mkdirSync(out,{recursive:true});
const known=new Map(),metadata=[];
function collect(tag,sample) {
  const img=PNG.sync.read(Buffer.from(sample,'base64'));
  const hash=crypto.createHash('sha256').update(img.data).digest('hex');
  if(!known.has(hash)){
    fs.writeFileSync(out+'/'+hash+'.png',Buffer.from(sample,'base64'));
    known.set(hash,{kind:tag,img});
    for(const [other,k] of known){
      if(hash===other||k.kind!==tag||img.width!==k.img.width||img.height!==k.img.height)continue;
      let changed=0,max=0,sum=0,alpha=0;
      for(let i=0;i<img.data.length;i+=4){
        let delta=0;
        for(let c=0;c<4;c++){const d=Math.abs(img.data[i+c]-k.img.data[i+c]);delta=Math.max(delta,d);max=Math.max(max,d);sum+=d;if(c===3&&d)alpha++;}
        if(delta)changed++;
      }
      console.log('DIFF',tag,other,hash,{changed,max,alpha,mean:sum/img.data.length});
    }
  }
  return hash;
}
(async()=>{
 const flags=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
 if(mode==='cpu2d')flags.push('--disable-accelerated-2d-canvas');
 const browser=await chromium.launch({args:flags});
 try {
  for(const revision of ['before','after','after','before']){
   const page=await browser.newPage({viewport:{width:740,height:360},hasTouch:true});
   try{
    await page.goto('http://127.0.0.1:'+(revision==='before'?'8764':'8765')+'/?seed=33');
    await page.waitForFunction(()=>GRIM_FRONTEND?.ready&&grimRun.scene.scenes[0]?.visuals?.reaperReady,null,{timeout:90000});
    await page.evaluate(()=>{const s=grimRun.scene.scenes[0];grimRun.loop.sleep();clearInterval(s.loopWatchdogId);s.sys.sceneUpdate=()=>{};});
    for(let visit=0;visit<4;visit++){
     await page.evaluate(async()=>{
       const g=grimRun,s=g.scene.scenes[0];s.goToMenu();s.startRun();g.loop.sleep();
       const m=4830,x=s.startX+m*GRIM_CONFIG.pxPerMeter,y=s.terrain.groundAt(x);
       Object.assign(s.player,{x,y,grounded:true,onSoulPlatform:false,velocityY:0,visualLandingMs:0});
       Object.assign(s,{distance:m,shrineClaimed:true,lastVendorNumber:14,nextVendorNumber:15,
         speed:GRIM_CORE.runSpeed(m),cameraX:x-s.width*GRIM_CONFIG.reaperXRatio,cameraY:y-s.groundY});
       s.nextEncounterX=s.nextEnemySpawnX=s.nextGroundSpawnX=s.nextSnapSpawnX=x+4000;
       s.syncWorldScroll();s.drawScene();
       for(let i=0;i<100;i++){
         if(i%6===0)await new Promise(requestAnimationFrame);
         s.update(0,1000/60);g.step(performance.now(),0);
       }
     });
     await page.waitForFunction(()=>{const s=grimRun.scene.scenes[0],z=s.terrain.sectionAt(s.player.x);
       return s.terrainTextureViews.get([z.kind,z.start,z.end,'tundra'].join(':'))?.compositeTextureKey;},null,{timeout:20000});
     const res=await page.evaluate(async()=>{
       const s=grimRun.scene.scenes[0],z=s.terrain.sectionAt(s.player.x),key=[z.kind,z.start,z.end,'tundra'].join(':');
       const snap=async(tex,top)=>{
         const ctx=tex.getContext(),w=tex.width,h=Math.min(top,tex.height),bytes=ctx.getImageData(0,0,w,h);
         const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.data)),b=>b.toString(16).padStart(2,'0')).join('');
         const cp=document.createElement('canvas');cp.width=w;cp.height=h;cp.getContext('2d').putImageData(bytes,0,0);
         return {digest,png:cp.toDataURL().split(',')[1]};
       };
       const view=s.terrainTextureViews.get(key),t=s.textures.get(view.compositeTextureKey);
       const original=await snap(t,360),material=await snap(s.textures.get('terrain-material-tundra'),768);
       s.removeTerrainTextureView(key,view);s.drawScene();
       const replacement=await snap(s.textures.get(s.terrainTextureViews.get(key).compositeTextureKey),360);
       return {original,material,replacement};
     });
     const row={revision,visit};
     for(const [label,obj] of Object.entries(res)){
       row[label]=obj.digest;
       const pngDigest=collect(label==='material'?'tile':'composite',obj.png);
       row[label+'Decoded']=pngDigest;
     }
     console.log('PAINT',JSON.stringify(row));metadata.push(row);
    }
   }finally{await page.close();}
  }
 }finally{fs.writeFileSync(out+'/samples.json',JSON.stringify(metadata));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
