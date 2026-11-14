/* Forest scenery uses camera displacement and its own position-based variation. */
(function(scope) {
  'use strict';

  const ATLAS = 'forest-midground-v1';
  const ROOT = 'assets/visuals/forest-midground/v1/forest-midground';
  const BANDS = [
    {
      depth: -24, rate: .16, stride: 310, base: .67, opacity: .50, salt: 0x519,
      pieces: [
        ['far-leaning-ash', .40], ['far-shadow-grove', .38], ['far-open-oak', .42],
        ['far-bare-pair', .32], ['far-low-canopy', .23], ['far-wooded-bank', .17]
      ]
    },
    {
      depth: -22, rate: .42, stride: 470, base: .755, opacity: .63, salt: 0x776,
      pieces: [
        ['near-curved-oak', .56], ['near-split-trunk', .53], ['near-twin-trunks', .59],
        ['near-bent-oak', .44], ['near-fern-brush', .14], ['near-mossy-roots', .18]
      ]
    }
  ];
  const POOL_PER_BAND = 7;
  const CONCEALED = new Set(['home', 'menu', 'reliquary', 'vendorIntro', 'portal', 'chest']);

  function variation(seed, cell, salt) {
    let value = seed ^ Math.imul(cell, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b);
    value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
    value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
    return ((value ^ (value >>> 16)) >>> 0) / 0x100000000;
  }

  function preload(scene) {
    if (new URLSearchParams(scope.location?.search).get('forestMidground') === '0') return;
    scene.load?.atlas?.(ATLAS, ROOT + '.webp', ROOT + '.json');
  }

  class ForestMidground {
    constructor(scene) {
      this.scene = scene;
      this.atlas = scene.textures?.exists?.(ATLAS) ? scene.textures.get(ATLAS) : null;
      this.pools = [[], []];
      if (!scene.add?.image || !this.atlas ||
          BANDS.some(band => band.pieces.some(([key]) => !this.atlas.has(key)))) return;
      for (let i = 0; i < BANDS.length; i++) {
        const band = BANDS[i];
        for (let k = 0; k < POOL_PER_BAND; k++) {
          const image = scene.add.image(0, 0, ATLAS, band.pieces[0][0]);
          this.pools[i].push(image.setOrigin(.5, 1).setScrollFactor(0)
            .setDepth(band.depth).setVisible(false));
        }
      }
      scene.events?.once?.('shutdown', () => this.destroy());
    }

    hide() {
      for (const pool of this.pools) {
        for (const image of pool) image.setVisible(false);
      }
    }

    render() {
      const scene = this.scene;
      if (!this.pools[0].length) return;
      const weight = scope.GRIM_WORLD_ART?.biomeWeights?.(scene.distance)?.forest || 0;
      if (!weight || scene.hasTeleported || !scene.biomeBackdrops?.forest ||
          CONCEALED.has(scene.state) || !Number.isFinite(scene.startX)) {
        this.hide();
        return;
      }

      // Absolute scroll projects the same cells during normal play, rewind and
      // teleports. No timer, mutable scenery RNG or rewind snapshot is needed.
      const travel = scene.cameraX - scene.startX;
      for (let i = 0; i < BANDS.length; i++) {
        this.drawBand(BANDS[i], this.pools[i], travel, weight);
      }
    }

    drawBand(band, pool, travel, weight) {
      const {seed, width, height} = this.scene;
      const offset = travel * band.rate;
      const scaleHeight = Math.min(height, 540);
      // Include wide branches outside the viewport before testing exact bounds.
      const margin = scaleHeight * .85;
      const first = Math.floor((offset - margin) / band.stride);
      const last = Math.floor((width + offset + margin) / band.stride);
      let used = 0;
      for (let cell = first; cell <= last && used < pool.length; cell++) {
        const salt = band.salt;
        const clearing = .07 + .28 * variation(seed, Math.floor(cell / 3), salt + 7);
        if (variation(seed, cell, salt) < clearing) continue;
        const selection = Math.floor(variation(seed, cell, salt + 1) * band.pieces.length);
        const previous = Math.floor(variation(seed, cell - 1, salt + 1) * band.pieces.length);
        const piece = band.pieces[selection === previous ? (selection + 1) % band.pieces.length : selection];
        const x = (cell + .08 + .84 * variation(seed, cell, salt + 2)) * band.stride - offset;
        const y = height * band.base + (variation(seed, cell, salt + 3) - .5) * scaleHeight * .085;
        const frame = this.atlas.get(piece[0]);
        const scale = scaleHeight * piece[1] * (.82 + .34 * variation(seed, cell, salt + 4)) / frame.height;
        const radius = frame.width * scale * .5;
        if (x + radius < 0 || x - radius > width) continue;
        const image = pool[used++];
        if (image.frame.name !== piece[0]) image.setFrame(piece[0]);
        image.setPosition(x, y).setScale(scale).setFlipX(variation(seed, cell, salt + 5) < .5)
          .setAlpha(weight * band.opacity * (.86 + .14 * variation(seed, cell, salt + 6)))
          .setVisible(true);
      }
      for (; used < pool.length; used++) pool[used].setVisible(false);
    }

    destroy() {
      for (const pool of this.pools) {
        for (const image of pool) image.destroy();
        pool.length = 0;
      }
    }
  }

  scope.GRIM_FOREST_MIDGROUND = {preload, ForestMidground};
})(typeof window !== 'undefined' ? window : globalThis);
