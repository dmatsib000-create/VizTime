// The state every part of the page shares: settings, the mode, and the session.

import * as E from './engine.js';
import { load, save } from './store.js';

/* ---------- Settings ---------- */

export const BUNDLES = {
  quiet: {
    cues: { half: { sound: false, speak: false }, warn: { sound: false, speak: false }, finish: { sound: false, speak: false } },
    warmth: 'subtle', breathe: false,
  },
  balanced: {
    cues: { half: { sound: false, speak: false }, warn: { sound: true, speak: false }, finish: { sound: true, speak: false } },
    warmth: 'normal', breathe: false,
  },
  noticeable: {
    cues: { half: { sound: true, speak: false }, warn: { sound: true, speak: true }, finish: { sound: true, speak: true } },
    warmth: 'strong', breathe: true,
  },
};

export const clone = o => JSON.parse(JSON.stringify(o));
const DEFAULTS = {
  defaultMode: 'full', face: 'planner', fullFace: 'disc', bundle: 'balanced', ...clone(BUNDLES.balanced),
  volume: 0.6, flash: false, wake: true, notify: false, rememberLengths: false, silentTones: false,
};
const stored = load('settings', {});
export const settings = { ...clone(DEFAULTS), ...stored, cues: { ...clone(DEFAULTS.cues), ...(stored.cues || {}) } };
export const saveSettings = () => save('settings', settings);

/* ---------- State ---------- */

// Other modules read `mode` and `session` as live bindings; only the setters
// below replace them.
export let mode = settings.defaultMode;     // for this visit only
export let session = load('session', null);  // the running or just-finished session
if (session) { E.settle(session); persist(); }

export function setMode(next) { mode = next; }
export function setSession(next) { session = next; }
export function persist() { save('session', session); }
