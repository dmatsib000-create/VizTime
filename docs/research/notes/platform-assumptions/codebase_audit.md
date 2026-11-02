# VizTime codebase audit: platform assumptions and the code that implements them

Scope: read-only audit of the repository at commit 7244ba5 (main). Sources are repository files cited as `file:line` (paths relative to the repo root). No web sources were used; whether a browser actually supports an API is left to the platform researchers and flagged as an open question. "Per-platform behaviour" below means "which branch the code takes, given the feature-detection it does", not verified real-world behaviour.

Platform columns used throughout: **iOS tab** = iPhone Safari tab; **iOS HS** = iPhone home-screen web app; **Android** = Android Chrome; **Win** = Windows Chrome/Edge (tab or installed); **FF** = Firefox (desktop).

Key fact up front: the code has **no standalone detection and no platform/UA sniffing at all**. iOS tab and iOS home-screen run identical code; every difference comes from feature detection (`'x' in window/navigator`) at the moment of use.

## 1. Inventory of every platform claim in the docs, and the code that relies on it

### Takeaway
The docs make about 30 distinct platform claims, almost all about iPhone vs "computer (Chrome, Edge or Vivaldi)". Android is never mentioned anywhere in the docs, Firefox never mentioned. Several doc/code mismatches exist: the notification toggle says "(computer)" but appears wherever `Notification` exists; the floating window is requested at 240 x 300, not the documented ~200 x 200; the video-PiP hint says "the phone" but also shows on Android and desktop Safari; the maskable icon is not in the offline list.

### Cited Findings

#### 1a. Claims as stated in the docs (exhaustive)

| # | Claim (paraphrased, short quotes) | Stated in |
|---|---|---|
| D1 | Static files, GitHub Pages project subpath; relative paths everywhere incl. manifest and SW; data namespaced because Pages projects share an origin | build-prompt.md:46; CLAUDE.md:38, 40; README.md:52-56 |
| D2 | Installs to iPhone home screen: full screen, no browser bars, clear of notch / Dynamic Island / home indicator, no accidental zoom or text selection, 44px targets, portrait and landscape, system light/dark, proper icon | build-prompt.md:47; design-direction.md:95 |
| D3 | "Once loaded, it works offline" / "Works without internet: Yes, after the first visit" (iPhone and computer) | build-prompt.md:47; README.md:3; docs/guide.md:162; design-direction.md:65 (fonts self-hosted and cached in SW) |
| D4 | iPhone install: Safari, Share, Add to Home Screen | README.md:56; docs/guide.md:23-26 |
| D5 | Computer: Chrome, Edge or Vivaldi; bookmark or "the browser's 'Install' option if it offers one" | docs/guide.md:30 |
| D6 | iPhone web app is suspended in the background and when the screen locks; cannot sound a cue then | build-prompt.md:49; README.md:48; CLAUDE.md:55; docs/guide.md:169 |
| D7 | iPhone: sound only after a tap; silent switch mutes it | build-prompt.md:49; README.md:48; docs/guide.md:163, 187; js/sound.js:2-3 |
| D8 | Computer: sounds "Yes" | docs/guide.md:163 |
| D9 | Web apps can't vibrate (iPhone and computer: "No") | build-prompt.md:49; README.md:48; CLAUDE.md:55; docs/guide.md:166 |
| D10 | Keep screen awake while a session runs "where iOS allows it", a comfort setting, on by default; works on iPhone and computer | build-prompt.md:49; README.md:37, 48; docs/guide.md:164, 169 |
| D11 | Notifications: "system notifications on a computer"; iPhone "Reminders when you're in another app: No"; "Notifications aren't available without a server" | README.md:37, 48; docs/guide.md:165; index.html:307 (label "(computer)") |
| D12 | Work mode never speaks or notifies anything except "Session finished." | README.md:37; docs/guide.md:149; CLAUDE.md:34; index.html:308 |
| D13 | Work mode tab title is "Day"; title and icon must not give it away; favicon neutral in discreet mode | build-prompt.md:10; README.md:14; docs/guide.md:113; CLAUDE.md:34; design-direction.md:98 |
| D14 | Float on Windows Chrome/Edge (and Vivaldi) via Document Picture-in-Picture: small always-on-top window with picture and -5/Pause/+5; handoff at finish; Work mode as discreet as main screen | build-prompt.md:48; README.md:43; docs/guide.md:153, 167; js/float.js:2-3 |
| D15 | Floating window is about 200 x 200 | build-prompt.md:48; design-direction.md:97; CLAUDE.md:59; design-system.md:523 |
| D16 | iPhone/Safari Float = picture-in-picture video of the face; can't be tapped; iOS may freeze it in background; "experimental" | build-prompt.md:49; README.md:44; docs/guide.md:155, 167; js/float.js:4-6; js/menu.js:49 |
| D17 | "Safari has no interactive floating window" | build-prompt.md:49 |
| D18 | A cue whose moment passed while the app was closed is never played late; running timer survives closing and resumes from real end time | build-prompt.md:36; README.md:39; CLAUDE.md:44; design-direction.md:116; docs/guide.md:189 |
| D19 | A desktop background tab still ticks about once a minute, so cues play at most a minute late (Chrome wakes hidden tabs about once a minute) | js/draw.js:18-21; js/engine.js:8-10 |
| D20 | iPhone browser apps can leave animation frames stopped after returning from background until the screen is touched (Vivaldi, WebKit views) | js/draw.js:23-24; commit 65ff3f3 message |
| D21 | Main tab's animation frames stop in the background, so the floating window draws on its own frames | js/pip.js:14-16; commit 07eb970 message |
| D22 | iOS can leave the AudioContext "interrupted" after a lock or a call | js/sound.js:43 |
| D23 | Inputs 17px or larger so iOS never zooms on focus | design-direction.md:65 |
| D24 | `viewport-fit=cover`, `env(safe-area-inset-*)`, `theme-color` matches `--paper` in each mode | design-direction.md:95 |
| D25 | GitHub Pages' 10-minute browser caching could pair a new index.html with an old app.js; hence revalidate every file | sw.js:29-31; commit e35e853 message |
| D26 | Data stays on the device, per browser; phone and computer share nothing; clearing browser data erases presets/notes/settings | docs/guide.md:173-177 |
| D27 | "Never pretend a feature works when it cannot" / "Be honest about platforms" | build-prompt.md:49; CLAUDE.md:55 |
| D28 | iPhone best practice: leave VizTime open on screen; picture and warm light carry the cue without sound | build-prompt.md:49; docs/guide.md:169; README.md:48 |
| D29 | "On an iPhone ... tap the screen once after opening it" for sound | docs/guide.md:187 |
| D30 | Alt+1/2/3 keyboard mode switching (desktop keyboards; `e.code` so Alt-modified layouts work) | README.md:18; js/menu.js:76-83 |

