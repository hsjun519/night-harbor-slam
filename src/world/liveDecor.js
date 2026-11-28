// The parts of a place that follow the career, drawn over the baked backdrop every frame (world space, camera
// applied): in the lobby the champion's poster with the belt holder's face, the top of the ranking, the belts and
// cases you won in the trophy case, and a banner for whatever the gym is talking about today.
import { CHARACTERS } from '../data/characters.js';
import { rect, bands, trophy, poly, glow } from '../render/painter.js';
import { drawText } from '../render/pixelfont.js';
import { drawPortrait } from '../render/head.js';
import { shade } from '../render/palette.js';
import { OW } from './CareerManager.js';
import { HARBOR, pierStage, harborRatio, worldReady } from './harbor.js';

// the street: once 선항 레슬링 hit the port, the dome door is taped off and its sign hangs broken; past the dome,
// the old passenger pier (broken, then cleared, rebuilt step by step as the fund grows, then lit and flagged, and a
// ship at its end once the world calls). W: the town scene, for the cutscene effects (sunset, belt, waves, ships).
export function streetLive(g, c, cam, W) {
  const d = c.d, ox = -Math.round(cam);
  if (d.ow && OW.damaged.includes(d.ow.state)) {
    const x = 2140 + ox;
    if (x > -200 && x < 900) {
      for (let i = 0; i < 3; i++) { rect(g, '#ffd65a', x - 14, 214 + i * 26, 70, 4); for (let k = 0; k < 70; k += 10) rect(g, '#1a1a1a', x - 14 + k, 214 + i * 26, 5, 4); }
      rect(g, '#120c1e', x - 18, 168, 76, 16); rect(g, '#c2333f', x - 17, 169, 74, 14); drawText(g, d.ow.state === 'REBUILD' ? '재건 공사 중' : '수리 중', x + 20, 170, { size: 11, align: 'c', color: '#ffffff' });
      for (const [dx, w, h] of [[-60, 18, 8], [-38, 10, 6], [70, 22, 9], [96, 12, 5]]) { rect(g, '#120c1e', x + dx - 1, 300 - h - 1, w + 2, h + 1); rect(g, '#6a6a7a', x + dx, 300 - h, w, h); }
    }
  }
  if (PIER.x0 + ox < 680) pier(g, d, ox, cam, W);
}
// ---- the pier ----
export const PIER = { x0: 2286, x1: 2780, deck: 300, dh: 22, gap: [2400, 2520], mid: [2520, 2640], far: 2640 };
// a plank at x: 0 missing, 1 old, 2 new
export function plankAt(x, st) {
  const P = PIER, i = Math.floor((x - P.x0) / 6), gap = x >= P.gap[0] && x < P.gap[1], mid = x >= P.mid[0] && x < P.mid[1], far = x >= P.far;
  if (st >= 4) return 2;
  if (st === 3) return x < P.gap[0] ? (i % 5 === 3 ? 2 : 1) : 2;
  if (st === 2) { if (far) return 0; if (gap) return 2; if (mid) return i % 3 === 1 ? 2 : 1; return i % 5 === 3 ? 2 : 1; }
  if (gap || far) return 0;
  if (mid) return i % 3 === 1 ? 0 : 1;
  return i % 5 === 3 ? 0 : 1;
}
const FLAGS = ['#c2333f', '#2d63b8', '#3fd46b', '#ffd65a', '#ff8fc4', '#f2efe4'];
function pier(g, d, ox, cam, W) {
  const P = PIER, st = pierStage(d), fx = (W && W.cineFx) || {}, t = W ? W.t : 0, sl = W && W.skyOver != null ? W.skyOver : d.slot;
  // the sunset on the water (the far sea sits behind the open pier)
  if (sl === 1) { const sx = Math.round(1100 - cam * .4), lo = P.x0 + ox; for (let y = 238; y < 298; y += 3) { const w = 6 + ((y * 7 + Math.floor(t * 6)) % 13), j = Math.round(Math.sin(y * .7 + t * 3) * 6), x = sx + j - w / 2; if (x >= lo) rect(g, y % 2 ? '#ffb347' : '#ffd08a', x, y, w, 1); } }
  if (fx.ships) farShips(g, cam, t - (fx.shipsT || t));
  const shipOn = st === 4 && (fx.ship || (worldReady(d) && d.harbor.called));
  if (shipOn) ship(g, ox, fx.shipGoT != null ? t - fx.shipGoT : -1, t);
  // the deck: planks, the front beam, and the pilings under it
  for (let x = P.x0; x < P.x1; x += 6) {
    const k = plankAt(x, st);
    if (!k) continue;
    const odd = Math.floor(x / 6) % 2;
    rect(g, '#1a1410', x + ox, P.deck, 6, P.dh); rect(g, k === 2 ? (odd ? '#a8835a' : '#b48e62') : (odd ? '#5a4a3e' : '#4e4036'), x + ox, P.deck, 5, P.dh);
    if (k === 1 && x % 30 === 0) rect(g, '#3a2e26', x + ox + 1, P.deck + 7, 3, 2);
    rect(g, k === 2 ? '#6a4a2e' : '#33281f', x + ox, P.deck + P.dh, 6, 7);
  }
  for (let x = P.x0 + 14; x < P.x1; x += 40) {
    const bad = st < 2 && ((x > P.gap[0] && x < P.gap[1]) || x > P.far), top = P.deck + P.dh + 7, h = bad ? 8 + (x % 3) * 5 : 31;
    rect(g, '#0e0a08', x + ox - 1, top, 8, h); rect(g, st >= 3 && !bad ? '#5a4030' : '#3a2a22', x + ox, top, 6, h);
  }
  if (st <= 1) {
    // the collapsed span, sliding into the water
    poly(g, '#3a2e26', [[P.gap[0] + 4 + ox, 302], [P.gap[0] + 62 + ox, 322], [P.gap[0] + 62 + ox, 334], [P.gap[0] + 4 + ox, 314]]);
    for (let k = 0; k < 9; k++) rect(g, '#1a1410', P.gap[0] + 10 + k * 6 + ox, 304 + k * 2, 1, 10);
    poly(g, '#4e4036', [[P.gap[1] - 50 + ox, 326], [P.gap[1] - 4 + ox, 304], [P.gap[1] - 4 + ox, 314], [P.gap[1] - 50 + ox, 336]]);
    if (st === 0) for (const [x, y, w] of [[2560, 338, 14], [2610, 346, 9], [2700, 340, 18], [2750, 350, 8]]) { const b = Math.round(Math.sin(t * 1.6 + x) * 1.5); rect(g, '#0e0a08', x + ox - 1, y + b - 1, w + 2, 4); rect(g, '#5a4a3e', x + ox, y + b, w, 2); }
  }
  // scaffolding where they are working
  if (st === 1 || st === 2) {
    const [a, b] = st === 1 ? P.gap : [P.far, P.x1 - 10];
    for (let x = a + 6; x < b; x += 38) rect(g, '#8a94b0', x + ox, 262, 2, 68);
    for (const y of [270, 292]) rect(g, '#8a94b0', a + 6 + ox, y, b - a - 10, 2);
    rect(g, '#ffd65a', a + 20 + ox, 256, 34, 8); drawText(g, '공사', a + 37 + ox, 255, { size: 11, align: 'c', color: '#1a1a1a' });
  }
  // lamp posts go up when the deck is down; flags, rails and lights when it is open
  if (st >= 3) for (const x of [2380, 2520, 2660]) {
    rect(g, '#05060f', x + ox - 1, 238, 5, 62); rect(g, '#3a3a52', x + ox, 238, 3, 62); rect(g, '#3a3a52', x + ox - 5, 236, 13, 3);
    if (st === 4) { rect(g, '#ffe0a0', x + ox - 4, 239, 11, 2); glow(g, x + ox + 1, 242, sl === 2 ? 46 : 22, '#ffe0a0', sl === 2 ? .35 : .16); }
  }
  if (st === 4) {
    for (let x = P.x0 + 6; x < P.x1; x += 32) { rect(g, '#05060f', x + ox - 1, 283, 5, 17); rect(g, '#8a6a4a', x + ox, 284, 3, 16); }
    for (let x = P.x0 + 6; x < P.x1 - 6; x += 2) rect(g, '#c9b48a', x + ox, 287 + Math.round(Math.sin((x - P.x0) / 32 * Math.PI) * 2), 2, 1);
    FLAGS.forEach((col, i) => {
      const x = 2330 + i * 72 + ox; rect(g, '#05060f', x - 1, 208, 4, 92); rect(g, '#c9ccd8', x, 208, 2, 92);
      for (let k = 0; k < 16; k++) { const y = 210 + Math.round(Math.sin(t * 3 + i + k * .45) * 2 * (k / 16)); rect(g, k < 2 ? shade(col, -.2) : col, x + 2 + k, y, 1, 11); }
    });
    rect(g, '#120c1e', 2338 + ox, 226, 62, 16); rect(g, '#1f6a8a', 2339 + ox, 227, 60, 14); drawText(g, '국제 부두', 2369 + ox, 227, { size: 11, align: 'c', color: '#ffffff' });
  } else {
    // the barrier across the pier
    const bx = HARBOR.x + 8 + ox;
    for (const dx of [0, 34]) { rect(g, '#05060f', bx + dx - 1, 272, 4, 28); rect(g, '#8a6a4a', bx + dx, 272, 2, 28); }
    rect(g, '#05060f', bx - 5, 270, 46, 8); for (let k = 0; k < 44; k += 8) rect(g, k % 16 ? '#1a1a1a' : '#ffd65a', bx - 4 + k, 271, 8, 6);
    rect(g, '#120c1e', bx - 2, 250, 40, 16); rect(g, '#c2333f', bx - 1, 251, 38, 14); drawText(g, st ? '공사 중' : '출입 금지', bx + 18, 251, { size: 11, align: 'c', color: '#ffffff' });
  }
  // the sign (once 고동 has sailed away): "명성을 모으고 부두를 고쳐 세계로 진출하라", and how full the fund is
  if (d.harbor) {
    const sx = HARBOR.x - 22 + ox;
    rect(g, '#05060f', sx - 1, 250, 4, 50); rect(g, '#6a4a2e', sx, 250, 2, 50);
    rect(g, '#05060f', sx - 23, 222, 48, 32); rect(g, '#d8c8a0', sx - 22, 223, 46, 30); rect(g, '#8a6a4a', sx - 22, 223, 46, 2);
    drawText(g, '세계로', sx + 1, 226, { size: 11, align: 'c', color: '#3a2418' });
    rect(g, '#3a2418', sx - 17, 243, 36, 5); rect(g, '#3fd46b', sx - 16, 244, Math.round(34 * harborRatio(d)), 3);
  }
  // A NEW WAVE: bigger waves, spray at the pier's end, and the light on the belt
  if (fx.waves) {
    const k = Math.min(1, (t - (fx.wavesT || t)) / 2);
    for (let x = P.x0; x < P.x1; x += 3) { const y = 291 + Math.round(Math.sin(x * .045 + t * 2.4) * 2 * (1 + k)); rect(g, '#bfe6ff', x + ox, y, 2, 1); if ((x + Math.floor(t * 20)) % 23 === 0) rect(g, '#ffffff', x + ox, y - 1, 2, 1); }
    for (let i = 0; i < 14; i++) { const ph = (t * .9 + i * .23) % 1, px = P.x1 - 18 - i * 3 + ox, py = 296 - Math.sin(ph * Math.PI) * (18 + i * 2) * k; rect(g, sl === 1 ? '#ffe9c8' : '#e6f6ff', px, py, 2, 2); }
  }
}
// drawn over the people: the champion's belt catching the sunset (A NEW WAVE)
export function streetTop(g, c, cam, W) {
  const d = c.d, fx = (W && W.cineFx) || {};
  if (!fx.belt || !W || !W.player || !(d.flags.champion || (d.titles || []).length)) return;
  const J = W.player.joints, t = W.t, bx = Math.round(J.x(0)) - Math.round(cam), by = Math.round(J.y(0)) - 2, k = .6 + Math.sin(t * 5) * .4;
  rect(g, '#120c1e', bx - 13, by - 4, 26, 8); rect(g, '#c9a22e', bx - 12, by - 3, 24, 6); rect(g, '#120c1e', bx - 6, by - 6, 12, 12); rect(g, '#ffe9a8', bx - 5, by - 5, 10, 10); rect(g, '#c9a22e', bx - 3, by - 3, 6, 6);
  glow(g, bx, by, 40, '#ffd65a', .5 * k);
  rect(g, '#fff6d0', bx - Math.round(9 * k), by, Math.round(18 * k) + 1, 1); rect(g, '#fff6d0', bx, by - Math.round(9 * k), 1, Math.round(18 * k) + 1);
}
// ships under other flags far out on the horizon, coming in (A NEW WAVE)
function farShips(g, cam, dt) {
  for (let i = 0; i < 3; i++) {
    const x = Math.round(1180 + i * 150 - cam * .4 - dt * (5 + i)), y = 238 - (i === 1 ? 2 : 0), w = 30 + i * 6;
    rect(g, '#1a1f3a', x, y, w, 5); rect(g, '#1a1f3a', x + 4, y + 5, w - 8, 2); rect(g, '#1a1f3a', x + w / 2 - 1, y - 18, 2, 18);
    poly(g, '#2a2f4a', [[x + w / 2 + 1, y - 17], [x + w / 2 + 12, y - 4], [x + w / 2 + 1, y - 4]]);
    rect(g, FLAGS[(i * 2 + 1) % FLAGS.length], x + w / 2 + 1, y - 22, 6, 4);
  }
}
// the ship to the world at the end of the pier; go: seconds since it cast off (-1: moored)
function ship(g, ox, go, t) {
  const dx = go > 0 ? Math.round(go * go * 8 + go * 12) : 0, x0 = 2508 + ox + dx, y0 = 298;
  if (x0 > 700) return;
  poly(g, '#05060f', [[x0 - 3, y0 - 51], [x0 + 303, y0 - 51], [x0 + 288, y0 + 2], [x0 + 17, y0 + 2]]);
  poly(g, '#e8e4d8', [[x0, y0 - 48], [x0 + 298, y0 - 48], [x0 + 285, y0], [x0 + 20, y0]]);
  rect(g, '#c2333f', x0 + 10, y0 - 14, 280, 5); rect(g, '#1d2148', x0 + 22, y0 - 7, 262, 7);
  for (let i = 0; i < 10; i++) rect(g, (i + Math.floor(t)) % 4 ? '#2a3150' : '#ffd27a', x0 + 36 + i * 24, y0 - 34, 5, 5);
  drawText(g, '새벽 파도호', x0 + 226, y0 - 44, { size: 11, align: 'c', color: '#1d2148' });
  rect(g, '#05060f', x0 + 79, y0 - 95, 132, 48); rect(g, '#f2efe4', x0 + 80, y0 - 94, 130, 46);
  for (let i = 0; i < 6; i++) rect(g, '#49d6ff', x0 + 88 + i * 20, y0 - 84, 12, 8);
  rect(g, '#05060f', x0 + 109, y0 - 115, 72, 22); rect(g, '#f2efe4', x0 + 110, y0 - 114, 70, 20); for (let i = 0; i < 4; i++) rect(g, '#1d2148', x0 + 116 + i * 16, y0 - 108, 10, 6);
  rect(g, '#05060f', x0 + 219, y0 - 141, 28, 48); rect(g, '#ffd65a', x0 + 220, y0 - 140, 26, 46); rect(g, '#1d2148', x0 + 220, y0 - 140, 26, 8);
  rect(g, '#3a3a52', x0 + 50, y0 - 156, 3, 108);
  for (let k = 0; k < 9; k++) { const fx = x0 + 52 - k * 5, fy = y0 - 154 + k * 11; rect(g, FLAGS[k % FLAGS.length], fx - 3, fy, 4, 4); }
  for (let k = 0; k < 9; k++) { const fx = x0 + 54 + k * 18, fy = y0 - 152 + k * 6; rect(g, FLAGS[(k + 3) % FLAGS.length], fx, fy, 4, 4); }
  if (go < 0) { poly(g, '#05060f', [[2688 + ox, 300], [2700 + ox, 300], [2672 + ox, 252], [2660 + ox, 252]]); poly(g, '#a8835a', [[2690 + ox, 299], [2698 + ox, 299], [2671 + ox, 253], [2663 + ox, 253]]); }
  else for (let i = 0; i < 5; i++) { const s = (go * .8 + i * .2) % 1; rect(g, '#c9ccd8', x0 + 226 - Math.round(s * 30), y0 - 148 - Math.round(s * 40), 4 + Math.round(s * 6), 4); }
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
// the event of the day (its deadline day, or a contract for it today)
export function eventToday(d) {
  const ct = d.contract && d.contract.kind === 'event' && d.contract.day === d.day ? d.contract : null, day = d.day;
  const k = ct ? ct.event || '' : '';
  if (k.startsWith('mitb') || (!ct && day === 10)) return { title: '머니 인 더 뱅크', sub: '오늘 밤 · 1:1 래더 매치 · 가방을 잡아라', c1: '#1f5a3a', c2: '#ffd65a' };
  if (k.startsWith('rumble') || (!ct && day === 14)) return { title: '만선 럼블', sub: '오늘 밤 · 10인 로얄럼블 · 마지막까지 남아라', c1: '#7a1f2a', c2: '#ffb347' };
  if (k.startsWith('tag') || (!ct && day === 21)) return { title: '항구 태그 대전', sub: '오늘 밤 · 2대2 태그 매치', c1: '#1f3a7a', c2: '#bff3ff' };
  return null;
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
  // an event day: a big banner over the hall (Money in the Bank, the rumble, the tag tournament)
  const E = eventToday(d);
  if (E) {
    const bx = 690 + ox, bw = 300, by = 54, t = Date.now() / 600;
    rect(g, '#120c1e', bx - 2, by - 2, bw + 4, 38); bands(g, bx, by, bw, 34, [E.c1, shade(E.c1, -.2), shade(E.c1, -.35)]); rect(g, E.c2, bx, by, bw, 3); rect(g, E.c2, bx, by + 31, bw, 3);
    for (let i = 0; i < 12; i++) rect(g, ['#ffd65a', '#ff5fa2', '#49d6ff', '#6be38a'][(i + Math.floor(t)) % 4], bx + 10 + i * 25, by - 6, 4, 4);
    drawText(g, E.title, bx + bw / 2, by + 4, { size: 11, align: 'c', color: '#ffffff', bold: true, outline: '#120c1e' }); drawText(g, E.sub, bx + bw / 2, by + 18, { size: 11, align: 'c', color: E.c2 });
    for (const dx of [8, bw - 9]) rect(g, '#5a5a6a', bx + dx, by - 20, 1, 20);
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
