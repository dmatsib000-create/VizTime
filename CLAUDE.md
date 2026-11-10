# TimeFall (repository: VizTime)

A calm visual timer for an adult with time blindness and trouble with transitions (autism and ADHD). Plain static files on GitHub Pages, installed to an iPhone home screen and kept open as a floating window on a Windows computer, and, from the same files, an iPhone app and an Android app for the owner and a few friends. It was built for its owner, who uses Work mode in a clinic where patients can see the screen. The repository keeps its first name so the web address and the saved data stay put; everything a person sees says TimeFall.

## Which document to read

| For | Read |
|---|---|
| What it must do, and why | [build-prompt.md](build-prompt.md). The requirements; wins any disagreement. |
| How it should look and feel | [design-direction.md](design-direction.md) ("Afternoon paper"). Session states, surfaces, copy voice. |
| What is built: tokens, components, patterns | [design-system.md](design-system.md). Ends with "Adding something new", the checklist for any new control. |
| What each mode does, install, limits | [README.md](README.md) |
| The same, for someone non-technical | [docs/guide.md](docs/guide.md) |
| What each script does | The comment at the top of [js/app.js](js/app.js) |
| The phone apps: what the shells are, how they are built, what tooling they add | [native/README.md](native/README.md), and the decisions with prices and sources in [docs/research/2026-11-07-timefall-native-apps.md](docs/research/2026-11-07-timefall-native-apps.md) |
| Where the TimeFall work stands, and what only the owner can do | [docs/timefall-progress.md](docs/timefall-progress.md). "Continue TimeFall" starts there. |
| What real devices actually allow | [docs/device-tests.md](docs/device-tests.md), using the [check/](check/index.html) page. Not part of the app. |
| Why the platform limits are what they are | [docs/research/](docs/research/README.md): dated reports with sources. The device tests win where they disagree. |

When docs disagree: build-prompt.md, then design-direction.md, then design-system.md. If you change behaviour, update README.md and docs/guide.md; if you change a component, update design-system.md.

## Run and test

```bash
python -m http.server 8765
```

The browser preview is set up in [.claude/launch.json](.claude/launch.json) under the name `viztime`. Tests use Node's built-in runner (Node 20+), nothing to install:

```bash
node --test
```

Tests cover the timer model ([js/engine.js](js/engine.js)), what the app says about time ([js/words.js](js/words.js), including Work mode's rule), the reminders a phone schedules ([js/cues.js](js/cues.js), including Work mode's rule there), the faces' clock marks, redraw rate and which pictures each mode offers ([js/faces.js](js/faces.js)), saved data and the codes that carry it ([js/store.js](js/store.js)), the offline file list and how the offline worker answers ([sw.js](sw.js)), the iPhone hand-off to TestFlight ([native/scripts/testflight.mjs](native/scripts/testflight.mjs), against a stand-in App Store Connect), and the names the page and the phone shells must agree on (plugin, link scheme, tones, app id, release tag). A browser check ([tests/browser-smoke.mjs](tests/browser-smoke.mjs), run with `node tests/browser-smoke.mjs`; set `CHROME` if `google-chrome` isn't on the path) loads the real page in headless Chrome in each mode and fails on any script error; it needs no packages. Everything else is checked by running the app. Any new wording about time belongs in words.js, with a test, not in a page script. CI runs the tests on every push to `main` and every pull request, and builds both phone shells on pull requests. Work on a branch and open a pull request into `main`.

The phone shells are built by [.github/workflows/android.yml](.github/workflows/android.yml) and [ios.yml](.github/workflows/ios.yml) on every change to `main`; [testflight.yml](.github/workflows/testflight.yml) keeps TestFlight current every day. When something stops on its own, see "When something lapses" in [native/README.md](native/README.md). On a desk, `cd native && npm ci && npm run sync` gathers the web app into them; never run that tooling from the repository root.

## Rules that are easy to break

**Work mode must never look like a timer.** This is the most important rule. No countdown numbers, percentages, "timer", "time's up" or "wrapping up" in Work mode, including the tab title (always "Day"), spoken cues, notifications, the phone's lock-screen reminders and the floating window. The only words it says are "Session finished." Time is shown only as a picture; the time left appears only on a private tap, for four seconds. On a phone, Work mode schedules exactly one reminder, "Session finished." with nothing under it (cues.js, tested).

**No build step, no framework, no dependencies.** Plain HTML, CSS and ES modules served as they are. Don't add npm packages; [package.json](package.json) exists only for `npm test`. The one exception is [native/](native/README.md), the phone shells, whose own package.json holds Capacitor and its plugins. The page imports nothing from there: [js/native.js](js/native.js) talks to the shells through the bridge they inject (`window.Capacitor`), and does nothing on the web.

**Relative paths everywhere.** The site is served from a subpath (`username.github.io/<repo>/`), including the manifest and service worker.

**Saved data is namespaced.** Every GitHub Pages project on the account shares one origin. Use `load` and `save` from [js/store.js](js/store.js) (prefix `viztime2:`, kept on purpose so data saved under VizTime is still found), never `localStorage` directly. Service worker caches are named `timefall-…`; the worker clears old `viztime-…` ones too.

**Offline file list.** A new file the app needs goes in `SHELL` in [sw.js](sw.js), and `CACHE` gets bumped. The tests fail if a script or font is missing. The worker fetches network-first, so editing an existing file needs no bump. The same list is what the phone shells ship (`native/scripts/collect-web.mjs`).

**Sessions are timestamps.** A session is plain data with `endAt`, `pausedAt` and `finishedAt`, so it survives closing the app. A cue whose moment passed while the app was closed is never played late (`settle` in engine.js). Keep timer logic in engine.js, pure and testable, with `now` as a parameter. On a phone, anything that must fire in the background is scheduled from those timestamps when the app leaves the screen and cancelled when it returns (`plannedCues` in cues.js, `syncBackgroundCues` in native.js); never schedule from anything else, and never let a notification double a cue the page played.

**Design rules** (detail in design-system.md):
- Ochre (`--ochre`, `--ochre-ink`) means time. Never on buttons or decoration.
- Hide, don't disable. A control that can't be used isn't shown.
- Undo instead of confirm. Stopping and removing a preset never ask first; a toast offers Undo for 10 seconds.
- Use the existing tokens and button families. No shadows, no pills, 2px corners.
- Nothing flashes, pulses or speaks unless the person turned it on in Menu → Comfort.

**Copy voice.** Calm, adult, plain. No exclamation marks, no praise, no failure framing for stopping early or running over. Optional fields are labelled "(optional)", not starred.

**Be honest about platforms.** iPhone home-screen web apps are suspended in the background, can't vibrate, and play sound only after a tap. Don't add anything that pretends otherwise; say what doesn't work.

## Checking a visual change

Light and dark, full warmth (the warning stage near the end), 200% text, 320px wide, iPhone landscape, the 200 × 200 floating window, and the Android floating window (`body.is-floating`, about 240 × 300). Check all three modes. Work mode at a glance should read as a desk clock and a schedule.

## Modules

The scripts in [js/](js/) import one another in a loop. That is safe because each only defines things and wires its own controls while loading, then calls across modules later. Keep it that way: no top-level code that calls into another module. Shared state lives in [js/state.js](js/state.js); other modules read `mode` and `session` as live bindings and change them only through `setMode` and `setSession`. [js/platform.js](js/platform.js) has no imports, so anything may read `isNative` while loading; [js/native.js](js/native.js) is the only module that talks to the shells, and [js/cues.js](js/cues.js) stays pure.
