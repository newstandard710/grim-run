// The course owns this frame. The normal game has no dependency on this script.
const frame = document.querySelector('iframe');
const menu = document.querySelector('main');
const result = document.querySelector('#result');
const start = menu.querySelector('button');
const seed = new URLSearchParams(location.search).get('seed') === '7' ? 7 : 33;
const burnMs = 700;
let w, scene, trial, cue;

function runway(s) {
  for (let m = 120; m < 620; m += 4) {
    const x = s.startX + m * w.GRIM_CONFIG.pxPerMeter;
    if (w.GRIM_CORE.intersectsVendorCorridor(x-680, 3460, s.startX)) continue;
    let clear = true;
    for (let d = -680; d < 2780; d += 12) {
      if (s.terrain.groundAt(x+d) === null) { clear = false; break; }
    }
    if (clear) return x;
  }
  throw Error('Could not find a clear approach on this seed.');
}

function createWeb(x) {
  const web = {type:'bramble', silk:true, x, y:scene.terrain.groundAt(x)-97,
    width:62, height:97, destroyed:false, dealtDamage:false};
  scene.obstacles.push(web);
  return web;
}

function begin() {
  trial = null;
  const s = scene;
  if (s.startRun() === false) throw Error('Reload the course to restore the game artwork.');
  const x = runway(s), p = s.player;
  p.x = x-650; p.y = s.terrain.groundAt(p.x); p.openingGateX = -1;
  s.distance = (p.x-s.startX)/w.GRIM_CONFIG.pxPerMeter;
  s.speed = w.GRIM_CORE.runSpeed(s.distance);
  s.cameraX = p.x-s.width*w.GRIM_CONFIG.reaperXRatio; s.cameraY = p.y-s.groundY;
  s.syncWorldScroll();
  s.nextEncounterX = s.nextEnemySpawnX = s.nextGroundSpawnX = s.nextSnapSpawnX = Infinity;
  s.nextVendorNumber = Math.floor(s.distance/666)+1;
  s.teleportUsed = true; s.obstacles = []; s.coins = []; s.souls = []; s.soulPlatform = [];
  s.gunUnlocked = true; s.gunCooldownMs = 0;
  // The same ordinary two-damage shot and one-second recharge anchor both runs.
  s.powerManager.apply('powerShot',p,()=>{},1);
  s.ui.showGun(true); s.ui.showGunCooldown(0); s.tipped.add('branch');
  const web = createWeb(x), pair = createWeb(x+1650);
  s.placeEncounter('branch',x+2350);
  const branch = s.obstacles.find(ob=>ob.type==='branch');
  if (!branch) throw Error('The course overhang could not be placed.');
  trial = {ammo:menu.querySelector(':checked').value, web, pair, branch,
    crawlerX:x+695, crawler:null, bat:null, burnLeft:0, done:false};
  menu.hidden = true; cue.hidden = false; frame.focus(); s.drawScene();
}

function finish(reason) {
  if (!trial || trial.done) return;
  trial.done = true;
  scene.state = 'courseEnd'; scene.ui.releaseAll(); scene.ui.setMode('courseEnd');
  cue.hidden = true;
  const {web,crawler,pair,bat,branch} = trial, x=scene.player.x;
  const outcomes = [];
  function reportWeb(label, ob) {
    if (ob.dealtDamage) outcomes.push(label+' hit'+(ob.clear?' then '+ob.clear:''));
    else if (ob.clear) outcomes.push(label+' '+ob.clear);
    else if (x>ob.x+ob.width) outcomes.push(label+' cleared');
  }
  function reportEnemy(label, enemy) {
    if (!enemy) return;
    if (enemy.contactDone) outcomes.push(label+' hit you');
    else if (enemy.dead) outcomes.push(label+' defeated');
    else if (x>enemy.x+50) outcomes.push(label+' passed');
  }
  reportWeb('First web',web);
  reportEnemy('Crawler',crawler);
  reportEnemy('Bat',bat);
  reportWeb('Second web',pair);
  if (branch.dealtDamage || x>branch.x+branch.width)
    outcomes.push(branch.dealtDamage?'Overhang hit':'Overhang cleared');
  const health=scene.player.hp+' / '+scene.player.maxHp+' HP';
  result.textContent = [reason,health,...outcomes].join(' · ')+'.';
  result.hidden = false; start.textContent = 'Replay course'; menu.hidden = false; start.focus();
}

