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
// clock until asked, then the private reveal speaks the time left.
export function faceLabel(mode, s, now) {
  if (!s) return '';
  if (mode === 'work') return 'Clock. Show time left';
  return `${s.pausedAt ? 'Paused, ' : ''}${fmtLeft(E.remaining(s, now))} left, ends ${fmtClock(s.endAt)}`;
}
