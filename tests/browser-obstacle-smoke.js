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
    assert.equal(loaded.count,96,'catalog is loaded in the game');
    assert.equal(loaded.badge,'v0.19.5 · GROUNDED MIST','visible version badge matches the current art release');
    assert.deepEqual(loaded.missing,[],'all 96 obstacle textures load in actual Phaser');
    assert.deepEqual(loaded.wrongSize,[],'all textures retain their intended 3x source size');
    assert.equal(loaded.images,152,'all 24 upper paintings and 32 unique supports load');
    assert.equal(loaded.supports.length,32,'every slide and airborne variant has a paired support');
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
          width:skin.gameW*scale.x,height:Math.max(s.height*1.22,475),originY:1}:null;
        const ok=s.drawObstacleSprite(o,placement),image=s.obstacleSpriteObjects.get(o);
        const expected=placement?{width:placement.width,height:placement.height}:
          type==='tuckGate'?{width:skin.biome==='ashlands'?196:176,height:400}:
          type==='airBramble'?{width:148,height:218}:
          type==='snappingBramble'?{width:384*.768,height:400*.768}:
          {width:o.width*scale.x,height:o.height*scale.y};
        if(!ok||!image||image.texture.key!==(type==='snappingBramble'?'revision-plant':skin.key)||
          Math.abs(image?.displayWidth-expected.width)>.001||
          Math.abs(image?.displayHeight-expected.height)>.001){
          renderMisses++;renderFailures.push({id:skin.id,expected,actual:image&&
            {width:image.displayWidth,height:image.displayHeight}});
        }
        const visualGround=type==='bramble'?(s.terrain.groundAt(o.x+o.width/2)??o.y+o.height):o.y+o.height;
        if((skin.category==='jump'||skin.category==='fire'||(skin.category==='cut'&&type==='bramble'))&&
          (!image||image.originY!==(skin.groundAnchorY??1)||
            image.y!==visualGround+s.obstacleVisualInset(o,skin))){
          renderMisses++;renderFailures.push({id:skin.id,anchor:{originY:image?.originY,y:image?.y},
            expectedAnchor:{originY:skin.groundAnchorY??1,
              y:visualGround+s.obstacleVisualInset(o,skin)}});
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
      const branchBack=s.obstacleBackObjects.get(branch);
      const branchSupport=s.obstacleSupportObjects.get(branch);
      const branchSkin=branchImage&&skins.find(skin=>skin.key===branchImage.texture.key);
      if(!branchImage||Math.abs(branchImage.displayWidth-74*3.25)>.001||
        Math.abs(branchImage.displayHeight-Math.max(s.height*1.22,475))>.001||
        branchImage.y!==224||branchImage.originY!==1){
        renderMisses++;renderFailures.push({id:'actual-slide-render',actual:branchImage&&
          {width:branchImage.displayWidth,height:branchImage.displayHeight,y:branchImage.y,
            originY:branchImage.originY},skin:branchSkin?.id});
      }
      if(!branchBack||branchBack.y!==224||branchBack.depth!==.55||
        branchBack.displayHeight!==branchImage?.displayHeight||
        branchImage.depth!==16||branchImage.depth<=s.actor.depth){
        renderMisses++;renderFailures.push({id:'painted-slide-backing-missing'});
      }
      if(!branchSupport||branchSupport.texture.key!==branchSkin?.supportKey||
        branchSupport.depth!==.53||branchSupport.y!==320||
        Math.abs(branchSupport.displayWidth-74*3.25*1.6)>.001||
        Math.abs(branchSupport.displayHeight-307.2)>.001||
        branchSupport.alpha!==.95){
        renderMisses++;renderFailures.push({id:'forest-slide-support-missing'});
      }
      branchImage?.destroy();s.obstacleSpriteObjects.delete(branch);
      branchBack?.destroy();s.obstacleBackObjects.delete(branch);
      branchSupport?.destroy();s.obstacleSupportObjects.delete(branch);
      s.terrain.groundAt=oldGroundAt;s.terrain.anchorAt=oldAnchorAt;
      const board=[
        ['forest_jump_root-knot',106,328,'rock'],
        ['forest_slide_root-shelf',322,252,'branch'],
        ['forest_cut_thorny-young-pine',552,328,'bramble'],
        ['forest_cut_corn-tangle',700,328,'bramble'],
        ['lava_fire_lava-flare',855,328,'fire']
      ];
      s.add.graphics().setScrollFactor(0).setDepth(37)
        .fillStyle(0x111722,1).fillRect(0,0,950,430);
      const ground=s.add.graphics().setScrollFactor(0).setDepth(39);
      ground.fillStyle(0x273339,1).fillRect(0,328,950,102);
      ground.lineStyle(4,0x617b70,.85).lineBetween(0,328,950,328);
      const forestSkin=skins.find(item=>item.id==='forest_slide_root-shelf');
      s.add.image(322,348,forestSkin.supportKey).setOrigin(.5,1)
        .setDisplaySize(74*3.25*1.6,(348-252+96)*1.6).setScrollFactor(0).setDepth(37.5)
        .setTint(0xbfc6bf).setAlpha(.95);
      s.add.image(322,252,forestSkin.backKey).setOrigin(.5,1)
        .setDisplaySize(74*3.25,Math.max(s.height*1.22,475)).setScrollFactor(0).setDepth(38);
      s.add.text(475,18,'OBSTACLE ART — PHONE-SCALE PREVIEW',{
        fontFamily:'system-ui,Arial',fontSize:'16px',fontStyle:'bold',color:'#e8f5f4'
      }).setOrigin(.5).setScrollFactor(0).setDepth(42);
      for(const [id,x,y,type] of board){
        const skin=skins.find(item=>item.id===id);
        const scale=s.obstacleSpriteScaleFor(skin,type);
        const baseHeight=type==='bramble'?220:skin.gameH;
        const groundAnchored=['jump','slide','cut','fire'].includes(skin.category);
        const inset=s.obstacleVisualInset({type});
        const image=s.add.image(x,y+inset,skin.key).setOrigin(.5,type==='branch'?1:
          groundAnchored?(skin.groundAnchorY??1):.5).setScrollFactor(0).setDepth(41)
          .setDisplaySize(skin.gameW*scale.x,type==='branch'?Math.max(s.height*1.22,475):baseHeight*scale.y);
        s.add.text(x,409,skin.category.toUpperCase(),{
          fontFamily:'system-ui,Arial',fontSize:'10px',fontStyle:'bold',color:'#a9c4c7'
        }).setOrigin(.5).setScrollFactor(0).setDepth(42);
        image.setVisible(true);
      }
      return {checked:checked.length,selectorMisses,renderMisses,renderFailures};
    });
    assert.deepEqual(exercise,{checked:96,selectorMisses:0,renderMisses:0,renderFailures:[]},
      'every biome skin is selectable, scaled, and anchored at its intended baseline');

    await page.waitForTimeout(100);
    const resultDir=path.join(root,'test-results');
    fs.mkdirSync(resultDir,{recursive:true});
    await page.locator('#game canvas').screenshot({path:path.join(resultDir,'obstacle-sprites-phone-scale.png')});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>['home','menu'].includes(window.grimRun?.scene?.scenes?.[0]?.state));
    const slides=[
      ['forest','dead-bough-curtain'],['forest','root-shelf'],['forest','thorn-canopy'],
      ['foothills','rock-lip'],['foothills','fallen-pine-overhang'],['foothills','grass-root-ledge'],
      ['tundra','ice-lip'],['tundra','frozen-pine-limbs'],['tundra','snow-shelf'],
      ['caves','stalactite-curtain'],['caves','fossil-rib-arch'],['caves','hanging-roots'],
      ['crystals','blue-crystal-ceiling'],['crystals','violet-geode-shelf'],['crystals','prism-canopy'],
      ['ashlands','charred-bough'],['ashlands','basalt-shelf'],['ashlands','blackroot-curtain'],
      ['lava','basalt-lip'],['lava','slag-teeth'],['lava','lava-glass-shelf'],
      ['boss','chain-stone-lintel'],['boss','bone-arch'],['boss','ruined-portcullis']
    ];
    for(const [biome,name] of slides){
      const view=await page.evaluate(({biome,name})=>{
        const s=window.grimRun.scene.scenes[0];
        const skin=window.GRIM_OBSTACLE_SPRITES.find(item=>item.id===biome+'_slide_'+name);
        document.querySelector('#menu')?.classList.add('hidden');
        for(const image of window.forestArtPreview||[])image.destroy();
        const x=475,underside=252,bottom=348,width=74*3.25;
        const height=Math.max(s.height*1.22,475);
        window.forestArtPreview=[
          s.add.image(x,bottom,skin.supportKey).setOrigin(.5,1)
            .setDisplaySize(width*1.6,(bottom-underside+96)*1.6)
            .setDepth(.53).setScrollFactor(0).setTint(0xbfc6bf).setAlpha(.95),
          s.add.image(x,underside,skin.backKey).setOrigin(.5,1)
            .setDisplaySize(width,height).setDepth(.55).setScrollFactor(0),
          s.add.image(x,underside,skin.key).setOrigin(.5,1)
            .setDisplaySize(width,height).setDepth(16).setScrollFactor(0)
        ];
        return window.forestArtPreview.map(image=>({key:image.texture.key,depth:image.depth}));
      },{biome,name});
      assert.deepEqual(view,[
        {key:'obstacle-support-'+biome+'_'+name,depth:.53},
        {key:'obstacle-back-'+biome+'_'+name,depth:.55},
        {key:'obstacle-'+biome+'_slide_'+name,depth:16}
      ],biome+' '+name+' retains its unique aligned layer pair');
      await page.waitForTimeout(35);
      await page.locator('#game canvas').screenshot({path:path.join(resultDir,
        biome+'-slide-'+name+'-phone-scene.png')});
    }
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>['home','menu'].includes(window.grimRun?.scene?.scenes?.[0]?.state));
    await page.locator('#home-enter-btn').click();await page.locator('#start-btn').click();
    await page.waitForFunction(()=>window.grimRun?.scene?.scenes?.[0]?.state==='playing');
    await page.evaluate(()=>{
      const s=window.grimRun.scene.scenes[0];
      s.state='paused';s.enemies=[];s.obstacles=[];
    });
    const biomePreviews=[
      [1500,'foothills','fallen-pine-overhang'],[3400,'tundra','snow-shelf'],
      [5500,'caves','fossil-rib-arch'],[6500,'crystals','blue-crystal-ceiling'],
      [7500,'ashlands','charred-bough'],[9000,'lava','basalt-lip'],
      [11000,'boss','ruined-portcullis']
    ];
    for(const [meters,biome,name] of biomePreviews){
      await page.evaluate(m=>{
        const game=window.grimRun,s=game.scene.scenes[0],ppm=window.GRIM_CONFIG.pxPerMeter;
        s.distance=m;s.hasTeleported=m>=5000;
        s.player.x=s.startX+m*ppm;
        s.player.y=s.terrain.groundAt(s.player.x)??s.terrain.anchorAt(s.player.x);
        s.player.grounded=true;s.player.velocityY=0;
        s.cameraX=s.player.x-s.width*window.GRIM_CONFIG.reaperXRatio;
        s.cameraY=s.player.y-s.groundY;
        s.cameras.main.setScroll(s.cameraX,s.cameraY);
        s.drawScene();game.step(performance.now(),0);
      },meters);
      await page.waitForFunction(id=>{
        const s=window.grimRun?.scene?.scenes?.[0];
        return s?.terrainMaterialIds?.has(id)&&
          [...s.terrainTextureViews.values()].some(view=>view.id===id&&view.sprite.visible);
      },biome,{timeout:45000});
      const view=await page.evaluate(({biome,name})=>{
        const s=window.grimRun.scene.scenes[0];
        const skin=window.GRIM_OBSTACLE_SPRITES.find(item=>item.id===biome+'_slide_'+name);
        for(const image of window.biomeArtPreview||[])image.destroy();
        let worldX=s.cameraX+475;
        for(const offset of [0,40,-40,80,-80,120,-120]){
          const candidate=s.cameraX+475+offset;
          if(Number.isFinite(s.terrain.groundAt(candidate))){worldX=candidate;break;}
        }
        const ground=s.terrain.groundAt(worldX)??s.terrain.anchorAt(worldX);
        const underside=ground-window.GRIM_CONFIG.slideClearancePx;
        const width=74*3.25,height=Math.max(s.height*1.22,475),bottom=ground+20;
        window.biomeArtPreview=[
          s.add.image(worldX,bottom,skin.supportKey).setOrigin(.5,1)
            .setDisplaySize(width*1.6,Math.max(210,(bottom-underside+96)*1.6))
            .setDepth(.53).setTint(0xbfc6bf).setAlpha(.95),
          s.add.image(worldX,underside,skin.backKey).setOrigin(.5,1)
            .setDisplaySize(width,height).setDepth(.55),
          s.add.image(worldX,underside,skin.key).setOrigin(.5,1)
            .setDisplaySize(width,height).setDepth(16)
        ];
        return {biome,ground,under:underside,keys:window.biomeArtPreview.map(i=>i.texture.key)};
      },{biome,name});
      assert.equal(view.keys[0],'obstacle-support-'+biome+'_'+name);
      await page.waitForTimeout(80);
      await page.locator('#game canvas').screenshot({path:path.join(resultDir,
        biome+'-slide-in-biome-phone.png')});
    }
    assert.deepEqual(errors,[],'obstacle loading and rendering produce no browser exceptions');
    console.log('PASS actual Chromium: all 96 biome-exclusive obstacle sprites load, select deterministically, and render at assigned phone scale.');
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
