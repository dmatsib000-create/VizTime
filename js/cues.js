// What the phone says while TimeFall is in the background: the notifications
// to schedule from a session's timestamps, so a cue arrives on time with the
// app closed or the phone locked. Pure, with `now` as a parameter, so
// tests/cues.test.js can hold Work mode to its rule: it schedules nothing but
// "Session finished." The shells turn these into local notifications
// (js/native.js) and cancel them whenever the app comes back to the front.

import * as E from './engine.js';
import { notification } from './words.js';

// Fixed ids, so the shells cancel exactly these before scheduling again.
export const CUE_IDS = { half: 1, warn: 2, finish: 3 };

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
