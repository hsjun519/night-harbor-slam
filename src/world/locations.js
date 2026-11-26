// The town: every place is data (size, doors, things to use, who stands where) plus a painter for its backdrop.
import { RNG } from '../core/util.js';
import { rampHex, shade, mixHex } from '../render/palette.js';
import { drawText } from '../render/pixelfont.js';
import { canvas, rect, bands, dither, line, ellipse, poly, neon, truss, lamp, poster, brick, planks, tiles, windowPane, box, shelf, sofa, door, board, frameArt, trophy, plant, wave } from '../render/painter.js';

export const FLOOR = 300;
// Sky colours by time of day for windows and the street.
export const SKY = [
  ['#7fb8e8', '#9fcbef', '#c3def5', '#e7f0f7'],
  ['#e88a5a', '#f0a86a', '#f6c98a', '#fbe3b0'],
  ['#0b1230', '#141c44', '#1f2656', '#352f6a'],
];
function cityStrip(seed, w, h) {
  const [c, g] = canvas(w, h), r = new RNG(seed);
  for (let x = 0; x < w; x += 5 + (r.next() * 9 | 0)) { const bh = 8 + r.next() * h * .7, bw = 5 + (r.next() * 8 | 0); rect(g, '#141a33', x, h - bh, bw, bh); for (let k = 0; k < 5; k++) if (r.next() < .55) rect(g, r.next() < .5 ? '#ffd27a' : '#7fe0ff', x + 1 + (r.next() * (bw - 2) | 0), h - bh + 2 + (r.next() * (bh - 3) | 0), 1, 1); }
  return c;
}
const CITY = { strip: null };
export function drawWindows(g, loc, camX, slot) {
  if (!loc.windows) return;
  if (!CITY.strip) CITY.strip = cityStrip(4, 260, 60);
  for (const [x, y, w, h] of loc.windows) {
    const sx = Math.round(x - camX);
    if (sx > 640 || sx + w < 0) continue;
    bands(g, sx, y, w, h, SKY[slot]);
    g.save(); g.beginPath(); g.rect(sx, y, w, h); g.clip();
    if (loc.sea) { rect(g, slot === 2 ? '#141c44' : '#3a6aa8', sx, y + h * .62, w, h * .38); for (let i = 0; i < w; i += 7) rect(g, slot === 2 ? '#ff8fc4' : '#e6f6ff', sx + i + ((x * 3) % 7), y + h * .7 + (i % 3) * 3, 3, 1); }
    g.globalAlpha = slot === 2 ? 1 : .7; g.drawImage(CITY.strip, (x * 7) % 200, 0, w, 60, sx, y + h - Math.min(h, 40), w, Math.min(h, 40)); g.globalAlpha = 1;
    if (slot === 0) rect(g, 'rgba(255,255,255,.18)', sx + 3, y + 3, 3, h - 6);
    g.restore();
    rect(g, '#2a2f4a', sx + w / 2 - 1, y, 2, h); rect(g, '#2a2f4a', sx, y + h / 2 - 1, w, 2);
  }
}

