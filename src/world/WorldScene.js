// Exploration: walk the facility and the harbour street, talk, use things, go through doors, start matches.
import { VIEW_W, VIEW_H, clamp, damp, sgn, fmtMoney, josa, RNG } from '../core/util.js';
import { drawText, textWidth } from '../render/pixelfont.js';
import { UI, mixHex } from '../render/palette.js';
import { rect, glow } from '../render/painter.js';
import { panel, gauge, icon, keycap, prompt, fade } from '../render/ui.js';
import { BodyCanvas } from '../render/raster.js';
import { drawBody } from '../render/body.js';
import { Joints, dimsFor, solveFK, toWorld, JN, J } from '../anim/skeleton.js';
import { STANCES, stancePose, gaitPose, clip, hasClip, sampleClip } from '../anim/clips.js';
import { updateTails } from '../anim/AnimationSystem.js';
import { BALANCE as B } from '../data/balance.js';
import { CHARACTERS } from '../data/characters.js';
import { LOCATIONS, bakeLocation, drawWindows, streetFar, FLOOR } from './locations.js';
import { NPCS, peopleAt, talk } from './npcs.js';
import { Dialogue } from './Dialogue.js';
import { SLOT_NAMES } from './CareerManager.js';
import * as Menus from './menus.js';
import { Training } from './Training.js';

const P = new Float32Array(16);
class Actor {
  constructor(look, o = {}) { this.look = look; this.dims = dimsFor(look.build, look.scale || 1); this.x = o.x || 100; this.y = FLOOR + (o.y || 0); this.vx = 0; this.vy = 0; this.face = o.face || 1; this.ground = true; this.stance = o.stance || 'calm'; this.gait = 0; this.t = Math.random() * 3; this.poseT = this.t; this.joints = new Joints(); this.expr = 'neutral'; this.exprT = 0; this.tails = null; this.idx = 0; this.id = o.id; this.home = this.x; this.wander = o.wander || 0; this.wT = 2; this.talkT = 0; this.y0 = this.y; }
  pose(dt) {
    this.t += dt; this.poseT = this.t;
    const moving = Math.abs(this.vx) > 6;
    if (!this.ground) sampleClip(clip(this.vy < 0 ? 'jump' : 'fall'), .2, P);
    else if (this.talkT > 0) sampleClip(clip('talk'), this.t, P);
    else if (STANCES[this.stance]) { stancePose(this.stance, this.t, P); if (moving) { this.gait += dt * (2.6 + Math.abs(this.vx) * .07) * (this.vx * this.face >= 0 ? 1 : -1); gaitPose(P, this.gait, Math.abs(this.vx) > 150 ? 'run' : 'walk', 1); } }
    else if (hasClip(this.stance)) sampleClip(clip(this.stance), this.t, P);
    else stancePose('calm', this.t, P);
    if (!this.ground) solveFK(P, this.dims, this.joints, { snap: false, py: -this.dims.leg * .92 });
    else solveFK(P, this.dims, this.joints, {});
    toWorld(this.joints, this.face, this.x, this.y);
    this.faceExpr = this.exprT > 0 ? this.expr : (Math.floor(this.t * .7) % 5 === 0 && (this.t % 1.43) < .12 ? 'blink' : this.talkT > 0 ? (Math.floor(this.t * 8) % 2 ? 'talk' : 'neutral') : 'neutral');
    if (this.exprT > 0) this.exprT -= dt;
    if (this.talkT > 0) this.talkT -= dt;
    updateTails(this, dt, this.y);
  }
}

