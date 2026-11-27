// Forest Campaign music streams in once per track. A single shared AudioContext
// owns both the independent music bus and the existing action-sound bus.
const files = {descent:'caves-descent.ogg',brood:'caves-brood.ogg',crossing:'tundra-crossing.ogg',crown:'tundra-crown.ogg',climb:'foothills-climb.ogg',pursuit:'foothills-pursuit.ogg',walk:'forest-walk.ogg', guardian:'forest-guardian.ogg', victory:'forest-victory.ogg'};
const mute = document.getElementById('mute-music');
const volume = document.getElementById('music-volume');
try {
  const oldMute = localStorage.getItem('grimRun.actionSoundsMuted');
  const musicMute = localStorage.getItem('grimRun.musicMuted');
  mute.checked = (musicMute ?? oldMute) === '1';
  // Import the legacy shared mute once. Later action-only changes are independent.
  if (musicMute === null) localStorage.setItem('grimRun.musicMuted', mute.checked ? '1' : '0');
  const saved = localStorage.getItem('grimRun.musicVolume');
  if (saved !== null && Number.isFinite(Number(saved))) volume.value = saved;
} catch {}

export class ForestScore {
  constructor() {
    this.buffers = new Map();
    this.section = null;
    this.position = 0;
    this.onSettings = () => {
      try {
        localStorage.setItem('grimRun.musicMuted', mute.checked ? '1' : '0');
        localStorage.setItem('grimRun.musicVolume', volume.value);
      } catch {}
      this.refresh();
    };
    mute.addEventListener('change', this.onSettings);
    volume.addEventListener('input', this.onSettings);
    this.onVisibility = () => { if (document.hidden) this.select(null); };
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  get enabled() { return !mute.checked && Number(volume.value) > 0 && !document.hidden; }

  load(section, context) {
    if (!this.buffers.has(section)) {
      const url = new URL(files[section], import.meta.url);
      const promise = fetch(url).then(response => {
        if (!response.ok) throw Error('Score unavailable');
        return response.arrayBuffer();
      }).then(bytes => context.decodeAudioData(bytes)).catch(() => null);
      this.buffers.set(section, promise);
    }
    return this.buffers.get(section);
  }

  prepareFinale(boss='guardian') {
    const context = window.GRIM_ACTION_AUDIO?.context;
    if (!context || !this.enabled) return;
    this.load(boss, context);
    this.load('victory', context);
  }

  select(section, position = 0) {
    this.position = Math.max(0, position);
    const context = window.GRIM_ACTION_AUDIO?.context;
    if (this.section === section && this.context === context) return;
    this.section = section;
    this.context = context;
    this.refresh();
  }

  refresh() {
    const context = this.context;
    const target = this.enabled ? this.section : null;
    if (this.bus && context) this.bus.gain.setTargetAtTime(Number(volume.value) / 100 * .48, context.currentTime, .018);
    if (target === this.target) return;
    this.target = target;
    const generation = this.generation = (this.generation || 0) + 1;
    if (this.voice) {
      const {source, gain} = this.voice;
      gain.gain.cancelAndHoldAtTime?.(context.currentTime);
      gain.gain.setTargetAtTime(0, context.currentTime, .009);
      source.stop(context.currentTime + .045);
      this.voice = null;
    }
    if (!target || !context) {
      this.target = null;
      return;
    }
    this.load(target, context).then(buffer => {
      if (generation !== this.generation || !this.enabled) return;
      if (!buffer) {
        // A later resume or replay can retry a transient download failure.
        this.buffers.delete(target);
        return;
      }
      if (!this.bus) {
        this.bus = context.createGain();
        this.bus.gain.value = Number(volume.value) / 100 * .48;
        this.bus.connect(context.destination);
      }
      const loop = target !== 'victory';
      if (!loop && this.position >= buffer.duration) return;
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffer;
      source.loop = loop;
      const now = context.currentTime;
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(1, now, .014);
      source.connect(gain).connect(this.bus);
      this.voice = {source, gain};
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        if (this.voice?.source === source) this.voice = null;
      };
      source.start(now, loop ? this.position % buffer.duration : this.position);
    });
  }

  dispose() {
    this.select(null);
    this.bus?.disconnect();
    this.buffers.clear();
    document.removeEventListener('visibilitychange', this.onVisibility);
    mute.removeEventListener('change', this.onSettings);
    volume.removeEventListener('input', this.onSettings);
  }
}
