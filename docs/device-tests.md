# Device tests

Some of what VizTime relies on isn't written down by Apple, Google or Microsoft, so it has to be tried on the real devices. These tests answer the open questions in the platform report (`reports/VizTime web app platform assumptions.md`, kept locally) before any of its code changes are made. Each takes under an hour. Write the results in the table at the end, with the date and the browser or iOS version.

## The check page

`check/` is a page for these tests. It isn't part of the app and the app never links to it. Each button tries one thing VizTime does, the way VizTime does it, and writes what happened to a log on the page. The log is kept if the page reloads. **Copy log** copies it, so it can be pasted into a note or an email.

- **On the computer:** run `python -m http.server 8765` in the project folder and open http://localhost:8765/check/ in Chrome, then in Edge.
- **On the iPhone:** the page has to come from the published site, https://dmatsib000-create.github.io/VizTime/check/, once this branch is merged. To test it as a home-screen app, open it in Safari, then Share → **Add to Home Screen**, and leave **Open as Web App** on. It appears as "VizTime check", separate from VizTime itself, and has its own saved data.

The line at the top counts the page's ticks: one a second, as the app does. A "tick gap" line means the browser didn't run the page for that long. If the page isn't run at all, for example on a locked iPhone, the gap appears when it runs again.

## Windows

**1. Does Float keep time when the main window is hidden?** In Chrome, open the check page and click **Floating window**. Minimise the main window and leave it for 15 minutes. Then look at the log:
- "main window tick gap" lines of about 60 s after the first five minutes are expected.
- "floating window tick gap" lines mean the floating window was slowed too, so Float doesn't protect cues.

While the main window is minimised, click **Hold screen awake from here** in the floating window. Set Windows' screen timeout to 1 minute (Settings → System → Power) and see whether the screen stays on.

Repeat with the main window covered by a maximised app instead of minimised, then do it all again in Edge. Also drag the floating window as small as it will go and note the size from the "resized to" line.

**2. Without Float, how late do ticks get?** Same as test 1 without clicking **Floating window**. After 20 minutes, read the top line: how many gaps were over 65 s, and the longest. Anything over 65 s is a cue VizTime would skip silently today.

**3. Does Edge put the tab to sleep?** In Edge, open the floating window and leave the main window minimised for 2½ hours. Look for gaps much longer than a minute, or "page frozen". Then add the site under Settings → System and performance → **Never put these sites to sleep** and repeat.

**4. What do patients see when a session finishes?** Click **Allow notifications**, then **Notification in 20 s**, and switch to another app. Do it once normally, once with Do Not Disturb on, and once with the display duplicated to a second screen. Note whether the notification appeared and what it showed. Also note what the floating window's title bar shows.

**5. Does the computer still have a stable app id?** Open VizTime itself in Chrome, then DevTools → Application → Manifest. Write down "Computed App ID".

**6. How does VizTime start on Wi-Fi with no internet?** Connect the computer to a phone hotspot that has mobile data turned off. Open VizTime and time how long it takes to appear.

## iPhone

**7. Can Float work?** In Safari (a normal tab), open the check page. Copy the first lines of the log. They include `document.pictureInPictureEnabled` and "webkitSupportsPresentationMode, empty video". Tap each of the three video float buttons, noting which opens a floating picture. While one is open, switch to another app and watch whether the clock in it keeps moving.

Then add the check page to the Home Screen, open it from there and do the same. Also open VizTime from the Home Screen during a session and note whether **Float** and the **System notification** switch (Menu → Comfort) appear.

**8. Does sound come back after locking?** In the home-screen check app, tap **Start sound** (a tone plays), then **Tone in 60 s, no tap**, and lock the phone straight away. Unlock it after 30 s and don't touch the screen. A tone should play about 30 s later. Note whether you heard it and copy the log. The "sound was …" and "sound is now …" lines show what iOS did.

Repeat with Silent mode on. Then repeat once more, but after unlocking tap **Resume sound** before the tone is due.

**9. Do spoken cues work without a tap?** Open the check app fresh (close it in the app switcher first). Tap **Speak in 10 s, no tap** and wait. Did it speak? The log says "started speaking" if it did. Then tap **Prime speech silently**, then **Speak in 10 s, no tap** again.

**10. Does the screen stay on?** Set Auto-Lock to 1 minute. In the check app, tap **Hold screen awake** and leave the phone untouched for 10 minutes. Do it with Low Power Mode off, then on. A "released" line in the log means it let go.

## Optional

- **Mac Safari:** open the check page and note the `navigator.standalone` line. If it isn't "undefined", hiding notifications by that test would also hide them on a Mac.
- **Android (Chrome):** install the check page from Chrome's menu. Copy the device lines, try **Vibrate**, try the three video float buttons, then leave the app in the background for 6 minutes and copy the log.
- **Firefox on the computer:** tap **Ask to keep data** and note whether Firefox asks you. If it does, VizTime shouldn't call it outside an installed app.

## Results

| # | Date | Device and version | Result |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |
| 7 | | | |
| 8 | | | |
| 9 | | | |
| 10 | | | |
