// Recipe "200,000 dots": 200k points flying from shape to shape. 140 BPM, 46 beats = 19.7 s.
// Pure function of time: every frame rebuilds the point cloud from u (beats) alone.
import * as M from './lib/motion.js';
import * as G from './gl.js';
// The original end card (the studio's own logo) was removed from this recipe. drawEndCard() is a
// neutral stand-in: whatever it paints becomes the last dot shape, then lies crisp over the dots.
function drawEndCard(ctx) {
  ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '700 170px Display'; ctx.fillText('THE', W / 2, H * 0.425);
  ctx.fillText('END', W / 2, H * 0.535);
}
const { W, H, E, clamp, prog, lerp, hash01 } = M;
const { THREE, N } = G;

// ---------------------------------------------------------------- timeline (beats)
// one continuous flight: dots fly in and spell the question, then burst and stream forward into each
// product in turn (camera chasing them), then into the end card, which blows apart into black.
const PRODUCTS = ['perfume', 'can', 'phones', 'lipstick', 'camera', 'shades'];   // NOIRA GRAVL KOVA SAVEN ARKO VISTRA
const TRAVEL = 2.1;                     // beats from burst to the next shape landing
const LAND = (i) => 8 + 4 * i;
const LOGO_AT = 34, BLAST = 40, GONE = 42.6, NBEATS = 44;
const KEYS = [
  { a: -1, b: -1, s: 'scatter' },
  { a: 0, b: 2.2, s: 'hook', mode: 'in' },
  ...PRODUCTS.map((s, i) => ({ a: LAND(i) - (i === 0 ? 1.6 : TRAVEL), b: LAND(i), s, mode: 'prod' })),
  { a: LOGO_AT - 3.4, b: LOGO_AT, s: 'card', mode: 'card' },
];
// where each shape sits in the world: the flight path
const OFF = {
  scatter: [0, 0, 0], hook: [0, 0, 0],
  perfume: [3.2, -1.2, -15], can: [-3.4, 1.4, -30], phones: [3.8, 0.6, -45], lipstick: [-3.2, -1.2, -60],
  camera: [3.0, 1.6, -75], shades: [-2.4, 0.2, -90], card: [0, 0, -106],
};
const KICK = (u) => (u >= 0 && u < 8 && u % 4 < 1) || (u >= 8 && u < 32);
const ST = 0.26;    // fraction of a travel window spread across points (burst first, arrival sweeps top-down)
const NO = 180000;  // object points in every shape (the rest is ambient dust)

const HITS = [
  [0, 'dots rush in', 'whoosh', { len: 1.2, from: 400, to: 3000, gain: 0.25 }],
  [3.2, 'question lands', 'impact', { gain: 0.3 }],
  ...KEYS.slice(2).map((k) => [k.a + 0.05, `${k.s} burst`, 'whoosh', { len: 0.9, from: 2600, to: 500, gain: 0.16 }]),
  [BLAST, 'blast', 'impact', { gain: 0.7 }],
  [BLAST + 0.02, 'blast air', 'whoosh', { len: 2.0, from: 5000, to: 300, gain: 0.35 }],
];

// ---------------------------------------------------------------- state built once
let SH = {}, STAG_I, BURST, glCanvas, OUTP, OUTC, OUTS, OUTN, OUTA, OCC = {};
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3();

function keyAt(u) { let k = 0; for (let i = 0; i < KEYS.length; i++) if (KEYS[i].a <= u) k = i; return k; }
const kickEnv = (u, dec = 0.16) => (KICK(u) ? Math.exp(-(u - Math.floor(u)) / dec) : 0);
const snareEnv = (u) => (KICK(u) && Math.floor(u) % 2 === 1 ? Math.exp(-(u - Math.floor(u)) / 0.2) : 0);

// pose of a shape at beat u (l = beats since its key started), placed on the flight path
function pose(sh, key, u) {
  const l = Math.max(0, u - key.a);
  let ry = sh.rot.y, rx = sh.rot.x, rz = sh.rot.z, s = sh.s;
  if (key.mode === 'prod') { ry += -0.55 + 0.2 * l; rx += 0.05 * Math.sin(l * 0.5); }
  if (sh.name === 'hook') { ry += 0.04 * Math.sin(u * 0.8); rx += 0.02 * Math.sin(u * 0.6); }
  if (key.mode !== 'card') s *= 1 + 0.012 * kickEnv(u);
  tmpE.set(rx, ry, rz); tmpQ.setFromEuler(tmpE);
  const o = OFF[sh.name];
  return new THREE.Matrix4().compose(tmpV.set(sh.p.x + o[0], sh.p.y + o[1], sh.p.z + o[2]), tmpQ, tmpS.set(s, s, s));
}

