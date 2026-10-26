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
      return {count:skins.length,missing,wrongSize,
        images:Object.keys(s.textures.list).filter(k=>k.startsWith('obstacle-')).length};
    });
    assert.equal(loaded.count,93,'catalog is loaded in the game');
    assert.deepEqual(loaded.missing,[],'all 93 obstacle textures load in actual Phaser');
    assert.deepEqual(loaded.wrongSize,[],'all textures retain their intended 3x source size');
    assert.equal(loaded.images,93,'no obstacle texture key is missing or duplicated');

    const exercise=await page.evaluate(()=>{
      const s=window.grimRun.scene.scenes[0],skins=window.GRIM_OBSTACLE_SPRITES;
      const biomeRange={forest:[0,900],foothills:[900,2300],tundra:[2300,5000],
        caves:[5000,6000],crystals:[6000,7000],ashlands:[7000,8000],lava:[8000,9999],boss:[9999,20000]};
      const obstacleType={jump:'rock',slide:'branch',cut:'bramble',fire:'fire',
        'air-tuck':'tuckGate','air-bramble':'airBramble','snapping-bramble':'snappingBramble'};
      s.startX=200;
      const checked=[];
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
        const o={...found,y:80,width:skin.gameW,height:skin.gameH,variant:0,destroyed:false};
        if(type==='tuckGate'){o.height=1433;o.y=0;}
        if(type==='snappingBramble')s.snappingBox=()=>({x:o.x,y:o.y,width:o.width,height:o.height});
        const placement=type==='branch'?{x:skin.gameW/2,y:skin.gameH/2,
          width:skin.gameW,height:skin.gameH}:null;
        const ok=s.drawObstacleSprite(o,placement),image=s.obstacleSpriteObjects.get(o);
        if(!ok||!image||image.texture.key!==skin.key||
          image.displayWidth!==skin.gameW||image.displayHeight!==skin.gameH)renderMisses++;
        image?.destroy();s.obstacleSpriteObjects.delete(o);
        checked.push(skin.id);
      }
      const board=[
        ['forest_jump_root-knot',78,203],
        ['caves_slide_stalactite-curtain',210,168],
        ['lava_cut_lava-glass-thorn',342,194],
        ['lava_fire_lava-flare',474,331],
        ['ashlands_air-tuck_basalt-tuck-gate',606,214],
        ['crystals_air-bramble_floating-prism-briar',738,270],
        ['tundra_snapping-bramble_frost-snap-vine',870,306]
      ];
      const background=s.add.graphics().setScrollFactor(0).setDepth(39);
      background.fillStyle(0x111722,1).fillRect(0,0,950,430);
      s.add.text(475,18,'OBSTACLE ART — GAME-SIZE PREVIEW',{
        fontFamily:'system-ui,Arial',fontSize:'16px',fontStyle:'bold',color:'#e8f5f4'
      }).setOrigin(.5).setScrollFactor(0).setDepth(42);
      for(const [id,x,y] of board){
        const skin=skins.find(item=>item.id===id);
        const image=s.add.image(x,y,skin.key).setOrigin(.5).setScrollFactor(0).setDepth(41)
          .setDisplaySize(skin.gameW,skin.gameH);
        s.add.text(x,409,skin.category.toUpperCase(),{
          fontFamily:'system-ui,Arial',fontSize:'10px',fontStyle:'bold',color:'#a9c4c7'
        }).setOrigin(.5).setScrollFactor(0).setDepth(42);
        image.setVisible(true);
      }
      return {checked:checked.length,selectorMisses,renderMisses};
    });
    assert.deepEqual(exercise,{checked:93,selectorMisses:0,renderMisses:0},
      'every biome skin is selectable and displays at its authored game size');

    await page.waitForTimeout(100);
    const resultDir=path.join(root,'test-results');
    fs.mkdirSync(resultDir,{recursive:true});
    await page.locator('#game canvas').screenshot({path:path.join(resultDir,'obstacle-sprites-phone-scale.png')});
    assert.deepEqual(errors,[],'obstacle loading and rendering produce no browser exceptions');
    console.log('PASS actual Chromium: all 93 biome-exclusive obstacle sprites load, select deterministically, and render at game scale.');
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
