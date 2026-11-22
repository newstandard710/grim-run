'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require('playwright');

const root = path.join(__dirname, '..');
const oldRoot = process.env.GRIM_POLISH_BASELINE_DIR;
const output = process.env.GRIM_POLISH_OUTPUT || path.join(root, 'test-results', 'five-polishes');
const capture = Boolean(process.env.GRIM_POLISH_CAPTURE);
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png',
  '.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf'};
const server = http.createServer((request,response)=>{
  try {
    const route = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    const older = route.startsWith('/baseline/');
    const base = older && oldRoot ? path.resolve(oldRoot) : root;
    const asset = route.slice(older ? '/baseline/'.length : 1);
    const file = path.resolve(base, asset || 'index.html');
    if(!file.startsWith(base+path.sep))return response.writeHead(403).end();
    const bytes = fs.readFileSync(file);
    response.writeHead(200,{'Content-Type':mime[path.extname(file)] || 'application/octet-stream'});
    response.end(bytes);
  } catch {response.writeHead(404).end();}
});

const viewport = {width:740,height:360};
const ready = ()=>Boolean(window.grimRun?.scene.scenes[0]?.visuals?.loaded &&
  window.GRIM_FRONTEND?.ready);

async function open(browser,url,opts={}){
  const page=await browser.newPage({viewport,hasTouch:true,...opts});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  return {page,errors,url};
}
async function start({page,url}){
  await page.goto(url);
  await page.waitForFunction(ready,null,{timeout:60000});
  await page.locator('#home-enter-btn').tap();
  await page.waitForTimeout(380);
  await page.locator('#start-btn').tap();
  await page.waitForFunction(()=>window.grimRun.scene.scenes[0].state==='playing');
}
async function opening(browser,url){
  const tab=await open(browser,url);
  await tab.page.addInitScript(()=>{
    const draw=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage=function(source,...args){
      const crawler=source.src?.includes('/crawler_crawl_01_v1.png');
      const imp=source.src?.includes('/ember_imp_atlas_v1.png');
      if(this.canvas.id==='title-art'&&(crawler||imp)&&args.length===8){
        const m=this.getTransform(),[sx,sy,sw,sh,dx,dy,dw,dh]=args;
        const figure={native:m.a>0,x:m.e/this.canvas.width,y:m.f/this.canvas.height,
          width:this.canvas.width,height:this.canvas.height,paintHeight:dw*(crawler?545:175)/sw};
        if(crawler){
          const contacts=[[646,841],[1084,840]];
          if(contacts.every(([,y])=>y>=sy&&y<=sy+sh)){
            figure.feet=contacts.map(([x,y])=>{
              const localX=dx+(x-sx)*dw/sw,localY=dy+(y-sy)*dh/sh;
              return [(m.a*localX+m.c*localY+m.e)/this.canvas.width,
                (m.b*localX+m.d*localY+m.f)/this.canvas.height];
            });
            window.homeCrawler=figure;
          }
        }else window.homeImp=figure;
      }
      return draw.call(this,source,...args);
    };
  });
  const release=[];
  let held=0;
  let releaseFirstPose;
  const firstPoseGate=new Promise(resolve=>{releaseFirstPose=resolve;});
  await tab.page.route('**/reaper_run_pose_01_v1.png*',async route=>{
    await firstPoseGate;
    await route.continue();
  });
  await tab.page.route(/reaper_idle_v1|v0200\/reaper-forward-carry\.webp/,async route=>{
    held++;
    await new Promise(resolve=>release.push(resolve));
    await route.continue();
  });
  try {
    await tab.page.goto(url,{waitUntil:'domcontentloaded'});
    await tab.page.waitForFunction(()=>{
      const c=document.getElementById('title-art');
      return c.width>=600 && c.getContext('2d').getImageData(c.width*.86,c.height*.84,1,1).data[3]>100;
    },null,{timeout:20000});
    assert(held>0,'At least one boot asset is outstanding');
    assert(await tab.page.locator('#home-enter-btn').isVisible());
    const boot=await tab.page.evaluate(()=>({
      tableau:document.getElementById('frontispiece').dataset.ready||null,
      handlers:Boolean(window.grimRun?.scene.scenes[0]?.ui),
      canvas:document.getElementById('title-art').width
    }));
    assert.equal(boot.tableau,null,'The characters draw before all opening images settle');
    assert.equal(boot.handlers,false,'The opening is the existing view during the Phaser preload');
    const facing=async(portrait)=>{
      await tab.page.waitForFunction(p=>{
        const c=window.homeCrawler;
        return c&&(c.height>c.width)===p;
      },portrait);
      const c=await tab.page.evaluate(()=>window.homeCrawler);
      assert(c.native,'The original left-facing painting looks toward the Reaper');
      const planted=await tab.page.evaluate(()=>{
        const canvas=document.querySelector('#title-art'),stage=document.querySelector('#frontispiece');
        const width=canvas.clientWidth,height=canvas.clientHeight;
        const scale=Math.max(width/1672,height/941);
        const left=(width-1672*scale)*parseFloat(stage.style.getPropertyValue('--home-forest-x'))/100;
        const top=(height-941*scale)*parseFloat(stage.style.getPropertyValue('--home-forest-y'))/100;
        const tread=[[0,672],[170,674],[308,688],[493,699],[638,711],[798,722],
          [969,735],[1124,744],[1307,749],[1497,755],[1672,765]];
        return homeCrawler.feet.every(([x,y])=>{
          const sourceX=(x*width-left)/scale;
          const i=tread.findIndex(([end])=>end>=sourceX&&end>0);
          const [a,y0]=tread[i-1],[b,y1]=tread[i];
          return Math.abs(y*height-top-scale*(y0+(y1-y0)*(sourceX-a)/(b-a)))<1.5;
        });
      });
      assert(planted,'Both crawler support points follow the registered Home tread');
    };
    await facing(false);
    await tab.page.setViewportSize({width:393,height:740});
    await facing(true);
    await tab.page.setViewportSize(viewport);
    await facing(false);
    await tab.page.touchscreen.tap(21,26);
    assert(await tab.page.locator('#home-screen').isVisible(),'Early Home tap waits for the scene');
    const pixels=()=>tab.page.evaluate(()=>{
      const c=document.getElementById('title-art'),g=c.getContext('2d');
      return [homeImp,homeCrawler].map(({x,y,paintHeight})=>
        Array.from(g.getImageData(c.width*x-16,c.height*(y-paintHeight*.5/c.clientHeight),32,30).data));
    });
    const before=await pixels();
    await tab.page.waitForFunction(prior=>{
      const c=document.getElementById('title-art'),g=c.getContext('2d');
      return [homeImp,homeCrawler].every(({x,y,paintHeight},i)=>{
        const a=g.getImageData(c.width*x-16,c.height*(y-paintHeight*.5/c.clientHeight),32,30).data;
        return a.reduce((sum,v,j)=>sum+(Math.abs(v-prior[i][j])>8),0)>45;
      });
    },before,{timeout:5000});
    await tab.page.emulateMedia({reducedMotion:'reduce'});
    await tab.page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const staticActors=await pixels();
    await tab.page.waitForTimeout(140);
    assert.deepEqual(await pixels(),staticActors,'Reduced motion freezes opening enemies');
    await tab.page.emulateMedia({reducedMotion:'no-preference'});
    release.splice(0).forEach(resolve=>resolve());
    await tab.page.waitForFunction(()=>Boolean(window.grimRun?.scene.scenes[0]?.visuals?.reviewV2),null,{timeout:45000});
    await tab.page.locator('#menu').waitFor({state:'visible'});
    const control=tab.page.locator('#start-btn');
    assert(await control.isDisabled(),'Menu waits for the first verified run pose');
    assert.match(await control.innerText(),/PREPARING REAPER/);
    await tab.page.keyboard.press('Enter');
    assert.equal(await tab.page.evaluate(()=>window.grimRun.scene.scenes[0].state),'menu',
      'Keyboard Start respects loading readiness');
    assert(await tab.page.locator('#frontispiece').isVisible(),'Menu loading has the same visible tableau');
    boot.preparingReaper=true;
    releaseFirstPose();
    await tab.page.waitForFunction(ready,null,{timeout:60000});
    await control.tap();
    await tab.page.waitForFunction(()=>window.grimRun.scene.scenes[0].distance>1);
    assert(!(await tab.page.locator('#frontispiece').isVisible()),'Opening canvas is hidden during play');
    assert.deepEqual(tab.errors,[]);
    return boot;
  } finally {
    releaseFirstPose();
    release.splice(0).forEach(resolve=>resolve());
    await tab.page.close();
  }
}
async function gameplay(tab, older){
  await start(tab);
  if(!older)await tab.page.waitForFunction(()=>{
    const ready=window.grimRun.scene.scenes[0].combatArt.ready;
    return ready['enemy-attack-turns']&&ready['enemy-attack-turns-hit'];
  });
  const values=await tab.page.evaluate(older=>{
    const game=window.grimRun,s=game.scene.scenes[0],C=window.GRIM_CONFIG;
    s.sys.sceneUpdate=()=>{}; game.loop.sleep(); clearInterval(s.loopWatchdogId);
    s.setGodMode(true);s.nextVendorNumber=99;s.obstacles=[];s.enemies=[];
    const draw=()=>{s.drawScene();game.step(performance.now(),0);};
    const place=(x,cameraX=x-s.width*.32)=>{
      const floor=s.terrain.groundAt(x)??s.terrain.anchorAt(x);
      Object.assign(s.player,{x,y:floor,grounded:true,velocityY:0,invulMs:0,visualLandingMs:0});
      Object.assign(s,{state:'playing',distance:(x-s.startX)/C.pxPerMeter,
        cameraX,cameraY:floor-s.groundY,goFlashMs:0,fallFeedbackMs:0,respawnMs:0});
      s.cameras.main.setScroll(s.cameraX,s.cameraY);
    };
    const snapshot=()=>JSON.stringify({player:s.player,state:s.state,rng:s.rng.state,
      segments:s.terrain.segments,fireballs:s.fireballs.map(({owner,...ball})=>ball)});
    const jump=()=>{
      s.startRun(); s.setGodMode(true);s.nextVendorNumber=99; s.player.invulMs=0;
      s.jump(); const poses=[],events=[];
      for(let i=0;i<40;i++){
        if(i===2)s.jumpEnd();
        s.update(0,1000/60);
        const v=s.motionArt.body.filter(view=>view.visible);
        const m=s.motionArt.state;
        if(v.length!==1)throw Error('Exactly one Reaper silhouette at step '+i);
        poses.push([m.name,+m.frame.toFixed(3),v[0].alpha,v[0].texture.key]);
        events.push([s.player.x,s.player.y,s.player.velocityY,s.player.grounded,s.rng.state]);
      }
      return {poses,events};
    };
    const bridge=fill=>{
      const gap=s.terrain.segments.find(g=>g.kind==='gap'&&(g.start-s.startX)/C.pxPerMeter>1650);
      if(!gap)throw Error('seed gap missing');
      s.hasTeleported=false;
      place(gap.start-100,(gap.end+gap.start-s.width)*.5);
      if(fill){
        s.powerManager.apply('brittleBones',s.player,()=>{},1);
        s.resetRewindHistory();s.captureRewind();
        s.triggerBrittleBones();s.powerArt?.reset();
        s.particles=[];s.bonesBlastMs=0;s.damageFlashMs=0;
      }
      draw();
      return gap;
    };
    const g=bridge(true),middle=(g.start+g.end)*.5;
    const fill={kind:g.kind,ground:s.terrain.groundAt(middle),
      visible:s.boneBridges?.views.size||0};
    s.rewindClockMs=8100;s.captureRewind();
    if(!s.rewind())throw Error('rewind unavailable');
    for(let i=0;i<100&&s.state==='rewinding';i++)s.update(0,34);
    draw();
    const rewind={kind:g.kind,ground:s.terrain.groundAt(middle),
      visible:s.boneBridges?.views.size||0};
    const air=jump();
    const slope=s.terrain.segments.find(g=>g.kind==='ground'&&g.start>s.startX+5400*12&&
      (g.y1-g.y0)/(g.end-g.start)>.45&&g.end-g.start>200);
    if(!slope)throw Error('seed slope missing');
    const x=(slope.start+slope.end)*.5;
    const enemies=phase=>{
      s.hasTeleported=true;
      place(x-200,x-430);
      s.cameraY=s.terrain.groundAt(x)-s.height*.76;
      s.cameras.main.setScroll(s.cameraX,s.cameraY);
      const crawler={kind:'crawler',x,y:s.terrain.groundAt(x)-46,phase:older?0:phase-x/104*4,hp:1};
      const impX=x-122;
      const imp={kind:'imp',x:impX,y:s.terrain.groundAt(impX)-30,phase:older?0:phase-impX/92*4,hp:2,warningMs:470};
      s.enemies=[crawler,imp];s.fireballs=[];
      draw();
      return {crawler,imp};
    };
    const {crawler,imp}=enemies(.5);
    const cv=s.visuals.boneCrawlerPool[0],iv=s.visuals.emberImpPool[0];
    const warningKey=iv.texture.key,warnings=[iv.frame.name];
    imp.warningMs=0;
    for(const ageMs of [0,260,261]){
      s.fireballs=[{owner:imp,ageMs,x:imp.x-12,y:imp.y-11}];draw();
      warnings.push(iv.frame.name);
    }
    window.grimPolishCapture={game,s,draw,bridge,jump,place,enemies,x};
    return {fill,rewind,air,crawler:{angle:cv.rotation,texture:cv.texture.key,box:window.GRIM_COMBAT.rectFor(crawler)},
      imp:{warningKey,warnings,texture:iv.texture.key},snapshot:snapshot()};
  },older);
  assert.equal(values.fill.kind,'rubble');
  assert(Number.isFinite(values.fill.ground));
  assert.deepEqual(values.rewind,{kind:'gap',ground:null,visible:0});
  assert(values.air.poses.some(([name,v])=>name==='reaper-jump'&&v>=18));
  assert(values.air.poses.every(([, ,alpha])=>alpha===1));
  if(!older)assert.equal(values.imp.warningKey,'enemy-attack-turns');
  assert.equal(values.imp.warnings[0],older?'warning':60);
  assert.equal(values.imp.warnings[1],'release');
  assert.equal(values.imp.warnings[2],older?'release':82);
  assert.notEqual(values.imp.warnings[3],'release');
  if(!older){
    assert(values.fill.visible>0);
    assert(values.crawler.angle>.30,'Crawler tilts downhill along the footprint');
    assert.equal(values.crawler.texture,'enemy-ground-inbetweens');
    assert.equal(values.imp.texture,'enemy-ground-inbetweens');
    assert(values.air.poses.some(([, , ,name])=>name==='motion-reaper-jump-deliberate' ||
      name==='motion-reaper-forward-carry'||name==='motion-reaper-air-cloth'),'The registered air family owns the ordinary jump');
    const rise=values.air.poses.slice(0,7);
    assert(rise.every((v,i)=>i===0||v[1]-rise[i-1][1]<1.5),'Short-hop pose remains continuous');
    assert(values.air.poses.slice(6,14).every(([,frame])=>frame===4),
      'Short-hop legs hold the gathered posture through the apex');
  }
  assert.deepEqual(tab.errors,[]);
  return values;
}

