'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,server}=require('./browser-landing');
const root=path.join('test-results','hitch-controls');
fs.mkdirSync(root,{recursive:true});
async function sample(browser,kind,pass) {
  const page=await browser.newPage({viewport:{width:740,height:360},hasTouch:true,deviceScaleFactor:1});
  try{
    await page.goto('http://127.0.0.1:'+server.address().port+'/before/?seed=33');
    await page.locator('#home-enter-btn').click();
    await page.waitForFunction(()=>window.grimRun?.scene.scenes[0].landingArt?.ready&&window.grimRun.scene.scenes[0].motionArt?.rising&&GRIM_FRONTEND.ready,null,{timeout:90000});
    await page.evaluate(()=>grimRun.scene.scenes[0].visuals.reviewLoad);
    const prep=await page.evaluate(async kind=>{
      const g=grimRun,s=g.scene.scenes[0],art=GRIM_LANDING_POSES;
      const source=s.textures.get(art.body.key).source[0];
      const body=source.image,low=s.textures.get(art.low.key).source[0].image;
      const began=performance.now();
      if(kind==='decode-body')await body.decode();
      if(kind==='decode-low')await low.decode();
      if(kind==='bitmap-body'){
        // QA substitution for this browser page. Frame objects still use the
        // original TextureSource and its unchanged atlas frame rectangles.
        const bitmap=await createImageBitmap(body);
        assertSize(bitmap,body);
        source.image=bitmap;
      }
      function assertSize(a,b){if(a.width!==b.naturalWidth||a.height!==b.naturalHeight)throw Error('bitmap dimensions');}
      const prepMs=performance.now()-began,ctx=CanvasRenderingContext2D.prototype,draw=ctx.drawImage;
      let firstDraw=null,firstPose=null,draws=0;
      ctx.drawImage=function(image,...args){
        if(s.state==='playing'&&image===source.image){
          draws++;firstDraw??={m:s.distance,t:performance.now(),src:args.slice(0,4)};
          if(kind==='suppress-body')return;
        }
        return draw.call(this,image,...args);
      };
      let prior,end,next=0;
      const rows=[],actions=[],schedule=kind==='cut-only'?[[42,'attack']]:kind==='jump-only'?[[33,'jump'],[37,'jumpEnd']]:[[33,'jump'],[37,'jumpEnd'],[42,'attack']];
      window.measured=new Promise(done=>{
        const before=t=>{
          if(s.state!=='playing')return;
          const now=performance.now(),m=s.distance,p=s.player;
          if(prior)rows.push({...prior,gap:t-prior.t,cpu:end-prior.now});
          if(next<schedule.length&&m>=schedule[next][0]){actions.push([schedule[next][1],m]);s[schedule[next++][1]]();}
          const a=s.motionArt.body[0];if(a.visible&&a.texture.key===art.body.key)firstPose??={m,frame:a.frame.name};
          prior={t,now,m,x:p.x,y:p.y,ground:p.grounded,hp:p.hp,attack:p.attackMs,low:s.lowProfile,frame:a.visible?[a.texture.key,a.frame.name]:null};
          if(m<76)return;
          g.events.off('prestep',before);g.events.off('postrender',after);
          done({kind,pass:window.hitchPass,rows,actions,firstDraw,firstPose,draws,hp:p.hp});
        };
        const after=()=>{end=performance.now();};
        g.events.on('prestep',before);g.events.on('postrender',after);
      });
      return {prepMs,size:[body.naturalWidth,body.naturalHeight],sourceType:source.image.constructor.name};
    },kind);
    await page.evaluate(n=>{window.hitchPass=n;},pass);
    await page.locator('#start-btn').click();
    const result=await page.evaluate(()=>window.measured);
    assert(result.rows.length>100);
    fs.writeFileSync(path.join(root,kind+'-'+pass+'.json'),JSON.stringify({prep,...result}));
  }finally{await page.close();}
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const b=await chromium.launch({args:['--disable-webgl']});
  try{
    const modes=['control','suppress-body','decode-low','decode-body','bitmap-body','jump-only','cut-only'];
    for(const [pass,order] of [[1,modes],[2,[...modes].reverse()]])for(const mode of order)await sample(b,mode,pass);
  }finally{await b.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
