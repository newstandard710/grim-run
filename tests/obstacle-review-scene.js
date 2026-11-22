// Browser-only fixture, loaded by the Chromium reviews after the public Start controls.
(() => {
  'use strict';
  const game = window.grimRun, s = game.scene.scenes[0], C = window.GRIM_CONFIG;
  const familyTypes = {slide:'branch', cut:'bramble', 'air-tuck':'tuckGate', jump:'rock', fire:'fire'};
  const centers = {forest:405, foothills:1500, tundra:3500, caves:5500,
    crystals:6500, ashlands:7500, lava:8500, boss:11000};
  let obstacle, skin, gap, inputSent, tick, firstCut, firstHit, airTucked;
  let renderTime = 0;
  clearInterval(s.loopWatchdogId);
  s.sys.sceneUpdate = () => {};
  game.loop.sleep();

  function render() {
    game.step(renderTime += 1000 / 60, 0);
  }
  function galleryPosition(type) {
    const start = s.startX + centers[skin.biome] * C.pxPerMeter;
    for (let x = start; x < start + 2400; x += 1) {
      if (s.terrain.canPlace(x,74) && s.terrain.groundAt(x-110) !== null &&
          s.obstacleSkinFor({type,x})?.id === skin.id) return x;
    }
    throw Error('No legal gallery position for ' + skin.id);
  }
  let galleryWorld;
  function prepare(spec) {
    const seed=spec.seed??33;
    history.replaceState(null,'','?seed='+seed);
    // The static gallery moves around one course. Restarting between skins
    // briefly loads Forest and aborts legitimate in-flight scenery requests.
    if(!spec.gallery || galleryWorld?.seed!==seed){
      s.startRun();
      galleryWorld=spec.gallery?{seed,coins:s.coins,souls:s.souls}:null;
    }
    game.loop.sleep();
    skin = window.GRIM_OBSTACLE_SPRITES.find(item => item.id === spec.id);
    const type = familyTypes[skin.category];
    s.terrain.advance((spec.x ?? s.startX + centers[skin.biome]*C.pxPerMeter) + 3600);
    const x = spec.x ?? galleryPosition(type);
    const ground = s.terrain.groundAt(x);
    obstacle = type === 'tuckGate' ? s.obstacles.find(o => o.type === type && Math.abs(o.x-x) < .01) :
      window.GRIM_CORE.obstacle(type,x,ground,spec.variant ?? 0,C.slideClearancePx,s.height);
    if (spec.slideSkin && obstacle) obstacle.slideSkin=spec.slideSkin;
    if (!obstacle || s.obstacleSkinFor(obstacle)?.id !== skin.id) throw Error('Seed/skin mismatch: '+skin.id+' at '+x);
    gap = type === 'tuckGate' ? s.terrain.sectionAt(x) : null;
    if (gap && gap.kind !== 'gap') throw Error('Gate requires a generated gap');
    const approach = spec.gallery ? Math.min(140,s.width*.24) : Math.min(type === 'rock' ? 154 : 300,s.width*.47);
    // Begin on the connected approach bank. A wider viewport can otherwise
    // select a previous gap, making the first takeoff occur at the wrong bank.
    const bank = gap ? gap.start - 1 : x;
    let entry = bank;
    const target = Math.min(bank - 8, x - approach);
    while (entry - 1 >= target && s.terrain.groundAt(entry - 1) !== null) entry--;
    // On the sharp Boss approach the lip initially sits above a short
    // landscape screen. Begin as it enters the playable camera view.
    const contactY = obstacle.y+obstacle.height;
    const lastEntry = gap ? Math.min(x-100,gap.start-28) : x-100;
    while (entry+1<lastEntry && s.terrain.groundAt(entry+1)!==null) {
      const screenY=contactY-s.terrain.groundAt(entry)+s.groundY;
      if (screenY>=60 && screenY<=s.height-20)break;
      entry++;
    }
    s.player.x = entry; s.player.y = s.terrain.groundAt(entry);
    s.distance = (entry-s.startX)/C.pxPerMeter;
    s.speed = window.GRIM_CORE.runSpeed(s.distance);
    s.hasTeleported = x >= s.terrain.portalX;
    s.shrineClaimed = true;
    s.godMode = skin.biome === 'boss';
    s.nextVendorNumber = Math.min(15,Math.floor(s.distance/C.vendorEveryMeters)+1);
    s.lastVendorNumber = s.nextVendorNumber-1;
    // Stage this generated encounter, then leave its ordinary movement and interaction paths live.
    s.nextEncounterX = x + 1800;
    s.nextEnemySpawnX = s.nextGroundSpawnX = s.nextSnapSpawnX = x + 2600;
    s.obstacles = [obstacle]; s.enemies = []; s.fireballs = []; s.bullets = [];
    s.coins = (galleryWorld?.coins??s.coins).filter(c => Math.abs(c.x-x) < 1500);
    s.souls = (galleryWorld?.souls??s.souls).filter(c => Math.abs(c.x-x) < 1500);
    for (const tip of s.tips) tip.label.destroy();
    s.tips = [];
    s.tipped = new Set(['rock','fire','bramble','branch','tuckGate','airBramble','abyss']);
    s.ui.setMode('playing');
    s.refreshHud();
    s.cameraX = entry - s.width*C.reaperXRatio;
    s.cameraY = s.player.y - s.groundY;
    s.syncWorldScroll();
    s.biomeMidground?.prioritizeTeleport(s.distance);
    const drawObstacle=s.drawObstacle;
    let mountMs=null;
    s.drawObstacle=function(o){
      if(o!==obstacle)return drawObstacle.call(this,o);
      const t=performance.now();
      try{return drawObstacle.call(this,o);}
      finally{mountMs=performance.now()-t;}
    };
    try{s.drawScene();}
    finally{s.drawObstacle=drawObstacle;}
    render();
    inputSent = false; tick = 0; firstCut = null; firstHit = null; airTucked = false;
    return {x, type, skin:skin.id, entry, seed:s.seed, mountMs,
      weights:window.GRIM_WORLD_ART.biomeWeights((x-s.startX)/C.pxPerMeter)};
  }
  function ready() {
    s.drawScene(); render();
    const weights = window.GRIM_WORLD_ART.biomeWeights(s.distance);
    return s.biomeBackdropReady && s.terrainMaterialIds.has(skin.biome) &&
      Object.keys(weights).every(id => id === 'forest' || s.biomeMidground.stream.loaded.has(id));
  }
  function diagnostics(){
    const stream=s.biomeMidground.stream;
    return {state:s.state,skin:skin.id,weights:window.GRIM_WORLD_ART.biomeWeights(s.distance),
      backdrop:s.biomeBackdropReady,materials:[...s.terrainMaterialIds],wanted:stream.wanted,
      loaded:[...stream.loaded.keys()],failed:[...stream.failed],pending:stream.pending?.id};
  }
  function inspect() {
    const front = s.obstacleSpriteObjects.get(obstacle);
    const support = s.obstacleSupportObjects.get(obstacle), back = s.obstacleBackObjects.get(obstacle);
    const cam = s.cameras.main;
    if (!cam.visible || s.state !== 'playing' || !front?.visible || s.tips.length)
      throw Error('Encounter is hidden or labels visible: '+skin.id);
    const home = document.querySelector('#home-screen');
    if (home && home.getBoundingClientRect().width && getComputedStyle(home).visibility !== 'hidden' &&
        getComputedStyle(home).display !== 'none' && Number(getComputedStyle(home).opacity) > .05)
      throw Error('Home is covering '+skin.id);
    // Read actual composited pixels. State checks alone previously let 24 Home captures pass.
    const sample = document.createElement('canvas');
    sample.width = game.canvas.width; sample.height = game.canvas.height;
    const ctx = sample.getContext('2d',{willReadFrequently:true});
    function read() {render();ctx.drawImage(game.canvas,0,0);return ctx.getImageData(0,0,sample.width,sample.height).data;}
    const shown = read(); front.setVisible(false);
    const hidden = read(); front.setVisible(true); render();
    function difference(other) {
      let count=0;
      for(let p=0;p<shown.length;p+=4)
        if(Math.abs(shown[p]-other[p])+Math.abs(shown[p+1]-other[p+1])+Math.abs(shown[p+2]-other[p+2])>15)count++;
      return count;
    }
    const changed=difference(hidden);
    if(changed<25)throw Error('Foreground absent from real pixels: '+skin.id+' '+changed);
    let rearPixels,clearanceError,cacheMs;
    if(skin.landform){
      if(!(support?.visible && support.depth>s.abyssFallback.depth && support.depth<s.terrainBase.depth &&
        support.depth<s.actor.depth && s.actor.depth<front.depth && support.mountSource===skin.key))
        throw Error('Incorrect slide landform registration or depth: '+skin.id);
      support.setVisible(false);
      rearPixels=difference(read());
      support.setVisible(true);render();
      if(rearPixels<120)throw Error('Weight-bearing mass absent from real pixels: '+skin.id+' '+rearPixels);
      const paint=front.texture.getSourceImage(),w=paint.width,h=paint.height;
      const rgba=paint.getContext('2d').getImageData(0,0,w,h).data;
      const errors=[];
      for(let col=0;col<w;col++){
        const x=front.x+col+.5;
        if(x<obstacle.x+1||x>obstacle.x+obstacle.width-1)continue;
        let y=h-1;
        while(y>=0 && rgba[(y*w+col)*4+3]<96)y--;
        const clearance=GRIM_CORE.slideCeilingBottomAt(s.terrain.groundAt,x,C.slideClearancePx);
        errors.push(clearance-(front.y+y+1));
      }
      clearanceError=[Math.min(...errors),Math.max(...errors)];
      if(clearanceError[0]<-.1||clearanceError[1]>5)
        throw Error('Painted edge disagrees with collision: '+skin.id+' '+clearanceError);
      const bank=support.texture.getSourceImage(),ctx=bank.getContext('2d');
      // Check paint at the turf itself, independently of the two metadata anchors.
      for(const foot of support.mountFeet){
        const x=Math.floor(foot.x-support.x),y=Math.floor(s.terrain.groundAt(foot.x)-support.y);
        const patch=ctx.getImageData(x-2,y-2,5,5).data;
        if(!patch.some((alpha,i)=>i%4===3 && alpha>96))
          throw Error('Groundward mass leaves the tread: '+skin.id+' '+x+','+y);
      }
      const start=performance.now();
      for(let i=0;i<60;i++)s.drawObstacle(obstacle);
      cacheMs=(performance.now()-start)/60;
      if(s.obstacleSupportObjects.get(obstacle)!==support || s.obstacleSpriteObjects.get(obstacle)!==front)
        throw Error('Static landform rebuilt while running: '+skin.id);
    }
    if (skin.supportKey && !(support?.visible && support.depth > s.abyssFallback.depth && support.depth < front.depth))
      throw Error('Incorrect support visibility/depth: '+skin.id);
    if (skin.backKey && !(back?.visible && support.depth < back.depth && back.depth < front.depth))
      throw Error('Incorrect upper backing depth: '+skin.id);
    return {changed,rearPixels,clearanceError,cacheMs, depths:[support?.depth,back?.depth,front.depth], size:[front.displayWidth,front.displayHeight],
      mountedFeet:support?.mountFeet?.map(p=>p.y-s.terrain.groundAt(p.x)), masked:!!front.mask};
  }
  function step(action = true) {
    const dx = obstacle.x - s.player.x;
    if (!action && !inputSent && gap && gap.start-s.player.x <= 22) {s.jump();inputSent=true;}
    if (action && !inputSent) {
      if (obstacle.type === 'branch' && dx <= 80) {s.startSlide();inputSent=true;}
      if (obstacle.type === 'bramble' && dx <= 95) {s.attack();inputSent=true;}
      if (obstacle.type === 'tuckGate' && gap.start-s.player.x <= 22) {
        s.startSlide();s.endSlide();s.jump();inputSent=true;
      }
      if (['rock','fire'].includes(obstacle.type) && dx <= 100) {s.jump();inputSent=true;}
    }
    s.update(0,1000/60);
    tick++;
    if (obstacle.destroyed && firstCut===null) firstCut=tick;
    if (obstacle.dealtDamage && firstHit===null) firstHit=tick;
    airTucked ||= !!s.player.airTuck;
  }
  function signature() {
    const p=s.player;
    return [tick,s.state,p.x,p.y,p.grounded,p.velocityY,p.sliding,p.hp,p.attackMs,s.rng.state,
      s.distance,s.points,s.cameraX,s.cameraY,firstCut,firstHit,airTucked,
      s.obstacles.map(o=>[o.type,o.x,o.y,o.width,o.height,o.destroyed,o.dealtDamage]),
      s.nextEncounterX,s.nextVendorNumber,s.terrain.groundAt(p.x),s.fallCount];
  }
  function image() { render();return game.canvas.toDataURL('image/jpeg',.87).split(',')[1]; }
  // Play the seeded route with its own spawner, actors, rewards and state
  // transitions. Only skip drawing the stretches between review windows.
  const drawWorld=s.drawScene;
  function beginRoute(seed) {
    history.replaceState(null,'','?seed='+seed);
    s.drawScene=drawWorld;
    s.startRun();
    game.loop.sleep();
    s.godMode=true;
    for(const tip of s.tips)tip.label.destroy();
    s.tips=[];
    s.tipped=new Set(['rock','fire','bramble','branch','tuckGate','airBramble','snappingBramble','abyss']);
  }
  function routeStep() {
    if(s.state==='upgrade')s.leaveVendor();
    const next=s.terrain.segments.find(segment=>segment.kind==='gap' && segment.start>=s.player.x-5);
    if(s.player.grounded && next && next.start-s.player.x<=20)s.jump();
    s.update(0,1000/60);
  }
  function seekRoute(spec) {
    s.drawScene=()=>{};
    for(let i=0;i<180;i++) {
      routeStep();
      if(s.state!=='playing')continue;
      const o=s.obstacles.find(o=>!o.destroyed && o.x-s.player.x>=170 && o.x-s.player.x<=280 &&
        Math.abs((o.x-s.startX)/C.pxPerMeter-spec.m)<=spec.range &&
        (o.slideSkin ? spec.id.startsWith(s.obstacleBiomeFor(o)+'_slide_') &&
          s.obstacleSkinFor(o)?.id===o.slideSkin : s.obstacleSkinFor(o)?.id===spec.id));
      if(o){
        obstacle=o;skin=s.obstacleSkinFor(o);
        s.drawScene=drawWorld;
        s.drawScene();render();
        return {skin:skin.id,x:o.x,m:(o.x-s.startX)/C.pxPerMeter,playerX:s.player.x,
          weights:window.GRIM_WORLD_ART.biomeWeights((o.x-s.startX)/C.pxPerMeter),
          actors:s.enemies.filter(e=>Math.abs(e.x-s.player.x)<s.width).map(e=>e.kind),
          objects:s.obstacles.filter(b=>Math.abs(b.x-s.player.x)<s.width).map(b=>b.type),
          coins:s.coins.filter(c=>!c.taken && Math.abs(c.x-s.player.x)<s.width).length};
      }
      if(s.distance>spec.m+spec.range)throw Error('Natural encounter missed: '+spec.id+' at '+s.distance);
    }
    // Give the production streamer its normal camera progression between
    // recorded encounters, including prefetch as the next biome approaches.
    s.drawScene=drawWorld;s.drawScene();render();
    return null;
  }
  function routeFrame() {
    const states=[];
    for(let i=0;i<4;i++){
      routeStep();render();
      states.push([s.state,s.player.x,s.player.y,s.player.hp,s.rng.state,s.distance,s.points,
        s.nextEncounterX,obstacle.dealtDamage,s.enemies.map(e=>[e.kind,e.x,e.y,e.hp])]);
    }
    return {frame:image(),states};
  }
  function startPortal() {
    history.replaceState(null,'','?seed=35');
    s.startRun();
    game.loop.sleep();
    const x=s.terrain.portalX-12;
    s.terrain.advance(x+1600);
    const y=s.terrain.groundAt(x)??s.terrain.anchorAt(x);
    Object.assign(s.player,{x,y,grounded:true});
    s.distance=(x-s.startX)/C.pxPerMeter;
    s.speed=window.GRIM_CORE.runSpeed(s.distance);
    s.shrineClaimed=true;
    s.nextVendorNumber=Math.floor(s.distance/C.vendorEveryMeters)+1;
    s.cameraX=x-s.width*C.reaperXRatio;
    s.cameraY=y-s.groundY;
    s.syncWorldScroll();
    const states=[];
    for(let i=0;i<120;i++){
      s.update(0,1000/60);
      render();
      states.push([s.state,s.player.x,s.player.y,s.player.hp,s.distance,s.portalMs,s.rng.state]);
      if (s.hasTeleported && s.state==='playing') break;
    }
    if (!states.some(frame=>frame[0]==='portal') || s.state!=='playing' ||
        s.player.x!==s.terrain.portalExitX) throw Error('Portal destination missed');
    return states;
  }
  function exerciseMountLifecycle() {
    const w=s.width,h=s.height;
    const x=obstacle.x;
    const contacts=[];
    const style=game.scale.parent.style,previous=[style.width,style.height];
    for(const [width,height] of [[h,w],[w,h]]) {
      style.width=width+'px';style.height=height+'px';
      game.scale.getParentBounds();game.scale.resize(width,height);
      s.drawScene();render();
      const support=s.obstacleSupportObjects.get(obstacle);
      if(s.width!==width || !support?.mountFeet?.length)throw Error('Rotation lost the ground mount');
      const feet=support.mountFeet.map(p=>p.y-s.terrain.groundAt(p.x));
      if(feet.some(d=>Math.abs(d-13)>.001))throw Error('Rotated support left the tread');
      contacts.push(feet);
    }
    [style.width,style.height]=previous;
    game.scale.getParentBounds();game.scale.refresh();
    s.godMode=true;
    s.practicePowerLevels={...s.practicePowerLevels,deathsReversal:1};
    s.resetRewindHistory();s.captureRewind();
    for(let i=0;i<303;i++)s.update(0,1000/60);
    if(!s.rewind())throw Error('Gameplay rewind failed to start');
    for(let i=0;i<160 && s.state==='rewinding';i++)s.update(0,1000/60);
    obstacle=s.obstacles.find(o=>o.x===x && o.type==='branch');
    s.drawScene();render();
    if(s.state!=='playing'||!obstacle||!s.obstacleSpriteObjects.get(obstacle)?.visible ||
       !s.obstacleSupportObjects.get(obstacle)?.visible)throw Error('Visible mount missing after rewind');
    const geometry=[s.player.x,s.player.y,obstacle.x,obstacle.y,obstacle.width,obstacle.height];
    cleanup();
    return {contacts,geometry};
  }
  function cleanup() {
    s.obstacles=[];s.drawScene();
    const leaked=Object.keys(s.textures.list).filter(k=>k.startsWith('obstacle-mounted-')||k.startsWith('obstacle-registered-'));
    if (leaked.length) throw Error('Leaked obsolete art: '+leaked.join(', '));
  }
  window.obstacleReview={prepare,ready,diagnostics,inspect,step,signature,image,cleanup,render,startPortal,exerciseMountLifecycle,beginRoute,seekRoute,routeFrame,
    get result(){return {firstCut,firstHit,airTucked,inputSent,passed:s.player.x>obstacle.x+obstacle.width};}};
})();
