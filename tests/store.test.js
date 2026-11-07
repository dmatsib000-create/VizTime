// Saved data and where-I-left-off notes: run with `node --test`.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { load, save, noteKey, getNote, setNote, packCode, unpackCode, importData } from '../js/store.js';

// A stand-in for the browser's localStorage.
const items = new Map();
globalThis.localStorage = {
  getItem: k => (items.has(k) ? items.get(k) : null),
  setItem: (k, v) => items.set(k, String(v)),
  removeItem: k => items.delete(k),
};
beforeEach(() => items.clear());

test('values round-trip under the app prefix', () => {
  save('presets', [{ minutes: 25 }]);
  assert.deepEqual(load('presets', []), [{ minutes: 25 }]);
  assert.ok(items.has('viztime2:presets'));
});

test('saving null removes the value', () => {
  save('session', { id: 'a' });
  save('session', null);
  assert.equal(load('session', 'none'), 'none');
});

test('unreadable data falls back instead of breaking the app', () => {
  items.set('viztime2:settings', '{not json');
  assert.deepEqual(load('settings', {}), {});
});

test('activity names match regardless of case and spacing', () => {
  assert.equal(noteKey('  Clinic   Notes '), 'clinic notes');
  assert.equal(noteKey(''), '');
});

test('a note saved for an activity comes back for the same activity', () => {
  setNote('Clinic notes', '  Halfway through the letter ');
  assert.equal(getNote('clinic  NOTES').text, 'Halfway through the letter');
});

test('clearing a note removes it, and untitled sessions keep none', () => {
  setNote('Lunch', 'Sandwich');
  setNote('Lunch', '   ');
  assert.equal(getNote('Lunch'), null);
  setNote('', 'ignored');
  assert.equal(getNote(''), null);
});

test('a code carries settings, presets, notes and lengths, and nothing else', () => {
  save('settings', { bundle: 'quiet', volume: 0.3 });
  save('presets', [{ id: 'a', title: 'Notes', minutes: 25 }]);
  setNote('Notes', 'Page 4');
  save('lengths', { notes: 30 });
  save('session', { id: 'live' });
  const code = packCode(1000);
  assert.match(code, /^TF1\.[A-Za-z0-9_-]+$/);
  const data = unpackCode(` ${code.slice(0, 10)}\n${code.slice(10)} `);
  assert.deepEqual(Object.keys(data).sort(), ['at', 'lengths', 'notes', 'presets', 'settings', 'v']);
  assert.deepEqual(data.presets, [{ id: 'a', title: 'Notes', minutes: 25 }]);
  assert.equal(data.notes.notes.text, 'Page 4');
});

test('a code survives any characters in a title', () => {
  save('presets', [{ id: 'b', title: 'Café ☕ “quotes” — dash', minutes: 10 }]);
  assert.equal(unpackCode(packCode()).presets[0].title, 'Café ☕ “quotes” — dash');
});

test('bringing a code in adds presets and notes beside what is here, and replaces settings', () => {
  save('presets', [{ id: 'a', title: 'Here', minutes: 25 }]);
  save('notes', { notes: { text: 'Old', at: 1 }, lunch: { text: 'Mine', at: 9 } });
  save('lengths', { here: 25 });
  save('settings', { volume: 1, notify: false });
  const result = importData({
    v: 1,
    presets: [{ id: 'a', title: 'Same id, ignored', minutes: 5 }, { id: 'b', title: 'New', minutes: 10 }],
    notes: { notes: { text: 'Newer', at: 2 }, lunch: { text: 'Older', at: 3 }, walk: { text: 'Added', at: 4 } },
    lengths: { there: 40 },
    settings: { volume: 0.5, notify: true, vibrate: true },
  });
  assert.deepEqual(result, { presets: 1, notes: 2, settings: true });
  assert.deepEqual(load('presets', []).map(p => p.title), ['Here', 'New']);
  assert.deepEqual(load('notes', {}), { notes: { text: 'Newer', at: 2 }, lunch: { text: 'Mine', at: 9 }, walk: { text: 'Added', at: 4 } });
  assert.deepEqual(load('lengths', {}), { here: 25, there: 40 });
  // Reminders and vibration belong to the device, so the code leaves them alone.
  assert.deepEqual(load('settings', {}), { volume: 0.5, notify: false });
});

test('text that is not a code is refused', () => {
  assert.throws(() => unpackCode('hello'));
  assert.throws(() => unpackCode('TF1.!!!'));
  assert.throws(() => unpackCode(''));
});
