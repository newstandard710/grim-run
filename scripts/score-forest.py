"""Render the original Forest score from the note and instrument definitions below.
Run with Python, NumPy, SciPy and FFmpeg. No external samples or soundfonts.
"""
from pathlib import Path
import subprocess

import numpy as np
from scipy.signal import butter, sosfilt

RATE = 32000
OUT = Path(__file__).resolve().parents[1] / "assets/audio"
TAU = 2 * np.pi


class Score:
    def __init__(self, bpm, beats):
        self.beat = 60 / bpm
        self.samples = round(beats * self.beat * RATE)
        self.mix = np.zeros(self.samples + 4 * RATE)
        self.rng = np.random.default_rng(710)

    def note(self, beat, pitch, length, instrument, gain):
        start = round(beat * self.beat * RATE)
        sustain = length * self.beat
        release = {"reed": .24, "bow": .43, "harp": .65, "drum": .16, "bell": .9}[instrument]
        t = np.arange(round((sustain + release) * RATE)) / RATE
        f = 440 * 2 ** ((pitch - 69) / 12)
        phase = TAU * f * t
        tremolo = 1 + .045 * np.sin(TAU * 4.8 * t)
        if instrument == "reed":
            phase += .07 * np.sin(TAU * 4.9 * t)
            voice = np.sin(phase) + .26 * np.sin(2 * phase) + .13 * np.sin(3 * phase)
            attack = .065
            voice *= tremolo
        elif instrument == "bow":
            # A pair of bowed strings drift apart by four cents.
            voice = sum((np.sin(h * phase) + np.sin(h * phase * 1.0023)) / (2 * h**1.45)
                        for h in range(1, 7)) * tremolo
            attack = .14
        elif instrument == "harp":
            voice = (np.sin(phase) + .44 * np.exp(-7*t) * np.sin(2*phase)
                     + .24 * np.exp(-11*t) * np.sin(4.01*phase)) * np.exp(-2.3*t)
            attack = .009
        elif instrument == "bell":
            voice = (np.sin(phase) + .3 * np.sin(2.72*phase) * np.exp(-3*t)) * np.exp(-1.4*t)
            attack = .012
        else:
            skin = np.sin(phase + 5 * (1 - np.exp(-23*t))) * np.exp(-6*t)
            grain = sosfilt(butter(2, 1150, fs=RATE, output='sos'), self.rng.normal(size=len(t)))
            voice = skin + .24 * grain * np.exp(-32*t)
            attack = .005
        env = np.minimum(1, t / attack) * np.maximum(0, 1 - np.maximum(0, t-sustain)/release)**2
        self.mix[start:start+len(t)] += gain * env * voice

    def write(self, name, loop):
        # Short room reflections give the instruments a common acoustic space.
        room = self.mix.copy()
        for delay, gain in [(.047, .13), (.081, .09), (.143, .075), (.239, .04)]:
            n = round(delay * RATE)
            room[n:] += self.mix[:-n] * gain
        wave = room[:self.samples]
        if loop:
            tail = room[self.samples:]
            wave[:len(tail)] += tail
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(RATE),
                        "-ac", "1", "-i", "-", "-c:a", "libvorbis", "-q:a", "3",
                        str(OUT / (name + ".ogg"))], input=wave.astype('<f4').tobytes(), check=True)


# The calling figure D–A–G–F returns in a lower register over the Guardian's drums.
call = [(0, 74, 1.35), (1.5, 81, .65), (2.25, 79, .42)]
answer = [(0, 77, 1.85), (2.25, 76, .55)]
phrases = [
    call, answer, [(0, 74, 1), (1.5, 72, .8)], [(0, 69, 2.4)],
    [(0, 72, .8), (1, 77, 1.3)], [(0, 76, 1.4), (2, 72, .7)],
    [(0, 71, .7), (.75, 74, 1.55)], [(0, 69, 1.9)],
]
chords = [(50, 57, 65), (46, 53, 62), (48, 55, 64), (45, 52, 60),
          (53, 60, 69), (48, 55, 64), (43, 50, 62), (45, 52, 64)]
forest = Score(78, 72)
for bar in range(24):
    part, phrase = divmod(bar, 8)
    at = bar * 3
    root, fifth, color = chords[phrase]
    forest.note(at, root, 2.56, "bow", .108)
    pattern = [(0, fifth), (.75, color), (1.5, fifth+12), (2.5, color)]
    for pos, pitch in pattern[:3 if part == 0 else 4]:
        forest.note(at+pos, pitch, .62, "harp", .092 if pos == 0 else .073)
    if part == 1:
        forest.note(at+.5, color-5, 1.85, "bow", .074)
    if part == 2 and phrase in (2, 5, 7):
        forest.note(at+1.5, color+12, .6, "bell", .064)
    melody = phrases[phrase]
    if part == 1 and phrase < 4:
        melody = [[(.5, 69, .85), (1.5, 74, .9)], [(0, 77, 2.3)],
                  [(0, 79, .9), (1, 76, .6), (2, 72, .6)], [(0, 73, 2.1)]][phrase]
    for pos, pitch, duration in melody:
        forest.note(at+pos, pitch, duration, "reed", .125)
forest.write("forest-walk", True)

guardian = Score(100, 32)
for bar in range(8):
    at = 4 * bar
    root, fifth, color = chords[bar]
    for pos in (0, 1.5, 2, 3.5):
        guardian.note(at+pos, root-5 if pos == 0 else root, .45, "drum", .19 if pos == 0 else .105)
        guardian.note(at+pos, root, .62 if pos == 0 else .34, "bow", .17)
    guardian.note(at, fifth, 2.6, "bow", .079)
    guardian.note(at+2.75, color, .65, "harp", .105)
    for pos, pitch, duration in phrases[bar]:
        guardian.note(at+pos*1.25, pitch-12, duration*1.15, "reed", .18)
        if bar >= 4:
            guardian.note(at+pos*1.25, pitch, duration, "bow", .079)
guardian.write("forest-guardian", True)

victory = Score(80, 7)
for pos, pitch, length in [(0, 62, .65), (.65, 69, .65), (1.3, 67, .5), (2, 66, 2.6)]:
    victory.note(pos, pitch, length, "reed", .15)
    victory.note(pos+.06, pitch+12, length, "bell", .075)
for pos, pitch in [(0, 50), (.5, 57), (1, 62), (2, 54), (2.5, 57), (3, 62)]:
    victory.note(pos, pitch, 1.4, "harp", .135)
victory.write("forest-victory", False)
