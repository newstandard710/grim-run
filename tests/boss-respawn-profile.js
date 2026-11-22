'use strict';
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const {chromium}=require('playwright');

const [base,candidate,blockArg]=process.argv.slice(2);
const block=Number(blockArg);
assert.ok(base&&candidate&&Number.isInteger(block)&&block>=0&&block<4);
const spec={id:'boss_slide_bone-arch',seed:34,x:120441.60,variant:3};
const roots={A:path.resolve(base),B:path.resolve(candidate)};
const out=path.resolve('test-results/boss-respawn-profile','block-'+(block+1));
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
async function diagnostics(page){
  return page.evaluate(()=>{
    const s=grimRun.scene.scenes[0];
    return {...obstacleReview.diagnostics(),backdropGroup:s.biomeBackdropGroup,
      backdropPending:s.biomeBackdropPendingGroup,backdropFailures:[...s.biomeBackdropFailedGroups],
      terrainLoading:[...s.terrainMaterialLoading],terrainFailed:[...s.terrainMaterialFailed],
      terrainQueued:s.terrainMaterialQueue,contextLost:grimRun.renderer.gl.isContextLost(),
      recentResources:performance.getEntriesByType('resource').slice(-9).map(r=>({
        url:r.name.split('/').slice(-2).join('/'),ms:Math.round(r.duration),size:r.encodedBodySize}))};
  }).catch(e=>({diagnosticError:e.message}));
}
async function stage(page,spec){
  // Decode the exact production stream payloads before the stationary lab scene
  // requests them. Large SwiftShader queues can otherwise starve the stream's
  // 12s arrival timer and leave a required biome in its terminal failed set.
  // Phaser still registers the original source images through its own pump.
  const primed=await page.evaluate(async spec=>{
    const s=grimRun.scene.scenes[0],art=GRIM_BIOME_MIDGROUND,stream=s.biomeMidground.stream;
    const underworld=spec.x>=s.terrain.portalX;
    const wanted=new Set([spec.x-170,spec.x].flatMap(x=>art.planAtlases(
      (x-s.startX)/GRIM_CONFIG.pxPerMeter,underworld,true).wanted));
    const start=performance.now(),cache=new Map(),loader=stream.loader;
    for(const id of wanted)cache.set(id,await loader(id,AbortSignal.timeout(35000)));
    stream.loader=(id,signal)=>cache.has(id)?Promise.resolve(cache.get(id)):loader(id,signal);
    window.restorePortraitLoader=()=>{stream.loader=loader;cache.clear();};
    return {ids:[...wanted],ms:performance.now()-start};
  },spec);
  const placement=await page.evaluate(spec=>{
    const setup=obstacleReview.prepare(spec),s=grimRun.scene.scenes[0];
    s.requestTerrainMaterial(spec.id.split('_')[0]);
    return setup;
  },spec);
  try{
    const state=await page.waitForFunction(()=>{
      if(obstacleReview.ready())return 'ready';
      const d=obstacleReview.diagnostics(),s=grimRun.scene.scenes[0];
      if(d.failed.some(id=>d.weights[id]>0) || s.terrainMaterialFailed.has(d.skin.split('_')[0]) ||
        s.biomeBackdropFailedGroups.has(s.biomeBackdropGroup) || grimRun.renderer.gl.isContextLost())return 'failed';
      return false;
    },null,{polling:600,timeout:35000});
    if(await state.jsonValue()!=='ready')throw Error('Required scene art failed to register');
    return {placement,primed,diagnostics:await diagnostics(page)};
  }catch(cause){
    const state=await diagnostics(page);
    throw Error('Scenery readiness: '+JSON.stringify(state),{cause});
  }finally{
    await page.evaluate(()=>window.restorePortraitLoader?.()).catch(()=>{});
  }
}
async function boot(browser,rev,mode){
  const page=await browser.newPage({viewport:{width:360,height:740},hasTouch:true,deviceScaleFactor:1});
  try{
    page.on('pageerror',e=>console.error('browser exception',e));
    const catalog=await fs.readFile(path.join(mode==='common-source'?roots.A:roots[rev],'assets/visuals/obstacle-catalog.js'));
    await page.route('**/assets/visuals/obstacle-catalog.js*',route=>route.fulfill({
      contentType:'application/javascript',body:catalog}));
    await page.goto('http://127.0.0.1:'+server.address().port+'/'+rev+'/?seed=33',{waitUntil:'domcontentloaded'});
    await page.locator('#home-enter-btn').click();
    await page.waitForFunction(()=>window.grimRun?.scene.scenes[0]?.state==='menu');
    await page.evaluate(installProfiler,mode);
    await page.locator('#start-btn').click();
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
function installProfiler(mode){
  const game=grimRun,s=game.scene.scenes[0],tm=s.textures,gl=game.renderer.gl;
  const oldDraw=s.drawObstacle;
  if(mode!=='stock')s.drawObstacle=function(ob){
    if(ob.type!=='branch')return oldDraw.call(this,ob);
    // A QA-only negative control. Only the display path changes, starting
    // before the first run. The original collision and objects stay live.
  };
  let rec=null;
  const stack=[];
  function wrap(owner,key,name,event){
    if(typeof owner?.[key]!=='function')return;
    const original=owner[key];
    owner[key]=function(...args){
      if(!rec)return original.apply(this,args);
      const part=rec.calls[name]??(rec.calls[name]=[0,0,0,0]);
      const parent=stack.at(-1),call={name,child:0},start=performance.now();stack.push(call);
      try{return original.apply(this,args);}
      finally{
        const ms=performance.now()-start;stack.pop();if(parent)parent.child+=ms;
        part[0]++;part[1]+=ms;part[2]+=ms-call.child;part[3]=Math.max(part[3],ms);
        if(event)rec.events.push([name,event(this,args),ms]);
        if(ms>=6)rec.long.push([name,ms,ms-call.child,parent?.name]);
      }
    };
  }
  for(const k of ['drawScene','drawGround','drawGroundFog','drawCombat','drawForeground','drawParticles',
    'drawObstacle','cleanupObstacleSprites','updateBiomeBackdrops','drawReaper','drawVendors',
    'drawTerrainTexture','terrainTextureView','terrainSurfaceView','drawAbyssWallDetails',
    'abyssBackdropView','abyssFogView','pruneTerrainSurfaceViews','pruneTerrainTextureViews',
    'releaseInactiveTerrainMaterials','rescueFromAbyss','syncWorldScroll'])wrap(s,k,k);
  for(const [name,obj,methods] of [
    ['dressing',s.surfaceDressing,['render','paintBed']],['biome',s.biomeMidground,['render']],
    ['forest',s.forestMidground,['render']],['motion',s.motionArt,['render']],['visuals',s.visuals,['render']],
    ['polish',s.worldPolish,['beginFrame','endFrame']],['combat',s.combatArt,['render']],
    ['ridge',window.GRIM_RIDGE_SHOULDER,['paint']],['power',s.powerArt,['render']],
    ['vendor',s.vendorArt,['renderWorld','renderCinema']],['formation',s.reaperFormation,['render']],
    ['snow',s.snowTread,['draw']],['renderer',game.renderer,['canvasToTexture','createTexture2D','deleteTexture']],
    ['gl',gl,['texImage2D','texSubImage2D','deleteTexture','bufferData','readPixels']],
    ['canvas',window.CanvasRenderingContext2D?.prototype,['getImageData','putImageData','createImageData']],
    ['phaserCanvas',window.Phaser?.Textures?.CanvasTexture?.prototype,['refresh']]]){
    for(const k of methods)wrap(obj,k,name+'.'+k);
  }
  for(const op of ['createCanvas','remove','addAtlas','addImage'])wrap(tm,op,'textures.'+op,
    (_,args)=>[String(args[0]),...(op==='createCanvas'?args.slice(1,3):[])]);
  function keys(map){return [...(map?.keys()||[])];}
  function mapped(map){return [...map].map(([o,image])=>[o.type,o.x,image.texture?.key,image.depth,image.visible]);}
  window.prof={
    begin(){rec={calls:{},long:[],events:[]};},
    end(){const out=rec;rec=null;return out;},
    snapshot(){
      const relevant=new Set(GRIM_OBSTACLE_SPRITES.filter(v=>v.category==='slide')
        .flatMap(k=>[k.key,k.backKey,k.supportKey]).filter(Boolean));
      const raw=[],runtime=[];
      for(const [key,t] of Object.entries(tm.list)){
        if(!relevant.has(key)&&!/^obstacle-(mounted|registered)-/.test(key))continue;
        const obj=t.source?.[0];
        (relevant.has(key)?raw:runtime).push([key,obj?.width,obj?.height,!!obj?.glTexture]);
      }
      const st=s.biomeMidground.stream;
      return {state:s.state,x:s.player.x,y:s.player.y,cameraX:s.cameraX,cameraY:s.cameraY,fall:s.fallCount,
        obstacles:s.obstacles.map(o=>[o.type,o.x,o.destroyed]),
        maps:[s.obstacleSpriteObjects,s.obstacleSupportObjects,s.obstacleBackObjects].map(mapped),
        textures:{raw,runtime,total:Object.keys(tm.list).length},
        terrain:{ready:[...s.terrainMaterialIds],queue:s.terrainMaterialQueue,loading:[...s.terrainMaterialLoading],
          failed:[...s.terrainMaterialFailed],body:keys(s.terrainTextureViews),surface:keys(s.terrainSurfaceViews),
          abyss:keys(s.abyssBackdropViews),fog:keys(s.abyssFogViews)},
        midground:{loaded:keys(st.loaded),wanted:st.wanted,pending:st.pending?.id,failed:[...st.failed]},
        backdrop:{ready:s.biomeBackdropReady,pending:s.biomeBackdropPendingGroup,group:s.biomeBackdropGroup},
        heap:performance.memory?.usedJSHeapSize,now:performance.now()};
    }
  };
}
async function trial(page,rev,mode){
  const initial=await page.evaluate(()=>prof.snapshot());
  await page.evaluate(()=>prof.begin());
  const staged=await stage(page,spec);
  const setup=await page.evaluate(()=>({work:prof.end(),scene:prof.snapshot()}));
  const sourceCount=setup.scene.textures.raw.length;
  assert.equal(sourceCount,rev==='A'||mode==='common-source'?72:24);
  assert.equal(setup.scene.maps.some(m=>m.some(item=>item[0]==='branch')),mode==='stock');
  await page.evaluate(()=>{for(let i=0;i<6;i++)obstacleReview.render();grimRun.renderer.gl.finish();});
  const trace=[],frames=[],synchronized=[],snapshots={0:setup.scene};
  for(let batch=0;batch<40;batch++){
    const row=await page.evaluate(({batch,capture})=>{
      const q=obstacleReview,frames=[],states=[],snapshots={};
      for(let i=0;i<4;i++){
        const tick=4*batch+i+1;
        prof.begin();
        const wallStart=performance.now();q.step();const split=performance.now();
        q.render();const wallEnd=performance.now();
        frames.push({tick,wallStart,wallEnd,ms:wallEnd-wallStart,update:split-wallStart,
          render:wallEnd-split,work:prof.end()});
        states.push(q.signature());
        if([1,50,85,86,105,109,110,114,115,116,117,118,119,120,121,130,160].includes(tick))
          snapshots[tick]=prof.snapshot();
      }
      let readback=null,jpeg=null;
      if(capture){const start=performance.now();jpeg=q.image();const end=performance.now();readback={tick:4*batch+4,start,end,ms:end-start};}
      return {frames,states,snapshots,readback,jpeg};
    },{batch,capture:[0,5,11,17,23,29].includes(batch)});
    frames.push(...row.frames);trace.push(...row.states);Object.assign(snapshots,row.snapshots);
    if(row.readback){assert.ok(row.jpeg.length>1000);synchronized.push(row.readback);}
  }
  const signature=hash(trace);
  assert.equal(signature,'258c0547e2da42b61d4a2e0bb55a1c35b8572ba9ff47fa3634e44843b530af45');
  assert.ok(frames.slice(85).every(f=>!f.work.calls.drawObstacle),'No world obstacle drawn from tick 86 onward');
  assert.ok(Object.values(snapshots).filter(v=>v.state==='respawning').every(v=>
    !v.obstacles.length&&v.maps.every(m=>!m.length)&&!v.textures.runtime.length),'No active or generated slide at respawn');
  const funcs={};
  for(const f of frames.slice(114,120))for(const [name,v] of Object.entries(f.work.calls)){
    const a=funcs[name]??(funcs[name]=[0,0,0,0]);a[0]+=v[0];a[1]+=v[1];a[2]+=v[2];a[3]=Math.max(a[3],v[3]);
  }
  const sums=(from,to)=>frames.slice(from-1,to).reduce((n,f)=>n+f.ms,0);
  const sweep={cpu115to120:sums(115,120),wall115to120:frames[119].wallEnd-frames[114].wallStart,
    throughReadback115to120:synchronized.at(-1).end-frames[114].wallStart,
    syncedWall97to120:synchronized.at(-1).end-synchronized.at(-2).end,
    warm:stats(frames.slice(20,120).map(f=>f.ms)),selfMs:Object.entries(funcs).sort((a,b)=>b[1][2]-a[1][2])};
  return {rev,mode,initial,staged,setup,signature,sweep,frames,snapshots,synchronized};
}
async function main(){
  await fs.mkdir(out,{recursive:true});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const modeOrders=[['stock','no-mount','common-source'],['common-source','stock','no-mount'],
    ['no-mount','common-source','stock'],['common-source','no-mount','stock']];
  const report={block,builds:Object.fromEntries(Object.entries(roots).map(([k,v])=>[k,
    execFileSync('git',['-C',v,'rev-parse','HEAD'],{encoding:'utf8'}).trim()])),trials:[]};
  try{
    for(const [i,mode] of modeOrders[block].entries()){
      const order=(block+i)%2?'BA':'AB';
      for(const rev of order){
        for(let attempt=1;attempt<=2;attempt++){
          let page;
          try{
            page=await boot(browser,rev,mode);
            const result=await trial(page,rev,mode);
            await fs.writeFile(path.join(out,mode+'-'+rev+'.json'),JSON.stringify(result));
            report.trials.push({rev,mode,attempt,sweep:result.sweep,
              sources:result.setup.scene.textures.raw.length,setup:result.staged.placement});
            await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(report,null,2));
            console.log(mode,rev,result.sweep.warm,result.sweep.cpu115to120,result.sweep.selfMs.slice(0,5));break;
          }catch(e){
            const state=page?await diagnostics(page):null;
            console.error(mode,rev,attempt,e.stack,state);
            await fs.writeFile(path.join(out,mode+'-'+rev+'-attempt-'+attempt+'.json'),JSON.stringify({error:e.stack,state}));
            if(attempt===2||e.name==='AssertionError')throw e;
          }finally{if(page)await page.close();}
        }
      }
    }
  }finally{await browser.close();await new Promise(ok=>server.close(ok));}
}
main().catch(e=>{console.error(e);server.close();process.exitCode=1;});
