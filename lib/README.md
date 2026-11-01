# lib/

Reusable motion building blocks, so an agent assembles a film from tested parts instead of writing
everything from scratch. This is where most of the quality for smaller models comes from.

Planned blocks: springs and easing, log-space zoom, point cloud morphing between shapes, 3D surface
sampling, bloom and depth of field, minimum-jerk cursor motion, per-letter typography, detail
transitions, music and sound effect synthesis on the beat grid.

Contract for every block:

- A pure function of its inputs and time; seeded randomness only (see the render contract in
  `AGENTS.md`).
- A short header comment: what it does, parameters, a usage example.
- No brand, palette or font baked in: colours, faces and sizes are parameters.
- A test or an example frame that proves it works.

Browser engines use JavaScript modules (`lib/*.js`); audio and offline tools use Python
(`lib/python/`).
