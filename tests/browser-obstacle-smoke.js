'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    const rel=decodeURIComponent(url.pathname.replace(/^\/+/,'' )||'index.html');
    const requested=path.resolve(root,rel);
    if(requested!==root&&!requested.startsWith(root+path.sep)){
      res.writeHead(403).end('Forbidden');return;
    }
    res.writeHead(200,{'Content-Type':types[path.extname(requested)]||'application/octet-stream'});
    res.end(fs.readFileSync(requested));
  }catch(e){res.writeHead(404).end(String(e));}
});

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:950,height:430}});
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(origin+'/?seed=33',{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForFunction(()=>['home','menu'].includes(window.grimRun?.scene?.scenes?.[0]?.state),null,{timeout:45000});
    const loaded=await page.evaluate(()=>{
      const s=window.grimRun.scene.scenes[0],skins=window.GRIM_OBSTACLE_SPRITES||[];
      const missing=skins.filter(skin=>!s.textures.exists(skin.key)||
        (skin.backKey&&!s.textures.exists(skin.backKey))||
        (skin.supportKey&&!s.textures.exists(skin.supportKey))).map(skin=>skin.id);
      const wrongSize=skins.filter(skin=>{
        if(!s.textures.exists(skin.key))return false;
        const source=s.textures.get(skin.key).getSourceImage();
        if(skin.landform)return source.width<skin.landform.feet[1]||source.height<skin.landform.footY;
        if(skin.gateSize)return source.width<skin.gateSize[0]||source.height<skin.gateSize[1];
        return skin.category==='slide'?
          source.width!==512||source.height<350:
          source.width!==skin.gameW*3||source.height!==skin.gameH*3;
      }).map(skin=>skin.id);
      const alphaCanvas=document.createElement('canvas');
      const alphaContext=alphaCanvas.getContext('2d',{willReadFrequently:true});
      const baselineErrors=[];
      for(const skin of skins.filter(item=>['jump','cut','fire'].includes(item.category))){
        const source=s.textures.get(skin.key).getSourceImage();
        alphaCanvas.width=source.width;alphaCanvas.height=source.height;
        alphaContext.drawImage(source,0,0);
        const pixels=alphaContext.getImageData(0,0,source.width,source.height).data;
        let bottom=source.height;
        outer:for(let y=source.height-1;y>=0;y--){
          for(let x=0;x<source.width;x++)if(pixels[(y*source.width+x)*4+3]>32){
            bottom=y+1;break outer;
          }
        }
        const actual=skin.groundAnchorY??1,expected=bottom/source.height;
        if(Math.abs(actual-expected)>.0006)baselineErrors.push({id:skin.id,actual,expected});
      }
      const supports=skins.filter(skin=>skin.supportKey).map(skin=>skin.id);
      return {count:skins.length,missing,wrongSize,supports,
        badge:document.querySelector('.mini')?.textContent.trim(),
        images:Object.keys(s.textures.list).filter(k=>k.startsWith('obstacle-')).length,
        baselineErrors};
    });
    assert.equal(loaded.count,112,'catalog is loaded in the game');
    assert.equal(loaded.badge,'v0.19.22','visible version badge matches the current art release');
    assert.deepEqual(loaded.missing,[],'all 112 obstacle textures load in actual Phaser');
    assert.deepEqual(loaded.wrongSize,[],'all textures retain their intended 3x source size');
    assert.equal(loaded.images,120,'40 landforms use one load each and 8 airborne supports load');
    assert.equal(loaded.supports.length,8,'all airborne variants retain their paired supports');
    assert.deepEqual(loaded.baselineErrors,[],'ground anchors align to the lowest clearly visible art pixel');

    const exercise=await page.evaluate(()=>{
      const s=window.grimRun.scene.scenes[0],skins=window.GRIM_OBSTACLE_SPRITES;
      document.querySelector('#menu')?.classList.add('hidden');
      const biomeRange={forest:[0,900],foothills:[900,2300],tundra:[2300,5000],
        caves:[5000,6000],crystals:[6000,7000],ashlands:[7000,8000],lava:[8000,9999],boss:[9999,20000]};
      const obstacleType={jump:'rock',slide:'branch',cut:'bramble',fire:'fire',
        'air-tuck':'tuckGate','air-bramble':'airBramble','snapping-bramble':'snappingBramble'};
      s.startX=200;
      const checked=[];
      const renderFailures=[];
      let selectorMisses=0,renderMisses=0;
      const oldGroundAt=s.terrain.groundAt,oldAnchorAt=s.terrain.anchorAt;
      for(const skin of skins){
        const range=biomeRange[skin.biome],base=s.startX+((range[0]+range[1])/2)*window.GRIM_CONFIG.pxPerMeter;
        const type=obstacleType[skin.category];
        let found=null;
        for(let dx=0;dx<1000;dx++){
          const candidate={type,x:base+dx};
          if(type==='branch')s.chooseSlideSkin(candidate);
          if(s.obstacleSkinFor(candidate)?.id===skin.id){found=candidate;break;}
        }
        if(!found){selectorMisses++;continue;}
        const o={...found,y:80,width:skin.gameW,
          height:type==='bramble'?220:skin.gameH,variant:0,destroyed:false};
        if(type==='tuckGate'){o.height=1433;o.y=0;}
        if(type==='snappingBramble')s.snappingBox=()=>({x:o.x,y:o.y,width:o.width,height:o.height});
        const scale=s.obstacleSpriteScaleFor(skin,type);
        const placement=type==='branch'?{x:skin.gameW/2,y:180,
          width:skin.gameW*scale.x,height:Math.max(s.height*1.22,475),originY:1}:null;
        const grounded=['jump','cut','fire'].includes(skin.category);
        if(grounded)s.terrain.groundAt=x=>300+(x-o.x)*.32;
        const ok=s.drawObstacleSprite(o,placement),image=s.obstacleSpriteObjects.get(o);
        const expected=placement?{width:placement.width,height:placement.height}:
          type==='tuckGate'?{width:skin.gateSize?.[0]??(skin.biome==='ashlands'?196:176),height:skin.gateSize?.[1]??400}:
          type==='airBramble'?{width:148,height:218}:
          type==='snappingBramble'?{width:384*.768,height:400*.768}:
          {width:o.width*scale.x,height:o.height*scale.y};
        if(!ok||!image||image.texture.key!==(type==='snappingBramble'?'revision-plant':skin.key)||
          Math.abs(image?.displayWidth-expected.width)>.001||
          Math.abs(image?.displayHeight-expected.height)>.001){
          renderMisses++;renderFailures.push({id:skin.id,expected,actual:image&&
            {width:image.displayWidth,height:image.displayHeight}});
        }
        const reg=window.GRIM_OBSTACLE_MOUNTS[skin.id];
        const contactX=o.x+o.width/2+((reg?.[0]??.5)-.5)*(image?.displayWidth||0)+(skin.treeOffsetX??0);
        const visualGround=s.terrain.groundAt(contactX)??o.y+o.height;
        if(grounded&&(!image||image.originX!==reg[0]||Math.abs(image.x-contactX)>.001||
            image.originY!==(skin.groundAnchorY??1)||
            Math.abs(image.rotation-(type==='bramble'?0:.24))>.001||
            Math.abs(image.y-visualGround-s.obstacleVisualInset(o,skin))>.001)){
          renderMisses++;renderFailures.push({id:skin.id,anchor:{originX:image?.originX,
            originY:image?.originY,x:image?.x,y:image?.y,rotation:image?.rotation},
            expectedAnchor:{originX:reg[0],originY:skin.groundAnchorY??1,x:contactX,
              y:visualGround+s.obstacleVisualInset(o,skin)}});
        }
        s.terrain.groundAt=oldGroundAt;
        if(placement&&(!image||image.originY!==placement.originY||image.y!==placement.y)){
          renderMisses++;renderFailures.push({id:skin.id,placement:{originY:image?.originY,y:image?.y},
            expectedPlacement:{originY:placement.originY,y:placement.y}});
        }
        image?.destroy();s.obstacleSpriteObjects.delete(o);
        checked.push(skin.id);
      }
      s.terrain.groundAt=()=>300;s.terrain.anchorAt=()=>300;
      const branch={type:'branch',x:s.startX+400*window.GRIM_CONFIG.pxPerMeter,
        y:-1700,width:74,height:1924,variant:0,destroyed:false};
      s.cameraX=branch.x-300;
      s.drawObstacle(branch);
      const branchImage=s.obstacleSpriteObjects.get(branch);
      const branchSupport=s.obstacleSupportObjects.get(branch);
      const branchSkin=s.obstacleSkinFor(branch);
      const mounted=branchSupport?.mountFeet;
      if(!branchImage||!branchSupport||branchSupport.mountSource!==branchSkin?.key||
        branchSupport.depth!==.53||branchSupport.depth>=s.terrainBase.depth||
        branchImage.depth!==16||branchImage.depth<=s.actor.depth||
        branchImage.y+branchImage.height<222||branchImage.y+branchImage.height>225||
        !mounted||mounted.length!==2||mounted.some(foot=>foot.y!==313)){
        renderMisses++;renderFailures.push({id:'actual-slide-registration-and-depth',mounted});
      }
      s.terrain.groundAt=z=>300+(z-branch.x)*.39;
      s.drawObstacle(branch);
      const remounted=s.obstacleSupportObjects.get(branch);
      if(remounted===branchSupport||remounted?.mountFeet?.some(foot=>
        Math.abs(foot.y-s.terrain.groundAt(foot.x)-13)>.001)){
        renderMisses++;renderFailures.push({id:'slide-support-slope-contact'});
      }
      const mountKey=remounted?.texture.key;
      const oldObstacles=s.obstacles,oldCamera=s.cameraX;
      s.obstacles=[branch];s.cameraX=branch.x+1200;
      s.cleanupObstacleSprites();
      const removedOffscreen=!s.textures.exists(mountKey)&&!s.obstacleSupportObjects.has(branch);
      s.cameraX=oldCamera;s.drawObstacle(branch);
      const rebuilt=s.obstacleSupportObjects.has(branch);
      const rebuiltKey=s.obstacleSupportObjects.get(branch)?.texture.key;
      branch.destroyed=true;s.cleanupObstacleSprites();
      if(!removedOffscreen||!rebuilt||s.textures.exists(rebuiltKey)||s.obstacleSupportObjects.has(branch)){
        renderMisses++;renderFailures.push({id:'slide-support-texture-lifecycle',removedOffscreen,rebuilt});
      }
      // A missing/failed painting still provides a clear procedural cue.
      s.textures.remove(branchSkin.key);
      const graphics=s.obstacleFront,original=graphics.fillRoundedRect;
      let fallback;
      graphics.fillRoundedRect=function(...args){fallback=args;return original.apply(this,args);};
      branch.destroyed=false;
      s.drawObstacle(branch);
      graphics.fillRoundedRect=original;
      const underside=window.GRIM_CORE.slideCeilingBottomAt(s.terrain.groundAt,branch.x+branch.width/2,
        window.GRIM_CONFIG.slideClearancePx);
      if(!fallback||fallback[0]!==branch.x||Math.abs(fallback[1]+fallback[3]-underside)>.001||
        fallback[2]!==branch.width||s.obstacleSupportObjects.has(branch)||s.obstacleSpriteObjects.has(branch)){
        renderMisses++;renderFailures.push({id:'slide-missing-paint-fallback',fallback});
      }
      s.obstacles=oldObstacles;
      s.terrain.groundAt=oldGroundAt;s.terrain.anchorAt=oldAnchorAt;
      return {checked:checked.length,selectorMisses,renderMisses,renderFailures};
    });
    assert.deepEqual(exercise,{checked:112,selectorMisses:0,renderMisses:0,renderFailures:[]},
      'every biome skin is selectable, scaled, and anchored at its intended baseline');

    const resultDir=path.join(root,'test-results');fs.mkdirSync(resultDir,{recursive:true});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('#home-enter-btn').click();
    await page.locator('#start-btn').click();
    await page.waitForFunction(()=>window.grimRun?.scene.scenes[0]?.state==='playing');
    await page.addScriptTag({path:path.join(__dirname,'obstacle-review-scene.js')});
    const skins=await page.evaluate(()=>GRIM_OBSTACLE_SPRITES.filter(s=>s.category==='slide'));
    const representative=new Set(['fallen-pine-overhang','snow-shelf','fossil-rib-arch',
      'blue-crystal-ceiling','charred-bough','basalt-lip','ruined-portcullis']);
    for(const skin of skins){
      await page.evaluate(id=>obstacleReview.prepare({id,gallery:true}),skin.id);
      await page.waitForFunction(()=>obstacleReview.ready(),null,{polling:180,timeout:60000});
      await page.evaluate(()=>obstacleReview.inspect());
      const file=path.join(resultDir,skin.biome+'-slide-'+skin.name+'-phone-scene.png');
      await page.screenshot({path:file});
      if(representative.has(skin.name))fs.copyFileSync(file,path.join(resultDir,skin.biome+'-slide-in-biome-phone.png'));
      if(skin.id==='forest_slide_root-shelf')fs.copyFileSync(file,path.join(resultDir,'obstacle-sprites-phone-scale.png'));
      await page.evaluate(()=>obstacleReview.cleanup());
    }
    assert.deepEqual(errors,[],'obstacle loading and rendering produce no browser exceptions');
    console.log('PASS actual Chromium: all 112 biome-exclusive obstacle sprites load, select deterministically, and render at assigned phone scale.');
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
