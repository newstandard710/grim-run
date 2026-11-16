/* Optional light in the distant painted fall. Reads the run clock for phase. */
(function (scope) {
  'use strict';

  const KEY = 'lavafall-detail-v1';
  const SOURCE = 'assets/visuals/biomes/lavafall-detail-v1.png';
  const PLATE_WIDTH = 1536;
  const PLATE_HEIGHT = 864;
  const DETAIL_WIDTH = 24;
  const DETAIL_HEIGHT = 64;
  // The full swept rectangle is x=1117..1140, y=131..237 in the approved plate.
  const LEFT = 1117;
  const TOP = 131;
  const TRAVEL = 43;
  const OPACITY = .095;
  const CYCLE_ENDS = [8.3, 19, 28.1, 39.7, 48.6, 58.8, 68.5];
  const WORLD_STATES = new Set(['playing', 'paused', 'countdown', 'rewinding',
    'respawning', 'dying', 'teleportConfirm', 'abandonConfirm']);

  function ease(value) {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  }

  class LavafallDetail {
    constructor(scene) {
      this.scene = scene;
      this.reducedMotion = scope.matchMedia?.('(prefers-reduced-motion: reduce)');
      scene.events?.once?.('shutdown', () => this.release());
    }

    request() {
      if (this.pending || this.failed || typeof scope.Image !== 'function') return;
      const image = new scope.Image();
      this.pending = image;
      image.onload = () => {
        if (this.pending !== image) return;
        this.pending = null;
        image.onload = image.onerror = null;
        if (image.naturalWidth !== DETAIL_WIDTH || image.naturalHeight !== DETAIL_HEIGHT) {
          this.failed = true;
          return;
        }
        const {textures, add} = this.scene;
        if (!textures?.addImage || !add?.image || !textures.addImage(KEY, image)) {
          this.failed = true;
          return;
        }
        this.view = add.image(0, 0, KEY).setOrigin(0).setScrollFactor(0).setVisible(false);
      };
      image.onerror = () => {
        if (this.pending !== image) return;
        this.pending = null;
        image.onload = image.onerror = null;
        this.failed = true;
      };
      image.src = SOURCE;
    }

    release() {
      if (this.pending) {
        const image = this.pending;
        this.pending = null;
        image.onload = image.onerror = null;
        image.removeAttribute('src');
      }
      if (this.view) {
        this.view.destroy();
        this.view = null;
        if (this.scene.textures?.exists(KEY)) this.scene.textures.remove(KEY);
      }
      this.failed = false;
    }

    sync(backdrop, lavaWeight) {
      const {distance, elapsed, state, width, height} = this.scene;
      const weight = lavaWeight * ease((distance - 8180) / 60) * ease((9819 - distance) / 60);
      if (!(weight > 0) || !WORLD_STATES.has(state) || this.reducedMotion?.matches ||
          !backdrop?.visible || backdrop.width !== PLATE_WIDTH || backdrop.height !== PLATE_HEIGHT ||
          !Number.isFinite(elapsed)) {
        this.view?.setVisible(false);
        return;
      }
      if (!this.view) {
        this.request();
        return;
      }

      const time = (elapsed + .8) % CYCLE_ENDS[CYCLE_ENDS.length - 1];
      let end = 0;
      while (time >= CYCLE_ENDS[end]) end++;
      const start = end ? CYCLE_ENDS[end - 1] : 0;
      const phase = (time - start) / (CYCLE_ENDS[end] - start);
      const alpha = OPACITY * weight * ease(phase / .16) * ease((1 - phase) / .19);
      const scaleX = backdrop.displayWidth / PLATE_WIDTH;
      const scaleY = backdrop.displayHeight / PLATE_HEIGHT;
      const x = backdrop.x + (LEFT - PLATE_WIDTH / 2) * scaleX;
      const y = backdrop.y + (TOP + TRAVEL * phase - PLATE_HEIGHT / 2) * scaleY;
      const drawWidth = DETAIL_WIDTH * scaleX;
      const drawHeight = DETAIL_HEIGHT * scaleY;
      if (alpha <= 0 || x >= width || x + drawWidth <= 0 || y >= height || y + drawHeight <= 0) {
        this.view.setVisible(false);
        return;
      }
      const depth = backdrop.depth + .001;
      if (this.view.depth !== depth) this.view.setDepth(depth);
      if (this.view.displayWidth !== drawWidth || this.view.displayHeight !== drawHeight)
        this.view.setDisplaySize(drawWidth, drawHeight);
      this.view.setPosition(x, y).setAlpha(alpha).setVisible(true);
    }
  }

  scope.GRIM_LAVAFALL_DETAIL = {LavafallDetail};
})(typeof window !== 'undefined' ? window : globalThis);
