// Composition checks on still frames (one per beat, the frames a contact sheet is built from). They catch the
// misses that separated weaker models from strong ones in the evals: an empty first frame, content crowded
// into the top of a 9:16 frame, scenes repeated as copies, and long holds. Image statistics only: no taste,
// no colour judgement, the same result on every OS (FFmpeg is the only tool).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { psnr } from './checks.mjs';

const SAMPLE_W = 120;           // frames are measured at this width (aspect kept)
const DIFF = 24;                // a pixel is content when a channel differs from the background by more
const LINE = 0.01;              // a row or column counts toward the content box when 1 % of it is content

export function frameStats(png) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', png], { encoding: 'utf8' });
  const [w0, h0] = (probe.stdout || '').trim().split(',').map(Number);
  if (!w0 || !h0) throw new Error(`cannot read ${png}`);
  const w = SAMPLE_W, h = Math.max(2, Math.round((h0 / w0) * w));
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', png, '-vf', `scale=${w}:${h}:flags=area,format=rgb24`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`ffmpeg could not read ${png}`);
  const px = r.stdout;
  // background: the most common colour, quantised to 16 levels per channel
  const counts = new Map();
  for (let i = 0; i < px.length; i += 3) {
    const k = ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let best = 0, key = 0;
  for (const [k, c] of counts) if (c > best) { best = c; key = k; }
  // average the exact colours in the winning bin
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let i = 0; i < px.length; i += 3) {
    if ((((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4)) !== key) continue;
    sr += px[i]; sg += px[i + 1]; sb += px[i + 2]; n++;
  }
  const bg = [sr / n, sg / n, sb / n];
  const rows = new Array(h).fill(0), cols = new Array(w).fill(0);
  let content = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3;
    if (Math.abs(px[i] - bg[0]) > DIFF || Math.abs(px[i + 1] - bg[1]) > DIFF || Math.abs(px[i + 2] - bg[2]) > DIFF) { content++; rows[y]++; cols[x]++; }
  }
  const span = (arr, len, other) => {
    const on = arr.map((v) => v >= Math.max(1, LINE * other));
    const a = on.indexOf(true), b = on.lastIndexOf(true);
    return a < 0 ? [0, 0] : [a / len, (b + 1) / len];
  };
  const [y0, y1] = span(rows, h, w), [x0, x1] = span(cols, w, h);
  return { bg: bg.map(Math.round), content: content / (w * h), box: { x0, y0, x1, y1 } };
}

// Frame 0 must already show something: the hook starts on the first frame.
export function firstFrame(stats0, { allowEmptyStart = false } = {}) {
  if (allowEmptyStart) return { pass: true, skipped: 'film.json allowEmptyStart' };
  return { pass: stats0.content >= 0.02, content: +stats0.content.toFixed(3) };
}

