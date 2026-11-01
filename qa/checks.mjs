// Automated quality checks on a rendered film. Each check returns {pass, ...details} and never throws on
// a bad film (only on a missing tool), so one report lists every problem at once.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

export const LIMITS = { lufs: -14, lufsTolerance: 1, truePeak: -1.0, fpsTolerance: 0.01, flatRange: 3 };

function tool(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.error) throw new Error(`${cmd} not found: install ffmpeg (it ships ffprobe) and retry`);
  return r;
}

// An alpha export must really carry alpha: a yuva/rgba pixel format (ProRes 4444) or VP9's alpha_mode tag.
export function alphaChannel(file) {
  const r = tool('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=pix_fmt:stream_tags=alpha_mode', '-of', 'json', file]);
  const s = JSON.parse(r.stdout || '{}').streams?.[0] || {};
  const pass = /^(yuva|rgba|argb|bgra|abgr|gbrap|ya)/.test(s.pix_fmt || '') || s.tags?.alpha_mode === '1' || s.tags?.ALPHA_MODE === '1';
  return { pass, pixFmt: s.pix_fmt, alphaMode: s.tags?.alpha_mode ?? s.tags?.ALPHA_MODE };
}

export function probe(file) {
  const r = tool('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate,avg_frame_rate,pix_fmt:format=duration', '-of', 'json', file]);
  if (r.status !== 0) throw new Error(`ffprobe could not read ${file}: ${r.stderr.trim()}`);
  const j = JSON.parse(r.stdout);
  const v = j.streams.find((s) => s.codec_type === 'video');
  const rate = (s) => { const [n, d] = String(s || '0/1').split('/').map(Number); return d ? n / d : 0; };
  return { duration: Number(j.format?.duration) || 0, hasAudio: j.streams.some((s) => s.codec_type === 'audio'),
    width: v?.width, height: v?.height, fps: rate(v?.r_frame_rate), avgFps: rate(v?.avg_frame_rate), pixFmt: v?.pix_fmt };
}

// Integrated loudness and true peak (EBU R128). A film without an audio stream is skipped, not failed.
export function loudness(file, info = probe(file)) {
  if (!info.hasAudio) return { pass: true, skipped: 'no audio stream' };
  const r = tool('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-map', '0:a:0', '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const summary = r.stderr.slice(r.stderr.lastIndexOf('Summary:'));
  const lufs = Number(/I:\s+(-?[\d.]+|-inf) LUFS/.exec(summary)?.[1]);
  const truePeak = Number(/Peak:\s+(-?[\d.]+|-inf) dBFS/.exec(summary)?.[1]);
  const pass = Math.abs(lufs - LIMITS.lufs) <= LIMITS.lufsTolerance && truePeak <= LIMITS.truePeak;
  return { pass, lufs, truePeak, target: `${LIMITS.lufs} ±${LIMITS.lufsTolerance} LUFS, <= ${LIMITS.truePeak} dBTP` };
}

// Constant frame rate: every presentation timestamp step equals 1/fps.
export function frameRate(file, fps, info = probe(file)) {
  const want = fps || info.fps;
  const r = tool('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time', '-of', 'csv=p=0', file]);
  const pts = r.stdout.split('\n').filter((l) => l.trim() !== '').map(Number).filter((x) => Number.isFinite(x) && x >= 0).sort((a, b) => a - b);
  let worst = 0;
  for (let i = 1; i < pts.length; i++) worst = Math.max(worst, Math.abs(pts[i] - pts[i - 1] - 1 / want));
  const rateOk = Math.abs(info.fps - want) < 0.01 && Math.abs(info.avgFps - want) / want < 0.005;
  const pass = rateOk && worst <= LIMITS.fpsTolerance / want + 1e-4;
  return { pass, fps: want, streamFps: +info.fps.toFixed(3), avgFps: +info.avgFps.toFixed(3), worstStepError: +worst.toFixed(5), frames: pts.length };
}

// Flat frames (luma max - min <= flatRange): nothing drawn. Spans listed in film.json allowBlank are fine.
export function blankFrames(file, allow = []) {
  const r = tool('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-map', '0:v:0', '-vf',
    'signalstats,metadata=print:key=lavfi.signalstats.YMAX,metadata=print:key=lavfi.signalstats.YMIN', '-f', 'null', '-']);
  const frames = [];
  let cur = null;
  for (const line of r.stderr.split('\n')) {
    const f = /pts_time:([\d.]+)/.exec(line);
    if (f) { const t = Number(f[1]); if (!cur || cur.t !== t) { cur = { t }; frames.push(cur); } continue; }
    const m = /signalstats\.(YMAX|YMIN)=([\d.]+)/.exec(line);
    if (m && cur) cur[m[1]] = Number(m[2]);
  }
  const allowed = (t) => allow.some(([a, b]) => t >= a - 1e-3 && t <= b + 1e-3);
  const spans = [];
  for (const fr of frames) {
    if (!(fr.YMAX - fr.YMIN <= LIMITS.flatRange) || allowed(fr.t)) continue;
    const last = spans[spans.length - 1];
    if (last && fr.t - last.to < 0.1) last.to = fr.t; else spans.push({ from: fr.t, to: fr.t });
  }
  return { pass: spans.length === 0, spans: spans.map((s) => ({ from: +s.from.toFixed(3), to: +s.to.toFixed(3) })), frames: frames.length };
}

// Text boxes (px) must sit inside the platform safe zone for the format.
export const SAFE = { '9x16': { x: [0.06, 0.94], y: [0.10, 0.80] }, '16x9': { x: [0.05, 0.95], y: [0.05, 0.95] }, '1x1': { x: [0.05, 0.95], y: [0.05, 0.95] } };
export function safeZone(boxes, format, [W, H]) {
  if (!boxes) return { pass: true, skipped: 'film does not export window.FILM_TEXT_BOXES' };
  const z = SAFE[format];
  const offenders = boxes.filter((b) => b.x < z.x[0] * W || b.y < z.y[0] * H || b.x + b.w > z.x[1] * W || b.y + b.h > z.y[1] * H);
  return { pass: offenders.length === 0, offenders, zone: z };
}

// The same frames rendered twice must be byte-identical. renderStills(tag) returns [{t, file}].
export async function determinism(renderStills) {
  const a = await renderStills('a');
  const b = await renderStills('b');
  if (a.length === 0 || a.length !== b.length) return { pass: false, checked: a.map((x) => x.t), diffs: [], error: `the two passes wrote ${a.length} and ${b.length} stills` };
  const diffs = a.filter((x, i) => !fs.readFileSync(x.file).equals(fs.readFileSync(b[i].file))).map((x) => x.t);
  return { pass: diffs.length === 0, checked: a.map((x) => x.t), diffs };
}

export function checkVideo(file, { fps, allowBlank = [] } = {}) {
  const info = probe(file);
  return { file, info, loudness: loudness(file, info), frameRate: frameRate(file, fps, info), blankFrames: blankFrames(file, allowBlank) };
}

export function summarize(report) {
  const rows = [];
  for (const [name, r] of Object.entries(report)) {
    if (!r || typeof r !== 'object' || !('pass' in r)) continue;
    rows.push(`${r.skipped ? 'SKIP' : r.pass ? 'PASS' : 'FAIL'}  ${name}${r.skipped ? ` (${r.skipped})` : ''}`);
  }
  return rows.join('\n');
}
