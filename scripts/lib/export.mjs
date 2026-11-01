// Extra delivery formats. Opaque formats are transcoded from the delivered MP4; formats with an alpha
// channel must come from the engine itself (a transcode cannot invent transparency), so the adapter
// provides them through alphaSteps(film, kind) or the CLI says which engines can.
import path from 'node:path';

const FF = ['-hide_banner', '-loglevel', 'error', '-y'];

export const EXPORTS = {
  gif: { ext: '.gif', alpha: false, about: 'GIF, 15 fps, 540 px wide, optimized palette (no sound)' },
  webm: { ext: '.webm', alpha: false, about: 'WebM VP9 + Opus' },
  mov: { ext: '-prores.mov', alpha: false, about: 'ProRes 422 HQ + PCM audio, for editing' },
  'mov-alpha': { ext: '-alpha.mov', alpha: true, about: 'ProRes 4444 with alpha, for compositing' },
  'webm-alpha': { ext: '-alpha.webm', alpha: true, about: 'WebM VP9 with alpha, for the web' },
};

export function parseExports(value) {
  if (!value || value === true) return [];
  const list = (Array.isArray(value) ? value : String(value).split(',')).map((s) => String(s).trim()).filter(Boolean);
  const bad = list.filter((k) => !EXPORTS[k]);
  if (bad.length) throw new Error(`unknown export ${bad.join(', ')}; choose from ${Object.keys(EXPORTS).join(', ')}`);
  return [...new Set(list)];
}

export const exportPath = (film, format, kind) => path.join(film.renderDir, `${film.slug}-${format}${EXPORTS[kind].ext}`);

// Steps that transcode the delivered MP4 into one opaque export.
export function transcodeStep(film, format, kind) {
  const src = path.join(film.renderDir, `${film.slug}-${format}.mp4`);
  const dst = exportPath(film, format, kind);
  const args = {
    gif: [...FF, '-i', src, '-filter_complex', 'fps=15,scale=540:-2:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a', '-loop', '0', dst],
    webm: [...FF, '-i', src, '-c:v', 'libvpx-vp9', '-crf', '32', '-b:v', '0', '-row-mt', '1', '-c:a', 'libopus', '-b:a', '128k', dst],
    mov: [...FF, '-i', src, '-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le', '-c:a', 'pcm_s16le', dst],
  }[kind];
  return { label: `export ${EXPORTS[kind].about}`, cmd: 'ffmpeg', args };
}

export function exportSteps(film, adapter, formats, kinds) {
  const steps = [];
  for (const kind of kinds) {
    for (const f of formats) {
      if (!EXPORTS[kind].alpha) { steps.push(transcodeStep(film, f, kind)); continue; }
      if (!adapter.alphaSteps) throw new Error(`${kind}: the ${film.engine} engine cannot render transparency; use HyperFrames for 2-D overlays with alpha`);
      steps.push(...adapter.alphaSteps(film, kind, f, exportPath(film, f, kind)));
    }
  }
  return steps;
}
