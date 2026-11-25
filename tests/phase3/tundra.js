// Replay the pair emitted together by spawnAhead on seed 27 at 844 x 390.
// The source capture advanced the generator in 64 px increments through Tundra.
() => {
  const s=scene, dt=1000/60;
  history.replaceState({},'', '?seed=27');
  s.startRun();
  const plantX=43976, treeX=44272.309760666656, x=43656;
  const p=s.player;
  p.x=x;p.y=s.terrain.groundAt(x);
  s.distance=(x-s.startX)/GRIM_CONFIG.pxPerMeter;
  s.speed=GRIM_CORE.runSpeed(s.distance);
  s.cameraX=x-s.width*GRIM_CONFIG.reaperXRatio;
  s.cameraY=p.y-s.groundY;
  s.syncWorldScroll();
  s.nextVendorNumber=Math.floor(s.distance/666)+1;
  s.nextSnapSpawnX=s.nextEncounterX=Infinity;
  const plant={type:'snappingBramble',x:plantX,y:s.terrain.groundAt(plantX)-62,
    width:62,height:62,variant:4,destroyed:false,dealtDamage:false};
  const tree=GRIM_CORE.obstacle('bramble',treeX,s.terrain.groundAt(treeX),2,76,390);
  s.obstacles.push(plant,tree);
  s.makeTip(plant.type,plant);
  s.drawScene();
  window.travelTo=target=>{
    let frames=0;
    while(p.x<target && s.state==='playing' && frames++<300){
      s.update(0,dt);grimRun.step(performance.now(),0);
    }
    return {hp:p.hp,plant:!!plant.destroyed,nextCut:!!tree.destroyed,
      plantHit:!!plant.dealtDamage,nextHit:!!tree.dealtDamage,state:s.state,
      otherHits:s.obstacles.filter(o=>o!==plant&&o!==tree&&o.dealtDamage).map(o=>[o.type,o.x])};
  };
  return {plant:plant.x,next:tree.x};
}
