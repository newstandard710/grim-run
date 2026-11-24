'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const http=require('node:http');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {chromium}=require('playwright');

const candidate=path.resolve(__dirname,'..');
const [baselineArg,renderer,viewport,phase='complete']=process.argv.slice(2);
const summaryFile=['route33','route34','gallery'].includes(phase)?phase+'-summary.json':'summary.json';
if(!baselineArg||!['canvas','webgl'].includes(renderer)||!/^\d+x\d+$/.test(viewport))
  throw Error('Usage: node tests/browser-obstacle-landscapes.js BASELINE canvas|webgl WIDTHxHEIGHT');
const [width,height]=viewport.split('x').map(Number);
const baseline=path.resolve(baselineArg);
const out=path.resolve('test-results','obstacle-landscapes',renderer+'-'+viewport);
const mime={'.html':'text/html','.js':'application/javascript','.png':'image/png','.webp':'image/webp',
  '.css':'text/css','.svg':'image/svg+xml','.ttf':'font/ttf','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
  const [,revision,...parts]=new URL(req.url,'http://localhost').pathname.split('/');
  const root=revision==='before'?baseline:candidate;
  const file=path.resolve(root,parts.join('/')||'index.html');
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  try{const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(bytes);}
  catch{res.writeHead(404).end();}
});

// World coordinates and variants from the seeded encounter simulation.
// Each replay uses the original terrain, selector, movement, attacks and collision paths.
const pilot=[
  ['forest_slide_dead-bough-curtain',33,1050,2],
  ['caves_slide_fossil-rib-arch',35,63069.95527242754,2],
  ['lava_air-tuck_molten-chain-tuck-gate',33,97658.58771006875,0],
  ['forest_cut_dead-oak-sapling',34,10047.762656558414,0],
  ['foothills_cut_dead-mountain-tree',38,12602.127225780047,0]
];
const remaining=[
  ['forest_cut_thorny-young-pine',33,4530.551778453482,2],
  ['tundra_cut_frozen-dead-pine',34,57640.14732234026,3],
  ['ashlands_cut_charred-sapling',34,93504.95999999999,1],
  ['ashlands_air-tuck_basalt-tuck-gate',33,89696.6902453087,0],
  ['forest_slide_root-shelf',39,10901.7025,5],
  ['foothills_slide_grass-root-ledge',37,27355.6804,4],
  ['caves_slide_fossil-rib-arch',36,71439.016088543,3],
  ['ashlands_slide_basalt-shelf',34,84588.48,3],
  ['ashlands_jump_charred-root-mass',35,95297.8753,5],
  ['lava_slide_lava-glass-shelf',33,119216.36362171784,3],
  ['boss_slide_bone-arch',34,120441.60,3]
];
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function stats(values){
  const sorted=[...values].sort((a,b)=>a-b);
  const at=p=>sorted[Math.max(0,Math.ceil(sorted.length*p)-1)];
  return {n:values.length,median:at(.5),p95:at(.95),p99:at(.99)};
}

async function waitForArt(page) {
  try {
    await page.waitForFunction(()=>obstacleReview.ready(),null,{polling:180,timeout:45000});
  } catch (error) {
    throw Error('Scenery readiness: '+JSON.stringify(await page.evaluate(()=>obstacleReview.diagnostics())),{cause:error});
  }
}

