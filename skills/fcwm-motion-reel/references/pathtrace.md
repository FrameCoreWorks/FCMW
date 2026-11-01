<!-- Copied from engines/motion-reel/references/pathtrace.md by scripts/sync-skill-refs.mjs. Edit the source, then run it again. -->
# Path-traced 3-D (quality mode)

The same three.js set, animated the same way, rendered by a path tracer instead of the rasteriser:
light bounces between surfaces, so reflections show the room, glass bends and focuses light, shadows
soften with the size of the light, and the camera has a real aperture. It is the closest FCWM gets to
an offline renderer such as Octane or Cycles without leaving the browser engine. The library is
[three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer) (MIT, tier `free`), pinned at
0.0.27 with three-mesh-bvh 0.9.17 and three 0.187.

## When to offer it

Offer it, never pick it silently: it multiplies the render time. It earns its cost when the shot is
about materials and light (a product on a table, glass, liquid, metal, a lit interior) and the camera
lingers. It does not help type, flat graphics, point clouds, toon looks or shader effects; keep those
on the rasteriser (`references/3d.md`), and mix: a film can path trace one hero set and rasterise the rest.

Tell the user, before building:

- **Time.** Expect seconds per frame on a GPU at 1080p and 256 samples (an estimate: not yet measured
  on Apple silicon); a 30 s film at 60 fps is 1,800 frames, so plan on hours, not minutes, and 30 fps
  halves it. Measured in software WebGL (no GPU): 256 samples at 320x180 took about a minute per frame.
  Render one still first (`fcwm render <film> --at 2`) and quote the measured time, not a guess; the
  full render prints a measured ETA every two frames.
- **GPU.** On macOS the render runs on the GPU (Metal) by default. Without a GPU (software WebGL,
  printed as "SwiftShader" at render start, and every GitHub Actions runner) a 1080p frame at 256
  samples takes many minutes: use the cloud only for low-sample test frames.
- **Status.** `experimental` in FCWM. The WebGL tracer it uses is marked deprecated upstream in favour of
  a WebGPU tracer; FCWM stays on WebGL because the WebGPU one crashed on software WebGPU when tested
  (2026-11-01) and headless WebGPU on every GPU is not yet proven. The exact pin keeps renders stable.

## Setup

`fcwm new <film> --pathtrace` (implies `--3d`) writes `lib/pathtrace.js`, a sample set
`sets/studio.js` (matte floor, glass, metal, clearcoat, one area light, depth of field) and in
`film.json`:

```json
"pathtrace": { "spp": 256, "scale": 1, "checkSpp": 32, "checkScale": 0.5 }
```

three.js and the tracer come with FCWM (`npm ci` in the FCWM folder); the renderer serves them to the
film, so the film folder needs no npm step. A film folder may still carry its own `node_modules`, which
wins.

```js
import * as G from './lib/gl.js';
import * as PT from './lib/pathtrace.js';
M.film({
  samples: 4,                                  // motion blur: 4 shutter times share the budget
  async init() {
    await G.initGL();
    await PT.initPathTracer({ ...(M.CFG.pathtrace || {}) });
    SET = mySet(); PT.prepare(SET);            // compile and build the BVH here, not in frame 1
  },
  draw(ctx, u, t) { PT.renderSet(ctx, SET, t, u); /* 2-D layers on top as usual */ },
});
```

`PT.renderSet` is a drop-in for `G.renderSet`: same set object, same `opts.alpha` and `opts.blend`, so
2-D type and graphics still stack over or under it. A set needs no changes to be path traced, apart
from the materials and lights below.

## Quality knobs

| Knob | Where | Effect |
| --- | --- | --- |
| `spp` | film.json, `--spp N` | Samples per pixel per frame. Grain halves for every 4x samples. 64 for review, 256 to 1,024 for delivery. |
| `scale` | film.json, `--pt-scale s` | Trace at a fraction of the size and upscale. 0.5 is a quarter of the work; for drafts. |
| `checkSpp`, `checkScale` | film.json | What `fcwm render <film> --check` uses for contact sheets (layout and light, not grain). |
| `bounces`, `transmissiveBounces` | `initPathTracer` | Light bounces (8) and extra bounces through glass (10). Glass behind glass needs more. |
| draft | `--draft` | Rasterise instead: fast previews of timing and framing. Light will look different. |
| motion blur | `samples` in `M.film` | Sub-frames split `spp` (256 with `samples: 4` is 64 at each of 4 shutter times), so blur adds no cost. Keep 16 or more samples per sub-frame: sub-frames are averaged after tone mapping, so very few per sub-frame dims the brightest grain. |

The renderer runs one worker for path-traced films (the GPU is the limit; parallel pages only queue)
and reports progress every two frames.

## Materials and lights

- **Materials.** `MeshStandardMaterial` and `MeshPhysicalMaterial` only: `transmission` + `ior` +
  `thickness` for glass and liquid, `metalness` + `roughness`, `clearcoat`, `sheen`, `iridescence`,
  textures (map, normal, roughness, metalness, emissive). `ShaderMaterial`, points and lines are not
  traced; keep them on rasterised sets.
- **Key light: an area light.** `PT.areaLight(color, intensity, w, h)` (a `RectAreaLight`) is sampled
  directly and cleans up fast; its size is the softness of the shadows. An emissive mesh also lights the
  scene, but only when a bounce happens to hit it: a small bright lamp turns into salt-and-pepper grain.
  Use emissive for visible practicals (a screen, a neon), not as the key.
- **Fill and reflections: the environment.** `scene.environment = PT.gradientEnvironment(top, bottom)`
  or an equirectangular HDR the user supplies. Metal and glass show what surrounds them; a black world
  makes chrome look black.
- **Depth of field.** `PT.physicalCamera(fov, { fStop, focusDistance, apertureBlades })`. Animate
  `focusDistance` in `update()` for a focus pull; lower `fStop` is shallower.
- **Colour.** Tone mapping is the renderer's (ACES filmic from `G.initGL`). Pick colours from the user's
  palette as usual; bright accents desaturate under ACES, so darken the base colour a little rather than
  raising the light.

## Determinism (render contract)

Every frame is traced from an empty image with a fixed number of samples, and every random number is
derived from the film's `seed`, the frame time and the sub-frame index: the same frame renders the same
pixels, in any order, on any worker. `pathtrace.js` seeds the library's own setup (noise tables, sample
strata) and silences its deprecation warning. `update()` follows the same rules as any set: set every
property from `t`, no `+=`. Moving objects refit the BVH (fast); adding or removing meshes rebuilds it
(slow), so hide with a zero scale rather than removing.

`fcwm qa <film> --determinism` renders the QA stills twice and compares bytes. It passes on software
WebGL in CI. On a GPU, two runs on the same machine and driver match; a different GPU may differ in the
last bit of some pixels, like any GPU render.

## Gotchas

- **The first frame takes longest.** `PT.prepare()` in `init()` compiles the tracer and builds the BVH
  once per set. Every set has its own tracer: a film with five path-traced sets compiles five times.
- **Grain that will not go away** is usually the light: a small emissive key, or light reaching the
  subject only through glass. Use an area light and an environment before raising `spp`.
- **Bloom does not apply** to path-traced sets (`bloom` on a set is ignored there). Bright emissives
  glow only as much as the tone mapping allows; add a soft glow in `post()` if the look needs one.
- **Fog** is not traced. For haze, a 2-D gradient layer over the set reads well.
