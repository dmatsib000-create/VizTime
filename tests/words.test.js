// What the app says about time: run with `node --test`. Work mode's rule is the
// one that matters most: it never looks like a timer, and the only thing it
// says is "Session finished."
import { test } from 'node:test';
import assert from 'node:assert/strict';
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

const TIMER_WORDS = /\b(min|minutes?|hours?|timer|countdown|time's up|wrapping up|halfway)\b/i;

test('Work mode: nothing it says holds a number or a timer word', () => {
  const said = [];
  for (const { s, now } of workCases()) {
    said.push(W.pageTitle('work', s, now), W.faceLabel('work', s, now));
    // The screens' own words: the running title, the finish screen, the
    // floating window and the floating picture's line. These show the
    // person's own title and next entry, which may hold numbers of their own
    // ("Room 4"), so only what the app adds around them is checked.
    const own = text => [s.title, s.next].filter(Boolean).reduce((t, w) => t.replaceAll(w, ''), text);
    const landing = W.landingText('work', s);
    const float = W.floatText('work', s, now);
    said.push(...[W.sessionTitle('work', s), W.videoLine('work', s), landing.label, landing.title, float.next, float.fig].map(own));
    if (s.title || s.finishedAt) said.push(own(float.title));
    else assert.equal(float.title, W.fmtClock(now), 'an untitled session floats under the clock');
    for (const cue of CUES) {
      said.push(W.cueWords('work', cue, s, now));
      const n = W.notification('work', cue, s, now);
      if (n) said.push(n.title, n.body);
    }
  }
  for (const text of said) {
    assert.doesNotMatch(text, /\d/, `"${text}" holds a number`);
    assert.doesNotMatch(text, TIMER_WORDS, `"${text}" sounds like a timer`);
  }
});

test('Work mode: the running screen writes no figures at all', () => {
  for (const { s, now } of workCases()) assert.equal(W.runFigures('work', s, now), null);
});

test('Work mode: presets show no length, and an untitled one is just "Session"', () => {
  assert.equal(W.presetName('work', { title: '', minutes: 25 }), 'Session');
  assert.equal(W.presetName('work', { title: 'Notes', minutes: 25 }), 'Notes');
  assert.equal(W.presetLength('work', { title: 'Notes', minutes: 25 }), null);
});

test('Work mode: lengths are shown only as clock times, never as durations', () => {
  const now = T0;
  const s = E.createSession({ title: 'Notes', next: 'Lunch', totalMs: 25 * MIN }, now);
  const expected = [
    [W.startLabel('work', 'Lunch', 25, now), `Start Lunch · until ${W.fmtShort(now + 25 * MIN)}`],
    [W.exactHint('work', 40, now), `Ends at ${W.fmtClock(now + 40 * MIN)}.`],
    [W.untilHint('work', 40 * MIN, now), `Ends at ${W.fmtClock(now + 40 * MIN)}.`],
    [W.scheduleTimes(s, now).current, `${W.fmtShort(now)}–${W.fmtShort(now + 25 * MIN)}`],
  ];
  for (const [said, want] of expected) {
    assert.equal(said, want);
    assert.doesNotMatch(said, TIMER_WORDS, `"${said}" sounds like a timer`);
  }
  assert.equal(W.exactHint('work', 0, now), '');
  assert.equal(W.untilHint('work', 30_000, now), 'That leaves no time. Choose a later time.');
});

test('Work mode: the floating window shows the time left only during the private reveal', () => {
  const s = E.createSession({ title: 'Notes', totalMs: 25 * MIN }, T0);
  assert.equal(W.floatText('work', s, T0 + 5 * MIN).fig, '');
  assert.equal(W.floatText('work', s, T0 + 5 * MIN, true).fig, '20 min');
});

test('Full mode: the screens name the time left and the end, which moves on while paused', () => {
  const s = E.createSession({ title: 'Notes', next: 'Lunch', totalMs: 25 * MIN }, T0);
  assert.deepEqual(W.runFigures('full', s, T0 + 5 * MIN), { paused: false, left: '20 min', ends: W.fmtClock(T0 + 25 * MIN) });
  E.pause(s, T0 + 5 * MIN);
  const paused = W.runFigures('full', s, T0 + 15 * MIN);
  assert.equal(paused.paused, true);
  assert.equal(paused.ends, W.fmtClock(T0 + 35 * MIN));
  assert.equal(W.floatText('full', s, T0 + 15 * MIN).fig, `20 min · ends ${W.fmtClock(T0 + 35 * MIN)}`);
  assert.equal(W.scheduleTimes(s, T0 + 15 * MIN).next, W.fmtShort(T0 + 35 * MIN));
  assert.equal(W.sessionTitle('full', { title: '', totalMs: 25 * MIN }), '25 minutes');
  assert.equal(W.startLabel('full', 'Lunch', 25, T0), 'Start Lunch · 25 min');
  assert.equal(W.presetLength('full', { minutes: 25 }), '25 min');
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

test('Work mode: the private reveal lasts four seconds', () => {
  assert.equal(W.REVEAL_MS, 4000);
});
