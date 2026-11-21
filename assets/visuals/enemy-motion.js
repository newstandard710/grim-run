/* Painted enemy movement and terrain contact, independent of combat state. */
(function(scope){
  'use strict';
  const KEY='enemy-ground-inbetweens', CELL=192;
  const CRAWLER_STRIDE=104, IMP_STRIDE=92;
  // Front and rear support claws in the unflipped painted frames. In pose 4
  // the extended rear toe is lifted, so the claw under the hip bears weight.
  const CRAWL_CLAWS=[
    [555,831,1080,831], [530,848,1059,850], [515,842,1137,847], [509,856,902,839]
  ];
  const CRAWL_MIDS=CRAWL_CLAWS.map((pair,index)=>pair.map((value,claw)=>
    (value+CRAWL_CLAWS[(index+1)%CRAWL_CLAWS.length][claw])*.5));
  // Supporting claws on the original left-facing response plates. The
  // raised front claw in frame 1 is excluded from the support pair.
  const RESPONSE_CLAWS=[
    [224,441,390,437],[212,433,352,438],[222,442,392,439],[222,443,379,441],
    [215,445,386,444],[208,447,373,446],[200,450,379,448],[198,450,366,450]
  ];
  function queueGroundDetails(scene){
    scene.load?.spritesheet?.(KEY,'assets/enemies/illustrated-v2/ground-inbetweens.webp?v=1',
      {frameWidth:CELL,frameHeight:CELL,endFrame:7});
  }
  function cycle(x, phase, stride){
    const value=x/stride*4+(phase||0);
    return (value%4+4)%4;
  }
  const wingNames=['flap_raised','flap_mid_down','flap_lowered','flap_mid_up'];
  const part=(t,count)=>Math.round(Math.min(1,Math.max(0,t))*(count-1));
  function skeletalTurn(e,now){
    const t=e.timer||0;
    const wing=time=>Math.floor(Math.max(0,time)*12+(e.phase||0))%4;
    if(e.mode==='telegraph'&&t<.16)return wing(now-t)*6+part(t/.16,6);
    if(e.mode==='dive'&&t<.14)return 24+part(t/.14,8);
    if(e.mode==='recover'&&t<.18)return 32+wing(now-t+.18)*7+part(t/.18,7);
    return null;
  }
  function turnSkull(frame,marks){
    let a,b,u;
    if(frame<24){a=wingNames[Math.floor(frame/6)];b='telegraph';u=frame%6/5;}
    else if(frame<32){a='telegraph';b='dive';u=(frame-24)/7;}
    else {a='dive';b=wingNames[Math.floor((frame-32)/7)];u=(frame-32)%7/6;}
    return marks[a].map((x,i)=>x+(marks[b][i]-x)*u);
  }
  function impTurn(warning,releaseAge){
    if(warning>0&&warning>250)return 60+part((470-warning)/220,14);
    if(releaseAge>=145&&releaseAge<=260)return 74+part((releaseAge-145)/115,9);
    return null;
  }
  function floor(terrain,x){
    const segments=terrain?.segments;
    if(!segments?.length)return null;
    let lo=0, hi=segments.length-1;
    while(lo<=hi){
      const mid=(lo+hi)>>1, section=segments[mid];
      if(x<section.start)hi=mid-1;
      else if(x>=section.end)lo=mid+1;
      else return section.kind==='gap'?null:terrain.surfaceAt(section,x);
    }
    return null;
  }
  function crawlerPose(terrain,x,ground,width,height,scale,contacts){
    // The PNG faces left. Match the visual flip while holding the midpoint
    // of the two contact marks at a stable world X.
    const [fx,fy,rx,ry]=contacts;
    const lx=(width*.5-rx)*scale, ly=(ry-height*.5)*scale;
    const hx=(width*.5-fx)*scale, hy=(fy-height*.5)*scale;
    const mx=(lx+hx)*.5, my=(ly+hy)*.5, pivotX=x+mx;
    const dx=(hx-lx)*.5, dy=(hy-ly)*.5;
    const authored=Math.atan2(dy,dx);
    let angle=0, tx=dx, ty=dy;
    const pivotFloor=floor(terrain,pivotX);
    let left=floor(terrain,pivotX-tx),right=floor(terrain,pivotX+tx);
    for(let i=0;i<2;i++){
      let pitch=0;
      if(left!==null&&right!==null) pitch=Math.atan2(right-left,2*tx);
      else if(pivotFloor!==null&&left!==null) pitch=Math.atan2(pivotFloor-left,tx);
      else if(pivotFloor!==null&&right!==null) pitch=Math.atan2(right-pivotFloor,tx);
      angle=Math.max(-.74,Math.min(.74,pitch-authored));
      const c=Math.cos(angle),s=Math.sin(angle);
      tx=dx*c-dy*s;ty=dx*s+dy*c;
      left=floor(terrain,pivotX-tx);right=floor(terrain,pivotX+tx);
    }
    // Constrain the pivot against each supported contact. Where the terrain
    // bends across the body, the first contact bears weight.
    const pivotY=left!==null&&right!==null?Math.min(left+ty,right-ty):
      left!==null?left+ty:right!==null?right-ty:pivotFloor??ground;
    const c=Math.cos(angle),s=Math.sin(angle);
    return {x:pivotX-mx*c+my*s,y:pivotY-mx*s-my*c,angle};
  }
  const hasTweens=scene=>Boolean(scene.textures?.exists?.(KEY));
  function crawlView(scene,index){
    if(!scene.visuals?.boneCrawlerReady||!Number.isInteger(index)||index<0||index>=8)return null;
    const frame=index%4,meta=scope.GRIM_VISUALS.V2_BONE_CRAWLER_FRAMES[frame];
    const mid=index>=4&&hasTweens(scene);
    return {key:mid?KEY:meta.key,frame:mid?frame:undefined,
      imageScale:mid?meta.scale/(.2*.6):meta.scale,
      width:meta.width,height:meta.height,scale:meta.scale,claws:(mid?CRAWL_MIDS:CRAWL_CLAWS)[frame]};
  }
  function clawX(pose,view,claw){
    const x=(view.width*.5-view.claws[claw])*view.scale;
    const y=(view.claws[claw+1]-view.height*.5)*view.scale;
    return pose.x+x*Math.cos(pose.angle)-y*Math.sin(pose.angle);
  }
  function responsePose(terrain,x,ground,view,reference){
    let pose=crawlerPose(terrain,x,ground,view.width,view.height,view.scale,view.claws);
    if(!reference)return pose;
    const start=crawlerPose(terrain,x,ground,reference.width,reference.height,reference.scale,reference.claws);
    const front=clawX(start,reference,0);
    const claw=floor(terrain,front)!==null?0:2;
    const target=claw===0?front:clawX(start,reference,claw);
    let origin=x;
    // Re-evaluate the slope after shifting the new painting over the bearing claw.
    for(let i=0;i<2;i++){
      origin+=target-clawX(pose,view,claw);
      pose=crawlerPose(terrain,origin,ground,view.width,view.height,view.scale,view.claws);
    }
    return pose;
  }
  scope.GRIM_ENEMY_MOTION={KEY,CELL,CRAWLER_STRIDE,IMP_STRIDE,CRAWL_CLAWS,CRAWL_MIDS,
    RESPONSE_CLAWS,skeletalTurn,turnSkull,impTurn,queueGroundDetails,cycle,floor,crawlerPose,hasTweens,crawlView,clawX,responsePose};
})(typeof window!=='undefined'?window:globalThis);
