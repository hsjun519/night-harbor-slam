// Exploration: walk the facility and the harbour street, talk, use things, go through doors, start matches.
import { meetCine, raidCine, raidWonCine, raidLostCine, allianceCine } from './brStory.js';
import { drawBelt } from '../render/FighterRenderer.js';
import { QUEST, QUEST_ITEMS, affOf, addAff, questDue, makeQuest, questAsk, questText, questReward } from './quests.js';
import { GEAR, gearNow, gearNext, tierOf, feeK, buyGear, gymOf } from './gymGear.js';
import { waveOpen, visitor, takeGift, MARKET } from './market.js';
import { SYNERGY, SYN_KIND, synName, needMoves } from '../data/synergy.js';
import { BR, isBR, brState, brRival, brMeetDue, brRaidDue, brRaidLineup, brRaidResult, brLobbyFix, brRunInDue, brRunInMark, brMods, brAfterLine } from './blackRope.js';
import { VIEW_W, VIEW_H, clamp, damp, sgn, fmtMoney, josa, RNG, pick } from '../core/util.js';
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
import { MOVES, FINISHERS } from '../data/moves.js';
import { LOCATIONS, bakeLocation, drawWindows, streetFar, FLOOR } from './locations.js';
import { NPCS, peopleAt, talk, roomBanter, preFightLine, PRE } from './npcs.js';
import { Cutscene } from './Cutscene.js';
import { ceremonyCine, signalCine, invasionCine, aftermathCine, secondWaveCine, afterSecondCine, captainCine, retreatCine, captainWinsCine, rebuiltCine } from './owStory.js';
import { beggarState, beggarTalk, thanksSteps, lessonReady } from './beggar.js';
import { Dialogue } from './Dialogue.js';
import { SLOT_NAMES, saleOn, merchantOn, BUFF_NAMES, GANG, LEARNABLE, learnedText, OW } from './CareerManager.js';
import * as Menus from './menus.js';
import { Training } from './Training.js';
import { Actor } from './Actor.js';
import { HARBOR, harborRepaired, harborFull, harborLeft, harborRatio, worldReady, donate, signReport } from './harbor.js';
import { ENDINGS, canFinish, finishOptions, stayOk } from './endings.js';
import { newWaveCine, worldCallCine, stayCine, ENDING_CINES } from './endingStory.js';
import { EndingScene } from '../scenes/EndingScene.js';

