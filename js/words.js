// What TimeFall says about time: the time formats, the tab title, the cue that
// is spoken and announced, the system notification, and the picture's label.
// Pure, with `now` as a parameter, so tests/words.test.js can hold Work mode to
// its rule: it never looks like a timer, and the only thing it says is
// "Session finished."

import * as E from './engine.js';

const { MIN } = E;

/* ---------- Formatting ---------- */

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
export const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
export const fmtClock = t => timeFmt.format(t);
// Clock time without AM/PM, for the planner's narrow margin.
export const fmtShort = t => timeFmt.formatToParts(t).filter(p => p.type !== 'dayPeriod').map(p => p.value).join('').trim();

export function fmtLeft(ms) {
  if (ms < MIN) return 'under a minute';
  const m = Math.ceil(ms / MIN);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
}

/* ---------- What the page says ---------- */

// The browser tab. In Work mode it is always "Day", whatever is running.
export function pageTitle(mode, s, now) {
  if (mode === 'work') return 'Day';
  if (!s) return 'TimeFall';
  if (s.finishedAt) return 'Finished · TimeFall';
  return `${s.pausedAt ? 'Paused · ' : ''}${fmtLeft(E.remaining(s, now))} · ${s.title || 'TimeFall'}`;
}

// Spoken (when turned on) and announced to screen readers. In Work mode only
// the finish has words.
export function cueWords(mode, cue, s, now) {
  if (mode === 'work') return cue === 'finish' ? 'Session finished.' : '';
  const title = s.title;
  if (cue === 'half') return `Halfway${title ? ` through ${title}` : ''}.`;
  if (cue === 'warn') return `${fmtLeft(E.remaining(s, now))} left${title ? ` in ${title}` : ''}.${s.next ? ` Next: ${s.next}.` : ''}`;
  return `${title ? `${title} is finished.` : 'Finished.'}${s.next ? ` Next: ${s.next}.` : ''}`;
}

// The system notification at the warning and finish, or null for none. A
// patient may see it, so Work mode sends only the finish, with nothing else.
// The phone shells also show the halfway words, when that tone is on.
export function notification(mode, cue, s, now) {
  if (mode === 'work') return cue === 'finish' ? { title: 'Session finished.', body: '' } : null;
  if (cue === 'half') return { title: cueWords(mode, 'half', s, now), body: '' };
  if (cue === 'warn') {
    return { title: `${fmtLeft(E.remaining(s, now))} left${s.title ? ` · ${s.title}` : ''}`, body: s.next ? `Then ${s.next}` : '' };
  }
  return { title: `${s.title || 'Session'} finished`, body: s.next ? `Next: ${s.next}` : '' };
}

// How long the private reveal shows the time left in Work mode: four seconds,
// on the page and in the floating window alike.
export const REVEAL_MS = 4000;

// The picture's label for screen readers. Work mode stays discreet: it is a
// clock until asked, then the private reveal speaks the time left. In TV view
// there is no reveal to offer, so it is only a clock.
export function faceLabel(mode, s, now, onTv = false) {
  if (!s) return '';
  if (mode === 'work') return onTv ? 'Clock' : 'Clock. Show time left';
  return `${s.pausedAt ? 'Paused, ' : ''}${fmtLeft(E.remaining(s, now))} left, ends ${fmtClock(E.endsAt(s, now))}`;
}

/* ---------- The screens' own words ---------- */
// Everything below is shown on screen or in a floating window. Work mode keeps
// to clock times and plain names: a patient may see any of it.

// The running session's name. An untitled one is "Current" in Work mode and
// named by its length elsewhere.
export const sessionTitle = (mode, s) => s.title || (mode === 'work' ? 'Current' : `${Math.round(s.totalMs / MIN)} minutes`);

// The figures under the running picture, or null in Work mode, which shows none.
export function runFigures(mode, s, now) {
  if (mode === 'work') return null;
  return { paused: !!s.pausedAt, left: fmtLeft(E.remaining(s, now)), ends: fmtClock(E.endsAt(s, now)) };
}

// Work mode's schedule: when the current entry runs, and when the next starts.
export function scheduleTimes(s, now) {
  const end = E.endsAt(s, now);
  return { current: `${fmtShort(end - s.totalMs)}–${fmtShort(end)}`, next: fmtShort(end) };
}

