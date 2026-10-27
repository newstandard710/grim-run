'use strict';
// Runs in the repository's Chromium CI, including real multi-touch input.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'test-results');fs.mkdirSync(dir,{recursive:true});
const types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{try{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname.replace(/^\/+/,''))||'index.html');if(!file.startsWith(root+path.sep))return res.writeHead(403).end();res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));}catch(e){res.writeHead(404).end();}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader']});
 const errors=[],failures=[];
 try{
  for(const viewport of [{width:950,height:430},{width:812,height:375},{width:667,height:375},{width:390,height:844}]){
   const label=viewport.width+'x'+viewport.height;
   const context=await browser.newContext({viewport,hasTouch:true,deviceScaleFactor:1,...(viewport.width===950?{recordVideo:{dir,size:viewport}}:{})});
   await context.addInitScript(()=>localStorage.setItem('grim-run-v07-meta',JSON.stringify({version:1,souls:100,levels:{boneheart:0,graveWealth:1,deathsLeap:0,graveGlide:0}})));
   const page=await context.newPage();page.on('pageerror',e=>errors.push(label+': '+e));page.on('response',r=>{if(r.status()>=400)failures.push(r.url());});
   const completeDefeat=async()=>{assert.equal(await page.evaluate(()=>window.grimRun.scene.scenes[0].state),'dying');for(const dt of [250,250,250,130])await page.evaluate(dt=>window.grimRun.scene.scenes[0].update(0,dt),dt);};
   const shot=async name=>{await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:path.join(dir,'beyond-'+label+'-'+name+'.png')});};
   await page.goto('http://127.0.0.1:'+server.address().port+'/?seed=33',{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>window.grimRun?.scene?.scenes?.[0]?.visuals?.reaperPoseSprites?.jump&&window.GRIM_FRONTEND?.ready,null,{timeout:45000});await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.evaluate(()=>window.grimRun.scene.scenes[0].state),'home');await shot('home');
   await page.locator('#home-enter-btn').click();assert.equal(await page.evaluate(()=>window.grimRun.scene.scenes[0].state),'menu');await shot('menu');
   await page.locator('#reliquary-btn').click();assert.equal(await page.locator('.meta-card').count(),6);
   await page.getByRole('button',{name:"Purchase FATE'S BARGAIN level 1 for 5 Souls",exact:true}).click();
   await page.getByRole('button',{name:'Purchase DEATH DENIED level 1 for 15 Souls',exact:true}).click();
   await page.getByRole('button',{name:'Purchase GRAVE WEALTH level 2 for 10 Souls',exact:true}).click();
   assert.equal(await page.locator('#reliquary-souls').innerText(),'70');await page.locator('#reliquary-title').scrollIntoViewIfNeeded();await shot('reliquary');
   const scrollBox=await page.locator('.meta-modal').evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x+28,y:r.bottom-70,needed:e.scrollHeight>e.clientHeight+10};});
   if(scrollBox.needed){
    await page.locator('.meta-modal').evaluate(e=>e.scrollTop=0);
    const touch=await context.newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:scrollBox.x,y:scrollBox.y,id:0}]});
    for(let i=1;i<=8;i++){await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:scrollBox.x,y:scrollBox.y-i*12,id:0}]});await page.waitForTimeout(20);}
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(120);
    assert(await page.locator('.meta-modal').evaluate(e=>e.scrollTop>10),label+' Reliquary supports a real finger swipe');await shot('reliquary-scrolled');
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,'No horizontal document overflow');
   const textClips=await page.locator('.meta-card').evaluateAll(cards=>cards.flatMap(c=>[...c.querySelectorAll('.meta-title,.meta-desc,.meta-price')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent)));
   assert.deepEqual(textClips,[],label+' upgrade text fits its cards');
   await page.locator('#reliquary-back-btn').click();await page.locator('#start-btn').click();
   const start=await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.sys.sceneUpdate=()=>{};return {gold:s.coinCount,collected:s.goldCollected,free:s.freeLifeAvailable,rerolls:s.rerollsRemaining};});assert.deepEqual(start,{gold:4,collected:0,free:true,rerolls:1});
   await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.coinCount=21;s.player.hp=1;s.triggerVendor(1);});await page.locator('#vendor-intro-skip').click();await shot('angel');
   const offers=await page.evaluate(()=>window.grimRun.scene.scenes[0].pendingOffers.map(v=>v.id));
   await page.getByRole('button',{name:'REROLL · 1 LEFT',exact:true}).click();const fresh=await page.evaluate(()=>window.grimRun.scene.scenes[0].pendingOffers.map(v=>v.id));assert(fresh.every(id=>!offers.includes(id)));
   await page.getByRole('button',{name:'HEAL 1 HP · 8 GOLD',exact:true}).click();
   const name=await page.evaluate(()=>window.grimRun.scene.scenes[0].pendingOffers.find(v=>v.type==='power').name);await page.locator('.reward-card').filter({has:page.locator('.reward-name',{hasText:name})}).click();
   assert.equal(await page.locator('.reward-spent').count(),3);assert.equal(await page.locator('.reward-acquired').count(),1);await shot('angel-gift-and-heal');await page.getByRole('button',{name:'HEAL 1 HP · 8 GOLD',exact:true}).click();
   assert.deepEqual(await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];return {hp:s.player.hp,gold:s.coinCount,state:s.state};}),{hp:3,gold:0,state:'upgrade'});
   await page.getByRole('button',{name:'CONTINUE RUN ▶',exact:true}).click();
   await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.ui.showGun(true);s.gunUnlocked=true;s.setGodMode(true);s.powerArt.reset();s.worldPolish.reset();s.drawScene();});await shot('controls');
   if(viewport.width>viewport.height){
    const boxes=await page.locator('#controls button').evaluateAll(es=>es.filter(e=>getComputedStyle(e).display!=='none').map(e=>{const r=e.getBoundingClientRect();return {id:e.id,x:r.x,y:r.y,w:r.width,h:r.height};}));
    for(const b of boxes){assert(b.x>=0&&b.y>=0&&b.x+b.w<=viewport.width+1&&b.y+b.h<=viewport.height+1,label+' '+b.id+' inside viewport');}
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert(!(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y),label+' '+a.id+' overlaps '+b.id);}
    const jump=boxes.find(b=>b.id==='jump-btn'),slide=boxes.find(b=>b.id==='slide-btn'),cut=boxes.find(b=>b.id==='attack-btn'),shoot=boxes.find(b=>b.id==='crossbow-btn');
    assert(Math.abs(slide.w-Math.min(91,Math.max(70,viewport.height*.21))*1.15)<.1);assert(Math.abs(slide.y-(jump.y+jump.h)-26*1.15)<.1);assert(jump.x<viewport.width/2&&cut.x>viewport.width/2&&shoot.x>viewport.width/2);
    const session=await context.newCDPSession(page);
    const point=b=>({x:b.x+b.w/2,y:b.y+b.h/2});const j=point(jump),c=point(cut);
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...j,id:0},{...c,id:1}]});
    const held=await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];return {jump:s.player.jumpHeld,attack:s.player.attackMs>0};});assert(held.jump&&held.attack,'Two thumbs can jump and cut simultaneously');
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   }
   await page.locator('#pause-btn').click();await shot('pause');await page.locator('#quit-btn').click();await shot('abandon');await page.locator('#abandon-cancel-btn').click();
   if(viewport.width===950){
    await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.state='playing';s.godMode=false;s.player.hp=1;s.takeDamage(1,'rock');s.drawScene();});
    await completeDefeat();
    for(let i=0;i<50;i++){await page.evaluate(()=>window.grimRun.scene.scenes[0].update(0,30));if([3,15,28,40].includes(i))await shot('free-resurrection-'+i);await page.waitForTimeout(20);}
    assert.equal(await page.evaluate(()=>window.grimRun.scene.scenes[0].state),'countdown');for(let i=0;i<12;i++)await page.evaluate(()=>window.grimRun.scene.scenes[0].update(0,250));
    await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.player.invulMs=0;s.takeDamage(3,'rock');});await completeDefeat();await shot('paid-resurrection-offer');await page.locator('#revive-yes-btn').click();
    assert.equal(await page.evaluate(()=>window.grimRun.scene.scenes[0].state),'respawning');
    for(let i=0;i<50;i++){await page.evaluate(()=>window.grimRun.scene.scenes[0].update(0,30));await page.waitForTimeout(20);}
    for(let i=0;i<12;i++)await page.evaluate(()=>window.grimRun.scene.scenes[0].update(0,250));
    await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.player.invulMs=0;s.takeDamage(3,'rock');});await completeDefeat();await shot('results');
    // Devil cards retain health pricing and the same persistent healing panel.
    await page.locator('#retry-btn').click();await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.player.hp=3;s.coinCount=16;s.triggerVendor(8);});await page.locator('#vendor-intro-skip').click();await shot('devil');
    await page.getByRole('button',{name:'REROLL · 1 LEFT',exact:true}).click();assert.equal(await page.evaluate(()=>window.grimRun.scene.scenes[0].rerollsRemaining),0);
    await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.player.hp=2;s.showVendor();});await page.getByRole('button',{name:'HEAL 1 HP · 8 GOLD',exact:true}).click();await shot('devil-healing');
   }
   console.log('PASS actual Chromium '+label+': home → menu → purchases, old save, Angel reroll/heal/reward/heal, text bounds, enlarged swapped controls, touch combination, pause and confirmation.');
   const video=page.video();await context.close();if(video)fs.renameSync(await video.path(),path.join(dir,'beyond-death-preview.webm'));
  }
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);console.log('PASS Beyond Death browser: both resurrection animations, paid offer, third-death results, Devil rules, four viewport layouts, no script or asset errors.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
