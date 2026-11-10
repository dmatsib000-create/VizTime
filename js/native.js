// The phone shells (native/, built with Capacitor). On the web page every
// function here does nothing. In the app, calls go through the bridge the
// shell injects (window.Capacitor), so the web app needs no Capacitor package
// and no build step.
//
// Reminders: while the app is in front, the page plays its own cues. The
// moment it goes to the background, the cues still to come are scheduled as
// local notifications from the session's timestamps (plannedCues in cues.js),
// and they are cancelled again when the app comes back. So a notification
// never doubles a cue the page played, and nothing fires late: a cue whose
// moment passed while the app was closed is settled silently on return.

import { isNative, platform } from './platform.js';
import { load, save } from './store.js';
import { mode, session, settings } from './state.js';
import { plannedCues, reconcileCues, CUE_IDS, phoneCarriesCue } from './cues.js';
import { $, toast } from './ui.js';
import { bringIn } from './menu.js';
import { render, leaveTv } from './screens.js';

const cap = () => window.Capacitor;
const has = name => isNative && (cap().PluginHeaders || []).some(h => h.name === name);
// A plugin the shell doesn't carry answers nothing, rather than throwing.
const call = (plugin, method, options = {}) => (has(plugin) ? cap().nativePromise(plugin, method, options) : Promise.resolve(undefined));
const listen = (plugin, event, fn) => { if (has(plugin)) cap().addListener(plugin, event, fn); };

// What the menu shows about the phone; refreshed when it opens.
export const phone = {
  cues: 'unknown',               // 'granted', 'denied', 'prompt' or 'unknown'
  exact: true,                   // Android: exact timing allowed
  floating: false,               // Android: the floating window is available here
  update: load('update', null),  // Android: { version, url } when a newer build exists
  version: '',
};

export function initNative() {
  if (!isNative) return;
  // The channels are made at once (and a reminder waits for them, so nothing
  // is scheduled before its channel exists); the listeners are attached
  // straight away.
  channelsReady();
  // Android says the app is no longer active only when it is stopped (gone to
  // the background or closed), not while it floats. That is remembered, so a
  // later sync never takes a stopped app for one in front, whatever the page
  // itself reports.
  listen('App', 'appStateChange', ({ isActive }) => {
    leavingFloat = false;
    stopped = !isActive;
    syncBackgroundCues();
  });
  document.addEventListener('visibilitychange', () => syncBackgroundCues());
  listen('App', 'appUrlOpen', ({ url }) => importFromUrl(url, false));
  call('App', 'getLaunchUrl').then(r => r?.url && importFromUrl(r.url, true)).catch(() => {});
  // In Android's floating window the page keeps drawing, but its cues are
  // handed to the phone: a swipe that closes the window ends the activity
  // before the page could schedule anything, so the reminders are set while
  // it floats, and the page plays no tone of its own meanwhile (session.js).
  // Closing the window and growing it back to full size both report "not
  // floating" first; whether the app then came to the front or was stopped
  // arrives a moment later (appStateChange). Until then the reminders stay.
  listen('Floating', 'floatingChanged', ({ active }) => {
    if (active) leaveTv(); // Android's small window takes over from TV view
    document.body.classList.toggle('is-floating', !!active);
    leavingFloat = !active;
    if (active) { syncBackgroundCues(); return; }
    // Should no word arrive (a phone that keeps a floating app running), a
    // visible page is in front.
    setTimeout(() => {
      if (!leavingFloat || document.hidden) return;
      leavingFloat = false;
      syncBackgroundCues();
    }, 1500);
  });
  call('Floating', 'isAvailable').then(r => {
    phone.floating = !!r?.available;
    if (phone.floating) render(); // the Float button can show now
  }).catch(() => {});
  call('App', 'getInfo').then(r => { phone.version = r ? `${r.version} (${r.build})` : ''; }).catch(() => {});
  syncBackgroundCues(); // a fresh start never keeps stale reminders
  refreshPhone();
  checkForUpdate();
}

export async function refreshPhone() {
  if (!has('LocalNotifications')) return;
  try {
    const p = await call('LocalNotifications', 'checkPermissions');
    phone.cues = p?.display === 'prompt-with-rationale' ? 'prompt' : (p?.display || 'unknown');
    if (platform === 'android') {
      const e = await call('LocalNotifications', 'checkExactNotificationSetting');
      phone.exact = e?.exact_alarm !== 'denied';
    }
  } catch { /* the menu shows what it knows */ }
}

/* ---------- Reminders while in the background ---------- */

// cue_none is a short silence: an Android channel made without a sound plays
// the phone's own notification sound, so a quiet reminder carries this instead.
const SOUND = { half: 'cue_half', warn: 'cue_warn', finish: 'cue_finish', silent: 'cue_none' };
const channelId = (kind, vibrate) => `timefall-${kind}${vibrate ? '-vibrate' : ''}`;