// dynamic terrain for the drop (grid points first, dust after)
const TCOLS = 450, TROWS = 400, TCOUNT = TCOLS * TROWS;
function terrain(sh, u) {
  const P = sh.pos, Cc = sh.col, k = kickEnv(u, 0.2), ld = Math.max(0, u - 36), SL = sh.slot;
  const fly = ld * 0.9, amp = 1 + 0.7 * k;
  let i = 0;
  for (let r = 0; r < TROWS; r++) {
    const zr = ((r / TROWS + fly / 26) % 1);
    const Z = -Math.pow(zr, 1.3) * 26 + 1.5, Zw = Z - fly * 0;   // world z of the row
    const zz = Z - fly * 1.0;                                     // terrain-space z (scrolls)
    for (let q = 0; q < TCOLS; q++, i++) {
      const j = SL[i];
      const X = (q / TCOLS - 0.5) * 11, f = Math.abs(X), env = Math.exp(-f * f / 9);
      const ring = Math.sin(Math.hypot(X, Z + 6) * 1.6 - ld * Math.PI * 2) * 0.25 * k;
      const h = env * amp * (2.0 * Math.abs(Math.sin(X * 2.1 + zz * 0.35)) * Math.abs(Math.sin(zz * 0.9)) + 0.18 * Math.sin(X * 7 + zz * 2)) + ring + 0.08 * Math.sin(zz * 3 + X);
      P[j * 3] = X; P[j * 3 + 1] = h - 1.5; P[j * 3 + 2] = Zw;
      const t = clamp(h / 1.6), fade = clamp((Z + 26) / 6);
      const g = (0.35 + 1.1 * t) * fade;
      Cc[j * 3] = lerp(G.LIME.r, G.PINK.r, t) * g; Cc[j * 3 + 1] = lerp(G.LIME.g, G.PINK.g, t) * g; Cc[j * 3 + 2] = lerp(G.LIME.b, G.PINK.b, t) * g;
    }
  }
}

// every shape gets exactly NO object points + N-NO dust, sorted along a 3-D Morton curve in its own
// posed space: point k of one shape sits where point k of the next one sits, so a morph flows instead of scattering
function morton(x, y, z) {
  const sp = (v) => { v = Math.min(1023, Math.max(0, v | 0)); v = (v | (v << 16)) & 0x030000FF; v = (v | (v << 8)) & 0x0300F00F; v = (v | (v << 4)) & 0x030C30C3; v = (v | (v << 2)) & 0x09249249; return v; };
  return sp(x) | (sp(y) << 1) | (sp(z) << 2);
}
function normalize(sh, seed) {
  const rnd = M.mulberry32(seed);
  let obj = [], dst = [];
  for (let i = 0; i < N; i++) { if (sh.siz[i] <= 0) continue; (sh.dust[i] ? dst : obj).push(i); }
  if (!dst.length) dst = obj;
  const pick = (src, n, keepOrder) => {
    if (src.length === n && keepOrder) return src.slice();
    const a = src.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    const out = a.slice(0, Math.min(n, a.length));
    while (out.length < n) out.push(a[Math.floor(rnd() * a.length)]);
    return out;
  };
  const src = [...pick(obj, NO, sh.name === 'terrain'), ...pick(dst, N - NO, false)];
  // posed coordinates (base pose) -> Morton key per part
  const Mx = new THREE.Matrix4().compose(sh.p, new THREE.Quaternion().setFromEuler(sh.rot), new THREE.Vector3(sh.s, sh.s, sh.s)), e = Mx.elements;
  const W3 = (i) => { const x = sh.pos[i * 3], y = sh.pos[i * 3 + 1], z = sh.pos[i * 3 + 2];
    return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]; };
  const order = (a0, a1) => {
    const idx = []; const w = [];
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (let k = a0; k < a1; k++) { const v = W3(src[k]); w.push(v); for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], v[c]); hi[c] = Math.max(hi[c], v[c]); } }
    const keys = w.map((v, k) => [morton(...[0, 1, 2].map((c) => (v[c] - lo[c]) / (hi[c] - lo[c] + 1e-6) * 1023).map((x, c) => c === 1 ? 1023 - x : x)), a0 + k, v[1]]);
    keys.sort((p, q) => p[0] - q[0]);
    return { keys, lo, hi };
  };
  const o1 = order(0, NO), o2 = order(NO, N);
  const out = { name: sh.name, rot: sh.rot, p: sh.p, s: sh.s, camP: sh.camP, camQ: sh.camQ, focus: sh.focus, aper: sh.aper,
    pos: new Float32Array(N * 3), col: new Float32Array(N * 3), siz: new Float32Array(N), nor: new Float32Array(N * 3), acc: new Float32Array(N * 3),
    sweep: new Float32Array(N), delay: null };
  const all = [...o1.keys, ...o2.keys];
  const dly = sh.delay ? new Float32Array(N) : null;
  if (sh.name === 'terrain') out.slot = new Int32Array(TCOUNT);
  all.forEach(([, k, y], j) => {
    const i = src[k];
    for (let c = 0; c < 3; c++) { out.pos[j * 3 + c] = sh.pos[i * 3 + c]; out.col[j * 3 + c] = sh.col[i * 3 + c]; out.nor[j * 3 + c] = sh.nor[i * 3 + c]; out.acc[j * 3 + c] = sh.acc[i * 3 + c]; }
    out.siz[j] = sh.siz[i];
    const L = j < NO ? o1 : o2;
    out.sweep[j] = 1 - (y - L.lo[1]) / (L.hi[1] - L.lo[1] + 1e-6);
    if (dly) dly[j] = sh.delay[i];
    if (out.slot && j < NO && i < TCOUNT) out.slot[i] = j;
  });
  out.delay = dly;
  return out;
}

