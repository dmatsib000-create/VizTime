// The reminder tones as WAV files, for notifications while the app is in the
// background. They are the same bells as js/sound.js plays in the page: a sine
// with a quiet octave partial, rising over 0.6 s and fading over 3.2 s.
// Written to assets/sounds (shipped to iOS through www) and to the Android
// project's res/raw. No dependencies.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const RATE = 22050;
const ATTACK = 0.6, DECAY = 3.2, PEAK = 0.5;
const PARTIALS = [[1, 1], [2, 0.18], [3, 0.04]];
const PHRASES = {
  cue_half: [[659.25, 0]],                 // E5, once
  cue_warn: [[523.25, 0]],                 // C5, once
  cue_finish: [[392.0, 0], [587.33, 1.1]], // G4 then D5, unhurried
};

function render(phrase) {
  const seconds = Math.max(...phrase.map(([, at]) => at)) + ATTACK + DECAY + 0.2;
  const n = Math.round(seconds * RATE);
  const out = new Float64Array(n);
  for (const [freq, at] of phrase) {
    const start = Math.round(at * RATE);
    for (let i = start; i < n; i++) {
      const t = (i - start) / RATE;
      // Linear rise, then the exponential fall Web Audio's ramp gives (to 1/2200 of the peak).
      const env = t < ATTACK ? t / ATTACK : Math.pow(0.0001 / 0.22, (t - ATTACK) / DECAY);
      let v = 0;
      for (const [mult, level] of PARTIALS) v += level * Math.sin(2 * Math.PI * freq * mult * t);
      out[i] += env * v;
    }
  }
  let max = 0;
  for (const v of out) max = Math.max(max, Math.abs(v));
  const gain = PEAK / (max || 1);
  const pcm = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) pcm.writeInt16LE(Math.round(out[i] * gain * 32767), i * 2);
  return pcm;
}

function wav(pcm) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);        // PCM chunk size
  header.writeUInt16LE(1, 20);         // linear PCM
  header.writeUInt16LE(1, 22);         // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);  // bytes per second
  header.writeUInt16LE(2, 32);         // block align
  header.writeUInt16LE(16, 34);        // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

const targets = [join(here, '..', 'assets', 'sounds'), join(here, '..', 'android', 'app', 'src', 'main', 'res', 'raw')];
for (const dir of targets) mkdirSync(dir, { recursive: true });
for (const [name, phrase] of Object.entries(PHRASES)) {
  const file = wav(render(phrase));
  for (const dir of targets) writeFileSync(join(dir, `${name}.wav`), file);
  console.log(`${name}.wav  ${(file.length / 1024).toFixed(0)} KB, ${(file.length / 2 / RATE).toFixed(1)} s`);
}
