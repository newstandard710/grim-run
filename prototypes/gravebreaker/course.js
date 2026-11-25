// Host the ordinary game in its own preview frame. The normal game never loads this course.
const frame = document.querySelector('iframe');
const panel = document.querySelector('aside');
const start = panel.querySelector('button');
const seed = new URLSearchParams(location.search).get('seed') === '7' ? 7 : 33;
const windupMs = 210, recoveryEndMs = 665;
let w, scene, trial, controls, crawlerSprite, stoneSprite, charge, crawlerWarning;
const audio = name => w.GRIM_ACTION_AUDIO.play(name);

function chooseRunway(s) {
  const floor = x => s.terrain.groundAt(x);
  for (let m = 995; m < 2100; m += 2) {
    const x = s.startX + m * 12;
    if (w.GRIM_CORE.intersectsVendorCorridor(x - 530, 2070, s.startX)) continue;
    let clear = true;
    for (let d = -530; d <= 1540; d += 12) {
      if (floor(x + d) === null) { clear = false; break; }
    }
    if (clear && [0,590,1170].every(d => {
      const ground = floor(x + d);
      return [-140,-70,70,140].every(offset => Math.abs(floor(x+d+offset) - ground) < 16);
    })) return x;
  }
  throw Error('No suitable Foothills runway');
}

function setup() {
  const s = scene, p = s.player;
  const x = chooseRunway(s);
  p.x = x - 510; p.y = s.terrain.groundAt(p.x);
  s.distance = (p.x-s.startX)/12; s.speed = w.GRIM_CORE.runSpeed(s.distance);
  s.cameraX = p.x-s.width*w.GRIM_CONFIG.reaperXRatio; s.cameraY = p.y-s.groundY;
  s.syncWorldScroll(); s.nextVendorNumber = Math.floor(s.distance/666)+1;
  s.teleportUsed = true; p.openingGateX = -1;
  s.nextEncounterX = s.nextSnapSpawnX = s.nextGroundSpawnX = s.nextEnemySpawnX = Infinity;
  s.obstacles = []; s.coins = []; s.souls = []; s.enemies = [];
  s.tipped.add('abyss'); s.tipped.add('branch');
  s.placeEncounter('branch',x+1170);
  const wall = {x,y:s.terrain.groundAt(x)-59,width:49,height:59};
  const crawler = {x:x+590,y:s.terrain.groundAt(x+633)-58,width:86,height:58};
  trial = {wall,crawler,branch:s.obstacles[0],swing:null,done:false,spark:0};
  if (!trial.branch) throw Error('Missing overhang');
  panel.hidden = true; controls.classList.remove('pressed','recharging'); frame.focus();
  s.drawScene();
}

function heavy() {
  const s = scene, p = s.player;
  if (!trial || trial.done || s.state !== 'playing' || !p.grounded || s.lowProfile ||
      p.attackCooldownMs > 0 || trial.swing || s.practiceScale()===0) return;
  trial.swing = {age:0,released:false};
  s.motionArt.rising?.acceptCut();
  controls.classList.add('recharging');
}

function update(ms, releaseCut) {
  const a = trial.swing;
  if (!a) return;
  a.age += ms;
  if (!a.released) {
    const p = scene.player, config = w.GRIM_CONFIG;
    // Draw back through the first 42 ms of the painted swing over 210 ms of play.
    // Keep the blade's contact sweep closed until the forward stroke starts.
    const poseAge = 42*Math.min(1,a.age/windupMs);
    if (a.age >= windupMs) {
      a.released = true;
      p.attackCooldownMs = 0;
      releaseCut();
    }
    p.attackMs = config.attackDurationMs-poseAge;
    p.previousAttackMs = p.attackMs;
    p.attackCooldownMs = config.attackCooldownMs-poseAge;
  }
  if (a.age >= recoveryEndMs) { trial.swing = null; controls.classList.remove('recharging'); }
}

function finish() {
  if (trial.done) return;
  trial.done = true;
  scene.state = 'courseEnd'; scene.ui.setMode('courseEnd');
  scene.ui.releaseAll(); crawlerSprite.setVisible(false); stoneSprite.setVisible(false); charge.clear();
  const p = scene.player, {wall,crawler,branch} = trial;
  const results = [wall.broken ? 'Stone broken' : wall.hit ? 'Stone hit' : 'Stone cleared',
    crawler.staggered ? 'Crawler staggered' : crawler.hit ? 'Crawler hit' : 'Crawler cleared',
    branch.dealtDamage ? 'Overhang hit' : 'Overhang cleared'];
  panel.querySelector('h1').textContent = p.hp+' / '+p.maxHp+' HP';
  panel.querySelector('p').textContent = results.join(' · ');
  start.textContent = 'Replay course'; panel.hidden = false; start.focus();
}

