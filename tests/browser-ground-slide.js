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

async function setup(page){
  await page.evaluate(()=>{
    const g=window.grimRun,s=g.scene.scenes[0];
    s.startRun();s.state='playing';s.ui.setMode('playing');g.loop.sleep();
    clearInterval(s.loopWatchdogId);s.sys.sceneUpdate=()=>{};
    s.enemies=[];s.obstacles=[];s.coins=[];s.souls=[];
    s.nextEncounterX=s.nextEnemySpawnX=s.nextGroundSpawnX=s.nextSnapSpawnX=1e9;
    s.player.invulMs=0;s.drawScene();g.step(performance.now(),0);
    if(!s.slideTrace){
      s.slideTrace={forced:0};
      const draw=s.drawReaper;
      s.drawReaper=function(force=false){if(force)this.slideTrace.forced++;return draw.call(this,force);};
    }
    s.slideTrace.forced=0;
  });
}

const frame=page=>page.evaluate(()=>{
  const s=window.grimRun.scene.scenes[0],p=s.player,v=s.slideArt.sprite;
  const body=s.visuals?.reaperPoseSprites||{};
  return {low:s.lowProfile,slide:p.sliding,hold:p.holdSlide,t:p.slideMs,
    key:v?.visible?v.texture.key:null,tile:v?.visible?Number(v.frame.name):null,
    sole:v?.visible?v.y-s.feetY:null,
    original:!!body.slide?.visible,upright:Object.entries(body).some(([k,image])=>k!=='slide'&&image.visible),
    action:s.combatArt?.reaper?.some(r=>r.visible)||false,
    procedural:s.slideTrace.forced,
    contact:window.GRIM_CORE.collisionBox(p.x,s.feetY,s.lowProfile).height};
});
const step=(page,count,ms=16)=>page.evaluate(({count,ms})=>{
  const s=window.grimRun.scene.scenes[0];
  for(let i=0;i<count;i++)s.update(0,ms);
},{count,ms});

async function testReady(page){
  await setup(page);
  const pixels=await page.evaluate(()=>{
    const s=window.grimRun.scene.scenes[0],src=s.textures.get('ground-slide-paint').getSourceImage();
    const c=document.createElement('canvas');c.width=224;c.height=144;
    const ctx=c.getContext('2d',{willReadFrequently:true});
    return Array.from({length:16},(_,i)=>{
      ctx.clearRect(0,0,224,144);ctx.drawImage(src,i%4*224,Math.floor(i/4)*144,224,144,0,0,224,144);
      const data=ctx.getImageData(0,0,224,144).data;let top=144,bottom=-1,n=0;
      for(let j=3;j<data.length;j+=4)if(data[j]>=80){
        const y=Math.floor(j/4/224);top=Math.min(top,y);bottom=Math.max(bottom,y);n++;
      }
      return {top,bottom,n};
    });
  });
  assert(pixels.every(f=>f.n>1800&&f.bottom>=130&&f.bottom<=132));
  assert(pixels.slice(0,10).every(f=>132-f.top<=76),'The decoded low paint fits a 76px opening from the first tick');
  assert(pixels[0].top<=pixels[5].top-5,'The decoded silhouette visibly compresses');
  assert(pixels[11].top<pixels[10].top&&pixels[12].top<pixels[11].top,'Standing recovery raises successive painted poses');

  const touch=await page.context().newCDPSession(page);
  const button=await page.locator('#slide-btn').boundingBox();
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{
    x:button.x+button.width/2,y:button.y+button.height/2,id:0
  }]});
  await step(page,1,2);
  const entry=await frame(page);
  assert(entry.low&&entry.hold&&entry.tile===0&&entry.sole===0&&entry.contact===29&&!entry.upright);
  await page.keyboard.down('ArrowDown');
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await step(page,14);
  const braced=await frame(page);
  assert(braced.low&&braced.hold&&braced.tile>=6&&braced.tile<=9,'The remaining input holds a braced slide');
  await page.keyboard.up('ArrowDown');
  await step(page,1);
  const release=await frame(page);
  assert(!release.low&&release.tile>=10&&release.tile<=15&&release.contact===79);
  await step(page,5);
  assert.equal((await frame(page)).tile,null,'The recovery has yielded to the existing run');
  await touch.detach();

  for(const rate of [30,60,120]){
    await setup(page);
    await page.keyboard.down('ArrowDown');
    await step(page,1,1000/rate);
    await page.keyboard.up('ArrowDown');
    await step(page,Math.floor(105/(1000/rate)),1000/rate);
    const low=await frame(page);
    assert(low.slide&&low.low&&low.contact===29&&low.tile<10);
    await step(page,Math.ceil(80/(1000/rate)),1000/rate);
    assert.equal((await frame(page)).low,false);
  }

  await setup(page);
  await page.keyboard.down('ArrowDown');
  await step(page,11);
  await page.keyboard.press('KeyA');await step(page,1);
  const cut=await frame(page);
  assert(cut.low&&cut.action&&cut.tile===null,'The released low attack paint takes priority');
  await page.keyboard.up('ArrowDown');

  await setup(page);
  await page.keyboard.down('ArrowDown');await step(page,11);await page.keyboard.up('ArrowDown');
  await step(page,1);
  assert((await frame(page)).tile>=10);
  await page.keyboard.down('Space');await step(page,1);await page.keyboard.up('Space');
  assert.equal((await frame(page)).tile,null,'Jump interrupts recovery immediately');
}

