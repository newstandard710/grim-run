'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {createHash} = require('node:crypto');
const {chromium} = require('playwright');

const renderer = process.argv[2];
const origins = {before: 'http://127.0.0.1:8764/', after: 'http://127.0.0.1:8765/'};
const routes = [['opening', 0, 143], ['summit', 4830, 100], ['crossing', 5975, 100], ['lower-ledges', 9445, 100]];

function summary(values) {
  const sorted = [...values].sort((a,b) => a-b);
  const pct = q => +sorted[Math.ceil(q * sorted.length)-1].toFixed(2);
  return {n: sorted.length, median: pct(.5), p95: pct(.95), p99: pct(.99), max: pct(1),
    over50: sorted.filter(v => v > 50).length};
}

async function run(browser, revision, sequence) {
  const page = await browser.newPage({viewport: {width:740, height:360}, hasTouch:true});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const rows = [];
  try {
    await page.goto(origins[revision] + '?seed=33', {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => window.GRIM_FRONTEND?.ready && window.grimRun?.scene.scenes[0]?.visuals?.reaperReady,
      null, {timeout:90000});
    const backend = await page.evaluate(() => {
      const g = grimRun, s = g.scene.scenes[0];
      g.loop.sleep(); clearInterval(s.loopWatchdogId); s.sys.sceneUpdate = () => {};
      const create = s.textures.createCanvas;
      window.summitAlloc = {count:0,pixels:0};
      s.textures.createCanvas = function(key,w,h,...rest) {
        const texture = create.call(this,key,w,h,...rest);
        if (texture && key.startsWith('terrain-tundra-')) {
          summitAlloc.count++; summitAlloc.pixels += w*h;
        }
        return texture;
      };
      return g.renderer.type;
    });
    assert.equal(backend, renderer === 'canvas' ? 1 : 2);

    for (const visit of ['cold','repeat']) {
      const startMs = await page.evaluate(() => {
        const g = grimRun, s = g.scene.scenes[0];
        s.goToMenu();
        const start = performance.now();
        s.startRun(); g.loop.sleep();
        return performance.now()-start;
      });
      for (const [route, meters, frames] of routes) {
        const report = await page.evaluate(async ({meters,frames}) => {
          const g = grimRun, s = g.scene.scenes[0], p = s.player;
          const count = summitAlloc.count, pixels = summitAlloc.pixels;
          const entry = performance.now();
          if (meters) {
            const x = s.startX + meters*GRIM_CONFIG.pxPerMeter, y = s.terrain.groundAt(x);
            if (!Number.isFinite(y)) throw Error('Missing route floor');
            Object.assign(p,{x,y,grounded:true,onSoulPlatform:false,velocityY:0,visualLandingMs:0});
            Object.assign(s,{state:'playing',distance:meters,hasTeleported:meters>=5000,
              shrineClaimed:true,lastVendorNumber:14,nextVendorNumber:15,
              speed:GRIM_CORE.runSpeed(meters),cameraX:x-s.width*GRIM_CONFIG.reaperXRatio,cameraY:y-s.groundY});
            s.nextEncounterX = s.nextEnemySpawnX = s.nextGroundSpawnX = s.nextSnapSpawnX = x+4000;
            s.syncWorldScroll(); s.drawScene();
          }
          const firstDraw = performance.now()-entry, interval = [], cpu = [], state = [];
          let last = entry;
          for (let i=0; i<frames; i++) {
            await new Promise(requestAnimationFrame);
            const now = performance.now();
            interval.push(now-last); last=now;
            if (i===(meters?12:80)) s.jump();
            if (i===(meters?18:90)) s.jumpEnd();
            if (i===(meters?48:101)) s.attack();
            s.update(0,1000/60); g.step(now,0);
            cpu.push(performance.now()-now);
            state.push([s.state,p.x,p.y,p.velocityY,p.grounded,p.onSoulPlatform,p.hp,s.points,
              s.rng.state,s.cameraX,s.cameraY,s.obstacles.length,s.enemies.length]);
          }
          const textures = Object.entries(s.textures.list).filter(([k])=>k.startsWith('terrain-tundra-'));
          let paint=null;
          if (meters===4830) {
            const v=s.terrainTextureViews.get(
              [s.terrain.sectionAt(p.x).kind,s.terrain.sectionAt(p.x).start,s.terrain.sectionAt(p.x).end,'tundra'].join(':'));
            if (!v?.compositeTextureKey) throw Error('Missing summit composite');
            const tex=s.textures.get(v.compositeTextureKey), ctx=tex.getContext();
            const visible=ctx.getImageData(0,0,tex.width,Math.min(360,tex.height)).data;
            const digest=await crypto.subtle.digest('SHA-256',visible);
            paint=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
          }
          return {firstDraw,interval,cpu,state,paint,allocs:summitAlloc.count-count,pixels:summitAlloc.pixels-pixels,
            resident:textures.length,residentPixels:textures.reduce((n,[,t])=>n+t.width*t.height,0),end:s.distance};
        }, {meters,frames});
        const {interval,cpu,state,...rest} = report;
        const row = {renderer,revision,sequence,visit,route,startMs,...rest,
          signature:createHash('sha256').update(JSON.stringify(state)).digest('hex'),
          intervals:summary(interval),cpu:summary(cpu),interval,cpuSamples:cpu};
        console.log('ROUTE',JSON.stringify({...row,interval:undefined,cpuSamples:undefined}));
        rows.push(row);
        assert(report.end>meters,route+' advanced');
        if (route==='crossing') assert(report.end>6000,'reached Crystals');
        if (route==='lower-ledges') assert.equal(report.resident,0,'Tundra composites released in the underworld');
      }
    }
    assert.deepEqual(errors,[]);
    return rows;
  } finally { await page.close(); }
}

async function nativeReplay(browser, revision) {
  const page = await browser.newPage({viewport:{width:740,height:360},hasTouch:true});
  try {
    await page.goto(origins[revision]+'?seed=33',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.GRIM_FRONTEND?.ready && window.grimRun?.scene.scenes[0]?.visuals?.reaperReady,
      null,{timeout:90000});
    await page.locator('#home-enter-btn').click();
    await page.locator('#start-btn').press('Enter');
    await page.waitForFunction(()=>grimRun.scene.scenes[0].state==='playing',null,{timeout:10000});
    const rows=[];
    for (const stage of ['opening','opening-restart','lava','lava-restart']) {
      const result=await page.evaluate(async stage=>{
        const g=grimRun,s=g.scene.scenes[0];
        if(stage.endsWith('-restart')) { s.goToMenu(); s.startRun(); }
        if(stage==='lava'){
          const m=9445,x=s.startX+m*GRIM_CONFIG.pxPerMeter,y=s.terrain.groundAt(x);
          Object.assign(s.player,{x,y,velocityY:0,grounded:true,onSoulPlatform:false});
          Object.assign(s,{distance:m,hasTeleported:true,shrineClaimed:true,lastVendorNumber:14,nextVendorNumber:15,
            speed:GRIM_CORE.runSpeed(m),cameraX:x-s.width*GRIM_CONFIG.reaperXRatio,cameraY:y-s.groundY});
          s.nextEncounterX=s.nextEnemySpawnX=s.nextGroundSpawnX=s.nextSnapSpawnX=x+4000;
          s.syncWorldScroll();
        }
        const start=s.distance,samples=[];
        let last=performance.now(),pre=last;
        const preStep=()=>{pre=performance.now();};
        const postRender=()=>{
          const now=performance.now();
          samples.push([now-last,now-pre,s.distance,s.terrainTextureViews?.size??0]); last=now;
        };
        g.events.on('prestep',preStep); g.events.on('postrender',postRender);
        try{
          await new Promise((resolve,reject)=>{
            const timeout=setTimeout(()=>{g.events.off('postrender',check);reject(Error('Native replay timed out: '+stage));},90000);
            function check(){if(samples.length>=36){clearTimeout(timeout);g.events.off('postrender',check);resolve();}}
            g.events.on('postrender',check);
          });
          return {stage,start,end:s.distance,state:s.state,samples};
        }finally{g.events.off('prestep',preStep);g.events.off('postrender',postRender);}
      },stage);
      assert(result.end>result.start,stage+' native game advanced in '+result.state+' from '+result.start+' to '+result.end);
      rows.push(result);
      console.log('NATIVE',revision,stage,JSON.stringify(summary(result.samples.map(a=>a[0]))));
    }
    return {revision,rows};
  }finally{await page.close();}
}

(async () => {
  assert(['canvas','webgl'].includes(renderer));
  const args = renderer==='canvas' ? ['--disable-webgl'] : ['--use-angle=swiftshader','--enable-unsafe-swiftshader'];
  const browser=await chromium.launch({args:['--no-sandbox',...args]});
  const rows=[];
  try {
    for (const [i,revision] of ['before','after','after','before'].entries())
      rows.push(...await run(browser,revision,i));
    for (const visit of ['cold','repeat']) for (const [route] of routes) {
      const cases=rows.filter(r=>r.route===route&&r.visit===visit);
      assert.equal(new Set(cases.map(r=>r.signature)).size,1,route+' seeded gameplay');
      if(route==='summit'){
        assert.equal(new Set(cases.map(r=>r.paint)).size,1,'visible summit texture bytes');
        const before=cases.filter(r=>r.revision==='before'), after=cases.filter(r=>r.revision==='after');
        assert(after.every(v=>v.allocs<Math.min(...before.map(b=>b.allocs))),'summit allocations decreased');
      }
    }
    const native=[];
    for(const revision of ['before','after']) native.push(await nativeReplay(browser,revision));
    fs.mkdirSync('test-results/terrain-reuse',{recursive:true});
    fs.writeFileSync('test-results/terrain-reuse/native-'+renderer+'.json',JSON.stringify(native));
  } finally {
    fs.mkdirSync('test-results/terrain-reuse',{recursive:true});
    fs.writeFileSync('test-results/terrain-reuse/'+renderer+'.json',JSON.stringify(rows));
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
