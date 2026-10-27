'use strict';
// Bake the Canvas wing rig, keeping the original painted source bytes intact.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'assets/bat/v0192');
const source='assets/encounters/v0190/bat-flight.png';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();await page.addScriptTag({path:path.join(root,'assets/visuals/bat-flight.js')});
  const encoded=fs.readFileSync(path.join(root,source)).toString('base64');
  const result=await page.evaluate(async encoded=>{
   const A=window.GRIM_BAT_FLIGHT,im=new Image();im.src='data:image/png;base64,'+encoded;await im.decode();
   const canvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
   const parts=A.prepareParts(im,canvas),sheet=canvas(A.CELL*A.COLUMNS,A.CELL*Math.ceil(A.FRAMES/A.COLUMNS));
   const g=sheet.getContext('2d'),bounds=[];
   for(let i=0;i<A.FRAMES;i++){
    const tile=canvas(A.CELL,A.CELL),ctx=tile.getContext('2d');A.drawPose(ctx,parts,i/A.FRAMES);
    const d=ctx.getImageData(0,0,A.CELL,A.CELL).data;let l=A.CELL,t=A.CELL,r=0,b=0,n=0;
    for(let y=0;y<A.CELL;y++)for(let x=0;x<A.CELL;x++)if(d[(y*A.CELL+x)*4+3]>32){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);n++;}
    if(l<3||t<3||r>A.CELL-4||b>A.CELL-4||n<3000)throw Error('Clipped/empty pose '+i+' '+[l,t,r,b,n]);
    bounds.push([l,t,r,b,n]);g.drawImage(tile,i%A.COLUMNS*A.CELL,Math.floor(i/A.COLUMNS)*A.CELL);
   }
   return {png:sheet.toDataURL('image/png').split(',')[1],frames:A.FRAMES,cell:[A.CELL,A.CELL],anchor:A.ANCHOR,cycleSeconds:A.CYCLE_SECONDS,bounds};
  },encoded);
  fs.mkdirSync(out,{recursive:true});const data=Buffer.from(result.png,'base64');fs.writeFileSync(path.join(out,'bat-flight.png'),data);delete result.png;
  const digest=b=>({bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({version:'0.19.2',source:{path:source,frame:0,...digest(fs.readFileSync(path.join(root,source)))},runtime:{'bat-flight.png':{...digest(data),...result}}},null,2)+'\n');
  console.log('Baked '+result.frames+' registered wing poses; '+data.length+' bytes; no clipped cells.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
