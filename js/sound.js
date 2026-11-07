// Soft tones with a slow attack, never a beep. Built with Web Audio so nothing
// needs downloading. On iPhone, audio only works after a tap, and Silent mode
// mutes it unless the person turns on "Play tones in Silent mode".

let ctx = null;

export function unlockAudio() {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch { ctx = null; }
}

// One bell-like note: a sine with a quiet octave partial, rising over `attack`
// seconds and fading over `decay`.
function note(freq, at, volume, attack = 0.6, decay = 3.2) {
  const t0 = ctx.currentTime + at;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.linearRampToValueAtTime(0.22 * volume, t0 + attack);
  out.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  out.connect(ctx.destination);
  for (const [mult, level] of [[1, 1], [2, 0.18], [3, 0.04]]) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq * mult;
    g.gain.value = level;
    osc.connect(g).connect(out);
    osc.start(t0);
    osc.stop(t0 + attack + decay + 0.1);
  }
}

const PHRASES = {
  half: [[659.25, 0]],                 // E5, once
  warn: [[523.25, 0]],                 // C5, once
  finish: [[392.0, 0], [587.33, 1.1]], // G4 then D5, unhurried
};

// iPhone treats Web Audio as ambient sound, which Silent mode mutes. The Audio
// Session API (iOS 17 and later) lets a page ask to be playback instead, which
// Silent mode doesn't mute; playback may pause other audio, such as music, so
// it is asked for only while a phrase sounds, then handed back. Offered only on
// a touch device with the API: a Mac has no Silent mode.
export const canPlayThroughSilent = () => 'audioSession' in navigator && navigator.maxTouchPoints > 1;
let sessionTimer;
function holdPlayback(seconds) {
  try {
    navigator.audioSession.type = 'playback';
    clearTimeout(sessionTimer);
    sessionTimer = setTimeout(() => { try { navigator.audioSession.type = 'auto'; } catch { /* best effort */ } }, seconds * 1000);
  } catch { /* the tones still play when Silent mode is off */ }
}

export function chime(kind, volume = 0.6, throughSilent = false) {
  if (!ctx || volume <= 0) return;
  const phrase = PHRASES[kind] || [];
  // A note lasts its attack and decay (0.6 + 3.2 s) after it starts.
  if (throughSilent && canPlayThroughSilent()) holdPlayback(Math.max(...phrase.map(([, at]) => at)) + 4.2);
  // iOS can leave the context 'interrupted' after a lock or a call.
  if (ctx.state !== 'running') ctx.resume();
  for (const [freq, at] of phrase) note(freq, at, volume);
}

export function speak(text) {
  try {
    if (!('speechSynthesis' in window) || !text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.pitch = 1;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch { /* speech is a nicety */ }
}
