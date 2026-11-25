// A standalone review page hosts the unchanged game and uses its normal input,
// swept weapon contact, terrain, painter and damage handling for one encounter.
const params=new URLSearchParams(location.search);
const frame=document.querySelector('iframe'), replay=document.querySelector('button');
frame.src='../../index.html?seed='+encodeURIComponent(params.get('seed')||'33');
let scene, gameWindow, spider, next;
const clamp=t=>Math.max(0,Math.min(t,1));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
function setup(){
  const s=scene,p=s.player;
  // Select a continuous Caves runway away from vendors and steep ledge seams.
  let x=s.startX+5060*12;
  const floor=at=>s.terrain.groundAt(at);
  const safe=()=>{
    if(gameWindow.GRIM_CORE.intersectsVendorCorridor(x-610,1150,s.startX))return false;
    for(let d=-605;d<=535;d+=10)if(floor(x+d)===null)return false;
    for(let d=-55;d<=55;d+=5)if(Math.abs(floor(x+d)-floor(x))>8)return false;
    return true;
  };
  while(!safe() && x<s.startX+5920*12)x+=6;
  if(!safe())throw Error('No clear Spider runway for this seed');
  p.x=x-600;p.y=floor(p.x);s.distance=(p.x-s.startX)/12;
  s.speed=gameWindow.GRIM_CORE.runSpeed(s.distance);s.hasTeleported=true;
  s.cameraX=p.x-s.width*gameWindow.GRIM_CONFIG.reaperXRatio;s.cameraY=p.y-s.groundY;s.syncWorldScroll();
  s.nextVendorNumber=Math.floor(s.distance/666)+1;
  s.nextEncounterX=s.nextSnapSpawnX=s.nextGroundSpawnX=s.nextEnemySpawnX=Infinity;
  s.obstacles=[];s.enemies=[];s.souls=[];s.coins=[];
  // Suppress wallet rewards on this isolated replay.
  s.teleportUsed=true;
  next=null;
  if(params.get('pair')==='1'){
    s.placeEncounter('rock',x+335);
    next=s.obstacles.find(o=>o.type==='rock');
  }
  spider={x,y:0,floor:floor(x),phase:'perched',clock:0,dead:false,hit:false,fold:0,alpha:1};
  replay.hidden=true;
  update(0);
}
function body(){return {x:spider.x-16,y:spider.y-12,width:32,height:24}}
function update(ms){
  const a=spider,s=scene,lead=a.x-s.player.x;
  if(a.dead){a.alpha=Math.max(0,a.alpha-ms/170);return}
  const perch=Math.min(a.floor-110,Math.max(a.floor-218,s.cameraY+43));
  const low=a.floor-68;
  const warningLead=Math.min(s.speed*.94,s.width*(1-gameWindow.GRIM_CONFIG.reaperXRatio)-46);
  // Spend the same fraction of visible approach on the windup and descent in portrait.
  const approachMs=1000*warningLead/s.speed;
  const windup=Math.min(240,approachMs*.255), drop=Math.min(235,approachMs*.25);
  if(a.phase==='perched' && lead<=warningLead){
    a.phase='warn';a.clock=0;gameWindow.GRIM_ACTION_AUDIO?.play('silk');
  }
  a.clock+=ms;
  if(a.phase==='warn' && a.clock>=windup){a.phase='drop';a.clock-=windup}
  if(a.phase==='drop' && a.clock>=drop){a.phase='hang';a.clock=0}
  if(a.phase==='hang' && lead < -47){a.phase='climb';a.clock=0}
  a.fold=a.phase==='warn'?smooth(a.clock/(windup*.75)):a.phase==='drop'?1-smooth(a.clock/drop):0;
  const lowered=a.phase==='warn'?5*smooth(a.clock/windup):0;
  a.y=a.phase==='drop'?perch+5+(low-perch-5)*smooth(a.clock/drop):
    a.phase==='hang'?low:a.phase==='climb'?low+(perch-low)*smooth(a.clock/550):perch+lowered;
}
function paint(){
  const s=scene,a=spider,g=s.world,x=a.x,y=a.y,alpha=a.alpha;
  const top=s.cameraY;
  if(alpha<=0||x<s.cameraX-55||x>s.cameraX+s.width+55)return;
  // A short mineral spur emerges from the ceiling. Its silk ends at the abdomen.
  g.fillStyle(0x34334b,1);g.fillTriangle(x-28,top-1,x+21,top-1,x+2,top+24);
  g.fillStyle(0x74657d,.9);g.fillTriangle(x-14,top,x-4,top+6,x+2,top+24);
  g.lineStyle(2,0xd6cdde,.76);g.lineBetween(x+2,top+22,x,a.dead?top+37:y-10);
  if(a.dead)return;
  for(const side of [-1,1])for(let leg=0;leg<4;leg++){
    const stride=Math.sin(a.clock*.012+leg*1.7+side)*1.6*(1-a.fold);
    const kneeX=x+side*(18+leg*2.8-a.fold*8), kneeY=y-20+leg*7+stride;
    const ankleX=x+side*(30+leg*2-a.fold*13), ankleY=y-17+leg*8+stride;
    const toeX=ankleX+side*(4-leg*.7),toeY=ankleY+7-a.fold*4;
    g.lineStyle(3.5,0x28202a,1);g.beginPath();g.moveTo(x+side*7,y+leg-2);
    g.lineTo(kneeX,kneeY);g.lineTo(ankleX,ankleY);g.lineTo(toeX,toeY);g.strokePath();
    g.lineStyle(1.6,0xb29987,1);g.lineBetween(x+side*8,y+leg-3,kneeX,kneeY-1);
    g.lineStyle(1.2,0x8e7979,1);g.lineBetween(kneeX,kneeY-1,ankleX,ankleY);
    g.fillStyle(0xc6af93);g.fillEllipse(kneeX,kneeY,3,2);
  }
  // Layer the domed abdomen over the leg roots. Its split dorsal stripe reads during the drop.
  g.fillStyle(0x201a23);g.fillEllipse(x+2,y-4,34,26);
  g.fillStyle(0x62525c);g.fillEllipse(x+1,y-6,29,20);
  g.fillStyle(0x473440);g.fillEllipse(x+2,y-4,25,16);
  for(const side of [-1,1]){
    g.fillStyle(0xb88671);g.fillTriangle(x+side*11,y-12,x+side*3,y-9,x+side*5,y-3);
    g.fillStyle(0x99828a);g.fillTriangle(x+side*12,y-5,x+side*8,y-2,x+side*10,y+1);
    g.fillStyle(0x382c37);g.fillTriangle(x+side*6,y+8,x+side*4,y+15,x+side*2,y+10);
  }
  g.fillStyle(0x312631);g.fillEllipse(x-2,y+5,20,15);
  g.fillStyle(0x71585c);g.fillEllipse(x-3,y+2,14,5);
  g.fillStyle(0xe8bf84);for(const dx of [-7,-4,0,3])g.fillCircle(x+dx,y+6,1.35);
}
// Keep the prototype voice in the preview, including the game's mute and pause rules.
function installSilkAudio(w){
  const bus=w.GRIM_ACTION_AUDIO,play=bus.play.bind(bus),setPlaying=bus.setPlaying.bind(bus);
  const toggle=w.document.querySelector('#mute-actions');
  let ctx,voice,playing=false;
  const stop=()=>{if(voice){voice.stop();voice=null}};
  const unlock=()=>{
    const Audio=w.AudioContext||w.webkitAudioContext;
    if(toggle.checked||!Audio)return;
    try{ctx??=new Audio();if(ctx.state==='suspended')ctx.resume().catch(()=>{})}catch{}
  };
  w.document.addEventListener('pointerup',unlock,true);
  w.document.addEventListener('keydown',unlock,true);
  toggle.addEventListener('change',()=>{if(toggle.checked)stop();else unlock()});
  w.document.addEventListener('visibilitychange',()=>{if(w.document.hidden)stop()});
  bus.setPlaying=value=>{playing=value;if(!value)stop();setPlaying(value)};
  bus.play=name=>{
    if(name!=='silk'){play(name);return}
    if(!playing||toggle.checked||w.document.hidden||ctx?.state!=='running')return;
    stop();
    const osc=ctx.createOscillator(),gain=ctx.createGain(),now=ctx.currentTime;
    osc.type='triangle';osc.frequency.setValueAtTime(730,now);
    osc.frequency.exponentialRampToValueAtTime(240,now+.105);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.065,now+.008);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.12);
    osc.connect(gain);gain.connect(ctx.destination);voice=osc;
    osc.onended=()=>{osc.disconnect();gain.disconnect();if(voice===osc)voice=null};
    osc.start(now);osc.stop(now+.125);
  };
}
function install(){
  gameWindow=frame.contentWindow;
  scene=gameWindow.grimRun?.scene.scenes[0];
  if(!scene?.ui){setTimeout(install,25);return}
  installSilkAudio(gameWindow);
  const s=scene, original=s.startRun.bind(s);
  s.startRun=()=>{original();setup();s.drawScene()};
  const plants=s.updatePlants.bind(s),combat=s.drawCombat.bind(s),cut=s.cutNearby.bind(s),hazards=s.checkHazards.bind(s);
  s.updatePlants=ms=>{plants(ms);if(spider&&params.get('control')!=='1')update(ms)};
  s.drawCombat=()=>{combat();if(spider&&params.get('control')!=='1')paint()};
  s.cutNearby=root=>{
    cut(root);
    if(!spider||spider.dead||params.get('control')==='1')return;
    const hit=s.motionArt?.rising?.contactTest(root);
    const core=gameWindow.GRIM_CORE;
    const boxes=s.motionArt?.attackBoxes(s.player.previousAttackMs)??[core.attackBox(s.player.x,s.feetY,126*s.powerManager.attackBonus(),s.lowProfile)];
    const target=body();
    if(hit?hit(target):boxes.some(b=>core.overlaps(b,target))){
      spider.dead=true;s.puff(spider.x,spider.y,0xe8b5ae,9);
      gameWindow.GRIM_ACTION_AUDIO.play('defeat');
    }
  };
  s.checkHazards=()=>{
    hazards();
    if(!spider)return;
    if(s.player.x>spider.x+(next?500:140))replay.hidden=false;
    if(params.get('control')==='1'||spider.dead||spider.hit||s.player.invulMs>0)return;
    const p=s.player,core=gameWindow.GRIM_CORE;
    if(core.overlaps(core.collisionBox(p.x,s.feetY,s.lowProfile),body())){
      spider.hit=true;p.invulMs=gameWindow.GRIM_CONFIG.damageInvulnerabilityMs;s.takeDamage(1,'spider');
    }
  };
  replay.onclick=()=>s.startRun();
}
frame.addEventListener('load',install);