function buildShapes() {
  const names = ['scatter', 'hook', ...PRODUCTS];
  names.forEach((n, k) => {
    const raw = G.capture(n);
    if (n === 'scatter') {   // start deep in front of the lens so the dots rush toward camera into the question
      const rnd = M.mulberry32(5);
      for (let i = 0; i < N; i++) {
        const a = rnd() * 6.283, r = 4.5 + Math.pow(rnd(), 0.8) * 8, z = -6 + rnd() * 9;   // a ring just outside the frame: dots streak in from every edge
        raw.pos[i * 3] = Math.cos(a) * r * 0.75; raw.pos[i * 3 + 1] = Math.sin(a) * r * 1.3; raw.pos[i * 3 + 2] = z;
        raw.siz[i] = 0.9 + rnd() * 0.6;
        const c = (rnd() < 0.5 ? G.LIME : rnd() < 0.5 ? G.WHITE : G.PINK).clone().multiplyScalar(0.35 + rnd() * 0.35);
        raw.col[i * 3] = c.r; raw.col[i * 3 + 1] = c.g; raw.col[i * 3 + 2] = c.b; raw.dust[i] = i >= NO ? 1 : 0;
      }
    }
    if (n === 'hook') { raw.delay = new Float32Array(N); const [q0, q1] = G.META.q; for (let i = q0; i < q1; i++) raw.delay[i] = 0.6; }
    SH[n] = normalize(raw, 100 + k);
  });
  G.pts.position.set(0, 0, 0); G.pts.rotation.set(0, 0, 0); G.pts.scale.setScalar(1);   // the last capture leaves its transform on the cloud
  SH.card = normalize(cardShape(), 300);
  STAG_I = new Float32Array(N); BURST = new Float32Array(N * 3);
  const rnd = M.mulberry32(9);
  for (let i = 0; i < N; i++) {
    STAG_I[i] = rnd();
    const a = rnd() * Math.PI * 2, b = Math.acos(2 * rnd() - 1), r = 0.15 + 0.35 * rnd();
    BURST[i * 3] = r * Math.sin(b) * Math.cos(a); BURST[i * 3 + 1] = r * Math.cos(b); BURST[i * 3 + 2] = r * Math.sin(b) * Math.sin(a);
  }
  OUTP = G.geo.attributes.position.array; OUTC = G.geo.attributes.color.array; OUTS = G.geo.attributes.size.array;
  OUTN = G.geo.attributes.nrm.array; OUTA = G.geo.attributes.acc.array;
  glCanvas = G.renderer.domElement;
}

function camBlend(A, B, m) {
  G.cam.position.lerpVectors(A.camP, B.camP, m);
  G.cam.quaternion.slerpQuaternions(A.camQ, B.camQ, m);
  G.mat.uniforms.focus.value = lerp(A.focus, B.focus, m);
  G.mat.uniforms.aper.value = lerp(A.aper, B.aper, m);
}

