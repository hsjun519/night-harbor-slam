// Match props: a folding steel chair drawn as a small pixel sprite and rotated without smoothing, with a floor
// shadow and dents that grow with every blow.
import { ellipse } from './painter.js';

const SPR = new Map();
function chairSprite(dent) {
  let c = SPR.get(dent);
  if (c) return c;
  c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(26, 34) : Object.assign(document.createElement('canvas'), { width: 26, height: 34 });
  const g = c.getContext('2d');
  const O = '#05060f', M = dent >= 2 ? '#8b93ab' : '#9aa4c0', L = '#e2e8fa', D = '#5a6584';
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const parts = [[4, 1, 7, 11], [6, 11, 3, 21], [6, 17, 15, 3], [18, 19, 3, 13], [8, 25, 11, 2]];  // backrest, back post, seat, front leg, brace
  for (const [x, y, w, h] of parts) R(x - 1, y - 1, w + 2, h + 2, O);
  R(4, 1, 7, 11, M); R(4, 1, 7, 1, L); R(4, 1, 1, 11, L); R(10, 1, 1, 11, D); R(4, 11, 7, 1, D);
  R(5, 4, 5, 2, '#c2333f');
  R(6, 11, 3, 21, M); R(6, 11, 1, 21, L); R(8, 11, 1, 21, D);
  R(6, 17, 15, 3, M); R(6, 17, 15, 1, L); R(6, 19, 15, 1, D);
  R(18, 19, 3, 13, M); R(18, 19, 1, 13, L); R(20, 19, 1, 13, D);
  R(8, 25, 11, 1, M); R(8, 26, 11, 1, D);
  R(5, 31, 5, 2, O); R(17, 31, 5, 2, O);
  if (dent >= 1) { R(11, 18, 3, 1, D); R(7, 7, 2, 1, D); }
  if (dent >= 2) { R(14, 17, 2, 2, O); R(5, 9, 3, 1, O); R(19, 24, 1, 3, O); }
  SPR.set(dent, c);
  return c;
}
export function drawChairAt(g, x, y, rot = 0, face = 1, dent = 0) {
  g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate(rot); if (face < 0) g.scale(-1, 1);
  g.imageSmoothingEnabled = false;
  g.drawImage(chairSprite(dent | 0), -13, -17);
  g.restore();
}
export function drawProps(g, m, camX) {
  const ar = m.arena;
  for (const p of m.props.list) {
    const x = p.x - camX;
    if (x < -40 || x > 680) continue;
    if (p.state !== 'held') {
      const gy = ar.ground(p.x, p.y + 10, p.side), k = Math.max(.25, 1 - (gy - p.y) / 160);
      g.globalAlpha = .35 * k; ellipse(g, '#04030a', Math.round(x), gy, Math.round(12 * k), 2); g.globalAlpha = 1;
    }
    drawChairAt(g, x, p.y, p.rot || 0, p.face || 1, p.dent);
  }
}
