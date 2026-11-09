# TimeFall

A calm visual timer for time blindness and transitions. Plain static files that install to a phone home screen and work offline, and, from the same files, an iPhone app and an Android app (see [The phone apps](#the-phone-apps)). The repository keeps its first name, VizTime, so the web address and the saved data stay where they are. The look ("Afternoon paper") is described in [design-direction.md](design-direction.md) and documented as built in [design-system.md](design-system.md); the requirements are in [build-prompt.md](build-prompt.md).

New to TimeFall, or not technical? Start with the [plain-language guide](docs/guide.md), with pictures of every screen.

## Three modes

- **Full.** What this time is for, what comes next, and an ochre wash on paper whose area is the time left. A dotted ring shows where the warning stage begins, so the end is visible from the start. Supporting numbers: time left and the end clock time. Pause, −5, −1, +1, +5, Finish now, Stop. Presets start in one tap. The dots under the time figures swap the disc for one of Work mode's faces (Level, Sun, Planner), with Level and Sun drawing their clock hands finer and lighter so the time left stays the strongest mark, or for the Ruler, which is Full's alone: a ruled strip, shaded where time has passed and washed where it remains, with minute marks and clock times along the top, so the minutes left can be counted as well as judged. Full remembers its own choice, separately from Work.
- **Work.** Reads as an ordinary desk clock and schedule: a large clock time, a "now" entry and a "next" entry. The time is shown only as a picture, with three faces to flip between (the dots under it):
  - **Planner**: a day-planner page. The session is an appointment block on a real clock grid with a "now" line moving through it; the wash below the line is the time left. In the last stretch the page eases into a closer view of the end of the block and the next entry, which warms. A bystander sees a calendar.
  - **Level**: a clock whose dial holds a sinking ochre level, with a small mark where the warning begins.
  - **Sun**: a clock with a low sun arcing to the horizon and sinking at the end.
  Tapping the picture shows the time left for four seconds. Controls hide behind **Edit**. The tab title is "Day". It finishes with "Session finished."
  Setting up looks like adding an entry to the day: the desk clock sits on top, it opens on **Until**, with end-time buttons ("2:15", "2:30") and a "next starts at" time. **For** (minutes) is one tap away; typed minutes there are confirmed only as an end time. Full and Simple open on For.
- **Simple.** Six large lengths or exact minutes. While running: the picture, Pause, −5, +5, Reset.

Switch modes with **Full · Work · Simple** at the top of the screen, or **Alt+1**, **Alt+2**, **Alt+3** on a keyboard, at any time without touching a running session. **Menu → Open in** sets the mode the app starts in.

## The handoff

- The whole page warms slightly through the warning stage, like late-afternoon light, and settles at the finish. That light is the main cue in every mode.
- In Full mode the next activity gets its own card in the warning stage. It fills and grows as the end approaches and shows the first small step and your last note for it.
- The note about where you left off is offered during the warning stage (and on the finish screen). It reappears as a ribbon bookmark the next time you start that activity.
- The finish screen puts the next activity first with one main button, such as "Start Lunch · 25 min", and other lengths below it. Turn on **Menu → Activities → Remember how long each activity usually runs** and that button suggests the length you last used for that activity. Extra time (+2, +5, +10) starts its own short, full-size segment.
- **Until** sets a session by when the next thing starts, minus time to get there.

## Stop, finish, reset

- **Stop** discards the session and returns to a clean setup. Undo is offered for ten seconds, and stays while the pointer or keyboard focus is on it.
- **Finish now** ends early and goes to the handoff.
- Taking time off is as easy as adding it. Taking off more than is left finishes quietly; cues it skips past don't play.
- Setup is always clean after a session. Nothing is pre-filled.

## Comfort

**Quiet**, **Balanced** and **Noticeable** set everything at once. Under "Adjust each cue": a tone and a spoken line per moment (halfway, warning, finish), volume, light strength, a slow breathing light, three slow flashes, keeping the screen awake, system notifications on a computer, and on iPhone, playing tones in Silent mode. In the phone apps there are two more: vibration at the warning and the finish (off until turned on), and reminders while TimeFall is in the background (on by default), which reach the lock screen as a soft tone and a line at each cue that is turned on. Tones are soft bells with a slow attack. Work mode never speaks or notifies about anything except "Session finished."

Sessions are stored as timestamps, so a running session survives closing and reopening the app. A cue whose moment passed while the app was closed is never played late.

## Floating view

- **Chrome, Edge or Vivaldi on a computer:** **Float** opens a small always-on-top window with the picture and −5, Pause, +5. Its layout follows the window's shape: side by side when wide, picture-first when small. At the finish it offers the same handoff as the main screen (Start the next activity, +5 min, Done). In Work mode it shows only the picture, the session's name (or the clock when it has none) and the next entry, and the picture reveals the time left on a tap or Enter.
- **Android app:** **Float** shrinks the whole app into a small window that stays over other apps, with the picture and what comes next; Menu → Floating view can make it float on its own whenever you leave the app during a session. While it floats, each cue the phone has a reminder for is left to that reminder (closing the window ends the app before it could schedule one); any other cue, such as Work mode's warning tone, is played by the window itself.
- **iPhone app:** **Float** shows the picture as a picture-in-picture video that stays over other apps and the Home Screen. It can't pause or adjust the session; tapping it offers the button back to TimeFall. iOS only floats video, and only for a full app with the "Audio, AirPlay and Picture in Picture" background mode, which the shell declares; that is the permit the home-screen web app lacks (WebKit bug 303885). While the picture floats out of sight, a cue that has a Lock Screen reminder is left to the reminder, so nothing sounds twice; a cue without one (Work mode's warning, or every cue with reminders off) is still played by the page. Not yet tried on a real iPhone; whether the picture keeps moving there is the owner's test in [docs/timefall-progress.md](docs/timefall-progress.md).
- **iPhone web page, in Safari:** in a Safari tab, **Float** shows the same floating video. iOS may freeze it while TimeFall is in the background. This is experimental. Apple doesn't support picture-in-picture in home-screen apps yet, so **Float** isn't shown when TimeFall is opened from the Home Screen.

## The phone apps

The same page, inside a real iPhone app and a real Android app built with Capacitor from [native/](native/README.md), by GitHub Actions, on every change to `main`. Friends install them from one page, [install/](install/index.html): iPhone through TestFlight, Android from a download. What they add over the web version: reminders at the warning and the finish while the phone is locked or the app is out of sight (scheduled from the session's timestamps when the app goes to the background, cancelled when it returns, never late; Work mode schedules only "Session finished."), vibration, the screen kept awake, a floating view on both phones (Android's small window of the whole app, the iPhone's floating picture), and tones without a first tap. Menu → Your data makes a code that carries presets, notes and settings to the app, or keeps a copy; on a phone the web page offers to open it in the app in one tap. The Android app says, in one line on the setup screen, when a newer build is ready. The decisions, prices and limits are in [docs/research/2026-11-07-timefall-native-apps.md](docs/research/2026-11-07-timefall-native-apps.md); the state of the work is in [docs/timefall-progress.md](docs/timefall-progress.md).

## Limits of the web version on iPhone

A home-screen web app is suspended when it isn't on screen or the phone locks, so it can't sound a cue then. The iPhone app above lifts these limits. Keep the screen awake (on by default while a session runs) and leave TimeFall open. Sound only works after a tap, and Silent mode mutes it unless **Play tones in Silent mode** is on (Menu → Comfort, iOS 17 and later). That option asks iOS to treat the tone as playback while it sounds, which may pause music or a podcast meanwhile; it is off by default because Silent mode is often on for a reason. Web apps on iPhone can't vibrate, in any browser. Notifications aren't available without a server.

## Install

The apps: [install/](install/index.html). The web version is static files at the repository root: `index.html`, `styles.css`, `js/`, `fonts/`, `icons/`, `manifest.webmanifest`, `sw.js`.

1. GitHub repository **Settings → Pages → Build and deployment**: Source "Deploy from a branch", choose the branch and `/ (root)`.
2. Open the published address on your phone.
3. iPhone: Safari → Share → **Add to Home Screen**.

## Local preview

```bash
python -m http.server 8765
```

Then open http://localhost:8765.

## Tests

The timer model, what the app says about time on every screen (including that Work mode only ever says "Session finished.", its tab is always "Day", and it shows lengths only as clock times), the reminders a phone schedules (including that Work mode schedules only "Session finished.") and which cues the page leaves to them, the faces' clock marks, how often they are drawn and that Work mode never offers the disc or the ruler, saved data and the codes that carry it, the offline file list and how the offline worker answers (a slow network, a server error, a Wi-Fi sign-in page, no network), the iPhone hand-off to TestFlight (against a stand-in App Store Connect), and the names the page and the phone shells must agree on have tests that use Node's built-in runner, so there is nothing to install. With Node 20 or later:

```bash
node --test
```

A second check loads the real page in headless Chrome, in each mode, and fails on any script error. It needs Node 22 and Chrome, and no packages:

```bash
node tests/browser-smoke.mjs
```

Both run on every pull request, after a check that every script parses; the two app workflows build the shells on pull requests too. When adding a file the app needs offline, list it in `SHELL` in `sw.js` and bump `CACHE`; the tests fail if a script or font is missing from the list.

What the platforms allow (floating windows, sound after locking, keeping the screen awake) can only be checked on the devices themselves. [docs/device-tests.md](docs/device-tests.md) lists those tests; they use `check/`, a page that isn't part of the app.

Fonts: Newsreader and IBM Plex Mono, SIL Open Font License, stored in `fonts/`.
