// A match on screen: simulation + camera + effects + sound + HUD + pause + results.
import { VIEW_W, VIEW_H, clamp, damp, fmtTime, sgn, josa } from '../core/util.js';
import { MatchManager, MODES } from '../combat/MatchManager.js';
import { ArenaRenderer } from '../render/ArenaRenderer.js';
import { FighterRenderer } from '../render/FighterRenderer.js';
import { Fx } from '../render/Fx.js';
import { HUD } from '../render/HUD.js';
import { UI } from '../render/palette.js';
import { drawText, textWidth } from '../render/pixelfont.js';
import { drawProps, drawChairAt } from '../render/PropRenderer.js';
import { drawSpecialBack, drawSpecialFront } from '../render/SpecialRenderer.js';
import { SPECIAL } from '../combat/SpecialRules.js';
import { Lockstep } from '../net/Lockstep.js';
import { newIntent } from '../combat/CharacterController.js';
import { BodyCanvas } from '../render/raster.js';
import { drawBody } from '../render/body.js';
import { Actor } from '../world/Actor.js';
import { FLOOR } from '../world/locations.js';
import { Dialogue } from '../world/Dialogue.js';
import { Tutorial } from './Tutorial.js';
import { rect } from '../render/painter.js';
import { panel, menuList, fade, prompt } from '../render/ui.js';
import { BALANCE as B } from '../data/balance.js';
import { DIFFICULTY } from '../combat/AIController.js';
import { J, JN, Joints } from '../anim/skeleton.js';
import { drawPortrait } from '../render/head.js';

