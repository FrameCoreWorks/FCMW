<!-- Copied from AGENTS.md#render-contract by scripts/sync-skill-refs.mjs. Edit the source, then run it again. -->
# Render contract
 (all code-based engines)

Every film is a pure function of time: given `t`, the code paints exactly one frame, the same way
every time.

- No wall clock (`Date.now`, `performance.now`), no `setTimeout` or `requestAnimationFrame` driving
  the picture, no CSS transitions, no state carried from one frame to the next.
- Randomness only from seeded noise (a fixed seed per film), never `Math.random`.
- Frames may be rendered out of order and in parallel; any hidden state makes frames disagree.
- Time everything on the beat grid (`beats.json`) when the film has music, and list sound accents as
  hits so audio and picture stay in sync.
- The same frame rendered twice must produce the same image (checked by `qa/`).
