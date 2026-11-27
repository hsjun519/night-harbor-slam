// The endings of a career, and what THE FINAL BELL shows of it. Five endings:
//   world   세계 무대       the pier rebuilt (HARBOR.need) and fame HARBOR.fame: you sail with 구만석 사장
//   stay    항구의 챔피언   you hold the belt and stay: when the ship is ready, or from the office as champion
//   mentor  다음 세대       골목 영감 taught you everything, and you were somebody (a belt, or fame 100): you teach
//   retire  마지막 인사     you were somebody (a belt, or fame 120) and you hang up the boots
//   unknown 이름 없는 레슬러 you leave without a name; the game does not call that worthless
// The office talk (구만석 사장 → 커리어 마무리) opens from season 2, after a belt or after 25 matches. A career that
// ends on an injury plays THE FINAL BELL too (retire or unknown). Highlights only show what really happened.
import { CHARACTERS } from '../data/characters.js';
import { josa, fmtMoney } from '../core/util.js';
import { HARBOR, harborRepaired } from './harbor.js';
import { BEGGAR, beggarState } from './beggar.js';

export const ENDINGS = {
  world: { name: '세계 무대', en: 'THE WORLD STAGE', col: '#49d6ff', last: '구만석 사장과 함께 세계로 가는 배에 올랐다.', script: '새 부두. 구만석 사장과 함께 세계로 가는 배에 오른다. 항구가 손을 흔든다.' },
  stay: { name: '항구의 챔피언', en: 'CHAMPION OF THE HARBOR', col: '#ffd65a', last: '벨트를 허리에 감고, 다시 링으로 걸어갔다.', script: '입장 통로. 벨트를 허리에 감고 다시 링으로 걸어간다. 종이 울린다.' },
  mentor: { name: '다음 세대', en: 'THE NEXT GENERATION', col: '#6be38a', last: '처음 시작한 훈련장에서 새 신인을 맞이했다.', script: '훈련장. 새 신인이 문을 연다. 이제는 내가 맞이한다.' },
  retire: { name: '마지막 인사', en: 'THE LAST BOW', col: '#ff8fc4', last: '링을 내려와 조용한 항구의 아침을 걸었다.', script: '아침의 부둣길. 갈매기 소리. 링이 아닌 곳으로 걸어간다.' },
  unknown: { name: '이름 없는 레슬러', en: 'THE UNKNOWN WRESTLER', col: '#c9d4ff', last: '이름은 크게 남지 않았지만, 끝까지 링에 올랐다.', script: '하역장, 그리고 작은 링. 이름 없는 하루가 또 시작된다.' },
};
export const ENDING_IDS = Object.keys(ENDINGS);
export const careerMatches = d => (d.record.w || 0) + (d.record.l || 0) + (d.record.d || 0);
export const FINISH = { season: 2, matches: 25, mentorFame: 100, retireFame: 120 };
// 구만석 사장 will talk about finishing from season 2, after a belt, or after enough matches
export const canFinish = d => !d.ending && ((d.season || 1) >= FINISH.season || (d.titles || []).length > 0 || careerMatches(d) >= FINISH.matches);
export const somebody = (d, fame) => (d.titles || []).length > 0 || (d.fame || 0) >= fame;
export const mentorOk = d => beggarState(d).lessons >= BEGGAR.lessons.length && somebody(d, FINISH.mentorFame);
export const stayOk = d => !!(d.flags && d.flags.champion);
export const retireKind = d => (somebody(d, FINISH.retireFame) ? 'retire' : 'unknown');
// what the office offers, in order
export function finishOptions(d) {
  const o = [];
  if (stayOk(d)) o.push('stay');
  if (mentorOk(d)) o.push('mentor');
  o.push(retireKind(d));
  return o;
}
const stamp = (s, day) => (day == null ? '' : s ? `시즌 ${s} · ${day}일차` : `${day}일차`);
const res = e => (e.won ? '승리' : e.draw ? '무승부' : '패배');
// THE FINAL BELL's reel: the things that really happened, in order
export function highlights(d, id) {
  const H = [], me = d.name || '신인', st = d.story || {};
  const add = (k, title, sub, o = {}) => H.push(Object.assign({ k, title, sub, when: stamp(o.s, o.day), tone: 'story' }, o));
  add('start', '첫 발걸음', `신인 ${josa(me, '이/가')} 야항 체육관의 문을 열었다`, { s: 1, day: 1, other: 'boss', expr: 'neutral' });
  const fm = st.firstMatch;
  if (fm) add('first', '첫 경기', `${fm.opp || '상대'} — ${res(fm)}`, { s: fm.season, day: fm.day, other: fm.oppId, opp: fm.opp || '상대', tone: fm.won ? 'win' : fm.draw ? 'story' : 'loss', expr: fm.won ? 'happy' : 'hurt' });
  const fw = st.firstWin;
  if (fw && fw !== fm && !(fm && fw.day === fm.day && fw.opp === fm.opp && fw.season === fm.season)) add('win', '첫 승리', `${josa(fw.opp || '상대', '을/를')} 꺾었다. 관중석에서 이름이 처음 들렸다`, { s: fw.season, day: fw.day, other: fw.oppId, tone: 'win', expr: 'happy' });
  const fl = st.firstLoss;
  if (fl && fl !== fm && !(fm && fl.day === fm.day && fl.opp === fm.opp && fl.season === fm.season)) add('loss', '첫 패배', `${fl.opp || '상대'}에게 졌다. 다음 날도 체육관에 나왔다`, { s: fl.season, day: fl.day, other: fl.oppId, tone: 'loss', expr: 'hurt' });
  const r = d.h2h && d.h2h.dohyun;
  if (r && (r.w || 0) + (r.l || 0) > 0) add('rival', '라이벌', `서도현과 ${r.w + r.l}번 맞붙었다 — ${r.w}승 ${r.l}패`, { other: 'dohyun', tone: 'rival', expr: 'fierce' });
  const gang = (d.flags && d.flags.gangBeaten) || 0;
  if (gang) add('raid', '로비 습격', `부두 악동단을 ${gang}번 쫓아냈다`, { other: 'galchi', tone: 'win', expr: 'fierce' });
  const B = d.br;
  if (B && B.stage && B.stage !== 'NONE') {
    let w = 0, l = 0; for (const k in B.rivals || {}) { w += B.rivals[k].w || 0; l += B.rivals[k].l || 0; }
    add('br', 'BLACK ROPE', B.raids ? `로비를 링으로 바꾼 녀석들 — ${B.raids}번의 습격, ${w}승 ${l}패` : `검은 로프의 다섯 명 — ${w}승 ${l}패`, { other: 'brLeader', tone: 'rival', expr: 'fierce' });
  }
  const t0 = (d.titles || [])[0];
  if (t0) add('champ', '챔피언 등극', `${t0.name}${(d.titles || []).length > 1 ? ` (타이틀 ${d.titles.length}개)` : ''}`, { s: t0.season, day: t0.day, tone: 'gold', expr: 'happy', belt: 1 });
  if (d.flags && d.flags.mitbWon) add('mitb', '머니 인 더 뱅크', '래더 꼭대기의 가방을 손에 넣었다', { tone: 'win', expr: 'happy' });
  const o = d.ow;
  if (o && o.day1 != null) {
    add('ow', '선항 레슬링', '바다 건너에서 배가 왔다. 등대 돔이 무너졌다', { day: o.day1, other: 'owsailor', expr: 'fierce' });
    const iw = !!(o.won1 || o.won2);
    add('ivory', '흰상아', iw ? '선항 레슬링의 칼날을 꺾었다' : '흰상아에게 졌다. 그래도 물러서지 않았다', { day: o.day1, other: 'whiteivory', tone: iw ? 'win' : 'loss', expr: iw ? 'fierce' : 'hurt' });
  }
  if (o && (o.state === 'REBUILD' || o.state === 'INTERNATIONAL_ROUTE_OPEN')) add('godong', '선장 고동', o.losses3 ? `${o.losses3}번 쓰러진 끝에 바다의 왕을 돌려보냈다` : '바다의 왕을 돌려보냈다', { day: o.day3, other: 'godong', tone: 'gold', expr: 'fierce' });
  else if (o && o.losses3) add('godong', '선장 고동', '끝내 그 닻을 뽑지 못했다', { other: 'godong', tone: 'loss', expr: 'hurt' });
  if (harborRepaired(d)) add('harbor', '항구 재건', `부두 복구 기금 ${fmtMoney(HARBOR.need)} — 그중 ${fmtMoney(d.harbor.mine)}을 보탰다`, { s: d.harbor.repairedSeason, day: d.harbor.repairedDay, tone: 'gold', expr: 'happy' });
  const E = ENDINGS[id] || ENDINGS.retire;
  add('end', '마지막 선택', E.last, { s: d.ending ? d.ending.season : d.season, day: d.ending ? d.ending.day : d.day, tone: 'end', expr: id === 'unknown' || id === 'retire' ? 'neutral' : 'happy', other: id === 'world' ? 'boss' : null });
  return H;
}
// the script: the career as if it had been written before the first day
export function scriptLines(d, id) {
  const me = d.name || '신인', R = d.record || {}, L = [], H = highlights(d, id), E = ENDINGS[id] || ENDINGS.retire;
  let n = 0;
  const scene = (place, line) => { n++; L.push({ h: `S#${n}. ${place}` }); L.push({ t: line }); };
  for (const h of H) {
    const when = h.when ? ` — ${h.when}` : '';
    if (h.k === 'start') scene(`구만석 사장의 사무실${when}`, `신인 ${josa(me, '이/가')} 첫 계약서에 이름을 쓴다.`);
    else if (h.k === 'first') scene(`링${when}`, `${josa(h.opp, '과/와')}의 첫 경기. ${josa(me, '은/는')} ${h.tone === 'win' ? '이긴다' : h.tone === 'loss' ? '진다' : '비긴다'}.`);
    else if (h.k === 'win') scene(`링${when}`, `${josa(me, '이/가')} 처음으로 이긴다. 관중이 이름을 부른다.`);
    else if (h.k === 'loss') scene(`링${when}`, `${josa(me, '이/가')} 처음으로 진다. 다음 날 다시 체육관에 나온다.`);
    else if (h.k === 'rival') scene('부둣가 특설 링', `서도현과 맞붙는다. ${h.sub.split(' — ')[1]}.`);
    else if (h.k === 'raid') scene('로비', `악동단이 들이닥친다. ${josa(me, '은/는')} 그들을 쫓아낸다.`);
    else if (h.k === 'br') scene('로비', 'BLACK ROPE가 걸어 들어온다. 로비가 링이 된다.');
    else if (h.k === 'champ') scene(`등대 돔${when}`, `${josa(me, '이/가')} 챔피언 벨트를 허리에 감는다.`);
    else if (h.k === 'mitb') scene('래더 꼭대기', '가방에 손이 닿는다.');
    else if (h.k === 'ow') scene('항구', '바다 건너에서 배가 온다. 등대 돔이 무너진다.');
    else if (h.k === 'ivory') scene('부둣가 특설 링', `흰상아와 싸운다. ${h.tone === 'win' ? '이긴다' : '진다. 그래도 물러서지 않는다'}.`);
    else if (h.k === 'godong') scene('부둣가', h.tone === 'loss' ? '선장 고동 앞에 쓰러진다. 닻은 뽑히지 않는다.' : '선장 고동이 뱃머리를 돌린다.');
    else if (h.k === 'harbor') scene(`부두${when}`, '무너진 부두가 다시 선다.');
  }
  scene('그동안', `모두 ${careerMatches(d)}번 링에 오른다. ${R.w || 0}번 이기고, ${R.l || 0}번 진다.${R.ko ? ` ${R.ko}번은 KO로 끝낸다.` : ''}`);
  if (d.ending && d.ending.cause === 'injury') scene('항구의원', '몸이 먼저 링을 떠난다.');
  scene('마지막 장면', E.script);
  return L;
}
// the six lines at the end (as written in the design brief); the two questions come after a silence
export const FINAL_LINES = ['당신이 승리한 경기에는 승리하기로 예정된 과거가 있었습니다.', '당신이 패배한 경기에는 패배하기로 예정된 과거가 있었습니다.', '당신의 미래는 처음부터 정해져 있었을지도 모릅니다.', '그러나 당신이 다르게 행동했다면, 그 과거 또한 달랐을 것입니다.'];
export const FINAL_QUESTIONS = ['당신은 미래의 노예입니까?', '아니면 미래를 개척하는 선구자입니까?'];
// the credits: the people this career met, and the wrestlers it fought
export function credits(d, npcName) {
  const met = ['boss', 'trainer', 'doctor', 'auntie', 'shop', 'fankid', 'reporter', 'oldman'];
  if (d.flags && d.flags.hideout) met.push('beggar');
  const cast = met.map(id => npcName(id)).filter(Boolean);
  const foes = Object.keys(d.h2h || {}).filter(id => CHARACTERS[id]).sort((a, b) => ((d.h2h[b].w || 0) + (d.h2h[b].l || 0)) - ((d.h2h[a].w || 0) + (d.h2h[a].l || 0))).slice(0, 12).map(id => CHARACTERS[id].name);
  const out = [{ big: '밤항구 슬램' }, { sub: 'THE FINAL BELL' }, { gap: 1 }, { h: '주연' }, { t: d.name || '신인' }, { gap: 1 }, { h: '항구 사람들' }];
  for (let i = 0; i < cast.length; i += 3) out.push({ t: cast.slice(i, i + 3).join(' · ') });
  if (foes.length) { out.push({ gap: 1 }, { h: '링에서 만난 사람들' }); for (let i = 0; i < foes.length; i += 3) out.push({ t: foes.slice(i, i + 3).join(' · ') }); }
  out.push({ gap: 1 }, { h: '음악 · 그림' }, { t: '모두 코드로 직접 만든 칩튠과 픽셀' }, { gap: 1 }, { h: '그리고' }, { t: '이 항구의 모든 관중' }, { gap: 2 }, { t: '플레이해 주셔서 고맙습니다' });
  return out;
}
