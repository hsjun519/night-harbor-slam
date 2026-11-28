// THE BIRTH OF A NEW WRESTLER: a bell and a roaring crowd in the dark; a champion raising a belt in a great hall turns
// out to be on the television in 돛대 상회's window; a flyer on the glass; the walk down the harbour street to the gym;
// the boss asks why. The answer is kept (d.motive) for his lines, the ceremony and the ending, and changes nothing else.
// Also the boss's own story, told when asked.
import { josa } from '../core/util.js';

export const MOTIVES = [
  { id: 'fame', label: '유명한 레슬러가 되고 싶습니다.', boss: '이름을 알리고 싶다라… 좋아. 이 항구가 자네 이름을 외치게 만들어 보자고.', echo: '유명해지고 싶다던' },
  { id: 'money', label: '돈을 많이 벌고 싶습니다.', boss: '하하, 솔직해서 좋군! 링은 정직하네. 이기면 벌고, 지면 배우지.', echo: '돈을 벌고 싶다던' },
  { id: 'strong', label: '누구보다 강해지고 싶습니다.', boss: '강해지고 싶다… 그 말은 매일 아침 다시 해야 하는 말이야. 각오는 됐겠지?', echo: '누구보다 강해지고 싶다던' },
  { id: 'love', label: '그냥 레슬링이 좋습니다.', boss: '…그거면 충분하네. 레슬링을 좋아하는 놈이 결국 끝까지 남더군.', echo: '그냥 레슬링이 좋다던' },
  { id: 'unsure', label: '아직 잘 모르겠습니다.', boss: '모르는 게 당연하지. 답은 링 위에서 찾는 거야. 나도 아직 찾는 중이라네.', echo: '아직 모르겠다던' },
];
export const motiveOf = d => MOTIVES.find(m => m.id === d.motive) || null;
export const CATCHPHRASE = '자, 오늘도 멋진 경기 한 번 만들어 보자고!';
export function prologueCine(W) {
  const d = W.c.d;
  return [
    { bars: 1 }, { dark: 1 }, { music: 'title' },
    { sfx: 'crowdBoom' }, { caption: '…와아아아아!', dur: 1.6 }, { sfx: 'bell3' }, { wait: .5 },
    { title: 'THE BIRTH OF A NEW WRESTLER', sub: '새로운 레슬러의 탄생', dur: 2.8 },
    { at: 'street', x: 196 }, { fx: { tv: 1 } }, { cam: 150, dur: .01 }, { dark: 0 },
    { caption: '거대한 경기장, 쏟아지는 조명. 챔피언이 벨트를 높이 들어 올린다.', dur: 2.6 },
    { caption: '…돛대 상회 진열장 안, 작은 텔레비전 속 이야기였다.', dur: 2.6 },
    { fx: { flyer: 1 } },
    { caption: '유리창에 붙은 전단지 한 장. 「신인 레슬러 모집 — 경력 무관. 신인 환영.」', dur: 3 },
    { caption: '「누구에게나 첫 번째 경기는 있다.」', dur: 2.6 },
    { fx: { tv: 0, flyer: 0 } }, { music: 'street' }, { cam: null },
    { walk: 'me', to: 700, speed: 72 },
    { caption: '작은 가방 하나를 메고, 항구 끝 체육관으로.', dur: 2.4, with: 1 },
    { at: 'lobby', x: 170 },
    { spawn: 'boss', x: 262, face: -1 },
    { face: 'me', dir: 'boss' },
    { say: [
      { who: 'boss', text: '전단지 보고 왔나? 반갑네. 이 체육관 사장, 구만석일세.', expr: 'happy' },
      { who: 'boss', text: '그래, 자네는 왜 레슬러가 되고 싶은 건가?' },
      { prompt: '왜 레슬러가 되고 싶은가', choice: MOTIVES.map(M => ({ label: M.label, go: [{ act: () => { d.motive = M.id; W.c.save(); } }, { who: 'boss', text: M.boss }] })) },
      { who: 'boss', text: '좋아! 그럼 일단 링에 올라가 보라고!', expr: 'happy' },
    ] },
    { bars: 0 }, { act: () => { d.flags.prologue = 1; W.c.save(); } },
  ];
}
// "사장님 이야기": why the gym exists, the empty seats, the bills, 등화
export function bossStory(c) {
  const d = c.d, Y = d.yahang || {}, M = motiveOf(d);
  const S = text => ({ who: 'boss', text });
  return [
    S('나? 이 항구가 레슬링으로 북적이던 시절부터 경기를 잡아 왔지. 그땐 세계 각지에서 선수들이 배를 타고 왔어. 부두가 관중으로 꽉 찼지.'),
    S('재능은 있는데 이름이 없어서 링에 못 서는 녀석들을 많이 봤네. 그래서 이 체육관을 열었어. 누구든 실력만 있으면 증명할 수 있게.'),
    S('요즘은… 관중석이 좀 비었지. 사장실엔 운영비 서류만 쌓여 가고. 하지만 챔피언이 하나 나오면 사람들은 다시 올 거야.'),
    S(Y.king ? '등화 녀석, 결국 자네가 가면을 벗겼다며? 고집은 여전하더군. …고맙네.' : '등화라는 챔피언이 있었네. 내가 경기를 잡아 주던 녀석이지. 12년 전 벨트를 돌려주고 사라졌어. 어딘가에서 아직 레슬링을 하고 있을 거야.'),
    ...(M ? [S(`처음 왔을 때 ${M.echo} 자네 대답, 아직 기억하네. 그 마음 잊지 말게.`)] : []),
    S(CATCHPHRASE),
  ];
}
// the boss explains the harbour championship and its two tickets (and opens the cellar stairs)
export function championshipTalk(c) {
  const d = c.d;
  return [
    { who: 'boss', text: '항구 챔피언 벨트는 12년째 주인이 없어. 등화라는 챔피언이 반납한 뒤로 말이야. 그래서 다시 {y}항구 챔피언십{/}을 열기로 했네.' },
    { who: 'boss', text: '출전권을 얻는 길은 둘이야. 공식 리그에서 {y}2위 안에 들고 명성 45{/}를 넘기면 내가 예선을 잡아 주지. 이기면 출전권이야.' },
    { who: 'boss', text: '아니면 로비 끝 {y}지하 계단{/} 아래, {v}야항 레슬링{/}에서 이름을 알리는 방법도 있네. 거기 왕, {v}안개왕{/}을 꺾으면 야항 대표로 나갈 수 있어.' },
    { who: 'boss', text: '야항은 공식 무대가 외면한 레슬러들이 세운 곳이야. 우리 연맹 소속도, 누구 밑도 아니지. 거기선 거기 규칙을 따르게.' },
    { act: () => { d.flags.basementKnown = 1; d.flags.champTalk = 1; c.save(); } },
  ];
}
void josa;
