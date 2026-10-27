/* v0.19.2 — one painted body, continuously articulated wings, one calm flap. */
(function(scope){
  'use strict';
  const CYCLE_SECONDS=1.6,FRAMES=96,CELL=256,COLUMNS=8;
  const SOURCE_ANCHOR=[330,292],ANCHOR=[178,128],SOURCE_SCALE=.72;
  const BOUNDS=[10,40,234,202]; // Padded union of every baked pose, independent of phase.
  const SPEC={frames:FRAMES,cell:[CELL,CELL],anchor:ANCHOR};
  const FILE='assets/bat/v0192/bat-flight.png?v=0.19.2';
  const clamp=v=>Math.max(0,Math.min(1,v));
  function motion(seconds,phase=0){
    const turns=seconds/CYCLE_SECONDS+phase/(Math.PI*2);
    const frame=((turns%1)+1)%1*FRAMES,a=Math.floor(frame)%FRAMES;
    return {a,b:(a+1)%FRAMES,mix:frame-a};
  }
  function pose(turn){
    const t=turn*Math.PI*2;
    // Wing wrists trail the shoulders, then fold a little on the return stroke.
    // The face and torso are the same pixels throughout, around one eye anchor.
    return {near:-.42+.48*Math.cos(t),far:.34-.40*Math.cos(t-.12),
      wrist:.10*Math.sin(t-.25),fold:.10*Math.max(0,-Math.sin(t))**2,
      pitch:.012*Math.sin(t-.35),bob:1.2*Math.sin(t-.5)};
  }
  function prepareParts(source,makeCanvas){
    const polygons={
      near:[[95,160],[274,160],[280,250],[304,278],[304,299],[275,309],[240,311],[193,292],[151,269],[95,241]],
      far:[[322,280],[346,218],[415,218],[415,319],[343,318],[334,296]],
      body:[[288,237],[308,250],[310,242],[327,266],[339,272],[352,280],[356,306],[296,359],[219,359],[219,312],[246,302],[264,293],[284,277]]
    };
    return Object.fromEntries(Object.entries(polygons).map(([id,points])=>{
      const canvas=makeCanvas(512,512),g=canvas.getContext('2d');
      g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.clip();
      g.drawImage(source,0,0,512,512,0,0,512,512);return [id,canvas];
    }));
  }
  function wingPoint(x,y,side,p){
    const near=side==='near',root=near?[285,282]:[340,284];
    const span=clamp((near?root[0]-x:x-root[0])/(near?180:65));
    const angle=(near?p.near:p.far)+(near?-1:1)*p.wrist*span*span;
    const dx=(x-root[0])*(1-p.fold*span),dy=y-root[1],c=Math.cos(angle),s=Math.sin(angle);
    return [root[0]+dx*c-dy*s,root[1]+dx*s+dy*c];
  }
  function triangle(g,image,src,dst){
    const [a,b,c]=src,[d,e,f]=dst;
    const det=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
    const xx=((e[0]-d[0])*(c[1]-a[1])-(f[0]-d[0])*(b[1]-a[1]))/det;
    const xy=((f[0]-d[0])*(b[0]-a[0])-(e[0]-d[0])*(c[0]-a[0]))/det;
    const yx=((e[1]-d[1])*(c[1]-a[1])-(f[1]-d[1])*(b[1]-a[1]))/det;
    const yy=((f[1]-d[1])*(b[0]-a[0])-(e[1]-d[1])*(c[0]-a[0]))/det;
    // Slight overlap closes rasterization seams; this is baked once, never per game frame.
    const center=[(d[0]+e[0]+f[0])/3,(d[1]+e[1]+f[1])/3];
    g.save();g.beginPath();dst.forEach(([x,y],i)=>{
      const dx=x-center[0],dy=y-center[1],n=Math.hypot(dx,dy)||1;
      const px=x+dx/n*.35,py=y+dy/n*.35;i?g.lineTo(px,py):g.moveTo(px,py);
    });g.closePath();g.clip();g.transform(xx,yx,xy,yy,d[0]-xx*a[0]-xy*a[1],d[1]-yx*a[0]-yy*a[1]);
    g.drawImage(image,0,0);g.restore();
  }
  function drawWing(g,image,side,p){
    const box=side==='near'?[95,160,310,315]:[320,215,420,325],nx=12,ny=8;
    for(let iy=0;iy<ny;iy++)for(let ix=0;ix<nx;ix++){
      const x=box[0]+ix*(box[2]-box[0])/nx,y=box[1]+iy*(box[3]-box[1])/ny;
      const dx=(box[2]-box[0])/nx,dy=(box[3]-box[1])/ny;
      const points=[[x,y],[x+dx,y],[x+dx,y+dy],[x,y+dy]],dest=points.map(([a,b])=>wingPoint(a,b,side,p));
      for(const ids of [[0,1,2],[0,2,3]])triangle(g,image,ids.map(i=>points[i]),ids.map(i=>dest[i]));
    }
  }
  function drawPose(g,parts,turn){
    const p=pose(turn);g.save();g.translate(ANCHOR[0],ANCHOR[1]+p.bob*SOURCE_SCALE);
    g.scale(SOURCE_SCALE,SOURCE_SCALE);g.rotate(p.pitch);g.translate(-SOURCE_ANCHOR[0],-SOURCE_ANCHOR[1]);
    drawWing(g,parts.far,'far',p);drawWing(g,parts.near,'near',p);g.drawImage(parts.body,0,0);g.restore();
  }
  function drawFrame(g,image,seconds,x,y,scale,phase=0){
    const f=motion(seconds,phase).a;
    g.drawImage(image,f%COLUMNS*CELL,Math.floor(f/COLUMNS)*CELL,CELL,CELL,
      x-ANCHOR[0]*scale,y-ANCHOR[1]*scale,CELL*scale,CELL*scale);
  }
  function homePlacement(w,h,clock){
    const portrait=h>w,height=Math.min(h*(portrait?.14:.24),w*(portrait?.22:.26));
    const scale=.32/SOURCE_SCALE*height/52,margin=Math.max(12,w*.012);
    return {height,scale,x:Math.min(w*.84,w-margin-(ANCHOR[0]-BOUNDS[0])*scale),
      y:h*(portrait?.67:.36)+Math.sin(clock*1.3)*h*.025-height*.22};
  }
  scope.GRIM_BAT_FLIGHT={CYCLE_SECONDS,FRAMES,CELL,COLUMNS,ANCHOR,BOUNDS,SOURCE_SCALE,SPEC,FILE,motion,pose,homePlacement,
    prepareParts,wingPoint,drawPose,drawFrame};
})(typeof window!=='undefined'?window:globalThis);
