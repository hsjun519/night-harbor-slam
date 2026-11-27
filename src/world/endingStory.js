// The last chapter's cutscenes (Cutscene.js scripts for WorldScene.playCine): the rebuilt pier (A NEW WAVE), 구만석
// 사장's invitation to the world, and the last scene of each ending. Every ending scene ends on black; WorldScene
// then hands over to THE FINAL BELL (scenes/EndingScene.js).
import { josa } from '../core/util.js';
import { HARBOR, harborRebuild } from './harbor.js';
import { ENDINGS } from './endings.js';

const END_X = HARBOR.end;
// the friends who come to the pier: whoever this career really knows
function wellWishers(d) {
  const out = [{ id: 'fankid', stance: 'cheer' }, { id: 'auntie', stance: 'cheer' }, { id: 'trainer', stance: 'arms' }];
  const r = d.h2h && d.h2h.dohyun;
  if (r && (r.w || 0) + (r.l || 0) > 0) out.push({ id: 'dohyun', stance: 'arms' });
  if (d.flags && d.flags.hideout) out.push({ id: 'beggar', stance: 'elder' });
  if (d.ow && d.ow.state !== 'LOCKED') out.push({ id: 'oldman', stance: 'elder' });
  return out.slice(0, 5);
}
// CUTSCENE 23 — A NEW WAVE: the fund is full, the pier is rebuilt. A sunset, the pier's end, the belt, a new wave,
// ships under other flags on the horizon; two lines, the title, and the route to the world opens.
export function newWaveCine(W) {
  const c = W.c, d = c.d;
  return [
    { bars: 1 }, { act: () => { harborRebuild(d); c.save(); } },
    { at: 'street', x: 2380 }, { remove: 'oldman' }, { sky: 1 }, { music: 'wave' }, { cam: 1180, dur: .01 },
    { caption: '새 널빤지, 새 조명, 바닷바람에 흔들리는 깃발.', dur: 3.2 }, { cam: 1700, dur: 4.2, with: 1 },
    { caption: '다시 문을 연 가게들 사이로, 사람들이 천천히 걷는다.', dur: 3 }, { cam: 2140, dur: 4, with: 1 },
    { walk: 'me', to: END_X - 30, speed: 64 },
    { face: 'me', dir: 1 }, { sfx: 'gull' },
    { wait: 1.6 },
    { fx: { belt: 1 } }, { wait: 2.4 },
    { fx: { belt: 0, waves: 1 } }, { sfx: 'wave' }, { shake: .15, with: 1 }, { wait: 1.8 },
    { fx: { ships: 1 } }, { sfx: 'wave' }, { wait: 2.6 },
    { caption: '한때 이 항구는 새로운 적들이 찾아오는 곳이었다.', dur: 3.6 }, { wait: 1.6 },
    { caption: '이제는 새로운 가능성이 찾아오는 곳이 되었다.', dur: 3.6 }, { wait: 1.6 },
    { title: 'A NEW WAVE', sub: '새로운 파도', dur: 3.4 },
    { dark: .85 }, { title: '세계로 가는 항로 개통', sub: `명성 ${HARBOR.fame}이 되면 구만석 사장과 세계 무대로 떠날 수 있다`, dur: 3.6 },
    { act: () => { W.toast(d.fame >= HARBOR.fame ? '세계로 가는 배가 들어온다 — 부두 끝으로' : `부두 재건 완료! 명성 ${d.fame} / ${HARBOR.fame}`, '#49d6ff'); c.save(); } },
    { dark: 0 }, { fx: { waves: 0, ships: 0 } }, { sky: null }, { cam: null }, { bars: 0 },
  ];
}
// 구만석 사장 has news: an invitation from across the sea, a ship at the new pier. He is coming too.
export function worldCallCine(W) {
  const c = W.c, d = c.d, x = W.player.x;
  return [
    { bars: 1 }, { sfx: 'horn' },
    { spawn: 'boss', x: x - 170, face: 1 }, { walk: 'boss', to: x - 46, speed: 120 },
    { face: 'me', dir: 'boss' },
    { say: [
      { who: 'boss', text: `${josa(d.name, '아/야')}! 찾았다! 숨 좀 돌리고…`, expr: 'happy' },
      { who: 'boss', text: '바다 건너에서 초청장이 왔어. {y}세계 무대{/}일세. 자네 이름이 거기까지 들린다는군!' },
      { who: 'boss', text: '배는 새 부두 끝에 대 놨네. 준비가 되면 부두 끝으로 오게.' },
      { who: 'boss', text: '아, 그리고 나도 같이 가네. 이 늙은이도 세계 구경 한번 해 봐야지. 사장 없는 선수가 어디 있나!' },
      { who: 'me', text: '…사장님도요?' },
      { who: 'boss', text: '체육관은 백 관장이 지킬 걸세. 서두르지 말고, 인사할 사람한테 인사하고 오게.' },
    ] },
    { walk: 'boss', to: x - 260, speed: 120 }, { remove: 'boss' },
    { act: () => { d.harbor.called = 1; c.save(); W.toast('세계로 가는 배 — 부두 끝에서 출항할 수 있다', '#49d6ff'); } },
    { bars: 0 },
  ];
}
// the last scene of the world ending: the pier at sunset, the people who came to see you off, the gangway, the ship
export function departureCine(W) {
  const d = W.c.d, crowd = wellWishers(d), gang = END_X - 26;
  const s = [{ bars: 1 }, { at: 'street', x: END_X - 150 }, { sky: 1 }, { music: 'ending' }, { fx: { ship: 1, waves: 1 } }, { cam: 2140, dur: .01 }];
  crowd.forEach((p, i) => s.push({ spawn: p.id, x: END_X - 250 - i * 34, face: 1, stance: p.stance, with: i ? 1 : 0 }));
  s.push({ spawn: 'boss', x: gang, face: -1, with: 1 });
  s.push({ caption: '세계로 가는 배가 새 부두에 닻을 내렸다.', dur: 3 });
  s.push({ walk: 'me', to: gang - 40, speed: 70 }, { face: 'me', dir: 'boss' });
  s.push({ say: [
    { who: 'boss', text: '기억하나? 자네가 처음 내 사무실 문을 열던 날. 잉크도 안 마른 계약서를 들고 덜덜 떨었지.', expr: 'happy' },
    { who: 'me', text: '…떨지 않았습니다.' },
    { who: 'boss', text: '떨었네. 나도 떨었거든. 이번엔 둘 다 떨어 보세. 바다 건너는 훨씬 넓다네!' },
  ] });
  s.push({ face: 'me', dir: -1 });
  const who = crowd.map(p => p.id);
  const bye = [];
  if (who.includes('fankid')) bye.push({ who: 'fankid', text: '챔피언! 세계 챔피언 돼서 꼭 돌아와요! 약속이에요!', expr: 'happy' });
  if (who.includes('dohyun')) bye.push({ who: 'dohyun', text: '…가라. 네가 없는 동안 이 항구 벨트는 내가 지킨다. 돌아오면 다시 붙자.' });
  if (who.includes('beggar')) bye.push({ who: 'beggar', text: '…내가 못 본 바다를, 자네가 보는구먼. 허리 펴고 가게.' });
  bye.push({ who: 'auntie', text: '배 타면 밥 거르지 말고! 파전은 돌아오면 또 부쳐 줄게!', expr: 'happy' });
  bye.push({ who: 'trainer', text: '땀 닦고 가. …잘했다.' });
  s.push({ say: bye });
  s.push({ face: 'me', dir: 1 }, { walk: 'me', to: gang, speed: 60 }, { hide: 'me', with: 1 }, { walk: 'boss', to: gang + 10, speed: 60, with: 1 }, { hide: 'boss', with: 1 });
  s.push({ sfx: 'horn' }, { wait: .8 }, { fx: { shipGo: 1 } }, { sfx: 'wave', with: 1 }, { sfx: 'gull', with: 1 });
  s.push({ caption: '뱃고동이 길게 울렸다. 이번에는 떠나는 쪽의 소리였다.', dur: 3.6 }, { wait: 2.2 });
  s.push({ title: ENDINGS.world.en, sub: ENDINGS.world.name, dur: 3.6 }, { dark: 1 }, { wait: 1.6 });
  return s;
}
// the last scene of staying: from the waiting room down the aisle to the ring, the crowd, the bell, black
export function stayCine(W, fromShip) {
  const d = W.c.d;
  return [
    { bars: 1 }, ...(fromShip ? [{ caption: '세계로 가는 배는 혼자 떠났다. 이 항구의 벨트는 아직 여기에 있다.', dur: 3.4 }] : []),
    { at: 'arena', x: 200 }, { music: 'match' }, { cam: 0, dur: .01 },
    { spawn: 'staff', x: 660, face: -1 },
    { say: [{ who: 'staff', text: `챔피언, 입장 준비됐습니다. 오늘도 매진이에요.` }, { who: 'me', text: '…가자.' }] },
    { sfx: 'crowdBoom' }, { walk: 'me', to: 760, speed: 70 }, { cam: 180, dur: 3, with: 1 },
    { caption: `"야항의 챔피언— ${d.name}!" 함성이 벽을 흔든다.`, dur: 3 }, { sfx: 'crowdBoom', with: 1 },
    { hide: 'me' }, { wait: 1.2 }, { sfx: 'bell3' }, { dark: 1 }, { wait: 1.4 },
    { title: ENDINGS.stay.en, sub: ENDINGS.stay.name, dur: 3.4 }, { wait: 1 },
  ];
}
// the last scene of teaching: the training gym, where it began. A new rookie walks in; you say what the boss said.
export function mentorCine(W) {
  const d = W.c.d;
  return [
    { bars: 1 }, { at: 'gym', x: 520 }, { music: 'office' }, { sky: 0 },
    { spawn: 'trainer', x: 640, face: -1 },
    { say: [{ who: 'trainer', text: '왔나. 오늘 새로 들어온 녀석이 있다. …이제 네 몫이다.' }] },
    { sfx: 'door' }, { spawn: 'newbie', x: 70, face: 1 }, { walk: 'newbie', to: 440, speed: 90 },
    { face: 'me', dir: 'newbie' },
    { say: [
      { who: 'newbie', text: '저, 저기! 오늘부터 여기서 운동하게 된 신인입니다!' },
      { who: 'me', text: '…자네가 새로 온 신인인가. 표정을 보니 딱 예전의 나로군.' },
      { who: 'me', text: '링에서 받은 충격은 몸에 남아. 그래도 일어나는 쪽이 이기는 거다. 땀 닦고, 링으로 올라와.' },
      { who: 'newbie', text: '네!', expr: 'happy' },
    ] },
    { walk: 'newbie', to: 900, speed: 120 }, { walk: 'me', to: 860, speed: 80, with: 1 },
    { caption: `${josa(d.name, '이/가')} 받은 것을, 이제 다음 사람에게.`, dur: 3.4 }, { wait: 1.4 },
    { dark: 1 }, { title: ENDINGS.mentor.en, sub: ENDINGS.mentor.name, dur: 3.4 }, { wait: 1 },
  ];
}
// the last scene of retiring: a quiet harbour morning, gulls and the wind instead of a crowd
export function retireCine(W) {
  return [
    { bars: 1 }, { at: 'street', x: 1240 }, { sky: 0 }, { music: 'ending' }, { cam: 980, dur: .01 },
    { sfx: 'gull' }, { caption: '갈매기 소리. 오늘 아침 부둣길에는 함성 대신 바닷바람이 분다.', dur: 3.6 },
    { walk: 'me', to: 1680, speed: 52 }, { cam: 1420, dur: 7, with: 1 },
    { sfx: 'gull' }, { spawn: 'auntie', x: 1900, face: -1, stance: 'hips' },
    { say: [{ who: 'auntie', text: '어머, 일찍 나왔네? 오늘은 링 안 가?' }, { who: 'me', text: '네. 오늘은… 그냥 걸으려고요.' }, { who: 'auntie', text: '그것도 좋지. 이따 국밥 먹으러 와.', expr: 'happy' }] },
    { walk: 'me', to: 2150, speed: 52 }, { cam: 1700, dur: 6, with: 1 },
    { caption: '새로운 하루로.', dur: 3 }, { wait: 1.2 },
    { dark: 1 }, { title: ENDINGS.retire.en, sub: ENDINGS.retire.name, dur: 3.4 }, { wait: 1 },
  ];
}
// the last scene of the unknown wrestler: a morning at the docks, a small ring at night; it is still a life
export function unknownCine(W) {
  const d = W.c.d;
  return [
    { bars: 1 }, { at: 'street', x: 1700 }, { sky: 0 }, { music: 'street' }, { cam: 1500, dur: .01 },
    { spawn: 'foreman', x: 1880, face: -1, stance: 'arms' },
    { say: [{ who: 'foreman', text: '오늘도 일찍 나왔구먼. 저녁엔 또 지하 링 가나?' }, { who: 'me', text: '네. 오늘은 관중이 열두 명이래요.' }, { who: 'foreman', text: '열둘이면 많지! 나도 가서 소리 질러 주지.', expr: 'happy' }] },
    { caption: '포스터에 이름이 크게 실린 적은 없다.', dur: 3.2 },
    { at: 'basement', x: 400 }, { music: 'boss' }, { cam: 120, dur: .01 },
    { spawn: 'foreman', x: 250, face: 1, stance: 'cheer' }, { spawn: 'fankid', x: 210, face: 1, stance: 'cheer', with: 1 },
    { walk: 'me', to: 540, speed: 70 }, { sfx: 'clap', with: 1 },
    { caption: `그래도 ${josa(d.name, '은/는')} 오늘도 링에 오른다. 박수 열두 번이면 충분했다.`, dur: 3.8 }, { wait: 1.2 },
    { dark: 1 }, { title: ENDINGS.unknown.en, sub: ENDINGS.unknown.name, dur: 3.4 }, { wait: 1 },
  ];
}
export const ENDING_CINES = { world: departureCine, stay: stayCine, mentor: mentorCine, retire: retireCine, unknown: unknownCine };
