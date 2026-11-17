'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require('playwright');

const root = path.resolve(__dirname, '..');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css',
  '.png':'image/png','.webp':'image/webp','.ttf':'font/ttf'};
const sizes = [[1440,900],[950,430],[740,360],[667,320],[653,280],
  [720,540],[430,932],[360,800],[320,568]];
const server = http.createServer((req,res)=>{
  const file = path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return res.writeHead(404).end();
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});

function observe(){
  const home={paint:0,groups:{},bitmaps:[],frames:[]};
  window.homeProbe=home;
  const bitmaps=new Map([['2304x1536','cloth'],['554x600','body'],['1280x172','tread']]);
  const sources=[
    ['reaper_idle_v1','body'],['crawler_crawl_01','crawler'],['ember_imp_atlas','imp']
  ];
  const identify=image=>bitmaps.get(image.width+'x'+image.height)
    ||sources.find(([name])=>image.src?.includes(name))?.[1]||'bat';
  const create=window.createImageBitmap;
  window.createImageBitmap=async function(...args){
    const bitmap=await create.apply(this,args);
    if(bitmaps.has(bitmap.width+'x'+bitmap.height))home.bitmaps.push(bitmap);
    return bitmap;
  };
  const proto=CanvasRenderingContext2D.prototype;
  const origClear=proto.clearRect,origDraw=proto.drawImage;
  proto.clearRect=function(...args){
    if(this.canvas.id==='title-art'){
      home.groups={};
      home.paint++;
    }
    return origClear.apply(this,args);
  };
  proto.drawImage=function(image,...args){
    if(this.canvas.id==='title-art'){
      const kind=identify(image),m=this.getTransform();
      (home.groups[kind]??=[]).push({image,args,m:[m.a,m.b,m.c,m.d,m.e,m.f],alpha:this.globalAlpha});
      if(kind==='cloth'){
        const frame=((args[1]-2)/192)*12+(args[0]-2)/192;
        if(home.frames.length<1800)home.frames.push([performance.now(),frame]);
      }
    }
    return origDraw.call(this,image,...args);
  };
}

function inspectLayout(){
  const {groups}=window.homeProbe;
  const canvas=document.querySelector('#title-art');
  const dpr=canvas.width/canvas.clientWidth;
  const probe=document.createElement('canvas');
  probe.width=canvas.width;probe.height=canvas.height;
  const ctx=probe.getContext('2d',{willReadFrequently:true});
  const rect=element=>{
    const r=element.getBoundingClientRect();
    return [r.left,r.top,r.right,r.bottom];
  };
  const copy=rect(document.querySelector('.home-copy'));
  const button=rect(document.querySelector('#home-enter-btn'));
  const bounds={},contacts={};
  const art={
    reaper:[groups.body[0],groups.cloth[0]],bat:groups.bat,
    imp:groups.imp,crawler:groups.crawler
  };
  const guide=[[0,672],[170,674],[308,688],[493,699],[638,711],[798,722],
    [969,735],[1124,744],[1307,749],[1497,755],[1672,765]];
  const [groundX,groundY,groundWidth]=groups.tread[0].args;
  const scale=groundWidth/1672;
  const surface=x=>{
    const source=(x-groundX)/scale;
    const i=guide.findIndex(([end],i)=>i&&end>=source);
    const [x0,y0]=guide[i-1],[x1,y1]=guide[i];
    return groundY+scale*(y0+(y1-y0)*(source-x0)/(x1-x0)-626);
  };
  const toePoints={reaper:[[1067,1418],[1370,1407]],imp:[[50,240],[147,244]],crawler:[[646,841],[1084,840]]};
  for(const [id,calls] of Object.entries(art)){
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,probe.width,probe.height);
    for(const {image,args,m,alpha} of calls){
      ctx.setTransform(...m);ctx.globalAlpha=alpha;ctx.drawImage(image,...args);
    }
    const bytes=ctx.getImageData(0,0,probe.width,probe.height).data;
    let x0=probe.width,y0=probe.height,x1=0,y1=0;
    for(let y=0,p=3;y<probe.height;y++)for(let x=0;x<probe.width;x++,p+=4){
      if(bytes[p]<=40)continue;
      x0=Math.min(x0,x);x1=Math.max(x1,x+1);y0=Math.min(y0,y);y1=Math.max(y1,y+1);
    }
    bounds[id]=[x0,y0,x1,y1].map(v=>v/dpr);
    if(id==='bat')continue;
    const {args,m}=calls[0];
    contacts[id]=toePoints[id].map(([sx,sy])=>{
      const footScale=id==='reaper'?args[2]/1108:args[6]/args[2];
      const u=id==='reaper'?args[0]+(sx-346)*footScale:args[4]+(sx-args[0])*footScale;
      const v=id==='reaper'?args[1]+(sy-228)*footScale:(sy-(id==='imp'?245:842))*footScale;
      const x=(m[0]*u+m[2]*v+m[4])/dpr,y=(m[1]*u+m[3]*v+m[5])/dpr;
      let last=-Infinity;
      for(let dy=-4;dy<=4;dy++)for(let dx=-2;dx<=2;dx++){
        const ix=Math.round(x*dpr)+dx,iy=Math.round(y*dpr)+dy;
        if(bytes[(iy*probe.width+ix)*4+3]>80)last=Math.max(last,iy/dpr);
      }
      return {actor:id,distance:Math.abs(y-surface(x)),actualAlpha:Math.abs(last-surface(x))};
    });
  }
  return {copy,button,bounds,contacts,dpr,width:canvas.clientWidth,height:canvas.clientHeight};
}

