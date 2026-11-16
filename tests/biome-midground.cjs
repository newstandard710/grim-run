'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {setImmediate: nextTurn} = require('node:timers/promises');

const root = path.join(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const scope = vm.createContext({AbortController, setTimeout, clearTimeout});
vm.runInContext('Math.random = () => { throw Error("ambient randomness accessed"); };', scope);
for (const file of ['world-art.js', 'midground-terrain.js', 'biome-midground.js'])
  vm.runInContext(read('assets', 'visuals', file), scope, {filename: file});

const {AtlasStream, BiomeMidground, BANDS, STYLES, formation, planAtlases, rimContour, loadAtlas, crossingSite} =
  scope.GRIM_BIOME_MIDGROUND;
const {createProjection} = scope.GRIM_MIDGROUND_TERRAIN;
const copy = value => JSON.parse(JSON.stringify(value));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const ids = Object.keys(STYLES);
const dataFor = id => JSON.parse(read('assets', 'visuals', 'biome-midground', id + '.json'));
const payloadFor = id => {
  const data = dataFor(id);
  const bands = Array.from(BANDS, band => Object.entries(data.frames)
    .filter(([, frame]) => frame.band === band.name).map(([name, frame]) => ({name, ...frame})));
  return {data, bands, image: {}};
};

function crossingSites() {
  const config = {pxPerMeter: 12, reaperXRatio: .32};
  const sites = (id, seed) => {
    const frames = payloadFor(id).bands[1];
    const salt = scope.GRIM_WORLD_ART.WORLD_BIOMES.findIndex(biome => biome.id === id);
    const visualSeed = seed ^ Math.imul(salt, 0x51ab4e2d);
    const result = crossingSite(id, visualSeed, frames, config);
    assert.deepEqual(copy(crossingSite(id, visualSeed, frames, config)), copy(result));
    return result;
  };
  const shoulder = sites('foothills', 41);
  assert.equal(shoulder.frame, 'near-rock-shoulder');
  assert.equal(shoulder.cell, 28);
  const buttress = sites('caves', 33);
  assert.equal(buttress.frame, 'near-buttress');
  assert.equal(buttress.cell, 94);
  assert.equal(sites('caves', 41).frame, 'near-joined-columns');
  assert.equal(sites('foothills', 33), null, 'low talus is ineligible');
  assert.equal(sites('caves', 42), null, 'a run can omit an echo');
  assert.equal(sites('boss', 33), null);
  console.log('PASS deterministic crossing sites, no low talus, optional echo, and no Boss placement');
}

function flatScene(cameraY = 0, height = 440, groundY = 348) {
  return {
    startX: 200, cameraY, height, groundY, hasTeleported: false,
    terrain: {
      segments: [{start: -2500, end: 61500, y0: groundY, y1: groundY, kind: 'ground'}],
      portalX: 60200, portalExitX: 60510,
      surfaceAt: section => section.y0,
      groundAt: () => assert.fail('projection must not use generation-capable terrain queries'),
      advance: () => assert.fail('projection must not advance terrain')
    }
  };
}

function hillsideProjection() {
  const scene = flatScene();
  const {terrain} = scene;
  terrain.segments = [
    {start: -2500, end: 0, y0: 108, y1: 108, kind: 'ground'},
    {start: 0, end: 960, y0: 108, y1: 588, kind: 'ground'},
    {start: 960, end: 1080, y0: 588, y1: 588, kind: 'gap'},
    {start: 1080, end: 3200, y0: 612, y1: 108, kind: 'ground'},
    {start: 3200, end: 60200, y0: 108, y1: 108, kind: 'ground'},
    {start: 60200, end: 60400, y0: 108, y1: 108, kind: 'portal'},
    {start: 60400, end: 62000, y0: 3010, y1: 3190, kind: 'ground'}
  ];
  terrain.surfaceAt = (s, x) => {
    assert(x >= s.start && x <= s.end);
    return s.y0 + (s.y1 - s.y0) * ((x - s.start) / (s.end - s.start));
  };
  for (const band of BANDS) {
    const bandX = x => 240 + (x - scene.startX - 240) * band.rate;
    const place = (x, reference, cam = scene.cameraY) => createProjection({...scene, cameraY: cam}, reference)(band, bandX(x));
    assert(place(700, 480) > place(270, 480), 'bank follows a descending profile');
    assert(place(1350, 1800) > place(2150, 1800), 'bank follows an uphill profile');
    assert(Math.abs(place(1080.01, 1030) - place(1079.99, 1030)) < .01, 'gap span is continuous');
    near(place(480, 480, 0), 0);
    near(place(720, 480, 3040) - place(720, 480, 3000), -40 * band.rate);
    near(place(720, 480, -3000) - place(720, 480, -3040), -40 * band.rate);
    near(place(60200, 59900), place(60700, 59900));
    scene.hasTeleported = true;
    near(place(60200, 60600), place(60510, 60600));
    scene.hasTeleported = false;
    const a = place(720, 480, 0);
    scene.groundY += 300;
    for (const s of terrain.segments) { s.y0 += 300; s.y1 += 300; }
    near(place(720, 480, 0), a);
    scene.groundY -= 300;
    for (const s of terrain.segments) { s.y0 -= 300; s.y1 -= 300; }
  }
  console.log('PASS projected slope, continuous gap span, camera movement at altitude, portal and resize');
}

function weightsAndGeometry() {
  const art = scope.GRIM_WORLD_ART;
  for (const [meters, left, right] of [
    [900, 'forest', 'foothills'], [2300, 'foothills', 'tundra'],
    [6000, 'caves', 'crystals'], [7000, 'crystals', 'ashlands'],
    [8000, 'ashlands', 'lava'], [9999, 'lava', 'boss']
  ]) {
    for (const m of [meters - 180, meters - 91, meters, meters + 1, meters + 180]) {
      const expected = Object.entries(art.biomeWeights(m)).filter(([id, weight]) => STYLES[id] && weight > 0);
      assert.deepEqual(copy(planAtlases(m, m >= 5000).active), expected);
    }
    assert.deepEqual(copy(planAtlases(meters + 1, meters >= 5000).wanted),
      left === 'forest' ? [right] : [right, left]);
  }
  assert.deepEqual(copy(planAtlases(299, false).wanted), []);
  assert.deepEqual(copy(planAtlases(300, false).wanted), ['foothills']);
  assert.deepEqual(copy(planAtlases(4580, false).wanted), ['tundra', 'caves']);
  assert.deepEqual(copy(planAtlases(4999, false).active), [['tundra', 1]]);
  assert.deepEqual(copy(planAtlases(5000, true).active), [['caves', 1]]);
  assert.deepEqual(copy(planAtlases(5000, false).active), []);
  assert.deepEqual(copy(planAtlases(4999, true).active), []);
  assert.deepEqual(copy(planAtlases(20000, true).active), [['boss', 1]]);
  assert.deepEqual(copy(planAtlases(5250, true, true).wanted), ['caves', 'crystals']);
  assert.deepEqual(copy(planAtlases(7250, true, true).wanted), ['ashlands', 'crystals']);

  const seen = new Set();
  for (const id of ids) {
    const {bands} = payloadFor(id);
    for (const [i, band] of BANDS.entries()) {
      const camera = {width: 900, height: 440, travel: 0, cameraY: 0};
      const rate = [.16, .42][i];
      const tuning = STYLES[id][i];
      for (const frame of bands[i]) {
        const pick = (cell, delta = {}) => {
          const view = {...camera, ...delta};
          view.project = createProjection(flatScene(view.cameraY), 640);
          return formation(band, 89, cell, [frame, frame], tuning, view, .48);
        };
        for (let cell = 0; cell < 5; cell++) {
          const a = pick(cell);
          if (!a || a.x < 30 || a.x > 840) continue;
          assert.deepEqual(copy(a), copy(pick(cell)));
          const b = pick(cell, {travel: 80, cameraY: 40});
          near(b.x - a.x, -80 * rate);
          near(b.y - a.y, -40 * rate);
          assert.ok(a.alpha >= tuning[2] * .48 && a.alpha <= tuning[3] * .48);
          const ratio = a.scale * Math.max(frame.frame.w, frame.frame.h) / (440 * .70);
          assert.ok(ratio >= tuning[0] && ratio <= tuning[1]);
          for (const [j, support] of a.supports.entries()) {
            const [px, py] = frame.support.points[j];
            near(support.x, a.x + (px - frame.contact[0]) * frame.frame.w * a.scale * a.direction);
            near(support.y, a.y + (py - frame.contact[1]) * frame.frame.h * a.scale);
            near(b.supports[j].x - support.x, -80 * rate);
            near(b.supports[j].ground - support.ground, -40 * rate);
            if (frame.support.kind !== 'arch') near(support.y, support.ground);
            assert.equal(support.direction, frame.support.kind === 'ceiling' ? -1 : 1);
          }
          if (frame.support.kind === 'arch') {
            assert.equal(a.supports.length, 2);
            const [p, q] = a.supports;
            assert.ok(Math.abs(p.x - q.x) > p.radius + q.radius);
          }
          seen.add(frame.support.kind);
        }
      }
    }
  }
  assert.deepEqual([...seen].sort(), ['arch', 'ceiling', 'floor', 'root']);
  const gap = [{kind: 'gap', start: 80, end: 160, y0: 300, y1: 340}];
  const view = {width: 220, height: 430, cameraX: 100, cameraY: 50};
  const contour = copy(rimContour(gap, view));
  assert.deepEqual(contour.slice(2, 4), [{x: -1, y: 259.5}, {x: 60, y: 290}]);
  assert.equal(rimContour(gap, {...view, cameraX: 161}), null);

  const html = read('index.html');
  assert.match(html, /forestMidground\?\.render\(terrainSections,project\);\s*this\.biomeMidground\?\.render\(terrainSections,project\);/);
  assert.match(html, /biomeMidground\?\.prioritizeTeleport\(this\.distance\);\s*this\.drawScene\(\);/);
  console.log('PASS exact weights, portal and Boss, all four support kinds, separate deterministic hash and rim geometry');
}

function textureManager(withForest = true) {
  const keys = new Set(withForest ? ['forest-midground-v1'] : []);
  return {
    keys,
    exists: key => keys.has(key),
    addAtlas(key) {
      assert(!keys.has(key));
      keys.add(key);
      assert.ok(keys.size <= 3);
      return {};
    },
    remove(key) {
      assert(keys.delete(key));
    }
  };
}

function controlledLoader() {
  let parallel = 0;
  const requests = [];
  const loader = (id, signal) => new Promise((resolve, reject) => {
    assert.equal(++parallel, 1, 'one physical atlas transfer/decode at a time');
    requests.push({id, signal,
      resolve: () => { parallel--; resolve(payloadFor(id)); },
      fail: () => { parallel--; reject(new Error('404')); }});
  });
  return {requests, loader};
}

async function lifecycle() {
  const textures = textureManager();
  const removals = [];
  const {requests, loader} = controlledLoader();
  const stream = new AtlasStream(textures, id => {
    assert(textures.exists('biome-midground-v1-' + id));
    removals.push(id);
  }, loader);
  stream.request(['foothills', 'tundra']);
  assert.equal(requests[0].id, 'foothills');
  stream.request(['boss', 'lava']);
  assert(requests[0].signal.aborted);
  stream.request(['crystals', 'caves']);
  stream.request(['boss', 'lava']);
  assert.equal(requests.length, 1);
  requests[0].resolve(); // A decoder finishing after abort must never register.
  await nextTurn();
  assert.equal(requests[1].id, 'boss');
  assert(!textures.exists('biome-midground-v1-foothills'));
  requests[1].resolve();
  await nextTurn();
  assert.equal(requests[2].id, 'lava');
  requests[2].fail();
  await nextTurn();
  stream.request(['boss', 'lava']);
  assert.equal(requests.length, 3, 'a missing atlas is not retried every frame');
  assert.deepEqual([...stream.loaded.keys()], ['boss']);
  stream.request(['tundra', 'caves']);
  assert.deepEqual(removals, ['boss']);
  requests[3].resolve();
  await nextTurn();
  assert.equal(requests[4].id, 'caves');
  stream.destroy();
  assert(requests[4].signal.aborted);
  requests[4].resolve();
  await nextTurn();
  assert.deepEqual([...textures.keys], ['forest-midground-v1']);
  assert.equal(stream.pending, null);

  const withoutForest = textureManager(false);
  const other = new AtlasStream(withoutForest, () => {}, async id => payloadFor(id));
  other.request(['caves', 'crystals', 'ashlands', 'lava']);
  await nextTurn();
  assert.equal(withoutForest.keys.size, 3);
  other.destroy();
  assert.equal(withoutForest.keys.size, 0);
  console.log('PASS serial loads, latest-teleport priority, stale work, 404 fallback, cap and disposal');
}

function makeGame() {
  const views = [];
  const scene = {
    startX: 200, cameraX: 130, cameraY: 0, width: 1320, height: 440, state: 'playing',
    seed: 93, distance: 6000, hasTeleported: true,
    biomeBackdrops: Object.fromEntries(ids.map(id => [id, {}])), textures: textureManager(),
    rng: () => assert.fail('gameplay RNG accessed'), events: {once() {}}
  };
  function view(type, key) {
    const obj = {
      type, texture: {key}, frame: {},
      setScrollFactor() { return this; }, setDepth() { return this; },
      setVisible(value) { this.visible = value; return this; },
      setTexture(k, name) { this.texture = {key: k}; this.frame = {name}; return this; },
      setOrigin() { return this; }, setPosition(x, y) { this.x = x; this.y = y; return this; },
      setScale(x, y) { this.scale = [x, y]; return this; },
      setAlpha(alpha) { this.alpha = alpha; return this; },
      setMask(mask) { this.mask = mask; return this; }, clearMask() { this.mask = null; return this; },
      clear() { return this; }, fillStyle() { return this; }, fillPoints() { return this; },
      createGeometryMask() { return {destroy() {}}; },
      destroy() { this.destroyed = true; }
    };
    views.push(obj);
    return obj;
  }
  scene.make = {graphics: () => view('mask')};
  scene.add = {graphics: () => view('bank'), image: (x, y, key) => view('sprite', key)};
  const remove = scene.textures.remove;
  scene.textures.remove = key => {
    assert(!views.some(v => v.texture.key === key && !v.destroyed), 'texture still referenced by a view');
    remove(key);
  };
  return {scene, views};
}

async function renderer() {
  const {scene, views} = makeGame();
  const layer = new BiomeMidground(scene);
  const {requests, loader} = controlledLoader();
  layer.stream.loader = loader;
  const section = {kind: 'gap', start: 200, end: 280, y0: 328, y1: 351};
  const draw = () => layer.render([section], createProjection(flatScene(scene.cameraY), 640));
  const visible = () => views.filter(v => v.type === 'sprite' && v.visible);
  draw();
  assert.equal(views.length, 0, 'the backdrop remains visible while atlas work is pending');
  requests[0].resolve();
  await nextTurn();
  draw();
  assert.ok(visible().length > 0 && visible().length <= 14);
  assert(visible().every(v => v.texture.key.endsWith('caves') && v.mask));
  requests[1].resolve();
  await nextTurn();
  draw();
  assert.equal(views.filter(v => v.type === 'sprite').length, 28);
  assert(visible().some(v => v.texture.key.endsWith('crystals')));
  assert.ok(visible().length <= 28);
  assert(visible().every(v => v.alpha > 0 && v.alpha <= .5));
  layer.render([], createProjection(flatScene(scene.cameraY), 640));
  assert(visible().every(v => !v.mask));

  scene.distance = 19800;
  layer.prioritizeTeleport(scene.distance);
  draw();
  assert.equal(visible().length, 0);
  assert.equal(requests[2].id, 'boss');
  requests[2].fail();
  await nextTurn();
  assert.equal(requests[3].id, 'lava');
  requests[3].resolve();
  await nextTurn();
  draw();
  assert.equal(visible().length, 0, 'a failed destination uses the existing painting');
  assert.equal(views.filter(v => v.type === 'sprite').length, 28, 'slots are reused across biome changes');
  scene.state = 'menu';
  draw();
  assert.deepEqual([...scene.textures.keys], ['forest-midground-v1']);
  layer.destroy();
  assert(views.every(v => v.destroyed));
  console.log('PASS real renderer wiring, deferred artwork, bounded reusable pools, mask reset and texture detachment');
}

async function transfers() {
  const id = 'boss', data = dataFor(id);
  const urls = new Set();
  let decode;
  let image;
  let input = data;
  let imageStatus = 200;
  scope.URL = {
    createObjectURL() { const url = 'blob:scenery'; urls.add(url); return url; },
    revokeObjectURL(url) { assert(urls.delete(url)); }
  };
  scope.Image = class {
    constructor() { image = this; }
    set src(url) {
      if (!url) return;
      assert(urls.has(url));
      decode = () => {
        this.naturalWidth = data.meta.size.w;
        this.naturalHeight = data.meta.size.h;
        this.onload?.();
      };
    }
  };
  scope.fetch = async url => url.endsWith('.json') ?
    {ok: true, json: async () => input} :
    {ok: imageStatus === 200, blob: async () => ({})};

  let controller = new AbortController();
  const decoded = loadAtlas(id, controller.signal);
  await nextTurn();
  decode();
  assert.equal((await decoded).bands.flat().length, 8);
  assert.equal(urls.size, 0);
  controller = new AbortController();
  const cancelled = loadAtlas(id, controller.signal);
  await nextTurn();
  controller.abort();
  await assert.rejects(cancelled, {name: 'AbortError'});
  assert.equal(image.onload, null);
  assert.equal(urls.size, 0);
  imageStatus = 404;
  await assert.rejects(loadAtlas(id, new AbortController().signal), /texture unavailable/);
  input = copy(data);
  Object.values(input.frames)[0].contact = [1.5, .5];
  await assert.rejects(loadAtlas(id, new AbortController().signal), /Invalid scenery metadata/);
  console.log('PASS actual manifest and image loader, bad data, missing WebP, decode cancellation and URL revocation');
}

(async () => {
  hillsideProjection();
  weightsAndGeometry();
  crossingSites();
  await lifecycle();
  await renderer();
  await transfers();
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
