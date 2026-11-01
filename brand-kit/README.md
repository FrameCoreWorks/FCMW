# brand-kit/

FCWM ships without a brand and never applies one on its own. A user may save a brand kit once and reuse
it in any film: colours, fonts, logo, end card, sound logo and notes on tone.

| Command | What it does |
| --- | --- |
| `fcwm brand init <kit>` | creates `~/.fcwm/brand-kits/<kit>/brand.json` (empty fields) and an `assets/` folder |
| `fcwm brand check <kit>` | checks colours (`#rrggbb`) and that every file the kit names is in the kit folder |
| `fcwm brand list` | lists the saved kits |
| `fcwm new <film> --brand <kit>` | copies the kit into `<film>/brand/` and hooks it in (below) |

The kit lives outside this repository (`$FCWM_HOME/brand-kits/` when `FCWM_HOME` is set). A film gets
its own copy, so the film folder renders the same on any machine and a later change to the kit does not
change finished films.

What `--brand` does per engine:

- HyperFrames: `brand/brand.css` sets `--ground`, `--ink`, `--accent`, `--palette-N` and
  `--font-display` / `--font-body` (with `@font-face` for font files) and is linked after the film's own
  styles, so the starter picks the brand colours and typeface up.
- Manim and Blender: the starters read `brand/brand.json` and use its `ground`, `ink` and `accent`.
- motion-reel: the agent reads `brand/brand.json` and uses it in `film.js`.

Logo, end card and sound logo are placed by the agent when the user wants them; the kit only says what
they are. Fields left empty are "not decided": ask the user, do not invent them.

Schema: [`brand-kit.schema.json`](brand-kit.schema.json). Fonts: only files the user is licensed to use
in video.
