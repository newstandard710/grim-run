// Approach a naturally generated pair. Only the approach uses practice immunity.
(seed) => {
  const s=scene, p=() => s.player, dt=1000/60;
  history.replaceState({}, '', '?seed='+seed);
  s.startRun();
  const paint=s.drawScene;
  s.drawScene=()=>{};
  s.godMode=true;
  let gapDone, pair;
  try {
    for(let frame=0;frame<18000;frame++){
      if(s.state==='vendorIntro')s.finishVendorIntro();
      if(s.state==='upgrade')s.leaveVendor();
      const x=p().x;
      if(s.distance>3000){
        const plant=s.obstacles.find(o=>o.type==='snappingBramble' && !o.destroyed &&
          o.x-x>220 && o.x-x<290);
        if(plant){
          const next=s.obstacles.find(o=>o!==plant&&!o.destroyed &&
            o.x>plant.x+220 && o.x<plant.x+790 &&
            ['bramble','branch','rock','fire'].includes(o.type));
          if(next && !s.terrain.segments.some(z=>z.kind==="gap" && z.start<next.x+150 && z.end>x) && p().grounded){
            pair={plant,next};break;
          }
        }
      }
      if(s.distance>4650)break;
      const gap=s.terrain.segments.find(z=>z.kind==='gap'&&z.start>=x&&z.start-x<s.speed*.20);
      if(p().grounded && gap && gap!==gapDone){s.jump();gapDone=gap;}
      s.update(0,dt);
    }
  } finally {
    s.drawScene=paint;
    s.godMode=false;
  }
  if(!pair)return null;
  p().hp=3;p().invulMs=0;
  s.drawScene();
  window.travelTo=x=>{
    let frames=0;
    while(p().x<x && s.state==='playing' && frames++<300){
      s.update(0,dt);grimRun.step(performance.now(),0);
    }
    return {hp:p().hp,plant:!!pair.plant.destroyed,nextHit:!!pair.next.dealtDamage,state:s.state};
  };
  return {plant:pair.plant.x,next:pair.next.x,type:pair.next.type};
}