#### 1b. Master inventory: claim to code to per-platform branch

| Claim | Code path | iOS tab | iOS HS | Android | Win Chrome/Edge | FF | Detection / fallback | Open question for platform researchers |
|---|---|---|---|---|---|---|---|---|
| D6, D18, D19 suspension and catch-up | js/draw.js:22 `FROZEN_GAP = 65_000`; js/draw.js:29-49 `tick()`; js/engine.js:11 `LATE_LIMIT = 75_000`; js/engine.js:101-105 `settle`; js/engine.js:109-125 `dueCues`; js/state.js:38 settle on load | Gap > 65 s on return => all due cues settled silently; finish lands quietly | same | same logic; no Android-specific handling | Hidden tab assumed to tick about 1/min => cues play up to 75 s late; gap > 65 s => silent | same as Win | None; purely timestamp based (`Date.now()`) | Exact Chrome/Edge hidden-tab timer cadence (intensive throttling alignment) vs the 65 s threshold; Edge sleeping tabs / efficiency mode; Android background-tab freezing; when iOS suspends timers after hide |
| D7, D22, D29 audio unlock | js/sound.js:7-12 `unlockAudio`; js/session.js:148 `pointerdown` listener; js/session.js:29 on start; js/menu.js:104 Try it; js/sound.js:41-46 `chime` | Context created/resumed on any pointerdown | same | same | same | same | `AudioContext || webkitAudioContext`, try/catch => `ctx = null` (silent) | Whether `ctx.resume()` from a timer (no gesture) succeeds after iOS "interrupted"; whether silent switch / `navigator.audioSession` matters |
| D10 wake lock | js/session.js:154-171 `syncWake`; called js/screens.js:34, js/draw.js:189, js/menu.js:108 | Requested if `'wakeLock' in navigator` | same | same | same | same | Silent no-op if absent; errors swallowed (js/session.js:168) | Wake Lock support/bugs in iOS tab vs home-screen app by iOS version; Firefox version |
| D11, D12 notifications | js/session.js:125-145 `notify`; js/menu.js:45, 111-118; sw.js:43-49 | Toggle hidden if `Notification` absent | Toggle shown if `Notification` exists | Toggle shown; SW `showNotification` | Toggle shown; SW `showNotification` | Toggle shown | `'Notification' in window`, permission check, `document.hidden` gate, SW first then `new Notification` | iOS 16.4+ home-screen exposure of `Notification`; whether a suspended iOS page can ever reach this code; Android Chrome background timers |
| D14-D17 Float | js/float.js:8-14 detection; js/pip.js:34-59 `openFloat`; js/screens.js:32 button visibility; js/menu.js:46-50 hint | Video PiP if `pictureInPictureEnabled` or `webkitSetPresentationMode`, and `captureStream` | same | Video PiP path (no Document PiP expected) | Document PiP 240 x 300 | Float button hidden if neither API | Document PiP first, then video PiP, else hidden | Document PiP availability (Chrome/Edge desktop only?); canvas-stream video PiP in iOS standalone; Android video PiP from canvas stream; Firefox has no PiP API |
| D3, D25 offline / SW | sw.js:1-49; js/app.js:27-29 | SW registered on `load` | same | same | same | same | `'serviceWorker' in navigator`; registration errors swallowed | Network-first with no timeout on flaky networks; iOS SW lifetime/storage eviction |
| D2, D23, D24 home-screen look | index.html:5-17; styles.css:71-93; manifest.webmanifest:1-16 | Meta tags ignored where not applicable | apple-* meta tags, apple-touch-icon | manifest, maskable icon | manifest (install) | n/a | Static markup only | `apple-mobile-web-app-status-bar-style: default` with `viewport-fit=cover`; no splash images |
| D13 Work-mode discretion on OS surfaces | js/draw.js:51-57 `updateTitle`; js/pip.js:67 `doc.title`; js/session.js:129-132; index.html:16 favicon | Tab title "Day" | Title "Day" (app name on home screen is "VizTime", index.html:12, manifest:2-3) | same | Tab "Day"; PiP doc title "Day" | same | Mode check only | What browser chrome shows regardless: origin in Document PiP title bar, notification attribution (site/app name "VizTime", icon-192), installed-PWA window title |
| D26 storage | js/store.js:1-19 | localStorage | localStorage | localStorage | localStorage | localStorage | try/catch, fallback values | No `navigator.storage.persist()`; Safari 7-day script-storage cap for tab use; eviction rules |

