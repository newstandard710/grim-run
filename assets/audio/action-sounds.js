// Short original synthesized cues. All times are in seconds and pitches in Hz.
(() => {
  const voices = {
    jump:   ['sine', 195, 425, .105, .12],
    land:   ['triangle', 138, 62, .085, .18],
    swing:  ['triangle', 560, 126, .095, .085],
    cut:    ['sawtooth', 315, 82, .075, .11],
    damage: ['triangle', 182, 46, .21, .20]
  };
  const key = 'grimRun.actionSoundsMuted';
  let muted = false;
  try { muted = localStorage.getItem(key) === '1'; } catch {}
  const toggle = document.getElementById('mute-actions');
  toggle.checked = muted;
  let context, output, playing = false;
  const active = new Set();
  function silence() {
    for (const oscillator of active) oscillator.stop();
    active.clear();
  }
  function unlock(event) {
    if (!event.isTrusted || muted || document.hidden) return;
    try {
      if (!context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        context = new Audio();
        output = context.createGain();
        output.gain.value = .68;
        output.connect(context.destination);
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
    setPlaying(value) {
      playing = value;
      if (!value) silence();
    },
    play(name) {
      if (!playing || muted || document.hidden || context?.state !== 'running') return;
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
      oscillator.onended = () => {
        active.delete(oscillator);
        oscillator.disconnect();
        envelope.disconnect();
      };
      active.add(oscillator);
      oscillator.start(now);
      oscillator.stop(now + length);
    }
  };
})();
