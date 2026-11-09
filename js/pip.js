// The floating views' content: the always-on-top window's page and controls,
// and the picture-in-picture video. float.js opens and closes them.

import { mode, session } from './state.js';
import { $, toast } from './ui.js';
import { floatText } from './words.js';
import { faceLabel, mainLabel, startMain, extend } from './screens.js';
import { togglePause, adjustBy, endSession } from './session.js';
import { tick, lastTick, step, paint, paintVideo, faceModel, faceName, frameGap, paintRequests } from './draw.js';
import { canFloatWindow, canFloatVideo, openFloatWindow, openFloatVideo } from './float.js';
import { canFloatNative, floatNative } from './native.js';

export let floatDoc = null;
let floatWin = null, closeVideo = null, videoTimer = null;

// The floating window draws on its own animation frames. The main tab's frames
// stop whenever that tab is in the background, which is exactly when the
// floating window is in use; relying on them left a stale, stretched picture.
let lastFloatFrame = 0, seenRequests = 0;
function floatFrame(t) {
  if (!floatWin) return;
  floatWin.requestAnimationFrame(floatFrame);
  if (paintRequests === seenRequests && t - lastFloatFrame < frameGap(Date.now())) return;
  seenRequests = paintRequests;
  lastFloatFrame = t;
  step();
  paintFloat();
  // Background tabs may run timers only once a minute; keep the text and cues current.
  if (Date.now() - lastTick >= 1000) tick();
}

function paintFloat() {
  if (!floatDoc || !session || session.finishedAt) return;
  paint(floatDoc.getElementById('pip-face'), faceName(), faceModel(Date.now()));
}

async function openFloat() {
  if (!session || session.finishedAt) return;
  // Android's own small window; the page itself shrinks into it.
  if (canFloatNative()) return floatNative();
  if (floatWin || closeVideo) return closeFloat();
  try {
    if (canFloatWindow()) {
      floatWin = await openFloatWindow(240, 300, () => { floatWin = null; floatDoc = null; });
      floatDoc = floatWin.document;
      buildFloat(floatDoc);
      renderFloatText(Date.now());
      floatWin.addEventListener('resize', paintFloat);
      lastFloatFrame = 0; // each window's frame clock starts from zero
      floatWin.requestAnimationFrame(floatFrame);
    } else if (canFloatVideo()) {
      paintVideo();
      videoTimer = setInterval(paintVideo, 500);
      closeVideo = await openFloatVideo($('video-canvas'), () => {
        clearInterval(videoTimer);
        videoTimer = null;
        closeVideo = null;
      });
    }
  } catch {
    clearInterval(videoTimer);
    toast('The floating view could not open here.');
  }
}

export function closeFloat() {
  if (floatWin) { floatWin.close(); floatWin = null; floatDoc = null; }
  if (closeVideo) closeVideo();
}

export function buildFloat(doc) {
  doc.title = mode === 'work' ? 'Day' : 'TimeFall';
  doc.documentElement.lang = 'en';
  doc.body.className = 'pip';
  doc.body.innerHTML = `
    <div class="light" aria-hidden="true"></div>
    <p class="pip-title" id="pip-title"></p>
    <p class="pip-next" id="pip-next"></p>
    <div class="pip-face-wrap" id="pip-face-wrap"><canvas class="pip-face" id="pip-face" role="img"></canvas></div>
    <p class="pip-fig mono" id="pip-fig"></p>
    <div class="pip-row pip-controls" id="pip-row">
      <button type="button" class="ctl mono" data-padj="-5" aria-label="Take 5 minutes off">−5</button>
      <button type="button" class="ctl mono" id="pip-pause">Pause</button>
      <button type="button" class="ctl mono" data-padj="5" aria-label="Add 5 minutes">+5</button>
    </div>
    <div class="pip-end" id="pip-end" hidden>
      <button type="button" class="primary pip-main" id="pip-main"></button>
      <div class="pip-row">
        <button type="button" class="ctl mono" id="pip-more">+5 min</button>
        <button type="button" class="ctl mono" id="pip-done">Done</button>
      </div>
    </div>`;
  // The buttons call the same actions as the main screen's (session.js, screens.js).
  doc.getElementById('pip-main').addEventListener('click', startMain);
  doc.getElementById('pip-more').addEventListener('click', () => extend(5));
  doc.getElementById('pip-done').addEventListener('click', endSession);
  doc.getElementById('pip-pause').addEventListener('click', togglePause);
  for (const b of doc.querySelectorAll('[data-padj]')) b.addEventListener('click', () => adjustBy(+b.dataset.padj));
  // In Work mode the clock can be tapped there too, or reached with the keyboard.
  const revealFloat = () => {
    if (mode !== 'work' || !session) return;
    floatRevealUntil = Date.now() + 4000;
    renderFloatText(Date.now());
  };
  const face = doc.getElementById('pip-face');
  face.addEventListener('click', revealFloat);
  face.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    revealFloat();
  });
}

let floatRevealUntil = 0;

export function renderFloatText(now) {
  if (!floatDoc || !session) return;
  const work = mode === 'work';
  const finished = !!session.finishedAt;
  const g = id => floatDoc.getElementById(id);
  const face = g('pip-face');
  face.setAttribute('aria-label', finished ? '' : faceLabel(now));
  face.setAttribute('role', work ? 'button' : 'img');
  if (work) face.tabIndex = 0; else face.removeAttribute('tabindex');
  floatDoc.body.classList.toggle('is-finished', finished);
  floatDoc.body.dataset.picture = faceName();
  g('pip-face-wrap').hidden = finished;
  const text = floatText(mode, session, now, now < floatRevealUntil);
  g('pip-title').textContent = text.title;
  g('pip-next').textContent = text.next;
  g('pip-row').hidden = work || finished;
  // At the finish the window offers the same handoff as the main screen.
  g('pip-end').hidden = !finished;
  const canStart = !!(finished && session.next && mode !== 'simple');
  g('pip-main').hidden = !canStart;
  if (canStart) g('pip-main').textContent = mainLabel(now);
  floatDoc.getElementById('pip-pause').textContent = session.pausedAt ? 'Resume' : 'Pause';
  // Only Work mode's private reveal is announced; Full mode's figures change
  // every minute and would interrupt a screen reader each time.
  const fig = floatDoc.getElementById('pip-fig');
  fig.setAttribute('aria-live', work ? 'polite' : 'off');
  fig.textContent = text.fig;
}

$('float-btn').addEventListener('click', openFloat);
