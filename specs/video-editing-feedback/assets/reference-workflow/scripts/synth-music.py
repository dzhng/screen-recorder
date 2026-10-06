#!/usr/bin/env python3
"""Synthesize placeholder trailer music (stdlib only, deterministic).

  python3 scripts/synth-music.py bed  <out.wav> --length 64 --resolve-at 57.5
  python3 scripts/synth-music.py epic <out.wav> --length 64 --hit-at 56.0
  python3 scripts/synth-music.py drive <out.wav> --length 64 --hit-at 57.5
  python3 scripts/synth-music.py lift  <out.wav> --length 64 --hit-at 57.5
  python3 scripts/synth-music.py promo <out.wav> --length 64 --hit-at 57.5

promo: modern tech-launch cue modelled on the user's jevgrep launch video (120 bpm electronic,
      sub swell + riser intro, drop, pluck hook, held leads, whooshes, breakdown, second drop, hit).

lift:  uplifting Dwarkesh-style bed modelled on real cold opens (held bright chords, pulsing
      arpeggio, bell top line, light percussion building), lifting into --hit-at.
drive: upbeat, exciting cold-open groove. 124 bpm D major (I-V-vi-IV), four-on-the-floor kick,
      claps, hats, pumping bass + pad, 16th-note pluck arpeggio; a snare fill and riser into a
      crash + big D major chord at --hit-at for the title card.

bed:  Dwarkesh-style cold-open bed. Soft piano arpeggios over a warm pad in D minor
      (i-VI-III-VII), resolving to a held Dm(add9) chord at --resolve-at for the title card.
epic: a16z-style build. Low drone and string pad rising across the track, taiko pulses that
      tighten, a noise riser, then a big hit + low brass chord at --hit-at for the logo.

Output is dry 32 kHz stereo 16-bit; add space afterwards with ffmpeg (see notes).
These are placeholders: swap in a licensed track for anything published.
"""
import argparse
import array
import math
import random
import wave

SR = 32000
NOTE = {n: i for i, n in enumerate("C C# D D# E F F# G G# A A# B".split())}


def hz(name):
    """'D3' -> frequency."""
    pitch, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((NOTE[pitch] + 12 * (octave + 1) - 69) / 12)


class Mix:
    def __init__(self, seconds):
        self.n = int(seconds * SR)
        self.l = array.array("f", bytes(4 * self.n))
        self.r = array.array("f", bytes(4 * self.n))

    def add(self, start_s, samples, gain=1.0, pan=0.0):
        s0 = int(start_s * SR)
        gl, gr = gain * math.cos((pan + 1) * math.pi / 4), gain * math.sin((pan + 1) * math.pi / 4)
        l, r, n = self.l, self.r, self.n
        for i, v in enumerate(samples):
            j = s0 + i
            if j >= n:
                break
            if j >= 0:
                l[j] += v * gl
                r[j] += v * gr

    def write(self, path, peak=0.89):
        m = max(max(abs(x) for x in self.l), max(abs(x) for x in self.r)) or 1.0
        k = peak / m
        out = array.array("h", bytes(4 * self.n))
        for i in range(self.n):
            out[2 * i] = int(max(-1, min(1, self.l[i] * k)) * 32767)
            out[2 * i + 1] = int(max(-1, min(1, self.r[i] * k)) * 32767)
        with wave.open(path, "wb") as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(out.tobytes())


def piano(f, dur=3.0, vel=1.0):
    """Felt-piano-ish tone: decaying harmonics, soft attack."""
    n = int(dur * SR)
    parts = [(k, 1.0 / k ** 1.6, 1.2 + 0.9 * k) for k in range(1, 7) if f * k < SR / 2.2]
    out = []
    for i in range(n):
        t = i / SR
        a = min(1.0, t / 0.006)
        v = 0.0
        for k, amp, dec in parts:
            v += amp * math.exp(-dec * t) * math.sin(2 * math.pi * f * k * t)
        out.append(vel * a * v)
    return out


