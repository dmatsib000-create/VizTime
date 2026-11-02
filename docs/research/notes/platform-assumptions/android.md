# Android installed web apps (Chrome, Samsung Internet, Firefox) for a visual-timer PWA, as of November 2026

Scope note: about 18 searches and fetches. Primary sources were found for install criteria, timer throttling, Notification Triggers, the Vibration spec, Document PiP, edge-to-edge and text scaling. Background freezing on Android, audio behaviour, notification permissions and storage separation are thinly documented by Google. Those claims are marked, and some are left in Gaps. Items from prior knowledge that I could not verify this session are listed under Gaps, never under Cited Findings.

## 1. Install: WebAPK, install prompt criteria, Samsung Internet, Firefox, GitHub Pages subpath

### Takeaway
On Chrome for Android an installed PWA is a real WebAPK (it shows in the app drawer). The menu "Install app" no longer needs a fetch-handling service worker (since Chrome 108 on mobile), but the automatic install prompt (`beforeinstallprompt`) still did as of Google's last stated position. Samsung Internet mints WebAPKs only on Samsung-made devices; elsewhere it makes a shortcut. Firefox for Android offers "Install" or "Add to Home screen" from its menu and opens the site without browser UI.

### Cited Findings
- Chrome dropped the requirement for a service worker that implements `fetch()` for installing from the menu: "since version 108 on mobile and 112 on Desktop." — [Chrome for Developers: Revisiting Chrome's installability criteria](https://developer.chrome.com/blog/update-install-criteria)
- The same post says the algorithm that shows the automatic install prompt "still requires the presence of a fetch() handler", that Chrome planned new signals for when to show it, and that it would experiment with requiring fewer manifest fields. `beforeinstallprompt` remains the developer hook. The post is undated in the results and the version numbers suggest 2022–2023. — [Chrome for Developers](https://developer.chrome.com/blog/update-install-criteria)
- WebAPKs are signed by a trusted minting provider. Samsung Internet uses this method "only on Samsung-manufactured devices"; other browsers create shortcuts. The Samsung Galaxy Store can also serve WebAPK installs. — [web.dev Learn PWA: Installation](https://web.dev/learn/pwa/installation)
- A Samsung developer-forum moderator said PWA installation through Samsung Internet is supported only on Samsung Galaxy devices with the Galaxy App Store. On other devices pages are still saved to the home screen, "they will not save as WebAPKs". The URL-bar install button is part of the WebAPK experience. — [Samsung Developer Forum](https://forum.developer.samsung.com/t/samsung-internet-browser-and-pwa-on-not-samsung-devices/13623)
- A Samsung Internet bug where WebAPK installs failed with "Failed to download" was fixed in v12.1.2.5. This is an old forum report. — [Samsung Developer Forum](https://forum.developer.samsung.com/t/bug-pwa-webapk-installation-fails/7475)
- Firefox for Android gained Web App Manifest support in Firefox 58. — [Engadget, Firefox 58 tag](https://www.engadget.com/tag/Firefox58)
- Community reports say that on sites with a compatible manifest Firefox's three-dot menu shows "Install" in place of "Add to Home screen". The installed app opens fullscreen without Firefox UI. One user says it needs Android 8+, another that there is no clean "Uninstall PWA" option. These are undated user posts and the search tool did not show which thread said what. — [support.mozilla.org thread](https://support.mozilla.org/en-US/questions/1331604); [Fairphone forum](https://forum.fairphone.com/t/how-could-i-install-web-app-with-firefox/35409)

### Inferences
- VizTime's network-first service worker has a fetch handler, so it should meet even the stricter automatic-prompt rule on Chrome. A user can always install from the Chrome menu.
- Compared with iPhone: Android Chrome installs from the browser menu (and may offer a prompt or install banner), while iPhone needs Share → Add to Home Screen in Safari. On Android the result is a real app-drawer app (WebAPK) in Chrome, and on Samsung Internet on Galaxy phones. In other browsers it is a shortcut.
- Docs should name Chrome as the recommended Android browser to install from, Samsung Internet as acceptable on Galaxy phones, and Firefox as "works as a home-screen shortcut".

### Gaps
- No current (2025–2026) official statement of Chrome's automatic install-prompt criteria was found. Prior knowledge, unverified: the manifest needs `name` or `short_name`, 192px and 512px icons, `start_url`, `display` set to standalone, fullscreen or minimal-ui, and `prefer_related_applications` not true; the page must be served over HTTPS; and an engagement heuristic applies.
- GitHub Pages subpath: no source found, either way, on whether `scope` and `start_url` relative to `/<repo>/` install correctly as a WebAPK. Prior knowledge, unverified: relative `start_url` and `scope` resolve against the manifest URL, the WebAPK's scope is the manifest scope (default: the directory of `start_url`), and other projects on the same `username.github.io` origin fall outside that scope and open in a Chrome Custom Tab. The manifest `id` defaults to `start_url`; changing `start_url` later without a fixed `id` may make Chrome treat it as a different app.
- Firefox for Android's current (2026) install behaviour, and whether it creates a real app-drawer app or only a shortcut, is not documented in the sources found.

## 2. Background behaviour: timers, freezing, screen off, Doze, OEM battery killers

### Takeaway
Once a Chrome page is hidden (another app in front, home screen, or screen locked), its 1-second `setInterval` runs at most about once per second. Chrome-wide "intensive throttling" moves to once-per-minute wake-ups after 5 minutes hidden. On Android the page is commonly frozen outright (no JS at all) at around 5 minutes, and the OS may kill the renderer. Installed PWAs behave like Chrome tabs here. Timestamp-based sessions (VizTime's design) are essential, and nothing can be relied on to fire while the app is hidden.

### Cited Findings
- Chrome 88 (January 2021) throttling stages: (a) "minimal" when the page is visible or "has made sound in the past 30 seconds"; (b) "throttling" when hidden less than 5 minutes, where timers are checked "once per second"; (c) "intensive throttling" when hidden more than 5 minutes, the timer chain count is at least 5, the page has been silent for at least 30 seconds and WebRTC is not in use, where timers are checked "once per minute". A silent audio track does not count as sound. The article names no platform and says it applies to "all Chrome users". — [Chrome for Developers: Heavy throttling of chained JS timers (Chrome 88)](https://developer.chrome.com/blog/timer-throttling-in-chrome-88)
- Freezing "suspends task execution on a web page", including timers, event handlers and promise resolvers. It differs from discarding, which unloads the tab. In Chrome 133 the desktop Energy Saver freezes only CPU-intensive background tabs. — [Chrome for Developers: Freezing on Energy Saver (Jan 2025)](https://developer.chrome.com/blog/freezing-on-energy-saver)
- Maximiliano Firtman (2025 course): "on Android, it's five minutes, Chrome on Android"; an installed PWA behaves the same because it uses the same Chrome engine; on the lock screen or home screen the page counts as not visible. This is one expert's tested observation, not Google documentation. — [Frontend Masters: Observing Mobile Background JavaScript](https://frontendmasters.com/courses/background-javascript/observing-mobile-background-javascript)
- Firtman's article (19 May 2025): mobile apps are "often suspended rather than closed". When suspended, "the JavaScript context remains in memory, but main execution is paused." Installed PWAs have "standalone rights, so their lifecycle is similar to native apps". Periodic Background Sync fires "a maximum of once every 12 hours" and is Chromium-only. — [firt.dev: Understanding JS in the background](https://firt.dev/understanding-js-background/)
- A 2016 blink-dev thread notes that Android background tabs are suspended after about 5 minutes in the background. — [blink-dev: Intent to Ship: Expensive Background Timer Throttling](https://groups.google.com/a/chromium.org/d/msg/blink-dev/XRqy8mIOWps/Btb4o__1AQAJ)
- 2017 reporting: "Chrome on Android already heavily throttles (or outright kills) background tabs." — [Android Police](https://www.androidpolice.com/2017/03/14/google-introduces-background-tab-throttling-chrome-57-desktop/)

### Inferences
- The VizTime model (timestamps, plus `settle` so missed cues are never played late) fits Android well. On return, the page catches up from `endAt`.
- Unlike iPhone, where a home-screen web app is suspended almost at once, Android Chrome keeps some JS running for roughly the first minutes hidden (at 1-second granularity), then freezes. That window is not guaranteed, so docs should say the same thing as for iPhone: no cues while the app is in the background.
- Playing audio exempts a page from intensive throttling (per the Chrome 88 rules). Keeping a silent or near-silent tone playing to stay alive would be a "pretend" workaround, and a silent track does not count anyway. Not recommended, and against the project's honesty rule.
- After a long time hidden (renderer killed or tab discarded), reopening the app reloads the page. localStorage-backed sessions survive this.

### Gaps
- No current official Chrome documentation was found giving the exact freeze or discard timing for Android (including installed WebAPKs), or the effect of screen-off. The "5 minutes" figure rests on Firtman and a 2016 thread.
- No source found on Android Doze, App Standby buckets or OEM battery killers (Samsung "sleeping apps", Xiaomi and others) as they affect WebAPKs. Prior knowledge, unverified: a WebAPK's page runs inside Chrome's process, so Chrome's own standby bucket and OEM restrictions govern it, and aggressive OEM killers (dontkillmyapp.com) can kill Chrome's renderer sooner.

## 3. Notifications without a push server; scheduled local notifications; permission rules

### Takeaway
There is no way to schedule a local notification on the web without a push server. Notification Triggers is officially ended. A page can call `showNotification` while it is still running hidden (the first few minutes on Android, see Q2), but once it is frozen nothing fires. Unlike iPhone, Android Chrome supports notifications in an ordinary tab as well as in installed apps. Notifications inside a WebAPK's scope are shown as if posted by the WebAPK.

### Cited Findings
- "The development of Notification Triggers API, part of Google's capabilities project, has ended": "It wasn't clear that we could provide consistent and reliable experiences across platforms." It is listed under "No longer pursuing". The origin trial was completed; launch was never started. — [Chrome for Developers: Notification Triggers API](https://developer.chrome.com/docs/web-platform/notification-triggers)
- A Chromium commit (2017) makes Chrome hand off notifications within a WebAPK's URL scope to the WebAPK, "to look in the Android UI as if they were dispatched by the WebAPK." — [Chromium commit f3267da](https://chromium.googlesource.com/chromium/src.git/+/f3267daa0067ce785e944e8f778346a17b3f35c7)
- Android 13 made notifications a runtime permission (POST_NOTIFICATIONS), off by default for newly installed apps. — [Medium: Android 13 Notification Runtime Permission](https://umang91.medium.com/android-13-notification-runtime-permission-c3d122e4fd35) (third-party explainer)
- A vendor help article says browsers running installed PWAs block permission requests that are not tied to a click. It is third-party, not Chrome docs. — [Adalo help](https://help.adalo.com/actions/notifications/request-notification-permission-in-your-app)

### Inferences
- VizTime's approach (notify only while hidden, no push) gives Android users a "session finished" notification only if the session ends within the first few minutes after the app is hidden. Beyond that, no notification arrives. A dependable end-of-session alert on Android, as on iPhone, would need Web Push with a server, which the project's no-server design excludes.
- Request notification permission from a button tap. That is already good practice and avoids Chrome's quiet permission UI.

### Gaps
- Not verified from Chrome docs: how Chrome maps the web Notification permission to Android 13+ POST_NOTIFICATIONS for a WebAPK (whether the OS dialog appears and whether a per-WebAPK channel is created). Prior knowledge, unverified: since about Chrome 115 the WebAPK shows the Android system permission dialog and the permission is per app.
- Chrome's "quieter messaging" permission UI (auto-quieting for sites with low acceptance rates) was not re-verified for 2026.
- `showNotification` from a service worker after the page is frozen: the service worker itself does not wake without an event (push, sync), so nothing will fire. This follows from the API design, not a cited source.

## 4. Vibration API

### Takeaway
Unlike iPhone (no Vibration API in Safari), Chrome for Android supports `navigator.vibrate`. The spec requires sticky user activation (any earlier tap on the page) and a visible document, and it cancels a running vibration when the page is hidden. So vibration can only work as a cue while VizTime is open on screen.

### Cited Findings
- Spec: "If global does not have sticky activation, return false and terminate these steps." — [W3C Vibration API (Editor's Draft)](https://w3c.github.io/vibration/); also [W3C CRD May 2026](https://www.w3.org/TR/2026/CRD-vibration-20260521/)
- Spec: if the document's visibility state is not "visible", return false. When the top-level document's visibility changes, the user agent "MUST abort the already running processing vibration patterns algorithm." — [W3C Vibration API](https://w3c.github.io/vibration/)
- The spec lets implementations refuse for other reasons (no hardware, a user preference blocking an origin) and recommends global rate limiting. — [W3C Vibration API](https://w3c.github.io/vibration/)
- A web-platform test covers cancelling vibration when the page becomes hidden. — [WPT vibration/cancel-when-hidden-manual.html](https://chromium.googlesource.com/external/w3c/web-platform-tests/+/7af5152b079233c65d4596b8749faa62c121d432/vibration/cancel-when-hidden-manual.html)

### Inferences
- VizTime could offer vibration as an opt-in Comfort setting on Android ("Vibrate at the end, while the app is open"), feature-detected with `'vibrate' in navigator` and hidden where unsupported (iPhone), following the project's "hide, don't disable" rule. Any tap during setup gives sticky activation.
- It cannot replace a background alert: a hidden page gets `false`.

### Gaps
- Not verified this session: Chrome Android's exact behaviour (Chrome 60+ intervention requiring a user gesture; whether Chrome implements the "hidden returns false" step exactly). Prior knowledge: Chrome supports it since about Chrome 32 on Android. Samsung Internet supports it; Firefox for Android support is unverified.
- No source found on Do Not Disturb or "vibrate off" system settings. Prior knowledge, unverified: Android's touch-vibration and DND settings can suppress web vibration, depending on the device.

## 5. Audio (Web Audio): autoplay rules, background, ringer and silent mode

### Takeaway
The cited Chrome throttling rules exempt a page that "has made sound in the past 30 seconds" from intensive throttling, so Chrome treats audible pages specially. The AudioContext autoplay rules, background playback, and ringer versus media volume were not confirmed from primary sources this session (see Gaps).

### Cited Findings
- Pages that made sound in the last 30 seconds get "minimal" throttling. A silent audio track doesn't count. — [Chrome for Developers: Chrome 88 timer throttling](https://developer.chrome.com/blog/timer-throttling-in-chrome-88)
- Media playback and PiP can let code keep running while audio or video plays in the background (general statement). — [firt.dev](https://firt.dev/understanding-js-background/)

### Inferences
- VizTime's tones are short and only play at cue moments, so they will not keep the page alive. Background tones on Android will work only in the brief window before freezing.

### Gaps
- Prior knowledge, unverified this session: Chrome's autoplay policy (Chrome 66+/71+ for Web Audio) creates an AudioContext in the "suspended" state until a user gesture, after which `resume()` works. Unlike iPhone, Android has no hardware silent switch muting web audio. Web audio plays on the media (music) stream, so it follows media volume, not ring volume, and plays even when the phone is set to silent or vibrate unless media volume is down. DND normally does not mute media. This matters for clinic use and should be verified on a device.

## 6. speechSynthesis on Android Chrome

### Takeaway
It works in Chrome for Android via the system text-to-speech engine, but it is less dependable than on desktop: some events (`boundary`, pause/resume) misbehave, and the voice may be fixed to the device default.

### Cited Findings
- On Android Chrome the pause/resume workaround for long utterances stops speech and never fires `end` or `cancel` events. — [PhET utterance-queue issue #60](https://github.com/phetsims/utterance-queue/issues/60)
- The `boundary` event does not fire on Chrome and Firefox on Android. The voice cannot be changed from the device's default voice on Chrome or Firefox for Android. — [Coder's Block: JavaScript text to speech and its many quirks](https://codersblock.com/blog/javascript-text-to-speech-and-its-many-quirks/)
- One user reports that speechSynthesis on Opera for Android gives no audio, no errors and no events. — [Opera forums](https://forums.opera.com/uid/87151)

### Inferences
- VizTime's short spoken cues (one sentence, no pause/resume) avoid the known breakages. Don't rely on `onend` to sequence other behaviour. Speech while hidden is subject to the same freeze as everything else.
- Docs could say: "Spoken cues use your phone's text-to-speech voice."

### Gaps
- No source found on Android speech behaviour while the page is hidden or the screen is off, on whether a user gesture is required first, or on `getVoices()` timing on Android in 2026.

## 7. Screen Wake Lock

### Takeaway
It is supported on Chrome for Android and on Firefox for Android (version given as 126 by MDN). A request can be refused or revoked by the system, typically for low battery or battery saver. The lock is released when the page is hidden and must be re-requested on return. Prior knowledge: iPhone home-screen apps have supported Wake Lock since iOS 18.4.

### Cited Findings
- caniuse lists the Screen Wake Lock API as supported in Chrome for Android (current version 147) and Firefox for Android (149). — [caniuse: Screen Wake Lock](https://caniuse.com/wake-lock)
- MDN-derived docs: a request can be rejected for system reasons such as low battery, and the system can revoke a granted lock, so handle `release`. — [w3cub mirror of MDN: Screen Wake Lock API](https://docs.w3cub.com/dom/screen_wake_lock_api)
- Sources disagree on the first Firefox for Android version: MDN says 126, caniuse shows 149 as the current supported version. The old Mozilla Android bug was closed as incomplete. — [caniuse](https://caniuse.com/wake-lock); [Bugzilla 1054113](https://bugzilla.mozilla.org/show_bug.cgi?id=1054113)

### Inferences
- VizTime's existing pattern (request while a session runs, re-request on `visibilitychange`) carries over unchanged. Battery saver may make the screen dim anyway, and docs should say so.

### Gaps
- No primary Chrome source found confirming whether Chrome Android denies wake lock while Android Battery Saver is on (it is allowed by spec; implementation unverified). Samsung Internet support was not checked this session.

## 8. Picture-in-picture

### Takeaway
Document Picture-in-Picture does not exist on any Android browser. Video PiP (a `<video>` playing a canvas `captureStream`) is available on Chrome for Android, and Chromium added an automatic-PiP flag for Android in late 2025. Whether a canvas-stream video keeps painting in PiP after the page is backgrounded was not confirmed.

### Cited Findings
- caniuse: Document PiP is supported in Chrome desktop from version 116; it is not supported in Chrome for Android, Firefox for Android or Samsung Internet. — [caniuse: DocumentPictureInPicture](https://caniuse.com/mdn-api_documentpictureinpicture_window)
- The Chromium Intent to Ship left Android out because Android's APIs don't easily support always-on-top windows that accept arbitrary interaction. A later comment says Android input support would need changes to Android itself. — [blink-dev: Intent to Ship: Document picture-in-picture](https://groups.google.com/a/chromium.org/g/blink-dev/c/JTPl7fM64Lc)
- Chrome for Android has long supported video PiP: play a video fullscreen, press Home, and it moves into PiP automatically. — [Radiant Media Player PiP docs](https://www.radiantmediaplayer.com/docs/latest/pip.html)
- October 2025: a Chromium commit added a flag for automatic PiP on Android, like desktop (media minimizes when switching tabs), with per-site allow or block. Shipping status was not confirmed. — [Android Authority](https://www.androidauthority.com/chrome-for-android-pip-3607497/)

### Inferences
- VizTime's fallback path (canvas `captureStream` to video PiP) is the only floating-window option on Android. Feature-detect `document.pictureInPictureEnabled` and hide the control when unavailable.
- Because the page is hidden while in PiP, the canvas drawing loop is subject to the same throttling and freezing. A PiP of a canvas that only redraws on the page's timer may stop updating. Pages with active media may get some exemption (Chrome 88 rules exempt audible pages; video PiP status is unverified). Needs device testing.
- Compared with iPhone: iOS Safari supports video PiP in the browser, but behaviour for home-screen web apps differs. The iPhone researcher should confirm.

### Gaps
- No source on whether auto-PiP applies to installed WebAPKs, or whether it has shipped to stable by November 2026.
- No source on canvas `captureStream` in PiP on Android continuing to paint when the page is hidden or the screen is off.

## 9. Storage: persistence, eviction, quotas, separation from browser tabs

### Takeaway
Chrome grants `navigator.storage.persist()` silently, without a prompt, based on heuristics that include "installed or bookmarked" and notification permission. Installing VizTime therefore likely makes its storage persistent. Storage is per origin, and on Chrome Android the installed app and Chrome tabs are the same browser profile.

### Cited Findings
- Chromium browsers "automatically handle the permission request, and do not show any prompts". If the site is considered important, persistence is granted automatically, otherwise silently denied, and it can be re-requested. Heuristics include site engagement, whether the site is installed or bookmarked, and whether notification permission is granted. — [web.dev: Persistent storage](https://web.dev/persistent-storage)
- Under storage pressure, browsers evict non-persistent data from the least recently used origin. — [web.dev: Persistent storage](https://web.dev/persistent-storage)
- A Chromium code review notes that a WebAPK "is using Chrome as a host and may share browsing data with the app." — [Chromium code review 2841193002](https://codereview.chromium.org/2841193002)

### Inferences
- Prior knowledge, unverified this session: on iOS a home-screen web app has storage separate from Safari tabs. On Chrome Android the installed app and a Chrome tab on the same origin share localStorage. A user who sets presets in a Chrome tab will see them in the installed app. The `viztime2:` namespace still matters because all `username.github.io` projects share the origin.
- VizTime could call `navigator.storage.persist()` once after install. This is cheap, invisible and harmless.

### Gaps
- Chrome's quota figures (prior knowledge: up to about 60% of disk per origin) were not re-verified. Firefox for Android and Samsung Internet storage separation and persistence for installed apps were not verified.

## 10. Android-specific gotchas: back gesture, status bar, edge-to-edge, text scaling, split-screen

### Takeaway
Two changes matter most. Chrome 135+ draws edge-to-edge on Android, so bottom-fixed controls need `env(safe-area-inset-bottom)`. Chrome Android, unlike iPhone Dynamic Type handling, by default ignores the OS font size for web content unless the page opts in with `<meta name="text-scale" content="scale">` (Chrome Android 146, March 2026). This bears directly on the project's 200% text check.

### Cited Findings
- Since Chrome 135, Chrome on Android can draw content to the bottom device edge by extending the viewport into the gesture navigation bar area. Pages opt in with `viewport-fit=cover`. Bottom-fixed elements should use `env(safe-area-inset-bottom)` for `bottom`, not `padding-bottom` (which causes layout thrash as the "chin" moves). `safe-area-max-inset-bottom` gives a stable maximum. — [Chrome for Developers: Chrome on Android edge-to-edge migration guide](https://developer.chrome.com/docs/css-ui/edge-to-edge)
- Chromium's display cutout doc covers safe-area insets and `viewport-fit` modes (auto, contain, cover). — [Chromium docs: Display Cutout and Safe Area Insets](https://chromium.googlesource.com/chromium/src/+/141.0.7390.122/docs/ui/android/display_cutout.md)
- `<meta name="text-scale">` shipped in Chrome Android 146 (released 2026-03-10). It is not supported in Firefox, Safari or iOS Safari. With `content="scale"` the page follows the OS text size. The default "legacy" behaviour respects only Chrome's own font-size setting. — [web-features explorer: meta text-scale](https://web-platform-dx.github.io/web-features-explorer/features/meta-text-scale)
- Google's guidance: when opting in, don't set the root `font-size` explicitly; using `env(preferred-text-scale)` as well can double-scale; avoid `vw` for text. Only the default font size changes, so spacing scales only if `em`/`rem` are used. — [Chrome for Developers: Respect OS text scale](https://developer.chrome.com/docs/modern-web-guidance/guides/accessibility/respect-os-text-scale)
- Commentary: Chrome historically doesn't respect OS font size for web content, while Firefox for Android scales whole pages. — [Adrian Roselli, Feb 2026](https://adrianroselli.com/2026/02/honoring-mobile-os-text-size.html); [Manuel Matuzović, 2026](https://matuzo.at/blog/2026/text-scaling-meta-tag)

### Inferences
- Adding `<meta name="text-scale" content="scale">` (with rem-based CSS and no fixed root font-size) would make VizTime honour the Android system font size in Chrome 146+. It is small, has no dependencies and fits the accessibility goals. Check that the layout holds at Android's largest font settings.
- Docs for Android users: until that tag is added, text size follows Chrome's own Accessibility text-scaling setting, not the phone's font size.
- Compared with iPhone: an iOS home-screen app has no system back gesture. On Android the system back gesture or button exists in standalone mode (see Gaps).

### Gaps
- No source found this session on the back gesture or button in standalone WebAPKs. Prior knowledge, unverified: back goes through the page's history, and with no history it closes or leaves the app, so an app that uses in-page panels without `history` entries will exit on back.
- Status bar colour from `theme_color` and `<meta name="theme-color">` in a WebAPK, including dark-mode `media` variants: not verified this session.
- Split-screen and freeform windows (Android multi-window, Samsung DeX and pop-up view) for WebAPKs: no source found. Prior knowledge, unverified: a WebAPK can run in split-screen like any app, and the page stays visible (not throttled) while on screen. That may serve as Android's practical substitute for a floating window, alongside video PiP.
