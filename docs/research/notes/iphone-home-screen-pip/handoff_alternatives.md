# Hand-off and outside-the-web-app routes to a floating timer from the iPhone Home Screen app (iOS 26/27, as of November 2026)

Scope: VizTime's video picture-in-picture (PiP) Float works in a Safari tab but not in the Home Screen (standalone) web app. These notes cover (1) handing off to Safari or another container, (2) carrying the session across in the URL, (3) whether one tap is enough, (4) the iOS 26+ "Open as Web App" toggle, and (5) native-only surfaces (Live Activities, widgets, Clock, Shortcuts). Nothing here was tested on a device in this pass. "Untested" marks points that need a hands-on check with the project's check/ page.

Background already established in [the iPhone notes](../platform-assumptions/iphone.md): PiP is unsupported in Home Screen web apps (WebKit bug 303885, still open, last comment on iOS 26.6). Storage is separate between Safari and the installed app. Wake Lock works in Safari tabs from iOS 16.4.

## 1. What links and window.open do from a standalone Home Screen app, and whether PiP is available in the container that opens

### Takeaway
A standalone web app does not hand out-of-scope links to Safari. It opens them in an in-app browser view that WebKit configures with the web app's own manifest. That view is very likely the same "Home Screen web app" context where PiP is broken, though this is untested. No documented, supported way exists for a web page to force Safari. The `x-safari-https://` scheme is undocumented and reports on it conflict. In-scope links stay inside the web app. So "hand off to Safari with one tap" cannot be relied on; the dependable hand-off is a person-driven step, such as opening the address in Safari themselves or using a separate Safari bookmark icon.

