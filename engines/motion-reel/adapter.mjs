// FCWM adapter for motion-reel: describes the steps of each render mode; scripts/fcwm.mjs runs them.
// A film is <root>/<slug>/ (index.html, film.js, film.json, beats.json). The engine scripts run with
// cwd = <root>; intermediate files go to <slug>/.fcwm/out/<slug>/ (MOTION_REEL_OUT), so everything a
// render writes stays inside the film folder. Delivery lands in <slug>/render/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clearSheets } from '../../scripts/lib/contact.mjs';

export const ENGINE_DIR = path.dirname(fileURLToPath(import.meta.url));
const script = (name) => path.join(ENGINE_DIR, 'scripts', name);

// A steady grid for films without a score, so beat-timed code and contact sheets still work.
export function gridJSON({ bpm = 120, duration = 15, offset = 0, beatsPerBar = 4 } = {}) {
  const period = 60 / bpm;
  const beats = [];
  for (let t = offset; t <= duration + 1e-9; t += period) beats.push(+t.toFixed(4));
  return { bpm, period: +period.toFixed(6), offset, beats, designed_bpm: bpm,
    downbeats: beats.filter((_, i) => i % beatsPerBar === 0), sections: [] };
}

export default {
  id: 'motion-reel',
  tier: 'free',

  requires(film) {
    const tools = ['ffmpeg', 'ffprobe'];
    if (film && fs.existsSync(path.join(film.dir, 'audio', 'score.py'))) tools.push('uv');
    return tools;
  },

  // Scaffold through the engine's own script, then give the film a default grid.
  scaffoldSteps(root, slug, { duration = 15, formats = ['9x16'], bpm = 120, threeD = false, title } = {}) {
    const args = [script('scaffold.mjs'), slug, '--duration', String(duration), '--formats', formats.join(',')];
    if (title) args.push('--title', title);
    if (threeD) args.push('--3d');
    return [
      { label: 'scaffold (motion-reel template)', cmd: process.execPath, args, cwd: root },
      { label: 'beat grid', fn: () => {
        const f = path.join(root, slug, 'beats.json');
        if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify(gridJSON({ bpm, duration }), null, 1));
        const cfgPath = path.join(root, slug, 'film.json');
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        fs.writeFileSync(cfgPath, JSON.stringify({ ...cfg, engine: 'motion-reel' }, null, 2) + '\n');
      } },
    ];
  },

  plan(film, mode, { at = '', formats } = {}) {
    const { root, slug, dir } = film;
    const fmts = formats || film.formats;
    const outRoot = path.join(dir, '.fcwm', 'out');
    const env = { MOTION_REEL_OUT: outRoot };
    const render = (...extra) => ({ cmd: process.execPath, args: [script('render.mjs'), '--film', slug, '--fps', String(film.fps), ...extra], cwd: root, env });
    const out = path.join(outRoot, slug);
    const steps = [];

    if (mode !== 'at' && fs.existsSync(path.join(dir, 'audio', 'score.py'))) {
      steps.push({ label: 'score: audio/score.py', cmd: 'uv', args: ['run', '--quiet', path.join(slug, 'audio', 'score.py')],
        cwd: root, env: { ...env, MOTION_REEL_SKILL: ENGINE_DIR } });
    }
    if (mode === 'check') {
      steps.push({ label: 'clear old contact sheets', fn: () => clearSheets(film.renderDir) });
      for (const f of fmts) steps.push({ label: `contact sheet ${f}`, ...render('--contact', '--format', f) });
      steps.push({ label: 'collect', fn: () => copyMatching(out, film.renderDir, /^(contact|phone).*\.png$/) });
      return steps;
    }
    if (mode === 'at') {
      steps.push({ label: 'clear old stills', fn: () => {
        for (const d of [path.join(out, 'stills'), path.join(film.renderDir, 'stills')]) fs.rmSync(d, { recursive: true, force: true });
      } });
      steps.push({ label: `stills at ${at}`, ...render('--at', at, '--format', fmts[0]) });
      steps.push({ label: 'collect', fn: () => copyMatching(path.join(out, 'stills'), path.join(film.renderDir, 'stills'), /\.png$/) });
      return steps;
    }
    if (mode !== 'full') throw new Error(`motion-reel: unknown mode ${mode}`);

    let mixed = false;
    steps.push({ label: 'clear old renders', fn: () => {
      // mix.mjs reads formats from film.json; write the default so both sides agree
      const cfgPath = path.join(dir, 'film.json');
      if (!film.config.formats?.length) fs.writeFileSync(cfgPath, JSON.stringify({ ...film.config, formats: film.formats }, null, 2) + '\n');
      if (fs.existsSync(out)) for (const n of fs.readdirSync(out)) if (/^(final|video)(_.+)?\.mp4$/.test(n)) fs.rmSync(path.join(out, n));
    } });
    for (const f of fmts) steps.push({ label: `picture ${f}`, ...render('--video-only', '--format', f) });
    steps.push({ label: 'sound effects from HITS', cmd: process.execPath, args: [script('sfx.mjs'), slug], cwd: root, env,
      when: () => /\bHITS\b/.test(fs.readFileSync(path.join(dir, 'film.js'), 'utf8')) });
    steps.push({ label: 'mix -14 LUFS / -1 dBTP and mux', cmd: process.execPath, args: [script('mix.mjs'), slug], cwd: root, env,
      when: () => (mixed = ['music.wav', 'sfx.wav', 'vo.wav'].some((w) => fs.existsSync(path.join(dir, 'audio', w)))) });
    steps.push({ label: 'deliver', fn: () => {
      fs.mkdirSync(film.renderDir, { recursive: true });
      const delivered = [];
      fmts.forEach((f) => {
        const muxed = path.join(out, f === film.formats[0] ? 'final.mp4' : `final_${f}.mp4`);
        if (mixed && !fs.existsSync(muxed)) throw new Error(`the mix ran but ${muxed} is missing: the sound would be dropped`);
        const src = [muxed, path.join(out, `video_${f}.mp4`)].find((p) => fs.existsSync(p));
        if (!src) throw new Error(`no rendered video for ${f} in ${out}`);
        const dst = path.join(film.renderDir, `${slug}-${f}.mp4`);
        fs.copyFileSync(src, dst);
        delivered.push(dst);
      });
      return delivered;
    } });
    return steps;
  },
};

function copyMatching(from, to, re) {
  if (!fs.existsSync(from)) throw new Error(`nothing rendered in ${from}`);
  fs.mkdirSync(to, { recursive: true });
  const files = fs.readdirSync(from).filter((n) => re.test(n));
  for (const n of files) fs.copyFileSync(path.join(from, n), path.join(to, n));
  return files.map((n) => path.join(to, n));
}
