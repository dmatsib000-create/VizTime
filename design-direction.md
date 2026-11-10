# Design direction: Afternoon paper

This sets the visual language. It does not set the time metaphors: the discreet face, the last-minutes treatment, and the handoff are still yours to invent, inside this world. Where this document and the build prompt disagree, the build prompt wins.

---

## Philosophy

**The emotional register.** Opening the app should feel like glancing down at a good paper day planner on a quiet desk in mid-afternoon: settled, private, a little warm. Nothing is asking for attention. The person using it is a capable adult in the middle of real work, often in front of patients, and the interface behaves like a well-mannered object in that room: present, legible, never performing. The tension to hold is *the stillness of paper against the movement of time*. The page does not move; the light on it does.

**Color and material.** The surface is matte, uncoated paper, not a screen. Warm off-white, never pure white; ink that is near-black with a brown undertone, never pure black; hairline rules the color of pencil on cream. There is one warm pigment, ochre, used for exactly two things: the shading that represents time, and the light of the warning stage. It never appears on buttons, badges, or decoration, so that whenever ochre is on the page, it means time. The light source is a low, invisible sun off to the side. During most of a session it is neutral; as the end approaches, the whole page warms by a few percent, the way paper does at 4 pm. In dark mode the paper becomes dark walnut and the ink becomes cream; the same sun still warms it.

**Typography.** Two voices and no more. A serif (Newsreader, using its optical sizes) speaks for the human content: what I am doing, what comes next, the note about where I left off. It is set large and calm, with generous leading, like a heading written in a planner. A monospace (IBM Plex Mono) is the clerk: clock times, minutes, labels, set small, with tabular figures so numbers never jitter. Numbers are always subordinate to words. Calibrate every size, weight, and letter-space with painstaking care; the type should look as though it was proofed on paper, then proofed again on an iPhone at arm's length, then once more at 200 pixels.

**Motion and state.** Motion is time, and almost nothing else. Time-driven visuals change continuously and slowly, so there is never a tick or a jump to startle. Interaction feedback is immediate and small: a press settles the control by a hair, a focused control gains an ochre-ink underline, a panel appears by fading over 160 ms rather than sliding. Stage changes (into the warning, into the finish) are the only larger transitions, and they happen as a slow change in light over seconds, not a cut. Nothing bounces, pulses, or flashes unless the person has turned it on.

**Spatial logic.** A ruled page: a strict, invisible baseline and a 4-pixel spacing scale, with hairline rules doing the organizing work that boxes and shadows would do elsewhere. No cards with drop shadows, no rounded pills; corners are nearly square, like cut paper. Generous margins, one column, one thing of primary importance per screen. The layout must hold with master-level spatial control from a 200-pixel floating window to an iPhone in landscape to a wide desktop, rearranging rather than shrinking. This should look like the work of a designer who spent weeks adjusting margins by single pixels and would notice if one moved.

**Signature detail.** The light. The whole page is lit by a sun no one can see, and the only thing that ever really changes on screen is the temperature of that light. A bystander sees a pleasant warm afternoon on a page; the person who owns it reads the time. A secondary detail: the "where I left off" note appears as a slim ochre ribbon bookmark tucked into the page margin, the physical gesture of marking a place in a book. Both should be executed with the kind of polish that only comes from obsessive iteration: if they look merely nice rather than inevitable, keep refining.

---

## Handoff spec

### Design tokens

All colors are CSS custom properties on `:root`, redefined for dark mode under `@media (prefers-color-scheme: dark)`. Eight color values per mode. `--rule-strong` is the eighth, added so controls meet the 3:1 boundary contrast that `--rule` can't.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#EFEAE0` | `#1E1C19` | Page background |
| `--paper-raised` | `#F6F2EA` | `#26231F` | Input fields, the next-activity card |
| `--rule` | `#D6CFC1` | `#3A362F` | Decorative hairlines and dividers |
| `--rule-strong` | `#8A8275` | `#7A7366` | Borders of fields and buttons (3:1 against the paper) |
| `--ink` | `#2B2A26` | `#E6DFD2` | Primary text, icons, controls |
| `--ink-soft` | `#5A564E` | `#A39C8E` | Secondary text, labels, clock times |
| `--ochre` | `#B8875A` | `#C9965F` | Time shading and warning light only, never text |
| `--ochre-ink` | `#7A5230` | `#D9A86F` | Focus underline, the bookmark ribbon, time-related text that must meet contrast |

Light (the signature) is a full-page overlay whose color is computed, not tokenized:

| Token | Value | Use |
|---|---|---|
| `--warmth` | 0 to 1 | Set by script from the session stage |
| `--light-gain` | 0.6, 1 or 1.6 | Set by script from the Warm light setting |
| Overlay | `--ochre` at `warmth × 12%` (light), `× 10%` (dark), times `--light-gain`, `mix-blend-mode: multiply` (light) / `soft-light` (dark) | The low-sun warming |

