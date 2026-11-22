'use strict';
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const {chromium}=require('playwright');

const [base,candidate,target]=process.argv.slice(2);
const cases={
  boss:{id:'boss_slide_bone-arch',seed:34,x:120441.60,variant:3},
  ashlands:{id:'ashlands_slide_basalt-shelf',seed:34,x:84588.48,variant:3},
  forest:{id:'forest_slide_root-shelf',seed:39,x:10901.7025,variant:5},
  control:{id:'tundra_cut_frozen-dead-pine',seed:34,x:57640.14732234026,variant:3}
};
assert.ok(base&&candidate&&cases[target]&&target!=='control','BASE CANDIDATE boss|ashlands|forest');
const roots={A:path.resolve(base),B:path.resolve(candidate)};
const out=path.resolve('test-results/portrait-pairs',target);
const mime={'.html':'text/html','.js':'application/javascript','.png':'image/png','.webp':'image/webp',
  '.css':'text/css','.svg':'image/svg+xml','.ttf':'font/ttf','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
  const [,rev,...segments]=new URL(req.url,'http://localhost').pathname.split('/');
  if(!roots[rev])return res.writeHead(404).end();
  const file=path.resolve(roots[rev],segments.join('/')||'index.html');
  if(!file.startsWith(roots[rev]+path.sep))return res.writeHead(403).end();
  try{
    const data=await fs.readFile(file);
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data);
  }catch{res.writeHead(404).end();}
});
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const round=n=>Math.round(n*1000)/1000;
function stats(values){
  if(!values.length)return {n:0};
  const a=[...values].sort((v,w)=>v-w);
  const at=q=>round(a[Math.ceil(q*a.length)-1]);
  return {n:a.length,median:at(.5),p95:at(.95),p99:at(.99),max:at(1)};
}
async function ready(page){
  await page.waitForFunction(()=>obstacleReview.ready(),null,{polling:180,timeout:45000});
}
async function boot(browser,rev){
  const page=await browser.newPage({viewport:{width:360,height:740},hasTouch:true,deviceScaleFactor:1});
  try{
    page.on('pageerror',e=>console.error('browser exception',e));
    await page.goto('http://127.0.0.1:'+server.address().port+'/'+rev+'/?seed=33',{waitUntil:'domcontentloaded'});
    await page.locator('#home-enter-btn').click();await page.locator('#start-btn').click();
    await page.waitForFunction(()=>{
      const s=window.grimRun?.scene.scenes[0];
      return s?.state==='playing'&&s.motionArt?.rising&&s.motionArt.airReady&&s.motionArt.cutWeaponReady;
    },null,{timeout:90000});
    await page.evaluate(()=>grimRun.scene.scenes[0].visuals.reviewLoad);
    // Baseline fixture on both sides gives identical readiness, pixel inspection,
    // warmup and rendering work. Game modules come from their own build.
    await page.addScriptTag({path:path.join(roots.A,'tests/obstacle-review-scene.js')});
    assert.deepEqual(await page.evaluate(()=>[grimRun.renderer.type,grimRun.canvas.width,grimRun.canvas.height]),[2,360,740]);
    return page;
  }catch(e){await page.close();throw e;}
}
async function sample(page,spec,steadyOrder){
  const begin=Date.now();
  const placement=await page.evaluate(s=>obstacleReview.prepare(s),spec);
  await ready(page);
  const readinessMs=Date.now()-begin;
  const paint=await page.evaluate(()=>obstacleReview.inspect());
  await page.evaluate(()=>{
    const s=grimRun.scene.scenes[0],ob=s.obstacles[0],camera=s.cameras.main;
    const maps=[s.obstacleSpriteObjects,s.obstacleSupportObjects,s.obstacleBackObjects];
    let previous=[];
    window.portraitMap=()=>{
      const layers=maps.map(m=>m?.get(ob));
      let mask=0,onscreen=0,replaced=0;
      for(let i=0;i<layers.length;i++){
        const image=layers[i];
        if(!image)continue;
        mask|=1<<i;
        if(previous[i] && previous[i]!==image)replaced|=1<<i;
        if(!image.visible)continue;
        const a=image.getBounds(),b=camera.worldView;
        if(a.right>b.left && a.left<b.right && a.bottom>b.top && a.top<b.bottom)onscreen|=1<<i;
      }
      previous=layers;
      return {mask,onscreen,replaced,past:s.player.x>ob.x+ob.width,
        occupied:s.player.x>=ob.x-28&&s.player.x<=ob.x+ob.width+28,
        pending:s.biomeMidground?.stream?.pending?.id??null};
    };
  });
  const frames=[],trace=[];
  for(let batch=0;batch<40;batch++){
    // Original review uses four ticks/evaluation and six synchronized JPEG
    // reads over 120 moving frames. The additional 40 ticks measure departure.
    const capture=[0,5,11,17,23,29].includes(batch);
    const data=await page.evaluate(capture=>{
      const r=obstacleReview,times=[],states=[];
      for(let i=0;i<4;i++){
        const start=performance.now();r.step();const split=performance.now();
        r.render();const end=performance.now();
        times.push({ms:end-start,update:split-start,render:end-split,...portraitMap()});
        states.push(r.signature());
      }
      return {times,states,jpeg:capture?r.image():null};
    },capture);
    frames.push(...data.times);trace.push(...data.states);
    if(capture)assert.ok(data.jpeg.length>1000);
  }
  const outcome=await page.evaluate(()=>obstacleReview.result);
  assert.ok(outcome.passed&&outcome.inputSent&&outcome.firstHit===null,spec.id+' ordinary interaction');
  const warm=frames.slice(20,120);
  const summary={};
  for(const [name,part] of Object.entries({warm,visible:frames.slice(0,120).filter(v=>v.onscreen),
    overlap:frames.filter(v=>v.occupied),afterContact:frames.filter(v=>v.past),
    offscreen:frames.filter(v=>v.past&&!v.onscreen),departed:frames.slice(120)})){
    summary[name]=stats(part.map(f=>f.ms));
  }
  summary.warmUpdate=stats(warm.map(f=>f.update));summary.warmRender=stats(warm.map(f=>f.render));
  // Re-stage after the timed traversal so the synchronized diagnostic cannot
  // influence its queues. Compare identical stationary frames with the target
  // display objects visible or hidden. An explicit finish includes GPU work.
  await page.evaluate(s=>obstacleReview.prepare(s),spec);await ready(page);
  const steady=await page.evaluate(order=>{
    const game=grimRun,s=game.scene.scenes[0],gl=game.renderer.gl,ob=s.obstacles[0];
    const views=[s.obstacleSpriteObjects,s.obstacleSupportObjects,s.obstacleBackObjects]
      .map(map=>map?.get(ob)).filter(Boolean);
    const phases=[];
    for(const shown of order){
      for(const v of views)v.setVisible(shown);
      obstacleReview.render();gl.finish();
      const times=[];
      for(let i=0;i<12;i++){
        const start=performance.now();obstacleReview.render();const submit=performance.now();
        gl.finish();times.push({ms:performance.now()-start,cpu:submit-start});
      }
      phases.push({shown,times});
    }
    for(const v of views)v.setVisible(true);
    return phases;
  },steadyOrder);
  for(const shown of [true,false]){
    const times=steady.filter(p=>p.shown===shown).flatMap(p=>p.times);
    summary[shown?'stationaryShown':'stationaryHidden']=stats(times.map(t=>t.ms));
  }
  await page.evaluate(()=>obstacleReview.cleanup());
  return {placement,readinessMs,paint,outcome,signature:hash(trace),summary,frames,steady};
}
function compare(a,b){
  const result={};
  for(const phase of Object.keys(a.summary)){
    const av=a.summary[phase],bv=b.summary[phase];
    if(!av.n||!bv.n)continue;
    result[phase]={A:av,B:bv};
    for(const q of ['median','p95','p99']){
      result[phase][q]={deltaMs:round(bv[q]-av[q]),ratio:av[q]?round(bv[q]/av[q]):null};
    }
  }
  result.mountMs={A:a.placement.mountMs,B:b.placement.mountMs};
  return result;
}
async function main(){
  await fs.mkdir(out,{recursive:true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const runs=[],pairs=[],blocks=[],baseline=new Map();
  const meta={target,cases:[cases[target],cases.control],cpu:os.cpus()[0]?.model,
    cpus:os.cpus().length,chromium:browser.version(),runner:process.env.RUNNER_NAME,
    revisions:Object.fromEntries(Object.entries(roots).map(([rev,root])=>[rev,
      execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim()]))};
  const save=()=>fs.writeFile(path.join(out,'summary.json'),JSON.stringify({meta,runs,pairs,blocks},null,2));
  try{
    for(let block=0;block<4;block++){
      const order=block%2?'BAAB':'ABBA';
      const segment=[];
      for(let slot=0;slot<4;slot++){
        const rev=order[slot],page=await boot(browser,rev);
        try{
          const results={};
          // Alternate which encounter pays first-scene overhead between blocks,
          // keeping that choice identical for all four A/B trials in a block.
          for(const label of block%2?['control',target]:[target,'control']){
            const r=await sample(page,cases[label],block%2?[false,true,true,false]:[true,false,false,true]);
            const ref=baseline.get(label);
            if(ref)assert.equal(r.signature,ref,label+' identical moving gameplay trace');else baseline.set(label,r.signature);
            const name='block-'+(block+1)+'-slot-'+(slot+1)+'-'+rev+'-'+label+'.json';
            await fs.writeFile(path.join(out,name),JSON.stringify(r));
            const occupancy={};
            for(const [k,fn] of Object.entries({mapped:x=>x.mask,visibleBounds:x=>x.onscreen,
              passedAndOffscreen:x=>x.past&&!x.onscreen,passedAndUnmapped:x=>x.past&&!x.mask,
              rebuilt:x=>x.replaced,pendingStream:x=>x.pending})){
              const samples=r.frames.filter(fn);
              occupancy[k]={frames:samples.length,timedMs:round(samples.reduce((n,f)=>n+f.ms,0))};
            }
            results[label]={file:name,summary:r.summary,placement:r.placement,occupancy};
          }
          const row={block:block+1,slot:slot+1,rev,results};runs.push(row);segment.push(row);
          console.log(block+1,slot+1,rev,JSON.stringify(Object.fromEntries(Object.entries(results)
            .map(([k,v])=>[k,v.summary.warm]))));
          await save();
        }finally{await page.close();}
      }
      const blockPairs=[];
      for(const [i,j] of [[0,1],[2,3]]){
        const [a,b]=segment[i].rev==='A'?[segment[i],segment[j]]:[segment[j],segment[i]];
        const trial={block:block+1,A:a.slot,B:b.slot,
          encounter:compare(a.results[target],b.results[target]),control:compare(a.results.control,b.results.control)};
        pairs.push(trial);blockPairs.push(trial);
      }
      const result={block:block+1,order};
      for(const q of ['median','p95','p99']){
        const encounterMs=mean(blockPairs.map(p=>p.encounter.warm[q].deltaMs));
        const controlMs=mean(blockPairs.map(p=>p.control.warm[q].deltaMs));
        result[q]={encounterMs:round(encounterMs),controlMs:round(controlMs),excessMs:round(encounterMs-controlMs)};
      }
      blocks.push(result);await save();console.log('paired block',JSON.stringify(result));
    }
  }finally{await save();await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(err=>{console.error(err);server.close();process.exitCode=1;});
