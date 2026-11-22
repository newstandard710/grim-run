'use strict';

const { strict: assert } = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, server } = require('./browser-landing');

const root = path.resolve('test-results/loader-trial');
fs.mkdirSync(root, { recursive: true });

// Appended only to the script response in an isolated browser context.
function installTrial(mode) {
  const original = GRIM_ACTOR_TEXTURES.load;
  GRIM_ACTOR_TEXTURES.load = function (scene, art, ready) {
    if (art.key !== 'reaper-landing' || window.grimWhichRenderer(scene) !== Phaser.CANVAS ||
        mode === 'control' || scene.textures.exists(art.key)) {
      original(scene, art, ready);
      return;
    }
    const trial = window.landingTrial = { began: performance.now() };
    let stopped = false;
    scene.events.once('shutdown', () => { stopped = true; });
    const fallback = () => {
      if (stopped) return;
      trial.fallback = true;
      original(scene, art, ready);
    };
    fetch(art.url)
      .then(response => {
        if (!response.ok) throw Error('image response');
        return response.blob();
      })
      .then(blob => {
        if (mode === 'rejected') throw Error('injected bitmap rejection');
        return createImageBitmap(blob);
      })
      .then(bitmap => {
        if (stopped) { bitmap.close(); return; }
        if (bitmap.width !== art.width * art.columns ||
            bitmap.height !== art.height * Math.ceil(art.frames / art.columns)) {
          bitmap.close();
          fallback();
          return;
        }
        const texture = scene.textures.addSpriteSheet(art.key, bitmap, {
          frameWidth: art.width, frameHeight: art.height, endFrame: art.frames - 1
        });
        if (!texture) { bitmap.close(); fallback(); return; }
        texture.once('destroy', () => bitmap.close());
        trial.registered = performance.now();
        ready();
      }, fallback);
  };
}

function arm() {
  const g = grimRun, s = g.scene.scenes[0];
  const actions = [[33, 'jump'], [37, 'jumpEnd'], [42, 'attack']];
  const rows = [], inputs = [];
  let cursor = 0, prior, firstDraw, firstPose, contact;
  let playingStart;
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
      playingStart ??= performance.now();
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
        hp: p.hp, trial: window.landingTrial, engine: g.renderer.type });
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

async function run(browser, mode, sample, renderer) {
  const page = await browser.newPage({ viewport: {width: 740, height: 360}, hasTouch: true, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.route('**/assets/visuals/actor-transition-textures.js*', async route => {
      const response = await route.fetch();
      const script = await response.text();
      const extra = 'window.grimWhichRenderer=s=>s.sys.game.renderer.type;(' + installTrial.toString() + ')(' + JSON.stringify(mode) + ');';
      await route.fulfill({ response, body: script + '\n' + extra });
    });
    await page.goto('http://127.0.0.1:' + server.address().port + '/before/?seed=33', { waitUntil: 'domcontentloaded' });
    await page.locator('#home-enter-btn').click();
    await page.waitForFunction(() => window.grimRun?.events && window.grimRun?.scene?.scenes[0]?.ui);
    await page.evaluate(arm);
    await page.locator('#start-btn').click(); // No optional-art or bitmap wait.
    const data = await page.evaluate(() => window.trialRun);
    data.atlas = await page.evaluate(atlasDigest);
    data.errors = errors;
    fs.writeFileSync(path.join(root, renderer + '-' + mode + '-' + sample + '.json'), JSON.stringify(data));
    assert.equal(data.seed, 33);
    assert.equal(data.engine, renderer === 'canvas' ? 1 : 2);
    assert.equal(data.inputs.length, 3);
    assert(data.firstPose && data.contact && data.atlas.frames.length === 194);
    if (renderer === 'canvas') assert(data.firstDraw);
    assert.deepEqual(errors, []);
    assert.equal(data.atlas.type, mode === 'bitmap' && renderer === 'canvas' ? 'ImageBitmap' : 'HTMLImageElement');
    if (mode === 'rejected') assert(data.trial.fallback);
    return data;
  } finally { await page.close(); }
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const renderer = process.env.TRIAL_RENDERER || 'canvas';
  const browser = await chromium.launch({ args: renderer === 'canvas' ? ['--disable-webgl'] :
    ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  try {
    const modes = renderer === 'canvas' ? ['control','bitmap','bitmap','control','control','bitmap','rejected'] : ['control','bitmap'];
    let reference;
    for (const [i, mode] of modes.entries()) {
      const result = await run(browser, mode, i + 1, renderer);
      reference ??= result.atlas;
      assert.equal(result.atlas.rgba, reference.rgba);
      assert.deepEqual(result.atlas.frames, reference.frames);
    }
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
