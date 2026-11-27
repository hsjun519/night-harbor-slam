// Title screen and quick-match setup.
import { VIEW_W, VIEW_H, RNG, clamp, damp } from '../core/util.js';
import { drawText, textWidth } from '../render/pixelfont.js';
import { UI, mixHex } from '../render/palette.js';
import { canvas, rect, bands, ellipse, line, poly, glow, cone, neon, windowPane } from '../render/painter.js';
import { panel, menuList, prompt, gauge, fade } from '../render/ui.js';
import { BodyCanvas } from '../render/raster.js';
import { drawBody } from '../render/body.js';
import { Joints, dimsFor, solveFK, toWorld, JN } from '../anim/skeleton.js';
import { stancePose } from '../anim/clips.js';
import { CHARACTERS, ROSTER_IDS, STYLES, STAT_INFO, statBar } from '../data/characters.js';
import { MODES } from '../combat/MatchManager.js';
import { ARENAS } from '../combat/arena.js';
import { DIFFICULTY } from '../combat/AIController.js';
import { FINISHERS } from '../data/moves.js';

const P = new Float32Array(16);
// A wrestler standing in a stance, drawn outside any match (menus, title, town portraits).
export class Mannequin {
  constructor() { this.bc = new BodyCanvas(); this.j = new Joints(); }
  draw(g, look, stance, x, y, face, t, o = {}) {
    const d = dimsFor(look.build, look.scale || 1);
    stancePose(stance, t, P);
    if (o.pose) for (let i = 0; i < 16; i++) P[i] = o.pose[i];
    solveFK(P, d, this.j, {});
    toWorld(this.j, face, x, y);
    this.bc.setLight(o.env || { rim: '#4fd6ff' });
    this.bc.begin(this.j.x(0), this.j.y(0) - 4);
    drawBody(this.bc, this.j, d, look, { expr: o.expr || 'neutral', cape: o.cape, hand: o.hand });
    this.bc.finish({ outline: o.outline });
    this.bc.drawTo(g, 0, 0, o.alpha != null ? o.alpha : 1);
  }
}

function titleBackdrop() {
  const [c, g] = canvas(VIEW_W, VIEW_H), r = new RNG(21);
  bands(g, 0, 0, VIEW_W, 230, ['#070a1e', '#0c1230', '#111a42', '#18224f', '#22285c', '#2f2a62', '#43306a', '#5a356c']);
  for (let i = 0; i < 120; i++) rect(g, r.next() < .3 ? '#ffffff' : '#9fb0ff', (r.next() * VIEW_W) | 0, (r.next() * 140) | 0, 1, 1);
  ellipse(g, '#fff3cf', 520, 60, 16, 16); ellipse(g, '#ffe39a', 524, 57, 14, 14); ellipse(g, '#1c2456', 531, 52, 12, 12);
  for (let x = 0; x < VIEW_W; x += 7 + (r.next() * 12 | 0)) { const h = 26 + r.next() * 70, w = 9 + (r.next() * 14 | 0); rect(g, '#121633', x, 210 - h, w, h + 20); for (let k = 0; k < h / 5; k++) if (r.next() < .45) rect(g, r.pick(['#ffd27a', '#ff8fc4', '#7fe0ff', '#ffd27a']), x + 2 + (r.next() * (w - 4) | 0), 210 - h + 3 + k * 5, 1, 2); }
  // lighthouse on a cape
  poly(g, '#0d1128', [[40, 230], [120, 196], [200, 230]]);
  rect(g, '#e6e9f2', 108, 132, 14, 66); rect(g, '#c2333f', 108, 146, 14, 8); rect(g, '#c2333f', 108, 170, 14, 8); rect(g, '#2a2f4a', 104, 124, 22, 8); rect(g, '#ffe9a8', 110, 126, 10, 5);
  // cranes and ships
  for (const cx of [300, 410]) { rect(g, '#1d2148', cx, 110, 4, 100); rect(g, '#1d2148', cx - 50, 110, 86, 4); line(g, '#2a3066', cx - 40, 114, cx - 40, 160); rect(g, '#ff5f5f', cx - 51, 108, 2, 2); }
  poly(g, '#161a3c', [[460, 214], [600, 214], [586, 230], [470, 230]]); rect(g, '#161a3c', 500, 196, 40, 18); rect(g, '#ffd27a', 506, 202, 3, 2); rect(g, '#ffd27a', 514, 202, 3, 2);
  // sea
  bands(g, 0, 230, VIEW_W, 130, ['#1a2152', '#161e4a', '#121a40', '#0f1638', '#0c1230', '#0a0e28']);
  for (let i = 0; i < 90; i++) rect(g, r.pick(['#ff8fc4', '#7fe0ff', '#ffd27a', '#3a4688']), (r.next() * VIEW_W) | 0, 234 + (r.next() * 120 | 0), 3 + (r.next() * 9 | 0), 1);
  // pier deck
  rect(g, '#2a1e2c', 0, 300, VIEW_W, 60); for (let x = 0; x < VIEW_W; x += 16) rect(g, '#3a2a36', x, 300, 15, 60); rect(g, '#120c18', 0, 298, VIEW_W, 3);
  return c;
}

