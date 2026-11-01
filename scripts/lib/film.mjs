// Read a film directory: where it is, which engine renders it, which formats it ships in.
import fs from 'node:fs';
import path from 'node:path';

export const ENGINES = ['hyperframes', 'motion-reel'];
export const FORMATS = { '9x16': [1080, 1920], '16x9': [1920, 1080], '1x1': [1080, 1080] };

export function loadFilm(filmPath, cwd = process.cwd()) {
  const dir = path.resolve(cwd, filmPath);
  const cfgPath = path.join(dir, 'film.json');
  if (!fs.existsSync(cfgPath)) throw new Error(`${dir} is not a film: film.json missing (start one with: fcwm new <name>)`);
  const config = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const engine = config.engine || 'hyperframes';
  if (!ENGINES.includes(engine)) throw new Error(`film.json engine "${engine}" is not one of ${ENGINES.join(', ')}`);
  const formats = config.formats?.length ? config.formats : ['9x16'];
  for (const f of formats) if (!FORMATS[f]) throw new Error(`film.json format "${f}" is not one of ${Object.keys(FORMATS).join(', ')}`);
  return {
    dir, root: path.dirname(dir), slug: path.basename(dir), config, engine, formats,
    fps: Number(config.fps) || (engine === 'motion-reel' ? 60 : 30),
    duration: Number(config.duration) || 15,
    renderDir: path.join(dir, 'render'),
  };
}

export async function loadAdapter(engine) {
  const url = new URL(`../../engines/${engine}/adapter.mjs`, import.meta.url);
  return (await import(url.href)).default;
}
