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
  function inBounds([left,top,right,bottom],box){
    return box.x<right&&box.x+box.width>left&&box.y<bottom&&box.y+box.height>top;
  }
  function contact(spec, edges, box){
    const [bx,by,bX,bY]=spec.bounds, {x,y,width,height}=box, X=x+width,Y=y+height,pad=spec.pad;
    if(!inBounds(spec.bounds,box))return null;
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
  root.RisingGeometry={clamp,mix,pose,project,transform,intersects,inBounds,contact,samples};
})(globalThis);
/* Rear-carry Cut paint and registered edge. Optional as a complete pose family. */
(function(scope){
  'use strict';
  const DATA=scope.GRIM_RISING_CUT_DATA;
  // Milliseconds, palm x/y, hip shift x/y, torso lean, weapon bank/yaw/pitch.
  // The hips start forward while the upper body is still gathering behind.
  const SWING=[
    [0,  -31,-59,   0,  0, -14, -104,  0, 0],
    [22, -29,-58,  -2,  1, -15, -109, -2, 7],
    [48, -24,-59,  -4,  3, -14, -123, -5,19],
    [71, -18,-62,  -2,  4, -12, -143, -7,35],
    [94,  -9,-63,   1,  3,  -4, -163, -5,42],
    [116,  5,-61,   4,  2,   6, -193,  0,45],
    [141, 18,-60,   6,  1,  13, -227,  2,40],
    [167, 25,-60,   6,  0,  16, -262,  3,18],
    [194, 24,-62,   5, -1,  15, -296,  2, 8],
    [221, 19,-66,   3, -2,  11, -328,  1, 9],
    [249,  7,-72,   1, -2,   5, -359,  3,15],
    [279, -6,-68,  -1, -1,   0, -393,  6,21],
    [310,-15,-61,  -1,  0,  -7, -425,  5,17],
    [335,-26,-57,   0,  0, -12, -456,  2, 7],
    [355,-31,-59,   0,  0, -14, -464,  0, 0],
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
      // Decode the body atlas off the game thread where available.
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
  // Compose all existing paint layers into the single reusable Cut texture.
  const box=document.createElement('canvas');box.width=576;box.height=448;
  const ctx=box.getContext('2d');
  const light=s.textures.addCanvas('motion-rising-reaper',box);
  const sprite=s.add.image(0,0,'motion-rising-reaper').setOrigin(0).setScale(.5).setDepth(12.09).setVisible(false);
  const ink=s.add.graphics().setDepth(12.18);
  const X=144,Y=176;
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
    const [x,y,hipX,hipY,lean,turn,yaw,pitch]=G.pose(SWING,time);
    const w=Math.min(smooth(time/36),smooth((END-time)/50));
    const carryHand=forward.rear.hands[key.frame], [cx,cy]=carryHand;
    const drag=key.frame<96&&p.grounded;
    const join=Math.min(smooth(time/95),smooth((END-time)/85));
    const rest=join<1?m.trailingRotation(p.x+cx,s.feetY+cy+key.rise,drag):0;
    // On a slope, aim the low arc along the surface so the blade clears
    // the ground without pulling the hand away from the shoulder.
    const behind=s.terrain.groundAt(p.x-32),ahead=s.terrain.groundAt(p.x+32);
    const grade=p.grounded&&p.onSoulPlatform===false&&Number.isFinite(behind)&&Number.isFinite(ahead)
      ?G.clamp(Math.atan2(ahead-behind,64),-.55,.55):0;
    const bank=turn*DEG+(1-join)*(rest+104*DEG)+grade*w;
    const hand=lerp(carryHand,[x,y],w);
    const matrix=G.project(bank,yaw*DEG,pitch*DEG);
    // Mirror around the palm in weapon space, before the swing projection.
    matrix[0]*=-1;matrix[2]*=-1;
    const hip=[hipX*w,hipY*w],tilt=G.mix(drag?forward.rear.dragLean:0,lean*DEG,w);
    const [wx,wy]=carried.waist,dx=carried.shoulder[0]-wx,dy=carried.shoulder[1]-wy;
    const shoulder=[wx+hip[0]+dx*Math.cos(tilt)-dy*Math.sin(tilt),
      wy+hip[1]+dx*Math.sin(tilt)+dy*Math.cos(tilt)];
    const reachX=hand[0]-shoulder[0];
    const maxLift=Math.max(0,hand[1]-shoulder[1]+Math.sqrt(Math.max(0,28**2-reachX**2)));
    const platform=p.onSoulPlatform===false?null:(s.soulPlatform||[]).find(q=>q.id===p.onSoulPlatform);
    let gap=Infinity,depthScale=1;
    const rootX=p.x+hand[0],rootY=s.feetY+key.rise+hand[1];
    const [a,b,c,d]=matrix,slope=Math.tan(grade);
    for(const [u,v] of GRIM_MOTION_ART.shaft){
      const run=a*u+b*v,x=rootX+run,drop=c*u+d*v,ground=s.terrain.groundAt(x);
      let floor=Number.isFinite(ground)?ground:Infinity;
      if(platform&&x>=platform.x&&x<=platform.x+platform.width)floor=Math.min(floor,platform.y);
      const available=floor-rootY-2;
      gap=Math.min(gap,available-drop);
      // Tip the swing plane toward the viewer when lifting farther would
      // straighten the elbow past its reach. Paint and contact use this pose.
      const normalDrop=drop-slope*run;
      if(normalDrop>0&&drop>available+maxLift)
        depthScale=Math.min(depthScale,(available+maxLift-slope*run)/normalDrop);
    }
    // Let the terrain-aware carry own clearance at the two joins.
    // Keep the blade, hand, and collision edge under one transform.
    const lift=G.clamp(-gap,0,maxLift);
    hand[1]-=lift;
    const depth=G.clamp(depthScale,.05,1);
    matrix[2]=G.mix(slope*a,c,depth);matrix[3]=G.mix(slope*b,d,depth);
    return {...key,carried,hand,shoulder,matrix,w,hip,tilt};
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
    if(owner?.mode!=='rise'||p.visualFireMs<=0)return;
    if(riseAge()<=END)switchOwner(p,owner,'yield','bow');
    // Commit an expired swing's handoff before the input-triggered save.
    // Drawing the next frame (including a paused resume) resolves the same pose.
    else resolve();
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
    if(frame===null){
      let edges;
      return target=>{
        const local={x:target.x-p.x,y:target.y-s.feetY,width:target.width,height:target.height};
        if(!G.inBounds(spec.bounds,local))return false;
        // The scene tests every obstacle, enemy and projectile. Sample the
        // blade once, on the first target inside its reachable area this tick.
        edges??=G.samples(spec,previous,now,t=>{
          const pose=at(t);return G.transform(spec.edge,pose).map(([x,y])=>[x,y+pose.rise]);
        }).map(sample=>{
          if(!previousRoot||now===previous)return sample;
          const remaining=(now-sample.ms)/(now-previous);
          return {...sample,origin:[(p.x-previousRoot[0])*remaining,(s.feetY-previousRoot[1])*remaining]};
        });
        return G.contact(spec,edges,local)!==null;
      };
    }
    // Compact poses retain their per-tick history for moving projectiles.
    const edges=compactSamples(stage,frame,previous,now);
    return (target,ball)=>{
      const local={x:target.x-p.x,y:target.y-s.feetY,width:target.width,height:target.height};
      for(const sample of edges){
        const [x,y]=sample.origin;
        const anchored={...local,x:local.x-x,y:local.y-y};
        if(sample.ms!==now){
          const before=ball&&sample.oldBalls.get(ball);
          if(!before)continue;
          anchored.x+=G.mix(before[0]-ball.x,0,sample.phase);
          anchored.y+=G.mix(before[1]-ball.y,0,sample.phase);
        }
        if(G.contact(compactSpec,[{ms:sample.ms,edge:sample.edge}],anchored)===null)continue;
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
  function bodyPose(f){
    const [wx,wy]=f.carried.waist,[dx,dy]=f.hip;
    // Shear and compress the lower paint about the soles. Its top meets the
    // translated pelvis exactly, while the stride keeps its ground contact.
    ctx.save();
    ctx.transform(1,0,dx/wy,1+dy/wy,0,0);
    drawCell(f.frame);
    ctx.restore();
    ctx.save();
    ctx.translate(wx+dx,wy+dy);
    ctx.rotate(f.tilt);
    ctx.translate(-wx,-wy);
    drawCell(f.frame,1);
    ctx.restore();
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
      const strike=shaft+.227+.23*wrap(wrist+.28-shaft-.227);
      // The baked running glove keeps its relaxed wrist on a slope. Start and
      // finish in that same orientation as the fingers tighten into the swing.
      const rest=f.frame<96&&f.w<1
        ?GRIM_MOTION_ART.levelDragAngle(-forward.rear.hands[f.frame][1])+.227:shaft+.227;
      const angle=rest+wrap(strike-rest)*f.w;
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
  function aboveGround(hand,rise){
    // Build one short clip path in actor coordinates. Duplicate x at gap lips
    // and platform ends so the path cannot bridge empty space diagonally.
    const p=s.player,ledge=p.onSoulPlatform===false?null:s.soulPlatform?.find(q=>q.id===p.onSoulPlatform);
    const path=new Path2D(),left=hand[0]-98,right=hand[0]+98;
    path.moveTo(left,-Y);path.lineTo(right,-Y);
    let x=right;
    while(x>left){
      const world=p.x+x,section=s.terrain.sectionAt?.(world-.001);
      let next=Math.max(left,x-6);
      if(section&&section.start<world-.001)next=Math.max(next,section.start-p.x);
      if(ledge)for(const edge of [ledge.x,ledge.x+ledge.width]){
        if(edge<world-.001)next=Math.max(next,edge-p.x);
      }
      for(const [at,side] of [[x,-.0001],[next,.0001]]){
        const ground=GRIM_MOTION_ART.floorAt(s,p.x+at+side,ledge);
        path.lineTo(at,Math.min(70,ground-s.feetY-rise));
      }
      x=next;
    }
    path.closePath();
    return path;
  }
  function weapon(pose,ground,alpha=1){
    const art=forward.weapon, image=s.textures.get(art.key).getSourceImage(),[a,b,c,d]=pose.matrix;
    ctx.save();
    ctx.clip(ground);
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
    const ground=aboveGround(f.hand,f.rise);
    if(front<1)weapon(f,ground);
    bodyPose(f);
    arm(f,'arm');
    if(front>0)weapon(f,ground,front);
    arm(f,'hand');
    const p=s.player;
    const [start,end]=spec.active;
    if(time>=start&&time<=end){
      const edge=G.transform(spec.edge,f),bounds=spec.bounds;
      ctx.save();
      ctx.clip(ground);
      ctx.beginPath();
      for(let i=1;i<edge.length;i++){
        const section=clipSegment(edge[i-1],edge[i],[bounds[0],bounds[1]-f.rise,bounds[2],bounds[3]-f.rise]);
        if(section){ctx.moveTo(...section[0]);ctx.lineTo(...section[1]);}
      }
      ctx.strokeStyle='#b9f4ea';
      for(const [width,alpha] of [[6,.20],[2,.85]]){
        ctx.lineWidth=width;ctx.globalAlpha=alpha;ctx.stroke();
      }
      ctx.restore();
    }
    light.refresh();
    sprite.setPosition(p.x-X,s.feetY+f.rise-Y).setAlpha(p.invulMs>0&&Math.floor(s.elapsed/.083333)%2===0?.58:1)
      .setTint(p.slowMs>0?0xb9ecff:0xffffff).setVisible(true);
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
    // The tip-down blade and compact cel now face the same way. Both the
    // paint and its edge rotate with the hands about the same pivot.
    const c=Math.cos(rotation),sin=Math.sin(rotation);
    const edge=marks.edge.map(([u,v])=>{
      const x=(u-288)*scale-pivot[0],y=(v-400)*scale-pivot[1];
      return [c*x-sin*y+pivot[0]+skin[0]*(1-e),sin*x+c*y+pivot[1]+skin[1]*(1-e)];
    });
    return {e,scale,pivot,skin,rotation,edge};
  }
  function compactSamples(owner,frame,previous,now){
    const mark={owner,frame,time:now,origin:[s.player.x,s.feetY],elapsed:s.elapsed,
      balls:new Map(s.fireballs.filter(v=>!v.dead&&!v.reflected).map(v=>[v,[v.x,v.y]]))};
    const past=recentCompact;
    recentCompact=mark;
    const active=Core.attackActive(s.player.attackMs,260,.20,.79);
    const presented=compactPose(owner,frame);
    const samples=active?[{ms:now,edge:presented.edge,origin:[0,0]}]:[];
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
      samples.push({ms,edge:pose.edge,phase:f,oldBalls:past.balls,
        origin:lerp(past.origin,mark.origin,f).map((v,k)=>v-mark.origin[k])});
    }
    return samples;
  }
  function compactJoin(owner,frame){
    const p=s.player,action=s.powerArt.action;
    if(!action.visible||Number(action.frame.name)!==frame)return;
    const {e,scale,pivot,skin,rotation,edge}=compactPose(owner,frame);
    const segments=[];
    if(Core.attackActive(p.attackMs,260,.20,.79)){
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
    const yaw=Math.sign(-Math.cos(fromAngle)*c+Math.sin(fromAngle)*a)*Math.acos(G.clamp(Math.hypot(a,c),0,1));
    const angleNow=fromAngle+wrap(holdAngle-fromAngle)*e;
    const compactDepth=Math.sin(Math.PI*e)*.35;
    const matrix=G.project(angleNow,yaw*(1-e),Math.acos(G.clamp(Math.hypot(b,d),0,1))*(1-e)+compactDepth);
    matrix[0]*=-1;matrix[2]*=-1;
    preparing();weapon({hand,matrix},aboveGround(hand,0));
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
