// Saved data lives in localStorage under one prefix, because every GitHub Pages
// project on the same account shares a single origin. The prefix keeps its old
// name on purpose: it is what the presets and settings saved under VizTime are
// filed under, and renaming it would hide them.
const PREFIX = 'viztime2:';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    if (value == null) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch { /* storage full or blocked: the app keeps working for this visit */ }
}

// Where-I-left-off notes are keyed by activity name, ignoring case and spacing.
export const noteKey = title => (title || '').trim().replace(/\s+/g, ' ').toLowerCase();

export function getNote(title) {
  const k = noteKey(title);
  return k ? load('notes', {})[k] || null : null;
}

export function setNote(title, text) {
  const k = noteKey(title);
  if (!k) return;
  const notes = load('notes', {});
  if (text && text.trim()) notes[k] = { text: text.trim(), at: Date.now() };
  else delete notes[k];
  save('notes', notes);
}

/* ---------- Carrying data to another device ---------- */

// Everything worth taking along, as one code: settings, presets, notes and
// saved lengths. The running session stays behind; it belongs to the clock it
// was started on. The code is plain text, so it can be copied, pasted or sent
// in a link to the TimeFall app.
const CARRIED = ['settings', 'presets', 'notes', 'lengths'];
const CODE_PREFIX = 'TF1.';

export function packCode(now = Date.now()) {
  const data = { v: 1, at: now };
  for (const key of CARRIED) {
    const value = load(key, null);
    if (value != null) data[key] = value;
  }
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return CODE_PREFIX + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Reads a code back, or throws if it isn't one.
export function unpackCode(text) {
  const body = (text || '').replace(/\s+/g, '');
  if (!body.startsWith(CODE_PREFIX)) throw new Error('not a TimeFall code');
  const b64 = body.slice(CODE_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const data = JSON.parse(new TextDecoder().decode(bytes));
  if (!data || typeof data !== 'object' || data.v !== 1) throw new Error('unknown code');
  return data;
}

// Settings that belong to the device, not the person: a phone's reminders and
// vibration, and the iPhone's Silent mode choice. A code never changes them.
const DEVICE_SETTINGS = ['notify', 'vibrate', 'autoFloat', 'silentTones'];

// Brings a code's data in beside what is here. Presets are added (one already
// here, by id, is left alone), the newer of two notes wins, saved lengths are
// merged, and settings are replaced, except the device's own. Returns what came in.
export function importData(data) {
  const presets = load('presets', []);
  const have = new Set(presets.map(p => p.id));
  const added = (data.presets || []).filter(p => p && p.id && !have.has(p.id));
  if (added.length) save('presets', [...presets, ...added]);
  const notes = load('notes', {});
  let newNotes = 0;
  for (const [k, n] of Object.entries(data.notes || {})) {
    if (n && n.text && (!notes[k] || (n.at || 0) > (notes[k].at || 0))) { notes[k] = n; newNotes++; }
  }
  if (newNotes) save('notes', notes);
  if (data.lengths) save('lengths', { ...load('lengths', {}), ...data.lengths });
  if (data.settings) {
    const here = load('settings', {});
    const next = { ...data.settings };
    for (const k of DEVICE_SETTINGS) { if (k in here) next[k] = here[k]; else delete next[k]; }
    save('settings', next);
  }
  return { presets: added.length, notes: newNotes, settings: !!data.settings };
}
