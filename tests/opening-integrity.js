'use strict';
const {chromium,server}=require('./browser-landing');
const fs=require('node:fs'),assert=require('node:assert/strict'),{crc32}=require('node:zlib');
const renderer=process.env.RENDERER||'canvas',report=[];
const runBytes=1947734;
function observe({mode,bytes}){
 const raw=window.createImageBitmap,RealWorker=window.Worker;
 window.audit={jobs:[],closed:0,workers:0,draws:[],ready:{},bad:0};
 if(mode==='unavailable')window.Worker=undefined;
 else window.Worker=class extends RealWorker{
  constructor(url,...rest){super(url,...rest);audit.workers++;
   if(mode==='worker-error')queueMicrotask(()=>this.dispatchEvent(new ErrorEvent('error',{cancelable:true})));
  }
  postMessage(msg,...args){audit.jobs.push(msg.path);super.postMessage(msg,...args);}
  terminate(){audit.closed++;super.terminate();}
 };
 window.createImageBitmap=async function(source,...args){
  if(mode==='bitmap-error'&&source.size===bytes){audit.bad++;throw Error('forced run-sheet decode rejection');}
  return raw.call(this,source,...args);
 };
 const draw=CanvasRenderingContext2D.prototype.drawImage;
 CanvasRenderingContext2D.prototype.drawImage=function(source,...args){
  if(source.width!==3072||source.height!==2304||audit.draws.length)return draw.call(this,source,...args);
  const t=performance.now(),result=draw.call(this,source,...args);
  audit.draws.push({source:source.constructor.name,cpu:performance.now()-t,at:t,m:window.grimRun?.scene?.scenes[0]?.distance});
  return result;
 };
 document.addEventListener('pointerdown',event=>{if(event.target.closest('#home-enter-btn'))requestAnimationFrame(function poll(){
  const s=window.grimRun?.scene.scenes[0],v=s?.visuals;
  if(v)for(const k of ['reaperReady','batReady','skeletalBatReady','boneCrawlerReady','emberImpReady','loaded'])
   if(v[k]&&!(k in audit.ready))audit.ready[k]=[performance.now(),s.distance];
  if(!v?.loaded)requestAnimationFrame(poll);
 });if(event.target.closest('#start-btn'))audit.tap=performance.now();},true);
}
async function inspect(){
 const g=grimRun,s=g.scene.scenes[0],v=s.visuals;
 await v.reviewLoad;
 const tex=s.textures.get('motion-reaper-run-solid'),src=tex.getSourceImage();
 const canvas=document.createElement('canvas');canvas.width=src.width;canvas.height=src.height;
 const ctx=canvas.getContext('2d');ctx.drawImage(src,0,0);
 const rgba=await crypto.subtle.digest('SHA-256',ctx.getImageData(0,0,canvas.width,canvas.height).data);
 const keys=Object.values(GRIM_VISUALS.V2_REAPER).concat(Object.values(GRIM_VISUALS.V2_BAT)).map(m=>m.key);
 return {src:src.constructor.name,size:[src.width,src.height],sha:Array.from(new Uint8Array(rgba),v=>v.toString(16).padStart(2,'0')).join(''),
  frames:tex.getFrameNames().map(k=>{const f=tex.get(k);return [Number(k),f.cutX,f.cutY,f.cutWidth,f.cutHeight];}),
  missing:keys.filter(k=>!s.textures.exists(k)),failed:v.failedAssets,ready:[v.batReady,v.skeletalBatReady,v.boneCrawlerReady,v.emberImpReady],
  renderer:g.renderer.type,audit:window.audit,available:s.motionArt.runReady};
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));fs.mkdirSync('test-results/opening',{recursive:true});
 const b=await chromium.launch({args:renderer==='canvas'?['--disable-webgl']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const modes=renderer==='canvas'?['normal','unavailable','bitmap-error','worker-error','hash-error']:['normal'];
  for(const [rev,mode] of [['before','normal'],...modes.map(m=>['after',m])]){
   const p=await b.newPage({viewport:{width:740,height:360},hasTouch:true}),errors=[];
   p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(observe,{mode,bytes:runBytes});
   if(mode==='hash-error')await p.context().route('**/crawler_crawl_01_v1.png?sha256=*',async r=>{
    const res=await r.fetch(),data=Buffer.from(await res.body());let pos=8;
    while(data.toString('ascii',pos+4,pos+8)!=='IDAT')pos+=data.readUInt32BE(pos)+12;
    const n=data.readUInt32BE(pos);data[pos+9]^=1;data.writeUInt32BE(crc32(data.subarray(pos+4,pos+8+n)),pos+8+n);
    await r.fulfill({response:res,body:data});
   });
   await p.goto('http://127.0.0.1:'+server.address().port+'/'+rev+'/?seed=33',{waitUntil:'domcontentloaded'});
   await p.locator('#home-enter-btn').click();await p.locator('#start-btn').click();
   await p.waitForFunction(()=>window.grimRun?.scene.scenes[0]?.visuals?.loaded&&grimRun.scene.scenes[0].distance>8);
   const d=await p.evaluate(inspect);report.push({rev,mode,d,errors});
   fs.writeFileSync('test-results/opening/'+renderer+'.json',JSON.stringify(report,null,2));
   assert.equal(d.renderer,renderer==='canvas'?1:2);assert(d.available);assert.deepEqual(d.size,[3072,2304]);
   assert.deepEqual(d.frames,Array.from({length:192},(_,i)=>[i,i%16*192,Math.floor(i/16)*192,192,192]));
   assert.equal(d.sha,report[0].d.sha);assert.deepEqual(errors,[]);assert.deepEqual(d.missing,[]);
   const bitmap=rev==='after'&&renderer==='canvas'&&mode!=='bitmap-error';
   assert.equal(d.src,bitmap?'ImageBitmap':'HTMLImageElement');
   if(renderer==='canvas'){assert.equal(d.audit.draws[0].source,d.src);assert(d.audit.draws[0].at>=d.audit.tap);}
   const worker=rev==='after'&&renderer==='canvas'&&mode!=='unavailable';
   assert.equal(d.audit.workers,worker?1:0);assert.equal(d.audit.closed,worker?1:0);
   if(mode==='hash-error'){assert(d.failed.some(f=>f.includes('SHA-256 mismatch')));assert(!d.ready[2]);}
   else{assert.deepEqual(d.failed,[]);assert(d.ready.every(Boolean));}
   if(mode==='bitmap-error')assert.equal(d.audit.bad,1);
   if(worker&&mode!=='worker-error')assert(d.audit.jobs.length>=20);
   if(bitmap){assert.equal(await p.evaluate(()=>{const s=grimRun.scene.scenes[0],k='motion-reaper-run-solid',src=s.textures.get(k).getSourceImage();s.textures.remove(k);return src.width;}),0);}
   console.log(rev,mode,d.src,d.sha,d.audit.draws,d.audit.ready,d.audit.jobs.length,errors);
   await p.close();
  }
 }finally{await b.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
