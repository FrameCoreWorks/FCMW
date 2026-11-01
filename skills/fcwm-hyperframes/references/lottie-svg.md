# Lottie and SVG in a HyperFrames film

## Lottie / dotLottie playback

`fcwm new <film> --lottie path/to/animation.lottie` (or a Lottie `.json`; a bare `--lottie` starts from a
neutral sample) scaffolds a film that plays the animation on a canvas:

- The player is dotlottie-web (MIT, LottieFiles), pinned in `engines/hyperframes/adapter.mjs`
  (`DOTLOTTIE_VERSION`). It is downloaded once from npm into `~/.fcwm/cache/` and copied into
  `<film>/lib/dotlottie-web/` with its LICENSE, so renders read only local files.
- The animation is copied to `<film>/assets/`.
- The player is created with `autoplay: false` and pushed to `window.__hfLottie`. HyperFrames seeks every
  player there to the frame's time, so the render contract holds: never call `play()`, never use the
  player's own clock or events to drive other elements.
- `loop: true` repeats a short animation across the film; set `loop: false` to hold its last frame.
- Size the canvas (`#anim`, its `width`/`height` attributes and CSS box) to the animation's own aspect.
- Other layers (titles, captions, shapes) sit in the same page and are driven from `renderAt(t)` as in
  any HyperFrames film. `--alpha` works too: the canvas is transparent where the animation is.

Lottie files carry their own colours and fonts. They come from the user; FCWM ships only the neutral
sample. Expressions and some After Effects effects are not supported by any Lottie player; check the
contact sheet against the user's reference.

## Animated SVG

Write SVG inline in `index.html` and set its attributes (`transform`, `d`, `stroke-dashoffset`, `opacity`)
from `renderAt(t)`. Do not use SMIL (`<animate>`), CSS animations or transitions inside the SVG: they run on
the browser clock and break the render contract. External SVG artwork from the user goes in `assets/` and
is inlined (or loaded as `<img>` if it does not move).

## Not available

FCWM does not export Lottie JSON or a self-animating SVG file. Deliver video (MP4, WebM with alpha,
ProRes 4444, GIF) instead, and say so if the user asks for a Lottie file as the output.
