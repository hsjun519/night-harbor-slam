// Arena drawing: baked background layers, a living crowd, the ring with elastic ropes, and a light pass.
import { VIEW_W, VIEW_H, RNG, clamp } from '../core/util.js';
import { rampHex, mixHex, shade } from './palette.js';
import { drawText } from './pixelfont.js';
import { canvas, rect, bands, dither, line, ellipse, poly, glow, cone, neon, truss, lamp, poster, brick, planks, windowPane, box, tiles, sofa, plant } from './painter.js';

const W = 900;
const SKIN = ['#f2c7a4', '#dca27a', '#b97a52', '#8a5a3e', '#5e3b2c'];
const HAIR = ['#1b1420', '#3a2630', '#5a3a2a', '#c9b07a', '#d26a3a', '#e8e4ee', '#3a3f6a', '#ff6fb0'];
const SHIRT = ['#d2456a', '#35a07a', '#2d63b8', '#ffd65a', '#ff8a2b', '#7c5ab8', '#e6e9f2', '#23263a', '#3fe0d0', '#c2333f', '#8fc94a', '#f2a6c8'];

// A strip of tiny spectators: v variants x 3 frames (sit, bob, arms up).
function crowdAtlas(seed) {
  const n = 36, cw = 12, ch = 18, [c, g] = canvas(n * cw, ch * 3), r = new RNG(seed);
  for (let i = 0; i < n; i++) {
    const sk = r.pick(SKIN), hr = r.pick(HAIR), sh = r.pick(SHIRT), hat = r.next() < .18, sign = r.next() < .12, R = rampHex(sh);
    for (let fr = 0; fr < 3; fr++) {
      const x = i * cw + 6, y = fr * ch + (fr === 1 ? 4 : 5);
      // body
      rect(g, '#0e0a18', x - 5, y + 7, 10, 12); rect(g, R[2], x - 4, y + 8, 8, 10); rect(g, R[3], x - 4, y + 8, 8, 1); rect(g, R[1], x - 4, y + 15, 8, 3);
      // arms
      if (fr === 2) { rect(g, '#0e0a18', x - 7, y - 3, 3, 11); rect(g, '#0e0a18', x + 4, y - 3, 3, 11); rect(g, R[2], x - 6, y - 2, 1, 9); rect(g, R[2], x + 5, y - 2, 1, 9); rect(g, sk, x - 7, y - 4, 2, 2); rect(g, sk, x + 5, y - 4, 2, 2); }
      // head
      ellipse(g, '#0e0a18', x, y + 3, 4, 4); ellipse(g, sk, x, y + 3, 3, 3); rect(g, shade(sk, -.25), x - 3, y + 5, 6, 1);
      rect(g, hr, x - 3, y - 1, 6, 2); rect(g, hr, x - 3, y, 1, 3);
      if (hat) { rect(g, r.pick(SHIRT), x - 4, y - 2, 8, 2); }
      if (fr === 2) { rect(g, '#0e0a18', x - 1, y + 4, 2, 2); }
      if (sign && fr === 2) { rect(g, '#0e0a18', x - 8, y - 9, 16, 7); rect(g, r.pick(['#fff6dc', '#ffd65a', '#ff8fc4']), x - 7, y - 8, 14, 5); rect(g, '#c2333f', x - 5, y - 7, 2, 3); rect(g, '#2d63b8', x - 1, y - 7, 5, 1); rect(g, '#2d63b8', x - 1, y - 5, 4, 1); }
    }
  }
  return { c, n, cw, ch };
}

