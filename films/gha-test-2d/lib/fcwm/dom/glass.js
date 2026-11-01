// Refractive "liquid glass" panels for DOM/SVG films (HyperFrames or plain HTML).
//
// How it works: a rounded-rect displacement map bends whatever is cloned inside the panel near its
// edges (the band), and three slightly different displacement scales are recombined per colour
// channel for a hint of chromatic dispersion. Each panel holds its own clone of the layers behind it,
// so the effect is deterministic per frame (no backdrop-filter, which some headless renderers skip).
//
// Craft notes: keep exposure steady (no pulsing glow on chrome), add a thin inner rim highlight and a
// soft drop shadow, and keep text on glass large enough to read at phone size.

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

/**
 * Displacement map as RGBA bytes: R/G = 128 + edge normal * strength, strength falling off over
 * `band` pixels from the rounded-rect edge. Pure: no DOM needed (testable in Node).
 */
export function displacementMap(w, h, r, band) {
  const out = new Uint8ClampedArray(w * h * 4);
  const hw = w / 2, hh = h / 2;
  r = Math.min(r, hw, hh);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = x + 0.5 - hw, Y = y + 0.5 - hh, ax = Math.abs(X) - (hw - r), ay = Math.abs(Y) - (hh - r);
    const qx = Math.max(ax, 0), qy = Math.max(ay, 0);
    const d = -(Math.hypot(qx, qy) + Math.min(Math.max(ax, ay), 0) - r); // distance inside the edge
    let gx, gy;
    if (qx > 0 && qy > 0) { const L = Math.hypot(qx, qy); gx = (Math.sign(X) * qx) / L; gy = (Math.sign(Y) * qy) / L; }
    else if (ax > ay) { gx = Math.sign(X); gy = 0; } else { gx = 0; gy = Math.sign(Y); }
    const k = d < band ? Math.pow(1 - clamp(d / band), 2.2) : 0, i = (y * w + x) * 4;
    out[i] = 128 + gx * k * 127; out[i + 1] = 128 + gy * k * 127; out[i + 2] = 128; out[i + 3] = 255;
  }
  return out;
}

/** SVG <filter> markup for a glass panel, given a data URL of the displacement map. */
export function glassFilter(id, mapUrl, w, h, scale = 60, spread = [1, 1.08, 1.16]) {
  const disp = spread.map((s, i) => `<feDisplacementMap in="SourceGraphic" in2="m" scale="${(scale * s).toFixed(2)}" xChannelSelector="R" yChannelSelector="G" result="d${i}"/>`).join('');
  const ch = (i, m) => `<feColorMatrix in="d${i}" type="matrix" values="${m}" result="c${i}"/>`;
  return `<filter id="${id}" x="0" y="0" width="${w}" height="${h}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">`
    + `<feImage href="${mapUrl}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="m"/>${disp}`
    + ch(0, '1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0') + ch(1, '0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0') + ch(2, '0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0')
    + `<feBlend in="c0" in2="c1" mode="screen" result="rg"/><feBlend in="rg" in2="c2" mode="screen"/></filter>`;
}

/**
 * Browser helper: register (once) a glass filter for a w x h panel with corner radius r in an SVG
 * <defs> element and return its id. Sizes are snapped to 8 px so similar panels share a filter.
 */
export function ensureGlassFilter(defs, w, h, r, { band = Math.min(w, h) * 0.38, scale = 60 } = {}) {
  const s8 = (v) => Math.max(8, Math.round(v / 8) * 8);
  w = s8(w); h = s8(h); r = Math.round(r / 8) * 8; band = s8(band);
  const id = `glass_${w}_${h}_${r}_${band}_${Math.round(scale)}`;
  if (defs.ownerDocument.getElementById(id)) return id;
  const c = defs.ownerDocument.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h);
  img.data.set(displacementMap(w, h, r, band));
  g.putImageData(img, 0, 0);
  defs.insertAdjacentHTML('beforeend', glassFilter(id, c.toDataURL(), w, h, scale));
  return id;
}