#### 1c. Doc vs code mismatches found
- Float window size: code requests `requestWindow({ width: 240, height: 300 })` (js/pip.js:39 via js/float.js:18) while docs say "about 200 x 200" (build-prompt.md:48, design-direction.md:97, CLAUDE.md:59). CSS adapts down to 140-210px heights (styles.css:503-505), so 200 x 200 is supported if the user resizes.
- Notification toggle label is "System notification at the warning and finish (computer)" (index.html:307), but the toggle is shown on any browser with `Notification` in window (js/menu.js:45). That includes Android Chrome and, if exposed, iPhone home-screen apps. README.md:48 and docs/guide.md:165 say iPhone: No.
- Video-PiP menu hint says "the phone may pause it" (js/menu.js:49). The same branch is taken on desktop Safari and on Android Chrome (any browser with `pictureInPictureEnabled` and `captureStream` but no Document PiP).
- No-float hint says "Chrome or Edge on a computer" (js/menu.js:50); README.md:43 and docs/guide.md:153 also name Vivaldi. Minor.
- `icons/icon-maskable-512.png` is referenced in manifest.webmanifest:14 but is not in `SHELL` (sw.js:3-11). The offline test only checks scripts, fonts, index, styles and manifest (tests/offline.test.js:18-25), so it does not catch icons.
- CLAUDE.md:30 says "CI runs the tests on every push and pull request"; .github/workflows/test.yml:3-6 runs on push to `main` and on pull requests only.
- design-direction.md:98 wants the favicon neutral in discreet mode; the favicon is one static `icons/icon.svg` (index.html:16) for all modes, never swapped. The SVG is a half-shaded circle on a horizon line (a setting sun), not a clock or timer glyph (icons/icon.svg).

### Inferences
- Because there is no standalone detection, any difference between iOS Safari tab and iOS home-screen app comes from the browser itself (API exposure, suspension behaviour), not from VizTime code.
- Android users get a coherent but undocumented experience: video PiP float (if the detection passes), SW notifications, wake lock. None of it is described or tested.

### Gaps
- Real API availability per platform (Document PiP, Wake Lock, Notification on iOS HS, canvas-stream PiP) cannot be determined from the code; it is the platform researchers' question.

## 2. Sound: how audio is unlocked and what happens to the AudioContext after background

### Takeaway
One lazily created AudioContext, created or resumed on every `pointerdown`, on Start, and on "Try it". There is no `visibilitychange` resume; instead `chime()` calls `ctx.resume()` (unawaited, no gesture) whenever the context is not `running` at the moment a cue plays. After a reload with a session running, no context exists until the first pointerdown, so cues are silent until then, and keyboard-only interaction never creates one except through Start or Try it.

### Cited Findings
- Context creation: `ctx ??= new (window.AudioContext || window.webkitAudioContext)()`; if `suspended`, `ctx.resume()`; any exception sets `ctx = null` — js/sound.js:7-12.
- Unlock triggers: `document.addEventListener('pointerdown', unlockAudio, { passive: true })` with the comment "Audio needs a tap to start, including after a reload with a session running" — js/session.js:147-148. Also `startSession()` calls `unlockAudio()` first — js/session.js:29. Menu "Try it": `unlockAudio(); chime('finish', ...)` — js/menu.js:104.
- No `keydown`/`touchend`/`click` unlock listener exists (grep across js/ found only the pointerdown listener). Start via keyboard still unlocks because it goes through `startSession`.
- `chime()` returns silently if `!ctx` or `volume <= 0` — js/sound.js:42. Comment "iOS can leave the context 'interrupted' after a lock or a call", then `if (ctx.state !== 'running') ctx.resume();` — js/sound.js:43-44. The `resume()` promise is not awaited; notes are scheduled immediately at `ctx.currentTime + at` — js/sound.js:17, 45.
- Tones: sine + 2x and 3x partials, 0.6 s attack, 3.2 s exponential decay, peak gain `0.22 * volume` — js/sound.js:16-33; phrases half E5, warn C5, finish G4 then D5 — js/sound.js:35-39. Default volume 0.6 — js/state.js:26.
- No `visibilitychange` handler touches audio: the only visibilitychange listener (js/draw.js:188-192) calls `syncWake()`, sets `frame.force`, and calls `tick()` or `wake()`.
- No `navigator.audioSession` usage anywhere (grep returned nothing), so the iOS silent-switch behaviour is whatever the default audio session type gives Web Audio.
- Speech: `speechSynthesis.cancel(); speechSynthesis.speak(u)` at rate 0.95, try/catch, no gesture priming — js/sound.js:48-57. Called from `playCue` when the per-cue `speak` setting is on — js/session.js:120. In Work mode `cueWords` returns '' for half and warn, so `speak` returns early and only "Session finished." can be spoken — js/session.js:109-110, js/sound.js:50.
- Cue playback happens inside `tick()` (js/draw.js:44 `cues.forEach(playCue)`), which runs from `setInterval(tick, 1000)` (js/app.js:25), the rAF loop (js/draw.js:137), the float window loop (js/pip.js:26) and `wake()` (js/draw.js:152). None of these is a user gesture.
- Default cue bundle "balanced": tone at warn and finish, no speech — js/state.js:13-16, 25.

