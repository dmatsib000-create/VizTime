// The timer model. A session is plain data stored as wall-clock timestamps, so it
// survives closing the app and resumes from its real end time.

export const MIN = 60_000;
// The longest session any length field accepts.
export const MAX_MINUTES = 600;

// A cue may play a little late while the page is alive but throttled in the
// background (Chrome wakes hidden tabs about once a minute). Anything later
// than this is marked done silently: a missed cue is never played on reopen.
const LATE_LIMIT = 75_000;

export function autoWarning(totalMs) {
  const w = Math.min(10 * MIN, Math.max(2 * MIN, totalMs * 0.15));
  return Math.min(w, totalMs / 2);
}

// Length of a session that ends `bufferMin` before the clock time `hhmm`
// ("14:30"). A time already past today is read as after midnight when that is
// within half a day, so 00:15 typed at 23:50 means 25 minutes, while 11:00
// typed at 11:50 stays in the past (and is rejected by the caller).
export function untilMs(hhmm, bufferMin = 0, now = Date.now()) {
  const [h, m] = hhmm.split(':').map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  if (target.getTime() <= now) {
    const tomorrow = new Date(target);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (tomorrow.getTime() - now <= 12 * 60 * MIN) target.setTime(tomorrow.getTime());
  }
  return target.getTime() - bufferMin * MIN - now;
}

export function createSession({ title = '', next = '', step = '', totalMs, warnMs, kind = 'main' }, now = Date.now()) {
  const s = {
    id: now.toString(36),
    title: title.trim(), next: next.trim(), step: step.trim(),
    kind, totalMs, warnMs: warnMs ?? autoWarning(totalMs), autoWarn: warnMs == null,
    endAt: now + totalMs, pausedAt: null, finishedAt: null, fired: {},
  };
  settle(s, now);
  return s;
}

export const remaining = (s, now = Date.now()) =>
  s.finishedAt ? 0 : Math.max(0, s.endAt - (s.pausedAt ?? now));

export const fraction = (s, now) => Math.min(1, remaining(s, now) / s.totalMs);

export function stage(s, now = Date.now()) {
  const r = remaining(s, now);
  if (s.finishedAt || r <= 0) return 'finished';
  return r <= s.warnMs ? 'warning' : 'running';
}

// 0 at the start of the warning stage, 1 at the end.
export function warnProgress(s, now) {
  if (stage(s, now) === 'running') return 0;
  return Math.min(1, 1 - remaining(s, now) / s.warnMs);
}

// When each cue is due, as remaining time.
const CUE_AT = { half: s => s.totalMs / 2, warn: s => s.warnMs, finish: () => 0 };
// The same, as a timestamp on the session's own clock. The shells schedule
// their reminders from it (js/cues.js).
export const cueTime = (s, cue) => s.endAt - CUE_AT[cue](s);

export function pause(s, now = Date.now()) {
  if (!s.pausedAt && !s.finishedAt) s.pausedAt = now;
}

export function resume(s, now = Date.now()) {
  if (!s.pausedAt) return;
  s.endAt += now - s.pausedAt;
  s.pausedAt = null;
}

// Add (positive) or take away (negative) time. Taking away more than is left
// finishes quietly. Cues the change jumps past are marked done without playing;
// cues the change moves back into the future are re-armed.
export function adjust(s, deltaMs, now = Date.now()) {
  if (s.finishedAt) return;
  const left = remaining(s, now);
  const delta = Math.max(deltaMs, -left);
  s.endAt += delta;
  s.totalMs = Math.max(MIN / 2, s.totalMs + delta);
  // Changing the length rescales an automatic warning, so a corrected session
  // behaves as if it had been set to the right length from the start.
  if (s.autoWarn) s.warnMs = autoWarning(s.totalMs);
  const r = remaining(s, now);
  for (const cue of Object.keys(CUE_AT)) s.fired[cue] = r <= CUE_AT[cue](s);
  if (r <= 0) { s.finishedAt = now; s.pausedAt = null; }
}

export function finishNow(s, now = Date.now()) {
  if (s.finishedAt) return;
  s.finishedAt = now;
  s.pausedAt = null;
  for (const cue of Object.keys(CUE_AT)) s.fired[cue] = true;
}

// On load: anything already due is settled silently, and a session whose end
// passed while the app was closed lands directly in the finished state.
export function settle(s, now = Date.now()) {
  const r = remaining(s, now);
  for (const cue of Object.keys(CUE_AT)) if (r <= CUE_AT[cue](s)) s.fired[cue] = true;
  if (r <= 0 && !s.finishedAt) s.finishedAt = s.pausedAt ?? s.endAt;
}

// Called on every tick while the page is alive. Returns the cues that came due
// recently enough to play, and marks every due cue as fired.
export function dueCues(s, now = Date.now()) {
  if (s.pausedAt || (s.finishedAt && s.fired.finish)) return [];
  const r = remaining(s, now);
  const out = [];
  for (const cue of Object.keys(CUE_AT)) {
    const at = CUE_AT[cue](s);
    if (s.fired[cue] || r > at) continue;
    s.fired[cue] = true;
    const late = (s.endAt - at) <= now ? now - (s.endAt - at) : 0;
    if (late <= LATE_LIMIT) out.push(cue);
  }
  if (r <= 0 && !s.finishedAt) s.finishedAt = s.endAt;
  // Only the most important of several simultaneous cues plays.
  if (out.includes('finish')) return ['finish'];
  if (out.includes('warn')) return ['warn'];
  return out;
}