// the end card rebuilt from dots: sample the settled card (drawn by drawEndCard) on a plane that the
// card camera sees exactly full-frame, so the crisp card can be laid over it pixel for pixel
const CARD_H = 4.0, CARD_W = CARD_H * W / H;
let CARD_D = 0, CARD_CANVAS = null;
function cardShape() {
  const fov = G.cam.fov * Math.PI / 180; CARD_D = CARD_H / 2 / Math.tan(fov / 2);
  const d = CARD_CANVAS.getContext('2d').getImageData(0, 0, W, H).data;
  const rnd = M.mulberry32(31);
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), siz = new Float32Array(N), nor = new Float32Array(N * 3), acc = new Float32Array(N * 3), dust = new Uint8Array(N);
  let i = 0, tries = 0;
  while (i < NO && tries < 4e7) {
    tries++;
    const x = rnd() * W, y = rnd() * H, k = ((y | 0) * W + (x | 0)) * 4, al = d[k + 3] / 255;
    if (al < 0.15 || rnd() > al) continue;
    pos[i * 3] = (x / W - 0.5) * CARD_W; pos[i * 3 + 1] = -(y / H - 0.5) * CARD_H; pos[i * 3 + 2] = (rnd() - 0.5) * 0.03;
    const g = 0.42;
    col[i * 3] = d[k] / 255 * g; col[i * 3 + 1] = d[k + 1] / 255 * g; col[i * 3 + 2] = d[k + 2] / 255 * g;
    siz[i] = 0.42; i++;
  }
  for (; i < N; i++) {
    dust[i] = 1;
    const r = Math.pow(rnd(), 0.6) * 9, a = rnd() * 6.283, b = Math.acos(2 * rnd() - 1);
    pos[i * 3] = r * Math.sin(b) * Math.cos(a); pos[i * 3 + 1] = r * Math.cos(b) * 1.6; pos[i * 3 + 2] = r * Math.sin(b) * Math.sin(a) - 4;
    siz[i] = 0.5 + rnd() * 0.8;
    const c = (rnd() < 0.3 ? G.PINK : rnd() < 0.5 ? G.VIO : G.LIME).clone().multiplyScalar(0.1 + rnd() * 0.2);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  return { name: 'card', dust, pos, col, siz, nor, acc, rot: new THREE.Euler(0, 0, 0), p: new THREE.Vector3(0, 0, 0), s: 1,
    camP: new THREE.Vector3(0, 0, CARD_D), camQ: new THREE.Quaternion(), focus: CARD_D, aper: 0.25 };
}

const camLerp = (u, key) => {   // camera trails the swarm: starts after the burst, lands with it
  const win = key.b - key.a;
  if (win <= 0) return 1;
  return E.inOutCubic(clamp((u - key.a - 0.12 * win) / (0.88 * win)));
};
const cardPush = (u) => lerp(1.0, 0.95, E.inOutSine(clamp((u - LOGO_AT) / (BLAST - LOGO_AT))));

