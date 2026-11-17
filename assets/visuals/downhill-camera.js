/* Downhill framing for the rendered world. The simulation keeps its own cameraY. */
(function (scope) {
  'use strict';

  const MAX_OFFSET = 24;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  function smoothstep(value) {
    const t = clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function targetOffset(scene) {
    const { player, terrain, distance } = scene;
    if (!player.grounded || player.onSoulPlatform !== false) return 0;
    const weights = scope.GRIM_WORLD_ART?.biomeWeights(distance) || {};
    const weight = (weights.ashlands || 0) + (weights.boss || 0);
    if (!weight) return 0;

    const from = player.x - 32;
    const middle = player.x + 40;
    const to = player.x + 112;
    // sectionAt() can advance the generator past its current edge. Presentation
    // reads only existing solid ground and tapers before reaching a gap.
    if (to >= terrain.generatedThrough) return 0;
    for (let x = from; x <= to;) {
      const section = terrain.sectionAt(x);
      if (!section || (section.kind !== 'ground' && section.kind !== 'platform')) return 0;
      x = section.end;
    }

    const firstGrade = (terrain.groundAt(middle) - terrain.groundAt(from)) / 72;
    const nextGrade = (terrain.groundAt(to) - terrain.groundAt(middle)) / 72;
    const downhill = Math.min(firstGrade, nextGrade);
    return MAX_OFFSET * weight * smoothstep((downhill - .12) / .25);
  }

  class DownhillCamera {
    constructor() {
      this.offset = 0;
      // Visual values follow the lifetime of the existing rewind snapshots.
      this.rewindOffsets = new WeakMap();
    }

    reset() {
      this.offset = 0;
    }

    step(scene, frameMs) {
      if (frameMs <= 0) return;
      const target = targetOffset(scene);
      const timeConstant = target > this.offset ? 145 : scene.player.grounded ? 160 : 105;
      const change = (target - this.offset) * (1 - Math.exp(-frameMs / timeConstant));
      const maxChange = .15 * frameMs;
      const remaining = target - this.offset;
      this.offset += clamp(Math.abs(remaining) < .02 ? remaining : change, -maxChange, maxChange);
    }

    capture(snapshot) {
      this.rewindOffsets.set(snapshot, this.offset);
    }

    rewind(frames, position, frameMs) {
      const index = Math.floor(position);
      const from = this.rewindOffsets.get(frames[index]) || 0;
      const to = this.rewindOffsets.get(frames[index + 1]) ?? from;
      const target = from + (to - from) * (position - index);
      // Stock rewind restores whole world snapshots. Interpolate and limit the
      // added framing only, then carry that value into the next live frame.
      const maxChange = .18 * Math.min(frameMs, 34);
      this.offset += clamp(target - this.offset, -maxChange, maxChange);
    }

    visibleOffset(scene) {
      switch (scene.state) {
        case 'playing':
        case 'rewinding':
        case 'paused':
        case 'countdown':
        case 'dying':
        case 'revive':
          return this.offset;
        case 'respawning':
          return scene.respawnCamera ? this.offset * (1 - smoothstep((1500 - scene.respawnMs) / 240)) : 0;
        default:
          return 0;
      }
    }
  }

  scope.GRIM_DOWNHILL_CAMERA = { DownhillCamera };
})(typeof window !== 'undefined' ? window : globalThis);
