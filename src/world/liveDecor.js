// The parts of a place that follow the career, drawn over the baked backdrop every frame (world space, camera
// applied): in the lobby the champion's poster with the belt holder's face, the top of the ranking, the belts and
// cases you won in the trophy case, and a banner for whatever the gym is talking about today.
import { CHARACTERS } from '../data/characters.js';
import { rect, bands, trophy } from '../render/painter.js';
import { drawText } from '../render/pixelfont.js';
import { drawPortrait } from '../render/head.js';
import { shade } from '../render/palette.js';

function face(g, look, x, y, size, col, expr = 'neutral') {
  rect(g, '#120c1e', x - 1, y - 1, size + 2, size + 2);
  bands(g, x, y, size, size, [shade(col, -.35), shade(col, -.5), shade(col, -.6)]);
  if (look) drawPortrait(g, look, expr, x, y, size, { px: 1, dy: Math.round(size * .12) });
}
function posterAt(g, x, y, w, h, col, top, name, look, o = {}) {
  rect(g, '#120c1e', x - 1, y - 1, w + 2, h + 2);
  bands(g, x, y, w, h, [col, shade(col, -.2), shade(col, -.4)]);
  const fs = w - 8;
  face(g, look, x + 4, y + 13, fs, col, o.expr);
  if (top) drawText(g, top, x + w / 2, y + 1, { size: 11, align: 'c', color: o.topCol || '#ffe27a', outline: '#120c1e' });
  drawText(g, name, x + w / 2, y + h - 12, { size: 11, align: 'c', color: '#fff6dc', outline: '#120c1e' });
}
// the banner over the boards: champion first, then the case, a streak, a new season
function banner(c) {
  const d = c.d;
  if (d.flags.champion) return [`우리 체육관의 챔피언, ${d.name}!`, '#ffd65a', '#7a1f3a'];
  if (d.mitb && d.mitb.holder === 'player') return [`가방의 주인 ${d.name} — 언제든 노린다`, '#9be36b', '#1f3a2a'];
  if (d.record.streak >= 5) return [`${d.name} ${d.record.streak}연승 중!`, '#ff8fc4', '#3a1f4a'];
  if (d.titles.length) return [`전 챔피언 ${d.name}, 다시 정상으로!`, '#c9d4ff', '#26315f'];
  if (d.season >= 2) return [`시즌 ${d.season} 개막 — 야항 레슬링 연맹`, '#49d6ff', '#1a2a4a'];
  return null;
}
export function lobbyLive(g, c, cam) {
  const d = c.d, ox = -Math.round(cam);
  if (ox > 120 || ox < -900) { /* still draw: cheap */ }
  // poster wall right of the office door: the belt holder big, the next three of the ranking small
  const champ = c.champion, me = champ === 'player', ch = CHARACTERS[champ];
  posterAt(g, 372 + ox, 98, 50, 66, me ? '#c9a22e' : ch ? ch.color || '#4a5078' : '#3a3a52', '챔피언', me ? d.name.slice(0, 4) : ch ? ch.name.slice(0, 4) : '공석', me ? c.look() : ch && ch.look, { expr: me ? 'happy' : 'smug' });
  const all = c.rankList(), top = all.filter(e => e.id !== champ).slice(0, 3);
  top.forEach((e, i) => {
    const mine = e.id === 'player', C = CHARACTERS[e.id];
    posterAt(g, 432 + i * 42 + ox, 106, 36, 50, mine ? '#157f8c' : C ? C.color || '#4a5078' : '#3a3a52', `${all.indexOf(e) + 1}위`, mine ? d.name.slice(0, 3) : C ? C.name.slice(0, 3) : '?', mine ? c.look() : C && C.look, { topCol: mine ? '#9be3ff' : '#ffe27a', expr: mine ? 'happy' : 'neutral' });
  });
  // your own shelf in the trophy case: a belt for every title, the case if you won it, cups for weekly finals
  const sx = 144 + ox, sy = 244;
  let x = sx;
  for (let i = 0; i < Math.min(3, d.titles.length); i++, x += 22) { rect(g, '#120c1e', x - 1, sy - 9, 20, 9); rect(g, '#c9a22e', x, sy - 8, 18, 7); rect(g, '#ffe9a8', x + 6, sy - 7, 6, 5); }
  if (d.flags.mitbWon) { rect(g, '#120c1e', x - 1, sy - 11, 16, 11); rect(g, '#2a8a4a', x, sy - 10, 14, 9); rect(g, '#ffd65a', x + 5, sy - 12, 4, 2); x += 18; }
  for (let i = 0; i < Math.min(3, d.flags.weeklyWins || 0); i++, x += 10) trophy(g, x + 4, sy - 2, '#e6e9f2');
  if (x > sx) drawText(g, d.name.slice(0, 4), sx + 30, sy + 2, { size: 11, align: 'c', color: '#ffd65a', outline: '#120c1e' });
  // the ranking board's last line names the belt holder of the day (the board is baked with the old champion)
  rect(g, '#22304a', 795 + ox, 191, 80, 12);
  drawText(g, me ? d.name.slice(0, 6) : ch ? ch.name : '공석', 795 + ox, 191, { size: 11, color: me ? '#ffd65a' : '#d9e6dc' });
  // the banner
  const B = banner(c);
  if (B) {
    const [text, fg, bg] = B, bx = 690 + ox, bw = 188, by = 100;
    rect(g, '#120c1e', bx - 1, by - 1, bw + 2, 18); rect(g, bg, bx, by, bw, 16); rect(g, shade(bg, .2), bx, by, bw, 2);
    rect(g, '#5a5a6a', bx + 8, by - 14, 1, 14); rect(g, '#5a5a6a', bx + bw - 9, by - 14, 1, 14);
    drawText(g, text, bx + bw / 2, by + 3, { size: 11, align: 'c', color: fg });
  }
}
