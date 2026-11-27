// 선항 레슬링, chapter one: the champion's ceremony, a foghorn the day after, the invasion exactly three days after the
// first belt (흰상아 and her deckhands walk into the lobby), the match at the pier and the wrecked dome. Each
// function returns a Cutscene script (see Cutscene.js) for WorldScene.playCine.
import { josa } from '../core/util.js';

export function ceremonyCine(W) {
  const d = W.c.d, x = W.player.x;
  return [
    { bars: 1 }, { music: 'title' },
    { title: '챔피언 탄생', sub: `야항 헤비급 챔피언 — ${d.name}`, dur: 2.8 },
    { spawn: 'boss', x: x + 150, face: -1 }, { spawn: 'reporter', x: x - 140, face: 1, with: 1 }, { spawn: 'fankid', x: x - 180, face: 1, stance: 'cheer', with: 1 },
    { walk: 'boss', to: x + 46, speed: 80 },
    { face: 'me', dir: 'boss' },
    { say: [
      { who: 'boss', text: `${josa(d.name, '이/가')} 해냈다! 내가 처음 봤을 때부터 알아봤지. …아마도.`, expr: 'happy' },
      { who: 'boss', text: '이 벨트는 이제 네 거다. 항구 사람들 모두가 너를 본다. 부끄럽지 않게 들고 다녀.' },
      { who: 'reporter', text: '야항 신문 민 기자입니다! 챔피언, 한마디만요!' },
      { prompt: '첫 인터뷰', choice: [
        { label: '"이 항구는 내가 지킨다."', go: [{ who: 'reporter', text: '멋진데요! 1면이에요!', expr: 'happy' }, { act: () => { d.fame += 3; } }] },
        { label: '"아직 시작일 뿐이다."', go: [{ who: 'reporter', text: '겸손한 챔피언이라… 독자들이 좋아하겠네요.' }, { act: () => { d.fame += 2; } }] },
        { label: '"…배고프다."', go: [{ who: 'fankid', text: '챔피언도 배고프대! 순덕 이모네 가요!', expr: 'happy' }, { act: () => { d.fame += 1; } }] },
      ] },
      { who: 'fankid', text: '챔피언이다아! 내일 학교에서 다 자랑할 거예요!', expr: 'happy' },
    ] },
    { caption: '그날 밤, 항구 끝 등대 너머로 낯선 배의 불빛이 깜빡였다.', dur: 3 },
    { bars: 0 }, { act: () => { d.flags.ceremony = 1; W.c.save(); } },
  ];
}
export function signalCine(W) {
  const c = W.c, d = c.d;
  return [
    { bars: 1 }, { sfx: 'horn' }, { shake: .25, with: 1 },
    { cam: 1640, dur: 1.8 },
    { caption: '…부우우웅—. 바다 쪽에서 낮은 뱃고동이 길게 울렸다.', dur: 2.8 },
    { say: [
      { who: 'oldman', text: '…저 소리. 등대를 40년 지켰지만 저런 뱃고동은 딱 한 번 들어 봤네.' },
      { who: 'oldman', text: '{y}선항(船港) 레슬링{/}. 배를 타고 다니며 항구의 링을 하나씩 집어삼키는 녀석들이지.' },
      { who: 'me', text: '레슬링 단체가… 배를 타고 온다고요?' },
      { who: 'oldman', text: '챔피언이 생긴 항구만 노린다더군. 벨트를 딴 지 사흘 안에 올 걸세. 단단히 준비하게.' },
    ] },
    { cam: null }, { bars: 0 }, { act: () => { d.ow.heard = 1; c.save(); } },
  ];
}
export function invasionCine(W, onFight) {
  const d = W.c.d;
  return [
    { bars: 1 }, { at: 'lobby', x: 640 }, { music: 'boss' },
    { sfx: 'horn' }, { shake: .7, with: 1 },
    { title: '선항 레슬링', sub: '바다 건너에서 온 침공', dur: 2.6 },
    { sfx: 'door' },
    { spawn: 'owsailor', x: 70, face: 1 }, { spawn: 'whiteivory', x: 40, face: 1, with: 1 },
    { walk: 'owsailor', to: 470, speed: 170 }, { walk: 'whiteivory', to: 420, speed: 105, with: 1 },
    { face: 'me', dir: 'whiteivory' },
    { say: [
      { who: 'owsailor', text: '선항 레슬링이다! 이 항구의 챔피언은 앞으로 나와라!' },
      { who: 'whiteivory', text: `…네가 ${d.name}인가. 사흘 전에 벨트를 감았다던.` },
      { who: 'me', text: '당신들은 누구지?' },
      { who: 'whiteivory', text: '흰상아. 선항 레슬링의 칼날이다. 오늘부터 이 항구는 우리 배의 닻을 받는다.' },
      { who: 'whiteivory', text: '부둣가 특설 링으로 와라. 그 벨트가 진짜인지 보자.', expr: 'fierce' },
    ] },
    { caption: '선원들이 등대 돔 쪽으로 몰려간다. 멀리서 무언가 부서지는 소리가 울렸다.', dur: 2.6 }, { shake: .9, with: 1 },
    { walk: 'whiteivory', to: 60, speed: 120 }, { walk: 'owsailor', to: 40, speed: 150, with: 1 },
    { bars: 0 }, { act: onFight },
  ];
}
export function aftermathCine(W, won) {
  return [
    { bars: 1 }, { at: 'street', x: 1940 }, { cam: 1660, dur: 1.4 },
    { caption: won ? '흰상아는 물러갔다. 하지만 선원들이 휩쓸고 간 등대 돔은…' : '흰상아에게 졌다. 선원들이 휩쓸고 간 등대 돔은…', dur: 2.8 },
    { spawn: 'boss', x: 2060, face: -1 },
    { say: [
      { who: 'boss', text: '돔 지붕이 내려앉았어. 링도 엉망이고… 수리하는 데 한참 걸리겠어.' },
      { who: 'boss', text: '하지만 벨트는 쉬지 않는다! 당분간 타이틀전은 {y}지하 격투장{/}에서 연다. 로비 지하 계단으로 내려가.' },
      { who: 'me', text: won ? '…녀석들, 또 올 겁니다.' : '…다음엔 안 집니다.' },
      { who: 'boss', text: '그래. 바다 건너 놈들한테 이 항구가 만만하지 않다는 걸 보여 줘야지.' },
    ] },
    { title: '등대 돔 파손', sub: '타이틀전은 지하 격투장에서 열린다', dur: 2.6 },
    { cam: null }, { bars: 0 },
  ];
}

