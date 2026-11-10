// What the app says about time: run with `node --test`. Work mode's rule is the
// one that matters most: it never looks like a timer, and the only thing it
// says is "Session finished."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as E from '../js/engine.js';
import * as W from '../js/words.js';

const { MIN } = E;
const T0 = new Date(2026, 10, 1, 14, 0).getTime(); // 2:00 PM local
const CUES = ['half', 'warn', 'finish'];

// Every kind of session Work mode might be showing, at several moments.
function workCases() {
  const cases = [];
  for (const title of ['', 'Notes', 'Room 4, 15 min check']) {
    for (const next of ['', 'Lunch']) {
      for (const kind of ['main', 'extension']) {
        const make = () => E.createSession({ title, next, kind, totalMs: 25 * MIN }, T0);
        cases.push({ s: make(), now: T0 + 5 * MIN });                  // running
        cases.push({ s: make(), now: T0 + 23 * MIN });                 // warning
        const paused = make(); E.pause(paused, T0 + 10 * MIN);
        cases.push({ s: paused, now: T0 + 12 * MIN });                 // paused
        const done = make(); E.finishNow(done, T0 + 25 * MIN);
        cases.push({ s: done, now: T0 + 30 * MIN });                   // finished
      }
    }
  }
  return cases;
}

test('Work mode: the tab is always "Day"', () => {
  assert.equal(W.pageTitle('work', null, T0), 'Day');
  for (const { s, now } of workCases()) assert.equal(W.pageTitle('work', s, now), 'Day');
});

test('Work mode: only the finish has words, and they are "Session finished."', () => {
  for (const { s, now } of workCases()) {
    assert.equal(W.cueWords('work', 'half', s, now), '');
    assert.equal(W.cueWords('work', 'warn', s, now), '');
    assert.equal(W.cueWords('work', 'finish', s, now), 'Session finished.');
  }
});

test('Work mode: the only notification is "Session finished.", with nothing under it', () => {
  for (const { s, now } of workCases()) {
    assert.equal(W.notification('work', 'half', s, now), null);
    assert.equal(W.notification('work', 'warn', s, now), null);
    assert.deepEqual(W.notification('work', 'finish', s, now), { title: 'Session finished.', body: '' });
  }
});

test('Work mode: the picture is a clock to a screen reader, until the private reveal', () => {
  assert.equal(W.faceLabel('work', null, T0), '');
  for (const { s, now } of workCases()) assert.equal(W.faceLabel('work', s, now), 'Clock. Show time left');
});

