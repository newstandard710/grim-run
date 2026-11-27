'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return res.writeHead(404).end();
  const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml','.webm':'video/webm'};
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});
const key='grim-run-forest-attempt-v1';
const renderer=process.env.GRIM_RENDERER||'canvas';
const url=new URL(process.env.GRIM_BASE_URL||'http://127.0.0.1/');
url.searchParams.set('seed','33');url.searchParams.set('renderer',renderer);
const clock=1000/60;
async function boot(page){
  page.on('pageerror',error=>console.error('Browser error:',error));
  await page.goto(url.href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.grimRun?.scene.scenes[0]?.state==='home');
  await page.evaluate(()=>{grimRun.scene.scenes[0].sys.sceneUpdate=()=>{};});
  await page.waitForFunction(()=>{
    const m=grimRun.scene.scenes[0].motionArt;
    return m.forwardReady&&m.cutHandoffReady&&m.cutWeaponReady&&m.airReady&&m.airCutReady;
  });
}
async function openChapters(page){
  await page.locator('#home-screen').tap({position:{x:18,y:30}});
  await page.getByRole('button',{name:'CAMPAIGN',exact:true}).tap();
}
async function selectSavedForest(page){
  await openChapters(page);
  await page.getByRole('button',{name:'RESUME FOREST'}).tap();
}
async function restoreForest(page){
  await selectSavedForest(page);
  await page.waitForFunction(()=>grimRun.scene.scenes[0].state==='paused');
}
async function start(page){
  await openChapters(page);
  await page.getByRole('button',{name:'START FOREST'}).waitFor();
  assert.equal(await page.locator('#campaign-secondary').isDisabled(),true);
  await page.getByRole('button',{name:'START FOREST'}).tap();
  await page.waitForFunction(()=>grimRun.scene.scenes[0].state==='playing');
}
async function playingStory(page,name){
  await page.waitForFunction(name=>{
    const film=document.querySelector('#forest-story-film');
    return grimRun.scene.scenes[0].state==='forestStory'&&film.currentSrc.endsWith(name)
      &&film.videoWidth>0&&film.currentTime>0;
  },name);
  assert.equal(await page.locator('#controls').isVisible(),false);
  assert.equal(await page.evaluate(()=>grimRun.scene.scenes[0].cameras.main.visible),false);
}
async function openingStory(browser){
  let firstWorld;
  for(const action of ['watch','skip','reload']){
    const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
    try{
      let page=await ctx.newPage();await boot(page);await openChapters(page);
      await page.getByRole('button',{name:'START FOREST'}).tap();
      await playingStory(page,'passage-sealed.webm');
      const before=await saved(page);
      assert.equal(before.world.distance,0);
      assert.equal(await page.evaluate(()=>localStorage.getItem(GRIM_META.CAMPAIGN_PROGRESS)),null);
      await advance(page,'frames',90);
      assert.deepEqual(comparable(await saved(page)),comparable(before));
      if(action==='skip')await page.getByRole('button',{name:'SKIP',exact:true}).tap();
      if(action==='reload'){
        page=await reopen(ctx,page);assert.equal((await saved(page)).id,before.id);
        await resume(page);
      }
      await page.waitForFunction(()=>grimRun.scene.scenes[0].state==='playing');
      await advance(page,'meters',25);
      const current=comparable(await saved(page));
      if(firstWorld)assert.deepEqual(current,firstWorld);
      else firstWorld=current;
      assert.equal((await wallet(page)).souls,0);
    }finally{await ctx.close();}
  }
  console.log('Watching, skipping and interrupting the opening gave identical first approaches.');
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
  await restoreForest(next);
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
    await page.getByRole('button',{name:'ENDLESS',exact:true}).tap();
    assert.equal(await page.evaluate(()=>grimRun.scene.scenes[0].campaign.active),false);
    assert.equal(await page.evaluate(()=>grimRun.scene.scenes[0].forestRoute),null);
    assert.equal((await saved(page)).id,retry.id);
  }finally{await ctx.close();}
}
// Travel the generated approach at a fixed clock; menu selections use touch.
async function runForest(page){
  await page.evaluate(()=>{
    const s=grimRun.scene.scenes[0],draw=s.drawScene;
    s.drawScene=()=>{};
    try{
      let acted,gapUsed;
      for(let tick=0;tick<18000&&s.state==='playing'&&!s.campaign.guardian;tick++){
        const p=s.player,x=p.x;
        const ob=s.obstacles.filter(o=>!o.destroyed&&!o.dealtDamage&&o.x+o.width>x-32)
          .sort((a,b)=>a.x-b.x)[0];
        const gap=s.terrain.segments.find(z=>z.kind==='gap'&&z.start>=x&&z.start-x<s.speed*.17);
        if(p.holdSlide&&(!ob||ob.type!=='branch'||ob.x-x>s.speed*.25))s.endSlide();
        if(gap&&p.grounded&&gap!==gapUsed){s.jump();gapUsed=gap;}
        if(ob&&ob!==acted){
          const dx=ob.x-x;
          if(['rock','fire'].includes(ob.type)&&dx<s.speed*.29&&p.grounded){s.jump();acted=ob;}
          if(ob.type==='branch'&&dx<s.speed*.18){s.startSlide();acted=ob;}
          if(ob.type==='bramble'&&dx<116&&dx>20){s.attack();acted=ob;}
        }
        s.update(0,1000/60);
      }
    }finally{s.drawScene=draw;}
    s.drawScene();
  });
}
// Advance the normal game clock between decisions, then press the visible
// controls through Chromium's touch input. Draw each approach at game scale.
async function touchApproach(page,stopMeters=Infinity){
  const ctx=page.context(),touch=await ctx.newCDPSession(page);
  const buttons={};
  for(const key of ['jump','slide','attack']){
    const box=await page.locator('#'+key+'-btn').boundingBox();
    buttons[key]=[{x:box.x+box.width/2,y:box.y+box.height/2,id:1}];
  }
  let held=null,actedX=null;
  try{
    for(let count=0;count<550;count++){
      const event=await page.evaluate(({held,actedX,stopMeters})=>{
        const s=grimRun.scene.scenes[0],draw=s.drawScene;
        s.drawScene=()=>{};
        try{
          for(let frame=0;frame<1000;frame++){
            if(s.state!=='playing'||s.campaign.guardian||s.distance>=stopMeters)return {done:true};
            const p=s.player,x=p.x;
            if(!held&&p.wispMs!=null&&s.gunCooldownMs<=0)return {shoot:true};
            if(held==='jump'&&(p.grounded||p.jumpAgeMs>=540))return {release:true};
            const ob=s.obstacles.find(o=>!o.destroyed&&!o.dealtDamage&&o.x+o.width>x-32);
            if(held==='slide'&&(!ob||ob.x!==actedX))return {release:true};
            const gap=s.terrain.sequences.find(g=>g.startX>=x&&g.startX-x<s.speed*.17);
            if(!held&&p.grounded&&gap&&gap.startX!==actedX)return {press:'jump',x:gap.startX};
            if(!held&&ob&&ob.x!==actedX){
              const dx=ob.x-x;
              if(ob.type==='rock'&&dx<s.speed*.29&&p.grounded)return {press:'jump',x:ob.x};
              if(ob.type==='branch'&&dx<s.speed*.18)return {press:'slide',x:ob.x};
              if(ob.type==='bramble'&&dx<112&&dx>20)return {press:'attack',x:ob.x};
            }
            s.update(0,1000/60);
          }
          throw Error('No Forest decision for 1,000 frames at '+s.distance);
        }finally{s.drawScene=draw;s.drawScene();}
      },{held,actedX,stopMeters});
      if(event.done)return;
      if(event.shoot){await page.locator('#crossbow-btn').tap();continue;}
      if(event.release){
        await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});held=null;
      }else{
        await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:buttons[event.press]});
        actedX=event.x;
        if(event.press==='attack')await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        else held=event.press;
      }
    }
    throw Error('Forest traversal exceeded the encounter budget');
  }finally{
    if(held)await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await touch.detach();
  }
}

