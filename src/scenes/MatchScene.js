// A match on screen: simulation + camera + effects + sound + HUD + pause + results.
import { VIEW_W, VIEW_H, clamp, damp, fmtTime, sgn, josa } from '../core/util.js';
import { MatchManager, MODES } from '../combat/MatchManager.js';
import { ArenaRenderer } from '../render/ArenaRenderer.js';
import { FighterRenderer } from '../render/FighterRenderer.js';
import { Fx } from '../render/Fx.js';
import { HUD } from '../render/HUD.js';
import { UI } from '../render/palette.js';
import { drawText } from '../render/pixelfont.js';
import { rect } from '../render/painter.js';
import { panel, menuList, fade, prompt } from '../render/ui.js';
import { BALANCE as B } from '../data/balance.js';
import { DIFFICULTY } from '../combat/AIController.js';
import { J } from '../anim/skeleton.js';
import { drawPortrait } from '../render/head.js';

const HOW = { ko: 'K.O.', pin: '핀폴', countout: '링아웃 카운트', ringout: '링아웃 탈락', decision: '판정', time: '시간 종료', 'double countout': '양자 링아웃' };
export class MatchScene {
  constructor(game, cfg, onEnd) {
    this.game = game; this.cfg = cfg; this.onEnd = onEnd;
    this.m = new MatchManager(cfg);
    this.ar = new ArenaRenderer(this.m.arena, this.m.arenaDef);
    this.fr = new FighterRenderer(); this.fr.setEnv({ rim: this.m.arenaDef.rim, light: this.m.arenaDef.light });
    this.fx = new Fx(); this.hud = new HUD(game.input);
    this.camX = clamp(this.m.arena.mid - VIEW_W / 2, 0, this.m.arena.width - VIEW_W);
    this.paused = false; this.sel = 0; this.debug = false; this.t = 0; this.endT = 0; this.resultShown = false; this.dark = 0; this.darkGoal = 0; this.focusPair = null; this.focusT = 0;
    this.introStep = -1; this.practiceSel = 0;
    this.wire();
    const tint = this.m.arenaDef.tint || [1, 1, 1];
    game.screen.resetFx(); game.screen.goal.tint = tint.slice(); game.screen.fx.tint = tint.slice();
    game.audio.music(cfg.music || (cfg.mode === 'rumble' || cfg.mode === 'royal' ? 'rumble' : cfg.boss ? 'boss' : 'match'));
    this.ar.setScreen(this.titleText(), MODES[this.m.mode].name, '#ffd65a');
  }
  titleText() { const F = this.m.fighters; if (F.length === 2) return F[0].name + ' VS ' + F[1].name; return (MODES[this.m.mode] || {}).name || ''; }
  get human() { return this.m.human; }
  // ---- events to effects ----
  wire() {
    const m = this.m, A = this.game.audio, fx = this.fx, S = this.game.screen, hud = this.hud, ar = this.ar;
    const isH = f => f && f.ctrl === 'human';
    const cheer = k => { ar.boost(k * .3); if (k > .5) A.cheer(Math.min(1.4, k)); };
    m.on('swing', e => { if (e.def.lv >= 2) A.sfx('swing'); });
    m.on('hit', e => {
      const d = e.d, p = d.lv >= 4 ? 1.6 : d.lv >= 3 ? 1.2 : d.lv >= 2 ? .8 : .5;
      fx.spark(e.x, e.y, p, e.counterHit ? '#ff8fc4' : '#fff3b0', e.dir);
      A.sfx(d.sfx || 'punch1');
      if (d.lv >= 3) { S.shake(.18 + p * .1); A.sfx('hurt', { voice: e.v.char.voice }); }
      if (d.lv >= 4) fx.sweat(e.x, e.y, 5);
      if (e.counterHit) fx.word('카운터!', e.x, e.y - 18, '#ff8fc4', 2);
      else if (d.lv >= 3) fx.word(d.lv >= 4 ? '콰직!' : e.combo > 2 ? '퍽퍽!' : '퍽!', e.x + e.dir * 6, e.y - 14, '#ffffff', 2);
      else if (d.lv === 1 && Math.random() < .25) fx.word(['팍', '탁', '퍽'][(Math.random() * 3) | 0], e.x, e.y - 10, '#ffe9a8', 1);
      if (e.armored) fx.word('버텼다!', e.v.x, e.v.y - 100, '#ffd65a', 1);
      if (d.lv >= 3) cheer(.4);
    });
    m.on('block', e => { fx.spark(e.x, e.y, .5, '#9fd6ff', sgn(e.v.x - e.a.x)); A.sfx('block'); });
    m.on('parry', e => { fx.spark(e.x, e.y, 1.4, '#ffffff'); fx.ring(e.x, e.v.y, 50, '#9fd6ff'); fx.word('패리!', e.x, e.y - 20, '#9fd6ff', 2); A.sfx('parry'); S.flash(.6, .9, 1, .35); cheer(.6); });
    m.on('guardBreak', e => { fx.word(e.shove ? '가드 깨기!' : '가드 크래시!', e.v.x, e.v.y - 96, '#ffb347', 2); A.sfx('punch3'); S.shake(.25); });
    m.on('dodge', e => { if (isH(e.f) || isH(e.a)) fx.word('회피', e.f.x, e.f.y - 96, '#9fd6ff', 1); });
    m.on('counter', e => { fx.word('반격!', e.f.x, e.f.y - 100, '#ff5fa2', 3); A.sfx('counter'); m.slowmo(.4, .3); S.flash(1, .6, .8, .25); cheer(.8); });
    m.on('reversal', e => { fx.word(e.fin ? '피니셔 역전!!' : '역전!', e.f.x, e.f.y - 104, '#ff5fa2', 3); A.sfx('reversal'); m.slowmo(.35, .45); S.flash(1, .5, .8, .4); cheer(1.2); });
    m.on('revFail', e => { if (isH(e.v)) fx.word('너무 일찍!', e.v.x, e.v.y - 100, '#9aa6d6', 1); });
    m.on('down', e => { if (!e.quiet) { A.sfx('down'); cheer(.6); if (e.n >= 2 && isH(e.a)) hud.toast(`${e.f.name} 다운 ${e.n}회 — 다음 다운이 더 길다`, '#ffb347'); } });
    m.on('grab', e => { A.sfx('grip'); });
    m.on('escape', e => { fx.word('탈출!', e.v.x, e.v.y - 100, '#6be38a', 2); A.sfx('whoosh'); });
    m.on('switch', () => A.sfx('grip'));
    m.on('grabStrike', e => { fx.spark(e.v.x, e.v.y - 50, .6); A.sfx('kick1'); });
    m.on('deny', e => { A.sfx('deny'); if (isH(e.f)) hud.toast(`${e.mv ? e.mv.name : '기술'}: ${e.why}`, '#ff8a8a'); });
    m.on('moveStart', e => {
      A.sfx(e.fin ? 'cry' : 'grunt', { voice: e.a.char.voice });
      if (e.fin) { this.finisherCam(e.a, e.v, e.fin); }
    });
    m.on('moveEvent', e => this.moveEvent(e));
    m.on('thud', e => { if (e.v > 220) { fx.dust(e.x, e.y, Math.min(1.4, e.v / 400)); A.sfx('thud', { p: Math.min(1, e.v / 500) }); } });
    m.on('wall', e => { S.shake(.35); A.sfx('punch3'); fx.word('쾅!', e.x, e.y - 30, '#ffffff', 2); fx.spark(e.x, e.y, 1); });
    m.on('rope', e => { A.sfx('rope'); });
    m.on('ropeHit', () => A.sfx('rope', { p: .7 }));
    m.on('ropeBody', () => A.sfx('rope', { p: .5 }));
    m.on('land', e => { const v = e.f.landV || 0; if (v > 200) { A.sfx('land', { p: Math.min(1, v / 500) }); fx.dust(e.f.x, e.f.y, .35); } });
    m.on('jump', () => A.sfx('jump'));
    m.on('dive', e => { A.sfx('whoosh', { pitch: 1.6 }); cheer(.6); });
    m.on('landAttack', e => { A.sfx('thud', { p: .8 }); fx.dust(e.f.x, e.f.y, e.def.quake ? 1.5 : .6); if (e.def.quake) { S.shake(.4); fx.ring(e.f.x, e.f.y, e.def.quake, '#ffffff'); } if (!e.ok && e.def.dive) fx.word('아야야!', e.f.x, e.f.y - 40, '#9aa6d6', 1); });
    m.on('finisherStart', e => { A.sfx('charge'); fx.ring(e.f.x, e.f.y, 60, e.F.color); hud.push('피니셔!', { col: e.F.color, scale: 2, y: 90, life: .9 }); cheer(.8); S.flash(1, 1, 1, .15); });
    m.on('finisherHit', e => { A.sfx('finisher'); hud.finisherCard(e.f, e.F); this.ar.setScreen(e.F.name, e.f.name, e.F.color, true); cheer(1.4); });
    m.on('finisherMiss', e => { fx.word(e.why === 'blocked' ? '막혔다!' : e.why === 'crash' ? '헛디뎠다!' : '빗나감!', e.f.x, e.f.y - 100, '#9aa6d6', 2); A.boo(.6); A.sfx('miss'); });
    m.on('finReady', e => { if (isH(e.f)) { hud.toast(`피니셔 준비! [${this.game.input.label('fin')}]`, '#3fe0d0'); A.sfx('good'); } });
    m.on('taunt', e => { cheer(.5); });
    m.on('burst', e => { fx.ring(e.f.x, e.f.y, 110, '#ffffff', .5); fx.spark(e.f.x, e.f.y - 50, 1.5, '#9fe0ff'); S.flash(.8, .95, 1, .3); A.sfx('parry'); fx.word('긴급 탈출!', e.f.x, e.f.y - 104, '#9fe0ff', 2); });
    m.on('stagger', e => { fx.word('어질…', e.f.x, e.f.y - 100, '#ffd65a', 1); });
    m.on('overRope', e => { if (m.rules.ringOut === 'elim') cheer(.7); });
    m.on('eliminated', e => { A.sfx('bell'); hud.push('탈락!', { col: '#ff5b5b', sub: e.f.name, y: 110, life: 1.4 }); cheer(1); });
    m.on('entry', e => { hud.push('입장!', { col: e.f.char.color, sub: e.f.name + ' — ' + e.f.char.nick, y: 100, life: 1.8 }); A.sfx('bell'); cheer(1); this.ar.setScreen(e.f.name, '입장!', e.f.char.color, true); });
    m.on('hang', e => { fx.word('매달렸다!', e.f.x, e.f.y - 70, '#ffb347', 2); cheer(.8); });
    m.on('pin', () => { A.sfx('grip'); cheer(.6); });
    m.on('count', e => { if (e.pin) { A.sfx('count', { n: e.n }); cheer(.3 * e.n); this.ar.setScreen(String(e.n), '카운트', e.n >= 3 ? '#ff5b5b' : '#ffffff'); } else A.sfx('tick'); });
    m.on('kickout', e => { fx.word('킥아웃!', e.v.x, e.v.y - 60, '#6be38a', 3); cheer(1.3); this.ar.setScreen('킥아웃!', String(e.count), '#6be38a', true); });
    m.on('tag', e => { fx.word('교대!', e.f.x, e.f.y - 90, '#6be38a', 2); A.sfx('slap'); cheer(.9); });
    m.on('ko', e => { A.sfx('ko'); A.sfx('bell3'); S.shake(.5); m.slowmo(.25, 1.2); this.ar.setScreen('K.O.!', e.v.name, '#ff5b5b', true); cheer(1.5); });
    m.on('ready', () => { hud.push('준비…', { col: '#ffffff', y: 140, life: 1.2, scale: 3 }); this.ar.setScreen('준비', this.titleText(), '#ffffff'); });
    m.on('bell', () => { A.sfx('bell'); hud.push('파이트!', { col: '#ffd65a', y: 140, life: 1, scale: 4, grad: '#ff8a2b' }); this.ar.setScreen(this.titleText(), MODES[m.mode].name, '#49d6ff'); cheer(1); });
    m.on('end', r => this.onMatchEnd(r));
    m.on('whip', () => A.sfx('whoosh'));
    m.on('sweep', e => { A.sfx('punch2'); fx.spark(e.o.x, e.o.y - 40, 1); });
    m.on('fault', e => console.warn('fault', e.why, e.f && e.f.name, JSON.stringify(e.info || {})));
  }
  moveEvent(e) {
    const { k, o, a, v, move } = e, A = this.game.audio, fx = this.fx, S = this.game.screen, fin = e.fin;
    const gx = v ? v.joints.x(J.pelvis) : a.x, gy = this.m.arena.ground(gx, a.y, a.side);
    switch (k) {
      case 'impact': {
        const p = o.p || 1;
        S.shake(Math.min(1, .25 + p * .22)); A.sfx('slam', { p });
        fx.dust(gx, gy, p * .9); fx.ring(gx, gy, 40 + p * 30, '#ffffff', .35 + p * .1);
        if (v) { const hx = v.joints.x(J.head), hy = v.joints.y(J.head); fx.spark(hx, hy, Math.min(2, p), fin ? fin.color : '#fff3b0'); fx.sweat(hx, hy, 4 + p * 2); }
        if (o.word) fx.word(o.word, gx, gy - 60 - p * 8, fin ? fin.color : '#ffffff', fin ? 3 : 2);
        this.m.arena.slam(gx, p);
        if (fin) { S.flash(1, 1, 1, .45); S.goal.zoom = Math.max(S.goal.zoom, 1.42); this.focusT = Math.max(this.focusT, .6); S.fx.chroma = 1; fx.screenLines = .5; fx.lineCol = fin.color; }
        if (o.spark) fx.weld(gx, gy - 60);
        this.ar.boost(.3 + p * .15); if (p >= 1) A.cheer(Math.min(1.5, p * .7));
        break;
      }
      case 'smack': { const x = v ? v.joints.x(J.head) : a.x, y = v ? v.joints.y(J.head) : a.y - 60; fx.spark(x, y, 1, fin ? fin.color : '#fff3b0'); A.sfx(o.spark ? 'punch2' : 'slap'); if (o.spark) fx.weld(x, y); if (o.word) fx.word(o.word, x, y - 16, '#ffffff', 2); S.shake(.18); break; }
      case 'squeeze': if (v) { fx.sweat(v.joints.x(J.head), v.joints.y(J.head), 3); if (o.word) fx.word(o.word, v.x, v.y - 90, '#ff8fc4', 2); A.sfx('hurt', { voice: v.char.voice }); } break;
      case 'whoosh': A.sfx('whoosh'); break;
      case 'spin': A.sfx('spin'); break;
      case 'lift': A.sfx('lift', { voice: a.char.voice }); break;
      case 'grunt': A.sfx('grunt', { voice: a.char.voice }); break;
      case 'cry': A.sfx('cry', { voice: a.char.voice }); fx.word(fin ? fin.line || '' : '', a.x, a.y - 120, '#ffffff', 1); break;
      case 'charge': A.sfx('charge'); fx.ring(a.x, a.y, 50, fin ? fin.color : '#ffffff'); break;
      case 'grip': A.sfx('grip'); break;
      case 'dust': fx.dust(gx, gy, 1); break;
      case 'splash': fx.splash(a.x, a.y); A.sfx('splash'); break;
      case 'fin': fx.splash(a.x + a.face * 20, a.y); break;
      case 'ink': fx.smoke(v ? v.x : a.x, a.y - 50, '#2a1440', 22); A.sfx('ink'); this.fx.ink = 1.4; break;
      case 'blackout': this.darkGoal = .86; A.sfx('lightsOff'); this.darkUntil = this.m.time + 2.1; break;
    }
  }
  finisherCam(a, v) { this.focusPair = { a, v }; this.focusT = 2.2; this.m.slowmo(.5, .45); this.fx.screenLines = .8; }
  onMatchEnd(r) {
    this.endT = 0;
    const h = this.human, win = h && r.winner && r.team === h.team;
    const A = this.game.audio;
    setTimeout(() => A.jingle(r.draw ? 'lose' : !h ? 'win' : win ? 'win' : 'lose'), 900);
    this.hud.push(r.draw ? '무승부' : win || !h ? '승리!' : '패배…', { col: r.draw ? '#c9d4ff' : win || !h ? '#ffd65a' : '#ff5b5b', sub: r.draw ? HOW[r.how] : `${r.winner ? r.winner.name : ''} · ${HOW[r.how] || r.how}`, y: 120, life: 3, scale: 4 });
    if (r.winner) { this.fx.confetti(r.winner.x, 140, 90); }
    this.ar.setScreen(r.draw ? '무승부' : (r.winner ? r.winner.name : ''), HOW[r.how] || '', '#ffd65a', true);
  }
  // ---- per frame ----
  update(dt) {
    const g = this.game, inp = g.input, m = this.m;
    this.t += dt;
    if (inp.rawPressed('F3') || inp.rawPressed('Backquote')) this.debug = !this.debug;
    if (this.resultShown) { if (inp.menuPressed('confirm')) this.finish(); return; }
    if (this.paused) { this.pauseInput(); return; }
    if (inp.pressed('pause') && m.phase !== 'end') { this.paused = true; this.sel = 0; g.audio.sfx('ui'); return; }
    // human input
    const h = this.human;
    if (h && m.phase === 'fight') inp.fillIntent(h.intent);
    if (m.phase === 'intro' && (inp.menuPressed('confirm') || inp.pressed('atk'))) { m.introT = 99; }
    m.update(dt);
    if (m.phase === 'end') { this.endT += dt; if (h && h.st !== 'KO' && h.alive && m.result && m.result.team === h.team && h.st !== 'WIN' && this.endT > 1.2 && !h.link && h.ground) h.set('WIN', { force: true }); if (this.endT > 1.4) for (const f of m.fighters) if (f.alive && f.st !== 'WIN' && m.result && m.result.team === f.team && !f.link && f.ground && f.st !== 'KO' && !h) f.set('WIN', { force: true }); if (this.endT > 3.4) this.resultShown = true; }
    this.fx.update(m.freeze > 0 ? dt * .3 : dt * m.slowK);
    this.ar.update(dt, m.hype);
    this.hud.update(dt, m);
    g.audio.crowd(.3 + m.hype / 100 * .7);
    this.camera(dt);
    // lights out
    if (this.darkUntil && m.time > this.darkUntil) { this.darkGoal = 0; this.darkUntil = 0; }
    this.dark = damp(this.dark, this.darkGoal, 9, dt);
  }
  camera(dt) {
    const m = this.m, S = this.game.screen, ar = m.arena;
    let tx;
    const act = m.fighters.filter(f => !f.gone && (f.alive || f.st === 'KO') && f.st !== 'TAGWAIT');
    if (m.phase === 'intro') {
      const F = m.fighters.filter(f => f.st === 'INTRO'), n = F.length, step = n ? Math.min(n - 1, Math.floor(m.introT / ((m.cfg.introTime || 3.2) / n))) : -1;
      if (step !== this.introStep && F[step]) { this.introStep = step; const f = F[step]; this.hud.push(f.name, { col: f.char.color, sub: f.char.nick + ' · ' + (DIFFICULTY[f.difficulty] && f.ctrl !== 'human' ? DIFFICULTY[f.difficulty].name : '플레이어'), y: 188, life: (m.cfg.introTime || 3.2) / n, scale: 3, from: f.x < ar.mid ? -1 : 1 }); for (const o of F) o.spot = o === f; this.game.audio.cheer(.7); }
      const f = F[Math.max(0, step)];
      tx = f ? f.x : ar.mid;
      if (f) { S.focus(f.x - this.camX, f.y - 60, 1.3); }
    } else {
      for (const f of m.fighters) f.spot = false;
      const h = this.human;
      let sum = 0, wsum = 0;
      for (const f of act) { const w = f === h ? 2.2 : f.side === 'in' ? 1 : .6; sum += f.x * w; wsum += w; }
      tx = wsum ? sum / wsum : ar.mid;
      if (h && act.length > 1) { const lo = h.x - VIEW_W / 2 + 70, hi = h.x + VIEW_W / 2 - 70; tx = clamp(tx, lo, hi); }
      if (this.focusT > 0 && this.focusPair) {
        this.focusT -= dt;
        const { a, v } = this.focusPair, fx = (a.x + v.x) / 2, fy = Math.min(a.y, v.y) - 60;
        S.focus(fx - this.camX, fy, this.focusT > 1.6 ? 1.32 : 1.18);
        if (this.focusT <= 0) { this.focusPair = null; S.unfocus(); }
      } else if (m.phase === 'end' && m.result && m.result.loser && this.endT < 2.4) { const l = m.result.loser; S.focus(l.x - this.camX, l.y - 40, 1.35); }
      else S.unfocus();
    }
    const want = clamp(tx - VIEW_W / 2, 0, ar.width - VIEW_W);
    this.camX = damp(this.camX, want, m.phase === 'intro' ? 4 : 5.5, dt);
  }
  pauseInput() {
    const inp = this.game.input, A = this.game.audio, items = this.pauseItems();
    if (inp.pressed('up')) { this.sel = (this.sel + items.length - 1) % items.length; A.sfx('ui'); }
    if (inp.pressed('down')) { this.sel = (this.sel + 1) % items.length; A.sfx('ui'); }
    const it = items[this.sel];
    if ((inp.pressed('left') || inp.pressed('right')) && it.cycle) { it.cycle(inp.pressed('left') ? -1 : 1); A.sfx('ui'); }
    if (inp.menuPressed('cancel') || inp.pressed('pause')) { this.paused = false; A.sfx('back'); this.game.input.clear(); return; }
    if (inp.menuPressed('confirm')) { A.sfx('ok'); if (it.act) it.act(); }
  }
  pauseItems() {
    const P = this.m.practice;
    const items = [{ label: '계속하기', act: () => { this.paused = false; this.game.input.clear(); } }, { label: '조작법', act: () => this.game.showControls(this) }, { label: '디버그 표시', value: this.debug ? '켬' : '끔', act: () => { this.debug = !this.debug; }, cycle: () => { this.debug = !this.debug; } }];
    if (P) {
      const beh = ['idle', 'guard', 'attack', 'dodge', 'escape', 'ai'], names = { idle: '가만히', guard: '방어만', attack: '공격', dodge: '회피·반격', escape: '탈출 연타', ai: '일반 AI' };
      const foe = this.m.fighters.find(f => f.ctrl !== 'human');
      const cur = foe && foe.ai ? (foe.ai.behavior || 'ai') : 'idle';
      items.push({ label: '상대 행동', value: names[cur], cycle: d => { const i = (beh.indexOf(cur) + d + beh.length) % beh.length; if (foe && foe.ai) { foe.ai.behavior = beh[i] === 'ai' ? null : beh[i]; foe.ctrl = beh[i] === 'ai' ? 'ai' : 'dummy'; } }, act: () => items[3].cycle(1) });
      items.push({ label: '상대 체력 무한', value: P.infinite ? '켬' : '끔', cycle: () => { P.infinite = !P.infinite; }, act: () => { P.infinite = !P.infinite; } });
      items.push({ label: '내 피니셔 가득', value: P.fullFin ? '켬' : '끔', cycle: () => { P.fullFin = !P.fullFin; }, act: () => { P.fullFin = !P.fullFin; } });
      items.push({ label: '상대 기절 저항 0', value: P.stunLock ? '켬' : '끔', cycle: () => { P.stunLock = !P.stunLock; }, act: () => { P.stunLock = !P.stunLock; } });
      items.push({ label: '상대 회복', act: () => { for (const f of this.m.fighters) { f.hp = f.maxHp; f.stun = f.maxStun; } } });
      items.push({ label: '연습 끝내기', act: () => this.finish(true) });
    } else items.push({ label: this.cfg.career ? '기권 (패배 처리)' : '경기 포기', act: () => { this.paused = false; const h = this.human; const w = this.m.fighters.find(f => h && f.team !== h.team); this.m.end({ winner: w, loser: h, how: 'forfeit', team: w ? w.team : null, forfeit: true }); } });
    return items;
  }
  finish(quit) {
    if (this.done) return;
    this.done = true;
    this.game.screen.resetFx();
    const r = this.m.result || { forfeit: true, quit };
    const summary = this.m.summary(), h = this.human;
    if (this.onEnd) this.onEnd({ result: r, summary, human: h ? summary[h.idx] : null, won: !!(h && r.winner && r.team === h.team), draw: !!r.draw, time: this.m.clock, quit: !!quit, match: this.m });
  }
  // ---- drawing ----
  draw(w, u) {
    const m = this.m, cam = Math.round(this.camX);
    this.ar.drawBack(w, cam);
    this.fr.drawAll(w, m, cam, { dt: 1 / 60 });
    this.ar.drawFront(w, cam);
    this.fx.draw(w, cam);
    const h = this.human;
    this.ar.drawLights(w, cam, h ? h.x : null);
    if (this.fx.ink > 0) { w.globalAlpha = Math.min(.55, this.fx.ink * .4); rect(w, '#14081e', 0, 0, VIEW_W, VIEW_H); w.globalAlpha = 1; }
    if (this.dark > .02) { w.globalAlpha = this.dark; rect(w, '#020208', 0, 0, VIEW_W, VIEW_H); w.globalAlpha = 1; const L = m.links.find(l => l.fin); if (L) for (const f of [L.a, L.v]) if (f) { rect(w, '#ffffff', Math.round(f.joints.x(J.head) - cam) + f.face * 3, Math.round(f.joints.y(J.head)) - 1, 2, 1); } }
    this.fx.drawLines(w, VIEW_W, VIEW_H);
    if (this.debug) this.drawDebug(w, cam);
    u.clearRect(0, 0, VIEW_W, VIEW_H);
    this.hud.draw(u, m, cam, { hide: m.phase === 'intro' && false });
    if (m.phase === 'intro') { drawText(u, `${this.game.input.label('confirm')} 건너뛰기`, 632, 346, { size: 11, align: 'r', color: UI.dim, outline: '#05060f' }); }
    if (this.paused) this.drawPause(u);
    if (this.resultShown) this.drawResult(u);
  }
  drawPause(u) {
    fade(u, .55);
    panel(u, 210, 70, 220, 220, { accent: '#ffd65a' });
    drawText(u, '일시정지', 320, 80, { align: 'c', color: '#ffd65a', bold: true });
    menuList(u, this.pauseItems(), this.sel, 228, 108, { w: 184, lh: 19 });
    drawText(u, '←→ 값 바꾸기  Enter 선택  Esc 닫기', 320, 272, { size: 11, align: 'c', color: UI.dim });
  }
  drawResult(u) {
    const m = this.m, r = m.result, h = this.human;
    fade(u, .62);
    const win = h && r && r.winner && r.team === h.team;
    panel(u, 130, 40, 380, 270, { accent: win ? '#ffd65a' : '#ff5b5b' });
    drawText(u, r.draw ? '무승부' : !h ? '경기 종료' : win ? '승리!' : '패배', 320, 52, { scale: 2, align: 'c', color: r.draw ? '#c9d4ff' : win || !h ? '#ffd65a' : '#ff5b5b', bold: true, outline: '#05060f' });
    drawText(u, `${HOW[r.how] || (r.forfeit ? '기권' : r.how || '')} · 경기 시간 ${fmtTime(m.clock)}`, 320, 84, { size: 11, align: 'c', color: UI.dim });
    if (r.winner) { u.fillStyle = '#05060f'; drawPortrait(u, r.winner.look, 'happy', 150, 104, 44, { px: 2, dy: 6 }); drawText(u, josa(r.winner.name, '이/가') + ' 이겼다', 204, 108, { color: '#ffffff' }); drawText(u, r.winner.char.lines.win, 204, 126, { size: 11, color: r.winner.char.color }); }
    if (h) {
      const S = m.summary()[h.idx];
      const rows = [['준 피해', S.dmgDealt.toFixed(0)], ['받은 피해', S.dmgTaken.toFixed(0)], ['다운 시킨 횟수', String(m.fighters.filter(f => f.isFoe(h)).reduce((s, f) => s + f.downs, 0))], ['다운 당한 횟수', String(S.downs)], ['사용한 기술 종류', String(S.moves)], ['반격·역전', String(S.counters)], ['패리', String(S.perfects)]];
      rows.forEach(([k, v], i) => { drawText(u, k, 160, 162 + i * 16, { size: 11, color: UI.dim }); drawText(u, v, 480, 162 + i * 16, { size: 11, align: 'r', color: '#ffffff' }); });
    }
    prompt(u, [this.game.input.label('confirm')], '계속', 320, 290, { align: 'c' });
  }
  drawDebug(g, cam) {
    const m = this.m;
    for (const f of m.fighters) {
      if (f.gone) continue;
      const hb = m.combat.hurtbox(f);
      g.strokeStyle = '#6be38a'; g.lineWidth = 1; g.strokeRect(Math.round(hb.x0 - cam) + .5, Math.round(hb.y0) + .5, Math.round(hb.x1 - hb.x0), Math.round(hb.y1 - hb.y0));
      const a = m.combat.hitbox(f);
      if (a) { g.strokeStyle = '#ff5b5b'; g.strokeRect(Math.round(a.x0 - cam) + .5, Math.round(a.y0) + .5, Math.round(a.x1 - a.x0), Math.round(a.y1 - a.y0)); }
      const x = Math.round(f.x - cam), y = Math.round(hb.y0 - 34);
      drawText(g, `${f.st}${f.hsKind && f.st === 'HITSTUN' ? ':' + f.hsKind : ''}`, x, y, { size: 11, align: 'c', color: '#ffffff', outline: '#05060f' });
      drawText(g, `HP${f.hp.toFixed(0)} ST${Math.max(0, f.stun).toFixed(0)} v${f.vx.toFixed(0)},${f.vy.toFixed(0)}`, x, y + 11, { size: 11, align: 'c', color: '#ffd65a', outline: '#05060f' });
      if (f.ai) drawText(g, `AI:${f.ai.note}`, x, y + 22, { size: 11, align: 'c', color: '#7fe0ff', outline: '#05060f' });
      rect(g, '#ff5fa2', x, Math.round(f.y), 1, 1);
    }
    drawText(g, `fps ${this.game.fps.toFixed(0)}  links ${m.links.length}  hype ${m.hype.toFixed(0)}  slow ${m.slowK.toFixed(2)}`, 6, 320, { size: 11, color: '#ffffff', outline: '#05060f' });
  }
}
export const matchHow = HOW;
export const balanceRef = B;