function inspectCloth(){
  const {groups}=window.homeProbe;
  const base=groups.body[0],cloth=groups.cloth[0];
  const canvas=document.createElement('canvas');
  canvas.width=740;canvas.height=360;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const [localX,localY,w]=base.args,k=w/1108;
  const x=localX+base.m[4],y=localY+base.m[5];
  const regions=[[610,250,1300,645],[985,660,1290,808],
    [1000,794,1130,991],[1025,990,1145,1270],[979,1290,1447,1421]];
  const rect=([left,top,right,bottom])=>[
    Math.ceil(x+(left-346)*k),Math.ceil(y+(top-228)*k),
    Math.floor((right-left)*k),Math.floor((bottom-top)*k)
  ];
  const protectedBytes=rects=>rects.map(region=>Array.from(ctx.getImageData(...rect(region)).data));
  let first,last,protectedFirst,changed=0,maxNeighbor=0;
  const minX=[],upper=[];
  for(let i=0;i<96;i++){
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,740,360);
    ctx.translate(base.m[4],base.m[5]);
    ctx.drawImage(base.image,...base.args);
    ctx.drawImage(cloth.image,(i%12)*192+2,Math.floor(i/12)*192+2,188,188,...cloth.args.slice(4));
    ctx.setTransform(1,0,0,1,0,0);
    const rigid=protectedBytes(regions);
    protectedFirst??=rigid;
    for(let r=0;r<regions.length;r++)if(rigid[r].some((byte,p)=>byte!==protectedFirst[r][p]))changed++;
    const [rx,ry,rw,rh]=rect([352,938,569,1260]);
    const pixels=ctx.getImageData(rx,ry,rw,rh).data;
    let xmin=rw;
    for(let row=0;row<rh;row++)for(let col=0;col<rw;col++)if(pixels[(row*rw+col)*4+3]>96){
      xmin=Math.min(xmin,col);
    }
    let tipRows=0,tipCount=0;
    for(let row=0;row<rh;row++)for(let col=xmin;col<=Math.min(rw-1,xmin+2);col++){
      if(pixels[(row*rw+col)*4+3]>96){tipRows+=row;tipCount++;}
    }
    minX.push(xmin);upper.push(tipRows/tipCount);
    if(last)maxNeighbor=Math.max(maxNeighbor,pixels.reduce((sum,value,j)=>sum+Math.abs(value-last[j]),0));
    first??=pixels;
    last=pixels;
  }
  const spread=values=>Math.max(...values)-Math.min(...values);
  const seam=last.reduce((sum,value,j)=>sum+Math.abs(value-first[j]),0);
  return {protectedChanges:changed,neighbors:maxNeighbor,seam,xTravel:spread(minX),yTravel:spread(upper)};
}

