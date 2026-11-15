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
    const e={kind:'bat',x:s.player.x+175,y:s.player.y-83,phase:.7,timer:0};
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
    e.visualHitMs=200;s.drawScene();
    const response={flight:a.bats[0].some(v=>v.visible),hurt:a.responses[0].some(v=>v.visible)};
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
  assert.deepEqual(result.response,{flight:false,hurt:true},'The separate hurt effect retains priority');
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

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port+'/?seed=33';
  for(const renderer of ['canvas','webgl']){
    const browser=await chromium.launch({headless:true,args:['--no-sandbox',
      ...(renderer==='canvas'?['--disable-webgl']:['--use-angle=swiftshader','--enable-unsafe-swiftshader'])]});
    try{
      for(const [mode,width,height] of [['ready',740,360],['ready',950,430],['invalid',740,360]]){
        const page=await browser.newPage({viewport:{width,height},hasTouch:true});
        const errors=[];page.on('pageerror',e=>errors.push(e.message));
        try{
          if(mode==='invalid')await page.route('**/cavern-bat-handoff.webp*',r=>
            r.fulfill({body:'invalid actor WebP',contentType:'image/webp'}));
          await page.goto(url,{waitUntil:'domcontentloaded'});
          await page.waitForFunction(()=>{const s=window.grimRun?.scene.scenes[0];
            return s?.visuals?.loaded&&s.visuals.batReady&&s.combatArt.ready['bat-flight'];},null,{timeout:55000});
          assert.equal(await page.evaluate(()=>window.grimRun.renderer.type),renderer==='canvas'?1:2);
          await inspect(page,mode==='ready');
          assert.deepEqual(errors,[]);
          console.log('PASS Cavern Bat solid handoff',renderer,width+'x'+height,mode);
        }finally{await page.close();}
      }
    }finally{await browser.close();}
  }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
