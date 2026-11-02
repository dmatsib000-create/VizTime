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
//
// Full mode can show any of the four, drawing level and sun with soft hands;
// Work mode never shows the disc.

import { MIN } from './engine.js';

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

function alpha(hex, a) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const lerp = (a, b, t) => a + (b - a) * t;

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
}

// Draws onto whatever is already there; callers clear or fill the background.
export function drawFace(ctx, w, h, name, m, p) {
  if (name === 'disc') drawDisc(ctx, w, h, m, p);
  else if (name === 'planner') drawPlanner(ctx, w, h, m, p);
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
  const span = we - ws;
  const step = [1, 2, 5, 10, 15, 30, 60, 120].map(x => x * MIN).find(s => span / s <= (small ? 6 : 9)) || 240 * MIN;
  const tz = new Date().getTimezoneOffset() * MIN;
  ctx.font = `400 ${labelSize}px ${MONO}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  for (let t = Math.ceil((ws - tz) / step) * step + tz; t <= we; t += step) {
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
  if (ny > by0) {
    ctx.fillStyle = p.raised;
    ctx.fillRect(x0, by0, x1 - x0, ny - by0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, by0, x1 - x0, ny - by0);
    ctx.clip();
    ctx.strokeStyle = alpha(p.rule, 0.9);
    ctx.lineWidth = 1;
    for (let k = -h; k < w + h; k += 7) {
      ctx.beginPath();
      ctx.moveTo(x0 + k, by0);
      ctx.lineTo(x0 + k + (ny - by0), ny);
      ctx.stroke();
    }
    ctx.restore();
  }
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
