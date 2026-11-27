'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.ttf':'font/ttf'};
const server = http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});

async function test(browser,url) {
  const page=await browser.newPage({viewport:{width:740,height:360},hasTouch:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  let blocked=0;
  await page.route('**/assets/vendor/phaser-3.90.0/phaser.min.js*', route=>{
    if(new URL(route.request().url()).search)return route.continue();
    blocked++;
    return route.abort();
  });
  await page.goto(url);
  await page.locator('#engine-retry-btn').waitFor();
  assert.equal(blocked,1,'One engine request before manual retry');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'engine-retry-btn');
  assert.equal(await page.evaluate(()=>Boolean(window.grimRun)),false);
  assert.match(await page.locator('#error-message').textContent(),/could not load/);
  await page.locator('#engine-retry-btn').click();
  await page.waitForFunction(()=>window.grimRun?.scene.scenes[0]?.state==='home'&&window.GRIM_FRONTEND?.ready);
  assert.equal(await page.evaluate(()=>window.Phaser.VERSION),'3.90.0');

  const layering=await page.evaluate(()=>{
    const stage=document.querySelector('#frontispiece'),canopy=document.querySelector('#canopy-art');
    const ctx=canopy.getContext('2d');
    return {shade:getComputedStyle(stage,'::after').zIndex, foliage:getComputedStyle(canopy).zIndex,
      actors:getComputedStyle(document.querySelector('#title-art')).zIndex,
      moonAlpha:ctx.getImageData(554,25,1,1).data[3],
      foliageAlpha:ctx.getImageData(281,5,1,1).data[3]};
  });
  assert.deepEqual(layering,{shade:'auto',foliage:'auto',actors:'1',moonAlpha:0,foliageAlpha:layering.foliageAlpha});
  assert(layering.foliageAlpha>0,'The accepted breeze still draws on the foliage');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>document.querySelector('#canopy-art').width===1);
  await page.emulateMedia({reducedMotion:'no-preference'});

  await page.keyboard.press('Enter');
  const current=()=>page.evaluate(()=>[window.grimRun.scene.scenes[0].state,document.activeElement.id]);
  assert.deepEqual(await current(),['menu','menu-title']);
  assert.equal(await page.locator('#menu-title').evaluate(e=>getComputedStyle(e).outlineStyle),'none');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('#campaign-btn').evaluate(e=>e.matches(':focus-visible')),true);
  await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'START FOREST'}).waitFor();
  assert.deepEqual(await current(),['campaignMenu','campaign-title']);
  await page.getByRole('button',{name:'BACK',exact:true}).press('Enter');
  assert.deepEqual(await current(),['menu','campaign-btn']);
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('#start-btn').evaluate(e=>e.matches(':focus-visible')) ,true);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  assert.deepEqual(await current(),['reliquary','reliquary-title']);
  await page.locator('#reliquary-back-btn').focus();
  await page.keyboard.press('Space');
  assert.deepEqual(await current(),['menu','reliquary-btn']);
  await page.keyboard.press('Enter');
  assert.deepEqual(await current(),['reliquary','reliquary-title']);
  await page.locator('#reliquary-back-btn').focus();
  await page.keyboard.press('Enter');
  assert.deepEqual(await current(),['menu','reliquary-btn']);

  await page.locator('#start-btn').click();
  await page.waitForFunction(()=>window.grimRun.scene.scenes[0].state==='playing');
  await page.evaluate(()=>{
    const scene=window.grimRun.scene.scenes[0];
    scene.sys.sceneUpdate=()=>{};
  });
  const cdp=await page.context().newCDPSession(page);
  const touch=async(id,active)=>{
    const b=await page.locator(id).boundingBox();
    await cdp.send('Input.dispatchTouchEvent',{type:active?'touchStart':'touchEnd',
      touchPoints:active?[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]:[]});
  };
  const holds=()=>page.evaluate(()=>{
    const p=window.grimRun.scene.scenes[0].player;
    return [p.jumpHeld,p.holdSlide,p.slideReleaseBufferMs];
  });
  await page.keyboard.down('Space');
  await touch('#jump-btn',true);
  await page.keyboard.up('Space');
  assert.equal((await holds())[0],true);
  await touch('#jump-btn',false);
  assert.equal((await holds())[0],false);

  await touch('#slide-btn',true);
  await page.keyboard.down('KeyS');
  await touch('#slide-btn',false);
  assert.deepEqual((await holds()).slice(1),[true,0]);
  await page.keyboard.up('KeyS');
  assert.deepEqual((await holds()).slice(1),[false,500]);
  await page.keyboard.down('ArrowDown');
  await page.keyboard.down('KeyS');
  await page.keyboard.up('ArrowDown');
  assert.equal((await holds())[1],true);
  await page.keyboard.up('KeyS');
  assert.equal((await holds())[1],false);
  await touch('#slide-btn',true);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  assert.equal((await holds())[1],false);
  assert.deepEqual(errors,[]);
  await page.close();
}

async function queuedTap(browser,url) {
  const page=await browser.newPage({viewport:{width:740,height:360},hasTouch:true});
  let unblock;
  const delay=new Promise(resolve=>{unblock=resolve;});
  await page.route('**/assets/vendor/phaser-3.90.0/phaser.min.js',async route=>{
    await delay;
    await route.continue();
  });
  await page.goto(url,{waitUntil:'domcontentloaded'});
  assert.equal(await page.evaluate(()=>Boolean(window.grimRun)),false);
  await page.touchscreen.tap(18,35);
  unblock();
  await page.waitForFunction(()=>window.grimRun?.scene.scenes[0]?.state==='menu');
  assert.equal(await page.evaluate(()=>window.grimRun.scene.scenes[0].distance),0);
  await page.close();
}

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,args:['--no-sandbox',
    process.env.GRIM_HOME_CANVAS==='1'?'--disable-webgl':'--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const url='http://127.0.0.1:'+server.address().port+'/';
  try{
    await test(browser,url);
    await queuedTap(browser,url);
    console.log('PASS Home shade and reduced motion, cold engine retry, queued tap, focused Reliquary keys, and mixed input release.');
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
