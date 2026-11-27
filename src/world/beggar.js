// 골목 영감: an old man by the alley asks for help every day. A coin or an hour of hauling his scrap adds up; after
// enough of it he takes you to the old gym at the end of the alley and teaches what he still remembers, one lesson
// a day, the last one his own finisher.
import { MOVES, FINISHERS } from '../data/moves.js';
import { fmtMoney, pick } from '../core/util.js';
import { learnedText } from './CareerManager.js';

export const BEGGAR = {
  coin: 5000,                      // a coin: +1 help
  scrap: { S: 3, A: 3, B: 2, C: 1 },   // hauling scrap, by grade
  invite: 5,                       // help that opens the alley
  lessons: [5, 9, 13, 18],         // help needed for each lesson
  pool: ['airplane', 'piledriver', 'giantSwing', 'chokeslam', 'headDrop', 'gutBuster', 'bellyToBelly', 'backbreaker'],
};
export const beggarState = d => d.beggar || (d.beggar = { help: 0, day: -1, askDay: -1, lessons: 0, lessonDay: -1, met: 0 });
// what the next lesson teaches: { move } | { fin } | { skip } | null when he has taught everything
export function nextLesson(d) {
  const B = beggarState(d), i = B.lessons;
  if (i >= BEGGAR.lessons.length) return null;
  if (i === 0) return { move: 'smallPackage' };
  if (i === BEGGAR.lessons.length - 1) return { fin: 'blackwave' };
  const id = BEGGAR.pool.find(m => MOVES[m] && !d.known.includes(m));
  return id ? { move: id } : { skip: 1 };
}
export const lessonReady = d => { const B = beggarState(d); return !!d.flags.hideout && B.lessons < BEGGAR.lessons.length && B.help >= BEGGAR.lessons[B.lessons] && B.lessonDay !== d.day; };
const S = (text, o = {}) => Object.assign({ who: 'beggar', text }, o);

export function inviteSteps(c, W) {
  const d = c.d;
  return [
    S('…자네, 매일같이 이 늙은이를 챙기는구먼. 요즘 젊은이 같지 않아.'),
    S('그 손목, 그 어깨… 레슬러지? 걸음걸이만 봐도 알아. 나도 한때는 링 위에 서 봤으니.'),
    S('따라오게. 이 골목 끝에 내 낡은 도장이 있네. 보여 줄 게 있어.'),
    { act: () => { d.flags.hideout = 1; c.save(); W.toast('"좁은 골목"이 열렸다 — 부둣길 돛대 상회 옆', '#ffd65a'); W.game.audio.sfx('good'); } },
  ];
}
// thanks for today's help, and the invitation once it adds up
export function thanksSteps(c, W, n) {
  const d = c.d, B = beggarState(d);
  const out = [S(n >= 3 ? '허허, 이렇게 반듯하게 쌓다니. 자네 손은 레슬러 손이구먼.' : n >= 2 ? '고맙네. 덕분에 허리가 좀 펴지겠어.' : pick(['고맙네… 오늘은 따뜻한 국밥 한 그릇 먹겠구먼.', '허허, 이 은혜는 잊지 않겠네.']))];
  if (!d.flags.hideout && B.help >= BEGGAR.invite) out.push(...inviteSteps(c, W));
  else if (d.flags.hideout && lessonReady(d)) out.push(S('…오늘은 가르칠 게 있네. 도장 안쪽으로 오게.'));
  return out;
}
const TIPS = {
  smallPackage: '잡자마자 다리를 걸고 몸을 말아 넣는 거야. 핀이 있는 경기라면 기운이 남은 놈도 덜컥 어깨가 닿지.',
  airplane: '어깨에 메고 돌리면 눈이 핑핑 돌지. 기절 게이지가 쭉 빠져.',
  piledriver: '거꾸로 세워서 그대로 주저앉는다. 함부로 쓰지 말게. 아픈 기술이야.',
  giantSwing: '발목을 꽉 쥐고 돌리게. 옆에 있는 놈도 휩쓸려 넘어진다네.',
  chokeslam: '목을 쥐고 들어 올려 내리꽂는 거야. 손아귀 힘이 반이지.',
  headDrop: '머리부터 떨어뜨리는 기술이네. 짧고 굵게.',
  gutBuster: '무릎 위로 배를 떨어뜨리게. 숨이 턱 막힐 거야.',
  bellyToBelly: '배를 맞댄 채 뒤로 넘기는 거야. 허리를 써, 허리를.',
  backbreaker: '무릎에 등을 꽂는 거지. 등이 아픈 놈은 오래 못 버텨.',
};

