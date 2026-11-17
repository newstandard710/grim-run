/* Read-only terrain projection shared by the two midground renderers. */
(function(scope) {
  'use strict';

  const GRID = 48;
  // Fixed band-space origin near the runner in the reference landscape view.
  // Resizing changes the camera framing without moving a sprite's world anchor.
  const ORIGIN = 240;
  const mix = (a, b, t) => a + (b - a) * t;

  function sampleTerrain(terrain, x) {
    const sections = terrain.segments;
    let low = 0, high = sections.length;
    // Search only generated sections. terrain.groundAt can advance generation
    // when asked for a point beyond the current frontier.
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (sections[middle].end <= x) low = middle + 1;
      else high = middle;
    }
    if (low === sections.length) return sections[low - 1].y1;
    const section = sections[low];
    if (section.kind !== 'gap') return terrain.surfaceAt(section, x);
    // The apparent slope between the banks stays continuous behind the rim
    // mask. The landing bank may start above or below the gap's stored y1.
    return mix(section.y0, sections[low + 1]?.y0 ?? section.y1,
      (x - section.start) / (section.end - section.start));
  }

  function createProjection(scene, referenceX) {
    const {terrain, startX, hasTeleported, groundY, height} = scene;
    const cameraY = scene.renderCameraY ?? scene.cameraY;
    const sections = terrain.segments;
    const first = Math.max(sections[0].start, hasTeleported ? terrain.portalExitX : -Infinity);
    const last = Math.min(sections.at(-1).end, hasTeleported ? Infinity : terrain.portalX);
    const samples = new Map();
    let reference;

    function sampleCell(cell) {
      if (samples.has(cell)) return samples.get(cell);
      const x = cell * GRID;
      const read = offset => sampleTerrain(terrain, Math.max(first, Math.min(last, x + offset)));
      // Filter short terrain steps and keep longer hill slopes and crests.
      const y = (read(-96) + 2 * read(0) + read(96)) * .25;
      samples.set(cell, y);
      return y;
    }

    function elevation(x) {
      const grid = Math.max(first, Math.min(last, x)) / GRID;
      const cell = Math.floor(grid);
      return mix(sampleCell(cell), sampleCell(cell + 1), grid - cell);
    }

    return (band, bandX) => {
      reference ??= elevation(referenceX);
      const {rate} = band;
      const x = startX + ORIGIN + (bandX - ORIGIN) / rate;
      const rise = (elevation(x) - reference) * rate;
      const limit = Math.min(height, 540) * (.13 + rate * .4);
      const relief = rise / Math.hypot(1, rise / limit);
      // Apply the same depth to camera lag, including camera-only and rewind
      // movement. Bound the terrain relief independently of the camera.
      return relief + (reference - groundY - cameraY) * rate;
    };
  }

  scope.GRIM_MIDGROUND_TERRAIN = {createProjection};
})(typeof window !== 'undefined' ? window : globalThis);