// The finish screen's small label and big title.
export function landingText(mode, s) {
  const hasNext = !!s.next && mode !== 'simple';
  if (mode === 'work') return { label: hasNext ? 'Session finished.' : '', title: hasNext ? s.next : 'Session finished.' };
  if (mode === 'simple') return { label: '', title: 'Finished' };
  if (hasNext) return { label: `${s.title || 'This session'} is finished. Next:`, title: s.next };
  return { label: s.title, title: 'Finished' };
}

// The finish screen's start button. Work mode names an end time, never a length.
export const startLabel = (mode, next, minutes, now) => (mode === 'work'
  ? `Start ${next} · until ${fmtShort(now + minutes * MIN)}`
  : `Start ${next} · ${minutes} min`);

// A saved preset's name and length. Work mode never shows a length, so an
// untitled preset is just "Session" and the length is null.
export const presetName = (mode, p) => p.title || (mode === 'work' ? 'Session' : `${p.minutes} minutes`);
export const presetLength = (mode, p) => (mode === 'work' ? null : `${p.minutes} min`);

// The hint under typed minutes: Work mode confirms them as an end time.
export const exactHint = (mode, minutes, now) => (mode === 'work' && minutes >= 1 && minutes <= E.MAX_MINUTES
  ? `Ends at ${fmtClock(now + minutes * MIN)}.` : '');

// The hint under an "until" time. Work mode shows only the clock time, never a
// duration that could be read as a countdown.
export function untilHint(mode, totalMs, now) {
  if (totalMs == null) return '';
  if (totalMs < MIN) return 'That leaves no time. Choose a later time.';
  if (mode === 'work') return `Ends at ${fmtClock(now + totalMs)}.`;
  return `This session ends at ${fmtClock(now + totalMs)}, ${fmtLeft(totalMs)} from now.`;
}

// The floating window's words. In Work mode the time left shows only during
// the private reveal (`revealed`), and an untitled session shows the clock.
export function floatText(mode, s, now, revealed = false) {
  const work = mode === 'work', finished = !!s.finishedAt;
  const title = finished ? (work ? 'Session finished.' : 'Finished') : (s.title || (work ? fmtClock(now) : ''));
  const next = s.next ? `${work || finished ? 'Next:' : 'then'} ${s.next}` : '';
  let fig = '';
  if (!finished) fig = work ? (revealed ? fmtLeft(E.remaining(s, now)) : '') : `${fmtLeft(E.remaining(s, now))} · ends ${fmtClock(E.endsAt(s, now))}`;
  return { title, next, fig };
}

// The one line drawn under the iPhone floating picture, or across it at the finish.
export function videoLine(mode, s) {
  if (!s || s.finishedAt) return mode === 'work' ? 'Session finished.' : (s?.next || 'Finished');
  return s.next ? `then ${s.next}` : (s.title || '');
}

/* ---------- TV view ---------- */

// Whether a tap on Work mode's clock may show the time left. Never while TV
// view is on: the screen is being mirrored to a TV that other people can see.
export const revealAllowed = (mode, s, onTv) => mode === 'work' && !!s && !onTv;

// Shown when TV view opens, until the person goes back or ten seconds pass; a
// mirrored TV shows it too. It names where the device's own mirroring is,
// because TimeFall has no button that can start it.
const MIRROR_WHERE = {
  computer: 'open the browser’s menu and choose Cast',
  android: 'swipe down from the top and choose Cast or Smart View',
  iphone: 'open Control Center and tap Screen Mirroring',
};
export const tvEntered = kind => `TV view. To put it on a TV, ${MIRROR_WHERE[kind] || MIRROR_WHERE.computer}. Tap anywhere to go back.`;

// Menu → On a TV: how to mirror this kind of device, and what TimeFall can't do.
const MIRROR_STEPS = {
  computer: 'in Chrome, open the browser’s menu and choose Cast, save and share, then Cast, and pick the TV. In Edge, Cast is under More tools.',
  android: 'swipe down from the top of the screen, choose Cast or Smart View, and pick the TV. Turn the phone on its side to fill the TV.',
  iphone: 'open Control Center, tap Screen Mirroring and pick the TV. Turn the iPhone on its side to fill the TV.',
};
export function tvHint(kind) {
  return `Mirror this screen to the TV first: ${MIRROR_STEPS[kind] || MIRROR_STEPS.computer} `
    + 'Then, while a session runs, choose TV view at the top. It shows the picture and what you are doing, large, with no numbers counting down. '
    + 'TimeFall can’t start the mirroring itself, and the TV shows whatever this screen shows, so keep TimeFall open; the screen stays awake while TV view is on. '
    + 'In Work mode, the tap that shows the time left is off in TV view.';
}
