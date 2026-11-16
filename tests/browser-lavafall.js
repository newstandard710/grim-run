'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require('playwright');
const {PNG} = require('pngjs');

const ROOT = path.join(__dirname, '..');
const OUTPUT = path.resolve(process.env.GRIM_LAVA_OUTPUT || 'test-results/lavafall');
const ASSET = '/assets/visuals/biomes/lavafall-detail-v1.png';
const lavaVariant = process.env.GRIM_LAVA_VARIANT;
const MIME = {'.html':'text/html','.css':'text/css','.js':'application/javascript',
  '.json':'application/json','.ttf':'font/ttf','.woff2':'font/woff2',
  '.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (lavaVariant && url.pathname === '/assets/visuals/biomes/lava.webp') {
    res.setHeader('Content-Type', MIME['.webp']);
    return fs.createReadStream(lavaVariant).pipe(res);
  }
  const file = path.resolve(ROOT, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file)) return res.writeHead(404).end();
  res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

async function open(browser, width, height, options = {}) {
  const page = await browser.newPage({viewport:{width,height},hasTouch:true,
    reducedMotion:options.reduced ? 'reduce' : 'no-preference'});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  if (options.route) await page.route('**' + ASSET, options.route);
  const response = await page.goto('http://127.0.0.1:' + server.address().port +
    '/?seed=33', {waitUntil:'domcontentloaded'});
  assert(response.ok());
  await page.waitForFunction(() => grimRun?.scene.scenes[0]?.visuals?.reaperReady &&
    GRIM_FRONTEND?.ready, null, {timeout:45000});
  await page.evaluate(() => {
    const g = grimRun, s = g.scene.scenes[0], config = GRIM_CONFIG;
    const parent = g.scale.parent;
    const size = (w,h) => {
      parent.style.width = w + 'px';
      parent.style.height = h + 'px';
      g.scale.getParentBounds();
      g.scale.resize(w,h);
    };
    size(innerWidth,innerHeight);
    s.sys.sceneUpdate = () => {};
    clearInterval(s.loopWatchdogId);
    s.enterHome();
    s.startRun();
    s.setGodMode(true);
    g.loop.sleep();
    let now = performance.now();
    const tick = (dt = 1000/60) => s.update(0,dt);
    const step = (dt = 1000/60) => {
      now += dt;
      g.loop.sleep();
      g.step(now,dt);
    };
    const teleport = meters => {
      if (s.state !== 'paused') s.togglePause();
      if (!s.askTeleport(meters) || !s.confirmTeleport()) throw Error('Practice teleport failed: ' + meters);
      g.loop.sleep();
    };
    const stage = (meters, elapsed = 2, practice = 0) => {
      let x = s.startX + meters * config.pxPerMeter;
      s.terrain.advance(x + s.width + 1600);
      while (s.terrain.groundAt(x) === null) x -= 8;
      const y = s.terrain.groundAt(x);
      Object.assign(s.player,{x,y,grounded:true,velocityY:0,onSoulPlatform:false,
        jumpHeld:false,holdSlide:false,sliding:false,airTuck:false,invulMs:0,attackMs:0});
      Object.assign(s,{distance:(x-s.startX)/config.pxPerMeter,hasTeleported:meters>=5000,
        state:'playing',gunUnlocked:true,shrineClaimed:true,elapsed,practiceTimeMode:practice,
        speed:GRIM_CORE.runSpeed(meters),cameraX:x-s.width*config.reaperXRatio,cameraY:y-s.groundY,
        nextEncounterX:x+650,nextEnemySpawnX:x+425,nextGroundSpawnX:x+850,nextSnapSpawnX:x+900,
        lastVendorNumber:14,nextVendorNumber:15,fallFeedbackMs:0,respawnMs:0,goFlashMs:0,damageFlashMs:0,
        obstacles:[],enemies:[],fireballs:[],bullets:[],particles:[]});
      s.cameras.main.setScroll(s.cameraX,s.cameraY);
      s.ui.setMode('playing');
      s.resetRewindHistory();
      s.captureRewind();
      s.refreshHud();
      s.drawScene();
    };
    const inspect = () => {
      const d=s.lavafallDetail, view=d?.view, plate=s.biomeBackdrops.lava, key='lavafall-detail-v1';
      return {state:s.state,time:s.elapsed,range:s.distance,pending:!!d?.pending,failed:!!d?.failed,
        visible:!!view?.visible,resource:s.textures.exists(key),alpha:view?.alpha,
        rect:view&&[view.x,view.y,view.displayWidth,view.displayHeight],size:[g.canvas.width,g.canvas.height],
        depth:view?.depth,plate:plate&&[plate.x,plate.y,plate.displayWidth,plate.displayHeight,plate.depth],
        slots:s.children.list.filter(child => child.texture?.key===key).length};
    };
    const advanceRender = milliseconds => {now += milliseconds;};
    const frame = () => {
      g.step(now,0);
      return g.canvas.toDataURL('image/png').slice(22);
    };
    const pair = () => {
      const view = s.lavafallDetail.view;
      const info = inspect();
      const on = frame();
      view.setVisible(false);
      const off = frame();
      view.setVisible(info.visible);
      return {on,off,info};
    };
    window.lavaFixture={g,s,size,tick,step,stage,teleport,inspect,pair,frame,advanceRender};
  });
  return {page,errors};
}

