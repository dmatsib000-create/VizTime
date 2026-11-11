// The time pictures, drawn on canvas so the same drawing serves the page, the
// floating window, and the iPhone picture-in-picture video.
//
// disc     Simple mode, and Full's default: an ochre wash whose area is the time left.
// level    Work mode: a desk clock whose dial holds a sinking ochre level.
// sun      Work mode: a desk clock with a low sun arcing to the horizon.
// planner  Work mode: a day-planner page. The session is an appointment block
//          on a real clock grid; the "now" line moves down through it and the
//          wash below the line is the time left. In the warning stage the page
//          eases into a closer view of the last stretch and the next entry.
// ruler    Full mode: a ruled strip on the page. Hatched where time has passed,
//          washed where it remains, with minute marks and clock times along
//          the top, so the time left can be counted as well as judged.
//
// Full mode can show any of the five, drawing level and sun with soft hands;
// Work mode never shows the disc or the ruler.

import { MIN } from './engine.js';

// Which pictures each mode offers, and the setting each remembers its choice
// in (Simple always has the disc). Only an offered picture is ever drawn,
// whatever was saved: Work mode must never show the disc or the ruler, which
// read as a timer, and tests/faces.test.js holds it to that.
export const FACES = { work: ['planner', 'level', 'sun'], full: ['disc', 'level', 'sun', 'planner', 'ruler'], simple: ['disc'] };
export const FACE_SETTING = { work: 'face', full: 'fullFace' };
export function faceFor(mode, settings) {
  const offered = FACES[mode] || FACES.simple;
  const saved = settings[FACE_SETTING[mode]];
  return offered.includes(saved) ? saved : offered[0];
}

// The same stacks as --serif and --mono in styles.css.
export const SERIF = "Newsreader, Georgia, 'Times New Roman', serif";
export const MONO = "'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace";

export function palette(root = document.documentElement) {
  const cs = getComputedStyle(root);
  const v = name => cs.getPropertyValue(name).trim();
  return {
    paper: v('--paper'), raised: v('--paper-raised'), rule: v('--rule'), ruleStrong: v('--rule-strong'),
    ink: v('--ink'), inkSoft: v('--ink-soft'), ochre: v('--ochre'), ochreInk: v('--ochre-ink'),
    wash: parseFloat(v('--wash-alpha')) || 0.5,
    light: parseFloat(v('--light-alpha')) || 0.12,
    blend: v('--light-blend') || 'multiply',
  };
}

// TV view draws the picture as if on a phone-sized screen and enlarges it, so
// its lines and labels grow with a big screen instead of staying desk-sized.
// A phone on its side is about 400 high, where nothing changes.
export const tvScale = (width, height) => Math.max(1, Math.min(width, height) / 400);

// Reads only six-digit hex, which is how styles.css writes every colour token.
function alpha(hex, a) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const lerp = (a, b, t) => a + (b - a) * t;

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
}

