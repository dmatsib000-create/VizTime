# TimeFall design system

The reference for what is built: tokens, components and patterns as they exist in [styles.css](styles.css), [index.html](index.html), the modules in [js/](js/) (listed at the top of [js/app.js](js/app.js)), with the pictures in [js/faces.js](js/faces.js). [design-direction.md](design-direction.md) holds the intent behind them ("Afternoon paper"): the philosophy, the session states, the surfaces and the copy voice.

No build step and no framework: components are plain HTML elements with CSS classes, and state lives in attributes (`aria-pressed`, `hidden`, `data-mode`, `data-screen`) that the scripts set. The code examples below are the markup to copy.

## Principles

- **Paper, not screen.** Warm off-white or walnut, near-black or cream ink, hairline rules. No shadows, no pills, 2px corners.
- **Ochre means time.** `--ochre` fills time (faces, next-card fill, the light). `--ochre-ink` is for focus, the ribbon, and time text that needs contrast. Never on controls, never decoration.
- **Two voices.** Newsreader for human content, IBM Plex Mono (tabular) for the clerk: labels, times, controls.
- **Motion is time.** Controls settle 1px and fade; only stage changes move slowly, over seconds.
- **Rules organize.** `1px var(--ink)` opens a section; `1px var(--rule)` divides inside it.
- **Hide, don't disable.** No control is ever shown disabled; if it can't be used, it isn't there. There are no `:disabled` styles.

---

## Tokens

### Color

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#EFEAE0` | `#1E1C19` | Page, sheet |
| `--paper-raised` | `#F6F2EA` | `#26231F` | Box inputs, big chips, next card, hover and pressed fills |
| `--rule` | `#D6CFC1` | `#3A362F` | Decorative dividers (never the outline that shows a whole; that is `--rule-strong`) |
| `--rule-strong` | `#8A8275` | `#7A7366` | Control and field borders (3:1) |
| `--ink` | `#2B2A26` | `#E6DFD2` | Text, section rules, primary fill, pressed state |
| `--ink-soft` | `#5A564E` | `#A39C8E` | Labels, hints, secondary text, rest-state text buttons |
| `--ochre` | `#B8875A` | `#C9965F` | Time fills and the light. Never text. |
| `--ochre-ink` | `#7A5230` | `#D9A86F` | Focus, ribbon, time text needing contrast (including form errors, which are always about a length or end time) |

Support tokens: `--wash-alpha` (face fill strength, 0.5 / 0.42), `--light-alpha` (overlay ceiling, 0.12 / 0.10), `--light-blend` (`multiply` / `soft-light`), `--backdrop` (dialog backdrop). Set from script: `--warmth` (0–1), `--light-gain` (0.6 / 1 / 1.6 from the Warm light setting), `--p` (warning progress, 0–1). Layout: `--face-size` on `.face`, the picture's side (`min(80vw, 46dvh, 400px)`; `min(100%, 58dvh)` in the Android floating window).

Canvas reads colors through `palette()` in [js/faces.js](js/faces.js), so faces follow the mode automatically. Don't hardcode colors in canvas code.

Contrast (WCAG 2.1):

| Pair | Light | Dark | Needs |
|---|---|---|---|
| `--ink` on `--paper` / `--paper-raised` | 11.98 / 12.87 | 12.83 / 11.81 | 4.5 |
| `--ink-soft` on paper / raised | 6.09 / 6.54 | 6.24 / 5.74 | 4.5 |
| `--ochre-ink` on paper / raised | 5.69 / 6.11 | 7.92 / 7.29 | 4.5 (text), 3 (focus) |
| `--rule-strong` on paper (control borders) | 3.17 | 3.62 | 3 |
| `--paper` on `--ink` (primary button, toast) | 11.98 | 12.83 | 4.5 |
| `--ink-soft` on the next card at full fill (22% ochre over raised) | 5.35 | 3.89, so the card's small text uses `--ink` in dark (8.00) | 4.5 |
| Placeholder (`--ink-soft` at 75%) | 3.51 | 4.10 | No input uses one yet; check before relying on it |

