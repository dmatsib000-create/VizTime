// A session's life: starting, the running controls, finishing and stopping,
// the cues along the way, and keeping the screen awake meanwhile.

import * as E from './engine.js';
import { isNative } from './platform.js';
import { load, save, noteKey } from './store.js';
import { unlockAudio, chime, speak } from './sound.js';
import { mode, session, setSession, settings, persist } from './state.js';
import { $, toast, announce } from './ui.js';
import { cueWords, notification } from './words.js';
import { resetForm } from './setup.js';
import { render } from './screens.js';
import { frame } from './draw.js';
import { closeFloat } from './pip.js';
import { askForCues, vibrate, keepAwake, cuesHandedOff } from './native.js';

const { MIN } = E;

/* ---------- Session lifecycle ---------- */

// Per-activity lengths are kept only when the person turns this on in Menu.
export const suggestedMinutes = title => (settings.rememberLengths && load('lengths', {})[noteKey(title)]) || 25;

function rememberLength(opts) {
  if (!settings.rememberLengths || opts.kind === 'extension' || !noteKey(opts.title)) return;
  const lengths = load('lengths', {});
  lengths[noteKey(opts.title)] = Math.round(opts.totalMs / MIN);
  save('lengths', lengths);
}

export function startSession(opts) {
  unlockAudio();
  askForCues();
  rememberLength(opts);
  $('toast').hidden = true;
  setSession(E.createSession(opts));
  persist();
  resetForm();
  render();
  frame.force = true;
}

function stopSession() {
  const prev = session;
  setSession(null);
  persist();
  resetForm();
  closeFloat();
  render();
  toast('Session stopped', () => {
    if (session) return;
    setSession(prev);
    E.settle(session);
    persist();
    render();
  });
}

// Done on the finish screen: back to a clean setup, with no undo.
export function endSession() {
  setSession(null);
  persist();
  closeFloat();
  resetForm();
  render();
}

// `cued` is true only when the finish arrived live and its cue played. Quiet
// endings (Finish now, taking off more time than is left, a finish missed
// while closed) skip the flash and breathing light.
export function onFinished(cued = false) {
  persist();
  render();
  if (!cued) return;
  const light = $('light');
  if (settings.flash) {
    light.classList.add('flash');
    light.addEventListener('animationend', () => light.classList.remove('flash'), { once: true });
  }
  if (settings.breathe) {
    // Breathing follows the flashes, however long reduced motion makes them.
    const start = () => light.classList.add('breathe');
    if (settings.flash) light.addEventListener('animationend', start, { once: true });
    else start();
    setTimeout(() => light.classList.remove('breathe'), 60_000);
  }
}

$('pause-btn').addEventListener('click', () => {
  if (!session) return;
  if (session.pausedAt) E.resume(session); else E.pause(session);
  persist();
  render();
});
for (const b of document.querySelectorAll('[data-adj]')) {
  b.addEventListener('click', () => {
    if (!session) return;
    E.adjust(session, +b.dataset.adj * MIN);
    persist();
    if (session.finishedAt) onFinished(); else render();
  });
}
$('finish-btn').addEventListener('click', () => {
  if (!session) return;
  E.finishNow(session);
  announce(cueWords(mode, 'finish', session, Date.now()));
  onFinished();
});
$('stop-btn').addEventListener('click', stopSession);

/* ---------- Cues ---------- */

// The words themselves are in words.js, where the tests can check Work mode's.
export function playCue(cue) {
  const c = settings.cues[cue] || {};
  const words = cueWords(mode, cue, session, Date.now());
  // In Android's floating window, and on an iPhone whose page runs on out of
  // sight under its floating picture, the phone's reminder carries the tone
  // and the words (js/native.js, cues.js); the page only draws.
  const handedOff = cuesHandedOff();
  if (c.sound && !handedOff) chime(cue, settings.volume, settings.silentTones);
  if (settings.vibrate && cue !== 'half' && !handedOff) vibrate(cue);
  if (c.speak && !handedOff) speak(words);
  if (cue !== 'half') announce(words || '');
  if (cue !== 'half') notify(cue);
}

async function notify(cue) {
  // The shells schedule their reminders ahead of time (js/native.js).
  if (isNative || !settings.notify || !document.hidden || !('Notification' in window) || Notification.permission !== 'granted') return;
  const n = notification(mode, cue, session, Date.now());
  if (!n) return;
  const opts = { body: n.body, tag: 'timefall', icon: 'icons/icon-192.png', silent: true };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) reg.showNotification(n.title, opts); else new Notification(n.title, opts);
  } catch { /* notifications are optional */ }
}

// Audio needs a tap to start, including after a reload with a session running.
document.addEventListener('pointerdown', unlockAudio, { passive: true });

/* ---------- Screen wake lock ---------- */

// A change that arrives while a request is still pending runs again after it,
// so pausing during the request doesn't leave the screen held awake.
let wakeLock = null, wakeBusy = false, wakeAgain = false;
const wantWake = () => settings.wake && session && !session.finishedAt && !session.pausedAt && document.visibilityState === 'visible';
export async function syncWake() {
  // The shells hold the screen themselves; the web lock below isn't theirs.
  if (isNative) { keepAwake(wantWake()); return; }
  if (wakeBusy) { wakeAgain = true; return; }
  wakeBusy = true;
  try {
    const want = wantWake;
    if (want() && !wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
    if (!want() && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch { wakeLock = null; }
  wakeBusy = false;
  if (wakeAgain) { wakeAgain = false; syncWake(); }
}