// Android ties a notification's sound to its channel, so there is one channel
// per tone (and one silent), each with and without vibration. A channel's
// sound can't change once made, so the silent ones have new names and the
// quiet ones from before (which rang) are removed.
async function makeChannels() {
  const names = { half: 'Halfway tone', warn: 'Warning tone', finish: 'Finish tone', silent: 'Quiet reminders' };
  const made = [];
  for (const [kind, name] of Object.entries(names)) {
    for (const vibrate of [false, true]) {
      made.push(call('LocalNotifications', 'createChannel', {
        id: channelId(kind, vibrate), name: vibrate ? `${name}, with vibration` : name,
        description: 'Cues while TimeFall is in the background', importance: 4, visibility: 1,
        vibration: vibrate, lights: false, sound: SOUND[kind],
      }));
    }
  }
  for (const vibrate of [false, true]) made.push(call('LocalNotifications', 'deleteChannel', { id: channelId('quiet', vibrate) }));
  await Promise.allSettled(made);
}
// Made once per run. app.js renders before initNative runs, and render()
// already syncs the reminders, so the first schedule can come before
// initNative; it waits here instead of finding no channel.
let channels = null;
const channelsReady = () => (platform === 'android' ? (channels ||= makeChannels().catch(() => {})) : undefined);

// `exact` is false when Android has had exact timing turned off for the app:
// asking for an exact alarm then would open the phone's settings screen in
// the person's face, so the reminder is scheduled as close as Android allows
// and the menu offers the setting instead.
function toNotification(c, exact) {
  const n = {
    id: c.id, title: c.title, body: c.body, autoCancel: true, extra: { cue: c.cue },
    schedule: { at: new Date(c.at), allowWhileIdle: true },
    isExactNotification: exact,
  };
  const sound = c.tone ? SOUND[c.cue] : platform === 'android' ? SOUND.silent : '';
  if (sound) n.sound = `${sound}.wav`;
  if (platform === 'android') n.channelId = channelId(c.tone ? c.cue : 'silent', c.vibrate);
  return n;
}

// Runs one step at a time, so a quick leave-and-return never interleaves.
// `held` is what the phone holds, by cue id; reconcileCues (cues.js, tested)
// works out what to change, so a call that changes nothing (render() runs
// often, and leaving the app is reported twice) costs nothing.
// `inFront` is null until the first call, which clears anything a previous
// run of the app left behind. `stopped` is Android's (and iOS's) word that
// the app went out of sight; `leavingFloat` covers the moment between the
// floating window closing and that word arriving.
// `arriving` is what the phone was handed and has left to arrive: a reminder
// whose moment came while out of sight. The page may reach that cue a little
// later (a hidden page is woken only now and then), and must still leave it
// to the phone.
let queue = Promise.resolve(), held = {}, arriving = [], inFront = null, stopped = false, leavingFloat = false;
export const isFloating = () => isNative && document.body.classList.contains('is-floating');
// Whether the page leaves a cue's tone, vibration and voice to the phone's
// reminder (cues.js): in Android's floating window, and on an iPhone whose
// page is kept running out of sight by its floating picture (js/float.js).
const outOfSight = () => document.hidden || stopped || isFloating() || leavingFloat;
export const cueHandedOff = (cue, at) => isNative && phoneCarriesCue({ cue, at, outOfSight: outOfSight(), handed: [...Object.values(held), ...arriving] });

const quietly = (method, options) => call('LocalNotifications', method, options).catch(() => undefined);
const cancelIds = ids => (ids.length ? quietly('cancel', { notifications: ids.map(id => ({ id })) }) : undefined);

export function syncBackgroundCues(hidden = outOfSight()) {
  if (!has('LocalNotifications')) return;
  queue = queue.then(async () => {
    const now = Date.now();
    if (inFront === null) { await cancelIds(Object.values(CUE_IDS)); held = {}; arriving = []; }
    if (!hidden) {
      await cancelIds(Object.keys(held).map(Number));
      held = {};
      arriving = [];
      // Arriving in front: a reminder that already fired has done its job; the page shows the same thing.
      if (inFront !== true) await quietly('removeAllDeliveredNotifications');
      inFront = true;
      return;
    }
    inFront = false;
    const change = reconcileCues(held, plannedCues(mode, session, settings, now), now);
    await cancelIds(change.cancel);
    held = change.kept;
    arriving = [...arriving, ...change.arriving];
    const fresh = change.schedule;
    if (!fresh.length) return;
    // A check that fails isn't a refusal: the reminders are still set.
    const p = await quietly('checkPermissions');
    if (p && p.display !== 'granted') return;
    if (platform === 'android') {
      const e = await quietly('checkExactNotificationSetting');
      if (e) phone.exact = e.exact_alarm !== 'denied';
    }
    await channelsReady();
    await call('LocalNotifications', 'schedule', { notifications: fresh.map(c => toNotification(c, phone.exact)) });
    for (const c of fresh) held[c.id] = c;
  }).catch(() => {});
}