async function ready(page, detail = true) {
  let status;
  for(let i=0;i<120;i++) {
    status=await page.evaluate(()=>{
      const f=window.lavaFixture,s=f.s;
      s.drawScene();
      f.step();
      return {lava:!!s.biomeBackdrops.lava,midground:s.biomeMidground.stream.loaded.has('lava'),
        group:s.biomeBackdropGroup,loader:s.biomeBackdropPendingGroup,
        distance:s.distance,detail:f.inspect()};
    });
    if(status.lava&&status.midground&&(!detail||status.detail.resource))return;
    await page.waitForTimeout(125);
  }
  throw Error('Lava assets did not settle: '+JSON.stringify(status));
}

function pixels(value) {
  return PNG.sync.read(Buffer.from(value,'base64'));
}

function compare(pair) {
  const on = pixels(pair.on), off = pixels(pair.off);
  const [left,top,width,height] = pair.info.rect;
  let changed=0, maxLuma=0, outside=0;
  for(let i=0;i<on.data.length;i+=4) {
    const delta=luma(on.data,i)-luma(off.data,i);
    if(on.data[i]===off.data[i] && on.data[i+1]===off.data[i+1] &&
       on.data[i+2]===off.data[i+2] && on.data[i+3]===off.data[i+3]) continue;
    const x=(i/4)%on.width, y=Math.floor(i/4/on.width);
    if(x<Math.floor(left)-1 || x>Math.ceil(left+width)+1 ||
       y<Math.floor(top)-1 || y>Math.ceil(top+height)+1) outside++;
    maxLuma=Math.max(maxLuma,Math.abs(delta));
    changed++;
  }
  assert.equal(outside,0,'matched render pixels outside the detail draw');
  assert(maxLuma <= 8, 'pixel luma limit: ' + maxLuma);
  return {changed,maxLuma};
}

function luma(data,i) {
  return .2126*data[i]+.7152*data[i+1]+.0722*data[i+2];
}

function writePair(dir,name,pair) {
  fs.mkdirSync(dir,{recursive:true});
  for(const mode of ['on','off'].filter(mode=>pair[mode]))
    fs.writeFileSync(path.join(dir,name+'-'+mode+'.png'),Buffer.from(pair[mode],'base64'));
}