export class TitleScene {
  constructor(game, o = {}) {
    this.game = game; this.t = 0; this.sel = 0; this.bg = titleBackdrop(); this.man = new Mannequin(); this.rain = []; const r = new RNG(5);
    for (let i = 0; i < 80; i++) this.rain.push({ x: r.next() * VIEW_W, y: r.next() * VIEW_H, s: 180 + r.next() * 120 });
    this.onCareer = o.onCareer; this.hasSave = o.hasSave; this.onNew = o.onNew;
    game.audio.music('title');
    game.screen.resetFx();
  }
  items() {
    return [
      { label: this.hasSave ? '커리어 이어하기' : '커리어 시작', act: () => this.onCareer && this.onCareer(this.hasSave ? 'continue' : 'new') },
      ...(this.hasSave ? [{ label: '새 커리어', act: () => this.onCareer && this.onCareer('new') }] : []),
      { label: '빠른 경기', act: () => this.game.go(() => new QuickScene(this.game, 'quick')) },
      { label: '온라인 대전 (1:1)', act: () => this.game.playOnline && this.game.playOnline() },
      { label: '연습 모드', act: () => this.game.go(() => new QuickScene(this.game, 'practice')) },
      { label: '기초 훈련 (튜토리얼)', act: () => this.game.playTutorial && this.game.playTutorial(null, () => this.game.toTitle()) },
      { label: '설정', act: () => this.game.openSettings && this.game.openSettings() },
      { label: '조작법', act: () => this.game.showControls() },
    ];
  }
  update(dt) {
    this.t += dt;
    const inp = this.game.input, it = this.items(), A = this.game.audio;
    if (inp.pressed('up')) { this.sel = (this.sel + it.length - 1) % it.length; A.sfx('ui'); }
    if (inp.pressed('down')) { this.sel = (this.sel + 1) % it.length; A.sfx('ui'); }
    if (inp.menuPressed('confirm')) { A.init(); A.sfx('ok'); it[this.sel].act(); }
    for (const d of this.rain) { d.y += d.s * dt; d.x -= d.s * .25 * dt; if (d.y > VIEW_H) { d.y = -6; d.x = Math.random() * (VIEW_W + 60); } }
  }
  draw(w, u) {
    w.drawImage(this.bg, 0, 0);
    // lighthouse beam
    const a = this.t * .6, bx = 115, by = 128;
    w.save(); w.globalCompositeOperation = 'lighter'; w.globalAlpha = .1 + .05 * Math.sin(this.t * 2);
    const gr = w.createLinearGradient(bx, by, bx + Math.cos(a) * 640, by);
    gr.addColorStop(0, '#fff6c8'); gr.addColorStop(1, 'rgba(0,0,0,0)'); w.fillStyle = gr;
    w.beginPath(); w.moveTo(bx, by); w.lineTo(bx + Math.cos(a) * 700, by - 40 - Math.sin(a) * 30); w.lineTo(bx + Math.cos(a) * 700, by + 30 + Math.sin(a) * 30); w.closePath(); w.fill(); w.restore();
    glow(w, bx + 4, by, 26, '#fff3c0', .7);
    // two wrestlers on the pier
    this.man.draw(w, CHARACTERS.rookie.look, 'std', 220, 302, 1, this.t, { env: { rim: '#ff5fa2' } });
    this.man.draw(w, CHARACTERS.fogking.look, 'fog', 430, 302, -1, this.t, { env: { rim: '#49d6ff' }, cape: true });
    // rain
    w.fillStyle = 'rgba(170,200,255,.45)';
    for (const d of this.rain) w.fillRect(Math.round(d.x), Math.round(d.y), 1, 4);
    u.clearRect(0, 0, VIEW_W, VIEW_H);
    // logo
    const bob = Math.round(Math.sin(this.t * 1.3) * 2);
    neon(u, '밤항구 슬램', 320, 34 + bob, '#ff5fa2', { scale: 4, align: 'c' });
    drawText(u, 'NIGHT  HARBOR  SLAM', 320, 96 + bob, { align: 'c', color: '#49d6ff', bold: true, outline: '#05060f' });
    drawText(u, '항구 도시 프로레슬링 커리어', 320, 112 + bob, { size: 11, align: 'c', color: '#c9d4ff', outline: '#05060f' });
    const it = this.items();
    panel(u, 236, 196, 168, it.length * 18 + 14, { alpha: .88, accent: '#ff5fa2' });
    menuList(u, it, this.sel, 250, 204, { w: 140, lh: 18 });
    drawText(u, '↑↓ 선택 · Enter 결정', 320, 348, { size: 11, align: 'c', color: UI.dim, outline: '#05060f' });
    drawText(u, 'v0.9 · 오리지널 게임', 634, 348, { size: 11, align: 'r', color: UI.faint });
  }
}

