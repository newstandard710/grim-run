'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const http=require('node:http');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {chromium}=require('playwright');

const candidate=path.resolve(__dirname,'..');
const [baselineArg,renderer,viewport]=process.argv.slice(2);
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

async function measure(page,revision,cases){
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/'+revision+'/?seed=33',{waitUntil:'domcontentloaded'});
  await page.locator('#home-enter-btn').click();await page.locator('#start-btn').click();
  await page.waitForFunction(()=>{const s=window.grimRun?.scene.scenes[0];
    return s?.state==='playing'&&s.motionArt?.rising&&s.motionArt.airReady&&s.motionArt.cutWeaponReady;},null,{timeout:90000});
  await page.evaluate(async()=>{await grimRun.scene.scenes[0].visuals.reviewLoad;});
  await page.addScriptTag({path:path.join(__dirname,'obstacle-review-scene.js')});
  const actual=await page.evaluate(()=>[grimRun.renderer.type,grimRun.canvas.width,grimRun.canvas.height]);
  assert.deepEqual(actual,[renderer==='canvas'?1:2,width,height]);
  const results={};
  for(const [id,seed,x,variant] of cases){
    const key=id+'-'+seed;
    const dir=path.join(out,key,revision);
    await fs.mkdir(dir,{recursive:true});
    const start=Date.now();
    const setup=await page.evaluate(spec=>obstacleReview.prepare(spec),{id,seed,x,variant});
    await page.waitForFunction(()=>obstacleReview.ready(),null,{timeout:45000});
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
  }
  const arrival=await page.evaluate(()=>{
    const q=obstacleReview;
    const states=q.startPortal();
    return {states,frame:q.image()};
  });
  results.portal={trace:hash(arrival.states),ticks:arrival.states.length};
  await fs.writeFile(path.join(out,'first-portal-'+revision+'.jpg'),Buffer.from(arrival.frame,'base64'));
  assert.deepEqual(errors,[]);
  return results;
}

(async()=>{
  await fs.mkdir(out,{recursive:true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,args:renderer==='canvas'?['--no-sandbox','--disable-webgl']:
    ['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const cases=[...pilot,...remaining];
    const summary={};
    for(const revision of ['before','after']){
      const page=await browser.newPage({viewport:{width,height},hasTouch:true});
      try{summary[revision]=await measure(page,revision,cases);}
      finally{await page.close();}
      await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(summary,null,2));
    }
    for(const key of Object.keys(summary.before)){
      assert.equal(summary.after[key].trace,summary.before[key].trace,key+' frame-for-frame gameplay parity');
      assert.equal(summary.after[key].unprotectedTrace,summary.before[key].unprotectedTrace,key+' missed counter parity');
    }
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