async function moving(browser, renderer, width, height, checksOnly = false) {
  let {page,errors}=await open(browser,width,height);
  const metrics=[];
  try {
    assert.equal(await page.evaluate(()=>grimRun.renderer.type),renderer==='canvas'?1:2);
    for(const practice of checksOnly ? [] : [0,2]) {
      await page.evaluate(practice=>lavaFixture.stage(8995,1.5,practice),practice);
      await ready(page);
      const results=[];
      for(let i=0;i<24;i++) {
        const pair=await page.evaluate(i=>{
          const f=lavaFixture;
          for(let j=0;j<8;j++) {
            const tick=i*8+j;
            if(tick===8||tick===169) f.s.jump();
            if(tick===20||tick===191) f.s.jumpEnd();
            if(tick===38||tick===190) f.s.attack();
            if(tick===60) f.s.startSlide();
            if(tick===86) f.s.endSlide();
            f.tick();
          }
          f.advanceRender(8*1000/60);
          return i===0 || i===12 || i===23 ? f.pair() : {on:f.frame(),info:f.inspect()};
        },i);
        assert.deepEqual(pair.info.size,[width,height]);
        assert.equal(pair.info.slots,1);
        assert(pair.info.depth>pair.info.plate[4] && pair.info.depth< -24);
        if(pair.off)results.push(compare(pair));
        writePair(path.join(OUTPUT,renderer+'-'+width,practice?'quarter':'normal'),
          String(i).padStart(3,'0'),pair);
      }
      assert(results.some(result=>result.changed>0));
      metrics.push({practice,maxChanged:Math.max(...results.map(r=>r.changed)),
        maxLuma:Math.max(...results.map(r=>r.maxLuma))});
      assert.deepEqual(errors,[]);
      await page.close();
      ({page,errors}=await open(browser,width,height));
    }
    await page.evaluate(()=>lavaFixture.stage(9000,3));
    await ready(page);

    for(const [distance, visible] of [[8000,false],[8179,false],[8205,true],
      [9000,true],[9780,true],[9820,false],[9999,false],[10500,false]]) {
      const state=await page.evaluate(distance=>{
        lavaFixture.stage(distance);
        return lavaFixture.inspect();
      },distance);
      assert.equal(state.visible,visible,'Lava motion gate at '+distance);
    }

    const forced=await page.evaluate(()=>{
      const f=lavaFixture,s=f.s;
      f.stage(9000,3);
      const v=s.lavafallDetail.view;
      const x=v.x+v.displayWidth*.5+s.cameraX,y=v.y+v.displayHeight*.52+s.cameraY;
      const fireball={x,y,reflected:false,dead:false,ageMs:0,vx:-300,vy:0};
      const warning={kind:'bat',x:x+34,y,homeY:y,phase:0,mode:'telegraph',hp:2,dead:false};
      const blank=f.pair();
      s.fireballs=[fireball];
      s.enemies=[warning];
      s.drawScene();
      const cues=f.pair();
      return {blank,cues,fireballCenter:[x-s.cameraX,y-s.cameraY],
        warningCenter:[warning.x-s.cameraX,warning.y-s.cameraY]};
    });
    const forceMax=compare(forced.cues);
    const [cueOff,cueOn,backOff,backOn]=[forced.cues.off,forced.cues.on,forced.blank.off,forced.blank.on].map(pixels);
    let prominent=0,largestContrastLoss=0,coreMaxDelta=0,overlap=0;
    let fireballCore=0,warningCore=0;
    for(let i=0;i<cueOff.data.length;i+=4) {
      const original=Math.abs(luma(cueOff.data,i)-luma(backOff.data,i));
      const changed=Math.abs(luma(cueOn.data,i)-luma(backOn.data,i));
      if(original<12 || Math.abs(luma(backOn.data,i)-luma(backOff.data,i))<.5) continue;
      overlap++;
      if(original>=24) {
        prominent++;
        largestContrastLoss=Math.max(largestContrastLoss,original-changed);
        // Contrast also covers the translucent halo and rasterized edges.
        // Sample inside the radius-8 fill and the two-pixel warning stroke for core stability.
        const x=i/4%cueOff.width+.5,y=Math.floor(i/4/cueOff.width)+.5;
        const insideFireball=Math.hypot(x-forced.fireballCenter[0],y-forced.fireballCenter[1])<=7;
        const insideWarning=Math.abs(Math.hypot(x-forced.warningCenter[0],y-forced.warningCenter[1])-35)<=.5;
        if(insideFireball) fireballCore++;
        if(insideWarning) warningCore++;
        if(insideFireball||insideWarning)
          coreMaxDelta=Math.max(coreMaxDelta,Math.abs(luma(cueOn.data,i)-luma(cueOff.data,i)));
      }
    }
    assert(overlap>5 && prominent>3,'forced cue pixels overlap the glow');
    assert(fireballCore>0 && warningCore>0,'both cue cores overlap the glow');
    assert(largestContrastLoss<=5 && coreMaxDelta<=2,
      'forced cue contrast: '+JSON.stringify({largestContrastLoss,coreMaxDelta,fireballCore,warningCore}));
    writePair(path.join(OUTPUT,renderer+'-'+width),'overlap',forced.cues);

    await page.setViewportSize({width:height,height:width});
    const portrait=await page.evaluate(([width,height])=>{
      lavaFixture.size(width,height);lavaFixture.s.drawScene();lavaFixture.step();
      return lavaFixture.inspect();
    },[height,width]);
    assert.deepEqual(portrait.size,[height,width]);
    assert.equal(portrait.slots,1);
    await page.setViewportSize({width,height});
    const landscape=await page.evaluate(([width,height])=>{
      lavaFixture.size(width,height);lavaFixture.s.drawScene();lavaFixture.step();
      return lavaFixture.inspect();
    },[width,height]);
    assert.deepEqual(landscape.size,[width,height]);
    assert.equal(landscape.slots,1);
    assert.equal(landscape.visible,true);
    const wrap=await page.evaluate(()=>[7.5-1/60,7.5,7.5+1/60].map(time=>{
      lavaFixture.stage(9000,time);
      return lavaFixture.pair();
    }));
    for (const frame of wrap) assert.equal(compare(frame).changed,0,'wrap stays invisible');
    assert.deepEqual(errors,[]);
    return {renderer,width,height,motion:metrics,
      forced:{...forceMax,overlap,prominent,largestContrastLoss,coreMaxDelta,fireballCore,warningCore}};
  } finally {await page.close();}
}