const routeReferences=new Map();
async function playTransitions(page,revision,results,onlySeed){
  const routes=[
    [34,[
      ['forest_cut_dead-oak-sapling',821],['foothills_slide_grass-root-ledge',2174],
      ['crystals_air-bramble_floating-prism-briar',6091],['ashlands_slide_basalt-shelf',7032],
      ['lava_air-bramble_ember-air-briar',8122]
    ]],
    [33,[['lava_slide_lava-glass-shelf',9918]]]
  ];
  for(const [seed,stops] of routes){
    if(onlySeed && seed!==onlySeed)continue;
    // Look for the same obstacle family near each biome transition. A changed
    // early decision can move later rolls, including every slide on one seed.
    let native;
    for(const routeSeed of [seed,seed+1,seed+2,seed+3]){
      await page.evaluate(seed=>obstacleReview.beginRoute(seed),routeSeed);
      const pending=stops.filter(([,m],i)=>!native?.[i]||Math.abs(native[i].m-m)>160);
      const until=Math.min(10002,Math.max(...pending.map(([,m])=>m))+720);
      let complete=false;
      for(let part=0;part<250&&!complete;part++){
        complete=await page.evaluate(([stops,until])=>obstacleReview.scanRoute(stops,until),[pending,until]);
        if(!complete)await page.waitForFunction(()=>!grimRun.scene.scenes[0].biomeMidground.stream.pending,
          null,{polling:150,timeout:30000});
      }
      assert(complete,'seeded route reached its last sample');
      native=await page.evaluate(stops=>stops.map(([id])=>obstacleReview.routeRecord(id)),stops);
      if(native.every((r,i)=>r&&Math.abs(r.m-stops[i][1])<=160))break;
    }
    // Each WebGL route job owns a single seed. Close its planner before the
    // first capture so SwiftShader never hosts two texture-heavy games at once.
    const isolated=renderer==='webgl' && Boolean(onlySeed);
    const browser=page.context().browser(), viewport=page.viewportSize();
    if(isolated)await page.close();
    for(const [i,[id]] of stops.entries()){
      const key='route-'+id+'-'+seed, live=native[i];
      assert(live,key+' naturally spawned on '+revision);
      assert(Math.abs(live.m-stops[i][1])<=240,key+' stays near the biome transition');
      const reference=routeReferences.get(key);
      if(revision==='after' && !(reference.version==='0.19.22' && live.version==='0.19.23')){
        assert.deepEqual([live.seed,live.x,live.snapshot.rngState],
          [reference.seed,reference.x,reference.snapshot.rngState],key+' native route parity');
      }
      // Preserve exact cross-revision physics checks by replaying the same
      // populated world, including actors, pickups, RNG and the pending spawn.
      if(revision==='before')routeReferences.set(key,live);
      const records=revision==='before'?[[key,live]]:[[key,routeReferences.get(key)],[key+'-native',live]];
      for(const [name,record] of records){
        const view=isolated?await browser.newPage({viewport,hasTouch:true}):page;
        try{
          const renderErrors=[];
          if(isolated){
            view.on('pageerror',error=>renderErrors.push(error.message));
            await openReview(view,revision);
          }
          const encounter=await view.evaluate(r=>obstacleReview.loadRoute(r),record);
          await waitForArt(view);
          const art=await view.evaluate(()=>obstacleReview.inspect());
          const dir=path.join(out,name,revision);
          await fs.mkdir(dir,{recursive:true});
          const trace=[];
          for(let frame=0;frame<18;frame++){
            const sample=await view.evaluate(()=>obstacleReview.routeFrame());
            trace.push(...sample.states);
            await fs.writeFile(path.join(dir,String(frame).padStart(3,'0')+'.jpg'),Buffer.from(sample.frame,'base64'));
          }
          await fs.writeFile(path.join(dir,'states.json'),JSON.stringify(trace));
          results[name]={encounter,art,trace:hash(trace)};
          console.log(revision,name,JSON.stringify(results[name]));
          assert.deepEqual(renderErrors,[]);
        }finally{if(isolated)await view.close();}
      }
    }
  }
}

async function captureGallery(page){
  const ids=await page.evaluate(()=>GRIM_OBSTACLE_SPRITES.filter(s=>s.category==='slide').map(s=>s.id));
  assert.equal(ids.length,40);
  const dir=path.join(out,'gallery');
  await fs.mkdir(dir,{recursive:true});
  const captures={};
  for(const id of ids){
    const setup=await page.evaluate(id=>obstacleReview.prepare({id,gallery:true}),id);
    await waitForArt(page);
    const memory=await page.evaluate(()=>{
      const s=grimRun.scene.scenes[0],cache=s.slidePaintCache;
      const bytes=Array.from(cache.values()).reduce((n,paint)=>n+paint.pixels.byteLength+paint.edge.byteLength,0);
      const sourceBytes=GRIM_OBSTACLE_SPRITES.filter(skin=>skin.landform).reduce((n,skin)=>{
        const image=s.textures.get(skin.key).getSourceImage();
        return n+image.width*image.height*4;
      },0);
      return {entries:cache.size,workingBytes:bytes,sourceBytes};
    });
    assert.ok(memory.entries<=5 && memory.workingBytes<6*1024*1024,'bounded world-resolution slide paint');
    captures[id]={mountMs:setup.mountMs,frameMs:setup.frameMs,memory,...await page.evaluate(()=>obstacleReview.inspect())};
    await page.screenshot({path:path.join(dir,id+'-phone-scene.png')});
    await page.evaluate(()=>obstacleReview.cleanup());
  }
  return captures;
}