async function testMissing(page,mode){
  await setup(page);
  await page.keyboard.down('ArrowDown');
  await step(page,8);
  const missing=await frame(page);
  assert(missing.low&&!missing.upright&&missing.tile===null&&missing.contact===29);
  if(mode==='invalid')assert(missing.original,'A corrupt strip falls back to the original registered crouch');
  else {
    assert(missing.procedural>0&&!missing.original,'A double failure uses the low procedural actor');
    await page.evaluate(async()=>{
      const s=window.grimRun.scene.scenes[0];
      const image=new Image();image.src='assets/motion/v01912/ground-slide.webp?recovered=1';
      await image.decode();
      s.textures.addSpriteSheet('ground-slide-paint',image,{frameWidth:224,frameHeight:144,endFrame:15});
    });
    await step(page,1);const pinned=await frame(page);
    assert(pinned.tile===null&&pinned.procedural>missing.procedural,'Late paint waits for the next slide');
  }
  await page.keyboard.up('ArrowDown');
  await step(page,13);
  assert.equal((await frame(page)).tile,null,'A fallback does not insert a recovery');
  if(mode==='missing'){
    await page.keyboard.down('ArrowDown');await step(page,1);
    assert((await frame(page)).tile<10&&Number.isInteger((await frame(page)).tile));
    await page.keyboard.up('ArrowDown');
  }
}

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port+'/?seed=33';
  for(const renderer of ['canvas','webgl']){
    const browser=await chromium.launch({headless:true,args:['--no-sandbox',
      ...(renderer==='canvas'?['--disable-webgl']:['--use-angle=swiftshader','--enable-unsafe-swiftshader'])]});
    try{
      for(const [mode,width,height] of [['ready',740,360],['ready',950,430],['invalid',950,430],['missing',740,360]]){
        const page=await browser.newPage({viewport:{width,height},hasTouch:true});
        const errors=[];page.on('pageerror',e=>errors.push(e.message));
        try{
          if(mode==='invalid')await page.route('**/ground-slide.webp?v=1',r=>r.fulfill({body:'invalid WebP',contentType:'image/webp'}));
          if(mode==='missing'){
            await page.route('**/ground-slide.webp?v=1',r=>r.abort());
            await page.route('**/slide-mobile-v1.png*',r=>r.abort());
          }
          await page.goto(url,{waitUntil:'domcontentloaded'});
          await page.waitForFunction(()=>window.grimRun?.scene.scenes[0]?.visuals?.loaded, null,{timeout:50000});
          assert.equal(await page.evaluate(()=>window.grimRun.renderer.type),renderer==='canvas'?1:2);
          if(mode==='ready')await testReady(page);
          else await testMissing(page,mode);
          assert.deepEqual(errors,[]);
          console.log('PASS ground Slide',renderer,width+'x'+height,mode);
        }finally{await page.close();}
      }
    }finally{await browser.close();}
  }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
