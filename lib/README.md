# lib/

Reusable motion building blocks, so an agent assembles a film from tested parts instead of writing
everything from scratch. This is where most of the quality for smaller models comes from.

Contract for every block:

- A pure function of its inputs and time; seeded randomness only (see the render contract in
  `AGENTS.md`).
- A short header comment: what it does, parameters, a usage example.
- No brand, palette or font baked in: colours, faces and sizes are parameters.
- A test or an example frame that proves it works.

Browser engines use JavaScript modules (`lib/*.js`); audio and offline tools use Python
(`lib/python/`, arrives with the audio engine in a later step).

Functions return numbers, arrays or plain objects, so the same block works in canvas, DOM/SVG
(HyperFrames) and three.js. Only `three/` needs three.js, passed in as an argument. Times are in
seconds unless a function says beats; convert with `beatGrid()` from `core.js`.

## Modules

| File | What it gives you |
| --- | --- |
| `core.js` | clamp/lerp/prog, eases incl. minimum-jerk, closed-form springs + presets, keyed springs, keyframes, `punch`, `logZoom`, `infiniteZoom`, seeded noise, `shake`, `beatGrid` |
| `type.js` | per-glyph entrance styles: `rise`, `scramble` (+ `glitchStrips`), `drop`, `hop`, `slam`, `grow`, `flap`, `converge`, `typed`, `wipe`, `readingTime` |
| `cursor.js` | `cursorPath(waypoints)`: human cursor glides, press, ripples |
| `points.js` | `morton3`, `mortonSort`, `resample`, `sampleMask`, `stagger`, `morph` for point clouds |
| `camera.js` | `shotTrack(shots)`, `dollyZoomFov`, `camera2d` |
| `blocks.js` | film pieces: `transition` (cut, fade, dip, wipe, push, slide, zoom, iris), `titleCard`, `lowerThird`, `captionLines` + `caption` (word-timed), `endCard`, `css(state)` |
| `dialogue.js` | `script()` timeline (scene/say/wait/mark), `blink`, `wrap` |
| `character.js` | `walkTrack`, `faceToward`, `gait` |
| `dom/iris.js` | camera-iris blades as SVG paths |
| `dom/glass.js` | refractive glass panels (SVG displacement) |
| `three/points-material.js` | lit point sprites with depth of field, occluder material |
| `three/voxel.js` | voxel builder: matrix stack, pivoted parts, one InstancedMesh per part |

## Example (canvas)

```js
import { cursorPath } from './lib/cursor.js';
import { rise } from './lib/type.js';

const cur = cursorPath([{ t: 0, x: 900, y: 1500 }, { t: 2, x: 540, y: 960, kind: 'click' }]);
function draw(ctx, t) {
  for (const g of rise(t - 0.5, 'HELLO')) {
    if (!g.visible) continue;
    ctx.fillText(g.ch, restX[g.i] + g.dx * size, baseline + g.dy * size);
  }
  const p = cur.at(t);   // draw your cursor at p.x, p.y, scale p.scale
}
```

## Tests

`npm test` from the repository root (Node 18+). The three.js blocks were also checked rendering in headless
Chromium.
