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
  function prepare(spec) {
    history.replaceState(null,'','?seed=' + (spec.seed ?? 33));
    s.startRun();
    game.loop.sleep();
    skin = window.GRIM_OBSTACLE_SPRITES.find(item => item.id === spec.id);
    const type = familyTypes[skin.category];
    s.terrain.advance((spec.x ?? s.startX + centers[skin.biome]*C.pxPerMeter) + 3600);
    const x = spec.x ?? galleryPosition(type);
    const ground = s.terrain.groundAt(x);
    obstacle = type === 'tuckGate' ? s.obstacles.find(o => o.type === type && Math.abs(o.x-x) < .01) :
      window.GRIM_CORE.obstacle(type,x,ground,spec.variant ?? 0,C.slideClearancePx,s.height);
    if (!obstacle || s.obstacleSkinFor(obstacle)?.id !== skin.id) throw Error('Seed/skin mismatch: '+skin.id+' at '+x);
    gap = type === 'tuckGate' ? s.terrain.sectionAt(x) : null;
    if (gap && gap.kind !== 'gap') throw Error('Gate requires a generated gap');
    const approach = spec.gallery ? Math.min(140,s.width*.24) : Math.min(300,s.width*.47);
    let entry = x - approach;
    while (s.terrain.groundAt(entry) === null) entry -= 5;
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
    s.coins = s.coins.filter(c => Math.abs(c.x-x) < 1500);
    s.souls = s.souls.filter(c => Math.abs(c.x-x) < 1500);
    for (const tip of s.tips) tip.label.destroy();
    s.tips = [];
    s.tipped = new Set(['rock','fire','bramble','branch','tuckGate','airBramble','abyss']);
    s.ui.setMode('playing');
    s.refreshHud();
    s.cameraX = entry - s.width*C.reaperXRatio;
    s.cameraY = s.player.y - s.groundY;
    s.syncWorldScroll();
    s.biomeMidground?.prioritizeTeleport(s.distance);
    s.drawScene();
    render();
    inputSent = false; tick = 0; firstCut = null; firstHit = null; airTucked = false;
    return {x, type, skin:skin.id, entry, seed:s.seed,
      weights:window.GRIM_WORLD_ART.biomeWeights((x-s.startX)/C.pxPerMeter)};
  }
  function ready() {
    s.drawScene(); render();
    const weights = window.GRIM_WORLD_ART.biomeWeights(s.distance);
    return s.biomeBackdropReady && s.terrainMaterialIds.has(skin.biome) &&
      Object.keys(weights).every(id => id === 'forest' || s.biomeMidground.stream.loaded.has(id));
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
    let changed = 0;
    for (let p=0;p<shown.length;p+=4)
      if (Math.abs(shown[p]-hidden[p])+Math.abs(shown[p+1]-hidden[p+1])+Math.abs(shown[p+2]-hidden[p+2])>15) changed++;
    if (changed < 25) throw Error('Foreground absent from real pixels: '+skin.id+' '+changed);
    if (skin.supportKey && !(support?.visible && support.depth > s.abyssFallback.depth && support.depth < front.depth))
      throw Error('Incorrect support visibility/depth: '+skin.id);
    if (skin.backKey && !(back?.visible && support.depth < back.depth && back.depth < front.depth))
      throw Error('Incorrect upper backing depth: '+skin.id);
    return {changed, depths:[support?.depth,back?.depth,front.depth], size:[front.displayWidth,front.displayHeight],
      mountedFeet:support?.mountFeet?.map(p=>p.y-s.terrain.groundAt(p.x)), masked:!!front.mask};
  }
  function step(action = true) {
    const dx = obstacle.x - s.player.x;
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
  function cleanup() {
    s.obstacles=[];s.drawScene();
    const leaked=Object.keys(s.textures.list).filter(k=>k.startsWith('obstacle-mounted-')||k.startsWith('obstacle-registered-'));
    if (leaked.length) throw Error('Leaked obsolete art: '+leaked.join(', '));
  }
  window.obstacleReview={prepare,ready,inspect,step,signature,image,cleanup,render,
    get result(){return {firstCut,firstHit,airTucked,inputSent,passed:s.player.x>obstacle.x+obstacle.width};}};
})();
