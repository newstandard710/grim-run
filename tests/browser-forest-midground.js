'use strict';

const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require('playwright');
const {PNG} = require('pngjs');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'test-results');
const clip = path.join(out, 'forest-comparison-frames');
const previousRelease = '32fd050ea83b3ccfec8f235d3c044ba1f320af20';
const previousRenderer = execFileSync('git', ['show', previousRelease + ':assets/visuals/forest-midground.js'],
  {cwd: root, encoding: 'utf8'});
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
  const page = await browser.newPage({viewport: {width, height}});
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  if (options.previous) {
    await page.route('**/forest-midground.js?*', route =>
      route.fulfill({contentType: 'application/javascript', body: previousRenderer}));
  }
  if (options.missing) {
    await page.route('**/forest-midground.webp', route => route.fulfill({status: 404}));
  }
  const origin = 'http://127.0.0.1:' + server.address().port;
  await page.goto(origin + '/?seed=33' + (options.off ? '&forestMidground=0' : ''));
  await page.waitForFunction(() => window.grimRun?.scene.scenes[0]?.visuals?.reaperReady &&
    window.GRIM_FRONTEND?.ready, null, {timeout: 90000});
  // Both captures must use the same fully loaded character poses.
  await page.evaluate(async () => { await window.grimRun.scene.scenes[0].visuals.reviewLoad; });
  // Home input is covered separately. Start the renderer fixture through the scene.
  await page.evaluate(() => {
    const game = window.grimRun;
    const scene = game.scene.scenes[0];
    scene.sys.sceneUpdate = () => {};
    clearInterval(scene.loopWatchdogId);
    game.loop.sleep();
    scene.enterHome();
    scene.startRun();
    scene.setGodMode(true);
    game.loop.sleep();

    // Drive the real update and render paths at known camera states.
    const draw = () => {
      scene.cameras.main.setScroll(scene.cameraX, scene.cameraY);
      scene.drawScene();
    };
    window.forestTest = {
      game, scene,
      views: () => scene.forestMidground.pools.flat().filter(image => image.visible)
        .map(image => ({frame: image.frame.name, x: image.x, y: image.y,
          alpha: image.alpha, depth: image.depth, scale: image.scaleX, flip: image.flipX,
          width: image.displayWidth, height: image.displayHeight, origin: [image.originX, image.originY],
          top: image.y - image.displayHeight * image.originY, masked: Boolean(image.mask)})),
      draw,
      place(meters, render = false) {
        const x = scene.startX + meters * window.GRIM_CONFIG.pxPerMeter;
        scene.terrain.advance(x + scene.width + 800);
        const y = scene.terrain.groundAt(x) ?? scene.terrain.anchorAt(x);
        Object.assign(scene.player, {x, y, grounded: true, velocityY: 0});
        Object.assign(scene, {distance: meters, speed: window.GRIM_CORE.runSpeed(meters), cameraX: x - scene.width * .32,
          cameraY: y - scene.groundY});
        draw();
        if (render) {
          scene.ui.setMode('playing');
          scene.refreshHud();
          game.step(performance.now(), 0);
        }
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

function pair(left, right) {
  assert.equal(left.width, right.width);
  assert.equal(left.height, right.height);
  const gutter = 8;
  const tile = new PNG({width: left.width * 2 + gutter, height: left.height});
  tile.data.fill(22);
  for (let x = 3; x < tile.data.length; x += 4) tile.data[x] = 255;
  PNG.bitblt(left, tile, 0, 0, left.width, left.height, 0, 0);
  PNG.bitblt(right, tile, 0, 0, left.width, left.height, left.width + gutter, 0);
  return PNG.sync.write(tile);
}

function compareFrames(before, after) {
  assert.equal(before.length, 90);
  assert.equal(after.length, before.length);
  let changed = 0;
  for (let i = 0; i < before.length; i++) {
    const left = png(before[i]), right = png(after[i]);
    assert(left.data.some((value, index) => index % 4 === 3 && value === 255), 'Rendered frame is opaque');
    if (!left.data.equals(right.data)) changed++;
    fs.writeFileSync(path.join(clip, String(i).padStart(3, '0') + '.png'), pair(left, right));
  }
  assert(changed >= 80, 'Previous and revised Forest footage show visible differences');
}

async function reviewAdvance(page) {
  const viewport = page.viewportSize();
  return page.evaluate(({width, height}) => {
    const {scene, game, place} = window.forestTest;
    scene.startRun();
    game.loop.sleep();
    // Restart can briefly measure the container before the HUD settles.
    // Both rim captures must use the requested viewport in world pixels.
    if (game.canvas.width !== width || game.canvas.height !== height ||
        scene.width !== width || scene.height !== height) {
      game.scale.resize(width, height);
    }
    const frames = [];
    for (let i = 0; i < 38; i++) {
      place(742 + i * 1.5, true);
      if (game.canvas.width !== width || game.canvas.height !== height)
        throw Error('Forest rim capture changed size after viewport registration');
      frames.push(game.canvas.toDataURL('image/png'));
    }
    return frames;
  }, viewport);
}

async function screenshotAt(page, distance) {
  await page.evaluate(m => window.forestTest.place(m), distance);
  await page.waitForFunction(() => !window.forestTest.scene.terrainMaterialLoading.size);
  await page.evaluate(m => window.forestTest.place(m, true), distance);
  return PNG.sync.read(await page.screenshot());
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({headless: true, args: ['--no-sandbox', '--use-angle=swiftshader']});
  try {
    const {page: baseline, errors: baselineErrors} = await openGame(browser, 950, 430, {off: true});
    assert(await baseline.evaluate(() => !window.forestTest.scene.textures.exists('forest-midground-v1')));
    const off = await sequence(baseline, false);
    await baseline.close();
    const {page: previous, errors: previousErrors} = await openGame(browser, 950, 430, {previous: true});
    const old = await sequence(previous, true);
    const {page, errors} = await openGame(browser, 950, 430);
    const on = await sequence(page, true);
    assert.deepEqual(on.states, off.states,
      'Identical inputs preserve gameplay, camera, terrain, encounters, vendor offers and RNG');
    assert.deepEqual(on.states, old.states, 'Previous and revised Forest footage use the same gameplay and seed');
    compareFrames(old.frames, on.frames);
    for (const capture of [previous, page]) {
      await capture.evaluate(() => {
        const {scene, place} = window.forestTest;
        place(742);
        scene.requestTerrainMaterial('forest');
        scene.requestTerrainMaterial('foothills');
      });
      await capture.waitForFunction(() => !window.forestTest.scene.terrainMaterialLoading.size);
    }
    const previousRim = await reviewAdvance(previous), revisedRim = await reviewAdvance(page);
    for (let i = 0; i < previousRim.length; i++) {
      const index = String(i + 90).padStart(3, '0');
      fs.writeFileSync(path.join(clip, index + '.png'), pair(png(previousRim[i]), png(revisedRim[i])));
    }
    console.log('Matched the gameplay and RNG traces and paired 128 rendered frames.');

    const runtime = await page.evaluate(() => {
      const {scene: s, views, draw, place} = window.forestTest;
      const check = (condition, message) => { if (!condition) throw Error(message); };
      const close = (a, b) => Math.abs(a - b) < 1e-6;
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
      const banks = s.forestMidground.banks;
      const profile = () => banks.map(bank => bank.commandBuffer.slice());
      const initialProfile = profile();
      const depths = Array.from(new Set(before.map(v => v.depth))).sort((a, b) => a - b);
      check(eq(depths, [-24, -22]), 'Two bands are visible in the Forest');
      check(depths.every(d => d > s.biomeBackdrops.forest.depth &&
        d < s.backdropGroundVeil.depth && d < s.terrainBase.depth), 'Scenery is between the painting and veil');
      s.cameraX += 10;
      draw();
      const after = views();
      for (const [depth, rate] of [[-24, .16], [-22, .42]]) {
        const pairs = before.filter(v => v.depth === depth).map(v => [v,
          after.find(w => w.depth === depth && w.frame === v.frame && w.scale === v.scale && close(v.x - w.x, 10 * rate))]);
        check(pairs.some(([, next]) => next), 'Shared visible instances for movement measurement');
        for (const [start, next] of pairs) {
          if (next) check(Math.abs(start.x - next.x - 10 * rate) < 1e-8, 'Camera travel drives band speed');
        }
      }
      const bankProfile = profile();
      check(!eq(initialProfile, bankProfile), 'Supporting banks scroll with the canopy');
      s.cameraY += 40;
      draw();
      const elevated = views();
      for (const [depth, rate] of [[-24, .16], [-22, .42]]) {
        const change = 40 * rate;
        const from = after.filter(v => v.depth === depth), to = elevated.filter(v => v.depth === depth);
        check(from.every((v, i) => close(v.x, to[i].x) && close(v.y - to[i].y, change)),
          'A camera climb projects tree roots vertically at their band rate');
      }
      check(!eq(bankProfile, profile()), 'Bank mesh follows the same vertical projection');
      place(360);
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
      let maxVisible = 0, giantSamples = 0, rimSamples = 0;
      const seen = new Set(), scenes = [];
      const originalSeed = s.seed;
      // Seeded clearings and repeats need not use the entire atlas in any one run.
      for (const seed of [originalSeed, 34, 35, 37, 76, 123]) {
        s.seed = seed;
        for (let m = 0; m <= 1080; m += 10) {
          place(m);
          const list = views(), weight = weights(m).forest || 0;
          maxVisible = Math.max(maxVisible, list.length);
          list.forEach(v => seen.add(v.frame));
          if (seed === originalSeed && [720, 900, 1080].includes(m)) scenes.push({m, weight, count: list.length});
          for (const v of list) {
            const near = v.depth === -22, alpha = v.alpha / weight;
            check(alpha >= (near ? .82 : .60) - 1e-9 && alpha <= (near ? .95 : .72) + 1e-9,
              'Full Forest opacity stays in the correct band');
            check(v.origin[0] > .19 && v.origin[0] < .66 && v.origin[1] > .82 && v.origin[1] < .96,
              'Illustrated contact is anchored inside the frame');
            const bank = banks[near ? 1 : 0];
            const commands = bank.commandBuffer;
            check(commands.some((x, i) => x === v.x && close(commands[i + 1], v.y)),
              'The projected bank includes the exact painted root contact');
            if (!/low-canopy|wooded-bank|fern-brush|mossy-roots/.test(v.frame)) {
              const h = v.height / s.height;
              check(near ? (h >= .75 && h <= .95) || (h >= 1 && h <= 1.25) : h >= .52 && h <= .70,
                'Full tree sizes preserve stronger near/far separation');
              if (near && h >= 1 && v.top < 0) giantSamples++;
            }
          }
          if (s.forestMidground.rimClipped) {
            rimSamples++;
            check(list.every(v => v.masked) && banks.every(bank => Boolean(bank.mask)),
              'The same foreground rim excludes exposed tree and bank pixels');
            check(s.forestMidground.rim.commandBuffer.length > 16, 'Rim follows the actual gap endpoints');
          }
        }
      }
      s.seed = originalSeed;
      check(maxVisible <= 14, 'Visible scenery stays within the 14-slot pool');
      const unused = atlas.getFrameNames().filter(name => !seen.has(name));
      check(!unused.length, 'All cutouts appear across the review seeds. Unseen: ' + unused.join(', '));
      check(giantSamples > 0 && rimSamples > 0, 'Review includes off-screen crowns and real gap occlusion');
      place(773);
      check(s.forestMidground.rimClipped, 'Opening abyss uses the existing terrain rim');
      place(650);
      check(views().every(v => !v.masked), 'Canopies return to normal rendering away from the abyss');
      check(scenes[1].count > 0 && scenes[2].count === 0, 'Visible through blend midpoint, gone at exit');
      place(505);
      const pattern = views();
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
      return {maxVisible, variants: seen.size, blends: scenes, giantSamples, rimSamples, renderer: s.game.renderer.type};
    });

    for (const capture of [previous, page]) {
      await capture.evaluate(() => {
        const {scene, game} = window.forestTest;
        scene.startRun();
        scene.setGodMode(true);
        game.loop.sleep();
      });
    }
    for (const distance of [15, 55, 315, 390, 765, 782, 900, 1080]) {
      const left = await screenshotAt(previous, distance), right = await screenshotAt(page, distance);
      fs.writeFileSync(path.join(out, 'forest-pilot-950-' + distance + '.png'), pair(left, right));
    }
    await previous.close();
    assert.deepEqual(previousErrors, []);
    await page.evaluate(() => window.forestTest.game.loop.wake());
    await page.setViewportSize({width: 390, height: 844});
    await page.waitForFunction(() => window.forestTest.scene.height === 844);
    await page.evaluate(() => window.forestTest.place(15, true));
    await page.screenshot({path: path.join(out, 'forest-pilot-portrait.png')});
    await page.setViewportSize({width: 950, height: 430});
    await page.waitForFunction(() => window.forestTest.scene.width === 950);
    assert(await page.evaluate(() => {
      const fixture = window.forestTest;
      fixture.place(55, true);
      return fixture.views().length > 0 && fixture.scene.forestMidground.pools.flat().length === 14;
    }), 'Returning to landscape restores the scenery with the same pool');
    assert.deepEqual(errors, []);
    await page.close();

    const {page: small, errors: smallErrors} = await openGame(browser, 740, 360);
    const perfSmall = (await sequence(small, false)).perf;
    const oldSmall = await openGame(browser, 740, 360, {previous: true});
    await small.evaluate(() => {
      const {scene, game} = window.forestTest;
      scene.startRun();
      scene.setGodMode(true);
      game.loop.sleep();
    });
    const smallOld = await screenshotAt(oldSmall.page, 35), smallNew = await screenshotAt(small, 35);
    fs.writeFileSync(path.join(out, 'forest-pilot-740.png'), pair(smallOld, smallNew));
    assert.deepEqual(smallErrors.concat(oldSmall.errors), []);
    await oldSmall.page.close();
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
      sceneryOff950: off.perf, previous950: old.perf, revised950: on.perf, revised740: perfSmall, ...runtime
    }, null, 2));
    console.log('PASS Forest browser: unchanged gameplay/RNG, painted root contact, projected slope and rim mask, size/opacity, pause/slow/rewind/teleport, fade, pooling, two widths, rotation and missing atlas.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
