// 백 관장's basics: a practice match in the gym ring with one goal at a time. Each step listens to match events
// (or polls the state) and moves on when the player has actually done the thing. Esc offers skipping.
import { VIEW_W, pick } from '../core/util.js';
import { drawText, wrapText } from '../render/pixelfont.js';
import { panel, gauge, prompt } from '../render/ui.js';
import { rect } from '../render/painter.js';
import { drawPortrait } from '../render/head.js';
import { UI } from '../render/palette.js';
import { LOOKS } from '../data/looks.js';
import { BALANCE as B } from '../data/balance.js';

const fresh = v => { v.hp = v.maxHp; v.stun = v.maxStun; };
export const TUTORIAL = [
  { say: '좋아, 링에 올라왔군. 먼저 몸부터 풀자. {y}A{/}·{y}D{/}로 좌우로 움직여 봐.', goal: '좌우로 움직이기', need: 1.5,
    check: (m, h, v, T, dt) => (Math.abs(h.vx) > 40 ? dt : 0) },
  { say: '같은 방향을 {y}두 번 빠르게{/} 누르고 그대로 꾹 누르고 있으면 {y}돌진{/}이다. 돌진해서 로프에 몸을 튕겨 봐!', goal: '돌진해서 로프에 튕기기', need: 1,
    on: { rope: (e, h) => e.f === h } },
  { say: '{y}W{/}는 점프다. 두 번 뛰어 봐. 링 바닥이 꺼지진 않으니 걱정 말고.', goal: '점프 두 번', need: 2,
    on: { jump: (e, h) => e.f === h } },
  { say: '이제 상대다. 도현아, 신입 상대 좀 해 줘라! …{y}J{/}를 연타하면 3단 콤보야. 3연타를 끝까지 맞혀 봐.', goal: 'J 3연타 맞히기', need: 1,
    setup: (m, h, v) => { v.ai.behavior = 'idle'; fresh(v); m.practice.stunLock = false; },
    on: { hit: (e, h) => e.a === h && e.combo >= 3 }, check: (m, h, v) => { if (v.stun < v.maxStun * .4) v.stun = v.maxStun; return 0; } },
  { say: '이번엔 도현이가 때린다. {y}S{/}를 누르고 막아. 맞는 바로 그 순간에 누르면 {y}패리{/}야. 상대가 휘청하지!', goal: '막기 2번 (패리는 2번으로 쳐 준다)', need: 2,
    setup: (m, h, v) => { v.ai.behavior = 'attack'; v.ctrl = 'dummy'; fresh(v); },
    on: { block: (e, h) => (e.v === h ? 1 : 0), parry: (e, h) => (e.v === h ? 2 : 0) } },
  { say: '{y}L{/}은 회피다. 공격이 날아오는 순간 누르면 피하면서 그대로 던져 버리지. 한 번 피해 봐.', goal: '공격 피하기 또는 반격', need: 1,
    on: { dodge: (e, h) => e.f === h, counter: (e, h) => e.f === h } },
  { say: '계속 때려서 노란 {y}기절 저항{/} 줄을 다 깎으면 상대가 쓰러진다. 쓰러진 상대에게 다가가 {y}K{/}로 잡아!', goal: '쓰러뜨리고 K로 잡기', need: 1,
    setup: (m, h, v) => { v.ai.behavior = 'idle'; fresh(v); v.stun = v.maxStun * .35; },
    on: { grab: (e, h) => e.a === h } },
  { say: '잡은 다음 {y}K{/}만 누르면 기본기, {y}→+K{/}·{y}←+K{/}·{y}W+K{/}·{y}S+K{/}마다 기술이 다르다. 레슬링 기술을 두 번 걸어 봐.', goal: '레슬링 기술 2번', need: 2,
    setup: (m, h, v) => { m.practice.stunLock = true; },
    on: { moveStart: (e, h) => e.a === h && !e.fin } },
  { say: '쓰러진 상대 옆에서 {y}S{/}를 누르면 {y}핀폴{/}이다. 심판이 바닥을 두 번 칠 때까지 눌러 봐.', goal: '핀폴 카운트 2', need: 1,
    setup: (m, h, v) => { m.practice.stunLock = true; },
    on: { count: (e, h, v, m) => { if (e.pin && e.a === h && e.n >= 2) { m.breakPin('let'); return true; } return false; } } },
  { say: '이제 하늘을 날아 보자. 로프 끝 코너 앞에서 {y}W{/}로 올라가. 위에서 {y}A·D{/}로 방향을 고르고 {y}J{/}로 다이빙!', goal: '코너에서 다이빙', need: 1,
    setup: (m) => { m.practice.stunLock = true; },
    on: { dive: (e, h) => e.f === h } },
  { say: '돌진하다가 서 있는 상대에게 {y}K{/}! 돌진 기술이다. 게이지가 조금 필요한데, 오늘은 내가 채워 주마.', goal: '돌진 중 K로 돌진 기술', need: 1,
    setup: (m, h, v) => { m.practice.stunLock = false; fresh(v); h.fin = Math.max(h.fin, 40); h.sigCd = 0; },
    check: (m, h) => { if (h.fin < B.dashSigCost) h.fin = 40; return 0; },
    on: { dashSig: (e, h) => e.f === h } },
  { say: '마지막이다. 게이지가 가득 차면 {y}Space{/}로 {y}피니셔{/}! 이번만 공짜로 채워 주지.', goal: '피니셔 쓰기', need: 1,
    setup: (m, h, v) => { h.fin = B.finMax; fresh(v); },
    check: (m, h) => { if (h.fin < B.finMax && !h.finPhase && h.st !== 'FINISHER') h.fin = B.finMax; return 0; },
    on: { finisherStart: (e, h) => e.f === h } },
];
const EVENTS = ['rope', 'jump', 'hit', 'block', 'parry', 'dodge', 'counter', 'grab', 'moveStart', 'count', 'dive', 'dashSig', 'finisherStart'];