async function saveMotion(browser,origin,older,tab){
  const prefix=older?'before':'after';
  for(const name of ['bridge','jump','enemies','opening'])
    fs.mkdirSync(path.join(output,prefix,name),{recursive:true});
  const destination=(name,index,ext)=>path.join(output,prefix,name,String(index).padStart(3,'0')+'.'+ext);
  for(const name of ['bridge','jump','enemies']){
    const frames=await tab.page.evaluate(({name,older})=>{
      const {game,s,draw,bridge,place,enemies,x}=window.grimPolishCapture;
      s.startRun(); s.setGodMode(true);s.nextVendorNumber=99;
      s.obstacles=[];s.enemies=[];
      const out=[];
      const snap=()=>{draw();out.push(game.canvas.toDataURL('image/jpeg',.87));};
      if(name==='bridge'){
        const g=bridge(true),start=s.cameraX;
        s.cameraY=Math.min(g.y0,g.y1)-s.height*.48;
        for(let i=0;i<27;i++){
          s.cameraX=start+(i-13)*2.3;
          s.cameras.main.setScroll(s.cameraX,s.cameraY);
          snap();
        }
      }else if(name==='jump'){
        s.jump();
        for(let i=0;i<45;i++){
          if(i===2)s.jumpEnd();
          s.update(0,1000/60);snap();
        }
      }else{
        const {crawler,imp}=enemies(0);
        imp.warningMs=0; s.cameraX=x-430;
        s.cameraY=s.terrain.groundAt(x)-s.height*.66;
        s.cameras.main.setScroll(s.cameraX,s.cameraY);
        const ix=imp.x, phase=1.3;
        crawler.phase=older?0:phase-x/104*4;
        imp.phase=older?0:phase-ix/92*4;
        for(let i=0;i<44;i++){
          crawler.x=x-36+i*1.75; crawler.y=s.terrain.groundAt(crawler.x)-46;
          imp.x=ix-46+i*1.55; imp.y=s.terrain.groundAt(imp.x)-30;
          s.elapsed=i/45;
          imp.warningMs=i>=23&&i<34?(34-i)*43:0;
          s.fireballs=i>=34?[{owner:imp,ageMs:(i-34)*22,x:imp.x-12-(i-34)*6,y:imp.y-11}]:[];
          snap();
        }
      }
      return out;
    },{name,older});
    frames.forEach((data,i)=>fs.writeFileSync(destination(name,i,'jpg'),Buffer.from(data.split(',')[1],'base64')));
  }
  await tab.page.close();
  const home=await open(browser,origin+(older?'/baseline/':'/')+'?seed=33');
  try{
    await home.page.goto(home.url);
    await home.page.waitForFunction(ready,null,{timeout:60000});
    await home.page.clock.install();
    for(let index=0;index<68;index++){
      await home.page.clock.runFor(75);
      await home.page.screenshot({path:destination('opening',index,'jpg'),quality:85});
    }
  }finally{await home.page.close();}
}

