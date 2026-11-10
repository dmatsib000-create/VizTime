// The menu sheet and the mode switch.

import { isNative, platform, isIphoneWeb, isPhoneWeb, mirrorKind } from './platform.js';
import { chime, unlockAudio, canPlayThroughSilent } from './sound.js';
import { save, packCode, unpackCode, importData } from './store.js';
import { BUNDLES, clone, settings, saveSettings, mode, session, setMode } from './state.js';
import { $, toast, announce } from './ui.js';
import { tvHint } from './words.js';
import { form, defaultBy } from './setup.js';
import { syncWake } from './session.js';
import { render } from './screens.js';
import { frame } from './draw.js';
import { floatDoc, buildFloat, renderFloatText } from './pip.js';
import { canFloatWindow, canFloatVideo, inIosHomeScreenApp } from './float.js';
import { phone, refreshPhone, askForCues, canFloatNative, setAutoFloat, openExactSettings } from './native.js';

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

// What the floating view can do here, in a sentence.
function floatHint() {
  if (canFloatNative()) return 'While a session runs, choose Float at the top. TimeFall shrinks to a small window that stays over your other apps, with the picture and what comes next.';
  if (isNative && platform === 'android') return 'This phone has no floating window. TimeFall keeps the screen awake instead, and its reminders reach the lock screen.';
  if (isNative && canFloatVideo()) return 'While a session runs, choose Float at the top, then switch to another app or go to the Home Screen. The picture floats as a small video over whatever you do. It can’t pause or adjust the session; tap it for the button that returns to TimeFall.';
  if (isNative) return 'This iPhone can’t keep a small window over other apps. TimeFall keeps the screen awake while a session runs, and its reminders reach the Lock Screen.';
  if (canFloatWindow()) return 'While a session runs, choose Float at the top. A small window stays on top of your other apps, with the picture and a few controls.';
  if (canFloatVideo()) return 'While a session runs, choose Float at the top. The picture floats as a small video above other apps. It can’t be tapped, and the phone may pause it while TimeFall is in the background.';
  if (inIosHomeScreenApp()) return 'The floating view works when TimeFall is open in Safari, not from the Home Screen. Apple doesn’t support it in home-screen apps yet.';
  return 'This browser has no floating view. Chrome or Edge on a computer can keep the session in a small window on top of other apps.';
}

function renderMenu() {
  $('m-default').value = settings.defaultMode;
  // Which of Quiet, Balanced and Noticeable the cue settings match (none once
  // adjusted by hand), worked out from them rather than saved alongside.
  const bundle = matchBundle();
  for (const b of document.querySelectorAll('[data-bundle]')) b.setAttribute('aria-pressed', String(b.dataset.bundle === bundle));
  $('m-bundle-hint').textContent = BUNDLE_HINTS[bundle];
  for (const c of document.querySelectorAll('[data-cue]')) {
    const [cue, kind] = c.dataset.cue.split('.');
    c.checked = !!settings.cues[cue][kind];
  }
  $('m-volume').value = settings.volume;
  $('m-warmth').value = settings.warmth;
  $('m-breathe').checked = settings.breathe;
  $('m-flash').checked = settings.flash;
  $('m-wake').checked = settings.wake;
  $('m-silent').checked = settings.silentTones;
  $('m-silent-wrap').hidden = !canPlayThroughSilent();
  $('m-remember').checked = settings.rememberLengths;
  $('m-forget').textContent = 'Forget saved lengths';

  // The phone shells vibrate and schedule reminders; a computer browser shows
  // notifications; an iPhone web app can't fire them once it leaves the screen.
  $('m-vibrate-wrap').hidden = !isNative;
  $('m-vibrate').checked = settings.vibrate;
  $('m-notify-wrap').hidden = isNative ? false : (!('Notification' in window) || isIphoneWeb);
  $('m-notify-label').textContent = isNative ? 'Reminders while TimeFall is in the background' : 'System notification at the warning and finish (computer)';
  $('m-notify').checked = settings.notify;
  // The hint describes the checkbox to screen readers too, so it is empty where it doesn't apply.
  $('m-notify-hint').hidden = !isNative;
  $('m-notify-hint').textContent = !isNative ? ''
    : settings.notify && phone.cues === 'denied'
      ? 'Notifications are turned off for TimeFall in the phone’s Settings, so nothing reaches the lock screen until they are on again.'
      : 'Each cue you have turned on reaches the lock screen as a soft tone and a line, with the phone locked or TimeFall out of sight. In Work mode, only “Session finished.”';
  $('m-exact-wrap').hidden = !(isNative && platform === 'android' && settings.notify && !phone.exact);

  $('m-float-hint').textContent = floatHint();
  $('m-autofloat-wrap').hidden = !canFloatNative();
  $('m-autofloat').checked = settings.autoFloat;

  $('m-tv-hint').textContent = tvHint(mirrorKind);

  $('m-open-app').hidden = true; // offered once a code is made, on a phone's browser
  $('m-data-hint').textContent = isNative
    ? 'Presets, notes and settings stay on this phone. A code brings them in from the web version, or keeps a copy.'
    : 'Presets, notes and settings stay in this browser. A code carries them to the TimeFall app on your phone, or keeps a copy.';
  $('m-about').textContent = isNative && phone.version ? `TimeFall ${phone.version}` : '';
}