function renderGL(u) {
  const ki = keyAt(u), key = KEYS[ki], prev = KEYS[Math.max(0, ki - 1)];
  const A = SH[prev.s], B = SH[key.s];
  const MA = pose(A, prev, u), MB = pose(B, key, u);
  const ea = MA.elements, eb = MB.elements;
  const win = key.b - key.a, span = win * (1 - ST), SW = B.sweep, dl = B.delay;
  const isIn = key.mode === 'in';
  const pa = A.pos, pb = B.pos, ca = A.col, cb = B.col, sa = A.siz, sb = B.siz, na = A.nor, nb = B.nor, aa = A.acc, ab = B.acc;
  // burst centre = A's world origin; arc of the stream between the two shapes
  const cx = ea[12], cy = ea[13], cz = ea[14];
  const oA = OFF[A.name], oB = OFF[B.name];
  const arcY = 1.6 * Math.sign((ki % 2) - 0.5), arcX = -0.25 * (oB[0] - oA[0]);
  // the final blast
  const qb = clamp((u - BLAST) / (GONE - BLAST)), blast = u >= BLAST, bE = 1 - Math.pow(1 - qb, 2), bFade = Math.pow(1 - qb, 1.1);
  for (let i = 0; i < N; i++) {
    const i3 = i * 3;
    const stg = isIn ? 0.75 * STAG_I[i] + 0.25 * SW[i] : 0.35 * STAG_I[i] + 0.65 * SW[i];
    let p = win <= 0 ? 1 : (u - key.a - stg * win * ST - (dl ? dl[i] : 0)) / span;
    p = p <= 0 ? 0 : p >= 1 ? 1 : p;
    const e = isIn ? 1 - Math.pow(1 - p, 3) : E.inOutSine(p);
    const x0 = pa[i3], y0 = pa[i3 + 1], z0 = pa[i3 + 2], x1 = pb[i3], y1 = pb[i3 + 1], z1 = pb[i3 + 2];
    const ax = ea[0] * x0 + ea[4] * y0 + ea[8] * z0 + ea[12], ay = ea[1] * x0 + ea[5] * y0 + ea[9] * z0 + ea[13], az = ea[2] * x0 + ea[6] * y0 + ea[10] * z0 + ea[14];
    const bx = eb[0] * x1 + eb[4] * y1 + eb[8] * z1 + eb[12], by = eb[1] * x1 + eb[5] * y1 + eb[9] * z1 + eb[13], bz = eb[2] * x1 + eb[6] * y1 + eb[10] * z1 + eb[14];
    let ox = 0, oy = 0, oz = 0, flash = 1;
    if (!isIn && p > 0 && p < 1) {
      // light explosion: push out from the shape's centre, then the stream pulls everything on
      let dx = ax - cx, dy = ay - cy, dz = az - cz; const dn = Math.hypot(dx, dy, dz) + 1e-4;
      const q = clamp(p * 3.2), out = (1 - Math.pow(1 - q, 3)) * (1 - e) * 0.8;
      dx = dx / dn + BURST[i3] * 1.0; dy = dy / dn + BURST[i3 + 1] * 1.0; dz = dz / dn + BURST[i3 + 2] * 1.0;
      const sw = Math.sin(Math.PI * p);
      ox = dx * out + sw * (arcX + BURST[i3 + 2] * 0.3); oy = dy * out + sw * (arcY + BURST[i3] * 0.3); oz = dz * out + sw * BURST[i3 + 1] * 0.3;
      flash = 1 + 0.9 * Math.exp(-p * 9) * q;
    }
    let X = ax + (bx - ax) * e + ox, Y = ay + (by - ay) * e + oy, Z = az + (bz - az) * e + oz;
    let fade = isIn ? 1 + 0.8 * (1 - e) : 1, grow = isIn ? 1 + 0.6 * (1 - e) : 1;
    if (blast) {   // everything leaves the logo radially and toward the lens, then goes dark
      const dx = X - eb[12], dy = Y - eb[13];
      const r = Math.hypot(dx, dy) + 0.05, sp = 0.6 + 0.8 * STAG_I[i];
      const rr = 0.35 + 0.65 * Math.min(1, r / 2.2);   // the rim flies first, the core follows
      X += (dx / r + BURST[i3] * 0.8) * bE * 8 * sp * rr; Y += (dy / r + BURST[i3 + 1] * 0.8) * bE * 8 * sp * rr; Z += (0.12 + BURST[i3 + 2] * 0.6) * bE * 8 * sp;
      fade = bFade * (1.7 + 1.4 * Math.exp(-qb * 8)); grow = 1 + 1.2 * bE;
    }
    OUTP[i3] = X; OUTP[i3 + 1] = Y; OUTP[i3 + 2] = Z;
    const g = flash * fade;
    OUTC[i3] = (ca[i3] + (cb[i3] - ca[i3]) * e) * g; OUTC[i3 + 1] = (ca[i3 + 1] + (cb[i3 + 1] - ca[i3 + 1]) * e) * g; OUTC[i3 + 2] = (ca[i3 + 2] + (cb[i3 + 2] - ca[i3 + 2]) * e) * g;
    OUTS[i] = (sa[i] + (sb[i] - sa[i]) * e) * grow;
    const useB = e > 0.5, nn = useB ? nb : na, aac = useB ? ab : aa, el = useB ? eb : ea;
    const nx = nn[i3], ny = nn[i3 + 1], nz = nn[i3 + 2];
    if (nx === 0 && ny === 0 && nz === 0) { OUTN[i3] = OUTN[i3 + 1] = OUTN[i3 + 2] = 0; }
    else {
      const sc = Math.hypot(el[0], el[1], el[2]) || 1;
      OUTN[i3] = (el[0] * nx + el[4] * ny + el[8] * nz) / sc; OUTN[i3 + 1] = (el[1] * nx + el[5] * ny + el[9] * nz) / sc; OUTN[i3 + 2] = (el[2] * nx + el[6] * ny + el[10] * nz) / sc;
    }
    OUTA[i3] = aac[i3] * fade; OUTA[i3 + 1] = aac[i3 + 1] * fade; OUTA[i3 + 2] = aac[i3 + 2] * fade;
  }
  for (const n of ['position', 'color', 'size', 'nrm', 'acc']) G.geo.attributes[n].needsUpdate = true;
  // camera: chase the swarm along the path, bank into the turn, keep drifting while a shape holds
  const m = camLerp(u, key);
  camBlend(A, B, m);
  const ox = lerp(oA[0], oB[0], m), oy = lerp(oA[1], oB[1], m) + arcY * 0.9 * Math.sin(Math.PI * m), oz = lerp(oA[2], oB[2], m);
  G.cam.position.x += ox + arcX * 0.9 * Math.sin(Math.PI * m); G.cam.position.y += oy; G.cam.position.z += oz;
  if (key.mode === 'card') {
    if (u >= key.b) { G.cam.position.set(0, 0, OFF.card[2] + CARD_D * cardPush(u)); G.cam.quaternion.identity(); }
    if (blast) G.cam.translateZ(-1.2 * E.inCubic(qb));
  } else {
    const bank = 0.16 * Math.sin(Math.PI * m) * Math.sign(oB[0] - oA[0] || 1);
    G.cam.rotateZ(-bank);
    const l = Math.max(0, u - key.b);
    G.cam.translateZ(isIn ? 3.5 * (1 - E.outCubic(clamp(u / 4))) : -0.5 * Math.sin(clamp(l / 2.6) * Math.PI / 2) + 1.5 * Math.sin(Math.PI * m));   // pull back a touch mid-flight so the stream reads as a comet
  }
  if (key.mode !== 'card' && !isIn) { const d = Math.sin(Math.PI * m); G.mat.uniforms.focus.value += 3.0 * d; G.mat.uniforms.aper.value *= 1 - 0.5 * d; }
  G.mat.uniforms.px.value = 1;
  G.bloom.strength = 0.4 + (blast ? 0.5 * Math.exp(-qb * 6) : 0);
  G.scene.children[0].material.uniforms.dim.value = (1 - 0.7 * E.inOutSine(prog(u, LOGO_AT - 2, LOGO_AT + 0.5))) * (blast ? Math.pow(1 - qb, 2) : 1);
  G.renderer.setClearColor('#000000');
  G.comp.render();
}

