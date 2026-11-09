// Gathers the web app into native/www for Capacitor to copy into the shells.
// The file list is the service worker's SHELL, so the native app ships exactly
// what the web app caches offline. No dependencies.
import { mkdirSync, copyFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const out = join(here, '..', 'www');

const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const shell = JSON.parse(sw.match(/const SHELL = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
const files = [...new Set([...shell.filter(p => p !== './'), './sw.js'])];

rmSync(out, { recursive: true, force: true });
for (const rel of files) {
  const from = join(root, rel), to = join(out, rel);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}

// The reminder tones (scripts/make-sounds.mjs). iOS reads them from the app
// bundle, where AppDelegate copies them into Library/Sounds on launch.
const sounds = join(here, '..', 'assets', 'sounds');
mkdirSync(join(out, 'sounds'), { recursive: true });
for (const name of readdirSync(sounds)) copyFileSync(join(sounds, name), join(out, 'sounds', name));
console.log(`collected ${files.length} files and the sounds into native/www`);
