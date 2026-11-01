# /// script
# requires-python = ">=3.10"
# dependencies = ["librosa>=0.10", "numpy", "scipy", "soundfile"]
# ///
"""A minimal synthesized score for a motion-reel film: a kick on every beat and a soft pad, one chord
per bar, on the film's own beat grid (beats.json) for its duration (film.json). Copy it to
<film>/audio/score.py; `fcwm render` runs it (with MOTION_REEL_SKILL pointing at the engine folder,
where dsp.py lives) and masters the mix to -14 LUFS / -1 dBTP. Placeholder music: change the chords,
the drums and the arrangement to fit the film. dsp.py's other voices: see its header."""
import json
import os
import sys
from pathlib import Path

FILM = Path(__file__).resolve().parent.parent
ENGINE = Path(os.environ.get("MOTION_REEL_SKILL") or FILM.parent / "engines" / "motion-reel")
sys.path.insert(0, str(ENGINE / "scripts"))
from dsp import *  # noqa: E402,F403  (Bus, kick, pad_chord, limit, SR, seed, np, ebur128)
import soundfile as sf  # noqa: E402

grid = json.loads((FILM / "beats.json").read_text())
dur = float(json.loads((FILM / "film.json").read_text()).get("duration", 15))
bpm = float(grid.get("bpm") or 60 / grid["period"])
beats = int(dur * bpm / 60)

seed(7)  # fixed: the same score every render
bus = Bus(dur, bpm)
k = kick(soft=False)
for b in range(beats):
    bus.add(k, b, 0.9 if b % 4 == 0 else 0.75)  # accent the downbeat
chords = [["A3", "C4", "E4"], ["F3", "A3", "C4"], ["C4", "E4", "G4"], ["G3", "B3", "D4"]]
bar_s = 4 * 60 / bpm
for bar in range((beats + 3) // 4):
    bus.add(pad_chord(chords[bar % 4], bar_s * 1.05, (500, 1200), attack=0.25, release=0.4), bar * 4, 0.5)

x = bus.x[:, : int(dur * SR)]
x = limit(x / max(np.abs(x).max(), 1e-9) * 0.8)
sf.write(FILM / "audio" / "music.wav", x.T, SR)
print("music.wav", ebur128(FILM / "audio" / "music.wav"))
