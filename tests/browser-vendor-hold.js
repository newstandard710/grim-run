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
  s.startRun();g.loop.sleep();s.setGodMode(true);s.practiceTimeMode=3;s.coinCount=25;s.player.hp=2;
  s.triggerVendor(k);
  s.drawScene();g.step(performance.now(),0);
},k);
const time=(page,t,capture=false)=>page.evaluate(async ({t,capture})=>{
  const g=window.grimRun,s=g.scene.scenes[0],a=s.vendorArt;
  s.vendorIntroMs=4000-t;s.drawScene();g.step(performance.now(),0);
  const state={held:a.holdingFrame(),reaper:Number(a.reaper.frame.name),mesh:a.merchantMesh?.visible||false,
    canvas:a.canvasMerchant?.visible?Number(a.canvasMerchant.frame.name):null,dip:a.merchantMesh?.cutscenePose?.dip??null,
    aura:a.back.commandBuffer.length};
  if(!capture)return state;
  // Read the completed frame before Chromium can discard WebGL's default drawing buffer.
  const png=new TextEncoder().encode(g.canvas.toDataURL());
  const digest=await crypto.subtle.digest('SHA-256',png);
  return {...state,frame:Array.from(new Uint8Array(digest))};
},{t,capture});
function comparable(snapshot){
  const {state,ms,focus,...game}=snapshot;
  return game;
}

