'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');

const candidate=path.resolve(__dirname,'..');
const baseline=process.argv[2]&&path.resolve(process.argv[2]);
const types={'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.png':'image/png',
  '.css':'text/css','.svg':'image/svg+xml','.ttf':'font/ttf'};
const server=http.createServer(async(req,res)=>{
  const parts=new URL(req.url,'http://localhost').pathname.split('/');
  const root=parts[1]==='before'?baseline:candidate;
  const file=path.resolve(root,parts.slice(2).join('/')||'index.html');
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  try{const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(bytes);}
  catch{res.writeHead(404).end();}
});

async function measure(browser,renderer,revision){
  const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto('http://127.0.0.1:'+server.address().port+'/'+revision+'/?seed=33',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>{const a=window.grimRun?.scene.scenes[0]?.motionArt;
      return a?.rising&&a.forwardReady&&a.cutWeaponReady&&a.airReady&&a.airCutReady&&window.GRIM_FRONTEND?.ready;
    },null,{timeout:90000});
    const report=await page.evaluate(async()=>{
      const g=grimRun,s=g.scene.scenes[0];
      function reset(){
        s.startRun();s.state='playing';s.ui.setMode('playing');g.loop.sleep();
        clearInterval(s.loopWatchdogId);s.sys.sceneUpdate=()=>{};
        s.obstacles=[];s.enemies=[];s.coins=[];s.souls=[];
        s.nextEncounterX=s.nextEnemySpawnX=s.nextGroundSpawnX=s.nextSnapSpawnX=1e9;
        s.drawScene();
      }
      reset();
      const view=s.motionArt.weapon,tip=GRIM_RISING_CUT_DATA.spec.edge[0];
      const tipOffsetY=tip[0]*Math.sign(view.scaleX)*Math.sin(view.rotation)+tip[1]*Math.cos(view.rotation);
      const quantiles=values=>{values.sort((a,b)=>a-b);return {median:(values[49]+values[50])/2,p95:values[94],p99:values[98],max:values.at(-1),over50ms:values.filter(v=>v>50).length};};
      async function timing(cut){
        let last,owned=0;
        const interval=[],cpu=[];
        for(let i=0;i<150;i++){
          await new Promise(requestAnimationFrame);
          const start=performance.now();if(i>=50)interval.push(start-last);last=start;
          if(cut&&i%25===0)s.attack();
          s.update(0,1000/60);g.step(start,0);
          if(s.motionArt.rising.sprite.visible)owned++;
          if(i>=50)cpu.push(performance.now()-start);
        }
        return {owned,frameIntervalMs:quantiles(interval),updateAndRenderCpuMs:quantiles(cpu)};
      }
      const running=await timing(false);
      reset();
      const cutting=await timing(true);
      reset();
      // Cross 900 m during the measured window, after the 50 warm-up frames.
      const entry=855,x=s.startX+entry*GRIM_CONFIG.pxPerMeter;
      s.distance=entry;s.speed=GRIM_CORE.runSpeed(entry);
      s.player.x=x;s.player.y=s.terrain.groundAt(x)??s.terrain.anchorAt(x);
      s.cameraX=x-s.width*GRIM_CONFIG.reaperXRatio;s.cameraY=s.player.y-s.groundY;
      s.nextVendorNumber=2;s.lastVendorNumber=1;
      const crossing=await timing(false);
      crossing.endMeters=s.distance;
      reset();
      const p=s.player,spawned=s.trySpawnCombat(p.x+134,'crawler'),enemy=s.enemies[0];
      const tree=GRIM_CORE.obstacle('bramble',p.x+115,s.terrain.groundAt(p.x+115),0,GRIM_CONFIG.slideClearancePx,s.height);
      s.obstacles.push(tree);s.attack();
      const mode=p.risingCut?.mode;
      let treeMs=null,crawlerMs=null;
      for(let i=1;i<=35;i++){
        s.update(0,8);
        if(tree.destroyed&&treeMs===null)treeMs=i*8;
        if(enemy?.dead&&crawlerMs===null)crawlerMs=i*8;
      }
      return {renderer:g.renderer.type,mode,tipOffsetY,spawned,treeMs,crawlerMs,running,crossing,...cutting};
    });
    console.log(renderer,revision,JSON.stringify(report));
    if(process.env.GITHUB_ACTIONS){
      const times=JSON.stringify({frameIntervalMs:report.frameIntervalMs,updateAndRenderCpuMs:report.updateAndRenderCpuMs});
      console.log('::notice title=Phone Cut '+renderer+' '+revision+'::'+times);
    }
    assert.equal(report.renderer,renderer==='canvas'?1:2);
    assert(report.crossing.endMeters>900,'Timed route crosses into the Foothills');
    assert(report.owned>60,'Repeated attacks used the drawn Cut');
    if(revision==='after'){
      assert(report.tipOffsetY>0,'The resting tip points below the palm');
      assert.equal(report.mode,'rise');
      const slopes=await page.evaluate(()=>{
        const s=grimRun.scene.scenes[0],p=s.player,geometry=window.RisingGeometry;
        const project=geometry.transform,ground=s.terrain.groundAt;
        const art=GRIM_MOTION_ART,rear=GRIM_FORWARD_SCYTHE.rear,weapon=GRIM_FORWARD_SCYTHE.weapon;
        const composite=s.motionArt.rising.sprite,canvas=composite.texture.getSourceImage().getContext('2d');
        const weaponImage=s.textures.get(weapon.key).getSourceImage(),drawImage=canvas.drawImage;
        let weaponTransform;
        canvas.drawImage=function(source,...args){
          if(source===weaponImage)weaponTransform=this.getTransform();
          drawImage.call(this,source,...args);
        };
        let longest=0,wrongFacing=0,count=0,minShaft=Infinity,markError=0,buried=0;
        function clearance(x,y){return s.terrain.groundAt(x)-y;}
        // Observe the registered edge consumed by both contact and the visible glint.
        geometry.transform=(points,pose)=>{
          if(points===GRIM_RISING_CUT_DATA.spec.edge&&pose.shoulder){
            const [a,b,c,d]=pose.matrix;
            if(a*d-b*c>=0)wrongFacing++;
            longest=Math.max(longest,Math.hypot(pose.hand[0]-pose.shoulder[0],pose.hand[1]-pose.shoulder[1]));
            for(const [x,y] of project(art.shaft,pose))
              minShaft=Math.min(minShaft,clearance(p.x+x,s.feetY+pose.rise+y));
            count++;
          }
          return project(points,pose);
        };
        try{
          for(const grade of [-.65,-.25,0,.25,.65]){
            s.terrain.groundAt=x=>s.groundY+grade*(x-s.startX);
            for(let cell=0;cell<96;cell++){
              p.x=s.startX+(cell+.01)*art.STRIDE_PX/GRIM_RUN_DATA.frames;
              p.y=s.terrain.groundAt(p.x);p.attackMs=p.visualLandingMs=p.visualHurtMs=0;
              p.attackCooldownMs=0;p.risingCut=null;p.grounded=true;p.onSoulPlatform=false;
              s.drawScene();
              const held=s.motionArt.weapon;
              if(!held.visible||held.depth>=s.terrainBase.depth)throw Error('Drag must pass behind the ground');
              const matrix=geometry.project(held.rotation,0,0);matrix[0]*=-1;matrix[2]*=-1;
              const pose={hand:[held.x,held.y],matrix};
              const [mark]=project([rear.dragMark],pose);
              markError=Math.max(markError,Math.abs(clearance(...mark)));
              for(const point of project(art.shaft,pose))minShaft=Math.min(minShaft,clearance(...point));
            }
            for(const offset of [0,42,98,154]){
              p.x=s.startX+offset;p.y=s.terrain.groundAt(p.x);
              p.grounded=true;p.onSoulPlatform=false;p.visualHurtMs=0;p.attackCooldownMs=0;
              s.attack();
              for(let age=2;age<=355;age+=4){
                p.attackMs=Math.max(0,GRIM_CONFIG.attackDurationMs-age);
                p.attackCooldownMs=GRIM_CONFIG.attackCooldownMs-age;
                weaponTransform=null;s.drawScene();
                if(!composite.visible||!weaponTransform)throw Error('Missing drawn Cut');
                function paintedClearance([x,y]){
                  const q=weaponTransform.transformPoint({x:weapon.anchor[0]+x/weapon.scale,
                    y:weapon.anchor[1]+y/weapon.scale});
                  return clearance(composite.x+q.x*composite.scaleX,composite.y+q.y*composite.scaleY);
                }
                for(const point of art.shaft)minShaft=Math.min(minShaft,paintedClearance(point));
                if(paintedClearance(GRIM_RISING_CUT_DATA.spec.edge[0])<0)buried++;
              }
            }
          }
        }finally{canvas.drawImage=drawImage;geometry.transform=project;s.terrain.groundAt=ground;}
        return {longest,wrongFacing,count,minShaft,markError,buried};
      });
      console.log(renderer,'ground drag',JSON.stringify(slopes));
      assert(slopes.markError<.04,'15% of blade length meets solid ground through the stride');
      assert(slopes.minShaft>=1.8,'The handle, pommel and socket clear the surface');
      assert(slopes.buried>0,'The working blade can enter the ground during Cut');
      assert(slopes.count>=360&&slopes.wrongFacing===0,'Every active pose keeps the turned grip');
      assert(slopes.longest<=28.4,'The elbow stays within the painted arm length on slopes');
      assert(report.spawned&&report.treeMs&&report.crawlerMs,'Ordinary Cut hits the tree and Bone Crawler');
    }
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
}

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    for(const renderer of ['canvas','webgl']){
      const flags=renderer==='canvas'?['--disable-webgl']:['--use-angle=swiftshader','--enable-unsafe-swiftshader'];
      const browser=await chromium.launch({args:['--no-sandbox',...flags]});
      try{
        if(baseline)await measure(browser,renderer,'before');
        await measure(browser,renderer,'after');
      }finally{await browser.close();}
    }
  }finally{server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
