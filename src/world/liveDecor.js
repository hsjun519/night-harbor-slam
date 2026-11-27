// The parts of a place that follow the career, drawn over the baked backdrop every frame (world space, camera
// applied): in the lobby the champion's poster with the belt holder's face, the top of the ranking, the belts and
// cases you won in the trophy case, and a banner for whatever the gym is talking about today.
import { CHARACTERS } from '../data/characters.js';
import { rect, bands, trophy } from '../render/painter.js';
import { drawText } from '../render/pixelfont.js';
import { drawPortrait } from '../render/head.js';
import { shade } from '../render/palette.js';
import { OW } from './CareerManager.js';

// the street: once 선항 레슬링 hit the port, the dome door is taped off and its sign hangs broken
export function streetLive(g, c, cam) {
  const d = c.d, ox = -Math.round(cam);
  if (!(d.ow && OW.damaged.includes(d.ow.state))) return;
  const x = 2140 + ox;
  if (x < -200 || x > 900) return;
  for (let i = 0; i < 3; i++) { rect(g, '#ffd65a', x - 14, 214 + i * 26, 70, 4); for (let k = 0; k < 70; k += 10) rect(g, '#1a1a1a', x - 14 + k, 214 + i * 26, 5, 4); }
  rect(g, '#120c1e', x - 18, 168, 76, 16); rect(g, '#c2333f', x - 17, 169, 74, 14); drawText(g, d.ow.state === 'REBUILD' ? '재건 공사 중' : '수리 중', x + 20, 170, { size: 11, align: 'c', color: '#ffffff' });
  for (const [dx, w, h] of [[-60, 18, 8], [-38, 10, 6], [70, 22, 9], [96, 12, 5]]) { rect(g, '#120c1e', x + dx - 1, 300 - h - 1, w + 2, h + 1); rect(g, '#6a6a7a', x + dx, 300 - h, w, h); }
}
// the basement on a title night: a banner over the cage
export function basementLive(g, c, cam) {
  const d = c.d, ox = -Math.round(cam);
  if (!(d.ow && OW.damaged.includes(d.ow.state))) return;
  const x = 440 + ox;
  rect(g, '#120c1e', x - 1, 98, 202, 18); rect(g, '#5a1a1a', x, 99, 200, 16); drawText(g, '지하 챔피언십', x + 100, 101, { size: 11, align: 'c', color: '#ffd65a' });
}
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
  // after a lost LOBBY BRAWL: cracked frames, a toppled plant, debris and the gym door taped off
  if (d.br && d.br.lobby === 'damaged') {
    for (let i = 0; i < 4; i++) { const px = 372 + i * 46 + ox; rect(g, 'rgba(10,8,16,.55)', px, 100 + (i % 2) * 6, 40, 58); rect(g, '#d9e6dc', px + 6, 112 + i * 3, 26, 1); rect(g, '#d9e6dc', px + 14, 104 + i * 4, 1, 30); }
    rect(g, '#8a4a3a', 1000 + ox, 292, 16, 8); for (const [dx, w] of [[18, 10], [30, 6]]) rect(g, '#3f9a5a', 1000 + dx + ox, 294, w, 4);
    for (const [x, w, h, col] of [[300, 18, 6, '#6a4a3a'], [470, 12, 5, '#9aa4c0'], [700, 22, 7, '#5a3a2a'], [850, 14, 5, '#9aa4c0'], [930, 20, 6, '#3a6a8c']]) { rect(g, '#120c1e', x - 1 + ox, 300 - h - 1, w + 2, h + 1); rect(g, col, x + ox, 300 - h, w, h); }
    const gx = 564 + ox;
    for (let i = 0; i < 3; i++) { rect(g, '#ffd65a', gx - 6, 218 + i * 26, 48, 4); for (let k = 0; k < 48; k += 8) rect(g, '#1a1a1a', gx - 6 + k, 218 + i * 26, 4, 4); }
    rect(g, '#120c1e', gx - 8, 182, 52, 14); rect(g, '#c2333f', gx - 7, 183, 50, 12); drawText(g, '보수 중', gx + 18, 183, { size: 11, align: 'c', color: '#ffffff' });
  }
  // the banner
  const B = banner(c);
  if (B) {
    const [text, fg, bg] = B, bx = 690 + ox, bw = 188, by = 100;
    rect(g, '#120c1e', bx - 1, by - 1, bw + 2, 18); rect(g, bg, bx, by, bw, 16); rect(g, shade(bg, .2), bx, by, bw, 2);
    rect(g, '#5a5a6a', bx + 8, by - 14, 1, 14); rect(g, '#5a5a6a', bx + bw - 9, by - 14, 1, 14);
    drawText(g, text, bx + bw / 2, by + 3, { size: 11, align: 'c', color: fg });
  }
}
