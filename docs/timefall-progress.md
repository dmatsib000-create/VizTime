# TimeFall: progress

The running record of turning VizTime into the TimeFall phone apps. Decisions and their reasons are in [docs/research/2026-11-07-timefall-native-apps.md](research/2026-11-07-timefall-native-apps.md). When the owner says "continue TimeFall", start here.

*Last updated: 7 November 2026.*

## Where things stand

| Step | State | Waiting on |
|---|---|---|
| Rename to TimeFall in the app and docs (repository and web address stay) | Done | |
| Native shells in `native/` (Capacitor 8), icons, reminder tones | Done | |
| Reminders while locked, vibration, screen awake, Android floating window, data codes | Built, tests pass | A real phone: the owner's iPhone, a friend's Android |
| Android signing key made and stored in repository secrets | Done | |
| Android build and release workflow | Written; first run after merge | The pull request merging |
| iPhone build and TestFlight workflow | Written; compiles on CI without Apple secrets; upload untested | Apple Developer enrollment, then the App Store Connect app record and API key |
| Install page at `/install/` | Done, iPhone link pending | The TestFlight public link |
| Docs: README, guide, design system, CLAUDE.md | Done | |
| Apple Developer Program enrollment | Not started | **Owner** (US$99 a year, one to several days to approve) |
| App Store Connect: register the bundle id, create the app, make an Admin API key, note the Team ID | Not started | Owner, after enrollment |
| GitHub secrets for Apple (`APPSTORE_PRIVATE_KEY`, `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, `APPLE_TEAM_ID`) | Not started | Owner pastes them (secrets are the owner's to type) |
| First iPhone upload, TestFlight test information, public link, Beta App Review | Not started | After the secrets; review takes a day or two |
| Owner's phone checklist | Not started | A TestFlight build |

## What only the owner can do, in order

1. **Enroll in the Apple Developer Program** (iPhone: the Apple Developer app → Account → Enroll Now → Individual; pay US$99). Wait for Apple's email. Say "enrolled".
2. **Register the app id** at [developer.apple.com/account/resources/identifiers](https://developer.apple.com/account/resources/identifiers/list): + → App IDs → App → Description "TimeFall", Bundle ID *Explicit* `io.github.dmatsib000create.timefall`, no capabilities → Register.
3. **Create the app record** at [appstoreconnect.apple.com/apps](https://appstoreconnect.apple.com/apps): + → New App → iOS, Name "TimeFall" (if taken, "TimeFall Timer"), Primary language English, Bundle ID the one above, SKU `timefall`, Full Access → Create.
4. **Make an API key** at App Store Connect → Users and Access → Integrations → App Store Connect API → Team Keys → +: Name "GitHub builds", Access **Admin** → Generate. Download the `.p8` file (only offered once). Note the **Key ID** and the **Issuer ID** shown on that page.
5. **Find the Team ID** at [developer.apple.com/account](https://developer.apple.com/account) → Membership details.
6. **Add four repository secrets** at [github.com/dmatsib000-create/VizTime/settings/secrets/actions](https://github.com/dmatsib000-create/VizTime/settings/secrets/actions) → New repository secret: `APPSTORE_PRIVATE_KEY` (the whole text of the `.p8` file, opened in Notepad), `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, `APPLE_TEAM_ID`. Say "secrets done".
7. Then the assistant runs the iPhone workflow and watches it upload. When App Store Connect shows the build (10 to 30 minutes after upload): **TestFlight tab** → Test Information: Beta App Description ("A calm visual timer for time blindness and transitions. Try a session in each mode.") and Feedback Email (the owner's); → External Testing → + group "Friends" → enable **Public Link** → Add Build → submit. Beta App Review usually answers within a day or two. Copy the public link. Say "link: …".
8. Then the assistant puts the link on the install page and sends the owner's phone checklist.

## Facts the assistant should not have to rediscover

- Branch for this work: `timefall-app`; pull request into `main`.
- Android release tag pattern `android-v1.0.<run number>`; the app's update check parses it.
- Android secrets are set (4). Apple secrets are not.
- The TestFlight link goes into `install/index.html` (`#testflight-link`, and hide `#testflight-soon`).
- Tools on this PC: JDK 21 at `C:\Users\davem\Tools\jdk-21`; Android SDK at `C:\Users\davem\AppData\Local\Android\Sdk`; signing key backup at `C:\Users\davem\OneDrive\Documents\TimeFall-keys`. The PC's drive is nearly full; a local Gradle build needs over a gigabyte free.
- `node --test` must keep passing; `cd native && npm run sync` gathers the web app before any shell build.