async function untilBossPhase(page,phase,ms=0){
  return page.evaluate(({phase,ms})=>{
    const s=grimRun.scene.scenes[0],draw=s.drawScene;
    s.drawScene=()=>{};
    try{
      for(let i=0;i<900;i++){
        const b=s.campaign.guardian;
        if(!b||s.state!=='playing')break;
        if(b.phase===phase&&b.ms>=ms)return {...b,elapsed:s.elapsed,playerHp:s.player.hp};
        s.update(0,1000/60);
      }
      throw Error('Expected '+phase+' at '+ms+' ms; got '+JSON.stringify(s.campaign.guardian)+' in '+s.state);
    }finally{s.drawScene=draw;s.drawScene();}
  },{phase,ms});
}
async function holdControl(page,name,frames){
  const box=await page.locator('#'+name+'-btn').boundingBox();
  const touch=await page.context().newCDPSession(page);
  try{
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2,id:1}]});
    if(typeof frames==='string')await untilBossPhase(page,frames);
    else await advance(page,'frames',frames);
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }finally{await touch.detach();}
}
async function defeatGuardian(page){
  const start=await untilBossPhase(page,'roots',700);
  for(let round=0;round<3;round++){
    if(round)await untilBossPhase(page,'roots',700);
    await holdControl(page,'jump',30);
    await untilBossPhase(page,'bough',800);
    await holdControl(page,'slide','exposed');
    await untilBossPhase(page,'exposed',220);
    await page.locator('#attack-btn').tap();
    await untilBossPhase(page,round===2?'fall':'struck');
  }
  const final=await saved(page);
  assert.equal(final.world.guardian.hp,0);
  assert.equal(final.world.player.hp,start.playerHp,'Each visible attack can be avoided');

}
async function reachGuardian(page){
  await start(page);
  await runForest(page);
  const merchant=await saved(page);
  if(merchant.mode==='vendorIntro')await page.locator('#vendor-intro-skip').tap();
  await page.getByRole('button',{name:'CONTINUE RUN'}).tap();
  await runForest(page);
  const arrival=await saved(page);
  assert.equal(arrival.world.guardian.phase,'arrival');
  assert.ok(await page.evaluate(()=>{
    const s=grimRun.scene.scenes[0],x=s.campaign.guardian.standX;
    return Array.from({length:34},(_,i)=>s.terrain.groundAt(x+i*8)).every(y=>y!==null);
  }),'The guardian is rooted on solid terrain in either orientation');
  assert.equal(arrival.world.player.hp,arrival.world.player.maxHp);
  return arrival;
}
async function expectScore(page, section){
  await page.waitForFunction(section=>{
    const score=grimRun.scene.scenes[0].campaign.score;
    if(!section)return !score.voice;
    return score.target===section&&score.voice?.source.buffer?.duration>1;
  },section);
}
async function audibleMusic(page){
  // Sample the decoded signal after the player's music volume control.
  return page.evaluate(async()=>{
    const score=grimRun.scene.scenes[0].campaign.score;
    const analyser=score.context.createAnalyser();
    score.bus.connect(analyser);
    try{
      const samples=new Float32Array(analyser.fftSize);
      for(let i=0;i<40;i++){
        await new Promise(r=>setTimeout(r,25));
        analyser.getFloatTimeDomainData(samples);
        if(samples.some(v=>Math.abs(v)>.001))return true;
      }
      return false;
    }finally{score.bus.disconnect(analyser);analyser.disconnect();}
  });
}