// little pictures for the big screen during entrances: a knotted rope, mist, waves, a whale, a belt, a star
function screenIcon(g, kind, x, y, col, t) {
  const px = (dx, dy, w = 1, h = 1, c = col) => rect(g, c, x + dx, y + dy, w, h);
  if (kind === 'rope') { for (let i = 0; i < 10; i++) px(i, 6 + Math.round(Math.sin(i * .9 + t * 3) * 2), 1, 2); px(4, 3, 3, 3); }
  else if (kind === 'fog') { for (let i = 0; i < 3; i++) px((i * 4 + Math.round(t * 6)) % 10, 4 + i * 4, 7, 2, '#9aa3c2'); }
  else if (kind === 'wave') { for (let i = 0; i < 12; i++) px(i, 8 + Math.round(Math.sin(i * .7 + t * 4) * 2), 1, 3, '#e6f2ff'); px(1, 14, 11, 1, '#9fd6ff'); }
  else if (kind === 'whale') { px(0, 6, 14, 6, '#9fd6ff'); px(2, 4, 8, 2, '#9fd6ff'); px(14, 4, 2, 4, '#9fd6ff'); px(16, 2, 2, 3, '#9fd6ff'); px(3, 8, 1, 1, '#05060c'); px(5, 12, 7, 1, '#e6f2ff'); if (Math.floor(t * 2) % 2) px(6, 0, 1, 3, '#e6f2ff'); }
  else if (kind === 'jelly') { px(3, 1, 9, 5, '#c9b6ff'); px(4, 0, 7, 1, '#c9b6ff'); for (let i = 0; i < 4; i++) px(4 + i * 2, 6 + (Math.floor(t * 4 + i) % 2), 1, 7, '#7fe8ff'); }
  else if (kind === 'moray') { for (let i = 0; i < 14; i++) px(i, 7 + Math.round(Math.sin(i * .7 + t * 4) * 2), 1, 3, '#3a6a4a'); px(13, 5, 4, 4, '#3a6a4a'); px(15, 6, 1, 1, '#ffd65a'); }
  else if (kind === 'crab') { px(3, 6, 10, 5, '#ff5a3a'); px(0, 3, 3, 3, '#ff5a3a'); px(13, 3, 3, 3, '#ff5a3a'); px(5, 4, 1, 2, '#ffffff'); px(10, 4, 1, 2, '#ffffff'); for (let i = 0; i < 3; i++) { px(2 + i * 2, 11, 1, 2, '#c23a2e'); px(9 + i * 2, 11, 1, 2, '#c23a2e'); } }
  else if (kind === 'sail') { px(0, 9, 16, 3, '#7fc8ff'); px(16, 10, 4, 1, '#cfd8e6'); px(3, 2, 2, 7, '#1f4fa8'); px(5, 1, 3, 8, '#1f4fa8'); px(8, 3, 3, 6, '#1f4fa8'); }
  else if (kind === 'shark') { px(0, 8, 16, 4, '#8a96a6'); px(6, 3, 3, 5, '#8a96a6'); px(5, 5, 1, 3, '#8a96a6'); px(15, 6, 3, 2, '#8a96a6'); px(15, 11, 3, 2, '#8a96a6'); px(2, 10, 9, 2, '#e6f2ff'); px(13, 9, 1, 1, '#05060c'); }
  else if (kind === 'manta') { px(5, 5, 8, 5, '#e8ecf4'); px(0, 8, 5, 2, '#e8ecf4'); px(13, 8, 5, 2, '#e8ecf4'); px(1, 7, 4, 1, '#e8ecf4'); px(13, 7, 4, 1, '#e8ecf4'); px(7, 3, 1, 2, '#e8ecf4'); px(10, 3, 1, 2, '#e8ecf4'); px(8, 10, 2, 4, '#e8ecf4'); }
  else if (kind === 'orca') { px(0, 6, 16, 6, '#f4f6fa'); px(6, 1, 3, 5, '#f4f6fa'); px(16, 4, 2, 3, '#f4f6fa'); px(16, 10, 2, 3, '#f4f6fa'); px(2, 7, 3, 2, '#05060c'); px(4, 10, 8, 2, '#05060c'); }
  else if (kind === 'squid') { px(5, 0, 6, 8, '#ff4a5a'); px(4, 1, 1, 3, '#ff4a5a'); px(11, 1, 1, 3, '#ff4a5a'); for (let i = 0; i < 4; i++) px(5 + i * 2 - (i > 1 ? 1 : 0), 8, 1, 5 + (Math.floor(t * 3 + i) % 2) * 2, '#ff4a5a'); px(7, 4, 1, 1, '#ffffff'); }
  else if (kind === 'sperm') { px(0, 4, 8, 8, '#c9d4e6'); px(8, 6, 8, 5, '#c9d4e6'); px(16, 5, 2, 3, '#c9d4e6'); px(16, 10, 2, 3, '#c9d4e6'); px(2, 6, 1, 1, '#05060c'); px(1, 11, 6, 1, '#9aa3b2'); }
  else if (kind === 'belt') { px(0, 6, 16, 4, '#8a6a2a'); px(5, 4, 6, 8, '#ffd65a'); px(7, 6, 2, 4, '#fff3b0'); }
  else if (kind === 'star') { px(5, 0, 2, 12); px(0, 5, 12, 2); px(2, 2, 8, 8, col); px(4, 4, 4, 4, '#ffffff'); }
}
export class ArenaRenderer {
  constructor(arena, def) {
    this.ar = arena; this.def = def; this.t = 0; this.cheer = 0; this.flashes = []; this.screen = { text: '', sub: '', col: '#49d6ff', t: 0 };
    this.atlas = crowdAtlas(def.id.length * 31 + 5);
    this.rows = [];
    this.bake();
  }
  bake() {
    const id = this.def.id;
    const [far, gf] = canvas(820, VIEW_H), [near, gn] = canvas(W, VIEW_H);
    this.far = far; this.near = near;
    if (id === 'pier') this.bakePier(gf, gn); else if (id === 'gym') this.bakeGym(gf, gn); else if (id === 'alley') this.bakeAlley(gf, gn); else if (id === 'lobby') this.bakeLobby(gf, gn); else if (id === 'basement') this.bakeBasement(gf, gn); else this.bakeHall(gf, gn, id === 'dome');
    if (this.ar.hasRing) this.bakeRing(gn);
    // crowd seats
    const r = new RNG(9), crowdK = this.def.crowd != null ? this.def.crowd : 1;
    const rows = id === 'pier' ? [[188, .78, 34, .5], [204, .86, 30, .62]] : id === 'gym' ? [] : id === 'alley' ? [[210, .9, 70, .25]] : id === 'lobby' ? [[214, .94, 48, .45]] : id === 'basement' ? [[176, .8, 20, .26], [198, .88, 18, .32]] : [[128, .62, 18, .55], [148, .7, 17, .62], [168, .78, 16, .72], [190, .86, 15, .82], [212, .94, 14, .92]];
    for (const [y, par, step, light] of rows) for (let x = -20; x < W + 40; x += step * (1 + (1 - crowdK) * 2)) {
      if (r.next() < .12 * (2 - crowdK)) continue;
      this.rows.push({ x: x + r.next() * step * .6, y, par, light, v: (r.next() * this.atlas.n) | 0, ph: r.next() * 6.28, sp: .8 + r.next() * .6, fan: r.next() });
    }
  }
  bakeHall(g, n, dome) {
    const wallA = dome ? '#2a2246' : '#152036', wallB = dome ? '#3b2d5a' : '#1c2a44';
    bands(g, 0, 0, 820, 130, dome ? ['#0b0a1c', '#151330', '#1f1a40', '#29204c', '#33275a'] : ['#070b16', '#0b1220', '#0f182b', '#132037', '#172742']);
    // corrugated back wall
    for (let x = 0; x < 820; x += 4) { rect(g, x % 8 ? wallA : wallB, x, 40, 4, 90); }
    rect(g, '#0a0f1c', 0, 128, 820, 3);
    for (let x = 30; x < 820; x += 160) truss(g, x - 40, 24, 120, dome ? '#4a3d70' : '#28324f');
    truss(g, 0, 26, 820, dome ? '#4a3d70' : '#28324f');
    if (dome) { for (let i = 0; i < 9; i++) { const x = 40 + i * 92; rect(g, '#5a4a80', x, 0, 3, 40); ellipse(g, '#ffe9a8', x + 1, 40, 4, 2); } for (let x = 0; x < 820; x += 24) rect(g, '#463a6a', x, 0, 1, 24); }
    // banners
    const ban = [['안개왕', '#4a5078'], ['강태산', '#c25a20'], ['윤하늘', '#2a7fc4'], ['네온 제이', '#c2337a'], ['백파', '#5a6688'], ['비에른', '#8a6a3c']];
    ban.forEach(([name, col], i) => { const x = [20, 112, 286, 516, 690, 776][i], R = rampHex(col); rect(g, '#0a0716', x - 1, 44, 30, 66); bands(g, x, 45, 28, 60, [R[2], R[1], R[0]]); poly(g, R[1], [[x, 105], [x + 28, 105], [x + 14, 112]]); ellipse(g, R[0], x + 14, 66, 7, 8); rect(g, R[0], x + 6, 74, 16, 16); drawText(g, name.slice(0, 3), x + 14, 92, { size: 11, align: 'c', color: R[4] }); });
    // neon sign
    neon(g, dome ? '등대 돔' : '야항', 196, 64, dome ? '#ffd65a' : '#ff5fa2', { align: 'c', scale: 2 });
    neon(g, dome ? '챔피언십' : '레슬링', 626, 64, dome ? '#ffd65a' : '#49d6ff', { align: 'c', scale: 2 });
    drawText(g, 'NIGHT HARBOR WRESTLING', 410, 106, { size: 11, align: 'c', color: dome ? '#ffe9a8' : '#49d6ff' });
    // stands
    bands(g, 0, 118, 820, 116, ['#0c1222', '#0e1526', '#10182b', '#121b30', '#141e35']);
    for (let i = 0; i < 6; i++) rect(g, '#1b2540', 0, 140 + i * 21, 820, 2);
    // near: floor and barricade
    bands(n, 0, 226, W, 134, ['#121a2c', '#141d31', '#172136', '#19253b', '#1b2840', '#1d2a44']);
    for (let x = 0; x < W; x += 40) rect(n, '#152036', x, 240, 1, 120);
    for (let y = 252; y < VIEW_H; y += 22) rect(n, '#152036', 0, y, W, 1);
    // barricade with ads
    rect(n, '#06070e', 0, 224, W, 16);
    const ads = [['만선수산', '#1f8fa6'], ['돛대상회', '#c2333f'], ['항구의원', '#35a07a'], ['순덕포차', '#ffb347'], ['야항운수', '#7c5ab8'], ['등대우유', '#e6e9f2']];
    for (let x = 4, i = 0; x < W; x += 74, i++) { const [t, c] = ads[i % ads.length]; rect(n, c, x, 226, 70, 12); rect(n, shade(c, .3), x, 226, 70, 1); drawText(n, t, x + 35, 226, { size: 11, align: 'c', color: shade(c, -.7) }); }
    rect(n, '#3a4466', 0, 224, W, 1);
    // side barricades and ring steps
    for (const x of [this.ar.x0 - 6, this.ar.x1 + 2]) { rect(n, '#06070e', x, 240, 6, 90); rect(n, '#3a4466', x + 1, 244, 4, 2); rect(n, '#3a4466', x + 1, 270, 4, 2); rect(n, '#3a4466', x + 1, 296, 4, 2); }
  }
  bakePier(g, n) {
    bands(g, 0, 0, 820, 200, ['#0a0f2a', '#121a3e', '#1b2552', '#263066', '#352f6a', '#4a3570', '#5f3a72']);
    const r = new RNG(5);
    for (let i = 0; i < 80; i++) rect(g, r.next() < .3 ? '#ffffff' : '#9fb0ff', (r.next() * 820) | 0, (r.next() * 100) | 0, 1, 1);
    ellipse(g, '#fff3cf', 640, 46, 13, 13); ellipse(g, '#ffe39a', 644, 44, 11, 11); ellipse(g, '#2a2f60', 650, 40, 9, 9);
    // skyline
    for (let x = 0; x < 820; x += 8 + (r.next() * 12 | 0)) { const h = 30 + r.next() * 60, w = 10 + (r.next() * 14 | 0); rect(g, '#141836', x, 160 - h, w, h + 20); for (let k = 0; k < h / 5; k++) if (r.next() < .45) rect(g, r.pick(['#ffd27a', '#ff8fc4', '#7fe0ff']), x + 2 + (r.next() * (w - 4) | 0), 160 - h + 3 + k * 5, 1, 2); }
    neon(g, '야항', 120, 92, '#ff5fa2', { scale: 2 }); neon(g, '부두 특설 링', 560, 100, '#49d6ff', { scale: 1 });
    // cranes
    for (const cx of [300, 700]) { rect(g, '#22264a', cx, 60, 4, 120); rect(g, '#22264a', cx - 60, 60, 100, 4); line(g, '#22264a', cx, 64, cx - 50, 64); line(g, '#353a66', cx - 50, 64, cx - 50, 120); rect(g, '#ff5f5f', cx - 61, 58, 2, 2); }
    // sea
    bands(g, 0, 178, 820, 50, ['#1a2150', '#16204a', '#121a40', '#0f1636']);
    for (let i = 0; i < 40; i++) rect(g, r.pick(['#ff8fc4', '#7fe0ff', '#ffd27a']), (r.next() * 820) | 0, 182 + (r.next() * 40 | 0), 3 + (r.next() * 6 | 0), 1);
    // containers for the crowd
    for (let x = 0; x < 820; x += 70) box(g, x, 200, 66, 28, r.pick(['#c2333f', '#1f8fa6', '#d8a62e', '#35a07a']));
    // string lights
    for (let x = 0; x < 820; x += 6) { const y = 130 + Math.round(Math.sin(x * .025) * 6); rect(g, '#2a2440', x, y, 1, 1); if (x % 18 === 0) rect(g, r.pick(['#ffd27a', '#ff8fc4', '#7fe0ff']), x, y + 1, 2, 2); }
    // pier deck
    planks(n, 0, 228, W, 132, '#5a4636', { ph: 7 });
    rect(n, '#20182a', 0, 226, W, 3);
  }
  bakeGym(g, n) {
    brick(g, 0, 0, 820, 230, '#6a4a5a', { seed: 4 });
    for (let x = 60; x < 820; x += 180) windowPane(g, x, 30, 70, 60, { city: 1, seed: x });
    poster(g, 300, 110, 40, 54, '#c2333f', '훈련!', { figure: 1 }); poster(g, 520, 112, 40, 54, '#2d63b8', '집중', { figure: 1 });
    neon(g, '백 관장 체육관', 410, 8, '#ffcf8a', { scale: 1, align: 'c' });
    planks(n, 0, 226, W, 134, '#8a6a4a', { ph: 8 });
    rect(n, '#3a2a2a', 0, 224, W, 3);
  }
  bakeAlley(g, n) {
    bands(g, 0, 0, 820, 60, ['#090d1c', '#0e1428', '#121a33']);
    brick(g, 0, 40, 820, 190, '#3a2c44', { seed: 8 });
    for (let x = 30; x < 820; x += 200) { windowPane(g, x, 60, 34, 40, { sky: ['#ffd27a', '#ffb347', '#d27a3a'], bars: true }); }
    neon(g, '노래방', 160, 110, '#ff5fa2', { scale: 1 }); neon(g, '24시 국밥', 520, 96, '#49d6ff', { scale: 1 }); neon(g, '당구', 700, 130, '#8fe36b', { scale: 1 });
    for (const x of [90, 420, 760]) { box(n, x, 196, 44, 30, '#2f5a46', { tape: 0 }); rect(n, '#1d3a2c', x - 2, 194, 48, 4); }
    bands(n, 0, 226, W, 134, ['#1a1f30', '#1c2234', '#1e2438', '#20263c']);
    const r = new RNG(3);
    for (let i = 0; i < 12; i++) ellipse(n, 'rgba(90,120,200,.18)', r.next() * W, 280 + r.next() * 60, 14 + r.next() * 20, 2);
  }
  bakeLobby(g, n) {
    bands(g, 0, 0, 820, 40, ['#0a0d1c', '#0e1226', '#121730']);
    rect(g, '#2f3a5e', 0, 40, 820, 190); dither(g, 0, 40, 820, 190, '#26304f', .12, 820); rect(g, '#3a4a78', 0, 40, 820, 3);
    for (let x = 0; x < 820; x += 150) truss(g, x, 14, 150, '#2a3256');
    windowPane(g, 70, 64, 60, 64, { city: 1, seed: 3 }); windowPane(g, 690, 64, 60, 64, { city: 1, seed: 9 });
    neon(g, '야항 체육관', 410, 44, '#ff5fa2', { scale: 2, align: 'c' });
    [['안개왕', '#4a5078'], ['강태산', '#c25a20'], ['윤하늘', '#2a7fc4'], ['네온 제이', '#c2337a'], ['비에른', '#8a6a3c']].forEach(([nm, c], i) => poster(g, 300 + i * 46, 86, 36, 50, c, nm.slice(0, 3), { figure: 1, top: i === 0 ? '챔피언' : '' }));
    rect(g, '#5a3a3a', 0, 176, 820, 54); rect(g, '#6e4848', 0, 176, 820, 2); for (let x = 0; x < 820; x += 40) rect(g, '#4a2e2e', x, 178, 1, 50);
    tiles(n, 0, 226, W, 134, '#3a3046', '#2e2638', 12);
    rect(n, '#05060f', 0, 224, W, 3);
    box(n, 150, 150, 34, 76, '#c2333f'); rect(n, '#120c1e', 154, 156, 20, 40); for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) rect(n, ['#49d6ff', '#ffd65a', '#6be38a'][i], 157 + k * 9, 160 + i * 12, 6, 8); drawText(n, '음료', 167, 204, { size: 11, align: 'c', color: '#ffe6e6' });
    sofa(n, 420, 226, 92, '#3a6a8c'); plant(n, 530, 226, {}); plant(n, 392, 226, { leaf: '#5aa06a' });
    rect(n, '#120c1e', 640, 170, 92, 56); rect(n, '#6a4a3a', 642, 172, 88, 54); rect(n, '#8a6a4a', 642, 172, 88, 4); drawText(n, '안내', 686, 186, { size: 11, align: 'c', color: '#ffe9a8' });
    rect(n, '#120c1e', 40, 134, 70, 92); rect(n, '#2a2440', 42, 136, 66, 88); rect(n, 'rgba(150,200,255,.12)', 44, 138, 62, 84); rect(n, '#4a3a5a', 42, 176, 66, 2);
  }
  bakeBasement(g, n) {
    bands(g, 0, 0, 820, 230, ['#08080c', '#0c0c12', '#101018', '#14141c', '#18181f']);
    for (let y = 30; y < 230; y += 20) { rect(g, '#1e1e26', 0, y, 820, 1); for (let x = ((y / 20) % 2) * 26; x < 820; x += 52) rect(g, '#1e1e26', x, y, 1, 20); }
    rect(g, '#05060f', 0, 36, 820, 10); rect(g, '#5a4a3a', 0, 37, 820, 8); rect(g, '#7a6a5a', 0, 37, 820, 2); for (let x = 30; x < 820; x += 110) rect(g, '#3a2e24', x, 35, 6, 12);
    rect(g, '#05060f', 0, 54, 820, 6); rect(g, '#3a5a6a', 0, 55, 820, 4);
    drawText(g, '리벤지', 120, 92, { scale: 2, color: '#8a1f2a' }); drawText(g, 'NO RULES', 650, 88, { size: 11, color: '#3a8a4a' }); drawText(g, '야항 지하', 420, 72, { size: 11, color: '#c98a2e' });
    for (let x = -40; x < 820; x += 8) { line(g, '#2c2c36', x, 150, x + 40, 230); line(g, '#2c2c36', x + 40, 150, x, 230); }
    rect(g, '#4a4a56', 0, 148, 820, 3);
    for (const x of [80, 300, 520, 740]) lamp(g, x, 0, '#ffb347', { len: 26 });
    bands(n, 0, 226, W, 134, ['#1c1c22', '#1e1e24', '#202026', '#222228']);
    const r = new RNG(17);
    for (let i = 0; i < 16; i++) ellipse(n, 'rgba(70,24,24,.25)', r.next() * W, 240 + r.next() * 110, 10 + r.next() * 24, 2 + r.next() * 3);
    for (const x of [40, 830]) box(n, x, 188, 40, 38, '#4a3a2a');
  }
  bakeRing(g) {
    const a = this.ar, L = a.ropeL, R = a.ropeR, my = a.matY, back = my - 22, front = my + 16;
    const dome = this.def.id === 'dome', pier = this.def.id === 'pier', gym = this.def.id === 'gym', base = this.def.id === 'basement';
    const matCol = dome ? '#2a3f8c' : gym ? '#7a2f3a' : pier ? '#2a5f86' : base ? '#4a2626' : '#1f6f7a', M = rampHex(matCol);
    // shadow under the ring
    ellipse(g, 'rgba(0,0,0,.35)', (L + R) / 2, front + 40, (R - L) / 2 + 40, 8);
    // apron face
    const skirt = dome ? '#14143a' : base ? '#140e0c' : '#0e1224';
    rect(g, '#06070e', L - a.apron - 1, front, R - L + a.apron * 2 + 2, a.floorY - front + 2);
    bands(g, L - a.apron, front + 1, R - L + a.apron * 2, a.floorY - front - 1, [skirt, shade(skirt, .08), skirt, shade(skirt, -.2)]);
    rect(g, dome ? '#ffd65a' : '#ff5fa2', L - a.apron, front + 4, R - L + a.apron * 2, 2);
    rect(g, dome ? '#e0a32e' : '#49d6ff', L - a.apron, a.floorY - 6, R - L + a.apron * 2, 1);
    const title = dome ? '등대 돔 · 챔피언십' : gym ? '백 관장 체육관' : base ? '지하 격투장' : '야항 레슬링 연맹';
    drawText(g, title, (L + R) / 2, front + 12, { scale: 2, align: 'c', color: dome ? '#ffe9a8' : '#eef2ff', bold: true, outline: '#06070e' });
    for (const x of [L + 30, R - 30]) { ellipse(g, dome ? '#e0a32e' : '#49d6ff', x, front + 21, 7, 7); ellipse(g, skirt, x, front + 21, 4, 4); }
    // mat surface (trapezoid)
    const top = [[L + 14, back], [R - 14, back], [R + a.apron, front], [L - a.apron, front]];
    poly(g, M[0], [[top[0][0] - 1, back - 1], [top[1][0] + 1, back - 1], [top[2][0] + 1, front + 1], [top[3][0] - 1, front + 1]]);
    for (let y = back; y < front; y++) { const k = (y - back) / (front - back), x0 = L + 14 + (L - a.apron - L - 14) * k, x1 = R - 14 + (R + a.apron - R + 14) * k; rect(g, k < .2 ? M[1] : k < .75 ? M[2] : M[3], x0, y, x1 - x0, 1); }
    // canvas seams and logo
    for (const k of [.33, .66]) { const y = Math.round(back + (front - back) * k); rect(g, M[1], L, y, R - L, 1); }
    const cx = (L + R) / 2, cy = my - 3;
    ellipse(g, M[1], cx, cy, 34, 9); ellipse(g, M[3], cx, cy, 30, 7);
    drawText(g, dome ? 'CHAMPION' : 'N H W', cx, cy - 6, { size: 11, align: 'c', color: M[1] });
    // apron edge
    rect(g, M[4], L - a.apron, front - 1, R - L + a.apron * 2, 1);
    // back posts
    this.post(g, L + 14, back, dome); this.post(g, R - 14, back, dome);
    // steps
    for (const sx of [L - 40, R + 26]) { for (let i = 0; i < 3; i++) { rect(g, '#06070e', sx, a.floorY - 10 - i * 10, 14, 11); rect(g, '#2c3456', sx + 1, a.floorY - 9 - i * 10, 12, 9); rect(g, '#4a557e', sx + 1, a.floorY - 9 - i * 10, 12, 1); } }
  }
  post(g, x, base, gold) {
    const c = gold ? '#e0a32e' : '#b9c2dc', R = rampHex(c);
    rect(g, '#06070e', x - 3, base - 62, 7, 63); rect(g, R[2], x - 2, base - 61, 5, 61); rect(g, R[4], x - 1, base - 61, 1, 61); rect(g, R[1], x + 2, base - 61, 1, 61);
    rect(g, '#06070e', x - 3, base - 64, 7, 3); rect(g, R[3], x - 2, base - 64, 5, 2);
  }
  // ---- per frame ----
  update(dt, hype) {
    this.t += dt;
    this.cheer = Math.max(this.cheer - dt * .6, hype / 100 * .75);
    for (const f of this.flashes) f.t -= dt;
    this.flashes = this.flashes.filter(f => f.t > 0);
    if (Math.random() < dt * (2 + this.cheer * 14)) this.flashes.push({ x: Math.random() * W, y: 120 + Math.random() * 100, t: .08 });
    this.screen.t += dt;
  }
  boost(k) { this.cheer = Math.min(1, this.cheer + k); }
  drawBack(g, camX) {
    const a = this.ar;
    g.drawImage(this.far, Math.round(-camX * .6), 0);
    this.drawScreen(g, camX);
    // crowd
    const A = this.atlas, ch = this.cheer;
    for (const p of this.rows) {
      const sx = Math.round(p.x - camX * p.par);
      if (sx < -14 || sx > VIEW_W + 14) continue;
      const bob = Math.sin(this.t * (3 + ch * 6) * p.sp + p.ph);
      const up = ch > .45 && bob > .55 - ch * .5 ? 2 : (ch > .15 && bob > .4) ? 1 : 0;
      g.drawImage(A.c, p.v * A.cw, up * A.ch, A.cw, A.ch, sx - 6, p.y - (up ? Math.round(bob * 2 * ch) : 0), A.cw, A.ch);
    }
    // darker back rows
    if (this.rows.length) { g.fillStyle = 'rgba(6,8,20,.35)'; g.fillRect(0, 110, VIEW_W, 40); g.fillStyle = 'rgba(6,8,20,.18)'; g.fillRect(0, 150, VIEW_W, 30); }
    for (const f of this.flashes) { const sx = f.x - camX * .8; rect(g, '#ffffff', sx, f.y, 2, 2); glow(g, sx + 1, f.y + 1, 9, '#ffffff', .5); }
    g.drawImage(this.near, Math.round(-camX), 0);
    if (a.hasRing) { this.backRopes(g, camX); this.sideRopes(g, camX, false); }
  }
  ropeColors() { if (this.def.id === 'basement') return ['#c9a25a', '#8a8494', '#c9a25a']; return this.def.id === 'dome' ? ['#ffd65a', '#f6f1e6', '#e0a32e'] : this.def.id === 'gym' ? ['#e6e9f2', '#c2333f', '#e6e9f2'] : ['#ff5fa2', '#f6f1e6', '#49d6ff']; }
  backRopes(g, camX) {
    const a = this.ar, L = a.ropeL + 14 - camX, R = a.ropeR - 14 - camX, back = a.matY - 22, cols = this.ropeColors();
    const wob = a.shake * 2;
    for (let i = 0; i < 3; i++) {
      const h = [18, 34, 50][i], y = back - h, c = cols[2 - i];
      for (let x = Math.floor(L); x < R; x += 2) { const k = (x - L) / (R - L), sag = Math.sin(k * Math.PI) * (2 + wob * Math.sin(this.t * 30 + i)); rect(g, shade(c, -.25), x, y + sag, 2, 1); rect(g, shade(c, -.55), x, y + sag + 1, 2, 1); }
      for (const px of [L, R]) { rect(g, '#06070e', px - 3, y - 2, 7, 5); rect(g, this.def.id === 'dome' ? '#c2333f' : '#3a59b8', px - 2, y - 1, 5, 3); }
    }
  }
  // Side ropes run from a front post to a back post; the half nearer the viewer is drawn over the wrestlers.
  sideRopes(g, camX, front) {
    const a = this.ar, cols = this.ropeColors(), my = a.matY, back = my - 22, fr = my + 16;
    for (const side of ['L', 'R']) {
      const d = a.ropes[side].d, dir = side === 'L' ? -1 : 1;
      const xb = (side === 'L' ? a.ropeL + 14 : a.ropeR - 14) - camX, xf = (side === 'L' ? a.ropeL - 10 : a.ropeR + 10) - camX;
      for (let i = 0; i < 3; i++) {
        const h = [18, 34, 50][i], c = cols[2 - i];
        const yb = back - h, yf = fr - h - 2, mx = (xb + xf) / 2 + dir * d * (1 - i * .12), myy = (yb + yf) / 2 + Math.abs(d) * .15;
        if (!front) { line(g, shade(c, -.5), xb, yb + 1, mx, myy + 1, 1); line(g, c, xb, yb, mx, myy, 1); }
        else { line(g, shade(c, -.5), mx, myy + 1, xf, yf + 1, 2); line(g, c, mx, myy, xf, yf, 2); rect(g, mixHex(c, '#ffffff', .4), (mx + xf) / 2, (myy + yf) / 2 - 1, 2, 1); }
      }
      if (front) {
        this.post(g, xf, fr + 2, this.def.id === 'dome');
        for (let i = 0; i < 3; i++) { const y = fr - [18, 34, 50][i] - 2; rect(g, '#06070e', xf - 4, y - 3, 9, 7); rect(g, this.def.id === 'dome' ? '#c2333f' : '#3a59b8', xf - 3, y - 2, 7, 5); rect(g, '#8aa4ff', xf - 3, y - 2, 7, 1); }
      }
    }
  }
  drawFront(g, camX) { if (this.ar.hasRing) this.sideRopes(g, camX, true); }
  drawScreen(g, camX) {
    if (this.def.id === 'gym' || this.def.id === 'alley' || this.def.id === 'pier' || this.def.id === 'lobby' || this.def.id === 'basement') return;
    const x = Math.round(410 - camX * .6) - 78, y = 58, w = 156, h = 40;
    rect(g, '#1a1d33', x + 30, 0, 2, y); rect(g, '#1a1d33', x + w - 32, 0, 2, y);
    rect(g, '#06070e', x - 3, y - 3, w + 6, h + 6); rect(g, '#2a3150', x - 2, y - 2, w + 4, h + 4); rect(g, '#05060c', x, y, w, h);
    const s = this.screen;
    if (s.text) {
      const blink = s.blink && Math.floor(s.t * 4) % 2;
      drawText(g, s.text, x + w / 2, y + 5, { align: 'c', color: blink ? '#ffffff' : s.col, bold: true });
      if (s.sub) drawText(g, s.sub, x + w / 2, y + 24, { size: 11, align: 'c', color: '#c9d4ff' });
      if (s.icon) screenIcon(g, s.icon, x + 4, y + 4, s.col, s.t);
    }
    for (let yy = 0; yy < h; yy += 2) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, y + yy, w, 1); }
  }
  setScreen(text, sub = '', col = '#49d6ff', blink = false, icon = null) { this.screen = { text, sub, col, t: 0, blink, icon }; }
  // Light pass after the bodies.
  drawLights(g, camX, focus) {
    const id = this.def.id;
    if (id === 'hall' || id === 'dome') {
      const cx = (this.ar.ropeL + this.ar.ropeR) / 2 - camX;
      cone(g, cx - 140, 30, 18, 160, 250, id === 'dome' ? '#ffe39a' : '#ffcf8a', .08);
      cone(g, cx + 140, 30, 18, 160, 250, id === 'dome' ? '#ffe39a' : '#a8d8ff', .08);
      if (focus != null) cone(g, focus - camX, 20, 14, 120, 260, '#ffffff', .05 + this.cheer * .05);
      for (let i = 0; i < 6; i++) glow(g, 60 + i * 150 - camX * .6, 34, 26, id === 'dome' ? '#ffe9a8' : '#ffcf7a', .25);
    } else if (id === 'pier') {
      glow(g, 640 - camX * .6, 46, 60, '#fff0c0', .15);
      for (let x = 0; x < 900; x += 54) glow(g, x - camX * .6, 134, 12, '#ff8fc4', .2);
    } else if (id === 'lobby') {
      for (const x of [200, 560]) glow(g, x - camX * .6, 50, 60, '#ffcf7a', .18);
    } else if (id === 'basement') {
      for (const x of [80, 300, 520, 740]) glow(g, x - camX * .6, 34, 46, '#ffb347', .28);
      g.fillStyle = 'rgba(4,3,8,.22)'; g.fillRect(0, 0, VIEW_W, 40); g.fillRect(0, VIEW_H - 30, VIEW_W, 30);
    } else if (id === 'alley') {
      glow(g, 180 - camX * .6, 116, 50, '#ff5fa2', .22); glow(g, 540 - camX * .6, 102, 50, '#49d6ff', .2);
    } else glow(g, 410 - camX * .6, 20, 120, '#ffe0b0', .12);
  }
}
export const clampCam = (x, w = W) => clamp(x - VIEW_W / 2, 0, w - VIEW_W);
