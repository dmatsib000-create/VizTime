// What the phone says while TimeFall is in the background: the notifications
// to schedule from a session's timestamps, so a cue arrives on time with the
// app closed or the phone locked. Pure, with `now` as a parameter, so
// tests/cues.test.js can hold Work mode to its rule: it schedules nothing but
// "Session finished." The shells turn these into local notifications
// (js/native.js) and cancel them whenever the app comes back to the front.
// `phoneCarriesCues` says when the page must stay quiet because one of these
// reminders will sound instead.

import * as E from './engine.js';
import { notification } from './words.js';

// Fixed ids, so the shells cancel exactly these before scheduling again.
export const CUE_IDS = { half: 1, warn: 2, finish: 3 };

// Whether the phone's reminder, rather than the page, carries a cue's tone,
// vibration and voice. It does in Android's floating window (a swipe that
// closes the window ends the app before the page could schedule anything, so
// the reminders are set while it floats), and on an iPhone whose page is kept
// running out of sight by its floating picture, once its reminders are
// scheduled (`armed`). With nothing scheduled the page plays the cue itself,
// so a cue is never lost, and in front the page always plays its own.
export const phoneCarriesCues = ({ floating = false, hidden = false, armed = false } = {}) => !!floating || (!!hidden && !!armed);

// What to change on the phone while TimeFall is out of sight, given the
// reminders it holds (`held`: cue id → the planned cue it was given) and the
// plan for now. A reminder still wanted as it is stays untouched, so a call
// that changes nothing costs nothing. One whose moment has come is left to
// arrive, wanted or not: the page, still drawing in Android's floating
// window, can reach that moment a little before the phone does, and taking
// the reminder back then would lose it. Any other is taken back. Returns the
// ids to cancel, the cues to schedule, and the held reminders that stay.
export function reconcileCues(held, plan, now) {
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const cancel = [], kept = {};
  for (const [id, was] of Object.entries(held)) {
    const want = plan.find(c => c.id === Number(id));
    if (want && same(want, was)) kept[id] = was;
    else if (was.at > now) cancel.push(Number(id));
  }
  return { cancel, schedule: plan.filter(c => !kept[c.id]), kept };
}

// The cues still to come, each with the words it will show and whether it
// carries a tone or a vibration. Nothing is planned for a paused or finished
// session, for a cue already played, or for a moment already past: a cue
// whose time passed is never played late.
export function plannedCues(mode, s, settings, now) {
  if (!s || s.finishedAt || s.pausedAt || !settings.notify) return [];
  const out = [];
  for (const cue of Object.keys(CUE_IDS)) {
    if (s.fired[cue]) continue;
    const at = E.cueTime(s, cue);
    if (at <= now) continue;
    const tone = !!settings.cues[cue]?.sound;
    // Halfway is a tone, not a reminder: without its tone there is nothing to show.
    if (cue === 'half' && !tone) continue;
    const words = notification(mode, cue, s, at);
    if (!words) continue;
    out.push({ id: CUE_IDS[cue], cue, at, title: words.title, body: words.body, tone, vibrate: !!settings.vibrate });
  }
  return out;
}
