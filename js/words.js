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

// The picture's label for screen readers. Work mode stays discreet: it is a
// clock until asked, then the private reveal speaks the time left. In TV view
// there is no reveal to offer, so it is only a clock.
export function faceLabel(mode, s, now, onTv = false) {
  if (!s) return '';
  if (mode === 'work') return onTv ? 'Clock' : 'Clock. Show time left';
  return `${s.pausedAt ? 'Paused, ' : ''}${fmtLeft(E.remaining(s, now))} left, ends ${fmtClock(s.endAt)}`;
}

/* ---------- TV view ---------- */

// Whether a tap on Work mode's clock may show the time left. Never while TV
// view is on: the screen is being mirrored to a TV that other people can see.
export const revealAllowed = (mode, s, onTv) => mode === 'work' && !!s && !onTv;

// Shown for a few seconds when TV view opens; a mirrored TV shows it too.
export const TV_ENTERED = 'TV view. Tap anywhere to go back.';

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
