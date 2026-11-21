'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'test-results/surface');
const mime={'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.png':'image/png',
  '.css':'text/css','.ttf':'font/ttf','.json':'application/json','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  try{
    const bytes=await fs.readFile(file);
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
    res.end(bytes);
  }catch{res.writeHead(404).end();}
});

async function exercise(browser,renderer,width,height,enabled){
  const page=await browser.newPage({viewport:{width,height},hasTouch:true});
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  try{
    // Same release, same inputs. The control removes only this optional visual module.
    if(!enabled)await page.route('**/surface-dressing.js*',route=>route.fulfill({body:'',contentType:'text/javascript'}));
    await page.goto('http://127.0.0.1:'+server.address().port+'/?seed=33');
    await page.waitForFunction(()=>{
      const s=window.grimRun?.scene.scenes[0];
      return window.GRIM_FRONTEND?.ready&&s?.visuals?.reaperReady&&s.visuals.loaded&&
        s.motionArt?.runReady&&s.motionArt.forwardReady&&s.motionArt.airCutReady;
    },null,{timeout:90000});
    const version=await page.evaluate(()=>{
      const g=grimRun,s=g.scene.scenes[0];s.startRun();g.loop.sleep();
      clearInterval(s.loopWatchdogId);s.sys.sceneUpdate=()=>{};
      s.drawScene();return g.renderer.type;
    });
    assert.equal(version,renderer==='webgl'?2:1);
    const report={states:[],regions:[],timing:null};
    const tag=renderer+'-'+width;
    for(const distance of [0,1500,2500,5500,6500,7500,8500,11000]){
      if(distance)await page.evaluate(m=>{
        const s=grimRun.scene.scenes[0];s.godMode=true;s.state='teleportConfirm';
        if(!s.teleportForTesting(m))throw Error('Could not reach '+m);
        // Some practice markers land on a one-way island. Review the nearest actual trail.
        const begin=s.player.x;let x=begin;
        const runway=x=>[0,80,160,240,320,400,480,560,640,720].every(dx=>
          s.terrain.sectionAt(x+dx)?.kind==='ground');
        while(x<begin+4200&&!runway(x))x+=40;
        if(!runway(x))throw Error('No solid review stretch at '+m);
        s.player.x=x;s.player.y=s.terrain.groundAt(x);
        s.distance=(x-s.startX)/GRIM_CONFIG.pxPerMeter;
        s.cameraX=x-s.width*GRIM_CONFIG.reaperXRatio;s.cameraY=s.player.y-s.groundY;
        s.syncWorldScroll();s.drawScene();
      },distance);
      await page.waitForFunction(()=>{
        const s=grimRun.scene.scenes[0];return s.terrainMaterialIds.has((s.distance<900?'forest':s.distance<2300?'foothills':s.distance<5000?'tundra':s.distance<6000?'caves':
           s.distance<7000?'crystals':s.distance<8000?'ashlands':s.distance<9999?'lava':'boss'));
      },null,{timeout:30000});
      if(enabled){
        await page.evaluate(()=>{const s=grimRun.scene.scenes[0];s.drawScene();grimRun.step(performance.now(),0);});
        await page.screenshot({path:path.join(output,tag+'-'+distance+'.png')});
      }
      const frames=await page.evaluate(()=>{
        const s=grimRun.scene.scenes[0],d=s.surfaceDressing;
        const states=[],ids=new Set();let maxVisible=0,grass=0,snow=0,loose=0;
        for(let i=0;i<120;i++){
          if(i===34)s.startSlide();if(i===52)s.endSlide();if(i===64)s.jump();if(i===70)s.jumpEnd();if(i===97)s.attack();
          s.update(0,i<65?16:8);
          if(i%10===0)states.push([s.player.x,s.player.y,s.player.hp,s.player.grounded,s.points,
            s.coinCount,s.soulCount,s.rng.state,s.terrain.segments.length,s.obstacles.map(o=>[o.x,o.destroyed]),
            s.enemies.map(e=>[e.x,e.hp,e.dead]),s.snowTread.flecks.filter(f=>f.life>0).map(f=>[f.x,f.y])]);
          snow=Math.max(snow,s.snowTread.flecks.filter(f=>f.life>0).length);
          let visible=0;
          for(const slot of d?.slots||[]){
            if(!slot.patch)continue;
            ids.add(slot.patch.id);visible+=Number(slot.front.visible)+Number(slot.rear.visible);
            if(slot.patch.rearHit===s.elapsed)grass++;
            if(slot.patch.frontHit===s.elapsed)loose++;
          }
          maxVisible=Math.max(maxVisible,visible);
        }
        grimRun.step(performance.now(),0);
        return {states,region:{ids:[...ids],maxVisible,grass,loose,snow,slots:d?.slots.length||0}};
      });
      report.states.push(...frames.states);report.regions.push(frames.region);

    }
    if(enabled){
      console.log(tag+' materials',JSON.stringify(report.regions));
      assert.equal(new Set(report.regions.flatMap(r=>r.ids)).size,8);
      assert(report.regions[0].grass>0,'Forest contact bends grass');
      assert(report.regions[2].snow>0,'Tundra kicks existing snow');
      assert(report.regions.every(r=>r.slots<=48));
    }
    await page.evaluate(()=>{const s=grimRun.scene.scenes[0];s.startRun();grimRun.loop.sleep();});
    report.timing=await page.evaluate(async()=>{
      const s=grimRun.scene.scenes[0],cpu=[],interval=[];let last;
      for(let i=0;i<120;i++){
        await new Promise(requestAnimationFrame);const t=performance.now();
        s.update(0,16);grimRun.step(t,0);
        if(i>=40){cpu.push(performance.now()-t);interval.push(t-last);}last=t;
      }
      function summary(values){
        values.sort((a,b)=>a-b);
        return {median:values[40],p95:values[75],over33ms:values.filter(v=>v>33.4).length};
      }
      return {cpu:summary(cpu),frame:summary(interval)};
    });
    if(enabled){
      // Capture a continuous ordinary-speed stride and its contacts at half speed.
      if(width===740&&renderer==='canvas'){
        for(let i=0;i<30;i++){
          await page.evaluate(i=>{const s=grimRun.scene.scenes[0];for(let j=0;j<3;j++)s.update(0,i<15?16:8);
            grimRun.step(performance.now(),0);},i);
          await page.screenshot({path:path.join(output,'forest-'+String(i).padStart(2,'0')+'.png')});
        }
      }
      const lifecycle=await page.evaluate(()=>{
        const s=grimRun.scene.scenes[0],d=s.surfaceDressing;
        s.startRun();grimRun.loop.sleep();s.setGodMode(true);
        for(let i=0;i<255;i++)s.update(0,34);
        const rewound=s.rewind();for(let i=0;i<100&&s.state==='rewinding';i++)s.update(0,34);
        const restored=s.state==='playing';
        const group=s.terrain.sequences[0];s.player.x=group.startX+40;
        s.player.y=s.terrain.anchorAt(s.player.x)+500;s.rescueFromAbyss();s.drawScene();
        const gapClear=d.slots.every(slot=>!slot.patch||s.terrain.sectionAt(slot.patch.frontX)?.kind==='ground');
        const didFall=s.state==='respawning';s.finishAbyssRespawn();
        return {rewound,restored,gapClear,didFall,recovered:s.state==='playing'};
      });
      assert(Object.values(lifecycle).every(Boolean),JSON.stringify(lifecycle));
      await page.emulateMedia({reducedMotion:'reduce'});
      const quiet=await page.evaluate(()=>{
        const s=grimRun.scene.scenes[0];s.startRun();grimRun.loop.sleep();
        for(let i=0;i<120;i++)s.update(0,16);
        const active=s.surfaceDressing.slots.some(a=>a.patch&&
          (Number.isFinite(a.patch.rearHit)||Number.isFinite(a.patch.frontHit)));
        const before=s.player.x;s.togglePause();s.update(0,16);
        return {active,paused:s.player.x===before,state:s.state};
      });
      assert.deepEqual(quiet,{active:false,paused:true,state:'paused'});
    }
    assert.deepEqual(errors,[]);return report;
  }finally{await page.close();}
}
(async()=>{
  await fs.mkdir(output,{recursive:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    for(const renderer of ['canvas','webgl']){
      const args=renderer==='canvas'?['--disable-webgl']:['--use-angle=swiftshader','--enable-unsafe-swiftshader'];
      const browser=await chromium.launch({args:['--no-sandbox',...args]});
      try{
        for(const [width,height] of [[740,360],[960,540]]){
          const before=await exercise(browser,renderer,width,height,false);
          const after=await exercise(browser,renderer,width,height,true);
          assert.deepEqual(after.states,before.states,'Seeded gameplay and snow agree');
          const evidence={renderer,width,height,compared:after.states.length,before:before.timing,after:after.timing,regions:after.regions};
          console.log(JSON.stringify(evidence));await fs.writeFile(path.join(output,renderer+'-'+width+'.json'),JSON.stringify(evidence));
        }
      }finally{await browser.close();}
    }
  }finally{server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