function strike(previousRoot) {
  const s = scene;
  const sweep = s.motionArt?.rising?.contactTest(previousRoot);
  const boxes = sweep ? null : s.motionArt?.attackBoxes(s.player.previousAttackMs);
  const contact = sweep || (target => boxes?.some(box => w.GRIM_CORE.overlaps(box,target)));
  for (const target of [trial.wall,trial.crawler]) {
    if (target.broken || target.staggered || target.hit || target.swingId===s.swingSequence || !contact(target)) continue;
    target.swingId = s.swingSequence;
    if (!trial.swing?.released) {
      audio('impact'); trial.spark = s.elapsed+.09; continue;
    }
    if (target===trial.wall) target.broken = true;
    else { target.staggered = true; target.at = s.elapsed; }
    // Stack the game's low thud and falling tone on actual contact (both obey mute).
    audio('land'); audio('defeat');
    s.puff(target.x+target.width/2,target.y+16,0xe5b878,15);
  }
}

function check() {
  const s = scene, p = s.player;
  const box = w.GRIM_CORE.collisionBox(p.x,s.feetY,s.lowProfile);
  for (const target of [trial.wall,trial.crawler]) {
    if (target.broken || target.staggered || target.hit || p.invulMs>0 ||
        !w.GRIM_CORE.overlaps(box,target)) continue;
    target.hit = true;
    if (trial.swing) {
      trial.swing = null; p.attackMs=0; p.risingCut=null;
      controls.classList.remove('recharging');
    }
    p.invulMs = w.GRIM_CONFIG.damageInvulnerabilityMs;
    s.takeDamage(1,target===trial.wall?'cracked stone':'armored crawler');
  }
  if (p.x>trial.branch.x+trial.branch.width+100 || !p.hp) finish();
}

function paint() {
  const s = scene, g = s.world, a = trial.wall, b = trial.crawler;
  const x = a.x, y = a.y, base = y+a.height;
  stoneSprite.setPosition(x-5,base+2).setVisible(!a.broken);
  if (a.broken) {
    g.fillStyle(0x766c69); g.fillTriangle(x-8,base,x+6,base-9,x+13,base);
    g.fillTriangle(x+22,base,x+35,base-13,x+48,base);
  }
  // Give a narrow viewport advance notice while the Crawler is still offscreen.
  // The target's own armor takes over once the player is close enough to swing.
  const lead = (b.x - s.player.x) / s.speed;
  crawlerWarning.hidden = s.width >= s.height || lead > 1.25 || lead < .48 || b.hit || b.staggered;
  const fall = b.staggered ? Math.min(1,(s.elapsed-b.at)/.24) : 0;
  const pose = b.staggered ? 2 : Math.floor(s.elapsed*5)%4;
  crawlerSprite.setVisible(true).setFrame(pose).setPosition(b.x+b.width/2+fall*18,b.y+b.height)
    .setScale(.5,.5-fall*.24).setAngle(fall*10);
  charge.clear();
  const swing = trial.swing;
  if (swing && !swing.released) {
    const t = swing.age/windupMs, px=s.player.x-26, py=s.feetY-48;
    charge.lineStyle(2,0xffdc9a,.4+.6*t);
    charge.beginPath(); charge.arc(px,py,21-15*t,-2.9,.55); charge.strokePath();
    charge.lineBetween(px-21+t*10,py+12,px-7,py+6);
  }
  if (trial.spark>s.elapsed) {
    charge.lineStyle(3,0xffe1a9); charge.lineBetween(s.player.x+44,s.feetY-47,s.player.x+54,s.feetY-57);
  }
}