async function freshClear(browser,viewport,seed){
  const ctx=await browser.newContext({viewport,hasTouch:true});
  try{
    url.searchParams.set('seed',String(seed));
    let page=await ctx.newPage();await boot(page);await start(page);
    await expectScore(page,'walk');
    assert.ok(await audibleMusic(page),'The woodland score reaches the music bus');
    await page.locator('#pause-btn').tap();
    await expectScore(page,null);
    await page.locator('#music-volume').fill('67');
    if(seed===91)await page.locator('#mute-music').check();
    await resume(page);
    await expectScore(page,seed===91?null:'walk');
    await touchApproach(page);
    assert.equal((await saved(page)).mode,'vendorIntro');
    await expectScore(page,null);
    await page.locator('#vendor-intro-skip').tap();
    await page.getByRole('button',{name:'CONTINUE RUN'}).tap();
    // Stop on a clear trail between phrases, reload, and finish the same seed.
    await touchApproach(page,2420);
    const middle=await saved(page);
    assert.ok(middle.world.distance>=2420);assert.equal(middle.world.player.hp,3);
    page=await reopen(ctx,page);assert.deepEqual(comparable(await saved(page)),comparable(middle));
    assert.equal(await page.locator('#music-volume').inputValue(),'67');
    assert.equal(await page.locator('#mute-music').isChecked(),seed===91);
    assert.equal(await page.locator('#mute-actions').isChecked(),false);
    await resume(page);
    await touchApproach(page,6340);
    const rehearsal=await saved(page);
    assert.equal(rehearsal.world.player.hp,3);
    assert.deepEqual(await page.evaluate(()=>{
      const s=grimRun.scene.scenes[0];
      return {forest:s.biomeBackdrops.forest.visible,snow:s.snowCoverAt(s.player.x),
        skin:s.obstacleBiomeFor({x:s.player.x}),gun:s.gunUnlocked,portal:s.hasTeleported,
        boss:s.campaign.guardian?.phase??null};
    }),{forest:true,snow:0,skin:'forest',gun:false,portal:false,boss:null});
    if(seed===33)await mistimedRehearsal(browser,viewport,rehearsal);
    await page.bringToFront();
    if(await page.evaluate(()=>grimRun.scene.scenes[0].campaign.frozen))await resume(page);
    await touchApproach(page);
    const arrival=await saved(page);
    assert.equal(arrival.world.guardian.phase,'arrival');assert.equal(arrival.world.player.hp,3);
    assert.ok(arrival.world.distance>=6500);
    assert.ok(Object.values(arrival.run.runLoadout.levels).every(rank=>rank===0));
    await expectScore(page,seed===91?null:'guardian');
    if(seed===33)assert.ok(await audibleMusic(page),'The Guardian score reaches the music bus');
    const bank=await wallet(page);
    await defeatGuardian(page);
    await expectScore(page,seed===91?null:'victory');
    const finished=await saved(page);
    const total=finished.world.elapsed+.95;
    assert.ok(total>=240&&total<=300,'Active clear took '+total+' seconds');
    console.log('Fresh Forest touch clear',seed,viewport,'approach',arrival.world.elapsed.toFixed(2),
      'fight',(total-arrival.world.elapsed).toFixed(2),'total',total.toFixed(2),'seconds');
    // A competing Campaign tab must see one credit from the winning tab.
    const spectator=await ctx.newPage();await boot(spectator);await selectSavedForest(spectator);
    await spectator.getByText('FOREST IS OPEN',{exact:true}).waitFor();
    await page.bringToFront();
    if(await page.evaluate(()=>grimRun.scene.scenes[0].campaign.frozen))await resume(page);
    // Interrupt specifically between the chapter record and attempt cleanup.
    await page.evaluate(()=>{
      // Stop both the balance mirror and cleanup after the atomic chapter write.
      const set=Storage.prototype.setItem,remove=Storage.prototype.removeItem;
      Storage.prototype.setItem=function(k,v){
        if(k===GRIM_META.KEY)throw Error('injected wallet interruption');
        return set.call(this,k,v);
      };
      Storage.prototype.removeItem=function(k){
        if(k==='grim-run-forest-attempt-v1')throw Error('injected cleanup interruption');
        return remove.call(this,k);
      };
    });
    await advance(page,'frames',70);
    assert.equal(await page.locator('#campaign-title').innerText(),'FOREST CLEAR PENDING');
    assert.equal((await wallet(spectator)).souls,bank.souls+3);
    await spectator.close();await page.close();page=await ctx.newPage();await boot(page);
    await openChapters(page);
    await page.getByRole('button',{name:'REPLAY FOREST'}).waitFor();
    assert.match(await page.locator('#campaign-detail').innerText(),/Foothills is unlocked/);
    await page.getByRole('button',{name:'REPLAY FOREST'}).tap();
    await page.waitForFunction(()=>grimRun.scene.scenes[0].state==='playing');
    const replay=await saved(page);
    assert.notEqual(replay.id,arrival.id);assert.equal(replay.world.distance,0);
    assert.equal(replay.world.guardian,undefined);
    assert.deepEqual(await wallet(page),{...bank,souls:bank.souls+3,forestBonusBanked:3});
    if(seed===91){
      // Pay for a revival during the replay and finish with the same attempt.
      const replayStart=await wallet(page);
      await page.locator('#pause-btn').tap();
      await page.locator('#mute-actions').check();
      await resume(page);
      await expectScore(page,null);
      await page.evaluate(()=>{const s=grimRun.scene.scenes[0];s.takeDamage(s.player.hp,'rock');});
      await advance(page,'frames',180);await page.locator('#revive-yes-btn').tap();
      assert.equal((await wallet(page)).souls,replayStart.souls-3);
      await page.evaluate(()=>{
        const s=grimRun.scene.scenes[0];
        for(let i=0;i<400&&s.state!=='playing';i++)s.update(0,1000/60);
      });
      await touchApproach(page);
      await page.locator('#vendor-intro-skip').tap();
      await page.getByRole('button',{name:'CONTINUE RUN'}).tap();
      await touchApproach(page);await defeatGuardian(page);
      const pickups=(await saved(page)).run.soulCount;
      const before=await wallet(page);
      assert.equal(before.souls,replayStart.souls-3+pickups);
      await advance(page,'frames',70);
      await playingStory(page,'passage-open.webm');
      assert.equal((await wallet(page)).souls,before.souls+1);
      await page.getByRole('button',{name:'SKIP',exact:true}).tap();
      assert.match(await page.locator('#campaign-detail').innerText(),
        new RegExp('Forest cleared · \\+1 Soul · Wallet: '+(before.souls+1)+' Souls'));
      await boot(page);
      assert.equal((await wallet(page)).souls,before.souls+1);
      console.log('Replay earned',pickups,'pickups + 1 clear bonus after a paid revival.');
    }
  }finally{url.searchParams.set('seed','33');await ctx.close();}
}
// Replay the last lower obstacle from the same frame with deliberately bad
// touch timing. The following overhang still leaves time to recover.
async function mistimedRehearsal(browser,viewport,frame){
  for(const timing of ['early','late','missed']){
    const ctx=await browser.newContext({viewport,hasTouch:true});
    try{
      const page=await ctx.newPage();await boot(page);
      await page.evaluate(({key,frame})=>localStorage.setItem(key,JSON.stringify(frame)),{key,frame});
      await boot(page);await restoreForest(page);
      await resume(page);
      if(timing==='early')await page.locator('#jump-btn').tap();
      await advance(page,'meters',timing==='late'?6359:6370);
      if(timing==='late')await page.locator('#jump-btn').tap();
      await advance(page,'meters',6380);
      const after=await saved(page);
      assert.equal(after.world.player.hp,2,timing+' jump should cost one HP');
      assert.equal(after.mode,'playing');
    }finally{await ctx.close();}
  }
}
// Captured after the original guardian build's vendor, before routeVersion existed.
async function originalAttempt(browser){
  const old=require('./fixtures/forest-900m-save.json');
  const ctx=await browser.newContext({viewport:{width:844,height:390},hasTouch:true});
  try{
    const page=await ctx.newPage();await boot(page);
    await page.evaluate(({old,key})=>{
      localStorage.setItem(key,JSON.stringify(old));
      localStorage.setItem(GRIM_META.CAMPAIGN_PROGRESS,JSON.stringify({
        forest:{cleared:true,attempt:'earlier-unrewarded-clear'},foothillsUnlocked:true
      }));
    },{old,key});
    await boot(page);await openChapters(page);
    await page.getByRole('button',{name:'WATCH FOREST OPENING'}).tap();
    await playingStory(page,'passage-sealed.webm');
    await page.getByRole('button',{name:'SKIP',exact:true}).tap();
    assert.deepEqual(await saved(page),old);
    await page.getByRole('button',{name:'RESUME FOREST'}).tap();
    await page.waitForFunction(()=>grimRun.scene.scenes[0].state==='paused');
    assert.equal((await saved(page)).world.distance,old.world.distance);
    await resume(page);await runForest(page);
    const arrival=await saved(page);
    assert.equal(arrival.id,old.id);assert.equal(arrival.world.guardian.phase,'arrival');
    assert.ok(arrival.world.distance>=900&&arrival.world.distance<901);
    const bank=await wallet(page);await defeatGuardian(page);
    // Fail before the reward commit, then retry through the visible recovery button.
    await page.evaluate(()=>{
      const set=Storage.prototype.setItem;
      Storage.prototype.setItem=function(k,v){
        if(k===GRIM_META.CAMPAIGN_PROGRESS){
          Storage.prototype.setItem=set;throw Error('Interrupted victory write');
        }
        return set.call(this,k,v);
      };
    });
    await advance(page,'frames',70);
    assert.deepEqual(await wallet(page),bank);
    await page.getByRole('button',{name:'RETRY SAVE'}).tap();
    assert.equal((await wallet(page)).souls,bank.souls+3);
    await page.getByRole('heading',{name:'FOREST CLEARED'}).waitFor();
    assert.match(await page.locator('#campaign-detail').innerText(),/First Forest clear · \+3 Souls/);
    await page.getByRole('button',{name:'REPLAY FOREST'}).tap();
    await page.waitForFunction(()=>grimRun.scene.scenes[0].state==='playing');
    const replay=await saved(page);assert.equal(replay.routeVersion,2);
    assert.equal(replay.world.distance,0);assert.notEqual(replay.id,old.id);
    console.log('Original 900 m save cleared on its own route. Replay started the full chapter.');
  }finally{await ctx.close();}
}
async function guardianRevivals(browser){
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
  try{
    let page=await ctx.newPage();await boot(page);
    await page.evaluate(()=>GRIM_META.save(GRIM_META.normalize({souls:5,levels:{deathDenied:1}})));
    const arrival=await reachGuardian(page);
    await untilBossPhase(page,'roots',10);
    await holdControl(page,'jump',15); // Too early: lands before roots erupt.
    await untilBossPhase(page,'breath');
    assert.equal((await saved(page)).world.player.hp,arrival.world.player.hp-1);
    await untilBossPhase(page,'bough',350);await page.locator('#attack-btn').tap();
    await untilBossPhase(page,'exposed',150); // No Slide: a second hit. Early Cut cannot damage bark.
    const missed=await saved(page);
    assert.equal(missed.world.guardian.hp,3);assert.equal(missed.world.player.hp,1);
    await page.locator('#attack-btn').tap();await untilBossPhase(page,'struck');
    await untilBossPhase(page,'roots',800);await advance(page,'frames',185);
    assert.equal((await saved(page)).run.freeLifeUsed,true);
    page=await reopen(ctx,page);await resume(page);await advance(page,'frames',390);
    let d=await saved(page);assert.equal(d.id,arrival.id);assert.equal(d.world.guardian.hp,2);
    // Let attacks finish this life. Reload the offer and buy exactly one revival.
    const waitFor=async mode=>page.evaluate(mode=>{
      const s=grimRun.scene.scenes[0],draw=s.drawScene;s.drawScene=()=>{};
      try{for(let n=0;n<3200&&s.state!==mode;n++)s.update(0,1000/60);}
      finally{s.drawScene=draw;s.drawScene();}
      if(s.state!==mode)throw Error('Expected '+mode+', got '+s.state);
    },mode);
    await waitFor('revive');
    const bank=await wallet(page);
    page=await reopen(ctx,page);await resume(page);await page.locator('#revive-yes-btn').tap();
    page=await reopen(ctx,page);assert.equal((await wallet(page)).souls,bank.souls-3);
    d=await saved(page);assert.equal(d.world.guardian.hp,2);assert.equal(d.run.reviveUsed,true);
    await resume(page);await waitFor('dead');
    assert.equal(await saved(page),null);
    assert.equal(await page.evaluate(()=>localStorage.getItem('grim-run-campaign-progress-v1')),null);
    await page.locator('#retry-btn').tap();
    await page.waitForFunction(()=>grimRun.scene.scenes[0].state==='playing');
    assert.equal((await saved(page)).world.distance,0);
  }finally{await ctx.close();}
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
    // Kill the renderer of this test-owned browser directly. Chromium's
    // synthetic Page.crash command may be suppressed on a hosted runner.
    assert.deepEqual(browser.contexts().flatMap(context=>context.pages()),[page]);
    const host=await browser.newBrowserCDPSession();
    const renderers=(await host.send('SystemInfo.getProcessInfo')).processInfo.filter(p=>p.type==='renderer');
    assert.ok(renderers.length,'The isolated test browser has a renderer');
    const killed=new Set();
    for(const renderer of renderers){
      try{process.kill(renderer.id,'SIGKILL');killed.add(renderer.id);}
      catch(e){if(e.code!=='ESRCH')throw e;} // A spare renderer can exit independently.
    }
    assert.ok(killed.size>0);
    const deadline=Date.now()+10000;
    while((await host.send('SystemInfo.getProcessInfo')).processInfo.some(p=>killed.has(p.id))){
      assert.ok(Date.now()<deadline,'The killed renderer must exit before restoring the attempt');
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    await host.detach();await page.close();
    page=await ctx.newPage();await boot(page);
    await restoreForest(page);
    assert.deepEqual(comparable(await saved(page)),comparable(beforeCrash));
    // A second tab cannot take over or rewrite the attempt.
    const other=await ctx.newPage();await boot(other);await selectSavedForest(other);
    await other.getByText('FOREST IS OPEN',{exact:true}).waitFor();
    assert.equal((await saved(other)).id,beforeCrash.id);await other.close();
    await resume(page);
    await runForest(page);
    const inFight=await untilBossPhase(page,'roots',340);
    await expectScore(page,'guardian');
    page=await reopen(ctx,page);
    await expectScore(page,null);
    const restored=await saved(page);
    assert.equal(restored.world.guardian.ms,inFight.ms);
    await resume(page);
    await expectScore(page,'guardian');
    await defeatGuardian(page);
    page=await reopen(ctx,page);await resume(page);await advance(page,'frames',70);
    await playingStory(page,'passage-open.webm');
    assert.equal(await page.evaluate(()=>{
      const s=grimRun.scene.scenes[0];s.drawScene();return s.biomeBackdrops.forest.visible;
    }),true,'The clearing stays in Forest after the save is closed');
    const winBalance=await wallet(page);
    // Reload during the actual ending. The chapter and wallet were settled together.
    await boot(page);await openChapters(page);
    await page.getByRole('button',{name:'REPLAY FOREST'}).waitFor();
    assert.deepEqual(await wallet(page),winBalance);
    assert.equal(await saved(page),null);
    const progress=await page.evaluate(()=>JSON.parse(localStorage.getItem('grim-run-campaign-progress-v1')));
    assert.equal(progress.foothillsUnlocked,true);assert.equal(progress.forest.attempt,bought.id);
    assert.equal(await page.locator('#campaign-secondary').innerText(),'START FOOTHILLS');
    assert.equal(await page.locator('#campaign-secondary').isEnabled(),true);
    await page.locator('#campaign-primary').tap();
    await page.waitForFunction(()=>grimRun.scene.scenes[0].state==='playing');
    await page.evaluate(()=>{const s=grimRun.scene.scenes[0];s.takeDamage(s.player.hp,'rock');});
    await advance(page,'frames',180);
    await page.locator('#revive-no-btn').tap();
    assert.equal(await saved(page),null);
    assert.equal((await wallet(page)).souls,4+Number(bought.run.soulCount)+3);
    console.log('Merchant, renderer crash, exclusive tab, guardian victory, unlock and declined revival passed.');
  }finally{await ctx.close();}
}
async function saveRecovery(browser){
  const ctx=await browser.newContext({viewport:{width:844,height:390},hasTouch:true});
  try{
    let page=await ctx.newPage();
    await boot(page);await start(page);
    // Acquire a held jump again after reload without spending a second jump.
    await page.evaluate(()=>{grimRun.scene.scenes[0].powerManager.levels.ravenWings=1;
      grimRun.scene.scenes[0].powerManager.levels.skeletalWings=1;});
    const sessions=new WeakMap();
    const touch=async(page,type)=>{
      if(!sessions.has(page))sessions.set(page,await ctx.newCDPSession(page));
      const box=await page.locator('#jump-btn').boundingBox();
      await sessions.get(page).send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:
        [{x:box.x+box.width/2,y:box.y+box.height/2,id:1}]});
    };
    await touch(page,'touchStart');await advance(page,'frames',3);
    const held=await saved(page);
    page=await reopen(ctx,page);await resume(page);await touch(page,'touchStart');
    const jump=await saved(page);
    assert.equal(held.world.player.jumpHeld,true);
    assert.equal(jump.world.player.jumpsUsed,held.world.player.jumpsUsed);
    assert.equal(jump.world.player.velocityY,held.world.player.velocityY);
    await touch(page,'touchEnd');
    assert.equal((await saved(page)).world.player.jumpHeld,false);
    await page.locator('#pause-btn').tap();
    await page.locator('#quit-btn').tap();
    await page.locator('#abandon-confirm-btn').tap();
    await page.getByRole('button',{name:'CAMPAIGN',exact:true}).tap();
    await page.getByRole('button',{name:'START FOREST'}).tap();
    await page.waitForFunction(()=>grimRun.scene.scenes[0].state==='playing');
    // Stop between the single authoritative wallet write and its transfer to the fast frame slot.
    await advance(page,'meters',205);await page.locator('#attack-btn').tap();
    await page.evaluate(()=>{
      const set=Storage.prototype.setItem;
      Storage.prototype.setItem=function(k,v){
        if(k==='grim-run-forest-attempt-v1'&&JSON.parse(localStorage.getItem(GRIM_META.KEY)||'{}').forestRecovery)
          throw new DOMException('Injected interruption','QuotaExceededError');
        return set.call(this,k,v);
      };
      const s=grimRun.scene.scenes[0],draw=s.drawScene;s.drawScene=()=>{};
      try{for(let i=0;i<200&&!s.campaign.frozen;i++)s.update(0,1000/60);}finally{s.drawScene=draw;}
    });
    const journal=await page.evaluate(()=>JSON.parse(localStorage.getItem(GRIM_META.KEY)));
    assert.ok(journal.forestRecovery);assert.equal(journal.brambleSouls,1);
    page=await reopen(ctx,page);
    assert.equal((await wallet(page)).souls,journal.souls);
    assert.equal((await saved(page)).run.brambleSoulClaimed,true);
    await resume(page);await advance(page,'meters',255);
    assert.equal((await wallet(page)).souls,journal.souls);
    // Restore a ready Rewind, including history, after changing orientation.
    await page.evaluate(()=>{
      const s=grimRun.scene.scenes[0];s.powerManager.levels.deathsReversal=1;
      s.player.invulMs=20000;
    });
    await advance(page,'frames',355);
    const w=await saved(page);assert.ok(w.history.length>49);
    await page.close();
    page=await ctx.newPage();await page.setViewportSize({width:390,height:844});await boot(page);
    await restoreForest(page);
    assert.equal((await saved(page)).history.length,w.history.length);
    await resume(page);await page.locator('#rewind-btn').tap();await advance(page,'frames',8);
    assert.equal((await saved(page)).mode,'rewinding');
    const rewind=await saved(page);
    await page.close();page=await ctx.newPage();await page.setViewportSize({width:390,height:844});await boot(page);
    await restoreForest(page);
    assert.equal((await saved(page)).playback.elapsedMs,rewind.playback.elapsedMs);
    await resume(page);await advance(page,'frames',115);
    assert.equal((await saved(page)).mode,'playing');
    assert.ok((await saved(page)).run.rewindCooldownMs>0);
    console.log('Atomic credit recovery, cross-orientation Rewind history and mid-playback reload passed.');

  }finally{await ctx.close();}
}
async function defeatStoneGuardian(page){
  for(let round=0;round<3;round++){
    await untilBossPhase(page,'ridge',820);await holdControl(page,'jump',33);
    await untilBossPhase(page,'draw',810);await holdControl(page,'slide','drag');
    await untilBossPhase(page,'drag',280);await page.locator('#attack-btn').tap();
    await untilBossPhase(page,round===2?'fall':'struck');
  }
}

