(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a,Math.min(b,v));
  const mix = (a,b,t) => a+(b-a)*t;
  function pose(keys, time){
    const next=keys.findIndex(key=>key[0]>=time);
    if(next<=0)return keys[next===0?0:keys.length-1].slice(1);
    const left=keys[next-1],right=keys[next],span=right[0]-left[0];
    const before=keys[next-2],after=keys[next+1];
    const t=(time-left[0])/span,t2=t*t,t3=t2*t;
    return left.slice(1).map((a,i)=>{
      const j=i+1,b=right[j];
      const u=before?(b-before[j])*span/(right[0]-before[0]):0;
      const v=after?(after[j]-a)*span/(after[0]-left[0]):0;
      return a+(b-a)*(3*t2-2*t3)+u*(t3-2*t2+t)+v*(t3-t2);
    });
  }
  function project(bank,yaw,pitch){
    const c=Math.cos(bank),s=Math.sin(bank),yc=Math.cos(yaw),ys=Math.sin(yaw),pc=Math.cos(pitch),ps=Math.sin(pitch);
    return [c*yc-s*ps*ys,-s*pc,s*yc+c*ps*ys,c*pc];
  }
  function transform(points,{hand:[x,y],matrix:[a,b,c,d]}){
    return points.map(([u,v])=>[x+a*u+b*v,y+c*u+d*v]);
  }
  function intersects(a,b,rect){
    let first=0,last=1;
    for(let i=0;i<2;i++){
      const v=b[i]-a[i];
      if(Math.abs(v)<1e-8){if(a[i]<rect[i]||a[i]>rect[i+2])return false;continue;}
      const p=(rect[i]-a[i])/v,q=(rect[i+2]-a[i])/v;
      first=Math.max(first,Math.min(p,q));last=Math.min(last,Math.max(p,q));
      if(first>last)return false;
    }
    return true;
  }
  function contact(spec, edges, box){
    const [bx,by,bX,bY]=spec.bounds, {x,y,width,height}=box, X=x+width,Y=y+height,pad=spec.pad;
    if(!(x<bX&&X>bx&&y<bY&&Y>by))return null;
    const rect=[Math.max(bx,x-pad),Math.max(by,y-pad),Math.min(bX,X+pad),Math.min(bY,Y+pad)];
    for(const {ms,edge,origin} of edges){
      const target=origin?[rect[0]+origin[0],rect[1]+origin[1],rect[2]+origin[0],rect[3]+origin[1]]:rect;
      for(let i=1;i<edge.length;i++)if(intersects(edge[i-1],edge[i],target))return ms;
    }
    return null;
  }
  function samples(spec, previous, current, toEdge){
    const [a,b]=spec.active;
    if(current<a||previous>b)return [];
    const lo=clamp(previous,a,b),hi=clamp(current,a,b),n=Math.max(1,Math.ceil(hi-lo));
    return Array.from({length:n+1},(_,i)=>{
      const ms=mix(lo,hi,i/n);return {ms,edge:toEdge(ms)};
    });
  }
  root.RisingGeometry={clamp,mix,pose,project,transform,intersects,contact,samples};
})(globalThis);
/* Rear-carry Cut paint and registered edge. Optional as a complete pose family. */
(function(scope){
  'use strict';
  const DATA=scope.GRIM_RISING_CUT_DATA;
  // Age, grip, shoulder, and unwrapped bank/yaw/pitch in degrees. The blade
  // drops behind, sweeps low, climbs ahead of the body, then settles over
  // the shoulder. One rotation returns to the original bank.
  const SWING=[
    [0,  -18,-55, -1,-55,  -90,  0, 0],
    [12, -18,-56, -1,-55,  -93, -2, 6],
    [26, -20,-67, -2,-56, -110,-12,30],
    [47, -19,-69, -3,-56, -142,-16,45],
    [66, -15,-66, -5,-54, -172, -1,49],
    [82,  -9,-65, -4,-54, -197,  9,58],
    [97,  -2,-65, -2,-54, -221,  9,58],
    [112,  7,-65,  0,-55, -242,  3,54],
    [130, 17,-65,  4,-57, -264, -1,37],
    [151, 24,-63,  7,-59, -287, -1,17],
    [175, 26,-63,  8,-61, -308,  1, 8],
    [200, 23,-68,  7,-65, -329,  2, 8],
    [225, 15,-73,  4,-65, -350,  5,14],
    [249,  5,-72,  0,-62, -375,  8,20],
    [278, -7,-67, -2,-59, -401,  9,23],
    [308,-15,-62, -2,-57, -422,  7,18],
    [333,-18,-59, -2,-56, -441,  3,10],
    [355,-18,-55, -1,-55, -450,  0, 0],
  ];
  const END=SWING.at(-1)[0],DEG=Math.PI/180;
  function preload(scene,motion){
    if(!DATA||!scope.Image||!scene.textures?.addCanvas)return;
    const pending=[],sources={},arts=Object.entries(DATA.arts);
    let stopped=false;
    const stop=()=>{
      stopped=true;
      for(const image of pending){image.onload=null;image.onerror=null;}
    };
    scene.events.once('shutdown',()=>{
      stop();
      if(!motion.rising)sources.body?.close?.();
    });
    function register(name,art,image,width,height){
      if(stopped||width!==art.size[0]||height!==art.size[1]){
        image.close?.();
        return;
      }
      sources[name]=image;
      if(Object.keys(sources).length===arts.length){
        stop();
        motion.rising=create(scene,motion,sources);
      }
    }
    for(const [name,art] of arts){
      // Keep the decoded body atlas available for the first synchronous torso
      // readback. Blob decoding does not need to run on the game thread.
      if(name==='body'&&scope.location?.protocol!=='file:'&&
         typeof scope.fetch==='function'&&typeof scope.createImageBitmap==='function'){
        scope.fetch(art.url).then(response=>response.ok?response.blob():null)
          .then(encoded=>encoded&&!stopped?scope.createImageBitmap(encoded):null)
          .then(bitmap=>{if(bitmap)register(name,art,bitmap,bitmap.width,bitmap.height);},()=>{});
        continue;
      }
      const image=new scope.Image();
      pending.push(image);
      image.onload=()=>register(name,art,image,image.naturalWidth,image.naturalHeight);
      image.src=art.url;
    }
  }
  function create(s,m,{body,arm:limbs,compact:compactAtlas}){
  const {paint,spec,compactPaint}=DATA;
  const C=scope.GRIM_CONFIG,G=scope.RisingGeometry;
  const forward=scope.GRIM_FORWARD_SCYTHE,Core=scope.GRIM_CORE,keys=[0,4,12,16,18,20,23];
  const compactSpec={bounds:[12,-140,138,-4],pad:0};
  // The torso warp already lives in CPU pixels. Compose it on a CPU canvas
  // and let Phaser upload the complete cut texture once in WebGL.
  const box=document.createElement('canvas');box.width=576;box.height=448;
  const ctx=box.getContext('2d',{willReadFrequently:true});
  const light=s.textures.addCanvas('motion-rising-reaper',box);
  const sprite=s.add.image(0,0,'motion-rising-reaper').setOrigin(0).setScale(.5).setDepth(12.09).setVisible(false);
  const ink=s.add.graphics().setDepth(12.18);
  const X=144,Y=176;
  const source=document.createElement('canvas');
  [source.width,source.height]=paint.size;
  const sourceContext=source.getContext('2d',{willReadFrequently:true}),torsoPixels=new Map();
  const warp=document.createElement('canvas');[warp.width,warp.height]=paint.size;
  const warpContext=warp.getContext('2d',{willReadFrequently:true}),painted=warpContext.createImageData(warp.width,warp.height);
  let recentCompact=null,glints=[];
  const lerp=(a,b,w)=>a.map((v,j)=>G.mix(v,b[j],w));
  const smooth=x=>{x=G.clamp(x,0,1);return x*x*(3-2*x);};
  const auth=()=>s.player.risingCut;
  const riseAge=()=>C.attackCooldownMs-(s.player.attackCooldownMs||0);
  const compact=p=>s.lowProfile||p.sliding||p.airTuck||(!p.grounded&&((p.visualTuckReleaseMs||0)>0||(p.visualTuckMs||0)>0));
  const hurt=p=>(p.visualHurtMs||0)>0;
  function switchOwner(p,owner,mode,kind=null){
    // Native snapshots shallow-copy Player. Value replacement keeps past
    // swing owners and join clocks independent of the current action.
    return p.risingCut=Object.freeze({...owner,mode,kind,age:riseAge(),at:s.elapsed});
  }
  function resolve(){
    const p=s.player,owner=auth();
    if(!owner||owner.sequence!==s.swingSequence)return null;
    if(s.state==='rewinding')return owner;
    if(owner.mode==='rise'){
      if(compact(p)||!m.forwardActive)return switchOwner(p,owner,'legacy');
      if(p.attackMs<=0&&(hurt(p)||p.visualFireMs>0))return switchOwner(p,owner,'yield');
    }
    return owner;
  }
  function compactFrame(owner=auth()){
    if(owner?.mode!=='edge'||owner.sequence!==s.swingSequence||s.player.grounded||!s.lowProfile||
       !s.player.attackMs||!s.powerArt?.action||!s.powerArt.enabled||!s.powerArt.ready['power-reaper'])return null;
    const frame=GRIM_POWER_ART.actionFrame(s);
    return compactPaint?.[frame]?.edge?frame:null;
  }
  function carryFrame(){
    const p=s.player;
    const frame=GRIM_MOTION_ART.runAtlasFrame(p.x-(s.startX||0));
    let rise=0;
    if(p.grounded&&(p.visualLandingMs||0)<=0){
      const ground=s.terrain.groundAt(p.x),toe=s.terrain.groundAt(p.x+GRIM_RUN_DATA.groundX[frame]);
      if(p.onSoulPlatform===false&&Number.isFinite(ground)&&Number.isFinite(toe)&&
        Math.abs(s.feetY-ground)<=2)rise=G.clamp(toe-ground,-12,12);
      return {frame:frame%96,rise};
    }
    const age=175-(p.visualLandingMs||0),t=GRIM_MOTION_ART.jumpFrame(p);
    const right=keys.findIndex(v=>v>=t);
    if(p.grounded&&age<=175&&t===16)return {frame:121,rise};
    if(right<=0||t===keys[right])return {frame:114+Math.max(0,right),rise};
    const left=right-1,part=Math.round((t-keys[left])/(keys[right]-keys[left])*4);
    const cell=part===0?18+left:part===4?18+right:left*3+part-1;
    return {frame:96+cell,rise};
  }
  function at(time){
    const key=carryFrame(),carried=paint.poses[key.frame],p=s.player;
    const [x,y,sx,sy,turn,yaw,pitch]=G.pose(SWING,time);
    const w=Math.min(smooth(time/36),smooth((END-time)/50));
    const carryHand=forward.rear.hands[key.frame], [cx,cy]=carryHand;
    const rest=w<1?m.trailingRotation(p.x+cx,s.feetY+cy+key.rise):0;
    const bank=turn*DEG+(1-w)*(rest+Math.PI/2);
    const hand=lerp(carryHand,[x,y],w),shoulder=lerp(carried.shoulder,[sx,sy],w);
    const matrix=G.project(bank,yaw*DEG,pitch*DEG);
    const platform=p.onSoulPlatform===false?null:(s.soulPlatform||[]).find(q=>q.id===p.onSoulPlatform);
    let gap=Infinity;
    for(const [dx,dy] of G.transform(forward.rear.outline,{hand,matrix})){
      const wx=p.x+dx,wy=s.feetY+dy+key.rise,y=s.terrain.groundAt(wx);
      if(Number.isFinite(y))gap=Math.min(gap,y-wy);
      if(platform&&wx>=platform.x&&wx<=platform.x+platform.width)gap=Math.min(gap,platform.y-wy);
    }
    // Fade any clearance adjustment into the untouched carry at the joins.
    // Keep the blade, hand, and collision edge under one transform.
    const lift=Math.max(0,6-gap)*w;
    hand[1]-=lift;shoulder[1]-=lift;
    return {...key,carried,hand,shoulder,matrix,w};
  }
  function acceptCut(){
    const p=s.player;
    const eligible=m.ready&&s.visuals?.reviewV2&&m.forwardActive&&m.cutHandoffReady&&m.cutWeaponReady&&
      (p.grounded||m.forwardAir&&m.registeredAirCut)&&!compact(p)&&!hurt(p)&&
      s.powerManager.level('soulCleave')===0;
    p.risingCut=eligible?Object.freeze({sequence:s.swingSequence,mode:'rise'}):null;
  }
  function acceptSlide(){
    const p=s.player,owner=auth();
    if(owner?.mode==='rise'&&p.holdSlide&&!p.grounded&&p.attackMs>0) switchOwner(p,owner,'edge','compact-in');
  }
  function acceptBow(){
    const p=s.player,owner=auth();
    if(owner?.mode==='rise'&&p.visualFireMs>0&&riseAge()<=END) switchOwner(p,owner,'yield','bow');
  }
  function wantsContactTest(){
    const p=s.player,[start,end]=spec.active;
    return p.previousAttackMs>p.attackMs&&C.attackDurationMs-p.previousAttackMs<=end&&
      C.attackDurationMs-p.attackMs>=start&&resolve()?.mode==='rise';
  }
  function contactTest(previousRoot){
    const stage=resolve(),frame=compactFrame(stage);
    glints=[];
    if(stage?.mode!=='rise'&&frame===null){recentCompact=null;return null;}
    const p=s.player,previous=C.attackDurationMs-p.previousAttackMs,now=C.attackDurationMs-p.attackMs;
    const edgeSpec=frame===null?spec:compactSpec;
    // Keep current-cel checks and the verified same-cel projectile correction.
    // Clamp each pose to its original legal edge. No hidden bridge across cels.
    const edges=frame===null?G.samples(spec,previous,now,t=>{
      const pose=at(t);return G.transform(spec.edge,pose).map(([x,y])=>[x,y+pose.rise]);
    }).map(sample=>{
      if(!previousRoot||now===previous)return sample;
      const remaining=(now-sample.ms)/(now-previous);
      return {...sample,origin:[(p.x-previousRoot[0])*remaining,(s.feetY-previousRoot[1])*remaining]};
    }):compactSamples(stage,frame,previous,now);
    return (target,ball)=>{
      if(!edges.length)return false;
      const local={x:target.x-p.x,y:target.y-s.feetY,width:target.width,height:target.height};
      if(frame===null)return G.contact(edgeSpec,edges,local)!==null;
      for(const sample of edges){
        const [x,y]=sample.origin;
        const anchored={...local,x:local.x-x,y:local.y-y};
        if(sample.ms!==now){
          const before=ball&&sample.oldBalls.get(ball);
          if(!before)continue;
          anchored.x+=G.mix(before[0]-ball.x,0,sample.phase);
          anchored.y+=G.mix(before[1]-ball.y,0,sample.phase);
        }
        if(G.contact(edgeSpec,[{ms:sample.ms,edge:sample.edge}],anchored)===null)continue;
        if(sample.ms!==now)markCrossing(sample,anchored,stage);
        return true;
      }
      return false;
    };
  }
  function markCrossing(sample,target,owner){
    const [x,y]=sample.origin,[bx,by,bX,bY]=compactSpec.bounds;
    const bounds=[Math.max(target.x,bx),Math.max(target.y,by),
      Math.min(target.x+target.width,bX),Math.min(target.y+target.height,bY)];
    const pieces=[];
    for(let i=1;i<sample.edge.length;i++){
      const section=clipSegment(sample.edge[i-1],sample.edge[i],bounds);
      if(section)pieces.push(section.map(([u,v])=>[u+x+s.player.x,v+y+s.feetY]));
    }
    if(pieces.length)glints.push({owner,at:s.elapsed,pieces});
  }
  function drawCell(frame,slide=0) {
    const {size:[w,h],columns,anchor:[ox,oy],scale}=paint,slot=frame+122*slide;
    ctx.drawImage(body,(slot%columns)*w,Math.floor(slot/columns)*h,w,h,
                       -ox*scale,-oy*scale,w*scale,h*scale);
  }
  function torso(f){
    const scale=paint.scale,[ax,ay]=paint.anchor,[w,h]=paint.size;
    const [dx,dy]=f.shoulder.map((v,i)=>v-f.carried.shoulder[i]);
    const [u,v]=f.carried.shoulder, [,hipY]=f.carried.waist;
    const a=.67*Math.atan2(dx,Math.max(20,hipY-v+14));
    const c=Math.cos(a),s=Math.sin(a),slot=f.frame+122;
    const sourceX=slot%paint.columns*w,sourceY=Math.floor(slot/paint.columns)*h;
    let pixels=torsoPixels.get(slot);
    if(!pixels){
      sourceContext.clearRect(0,0,w,h);
      sourceContext.drawImage(body,sourceX,sourceY,w,h,0,0,w,h);
      pixels=sourceContext.getImageData(0,0,w,h).data;
      torsoPixels.set(slot,pixels);
    }
    const result=painted.data;
    result.fill(0);
    for(let j=0;j<h;j++){
      const y=(j-ay)*scale;
      const blend=1-smooth((j-114)/35);
      for(let i=0;i<w;i++){
        const x=(i-ax)*scale,rx=x-u-dx,ry=y-v-dy;
        const px=i+(u+c*rx+s*ry-x)*blend/scale;
        const py=j+(v-s*rx+c*ry-y)*blend/scale;
        const ix=Math.floor(px),iy=Math.floor(py);
        if(ix<0||iy<0||ix>=w-1||iy>=h-1)continue;
        const tx=px-ix,ty=py-iy,n=(iy*w+ix)*4;
        const n2=n+w*4,to=(j*w+i)*4;
        const alpha=G.mix(G.mix(pixels[n+3],pixels[n+7],tx),G.mix(pixels[n2+3],pixels[n2+7],tx),ty);
        if(alpha<1)continue;
        result[to+3]=alpha;
        for(let k=0;k<3;k++)result[to+k]=G.mix(G.mix(pixels[n+k]*pixels[n+3],pixels[n+4+k]*pixels[n+7],tx),
          G.mix(pixels[n2+k]*pixels[n2+3],pixels[n2+4+k]*pixels[n2+7],tx),ty)/alpha;
      }
    }
    warpContext.putImageData(painted,0,0);
    ctx.drawImage(warp,-ax*scale,-ay*scale,w*scale,h*scale);
  }
  function segment(i,p1,p2,a,b){
    const [u,v]=a,[x,y]=b,[x0,y0]=p1,[x1,y1]=p2;
    const dx=x-u,dy=y-v,sx=x1-x0,sy=y1-y0;
    const len=dx*dx+dy*dy;
    const re=(sx*dx+sy*dy)/len,im=(sy*dx-sx*dy)/len;
    const k=paint.partSize;
    ctx.save();
    ctx.transform(re,im,-im,re,x0-re*u+im*v,y0-im*u-re*v);
    ctx.drawImage(limbs,0,i*k,k,k,0,0,k,k);
    ctx.restore();
  }
  function arm(f,part){
    const [sx,sy]=f.shoulder,[dx,dy]=f.hand.map((v,i)=>v-f.shoulder[i]);
    const span=Math.hypot(dx,dy),u=dx/span,v=dy/span;
    const along=(16.15**2-12.25**2+span**2)/(2*span);
    const bend=Math.sqrt(Math.max(0,16.15**2-along**2));
    const elbow=[sx+u*along-v*bend,sy+v*along+u*bend];
    if(part==='arm'){
      segment(0,f.shoulder,elbow,...paint.upper);
      segment(1,elbow,f.hand,...paint.fore);
    }else{
      const shaft=Math.atan2(-f.matrix[1],f.matrix[3]),[gx,gy]=paint.grip,
        wrist=Math.atan2(f.hand[1]-elbow[1],f.hand[0]-elbow[0]);
      const strike=.77*shaft+.23*(wrist+.28),angle=G.mix(shaft-.227,strike,f.w);
      ctx.save();
      ctx.translate(...f.hand);
      ctx.rotate(angle);
      ctx.scale(paint.scale,paint.scale);
      ctx.translate(-gx,-gy);
      const k=paint.partSize;
      ctx.drawImage(limbs,0,k*2,k,k,0,0,k,k);
      ctx.restore();
    }
  }
  function weapon(pose,alpha=1){
    const art=forward.weapon, image=s.textures.get(art.key).getSourceImage(),[a,b,c,d]=pose.matrix;
    ctx.save();
    ctx.globalAlpha=alpha;
    ctx.transform(a,c,b,d,...pose.hand);
    ctx.scale(art.scale,art.scale);
    ctx.translate(...art.anchor.map(x=>-x));
    ctx.drawImage(image,0,0);
    ctx.restore();
  }
  function draw(time, f){
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,box.width,box.height);
    ctx.setTransform(2,0,0,2,2*X,2*Y);
    const front=smooth((time-34)/42)*smooth((277-time)/36);
    if(front<1)weapon(f);
    drawCell(f.frame);
    torso(f);
    arm(f,'arm');
    if(front>0)weapon(f,front);
    arm(f,'hand');
    const p=s.player;
    light.refresh();
    sprite.setPosition(p.x-X,s.feetY+f.rise-Y).setAlpha(p.invulMs>0&&Math.floor(s.elapsed/.083333)%2===0?.58:1)
      .setTint(p.slowMs>0?0xb9ecff:0xffffff).setVisible(true);
    const [start,end]=spec.active;
    if(time>=start&&time<=end){
      const edge=G.transform(spec.edge,f).map(([x,y])=>[p.x+x,s.feetY+y+f.rise]);
      const [x,y,X,Y]=spec.bounds,bounds=[p.x+x,s.feetY+y,p.x+X,s.feetY+Y];
      for(const [width,alpha] of [[6,.20],[2,.85]]){
        ink.lineStyle(width,0xb9f4ea,alpha);
        for(let i=1;i<edge.length;i++){
          const portion=clipSegment(edge[i-1],edge[i],bounds);
          if(portion)ink.lineBetween(...portion[0],...portion[1]);
        }
      }
    }
  }
  const angle=(x,y)=>Math.atan2(y,x);
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  function preparing(){
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,box.width,box.height);
    ctx.setTransform(2,0,0,2,2*X,2*Y);
  }
  function showJoin(depth,base){
    const p=s.player;
    light.refresh();
    sprite.setDepth(depth).setPosition(p.x-X,s.feetY-Y).setAlpha(base.alpha)
      .setTint(p.slowMs>0?0xb9ecff:0xffffff).setVisible(true);
  }
  function clipSegment(a,b,clip){
    let from=0,to=1;
    for(let i=0;i<2;i++){
      const d=b[i]-a[i],lo=clip[i],hi=clip[i+2];
      if(Math.abs(d)<1e-8){if(a[i]<lo||a[i]>hi)return null;continue;}
      const p=(lo-a[i])/d,q=(hi-a[i])/d;
      from=Math.max(from,Math.min(p,q));to=Math.min(to,Math.max(p,q));
    }
    return from<=to?[lerp(a,b,from),lerp(a,b,to)]:null;
  }
  function compactPose(owner,frame,elapsed=s.elapsed){
    const marks=compactPaint[frame],scale=s.powerArt.action.scaleX;
    const age=(elapsed-owner.at)*1000,e=smooth(age/38);
    const from=at(owner.age), pivot=marks.pivot.map((v,i)=>(v-[288,400][i])*scale);
    const skin=[G.clamp(from.shoulder[0]-pivot[0],-10,10),G.clamp(from.shoulder[1]-pivot[1],-18,18)];
    const follow=smooth((age-2)/18)*(1-smooth((age-43)/44));
    const [b,d]=[from.matrix[1],from.matrix[3]],
      rotation=wrap(angle(-b,-d)-angle(marks.socket[0]-marks.hand[0],marks.socket[1]-marks.hand[1]))*(1-e)+follow;
    const axis=angle(marks.socket[0]-marks.hand[0],marks.socket[1]-marks.hand[1]);
    const socket=marks.socket.map((v,i)=>(v-[288,400][i])*scale);
    const roll=Math.cos(Math.PI*(1-e));
    const rotate=([x,y],rad)=>[x*Math.cos(rad)-y*Math.sin(rad),x*Math.sin(rad)+y*Math.cos(rad)];
    const edge=marks.edge.map(([u,v])=>{
      const p=[(u-288)*scale-socket[0],(v-400)*scale-socket[1]];
      const inShaft=rotate(p,-axis);inShaft[1]*=roll;
      const head=rotate(inShaft,axis);
      return rotate(head.map((v,i)=>v+socket[i]-pivot[i]),rotation)
        .map((v,i)=>v+pivot[i]+skin[i]*(1-e));
    });
    // The Canvas transform degenerates at the edge-on pose. Do not let its
    // collapsed line cut invisibly while less than a pixel of steel projects.
    return {age,e,scale,pivot,skin,rotation,axis,socket,roll,edge,edgeVisible:Math.abs(roll)>=.02};
  }
  function compactSamples(owner,frame,previous,now){
    const mark={owner,frame,time:now,origin:[s.player.x,s.feetY],elapsed:s.elapsed,
      balls:new Map(s.fireballs.filter(v=>!v.dead&&!v.reflected).map(v=>[v,[v.x,v.y]]))};
    const past=recentCompact;
    recentCompact=mark;
    const active=Core.attackActive(s.player.attackMs,260,.20,.79);
    const presented=compactPose(owner,frame);
    const samples=active&&presented.edgeVisible?[{ms:now,edge:presented.edge,origin:[0,0]}]:[];
    // Sweep only exact intermediate registrations of one continuous cel.
    // A skipped or changed cel has no defined interpolation in the paint.
    if(!active||!past||past.owner!==owner||
      Math.abs(past.time-previous)>1e-5||now-previous>33.34||now<=previous)return samples;
    const from=Math.max(previous,52),to=Math.min(now,205.4);
    if(to<=from)return samples;
    const count=Math.ceil((to-from)/.8);
    for(let i=0;i<count;i++){
      const ms=G.mix(from,to,i/count),f=(ms-previous)/(now-previous);
      const slot=8+Math.floor(ms/65);
      const pose=compactPose(owner,slot,G.mix(past.elapsed,mark.elapsed,f));
      if(!pose.edgeVisible)continue;
      samples.push({ms,edge:pose.edge,phase:f,oldBalls:past.balls,
        origin:lerp(past.origin,mark.origin,f).map((v,k)=>v-mark.origin[k])});
    }
    return samples;
  }
  function compactJoin(owner,frame){
    const p=s.player,action=s.powerArt.action;
    if(!action.visible||Number(action.frame.name)!==frame)return;
    const {age,e,scale,pivot,skin,rotation,axis,socket,roll,edge,edgeVisible}=compactPose(owner,frame);
    const segments=[];
    if(edgeVisible&&Core.attackActive(p.attackMs,260,.20,.79)){
      for(let i=1;i<edge.length;i++){
        const segment=clipSegment(edge[i-1],edge[i],compactSpec.bounds);
        if(segment)segments.push(segment);
      }
      for(const [width,alpha] of [[3,.30],[1.2,.92]]){
        ink.lineStyle(width,0xb9f4ea,alpha);
        for(const [a,b] of segments)ink.lineBetween(a[0]+p.x,a[1]+s.feetY,b[0]+p.x,b[1]+s.feetY);
        for(const contact of glints)if(contact.owner===owner&&contact.at===s.elapsed){
          for(const [a,b] of contact.pieces)ink.lineBetween(...a,...b);
        }
      }
    }
    if(e>=1&&Math.abs(rotation)<.001)return;
    preparing();
    ctx.translate((1-e)*skin[0],(1-e)*skin[1]);
    const draw=y=>ctx.drawImage(compactAtlas,(frame-8)*512,y,512,512,-288*scale,-400*scale,512*scale,512*scale);
    draw(0);
    ctx.translate(...pivot);
    ctx.rotate(rotation);
    ctx.translate(-pivot[0],-pivot[1]);
    draw(512);
    // Roll the blade around its shaft as the hands turn. The original glove
    // and handle stay together. This closes the opposite blade facings without
    // flipping the character or rendering a second weapon.
    ctx.translate(...socket);ctx.rotate(axis);ctx.scale(1,roll);
    ctx.rotate(-axis);ctx.translate(-socket[0],-socket[1]);
    draw(1024);
    showJoin(action.depth,action);
    // Keep the native compact action registered for drawGroundSlide's
    // procedural fallback check. This canvas owns its visible paint only.
    action.setAlpha(0);
  }
  function bowJoin(owner,age){
    const p=s.player,bow=s.combatArt?.reaper?.[0];
    if(!p.visualFireMs||p.attackMs||!bow?.visible||!bow.texture?.key.includes('crossbow'))return;
    const from=at(owner.age),held=at(END),e=smooth(age/90);
    const hand=lerp([from.hand[0],from.hand[1]+from.rise],[held.hand[0],held.hand[1]+held.rise],e);
    const [a,b,c,d]=from.matrix;
    const fromAngle=Math.atan2(-b,d),holdAngle=Math.atan2(-held.matrix[1],held.matrix[3]);
    const yaw=Math.sign(Math.cos(fromAngle)*c-Math.sin(fromAngle)*a)*Math.acos(G.clamp(Math.hypot(a,c),0,1));
    const angleNow=fromAngle+wrap(holdAngle-fromAngle)*e;
    const compactDepth=Math.sin(Math.PI*e)*.35;
    const matrix=G.project(angleNow,yaw*(1-e),Math.acos(G.clamp(Math.hypot(b,d),0,1))*(1-e)+compactDepth);
    preparing();weapon({hand,matrix});
    showJoin(bow.depth-.06,bow);
  }
  const playingPose=()=>['playing','rewinding','paused'].includes(s.state);
  function clear(){
    sprite.setVisible(false);
    ink.clear();
    if(s.state==='rewinding'){recentCompact=null;glints=[];}
  }
  function upright(){
    const time=riseAge();
    return playingPose()&&resolve()?.mode==='rise'&&time>=0&&time<=END;
  }
  function renderUpright(){
    const time=riseAge();
    if(time<=0||time>=END)return;
    const f=at(time);
    sprite.setDepth(12.09);
    draw(time,f);
    for(const view of m.body)view.setVisible(false);
    m.hideRearCarry();
    m.weapon.setVisible(false);
    m.trail.clear();
    m.state={name:'reaper-cut-body',frame:time*C.attackDurationMs/260,texture:sprite.texture.key,rising:true};
  }
  function renderHandoff(){
    const stage=resolve();
    if(!playingPose()||!stage?.kind||s.elapsed<stage.at)return;
    const frame=compactFrame(stage);
    if(frame!==null)compactJoin(stage,frame);
    else if(stage.kind==='bow'&&!hurt(s.player))bowJoin(stage,(s.elapsed-stage.at)*1000);
  }
  function destroy(){
    sprite.destroy();ink.destroy();s.textures.remove('motion-rising-reaper');
    body.close?.();
  }
  return {acceptCut,acceptSlide,acceptBow,wantsContactTest,contactTest,compactFrame,clear,upright,renderUpright,renderHandoff,destroy,sprite};
  }
  scope.GRIM_RISING_CUT={preload};
})(typeof window!=='undefined'?window:globalThis);
