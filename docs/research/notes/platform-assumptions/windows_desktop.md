# VizTime on Windows 11 desktop (Chrome / Edge): floating window, background tabs, cues — as of November 2026

Scope: a static PWA that opens a Document Picture-in-Picture (PiP) window (`documentPictureInPicture.requestWindow`) on Chromium browsers, falls back to video PiP of a canvas `captureStream`, ticks with a 1 s `setInterval` in the opener, and uses Wake Lock, Web Audio, `speechSynthesis` and Notifications. Nothing below was tested on a real device in this research pass; claims come from docs and Chromium source. "Untested" marks things that need a hands-on check.

## Document Picture-in-Picture: support, size, lifecycle, always-on-top

### Takeaway
Document PiP ships in Chrome/Edge 116+ and, new in 2026, in Firefox 151 (desktop). Safari still lacks it. Chromium clamps the window to at least **240 px wide** (inner), so a 200 × 200 request becomes about 240 × 200 and the user can't shrink it narrower. The window floats on top, needs a user click to open, allows one per tab, and dies with the opener tab. Size and position are remembered only per tab and origin, in memory.

### Cited Findings
- Support: Chrome 116, Edge 116, Firefox 151. Safari not supported. Launch status "Complete (Desktop)". — [Chrome for Developers: Document PiP](https://developer.chrome.com/docs/web-platform/document-picture-in-picture)
- Firefox 151 added Document PiP on desktop (bug 2006594). It was released around 18–19 May 2026. — [MDN Firefox 151 release notes](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/151); [Bugzilla 2006594](https://bugzilla.mozilla.org/show_bug.cgi?id=2006594); [Phoronix](https://www.phoronix.com/news/Firefox-151)
- Features by Chrome version:
  - resizing (`resizeTo`/`resizeBy`): Chrome 121
  - `window.focus()` of the opener from the PiP window, and the CSS `display-mode: picture-in-picture`: Chrome 123
  - `disallowReturnToOpener` (hides the "back to tab" button): Chrome 124
  - `preferInitialWindowPlacement` (open at default position/size instead of reusing the previous one): Chrome 130
  - `copyStyleSheets`: no longer supported
  — [Chrome for Developers](https://developer.chrome.com/docs/web-platform/document-picture-in-picture)
- The spec only lets UAs "clamp or ignore" width/height that are too large or too small. It defines no minimum, and says the UA "should restrict the maximum size". Passing only one of width/height (non-zero) throws `RangeError`. — [WICG spec](https://wicg.github.io/document-picture-in-picture/)
- **Chromium size constants** (main branch, `picture_in_picture_window_manager.cc`):
  - `kMinWindowSize(240, 52)` on desktop (Android: 220 × 220)
  - `kMaxWindowSizeRatio = 0.8` of the display, for the window the user resizes
  - `kMaxSiteRequestedWindowSizeRatio = 0.25`: the area a site requests is capped at 25% of the display area, keeping the aspect ratio. The user can still resize up to 80%.
  - The requested size is then `SetToMax(minimum)` / `SetToMin(maximum)`.
  - With no size given, the default is 1/5 of the work area at a 1:1 aspect ratio.
  — [Chromium source](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/picture_in_picture/picture_in_picture_window_manager.cc)
- **Remembered bounds:** `PictureInPictureBoundsCache` is `WebContentsUserData`, so it is per tab and in memory only; no persistence is shown. A cached size/position is reused only if:
  - the origin matches,
  - the requested size equals the previously requested size, and
  - the opener hasn't moved to a different display.
  `preferInitialWindowPlacement: true` makes Chromium ignore the cached bounds. — [Chromium bounds cache source](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/picture_in_picture/picture_in_picture_bounds_cache.cc); [window manager source](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/picture_in_picture/picture_in_picture_window_manager.cc)
- Chromium fixed a bug (June 2024) where an **installed web app** overwrote the requested Document PiP size, so the requested inner size was ignored. — [Chromium commit a576139](https://chromium.googlesource.com/chromium/src/+/a576139534537ed3198df5d711164dfdf7b50242)
- `requestWindow()` rejects without a user gesture. `resizeTo`/`resizeBy` and focusing the opener also need a gesture. The spec says it throws `NotAllowedError` without transient activation, and success consumes the activation. — [Chrome for Developers](https://developer.chrome.com/docs/web-platform/document-picture-in-picture); [WICG spec](https://wicg.github.io/document-picture-in-picture/)
- A user click inside the PiP window can count as activation in the opener (WPT "Propagate user activation to the opener"). — [WPT release note](https://newreleases.io/project/github/web-platform-tests/wpt/release/merge_pr_45621)
- One window per top-level traversable: "at most one document picture-in-picture window open at a time". Opening a new one closes the previous one. Whether the limit is browser-wide is up to the implementation. — [WICG spec](https://wicg.github.io/document-picture-in-picture/)
- The PiP window closes when:
  - the opener document is destroyed or navigates
  - the PiP document itself navigates
  - the user closes it
  - the site calls `close()`
  `pagehide` fires in the PiP window when it closes. The window "never outlives the opening window". — [WICG spec](https://wicg.github.io/document-picture-in-picture/); [Chrome for Developers](https://developer.chrome.com/docs/web-platform/document-picture-in-picture)
- Other restrictions:
  - Sites can't position the window; `moveTo`/`moveBy` are disabled.
  - The PiP window can't go fullscreen.
  - It is secure-context only.
  - The UA must show the controlling origin.
  - Size/position must not be reused across origins.
  — [WICG spec](https://wicg.github.io/document-picture-in-picture/)
- The window "floats on top of other windows". — [Chrome for Developers](https://developer.chrome.com/docs/web-platform/document-picture-in-picture)
- Chromium hides PiP windows ("tucks" them) while a file dialog is open. — [Chromium commit 923d0ec](https://chromium.googlesource.com/chromium/src/+/923d0eca9ed86960af9e735f8a4b2271fa17fb37)
- The Windows occlusion doc says "floating" windows are not treated as occluding the Chrome windows beneath them. — [Chromium docs: Windows native window occlusion](https://chromium.googlesource.com/chromium/src/+/main/docs/windows_native_window_occlusion_tracking.md)

### Inferences
- A 200 × 200 request in Chrome/Edge on Windows will open about **240 px wide** inner (height 200 is allowed). The smallest window possible is 240 × 52 inner plus the title bar. The 200 × 200 floating-window test in CLAUDE.md can't be reproduced in Document PiP on Chromium; it can only be approximated at 240 wide. Layouts should be checked at 240 × 200 inner. Firefox's minimum is unknown.
- The user's resize is remembered only while the same tab stays open, and only if the app keeps requesting the same width/height. After a browser restart or a new tab, the window opens at the app's requested size again. If the app wants to restore the user's preferred size, it has to save it itself (via `store.js`) and request it. Passing `preferInitialWindowPlacement` would throw away the user's placement within a tab, so VizTime probably should not set it.
- The PiP window can't open on page load or after a reload; each open needs a click. If the opener tab reloads (update, crash, discard), the PiP window closes and the user must click again.
- Firefox 151+ now takes the Document PiP path if VizTime feature-detects `documentPictureInPicture` rather than sniffing the browser name. Its behaviour (min size, throttling) is untested.

### Gaps
- Firefox 151's min/max sizes and whether it remembers bounds: no source found.
- Edge and Vivaldi forks: assumed to share Chromium's constants. Not confirmed; Edge could change them.
- Whether Document PiP stays above **exclusive full-screen** apps (games, some video players) or above other always-on-top windows: no source. Untested. Borderless "full-screen" windows like a browser F11 are probably still covered by a topmost window, but that's unverified.
- Behaviour with the opener on a different Windows virtual desktop: does the PiP window follow, and does it show on all desktops? Not documented. Untested.
- Focus stealing: when the window opens from a click, it probably takes focus, while auto-PiP windows are documented as "not focused when opened" (see the auto-PiP section). Keyboard input inside a Document PiP window works like a normal window per the explainer model, but no source states it outright. Untested.

## Timer throttling: opener tab hidden or minimised, and does PiP exempt it?

### Takeaway
A hidden page in Chrome/Edge gets timer wake-ups aligned to 1 s. After **5 minutes hidden, silent for 30 s, with chained timers**, wake-ups drop to **once per minute** (intensive throttling, Chrome 88+). Windows occlusion tracking also treats a Chrome window that is fully covered, minimised, on another virtual desktop, or behind a locked screen as background. No source confirms that an open **Document** PiP window exempts its opener. A 2019 Chromium change exempts tabs with a **video** PiP. So VizTime's 1 s tick in the opener tab may run once a minute when the main window is minimised.

### Cited Findings
- Throttling tiers (Chrome 88, January 2021):
  - **Minimal:** the page is visible, or made noise in the last 30 s.
  - **1 s alignment:** the page has been hidden under 5 min, OR the chain count is under 5, OR WebRTC is in use.
  - **Intensive, 1 min alignment:** hidden over 5 min AND chain count ≥ 5 AND silent for at least 30 s AND no WebRTC.
  - A silent audio track doesn't count as noise. A visible page is never intensively throttled.
  — [Chrome blog: timer throttling in Chrome 88](https://developer.chrome.com/blog/timer-throttling-in-chrome-88)
- Older budget throttling (Chrome 57): applies after 10 s in the background, with a budget that regenerates at 10 ms per second. Tabs playing audio count as foreground, and WebSockets/WebRTC tabs are exempt from budget throttling. — [Chrome blog: background tabs in Chrome 57](https://developer.chrome.com/blog/background_tabs); [MDN Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- `visibilityState` is "hidden" when the tab is in the background, the window is minimised, or the screen is off. `visibilitychange` also fires when the document is "entirely obscured by another window". — [MDN Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- Windows native occlusion in Chromium:
  - On occluded windows, "Chromium treats foreground tabs as if they were background tabs; rendering stops, and js is throttled."
  - Minimised windows are hidden; windows on other virtual desktops count as occluded.
  - If the screen is locked, all Chromium windows are marked OCCLUDED.
  - Floating/transparent/cloaked windows don't count as occluding.
  — [Chromium docs: Windows native window occlusion](https://chromium.googlesource.com/chromium/src/+/main/docs/windows_native_window_occlusion_tracking.md)
- 2019 commit "Don't throttle hidden tab in Picture-in-Picture" (Jan 2019, `web_contents_impl.cc`): a tab with a PiP **video** isn't throttled when hidden, though the renderer is still told it's hidden. — [Chromium commit 0e27cee](https://chromium.googlesource.com/chromium/src/+/0e27cee0958bb04cd14067c4a2b1eeca4b8b9f64)
- The Document PiP spec notes that UAs "typically suspend rendering and throttle script execution" in minimised or invisible windows. It asks implementers to consider the effect on the opener, and encourages developers to **put application logic inside the PiP window**. — [WICG spec §6.2](https://wicg.github.io/document-picture-in-picture/)
- Edge: `--disable-background-timer-throttling` is reported as not honoured in Edge (one later reply says it worked). This is a user Q&A, not official. — [Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/1691638/disable-throttling-of-background-timers)
- Chrome Energy Saver (on battery, or when enabled) stops "eligible CPU-intensive background tabs". Tabs playing audio or in video calls are unaffected. — [Google Chrome Help: performance](https://support.google.com/chrome/answer/12929150?hl=en)
- Edge energy saver (formerly efficiency mode) changes background tab activity and puts inactive tabs to sleep after 30 minutes or less, or 5 minutes at the maximum setting. It is on when unplugged, or always if "Use energy saver even when connected to power" is on. — [Microsoft Support: Edge performance features](https://support.microsoft.com/en-us/edge/learn-about-performance-features-in-microsoft-edge)

### Inferences
- Worst case: the clinician minimises the browser, or covers it with a full-window EHR app. The opener goes hidden. After about 5 minutes, VizTime's opener `setInterval` (chain count ≥ 5) could fire only once a minute, so cue sounds and "Session finished." notifications could be up to about 60 s late. Rendering in the opener also stops. VizTime is timestamp-based, so it catches up correctly, but **on-time** cues are not guaranteed by the opener tick alone.
- Safer designs, all untested:
  - Run the tick (and play cues) from the PiP window's own timers, `pipWindow.setInterval`. The PiP document is a separate, visible page, which matches the spec's advice.
  - Schedule each cue as a single `setTimeout` to the exact cue time, rather than relying on a 1 s chained interval. Intensive throttling counts chain depth, though a lone timer in a hidden page still gets 1 s alignment.
  - Keep Web Audio actually producing sound. It must be audible: a silent track doesn't count, per Chrome.
- The video-PiP fallback may exempt the opener from throttling (2019 commit). The canvas repaint `setInterval` lives in the same opener, so this is circular. It's worth checking whether the 500 ms repaint keeps running when minimised.
- In Edge, energy saver is mostly a battery feature. A clinic desktop on mains power is affected only if "always" is turned on. A laptop on battery would be affected.

### Gaps
- No primary source says whether a Chromium **Document** PiP window keeps the opener counted as visible or unthrottled. This is the key unknown. It needs a test: open PiP, minimise the main window, log `Date.now()` deltas in the opener's `setInterval` for 10+ minutes (or use the `grace_period_seconds/10` flag noted in the Chrome 88 blog to speed this up).
- Whether timers in the PiP window's own realm are throttled when the PiP window is visible but the opener is minimised: untested. It's probably not throttled, since the PiP document is visible, but that's unconfirmed.
- Whether Edge adds throttling beyond Chromium's (e.g. a sleeping-tab freeze ahead of discard) for tabs with a PiP: no source.

## Tab discarding and sleeping: Chrome Memory Saver, Edge sleeping tabs

### Takeaway
Chromium won't discard a tab that owns a video **or Document** PiP window (code-confirmed). Chrome also keeps tabs active that play audio, have page notifications, or are pinned. Edge's sleeping tabs (which freeze timers) has a documented exemption list that **does not mention PiP or notifications**, only audio and capture. The robust fix is adding the GitHub Pages origin to "Always keep these sites active" in both browsers.

### Cited Findings
- Chromium commit "pip2: Don't discard tabs that own a picture-in-picture window": discard checks test `HasPictureInPictureVideo() || HasPictureInPictureDocument()` in `tab_lifecycle_unit.cc` and `performance_manager_tab_helper.cc`. It adds a `kPictureInPicture` cannot-discard reason (bug 1446327, commit position ~1210398, which is roughly Chrome 116/117 era; exact version unconfirmed). — [Chromium commit 52b496d](https://github.com/chromium/chromium/commit/52b496d98211bad0ff1153f36e4ffc7953bdfd15); [cannot_discard_reason.h](https://chromium.googlesource.com/chromium/src/+/79f7967b24abbbdc346c20c69a50c67b22a97b51/chrome/browser/performance_manager/policies/cannot_discard_reason.h)
- Chrome Memory Saver (Settings → Performance) has Moderate, Balanced (recommended) and Maximum modes. A deactivated tab reloads when you return to it. The help page lists these as preventing deactivation:
  - active audio or video
  - screen share
  - **page notifications**
  - active downloads
  - partially filled forms
  - **pinned tabs**
  - connected USB/Bluetooth devices
  PiP isn't listed in the help page. — [Google Chrome Help](https://support.google.com/chrome/answer/12929150?hl=en)
- How to add the Chrome exception: Settings → Performance → "Always keep these sites active" → Add → "Add current sites" or "Add sites manually". Pattern `[scheme://][.]host[:port][/path]`; a bare domain covers its subdomains, and a path limits it to that subdirectory. — [Google Chrome Help](https://support.google.com/chrome/answer/12929150?hl=en)
- Edge sleeping tabs:
  - Background tabs sleep after **2 hours** of inactivity by default. The time is changeable under Settings → System and performance → Performance.
  - The exception list is called "Always keep these sites active" (older name: "Never put these sites to sleep").
  - Exempt: the visible tab, audio playing, window/screen capture, user media capture, casting, DevTools, WebUSB, intranet sites, block-listed sites, and pages sharing a BrowsingInstance.
  — [Microsoft Support: Edge performance features](https://support.microsoft.com/en-us/edge/learn-about-performance-features-in-microsoft-edge)
- Edge sleeping is built on Chromium freezing, which "pauses a tab's script timers". Discarding removes the page so it fully reloads. The Edge Insider FAQ (Sept 2020) also exempts pages holding a Web Lock or IndexedDB transaction. — [Edge Insider: Sleeping tabs FAQ](https://techcommunity.microsoft.com/t5/articles/sleeping-tabs-faq/td-p/1705434)
- Edge enterprise policy `SleepingTabsBlockedForUrls`: listed sites aren't put to sleep and are "also excluded from other performance optimizations like efficiency mode and tab discard". If `SleepingTabsEnabled` is disabled, nothing sleeps. — [Microsoft Learn: SleepingTabsBlockedForUrls](https://learn.microsoft.com/en-my/deployEdge/microsoft-edge-policies/sleepingtabsblockedforurls)
- User reports say the Edge exception list sometimes doesn't stop sleeping (anecdotal). — [ElevenForum guide](https://elevenforum.com/t/add-and-remove-sites-from-sleeping-tabs-exclude-list-in-microsoft-edge.7448/)

### Inferences
- A VizTime tab sitting in the background all clinic day (more than 2 h) in Edge, with no PiP open and no sound, is a candidate to **sleep**, which freezes its timers. With a Document PiP open, Chromium's discard protection applies, but Edge's documented *sleep* exemptions don't mention PiP. Freezing a tab that owns a visible PiP window would probably freeze the PiP content too, since it's the same page/agent. This is likely but untested.
- Practical user guidance:
  - Chrome: Settings → Performance → "Always keep these sites active" → Add → enter `username.github.io/<repo>`.
  - Edge: Settings → System and performance → Performance → "Always keep these sites active" → Add.
  - Pinning the tab also protects it in Chrome.
  - Note that on GitHub Pages, adding just `username.github.io` would also exempt every other project on that account; a path entry is narrower.
- The VizTime docs should say plainly that this setting is needed for all-day reliability on Windows.

### Gaps
- Whether an installed PWA window (app window) is subject to Memory Saver / sleeping tabs the same way as a tab: no source found. Untested.
- The exact Chrome version that shipped PiP discard protection: not confirmed.
- Edge-specific handling of PiP for sleeping (not discarding): no source.

## Notifications on Windows 11

### Takeaway
Chrome and Edge use native Windows notifications, so Windows 11 **Do Not Disturb** and its automatic rules (including full-screen/gaming and display-duplication rules) can silently hold back "Session finished." unless the browser is on the priority list. Notifications are a backup, not a reliable cue.

### Cited Findings
- Chrome moved to native Windows 10 notifications starting with Chrome 68 (2018). They respect Focus Assist and Action Center settings. The old `chrome://flags/#enable-native-notifications` flag existed then; its 2026 status is unverified. — [Windows Central](https://windowscentral.com/chrome-starts-rolling-out-support-native-windows-10-notifications); [Wccftech](https://wccftech.com/chrome-native-windows-10-notifications/)
- Windows 11 renamed Focus Assist to **Do Not Disturb** (build 22557+). It can turn on automatically by schedule, during games, when duplicating the display, and similar. Apps on the priority list bypass DND. Since 22H2 (KB5030310), urgent notifications that break through during full-screen apps show a "view notification" button. These are third-party guides; no official MS English page was retrieved. — [ElevenForum: DND priority](https://www.elevenforum.com/t/set-priority-notifications-for-do-not-disturb-in-windows-11.4743); [ElevenForum: DND on/off](https://www.elevenforum.com/t/turn-on-or-off-do-not-disturb-for-notifications-in-windows-11.4738/); [NinjaOne](https://www.ninjaone.com/blog/priority-notifications-for-do-not-disturb/)
- With automatic rules on, DND can re-enable itself even after being turned off manually. — [Geekrewind](https://geekrewind.com/how-to-turn-on-or-off-do-not-disturb-automatically-in-windows-11/)
- Chrome Memory Saver treats "page notifications" as a reason to keep a tab active. — [Google Chrome Help](https://support.google.com/chrome/answer/12929150?hl=en)

### Inferences
- Duplicating the display (a common clinic setup for showing patients a screen) can trigger DND under the automatic rules, which would suppress VizTime's notification. Users should add Chrome/Edge to Windows priority notifications, or switch that rule off. Note: a notification toast is visible to patients too. "Session finished." is neutral wording, so that's acceptable.
- A notification shown from the service worker (`registration.showNotification`) still depends on the browser process running, and on the page getting to run its timer on time (see throttling).

### Gaps
- Chrome's "quieter messaging" UI for permission prompts (auto-quiet for sites with low grant rates or by user setting): not researched due to budget. Not sourced here.
- Official Microsoft documentation for Windows 11 DND rules: not retrieved (only third-party guides).
- Whether Windows still shows toast banners over **exclusive** full-screen apps: not confirmed.

## Audio and speechSynthesis in background tabs and the PiP window

### Takeaway
Web Audio needs a user gesture before it can run (autoplay policy since Chrome 71). Once it is running, sound counts as "noise", which exempts the page from intensive throttling for 30 s. Chrome's `speechSynthesis` has known bugs where it stops mid-utterance with Google voices. Nothing documents whether a context in a minimised opener keeps playing on cue.

### Cited Findings
- Autoplay and Web Audio:
  - Since Chrome 71, an `AudioContext` created before a user gesture starts "suspended". Call `resume()` in a gesture, or `start()` a node after a gesture.
  - MEI qualifying playback needs more than 7 s of playback, unmuted audio and an active tab. MEI autoplay is desktop-only.
  - PWA install on desktop is another route to qualify.
  - The page doesn't say whether a running context continues in the background.
  — [Chrome blog: Autoplay policy](https://developer.chrome.com/blog/autoplay)
- Pages that make sound count as noise for the Chrome 88 throttling rules; a silent audio track doesn't. — [Chrome blog: timer throttling](https://developer.chrome.com/blog/timer-throttling-in-chrome-88)
- Chrome `speechSynthesis` stops partway through long utterances with Google-provided voices while `speaking` still reports true. The workaround is pause/resume about every 14 s; there's an open Chromium bug (2025 report). — [Caktus Group, Nov 2025](https://www.caktusgroup.com/blog/2025/11/03/the-halting-problem/); [PhET issue](https://github.com/phetsims/utterance-queue/issues/60)
- Chromium silences other tabs' speech when one tab starts speaking, unlike Firefox/Safari. — [IBM iX engineering blog](https://engineering.ibmix.de/blog/2024/08/speechless-in-the-frontend)

### Inferences
- VizTime's short tones and two-word speech ("Session finished.") are short enough to avoid the long-utterance bug. Another tab that speaks (an EHR dictation tool, say) could interrupt it.
- A tone played on time from a throttled opener plays late, because the timer firing it is late. Scheduling tones ahead on the `AudioContext` clock (`osc.start(ctx.currentTime + secondsUntilCue)`) runs on the audio thread and isn't subject to JS timer throttling. This is untested but a plausible mitigation, and only works while the context stays "running".

### Gaps
- Whether Chrome/Edge suspend a running `AudioContext` in a minimised or occluded tab: no source found. Untested.
- Whether `speechSynthesis.speak()` called from a hidden tab or from the PiP window's realm speaks on Windows: no source. Untested.
- Whether the Media Engagement Index affects Web Audio: the Chrome page doesn't say.

## Screen Wake Lock on desktop

### Takeaway
A wake lock can be acquired only by a visible, active document and is released automatically when that document is hidden. So a lock taken in the opener is lost when the main window is minimised, even with PiP showing. Whether requesting it from the PiP window's own `navigator` works is undocumented.

### Cited Findings
- Requests are rejected if the document isn't active or visible. The system can release the lock when the document becomes hidden, and pages should re-acquire it on `visibilitychange`. It is secure-context only, under the `screen-wake-lock` permissions policy (default `self`). Baseline 2025 (March 2025). MDN doesn't mention PiP. — [MDN Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)
- Chromium marks all windows occluded when the screen is locked, which ends visibility. — [Chromium occlusion doc](https://chromium.googlesource.com/chromium/src/+/main/docs/windows_native_window_occlusion_tracking.md)

### Inferences
- If the opener window is covered or minimised, the wake lock goes. Windows' own display-off timeout could then blank a clinic screen during a session. A workaround to test: call `pipWindow.navigator.wakeLock.request('screen')` from inside the PiP document (visible), with the opener's lock as a fallback. Untested.
- Many clinic PCs have Group Policy screen-lock timeouts. Wake Lock won't override an enforced lock policy (not sourced; general expectation).

### Gaps
- Whether a visible Document PiP window's document can hold a wake lock in Chrome/Edge: no source. Untested.

## Installed PWA windows (Chrome/Edge "Install app")

### Takeaway
Installing the app gives a taskbar entry and its own window, and counts toward autoplay eligibility. It gives **no always-on-top**: always-on-top on Windows is available only through PiP. One Chromium bug once made installed apps ignore the requested PiP size (fixed in 2024).

### Cited Findings
- Desktop PWA install is one of the ways to qualify for autoplay with sound. — [Chrome blog: Autoplay policy](https://developer.chrome.com/blog/autoplay)
- The Document PiP window from an installed web app had its initial size overwritten by `AppBrowserController`; this was fixed in June 2024 (bugs 348476064, 41459774). — [Chromium commit a576139](https://chromium.googlesource.com/chromium/src/+/a576139534537ed3198df5d711164dfdf7b50242)
- Only PiP windows float on top. The Document PiP docs describe always-on-top as the PiP window's distinguishing property. — [Chrome for Developers](https://developer.chrome.com/docs/web-platform/document-picture-in-picture)

### Inferences
- An installed VizTime window still goes hidden or occluded (and throttled) when covered or minimised, just like a tab. Installing doesn't fix throttling. Its benefits are a cleaner standalone window and a taskbar icon to find it again.

### Gaps
- Whether installed PWA windows are excluded from Memory Saver discard or Edge sleeping tabs: no source found.
- `window-controls-overlay` and Additional Windowing Controls on Windows 11 in 2026: not researched within budget. No always-on-top API is known for normal PWA windows (unsourced; based on general knowledge).

## 2025–2026 changes relevant to VizTime

### Takeaway
Since 2025 the main changes are Firefox 151 shipping Document PiP (May 2026) and Chrome expanding *automatic* PiP for media sites. Automatic PiP doesn't apply to a timer page, but it shows how Chrome treats such windows: not focused when opened, and auto-closed when the page becomes visible.

### Cited Findings
- Chrome 120: video-conferencing sites can auto-open PiP on tab switch. Chrome 134 (early 2025): media-playback sites can too, if they meet these conditions:
  - audible within the last 2 s
  - holding audio focus
  - a registered `enterpictureinpicture` media session handler
  - above the MEI threshold
  - a user permission prompt (every time / this time / never)
  If another PiP is already open, auto-PiP doesn't trigger. Auto-PiP windows aren't focused when opened and close automatically when the page becomes visible. — [Chrome blog: automatic PiP for media playback](https://developer.chrome.com/blog/automatic-picture-in-picture-media-playback?hl=en)
- Chrome 142 introduced browser-initiated automatic PiP for sites without a media session handler (initially behind a flag, per the French-language blog). — [Chrome blog (FR)](https://developer.chrome.com/blog/automatic-picture-in-picture-initiated-by-the-browser?hl=fr)
- Firefox 151 (May 2026) shipped Document PiP on desktop. — [MDN Firefox 151](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/151)

### Inferences
- If VizTime ever registered an `enterpictureinpicture` handler to auto-open its floating window on tab switch, it would need audible media. That rules it out for silent Work mode, so it isn't a fit.
- Since another site's open PiP blocks a new one only where the browser limits PiP globally (implementation-defined), a clinic user who has a video PiP open elsewhere might see VizTime's request fail or replace that window. Untested.

### Gaps
- No Chrome 140–146 or Edge 2026 release notes changing Document PiP, throttling, or Memory Saver were found within budget. Absence isn't confirmation.
- Safari's 2026 status for Document PiP is "not supported" per Chrome's table. No WebKit position was retrieved.