async function install() {
  w = frame.contentWindow;
  scene = w.grimRun?.scene.scenes[0];
  if (!scene?.ui || !scene.motionArt?.cutWeaponReady) {
    if (w.document.querySelector('#error:not(.hidden), #reaction-load-error:not(.hidden), #portal-art-load-error:not(.hidden)')) {
      throw Error('The game assets could not load. Reload the course to try again.');
    }
    setTimeout(()=>install().catch(showError),50);
    return;
  }
  const s=scene, doc=w.document;
  // Preview purchases, settings and deaths use a disposable wallet for this frame.
  const memory = new Map();
  try {
    if (w.localStorage.getItem('grimRun.actionSoundsMuted')==='1') memory.set('grimRun.actionSoundsMuted','1');
  } catch { /* Storage can be disabled in a private tab. */ }
  Object.defineProperty(w,'localStorage',{value:{
    getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)
  }});
  s.meta = w.GRIM_META.normalize({});
  const loadImage = path => new Promise((resolve,reject)=>{
    const img = new w.Image();
    img.onload=()=>resolve(img); img.onerror=()=>reject(Error('Could not load course artwork'));
    img.src=new URL(path,location.href).href;
  });
  const [armor,stone] = await Promise.all([loadImage('armored-crawler.webp'),loadImage('fault-stone.webp')]);
  s.textures.addImage('trial-fault-stone',stone);
  stoneSprite = s.add.image(0,0,'trial-fault-stone').setOrigin(0,1).setScale(.5).setDepth(3).setVisible(false);
  s.textures.addSpriteSheet('trial-armor',armor,{frameWidth:192,frameHeight:126});
  crawlerSprite = s.add.sprite(0,0,'trial-armor').setOrigin(.5,1).setDepth(3).setVisible(false);
  charge = s.add.graphics().setDepth(19);
  controls = doc.createElement('button');
  controls.className='action'; controls.id='heavy-btn'; controls.setAttribute('aria-label','Gravebreaker heavy strike');
  controls.append(doc.querySelector('#attack-btn .symbol').cloneNode(true));
  const label=doc.createElement('span');label.textContent='HEAVY';controls.append(label);
  controls.style.cssText='right:calc(var(--edge-right) + var(--action-size) + var(--control-gap));bottom:var(--right-bottom);width:calc(var(--action-size)*.84);height:calc(var(--action-size)*.84);border-color:#d7b888;background:linear-gradient(155deg,#64554a,#292534)';
  doc.querySelector('#controls').append(controls);
  crawlerWarning = doc.createElement('div');
  crawlerWarning.className = 'crawler-warning';
  crawlerWarning.hidden = true;
  crawlerWarning.setAttribute('role','status');
  crawlerWarning.textContent = 'Armored Crawler ahead';
  const warningStyle = doc.createElement('style');
  warningStyle.textContent = `
    .crawler-warning:not([hidden]) { position:absolute; right:max(12px,env(safe-area-inset-right));
      top:clamp(76px,23%,178px); display:flex; align-items:center; gap:7px; padding:3px 10px 3px 5px;
      pointer-events:none; background:#151820f0; border:1px solid #b29b76;
      border-radius:5px; color:#f6e7cb; font:600 13px/1.25 system-ui,sans-serif }
    .crawler-warning::before { content:""; width:40px; height:27px;
      background:url("${armor.src}") left bottom / 160px 27px no-repeat }`;
  doc.head.append(warningStyle);
  doc.querySelector('#controls').append(crawlerWarning);
  s.ui.bindAction('heavy-btn','heavy',heavy);
  doc.addEventListener('keydown',e=>{if(e.code==='KeyG' && !e.repeat)heavy()});
  const releaseCut = s.attack.bind(s);
  for (const name of ['attack','jump','startSlide','fireCrossbow']) {
    const action = s[name].bind(s);
    s[name] = (...args) => { if (!trial?.swing) return action(...args); };
  }
  const run = s.startRun.bind(s);
  s.startRun = () => { trial=null; crawlerSprite.setVisible(false);stoneSprite.setVisible(false);charge.clear(); if(run()!==false)setup(); };
  const plants = s.updatePlants.bind(s), cut = s.cutNearby.bind(s), hazards = s.checkHazards.bind(s), combat = s.drawCombat.bind(s);
  s.updatePlants = ms => {plants(ms); if(trial)update(ms,releaseCut)};
  s.cutNearby = root => {
    if (trial?.swing && !trial.swing.released) return;
    cut(root);
    if (trial && [trial.wall,trial.crawler].some(o=>Math.abs(o.x-s.player.x)<195)) strike(root);
  };
  s.checkHazards = () => {hazards(); if(trial)check()};
  s.drawCombat = () => {combat(); if(trial&&!trial.done)paint()};
  start.onclick = () => {
    // Activate audio in the game frame through its regular first touch on a control.
    s.startRun();
  };
  start.disabled=false; start.textContent='Start course';
}
function showError(error) { panel.querySelector('p').textContent=error.message; }
frame.addEventListener('load',()=>install().catch(showError));
frame.src = '../../index.html?seed='+seed;
