# /// script
# requires-python = ">=3.10"
# dependencies = ["librosa>=0.10", "numpy", "scipy", "soundfile"]
# ///
"""Recipe "Urząd ChatGPT" (voxel comedy). Waiting-room muzak in F major, 104 BPM, bossa feel:
FM electric piano, a pizzicato-ish bass, rim clave and a vibraphone tune that never quite resolves,
like a hold line. Picture cues come from timeline.json (written from the film's own timeline):
bubble pops on every line, the printer and ding of the ticket, the grandfather's wink, the bowl landing
in the soil, a sad trombone-ish slide on the six fingers, a hard music stop for the shout, the office
chime when the display jumps to 1 200 001, robot chirps, a cadence on "Witamy w grupie." and the end card.
No shaker and no whooshes (house rule).
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal


def _skill_dir():
    found = sorted((Path.home() / ".claude/plugins").glob("**/skills/motion-reel/scripts/dsp.py"))
    return found[-1].parent.parent


sys.path.insert(0, str(_skill_dir() / "scripts"))
from dsp import *  # noqa: E402,F403

HERE = Path(__file__).resolve().parent
TL = json.load(open(HERE.parent / "timeline.json"))
SC, EV, END_T, DUR = TL["SC"], TL["EV"], TL["END"], TL["DUR"]
BPM = 104
BEAT = 60 / BPM
BAR = 4 * BEAT
N = int(SR * DUR)
seed(20261031)


def vib(note, length=0.9, gain=1.0):
    """Vibraphone: two partials, slow tremolo, soft mallet."""
    n = int(length * SR)
    t = tvec(n)
    f = hz(note)
    x = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t / 0.08)
    trem = 1 - 0.28 * (0.5 + 0.5 * np.sin(2 * np.pi * 5.5 * t))
    return gain * x * trem * np.exp(-t / 0.55) * (1 - np.exp(-t / 0.004))


def bell(note, length=1.4):
    n = int(length * SR)
    t = tvec(n)
    f = hz(note)
    x = np.sin(2 * np.pi * f * t + 2.2 * np.exp(-t / 0.3) * np.sin(2 * np.pi * f * 3.5 * t))
    return x * np.exp(-t / 0.5) * (1 - np.exp(-t / 0.002))


def rim(f=1900):
    n = int(0.08 * SR)
    t = tvec(n)
    return np.sin(2 * np.pi * f * t) * np.exp(-t / 0.012) + 0.4 * filt(rng.standard_normal(n), "bandpass", [2500, 7000]) * np.exp(-t / 0.01)


def pizz(note, length=0.32):
    n = int(length * SR)
    t = tvec(n)
    f = hz(note)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) * np.exp(-t / 0.05)
    return np.tanh(1.4 * x) * np.exp(-t / 0.16) * (1 - np.exp(-t / 0.003))


def pop(f0=900):
    n = int(0.09 * SR)
    t = tvec(n)
    f = f0 * (1 + 0.8 * np.exp(-t / 0.012))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.025)


def printer(length=0.7):
    n = int(length * SR)
    t = tvec(n)
    buzz = np.sign(np.sin(2 * np.pi * 120 * t)) * 0.3 + filt(rng.standard_normal(n), "bandpass", [800, 3000]) * 0.5
    steps = 0.6 + 0.4 * (np.sin(2 * np.pi * 22 * t) > 0)
    return filt(buzz * steps, "lowpass", 4000) * np.clip(t / 0.02, 0, 1) * np.clip((length - t) / 0.04, 0, 1)


def thud():
    n = int(0.7 * SR)
    t = tvec(n)
    body = np.sin(2 * np.pi * np.cumsum(60 + 80 * np.exp(-t / 0.04)) / SR) * np.exp(-t / 0.18)
    soil = filt(rng.standard_normal(n), "bandpass", [300, 2500]) * np.exp(-t / 0.09) * 0.7
    crumbs = np.zeros(n)
    for _ in range(14):
        s = int(rng.uniform(0.03, 0.35) * SR)
        m = min(900, n - s)
        crumbs[s:s + m] += filt(rng.standard_normal(m), "bandpass", [1500, 5000]) * np.exp(-tvec(m) / 0.006) * rng.uniform(0.2, 0.6)
    return body + soil + crumbs


def slide_down(start="Bb3", steps=("Bb3", "A3", "Ab3", "G3"), each=0.32):
    """Muted brass 'wah wah wah wahhh' made of filtered saws."""
    out = []
    for i, nt in enumerate(steps):
        L = each * (2.4 if i == len(steps) - 1 else 1)
        n = int(L * SR)
        t = tvec(n)
        f = hz(nt) * (1 - (0.03 * t / L if i == len(steps) - 1 else 0))
        vib_ = 1 + (0.012 * np.sin(2 * np.pi * 5.5 * t) if i == len(steps) - 1 else 0)
        x = saw(f * vib_, n) * 0.7 + saw(f * 1.004 * vib_, n) * 0.5
        wah = 500 + 1400 * (0.5 - 0.5 * np.cos(2 * np.pi * np.clip(t / min(L, 0.35), 0, 1)))
        x = sweep_filter(x, wah, "lowpass", 2.2)
        out.append(x * adsr(n, 0.02, 0.2, 0.8, 0.08))
    return np.concatenate(out)


def chirp(f0, f1, length=0.07):
    n = int(length * SR)
    t = tvec(n)
    f = f0 * (f1 / f0) ** (t / length)
    return np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.4 * np.exp(-t / 0.05)


def tok(note):
    n = int(0.25 * SR)
    t = tvec(n)
    return np.sin(2 * np.pi * hz(note) * t) * np.exp(-t / 0.06) + 0.5 * filt(rng.standard_normal(n), "bandpass", [1500, 4000]) * np.exp(-t / 0.006)


def typing(length, n_keys):
    n = int(length * SR)
    x = np.zeros(n)
    for k in range(n_keys):
        s = int(k / n_keys * (n - 3000))
        tt = tvec(2500)
        x[s:s + 2500] += filt(rng.standard_normal(2500), "bandpass", [2000, 6000]) * np.exp(-tt / 0.004) * (0.6 + 0.4 * rng.random())
    return x


def main():
    music, bass, drums, fx = (Bus(DUR, BPM) for _ in range(4))
    CH = [["F3", "A3", "C4", "E4"], ["D3", "F3", "A3", "C4"], ["G3", "Bb3", "D4", "F4"], ["C3", "E3", "Bb3", "D4"]]
    ROOT = [("F2", "C3"), ("D2", "A2"), ("G2", "D3"), ("C2", "G2")]
    # the hold-line tune: 4 bars, keeps asking and never lands on F
    TUNE = [(0, "C5", 1.0), (1.5, "A4", 0.5), (2, "G4", 0.5), (2.5, "A4", 1.5), (4, "D5", 1.0), (5.5, "C5", 0.5), (6, "A4", 1.5),
            (8, "Bb4", 1.0), (9.5, "D5", 0.5), (10, "C5", 0.5), (10.5, "Bb4", 1.5), (12, "E5", 0.75), (12.75, "D5", 0.75), (13.5, "C5", 0.5), (14, "Bb4", 2.0)]
    clave = [0, 1.5, 3, 5, 6.5]          # 2-bar bossa clave in beats
    stop_t = SC["krzyk"]["t0"]           # music cuts for the shout
    back_t = SC["okienko"]["t0"]
    def groove(t0, t1, full=True, melody=True):
        b0 = int(np.floor(t0 / BAR))
        for b in range(b0, int(np.ceil(t1 / BAR)) + 1):
            tb = b * BAR
            ci = b % 4
            # bossa comping: 1, 2&, 4 (and the and of 3 on alternate bars)
            for off, g in ((0, 0.34), (1.5, 0.26), (3, 0.26)) + (((2.5, 0.2),) if b % 2 else ()):
                at = tb + off * BEAT
                if t0 <= at < t1:
                    music.add(keys([n.replace("3", "4") if i == 0 else n for i, n in enumerate(CH[ci])], 0.9), 0, g, pan=-0.2, at=at)
            for off, nt in ((0, ROOT[ci][0]), (2, ROOT[ci][1]), (3.5, ROOT[ci][0])):
                at = tb + off * BEAT
                if t0 <= at < t1:
                    bass.add(pizz(nt), 0, 0.55, at=at)
            if full:
                for k in clave:
                    at = tb + (k % 4) * BEAT if (b % 2) == (k // 4) else None
                    if at is not None and t0 <= at < t1:
                        drums.add(rim(1700 if k % 2 else 2100), 0, 0.12, pan=0.3, at=at)
                for off in (0, 2):
                    at = tb + off * BEAT
                    if t0 <= at < t1:
                        drums.add(kick(soft=True), 0, 0.32, at=at)
            if melody:
                for beat, nt, ln in TUNE:
                    at = (b - b % 4) * BAR + beat * BEAT
                    if b % 4 == int(beat // 4) and t0 <= at < t1:
                        music.add(vib(nt, ln * BEAT + 0.6), 0, 0.26, pan=0.25, at=at)

    groove(0.0, SC["babcia"]["t0"], full=False, melody=True)
    groove(SC["babcia"]["t0"], stop_t, full=True, melody=True)
    groove(back_t + 0.6, SC["witamy"]["t0"], full=False, melody=False)

    # ---- picture cues
    for (t0, t1, who, text) in TL["L"]:
        fx.add(pop(1100 if who == "hero" else 820 if who != "robot" else 1500), 0, 0.12 if who != "caps" else 0.25, at=t0)
        if who == "robot":
            n = int((t1 - t0) * 0.55 / 0.11)
            for k in range(n):
                f0 = rng.choice([900, 1200, 1500, 1800])
                fx.add(chirp(f0, f0 * rng.choice([0.7, 1.4])), 0, 0.05, pan=0.1, at=t0 + 0.05 + k * 0.11)
    fx.add(printer(0.7), 0, 0.16, pan=-0.4, at=EV["ticketOut"] + 0.15)
    fx.add(bell("C6", 0.8), 0, 0.12, at=EV["insert"] + 0.05)
    # the wink: a tiny bell, slightly sly
    fx.add(bell("A6", 1.0), 0, 0.16, at=EV["wink"] - 0.3)
    fx.add(bell("E7", 0.8), 0, 0.08, at=EV["wink"] - 0.22)
    fx.add(tok("C5"), 0, 0.15, at=EV["photoGive"] + 0.05)
    fx.add(thud(), 0, 0.5, at=EV["sedesDrop"] + 0.5)
    music.add(slide_down(), 0, 0.24, pan=0.1, at=EV["menuZoom"] + 0.15)
    fx.add(tok("G4"), 0, 0.12, at=EV["menuLean"] + 0.05)
    fx.add(tok("E4"), 0, 0.12, at=EV["menuLean"] + 0.65)
    # display jumps to 1 200 001: office chime
    led = EV["led"] + 0.25
    fx.add(bell("E5", 1.6), 0, 0.3, at=led)
    fx.add(bell("C5", 2.0), 0, 0.3, at=led + 0.45)
    # "Witamy w grupie.": the tune finally lands on F
    w = SC["witamy"]["t0"] + 0.25
    music.add(keys(["F3", "A3", "C4", "E4", "G4"], 2.0), 0, 0.42, at=w)
    music.add(vib("F5", 1.8), 0, 0.3, pan=0.25, at=w)
    bass.add(pizz("F2", 0.6), 0, 0.6, at=w)
    fx.add(bell("F6", 1.2), 0, 0.12, at=w + 0.02)

    # ---- end card (reel 2's grammar, softened: no shake hit, gentle kick, Motion toks, typing)
    e = lambda l: END_T + l * 0.5
    drums.add(kick(soft=True), 0, 0.7, at=e(0))
    fx.add(crash(1.4), 0, 0.06, at=e(0))
    music.add(pad_chord(["F2", "C3", "F3", "A3", "C4", "E4"], 3.2, (2600, 700), attack=0.01, release=0.8), 0, 0.5, at=e(0))
    for l, nt in zip([1, 1.25, 1.5, 1.75, 2, 2.25], ["F4", "A4", "C5", "E5", "F5", "A5"]):
        music.add(tok(nt), 0, 0.28, at=e(l))
    fx.add(typing(0.7, 12), 0, 0.2, at=e(3))

    # music bus: hard stop for the shout (40 ms), back in under the window scene
    t = tvec(music.x.shape[1])
    gate = np.ones_like(t)
    gate[(t >= stop_t + 0.04) & (t < back_t + 0.6)] = 0
    ramp = (t >= stop_t) & (t < stop_t + 0.04)
    gate[ramp] = 1 - (t[ramp] - stop_t) / 0.04
    for bus in (music, bass, drums):
        keep_after = t >= back_t + 0.6
        bus.x *= np.where(keep_after | (t < stop_t), 1, gate)
    ir = reverb_ir(1.8, 0.45)
    wet_src = music.x * 0.5 + fx.x * 0.2
    wet = np.stack([signal.fftconvolve(wet_src[c], ir[c])[: wet_src.shape[1]] for c in range(2)])
    bed = drums.x * 0.8 + bass.x * 0.85 + music.x * 0.8 + fx.x * 0.9 + wet * 0.3
    bed = np.stack([filt(ch, "highpass", 30) for ch in bed])[:, :N]
    bed /= np.abs(bed).max() + 1e-9
    bed *= 0.5
    fade = int(0.6 * SR)
    bed[:, -fade:] *= np.linspace(1, 0, fade) ** 2
    sf.write(HERE / "music.wav", bed.T, SR, subtype="PCM_24")
    x = bed.copy()
    for _ in range(3):
        sf.write(HERE / "mix.wav", x.T, SR, subtype="PCM_24")
        lufs, _ = ebur128(HERE / "mix.wav")
        x = limit(x * 10 ** ((-14 - lufs) / 20), -1.3)
    sf.write(HERE / "mix.wav", x.T, SR, subtype="PCM_24")
    print("mix", ebur128(HERE / "mix.wav"))


if __name__ == "__main__":
    main()