export class Tutorial {
  constructor(scene) {
    this.s = scene; this.m = scene.m; this.i = -1; this.n = 0; this.doneT = 0; this.t = 0; this.text = ''; this.finished = false; this.endT = 0;
    for (const k of EVENTS) this.m.on(k, e => this.event(k, e));
    this.begin(0);
  }
  get h() { return this.m.human; }
  get v() { return this.m.fighters.find(f => f !== this.h); }
  get step() { return TUTORIAL[this.i]; }
  begin(i) {
    this.i = i; this.n = 0; this.doneT = 0;
    const st = this.step;
    if (!st) { this.text = '합격이다! 이 정도면 링에 올라도 창피하진 않겠군. 나머지는 실전에서 배워라.'; this.endT = 2.6; this.s.game.audio.sfx('good'); return; }
    this.text = st.say;
    if (st.setup) st.setup(this.m, this.h, this.v, this);
    this.s.game.audio.sfx('ui');
  }
  event(k, e) {
    const st = this.step;
    if (!st || this.doneT > 0 || !st.on || !st.on[k]) return;
    const r = st.on[k](e, this.h, this.v, this.m);
    if (r) this.progress(r === true ? 1 : r);
  }
  progress(k) {
    const st = this.step;
    this.n = Math.min(st.need, this.n + k);
    if (this.n >= st.need) { this.doneT = 1.4; this.text = pick(['좋아! 바로 그거야.', '그렇지! 몸이 기억하는군.', '훌륭해. 다음으로 가자.', '오, 제법인데?']); this.s.game.audio.sfx('good'); }
  }
  skip() { if (this.step) this.begin(this.i + 1); }
  update(dt) {
    this.t += dt;
    if (this.endT > 0) { this.endT -= dt; if (this.endT <= 0 && !this.finished) { this.finished = true; this.s.tutorialDone(true); } return; }
    const st = this.step;
    if (!st) return;
    if (st.check && this.doneT <= 0) { const r = st.check(this.m, this.h, this.v, this, dt); if (r) this.progress(r === true ? 1 : r); }
    if (this.doneT > 0) { this.doneT -= dt; if (this.doneT <= 0) this.begin(this.i + 1); }
  }
  draw(u) {
    const x = 60, y = 62, w = VIEW_W - 120, h = 62, st = this.step;
    panel(u, x, y, w, h, { accent: '#ff8a2b', bg: '#0e1330', alpha: .94 });
    rect(u, '#05060f', x + 6, y + 6, 50, 50); rect(u, '#1b2450', x + 7, y + 7, 48, 48);
    drawPortrait(u, LOOKS.trainer, this.doneT > 0 || this.endT > 0 ? 'happy' : 'neutral', x + 7, y + 7, 48, { px: 2, dy: 6 });
    drawText(u, '백 관장', x + 64, y + 4, { size: 11, color: '#ff8a2b' });
    drawText(u, `기초 훈련 ${Math.min(this.i + 1, TUTORIAL.length)}/${TUTORIAL.length}`, x + w - 8, y + 4, { size: 11, align: 'r', color: UI.dim });
    wrapText(this.text, w - 76, 11).slice(0, 2).forEach((l, k) => drawText(u, l, x + 64, y + 18 + k * 14, { size: 11, color: '#eef2ff' }));
    if (st && this.doneT <= 0) {
      drawText(u, '목표: ' + st.goal, x + 64, y + 47, { size: 11, color: '#ffd65a' });
      gauge(u, x + w - 128, y + 50, 120, 5, this.n / st.need, 'fin', { col: '#6be38a' });
    }
    drawText(u, `${this.s.game.input.label('pause')} 건너뛰기`, x + w - 8, y + h + 3, { size: 11, align: 'r', color: UI.faint, outline: '#05060f' });
  }
}

