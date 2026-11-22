'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require('playwright');

// Capture the same presentation times on the compared trees. Encoding and
// readback are deliberately outside the first-entry and warm draw measurements.
const [rootArg, label, renderer] = process.argv.slice(2);
const root = path.resolve(rootArg);
const out = path.resolve('test-results/vendor-performance', renderer, label);
const mime = {'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.png':'image/png','.ttf':'font/ttf'};
const server = http.createServer((req,res) => {
  const file = path.resolve(root, decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1)) || 'index.html');
  if (!file.startsWith(root+path.sep) || !fs.existsSync(file)) return res.writeHead(404).end();
  res.setHeader('Content-Type',mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
function begin(k) {
  const s=window.grimRun.scene.scenes[0];
  s.startRun(); s.state='playing'; s.obstacles=[]; s.enemies=[]; s.fireballs=[];
  const start=performance.now();
  s.triggerVendor(k); s.drawScene(); window.grimRun.step(performance.now(),0);
  window.grimRun.renderer.gl?.finish();
  return {entryMs:performance.now()-start,resources:[s.player.x,s.player.hp,s.coinCount,s.elapsed,s.rng.state,JSON.stringify(s.pendingOffers)]};
}
function render(ms) {
  const g=window.grimRun,s=g.scene.scenes[0];
  s.vendorIntroMs=4000-ms; s.drawScene(); g.step(performance.now(),0);
  const a=s.vendorArt;
  return {frame:Number(a.reaper.frame.name),held:a.holdingFrame(),merchant:a.canvasMerchant?.visible?'canvas':a.merchantMesh?.visible?'mesh':'still'};
}
async function inspect(browser,width,height,url) {
  const page=await browser.newPage({viewport:{width,height},hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const dir=path.join(out,width+'x'+height);
  fs.mkdirSync(dir,{recursive:true});
  try {
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.GRIM_FRONTEND?.ready && window.grimRun?.scene.scenes[0]?.visuals?.reaperReady,null,{timeout:90000});
    const engine=await page.evaluate(()=>{
      const g=window.grimRun,s=g.scene.scenes[0]; s.enterHome(); g.loop.sleep(); clearInterval(s.loopWatchdogId);
      s.sys.sceneUpdate=()=>{};
      return g.renderer.type;
    });
    assert.equal(engine,renderer==='webgl'?2:1);
    const report={renderer,width,height,encounters:{}};
    for(const [kind,k] of [['angel',1],['devil',8]]) {
      const first=await page.evaluate(begin,k);
      const costs=await page.evaluate(()=>{
        const g=window.grimRun,s=g.scene.scenes[0],samples=[];
        for(let i=0;i<64;i++){
          s.vendorIntroMs=4000-(i*43);
          const start=performance.now(); s.drawScene(); g.step(performance.now(),0); g.renderer.gl?.finish();
          samples.push(performance.now()-start);
        }
        return samples.slice(4);
      });
      const samples=width>height?Array.from({length:121},(_,i)=>Math.min(3999,i*1000/30)):[0,750,1500,2100,2400,2750,2999,3000,3600,3999];
      const frames=new Set();
      let held;
      for(const [i,ms] of samples.entries()) {
        const state=await page.evaluate(render,ms);
        assert.equal(state.merchant,renderer==='webgl'?'mesh':'canvas'); assert.equal(state.held,ms>=3000);
        frames.add(state.frame);
        // Phaser may discard the WebGL buffer after yielding; render and read
        // the completed frame in the same task in both backends.
        const jpeg=await page.evaluate(()=>{
          const g=window.grimRun;g.step(performance.now(),0);
          return g.canvas.toDataURL('image/jpeg',.94).split(',')[1];
        });
        const pixels=Buffer.from(jpeg,'base64');
        if(ms>=3000){if(held)assert(pixels.equals(held),'Complete composition holds still');held=pixels;}
        fs.writeFileSync(path.join(dir,kind+'-'+String(i).padStart(3,'0')+'.jpg'),pixels);
      }
      assert(frames.size >= (width>height?75:6));
      await page.screenshot({path:path.join(dir,kind+'-hold.png')});
      const result=await page.evaluate(()=>{
        const s=window.grimRun.scene.scenes[0],a=s.vendorArt;
        const r=a.reaper,scale=r.scaleX,layout=window.GRIM_CUTSCENE_DATA.vendor;
        const extents={left:r.x-r.originX*r.displayWidth,right:r.x+(1-r.originX)*r.displayWidth};
        const eye=layout[s.vendorType]?.at(-1).eye;
        const eyeX=eye?r.x+(eye[0]-layout.anchor[0])*scale:null;
        const resources=[s.player.x,s.player.hp,s.coinCount,s.elapsed,s.rng.state,JSON.stringify(s.pendingOffers)];
        s.finishVendorIntro();const focus=document.activeElement.id,state=s.state;s.leaveVendor();
        return {resources,focus,state,extents,eyeX};
      });
      assert.deepEqual(result.resources,first.resources); assert.equal(result.focus,'reward-title');assert.equal(result.state,'upgrade');
      if(label==='candidate'&&width<height){
        assert(result.extents.left>=0&&result.extents.right<.60*width,'Settled portrait Reaper fits before the merchant');
        assert(result.eyeX>0&&result.eyeX<width*.55);
      }
      report.encounters[kind]={entryMs:first.entryMs,drawMs:costs,distinctFrames:frames.size,extents:result.extents,eyeX:result.eyeX};
    }
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(dir,'measurements.json'),JSON.stringify(report,null,2));
    console.log('PASS',label,renderer,width,height);
  }finally{await page.close();}
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let browser;
  try {
    browser=await chromium.launch({args:['--no-sandbox',...(renderer==='webgl'?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:['--disable-webgl'])]});
    const url='http://127.0.0.1:'+server.address().port+'/?seed=33';
    await inspect(browser,740,360,url); await inspect(browser,390,844,url);
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
