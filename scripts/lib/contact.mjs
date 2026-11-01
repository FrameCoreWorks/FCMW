// Tile still frames into contact sheets: contact_pN.png (6 columns, up to 36 per page) and a half-size
// phone_pN.png of each page, the same layout motion-reel's renderer writes.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function sheetTimes(film, { every = 1 } = {}) {
  const beatsFile = path.join(film.dir, 'beats.json');
  const beats = fs.existsSync(beatsFile)
    ? JSON.parse(fs.readFileSync(beatsFile, 'utf8')).beats
    : Array.from({ length: Math.floor(film.duration / 0.5) + 1 }, (_, i) => i * 0.5);
  return beats.filter((t, i) => t < film.duration && i % every === 0).map((t) => +t.toFixed(3));
}

export function tileSheets(files, outDir, { prefix = '', cols = 6, perPage = 36, thumbWidth = 360 } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const pages = [];
  for (let p = 0; p * perPage < files.length; p++) {
    const chunk = files.slice(p * perPage, (p + 1) * perPage);
    const rows = Math.ceil(chunk.length / cols);
    const list = path.join(outDir, `.sheet_${p}.txt`);
    fs.writeFileSync(list, chunk.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
    const page = path.join(outDir, `contact${prefix}_p${p + 1}.png`);
    const phone = path.join(outDir, `phone${prefix}_p${p + 1}.png`);
    const ff = (args) => {
      const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
      if (r.status !== 0) throw new Error(`ffmpeg failed while tiling: ${r.stderr}`);
    };
    ff(['-f', 'concat', '-safe', '0', '-i', list, '-vf', `scale=${thumbWidth}:-2,tile=${cols}x${rows}:padding=8:margin=8`, '-frames:v', '1', page]);
    ff(['-i', page, '-vf', 'scale=iw/2:-2:flags=area', phone]);
    fs.rmSync(list);
    pages.push(page);
  }
  return pages;
}

// Time (seconds) encoded in a still's file name: "frame-02-at-3.75s.png" (HyperFrames), "t3.750_9x16.png"
// (motion-reel), "at-1.5s.png". NaN when the name carries no time.
export function stillTime(name) {
  const m = /(?:at-|^t)(\d+(?:\.\d+)?)/.exec(name);
  return m ? Number(m[1]) : NaN;
}
export const byStillTime = (a, b) => stillTime(a) - stillTime(b);

export function clearSheets(dir) {
  if (!fs.existsSync(dir)) return;
  for (const n of fs.readdirSync(dir)) if (/^(contact|phone).*\.png$/.test(n)) fs.rmSync(path.join(dir, n));
}
