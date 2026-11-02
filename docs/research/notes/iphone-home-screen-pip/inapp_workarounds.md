# Workarounds for picture-in-picture inside an iPhone Home Screen web app (iOS 26–27, as of November 2026)

Scope: techniques that might get a floating PiP window from VizTime when it is opened from the Home Screen as a standalone web app. VizTime's current Float uses `canvas.captureStream(4)`, a muted, playsinline, 1px `<video>`, `video.play()`, then `video.webkitSetPresentationMode('picture-in-picture')`. Per the owner's test, this works in a Safari tab and in Chrome for iOS on iOS 27.0.1, but not from the Home Screen. Everything below must stay plain HTML/JS with no dependencies. Root cause is covered in the sibling file `root_cause_status.md`.

Overall picture: no source reports any in-app technique that produces PiP in a standalone Home Screen web app on iOS 26 or 27. The failure is the same for every source type tested (HLS, MP4, MSE, ManagedMediaSource) and for every entry point (script call, native control, fullscreen control). It also happens before any timing question arises: `webkitSupportsPresentationMode('picture-in-picture')` already returns `false` in the container. The only route with confirmed working PiP is to run the page in a browser tab instead of the standalone container.

## 1. Does a real video file (MP4/WebM/HLS) instead of a captureStream MediaStream behave differently? Does an audio track matter?

### Takeaway
No. Developers report the same failure with HLS, MP4, MediaSource and ManagedMediaSource, through iOS 26.6 and 27.1. None of the reports mention a MediaStream, so swapping VizTime's captureStream for a looping file should not be expected to help. No source tests whether an audio track matters, but the failure does not depend on the element's state, which makes an audio track very unlikely to change it.

