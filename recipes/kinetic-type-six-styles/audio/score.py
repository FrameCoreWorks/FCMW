# /// script
# requires-python = ">=3.10"
# dependencies = ["librosa>=0.10", "numpy", "scipy", "soundfile"]
# ///
"""Recipe "Six brands, six ways to move". 120 BPM, 50 beats = 25.0 s, F minor.

Every section is its own genre, so the word changes personality with the music.
b0-2    hook: four one-beat-half flashes of the four genres, then a stop
b2-8    LUXURY: warm pad Fm9, slow electric piano, a soft shaker. No kick
b8-14   TECH: bitcrushed 16th arp, tight hats, stuttered kick, glitch bursts
b14-20  PLAYFUL: marimba hook, bouncy bass, claps and finger snaps
b20-26  SPORT: 808 boom, hard snare, distorted saw riff, riser into the recap
b26-30  RECAP: all four at once over four on the floor
b30-36  END CARD: impact, sustained Fm chord, bell
"""
import json
import os
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal


def _skill_dir():
    if os.environ.get("MOTION_REEL_SKILL"):
        return Path(os.environ["MOTION_REEL_SKILL"])
    found = sorted((Path.home() / ".claude/plugins").glob("**/skills/motion-reel/scripts/dsp.py"))
    if found:
        return found[-1].parent.parent
    sys.exit("set MOTION_REEL_SKILL")


sys.path.insert(0, str(_skill_dir() / "scripts"))
from dsp import *  # noqa: E402,F403

HERE = Path(__file__).resolve().parent
FILM = HERE.parent
BPM = 120
BEAT = 60 / BPM
NB = 50
DUR = NB * BEAT
N = int(SR * DUR)
seed(20261031)


def T(b):
    return b * BEAT


def snare(tone=185, tail=0.07):
    n = int(0.3 * SR)
    t = tvec(n)
    body = np.sin(2 * np.pi * tone * t) * np.exp(-t / 0.04)
    noise = filt(rng.standard_normal(n), "bandpass", [1500, 8000]) * np.exp(-t / tail)
    return np.tanh(1.8 * (body * 0.6 + noise))


def shaker():
    n = int(0.09 * SR)
    t = tvec(n)
    e = (1 - np.exp(-t / 0.01)) * np.exp(-t / 0.03)
    return filt(rng.standard_normal(n), "bandpass", [5000, 11000]) * e


def marimba(note, length=0.45):
    n = int(length * SR)
    t = tvec(n)
    f = hz(note)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.22) + 0.35 * np.sin(2 * np.pi * f * 3.98 * t) * np.exp(-t / 0.03)
    x += 0.15 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t / 0.008)
    return x * (1 - np.exp(-t / 0.001))


def crush(x, bits=5, hold=6):
    y = np.repeat(x[::hold], hold)[: len(x)]
    q = 2 ** (bits - 1)
    return np.round(y * q) / q


def square_arp(note, length=0.11):
    n = int(length * SR)
    t = tvec(n)
    x = np.sign(np.sin(2 * np.pi * hz(note) * t)) * 0.6
    return crush(x * np.exp(-t / 0.06), 4, 5)


def boom808(note="F1", length=0.9):
    n = int(length * SR)
    t = tvec(n)
    f = hz(note) * (1 + 1.6 * np.exp(-t / 0.03))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.5)
    return np.tanh(2.5 * x) * (1 - np.exp(-t / 0.001))


def dist_saw(notes, length, cutoff=2500):
    n = int(length * SR)
    t = tvec(n)
    x = sum(saw(hz(nt), n, phase0=rng.uniform()) + saw(hz(nt) * 1.01, n, phase0=rng.uniform()) for nt in notes)
    x = sweep_filter(x, 300 + cutoff * np.exp(-t / 0.08), "lowpass", 1.4)
    return np.tanh(2.2 * x / len(notes)) * adsr(n, 0.003, 0.1, 0.7, 0.03)


