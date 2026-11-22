'use strict';
const PUBLIC_GAME='https://newstandard710.github.io/grim-run/';
async function publicPage(page,seed){
 const res=await page.goto(PUBLIC_GAME+'?seed='+seed,{waitUntil:'domcontentloaded'});
 assert.equal(res.status(),200);assert.equal(new URL(page.url()).origin,'https://newstandard710.github.io');
 assert.equal(await page.title(),'GRIM RUN — v0.19.18');
}


const { strict: assert } = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, server } = require('./browser-landing');

const root = path.resolve('test-results/loader-trial');
fs.mkdirSync(root, { recursive: true });

function arm() {
  const g = grimRun, s = g.scene.scenes[0];
  const actions = [[33, 'jump'], [37, 'jumpEnd'], [42, 'attack']];
  const rows = [], inputs = [];
  let cursor = 0, prior, firstDraw, firstPose, contact;
  let playingStart, registered, readyOnStart;
  const original = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
    if (!firstDraw && s.state === 'playing' && s.textures.exists('reaper-landing') &&
        image === s.textures.get('reaper-landing').getSourceImage()) {
      firstDraw = { m: s.distance, at: performance.now(), src: args.slice(0, 4) };
    }
    return original.call(this, image, ...args);
  };
  window.trialRun = new Promise(resolve => {
    function step(t) {
      if (s.state !== 'playing') return;
      readyOnStart ??= s.textures.exists('reaper-landing');
      playingStart ??= performance.now();
      if(s.textures.exists('reaper-landing')) registered ??= performance.now();
      const p = s.player, m = s.distance;
      if (prior) rows.push({ m: prior.m, endM: m, dt: t - prior.t });
      prior = { m, t };
      if (cursor < actions.length && m >= actions[cursor][0]) {
        const key = actions[cursor++][1];
        inputs.push([key, m]);
        s[key]();
      }
      const view = s.motionArt?.body[0];
      if (view?.visible && view.texture.key === 'reaper-landing') {
        firstPose ??= { m, frame: view.frame.name };
      }
      if (cursor >= 2 && p.grounded && !contact) contact = { m, y: p.y, source: p.visualTouchdown?.source };
      if (m < 76) return;
      g.events.off('prestep', step);
      CanvasRenderingContext2D.prototype.drawImage = original;
      resolve({ rows, inputs, playingStart, firstDraw, firstPose, contact, seed: s.seed,
        hp: p.hp, registered, readyOnStart, engine: g.renderer.type });
    }
    g.events.on('prestep', step);
  });
}

async function atlasDigest() {
  const tex = grimRun.scene.scenes[0].textures.get('reaper-landing');
  const image = tex.getSourceImage(), canvas = document.createElement('canvas');
  canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const digest = await crypto.subtle.digest('SHA-256', pixels);
  const frames = tex.getFrameNames().map(id => {
    const f = tex.get(id);
    return [id, f.cutX, f.cutY, f.cutWidth, f.cutHeight];
  });
  return { rgba: Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join(''),
    size: [image.width, image.height], frames, type: image.constructor.name };
}

const canonicalRGBA = '001f44c37671a28c781ce58579fffbc2f36dedc6df1c9b6c4da5356620c64c71';
const rects = Array.from({length:194}, (_,i)=>[String(i), (i%12)*151, Math.floor(i/12)*114,151,114]);

