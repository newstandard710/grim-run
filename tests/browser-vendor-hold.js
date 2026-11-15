'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png',
  '.webp':'image/webp','.ttf':'font/ttf','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  const target=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html');
  if(!target.startsWith(root+path.sep))return res.writeHead(403).end();
  try{res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream'}).end(fs.readFileSync(target));}
  catch{res.writeHead(404).end();}
});
const vendorState=page=>page.evaluate(()=>{
  const s=window.grimRun.scene.scenes[0];
  return {state:s.state,ms:s.vendorIntroMs,type:s.vendorType,x:s.player.x,y:s.player.y,
    elapsed:s.elapsed,hp:s.player.hp,gold:s.coinCount,rng:s.rng.state,offers:JSON.stringify(s.pendingOffers),
    rerolls:s.rerollsRemaining,purchased:s.vendorPurchased,focus:document.activeElement.id};
});
const begin=(page,k)=>page.evaluate(k=>{
  const g=window.grimRun,s=g.scene.scenes[0];
  s.startRun();g.loop.sleep();s.practiceTimeMode=3;s.coinCount=25;s.player.hp=2;
  s.triggerVendor(k);
  s.drawScene();g.step(performance.now(),0);
},k);
const time=(page,t)=>page.evaluate(t=>{
  const g=window.grimRun,s=g.scene.scenes[0],a=s.vendorArt;
  s.vendorIntroMs=8000-t;s.drawScene();g.step(performance.now(),0);
  return {held:a.holdingFrame(),reaper:Number(a.reaper.frame.name),mesh:a.merchantMesh?.visible||false,
    canvas:a.canvasMerchant?.visible?Number(a.canvasMerchant.frame.name):null,dip:a.merchantMesh?.cutscenePose?.dip??null,
    aura:a.back.commandBuffer.length};
},t);
const pixels=page=>page.locator('#game canvas').screenshot({animations:'disabled'});
function comparable(snapshot){
  const {state,ms,focus,...game}=snapshot;
  return game;
}

async function inspect(browser,url,canvas,failed=false){
  const page=await browser.newPage({viewport:{width:740,height:360},hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    if(failed)await page.route(/reaper-vendor\.png|vendor-canvas\.webp/,route=>route.abort());
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.grimRun?.scene.scenes[0]?.visuals?.reaperReady);
    await page.touchscreen.tap(23,43);
    await page.locator('#start-btn').tap();
    await page.evaluate(()=>{
      const g=window.grimRun,s=g.scene.scenes[0];
      s.sys.sceneUpdate=()=>{};clearInterval(s.loopWatchdogId);g.loop.sleep();
    });
    assert.equal(await page.evaluate(()=>window.grimRun.renderer.type),canvas?1:2);
    for(const k of [1,8]){
      await begin(page,k);
      const first=await vendorState(page);
      assert.equal(first.focus,'vendor-intro-skip');
      assert.equal(first.ms,8000);
      const travel=await time(page,900),late=await time(page,2999);
      assert.equal(travel.held,false); assert.equal(late.held,false);
      assert(travel.reaper<late.reaper);
      const almost=await pixels(page),held=await time(page,3000),final=await pixels(page);
      assert(held.held);
      assert.equal(held.reaper,failed?11:192);
      if(canvas)assert.equal(held.canvas,failed?null:(k===1?23:47));
      else assert.equal(held.dip,1);
      if(!failed)assert(!almost.equals(final),'The final composition starts at exactly three seconds');
      for(const t of [3001,5060,7999]){
        assert.deepEqual(await time(page,t),held);
        assert((await pixels(page)).equals(final),'The entire rendered composition holds');
      }
      assert.deepEqual(comparable(await vendorState(page)),comparable(first));
      await page.evaluate(()=>window.grimRun.scene.scenes[0].update(0,1));
      const open=await vendorState(page);
      assert.equal(open.state,'upgrade');assert.equal(open.focus,'reward-title');
      assert.deepEqual(comparable(open),comparable(first));

      if(failed)continue;
      const continueButton=page.getByRole('button',{name:/continue run/i});
      const position=await continueButton.boundingBox();
      const x=position.x+position.width/2,y=position.y+position.height/2;
      await begin(page,k);
      const waiting=await vendorState(page);
      await time(page,7999);
      await page.mouse.move(x,y);await page.mouse.down();
      await page.evaluate(()=>window.grimRun.scene.scenes[0].update(0,1));
      await page.mouse.up();
      assert.equal((await vendorState(page)).state,'upgrade','A press across auto-open cannot continue');
      assert.deepEqual(comparable(await vendorState(page)),comparable(waiting));
      await page.mouse.click(x,y);
      assert.notEqual((await vendorState(page)).state,'upgrade','A fresh gesture works immediately');

      for(const [phase,key] of [[800,'Space'],[5000,'Enter']]){
        await begin(page,k);await time(page,phase);
        const before=await vendorState(page);
        await page.keyboard.down(key);
        await page.keyboard.down(key);
        await page.keyboard.up(key);
        const after=await vendorState(page);
        assert.equal(after.state,'upgrade');assert.equal(after.focus,'reward-title');
        assert.deepEqual(comparable(after),comparable(before));
      }
      for(const phase of [90,7200]){
        await begin(page,k);await time(page,phase);
        const before=await vendorState(page);
        await page.touchscreen.tap(350,225);
        const after=await vendorState(page);
        assert.equal(after.state,'upgrade');
        assert.deepEqual(comparable(after),comparable(before));
      }
    }
    if(!failed){
      await begin(page,1);
      await time(page,3400);
      await page.setViewportSize({width:393,height:740});
      await page.waitForFunction(()=>window.grimRun.scene.scenes[0].width===393);
      const rotated=await time(page,4000),rotatedFrame=await pixels(page);
      assert(rotated.held);assert.equal(rotated.reaper,192);
      assert.deepEqual(await time(page,7340),rotated);
      assert((await pixels(page)).equals(rotatedFrame));
      await page.emulateMedia({reducedMotion:'reduce'});
      await begin(page,8);
      assert.deepEqual(await time(page,0),await time(page,7999));
      assert.equal((await vendorState(page)).state,'vendorIntro');
      await page.touchscreen.tap(110,260);
      assert.equal((await vendorState(page)).state,'upgrade');
    }
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
}

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port+'/?seed=33';
  for(const canvas of [false,true]){
    const browser=await chromium.launch({headless:true,args:['--no-sandbox',canvas?'--disable-webgl':'--use-angle=swiftshader']});
    try{await inspect(browser,url,canvas);if(canvas)await inspect(browser,url,canvas,true);}
    finally{await browser.close();}
  }
  console.log('PASS vendor hold: WebGL and Canvas, both merchants, full-frame freeze, exact boundaries, both skip phases, held touch/mouse/key handoff, rotation, reduced motion and missing art.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