### Inferences
- iOS: if the context is `interrupted` or `suspended` when a cue is due, `resume()` from a timer may not be honoured, so that cue would be silent; the docs' advice to tap after opening (docs/guide.md:187) is the only mitigation. Platform researchers should confirm whether iOS allows `resume()` outside a gesture after interruption.
- Desktop keyboard-only users who reload mid-session get silent cues until they click/tap something or start a new session, because `pointerdown` is the only passive unlock.
- Speech on iOS may require the first `speak()` inside a gesture; VizTime never primes it, so a spoken cue may be dropped on iOS (open question).

### Gaps
- Whether `chime()` scheduling against `currentTime` before an unawaited `resume()` completes produces a delayed-but-audible tone or nothing, per browser — not determinable from code.

## 3. Wake lock: when requested, released and re-acquired

### Takeaway
`syncWake()` holds a screen wake lock exactly while: setting on, a session exists, not finished, not paused, and the page is visible. It is re-evaluated on every `render()`, on every `visibilitychange`, and when the setting changes; when the browser releases the lock on hide, a `release` listener clears the handle, so the next visible `visibilitychange` re-requests it. There is no fallback (no NoSleep-style video) and no UI feedback if unsupported or refused.

### Cited Findings
- Condition: `settings.wake && session && !session.finishedAt && !session.pausedAt && document.visibilityState === 'visible'` — js/session.js:159.
- Request only if `'wakeLock' in navigator`: `wakeLock = await navigator.wakeLock.request('screen')`, plus `release` listener sets `wakeLock = null` — js/session.js:160-163.
- Explicit release when no longer wanted — js/session.js:164-167. Any error: `catch { wakeLock = null; }` — js/session.js:168.
- Re-entrancy guard: a call during a pending request sets `wakeAgain` and reruns afterwards "so pausing during the request doesn't leave the screen held awake" — js/session.js:152-156, 169-170.
- Callers: `render()` (js/screens.js:34) which runs after start, stop, pause/resume, adjust, finish and mode-face changes; `visibilitychange` (js/draw.js:189); the Menu toggle (js/menu.js:108). Not called from `pageshow` or `focus` (those call `wake()`, js/draw.js:193-194, which does not call `syncWake`).
- Default `wake: true` — js/state.js:26. Toggle "Keep the screen awake while running" is always shown — index.html:306; js/menu.js:41 (no feature check hides it).

### Inferences
- Re-acquire on return from background is handled through `visibilitychange`. If a browser restores from bfcache or refocuses without firing `visibilitychange`, the lock is not re-requested until the next `render()`.
- Where Wake Lock is absent (or refused, e.g. low battery or iOS bugs), the toggle still shows and silently does nothing; this sits uneasily with the "Hide, don't disable" and "Never pretend a feature works" rules (CLAUDE.md:48, build-prompt.md:49). The docs state "Keeping the screen awake: Yes" on iPhone (docs/guide.md:164) without a version caveat.
- On desktop with Document PiP open and the main tab hidden, the lock is released (main page not visible); this is probably fine on a computer.

### Gaps
- Which iOS versions honour the Wake Lock API in home-screen apps vs Safari tabs is a platform question.

## 4. Notifications: when, from where, options and Work-mode text

### Takeaway
Notifications are local, page-triggered (no push, no scheduled triggers), shown only for the warning and finish cues, only when the page is hidden, the setting is on and permission is granted. They go through the service worker registration if present (else the `Notification` constructor), with `tag: 'viztime'`, `silent: true`, `icon: icons/icon-192.png`, and no `requireInteraction`, `renotify`, `badge`, `actions` or `data`. In Work mode only the finish notifies, titled "Session finished."

### Cited Findings
- Trigger: `playCue(cue)` calls `notify(cue)` for every cue except `half` — js/session.js:117-123. `playCue` runs from `tick()` only for cues `dueCues` returns (js/draw.js:42-44), i.e. live and at most 75 s late; never for silently settled cues.
- Gate: `if (!settings.notify || !document.hidden || !('Notification' in window) || Notification.permission !== 'granted') return;` — js/session.js:126.
- Text, Work mode: warn returns without notifying; finish title `'Session finished.'`, body `Next: ${s.next}` or empty — js/session.js:129-132.
- Text, Full/Simple: warn title `${fmtLeft(remaining)} left · ${title}`, body `Then ${next}`; finish title `${title || 'Session'} finished`, body `Next: ${next}` — js/session.js:133-139.
- Options: `{ body: text, tag: 'viztime', icon: 'icons/icon-192.png', silent: true }` — js/session.js:140.
- Delivery: `const reg = await navigator.serviceWorker?.getRegistration(); if (reg) reg.showNotification(title, opts); else new Notification(title, opts);` in try/catch "notifications are optional" — js/session.js:141-144.
- Click handling in SW: close, then focus the first window client (`includeUncontrolled: true`) or `openWindow('./')` — sw.js:43-49.
- Permission request: on toggling the Menu checkbox on, `Notification.requestPermission()` (promise form); if not granted, the setting reverts and a toast says "Notifications are blocked in this browser." — js/menu.js:111-118.
- Toggle visibility: `$('m-notify-wrap').hidden = !('Notification' in window)` — js/menu.js:45. Label text "(computer)" — index.html:307. Hint "Voice and notifications stay neutral in Work mode" — index.html:308.
- Default `notify: false` — js/state.js:26.
- No Push API, no `showTrigger`/`TimestampTrigger`, no Badging, no periodic sync anywhere (grep found none).

