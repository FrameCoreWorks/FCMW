// Recipe: "Six brands, six ways to move". Kinetic type reel, pure function of time.
// window.seek(t) paints frame t. Timing in beats (u) on the designed grid (120 BPM, 50 beats = 25 s).
// A question hook, six invented brands that each move in their own way, all six at once, end card.
import * as M from './lib/motion.js';

const { W, H, FORMAT, E, TAU, prog, lerp, clamp, springU, SPRING, wobble, font, layout, fill, hash01 } = M;

// ---------------------------------------------------------------- brand
const C = { ink: '#0B0B0C', white: '#FFFFFF', accent: '#FF5A1F', tile: '#1C1C20', dim: '#5A5A60' };
const DISPLAY = 'Display';
const P = FORMAT.pick;
const SAFE = FORMAT.safe;
const CY = P({ '9x16': H * 0.45, '1x1': H * 0.5, '16x9': H * 0.5 });

// six invented brands, one way of moving each
const NAMES = { lux: 'ORVELLE', tech: 'QUBRIX', play: 'POPLI', sport: 'VANTREK', eco: 'mossa', fin: 'LEDGERLY' };


const ECHO = [180, 360, 540].map((d) => d * 0.42);
const ECHO_A = [0.55, 0.28, 0.12];

// sections (beats)
const S = { hook: 0, lux: 4, tech: 10, play: 16, sport: 22, eco: 28, fin: 34, recap: 40, end: 44, out: 50 };

// ---------------------------------------------------------------- hits (sound follows picture)
const HOOK_W = [['HOW', 0], ['DOES', 0.5], ['YOUR', 1], ['BRAND', 1.5]];
const TECH_RES = [...NAMES.tech].map((_, i) => S.tech + 0.3 + 0.4 * i);
const PLAY_LAND = [...NAMES.play].map((_, i) => S.play + 0.5 * i);
const SPORT_HITS = [0, 1.5, 2, 3.5, 4, 5, 5.5];
const ECO_GROW = [...NAMES.eco].map((_, i) => S.eco - 0.12 + 0.3 * i);
const FIN_SET = [...NAMES.fin].map((_, i) => S.fin + 0.5 + 0.22 * i);
const HITS = [
  ...HOOK_W.map(([w, b], i) => [b, `hook ${w}`, 'thud', { pitch: 140 - i * 10, gain: 0.35 }]),
  [2, 'MOVE?', 'impact', { gain: 0.6 }],
  [2.5, 'MOVE lux', 'click', { gain: 0.25 }], [3, 'MOVE tech', 'click', { gain: 0.3 }],
  [3.25, 'MOVE play', 'pop', { gain: 0.3 }], [3.5, 'MOVE sport', 'thud', { pitch: 120, gain: 0.4 }],
  [S.lux, 'hairline', 'whoosh', { len: 0.6, from: 1500, to: 6000, gain: 0.08 }],
  [S.lux + 3.4, 'fill sweep', 'bell', { pitch: 'C7', gain: 0.08 }],
  [S.tech, 'tech cut', 'click', { gain: 0.4 }],
  ...TECH_RES.map((b, i) => [b, `tech resolve ${i}`, 'blip', { pitch: ['F6', 'Ab6', 'C7', 'Eb7', 'F7', 'Ab7'][i], gain: 0.12 }]),
  ...PLAY_LAND.map((b, i) => [b, `drop ${i}`, 'pop', { pitch: ['C5', 'Eb5', 'F5', 'G5', 'C6'][i], gain: 0.3 }]),
  [S.play + 3, 'O flips', 'boing', { pitch: 300, to: 900, gain: 0.22 }],
  [S.sport - 0.12, 'sport slam in', 'whoosh', { len: 0.35, from: 3500, to: 400, gain: 0.35 }],
  [S.sport, 'sport slam', 'impact', { gain: 0.6 }],
  [S.sport + 4, 'tickers', 'whoosh', { len: 0.4, from: 600, to: 3000, gain: 0.25 }],
  ...ECO_GROW.map((b, i) => [b, `grow ${i}`, 'blip', { pitch: ['Eb6', 'G6', 'Bb6', 'C7', 'Eb7'][i], gain: 0.06 }]),
  ...FIN_SET.map((b, i) => [b, `flap ${i}`, 'click', { gain: 0.18 }]),
  [S.fin + 2.2, 'chart', 'whoosh', { len: 0.5, from: 800, to: 5000, gain: 0.12 }],
  ...[0, 1, 2, 3, 4, 5].map((i) => [S.recap + i / 3, `band ${i}`, 'whoosh', { len: 0.2, from: 800 + i * 300, to: 3000, gain: 0.12 }]),
  [S.end - 0.2, 'bands out', 'whoosh', { len: 0.4, from: 2600, to: 500, gain: 0.3 }],
  [S.end, 'end card', 'impact'],
];