async function lifecycle(browser, renderer) {
  const {page,errors}=await open(browser,740,360);
  const outcome={};
  try {
    await page.evaluate(()=>lavaFixture.stage(9000,3));
    await ready(page);
    outcome.state=await page.evaluate(()=>{
      const f=lavaFixture,s=f.s;
      const original=f.inspect();
      const originalView=s.lavafallDetail.view;
      s.togglePause();
      for(let i=0;i<20;i++)f.tick();
      const paused=f.inspect();
      s.resume();
      for(let i=0;i<24;i++)f.tick(100);
      while(s.state==='countdown')f.tick(100);
      s.practiceTimeMode=3;
      const beforeFreeze=f.inspect();
      for(let i=0;i<20;i++)f.tick();
      const frozen=f.inspect();
      s.practiceTimeMode=0;
      // Keep a real playable run history in the settled region to exercise rewind.
      f.stage(8900,3);
      for(let i=0;i<660&&s.rewindClockMs-s.rewindFrames[0]?.at<8050;i++) {
        if(s.player.grounded) {
          s.jumpEnd();
          if(s.terrain.groundAt(s.player.x+54)===null)s.jump();
        }
        f.tick();
      }
      const beforeRewind=f.inspect();
      const rewind=s.rewind();
      for(let i=0;i<190&&s.state==='rewinding';i++)f.tick();
      const afterRewind=f.inspect();
      s.meta.souls=3;
      s.freeLifeAvailable=false;
      s.die('impact');
      for(let i=0;i<23;i++)f.tick(100);
      const dying=f.inspect();
      f.tick(100);
      const offer=f.inspect();
      const revived=s.revive();
      for(let i=0;i<60&&s.state!=='playing';i++)f.tick(100);
      const afterRevive=f.inspect();
      const hops=[];
      for(const meters of [5500,9000,10500,9000,7000,9000]) {
        f.teleport(meters);
        s.drawScene();
        hops.push([f.inspect(),s.lavafallDetail.view===originalView]);
      }
      f.teleport(3500);
      const surface=f.inspect();
      f.stage(9000,3);
      return {original,paused,beforeFreeze,frozen,beforeRewind,afterRewind,rewind,dying,offer,revived,afterRevive,hops,surface};
    });
    const m=outcome.state;
    assert.equal(m.paused.state,'paused');
    assert.equal(m.paused.time,m.original.time);
    assert.equal(m.paused.alpha,m.original.alpha);
    assert.equal(m.frozen.time,m.beforeFreeze.time);
    assert.equal(m.frozen.alpha,m.beforeFreeze.alpha);
    assert(m.rewind && m.afterRewind.time<m.beforeRewind.time && m.afterRewind.state==='playing');
    assert.equal(m.dying.state,'dying');
    assert.equal(m.offer.state,'revive');
    assert.equal(m.offer.visible,false);
    assert(m.revived && m.afterRevive.state==='playing' && m.afterRevive.slots===1);
    for(const [state,same] of m.hops) {
      assert.equal(state.slots,1);
      assert.equal(state.resource,true);
      assert.equal(same,true);
    }
    assert.equal(m.surface.slots,0);
    assert.equal(m.surface.resource,false);
    await ready(page);

    console.log(renderer,'navigation/rewind passed');
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Page.setWebLifecycleState',{state:'frozen'});
    await cdp.send('Page.setWebLifecycleState',{state:'active'});
    assert.equal(await page.evaluate(()=>{lavaFixture.s.drawScene();return lavaFixture.inspect().resource}),true);


    const lifecycle=await page.evaluate(()=>{
      const f=lavaFixture,s=f.s;
      s.goToMenu();
      const menu=f.inspect();
      s.startRun();
      f.g.loop.sleep();
      const restart=f.inspect();
      return {menu,restart};
    });
    for(const state of Object.values(lifecycle)) {
      assert.equal(state.slots,0);
      assert.equal(state.resource,false);
    }
    outcome.cleanup=lifecycle;
    await page.evaluate(()=>{lavaFixture.s.setGodMode(true);lavaFixture.stage(9000,3);});
    await ready(page);
    const shutdown=await page.evaluate(()=>{
      const f=lavaFixture;
      f.g.scene.stop(f.s.sys.settings.key);
      f.step();
      return f.inspect();
    });
    assert.equal(shutdown.slots,0);
    assert.equal(shutdown.resource,false);
    outcome.shutdown=true;
    assert.deepEqual(errors,[]);
  } finally {await page.close();}

  for(const fault of ['missing','corrupt','delayed','reduced']) {
    console.log(renderer,'optional art',fault);
    let requests=0, resumeRequest;
    const delay=new Promise(resolve=>{resumeRequest=resolve;});
    const {page,errors}=await open(browser,740,360,{reduced:fault==='reduced',route:async route=>{
      requests++;
      if(fault==='delayed') {await delay; await route.continue().catch(()=>{});}
      else if(fault==='missing') await route.fulfill({status:404,body:'missing'});
      else await route.fulfill({status:200,contentType:'image/png',body:'broken'});
    }});
    try {
      await page.evaluate(()=>lavaFixture.stage(9000,3));
      await ready(page,false);
      if(fault==='delayed') {
        await page.waitForFunction(()=>lavaFixture.inspect().pending);
        const before=await page.evaluate(()=>{
          const f=lavaFixture;
          for(let i=0;i<30;i++)f.tick();
          return f.inspect();
        });
        assert(before.time>3 && !before.visible && !before.resource);
        const stale=await page.evaluate(()=>{
          const f=lavaFixture,d=f.s.lavafallDetail;
          const pending=d.pending,callback=pending.onload;
          f.teleport(3500);
          callback.call(pending);
          return f.inspect();
        });
        assert(!stale.pending && !stale.visible && !stale.resource);
        resumeRequest();
        await page.evaluate(()=>lavaFixture.stage(9000,3));
        await ready(page);
        assert.equal(requests,2);
      } else {
        if(fault!=='reduced')await page.waitForFunction(()=>lavaFixture.inspect().failed);
        const state=await page.evaluate(()=>{
          const f=lavaFixture,a=f.inspect();
          for(let i=0;i<30;i++)f.tick();
          return {a,b:f.inspect()};
        });
        assert(state.b.time>state.a.time && !state.b.visible && !state.b.resource);
        assert.equal(requests,fault==='reduced'?0:1);
      }
      outcome[fault]={requests};
      assert.deepEqual(errors,[]);
    } finally {resumeRequest();await page.close();}
  }
  return outcome;
}

