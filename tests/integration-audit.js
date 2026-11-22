'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
process.env.LANDING_BASELINE = root;
const {chromium, server, setup, trace, rates, routes} = require('./browser-landing');
const [mode, width, height] = process.argv.slice(2);
const viewport = {width:Number(width), height:Number(height)};
const mobile = viewport.width < 1000;
const output = path.resolve('test-results/integration');
fs.mkdirSync(output, {recursive:true});
const result = {mode, viewport, runs:[], errors:[]};
function save() {
  fs.writeFileSync(path.join(output,'observations.json'),JSON.stringify(result,null,2));
}
async function input(page, action, hold) {
  const keys = {slide:'ArrowDown',jump:'ArrowUp',cut:'a',shoot:'f'};
  if (!mobile) return hold ? page.keyboard.down(keys[action]) : page.keyboard.up(keys[action]);
  const selector = {slide:'slide-btn',jump:'jump-btn',cut:'attack-btn',shoot:'crossbow-btn'}[action];
  const box = await page.locator('#'+selector).boundingBox();
  assert(box, selector+' is visible');
  const finger = await page.context().newCDPSession(page);
  try {
    await finger.send('Input.dispatchTouchEvent',{type:hold?'touchStart':'touchEnd',
      touchPoints:hold?[{x:box.x+box.width/2,y:box.y+box.height/2,id:1}]:[]});
  } finally {await finger.detach();}
}
async function play(page) {
  await page.goto('http://127.0.0.1:'+server.address().port+'/after/?seed=33');
  await page.locator('#home-enter-btn').click();
  await page.locator('#reliquary-btn').click();
  await page.locator('#reliquary-back-btn').click();
  await page.locator('#start-btn').click();
  await page.waitForFunction(()=>{const s=window.grimRun?.scene.scenes[0];return s?.state==='playing' && s.motionArt?.rising && s.landingArt?.ready;},null,{timeout:90000});
  await page.evaluate(()=>grimRun.scene.scenes[0].visuals.reviewLoad);
  result.renderer = await page.evaluate(()=>grimRun.renderer.type);
  assert.equal(result.renderer, mode==='canvas'?1:2);
  await page.locator('#pause-btn').click();
  assert.equal(await page.evaluate(()=>grimRun.scene.scenes[0].state),'paused');
  await page.locator('#resume-btn').click();
  await page.waitForFunction(()=>grimRun.scene.scenes[0].state==='playing');
  for(let run=0;run<2;run++) {
    await page.evaluate(()=>{
      const g=grimRun,s=g.scene.scenes[0];
      s.startRun();g.loop.sleep();clearInterval(s.loopWatchdogId);s.sys.sceneUpdate=()=>{};
    });
    const start=await page.evaluate(()=>{
      const s=grimRun.scene.scenes[0];let o;
      for(let i=0;i<300;i++){
        s.update(0,1000/60);
        o=s.obstacles.find(v=>v.type==='branch'&&v.x-s.player.x>0&&v.x-s.player.x<=75);
        if(o)break;
      }
      if(!o) return {missing:true,meters:s.distance,obstacles:s.obstacles.map(x=>[x.type,x.x])};
      grimRun.step(performance.now(),0);return {x:o.x,meters:s.distance,skin:s.obstacleSkinFor(o).id,hp:s.player.hp};
    });
    if(start.missing) {result.runs.push(start);save();break;}
    if(run===0)await page.screenshot({path:path.join(output,'forest-approach.png')});
    await input(page,'slide',true);
    const cross=await page.evaluate(()=>{
      const s=grimRun.scene.scenes[0],o=s.obstacles.find(v=>v.type==='branch'&&v.x>s.player.x);
      const held=s.player.holdSlide, trace=[];
      for(let i=0;i<42;i++){s.update(0,1000/60);trace.push([s.player.x,s.player.y,s.lowProfile,!!o.dealtDamage]);}
      grimRun.step(performance.now(),0);
      return {held,crossed:s.player.x>o.x+o.width,hp:s.player.hp,hit:!!o.dealtDamage,trace};
    });
    await input(page,'slide',false);
    await input(page,'jump',true);
    await input(page,'jump',false);
    const join=await page.evaluate(()=>{
      const s=grimRun.scene.scenes[0],p=s.player;const tucked=p.airTuck;let t=0;
      while(!p.grounded&&t++<120)s.update(0,1000/60);
      return {tucked,t,grounded:p.grounded,x:p.x,y:p.y,source:p.visualTouchdown?.source};
    });
    await input(page,'cut',true);await input(page,'cut',false);
    const cut=await page.evaluate(()=>{const s=grimRun.scene.scenes[0];s.update(0,1000/60);return {ms:s.player.attackMs,mode:s.player.risingCut?.mode};});
    result.runs.push({start,cross,join,cut});save();
    assert(cross.held&&cross.crossed&&!cross.hit&&cross.hp===start.hp);
    assert(join.tucked&&join.grounded&&cut.ms>0);
  }
  if(result.runs.length===2)assert.deepEqual(result.runs[0],result.runs[1]);
  // Isolate contact geometry and first-input acceptance from randomly placed hazards.
  result.landings={};
  for(const name of ['flat','up','down','seed78','held','lateRelease','heldUp','releasedDown','platform','jump','slide','cut','shoot']){
    await page.evaluate(()=>history.replaceState(null,'','?seed=78'));
    const route=routes.find(r=>r.id===name),rate=rates.hz60;
    const at=route.releaseFraction?(await trace(page,{...route,releaseFraction:null},rate,0)).at(-1).contact:0;
    const rows=await trace(page,route,rate,at),i=rows.findIndex(r=>r.grounded);
    assert(i>=0,name);
    result.landings[name]={contact:rows[i],next:rows[i+1],later:rows.at(-1)};
    save();
  }
  // A player's Cut and manual Fire inputs on the same run and update clock.
  result.bow=[];
  for(const ticks of [4,18]){
    await page.evaluate(setup,{route:{m:20,short:1},rate:rates.hz60,landingAt:0});
    await page.evaluate(()=>{const s=grimRun.scene.scenes[0];for(let i=0;i<80;i++)qaStep();s.gunUnlocked=true;s.gunCooldownMs=0;s.ui.showGun(true);});
    await input(page,'cut',true);await input(page,'cut',false);
    await page.evaluate(n=>{for(let i=0;i<n;i++)qaStep();},ticks);
    const before=await page.evaluate(()=>{const s=grimRun.scene.scenes[0];return [s.player.attackMs,s.player.risingCut?.mode,s.bullets.length];});
    await input(page,'shoot',true);await input(page,'shoot',false);
    const after=await page.evaluate(()=>{const s=grimRun.scene.scenes[0];return [s.player.attackMs,s.player.risingCut?.mode,s.bullets.length,s.player.visualFireMs];});
    assert.equal(after[2],before[2]+1);
    result.bow.push({ticks,before,after});save();
  }
  // Warm real RAF on a populated Forest opening, one full Phaser draw per tick.
  result.pacing=await page.evaluate(async()=>{
    const s=grimRun.scene.scenes[0],g=grimRun;
    history.replaceState(null,'','?seed=33');s.startRun();g.loop.sleep();clearInterval(s.loopWatchdogId);s.sys.sceneUpdate=()=>{};
    const cpu=[],gap=[];let prev;
    for(let i=0;i<245;i++){
      const now=await new Promise(requestAnimationFrame);
      const start=performance.now();
      if(i===80||i===205)s.jump();if(i===90||i===215)s.jumpEnd();
      if(i===100||i===220)s.attack();if(i===156)s.startSlide();if(i===201)s.endSlide();
      s.update(0,1000/60);g.step(now,0);
      if(i>=45){gap.push(now-prev);cpu.push(performance.now()-start);}prev=now;
    }
    function stats(a){a.sort((x,y)=>x-y);return {n:a.length,median:a[99],p95:a[189],p99:a[197],over50:a.filter(x=>x>50).length,max:a.at(-1)};}
    return {cpu:stats(cpu),raf:stats(gap),end:s.distance,state:s.state};
  });
  save();assert.deepEqual(result.errors,[]);
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const b=await chromium.launch({args:mode==='canvas'?['--disable-webgl']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const page=await b.newPage({viewport,hasTouch:mobile,deviceScaleFactor:1});
    page.on('pageerror',e=>result.errors.push(e.message));
    await play(page);
  }finally{save();await b.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
