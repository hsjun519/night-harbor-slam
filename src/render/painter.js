// Pixel-art painting helpers shared by the arenas and the town: walls, windows, neon, lamps, props.
import { makeCanvas, ctxOf, RNG } from '../core/util.js';
import { rampHex, mixHex, shade } from './palette.js';
import { drawText, textWidth } from './pixelfont.js';

export function canvas(w, h) { const c = makeCanvas(w, h); return [c, ctxOf(c)]; }
export function rect(g, c, x, y, w, h) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
export function vgrad(g, x, y, w, h, stops) { const gr = g.createLinearGradient(0, y, 0, y + h); stops.forEach(([t, c]) => gr.addColorStop(t, c)); g.fillStyle = gr; g.fillRect(x, y, w, h); }
// Banded vertical gradient: hard colour steps read as pixel art.
export function bands(g, x, y, w, h, cols) { const n = cols.length; for (let i = 0; i < n; i++) { const y0 = Math.round(y + h * i / n), y1 = Math.round(y + h * (i + 1) / n); rect(g, cols[i], x, y0, w, y1 - y0); } }
export function dither(g, x, y, w, h, c, density = .5, seed = 1) { const r = new RNG(seed); g.fillStyle = c; for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (((xx + yy) & 1) === 0 && r.next() < density) g.fillRect(x + xx, y + yy, 1, 1); }
export function checker(g, x, y, w, h, c) { g.fillStyle = c; for (let yy = 0; yy < h; yy++) for (let xx = (yy & 1); xx < w; xx += 2) g.fillRect(x + xx, y + yy, 1, 1); }
export function line(g, c, x0, y0, x1, y1, w = 1) {
  g.fillStyle = c;
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  dx = Math.abs(x1 - x0); dy = -Math.abs(y1 - y0); e = dx + dy;
  for (let i = 0; i < 2000; i++) { g.fillRect(x0, y0, w, w); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
export function ellipse(g, c, cx, cy, rx, ry) { g.fillStyle = c; for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)))); g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); } }
export function poly(g, c, pts) { g.fillStyle = c; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill(); }
// Soft light: radial glow added on top (used on a separate light layer).
export function glow(g, x, y, r, col, a = .5) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.save(); g.globalAlpha = a; g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore(); }
export function cone(g, x, y, w0, w1, h, col, a = .22) { const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.save(); g.globalAlpha = a; g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.beginPath(); g.moveTo(x - w0 / 2, y); g.lineTo(x + w0 / 2, y); g.lineTo(x + w1 / 2, y + h); g.lineTo(x - w1 / 2, y + h); g.closePath(); g.fill(); g.restore(); }
// Neon text: dark tube shadow, glow halo, bright core.
export function neon(g, text, x, y, col, o = {}) {
  const sc = o.scale || 2, w = textWidth(text, 14, sc, true);
  const px = o.align === 'c' ? x - w / 2 : x;
  drawText(g, text, px + 1, y + 2, { scale: sc, color: '#0a0716', bold: true });
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawText(g, text, px + dx, y + dy, { scale: sc, color: mixHex(col, '#000000', .45), bold: true, alpha: .9 });
  drawText(g, text, px, y, { scale: sc, color: o.off ? mixHex(col, '#1a1030', .6) : col, bold: true });
  if (!o.off) drawText(g, text, px, y - 1, { scale: sc, color: mixHex(col, '#ffffff', .55), bold: true, alpha: .5 });
  return w;
}
export function brick(g, x, y, w, h, base, o = {}) {
  const R = rampHex(base), r = new RNG(o.seed || 7);
  rect(g, R[1], x, y, w, h);
  const bw = o.bw || 12, bh = o.bh || 5;
  for (let yy = 0, row = 0; yy < h; yy += bh, row++) for (let xx = -(row % 2) * bw / 2; xx < w; xx += bw) {
    const c = r.next() < .2 ? R[3] : r.next() < .5 ? R[2] : mixHex(R[2], R[1], .4);
    rect(g, c, x + Math.max(0, xx) + 1, y + yy + 1, Math.min(bw - 1, w - Math.max(0, xx) - 1), bh - 1);
  }
}
export function planks(g, x, y, w, h, base, o = {}) {
  const R = rampHex(base), r = new RNG(o.seed || 3), ph = o.ph || 6;
  for (let yy = 0, i = 0; yy < h; yy += ph, i++) { rect(g, i % 2 ? R[2] : mixHex(R[2], R[3], .3), x, y + yy, w, ph - 1); rect(g, R[0], x, y + yy + ph - 1, w, 1); for (let k = 0; k < w / 30; k++) { const sx = x + ((r.next() * w) | 0); rect(g, R[1], sx, y + yy + 1, 1, ph - 2); } }
}
export function tiles(g, x, y, w, h, a, b, s = 8) { for (let yy = 0; yy < h; yy += s) for (let xx = 0; xx < w; xx += s) rect(g, ((xx / s + yy / s) & 1) ? a : b, x + xx, y + yy, Math.min(s, w - xx), Math.min(s, h - yy)); }
export function windowPane(g, x, y, w, h, o = {}) {
  const frame = o.frame || '#2a2f4a', sky = o.sky || ['#1b2a5c', '#30407a', '#5b4a8a'];
  rect(g, frame, x - 2, y - 2, w + 4, h + 4);
  bands(g, x, y, w, h, sky);
  if (o.city) { const r = new RNG(o.seed || 11); for (let i = 0; i < w; i += 6 + (r.next() * 6 | 0)) { const bh = 6 + r.next() * h * .55, bw = 5 + (r.next() * 5 | 0); rect(g, '#141a33', x + i, y + h - bh, bw, bh); for (let k = 0; k < 4; k++) if (r.next() < .6) rect(g, r.next() < .5 ? '#ffd27a' : '#7fe0ff', x + i + 1 + (r.next() * (bw - 2) | 0), y + h - bh + 2 + (r.next() * (bh - 3) | 0), 1, 1); } }
  if (o.bars !== false) { rect(g, frame, x + w / 2 - 1, y, 2, h); rect(g, frame, x, y + h / 2 - 1, w, 2); }
  rect(g, 'rgba(255,255,255,.12)', x + 2, y + 2, 2, h - 4);
}
export function lamp(g, x, y, col = '#ffcf7a', o = {}) {
  const L = o.len || 14;
  rect(g, '#1a1d33', x, y, 1, L);
  poly(g, o.shade || '#2b3156', [[x - 7, y + L + 6], [x + 8, y + L + 6], [x + 4, y + L], [x - 3, y + L]]);
  rect(g, col, x - 4, y + L + 6, 9, 2);
}
export function poster(g, x, y, w, h, col, title, o = {}) {
  rect(g, '#120c1e', x - 1, y - 1, w + 2, h + 2);
  bands(g, x, y, w, h, [col, shade(col, -.2), shade(col, -.38)]);
  if (o.figure) { const cx = x + w / 2; ellipse(g, shade(col, -.6), cx, y + h * .42, w * .22, h * .16); rect(g, shade(col, -.6), cx - w * .3, y + h * .55, w * .6, h * .28); }
  if (title) drawText(g, title, x + w / 2, y + h - 13, { size: 11, align: 'c', color: o.tc || '#fff6dc', outline: '#120c1e' });
  if (o.top) drawText(g, o.top, x + w / 2, y + 2, { size: 11, align: 'c', color: o.tc2 || '#ffe27a' });
}
export function plant(g, x, y, o = {}) {
  rect(g, o.pot || '#8a4a3a', x - 6, y - 10, 12, 10); rect(g, shade(o.pot || '#8a4a3a', -.3), x - 6, y - 2, 12, 2);
  const R = rampHex(o.leaf || '#3f9a5a');
  for (const [dx, dy, r] of [[-5, -18, 6], [4, -20, 6], [0, -27, 6], [-2, -14, 5], [6, -13, 4]]) ellipse(g, R[2], x + dx, y + dy, r, r - 1);
  for (const [dx, dy] of [[-6, -20], [3, -23], [0, -29]]) ellipse(g, R[3], x + dx, y + dy, 2, 1);
}
export function box(g, x, y, w, h, col, o = {}) {
  const R = rampHex(col);
  rect(g, R[0], x - 1, y - 1, w + 2, h + 2); rect(g, R[2], x, y, w, h); rect(g, R[3], x, y, w, 2); rect(g, R[1], x, y + h - 2, w, 2);
  if (o.tape) rect(g, shade(col, .3), x + w / 2 - 2, y, 4, h);
  if (o.label) drawText(g, o.label, x + w / 2, y + h / 2 - 5, { size: 11, align: 'c', color: R[4] });
}
export function shelf(g, x, y, w, rows, col = '#6a4a3a', items) {
  const R = rampHex(col), r = new RNG(x + y);
  rect(g, R[0], x - 1, y - 1, w + 2, rows * 16 + 3);
  for (let i = 0; i < rows; i++) {
    const yy = y + i * 16;
    rect(g, R[1], x, yy, w, 15); rect(g, R[3], x, yy + 13, w, 2);
    if (items) for (let k = 2; k < w - 6; k += 5 + (r.next() * 4 | 0)) { const c = items[(r.next() * items.length) | 0], hh = 5 + (r.next() * 7 | 0); rect(g, shade(c, -.4), k + x, yy + 13 - hh, 4, hh); rect(g, c, k + x, yy + 13 - hh, 3, hh - 1); }
  }
}
export function truss(g, x, y, w, col = '#283052') {
  const R = rampHex(col);
  rect(g, R[1], x, y, w, 2); rect(g, R[1], x, y + 10, w, 2);
  for (let xx = 0; xx < w; xx += 12) { line(g, R[2], x + xx, y + 2, x + xx + 6, y + 10); line(g, R[2], x + xx + 6, y + 10, x + xx + 12, y + 2); }
  rect(g, R[3], x, y, w, 1);
}
export function sofa(g, x, y, w, col) {
  const R = rampHex(col);
  rect(g, R[0], x - 1, y - 23, w + 2, 25);
  rect(g, R[1], x, y - 22, w, 12); rect(g, R[2], x + 4, y - 12, w - 8, 7); rect(g, R[3], x + 4, y - 12, w - 8, 1);
  rect(g, R[2], x, y - 22, 6, 18); rect(g, R[2], x + w - 6, y - 22, 6, 18); rect(g, R[3], x + 1, y - 22, 4, 1); rect(g, R[3], x + w - 5, y - 22, 4, 1);
  rect(g, R[1], x + 2, y - 5, w - 4, 4);
  for (let i = 1; i < 3; i++) rect(g, R[1], x + (w * i) / 3, y - 12, 1, 6);
  rect(g, '#1a1424', x + 3, y - 1, 3, 2); rect(g, '#1a1424', x + w - 6, y - 1, 3, 2);
}
export function door(g, x, y, w, h, col, o = {}) {
  const R = rampHex(col);
  rect(g, '#120c1e', x - 3, y - 3, w + 6, h + 3);
  rect(g, o.frame || '#3a3150', x - 2, y - 2, w + 4, h + 2);
  rect(g, R[1], x, y, w, h);
  rect(g, R[2], x + 3, y + 3, w - 6, h * .42); rect(g, R[2], x + 3, y + h * .5, w - 6, h * .44);
  rect(g, R[3], x + 3, y + 3, w - 6, 1);
  if (o.glass) { rect(g, '#22355f', x + 5, y + 6, w - 10, h * .3); rect(g, 'rgba(160,220,255,.25)', x + 6, y + 7, 2, h * .26); }
  rect(g, '#ffd65a', x + w - 6, y + h * .52, 2, 3);
  if (o.sign) { const sw = textWidth(o.sign, 11) + 8; rect(g, '#120c1e', x + w / 2 - sw / 2 - 1, y - 18, sw + 2, 14); rect(g, o.signCol || '#26315f', x + w / 2 - sw / 2, y - 17, sw, 12); drawText(g, o.sign, x + w / 2, y - 16, { size: 11, align: 'c', color: o.signText || '#eef2ff' }); }
}
export function board(g, x, y, w, h, title, lines, o = {}) {
  rect(g, '#120c1e', x - 2, y - 2, w + 4, h + 4); rect(g, o.frame || '#7a5236', x - 1, y - 1, w + 2, h + 2); rect(g, o.bg || '#2c3b30', x, y, w, h);
  dither(g, x, y, w, h, 'rgba(255,255,255,.05)', .3, x);
  if (title) drawText(g, title, x + w / 2, y + 3, { size: 11, align: 'c', color: o.tc || '#ffe9a8' });
  (lines || []).forEach((l, i) => drawText(g, l, x + 5, y + 17 + i * 12, { size: 11, color: '#d9e6dc' }));
}
export function frameArt(g, x, y, w, h, fn) { rect(g, '#120c1e', x - 3, y - 3, w + 6, h + 6); rect(g, '#c9a25a', x - 2, y - 2, w + 4, h + 4); rect(g, '#8a6a3c', x - 1, y - 1, w + 2, h + 2); g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); fn(); g.restore(); }
export function trophy(g, x, y, col = '#ffd65a') {
  const R = rampHex(col);
  rect(g, '#3a2a1a', x - 6, y - 4, 12, 4); rect(g, R[1], x - 2, y - 10, 4, 6);
  ellipse(g, R[2], x, y - 15, 6, 5); rect(g, R[2], x - 6, y - 20, 12, 5); rect(g, R[4], x - 4, y - 19, 2, 6);
  rect(g, R[1], x - 9, y - 18, 3, 6); rect(g, R[1], x + 6, y - 18, 3, 6);
}
export function wave(g, x, y, w, col, amp = 2, ph = 0) { for (let xx = 0; xx < w; xx++) rect(g, col, x + xx, y + Math.round(Math.sin((xx + ph) * .2) * amp), 1, 1); }