async function contextRestoration(browser) {
  const {page,errors}=await open(browser,740,360);
  try {
    await page.evaluate(()=>lavaFixture.stage(9000,3));
    await ready(page);
    await page.evaluate(()=>{
      const g=lavaFixture.g;
      window.lavaContext={lost:0,restored:0,
        extension:g.renderer.gl.getExtension('WEBGL_lose_context')};
      g.canvas.addEventListener('webglcontextlost',()=>window.lavaContext.lost++);
      g.canvas.addEventListener('webglcontextrestored',()=>window.lavaContext.restored++);
      window.lavaContext.extension.loseContext();
    });
    await page.waitForFunction(()=>window.lavaContext.lost===1);
    await page.evaluate(()=>window.lavaContext.extension.restoreContext());
    await page.waitForFunction(()=>window.lavaContext.restored===1);
    const recovered=await page.evaluate(()=>{
      lavaFixture.s.drawScene();
      lavaFixture.step();
      return lavaFixture.pair();
    });
    assert.equal(recovered.info.slots,1);
    assert(compare(recovered).changed>0);
    assert.deepEqual(errors,[]);
    return {restored:true};
  } finally {await page.close();}
}

async function pacing(browser, renderer) {
  const {page,errors}=await open(browser,740,360);
  try {
    await page.evaluate(()=>lavaFixture.stage(8995,2));
    await ready(page);
    const samples=await page.evaluate(async renderer=>{
      const f=lavaFixture,s=f.s,d=s.lavafallDetail,v=d.view;
      const target=renderer==='webgl'?f.g.renderer.gl:f.g.renderer.gameContext;
      const methods=renderer==='webgl'?['drawArrays','drawElements']:['drawImage'];
      const original=methods.map(key=>target[key]);
      let count=0;
      const drawCount=visible=>{
        methods.forEach((key,i)=>target[key]=function(...args){count++;return original[i].apply(this,args);});
        count=0;
        v.setVisible(visible);
        f.step(0);
        methods.forEach((key,i)=>target[key]=original[i]);
        return count;
      };
      const off=drawCount(false),on=drawCount(true);
      const sync=d.sync, seed=s.rng.state;
      const rows=[];
      for(const enabled of [true,false,false,true,true,false]) {
        d.sync=enabled?sync:function(){v.setVisible(false);};
        f.stage(8995,2);
        s.rng.setState(seed);
        const intervals=[],cpu=[];
        await new Promise(resolve=>{
          let previous=0,frames=0;
          const run=now=>{
            const dt=previous?now-previous:1000/60;
            previous=now;
            const start=performance.now();
            f.tick();f.step();
            if(frames++>=12){intervals.push(dt);cpu.push(performance.now()-start);}
            if(frames>=62)resolve();else requestAnimationFrame(run);
          };
          requestAnimationFrame(run);
        });
        const percentile=(values,p)=>values.slice().sort((a,b)=>a-b)[Math.ceil(values.length*p)-1];
        rows.push({enabled,intervalP95:percentile(intervals,.95),intervalP99:percentile(intervals,.99),
          cpuP95:percentile(cpu,.95),cpuP99:percentile(cpu,.99),longFrames:intervals.filter(dt=>dt>25).length});
      }
      d.sync=sync;
      return {drawsAdded:on-off,rows};
    },renderer);
    assert(samples.drawsAdded>=0&&samples.drawsAdded<=1, 'bounded draw calls');
    assert.deepEqual(errors,[]);
    return samples;
  } finally {await page.close();}
}

