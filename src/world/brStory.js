// BLACK ROPE's scenes: the first meeting in the lobby (A NEW RIVAL), the lobby raid (LOBBY BRAWL) with what follows
// a win or a loss, and the unlikely alliance when 선항 레슬링 comes back (accept or refuse; the story goes on either way).
import { CHARACTERS } from '../data/characters.js';
import { BR, brMeet, brState, brRival } from './blackRope.js';

const N = id => CHARACTERS[id].name;
const surprised = W => () => { for (const a of W.npcs) if (!a.cine && a !== W.player) { a.expr = 'hurt'; a.exprT = 2.2; a.face = -1; } };

export function meetCine(W) {
  const c = W.c, d = c.d, x = W.player.x;
  return [
    { bars: 1 }, { sfx: 'door' }, { music: 'rival' },
    { cam: 0, dur: 1 },
    { spawn: 'brPower', x: 40, face: 1 }, { spawn: 'brSpeed', x: 20, face: 1, with: 1 }, { spawn: 'brTech', x: 0, face: 1, with: 1 }, { spawn: 'brShow', x: -20, face: 1, with: 1 }, { spawn: 'brLeader', x: -40, face: 1, with: 1 },
    { walk: 'brPower', to: 230, speed: 110 }, { caption: `${BR.role.brPower} — ${N('brPower')}`, dur: 1.6, with: 1 },
    { walk: 'brSpeed', to: 270, speed: 190 }, { caption: `${BR.role.brSpeed} — ${N('brSpeed')}`, dur: 1.6, with: 1 },
    { walk: 'brTech', to: 190, speed: 110 }, { caption: `${BR.role.brTech} — ${N('brTech')}`, dur: 1.6, with: 1 },
    { walk: 'brShow', to: 150, speed: 140 }, { caption: `${BR.role.brShow} — ${N('brShow')}`, dur: 1.6, with: 1 },
    { walk: 'brLeader', to: Math.max(320, x - 70), speed: 100 }, { cam: Math.max(0, x - 360), dur: 1.2, with: 1 },
    { face: 'me', dir: 'brLeader' },
    { say: [
      { who: 'brLeader', text: '네가 요즘 소문난 신인이냐?' },
      { who: 'brLeader', text: '몇 경기 이겼다고 벌써 스타라도 된 기분인가 보군.' },
      { who: 'brShow', text: '형님, 표정 봐요! 우리 이름 처음 듣는 얼굴인데요?', expr: 'happy' },
      { who: 'brLeader', text: `${BR.name}. 잘 기억해 둬. 이 도시의 챔피언은 내가 될 거니까.`, expr: 'fierce' },
    ] },
    { title: 'NEW RIVAL', sub: `${BR.name} — 리더 ${N('brLeader')}`, dur: 2.4 },
    { walk: 'brLeader', to: -60, speed: 120 }, { walk: 'brPower', to: -60, speed: 120, with: 1 }, { walk: 'brSpeed', to: -60, speed: 150, with: 1 }, { walk: 'brTech', to: -60, speed: 120, with: 1 }, { walk: 'brShow', to: -60, speed: 130, with: 1 },
    { act: () => { brMeet(c); c.save(); W.toast(`라이벌 관계 생성: ${BR.name} (Tab → 커리어에서 전적 확인)`, '#b066d8'); } },
    { cam: null }, { bars: 0 }, { music: 'lobby' },
  ];
}
export function raidCine(W, lineup, onFight) {
  const x = W.player.x, [a, b] = lineup.who;
  return [
    { bars: 1 }, { sfx: 'door' }, { shake: .6, with: 1 }, { music: 'rival' },
    { cam: 0, dur: .8 },
    { spawn: a, x: -30, face: 1 }, { spawn: b, x: -60, face: 1, with: 1 },
    { walk: a, to: Math.max(300, x - 80), speed: 160 }, { walk: b, to: Math.max(250, x - 130), speed: 160, with: 1 }, { cam: Math.max(0, x - 360), dur: 1, with: 1 },
    { act: surprised(W) }, { face: 'me', dir: a },
    { say: [
      { who: a, text: '연습은 잘하고 있나?' },
      { who: a, text: '오늘은 우리가 특별한 경기를 준비했거든!', expr: 'fierce' },
      { who: 'boss', text: '이봐! 여기는 경기장이 아니라고!' },
      { who: a, text: '지금부터는 경기장이지.' },
    ] },
    { shake: .8 }, { sfx: 'warn', with: 1 },
    { title: 'LOBBY BRAWL', sub: '로비를 지켜라!', dur: 2 },
    { bars: 0 }, { act: onFight },
  ];
}
export function raidWonCine(W, out) {
  return [
    { bars: 1 },
    { spawn: 'brLeader', x: W.player.x + 80, face: -1 },
    { say: [
      { who: 'brLeader', text: '…이번에는 네가 운이 좋았던 거야.' },
      { who: 'brLeader', text: '다음에는 이렇게 끝나지 않을 거다. 링 위에서 다시 보자.', expr: 'fierce' },
    ] },
    { walk: 'brLeader', to: -60, speed: 160 },
    { say: [
      { who: 'boss', text: '휴… 화분은 또 깨졌군. 그래도 로비는 지켰다! 수고했어.' },
      { who: 'janitor', text: '잘했어, 신인! 청소는 내 몫이지만… 오늘은 기분 좋게 하지.', expr: 'happy' },
    ] },
    { caption: `로비를 지켰다! 상금 +${out.money.toLocaleString('ko-KR')}원 · 명성 +${out.fame} · 리더와의 재대결 해금`, dur: 2.8 },
    { bars: 0 },
  ];
}
export function raidLostCine(W, out) {
  return [
    { bars: 1 },
    { spawn: 'brLeader', x: W.player.x + 80, face: -1 },
    { say: [
      { who: 'brLeader', text: 'BLACK ROPE의 로비 공연은 여기까지! 관람료는 챙겨 간다.', expr: 'happy' },
      { who: 'brShow', text: '다음 공연도 기대해 달라고~!' },
    ] },
    { walk: 'brLeader', to: -60, speed: 150 },
    { say: [
      { who: 'boss', text: '괜찮아. 우선 여기를 정리하고 다시 시작하자고.' },
      { who: 'janitor', text: '훈련장 문짝이 떨어져 나갔어. 정리가 끝날 때까지는 못 쓴다. 같이 치우든가, 수리비를 내든가…' },
    ] },
    { caption: `${out.loss ? `${out.loss.toLocaleString('ko-KR')}원을 빼앗겼다. ` : ''}로비가 엉망이다 — 김 반장에게 말하면 정리할 수 있다 (재대결 해금)`, dur: 3 },
    { bars: 0 },
  ];
}
// 선항 레슬링's second wave with BLACK ROPE around: their leader asks for a truce (the choice sets the partner)
export function allianceCine(W, o, onFight) {
  const c = W.c, d = c.d, B = brState(d);
  return [
    { bars: 1 }, { at: 'lobby', x: 640 }, { music: 'rival' },
    { spawn: 'brLeader', x: 60, face: 1 }, { spawn: 'brPower', x: 20, face: 1, with: 1 },
    { walk: 'brLeader', to: 560, speed: 90 }, { walk: 'brPower', to: 500, speed: 90, with: 1 },
    { face: 'me', dir: 'brLeader' },
    { say: [
      { who: 'brLeader', text: '착각하지 마. 네가 좋아서 찾아온 건 아니니까.' },
      { who: 'brLeader', text: '저 배 녀석들이 우리가 경기하던 곳까지 엉망으로 만들어 놨어.' },
      { who: 'brLeader', text: '이번 한 번만 같은 팀이다.' },
      { prompt: '협력 제안', choice: [
        { label: '"좋아. 이번 한 번만이다."', go: [{ who: 'brLeader', text: '발 맞춰라. 내 매듭에 걸리면 같은 편이라도 안 봐준다.', expr: 'fierce' }, { act: () => { B.allied = true; o.partner = 'brLeader'; const R = brRival(d, 'brLeader'); R.affinity += 10; R.hostility = Math.max(0, R.hostility - 10); } }] },
        { label: '"내 싸움은 내가 한다."', go: [{ who: 'brLeader', text: '흥, 그럴 줄 알았다. 우리는 우리 방식대로 저 배에 도전하겠다.' }, { act: () => { B.allied = false; o.partner = 'dohyun'; } }] },
      ] },
    ] },
    { title: 'RIVALS UNITED', sub: `챔피언 · ${N('brLeader')} vs 쇄파 · 선항 선원`, dur: 2.2, when: () => B.allied === true },
    { walk: 'brLeader', to: -60, speed: 150, when: () => B.allied === false }, { walk: 'brPower', to: -60, speed: 150, with: 1, when: () => B.allied === false },
    { say: [{ who: 'dohyun', text: '혼자 다 하려고? 쳇, 그럼 내가 끼어 주지. 이 항구는 내 항구이기도 하니까.' }], when: () => B.allied === false },
    { bars: 0 }, { act: onFight },
  ];
}
