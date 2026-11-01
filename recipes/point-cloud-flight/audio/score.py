# /// script
# requires-python = ">=3.10"
# dependencies = ["librosa>=0.10", "numpy", "scipy", "soundfile"]
# ///
"""Recipe "200,000 dots". 140 BPM, 56 beats = 24.0 s, G minor, electro house.
b0-8   hook: impact as the dots slam into 200 000, filtered arp opening up, riser
b8-32  six products, one bar each: four on the floor, claps, offbeat bass, stabs Gm Eb Bb F
b32-36 breakdown: pad, riser, snare roll, no kick
b36-44 drop: 808 bass pattern, saw stabs, sidechain
b44-48 rapid: a stab on every half beat (a product per stab), pitch climbing
b48-56 end card: impact, chord tail
"""
import json, os, sys
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy import signal

def _skill_dir():
    if os.environ.get("MOTION_REEL_SKILL"):
        return Path(os.environ["MOTION_REEL_SKILL"])
    found = sorted((Path.home() / ".claude/plugins").glob("**/skills/motion-reel/scripts/dsp.py"))
    return found[-1].parent.parent
sys.path.insert(0, str(_skill_dir() / "scripts"))
from dsp import *  # noqa

HERE = Path(__file__).resolve().parent
FILM = HERE.parent
BPM = 140
BEAT = 60 / BPM
NB = 44
DUR = NB * BEAT
N = int(SR * DUR)
seed(20261103)
T = lambda b: b * BEAT

def snare(tone=200, tail=0.08):
    n = int(0.3 * SR); t = tvec(n)
    body = np.sin(2 * np.pi * tone * t) * np.exp(-t / 0.035)
    noise = filt(rng.standard_normal(n), "bandpass", [1500, 9000]) * np.exp(-t / tail)
    return np.tanh(1.8 * (body * 0.6 + noise))

def boom808(note="G1", length=0.9):
    n = int(length * SR); t = tvec(n)
    f = hz(note) * (1 + 1.8 * np.exp(-t / 0.025))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.45)
    return np.tanh(2.8 * x) * (1 - np.exp(-t / 0.001))

def saw_stab(notes, length, cutoff=3200, drive=2.0):
    n = int(length * SR); t = tvec(n)
    x = sum(saw(hz(nt), n, phase0=rng.uniform()) + saw(hz(nt) * 1.008, n, phase0=rng.uniform()) for nt in notes)
    x = sweep_filter(x, 250 + cutoff * np.exp(-t / 0.07), "lowpass", 1.3)
    return np.tanh(drive * x / len(notes)) * adsr(n, 0.002, 0.08, 0.5, 0.04)

def arp_note(note, length, cut):
    n = int(length * SR); t = tvec(n)
    x = saw(hz(note), n) * 0.6 + np.sign(np.sin(2 * np.pi * hz(note) * t)) * 0.3
    return sweep_filter(x, cut * (0.4 + 0.6 * np.exp(-t / 0.05)), "lowpass", 1.6) * adsr(n, 0.002, 0.05, 0.4, 0.03)

CH = {"Gm": ["G3", "Bb3", "D4"], "Eb": ["Eb3", "G3", "Bb3"], "Bb": ["Bb3", "D4", "F4"], "F": ["F3", "A3", "C4"]}
ROOT = {"Gm": "G1", "Eb": "Eb1", "Bb": "Bb1", "F": "F1"}