// ---------------------------------------------------------------- helpers
const punch = (u, hits, amp, dec = 0.18) => hits.reduce((z, h) => z * (u >= h ? 1 + amp * Math.exp(-(u - h) / dec) : 1), 1);
function camera(ctx, { x = 0, y = 0, z = 1, r = 0, fx = W / 2, fy = CY }) {
  ctx.translate(fx + x, fy + y); ctx.rotate(r); ctx.scale(z, z); ctx.translate(-fx, -fy);
}
// a word at size s with tracking tr (fraction of s): glyph centres relative to the word centre
const L100 = {};
function word(ctx, str, s, tr = 0) {
  if (!L100[str]) L100[str] = layout(ctx, str, font(100, 700, DISPLAY), 0);
  const L = L100[str], k = s / 100, t = tr * s;
  const width = L.width * k + t * (str.length - 1);
  return { width, xs: L.glyphs.map((q, i) => q.cx * k + i * t - width / 2), advs: L.glyphs.map((q) => q.adv * k), asc: L.asc * k, f: font(s, 700, DISPLAY) };
}
// largest size <= max at which str (with tracking tr) fits maxW
function fit(ctx, str, tr, maxW, max) {
  const w = word(ctx, str, 100, tr).width;
  return Math.min(max, (100 * maxW) / w);
}
function g(ctx, ch, x, y, f, { color = C.white, sx = 1, sy = 1, rot = 0, skew = 0, stroke = 0 } = {}) {
  if (Math.abs(sx) < 1e-3 || Math.abs(sy) < 1e-3) return;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  if (skew) ctx.transform(1, 0, -skew, 1, 0, 0);
  ctx.scale(sx, sy);
  ctx.font = f; ctx.textAlign = 'center';
  if (stroke) { ctx.lineWidth = stroke / Math.max(Math.abs(sx), Math.abs(sy)); ctx.strokeStyle = color; ctx.lineJoin = 'miter'; ctx.strokeText(ch, 0, 0); }
  else { ctx.fillStyle = color; ctx.fillText(ch, 0, 0); }
  ctx.restore();
}
function label(ctx, str, x, y, size, color, track = 0.3, n = 99, skew = 0) {
  const f = font(size, 700, DISPLAY);
  const L = layout(ctx, str, f, track * size);
  const x0 = x - L.width / 2;
  L.glyphs.slice(0, n).forEach((q) => g(ctx, q.ch, x0 + q.cx, y, f, { color, skew }));
}
const typed = (l, a, b, str) => Math.ceil(prog(l, a, b) * str.length);

// ---------------------------------------------------------------- 01 LUXURY: slow, wide, outlined, then gilded
function lux(ctx, lu, cx, cy, s, loop = false, str = NAMES.lux) {
  const tr = loop ? 0.26 + 0.03 * Math.sin(TAU * lu / 4) : lerp(0.36, 0.2, E.outCubic(prog(lu, 0, 6)));
  const w = word(ctx, str, s, tr);
  const base = cy + w.asc / 2;
  const fillP = loop ? 1 : E.inOutCubic(prog(lu, 3.2, 4.6));
  [...str].forEach((ch, i) => {
    const p = loop ? 1 : E.outQuint(prog(lu, 0.5 + 0.26 * i, 2.2 + 0.26 * i));
    if (p <= 0) return;
    const x = cx + w.xs[i];
    ctx.save();
    ctx.beginPath(); ctx.rect(x - s, base - w.asc * 1.25, 2 * s, w.asc * 1.25 + s * 0.08); ctx.clip();
    g(ctx, ch, x, base + (1 - p) * w.asc * 1.1, w.f, { stroke: Math.max(2, s * 0.012) });
    ctx.restore();
  });
  if (fillP > 0) {
    ctx.save();
    ctx.beginPath(); ctx.rect(cx - w.width / 2 - s, 0, s + (w.width + s) * fillP, H); ctx.clip();
    [...str].forEach((ch, i) => g(ctx, ch, cx + w.xs[i], base, w.f));
    ctx.restore();
  }
  const hp = loop ? 1 : E.outExpo(prog(lu, -0.05, 1.2));
  if (hp > 0) {
    const hw = (w.width / 2 + s * 0.2) * hp;
    ctx.fillStyle = C.accent; ctx.fillRect(cx - hw, base + s * 0.2, 2 * hw, Math.max(2, s * 0.014));
  }
}

