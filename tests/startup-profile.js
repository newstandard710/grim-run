'use strict';
const PUBLIC_GAME='https://newstandard710.github.io/grim-run/';
async function publicPage(page,seed){
 const res=await page.goto(PUBLIC_GAME+'?seed='+seed,{waitUntil:'domcontentloaded'});
 assert.equal(res.status(),200);assert.equal(new URL(page.url()).origin,'https://newstandard710.github.io');
 assert.equal(await page.title(),'GRIM RUN — v0.19.18');
}

const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,server}=require('./browser-landing');
const out='test-results/startup';
fs.mkdirSync(out,{recursive:true});
async function stopTrace(c,name){
 const done=new Promise(resolve=>c.once('Tracing.tracingComplete',resolve));
 await c.send('Tracing.end');const {stream}=await done,fd=fs.openSync(path.join(out,name+'.gz'),'w');
 try{for(;;){const r=await c.send('IO.read',{handle:stream,size:512*1024});fs.writeSync(fd,Buffer.from(r.data,r.base64Encoded?'base64':'utf8'));if(r.eof)break;}}
 finally{fs.closeSync(fd);await c.send('IO.close',{handle:stream});}
}
function init(light){
 const obs=window.startupObs={draws:[],tasks:[],clicks:[],crc:[]},seen=new WeakSet();
 const recordAvailability=()=>{
  const btn=document.querySelector('#start-btn');
  if(btn && !btn.disabled && btn.getClientRects().length){obs.available=performance.now();return;}
  requestAnimationFrame(recordAvailability);
 };
 document.addEventListener('pointerdown',e=>{
  if(e.target.closest('#home-enter-btn')) requestAnimationFrame(recordAvailability);
 },true);
 const draw=CanvasRenderingContext2D.prototype.drawImage;
 if(!light)CanvasRenderingContext2D.prototype.drawImage=function(img,...args){
   if(!seen.has(img)){seen.add(img);obs.draws.push({t:performance.now(),m:window.grimRun?.scene?.scenes[0]?.distance,src:img.currentSrc||img.src||img.constructor.name,size:[img.width,img.height]});}
   return draw.call(this,img,...args);
 };
 new PerformanceObserver(list=>{for(const e of list.getEntries())obs.tasks.push([e.startTime,e.duration]);}).observe({type:'longtask'});
 for(const evt of ['pointerdown','click'])document.addEventListener(evt,e=>{if(e.target.closest('#home-enter-btn,#start-btn'))obs.clicks.push([evt,e.target.closest('button').id,performance.now()]);},true);
}
function arm(label){
 const g=grimRun,s=g.scene.scenes[0],rows=[];let prev,end,finishFirst;
 window.observed=new Promise(resolve=>{
  function step(t){
   if(s.state!=='playing')return;
   const now=performance.now(),m=s.distance;
   if(prev)rows.push({...prev,gap:t-prev.t,cpu:end-prev.now});
   performance.mark('startAudit|'+label+'|'+m.toFixed(4));
   if(m>=22){
    g.events.off('prestep',step);g.events.off('postrender',finish);
    resolve({rows,obs:startupObs,hp:s.player.hp,engine:g.renderer.type,firstPost:finishFirst});return;
   }
   prev={t,now,m};
  }
  function finish(){end=performance.now();if(prev)finishFirst??=end;}
  g.events.on('prestep',step);g.events.on('postrender',finish);
 });
}
async function sample(browser,version,start,rep,trace,trial){
 const page=await browser.newPage({viewport:{width:740,height:360},hasTouch:true,deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(init,!trace&&!trial);
 if(trial){
  await page.route('**/assets/visuals/visual-system.js*',async route=>{
   const res=await route.fetch();let code=await res.text();
   if(trial==='table'){
    const old='for(let i=p+4;i<p+8+n;i++){crc^=b[i];for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}';
    assert(code.includes(old));code=code.replace('  function validateReviewPNG(', '  const lookup=Uint32Array.from({length:256},(_,v)=>{for(let bit=0;bit<8;bit++)v=(v>>>1)^((v&1)?0xedb88320:0);return v;});\n  function validateReviewPNG(')
      .replace(old,'for(let i=p+4;i<p+8+n;i++)crc=(crc>>>8)^lookup[(crc^b[i])&255];');
   }
   if(trial==='phases'||trial==='hold'){
    const fn='async function verifiedReviewURL(path,meta){';
    const awaitChecksum="const digest=await scope.crypto.subtle.digest('SHA-256',buffer);";
    const makeURL="return URL.createObjectURL(new Blob([buffer],{type:'image/png'}));";
    assert(code.includes(fn)&&code.includes(awaitChecksum)&&code.includes(makeURL));
    const gate=trial==='hold' ? "if(!path.includes('run-cycle-balanced-v1/') && !path.includes('run-cycle-mobile-v1/'))await (window.secondaryGate??=new Promise(r=>{window.releaseSecondary=r;}));" : '';
    code=code.replace(fn,fn+gate+"const stamp=(kind,t)=>window.startupObs.crc.push({url:path,kind,t,dt:performance.now()-t});")
      .replace(awaitChecksum,"const beginDigest=performance.now();const promise=scope.crypto.subtle.digest('SHA-256',buffer);stamp('digest dispatch',beginDigest);const digest=await promise;")
      .replace(makeURL,"const beginBlob=performance.now();const data=new Blob([buffer],{type:'image/png'});stamp('blob',beginBlob);const beginURL=performance.now();const url=URL.createObjectURL(data);stamp('url',beginURL);return url;");
   }
   const call='validateReviewPNG(buffer,meta);';assert(code.includes(call));
   code=code.replace(call,'const auditT=performance.now();'+call+'window.startupObs.crc.push({url:path,kind:"crc",t:auditT,dt:performance.now()-auditT});');
   await route.fulfill({response:res,body:code});
  });
 }
 try{
  const c=await page.context().newCDPSession(page);
  await publicPage(page,33);
  if(trace)await c.send('Tracing.start',{transferMode:'ReturnAsStream',streamFormat:'json',streamCompression:'gzip',categories:'toplevel,devtools.timeline,blink.user_timing,loading,cc,gpu,v8,blink,skia,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,disabled-by-default-v8.cpu_profiler,disabled-by-default-devtools.timeline.stack'});
  await page.locator('#home-enter-btn').click();await page.waitForFunction(()=>window.grimRun?.scene.scenes[0]?.ui);
  if(start==='delayed')await page.waitForTimeout(4000);
  for(let i=0;i<2;i++){
   if(i&&trial==='hold')await page.evaluate(async()=>{window.releaseSecondary();await grimRun.scene.scenes[0].visuals.reviewLoad;});
   if(i)await page.evaluate(()=>grimRun.scene.scenes[0].goToMenu());
   const label=[version,start,rep,trial||'native',i?'warm':'fresh'].join('-');
   await page.evaluate(arm,label);await page.locator('#start-btn').click();const d=await page.evaluate(()=>observed);
   const tap=d.obs.clicks.filter(k=>k[1]==='start-btn'&&k[0]==='pointerdown').at(-1)[2];
   const home=d.obs.clicks.find(k=>k[1]==='home-enter-btn'&&k[0]==='pointerdown')[2];
   const rows=d.rows,peaks=rows.filter(r=>r.m>=4&&r.m<=15).sort((a,b)=>b.gap-a.gap);
   const summary={label,n:rows.length,fromHome:tap-home,tapToPlay:rows[0].now-tap,tapToFirstDraw:d.firstPost-tap,firstInterval:rows[0].gap,
    peak:peaks[0],over50:rows.filter(r=>r.gap>50.5).map(r=>[r.m,r.gap]),hp:d.hp,homeToAvailable:d.obs.available-home,errors};
   fs.writeFileSync(path.join(out,label+'.json'),JSON.stringify({d,summary}));console.log('RESULT '+JSON.stringify(summary));
   assert(d.engine===1&&d.hp===3&&rows.length>24);assert.deepEqual(errors,[]);
  }
  if(trace)await stopTrace(c,[version,start,rep,trial||'native'].join('-'));
 }finally{await page.close();}
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const b=await chromium.launch({args:['--disable-webgl']});
 try{
  const mode=process.env.CASE||'native';
  if(mode==='public'){
   for(const [i,start] of ['immediate','delayed','immediate','immediate'].entries())await sample(b,'after',start,i+1,false,null);
   const peaks=fs.readdirSync(out).filter(n=>n.includes('-immediate-')&&n.endsWith('-fresh.json')).map(n=>{
    const {d}=JSON.parse(fs.readFileSync(path.join(out,n)));return Math.max(...d.rows.filter(r=>r.m>=0.4&&r.m<=12).map(r=>r.gap));
   }).sort((a,b)=>a-b);
   console.log('Public immediate-Start worst moving frame through 12 m',peaks);
   assert.equal(peaks.length,3);assert(peaks[1]<=34 && peaks.every(p=>p<66),'Recurring public opening hitch');

  }else if(mode==='traced'){
   for(const version of ['before','after'])await sample(b,version,'immediate',1,true,null);
  }else if(mode==='phases'||mode==='hold'||mode==='native-first'){
   for(let i=1;i<=3;i++)await sample(b,'after','immediate',i,i===2,mode==='native-first'?null:mode);
  }else if(mode==='paired'){
   const cases=[['before','immediate'],['after','immediate'],['after','immediate'],['before','immediate'],
    ['before','delayed'],['after','delayed'],['after','delayed'],['before','delayed'],
    ['after','immediate'],['before','immediate'],['before','immediate'],['after','immediate']];
   for(const [i,[version,start]] of cases.entries()) await sample(b,version,start,i+1,false,null);
   const groups={before:[],after:[]};
   for(const file of fs.readdirSync(out).filter(n=>n.includes('-immediate-')&&n.endsWith('-fresh.json'))){
    const {d,summary}=JSON.parse(fs.readFileSync(path.join(out,file)));
    const peak=Math.max(...d.rows.filter(r=>r.m>=0.4&&r.m<=5).map(r=>r.gap));
    groups[file.split('-')[0]].push(peak);assert.equal(summary.errors.length,0);
   }
   const median=list=>{const sorted=[...list].sort((a,b)=>a-b);return (sorted[1]+sorted[2])/2;};
   console.log('Fresh peak intervals 0.4–5 m',groups);
   assert.equal(groups.before.length,4);assert.equal(groups.after.length,4);
   assert(median(groups.before)>=65, 'Baseline must reproduce the cold hitch');
   assert(median(groups.after)<=34 && median(groups.before)-median(groups.after)>32, 'Candidate must remove the repeatable stall');
   assert(groups.after.every(p=>p<66),'Candidate still hitched in the target window');
  }else{
  for(const [i,start] of ['immediate','delayed','immediate'].entries())
   await sample(b,'after',start,i+1,i===0||i===1,mode==='native'?null:mode);
  }
 }finally{await b.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
