// Match props: a folding steel chair drawn as a small pixel sprite and rotated without smoothing, with a floor
// shadow and dents that grow with every blow.
import { ellipse } from './painter.js';

const SPR = new Map();
const mk = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));
// 44x80, front view of a folded folding chair: backrest with a handle slot on top, the seat folded flat against the
// frame, two pairs of legs and a foot bar.
function chairSprite(dent) {
  let c = SPR.get(dent);
  if (c) return c;
  c = mk(44, 80);
  const g = c.getContext('2d'), R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const O = '#05060f', F = dent >= 2 ? '#9aa2ba' : '#b9c2dc', FL = '#eef2ff', FD = '#5a6584', P = '#3a4258', PL = '#5e6884', PD = '#262c3e';
  // outline
  R(3, 0, 38, 20, O); R(1, 2, 42, 16, O); R(1, 16, 6, 64, O); R(37, 16, 6, 64, O); R(5, 17, 34, 44, O); R(7, 56, 6, 24, O); R(31, 56, 6, 24, O); R(1, 73, 42, 6, O);
  // backrest with the handle slot
  R(4, 1, 36, 18, P); R(2, 3, 40, 14, P); R(4, 1, 36, 2, PL); R(2, 3, 2, 12, PL); R(40, 3, 2, 12, PD); R(4, 17, 36, 2, PD);
  R(12, 5, 20, 5, O); R(13, 6, 18, 3, '#141824');
  R(6, 12, 6, 3, '#c2333f');
  // outer frame tubes
  R(2, 17, 4, 62, F); R(2, 17, 1, 62, FL); R(5, 17, 1, 62, FD); R(38, 17, 4, 62, F); R(38, 17, 1, 62, FL); R(41, 17, 1, 62, FD);
  // the seat folded up flat
  R(6, 18, 32, 42, P); R(6, 18, 32, 2, PL); R(6, 18, 2, 42, PL); R(36, 18, 2, 42, PD); R(6, 58, 32, 2, PD); R(10, 24, 24, 1, PL); R(10, 50, 24, 1, PD);
  // inner legs and the foot bar
  R(8, 57, 4, 22, F); R(8, 57, 1, 22, FL); R(32, 57, 4, 22, F); R(35, 57, 1, 22, FD);
  R(2, 74, 40, 4, F); R(2, 74, 40, 1, FL); R(2, 77, 40, 1, FD);
  if (dent >= 1) { R(15, 33, 6, 1, PD); R(22, 40, 4, 2, PD); R(39, 40, 2, 3, FD); }
  if (dent >= 2) { R(12, 28, 3, 3, O); R(26, 46, 4, 2, O); R(2, 50, 2, 4, FD); R(18, 2, 5, 2, O); }
  SPR.set(dent, c);
  return c;
}
// Lying on the floor, folded flat: seen from the side, a long low shape.
let FOLD = null;
function foldedSprite() {
  if (FOLD) return FOLD;
  FOLD = mk(80, 12);
  const g = FOLD.getContext('2d'), R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  R(0, 2, 80, 9, '#05060f'); R(2, 0, 18, 2, '#05060f');
  R(1, 3, 78, 7, '#b9c2dc'); R(1, 3, 78, 1, '#eef2ff'); R(1, 9, 78, 1, '#5a6584');
  R(3, 1, 16, 4, '#3a4258'); R(22, 4, 44, 4, '#3a4258'); R(22, 4, 44, 1, '#5e6884');
  R(8, 2, 6, 2, '#c2333f');
  R(0, 10, 4, 2, '#05060f'); R(76, 10, 4, 2, '#05060f');
  return FOLD;
}
export function drawChairAt(g, x, y, rot = 0, face = 1, dent = 0) {
  g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate(rot); if (face < 0) g.scale(-1, 1);
  g.imageSmoothingEnabled = false;
  g.drawImage(chairSprite(dent | 0), -22, -40);
  g.restore();
}
export function drawProps(g, m, camX) {
  const ar = m.arena;
  for (const p of m.props.list) {
    const x = p.x - camX;
    if (x < -40 || x > 680) continue;
    if (p.state !== 'held') {
      const gy = ar.ground(p.x, p.y + 10, p.side), k = Math.max(.25, 1 - (gy - p.y) / 160);
      g.globalAlpha = .35 * k; ellipse(g, '#04030a', Math.round(x), gy, Math.round(26 * k), 2); g.globalAlpha = 1;
    }
    if (p.state === 'floor') { g.imageSmoothingEnabled = false; g.drawImage(foldedSprite(), Math.round(x - 40), Math.round(p.y)); continue; }
    drawChairAt(g, x, p.y, p.rot || 0, p.face || 1, p.dent);
  }
}
