'use strict';

const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'assets/visuals');
const dir = path.join(root, 'forest-midground/v1');
const {frames, meta} = JSON.parse(fs.readFileSync(path.join(dir, 'forest-midground.json')));
const production = JSON.parse(fs.readFileSync(path.join(dir, 'production-prompts.json')));
const hash = filename => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

assert.equal(hash(path.join(root, 'biomes/forest.webp')), meta.referenceSha256);
assert.equal(hash(path.join(dir, meta.image)), meta.atlasSha256);
assert.equal(fs.statSync(path.join(dir, meta.image)).size, meta.atlasBytes);
assert(meta.atlasBytes <= 500 * 1024);
assert(meta.size.w <= 2048 && meta.size.h <= 1024 && meta.padding >= 8);
assert.equal(production.tool, 'Built-in ImageGen');
assert.equal(production.transparentBackground, true);
assert.equal(production.sources.length, 2);
for (const {file, prompt} of production.sources) {
  assert(prompt.includes('STYLE REFERENCE ONLY'));
  assert.equal(hash(path.join(dir, 'source', file)), meta.sources[file].sha256);
}
const rectangles = Object.entries(frames);
for (const band of ['far', 'near']) {
  assert.equal(rectangles.filter(([name]) => name.startsWith(band + '-')).length, 6);
}
for (const [index, [name, entry]] of rectangles.entries()) {
  const {x, y, w, h} = entry.frame;
  assert(w > 0 && h > 0 && x >= meta.padding && y >= meta.padding, name);
  assert(x + w + meta.padding <= meta.size.w && y + h + meta.padding <= meta.size.h, name);
  assert(meta.sources[entry.source], name);
  for (const [, earlier] of rectangles.slice(0, index)) {
    const a = earlier.frame;
    assert(x >= a.x + a.w + meta.padding || a.x >= x + w + meta.padding ||
      y >= a.y + a.h + meta.padding || a.y >= y + h + meta.padding, name + ' overlaps atlas padding');
  }
}
console.log('PASS Forest atlas: 12 padded frames, exact source and reference hashes, transfer budget.');
