# Craft lessons

Distilled from four films directed and coded end to end by a frontier model (Opus 5.5) and judged by
a professional motion designer, October 2026. Sources: the rejection log the designer kept, and the
code of the films themselves (see `recipes/`).

These lessons are **not a style**. They say how to execute any style well. The user always sets the
direction (brand, palette, tone, references); nothing here overrides that.

## 1. How the work was run

1. **Decide the idea before the code.** One sentence: what transforms into what, and why it is worth
   watching. Prefer the medium as the story mechanic over decoration: dots that become the products,
   a pixel that is a brick, a photo that becomes a print on a wall.
2. **Lock the beat grid first.** Write the score (or measure the supplied track), save `beats.json`,
   then time every visual accent in beats. Sound and picture cannot drift when both read one grid.
3. **Write the shot list on the grid and get it approved** before animating. A table is cheap to
   change; a built scene is not.
4. **Build once, read per frame.** Geometry, sampled point sets, textures, layouts, sort orders: build
   them deterministically at load. Each frame only reads them as a function of t. Seeded noise only.
5. **Look, score, fix the worst three, repeat.** Contact sheet with one frame per beat, the same sheet
   at phone size, strips across every transition, full-resolution stills of details. Nothing is
   shown to anyone before it survives three rounds (see `critique.md`).

## 2. What separated "finished" from "sketch"

Each row is a real rejection, its cause, and the fix that was accepted.

| Rejected as | Cause | What fixed it |
| --- | --- | --- |
| "Flat, a sketch" (3-D) | Plaques on walls, flat cards, top-down views | Objects as solids seen at an angle: key + rim light, reflections, depth of field, bloom only where it earns it |
| "Letters look like a draft" | Bare font fills, centred, a simple fade or pop | Type treated as a finished logotype: light, shadow, material, careful kerning, set into the scene; each letter with its own timing |
| "Same layout six times" | Object on top, word centred below, caption | A different composition per scene |
| "Infinite zoom is weak" | Camera braked to zero every bar; next world seen through a cut-out hole | Constant-rate flight in log space; a detail of one frame becomes the next scene; 2-3 levels visible at once |
| "Transition through a random hole" | Portal through the counter of a letter | Transitions through a *logical* detail (the 9 on a watch face, the ring of a can, a camera iris in a photo film) |
| "White pulses too much" | Bloom or brightness pumped on every kick | Steady exposure; energy comes from motion, not from flashing |
| "Fog between products" | Camera flew into the particle cloud | Particles travel as a tight, readable stream; the camera never enters the cloud |
| "Cursor goes stop, go, stop" | Long, slow, linear moves | Minimum-jerk glides of 0.4-0.7 s on a slight arc, arriving ~0.12 s before the click, slight hand drift in between |
| "Too much empty space at the bottom" | Layout designed with 16:9 thinking | Compose each format for its own shape; fill 9:16 evenly; respect platform UI zones |
| "Speech bubbles change too fast" | 0.45 s + 0.03 s per character | At least 1.5 s, about 0.7 s + 0.04 s per character; one bubble at a time |
| "Textures pass through each other" | Coplanar faces (z-fighting), hands through held objects | Audit coplanar faces before showing; rotate random blocks very slightly; hands sit outside the held object's edge |
| "Two pairs of hands", "arm has a step" | Rig parts not aligned | Limbs as one continuous piece (same section and axis); check every character in 2-3x crops |
| "Swish sounds pull attention" | Whoosh on every move in a calm film | Sound design matched to the film's energy: calm films get soft ticks, no shaker |
| "End card entrance too strong" | The same entrance reused in every film | Recurring elements (logo, end card) get an entrance designed for each film |

## 3. Rhythm and structure (measured, not guessed)

- **Measure a reference before copying its feel.** Step through it every 0.25 s and measure the audio
  (tempo, loudness, loudness range, where the loudest moment is). Intuition placed a drop at 8 s;
  measurement put it at 6 s, exactly where the reference's zoom landed.
- **Fast social reels change something every 0.25-0.5 s** and hold no frame longer than about 1 s.
  Calm films can breathe more, but something new still happens every 2-4 s.
- **Put the drop on the payoff image** and the breakdown on the calmest visual. Bring the beat back on
  the final wordmark.
- **Frame 0 must already be interesting.** A hook that asks a question works: words land on the first
  beats, the answer word lands hardest.
- **Loop endings:** when the platform loops, make the last frame equal the first.
- **A recap that shows everything at once** (all styles in bands, all products in a grid) is a strong
  penultimate beat before the end card.

## 4. Motion

- Springs and eased keys, never linear motion (unless the thing is mechanical on purpose).
- Zooms in log space: `s = a * (b / a) ** p` reads as a constant-rate dolly; a linear scale lerp
  lingers big and rushes small.
- Camera punch on hits is a 2-6 % scale bump that decays in ~0.2 beats, not a flash.
- Every shot keeps moving a little (a 3-8 % push or drift). A frozen camera reads as a slide.
- Characters: walk cycles driven by distance travelled (feet never slide), turns on minimum-jerk,
  idle life (breathing, head drift, blinks with per-character seeds so nobody blinks in sync).
- Point clouds: the same point count in every shape, both sets sorted along one space-filling curve
  so neighbours stay neighbours; stagger arrival top-down; burst out of the old shape, travel on an arc.
- Grain and glitch go after motion blur (in a post pass), or the sub-frame average erases them.

## 5. Type

- Every word must read at phone size. Check the half-size contact sheet, not the full-size one.
- Give the type a personality through *how it moves* (rise out of the baseline, scramble and resolve,
  drop and squash, slam with echoes, grow and sway, split-flap): `lib/type.js` has all six.
- Two faces at most (one display, one UI). Check every non-Latin glyph exists in both faces; a fallback
  glyph looks broken.

## 6. Sound

- Score and SFX synthesized in code unless the user supplies a track. Every visual accent has a sound,
  listed once in the film's hit list so both are generated from the same data.
- The mix breathes: not wall-to-wall SFX. Match the sound design to the film's energy.
- Master to -14 LUFS integrated, -1 dBTP. Hits within 20 ms of the frame.

## 7. 3-D specifics

- Hide the far side of sampled objects with an invisible depth-only occluder mesh, or a dense cloud
  reads as fog.
- Depth of field follows the shot's named focus point.
- Voxel worlds: slightly rounded boxes and seeded per-box colour jitter read as made objects.
- Renderers without a GPU (most CI machines) fall back to software WebGL, ~80x slower for 3-D. Say so
  in the render log instead of letting a render look hung.
