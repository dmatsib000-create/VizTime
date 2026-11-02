// Which screen shows, and the running and finish screens themselves.

import * as E from './engine.js';
import { getNote, setNote } from './store.js';
import { mode, session, settings, saveSettings } from './state.js';
import { $, body, fmtClock, fmtShort, fmtLeft } from './ui.js';
import { faceLabel as pictureLabel } from './words.js';
import { renderSetup, labelChips, showRibbon, showError } from './setup.js';
import { startSession, endSession, suggestedMinutes, syncWake } from './session.js';
import { tick, faceName, faceSetting, requestPaint } from './draw.js';
import { canFloatWindow, canFloatVideo } from './float.js';
import { renderFloatText } from './pip.js';

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
  $('float-btn').hidden = !(session && !session.finishedAt && (canFloatWindow() || canFloatVideo()));
  requestPaint();
  tick();
  syncWake();
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

const leftFigures = (s, now) => {
  const left = E.remaining(s, now);
  if (s.pausedAt) return `Paused · <strong>${fmtLeft(left)}</strong> left`;
  return `<strong>${fmtLeft(left)}</strong> left · ends ${fmtClock(s.endAt)}`;
};

export function renderRun(now = Date.now()) {
  const s = session;
  const st = E.stage(s, now);
  const noteFor = getNote(s.title);

  // Work mode hides this text but screen readers still read it, so it names no length.
  $('r-kind').textContent = s.kind === 'extension' && mode !== 'work' ? 'Extra time' : '';
  $('r-title').textContent = s.title || (mode === 'work' ? 'Current' : `${Math.round(s.totalMs / MIN)} minutes`);
  $('r-next-line').hidden = !s.next;
  $('r-next').textContent = s.next;
  showRibbon('r-ribbon', 'r-ribbon-text', s.title);
  $('r-figures').innerHTML = leftFigures(s, now);
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
  $('w-now-when').textContent = `${fmtShort(s.endAt - s.totalMs)}–${fmtShort(s.endAt)}`;
  $('w-now-what').textContent = s.title || 'Current';
  $('w-next-row').hidden = !s.next;
  $('w-next-when').textContent = fmtShort(s.endAt);
  $('w-next-what').textContent = s.next;
  for (const d of document.querySelectorAll('[data-face]')) d.setAttribute('aria-pressed', String(d.dataset.face === faceName()));
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
  $('l-main').textContent = mode === 'work'
    ? `Start ${session.next} · until ${fmtShort(now + m * MIN)}`
    : `Start ${session.next} · ${m} min`;
}

function renderLanding() {
  const s = session;
  const work = mode === 'work', simple = mode === 'simple';
  const hasNext = !!s.next && !simple;

  let label = '', title = 'Finished';
  if (work) { label = hasNext ? 'Session finished.' : ''; title = hasNext ? s.next : 'Session finished.'; }
  else if (!simple && hasNext) { label = `${s.title || 'This session'} is finished. Next:`; title = s.next; }
  else if (!simple) label = s.title;
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