def pad(freqs, dur, attack=1.5, release=1.5, bright=3, detune=0.003, vib=0.0):
    """Sustained chord: detuned harmonics with slow envelope (strings when bright/vib are up)."""
    n = int(dur * SR)
    out = []
    voices = []
    for f in freqs:
        for d in (-detune, detune):
            for k in range(1, bright + 1):
                if f * k < SR / 2.2:
                    voices.append((f * (1 + d), k, 1.0 / k ** 1.3))
    for i in range(n):
        t = i / SR
        env = min(1.0, t / attack) * min(1.0, max(0.0, (dur - t) / release))
        wob = 1 + vib * math.sin(2 * math.pi * 5.2 * t)
        v = 0.0
        for f, k, amp in voices:
            v += amp * math.sin(2 * math.pi * f * k * wob * t)
        out.append(env * v / len(freqs))
    return out


def taiko(dur=1.2, f0=95.0):
    rnd = random.Random(int(f0 * 100))
    out = []
    for i in range(int(dur * SR)):
        t = i / SR
        f = f0 * (0.55 + 0.45 * math.exp(-t * 18))
        body = math.sin(2 * math.pi * f * t) * math.exp(-t * 4.5)
        skin = (rnd.random() * 2 - 1) * math.exp(-t * 40) * 0.35
        out.append(body + skin)
    return out


def riser(dur):
    rnd = random.Random(7)
    out, lp = [], 0.0
    for i in range(int(dur * SR)):
        x = i / (dur * SR)
        lp += (0.05 + 0.6 * x * x) * ((rnd.random() * 2 - 1) - lp)
        out.append(lp * x ** 2.5)
    return out


CHORDS = {
    "Dm": ["D3", "F3", "A3", "D4", "E4"],
    "Bb": ["A#2", "D3", "F3", "A#3", "C4"],
    "F": ["F2", "C3", "F3", "A3", "C4"],
    "C": ["C3", "G3", "C4", "E4", "G4"],
    "Gm": ["G2", "D3", "G3", "A#3", "D4"],
    "A": ["A2", "E3", "A3", "C#4", "E4"],
}


def bed(length, resolve_at):
    mix = Mix(length)
    beat = 60 / 76
    bar2 = 8 * beat
    prog = ["Dm", "Bb", "F", "C"]
    pattern = [0, 2, 3, 4, 3, 2, 1, 2]  # indexes into chord tones, 8th notes
    t, c = 0.0, 0
    while t + bar2 <= resolve_at + 0.01:
        ch = CHORDS[prog[c % 4]]
        root = hz(ch[0]) / 2
        mix.add(t, pad([hz(x) for x in ch[:3]], bar2 + 1.5), gain=0.10 if t > 3.5 else 0.0)
        mix.add(t, pad([root], bar2 + 1.0, attack=0.6, bright=2), gain=0.12)
        for step in range(16):
            tone = ch[pattern[step % 8]]
            f = hz(tone) * (2 if step % 8 in (3, 4) else 1)
            vel = 0.55 + 0.15 * (step % 4 == 0)
            mix.add(t + step * beat / 2, piano(f, 2.4, vel), gain=0.22, pan=-0.3 + 0.6 * ((step * 3) % 5) / 4)
        t += bar2
        c += 1
    # Resolve: held Dm(add9) under the title card.
    end = length - resolve_at
    mix.add(resolve_at, pad([hz(x) for x in CHORDS["Dm"]], end, attack=0.4, release=end * 0.7), gain=0.16)
    mix.add(resolve_at, pad([hz("D2")], end, attack=0.2, release=end * 0.7, bright=2), gain=0.14)
    for i, tone in enumerate(["D4", "A4", "E5", "F5"]):
        mix.add(resolve_at + i * beat, piano(hz(tone), 4.0, 0.7), gain=0.25, pan=-0.2 + 0.15 * i)
    return mix