// Asked when a session starts with reminders on, so the question comes with
// its reason. A refusal is respected until the phone's Settings say otherwise.
export async function askForCues() {
  if (!has('LocalNotifications') || !settings.notify) return;
  try {
    const p = await call('LocalNotifications', 'checkPermissions');
    if (p?.display === 'prompt' || p?.display === 'prompt-with-rationale') await call('LocalNotifications', 'requestPermissions');
    await refreshPhone();
  } catch { /* reminders are optional */ }
}

export function openExactSettings() {
  call('LocalNotifications', 'changeExactNotificationSetting').then(refreshPhone).catch(() => {});
}

/* ---------- Screen, vibration, floating ---------- */

export function keepAwake(on) {
  if (!has('KeepAwake')) return;
  call('KeepAwake', on ? 'keepAwake' : 'allowSleep').catch(() => {});
}

// One short pulse at the warning, two at the finish. Only while the app is in
// front: in the background the phone's own notification settings decide.
export function vibrate(cue) {
  if (!has('Haptics')) return;
  call('Haptics', 'vibrate', { duration: 350 }).catch(() => {});
  if (cue === 'finish') setTimeout(() => call('Haptics', 'vibrate', { duration: 350 }).catch(() => {}), 600);
}

export const canFloatNative = () => has('Floating') && phone.floating;

export async function floatNative() {
  try {
    const r = await call('Floating', 'enter');
    if (!r?.entered) toast('The floating view could not open here.');
  } catch { toast('The floating view could not open here.'); }
}

// Android 12 and later can float on its own when the person leaves the app;
// the shell is told whenever that should be on.
// Told only when it changes: render() runs often. If the shell couldn't take
// it, the value is forgotten so the next call tries again.
let autoFloat = null;
export function setAutoFloat(on) {
  if (!has('Floating') || autoFloat === !!on) return;
  autoFloat = !!on;
  call('Floating', 'setAutoEnter', { enabled: autoFloat }).catch(() => { autoFloat = null; });
}

/* ---------- Presets and settings arriving by link ---------- */

// The web page offers "Open in the TimeFall app" with the code in the link.
// The link the app was opened with stays its launch link until the app is
// closed, through the reload that follows bringing a code in, and comes back
// when Android restores the app; so a launch link is brought in once (kept
// for this run in sessionStorage, and across runs as the last code). A link
// tapped while the app runs is always brought in: the same code twice adds
// nothing new, so tapping it again is safe. `seen` covers a cold start, where
// one link can arrive both as an event and as the launch link.
const LAUNCH_SEEN = 'timefall-launch-link';
const seen = new Set();
function importFromUrl(url, atLaunch = false) {
  const m = /^timefall:\/\/import[^A-Za-z]*(?:code=)?(TF1\.[A-Za-z0-9_-]+)/.exec(url || '');
  if (!m || seen.has(m[1])) return;
  if (atLaunch) {
    let before = null;
    try { before = sessionStorage.getItem(LAUNCH_SEEN); sessionStorage.setItem(LAUNCH_SEEN, m[1]); } catch { /* no storage: fall back to the last code */ }
    if (before === m[1] || m[1] === load('lastImport', '')) return;
  }
  seen.add(m[1]);
  save('lastImport', m[1]);
  bringIn(m[1]);
}

/* ---------- A newer Android build ---------- */

// Android apps installed from a link don't update themselves. Once a day the
// app asks GitHub for the newest release and, if its build number is higher,
// says so on the setup screen. Nothing about the phone or its owner is sent.
const RELEASES = 'https://api.github.com/repos/dmatsib000-create/VizTime/releases/latest';
const INSTALL_PAGE = 'https://dmatsib000-create.github.io/VizTime/install/';

const buildOf = version => parseInt((version || '').split('.').pop(), 10) || 0;

async function checkForUpdate() {
  if (platform !== 'android') return;
  try {
    const info = await call('App', 'getInfo');
    const build = parseInt(info?.build, 10) || 0;
    // A note kept from before an update is stale once that build is the one running.
    if (phone.update && buildOf(phone.update.version) <= build) {
      phone.update = null;
      save('update', null);
    }
    showUpdate();
    if (Date.now() - load('updateChecked', 0) < 20 * 60 * 60_000) return;
    const res = await fetch(RELEASES, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return;
    save('updateChecked', Date.now());
    const rel = await res.json();
    const m = /^android-v(\d+\.\d+\.\d+)$/.exec(rel.tag_name || '');
    if (!m) return;
    phone.update = buildOf(m[1]) > build ? { version: m[1], url: INSTALL_PAGE } : null;
    save('update', phone.update);
    showUpdate();
  } catch { /* offline, or GitHub is busy: another day */ }
}

function showUpdate() {
  const note = $('update-note');
  if (!note) return;
  note.hidden = !phone.update;
  if (!phone.update) return;
  note.textContent = `TimeFall ${phone.update.version} is ready. `;
  const a = document.createElement('a');
  a.href = phone.update.url;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = 'Get it';
  note.append(a);
}
