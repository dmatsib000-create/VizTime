// The menu sheet and the mode switch.

import { chime, unlockAudio, canPlayThroughSilent } from './sound.js';
import { save } from './store.js';
import { BUNDLES, clone, settings, saveSettings, mode, session, setMode } from './state.js';
import { $, toast, announce } from './ui.js';
import { form, defaultBy } from './setup.js';
import { syncWake } from './session.js';
import { render } from './screens.js';
import { frame } from './draw.js';
import { floatDoc, buildFloat, renderFloatText } from './pip.js';
import { canFloatWindow, canFloatVideo, inIosHomeScreenApp } from './float.js';

const BUNDLE_HINTS = {
  quiet: 'No sound. A faint warm light is the only cue.',
  balanced: 'A soft tone at the warning and at the finish, and a gentle warm light.',
  noticeable: 'Tones at halfway, the warning and the finish, a spoken line, and a stronger light that breathes slowly at the end.',
  custom: 'Your own mix of cues.',
};

function matchBundle() {
  const pick = s => JSON.stringify({ cues: s.cues, warmth: s.warmth, breathe: s.breathe });
  return Object.keys(BUNDLES).find(k => pick(BUNDLES[k]) === pick(settings)) || 'custom';
}

/* ---------- Menu ---------- */

function renderMenu() {
  $('m-default').value = settings.defaultMode;
  settings.bundle = matchBundle();
  for (const b of document.querySelectorAll('[data-bundle]')) b.setAttribute('aria-pressed', String(b.dataset.bundle === settings.bundle));
  $('m-bundle-hint').textContent = BUNDLE_HINTS[settings.bundle];
  for (const c of document.querySelectorAll('[data-cue]')) {
    const [cue, kind] = c.dataset.cue.split('.');
    c.checked = !!settings.cues[cue][kind];
  }
  $('m-volume').value = settings.volume;
  $('m-warmth').value = settings.warmth;
  $('m-breathe').checked = settings.breathe;
  $('m-flash').checked = settings.flash;
  $('m-wake').checked = settings.wake;
  $('m-notify').checked = settings.notify;
  $('m-silent').checked = settings.silentTones;
  $('m-silent-wrap').hidden = !canPlayThroughSilent();
  $('m-remember').checked = settings.rememberLengths;
  $('m-forget').textContent = 'Forget saved lengths';
  $('m-notify-wrap').hidden = !('Notification' in window);
  $('m-float-hint').textContent = canFloatWindow()
    ? 'While a session runs, choose Float at the top. A small window stays on top of your other apps, with the picture and a few controls.'
    : canFloatVideo()
      ? 'While a session runs, choose Float at the top. The picture floats as a small video above other apps. It can’t be tapped, and the phone may pause it while VizTime is in the background.'
      : inIosHomeScreenApp()
        ? 'The floating view works when VizTime is open in Safari, not from the Home Screen. Apple doesn’t support it in home-screen apps yet.'
        : 'This browser has no floating view. Chrome or Edge on a computer can keep the session in a small window on top of other apps.';
}

$('menu-btn').addEventListener('click', () => { renderMenu(); $('sheet').showModal(); });
$('sheet').addEventListener('click', e => { if (e.target === $('sheet')) $('sheet').close(); });

/* ---------- Mode switch ---------- */

const MODE_NAMES = { full: 'Full', work: 'Work', simple: 'Simple' };

function switchMode(next, { announceIt = false } = {}) {
  if (next === mode) return;
  setMode(next);
  if (!session) form.by = defaultBy();
  render();
  frame.force = true;
  if (floatDoc) { buildFloat(floatDoc); renderFloatText(Date.now()); }
  // The pressed button says which mode is on; a shortcut has no button in
  // focus, so it is announced instead.
  if (announceIt) announce(`${MODE_NAMES[mode]} mode`);
}

for (const b of document.querySelectorAll('#mode-switch [data-mode]')) {
  b.addEventListener('click', () => switchMode(b.dataset.mode));
}

// Alt+1, Alt+2, Alt+3. A modifier keeps typing from ever switching modes, and
// e.code works on keyboards where Alt changes the character.
const MODE_KEYS = { Digit1: 'full', Digit2: 'work', Digit3: 'simple', Numpad1: 'full', Numpad2: 'work', Numpad3: 'simple' };
document.addEventListener('keydown', e => {
  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || !MODE_KEYS[e.code]) return;
  e.preventDefault();
  switchMode(MODE_KEYS[e.code], { announceIt: true });
});

/* ---------- Settings controls ---------- */

$('m-default').addEventListener('change', () => { settings.defaultMode = $('m-default').value; saveSettings(); });
for (const b of document.querySelectorAll('[data-bundle]')) {
  b.addEventListener('click', () => {
    Object.assign(settings, clone(BUNDLES[b.dataset.bundle]));
    saveSettings();
    renderMenu();
  });
}
for (const c of document.querySelectorAll('[data-cue]')) {
  c.addEventListener('change', () => {
    const [cue, kind] = c.dataset.cue.split('.');
    settings.cues[cue][kind] = c.checked;
    saveSettings();
    renderMenu();
  });
}
$('m-volume').addEventListener('input', () => { settings.volume = +$('m-volume').value; saveSettings(); });
$('m-test').addEventListener('click', () => { unlockAudio(); chime('finish', settings.volume, settings.silentTones); });
$('m-silent').addEventListener('change', () => { settings.silentTones = $('m-silent').checked; saveSettings(); });
$('m-warmth').addEventListener('change', () => { settings.warmth = $('m-warmth').value; saveSettings(); renderMenu(); });
$('m-breathe').addEventListener('change', () => { settings.breathe = $('m-breathe').checked; saveSettings(); renderMenu(); });
$('m-flash').addEventListener('change', () => { settings.flash = $('m-flash').checked; saveSettings(); });
$('m-wake').addEventListener('change', () => { settings.wake = $('m-wake').checked; saveSettings(); syncWake(); });
$('m-remember').addEventListener('change', () => { settings.rememberLengths = $('m-remember').checked; saveSettings(); });
$('m-forget').addEventListener('click', () => { save('lengths', null); $('m-forget').textContent = 'Saved lengths forgotten'; });
$('m-notify').addEventListener('change', async () => {
  settings.notify = $('m-notify').checked;
  if (settings.notify && Notification.permission !== 'granted') {
    const p = await Notification.requestPermission().catch(() => 'denied');
    if (p !== 'granted') { settings.notify = false; $('m-notify').checked = false; toast('Notifications are blocked in this browser.'); }
  }
  saveSettings();
});
