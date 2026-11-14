'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require('playwright');
const {PNG} = require('pngjs');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'test-results');
const clip = path.join(out, 'forest-comparison-frames');
fs.mkdirSync(clip, {recursive: true});
const mime = {'.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json',
  '.ttf': 'font/ttf', '.png': 'image/png', '.webp': 'image/webp'};
const server = http.createServer((req, res) => {
  try {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1);
    const file = path.resolve(root, name || 'index.html');
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'});
    res.end(fs.readFileSync(file));
  } catch {
    res.writeHead(404).end();
  }
});

async function openGame(browser, width, height, options = {}) {
  // Suppress the animated entry button's movement during Playwright's click.
  const page = await browser.newPage({viewport: {width, height}, reducedMotion: 'reduce'});
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  if (options.missing) {
    await page.route('**/forest-midground.webp', route => route.fulfill({status: 404}));
  }
  const origin = 'http://127.0.0.1:' + server.address().port;
  await page.goto(origin + '/?seed=33' + (options.off ? '&forestMidground=0' : ''));
  await page.waitForFunction(() => window.grimRun?.scene.scenes[0]?.visuals?.reaperReady &&
    window.GRIM_FRONTEND?.ready, null, {timeout: 90000});
  // Both captures must use the same fully loaded character poses.
  await page.evaluate(async () => { await window.grimRun.scene.scenes[0].visuals.reviewLoad; });
  await page.locator('#home-enter-btn').click();
  await page.locator('#start-btn').click();
  await page.evaluate(() => {
    const game = window.grimRun;
    const scene = game.scene.scenes[0];
    scene.sys.sceneUpdate = () => {};
    clearInterval(scene.loopWatchdogId);
    game.loop.sleep();
    scene.startRun();
    scene.setGodMode(true);
    game.loop.sleep();

    // Drive the real update and render paths at known camera states.
    window.forestTest = {
      game, scene,
      views: () => scene.forestMidground.pools.flat().filter(image => image.visible)
        .map(image => ({frame: image.frame.name, x: image.x, y: image.y,
          alpha: image.alpha, depth: image.depth, scale: image.scaleX, flip: image.flipX})),
      draw() {
        scene.cameras.main.setScroll(scene.cameraX, scene.cameraY);
        scene.drawScene();
        game.step(performance.now(), 0);
      },
      place(meters) {
        const x = scene.startX + meters * window.GRIM_CONFIG.pxPerMeter;
        scene.terrain.advance(x + scene.width + 800);
        const y = scene.terrain.groundAt(x) ?? scene.terrain.anchorAt(x);
        Object.assign(scene.player, {x, y, grounded: true, velocityY: 0});
        Object.assign(scene, {distance: meters, speed: window.GRIM_CORE.runSpeed(meters), cameraX: x - scene.width * .32,
          cameraY: y - scene.groundY});
        this.draw();
      },
      signature() {
        return JSON.stringify({
          rng: scene.rng.state, player: scene.player, x: scene.cameraX, y: scene.cameraY,
          distance: scene.distance, elapsed: scene.elapsed, state: scene.state,
          terrain: scene.terrain.segments, obstacles: scene.obstacles, enemies: scene.enemies,
          coins: scene.coins, souls: scene.souls, points: scene.points,
          nextEncounterX: scene.nextEncounterX, vendorOffers: scene.pendingOffers
        });
      },
      advance(index) {
        if (index === 35 || index === 205) scene.jump();
        if (index === 48 || index === 218) scene.jumpEnd();
        if (index === 121 || index === 260) scene.startSlide();
        if (index === 137 || index === 275) scene.endSlide();
        if (index === 92 || index === 285) scene.attack();
        scene.update(0, 1000 / 60);
      }
    };
  });
  return {page, errors};
}

function png(data) {
  return PNG.sync.read(Buffer.from(data.slice(data.indexOf(',') + 1), 'base64'));
}

async function sequence(page, record) {
  const samples = await page.evaluate(record => {
    const {scene, game, advance, signature} = window.forestTest;
    const states = [], frames = [], times = [];
    for (let i = 0; i < 600; i++) {
      const before = performance.now();
      advance(i);
      times.push(performance.now() - before);
      if (i % 60 === 0 || i === 599) states.push(signature());
      if (record && i < 360 && i % 4 === 0) {
        game.step(performance.now(), 0);
        frames.push(game.canvas.toDataURL('image/png'));
      }
    }
    scene.triggerVendor(1);
    states.push(signature());
    times.sort((a, b) => a - b);
    return {states, frames, perf: {
      n: times.length, median: times[Math.floor(times.length / 2)], p95: times[Math.floor(times.length * .95)]
    }};
  }, record);
  return samples;
}