// ---- backdrops ----------------------------------------------------------------------------------
function wallBase(g, W, top, wall, wain, floor, o = {}) {
  bands(g, 0, 0, W, top, o.ceil || ['#0a0d1c', '#0e1226', '#121730']);
  const R = rampHex(wall);
  rect(g, R[2], 0, top, W, FLOOR - top);
  dither(g, 0, top, W, FLOOR - top, R[1], .12, W);
  rect(g, R[1], 0, top, W, 3); rect(g, R[3], 0, top + 3, W, 1);
  if (wain) { const Q = rampHex(wain); rect(g, Q[2], 0, FLOOR - 52, W, 52); rect(g, Q[3], 0, FLOOR - 52, W, 2); rect(g, Q[1], 0, FLOOR - 4, W, 4); for (let x = 0; x < W; x += 40) rect(g, Q[1], x, FLOOR - 50, 1, 46); }
  const F = rampHex(floor);
  if (o.planks) planks(g, 0, FLOOR, W, 60, floor, { ph: 6 }); else if (o.tiles) tiles(g, 0, FLOOR, W, 60, F[2], F[1], 10); else { rect(g, F[2], 0, FLOOR, W, 60); for (let y = FLOOR + 6; y < 360; y += 9) rect(g, F[1], 0, y, W, 1); }
  rect(g, '#05060f', 0, FLOOR, W, 2); rect(g, F[3], 0, FLOOR + 2, W, 1);
}
const PAINT = {
  lobby(g, L) {
    const W = L.w;
    wallBase(g, W, 40, '#2f3a5e', '#5a3a3a', '#3a3046', { tiles: 1 });
    for (let x = 0; x < W; x += 150) truss(g, x, 14, 150, '#2a3256');
    L.windows = [[150, 70, 60, 70], [960, 70, 60, 70]];
    for (const [x, y, w, h] of L.windows) { rect(g, '#120c1e', x - 3, y - 3, w + 6, h + 6); g.clearRect(x, y, w, h); }
    neon(g, '야항 체육관', 560, 50, '#ff5fa2', { scale: 2, align: 'c' });
    drawText(g, '로비 · 휴게실', 560, 82, { size: 11, align: 'c', color: '#49d6ff' });
    // posters of the roster
    [['안개왕', '#4a5078'], ['강태산', '#c25a20'], ['윤하늘', '#2a7fc4'], ['네온 제이', '#c2337a'], ['비에른', '#8a6a3c']].forEach(([n, c], i) => poster(g, 250 + i * 46, 104, 36, 50, c, n.slice(0, 3), { figure: 1, top: i === 0 ? '챔피언' : '' }));
    // trophy case
    rect(g, '#120c1e', 40, 160, 70, 92); rect(g, '#2a2440', 42, 162, 66, 88); rect(g, 'rgba(150,200,255,.12)', 44, 164, 62, 84); for (const [x, y] of [[56, 196], [76, 196], [94, 196], [66, 236], [88, 236]]) trophy(g, x, y, x % 2 ? '#e6e9f2' : '#ffd65a'); rect(g, '#4a3a5a', 42, 198, 66, 2); rect(g, '#4a3a5a', 42, 238, 66, 2);
    // vending machine
    box(g, 630, 196, 34, 104, '#c2333f'); rect(g, '#120c1e', 634, 202, 20, 54); for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) rect(g, ['#49d6ff', '#ffd65a', '#6be38a'][i], 637 + k * 9, 206 + i * 16, 6, 10); rect(g, '#ffd65a', 656, 240, 5, 8); drawText(g, '음료', 647, 262, { size: 11, align: 'c', color: '#ffe6e6' });
    // boards
    board(g, 690, 150, 88, 74, '경기 일정', ['오늘의 대진', '계약 확인', '이벤트 공지']);
    board(g, 790, 150, 88, 74, '선수 랭킹', ['1~13위', '챔피언', '안개왕'], { bg: '#22304a' });
    // sofa and lounge
    rect(g, '#3a2a40', 880, 290, 170, 10);
    sofa(g, 900, 300, 92, '#3a6a8c'); plant(g, 1010, 300, {}); plant(g, 870, 300, { leaf: '#5aa06a' });
    rect(g, '#5a3a2a', 920, 262, 40, 4); rect(g, '#3a2418', 924, 266, 4, 20); rect(g, '#3a2418', 952, 266, 4, 20);
    // reception desk
    rect(g, '#120c1e', 404, 236, 92, 66); rect(g, '#6a4a3a', 406, 238, 88, 62); rect(g, '#8a6a4a', 406, 238, 88, 4); drawText(g, '안내', 450, 254, { size: 11, align: 'c', color: '#ffe9a8' });
    // doors
    door(g, 64, 196, 34, 104, '#3a4a6a', { sign: '정문', glass: 1 });
    door(g, 320, 196, 34, 104, '#6a3a2a', { sign: '사장실' });
    door(g, 1092, 196, 40, 104, '#2a2a3a', { sign: '경기장', signCol: '#7a1f3a' });
    door(g, 564, 196, 36, 104, '#2a4a3a', { sign: '훈련장' });
    lamp(g, 200, 40, '#ffcf7a', { len: 18 }); lamp(g, 560, 40, '#ffcf7a', { len: 10 }); lamp(g, 940, 40, '#ffcf7a', { len: 18 });
  },
  office(g, L) {
    const W = L.w;
    wallBase(g, W, 36, '#3b3048', '#4a2e2a', '#5a3a30', { planks: 1 });
    // ship-cabin panels and portholes
    for (let x = 0; x < W; x += 52) rect(g, '#33283e', x, 36, 2, FLOOR - 88);
    L.windows = [[150, 80, 40, 40], [450, 80, 40, 40]]; L.sea = 1;
    for (const [x, y, w] of L.windows) { ellipse(g, '#120c1e', x + w / 2, y + w / 2, w / 2 + 5, w / 2 + 5); ellipse(g, '#c9a25a', x + w / 2, y + w / 2, w / 2 + 3, w / 2 + 3); ellipse(g, '#8a6a3c', x + w / 2, y + w / 2, w / 2 + 1, w / 2 + 1); g.save(); g.globalCompositeOperation = 'destination-out'; ellipse(g, '#000', x + w / 2, y + w / 2, w / 2 - 1, w / 2 - 1); g.restore(); }
    frameArt(g, 286, 70, 64, 46, () => { bands(g, 286, 70, 64, 46, ['#1b2a5c', '#30407a', '#5b4a8a']); poly(g, '#e6e9f2', [[300, 104], [336, 104], [330, 110], [306, 110]]); rect(g, '#e6e9f2', 316, 82, 2, 22); poly(g, '#f2efe4', [[318, 82], [332, 98], [318, 98]]); });
    drawText(g, '구만석 사장실', 318, 44, { size: 11, align: 'c', color: '#ffe9a8' });
    // trophy shelf
    shelf(g, 40, 150, 70, 3, '#5a3a2a', ['#ffd65a', '#e6e9f2', '#c98a2e']);
    // rank and schedule boards
    board(g, 214, 150, 66, 60, '랭킹', ['안개왕', '1. 백파', '2. 비에른']);
    board(g, 520, 150, 80, 60, '이번 주', ['계약 경기', '럼블 14일', '태그 21일'], { bg: '#22304a' });
    // desk and model ship
    rect(g, '#120c1e', 330, 236, 140, 66); rect(g, '#7a4a2a', 332, 238, 136, 62); rect(g, '#9a6a3a', 332, 238, 136, 5); rect(g, '#5a3420', 340, 250, 120, 44);
    rect(g, '#e6e9f2', 344, 226, 16, 12); rect(g, '#2d63b8', 346, 228, 12, 2); rect(g, '#ffd65a', 446, 230, 10, 8);
    poly(g, '#8a5a34', [[380, 236], [420, 236], [414, 230], [386, 230]]); rect(g, '#d8cfb8', 398, 212, 2, 18); poly(g, '#f2efe4', [[400, 212], [414, 226], [400, 226]]);
    // aquarium and sofa
    rect(g, '#120c1e', 560, 220, 56, 40); rect(g, '#1f6f8c', 562, 222, 52, 36); rect(g, '#2a8fa6', 562, 222, 52, 6); rect(g, '#5a3a2a', 556, 260, 64, 40); for (const [x, y, c] of [[574, 236, '#ff8a2b'], [596, 244, '#ffd65a'], [588, 230, '#ff5fa2']]) { ellipse(g, c, x, y, 3, 2); rect(g, c, x - 5, y - 1, 2, 3); }
    sofa(g, 100, 300, 90, '#2f6a4a');
    lamp(g, 400, 36, '#ffcf7a', { len: 26 });
  },
  gym(g, L) {
    const W = L.w;
    wallBase(g, W, 40, '#5a4048', '#3a3a52', '#8a6a4a', { planks: 1 });
    brick(g, 0, 40, W, 208, '#6a4a5a', { seed: 12 });
    L.windows = [[120, 70, 64, 56], [880, 70, 64, 56]];
    for (const [x, y, w, h] of L.windows) { rect(g, '#120c1e', x - 3, y - 3, w + 6, h + 6); g.clearRect(x, y, w, h); }
    neon(g, '백 관장 체육관', 520, 56, '#ffcf8a', { scale: 1, align: 'c' });
    poster(g, 230, 90, 40, 54, '#c2333f', '근성', { figure: 1 }); poster(g, 760, 90, 40, 54, '#2d63b8', '기본기', { figure: 1 });
    // mirror wall
    rect(g, '#120c1e', 330, 92, 120, 120); rect(g, '#9ab0d8', 332, 94, 116, 116); rect(g, '#c9d8f0', 336, 98, 20, 108); dither(g, 332, 94, 116, 116, '#7a90b8', .2, 4);
    // equipment
    const eq = (x, label) => { drawText(g, label, x, 268, { size: 11, align: 'c', color: '#ffe9a8', outline: '#120c1e' }); };
    rect(g, '#1a1a2a', 390, 280, 60, 6); rect(g, '#3a3a4a', 398, 262, 4, 18); rect(g, '#3a3a4a', 438, 262, 4, 18); rect(g, '#888ea8', 382, 256, 76, 3); ellipse(g, '#2a2a3a', 384, 257, 4, 9); ellipse(g, '#2a2a3a', 456, 257, 4, 9); eq(420, '벤치프레스');
    rect(g, '#2a5a8a', 512, 294, 70, 6); eq(546, '줄넘기');
    rect(g, '#5a3a2a', 646, 230, 4, 70); rect(g, '#c2333f', 640, 226, 16, 22); eq(670, '미트 치기');
    rect(g, '#3a6a4a', 760, 292, 60, 8); eq(790, '목 브릿지');
    // practice ring
    const rx = 880, rw = 200;
    rect(g, '#120c1e', rx - 2, 252, rw + 4, 50); rect(g, '#7a2f3a', rx, 254, rw, 16); rect(g, '#3a2430', rx, 270, rw, 30); drawText(g, '연습 링', rx + rw / 2, 276, { size: 11, align: 'c', color: '#ffe9a8' });
    for (const px of [rx + 4, rx + rw - 6]) { rect(g, '#c9d2e6', px, 196, 3, 60); }
    for (const h of [214, 228, 242]) rect(g, '#e6e9f2', rx + 6, h, rw - 10, 1);
    lamp(g, 420, 40, '#ffe0b0', { len: 14 }); lamp(g, 700, 40, '#ffe0b0', { len: 14 }); lamp(g, 980, 40, '#ffe0b0', { len: 14 });
    door(g, 46, 196, 34, 104, '#2a4a3a', { sign: '로비' });
  },
  arena(g, L) {
    const W = L.w;
    wallBase(g, W, 40, '#262a40', '#1a1d2e', '#2a2a36', {});
    for (let x = 0; x < W; x += 6) rect(g, x % 12 ? '#22263a' : '#262b44', x, 40, 6, 208);
    neon(g, '선수 대기실', 300, 54, '#49d6ff', { scale: 1, align: 'c' });
    // lockers
    for (let i = 0; i < 6; i++) { const x = 110 + i * 26; rect(g, '#120c1e', x - 1, 168, 26, 132); rect(g, '#3a5a7a', x, 170, 24, 130); rect(g, '#5a7a9a', x, 170, 24, 2); for (let k = 0; k < 3; k++) rect(g, '#2a4a6a', x + 5, 180 + k * 6, 14, 2); rect(g, '#ffd65a', x + 19, 230, 2, 6); }
    // bench
    rect(g, '#120c1e', 300, 268, 100, 8); rect(g, '#8a6a4a', 302, 268, 96, 5); rect(g, '#5a3a2a', 310, 276, 4, 24); rect(g, '#5a3a2a', 386, 276, 4, 24);
    // card board
    board(g, 450, 132, 110, 92, '오늘의 대진', ['계약 경기', '자유 경기', '특별 이벤트'], { bg: '#1c2238', frame: '#3a59b8' });
    // curtain to the ring
    rect(g, '#120c1e', 668, 120, 112, 182); bands(g, 670, 122, 108, 178, ['#7a1f3a', '#8a2a46', '#7a1f3a', '#6a1830']); for (let x = 674; x < 776; x += 9) rect(g, '#5a1428', x, 122, 2, 178); rect(g, '#ffd65a', 670, 122, 108, 3);
    neon(g, '입장', 724, 96, '#ff5fa2', { scale: 1, align: 'c' });
    lamp(g, 300, 40, '#ffcf7a', { len: 20 }); lamp(g, 560, 40, '#ffcf7a', { len: 20 });
    door(g, 40, 196, 34, 104, '#2a2a3a', { sign: '로비' });
  },
  clinic(g, L) {
    const W = L.w;
    wallBase(g, W, 40, '#d8e4e8', '#8fc4c0', '#c9d2d8', { tiles: 1, ceil: ['#c9d2d8', '#d8e0e4', '#e6ecef'] });
    L.windows = [[270, 76, 56, 56]];
    rect(g, '#5a6a7a', 267, 73, 62, 62); g.clearRect(270, 76, 56, 56);
    drawText(g, '항구의원', 400, 50, { scale: 2, align: 'c', color: '#2a6a6a', bold: true });
    rect(g, '#ff4f6d', 474, 52, 6, 18); rect(g, '#ff4f6d', 468, 58, 18, 6);
    // beds
    for (const x of [470, 560]) { rect(g, '#5a6a7a', x, 270, 70, 4); rect(g, '#f2f4fa', x, 258, 70, 12); rect(g, '#9fe0d0', x + 44, 254, 26, 6); rect(g, '#8a96a8', x + 2, 274, 3, 26); rect(g, '#8a96a8', x + 65, 274, 3, 26); rect(g, '#bfefff', x, 200, 2, 58); }
    // chairs and cabinet
    for (let i = 0; i < 3; i++) { const x = 90 + i * 26; rect(g, '#2a6a8a', x, 270, 20, 6); rect(g, '#2a6a8a', x, 252, 3, 20); rect(g, '#1a4a6a', x + 2, 276, 2, 24); rect(g, '#1a4a6a', x + 16, 276, 2, 24); }
    shelf(g, 186, 160, 60, 3, '#e6ecef', ['#ff4f6d', '#6be38a', '#49d6ff', '#ffd65a']);
    board(g, 340, 160, 76, 56, '진료 안내', ['부상 치료', '응급 처치', '입원 치료'], { bg: '#2a4a4a' });
    door(g, 30, 196, 34, 104, '#5a7a8a', { sign: '나가기', glass: 1 });
  },
  shop(g, L) {
    const W = L.w;
    wallBase(g, W, 40, '#4a3a2a', '#6a4a2a', '#5a4a3a', { planks: 1 });
    neon(g, '돛대 상회', 330, 50, '#ffb347', { scale: 2, align: 'c' });
    // racks of costumes
    for (let i = 0; i < 4; i++) { const x = 90 + i * 44; rect(g, '#2a1e14', x, 140, 2, 120); rect(g, '#2a1e14', x - 14, 140, 30, 2); for (let k = 0; k < 3; k++) { const c = ['#ff5fa2', '#49d6ff', '#ffd65a', '#6be38a', '#c86bff', '#ff8a2b'][(i * 3 + k) % 6]; rect(g, shade(c, -.3), x - 12 + k * 8, 142, 7, 34); rect(g, c, x - 12 + k * 8, 142, 6, 32); } }
    // masks wall
    for (let i = 0; i < 5; i++) { const x = 300 + i * 22, c = ['#c2333f', '#2d63b8', '#e6e9f2', '#3fe0d0', '#7c5ab8'][i]; ellipse(g, shade(c, -.4), x, 120, 8, 10); ellipse(g, c, x, 119, 7, 9); rect(g, '#120c1e', x - 4, 117, 3, 2); rect(g, '#120c1e', x + 1, 117, 3, 2); }
    // counter
    rect(g, '#120c1e', 380, 236, 170, 66); rect(g, '#8a5a34', 382, 238, 166, 62); rect(g, '#b07a44', 382, 238, 166, 5);
    box(g, 396, 214, 22, 22, '#e6e9f2', { tape: 1 }); box(g, 520, 220, 18, 16, '#ff4f6d', { label: '' }); rect(g, '#ff4f6d', 527, 223, 4, 10); rect(g, '#ff4f6d', 524, 226, 10, 4);
    shelf(g, 560, 150, 60, 4, '#5a3a2a', ['#49d6ff', '#ffd65a', '#ff4f6d', '#e6e9f2']);
    board(g, 230, 160, 60, 50, '오늘 특가', ['붕대', '음료', '장비'], { bg: '#3a2a1a' });
    door(g, 30, 196, 34, 104, '#6a4a2a', { sign: '나가기' });
  },
  rivalgym(g, L) {
    const W = L.w;
    wallBase(g, W, 40, '#1e2a24', '#3a2a22', '#3a3a3a', {});
    for (let x = 0; x < W; x += 10) rect(g, x % 20 ? '#1a2620' : '#22302a', x, 40, 10, 208);
    neon(g, '철썩 짐', 360, 52, '#3fd46b', { scale: 2, align: 'c' });
    poster(g, 180, 100, 40, 54, '#3fd46b', '철마', { figure: 1 }); poster(g, 520, 100, 40, 54, '#ffd65a', '고수', { figure: 1 });
    rect(g, '#120c1e', 260, 250, 200, 52); rect(g, '#3a5a3a', 262, 252, 196, 18); rect(g, '#1a2a1a', 262, 270, 196, 30); drawText(g, '도장 깨기 링', 360, 276, { size: 11, align: 'c', color: '#c9f0c0' });
    for (const px of [266, 452]) rect(g, '#9aa6b8', px, 196, 3, 58);
    for (const h of [212, 226, 240]) rect(g, '#3fd46b', 268, h, 186, 1);
    door(g, 30, 196, 34, 104, '#2a3a2a', { sign: '나가기' });
  },
  dome(g, L) {
    const W = L.w;
    wallBase(g, W, 40, '#2a2246', '#3b2d5a', '#2a2440', { tiles: 1, ceil: ['#0b0a1c', '#151330', '#1f1a40'] });
    neon(g, '등대 돔', 320, 50, '#ffd65a', { scale: 2, align: 'c' });
    drawText(g, '챔피언십 로비', 320, 84, { size: 11, align: 'c', color: '#ffe9a8' });
    for (let i = 0; i < 4; i++) trophy(g, 140 + i * 30, 200, '#ffd65a');
    rect(g, '#120c1e', 420, 120, 120, 182); bands(g, 422, 122, 116, 178, ['#ffd65a', '#e0a32e', '#c98a1a']); for (let x = 426; x < 536; x += 9) rect(g, '#a8721a', x, 122, 2, 178);
    door(g, 30, 196, 34, 104, '#4a3d70', { sign: '나가기' });
  },
};
function paintStreet(g, L) {
  // the street is drawn in two layers: far (parallax) and near (buildings)
  const W = L.w;
  rect(g, '#05060f', 0, FLOOR, W, 60);
  bands(g, 0, FLOOR, W, 60, ['#2a2a3a', '#26263a', '#222236', '#1e1e32']);
  for (let x = 0; x < W; x += 36) rect(g, '#3a3a52', x, FLOOR + 22, 18, 2);
  rect(g, '#4a4a62', 0, FLOOR, W, 3);
  const bld = (x, w, h, col, sign, sc, o = {}) => {
    const R = rampHex(col);
    rect(g, '#05060f', x - 1, FLOOR - h - 1, w + 2, h + 1); rect(g, R[2], x, FLOOR - h, w, h); rect(g, R[3], x, FLOOR - h, w, 2); rect(g, R[1], x, FLOOR - 10, w, 10);
    if (o.brick) brick(g, x, FLOOR - h, w, h - 10, col, { seed: x });
    for (let wy = FLOOR - h + 14; wy < FLOOR - 70; wy += 26) for (let wx = x + 10; wx < x + w - 20; wx += 30) { rect(g, '#120c1e', wx - 1, wy - 1, 18, 14); rect(g, o.lit !== false && ((wx + wy) % 3) ? '#ffd27a' : '#2a3150', wx, wy, 16, 12); }
    if (sign) neon(g, sign, x + w / 2, FLOOR - h + (o.signY || 8), sc, { scale: o.big ? 2 : 1, align: 'c' });
  };
  bld(60, 300, 200, '#2f3a5e', '야항 체육관', '#ff5fa2', { big: 1, signY: 10 });
  door(g, 192, 196, 36, 104, '#3a4a6a', { glass: 1 });
  bld(400, 180, 150, '#cfd9df', '항구의원', '#2a8a8a', { lit: false }); rect(g, '#ff4f6d', 480, FLOOR - 120, 6, 18); rect(g, '#ff4f6d', 474, FLOOR - 114, 18, 6);
  door(g, 470, 210, 34, 90, '#5a7a8a', { glass: 1 });
  bld(640, 190, 160, '#6a4a2a', '돛대 상회', '#ffb347', { brick: 1 });
  door(g, 720, 210, 34, 90, '#6a4a2a', {});
  // pojangmacha tent
  const tx = 900;
  poly(g, '#c2333f', [[tx, FLOOR - 92], [tx + 150, FLOOR - 92], [tx + 166, FLOOR - 60], [tx - 16, FLOOR - 60]]);
  rect(g, '#e0405a', tx - 16, FLOOR - 60, 182, 6); for (let x = tx - 10; x < tx + 160; x += 22) rect(g, '#ff8a9a', x, FLOOR - 88, 8, 26);
  rect(g, 'rgba(255,200,150,.35)', tx - 10, FLOOR - 54, 170, 54); rect(g, '#5a3a2a', tx + 20, FLOOR - 26, 110, 6); rect(g, '#3a2418', tx + 26, FLOOR - 20, 4, 20); rect(g, '#3a2418', tx + 120, FLOOR - 20, 4, 20);
  drawText(g, '순덕 포차', tx + 75, FLOOR - 84, { size: 11, align: 'c', color: '#fff3cf', outline: '#5a1020' });
  // plaza
  const px = 1260;
  rect(g, '#3a3a52', px - 80, FLOOR - 4, 220, 4); ellipse(g, '#2a3a5a', px + 30, FLOOR - 16, 40, 10); ellipse(g, '#4a6a9a', px + 30, FLOOR - 20, 34, 7); rect(g, '#8aa4c8', px + 28, FLOOR - 56, 4, 36); ellipse(g, '#bfefff', px + 30, FLOOR - 58, 8, 4);
  drawText(g, '등대 광장', px + 30, FLOOR - 110, { size: 11, align: 'c', color: '#c9d4ff' });
  // rival gym
  bld(1460, 200, 170, '#1e2a24', '철썩 짐', '#3fd46b', { brick: 1 });
  door(g, 1546, 210, 34, 90, '#2a3a2a', {});
  // dock and the dome
  rect(g, '#5a4636', 1720, FLOOR - 6, 300, 6);
  for (let x = 1730; x < 2020; x += 40) rect(g, '#3a2a22', x, FLOOR - 36, 6, 30);
  box(g, 1760, FLOOR - 40, 60, 34, '#1f8fa6', { tape: 1 }); box(g, 1830, FLOOR - 30, 44, 24, '#d8a62e', {}); box(g, 1800, FLOOR - 64, 40, 24, '#c2333f', {});
  drawText(g, '하역장', 1820, FLOOR - 120, { size: 11, align: 'c', color: '#ffd65a', outline: '#120c1e' });
  bld(2060, 220, 220, '#2a2246', '등대 돔', '#ffd65a', { big: 1 });
  door(g, 2150, 196, 40, 104, '#4a3d70', {});
  // street lamps
  for (let x = 30; x < W; x += 260) { rect(g, '#1a1d33', x, FLOOR - 120, 3, 120); rect(g, '#1a1d33', x - 8, FLOOR - 122, 14, 3); rect(g, '#ffe0a0', x - 6, FLOOR - 119, 10, 2); }
}
export function streetFar(L, slot) {
  const [c, g] = canvas(1500, FLOOR), r = new RNG(9);
  bands(g, 0, 0, 1500, FLOOR, slot === 2 ? ['#070a1e', '#0c1230', '#111a42', '#18224f', '#22285c', '#2f2a62', '#43306a'] : slot === 1 ? ['#3a4a8a', '#7a5a8a', '#c26a6a', '#e88a5a', '#f0a86a', '#f6c98a', '#fbe3b0'] : ['#5f9ad8', '#7fb8e8', '#9fcbef', '#b8d8f2', '#cfe4f5', '#e1edf7', '#eef4f9']);
  if (slot === 2) { for (let i = 0; i < 100; i++) rect(g, '#ffffff', (r.next() * 1500) | 0, (r.next() * 120) | 0, 1, 1); ellipse(g, '#fff3cf', 1100, 50, 14, 14); ellipse(g, '#1c2456', 1106, 46, 12, 12); }
  else ellipse(g, slot === 1 ? '#ffd08a' : '#fff6d0', 1100, slot === 1 ? 150 : 50, 16, 16);
  // far skyline and harbour
  for (let x = 0; x < 1500; x += 8 + (r.next() * 14 | 0)) { const h = 30 + r.next() * 80, w = 12 + (r.next() * 16 | 0); rect(g, slot === 2 ? '#141836' : slot === 1 ? '#5a3a5a' : '#7a90b0', x, 210 - h, w, h + 40); if (slot === 2) for (let k = 0; k < h / 6; k++) if (r.next() < .4) rect(g, r.pick(['#ffd27a', '#ff8fc4', '#7fe0ff']), x + 2 + (r.next() * (w - 4) | 0), 210 - h + 3 + k * 6, 1, 2); }
  for (const cx of [300, 760, 1240]) { rect(g, slot === 2 ? '#1d2148' : '#4a5a7a', cx, 120, 4, 120); rect(g, slot === 2 ? '#1d2148' : '#4a5a7a', cx - 60, 120, 96, 4); rect(g, '#ff5f5f', cx - 61, 118, 2, 2); }
  rect(g, slot === 2 ? '#e6e9f2' : '#f2f4fa', 1380, 130, 12, 80); rect(g, '#c2333f', 1380, 146, 12, 8); rect(g, '#c2333f', 1380, 172, 12, 8); rect(g, '#ffe9a8', 1382, 124, 8, 6);
  bands(g, 0, 232, 1500, 68, slot === 2 ? ['#1a2152', '#161e4a', '#121a40'] : ['#3a6aa8', '#2f5a96', '#264a80']);
  for (let i = 0; i < 70; i++) rect(g, slot === 2 ? r.pick(['#ff8fc4', '#7fe0ff', '#ffd27a']) : '#e6f6ff', (r.next() * 1500) | 0, 236 + (r.next() * 60 | 0), 3 + (r.next() * 8 | 0), 1);
  return c;
}