async function foothillsClear(browser,viewport,seed,earnUnlock){
  const ctx=await browser.newContext({viewport,hasTouch:true});
  const attempt=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('grim-run-foothills-attempt-v1')));
  const restore=async page=>{
    const expected=await attempt(page);
    await page.close();
    const next=await ctx.newPage();await boot(next);await openChapters(next);
    await next.getByRole('button',{name:'RESUME FOOTHILLS'}).tap();
    await next.waitForFunction(()=>grimRun.scene.scenes[0].state==='paused');
    assert.deepEqual(comparable(await attempt(next)),comparable(expected));
    await resume(next);return next;
  };
  try{
    url.searchParams.set('seed',String(seed));
    let page=await ctx.newPage();await boot(page);
    if(earnUnlock){
      await reachGuardian(page);await defeatGuardian(page);await advance(page,'frames',70);
      await playingStory(page,'passage-open.webm');await page.locator('#forest-story-skip').tap();
      await page.getByRole('button',{name:'CHAPTERS',exact:true}).tap();
    }else{
      // Model the unlocked record written by the previous live release.
      await page.evaluate(()=>localStorage.setItem(GRIM_META.CAMPAIGN_PROGRESS,
        JSON.stringify({forest:{cleared:true,attempt:'prior-forest',bonus:3,bonusTotal:3},foothillsUnlocked:true})));
      await openChapters(page);
    }
    await page.getByRole('button',{name:'START FOOTHILLS'}).tap();
    await page.waitForFunction(()=>grimRun.scene.scenes[0].state==='playing');
    assert.equal((await attempt(page)).chapter,'foothills');
    await expectScore(page,'climb');
    assert.ok(await audibleMusic(page));
    await advance(page,'frames',8);
    await holdControl(page,'jump',5);
    const airborne=await attempt(page);assert.equal(airborne.world.player.grounded,false);
    page=await restore(page);
    await touchApproach(page);
    assert.equal((await attempt(page)).mode,'vendorIntro');
    await page.locator('#vendor-intro-skip').tap();await page.getByRole('button',{name:'CONTINUE RUN'}).tap();
    await touchApproach(page);
    const arrival=await attempt(page);
    assert.equal(arrival.world.guardian.phase,'arrival');assert.equal(arrival.world.player.hp,3);
    assert.ok(Object.values(arrival.run.runLoadout.levels).every(n=>n===0));
    assert.deepEqual(await page.evaluate(()=>{
      const s=grimRun.scene.scenes[0];
      return [s.biomeBackdrops.foothills.visible,s.obstacleBiomeFor(s.player),s.gunUnlocked,s.hasTeleported];
    }),[true,'foothills',false,false]);
    await expectScore(page,'pursuit');assert.ok(await audibleMusic(page));
    await untilBossPhase(page,'ridge',150);
    page=await restore(page);
    const start=await attempt(page);
    await defeatStoneGuardian(page);
    const end=await attempt(page),total=end.world.elapsed+1.1;
    assert.equal(end.world.player.hp,3);assert.ok(end.world.distance-start.world.distance>300);
    assert.ok(total>=300&&total<=360);
    const balance=(await wallet(page)).souls;
    await advance(page,'frames',75);
    await page.getByText('FOOTHILLS CLEARED',{exact:true}).waitFor();
    assert.equal((await wallet(page)).souls,balance+3);
    await boot(page);await openChapters(page);
    await page.getByRole('button',{name:'REPLAY FOOTHILLS'}).waitFor();
    await page.getByRole('button',{name:'START TUNDRA'}).waitFor();
    assert.match(await page.locator('#campaign-detail').innerText(),/Tundra is unlocked/);
    assert.equal(await attempt(page),null);
    assert.equal((await wallet(page)).souls,balance+3);
    await page.getByRole('button',{name:'REPLAY FOOTHILLS'}).tap();
    await page.waitForFunction(()=>grimRun.scene.scenes[0].state==='playing');
    const retry=await attempt(page);
    assert.notEqual(retry.id,start.id);assert.equal(retry.world.distance,0);
    console.log('Foothills touch clear',seed,viewport,'approach',arrival.world.elapsed.toFixed(2),
      'total',total.toFixed(2),'HP',end.world.player.hp,'ordinary Souls',end.run.soulCount);
    if(earnUnlock){
      // Fail the approach, decline the offer, then retry this chapter at zero metres.
      await page.evaluate(()=>{const s=grimRun.scene.scenes[0];s.takeDamage(s.player.hp,'rock');});
      await advance(page,'frames',180);await page.locator('#revive-no-btn').tap();
      assert.equal(await attempt(page),null);
      await page.getByRole('button',{name:'RETRY FOOTHILLS'}).tap();
      await page.waitForFunction(()=>grimRun.scene.scenes[0].state==='playing');
      const fresh=await attempt(page);assert.equal(fresh.world.distance,0);assert.notEqual(fresh.id,retry.id);
      await page.locator('#pause-btn').tap();await page.locator('#campaign-save-menu').tap();
      await page.getByRole('button',{name:'ENDLESS',exact:true}).tap();
      await page.waitForFunction(()=>grimRun.scene.scenes[0].state==='playing');
      assert.deepEqual(await page.evaluate(()=>{
        const s=grimRun.scene.scenes[0];return [s.campaign.active,s.forestRoute,s.gunUnlocked,s.obstacleBiomeFor(s.player)];
      }),[false,null,false,'forest']);
      assert.equal((await attempt(page)).id,fresh.id);
      await boot(page);await openChapters(page);
      await page.getByRole('button',{name:'START TUNDRA'}).tap();
      await page.getByRole('button',{name:'SKIP',exact:true}).tap();
      assert.equal(await page.locator('#crossbow-btn').isVisible(),true);
    }else{
      // Revisit the fight, try wrong inputs, buy a same-attempt revival and finish.
      await runForest(page);
      await page.locator('#vendor-intro-skip').tap();await page.getByRole('button',{name:'CONTINUE RUN'}).tap();
      await runForest(page);
      await untilBossPhase(page,'ridge',40);await holdControl(page,'jump',3);
      await untilBossPhase(page,'pace');assert.equal((await attempt(page)).world.player.hp,2);
      await untilBossPhase(page,'drag',300);await holdControl(page,'slide',3);
      assert.equal((await attempt(page)).world.player.hp,1);
      await untilBossPhase(page,'recover',250);await page.locator('#attack-btn').tap();
      assert.equal((await attempt(page)).world.guardian.hp,3);
      const before=(await wallet(page)).souls;
      await advance(page,'frames',275);await page.locator('#revive-yes-btn').tap();
      const paid=await attempt(page);assert.equal(paid.run.reviveUsed,true);assert.equal(paid.id,retry.id);
      assert.equal((await wallet(page)).souls,before-3);
      page=await restore(page);
      await page.evaluate(()=>{const s=grimRun.scene.scenes[0];for(let i=0;i<400&&s.state!=='playing';i++)s.update(0,1000/60);});
      await defeatStoneGuardian(page);await advance(page,'frames',75);
      await page.getByText('FOOTHILLS CLEARED',{exact:true}).waitFor();
      assert.equal((await wallet(page)).souls,before-3+1);
    }
  }finally{url.searchParams.set('seed','33');await ctx.close();}
}