import { MOVES } from '../data/moves.js';
const MOVES_NAME = id => (MOVES[id] ? MOVES[id].name : id);
const HOW = { nocontest: '노 콘테스트 (난입)', ko: 'K.O.', pin: '핀폴', countout: '링아웃 카운트', ringout: '링아웃 탈락', decision: '판정', time: '시간 종료', 'double countout': '양자 링아웃', ladder: '가방 획득', escape: '철창 탈출', iron: '아이언맨 폴 판정', falls: '폴 판정' };
export class MatchScene {
  constructor(game, cfg, onEnd) {
    this.game = game; this.cfg = cfg; this.onEnd = onEnd;
    this.m = new MatchManager(cfg);
    this.ar = new ArenaRenderer(this.m.arena, this.m.arenaDef);
    this.fr = new FighterRenderer(); this.fr.setEnv({ rim: this.m.arenaDef.rim, light: this.m.arenaDef.light });
    this.fx = new Fx(); this.hud = new HUD(game.input);
    this.camX = clamp(this.m.arena.mid - VIEW_W / 2, 0, this.m.arena.width - VIEW_W);
    this.paused = false; this.sel = 0; this.debug = false; this.t = 0; this.endT = 0; this.resultShown = false; this.dark = 0; this.darkGoal = 0; this.focusPair = null; this.focusT = 0;
    this.introStep = -1; this.practiceSel = 0; this.cameoActors = new Map(); this.lastDt = 1 / 60;
    // career matches: a few words face to face before the bell (the intro waits for it)
    this.pre = cfg.preTalk && cfg.career && !cfg.skipIntro ? cfg.preTalk : null; this.talk = null;
    if (this.pre) this.m.holdIntro = true;
    this.wire();
    this.tut = cfg.tutorial ? new Tutorial(this) : null; this.tutDone = false;
    const tint = this.m.arenaDef.tint || [1, 1, 1];
    game.screen.resetFx(); game.screen.goal.tint = tint.slice(); game.screen.fx.tint = tint.slice();
    game.audio.music(cfg.music || (cfg.mode === 'rumble' || cfg.mode === 'royal' ? 'rumble' : cfg.boss ? 'boss' : 'match'));
    this.online = cfg.online || null;
    if (this.online) { this.lock = new Lockstep(this.online.net, this.online.localIdx, this.online.delay || 4); this.online.net.on('close', () => { this.netLost = true; }); this.online.net.on('data', d => { if (d && d.t === 'bye') this.netLost = true; }); }
    { const SP0 = this.m.special; this.ar.setScreen(this.titleText(), (SP0 && SP0.type ? SPECIAL[SP0.type].name : MODES[this.m.mode].name) + (SP0 && SP0.falls ? ' · 3판 2선승' : SP0 && SP0.iron ? ' · 아이언맨' : ''), '#ffd65a'); }
    { const hm = this.m.human, bf = this.m.fighters.find(f => f.char.br && (!hm || f.team !== hm.team)); if (bf) { this.ar.setScreen('BLACK ROPE', `${bf.name} — ${bf.char.nick}`, '#b066d8', true); this.game.screen.flash(.7, .3, 1, .3); } }   // their entrance: the crew's name on the board, purple light
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
    m.on('chairShrug', e => { fx.word('버텼다!', e.v.x, e.v.y - 100, '#ffd65a', 2); });
    m.on('down', e => { if (!e.quiet) { A.sfx('down'); cheer(.6); if (e.n >= 2 && isH(e.a) && !e.chair) hud.toast(`${e.f.name} 다운 ${e.n}회 — 다음 다운이 더 길다`, '#ffb347'); } });
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
    m.on('dive', e => { A.sfx('whoosh', { pitch: 1.6 }); cheer(e.out ? 1.1 : .6); if (e.out) fx.word('장외 다이빙!', e.f.x, e.f.y - 70, '#ffd65a', 2); });
    m.on('perchDeny', e => { A.sfx('deny'); if (isH(e.f)) hud.toast('여기서 밖으로 뛰면 탈락이다! 안쪽을 보고 다이빙', '#ff8a8a'); });
    m.on('perchTurn', e => { A.sfx('step'); });
    m.on('dashStart', e => { A.sfx('whoosh', { pitch: 1.3 }); fx.dust(e.f.x - e.f.face * 10, e.f.y, .5); if (isH(e.f)) fx.word('돌진!', e.f.x, e.f.y - 96, '#ffd65a', 1); });
    // special matches
    const SP = m.special;
    m.on('fall', e => { A.sfx('bell3'); const sc = e.score, t0 = sc[0] || 0, t1 = sc[1] || 0; hud.push(`${e.name} 폴: ${e.winner.name}`, { col: '#ffd65a', scale: 2, y: 96, life: 2.2, sub: `${t0} : ${t1}` }); cheer(1.2); this.ar.setScreen(`${t0} : ${t1}`, `${e.name} 폴`, '#ffd65a', true); });
    m.on('fallReset', () => { S.flash(0, 0, 0, .5); });
    m.on('suddenDeath', () => { A.sfx('bell3'); hud.push('서든 데스!', { col: '#ff5b5b', scale: 3, y: 100, life: 1.8, sub: '다음 폴을 따는 쪽이 이긴다' }); this.ar.setScreen('서든 데스', '', '#ff5b5b', true); });
    m.on('bossPhase', e => { A.sfx('charge'); S.flash(1, .3, .3, .25); S.shake(.5); const nm = e.names && e.names[e.phase - 1]; hud.push(`${e.f.name} ${e.phase}페이즈!`, { col: '#ff5b5b', scale: 2, y: 96, life: 1.8, sub: nm || (e.phase >= 3 ? '마지막 힘을 끌어낸다' : '더 강해졌다') }); fx.ring(e.f.x, e.f.y - 40, 90, '#ff5b5b', .6); this.ar.setScreen(`${e.phase} PHASE`, e.f.name, '#ff5b5b', true); cheer(1.2); });
    m.on('ladderClimb', e => { A.sfx('step'); if (isH(e.f) && !this.ladderTip) { this.ladderTip = 1; hud.toast('W 오르기 · J 주먹/발차기 · K 위 상대 다리 잡기 · 꼭대기: K 타이밍, A/D 내려갈 쪽', '#ffd65a'); } });
    m.on('ladderRaise', e => { A.sfx('clang', { p: .6 }); fx.word('사다리를 펼친다', e.f.x, e.f.y - 96, '#c9d4ff', 1); });
    m.on('ladderUp', () => { A.sfx('clang', { p: .7 }); cheer(.5); });
    m.on('ladderDrop', () => { A.sfx('clang', { p: .5 }); });
    m.on('ladderFold', e => { A.sfx('clang'); S.shake(.45); fx.word('사다리를 접었다!', e.by.x, e.by.y - 96, '#ffffff', 2); cheer(1.1); });
    m.on('ladderCross', e => { A.sfx('step'); fx.word('넘어간다', e.f.x, e.f.y - 100, '#c9d4ff', 1); });
    m.on('caseHit', e => { A.sfx('tick'); fx.word(`${e.hits}/${e.need}`, e.f.x, e.f.y - 120, e.hits >= e.need - 2 ? '#ff8a2b' : '#ffd65a', 2); if (e.hits >= e.need - 3) cheer(.6); });
    m.on('caseMiss', () => { A.sfx('miss'); });
    m.on('caseHang', e => { A.sfx('grip'); fx.word('가방에 매달렸다!', e.f.x, e.f.y - 110, '#ffd65a', 2); cheer(1.3); });
    m.on('climbHit', e => { A.sfx(e.kind === 'kick' ? 'kick2' : 'punch2'); fx.spark(e.v.x, e.v.y - 60, 1, '#fff3b0'); });
    m.on('legPull', e => { A.sfx('grip'); fx.word('다리를 잡아챘다!', e.a.x, e.a.y - 100, '#6be38a', 2); });
    m.on('climbKick', () => { A.sfx('kick2'); });
    m.on('climbDive', e => { A.sfx('whoosh', { pitch: 1.4 }); cheer(1.3); fx.word(e.h > 80 ? '초고공 다이빙!' : '다이빙!', e.f.x, e.f.y - 70, '#ffd65a', 2); });
    m.on('climbFall', e => { A.sfx('punch3'); cheer(1.1); fx.word(e.h > .6 ? '높은 곳에서 추락!' : '떨어졌다!', e.v.x, e.v.y - 60, '#ffffff', 2); });
    m.on('pullDown', e => { A.sfx('grip'); fx.word('끌어내렸다!', e.a.x, e.a.y - 90, '#6be38a', 2); });
    m.on('cageTop', e => { A.sfx('clang', { p: .7 }); fx.word('꼭대기!', e.f.x, e.f.y - 100, '#ff8a2b', 2); cheer(1.4); });
    m.on('cageClimb', e => { A.sfx('clang', { p: .5 }); if (isH(e.f)) hud.toast('철창을 오른다! W 계속 · J 주먹/발차기 · K 위 상대 다리 잡기 · A/D 안쪽 보고 J 다이빙', '#ffd65a'); cheer(.8); });
    m.on('cageEscape', e => { A.sfx('crowdBoom'); fx.word('탈출!', e.f.x, e.f.y - 100, '#ffd65a', 3); });
    m.on('cageHit', e => { A.sfx('clang'); S.shake(.3); fx.spark(e.f.x, e.f.y - 50, 1.2, '#c9d4ff'); });
    m.on('cellHit', e => { A.sfx('clang'); S.shake(.4); fx.spark(e.f.x, e.f.y - 50, 1.4, '#ff8a8a'); fx.word('철창에 쾅!', e.f.x, e.f.y - 80, '#ffffff', 2); });
    m.on('upgrade', e => { A.sfx('charge'); fx.word(e.o.name, e.a.x, e.a.y - 118, e.o.cost ? '#ff8a2b' : '#ffd65a', 3); cheer(e.o.cost ? 1.2 : .7); if (e.o.cost) this.ar.setScreen(e.o.name.replace('!', ''), e.a.name, '#ff8a2b', true); });
    m.on('followUp', e => { A.sfx('grip'); fx.word('연계! ' + (e.name || ''), e.a.x, e.a.y - 112, '#ffd65a', 2); cheer(.5); });
    m.on('signature', e => { A.sfx('crowdBoom'); hud.push(e.name, { col: '#ffd65a', scale: 2, y: 96, life: 1.3, sub: '시그니처 콤보!' }); cheer(1.4); this.ar.setScreen(e.name, e.a.name, '#ffd65a', true); });
    m.on('comboStep', e => { if (e.n >= 3) fx.word(`${e.n}연계!`, e.a.x, e.a.y - 128, '#ff8fc4', 2); });
    m.on('special', e => { A.sfx('charge'); fx.word(MOVES_NAME(e.id) + '!', e.a.x, e.a.y - 112, e.cost >= 50 ? '#ff8a2b' : '#49d6ff', e.cost >= 50 ? 3 : 2); cheer(e.cost >= 50 ? 1.3 : .7); if (e.cost >= 50) this.ar.setScreen(MOVES_NAME(e.id), e.a.name, '#ff8a2b', true); });
    m.on('sCounter', e => { A.sfx('counter'); S.flash(1, 1, 1, .2); hud.push(e.name + '!', { col: '#ff5fa2', scale: 2, y: 100, life: 1.0, sub: `에너지 ${e.cost}` }); cheer(1.3); });
    m.on('rollAway', e => { A.sfx('whoosh'); fx.word('피했다!', e.v.x, e.v.y - 50, '#6be38a', 2); fx.dust(e.a.x, e.a.y, .8); cheer(.8); });
    m.on('subEscape', e => { A.sfx('good'); fx.word('빠져나왔다!', e.v.x, e.v.y - 50, '#6be38a', 2); cheer(.6); });
    m.on('seated', e => { A.sfx('rope'); if (isH(e.a)) hud.toast('코너 위에 앉혔다! K 턴버클 백드롭 · Space 슈퍼 저먼(에너지 50) · J 밀어 떨어뜨리기', '#ffd65a'); });
    m.on('seatKnock', e => { A.sfx('punch3'); fx.word('밀려 떨어진다!', e.v.x, e.v.y - 40, '#ffffff', 2); cheer(.9); });
    m.on('carry', e => { A.sfx('lift', { voice: e.a.char.voice }); if (isH(e.a)) hud.toast('어깨에 멨다! 걸어서 코너로 가 K', '#ffd65a'); });
    m.on('springboard', e => { A.sfx('rope'); cheer(1); });
    m.on('pinBonus', e => { fx.word('꽉 눌렀다!', e.a.x, e.a.y - 70, '#ffd65a', 2); });
    m.on('dashSig', e => { A.sfx('charge'); fx.word(MOVES_NAME(e.id) + '!', e.f.x, e.f.y - 110, '#ffd65a', 3); cheer(1); this.ar.setScreen(MOVES_NAME(e.id), e.f.name, '#ffd65a', true); });
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
    m.on('lateEntry', e => { hud.push('난입!', { col: e.f.char.color, sub: e.f.name + ' — ' + e.f.char.nick, y: 100, life: 2 }); A.sfx('warn'); cheer(1.2); });
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
    // chairs and run-ins
    const K = a => this.game.input.label(a);
    m.on('chairHit', e => { A.sfx('clang', { p: e.guarded ? .7 : 1 }); S.shake(e.guarded ? .2 : .42); fx.spark(e.x, e.y, e.guarded ? .9 : 1.8, '#e6ecff'); fx.word(e.guarded ? '막았다!' : e.thrown ? '와장창!' : '깡!', e.x, e.y - 22, '#e6ecff', e.guarded ? 2 : 3); if (e.guarded) cheer(.5); else { cheer(1.3); this.ar.setScreen('체어샷!', e.v.name, '#ffd65a', true); } });
    m.on('chairParry', e => { fx.word('의자를 쳐냈다!', e.v.x, e.v.y - 104, '#9fd6ff', 2); cheer(1); });
    m.on('chairSlam', e => { fx.word(e.k >= 2 ? '의자 위로! 피해 2배' : `의자 위로! 피해 ×${e.k}`, e.x, e.y - 70, '#ffd65a', 3); this.game.screen.shake(1); this.game.screen.flash(1, .85, .5, .25); A.sfx('slam', { p: 2 }); cheer(1.6); hud.push('의자 위로 내리꽂았다!', { col: '#ffd65a', sub: '의자가 부서지며 기술 피해 ' + (e.k >= 2 ? '2배' : '×' + e.k), y: 90, life: 1.6 }); });
    m.on('chairBreak', e => { A.sfx('punch3'); if (e.why !== 'slam') fx.word('의자가 부서졌다!', e.x, e.y - 26, '#ffb347', 2); fx.dust(e.x, e.y, .8); fx.spark(e.x, e.y, 1.2, '#9aa4c0'); cheer(.8); });
    m.on('propPick', e => { A.sfx('grip'); if (isH(e.f)) hud.toast(`의자를 들었다! [${K('atk')}] 체어샷 · [${K('grab')}] 던지기`, '#ffd65a'); else { fx.word('의자!', e.f.x, e.f.y - 100, '#ffb347', 1); if (this.human) hud.toast('상대가 의자를 들었다! 막거나, 피하거나, 뺏어라', '#ff8a8a'); } });
    m.on('propCatch', e => { A.sfx('grip'); fx.word('받았다!', e.f.x, e.f.y - 104, '#6be38a', 2); cheer(1.1); });
    m.on('propSteal', e => { A.sfx('slap'); fx.word('뺏었다!', e.f.x, e.f.y - 104, '#ff8fc4', 2); cheer(.8); });
    m.on('propSnatch', e => { A.sfx('counter'); fx.word('받아쳤다!', e.f.x, e.f.y - 108, '#ff5fa2', 3); m.slowmo(.5, .25); cheer(1.2); });
    m.on('propReach', () => A.sfx('step'));
    m.on('propDrop', e => { if (e.why === 'swing') A.sfx('thud', { p: .3 }); });
    m.on('propThrow', () => A.sfx('whoosh', { pitch: .8 }));
    m.on('propLand', e => A.sfx(e.hard ? 'clang' : 'thud', { p: .45 }));
    m.on('chairWarn', e => { A.sfx('warn'); });
    m.on('cameoIn', e => { const rv = e.c.who === 'rival'; hud.push(e.c.who === 'boss' ? '사장 난입!' : rv ? 'BLACK ROPE 난입!' : '코치 난입!', { col: rv ? '#b066d8' : '#ffb347', sub: e.c.name, y: 150, life: 1.8, scale: 2 }); A.cheer(.7); if (rv) { A.sfx('warn'); S.flash(.7, .3, 1, .25); this.ar.setScreen('BLACK ROPE', e.c.name + ' 난입!', '#b066d8', true); } });
    m.on('noContest', () => { A.sfx('bell3'); hud.push('노 콘테스트!', { col: '#b066d8', scale: 3, y: 100, life: 2.2, sub: '심판이 난입을 보고 경기를 멈췄다' }); });
    m.on('cameoThrow', e => A.sfx('whoosh', { pitch: e.slide ? 1.2 : .7 }));
    m.on('refDistract', () => { fx.word('심판이 한눈판다!', m.ref.x, m.ref.y - 100, '#ffd65a', 1); A.boo(.5); });
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
      case 'step': A.sfx('step'); fx.dust(a.joints.x(J.aN), this.m.arena.ground(a.joints.x(J.aN), a.y, a.side), .35); break;
      case 'cheer': A.cheer(.8); this.ar.boost(.25); break;
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
    this.t += dt; this.lastDt = dt;
    if (inp.rawPressed('F3') || inp.rawPressed('Backquote')) this.debug = !this.debug;
    if (this.resultShown) { if (inp.menuPressed('confirm')) this.finish(); return; }
    if (this.paused) { this.pauseInput(); if (!this.online) return; }   // online the match goes on behind the menu
    if (this.pre && m.phase === 'intro' && m.introT > (m.cfg.introTime || 3.2) - .15) this.startPreTalk();
    if (this.talk && m.phase !== 'intro') { this.talk.close(); }   // never let the talk outlive the intro
    if (this.talk) { this.talk.update(dt); m.update(dt); this.hud.update(dt, m); this.ar.update(dt, m.hype); this.camera(dt); return; }
    if (this.online && this.netLost) { if (inp.menuPressed('confirm') || inp.menuPressed('cancel')) this.finish(true); return; }
    if (inp.pressed('pause') && m.phase !== 'end' && !this.paused) { this.paused = true; this.sel = 0; g.audio.sfx('ui'); if (!this.online) return; }
    // human input
    const h = this.human;
    if (h && m.phase === 'fight' && !this.online) inp.fillIntent(h.intent);
    for (const f of m.fighters) if (f.bossPhase > 1 && f.alive && Math.random() < dt * (f.bossPhase === 3 ? 9 : 4)) this.fx.spark(f.x + (Math.random() - .5) * 30, f.y - 20 - Math.random() * 70, .5, f.bossPhase === 3 ? '#ff5b5b' : '#ff8a2b');
    if (m.phase === 'intro' && !this.online && (inp.menuPressed('confirm') || inp.pressed('atk'))) { m.introT = 99; }
    if (this.online) this.onlineTick(dt); else m.update(dt);
    if (this.tut) this.tut.update(dt);
    if (m.phase === 'end') { this.endT += dt; if (h && h.st !== 'KO' && h.alive && m.result && m.result.team === h.team && h.st !== 'WIN' && this.endT > 1.2 && !h.link && h.ground) h.set('WIN', { force: true }); if (this.endT > 1.4) for (const f of m.fighters) if (f.alive && f.st !== 'WIN' && m.result && m.result.team === f.team && !f.link && f.ground && f.st !== 'KO' && !h) f.set('WIN', { force: true }); if (this.endT > 3.4) this.resultShown = true; }
    for (const f of m.fighters) if (f.dash && f.ground && Math.abs(f.vx) > 200 && Math.random() < dt * 14) this.fx.dust(f.x - f.face * 12, f.y, .22);
    this.fx.update(m.freeze > 0 ? dt * .3 : dt * m.slowK);
    this.ar.update(dt, m.hype);
    this.hud.update(dt, m);
    g.audio.crowd(.3 + m.hype / 100 * .7);
    this.camera(dt);
    // lights out
    if (this.darkUntil && m.time > this.darkUntil) { this.darkGoal = 0; this.darkUntil = 0; }
    this.dark = damp(this.dark, this.darkGoal, 9, dt);
  }
  // Online: this frame's input goes out for a frame a few ticks ahead; the match steps only when both inputs are in.
  onlineTick(dt) {
    const L = this.lock, m = this.m, inp = this.game.input, I = this.netI || (this.netI = newIntent());
    I.mx = 0; I.up = I.down = I.downEdge = I.jump = I.atk = I.grab = I.dodge = I.fin = false;
    if (!this.paused && m.phase === 'fight') inp.fillIntent(I);
    L.input(I);
    this.netAcc = Math.min((this.netAcc || 0) + dt, 6 / 60);
    let n = 0;
    while (this.netAcc >= 1 / 60 - 1e-6 && n < 4) {
      L.push();
      if (!L.ready()) { this.stallT = (this.stallT || 0) + dt; break; }
      this.stallT = 0;
      L.apply(m.fighters);
      m.update(1 / 60);
      L.sum(m);
      this.netAcc -= 1 / 60; n++;
    }
    this.pingT = (this.pingT || 0) + dt;
    if (this.pingT > 2) { this.pingT = 0; this.online.net.pingNow(); }
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
  tutorialDone(completed) { this.tutDone = !!completed; this.finish(true); }
  pauseItems() {
    if (this.online) return [{ label: '계속', act: () => { this.paused = false; } }, { label: '기권하고 나가기', act: () => { this.paused = false; this.finish(true); } }];
    if (this.tut) return [{ label: '계속하기', act: () => { this.paused = false; this.game.input.clear(); } }, { label: '이 단계 건너뛰기', act: () => { this.tut.skip(); this.paused = false; this.game.input.clear(); } }, { label: '조작법', act: () => this.game.showControls(this) }, { label: '기초 훈련 끝내기', act: () => this.tutorialDone(false) }];
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
    if (this.lock) { if (quit && this.online.net.connected && !this.netLost) this.online.net.send({ t: 'bye' }); this.lock.dispose(); }
    this.game.screen.resetFx();
    const r = this.m.result || { forfeit: true, quit };
    const summary = this.m.summary(), h = this.human;
    if (this.onEnd) this.onEnd({ result: r, summary, human: h ? summary[h.idx] : null, won: !!(h && r.winner && r.team === h.team), draw: !!r.draw, time: this.m.clock, quit: !!quit, match: this.m, tutorial: !!this.tut, completed: this.tutDone });
  }
  // ---- drawing ----
  draw(w, u) {
    const m = this.m, cam = Math.round(this.camX);
    this.ar.drawBack(w, cam);
    drawSpecialBack(w, m, cam);
    this.drawCameos(w, cam);
    this.fr.drawAll(w, m, cam, { dt: 1 / 60 });
    drawProps(w, m, cam);
    this.ar.drawFront(w, cam);
    drawSpecialFront(w, m, cam);
    this.fx.draw(w, cam);
    const h = this.human;
    this.ar.drawLights(w, cam, h ? h.x : null);
    if (this.fx.ink > 0) { w.globalAlpha = Math.min(.55, this.fx.ink * .4); rect(w, '#14081e', 0, 0, VIEW_W, VIEW_H); w.globalAlpha = 1; }
    if (this.dark > .02) { w.globalAlpha = this.dark; rect(w, '#020208', 0, 0, VIEW_W, VIEW_H); w.globalAlpha = 1; const L = m.links.find(l => l.fin); if (L) for (const f of [L.a, L.v]) if (f) { rect(w, '#ffffff', Math.round(f.joints.x(J.head) - cam) + f.face * 3, Math.round(f.joints.y(J.head)) - 1, 2, 1); } }
    this.fx.drawLines(w, VIEW_W, VIEW_H);
    if (this.debug) this.drawDebug(w, cam);
    u.clearRect(0, 0, VIEW_W, VIEW_H);
    this.hud.draw(u, m, cam, { hide: m.phase === 'intro' && false });
    this.drawBubbles(u, cam);
    if (this.tut && !this.paused) this.tut.draw(u);
    if (this.talk) this.talk.draw(u);
    if (m.phase === 'intro') { drawText(u, `${this.game.input.label('confirm')} 건너뛰기`, 632, 346, { size: 11, align: 'r', color: UI.dim, outline: '#05060f' }); }
    if (this.online) {
      const net = this.online.net;
      drawText(u, `온라인 · 핑 ${net.ping || '-'}ms`, 632, 330, { size: 11, align: 'r', color: UI.dim, outline: '#05060f' });
      if (this.stallT > .3 && !this.netLost) drawText(u, this.stallT > 6 ? '상대 응답 없음… (Esc 메뉴에서 나갈 수 있다)' : '상대 입력을 기다리는 중…', 320, 70, { size: 11, align: 'c', color: '#ffd65a', outline: '#05060f' });
      if (this.lock && this.lock.desync) drawText(u, '동기화 오류: 두 화면의 경기가 어긋났다 (결과는 참고용)', 320, 84, { size: 11, align: 'c', color: '#ff8a8a', outline: '#05060f' });
      if (this.netLost) { fade(u, .6); drawText(u, '상대와 연결이 끊겼다', 320, 160, { scale: 2, align: 'c', color: '#ff8a8a', bold: true, outline: '#05060f' }); drawText(u, 'Enter 로비로', 320, 190, { size: 11, align: 'c', color: UI.dim }); }
    }
    if (this.paused) this.drawPause(u);
    if (this.resultShown) this.drawResult(u);
  }
  startPreTalk() {
    const P = this.pre, m = this.m, h = this.human, foe = m.fighters.find(f => f.charId === P.opp) || m.fighters.find(f => h && f.isFoe(h));
    this.pre = null;
    if (!h || !foe) { m.holdIntro = false; return; }
    m.holdIntro = true;
    const steps = [...P.lines, { prompt: '어떻게 받아칠까?', choice: P.choices.map(ch => ({ label: ch.label, go: [{ who: P.opp, text: ch.reply, expr: ch.fx === 'taunt' ? 'fierce' : 'neutral' }, { act: () => this.applyPre(ch.fx, h, foe) }] })) }];
    this.talk = new Dialogue(this.game, steps, { player: { look: h.look, name: h.name }, onEnd: () => { this.talk = null; m.holdIntro = false; m.introT = 99; } });
    for (const f of m.fighters) f.spot = f === h || f === foe;
  }
  // The answer before the bell: a little gauge and a lot of crowd.
  applyPre(fx, h, foe) {
    const m = this.m, A = this.game.audio;
    if (fx === 'taunt') { h.fin = Math.min(B.finMax, h.fin + 15); foe.fin = Math.min(B.finMax, foe.fin + 8); m.addHype(15); A.cheer(1.1); this.hud.toast('도발! 관중 열기 +15 · 피니셔 게이지 +15 (상대도 +8)', '#ffd65a'); }
    else if (fx === 'respect') { h.fin = Math.min(B.finMax, h.fin + 6); m.addHype(5); A.sfx('clap'); this.hud.toast('관중이 박수를 친다. 피니셔 게이지 +6', '#9be36b'); }
    else { m.addHype(10); A.cheer(.7); this.hud.toast('기싸움! 관중 열기 +10', '#c9d4ff'); }
  }
  // People who run in at the ring side (boss, coach): posed like townspeople, drawn behind the wrestlers.
  drawCameos(w, cam) {
    const E = this.m.events, ar = this.m.arena;
    for (const c of [...this.cameoActors.keys()]) if (!E.cameos.includes(c)) this.cameoActors.delete(c);
    if (!E.cameos.length) return;
    if (!this.cbc) { this.cbc = new BodyCanvas(); this.cbc.setLight({ rim: this.m.arenaDef.rim, light: this.m.arenaDef.light }); this.ctmp = new Joints(); }
    for (const c of E.cameos) {
      let a = this.cameoActors.get(c);
      if (!a) { a = new Actor(c.look, { x: c.x, face: c.face, stance: c.stance, y: ar.floorY - FLOOR }); this.cameoActors.set(c, a); }
      a.x = c.x; a.vx = c.vx; a.face = c.face;
      a.stance = c.act === 'cheer' ? 'cheer' : c.act === 'windup' ? 'hawk' : c.act === 'watch' ? 'arms' : c.stance;
      if (c.say && c.act !== 'cheer' && c.act !== 'windup') a.talkT = Math.max(a.talkT, .15);
      a.pose(this.lastDt);
      const bc = this.cbc, tmp = this.ctmp;
      tmp.copy(a.joints); for (let i = 0; i < JN; i++) tmp.p[i * 2] -= cam;
      w.globalAlpha = .35; rect(w, '#04030a', Math.round(tmp.x(0) - 12), Math.round(a.y0) - 1, 24, 3); w.globalAlpha = 1;
      bc.begin(tmp.x(0), tmp.y(0) - 4);
      drawBody(bc, tmp, a.dims, a.look, { expr: c.act === 'windup' || c.act === 'distract' || c.act === 'cheer' ? 'shout' : a.faceExpr, hand: 'open', tails: null, cape: false });
      bc.finish(); bc.drawTo(w);
      if (c.act === 'windup') drawChairAt(w, tmp.x(J.hN), tmp.y(J.hN) - 30, -.4 * c.face, c.face, 0);
    }
  }
  drawBubbles(u, cam) {
    for (const c of this.m.events.cameos) {
      const a = this.cameoActors.get(c);
      if (!a) continue;
      const x = Math.round(c.x - cam), hy = Math.round(a.joints.y(J.head)) - 24;
      drawText(u, c.name, x, hy, { size: 11, align: 'c', color: c.who === 'boss' ? '#ffd65a' : '#ff8fc4', outline: '#05060f' });
      if (!c.say) continue;
      const tw = textWidth(c.say.text, 11), bw = tw + 12, bx = clamp(Math.round(x - bw / 2), 4, VIEW_W - bw - 4), by = hy - 24;
      rect(u, '#05060f', bx - 1, by - 1, bw + 2, 18); rect(u, '#f6f2e6', bx, by, bw, 16);
      rect(u, '#05060f', x - 3, by + 16, 7, 4); rect(u, '#f6f2e6', x - 2, by + 16, 5, 3);
      drawText(u, c.say.text, bx + 6, by + 2, { size: 11, color: '#141a36' });
    }
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
    if (r.finishBy) drawText(u, r.finishBy === 'finisher' ? '피니셔로 마무리! (보너스)' : '레슬링 기술로 마무리! (보너스)', 320, 96, { size: 11, align: 'c', color: '#ffd65a' });
    if (r.score) drawText(u, `폴 스코어 ${r.score[0] || 0} : ${r.score[1] || 0}`, 480, 66, { size: 11, align: 'r', color: '#ffd65a' });
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