// Time passed: raised paper shaded in pencil, the same on every face that has
// it. The lines sit on a fixed 7px pitch from the left edge, so they don't
// shimmer as the shaded part grows.
function shadePassed(ctx, x, y, w, h, p) {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = p.raised;
  ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = alpha(p.rule, 0.9);
  ctx.lineWidth = 1;
  for (let k = -Math.ceil(h / 7) * 7; k < w; k += 7) {
    ctx.beginPath();
    ctx.moveTo(x + k, y);
    ctx.lineTo(x + k + h, y + h);
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------- Marks on the clock, and how often to draw ---------- */

const MARK_STEPS = [1, 2, 5, 10, 15, 30, 60, 120].map(x => x * MIN);
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const lcm = (a, b) => (a / gcd(a, b)) * b;

// Marks on real clock times from `from` to `to`, both included, about `most`
// of them at most: every 1, 2, 5, 10, 15, 30, 60 or 120 minutes (240 beyond).
// Fine marks are long each quarter hour, or each half hour where 2- and
// 10-minute steps miss the quarters; coarse ones each hour. `tzOffset` is in
// minutes, as getTimezoneOffset() gives it.
export function clockMarks(from, to, most, tzOffset = new Date(from).getTimezoneOffset()) {
  const step = MARK_STEPS.find(s => (to - from) / s <= most) || 240 * MIN;
  const major = lcm(step, step < 15 * MIN ? 15 * MIN : 60 * MIN);
  const tz = tzOffset * MIN;
  const marks = [];
  for (let t = Math.ceil((from - tz) / step) * step + tz; t <= to; t += step) marks.push({ t, long: (t - tz) % major === 0 });
  return marks;
}

// How long the page may wait, in ms, before drawing the picture again. Through
// the middle of a session every face's fastest part moves at most about 1.5
// times its size (up to 640px) over the session, so waiting totalMs / 2000
// keeps each step under half a pixel; a long session is drawn about once a
// second. Near the ends the level (narrow top and bottom of its dial) and the
// disc (small centre) move much faster, so the first 3% and last 5% of a
// session are drawn smoothly, as are the warning stage and the light or zoom
// settling. `frac` is the share of the session left.
export function redrawGap({ totalMs, stage, paused, frac }, settling) {
  if (settling) return 80;
  if (paused) return 1000;
  if (stage !== 'running' || frac > 0.97 || frac < 0.05) return 80;
  return Math.min(1000, Math.max(80, totalMs / 2000));
}

// Draws onto whatever is already there; callers clear or fill the background.
export function drawFace(ctx, w, h, name, m, p) {
  if (name === 'disc') drawDisc(ctx, w, h, m, p);
  else if (name === 'planner') drawPlanner(ctx, w, h, m, p);
  else if (name === 'ruler') drawRuler(ctx, w, h, m, p);
  else drawClock(ctx, w, h, m, p, name);
}

// Used only for the picture-in-picture video, which can't sit under the
// page's light overlay. Matches .light: the same strength and blend per mode.
export function paintWarmth(ctx, w, h, warmth, p) {
  if (warmth <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = p.blend;
  ctx.fillStyle = alpha(p.ochre, p.light * warmth);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/* ---------- disc ---------- */

function drawDisc(ctx, w, h, m, p) {
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.46;

  // The whole: the reference the wash is read against, so it needs 3:1.
  circle(ctx, cx, cy, R);
  ctx.strokeStyle = p.ruleStrong;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Where the wash will be when the warning stage begins: seen coming from the start.
  if (m.warnFrac < 1 && m.stage === 'running') {
    circle(ctx, cx, cy, R * Math.sqrt(m.warnFrac));
    ctx.setLineDash([2, 5]);
    ctx.strokeStyle = p.inkSoft;
    ctx.lineWidth = 1.25;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // The wash is soft, so its edge is drawn in ochre ink to read at a glance (3:1 or better).
  if (m.frac > 0) {
    circle(ctx, cx, cy, R * Math.sqrt(m.frac));
    ctx.fillStyle = alpha(p.ochre, m.paused ? p.wash * 0.55 : p.wash + 0.15 * m.warnP);
    ctx.fill();
    ctx.strokeStyle = p.ochreInk;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

/* ---------- desk clock: level and sun ---------- */

// Height (as a share of the diameter) of a circular segment holding `f` of the area.
function segmentHeight(f) {
  const area = hgt => {
    const d = 1 - hgt;
    return (Math.acos(d) - d * Math.sqrt(Math.max(0, 1 - d * d))) / Math.PI;
  };
  let lo = 0, hi = 2;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (area(mid) < f) lo = mid; else hi = mid;
  }
  return lo / 2;
}

function drawClock(ctx, w, h, m, p, kind) {
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.45;

  circle(ctx, cx, cy, R);
  ctx.fillStyle = p.raised;
  ctx.fill();

  ctx.save();
  circle(ctx, cx, cy, R);
  ctx.clip();
  if (kind === 'level') drawLevel(ctx, cx, cy, R, m, p);
  else drawSun(ctx, cx, cy, R, m, p);
  ctx.restore();

  circle(ctx, cx, cy, R);
  ctx.strokeStyle = p.rule;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Hour marks.
  ctx.strokeStyle = p.inkSoft;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const long = i % 3 === 0;
    const r0 = R * (long ? 0.82 : 0.87), r1 = R * 0.93;
    ctx.lineWidth = long ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.sin(a) * r0, cy - Math.cos(a) * r0);
    ctx.lineTo(cx + Math.sin(a) * r1, cy - Math.cos(a) * r1);
    ctx.stroke();
  }

  // Hands: an ordinary clock telling the ordinary time. Soft hands are finer
  // and translucent ink, so the ochre stays the strongest mark while the hands
  // still read against it in both modes (3:1 or better). Never under 1.5px.
  const soft = m.hands === 'soft';
  const k = soft ? 0.7 : 1;
  const thin = (min, w) => Math.max(1.5, Math.max(min, w) * k);
  const t = new Date(m.now);
  const mins = t.getMinutes() + t.getSeconds() / 60;
  const hrs = (t.getHours() % 12) + mins / 60;
  // Both hands and the hub are one filled shape, all wound the same way, so
  // translucent ink lands once where they cross instead of pooling darker.
  // Each hand is a capsule: a line with round ends, drawn as an outline.
  const hand = (angle, len, width) => {
    const r = width / 2, nx = Math.cos(angle) * r, ny = Math.sin(angle) * r;
    const tx = cx - Math.sin(angle) * R * 0.08, ty = cy + Math.cos(angle) * R * 0.08;
    const hx = cx + Math.sin(angle) * len, hy = cy - Math.cos(angle) * len;
    ctx.moveTo(tx + nx, ty + ny);
    ctx.lineTo(hx + nx, hy + ny);
    ctx.arc(hx, hy, r, angle, angle + Math.PI, true);
    ctx.lineTo(tx - nx, ty - ny);
    ctx.arc(tx, ty, r, angle + Math.PI, angle, true);
    ctx.closePath();
  };
  ctx.beginPath();
  hand((hrs / 12) * Math.PI * 2, R * 0.5, thin(2, R * 0.03));
  hand((mins / 60) * Math.PI * 2, R * 0.76, thin(1.5, R * 0.018));
  const hub = thin(2.5, R * 0.03);
  ctx.moveTo(cx + hub, cy);
  ctx.arc(cx, cy, hub, 0, Math.PI * 2, true);
  ctx.fillStyle = soft ? alpha(p.ink, 0.7) : p.ink;
  ctx.fill();
}

function drawLevel(ctx, cx, cy, R, m, p) {
  const top = cy + R - segmentHeight(m.frac) * 2 * R;
  if (m.frac > 0) {
    ctx.fillStyle = alpha(p.ochre, m.paused ? p.wash * 0.55 : p.wash + 0.1 * m.warnP);
    ctx.fillRect(cx - R, top, 2 * R, cy + R - top);
    ctx.strokeStyle = p.ochreInk;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - R, top);
    ctx.lineTo(cx + R, top);
    ctx.stroke();
  }
  // A small mark on the left edge where the warning stage begins.
  if (m.stage === 'running' && m.warnFrac < 1) {
    const wy = cy + R - segmentHeight(m.warnFrac) * 2 * R;
    const half = Math.sqrt(Math.max(0, R * R - (wy - cy) ** 2));
    ctx.strokeStyle = p.ochreInk;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - half, wy);
    ctx.lineTo(cx - half + R * 0.1, wy);
    ctx.stroke();
  }
}

function drawSun(ctx, cx, cy, R, m, p) {
  const hy = cy + R * 0.3;
  const chord = Math.sqrt(R * R - (hy - cy) ** 2);
  const rx = chord * 0.84, ry = (hy - (cy - R)) * 0.74;

  // Ground below the horizon.
  ctx.fillStyle = alpha(p.rule, 0.45);
  ctx.fillRect(cx - R, hy, 2 * R, R);

  // The day's path, faint.
  ctx.beginPath();
  ctx.ellipse(cx, hy, rx, ry, 0, Math.PI, Math.PI * 2);
  ctx.setLineDash([1.5, 5]);
  ctx.strokeStyle = p.inkSoft;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // The sun: rises from the left horizon, sets at the right one, then sinks.
  const e = 1 - m.frac;
  const a = Math.PI + Math.PI * e;
  const sr = R * 0.1;
  const sx = cx + rx * Math.cos(a);
  const sy = hy + ry * Math.sin(a) + (m.stage === 'finished' ? sr * 1.2 : 0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - R, cy - R, 2 * R, hy - (cy - R));
  ctx.clip();
  circle(ctx, sx, sy, sr);
  ctx.fillStyle = m.paused ? alpha(p.ochre, 0.55) : p.ochre;
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = p.inkSoft;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - chord, hy);
  ctx.lineTo(cx + chord, hy);
  ctx.stroke();
}

/* ---------- ruler ---------- */

// Length is read more accurately than area, and the marks give the eye halves
// and quarters to judge against, so this is the face for counting minutes.
// Everything moves at a constant rate: it calibrates, it doesn't reassure.
function drawRuler(ctx, w, h, m, p) {
  // A narrow floating window. Its usual 244px, and a 320px phone's face, still have room for clock times.
  const small = w < 220;
  // On the page the strip runs to the column's edges, leaving room only for the now dot.
  const pad = small ? 10 : 4;
  const x0 = pad, x1 = w - pad, L = x1 - x0;
  const labelSize = small ? 0 : L >= 300 ? 13 : 11;
  // A sixth of its length, so it has the weight to be seen from the corner of
  // the eye; capped so a wide desktop strip stays a strip, not a block.
  // TV view gives the strip the whole width and wants it seen across a room, so there it may be a block.
  const H = Math.round(Math.min(h * (m.tv ? 0.55 : 0.28), m.tv ? Infinity : 96, Math.max(small ? 16 : 22, L / 6)));
  const above = small ? 9 : labelSize + 13, below = small ? 12 : 16;
  const y0 = Math.round((h - (above + H + below)) / 2 + above) + 0.5, y1 = y0 + H;

  const start = m.endAt - m.totalMs;
  const xAt = t => x0 + ((t - start) / m.totalMs) * L;
  const nowX = x0 + (1 - m.frac) * L;

  // Time passed, like a page already used.
  shadePassed(ctx, x0, y0, nowX - x0, H, p);

  // Time left: the wash, ending at a firm ochre-ink line, so the eye measures
  // one distance, from now to the end.
  if (m.frac > 0) {
    ctx.fillStyle = alpha(p.ochre, m.paused ? p.wash * 0.55 : p.wash + 0.15 * m.warnP);
    ctx.fillRect(nowX, y0, x1 - nowX, H);
  }
  ctx.strokeStyle = p.ruleStrong;
  ctx.lineWidth = 1;
  // On half pixels, so the side edges are as crisp as the top and bottom.
  ctx.strokeRect(x0 + 0.5, y0, Math.round(L) - 1, H);
  ctx.fillStyle = p.ochreInk;
  ctx.fillRect(x1 - 1.5, y0 - 0.5, 1.5, H + 1);

  // Minute marks on real clock times along the top edge (clockMarks), clock
  // times over the long ones, and the end time in full ink.
  ctx.font = `400 ${labelSize}px ${MONO}`;
  ctx.textBaseline = 'alphabetic';
  const endText = m.fmtClock(m.endAt);
  let endLabelX = Infinity;
  if (!small) {
    endLabelX = x1 - ctx.measureText(endText).width;
    ctx.fillStyle = p.ink;
    ctx.textAlign = 'right';
    ctx.fillText(endText, x1 + 1, y0 - 11);
  }
  ctx.strokeStyle = p.ruleStrong;
  ctx.lineWidth = 1;
  ctx.textAlign = 'center';
  ctx.fillStyle = p.inkSoft;
  let lastLabel = -Infinity;
  for (const { t, long } of clockMarks(start, m.endAt, small ? 6 : 10)) {
    if (t >= m.endAt) break;
    const x = Math.round(xAt(t)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y0 - 0.5);
    ctx.lineTo(x, y0 - (long ? 7 : 4));
    ctx.stroke();
    if (small || !long) continue;
    const text = m.fmtClock(t), half = ctx.measureText(text).width / 2;
    const lx = Math.max(half, x);
    // A short session can end in the same clock minute as a long mark.
    if (text === endText || lx - half < lastLabel + 8 || lx + half > endLabelX - 8) continue;
    ctx.fillText(text, lx, y0 - 11);
    lastLabel = lx + half;
  }

  // The last stretch, seen coming from the start: a dotted line under the strip
  // from where the warning stage begins, with a small tick at its start.
  if (m.warnFrac < 1) {
    const wx = Math.round(x0 + (1 - m.warnFrac) * L);
    const ly = y1 + (small ? 4 : 6);
    ctx.strokeStyle = p.ochreInk;
    ctx.lineWidth = 1.25;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(wx, ly);
    ctx.lineTo(x1, ly);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(wx + 0.75, y1 + 2);
    ctx.lineTo(wx + 0.75, ly + 4);
    ctx.stroke();
  }

  // Now, as a calendar marks it: a fine ink line down through the strip to a dot.
  const nx = Math.round(nowX) + 0.5, dotY = y1 + below - 4;
  ctx.strokeStyle = p.ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(nx, y0);
  ctx.lineTo(nx, dotY);
  ctx.stroke();
  circle(ctx, nx, dotY, small ? 2.5 : 3);
  ctx.fillStyle = p.ink;
  ctx.fill();
}

/* ---------- planner page ---------- */

function drawPlanner(ctx, w, h, m, p) {
  const small = w < 260;
  const pad = small ? 8 : 14;
  const gutter = small ? 40 : Math.round(Math.min(76, Math.max(58, w / 8)));
  // Text grows with the page, so a large desktop planner stays proportionate.
  const labelSize = small ? 9.5 : Math.min(13, Math.max(11, w / 40));
  const titleSize = small ? 12 : Math.min(22, Math.max(15, Math.round(w / 26)));
  const top = pad, H = h - pad * 2;

  const bEnd = m.endAt, bStart = bEnd - m.totalMs;
  const nowV = bEnd - m.remainingMs;
  const nEnd = bEnd + Math.max(m.totalMs * 0.5, 15 * MIN);

  // Two views of the same page: the whole session, and a closer look at the
  // last stretch and what follows. The zoom eases between them.
  const ws = lerp(bStart - m.totalMs * 0.12, bEnd - m.warnMs * 1.3, m.zoom);
  const we = lerp(bEnd + m.totalMs * 0.42, bEnd + m.warnMs * 1.1, m.zoom);
  const y = t => top + ((t - ws) / (we - ws)) * H;

  // Ruled grid on real clock times.
  ctx.font = `400 ${labelSize}px ${MONO}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  for (const { t } of clockMarks(ws, we, small ? 6 : 9)) {
    const ly = Math.round(y(t)) + 0.5;
    ctx.strokeStyle = p.rule;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gutter, ly);
    ctx.lineTo(w, ly);
    ctx.stroke();
    ctx.fillStyle = p.inkSoft;
    ctx.fillText(m.fmtClock(t), gutter - 6, ly);
  }

  const x0 = gutter + 4, x1 = w - 2;
  const clipTop = Math.max(top - pad, 0), clipBottom = h;
  const clampY = v => Math.min(clipBottom, Math.max(clipTop, v));

  // The next entry.
  if (m.next) {
    const ny0 = clampY(y(bEnd) + 3), ny1 = clampY(y(nEnd));
    if (ny1 > ny0) {
      ctx.fillStyle = p.raised;
      ctx.fillRect(x0, ny0, x1 - x0, ny1 - ny0);
      if (m.warnP > 0) {
        ctx.fillStyle = alpha(p.ochre, 0.22 * m.warnP);
        ctx.fillRect(x0, ny0, x1 - x0, ny1 - ny0);
      }
      ctx.fillStyle = p.inkSoft;
      ctx.fillRect(x0, ny0, 2, ny1 - ny0);
      blockLabel(ctx, m.next, x0 + 10, ny0, ny1, x1 - x0 - 16, titleSize, p.ink, true);
    }
  }

  // The current block: hatched where time has passed, washed where it remains.
  const by0 = clampY(y(bStart)), by1 = clampY(y(bEnd)), ny = clampY(y(nowV));
  shadePassed(ctx, x0, by0, x1 - x0, ny - by0, p);
  if (by1 > ny) {
    ctx.fillStyle = alpha(p.ochre, m.paused ? p.wash * 0.5 : p.wash * 0.85 + 0.12 * m.warnP);
    ctx.fillRect(x0, ny, x1 - x0, by1 - ny);
    // Where the time left ends: a firm ochre-ink line at the bottom of the wash.
    ctx.fillStyle = p.ochreInk;
    ctx.fillRect(x0, Math.round(by1) - 1.5, x1 - x0, 1.5);
  }
  if (by1 > by0) {
    ctx.strokeStyle = p.rule;
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, by0 + 0.5, x1 - x0 - 1, by1 - by0 - 1);
    ctx.fillStyle = p.ochreInk;
    ctx.fillRect(x0, by0, 2, by1 - by0);
    blockLabel(ctx, m.title || 'Appointment', x0 + 10, by0, by1, x1 - x0 - 16, titleSize, p.ink, false);
  }

  // Now line, as any calendar draws it.
  const nly = Math.round(ny) + 0.5;
  ctx.strokeStyle = p.ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(gutter - 2, nly);
  ctx.lineTo(w, nly);
  ctx.stroke();
  circle(ctx, gutter, nly, 3);
  ctx.fillStyle = p.ink;
  ctx.fill();
}

function blockLabel(ctx, text, x, y0, y1, maxW, size, color, italic) {
  if (y1 - y0 < size + 6) return;
  ctx.font = `${italic ? 'italic ' : ''}400 ${size}px ${SERIF}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  let s = text;
  while (s.length > 1 && ctx.measureText(s).width > maxW) s = s.slice(0, -2) + '…';
  ctx.fillText(s, x, y0 + 6);
}
