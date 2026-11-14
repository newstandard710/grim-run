'use strict';

const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require('playwright');
const {PNG} = require('pngjs');

const root = path.resolve(__dirname, '..');
const baseline = '4b3dcf30f9520551c1ea97398ce41fdf1f6a3f54';
const outputs = path.resolve(process.env.GRIM_ABYSS_OUTPUT || 'test-results/abyss-review');
const mime = {'.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json',
  '.ttf': 'font/ttf', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml'};
const server = http.createServer((req, res) => {
  try {
    const {pathname} = new URL(req.url, 'http://localhost');
    const file = path.resolve(root, '.' + decodeURIComponent(pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'});
    res.end(pathname === '/forest-baseline.html' ?
      execFileSync('git', ['show', baseline + ':index.html'], {cwd: root}) : fs.readFileSync(file));
  } catch {
    if (!res.headersSent) res.writeHead(404);
    res.end();
  }
});

const native = [['foothills', 1500], ['tundra', 3500], ['caves', 5500], ['crystals', 6500],
  ['ashlands', 7500], ['lava', 8500], ['boss', 11500]];
const blends = [['forest-foothills', 900], ['foothills-tundra', 2300], ['caves-crystals', 6000],
  ['crystals-ashlands', 7000], ['ashlands-lava', 8000], ['lava-boss', 9999]];

async function setup(browser, viewport, options = {}) {
  const page = await browser.newPage({viewport, hasTouch: true});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  if (options.routes) await options.routes(page);
  await page.goto(`http://127.0.0.1:${server.address().port}/${options.baseline ? 'forest-baseline.html' : ''}?seed=33${options.off ? '&biomeMidground=0' : ''}`);
  await page.waitForFunction(() => window.grimRun?.scene.scenes[0]?.visuals?.reaperReady &&
    window.GRIM_FRONTEND?.ready, null, {timeout: 90000});
  await page.evaluate(async () => {
    const game = window.grimRun;
    const scene = game.scene.scenes[0];
    await scene.visuals.reviewLoad;
    scene.sys.sceneUpdate = () => {};
    clearInterval(scene.loopWatchdogId);
    scene.enterHome();
    scene.startRun();
    scene.setGodMode(true);
    game.loop.sleep();

    const config = window.GRIM_CONFIG, core = window.GRIM_CORE;
    const place = meters => {
      const x = scene.startX + meters * config.pxPerMeter;
      scene.terrain.advance(x + scene.width + 800);
      const y = scene.terrain.groundAt(x) ?? scene.terrain.anchorAt(x);
      Object.assign(scene.player, {x, y, grounded: true, velocityY: 0});
      Object.assign(scene, {distance: meters, hasTeleported: meters >= 5000, state: 'playing',
        speed: core.runSpeed(meters), cameraX: x - scene.width * config.reaperXRatio, cameraY: y - scene.groundY,
        fallFeedbackMs: 0, respawnMs: 0, damageFlashMs: 0, goFlashMs: 0});
      scene.cameras.main.setScroll(scene.cameraX, scene.cameraY);
      scene.ui.setMode('playing');
      scene.refreshHud();
      scene.drawScene();
    };
    const stageGap = (distance, variant='center') => {
      const target=scene.startX+distance*config.pxPerMeter;
      scene.terrain.advance(target+3000);
      const gaps=scene.terrain.segments.filter(g=>g.kind==='gap'&&Math.abs((g.start+g.end)*.5-target)<7500&&((g.start>=scene.terrain.portalExitX)===(distance>=5000)));
      const ordered=gaps.sort((a,b)=>variant==='wide'?(b.end-b.start)-(a.end-a.start):
        variant==='narrow'?(a.end-a.start)-(b.end-b.start):
        variant==='slope'?Math.abs(b.y1-b.y0)-Math.abs(a.y1-a.y0):
        Math.abs((a.start+a.end)*.5-target)-Math.abs((b.start+b.end)*.5-target));
      const gap=ordered[0];
      if(!gap)throw Error('No gap around '+distance);
      if(variant==='slope'&&gap.y0===gap.y1){
        const bank=scene.terrain.segments[scene.terrain.segments.indexOf(gap)+1];
        gap.y1-=30;bank.y0=gap.y1;
      }
      place((gap.start-scene.startX-74)/config.pxPerMeter);
      scene.state='playing';
      scene.distance=distance;
      scene.cameraX=(gap.start+gap.end)*.5-scene.width*.5;
      scene.cameraY=Math.min(gap.y0,gap.y1)-scene.height*.53;
      scene.cameras.main.setScroll(scene.cameraX,scene.cameraY);
      scene.drawScene();
      return gap;
    };
    const snapshot = () => JSON.stringify({
      rng: scene.rng.state, player: scene.player, x: scene.cameraX, y: scene.cameraY,
      distance: scene.distance, elapsed: scene.elapsed, state: scene.state, terrain: scene.terrain.segments,
      obstacles: scene.obstacles, enemies: scene.enemies, coins: scene.coins, souls: scene.souls,
      points: scene.points, nextEncounterX: scene.nextEncounterX, vendorOffers: scene.pendingOffers
    });
    let renderTime = 0;
    const frame = () => {
      // Phaser tweens use the game's step time even with simulation paused.
      renderTime += 1000 / 15;
      game.step(renderTime, 1000 / 15);
      return game.canvas.toDataURL('image/png');
    };
    window.biomeReview = {game, scene, stageGap, snapshot, frame};
  });
  return {page, errors};
}

const writeFrame = (file, data) => fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));

async function abyssParity(browser){
  const viewport={width:740,height:360};
  const checkpoints=[];
  const stage=async(baseline,distance)=>{
    const {page,errors}=await setup(browser,viewport,{baseline});
    try{
      const result=await page.evaluate(distance=>{
        const b=window.biomeReview,s=b.scene;
        const gap=b.stageGap(distance);
        // Restore exact camera follow bookkeeping after the capture fixture.
        const record=()=>JSON.stringify({
          snapshot:b.snapshot(),rewind:s.rewindClockMs,
          generatedThrough:s.terrain.generatedThrough,groupCount:s.terrain.groupCount,
          gap:gap.kind,falls:s.fallCount,gameSpeed:s.speed
        });
        const records=[record()];
        for(let i=0;i<150;i++){
          if(i===3)s.jump();
          if(i===20)s.jumpEnd();
          if(i===47)s.attack();
          s.update(0,1000/60);
          if(i%10===0)records.push(record());
        }
        // This invokes the genuine gameplay mutation, then exercises redraw
        // and the same gap-to-rubble transition in each build.
        records.push(s.terrain.fillGaps(gap.start,gap.end),record());
        s.drawScene();
        if(s.abyssWallCache){
          const active=[...s.abyssFogViews.keys()];
          if(active.some(key=>key.startsWith(gap.start+':'+gap.end+':')))
            throw Error('Closed gap still owns abyss mist');
        }
        return records;
      },distance);
      assert.deepEqual(errors,[]);
      return result;
    }finally{await page.close();}
  };
  for(const distance of [766,1800,3500,5500,6500,7500,8500,19500]){
    const current=await stage(false,distance),old=await stage(true,distance);
    assert(current.length===old.length&&current.every((v,i)=>v===old[i]),'Gameplay/RNG parity at '+distance);
    checkpoints.push(distance);
  }
  return {checkpoints,steps:1200};
}
async function isolatedFog(page){
  await page.evaluate(()=>window.biomeReview.stageGap(766));
  await page.waitForFunction(()=>{
    const {scene:s}=window.biomeReview;
    return !s.load.isLoading()&&!s.terrainMaterialLoading.size&&s.abyssFogViews.size>0;
  },null,{polling:100});
  const shot=await page.evaluate(()=>{
    const b=window.biomeReview,s=b.scene,gap=b.stageGap(766);
    for(const child of s.children.list)child.setVisible(false);
    for(const bank of s.groundFogViews.values())bank.setVisible(true);
    for(const view of s.abyssFogViews.values())view.sprite.setVisible(false);
    s.cameras.main.setBackgroundColor('#000000');
    return {data:b.frame(),start:gap.start-s.cameraX,end:gap.end-s.cameraX,
      y:gap.y0-s.cameraY,webgl:b.game.renderer.type===Phaser.WEBGL};
  });
  const png=PNG.sync.read(Buffer.from(shot.data.split(',')[1],'base64'));
  const column=x=>{
    let light=0;
    for(let y=Math.round(shot.y)-60;y<Math.round(shot.y)+4;y++){
      const p=(y*png.width+x)*4;
      light+=Math.max(png.data[p],png.data[p+1],png.data[p+2]);
    }
    return light;
  };
  const start=Math.ceil(shot.start),end=Math.floor(shot.end);
  for(let x=start+1;x<end;x++)assert.equal(column(x),0,'No surface fog inside the gap at '+x);
  const side=(edge,direction)=>[2,10,22,40,57].map(px=>column(edge+direction*px));
  const left=side(start,-1),right=side(end,1);
  assert(left[4]+right[4]>100,'Ground fog is visible on the solid banks');
  assert(left[0]+right[0]<.35*(left[3]+right[3]),'Fog feathers into the rims');
  fs.writeFileSync(path.join(outputs,'isolated-fog.json'),JSON.stringify({left,right,webgl:shot.webgl}));
  const depthShot=await page.evaluate(()=>{
    const b=window.biomeReview,s=b.scene,gap=b.stageGap(766);
    s.cameraY+=110;s.cameras.main.setScroll(s.cameraX,s.cameraY);
    s.drawScene();
    for(const child of s.children.list)child.setVisible(false);
    for(const mist of s.abyssFogViews.values())mist.sprite.setVisible(false);
    const view=[...s.abyssFogViews.entries()]
      .find(([key])=>key.startsWith(gap.start+':'+gap.end+':'))?.[1];
    if(!view)throw Error('The inspected gap has no abyss mist');
    view.sprite.setVisible(true);
    s.cameras.main.setBackgroundColor('#000000');
    return {data:b.frame(),start:gap.start-s.cameraX,end:gap.end-s.cameraX,y:gap.y0-s.cameraY};
  });
  const depth=PNG.sync.read(Buffer.from(depthShot.data.split(',')[1],'base64'));
  let above=0,below=0;
  for(let y=Math.max(0,Math.round(depthShot.y));y<depth.height;y++){
    for(let x=Math.ceil(depthShot.start)+3;x<Math.floor(depthShot.end)-3;x++){
      const i=(y*depth.width+x)*4;
      const value=Math.max(depth.data[i],depth.data[i+1],depth.data[i+2]);
      if(y<depthShot.y+65)above=Math.max(above,value);
      else below=Math.max(below,value);
    }
  }
  assert.equal(above,0,'Abyss mist stays below the rim');
  assert(below>3&&below<70,'Abyss mist is visible and subdued: '+below);

  return {left,right,webgl:shot.webgl,below};
}

async function abyssReview(browser){
  const cases=[['forest',766],...native,...blends];
  const stats={};let viewport={width:740,height:360};
  let session=await setup(browser,viewport);
  const record=async(name,distance,variant)=>{
    const {page,errors}=session;
    const gap=await page.evaluate(({distance,variant})=>window.biomeReview.stageGap(distance,variant),{distance,variant});
    await page.waitForFunction(()=>{
      const {scene:s}=window.biomeReview;
      s.drawScene();
      return !s.terrainMaterialLoading.size&&s.abyssFogViews.size>0&&s.abyssBackdropViews.size>0;
    },null,{polling:100,timeout:18000});
    const dir=path.join(outputs,name);fs.mkdirSync(dir,{recursive:true});
    const samples=[];
    for(let i=0;i<14;i++){
      const shot=await page.evaluate(i=>{
        const b=window.biomeReview,s=b.scene;
        const before=performance.now();
        s.cameraX+=4;
        s.cameraY+=i>=6?6:0;
        s.elapsed+=1/15;
        s.cameras.main.setScroll(s.cameraX,s.cameraY);
        s.drawScene();
        const ms=performance.now()-before;
        return {data:b.frame(),ms,wallCache:s.abyssWallCache.size,bankViews:s.groundFogViews.size,
          canyonViews:s.abyssFogViews.size,renderer:b.game.renderer.type};
      },i);
      writeFrame(path.join(dir,String(i).padStart(3,'0')+'.png'),shot.data);
      delete shot.data;samples.push(shot);
    }
    assert.deepEqual(errors,[],name);
    stats[name]={gap:gap.end-gap.start,rise:gap.y1-gap.y0,samples};
    console.log('PASS',name,'gap',gap.end-gap.start,'y delta',gap.y1-gap.y0);
  };
  try {
    for(const [id,m] of cases)await record(id,m,'center');
    await record('narrow',6500,'narrow');
    await record('wide',8500,'wide');
    await record('unequal-lips',1800,'slope');
    await record('first-caves-gap-after-portal',5026,'center');
    await record('extended-boss',19500,'center');
    await session.page.close();
    viewport={width:950,height:430};session=await setup(browser,viewport);
    for(const [id,m] of [['forest',766],...native])await record(id+'-desktop',m,'center');
    await session.page.setViewportSize({width:360,height:740});
    await waitForResize(session.page,360,740);
    await record('portrait',6500,'narrow');
    await session.page.setViewportSize({width:740,height:360});
    await waitForResize(session.page,740,360);
    await record('rotated-back',19500,'center');
  } finally {
    await session.page.close();
    fs.writeFileSync(path.join(outputs,'abyss-metrics.json'),JSON.stringify(stats,null,2));
  }
}

async function main(){
  fs.mkdirSync(outputs,{recursive:true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const canvas=process.env.GRIM_ABYSS_RENDERER==='canvas';
  const browser=await chromium.launch({headless:true,args:['--no-sandbox',
    canvas?'--disable-webgl':'--use-angle=swiftshader']});
  try{
    if(process.env.GRIM_ABYSS_PIXELS==='1'){
      const session=await setup(browser,{width:740,height:360});
      try{
        const result=await isolatedFog(session.page);
        assert.equal(result.webgl,!canvas);
        assert.deepEqual(session.errors,[]);
        console.log('PASS isolated surface and abyss fog',result);
      }
      finally{await session.page.close();}
    }else if(process.env.GRIM_ABYSS_PARITY==='1'){
      const parity=await abyssParity(browser);
      fs.writeFileSync(path.join(outputs,'parity.json'),JSON.stringify(parity,null,2));
      console.log('PASS gameplay and RNG against the live baseline',parity.steps,'steps');
    }else await abyssReview(browser);
  }finally{
    await browser.close();server.close();
  }
}
async function waitForResize(page, width, height) {
  await page.waitForFunction(([w, h]) => {
    const {game, scene} = window.biomeReview;
    game.scale.refresh();
    return game.canvas.width === w && game.canvas.height === h && scene.width === w && scene.height === h;
  }, [width, height], {polling: 150, timeout: 10000});
}
main().catch(error => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
