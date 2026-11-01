// __TITLE__: a path-traced 3-D film. Pure function of time: window.seek(t) paints frame t.
// sets/studio.js is a neutral sample set (matte floor, glass, metal, one area light) to replace with
// the approved shot list. Quality: film.json "pathtrace" (spp, scale); see references/pathtrace.md.
import * as M from './lib/motion.js';
import * as G from './lib/gl.js';
import * as PT from './lib/pathtrace.js';
import { studioSet } from './sets/studio.js';

let STUDIO = null;

M.film({
  // motion blur: 4 shutter samples share the frame's sample budget (spp / 4 each), so blur is free
  samples: 4,
  async init() {
    await G.initGL();
    await PT.initPathTracer({ ...(M.CFG.pathtrace || {}) });
    STUDIO = studioSet();
    PT.prepare(STUDIO);
  },
  draw(ctx, u, t) {
    M.fill(ctx, '#000000');
    PT.renderSet(ctx, STUDIO, t, u);
  },
});
