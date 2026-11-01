# VizTime

A calm visual timer for an adult with time blindness and trouble with transitions (autism and ADHD). Plain static files on GitHub Pages, installed to an iPhone home screen and kept open as a floating window on a Windows computer. It was built for its owner, who uses Work mode in a clinic where patients can see the screen.

## Which document to read

| For | Read |
|---|---|
| What it must do, and why | [build-prompt.md](build-prompt.md). The requirements; wins any disagreement. |
| How it should look and feel | [design-direction.md](design-direction.md) ("Afternoon paper"). Session states, surfaces, copy voice. |
| What is built: tokens, components, patterns | [design-system.md](design-system.md). Ends with "Adding something new", the checklist for any new control. |
| What each mode does, install, limits | [README.md](README.md) |
| The same, for someone non-technical | [docs/guide.md](docs/guide.md) |
| What each script does | The comment at the top of [js/app.js](js/app.js) |
| What real devices actually allow | [docs/device-tests.md](docs/device-tests.md), using the [check/](check/index.html) page. Not part of the app. |

When docs disagree: build-prompt.md, then design-direction.md, then design-system.md. If you change behaviour, update README.md and docs/guide.md; if you change a component, update design-system.md.

## Run and test

```bash
python -m http.server 8765
```

The browser preview is set up in [.claude/launch.json](.claude/launch.json) under the name `viztime`. Tests use Node's built-in runner (Node 20+), nothing to install:

```bash
node --test
```

Tests cover the timer model ([js/engine.js](js/engine.js)), saved data ([js/store.js](js/store.js)) and the offline file list ([sw.js](sw.js)). Everything else is checked by running the app. CI runs the tests on every push and pull request. Work on a branch and open a pull request into `main`.

## Rules that are easy to break

**Work mode must never look like a timer.** This is the most important rule. No countdown numbers, percentages, "timer", "time's up" or "wrapping up" in Work mode, including the tab title (always "Day"), spoken cues, notifications and the floating window. The only words it says are "Session finished." Time is shown only as a picture; the time left appears only on a private tap, for four seconds.

**No build step, no framework, no dependencies.** Plain HTML, CSS and ES modules served as they are. Don't add npm packages; [package.json](package.json) exists only for `npm test`.

**Relative paths everywhere.** The site is served from a subpath (`username.github.io/<repo>/`), including the manifest and service worker.

**Saved data is namespaced.** Every GitHub Pages project on the account shares one origin. Use `load` and `save` from [js/store.js](js/store.js) (prefix `viztime2:`), never `localStorage` directly. Service worker caches are named `viztime-…`.

**Offline file list.** A new file the app needs goes in `SHELL` in [sw.js](sw.js), and `CACHE` gets bumped. The tests fail if a script or font is missing. The worker fetches network-first, so editing an existing file needs no bump.

**Sessions are timestamps.** A session is plain data with `endAt`, `pausedAt` and `finishedAt`, so it survives closing the app. A cue whose moment passed while the app was closed is never played late (`settle` in engine.js). Keep timer logic in engine.js, pure and testable, with `now` as a parameter.

**Design rules** (detail in design-system.md):
- Ochre (`--ochre`, `--ochre-ink`) means time. Never on buttons or decoration.
- Hide, don't disable. A control that can't be used isn't shown.
- Undo instead of confirm. Stopping and removing a preset never ask first; a toast offers Undo for 10 seconds.
- Use the existing tokens and button families. No shadows, no pills, 2px corners.
- Nothing flashes, pulses or speaks unless the person turned it on in Menu → Comfort.

**Copy voice.** Calm, adult, plain. No exclamation marks, no praise, no failure framing for stopping early or running over. Optional fields are labelled "(optional)", not starred.

**Be honest about platforms.** iPhone home-screen web apps are suspended in the background, can't vibrate, and play sound only after a tap. Don't add anything that pretends otherwise; say what doesn't work.

## Checking a visual change

Light and dark, full warmth (the warning stage near the end), 200% text, 320px wide, iPhone landscape, and the 200 × 200 floating window. Check all three modes. Work mode at a glance should read as a desk clock and a schedule.

## Modules

The scripts in [js/](js/) import one another in a loop. That is safe because each only defines things and wires its own controls while loading, then calls across modules later. Keep it that way: no top-level code that calls into another module. Shared state lives in [js/state.js](js/state.js); other modules read `mode` and `session` as live bindings and change them only through `setMode` and `setSession`.
