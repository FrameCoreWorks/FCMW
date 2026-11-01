// pathtrace.js: the path-traced quality mode for 3-D sets (three-gpu-pathtracer, MIT).
// The same set object gl.js renders with rasterisation ({ scene, camera, update(t, u, opts) }) is
// path traced instead: real reflections and refractions, soft shadows from area lights, glass,
// caustics, depth of field. It is slow (seconds per frame on a good GPU) and stays a pure function
// of time: every frame starts from an empty image and a restarted sample sequence, traces a fixed
// number of samples, and every random number comes from a fixed seed, never Math.random or the clock.
//
//   import * as G from './lib/gl.js';
//   import * as PT from './lib/pathtrace.js';
//   M.film({ samples: 4,                      // sub-frames share the sample budget (see below)
//     async init() { await G.initGL(); await PT.initPathTracer({ spp: 256 }); SET = mySet(); PT.prepare(SET); },
//     draw(ctx, u, t) { PT.renderSet(ctx, SET, t, u); M.text(ctx, ...); } });
//
// Setup: `npm i three-gpu-pathtracer@0.0.27 three-mesh-bvh@0.9.17` next to three (scaffold.mjs
// --pathtrace writes the import map). Supported: MeshStandardMaterial and MeshPhysicalMaterial
// (transmission, clearcoat, sheen, iridescence), emissive meshes as area lights, scene.environment,
// PhysicalCamera (fStop, focusDistance, apertureBlades) for depth of field. Bloom passes and custom
// ShaderMaterials are not path traced; references/pathtrace.md has the full list and the costs.
//
// Quality knobs, all overridable from the render command (render.mjs --spp N --pt-scale s --draft):
//   spp      samples per pixel per frame (noise falls with the square root: 4x samples, half the grain)
//   scale    internal resolution (0.5 = trace a quarter of the pixels, upscaled; for drafts)
//   bounces  diffuse/specular bounces; transmissiveBounces for glass seen through glass
//   draft    render with the rasteriser instead (fast previews, contact sheets of the layout)
// With motion blur the film's sub-frames split the budget: spp 256 with samples: 4 traces 64 samples
// at each of 4 shutter times, so blur costs nothing extra and averages away noise like more samples.
import { THREE, R } from './gl.js';
import * as M from './motion.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { WebGLPathTracer, PhysicalCamera, GradientEquirectTexture } from 'three-gpu-pathtracer';

export { PhysicalCamera };
RectAreaLightUniformsLib.init();   // so draft (rasterised) frames light RectAreaLights too

const params = new URLSearchParams(location.search);
const num = (k) => (params.has(k) && params.get(k) !== '' ? Number(params.get(k)) : undefined);
let OPT = null;
const tracers = new Map();

// Deterministic stand-in for Math.random while the library builds noise tables and shuffles its
// sample strata. Restored right after: film code must never call Math.random (render contract).
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seeded(seed, fn) {
  const real = Math.random;
  Math.random = mulberry32(seed);
  try { return fn(); } finally { Math.random = real; }
}
export async function initPathTracer({ spp = 256, scale = 1, bounces = 8, transmissiveBounces = 10,
  seed = 1, draft = false, tiles = 1 } = {}) {
  if (!R) throw new Error('pathtrace.js: call G.initGL() before PT.initPathTracer()');
  OPT = {
    spp: num('spp') ?? spp,
    scale: num('ptscale') ?? scale,
    draft: params.has('ptdraft') ? params.get('ptdraft') === '1' : draft,
    bounces, transmissiveBounces, seed, tiles,
  };
  if (!(OPT.spp >= 1)) throw new Error(`pathtrace.js: spp must be 1 or more (got ${OPT.spp})`);
  window.PATHTRACE = { ...OPT };
  return OPT;
}

function tracerFor(set) {
  let pt = tracers.get(set);
  if (pt) return pt;
  // the WebGL tracer is the one that runs on every GPU and in headless Chromium today; upstream marks
  // it deprecated in favour of WebGPU, so the version is pinned and its one warning silenced here
  const warn = console.warn;
  console.warn = (...a) => { if (!/WebGLPathTracer: This class has been deprecated/.test(String(a[0]))) warn(...a); };
  try { pt = seeded(OPT.seed, () => new WebGLPathTracer(R)); } finally { console.warn = warn; }
  Object.assign(pt, { bounces: OPT.bounces, transmissiveBounces: OPT.transmissiveBounces,
    stableNoise: true, renderToCanvas: false, rasterizeScene: false, dynamicLowRes: false,
    renderDelay: 0, minSamples: 0, fadeDuration: 0, synchronizeRenderSize: false });
  pt.tiles.set(OPT.tiles, OPT.tiles);
  const inner = pt._pathTracer;
  // compile shaders synchronously when first used, so a frame never waits on a background compile
  // (a skipped sample would make two renders of the same frame disagree)
  inner.material.removeEventListener('recompilation', inner._compileFunction);
  inner.setSize(Math.max(1, Math.round(M.W * OPT.scale)), Math.max(1, Math.round(M.H * OPT.scale)));
  tracers.set(set, pt);
  return pt;
}

