// Match props: a folding steel chair drawn as a small pixel sprite and rotated without smoothing, with a floor
// shadow and dents that grow with every blow.
import { ellipse } from './painter.js';

const SPR = new Map();
const mk = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));
// 40x52, side view: backrest and back legs on the left, the seat reaching right, front legs under it.
function chairSprite(dent) {
  let c = SPR.get(dent);
  if (c) return c;
  c = mk(40, 52);
  const g = c.getContext('2d'), R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const O = '#05060f', M = dent >= 2 ? '#8b93ab' : '#a2acc6', L = '#eef2ff', D = '#5a6584', DD = '#3a4258';
  const parts = [[5, 1, 12, 21], [8, 21, 5, 29], [9, 25, 27, 5], [29, 30, 5, 20], [12, 40, 19, 3]];
  for (const [x, y, w, h] of parts) R(x - 1, y - 1, w + 2, h + 2, O);
  // backrest panel with a red stripe and rivets
  R(5, 1, 12, 21, M); R(5, 1, 12, 2, L); R(5, 1, 2, 21, L); R(15, 1, 2, 21, D); R(5, 20, 12, 2, D);
  R(8, 6, 6, 4, '#c2333f'); R(8, 6, 6, 1, '#ff6b78'); R(7, 13, 8, 1, DD); R(7, 16, 8, 1, DD);
  R(6, 3, 1, 1, DD); R(15, 3, 1, 1, O); R(6, 19, 1, 1, DD);
  // back post running down into the back leg
  R(8, 21, 5, 29, M); R(8, 21, 1, 29, L); R(12, 21, 1, 29, D);
  // seat
  R(9, 25, 27, 5, M); R(9, 25, 27, 2, L); R(9, 29, 27, 1, D); R(11, 27, 23, 1, '#c4ccdf');
  // front leg and the cross brace
  R(29, 30, 5, 20, M); R(29, 30, 1, 20, L); R(33, 30, 1, 20, D);
  R(12, 40, 19, 3, D); R(12, 40, 19, 1, M);
  // rubber feet
  R(6, 49, 8, 3, O); R(27, 49, 8, 3, O);
  if (dent >= 1) { R(19, 26, 4, 1, DD); R(9, 10, 3, 1, DD); R(30, 36, 1, 3, DD); }
  if (dent >= 2) { R(23, 25, 3, 2, O); R(6, 12, 4, 1, O); R(10, 31, 1, 4, O); R(26, 41, 2, 2, O); }
  SPR.set(dent, c);
  return c;
}
// Folded flat, as it lies on the floor.
let FOLD = null;
function foldedSprite() {
  if (FOLD) return FOLD;
  FOLD = mk(46, 11);
  const g = FOLD.getContext('2d'), R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  R(0, 1, 46, 9, '#05060f'); R(1, 0, 44, 1, '#05060f');
  R(1, 1, 44, 7, '#a2acc6'); R(1, 1, 44, 2, '#eef2ff'); R(1, 7, 44, 1, '#5a6584'); R(2, 4, 42, 1, '#7a84a0');
  R(5, 2, 10, 3, '#c2333f');
  R(0, 9, 5, 2, '#05060f'); R(41, 9, 5, 2, '#05060f'); R(20, 9, 6, 1, '#05060f');
  return FOLD;
}
export function drawChairAt(g, x, y, rot = 0, face = 1, dent = 0) {
  g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate(rot); if (face < 0) g.scale(-1, 1);
  g.imageSmoothingEnabled = false;
  g.drawImage(chairSprite(dent | 0), -20, -26);
  g.restore();
}
export function drawProps(g, m, camX) {
  const ar = m.arena;
  for (const p of m.props.list) {
    const x = p.x - camX;
    if (x < -40 || x > 680) continue;
    if (p.state !== 'held') {
      const gy = ar.ground(p.x, p.y + 10, p.side), k = Math.max(.25, 1 - (gy - p.y) / 160);
      g.globalAlpha = .35 * k; ellipse(g, '#04030a', Math.round(x), gy, Math.round(18 * k), 2); g.globalAlpha = 1;
    }
    if (p.state === 'floor') { g.imageSmoothingEnabled = false; g.drawImage(foldedSprite(), Math.round(x - 23), Math.round(p.y + 1)); continue; }
    drawChairAt(g, x, p.y, p.rot || 0, p.face || 1, p.dent);
  }
}
