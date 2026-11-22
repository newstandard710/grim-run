'use strict';
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const {chromium,server}=require('./browser-landing');
const output='test-results/pacing';
fs.mkdirSync(output,{recursive:true});
const data=[];
async function sample(browser,revision,actions){
  const page=await browser.newPage({viewport:{width:740,height:360},deviceScaleFactor:1,hasTouch:true});
  try{
    await page.goto('http://127.0.0.1:'+server.address().port+'/'+revision+'/?seed=33');
    await page.locator('#home-enter-btn').click();
    await page.waitForFunction(()=>window.grimRun?.scene?.scenes[0]?.motionArt?.rising && window.GRIM_FRONTEND?.ready,null,{timeout:90000});
    await page.evaluate(()=>grimRun.scene.scenes[0].visuals.reviewLoad);
    await page.evaluate(actions=>{
      const g=grimRun,s=g.scene.scenes[0],rows=[],tasks=[];
      new PerformanceObserver(list=>{for(const e of list.getEntries())tasks.push([e.startTime,e.duration]);}).observe({type:'longtask',buffered:true});
      let done,prior,t0,end=0,nextAction=0;
      window.observation=new Promise(r=>done=r);
      const inputs=[[33,'jump'],[37,'jumpEnd'],[42,'attack'],[65,'startSlide'],[83,'endSlide']];
      const begin=time=>{
        if(s.state!=='playing')return;
        const now=performance.now(),m=s.distance;
        if(prior)rows.push({m,from:prior.m,gap:time-prior.time,cpu:end-prior.start,start:prior.start});
        if(actions&&nextAction<inputs.length&&m>=inputs[nextAction][0])s[inputs[nextAction++][1]]();
        prior={time,start:now,m};t0??=now;
        if(m<90)return;
        g.events.off('prestep',begin);g.events.off('postrender',finish);
        done({seed:s.seed,renderer:g.renderer.type,rows,tasks:tasks.filter(t=>t[0]>=t0),end:s.distance,hp:s.player.hp});
      };
      const finish=()=>{end=performance.now();};
      g.events.on('prestep',begin);g.events.on('postrender',finish);
    },actions);
    await page.locator('#start-btn').click();
    const evidence=await page.evaluate(()=>window.observation);
    assert.equal(evidence.renderer,1);assert.equal(evidence.seed,33);assert(evidence.rows.length>100);
    data.push({revision,actions,...evidence});
    fs.writeFileSync(path.join(output,'natural.json'),JSON.stringify(data));
  }finally{await page.close();}
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const b=await chromium.launch({args:['--disable-webgl']});
  try{
    for(const actions of [true,false])for(const rev of ['before','after','after','before'])await sample(b,rev,actions);
  }finally{await b.close();server.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