Warmth is 0 for the body of the session, rises along an ease-in curve across the warning stage to about 0.7, and settles at 1 on the finish. It never animates faster than the clock.

**Spacing** (4 px base): `--s1` 4, `--s2` 8, `--s3` 12, `--s4` 16, `--s5` 24, `--s6` 32, `--s7` 48, `--s8` 64.

**Radius:** `--radius` 2 px for controls and fields. No other radius.

**Rules:** 1 px `--rule`. Emphasis is a 1 px `--ink` rule, never a thicker line.

### Typography

| Token | Family | Size | Line height | Use |
|---|---|---|---|---|
| `--type-title` | Newsreader 400, display optical size | `clamp(30px, 5vw + 14px, 52px)` | 1.1 | What I am doing |
| `--type-next` | Newsreader 400, italic | `clamp(20px, 2vw + 12px, 26px)` | 1.25 | What comes next |
| `--type-body` | Newsreader 400 | 17 px | 1.5 | Notes, the finish screen |
| `--type-label` | IBM Plex Mono 400 | 12 px, `letter-spacing: 0.02em` | 1.4 | Labels, clock times, minutes |
| `--type-figure` | IBM Plex Mono 400, `font-variant-numeric: tabular-nums` | 15 px (17 px in Simple mode) | 1.5 | Supporting time numbers in full mode |

Sentence case everywhere. Inputs use 17 px or larger so iOS never zooms on focus. Self-host the fonts (WOFF2, subset to Latin) and cache them in the service worker so the app is fully offline; fall back to `Georgia` and `ui-monospace`.

### Motion

| Element | Trigger | Animation | Duration | Easing |
|---|---|---|---|---|
| Control | Press | Translate down 1 px, ink darkens | 100 ms | `cubic-bezier(0.2, 0, 0, 1)` |
| Panel or sheet | Open or close | Fade, no slide | 160 ms | same |
| Stage change | Warning starts, finish | Light warmth eases to new target | 4 s minimum | ease-in-out |
| Time visual | Continuous | Smooth, no discrete ticks | Real time | linear |
| Private reveal (discreet) | Tap | Fade in, hold about 4 s, fade out | 200 ms in, 600 ms out | same |

With `prefers-reduced-motion`, drop the press and fade transitions; keep the time visual and the warmth (they are information), but step the warmth in at most three increments.

### States

| State | What changes |
|---|---|
| Setup | Clean, default page. Title and next fields empty, presets as a ruled list. |
| Running | Time visual plus title and next. Controls in mono labels along the bottom rule. |
| Warning | Warmth rises; the next activity gains presence (form is the build session's call). No color appears anywhere except ochre. |
| Finished | Warmth at 1, the next activity in the title position, a one-tap start, the left-off note prompt if not yet written. Discreet mode says "Session finished." |
| Extension | A new, short, full-size segment with its own visual; warmth resets to the warning curve for that segment. |
| Paused | Warmth and time visual freeze; a mono "Paused" label replaces the end time. No dimming or greying. |
| Stopped | Back to Setup, clean. No confirmation for a timer under one minute old; otherwise a single undo for 10 s rather than a dialog. |

### Surfaces

| Surface | Notes |
|---|---|
| iPhone, home-screen app | `viewport-fit=cover`; pad with `env(safe-area-inset-*)`; controls at least 44 × 44 px within thumb reach in the lower half; portrait and landscape both designed, not just reflowed. `theme-color` matches `--paper` in each mode. |
| Desktop browser | Max content width about 640 px, centered on the paper; the page continues to the edges. |
| Floating window (about 200 × 200) | A surface of its own. Title in `--type-next` size, the time visual, and at most one control row. No setup UI. Must stay readable on its own and match the active mode's discretion. |
| Discreet mode, anywhere | Tab title and favicon neutral (for example a plain date or "Day"), no numbers counting down, no time-related words. The page reads as a day planner. |

### Copy voice

Plain and adult. Sentence case, no exclamation marks, no "great job", no "oops". Labels are verbs: "Start", "Pause", "Add 5 min", "Take 5 min", "Stop". Finish copy is neutral: "Session finished." Stopping early or running over is never framed as failure.

### Accessibility

- Text meets WCAG AA against `--paper` and `--paper-raised` in both modes, including under full warmth (`--ink-soft` and `--ochre-ink` were darkened for this; `--ochre` is never used for text).
- Focus is a 2 px `--ochre-ink` underline offset 3 px for text controls, a 2 px outline for others; never the browser default.
- Focus order follows reading order: title, next, time, controls.
- One `aria-live="polite"` region announces stage changes only (warning, finish), never each minute. In discreet mode it announces "Session finished" only.
- Layout holds at 200% text size.

### Edge cases

- Long titles wrap to two lines, then truncate with an ellipsis; the full text is available on focus or tap.
- Empty "next": the finish screen offers setting one rather than leaving a blank.
- Reopening after the end time passed: show the finished state directly, with no late sound or animation.
- First launch: Setup with the default mode, no onboarding tour.