function lessonSteps(c, W) {
  const d = c.d, B = beggarState(d), L = nextLesson(d);
  B.lessonDay = d.day;
  const done = () => { B.lessons++; c.save(); };
  if (!L || L.skip) { done(); return [S('오늘은 몸 풀기만 하세. 자네가 이미 아는 걸 또 가르칠 순 없지.')]; }
  if (L.move) {
    const mv = MOVES[L.move];
    const intro = B.lessons === 0
      ? [S('여기가 내 도장이네. 30년 전엔 밤마다 함성이 끊이지 않았지.'), S('사람들은 날 {y}"검은 파도"{/}라고 불렀어. …이제는 아무도 기억 못 하지만.'), S(`첫 번째로 가르칠 기술은 '${mv.name}'. 늙은이 기술이지만, 이걸로 챔피언도 눕혀 봤다네.`)]
      : [S(pick(['몸은 늙어도 기술은 안 늙지. 잘 보게.', '오늘은 이걸 가르쳐 주지. 한 번만 보여 줄 거야.', '자네 요즘 경기 봤네. 이게 있으면 더 낫겠더군.'])), S(`'${mv.name}'.`)];
    return [...intro, { act: () => { c.learn(L.move); done(); W.toast(learnedText(L.move), '#6be38a'); W.game.audio.sfx('good'); } }, S(TIPS[L.move] || '몸으로 익히게. 머리로는 안 돼.')];
  }
  const F = FINISHERS[L.fin];
  return [
    S('…이제 가르칠 게 하나 남았군.'),
    S(`'${F.name}'. 내가 마지막 타이틀을 지킨 기술일세. 어깨에 메고, 머리 위로 들어 올리고, 돌려서 내리꽂는다.`),
    { act: () => { c.learnFinisher(L.fin); done(); W.toast(`새 피니셔 습득: ${F.name} (Tab → 기술에서 F로 바꾸기)`, '#ffd65a'); W.game.audio.sfx('good'); } },
    S('파도는 검을수록 깊지. 쓰든 말든 자네 마음이야. 다만 쓸 거라면, 부끄럽지 않게 쓰게.'),
  ];
}

export function beggarTalk(c, W) {
  const d = c.d, B = beggarState(d), inGym = W.loc === 'hideout';
  if (inGym && lessonReady(d)) return lessonSteps(c, W);
  const first = !B.met; B.met = 1;
  if (B.day === d.day) {
    if (inGym && B.lessons >= BEGGAR.lessons.length) return [S(pick(['이 도장도 자네 덕에 다시 숨을 쉬는구먼.', '챔피언 벨트? 저 유리장 안에 있는 건 그냥 추억일세.', '파도는 부서져도 다시 밀려오지. 자네도 그렇게 하게.']))];
    return [S(pick(['고맙네. 오늘은 이걸로 충분해. 내일 또 보세.', '자네 덕에 오늘은 따뜻하게 자겠구먼.', '허허, 젊은 사람 손이 빠르구먼.']))];
  }
  const ask = inGym
    ? S(pick(['오늘도 좀 거들어 주겠나? 늙으니 고물 하나 드는 것도 일이야.', '배운 건 몸에 익혀야지. 그 전에… 오늘 저녁거리가 좀 걱정이구먼.']))
    : S(first ? '…젊은이. 이 늙은이 좀 도와주게. 많이는 말고… 조금만.' : pick(['…또 왔구먼. 오늘도 좀 도와주겠나?', '도와주게… 오늘은 바람이 차구먼.', '젊은이, 늙은이 부탁 하나만 들어주게.']));
  const coin = [
    { if: () => c.canPay(BEGGAR.coin), then: [
      { act: () => { c.pay(BEGGAR.coin); B.help += 1; B.day = d.day; c.save(); W.game.audio.sfx('buy'); } },
      // built when it plays: the help count has just changed
      { if: () => !d.flags.hideout && B.help >= BEGGAR.invite, then: [S('고맙네… 이 은혜는 잊지 않겠네.'), ...inviteSteps(c, W)], else: [S(pick(['고맙네… 오늘은 따뜻한 국밥 한 그릇 먹겠구먼.', '허허, 이 은혜는 잊지 않겠네.']))] },
      { if: () => lessonReady(d), then: [S('…그리고 오늘은 가르칠 게 있네. 도장 안쪽으로 오게.')] },
    ], else: [S('…주머니가 비었구먼. 마음만 받겠네.')] },
  ];
  return [ask, { choice: [
    { label: `동전 건네기 (${fmtMoney(BEGGAR.coin)})`, go: coin },
    { label: '고물 정리 도와주기 (시간 1칸)', act: () => W.startTraining('scrap') },
    { label: '그냥 지나간다', go: [S(pick(['…그래, 다들 바쁘지.', '허허, 괜찮네. 내일도 여기 있을 테니.']))] },
  ] }];
}
