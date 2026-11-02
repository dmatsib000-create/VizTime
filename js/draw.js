// The clock tick that keeps text and cues current, and the frame loop that
// draws the picture, the warm light and the zoom.

import * as E from './engine.js';
import { palette, drawFace, paintWarmth, redrawGap, SERIF } from './faces.js';
import { mode, session, settings, persist } from './state.js';
import { $, body, dateFmt, fmtClock, fmtShort } from './ui.js';
import { pageTitle } from './words.js';
import { labelChips } from './setup.js';
import { playCue, onFinished, syncWake } from './session.js';
import { renderRun, labelMain } from './screens.js';
import { floatDoc, renderFloatText } from './pip.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const LIGHT_GAIN = { subtle: 0.6, normal: 1, strong: 1.6 };

/* ---------- Clock tick ---------- */

// A long gap between ticks means the page was frozen (an iPhone app in the
// background or a locked phone), which counts as closed: whatever came due
// meanwhile is settled silently. A desktop tab in the background still ticks
// about once a minute, so its cues play, at most a minute late.
const FROZEN_GAP = 65_000;
// Animation frames can stay stopped after an iPhone browser app returns from
// the background, until the screen is touched. Past this gap the tick paints.
const PAINT_STALL = 1500;
export let lastTick = Date.now();
let lastPaint = Date.now();

export function tick() {
  const now = Date.now();
  const frozen = now - lastTick > FROZEN_GAP;
  lastTick = now;
  if (!document.hidden && now - lastPaint > PAINT_STALL) drawMain();
  $('bar-date').textContent = dateFmt.format(now);
  $('w-time').textContent = $('s-clock').textContent = fmtClock(now);
  if (body.dataset.screen !== 'run') { labelChips(now); if (mode === 'work') labelMain(now); }
  if (body.dataset.screen === 'landing') renderFloatText(now);
  if (session) {
    const wasFinished = !!session.finishedAt;
    const firedBefore = JSON.stringify(session.fired);
    let cues = [];
    if (frozen) E.settle(session, now); else cues = E.dueCues(session, now);
    if (JSON.stringify(session.fired) !== firedBefore) persist();
    cues.forEach(playCue);
    if (!wasFinished && session.finishedAt) onFinished(cues.includes('finish'));
    else if (!session.finishedAt) renderRun(now);
  }
  updateTitle(now);
}

function updateTitle(now) {
  const t = pageTitle(mode, session, now);
  if (document.title !== t) document.title = t;
}

/* ---------- Drawing: faces, light, zoom ---------- */

let pal = palette();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { pal = palette(); });

let warmth = 0, zoom = 0, lastFrame = 0, lastStep = performance.now();

function targets(now) {
  if (!session) return { w: 0, z: 0 };
  if (session.finishedAt) return { w: 1, z: 1 };
  const st = E.stage(session, now);
  if (st === 'running') return { w: 0, z: 0 };
  const p = E.warnProgress(session, now);
  return { w: 0.7 * p * p, z: 1 };
}

export function faceModel(now) {
  const s = session;
  const end = s.pausedAt ? s.endAt + (now - s.pausedAt) : s.endAt;
  return {
    frac: E.fraction(s, now), warnFrac: Math.min(1, s.warnMs / s.totalMs),
    stage: E.stage(s, now), warnP: E.warnProgress(s, now), paused: !!s.pausedAt,
    now, endAt: end, totalMs: s.totalMs, warnMs: s.warnMs, remainingMs: E.remaining(s, now),
    title: s.title || (mode === 'work' ? 'Current' : `${Math.round(s.totalMs / E.MIN)} minutes`), next: s.next,
    // The clock hands are Work mode's disguise; in Full they step back behind the time left.
    hands: mode === 'work' ? 'ink' : 'soft', zoom, fmtClock: fmtShort,
  };
}

// Work and Full each remember their own picture; Simple always has the disc.
// Only the pictures a mode offers are drawn, whatever was saved: Work mode
// must never show the disc or the ruler, which read as a timer, and the
// stylesheet hiding their dots shouldn't be the only thing that ensures it.
const FACE_SETTING = { work: 'face', full: 'fullFace' };
const FACES = { work: ['planner', 'level', 'sun'], full: ['disc', 'level', 'sun', 'planner', 'ruler'], simple: ['disc'] };
export const faceSetting = () => FACE_SETTING[mode];
export const faceName = () => {
  const offered = FACES[mode] || FACES.simple;
  const saved = settings[faceSetting()];
  return offered.includes(saved) ? saved : offered[0];
};

