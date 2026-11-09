# TimeFall: progress

The running record of turning VizTime into the TimeFall phone apps. Decisions and their reasons are in [docs/research/2026-11-07-timefall-native-apps.md](research/2026-11-07-timefall-native-apps.md). When the owner says "continue TimeFall", start here.

*Last updated: 9 November 2026.*

## Where things stand

| Step | State | Waiting on |
|---|---|---|
| Rename to TimeFall in the app and docs (repository and web address stay) | Done | |
| Native shells in `native/` (Capacitor 8), icons, reminder tones | Done | |
| Reminders while locked, vibration, screen awake, Android floating window, data codes | Built, tests pass | A real phone: the owner's iPhone, a friend's Android |
| iPhone floating picture (Float in the iPhone app), and data codes that always answer | Built on 9 November 2026 after the owner found Float missing and the codes silent (branch `timefall-iphone-float-codes`); tests pass. The shell declares the picture-in-picture background mode and the page offers its floating video inside the app, as it already works in Chrome for iOS; the code sheet now says what it brought in, and a link tapped twice answers twice. Merged the same day as build 16, uploaded to TestFlight within two minutes; the hand-off job stopped at the review step because build 14 is still in Beta App Review (Apple takes one build in review per version), so build 16 is not yet in the Friends group | Apple's decision on build 14; then the assistant re-runs the failed hand-off job of the newest iPhone build (step 9 below), and then the owner's checklist items 7, 9 and 10 |
| Android: steadier reminders and floating window (PR #34): the floating window's "Session finished." is no longer taken back, closing the floating window keeps the reminders, quiet reminders are silent (new `timefall-silent…` channels), and a fresh start clears reminders a previous run left behind | Built on 9 November 2026; tests pass. Merging it also makes a new iPhone build, which carries the Float fix too | A friend's Android: the finish in the floating window, closing it and growing it back, Work mode with tones off while locked, and the Float button after force-closing mid-session |
| Android signing key made and stored in repository secrets | Done | |
| Android build and release workflow | Done: the first release, `android-v1.0.7`, was built, signed and published on 7 November 2026, and the install page's download link serves it | |
| iPhone build and TestFlight workflow | Done: build 10 of 1.0.0 was signed in the cloud and uploaded on 8 November 2026, three minutes end to end. A second job then waits for Apple's processing, makes the external group "Friends" with a public link, submits the build for Beta App Review and adds it to the group (`native/scripts/testflight.mjs`) | |
| Install page at `/install/` | Done; the iPhone link is in the page but hidden until Apple approves a build, so a friend never meets an empty TestFlight page | Beta App Review |
| Docs: README, guide, design system, CLAUDE.md | Done | |
| Apple Developer Program enrollment | Done: purchased and approved on 8 November 2026 (US$99 a year; **expires 8 November 2027**, Apple emails before then) | |
| App Store Connect: register the bundle id, create the app, make an Admin API key, note the Team ID | Done on 8 November 2026 | |
| GitHub secrets for Apple (`APPSTORE_PRIVATE_KEY`, `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, `APPLE_TEAM_ID`) | Done on 8 November 2026; the first upload used them | |
| TestFlight group "Friends" with its public link | Done: made by the first hand-off run on 8 November 2026; every later build joins it (build 14 on 9 November) | |
| TestFlight test information (feedback email, review contact), then the first Beta App Review | Test information typed on 9 November 2026; build 14 was sent to Beta App Review the same day and is waiting for review | Apple, usually a day or two |
| Owner's phone checklist | Not started | A TestFlight build |

## What only the owner can do, in order

1. **Enroll in the Apple Developer Program.** Done on 8 November 2026 (individual membership, approved the same day).
2. Done. **Register the app id** at [developer.apple.com/account/resources/identifiers](https://developer.apple.com/account/resources/identifiers/list): + → App IDs → App → Description "TimeFall", Bundle ID *Explicit* `io.github.dmatsib000create.timefall`, no capabilities → Register.
3. Done. **Create the app record** at [appstoreconnect.apple.com/apps](https://appstoreconnect.apple.com/apps): + → New App → iOS, Name "TimeFall" (if taken, "TimeFall Timer"), Primary language English, Bundle ID the one above, SKU `timefall`, Full Access → Create.
4. Done. **Make an API key** at App Store Connect → Users and Access → Integrations → App Store Connect API → Team Keys → +: Name "GitHub builds", Access **Admin** → Generate. Download the `.p8` file (only offered once). Note the **Key ID** and the **Issuer ID** shown on that page.
5. Done. **Find the Team ID** at [developer.apple.com/account](https://developer.apple.com/account) → Membership details (expiry 8 November 2027).
6. Done. **Add four repository secrets** at [github.com/dmatsib000-create/VizTime/settings/secrets/actions](https://github.com/dmatsib000-create/VizTime/settings/secrets/actions) → New repository secret: `APPSTORE_PRIVATE_KEY` (the whole text of the `.p8` file, opened in Notepad), `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, `APPLE_TEAM_ID`. Say "secrets done".
7. Done on 9 November 2026. **Type the test information once**, at [appstoreconnect.apple.com/apps](https://appstoreconnect.apple.com/apps) → TimeFall → **TestFlight** tab → **Test Information** (left column): the Beta App Description is already filled by the build; type the **Feedback Email** (yours), and under **Beta App Review Information** your first name, last name, phone number and email. Leave "Sign-in required" off. Save. Say "test info done". (The group "Friends" and its public link are made by the build itself; nothing to create by hand.)
8. Done on 9 November 2026: the re-run hand-off job sent build 14 to Beta App Review, which is waiting for review (a day or two the first time). Apple emails the owner when it is decided. When App Store Connect shows the build as approved, the assistant shows the link on the install page (`#testflight-link` loses `hidden`, `#testflight-soon` gains it).
9. **When Apple's email about build 14 arrives, say so.** The assistant then re-runs the hand-off job of the newest iPhone build only, since each later build carries everything before it: `gh run list --workflow ios.yml --branch main --event push --limit 1` gives its run, and `gh run rerun <that run> --failed` submits it and adds it to the Friends group, and TestFlight updates the phone. That is build 16 (`gh run rerun 42654762970 --failed`) unless a later merge into `main` (such as the Android fixes in PR #34) made a newer one; an older build's hand-off is left alone, because Apple takes one build in review at a time. Nothing to do in App Store Connect.

## The owner's phone checklist (once TimeFall is installed from TestFlight)

Each line says what to try and what to tell the assistant if it is off.

1. Open TimeFall. It should open in Full mode on the setup screen, with the paper look. *If not: say what you see instead.*
2. Start a 2-minute session with "Notes" and next "Lunch", then press the side button to lock the phone. At about 1 min 40 s a soft tone and "Under a minute left · Notes / Then Lunch" should appear on the Lock Screen; at 2 min, "Notes finished / Next: Lunch". *If nothing arrives: say whether the phone asked permission for notifications when you started, and whether Silent mode or a Focus was on.*
3. Unlock and open TimeFall: it should be on the finish screen, with no late sound. *If it played a sound on opening: say so.*
4. Start a 2-minute session and leave the phone on the desk with TimeFall open. The screen should stay on for the whole session. *If it dimmed or locked: say after how long.*
5. Menu → Comfort → turn on "Vibrate at the warning and the finish", start a 1-minute session and stay in the app: a short buzz at about 50 s and two at the end. *If no buzz: say so.*
6. Switch to Work mode, start a session that ends in 3 minutes, lock the phone. At the end only "Session finished." should appear, nothing else, on the Lock Screen. *If any other words or a number appear: say exactly what.*
7. On the same iPhone, open the web page in Safari, Menu → Your data → Copy a code → "Open in the TimeFall app". TimeFall should open and say "Brought in …" at the bottom, then reload with the presets in place. Tap the link a second time: it should answer again ("Brought in settings"). Then the other way: in TimeFall, Menu → Your data → Copy a code should say "Copied."; in Safari, paste it into the same place and choose "Bring in a pasted code": the line under the box should say what came in. *If the link does nothing, Safari says it can't open the page, or TimeFall opens but says nothing: say which, and whether TimeFall was already open. If "Copied." doesn't appear, or Safari says it isn't a TimeFall code: say which side.*
8. Menu → Comfort → "Try it" should play the finish tone while the app is open. *If silent with the switch off Silent: say so.*
9. Start a 5-minute session, tap **Float** at the top, then swipe up to the Home Screen or open another app. A small picture of the session should float over it and keep moving (the wash sinking, the clock hands turning). Tap it: a button should bring TimeFall back. *If Float isn't at the top, if nothing floats, or if the picture freezes once you leave: say which, and the iOS version.*
10. With the picture floating and TimeFall out of sight, let a 2-minute session reach its warning and its finish: each should arrive once, as a Lock Screen reminder, never twice. *If a tone played twice, or not at all: say so.*

## Facts the assistant should not have to rediscover

- Branch for this work: `timefall-app`, then one branch per fix (`timefall-iphone-float-codes` on 9 November 2026); pull requests into `main`.
- The iPhone shell declares the `audio` background mode (`UIBackgroundModes` in `Info.plist`), which Apple names "Audio, AirPlay and Picture in Picture": without it iOS stops a picture-in-picture video the moment the app leaves the screen. Picture-in-picture is that mode's stated purpose, so it fits App Review's rule on background modes, but mention it if a store listing is ever reviewed. If a real iPhone shows the floating picture frozen, the next step is a small Swift plugin that draws the frames natively (`AVSampleBufferDisplayLayer`, iOS 15 and later), not another web-side trick.
- Android release tag pattern `android-v1.0.<run number>`; the app's update check parses it. The iPhone build number is the run number too; a TestFlight build is "1.0.0 (<run number>)".
- The iPhone workflow has two jobs. If the second (TestFlight) fails, use **Re-run failed jobs**: it picks up the same build. "Re-run all jobs" would upload the same build number again, which Apple refuses.
- The TestFlight group "Friends" has a public link capped at 25 testers (the install page is public); raise it in App Store Connect → TestFlight → Friends if friends outgrow it.
- All eight secrets are set: four Android, four Apple.
- The TestFlight public link is `https://testflight.apple.com/join/SwUxmUAm` (group "Friends"). It is already the `href` of `#testflight-link` in `install/index.html`, hidden until the first approved build; then remove its `hidden` and hide `#testflight-soon`.
- The App Store Connect record is named **TimeFall Timer** ("TimeFall" was taken); TestFlight lists it under that name, while the installed app is called TimeFall.
- Tools on this PC: JDK 21 at `C:\Users\davem\Tools\jdk-21`; Android SDK at `C:\Users\davem\AppData\Local\Android\Sdk`; signing key backup at `C:\Users\davem\OneDrive\Documents\TimeFall-keys`. The PC's drive is nearly full; a local Gradle build needs over a gigabyte free.
- `node --test` must keep passing; `cd native && npm run sync` gathers the web app before any shell build.
- Apple enrollment, from Apple's own page: an order acknowledgement email arrives at purchase and a membership confirmation email once the purchase is processed; if no confirmation arrives within 24 hours, use [developer.apple.com/contact](https://developer.apple.com/contact/) and quote the Enrollment ID from the order email. Apple gives no other timescale; people report anything from a day to several weeks, longer when Apple asks for photo identification (it does when the card is not in the applicant's own name). Until the confirmation comes, nothing else on the Apple side can be done. The membership year, and so the renewal date, starts when Apple activates it: write that date here when the email arrives.
