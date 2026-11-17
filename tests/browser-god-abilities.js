'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require('playwright');

const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.GRIM_ABILITY_OUTPUT || path.join(root, 'test-results', 'god-abilities'));
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript',
  '.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf','.json':'application/json'};
fs.mkdirSync(output, {recursive:true});
const server = http.createServer((request,response) => {
  try {
    const address = new URL(request.url, 'http://localhost');
    const file = path.resolve(root, decodeURIComponent(address.pathname.slice(1)) || 'index.html');
    if (!file.startsWith(root + path.sep)) return response.writeHead(403).end();
    const bytes = fs.readFileSync(file);
    response.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream'});
    response.end(bytes);
  } catch {
    response.writeHead(404).end();
  }
});

async function inspect(browser, renderer, width, height, motion) {
  const viewport = {width, height};
  const title = renderer + '-' + width + 'x' + height;
  const page = await browser.newPage({viewport,hasTouch:true,isMobile:true,reducedMotion:motion});
  const errors = [];
  const assetFailures = [];
  page.on('pageerror',error => errors.push(error.message));
  page.on('response',response => {
    if (response.status() >= 400) assetFailures.push(response.url());
  });
  const dialog = page.locator('#god-abilities-dialog');
  const halo = page.locator('#critical-health-halo');
  const pause = page.locator('#pause-btn');
  const toggle = page.locator('#god-mode-checkbox');
  const launch = page.locator('#god-abilities-btn');
  const vendorLaunch = page.locator('#vendor-abilities-btn');

  const shot = async name => {
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    await page.screenshot({path:path.join(output,title+'-'+name+'.png')});
  };
  async function hurt(clearFlash) {
    return page.evaluate(clear => {
      const s = window.grimRun.scene.scenes[0];
      s.takeDamage(1,'rock');
      if (clear) {
        s.damageFlashMs=0;
        s.player.visualHurtMs=0;
        s.particles.length=0;
      }
      s.refreshHud();
      s.drawScene();
      return [s.player.hp,s.damageFlashMs];
    },clearFlash);
  }

  try {
    await page.goto('http://127.0.0.1:'+server.address().port+'/?seed=33',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => window.GRIM_FRONTEND?.ready &&
      window.grimRun?.scene?.scenes?.[0]?.visuals?.reaperReady,null,{timeout:60000});
    const mode = await page.evaluate(() => window.grimRun.renderer.type);
    assert.equal(mode,renderer==='canvas'?1:2);
    await page.locator('#home-enter-btn').tap();
    // Let the Home gesture guard expire before the separate Start tap.
    await page.waitForTimeout(380);
    await page.locator('#start-btn').tap();
    const saveBefore = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));
    await page.evaluate(() => {
      const s=window.grimRun.scene.scenes[0];
      s.sys.sceneUpdate=()=>{};
      s.drawScene();
    });
    assert(await halo.isHidden());
    await shot('01-3hp');
    assert.deepEqual(await hurt(true),[2,0]);
    assert(await halo.isHidden());
    await shot('02-2hp-legacy');
    assert.deepEqual(await hurt(false),[1,420]);
    assert(await halo.isVisible());
    await shot('03-1hp-impact');
    await page.evaluate(() => {
      const s=window.grimRun.scene.scenes[0];
      s.damageFlashMs=0;s.player.visualHurtMs=0;s.particles.length=0;
      s.visualFrameTestWrites=0;
      new MutationObserver(records=>s.visualFrameTestWrites+=records.length).observe(
        document.getElementById('critical-health-halo'),{attributes:true}
      );
      for(let i=0;i<28;i++)s.refreshHud();
      s.drawScene();
    });
    await shot('04-1hp-steady');
    const haloStyle=await halo.evaluate(node=>{
      const style=getComputedStyle(node),s=window.grimRun.scene.scenes[0];
      return [style.pointerEvents,style.animationName,style.backgroundImage, s.visualFrameTestWrites];
    });
    assert.equal(haloStyle[0],'none');
    assert.equal(haloStyle[1],'none');
    assert.equal((haloStyle[2].match(/linear-gradient/g)||[]).length,4);
    assert.equal(haloStyle[3],0);

    await pause.tap();
    assert(await halo.isHidden());
    assert(await launch.isHidden());
    await toggle.tap();
    assert(await toggle.isChecked());
    await shot('05-pause');
    await launch.tap();
    assert(await dialog.isVisible());
    assert.deepEqual(await dialog.locator('h3').allTextContents(),['Angel','Devil']);
    assert.equal(await dialog.locator('select').count(),10);
    assert.equal(await dialog.locator('#god-rank-ravenWings option').count(),6);
    assert.equal(await dialog.locator('#god-rank-rapidFire option').count(),5);
    assert.match(await dialog.locator('#god-rank-deathsReversal-details').textContent(),/Active Lv 4.*8s of history/);
    assert.match(await dialog.locator('#god-rank-rapidFire-details').textContent(),/Requires the Bone Crossbow/);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'god-abilities-title');
    await page.keyboard.press('Tab');
    assert(await page.evaluate(()=>document.activeElement.closest('#god-abilities-dialog')!==null));
    const layout=await dialog.evaluate(node=>{
      const b=node.getBoundingClientRect(),done=node.querySelector('button').getBoundingClientRect();
      const list=node.querySelector('#god-ability-pools');
      return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,doneTop:done.top,doneBottom:done.bottom,
        scrollHeight:list.scrollHeight,clientHeight:list.clientHeight,
        columns:getComputedStyle(list).gridTemplateColumns.split(' ').length,
        minControl:Math.min(...Array.from(node.querySelectorAll('select'),e=>e.getBoundingClientRect().height))};
    });
    assert(layout.x>=0 && layout.y>=0 && layout.right<=width && layout.bottom<=height,JSON.stringify(layout));
    assert(layout.doneTop>=0 && layout.doneBottom<=height);
    assert.equal(layout.columns,width>=640?2:1);
    assert(layout.minControl>=44);
    assert(layout.scrollHeight>layout.clientHeight);
    if(width<640){
      await page.setViewportSize({width:height,height:width});
      assert(await dialog.isVisible());
      const rotated=await dialog.boundingBox();
      assert(rotated.y>=0&&rotated.y+rotated.height<=width);
      await page.setViewportSize(viewport);
    }

    await dialog.locator('#god-rank-soulCleave').selectOption('4');
    await dialog.locator('#god-rank-deathsReversal').selectOption('0');
    assert.match(await dialog.locator('#god-rank-soulCleave-details').textContent(),/Active Lv 4.*Earned Off/);
    assert.match(await dialog.locator('#god-rank-deathsReversal-details').textContent(),/Active Off/);
    assert.equal(await page.evaluate(()=>window.grimRun.scene.scenes[0].powerManager.attackBonus()),.65);
    const wheelX=Math.floor(width/2),wheelY=Math.floor(height/2);
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:wheelX,y:wheelY+35}]});
    for (let step=1;step<=5;step++)await cdp.send('Input.dispatchTouchEvent',{
      type:'touchMove',touchPoints:[{x:wheelX,y:wheelY+35-step*20}]
    });
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForFunction(()=>document.getElementById('god-ability-pools').scrollTop>0);
    await cdp.detach();
    await shot('06-abilities-scrolled');
    await page.keyboard.press('Escape');
    assert(await dialog.isHidden());
    assert.equal(await page.evaluate(()=>document.activeElement.id),'god-abilities-btn');
    assert.equal(await page.evaluate(()=>window.grimRun.scene.scenes[0].state),'paused');

    await toggle.tap();
    assert(await launch.isHidden());
    assert.deepEqual(await page.evaluate(()=>{
      const s=window.grimRun.scene.scenes[0];
      return [s.powerManager.level('soulCleave'),s.rewindLevel()];
    }),[0,0]);
    await toggle.tap();
    assert.deepEqual(await page.evaluate(()=>{
      const s=window.grimRun.scene.scenes[0];
      return [s.powerManager.level('soulCleave'),s.rewindLevel()];
    }),[4,0]);
    await launch.tap();
    await shot('07-abilities');
    await dialog.locator('#god-abilities-done').tap();
    await page.locator('#resume-btn').tap();
    assert(await halo.isHidden());
    await page.evaluate(() => {
      const s=window.grimRun.scene.scenes[0];
      s.countdownMs=1;s.update(0,16);
      s.vendorIntroSeen.angel=true;s.coinCount=12;s.triggerVendor(1);s.drawScene();
    });
    const offersBefore=await page.evaluate(()=>{
      const s=window.grimRun.scene.scenes[0];
      return JSON.stringify([s.rng.state,s.pendingOffers,s.coinCount,s.player.hp,s.rerollsRemaining]);
    });
    assert(await halo.isHidden());
    await vendorLaunch.tap();
    assert(await dialog.isVisible());
    assert.equal(await dialog.locator('#god-rank-soulCleave').inputValue(),'4');
    await dialog.locator('#god-rank-soulCleave').selectOption('default');
    await dialog.locator('#god-abilities-done').tap();
    assert.equal(await page.evaluate(()=>document.activeElement.id),'vendor-abilities-btn');
    assert.equal(await page.evaluate(()=>{
      const s=window.grimRun.scene.scenes[0];
      return JSON.stringify([s.rng.state,s.pendingOffers,s.coinCount,s.player.hp,s.rerollsRemaining]);
    }),offersBefore);
    await shot('08-vendor-launch');
    await page.locator('#vendor-actions .primary').tap();
    await page.getByRole('button',{name:/CONTINUE RUN/}).tap();
    assert(await halo.isHidden());
    await shot('09-after-healing');
    assert.equal(await page.evaluate(()=>JSON.stringify(Object.entries(localStorage))),saveBefore);
    assert.deepEqual(errors,[]);
    assert.deepEqual(assetFailures,[]);
    console.log(title,JSON.stringify({renderer:mode,reducedMotion:motion,layout}));
  } finally {
    await page.close();
  }
}

(async()=>{
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  try {
    for (const [renderer,sizes] of [
      ['canvas',[[667,300,'no-preference'],[740,360,'no-preference'],[950,430,'no-preference'],[393,740,'reduce']]],
      ['webgl',[[740,360,'no-preference'],[950,430,'reduce']]]
    ]) {
      const args=renderer==='canvas'?['--disable-webgl']:['--use-angle=swiftshader','--enable-unsafe-swiftshader'];
      const browser=await chromium.launch({headless:true,executablePath:process.env.GRIM_CHROMIUM,args:['--no-sandbox',...args]});
      try {
        for (const size of sizes) await inspect(browser,renderer,...size);
      } finally {
        await browser.close();
      }
    }
  } finally {
    server.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
