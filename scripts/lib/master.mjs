// Master a film's sound and put it under the picture: audio/music.wav, audio/sfx.wav and audio/vo.wav
// (whichever exist) are summed, brought to -14 LUFS integrated with true peak under -1 dBTP (FFmpeg
// loudnorm, two passes, linear), encoded as AAC and muxed into the rendered MP4 in place of any sound
// it had. Used by engines without their own mixer (HyperFrames). FFmpeg only.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const STEMS = ['music.wav', 'sfx.wav', 'vo.wav'];
export const stemsIn = (filmDir) => STEMS.map((n) => path.join(filmDir, 'audio', n)).filter((f) => fs.existsSync(f));

function ff(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr.split('\n').slice(-6).join('\n')}`);
  return r.stderr;
}

export function masterInto(video, stems, { lufs = -14, tp = -1.5 } = {}) {
  if (!stems.length) return false;
  const inputs = stems.flatMap((s) => ['-i', s]);
  const sum = stems.length > 1 ? `amix=inputs=${stems.length}:normalize=0:duration=longest,` : '';
  const target = `I=${lufs}:TP=${tp}:LRA=11`;
  const log = ff([...inputs, '-filter_complex', `${sum}loudnorm=${target}:print_format=json`, '-f', 'null', '-']);
  const m = JSON.parse(log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1));
  const measured = `measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  const tmp = video.replace(/\.mp4$/, '.mux.mp4');
  ff(['-i', video, ...inputs, '-filter_complex', `${stems.map((_, i) => `[${i + 1}:a]`).join('')}${stems.length > 1 ? sum : 'anull,'}loudnorm=${target}:${measured},aresample=48000[a]`,
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', tmp]);
  fs.renameSync(tmp, video);
  return true;
}