The light overlay multiplies foreground and background together, so contrast holds under full warmth (on Strong, light mode's tightest pair is `--rule-strong` at 3.06).

### Typography

Families: `--serif` (Newsreader, roman 400–500 and italic 400, optical sizing on) and `--mono` (IBM Plex Mono 400 and 500, tabular figures). Both self-hosted in `fonts/` and cached by the service worker. The same stacks are exported as `SERIF` and `MONO` from faces.js for canvas text; change both together.

| Token | Value | Where |
|---|---|---|
| `--type-title` | serif 400, `clamp(30px, 5vw + 14px, 52px)` / 1.1 | Running title |
| `--type-next` | serif 400, `clamp(20px, 2vw + 12px, 26px)` / 1.25 | "then …" line |
| `--type-body` | serif 400, 17px / 1.5 | Default text, line inputs, ribbon |
| `--type-label` | mono 400, 12px / 1.4, `0.02em` | `.label`, dates, schedule times |
| `--type-figure` | mono 400, 15px / 1.5 (17px in Simple mode) | Time left and end time under the face |

Other sizes are tuned per context rather than tokenized: display 36–60px (landing title) and 44–72px (work clock); title input 26–36px; headings 21–24px; lead 19px (preset names, schedule rows, primary button); hint 14px; controls 15–16px mono; small 13px mono (text buttons, segments, errors).

Weights: 400 everywhere; 500 only for the selected chip and `<strong>` in figures. Inputs are never under 17px (prevents iOS zoom). Sentence case throughout.

### Spacing, size, radius

`--s1` 4 · `--s2` 8 · `--s3` 12 · `--s4` 16 · `--s5` 24 · `--s6` 32 · `--s7` 48 · `--s8` 64

- Field to field: `--s5`. Label to field: `--s1`. Section break: `--s6` or `--s7` above a `1px var(--ink)` rule with `--s3` under it.
- Content width `--measure` 640px (Work mode on ≥820px: 1040px; landscape phone: 900px). The top bar is the same width in every mode, as wide as the widest one (1040px on ≥820px, 900px on a narrower landscape phone), so the mode switch, Float and Menu stay in the same place when the mode changes.
- No `scrollbar-gutter`: reserved scrollbar space can't be covered by the light overlay (even `100vw` stops short of it), and an untinted strip at the edge during warmth costs more than the few pixels the page shifts when a scrollbar appears.
- Tap area minimum `--tap` 44 × 44 px, measured on what responds to a tap (a wrapping `<label>` counts); primary 48px tall. That is stricter than WCAG AA's 24px, matching AAA and Apple's guideline, because this is mostly a phone app used at a glance. Inline text links are exempt. Only exception: the floating window's controls, which shrink to 36px before hiding.
- `--radius` 2px on every boxed control. Circles only for the face dots.

### Motion

| Token / value | Use |
|---|---|
| `--ease` `cubic-bezier(0.2, 0, 0, 1)` | All interaction motion |
| `--dur-press` 100ms | Press: `translateY(1px)` on `.ctl`, `.chip`, `.big-chip`, `.primary` |
| `--dur-fade` 160ms | Hover color and border changes, sheet and toast fade |
| 200ms in / 600ms out | Discreet reveal |
| 400ms | Next card fading in with the warning (a stage change, so slower than a panel) |
| ~1.5s time constant (JS) | Warmth easing toward its stage target |
| 6s / 1.6s ×3 | Opt-in breathing and flashing light at finish; breathing starts when the flashes end |

`prefers-reduced-motion` removes CSS transitions and animations except the finish cues the person turned on: breathing slows to 12s and the flashes become three soft 4s swells. JS steps warmth in thirds. The faces keep moving because they are the information.

The faces are drawn only as often as they move (`redrawGap` in faces.js): through most of a session, every `totalMs / 2000` ms, at most once a second, so no step is larger than half a pixel; every 80ms in the first 3% and last 5% of a session (where the level, across the narrow top and bottom of its dial, and the disc, near its centre, move fastest), in the last stretch, and while the light or the planner's zoom settles; once a second while paused. Anything that changes the screen calls `requestPaint()` (render does), so a new picture, a pause or +5 shows at once. Planner and ruler share their clock marks (`clockMarks`) and their shading of time passed (`shadePassed`).

### Focus

Global: `2px solid var(--ochre-ink)`, offset 2px, `:focus-visible` only. Text buttons swap to a 2px ochre-ink underline. Line inputs show a 2px ochre-ink bottom rule (1px border plus 1px shadow). Headings that receive programmatic focus (`tabindex="-1"`) show nothing; screens.js moves focus to each screen's heading when the screen changes.

---

## Components

Every button below is a native `<button type="button">` (or `type="submit"` in a form), so Tab reaches it and Enter or Space activates it. Each component lists only what differs from that.

### Primary button — `.primary`

**Description.** The one main action on a screen: Start, Add, and the finish screen's "start what's next". Ink fill, serif label.

| Variant | Use when |
|---|---|
| `.primary` | A form's submit (48px tall, 19px serif) |
| `.primary.small` | A tighter row (44px, 17px) |
| `.primary.landing-main` | The full-width "Start Team standup · 25 min" button on the finish screen (60px min, 22px, left-aligned, wraps) |

| State | Visual | Behavior |
|---|---|---|
| Default | `--ink` fill, `--paper` text, 1px ink border | — |
| Hover | Fill mixes 12% toward `--paper` | — |
| Active | Moves down 1px over `--dur-press` | — |
| Focus | 2px `--ochre-ink` outline | — |

**Accessibility.** Native button; its visible text is its name, so write the whole action ("Start Team standup · 25 min", not "Go").

| ✅ Do | ❌ Don't |
|---|---|
| Use one per screen, labeled with a verb | Use it for secondary actions like Save as preset |
| Keep it ink | Color it ochre or add an icon |

```html
<button class="primary" type="submit">Start</button>
```

### Control — `.ctl`

**Description.** Bordered mono buttons for adjusting a running session: −5, −1, Pause, +1, +5; also the finish screen's extend buttons and Done, and the floating window's row.

| Variant | Use when |
|---|---|
| `.ctl` | Any adjustment |
| `.ctl.ctl-pause` | Pause/Resume, min 96px wide so the row doesn't shift when the label changes |
| `.ctl.done-btn` | Done on the finish screen (serif, 96px) |
| `.pip-row .ctl` | The floating window: sized in `vmin`, 36–44px tall |

| State | Visual | Behavior |
|---|---|---|
| Default | Transparent, 1px `--rule-strong` border | — |
| Hover | Border `--ink-soft`, fill `--paper-raised` | — |
| Active | Moves down 1px | — |
| Focus | 2px `--ochre-ink` outline | — |

**Accessibility.** Symbol labels get a spoken name: `−5` has `aria-label="Take 5 minutes off"`. Pause swaps its text to Resume, which screen readers pick up as the new name. The controls row is a `<nav aria-label="Session controls">`.

| ✅ Do | ❌ Don't |
|---|---|
| Give symbols an `aria-label` in words | Rely on `−5` being read sensibly |
| Keep the row to one line; hide `.adj-fine` when it won't fit (done below 360px and in Simple mode) | Let one button wrap onto a line of its own |

```html
<button type="button" class="ctl mono" data-adj="-5" aria-label="Take 5 minutes off">−5</button>
<button type="button" class="ctl mono ctl-pause" id="pause-btn">Pause</button>
```

### Text button — `.text-btn`

**Description.** Underlined mono text for low-weight actions: Menu, Float, Save as preset, Clear, Finish now, Stop, Undo, Close.

| Variant | Use when |
|---|---|
| `.text-btn` | Most quiet actions (`--ink-soft` at rest) |
| `.text-btn.stop` | Stop: ink at rest, so it is easy to find |
| `.toast .text-btn` | Undo on the toast: inverted to `--paper` |

| State | Visual | Behavior |
|---|---|---|
| Default | `--ink-soft` text, 1px `--rule` underline | — |
| Hover | `--ink` text and underline | — |
| Focus | Underline thickens to 2px `--ochre-ink`, text goes ink; no outline | — |

**Accessibility.** At least 44 × 44 px despite looking like a link. Menu has `aria-haspopup="dialog"`; Close has `aria-label="Close menu"`.

| ✅ Do | ❌ Don't |
|---|---|
| Use for anything a person might want but rarely needs | Use for the screen's main action |
| Keep labels to one or two words | Write sentences as button text |

```html
<button class="text-btn mono" type="button" id="f-save">Save as preset</button>
```

### Segmented control — `.seg` + `.seg-btn`

**Description.** A row of mutually exclusive choices: mode (Full / Work / Simple), For / Until, and the comfort bundle (Quiet / Balanced / Noticeable).

| Variant | Use when |
|---|---|
| `.seg` | A choice inside a form or the menu (13px) |
| `.seg.mode-switch` | The mode switch in the top bar (12px, no bottom margin) |

| State | Visual | Behavior |
|---|---|---|
| Unselected | `--ink-soft` text | — |
| Hover | `--ink` text | — |
| Selected (`aria-pressed="true"`) | `--paper-raised` fill, `--ink` text, 1px ink underline | Choosing another clears it (the scripts) |
| Focus | 2px `--ochre-ink` outline | — |

**Accessibility.**
- **Role:** the wrapper is `role="group"` with an `aria-label` ("Mode", "How to set the length", "Comfort bundle"); each button is a toggle with `aria-pressed`.
- **Keyboard:** each option is its own Tab stop. Modes also have Alt+1, Alt+2 and Alt+3 from anywhere (`aria-keyshortcuts`); switching modes never touches a running session.
- **Screen reader:** "Work, toggle button, not pressed, Mode group".

| ✅ Do | ❌ Don't |
|---|---|
| Use for two to four short, equal choices | Use for actions (use buttons) |
| Keep `aria-pressed` on every option in step | Show the choice only by color |

```html
<div class="seg" role="group" aria-label="How to set the length">
  <button type="button" class="seg-btn" data-by="for" aria-pressed="true">For</button>
  <button type="button" class="seg-btn" data-by="until" aria-pressed="false">Until</button>
</div>
```

### Chip — `.chip` and `.big-chip`

**Description.** Quick minute choices. `.chip` picks a length in a form; `.big-chip` starts a timer outright in Simple mode.

| Variant | Use when |
|---|---|
| `.chip` | Picking a length or end time in setup (44 × 44, 16px mono) |
| `.landing-start .chip` | Another length on the finish screen; starts at once (60px wide, three to a row at 440px and below; shown as end times in Work mode) |
| `.big-chip` | Simple mode's six large start buttons (104px tall, 44px serif numeral over a mono "min") |

| State | Visual | Behavior |
|---|---|---|
| Default | Transparent (`.big-chip`: raised), `--rule-strong` border | — |
| Hover | `.chip`: border `--ink-soft`, fill raised. `.big-chip`: border firms to ink | — |
| Selected (`.chip` in setup, `aria-pressed="true"`) | Ink border, raised fill, weight 500 | Typing an exact time clears it |
| Active | Moves down 1px | — |
| Focus | 2px `--ochre-ink` outline | — |

**Accessibility.** Setup chips are toggles in a `role="group"` ("Minutes", "End times"). setup.js gives each a full name: "25 minutes", or "Until 9:30 AM" in Until mode, so the bare number is never read alone. Chips that start a timer are plain buttons with no pressed state.

| ✅ Do | ❌ Don't |
|---|---|
| Keep the set to the same six lengths (5, 10, 15, 25, 45, 60) everywhere | Add a seventh; it breaks every row |
| Give number-only chips an `aria-label` with the unit | Leave "25" to stand alone for a screen reader |

```html
<div class="chips" id="f-chips" role="group" aria-label="Minutes">
  <button type="button" class="chip" data-min="25" aria-pressed="true">25</button>
</div>
```

### Line input — `.line-input`

**Description.** An underlined field on the page, no box, for words: what this time is for, what comes next, the first small step, where you left off.

| Variant | Use when |
|---|---|
| `.line-input.big` | The title (26–36px) |
| `.line-input.italic` | The next activity (22px italic) |
| `.line-input` | Notes and the first step (17px) |

| State | Visual | Behavior |
|---|---|---|
| Default | 1px `--rule-strong` bottom rule | — |
| Focus (mouse or touch) | Rule darkens to ink | — |
| Focus (keyboard) | 2px `--ochre-ink` bottom rule | — |
| Invalid | Not used: word fields are all optional | — |

**Accessibility.**
- **Label:** always wrapped in `<label class="field">` with a visible `.label`, which names the field and extends the tap area to about 60px tall.
- **Keyboard:** in setup, Enter moves from title to next to first step instead of submitting early (`enterkeyhint="next"`); notes use `enterkeyhint="done"`.
- **Limits:** `maxlength` 80 for title and next, 100 for the step, 140 for notes.

| ✅ Do | ❌ Don't |
|---|---|
| Mark optional fields with `<span class="soft">(optional)</span>` | Use asterisks or placeholders as labels |
| Keep it at 17px or larger | Go smaller: iOS zooms the page on focus |

```html
<label class="field">
  <span class="label mono">What comes next <span class="soft">(optional)</span></span>
  <input class="line-input italic" id="f-next" name="next" maxlength="80" enterkeyhint="next">
</label>
```

### Box input — `.box-input`, `.select`

**Description.** Boxed mono fields on `--paper-raised` for numbers, times and short choices: exact minutes, "next starts at", travel buffer, warning lead, menu settings.

| Variant | Use when |
|---|---|
| `.box-input` | Minutes (4.5em, centered, `inputmode="numeric"`) |
| `.box-input.time` | A clock time (`type="time"`, 7em min) |
| `.select` | A short list; draws its own chevron in `--ink-soft` |

| State | Visual | Behavior |
|---|---|---|
| Default | 1px `--rule-strong` border, raised fill | — |
| Focus | Border `--ink-soft`, plus the 2px `--ochre-ink` outline on keyboard focus | — |
| Invalid | `aria-invalid="true"`, linked to the error by `aria-describedby` | Set on submit; cleared as soon as the person edits |

**Accessibility.** Each has a name: the visible text in its `.inline-field` label, or an `aria-label` where the visible words are split around it ("or exactly [ ] min" uses `aria-label="Exact minutes"`). Validation happens on submit only, with the message in the form's `.error`.

| ✅ Do | ❌ Don't |
|---|---|
| Say the range in the error ("between 1 and 600 minutes") | Block typing or validate on every keystroke |
| Use `inputmode="numeric"` for minutes | Use `type="number"` spinners |

```html
<label class="inline-field"><span class="mono">or exactly</span>
  <input class="box-input" id="f-minutes" inputmode="numeric" pattern="[0-9]*" maxlength="3" aria-label="Exact minutes">
  <span class="mono">min</span></label>
```

### Field wrappers — `.field`, `.inline-field`, `.label`, `.hint`, `.error`, `.check`

**Description.** The pieces that lay out a form.

| Class | Use |
|---|---|
| `.field` | Block label plus input, `--s5` below. Also on `<fieldset>` for grouped choices |
| `.inline-field` | Label, input and unit on one wrapping line |
| `.label` | `--type-label`, `--ink-soft`. Also small headings (`h2.label`, `h3.label`) and fieldset legends |
| `.hint` | 14px serif `--ink-soft` explanation; `.hint.mono` is 12px. Also used for "Saved" confirmations with `aria-live="polite"` |
| `.error` | 13px mono `--ochre-ink`, `role="alert"`, a reserved line so the form doesn't jump. Errors here are about time; one that isn't should use `--ink` |
| `.check` | Native checkbox (20px, `accent-color: var(--ink)`) with a sentence, 44px tall |

| ✅ Do | ❌ Don't |
|---|---|
| Write errors that say what to do ("Choose a later time.") | Write "Invalid input" or blame the person |
| Write checkbox labels as full sentences | Use toggles that need a separate label |

```html
<p class="error mono" id="f-error" role="alert"></p>
<label class="check"><input type="checkbox" id="m-wake"> <span>Keep the screen awake while running</span></label>
```

### Ribbon — `.ribbon`

**Description.** The "where you left off" bookmark: an ochre-ink notched ribbon in the left margin with a mono label and the note in italic. Shows on setup, running and finish screens when the activity has a saved note.

| State | Visual | Behavior |
|---|---|---|
| Hidden | `hidden` | No note saved for this activity |
| Shown | Ribbon plus note | Appears as soon as the title matches an activity with a note |

**Accessibility.** The ribbon shape is decoration (a `::before`); the label "Where you left off" and the note are ordinary text.

| ✅ Do | ❌ Don't |
|---|---|
| Show at most one per screen | Reuse the ribbon shape for anything else; it means "your place" |

```html
<div class="ribbon" id="r-ribbon" hidden><span class="label mono">Where you left off</span><span id="r-ribbon-text"></span></div>
```

### Preset row — `.preset-list li`

**Description.** One saved session in the ruled preset list: a start button with name, next activity and length, and a remove button. Built by setup.js. When any presets exist they move above the setup form (`.has-items`), except in Work mode.

| State | Visual | Behavior |
|---|---|---|
| Default | Ruled row; name in 19px serif, ", then …" in soft italic, length in 13px mono | — |
| Hover | Raised fill on the start button; × goes ink | — |
| Work mode | No length | Work mode never shows a duration, so the length isn't written at all (`presetLength` in words.js) |

**Accessibility.** Two buttons per row. The × has `aria-label="Remove preset …"` with the preset's name. Removing shows the toast with Undo for 10 seconds instead of asking first, and moves focus to the × now in that place (or the one before it, or Undo when none are left), so keyboard and VoiceOver users keep their place; Undo puts focus back on the restored preset's ×.

```html
<li>
  <button type="button" class="preset-start"><span class="preset-name">Writing<em>, then Standup</em></span><span class="preset-len">25 min</span></button>
  <button type="button" class="preset-del" aria-label="Remove preset Writing">×</button>
</li>
```

### Next card — `.next-card`

**Description.** Full mode only, during the warning: the next activity takes the stage between the time figures and the controls. A raised panel with a `--rule` border; an ochre fill (`.next-fill`, 22%) grows across it with `--p` while the title grows from 22 to 36px. The only boxed surface on the running screen. In dark mode the full fill lifts the panel enough that `--ink-soft` drops to 3.89:1, so the label, first step and note use `--ink` there.

| State | Visual | Behavior |
|---|---|---|
| Hidden | `hidden` | Before the warning, without a next activity, and in Work and Simple modes |
| Shown | Fades in over 400ms | Fill and title size follow warning progress |

**Accessibility.** Plain text in reading order after the time figures and before the controls. The warning itself is announced by the page's live region, not the card.

| ✅ Do | ❌ Don't |
|---|---|
| Keep it above the controls so it is never below the fold | Add buttons to it; starting the next thing happens on the finish screen |

```html
<div class="next-card" id="next-card" hidden>
  <div class="next-fill" id="next-fill"></div>
  <div class="next-inner"><p class="label mono">Next</p><p class="next-title" id="nc-title"></p></div>
</div>
```

### Schedule — `.schedule`, `.sched-row`

**Description.** Work mode's two-line agenda beside the desk clock: when and what, now and next. 7.5em mono time column, serif activity.

| State | Visual |
|---|---|
| Now (`.is-now`) | Ink |
| Next | `--ink-soft` italic |

**Accessibility.** A plain `<ul>`. Times are clock times, never countdowns, so it reads as an ordinary day plan.

```html
<ul class="schedule"><li class="sched-row is-now"><span class="mono sched-when">2:00</span><span class="sched-what">Clinic notes</span></li></ul>
```

### Face switch — `.dot`

**Description.** The choice of face in Work and Full modes: 44px buttons, each drawing an 8px circle. Work shows Level, Sun and Planner (the Disc and Ruler dots are hidden, since a shrinking disc or a ruled bar reads as a timer); Full adds Disc and Ruler last, so the first three dots sit in the same places in both modes. Each mode remembers its own choice (`settings.face`, `settings.fullFace`, looked up through `faceSetting()` in draw.js). `faceName()` draws only a picture the mode offers, falling back to its first (Planner in Work, Disc in Full), so a saved Disc or Ruler can never reach Work mode even if the stylesheet changes. Simple has no switch and always shows the disc. In Full the dots sit under the time figures; in phone landscape they left-align with the other controls.

| State | Visual |
|---|---|
| Default | `--ink-soft` ring |
| Hover | Ring darkens to ink |
| Selected (`aria-pressed="true"`) | Filled ink |
| Focus | 2px `--ochre-ink` outline |

**Accessibility.** `role="group"` labeled "Clock style" in Work and "Picture" in Full; each dot has an `aria-label` naming the face (Disc, Level, Sun, Planner, Ruler) and `aria-pressed`.

```html
<button type="button" class="dot" data-face="sun" aria-label="Sun" aria-pressed="false"></button>
```

### Sheet — `dialog.sheet`

**Description.** The menu: settings for mode, comfort cues, activities and the floating view. A bottom sheet on phones (top corners at `--radius`, square bottom), a centered dialog at 640px and wider. Fades in over `--dur-fade`.

Settings that only one platform can use are hidden elsewhere: system notifications without the Notification API (and on an iPhone web app, where they can never fire), "Play tones in Silent mode" except on a touch device with the Audio Session API (`canPlayThroughSilent()` in sound.js), and the phone apps' own: vibration, reminders while in the background (whose hint also says when the phone's Settings block them), floating on its own, and Android's exact-timing note. `isNative` and `platform` in [js/platform.js](js/platform.js) decide. The Silent-mode option carries its cost in its hint, since playback may pause other audio while a tone sounds.