### Inferences
- Because notifications fire from page timers while `document.hidden`, they work only where a hidden page keeps running timers: desktop Chrome/Edge/Firefox background tabs (throttled, see section 5). On iOS (suspended when hidden) the code path is effectively unreachable even if `Notification` is exposed. On Android, it depends on how long Chrome keeps a hidden tab's timers alive.
- `silent: true` means the OS notification makes no sound; the in-page chime (if enabled) plays separately from the hidden tab on desktop. That is a deliberate calm choice but means the only audible cue in the background is the Web Audio tone.
- `tag: 'viztime'` without `renotify` means the finish notification replaces the warning notification silently (and may not re-alert on some platforms).
- Work-mode discretion: the text is neutral, but the platform will attribute the notification (site origin or installed app name "VizTime", the icon). Whether "VizTime" or the origin appears in the Windows toast is a platform question; the repository name in the Pages URL is not known from the code.
- `new Notification()` fallback is only reached if no SW registration exists; on Android Chrome the constructor is known to throw, but the SW path is used first once `sw.js` has registered (js/app.js:28 registers on `load`).

### Gaps
- Whether iOS 16.4+ home-screen apps expose `Notification` (making the "(computer)" toggle appear on iPhone) is for the platform researchers.

## 5. Catch-up after background and timer throttling

### Takeaway
Timing is entirely timestamp-based: every frame and tick recomputes from `Date.now()` against `endAt`/`pausedAt`, so throttled or stopped timers cause no drift, only late updates. A tick gap over 65 s is treated as "the page was frozen = closed" and all due cues are settled silently; a gap under that plays cues up to 75 s late. On return, `visibilitychange`/`pageshow`/`focus` call `wake()`, which ticks, repaints and restarts the rAF loop.

### Cited Findings
- Session model: wall-clock `endAt`, `pausedAt`, `finishedAt`, `fired` map — js/engine.js:1-2, 34-43; remaining time `max(0, endAt - (pausedAt ?? now))` — js/engine.js:45-46.
- `settle`: marks every cue whose moment has passed as fired; if time is up and not finished, `finishedAt = pausedAt ?? endAt` (the real end, not now) — js/engine.js:99-105. Called on load (js/state.js:38), in `createSession` (js/engine.js:41), on Undo after Stop (js/session.js:49), and from `tick()` when frozen (js/draw.js:42).
- `dueCues`: skips if paused or finish already fired; marks each newly due cue fired; plays it only if `late <= LATE_LIMIT` (75 s); sets `finishedAt = endAt`; returns only the most important of simultaneous cues (finish > warn > half) — js/engine.js:107-125. Comment: "Chrome wakes hidden tabs about once a minute ... a missed cue is never played on reopen" — js/engine.js:8-11.
- Frozen detection: `const frozen = now - lastTick > FROZEN_GAP` with `FROZEN_GAP = 65_000`; comment: a long gap "means the page was frozen (an iPhone app in the background or a locked phone), which counts as closed ... A desktop tab in the background still ticks about once a minute, so its cues play, at most a minute late" — js/draw.js:18-22, 29-32, 42.
- What the user sees on return after a silent settle: `tick()` sees `!wasFinished && session.finishedAt` and calls `onFinished(false)` — js/draw.js:45; `onFinished` with `cued=false` persists and renders but skips flash and breathing light — js/session.js:64-70. `render()` shows the landing (finish) screen because `finishedAt` is set — js/screens.js:17. Tab title becomes "Finished · VizTime" (Full/Simple) or stays "Day" (Work) — js/draw.js:51-57.
- On hide, `tick()` runs once (updating `lastTick`) — js/draw.js:191; on show, `wake()` — js/draw.js:150-157, 191. Also `pageshow` and `focus` call `wake()` — js/draw.js:193-194.
- Loops: `setInterval(tick, 1000)` — js/app.js:25; rAF `frame()` throttled to ~12.5 fps (80 ms) and calls `tick()` if the last tick is 1 s stale ("Timers can stall while frames run") — js/draw.js:129-139; `tick()` repaints if frames stalled > 1.5 s (`PAINT_STALL`) "Animation frames can stay stopped after an iPhone browser app returns from the background, until the screen is touched" — js/draw.js:23-25, 33. History: commit 65ff3f3 ("Some iPhone browser apps (Vivaldi, a WebKit view inside another app) leave animation frames stopped").
- Float loop: the Document PiP window has its own rAF that steps, paints and calls `tick()` when stale, "Background tabs may run timers only once a minute; keep the text and cues current" — js/pip.js:14-27.
- Video PiP is painted by `setInterval(paintVideo, 500)` — js/pip.js:48; js/draw.js:158-186.
- Tests: "a cue more than 75 seconds late is marked done without playing" — tests/engine.test.js:88-93; "reopening after the end lands on the finished state at the real end time" — tests/engine.test.js:101-106; "each cue plays once, in order" — tests/engine.test.js:72-80; "only the most important plays" — tests/engine.test.js:82-86; "no cue plays while paused" — tests/engine.test.js:95-99. `FROZEN_GAP`, `PAINT_STALL`, the tick loop and `wake()` are not tested (draw.js is not under test; CLAUDE.md:30).