export class WorldScene {
  constructor(game, career, o = {}) {
    this.game = game; this.c = career; this.t = 0; this.bc = new BodyCanvas(); this.overlays = []; this.dialog = null; this.toasts = []; this.prompt = null; this.camX = 0; this.farCache = {};
    this.player = new Actor(career.look(), { x: career.d.x || 240, face: 1, id: 'me' });
    this.player.name = career.d.name;
    this.enter(career.d.loc || 'lobby', career.d.x || 240, true);
    if (o.intro) this.say([{ who: 'janitor', text: `어이, 거기! 네가 오늘 온다던 신인 ${josa(career.d.name, '이/가')}구나. 여긴 야항 체육관 로비야.` }, { who: 'janitor', text: '사장님 방은 저기 왼쪽 문이야. {y}F{/}를 누르면 들어갈 수 있어. 사람한테는 {y}E{/}로 말을 걸고.' }, { who: 'janitor', text: '{y}Tab{/}을 누르면 네 상태를 볼 수 있다. 특히 {v}부상 게이지{/}는 자주 확인하라고.' }]);
    if (o.after) this.afterMatch(o.after);
    game.screen.resetFx();
  }
  get L() { return LOCATIONS[this.loc]; }
  enter(id, x, instant) {
    const L = LOCATIONS[id];
    if (!L.bg) bakeLocation(id);
    this.loc = id; this.c.d.loc = id; this.player.x = clamp(x, 30, L.w - 30); this.player.y = FLOOR; this.player.vx = 0; this.player.vy = 0;
    const r = new RNG(this.c.d.day * 13 + id.length);
    this.npcs = peopleAt(id, this.c).map((p, i) => { const N = NPCS[p.id]; const a = new Actor(N.look, { x: p.x, face: p.face, stance: p.stance || N.stance, id: p.id, y: p.y || 0, wander: p.wander }); a.idx = i + 1; a.t = r.next() * 4; return a; });
    this.camX = clamp(this.player.x - VIEW_W / 2, 0, Math.max(0, L.w - VIEW_W));
    this.game.audio.music(L.music);
    this.game.screen.goal.tint = this.c.d.slot === 2 ? [.92, .95, 1.08] : this.c.d.slot === 1 ? [1.06, .98, .92] : [1, 1, 1];
    this.bc.setLight({ rim: L.rim, light: L.light });
    if (id === 'lobby' && this.c.injuryLevel !== 'ok' && this.c.d.flags.injWarnDay !== this.c.d.day) { this.c.d.flags.injWarnDay = this.c.d.day; setTimeout(() => this.toast(this.c.injuryLevel === 'danger' ? `부상 위험 ${Math.round(this.c.d.injury)}% — 당장 치료가 필요하다!` : `부상 주의 ${Math.round(this.c.d.injury)}% — 의원에 들르자`, this.c.injuryLevel === 'danger' ? '#ff5b5b' : '#ffb347'), 400); }
    if (!instant) this.c.save();
  }
  goDoor(d) {
    const A = this.game.audio;
    if (d.lock && !this.unlocked(d.lock)) { A.sfx('deny'); this.toast(d.lock === 'rivalgym' ? '문이 잠겨 있다. "명성 40 이상만 도장 깨기 접수" ' : '"챔피언십 관계자 외 출입 금지"', '#ff8a8a'); return; }
    A.sfx('door');
    this.fadeT = .45; this.fadeTo = () => { this.enter(d.to, d.at); };
  }
  unlocked(k) { const d = this.c.d; if (k === 'rivalgym') return d.fame >= 40 || d.flags.champion; if (k === 'dome') return (d.contract && d.contract.title) || d.flags.champion; return true; }
  say(steps, o = {}) { this.dialog = new Dialogue(this.game, steps, Object.assign({ player: this.player, onEnd: () => { this.dialog = null; if (o.after) o.after(); } }, o)); }
  toast(text, col = '#eef2ff') { this.toasts.push({ text, col, t: 0 }); if (this.toasts.length > 4) this.toasts.shift(); }
  open(o) { this.overlays.push(o); this.game.input.clear(); }
  closeTop() { this.overlays.pop(); this.game.input.clear(); }
  // ---- actions used by dialogues and objects ----
  openOffers() { if (!this.c.d.offers.length || this.c.d.offersDay !== this.c.d.day) this.c.makeOffers(); this.open(new Menus.OffersMenu(this)); }
  openArenaList() { this.open(new Menus.ArenaMenu(this)); }
  openShop() { this.open(new Menus.ShopMenu(this)); }
  openClinic() { this.open(new Menus.ClinicMenu(this)); }
  openFood() { this.open(new Menus.FoodMenu(this)); }
  openLearn(by) { this.open(new Menus.LearnMenu(this, by)); }
  openInfo(tab = 1) { this.open(new Menus.InfoMenu(this, tab)); }
  startJob() { this.startTraining('job'); }
  startTraining(game) {
    const c = this.c, d = c.d;
    if (game !== 'job' && d.slot === 2 && false) return;
    const cost = game === 'job' ? 0 : 6000 + d.season * 2000;
    if (!c.canPay(cost)) { this.toast(`훈련비 ${fmtMoney(cost)}이(가) 부족하다`, '#ff8a8a'); this.game.audio.sfx('deny'); return; }
    this.open(new Training(this, game, cost));
  }
  // Start a match: kind official|free|practice|event|title|spar|dojo
  startMatch(kind, offer) {
    const c = this.c, d = c.d;
    const go = () => {
      const cfg = this.matchConfig(kind, offer);
      d.x = this.player.x;
      c.save();
      const here = this.loc, px = this.player.x;
      this.game.playMatch(cfg, res => {
        const W2 = new WorldScene(this.game, c, {});
        W2.enter(here, px, true);
        this.game.go(() => { W2.afterMatch({ kind, offer, res }); return W2; });
      });
    };
    if (kind !== 'practice' && kind !== 'spar' && d.injury >= B.injuryDanger) {
      this.open(new Menus.Confirm(this, `부상이 ${Math.round(d.injury)}%입니다. 이 경기에서 100%가 되면 선수 생명이 끝납니다(게임 오버). 그래도 나갈까요?`, go, { danger: 1 }));
      return;
    }
    go();
  }
  matchConfig(kind, o) {
    const c = this.c, d = c.d, me = c.entrant('human');
    const lv = o && o.difficulty || 'normal';
    const foe = id => ({ char: id, ctrl: 'ai', difficulty: lv });
    if (kind === 'practice' || kind === 'spar') return { mode: 'practice', arena: 'gym', entrants: [me, { char: o && o.opp || 'dohyun', ctrl: 'dummy', difficulty: 'normal' }], practice: { infinite: true }, skipIntro: true, career: 1, music: 'gym' };
    if (o && o.mode === 'rumble') { const pool = ['taesan', 'haneul', 'neon', 'mandeok', 'dongsu', 'bokja', 'dueok', 'palcho', 'baeksang', 'bjorn', 'baekpa', 'dohyun'], r = new RNG(d.day * 31); return { mode: 'rumble', arena: 'hall', entrants: [me, ...r.shuffle(pool).slice(0, 9).map(foe)], career: 1, title: '만선 럼블' }; }
    if (o && o.mode === 'tag') return { mode: 'tag', arena: o.arena || 'pier', entrants: [me, { char: 'dohyun', ctrl: 'ai', difficulty: 'hard' }, foe('dueok'), foe('baeksang')], career: 1, title: '항구 태그 대전' };
    return { mode: o && o.mode || 'single', arena: o && o.arena || 'hall', entrants: [me, foe(o ? o.opp : 'dohyun')], career: 1, boss: o && (o.title || o.opp === 'fogking'), title: o && o.title ? '챔피언 타이틀 매치' : o && o.kind === 'dojo' ? '도장 깨기' : null };
  }
  afterMatch(info) {
    const c = this.c, { kind, offer, res } = info;
    if (res.quit && kind === 'practice') { this.toast('연습을 마쳤다.'); return; }
    const sum = c.applyResult(kind === 'spar' ? 'practice' : kind, res, { offer });
    if (offer && offer.kind === 'dojo' && res.won) { c.d.flags['dojo_' + offer.opp] = 1; }
    if (kind === 'free' || kind === 'dojo') { const msgs = c.spendSlot(1); msgs.forEach(m => this.toast(m, '#ffb347')); }
    else if (kind === 'official' || kind === 'event' || kind === 'title') { const msgs = c.spendSlot(1); msgs.forEach(m => this.toast(m, '#ffb347')); }
    c.save();
    this.open(new Menus.ResultMenu(this, sum, res, kind, offer));
  }
  checkGameOver() { if (this.c.d.injury >= 100) { this.game.go(() => new Menus.GameOverScene(this.game, this.c)); return true; } return false; }
  // ---- update ----
  update(dt) {
    this.t += dt;
    const inp = this.game.input, A = this.game.audio, p = this.player, L = this.L;
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter(t => t.t < 3.4);
    if (this.fadeT > 0) { this.fadeT -= dt; if (this.fadeT <= .22 && this.fadeTo) { const f = this.fadeTo; this.fadeTo = null; f(); } }
    for (const a of this.npcs) this.npcThink(a, dt);
    if (this.overlays.length) { this.overlays[this.overlays.length - 1].update(dt); this.physics(p, dt, 0); p.pose(dt); for (const a of this.npcs) a.pose(dt); return; }
    if (this.dialog) { this.dialog.update(dt); this.physics(p, dt, 0); p.pose(dt); for (const a of this.npcs) a.pose(dt); return; }
    if (this.c.d.flags.seasonEnd && !this.fadeT) { this.c.d.flags.seasonEnd = false; this.open(new Menus.SeasonEndMenu(this)); return; }
    let mx = (inp.down('right') ? 1 : 0) - (inp.down('left') ? 1 : 0);
    if (this.fadeT > 0) mx = 0;
    this.physics(p, dt, mx);
    if (inp.pressed('up') && p.ground && !this.fadeT) { p.vy = -250; p.ground = false; A.sfx('jump'); }
    p.pose(dt);
    for (const a of this.npcs) a.pose(dt);
    // what is near?
    this.prompt = this.findPrompt();
    if (!this.fadeT) {
      if (inp.pressed('interact') && this.prompt && this.prompt.kind !== 'door') this.use(this.prompt);
      else if (inp.pressed('door') && this.prompt && this.prompt.kind === 'door') this.goDoor(this.prompt.door);
      else if (inp.pressed('interact') && this.prompt && this.prompt.kind === 'door') this.goDoor(this.prompt.door);
      if (inp.pressed('info')) { A.sfx('ui'); this.openInfo(1); }
      if (inp.pressed('map')) { A.sfx('ui'); this.open(new Menus.MapMenu(this)); }
      if (inp.pressed('pause')) { A.sfx('ui'); this.open(new Menus.PauseMenu(this)); }
    }
    const want = clamp(p.x - VIEW_W / 2 + p.face * 40, 0, Math.max(0, L.w - VIEW_W));
    this.camX = damp(this.camX, want, 5, dt);
  }
  physics(a, dt, mx) {
    const L = this.L, spd = 108;
    const want = mx * spd;
    a.vx = Math.abs(want) > 0 ? a.vx + clamp(want - a.vx, -1200 * dt, 1200 * dt) : a.vx * Math.max(0, 1 - dt * 14);
    if (mx) a.face = mx;
    a.vy += 900 * dt;
    a.x += a.vx * dt; a.y += a.vy * dt;
    if (a.y >= a.y0) { if (!a.ground && a.vy > 200) this.game.audio.sfx('land', { p: .4 }); a.y = a.y0; a.vy = 0; a.ground = true; }
    a.x = clamp(a.x, 18, L.w - 18);
    if (a.ground && Math.abs(a.vx) > 30) { a.stepT = (a.stepT || 0) + dt; if (a.stepT > .3) { a.stepT = 0; this.game.audio.sfx('step'); } }
  }
  npcThink(a, dt) {
    const p = this.player, d = Math.abs(a.x - p.x);
    if (d < 90) a.face = sgn(p.x - a.x) || a.face;
    if (a.wander && d > 120) {
      a.wT -= dt;
      if (a.wT <= 0) { a.wT = 2 + Math.random() * 3; a.target = a.home + (Math.random() * 2 - 1) * a.wander; }
      if (a.target != null && Math.abs(a.target - a.x) > 4) { a.vx = sgn(a.target - a.x) * 40; a.face = sgn(a.vx); } else a.vx = 0;
      a.x += a.vx * dt;
    } else a.vx = 0;
  }
  findPrompt() {
    const p = this.player, L = this.L;
    let best = null, bd = 34;
    for (const a of this.npcs) { const d = Math.abs(a.x - p.x); if (d < bd) { bd = d; best = { kind: 'npc', a, x: a.x, label: NPCS[a.id].name, verb: '대화' }; } }
    for (const d of L.doors) { const dd = Math.abs(d.x - p.x); if (dd < Math.min(bd, 26)) { bd = dd; best = { kind: 'door', door: d, x: d.x, label: d.label, verb: d.lock && !this.unlocked(d.lock) ? '잠김' : '들어가기' }; } }
    for (const o of L.objects) { const dd = Math.abs(o.x - p.x); if (dd < Math.max(18, o.w / 2) && dd < bd + 6) { bd = dd; best = { kind: 'obj', o, x: o.x, label: o.label, verb: '조사' }; } }
    return best;
  }
  use(pr) {
    const A = this.game.audio, c = this.c, d = c.d;
    if (pr.kind === 'npc') {
      const a = pr.a; a.face = sgn(this.player.x - a.x) || a.face; this.player.face = -a.face; a.talkT = 1.5; A.sfx('ui');
      this.say(talk(a.id, c, this));
      return;
    }
    const o = pr.o;
    switch (o.act) {
      case 'train': this.startTraining(o.game); break;
      case 'spar': this.say([{ who: 'trainer', text: '연습 링이다. 상대 행동, 체력을 바꿔 가며 기술을 시험해 봐. 기록도 부상도 남지 않아.' }, { choice: [{ label: '연습 경기 시작', act: () => this.startMatch('practice', { opp: 'dohyun' }) }, { label: '그만두기', go: [] }] }]); break;
      case 'vending': if (c.pay(3000)) { d.fatigue = Math.max(0, d.fatigue - 8); A.sfx('coin'); this.toast('이온 음료를 마셨다. 피로 -8 (₩3,000)', '#9be36b'); } else { A.sfx('deny'); this.toast('돈이 모자란다', '#ff8a8a'); } break;
      case 'schedule': this.say(this.scheduleLines()); break;
      case 'ranking': this.open(new Menus.RankMenu(this)); break;
      case 'rest': this.restMenu(); break;
      case 'trophy': this.say([{ who: null, name: '트로피', text: d.titles.length ? `진열장에 네 이름이 새겨진 트로피가 있다: ${d.titles.map(t => t.name).join(', ')}` : '역대 챔피언들의 트로피. 맨 위 칸은 3년째 안개왕의 것이다. 언젠가 저기에 내 이름을…' }]); break;
      case 'poster': this.say([{ who: null, name: '포스터', text: d.flags.champion ? '포스터 한가운데에 새 챔피언, 내 얼굴이 붙어 있다!' : c.rank <= 5 ? '구석에 작게, 내 얼굴이 들어간 포스터가 생겼다.' : '연맹 선수들의 포스터. 아직 내 얼굴은 없다.' }]); break;
      case 'card': this.openArenaList(); break;
      case 'enter': if (d.contract) this.openArenaList(); else this.say([{ who: 'staff', text: '계약된 경기가 없으면 입장할 수 없어요. 사장님께 먼저 가 보세요.' }]); break;
      case 'locker': this.say([{ who: null, name: '사물함', text: `네 사물함이다. 붕대 ${d.items.bandage || 0}개, 음료 ${d.items.drink || 0}개가 들어 있다. (Tab → 소지품에서 사용)` }]); break;
      case 'bench': this.say([{ who: null, name: '벤치', text: '경기 전 긴장이 몰려온다. 숨을 고르자.' }]); break;
      case 'mirror': this.say([{ who: 'me', text: c.rank <= 3 ? '…이제 제법 챔피언 같은 얼굴이다.' : '거울 속의 나. 아직 갈 길이 멀다.' }]); break;
      case 'fish': this.say([{ who: 'boss', text: '그 물고기들 이름은 다 전 챔피언 이름일세. 저 큰 놈이 "백파"야.' }]); break;
      case 'pojang': this.openFood(); break;
      case 'plaza': this.say(this.plazaLines()); break;
      case 'fountain': if (c.pay(500)) { A.sfx('coin'); this.say([{ who: 'me', text: '동전을 던졌다. "챔피언이 되게 해 주세요."' }]); d.flags.wish = (d.flags.wish || 0) + 1; } break;
      case 'job': this.say(talk('foreman', c, this)); break;
      case 'clinicBoard': this.openClinic(); break;
      case 'bed': this.openClinic(); break;
      case 'racks': this.openShop(); break;
      case 'sale': this.openShop(); break;
      case 'dojo': this.dojoMenu(); break;
      case 'domeGate': if (d.contract && d.contract.title) this.startMatch('title', d.contract); else this.say([{ who: 'staff', text: '타이틀 매치가 있는 날에만 열립니다.' }]); break;
      default: this.toast(o.label);
    }
  }
  restMenu() {
    const c = this.c, d = c.d;
    this.say([{ who: null, name: '소파', text: `지금은 ${SLOT_NAMES[d.slot]}. 피로 ${Math.round(d.fatigue)}. (부상은 쉬어도 낫지 않는다)` }, { choice: [
      { label: '잠깐 쉬기 (시간 1칸, 피로 -30)', act: () => { if (d.slot === 2) { this.sleepNow(); return; } d.fatigue = Math.max(0, d.fatigue - 30); c.spendSlot(1).forEach(m => this.toast(m, '#ffb347')); this.toast('푹 쉬었다. 피로 -30'); c.save(); } },
      { label: '자고 다음 날로 (피로 -70, 저장)', act: () => this.sleepNow() },
      { label: '그만두기', go: [] },
    ] }]);
  }
  sleepNow() {
    const c = this.c, d = c.d;
    if (d.contract && d.contract.day <= d.day) { this.open(new Menus.Confirm(this, `오늘이 ${josa(d.contract.oppName, '과/와')}의 계약 경기 마감일입니다. 자면 기권패가 됩니다. 그래도 잘까요?`, () => this.doSleep())); return; }
    this.doSleep();
  }
  doSleep() { const msgs = this.c.sleep(); this.fadeT = .9; this.fadeTo = () => { this.enter(this.loc, this.player.x); msgs.forEach(m => this.toast(m, '#ffb347')); this.toast(`${this.c.d.day}일차 아침. 자동 저장했다.`, '#9be36b'); }; this.game.audio.sfx('heal'); }
  scheduleLines() {
    const d = this.c.d, out = [];
    out.push({ who: null, name: '경기 일정판', text: `오늘은 시즌 ${d.season}, ${d.day}일차 ${SLOT_NAMES[d.slot]}. 시즌은 ${28}일까지.` });
    out.push(d.contract ? `{y}계약 경기{/}: ${d.contract.oppName} — ${d.contract.day}일까지 (보수 ${fmtMoney(d.contract.reward)})` : '계약 경기 없음. 사장실에서 제안을 받자.');
    out.push('14일: {y}만선 럼블{/} · 21일: {y}항구 태그 대전{/} · 28일: 시즌 결산');
    return out;
  }
  plazaLines() {
    const d = this.c.d;
    if (d.day % 7 === 3 && d.flags.plazaDay !== d.day) { d.flags.plazaDay = d.day; this.c.d.fame += 2; return [{ who: null, name: '광장', text: '광장에서 팬 사인회가 열리고 있다! 사람들이 몰려와 사인을 받아 갔다. (명성 +2)' }]; }
    return [{ who: null, name: '등대 광장', text: '바닷바람이 분다. 멀리 등대 돔의 불빛이 보인다.' }];
  }
  dojoMenu() {
    const c = this.c, d = c.d;
    const list = ['gosu', 'ironma'].filter(id => !d.flags['dojo_' + id]);
    if (!list.length) { this.say([{ who: 'gosu', text: '이미 우리 둘 다 이겼잖아. 도장은 네 거야… 청소는 우리가 할게.' }, { choice: [{ label: '기술 배우기', act: () => this.openLearn('rival') }, { label: '그만두기', go: [] }] }]); return; }
    const id = list[0], ch = CHARACTERS[id];
    this.say([{ who: id, text: `도장 깨기? 좋아. 상대는 ${ch.name}. 이기면 ${fmtMoney(45000)}, 그리고 우리 기술을 가르쳐 주지.` }, { choice: [
      { label: '도전한다', act: () => this.startMatch('dojo', { opp: id, oppName: ch.name, reward: 45000, fame: 8, kind: 'dojo', difficulty: d.season >= 2 ? 'expert' : 'hard', arena: 'gym' }) },
      { label: '기술만 배우기', act: () => this.openLearn('rival') },
      { label: '그만두기', go: [] },
    ] }]);
  }
  // ---- draw ----
  draw(w, u) {
    const L = this.L, cam = Math.round(this.camX), d = this.c.d;
    if (L.street) {
      const key = 'far' + d.slot;
      if (!this.farCache[key]) this.farCache[key] = streetFar(L, d.slot);
      w.drawImage(this.farCache[key], Math.round(-cam * .4), 0);
    } else rect(w, '#05060f', 0, 0, VIEW_W, VIEW_H);
    drawWindows(w, L, cam, d.slot);
    w.drawImage(L.bg, -cam, 0);
    drawWindows.after && drawWindows.after(w);
    // people
    const all = [...this.npcs, this.player].sort((a, b) => a.y - b.y);
    for (const a of all) this.drawActor(w, a, cam);
    // lights
    this.lights(w, cam);
    if (d.slot === 2 && L.street) { w.globalAlpha = .18; rect(w, '#0a0830', 0, 0, VIEW_W, VIEW_H); w.globalAlpha = 1; }
    u.clearRect(0, 0, VIEW_W, VIEW_H);
    this.hud(u);
    if (this.prompt && !this.dialog && !this.overlays.length) this.drawPrompt(u, cam);
    if (this.dialog) this.dialog.draw(u);
    for (const o of this.overlays) o.draw(u, w);
    this.drawToasts(u);
    if (this.fadeT > 0) fade(u, clamp(this.fadeT > .22 ? (.45 - this.fadeT) / .22 : this.fadeT / .22, 0, 1));
  }
  drawActor(g, a, cam) {
    const bc = this.bc, j = a.joints;
    const tmp = this.tmp || (this.tmp = new Joints());
    tmp.copy(j); for (let i = 0; i < JN; i++) tmp.p[i * 2] -= cam;
    g.globalAlpha = .35; rect(g, '#04030a', Math.round(tmp.x(0) - 12), Math.round(a.y0) - 1, 24, 3); g.globalAlpha = 1;
    bc.begin(tmp.x(0), tmp.y(0) - 4);
    const tails = a.tails ? a.tails.map(T => ({ pts: Array.from(T.pts, (v, i) => (i % 2 ? v : v - cam)), w: T.w, c: T.c, front: T.front })) : null;
    drawBody(bc, tmp, a.dims, a.look, { expr: a.faceExpr, hand: 'fist', tails, cape: false });
    bc.finish();
    bc.drawTo(g);
  }
  lights(w, cam) {
    const L = this.L, d = this.c.d;
    if (this.loc === 'lobby') { for (const x of [200, 560, 940]) glow(w, x - cam, 66, 60, '#ffcf7a', .18); glow(w, 560 - cam, 60, 90, '#ff5fa2', .12); }
    else if (this.loc === 'gym') for (const x of [420, 700, 980]) glow(w, x - cam, 62, 70, '#ffe0b0', .16);
    else if (this.loc === 'office') glow(w, 400 - cam, 70, 90, '#ffcf7a', .2);
    else if (this.loc === 'arena') { glow(w, 724 - cam, 110, 70, '#ff5fa2', .2); glow(w, 300 - cam, 64, 60, '#ffcf7a', .16); }
    else if (L.street) { if (d.slot === 2) for (let x = 30; x < L.w; x += 260) glow(w, x - cam, FLOOR - 118, 50, '#ffe0a0', .3); glow(w, 210 - cam, 110, 90, '#ff5fa2', .15); }
  }
  hud(u) {
    const c = this.c, d = c.d, t = this.t;
    panel(u, 4, 4, 632, 26, { alpha: .9, cut: 3, accent: '#49d6ff' });
    drawText(u, this.L.name, 12, 9, { color: '#ffffff', bold: true });
    drawText(u, c.timeText, 126, 10, { size: 11, color: UI.dim });
    icon(u, 'coin', 258, 13, '#ffd65a'); drawText(u, c.money(), 268, 10, { size: 11, color: UI.money });
    icon(u, 'star', 340, 13, '#ffd65a'); drawText(u, '명성 ' + d.fame, 350, 10, { size: 11, color: UI.fame });
    icon(u, 'rank', 404, 13, '#c9d4ff'); drawText(u, d.flags.champion ? '챔피언' : c.rank + '위', 414, 10, { size: 11, color: '#c9d4ff' });
    // injury gauge: only shown out of the ring
    const lvl = c.injuryLevel, col = lvl === 'danger' ? '#ff5b5b' : lvl === 'warn' ? '#ffb347' : UI.inj;
    icon(u, 'bandage', 456, 13, col);
    drawText(u, '부상', 467, 10, { size: 11, color: col });
    gauge(u, 492, 13, 70, 6, d.injury / 100, 'inj', { col, colD: '#3a1450', blink: lvl !== 'ok', blinkBelow: 2, time: t });
    drawText(u, Math.round(d.injury) + '%', 566, 10, { size: 11, color: col });
    drawText(u, '피로 ' + Math.round(d.fatigue), 630, 10, { size: 11, align: 'r', color: d.fatigue > 70 ? '#ff8a8a' : UI.dim });
    if (lvl !== 'ok' && Math.floor(t * 2) % 2) drawText(u, lvl === 'danger' ? '! 부상 위험: 항구의원에서 치료하세요' : '! 부상 주의', 632, 34, { size: 11, align: 'r', color: col, outline: '#05060f' });
    if (d.contract) drawText(u, `계약: ${d.contract.oppName} (~${d.contract.day}일)`, 8, 34, { size: 11, color: d.contract.day <= d.day ? '#ffb347' : '#c9d4ff', outline: '#05060f' });
    if (d.points > 0) drawText(u, `능력치 포인트 ${d.points} (Tab)`, 8, 47, { size: 11, color: '#6be38a', outline: '#05060f' });
    const inp = this.game.input;
    drawText(u, `${inp.label('interact')} 대화/조사 · ${inp.label('door')} 문 · ${inp.label('info')} 정보 · ${inp.label('map')} 지도 · ${inp.label('pause')} 메뉴`, 632, 348, { size: 11, align: 'r', color: UI.faint, outline: '#05060f' });
  }
  drawPrompt(u, cam) {
    const pr = this.prompt, inp = this.game.input;
    const x = Math.round(pr.x - cam), y = pr.kind === 'npc' ? Math.round(pr.a.joints.y(J.head) - 34) : FLOOR - 128;
    const key = pr.kind === 'door' ? inp.label('door') : inp.label('interact');
    const text = `${pr.verb}: ${pr.label}`, w = textWidth(text, 11) + 26;
    const bob = Math.round(Math.sin(this.t * 6) * 1.5);
    rect(u, '#05060f', x - w / 2 - 1, y - 1 + bob, w + 2, 17); rect(u, pr.verb === '잠김' ? '#5a1a2a' : '#1b2450', x - w / 2, y + bob, w, 15);
    keycap(u, key, x - w / 2 + 2, y + 1 + bob);
    drawText(u, text, x - w / 2 + 20, y + 2 + bob, { size: 11, color: '#ffffff' });
    rect(u, '#1b2450', x - 2, y + 15 + bob, 4, 3);
  }
  drawToasts(u) { this.toasts.forEach((t, i) => { const a = t.t > 2.9 ? (3.4 - t.t) / .5 : 1; u.globalAlpha = clamp(a, 0, 1); const w = textWidth(t.text, 11) + 12; rect(u, 'rgba(5,6,15,.8)', 320 - w / 2, 60 + i * 18, w, 15); drawText(u, t.text, 320, 62 + i * 18, { size: 11, align: 'c', color: t.col }); u.globalAlpha = 1; }); }
}
export const worldMix = mixHex;
export const worldPrompt = prompt;
export const worldVH = VIEW_H;