// Asked once right after a new wrestler is made: take the basics or skip them.
export class TutorialOffer {
  constructor(game, onYes, onNo) { this.game = game; this.onYes = onYes; this.onNo = onNo; this.sel = 0; this.t = 0; game.audio.music('gym'); }
  update(dt) {
    this.t += dt;
    const inp = this.game.input, A = this.game.audio;
    if (inp.pressed('up') || inp.pressed('down') || inp.pressed('left') || inp.pressed('right')) { this.sel ^= 1; A.sfx('ui'); }
    if (this.t > .3 && inp.menuPressed('confirm')) { A.sfx('ok'); (this.sel === 0 ? this.onYes : this.onNo)(); }
    else if (this.t > .3 && inp.menuPressed('cancel')) { A.sfx('back'); this.onNo(); }
  }
  draw(w, u) {
    rect(w, '#0b0f22', 0, 0, VIEW_W, 360);
    u.clearRect(0, 0, VIEW_W, 360);
    panel(u, 110, 70, 420, 220, { accent: '#ff8a2b' });
    rect(u, '#05060f', 128, 92, 82, 82); rect(u, '#1b2450', 129, 93, 80, 80);
    drawPortrait(u, LOOKS.trainer, 'neutral', 129, 93, 80, { px: 3, dy: 10 });
    drawText(u, '백 관장', 222, 92, { color: '#ff8a2b', bold: true });
    wrapText('링에 오르기 전에 기초부터 배우고 가라. 이동, 공격, 막기, 잡기, 기술, 핀폴, 다이빙, 피니셔까지. 5분이면 된다.', 290, 11).forEach((l, i) => drawText(u, l, 222, 114 + i * 15, { size: 11, color: '#eef2ff' }));
    ['기초 훈련 받기 (추천)', '건너뛰기 (훈련장 관장에게 나중에 받을 수 있다)'].forEach((t, i) => { const on = this.sel === i, y = 200 + i * 26; rect(u, on ? '#3a2a1a' : '#141a36', 140, y, 360, 22); if (on) rect(u, '#ff8a2b', 140, y, 2, 22); drawText(u, (on ? '▶ ' : '  ') + t, 150, y + 5, { size: 11, color: on ? '#ffffff' : UI.dim }); });
    prompt(u, ['↑↓'], '고르기', 250, 262, {}); prompt(u, ['Enter'], '결정', 330, 262, {});
  }
}