async function inspect(browser,url,canvas,failed=false){
  const page=await browser.newPage({viewport:{width:740,height:360},hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    if(failed)await page.route(/reaper-vendor\.webp|vendor-canvas\.webp/,route=>route.abort());
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.grimRun?.scene.scenes[0]?.visuals?.reaperReady,null,{timeout:90000});
    await page.evaluate(()=>window.grimRun.scene.scenes[0].enterHome());
    await page.locator('#start-btn').tap();
    await page.evaluate(()=>{
      const g=window.grimRun,s=g.scene.scenes[0];
      s.sys.sceneUpdate=()=>{};clearInterval(s.loopWatchdogId);g.loop.sleep();
    });
    assert.equal(await page.evaluate(()=>window.grimRun.renderer.type),canvas?1:2);
    if(!failed){
      const checked=await page.evaluate(()=>{
        const texture=window.grimRun.scene.scenes[0].textures.get('cutscene-vendor');
        const vendor=window.GRIM_CUTSCENE_DATA.vendor;
        const strip=document.createElement('canvas');strip.width=7;strip.height=7;
        const ctx=strip.getContext('2d',{willReadFrequently:true});
        return [vendor.angel,vendor.devil].map(track=>{
          let exposed=0;
          for(const pose of track){
            const f=texture.get(pose.frame);
            const [x,y]=pose.eye.map(Math.round);
            ctx.clearRect(0,0,7,7);
            ctx.drawImage(f.source.image,f.cutX+x-3,f.cutY+y-3,7,7,0,0,7,7);
            const rgba=ctx.getImageData(0,0,7,7).data;
            let cyan=false;
            for(let i=0;i<rgba.length;i+=4)if(rgba[i+1]>115&&rgba[i+1]-rgba[i]>35&&rgba[i+2]>80&&rgba[i+3]>200)cyan=true;
            if(!cyan)return -1;
            if(pose.crown){
              const [cx,cy]=pose.crown;
              ctx.clearRect(0,0,1,1);ctx.drawImage(f.source.image,f.cutX+cx,f.cutY+cy,1,1,0,0,1,1);
              const [r,g,b,alpha]=ctx.getImageData(0,0,1,1).data;
              if(alpha<245||r+g+b<32)return -2;
              exposed++;
            }
          }
          return exposed;
        });
      });
      assert(checked.every(n=>n>60),'Every eye is visible and exposed reconstructed cloth has color and coverage');
    }
    for(const k of [1,8]){
      await begin(page,k);
      const first=await vendorState(page);
      assert.equal(first.focus,'vendor-intro-skip');
      assert.equal(first.ms,4000);
      const travel=await time(page,900),late=await time(page,2999,true);
      assert.equal(travel.held,false); assert.equal(late.held,false);
      assert(travel.reaper<late.reaper);
      const {frame:final,...held}=await time(page,3000,true);
      assert(held.held);
      assert.equal(held.reaper,failed?11:await page.evaluate(k=>GRIM_CUTSCENE_DATA.vendor[k===1?'angel':'devil'].at(-1).frame,k));
      if(canvas)assert.equal(held.canvas,failed?null:(k===1?31:63));
      else assert.equal(held.dip,1);
      if(!failed)assert.notDeepEqual(late.frame,final,'The final composition starts at exactly three seconds');
      for(const t of [3001,3560,3999]){
        const {frame,...snapshot}=await time(page,t,true);
        assert.deepEqual(snapshot,held);
        assert.deepEqual(frame,final,'The entire rendered composition holds');
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
      await time(page,3999);
      await page.mouse.move(x,y);await page.mouse.down();
      await page.evaluate(()=>window.grimRun.scene.scenes[0].update(0,1));
      await page.mouse.up();
      assert.equal((await vendorState(page)).state,'upgrade','A press across auto-open cannot continue');
      assert.deepEqual(comparable(await vendorState(page)),comparable(waiting));
      await page.mouse.click(x,y);
      assert.notEqual((await vendorState(page)).state,'upgrade','A fresh gesture works immediately');

      const heal=page.getByRole('button',{name:/heal 1 hp/i});
      await begin(page,k);
      await time(page,3999);
      const clock=await page.evaluate(()=>{
        const s=window.grimRun.scene.scenes[0];
        let hidden=true,now=11000;
        Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});
        Object.defineProperty(performance,'now',{configurable:true,value:()=>now});
        try{
          s.cutsceneLastAt=1000;
          s.update(11000,10000);
          const suspended=s.vendorIntroMs;
          hidden=false;now=21000;
          s.update(21000,10000);
          const resumed=s.vendorIntroMs;
          now=21001;s.update(21001,1);
          return {suspended,resumed,state:s.state};
        }finally{delete document.hidden;delete performance.now;}
      });
      assert.deepEqual(clock,{suspended:1,resumed:1,state:'upgrade'},'Only visible, unscaled time opens the vendor');
      const bounds=await heal.boundingBox();
      const healX=bounds.x+bounds.width/2,healY=bounds.y+bounds.height/2;
      await begin(page,k);
      await time(page,3999);
      const beforeHeal=await vendorState(page);
      await page.mouse.move(healX,healY);await page.mouse.down();
      await page.evaluate(()=>window.grimRun.scene.scenes[0].update(0,1));
      await page.mouse.up();
      assert.deepEqual(comparable(await vendorState(page)),comparable(beforeHeal),'The held press cannot pay for healing');
      await page.mouse.click(healX,healY);
      const healed=await vendorState(page);
      assert.equal(healed.hp,beforeHeal.hp+1);
      assert.equal(healed.gold,beforeHeal.gold-await page.evaluate(()=>window.GRIM_CONFIG.devilHealPrice));

      if(k===1){
        await begin(page,k);await time(page,3999);
        const touch=await page.context().newCDPSession(page);
        const before=await vendorState(page);
        await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:0}]});
        await page.evaluate(()=>window.grimRun.scene.scenes[0].update(0,1));
        await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        assert.equal((await vendorState(page)).state,'upgrade','A held touch across auto-open cannot continue');
        assert.deepEqual(comparable(await vendorState(page)),comparable(before));
        await touch.detach();
      }

      for(const [phase,key] of [[800,'Space'],[3500,'Enter']]){
        await begin(page,k);await time(page,phase);
        const before=await vendorState(page);
        await page.keyboard.down(key);
        await page.keyboard.down(key);
        await page.keyboard.up(key);
        const after=await vendorState(page);
        assert.equal(after.state,'upgrade');assert.equal(after.focus,'reward-title');
        assert.deepEqual(comparable(after),comparable(before));
      }
      for(const phase of [90,3800]){
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
      await page.evaluate(()=>window.grimRun.loop.wake());
      await page.setViewportSize({width:393,height:740});
      await page.waitForFunction(()=>window.grimRun.scene.scenes[0].width===393);
      await page.evaluate(()=>window.grimRun.loop.sleep());
      const {frame:rotatedFrame,...rotated}=await time(page,3500,true);
      assert(rotated.held);assert.equal(rotated.reaper,await page.evaluate(()=>GRIM_CUTSCENE_DATA.vendor.angel.at(-1).frame));
      const {frame,...rotatedLater}=await time(page,3940,true);
      assert.deepEqual(rotatedLater,rotated);
      assert.deepEqual(frame,rotatedFrame);
      await page.emulateMedia({reducedMotion:'reduce'});
      await begin(page,8);
      assert.deepEqual(await time(page,0),await time(page,3999));
      assert.equal((await vendorState(page)).state,'vendorIntro');
      await page.touchscreen.tap(110,260);
      assert.equal((await vendorState(page)).state,'upgrade');
    }
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
}

