# TimeFall as phone apps: the decisions and what they cost

*7 November 2026.* VizTime becomes TimeFall, a real iPhone app and a real Android app for its owner and a few friends, built in the cloud from this repository. This report records every decision taken to get there, with the prices, limits and rules checked on this date and linked. It is the reference for [native/](../../native/README.md), the two workflows in [.github/workflows](../../.github/workflows), and the progress file [docs/timefall-progress.md](../timefall-progress.md). Where it disagrees with what a real phone does, [device-tests.md](../device-tests.md) will win once those tests are run.

**In short.** The web app stays exactly what it is: plain files on GitHub Pages. Capacitor 8 wraps it in two native shells kept in `native/`. The shells fix what the web version can't do on a phone: cues arrive as soft notifications while the phone is locked, the phone can vibrate, the screen stays awake, and Android gets a floating window. Presets and settings move between the web version and the app with a code or a one-tap link. GitHub Actions builds both apps on every change to `main`; iPhone builds go to TestFlight, Android builds to a GitHub release that an install page links to. The only money is Apple's US$99 a year. The repository keeps its name, because renaming it would break the web address.

## What it costs, checked today

| Item | Price | Limit that matters | Source |
|---|---|---|---|
| Apple Developer Program (individual) | US$99 per membership year; local currency shown at enrollment; needs a legal name and two-factor sign-in | Lets the account upload to TestFlight and, later, the App Store | [Apple: Enrolling](https://developer.apple.com/programs/enroll/) |
| TestFlight | Free with the program | Up to 10,000 external testers by email or a public link; 100 internal testers; up to 100 builds at once; the first build sent to an external group goes through App Review; a build stops working 90 days after upload | [Apple: TestFlight](https://developer.apple.com/testflight/), [App Store Connect Help: TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview) |
| GitHub Actions on a public repository | Free on standard GitHub-hosted runners, Mac included | 20 jobs at once, of which 5 on macOS; a job may run 6 hours; macOS would otherwise cost US$0.062 a minute | [GitHub: Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [GitHub: Actions limits](https://docs.github.com/en/actions/reference/limits) |
| GitHub Pages and Releases | Free on a public repository | Already in use for the web version; releases hold the Android file | [GitHub: Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) |
| Android distribution outside the Play Store | Free | A signed APK can be installed from a link once the phone allows that source; no account with Google | [Android: Alternative distribution](https://developer.android.com/distribute/marketing-tools/alternative-distribution) |
| Google Play (not used now) | US$25 once, if a store listing is ever wanted | Not needed for a private link | [Google Play Console: registration](https://support.google.com/googleplay/android-developer/answer/6112435) |

**Total: US$99 a year, nothing once.** Everything else fits the free tiers with room to spare: a build of each app takes under fifteen minutes, and a handful of changes a month is a fraction of what the free plan allows even if the repository were private.

## The wrapper: Capacitor 8, in its own folder

[Capacitor](https://capacitorjs.com/) is the standard way to put a web app inside an iPhone or Android app and reach the phone's own features. Version 8 is current (8.6.0 today, released December 2025, in active support), needs Node 22 or later and Xcode 26 or later, and uses Swift Package Manager on iOS, so no CocoaPods ([Capacitor: environment setup](https://capacitorjs.com/docs/getting-started/environment-setup)). The alternatives were a hand-written WKWebView and WebView app (more native code to maintain, the same result) and Tauri or React Native (a build step or a rewrite, which the rules forbid). Capacitor adds a dependency, so it lives entirely in [native/](../../native/README.md) with its own `package.json`; the web app one folder up still has none and still runs from the repository root.

What the shells add, all open source and free:

| Package | Version today | Why |
|---|---|---|
| `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/ios` | 8.6.0 | The runtime and the two platform projects |
| `@capacitor/local-notifications` | 8.3.1 | Cues while the phone is locked: notifications scheduled from the session's timestamps, with a sound file each |
| `@capacitor/haptics` | 8.0.2 | Vibration |
| `@capacitor-community/keep-awake` | 8.0.1 | Keeps the screen on while a session runs |
| `@capacitor/app` | 8.1.2 | Knows when the app goes to the background, receives the `timefall://` link, reports the build number |
| `@capacitor/assets` | 4.0.0 | Only on a desk: turns one icon drawing into every size both platforms want |

**The page imports none of this.** Capacitor injects a bridge object (`window.Capacitor`) into the page, and its `nativePromise` and `addListener` functions call any plugin the shell has registered ([Capacitor source: native-bridge.ts](https://github.com/ionic-team/capacitor/blob/main/core/native-bridge.ts)). [js/native.js](../../js/native.js) uses only those, so the web app needs no bundler and no `@capacitor/core` in its scripts. On the web page `window.Capacitor` doesn't exist and every call is a no-op. The reminders themselves are planned by [js/cues.js](../../js/cues.js), which is pure and tested, in the same way `words.js` keeps Work mode honest.

The web app is gathered into the shells by `native/scripts/collect-web.mjs` from the service worker's own file list, so the app ships exactly the files it caches offline. The shells don't register the service worker; they carry their own copy of the page.

App id: `io.github.dmatsib000create.timefall` (a GitHub Pages address spelled backwards, since there is no domain to spell; it is valid on both platforms and unlikely to collide). Display name: TimeFall. Android: minimum Android 7 (API 24), built for Android 16 (API 36), as Capacitor 8 sets them. iPhone: iOS 15 or later.

## The name, the web address and the saved data

TimeFall is the name wherever a person sees it: the page title, the home-screen label, the app's name, the menu, the docs. Three things keep their old names, on purpose:

- **The repository stays `VizTime`, and so does the web address.** GitHub redirects a renamed repository's pages and git addresses, but states that project site URLs are the exception ([GitHub: Renaming a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository)). A rename would therefore break the owner's installed home-screen app and every link, with no redirect to tell it where to go. A custom domain would fix that for about US$10 a year, but it would also move the site to a new origin, which is where the saved data lives. Not worth it for a private app.
- **The saved-data prefix stays `viztime2:`.** Storage is per origin, and the prefix only keeps this app's keys apart from the owner's other Pages projects. Keeping it means every preset, note and setting saved under VizTime is still there under TimeFall. The comment in [js/store.js](../../js/store.js) says so.
- **The service worker's caches are renamed** to `timefall-…`, and the worker deletes caches under either name when it activates, so an installed VizTime updates itself into TimeFall on its next online visit and nothing is left behind.

One caveat for the owner: an iPhone home-screen app's label was fixed when it was added, so the icon on their phone may still say "VizTime" until they remove it and add it again. Everything inside it says TimeFall, and its data survives either way. The native app is separate from the home-screen web app: it has its own storage. That is why the app can bring in a code (below).

App Store Connect needs an app name that no other app on the store uses, even for TestFlight. If "TimeFall" is taken there, the record can be named "TimeFall Timer" or similar; the name on the phone stays TimeFall.

## Work mode on a phone, and what the phone shows

Work mode must never look like a timer. On a phone, three new surfaces show the app's name and icon: the home screen, the app switcher, and a notification on the lock screen. The decisions:

- **The icon is the Sun face's mark:** a low ochre sun on a horizon line, on paper. No clock hands, no hourglass, no numbers. It reads as a sunset, or as nothing in particular, which is right.
- **The name stays TimeFall.** It hints at time, not at a timer or a countdown. A neutral alias ("Day") was considered and rejected: the owner chose the name, friends would be confused by a different one, and neither iOS nor Android lets an app show a different name on one notification than on the home screen.
- **The app switcher shows the page as it is**, so in Work mode it shows a desk clock and a schedule, the same thing a bystander sees on the desk.
- **Work mode schedules exactly one notification, "Session finished.", with nothing under it**, and only when the app is out of sight. [tests/cues.test.js](../../tests/cues.test.js) holds it to that, as [tests/words.test.js](../../tests/words.test.js) holds the words. With the screen kept awake and the app in front, which is how Work mode is used on a desk, no notification is shown at all; the page shows "Session finished." itself.

## Reminders while the phone is locked

This is the main thing a native app fixes. A home-screen web app is suspended the moment it leaves the screen, so it can't sound a cue then ([platform-assumptions.md](platform-assumptions.md)). A native app can ask the phone to show a notification at a set moment, and the phone does it with the app closed or the screen locked.

**How it works.** While the app is in front, the page plays its own cues exactly as the web version does. The moment the app goes to the background (the person switches apps or locks the phone), `js/native.js` cancels any pending reminders and schedules the cues still to come, from the session's timestamps. When the app comes back, it cancels them again. So a notification never doubles a cue the page played, the Work-mode rule holds, and nothing can play late: a cue whose moment passed while the app was closed is settled silently on return, exactly as before. Reminders are on by default in the apps and off by default on the web, and the Comfort menu says so.

**Android.** Notifications scheduled with `allowWhileIdle` use exact alarms, which Android 12 and later only honour with a permission. Android 13 added `USE_EXACT_ALARM`, granted at install without a prompt (Android 12 uses `SCHEDULE_EXACT_ALARM`, which the notifications plugin declares), meant for apps whose purpose is timing: calendars and alarm clocks are the examples Google gives, and a timer is the same kind of thing ([Android 14: exact alarms](https://developer.android.com/about/versions/14/changes/schedule-exact-alarms)). The manifest declares it. If a phone's settings still turn exact timing off, the menu says so and offers the setting ([Capacitor: Local Notifications](https://capacitorjs.com/docs/apis/local-notifications)). Android 13 and later ask the person once whether the app may show notifications; the app asks when the first session starts, so the question comes with its reason. Each tone needs its own notification channel on Android 8 and later, because a channel's sound is fixed when it is made: TimeFall makes eight (halfway, warning, finish and quiet, each with and without vibration), named plainly in the phone's settings. A channel made without a sound plays the phone's own notification sound, so the quiet ones carry a short silent sound (corrected 9 November 2026: the first quiet channels rang).

**iPhone.** Local notifications need no special permission beyond the one-time question. A custom sound must be a WAV, AIFF or CAF file under 30 seconds, in the app bundle or the app's `Library/Sounds` folder ([Apple: UNNotificationSound](https://developer.apple.com/documentation/usernotifications/unnotificationsound)). The three tones are rendered by `native/scripts/make-sounds.mjs` (the same bells as `js/sound.js`, 4 and 5 seconds long), shipped in the app, and copied into `Library/Sounds` by `AppDelegate.swift` on each launch. The honest limits: iPhone's Silent switch and Focus modes mute or hold notification sounds exactly as they do for any app, and the "Play tones in Silent mode" option only applies while TimeFall is open. The phone's own setting decides whether a notification vibrates.

**What stays impossible.** A spoken line can't be delivered while the app is in the background on either platform; the notification's words take its place. Nothing fires late, by design.

## What the native apps fix, and the improvements chosen

Fixed, from the limits the README recorded:

| Limit of the web version | In the apps |
|---|---|
| Cues can't sound while the phone is locked or the app is in the background | Reminders at the warning and the finish (and halfway, when that tone is on), as above |
| No vibration | **Vibrate at the warning and the finish**, off until turned on in Comfort, through the Haptics plugin while the app is in front; the phone's own notification setting while it isn't |
| Sound only after a tap | The shells' web views allow playback without a tap ([Capacitor iOS](https://github.com/ionic-team/capacitor/blob/main/ios/Capacitor/Capacitor/CAPBridgeViewController.swift) sets `mediaTypesRequiringUserActionForPlayback = []`; [Capacitor Android](https://github.com/ionic-team/capacitor/blob/main/android/capacitor/src/main/java/com/getcapacitor/Bridge.java) sets `setMediaPlaybackRequiresUserGesture(false)`). The page still unlocks audio on the first tap, so nothing depends on this until a device test confirms it |
| Keeping the screen awake only where iOS allows it | The Keep Awake plugin holds the screen while a session runs, in both apps, under the same Comfort switch |
| No floating view from the iPhone home screen | **Android: a floating window.** Apple gives apps no way to keep a small window over other apps except for video, which is the same door that is shut for the home-screen app; not fixed on iPhone. *Corrected on 9 November 2026: the iPhone app floats the picture as a video after all; see "What is not possible" below* |

Further improvements, at most five, each with how it helps:

1. **Android floating window, and floating on its own.** `FloatingPlugin.java` shrinks the whole app into a small window over other apps (picture-in-picture, Android 8 and later ([Android: picture-in-picture](https://developer.android.com/develop/ui/views/picture-in-picture))); the page keeps only the picture and the words that matter. While it floats, the cues are handed to the phone as reminders, because a swipe that closes the window ends the app before it could schedule anything, and the page leaves each cue that has a reminder to it. A cue the phone wasn't given (Work mode's warning, or any cue with reminders off) is still played by the page (corrected 9 November 2026: at first the page went quiet for every cue, and those were lost). An option in Comfort lets it float by itself when the person leaves the app during a session. *Helps because the time stays in the corner of the eye while doing the other thing, which is where time blindness bites.*
2. **Presets and settings travel.** Menu → Your data makes a code (settings, presets, notes, saved lengths) and brings one in; on a phone the web page also offers "Open in the TimeFall app", a `timefall://` link that carries the code across in one tap. Settings that belong to the device (reminders, vibration, Silent-mode tones) stay as they are. *Helps because nothing has to be set up again, and a routine already learned moves with the person.* It is also the only backup the web version has ever had.
3. **A quiet note when a newer Android build exists.** Once a day the Android app compares its build number with the latest GitHub release and, if it is behind, says so in one line on the setup screen with a link to the install page. *Helps because a friend never has to remember to look for updates, and never gets a pop-up.*

Nothing else was added. Candidates set aside, with why: an iPhone Live Activity on the Lock Screen (real Swift work and a widget target, and its countdown digits would be hard to square with Work mode; worth a future report), home-screen quick actions and widgets (native code on both platforms for a modest gain), and spoken cues from the background (not possible).

## How friends get the apps, and updates

**iPhone: TestFlight.** The workflow itself puts each build in front of friends: after the upload, a second job ([native/scripts/testflight.mjs](../../native/scripts/testflight.mjs)) waits for App Store Connect to process the build, creates the external group "Friends" with a public link the first time, submits the build for Beta App Review and adds it to the group, in the order fastlane's `pilot` uses ([fastlane: pilot build manager](https://github.com/fastlane/fastlane/blob/master/pilot/lib/pilot/build_manager.rb)). It uses the same API key as the upload, so no extra secret; the key needs no special role beyond Admin. The public link is capped at 25 testers because the install page is public; the cap is a group setting in App Store Connect and can be raised to 10,000 ([Apple: BetaGroup attributes](https://developer.apple.com/documentation/appstoreconnectapi/betagroupcreaterequest/data-data.dictionary/attributes-data.dictionary)). What the owner types once, since it is theirs: the feedback email and the Beta App Review contact (name, phone, email). The first build in a group goes to Beta App Review; later builds of the same version don't, unless something significant changes. A TestFlight build expires 90 days after upload, so the iPhone workflow also runs on a schedule, every second month, and TestFlight updates the app on the phone by itself. External testing needs a beta description and a feedback email in App Store Connect ([Apple: TestFlight](https://developer.apple.com/testflight/)); a privacy policy URL is a separate field that this report believes is optional for TestFlight, and the progress file says what to do if App Store Connect insists.

**Android: a link to a file.** Every build on `main` becomes a GitHub release tagged `android-v1.0.<build>` with `TimeFall.apk` attached, so the install page's download link (`…/releases/latest/download/TimeFall.apk`) always gives the newest. The phone asks once to allow installs from the browser, and Google Play Protect may ask about an app it doesn't know. Every build is signed with the same key, which is what lets a new build install over the old one and keep its data; the key is in the repository's secrets and in the owner's `Documents\TimeFall-keys` folder, with a note on why it must not be lost. Updates: the in-app note above. The check is one request to GitHub's public API, allowed 60 times an hour per address without any account ([GitHub REST API: rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)); the app makes it once a day and sends nothing about the phone or its owner, which keeps to the no-accounts, no-server, no-analytics rule as the web version already does by loading from GitHub Pages.

**One page for both:** [install/index.html](../../install/index.html), at `…/VizTime/install/`, with the iPhone link filled in once TestFlight has it.

## The build pipeline

Two GitHub Actions workflows, both free on this public repository:

- [android.yml](../../.github/workflows/android.yml): on every change to the app files or `native/` on `main`, an Ubuntu runner installs the tooling, gathers the web app, builds a release APK with Gradle, signs it with the key from the secrets, and publishes the release. A pull request builds unsigned, to prove the shell compiles. Version code and name come from the run number, which only ever grows.
- [ios.yml](../../.github/workflows/ios.yml): on the same changes, on a schedule, or by hand, a `macos-26` runner (Xcode 26.6 by default today ([GitHub runner images: macOS 26](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-Readme.md))) archives the app unsigned, then exports it with Apple's **cloud signing**: given an App Store Connect API key, `xcodebuild -exportArchive -allowProvisioningUpdates` creates the provisioning profile, signs with a distribution certificate Apple holds for the account, and uploads straight to TestFlight. No certificate files have to be made on a Mac or stored anywhere. The one known requirement is that the API key has the **Admin** role; a Developer or App Manager key authenticates but fails at signing ([Apple Developer Forums: cloud signing needs admin](https://developer.apple.com/forums/thread/698117)). Without the Apple secrets, and on pull requests, the workflow compiles the app for the simulator instead, so the shell is checked before the account exists. `ITSAppUsesNonExemptEncryption` is set to false in `Info.plist` (the app only uses HTTPS, which is exempt), so App Store Connect doesn't ask the export question on every build ([Apple: ITSAppUsesNonExemptEncryption](https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption)).

Secrets the workflows read, all set in the repository's settings and never in files: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, and `APPSTORE_PRIVATE_KEY`, `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, `APPLE_TEAM_ID`. All eight are set (8 November 2026).

Outcome: cloud signing worked first time. The first signed upload (build 10 of 1.0.0, 8 November 2026) took three minutes from checkout to "Upload succeeded". The fallback, kept here in case a later Xcode changes the rules: cloud signing from the command line is documented thinly and reported as finicky. If the export step ever fails with the right key, the fallback is the classic route: make a distribution certificate request on this PC with OpenSSL, have Apple issue the certificate through the same API key, and store the resulting certificate and its password as two more secrets for the workflow to import into a temporary keychain. Nothing in the project layout changes for that.

## What was installed on this PC

All free and standard, none needing administrator rights:

- Eclipse Temurin JDK 21 (the plain zip, no installer) at `C:\Users\davem\Tools\jdk-21`.
- Android SDK command-line tools, platform tools, the Android 16 platform (API 36) and build tools 36.0.0 at `C:\Users\davem\AppData\Local\Android\Sdk`.
- Capacitor and its plugins inside `native\node_modules` (about 150 packages, re-created by `npm ci`).
- The Android signing key and its password in `C:\Users\davem\OneDrive\Documents\TimeFall-keys`, outside the repository and synced by OneDrive.

The JDK's own installer was tried first and asked for administrator rights, which the session didn't have, so the zip was used instead. A local Android build was started to check the shell before pushing, but the PC's drive ran out of space while Gradle downloaded its parts (it needs over a gigabyte of cache), so that check is left to the workflow's pull-request build.

## What is not possible, and why

- **A floating window on iPhone.** iOS has no picture-in-picture for anything but video, and the video route is what Apple's web-app container already refuses ([iphone-home-screen-pip.md](iphone-home-screen-pip.md)); a native app could float a video of the picture, but it would be the same experiment, with the same freezing, and the picture couldn't be tapped. The app keeps the screen awake instead and its reminders reach the Lock Screen.
  *Corrected on 9 November 2026, after the owner found Float missing from the iPhone app.* This bullet drew the wrong conclusion from the Home Screen finding. The block there sits in the container, not in the engine: the same web view inside a full app does float video, as device test 7 showed in Chrome for iOS, which is exactly that. The iPhone shell is such an app, so it now declares the "Audio, AirPlay and Picture in Picture" background mode (`UIBackgroundModes` in `Info.plist`, the permit that keeps the video running out of sight ([Apple: Picture in Picture Quick Start](https://developer.apple.com/library/ios/documentation/WindowsViews/Conceptual/AdoptingMultitaskingOniPad/QuickStartForPictureInPicture.html))), and `js/float.js` offers the page's own floating video inside it. While it floats out of sight, the page leaves each cue that has a Lock Screen reminder to it (`phoneCarriesCue` in `js/cues.js`, tested), so nothing sounds twice, and plays any other itself. What the bullet got right stays: the picture can't be tapped except to return, and whether it keeps moving on a real iPhone is for the owner's checklist in [timefall-progress.md](../timefall-progress.md) to show; if it freezes, the next step is a small Swift plugin that draws the frames natively (`AVSampleBufferDisplayLayer`, iOS 15 and later).
- **Spoken cues from the background.** Neither platform speaks for a suspended app.
- **Reminders that get past Silent mode or Focus on iPhone.** Apple decides that per phone; the app says so.
- **An update that installs itself on Android** without a store. The note and the link are the honest version.
- **Testing on real phones from this PC.** Everything here was built and compiled, and the web app was checked in a browser; the owner's phone and the friends' phones are the first real test, and [device-tests.md](../device-tests.md) is where to record what they show.

## Dates and renewals

| What | When | Who |
|---|---|---|
| Apple Developer Program | Yearly: the current membership expires 8 November 2027; Apple emails before it lapses. If it lapses, TestFlight installs stop working | Owner |
| TestFlight builds | Expire 90 days after upload; the workflow uploads a fresh one every second month on its own | Nobody, unless the Apple secrets stop working |
| App Store Connect API key | Does not expire; can be revoked and remade in App Store Connect | Owner, only if lost |
| Android signing key | Valid until 2056 | Owner keeps the backup |
| Xcode and SDK requirements | Apple raises the required SDK most years in April; GitHub's runner images follow, and Capacitor's support policy says which version to update to | Whoever maintains the repository |

## A free store listing, later

If the owner ever wants TimeFall in the App Store and Google Play for free: **time**, about a day for each store's forms, screenshots and a short privacy statement, plus App Review's one to three days; **money**, US$25 once for Google Play, nothing more for Apple; **risk**, Apple's rule 4.2 on minimum functionality ([App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality)) is the one that catches wrapped web apps, which is why the shells do real native work (scheduled notifications, haptics, screen wake, picture-in-picture) rather than only showing a page; Google's review is lighter. Nothing decided here would need undoing: no account, no server, no analytics, so the privacy statement would be a few honest lines.
