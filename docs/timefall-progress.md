# TimeFall: progress

The running record of turning VizTime into the TimeFall phone apps. Decisions and their reasons are in [docs/research/2026-11-07-timefall-native-apps.md](research/2026-11-07-timefall-native-apps.md). When the owner says "continue TimeFall", start here.

*Last updated: 8 November 2026.*

## Where things stand

| Step | State | Waiting on |
|---|---|---|
| Rename to TimeFall in the app and docs (repository and web address stay) | Done | |
| Native shells in `native/` (Capacitor 8), icons, reminder tones | Done | |
| Reminders while locked, vibration, screen awake, Android floating window, data codes | Built, tests pass | A real phone: the owner's iPhone, a friend's Android |
| Android signing key made and stored in repository secrets | Done | |
| Android build and release workflow | Done: the first release, `android-v1.0.7`, was built, signed and published on 7 November 2026, and the install page's download link serves it | |
| iPhone build and TestFlight workflow | Written; the compile check passed on CI (Xcode 26.6); the signed upload is untested until the Apple secrets exist | Apple Developer enrollment, then the App Store Connect app record and API key |
| Install page at `/install/` | Done, iPhone link pending | The TestFlight public link |
| Docs: README, guide, design system, CLAUDE.md | Done | |
| Apple Developer Program enrollment | Purchased on 8 November 2026 (US$99 a year); Apple shows "enrollment pending" | **Apple's confirmation email**, then the owner says "enrolled" |
| App Store Connect: register the bundle id, create the app, make an Admin API key, note the Team ID | Not started | Owner, after enrollment |
| GitHub secrets for Apple (`APPSTORE_PRIVATE_KEY`, `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, `APPLE_TEAM_ID`) | Not started | Owner pastes them (secrets are the owner's to type) |
| First iPhone upload, TestFlight test information, public link, Beta App Review | Not started | After the secrets; review takes a day or two |
| Owner's phone checklist | Not started | A TestFlight build |

## What only the owner can do, in order

1. **Enroll in the Apple Developer Program.** Done: purchased on 8 November 2026 as an individual; Apple showed "enrollment pending, you'll receive an email soon". Wait for Apple's confirmation email, then say "enrolled". If Apple's email asks for anything (photo identification, a call), do that first. If no confirmation has come within 24 hours of the purchase, Apple says to contact them (see the facts below).
2. **Register the app id** at [developer.apple.com/account/resources/identifiers](https://developer.apple.com/account/resources/identifiers/list): + → App IDs → App → Description "TimeFall", Bundle ID *Explicit* `io.github.dmatsib000create.timefall`, no capabilities → Register.
3. **Create the app record** at [appstoreconnect.apple.com/apps](https://appstoreconnect.apple.com/apps): + → New App → iOS, Name "TimeFall" (if taken, "TimeFall Timer"), Primary language English, Bundle ID the one above, SKU `timefall`, Full Access → Create.
4. **Make an API key** at App Store Connect → Users and Access → Integrations → App Store Connect API → Team Keys → +: Name "GitHub builds", Access **Admin** → Generate. Download the `.p8` file (only offered once). Note the **Key ID** and the **Issuer ID** shown on that page.
5. **Find the Team ID** at [developer.apple.com/account](https://developer.apple.com/account) → Membership details.
6. **Add four repository secrets** at [github.com/dmatsib000-create/VizTime/settings/secrets/actions](https://github.com/dmatsib000-create/VizTime/settings/secrets/actions) → New repository secret: `APPSTORE_PRIVATE_KEY` (the whole text of the `.p8` file, opened in Notepad), `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, `APPLE_TEAM_ID`. Say "secrets done".
7. Then the assistant runs the iPhone workflow and watches it upload. When App Store Connect shows the build (10 to 30 minutes after upload): **TestFlight tab** → Test Information: Beta App Description ("A calm visual timer for time blindness and transitions. Try a session in each mode.") and Feedback Email (the owner's); → External Testing → + group "Friends" → enable **Public Link** → Add Build → submit. Beta App Review usually answers within a day or two. Copy the public link. Say "link: …".
8. Then the assistant puts the link on the install page and sends the owner's phone checklist.

## The owner's phone checklist (once TimeFall is installed from TestFlight)

Each line says what to try and what to tell the assistant if it is off.

1. Open TimeFall. It should open in Full mode on the setup screen, with the paper look. *If not: say what you see instead.*
2. Start a 2-minute session with "Notes" and next "Lunch", then press the side button to lock the phone. At about 1 min 40 s a soft tone and "Under a minute left · Notes / Then Lunch" should appear on the Lock Screen; at 2 min, "Notes finished / Next: Lunch". *If nothing arrives: say whether the phone asked permission for notifications when you started, and whether Silent mode or a Focus was on.*
3. Unlock and open TimeFall: it should be on the finish screen, with no late sound. *If it played a sound on opening: say so.*
4. Start a 2-minute session and leave the phone on the desk with TimeFall open. The screen should stay on for the whole session. *If it dimmed or locked: say after how long.*
5. Menu → Comfort → turn on "Vibrate at the warning and the finish", start a 1-minute session and stay in the app: a short buzz at about 50 s and two at the end. *If no buzz: say so.*
6. Switch to Work mode, start a session that ends in 3 minutes, lock the phone. At the end only "Session finished." should appear, nothing else, on the Lock Screen. *If any other words or a number appear: say exactly what.*
7. On the same iPhone, open the web page in Safari, Menu → Your data → Copy a code → "Open in the TimeFall app". TimeFall should open and say "Brought in …" *If the link does nothing or Safari says it can't open the page: say which.*
8. Menu → Comfort → "Try it" should play the finish tone while the app is open. *If silent with the switch off Silent: say so.*

## Facts the assistant should not have to rediscover

- Branch for this work: `timefall-app`; pull request into `main`.
- Android release tag pattern `android-v1.0.<run number>`; the app's update check parses it.
- Android secrets are set (4). Apple secrets are not.
- The TestFlight link goes into `install/index.html` (`#testflight-link`, and hide `#testflight-soon`).
- Tools on this PC: JDK 21 at `C:\Users\davem\Tools\jdk-21`; Android SDK at `C:\Users\davem\AppData\Local\Android\Sdk`; signing key backup at `C:\Users\davem\OneDrive\Documents\TimeFall-keys`. The PC's drive is nearly full; a local Gradle build needs over a gigabyte free.
- `node --test` must keep passing; `cd native && npm run sync` gathers the web app before any shell build.
- Apple enrollment, from Apple's own page: an order acknowledgement email arrives at purchase and a membership confirmation email once the purchase is processed; if no confirmation arrives within 24 hours, use [developer.apple.com/contact](https://developer.apple.com/contact/) and quote the Enrollment ID from the order email. Apple gives no other timescale; people report anything from a day to several weeks, longer when Apple asks for photo identification (it does when the card is not in the applicant's own name). Until the confirmation comes, nothing else on the Apple side can be done. The membership year, and so the renewal date, starts when Apple activates it: write that date here when the email arrives.
