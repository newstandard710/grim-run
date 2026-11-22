'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {PNG}=require('pngjs');

async function capture(page,revision,phase){
  const {samples,png}=await page.evaluate(()=>{
    const g=grimRun,s=g.scene.scenes[0],m=s.motionArt;
    g.loop.sleep();
    const samples=[],columns=6,rows=8;
    const sheet=document.createElement('canvas'),width=g.canvas.width,height=g.canvas.height;
    sheet.width=columns*width;sheet.height=rows*height;
    const ink=sheet.getContext('2d');
    for(let i=0;i<columns*rows;i++){
      s.drawScene();g.step(1000+i*1000/30,0);
      const body=m.body[0],steel=m.weapon;
      samples.push({x:s.player.x,y:s.player.y,key:body.texture.key,cell:body.frame.name,
        bodyVisible:body.visible,weapon:steel.visible?steel.texture.key:null,
        grip:steel.visible?[steel.x,steel.y,steel.rotation,steel.scaleX,steel.scaleY,steel.depth]:null});
      ink.drawImage(g.canvas,(i%columns)*width,Math.floor(i/columns)*height);
      s.update(0,1000/60);s.update(0,1000/60);
    }
    return {samples,png:sheet.toDataURL().split(',')[1]};
  });
  assert.ok(samples.every(p=>p.bodyVisible));
  const bytes=Buffer.from(png,'base64'),{width,height}=PNG.sync.read(bytes);
  assert.deepEqual([width,height],[6*844,8*390]);
  const dir=path.join(__dirname,'../test-results');
  await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(dir,'running-grip-'+revision+'-'+phase+'.png'),bytes);
  console.log(revision,phase,'grounded run',JSON.stringify({first:samples[0],last:samples.at(-1)}));
  return samples;
}


async function missingSteel(browser,url){
  const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true});
  try{
    await page.route('**/reaper-forward-scythe.webp*',r=>r.abort());
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.locator('#home-enter-btn').click();
    await page.locator('#start-btn').click();
    await page.waitForFunction(()=>{
      const m=grimRun.scene.scenes[0].motionArt;
      return !m.carryReady&&m.body[0]?.visible&&m.state?.texture==='motion-reaper-run-solid';
    },null,{timeout:90000});
  }finally{await page.close();}
}

// Hold only the compact Cut response. Both registered carry assets are present
// during the first run. Release the response and repeat the same seeded stride.
module.exports=async function runningGrip(browser,origin,revision){
  const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true});
  let release,requested=false;
  const gate=new Promise(resolve=>{release=resolve;});
  await page.route('**/reaper-rising-compact.webp*',async route=>{
    requested=true;await gate;await route.continue();
  });
  try{
    await page.goto(origin+'/'+revision+'/?seed=33',{waitUntil:'domcontentloaded'});
    await page.locator('#home-enter-btn').click();
    await page.waitForFunction(()=>grimRun.scene.scenes[0].motionArt?.forwardReady,null,{timeout:90000});
    await page.evaluate(()=>{
      const s=grimRun.scene.scenes[0];
      s.sys.sceneUpdate=()=>{};clearInterval(s.loopWatchdogId);
    });
    await page.locator('#start-btn').click();
    assert.ok(requested);
    assert.equal(await page.evaluate(()=>!!grimRun.scene.scenes[0].motionArt.rising),false);
    const pending=await capture(page,revision,'pending');
    release();
    await page.waitForFunction(()=>{const m=grimRun.scene.scenes[0].motionArt;return m.rising&&m.airReady&&m.airCutReady;});
    await page.evaluate(()=>grimRun.scene.scenes[0].startRun());
    const warm=await capture(page,revision,'ready');
    assert.ok(warm.every(p=>p.key==='motion-reaper-forward-carry'&&p.weapon==='motion-reaper-forward-scythe'));
    if(revision==='after')assert.deepEqual(pending,warm,'each grounded step uses the approved grip during optional loading');
    if(revision==='after')await missingSteel(browser,origin+'/'+revision+'/?seed=33');
    return warm;
  }finally{release();await page.close();}
};