const afterRaf=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function inspect(browser,url,renderer){
  const page=await browser.newPage({viewport:{width:740,height:360},hasTouch:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(observe);
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.homeProbe.groups.cloth&&window.homeProbe.groups.tread
    &&window.GRIM_FRONTEND?.ready&&window.grimRun?.scene.scenes[0]?.state==='home',null,{timeout:65000});
  assert.equal(await page.evaluate(()=>grimRun.renderer.type),renderer==='canvas'?1:2);
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>new Set(homeProbe.frames.map(([,pose])=>pose)).size>=12);
  const span=await page.evaluate(()=>homeProbe.frames.slice());
  const motion=await page.evaluate(inspectCloth);
  assert.equal(motion.protectedChanges,0,'Permanent head, shoulder, shaft, grip and boots stay identical');
  assert(motion.xTravel>=8&&motion.xTravel<=18&&motion.yTravel>=3&&motion.yTravel<=12,JSON.stringify(motion));
  assert(motion.seam<motion.neighbors*.20,'Loop seam differs less than a normal moving step');
  const layouts=[];
  for(const [width,height] of sizes){
    await page.setViewportSize({width,height});
    await page.waitForFunction(([w,h])=>{
      const c=document.querySelector('#title-art');
      return c.width===w&&c.height===h&&window.homeProbe.groups.cloth;
    },[width,height]);
    const layout=await page.evaluate(inspectLayout);
    const {copy,button,bounds}=layout;
    for(const [id,b] of Object.entries(bounds)){
      assert(b[0]>9&&b[1]>2&&b[2]<width-7&&b[3]<height-7,JSON.stringify({width,height,id,b}));
      assert(b[2]<copy[0]||b[0]>copy[2]||b[3]<copy[1]||b[1]>copy[3],JSON.stringify({width,height,id,b,copy}));
    }
    assert(bounds.imp[2]+6<bounds.crawler[0],'Ground enemies keep a distinct opening between them');
    assert(button[3]-button[1]>=44&&button[2]-button[0]>=44);
    assert(Math.abs((copy[0]+copy[2])/2-width/2)<2,'Copy is centered between the actor lanes');
    for(const contact of Object.values(layout.contacts).flat()){
      assert(contact.distance<=2.05,JSON.stringify({width,height,contact}));
      assert(contact.actualAlpha<=3.6,JSON.stringify({width,height,contact}));
    }
    layouts.push(layout);
  }
  await page.setViewportSize({width:740,height:360});
  await page.addStyleTag({content:'#home-screen{padding-left:55px;padding-right:29px;padding-top:14px;padding-bottom:21px}'});
  await page.evaluate(()=>dispatchEvent(new Event('resize')));
  await page.waitForFunction(()=>{
    const r=document.querySelector('.home-copy').getBoundingClientRect();
    return Math.abs((r.left+r.right)/2-383)<2&&document.querySelector('#title-art').width===740;
  });
  await afterRaf(page);
  const safeInsets=await page.evaluate(inspectLayout);
  assert(safeInsets.bounds.reaper[0]>=54&&safeInsets.bounds.crawler[2]<=712,JSON.stringify(safeInsets));
  assert(Math.abs((safeInsets.copy[0]+safeInsets.copy[2])/2-383)<2);

  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>document.querySelector('#canopy-art').width===1
    &&homeProbe.bitmaps.filter(b=>b.width>0).length===1);
  const before=await page.evaluate(()=>homeProbe.paint);
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>homeProbe.paint),before,'Reduced motion does not loop the title');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'home-enter-btn');
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>grimRun.scene.scenes[0].state==='menu');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'menu-title');
  assert.equal(await page.evaluate(()=>homeProbe.bitmaps.filter(b=>b.width>0).length),0);
  await page.locator('#start-btn').tap();
  await page.waitForFunction(()=>grimRun.scene.scenes[0].state==='playing');
  const atStart=await page.evaluate(()=>homeProbe.paint);
  await page.locator('#jump-btn').tap();
  await page.locator('#pause-btn').tap();
  await page.locator('#resume-btn').tap();
  await page.waitForFunction(()=>grimRun.scene.scenes[0].state==='playing');
  assert.equal(await page.evaluate(()=>homeProbe.paint),atStart,'No title paint after entering Run');
  assert.deepEqual(await page.evaluate(()=>['title-art','canopy-art'].map(id=>{
    const c=document.getElementById(id);return [c.width,c.height];
  })),[[1,1],[1,1]]);
  assert.deepEqual(errors,[]);
  await page.close();
  return {renderer,motion,liveFrames:span,layouts,safeInsets};
}

(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const renderer=process.env.GRIM_HOME_CANVAS==='1'?'canvas':'webgl';
  const args=['--no-sandbox',renderer==='canvas'?'--disable-webgl':'--use-angle=swiftshader',
    '--enable-unsafe-swiftshader'];
  const browser=await chromium.launch({headless:true,args,executablePath:process.env.GRIM_CHROMIUM});
  try{
    const results=await inspect(browser,'http://127.0.0.1:'+server.address().port+'/index.html?seed=33',renderer);
    if(process.env.GRIM_HOME_RESULTS)fs.writeFileSync(process.env.GRIM_HOME_RESULTS,JSON.stringify(results,null,2)+'\n');
    console.log('PASS Home',renderer,'nine viewports, safe areas, six contacts, all 96 cloak cels, reduced motion and Run disposal.',results.motion);
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
