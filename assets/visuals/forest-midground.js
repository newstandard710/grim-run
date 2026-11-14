/* Seeded Forest scenery projected in two visual planes behind the playable ground. */
(function(scope) {
  'use strict';

  const ATLAS = 'forest-midground-v1';
  const ROOT = 'assets/visuals/forest-midground/v1/forest-midground';
  const BANDS = [
    {
      depth: -24, rate: .16, stride: 440, base: .77, color: 0x273945, salt: 0x519,
      opacity: [.60, .72], treeHeight: [.52, .70],
      // Normalized contact points identify the painted roots, including flared and leaning trunks.
      trees: [
        ['far-leaning-ash', .25, .925], ['far-shadow-grove', .44, .94],
        ['far-open-oak', .59, .935], ['far-bare-pair', .59, .91]
      ],
      cover: [['far-low-canopy', .46, .89, .27], ['far-wooded-bank', .52, .85, .32]]
    },
    {
      depth: -22, rate: .42, stride: 690, base: .87, color: 0x212a2d, salt: 0x776,
      opacity: [.82, .95], treeHeight: [.75, .95],
      trees: [
        ['near-curved-oak', .34, .89], ['near-split-trunk', .34, .92],
        ['near-twin-trunks', .28, .92], ['near-bent-oak', .27, .90]
      ],
      cover: [['near-fern-brush', .48, .86, .23], ['near-mossy-roots', .48, .85, .25]],
      giants: [1, 1.25]
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

  function mix(a, b, fraction) {
    return a + (b - a) * fraction;
  }

  function groundAt(band, seed, x, height, scaleHeight) {
    const segment = x / (band.stride * .75);
    const i = Math.floor(segment), t = segment - i;
    const a = variation(seed, i, band.salt + 8), b = variation(seed, i + 1, band.salt + 8);
    return height * band.base + (mix(a, b, t * t * (3 - 2 * t)) - .5) * scaleHeight * .09;
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
      this.banks = [];
      this.rimClipped = false;
      if (!scene.add?.image || !scene.add?.graphics || !this.atlas ||
          BANDS.some(band => [...band.trees, ...band.cover].some(([key]) => !this.atlas.has(key)))) return;

      for (const [i, band] of BANDS.entries()) {
        this.banks.push(scene.add.graphics().setScrollFactor(0).setDepth(band.depth - .1).setVisible(false));
        for (let k = 0; k < POOL_PER_BAND; k++) {
          this.pools[i].push(scene.add.image(0, 0, ATLAS, band.trees[0][0])
            .setScrollFactor(0).setDepth(band.depth).setVisible(false));
        }
      }
      scene.events?.once?.('shutdown', () => this.destroy());
    }

    hide() {
      for (const pool of this.pools) {
        for (const image of pool) image.setVisible(false);
      }
      for (const bank of this.banks) bank.setVisible(false);
    }

    render(sections) {
      if (!this.pools[0].length) return;
      const scene = this.scene;
      const weight = scope.GRIM_WORLD_ART?.biomeWeights?.(scene.distance)?.forest || 0;
      if (!weight || scene.hasTeleported || !scene.biomeBackdrops?.forest ||
          CONCEALED.has(scene.state) || !Number.isFinite(scene.startX)) {
        this.hide();
        return;
      }

      this.clipRims(sections || []);
      const travel = scene.cameraX - scene.startX;
      for (const [i, band] of BANDS.entries()) {
        this.drawBand(band, this.pools[i], this.banks[i], travel, weight);
      }
    }

    clipRims(sections) {
      const {scene} = this;
      if (!scene.make?.graphics) return;
      const {width, height, cameraX, cameraY} = scene;
      const gaps = sections.filter(s => s.kind === 'gap' && s.start < cameraX + width && s.end > cameraX);
      if (!gaps.length && !this.rimClipped) return;
      if (gaps.length) {
        this.rim ||= scene.make.graphics({x: 0, y: 0, add: false}).setScrollFactor(0);
        this.rimMask ||= this.rim.createGeometryMask();
        const contour = [{x: -1, y: height + 1}];
        for (const gap of gaps) {
          const a = gap.start - cameraX, b = gap.end - cameraX;
          const left = Math.max(-1, a), right = Math.min(width + 1, b);
          const rimY = x => Math.min(height + 1, Math.max(-1, mix(gap.y0, gap.y1, (x - a) / (b - a)) - cameraY));
          contour.push({x: left, y: height + 1}, {x: left, y: rimY(left)},
            {x: right, y: rimY(right)}, {x: right, y: height + 1});
        }
        contour.push({x: width + 1, y: height + 1}, {x: width + 1, y: -2}, {x: -1, y: -2});
        this.rim.clear().fillStyle(0xffffff).fillPoints(contour, true);
      }
      if (Boolean(gaps.length) !== this.rimClipped) {
        this.rimClipped = Boolean(gaps.length);
        for (const view of [...this.banks, ...this.pools.flat()]) {
          if (this.rimClipped) view.setMask(this.rimMask);
          else view.clearMask();
        }
      }
    }

    drawBand(band, pool, bank, travel, weight) {
      const {seed, width, height, cameraY} = this.scene;
      const offset = travel * band.rate;
      const scaleHeight = Math.min(height, 540);
      const drift = Math.max(-height * .13, Math.min(height * .13, cameraY * band.rate));
      const ground = x => groundAt(band, seed, x, height, scaleHeight) - drift;
      // Enlarged crowns can enter from beyond a full viewport height away.
      const margin = scaleHeight * 1.75;
      const first = Math.floor((offset - margin) / band.stride);
      const last = Math.floor((width + offset + margin) / band.stride);
      const {salt} = band;
      let used = 0;
      bank.clear().setVisible(true).setAlpha(weight);
      for (let cell = first; cell <= last && used < pool.length; cell++) {
        const density = variation(seed, Math.floor(cell / 3), salt + 7);
        const kind = variation(seed, cell, salt);
        if (kind < .08 + .21 * density) continue;
        const isCover = kind < .26 + .25 * density;
        const pieces = isCover ? band.cover : band.trees;
        const selection = Math.floor(variation(seed, cell, salt + 1) * pieces.length);
        const previous = Math.floor(variation(seed, cell - 1, salt + 1) * pieces.length);
        const [key, rootX, rootY, coverHeight] = pieces[
          selection === previous ? (selection + 1) % pieces.length : selection];
        const worldX = (cell + .20 + .60 * variation(seed, cell, salt + 2)) * band.stride;
        const x = worldX - offset, y = ground(worldX);
        const tall = band.giants && variation(seed, cell, salt + 3) < .24;
        const size = variation(seed, cell, salt + 4);
        const relativeHeight = isCover ? coverHeight * mix(.85, 1.12, size)
          : mix(...(tall ? band.giants : band.treeHeight), size);
        const frame = this.atlas.get(key);
        const scale = scaleHeight * relativeHeight / frame.height;
        const flip = variation(seed, cell, salt + 5) < .5;
        const left = (flip ? 1 - rootX : rootX) * frame.width * scale;
        if (x - left > width || x + frame.width * scale - left < 0) continue;
        const image = pool[used++];
        if (image.frame.name !== key) image.setFrame(key);
        image.setOrigin(rootX, rootY).setPosition(x, y).setScale(flip ? -scale : scale, scale)
          .setAlpha(weight * mix(...band.opacity, variation(seed, cell, salt + 6))).setVisible(true);
        this.drawBank(bank, band, ground, worldX, x, scaleHeight, Math.min(frame.width * scale * .54, band.stride * .32));
      }
      for (; used < pool.length; used++) pool[used].setVisible(false);
    }

    drawBank(bank, band, ground, worldX, x, height, radius) {
      // Low, tapered banks back the illustrated root flares. All points share
      // the same ground profile and camera projection as their tree.
      const points = [];
      for (let i = -3; i <= 3; i++) {
        const dx = radius * i / 3;
        points.push({x: x + dx, y: ground(worldX + dx)});
      }
      for (let i = 3; i >= -3; i--) {
        const dx = radius * i / 3;
        points.push({x: x + dx, y: ground(worldX + dx) + (1 - Math.abs(i) / 3) * height * .11});
      }
      bank.fillStyle(band.color, .57).fillPoints(points, true);
    }

    destroy() {
      this.rimMask?.destroy();
      this.rim?.destroy();
      for (const bank of this.banks) bank.destroy();
      for (const pool of this.pools) {
        for (const image of pool) image.destroy();
        pool.length = 0;
      }
    }
  }

  scope.GRIM_FOREST_MIDGROUND = {preload, ForestMidground};
})(typeof window !== 'undefined' ? window : globalThis);
