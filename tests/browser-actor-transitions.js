'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png',
  '.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html');
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  try{res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(fs.readFileSync(file));}
  catch{res.writeHead(404).end();}
});

async function inspect(page,available){
  const result=await page.evaluate(()=>{
    const g=window.grimRun,s=g.scene.scenes[0],a=s.combatArt;
    s.startRun();g.loop.sleep();s.sys.sceneUpdate=()=>{};clearInterval(s.loopWatchdogId);
    s.enemies=[];s.obstacles=[];s.state='playing';s.ui.setMode('playing');
    const e={kind:'bat',hp:1,x:s.player.x+175,y:s.player.y-83,phase:.7,timer:0};
    s.enemies.push(e);
    const traces=[];
    for(const mode of ['telegraph','dive','recover']){
      e.mode=mode;
      for(const rate of [30,60,120]){
        for(const age of [...new Set([0,1/rate,2/rate,.036,.060,.089,.119,.120,.121])]){
          e.timer=age;s.elapsed=2.5+age;s.drawScene();
          const body=a.bats[0].filter(v=>v.visible);
          traces.push({s:[e.mode,e.timer,e.x,e.y,s.rng.state],age,mode,
            views:body.map(v=>({key:v.texture.key,alpha:v.alpha,frame:v.frame.name,rotation:v.rotation,x:v.x,y:v.y}))});
        }
      }
    }
    const live=a.bats[0][0];
    const pose=[live.texture.key,live.frame.name,live.rotation,live.alpha];
    s.hitEnemy(e,1);s.drawScene();
    const detached=a.responses.flat().filter(v=>v.visible);
    const response={flight:a.bats[0].some(v=>v.visible),defeats:detached.length,
      entry:detached.map(v=>[v.texture.key,v.frame.name,v.rotation,v.alpha]),pose};
    const opaqueCounts=[];
    if(a.batHandoffReady){
      const c=document.createElement('canvas');c.width=192;c.height=128;
      const ctx=c.getContext('2d',{willReadFrequently:true});
      const image=s.textures.get('combat-cavern-bat-handoff').getSourceImage();
      for(let i=0;i<36;i++){
        ctx.clearRect(0,0,192,128);ctx.drawImage(image,i%6*192,Math.floor(i/6)*128,192,128,0,0,192,128);
        const data=ctx.getImageData(0,0,192,128).data;
        let visible=0,opaque=0;
        for(let j=3;j<data.length;j+=4){if(data[j]>40)visible++;if(data[j]===255)opaque++;}
        opaqueCounts.push([visible,opaque]);
      }
    }
    return {traces,ready:a.batHandoffReady,response,opaqueCounts};
  });
  assert.equal(result.ready,available);
  assert.deepEqual(result.response,{flight:false,defeats:1,entry:[result.response.pose],pose:result.response.pose},
    'A lethal hit carries the last flight pose into exactly one detached view');
  const flight='combat-bat-flight',dive='gr_v2_bat_dive',bridge='combat-cavern-bat-handoff';
  const rng=new Set();
  for(const {age,mode,s,views} of result.traces){
    assert.equal(views.length,1,'Exactly one Cavern Bat actor is painted');
    const v=views[0];
    assert.equal(v.alpha,1);assert.deepEqual([v.x,v.y],s.slice(2,4));
    assert.equal(s[0],mode);assert.equal(s[1],age);rng.add(s[4]);
    if(mode==='telegraph'||mode==='dive'&&age===0||mode==='recover'&&age>=.120)assert.equal(v.key,flight);
    if(mode==='recover'&&age===0||mode==='dive'&&age>=.120){
      assert.equal(v.key,dive);assert(Math.abs(v.rotation-.1)<1e-9);
    }
    if(mode!=='telegraph'&&age===.060)assert.equal(v.key,available?bridge:dive);
  }
  assert.equal(rng.size,1,'Actor painting does not spend RNG');
  if(available)assert(result.opaqueCounts.every(([v,o])=>v>600&&o/v>.7),
    'All transitions have a solid painted interior and an antialiased contour');
}

