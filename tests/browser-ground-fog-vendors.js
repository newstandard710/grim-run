'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const {PNG}=require('pngjs');

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
    await page.waitForFunction(()=>['home','menu'].includes(window.grimRun?.scene?.scenes?.[0]?.state));
    await page.locator('#home-enter-btn').click();await page.locator('#start-btn').click();
    await page.waitForFunction(()=>window.grimRun?.scene?.scenes?.[0]?.state==='playing');
    const textures=await page.evaluate(()=>{
      const s=window.grimRun.scene.scenes[0];
      return ['drift','curl','veil','shreds'].map(name=>'ground-fog-'+name)
        .concat(['vendor-angel','vendor-demon']).map(key=>({key,loaded:s.textures.exists(key)}));
    });
    assert(textures.every(t=>t.loaded),'four mist textures and both vendor textures load');
    const mistAlpha=await page.evaluate(()=>{
      const s=window.grimRun.scene.scenes[0];
      return ['drift','curl','veil','shreds'].map(name=>{
        const source=s.textures.get('ground-fog-'+name).getSourceImage();
        const c=document.createElement('canvas');c.width=source.width;c.height=source.height;
        const g=c.getContext('2d');g.drawImage(source,0,0);
        const bytes=g.getImageData(0,0,c.width,c.height).data;
        const mean=(from,to)=>{from=Math.floor(from*c.height);to=Math.max(from+1,Math.floor(to*c.height));let sum=0;for(let y=from;y<to;y++)for(let x=0;x<c.width;x++)sum+=bytes[(y*c.width+x)*4+3];return sum/((to-from)*c.width);};
        return {name,width:source.width,height:source.height,upper:mean(.05,.35),lower:mean(.65,.90),edge:mean(0,.02)};
      });
    });
    for(const bank of mistAlpha){
      assert.equal(bank.width,900);assert(bank.height>=50&&bank.height<=96,'Natural short mist aspect ratio');
      assert(bank.lower>bank.upper*1.8,bank.name+' has airy upper wisps and denser low fog');
      assert(bank.edge<15,bank.name+' has a transparent upper margin');
    }
    await page.evaluate(()=>{
      const s=window.grimRun.scene.scenes[0];
      s.sys.sceneUpdate=()=>{};
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
        const rear=fog.filter(v=>v.depth<12),front=fog.filter(v=>v.depth>14);
        const errors=[];
        for(const bank of fog){
          const source=s.textures.get(bank.texture.key).getSourceImage();
          errors.push(Math.abs(bank.fogHeight/bank.fogWidth-source.height/source.width));
          if(!bank.fogPoints)throw Error('WebGL terrain mist must use its curved strip');
          for(let i=0;i<bank.vertices.length;i++)if(bank.fogPoints[i].bottom){
            const v=bank.vertices[i],surface=s.groundFogSurfaceAt(bank.x+v.vx);
            if(Number.isFinite(surface))errors.push(Math.abs(bank.y+v.vy-surface-4));
          }
        }
        return {fog:fog.length,onscreenFog:fog.filter(v=>
            v.x>=s.cameraX&&v.x<=s.cameraX+s.width).length,
          colors:[...new Set(fog.map(v=>v.tintTopLeft))],
          rearDepth:rear[0]?.depth,frontDepth:front[0]?.depth,
          rear:rear.length,front:front.length,mask:fog.every(v=>!!v.mask),
          maxAlpha:Math.max(...fog.map(v=>v.alpha)),
          maxHeight:Math.max(...fog.map(v=>v.fogHeight)),maxGroundError:Math.max(...errors),
          motionDepth:s.motionArt?.body.find(v=>v.visible)?.depth,
          reaperDepth:s.visuals?.reaper?.depth,actorDepth:s.actor.depth,
          vendor:vendor.map(v=>({key:v.texture.key,depth:v.depth,height:v.displayHeight})),
          terrainDepth:s.terrainBase.depth,surfaceDepth:[...s.terrainSurfaceViews.values()][0]?.sprite.depth,
          supportDepth:.53,obstacleDepth:s.obstacleFront.depth};
      },meters);
      assert(result.fog>0,name+' has visible terrain fog');
      assert(result.onscreenFog>0,name+' has a mist bank on the visible ground');
      assert(result.mask,name+' fog has a solid-terrain mask');
      assert(result.rear>0&&result.front>0,name+' has two populated fog layers');
      assert(1-(1-result.maxAlpha)**2<=.5720001,name+' equal-layer opacity is calibrated to the original fog maximum');
      assert(result.maxHeight<86,name+' enlarged mist retains low banks and airy hip-height wisps');
      assert(result.maxGroundError<.01,name+' actual projected vertices follow the curved ground within .01px');
      for(const depth of [result.reaperDepth,result.actorDepth,result.motionDepth].filter(Number.isFinite))
        assert(result.rearDepth<depth&&depth<result.frontDepth,name+' both mist layers enclose the Reaper');
      assert(result.obstacleDepth>result.frontDepth,name+' obstacles stay ahead of fog');
      assert(result.terrainDepth<10&&result.surfaceDepth<10,
        name+' ground stays behind vendor layer');
      if(name.endsWith('vendor')){
        assert(result.vendor.some(v=>v.key===('vendor-'+name.split('-')[0])&&
          v.depth===10&&v.height===142*1.75),name+' has the grounded character sprite');
      }
      await page.waitForTimeout(80);
      await page.locator('#game canvas').screenshot({path:path.join(dir,
        'ground-fog-'+name+'-phone.png')});
      // Inspect actual rasterized mist at the floor, rather than accepting
      // valid metadata while the visible painting still floats above it.
      const probes=await page.evaluate(()=>{
        const s=window.grimRun.scene.scenes[0];
        s._fogVisibility=s.children.list.map(v=>[v,v.visible]);
        for(const [v]of s._fogVisibility)v.setVisible?.(false);
        const banks=[...s.groundFogViews.values()];for(const v of banks)v.setVisible(true);
        s._fogBackground=s.cameras.main.backgroundColor.rgba;
        s.cameras.main.setBackgroundColor('#000000');
        return banks.filter(v=>v.x-s.cameraX>150&&v.x-s.cameraX<s.width-150).map(v=>({
          x:Math.round(v.x-s.cameraX),y:Math.round(s.groundFogSurfaceAt(v.x)-s.cameraY)}));
      });
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      const pixels=PNG.sync.read(await page.locator('#game canvas').screenshot());
      let floorHits=0;
      for(const p of probes){
        let foot=0,high=0;
        for(let dx=-3;dx<=3;dx++)for(let dy=-3;dy<=1;dy++){
          const offset=((p.y+dy)*pixels.width+p.x+dx)*4;
          foot=Math.max(foot,...pixels.data.subarray(offset,offset+3));
        }
        for(let dy=-100;dy<=-92;dy++){
          const offset=((p.y+dy)*pixels.width+p.x)*4;
          high=Math.max(high,...pixels.data.subarray(offset,offset+3));
        }
        if(foot>6)floorHits++;
        assert(high<3,name+' low fog stays clear of the upper Reaper silhouette');
      }
      assert(probes.length>0&&floorHits===probes.length,name+' visible painted fog reaches every tested bank floor');
      await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];
        for(const [v,visible]of s._fogVisibility)v.setVisible?.(visible);
        s.cameras.main.setBackgroundColor(s._fogBackground);s.drawScene();
      });
    }
    assert.deepEqual(errors,[],'fog and vendor renders produce no browser errors');
    // Verify the actual action renderers stay between the banks, including
    // the low slide silhouette and airborne/basic cutting weapon.
    for(const action of ['run','jump','slide','cut','air-cut']){
      const result=await page.evaluate(action=>{
        const s=window.grimRun.scene.scenes[0],p=s.player;
        p.grounded=!['jump','air-cut'].includes(action);p.sliding=action==='slide';
        p.airTuck=false;p.visualLandingMs=0;p.visualHurtMs=0;p.invulMs=0;
        p.jumpAgeMs=250;p.velocityY=-100;p.attackMs=action.endsWith('cut')?130:0;
        p.y=(s.terrain.groundAt(p.x)??s.terrain.anchorAt(p.x))-(p.grounded?0:70);
        s.drawScene();
        const body=[...s.motionArt.body,...s.combatArt.reaper,
          ...Object.values(s.visuals.reaperPoseSprites||{})].filter(v=>v.visible);
        return {depths:body.map(v=>v.depth),alpha:body.map(v=>v.alpha),
          wingDepth:s.powerArt.wingSprites[0]?.depth,
          rear:Math.max(...[...s.groundFogViews.values()].filter(v=>v.depth<12).map(v=>v.depth)),
          front:Math.min(...[...s.groundFogViews.values()].filter(v=>v.depth>14).map(v=>v.depth))};
      },action);
      assert(result.depths.length>0,action+' uses a visible painted Reaper');
      assert(result.depths.every(d=>result.rear<d&&d<result.front),action+' remains inside the fog');
      assert(result.wingDepth>result.rear,action+' rear fog also stays behind the equipped-wing layer');
      assert(Math.max(...result.alpha)>.9,action+' retains an opaque body drawing');
      await page.locator('#game canvas').screenshot({path:path.join(dir,'ground-fog-action-'+action+'.png')});
    }
    for(const viewport of [{width:667,height:375},{width:390,height:844},{width:950,height:430}]){
      await page.setViewportSize(viewport);await page.waitForTimeout(80);
      const error=await page.evaluate(()=>{
        const s=window.grimRun.scene.scenes[0];s.drawScene();let error=0;
        for(const bank of s.groundFogViews.values())for(let i=0;i<bank.vertices.length;i++){
          if(!bank.fogPoints[i].bottom)continue;
          const v=bank.vertices[i],surface=s.groundFogSurfaceAt(bank.x+v.vx);
          if(Number.isFinite(surface))error=Math.max(error,Math.abs(bank.y+v.vy-surface-4));
        }
        return error;
      });
      assert(error<.01,'Resizing keeps fog grounded in world pixels at '+viewport.width+'×'+viewport.height);
    }
    assert.deepEqual(errors,[],'fog actions produce no browser errors');
    console.log('PASS actual Chromium: eight biomes, equally corrected opacity, hip-height scaled mist, five Reaper actions and vendor layering.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
