// Small helpers every screen uses: element lookup, the toast and the screen
// reader's live region. The time formats live in words.js and are passed on here.

export { dateFmt, fmtClock, fmtShort, fmtLeft } from './words.js';

export const $ = id => document.getElementById(id);
export const body = document.body;

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
