// The app icon sources for @capacitor/assets: a 1024px icon, the adaptive
// icon's foreground and background for Android, and a splash screen. Drawn
// from one SVG so every size matches. The mark is the Sun face's: a low ochre
// sun on a horizon line, on paper. Nothing about it reads as a timer, which
// Work mode needs on a home screen and a lock screen. Uses sharp, which
// @capacitor/assets already installs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'assets');
mkdirSync(out, { recursive: true });

const PAPER = '#EFEAE0', PAPER_DARK = '#1E1C19', INK = '#2B2A26', OCHRE = '#B8875A', REFLECT = '#E0CDB7';

// The mark in a 1000-unit box, centred on (500, 500), `scale` of the box wide.
function mark(scale, paper = PAPER, ink = INK, reflect = REFLECT) {
  const r = 240 * scale, horizon = 500 + 60 * scale, cx = 500;
  const lineW = 900 * scale, lineH = 16 * scale;
  return `
    <clipPath id="sky"><rect x="0" y="0" width="1000" height="${horizon}"/></clipPath>
    <clipPath id="ground"><rect x="0" y="${horizon}" width="1000" height="${1000 - horizon}"/></clipPath>
    <circle cx="${cx}" cy="${horizon}" r="${r}" fill="${reflect}" clip-path="url(#ground)"/>
    <circle cx="${cx}" cy="${horizon}" r="${r}" fill="${OCHRE}" clip-path="url(#sky)"/>
    <rect x="${cx - lineW / 2}" y="${horizon - lineH / 2}" width="${lineW}" height="${lineH}" fill="${ink}"/>`;
}

const svg = (body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  ${bg ? `<rect width="1000" height="1000" fill="${bg}"/>` : ''}${body}
</svg>`;

async function png(name, markup, size) {
  const file = join(out, name);
  writeFileSync(file, await sharp(Buffer.from(markup)).resize(size, size).png().toBuffer());
  console.log(name);
}

// iOS and the plain Android icon: full-bleed paper, the mark at 70% of the width.
await png('icon-only.png', svg(mark(0.7), PAPER), 1024);
// Android adaptive icon: the system masks the outer third, so the mark sits
// smaller in the foreground, over a plain paper background.
await png('icon-foreground.png', svg(mark(0.46)), 1024);
await png('icon-background.png', svg('', PAPER), 1024);
// Splash: paper with a small mark, light and dark.
await png('splash.png', svg(mark(0.18), PAPER), 2732);
await png('splash-dark.png', svg(mark(0.18, PAPER_DARK, '#E6DFD2', '#5A4634'), PAPER_DARK), 2732);
