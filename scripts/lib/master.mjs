// Master a film's sound and put it under the picture: audio/music.wav, audio/sfx.wav and audio/vo.wav
// (whichever exist) are summed, brought to -14 LUFS integrated with true peak under -1 dBTP (measured
// with FFmpeg's EBU R128 meter on the delivered file), encoded as AAC and muxed into the rendered MP4 in place of any sound
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

// integrated loudness and true peak of a file's audio (EBU R128, FFmpeg ebur128 filter)
export function measure(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const s = r.stderr.slice(r.stderr.lastIndexOf('Summary:'));
  return { I: Number(/I:\s+(-?[\d.]+) LUFS/.exec(s)?.[1]), TP: Number(/Peak:\s+(-?[\d.]+|-inf) dBFS/.exec(s)?.[1]) };
}

// One measured gain to the target, a 4x oversampled limiter (true peak, not sample peak), AAC, then
// the delivered file is measured: AAC adds inter-sample peaks, so the ceiling drops until it holds.
export function masterInto(video, stems, { lufs = -14, maxTp = -1, ceiling = -1.5 } = {}) {
  if (!stems.length) return false;
  const inputs = stems.flatMap((s) => ['-i', s]);
  const sum = stems.length > 1 ? `amix=inputs=${stems.length}:normalize=0:duration=longest,` : 'anull,';
  const pre = video.replace(/\.mp4$/, '.premaster.wav');
  ff([...inputs, '-filter_complex', `${stems.map((_, i) => `[${i}:a]`).join('')}${sum}aresample=48000[a]`, '-map', '[a]', '-c:a', 'pcm_f32le', pre]);
  const tmp = video.replace(/\.mp4$/, '.mux.mp4');
  let gain = lufs - measure(pre).I, m;
  try {
    for (let i = 0; i < 5; i++) {
      ff(['-i', video, '-i', pre, '-filter_complex', `[1:a]volume=${gain.toFixed(2)}dB,aresample=192000,alimiter=limit=${Math.pow(10, ceiling / 20).toFixed(4)}:attack=1:release=60:level=false:asc=1:latency=1,aresample=48000[a]`,
        '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', tmp]);
      m = measure(tmp);
      const loudOk = Math.abs(m.I - lufs) <= 0.3, peakOk = m.TP <= maxTp - 0.1;
      if (loudOk && peakOk) break;
      if (!peakOk) ceiling -= m.TP - (maxTp - 0.2);
      if (!loudOk) gain += lufs - m.I;
    }
    fs.renameSync(tmp, video);
  } finally {
    fs.rmSync(pre, { force: true });
    fs.rmSync(tmp, { force: true });
  }
  return m;
}