async function run(browser, revision, mode, sample, renderer) {
  const page = await browser.newPage({viewport:{width:740,height:360}, hasTouch:true, deviceScaleFactor:1});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    if (mode === 'rejected' || mode === 'delayed') {
      // Only the landing loader passes this particular WebP response as a Blob.
      await page.addInitScript(mode=>{
        const fetchImage = window.fetch, create = window.createImageBitmap, landingBlobs = new WeakSet();
        let release;
        const gate = new Promise(resolve=>{release=resolve;});
        window.releaseLanding = release;
        window.fetch = async function(...args) {
          const response = await fetchImage.apply(this,args);
          if (String(args[0]).includes('/reaper-landing.webp')) {
            const read = response.blob.bind(response);
            response.blob = async () => {const blob = await read(); landingBlobs.add(blob);return blob;};
          }
          return response;
        };
        window.createImageBitmap = async function(source,...args) {
          if (landingBlobs.has(source)) {
            window.interceptedLanding = true;
            if(mode==='rejected') throw Error('Intentional decode rejection');
            await gate;
          }
          return create.call(this,source,...args);
        };
      },mode);
    }
    await publicPage(page,33);
    await page.locator('#home-enter-btn').click();
    await page.waitForFunction(()=>window.grimRun?.scene.scenes[0]?.ui);
    for (let pass = 0; pass < (mode === 'normal' ? 2 : 1); pass++) {
      if(pass) await page.evaluate(()=>grimRun.scene.scenes[0].goToMenu());
      await page.evaluate(arm);
      await page.locator('#start-btn').click();
      if(mode==='delayed') {
        // Run past Start with a held decode, then let the original call finish.
        await page.waitForFunction(()=>window.interceptedLanding && grimRun.scene.scenes[0].state==='playing' && grimRun.scene.scenes[0].distance>5);
        assert.equal(await page.evaluate(()=>grimRun.scene.scenes[0].textures.exists('reaper-landing')),false);
        await page.evaluate(()=>window.releaseLanding());
      }
      const data = await page.evaluate(()=>window.trialRun);
      const atlas = await page.evaluate(atlasDigest);
      const shotFrame = data.firstDraw && data.rows.find(row=>row.endM===data.firstDraw.m);
      const peak = Math.max(...data.rows.filter(row=>row.m>=45&&row.m<=58).map(row=>row.dt));
      const label = [renderer,revision,mode,sample,pass?'warm':'fresh'].join('-');
      const summary = {label, firstDraw:shotFrame?.dt, peak, readyOnStart:data.readyOnStart,
        readyMs:data.registered-data.playingStart, source:atlas.type, distance:data.firstPose?.m,hp:data.hp};
      fs.writeFileSync(path.join(root,label+'.json'),JSON.stringify({summary,data,atlas,errors}));
      console.log(JSON.stringify(summary));
      assert.equal(data.seed,33);
      assert.equal(data.engine, renderer==='canvas'?1:2);
      assert.deepEqual(data.inputs.map(a=>a[0]),['jump','jumpEnd','attack']);
      assert(data.firstPose && data.contact && data.hp===2);
      assert.equal(atlas.rgba,canonicalRGBA);
      assert.deepEqual(atlas.frames,rects);
      assert.deepEqual(atlas.size,[1812,1938]);
      assert.equal(atlas.type,renderer==='canvas'&&revision==='after'&&mode!=='rejected'?'ImageBitmap':'HTMLImageElement');
      if(mode==='rejected') assert(await page.evaluate(()=>window.interceptedLanding));
      if(renderer==='canvas'){
        assert(shotFrame);
        if(revision==='after' && mode!=='rejected') assert(shotFrame.dt < 50.5, label+' first upright draw '+shotFrame.dt);
      }
      assert.deepEqual(errors,[]);
    }
  } finally { await page.close(); }
}

(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const renderer = process.env.TRIAL_RENDERER || 'canvas';
  const browser = await chromium.launch({args:renderer==='canvas'?['--disable-webgl']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const cases = renderer==='canvas' ?
      [['before','normal'],['after','normal'],['after','normal'],['before','normal'],['before','normal'],['after','normal'],['after','delayed'],['after','rejected']] :
      [['before','normal'],['after','normal']];
    for(const [i,[rev,mode]] of [['after','normal'],['after','normal']].entries()) await run(browser,rev,mode,i+1,renderer);
  } finally {await browser.close(); server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
