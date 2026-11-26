'use strict';
const assert = require('node:assert/strict');
const {chromium} = require('playwright');

const levels = {boneheart:3,graveWealth:3,deathsLeap:2,graveGlide:3,fatesBargain:3,deathDenied:1};

async function openShop(page) {
  await page.locator('#home-enter-btn').tap();
  await page.locator('#reliquary-btn').tap();
  await page.waitForFunction(()=>window.grimRun?.scene.scenes[0]?.state==='reliquary');
}

async function measureRun(page) {
  // Step the same opening frames while actual touch events hold the controls.
  await page.evaluate(()=>{grimRun.scene.scenes[0].sys.sceneUpdate=()=>{};});
  await page.locator('#reliquary-back-btn').tap();
  await page.locator('#start-btn').tap();
  const stats = await page.evaluate(()=>{
    const scene=grimRun.scene.scenes[0];
    return [scene.player.maxHp,scene.coinCount,scene.rerollsRemaining,scene.freeLifeAvailable];
  });
  const session=await page.context().newCDPSession(page);
  async function press(id) {
    const box=await page.locator(id).boundingBox();
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[
      {x:box.x+box.width/2,y:box.y+box.height/2,id:0}
    ]});
  }
  const release=()=>session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const ground=await page.evaluate(()=>grimRun.scene.scenes[0].player.y);
  await press('#jump-btn');
  const jump=await page.evaluate(ground=>{
    const scene=grimRun.scene.scenes[0],player=scene.player,launch=player.velocityY;
    let top=player.y;
    for(let i=0;i<75;i++){
      scene.update(0,1000/60);
      top=Math.min(top,player.y);
      if(player.grounded)break;
    }
    return {launch,height:ground-top,landed:player.grounded};
  },ground);
  await release();
  assert(jump.landed&&jump.launch<0);
  await press('#slide-btn');
  const slideMs=await page.evaluate(()=>{
    const scene=grimRun.scene.scenes[0];
    let elapsed=0;
    while(scene.player.sliding&&elapsed<1500){scene.update(0,10);elapsed+=10;}
    return elapsed;
  });
  await release();
  await session.detach();
  return {stats,...jump,slideMs};
}

async function check(browser,viewport,url) {
  const context=await browser.newContext({viewport,hasTouch:true});
  try {
    // Seed a prior-version profile once. Reloads must use the game's own writes.
    await context.addInitScript(levels=>{
      if(!localStorage.getItem('grim-run-v07-meta')){
        localStorage.setItem('grim-run-v07-meta',JSON.stringify({version:1,levels,souls:38,openingSouls:4,brambleSouls:3}));
      }
    },levels);
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url.href,{waitUntil:'domcontentloaded'});
    await openShop(page);
    assert.match(await page.locator('#reliquary-equipped').innerText(),/6 \/ 6/);
    for(const id of Object.keys(levels))await page.locator('#equip-'+id).tap();
    assert.match(await page.locator('#reliquary-equipped').innerText(),/0 \/ 6/);
    await page.reload({waitUntil:'domcontentloaded'});
    await openShop(page);
    assert.equal(await page.getByRole('button',{name:"Equip DEATH'S LEAP",exact:true}).count(),1);
    assert.match(await page.locator('.meta-card').filter({has:page.locator('#equip-deathsLeap')}).innerText(),/Unequipped · \+0% jump height/);
    const off=await measureRun(page);
    assert.deepEqual(off.stats,[3,0,0,false]);assert.equal(off.slideMs,850);
    await page.locator('#pause-btn').tap();
    await page.locator('#quit-btn').tap();
    await page.locator('#abandon-confirm-btn').tap();
    await page.locator('#reliquary-btn').tap();
    for(const id of Object.keys(levels))await page.locator('#equip-'+id).tap();
    assert.match(await page.locator('.meta-card').filter({has:page.locator('#equip-deathsLeap')}).innerText(),/Equipped · \+10% jump height/);
    const on=await measureRun(page);
    assert.deepEqual(on.stats,[6,6,3,true]);assert.equal(on.slideMs,1300);
    assert(Math.abs((on.launch/off.launch)**2-1.10)<0.00001);
    assert(Math.abs(on.height/off.height-1.10)<0.01);
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('grim-run-v07-meta')));
    assert.equal(saved.souls,38);assert.deepEqual(saved.levels,levels);
    assert.equal(saved.openingSouls,4);assert.equal(saved.brambleSouls,3);
    assert.equal(saved.equipped.length,6);assert.deepEqual(errors,[]);
    const other=await context.newPage();
    await other.goto(url.href,{waitUntil:'domcontentloaded'});
    await openShop(other);
    await other.locator('#equip-deathsLeap').tap();
    await page.waitForFunction(()=>!grimRun.scene.scenes[0].meta.equipped.includes('deathsLeap'));
    assert.equal(await page.evaluate(()=>grimRun.scene.scenes[0].runLoadout.levels.deathsLeap),2);
    await other.getByRole('button',{name:"Purchase DEATH'S LEAP level 3 for 25 Souls",exact:true}).tap();
    const ranked=await other.evaluate(()=>GRIM_META.load());
    assert.equal(ranked.levels.deathsLeap,3);assert.equal(ranked.souls,13);
    assert.equal(ranked.equipped.includes('deathsLeap'),false);
    await other.close();
    console.log(JSON.stringify({viewport,off,on}));
  } finally {await context.close();}
}

async function verifyLoadouts(browser,base) {
  const url=new URL(base);
  url.searchParams.set('seed','33');
  for(const viewport of [{width:390,height:844},{width:844,height:390}])await check(browser,viewport,url);
}
module.exports={verifyLoadouts};
if(require.main===module)(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--disable-webgl']});
  try {
    await verifyLoadouts(browser,process.argv[2]||'http://127.0.0.1:8765/');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