test('Work mode: nothing it says holds a number or a timer word', () => {
  const said = [];
  for (const { s, now } of workCases()) {
    said.push(W.pageTitle('work', s, now), W.faceLabel('work', s, now));
    for (const cue of CUES) {
      said.push(W.cueWords('work', cue, s, now));
      const n = W.notification('work', cue, s, now);
      if (n) said.push(n.title, n.body);
    }
  }
  for (const text of said) {
    assert.doesNotMatch(text, /\d/, `"${text}" holds a number`);
    assert.doesNotMatch(text, /\b(min|minutes?|hours?|timer|countdown|time's up|wrapping up|halfway)\b/i, `"${text}" sounds like a timer`);
  }
});

test('Full mode: the tab shows the time left and the title', () => {
  const s = E.createSession({ title: 'Notes', next: 'Lunch', totalMs: 25 * MIN }, T0);
  assert.equal(W.pageTitle('full', null, T0), 'TimeFall');
  assert.equal(W.pageTitle('full', s, T0 + 10 * MIN), '15 min · Notes');
  assert.equal(W.pageTitle('simple', E.createSession({ totalMs: 25 * MIN }, T0), T0 + 10 * MIN), '15 min · TimeFall');
  E.pause(s, T0 + 10 * MIN);
  assert.equal(W.pageTitle('full', s, T0 + 12 * MIN), 'Paused · 15 min · Notes');
  E.finishNow(s, T0 + 13 * MIN);
  assert.equal(W.pageTitle('full', s, T0 + 14 * MIN), 'Finished · TimeFall');
});

test('Full mode: cues name the time left, the activity and what comes next', () => {
  const s = E.createSession({ title: 'Notes', next: 'Lunch', totalMs: 25 * MIN }, T0);
  assert.equal(W.cueWords('full', 'half', s, T0 + 12.5 * MIN), 'Halfway through Notes.');
  assert.equal(W.cueWords('full', 'warn', s, T0 + 22 * MIN), '3 min left in Notes. Next: Lunch.');
  assert.equal(W.cueWords('full', 'finish', s, T0 + 25 * MIN), 'Notes is finished. Next: Lunch.');
  const bare = E.createSession({ totalMs: 25 * MIN }, T0);
  assert.equal(W.cueWords('full', 'half', bare, T0), 'Halfway.');
  assert.equal(W.cueWords('full', 'finish', bare, T0), 'Finished.');
});

test('Full mode: notifications at the warning and the finish, and halfway for the phone', () => {
  const s = E.createSession({ title: 'Notes', next: 'Lunch', totalMs: 25 * MIN }, T0);
  assert.deepEqual(W.notification('full', 'half', s, T0 + 12.5 * MIN), { title: 'Halfway through Notes.', body: '' });
  assert.deepEqual(W.notification('full', 'warn', s, T0 + 22 * MIN), { title: '3 min left · Notes', body: 'Then Lunch' });
  assert.deepEqual(W.notification('full', 'finish', s, T0 + 25 * MIN), { title: 'Notes finished', body: 'Next: Lunch' });
  assert.deepEqual(W.notification('full', 'finish', E.createSession({ totalMs: MIN }, T0), T0), { title: 'Session finished', body: '' });
});

test('Full mode: the picture reads the time left and the end time', () => {
  const s = E.createSession({ title: 'Notes', totalMs: 25 * MIN }, T0);
  assert.equal(W.faceLabel('full', s, T0 + 10 * MIN), `15 min left, ends ${W.fmtClock(s.endAt)}`);
  E.pause(s, T0 + 10 * MIN);
  assert.match(W.faceLabel('full', s, T0 + 11 * MIN), /^Paused, 15 min left, ends /);
});

test('time left is worded in plain minutes and hours', () => {
  assert.equal(W.fmtLeft(30_000), 'under a minute');
  assert.equal(W.fmtLeft(61_000), '2 min');
  assert.equal(W.fmtLeft(60 * MIN), '1 h');
  assert.equal(W.fmtLeft(90 * MIN), '1 h 30 min');
});

test('TV view: the private tap never shows the time left on a mirrored screen', () => {
  for (const { s } of workCases()) {
    assert.equal(W.revealAllowed('work', s, true), false);
    assert.equal(W.revealAllowed('work', s, false), true);
    assert.equal(W.faceLabel('work', s, T0, true), 'Clock');
  }
  assert.equal(W.revealAllowed('work', null, false), false);
  assert.equal(W.revealAllowed('full', E.createSession({ totalMs: MIN }, T0), false), false);
});

test('TV view: the stylesheet hides the reveal, the time-left figures and the controls', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  for (const part of ['.reveal', '.figures', '.controls', '.bar', '.next-card']) {
    assert.ok(css.includes(`body.is-tv ${part}`), `styles.css does not hide ${part} in TV view`);
  }
});

test('TV view: the Menu says how to mirror, and what TimeFall cannot do', () => {
  const kinds = ['computer', 'android', 'iphone'];
  assert.equal(new Set(kinds.map(W.tvHint)).size, 3);
  assert.equal(W.tvHint('other'), W.tvHint('computer'));
  for (const text of [...kinds.map(W.tvHint), W.TV_ENTERED]) {
    assert.doesNotMatch(text, /\d|!/, `"${text}" holds a number or an exclamation mark`);
    assert.doesNotMatch(text, /\b(timer|countdown|time's up|wrapping up)\b/i);
  }
  for (const kind of kinds) {
    assert.match(W.tvHint(kind), /can’t start the mirroring itself/);
    assert.match(W.tvHint(kind), /keep TimeFall open/);
  }
});