function spawn(x,kind) {
  if (!scene.trySpawnCombat(x,kind)) throw Error('Course '+kind+' could not enter.');
  return scene.enemies[scene.enemies.length-1];
}

function remainingTarget(target) {
  if (target || trial.ammo !== 'flame') return target;
  const left = scene.player.x-scene.width*w.GRIM_CONFIG.reaperXRatio;
  return w.GRIM_COMBAT.pickTarget([], [trial.web,trial.pair], scene.player.x,
    left, left+scene.width, w.GRIM_COMBAT.OBSTACLE_BOLT_RANK, 0);
}

function drawWeb(web) {
  const g = scene.world, x = web.x, y = web.y, cx = x+30, cy = y+47;
  if (x+web.width<scene.cameraX || x>scene.cameraX+scene.width) return;
  const rim = [[0,10],[27,2],[60,0],[61,53],[58,96],[28,92],[2,96],[4,53]];
  g.lineStyle(4,0x514541,1); g.lineBetween(x,y+4,x+2,y+97); g.lineBetween(x+59,y,x+62,y+97);
  g.fillStyle(0x433b49,.48);
  g.fillTriangle(x,y+10,x+60,y,x+58,y+96); g.fillTriangle(x,y+10,x+58,y+96,x+2,y+96);
  g.lineStyle(2,0xf8ddba,.92);
  for (const [dx,dy] of rim) g.lineBetween(cx,cy,x+dx,y+dy);
  for (const r of [.32,.62,.9]) {
    g.beginPath();
    for (let i=0;i<=rim.length;i++) {
      const [dx,dy] = rim[i%rim.length];
      const px=cx+(dx-30)*r, py=cy+(dy-47)*r;
      if (i===0) g.moveTo(px,py); else g.lineTo(px,py);
    }
    g.strokePath();
  }
}

function drawFeedback() {
  const s=scene, t=trial, g=s.world, p=s.player;
  if (t.ammo==='flame') {
    for (const bolt of s.bullets) {
      g.fillStyle(0xf47933,.85); g.fillCircle(bolt.x,bolt.y,7);
      g.fillStyle(0xffe4a5); g.fillCircle(bolt.x,bolt.y,3);
    }
  }
  if (t.burnLeft>0 && !t.crawler.dead) {
    const e=t.crawler, h=10+5*Math.sin(s.elapsed*26);
    g.fillStyle(0xff853b,.94); g.fillTriangle(e.x-12,e.y-28,e.x-5,e.y-44-h,e.x+9,e.y-31);
    g.fillStyle(0xffdf91); g.fillTriangle(e.x-7,e.y-29,e.x-4,e.y-39-h/2,e.x+3,e.y-29);
  }
  const left=p.x-s.width*w.GRIM_CONFIG.reaperXRatio;
  const target=remainingTarget(w.GRIM_COMBAT.pickTarget(s.enemies,s.obstacles,p.x,left,left+s.width,
    s.powerManager.level('powerShot'),0));
  const label=target ? (target.ref.silk?'Web':target.ref.kind==='bat'?'Bat':'Crawler') : null;
  let hint;
  if (label) hint='Aim · '+label;
  else if (!t.web.destroyed && p.x<t.web.x) hint=t.ammo==='flame'?'Web ahead':'Web · Cut';
  else if (!t.crawler || (!t.crawler.dead && p.x<t.crawler.x)) hint='Crawler ahead';
  else if (p.x<t.pair.x && !t.pair.destroyed) hint='Bat + web · Cut the silk';
  else hint='Solid overhang · Slide';
  if (cue.textContent!==hint) cue.textContent=hint;
}

