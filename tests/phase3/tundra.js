// Advance the production generator in distance order. Start normal physics on the
// approach to a real generated pair, retaining the surrounding terrain and hazards.
(seed) => {
  const s=scene,dt=1000/60;
  history.replaceState({},'', '?seed='+seed);
  s.startRun();
  const p=s.player;
  const place=x=>{
    p.x=x;p.y=s.terrain.groundAt(x)??s.terrain.anchorAt(x);
    s.distance=(x-s.startX)/GRIM_CONFIG.pxPerMeter;
    s.speed=GRIM_CORE.runSpeed(s.distance);
    s.cameraX=x-s.width*GRIM_CONFIG.reaperXRatio;
    s.cameraY=p.y-s.groundY;
    s.syncWorldScroll();
  };
  let plant,next,found=false;
  for(let x=s.startX;x<s.startX+4630*GRIM_CONFIG.pxPerMeter;x+=64){
    place(x);
    s.spawnAhead();
    if(s.distance<3000)continue;
    plant=s.obstacles.find(o=>o.type==='snappingBramble' && o.x-x>=320 && o.x-x<410);
    if(!plant)continue;
    next=s.obstacles.find(o=>o.type==='bramble' && o.x>plant.x+245 && o.x<plant.x+710);
    if(!next)continue;
    if(s.obstacles.some(o=>o!==plant&&o!==next&&o.x+o.width>=x-15&&o.x<=next.x+110))continue;
    if(s.terrain.segments.some(z=>z.kind==='gap'&&z.start<next.x+150&&z.end>x))continue;
    if(s.vendorObstacleBlocked('bramble',x,next.x-x+150))continue;
    found=true;
    break;
  }
  if(!found)return null;
  s.nextVendorNumber=Math.floor(s.distance/666)+1;
  s.drawScene();
  window.travelTo=x=>{
    let frames=0;
    while(p.x<x && s.state==='playing' && frames++<300){
      s.update(0,dt);grimRun.step(performance.now(),0);
    }
    return {hp:p.hp,plant:!!plant.destroyed,nextCut:!!next.destroyed,nextHit:!!next.dealtDamage,state:s.state};
  };
  return {plant:plant.x,next:next.x,type:next.type};
}
