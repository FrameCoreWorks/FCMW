// gha-test-3d: a 3-D starter film. Pure function of time: window.seek(t) paints frame t (lib/motion.js).
// sets/stage.js is a neutral sample set (three primitives, floor, orbiting camera); the 2-D title is
// drawn over it on the film's canvas. Replace both with the approved shot list; references/3d.md.
import * as M from './lib/motion.js';
import * as G from './lib/gl.js';
import { stageSet, DROPS } from './sets/stage.js';

const { W, H, FORMAT, E, prog, font, layout, glyph, fill } = M;

// Placeholder colours and copy: take them from the user's brief or brand kit, never invent them.
const C = { bg: '#1c1c1c', ink: '#f2f2f2' };
const DISPLAY = 'Display';

// Every visual accent: [beat, label, sfx, opts]. scripts/sfx.mjs puts a sound on each one.
const HITS = [
  [DROPS[0], 'shape 1 lands', 'thud'],
  [DROPS[1], 'shape 2 lands', 'thud', { pitch: 'A3' }],
  [DROPS[2], 'shape 3 lands', 'thud', { pitch: 'D3' }],
  [2, 'camera push', 'whoosh', { len: 0.5 }],
  [3, 'title', 'pop', { pitch: 'D6' }],
];

let STAGE = null;

function title(ctx, u) {
  const s = FORMAT.safe;
  const size = FORMAT.pick({ '16x9': 120, '9x16': 110, '1x1': 100 });
  const f = font(size, 800, DISPLAY);
  const L = layout(ctx, 'Your title', f, -0.02 * size);
  const x0 = (W - L.width) / 2, base = s.y + size * 1.1;
  L.glyphs.forEach((g, j) => {
    const p = E.outBack(prog(u, 3 + j * 0.04, 3.5 + j * 0.04), 1.4);
    if (p <= 0) return;
    glyph(ctx, g.ch, x0 + g.cx, base + (1 - p) * 60, f, C.ink, 1, 1);
  });
}

M.film({
  fonts: [font(100, 800, DISPLAY)],
  hits: HITS,
  samples: 2,   // motion blur subframes: each is a full WebGL render (slow without a GPU, e.g. in CI)
  async init() {
    await G.initGL();
    STAGE = stageSet();
  },
  draw(ctx, u, t) {
    fill(ctx, C.bg);
    G.renderSet(ctx, STAGE, t, u);
    title(ctx, u);
  },
});
