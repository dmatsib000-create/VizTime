// The reminders the phone schedules while TimeFall is in the background: run
// with `node --test`. Work mode's rule matters most here too: it schedules
// nothing but "Session finished."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import { plannedCues, reconcileCues, CUE_IDS, phoneCarriesCues } from '../js/cues.js';

const { MIN } = E;
const T0 = new Date(2026, 10, 1, 14, 0).getTime(); // 2:00 PM local
const balanced = { half: { sound: false }, warn: { sound: true }, finish: { sound: true } };
const settings = (over = {}) => ({ notify: true, vibrate: false, cues: balanced, ...over });

test('the warning and the finish are planned at their moments, with their words', () => {
  const s = E.createSession({ title: 'Notes', next: 'Lunch', totalMs: 25 * MIN }, T0);
  const plan = plannedCues('full', s, settings(), T0 + MIN);
  assert.deepEqual(plan.map(c => c.cue), ['warn', 'finish']);
  assert.deepEqual(plan.map(c => c.id), [CUE_IDS.warn, CUE_IDS.finish]);
  assert.equal(plan[0].at, s.endAt - s.warnMs);
  assert.equal(plan[1].at, s.endAt);
  assert.deepEqual([plan[0].title, plan[0].body], ['4 min left · Notes', 'Then Lunch']);
  assert.deepEqual([plan[1].title, plan[1].body], ['Notes finished', 'Next: Lunch']);
  assert.ok(plan.every(c => c.tone && !c.vibrate));
});

test('halfway is planned only when its tone is on', () => {
  const s = E.createSession({ title: 'Notes', totalMs: 20 * MIN }, T0);
  assert.equal(plannedCues('full', s, settings(), T0).some(c => c.cue === 'half'), false);
  const loud = settings({ cues: { ...balanced, half: { sound: true } } });
  const half = plannedCues('full', s, loud, T0).find(c => c.cue === 'half');
  assert.equal(half.at, T0 + 10 * MIN);
  assert.deepEqual([half.title, half.body], ['Halfway through Notes.', '']);
});

test('a cue without its tone is still shown, quietly; vibration follows the setting', () => {
  const s = E.createSession({ totalMs: 25 * MIN }, T0);
  const quiet = settings({ vibrate: true, cues: { half: { sound: false }, warn: { sound: false }, finish: { sound: false } } });
  const plan = plannedCues('simple', s, quiet, T0);
  assert.deepEqual(plan.map(c => c.cue), ['warn', 'finish']);
  assert.ok(plan.every(c => !c.tone && c.vibrate));
});

test('nothing is planned when reminders are off, or the session is paused or finished', () => {
  const s = E.createSession({ totalMs: 25 * MIN }, T0);
  assert.deepEqual(plannedCues('full', s, settings({ notify: false }), T0), []);
  assert.deepEqual(plannedCues('full', null, settings(), T0), []);
  const paused = E.createSession({ totalMs: 25 * MIN }, T0);
  E.pause(paused, T0 + MIN);
  assert.deepEqual(plannedCues('full', paused, settings(), T0 + 2 * MIN), []);
  const done = E.createSession({ totalMs: 25 * MIN }, T0);
  E.finishNow(done, T0 + MIN);
  assert.deepEqual(plannedCues('full', done, settings(), T0 + 2 * MIN), []);
});

test('a cue already played, or whose moment has passed, is never planned', () => {
  const s = E.createSession({ totalMs: 25 * MIN }, T0);
  const late = T0 + 25 * MIN - s.warnMs + 1000; // just past the warning
  assert.deepEqual(plannedCues('full', s, settings(), late).map(c => c.cue), ['finish']);
  s.fired.warn = true;
  assert.deepEqual(plannedCues('full', s, settings(), T0).map(c => c.cue), ['finish']);
  s.fired.finish = true;
  assert.deepEqual(plannedCues('full', s, settings(), T0), []);
});

test('Work mode: only "Session finished.", with nothing under it, whatever the tones', () => {
  const loud = settings({ vibrate: true, cues: { half: { sound: true }, warn: { sound: true }, finish: { sound: true } } });
  for (const title of ['', 'Notes', 'Room 4, 15 min check']) {
    for (const next of ['', 'Lunch']) {
      const s = E.createSession({ title, next, totalMs: 25 * MIN }, T0);
      const plan = plannedCues('work', s, loud, T0);
      assert.equal(plan.length, 1);
      assert.equal(plan[0].cue, 'finish');
      assert.equal(plan[0].at, s.endAt);
      assert.deepEqual([plan[0].title, plan[0].body], ['Session finished.', '']);
      assert.doesNotMatch(plan[0].title + plan[0].body, /\d|timer|min/i);
    }
  }
});

