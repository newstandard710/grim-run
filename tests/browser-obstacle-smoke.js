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
    await page.waitForFunction(()=>window.grimRun?.scene?.scenes?.[0]?.state==='menu',null,{timeout:45000});
    const loaded=await page.evaluate(()=>{
      const s=window.grimRun.scene.scenes[0],skins=window.GRIM_OBSTACLE_SPRITES||[];
      const missing=skins.filter(skin=>!s.textures.exists(skin.key)).map(skin=>skin.id);
      const wrongSize=skins.filter(skin=>{
        if(!s.textures.exists(skin.key))return false;
        const source=s.textures.get(skin.key).getSourceImage();
        return source.width!==skin.gameW*3||source.height!==skin.gameH*3;
      }).map(skin=>skin.id);
      const alphaCanvas=document.createElement('canvas');
      const alphaContext=alphaCanvas.getContext('2d',{willReadFrequently:true});
      const baselineErrors=[];
      for(const skin of skins.filter(item=>['jump','slide','cut'].includes(item.category))){
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
      return {count:skins.length,missing,wrongSize,
        badge:document.querySelector('.mini')?.textContent.trim(),
        images:Object.keys(s.textures.list).filter(k=>k.startsWith('obstacle-')).length,
        baselineErrors};
    });
    assert.equal(loaded.count,93,'catalog is loaded in the game');
    assert.equal(loaded.badge,'v0.14.2 · OBSTACLE GROUNDING','visible version badge matches the obstacle grounding release');
    assert.deepEqual(loaded.missing,[],'all 93 obstacle textures load in actual Phaser');
    assert.deepEqual(loaded.wrongSize,[],'all textures retain their intended 3x source size');
    assert.equal(loaded.images,93,'no obstacle texture key is missing or duplicated');
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
      for(const skin of skins){
        const range=biomeRange[skin.biome],base=s.startX+((range[0]+range[1])/2)*window.GRIM_CONFIG.pxPerMeter;
        const type=obstacleType[skin.category];
        let found=null;
        for(let dx=0;dx<1000;dx++){
          const candidate={type,x:base+dx};
          if(s.obstacleSkinFor(candidate)?.id===skin.id){found=candidate;break;}
        }
        if(!found){selectorMisses++;continue;}
        const o={...found,y:80,width:skin.gameW,
          height:type==='bramble'?220:skin.gameH,variant:0,destroyed:false};
        if(type==='tuckGate'){o.height=1433;o.y=0;}
        if(type==='snappingBramble')s.snappingBox=()=>({x:o.x,y:o.y,width:o.width,height:o.height});
        const scale=s.obstacleSpriteScaleFor(skin,type);
        const placement=type==='branch'?{x:skin.gameW/2,y:180,
          width:skin.gameW*scale.x,height:skin.gameH*scale.y,
          originY:skin.groundAnchorY??1}:null;
        const ok=s.drawObstacleSprite(o,placement),image=s.obstacleSpriteObjects.get(o);
        const expected=placement?{width:placement.width,height:placement.height}:
          type==='tuckGate'?{width:o.width,height:skin.gameH}:
          type==='snappingBramble'?{width:o.width,height:o.height}:
          {width:o.width*scale.x,height:o.height*scale.y};
        if(!ok||!image||image.texture.key!==skin.key||
          Math.abs(image?.displayWidth-expected.width)>.001||
          Math.abs(image?.displayHeight-expected.height)>.001){
          renderMisses++;renderFailures.push({id:skin.id,expected,actual:image&&
            {width:image.displayWidth,height:image.displayHeight}});
        }
        if((skin.category==='jump'||(skin.category==='cut'&&type==='bramble'))&&
          (!image||image.originY!==(skin.groundAnchorY??1)||
            image.y!==o.y+o.height+s.obstacleVisualInset(o))){
          renderMisses++;renderFailures.push({id:skin.id,anchor:{originY:image?.originY,y:image?.y},
            expectedAnchor:{originY:skin.groundAnchorY??1,
              y:o.y+o.height+s.obstacleVisualInset(o)}});
        }
        if(placement&&(!image||image.originY!==placement.originY||image.y!==placement.y)){
          renderMisses++;renderFailures.push({id:skin.id,placement:{originY:image?.originY,y:image?.y},
            expectedPlacement:{originY:placement.originY,y:placement.y}});
        }
        image?.destroy();s.obstacleSpriteObjects.delete(o);
        checked.push(skin.id);
      }
      const oldGroundAt=s.terrain.groundAt,oldAnchorAt=s.terrain.anchorAt;
      s.terrain.groundAt=()=>300;s.terrain.anchorAt=()=>300;
      const branch={type:'branch',x:s.startX+400*window.GRIM_CONFIG.pxPerMeter,
        y:-1700,width:74,height:1924,variant:0,destroyed:false};
      s.drawObstacle(branch);
      const branchImage=s.obstacleSpriteObjects.get(branch);
      const branchSkin=branchImage&&skins.find(skin=>skin.key===branchImage.texture.key);
      if(!branchImage||Math.abs(branchImage.displayWidth-74*3.25)>.001||
        Math.abs(branchImage.displayHeight-70*3.25)>.001||branchImage.y!==224||
        branchImage.originY!==(branchSkin?.groundAnchorY??1)){
        renderMisses++;renderFailures.push({id:'actual-slide-render',actual:branchImage&&
          {width:branchImage.displayWidth,height:branchImage.displayHeight,y:branchImage.y,
            originY:branchImage.originY},skin:branchSkin?.id});
      }
      if(!s.slideSupport?.commandBuffer?.length){
        renderMisses++;renderFailures.push({id:'slide-support-missing'});
      }
      branchImage?.destroy();s.obstacleSpriteObjects.delete(branch);
      s.terrain.groundAt=oldGroundAt;s.terrain.anchorAt=oldAnchorAt;
      const board=[
        ['forest_jump_root-knot',106,328,'rock'],
        ['caves_slide_stalactite-curtain',322,252,'branch'],
        ['forest_cut_thorny-young-pine',552,328,'bramble'],
        ['forest_cut_corn-tangle',700,328,'bramble'],
        ['lava_fire_lava-flare',855,328,'fire']
      ];
      const background=s.add.graphics().setScrollFactor(0).setDepth(39);
      background.fillStyle(0x111722,1).fillRect(0,0,950,430);
      background.fillStyle(0x273339,1).fillRect(0,328,950,102);
      background.lineStyle(4,0x617b70,.85).lineBetween(0,328,950,328);
      const supportPreview=s.add.graphics().setScrollFactor(0).setDepth(40);
      const actualSupport=s.slideSupport;s.slideSupport=supportPreview;
      s.drawSlideSupport({variant:0},skins.find(item=>item.id==='caves_slide_stalactite-curtain'),
        322,252,74*3.25);
      s.slideSupport=actualSupport;
      s.add.text(475,18,'OBSTACLE ART — PHONE-SCALE PREVIEW',{
        fontFamily:'system-ui,Arial',fontSize:'16px',fontStyle:'bold',color:'#e8f5f4'
      }).setOrigin(.5).setScrollFactor(0).setDepth(42);
      for(const [id,x,y,type] of board){
        const skin=skins.find(item=>item.id===id);
        const scale=s.obstacleSpriteScaleFor(skin,type);
        const baseHeight=type==='bramble'?220:skin.gameH;
        const groundAnchored=['jump','slide','cut'].includes(skin.category);
        const inset=s.obstacleVisualInset({type});
        const image=s.add.image(x,y+inset,skin.key).setOrigin(.5,groundAnchored?(skin.groundAnchorY??1):.5)
          .setScrollFactor(0).setDepth(41).setDisplaySize(skin.gameW*scale.x,baseHeight*scale.y);
        s.add.text(x,409,skin.category.toUpperCase(),{
          fontFamily:'system-ui,Arial',fontSize:'10px',fontStyle:'bold',color:'#a9c4c7'
        }).setOrigin(.5).setScrollFactor(0).setDepth(42);
        image.setVisible(true);
      }
      return {checked:checked.length,selectorMisses,renderMisses,renderFailures};
    });
    assert.deepEqual(exercise,{checked:93,selectorMisses:0,renderMisses:0,renderFailures:[]},
      'every biome skin is selectable, scaled, and anchored at its intended baseline');

    await page.waitForTimeout(100);
    const resultDir=path.join(root,'test-results');
    fs.mkdirSync(resultDir,{recursive:true});
    await page.locator('#game canvas').screenshot({path:path.join(resultDir,'obstacle-sprites-phone-scale.png')});
    assert.deepEqual(errors,[],'obstacle loading and rendering produce no browser exceptions');
    console.log('PASS actual Chromium: all 93 biome-exclusive obstacle sprites load, select deterministically, and render at assigned phone scale.');
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
