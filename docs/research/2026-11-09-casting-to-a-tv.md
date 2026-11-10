# Casting TimeFall to a TV: what is really possible

*Checked 9 November 2026. Nothing here was tried on a device; items marked "unverified" need a device test. The decision taken from it: build **TV view** (a layout for a mirrored TV) and leave true casting unbuilt.*

## The question

The owner asked for a way to "cast the timer to the TV" from the web app and both phone apps, the way YouTube does, where the phone is free once the TV is playing. TimeFall has no server and its picture is drawn on a canvas from a few timestamps.

## The short answer

- YouTube frees the phone because the TV runs its own YouTube app and the phone only tells it what to play. TimeFall can do the same **only on Google Cast devices**, with a registered receiver page and native code in both apps.
- Apple TV, Fire TV and Roku would each need their own TV app. AirPlay cannot take a web picture on its own.
- Mirroring the device's screen works from every sender to nearly every TV today, at no cost. Its price is that the device must stay awake showing TimeFall.

## A. Google Cast (Chromecast, Google TV, Android TV, TVs with Cast built in)

- **Web sender:** Google supports the Web Sender SDK in Cast-capable browsers on Mac, Windows, Linux, ChromeOS and Android, and says casting is not supported in Chrome on iOS [1]. Whether the SDK works in Edge is unverified [13].
- **Android app (WebView):** does not work. WebView does not implement the Cast APIs; Google says to use the Android SDK [2]. A native plugin is required.
- **iPhone app:** needs the native iOS Cast SDK, `NSBonjourServices` entries and a local-network permission prompt [3]. The iPhone home-screen web app cannot cast at all.
- **Receiver:** a custom Web Receiver is an ordinary HTTPS page, so GitHub Pages qualifies. Registration is US$5 once [4]. While unpublished it runs only on devices whose serial numbers are registered in the console; friends' TVs need it published [4].
- **Session data:** custom namespaces carry JSON up to 64 KB, ample for the timestamps and the mode [5].
- **Idle behaviour:** `disableIdleTimeout` exists for non-media apps [6], but developers report shutdowns after about five minutes idle, some even with it [7]. What happens when the phone sleeps and the sender drops is unverified.
- **Capacitor plugins:** nothing well established [8][9][10]. Expect to write a small plugin, as `FloatingPlugin.java` was.

## B. AirPlay (Apple TV, AirPlay 2 TVs)

- **Safari and the home-screen app:** only `<video>` elements with a real URL can be sent to AirPlay. A video fed by a canvas stream does not AirPlay; WebKit bug 281693 is open [11]. The Float picture cannot be sent.
- **Native iPhone app:** while the person is Screen Mirroring, an app can put a separate full-screen view on the TV through an external-display scene [12]. Developers report iOS 27 changed how this is declared [14]; behaviour over AirPlay there is unverified.
- **Without mirroring:** no way was found to AirPlay a custom view.

## C. Presentation API and Remote Playback API

- **Presentation API:** Chrome, Edge and Samsung Internet; not Safari or Firefox [15]. Chrome could present a page to a Chromecast by streaming it from the computer, and loaded pages on the TV itself only for registered Cast apps; those sources are from 2017 to 2019 [16][17]. It adds nothing over tab casting plus the Cast SDK.
- **Remote Playback API:** media elements only [18], so no use for a canvas.

## D. Ways with no SDK

- **Built-in mirroring plus a TV layout.** Works from all four senders at no cost: Chrome's menu → Cast, save and share → Cast [19]; Android's Cast or Smart View; iPhone Screen Mirroring. The device must stay awake on TimeFall, and the TV shows everything the screen shows, which is why TV view switches off Work mode's private tap.
- **"Open this address on the TV".** The session travels in a link and the TV's browser draws it. A snapshot only: Pause, +5 and Stop never reach the TV without a server. Only TVs with a browser.
- **Serverless WebRTC.** Not realistic: the hand-typed exchange needs two directions, and a TV has no camera [20].

## E. Other TVs

Fire TV and Roku are not Cast receivers; both take Miracast mirroring, and Roku takes AirPlay [21]. DIAL only launches apps already installed on the TV [21].

## What was decided

1. **Built:** TV view, the page laid out for a mirrored TV. No native code, no cost, every sender.
2. **Set aside:** Google Cast with a custom receiver. If it is taken up, start with the Web Sender in Chrome and the owner's own registered device, to settle the idle and sender-drop questions before any native plugin.
3. **Not worth building:** a link for the TV's browser, AirPlay from the page, WebRTC.

## Sources

1. https://developers.google.com/cast/docs/web_sender
2. https://issuetracker.google.com/issues/193047894
3. https://developers.google.com/cast/docs/ios_sender
4. https://developers.google.com/cast/docs/registration
5. https://developers.google.com/cast/docs/web_receiver/core_features
6. https://developers.google.com/cast/docs/reference/web_receiver/cast.framework.CastReceiverOptions
7. Stack Overflow, "Google Cast custom receiver timing out", question 46673152
8. https://www.pkgstats.com/pkg:@strasberry/capacitor-cast
9. https://github.com/tbachir/capacitor-cast
10. https://www.npmjs.com/package/@caprockapps/capacitor-chromecast
11. https://bugs.webkit.org/show_bug.cgi?id=281693
12. https://developer.apple.com/documentation/bundleresources/information-property-list/uiapplicationscenemanifest/uisceneconfigurations/uiwindowscenesessionroleexternaldisplaynoninteractive
13. https://techcommunity.microsoft.com/discussions/edgeinsiderdiscussions/will-edge-some-day-support-true-chromecast/1196495
14. https://developer.apple.com/forums/thread/850825
15. https://caniuse.com/mdn-api_presentation
16. https://www.w3.org/wiki/Second_Screen/Implementation_Status
17. https://lists.w3.org/Archives/Public/public-secondscreen/2019Sep/0032.html
18. https://caniuse.com/mdn-api_remoteplayback
19. https://support.google.com/chromecast/answer/3228332
20. https://developer.tizen.org/?p=9296
21. https://www.aftvnews.com/?p=16241 and https://community.roku.com/t5/Features-settings-updates/Can-no-longer-chromecast-to-streaming-stick/m-p/685895
