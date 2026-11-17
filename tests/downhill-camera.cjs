const assert = require('node:assert/strict');
require('../assets/visuals/world-art.js');
require('../assets/visuals/downhill-camera.js');

const { DownhillCamera } = globalThis.GRIM_DOWNHILL_CAMERA;
const dt = 1000 / 60;
const downhill = new DownhillCamera();
const player = { x: 200, grounded: true, onSoulPlatform: false };
const terrain = {
  generatedThrough: 1000,
  sectionAt: () => ({ kind: 'ground', end: 1000 }),
  groundAt: x => x * .5
};
const scene = { state: 'playing', player, terrain, distance: 7500 };
function settle() {
  for (let tick = 0; tick < 170; tick++) downhill.step(scene, dt);
}

settle();
assert.equal(downhill.visibleOffset(scene), 24);
scene.state = 'paused';
assert.equal(downhill.visibleOffset(scene), 24);
scene.state = 'vendorIntro';
assert.equal(downhill.visibleOffset(scene), 0);
scene.state = 'respawning';
scene.respawnCamera = {};
scene.respawnMs = 1380;
assert.equal(downhill.visibleOffset(scene), 12);
scene.state = 'playing';

player.grounded = false;
downhill.step(scene, dt);
assert.ok(downhill.visibleOffset(scene) >= 21.5, 'takeoff release is capped at 2.5 px per reference tick');
for (let tick = 0; tick < 30; tick++) downhill.step(scene, dt);
assert.ok(downhill.visibleOffset(scene) < .25);
player.grounded = true;
player.onSoulPlatform = 0;
settle();
assert.equal(downhill.visibleOffset(scene), 0, 'ledge ID zero also suppresses the offset');
player.onSoulPlatform = false;

for (const [distance, offset] of [[6700, 0], [7000, 12], [8000, 12], [8400, 0], [9999, 12], [11000, 24]]) {
  scene.distance = distance;
  settle();
  assert.equal(downhill.visibleOffset(scene), offset);
}
terrain.sectionAt = x => x < 232 ? { kind: 'ground', end: 232 } : { kind: 'gap', end: 237 };
settle();
assert.equal(downhill.visibleOffset(scene), 0, 'a gap between samples also suppresses the offset');
terrain.generatedThrough = player.x + 112;
terrain.sectionAt = () => assert.fail('presentation must not sample past generated terrain');
settle();

terrain.generatedThrough = 1000;
terrain.sectionAt = () => ({ kind: 'ground', end: 1000 });
terrain.groundAt = x => x * .5;
const before = { at: 0 }, after = { at: 100 };
downhill.capture(before);
settle();
downhill.capture(after);
scene.state = 'rewinding';
const reverse = [after, before];
downhill.rewind(reverse, .5, dt);
assert.equal(downhill.visibleOffset(scene), 21, 'large rewind changes have a 3 px per-tick cap');
downhill.rewind(reverse, .9, dt);
assert.equal(downhill.visibleOffset(scene), 18);
downhill.rewind(reverse, 1, dt);
assert.equal(downhill.visibleOffset(scene), 15);
scene.state = 'playing';
assert.equal(downhill.visibleOffset(scene), 15, 'rewind exit carries the rendered offset into live play');
assert.deepEqual(before, { at: 0 }, 'visual history leaves stock snapshots intact');
downhill.reset();
assert.equal(downhill.visibleOffset(scene), 0);

console.log('Downhill camera activation, fades, terrain access, lifecycle and rewind passed.');
