'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png',
  '.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  try{
    const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost')
      .pathname.replace(/^\/+/,''))||'index.html');
    if(file!==root&&!file.startsWith(root+path.sep))return res.writeHead(403).end();
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
    res.end(fs.readFileSync(file));
  }catch(e){res.writeHead(404).end(String(e));}
});

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:950,height:430}});
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.goto('http://127.0.0.1:'+server.address().port+'/?seed=33',
      {waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForFunction(()=>window.grimRun?.scene?.scenes?.[0]?.state==='menu');
    await page.locator('#home-enter-btn').click();await page.locator('#start-btn').click();
    await page.waitForFunction(()=>window.grimRun?.scene?.scenes?.[0]?.state==='playing');
    const textures=await page.evaluate(()=>{
      const s=window.grimRun.scene.scenes[0];
      return ['drift','curl','veil','shreds'].map(name=>'ground-fog-'+name)
        .concat(['vendor-angel','vendor-demon']).map(key=>({key,loaded:s.textures.exists(key)}));
    });
    assert(textures.every(t=>t.loaded),'four mist textures and both vendor textures load');
    await page.evaluate(()=>{
      const s=window.grimRun.scene.scenes[0];
      s.state='paused';s.enemies=[];s.obstacles=[];
    });
    const dir=path.join(root,'test-results');fs.mkdirSync(dir,{recursive:true});
    const stops=[
      ['forest',350],['foothills',1500],['tundra',3400],['caves',5500],
      ['crystals',6500],['ashlands',7500],['lava',9000],['boss',11000],
      ['angel-vendor',665],['demon-vendor',5327]
    ];
    for(const [name,meters] of stops){
      const result=await page.evaluate(m=>{
        const game=window.grimRun,s=game.scene.scenes[0],C=window.GRIM_CONFIG;
        s.distance=m;s.hasTeleported=m>=5000;
        let x=s.startX+m*C.pxPerMeter;
        if(!Number.isFinite(s.terrain.groundAt(x)))
          for(let delta=8;delta<=320;delta+=8){
            if(Number.isFinite(s.terrain.groundAt(x+delta))){x+=delta;break;}
            if(Number.isFinite(s.terrain.groundAt(x-delta))){x-=delta;break;}
          }
        s.player.x=x;s.player.y=s.terrain.groundAt(x)??s.terrain.anchorAt(x);
        s.player.grounded=true;s.player.velocityY=0;
        s.cameraX=x-s.width*C.reaperXRatio;s.cameraY=s.player.y-s.groundY;
        s.cameras.main.setScroll(s.cameraX,s.cameraY);
        s.drawScene();game.step(performance.now(),0);
        const fog=[...s.groundFogViews.values()].filter(v=>v.visible);
        const vendor=[...s.vendorSpriteObjects.values()].filter(v=>v.visible);
        return {fog:fog.length,onscreenFog:fog.filter(v=>
            v.x>=s.cameraX&&v.x<=s.cameraX+s.width).length,
          colors:[...new Set(fog.map(v=>v.tintTopLeft))],
          fogDepth:fog[0]?.depth,mask:!!fog[0]?.mask,
          reaperDepth:s.visuals?.reaper?.depth,actorDepth:s.actor.depth,
          vendor:vendor.map(v=>({key:v.texture.key,depth:v.depth,height:v.displayHeight})),
          terrainDepth:s.terrainBase.depth,surfaceDepth:[...s.terrainSurfaceViews.values()][0]?.sprite.depth,
          supportDepth:.53,obstacleDepth:s.obstacleFront.depth};
      },meters);
      assert(result.fog>0,name+' has visible terrain fog');
      assert(result.onscreenFog>0,name+' has a mist bank on the visible ground');
      assert(result.mask,name+' fog has a solid-terrain mask');
      assert.equal(result.fogDepth,15,name+' fog is in front of Reaper');
      assert(result.reaperDepth<result.fogDepth&&result.actorDepth<result.fogDepth,
        name+' both Reaper renderers stay behind fog');
      assert(result.obstacleDepth>result.fogDepth,name+' obstacles stay ahead of fog');
      assert(result.terrainDepth<10&&result.surfaceDepth<10,
        name+' ground stays behind vendor layer');
      if(name.endsWith('vendor')){
        assert(result.vendor.some(v=>v.key===('vendor-'+name.split('-')[0])&&
          v.depth===10&&v.height===142*1.75),name+' has the grounded character sprite');
      }
      await page.waitForTimeout(80);
      await page.locator('#game canvas').screenshot({path:path.join(dir,
        'ground-fog-'+name+'-phone.png')});
    }
    assert.deepEqual(errors,[],'fog and vendor renders produce no browser errors');
    console.log('PASS actual Chromium: eight biomes have varied ground fog and both vendors occupy their own layer.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