### Inferences
- The margin between Chrome's assumed ~60 s hidden-tab wake-up and `FROZEN_GAP` (65 s) is only 5 s. If a hidden desktop tab's timer fires slightly later than 65 s after the previous one (e.g. intensive throttling aligned to minute boundaries plus jitter, Edge efficiency mode, or a sleeping tab), the cue is settled silently: no sound, no notification. Note `LATE_LIMIT` (75 s) is larger than `FROZEN_GAP`, so in practice `FROZEN_GAP` is the binding limit for background tabs.
- With the Document PiP window open on Windows, the PiP window's own rAF runs at display rate while visible, so `tick()` is called about every second and cues/notifications are on time even with the main tab hidden. This makes Float the most reliable background setup on desktop.
- On iOS, any absence over 65 s ends in a silent catch-up; a cue that came due 2 s before return is not played if the gap was over 65 s. Shorter absences (under 65 s, if timers resume) play the cue late.
- Wall-clock changes (manual clock change, DST is irrelevant since timestamps are UTC ms) would shift sessions; no monotonic clock is used. Minor.

### Gaps
- Real hidden-tab timer cadence on Chrome/Edge/Firefox (Windows) and Android Chrome, and how fast iOS suspends a hidden page, need platform research.

## 6. Floating view: detection order, sizes, opener hidden, iOS branches

### Takeaway
Document Picture-in-Picture is preferred (`'documentPictureInPicture' in window`), requested at 240 x 300 with no other options; otherwise a muted, inline, near-invisible `<video>` streaming a 360 x 360 canvas at 4 fps is put into PiP via the standard API, or `webkitSetPresentationMode('picture-in-picture')` as the WebKit fallback. If neither is available the Float button is hidden and the menu explains why. There is no iOS-specific branch other than the webkit presentation-mode fallback.

### Cited Findings
- Detection: `canFloatWindow = () => 'documentPictureInPicture' in window` — js/float.js:8. `canFloatVideo()`: `(document.pictureInPictureEnabled || typeof v.webkitSetPresentationMode === 'function') && typeof HTMLCanvasElement.prototype.captureStream === 'function'` — js/float.js:10-14.
- Order: `if (canFloatWindow()) {...} else if (canFloatVideo()) {...}` — js/pip.js:38-54. Failure of either: toast "The floating view could not open here." — js/pip.js:55-58. Clicking Float again while open closes it — js/pip.js:36.
- Button shown only while a session is running and a float path exists — js/screens.js:32; index.html:38 (`hidden` by default).
- Document PiP: `window.documentPictureInPicture.requestWindow({ width, height })` with `openFloatWindow(240, 300, ...)` — js/float.js:17-18; js/pip.js:39. No `disallowReturnToOpener` or `preferInitialWindowPlacement`. Copies each stylesheet `<link>` by href and adds `color-scheme: light dark` meta — js/float.js:19-28. Close detection via the PiP window's `pagehide` — js/float.js:29.
- PiP content: `doc.title = mode === 'work' ? 'Day' : 'VizTime'` — js/pip.js:67; controls -5/Pause/+5 forward clicks to the main page's buttons — js/pip.js:76-95; Work mode hides the control row and shows time left only for 4 s after a tap/Enter — js/pip.js:96-109, 127, 136.
- Opener hidden: the PiP window draws on `floatWin.requestAnimationFrame` at ~12.5 fps and calls `tick()` if stale, because "The main tab's frames stop whenever that tab is in the background, which is exactly when the floating window is in use" — js/pip.js:14-27, 45. Resizes repaint — js/pip.js:43. CSS layout for small/wide windows — styles.css:480-510.
- Video PiP: `video.muted = true; video.playsInline = true; setAttribute('playsinline','')`, `srcObject = canvas.captureStream(4)`, appended to body, `await video.play()`, then `requestPictureInPicture()` (listening for `leavepictureinpicture`) or `webkitSetPresentationMode('picture-in-picture')` (listening for `webkitpresentationmodechanged`) — js/float.js:34-52. The video element is styled `position: fixed; width: 1px; height: 1px; opacity: 0; pointer-events: none` — styles.css:475. Canvas is `<canvas id="video-canvas" width="360" height="360" hidden>` — index.html:328. Painted every 500 ms by `setInterval` — js/pip.js:47-48; content: face plus "then {next}" or title, or "Session finished." (Work) / next / "Finished" at the end — js/draw.js:160-186.
- Close: `exitPictureInPicture()` or `webkitSetPresentationMode('inline')` or cleanup — js/float.js:53-57; `closeFloat()` on Stop and Done — js/session.js:44, 59; js/pip.js:61-64.
- Menu hints by branch — js/menu.js:46-50: Document PiP ("A small window stays on top of your other apps"), video ("It can't be tapped, and the phone may pause it while VizTime is in the background"), none ("This browser has no floating view. Chrome or Edge on a computer can ...").