async function inspectReaper(page){
  const result=await page.evaluate(()=>{
    const g=window.grimRun,s=g.scene.scenes[0],art=s.reactionArt;
    s.startRun();g.loop.sleep();s.sys.sceneUpdate=()=>{};clearInterval(s.loopWatchdogId);
    s.enemies=[];s.obstacles=[];s.fireballs=[];
    const p=s.player,rows=[];
    const read=(track,age)=>{
      const v=art.body;
      rows.push({track,age,visible:v.visible,key:v.texture.key,frame:Number(v.frame.name),
        scale:v.scaleX,alpha:v.alpha,x:v.x,rotation:v.rotation,rng:s.rng.state});
    };
    for(const rate of [30,60,120]){
      for(const age of [1000/rate,2000/rate,48,92,132,239,339]){
        p.visualHurtMs=340-age;p.invulMs=0;s.drawScene();read('hurt',age);
        p.invulMs=1000;s.frame=0;s.drawScene();read('flicker',age);
      }
    }
    p.visualHurtMs=0;p.invulMs=0;p.hp=1;s.drawScene();
    s.takeDamage(1,'rock');
    const lethalRng=s.rng.state;
    const hud=document.getElementById('hearts').textContent.trim();
    for(const age of [0,42,65,125,300,630,900,1280,1920,2399]){
      s.deathPoseMs=age;s.drawScene();read('death',age);
    }
    s.deathPoseMs=2399;s.update(0,.5);
    const before=s.state,early=s.revive();
    s.update(0,.5);const after=s.state,focus=document.activeElement.id;
    const paidBefore=s.meta.souls;
    s.meta.souls=paidBefore+3;s.revive();
    const cleared=p.visualHurtMs,respawn=s.state;
    const coverage=[];
    const spec=window.GRIM_DEFEAT_DATA;
    const src=s.textures.get('combat-reaper-defeat').getSourceImage();
    const c=document.createElement('canvas');c.width=spec.width;c.height=spec.height;
    const ctx=c.getContext('2d',{willReadFrequently:true});
    for(let i=0;i<spec.frames;i++){
      const {width:w,height:h,columns,anchor}=spec;
      ctx.clearRect(0,0,w,h);
      ctx.drawImage(src,i%columns*w,Math.floor(i/columns)*h,w,h,0,0,w,h);
      const bytes=ctx.getImageData(0,0,w,h).data;
      let solid=0,paint=0,bottom=0;
      for(let j=3;j<bytes.length;j+=4){
        if(bytes[j]>64){paint++;bottom=Math.max(bottom,Math.floor(j/4/w)-anchor[1]);}
        if(bytes[j]>=250)solid++;
      }
      coverage.push({paint,solid,bottom});
    }
    return {rows,ready:art.ready,before,after,early,hud,focus,cleared,respawn,coverage,lethalRng};
  });
  assert.equal(result.ready,true);
  assert.equal(result.before,'dying');assert.equal(result.after,'revive');
  assert.equal(result.focus,'revive-title');assert.equal(result.early,false);
  assert.equal(result.cleared,0);assert.equal(result.respawn,'respawning');
  assert.equal(result.hud,'♡ ♡ ♡');
  const death=result.rows.filter(v=>v.track==='death');
  assert(death.every(v=>v.visible&&v.alpha===1&&v.rng===result.lethalRng));
  assert(death.slice(2).every(v=>v.scale===1&&v.key==='combat-reaper-defeat'));
  assert.equal(death.at(-2).frame,death.at(-1).frame,'The last defeated pose holds before the offer');
  assert(new Set(death.slice(2).map(v=>v.frame)).size>=6,'The collapse uses distinct poses');
  for(const row of result.rows.filter(v=>v.track!=='death')){
    assert.equal(row.visible,true);
    assert.equal(row.alpha,row.track==='flicker'?.58:1);
  }
  assert(result.coverage.every(v=>v.paint>1400&&v.solid/v.paint>.67&&v.bottom<=3),'Solid registered cel interiors and floor contact');
}

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port+'/?seed=33';
  for(const renderer of ['canvas','webgl']){
    const browser=await chromium.launch({headless:true,args:['--no-sandbox',
      ...(renderer==='canvas'?['--disable-webgl']:['--use-angle=swiftshader','--enable-unsafe-swiftshader'])]});
    try{
      for(const [mode,width,height] of [['ready',740,360],['ready',950,430],['invalid',740,360],['delayed',740,360]]){
        const page=await browser.newPage({viewport:{width,height},hasTouch:true});
        const errors=[];page.on('pageerror',e=>errors.push(e.message));
        let release;
        try{
          if(mode==='invalid')await page.route(/cavern-bat-handoff\.webp/,r=>
            r.fulfill({body:'invalid actor WebP',contentType:'image/webp'}));
          if(mode==='delayed'){
            const gate=new Promise(resolve=>{release=resolve;});
            await page.route(/cavern-bat-handoff\.webp/,async r=>{
              await gate;
              await r.continue();
            });
          }
          await page.goto(url,{waitUntil:'domcontentloaded'});
          await page.waitForFunction(()=>{const s=window.grimRun?.scene.scenes[0];
            return s?.visuals?.loaded&&s.visuals.batReady&&s.combatArt.ready['bat-flight'];},null,{timeout:55000});
          if(mode==='ready')await page.waitForFunction(()=>{const a=window.grimRun.scene.scenes[0].combatArt;
            return a.batHandoffReady;});
          assert.equal(await page.evaluate(()=>window.grimRun.renderer.type),renderer==='canvas'?1:2);
          await inspect(page,mode==='ready');
          if(mode==='ready')await inspectReaper(page);
          if(mode==='delayed'){
            release();
            await page.waitForFunction(()=>{const a=window.grimRun.scene.scenes[0].combatArt;
              return a.batHandoffReady;});
            await inspect(page,true);

          }
          assert.deepEqual(errors,[]);
          console.log('PASS Cavern Bat and Reaper solid handoffs',renderer,width+'x'+height,mode);
        }finally{release?.();await page.close();}
      }
    }finally{await browser.close();}
  }
  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-webgl']});
  try{
    const page=await browser.newPage({viewport:{width:740,height:360}});
    await page.route('**/reaper-defeat.webp*',route=>route.abort());
    await page.goto(url);
    await page.waitForFunction(()=>window.grimRun?.scene.scenes[0]?.state==='home');
    await page.locator('#home-enter-btn').click();
    assert(await page.locator('#reaction-load-error').isVisible());
    assert(await page.locator('#start-btn').isDisabled());
    assert.equal(await page.evaluate(()=>window.grimRun.scene.scenes[0].startRun()),false);
    console.log('PASS failed required defeat art is reported at startup');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
