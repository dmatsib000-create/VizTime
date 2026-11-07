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
import { plannedCues, CUE_IDS } from './cues.js';
import { $, toast } from './ui.js';
import { bringIn } from './menu.js';

const cap = () => window.Capacitor;
const call = (plugin, method, options = {}) => (isNative ? cap().nativePromise(plugin, method, options) : Promise.resolve(undefined));
const has = name => isNative && (cap().PluginHeaders || []).some(h => h.name === name);
const listen = (plugin, event, fn) => { if (has(plugin)) cap().addListener(plugin, event, fn); };

// What the menu shows about the phone; refreshed when it opens.
export const phone = {
  cues: 'unknown',               // 'granted', 'denied', 'prompt' or 'unknown'
  exact: true,                   // Android: exact timing allowed
  floating: false,               // Android: the floating window is available here
  update: load('update', null),  // Android: { version, url } when a newer build exists
  version: '',
};

export async function initNative() {
  if (!isNative) return;
  if (platform === 'android') await makeChannels().catch(() => {});
  listen('App', 'appStateChange', ({ isActive }) => syncBackgroundCues(!isActive));
  document.addEventListener('visibilitychange', () => syncBackgroundCues(document.hidden));
  listen('App', 'appUrlOpen', ({ url }) => importFromUrl(url));
  call('App', 'getLaunchUrl').then(r => r?.url && importFromUrl(r.url)).catch(() => {});
  // In Android's floating window the page keeps drawing, but its cues are
  // handed to the phone: a swipe that closes the window ends the activity
  // before the page could schedule anything, so the reminders are set while
  // it floats, and the page plays no tone of its own meanwhile (session.js).
  listen('Floating', 'floatingChanged', ({ active }) => {
    document.body.classList.toggle('is-floating', !!active);
    syncBackgroundCues(active || document.hidden);
  });
  if (has('Floating')) call('Floating', 'isAvailable').then(r => { phone.floating = !!r?.available; }).catch(() => {});
  call('App', 'getInfo').then(r => { phone.version = r ? `${r.version} (${r.build})` : ''; }).catch(() => {});
  syncBackgroundCues(false); // a fresh start never keeps stale reminders
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

const SOUND = { half: 'cue_half', warn: 'cue_warn', finish: 'cue_finish' };
const channelId = (kind, vibrate) => `timefall-${kind}${vibrate ? '-vibrate' : ''}`;

// Android ties a notification's sound to its channel, so there is one channel
// per tone (and one quiet), each with and without vibration.
async function makeChannels() {
  const names = { half: 'Halfway tone', warn: 'Warning tone', finish: 'Finish tone', quiet: 'Quiet reminders' };
  for (const [kind, name] of Object.entries(names)) {
    for (const vibrate of [false, true]) {
      const channel = {
        id: channelId(kind, vibrate), name: vibrate ? `${name}, with vibration` : name,
        description: 'Cues while TimeFall is in the background', importance: 4, visibility: 1,
        vibration: vibrate, lights: false,
      };
      if (kind !== 'quiet') channel.sound = SOUND[kind];
      await call('LocalNotifications', 'createChannel', channel);
    }
  }
}

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
  if (c.tone) n.sound = `${SOUND[c.cue]}.wav`;
  if (platform === 'android') n.channelId = channelId(c.tone ? c.cue : 'quiet', c.vibrate);
  return n;
}

// Runs one step at a time, so a quick leave-and-return never interleaves.
// `armed` remembers whether anything was scheduled, so the frequent calls
// from render() cost nothing while the app is in front.
let queue = Promise.resolve(), armed = false;
export const isFloating = () => isNative && document.body.classList.contains('is-floating');

export function syncBackgroundCues(hidden = document.hidden || isFloating()) {
  if (!has('LocalNotifications')) return;
  queue = queue.then(async () => {
    if (armed || hidden) {
      await call('LocalNotifications', 'cancel', { notifications: Object.values(CUE_IDS).map(id => ({ id })) });
      armed = false;
    }
    if (!hidden) {
      // Back in front: a reminder that already fired has done its job; the page shows the same thing.
      await call('LocalNotifications', 'removeAllDeliveredNotifications');
      return;
    }
    const plan = plannedCues(mode, session, settings, Date.now());
    if (!plan.length) return;
    const p = await call('LocalNotifications', 'checkPermissions');
    if (p?.display !== 'granted') return;
    if (platform === 'android') {
      const e = await call('LocalNotifications', 'checkExactNotificationSetting');
      phone.exact = e?.exact_alarm !== 'denied';
    }
    await call('LocalNotifications', 'schedule', { notifications: plan.map(c => toNotification(c, phone.exact)) });
    armed = true;
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
export function setAutoFloat(on) {
  if (!has('Floating')) return;
  call('Floating', 'setAutoEnter', { enabled: !!on }).catch(() => {});
}

/* ---------- Presets and settings arriving by link ---------- */

// The web page offers "Open in the TimeFall app" with the code in the link.
let lastCode = load('lastImport', '');
function importFromUrl(url) {
  const m = /^timefall:\/\/import[^A-Za-z]*(?:code=)?(TF1\.[A-Za-z0-9_-]+)/.exec(url || '');
  if (!m || m[1] === lastCode) return;
  lastCode = m[1];
  save('lastImport', lastCode);
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
