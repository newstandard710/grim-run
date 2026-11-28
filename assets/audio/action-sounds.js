// Short original synthesized cues. All times are in seconds and pitches in Hz.
(() => {
  const voices = {
    jump:   ['sine', 195, 425, .105, .12],
    land:   ['triangle', 138, 62, .085, .18],
    rush:   ['triangle', 560, 126, .095, .085],
    cut:    ['sawtooth', 315, 82, .075, .11],
    plant:  ['triangle', 410, 215, .11, .09],
    bat:    ['sine', 820, 1160, .12, .08],
    imp:    ['sawtooth', 140, 295, .15, .075],
    impact: ['triangle', 345, 175, .07, .11],
    defeat: ['triangle', 245, 66, .14, .13],
    silk:   ['triangle', 730, 240, .125, .065],
    knot:   ['sine', 660, 990, .115, .19],
    damage: ['triangle', 182, 46, .21, .20]
  };
  const key = 'grimRun.actionSoundsMuted';
  let muted = false;
  try { muted = localStorage.getItem(key) === '1'; } catch {}
  const toggle = document.getElementById('mute-actions');
  toggle.checked = muted;
  let context, output, bladeSwing, playing = false;
  const active = new Set();
  // Bake a mono swish once on audio unlock. The passing blade pushes air first,
  // then its edge hisses and rings briefly as it reaches the active cut.
  function makeBladeSwing(audio) {
    const rate = 24000, duration = .235;
    const buffer = audio.createBuffer(1, Math.round(rate * duration), rate);
    const samples = buffer.getChannelData(0);
    let air = 0, rumble = 0, edge = 0;
    for (let i = 0; i < samples.length; i++) {
      const t = i / rate;
      const pass = t < .072 ? (t / .072) ** 1.4 : Math.exp(-35 * (t - .072));
      const noise = Math.random() * 2 - 1;
      air += (.14 + .36 * pass) * (noise - air);
      rumble += .065 * (air - rumble);
      // The edge has a brighter, shorter scrape and three quiet steel resonances.
      const edgeTime = Math.max(0, t - .044);
      const scrape = (1 - Math.exp(-95 * edgeTime)) * Math.exp(-29 * edgeTime);
      edge += .76 * (noise - edge);
      const phase = 2 * Math.PI * edgeTime;
      const ring = Math.sin(phase * 1847) + .65 * Math.sin(phase * 3023) + .36 * Math.sin(phase * 4379);
      const fade = Math.min(1, (samples.length - 1 - i) / (rate * .012));
      samples[i] = fade * (.32 * pass * (air - rumble) + scrape * (.13 * (edge - air) + .030 * ring));
    }
    return buffer;
  }
  function track(source, envelope) {
    active.add(source);
    source.onended = () => {
      active.delete(source);
      source.disconnect();
      envelope?.disconnect();
    };
  }
  function silence() {
    for (const source of active) source.stop();
    active.clear();
  }
  function unlock(event) {
    if (!event.isTrusted || document.hidden) return;
    if (muted && !document.getElementById('music-settings')?.dataset.available) return;
    try {
      if (!context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        context = new Audio();
        output = context.createGain();
        output.gain.value = .68;
        output.connect(context.destination);
        bladeSwing = makeBladeSwing(context);
      }
      if (context.state !== 'running') context.resume().catch(() => {});
    } catch { /* Gameplay can continue when device audio is unavailable. */ }
  }
  for (const event of ['pointerup', 'keydown']) document.addEventListener(event, unlock, true);
  toggle.addEventListener('change', event => {
    muted = toggle.checked;
    if (muted) silence(); else unlock(event);
    try { localStorage.setItem(key, muted ? '1' : '0'); } catch {}
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) silence(); });
  window.GRIM_ACTION_AUDIO = {
    get context() { return context; },
    setPlaying(value) {
      playing = value;
      if (!value) silence();
    },
    play(name) {
      if (!playing || muted || document.hidden || context?.state !== 'running') return;
      if (name === 'swing') {
        const blade = context.createBufferSource();
        blade.buffer = bladeSwing;
        blade.playbackRate.value = .97 + .06 * Math.random();
        blade.connect(output);
        track(blade);
        blade.start();
        return;
      }
      const [type, start, end, length, volume] = voices[name];
      const oscillator = context.createOscillator(), envelope = context.createGain();
      const now = context.currentTime;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(start, now);
      oscillator.frequency.exponentialRampToValueAtTime(end, now + length);
      envelope.gain.setValueAtTime(.0001, now);
      envelope.gain.exponentialRampToValueAtTime(volume, now + .005);
      envelope.gain.exponentialRampToValueAtTime(.0001, now + length);
      oscillator.connect(envelope);
      envelope.connect(output);
      track(oscillator, envelope);
      oscillator.start(now);
      oscillator.stop(now + length);
    }
  };
})();