def epic(length, hit_at):
    mix = Mix(length)
    beat = 60 / 90
    prog = ["Dm", "Bb", "Gm", "A"]
    span = 4 * beat * 2  # two bars per chord
    # Drone.
    mix.add(0, pad([hz("D1"), hz("D2")], hit_at + 0.2, attack=4, release=0.3, bright=6), gain=0.18)
    # Strings rising.
    t, c = 1.0, 0
    while t < hit_at - 0.5:
        d = min(span, hit_at - t) + 0.6
        g = 0.05 + 0.20 * (t / hit_at) ** 1.5
        mix.add(t, pad([hz(x) for x in CHORDS[prog[c % 4]]], d, attack=1.2, release=0.8, bright=5, vib=0.004), gain=g)
        t += span
        c += 1
    # Taiko pulses: every 2 beats from 18 s, every beat from 2/3 of the way, 8ths in the last bar.
    t = 18.0
    while t < hit_at - 0.05:
        x = (t - 18) / (hit_at - 18)
        mix.add(t, taiko(), gain=0.35 + 0.45 * x, pan=0.15 if int(t / beat) % 2 else -0.15)
        step = 2 * beat if x < 0.6 else beat if hit_at - t > 4 * beat else beat / 2
        t += step
    # Riser into the hit.
    mix.add(hit_at - 6.0, riser(6.0), gain=0.35)
    # Hit: big drum + low brass chord, long tail under the logo.
    tail = length - hit_at
    mix.add(hit_at, taiko(3.0, 70.0), gain=1.0)
    mix.add(hit_at, taiko(2.0, 120.0), gain=0.5)
    brass = [hz(x) for x in ["D2", "A2", "D3", "F3"]]
    mix.add(hit_at, pad(brass, tail, attack=0.05, release=tail * 0.8, bright=9), gain=0.30)
    return mix


def noise_hit(dur, decay, seed, bright=True, bursts=1):
    """Hat/clap/crash: (high-passed) noise with exponential decay; claps use several bursts."""
    rnd = random.Random(seed)
    out, prev = [], 0.0
    for i in range(int(dur * SR)):
        t = i / SR
        x = rnd.random() * 2 - 1
        v = (x - prev) if bright else x
        prev = x
        env = 0.0
        for b in range(bursts):
            tb = t - b * 0.011
            if tb >= 0:
                env = max(env, math.exp(-tb / decay))
        out.append(v * env)
    return out


def kick():
    out = []
    for i in range(int(0.35 * SR)):
        t = i / SR
        f = 48 + 110 * math.exp(-t * 32)
        out.append(math.sin(2 * math.pi * f * t) * math.exp(-t * 9) + 0.3 * math.exp(-t * 300) * math.sin(2 * math.pi * 2000 * t))
    return out


def pluck(f, dur=0.32):
    out = []
    for i in range(int(dur * SR)):
        t = i / SR
        v = sum(math.sin(2 * math.pi * f * k * t) * math.exp(-t * (7 + 5 * k)) / k for k in range(1, 6) if f * k < SR / 2.2)
        out.append(min(1.0, t / 0.002) * v)
    return out


def bass(f, dur):
    out = []
    for i in range(int(dur * SR)):
        t = i / SR
        env = min(1.0, t / 0.005) * min(1.0, (dur - t) / 0.02)
        out.append(env * (math.sin(2 * math.pi * f * t) + 0.35 * math.sin(4 * math.pi * f * t) + 0.12 * math.sin(6 * math.pi * f * t)))
    return out