async function inspectMerchantFallback(browser,url,canvas,missing){
  const page=await browser.newPage({viewport:{width:950,height:430},hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.route('**/vendor-canvas.webp*',route=>route.abort());
    await page.route('**/'+missing+'-vendor-v1.webp*',route=>route.fulfill({
      status:200,contentType:'image/webp',body:'invalid merchant painting'
    }));
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.grimRun?.scene.scenes[0]?.visuals?.reaperReady,null,{timeout:90000});
    await page.evaluate(()=>{
      const g=window.grimRun,s=g.scene.scenes[0];
      s.sys.sceneUpdate=()=>{};clearInterval(s.loopWatchdogId);g.loop.sleep();
    });
    const visible=()=>page.evaluate(()=>{
      const a=window.grimRun.scene.scenes[0].vendorArt;
      return [a.merchant,a.merchantMesh,a.canvasMerchant]
        .filter(v=>v?.visible).map(v=>v.texture.key);
    });
    const kind=missing==='angel'?1:8,ownKey=kind===1?'vendor-angel':'vendor-demon';
    const other=kind===1?8:1,otherKey=kind===1?'vendor-demon':'vendor-angel';
    await begin(page,other);
    await time(page,1500);
    assert.deepEqual(await visible(),[otherKey],'The surviving base merchant renders without the other vendor');
    const state=await time(page,3000);
    assert.equal(state.mesh,!canvas,'The surviving merchant retains the renderer-specific path');
    await begin(page,kind);
    await time(page,1200);
    assert.deepEqual(await visible(),[],'An unavailable merchant never shows the opposite vendor');
    await page.evaluate(key=>{
      const s=window.grimRun.scene.scenes[0];
      const c=document.createElement('canvas');c.width=16;c.height=16;
      c.getContext('2d').fillRect(0,0,16,16);
      s.textures.addCanvas(key,c);
    },ownKey);
    await time(page,3000);
    assert.deepEqual(await visible(),[],'Art arriving late cannot change a pinned intro');
    await page.touchscreen.tap(180,220);
    assert.equal((await vendorState(page)).type,kind===1?'angel':'devil');
    assert.equal((await vendorState(page)).state,'upgrade');
    await begin(page,kind);await time(page,3000);
    assert.deepEqual(await visible(),[ownKey],'The next intro may use newly ready art');
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
}

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port+'/?seed=33';
  for(const canvas of [false,true]){
    const browser=await chromium.launch({headless:true,args:['--no-sandbox',canvas?'--disable-webgl':'--use-angle=swiftshader']});
    try{
      await inspect(browser,url,canvas);
      if(canvas)await inspect(browser,url,canvas,true);
      for(const missing of ['angel','demon'])await inspectMerchantFallback(browser,url,canvas,missing);
    }
    finally{await browser.close();}
  }
  console.log('PASS vendor hold: WebGL and Canvas, both merchants, full-frame freeze, exact boundaries, both skip phases, held touch/mouse/key handoff, rotation, reduced motion, and isolated invalid or late merchant art.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