function compareFrames(before, after) {
  assert.equal(before.length, 90);
  assert.equal(after.length, before.length);
  let changed = 0;
  const alignment = 8;
  for (let i = 0; i < before.length; i++) {
    const left = png(before[i]), right = png(after[i]);
    assert.equal(left.width, right.width);
    assert.equal(left.height, right.height);
    assert(left.data.some((value, index) => index % 4 === 3 && value === 255), 'Rendered frame is opaque');
    const tile = new PNG({width: left.width * 2 + alignment, height: left.height});
    tile.data.fill(22);
    for (let x = 3; x < tile.data.length; x += 4) tile.data[x] = 255;
    PNG.bitblt(left, tile, 0, 0, left.width, left.height, 0, 0);
    PNG.bitblt(right, tile, 0, 0, right.width, right.height, left.width + alignment, 0);
    if (!left.data.equals(right.data)) changed++;
    fs.writeFileSync(path.join(clip, String(i).padStart(3, '0') + '.png'), PNG.sync.write(tile));
  }
  assert(changed >= 80, 'Both panels are actual rendered scenes, with visible pilot changes');
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({headless: true, args: ['--no-sandbox', '--use-angle=swiftshader']});
  try {
    const {page: baseline, errors: baselineErrors} = await openGame(browser, 950, 430, {off: true});
    assert(await baseline.evaluate(() => !window.forestTest.scene.textures.exists('forest-midground-v1')));
    const off = await sequence(baseline, true);
    await baseline.close();
    const {page, errors} = await openGame(browser, 950, 430);
    const on = await sequence(page, true);
    assert.deepEqual(on.states, off.states,
      'Identical inputs preserve gameplay, camera, terrain, encounters, vendor offers and RNG');
    compareFrames(off.frames, on.frames);

    const runtime = await page.evaluate(() => {
      const {scene: s, views, draw, place} = window.forestTest;
      const check = (condition, message) => { if (!condition) throw Error(message); };
      const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      const atlas = s.textures.get('forest-midground-v1');
      const source = atlas.getSourceImage();
      const scratch = document.createElement('canvas');
      Object.assign(scratch, {width: source.width, height: source.height});
      const ctx = scratch.getContext('2d');
      ctx.drawImage(source, 0, 0);
      for (const name of atlas.getFrameNames()) {
        const f = atlas.get(name);
        const pixels = ctx.getImageData(f.cutX, f.cutY, f.cutWidth, f.cutHeight).data;
        let clear = 0, painted = 0;
        for (let i = 3; i < pixels.length; i += 4) {
          if (pixels[i] === 0) clear++;
          if (pixels[i] > 160) painted++;
        }
        check(clear > 100 && painted > 100, name + ' decodes as transparent painted scenery');
      }

      s.startRun();
      s.setGodMode(true);
      s.game.loop.sleep();
      s.state = 'playing';
      place(360);
      const before = views();
      const depths = Array.from(new Set(before.map(v => v.depth))).sort((a, b) => a - b);
      check(eq(depths, [-24, -22]), 'Two bands are visible in the Forest');
      check(depths.every(d => d > s.biomeBackdrops.forest.depth &&
        d < s.backdropGroundVeil.depth && d < s.terrainBase.depth), 'Scenery is between the painting and veil');
      s.cameraX += 10;
      draw();
      const after = views();
      for (const [depth, rate] of [[-24, .16], [-22, .42]]) {
        const pairs = before.filter(v => v.depth === depth).map(v => [v,
          after.find(w => w.depth === depth && w.frame === v.frame && w.scale === v.scale && w.y === v.y)]);
        check(pairs.some(([, next]) => next), 'Shared visible instances for movement measurement');
        for (const [start, next] of pairs) {
          if (next) check(Math.abs(start.x - next.x - 10 * rate) < 1e-8, 'Camera travel drives band speed');
        }
      }
      s.cameraY += 40;
      draw();
      check(eq(after, views()), 'Vertical camera changes leave backdrop anchors stable');
      s.cameraY -= 40;
      s.togglePause();
      s.update(0, 20);
      const paused = views();
      s.update(0, 800);
      check(eq(paused, views()), 'Pause holds scenery');
      s.resume();
      s.update(0, 200);
      check(eq(paused, views()), 'Resume countdown holds scenery');
      s.state = 'playing';
      let results = [];
      for (const mode of [0, 1, 2, 3]) {
        place(360);
        s.practiceTimeMode = mode;
        const x = s.cameraX;
        s.update(0, 20);
        results.push(s.cameraX - x);
      }
      for (const [i, fraction] of [1, .5, .25, 0].entries()) {
        check(Math.abs(results[i] - results[0] * fraction) < 1e-7, 'Practice time changes camera displacement');
      }
      s.practiceTimeMode = 0;
      place(360);
      s.powerManager.levels.deathsDelay = 1;
      s.player.slowCooldownMs = 0;
      s.activateSlowTime();
      const slowX = s.cameraX;
      s.update(0, 20);
      check(s.player.slowMs > 0 && s.cameraX - slowX < results[0], 'Gameplay slow effect changes camera travel');
      s.player.slowMs = 0;
      s.player.slowCooldownMs = 0;

      const weights = window.GRIM_WORLD_ART.biomeWeights;
      let maxVisible = 0, seen = new Set(), scenes = [];
      for (let m = 0; m <= 1080; m += 5) {
        place(m);
        const list = views();
        maxVisible = Math.max(maxVisible, list.length);
        list.forEach(v => seen.add(v.frame));
        if (m === 720 || m === 900 || m === 1080) scenes.push({m, weight: weights(m).forest || 0, count: list.length});
        check(list.every(v => v.alpha <= (weights(m).forest || 0) * .63), 'Forest weight bounds visible opacity');
      }
      check(maxVisible <= 14 && seen.size === 12, 'All pieces are used within the bounded pool');
      check(scenes[1].count > 0 && scenes[2].count === 0, 'Visible through blend midpoint, gone at exit');
      place(505);
      const pattern = views();
      const originalSeed = s.seed;
      s.seed = 34;
      draw();
      check(!eq(pattern, views()), 'Another seed has a different layout');
      s.seed = originalSeed;
      draw();
      check(eq(pattern, views()), 'Restoring a seed restores its layout');

      // Rewind through recorded snapshots and compare the decoration at the destination.
      s.startRun();
      s.setGodMode(true);
      s.game.loop.sleep();
      for (let i = 0; i < 525; i++) s.update(0, 1000 / 60);
      check(s.rewind(), 'Eight seconds of rewind recorded');
      const target = s.rewindPlayback.target;
      for (let i = 0; i < 15 && s.state === 'rewinding'; i++) s.update(0, 250);
      check(s.state === 'playing' && s.player.x === target.player.x, 'Rewind returns to the exact target');
      const rewindViews = views();
      draw();
      check(eq(rewindViews, views()), 'No decoration jumps on the next draw after rewind');
      let backLayout;
      for (const meters of [500, 1500, 500]) {
        s.state = 'paused';
        check(s.askTeleport(meters) && s.confirmTeleport(), 'Practice teleport succeeds');
        const list = views();
        if (meters === 1500) check(!list.length, 'Outside Forest on first destination draw');
        else {
          check(list.length > 0, 'Forest scenery present on first destination draw');
          if (backLayout) check(eq(backLayout, list), 'Teleport back reproduces the same composition');
          backLayout = list;
        }
      }

      s.triggerVendor(1);
      draw();
      check(s.state === 'vendorIntro' && views().length === 0, 'Staged vendor scene keeps its composition');
      s.goToMenu();
      check(views().length === 0, 'Menu clears scenery');
      s.startRun();
      draw();
      check(views().length > 0, 'Restart restores scenery');
      return {maxVisible, variants: seen.size, blends: scenes, renderer: s.game.renderer.type};
    });

    for (const distance of [55, 665, 900, 1080]) {
      await page.evaluate(m => window.forestTest.place(m), distance);
      await page.screenshot({path: path.join(out, 'forest-pilot-950-' + distance + '.png')});
    }
    await page.evaluate(() => window.forestTest.game.loop.wake());
    await page.setViewportSize({width: 390, height: 844});
    await page.waitForFunction(() => window.forestTest.scene.height === 844);
    await page.evaluate(() => window.forestTest.draw());
    await page.setViewportSize({width: 950, height: 430});
    await page.waitForFunction(() => window.forestTest.scene.width === 950);
    await page.evaluate(() => window.forestTest.draw());
    assert.deepEqual(errors, []);
    await page.close();

    const {page: small, errors: smallErrors} = await openGame(browser, 740, 360);
    const perfSmall = (await sequence(small, false)).perf;
    await small.evaluate(() => {
      window.forestTest.scene.state = 'playing';
      window.forestTest.place(120);
    });
    await small.screenshot({path: path.join(out, 'forest-pilot-740.png')});
    assert.deepEqual(smallErrors, []);
    await small.close();
    const {page: missing, errors: missingErrors} = await openGame(browser, 740, 360, {missing: true});
    assert(await missing.evaluate(() => {
      const {scene, draw, views} = window.forestTest;
      draw();
      return scene.state === 'playing' && scene.biomeBackdrops.forest.visible && views().length === 0;
    }), 'Failed atlas load falls back to the approved Forest painting');
    await missing.close();
    assert.deepEqual(missingErrors.concat(baselineErrors), []);
    fs.writeFileSync(path.join(out, 'forest-pilot-metrics.json'), JSON.stringify({
      scope: 'Headless Chromium, simulation and draw preparation CPU only (ms)',
      baseline950: off.perf, pilot950: on.perf, pilot740: perfSmall, ...runtime
    }, null, 2));
    console.log('PASS Forest browser: 12 RGBA pieces, paired gameplay/RNG, layer order/rates, pause/slow/rewind/teleport, blend, two viewport widths, resize and missing atlas.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