The last section, **Your data**, holds the code that carries presets, notes and settings between devices: Copy a code (and, on a phone's browser, an "Open in the TimeFall app" link), the code box, Bring in a pasted code, and a line that says what happened. Bringing a code in reloads the page so every part reads the new data.

| Part | Use |
|---|---|
| `.sheet-head` | 24px serif heading, Close text button, ink rule |
| `.sheet-section` | One topic, `h3.label` heading, divided by `--rule` |
| `.details` | A `<details>` for advanced options ("Adjust each cue") |

**Accessibility.**
- **Role:** native `<dialog>` opened with `showModal()`, labeled by its heading.
- **Keyboard:** focus moves in and is trapped; Escape closes; focus returns to Menu.
- **Pointer:** tapping the backdrop closes it.

| ✅ Do | ❌ Don't |
|---|---|
| Put settings here, out of the way of the timer | Put anything needed during a session here |

```html
<dialog class="sheet" id="sheet" aria-labelledby="sheet-heading">
  <form method="dialog" class="sheet-inner">
    <div class="sheet-head"><h2 id="sheet-heading">Menu</h2><button class="text-btn mono" value="close" aria-label="Close menu">Close</button></div>
  </form>
</dialog>
```

### Code box — `.code-box`

**Description.** The one `<textarea>` in the app: a raised, bordered box in 12px mono for the data code, which is long and meant to be selected whole. It shows the code after Copy, and takes a pasted one.

| State | Visual | Behavior |
|---|---|---|
| Default | `--paper-raised` fill, 1px `--rule-strong` border, 72px tall, resizable down the page | — |
| Focus | Border `--ink-soft`, plus the global 2px `--ochre-ink` outline on keyboard focus | Copy selects its contents when the clipboard isn't available |

**Accessibility.** `aria-label="Code"`; the result line under it is `aria-live="polite"`. Spellcheck, autocorrect and autocapitalize are off, so a phone keyboard leaves the code alone.

| ✅ Do | ❌ Don't |
|---|---|
| Keep it for text a person copies whole | Use it for prose; notes are line inputs |

```html
<textarea class="code-box mono" id="m-code" rows="3" spellcheck="false" autocapitalize="off" autocorrect="off" aria-label="Code"></textarea>
```

### Update note — `.update-note`

**Description.** Android app only: one centred mono hint line under the setup screen, "TimeFall 1.0.12 is ready. Get it", shown when a newer build exists (`js/native.js`). The link opens the install page in the phone's browser. It is never a pop-up and never appears on the running or finish screen.

```html
<p class="hint mono update-note" id="update-note" hidden></p>
```

### Floating, Android — `body.is-floating`

**Description.** The Android app's floating window is the page itself, shrunk by the system to about 240 × 300px (`FloatingPlugin.java`). The shell sets `is-floating` on the body while that lasts, and the stylesheet keeps only what fits: the title on one line, the next line, the picture, and in Work mode the schedule's two rows; the bar, controls, figures, dots, next card, notes and toast are hidden. It can't be tapped except to return to the app, so nothing in it needs a tap area. Check it at 240 × 300 in every mode, as with the desktop floating window.

### TV view — `body.is-tv`

**Description.** The page laid out for a screen across the room, while the person mirrors their device to a TV. A text button, **TV view**, sits beside Float and is shown only while a session runs. The body takes `is-tv` and the stylesheet keeps the picture and the words about what is happening, enlarged with `clamp()` on viewport width: title and next line in Full mode, the desk clock and schedule in Work mode, the picture alone in Simple mode, and the label and title of the finish screen. The bar, controls, time-left figures, dots, next card, notes, ribbon and Work mode's reveal are hidden. Wider than tall, the picture sits beside the words; otherwise the words sit above it. Wider than tall, the two sit together in the middle of the screen, the words no wider than 46% of it. Type sizes have no fixed ceiling: they follow the screen's width, limited only by its height, so a computer's full screen reads from across a room as a phone on its side does. The picture is drawn as if on a phone-sized screen and enlarged (`tvScale` in faces.js), so its lines and clock labels grow with a big screen. Its fill is deeper than on a desk (`--wash-alpha: 0.72` while `is-tv` is set), because pale ochre on paper fades across a room and through a mirrored picture's compression. The ruler is the exception to sitting beside the words: it is a wide strip, so the words go above it, it runs the full width, and its bar may be a block (`m.tv` in `drawRuler`). Upright, the words size from the width, the short side. The pointer is hidden.

**Rules.** Nothing in TV view counts down in numbers. Work mode's private reveal is refused in script as well as hidden (`revealAllowed` in words.js). Any tap, or Escape, leaves, and the tap does nothing else. A toast says so when it opens, and names where the device's own mirroring is (`tvEntered` in words.js); it goes when the person goes back. It stays through the finish and ends with the session. On a computer it asks the browser for full screen; the phone apps already fill the screen. Check it in every mode, light and dark, upright and on its side, and at 1920 × 1080.

### Toast — `.toast`

**Description.** A short inverted ink bar at the bottom: "Session stopped", "Preset removed", "Preset saved", with Undo where it applies. Hides after 10 seconds, or when a new session starts. It never hides while the pointer or keyboard focus is on it; leaving it starts a fresh 10 seconds.

**Accessibility.** Shown at the bottom but placed right after the top bar in the page, so Undo is one Shift+Tab back from the screen heading that takes focus when the screen changes. Its text is spoken through the page's live region ("Session stopped. Undo available."), because a live region that appears already filled is often not read. Undo is a normal text button; its keyboard focus is a 2px `--paper` outline, since ochre ink would vanish on the ink bar.

| ✅ Do | ❌ Don't |
|---|---|
| Offer Undo instead of asking "Are you sure?" | Use it for errors; those go next to the field |

```html
<div class="toast" id="toast" hidden><span id="toast-text"></span><button type="button" class="text-btn mono" id="toast-undo">Undo</button></div>
```

### Light — `.light`

**Description.** The signature: a fixed, full-page `--ochre` layer at `warmth × --light-alpha × --light-gain`, blended `multiply` (light) or `soft-light` (dark), above everything (`z-index: 40`) and ignoring pointer events. Warmth is 0 through the session, rises across the warning and reaches 1 at the finish.

| Variant | Use when |
|---|---|
| `.light.breathe` | Opt-in slow breathing at the finish (6s; 12s with reduced motion) |
| `.light.flash` | Opt-in three flashes at the finish (1.6s each; soft 4s swells with reduced motion) |

**Accessibility.** `aria-hidden="true"`; it carries no information that isn't also in text and the live region. Flashes are slow (well under three per second) and only on request.

**Elsewhere.** The floating window copies `--warmth`; the iPhone PiP video paints it with `paintWarmth()` using the same alpha and blend.

```html
<div class="light" id="light" aria-hidden="true"></div>
```

### Faces — `canvas.face`

**Description.** The time picture, drawn by [js/faces.js](js/faces.js): `disc` (Full, Simple), `level`, `sun`, `planner` (Work, and offered in Full), `ruler` (Full only). Level and Sun draw ink clock hands in Work, where they are the disguise, and soft hands in Full (`hands: 'soft'` in the model: `--ink` at 70% opacity, 70% width, never under 1.5px), so they don't compete with the time left. Soft hands measure 4.0:1 over the wash in light mode and 3.6:1 in dark. The hands and hub are one filled shape, so translucent ink doesn't pool darker where they cross. The disc's outer ring is the whole the wash is read against, so it is drawn in `--rule-strong` (3.17:1 light, 3.62:1 dark), not `--rule`. Each takes a model and the palette, so one drawing serves the page, the floating window and the video.

The ruler is the face for counting minutes: length is judged more accurately than area, and its marks give halves and quarters to judge against. On the page its canvas spans the column (`.face[data-picture="ruler"]`, set by `renderRun`) at the square's height, so the dots under it never move when the picture changes; a phone on its side keeps the square. The strip runs to the canvas edges (4px in, for the now dot) and is a sixth of its length tall, at most 96px and 28% of the height, outlined in `--rule-strong`: time passed is raised paper hatched in `--rule` (as in the planner), time left is the wash, ending at a 1.5px `--ochre-ink` line. Minute marks in `--rule-strong` sit on real clock times along the top, every 1, 2, 5, 10, 15, 30, 60 or 120 minutes (240 for longer spans) so there are at most 10 (6 under 220px wide), longer on the quarter hour (the half hour with 2- and 10-minute marks, the hour with coarser ones); clock times in `--ink-soft` mono (13px on a strip 300px or longer, 11px otherwise) over the long marks, the end time in `--ink`. A dotted `--ochre-ink` line under the strip runs from where the warning begins to the end. "Now" is a 1px `--ink` line down to a 3px dot. It moves at a constant rate and never eases. Under 220px wide it drops the clock times; the floating window, which opens at 240 × 300, keeps them. A wide floating window, which puts the other pictures beside the words, keeps the ruler stacked across the window (`body.pip[data-picture="ruler"]`, set by `renderFloatText`).

| Mode | Role | Behavior |
|---|---|---|
| Full, Simple | `role="img"`, `aria-label` like "12 minutes left, ends 2:45 PM" | Not focusable |
| Work | `role="button"`, `tabindex="0"`, `aria-label="Clock. Show time left"` | Tap, Enter or Space shows the time left privately for 4 seconds (`.reveal`, announced politely) |

| ✅ Do | ❌ Don't |
|---|---|
| Read colors from `palette()` | Hardcode colors or fonts in canvas code |
| Keep Work mode's label free of time words | Announce a countdown in Work mode |

```html
<canvas class="face" id="face" role="img" aria-label=""></canvas>
<p class="reveal mono" id="reveal" aria-live="polite"></p>
```

---

## Patterns

| Pattern | Built from | Notes |
|---|---|---|
| Setup form | field, line input, seg, chips, inline field, select, error, primary + text buttons | Optional fields are labeled, not starred. Enter moves between word fields. No validation until submit. |
| Running screen | title, next line, ribbon, face, figures, next card, controls | One thing of primary importance. Controls sit under an ink rule; the next card comes above them. |
| Handoff (finish screen) | label, display title, landing-main primary, chips, inline start form, note field, extend controls | The next activity takes the title position; one tap starts it. |
| Undo instead of confirm | toast + text button | Stopping and removing a preset never ask first; Undo stays for 10 seconds, and longer while it is pointed at or focused. |
| Live announcements | one `aria-live="polite"` region | Speaks the warning, the finish, keyboard mode switches and the toast; never each minute. Work mode says "Session finished" only. |
| Mode-specific content | `.only-full`, `.only-work`, `.only-simple`, `.not-simple` | Swap words per mode inside one element rather than duplicating elements. |
| Floating window | `body.pip`, `.pip-*` | Sized in `vmin`. Drops controls, then figures, then the next line before the face shrinks. Wider than 5:4, the picture sits beside the words, except the ruler, which stays stacked. |
| Showing it on a TV | `body.is-tv`, `tvHint` in words.js | The device mirrors; TimeFall only lays the page out. The same elements as the running and finish screens, so the TV can never disagree with the phone. Menu → On a TV says how to mirror and what TimeFall can't do. |
| Reminders on a phone | `cues.js` + `native.js` | While the app is in front the page plays its cues; when it goes to the background the cues still to come are scheduled from the session's timestamps, and cancelled on return. Never late; Work mode schedules only "Session finished." (tested). |
| Carrying data | `packCode`, `unpackCode`, `importData` in store.js | One code for settings, presets, notes and lengths. Presets add, newer notes win, device-bound settings (reminders, vibration, Silent-mode tones) stay. |

## Adding something new

1. Use existing tokens; if a value isn't on the scale, round to it rather than adding a literal.
2. Reuse a button family (primary, control, text, chip, segment) before making a new one.
3. Give it hover, press, keyboard focus, a spoken name and a 44px tap area.
4. Hide it when it can't be used; don't add a disabled state.
5. Check it in light, dark, full warmth, 200% text, 320px wide, iPhone landscape, the 200 × 200 floating window and the Android floating window (`body.is-floating`, about 240 × 300), in all three modes. Work mode at a glance should read as a desk clock and a schedule.
6. If it is not about time, it is not ochre.