def main():
    drums, bass, music, fx = (Bus(DUR, BPM) for _ in range(4))
    kicks = []
    def K(b, g=1.0, soft=False):
        drums.add(kick(soft), b, g); kicks.append(T(b))

    # ---- hook 0-8
    K(0, 1.0); bass.add(sub_drop(1.3, 70, 32), 0, 0.8); fx.add(crash(2.0), 0, 0.35)
    K(4, 0.8)
    seq = ["G4", "D5", "Bb4", "G5", "D5", "Bb4", "F5", "D5"]
    for i, b in enumerate(np.arange(0.5, 8, 0.25)):
        cut = 500 + 4500 * (b / 8) ** 1.6
        music.add(arp_note(seq[i % 8], T(0.24), cut), b, 0.32, pan=0.35 if i % 2 else -0.35)
    for b in np.arange(4, 8, 0.5):
        drums.add(hat(), b + 0.0, 0.10 if b % 1 else 0.14, pan=0.3)
    fx.add(riser(T(3.0)), 5, 0.4)
    for i, b in enumerate(np.arange(7, 8, 0.125)):
        drums.add(snare(220, 0.05), b, 0.12 + 0.3 * i / 8)

    # ---- groove 8-32: one product per bar
    prog = ["Gm", "Eb", "Bb", "F", "Gm", "Eb"]
    for bar, c in enumerate(prog):
        s = 8 + 4 * bar
        fx.add(crash(1.0), s, 0.14)
        for k in range(4):
            b = s + k
            K(b, 0.95)
            if k % 2 == 1:
                drums.add(clap(), b, 0.5); drums.add(snare(), b, 0.22)
            drums.add(hat(open_=True), b + 0.5, 0.16, pan=-0.2)
            for h in (0.25, 0.75):
                drums.add(hat(), b + h, 0.08, pan=0.3)
            bass.add(bass_note(ROOT[c][:-1] + "2", T(0.4), 900), b + 0.5, 0.55)
        for d in (0, 0.75, 1.5, 2.5, 3.25):
            music.add(pluck(CH[c], 0.22, 3400), s + d, 0.32)
        music.add(pad_chord(CH[c], T(4), (600, 1500), attack=0.05, release=0.2), s, 0.18)

    # ---- 32-34: last product flies into the logo
    music.add(pad_chord(["G3", "Bb3", "D4", "F4", "A4"], T(2.2), (500, 2600), attack=0.2, release=0.1), 32, 0.4)
    fx.add(riser(T(2.0)), 32, 0.45)
    for i, b in enumerate(np.arange(33, 34, 0.125)):
        drums.add(snare(230, 0.05), b, 0.1 + 0.35 * i / 8)
    # ---- 34-40: logo made of dots, holding, building to the blast
    K(34, 1.0); bass.add(sub_drop(1.5, 68, 33), 34, 0.7); fx.add(crash(2.4), 34, 0.4)
    music.add(pad_chord(["G2", "D3", "G3", "Bb3", "D4", "A4"], T(6.0), (2600, 900), attack=0.005, release=0.3), 34, 0.6)
    for i, b in enumerate(np.arange(35, 39.5, 0.5)):
        music.add(arp_note(["G5", "D6", "Bb5", "F6"][i % 4], T(0.45), 2600 + 300 * i), b, 0.16, pan=0.4 if i % 2 else -0.4)
    fx.add(riser(T(3.0)), 37, 0.6)
    roll = list(np.arange(38, 39, 0.25)) + list(np.arange(39, 40, 0.125))
    for i, b in enumerate(roll):
        drums.add(snare(230, 0.05), b, 0.08 + 0.42 * i / len(roll))
    # ---- 40: the blast, then a tail into black
    K(40, 1.0); drums.add(boom808("G1", 1.6), 40, 0.9); bass.add(sub_drop(2.2, 80, 28), 40, 0.9); fx.add(crash(3.2), 40, 0.6)
    music.add(pad_chord(["G2", "D3", "G3", "Bb3", "D4", "A4"], T(6.0), (3200, 500), attack=0.005, release=1.0), 40, 0.55)
    music.add(keys(["G5", "D6"], 2.0), 42, 0.25)

    # ---- mix
    pump = sidechain(kicks, bass.x.shape[1], 0.5, 0.1)
    ir = reverb_ir(1.8, 0.45)
    wet_src = music.x * 0.45 + fx.x * 0.15 + drums.x * 0.03
    wet = np.stack([signal.fftconvolve(wet_src[c], ir[c])[: wet_src.shape[1]] for c in range(2)])
    bed = drums.x * 0.85 + bass.x * pump * 0.9 + music.x * pump * 0.75 + fx.x * 0.7 + wet * 0.3
    bed = np.stack([filt(ch, "highpass", 28) for ch in bed])[:, :N]
    bed /= np.abs(bed).max() + 1e-9
    bed *= 0.5
    fade = int(0.8 * SR)
    bed[:, -fade:] *= np.linspace(1, 0, fade) ** 2
    sf.write(HERE / "music.wav", bed.T, SR, subtype="PCM_24")
    beats = [round(T(b), 5) for b in range(NB + 1)]
    grid = {"bpm": BPM, "period": BEAT, "offset": 0.0, "beats": beats, "designed_bpm": BPM,
            "downbeats": beats[::4],
            "sections": [{"name": n, "beat": b} for n, b in [("hook", 0), ("noira", 8), ("gravl", 12), ("kova", 16),
                         ("saven", 20), ("arko", 24), ("vistra", 28), ("logo", 34), ("blast", 40)]],
            "duration": DUR, "source": "point-cloud-flight/audio/score.py designed grid"}
    (FILM / "beats.json").write_text(json.dumps(grid, indent=1))
    print("music.wav + beats.json", DUR, "s")

if __name__ == "__main__":
    main()