// ---------------------------------------------------------------- 02 TECH: scramble, resolve, glitch
const JUNK = '01<>/#%[]=+XZ7';
function tech(ctx, lu, cx, cy, s, loop = false, str = NAMES.tech) {
  const w = word(ctx, str, s, 0.08);
  const base = cy + w.asc / 2;
  const res = [...str].map((_, i) => (loop ? -1 : 0.3 + 0.4 * i));
  const re = loop ? Math.floor(lu) % str.length : -1;
  const glitchW = loop ? [[0, 0.18], [2, 2.2], [3.5, 3.65]] : [[0, 0.25], [2.5, 2.75], [4, 4.2], [5.25, 5.5]];
  const gl = glitchW.some(([a, b]) => lu >= a && lu < b);
  const step = Math.floor(lu * 16);
  const drawWord = (color, dx = 0) => [...str].forEach((c0, i) => {
    let ch = lu >= res[i] ? c0 : JUNK[Math.floor(hash01(Math.floor(lu * 8) * 7 + i, 11) * JUNK.length)];
    if (i === re && (lu % 1) < 0.4) ch = JUNK[Math.floor(hash01(step + i, 5) * JUNK.length)];
    if (loop || lu >= res[i] - 0.6) g(ctx, ch, cx + w.xs[i] + dx, base, w.f, { color });
  });
  if (gl) {
    const strips = 9, top = base - w.asc * 1.1, hh = (w.asc * 1.3) / strips;
    for (let k = 0; k < strips; k++) {
      const off = (hash01(step * 13 + k, 3) - 0.5) * s * 0.5;
      ctx.save(); ctx.beginPath(); ctx.rect(0, top + k * hh, W, hh + 1); ctx.clip();
      drawWord(C.accent, off + s * 0.06);
      drawWord(C.white, off);
      ctx.restore();
    }
  } else drawWord(C.white);
  const locked = res.filter((r) => lu >= r).length;
  if ((!loop && locked < str.length) || Math.floor(lu * 2) % 2 === 0) {
    const cxr = locked === str.length || loop ? cx + w.width / 2 + s * 0.12 : cx + w.xs[locked] - s * 0.3;
    ctx.fillStyle = C.accent; ctx.fillRect(cxr, base - w.asc, s * 0.09, w.asc);
  }
}
function scanDots(ctx, y0, y1, a = 0.12) {
  ctx.save(); ctx.fillStyle = C.accent; ctx.globalAlpha = a;
  for (let y = y0 + 24; y < y1; y += 48) for (let x = 24; x < W; x += 48) ctx.fillRect(x - 2, y - 2, 4, 4);
  ctx.restore();
}

// ---------------------------------------------------------------- 03 PLAYFUL: drop, squash, hop
function play(ctx, lu, cx, cy, s, loop = false, color = C.ink, str = NAMES.play) {
  const w = word(ctx, str, s, 0.04);
  const base = cy + w.asc / 2;
  [...str].forEach((ch, i) => {
    const d = 0.5 * i;
    if (!loop && lu < d - 0.45) return;
    let y = base, sx = 1, sy = 1, rot = 0;
    if (!loop) {
      if (lu < d) { const p = E.inQuad(prog(lu, d - 0.45, d)); y = base - (1 - p) * H * 0.55; sy = 1 + 0.25 * p; sx = 1 - 0.12 * p; }
      else { const q = 0.32 * wobble((lu - d) * 0.5, 2.4, 6); sx = 1 + q; sy = 1 - q; }
    }
    const hopStart = loop ? -99 : 3;
    if (lu > hopStart) {
      const ph = (lu - (loop ? 0 : hopStart)) - i * 0.18;
      const ramp = loop ? 1 : E.outCubic(prog(lu, hopStart, hopStart + 0.6));
      const h = Math.abs(Math.sin(Math.PI * ph)) * ramp;
      y -= h * s * 0.26;
      const ground = (1 - h) ** 6 * ramp;
      sx *= 1 + 0.16 * ground; sy *= 1 - 0.16 * ground;
      rot = Math.sin(Math.PI * ph) * 0.12 * ramp * (i % 2 ? 1 : -1);
    }
    if (i === 1 && !loop) rot += TAU * E.inOutCubic(prog(lu, 3, 3.6));
    g(ctx, ch, cx + w.xs[i], y, w.f, { color, sx, sy, rot });
  });
}

