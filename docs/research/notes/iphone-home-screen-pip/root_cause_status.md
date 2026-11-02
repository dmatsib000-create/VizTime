# Why picture-in-picture fails in iPhone Home Screen web apps: root cause and status (as of 1 November 2026)

Scope: VizTime's Float feature streams a canvas through a muted, inline `<video>` and opens it in picture-in-picture (PiP). It works in a Safari tab and in Chrome for iOS on iOS 27.0.1, but not when the site is opened from the Home Screen as a web app (`display: standalone`). Research done 1 November 2026. Every claim below has a URL; anything inferred is marked as such.

## 1. How Home Screen web apps are hosted, and how that differs from Safari

### Takeaway
A Home Screen web app is not a Safari tab. It runs the same WebKit engine, but inside a separate system-provided host. Apple's WebKit engineers describe that host as a "ViewService", not a normal app. Engine features that rely on the host app's own permissions (keeping the screen awake, PiP) do not work there until Apple wires them into the host separately. Apple has published no detailed architecture for this host.

### Cited Findings
- **The host is a "ViewService", not an app (iOS 16.4/17 era, 2023).** Wake Lock failed in Home Screen web apps while working in Safari. Apple WebKit engineer Chris Dumez explained that WebKit keeps the screen awake through `UIApplication.idleTimerDisabled`, and wrote: "This likely does't work in Home Screen Web Apps because they are not UIApplications but ViewServices." — [WebKit bug 254545, comment 10](https://bugs.webkit.org/show_bug.cgi?id=254545)
- **Engine changes alone do not reach web apps.** WebKit landed a change (PR 13179, 263419@main, 26 April 2023), but the bug stayed broken through iOS 16.5, 16.6 and 17.0.x. Dumez closed it with: "WebKit is providing API for Safari to adopt." A commenter summarised: "the issue won't be resolved until Safari actually adopts the new WebKit API." Dumez later said there was no WebKit issue left and that a radar was assigned to "the correct Apple team". — [WebKit bug 254545, comments 12–20, 38](https://bugs.webkit.org/show_bug.cgi?id=254545)
- **The Wake Lock fix took about two years to reach web apps.** Jen Simmons (Apple) wrote on 31 March 2025: "The Screen Wake Lock API now works in Home Screen Web Apps on iOS and iPadOS 18.4." — [WebKit bug 254545, comment 65](https://bugs.webkit.org/show_bug.cgi?id=254545)
- **iOS 26 (2025): every site saved to the Home Screen opens as a web app by default.** Until then, only sites with the right meta tag or manifest `display` value did. "By default, every website added to the Home Screen opens as a web app," and users can turn off "Open as Web App" to make a plain bookmark that opens in Safari. — [WebKit blog, News from WWDC25 (9 June 2025)](https://webkit.org/?p=16993); also [heise, 10 Oct 2025](https://heise.de/-10749652). Heise does not describe the hosting process.
- **Other browsers can add web apps.** A 2026 reproduction of the PiP bug used a web app added from Firefox for iOS (`navigator.standalone === true`), and it behaved the same as one added from Safari. — [WebKit bug 303885, comment 2](https://bugs.webkit.org/show_bug.cgi?id=303885). The ability for third-party iOS browsers to add web apps arrived in iOS 16.4 ([WebKit blog, Web Push for Web Apps on iOS and iPadOS, Feb 2023](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/); I did not re-open this page during this session).

### Inferences
- The reporter of bug 303885 wrote: "The only difference between the two contexts is the display mode" ([303885](https://bugs.webkit.org/show_bug.cgi?id=303885)). Apple's Wake Lock comments show it is more than that: the page runs in a different host process with different system rights. To a non-specialist: *"Same engine, different building. Safari is a full app with its own permits. The Home Screen app runs in a smaller system container that Apple has not yet given the PiP permit."*
- Chrome for iOS opens PiP because it is a full App Store app with its own capabilities. Home Screen web apps are run by Apple's system host whichever browser added them, so switching browsers does not help. This is inferred from the bug 303885 Firefox report plus the ViewService explanation.

### Gaps
- I found no Apple documentation naming the host process for iOS 16.4, 17, 18, 26 or 27 (SafariViewService, a "WebApp" host, or another). The "ViewService" description comes only from one 2023 engineer comment. I found no source saying the hosting changed in iOS 26 or 27, beyond the iOS 26 default-install change. Treat process names seen elsewhere as unverified.

## 2. Why PiP is unavailable there: capability, setting, or policy?

### Takeaway
In a Home Screen web app, the engine itself reports that PiP is not supported for the video. This happens before any of VizTime's code could make a difference, so no JavaScript call or ordering fix can open it. Apple has never stated the exact cause. The best-supported explanation is that the system host lacks the app-level PiP capability, the same pattern as Wake Lock. That explanation is inferred, not confirmed.

### Cited Findings
- **Measured on iOS 26.6 (iPhone Air), installed web app:** `document.pictureInPictureEnabled` is `true`, but `video.webkitSupportsPresentationMode('picture-in-picture')` returns **`false`**. `requestPictureInPicture()` rejects with `NotSupportedError` whether the video is paused or playing (readyState 4), and the native PiP button is absent. The reporter notes that `pictureInPictureEnabled` therefore wrongly reports true, and hides the PiP button when `webkitSupportsPresentationMode()` fails. — [WebKit bug 303885, comment 2](https://bugs.webkit.org/show_bug.cgi?id=303885)
- **Original report (iOS 18.5, iPadOS 18.3.1, iOS 26.1 beta):** PiP works in Safari but not in a standalone web app. The PiP control disappears, and `requestPictureInPicture()` throws `NotSupportedError` or does nothing. — [WebKit bug 303885](https://bugs.webkit.org/show_bug.cgi?id=303885)
- **Apple's own media engineer filed the same bug in 2024.** Youenn Fablet (WebKit media/WebRTC) confirmed in September 2024 that PiP worked in the browser on iOS 18 but "not when the app is added to the Home Screen". He filed bug 280627, "Media element cannot be picture-in-pictured in Home Screen web apps" (rdar://136982653). It is still NEW, with no comments and no stated cause. — [WebKit bug 262479](https://bugs.webkit.org/show_bug.cgi?id=262479); [WebKit bug 280627](https://bugs.webkit.org/show_bug.cgi?id=280627)
- **Native apps need an app-level permit for PiP.** Apple's guidance says an app needs the Background Modes capability "Audio, AirPlay and Picture in Picture" and a playback audio-session category. `WKWebView` supports PiP by default, controlled by `allowsPictureInPictureMediaPlayback`. — [Apple, Picture in Picture Quick Start](https://developer.apple.com/library/ios/documentation/WindowsViews/Conceptual/AdoptingMultitaskingOniPad/QuickStartForPictureInPicture.html)
- **Embedded web views also fail.** Since iOS 16.3, PiP has failed in some embedded web views, for example a page opened from Gmail, with the same `NotSupportedError`. That bug (252765, rdar://106101712) is still NEW and gives no cause. — [WebKit bug 252765](https://bugs.webkit.org/show_bug.cgi?id=252765)
- No public bug comment from Apple mentions entitlements, `allowsPictureInPictureMediaPlayback`, or a deliberate policy for web apps. Apple's only statement on 303885 is from Alexey Proskuryakov: "This is tracked as the above issue by Apple internally." — [WebKit bug 303885, comment 1](https://bugs.webkit.org/show_bug.cgi?id=303885)

### Inferences
- **Most likely cause (inferred):** the system host for Home Screen web apps does not have, or has not been set up to use, the PiP capability that Safari has. Three things point that way: WebKit's own `webkitSupportsPresentationMode('picture-in-picture')` returns false only in that context; Apple's Wake Lock explanation names the same host ("ViewServices, not UIApplications"); and native apps need an app-level Background Modes/PiP capability. I found no WebKit source or Apple statement that confirms this exact mechanism.
- **Probably not deliberate policy (inferred):** Apple engineers filed 280627 themselves and keep 303885 "InRadar" at P1. Apple treats the gap as a bug, not a decision. Apple has made no public statement either way.
- **VizTime's own Safari results are a separate issue.** In a Safari tab on iOS 27.0.1, `requestPictureInPicture()` fails with `NotAllowedError`/`InvalidStateError` while `webkitSetPresentationMode` works. That is a different, Safari-side behaviour. In a web app, both calls fail because the presentation mode is reported as unsupported. Inferred from the 303885 measurements; not tested on VizTime's own web app in this session.

### Gaps
- I could not search WebKit's GitHub source for the code path that turns PiP off in web-app hosts. GitHub code search needs a login, and web search found nothing. The exact code-level cause is unverified.
- Feedback reports FB17983433 (Anton Barkovsky, cited in 303885) and FB24079369 (comment 2) are not public. I found no Barkovsky blog post.

## 3. Status of bug 303885 and related bugs, and Apple statements

### Takeaway
All PiP-in-web-app bugs are open (NEW) and unassigned. Apple acknowledges them as tracked internally and has given no explanation, fix, or date. Safari 27.0's release notes and the WWDC26 WebKit session contain nothing on PiP in web apps.

### Cited Findings
- **Bug 303885**, "[iOS/iPadOS] requestPictureInPicture() does not work in Home Screen Web Apps". Status NEW, no assignee, P1/Normal, component WebKit Media, keyword InRadar, linked to rdar://121964774. Filed 9 December 2025 by tsukumizima, last modified 13 August 2026. Apple engineers jer.noble and marcosc are on the CC list. Reproduced on iOS 18.5, iPadOS 18.3.1, iOS 26.1 beta and iOS 26.6. — [bugs.webkit.org/show_bug.cgi?id=303885](https://bugs.webkit.org/show_bug.cgi?id=303885)
- **Bug 280627**, "Media element cannot be picture-in-pictured in Home Screen web apps". NEW, filed by Apple's youenn fablet on 30 September 2024, rdar://136982653, no activity since. — [bugs.webkit.org/show_bug.cgi?id=280627](https://bugs.webkit.org/show_bug.cgi?id=280627)
- **Bug 252765**, PiP fails in webviews. NEW since February 2023, rdar://106101712. — [bugs.webkit.org/show_bug.cgi?id=252765](https://bugs.webkit.org/show_bug.cgi?id=252765)
- **Bug 254545**, Wake Lock in Home Screen web apps. FIXED in iOS/iPadOS 18.4 (31 March 2025), about two years after the WebKit-side change. It is the closest precedent. — [bugs.webkit.org/show_bug.cgi?id=254545](https://bugs.webkit.org/show_bug.cgi?id=254545)
- **Safari 27.0 release notes (17 September 2026).** The only PiP items are under Media: "Fixed being unable to enter Picture-in-Picture again after navigating to another video" and a fix to the `pictureInPictureElement` getter. Nothing mentions Home Screen or standalone web apps and PiP. — [WebKit Features for Safari 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)
- **WWDC26 "What's new in WebKit for Safari 27" (session 204).** It mentions "Media and video playback" as a quality focus without specifics. Nothing on PiP, web apps or Document PiP. — [developer.apple.com/videos/play/wwdc2026/204](https://developer.apple.com/videos/play/wwdc2026/204/)
- **Safari 26 beta notes (June 2025).** The only PiP item is a fix so PiP exits "when the video element is removed". Nothing on web apps. — [WebKit blog, News from WWDC25](https://webkit.org/?p=16993)
- **Older observation (iOS 13.4+).** A third-party capability tracker says video PiP is available in Safari "but not inside installed PWAs". — [Progressier PWA demos](https://progressier.com/pwa-capabilities/picture-in-picture-desktop)

### Inferences
- Radar numbers appear to rise over time. If so, rdar://121964774 (linked to 303885) is older than rdar://136982653 (filed September 2024), which would mean Apple has tracked this internally since about early 2024. This is inferred from the numbering only.
- Safari 27.1 and 27.2 were not checked. One release-tracking site lists 27.1 (23 October 2026) and 27.2 (26 October 2026) ([releasebot](https://releasebot.io/updates/apple/safari)), but I did not verify those dates or read those notes. The owner's iOS 27.0.1 may also be behind the current release.

### Gaps
- The Safari 27.0 notes were very long, and I searched them by keyword in two passes, so a small item could have been missed. I did not read the Safari 26.1 to 26.x or 27.1 to 27.2 notes in full.

## 4. Does Safari 27 ship Document Picture-in-Picture or another floating API?

### Takeaway
No. I found no sign that Safari 27 ships Document Picture-in-Picture or any new floating-window API. WebKit's last recorded stance (2022–2023) was concerns, with no position taken.

### Cited Findings
- Document Picture-in-Picture does not appear in the Safari 27.0 release notes or the WWDC26 WebKit session. — [Safari 27.0 notes](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/); [WWDC26 session 204](https://developer.apple.com/videos/play/wwdc2026/204/)
- WebKit standards-positions issue #41 (opened by Chromium, July 2022) shows WebKit concerns and no official position. — [WebKit/standards-positions#41](https://github.com/WebKit/standards-positions/issues/41)
- Chromium's January 2023 Intent to Experiment recorded the WebKit signal as concerns raised, with no official position. — [blink-dev thread](https://groups.google.com/a/chromium.org/g/blink-dev/c/Tz1gUh92dXs)
- WebKit bug 263782 tracks DocumentPictureInPicture. Its comments refer to WebKit voicing concerns in October 2023. I saw this only through a search summary and did not open the bug. — [bug 263782](https://bugs.webkit.org/show_bug.cgi?id=263782)
- A newer standards-positions issue, #707 "Automatic Picture-in-Picture" (opened 12 August 2026, W3C Media WG), exists, but its content and WebKit's response were not visible. — [WebKit/standards-positions issues](https://github.com/WebKit/standards-positions/issues/)

### Gaps
- I could not see the current state of standards-positions #41 or #707 directly.

## 5. Any sign of a fix timeline?

### Takeaway
None. Apple has published no date or target release and given no technical explanation. The only signs are that the bug is acknowledged and tracked internally, and that Apple fixed a similar web-app gap (Wake Lock) about two years after its engine-side change.

### Cited Findings
- Apple's only public statement is "tracked … by Apple internally" (December 2025). Since then the bug has had one user reproduction (iOS 26.6) and no fix. — [WebKit bug 303885](https://bugs.webkit.org/show_bug.cgi?id=303885)
- Apple fixed the comparable Wake Lock gap in iOS 18.4. It needed Safari, meaning the web-app host, to adopt the new WebKit API, not just an engine change. — [WebKit bug 254545](https://bugs.webkit.org/show_bug.cgi?id=254545)

### Inferences
- Any fix would most likely arrive in an iOS point or major release, and would be listed in the WebKit/Safari release notes, as Wake Lock was in 18.4. Watching bug 303885 and the release notes is the practical way to find out. Owners of affected sites can file Feedback Assistant reports that mention rdar://121964774 to add weight; there is no evidence about how much that helps.
- **Workarounds within the platform rules:** none found. The engine reports PiP as unsupported in the web-app host, so VizTime's practical options are to (a) detect it with `webkitSupportsPresentationMode('picture-in-picture') === false` (or `navigator.standalone` / `display-mode: standalone`) and hide Float, following the project's "Hide, don't disable" rule; (b) tell the user to open the site in a Safari tab, or add it with "Open as Web App" turned off (iOS 26+) so the Home Screen icon opens in Safari, where Float works. Option (b) relies on the iOS 26 toggle ([WebKit blog](https://webkit.org/?p=16993)). Opening Safari from inside the web app was not tested.

### Gaps
- No Apple timeline, roadmap, or WWDC statement exists publicly, as far as I could find.
