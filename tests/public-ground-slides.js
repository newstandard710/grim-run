'use strict';
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {createHash} = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const {setTimeout: delay} = require('node:timers/promises');
const vm = require('node:vm');
const {chromium} = require('playwright');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'test-results', 'served-ground-slides');
const origin = new URL(process.env.GAME_URL);
const git = (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();
const commit = git('rev-parse', 'HEAD');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const receipt = {commit, tree: git('rev-parse', 'HEAD^{tree}'), origin: origin.href, files: [], gallery: [], runs: []};


async function getBytes(file) {
  const url = new URL(file === 'index.html' ? '' : file, origin);
  url.searchParams.set('ground-slide-revision', commit);
  const response = await fetch(url, {signal: AbortSignal.timeout(25000)});
  assert.equal(response.status, 200, file + ' HTTP status');
  return Buffer.from(await response.arrayBuffer());
}

async function verifyFiles(skins) {
  const changed = git('diff','--name-only','--diff-filter=ACMRT',process.env.RELEASE_BASE,commit).split('\n');
  const files = new Set(['index.html','assets/visuals/obstacle-catalog.js','assets/visuals/obstacle-mounts.js',
    ...skins.map(s => s.src), ...changed.filter(p => /^assets\/.*\.(?:webp|png|svg|js|css|json|woff2?)$/i.test(p))]);
  const deadline = Date.now() + (process.env.PUBLIC_RELEASE === 'yes' ? 10 * 60_000 : 45_000);
  const expectedIndex = digest(await fs.readFile(path.join(root,'index.html')));
  for (;;) {
    try {
      assert.equal(digest(await getBytes('index.html')), expectedIndex, 'served HTML has landed bytes');
      break;
    } catch (err) {
      if (Date.now() > deadline) throw err;
      await delay(3000);
    }
  }
  for (const file of [...files].sort()) {
    const expected = await fs.readFile(path.join(root,file));
    const bytes = await getBytes(file);
    assert.equal(digest(bytes),digest(expected),file + ' matches checked-out commit');
    receipt.files.push({path:file,bytes:bytes.length,sha256:digest(bytes)});
  }
}

async function stage(page,spec) {
  await page.evaluate(spec => obstacleReview.prepare(spec),spec);
  await page.waitForFunction(() => obstacleReview.ready(), null, {timeout:60000,polling:200});
  if(spec.gallery) return page.evaluate(() => obstacleReview.inspect());
}

async function play(page,encounter,action) {
  const {id,seed}=encounter;
  await stage(page,encounter);
  await page.evaluate(() => {
    const s = grimRun.scene.scenes[0], o = s.obstacles[0];
    for (let i=0; o.x-s.player.x>80 && i<100; i++) obstacleReview.step(false);
    obstacleReview.render();
  });
  if (action !== 'stand') {
    const selector = {slide:'#slide-btn',jump:'#jump-btn',cut:'#attack-btn'}[action];
    const button = await page.locator(selector).boundingBox();
    assert.ok(button,selector+' visible');
    await page.mouse.move(button.x+button.width/2,button.y+button.height/2);
    await page.mouse.down();
  }
  let tick=0, moved=false, acted=false, hit=false, passed=false;
  try {
    for (; tick<100 && !hit && !passed; tick+=3) {
      const state = await page.evaluate(action => {
        const s=grimRun.scene.scenes[0],o=s.obstacles[0],start=s.player.x;
        let observed=false;
        for(let i=0;i<3;i++){
          const p=s.player;
          observed ||= action==='stand' || (action==='slide' && p.sliding) ||
            (action==='jump' && !p.grounded) || (action==='cut' && p.attackMs>0);
          obstacleReview.step(false);
        }
        obstacleReview.render();
        return {moved:s.player.x>start,observed,hit:!!o.dealtDamage,passed:s.player.x>o.x+o.width+12,
          destroyed:!!o.destroyed};
      },action);
      moved ||= state.moved; acted ||= state.observed; hit=state.hit; passed=state.passed;
      assert.equal(state.destroyed,false,id+' survives '+action);
      if (action==='slide' && (tick===3||tick===12||tick===21))
        await page.screenshot({path:path.join(out,'motion',id+'-'+String(tick).padStart(2,'0')+'.png')});
    }
  } finally {
    if (action!=='stand') await page.mouse.up();
  }
  const result={id,action,seed,ticks:tick,moved,acted,hit,passed};
  receipt.runs.push(result);
  assert.ok(moved && acted,id+' '+action+' was active in a moving run');
  if(action==='slide') assert.ok(passed && !hit,id+' slid clear');
  else assert.ok(hit,id+' blocked '+action);
  await page.evaluate(() => obstacleReview.cleanup());
}

async function main() {
  for(const subdir of ['gallery','motion']) await fs.mkdir(path.join(out,subdir),{recursive:true});
  const scope = {window:{}};
  vm.runInNewContext(await fs.readFile(path.join(root,'assets/visuals/obstacle-catalog.js'),'utf8'),scope);
  const skins=scope.window.GRIM_OBSTACLE_SPRITES.filter(s=>s.category==='slide');
  await verifyFiles(skins);
  const browser=await chromium.launch({args:['--disable-webgl','--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:740,height:360},hasTouch:true});
    const errors=[];
    page.on('pageerror',err=>errors.push(String(err)));
    const playUrl=new URL(origin);playUrl.searchParams.set('seed','33');
    await page.goto(playUrl.href,{waitUntil:'domcontentloaded'});
    receipt.title=await page.title();
    const html=await fs.readFile(path.join(root,'index.html'),'utf8');
    assert.equal(receipt.title,html.match(/<title>([^<]+)<\/title>/)[1]);
    await page.locator('#home-enter-btn').click();
    await page.locator('#start-btn').click();
    await page.waitForFunction(()=>{const s=window.grimRun?.scene.scenes[0];return s?.state==='playing' &&
      s.distance>1 && s.motionArt?.airReady && s.motionArt.cutWeaponReady;},null,{timeout:90000});
    await page.evaluate(async()=>{await grimRun.scene.scenes[0].visuals.reviewLoad;});
    await page.addScriptTag({path:path.join(root,'tests/obstacle-review-scene.js')});
    for(const s of skins){
      const inspection=await stage(page,{id:s.id,seed:33,gallery:true});
      await page.screenshot({path:path.join(out,'gallery',s.id+'.png')});
      receipt.gallery.push({id:s.id,biome:s.biome,...inspection});
      await page.evaluate(()=>obstacleReview.cleanup());
    }
    // Replay the same ordinary encounters that the course simulation found in rotation.
    const rotationLog=execFileSync(process.execPath,[path.join(__dirname,'obstacle-rotation.cjs')],{encoding:'utf8'});
    const encounters=JSON.parse(rotationLog.trim().split('\n').at(-1));
    assert.equal(encounters.length,skins.length);
    for(const encounter of encounters)
      for(const action of ['slide','stand','jump','cut']) await play(page,encounter,action);
    assert.deepEqual(errors,[]);
    const counts=new Map();
    for(const s of skins)counts.set(s.biome,(counts.get(s.biome)||0)+1);
    assert.equal(counts.size,8);
    assert.ok([...counts.values()].every(n=>n===5));
    receipt.counts=Object.fromEntries(counts);receipt.ok=true;
  } finally {await browser.close();}
}

main().catch(err=>{receipt.error=String(err.stack||err);console.error(err);process.exitCode=1;})
  .finally(async()=>{await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');});