### Inferences
- Expected branches (to be verified by platform researchers): Windows Chrome/Edge => Document PiP; desktop Safari, iOS tab, iOS HS => video PiP (standard API or webkit fallback); Android Chrome => video PiP (no Document PiP on Android); Firefox => no PiP web API, so Float hidden.
- Gesture risk: `openFloatVideo` awaits `video.play()` before `requestPictureInPicture()` / `webkitSetPresentationMode()`. Whether user activation survives that await on iOS Safari is a key question; if not, the toast appears.
- A 1 px, `opacity: 0` video may be rejected for PiP on some engines (open question).
- The 500 ms `setInterval` painter will be throttled or frozen when the page is hidden (that is, whenever the PiP video is useful on a phone), so the floating picture likely freezes; the docs already say "may freeze" (README.md:44).
- On Android the hint text ("the phone may pause it") happens to fit; on desktop Safari it says "phone" incorrectly.

### Gaps
- Whether Document PiP works from an installed (standalone) PWA window on Windows, and how Chrome labels the PiP window (origin shown?), are platform questions relevant to Work-mode discretion.

## 7. Absent platform APIs and Android-specific code

### Takeaway
There is no Android-specific code and no standalone detection. None of `navigator.vibrate`, `navigator.storage.persist`, `navigator.audioSession`, `navigator.mediaSession`, `beforeinstallprompt`, `display-mode` media query, `navigator.standalone`, Badging, Push, notification triggers, periodic sync, Screen Orientation lock, Fullscreen or `visualViewport` is used.

### Cited Findings
- A repository-wide grep for `vibrate|storage.persist|audioSession|mediaSession|beforeinstallprompt|display-mode|navigator.standalone|setAppBadge|periodicSync|PushManager|TimestampTrigger|showTrigger|screen.orientation|requestFullscreen|visualViewport|requireInteraction|renotify|navigationPreload|postMessage` across .js/.html/.css/.webmanifest returned no matches (only unrelated `resume`/`freeze` words in js/engine.js:69, js/float.js:6, js/sound.js:10,44).
- All `navigator`/`window` feature use in js/: `serviceWorker` (js/app.js:27-28, js/session.js:142), `wakeLock` (js/session.js:160-161), `AudioContext/webkitAudioContext` (js/sound.js:9), `speechSynthesis` (js/sound.js:50), `Notification` (js/session.js:126, js/menu.js:45, 113-114), `documentPictureInPicture` (js/float.js:8, 18), `pictureInPictureEnabled`/`webkitSetPresentationMode`/`captureStream` (js/float.js:10-14, 44-55), `matchMedia` for reduced motion and dark scheme (js/draw.js:13, 62).
- Vibration absence is intentional and documented: "web apps can't vibrate" — README.md:48; docs/guide.md:166 (computer also "No").
- Storage: plain `localStorage` with `viztime2:` prefix, all calls in try/catch — js/store.js:1-19. No persistence request.

### Inferences
- Android Chrome supports `navigator.vibrate` (to be verified), but docs/guide.md:166 and README.md:48 say vibration is unavailable, which is an iPhone-only truth; for Android this would be a "pretends it can't" gap rather than "pretends it can".
- Without `navigator.storage.persist()`, presets, notes and the running session are best-effort storage; for an iOS Safari tab (not installed), WebKit's 7-day script-writable storage cap may apply (to verify), while the home-screen app is reportedly exempt.
- Without `navigator.audioSession.type = 'playback'` (iOS 17+, to verify), Web Audio follows the silent switch, matching the docs' statement that the silent switch mutes it.
- No install prompt handling means Android/desktop installs rely on the browser's own menu, as docs/guide.md:30 says.

### Gaps
- None from the code side; support status of each absent API is for the platform researchers.

## 8. Manifest and iOS meta tags

### Takeaway
The manifest has the essentials (name, short_name, start_url and scope `./`, `display: standalone`, `orientation: any`, light background/theme colour, 192/512 PNG icons and a 512 maskable icon) but lacks `id`, `display_override`, a dark theme colour, `screenshots`, `shortcuts` and `launch_handler`. index.html carries the Apple meta tags, one `apple-touch-icon`, media-scoped `theme-color` for light and dark, and `viewport-fit=cover`; there are no `apple-touch-startup-image` splash screens.

### Cited Findings
- manifest.webmanifest:2-3 name/short_name "VizTime"; :4 description; :5 `"start_url": "./"`; :6 `"scope": "./"`; :7 `"display": "standalone"`; :8 `"orientation": "any"`; :9-10 `background_color` and `theme_color` `#EFEAE0` (light paper only); :12-14 icons 192, 512, and `icon-maskable-512.png` with `"purpose": "maskable"`.
- Absent from the manifest: `id`, `display_override`, `lang`, `dir`, `categories`, `screenshots`, `shortcuts`, `launch_handler`, `prefer_related_applications` (manifest.webmanifest:1-16 is the whole file).
- index.html:5 `width=device-width, initial-scale=1, viewport-fit=cover` (no `maximum-scale`/`user-scalable`, so pinch zoom remains allowed); :6 `color-scheme: light dark`; :7-8 `theme-color` `#EFEAE0` light and `#1E1C19` dark via `media`; :9 `apple-mobile-web-app-capable: yes`; :10 `mobile-web-app-capable: yes`; :11 `apple-mobile-web-app-status-bar-style: default`; :12 `apple-mobile-web-app-title: VizTime`; :15 manifest link; :16 SVG favicon; :17 `apple-touch-icon` `icons/apple-touch-icon.png` (single, no sizes attribute).
- CSS for the home-screen surface: `-webkit-text-size-adjust: 100%` (styles.css:71), `min-height: 100dvh` (:75), tap highlight off, `user-select: none` and `-webkit-touch-callout: none` on body (:81-83), safe-area padding with `env(safe-area-inset-*)` (:84-88), inputs re-enable selection (:92), buttons `touch-action: manipulation` (:93), inputs and selects 17px (:196-199; body 17px at :34), bottom-sheet and toast honour `safe-area-inset-bottom` (:449, :468), landscape short-height layout (:406-414).
- Menu uses `<dialog>` with `showModal()` — index.html:267; js/menu.js:53.

