// Special-match structures: the steel cage round the ring, the cell round the whole floor, the ladder and the case
// hanging over the ring. Mesh walls are baked once per arena; the ladder and the case are drawn every frame.
import { rect, line, glow } from './painter.js';
import { BALANCE as B } from '../data/balance.js';
import { J } from '../anim/skeleton.js';

const mk = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));
const cache = new WeakMap();
// chain link: two diagonal dot lattices
function mesh(g, x0, y0, x1, y1, col, step, clip) {
  g.fillStyle = col;
  for (let y = Math.floor(y0); y < y1; y++) {
    const r = clip ? clip(y) : [x0, x1];
    for (let x = Math.floor(r[0]); x < r[1]; x++) { const a = ((x + y) % step + step) % step, b = ((x - y) % step + step) % step; if (a === 0 || b === 0) g.fillRect(x, y, 1, 1); }
  }
}
function bake(ar, kind) {
  const key = kind, all = cache.get(ar) || {};
  if (all[key]) return all[key];
  const W = ar.x1 + 40, back = ar.matY - 22, front = ar.matY + 16, L = ar.ropeL, R = ar.ropeR;
  const bk = mk(W, 360), fr = mk(W, 360), gb = bk.getContext('2d'), gf = fr.getContext('2d');
  const steel = '#9aa6c6', dark = '#3a4258', rail = '#c9d4ff';
  if (kind === 'cage') {
    const H = B.cageH + 10, topB = back - H * .92, topF = front - H;
    // back wall and the two side walls behind the wrestlers
    mesh(gb, L + 12, topB, R - 12, back - 1, 'rgba(154,166,198,.42)', 6);
    for (const [xb, xf] of [[L + 14, L - 10], [R - 14, R + 10]]) {
      mesh(gb, Math.min(xb, xf) - 2, topB, Math.max(xb, xf) + 2, front, 'rgba(154,166,198,.34)', 6, y => { const k = Math.max(0, Math.min(1, (y - topB) / (front - topB))); const xm = xb + (xf - xb) * k; return [Math.min(xb, xm) - 1, Math.max(xb, xm) + 1]; });
      line(gb, rail, xb, topB, xf, topF, 2);
      rect(gb, '#06070e', xb - 2, topB, 4, back - topB); rect(gb, dark, xb - 1, topB, 2, back - topB);
    }
    rect(gb, '#06070e', L + 12, topB - 2, R - L - 24, 4); rect(gb, rail, L + 12, topB - 1, R - L - 24, 2);
    // the front: thin bars, a top rail and a middle rail, light enough to see the match through
    for (let x = L - 10; x <= R + 10; x += 12) { gf.fillStyle = 'rgba(154,166,198,.26)'; gf.fillRect(x, topF, 1, front - topF); }
    for (const y of [topF, Math.round((topF + front) / 2)]) { rect(gf, 'rgba(6,7,14,.8)', L - 12, y - 1, R - L + 24, 4); rect(gf, steel, L - 12, y, R - L + 24, 2); }
    for (const x of [L - 10, R + 10]) { rect(gf, '#06070e', x - 3, topF, 6, front - topF + 2); rect(gf, steel, x - 2, topF, 4, front - topF + 2); rect(gf, rail, x - 2, topF, 1, front - topF + 2); }
    line(gf, rail, L - 10, topF, L + 14, topB, 2); line(gf, rail, R + 10, topF, R - 14, topB, 2);
  } else if (kind === 'cell') {
    const top = 44, x0 = ar.x0 + 6, x1 = ar.x1 - 6, wallBack = ar.matY - 70;
    mesh(gb, x0, top, x1, wallBack, 'rgba(160,60,60,.3)', 7);
    for (const x of [x0, x1]) { mesh(gb, x - 10, top, x + 10, ar.floorY, 'rgba(180,90,90,.42)', 6); rect(gb, '#06070e', x - 3, top, 6, ar.floorY - top); rect(gb, '#7a3a3a', x - 2, top, 4, ar.floorY - top); }
    rect(gb, '#06070e', x0, top - 3, x1 - x0, 6); rect(gb, '#b85a5a', x0, top - 2, x1 - x0, 3);
    for (let x = x0; x < x1; x += 70) line(gb, 'rgba(184,90,90,.6)', x, top, x + 35, top + 18, 1);
    for (let x = x0; x <= x1; x += 14) { gf.fillStyle = 'rgba(184,110,110,.22)'; gf.fillRect(x, top, 1, ar.floorY - top); }
    for (const y of [top, Math.round((top + ar.floorY) / 2)]) { rect(gf, 'rgba(6,7,14,.8)', x0, y - 1, x1 - x0, 4); rect(gf, '#b85a5a', x0, y, x1 - x0, 2); }
  }
  all[key] = { bk, fr };
  cache.set(ar, all);
  return all[key];
}
// behind the wrestlers
export function drawSpecialBack(g, m, camX) {
  const S = m.special, ar = m.arena;
  if (!S || !S.type) return;
  if (S.type === 'cage' || S.type === 'cell') g.drawImage(bake(ar, S.type).bk, -Math.round(camX), 0);
  if (S.type === 'cell') { g.globalAlpha = .12; rect(g, '#3a0a14', 0, 0, 640, 360); g.globalAlpha = 1; }
  if (S.ladder) { drawCase(g, S, m, camX); drawLadder(g, S.ladder, ar, camX); }
}
// over the wrestlers
export function drawSpecialFront(g, m, camX) {
  const S = m.special, ar = m.arena;
  if (!S || !S.type) return;
  if (S.type === 'cage' || S.type === 'cell') g.drawImage(bake(ar, S.type).fr, -Math.round(camX), 0);
  // how far up the climbers are
  for (const f of m.fighters) {
    if ((f.st !== 'LADDER' && f.st !== 'CAGE_CLIMB') || !f.climb) continue;
    const x = Math.round(f.x - camX) + f.climb.side * 16, y = Math.round(f.y - 70), h = 46;
    rect(g, '#06070e', x - 2, y - 1, 5, h + 2); rect(g, '#1b2450', x - 1, y, 3, h);
    const k = f.climb.over != null ? 1 : f.climb.p, col = f.climb.over != null ? '#ff8a2b' : f.climb.rock > 0 ? '#ff5b5b' : '#ffd65a';
    rect(g, col, x - 1, y + h - Math.round(h * Math.min(1, k)), 3, Math.round(h * Math.min(1, k)));
  }
}
// A folding A-frame ladder: lying folded, rising (stood up, then its legs spread), open, or folding and toppling over.
function drawLadder(g, L, ar, camX) {
  const x = Math.round(L.x - camX), base = ar.matY, H = B.ladderH + 14, sp0 = B.ladderSpread + 6, k = L.k;
  const rot = k < .5 ? (1 - k / .5) * 90 * L.dir : 0, spread = k > .5 ? (k - .5) / .5 * sp0 : 0;
  g.save(); g.translate(x, base); g.rotate(rot * Math.PI / 180);
  const O = '#06070e', M = '#c9d0dc', ML = '#eef2f8', MD = '#8a94a6', HB = '#3a6ac4';
  const seg = (x0, y0, x1, y1, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  // one half: a near rail, a far rail a little up and back, rungs between them
  const half = (dir, near) => {
    const bx = dir * spread, tx = dir * 3, dx = near ? 0 : 4, dy = near ? 0 : -3;
    seg(bx + dx, dy, tx + dx, -H + dy, near ? 4 : 3, O);
    seg(bx + dx, dy, tx + dx, -H + dy, near ? 2 : 1.4, near ? M : MD);
    if (near) seg(bx + dx - dir * .8, dy, tx + dx - dir * .8, -H + dy, .7, ML);
  };
  const rungs = dir => {
    for (let i = 1; i < 9; i++) {
      const t = i / 9, y = -H * t, rx = dir * spread * (1 - t) + dir * 3 * t;
      g.fillStyle = O; g.fillRect(rx - 1, y - 2, 6, 4); g.fillStyle = MD; g.fillRect(rx, y - 1, 4, 2); g.fillStyle = ML; g.fillRect(rx, y - 1, 4, 1);
    }
  };
  for (const d of [1, -1]) { half(d, false); rungs(d); half(d, true); }
  // the cap and its hinge clips, rubber feet
  g.fillStyle = O; g.fillRect(-7, -H - 5, 14, 7); g.fillStyle = '#5e6884'; g.fillRect(-6, -H - 4, 12, 5); g.fillStyle = '#8a94b4'; g.fillRect(-6, -H - 4, 12, 1);
  g.fillStyle = HB; g.fillRect(-8, -H + 2, 4, 5); g.fillRect(4, -H + 2, 4, 5);
  g.fillStyle = O; g.fillRect(-spread - 3, -2, 6, 3); g.fillRect(spread - 3, -2, 6, 3);
  g.restore();
}
function drawCase(g, S, m, camX) {
  const P = S.prize;
  if (P.taken) {   // up in the winner's hands
    const f = P.taken, hx = (f.joints.x(J.hN) + f.joints.x(J.hF)) / 2 - camX, hy = Math.min(f.joints.y(J.hN), f.joints.y(J.hF));
    caseAt(g, Math.round(hx), Math.round(hy) - 6);
    return;
  }
  const px = Math.round(P.x - camX + Math.sin(P.sway * 1.3) * 2), py = Math.round(P.y);
  line(g, '#5e6884', px, 0, px, py - 10, 1);
  glow(g, px, py, 22, '#ffd65a', .25 + Math.sin(P.sway * 4) * .08 + P.hits / P.need * .25);
  caseAt(g, px, py);
  // how far it has been worked loose: the count stays with the case
  const n = P.need, w = n * 4 - 1, x0 = px - (w >> 1);
  rect(g, '#06070e', x0 - 2, py + 11, w + 4, 6);
  for (let i = 0; i < n; i++) rect(g, i < P.hits ? '#ffd65a' : '#2a3150', x0 + i * 4, py + 12, 3, 4);
}
function caseAt(g, px, py) {
  rect(g, '#06070e', px - 12, py - 9, 24, 17); rect(g, '#6a4422', px - 11, py - 8, 22, 15); rect(g, '#8a5a2e', px - 11, py - 8, 22, 2); rect(g, '#4a2e16', px - 11, py + 5, 22, 2);
  rect(g, '#ffd65a', px - 3, py - 3, 6, 4); rect(g, '#06070e', px - 1, py - 2, 2, 2);
  rect(g, '#06070e', px - 5, py - 12, 10, 4); rect(g, '#2a1a0c', px - 4, py - 11, 8, 2);
}