$('menu-btn').addEventListener('click', () => {
  renderMenu();
  $('sheet').showModal();
  // Permissions may have changed in the phone's Settings meanwhile.
  refreshPhone().then(renderMenu);
});
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
$('m-vibrate').addEventListener('change', () => { settings.vibrate = $('m-vibrate').checked; saveSettings(); });
$('m-remember').addEventListener('change', () => { settings.rememberLengths = $('m-remember').checked; saveSettings(); });
$('m-forget').addEventListener('click', () => { save('lengths', null); $('m-forget').textContent = 'Saved lengths forgotten'; });
$('m-notify').addEventListener('change', async () => {
  settings.notify = $('m-notify').checked;
  if (isNative) {
    saveSettings();
    if (settings.notify) await askForCues();
    renderMenu();
    return;
  }
  if (settings.notify && Notification.permission !== 'granted') {
    const p = await Notification.requestPermission().catch(() => 'denied');
    if (p !== 'granted') { settings.notify = false; $('m-notify').checked = false; toast('Notifications are blocked in this browser.'); }
  }
  saveSettings();
});
$('m-exact').addEventListener('click', openExactSettings);
$('m-autofloat').addEventListener('change', () => {
  settings.autoFloat = $('m-autofloat').checked;
  saveSettings();
  setAutoFloat(settings.autoFloat && session && !session.finishedAt);
});

/* ---------- Your data ---------- */

$('m-copy').addEventListener('click', async () => {
  const code = packCode();
  $('m-code').value = code;
  let copied = false;
  try { await navigator.clipboard.writeText(code); copied = true; } catch { /* some browsers allow copying only from a field */ }
  if (!copied) {
    $('m-code').focus();
    $('m-code').select();
    try { copied = document.execCommand('copy'); } catch { /* then the code is selected, ready to copy */ }
  }
  $('m-data-saved').textContent = copied
    ? (isNative ? 'Copied. On the other device, open Menu → Your data, paste it and choose Bring in.' : 'Copied. In the TimeFall app, open Menu → Your data, paste it and choose Bring in.')
    : 'The code is selected above. Copy it.';
  if (isPhoneWeb) {
    $('m-open-app').href = `timefall://import?code=${code}`;
    $('m-open-app').hidden = false;
  }
});
$('m-paste').addEventListener('click', () => bringIn($('m-code').value));

// A code pasted here, or arriving by link (js/native.js). The page reloads so
// every part of it reads the new data. The answer is written into the sheet
// as well as the toast: while the sheet is open as a modal, the toast sits
// dimmed behind it, and a code pasted into the sheet seemed to do nothing.
export function bringIn(code) {
  let result;
  try {
    result = importData(unpackCode(code));
  } catch {
    $('m-data-saved').textContent = 'That isn’t a TimeFall code. Copy the whole code, then paste it here.';
    toast('That isn’t a TimeFall code.');
    return;
  }
  const parts = [];
  if (result.presets) parts.push(`${result.presets} preset${result.presets === 1 ? '' : 's'}`);
  if (result.notes) parts.push(`${result.notes} note${result.notes === 1 ? '' : 's'}`);
  if (result.settings) parts.push('settings');
  if (!parts.length) {
    $('m-data-saved').textContent = 'Nothing new in that code.';
    toast('Nothing new in that code');
    return;
  }
  const what = `Brought in ${parts.join(', ')}`;
  $('m-data-saved').textContent = `${what}.`;
  toast(what);
  setTimeout(() => location.reload(), 1200);
}