async function tundraClear(browser,viewport,seed){
  const ctx=await browser.newContext({viewport,hasTouch:true});
  const attempt=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('grim-run-tundra-attempt-v1')));
  let page=await ctx.newPage();
  const restore=async()=>{
    const before=await attempt(page);
    await page.close();page=await ctx.newPage();await boot(page);await openChapters(page);
    await page.getByRole('button',{name:'RESUME TUNDRA'}).tap();
    await page.waitForFunction(()=>grimRun.scene.scenes[0].state==='paused');
    assert.deepEqual(comparable(await attempt(page)),comparable(before));
    await resume(page);
  };
  try{
    url.searchParams.set('seed',String(seed));await boot(page);
    await page.evaluate(()=>localStorage.setItem(GRIM_META.CAMPAIGN_PROGRESS,JSON.stringify({
      forest:{cleared:true},foothills:{cleared:true,bonusTotal:3},foothillsUnlocked:true,tundraUnlocked:true})));
    await openChapters(page);await page.getByRole('button',{name:'START TUNDRA'}).tap();
    await page.getByRole('button',{name:'SKIP',exact:true}).tap();
    await expectScore(page,'crossing');assert.ok(await audibleMusic(page));
    await advance(page,'meters',48);
    assert.ok((await attempt(page)).world.player.wispMs>0);
    await page.locator('#crossbow-btn').tap();
    const shot=await attempt(page);assert.equal(shot.world.bullets.at(-1).kind,'frost');
    await restore();await advance(page,'frames',20);
    assert.equal((await attempt(page)).world.player.wispMs,null);
    await touchApproach(page);await page.locator('#vendor-intro-skip').tap();
    await page.getByRole('button',{name:'CONTINUE RUN'}).tap();await touchApproach(page);
    const arrival=await attempt(page);
    assert.equal(arrival.world.guardian.phase,'arrival');assert.equal(arrival.world.player.hp,3);
    assert.ok(Object.values(arrival.run.runLoadout.levels).every(n=>n===0));
    await expectScore(page,'crown');assert.ok(await audibleMusic(page));
    assert.deepEqual(await page.evaluate(()=>{
      const s=grimRun.scene.scenes[0];
      return [s.biomeBackdrops.tundra.visible,s.campaign.encounter.carving?.visible,s.portalSummitArt.sky.visible];
    }),[true,true,false]);
    await untilBossPhase(page,'warning',210);await restore();
    // Shoot before exposure and let the first low wave pass without jumping.
    await page.locator('#crossbow-btn').tap();await untilBossPhase(page,'open',70);
    assert.equal((await attempt(page)).world.player.hp,2);
    assert.equal((await attempt(page)).world.guardian.hp,3);
    await restore();await untilBossPhase(page,'recover',20);
    await page.locator('#crossbow-btn').tap(); // late shot misses the closed core
    const durations=await page.evaluate(()=>{
      const s=grimRun.scene.scenes[0],times=[];
      for(let i=0;i<60;i++){const start=performance.now();s.update(0,1000/60);times.push(performance.now()-start);}
      return times.sort((a,b)=>a-b);
    });
    for(let hit=0;hit<3;hit++){
      const b=await untilBossPhase(page,'warning',965);
      await holdControl(page,b.cycle%2?'slide':'jump',30);
      await untilBossPhase(page,'open',150);await page.locator('#crossbow-btn').tap();
      await untilBossPhase(page,hit===2?'fall':'struck');
    }
    const win=await attempt(page),balance=(await wallet(page)).souls;
    assert.equal(win.world.player.hp,2);assert.equal(win.powers.powerShot||0,0);
    assert.ok(win.world.elapsed>=335&&win.world.elapsed<=385);
    await advance(page,'frames',75);await page.getByText('TUNDRA CLEARED',{exact:true}).waitFor();
    assert.equal((await wallet(page)).souls,balance+3);
    assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem(GRIM_META.CAMPAIGN_PROGRESS)).cavesUnlocked));
    await boot(page);await openChapters(page);
    assert.equal((await wallet(page)).souls,balance+3);
    await page.getByRole('button',{name:'REPLAY TUNDRA'}).tap();
    await page.waitForFunction(()=>grimRun.scene.scenes[0].state==='playing');
    assert.equal((await attempt(page)).world.distance,0);
    console.log('Tundra touch clear',seed,viewport,'seconds',win.world.elapsed.toFixed(2),
      'boss update + draw p95 ms',durations[56].toFixed(2),'max',durations.at(-1).toFixed(2));
    if(viewport.width<viewport.height){
      const id=(await attempt(page)).id;
      await touchApproach(page);await page.locator('#vendor-intro-skip').tap();
      await page.getByRole('button',{name:'CONTINUE RUN'}).tap();await touchApproach(page);
      const before=(await wallet(page)).souls;
      await page.evaluate(()=>{const s=grimRun.scene.scenes[0];s.takeDamage(s.player.hp,'ice wave');});
      await advance(page,'frames',175);await page.locator('#revive-yes-btn').tap();
      assert.equal((await wallet(page)).souls,before-3);
      await restore();assert.equal((await attempt(page)).id,id);
      assert.ok((await attempt(page)).run.reviveUsed);await advance(page,'frames',310);
      for(let i=0;i<3;i++){
        const b=await untilBossPhase(page,'warning',965);
        await holdControl(page,b.cycle%2?'slide':'jump',30);await untilBossPhase(page,'open',100);
        await page.locator('#crossbow-btn').tap();
        await untilBossPhase(page,i===2?'fall':'struck');
      }
      // Close after the progress write and before cleanup. The wallet reconciles once.
      await page.evaluate(()=>{
        const remove=Storage.prototype.removeItem;
        Storage.prototype.removeItem=function(key){
          if(key==='grim-run-tundra-attempt-v1')throw Error('simulated interrupted cleanup');
          return remove.call(this,key);
        };
      });
      await advance(page,'frames',75);await page.getByText('TUNDRA CLEAR PENDING',{exact:true}).waitFor();
      await boot(page);await openChapters(page);await page.getByRole('button',{name:'REPLAY TUNDRA'}).waitFor();
      assert.equal((await wallet(page)).souls,before-3+1);
    }else{
      // An equipped Death Denied is evaluated on a fresh start, before paid revival.
      await page.locator('#pause-btn').tap();await page.locator('#campaign-save-menu').tap();
      await page.evaluate(()=>{
        const m=GRIM_META.load();m.levels.deathDenied=1;m.equipped=['deathDenied'];GRIM_META.save(m);
      });
      await page.getByRole('button',{name:'CAMPAIGN',exact:true}).tap();
      await page.getByRole('button',{name:'RESUME TUNDRA'}).tap();await resume(page);
      await page.evaluate(()=>{const s=grimRun.scene.scenes[0];s.takeDamage(s.player.hp,'ice wave');});
      await advance(page,'frames',175);await page.locator('#revive-no-btn').tap();
      assert.equal(await attempt(page),null);
      await page.getByRole('button',{name:'RETRY TUNDRA'}).tap();
      await page.waitForFunction(()=>grimRun.scene.scenes[0].state==='playing');
      const fresh=await attempt(page);assert.equal(fresh.world.distance,0);assert.equal(fresh.run.freeLifeAvailable,true);
      await page.evaluate(()=>{const s=grimRun.scene.scenes[0];s.takeDamage(s.player.hp,'frost wisp');});
      await advance(page,'frames',175);const free=await attempt(page);
      assert.equal(free.id,fresh.id);assert.ok(free.run.freeLifeUsed);assert.equal(free.run.reviveUsed,false);
      await restore();assert.ok((await attempt(page)).run.freeLifeUsed);
    }
  }finally{url.searchParams.set('seed','33');await ctx.close();}
}

