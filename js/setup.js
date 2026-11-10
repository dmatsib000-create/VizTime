// The setup screens: the full and work form, presets, and the simple chips.

import * as E from './engine.js';
import { load, save, getNote } from './store.js';
import { mode } from './state.js';
import { $, fmtClock, fmtShort, toast } from './ui.js';
import { exactHint, untilHint, presetName, presetLength } from './words.js';
import { startSession } from './session.js';

const { MIN, MAX_MINUTES } = E;

let presets = load('presets', []);

/* ---------- Setup (full and work) ---------- */

export function showError(errId, fieldId, msg = '') {
  $(errId).textContent = msg;
  for (const id of ['f-minutes', 'f-until', 's-minutes', 'l-minutes']) {
    if ($(id).getAttribute('aria-describedby') !== errId) continue;
    $(id).removeAttribute('aria-invalid');
    $(id).removeAttribute('aria-describedby');
  }
  if (msg && fieldId) {
    $(fieldId).setAttribute('aria-invalid', 'true');
    $(fieldId).setAttribute('aria-describedby', errId);
  }
}
// Every mode has the For/Until switch. Work mode starts on Until, because an
// end time reads as an appointment; the other modes start on For.
export const defaultBy = () => (mode === 'work' ? 'until' : 'for');
const lengthBy = () => form.by;
const lengthField = () => (lengthBy() === 'for' ? 'f-minutes' : 'f-until');

// minutes: the chosen For button. untilMin: the chosen Until button, as
// minutes from now; a typed "next starts at" time overrides it.
export const form = { by: 'for', minutes: 25, untilMin: 25 };

export function resetForm() {
  form.by = defaultBy();
  form.minutes = 25;
  form.untilMin = 25;
  for (const id of ['f-title', 'f-next', 'f-step', 'f-minutes', 'f-until']) $(id).value = '';
  $('f-buffer').value = '0';
  $('f-warn').value = 'auto';
  showError('f-error');
  showError('l-error');
  renderSetup();
}

export function renderSetup() {
  const by = lengthBy();
  for (const b of document.querySelectorAll('[data-by]')) b.setAttribute('aria-pressed', String(b.dataset.by === form.by));
  $('by-for').hidden = by !== 'for';
  $('by-until').hidden = by !== 'until';
  const exact = $('f-minutes').value.trim();
  // In Work mode typed minutes are confirmed as an end time, never a duration.
  const typed = parseInt(exact, 10);
  $('f-exact-hint').textContent = exactHint(mode, typed, Date.now());
  for (const c of $('f-chips').children) c.setAttribute('aria-pressed', String(by === 'for' && !exact && +c.dataset.min === form.minutes));
  const typedTime = $('f-until').value;
  for (const c of $('u-chips').children) c.setAttribute('aria-pressed', String(by === 'until' && !typedTime && +c.dataset.min === form.untilMin));
  labelChips(Date.now());
  showRibbon('f-ribbon', 'f-ribbon-text', $('f-title').value);
  renderUntilHint();
  renderPresets();
}

// Until buttons (and, in Work mode, the finish screen's lengths) read as end
// times ("2:45"); For buttons read as minutes. End times follow the clock, so
// they are refreshed every tick.
export function labelChips(now) {
  const asTime = c => {
    const min = +c.dataset.min;
    c.textContent = fmtShort(now + min * MIN);
    c.setAttribute('aria-label', `Until ${fmtClock(now + min * MIN)}`);
  };
  const asMinutes = c => {
    c.textContent = c.dataset.min;
    c.setAttribute('aria-label', `${c.dataset.min} minutes`);
  };
  [...$('u-chips').children].forEach(asTime);
  [...$('f-chips').children].forEach(asMinutes);
  [...$('l-chips').children].forEach(mode === 'work' ? asTime : asMinutes);
}

export function showRibbon(wrapId, textId, title) {
  const note = getNote(title);
  $(wrapId).hidden = !note;
  if (note) $(textId).textContent = note.text;
}

function untilTotal() {
  const v = $('f-until').value;
  return v ? E.untilMs(v, +$('f-buffer').value) : null;
}

function renderUntilHint() {
  const total = untilTotal();
  // Work mode shows only the clock time, never a duration someone could read as a countdown.
  $('f-until-hint').textContent = untilHint(mode, total, Date.now());
}

function readForm() {
  let totalMs;
  if (lengthBy() === 'for') {
    const exact = $('f-minutes').value.trim();
    const minutes = exact ? parseInt(exact, 10) : form.minutes;
    if (!(minutes >= 1 && minutes <= MAX_MINUTES)) return { error: `Choose a length between 1 and ${MAX_MINUTES} minutes.` };
    totalMs = minutes * MIN;
  } else if (!$('f-until').value) {
    totalMs = form.untilMin * MIN;
  } else {
    totalMs = untilTotal();
    if (totalMs < MIN) return { error: 'That time has passed or is too close. Choose a later time.' };
    totalMs = Math.round(totalMs / 1000) * 1000;
  }
  const w = $('f-warn').value;
  const warnMs = w === 'auto' ? undefined : +w * MIN; // E.createSession keeps it to half the session
  return {
    title: $('f-title').value, next: $('f-next').value, step: $('f-step').value, totalMs, warnMs,
  };
}