// ---------------------------------------------------------------- 04 SPORT: italic, slams, echoes, speed lines
function sportWord(ctx, str, x, base, w, color, sk = 0.3) {
  [...str].forEach((ch, i) => g(ctx, ch, x + w.xs[i], base, w.f, { color, skew: sk }));
}
function sport(ctx, lu, cx, cy, s, loop = false, fg = C.white, str = NAMES.sport) {
  const w = word(ctx, str, s, -0.02);
  const base = cy + w.asc / 2;
  const slamX = (l) => (loop ? 0 : (1 - E.outExpo(prog(l, -0.28, 0.12))) * W * 1.4);
  const kicks = loop ? [0, 1, 2, 3] : SPORT_HITS;
  const kick = kicks.reduce((a, h) => a + (lu >= h ? Math.exp(-(lu - h) / 0.3) : 0), 0);
  [2, 1, 0].forEach((j) => {
    ctx.save(); ctx.globalAlpha *= ECHO_A[j];
    const off = (j + 1) * s * (0.2 + 0.22 * Math.min(kick, 1.5));
    sportWord(ctx, str, cx + slamX(lu - 0.06 * (j + 1)) + off, base, w, C.accent);
    ctx.restore();
  });
  sportWord(ctx, str, cx + slamX(lu), base, w, fg);
}
function speedLines(ctx, lu, y0, y1, n = 22, color = C.white, a = 0.5) {
  ctx.save(); ctx.fillStyle = color;
  for (let k = 0; k < n; k++) {
    const y = lerp(y0, y1, hash01(k, 21));
    const len = 120 + 520 * hash01(k, 22);
    const sp = 2400 + 2600 * hash01(k, 23);
    const x = W + 200 - (((lu * 0.5) * sp + hash01(k, 24) * (W + 900)) % (W + 900));
    ctx.globalAlpha = a * (0.3 + 0.7 * hash01(k, 25));
    ctx.fillRect(x, y, len, 3 + 3 * hash01(k, 26));
  }
  ctx.restore();
}