(async()=>{
  if(!process.env.GRIM_BASE_URL){
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    url.port=String(server.address().port);
  }
  const browser=await chromium.launch({executablePath:process.env.GRIM_CHROME||undefined,
    args:[...(renderer==='canvas'?['--disable-webgl']:[]),'--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
  try{
    if(process.argv.includes('--tundra')){
      await tundraClear(browser,{width:390,height:844},17);
      await tundraClear(browser,{width:844,height:390},91);
      return;
    }
    if(process.argv.includes('--foothills')){
      await foothillsClear(browser,{width:390,height:844},91,false);
      await foothillsClear(browser,{width:844,height:390},33,true);
      return;
    }
    for(const viewport of [{width:844,height:390},{width:390,height:844}]){
      const a=await matched(browser,viewport,false),b=await matched(browser,viewport,true);
      assert.deepEqual(a,b);console.log('Matched jump, Cut and landing:',viewport,a.outcome.world.distance);
    }
    await openingStory(browser);
    await transactions(browser);
    console.log('Forest pickup, revivals, retry, loadout and Endless passed.');
    await merchantAndInterruption(browser);
    await saveRecovery(browser);
    await freshClear(browser,{width:844,height:390},33);
    await freshClear(browser,{width:390,height:844},91);
    await guardianRevivals(browser);
    await originalAttempt(browser);
    console.log('Scythe-only clears, interrupted victory, missed counters and both boss revivals passed.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
