// TimeFall: loads every part of the page, then shows the first screen.
//
// platform.js where this runs: the web page, or the iPhone or Android shell
// state.js    settings, the mode and the session, shared by all of these
// ui.js       element lookup, the toast, the live region
// words.js    what the app says about time: formats, tab title, cues,
//             notifications, the picture's label (pure, and tested)
// setup.js    the setup form, presets and the simple chips
// session.js  starting, running controls, finishing, stopping, cues, wake lock
// screens.js  which screen shows, and the running and finish screens
// draw.js     the clock tick and the frame loop: picture, warm light, zoom
// pip.js      the floating window's content and the picture-in-picture video
// menu.js     the menu sheet and the mode switch
// cues.js     the reminders a phone schedules for the background (pure, tested)
// native.js   the phone shells: reminders, vibration, screen, floating, codes
//
// The modules import one another in a loop. That is safe because each one,
// while loading, only defines things and wires its own controls; they call
// across modules later, from handlers and from the start below.

import { isNative } from './platform.js';
import { resetForm } from './setup.js';
import { render } from './screens.js';
import { tick } from './draw.js';
import { initNative } from './native.js';
import './session.js';
import './pip.js';
import './menu.js';

resetForm();
render();
setInterval(tick, 1000);
initNative();

// The shells carry their own copy of the page; only the web page caches itself.
if (!isNative && 'serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
