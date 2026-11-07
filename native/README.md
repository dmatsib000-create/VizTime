# The phone shells

TimeFall's iPhone and Android apps are the web app one folder up, wrapped by [Capacitor](https://capacitorjs.com/). The web app stays plain HTML, CSS and ES modules with no build step; everything that needs tooling lives here, and only the automated builds in [.github/workflows](../.github/workflows) ever run it. The decisions behind this layout are in [docs/research/2026-11-07-timefall-native-apps.md](../docs/research/2026-11-07-timefall-native-apps.md).

## What is here

| Path | What it is |
|---|---|
| `package.json` | The tooling, all free and open source: Capacitor's core and CLI, its Android and iOS platforms, four plugins (App, Local Notifications, Haptics, Keep Awake) and `@capacitor/assets` for icons. |
| `capacitor.config.json` | The app's id (`io.github.dmatsib000create.timefall`), name, colours and plugin settings. |
| `scripts/collect-web.mjs` | Copies the web app into `www/` from the service worker's file list, plus the reminder tones. No dependencies. |
| `scripts/make-sounds.mjs` | Renders the three reminder tones as WAV files (the same bells as `js/sound.js`). |
| `scripts/make-icons.mjs` | Draws the icon and splash sources in `assets/` from one SVG; `npm run icons` then fills both platforms. |
| `android/` | The Android project. TimeFall's own code: `FloatingPlugin.java` (the floating window), `MainActivity.java`, the manifest, `build.gradle` (versions and signing from the workflow's environment), the tones in `res/raw`, the status-bar icon. |
| `ios/` | The Xcode project. TimeFall's own code: `AppDelegate.swift` copies the tones where iOS can play them; `Info.plist` declares the `timefall://` link and answers the export-compliance question. |

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

## Versions

Android's version code and name come from the workflow's run number (`TIMEFALL_BUILD`, `TIMEFALL_VERSION`); iOS's build number likewise (`CURRENT_PROJECT_VERSION`), with the version `1.0.0` set in the workflow. A build on a desk is `1.0.0-local`.