// ---- quick match / practice setup ----------------------------------------------------------------
const PLAY_IDS = ['rookie', ...ROSTER_IDS];
export class QuickScene {
  constructor(game, kind) {
    this.game = game; this.kind = kind; this.t = 0; this.row = 0; this.man = new Mannequin();
    const last = game.settings.lastQuick || {};
    this.v = Object.assign({ mode: kind === 'practice' ? 'practice' : 'single', me: 'rookie', foe: 'taesan', mate: 'dohyun', foe2: 'bjorn', level: 'normal', arena: 'hall', count: 6 }, kind === 'practice' ? { mode: 'practice', me: last.me || 'rookie', foe: last.foe || 'taesan' } : last);
    if (kind === 'practice') this.v.mode = 'practice';
    game.audio.music('lobby');
  }
  rows() {
    const v = this.v, M = this.kind === 'practice' ? ['practice'] : ['single', 'pin', 'tag', 'royal', 'rumble', 'street'];
    const R = [{ k: 'mode', label: '경기 방식', list: M, show: x => MODES[x].name }, { k: 'me', label: '내 선수', list: PLAY_IDS, show: x => CHARACTERS[x].name }];
    if (v.mode === 'tag') R.push({ k: 'mate', label: '내 파트너', list: PLAY_IDS, show: x => CHARACTERS[x].name });
    if (v.mode !== 'royal' && v.mode !== 'rumble') R.push({ k: 'foe', label: '상대', list: PLAY_IDS, show: x => CHARACTERS[x].name });
    if (v.mode === 'tag') R.push({ k: 'foe2', label: '상대 파트너', list: PLAY_IDS, show: x => CHARACTERS[x].name });
    if (v.mode === 'royal' || v.mode === 'rumble') R.push({ k: 'count', label: '참가 인원', list: v.mode === 'royal' ? [3, 4, 5, 6] : [4, 6, 8, 10], show: x => x + '명' });
    if (this.kind !== 'practice') R.push({ k: 'level', label: 'AI 난이도', list: ['easy', 'normal', 'hard', 'expert'], show: x => DIFFICULTY[x].name });
    if (v.mode !== 'street') R.push({ k: 'arena', label: '경기장', list: ['hall', 'pier', 'dome', 'gym'], show: x => ARENAS[x].name });
    R.push({ k: 'start', label: this.kind === 'practice' ? '연습 시작' : '경기 시작' }, { k: 'back', label: '돌아가기' });
    return R;
  }
  update(dt) {
    this.t += dt;
    const inp = this.game.input, A = this.game.audio, R = this.rows();
    this.row = clamp(this.row, 0, R.length - 1);
    if (inp.pressed('up')) { this.row = (this.row + R.length - 1) % R.length; A.sfx('ui'); }
    if (inp.pressed('down')) { this.row = (this.row + 1) % R.length; A.sfx('ui'); }
    const r = R[this.row];
    if (r.list && (inp.pressed('left') || inp.pressed('right'))) { const d = inp.pressed('left') ? -1 : 1, i = r.list.indexOf(this.v[r.k]); this.v[r.k] = r.list[(i + d + r.list.length) % r.list.length]; A.sfx('ui', { pitch: 1.2 }); }
    if (inp.menuPressed('cancel')) { A.sfx('back'); this.game.toTitle(); return; }
    if (inp.menuPressed('confirm')) {
      if (r.k === 'start') { A.sfx('ok'); this.start(); }
      else if (r.k === 'back') { A.sfx('back'); this.game.toTitle(); }
      else if (r.list) { const i = r.list.indexOf(this.v[r.k]); this.v[r.k] = r.list[(i + 1) % r.list.length]; A.sfx('ui'); }
    }
  }
  start() {
    const v = this.v, lv = v.level, rng = new RNG(Date.now() & 0xffff);
    this.game.settings.lastQuick = Object.assign({}, v); this.game.saveSettings();
    const me = { char: v.me, ctrl: 'human' };
    let E;
    if (v.mode === 'tag') E = [me, { char: v.mate, ctrl: 'ai', difficulty: lv }, { char: v.foe, ctrl: 'ai', difficulty: lv }, { char: v.foe2, ctrl: 'ai', difficulty: lv }];
    else if (v.mode === 'royal' || v.mode === 'rumble') { const pool = rng.shuffle(PLAY_IDS.filter(x => x !== v.me)); E = [me, ...pool.slice(0, v.count - 1).map(c => ({ char: c, ctrl: 'ai', difficulty: lv }))]; if (v.mode === 'rumble') E = [E[0], ...rng.shuffle(E.slice(1))]; }
    else E = [me, { char: v.foe, ctrl: this.kind === 'practice' ? 'dummy' : 'ai', difficulty: this.kind === 'practice' ? 'normal' : lv }];
    const cfg = { mode: v.mode, arena: v.mode === 'street' ? 'alley' : v.arena, entrants: E, practice: this.kind === 'practice' ? { infinite: true, fullFin: false } : null, skipIntro: this.kind === 'practice' };
    this.game.playMatch(cfg, () => this.game.go(() => new QuickScene(this.game, this.kind)));
  }
  draw(w, u) {
    const v = this.v;
    bands(w, 0, 0, VIEW_W, VIEW_H, ['#0b0f22', '#0e1430', '#111a3a', '#141f44', '#17244c']);
    for (let i = 0; i < 16; i++) rect(w, 'rgba(73,214,255,.05)', 0, i * 24 + ((this.t * 12) % 24), VIEW_W, 1);
    // previews
    const me = CHARACTERS[v.me], foe = v.mode === 'royal' || v.mode === 'rumble' ? null : CHARACTERS[v.foe];
    cone(w, 420, 0, 20, 140, 330, '#ff5fa2', .1); cone(w, 560, 0, 20, 140, 330, '#49d6ff', .1);
    rect(w, '#1b2450', 340, 300, 300, 60);
    this.man.draw(w, me.look, me.stance, 430, 300, 1, this.t, { env: { rim: '#ff5fa2' } });
    if (foe) this.man.draw(w, foe.look, foe.stance, 560, 300, -1, this.t + 1, { env: { rim: '#49d6ff' } });
    u.clearRect(0, 0, VIEW_W, VIEW_H);
    drawText(u, this.kind === 'practice' ? '연습 모드' : '빠른 경기', 20, 14, { scale: 2, color: '#ffd65a', bold: true, outline: '#05060f' });
    drawText(u, MODES[v.mode].desc, 20, 46, { size: 11, color: UI.dim });
    const R = this.rows();
    panel(u, 14, 66, 300, R.length * 19 + 14, { alpha: .92 });
    R.forEach((r, i) => {
      const y = 74 + i * 19, on = i === this.row;
      if (on) rect(u, mixHex(UI.accent, UI.panel, .55), 18, y - 2, 292, 17);
      drawText(u, r.label, 26, y, { color: on ? '#ffffff' : UI.dim });
      if (r.list) drawText(u, '◀ ' + r.show(this.v[r.k]) + ' ▶', 302, y, { align: 'r', color: on ? '#ffd65a' : '#c9d4ff' });
    });
    // stat card for my pick
    this.card(u, me, 330, 16, '#ff5fa2');
    if (foe) this.card(u, foe, 486, 16, '#49d6ff');
    prompt(u, ['↑↓'], '항목', 20, 338, {}); prompt(u, ['←→'], '바꾸기', 90, 338, {}); prompt(u, ['Enter'], '결정', 170, 338, {}); prompt(u, ['Esc'], '뒤로', 250, 338, {});
  }
  card(u, c, x, y, col) {
    panel(u, x, y, 148, 124, { accent: col, alpha: .9 });
    drawText(u, c.name, x + 6, y + 4, { color: '#ffffff', bold: true });
    drawText(u, c.nick + ' · ' + STYLES[c.style].name, x + 6, y + 20, { size: 11, color: col });
    const keys = ['hp', 'stun', 'atk', 'grp', 'spd', 'jump'];
    keys.forEach((k, i) => { const info = STAT_INFO.find(s => s[0] === k); drawText(u, info[1], x + 6, y + 36 + i * 12, { size: 11, color: UI.dim }); gauge(u, x + 74, y + 40 + i * 12, 66, 4, clamp(statBar(c, k), .05, 1), 'fin', { col }); });
    drawText(u, '피니셔: ' + FINISHERS[c.finisher].name, x + 6, y + 108, { size: 11, color: '#ffd65a' });
  }
}
export const titleDamp = damp;
export const titleJN = JN;
export const titleTW = textWidth;
export const titleWin = windowPane;
export const titleFade = fade;
