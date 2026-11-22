'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium,server}=require('./browser-landing');
const dir=path.resolve('test-results/hitch-profile',process.env.TEST_SHA);
fs.mkdirSync(dir,{recursive:true});

async function endTrace(client,name) {
  const done=new Promise(resolve=>client.once('Tracing.tracingComplete',resolve));
  await client.send('Tracing.end');
  const {stream}=await done;
  const file=fs.openSync(path.join(dir,name+'.json.gz'),'w');
  try{
    for(;;){
      const item=await client.send('IO.read',{handle:stream,size:256*1024});
      fs.writeSync(file,Buffer.from(item.data,item.base64Encoded?'base64':'utf8'));
      if(item.eof)break;
    }
  }finally{fs.closeSync(file);await client.send('IO.close',{handle:stream});}
}
function installObservers(){
  const s=grimRun.scene.scenes[0],g=grimRun,timings={},draws=[],state={active:false};
  function wrap(obj,name,label){
    if(typeof obj?.[name]!=='function')return;
    const original=obj[name];
    obj[name]=function(...args){
      if(!state.active)return original.apply(this,args);
      const start=performance.now();
      try{return original.apply(this,args);}finally{timings[label]=(timings[label]||0)+performance.now()-start;}
    };
  }
  for(const key of ['drawScene','drawGround','drawForeground','drawReaper','cutNearby'])wrap(s,key,key);
  for(const key of ['landingArt','motionArt','surfaceDressing','forestMidground','biomeMidground'])wrap(s[key],'render',key);
  wrap(s.landingArt,'contact','landingContact');wrap(s.motionArt?.rising,'renderUpright','cutPaint');
  const context=CanvasRenderingContext2D.prototype,draw=context.drawImage;
  const urls=new WeakMap();
  for(const tex of Object.values(s.textures.list)){
    const img=tex.getSourceImage?.();if(img&&typeof img==='object')urls.set(img,tex.key);
  }
  const seen=new Set();
  context.drawImage=function(image,...args){
    if(!state.active)return draw.call(this,image,...args);
    const key=image.currentSrc?.split('/').pop()||urls.get(image)||image.constructor?.name||'?';
    const first=!seen.has(key);
    const now=performance.now();
    try{return draw.call(this,image,...args);}finally{
      const dt=performance.now()-now;
      if(first||dt>=3)draws.push({key,m:s.distance,dt,first,w:image.width,h:image.height});
      seen.add(key);
    }
  };
  window.armHitch=({label,sequence})=>{
    const rows=[],longTasks=[],inputs=[],schedule=sequence==='combo'?[[33,'jump'],[37,'jumpEnd'],[42,'attack']]:[];
    let prior,t0,end,updated,renderStart,cursor=0;
    return new Promise(resolve=>{
      const po=new PerformanceObserver(entries=>{for(const e of entries.getEntries())longTasks.push([e.startTime,e.duration]);});po.observe({type:'longtask'});
      function begin(time){
        if(s.state!=='playing')return;
        const now=performance.now(),m=s.distance,p=s.player;
        if(prior)rows.push({...prior,gap:time-prior.t,cpu:end-prior.now,update:updated-prior.now,renderer:end-renderStart,timings:{...timings}});
        state.active=true;
        for(const k in timings)timings[k]=0;
        if(m>=39&&m<=58)performance.mark('hitch|'+label+'|'+m.toFixed(3));
        if(cursor<schedule.length&&m>=schedule[cursor][0]){
          const method=schedule[cursor++][1];inputs.push([method,m]);s[method]();
        }
        const actor=s.motionArt?.body?.[0];
        prior={t:time,now,m,grounded:p.grounded,attack:p.attackMs,cooldown:p.attackCooldownMs,owner:p.risingCut?.mode,
          rising:!!s.motionArt?.rising?.sprite?.visible,actor:actor?.visible?[actor.texture.key,actor.frame.name]:null,land:p.visualTouchdown?.source,age:p.jumpAgeMs};
        t0??=now;
        if(m<76)return;
        state.active=false;po.disconnect();g.events.off('prestep',begin);g.events.off('poststep',afterUpdate);
        g.events.off('prerender',preRender);g.events.off('postrender',finish);
        resolve({label,sequence,seed:s.seed,engine:g.renderer.type,rows,inputs,longTasks:longTasks.filter(q=>q[0]>=t0),draws:draws.splice(0),hp:p.hp});
      }
      const afterUpdate=()=>{updated=performance.now();};
      const preRender=()=>{renderStart=performance.now();};
      const finish=()=>{end=performance.now();};
      g.events.on('prestep',begin);g.events.on('poststep',afterUpdate);g.events.on('prerender',preRender);g.events.on('postrender',finish);
    });
  };
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({args:['--disable-webgl']});
  try{
    const page=await browser.newPage({viewport:{width:740,height:360},hasTouch:true,deviceScaleFactor:1});
    await page.goto('http://127.0.0.1:'+server.address().port+'/before/?seed=33');
    await page.locator('#home-enter-btn').click();
    await page.waitForFunction(()=>window.grimRun?.scene.scenes[0].motionArt?.rising&&GRIM_FRONTEND.ready,null,{timeout:90000});
    await page.evaluate(()=>grimRun.scene.scenes[0].visuals.reviewLoad);
    await page.evaluate(installObservers);
    const c=await page.context().newCDPSession(page);
    for(const label of ['first','replay']){
      if(label==='replay')await page.evaluate(()=>grimRun.scene.scenes[0].goToMenu());
      await c.send('Tracing.start',{transferMode:'ReturnAsStream',streamFormat:'json',streamCompression:'gzip',
        categories:'toplevel,devtools.timeline,blink.user_timing,loading,cc,gpu,v8,blink,skia,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,disabled-by-default-v8.cpu_profiler,disabled-by-default-devtools.timeline.stack'});
      await page.evaluate(label=>{window.hitchResult=window.armHitch({label,sequence:'combo'});},label);
      await page.locator('#start-btn').click();
      const out=await page.evaluate(()=>window.hitchResult);
      fs.writeFileSync(path.join(dir,label+'-observations.json'),JSON.stringify(out));await endTrace(c,label);
      assert.equal(out.seed,33);assert.equal(out.engine,1);assert.equal(out.inputs.length,3);
    }
    await page.close();
  }finally{await browser.close();server.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