let GRAIN = null;
M.film({
  fonts: [M.font(100, 700, 'Display'), M.font(100, 400, 'Script')],
  hits: HITS,
  samples: 6,
  init() {
    CARD_CANVAS = document.createElement('canvas'); CARD_CANVAS.width = W; CARD_CANVAS.height = H;
    drawEndCard(CARD_CANVAS.getContext('2d'));
    buildShapes();
    GRAIN = document.createElement('canvas'); GRAIN.width = GRAIN.height = 256;
    const gc = GRAIN.getContext('2d'), d = gc.createImageData(256, 256), rnd = M.mulberry32(77);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.floor(rnd() * 255); d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    gc.putImageData(d, 0, 0);
  },
  draw(ctx, u) {
    if (u >= GONE + 0.3) { M.fill(ctx, '#000000'); return; }
    renderGL(u); ctx.drawImage(glCanvas, 0, 0, W, H);
    // once the logo has formed, the crisp card settles in over the dots (same plane, same scale)
    const k = 0.5 * E.inOutSine(prog(u, LOGO_AT + 0.6, LOGO_AT + 2.2)) * (1 - E.outCubic(prog(u, BLAST, BLAST + 0.35)));
    if (k > 0) {
      const sc = 1 / cardPush(u);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k;
      ctx.translate(W / 2, H / 2); ctx.scale(sc, sc); ctx.translate(-W / 2, -H / 2);
      ctx.drawImage(CARD_CANVAS, 0, 0); ctx.restore();
    }
  },
  post(ctx, u, t) {
    if (!GRAIN) return;
    const f = Math.floor(t * 60);
    ctx.save(); ctx.globalAlpha = 0.04; ctx.globalCompositeOperation = 'overlay';
    const ox = Math.floor(hash01(f, 3) * 256), oy = Math.floor(hash01(f, 8) * 256);
    ctx.translate(-ox, -oy); ctx.fillStyle = ctx.createPattern(GRAIN, 'repeat'); ctx.fillRect(0, 0, W + 256, H + 256);
    ctx.restore();
  },
});
