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
    await page.evaluate(()=>{
      const s=window.grimRun.scene.scenes[0];s.state='paused';s.enemies=[];
    });
    const dir=path.join(root,'test-results');fs.mkdirSync(dir,{recursive:true});
    // Select actual generated airborne obstacles; preview placement does not
    // mutate spawn selection, collision geometry, or clearance definitions.
    const available=await page.evaluate(()=>{
      const s=window.grimRun.scene.scenes[0];
      return {tucks:s.obstacles.filter(o=>o.type==='tuckGate').length,
        attacks:s.obstacles.filter(o=>o.type==='airBramble').length};
    });
    assert(available.tucks>=2&&available.attacks>=1,'both actual combo types are generated');
    for(const [type,biome,filename] of [
      ['tuckGate','ashlands','air-tuck-ashlands-jump-slide-phone.png'],
      ['tuckGate','lava','air-tuck-lava-jump-slide-phone.png'],
      ['airBramble','foothills','air-bramble-jump-attack-phone.png']]){
      const view=await page.evaluate(({type,biome})=>{
        const game=window.grimRun,s=game.scene.scenes[0],C=window.GRIM_CONFIG;
        const candidates=s.obstacles.filter(o=>o.type===type);
        const o=candidates.find(ob=>s.obstacleBiomeFor(ob)===biome);
        if(!o)return {missing:biome+' '+type};
        const saved=s.obstacles;s.obstacles=[o];
        s.distance=(o.x-s.startX)/C.pxPerMeter;s.hasTeleported=s.distance>=5000;
        s.player.x=o.x-180;s.player.y=o.baseY;s.player.grounded=true;s.player.velocityY=0;
        s.cameraX=o.x-510;s.cameraY=o.baseY-s.groundY;
        s.cameras.main.setScroll(s.cameraX,s.cameraY);
        s.drawScene();game.step(performance.now(),0);
        const front=s.obstacleSpriteObjects.get(o),support=s.obstacleSupportObjects.get(o);
        const info={biome:s.obstacleBiomeFor(o),type,collision:{x:o.x,y:o.y,w:o.width,h:o.height},
          front:{key:front?.texture.key,w:front?.displayWidth,h:front?.displayHeight,
            y:front?.y,originY:front?.originY,depth:front?.depth},
          support:{key:support?.texture.key,w:support?.displayWidth,h:support?.displayHeight,
            y:support?.y,originY:support?.originY,depth:support?.depth,alpha:support?.alpha},
          reaperDepth:s.visuals?.reaper?.depth,groundDepth:s.terrainBase.depth};
        s.obstacles=saved;
        return info;
      },{type,biome});
      assert(!view.missing,'an actual generated '+biome+' '+type+' encounter is available');
      assert(view.front.key.startsWith('obstacle-'),type+' has its foreground sprite');
      assert(view.support.key.startsWith('obstacle-support-'),type+' has paired support');
      assert(view.front.depth>view.reaperDepth&&view.groundDepth>view.support.depth,
        type+' preserves obstacle / Reaper / ground / support layer order');
      assert.equal(view.collision.w,80,type+' collision width stays unchanged');
      assert.equal(view.collision.h,type==='tuckGate'?1433:143,type+' collision height stays unchanged');
      if(type==='tuckGate'){
        assert(view.front.w>=176&&view.front.h===400,'air-tuck gate art is larger');
        assert.equal(view.front.y,view.collision.y+view.collision.h,
          'illustrated lower edge aligns with the unchanged ducking line');
        assert.equal(view.support.y,view.collision.y+view.collision.h+167-210,
          'painted ceiling chains descend visibly into the upper gate');
      }else assert(view.front.w===148&&view.front.h===218,'air attack art is larger');
      await page.waitForTimeout(100);
      await page.locator('#game canvas').screenshot({path:path.join(dir,filename)});
      console.log(type+' screenshot',view.biome,view.front.key,view.support.key);
    }
    assert.deepEqual(errors,[],'no page errors in airborne encounter render');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