async function openReview(page,revision){
  await page.goto('http://127.0.0.1:'+server.address().port+'/'+revision+'/?seed=33',{waitUntil:'domcontentloaded'});
  await page.locator('#home-enter-btn').click();await page.locator('#start-btn').click();
  await page.waitForFunction(()=>{const s=window.grimRun?.scene.scenes[0];
    return s?.state==='playing'&&s.motionArt?.rising&&s.motionArt.airReady&&s.motionArt.cutWeaponReady;},null,{timeout:90000});
  await page.evaluate(async()=>{await grimRun.scene.scenes[0].visuals.reviewLoad;});
  await page.addScriptTag({path:path.join(__dirname,'obstacle-review-scene.js')});
}

async function measure(page,revision,cases,extras=true,reviewPhase=phase,output=out){
  const {width,height}=page.viewportSize();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await openReview(page,revision);
  const actual=await page.evaluate(()=>[grimRun.renderer.type,grimRun.canvas.width,grimRun.canvas.height]);
  assert.deepEqual(actual,[renderer==='canvas'?1:2,width,height]);
  const results={};
  if(reviewPhase.startsWith('route')){
    await playTransitions(page,revision,results,Number(reviewPhase.slice(5)));
    assert.deepEqual(errors,[]);return results;
  }
  if(reviewPhase==='gallery'){
    if(revision==='after')results.gallery=await captureGallery(page);
    assert.deepEqual(errors,[]);return results;
  }
  for(const [id,seed,x,variant] of cases){
    const key=id+'-'+seed;
    const dir=path.join(output,key,revision);
    await fs.mkdir(dir,{recursive:true});
    try {
      const start=Date.now();
      const setup=await page.evaluate(spec=>obstacleReview.prepare(spec),{id,seed,x,variant});
      await waitForArt(page);
      const coldMs=Date.now()-start;
      const art=await page.evaluate(()=>obstacleReview.inspect());
      const states=[],times=[];
      for(let sample=0;sample<30;sample++){
        const save=width===740||[0,5,11,17,23,29].includes(sample);
        const value=await page.evaluate(save=>{
          const q=obstacleReview,states=[],times=[];
          for(let j=0;j<4;j++){
            const begin=performance.now();q.step();q.render();times.push(performance.now()-begin);states.push(q.signature());
          }
          return {states,times,bytes:save?q.image():null};
        },save);
        states.push(...value.states);times.push(...value.times);
        if(value.bytes)await fs.writeFile(path.join(dir,String(sample).padStart(3,'0')+'.jpg'),Buffer.from(value.bytes,'base64'));
      }
      const outcome=await page.evaluate(()=>obstacleReview.result);
      results[key]={setup,art,coldMs,cpu:stats(times.slice(20)),trace:hash(states),outcome};
      console.log(revision,key,JSON.stringify(results[key]));
      assert(outcome.inputSent && outcome.passed,key+' counter exercised through target');
      if(setup.type==='bramble')assert(outcome.firstCut!==null,key+' Cut contact exercised');
      if(setup.type==='tuckGate')assert(outcome.airTucked,key+' airborne tuck exercised');
      assert.equal(outcome.firstHit,null,key+' intended counter clears the contact');
      await page.evaluate(()=>obstacleReview.cleanup());
      const missed=await page.evaluate(spec=>{
        const q=obstacleReview;
        q.prepare(spec);
        for(let tick=0;tick<120 && q.result.firstHit===null;tick++)q.step(false);
        const result=q.result;
        q.cleanup();
        return {firstHit:result.firstHit,signature:q.signature()};
      },{id,seed,x,variant});
      assert.notEqual(missed.firstHit,null,key+' hazard damages the unprotected Reaper');
      results[key].unprotectedHitTick=missed.firstHit;
      results[key].unprotectedTrace=hash(missed.signature);
    } catch(error) {
      results[key]={error:error.message};
      console.error(revision,key,error.message);
      const frame=await page.evaluate(()=>obstacleReview.image());
      await fs.writeFile(path.join(dir,'diagnostic.jpg'),Buffer.from(frame,'base64'));
      await page.evaluate(()=>obstacleReview.cleanup());
    }
  }
  if(!extras){assert.deepEqual(errors,[]);return results;}
  const lifecycle=await page.evaluate(()=>{
    const q=obstacleReview;
    q.prepare({id:'forest_slide_dead-bough-curtain',seed:33,x:1050,variant:2});
    return q.exerciseMountLifecycle();
  });
  results.lifecycle={trace:hash(lifecycle),...lifecycle};
  const arrival=await page.evaluate(()=>{
    const q=obstacleReview;
    const states=q.startPortal();
    return {states,frame:q.image()};
  });
  results.portal={trace:hash(arrival.states),ticks:arrival.states.length};
  await fs.writeFile(path.join(out,'first-portal-'+revision+'.jpg'),Buffer.from(arrival.frame,'base64'));
  if(phase==='complete' && revision==='after' && width===740)results.gallery=await captureGallery(page);
  if(phase==='complete' && width===950) {
    try {await playTransitions(page,revision,results);}
    catch(error){results.routesFailure={error:error.message};console.error(revision,error.message);}
  }
  assert.deepEqual(errors,[]);
  return results;
}