async function main() {
  fs.mkdirSync(OUTPUT,{recursive:true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const requested=process.env.GRIM_LAVA_CASES || 'canvas-740,webgl-740,canvas-950,webgl-950';
  const suites=(process.env.GRIM_LAVA_SUITES || 'moving,lifecycle,context,pacing').split(',');
  try {
    for(const target of requested.split(',')) {
      console.log('Testing Lava renderer',target,suites.join(','));
      const [renderer,display]=target.split('-');
      const width=Number(display),height=width===740?360:430;
      const args=['--no-sandbox','--disable-dev-shm-usage'];
      args.push(...(renderer==='canvas'?['--disable-webgl']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']));
      const browser=await chromium.launch({args,executablePath:process.env.GRIM_LAVA_CHROMIUM});
      const result=lavaVariant?{variant:path.basename(lavaVariant)}:{};
      const run=async (name,callback)=>{
        result[name]=await callback();
        fs.writeFileSync(path.join(OUTPUT,target+'.json'),JSON.stringify(result,null,2)+'\n');
        console.log(target,name,'passed');
      };
      try {
        if(suites.includes('moving'))await run('moving',()=>moving(browser,renderer,width,height));
        if(suites.includes('visual'))await run('visual',()=>moving(browser,renderer,width,height,true));
        if(width===740&&suites.includes('lifecycle'))await run('lifecycle',()=>lifecycle(browser,renderer));
        if(renderer==='webgl'&&width===740&&suites.includes('context'))
          await run('context',()=>contextRestoration(browser));
        if(width===740&&suites.includes('pacing'))await run('pacing',()=>pacing(browser,renderer));
      } finally {await browser.close();}
    }
  } finally {server.close();}
}

main().catch(error=>{console.error(error);process.exitCode=1;});
