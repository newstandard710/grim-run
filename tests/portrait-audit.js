'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,server}=require('./browser-landing');
const out=path.resolve('test-results/portrait');
fs.mkdirSync(out,{recursive:true});

// Count opaque pixels of the actual running body behind Jump at the audited gate.
function inspect() {
  const g=grimRun,s=g.scene.scenes[0],camera=s.cameras.main;
  s.startRun();g.loop.sleep();clearInterval(s.loopWatchdogId);s.sys.sceneUpdate=()=>{};
  let obstacle;
  for(let i=0;i<300;i++){
    s.update(0,1000/60);
    obstacle=s.obstacles.find(o=>o.type==='branch'&&o.x-s.player.x>0&&o.x-s.player.x<=75);
    if(obstacle) break;
  }
  if(!obstacle)throw Error('Missing opening gate');
  g.step(performance.now(),0);
  const sprite=s.motionArt.body.find(v=>v.visible);
  const frame=sprite.frame, c=document.createElement('canvas');
  c.width=frame.cutWidth;c.height=frame.cutHeight;
  const ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(frame.source.image,frame.cutX,frame.cutY,c.width,c.height,0,0,c.width,c.height);
  const pixels=ctx.getImageData(0,0,c.width,c.height).data;
  const matrix=sprite.getWorldTransformMatrix(),canvas=g.canvas.getBoundingClientRect();
  const rect=selector=>document.querySelector(selector).getBoundingClientRect();
  const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
  const jump=rect('#jump-btn');let covered=0,painted=0,bottom=-Infinity;
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
    if(pixels[(y*c.width+x)*4+3]<16)continue;
    const localX=(sprite.flipX?c.width-x-.5:x+.5)-sprite.displayOriginX;
    const world=matrix.transformPoint(localX,y+.5-sprite.displayOriginY);
    const screen=camera.matrix.transformPoint(world.x-camera.scrollX*sprite.scrollFactorX,world.y-camera.scrollY*sprite.scrollFactorY);
    const px=canvas.x+screen.x*canvas.width/g.scale.gameSize.width,py=canvas.y+screen.y*canvas.height/g.scale.gameSize.height;
    painted++;bottom=Math.max(bottom,py);
    if(px>=jump.left&&px<jump.right&&py>=jump.top&&py<jump.bottom)covered++;
  }
  function hud(){
    const selectors=['#hearts','.top-right','.score-inline','#distance','#pause-btn'];
    return selectors.flatMap((a,i)=>selectors.slice(i+1).map(b=>({a,b,area:overlap(rect(a),rect(b))}))).filter(pair=>pair.area>0);
  }
  const normal=hud(),normalText=document.querySelector('.top-center').innerText;
  const originals=['#hearts','#score','#distance','#coins','#souls'].map(sel=>[sel,document.querySelector(sel).textContent]);
  s.ui.update(4,5,9999,1234,12345,999999,[]);
  const expanded=hud();
  for(const [sel,value] of originals)document.querySelector(sel).textContent=value;
  return {meters:s.distance,skin:s.obstacleSkinFor(obstacle).id,frame:frame.name,painted,covered,bottom,jump:jump.toJSON(),normal,expanded,normalText};
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const b=await chromium.launch({args:['--disable-webgl']});
  try{
    for(const [w,h] of [[390,844],[320,568],[430,932],[360,740]]){
      for(const version of w===390?['before','after']:['after']){
        const page=await b.newPage({viewport:{width:w,height:h},hasTouch:true,deviceScaleFactor:1}),errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        try{
          await page.goto('http://127.0.0.1:'+server.address().port+'/'+version+'/?seed=33');
          await page.locator('#home-enter-btn').click();await page.locator('#start-btn').click();
          await page.waitForFunction(()=>grimRun.scene.scenes[0].landingArt?.ready&&grimRun.scene.scenes[0].motionArt?.rising);
          await page.evaluate(()=>grimRun.scene.scenes[0].visuals.reviewLoad);await page.evaluate(()=>document.fonts.ready);
          const metrics=await page.evaluate(inspect), label=version+'-'+w+'x'+h;
          fs.writeFileSync(path.join(out,label+'.json'),JSON.stringify({metrics,errors},null,2));
          await page.screenshot({path:path.join(out,label+'.png')});console.log(label,JSON.stringify(metrics));
          assert(metrics.painted>500 && metrics.meters>60 && metrics.meters<70);
          if(version==='before'){assert(metrics.covered>0&&metrics.normal.length>0);}
          else{
            assert.equal(metrics.covered,0,label+' body under Jump');
            assert.deepEqual(metrics.normal,[]);assert.deepEqual(metrics.expanded,[]);
            assert(metrics.jump.width>=44&&metrics.jump.height>=44);
          }
          assert.deepEqual(errors,[]);
        }finally{await page.close();}
      }
    }
  }finally{await b.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