const P = new Float32Array(16);
export class WorldScene {
  constructor(game, career, o = {}) {
    this.game = game; this.c = career; this.t = 0; this.bc = new BodyCanvas(); this.overlays = []; this.dialog = null; this.toasts = []; this.prompt = null; this.camX = 0; this.farCache = {}; this.cine = null; this.cineQ = [];
    this.player = new Actor(career.look(), { x: career.d.x || 240, face: 1, id: 'me' });
    this.player.name = career.d.name;
    this.enter(career.d.loc || 'lobby', career.d.x || 240, true);
    if (o.intro) {
      const K = a => game.input.label(a);
      this.say([{ who: 'janitor', text: `어이, 거기! 네가 오늘 온다던 신인 ${josa(career.d.name, '이/가')}구나. 여긴 야항 체육관 로비야.` + (o.tutored ? ' 관장님 기초 훈련은 살아서 나왔군? 대단해.' : '') },
        { who: 'janitor', text: `사장님 방은 바로 오른쪽의 {y}사장실{/} 문이야. 문 앞에 서서 {y}${K('door')}{/}(또는 {y}${K('interact')}{/})를 누르면 들어가.` },
        { who: 'janitor', text: `사람 앞에 서면 머리 위에 표시가 떠. 그때 {y}${K('interact')}{/}나 {y}Enter{/}로 말을 걸면 돼. 가야 할 곳은 화면 왼쪽 위 {y}목표{/}와 노란 화살표가 알려 줄 거다.` },
        { who: 'janitor', text: `{y}${K('info')}{/}을 누르면 네 상태를 볼 수 있다. 특히 {v}부상 게이지{/}는 자주 확인하라고.` }]);
    }
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
    this.approachers = [];
    this.townEvents(id, instant);
    if (id === 'lobby' && this.c.injuryLevel !== 'ok' && this.c.d.flags.injWarnDay !== this.c.d.day) { this.c.d.flags.injWarnDay = this.c.d.day; setTimeout(() => this.toast(this.c.injuryLevel === 'danger' ? `부상 위험 ${Math.round(this.c.d.injury)}% — 당장 치료가 필요하다!` : `부상 주의 ${Math.round(this.c.d.injury)}% — 의원에 들르자`, this.c.injuryLevel === 'danger' ? '#ff5b5b' : '#ffb347'), 400); }
    if (!instant) this.c.save();
  }
  goDoor(d) {
    const A = this.game.audio;
    const d0 = this.c.d; if (d.lock && !this.unlocked(d.lock)) { A.sfx('deny'); this.toast({ rivalgym: '문이 잠겨 있다. "명성 40 이상만 도장 깨기 접수"', dome: d0 && d0.ow && OW.damaged.includes(d0.ow.state) ? '등대 돔은 선항 레슬링의 습격으로 부서져 수리 중이다. 출입 금지.' : '"챔피언십 관계자 외 출입 금지"', basement: '"관계자 외 출입 금지" …문 아래에서 함성이 새어 나온다.', gymOpen: '로비 난투로 훈련장 문짝이 떨어져 나갔다. 김 반장에게 정리를 부탁하자.', hideout: '어둡고 좁은 골목. 쓰레기 더미 너머가 보이지 않는다. 골목 앞 영감이 여기 산다던데…' }[d.lock] || '잠겨 있다', '#ff8a8a'); return; }
    A.sfx('door');
    this.fadeT = this.fadeDur = .45; this.fadeTo = () => { this.enter(d.to, d.at); };
  }
  unlocked(k) { const d = this.c.d; if (k === 'rivalgym') return d.fame >= 40 || d.flags.champion; if (k === 'dome') return !(d.ow && OW.damaged.includes(d.ow.state)) && ((d.contract && d.contract.title) || d.flags.champion); if (k === 'basement') return !!(d.revenge && d.revenge.invited) || !!d.flags.basementKnown || !!(d.ow && OW.damaged.includes(d.ow.state)); if (k === 'hideout') return !!d.flags.hideout; if (k === 'gymOpen') return !(d.br && d.br.lobby === 'damaged'); return true; }
  say(steps, o = {}) { this.dialog = new Dialogue(this.game, steps, Object.assign({ player: this.player, onEnd: () => { this.dialog = null; if (o.after) o.after(); } }, o)); }
  toast(text, col = '#eef2ff') { this.toasts.push({ text, col, t: 0 }); if (this.toasts.length > 4) this.toasts.shift(); }
  open(o) { this.overlays.push(o); this.game.input.clear(); }
  closeTop() { this.overlays.pop(); this.game.input.clear(); }
  // ---- things that happen in town: people walking up to talk, gangs, revenge ----
  approach(a, fn, o = {}) { a.scripted = true; this.approachers.push({ a, fn, speed: o.speed || 120, near: o.near || 56, range: o.range || 1e9 }); }
  tickApproach(dt) {
    if (!this.approachers.length || this.dialog || this.overlays.length || this.fadeT > 0) return;
    const p = this.player;
    for (const ap of this.approachers.slice()) {
      const a = ap.a, d = p.x - a.x;
      if (Math.abs(d) > ap.range) { a.vx = 0; continue; }
      if (Math.abs(d) <= ap.near) { a.vx = 0; a.face = sgn(d) || a.face; this.approachers.splice(this.approachers.indexOf(ap), 1); a.scripted = false; if (ap.fn) { p.face = -a.face; ap.fn(a); return; } continue; }
      a.vx = sgn(d) * ap.speed; a.face = sgn(d); a.x += a.vx * dt;
    }
  }
  townEvents(id, instant) {
    const c = this.c, d = c.d;
    if ((id === 'lobby' || id === 'street') && d.flags.newsDay !== d.day) {
      d.flags.newsDay = d.day;
      if (saleOn(d)) setTimeout(() => this.toast('오늘은 항구 대세일! 항구의원·돛대 상회 소모품 30% 할인', '#ff8fc4'), 700);
      if (merchantOn(d)) setTimeout(() => this.toast('떠돌이 상인 보부가 부둣길 광장 옆에 보따리를 풀었다!', '#c98aff'), 1300);
      { const wf = c.weeklyOffer(); if (wf) setTimeout(() => this.toast(`오늘은 주간 파이널! 경기장 대기실에서 ${wf.oppName}와(과) 보너스 경기 — 이기면 기술 전수`, '#ffd65a'), 1900); }
    }
    if (d.revenge && d.day > d.revenge.until) { this.toast(`${josa(d.revenge.oppName, '은/는')} 지하에서 기다리다 지쳐 돌아갔다.`, '#c9d4ff'); d.revenge = null; }
    const R = d.revenge;
    if (id === 'lobby' && R && !R.invited && d.day >= R.day) { const a = this.npcs.find(n => n.id === R.opp); if (a) { this.approach(a, () => this.say(this.revengeInvite()), { range: 260, speed: 105 }); return; } }
    // 골목 영감 walks up once a day on the street until he takes you in; in his gym he comes over when a lesson is due
    if (id === 'street' && !d.flags.hideout && d.day >= 2) { const B = beggarState(d), a = this.npcs.find(n => n.id === 'beggar'); if (a && B.askDay !== d.day && B.day !== d.day) { B.askDay = d.day; this.approach(a, () => this.say(beggarTalk(c, this)), { range: 380, speed: 55, near: 50 }); } }
    if (id === 'hideout' && lessonReady(d)) { const a = this.npcs.find(n => n.id === 'beggar'); if (a) this.approach(a, () => this.say(beggarTalk(c, this)), { range: 600, speed: 60, near: 50 }); }
    // 선항 레슬링: whatever beat of the story is due (see CareerManager.owDue)
    const due = !instant && !this.owBusy ? c.owDue(id) : null;
    if (due) {
      const s2 = d.season >= 2, foeLv = s2 ? 'expert' : 'hard';
      if (due === 'signal') this.playCine(signalCine(this));
      else {
        this.owBusy = true;
        if (due === 'invasion1') { const o = { opp: 'whiteivory', oppName: '흰상아', kind: 'invasion', mode: 'single', arena: 'pier', reward: 60000 + d.season * 20000, fame: 14, difficulty: foeLv }; this.playCine(invasionCine(this, () => this.startMatch('invasion', o))); }
        if (due === 'invasion2') { const o = { opp: 'whiteivory', oppName: '흰상아 · 선항 선원', kind: 'invasion2', mode: 'tag', arena: 'pier', reward: 80000 + d.season * 20000, fame: 16, difficulty: foeLv }; this.playCine(brState(d).stage !== 'NONE' ? allianceCine(this, o, () => this.startMatch('invasion2', o)) : secondWaveCine(this, () => this.startMatch('invasion2', o))); }
        if (due === 'invasion3') { const o = { opp: 'godong', oppName: '선장 고동', kind: 'invasion3', mode: 'single', arena: 'pier', reward: 150000 + d.season * 40000, fame: 30, difficulty: foeLv }; this.playCine(captainCine(this, () => this.startMatch('invasion3', o), d.ow.state === 'CAPTAIN')); }
        if (due === 'rebuilt') { this.playCine(rebuiltCine(this)); }
        return;
      }
    }
    // the pier: the fund is full (A NEW WAVE), then 구만석 사장 brings the invitation to the world stage
    if ((id === 'street' || id === 'lobby') && !instant && !this.endBusy && !d.ending) {
      if (harborFull(d)) { this.endBusy = true; this.playCine(newWaveCine(this), { onEnd: () => { this.endBusy = false; } }); return; }
      if (worldReady(d) && !d.harbor.called) { this.endBusy = true; this.playCine(worldCallCine(this), { onEnd: () => { this.endBusy = false; } }); return; }
    }
    // 서도현 walks up and books the rival match himself
    if ((id === 'lobby' || id === 'street') && !instant && d.rivalCall && !d.contract && !this.endBusy) {
      const R = d.rivalCall, x = this.player.x;
      this.playCine([{ bars: 1 }, { music: 'rival' }, { spawn: 'dohyun', x: x - 240, face: 1 }, { walk: 'dohyun', to: x - 48, speed: 170 }, { face: 'me', dir: 'dohyun' },
        { say: [{ who: 'dohyun', text: R.rival === 1 ? `어이, ${d.name}. 랭킹표 봤냐? 우리 둘이 붙어 있더군. 한 판 붙자.` : `${R.rival}차전이다. 도망칠 생각 마라.`, expr: 'fierce' }, { who: 'dohyun', text: `${R.day}일, 부둣가 특설 링. 사장님한테는 이미 말해 뒀다.${R.falls ? ' 이번엔 3판 2선승이다.' : ''}` }, { act: () => { c.accept(R); d.rivalCall = null; d.flags.rivalDay = d.day; c.save(); this.toast(`라이벌전 계약: 서도현 (${R.day}일까지, 부둣가 특설 링)`, '#ff6b7a'); } }] },
        { walk: 'dohyun', to: x - 300, speed: 150 }, { bars: 0 }]);
      return;
    }
    // a wrestler in the lobby asks a favour (one at a time)
    if (id === 'lobby' && !instant) { const qid = questDue(d, this.npcs.map(n => n.id)), a = qid && this.npcs.find(n => n.id === qid); if (a) { const q = makeQuest(d, qid, Object.values(d.moves.front || {}).filter(Boolean)); this.approach(a, () => this.say([{ who: qid, text: questAsk(q) }, { act: () => { this.toast('부탁: ' + questText(q) + ` (${q.until}일까지)`, '#ffd65a'); c.save(); } }]), { range: 380, speed: 90 }); return; } }
    // a good customer's seller comes by the lobby with something for the next match
    if (id === 'lobby' && !instant) { const V = visitor(d), a = V && this.npcs.find(n => n.id === V.npc); if (a) { this.approach(a, () => this.say([{ who: V.npc, text: `단골손님! 다음 경기에 쓰라고 이거 가져왔어요. ${V.gift.text}.`, expr: 'happy' }, { act: () => { takeGift(d); c.save(); this.toast(`${V.who}의 선물: ${V.gift.text}`, '#9be36b'); } }]), { range: 420, speed: 95 }); return; } }
    // the next opponent comes over in the waiting room, once per contract
    if (id === 'arena' && d.contract && CHARACTERS[d.contract.opp]) {
      const key = d.contract.opp + d.contract.day, a = this.npcs.find(n => n.id === d.contract.opp);
      if (a && d.flags.roomTalk !== key) this.approach(a, () => { d.flags.roomTalk = key; this.say(roomBanter(a.id, c)); }, { range: 300, speed: 85 });
    }
    // BLACK ROPE: the first meeting, then a raid now and then (the gang of the docks stays home that day)
    if (id === 'lobby' && !instant && !this.brBusy) {
      if (brMeetDue(c)) { this.brBusy = true; d.flags.gangDay = d.day; this.playCine(meetCine(this)); return; }
      if (brRaidDue(c)) {
        this.brBusy = true; d.flags.gangDay = d.day;
        const lu = brRaidLineup(c), o = { opp: 'brLeader', oppName: BR.name, kind: 'brRaid', lineup: lu, reward: 0, fame: 0 };
        this.playCine(raidCine(this, lu, () => this.startMatch('brRaid', o)));
        return;
      }
    }
    // troublemakers from the docks burst into the lobby: the first time from day 3, then now and then
    if (id === 'lobby' && !instant && d.day >= 3 && d.flags.gangDay !== d.day && !(R && !R.invited && d.day >= R.day)) {
      const roll = new RNG(d.day * 71 + d.season * 7).next();
      d.flags.gangDay = d.day;
      if (!d.flags.gangSeen || roll < .16) this.gangArrives();
    }
  }
  gangArrives() {
    const p = this.player, from = Math.max(40, Math.min(p.x - 230, 90));
    const mk = (id, x) => { const N = NPCS[id], a = new Actor(N.look, { x, face: 1, stance: 'street', id }); a.idx = this.npcs.length + 1; this.npcs.push(a); return a; };
    const boss = mk('galchi', from), kid = mk('myeolchi', from - 34);
    this.approach(boss, () => this.say(this.gangLines()), { speed: 175 });
    this.approach(kid, null, { speed: 175, near: 92 });
    if (GANG[this.c.gangTier()].who.includes('kkongchi')) this.approach(mk('kkongchi', from - 70), null, { speed: 160, near: 130 });
    this.toast('부둣가 악동단이 로비에 들이닥쳤다!', '#ffb347');
    this.game.audio.sfx('door'); this.game.audio.sfx('warn');
  }
  gangLeave() { for (const a of this.npcs) if (a.id === 'galchi' || a.id === 'myeolchi' || a.id === 'kkongchi') { a.leaving = true; a.scripted = false; } this.approachers = this.approachers.filter(ap => !ap.a.leaving); }
  gangLines() {
    const c = this.c, d = c.d, first = !d.flags.gangSeen;
    d.flags.gangSeen = (d.flags.gangSeen || 0) + 1;
    const offer = { opp: 'galchi', oppName: '부둣가 악동단', reward: 30000 + d.season * 5000, fame: 4, kind: 'brawl' };
    const fight = () => this.startMatch('brawl', offer), price = Math.min(8000, d.money), G = GANG[c.gangTier()], three = G.who.length > 2;
    return [
      { who: 'galchi', text: first ? '자, 자! 주목! 오늘부터 이 체육관은 우리 {y}부둣가 악동단{/} 구역이다!' : '우리가 또 왔다! 지난번 일은 기억 안 나지만, 아무튼 또 왔다!', expr: 'smug' },
      { who: 'myeolchi', text: first ? '형님… 저 사람 레슬러 같은데요? 팔뚝이 제 허벅지만 한데요?' : '형님, 저 사람 또 있어요. 오늘은 그냥 가면 안 될까요?' },
      { who: 'galchi', text: '그러니까 더 좋지! 레슬러 하나 눕히면 우리 이름이 항구에 쫙 퍼진다고!', expr: 'fierce' },
      ...(three ? [{ who: 'galchi', text: '게다가 오늘은 {y}꽁치{/}도 데려왔지! 우리 행동대장이야!', expr: 'smug' }, { who: 'kkongchi', text: '…형님, 이놈이에요? 생각보다 크네.' }] : []),
      ...(G.armed.length ? [{ who: 'galchi', text: G.armed.length > 1 ? '연장도 넉넉히 챙겨 왔다! 접이식 의자 두 개!' : '빈손으로 올 줄 알았냐? 오늘은 {y}의자{/}도 챙겨 왔다고!', expr: 'fierce' }] : []),
      { prompt: '로비가 싸움판이 되려 한다', choice: [
        { label: `"덤벼라!" (로비 난투 1:${G.who.length})`, act: fight },
        { label: '사장님을 부른다', go: [{ who: 'boss', text: '뭐, 악동? …자네가 해결하게. 링 밖 싸움도 다 쇼 연습이야! 아, 화분은 깨지 말고!' }, { act: fight }] },
        { label: `지갑을 내준다 (${fmtMoney(price)})`, go: [{ act: () => { c.pay(price); d.fame = Math.max(0, d.fame - 2); this.toast(`악동단에게 ${fmtMoney(price)}을 뜯겼다. 명성 -2`, '#ff8a8a'); this.gangLeave(); } }, { who: 'galchi', text: '히히, 말이 통하는 녀석이네! 얘들아, 철수!' }, { who: 'myeolchi', text: '형님, 저 사람 표정이 엄청 무서운데요…' }] },
      ] },
    ];
  }
  revengeInvite() {
    const c = this.c, d = c.d, R = d.revenge;
    const excuse = pick(['지난번엔 조명이 눈부셔서 그랬던 거다. 그래, 조명 탓이야.', '그날은 아침을 안 먹어서 힘이 안 났을 뿐이다.', '링이 미끄러웠다. 분명히 미끄러웠어.', '심판이 내 쪽은 한 번도 안 봤어. 다 봤는데 안 봤다고.']);
    const down = () => { R.invited = true; d.flags.basementKnown = 1; };
    return [
      { who: R.opp, text: `${d.name}. 기다리고 있었다.`, expr: 'fierce' },
      { who: R.opp, text: excuse },
      { who: R.opp, text: '이 로비 아래에 {v}지하 링{/}이 있다. 심판도, 규칙도 없는 곳이지. 의자든 뭐든 다 쓴다. 거기서 다시 붙자.' },
      { prompt: '리벤지 신청을 받았다', choice: [
        { label: '지금 따라 내려간다', act: () => { down(); this.goDoor(LOCATIONS.lobby.doors.find(x => x.to === 'basement')); } },
        { label: `나중에 내려가겠다 (${R.until}일까지)`, go: [{ act: () => { down(); this.npcs = this.npcs.filter(n => n.id !== R.opp); this.toast(`지하 계단이 열렸다. ${R.until}일까지 ${josa(R.oppName, '이/가')} 기다린다.`, '#ffb347'); } }, { who: R.opp, text: '도망치지 마라. 지하에서 기다리겠다.' }] },
        { label: '거절한다 (명성 -2)', go: [{ act: () => { d.revenge = null; d.fame = Math.max(0, d.fame - 2); this.npcs = this.npcs.filter(n => n.id !== R.opp); } }, { who: R.opp, text: '흥, 겁쟁이 같으니라고. 소문 다 내 주지.', expr: 'smug' }] },
      ] },
    ];
  }
  revengeReady() {
    const d = this.c.d, R = d.revenge;
    const offer = { opp: R.opp, oppName: R.oppName, reward: 30000 + d.season * 8000, fame: 6, kind: 'revenge', difficulty: d.season >= 2 ? 'expert' : 'hard' };
    return [
      { who: R.opp, text: pick(['왔군. 여기선 아무도 안 말린다. 의자든 뭐든 다 쓰는 거다.', '관객은 적지만 다들 돈을 걸었지. 실망시키지 마라.', '오늘은 조명 탓도, 심판 탓도 없다.']), expr: 'fierce' },
      { prompt: '지하 리벤지 매치', choice: [{ label: `링에 오른다 (판돈 ${fmtMoney(offer.reward)})`, act: () => this.startMatch('revenge', offer) }, { label: '아직은 아니다', go: [{ who: R.opp, text: '도망칠 생각은 마라.' }] }] },
    ];
  }
  // Surprises during career matches: the boss's chair toss, a coach sneaking a chair in.
  matchEvents(kind, o) {
    const d = this.c.d;
    if (!o || o.mode === 'rumble' || o.mode === 'tag' || kind === 'title') return [];
    const r = new RNG(d.day * 97 + d.slot * 13 + d.history.length * 7 + d.season);
    const ch = CHARACTERS[o.opp], dirty = ch && ch.ai ? ch.ai.dirty || 0 : 0;
    if ((kind === 'official' || kind === 'free' || kind === 'event') && ((!d.flags.bossChairSeen && d.history.length >= 1) || r.chance(.2))) { d.flags.bossChairSeen = 1; return [{ kind: 'bossChair', at: 2 + r.next() * 4 }]; }
    if (r.chance(.12 + dirty * .35)) return [{ kind: 'coachChair', when: 'foeLosing', below: .55, coachName: `${ch ? ch.name : '상대'}의 코치` }];
    return [];
  }
  // ---- actions used by dialogues and objects ----
  openOffers() { if (!this.c.d.offers.length || this.c.d.offersDay !== this.c.d.day) this.c.makeOffers(); this.open(new Menus.OffersMenu(this)); }
  openArenaList() { this.open(new Menus.ArenaMenu(this)); }
  openShop() { this.open(new Menus.ShopMenu(this)); }
  openClinic() { this.open(new Menus.ClinicMenu(this)); }
  openFood() { this.open(new Menus.FoodMenu(this)); }
  openMerchant() { this.open(new Menus.MerchantMenu(this)); }
  openLearn(by) { this.open(new Menus.LearnMenu(this, by)); }
  openInfo(tab = 1) { this.open(new Menus.InfoMenu(this, tab)); }
  startJob() { this.startTraining('job'); }
  brLobbyFixed() { brLobbyFix(this.c); this.c.save(); this.toast('로비가 깨끗해졌다! 훈련장 문도 다시 달았다.', '#9be36b'); this.game.audio.sfx('good'); }
  // cutscenes: queued, one at a time, started when nothing else is on screen
  playCine(script, o = {}) { this.cineQ.push({ script, o }); }
  // 골목 영감: help counted once a day; thanks, and the invitation or the day's lesson when it adds up
  beggarHelped(n) { const c = this.c, d = c.d, B = beggarState(d); B.help += n; B.day = d.day; c.save(); this.say(thanksSteps(c, this, n)); }
  startTraining(game) {
    const c = this.c, d = c.d;
    if (game !== 'job' && d.slot === 2 && false) return;
    const cost = game === 'job' || game === 'scrap' || game === 'cleanup' ? 0 : Math.round((6000 + d.season * 2000) * feeK(d, game) / 1000) * 1000;
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
        // the holder of the case cashes in right there: this result is kept, the next match starts in the same ring
        const ci = W2.cashInFor(kind, offer, res);
        if (ci) {
          W2.afterMatch({ kind, offer, res, quiet: true });
          this.game.playMatch(W2.cashInConfig(ci), res2 => { const W3 = new WorldScene(this.game, c, {}); W3.enter(here, px, true); this.game.go(() => { W3.afterMatch({ kind: 'title', offer: ci, res: res2 }); return W3; }); });
          return;
        }
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
    const foe = id => { const e = Object.assign({ char: id, ctrl: 'ai', difficulty: lv }, kind === 'tutorial' || kind === 'practice' || kind === 'spar' ? {} : this.c.ddaFor(id)); if (isBR(id) && kind !== 'tutorial') { const M = brMods(c, id, e.stats); e.stats = M.stats; e.moves = M.moves; } return e; };
    if (kind === 'tutorial') return { mode: 'practice', arena: 'gym', entrants: [me, { char: 'dohyun', ctrl: 'dummy', difficulty: 'normal' }], practice: { infinite: true }, skipIntro: true, tutorial: true, career: 1, music: 'gym' };
    if (kind === 'invasion') return { beltHolder: d.flags.champion ? 'player' : null, entrances: c.entranceOpt(kind, o, this.game.settings), mode: 'single', arena: o.arena || 'pier', entrants: [me, Object.assign(foe(o.opp), { boss: true })], career: 1, boss: true, title: '선항 레슬링 침공', music: 'boss', introTime: 4.2, events: [{ kind: 'coachChair', when: 'foeLosing', below: .5, coachName: '선항 선원' }], preTalk: this.preTalk(o.opp, o) };
    if (kind === 'invasion2') return { mode: 'tag', arena: 'pier', entrants: [me, o.partner === 'brLeader' ? Object.assign(foe('brLeader'), { team: 0 }) : { char: 'dohyun', ctrl: 'ai', difficulty: 'hard' }, foe('whiteivory'), foe('owsailor')], career: 1, title: '선항 레슬링 2차 침공 · 태그', music: 'boss', introTime: 4.2 };
    if (kind === 'invasion3') return { beltHolder: d.flags.champion ? 'player' : null, entrances: c.entranceOpt(kind, o, this.game.settings), mode: 'single', arena: 'pier', entrants: [me, Object.assign(foe('godong'), { boss: true })], career: 1, boss: true, bossPhases: { by: ['hp'], max: 3 }, title: '선항 레슬링 3차 침공 · 선장 고동', music: 'boss', introTime: 4.8, preTalk: this.preTalk('godong', o) };
    if (kind === 'brRaid') {
      const lu = o.lineup, crew = lu.who.map(id => Object.assign(foe(id), { team: 1, waitTurn: 4.4, difficulty: d.season >= 2 ? 'hard' : 'normal' }));
      if (lu.late) crew.push(Object.assign(foe(lu.late), { team: 1, waitTurn: 4.4, late: 50, armed: 1, difficulty: d.season >= 2 ? 'hard' : 'normal' }));
      return { mode: 'street', arena: 'lobby', entrants: [Object.assign({}, me, { team: 0 }), ...crew], career: 1, title: 'LOBBY BRAWL · 로비를 지켜라!', events: [{ kind: 'chairs', xs: [180, 330, 560, 720] }], introTime: 3.4, music: 'rival', preTalk: null };
    }
    if (kind === 'brawl') {
      const B2 = c.gangMatch();
      return { mode: 'street', arena: 'lobby', entrants: [Object.assign({}, me, { team: 0 }), ...B2.gang], career: 1, title: B2.gang.length > 2 ? '로비 난투 1 대 3' : '로비 난투', events: [{ kind: 'chairs', xs: [250, 640] }].concat(B2.events), introTime: 3.3, music: 'rumble', preTalk: this.preTalk('galchi', o) };
    }
    if (kind === 'revenge') return { mode: 'single', arena: 'basement', special: new RNG(d.day * 3 + 1).chance(.4) ? 'cage' : null, entrants: [me, foe(o.opp)], career: 1, boss: true, title: '지하 리벤지 매치', events: [{ kind: 'chairs', xs: [262, 638] }].concat(new RNG(d.day * 5 + d.season).chance(.5) ? [{ kind: 'coachChair', when: 'foeLosing', below: .6, coachName: `${o.oppName}의 패거리` }] : []), introTime: 3.6, music: 'boss', preTalk: this.preTalk(o.opp, o) };
    // favours: a friendly match in the basement; showing a move on them in the gym ring
    if (kind === 'questSpar') return { mode: 'single', arena: 'basement', entrants: [me, foe(o.opp)], career: 1, title: '연습 상대', skipIntro: false, introTime: 2.4, music: 'gym' };
    if (kind === 'questTeach') return { mode: 'practice', arena: 'gym', entrants: [Object.assign(me, { fin: 100 }), { char: o.opp, ctrl: 'dummy', difficulty: 'normal' }], practice: { infinite: true }, skipIntro: true, career: 1, music: 'gym', lesson: { move: o.move, name: '기술 알려 주기', how: `${CHARACTERS[o.opp].name}에게 '${MOVES[o.move].name}'을(를) 걸어 주자 (잡고 그 칸의 키)` } };
    // a 시너지 lesson: the gym ring, the dummy, the moves lent to the slots for the hour
    if (kind === 'synLesson') { const S = SYNERGY[o.syn], mv = JSON.parse(JSON.stringify(c.d.moves)); if (MOVES[S.a] && MOVES[S.a].pos !== 'dash' && !Object.values(mv.front).includes(S.a)) mv.front.n = S.a; if (S.seq && !Object.values(mv.front).includes('irishWhip')) mv.front.f = 'irishWhip'; if (S.seq) mv.catch = S.a; const L = Object.assign(me, { moves: mv, synergies: (c.d.syn || []).concat([o.syn]), fin: 100 }); if (MOVES[S.a] && MOVES[S.a].pos === 'dash') L.char = Object.assign({}, L.char, { dashSig: S.a }); return { mode: 'practice', arena: 'gym', entrants: [L, { char: 'dohyun', ctrl: 'dummy', difficulty: 'normal' }], practice: { infinite: true }, skipIntro: true, career: 1, music: 'gym', lesson: { id: o.syn, name: S.name, how: S.how } }; }
    if (kind === 'practice' || kind === 'spar') return { mode: 'practice', arena: 'gym', entrants: [me, { char: o && o.opp || 'dohyun', ctrl: 'dummy', difficulty: 'normal' }], practice: { infinite: true }, skipIntro: true, career: 1, music: 'gym' };
    if (o && o.mitb) { const id = o.mitbFoe && CHARACTERS[o.mitbFoe] ? o.mitbFoe : this.c.mitbFoe(); return { entrances: c.entranceOpt(kind, o, this.game.settings), mode: 'single', special: 'ladder', arena: 'dome', entrants: [me, foe(id)], career: 1, title: '머니 인 더 뱅크', music: 'rumble', introTime: 3.6, dda: d.dda }; }
    if (o && o.mode === 'rumble') { const pool = ['taesan', 'haneul', 'neon', 'mandeok', 'dongsu', 'bokja', 'dueok', 'palcho', 'baeksang', 'bjorn', 'baekpa', 'dohyun'], r = new RNG(d.day * 31); return { mode: 'rumble', arena: 'hall', entrants: [me, ...r.shuffle(pool).slice(0, 9).map(foe)], career: 1, title: '만선 럼블' }; }
    if (o && o.mode === 'tag') return { mode: 'tag', arena: o.arena || 'pier', entrants: [me, { char: 'dohyun', ctrl: 'ai', difficulty: 'hard' }, foe('dueok'), foe('baeksang')], career: 1, title: '항구 태그 대전' };
    const sp = o && o.special, bossF = o && o.bossPhases ? Object.assign(foe(o.opp), { boss: true }) : null;
    if (o && o.cashIn === 'player' && bossF) bossF.hpStart = .62;   // cashing in on a champion still worn from a defence
    if (o && o.cashIn && o.cashIn !== 'player') me.hpStart = Math.max(.3, o.hpLeft || .5);   // jumped right after your own match
    const runIn = brRunInDue(c, kind, o); if (runIn) brRunInMark(c, runIn);
    const beltHolder = d.flags.champion ? 'player' : o && o.opp && o.opp === c.champion ? o.opp : null;
    return { beltHolder, entrances: c.entranceOpt(kind, o, this.game.settings), music: o && isBR(o.opp) ? 'rival' : undefined, special: sp || null, falls: o && o.falls || 0, iron: o && o.iron || 0, bossPhases: o && o.bossPhases ? { by: ['fall', 'kickout', 'hp'], max: 3 } : null, events: this.matchEvents(kind, o).concat(runIn ? [{ kind: 'rivalRunIn', who: runIn, at: 20 + (d.day % 5) * 6, noContest: .35 }] : []).concat(d.buffs && d.buffs.chair ? [{ kind: 'chairs', xs: [270] }] : [], sp === 'cell' ? [{ kind: 'chairs', xs: [80, 820] }] : []), preTalk: o && CHARACTERS[o.opp] ? this.preTalk(o.opp, o) : null, mode: o && o.mode || 'single', arena: o && o.arena || 'hall', entrants: [me, bossF || foe(o ? o.opp : 'dohyun')], career: 1, boss: o && (o.title || o.opp === 'fogking' || o.kind === 'rival'), title: o && o.title ? '챔피언 타이틀 매치' : o && o.kind === 'weekly' ? '주간 파이널' : o && o.kind === 'brmatch' ? `${BR.name} · ${o.oppName}` : o && o.kind === 'dojo' ? '도장 깨기' : o && o.kind === 'rival' ? `라이벌전 ${o.rival}차전` : null, introTime: o && (o.title || o.kind === 'rival') ? 4.2 : 3.2 };
  }
  afterMatch(info) {
    const c = this.c, { kind, offer, res } = info;   // info.quiet: a cash-in follows at once (no result screen yet)
    if (kind === 'tutorial') { if (res.completed) c.d.flags.tutored = 1; this.toast(res.completed ? '기초 훈련 수료! 백 관장: "나쁘지 않군. 땀 닦고 가."' : '기초 훈련을 중간에 그만뒀다.', res.completed ? '#9be36b' : '#c9d4ff'); c.save(); return; }
    if (res.quit && kind === 'practice') { this.toast('연습을 마쳤다.'); return; }
    if (kind === 'questSpar') { this.finishQuest('spar', res.won ? QUEST.sparWin : 0); c.spendSlot(1).forEach(m => this.toast(m, '#ffb347')); c.save(); return; }
    if (kind === 'questTeach') { if (res.lesson) this.finishQuest('teach'); else this.toast('아직 기술을 보여 주지 못했다.', '#c9d4ff'); c.save(); return; }
    if (kind === 'synLesson') { const S = SYNERGY[offer.syn]; if (res.lesson) { c.learnSynergy(offer.syn); c.save(); this.game.audio.sfx('good'); this.toast(`시너지 습득: ${S.name}`, '#6be38a'); this.lesson = [{ who: 'trainer', text: `그거다. ${S.name}. 몸이 기억할 때까지 링에서 써 봐라.` }]; } else this.toast('수업을 끝내지 못했다. 다시 오면 수업료 없이 가르쳐 준다.', '#c9d4ff'); return; }
    const sum = c.applyResult(kind === 'spar' ? 'practice' : kind, res, { offer });
    if (offer && offer.kind === 'dojo' && res.won) {
      c.d.flags['dojo_' + offer.opp] = 1;
      // "이기면 우리 기술을 가르쳐 주지": one of the winner's own moves, else one of the gym's lessons for free
      const ch = CHARACTERS[offer.opp], own = [...Object.values(ch.moves.front || {}), ...Object.values(ch.moves.rear || {})].filter((id, i, a) => MOVES[id] && !c.d.known.includes(id) && a.indexOf(id) === i);
      const gym = LEARNABLE.filter(l => l.by === 'rival' && MOVES[l.id] && !c.d.known.includes(l.id)).map(l => l.id);
      const id = own.length ? own[Math.floor(Math.random() * own.length)] : gym[0];
      c.d.flags['taught_' + offer.opp] = 1;
      if (id) this.lesson = [{ who: offer.opp, text: `약속은 약속이지. 우리 도장 기술 '${MOVES[id].name}', 지금 가르쳐 주마.` }, { act: () => { c.learn(id); c.save(); this.toast(learnedText(id), '#6be38a'); this.game.audio.sfx('good'); } }, { who: offer.opp, text: '그리고 다른 기술도 배우고 싶으면 언제든 와. 수업료는 받지만.' }];
      else this.lesson = [{ who: offer.opp, text: '…가르칠 게 없군. 우리 기술은 이미 다 알잖아. 대신 이건 수업료 돌려주는 셈 치고.' }, { act: () => { c.earn(20000); this.toast('도장 사례금 +' + fmtMoney(20000), '#9be36b'); } }];
    }
    // BLACK ROPE: the raid's outcome, what they say after a match with you, and a challenge after a run-in
    if (kind === 'brRaid') { const out = brRaidResult(c, !!res.won); c.save(); this.playCine(res.won ? raidWonCine(this, out) : raidLostCine(this, out)); }
    else if (offer && isBR(offer.opp) && !res.quit) this.lesson = (this.lesson || []).concat([{ who: offer.opp, text: brAfterLine(c.d, offer.opp, !!res.won), expr: res.won ? 'hurt' : 'happy' }]);
    const RI = res.match && res.match.runIn;
    if (RI && CHARACTERS[RI.who]) { brState(c.d).rematch = 1; this.lesson = (this.lesson || []).concat([{ who: RI.who, text: RI.nc ? '심판이 경기를 끊었군. 아쉽게 됐어, 챔피언 후보님.' : RI.hit ? '내 선물은 잘 받았나? 다음엔 링 위에서 직접 주지.' : '피했다고 끝난 줄 알아? 사장실에 도전장 넣어 뒀다.', expr: 'fierce' }, { who: null, name: BR.name, text: `${CHARACTERS[RI.who].name}의 재대결 요구가 사장실 제안에 올라왔다.` }]); }
    if (offer && offer.opp && CHARACTERS[offer.opp] && !res.quit) { const S0 = c.d.flags.seenEnt || (c.d.flags.seenEnt = {}); S0[offer.opp] = 1; }
    // 주간 파이널: the beaten finalist keeps the promise
    if (kind === 'weekly' && offer && res.won) {
      c.d.flags.weeklyWins = (c.d.flags.weeklyWins || 0) + 1;
      const L = c.weeklyLesson(offer.opp), who = offer.opp;
      if (L && L.move) this.lesson = [{ who, text: pick([`…졌다. 약속은 약속이지. 내 '${MOVES[L.move].name}', 제대로 보여 주마.`, `주간 파이널 우승자에게 주는 선물이다. '${MOVES[L.move].name}', 잘 봐 둬.`]) }, { act: () => { c.learn(L.move); c.save(); this.toast(learnedText(L.move), '#6be38a'); this.game.audio.sfx('good'); } }];
      else if (L && L.fin) this.lesson = [{ who, text: `…내 피니셔까지 보여 줘야 하나. 좋아, '${FINISHERS[L.fin].name}'. 몸으로 기억해라.` }, { act: () => { c.learnFinisher(L.fin); c.save(); this.toast(`새 피니셔 습득: ${FINISHERS[L.fin].name} (Tab → 기술에서 F로 바꾸기)`, '#ffd65a'); this.game.audio.sfx('good'); } }];
      else this.lesson = [{ who, text: '더 가르칠 게 없군. 대신 이거라도 받아 둬.' }, { act: () => { c.earn(20000); this.toast('주간 파이널 특별 상금 +' + fmtMoney(20000), '#9be36b'); } }];
    }
    // 선항 레슬링: win or lose, the dome is wrecked by the time the match is over
    if ((kind === 'invasion' || kind === 'invasion2' || kind === 'invasion3') && c.d.ow) {
      const st0 = c.d.ow.state;
      c.owAfterMatch(kind, !!res.won); c.save();
      if (kind === 'invasion') this.playCine(aftermathCine(this, !!res.won));
      if (kind === 'invasion2') this.playCine(afterSecondCine(this, !!res.won));
      if (kind === 'invasion3') this.playCine(res.won ? retreatCine(this) : captainWinsCine(this, st0 === 'CAPTAIN'));
    }
    // the first belt: a ceremony
    if (kind === 'title' && res.won && c.d.flags.champion && !c.d.flags.ceremony && c.d.flags.champDay === c.d.day) this.playCine(ceremonyCine(this));
    if (kind === 'free' || kind === 'dojo' || kind === 'brawl' || kind === 'revenge' || kind === 'weekly' || kind === 'invasion' || kind === 'invasion2' || kind === 'invasion3' || kind === 'brRaid') { const msgs = c.spendSlot(1); msgs.forEach(m => this.toast(m, '#ffb347')); }
    if (kind === 'brawl') {
      if (res.won) { c.d.flags.gangBeaten = (c.d.flags.gangBeaten || 0) + 1; this.toast('악동단을 쫓아냈다! 사장님이 로비 지킴이 보너스를 줬다.', '#9be36b'); }
      else if (!res.quit) { const st = Math.min(12000, c.d.money); if (st > 0) { c.pay(st); this.toast(`악동단이 지갑을 털어 갔다… -${fmtMoney(st)}`, '#ff8a8a'); } }
    }
    if (kind === 'revenge') { c.d.revenge = null; this.toast(res.won ? '지하의 리벤지를 짓밟았다! 판돈을 챙겼다.' : '지하에서 졌다… 소문이 금방 퍼질 거다.', res.won ? '#9be36b' : '#ff8a8a'); }
    // a beaten wrestler may teach one of their moves the first time you beat them
    if (res.won && offer && offer.kind !== 'dojo' && offer.kind !== 'weekly' && CHARACTERS[offer.opp] && !CHARACTERS[offer.opp].thug && !c.d.flags['taught_' + offer.opp] && offer.opp !== 'fogking') {
      const ch = CHARACTERS[offer.opp], pool = [...Object.values(ch.moves.front || {}), ...Object.values(ch.moves.rear || {})].filter((id, i, a) => MOVES[id] && !c.d.known.includes(id) && a.indexOf(id) === i);
      if (pool.length && Math.random() < .6) {
        const id = pool[Math.floor(Math.random() * pool.length)], mv = MOVES[id];
        c.d.flags['taught_' + offer.opp] = 1;
        this.lesson = [{ who: offer.opp, text: pick([`…좋은 경기였다. 너라면 써도 되겠지. 내 기술 '${mv.name}', 가르쳐 주마.`, `흥, 졌다. 대신 이건 알아 둬. '${mv.name}'은 이렇게 거는 거다.`, `다음엔 안 진다. 그래도… 내 '${mv.name}', 한 번 보여 주지.`]) }, { act: () => { c.learn(id); c.save(); this.toast(learnedText(id), '#6be38a'); this.game.audio.sfx('good'); } }];
      }
    }
    // a beaten wrestler may come back for revenge a few days later
    if (res.won && (kind === 'official' || kind === 'free' || kind === 'dojo') && offer && CHARACTERS[offer.opp] && offer.opp !== 'fogking' && !c.d.revenge && Math.random() < (c.d.flags.revengeSeen ? .4 : .8)) { c.d.flags.revengeSeen = 1; c.d.revenge = { opp: offer.opp, oppName: offer.oppName || CHARACTERS[offer.opp].name, day: c.d.day + 2, until: c.d.day + 7, invited: false }; }
    else if (kind === 'official' || kind === 'event' || kind === 'title') { const msgs = c.spendSlot(1); msgs.forEach(m => this.toast(m, '#ffb347')); }
    c.save();
    if (!info.quiet) this.open(new Menus.ResultMenu(this, sum, res, kind, offer));
    else (sum.lines || []).slice(0, 2).forEach(l => this.toast(l, '#ffd65a'));
  }
  // Money in the Bank: while you are champion the holder may jump you right after the bell (decided as the match ends)
  cashInFor(kind, offer, res) {
    const c = this.c, M = c.d.mitb;
    if (!(M && M.holder !== 'player' && c.d.flags.champion && CHARACTERS[M.holder] && res.won && !res.quit && !(offer && offer.cashIn) && ['official', 'title', 'event', 'free'].includes(kind) && (c.d.day >= M.until - 1 || Math.random() < .5))) return null;
    const h = res.match && res.match.human, left = h ? h.hp / h.maxHp : .5, ch = CHARACTERS[M.holder];
    return { opp: M.holder, oppName: ch.name, mode: 'single', arena: (res.match && res.match.cfg.arena) || (offer && offer.arena) || 'hall', reward: 80000, fame: 20, kind: 'title', title: 1, cashIn: M.holder, hpLeft: left, difficulty: c.d.season >= 2 ? 'hard' : 'normal', bossPhases: 0 };
  }
  // the cash-in match: you are still in the ring; only the holder walks out, short, and the bell goes
  cashInConfig(ci) { const cfg = this.matchConfig('title', ci); cfg.entrances = { short: 1, only: [ci.opp] }; cfg.preTalk = null; cfg.introTime = 1.4; cfg.title = '머니 인 더 뱅크 캐시인!'; cfg.cashInRun = 1; return cfg; }
  // Face to face in the ring before the bell: the opponent's line, the player's answer, a small effect.
  preTalk(id, o) {
    const c = this.c, line = PRE[id] ? PRE[id].ring : CHARACTERS[id] ? CHARACTERS[id].lines.intro : null;
    if (!line) return null;
    const first = preFightLine(id, c);
    return { opp: id, lines: [{ who: id, text: first }, { who: id, text: line, expr: 'fierce' }],
      choices: [
        { label: '"한 방에 끝내 주지."', reply: pick(['뭐라고?! 후회하게 해 주마!', '하, 입만 살았군!', '그 말, 링 바닥에서 다시 해 봐라!']), fx: 'taunt' },
        { label: '"좋은 경기 합시다."', reply: pick(['…흥, 예의는 아는군.', '그래, 끝나고도 그 말 할 수 있으면.', '좋아. 봐주진 않는다.']), fx: 'respect' },
        { label: '"……" (말없이 노려본다)', reply: pick(['…뭘 봐?', '…눈싸움은 내가 이긴다.', '……']), fx: 'stare' },
      ] };
  }
  checkGameOver() { if (this.c.d.injury >= 100) { this.game.go(() => new Menus.GameOverScene(this.game, this.c)); return true; } return false; }
  // ---- update ----
  update(dt) {
    this.t += dt;
    const inp = this.game.input, A = this.game.audio, p = this.player, L = this.L;
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter(t => t.t < 3.4);
    // fadeT must land on exactly 0: it is a "transition running" flag as well as a timer
    if (this.fadeT > 0) { this.fadeT = Math.max(0, this.fadeT - dt); if (this.fadeT <= .22 && this.fadeTo) { const f = this.fadeTo; this.fadeTo = null; f(); } }
    const fading = this.fadeT > 0;
    if (this.cashInNext && !this.overlays.length && !this.dialog && !fading) {   // the holder of the case runs in
      const o = this.cashInNext; this.cashInNext = null;
      this.game.audio.sfx('bell3');
      this.say([{ who: 'staff', text: '자, 잠깐! 저 음악은…! 머니 인 더 뱅크 가방이다!' }, { who: o.opp, text: '수고했어, 챔피언. 숨 고를 시간은 없어. 가방, 지금 쓴다!', expr: 'fierce' }, { act: () => this.startMatch('title', o) }]);
    }
    if (!this.cine && this.cineQ.length && !this.overlays.length && !this.dialog && !fading) { const n = this.cineQ.shift(); this.cine = new Cutscene(this, n.script, n.o); this.cine.start(); }
    if (this.cine) {
      this.cine.update(dt);
      if (this.cine && this.cine.done) this.cine = null;
      for (const a of this.npcs) this.npcThink(a, dt);
      if (this.npcs.some(a => a.gone)) this.npcs = this.npcs.filter(a => !a.gone);
      this.prompt = null; this.physics(p, dt, 0); p.pose(dt); for (const a of this.npcs) a.pose(dt);
      return;
    }
    for (const a of this.npcs) this.npcThink(a, dt);
    if (this.npcs.some(a => a.gone)) this.npcs = this.npcs.filter(a => !a.gone);
    this.tickApproach(dt);
    this.guide = this.findGuide();
    if (this.overlays.length) { this.overlays[this.overlays.length - 1].update(dt); this.physics(p, dt, 0); p.pose(dt); for (const a of this.npcs) a.pose(dt); return; }
    if (this.dialog) { this.dialog.update(dt); this.physics(p, dt, 0); p.pose(dt); for (const a of this.npcs) a.pose(dt); return; }
    if (this.c.d.synNews && this.c.d.synNews.length && !fading) { const k = this.c.d.synNews.shift(), S = SYNERGY[k]; if (S) this.toast(`시너지가 추가되었습니다: ${needMoves(S).map(synName).join(' + ')} → ${S.name} (${S.kind === 'syn' ? '백 관장' : '파식대 학원'})`, '#ffd65a'); }
    if (this.c.d.flags.seasonEnd && !fading) { this.c.d.flags.seasonEnd = false; this.open(new Menus.SeasonEndMenu(this)); return; }
    let mx = (inp.down('right') ? 1 : 0) - (inp.down('left') ? 1 : 0);
    if (fading) mx = 0;
    this.runCheck(p, mx);
    this.physics(p, dt, mx);
    if (inp.pressed('up') && p.ground && !fading) { p.vy = -250; p.ground = false; A.sfx('jump'); }
    p.pose(dt);
    for (const a of this.npcs) a.pose(dt);
    // what is near?
    this.prompt = fading ? null : this.findPrompt();
    if (!fading) {
      // talk/use: E, or Enter/Space; doors: F, or any of those while standing at a door
      const use = inp.pressed('interact') || inp.menuPressed('confirm');
      const pr = this.prompt;
      if (pr && pr.kind === 'door' && (use || inp.pressed('door'))) this.goDoor(pr.door);
      else if (pr && pr.kind !== 'door' && use) this.use(pr);
      else if (!pr && (inp.pressed('interact') || inp.pressed('door') || inp.rawPressed('Enter')) && !inp.pressed('up')) this.nothingHere();
      if (inp.pressed('info')) { A.sfx('ui'); this.openInfo(1); }
      else if (inp.pressed('map')) { A.sfx('ui'); this.open(new Menus.MapMenu(this)); }
      else if (inp.pressed('pause')) { A.sfx('ui'); this.open(new Menus.PauseMenu(this)); }
    }
    const want = clamp(p.x - VIEW_W / 2 + p.face * 40, 0, Math.max(0, L.w - VIEW_W));
    this.camX = damp(this.camX, want, 5, dt);
  }
  // Pressing talk or door with nothing in reach: say what is nearest instead of silently doing nothing.
  nothingHere() {
    const p = this.player; let best = null, bd = 1e9;
    for (const a of this.npcs) { const d = Math.abs(a.x - p.x); if (d < bd) { bd = d; best = { x: a.x, name: NPCS[a.id].name }; } }
    for (const d of this.L.doors) { const dd = Math.abs(d.x - p.x); if (dd < bd) { bd = dd; best = { x: d.x, name: d.label + ' 문' }; } }
    if (!best || bd > 260) return;
    if (this.hintT && this.t - this.hintT < 1.2) return;
    this.hintT = this.t;
    this.toast(`${josa(best.name, '은/는')} ${best.x > p.x ? '오른쪽' : '왼쪽'}에 있다. 가까이 가서 누르자.`, '#c9d4ff');
  }
  // ---- where to go next: a goal line in the HUD and an arrow toward the next door or person ----
  objective() {
    const c = this.c, d = c.d, ct = d.contract;
    if (d.injury >= B.injuryDanger) return { text: '항구의원에서 부상 치료하기', loc: 'clinic', x: 400, col: '#ff8a8a' };
    if (!d.flags.metBoss) return { text: '사장실에 가서 구만석 사장과 대화하기', loc: 'office', x: 400 };
    if (ct && ct.title) { const V = this.c.titleVenue; return { text: `${V.name}에서 타이틀 매치 (~${ct.day}일)`, loc: V.loc, x: V.x }; }
    if (ct) return { text: `경기장 대기실에서 계약 경기 — ${ct.oppName} (~${ct.day}일)`, loc: 'arena', x: 600, contract: 1 };
    if (d.injury >= B.injuryWarn) return { text: '부상 주의: 항구의원에 들러 치료하기', loc: 'clinic', x: 400, col: '#ffb347' };
    if (d.quest && !d.quest.done && d.day <= d.quest.until) { const q = d.quest; return { text: '부탁: ' + questText(q), loc: q.kind === 'spar' ? 'basement' : q.kind === 'teach' ? 'gym' : q.kind === 'item' && (d.items[q.item] || 0) === 0 ? 'shop' : 'lobby', x: q.kind === 'spar' ? 470 : q.kind === 'teach' ? 860 : q.kind === 'item' && (d.items[q.item] || 0) === 0 ? 200 : 900, col: '#ff8fc4' }; }
    if (worldReady(d) && d.harbor.called) return { text: '부두 끝에서 세계로 가는 배에 오르기', loc: 'street', x: HARBOR.end - 10, col: '#49d6ff' };
    return { text: '사장실에서 다음 경기 제안 받기', loc: 'office', x: 400 };
  }
  routeTo(loc) {
    if (!LOCATIONS[loc] || loc === this.loc) return null;
    const prev = { [this.loc]: null }, q = [this.loc];
    while (q.length) { const id = q.shift(); for (const dr of LOCATIONS[id].doors) { if (dr.lock && !this.unlocked(dr.lock)) continue; if (!(dr.to in prev)) { prev[dr.to] = { from: id, door: dr }; q.push(dr.to); } } }
    if (!(loc in prev)) return null;
    let step = prev[loc];
    while (step && step.from !== this.loc) step = prev[step.from];
    return step ? step.door : null;
  }
  findGuide() {
    if (this.c.d.flags.noGuide) return null;
    const ob = this.objective(); let x = null, door = null;
    if (ob.loc === this.loc) x = ob.x; else { door = this.routeTo(ob.loc); if (door) x = door.x; }
    return { ob, x, door };
  }
  // A/D twice quickly: run. Letting go or turning round stops it.
  runCheck(p, mx) {
    const inp = this.game.input, tap = inp.pressed('right') ? 1 : inp.pressed('left') ? -1 : 0;
    if (tap) {
      if (this.lastTap && this.lastTap.dir === tap && this.t - this.lastTap.t < B.doubleTap + .06) { if (!p.running) { p.running = true; this.game.audio.sfx('whoosh', { pitch: 1.4 }); p.dust = .3; } }
      this.lastTap = { dir: tap, t: this.t };
    }
    if (!mx || (p.running && p.vx && Math.sign(p.vx) !== mx && Math.abs(p.vx) > 40)) p.running = false;
  }
  physics(a, dt, mx) {
    const L = this.L, spd = a.running ? 214 : 108;
    const want = mx * spd;
    a.vx = Math.abs(want) > 0 ? a.vx + clamp(want - a.vx, -1200 * dt, 1200 * dt) : a.vx * Math.max(0, 1 - dt * 14);
    if (mx) a.face = mx;
    a.vy += 900 * dt;
    a.x += a.vx * dt; a.y += a.vy * dt;
    if (a.y >= a.y0) { if (!a.ground && a.vy > 200) this.game.audio.sfx('land', { p: .4 }); a.y = a.y0; a.vy = 0; a.ground = true; }
    // the broken pier past the dome is closed off until it is rebuilt
    const hi = a === this.player && L.street && !harborRepaired(this.c.d) ? HARBOR.x : L.w - 18;
    if (a === this.player && a.x > hi && mx > 0 && this.t - (this.bumpT || -9) > 3) { this.bumpT = this.t; this.toast(this.c.d.harbor ? '무너진 부두다. 표지판을 읽어 보자.' : '낡은 여객 부두 — 붕괴 위험, 출입 금지.', '#c9d4ff'); }
    a.x = clamp(a.x, 18, hi);
    if (a.ground && Math.abs(a.vx) > 30) { a.stepT = (a.stepT || 0) + dt; if (a.stepT > (Math.abs(a.vx) > 150 ? .2 : .3)) { a.stepT = 0; this.game.audio.sfx('step'); } }
    if (a.dust > 0) a.dust -= dt;
  }
  npcThink(a, dt) {
    if (a.leaving) { a.vx = -190; a.face = -1; a.x += a.vx * dt; if (a.x < 30) a.gone = true; return; }
    if (a.scripted) return;
    const p = this.player, d = Math.abs(a.x - p.x);
    if (d < 90) a.face = sgn(p.x - a.x) || a.face;
    if (a.wander && d > 120) {
      a.wT -= dt;
      if (a.wT <= 0) { a.wT = 2 + Math.random() * 3; a.target = a.home + (Math.random() * 2 - 1) * a.wander; }
      if (a.target != null && Math.abs(a.target - a.x) > 4) { a.vx = sgn(a.target - a.x) * 40; a.face = sgn(a.vx); } else a.vx = 0;
      a.x += a.vx * dt;
    } else a.vx = 0;
  }
  // People win over doors and things unless those are clearly closer, so talking is easy to hit.
  findPrompt() {
    const p = this.player, L = this.L, NPC_R = 48, DOOR_R = 26;
    let best = null, bd = NPC_R;
    for (const a of this.npcs) { const d = Math.abs(a.x - p.x); if (d < bd) { bd = d; best = { kind: 'npc', a, x: a.x, label: NPCS[a.id].name, verb: '대화' }; } }
    const npc = !!best;
    for (const d of L.doors) { const dd = Math.abs(d.x - p.x); if (dd < DOOR_R && (!npc || dd < bd - 10)) { bd = dd; best = { kind: 'door', door: d, x: d.x, label: d.label, verb: d.lock && !this.unlocked(d.lock) ? '잠김' : '들어가기' }; } }
    const atDoor = best && best.kind === 'door';
    for (const o of L.objects) { if (o.when && !o.when(this.c.d)) continue; const dd = Math.abs(o.x - p.x); if (dd < Math.max(18, o.w / 2) && (!best || (npc ? dd < bd - 10 : atDoor ? dd < bd - 14 : dd < bd + 6))) { bd = dd; best = { kind: 'obj', o, x: o.x, label: typeof o.label === 'function' ? o.label(this.c.d) : o.label, verb: '조사' }; } }
    return best;
  }
  use(pr) {
    const A = this.game.audio, c = this.c, d = c.d;
    if (pr.kind === 'npc') {
      const a = pr.a; a.face = sgn(this.player.x - a.x) || a.face; this.player.face = -a.face; a.talkT = 1.5; A.sfx('ui');
      const R = d.revenge;
      if (R && a.id === R.opp && this.loc === 'basement') { this.say(this.revengeReady()); return; }
      if (R && a.id === R.opp && this.loc === 'lobby' && !R.invited) { this.approachers = this.approachers.filter(ap => ap.a !== a); a.scripted = false; this.say(this.revengeInvite()); return; }
      { const Q = d.quest; if (Q && !Q.done && Q.id === a.id && d.day <= Q.until) { this.say(this.questTalk(a.id)); return; } }
      if ((a.id === 'galchi' || a.id === 'myeolchi') && !a.leaving && this.approachers.some(ap => ap.a.id === 'galchi')) { this.approachers = this.approachers.filter(ap => ap.a.id !== 'galchi' && ap.a.id !== 'myeolchi'); for (const n of this.npcs) if (n.id === 'galchi' || n.id === 'myeolchi') n.scripted = false; this.say(this.gangLines()); return; }
      const lines = talk(a.id, c, this), fish = (d.items.fish || 0) + (d.items.bigFish || 0);
      if (NPCS[a.id] && NPCS[a.id].wrestler && fish > 0) lines.push({ choice: [{ label: `생선 선물하기 (${fish}마리)`, act: () => this.giveFish(a.id) }, { label: '그만두기', go: [] }] });
      this.say(lines);
      return;
    }
    const o = pr.o;
    switch (o.act) {
      case 'train': this.startTraining(o.game); break;
      case 'spar': this.say([{ who: 'trainer', text: '연습 링이다. 상대 행동, 체력을 바꿔 가며 기술을 시험해 봐. 기록도 부상도 남지 않아.' }, { choice: [{ label: '연습 경기 시작', act: () => this.startMatch('practice', { opp: 'dohyun' }) }, { label: '그만두기', go: [] }] }]); break;
      case 'vending': A.sfx('ui'); this.open(new Menus.VendingMenu(this)); break;
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
      case 'oldRing': this.say([{ who: null, name: '낡은 링', text: '로프가 늘어지고 매트는 꺼졌다. 그래도 누군가 매일 닦는지 먼지 한 톨 없다.' }]); break;
      case 'oldPoster': this.say([{ who: null, name: '빛바랜 포스터', text: '"검은 파도 마덕구 — 9차 방어 성공". 사진 속 얼굴은… 골목 영감이다.' }]); break;
      case 'oldBelt': this.say([{ who: null, name: '먼지 쌓인 벨트', text: '"야항 헤비급 챔피언". 지금 벨트보다 한참 낡았지만, 금박만은 아직 빛난다.' }]); break;
      case 'plaza': this.say(this.plazaLines()); break;
      case 'fountain': if (c.pay(500)) { A.sfx('coin'); this.say([{ who: 'me', text: '동전을 던졌다. "챔피언이 되게 해 주세요."' }]); d.flags.wish = (d.flags.wish || 0) + 1; } break;
      case 'job': this.say(talk('foreman', c, this)); break;
      case 'clinicBoard': this.openClinic(); break;
      case 'bed': this.openClinic(); break;
      case 'racks': this.openShop(); break;
      case 'sale': this.openShop(); break;
      case 'dojo': this.dojoMenu(); break;
      case 'undergroundRing': if (d.contract && d.contract.title && this.c.titleVenue.loc === 'basement') this.startMatch('title', d.contract); else if (d.revenge && d.revenge.invited) this.say(this.revengeReady()); else this.say([{ who: null, name: '지하 링', text: '먼지 쌓인 링. 밤마다 누군가 여기서 판돈을 걸고 싸운다는 소문이 있다.' }]); break;
      case 'crates': this.say([{ who: null, name: '나무 상자', text: '"취급 주의: 접이식 의자 50개" …대체 누가 이렇게 많이 쓰는 거지?' }]); break;
      case 'domeGate': if (d.contract && d.contract.title) this.startMatch('title', d.contract); else this.say([{ who: 'staff', text: '타이틀 매치가 있는 날에만 열립니다.' }]); break;
      case 'dockSign': this.say(this.signLines()); break;
      case 'academy': this.academyTalk(); break;
      case 'fishSpot': if (!d.owned.includes('rod')) this.say([{ who: null, name: '낚시터', text: '물 밑으로 고기 그림자가 지나간다. 낚싯대가 있으면 여기서 낚시를 할 수 있겠다. (돛대 상회)' }]); else this.open(new Training(this, 'fish', 0)); break;
      case 'wave': if (waveOpen(d)) { A.sfx('ui'); this.open(new Menus.WaveMenu(this)); } else this.say([{ who: null, name: '웨이브 상회', text: `"${MARKET.waveDay}일차 입고 예정". 컨테이너 문에 큼지막한 파도 그림. 안에서 포장 뜯는 소리가 난다.` }]); break;
      case 'pierEnd': this.pierEnd(); break;
      default: this.toast(o.label);
    }
  }
  // ---- favours and liking ----
  questTalk(id) {
    const c = this.c, d = c.d, q = d.quest, it = QUEST_ITEMS.find(i => i.id === q.item);
    if (q.kind === 'item') return (d.items[q.item] || 0) > 0 ? [{ who: id, text: `오, ${it.name}! 정말 사 왔구나. 고마워!`, expr: 'happy' }, { act: () => { d.items[q.item]--; this.finishQuest('item'); } }] : [{ who: id, text: `${it.name}, 아직이야? ${it.where}에 있을 거야. ${q.until}일까지만 부탁해.` }];
    if (q.kind === 'spar') return this.loc === 'basement' ? [{ who: id, text: '왔구나. 봐주기 없기다!', expr: 'fierce' }, { act: () => this.startMatch('questSpar', { opp: id, oppName: CHARACTERS[id].name, kind: 'questSpar' }) }] : [{ who: id, text: '지하 격투장에서 기다릴게. 로비 끝 계단으로 내려와.' }];
    return this.loc === 'gym' ? [{ who: id, text: `좋아, '${MOVES[q.move].name}'. 나한테 한 번 걸어 줘. 몸으로 배울게.` }, { act: () => this.startMatch('questTeach', { opp: id, move: q.move, kind: 'questTeach' }) }] : [{ who: id, text: '훈련장 링에서 기다리지. 천천히 와.' }];
  }
  finishQuest(kind, extra = 0) {
    const c = this.c, d = c.d, q = d.quest;
    if (!q || q.done) return;
    q.done = 1;
    this.likeUp(q.id, QUEST.gain[kind] + extra, '부탁을 들어줬다');
  }
  likeUp(id, n, why) {
    const c = this.c, d = c.d, steps = addAff(d, id, n), name = CHARACTERS[id] ? CHARACTERS[id].name : id;
    this.game.audio.sfx('good'); this.toast(`${why}: ${name} 호감도 +${n} (${affOf(d, id)}/100)`, '#ff8fc4');
    const L = [];
    for (const s of steps) { const R = questReward(c, id, s); L.push({ who: id, text: R.line, expr: 'happy' }, { act: () => this.toast(`${name}: ${R.text}`, '#9be36b') }); }
    c.save();
    if (L.length) this.say(L);
  }
  giveFish(id) { const d = this.c.d, big = (d.items.bigFish || 0) > 0; if (big) d.items.bigFish--; else d.items.fish--; this.likeUp(id, big ? QUEST.bigFish : QUEST.fish, big ? '참치를 선물했다' : '생선을 선물했다'); }
  // ---- training equipment: 백 관장 says when a station has been outgrown; the list of what can be bought ----
  gearPitch(id) {
    const c = this.c, d = c.d, next = gearNext(d, id), now = gearNow(d, id);
    if (!next) return;
    gymOf(d).pitched[id] = tierOf(d, id) + 1;
    this.say([
      { who: 'trainer', text: `강해진 만큼 더 강한 훈련기구를 사야하지 않겠어? ${josa(now.name, '은/는')} 이제 너한테 장난감이다.` },
      { who: 'trainer', text: `${next.name}. ${fmtMoney(next.price)}. 더 어렵고 더 지치지만, 그만큼 훨씬 많이 남는다.` },
      { choice: [{ label: `${next.name} 사기 (${fmtMoney(next.price)})`, act: () => this.buyGearNow(id) }, { label: '나중에', go: [{ who: 'trainer', text: '그래, 돈 모이면 말해라. 기구는 어디 안 간다.' }] }] },
    ]);
  }
  buyGearNow(id) { const c = this.c, next = gearNext(c.d, id); if (!next) return; if (!buyGear(c, id)) { this.game.audio.sfx('deny'); this.toast('돈이 모자란다', '#ff8a8a'); return; } c.save(); this.game.audio.sfx('buy'); this.toast(`새 훈련기구: ${next.name} — 더 어렵고 더 지치고, 효과는 더 크다`, '#49d6ff'); }
  gearList() {
    const d = this.c.d, rows = Object.keys(GEAR).map(id => ({ id, next: gearNext(d, id), now: gearNow(d, id) })).filter(r => r.next);
    if (!rows.length) { this.say([{ who: 'trainer', text: '더 살 기구가 없다. 이제 기구가 아니라 링이 널 키울 거다.' }]); return; }
    this.say([{ who: 'trainer', text: '어느 걸 바꿀래? 비쌀수록 어렵고 지치지만 그만큼 남는다.' }, { choice: rows.slice(0, 5).map(r => ({ label: `${r.now.name} → ${r.next.name} ${fmtMoney(r.next.price)}`, act: () => this.buyGearNow(r.id) })).concat([{ label: '그만두기', go: [] }]) }]);
  }
  // ---- 시너지: 백 관장's dictionary and lessons, 파식대 학원's books ----
  synergyTalk() {
    const d = this.c.d, first = !d.synBook;
    if (first) { d.synBook = 1; this.c.save(); }
    this.say([
      ...(first ? [{ who: 'trainer', text: '기술은 하나씩 따로 놀면 반쪽이다. 서로 다른 둘을 이으면 {y}시너지{/}, 같은 기술을 한 번 더 걸면 {y}연계{/}라고 한다.' }, { who: 'trainer', text: '이 {y}시너지 사전{/}을 줄 테니 봐 둬. 네가 가진 기술로 이을 수 있는 게 노랗게 뜬다. (Tab → 시너지)' }, { act: () => this.toast('시너지 사전을 받았다 (Tab → 시너지)', '#ffd65a') }] : []),
      { who: 'trainer', text: '두 기술을 다 가졌다고 저절로 이어지진 않아. 수업료를 내면 연습 링에서 더미로 몸에 붙여 주마. 연계와 특별한 건 부두의 {y}파식대 학원{/}에서 판다.' },
      { choice: [{ label: '시너지 수업 받기', act: () => this.open(new Menus.SynergyMenu(this, 'trainer')) }, { label: '시너지 사전 보기', act: () => this.openInfo(4) }, { label: '그만두기', go: [] }] },
    ]);
  }
  synLesson(id) { const S = SYNERGY[id]; this.say([{ who: 'trainer', text: `좋아, ${S.name}. ${S.how}. 더미한테 한 번 제대로 이어 봐라.` }, { act: () => this.startMatch('synLesson', { syn: id, kind: 'synLesson' }) }]); }
  academyTalk() {
    const d = this.c.d;
    if (d.day < 3 && d.season === 1) { this.say([{ who: null, name: '파식대 학원', text: '"연계·시너지 전문 — 3일차부터 개강". 창문 너머로 칠판에 기술 이름들이 빼곡하다.' }]); return; }
    this.say([{ who: null, name: '파식대 학원', text: '"파도를 식히는 대학원, 파식대". 칠판 가득 기술 이름과 화살표. 연계와 특수 시너지의 서를 판다. 비싸지만 강하다.' }, { act: () => this.open(new Menus.SynergyMenu(this, 'academy')) }]);
  }
  // ---- 부두 복구와 세계 무대, and the endings ----
  signLines() {
    const c = this.c, d = c.d, R = signReport(d), S = text => ({ who: null, name: '부두 표지판', text });
    if (!R) return [S('"낡은 여객 부두 — 붕괴 위험, 출입 금지." 판자 너머로 무너진 잔교가 바닷물에 잠겨 있다.')];
    if (harborRepaired(d)) return [S(`{y}${R.order}{/}`), S('"국제 부두". 기둥에 새겨진 기부자 명단 맨 위에 내 이름이 있다.'), S(worldReady(d) ? '부두 끝에서 세계로 가는 배가 기다린다.' : `${R.fame}. 세계는 아직 내 이름을 모른다.`)];
    const out = [S(`{y}${R.order}{/}`), S(`${R.fund} · ${R.fame}`)];
    if (!d.harbor.read) { d.harbor.read = 1; out.push(S('작은 글씨: "연맹은 상금의 10%를, 항구 사람들은 매일 아침 명성만큼 보탭니다. 명성 200이 넘으면 스폰서도 나섭니다."')); }
    out.push(S(R.givers));
    const left = harborLeft(d), opts = [];
    for (const g of HARBOR.gifts) if (d.money >= g && left >= g) opts.push({ label: `${fmtMoney(g)} 기부하기`, act: () => this.donateAt(g) });
    if (d.money > 0 && left > 0) opts.push({ label: `가진 돈 전부 기부하기 (${fmtMoney(Math.min(d.money, left))})`, act: () => this.donateAt(Math.min(d.money, left)) });
    opts.push({ label: '그만두기', go: [] });
    out.push({ prompt: '부두 복구 기금', choice: opts });
    return out;
  }
  donateAt(n) {
    const c = this.c, d = c.d, got = donate(c, n);
    if (!got) { this.toast('돈이 모자라다.', '#ff8a8a'); return; }
    this.game.audio.sfx('coin');
    this.toast(`부두 복구 기금에 ${fmtMoney(got)} 기부 — ${Math.floor(harborRatio(d) * 100)}%`, '#49d6ff');
    c.save();
    if (harborFull(d) && !this.endBusy) { this.endBusy = true; this.playCine(newWaveCine(this), { onEnd: () => { this.endBusy = false; } }); }
  }
  pierEnd() {
    const d = this.c.d;
    if (!worldReady(d)) { this.say([{ who: 'me', text: `수평선 너머가 세계 무대다. 명성 ${d.fame} / ${HARBOR.fame}. 아직은 바라만 볼 뿐이다.` }]); return; }
    this.say([{ who: null, name: '세계로 가는 배', text: '갑판에서 구만석 사장이 손을 흔든다. 출항하면 이 커리어는 엔딩을 맞는다.' }, { prompt: '세계 무대', choice: [
      { label: '세계로 떠난다 (엔딩)', act: () => this.confirmEnding('world') },
      ...(stayOk(d) ? [{ label: '이 항구에 남는다 (엔딩)', act: () => this.confirmEnding('stay', { fromShip: 1 }) }] : []),
      { label: '아직은 아니다', go: [{ who: 'me', text: '…조금만 더. 인사할 사람이 남았다.' }] },
    ] }]);
  }
  // 구만석 사장 → 커리어 마무리하기 (npcs.js)
  finishTalk() {
    const d = this.c.d, L = { stay: '챔피언으로 남는다', mentor: '후배를 키운다', retire: '링을 떠난다 (은퇴)', unknown: '링을 떠난다 (은퇴)' };
    this.say([
      { who: 'boss', text: '…그 얘기를 꺼낼 날이 올 줄 알았지. 앉게. 차라도 한 잔… 아, 차도 없군.' },
      { who: 'boss', text: d.flags.champion ? '벨트를 허리에 감은 채로 그런 얼굴이라니. 어떻게 하고 싶은가?' : '어떻게 마무리하고 싶은가? 어떤 선택이든 나는 자네 편일세.' },
      { prompt: '커리어 마무리', choice: [...finishOptions(d).map(id => ({ label: `${L[id]} (엔딩)`, act: () => this.confirmEnding(id, { from: 'office' }) })), { label: '아직은 아닙니다', go: [{ who: 'boss', text: '그래야지! 표 팔 날이 아직 많이 남았어.', expr: 'happy' }] }] },
    ]);
  }
  confirmEnding(id, o = {}) {
    const E = ENDINGS[id];
    this.open(new Menus.Confirm(this, `엔딩 "${E.name}"을(를) 시작할까요? 커리어는 여기서 끝나고 슬롯에 엔딩 기록이 남습니다.`, () => this.startEnding(id, o), { danger: 1 }));
  }
  // the last scene of the ending here in town, then THE FINAL BELL
  startEnding(id, o = {}) {
    const c = this.c, d = c.d;
    d.ending = { id, season: d.season, day: d.day, at: Date.now(), from: o.from || (o.fromShip ? 'ship' : null) };
    d.retired = true; d.contract = null; c.save();
    this.endBusy = true;
    const script = id === 'stay' ? stayCine(this, !!o.fromShip) : ENDING_CINES[id](this);
    this.playCine(script, { onEnd: () => { this.blackout = true; this.game.go(() => new EndingScene(this.game, c, { id })); } });
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
    if (d.contract && d.contract.day <= d.day) { this.open(new Menus.Confirm(this, `오늘이 ${josa(d.contract.oppName, '과/와')}의 계약 경기 마감일입니다. 자면 기권패가 됩니다. 그래도 잘까요?`, () => this.doSleep(), { danger: 1 })); return; }
    this.doSleep();
  }
  doSleep() { const msgs = this.c.sleep(); this.fadeT = this.fadeDur = .9; this.fadeTo = () => { this.enter(this.loc, this.player.x); msgs.forEach(m => this.toast(m, '#ffb347')); this.toast(`${this.c.d.day}일차 아침. 자동 저장했다.`, '#9be36b'); }; this.game.audio.sfx('heal'); }
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
    const L = this.L, cam = Math.round(this.camX), d = this.c.d, sl = this.skyOver != null ? this.skyOver : d.slot;   // a cutscene may borrow another sky
    if (L.street) {
      const key = 'far' + sl;
      if (!this.farCache[key]) this.farCache[key] = streetFar(L, sl);
      w.drawImage(this.farCache[key], Math.round(-cam * .4), 0);
    } else rect(w, '#05060f', 0, 0, VIEW_W, VIEW_H);
    drawWindows(w, L, cam, sl);
    w.drawImage(L.bg, -cam, 0);
    if (L.live) L.live(w, this.c, cam, this);   // what changes with the career (posters, trophies, banners)
    drawWindows.after && drawWindows.after(w);
    // people
    const all = [...this.npcs, this.player].sort((a, b) => a.y - b.y);
    for (const a of all) if (!a.hidden) this.drawActor(w, a, cam);
    if (L.liveTop) L.liveTop(w, this.c, cam, this);
    if (d.gear && d.gear.eyes === 'affGlasses') for (const a of this.npcs) if (!a.hidden && NPCS[a.id] && (NPCS[a.id].wrestler || (d.aff && d.aff[a.id]))) { const v = affOf(d, a.id), x = Math.round(a.x - cam), y = Math.round(a.y - (a.dims ? a.dims.height : 90) - 26); rect(w, '#05060f', x - 15, y - 1, 30, 11); rect(w, '#3a1a2a', x - 14, y, 28, 9); rect(w, '#ff5fa2', x - 13, y + 1, Math.round(26 * v / 100), 7); drawText(w, '♥' + v, x, y - 1, { size: 11, align: 'c', color: '#ffffff', outline: '#05060f' }); }   // 호감도 안경
    // lights
    this.lights(w, cam);
    if (sl === 2 && L.street) { w.globalAlpha = .18; rect(w, '#0a0830', 0, 0, VIEW_W, VIEW_H); w.globalAlpha = 1; }
    u.clearRect(0, 0, VIEW_W, VIEW_H);
    if (!this.cine) this.hud(u);
    if (!this.dialog && !this.overlays.length && !(this.fadeT > 0) && !this.cine) this.drawGuide(u, cam);
    if (this.cine) this.cine.draw(u);
    if (this.prompt && !this.dialog && !this.overlays.length) this.drawPrompt(u, cam);
    if (this.dialog) this.dialog.draw(u);
    for (const o of this.overlays) o.draw(u, w);
    this.drawToasts(u);
    if (this.blackout) { rect(u, '#000000', 0, 0, VIEW_W, VIEW_H); return; }   // an ending hands over to THE FINAL BELL
    if (this.fadeT > 0) { const D = this.fadeDur || .45; fade(u, clamp(this.fadeT > .22 ? (D - this.fadeT) / Math.max(.05, D - .22) : this.fadeT / .22, 0, 1)); }
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
    if (a === this.player && this.c.d.flags.champion && !(this.cineFx && this.cineFx.belt)) drawBelt(g, tmp, 'waist');   // the champion wears the belt in town
  }
  lights(w, cam) {
    const L = this.L, d = this.c.d;
    if (this.loc === 'lobby') { for (const x of [200, 560, 940]) glow(w, x - cam, 66, 60, '#ffcf7a', .18); glow(w, 560 - cam, 60, 90, '#ff5fa2', .12); }
    else if (this.loc === 'gym') for (const x of [420, 700, 980]) glow(w, x - cam, 62, 70, '#ffe0b0', .16);
    else if (this.loc === 'office') glow(w, 400 - cam, 70, 90, '#ffcf7a', .2);
    else if (this.loc === 'arena') { glow(w, 724 - cam, 110, 70, '#ff5fa2', .2); glow(w, 300 - cam, 64, 60, '#ffcf7a', .16); }
    else if (L.street) { if ((this.skyOver != null ? this.skyOver : d.slot) === 2) for (let x = 30; x < 2266; x += 260) glow(w, x - cam, FLOOR - 118, 50, '#ffe0a0', .3); glow(w, 210 - cam, 110, 90, '#ff5fa2', .15); }
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
    const inp = this.game.input, G = this.guide;
    let ly = 34;
    const busy = this.dialog || this.overlays.length;   // the dialogue name tag and windows sit here
    if (G && !busy) {
      const arrow = G.x == null ? '' : G.x > this.player.x + 8 ? ' ▶' : G.x < this.player.x - 8 ? ' ◀' : ' ▼';
      const where = G.door ? ` — ${G.door.label} 문으로` : '';
      rect(u, '#05060f', 5, ly - 2, 28, 15); rect(u, '#ffd65a', 6, ly - 1, 26, 13); drawText(u, '목표', 9, ly, { size: 11, color: '#141a36' });
      drawText(u, G.ob.text + where + arrow, 36, ly, { size: 11, color: G.ob.col || '#ffe9a8', outline: '#05060f' });
      ly += 13;
    }
    if (!busy && d.contract && !(G && G.ob.contract)) { drawText(u, `계약: ${d.contract.oppName} (~${d.contract.day}일)`, 8, ly, { size: 11, color: d.contract.day <= d.day ? '#ffb347' : '#c9d4ff', outline: '#05060f' }); ly += 13; }
    if (d.points > 0 && !busy) { drawText(u, `능력치 포인트 ${d.points} (${inp.label('info')})`, 8, ly, { size: 11, color: '#6be38a', outline: '#05060f' }); ly += 13; }
    const bf = Object.keys(d.buffs || {}).map(k => BUFF_NAMES[k] || k);
    if (bf.length && !busy) drawText(u, '다음 경기: ' + bf.join(' · '), 8, ly, { size: 11, color: '#ffd65a', outline: '#05060f' });
    drawText(u, `${inp.label('left')}·${inp.label('right')} 두 번: 달리기`, 8, 348, { size: 11, color: this.player.running ? '#ffd65a' : UI.faint, outline: '#05060f' });
    drawText(u, `${inp.label('interact')}·Enter 대화/조사 · ${inp.label('door')} 문 · ${inp.label('info')} 정보 · ${inp.label('map')} 지도 · ${inp.label('pause')} 메뉴`, 632, 348, { size: 11, align: 'r', color: UI.faint, outline: '#05060f' });
  }
  // Yellow marker over the goal (person or door) when it is on screen, or an arrow at the screen edge.
  drawGuide(u, cam) {
    const G = this.guide;
    if (!G || G.x == null) return;
    const pr = this.prompt;
    if (pr && Math.abs(pr.x - G.x) < 4) return;   // the use prompt is already there
    const sx = Math.round(G.x - cam), bob = Math.round(Math.sin(this.t * 5) * 2), on = Math.floor(this.t * 2.5) % 3 !== 0;
    if (sx < 14) { if (on) { rect(u, '#05060f', 2, 186, 16, 16); drawText(u, '◀', 10, 189, { size: 11, align: 'c', color: '#ffd65a' }); } return; }
    if (sx > VIEW_W - 14) { if (on) { rect(u, '#05060f', VIEW_W - 18, 186, 16, 16); drawText(u, '▶', VIEW_W - 10, 189, { size: 11, align: 'c', color: '#ffd65a' }); } return; }
    const a = !G.door && this.npcs.find(n => Math.abs(n.x - G.x) < 8);
    const y = a ? Math.round(a.joints.y(J.head) - 36) : FLOOR - 140;
    drawText(u, '▼', sx, y + bob, { size: 11, scale: 2, align: 'c', color: '#ffd65a', outline: '#05060f' });
  }
  drawPrompt(u, cam) {
    const pr = this.prompt, inp = this.game.input;
    const x = Math.round(pr.x - cam), y = pr.kind === 'npc' ? Math.round(pr.a.joints.y(J.head) - 34) : FLOOR - 128;
    const key = pr.kind === 'door' ? inp.label('door') : inp.label('interact');
    const text = `${pr.verb}: ${pr.label}`, w = textWidth(text, 11) + 26;
    const bob = Math.round(Math.sin(this.t * 6) * 1.5);
    rect(u, '#05060f', x - w / 2 - 1, y - 1 + bob, w + 2, 19); rect(u, pr.verb === '잠김' ? '#5a1a2a' : '#1b2450', x - w / 2, y + bob, w, 17);
    keycap(u, key, x - w / 2 + 2, y + 1 + bob);
    drawText(u, text, x - w / 2 + 20, y + 3 + bob, { size: 11, color: '#ffffff' });
    rect(u, '#1b2450', x - 2, y + 17 + bob, 4, 3);
  }
  drawToasts(u) { const y0 = this.dialog ? 152 : 60; this.toasts.forEach((t, i) => { const a = t.t > 2.9 ? (3.4 - t.t) / .5 : 1; u.globalAlpha = clamp(a, 0, 1); const w = textWidth(t.text, 11) + 12; rect(u, 'rgba(5,6,15,.8)', 320 - w / 2, y0 + i * 18, w, 15); drawText(u, t.text, 320, y0 + 2 + i * 18, { size: 11, align: 'c', color: t.col }); u.globalAlpha = 1; }); }
}
export const worldMix = mixHex;
export const worldPrompt = prompt;
export const worldVH = VIEW_H;