function renderPresets() {
  const list = $('preset-list');
  list.replaceChildren(...presets.map(p => {
    const li = document.createElement('li');
    const start = document.createElement('button');
    start.type = 'button';
    start.className = 'preset-start';
    const name = document.createElement('span');
    name.className = 'preset-name';
    name.textContent = presetName(mode, p);
    if (p.next) {
      const em = document.createElement('em');
      em.textContent = `, then ${p.next}`;
      name.append(em);
    }
    start.append(name);
    // Work mode never shows a length, so it isn't written at all.
    const length = presetLength(mode, p);
    if (length) {
      const len = document.createElement('span');
      len.className = 'preset-len';
      len.textContent = length;
      start.append(len);
    }
    start.addEventListener('click', () => startSession({
      title: p.title, next: p.next, step: p.step, totalMs: p.minutes * MIN,
      warnMs: p.warn === 'auto' ? undefined : +p.warn * MIN,
    }));
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'preset-del';
    del.textContent = '×';
    del.setAttribute('aria-label', `Remove preset ${presetName(mode, p)}`);
    del.addEventListener('click', () => {
      const removed = presets.indexOf(p);
      presets = presets.filter(x => x !== p);
      save('presets', presets);
      renderPresets();
      toast('Preset removed', () => { presets.splice(removed, 0, p); save('presets', presets); renderPresets(); focusPresetRemove(removed); });
      focusPresetRemove(removed);
    });
    li.append(start, del);
    return li;
  }));
  $('presets-empty').hidden = presets.length > 0;
  list.closest('.presets').classList.toggle('has-items', presets.length > 0);
}

// The button that had focus is gone after a remove (or an undo), so focus
// moves to the remove button now in that place, the one before it, or Undo
// when no presets are left: keyboard and VoiceOver users keep their place.
function focusPresetRemove(index) {
  const dels = $('preset-list').querySelectorAll('.preset-del');
  (dels[Math.min(index, dels.length - 1)] || $('toast-undo')).focus();
}

$('setup-form').addEventListener('submit', e => {
  e.preventDefault();
  const f = readForm();
  if (f.error) { showError('f-error', lengthField(), f.error); return; }
  startSession(f);
});

$('f-save').addEventListener('click', () => {
  // An Until button is a length from now, so it saves; a typed clock time doesn't.
  if (lengthBy() === 'until' && $('f-until').value) { showError('f-error', null, 'Presets use a length. Choose one of the times above, or switch to “For”.'); return; }
  const f = readForm();
  if (f.error) { showError('f-error', lengthField(), f.error); return; }
  presets.push({
    id: Date.now().toString(36), title: f.title.trim(), next: f.next.trim(), step: f.step.trim(),
    minutes: Math.round(f.totalMs / MIN), warn: $('f-warn').value,
  });
  save('presets', presets);
  showError('f-error');
  renderPresets();
  toast('Preset saved');
});

$('f-clear').addEventListener('click', resetForm);

for (const b of document.querySelectorAll('[data-by]')) {
  b.addEventListener('click', () => { form.by = b.dataset.by; showError('f-error'); renderSetup(); });
}
for (const c of $('f-chips').children) {
  c.addEventListener('click', () => { form.minutes = +c.dataset.min; $('f-minutes').value = ''; showError('f-error'); renderSetup(); });
}
for (const c of $('u-chips').children) {
  c.addEventListener('click', () => { form.untilMin = +c.dataset.min; $('f-until').value = ''; showError('f-error'); renderSetup(); });
}
$('f-minutes').addEventListener('input', () => { showError('f-error'); renderSetup(); });
// The keyboard's return key moves to the next field instead of starting early.
const fieldOrder = ['f-title', 'f-next', 'f-step'];
fieldOrder.forEach((id, i) => $(id).addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.isComposing) return;
  e.preventDefault();
  if (fieldOrder[i + 1]) $(fieldOrder[i + 1]).focus(); else $(id).blur();
}));
$('f-title').addEventListener('input', () => showRibbon('f-ribbon', 'f-ribbon-text', $('f-title').value));
for (const id of ['f-until', 'f-buffer']) $(id).addEventListener('input', () => { showError('f-error'); renderSetup(); });

/* ---------- Setup (simple) ---------- */

for (const c of $('s-chips').children) {
  c.addEventListener('click', () => startSession({ totalMs: +c.dataset.min * MIN }));
}
$('s-form').addEventListener('submit', e => {
  e.preventDefault();
  const m = parseInt($('s-minutes').value, 10);
  if (!(m >= 1 && m <= MAX_MINUTES)) { showError('s-error', 's-minutes', `Type a number of minutes from 1 to ${MAX_MINUTES}.`); return; }
  showError('s-error');
  $('s-minutes').value = '';
  startSession({ totalMs: m * MIN });
});
$('s-minutes').addEventListener('input', () => showError('s-error'));
