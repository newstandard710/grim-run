'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),{PNG}=require('pngjs');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'test-results');fs.mkdirSync(dir,{recursive:true});
const server=http.createServer((req,res)=>{
 try{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname.replace(/^\/+/,''))||'index.html');
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));
 }catch(e){res.writeHead(404).end(String(e));}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader']});
 const context=await browser.newContext({viewport:{width:950,height:430},recordVideo:{dir,size:{width:950,height:430}}});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/?seed=33',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.grimRun?.scene?.scenes?.[0]?.visuals?.reaperPoseSprites?.jump,null,{timeout:45000});
  await page.locator('#home-enter-btn').click();await page.locator('#start-btn').click();
  await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.state='paused';s.enemies=[];s.obstacles=[];s.godMode=true;s.nextVendorNumber=15;s.ui.setMode('playing');s._revisionUpdate=s.sys.sceneUpdate;s.sys.sceneUpdate=function(){};});
  const plant=await page.evaluate(()=>{
   const s=window.grimRun.scene.scenes[0];s.player.x=s.startX+3400*12;s.distance=3400;
   s.terrain.advance(s.startX+4630*12+1000);s.coins=[];s.obstacles=[];
   s.nextSnapSpawnX=s.startX+3000*12;s.spawnCombatAhead(s.startX+4630*12);
   const found=s.obstacles.find(o=>o.type==='snappingBramble');if(!found)return null;
   s.obstacles=[found];s.enemies=[];s.player.x=found.x-180;s.player.y=s.terrain.groundAt(s.player.x)??s.terrain.anchorAt(s.player.x);s.player.grounded=true;
   s.cameraX=s.player.x-s.width*.32;s.cameraY=s.terrain.anchorAt(found.x)-s.groundY;s.cameras.main.setScroll(s.cameraX,s.cameraY);
   s.distance=(found.x-s.startX)/12;return {variant:found.variant,base:s.terrain.anchorAt(found.x),x:found.x};
  });
  assert(plant,'An actual generated mountain snapping plant exists');
  const frames=new Set(),roots=[];
  for(let i=0;i<16;i++){
   const sample=await page.evaluate(({i,variant})=>{
    const s=window.grimRun.scene.scenes[0],o=s.obstacles[0];
    s.elapsed=((i%8)*Math.PI/4-Math.PI/2-variant*1.7+Math.PI*8)/5.1;s.drawScene();window.grimRun.step(performance.now(),0);
    const image=s.obstacleSpriteObjects.get(o);return {key:image.texture.key,frame:image.frame.name,y:image.y,origin:image.originY,width:image.displayWidth,height:image.displayHeight,box:s.snappingBox(o)};
   },{i,variant:plant.variant});
   assert.equal(sample.key,'revision-plant');frames.add(Number(sample.frame));roots.push(sample.y);
   assert.equal(sample.origin,300/320);assert(Math.abs(sample.width-256*.32)<.0001);assert(Math.abs(sample.height-320*.32)<.0001);
   if(i===0||i===3)await page.locator('#game canvas').screenshot({path:path.join(dir,'revision-plant-'+i+'.png')});
   await page.waitForTimeout(i<8?154:308);
  }
  assert.equal(frames.size,8);assert(roots.every(y=>y===roots[0]),'Plant base remains fixed through its entire cycle');
  // Render all six support variants on real terrain/gaps, including rare skins.
  for(const [biome,from,to] of [['foothills',1700,2300],['tundra',2500,4600],['caves',5200,5900],['crystals',6200,6900],['ashlands',7200,7900],['lava',8200,9200]]){
   const setup=await page.evaluate(({biome,from,to})=>{
    const s=window.grimRun.scene.scenes[0];s.powerArt.reset();s.player.airTuck=false;s.player.holdSlide=false;s.player.attackMs=0;
    s.terrain.advance(s.startX+to*12+1000);
    const gap=s.terrain.segments.find(g=>g.kind==='gap'&&(g.start-s.startX)/12>=from&&(g.start-s.startX)/12<to);
    if(!gap)return null;const x=gap.start+Math.min(90,(gap.end-gap.start)*.42),base=gap.y0;
    const o={type:'airBramble',x,y:base-215,width:80,height:143,variant:0,dealtDamage:false,destroyed:false,baseY:base};
    s.obstacles=[o];s.enemies=[];s.distance=(x-s.startX)/12;s.hasTeleported=s.distance>=5000;
    s.player.x=x-180;s.player.y=s.terrain.groundAt(s.player.x)??s.terrain.anchorAt(s.player.x);s.player.grounded=true;
    s.cameraX=x-480;s.cameraY=base-s.groundY;s.cameras.main.setScroll(s.cameraX,s.cameraY);s.drawScene();
    const skin=s.obstacleSkinFor(o),image=s.obstacleSupportObjects.get(o);
    return {biome:s.obstacleBiomeFor(o),src:skin.supportSrc,supportKey:image.texture.key,depth:image.depth,geometry:[o.width,o.height]};
   },{biome,from,to});
   assert(setup,'Real gap fixture exists for '+biome);assert.equal(setup.biome,biome);assert(setup.src.includes('air-bramble-support-v2/'));
   assert.deepEqual(setup.geometry,[80,143]);assert.equal(setup.depth,.53);
   await page.waitForTimeout(180);await page.evaluate(()=>window.grimRun.scene.scenes[0].drawScene());await page.locator('#game canvas').screenshot({path:path.join(dir,'revision-support-'+biome+'.png')});
  }
  // Compare actual rendered fog against the same frame with only foreground
  // mist hidden. Pixels in the air above each abyss must change, while the
  // physical gap remains unsupported.
  for(const [biome,from,to] of [['forest',0,900],['foothills',1000,2300],['tundra',2600,4500],['caves',5200,5900],['crystals',6200,6900],['ashlands',7200,7900],['lava',8200,9200],['boss',11000,13000]]){
   const geo=await page.evaluate(({from,to})=>{
    const s=window.grimRun.scene.scenes[0];s.terrain.advance(s.startX+to*12+1000);
    const gap=s.terrain.segments.find(g=>g.kind==='gap'&&(g.start-s.startX)/12>=from&&(g.start-s.startX)/12<to);
    if(!gap)return null;const x=(gap.start+gap.end)/2,y=s.groundFogSurfaceAt(x);
    s.obstacles=[];s.enemies=[];s.distance=(x-s.startX)/12;s.hasTeleported=s.distance>=5000;
    s.player.x=gap.start-70;s.player.y=s.terrain.groundAt(s.player.x)??s.terrain.anchorAt(s.player.x);s.player.grounded=true;
    s.cameraX=x-480;s.cameraY=y-s.groundY;s.cameras.main.setScroll(s.cameraX,s.cameraY);s.drawScene();
    return {x:480,y:s.groundY,open:s.terrain.groundAt(x)===null,height:y,expected:(gap.y0+gap.y1)/2};
   },{from,to});
   assert(geo&&geo.open);assert(Math.abs(geo.height-geo.expected)<.0001);
   await page.waitForTimeout(150);
   await page.evaluate(()=>window.grimRun.scene.scenes[0].drawScene());
   const withFog=PNG.sync.read(await page.locator('#game canvas').screenshot({path:path.join(dir,'revision-fog-gap-'+biome+'.png')}));
   await page.evaluate(()=>{
    const s=window.grimRun.scene.scenes[0];s._fog=s.drawGroundFog;s.drawGroundFog=function(){for(const v of this.groundFogViews.values())v.setVisible(false)};s.drawScene();
   });
   const without=PNG.sync.read(await page.locator('#game canvas').screenshot());
   await page.evaluate(()=>{const s=window.grimRun.scene.scenes[0];s.drawGroundFog=s._fog;s.drawScene();});
   let changed=0;
   for(let y=Math.round(geo.y)-100;y<Math.round(geo.y)-20;y++)for(let x=geo.x-25;x<geo.x+25;x++){
    const index=(y*withFog.width+x)*4;const delta=Math.abs(withFog.data[index]-without.data[index])+Math.abs(withFog.data[index+1]-without.data[index+1])+Math.abs(withFog.data[index+2]-without.data[index+2]);
    if(delta>12)changed++;
   }
   assert(changed>100,biome+' foreground mist truly renders across the abyss: '+changed+' changed pixels');
   console.log('Continuous foreground fog',biome,changed,'abyss pixels');
  }
  assert.deepEqual(errors,[]);
  console.log('PASS actual Chromium: rooted eight-pose carnivorous plant, six curved terrain supports, and foreground fog across real gaps in all eight biomes.');
 }finally{
  const video=page.video();await context.close();if(video)fs.renameSync(await video.path(),path.join(dir,'visual-revision-preview.webm'));
  await browser.close();await new Promise(r=>server.close(r));
 }
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
