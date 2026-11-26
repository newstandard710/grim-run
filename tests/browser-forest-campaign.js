'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return res.writeHead(404).end();
  const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml'};
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});
const key='grim-run-forest-attempt-v1';
const renderer=process.env.GRIM_RENDERER||'canvas';
const url=new URL(process.env.GRIM_BASE_URL||'http://127.0.0.1/');
url.searchParams.set('campaign','review');url.searchParams.set('seed','33');url.searchParams.set('renderer',renderer);
const clock=1000/60;
async function boot(page){
  page.on('pageerror',error=>console.error('Browser error:',error));
  await page.goto(url.href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.grimRun?.scene.scenes[0]?.campaign);
  await page.evaluate(()=>{grimRun.scene.scenes[0].sys.sceneUpdate=()=>{};});
  await page.waitForFunction(()=>{
    const m=grimRun.scene.scenes[0].motionArt;
    return m.forwardReady&&m.cutHandoffReady&&m.cutWeaponReady&&m.airReady&&m.airCutReady;
  });
}
async function start(page){
  await page.locator('#home-screen').tap({position:{x:18,y:30}});
  await page.locator('#start-btn').tap();
  await page.locator('#campaign-primary').tap();
  assert.equal(await page.locator('#campaign-secondary').isDisabled(),true);
  await page.locator('#campaign-primary').tap();
  await page.waitForFunction(()=>grimRun.scene.scenes[0].state==='playing');
}
async function advance(page,condition,n){
  return page.evaluate(({condition,n,clock})=>{
    const s=grimRun.scene.scenes[0],draw=s.drawScene;
    s.drawScene=()=>{};
    try{
      if(condition==='frames'){for(let i=0;i<n;i++)s.update(0,clock);}
      else for(let i=0;s.distance<n&&s.state==='playing'&&i<5000;i++)s.update(0,clock);
    }finally{s.drawScene=draw;}
    s.drawScene();
    if(s.campaign.active)s.campaign.save();
    if(condition==='meters'&&s.distance<n)throw Error('Stopped at '+s.distance+' in '+s.state);
  },{condition,n,clock});
}
const saved=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
const wallet=page=>page.evaluate(()=>GRIM_META.load());
async function reopen(ctx,page){
  await page.close();
  const next=await ctx.newPage();
  await boot(next);
  await next.waitForFunction(()=>grimRun.scene.scenes[0].state==='paused');
  return next;
}
async function resume(page){await page.locator('#resume-btn').tap();}
function comparable(d){
  // Phaser's render-frame count includes time on Home before the attempt.
  const {frame,...world}=d.world;
  world.player={...world.player,visualTouchdown:world.player.visualTouchdown??null};
  return {world,run:d.run,mode:d.mode,powers:d.powers,tipped:d.tipped,terrain:d.terrain};
}
async function matched(browser,viewport,interrupt){
  const ctx=await browser.newContext({viewport,hasTouch:true});
  let page=await ctx.newPage();
  try{
    await boot(page);await start(page);
    await advance(page,'meters',200);
    await page.locator('#jump-btn').tap();
    await advance(page,'frames',5);
    const airborne=await saved(page);
    assert.equal(airborne.world.player.grounded,false);
    if(interrupt){
      page=await reopen(ctx,page);
      assert.deepEqual(comparable(await saved(page)),comparable(airborne));
      await resume(page);
    }
    await advance(page,'meters',205);
    await page.locator('#attack-btn').tap();
    await advance(page,'meters',252);
    const outcome=await saved(page);
    assert.equal(outcome.world.player.grounded,true);
    return {outcome:comparable(outcome),wallet:await wallet(page)};
  }finally{await ctx.close();}
}
async function transactions(browser){
  const ctx=await browser.newContext({viewport:{width:844,height:390},hasTouch:true});
  let page=await ctx.newPage();
  try{
    await boot(page);
    const initial=await page.evaluate(()=>{
      const m=GRIM_META.normalize({version:1,souls:8,levels:{deathDenied:1,boneheart:1,
        deathsLeap:1,graveGlide:1,graveWealth:1,fatesBargain:1}});
      GRIM_META.save(m);grimRun.scene.scenes[0].meta=m;return m;
    });
    await start(page);
    // Clean Cut, followed by the visible Soul beyond the tree.
    await advance(page,'meters',205);await page.locator('#attack-btn').tap();
    await advance(page,'meters',247);
    const bank=await wallet(page);
    assert.equal(bank.brambleSouls,1);
    page=await reopen(ctx,page);assert.deepEqual(await wallet(page),bank);await resume(page);
    // Trigger the ordinary lethal-hit path in a prepared one-HP encounter.
    const lethal=()=>page.evaluate(()=>{
      const s=grimRun.scene.scenes[0];s.player.hp=1;s.player.invulMs=0;
      s.takeDamage(1,'rock');
    });
    await lethal();await advance(page,'frames',180);
    assert.equal((await saved(page)).run.freeLifeUsed,true);
    page=await reopen(ctx,page);await resume(page);await advance(page,'frames',400);
    await lethal();await advance(page,'frames',180);
    assert.equal((await saved(page)).mode,'revive');
    page=await reopen(ctx,page);await resume(page);
    await page.locator('#revive-yes-btn').tap();
    const paid=await wallet(page);
    assert.equal(paid.souls,bank.souls-3);
    page=await reopen(ctx,page);assert.deepEqual(await wallet(page),paid);await resume(page);
    assert.equal((await saved(page)).run.reviveUsed,true);
    await advance(page,'frames',400);await lethal();await advance(page,'frames',180);
    assert.equal(await saved(page),null);
    await page.locator('#retry-btn').tap();
    await page.waitForFunction(()=>grimRun.scene.scenes[0].state==='playing');
    const retry=await saved(page);
    assert.equal(retry.world.distance,0);assert.equal(retry.run.reviveUsed,false);
    assert.equal(retry.run.freeLifeUsed,false);assert.equal(retry.run.soulCount,0);
    assert.equal(retry.world.coinCount,2);assert.deepEqual((await wallet(page)).equipped,initial.equipped);
    await page.locator('#pause-btn').tap();await page.locator('#campaign-save-menu').tap();
    await page.locator('#start-btn').tap();await page.locator('#campaign-secondary').tap();
    assert.equal(await page.evaluate(()=>grimRun.scene.scenes[0].campaign.active),false);
    assert.equal((await saved(page)).id,retry.id);
  }finally{await ctx.close();}
}
// Travel the generated approach at a fixed clock; menu selections use touch.
async function runForest(page){
  await page.evaluate(()=>{
    const s=grimRun.scene.scenes[0],draw=s.drawScene;
    s.drawScene=()=>{};
    try{
      for(let tick=0;tick<4500&&s.state==='playing';tick++){
        const p=s.player;
        const next=s.obstacles.filter(o=>!o.destroyed&&!o.dealtDamage&&o.x+o.width>p.x-10)
          .sort((a,b)=>a.x-b.x)[0];
        const gap=s.terrain.groundAt(p.x+80)===null;
        if(next?.type==='branch'&&next.x-p.x<69)s.startSlide();
        else if(p.holdSlide)s.endSlide();
        if(next?.type==='bramble'&&next.x-p.x<79)s.attack();
        if(p.grounded&&(gap||next&&['fire','rock'].includes(next.type)&&next.x-p.x<95))s.jump();
        s.update(0,1000/60);
      }
    }finally{s.drawScene=draw;}
    s.drawScene();
  });
}
async function merchantAndInterruption(browser){
  const ctx=await browser.newContext({viewport:{width:844,height:390},hasTouch:true});
  let page=await ctx.newPage();
  try{
    await boot(page);
    await page.evaluate(()=>GRIM_META.save(GRIM_META.normalize({souls:4,levels:{boneheart:3,graveWealth:3}})));
    await start(page);
    await runForest(page);
    const offered=await saved(page);
    assert.ok(['vendorIntro','upgrade'].includes(offered.mode),offered.mode+' at '+offered.world.distance);
    page=await reopen(ctx,page);await resume(page);
    if(offered.mode==='vendorIntro')await page.locator('#vendor-intro-skip').tap();
    assert.deepEqual((await saved(page)).run.pendingOffers,offered.run.pendingOffers);
    await page.locator('#reward-cards button:not([disabled])').first().tap();
    const bought=await saved(page);
    assert.equal(bought.run.vendorPurchased,true);
    page=await reopen(ctx,page);await resume(page);
    assert.deepEqual((await saved(page)).powers,bought.powers);
    assert.equal((await saved(page)).world.coinCount,bought.world.coinCount);
    await page.getByRole('button',{name:'CONTINUE RUN'}).tap();
    await advance(page,'frames',30);
    // A renderer crash skips pagehide. Recover the most recently committed tick.
    const beforeCrash=await saved(page);
    const cdp=await ctx.newCDPSession(page);
    const crashed=page.waitForEvent('crash');
    cdp.send('Page.crash').catch(()=>{});
    await crashed;await page.close();
    page=await ctx.newPage();await boot(page);
    await page.waitForFunction(()=>grimRun.scene.scenes[0].state==='paused');
    assert.deepEqual(comparable(await saved(page)),comparable(beforeCrash));
    // A second tab cannot take over or rewrite the attempt.
    const other=await ctx.newPage();await boot(other);
    await other.getByText('FOREST IS OPEN',{exact:true}).waitFor();
    assert.equal((await saved(other)).id,beforeCrash.id);await other.close();
    await resume(page);
    await runForest(page);
    assert.match(await page.locator('#campaign-title').innerText(),/FOREST REVIEW COMPLETE/);
    assert.equal(await saved(page),null);
    await page.locator('#campaign-primary').tap();
    await page.waitForFunction(()=>grimRun.scene.scenes[0].state==='playing');
    await page.evaluate(()=>{const s=grimRun.scene.scenes[0];s.takeDamage(s.player.hp,'rock');});
    await advance(page,'frames',180);
    await page.locator('#revive-no-btn').tap();
    assert.equal(await saved(page),null);
    assert.equal((await wallet(page)).souls,4+Number(bought.run.soulCount));
    console.log('Merchant, renderer crash, exclusive tab, Forest boundary and declined revival passed.');
  }finally{await ctx.close();}
}
(async()=>{
  if(!process.env.GRIM_BASE_URL){
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    url.port=String(server.address().port);
  }
  const browser=await chromium.launch({executablePath:process.env.GRIM_CHROME||undefined,
    args:[...(renderer==='canvas'?['--disable-webgl']:[]),'--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
  try{
    for(const viewport of [{width:844,height:390},{width:390,height:844}]){
      const a=await matched(browser,viewport,false),b=await matched(browser,viewport,true);
      assert.deepEqual(a,b);console.log('Matched jump, Cut and landing:',viewport,a.outcome.world.distance);
    }
    await transactions(browser);
    console.log('Forest pickup, revivals, retry, loadout and Endless passed.');
    await merchantAndInterruption(browser);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
