// The faces' clock marks and how often they are drawn: run with `node --test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MIN } from '../js/engine.js';
import { clockMarks, redrawGap, faceFor, FACES } from '../js/faces.js';

const UTC = Date.UTC(2026, 10, 2, 14, 3); // 14:03 UTC
const local = (t, tz) => ((t - tz * MIN) % (24 * 60 * MIN) + 24 * 60 * MIN) % (24 * 60 * MIN) / MIN; // minutes past local midnight
const stepOf = marks => marks[1].t - marks[0].t;

test('marks get coarser as the span grows, at most about the number asked for', () => {
  const cases = [[8, 1], [25, 5], [50, 5], [90, 10], [150, 15], [300, 30], [600, 60], [1100, 120], [2400, 240]];
  for (const [minutes, step] of cases) {
    const marks = clockMarks(UTC, UTC + minutes * MIN, 10, 0);
    assert.equal(stepOf(marks) / MIN, step, `${minutes} minutes`);
    assert.ok(marks.length <= 11, `${minutes} minutes gave ${marks.length} marks`);
  }
});

test('marks fall on whole clock steps in any time zone, including half-hour ones', () => {
  // UTC, India (+5:30), US Pacific (−8), Newfoundland (−3:30)
  for (const tz of [0, -330, 480, 210]) {
    for (const minutes of [25, 90, 600]) {
      const marks = clockMarks(UTC, UTC + minutes * MIN, 10, tz);
      const step = stepOf(marks) / MIN;
      for (const { t } of marks) assert.equal(local(t, tz) % step, 0, `tz ${tz}, ${minutes} min: mark at ${local(t, tz)}`);
    }
  }
});

test('long marks sit on the quarter hour, the half hour for 2- and 10-minute steps, the hour for coarse ones', () => {
  // Which minutes past the hour carry long marks, for a span starting at 14:03 UTC.
  const longAt = minutes => {
    const marks = clockMarks(UTC, UTC + minutes * MIN, 10, 0);
    return { step: stepOf(marks) / MIN, at: [...new Set(marks.filter(m => m.long).map(m => local(m.t, 0) % 60))].sort((a, b) => a - b) };
  };
  assert.deepEqual(longAt(50), { step: 5, at: [15, 30, 45] });   // 14:03–14:53
  assert.deepEqual(longAt(40), { step: 5, at: [15, 30] });       // 14:03–14:43
  assert.deepEqual(longAt(90), { step: 10, at: [0, 30] });
  assert.deepEqual(longAt(150), { step: 15, at: [0] });
  // 2-minute marks miss the quarters, so only the half hour is long.
  const two = clockMarks(Date.UTC(2026, 10, 2, 14, 20), Date.UTC(2026, 10, 2, 14, 38), 10, 0);
  assert.equal(stepOf(two), 2 * MIN);
  assert.deepEqual(two.filter(m => m.long).map(m => local(m.t, 0) % 60), [30]);
});

test('both ends are included when they fall on a mark', () => {
  const from = Date.UTC(2026, 10, 2, 14, 0), to = from + 30 * MIN;
  const marks = clockMarks(from, to, 10, 0);
  assert.equal(marks[0].t, from);
  assert.equal(marks.at(-1).t, to);
});

test('a long session is drawn about once a second, a short one smoothly', () => {
  const running = totalMs => redrawGap({ totalMs, stage: 'running', paused: false, frac: 0.5 }, false);
  assert.equal(running(60 * MIN), 1000);
  assert.equal(running(25 * MIN), 750);
  assert.equal(running(5 * MIN), 150);
  assert.equal(running(1 * MIN), 80);
});

test('the last stretch and anything settling are drawn smoothly; a pause barely at all', () => {
  const s = { totalMs: 25 * MIN, stage: 'running', paused: false, frac: 0.5 };
  assert.equal(redrawGap({ ...s, stage: 'warning' }, false), 80);
  assert.equal(redrawGap(s, true), 80);
  assert.equal(redrawGap({ ...s, paused: true }, false), 1000);
  assert.equal(redrawGap({ ...s, paused: true }, true), 80);
});

test('the first 3% and last 5% of a session are drawn smoothly, where the level and disc move fastest', () => {
  const at = frac => redrawGap({ totalMs: 25 * MIN, stage: 'running', paused: false, frac }, false);
  assert.equal(at(1), 80);      // just started: the level drops fast across the narrow top of its dial
  assert.equal(at(0.975), 80);
  assert.equal(at(0.96), 750);
  assert.equal(at(0.06), 750);
  assert.equal(at(0.04), 80);   // with no warning stage, the disc shrinks fast near its centre
  assert.equal(redrawGap({ totalMs: 25 * MIN, stage: 'running', paused: true, frac: 1 }, false), 1000);
});

test('Work mode never shows the disc or the ruler, whatever was saved', () => {
  for (const saved of [undefined, 'disc', 'ruler', 'planner', 'level', 'sun', 'nonsense']) {
    const face = faceFor('work', { face: saved, fullFace: saved });
    assert.ok(FACES.work.includes(face), `${saved} gave ${face}`);
    assert.ok(face !== 'disc' && face !== 'ruler');
  }
  assert.equal(faceFor('work', {}), 'planner');
});

test('Full mode keeps its own choice; Simple always has the disc', () => {
  assert.equal(faceFor('full', { face: 'sun', fullFace: 'ruler' }), 'ruler');
  assert.equal(faceFor('full', {}), 'disc');
  assert.equal(faceFor('simple', { face: 'sun', fullFace: 'ruler' }), 'disc');
});