// ---- chapter two: the second wave (서도현 teams up), the captain, the retreat, the rebuilt dome
export function secondWaveCine(W, onFight) {
  return [
    { bars: 1 }, { at: 'street', x: 1760 }, { sfx: 'horn' }, { shake: .5, with: 1 },
    { title: '2차 침공', sub: '선항 레슬링이 돌아왔다', dur: 2.4 },
    { spawn: 'whiteivory', x: 1990, face: -1 }, { spawn: 'owsailor', x: 2030, face: -1, with: 1 },
    { walk: 'whiteivory', to: 1880, speed: 90 }, { walk: 'owsailor', to: 1920, speed: 90, with: 1 },
    { face: 'me', dir: 'whiteivory' },
    { say: [
      { who: 'whiteivory', text: '지난번엔 인사만 한 거다. 오늘은 둘이서 간다.' },
      { who: 'owsailor', text: '챔피언 혼자서 둘을 상대할 수 있을까~?' },
    ] },
    { spawn: 'dohyun', x: 1500, face: 1 }, { walk: 'dohyun', to: 1710, speed: 190 },
    { say: [
      { who: 'dohyun', text: '혼자 다 하려고? 이 항구는 내 항구이기도 해.', expr: 'fierce' },
      { who: 'me', text: '…서도현. 너랑 같은 편이 될 줄은 몰랐다.' },
      { who: 'dohyun', text: '착각하지 마. 벨트는 나중에 너한테서 뺏을 거다. 그 전에 바다 건너 놈들한테 뺏기면 곤란하거든.' },
    ] },
    { title: '태그 매치', sub: '챔피언 · 서도현 vs 흰상아 · 선항 선원', dur: 2 },
    { bars: 0 }, { act: onFight },
  ];
}
export function afterSecondCine(W, won) {
  return [
    { bars: 1 }, { at: 'street', x: 1760 },
    { spawn: 'dohyun', x: 1700, face: 1 },
    { say: won ? [
      { who: 'dohyun', text: '…나쁘지 않았어, 챔피언. 우리 둘이면 저 배도 가라앉히겠는데.' },
      { who: 'oldman', text: '아직 끝이 아니야. 저 배의 선장, {y}고동{/}이 직접 내린다는 소문이 돌고 있어.' },
    ] : [
      { who: 'dohyun', text: '쳇… 저 녀석들, 진짜 강하네. 다음엔 안 진다.' },
      { who: 'oldman', text: '선원들이 항구를 휘젓고 다니는군. 이제 선장 {y}고동{/}이 직접 내릴 걸세.' },
    ] },
    { caption: '며칠 뒤, 선장이 배에서 내린다는 소문이 항구에 퍼졌다.', dur: 2.6 },
    { bars: 0 },
  ];
}
export function captainCine(W, onFight, again) {
  if (again) return [
    { bars: 1 }, { at: 'street', x: 1760 }, { sfx: 'horn' },
    { spawn: 'godong', x: 1960, face: -1 },
    { say: [{ who: 'godong', text: '돌아왔군. 닻은 쉽게 뽑히지 않는다. 다시 해 보거라.' }] },
    { bars: 0 }, { act: onFight },
  ];
  return [
    { bars: 1 }, { at: 'street', x: 1760 }, { cam: 1600, dur: 1.4 },
    { sfx: 'horn' }, { shake: .9, with: 1 }, { wait: .8 }, { sfx: 'horn' }, { shake: 1, with: 1 },
    { title: '선장 고동', sub: '선항 레슬링의 주인', dur: 2.8 },
    { spawn: 'owsailor', x: 2060, face: -1 }, { spawn: 'godong', x: 2120, face: -1, with: 1 },
    { walk: 'owsailor', to: 1980, speed: 80 }, { walk: 'godong', to: 1900, speed: 55, with: 1 },
    { face: 'me', dir: 'godong' },
    { say: [
      { who: 'godong', text: '네가 흰상아를 돌려보낸 항구의 챔피언인가.' },
      { who: 'godong', text: '나는 항구를 하나씩 집어삼켰다. 열두 개째에서 처음으로 배가 멈췄지. 여기서.' },
      { who: 'me', text: '이 항구는 당신 배의 닻을 받지 않는다.' },
      { who: 'godong', text: '좋다. 그럼 링에서 증명해라. 내가 지면 뱃머리를 돌리지.', expr: 'fierce' },
    ] },
    { cam: null }, { bars: 0 }, { act: onFight },
  ];
}
export function captainWinsCine(W, again) {
  return [
    { bars: 1 },
    { say: [
      { who: 'godong', text: again ? '…아직이다. 내일 다시 오너라.' : '파도는 언제나 이긴다. 하지만 너는 꽤 버티는군. 내일 다시 오너라.' },
      { who: 'me', text: '…다음엔 반드시.' },
    ] },
    { caption: '선장 고동은 부둣가에 닻을 내린 채 기다린다. (다음 날 다시 도전)', dur: 2.6 },
    { bars: 0 },
  ];
}
export function retreatCine(W) {
  return [
    { bars: 1 }, { at: 'street', x: 1760 }, { sfx: 'horn' },
    { spawn: 'godong', x: 1900, face: -1 }, { spawn: 'whiteivory', x: 1980, face: -1, with: 1 },
    { say: [
      { who: 'godong', text: '…뱃머리를 돌려라. 이 항구는 닻이 걸리지 않는다.' },
      { who: 'whiteivory', text: '기억해 두지. 언젠가 바다 저편에서 다시 만나자, 챔피언.' },
    ] },
    { walk: 'godong', to: 2280, speed: 60 }, { walk: 'whiteivory', to: 2290, speed: 70, with: 1 },
    { title: '선항 레슬링 후퇴', sub: '항구를 지켜 냈다', dur: 2.8 }, { music: 'title' },
    { spawn: 'boss', x: 1600, face: 1 }, { spawn: 'fankid', x: 1560, face: 1, stance: 'cheer', with: 1 },
    { walk: 'boss', to: 1700, speed: 90 },
    { say: [
      { who: 'boss', text: '해냈다, 챔피언! 이제 돔을 다시 세우자. 닷새면 된다! …아마도.', expr: 'happy' },
      { who: 'fankid', text: '챔피언이 바다 괴물을 물리쳤다아!', expr: 'happy' },
    ] },
    { act: () => { W.c.d.fame += 10; W.toast('항구의 영웅! 명성 +10', '#ffd65a'); W.c.save(); } },
    { cam: 1990, dur: 1.6 }, { caption: '그날 밤, 무너진 옛 부두 앞에 표지판 하나가 세워졌다.', dur: 3.2 },
    { act: () => W.toast('부두 표지판이 생겼다 — 등대 돔 오른쪽 끝', '#49d6ff') }, { cam: null },
    { bars: 0 },
  ];
}
export function rebuiltCine(W) {
  const c = W.c;
  return [
    { bars: 1 }, { at: 'street', x: 1940 }, { cam: 1660, dur: 1.2 },
    { title: '등대 돔 재개장', sub: '타이틀전이 다시 등대 아래로', dur: 2.6 },
    { spawn: 'boss', x: 2060, face: -1 }, { spawn: 'oldman', x: 1860, face: 1, with: 1 },
    { say: [
      { who: 'boss', text: '새 지붕, 새 링, 새 조명! 타이틀전은 오늘부터 다시 등대 돔에서 연다!', expr: 'happy' },
      { who: 'oldman', text: '그런데 큰 배가 댈 옛 여객 부두는 오래전에 무너진 채라네. 선항 놈들도 먼바다에 닻을 내리고 작은 배로 건너왔지.' },
      { who: 'oldman', text: '부두를 다시 세우면 바다 건너 항로가 열려. 이 항구의 챔피언이 {y}세계 무대{/}로 나갈 길 말일세. 돔 옆 부두 표지판을 읽어 보게.' },
    ] },
    { act: () => { c.owRebuilt(); c.save(); W.toast('세계로 가는 길 — 등대 돔 오른쪽, 부두 표지판', '#49d6ff'); } },
    { cam: null }, { bars: 0 },
  ];
}
