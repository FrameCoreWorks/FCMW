# FCWM starter for the Manim engine (Manim Community, MIT). Brand-neutral: the colours, the words and the
# typeface are placeholders; replace them with the film's own. `fcwm render <film>` runs this file.
#
# Render contract in Manim terms: everything on screen comes from the animations below, played in order
# at a fixed frame rate; no wall clock, no unseeded randomness (use np.random.default_rng(seed) if you
# need noise). Text uses Text (Pango), so no LaTeX is needed; MathTex needs a LaTeX install.
import json
import pathlib

import numpy as np
from manim import *

CFG = json.loads((pathlib.Path(__file__).parent / "film.json").read_text())
DURATION = float(CFG.get("duration", 10))
TRANSPARENT = bool(CFG.get("alpha", False))

# Keep 8 units on the frame height in every format; the width follows the pixel aspect.
config.frame_height = 8.0
config.frame_width = 8.0 * config.pixel_width / config.pixel_height

GROUND = "#111111"
INK = "#f2f2f2"
ACCENT = "#8a8a8a"


class Film(Scene):
    def construct(self):
        if not TRANSPARENT:
            self.camera.background_color = GROUND
        fw = config.frame_width
        title = Text("Your title", font_size=64, color=INK, weight=BOLD)
        title.scale_to_fit_width(min(fw * 0.8, 6)).to_edge(UP, buff=1.0)
        axes = Axes(x_range=[0, 6, 1], y_range=[-1.2, 1.2, 0.5], x_length=fw * 0.8, y_length=min(fw * 0.5, 3.5),
                    axis_config={"color": ACCENT, "include_tip": False})
        curve = axes.plot(lambda x: np.sin(2 * x) * np.exp(-x / 4), color=INK)
        dot = Dot(axes.c2p(0, 0), color=INK)

        self.add(title)  # the first frame is the thumbnail on social players: never start empty
        self.play(Create(axes), run_time=1.0)
        self.play(Create(curve), MoveAlongPath(dot, curve), run_time=2.0, rate_func=smooth)
        # hold to the duration in film.json, so contact sheets and QA agree with the film
        self.wait(max(1 / config.frame_rate, DURATION - self.renderer.time))