### Cited Findings
- WebKit bug 303885 is titled "[iOS/iPadOS] requestPictureInPicture() (PiP / PinP) does not work in Home Screen Web Apps (PWA)." It was filed 2025-12-09 and is still NEW, unassigned and P1, last modified 2026-08-13. It is tracked internally at Apple as rdar://121964774. The report says the problem occurs with HLS, MP4, ManagedMediaSource and MediaSource, whether the video uses `<source>` or `src`. Environments: iOS 18.5, iPadOS 18.3.1, iOS 26.1 beta and iOS 26.6. Other developers report it back to iOS 14.5. — [WebKit bug 303885](https://bugs.webkit.org/show_bug.cgi?id=303885)
- Comment 2 on that bug (2026-07-31) comes from someone who tested HLS via hls.js on ManagedMediaSource on iOS 26.6 (iPhone Air). In the installed app, `document.pictureInPictureEnabled` is `true` and `requestPictureInPicture` exists. But `webkitSupportsPresentationMode('picture-in-picture')` returns `false`, and `requestPictureInPicture()` rejects with `NotSupportedError`. The result is the same paused or playing, at readyState 4, which rules out a readiness race. The same page works in Safari, and in Firefox for iOS with the URL bar visible. Filed as FB24079369. — [WebKit bug 303885](https://bugs.webkit.org/show_bug.cgi?id=303885)
- Anton Barkovsky's test repo (zemlanin/ios-pwa-video-issues) has a "native video player" and a ManagedMediaSource player. `requestPictureInPicture` does nothing in the Home Screen app even though `pictureInPictureEnabled` is `true` (FB17983433). The README says the issues persist in iOS/iPadOS 26 and 27.1. — [GitHub: zemlanin/ios-pwa-video-issues](https://github.com/zemlanin/ios-pwa-video-issues); [live test page](https://anton.codes/ios-pwa-video-issues/)
- An August 2024 Apple Community report ("latest iOS" at the time, iPhone and iPad) has video streaming working in a Home Screen web app. `requestPictureInPicture()` throws "The video element does not support the Picture-in-Picture mode." The same site works in Safari. — [Apple Community thread 255709452](https://discussions.apple.com/thread/255709452)

### Inferences
- `webkitSupportsPresentationMode` returns `false` for an ordinary file or HLS video at full readiness. So the block is a property of the standalone container, not of the media source. A MediaStream source is very unlikely to be the deciding factor, and swapping it for a real looping MP4 is very unlikely to help.
- An audio track, silent or not, is untested in the sources. Since the capability check fails before any playback-state logic applies, it is unlikely to matter.

### Gaps
- No source specifically tests a `captureStream()` MediaStream in a Home Screen app, or compares sources with and without an audio track.
- Stack Overflow question 66048676 ("requestPictureInPicture not working on iOS PWA", 2021) is cited by the WebKit bug as unresolved, but could not be fetched to check its answers.

## 2. Native `controls`, and fullscreen first (`webkitEnterFullscreen`) followed by swiping home or the fullscreen player's PiP button

### Takeaway
Native controls do not help, because the PiP button is missing from them in standalone mode. Fullscreen video does work in a Home Screen app. One 2024 report says the PiP button is missing in fullscreen too. Going fullscreen and then swiping home works in a native WKWebView app (iOS 26.3.1), but nobody reports testing it in a Home Screen web app on iOS 26 or 27. It is cheap to test and unlikely to work.

### Cited Findings
- In standalone mode "the built-in PiP control disappears" from the video's controls. The bug's test page uses `controls` and `playsinline`. — [WebKit bug 303885](https://bugs.webkit.org/show_bug.cgi?id=303885)
- From the 2024 Home Screen app report: the PiP button no longer appears, "neither as an overlay on video, nor when I access full screen". The poster says fullscreen itself works. — [Apple Community thread 255709452](https://discussions.apple.com/thread/255709452)
- Fullscreen video works in Home Screen apps but shows UI differences from Safari: the home indicator doesn't hide, two volume sliders appear, and a "Currently playing" Live Activity shows. Screenshots are from iOS 17.4 (FB17984554), and the README says the issues persist through 27.1. — [GitHub: zemlanin/ios-pwa-video-issues](https://github.com/zemlanin/ios-pwa-video-issues)
- **Not a Home Screen app (a native Capacitor app with WKWebView, iOS 26.3.1, March 2026):** the poster says fullscreen followed by going to the background makes iOS enter PiP automatically. From inline `playsinline` playback it does not. Calling `webkitSetPresentationMode('picture-in-picture')` from `visibilitychange` fires `webkitpresentationmodechanged` with `picture-in-picture`, but no PiP window appears. Apple DTS replied that `visibilitychange` "is not considered user interaction". They advised only beginning PiP in response to user interaction and never programmatically. Automatic PiP from inline needs AVPlayerViewController's `canStartPictureInPictureAutomaticallyFromInline`, which a web page cannot set. — [Apple Developer Forums thread 819235](https://developer.apple.com/forums/thread/819235)

### Inferences
- The fullscreen player's PiP button and automatic PiP on swipe-home probably use the same capability check that returns `false` in standalone mode. Fullscreen-then-home therefore probably fails in a Home Screen app as well. This is speculation, supported only by the 2024 report that the button is missing in fullscreen.
- Even if it worked, it would be a poor fit for VizTime. `webkitEnterFullscreen` puts a full-screen video player on screen, which conflicts with the calm Work mode in front of patients. The person would also have to swipe home every time.

### Gaps
- No report on iOS 26 or 27 tests a swipe home from fullscreen video in a Home Screen app. This is the one in-app path worth a two-minute device test.
- No source says whether `webkitEnterFullscreen()` works on a canvas `captureStream()` video in a Home Screen app.

## 3. `autopictureinpicture` / automatic PiP when the app goes to the background

### Takeaway
No source reports that automatic PiP works in a standalone Home Screen app. The capability check that blocks manual PiP would block automatic PiP too. Automatic PiP from inline playback isn't available to a plain `<video playsinline>` even in WKWebView apps.

### Cited Findings
- I found no Apple or WebKit documentation of `autoPictureInPicture` behaviour in Home Screen apps. One secondary tutorial says Safari's `autoPictureInPicture` property only applies while a video is fullscreen. — [Fora Soft / Medium](https://forasoft.medium.com/how-to-implement-picture-in-picture-in-react-js-for-browsers-330fbe027712) (secondary, unverified)
- Programmatic PiP on backgrounding (from `visibilitychange`) does not produce a window: it is not a user gesture. Apple DTS says PiP should only begin from user interaction. Context: WKWebView, iOS 26.3.1. — [Apple Developer Forums thread 819235](https://developer.apple.com/forums/thread/819235)
- The Safari 27.0 release notes list two PiP fixes: the `pictureInPictureElement` shadow-host check, and re-entering PiP after navigating to another video. They list no change for Home Screen apps or automatic PiP. — [WebKit Features for Safari 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)

### Inferences
- With `webkitSupportsPresentationMode('picture-in-picture')` returning `false`, the `autopictureinpicture` attribute should have nothing to act on in standalone mode (speculation).

### Gaps
- No test of `autopictureinpicture` in a Home Screen app on iOS 26 or 27 was found.
- The Safari 27.0 notes were read only up to about 100k of 148k characters. The later sections (Rendering onward) were not checked, and neither were the Safari 27.1 and 27.2 notes.

## 4. Media Session metadata/actions, `navigator.audioSession` type 'playback', or other settings that change PiP eligibility

### Takeaway
I found no report that Media Session, `navigator.audioSession` or any page-level setting changes PiP eligibility in a Home Screen app. The evidence points to a gate at the container level, outside the page's control.

### Cited Findings
- Media Session has been supported in iOS web apps since 15.0, but nothing says it affects PiP. — [firt.dev iOS PWA Compatibility](https://firt.dev/notes/pwa-ios/)
- The Safari 27.0 notes include Media Session fixes: `setActionHandler` no longer throws, and `MediaMetadata` artwork size parsing was fixed. Nothing about PiP eligibility or Home Screen apps. — [WebKit Features for Safari 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)
- The bug reporter compares this with Wake Lock (bug 254545), which was broken in Home Screen apps until it was fixed in iOS 18.4 "after Safari adopted a new WebKit API". In other words, that fix came from the browser container, not from page code. — [WebKit bug 303885](https://bugs.webkit.org/show_bug.cgi?id=303885)
- In native apps, background audio and PiP are separate: background audio comes from AVAudioSession and `UIBackgroundModes: audio`, so audio resuming doesn't mean PiP will start (Apple DTS, WKWebView context). — [Apple Developer Forums thread 819235](https://developer.apple.com/forums/thread/819235)

### Inferences
- The capability check returns `false` before any page state matters, and the Wake Lock precedent was fixed by Safari adopting an API. Together these suggest the PiP fix also has to come from Apple's side. Media Session or audioSession tweaks are unlikely to change anything (speculation, but consistent with all evidence).

### Gaps
- No source tests `navigator.audioSession.type = 'playback'` with PiP in a Home Screen app.

## 5. Manifest `display` values, `display_override`, and the iOS 26 "Open as Web App" toggle

### Takeaway
The manifest can't get the page out of the standalone container on iOS 26 or 27. `fullscreen` falls back to `standalone`, `minimal-ui` falls back to `browser`, and `display_override` is unsupported. Since iOS 26, every site added to the Home Screen opens as a web app by default. Only the person can choose otherwise, by turning off "Open as Web App" in the Add to Home Screen sheet, per icon, when adding it. That gives a plain bookmark that opens in the default browser, where PiP works, but with the browser's storage instead of the web app's.

### Cited Findings
- From WebKit's Safari 26 beta announcement: "By default, every website added to the Home Screen opens as a web app." Users can choose a bookmark that opens in their default browser by turning off "Open as Web App", which works "even if the site is configured to be a web app". — [WebKit blog: Safari 26 beta](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/)
- From heise: with the switch off, a bookmark is created "whether or not the site has a manifest or meta tag". Before iOS 26, sites without a manifest or the meta tag always opened in the browser. — [heise online](https://www.heise.de/en/news/iOS-26-and-iPadOS-26-Changed-web-app-behaviour-on-the-home-screen-10749652.html)
- The toggle is in Share → More → Add to Home Screen and is on by default. — [Mastodon, John Wells](https://mastodon.social/@johnwells/115169851254104096); [MacRumors how-to](https://www.macrumors.com/how-to/save-safari-bookmark-web-app-iphone-home-screen/)
- MacRumors gives conflicting accounts of when the toggle appears ("for all websites" versus "if the site supports web apps"). Either way, a bookmark opens in Safari. — [MacRumors how-to](https://www.macrumors.com/how-to/save-safari-bookmark-web-app-iphone-home-screen/)
- firt.dev on manifest `display` in iOS: `browser` supported, `standalone` supported since 11.3, `minimal-ui` not supported (falls back to `browser`), `fullscreen` not supported (falls back to `standalone`), `display_override` not supported. Since 26.0, `apple-mobile-web-app-capable` is not needed to open as an app. — [firt.dev iOS PWA Compatibility](https://firt.dev/notes/pwa-ios/)
- firt.dev on storage: an installed app does not share storage with the browser ("Storage shared with Browser ❌"). Login cookies are copied to the installed app at install time since 17.2. — [firt.dev iOS PWA Compatibility](https://firt.dev/notes/pwa-ios/)
- In the bug's comment 2, the same page enters PiP in Firefox for iOS with the URL bar visible, but not as a Home Screen app added from Firefox. So adding the app from a third-party browser on iOS 26.6 does not avoid the block. — [WebKit bug 303885](https://bugs.webkit.org/show_bug.cgi?id=303885)
- In a Home Screen app without a declared scope, navigations can open in an in-app Safari view rather than staying in the app. — [GitHub: pingdotgg/t3code issue 4305](https://github.com/pingdotgg/t3code/issues/4305)

### Inferences
- Whether `display: "browser"` in the manifest makes iOS 26 or 27 create a bookmark instead of a web app is not documented. WebKit and heise both describe the new default as applying regardless of site configuration, so the person's toggle is what decides. Treat `display: "browser"` as unverified. It would also remove standalone mode for everyone, which VizTime relies on for the app-like home screen experience.
- A bookmark icon (toggle off) opens VizTime in a normal Safari tab, where the owner has already seen Float work on iOS 27.0.1. Presets saved there are separate from the Home Screen app's, because each has its own localStorage, including VizTime's `viztime2:` keys. The tab also shows Safari's interface.
- A link out of the standalone app is another way to reach a browser context. Depending on scope, it may open in an in-app Safari view rather than Safari itself. Whether PiP works in that view is unknown.

### Gaps
- I found no source saying whether the toggle can be changed after adding. All sources describe it only at add time; changing it means deleting and re-adding the icon (inference).
- Whether manifest `display: "browser"` affects the default toggle state on iOS 26 or 27 is unknown.
- Whether PiP works in the in-app Safari view that a Home Screen app opens for out-of-scope links is untested in any source.

## 6. 2025–2026 reports from PWA developers (video, streaming, YouTube-like) about PiP in Home Screen apps on iOS 26/27

### Takeaway
Every report found says PiP does not work in Home Screen apps on iOS 26.x through 27.1. None reports a working in-app workaround. The only practical advice in circulation is to feature-detect with `webkitSupportsPresentationMode` and hide the control, or to use Safari.

### Cited Findings
- iOS 26.6 (iPhone Air, July 2026): PiP fails, and the native control is absent. The commenter's workaround is to hide the PiP control when `webkitSupportsPresentationMode('picture-in-picture')` returns `false`. That avoids special-casing standalone mode, so the control returns by itself if Apple fixes the container. They note this relies on a non-standard API. — [WebKit bug 303885](https://bugs.webkit.org/show_bug.cgi?id=303885)
- The test repo says the issues persist in iOS/iPadOS 26 and 27.1. — [GitHub: zemlanin/ios-pwa-video-issues](https://github.com/zemlanin/ios-pwa-video-issues)
- A reply in the 2024 Apple Community thread says no device setting enables PiP for web apps (unverified community answer). — [Apple Community thread 255709452](https://discussions.apple.com/thread/255709452)
- The Safari 27.0 notes have no fix for PiP in Home Screen apps. Searches turned up no Home Screen PiP change in Safari 27.1 or 27.2. — [WebKit Features for Safari 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)
- One how-to site says calling `webkitSetPresentationMode('picture-in-picture')` after a short delay helps in PWAs. It gives no test details. This is low-quality and contradicted by the capability check returning `false`. VizTime already calls this after `play()`. — [360-reader](https://360-reader.com/ways-to-fix-picture-in-picture-mode-not-working-on-iphone-ipad/) (unreliable)

### Inferences
- **Ranked list of what is worth trying on a real device (iOS 27.x, Home Screen app):**
  1. **Diagnostic first, about 1 minute:** in the standalone app, log `video.webkitSupportsPresentationMode('picture-in-picture')`. If it returns `false`, which is expected from the reports, no in-page technique below can succeed. This also supplies the feature test for hiding Float in that container, in line with VizTime's "hide, don't disable" rule.
  2. **Safari bookmark instead of web app (works, user action):** re-add VizTime with "Open as Web App" turned off, or simply use it in a Safari tab. PiP is confirmed working in a Safari tab on iOS 27.0.1. The costs are a separate set of saved presets, Safari's interface, and the person doing it themselves; a page can't set the toggle.
  3. **Fullscreen then swipe home (cheap test, low odds):** from a tap, call `video.webkitEnterFullscreen()` on the Float video, then swipe home. Also check whether the fullscreen player shows a PiP button. A 2024 report says it doesn't. Even if it worked, it is a poor fit for Work mode.
  4. **Link out from the app, then Float (test, unknown odds):** open VizTime's URL out of scope, or with `target="_blank"`, from inside the standalone app. Test whether PiP works in the resulting Safari or in-app Safari view. This is untested in any source.
  5. **Real looping MP4 with `controls`, plus `autopictureinpicture`, Media Session and `navigator.audioSession`:** not worth device time beyond a quick confirmation. The reports show file and HLS sources failing the same way, and nothing suggests these settings change eligibility.
- Whatever is tried, the honest UI is the one in the bug comment: hide Float when the capability check is `false`, and say in the docs that the iPhone float works from Safari but not from the Home Screen icon. That matches the project rule to be honest about platforms.

### Gaps
- No Reddit (r/PWA, r/iOSProgramming) or video-library (video.js, hls.js, Plyr, Shaka) issue on Home Screen PiP for iOS 26/27 turned up in searches.
- Stack Overflow could not be fetched.
- Apple has not commented publicly beyond the radar link (rdar://121964774), and there is no announced fix date.
