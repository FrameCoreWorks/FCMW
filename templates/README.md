# templates/

Open, brand-neutral starting points. Every template takes colours, fonts and copy as parameters and
ships with neutral placeholder values only. Each template states its engine and licence tier.

| Template | Engine | Tier | Used by |
| --- | --- | --- | --- |
| `hyperframes-blank/` | HyperFrames | free (no GSAP) | `fcwm new <name>` |
| `hyperframes-lottie/` | HyperFrames + dotlottie-web | free (MIT) | `fcwm new <name> --lottie [file]` |
| `manim-blank/` | Manim | free | `fcwm new <name> --engine manim` |
| `blender-blank/` | Blender | restricted (GPL) | `fcwm new <name> --engine blender` |

motion-reel films start from the engine's own template (`engines/motion-reel/assets/template/`).
Transitions, title cards, lower thirds, captions and end cards are tested blocks in
[`lib/blocks.js`](../lib/blocks.js) (copied into every HyperFrames film as `lib/fcwm/blocks.js`); the
[`film-blocks`](../recipes/film-blocks/) recipe uses all of them. A brand kit (`fcwm new --brand`) restyles
the starters; see [`brand-kit/`](../brand-kit/).