function install() {
  w = frame.contentWindow; scene = w.grimRun?.scene.scenes[0];
  if (!scene?.ui || !scene.motionArt?.cutWeaponReady) {
    if (w.document.querySelector('#error:not(.hidden),#reaction-load-error:not(.hidden),#portal-art-load-error:not(.hidden)'))
      throw Error('Game artwork failed to load. Reload to try again.');
    setTimeout(load,50); return;
  }
  const s=scene, doc=w.document, memory=new Map();
  Object.defineProperty(w,'localStorage',{value:{
    getItem:key=>memory.get(key)??null, setItem:(key,value)=>memory.set(key,String(value)),
    removeItem:key=>memory.delete(key)
  }});
  s.meta=w.GRIM_META.normalize({});
  cue=doc.createElement('div'); cue.hidden=true;
  cue.style.cssText='position:absolute;left:50%;top:clamp(82px,22%,160px);transform:translateX(-50%);padding:3px 8px;border-radius:4px;background:#171c24e8;color:#fff0d2;white-space:nowrap;font:600 13px system-ui;pointer-events:none';
  doc.querySelector('#hud').append(cue);
  doc.querySelector('#god-mode-checkbox').closest('label').style.display='none';
  doc.querySelector('#god-mode-checkbox').disabled=true;
  doc.querySelector('.god-mode-desc').hidden=true;
  doc.querySelector('#quit-btn').textContent='Return to ammunition';
  doc.querySelector('#quit-btn').addEventListener('click',event=>{
    event.stopImmediatePropagation(); finish('Trial stopped');
  },true);
  const shoot=s.fireSoulcaster.bind(s), hit=s.hitEnemy.bind(s), update=s.updateCombat.bind(s);
  const draw=s.drawObstacle.bind(s), destroy=s.destroyObstacle.bind(s), combat=s.drawCombat.bind(s);
  const hazards=s.checkHazards.bind(s), die=s.die.bind(s);
  s.drawObstacle=ob=>ob.silk ? drawWeb(ob) : draw(ob);
  s.destroyObstacle=(ob,box)=>{
    if (!ob.silk) return destroy(ob,box);
    if (ob.destroyed) return false;
    ob.destroyed=true; ob.clear=box?'cut':'burned';
    if (!box) { w.GRIM_ACTION_AUDIO.play('cut'); s.puff(ob.x+30,ob.y+45,0xff984b,12); }
    return true;
  };
  s.fireSoulcaster=target=>{
    if (!trial || trial.done) return shoot(target);
    shoot(remainingTarget(target));
    if (trial.ammo==='flame') s.bullets[s.bullets.length-1].damage=1;
  };
  s.hitEnemy=(enemy,damage,fromGun=false)=>{
    hit(enemy,damage,fromGun);
    if (trial && enemy===trial.crawler && fromGun && trial.ammo==='flame' && !enemy.dead && !trial.burnLeft)
      trial.burnLeft=burnMs;
  };
  s.updateCombat=(ms,dt)=>{
    if (!trial || trial.done) return update(ms,dt);
    if (!trial.crawler && s.player.x>=trial.crawlerX-360) {
      trial.crawler=spawn(trial.crawlerX,'crawler'); trial.crawler.hp=2;
    }
    if (!trial.bat && s.player.x>=trial.pair.x-360) trial.bat=spawn(trial.pair.x-176,'bat');
    if (trial.burnLeft>0) {
      trial.burnLeft=Math.max(0,trial.burnLeft-ms);
      if (!trial.burnLeft && !trial.crawler.dead) hit(trial.crawler,1);
    }
    update(ms,dt);
    if (trial.crawler?.dead) trial.burnLeft=0;
  };
  s.drawCombat=()=>{ combat(); if (trial && !trial.done) drawFeedback(); };
  s.checkHazards=()=>{ hazards(); if (trial && s.player.x>trial.branch.x+trial.branch.width+90) finish('Course complete'); };
  s.die=(...args)=>trial ? finish('Run ended') : die(...args);
  start.onclick=()=>{try { begin(); } catch(error) { showError(error); }};
  start.disabled=false; start.textContent='Start course';
}

function showError(error) {
  menu.hidden=false; result.hidden=false; result.textContent=error.message;
}
function load() { try { install(); } catch(error) { showError(error); } }
frame.addEventListener('load',load);
frame.src='../../index.html?seed='+seed;