// Build the tracer for a set in init() (shader compile and BVH happen here, not in the first frame).
export function prepare(set, t = 0, u = 0, opts = {}) {
  if (OPT.draft) return;
  const pt = tracerFor(set);
  set.update(t, u, opts);
  set.scene.updateMatrixWorld(true);
  seeded(OPT.seed, () => pt.setScene(set.scene, set.camera));
  trace(pt, 1, 0);
}

// Trace spp samples into an empty image. Sub-frame 0 of a frame also restarts the sample sequence
// (so a frame never depends on the frame before it); later sub-frames of the same frame continue the
// sequence where the previous one stopped, so the shutter samples are different samples, and averaging
// them cuts grain like one longer render. Sub-frames always run 0..n-1 inside one seek(), so the
// result is still a pure function of the frame's time.
function trace(pt, spp, k) {
  const inner = pt._pathTracer;
  if (k === 0) inner.reset();
  else {
    inner.stableNoise = false;            // clear the image but keep the random sequence going
    inner.reset();
    inner.stableNoise = true;
    inner.material.stratifiedTexture.stableNoise = true;
  }
  pt._queueReset = false;
  seeded(OPT.seed + k, () => { while (inner.samples < spp) inner.update(); });
}

// Path trace the set at time t and composite it onto ctx, like G.renderSet (opts.alpha, opts.blend).
export function renderSet(ctx, set, t, u, opts = {}) {
  if (!OPT) throw new Error('pathtrace.js: call PT.initPathTracer() in init()');
  if (OPT.draft) {
    set.update(t, u, opts);
    R.setClearColor(0x000000, 0);
    R.render(set.scene, set.camera);
  } else {
    const pt = tracerFor(set);
    set.update(t, u, opts);
    set.scene.updateMatrixWorld(true);
    set.camera.updateMatrixWorld();
    // geometry moved: the BVH is refit (fast) unless the mesh list changed (rebuilt, slow)
    seeded(OPT.seed, () => pt.setScene(set.scene, set.camera));
    const sub = M.SUB.n > 1 ? M.SUB : { k: 0, n: 1 };
    trace(pt, Math.max(1, Math.round(OPT.spp / sub.n)), sub.k);
    const inner = pt._pathTracer;
    inner.alpha = inner.material.backgroundAlpha !== 1 || !R.extensions.get('EXT_float_blend');
    const quad = pt._quad;
    R.setRenderTarget(null);
    R.setViewport(0, 0, M.W, M.H);
    R.setClearColor(0x000000, 0);
    R.clear();
    quad.material.map = inner.target.texture;
    quad.material.opacity = 1;
    quad.material.blending = THREE.NoBlending;
    quad.render(R);
  }
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  if (opts.blend) ctx.globalCompositeOperation = opts.blend;
  ctx.drawImage(R.domElement, 0, 0);
  ctx.restore();
}

// An area light (THREE.RectAreaLight): the path tracer samples it directly, so it cleans up fast.
// Prefer it to an emissive mesh as the key light: emissive surfaces light the scene too, but only
// when a bounce happens to hit them, which is grainy for small, bright lamps.
export function areaLight(color = 0xffffff, intensity = 20, width = 4, height = 2.5) {
  return new THREE.RectAreaLight(color, intensity, width, height);
}

// A soft environment: a vertical gradient around the scene (fill light and what reflections show).
export function gradientEnvironment(top = 0x404040, bottom = 0x080808) {
  const env = new GradientEquirectTexture(256);
  env.topColor.set(top); env.bottomColor.set(bottom); env.update();
  return env;
}

// A camera with depth of field: fStop (lower = shallower), focusDistance in world units.
export function physicalCamera(fov = 35, { fStop = 2.8, focusDistance = 5, apertureBlades = 6, near = 0.1, far = 400 } = {}) {
  const cam = new PhysicalCamera(fov, M.W / M.H, near, far);
  Object.assign(cam, { fStop, focusDistance, apertureBlades });
  return cam;
}
