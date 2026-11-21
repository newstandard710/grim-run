const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const dir=path.resolve(process.env.LANDING_RESULTS||'test-results/landing');
fs.mkdirSync(dir,{recursive:true});
const roots={before:path.resolve(process.env.LANDING_BASELINE),after:path.resolve(__dirname,'..')};
const types={'.js':'text/javascript','.html':'text/html','.webp':'image/webp','.png':'image/png','.ttf':'font/ttf','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{const [,version,...rest]=new URL(req.url,'http://x').pathname.split('/');if(!roots[version])return res.writeHead(404).end();
 const file=path.join(roots[version],rest.join('/')||'index.html');if(!fs.existsSync(file))return res.writeHead(404).end();res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
const routes=[
 {id:'flat',m:20,short:1},{id:'otherFoot',m:28,short:1},{id:'full',m:12},{id:'up',m:2515,short:1},{id:'down',m:2586,short:1},
 {id:'seed78',x:47568.84974368973,short:4},{id:'held',m:20,short:1,press:3,releaseAfter:170},
 {id:'latched',m:20,short:1,latch:true},{id:'release',m:20,short:1,press:3,releaseFraction:.61},
 {id:'lateRelease',m:20,short:1,press:3,releaseFraction:.94},{id:'platform',platform:true},
 ...['jump','slide','cut','shoot'].map(action=>({id:action,m:12,short:1,interrupt:action}))];
const rates={hz30:[1000/30],hz60:[1000/60],hz120:[1000/120],uneven:[11,33,8,53,17]};
function setup({route,rate,landingAt}){
 const g=grimRun,s=g.scene.scenes[0],C=GRIM_CONFIG,Core=GRIM_CORE;
 s.startRun();s.ui.setMode('playing');s.state='playing';g.loop.sleep();clearInterval(s.loopWatchdogId);s.sys.sceneUpdate=()=>{};
 s.obstacles=[];s.enemies=[];s.souls=[];s.coins=[];s.shrineClaimed=true;s.nextVendorNumber=15;
 const p=s.player,platform=s.soulPlatform[0],x=route.platform?platform.x-40:route.x??s.startX+route.m*C.pxPerMeter;
 s.distance=(x-s.startX)/C.pxPerMeter;s.speed=Core.runSpeed(s.distance);
 s.nextEncounterX=s.nextGroundSpawnX=s.nextEnemySpawnX=s.nextSnapSpawnX=x+1e5;
 Object.assign(p,{x,y:s.terrain.groundAt(x),grounded:true,onSoulPlatform:false});
 s.cameraX=x-s.width*C.reaperXRatio;s.cameraY=p.y-s.groundY;s.syncWorldScroll();
 // Intercept the real one-way ledge from above and cross its left edge in flight.
 if(route.platform){p.y=platform.y-44;p.grounded=false;p.jumpAgeMs=320;p.velocityY=95;s.cameraY=platform.y-s.groundY;}
 if(route.interrupt==='shoot'){s.gunUnlocked=true;s.gunCooldownMs=0;}
 s.drawScene();g.step(performance.now(),0);
 if(route.latch){s.startSlide();s.endSlide();}
 if(!route.platform)s.jump();
 let clock=0,contact=-1,tick=0,interrupted=false,released=false;
 window.qaStep=()=>{
   const delta=rate[tick%rate.length];
   if(route.short===tick)s.jumpEnd();if(route.press===tick)s.startSlide();
   if(!released&&route.releaseFraction&&clock>=landingAt*route.releaseFraction){s.endSlide();released=true;}
   if(!released&&contact>=0&&route.releaseAfter&&clock-contact>=route.releaseAfter){s.endSlide();released=true;}
   if(contact>=0&&!interrupted&&route.interrupt){
     if(route.interrupt==='jump')s.jump();if(route.interrupt==='slide')s.startSlide();
     if(route.interrupt==='cut')s.attack();if(route.interrupt==='shoot')s.fireCrossbow();
     interrupted=true;
   }
   s.update(0,delta);
   clock+=Math.min(delta,34);tick++;
   if(contact<0&&p.grounded)contact=clock;
   const m=s.motionArt,low=s.slideArt.sprite,v=low?.visible?low:m.body[0],w=m.weapon;
   return {clock,contact,tick,x:p.x,y:p.y,vy:p.velocityY,ground:s.terrain.groundAt(p.x),platform:p.onSoulPlatform,grounded:p.grounded,low:s.lowProfile,
    jumps:p.jumpsUsed,air:p.airJumpUsed,attack:p.attackMs,gun:s.gunCooldownMs,shots:s.bullets.length,box:Core.collisionBox(p.x,p.y,s.lowProfile),camera:[s.cameraX,s.cameraY],
    key:v?.visible?v.texture.key:null,frame:v?.visible?Number(v.frame.name):null,sprite:v?.visible?[v.x,v.y]:null,
    w:w.visible?[w.x,w.y,w.rotation]:null,entry:p.visualTouchdown?.source??null,flight:s.landingArt?.approach?.source??null,
    action:!!m.rising?.sprite?.visible||s.combatArt?.reaper?.some(v=>v.visible)||false};
 };
}
async function open(browser,ver,viewport){
 const page=await browser.newPage({viewport,deviceScaleFactor:1,hasTouch:true});page.on('pageerror',e=>{throw e;});
 await page.goto('http://127.0.0.1:'+server.address().port+'/'+ver+'/?seed=78',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(v=>{const s=window.grimRun?.scene.scenes[0],m=s?.motionArt;return m?.airReady&&m.airCutReady&&m.forwardReady&&m.rising&&s.textures.exists('ground-slide-paint')&&(v==='before'||s.landingArt?.ready)},ver,{timeout:90000});
 return page;
}
async function trace(page,route,rate,landingAt,max=260){
 await page.evaluate(setup,{route,rate,landingAt});
 return page.evaluate(max=>{let rows=[];for(let i=0;i<max;i++){let row=qaStep();rows.push(row);if(row.contact>=0&&row.clock-row.contact>=490)break;}return rows},max);
}
function signature(rows){return rows.map(({key,frame,sprite,w,entry,flight,action,...state})=>state)}
async function scenarios(page,ver,selection){
 const timing={};for(const [rk,rate] of Object.entries(selection)){timing[rk]={};for(const route of routes){
 let landingAt=0;if(route.releaseFraction)landingAt=(await trace(page,{...route,releaseFraction:null},rate,0)).at(-1).contact;
 const rows=await trace(page,route,rate,landingAt);
 assert(rows.at(-1).contact>0,route.id+' no contact');if(route.platform)assert(rows.some(r=>r.platform===0),'one-way platform missed');
 const at=rows.findIndex(r=>r.grounded);
 if(ver==='after'){
   if(!rows.some(r=>r.key?.includes('landing')))throw Error('Candidate art absent '+route.id+'/'+rk);
   if(route.id==='jump')assert(!rows[at+1].grounded,'re-jump');
   if(route.id==='cut')assert(rows[at+1].attack>0,'Cut');
   if(route.id==='slide')assert(rows[at+1].low,'Slide');
   if(route.id==='shoot')assert(rows[at+1].shots>0,'Shoot');}
 timing[rk][route.id]=rows;
 }}return timing;
}
async function film(page,route,ver){
 const rate=rates.hz60;
 const held=route.releaseFraction?(await trace(page,{...route,releaseFraction:null},rate,0)).at(-1).contact:0;
 const probe=await trace(page,route,rate,held);
 const ct=probe.at(-1).contact;
 await page.evaluate(setup,{route,rate,landingAt:held});
 const output=path.join(dir,'frames',route.id,ver);
 fs.mkdirSync(output,{recursive:true});
 const n=probe.findIndex(r=>r.clock>ct+445);
 for(let i=0;i<(n<0?probe.length:n);i++){
   const pixels=await page.evaluate(()=>{
     const s=grimRun.scene.scenes[0];qaStep();grimRun.step(performance.now(),0);
     // Same camera rectangle for both revisions, including the original
     // downhill offset. Crop around the camera lane, never the drawn sprite.
     const canvas=grimRun.canvas,c=document.createElement('canvas');c.width=368;c.height=292;
     const left=Math.round(s.width*GRIM_CONFIG.reaperXRatio)-178;
     const top=Math.round(s.groundY)-221;
     c.getContext('2d').drawImage(canvas,left,top,c.width,c.height,0,0,c.width,c.height);
     return c.toDataURL('image/jpeg',.91).split(',')[1];
   });
   fs.writeFileSync(path.join(output,String(i).padStart(3,'0')+'.jpg'),Buffer.from(pixels,'base64'));
 }
}
async function performanceProbe(page,ver){
 const series=[];
 for(let pass=0;pass<3;pass++){
   await page.evaluate(setup,{route:routes[0],rate:rates.hz60,landingAt:0});
   series.push(await page.evaluate(async()=>{
     const s=grimRun.scene.scenes[0],cpu=[],gap=[];let prev,landings=0;
     for(let i=0;i<178;i++){
       const now=await new Promise(requestAnimationFrame);
       const start=performance.now(),wasGround=s.player.grounded;
       if(wasGround&&i%39===0)s.jump();
       if(i%39===3)s.jumpEnd();
       s.update(0,1000/60);grimRun.step(performance.now(),0);
       if(!wasGround&&s.player.grounded)landings++;
       if(i>=36){cpu.push(performance.now()-start);gap.push(now-prev);}
       prev=now;
     }
     return {cpu,gap,landings};
   }));
 }
 const quantile=(list,p)=>[...list].sort((a,b)=>a-b)[Math.floor((list.length-1)*p)];
 const report={revision:ver,landings:series.reduce((n,v)=>n+v.landings,0)};
 for(const k of ['gap','cpu']){
   const list=series.flatMap(v=>v[k]);report[k]={n:list.length,median:quantile(list,.5),p95:quantile(list,.95),p99:quantile(list,.99),over50:list.filter(v=>v>50).length};
 }
 return report;
}
module.exports={setup,server,routes,rates,trace,open,chromium,dir};
if(require.main===module)(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const renderer=process.argv[2]||'canvas',width=Number(process.argv[3]||844),height=Number(process.argv[4]||390);
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox','--disable-dev-shm-usage',...(renderer==='canvas'?['--disable-webgl']:['--use-angle=swiftshader','--enable-unsafe-swiftshader'])]});
 try{let original;for(const ver of ['before','after']){
  const page=await open(browser,ver,{width,height});const rendererType=await page.evaluate(()=>grimRun.renderer.type);assert.equal(rendererType,renderer==='canvas'?1:2);console.log('READY',ver,renderer,width,height);
  const result=await scenarios(page,ver,process.argv.includes('quick')?{hz60:rates.hz60}:rates);
  fs.writeFileSync(path.join(dir,ver+'-'+renderer+'-'+width+'.json'),JSON.stringify(result));
  if(ver==='before')original=result;
  else for(const rk in result)for(const id in result[rk])assert.deepEqual(signature(result[rk][id]),signature(original[rk][id]),id+'/'+rk);
  if(renderer==='canvas'&&width===844)for(const route of routes.filter(v=>['flat','up','down','held','latched','lateRelease','release','platform'].includes(v.id)))await film(page,route,ver);
  const cost=await performanceProbe(page,ver);fs.writeFileSync(path.join(dir,ver+'-cost.json'),JSON.stringify(cost));console.log('PERFORMANCE',JSON.stringify(cost));
  await page.close();}console.log('PARITY PASS',width,height,renderer);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