### Inferences
- With `status-bar-style: default` and `viewport-fit=cover`, iOS standalone status bar rendering (whether content sits under a translucent bar) should be checked; body padding uses `env(safe-area-inset-top)` either way.
- No manifest `id` means the app identity defaults to `start_url`; harmless now, but changing `start_url` later would create a "new" app on Chrome/Android.
- Manifest `theme_color` is light-only; installed Windows/Android windows may use the light colour in dark mode unless the browser honours the media-scoped meta tags.

### Gaps
- Whether iOS still uses `apple-mobile-web-app-capable` vs the manifest `display` is a platform question.

## 9. Service worker

### Takeaway
`sw.js` precaches a 26-entry shell into `viztime-paper-7` with `cache: 'reload'`, calls `skipWaiting()` and `clients.claim()`, deletes only old `viztime*` caches, and serves same-origin GETs network-first with `cache: 'no-cache'` revalidation and no network timeout, falling back to cache and then `index.html` for navigations. It also handles `notificationclick`. There is no update prompt, no message channel and no navigation preload.

### Cited Findings
- `CACHE = 'viztime-paper-7'` — sw.js:2.
- `SHELL`: `./`, `./index.html`, `./styles.css`, `./manifest.webmanifest`, 13 scripts (`app, state, ui, setup, session, screens, draw, pip, menu, engine, store, sound, faces, float`), 4 fonts, `icons/icon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` — sw.js:3-11. Missing: `icons/icon-maskable-512.png` (referenced at manifest.webmanifest:14); docs/images are not needed offline.
- Install: `caches.open(CACHE).then(c => c.addAll(SHELL.map(url => new Request(url, { cache: 'reload' }))))` then `self.skipWaiting()` — sw.js:13-19.
- Activate: delete keys starting `viztime` other than `CACHE` ("Only this app's old caches: other Pages projects share the origin"), then `self.clients.claim()` — sw.js:21-26.
- Fetch: ignore non-GET and cross-origin; `new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' })`; on `res.ok` store a clone under the original request (not awaited / not in `waitUntil`); on network failure `caches.match(req, { ignoreSearch: true })`, else for navigations `caches.match('./index.html')`, else `Response.error()` — sw.js:28-41. No timeout or race, so a hanging network (captive portal, weak signal) waits for the browser's own network timeout before the cache answers.
- `notificationclick`: see section 4 — sw.js:43-49.
- Registration: `navigator.serviceWorker.register('sw.js')` on window `load`, errors swallowed, default scope (the directory of sw.js, i.e. the Pages subpath) — js/app.js:27-29.
- Rationale for `no-cache`/`reload`: GitHub Pages 10-minute caching mixing versions after a deploy — sw.js:29-31; commit e35e853.
- CLAUDE.md:42 and README.md:74: add new files to `SHELL` and bump `CACHE`; network-first means editing an existing file needs no bump.

### Inferences
- `skipWaiting()` + `clients.claim()` + network-first means a deploy takes effect on the next request without a reload prompt; mixed old/new module graphs within one open page are still possible if a deploy lands mid-session, but `no-cache` revalidation limits it.
- Re-creating the request from `req.url` drops the original request mode (for navigations the new request is not `mode: navigate`); fine for same-origin static files.
- The offline experience on a flaky connection may feel slow on first paint because there is no network timeout.

### Gaps
- iOS cache/SW eviction behaviour for home-screen apps vs tabs is a platform question.

## 10. Tests covering platform behaviour

### Takeaway
Tests (Node built-in runner, CI on Node 22) cover only the pure timer model, storage helpers and the SW file list. No test covers audio, wake lock, notifications, float, the tick/frozen-gap logic, visibility handling or the manifest.

### Cited Findings
- tests/engine.test.js: catch-up semantics — 75 s late limit (:88-93), reopen after end (:101-106), cue ordering (:72-80), simultaneous cues (:82-86), paused (:95-99), finish now (:108-114), adjust re-arming (:56-70), `untilMs` midnight handling (:116-128).
- tests/store.test.js: prefix round-trip (:15), null removes (:21), unreadable data falls back (:27), note keys (:32-47).
- tests/offline.test.js: every SHELL entry exists (:11-16); every js/ script, every font, index.html, styles.css and manifest are in SHELL (:18-25). Icons are not checked, which is why the missing maskable icon is not caught.
- CI: .github/workflows/test.yml:3-16, `node --test` on Node 22, triggers on push to main and pull requests.
- CLAUDE.md:30: "Everything else is checked by running the app."

### Inferences
- `FROZEN_GAP` (js/draw.js:22) is a platform-sensitive constant with no test; it lives in draw.js rather than engine.js, contrary to the "Keep timer logic in engine.js, pure and testable" rule (CLAUDE.md:44).

### Gaps
- No device test record exists in the repo (no notes of which iOS/Android/Chrome versions were tried), so the docs' platform claims are not traceable to any recorded test.
