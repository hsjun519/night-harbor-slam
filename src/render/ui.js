// UI widgets: panels, gauges (told apart by colour, shape and icon), key caps, icons, menus, toasts.
import { clamp, clamp01 } from '../core/util.js';
import { UI, mixHex, shade } from './palette.js';
import { drawText, textWidth, wrapText } from './pixelfont.js';
import { rect } from './painter.js';

const ICONS = {
  heart: ['.aa.aa.', 'acaaaaa', 'aaaaaaa', 'aaaaaaa', '.aaaaa.', '..aaa..', '...a...'],
  stun: ['..aaa..', '.a...a.', 'a..a..a', 'a.a.a.a', 'a..aa.a', '.a....a', '..aaaa.'],
  bolt: ['...aa', '..aa.', '.aa..', 'aaaa.', '..aa.', '.aa..', 'aa...'],
  bandage: ['.aaaaaa.', 'aabaabaa', 'aaccccaa', 'aaccccaa', 'aabaabaa', '.aaaaaa.'],
  coin: ['..aaa..', '.acaaa.', 'acabaaa', 'aaabaaa', 'aaabaaa', '.aaaaa.', '..aaa..'],
  star: ['...a...', '...a...', 'aaacaaa', '.aaaaa.', '..aaa..', '.aa.aa.', 'a.....a'],
  skull: ['.aaaaa.', 'aaaaaaa', 'a.aa.aa', 'aaaaaaa', '.aa.aa.', '..aaa..'],
  bell: ['...a...', '..aaa..', '.aaaaa.', '.aaaaa.', 'aaaaaaa', '...a...'],
  clock: ['.aaaaa.', 'a..a..a', 'a..a..a', 'a..aa.a', 'a.....a', '.aaaaa.'],
  trophy: ['aaaaaaa', 'aaaaaaa', '.aaaaa.', '..aaa..', '...a...', '..aaa..'],
  rank: ['aaaaaaa', 'a.....a', 'a.aaa.a', 'a.....a', 'a.aa..a', 'aaaaaaa'],
  fatigue: ['..aa...', '.a..a..', '...a...', '..a....', '.aaaa..', '.......', '..a.a.a'],
  cal: ['a.a.a.a', 'aaaaaaa', 'a.....a', 'a.a.a.a', 'a.....a', 'aaaaaaa'],
  pin: ['..aaa..', '.aaaaa.', '.aaaaa.', '..aaa..', '...a...', '...a...'],
  door: ['aaaaa', 'a...a', 'a...a', 'a..ca', 'a...a', 'aaaaa'],
  talk: ['aaaaaaa', 'a.....a', 'a.a.a.a', 'a.....a', 'aaa.aaa', '..aa...'],
  shield: ['aaaaaaa', 'acccaaa', 'aaaaaaa', '.aaaaa.', '..aaa..', '...a...'],
  arrow: ['...a...', '..aaa..', '.aaaaa.', '...a...', '...a...'],
  hp: ['.aa.aa.', 'aaaaaaa', 'aaaaaaa', '.aaaaa.', '..aaa..', '...a...'],
};
export function icon(g, name, x, y, col, o = {}) {
  const b = ICONS[name];
  if (!b) return;
  const s = o.scale || 1, dark = o.dark || shade(col, -.55), light = o.light || mixHex(col, '#ffffff', .6);
  for (let r = 0; r < b.length; r++) for (let c = 0; c < b[r].length; c++) {
    const ch = b[r][c];
    if (ch === '.') continue;
    g.fillStyle = ch === 'a' ? col : ch === 'b' ? dark : light;
    g.fillRect(Math.round(x + c * s), Math.round(y + r * s), s, s);
  }
  if (o.outline) { /* small drop shadow */ }
}
export function panel(g, x, y, w, h, o = {}) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  const bg = o.bg || UI.panel, edge = o.edge || UI.edge, acc = o.accent || UI.accent, cut = o.cut != null ? o.cut : 4;
  g.globalAlpha = o.alpha != null ? o.alpha : 1;
  rect(g, '#05060f', x - 1, y - 1, w + 2, h + 2);
  rect(g, bg, x, y, w, h);
  rect(g, mixHex(bg, '#ffffff', .05), x, y, w, Math.min(h, 10));
  rect(g, edge, x, y, w, 1); rect(g, shade(edge, -.4), x, y + h - 1, w, 1); rect(g, edge, x, y, 1, h); rect(g, shade(edge, -.4), x + w - 1, y, 1, h);
  if (cut) { for (let i = 0; i < cut; i++) { rect(g, '#05060f', x + w - cut + i, y + i, cut - i, 1); } rect(g, acc, x + w - cut - 10, y, 10, 1); }
  if (o.accentBar !== false) rect(g, acc, x, y + 2, 2, Math.min(h - 4, 12));
  g.globalAlpha = 1;
}
// Gauge. style: 'hp' (thick, segmented, heart), 'stun' (thin, chain dashes, spiral), 'fin' (wave cells, bolt), 'inj' (bandage, stripes).
export function gauge(g, x, y, w, h, v, style, o = {}) {
  v = clamp01(v);
  const col = o.col || UI[style] || UI.hp, colD = o.colD || UI[style + 'D'] || shade(col, -.5), back = '#0a0b18';
  x = Math.round(x); y = Math.round(y);
  rect(g, '#05060f', x - 1, y - 1, w + 2, h + 2); rect(g, back, x, y, w, h);
  const fw = Math.round(w * v), flip = o.flip;
  const X = n => (flip ? x + w - n : x);
  if (o.trail != null && o.trail > v) { const tw = Math.round(w * clamp01(o.trail)); rect(g, '#fff4e0', flip ? x + w - tw : x, y, tw, h); }
  if (fw > 0) {
    rect(g, colD, X(fw), y, fw, h);
    rect(g, col, X(fw), y, fw, Math.max(1, h - (h > 4 ? 2 : 1)));
    rect(g, mixHex(col, '#ffffff', .45), X(fw), y, fw, 1);
  }
  if (style === 'hp') for (let i = 1; i < 10; i++) rect(g, back, x + Math.round(w * i / 10), y, 1, h);
  else if (style === 'stun') for (let i = 3; i < w; i += 6) rect(g, back, x + i, y, 1, h);
  else if (style === 'fin') for (let i = 1; i < 5; i++) rect(g, back, x + Math.round(w * i / 5), y, 2, h);
  else if (style === 'inj') for (let i = 2; i < w; i += 5) rect(g, 'rgba(0,0,0,.35)', x + i, y + 1, 2, h - 2);
  if (o.blink && v < (o.blinkBelow || .25) && Math.floor((o.time || 0) * 6) % 2) rect(g, 'rgba(255,255,255,.35)', X(fw), y, fw, h);
  if (o.full && v >= 1) { const k = .5 + .5 * Math.sin((o.time || 0) * 10); g.globalAlpha = .35 + k * .4; rect(g, '#ffffff', x, y, w, h); g.globalAlpha = 1; }
  if (o.icon) icon(g, o.icon, flip ? x + w + 3 : x - 10, y + Math.round(h / 2) - 3, o.iconCol || col);
}
export function keycap(g, label, x, y, o = {}) {
  const w = Math.max(11, textWidth(label, 11) + 6), h = 12;
  x = Math.round(x); y = Math.round(y);
  rect(g, '#05060f', x - 1, y - 1, w + 2, h + 2); rect(g, o.bg || '#d8def5', x, y, w, h - 1); rect(g, '#8a93b8', x, y + h - 2, w, 1); rect(g, '#ffffff', x, y, w, 1);
  drawText(g, label, x + w / 2, y + 1, { size: 11, align: 'c', color: o.color || '#141a36' });
  return w;
}
// "[K] 잡기" style prompt. Returns width.
export function prompt(g, keys, text, x, y, o = {}) {
  let cx = x;
  const parts = [];
  for (const k of keys) parts.push(k);
  const total = parts.reduce((s, k) => s + Math.max(11, textWidth(k, 11) + 6) + 2, 0) + textWidth(text, 11) + 4;
  if (o.align === 'c') cx = x - total / 2; else if (o.align === 'r') cx = x - total;
  if (o.bg) panel(g, cx - 5, y - 3, total + 10, 18, { cut: 2, accentBar: false, alpha: .9 });
  for (const k of parts) cx += keycap(g, k, cx, y) + 2;
  drawText(g, text, cx + 2, y, { size: 11, color: o.color || UI.text, outline: o.bg ? null : '#05060f' });
  return total;
}
export function menuList(g, items, sel, x, y, o = {}) {
  const lh = o.lh || 18, w = o.w || 200;
  items.forEach((it, i) => {
    const yy = y + i * lh, on = i === sel, dis = it.disabled;
    if (on) { rect(g, mixHex(UI.accent, UI.panel, .55), x - 6, yy - 2, w + 12, lh - 2); rect(g, UI.accent, x - 6, yy - 2, 2, lh - 2); }
    const label = typeof it === 'string' ? it : it.label;
    drawText(g, (on ? '▶ ' : '  ') + label, x, yy, { color: dis ? UI.faint : on ? '#ffffff' : UI.dim, size: o.size || 14 });
    if (it.value != null) drawText(g, String(it.value), x + w, yy, { align: 'r', color: on ? '#ffd65a' : UI.dim, size: o.size || 14 });
  });
}
export function wrapped(g, text, x, y, w, o = {}) { const lines = wrapText(text, w, o.size || 14); lines.forEach((l, i) => drawText(g, l, x, y + i * (o.lh || 17), o)); return lines.length; }
export function fade(g, a, col = '#05060f') { if (a <= 0) return; g.globalAlpha = clamp(a, 0, 1); rect(g, col, 0, 0, 640, 360); g.globalAlpha = 1; }
export function banner(g, text, y, col, o = {}) {
  const sc = o.scale || 3, w = textWidth(text, 14, sc, true);
  const x = 320 - w / 2;
  if (o.band) { g.globalAlpha = o.bandAlpha != null ? o.bandAlpha : .78; rect(g, o.band, 0, y - 8, 640, 14 * sc + 16); g.globalAlpha = 1; rect(g, col, 0, y - 9, 640, 1); rect(g, col, 0, y + 14 * sc + 8, 640, 1); }
  drawText(g, text, x + 2, y + 3, { scale: sc, color: '#05060f', bold: true });
  drawText(g, text, x, y, { scale: sc, color: col, bold: true, outline: '#05060f', grad: o.grad });
  if (o.sub) drawText(g, o.sub, 320, y + 14 * sc + 4, { align: 'c', color: o.subCol || '#eef2ff', outline: '#05060f' });
}