def drive(length, hit_at):
    mix = Mix(length)
    pumped = Mix(length)  # bass + pad, ducked after every kick
    beat = 60 / 124
    bar = 4 * beat
    prog = [("D", ["D3", "F#3", "A3"], "D2"), ("A", ["A2", "C#3", "E3"], "A1"),
            ("Bm", ["B2", "D3", "F#3"], "B1"), ("G", ["G2", "B2", "D3"], "G1")]
    arp = [0, 1, 2, 1, 2, 3, 2, 1]  # chord tone index per 16th (3 = root an octave up)
    # Bars run back from the hit so the downbeat lands exactly on it.
    nbars = int(hit_at // bar)
    start = hit_at - nbars * bar
    for b in range(nbars):
        t0 = start + b * bar
        _, tones, root = prog[b % 4]
        freqs = [hz(x) for x in tones]
        last = b == nbars - 1
        intro = b < 2
        # Pad (bright, pumped).
        pumped.add(t0, pad([f * 2 for f in freqs], bar + 0.05, attack=0.05, release=0.08, bright=4, detune=0.006), gain=0.10)
        for s in range(16):
            ts = t0 + s * beat / 4
            note = freqs[arp[s % 8]] * 2 if arp[s % 8] < 3 else freqs[0] * 4
            mix.add(ts, pluck(note * (2 if s % 4 == 2 else 1)), gain=0.16, pan=0.35 if s % 2 else -0.35)
        for q in range(4):
            tq = t0 + q * beat
            if not intro and not (last and q == 3):
                mix.add(tq, kick(), gain=0.9)
            elif intro:
                mix.add(tq, kick(), gain=0.35)
            if not intro:
                pumped.add(tq + beat / 2, bass(hz(root), beat / 2 - 0.01), gain=0.45)  # offbeat bass
                mix.add(tq + beat / 2, noise_hit(0.08, 0.02, int(tq * 1000)), gain=0.22)  # open-ish hat
                mix.add(tq + beat / 4, noise_hit(0.04, 0.008, int(tq * 997)), gain=0.10)
                mix.add(tq + 3 * beat / 4, noise_hit(0.04, 0.008, int(tq * 991)), gain=0.10)
                if q in (1, 3) and not last:
                    mix.add(tq, noise_hit(0.25, 0.06, int(tq * 113), bright=False, bursts=3), gain=0.35)
        if last:  # snare roll building into the hit
            for s in range(16):
                ts = t0 + s * beat / 4
                mix.add(ts, noise_hit(0.12, 0.035, 500 + s, bright=False, bursts=1), gain=0.12 + 0.03 * s)
    mix.add(hit_at - 2 * bar, riser(2 * bar), gain=0.3)
    # Pump: duck pumped bus right after each kick, recover by the next offbeat.
    for i in range(pumped.n):
        t = i / SR - start
        ph = (t % beat) / beat if t >= 0 else 1.0
        g = 0.3 + 0.7 * min(1.0, ph / 0.45)
        mix.l[i] += pumped.l[i] * g
        mix.r[i] += pumped.r[i] * g
    # Hit: crash, kick, big D major chord ringing under the title card.
    tail = length - hit_at
    mix.add(hit_at, noise_hit(min(tail, 3.5), 0.9, 99), gain=0.35)
    mix.add(hit_at, kick(), gain=1.0)
    big = [hz(x) for x in ["D2", "A2", "D3", "F#3", "A3", "D4", "F#4"]]
    mix.add(hit_at, pad(big, tail, attack=0.02, release=tail * 0.8, bright=5, detune=0.005), gain=0.28)
    for i, tone in enumerate(["D5", "F#5", "A5", "D6"]):
        mix.add(hit_at + i * beat / 2, pluck(hz(tone), 1.2), gain=0.25)
    return mix


def bell(f, dur=1.6):
    """Bright bell/pluck for sparkly top-line notes."""
    out = []
    for i in range(int(dur * SR)):
        t = i / SR
        v = (math.sin(2 * math.pi * f * t) * math.exp(-t * 3)
             + 0.4 * math.sin(2 * math.pi * f * 2.0 * t) * math.exp(-t * 6)
             + 0.2 * math.sin(2 * math.pi * f * 3.01 * t) * math.exp(-t * 9))
        out.append(min(1.0, t / 0.003) * v)
    return out


def lift(length, hit_at):
    """Dwarkesh-style cold-open bed, uplifting: sustained bright pad chords, pulsing 8th-note
    arpeggio and sparkly bell top line in D major, sub pulse, light hats/kick entering midway
    and building to a lift (crash + held chord) at hit_at. Reference analysis:
    references/dwarkesh (held chords changing every ~2 s, high melodic blips, no heavy drums)."""
    mix = Mix(length)
    beat = 60 / 112
    bar = 4 * beat
    # IV - I - V - vi (G D A Bm): open, rising feel.
    prog = [["G2", "B2", "D3", "G3"], ["D3", "F#3", "A3", "D4"], ["A2", "C#3", "E3", "A3"], ["B2", "D3", "F#3", "B3"]]
    roots = ["G1", "D2", "A1", "B1"]
    melody = ["B5", "A5", "F#5", "A5", "D6", "C#6", "A5", "F#5"]  # one bell per half bar
    nbars = int(hit_at // bar)
    start = hit_at - nbars * bar
    for b in range(nbars):
        t0 = start + b * bar
        x = b / max(1, nbars - 1)  # 0..1 energy ramp
        ch = [hz(n) for n in prog[b % 4]]
        mix.add(t0, pad([f * 2 for f in ch], bar + 0.4, attack=0.25, release=0.4, bright=4, detune=0.006, vib=0.002), gain=0.09 + 0.05 * x)
        mix.add(t0, pad([hz(roots[b % 4])], bar + 0.1, attack=0.05, release=0.1, bright=2), gain=0.14 + 0.06 * x)
        for e in range(8):  # pulsing 8th arpeggio
            f = ch[[0, 2, 1, 3, 2, 3, 1, 2][e]] * 4
            mix.add(t0 + e * beat / 2, pluck(f, 0.28), gain=(0.10 + 0.07 * x) * (1.0 if e % 2 == 0 else 0.7), pan=-0.4 if e % 2 else 0.4)
        for h in range(2):
            mix.add(t0 + h * 2 * beat + beat * 0.5, bell(hz(melody[(2 * b + h) % 8]), 1.8), gain=0.10 + 0.04 * x, pan=0.2 - 0.4 * h)
        if x > 0.3:  # hats in
            for e in range(8):
                mix.add(t0 + e * beat / 2 + beat / 4, noise_hit(0.05, 0.01, int(t0 * 100) + e), gain=0.05 + 0.08 * x)
        if x > 0.55:  # soft kick + claps for the build
            for q in range(4):
                mix.add(t0 + q * beat, kick(), gain=0.35 + 0.35 * x)
                if q in (1, 3):
                    mix.add(t0 + q * beat, noise_hit(0.2, 0.05, int(t0 * 10) + q, bright=False, bursts=3), gain=0.12 + 0.12 * x)
    mix.add(hit_at - bar, riser(bar), gain=0.25)
    tail = length - hit_at
    mix.add(hit_at, noise_hit(min(tail, 3.0), 0.8, 7), gain=0.25)
    mix.add(hit_at, kick(), gain=0.8)
    mix.add(hit_at, pad([hz(n) for n in ["D2", "A2", "D3", "F#3", "A3", "D4", "F#4", "A4"]], tail, attack=0.02, release=tail * 0.85, bright=4, detune=0.006), gain=0.24)
    for i, n in enumerate(["D6", "A5", "F#5", "D6"]):
        mix.add(hit_at + 0.15 + i * beat / 2, bell(hz(n), 2.5), gain=0.16)
    return mix


def whoosh(dur, seed=3):
    """Rising noise sweep that cuts off at its end (transition into a downbeat)."""
    rnd = random.Random(seed)
    out, lp, prev = [], 0.0, 0.0
    n = int(dur * SR)
    for i in range(n):
        x = i / n
        w = rnd.random() * 2 - 1
        lp += (0.02 + 0.5 * x ** 2) * (w - lp)  # opens up as it rises
        out.append((lp - prev * 0.3) * x ** 2)
        prev = lp
    return out


def lead(f, dur):
    """Held bright synth lead (square-ish, slight vibrato)."""
    out = []
    for i in range(int(dur * SR)):
        t = i / SR
        env = min(1.0, t / 0.03) * min(1.0, (dur - t) / 0.08)
        ph = 2 * math.pi * f * t + 0.004 * math.sin(2 * math.pi * 5.5 * t) * f / 5.5
        out.append(env * (math.sin(ph) + 0.33 * math.sin(3 * ph) + 0.2 * math.sin(5 * ph)))
    return out


def promo(length, hit_at):
    """Modern tech-launch cue modelled on references/jevgrep (120 bpm): sub swell + riser intro,
    drop into four-on-the-floor with plucky synth hook and held leads, whooshes every 4 bars,
    a breakdown, a riser into a second drop, and a final hit + held chord at hit_at."""
    mix = Mix(length)
    pumped = Mix(length)
    beat = 60 / 120
    bar = 4 * beat
    # vi-IV-I-V in D: Bm G D A.
    prog = [["B2", "D3", "F#3"], ["G2", "B2", "D3"], ["D3", "F#3", "A3"], ["A2", "C#3", "E3"]]
    roots = ["B1", "G1", "D2", "A1"]
    hook = [0, 2, 1, 2, 0, 2, 1, 3, 0, 2, 1, 2, 3, 2, 1, 2]  # 16th pluck pattern (index into chord, 3 = top)
    leads = ["F#5", "D5", "D5", "C#5"]
    nbars = int(hit_at // bar)
    start = hit_at - nbars * bar
    intro = 2
    breakdown = range(max(intro + 4, nbars - 6), nbars - 2)  # 4 bars before the final build
    for b in range(nbars):
        t0 = start + b * bar
        ch = [hz(n) for n in prog[b % 4]]
        top = ch[0] * 2
        in_intro, in_break, build = b < intro, b in breakdown, b >= nbars - 2
        # Pad + sub (pumped).
        pumped.add(t0, pad([f * 2 for f in ch], bar + 0.05, attack=0.04, release=0.1, bright=5, detune=0.007), gain=0.09 if not in_break else 0.12)
        if not in_intro and not in_break:
            for q in range(4):
                pumped.add(t0 + q * beat, bass(hz(roots[b % 4]), beat * 0.9), gain=0.42)
        elif in_intro:
            pumped.add(t0, pad([hz(roots[b % 4])], bar, attack=0.5, release=0.1, bright=1), gain=0.3)
        # Pluck hook.
        for s in range(16):
            i = hook[s]
            f = (ch + [top])[i] * 4
            g = 0.13 if not in_intro else 0.08
            if in_break and s % 2:
                continue
            mix.add(t0 + s * beat / 4, pluck(f, 0.22), gain=g, pan=-0.3 if s % 2 else 0.3)
        # Held lead every other bar after the intro.
        if not in_intro and b % 2 == 0:
            mix.add(t0, lead(hz(leads[(b // 2) % 4]), bar * 1.9), gain=0.05)
        # Drums.
        if not in_intro and not in_break:
            for q in range(4):
                tq = t0 + q * beat
                mix.add(tq, kick(), gain=0.95)
                mix.add(tq + beat / 2, noise_hit(0.06, 0.015, int(tq * 1000)), gain=0.2)
                for sx in (1, 3):
                    mix.add(tq + sx * beat / 4, noise_hit(0.03, 0.006, int(tq * 997) + sx), gain=0.08)
                if q in (1, 3) and not build:
                    mix.add(tq, noise_hit(0.22, 0.05, int(tq * 113), bright=False, bursts=3), gain=0.34)
            if build:  # snare roll in the last two bars
                for s in range(16):
                    mix.add(t0 + s * beat / 4, noise_hit(0.1, 0.03, 900 + b * 16 + s, bright=False), gain=0.08 + 0.012 * (s + 16 * (b - nbars + 2)))
        # Whoosh into every 4th bar line.
        if (b + 1) % 4 == 0 and b + 1 < nbars:
            mix.add(t0 + bar - beat * 2, whoosh(beat * 2, seed=b), gain=0.4)
    # Intro and pre-drop risers.
    mix.add(start, riser(intro * bar), gain=0.3)
    mix.add(hit_at - 2 * bar, riser(2 * bar), gain=0.35)
    for i in range(pumped.n):
        t = i / SR - start
        ph = (t % beat) / beat if t >= 0 else 1.0
        g = 0.35 + 0.65 * min(1.0, ph / 0.4)
        mix.l[i] += pumped.l[i] * g
        mix.r[i] += pumped.r[i] * g
    # Final hit: crash, kick, big D major chord + lead, then ring out.
    tail = length - hit_at
    mix.add(hit_at, noise_hit(min(tail, 3.0), 0.8, 11), gain=0.3)
    mix.add(hit_at, kick(), gain=1.0)
    mix.add(hit_at, pad([hz(n) for n in ["D2", "A2", "D3", "F#3", "A3", "D4", "F#4", "A4"]], tail, attack=0.02, release=tail * 0.85, bright=5, detune=0.007), gain=0.26)
    mix.add(hit_at, lead(hz("D5"), min(tail, 2.5)), gain=0.06)
    return mix


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("kind", choices=["bed", "epic", "drive", "lift", "promo"])
    ap.add_argument("out")
    ap.add_argument("--length", type=float, required=True)
    ap.add_argument("--resolve-at", type=float)
    ap.add_argument("--hit-at", type=float)
    a = ap.parse_args()
    mix = {"bed": lambda: bed(a.length, a.resolve_at), "epic": lambda: epic(a.length, a.hit_at), "drive": lambda: drive(a.length, a.hit_at), "lift": lambda: lift(a.length, a.hit_at), "promo": lambda: promo(a.length, a.hit_at)}[a.kind]()
    mix.write(a.out)


if __name__ == "__main__":
    main()
