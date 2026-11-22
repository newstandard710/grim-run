'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium,server}=require('./browser-landing');
function holdBitmap(){
  const rawFetch=window.fetch,decode=window.createImageBitmap,blobs=new WeakSet();
  const gate=new Promise(resolve=>{window.resumeBitmap=resolve;});
  window.fetch=async function(...args){
    const res=await rawFetch.apply(this,args);
    if(String(args[0]).includes('/reaper-landing.webp')){
      const rawBlob=res.blob.bind(res);
      res.blob=async()=>{const b=await rawBlob();blobs.add(b);return b;};
    }
    return res;
  };
  window.createImageBitmap=async function(blob,...args){
    const bitmap=await decode.call(this,blob,...args);
    if(blobs.has(blob)){window.auditSource=bitmap;await gate;}
    return bitmap;
  };
}
function firstJump(){
  const g=grimRun,s=g.scene.scenes[0];
  window.firstContact=new Promise(resolve=>{
    let jumped=false,air=false,used=false,t=0;
    function step(){
      if(s.state!=='playing')return;
      if(!jumped&&s.distance>=1){s.jump();jumped=true;}
      if(jumped&&++t===7)s.jumpEnd();
      air ||= !s.player.grounded;
      used ||= s.motionArt?.body?.some(v=>v.visible&&v.texture.key==='reaper-landing');
      if(air&&s.player.grounded){
        g.events.off('prestep',step);
        resolve({meters:s.distance,ready:s.landingArt.ready,used,hp:s.player.hp});
      }
    }
    g.events.on('prestep',step);
  });
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({args:['--disable-webgl']});
  const report=[];
  try{
    for(const mode of ['first playable jump','pending shutdown','pending destruction','registered removal','registered destruction']){
      const page=await browser.newPage({viewport:{width:740,height:360},deviceScaleFactor:1,hasTouch:true});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      try{
        await page.addInitScript(holdBitmap);
        await page.goto('http://127.0.0.1:'+server.address().port+'/after/?seed=33',{waitUntil:'domcontentloaded'});
        await page.locator('#home-enter-btn').click();
        await page.waitForFunction(()=>window.grimRun?.scene.scenes[0]?.ui);
        await page.evaluate(firstJump);
        await page.locator('#start-btn').click();
        await page.waitForFunction(()=>window.auditSource?.width===1812);
        let first,second;
        if(mode==='first playable jump'){
          first=await page.evaluate(()=>firstContact);
          assert.equal(first.ready,false);assert.equal(first.used,false);assert.equal(first.hp,3);
          await page.evaluate(()=>resumeBitmap());await page.waitForFunction(()=>grimRun.scene.scenes[0].landingArt.ready);
          await page.evaluate(()=>grimRun.scene.scenes[0].goToMenu());
          await page.evaluate(firstJump);await page.locator('#start-btn').click();
          second=await page.evaluate(()=>firstContact);
          assert(second.ready&&second.hp===first.hp);
          await page.waitForFunction(()=>grimRun.scene.scenes[0].motionArt.body.some(v=>v.visible&&v.texture.key==='reaper-landing'));
        }else{
          if(mode.startsWith('registered')){
            await page.evaluate(()=>resumeBitmap());
            await page.waitForFunction(()=>grimRun.scene.scenes[0].landingArt.ready);
          }
          if(mode.endsWith('shutdown')){
            await page.evaluate(()=>{const s=grimRun.scene.scenes[0];s.events.once('shutdown',()=>window.didStop=true);s.scene.stop();});
          }else if(mode.endsWith('destruction')){
            await page.evaluate(()=>{grimRun.events.once('destroy',()=>window.didStop=true);grimRun.destroy(true);});
          }else{
            await page.evaluate(()=>{grimRun.textures.remove('reaper-landing');window.didStop=true;});
          }
          await page.waitForFunction(()=>window.didStop);
          await page.evaluate(()=>resumeBitmap());
          await page.waitForFunction(()=>window.auditSource.width===0);
        }
        const result={mode,first,second,width:await page.evaluate(()=>auditSource.width),errors};
        console.log(JSON.stringify(result));report.push(result);assert.deepEqual(errors,[]);
      }finally{await page.close();}
    }
  }finally{fs.mkdirSync('test-results/lifecycle',{recursive:true});fs.writeFileSync('test-results/lifecycle/results.json',JSON.stringify(report,null,2));await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