### Cited Findings
- Links to external domains open in an in-app browser. A domain is external if "it's outside the PWA's installation scope", and subdomains also open in the in-app browser. On iOS, in-app browsers in PWAs use WebKit. The page says "there's no way to force a link to open in Safari or Chrome." (Progressier page, updated 2026; no iOS version given.) — [Progressier: In-App Browser PWA Demo](https://progressier.com/pwa-capabilities/in-app-browser)
- WebKit bug 250651 (filed Jan 2023, Safari 16, still NEW): for external `target=_blank` links opened from an installed web app with `display: standalone`, `matchMedia('(display-mode: standalone)')` is true in the opened page. Apple engineer David Quesada explains that the system creates a secondary web view for the opened window, configured with the web app's manifest. He also asks whether the manifest should apply to in-scope `window.open()` windows. — [WebKit bug 250651](https://bugs.webkit.org/show_bug.cgi?id=250651)
- Historical: a comment on a widely used gist reports that from an iOS 11.3 beta, links in standalone apps open in the in-app browser rather than jumping to Mobile Safari. Earlier posts (2012 era) describe links jumping out to Mobile Safari. — [gist irae/1042167 comments](https://gist.github.com/irae/1042167?permalink_comment_id=2578663); [Ben Nadel 2012](https://www.bennadel.com/blog/2302-preventing-links-in-standalone-iphone-applications-from-opening-in-mobile-safari.htm)
- An Apple Developer Forums question (Oct 2021, no replies) reports that a `target="_blank"` link from a Home Screen web app "opens a new browser page". In that case it went straight to the Files app for a download, and the user couldn't get back to the PWA. — [Apple Developer Forums 691529](https://developer.apple.com/forums/thread/691529)
- A Framework7 forum thread reaches the same conclusion: there is no way to call Safari from a PWA. — [Framework7 forum](https://forum.framework7.io/t/how-to-redirect-to-a-url-via-js/6917)
- PiP in Home Screen web apps: `requestPictureInPicture()` throws `NotSupportedError` or does nothing, and `webkitSupportsPresentationMode('picture-in-picture')` returns false while `document.pictureInPictureEnabled` stays true. The bug is NEW, P1, tracked internally as rdar://121964774, with its last comment on iOS 26.6 (2026-07-31). The bug's impact text is effectively "use Safari if you want PiP". — [WebKit bug 303885](https://bugs.webkit.org/show_bug.cgi?id=303885)
- The same 2026-07-31 comment notes that PiP did work when the page was added to the Home Screen from Firefox for iOS, which opens it with the browser's URL bar showing (that is, a browser tab rather than a standalone app). — [WebKit bug 303885](https://bugs.webkit.org/show_bug.cgi?id=303885)
- `x-safari-https://`: Apple doesn't document it. It began as a macOS Safari scheme and was reported working on iOS in 2023 ("tested on iOS 15/17/18", reportedly not iOS 16). — [Christian Tietze, 2023](https://christiantietze.de/posts/2023/05/safari-for-mac-url-scheme/); [gist felquis/a08ee196747f71689dcb](https://gist.github.com/felquis/a08ee196747f71689dcb?permalink_comment_id=4524007)
- Reports on `x-safari-https://` conflict through 2026:
  - "doesnt work anymore" on iOS 18.5 (Jun 2025).
  - Working on iOS 26 (Sep 2025, and Feb 22 2026 on iPhone 12, 14 Pro Max and 16 Pro Max, launched from Settings search or a Shortcuts "Open URL").
  - "nope it isn't" (Feb 21 2026).
  - Instagram links stopped opening Safari (Feb 25 2026).
  - No comment covers iOS 27. None of the reports are from a Home Screen web app.
  — [gist felquis/a08ee196747f71689dcb](https://gist.github.com/felquis/a08ee196747f71689dcb?permalink_comment_id=5602225)
- WebKit bug 152585 (old) asked for a way to launch Safari from in-app web views. `com-apple-mobilesafari-tab:` was mentioned as a restricted scheme, not usable by others. — [WebKit bug 152585](https://bugs.webkit.org/show_bug.cgi?id=152585)
- Safari 27 beta (WWDC26) release notes mention a fix so that `window.open()` correctly consumes user activation. Nothing about standalone web apps, PiP or opening links in Safari appears in the post. — [WebKit: News from WWDC26, Safari 27 beta](https://webkit.org/blog/17967/news-from-wwdc26-webkit-in-safari-27-beta/)
- The undocumented `webapp://` scheme that opened an installed web app in an iOS 26 beta (June 2025) gave "Safari cannot open the page bc the address is invalid" by April 2026. Undocumented schemes come and go. — [Glide community thread](https://community.glideapps.com/t/ios-26-beta-opening-an-installed-web-app-with-an-open-url-action/82464)

### Inferences
- `<a target="_blank">` or `window.open()` to VizTime's own URL is in scope. It either navigates within the standalone app or opens a manifest-configured secondary view, so it won't reach Safari. Putting the hand-off page out of scope (for example a different path outside `/VizTime/`) would open the in-app browser. Per bug 250651 that browser is configured with the web app's manifest, so PiP is likely still unavailable there. That's a strong inference, but untested.
- In-app browser views commonly show a button to open the page in Safari (compass icon). If iOS 26/27's PWA in-app browser has one, the hand-off becomes "tap Float, then tap Open in Safari, then tap Float again". Untested; no source found describing that button for PWA in-app browsers.
- `x-safari-https://` from a standalone web app is the only candidate for a one-tap jump into real Safari. It's undocumented, has broken and returned across iOS updates, and its behaviour from a Home Screen web app is unknown. If used at all, it should be an optional, clearly labelled link, never the only route, and VizTime can't feature-detect whether it worked.

### Gaps
- No primary Apple documentation on what container opens for in-scope vs out-of-scope links or `window.open` from a Home Screen web app on iOS 26/27.
- Not confirmed whether PiP works in the in-app browser view opened from a standalone web app. Test on device: from the installed app, open an out-of-scope page that hosts the check/ PiP test, and read `webkitSupportsPresentationMode('picture-in-picture')`.
- Not confirmed whether `x-safari-https://` works when tapped inside a Home Screen web app on iOS 27, or whether iOS shows a "Open in Safari?" confirmation.

## 2. Carrying the session in the URL: length, privacy, stale tabs, two timers cueing

### Takeaway
The session is tiny, so URL length isn't a concern, and a fragment never reaches GitHub's servers. The real risks are on the device. The Safari copy and the app copy are independent, with separate storage and no shared channel, so pausing, extending or stopping in one doesn't reach the other. Both can cue. And a Safari tab left open can later re-show an old session if the fragment is re-read. These are design problems VizTime can partly solve: treat the hand-off as a move, not a copy, and clear the fragment on arrival.

### Cited Findings
- The fragment is resolved client-side and isn't sent to the server in the HTTP request. — [RFC 3986 §3.5](https://www.rfc-editor.org/rfc/rfc3986#section-3.5)
- Storage and service workers are not shared between Safari and Home Screen web apps. Only login cookies are copied, at install, from iOS 17.2. — [firt.dev iOS PWA notes](https://firt.dev/notes/pwa-ios/)
- WebKit treats Home Screen web apps as separate from Safari, with their own storage-use counters. — [WebKit: Full Third-Party Cookie Blocking and More (2020)](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)

### Inferences
- Payload: `endAt`, `pausedAt`, `finishedAt`, title, next and mode as JSON is a few hundred characters at most, base64url- or percent-encoded. That's far below any practical URL limit. No source was checked for Safari's limit; a few hundred characters is not a realistic risk.
- Privacy: the fragment stays out of GitHub Pages request logs, but it does land in Safari history, could sync to other devices through iCloud Safari tabs and history, and shows in the address bar. A Work-mode title might be a patient-related label, and the address bar is visible to anyone looking at the screen. Keep titles out of the URL in Work mode, or let the person choose (untested; iCloud sync behaviour of fragments not verified).
- Stale tab: Safari keeps tabs indefinitely. If the Safari page re-imports the fragment whenever it loads (for example after iOS reloads a purged tab), it could revive a finished or replaced session. Mitigation: on arrival, import once, save to the Safari-side store, then `history.replaceState` to drop the fragment. Ignore a fragment whose session is already finished, or older than the one saved. VizTime's `settle` already ensures a cue whose moment passed isn't played late.
- Two copies cueing: after a hand-off, both the app and the Safari tab hold the session. With separate storage, `BroadcastChannel` and `storage` events won't connect them (inference from the separate-storage finding). If the person later reopens the app, it will still run its copy, and both could play an end sound or speak. Options:
  - The app marks its copy "moved to Safari", stops cueing and shows that state.
  - Or the hand-off is one-way and the app ends its copy with an Undo toast.

  Either way, pausing or adding 5 minutes in one doesn't change the other. That conflicts with the calm, predictable goal and needs clear copy.
- iOS suspends backgrounded web content, so in practice only the foreground copy (or the PiP-playing Safari tab, if WebKit keeps it running) is likely to cue. Background behaviour of a Safari tab in PiP is still unverified (see iphone.md).

### Gaps
- Not checked: whether Safari on iOS 27 reloads purged tabs with the original URL including the fragment (likely, but untested).
- Not checked: whether fragments sync via iCloud Tabs.

## 3. Does the tap carry over so Safari can open PiP at once, and does Safari auto-PiP on app switch?

### Takeaway
No. Transient user activation belongs to the window where the tap happened, and opening a new page consumes it. The Safari page starts with none. WebKit requires a user gesture to enter PiP, so the person must tap Float again in Safari. Auto-PiP when leaving Safari exists for playing video (a system setting, on by default since iOS 14). Whether it triggers for VizTime's muted, inline, near-invisible canvas video is unconfirmed; WebKit's background behaviour for inline video suggests it may not. Best realistic flow: 2 or 3 taps plus a swipe home.

### Cited Findings
- Transient activation is tracked per window, lasts only a short while, and is consumed by APIs such as `window.open()`. — [MDN: User activation](https://developer.mozilla.org/en-US/docs/Web/Security/User_activation)
- Safari 27 beta: "Fixed `window.open()` to correctly consume user activation when creating a new browsing context." — [WebKit: News from WWDC26](https://webkit.org/blog/17967/news-from-wwdc26-webkit-in-safari-27-beta/)
- WebKit engineer (2022): fullscreen and PiP both require a user gesture; console calls don't simulate one. — [WebKit bug 172051](https://bugs.webkit.org/show_bug.cgi?id=172051)
- Calling `webkitSetPresentationMode('picture-in-picture')` from `visibilitychange` (not a gesture) in a WKWebView fires the mode-change event, but no PiP window appears. Auto-PiP on backgrounding from inline playback needs native player settings a page can't set. — [Apple Developer Forums 819235](https://developer.apple.com/forums/thread/819235)
- Safari doesn't give pages a way to learn that entering PiP failed. — [WICG Picture-in-Picture explainer](https://github.com/WICG/picture-in-picture/blob/master/explainer.md)
- iOS 14+: going home while a video plays in Safari can start PiP automatically. This is controlled by Settings › General › Picture in Picture › Start PiP Automatically. Guides note it applies to a playing video, sometimes only after entering full screen. — [Macworld: PiP on iPhone in iOS 14](https://www.macworld.com/article/234404/how-to-use-picture-in-picture-on-your-iphone-in-ios-14.html); [Gadget Hacks: stop PiP starting automatically](https://ios.gadgethacks.com/how-to/stop-picture-picture-from-starting-automatically-ios-14-when-you-exit-video-playing-apps-0340156/)

### Inferences
- Concrete flow from the installed app, if the hand-off link reaches real Safari (only possibly via `x-safari-https://`; see section 1):
  1. Tap "Float in Safari" in VizTime.
  2. Safari opens VizTime with the session, and the person sees the normal face plus a Float button.
  3. Tap Float. The PiP window appears over Safari.
  4. Swipe home or switch to another app. The PiP window stays floating.

  That's 2 taps and a swipe. If the link lands in the in-app browser instead, add "tap Open in Safari", if such a button exists (untested).
- A single tap won't work, and auto-PiP-on-load can't be engineered: page load has no activation, and calls outside a gesture fail silently.
- Auto-PiP on swipe-home is worth a device test with the check/ page: start the canvas video playing inline in Safari, swipe home, see whether PiP starts. Even if it works, the video has to be playing first, which itself may need a tap on iOS. Muted inline autoplay is normally allowed, but untested for this canvas stream.

### Gaps
- No source confirms or rules out automatic PiP for a muted inline `captureStream` video in Safari on iOS 26/27.

## 4. The iOS 26+ "Open as Web App" toggle: turning it off to get a Safari-tab icon

### Takeaway
Confirmed: in iOS/iPadOS 26, Add to Home Screen from Safari has an "Open as Web App" switch, on by default. Switched off, the icon is a plain bookmark that opens the page in Safari. That Safari tab uses Safari's storage, not the web app's. Float, Wake Lock and sound after a tap all work as in any Safari tab. It's the simplest and most honest route to Float on iPhone, with no hand-off code. The costs: Safari's toolbar and address bar stay visible, there's no separate app card in the app switcher, presets don't carry over from the installed app, and it's an ordinary tab that can be closed or reloaded. A reasonable recommendation for someone who values Float, ideally as a second icon or a clearly explained choice.

### Cited Findings
- WWDC25 / Safari 26: "every website added to the Home Screen opens as a web app" by default. Users can turn off "Open as Web App" to get a bookmark instead. — [WebKit: News from WWDC25, Safari 26 beta](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/)
- heise (Oct 10 2025): with "Open as web app" off, a bookmark is created, regardless of whether the site has a manifest or meta tag. — [heise: iOS 26 changed web app behaviour on the Home Screen](https://heise.de/-10749652)
- A bookmark icon simply launches Safari with the page; a web app opens in its own window without Safari's interface. — [iThinkDiff: add web app or bookmark to Home Screen in iOS 26](https://www.ithinkdiff.com/add-web-app-bookmark-iphone-home-screen-ios-26/)
- Some guides suggest the toggle shows only for sites that support web apps, which conflicts with Apple's "every website" wording. VizTime has a manifest, so the toggle should appear either way. — [iThinkDiff](https://www.ithinkdiff.com/add-web-app-bookmark-iphone-home-screen-ios-26/); [WebKit WWDC25](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/)
- PiP works in Safari tabs, with the impact noted as "use Safari if you want PiP". A Home Screen icon that opens a browser tab (Firefox for iOS, URL bar showing) got PiP. — [WebKit bug 303885](https://bugs.webkit.org/show_bug.cgi?id=303885)
- Screen Wake Lock has worked in Safari tabs since iOS 16.4 (Home Screen apps since 18.4). — [WebKit Features in Safari 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/); [firt.dev](https://firt.dev/notes/pwa-ios/)
- Storage isn't shared between Safari and installed web apps. — [firt.dev](https://firt.dev/notes/pwa-ios/)
- Safari's 7-day cap on script-writable storage counts days of Safari use without interaction with the site. Home Screen web apps have their own counter. A Safari-tab VizTime used regularly keeps its data; one left unused for 7+ days of Safari use could lose presets. — [WebKit 2020](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/); [WebKit: Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/)
- On iOS 17+, `navigator.storage.persist()` is granted heuristically, notably for Home Screen web apps. That makes persistence less likely to be granted in a plain Safari tab. — [WebKit: Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/)

### Inferences
- What the person sees with the toggle off:
  - Tapping the icon opens Safari to VizTime, showing Safari's address bar and toolbar (compact in iOS 26's design).
  - Whether Safari reuses an existing VizTime tab or opens a new one each time is unverified.
  - Float is one tap: the PiP window appears, then swipe home.
  - VizTime's offline service worker works in Safari too, and storage and presets are Safari's own.
- What's lost:
  - The full-screen, no-browser-chrome look.
  - A separate "VizTime" card in the app switcher. It's just a Safari tab, and switching to Safari for anything else shows other tabs.
  - Presets saved in the installed app (separate storage); the person would re-enter them or use an export/import.
  - The stronger storage persistence of a Home Screen app.
  - `(display-mode: standalone)` styling, if VizTime uses any.
- Same as the web app:
  - Wake Lock (Safari since 16.4).
  - Sound only after a tap.
  - No background timers.
  - No vibration.
- Sensible guide wording: offer two set-ups. "Leave Open as Web App on" for the calm full-screen app, and "turn it off" if Float matters more. Or suggest adding VizTime twice, one of each, with the caveat that each icon keeps its own presets and its own running session. The current iphone.md advice ("leave it on") should become a stated choice, not a rule.
- For an ADHD/autism user, fewer moving parts is better. A single Safari-bookmark icon used for everything avoids two copies of the timer, which is the main risk of the hand-off approach in section 2.

### Gaps
- Not verified whether a Home Screen bookmark on iOS 26/27 reopens the same Safari tab or creates a new tab each launch. That affects stale-tab clutter and whether a running session is shown immediately.
- No Apple Support page quoting the exact toggle wording was retrieved. Third-party sources and the WebKit post agree.

## 5. Outside the web: Live Activities, Dynamic Island, Lock Screen widgets, Clock timer, Shortcuts

### Takeaway
A web page can't create a Live Activity, Dynamic Island item or widget. Those need a native app with a widget extension (ActivityKit/WidgetKit), started from the app or by Apple push from the developer's server. A web page can, however, open a `shortcuts://run-shortcut` URL. A Shortcut the person builds once can then start a Clock timer, and Apple's Clock timer shows on the Lock Screen and in the Dynamic Island. That's the only no-native-app route to an always-visible timer outside the web app. It shows countdown digits, runs separately from VizTime, and ends with Clock's alarm, which conflicts with Work mode's "never looks like a timer" rule and VizTime's calm design.

### Cited Findings
- Live Activities require the app to create them, originally with the app open. Push-to-start arrived in iOS 17.2 via a push-to-start token issued to the native app. — [OneSignal: ActivityKit notifications](https://onesignal.com/blog/new-activitykit-notifications-push-the-boundaries-of-current-ios-live-activities/)
- Server push-to-start depends on a token the native app receives. Apple DTS: "you only get the push start token once" until used. Starts can be throttled ("Push-to-start budget exceeded"). — [Apple Developer Forums 741939](https://developer.apple.com/forums/thread/741939); [Apple Developer Forums 749826](https://developer.apple.com/forums/thread/749826)
- `Activity.request()` from the background throws `ActivityAuthorizationError.visibility`. — [Apple Developer Forums 791242](https://developer.apple.com/forums/thread/791242?page=2)
- No source found that Web Push (available to Home Screen web apps) can start or update a Live Activity. The Safari 27 beta notes mention nothing on Live Activities or widgets. — [WebKit: News from WWDC26](https://webkit.org/blog/17967/news-from-wwdc26-webkit-in-safari-27-beta/)
- Apple's Clock timer has supported Live Activities (Lock Screen and Dynamic Island) since iOS 16.1. — [512 Pixels: iOS 16 timer Live Activity](https://512pixels.net/2023/03/ios-16-timer-live-activity/); [PhoneArena: Stopwatch Live Activity in iOS 17.4](https://www.phonearena.com/news/stopwatch-feature-gets-live-activities-support-in-ios-17.4_id154809)
- Shortcuts has a "Start Timer" action that sets a Clock timer for a chosen duration. — [BGR: set a timer without opening the app](https://bgr.com/2208560/iphone-screen-set-timer-without-opening-app-how/)
- Apple documents running a shortcut from a URL: `shortcuts://run-shortcut?name=[name]&input=[input]&text=[text]`, with `input=text` and a URL-encoded `text`. Apple says the URL scheme is for "when another app is calling the shortcut". — [Apple Shortcuts User Guide: Run a shortcut from a URL](https://support.apple.com/guide/shortcuts/apd624386f42/ios)
- A third-party timer app's shortcut didn't start its Live Activity. That was Toggl, not Clock, so it doesn't settle whether a Shortcuts-started Clock timer shows one. — [Toggl community](https://community.toggl.com/t/dynamic-island-only-shows-timer-when-started-from-ios-app/1303)

### Inferences
- Shortcuts route, concretely:
  1. Once only: the person builds a Shortcut named, say, "VizTime timer" that takes text input (minutes) and runs Start Timer.
  2. In VizTime, a link `shortcuts://run-shortcut?name=VizTime%20timer&input=text&text=25` starts it. Each run is one tap in VizTime; iOS switches to Shortcuts briefly, then the Clock timer appears on the Lock Screen and in the Dynamic Island (iPhone 14 Pro and later; other iPhones get the Lock Screen and a banner).
- Costs of the Shortcuts route:
  - Shows countdown digits.
  - Pause and +5 in VizTime don't reach it.
  - Ends with Clock's alarm.
  - Needs one-time Shortcut set-up.
  - Unknown whether a custom-scheme link works from a standalone web app (untested; no source found).
  - Unsuitable for Work mode by VizTime's own rules. Possibly acceptable as an opt-in for Full or Simple modes, if the project ever wants it.
- Minimal native wrapper, for the owner's information only: not verified in this pass, from general knowledge, so check before relying on it.
  - What it takes:
    - A Mac with Xcode.
    - An Apple Developer Program membership (US$99/yr) to install beyond 7-day free provisioning ([Apple Developer Program](https://developer.apple.com/programs/)).
    - A Swift app hosting VizTime in a WKWebView, plus a Widget Extension for the Live Activity (ActivityKit + WidgetKit/SwiftUI, `NSSupportsLiveActivities`).
    - Swift code mapping `endAt`/`pausedAt` into the Live Activity, which can show a system-rendered countdown or progress without per-second updates.
    - Live Activities last up to about 8 hours.
  - Native PiP is also possible for the custom view.
  - What it costs:
    - It contradicts "no build step, no dependencies".
    - It needs ongoing maintenance and signing.
    - It risks App Store rejection as a thin web wrapper under minimum-functionality rules ([App Store Review Guidelines 4.2](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality)). Personal sideloading avoids review, but needs re-signing every 7 days without a paid membership.
- An App Clip could in principle show a Live Activity without a full install, but it still needs native code, an App Store Connect setup and server-side configuration. Not researched; mentioned only for completeness.

### Gaps
- Apple's ActivityKit documentation page couldn't be read (JavaScript-rendered). Duration and update limits above are from general knowledge, unverified here.
- Not verified on iOS 27 that a Shortcuts "Start Timer" run shows the Clock Live Activity, or that `shortcuts://` links work from a Home Screen web app.
- No source found on whether iOS 27 added any web-app access to Live Activities or widgets. None is mentioned in the Safari 27 beta post.
