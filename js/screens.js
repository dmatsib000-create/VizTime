// Which screen shows, and the running and finish screens themselves.

import * as E from './engine.js';
import { getNote, setNote } from './store.js';
import { mode, session, settings, saveSettings } from './state.js';
import { $, body, fmtLeft } from './ui.js';
import { faceLabel as pictureLabel, sessionTitle, runFigures, scheduleTimes, landingText, startLabel } from './words.js';
import { renderSetup, labelChips, showRibbon, showError } from './setup.js';
import { startSession, endSession, suggestedMinutes, syncWake } from './session.js';
import { tick, faceName, faceSetting, requestPaint } from './draw.js';
import { FACES } from './faces.js';
import { canFloatWindow, canFloatVideo } from './float.js';
import { renderFloatText } from './pip.js';
import { canFloatNative, syncBackgroundCues, setAutoFloat } from './native.js';

const { MIN, MAX_MINUTES } = E;

/* ---------- Screens ---------- */

const screenFor = () => (!session ? 'setup' : session.finishedAt ? 'landing' : 'run');

let shownScreen = null;

export function render() {
  const screen = screenFor();
  const changed = shownScreen !== null && shownScreen !== screen;
  shownScreen = screen;
  body.dataset.mode = mode;
  body.dataset.screen = screen;
  for (const b of document.querySelectorAll('#mode-switch [data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  if (screen !== 'run') body.classList.remove('is-edit-open', 'is-note-open');
  renderSetup();
  if (session && !session.finishedAt) renderRun();
  if (session && session.finishedAt) renderLanding();
  $('float-btn').hidden = !(session && !session.finishedAt && (canFloatNative() || canFloatWindow() || canFloatVideo()));
  requestPaint();
  tick();
  syncWake();
  // The phone shells: reminders follow the session, and Android may float on its own.
  syncBackgroundCues();
  setAutoFloat(settings.autoFloat && session && !session.finishedAt);
  if (changed) focusScreen(screen);
}

// After Start, Finish, Stop or Done, focus is left on a button the change just
// hid. Move it to the new screen's heading so keyboard and VoiceOver users
// arrive at the top of what is now showing.
function focusScreen(screen) {
  const active = document.activeElement;
  if (active && active !== body && active.getClientRects().length) return;
  const target = screen === 'setup'
    ? (mode === 'simple' ? $('s-chips').firstElementChild : $('setup-heading'))
    : screen === 'run' ? $('r-title') : $('l-title');
  target.focus();
}

/* ---------- Running screen ---------- */

// The figures under the picture. Work mode writes none at all, rather than
// writing them and leaving the stylesheet to hide them.
function showFigures(s, now) {
  const f = runFigures(mode, s, now);
  if (!f) { $('r-figures').replaceChildren(); return; }
  const left = document.createElement('strong');
  left.textContent = f.left;
  $('r-figures').replaceChildren(...(f.paused ? ['Paused · ', left, ' left'] : [left, ` left · ends ${f.ends}`]));
}

export function renderRun(now = Date.now()) {
  const s = session;
  const st = E.stage(s, now);
  const noteFor = getNote(s.title);

  // Work mode hides this text but screen readers still read it, so it names no length.
  $('r-kind').textContent = s.kind === 'extension' && mode !== 'work' ? 'Extra time' : '';
  $('r-title').textContent = sessionTitle(mode, s);
  $('r-next-line').hidden = !s.next;
  $('r-next').textContent = s.next;
  showRibbon('r-ribbon', 'r-ribbon-text', s.title);
  showFigures(s, now);
  $('pause-btn').textContent = s.pausedAt ? 'Resume' : 'Pause';

  // The next activity takes the stage for the last stretch.
  const showCard = mode === 'full' && s.next && st !== 'running';
  $('next-card').hidden = !showCard;
  if (showCard) {
    $('next-card').style.setProperty('--p', E.warnProgress(s, now).toFixed(3));
    $('nc-title').textContent = s.next;
    $('nc-step').textContent = s.step ? `First: ${s.step}` : '';
    const nextNote = getNote(s.next);
    $('nc-note').textContent = nextNote ? `Last time: ${nextNote.text}` : '';
  }

  // Offer the where-I-left-off note while there is still a thread to hold.
  const noteForm = $('leave-note');
  noteForm.hidden = !s.title || (mode === 'full' && st === 'running') || mode === 'simple';
  if (document.activeElement !== $('ln-text')) $('ln-text').value = noteFor ? noteFor.text : '';
  $('w-note-btn').hidden = !s.title;

  // Work mode: desk clock and schedule.
  const times = scheduleTimes(s, now);
  $('w-now-when').textContent = times.current;
  $('w-now-what').textContent = sessionTitle('work', s);
  $('w-next-row').hidden = !s.next;
  $('w-next-when').textContent = times.next;
  $('w-next-what').textContent = s.next;
  // Only the pictures this mode offers have a dot (faces.js): Work mode has no disc or ruler.
  for (const d of document.querySelectorAll('[data-face]')) {
    d.hidden = !(FACES[mode] || []).includes(d.dataset.face);
    d.setAttribute('aria-pressed', String(d.dataset.face === faceName()));
  }
  $('faces-switch').setAttribute('aria-label', mode === 'work' ? 'Clock style' : 'Picture');

  const face = $('face');
  // The stylesheet shapes the canvas to the picture: the ruler is wider than it is tall.
  face.dataset.picture = faceName();
  face.setAttribute('aria-label', faceLabel(now));
  if (mode === 'work') { face.setAttribute('role', 'button'); face.tabIndex = 0; }
  else { face.setAttribute('role', 'img'); face.removeAttribute('tabindex'); }
  renderFloatText(now);
}

/* ---------- Finish screen ---------- */

// The main start button; in Work mode it names an end time, which moves with the clock.
export function labelMain(now) {
  if (!session || !session.next) return;
  const m = +$('l-main').dataset.min || 25;
  $('l-main').textContent = startLabel(mode, session.next, m, now);
}

function renderLanding() {
  const s = session;
  const work = mode === 'work', simple = mode === 'simple';
  const hasNext = !!s.next && !simple;

  const { label, title } = landingText(mode, s);
  $('l-label').textContent = label;
  $('l-title').textContent = title;
  $('l-step').textContent = hasNext && s.step ? `First: ${s.step}` : '';
  showRibbon('l-ribbon', 'l-ribbon-text', hasNext ? s.next : '');

  $('l-start').hidden = !hasNext;
  if (hasNext) $('l-main').dataset.min = suggestedMinutes(s.next);
  labelMain(Date.now());
  $('l-start-label').textContent = work ? 'Or until' : 'Or another length';
  labelChips(Date.now());

  $('l-note').hidden = !s.title || simple;
  $('l-note-label').textContent = work ? 'Note' : `Where did you leave off on ${s.title}?`;
  const note = getNote(s.title);
  if (document.activeElement !== $('l-note-text')) $('l-note-text').value = note ? note.text : '';
  $('l-note-saved').textContent = '';

  $('l-more-label').textContent = work ? 'Extend' : simple ? 'More time' : `More time on ${s.title || 'this'}`;
  for (const b of document.querySelectorAll('[data-extend]')) b.textContent = `+${b.dataset.extend} min`;
  renderFloatText(Date.now());
}

for (const c of $('l-chips').children) {
  c.addEventListener('click', () => startNext(+c.dataset.min));
}
$('l-main').addEventListener('click', () => startNext(+$('l-main').dataset.min));
$('l-form').addEventListener('submit', e => {
  e.preventDefault();
  const m = parseInt($('l-minutes').value, 10);
  if (!(m >= 1 && m <= MAX_MINUTES)) { showError('l-error', 'l-minutes', `Type a number of minutes from 1 to ${MAX_MINUTES}.`); return; }
  showError('l-error');
  $('l-minutes').value = '';
  startNext(m);
});
$('l-minutes').addEventListener('input', () => showError('l-error'));
function startNext(minutes) {
  startSession({ title: session.next, totalMs: minutes * MIN });
}
for (const b of document.querySelectorAll('[data-extend]')) {
  b.addEventListener('click', () => {
    const s = session;
    startSession({ title: s.title, next: s.next, step: s.step, totalMs: +b.dataset.extend * MIN, kind: 'extension' });
  });
}
$('l-done').addEventListener('click', endSession);

// Notes save as you type; they are shown the next time that activity starts.
function wireNote(inputId, savedId) {
  let timer;
  $(inputId).addEventListener('input', () => {
    if (!session || !session.title) return;
    setNote(session.title, $(inputId).value);
    clearTimeout(timer);
    timer = setTimeout(() => {
      $(savedId).textContent = $(inputId).value.trim() ? 'Saved for next time' : '';
    }, 500);
  });
  $(inputId).closest('form').addEventListener('submit', e => { e.preventDefault(); $(inputId).blur(); });
}
wireNote('ln-text', 'ln-saved');
wireNote('l-note-text', 'l-note-saved');

/* ---------- Work mode tools ---------- */

$('w-edit-btn').addEventListener('click', () => {
  const open = body.classList.toggle('is-edit-open');
  $('w-edit-btn').setAttribute('aria-expanded', String(open));
});
$('w-note-btn').addEventListener('click', () => {
  if (body.classList.toggle('is-note-open')) $('ln-text').focus();
});
for (const d of document.querySelectorAll('[data-face]')) {
  d.addEventListener('click', () => { settings[faceSetting()] = d.dataset.face; saveSettings(); render(); });
}

// What the picture says to a screen reader (words.js; the floating window uses it too).
export const faceLabel = now => pictureLabel(mode, session, now);

// Tapping the clock (or Enter or Space on it) privately shows the time left
// for a few seconds.
let revealTimer;
function reveal() {
  if (mode !== 'work' || !session) return;
  $('reveal').textContent = '';
  setTimeout(() => { $('reveal').textContent = fmtLeft(E.remaining(session)); }, 50);
  $('reveal').classList.add('is-on');
  clearTimeout(revealTimer);
  revealTimer = setTimeout(() => $('reveal').classList.remove('is-on'), 4000);
}
$('face').addEventListener('click', reveal);
$('face').addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  e.preventDefault();
  reveal();
});
