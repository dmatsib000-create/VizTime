# The phone shells

TimeFall's iPhone and Android apps are the web app one folder up, wrapped by [Capacitor](https://capacitorjs.com/). The web app stays plain HTML, CSS and ES modules with no build step; everything that needs tooling lives here, and only the automated builds in [.github/workflows](../.github/workflows) ever run it. The decisions behind this layout are in [docs/research/2026-11-07-timefall-native-apps.md](../docs/research/2026-11-07-timefall-native-apps.md).

## What is here

| Path | What it is |
|---|---|
| `package.json` | The tooling, all free and open source: Capacitor's core and CLI, its Android and iOS platforms, four plugins (App, Local Notifications, Haptics, Keep Awake) and `@capacitor/assets` for icons. |
| `capacitor.config.json` | The app's id (`io.github.dmatsib000create.timefall`), name, colours and plugin settings. |
| `scripts/collect-web.mjs` | Copies the web app into `www/` from the service worker's file list, plus the reminder tones. No dependencies. |
| `scripts/make-sounds.mjs` | Renders the three reminder tones as WAV files (the same bells as `js/sound.js`), and for Android a short silence the quiet reminder channels carry, since a channel without a sound rings with the phone's own. |
| `scripts/make-icons.mjs` | Draws the icon and splash sources in `assets/` from one SVG; `npm run icons` then fills both platforms. |
| `scripts/testflight.mjs` | Run by the iPhone workflow after an upload: waits for App Store Connect to process the build, writes "What to Test", makes sure the external group "Friends" exists with a public link, submits the build for Beta App Review and adds it to the group. With `--newest`, run daily by the TestFlight upkeep: does the same for the newest processed build, and asks for a fresh build when it has under 30 days left. Talks to the App Store Connect API with the workflow's key; no dependencies. Tested against a stand-in App Store Connect (`tests/testflight.test.js`). |
| `android/` | The Android project. TimeFall's own code: `FloatingPlugin.java` (the floating window), `MainActivity.java`, the manifest, `build.gradle` (versions and signing from the workflow's environment), the tones in `res/raw`, the status-bar icon, and the paper colours behind the page (`res/values/colors.xml`, with a night version) so the strips the shell keeps clear of the system bars match the page. |
| `ios/` | The Xcode project. TimeFall's own code: `AppDelegate.swift` copies the tones where iOS can play them; `Info.plist` declares the `timefall://` link, the "Audio, AirPlay and Picture in Picture" background mode that lets the floating picture (the page's picture-in-picture video, `js/float.js`) keep running once the app is out of sight, and answers the export-compliance question. |

`www/` and `node_modules/` are generated and not committed.

## How the page talks to the shell

[js/native.js](../js/native.js) calls plugins through the bridge Capacitor injects into the page (`window.Capacitor.nativePromise`), so the page imports nothing from here. [js/platform.js](../js/platform.js) says where the page is running. Reminders are planned by the pure, tested [js/cues.js](../js/cues.js).

## Building on a desk

Only for checking; the workflows do the real builds.

```bash
cd native && npm ci && npm run sync
```

Android, with a JDK 21 and the Android SDK (`JAVA_HOME`, `ANDROID_HOME`):

```bash
cd native/android && ./gradlew assembleDebug
```

iOS needs a Mac with Xcode 26: open `native/ios/App/App.xcodeproj`.

## The iPhone workflow's two jobs

[ios.yml](../.github/workflows/ios.yml) builds and uploads on a Mac runner, then a second, cheap job runs `scripts/testflight.mjs`. If that second job fails (Apple still processing, or test information the owner has yet to type in App Store Connect), use **Re-run failed jobs**: it picks up the same build. "Re-run all jobs" would upload the same build number again, which Apple refuses. The job's summary shows the public link.

Apple reviews one build of a version at a time. A build uploaded while another is in Beta App Review is not a failure: the job ends with a warning that it waits. [testflight.yml](../.github/workflows/testflight.yml), the **TestFlight upkeep**, runs every day: it submits the newest build once that review is decided and adds it to Friends, and it starts a fresh iPhone build when the newest has under 30 days left of TestFlight's 90.

## When something lapses

Things that stop on their own, what shows it, and the way back. All of it is in the repository's **Actions** tab.

| What | How it shows | The way back |
|---|---|---|
| GitHub switched off the scheduled workflows (it does this in a public repository after 60 days without activity; the upkeep re-enables them daily to prevent it, but if the upkeep itself was switched off first, nothing restarts it) | Actions → **TestFlight upkeep** says it is disabled, or its last run is weeks old | Actions → TestFlight upkeep → **Enable workflow**, then **Run workflow**. Do the same for **iPhone app** if it says disabled |
| Friends' TestFlight build expired (90 days after upload) | TestFlight on the phone says the build expired; friends can't open the app | Actions → **iPhone app** → **Run workflow** on `main`. The new build needs no review if the version was approved before; otherwise it waits for Beta App Review |
| A build is stuck behind another in review | The build's hand-off job shows a yellow warning, "waits" | Nothing: the upkeep submits the newest build the day after Apple decides the other. **Run workflow** on the upkeep does it at once |
| Apple rejected a build | The upkeep fails in red, "rejected in Beta App Review"; Apple emails the account holder | Fix what the email says and merge the fix; the new build goes to review |
| The App Store Connect key stopped working (revoked or deleted) | Hand-off and upkeep fail with 401 | Make a new key (docs/timefall-progress.md, step 4) and replace the `APPSTORE_PRIVATE_KEY` and `APPSTORE_KEY_ID` secrets |
| The Android signing key secrets are missing | The Android build fails in red, "signing key secrets are missing" | Put back the four `ANDROID_KEY…` secrets from the saved copy of the key. A different key can't update friends' installed app |
| A workflow file renamed or recreated | Its run number, the build number, starts again at 1, so phones refuse the "older" build | Don't rename `ios.yml` or `android.yml`. If it happened, raise the numbers in the workflow above the last ones published |

## Versions

Android's version code and name come from the workflow's run number (`TIMEFALL_BUILD`, `TIMEFALL_VERSION`); iOS's build number likewise (`CURRENT_PROJECT_VERSION`), with the version `1.0.0` set in the workflow. A build on a desk is `1.0.0-local`.
