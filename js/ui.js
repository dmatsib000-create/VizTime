// Small helpers every screen uses: element lookup, time wording, the toast and
// the screen reader's live region.

import { MIN } from './engine.js';

export const $ = id => document.getElementById(id);
export const body = document.body;

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

/* ---------- Toast with undo ---------- */

// Hides after 10 seconds, but never while the pointer or keyboard focus is on
// it, so Undo stays reachable. It sits right after the top bar in the page, one
// Shift+Tab back from the heading that takes focus when the screen changes.
let toastTimer;
const holdToast = () => $('toast').matches(':hover, :focus-within');
function armToast() {
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { if (holdToast()) armToast(); else $('toast').hidden = true; }, 10_000);
}
export function toast(text, undo) {
  $('toast-text').textContent = text;
  $('toast-undo').hidden = !undo;
  $('toast-undo').onclick = () => { $('toast').hidden = true; undo(); };
  $('toast').hidden = false;
  // A live region that appears already filled is often not read, so the
  // always-present one speaks for the toast.
  announce(undo ? `${text}. Undo available.` : text);
  armToast();
}
// Leaving it starts a fresh 10 seconds.
for (const type of ['mouseleave', 'focusout']) $('toast').addEventListener(type, () => { if (!$('toast').hidden) armToast(); });

/* ---------- Live region ---------- */

export function announce(text) {
  if (!text) return;
  $('live').textContent = '';
  setTimeout(() => { $('live').textContent = text; }, 50);
}
