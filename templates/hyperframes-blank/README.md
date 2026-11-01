# HyperFrames starter (brand-neutral)

Copied by `fcwm new <name>` (the default engine). `renderAt(t)` paints the frame for `t` seconds; HyperFrames
calls it through its `hf-seek` event, frame by frame, in any order. FCWM's motion blocks are copied into
`lib/fcwm/` so the film runs on its own. The colours, typeface and the words are placeholders.

GSAP is not used here. If a film imports GSAP, the CLI tells the user it is "restricted" (custom licence).
