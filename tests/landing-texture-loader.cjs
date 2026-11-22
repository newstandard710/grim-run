'use strict';
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, '../assets/visuals/actor-transition-textures.js'), 'utf8');
const art = {key: 'reaper-landing', url: '/upright.webp', width: 151, height: 114, columns: 12, frames: 194};

function fixture(renderer = 1) {
  const events = new EventEmitter(), gameEvents = new EventEmitter(), textures = new EventEmitter();
  const bitmap = {width: 1812, height: 1938, closes: 0, close() { this.closes++; }};
  const images = [];
  let resolveDecode;
  const decoded = new Promise(resolve => { resolveDecode = resolve; });
  const scope = {
    Phaser: {CANVAS: 1, Textures: {Events: {REMOVE_KEY: 'remove-'}}},
    Image: class { constructor() { images.push(this); } },
    fetch: async url => { assert.equal(url, art.url); return {ok: true, blob: async () => ({})}; },
    createImageBitmap: () => decoded
  };
  vm.runInNewContext(script, {window: scope});
  textures.exists = () => Boolean(textures.source);
  textures.addSpriteSheet = (key, source, config) => {
    assert.equal(key, art.key);
    assert.deepEqual({...config}, {frameWidth: 151, frameHeight: 114, endFrame: 193});
    textures.source = source;
    return {};
  };
  let callbacks = 0;
  const scene = {textures, events, sys: {game: {events: gameEvents, renderer: {type: renderer}}}};
  return {scope, events, gameEvents, textures, bitmap, images, resolveDecode,
    load: () => scope.GRIM_ACTOR_TEXTURES.load(scene, art, () => callbacks++), count: () => callbacks};
}
const flush = () => new Promise(resolve => setImmediate(resolve));

(async () => {
  for (const event of ['shutdown', 'destroy']) {
    const f = fixture();
    f.load();
    f.events.emit(event);
    f.resolveDecode(f.bitmap);
    await flush();
    assert.equal(f.bitmap.closes, 1);
    assert.equal(f.count(), 0);
    assert.equal(f.images.length, 0);
    assert.equal(f.textures.source, undefined);
  }
  for (const remove of [true, false]) {
    const f = fixture();
    f.load(); f.load(); // Concurrent requests race to register the same shared key.
    const other = {...f.bitmap};
    let decodes = 0;
    f.scope.createImageBitmap = async () => decodes++ ? other : f.bitmap;
    await flush();
    assert.equal(f.textures.source, f.bitmap);
    assert.equal(f.count(), 2);
    assert.equal(other.closes, 1);
    f.events.emit('shutdown');
    assert.equal(f.bitmap.closes, 0);
    f.load();
    assert.equal(f.count(), 3);
    if (remove) f.textures.emit('remove-' + art.key);
    f.gameEvents.emit('destroy');
    assert.equal(f.bitmap.closes, 1);
  }
  for (const mode of ['unsupported', 'webgl', 'fetch failure', 'decode failure', 'wrong size']) {
    const f = fixture(mode === 'webgl' ? 2 : 1);
    if (mode === 'unsupported') delete f.scope.createImageBitmap;
    if (mode === 'fetch failure') f.scope.fetch = async () => ({ok: false});
    if (mode === 'decode failure') f.scope.createImageBitmap = async () => {throw Error('decode failed');};
    if (mode === 'wrong size') f.bitmap.width--;
    f.load();
    f.resolveDecode(f.bitmap);
    await flush();
    assert.equal(f.images.length, 1, mode);
    const image = f.images[0];
    assert.equal(image.src, art.url);
    Object.assign(image, {naturalWidth: 1812, naturalHeight: 1938});
    image.onload();
    assert.equal(f.textures.source, image);
    assert.equal(f.count(), 1);
    assert.equal(f.bitmap.closes, Number(mode === 'wrong size'));
  }
  console.log('PASS upright Canvas atlas registration, image fallback, scene teardown and shared texture lifetime.');
})().catch(e => {console.error(e); process.exitCode = 1;});
