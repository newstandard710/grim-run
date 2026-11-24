() => {
 const s=S, cases=[];
 // Replay exact generated tuck gate on seed 33. Offset tests vary just one
 // held-input event. Ground movement, gap and collisions use the game code.
 start(33);
 const target=s.obstacles.filter(o=>o.type==='tuckGate').sort((a,b)=>a.x-b.x)[0].x;
 for(let delay=-1;delay<=100;delay+=delay===-1?1:2){
  start(33);
  const o=s.obstacles.find(o=>o.type==='tuckGate'&&o.x===target);
  const gap=s.terrain.segments.find(z=>z.kind==='gap'&&z.start<=o.x&&z.end>o.x);
  let x=gap.start-182,p=s.player;p.x=x;p.y=s.terrain.groundAt(x)??s.terrain.anchorAt(x);
  s.distance=(x-200)/12;s.speed=GRIM_CORE.runSpeed(s.distance);s.hasTeleported=true;
  s.obstacles=[o];s.coins=[];s.souls=[];s.enemies=[];s.nextEncounterX=s.nextEnemySpawnX=s.nextGroundSpawnX=s.nextSnapSpawnX=1e9;
  s.cameraX=x-s.width*.32;s.cameraY=p.y-s.groundY;
  let launch=null,cue=null,pass=false;
  for(let f=0;f<220;f++){
   if(cue===null&&o.x<=s.cameraX+s.width)cue=f;
   if(launch===null&&p.x>=gap.start-58){s.jump();launch=f;}
   if(cue!==null && delay>=0 && f===cue+delay)s.startSlide();
   step();
   if(p.hp<3||s.state!=='playing')break;
   if(p.x>gap.end+55&&p.grounded){pass=true;break;}
  }
  cases.push({action:'tuck',seed:33,meters:Math.round((o.x-200)/12),delay,cue,launch,pass});
 }
 // Isolated airborne target. Attach the real Bat as in encounter tests,
 // sweep manual shot timing and count a kill before contact or escape.
 for(let delay=-1;delay<=276;delay+=delay===-1?1:2){
  start(33); const p=s.player;
  s.gunUnlocked=true;s.gunCooldownMs=0;
  p.x=200+5500*12;p.y=s.terrain.groundAt(p.x)??s.terrain.anchorAt(p.x);s.distance=5500;s.speed=425;s.cameraY=p.y-s.groundY;s.hasTeleported=true;s.nextVendorNumber=9;s.obstacles=[];s.coins=[];s.souls=[];
  s.nextEncounterX=s.nextEnemySpawnX=s.nextGroundSpawnX=s.nextSnapSpawnX=1e9;
  const e={kind:'bat',x:p.x+s.width*.68-24,y:p.y-74,baseY:p.y-74,hp:1,dead:false,visibleMs:0,phase:0,mode:"glide",timer:0};
  s.enemies=[e];let fire=null,hit=null;
  for(let f=0;f<340;f++){
   if(f===delay)fire=s.fireCrossbow();
   step();if(e.dead){hit=f;break;}if(e.x<p.x-45||p.hp<3)break;
  }
  cases.push({action:'crossbow',delay,fire,hit,pass:hit!==null});
 }
 return cases;
}
