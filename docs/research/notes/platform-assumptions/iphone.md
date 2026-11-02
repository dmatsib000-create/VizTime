# iPhone (iOS/iPadOS 26, with changes since iOS 17): Safari and home-screen web app behaviour for a visual timer PWA

Researched 1 November 2026. "Home-screen web app" means a site opened from its Home Screen icon in standalone mode, as opposed to a Safari tab. Most WebKit bug threads below are developer reports, not Apple statements, and they are marked as such.

## Background suspension: timers, audio and the page when backgrounded or locked

### Takeaway
VizTime's claim holds. No source shows a home-screen web app getting reliable background JS execution on iOS 17–26, and Apple's own answer for anything that must happen while the app isn't running is a server-sent Web Push. Using an audio element to keep the page alive is unreliable in standalone mode, and on iOS 26 audio in home-screen apps has its own regressions, so it isn't an honest way to keep a timer running.

### Cited Findings
- Developer guidance: don't rely on `setInterval`/`setTimeout` in the background on iOS, because the OS doesn't guarantee any background execution time — [Ionic forum](https://forum.ionicframework.com/t/setinterval-not-working-in-ios-when-app-in-background/198364)
- A course on background JS (Frontend Masters) reports roughly three seconds of execution before the page is suspended after it leaves the foreground — [Frontend Masters](https://frontendmasters.com/courses/background-javascript/observing-mobile-background-javascript). (Secondary source. I found no Apple figure.)
- WebKit bug 198277 (2019): audio stops when a standalone web app leaves the foreground, while the same audio keeps playing in Safari. So standalone mode is worse than a Safari tab for background audio — [WebKit bug 198277](https://bugs.webkit.org/show_bug.cgi?id=198277)
- Background Sync, Periodic Background Sync and Background Fetch are all unsupported on iOS, including in installed web apps (table updated 13 Oct 2026) — [firt.dev iOS PWA Compatibility](https://firt.dev/notes/pwa-ios/)
- Apple Frameworks Engineer (accepted answer, Aug 2023), asked about time-based notifications while a PWA is in the background: "Sending a Web Push notification at the time of the event is a great solution here." The engineer also said scheduled notifications don't exist in the Notifications API standard — [Apple Developer Forums 735402](https://developer.apple.com/forums/thread/735402)
- In the same thread, the original poster reported that notifications appeared while the PWA was in the foreground but not while it was in the background — [Apple Developer Forums 735402](https://developer.apple.com/forums/thread/735402)
- iOS 26 audio regression in home-screen apps. WebKit bug 291892, "WebAudio AudioContext silent after PWA returns from background, even after resuming it", is NEW (reported 22 Apr 2025, last modified 19 Nov 2025):
  - On iOS 26, Web Audio is reported to work only on the first launch of a home-screen web app.
  - On iOS 26, `resume()` is reported to never settle.
  - An `<audio>` fallback also stayed silent on iOS 26.0.
  - One user said iOS 26.2 beta 3 appeared to fix it. Not confirmed by WebKit.

  — [WebKit bug 291892](https://bugs.webkit.org/show_bug.cgi?id=291892)
- A separate report says audio and video in home-screen web apps failed to start after updating to iOS 26.0.1 — [Apple Developer Forums 805900](https://developer.apple.com/forums/thread/805900)
- The "silent audio element" unlock trick routes Web Audio through the media channel, but it puts media controls for the silent file on the Lock Screen and still needs a user tap — [unmute-ios-audio](https://github.com/illuspas/unmute-ios-audio); [WebKit bug 237322](https://bugs.webkit.org/show_bug.cgi?id=237322)
- Media Session API is supported from iOS 15.0 — [firt.dev](https://firt.dev/notes/pwa-ios/)

### Inferences
- A cue whose moment arrives while VizTime is backgrounded or the phone is locked can't be counted on to play. The existing design is the right one: timestamp sessions, plus `settle()` so missed cues aren't played late.
- Keeping a silent `<audio>` loop playing to stay alive would add fake Lock Screen media controls. It has failed in standalone mode historically (2019 bug) and is affected by the iOS 26 audio bugs. It would also go against the project rule "don't add anything that pretends otherwise".
- VizTime should expect, on return, an AudioContext that is "interrupted" or silent even though it reports "running" (see Audio).

### Gaps
- I found no Apple documentation that states the exact suspension timing for standalone web apps on iOS 26. The "~3 seconds" figure is secondary.
- I found no source on whether iOS 26 discards (reloads) a long-backgrounded home-screen web app more or less often than before. Developers broadly expect a cold reload after long background, but I found no citation for that, so VizTime should treat any return as a possible fresh load; its timestamp model already does.

## Screen Wake Lock in home-screen (standalone) mode

### Takeaway
Wake Lock has worked in Safari tabs since iOS 16.4. It was broken in home-screen web apps from 16.4 through 18.3.x and fixed in iOS/iPadOS 18.4 (March 2025). It is supported on iOS 26. The lock is released whenever the page is hidden and has to be requested again on `visibilitychange`.

### Cited Findings
- WebKit release notes: "The Screen Wake Lock API now also works in Home Screen Web Apps on iOS and iPadOS 18.4", plus the fix entry "Fixed Screen Wake Lock API for Home Screen Web Apps" (108573133) — [WebKit Features in Safari 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)
- History of the bug (WebKit bug 254545, RESOLVED FIXED):
  - Filed on iOS 16.4: wake lock worked in Safari but not on the Home Screen.
  - Cause given by Chris Dumez: home-screen web apps aren't UIApplications, so `idleTimerDisabled` doesn't apply.
  - Still broken in reports on 16.5, 16.6, 17.0–17.5.1, 18.0–18.3.1.
  - Jen Simmons said it was fixed in 18.4 (31 Mar 2025), and a developer confirmed it on the 18.4 beta.
  - A reported regression on iOS 26.1 (Dec 2025) was withdrawn; the reporter's browser-detection library was at fault.

  — [WebKit bug 254545](https://bugs.webkit.org/show_bug.cgi?id=254545)
- Re-acquiring the lock after returning from the Home Screen or on `visibilitychange` was split into bug 255363, listed as RESOLVED FIXED — [WebKit bug 254545](https://bugs.webkit.org/show_bug.cgi?id=254545)
- Support table: Screen Wake Lock from 16.4, and 18.4 for installed apps — [firt.dev](https://firt.dev/notes/pwa-ios/)
- The spec has the user agent release screen wake locks when the document stops being visible. Pages must request again when they become visible — [W3C Screen Wake Lock API](https://www.w3.org/TR/screen-wake-lock/)

### Inferences
- VizTime should keep or add a `visibilitychange` handler that calls `navigator.wakeLock.request('screen')` again when the page becomes visible.
- Users on iOS below 18.4 who use the home-screen app get no wake lock; the request may reject or silently not hold. The app should check (for example, listen for `release`) and not claim the screen will stay on.

### Gaps
- No source on whether Low Power Mode releases or refuses the wake lock on iOS. Untested; mark as unknown.
- No source on whether a wake lock overrides Auto-Lock in all cases, for example with Low Power Mode forcing Auto-Lock to 30 seconds.

## Audio: user-gesture unlock, interruption, the silent switch and `navigator.audioSession`

### Takeaway
Web Audio needs a user gesture before it plays. It can come back "interrupted" (or silent) after backgrounding, and needs `resume()`, ideally inside a tap. By default it is muted by the Ring/Silent switch (or Silent mode set from the Action button) because the default audio session type is "ambient". Setting `navigator.audioSession.type = "playback"` (iOS 17+) makes it play in silent mode. The docs' "the silent switch mutes it" is true only by default; a timer that opts into "playback" can override it.

### Cited Findings
- WebKit bug 237322 (Safari 15/iOS 15): Web Audio goes silent with the side switch on silent, while `<audio>`/`<video>` keep playing. Resolved "CONFIGURATION CHANGED" — [WebKit bug 237322](https://bugs.webkit.org/show_bug.cgi?id=237322)
- Jean-Yves Avenard (WebKit), 25 Sep 2024: "By default the type is `ambient` and so audio will be muted if the phone is muted", and "Since iOS 17, you can set the audio session type to 'playback'" — [WebKit bug 237322](https://bugs.webkit.org/show_bug.cgi?id=237322)
- A WebKit maintainer said setting `navigator.audioSession.type` to "playback" should help with silent mode, and another commenter confirmed "playback" and "play-and-record" work — [WebKit bug 251532](https://bugs.webkit.org/show_bug.cgi?id=251532); [WebKit bug 264473](https://bugs.webkit.org/show_bug.cgi?id=264473)
- One report: "transient"/"transient-solo" types produced silence on iOS 17/18 even with the switch off, so "playback" is the safer choice — [WebKit bug 264473](https://bugs.webkit.org/show_bug.cgi?id=264473)
- A user gesture (click/touchstart) is still needed before audio plays, even with the silent-audio workaround — [unmute-ios-audio](https://github.com/illuspas/unmute-ios-audio)
- MDN: "interrupted" is a state the web app doesn't control, such as the user leaving the page; example code calls `resume()` when it sees it — [MDN BaseAudioContext.state](https://developer.mozilla.org/docs/Web/API/BaseAudioContext/state)
- Reports on Safari's "interrupted" state:
  - iOS 17.5.1: the context stuck "interrupted" after Safari lost focus.
  - iOS 17.6.1: the context returned to "running" on becoming visible.
  - Another report: the context defaulted to "interrupted" and `resume()` didn't work.

  — [WebKit bug 276016](https://bugs.webkit.org/show_bug.cgi?id=276016); [WebKit bug 273511](https://bugs.webkit.org/show_bug.cgi?id=273511)
- iOS 26: Web Audio in home-screen web apps silent after relaunch or return from background, even after `resume()` from a click (see Background section) — [WebKit bug 291892](https://bugs.webkit.org/show_bug.cgi?id=291892)
- Safari 26 fixed stale AudioBuffer data after seeking with an AudioContext. It also blocks fingerprinting scripts from Web Audio readback, which doesn't affect playback — [WebKit: News from WWDC25, Safari 26 beta](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/)

### Inferences
- If VizTime wants a chime that respects the user's choice, it should decide on purpose:
  - Leave the default "ambient": the silent switch mutes the chime, which matches the current docs.
  - Set "playback" on the opt-in gesture: the chime sounds in silent mode, which may matter for a clinic.

  Either way, the docs should say which it is. Feature-detect with `'audioSession' in navigator`.
- Setting "playback" may also stop other apps' audio (podcasts), because it is a non-mixing media session. This is likely but not verified by these sources.
- On every return to visible, VizTime should check `ctx.state`. If it isn't "running", resume on the next tap, and don't assume a context that reports "running" is audible on iOS 26.0/26.1.

### Gaps
- No primary source on whether the iPhone 15+ Action button "Silent mode" behaves identically to the hardware switch for Web Audio. It is very likely the same system ringer state, but unverified.
- No WebKit statement confirming bug 291892 fixed in 26.2 or later.
- No source on whether `audioSession.type = "playback"` lets audio continue while backgrounded in a home-screen app. Bug 237322 only says it prevents suspension; treat it as unproven.

## speechSynthesis on iOS

### Takeaway
Speech synthesis has been supported since iOS 7. It needs a user gesture, and the gesture effectively has to unlock it before speech triggered later from a timer will work. Reports say it is silenced by the silent switch, and nothing suggests it speaks while the page is suspended.

### Cited Findings
- WebKit: iOS has always needed a gesture for SpeechSynthesis. A 2021 patch proposed tying it to the `audioPlaybackRequiresUserGesture` setting — [WebKit bug 223473](https://bugs.webkit.org/show_bug.cgi?id=223473)
- Library guidance: speech from async code (not directly in a tap) often fails on iOS Safari. A common workaround is to speak a muted, near-empty utterance during a tap first — [Easy Speech docs](https://docsearch.algolia.com/mcp/docs/repo/leaonline/easy-speech)
- Reports of speech being silent with the silent switch on — [onestack.dev speech-synthesis](https://onestack.dev/native/speech-synthesis); [Apple Developer Forums 49875](https://developer.apple.com/forums/thread/49875) (older thread). Secondary sources.
- `speechSynthesis.speak()` can pause video and mute getUserMedia audio in Safari — [WebKit bug 218815](https://bugs.webkit.org/show_bug.cgi?id=218815)
- Speech synthesis support since iOS 7.0 — [firt.dev](https://firt.dev/notes/pwa-ios/)

### Inferences
- VizTime's spoken cues should be primed on the same tap that turns spoken cues on or starts a session.
- Because `speak()` can pause video, a spoken cue might interfere with the PiP video element. That matters only in a Safari tab (see PiP). Unverified.
- Whether `audioSession.type = "playback"` also un-mutes speechSynthesis is unknown.

### Gaps
- No source specific to speech in standalone mode, or to how voice availability (`getVoices()` async loading) differs on iOS 26.

## Vibration API and haptics

### Takeaway
The Vibration API is still unsupported on iOS 26. A hidden `<input type="checkbox" switch>` produces a light system haptic when toggled. WebKit has a bug asking for it to require user activation, so script-triggered use from a timer is not dependable. The docs' "web apps can't vibrate" is accurate; at most, mention that a tap-time haptic tick exists.

### Cited Findings
- Vibration: not supported — [firt.dev](https://firt.dev/notes/pwa-ios/)
- Workaround: an `<input type=checkbox switch>` with a `<label>`, clicked from script, makes Safari emit a haptic — [Ionic issue 29942](https://github.com/ionic-team/ionic-framework/issues/29942); [ios-haptics package](https://npmjs.com/package/ios-haptics)
- A WebKit bug says the switch haptic arrived with iOS Safari 18.0 and asks that it require user activation. Other sources say the switch control itself shipped in Safari 17.4, so the haptic is probably 18.0+ — [WebKit bug 285120](https://bugs.webkit.org/show_bug.cgi?id=285120); [ios-haptics README](https://unpkg.com/ios-haptics@0.0.8/README.md)

### Inferences
- A haptic cue fired from a timer, especially with the page suspended, would not work, and might stop working altogether if WebKit enforces user activation. Not suitable as a timer cue.

### Gaps
- Current status of WebKit bug 285120 (whether user activation is now enforced on iOS 26) not checked.

## Notifications without a push server, Web Push and Declarative Web Push

### Takeaway
"Notifications aren't available without a server" is broadly right for VizTime's purpose, but it needs nuance:
- The Notification API exists (iOS 16.4+) in home-screen web apps only.
- Permission needs a user gesture.
- A page or service worker can show a notification only while its JS is running.

VizTime calls `showNotification` only when the page is hidden, and a hidden home-screen app is suspended almost immediately, so in practice it won't fire at the cue time. Declarative Web Push (iOS 18.4) removes the need for a service worker but still needs a server to send the push at the right moment.

### Cited Findings
- Web Push and Notifications: iOS 16.4, installed web apps only; not in Safari tabs. Badging also 16.4, installed only — [firt.dev](https://firt.dev/notes/pwa-ios/); [Notificare: Web Push in iOS Safari](https://notificare.com/blog/2023/03/27/web-push-in-ios-safari/)
- The permission prompt needs user interaction (a tap) — [Glide community, iOS 16.4](https://community.glideapps.com/t/ios-16-4-finally-allowing-pwa-push-notifications/58046)
- Developer report: notifications appear while the PWA is in the foreground, not in the background. Apple's answer is to send a Web Push at event time, and scheduled notifications aren't in the standard — [Apple Developer Forums 735402](https://developer.apple.com/forums/thread/735402)
- "Declarative Web Push is now available on iOS and iPadOS 18.4 for web apps added to the Home Screen." Notifications display "without requiring a Service Worker", from a standard JSON push payload — [WebKit Features in Safari 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/); [Meet Declarative Web Push](https://webkit.org/?p=16535)
- Declarative Web Push exposes `window.pushManager` for subscriptions without a service worker. Supported only in Home Screen web apps on iOS/iPadOS 18.4+ (macOS Safari 18.5+) — [progressier](https://progressier.com/pwa-capabilities/declarative-web-push); [WebKit Meet Declarative Web Push](https://webkit.org/?p=16535)
- During the EU 17.4 beta, when home-screen apps briefly became bookmarks, push and badging stopped working. This was reversed in the final 17.4 — [ITNext: PWAs on iOS](https://itnext.io/pwas-on-ios-where-we-are-now-fe9f7cdbd111)

### Inferences
- A local, server-free "Session finished" notification only fires if VizTime's JS is running at that moment. On iPhone that means only in the foreground, where it isn't needed. The honest wording is: "iPhone can't show a notification at the end time unless a server sends one."
- Badging (`navigator.setAppBadge`) works in installed apps from 16.4 but can't be updated in the background without push. It is of little use, and a badge count could read as a timer-like signal in Work mode.

### Gaps
- No primary source that explicitly tests `registration.showNotification()` with no push subscription on iOS 26. The foreground-only behaviour rests on a developer report.

## Video picture-in-picture of a canvas stream as a floating view

### Takeaway
The docs' iPhone Float claim needs correcting. `requestPictureInPicture()` does not work in home-screen web apps on iOS/iPadOS (reported from iOS 14.5 through 26.6, open as of Aug 2026). PiP works only in a Safari tab. Even there, I found no source confirming that a canvas `captureStream()` video keeps updating while Safari is backgrounded.

### Cited Findings
- WebKit bug 303885, "[iOS/iPadOS] requestPictureInPicture() does not work in Home Screen Web Apps (PWA)": status NEW, P1, InRadar (rdar://121964774); reported 9 Dec 2025, last modified 13 Aug 2026. The bug reports:
  - In standalone mode the PiP control disappears from the media controls.
  - `requestPictureInPicture()` throws `NotSupportedError` or does nothing.
  - `document.pictureInPictureEnabled` still reports `true`.

  — [WebKit bug 303885](https://bugs.webkit.org/show_bug.cgi?id=303885)
- In the same bug, a 31 Jul 2026 reproduction on iOS 26.6 (iPhone Air, `navigator.standalone === true`) found:
  - `pictureInPictureEnabled` is `true`.
  - `webkitSupportsPresentationMode('picture-in-picture')` returns `false`.
  - `requestPictureInPicture()` rejects with `NotSupportedError`.

  The commenter hides the control when the non-standard probe returns false — [WebKit bug 303885](https://bugs.webkit.org/show_bug.cgi?id=303885)
- Earlier related bug 280627 (Sep 2024, by WebKit's youenn fablet): "Media element cannot be picture-in-pictured in Home Screen web apps" — [WebKit bug 280627](https://bugs.webkit.org/show_bug.cgi?id=280627)
- Bug 262479 comment: PiP works in Safari but not when the app is added to the Home Screen — [WebKit bug 262479](https://bugs.webkit.org/show_bug.cgi?id=262479)
- Bug 252765 (NEW): `requestPictureInPicture()` fails in webviews and other cases — [WebKit bug 252765](https://bugs.webkit.org/show_bug.cgi?id=252765)
- Safari 26 fixed PiP to exit when the video element is removed — [WebKit Safari 26 beta](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/)
- Developers report that calling `webkitSetPresentationMode('picture-in-picture')` from `visibilitychange` in WKWebView makes no visible PiP window. Auto-PiP on backgrounding needs native player settings a page can't set — [Apple Developer Forums 819235](https://developer.apple.com/forums/thread/819235)

### Inferences
- In the installed iPhone app, VizTime's Float control should be hidden ("hide, don't disable"). Feature-detect with `video.webkitSupportsPresentationMode?.('picture-in-picture')` as well as `document.pictureInPictureEnabled`, since the latter is wrong in standalone mode.
- The docs' "iOS may freeze it while VizTime is in the background" is plausible for a Safari tab, because canvas drawing stops when page JS is suspended. It is unverified.
- Auto-PiP when leaving the app is not available to a web page in standalone mode.

### Gaps
- Not verified: whether canvas `captureStream()` PiP in a Safari tab on iOS 26 keeps repainting after Safari is backgrounded. No source found.

## Storage: separation from Safari, eviction, `persist()` and quotas

### Takeaway
A home-screen web app has its own storage, separate from Safari's, so saved presets don't carry over between Safari and the installed app. Since iOS 17.2 login cookies are copied at install. ITP's 7-day script-writable-storage cap counts days of use of the app itself, so a regularly used app isn't wiped. On iOS 17+, `navigator.storage.persist()` is granted heuristically, notably when the site is opened as a Home Screen web app. Quotas are generous.

### Cited Findings
- Storage and service workers are not shared between Safari and installed web apps. Login cookies are copied to the installed app from iOS 17.2 — [firt.dev](https://firt.dev/notes/pwa-ios/)
- Older (2018) report: only Cache Storage was shared between Safari and an installed PWA. This is likely outdated; firt.dev now lists no sharing — [Pinafore issue 45](https://github.com/nolanlawson/pinafore/issues/45)
- WebKit (2020): the 7-day cap on script-writable storage counts days of Safari use without interaction. Home-screen web apps "are not part of Safari and thus have their own counter of days of use", which resets with actual use — [WebKit: Full Third-Party Cookie Blocking and More](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)
- A conflicting 2020 report said cookies were deleted in a home-screen app; a 2022 thread pointed to later WebKit guidance exempting the Home Screen web app domain from ITP — [WebKit bug 211775](https://bugs.webkit.org/show_bug.cgi?id=211775); [WebKit bug 237350](https://bugs.webkit.org/show_bug.cgi?id=237350)
- Storage policy, Safari 17 / iOS 17:
  - A browser app gets an origin quota of up to 60% of disk and an overall quota of up to 80%. Other apps get 15% and 20%.
  - A Home Screen web app "has the same origin quota and overall quota as when it is opened in a browser app."
  - Eviction is per origin, least-recently-used first.
  - Persistent-mode origins, and origins with an active page, are protected.
  - "WebKit currently grants a request based on heuristics like whether the website is opened as a Home Screen Web App."

  — [WebKit: Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/)
- Persistent storage is supported from iOS 15.2, and the Storage quota API from iOS 17 — [firt.dev](https://firt.dev/notes/pwa-ios/)
- Safari 26 stops known fingerprinting scripts from setting long-lived script-written storage, including LocalStorage. This shouldn't affect a site's own first-party script — [WebKit Safari 26 beta](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/)

### Inferences
- VizTime should call `navigator.storage.persist()` once in the installed app. It is likely to be granted and protects presets from storage-pressure eviction.
- The docs and guide should say: "Presets saved in Safari don't appear in the Home Screen app, and the other way round. Set it up in the app you'll use."
- The `viztime2:` namespacing still matters, because all GitHub Pages projects share one origin, and therefore one quota and one eviction unit.

### Gaps
- I couldn't retrieve the WebKit post "Home Screen Web Application Domain Exempt From ITP" to confirm wording and date.
- Unclear whether two installs of the same origin (two Home Screen icons) share storage on iOS 26. firt.dev says installed apps "share it with other instances of PWA Browsers" in an older note, but the current wording is unverified.

## iOS 26 "Open as Web App" default, manifest changes in iOS 17.4–26, and EU status

### Takeaway
In iOS/iPadOS 26, every site added to the Home Screen opens as a web app by default, even without a manifest. A user toggle, "Open as Web App", turns this off so the icon opens a Safari tab. The `apple-mobile-web-app-capable` meta tag is no longer needed, and SVG manifest icons work. In the EU, Apple planned to remove home-screen web apps in the iOS 17.4 betas (Feb 2024) and reversed that before the 17.4 release. I found no later removal.

### Cited Findings
- "By default, every website added to the Home Screen opens as a web app" (iOS/iPadOS 26). Users can turn off "Open as Web App" to get a plain bookmark. Manifest icons are still used. This is not removing any existing web app features — [WebKit: News from WWDC25](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/)
- iOS 26.0 also brings SVG manifest icons and drops the need for the `apple-mobile-web-app-capable` meta tag — [firt.dev](https://firt.dev/notes/pwa-ios/)
- Manifest support on iOS:
  - `name`, `short_name`, `scope`, `display` (standalone/browser), `start_url`: 11.3
  - `theme_color`: 15.0
  - `icons`: 15.4
  - `id`: 16.4

  Not supported: `orientation`, `background_color`, `shortcuts`, `minimal-ui`/`fullscreen` display, `beforeinstallprompt`, `appinstalled` — [firt.dev](https://firt.dev/notes/pwa-ios/)
- iOS 26.4 added WebTransport — [firt.dev](https://firt.dev/notes/pwa-ios/)
- EU: Apple said in Feb 2024 that it had to remove Home Screen web apps in the EU to comply with the DMA. It then reversed the decision and kept the existing capability in iOS 17.4, built on WebKit — [Engadget (removal)](https://www.engadget.com/apple-confirms-home-screen-web-apps-will-no-longer-work-on-european-ios-devices-112527560.html); [Engadget (reversal)](https://www.engadget.com/apple-backtracks-on-plans-to-get-rid-of-web-apps-on-iphones-in-the-eu-195232177.html); [Tom's Guide](https://www.tomsguide.com/phones/iphones/apples-backtracking-on-plans-to-kill-iphone-home-screen-web-apps-in-the-eu-heres-why)

### Inferences
- On iOS 26, a user who turned off "Open as Web App" when adding VizTime gets a Safari tab, with no Wake Lock problems but separate storage. Guide wording should say to leave "Open as Web App" on.
- Because `orientation` and `background_color` are ignored, the splash and launch colour on iPhone come from other signals. This is not a timer issue.

### Gaps
- No source found on EU home-screen web app status in 2025–2026 beyond the 2024 reversal. Assumed unchanged; unverified.
- firt.dev's table doesn't mention the EU.

## Other limits for a timer: visibility events, reloads, Background Fetch/Sync, Badging

### Takeaway
None of the background APIs a timer might lean on exist on iOS: Background Sync, Periodic Sync, Background Fetch, and local or scheduled notifications. Badging exists only for installed apps and only updates while JS runs or through push. `visibilitychange` is the event to rely on for re-acquiring the wake lock, resuming audio and re-rendering from timestamps.

### Cited Findings
- Background Sync, Periodic Background Sync and Background Fetch are unsupported; Badging is installed-only, from 16.4 — [firt.dev](https://firt.dev/notes/pwa-ios/)
- Re-acquiring the wake lock on `visibilitychange` after returning from the Home Screen was a separate, now-fixed bug (255363) — [WebKit bug 254545](https://bugs.webkit.org/show_bug.cgi?id=254545)
- Recommended practice: resume the AudioContext on `visibilitychange` — [WebKit bug 276016](https://bugs.webkit.org/show_bug.cgi?id=276016)

### Inferences
- VizTime's design (sessions as `endAt`/`pausedAt`/`finishedAt` timestamps, with `settle(now)`) fits iOS well. Each foreground return, including a cold reload, re-derives state from the clock.
- Claim-by-claim summary for the current docs:
  1. **"Suspended when it isn't on screen or the phone locks, so it can't sound a cue then"**: confirmed.
  2. **"Keep the screen awake and leave VizTime open"**: correct, and works in the installed app only on iOS 18.4+.
  3. **"Sound only works after a tap"**: confirmed. Add that sound may also need a tap after returning from the background, and that iOS 26.0/26.1 had home-screen audio bugs.
  4. **"The silent switch mutes it"**: true by default. The app can override it with `navigator.audioSession.type = "playback"` (iOS 17+). The docs must match whatever the code does.
  5. **"Web apps can't vibrate"**: confirmed.
  6. **"Notifications aren't available without a server"**: effectively true for timed cues. The API exists in installed apps from 16.4, but nothing fires while the app is suspended.
  7. **Float as picture-in-picture "above other apps"**: wrong for the Home Screen app, where PiP is unsupported (WebKit bug 303885, still open on iOS 26.6). It applies only in a Safari tab, and background updating there is unverified.

### Gaps
- `pagehide`/`pageshow` behaviour (bfcache) in standalone mode on iOS 26 was not researched. No source found.