def glitch(length=0.25):
    n = int(length * SR)
    seg = int(0.012 * SR)
    src = rng.standard_normal(seg) * 0.5 + np.sign(np.sin(np.arange(seg) * 0.4))
    x = np.tile(src, n // seg + 1)[:n]
    return crush(filt(x, "bandpass", [800, 6000]), 3, 9) * np.linspace(1, 0.2, n)


def main():
    drums, bass, music, fx = (Bus(DUR, BPM) for _ in range(4))
    H, LX, TC, PL, SP, EC, FN, RC, EN = 0, 4, 10, 16, 22, 28, 34, 40, 44

    # ---- hook: a question, one hit per word, then MOVE? flickers through the characters
    for i, b in enumerate([0, 0.5, 1.0, 1.5]):
        drums.add(kick(), b, 0.9 if i == 0 else 0.6)
        drums.add(clap(tight=True), b, 0.3 if i else 0.0)
    drums.add(kick(), 2.0, 1.0)
    drums.add(snare(), 2.0, 0.5)
    fx.add(crash(1.0), 2.0, 0.25)
    bass.add(sub_drop(T(2.0), 70, 36), 2.0, 0.6)
    music.add(keys(["F4", "Ab4", "C5", "Eb5"], 0.45), 2.5, 0.45)
    music.add(square_arp("C6", 0.2), 3.0, 0.35)
    music.add(glitch(0.15), 3.0, 0.2)
    music.add(marimba("F5", 0.3), 3.25, 0.5)
    drums.add(boom808("F1", 0.45), 3.5, 0.7)
    fx.add(whoosh(T(0.5), 600, 4000, peak=0.95), 3.5, 0.2)

    # ---- LUXURY
    lux = [(LX, ["F3", "Ab3", "C4", "Eb4", "G4"], "F1"), (LX + 3, ["Db3", "F3", "Ab3", "C4", "Eb4"], "Db1")]
    for b, ch, root in lux:
        music.add(pad_chord(ch, T(3.2), (500, 1800), attack=0.5, release=0.4, detune=0.08), b, 0.55)
        bass.add(sub_drop(T(3.0), hz(root) * 1.02, hz(root)), b, 0.35)
    ep = [("C5", 0.0), ("Eb5", 1.0), ("G5", 1.5), ("F5", 2.0), ("Ab5", 3.0), ("G5", 4.0), ("Eb5", 4.5), ("F5", 5.0)]
    for nt, b in ep:
        music.add(keys([nt, nt[:-1] + str(int(nt[-1]) - 1)], 1.4), LX + b, 0.38, pan=0.2)
    for b in np.arange(0, 6, 0.5):
        drums.add(shaker(), LX + b + 0.25, 0.12, pan=-0.35)

    # ---- TECH
    arp = ["F5", "C6", "Ab5", "Eb6", "F5", "C6", "G5", "Db6"]
    for i, b in enumerate(np.arange(TC, TC + 6, 0.25)):
        music.add(square_arp(arp[i % 8], 0.11), b, 0.22, pan=0.4 if i % 2 else -0.4)
    for k in range(6):
        b = TC + k
        if k % 2 == 0:
            drums.add(kick(), b, 0.9)
        drums.add(hat(), b + 0.5, 0.25)
        drums.add(hat(), b + 0.75, 0.12, pan=0.3)
        if k % 2 == 1:
            drums.add(snare(240, 0.03), b, 0.4)
        bass.add(bass_note("F1" if k < 3 else "Db1", T(0.9), 700), b, 0.6)
    for d in (1.75, 1.875, 3.5, 3.625, 3.75, 5.5, 5.625, 5.75, 5.875):
        drums.add(kick(soft=True), TC + d, 0.45)
    for d in (0.0, 2.5, 4.0, 5.25):
        fx.add(glitch(0.22), TC + d, 0.3, pan=-0.2)

    # ---- PLAYFUL
    mel = [("F5", 0.0), ("C5", 0.5), ("F5", 0.75), ("Ab5", 1.0), ("G5", 1.5), ("F5", 2.0),
           ("Eb5", 2.5), ("F5", 2.75), ("C6", 3.0), ("Bb5", 3.5), ("Ab5", 4.0), ("G5", 4.5),
           ("Ab5", 4.75), ("C6", 5.0), ("F5", 5.5)]
    for nt, b in mel:
        music.add(marimba(nt), PL + b, 0.55, pan=0.15)
    for k in range(6):
        b = PL + k
        drums.add(kick(soft=True), b, 0.8)
        if k % 2 == 1:
            drums.add(clap(), b, 0.45)
        drums.add(hat(), b + 0.5, 0.14, pan=0.3)
        root = ["F2", "C2", "Db2", "Eb2", "F2", "C2"][k]
        bass.add(bass_note(root, T(0.35), 1200), b, 0.6)
        bass.add(bass_note(root[:-1] + "3", T(0.3), 1400), b + 0.5, 0.45)

    # ---- SPORT
    for d in (0, 1.5, 2, 3.5, 4, 5, 5.5):
        drums.add(boom808("F1" if d < 4 else "Db1", 0.9 if d in (0, 4) else 0.45), SP + d, 0.9)
    for d in (1, 3, 5):
        drums.add(snare(170, 0.12), SP + d, 0.7)
        drums.add(clap(), SP + d, 0.4)
    for b in np.arange(SP, SP + 6, 0.25):
        drums.add(hat(), b, 0.16 if (b * 4) % 2 == 0 else 0.07, pan=0.25)
    riff = [(["F3", "C4"], 0), (["F3", "C4"], 0.75), (["Ab3", "Eb4"], 1.5), (["F3", "C4"], 2),
            (["F3", "C4"], 2.75), (["Db3", "Ab3"], 3.5), (["Db3", "Ab3"], 4), (["Eb3", "Bb3"], 4.75),
            (["Eb3", "Bb3"], 5.25)]
    for nts, d in riff:
        music.add(dist_saw(nts, T(0.6)), SP + d, 0.32, pan=-0.1)
    fx.add(crash(1.5), SP, 0.35)

    # ---- WELLNESS: air, a soft kalimba, no drums
    music.add(pad_chord(["Ab3", "C4", "Eb4", "G4"], T(6.2), (700, 1400), attack=0.6, release=0.6, detune=0.06), EC, 0.5)
    bass.add(sub_drop(T(6.0), hz("Ab1"), hz("Ab1")), EC, 0.25)
    kal = [("Eb5", 0), ("G5", 0.75), ("C6", 1.5), ("Bb5", 2.5), ("G5", 3.0), ("Ab5", 3.75), ("Eb5", 4.5), ("C5", 5.25)]
    for nt, d in kal:
        music.add(marimba(nt, 0.9) * 0.6, EC + d, 0.4, pan=-0.25 if d % 1.5 else 0.25)
    for b in np.arange(EC, EC + 6, 1.0):
        drums.add(shaker(), b + 0.5, 0.06, pan=0.4)

    # ---- FINANCE: precise, ticking, minimal
    for k in range(6):
        b = FN + k
        drums.add(kick(), b, 0.85 if k % 2 == 0 else 0.5)
        bass.add(bass_note("C2" if k < 3 else "Bb1", T(0.2), 600), b + 0.5, 0.5)
        bass.add(bass_note("C2" if k < 3 else "Bb1", T(0.15), 600), b + 0.75, 0.35)
    for b in np.arange(FN, FN + 6, 0.125):
        drums.add(hat(), b, 0.07 if (b * 8) % 2 else 0.12, pan=0.3)
    for d in [x * 0.25 for x in range(9)]:
        drums.add(clap(tight=True), FN + d, 0.12, pan=-0.3)
    for d, nt in [(0, ["C4", "Eb4", "G4"]), (2, ["C4", "Eb4", "G4"]), (4, ["Bb3", "D4", "F4"])]:
        music.add(pluck(nt, 0.35, 2500), FN + d, 0.35)
        music.add(pluck(nt, 0.35, 2500), FN + d + 0.75, 0.25)
    fx.add(riser(T(2.0)), RC - 2, 0.35)

    # ---- RECAP: everything at once
    for k in range(4):
        b = RC + k
        drums.add(kick(), b, 1.0)
        if k % 2 == 1:
            drums.add(snare(170, 0.1), b, 0.45)
            drums.add(clap(), b, 0.35)
        drums.add(hat(), b + 0.5, 0.22)
        bass.add(bass_note(["F1", "F1", "Db1", "Eb1"][k], T(0.9), 1000), b, 0.6)
    for i, b in enumerate(np.arange(RC, RC + 4, 0.25)):
        music.add(square_arp(arp[i % 8], 0.1), b, 0.12, pan=0.5 if i % 2 else -0.5)
    for nt, d in mel[:8]:
        music.add(marimba(nt), RC + d, 0.35, pan=-0.2)
    music.add(pad_chord(["F3", "Ab3", "C4", "Eb4"], T(4.0), (800, 3500), attack=0.2, release=0.1), RC, 0.4)
    fx.add(crash(1.2), RC, 0.3)

    # ---- END CARD
    drums.add(kick(), EN, 1.0)
    bass.add(sub_drop(1.6, 65, 33), EN, 0.8)
    music.add(pad_chord(["F2", "C3", "F3", "Ab3", "C4", "G4"], T(6.0), (2800, 700), attack=0.005, release=0.8), EN, 0.8)
    fx.add(crash(2.4), EN, 0.4)
    music.add(keys(["F5", "C6"], 2.0), EN + 4, 0.4)

    # ---- mix
    kick_t = [T(b) for b in list(range(40, 44)) + [44]]
    pump = sidechain(kick_t, bass.x.shape[1], 0.45, 0.11)
    ir = reverb_ir(2.2, 0.5)
    wet_src = music.x * 0.45 + fx.x * 0.15 + drums.x * 0.04
    wet = np.stack([signal.fftconvolve(wet_src[c], ir[c])[: wet_src.shape[1]] for c in range(2)])
    bed = drums.x * 0.85 + bass.x * pump * 0.9 + music.x * pump * 0.75 + fx.x * 0.7 + wet * 0.35
    bed = np.stack([filt(ch, "highpass", 28) for ch in bed])[:, :N]
    bed /= np.abs(bed).max() + 1e-9
    bed *= 0.5
    fade = int(0.6 * SR)
    bed[:, -fade:] *= np.linspace(1, 0, fade) ** 2
    sf.write(HERE / "music.wav", bed.T, SR, subtype="PCM_24")

    # designed grid: every note above is placed on it exactly
    beats = [round(T(b), 5) for b in range(NB + 1)]
    grid = {"bpm": BPM, "period": BEAT, "offset": 0.0, "beats": beats, "designed_bpm": BPM,
            "downbeats": beats[::4],
            "sections": [{"name": n, "beat": b} for n, b in [("hook", 0), ("luxury", 4), ("tech", 10),
                         ("playful", 16), ("sport", 22), ("wellness", 28), ("finance", 34), ("recap", 40), ("end", 44)]],
            "duration": DUR, "source": "kinetic-type-six-styles/audio/score.py designed grid"}
    (FILM / "beats.json").write_text(json.dumps(grid, indent=1))
    print("music.wav + beats.json", DUR, "s")


if __name__ == "__main__":
    main()