// ---------------------------------------------------------------- 05 WELLNESS: lowercase, grows from the ground, sways
function eco(ctx, lu, cx, cy, s, loop = false, color = C.white, str = NAMES.eco) {
  const w = word(ctx, str, s, 0.02);
  const base = cy + w.asc / 2;
  // a sun rising slowly behind the word
  const sp = loop ? 1 : E.outCubic(prog(lu, 0, 3.5));
  if (sp > 0) {
    ctx.save(); ctx.fillStyle = C.accent; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(cx + w.width * 0.28, base - w.asc * lerp(0.2, 1.25, sp), s * 0.2 * (0.6 + 0.4 * sp), 0, TAU); ctx.fill();
    ctx.restore();
  }
  [...str].forEach((ch, i) => {
    const t0 = loop ? -9 : -0.12 + 0.3 * i;
    if (lu < t0) return;
    const grow = loop ? 1 : springU(lu, t0, { stiffness: 60, damping: 9 });
    const sway = Math.sin(TAU * (lu * 0.32) + i * 0.8) * 0.07 * (loop ? 1 : E.outCubic(prog(lu, t0, t0 + 1.5)));
    const breathe = 1 + 0.03 * Math.sin(TAU * lu * 0.25 + i);
    g(ctx, ch, cx + w.xs[i], base, w.f, { color, sx: lerp(0.6, 1, Math.min(grow, 1.2)) * breathe, sy: grow * breathe, rot: sway });
  });
  // a stem line under the word, the ground
  const gp = loop ? 1 : E.inOutSine(prog(lu, 0, 1.6));
  ctx.fillStyle = color; ctx.globalAlpha = 0.5;
  ctx.fillRect(cx - (w.width / 2 + s * 0.1) * gp, base + s * 0.06, 2 * (w.width / 2 + s * 0.1) * gp, Math.max(2, s * 0.012));
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- 06 FINANCE: split-flap board, then a chart
const FLAPS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function fin(ctx, lu, cx, cy, s, loop = false, str = NAMES.fin) {
  const w = word(ctx, str, s, 0.28);
  const base = cy + w.asc / 2;
  const th = s * 1.02, tw = s * 0.68, ty = cy - th / 2;
  [...str].forEach((c0, i) => {
    const x = cx + w.xs[i];
    const set = loop ? (Math.floor(lu) % str.length === i && (lu % 1) < 0.3 ? lu - Math.floor(lu) + 0.3 : -1) : 0.5 + 0.22 * i;
    const appear = loop ? 1 : prog(lu, 0.04 * i - 0.25, 0.04 * i - 0.05);
    if (appear <= 0) return;
    ctx.save();
    ctx.translate(x, cy); ctx.scale(1, appear); ctx.translate(-x, -cy);
    M.rrect(ctx, x - tw / 2, ty, tw, th, s * 0.06); ctx.fillStyle = C.tile; ctx.fill();
    const flipping = loop ? set > 0 : lu < set;
    const steps = Math.floor(lu * 12);
    const ch = flipping ? FLAPS[Math.floor(hash01(steps * 5 + i, 31) * FLAPS.length)] : c0;
    const ph = flipping ? (lu * 12) % 1 : 1;
    g(ctx, ch, x, base, w.f);
    if (flipping) {   // the top flap falling over the split line
      ctx.save(); ctx.beginPath(); ctx.rect(x - tw / 2, ty, tw, th / 2); ctx.clip();
      ctx.translate(0, cy); ctx.scale(1, Math.max(0.02, 1 - ph)); ctx.translate(0, -cy);
      M.rrect(ctx, x - tw / 2, ty, tw, th, s * 0.06); ctx.fillStyle = C.tile; ctx.fill();
      g(ctx, FLAPS[Math.floor(hash01((steps - 1) * 5 + i, 31) * FLAPS.length)], x, base, w.f);
      ctx.restore();
    }
    ctx.fillStyle = C.ink; ctx.fillRect(x - tw / 2, cy - Math.max(1.5, s * 0.012), tw, Math.max(3, s * 0.024));
    ctx.restore();
  });
}
// a bull-market line that draws itself left to right inside its own box, below the label
const BULL = [0.02, 0.12, 0.06, 0.24, 0.16, 0.38, 0.3, 0.52, 0.44, 0.68, 0.6, 0.84, 1.0];
function bullLine(ctx, cp, x0, x1, yTop, yBot, lw) {
  if (cp <= 0) return;
  const n = 120, pts = [];
  for (let k = 0; k <= n; k++) {   // Catmull-Rom through BULL, sampled evenly
    const f = (k / n) * (BULL.length - 1), i = Math.min(Math.floor(f), BULL.length - 2), t = f - i;
    const p0 = BULL[Math.max(i - 1, 0)], p1 = BULL[i], p2 = BULL[i + 1], p3 = BULL[Math.min(i + 2, BULL.length - 1)];
    const v = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
    pts.push([lerp(x0, x1, k / n), lerp(yBot, yTop, v)]);
  }
  const m = Math.max(1, Math.round(cp * n));
  ctx.save();
  ctx.fillStyle = C.accent; ctx.globalAlpha = 0.14;   // area under the line
  ctx.beginPath(); ctx.moveTo(pts[0][0], yBot);
  for (let k = 0; k <= m; k++) ctx.lineTo(...pts[k]);
  ctx.lineTo(pts[m][0], yBot); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 0.35; ctx.fillStyle = C.white; ctx.fillRect(x0, yBot, x1 - x0, Math.max(1.5, lw * 0.35));
  ctx.globalAlpha = 1; ctx.strokeStyle = C.accent; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(...pts[0]);
  for (let k = 1; k <= m; k++) ctx.lineTo(...pts[k]);
  ctx.stroke();
  ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(pts[m][0], pts[m][1], lw * 1.6, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- full-frame sections
const MAXW = 0.84 * W;
const LBL = P({ '9x16': 50, '1x1': 40, '16x9': 40 });
let SZ = null;
function sizes(ctx) {
  if (SZ) return SZ;
  SZ = {
    lux: fit(ctx, NAMES.lux, 0.36, MAXW, 220), tech: fit(ctx, NAMES.tech, 0.08, MAXW, 280),
    play: fit(ctx, NAMES.play, 0.04, MAXW, 300), sport: fit(ctx, NAMES.sport, -0.02, MAXW * 0.95, 300),
    eco: fit(ctx, NAMES.eco, 0.02, MAXW * 0.9, 330), fin: fit(ctx, NAMES.fin, 0.28, MAXW, 200),
  };
  return SZ;
}
const labelY = (s) => CY + s * 0.62 + 90;

function sLux(ctx, lu, still = false) {
  fill(ctx, C.ink);
  const s = sizes(ctx).lux;
  ctx.save();
  camera(ctx, { z: still ? 1.03 : 1.06 ** E.inOutSine(prog(lu, 0, 6)) });
  lux(ctx, still ? 9 : lu, W / 2, CY, s);
  const str = '01  LUXURY';
  label(ctx, str, W / 2, labelY(s), LBL * 0.8, C.accent, 0.6, still ? 99 : typed(lu, 1.2, 2.6, str));
  ctx.restore();
}
function sTech(ctx, lu, still = false) {
  fill(ctx, C.ink);
  scanDots(ctx, 0, H, 0.1);
  const s = sizes(ctx).tech;
  const l = still ? 3.6 : lu;
  ctx.save();
  const jit = Math.floor(l * 8) % 7 === 0 ? (hash01(Math.floor(l * 8), 9) - 0.5) * 18 : 0;
  camera(ctx, { x: jit, z: punch(l, [0, 2.5, 4], 0.04, 0.12) });
  tech(ctx, l, W / 2, CY, s);
  const str = '02  TECH';
  label(ctx, str, W / 2, labelY(s), LBL, C.accent, 0.25, still ? 99 : typed(l, 0.3, 1.2, str));
  ctx.restore();
}
function sPlay(ctx, lu, still = false) {
  fill(ctx, C.accent);
  const s = sizes(ctx).play;
  const l = still ? 3.85 : lu;
  ctx.save();
  camera(ctx, { r: Math.sin(TAU * l / 4) * 0.02 });
  play(ctx, l, W / 2, CY, s);
  const f = font(LBL, 700, DISPLAY);
  const L = layout(ctx, '03  PLAYFUL', f, 0.2 * LBL);
  const x0 = W / 2 - L.width / 2;
  const show = still ? 1 : prog(l, 2.6, 3);
  if (show > 0) L.glyphs.forEach((q, i) => {
    const hop = Math.abs(Math.sin(Math.PI * (l * 2 - i * 0.15))) * LBL * 0.25;
    g(ctx, q.ch, x0 + q.cx, labelY(s) + 20 - hop * show + (1 - E.outBack(show)) * 60, f, { color: C.ink });
  });
  ctx.restore();
}
function sSport(ctx, lu, still = false) {
  fill(ctx, C.ink);
  const s = sizes(ctx).sport;
  const l = still ? 1.2 : lu;
  speedLines(ctx, l, SAFE.y, SAFE.y + SAFE.h, 26, C.white, 0.35);
  ctx.save();
  camera(ctx, { z: punch(l, SPORT_HITS, 0.05, 0.14), r: -0.04 });
  SPORT_HITS.forEach((b, i) => M.shake(ctx, l, b, i ? 10 : 22, 60 + i));
  const tk = still ? 0 : E.outCubic(prog(l, 4, 4.5));
  if (tk > 0) {
    const ts = s * 0.5, wt = word(ctx, NAMES.sport, ts, 0.1);
    for (const [dy, dir] of [[-s * 0.95, 1], [s * 1.0, -1]]) {
      const run = dir * ((l - 4) * 520 + (1 - tk) * W);
      for (let r = -3; r <= 3; r++) {
        const x = W / 2 + run + r * (wt.width + ts * 0.5);
        [...NAMES.sport].forEach((ch, i) => g(ctx, ch, x + wt.xs[i], CY + dy + wt.asc / 2, wt.f, { color: C.white, skew: 0.3, stroke: 3 }));
      }
    }
  }
  sport(ctx, l, W / 2 - s * 0.12, CY, s);
  const str = '04  SPORT';
  ctx.translate(-s * 0.12, 0);
  label(ctx, str, W / 2, labelY(s) - 20, LBL, C.accent, 0.15, still ? 99 : typed(l, 0.4, 0.9, str), 0.3);
  ctx.restore();
}
function sEco(ctx, lu, still = false) {
  fill(ctx, C.ink);
  const s = sizes(ctx).eco;
  const l = still ? 4 : lu;
  ctx.save();
  camera(ctx, { y: lerp(30, 0, E.outCubic(prog(l, 0, 6))), z: 1.05 ** E.inOutSine(prog(l, 0, 6)) });
  eco(ctx, l, W / 2, CY, s);
  const str = '05  WELLNESS';
  label(ctx, str, W / 2, labelY(s) - 10, LBL * 0.8, C.white, 0.5, still ? 99 : typed(l, 1.6, 3, str));
  ctx.restore();
}
function sFin(ctx, lu, still = false) {
  fill(ctx, C.ink);
  const s = sizes(ctx).fin;
  const l = still ? 4.5 : lu;
  ctx.save();
  camera(ctx, { z: 1.04 ** E.inOutCubic(prog(l, 0, 6)) });
  const yB = CY - s * 1.2, th = s * 1.02;
  fin(ctx, l, W / 2, yB, s, false, NAMES.fin, false);
  const str = '06  FINANCE', ly = yB + th / 2 + 80;
  label(ctx, str, W / 2, ly, LBL, C.accent, 0.3, still ? 99 : typed(l, 0.8, 1.6, str));
  const bw = word(ctx, NAMES.fin, s, 0.28).width + s * 0.68;
  const cp = still ? 1 : E.inOutCubic(prog(l, 2.2, 4.4));
  bullLine(ctx, cp, W / 2 - bw * 0.44, W / 2 + bw * 0.44, ly + 80, ly + 80 + s * 2.6, Math.max(6, s * 0.05));
  ctx.restore();
}

// ---------------------------------------------------------------- hook: the question
function sHook(ctx, u) {
  fill(ctx, C.ink);
  const s1 = fit(ctx, 'YOUR BRAND', 0.02, MAXW, 260);
  const sM = fit(ctx, 'MOVE?', 0.02, MAXW, 400);
  const ys0 = [-s1 * 1.95, -s1 * 0.85, s1 * 0.25];
  const mid = (ys0[0] - s1 * 0.75 + ys0[2] + sM * 1.1) / 2;
  const ys = ys0.map((y) => CY + y - mid);
  ctx.save();
  camera(ctx, { z: punch(u, [0, 0.5, 1, 1.5], 0.025, 0.12) * punch(u, [2], 0.06, 0.18) });
  M.shake(ctx, u, 2, 14, 7);
  const lines = [['HOW DOES', [0, 0.5]], ['YOUR BRAND', [1, 1.5]]];
  lines.forEach(([str, ts], li) => {
    const w = word(ctx, str, s1, 0.02);
    const sp = str.indexOf(' ');
    [...str].forEach((ch, i) => {
      if (ch === ' ') return;
      const t0 = ts[i < sp ? 0 : 1];
      if (u < t0 - 0.12) return;
      const p = E.outExpo(prog(u, t0 - 0.12, t0 + 0.2));
      const dir = (i < sp ? -1 : 1);
      g(ctx, ch, W / 2 + w.xs[i] + dir * (1 - p) * W * 0.7, ys[li] + w.asc / 2, w.f, { color: u >= 2 ? '#9A9AA0' : C.white });
    });
  });
  // MOVE? lands on 2, then flickers through the characters
  if (u >= 1.9) {
    const k = u < 2.5 ? -1 : u < 3 ? 0 : u < 3.25 ? 1 : u < 3.5 ? 2 : 3;
    const yM = ys[2] + sM * 0.55;
    const p = E.outExpo(prog(u, 1.9, 2.1));
    ctx.save(); ctx.translate(W / 2, yM); ctx.scale(lerp(1.6, 1, p), lerp(1.6, 1, p)); ctx.translate(-W / 2, -yM);
    if (k === -1 || k === 3) {
      const l = k === 3 ? u - 3.5 + 0.5 : 9;
      if (k === 3) sport(ctx, 9, W / 2, yM, sM * 0.95, true, C.white, 'MOVE?');
      else {
        const w = word(ctx, 'MOVE?', sM, 0.02);
        [2, 1, 0].forEach((j) => { ctx.save(); ctx.globalAlpha *= ECHO_A[j] * clamp((u - 2) * 4); [...'MOVE?'].forEach((ch, i) => g(ctx, ch, W / 2 + w.xs[i] - ECHO[j] * 0.8 * E.outCubic(prog(u, 2, 2.4)), yM + w.asc / 2, w.f, { color: C.accent })); ctx.restore(); });
        [...'MOVE?'].forEach((ch, i) => g(ctx, ch, W / 2 + w.xs[i], yM + w.asc / 2, w.f, { color: C.white }));
      }
      void l;
    } else if (k === 0) lux(ctx, 9, W / 2, yM, sM * 0.8, true, 'MOVE?');
    else if (k === 1) tech(ctx, u * 3, W / 2, yM, sM, true, 'MOVE?');
    else if (k === 2) play(ctx, u * 2, W / 2, yM, sM, true, C.accent, 'MOVE?');
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- recap: six bands, all at once
const BANDS = [   // same order as they appear in the film
  { bg: C.ink, draw: (ctx, l, cy, s) => lux(ctx, l, W / 2, cy, s * 0.8, true) },
  { bg: C.tile, dots: true, draw: (ctx, l, cy, s) => tech(ctx, l, W / 2, cy, s, true) },
  { bg: C.accent, draw: (ctx, l, cy, s) => play(ctx, l, W / 2, cy, s, true) },
  { bg: C.white, draw: (ctx, l, cy, s) => sport(ctx, l, W / 2 - s * 0.2, cy, s * 1.05, true, C.ink) },
  { bg: C.ink, draw: (ctx, l, cy, s) => eco(ctx, l, W / 2, cy, s * 1.1, true, C.white) },
  { bg: C.accent, draw: (ctx, l, cy, s) => fin(ctx, l, W / 2, cy, s * 0.62, true) },
];
function sRecap(ctx, u, bg = true) {
  const l = u - S.recap;
  if (bg) fill(ctx, C.ink);
  // six equal bands that fill the whole frame
  const n = BANDS.length, bh = H / n, s = P({ '9x16': 130, '1x1': 80, '16x9': 100 });
  BANDS.forEach((b, i) => {
    const y0 = i * bh, y1 = (i + 1) * bh;
    const dir = i % 2 ? 1 : -1;
    const inP = E.outExpo(prog(l, i / 3 - 0.2, i / 3 + 0.15));
    const outP = E.inCubic(prog(l, 3.55 + 0.05 * i, 3.98));
    const x = dir * ((1 - inP) * W - outP * W * 1.05);
    if (inP <= 0) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, y0, W, y1 - y0 + 1); ctx.clip();
    ctx.translate(x, 0);
    ctx.fillStyle = b.bg; ctx.fillRect(0, y0, W, y1 - y0 + 1);
    if (b.dots) scanDots(ctx, y0, y1, 0.1);
    b.draw(ctx, l + i * 0.37, (i + 0.5) * bh, s);
    ctx.restore();
  });
}

// ---------------------------------------------------------------- end card
// The original end card was the studio's own logo and has been removed from this recipe.
// Design the end card per film (lessons: the same entrance in every film read as "too strong").

// ---------------------------------------------------------------- film
let GRAIN = null;
M.film({
  fonts: [font(100, 700, DISPLAY)],
  hits: HITS,
  init() {
    GRAIN = document.createElement('canvas'); GRAIN.width = GRAIN.height = 256;
    const gc = GRAIN.getContext('2d'), d = gc.createImageData(256, 256), rnd = M.mulberry32(77);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.floor(rnd() * 255); d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    gc.putImageData(d, 0, 0);
  },
  draw(ctx, u) {
    if (u < S.lux) return sHook(ctx, u);
    if (u < S.tech) return sLux(ctx, u - S.lux);
    if (u < S.play) return sTech(ctx, u - S.tech);
    if (u < S.sport) return sPlay(ctx, u - S.play);
    if (u < S.eco) return sSport(ctx, u - S.sport);
    if (u < S.fin) return sEco(ctx, u - S.eco);
    if (u < S.recap) return sFin(ctx, u - S.fin);
    if (u < S.end) return sRecap(ctx, u);
    fill(ctx, C.ink);   // end card removed (see above)
  },
  post(ctx, u, t) {
    if (!GRAIN) return;
    const f = Math.floor(t * 60);
    ctx.save(); ctx.globalAlpha = 0.045; ctx.globalCompositeOperation = 'overlay';
    const ox = Math.floor(hash01(f, 3) * 256), oy = Math.floor(hash01(f, 8) * 256);
    ctx.translate(-ox, -oy);
    ctx.fillStyle = ctx.createPattern(GRAIN, 'repeat'); ctx.fillRect(0, 0, W + 256, H + 256);
    ctx.restore();
  },
});