export function paint(canvas, name, m) {
  const r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const dpr = Math.min(3, canvas.ownerDocument.defaultView.devicePixelRatio || 1);
  const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, r.width, r.height);
  drawFace(ctx, r.width, r.height, name, m, pal);
}

// Moves the warm light and the planner zoom toward their targets. Both the main
// page and the floating window call it, so it measures real elapsed time.
export function step() {
  const t = performance.now();
  const dt = Math.min(1, Math.max(0, (t - lastStep) / 1000));
  lastStep = t;
  const now = Date.now();
  const tg = targets(now);
  if (reducedMotion.matches) {
    warmth = Math.round(tg.w * 3) / 3;
    zoom = tg.z;
  } else {
    warmth += (tg.w - warmth) * Math.min(1, dt / 1.5);
    zoom += (tg.z - zoom) * Math.min(1, dt / 1.2);
  }
  const gain = LIGHT_GAIN[settings.warmth] || 1;
  document.documentElement.style.setProperty('--warmth', warmth.toFixed(4));
  document.documentElement.style.setProperty('--light-gain', gain);
  if (floatDoc) {
    floatDoc.documentElement.style.setProperty('--warmth', warmth.toFixed(4));
    floatDoc.documentElement.style.setProperty('--light-gain', gain);
  }
}

// How long until the picture needs drawing again (redrawGap in faces.js): about
// once a second through most of a long session, smoothly near the end and
// while the light or the planner's zoom settles.
export function frameGap(now) {
  const tg = targets(now);
  const settling = Math.abs(tg.w - warmth) > 0.002 || Math.abs(tg.z - zoom) > 0.002;
  if (!session || session.finishedAt) return settling ? 80 : 1000;
  return redrawGap({ totalMs: session.totalMs, stage: E.stage(session, now), paused: !!session.pausedAt }, settling);
}

// A change on screen (a new picture, a pause, +5) is drawn at once, here and
// in the floating window, rather than at the next gap.
export let paintRequests = 0;
export function requestPaint() { frame.force = true; paintRequests++; }

let frameId = 0;
export function frame(t) {
  frameId = requestAnimationFrame(frame);
  if (!frame.force && t - lastFrame < frameGap(Date.now())) return;
  lastFrame = t;
  frame.force = false;
  drawMain();
  // Timers can stall while frames run; keep the text and cues current.
  if (Date.now() - lastTick >= 1000) tick();
}
frameId = requestAnimationFrame(frame);

function drawMain() {
  lastPaint = Date.now();
  step();
  if (!session || session.finishedAt || document.hidden || body.dataset.screen !== 'run') return;
  paint($('face'), faceName(), faceModel(Date.now()));
}

// Coming back to the page: bring everything up to date at once, and restart
// the frame loop in case the browser left it stopped.
function wake() {
  if (document.hidden) return;
  tick();
  drawMain();
  cancelAnimationFrame(frameId);
  frameId = requestAnimationFrame(frame);
}

// The picture-in-picture video keeps drawing on a timer, since animation
// frames stop when the page is in the background.
export function paintVideo() {
  const c = $('video-canvas');
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = pal.paper;
  ctx.fillRect(0, 0, W, H);
  if (session && !session.finishedAt) {
    const m = faceModel(Date.now());
    ctx.save();
    ctx.translate(20, 14);
    drawFace(ctx, W - 40, H - 74, faceName(), m, pal);
    ctx.restore();
    ctx.fillStyle = pal.ink;
    ctx.font = `italic 400 24px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const line = session.next ? `then ${session.next}` : (session.title || '');
    ctx.fillText(line, W / 2, H - 22, W - 40);
  } else {
    ctx.fillStyle = pal.ink;
    ctx.font = `400 30px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.fillText(mode === 'work' ? 'Session finished.' : (session?.next || 'Finished'), W / 2, H / 2);
  }
  paintWarmth(ctx, W, H, warmth * (LIGHT_GAIN[settings.warmth] || 1), pal);
}

document.addEventListener('visibilitychange', () => {
  syncWake();
  frame.force = true;
  if (document.hidden) tick(); else wake();
});
addEventListener('pageshow', wake);
addEventListener('focus', wake);
// A resized canvas is blank or stretched until drawn, so don't wait for the gap.
addEventListener('resize', requestPaint);