/* Location data. npcs(c) returns who is here today; objects have an action key handled by WorldScene. */
export const LOCATIONS = {
  lobby: { name: '로비 · 휴게실', w: 1180, music: 'lobby', rim: '#ffcf8a', light: .02,
    doors: [{ x: 82, to: 'street', at: 210, label: '건물 밖으로' }, { x: 337, to: 'office', at: 60, label: '사장실' }, { x: 582, to: 'gym', at: 80, label: '훈련장' }, { x: 1112, to: 'arena', at: 70, label: '경기장 대기실' }],
    objects: [{ x: 647, w: 30, act: 'vending', label: '자판기' }, { x: 734, w: 80, act: 'schedule', label: '경기 일정판' }, { x: 834, w: 80, act: 'ranking', label: '랭킹 보드' }, { x: 946, w: 90, act: 'rest', label: '소파에서 쉬기' }, { x: 75, w: 60, act: 'trophy', label: '트로피 진열장' }, { x: 380, w: 220, act: 'poster', label: '선수 포스터' }] },
  office: { name: '사장실', w: 640, music: 'office', rim: '#ffcf8a', light: .03, doors: [{ x: 20, to: 'lobby', at: 337, label: '로비', edge: 1 }], objects: [{ x: 75, w: 60, act: 'trophy', label: '트로피 선반' }, { x: 247, w: 60, act: 'ranking', label: '랭킹 보드' }, { x: 560, w: 70, act: 'schedule', label: '이번 주 일정' }, { x: 588, w: 50, act: 'fish', label: '수족관' }] },
  gym: { name: '훈련장', w: 1100, music: 'gym', rim: '#ffcf8a', light: .04, doors: [{ x: 63, to: 'lobby', at: 582, label: '로비' }],
    objects: [{ x: 420, w: 70, act: 'train', game: 'bench', label: '벤치프레스' }, { x: 546, w: 70, act: 'train', game: 'rope', label: '줄넘기' }, { x: 668, w: 50, act: 'train', game: 'mitt', label: '미트 치기' }, { x: 790, w: 60, act: 'train', game: 'bridge', label: '목 브릿지' }, { x: 980, w: 180, act: 'spar', label: '연습 링 (연습 경기)' }, { x: 390, w: 110, act: 'train', game: 'breath', label: '거울 앞 호흡 훈련' }] },
  arena: { name: '경기장 대기실', w: 820, music: 'gym', rim: '#49d6ff', light: 0, doors: [{ x: 57, to: 'lobby', at: 1112, label: '로비' }],
    objects: [{ x: 505, w: 110, act: 'card', label: '오늘의 대진표' }, { x: 724, w: 110, act: 'enter', label: '입장 통로' }, { x: 190, w: 150, act: 'locker', label: '사물함' }, { x: 350, w: 100, act: 'bench', label: '벤치에 앉기' }] },
  street: { name: '부둣길', w: 2300, music: 'street', rim: '#ff5fa2', light: -.02, street: 1,
    doors: [{ x: 210, to: 'lobby', at: 82, label: '야항 체육관' }, { x: 487, to: 'clinic', at: 60, label: '항구의원' }, { x: 737, to: 'shop', at: 60, label: '돛대 상회' }, { x: 1563, to: 'rivalgym', at: 60, label: '철썩 짐', lock: 'rivalgym' }, { x: 2170, to: 'dome', at: 60, label: '등대 돔', lock: 'dome' }],
    objects: [{ x: 980, w: 150, act: 'pojang', label: '순덕 포차' }, { x: 1290, w: 120, act: 'plaza', label: '등대 광장' }, { x: 1830, w: 140, act: 'job', label: '하역장 아르바이트' }, { x: 1390, w: 40, act: 'fountain', label: '분수' }] },
  clinic: { name: '항구의원', w: 640, music: 'clinic', rim: '#bfefff', light: .08, doors: [{ x: 47, to: 'street', at: 487, label: '부둣길' }], objects: [{ x: 378, w: 80, act: 'clinicBoard', label: '진료 안내판' }, { x: 520, w: 150, act: 'bed', label: '병상' }] },
  shop: { name: '돛대 상회', w: 640, music: 'shop', rim: '#ffcf8a', light: .03, doors: [{ x: 47, to: 'street', at: 737, label: '부둣길' }], objects: [{ x: 150, w: 160, act: 'racks', label: '의상 행거' }, { x: 260, w: 60, act: 'sale', label: '오늘 특가판' }] },
  rivalgym: { name: '철썩 짐', w: 700, music: 'gym', rim: '#3fd46b', light: 0, doors: [{ x: 47, to: 'street', at: 1563, label: '부둣길' }], objects: [{ x: 360, w: 200, act: 'dojo', label: '도장 깨기 링' }] },
  dome: { name: '등대 돔', w: 640, music: 'boss', rim: '#ffd65a', light: .03, doors: [{ x: 47, to: 'street', at: 2170, label: '부둣길' }], objects: [{ x: 480, w: 120, act: 'domeGate', label: '챔피언십 입장구' }, { x: 180, w: 120, act: 'trophy', label: '역대 챔피언' }] },
};
export function bakeLocation(id) {
  const L = LOCATIONS[id];
  const [c, g] = canvas(L.w, 360);
  if (L.street) paintStreet(g, L); else PAINT[id](g, L);
  L.bg = c;
  return L;
}
export const locMix = mixHex;
export const locLine = line;
export const locWave = wave;
export const locWin = windowPane;
