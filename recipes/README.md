# recipes/

Complete films with commentary. Each recipe is a directory `recipes/<name>/` containing:

- `README.md`: the idea in one sentence, the beat grid, and a walkthrough of each shot: what happens
  on screen, which technique and `lib/` block it uses, and why that choice works.
- The full source of the film, runnable with the engine named in the README.
- A contact sheet image, so an agent can see the result without rendering.

Recipes are brand-neutral: any logo, name or end card from the original production is replaced with
a neutral placeholder.

| Recipe | Engine | Teaches |
| --- | --- | --- |
| [kinetic-type-six-styles](kinetic-type-six-styles/) | canvas 2-D | Six type personalities through motion, hook on the beat, hit list driving SFX, recap |
| [point-cloud-flight](point-cloud-flight/) | three.js points | 200k-point morphs with Morton correspondence, lit points with depth of field, camera chasing a stream |
| [voxel-comedy](voxel-comedy/) | three.js voxels | Script-driven timeline, voxel characters, distance-driven walks, staged cameras, speech bubbles |
| [ui-cursor-story](ui-cursor-story/) | HTML/DOM | Human cursor, liquid glass, iris transition, one continuous move, rhythm measured from a reference |

The reusable parts of each film are extracted into tested modules in [`../lib`](../lib/). The
lessons behind them are in [`../knowledge/lessons.md`](../knowledge/lessons.md).

Verified 2026-11-01: all four render frames in headless Chromium (with fallback fonts and, for the
UI story, placeholder photos). Fonts and photos are not shipped: their licences are not ours to grant.
