// Match the G0 Tundra windup geometry and compare three counters against the
// same ordinary Lava crawler. The isolated enemy test uses baseline equipment
// for that biome and preserves movement, attack poses, targeting and collisions.
() => {
  const s=scene, game=grimRun;
  window.pressure = (kind,seed=33) => {
    history.replaceState({},'', '?seed='+seed);
    s.startRun();
    const plant=kind==='plant', p=s.player;
    let x=200+12*(plant?3260:8400);
    if(!plant){
      while(!s.terrain.canPlace(x-480,1100)||s.vendorObstacleBlocked('bramble',x,80))x+=20;
    }
    p.x=x-(plant?520:380);
    p.y=s.terrain.groundAt(p.x)??s.terrain.anchorAt(p.x);
    s.distance=(p.x-200)/12;
    s.cameraY=p.y-s.groundY;
    s.cameraX=p.x-s.width*GRIM_CONFIG.reaperXRatio;
    s.speed=GRIM_CORE.runSpeed(s.distance);
    s.syncWorldScroll();
    s.coins=[];s.souls=[];s.enemies=[];s.obstacles=[];
    s.nextVendorNumber=Math.floor(s.distance/666)+1;
    s.nextEncounterX=s.nextSnapSpawnX=s.nextGroundSpawnX=s.nextEnemySpawnX=Infinity;
    let target,windup=null,frame=0,warning=null,release=null,damage=null,stale=0;
    const costs=[];
    if(plant){
      target={type:'snappingBramble',x,y:s.terrain.groundAt(x)-62,width:62,height:62,variant:0};
      s.obstacles.push(target);s.makeTip(target.type,target);
    }else{
      s.gunUnlocked=true;s.gunCooldownMs=0;s.hasTeleported=true;s.ui.showGun(true);
      if(!s.trySpawnCombat(x,kind))throw Error('invalid '+kind+' fixture');
      target=s.enemies[0];
    }
    window.approach=(frames,distance)=>{
      while(frame<frames&&(distance===null||target.x-p.x>distance)){
        const start=performance.now();
        s.update(0,1000/60);game.step(performance.now(),0);
        costs.push(performance.now()-start);
        if(warning===null&&(target.warningMs>0||target.mode==='telegraph'))warning=frame;
        if(release===null&&(s.fireballs.length||target.mode==='dive'))release=frame;
        if(damage===null&&p.hp<3)damage=frame;
        if(!target.dead&&target.warningMs>0&&target.x-p.x<=90)stale++;
        if(windup===null&&target.plantState==='windup')windup=frame;
        frame++;
      }
      const times=costs.slice().sort((a,b)=>a-b);
      return {frame,windup,warning,release,damage,stale,p95:times[Math.floor(times.length*.95)],
        enemyHp:target.hp,hp:p.hp,dead:!!(target.destroyed||target.dead),tip:s.tipped.has('snappingBramble')};
    };
  };
}