// 9:16: the content of a typical frame must span a good part of the height and not sit in the top.
export function fill(statsList, format) {
  if (format !== '9x16') return { pass: true, skipped: `only for 9x16 (this film is ${format})` };
  const withContent = statsList.filter((s) => s.content >= 0.02);
  if (!withContent.length) return { pass: false, height: 0, centre: 0, error: 'no frame has content' };
  const median = (xs) => { const v = [...xs].sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  const height = median(withContent.map((s) => s.box.y1 - s.box.y0));
  const centre = median(withContent.map((s) => (s.box.y0 + s.box.y1) / 2));
  return { pass: height >= 0.45 && centre >= 0.38, height: +height.toFixed(2), centre: +centre.toFixed(2) };
}

// Two frames 3 s or more apart that look the same: a scene copied instead of a new layout. The end card
// (last 1.5 s) is left out, since films often return to their opening lockup there on purpose.
export function repeats(frames, duration, { allowRepeats = false, compare = psnr, minGap = 3, endCard = 1.5 } = {}) {
  if (allowRepeats) return { pass: true, skipped: 'film.json allowRepeats' };
  const body = frames.filter((f) => f.t < duration - endCard && f.stats.content >= 0.02);
  const pairs = [];
  for (let i = 0; i < body.length; i++) for (let j = i + 1; j < body.length; j++) {
    if (body[j].t - body[i].t < minGap) continue;
    if (compare(body[i].file, body[j].file) >= 35) pairs.push([body[i].t, body[j].t]);
  }
  return { pass: pairs.length === 0, pairs };
}

// Three or more consecutive frames that do not change, before the end card: the film stands still.
export function holds(frames, duration, { compare = psnr, endCard = 1.5 } = {}) {
  const body = frames.filter((f) => f.t < duration - endCard);
  const spans = [];
  let run = [body[0]];
  for (let i = 1; i < body.length; i++) {
    if (compare(body[i - 1].file, body[i].file) >= 50) run.push(body[i]);
    else { if (run.length >= 3) spans.push([run[0].t, run[run.length - 1].t]); run = [body[i]]; }
  }
  if (run.length >= 3 && run[0]) spans.push([run[0].t, run[run.length - 1].t]);
  return { pass: spans.length === 0, spans };
}

// firstFrame, fill and repeats on a list of {t, file} frames sorted by time (holds is for stills only;
// a finished video gets motion() instead).
export function compositionChecks(frames, { duration, format, config = {} } = {}) {
  if (!frames.length) return { firstFrame: { pass: true, skipped: 'no frames' } };
  const withStats = frames.map((f) => ({ ...f, stats: frameStats(f.file) }));
  return {
    firstFrame: firstFrame(withStats[0].stats, { allowEmptyStart: !!config.allowEmptyStart }),
    fill: fill(withStats.map((f) => f.stats), format),
    repeats: repeats(withStats, duration, { allowRepeats: !!config.allowRepeats }),
    holds: holds(withStats, duration),
  };
}

// Every composition check on a finished video: one frame a second for firstFrame, fill and repeats,
// two a second for motion. Frames go to a temporary folder next to the video and are removed after.
export function videoComposition(video, { duration, format, config = {} } = {}) {
  if (config.composition === false) return { composition: { pass: true, skipped: 'film.json composition: false' } };
  const dir = `${video}.frames`;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  try {
    const r = spawnSync('ffmpeg', ['-v', 'error', '-i', video, '-vf', 'fps=1', path.join(dir, 'f%04d.png')]);
    if (r.status !== 0) throw new Error(`ffmpeg could not read ${video}`);
    const frames = fs.readdirSync(dir).sort().map((f, i) => ({ t: i, file: path.join(dir, f) }));
    const { holds: _, ...still } = compositionChecks(frames, { duration, format, config });
    return { ...still, motion: motion(video, { duration, allowStill: !!config.allowStill }) };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Motion on the finished video: frames 0.5 s apart; an interval is still when under 1 % of the pixels
// change. FAIL when the picture stands still for 1.5 s or more (three still intervals in a row), or for
// more than 40 % of the film, before the last 2.5 s (the end card may rest). Calm films on purpose:
// film.json allowStill. Catches slideshows of text that only fade between scenes.
export function motion(video, { duration, step = 0.5, endCard = 2.5, allowStill = false, still = 0.01 } = {}) {
  if (allowStill) return { pass: true, skipped: 'film.json allowStill' };
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', video], { encoding: 'utf8' });
  const info = JSON.parse(probe.stdout || '{}');
  const { width, height } = info.streams?.[0] || {};
  if (!width) throw new Error(`cannot read ${video}`);
  duration ??= Number(info.format?.duration);
  const w = 72, h = Math.max(2, Math.round((height / width) * w)), size = w * h * 3;
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', video, '-vf', `fps=1/${step},scale=${w}:${h}:flags=area,format=rgb24`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`ffmpeg could not read ${video}`);
  const n = Math.floor(r.stdout.length / size);
  const changes = [];
  for (let i = 1; i < n; i++) {
    const t = +(i * step).toFixed(2);
    if (t > duration - endCard) break;
    const a = r.stdout.subarray((i - 1) * size, i * size), b = r.stdout.subarray(i * size, (i + 1) * size);
    let c = 0;
    for (let k = 0; k < size; k += 3) if (Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]) + Math.abs(a[k + 2] - b[k + 2]) > 30) c++;
    changes.push({ t, change: c / (w * h) });
  }
  const spans = [];
  let run = [];
  const close = () => { if (run.length >= 3) spans.push([+(run[0].t - step).toFixed(2), run[run.length - 1].t]); run = []; };
  for (const x of changes) { if (x.change < still) run.push(x); else close(); }
  close();
  const share = changes.length ? changes.filter((x) => x.change < still).length / changes.length : 0;
  return { pass: !spans.length && share <= 0.4, stillShare: +share.toFixed(2), spans };
}
