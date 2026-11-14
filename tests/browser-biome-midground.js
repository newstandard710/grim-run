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
    res.end(pathname === '/forest-baseline.html' ?
      execFileSync('git', ['show', baseline + ':index.html'], {cwd: root}) : fs.readFileSync(file));
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
  if (options.routes) await options.routes(page);
  await page.goto(`http://127.0.0.1:${server.address().port}/${options.baseline ? 'forest-baseline.html' : ''}?seed=33${options.off ? '&biomeMidground=0' : ''}`);
  await page.waitForFunction(() => window.grimRun?.scene.scenes[0]?.visuals?.reaperReady &&
    window.GRIM_FRONTEND?.ready, null, {timeout: 90000});
  await page.evaluate(async () => {
    const game = window.grimRun;
    const scene = game.scene.scenes[0];
    await scene.visuals.reviewLoad;
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
  });
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
      b.place(300);
      return Array.from({length: 10}, () => {
        for (let j = 0; j < 7; j++) b.scene.update(0, 1000 / 60);
        return b.frame();
      });
    });
    const first = await use({}, forest), old = await use({baseline: true}, forest);
    for (const [i, frame] of first.entries()) {
      writeFrame(path.join(outputs, 'forest-current-' + i + '.png'), frame);
      writeFrame(path.join(outputs, 'forest-baseline-' + i + '.png'), old[i]);
    }
    const hashes = frames => frames.map(frame => createHash('sha256').update(frame).digest('hex'));
    assert.deepEqual(hashes(first), hashes(old), 'Forest render differs from the accepted commit');

    const run = async (page, on) => {
      const samples = [];
      for (const [id, distance] of native) {
        samples.push(await page.evaluate(() => {
          const b = window.biomeReview;
          // Begin each sample from the same initialized gameplay state.
          b.scene.startRun();
          b.scene.setGodMode(true);
          b.game.loop.sleep();
          return b.snapshot();
        }));
        await page.evaluate(distance => window.biomeReview.teleport(distance), distance);
        await page.waitForFunction(({id, on}) => {
          const b = window.biomeReview;
          return b.scene.biomeBackdrops[id] && (!on || b.art().loaded.includes(id));
        }, {id, on}, {polling: 100, timeout: 20000}).catch(async error => {
          const status = await page.evaluate(() => {
            const b = window.biomeReview;
            return {distance: b.scene.distance, state: b.scene.state, underworld: b.scene.hasTeleported,
              art: b.art(), failed: [...(b.scene.biomeMidground?.stream.failed || [])]};
          });
          throw Error(id + ' did not load after teleport: ' + JSON.stringify(status), {cause: error});
        });
        samples.push(await page.evaluate(() => {
          const b = window.biomeReview;
          const states = [];
          for (let i = 0; i < 180; i++) {
            b.tick(i);
            if (i % 15 === 0) states.push(b.snapshot());
          }
          return states;
        }));
        console.log('PASS gameplay sample', id, on ? 'on' : 'off');
      }
      return samples;
    };
    const onStates = await use({}, page => run(page, true));
    const offStates = await use({off: true}, page => run(page, false));
    assert.deepEqual(onStates, offStates, 'gameplay and RNG traces differ');
    return {forestFrames: old.length, simulationSteps: native.length * 180, sampledStates: native.length * 12};
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
    // Extend the reversible snapshot history without hitting an irreversible
    // vendor or portal checkpoint before the eight-second rewind window.
    s.player.invulMs = 10000;
    for (let i = 0; i < 500; i++) {
      s.speed = 0;
      s.update(0, 1000 / 60);
    }
    const beforeRewind = s.distance;
    const rewinding = s.rewind();
    for (let i = 0; i < 155; i++) s.update(0, 1000 / 60);
    const rewound = s.distance < beforeRewind;
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
  assert(checks.rewinding && checks.rewound);
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

async function main() {
  fs.mkdirSync(outputs, {recursive: true});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({headless: true, args: ['--no-sandbox', '--use-angle=swiftshader']});
  const metrics = {};
  try {
    const mode = process.env.GRIM_BIOME_MODE;
    if (mode !== 'captures') {
      metrics.parity = await parity(browser);
      metrics.faults = await faultReview(browser);
      const life = await setup(browser, {width: 740, height: 360});
      metrics.lifecycle = await lifecycle(life.page);
      assert.deepEqual(life.errors, []);
      await life.page.close();
      console.log('PASS Forest pixel parity, gameplay/RNG parity, real delayed/missing assets and lifecycle');
    }
    if (mode !== 'checks') {
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
    game.scale.refresh();
    return game.canvas.width === w && game.canvas.height === h && scene.width === w && scene.height === h;
  }, [width, height], {polling: 150, timeout: 10000});
}
main().catch(error => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