test('the page stays quiet only where a reminder will sound instead', () => {
  // Android's floating window: the phone carries the cue, whatever else is true.
  assert.equal(phoneCarriesCues({ floating: true }), true);
  // An iPhone out of sight with its picture floating: only once reminders are scheduled.
  assert.equal(phoneCarriesCues({ hidden: true, armed: true }), true);
  assert.equal(phoneCarriesCues({ hidden: true, armed: false }), false);
  // In front, the page plays its own cues, scheduled reminders or not.
  assert.equal(phoneCarriesCues({ hidden: false, armed: true }), false);
  assert.equal(phoneCarriesCues(), false);
});

/* ---------- What changes on the phone (reconcileCues) ---------- */

const heldFrom = plan => Object.fromEntries(plan.map(c => [c.id, c]));

test('nothing held: the whole plan is scheduled, nothing cancelled', () => {
  const s = E.createSession({ title: 'Notes', totalMs: 25 * MIN }, T0);
  const plan = plannedCues('full', s, settings(), T0);
  const r = reconcileCues({}, plan, T0);
  assert.deepEqual(r.cancel, []);
  assert.deepEqual(r.schedule, plan);
  assert.deepEqual(r.kept, {});
});

test('the same plan again changes nothing on the phone', () => {
  const s = E.createSession({ title: 'Notes', totalMs: 25 * MIN }, T0);
  const plan = plannedCues('full', s, settings(), T0);
  const r = reconcileCues(heldFrom(plan), plannedCues('full', s, settings(), T0 + MIN), T0 + MIN);
  assert.deepEqual(r.cancel, []);
  assert.deepEqual(r.schedule, []);
  assert.deepEqual(Object.keys(r.kept).map(Number), plan.map(c => c.id));
});

test('a reminder whose moment has come is never taken back, even once the plan drops it', () => {
  // The floating page reaches the finish a moment before the phone does.
  const s = E.createSession({ title: 'Notes', totalMs: 25 * MIN }, T0);
  const held = heldFrom(plannedCues('full', s, settings(), T0));
  E.settle(s, s.endAt);
  const r = reconcileCues(held, plannedCues('full', s, settings(), s.endAt), s.endAt);
  assert.deepEqual(r.cancel, []);
  assert.deepEqual(r.schedule, []);
});

test('stopping or pausing takes back the reminders still to come', () => {
  const s = E.createSession({ title: 'Notes', totalMs: 25 * MIN }, T0);
  const held = heldFrom(plannedCues('full', s, settings(), T0));
  const stopped = reconcileCues(held, [], T0 + MIN);
  assert.deepEqual(stopped.cancel.sort(), [CUE_IDS.warn, CUE_IDS.finish]);
  assert.deepEqual(stopped.kept, {});
  E.pause(s, T0 + MIN);
  assert.deepEqual(reconcileCues(held, plannedCues('full', s, settings(), T0 + MIN), T0 + MIN).cancel.sort(), [CUE_IDS.warn, CUE_IDS.finish]);
});

test('adding time moves the reminders: the old ones are taken back and the new ones set', () => {
  const s = E.createSession({ title: 'Notes', totalMs: 25 * MIN }, T0);
  const held = heldFrom(plannedCues('full', s, settings(), T0));
  E.adjust(s, 5 * MIN, T0 + MIN);
  const plan = plannedCues('full', s, settings(), T0 + MIN);
  const r = reconcileCues(held, plan, T0 + MIN);
  assert.deepEqual(r.cancel.sort(), [CUE_IDS.warn, CUE_IDS.finish]);
  assert.deepEqual(r.schedule, plan);
  assert.equal(r.schedule.find(c => c.cue === 'finish').at, s.endAt);
});

test('a warning already sounded is not taken back when added time sets it up again', () => {
  const s = E.createSession({ title: 'Notes', totalMs: 25 * MIN }, T0);
  const held = heldFrom(plannedCues('full', s, settings(), T0));
  const afterWarn = s.endAt - s.warnMs + 1000;
  E.settle(s, afterWarn);
  E.adjust(s, MIN, afterWarn); // the warning moves back into the future, so it is re-armed
  const plan = plannedCues('full', s, settings(), afterWarn);
  const r = reconcileCues(held, plan, afterWarn);
  assert.deepEqual(r.cancel, [CUE_IDS.finish]); // the old warning has already arrived
  assert.deepEqual(r.schedule.map(c => c.cue), ['warn', 'finish']);
  assert.equal(r.schedule[0].at, s.endAt - s.warnMs);
});
