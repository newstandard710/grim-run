'use strict';
const assert=require('node:assert/strict');

async function verifySoulReach(browser,base,viewport) {
  const ctx=await browser.newContext({viewport,hasTouch:true});
  try {
    const page=await ctx.newPage();
    const url=new URL(base);
    url.searchParams.set('seed','33');
    await page.goto(url.href,{waitUntil:'domcontentloaded'});
    await page.locator('#home-enter-btn').tap();
    await page.waitForFunction(()=>window.grimRun?.scene.scenes[0]?.state==='menu');
    // Advance the ordinary simulation on a controlled clock between touch events.
    await page.evaluate(()=>{grimRun.scene.scenes[0].sys.sceneUpdate=()=>{};});
    const session=await ctx.newCDPSession(page);
    async function hold(id) {
      const box=await page.locator(id).boundingBox();
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[
        {x:box.x+box.width/2,y:box.y+box.height/2,id:0}
      ]});
    }
    const release=()=>session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const advance=meters=>page.evaluate(meters=>{
      const s=grimRun.scene.scenes[0],paint=s.drawScene;
      s.drawScene=()=>{};
      try {
        while(s.distance<meters && s.state==='playing')s.update(0,1000/60);
      } finally {s.drawScene=paint;}
      s.drawScene();
      if(s.distance<meters)throw Error('Run ended at '+s.distance);
    },meters);
    async function quit() {
      await page.locator('#pause-btn').tap();
      await page.locator('#quit-btn').tap();
      await page.locator('#abandon-confirm-btn').tap();
    }

    // A truly fresh profile earns the five Souls before purchasing through Home.
    for(let attempt=1;attempt<=5;attempt++){
      await page.locator('#start-btn').tap();
      await advance(62);
      await hold('#slide-btn');
      await advance(100);
      await release();
      assert.equal(await page.evaluate(()=>GRIM_META.load().souls),attempt);
      await quit();
    }
    await page.locator('#reliquary-btn').tap();
    await page.getByRole('button',{name:'Purchase SOUL REACH level 1 for 5 Souls'}).tap();
    assert.equal(await page.locator('#reliquary-souls').innerText(),'0');
    // Reuse the same clean bramble Cut and mistimed jump, changing only the loadout.
    const results=[];
    for(const on of [false,true]){
      await page.locator('#equip-soulReach').tap();
      await page.locator('#reliquary-back-btn').tap();
      await page.locator('#start-btn').tap();
      await advance(205);
      await page.locator('#attack-btn').tap();
      await advance(216);
      const launch=await page.evaluate(()=>{
        const s=grimRun.scene.scenes[0],soul=s.souls.find(o=>o.kind==='bramble');
        return (soul.x-60-s.startX)/GRIM_CONFIG.pxPerMeter;
      });
      await advance(launch);
      await hold('#jump-btn');
      await advance(245);
      await release();
      const result=await page.evaluate(()=>{
        const s=grimRun.scene.scenes[0],m=GRIM_META.load();
        return {run:s.soulCount,wallet:m.souls,opening:m.openingSouls,bramble:m.brambleSouls};
      });
      assert.deepEqual(result,{run:Number(on),wallet:Number(on),opening:5,bramble:Number(on)});
      results.push(result);
      await quit();
      await page.locator('#reliquary-btn').tap();
    }
    await page.locator('#reliquary-reset-btn').tap();
    await page.locator('#reset-confirm-btn').tap();
    const refunded=await page.evaluate(()=>GRIM_META.load());
    assert.equal(refunded.souls,5);
    assert.equal(refunded.levels.soulReach,0);
    assert.deepEqual(refunded.equipped,[]);
    assert.equal(refunded.openingSouls,5);
    assert.equal(refunded.brambleSouls,1);
    console.log('Soul Reach',JSON.stringify({viewport,results}));
  } finally {await ctx.close();}
}
module.exports={verifySoulReach};
