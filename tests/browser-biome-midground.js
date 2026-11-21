'use strict';

const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {execFileSync} = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require('playwright');

const root = path.join(__dirname, '..');
const baseline = 'b1930a49c52a8aed796cb3a388165bc5bbb6a898';
const outputs = path.resolve(process.env.GRIM_BIOME_OUTPUT || 'test-results/biome-review');
const mime = {'.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json',
  '.ttf': 'font/ttf', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml'};
const server = http.createServer((req, res) => {
  try {
    const {pathname} = new URL(req.url, 'http://localhost');
    const file = path.resolve(root, '.' + decodeURIComponent(pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'});
    const frozenForest = pathname === '/assets/visuals/forest-midground.js' && req.url.endsWith('?v=2');
    // The historical HTML must load its own frontispiece and its matching one-canvas layout.
    const frozenHome = ['/assets/ui/v0160/frontispiece.js', '/assets/ui/v0160/interface.css'].includes(pathname) &&
      req.url.endsWith('?v=0.19.3');
    // The historical power API must use its own renderer.
    const frozenPower = pathname === '/assets/visuals/power-animations.js' && req.url.endsWith('?v=0.19.8');
    const original = pathname === '/forest-baseline.html' ? 'index.html' : frozenForest || frozenHome || frozenPower ? pathname.slice(1) : null;
    res.end(original ? execFileSync('git', ['show', baseline + ':' + original], {cwd: root}) : fs.readFileSync(file));
  } catch {
    if (!res.headersSent) res.writeHead(404);
    res.end();
  }
});

const native = [['foothills', 1500], ['tundra', 3500], ['caves', 5500], ['crystals', 6500],
  ['ashlands', 7500], ['lava', 8500], ['boss', 11500]];
const blends = [['forest-foothills', 900], ['foothills-tundra', 2300], ['caves-crystals', 6000],
  ['crystals-ashlands', 7000], ['ashlands-lava', 8000], ['lava-boss', 9999]];

async function setup(browser, viewport, options = {}) {
  const page = await browser.newPage({viewport, hasTouch: true});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  if (options.baseline) await page.route('https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js',
    route => route.fulfill({
      path: path.join(root, 'assets/vendor/phaser-3.90.0/phaser.min.js'), contentType: 'application/javascript'
    }));
  if (options.routes) await options.routes(page);
  await page.goto(`http://127.0.0.1:${server.address().port}/${options.baseline ? 'forest-baseline.html' : ''}?seed=${options.seed ?? 33}${options.off ? '&biomeMidground=0' : ''}`);
  await page.waitForFunction(() => window.grimRun?.scene.scenes[0]?.visuals?.reaperReady &&
    window.GRIM_FRONTEND?.ready, null, {timeout: 90000});
  await page.evaluate(async lightweight => {
    const game = window.grimRun;
    const scene = game.scene.scenes[0];
    if (!lightweight) await scene.visuals.reviewLoad;
    scene.sys.sceneUpdate = () => {};
    clearInterval(scene.loopWatchdogId);
    scene.enterHome();
    scene.startRun();
    scene.setGodMode(true);
    game.loop.sleep();

    const config = window.GRIM_CONFIG, core = window.GRIM_CORE;
    const place = meters => {
      const x = scene.startX + meters * config.pxPerMeter;
      scene.terrain.advance(x + scene.width + 800);
      const y = scene.terrain.groundAt(x) ?? scene.terrain.anchorAt(x);
      Object.assign(scene.player, {x, y, grounded: true, velocityY: 0});
      Object.assign(scene, {distance: meters, hasTeleported: meters >= 5000, state: 'playing',
        speed: core.runSpeed(meters), cameraX: x - scene.width * config.reaperXRatio, cameraY: y - scene.groundY,
        fallFeedbackMs: 0, respawnMs: 0, damageFlashMs: 0, goFlashMs: 0});
      scene.cameras.main.setScroll(scene.cameraX, scene.cameraY);
      scene.ui.setMode('playing');
      scene.refreshHud();
      scene.drawScene();
    };
    const teleport = meters => {
      if (scene.state !== 'paused') scene.togglePause();
      if (!scene.askTeleport(meters) || !scene.confirmTeleport()) throw Error('Practice teleport failed: ' + meters);
      game.loop.sleep();
    };
    const snapshot = () => JSON.stringify({
      rng: scene.rng.state, player: scene.player, x: scene.cameraX, y: scene.cameraY,
      distance: scene.distance, elapsed: scene.elapsed, state: scene.state, terrain: scene.terrain.segments,
      obstacles: scene.obstacles, enemies: scene.enemies, coins: scene.coins, souls: scene.souls,
      points: scene.points, nextEncounterX: scene.nextEncounterX, vendorOffers: scene.pendingOffers
    });
    const art = () => {
      const layer = scene.biomeMidground;
      const views = (layer?.groups || []).flatMap(g => g.layers.flatMap(l => l.images));
      return {
        loaded: [...(layer?.stream.loaded.keys() || [])],
        pending: layer?.stream.pending?.id, wanted: layer?.stream.wanted,
        slots: views.length, visible: views.filter(v => v.visible).length,
        resident: Object.keys(scene.textures.list).filter(k => /^(forest-midground-v1|biome-midground-v1-)/.test(k)),
        rgbaBytes: Object.entries(scene.textures.list).filter(([k]) => /^(forest-midground-v1|biome-midground-v1-)/.test(k))
          .reduce((sum, [, t]) => sum + t.source[0].width * t.source[0].height * 4, 0),
        views: views.filter(v => v.visible).map(v => [v.texture.key, v.frame.name, v.x, v.y, Boolean(v.mask)]),
        forestVisible: scene.forestMidground?.pools.flat().filter(v => v.visible).length || 0
      };
    };
    const tick = i => {
      if (i % 97 === 19) scene.jump();
      if (i % 97 === 28) scene.jumpEnd();
      if (i % 113 === 41) scene.attack();
      if (i % 119 === 57) scene.startSlide();
      if (i % 119 === 72) scene.endSlide();
      scene.update(0, 1000 / 60);
    };
    let renderTime = 0;
    const frame = () => {
      // Phaser tweens use the game's step time even with simulation paused.
      renderTime += 1000 / 15;
      game.step(renderTime, 1000 / 15);
      return game.canvas.toDataURL('image/png');
    };
    window.biomeReview = {game, scene, place, teleport, snapshot, art, tick, frame};
  }, options.lightweight === true);
  return {page, errors};
}

async function settled(page, distance, ids) {
  await page.evaluate(distance => window.biomeReview.place(distance), distance);
  await page.waitForFunction(ids => {
    const b = window.biomeReview;
    b.scene.drawScene();
    return ids.every(id => b.art().loaded.includes(id) && b.scene.biomeBackdrops[id]);
  }, ids, {timeout: 20000});
}

const writeFrame = (file, data) => fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));

async function capture(page, name, distance, frames, ids, mode = 'run') {
  await settled(page, distance, ids);
  const dir = path.join(outputs, name);
  fs.mkdirSync(dir, {recursive: true});
  const samples = [];
  let first, last;
  let visible = 0, masked = 0, slots = 0, resident = 0, rgbaBytes = 0;
  for (let i = 0; i < frames; i++) {
    const shot = await page.evaluate(({i, mode}) => {
      const b = window.biomeReview;
      const before = performance.now();
      for (let j = 0; j < 4; j++) {
        if (mode === 'run') b.tick(i * 4 + j);
        else {
          b.scene.cameraX += 6;
          b.scene.distance += .5;
          b.scene.cameras.main.setScroll(b.scene.cameraX, b.scene.cameraY);
          b.scene.drawScene();
        }
      }
      const costs = (performance.now() - before) / 4;
      const art = b.art();
      const image = b.frame();
      return {image, costs, art, distance: b.scene.distance,
        viewport: [b.game.canvas.width, b.game.canvas.height]};
    }, {i, mode});
    samples.push(shot.costs);
    writeFrame(path.join(dir, String(i).padStart(3, '0') + '.png'), shot.image);
    first ??= shot.image;
    last = shot.image;
    visible = Math.max(visible, shot.art.visible + shot.art.forestVisible);
    masked += shot.art.views.filter(view => view[4]).length;
    slots = Math.max(slots, shot.art.slots);
    resident = Math.max(resident, shot.art.resident.length);
    if (name === 'rotation-portrait') assert.deepEqual(shot.viewport, [360, 740]);
    if (name === 'rotation-landscape') assert.deepEqual(shot.viewport, [740, 360]);
    rgbaBytes = Math.max(rgbaBytes, shot.art.rgbaBytes);
  }
  assert.notEqual(first, last, name + ' should move');
  assert(resident <= 3 && slots <= 28 && visible <= 28, name + ' budgets');
  assert(visible > 0, name + ' shows scenery');
  samples.sort((a, b) => a - b);
  return {frames, visible, masked, slots, resident, rgbaBytes,
    updateMsMedian: samples[Math.floor(samples.length * .5)],
    updateMsP95: samples[Math.floor(samples.length * .95)]};
}

async function hillside(browser) {
  const {page, errors} = await setup(browser, {width: 740, height: 360});
  try {
    const results = {};
    for (const [id, meters, descending] of [['forest', 429, true], ['caves', 5612, true], ['tundra', 3700, false]]) {
      const route = await page.evaluate(({meters, descending, id}) => {
        const {scene, teleport, place} = window.biomeReview;
        if (meters >= 5000) teleport(Math.round(meters / 500) * 500);
        const {pxPerMeter} = window.GRIM_CONFIG;
        const center = scene.startX + meters * pxPerMeter;
        const radius = id === 'tundra' ? 5100 : 420;
        let best;
        for (let x = center - radius; x <= center + radius; x += 12) {
          const ground = Array.from({length: 51}, (_, i) => scene.terrain.groundAt(x + i * 9));
          if (ground.some(y => y === null)) continue;
          const fall = (ground.at(-1) - ground[0]) * (descending ? 1 : -1);
          const monotone = ground.slice(1).filter((y, i) => (y - ground[i]) * (descending ? 1 : -1) > 0).length;
          if (monotone >= 39 && (!best || fall > best.fall)) best = {x, fall};
        }
        if (!best) throw Error('No continuous hillside for ' + id);
        place((best.x - scene.startX) / pxPerMeter);
        return best;
      }, {id, meters, descending});
      await page.waitForFunction(id => {
        const {scene, art} = window.biomeReview;
        return id === 'forest' ? scene.forestMidground.pools[0].length > 0 :
          scene.biomeBackdrops[id] && art().loaded.includes(id);
      }, id, {timeout: 20000});
      const report = await page.evaluate(id => {
        const {scene, place, frame} = window.biomeReview;
        scene.drawScene();
        const native = scene.biomeMidground.groups.find(group => group.id === id);
        const pools = id === 'forest' ? scene.forestMidground.pools : native?.layers.map(layer => layer.images);
        const {pxPerMeter} = window.GRIM_CONFIG;
        const root = pool => pool.filter(v => v.visible).map(v => [v.frame.name, v.x, v.y]);
        const snapshots = [], images = [];
        scene.drawScene();
        const initial = scene.cameraY;
        const before = pools.map(root);
        scene.cameraY += 32;
        scene.cameras.main.setScroll(scene.cameraX, scene.cameraY);
        scene.drawScene();
        const after = pools.map(root);
        scene.cameraY = initial;
        scene.cameras.main.setScroll(scene.cameraX, initial);
        scene.drawScene();
        const origin = scene.player.x;
        for (let i = 0; i <= 60; i++) {
          if (i) scene.update(0, 1000 / 60);
          const travel = scene.cameraX - scene.startX;
          const bands = pools.map((pool, j) => root(pool).map(([name, x, y]) => [name, x + travel * [.16, .42][j], y]));
          snapshots.push({bands, cam: scene.cameraY, ground: scene.terrain.groundAt(scene.player.x)});
          if (i % 4 === 0) images.push(frame());
        }
        place((origin - scene.startX) / pxPerMeter);
        const returned = pools.map(root);
        return {before, after, snapshots, images, returned, renderer: scene.game.renderer.type};
      }, id);
      for (const [i, rate] of [.16, .42].entries()) {
        assert(report.before[i].length > 0, id + ' shows band ' + i);
        assert.equal(report.before[i].length, report.after[i].length);
        for (const [j, [key, x, y]] of report.before[i].entries()) {
          const [newKey, newX, newY] = report.after[i][j];
          assert.deepEqual([key, x], [newKey, newX]);
          assert(Math.abs(newY - y + 32 * rate) < .00001, id + ' projects vertical-only camera motion at altitude');
        }
        assert.deepEqual(report.before[i], report.returned[i], id + ' repeated camera pose is independent of history');
      }
      const {snapshots, images} = report;
      const a = snapshots[0], b = snapshots.at(-1);
      const tracked = a.bands[1].map(([key, x, y]) => {
        const next = b.bands[1].find(([k, wx]) => key === k && Math.abs(wx - x) < .00001);
        return next && {key, x, delta: next[2] - y};
      }).filter(Boolean);
      assert(tracked.length > 0, id + ' retains a near hillside anchor');
      assert(Math.abs(b.cam - a.cam) > 6, id + ' drives a real vertical camera move');
      assert(tracked.some(anchor => Math.abs(anchor.delta) > (id === 'forest' ? 2 : 8)), id + ' moves a near ground anchor');
      let maxStep = 0;
      for (const anchor of tracked) {
        const positions = snapshots.map(s => s.bands[1].find(([key, x]) => key === anchor.key && Math.abs(x - anchor.x) < .00001)?.[2]);
        for (let i = 1; i < positions.length; i++) {
          if (positions[i] !== undefined && positions[i - 1] !== undefined)
            maxStep = Math.max(maxStep, Math.abs(positions[i] - positions[i - 1]));
        }
      }
      assert(maxStep < 9, id + ' does not snap during a hillside run');
      const dir = path.join(outputs, 'hill-' + id);
      fs.mkdirSync(dir, {recursive: true});
      images.forEach((image, i) => writeFrame(path.join(dir, String(i).padStart(3, '0') + '.png'), image));
      results[id] = {route, tracked, cameraDelta: b.cam - a.cam, maxStep, renderer: report.renderer};
    }
    assert.deepEqual(errors, []);
    return results;
  } finally { await page.close(); }
}

async function parity(browser) {
  const viewport = {width: 740, height: 360};
  const use = async (options, check) => {
    const session = await setup(browser, viewport, options);
    try {
      const result = await check(session.page);
      assert.deepEqual(session.errors, []);
      return result;
    } finally {
      await session.page.close();
    }
  };
  const forest = async page => page.evaluate(() => {
    const b = window.biomeReview;
    // This historical pixel comparison isolates midground scenery. Use the
    // original cap on both sides; the ridge has its own two-renderer pixel test.
    const surfaceView=b.scene.terrainSurfaceView;
    b.scene.terrainSurfaceView=function(section,edge,sheen,detail,activeKeys,biome){
      return surfaceView.call(this,section,edge,sheen,detail,activeKeys,biome);
    };
    // Compare the Forest scenery independently of revised supports and Reaper art.
    // The obstacle and motion suites exercise those layers at their own entry points.
    for (const sprite of b.scene.obstacleSupportObjects.values()) sprite.destroy();
    b.scene.obstacleSupportObjects.clear();
    b.scene.drawObstacleSupport = () => {};
    b.game.events.on(Phaser.Core.Events.PRE_RENDER, () => {
      b.scene.motionArt?.hide();
      b.scene.powerArt?.hideBase();
      b.scene.actor.clear();
    });
    for (const section of b.scene.terrain.segments) section.y0 = section.y1 = b.scene.groundY;
    b.place(300);
    return Array.from({length: 10}, () => {
      for (let j = 0; j < 7; j++) b.scene.update(0, 1000 / 60);
      return b.frame();
    });
  });
  // Both builds use the original far plate so this remains a pixel check of the Forest renderer.
  const first = await use({routes: async page => {
    // The accepted reference predates the surface pass. Compare the midground alone.
    await page.route('**/surface-dressing.js*', route => route.fulfill({body: '', contentType: 'text/javascript'}));
    await page.route('**/biomes/forest-ravine-v1.webp',
      route => route.fulfill({path: path.join(root, 'assets/visuals/biomes/forest.webp'), contentType: 'image/webp'}));
  }}, forest);
  const old = await use({baseline: true}, forest);
  for (const [i, frame] of first.entries()) {
    writeFrame(path.join(outputs, 'forest-current-' + i + '.png'), frame);
    writeFrame(path.join(outputs, 'forest-baseline-' + i + '.png'), old[i]);
  }
  const hashes = frames => frames.map(frame => createHash('sha256').update(frame).digest('hex'));
  assert.deepEqual(hashes(first), hashes(old), 'Flat Forest render differs from the accepted commit');

  const run = async on => {
    const samples = [];
    for (const [id, distance] of native) {
      samples.push(await use({off: !on}, async page => {
        await page.evaluate(distance => window.biomeReview.teleport(distance), distance);
        await page.waitForFunction(({id, on}) => {
          const b = window.biomeReview;
          return b.scene.biomeBackdrops[id] && (!on || b.art().loaded.includes(id));
        }, {id, on}, {polling: 100, timeout: 20000});
        return page.evaluate(() => {
          const b = window.biomeReview;
          const states = [b.snapshot()];
          for (let i = 0; i < 180; i++) {
            b.tick(i);
            if (i % 15 === 0) states.push(b.snapshot());
          }
          return states;
        });
      }));
      console.log('PASS gameplay sample', id, on ? 'on' : 'off');
    }
    return samples;
  };
  const onStates = await run(true), offStates = await run(false);
  for (const [i, states] of onStates.entries()) {
    assert(states.every((state, j) => state === offStates[i][j]), native[i][0] + ' gameplay or RNG differs');
  }
  return {forestFrames: old.length, simulationSteps: native.length * 180, sampledStates: native.length * 13};
}

async function faultReview(browser) {
  let delayed;
  let released;
  let block = true;
  const {page, errors} = await setup(browser, {width: 740, height: 360}, {routes: async page => {
    await page.route('**/biome-midground/foothills.webp', async route => {
      if (block) {
        delayed = true;
        await new Promise(resolve => { released = resolve; });
      }
      await route.continue().catch(() => {});
    });
    await page.route('**/biome-midground/ashlands.webp', route => route.fulfill({status: 404}));
  }});
  try {
    await page.evaluate(() => window.biomeReview.teleport(1500));
    for (let i = 0; !delayed && i < 20; i++) await new Promise(resolve => setTimeout(resolve, 100));
    assert(delayed);
    const before = await page.evaluate(() => {
      const b = window.biomeReview;
      const distance = b.scene.distance;
      for (let i = 0; i < 15; i++) b.tick(i);
      return [b.scene.distance - distance, b.art().visible, b.art().pending];
    });
    assert(before[0] > 0 && before[1] === 0 && before[2] === 'foothills');
    await page.evaluate(() => {
      const b = window.biomeReview;
      b.teleport(5500); b.teleport(8500); b.teleport(11500);
    });
    await page.waitForFunction(() => window.biomeReview.art().loaded.includes('boss'));
    block = false;
    released();
    assert(!(await page.evaluate(() => window.biomeReview.art().loaded.includes('foothills'))));
    await page.evaluate(() => window.biomeReview.teleport(7500));
    await page.waitForFunction(() => window.biomeReview.scene.biomeMidground.stream.failed.has('ashlands'));
    assert.equal(await page.evaluate(() => {const b = window.biomeReview; b.scene.drawScene(); return b.art().visible;}), 0);
    await page.evaluate(() => window.biomeReview.teleport(3500));
    await page.waitForFunction(() => window.biomeReview.art().loaded.includes('tundra'));
    const disposed = await page.evaluate(() => {
      const b = window.biomeReview, layer = b.scene.biomeMidground;
      b.scene.sys.shutdown();
      return [layer.stream.loaded.size, layer.groups.length, layer.stream.closed];
    });
    assert.deepEqual(disposed, [0, 0, true]);
    assert.deepEqual(errors, []);
    return {progressDuringDelayMeters: before[0], staleArrival: 'discarded', missing: 'painting', shutdown: 'disposed'};
  } finally {
    released?.();
    await page.close();
  }
}

async function lifecycle(page) {
  const checks = await page.evaluate(() => {
    const b = window.biomeReview, s = b.scene;
    b.teleport(4000);
    s.togglePause();
    const p = s.distance;
    s.update(0, 32);
    const paused = s.state === 'paused' && s.distance === p;
    s.resume();
    // Populate the real rewind buffer using actual captures over a short safe
    // route, so this check does not depend on avoiding eight seconds of hazards.
    s.resetRewindHistory();
    for (let second = 0; second <= 8; second++) {
      s.rewindClockMs = second * 1000;
      b.place(4000 + second * 2);
      s.captureRewind();
    }
    const beforeRewind = s.distance;
    const rewinding = s.rewind();
    for (let i = 0; i < 155; i++) s.update(0, 1000 / 60);
    const rewound = s.distance < beforeRewind && (s.state === 'playing' || s.state === 'rewinding');
    s.startRun(); s.setGodMode(true); b.game.loop.sleep();
    b.place(4999);
    s.enterUnderworld();
    s.drawScene();
    const portal = [s.state, s.hasTeleported, s.distance, b.art().visible];
    for (let i = 0; i < 8; i++) s.update(0, 250);
    const afterPortal = [s.state, s.hasTeleported];
    b.place(9998.8);
    s.setGodMode(false);
    for (let i = 0; i < 3; i++) s.update(0, 16);
    const finish = [s.state, s.distance];
    s.startRun(); s.setGodMode(true); b.game.loop.sleep();
    b.teleport(19500);
    const boss = [s.distance, s.state];
    s.setGodMode(false); s.player.hp = 1; s.player.invulMs = 0;
    s.takeDamage(1, 'crawler');
    const death = s.state;
    s.startRun(); b.game.loop.sleep();
    const restart = [s.distance, s.hasTeleported];
    return {paused, rewinding, rewound, portal, afterPortal, finish, boss, death, restart};
  });
  assert(checks.paused);
  assert(checks.rewinding && checks.rewound, JSON.stringify(checks));
  assert.equal(checks.portal[0], 'portal');
  assert.equal(checks.portal[1], true);
  assert(checks.portal[2] >= 5000);
  assert.equal(checks.portal[3], 0);
  assert.deepEqual(checks.afterPortal, ['playing', true]);
  assert.equal(checks.finish[1], 9999);
  assert(checks.boss[0] >= 19495 && checks.boss[1] === 'playing');
  assert.equal(checks.death, 'dying');
  assert.deepEqual(checks.restart, [0, false]);
  return checks;
}

async function crossingReview(browser) {
  const viewport = {width: 740, height: 360};
  const cases = [
    {id: 'foothills', seed: 41, checkpoint: 1500, start: 1555, frame: 'near-rock-shoulder', source: [162, 56]},
    {id: 'caves', seed: 33, checkpoint: 5000, start: 5445, frame: 'near-buttress', source: [106, 57]}
  ];
  let ticks = 0;
  for (const test of cases) {
    const {page, errors} = await setup(browser, viewport, {seed: test.seed, lightweight: true});
    try {
      await page.evaluate(() => biomeReview.place(600));
      await page.waitForFunction(() => biomeReview.scene.biomeMidground.crossingReadyDistance === 600);
      let markedRun;
      for (const enabled of [true, false]) {
        await page.evaluate(({checkpoint, enabled}) => {
          const b = biomeReview, s = b.scene;
          if (!enabled) s.biomeMidground.markForBand = () => null;
          s.startRun(); s.setGodMode(true); b.teleport(checkpoint);
        }, {...test, enabled});
        await settled(page, test.start, [test.id]);
        const run = await page.evaluate(({source, frame}) => {
          const b = biomeReview, s = b.scene, layer = s.biomeMidground;
          let seen = 0, mirrored = false, masked = false;
          const states = [];
          for (let i = 0; i < 180; i++) {
            b.tick(i);
            const mark = layer.crossingMark, host = layer.crossingHost;
            if (mark?.visible) {
              seen++;
              mirrored ||= host.scaleX < 0;
              masked ||= Boolean(host.mask);
              const x = host.x + (source[0] - host.displayOriginX) * host.scaleX;
              const y = host.y + (source[1] - host.displayOriginY) * host.scaleY;
              const list = s.sys.displayList;
              if (mark.frame.name !== frame || Math.abs(x - mark.x) > 1e-7 || Math.abs(y - mark.y) > 1e-7 ||
                  mark.scaleX !== host.scaleX || mark.scaleY !== host.scaleY || mark.alpha !== host.alpha ||
                  mark.mask !== host.mask || mark.depth !== host.depth || list.getIndex(mark) !== list.getIndex(host) + 1)
                throw Error('Crossing mark diverged from its host frame or draw order');
            }
            states.push([b.snapshot(), s.gunCooldownMs, s.blastCooldownMs, s.rewindClockMs, s.portalMs,
              s.damageFlashMs, s.nextEnemySpawnX, s.nextGroundSpawnX, s.nextSnapSpawnX]);
          }
          return {seen, mirrored, masked, states};
        }, test);
        if (enabled) {
          assert(run.seen > 0 && run.masked);
          if (test.id === 'foothills') assert(run.mirrored);
          markedRun = run.states;
        } else {
          assert.equal(run.seen, 0);
          assert.deepEqual(run.states, markedRun, test.id + ' mark changed game or RNG state');
          ticks += run.states.length;
        }
      }
      await page.setViewportSize({width: 950, height: 430});
      await waitForResize(page, 950, 430);
      const lifecycle = await page.evaluate(({start, frame}) => {
        const b = biomeReview, s = b.scene, layer = s.biomeMidground;
        delete layer.markForBand;
        b.place(start);
        const mark = layer.crossingMark;
        const resized = mark.visible && mark.frame.name === frame;
        s.togglePause();
        s.drawScene();
        const paused = mark.visible && s.state === 'paused';
        s.resume();
        s.resetRewindHistory();
        for (let i = 0; i <= 8; i++) {
          s.rewindClockMs = i * 1000;
          b.place(start + i * 2);
          s.captureRewind();
        }
        const before = s.distance;
        const rewinding = s.rewind();
        for (let i = 0; i < 170 && s.state === 'rewinding'; i++) s.update(0, 1000 / 60);
        const rewound = rewinding && s.state !== 'rewinding' && s.distance < before;
        b.place(start);
        const reused = layer.crossingMark === mark && mark.visible && mark.frame.name === frame;
        s.state = 'portal';
        s.drawScene();
        const concealed = !mark.visible;
        s.goToMenu();
        const released = !s.textures.exists('biome-crossing-marks-v1') && !layer.crossingMark.visible &&
          layer.crossingHost === null && !layer.crossingMark.mask;
        return {resized, paused, rewound, reused, concealed, released};
      }, test);
      assert(Object.values(lifecycle).every(Boolean), JSON.stringify(lifecycle));
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  }
  return {ticks};
}

async function crossingFaults(browser) {
  for (const fault of ['missing', 'corrupt', 'late']) {
    let release;
    let requests = 0;
    const {page, errors} = await setup(browser, {width: 740, height: 360}, {seed: 41, lightweight: true, routes: async page => {
      await page.route('**/crossing-marks-v1.webp', async route => {
        requests++;
        if (fault === 'missing') return route.fulfill({status: 404});
        if (fault === 'corrupt') return route.fulfill({contentType: 'image/webp', body: 'invalid'});
        await new Promise(resolve => { release = resolve; });
        await route.continue().catch(() => {});
      });
    }});
    try {
      await page.evaluate(() => biomeReview.place(600));
      await settled(page, 1575, ['foothills']);
      assert.equal(requests, 1);
      if (fault === 'late') {
        release();
        await page.waitForFunction(() => biomeReview.scene.biomeMidground.crossingReadyDistance === 1575);
      }
      const view = await page.evaluate(() => {
        const b = biomeReview, layer = b.scene.biomeMidground;
        for (let i = 0; i < 10; i++) b.tick(i);
        return [Boolean(layer.crossingMark?.visible), b.art().visible > 0, b.scene.distance > 1575];
      });
      assert.deepEqual(view, [false, true, true], fault);
      if (fault === 'late') {
        await page.evaluate(() => {
          const b = biomeReview;
          b.scene.startRun();
          b.game.loop.sleep();
        });
        await settled(page, 1575, ['foothills']);
        assert(await page.evaluate(() => biomeReview.scene.biomeMidground.crossingMark.visible));
      }
      assert.deepEqual(errors, []);
    } finally {
      release?.();
      await page.close();
    }
  }
  return ['missing', 'corrupt', 'late'];
}

async function main() {
  fs.mkdirSync(outputs, {recursive: true});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({headless: true, args: ['--no-sandbox',
    process.env.GRIM_BIOME_RENDERER === 'canvas' ? '--disable-webgl' : '--use-angle=swiftshader']});
  const metrics = {};
  try {
    const mode = process.env.GRIM_BIOME_MODE;
    if (!mode || mode === 'crossing') {
      metrics.crossing = await crossingReview(browser);
      metrics.crossingFaults = await crossingFaults(browser);
      console.log('PASS crossing marks: registration, masking, parity, release and optional art failure');
    }
    if (!mode || mode === 'hillside') {
      metrics.hillside = await hillside(browser);
      console.log('PASS live terrain projection on Forest and Caves descents and a Tundra climb');
    }
    if (!mode || ['checks', 'parity'].includes(mode)) {
      metrics.parity = await parity(browser);
      console.log('PASS flat Forest pixel parity and gameplay/RNG parity');
    }
    if (!mode || ['checks', 'lifecycle'].includes(mode)) {
      metrics.faults = await faultReview(browser);
      const life = await setup(browser, {width: 740, height: 360});
      metrics.lifecycle = await lifecycle(life.page);
      assert.deepEqual(life.errors, []);
      await life.page.close();
      console.log('PASS real delayed/missing assets, rapid teleports, disposal and lifecycle');
    }
    if (!mode || mode === 'captures') {
      const phone = await setup(browser, {width: 740, height: 360});
      for (const [id, meters] of native) {
        metrics[id] = await capture(phone.page, id, meters, 30, [id]);
        console.log('PASS capture', id, JSON.stringify(metrics[id]));
      }
      for (const [id, meters] of blends) {
        metrics[id] = await capture(phone.page, id, meters, 15, id.split('-').filter(id => id !== 'forest'), 'pan');
        console.log('PASS capture', id);
      }
      metrics.portal = await capture(phone.page, 'portal-exit', 5026, 15, ['caves']);
      assert.deepEqual(phone.errors, []);
      await phone.page.close();
    }
    if (!mode || ['captures', 'desktop'].includes(mode)) {
      const desktop = await setup(browser, {width: 950, height: 430});
      for (const [id, meters] of native) {
        metrics[id + '-desktop'] = await capture(desktop.page, id + '-desktop', meters, 9, [id]);
      }
      await desktop.page.setViewportSize({width: 360, height: 740});
      await waitForResize(desktop.page, 360, 740);
      metrics.portrait = await capture(desktop.page, 'rotation-portrait', 6500, 15, ['crystals']);
      await desktop.page.setViewportSize({width: 740, height: 360});
      await waitForResize(desktop.page, 740, 360);
      metrics.rotatedBack = await capture(desktop.page, 'rotation-landscape', 19800, 15, ['boss']);
      assert.deepEqual(desktop.errors, []);
    }
  } finally {
    fs.writeFileSync(path.join(outputs, 'metrics.json'), JSON.stringify(metrics, null, 2) + '\n');
    await browser.close();
    server.close();
  }
}
async function waitForResize(page, width, height) {
  await page.waitForFunction(([w, h]) => {
    const {game, scene} = window.biomeReview;
    // The fixture sleeps the native loop. Refresh its measured parent bounds
    // before Phaser projects them into the canvas and emits the resize event.
    game.scale.getParentBounds();
    game.scale.refresh();
    return game.canvas.width === w && game.canvas.height === h && scene.width === w && scene.height === h;
  }, [width, height], {polling: 150, timeout: 10000}).catch(async error => {
    console.error('Resize state', await page.evaluate(() => {
      const {game, scene} = biomeReview;
      const parent = game.scale.parent.getBoundingClientRect();
      return {window:[innerWidth,innerHeight],canvas:[game.canvas.width,game.canvas.height],
        scene:[scene.width,scene.height],parent:[parent.width,parent.height],
        gameSize:[game.scale.gameSize.width,game.scale.gameSize.height],
        state:scene.state,loop:game.loop.running};
    }));
    throw error;
  });
}
main().catch(error => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
