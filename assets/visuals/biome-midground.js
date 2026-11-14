/* Optional atmosphere. This layer owns no simulation state or random stream. */
(function(scope) {
  'use strict';

  const ROOT = 'assets/visuals/biome-midground/';
  const FOREST_TEXTURE = 'forest-midground-v1';
  const EMPTY_TEXTURE = '__DEFAULT';
  const ATLAS_LIMIT = 3;
  const SLOTS_PER_BAND = 7;
  const PREFETCH_METERS = 420;
  const PORTAL = 5000;
  const FADE_HALF_WIDTH = 180;
  const CONCEALED = new Set(['home', 'menu', 'reliquary', 'vendorIntro', 'portal', 'chest']);
  const RELEASE = new Set(['home', 'menu', 'reliquary']);
  // Each band has [landscape-scale min, max, opacity min, max].
  const STYLES = {
    foothills: [[.45, .65, .55, .70], [.70, .95, .80, .92], 0x303a46],
    tundra: [[.45, .65, .50, .66], [.70, 1.00, .76, .90], 0x3a4658],
    caves: [[.50, .75, .52, .68], [.75, 1.05, .76, .90], 0x262430],
    crystals: [[.45, .65, .48, .64], [.65, .95, .72, .86], 0x28263e],
    ashlands: [[.42, .62, .48, .64], [.65, .92, .78, .91], 0x35282b],
    lava: [[.50, .72, .50, .68], [.75, 1.10, .78, .92], 0x352128],
    boss: [[.55, .80, .55, .72], [.80, 1.20, .80, .94], 0x30252f]
  };
  const BANDS = [
    {name: 'far', rate: .16, depth: -24, stride: 230, floor: .86, ceiling: .10, salt: 179},
    {name: 'near', rate: .42, depth: -22, stride: 295, floor: .93, ceiling: .075, salt: 313}
  ];

  const clamp = (n, low, high) => Math.max(low, Math.min(n, high));
  const mix = (a, b, t) => a + (b - a) * t;
  const textureKey = id => 'biome-midground-v1-' + id;

  function visualHash(seed, cell, salt) {
    let n = seed ^ Math.imul(cell, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b);
    n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
    n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
    return ((n ^ (n >>> 16)) >>> 0) / 0x100000000;
  }

  function planAtlases(distance, underworld, practiceArrival = false) {
    const art = scope.GRIM_WORLD_ART;
    if (!art || !Number.isFinite(distance)) return {active: [], wanted: []};
    const weights = art.biomeWeights(distance);
    const region = underworld ? art.UNDERWORLD_BIOMES : art.SURFACE_BIOMES;
    const active = region.filter(biome => weights[biome.id] > 0)
      .map(biome => [biome.id, weights[biome.id]]);
    const wanted = active.filter(([id]) => STYLES[id])
      .sort((a, b) => b[1] - a[1]).map(([id]) => id);
    const last = active.at(-1)?.[0];
    const next = art.WORLD_BIOMES[art.WORLD_BIOMES.findIndex(biome => biome.id === last) + 1];
    const nextStart = next?.start === PORTAL ? PORTAL : next?.start - FADE_HALF_WIDTH;
    if (last && STYLES[next?.id] && distance >= nextStart - PREFETCH_METERS) wanted.push(next.id);
    if (practiceArrival && active.length === 1 && wanted.length === 1) {
      const index = region.findIndex(biome => biome.id === last);
      const previous = region[index - 1], forward = region[index + 1];
      const backDistance = STYLES[previous?.id] ? distance - region[index].start : Infinity;
      const forwardDistance = STYLES[forward?.id] ? forward.start - distance : Infinity;
      const neighbor = forwardDistance <= backDistance ? forward : previous;
      if (STYLES[neighbor?.id]) wanted.push(neighbor.id);
    }
    return {active: active.filter(([id]) => STYLES[id]), wanted};
  }

  async function loadAtlas(id, signal) {
    const response = await scope.fetch(ROOT + id + '.json', {signal});
    if (!response.ok) throw new Error('Scenery metadata unavailable');
    const data = await response.json();
    const {w, h} = data.meta.size;
    const normalizedPoint = point => Array.isArray(point) && point.length === 2 &&
      point.every(value => Number.isFinite(value) && value >= 0 && value <= 1);
    const bands = [[], []];
    for (const [name, frame] of Object.entries(data.frames)) {
      const band = BANDS.findIndex(spec => spec.name === frame.band);
      const rect = frame.frame;
      const {kind, points} = frame.support;
      if (band < 0 || !normalizedPoint(frame.contact) ||
          !['floor', 'root', 'ceiling', 'arch'].includes(kind) ||
          points.length !== (kind === 'arch' ? 2 : 1) || !points.every(normalizedPoint) ||
          ![rect.x, rect.y, rect.w, rect.h].every(Number.isInteger) ||
          rect.x < 0 || rect.y < 0 || rect.w <= 0 || rect.h <= 0 ||
          rect.x + rect.w > w || rect.y + rect.h > h)
        throw new Error('Invalid scenery metadata');
      bands[band].push({name, ...frame});
    }
    if (bands.some(frames => !frames.length)) throw new Error('Empty scenery band');

    const artwork = await scope.fetch(ROOT + id + '.webp', {signal});
    if (!artwork.ok) throw new Error('Scenery texture unavailable');
    const blob = await artwork.blob();
    signal.throwIfAborted();
    // Decode without a document/image load event so throttled or sleeping
    // game loops can still complete prefetch. Phaser consumes this as a canvas
    // atlas source in both renderers.
    if (scope.createImageBitmap && scope.document) {
      const bitmap = await scope.createImageBitmap(blob);
      try {
        signal.throwIfAborted();
        if (bitmap.width !== w || bitmap.height !== h) throw new Error('Scenery texture dimensions disagree');
        const image = scope.document.createElement('canvas');
        image.width = w;
        image.height = h;
        image.getContext('2d').drawImage(bitmap, 0, 0);
        return {data, bands, image};
      } finally {
        bitmap.close();
      }
    }
    const url = scope.URL.createObjectURL(blob);
    const image = new scope.Image();
    try {
      await new Promise((resolve, reject) => {
        const abort = () => {
          image.src = '';
          finish(signal.reason);
        };
        function finish(error) {
          signal.removeEventListener('abort', abort);
          image.onload = image.onerror = null;
          if (error) reject(error);
          else resolve();
        }
        signal.addEventListener('abort', abort, {once: true});
        image.onload = () => finish();
        image.onerror = () => finish(new Error('Scenery texture failed to decode'));
        image.src = url;
      });
    } finally {
      scope.URL.revokeObjectURL(url);
    }
    if (image.naturalWidth !== w || image.naturalHeight !== h)
      throw new Error('Scenery texture dimensions disagree');
    return {data, bands, image};
  }

  class AtlasStream {
    constructor(textures, detach, loader = loadAtlas) {
      this.textures = textures;
      this.detach = detach;
      this.loader = loader;
      this.loaded = new Map();
      this.failed = new Set();
      this.wanted = [];
      this.pending = null;
      this.closed = false;
    }

    request(priorities) {
      if (this.closed) return;
      const capacity = ATLAS_LIMIT - Number(this.textures.exists(FOREST_TEXTURE));
      const wanted = priorities.slice(0, capacity);
      if (wanted.length === this.wanted.length && wanted.every((id, i) => id === this.wanted[i])) return;
      this.wanted = wanted;
      for (const id of this.loaded.keys()) if (!wanted.includes(id)) this.drop(id);
      for (const id of this.failed) if (!wanted.includes(id)) this.failed.delete(id);
      const firstMissing = this.next();
      if (this.pending && this.pending.id !== firstMissing) this.pending.controller.abort();
      this.pump();
    }

    next() {
      return this.wanted.find(id => !this.loaded.has(id) && !this.failed.has(id));
    }

    drop(id) {
      this.detach(id);
      this.loaded.delete(id);
      this.textures.remove(textureKey(id));
    }

    async pump() {
      if (this.closed || this.pending) return;
      const id = this.next();
      if (!id) return;
      const controller = new AbortController();
      const {signal} = controller;
      const timer = setTimeout(() => controller.abort(new Error('Scenery load timed out')), 12000);
      this.pending = {id, controller};
      try {
        const payload = await this.loader(id, signal);
        if (this.closed || signal.aborted || !this.wanted.includes(id)) return;
        const texture = this.textures.addAtlas(textureKey(id), payload.image, payload.data);
        if (!texture) throw new Error('Scenery texture registration failed');
        this.loaded.set(id, payload.bands);
      } catch {
        if (!this.closed && this.wanted.includes(id) &&
            (!signal.aborted || signal.reason?.message === 'Scenery load timed out')) {
          this.failed.add(id);
        }
      } finally {
        clearTimeout(timer);
        this.pending = null;
        void this.pump();
      }
    }

    destroy() {
      this.closed = true;
      this.pending?.controller.abort();
      for (const id of this.loaded.keys()) this.drop(id);
      this.wanted = [];
      this.failed.clear();
    }
  }

  function landscapeAt(band, seed, x, height, ceiling) {
    const period = band.stride * .76;
    const cell = Math.floor(x / period);
    const t = x / period - cell;
    const salt = band.salt + (ceiling ? 29 : 19);
    const roll = mix(visualHash(seed, cell, salt), visualHash(seed, cell + 1, salt), t * t * (3 - 2 * t));
    return height * (ceiling ? band.ceiling : band.floor) + (roll - .5) * Math.min(height, 540) * .07;
  }

  function formation(band, seed, cell, frames, tuning, camera, weight) {
    const {width, height, travel, project} = camera;
    const {stride, rate, salt} = band;
    const group = Math.floor(cell / 4);
    const density = visualHash(seed, group, salt + 1);
    if (density < .12 || visualHash(seed, cell, salt + 2) < mix(.62, .12, density)) return null;

    const bucket = frames.length > 1 ? cell & 1 : 0;
    const count = Math.ceil((frames.length - bucket) / 2);
    const frame = frames[bucket + 2 * Math.floor(visualHash(seed, cell, salt + 3) * count)];
    const [minSize, maxSize, minAlpha, maxAlpha] = tuning;
    const landscapeHeight = Math.min(height, 540) * .70;
    const scale = landscapeHeight * mix(minSize, maxSize, visualHash(seed, cell, salt + 4)) /
      Math.max(frame.frame.w, frame.frame.h);
    const direction = visualHash(seed, cell, salt + 5) < .5 ? -1 : 1;
    const worldX = (cell + mix(.18, .82, visualHash(seed, cell, salt + 6))) * stride;
    const x = worldX - travel * rate;
    const [originX, originY] = frame.contact;
    const frameWidth = frame.frame.w * scale;
    const left = x - (direction > 0 ? originX : 1 - originX) * frameWidth;
    if (left >= width || left + frameWidth <= 0) return null;
    const kind = frame.support.kind;
    const ceiling = kind === 'ceiling';
    const profile = dx => {
      const anchor = worldX + dx;
      return landscapeAt(band, seed, anchor, height, ceiling) + project(band, anchor);
    };
    const points = frame.support.points.map(([px, py]) => [
      (px - originX) * frameWidth * direction, (py - originY) * frame.frame.h * scale
    ]);
    const y = points.reduce((sum, [dx, dy]) => sum + profile(dx) - dy, 0) / points.length;
    const alpha = weight * mix(minAlpha, maxAlpha, visualHash(seed, cell, salt + 7));
    const footprint = kind === 'arch' ? .19 : kind === 'root' ? .46 : .40;
    const supports = points.map(([dx, dy]) => ({
      x: x + dx, y: y + dy,
      // Each footing is attached to its painted contact and to its own
      // projected substrate. The two arch footings leave the span open.
      ground: profile(dx),
      radius: Math.min(frameWidth * footprint, stride * .35),
      thickness: landscapeHeight * (ceiling ? .065 : kind === 'root' ? .044 : .053),
      direction: ceiling ? -1 : 1
    }));
    return {frame, x, y, scale, direction, alpha, supports, profile};
  }

  function rimContour(sections, camera) {
    const {width, height, cameraX, cameraY} = camera;
    const gaps = sections.filter(s => s.kind === 'gap' && s.start < cameraX + width && s.end > cameraX);
    if (!gaps.length) return null;
    const contour = [{x: -1, y: height + 1}];
    for (const gap of gaps) {
      const a = gap.start - cameraX, b = gap.end - cameraX;
      const left = Math.max(-1, a), right = Math.min(width + 1, b);
      const rimY = x => clamp(mix(gap.y0, gap.y1, (x - a) / (b - a)) - cameraY, -1, height + 1);
      contour.push({x: left, y: height + 1}, {x: left, y: rimY(left)},
        {x: right, y: rimY(right)}, {x: right, y: height + 1});
    }
    contour.push({x: width + 1, y: height + 1}, {x: width + 1, y: -2}, {x: -1, y: -2});
    return contour;
  }

  class BiomeMidground {
    constructor(scene) {
      this.scene = scene;
      this.groups = [];
      this.stream = new AtlasStream(scene.textures, id => this.detach(id));
      scene.events.once('shutdown', () => this.destroy());
    }

    createGroup() {
      const {add} = this.scene;
      const layers = BANDS.map(band => ({
        bank: add.graphics().setScrollFactor(0).setDepth(band.depth - .1).setVisible(false),
        images: Array.from({length: SLOTS_PER_BAND}, () =>
          add.image(0, 0, EMPTY_TEXTURE).setScrollFactor(0).setDepth(band.depth).setVisible(false))
      }));
      return {id: null, layers};
    }

    hideGroup(group) {
      for (const {bank, images} of group.layers) {
        bank.setVisible(false);
        for (const image of images) image.setVisible(false);
      }
    }

    hide(release = false) {
      for (const group of this.groups) this.hideGroup(group);
      if (release) {
        this.practiceArrival = undefined;
        this.stream.request([]);
      }
    }

    prioritizeTeleport(distance) {
      this.practiceArrival = distance;
    }

    detach(id) {
      for (const group of this.groups) {
        if (group.id !== id) continue;
        this.hideGroup(group);
        for (const {images} of group.layers)
          for (const image of images) image.setTexture(EMPTY_TEXTURE);
        group.id = null;
      }
    }

    render(sections, project) {
      const {scene} = this;
      if (!Number.isFinite(scene.startX) || RELEASE.has(scene.state)) {
        this.hide(true);
        return;
      }
      const arrival = Math.abs(scene.distance - this.practiceArrival) <= PREFETCH_METERS;
      if (!arrival) this.practiceArrival = undefined;
      const {active, wanted} = planAtlases(scene.distance, scene.hasTeleported, arrival);
      // The same call follows a confirmed teleport, before the next simulation
      // step. Replacing the whole priority list cancels obsolete prefetches.
      this.stream.request(wanted);
      if (CONCEALED.has(scene.state)) {
        this.hide();
        return;
      }
      const camera = {width: scene.width, height: scene.height, cameraX: scene.cameraX,
        cameraY: scene.cameraY, project, travel: scene.cameraX - scene.startX};
      const ready = active.filter(([id]) => this.stream.loaded.has(id) && scene.biomeBackdrops?.[id]);
      if (!ready.length) {
        this.hide();
        return;
      }
      this.updateMask(sections, camera);
      for (const [index, [id, weight]] of ready.entries()) {
        const group = this.groups[index] ?? (this.groups[index] = this.createGroup());
        if (group.id !== id) {
          this.hideGroup(group);
          for (const {images} of group.layers)
            for (const image of images) image.setTexture(EMPTY_TEXTURE);
          group.id = id;
        }
        const frames = this.stream.loaded.get(id);
        const salt = scope.GRIM_WORLD_ART.WORLD_BIOMES.findIndex(biome => biome.id === id);
        const seed = (scene.seed | 0) ^ Math.imul(salt, 0x51ab4e2d);
        for (const [i, band] of BANDS.entries())
          this.drawBand(group.layers[i], band, frames[i], id, STYLES[id][i], seed, camera, weight);
      }
      for (let i = ready.length; i < this.groups.length; i++) this.hideGroup(this.groups[i]);
    }

    updateMask(sections, camera) {
      const contour = rimContour(sections, camera);
      this.clip = Boolean(contour);
      if (!contour) return;
      if (!this.rim) {
        this.rim = this.scene.make.graphics({x: 0, y: 0, add: false}).setScrollFactor(0);
        this.rimMask = this.rim.createGeometryMask();
      }
      this.rim.clear().fillStyle(0xffffff).fillPoints(contour, true);
    }

    drawBand(layer, band, frames, id, tuning, seed, camera, weight) {
      const {bank, images} = layer;
      const offset = camera.travel * band.rate;
      const margin = Math.min(camera.height, 540) * .86;
      const first = Math.floor((offset - margin) / band.stride);
      const last = Math.floor((offset + camera.width + margin) / band.stride);
      const key = textureKey(id);
      let used = 0;
      bank.clear().setVisible(true);
      if (this.clip) bank.setMask(this.rimMask);
      else if (bank.mask) bank.clearMask();

      for (let cell = first; cell <= last && used < images.length; cell++) {
        const piece = formation(band, seed, cell, frames, tuning, camera, weight);
        if (!piece) continue;
        const {frame, x, y, scale, direction, alpha, supports, profile} = piece;
        const image = images[used++];
        if (image.texture.key !== key || image.frame.name !== frame.name) image.setTexture(key, frame.name);
        image.setOrigin(...frame.contact).setPosition(x, y).setScale(direction * scale, scale)
          .setAlpha(alpha).setVisible(true);
        if (this.clip) image.setMask(this.rimMask);
        else if (image.mask) image.clearMask();

        for (const support of supports)
          this.drawSupport(bank, support, profile, x, STYLES[id][2], alpha);
      }
      for (; used < images.length; used++) images[used].setVisible(false);
    }

    drawSupport(bank, {x, y, ground, radius, thickness, direction}, profile, origin, color, alpha) {
      const lx = x - radius, rx = x + radius;
      const left = profile(lx - origin), right = profile(rx - origin);
      const shoulder = thickness * direction;
      bank.fillStyle(color, alpha * .55).fillPoints([
        {x: lx, y: left + shoulder * .20},
        {x: x - radius * .40, y: mix(ground, y, .75) - shoulder * .18},
        {x, y: y - shoulder * .26},
        {x: x + radius * .47, y: mix(ground, y, .7)},
        {x: rx, y: right + shoulder * .34},
        {x: x + radius * .28, y: ground + shoulder * .82},
        {x: x - radius * .50, y: ground + shoulder * .79}
      ], true);
    }

    destroy() {
      for (const group of this.groups)
        for (const {bank, images} of group.layers) {
          bank.destroy();
          for (const image of images) image.destroy();
        }
      this.groups.length = 0;
      this.rimMask?.destroy();
      this.rim?.destroy();
      this.stream.destroy();
    }
  }

  scope.GRIM_BIOME_MIDGROUND = {BiomeMidground, AtlasStream, planAtlases, formation,
    rimContour, loadAtlas, BANDS, STYLES};
})(typeof window !== 'undefined' ? window : globalThis);