(async()=>{
  await fs.mkdir(out,{recursive:true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,args:renderer==='canvas'?['--no-sandbox','--disable-webgl']:
    ['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const cases=['complete','controls'].includes(phase)?[...pilot,...remaining]:[];
    const summary={};
    for(const revision of ['before','after']){
      // Independent seeded starts use a fresh WebGL context. Natural
      // transitions and the rotation/rewind replay keep their context live.
      const batches=renderer==='webgl' ? [...cases.map(spec=>[spec]),[]] : [cases];
      summary[revision]={};
      for(let i=0;i<batches.length;i++){
        let firstLoadError;
        for(let attempt=0;attempt<2;attempt++){
          const page=await browser.newPage({viewport:{width,height},hasTouch:true});
          try{
            const captures=await measure(page,revision,batches[i],i===batches.length-1);
            Object.assign(summary[revision],captures);
            if(firstLoadError)summary[revision].sceneLoadRetry={firstLoadError};
            break;
          }catch(error){
            if(attempt || !error.message.includes('Scenery readiness:'))throw error;
            firstLoadError=error.message;
            console.warn(revision,phase,firstLoadError);
          }finally{await page.close();}
        }
        await fs.writeFile(path.join(out,summaryFile),JSON.stringify(summary,null,2));
      }
      // Atlas downloads can time out on shared software-rendering runners.
      // Retry a failed load once from a fresh page and preserve the diagnostic.
      for(const [key,previous] of Object.entries(summary[revision])){
        if(!previous.error?.includes('Scenery readiness:'))continue;
        const spec=cases.find(([id,seed])=>key===id+'-'+seed);
        if(!spec)continue;
        const retry=await browser.newPage({viewport:{width,height},hasTouch:true});
        try{
          const checked=await measure(retry,revision,[spec],false);
          summary[revision][key]={...checked[key],firstLoadError:previous.error};
        }finally{await retry.close();}
      }
      await fs.writeFile(path.join(out,summaryFile),JSON.stringify(summary,null,2));
    }
    for(const [revision,result] of Object.entries(summary))
      assert.deepEqual(Object.entries(result).filter(([,v])=>v.error),[],revision+' all captures complete');
    for(const key of Object.keys(summary.before).filter(k=>k!=='sceneLoadRetry')){
      assert.equal(summary.after[key].trace,summary.before[key].trace,key+' frame-for-frame gameplay parity');
      assert.equal(summary.after[key].unprotectedTrace,summary.before[key].unprotectedTrace,key+' missed counter parity');
    }
    // Reuse each renderer's landscape review to check the two shaded lips at desktop scale.
    if(viewport==='740x360' && phase===(renderer==='canvas'?'complete':'gallery')){
      const desktopDir=path.join(out,'desktop-1280x900'),desktop={};
      const shaded=pilot.filter(([id])=>id==='forest_slide_dead-bough-curtain'||id==='caves_slide_fossil-rib-arch');
      for(const revision of ['before','after']){
        const page=await browser.newPage({viewport:{width:1280,height:900}});
        try {desktop[revision]=await measure(page,revision,shaded,false,'controls',desktopDir);}
        finally {await page.close();}
      }
      await fs.writeFile(path.join(desktopDir,'summary.json'),JSON.stringify(desktop,null,2));
      for(const key of Object.keys(desktop.before)){
        const before=desktop.before[key],after=desktop.after[key];
        assert.ifError(before.error);assert.ifError(after.error);
        assert.equal(after.trace,before.trace,key+' desktop Slide parity');
        assert.equal(after.unprotectedTrace,before.unprotectedTrace,key+' desktop contact parity');
      }
    }
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
