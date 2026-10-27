'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'test-results');fs.mkdirSync(dir,{recursive:true});
const server=http.createServer((req,res)=>{try{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1))||'index.html');if(!file.startsWith(root+path.sep))return res.writeHead(403).end();res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));}catch(e){res.writeHead(404).end();}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader']});
 const context=await browser.newContext({viewport:{width:950,height:430},recordVideo:{dir,size:{width:950,height:430}}});
 const page=await context.newPage(),errors=[],failures=[];page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)failures.push(r.url());});
 const shot=async name=>{await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:path.join(dir,'combat-'+name+'.png')});};
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/?seed=33',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.GRIM_FRONTEND?.ready&&window.grimRun?.scene?.scenes?.[0]?.visuals?.reaperPoseSprites?.jump,null,{timeout:45000});
  await shot('home-bat');await page.waitForTimeout(650);await shot('home-bat-next');
  const coverage=await page.evaluate(()=>{
   const s=window.grimRun.scene.scenes[0],out={};
   for(const [name,m]of Object.entries({...window.GRIM_COMBAT_DATA.sheets,'bat-flight':window.GRIM_BAT_FLIGHT.SPEC})){
    if(!s.combatArt.ready[name])throw Error('Missing atlas '+name);
    const c=document.createElement('canvas');c.width=m.cell[0];c.height=m.cell[1];const g=c.getContext('2d');out[name]=[];
    for(let i=0;i<m.frames;i++){g.clearRect(0,0,c.width,c.height);const f=s.textures.getFrame('combat-'+name,i);g.drawImage(f.source.image,f.cutX,f.cutY,f.cutWidth,f.cutHeight,0,0,c.width,c.height);const d=g.getImageData(0,0,c.width,c.height).data;let opaque=0;for(let p=3;p<d.length;p+=4)if(d[p]>90)opaque++;out[name].push(opaque);}
   }
   return out;
  });
  for(const [name,counts]of Object.entries(coverage))assert(counts.every(n=>n>250&&n<512*512*.65),name+' has visible transparent drawings');
  await page.locator('#home-enter-btn').click();await page.locator('#start-btn').click();
  const setup=async()=>page.evaluate(()=>{
   const s=window.grimRun.scene.scenes[0],p=s.player;s.sys.sceneUpdate=()=>{};s.state='paused';s.ui.setMode('playing');
   s.combatArt.reset();s.powerArt.reset();s.obstacles=[];s.enemies=[];s.fireballs=[];s.bullets=[];s.particles=[];
   p.x=s.startX+2664*12;s.terrain.advance(p.x+1500);p.y=s.terrain.groundAt(p.x);p.grounded=true;p.onSoulPlatform=false;
   p.sliding=false;p.holdSlide=false;p.airTuck=false;p.hovering=false;p.attackMs=0;p.visualFireMs=0;p.visualHurtMs=0;p.invulMs=0;p.slowMs=0;p.velocityY=0;
   s.elapsed=3;s.distance=2664;s.cameraX=p.x-s.width*.32;s.cameraY=p.y-s.groundY;s.cameras.main.setScroll(s.cameraX,s.cameraY);
   for(const id of window.GRIM_POWERS.POWER_ORDER.concat(window.GRIM_POWERS.DEVIL_ORDER))s.powerManager.levels[id]=0;
   s.gunUnlocked=true;s.drawScene();
  });
  for(const action of ['slide-cut','soul-cleave','stand-shot','slide-shot','air-shot']){
   await setup();const frames=new Set();
   for(let i=0;i<12;i++){
    const pose=await page.evaluate(({action,i})=>{
     const s=window.grimRun.scene.scenes[0],p=s.player,progress=i/12;
     if(action==='slide-cut'){p.sliding=true;p.attackMs=260*(1-progress);}
     else if(action==='soul-cleave'){s.powerManager.levels.soulCleave=4;p.attackMs=260*(1-progress);}
     else {p.visualFireMs=260*(1-progress);p.sliding=action==='slide-shot';p.grounded=action!=='air-shot';if(!p.grounded)p.y=(s.terrain.groundAt(p.x)||s.groundY)-50;}
     s.drawScene();window.grimRun.step(performance.now(),0);
     const a=s.combatArt;return {name:a.reaperState?.name,frames:a.reaper.filter(v=>v.visible).map(v=>v.frame.name),old:Object.values(s.visuals.reaperPoseSprites).some(v=>v.visible)};
    },{action,i});
    assert(pose.name&&!pose.old,action+' exclusively displays its dedicated full-body drawings');pose.frames.forEach(f=>frames.add(Number(f)));
    if(i===5)await shot(action);await page.waitForTimeout(35);
   }
   assert(frames.size>=6,action+' visits enough distinct authored poses');
  }
  await setup();
  const effects=await page.evaluate(()=>{
   const s=window.grimRun.scene.scenes[0];s.state='playing';s.powerManager.levels.rapidFire=3;s.powerManager.levels.powerShot=3;s.powerManager.levels.chainShot=3;
   s.gunCooldownMs=0;s.fireCrossbow();const bullet={x:s.bullets[0].x,y:s.bullets[0].y};
   const first={kind:'bat',x:s.player.x+120,y:s.feetY-80,hp:3,dead:false},next={kind:'bat',x:s.player.x+240,y:s.feetY-100,hp:3,dead:false};s.enemies=[first,next];s.chainOnHit(first,1);
   s.state='paused';s.powerArt.tick(140);s.drawScene();
   return {ids:s.powerArt.bursts.map(b=>b.id),fx:s.combatArt.effects.flat().filter(v=>v.visible).length,arcs:s.chainArcs.length,bullet,muzzle:window.GRIM_COMBAT_ART.muzzle(s)};
  });
  for(const id of ['rapidFire','powerShot','chainShot'])assert(effects.ids.includes(id));assert(effects.fx>=3&&effects.arcs===1);assert.deepEqual(effects.bullet,effects.muzzle);await shot('crossbow-upgrades');
  await setup();
  const blast=await page.evaluate(()=>{
   const s=window.grimRun.scene.scenes[0];s.godMode=true;s.powerManager.levels.brittleBones=4;s.takeDamage(1,'rock');s.powerArt.tick(1200);s.drawScene();
   const bones=s.powerArt.bonePool.filter(v=>v.visible);return {count:bones.length,left:Math.min(...bones.map(v=>v.x))<s.cameraX,right:Math.max(...bones.map(v=>v.x))>s.cameraX+s.width,top:Math.min(...bones.map(v=>v.y))<s.cameraY,bottom:Math.max(...bones.map(v=>v.y))>s.cameraY+s.height};
  });
  assert(blast.count===44&&blast.left&&blast.right&&blast.top&&blast.bottom,'Brittle Bones crosses all four viewport edges');
  await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.powerArt.reset();s.takeDamage(1,'rock');s.powerArt.tick(180);s.drawScene();});await shot('brittle-bones');
  for(const kind of ['bat','skeletalBat','crawler','imp']){
   await setup();await page.evaluate(kind=>{const s=window.grimRun.scene.scenes[0],e={kind,x:s.player.x+180,y:s.feetY-90,hp:4,dead:false,mode:'glide',phase:0};s.enemies=[e];s.hitEnemy(e,1);s.combatArt.tick(80);s.drawScene();},kind);await shot(kind+'-hit');
   const dead=await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0],e=s.enemies[0];s.hitEnemy(e,4);s.enemies=s.enemies.filter(v=>!v.dead);const rng=s.rng.state;s.combatArt.tick(150);s.drawScene();return {enemies:s.enemies.length,corpses:s.combatArt.corpses.length,views:s.combatArt.responses.flat().filter(v=>v.visible).length,rng,sameRng:s.rng.state===rng};});
   assert(dead.enemies===0&&dead.corpses===1&&dead.views>0&&dead.sameRng);await shot(kind+'-defeat');
   for(let i=0;i<7;i++){await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.combatArt.tick(90);s.drawScene();});await page.waitForTimeout(45);}
   assert.equal(await page.evaluate(()=>window.grimRun.scene.scenes[0].combatArt.corpses.length),0);
  }
  await setup();await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.godMode=false;s.player.hp=3;s.takeDamage(1,'rock');s.combatArt.tick(100);s.drawScene();});await shot('reaper-hurt');
  await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.state='playing';s.player.hp=1;s.freeLifeAvailable=false;s.takeDamage(1,'rock');});
  assert.equal(await page.evaluate(()=>window.grimRun.scene.scenes[0].state),'dying');
  for(let i=0;i<8;i++){await page.evaluate(()=>window.grimRun.scene.scenes[0].update(0,100));if([1,4,7].includes(i))await shot('reaper-death-'+i);await page.waitForTimeout(65);}
  assert.equal(await page.evaluate(()=>window.grimRun.scene.scenes[0].state),'dying');await page.evaluate(()=>window.grimRun.scene.scenes[0].update(0,80));assert.equal(await page.evaluate(()=>window.grimRun.scene.scenes[0].state),'revive');
  await setup();const abyss=await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.state='playing';s.freeLifeAvailable=false;s.player.hp=1;s.player.x=s.terrain.sequences[0].startX+30;s.player.y=s.terrain.anchorAt(s.player.x)+500;s.rescueFromAbyss();s.drawScene();return {state:s.state,camera:[s.cameras.main.scrollX,s.cameras.main.scrollY],expected:[s.cameraX,s.cameraY]};});
  assert.equal(abyss.state,'dying');assert.deepEqual(abyss.camera,abyss.expected);await shot('abyss-defeat');
  for(const [kind,k]of [['angel',1],['devil',8]]){
   await setup();await page.evaluate(k=>{
    const s=window.grimRun.scene.scenes[0],p=s.player,left=s.startX+(k*666-25)*12;s.state='playing';s.hasTeleported=k>=8;s.shrineClaimed=true;s.lastVendorNumber=k-1;s.nextVendorNumber=k;s.player.hp=4;s.player.maxHp=5;s.coinCount=24;
    p.x=left-14.1;p.y=s.terrain.groundAt(p.x);p.grounded=true;s.update(0,0);
   },k);assert.equal(await page.evaluate(()=>window.grimRun.scene.scenes[0].state),'playing');
   await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.player.x+=.2;s.player.y=s.terrain.groundAt(s.player.x);s.update(0,0);});assert.equal(await page.evaluate(()=>window.grimRun.scene.scenes[0].state),'vendorIntro');await page.locator('#vendor-intro-skip').click();
   const before=await page.locator('.reward-card').evaluateAll(es=>{window._combatCards=es;return es.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height,e.querySelector('.reward-name').textContent];});});
   const target=await page.evaluate(()=>window.grimRun.scene.scenes[0].pendingOffers.find(v=>v.type==='power').name);
   await page.locator('.reward-card').filter({has:page.locator('.reward-name',{hasText:target})}).click();
   const after=await page.locator('.reward-card').evaluateAll(es=>({same:es.every((e,i)=>e===window._combatCards[i]),cards:es.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height,e.querySelector('.reward-name').textContent];}),disabled:es.every(e=>e.disabled&&e.classList.contains('reward-spent'))}));
   assert(after.same&&after.disabled);assert.deepEqual(after.cards,before,'Card positions/content stay fixed after '+kind+' purchase');assert.equal(await page.locator('.reward-acquired').count(),1);
   await shot(kind+'-purchased');await page.getByRole('button',{name:'HEAL 1 HP · 8 GOLD',exact:true}).click();assert(await page.locator('.reward-card').evaluateAll(es=>es.every((e,i)=>e===window._combatCards[i])));await shot(kind+'-healed');await page.getByRole('button',{name:'CONTINUE RUN ▶',exact:true}).click();
  }
  await setup();
  const sizes=await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];const o={type:'snappingBramble',x:s.player.x+200,y:s.feetY-70,width:62,height:70,variant:0};s.obstacles=[o];s.souls=[{x:s.player.x+90,baseY:s.feetY-140,offset:0,taken:false}];s.drawScene();const image=s.obstacleSpriteObjects.get(o);return {plant:[image.displayWidth,image.displayHeight],soul:window.GRIM_WORLD_POLISH.SOUL_HEIGHT};});
  assert(Math.abs(sizes.plant[0]-294.912)<.01&&Math.abs(sizes.plant[1]-307.2)<.01);assert.equal(sizes.soul,80.5);await shot('plant-and-soul');
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);console.log('PASS Chromium combat: decoded transparent atlases, five full-body action cycles, upgrade FX, four-edge bone blast, four enemy hit/defeat sequences, Reaper hurt/death, floor-contact entry, same-node vendor purchases/heals, 3x plants and 2x Souls.');
 }finally{const video=page.video();await context.close();if(video)fs.renameSync(await video.path(),path.join(dir,'combat-animation-preview.webm'));await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