async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const args=['--no-sandbox',process.env.GRIM_POLISH_CANVAS==='1'?'--disable-webgl':'--use-angle=swiftshader'];
  const browser=await chromium.launch({headless:true,args});
  try {
    const url=origin+'/?seed=33';
    const boot=await opening(browser,url);
    const tab=await open(browser,url);
    const after=await gameplay(tab,false);
    if(capture)await saveMotion(browser,origin,false,tab);
    else await tab.page.close();
    if(oldRoot){
      const old=await open(browser,origin+'/baseline/?seed=33');
      const before=await gameplay(old,true);
      assert.deepEqual(after.air.events,before.air.events,'Jump physics and RNG are identical');
      assert.deepEqual(after.crawler.box,before.crawler.box,'The visual slope alignment leaves the hitbox fixed');
      assert.equal(after.snapshot,before.snapshot,'Staged gameplay and projectile state are identical');
      if(capture)await saveMotion(browser,origin,true,old);
      else await old.page.close();
    }
    if(capture){
      fs.mkdirSync(output,{recursive:true});
      fs.writeFileSync(path.join(output,'validation.json'),JSON.stringify({boot,
        bridge:after.fill,rewind:after.rewind,crawler:after.crawler,imp:after.imp,
        shortHop:after.air.poses.slice(0,7)},null,2));
    }
    console.log('PASS cold opening idles, reduced motion, touch start, bone fill and rewind, single-silhouette jumps, slope contact and Imp telegraphs.');
  } finally {
    await browser.close();
    server.close();
  }
}
main().catch(error=>{console.error(error);server.close();process.exitCode=1;});
