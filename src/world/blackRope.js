// BLACK ROPE (a working name: change BR.name and the five characters to rename them): a rival crew of five who
// meet you as an up-and-comer, remember every result against you and grow on their own record, turn the lobby into
// a ring now and then, and run in on your official matches. Everything here works on the career data (testable).
//   d.br.stage: NONE → MET (they walk into the lobby: A NEW RIVAL) → ACTIVE (after the first match with one of them,
//   or a few days after meeting): raids, run-ins and their special matches.
import { CHARACTERS } from '../data/characters.js';
import { MOVES } from '../data/moves.js';
import { RNG, clamp, deepClone, pick } from '../core/util.js';

export const BR = {
  name: 'BLACK ROPE',
  ids: ['brLeader', 'brPower', 'brSpeed', 'brTech', 'brShow'],
  role: { brLeader: '리더', brPower: '파워형', brSpeed: '스피드형', brTech: '테크니션', brShow: '쇼맨' },
  meet: { day: 4, fame: 12, wins: 4 },
  active: 3,                                   // days after meeting before raids may start
  raid: { fame: 25, hostility: 35, gap: 9, gapChamp: 6, lossK: .15, lossCap: 15000, fixDays: 3, fixCost: 20000 },
  runIn: { hostility: 45, gap: 4, chance: .3, noContest: .35 },
  offerGap: 4,
  growth: .04, growthMax: 4,                   // stats +4% per step of their own growth
  // what each one adds after losing to you twice, four times: [pos, slot, move]
  learn: {
    brLeader: [['rear', 'n', 'dragonSuplex'], ['front', 'b', 'f5']],
    brPower: [['front', 'n', 'powerSlam'], ['front', 'u', 'airplane']],
    brSpeed: [['rear', 'n', 'runningBulldog'], ['front', 'u', 'f5']],
    brTech: [['rear', 'u', 'dragonSuplex'], ['front', 'u', 'piledriver']],
    brShow: [['front', 'u', 'airplane'], ['rear', 'u', 'giantSwing']],
  },
};
export const isBR = id => !!(CHARACTERS[id] && CHARACTERS[id].br);
export const brState = d => d.br || (d.br = { stage: 'NONE', metDay: -1, lastRaid: -99, raids: 0, lobby: 'ok', fixAt: 0, lastRunIn: -99, runIns: 0, rematch: 0, lastOffer: -99, allied: null, rivals: {} });
export function brRival(d, id) {
  const B = brState(d);
  return B.rivals[id] || (B.rivals[id] = { w: 0, l: 0, d: 0, rivalry: 20, hostility: id === 'brLeader' ? 20 : 10, affinity: 0, learned: [], recent: [], raids: 0, runIns: 0, story: 0 });
}
const busyDay = (c, d) => d.flags.gangDay === d.day || (d.revenge && !d.revenge.invited && d.day >= d.revenge.day) || (c.owDue && c.owDue('lobby')) || (d.contract && d.contract.day === d.day);

// ---- the first meeting
export function brMeetDue(c) { const d = c.d, B = brState(d); return B.stage === 'NONE' && d.day >= BR.meet.day && (d.fame >= BR.meet.fame || d.record.w >= BR.meet.wins) && !busyDay(c, d); }
export function brMeet(c) {
  const d = c.d, B = brState(d);
  B.stage = 'MET'; B.metDay = d.day;
  for (const id of BR.ids) brRival(d, id);
  brJoinLeague(c);
}
// they enter the league a little above the middle, the leader highest
export function brJoinLeague(c) {
  const d = c.d, L = d.league;
  if (!L || !L.length) return;
  const pts = L.map(e => e.pts).sort((a, b) => b - a), mid = pts[Math.floor(pts.length * .45)] || 40;
  BR.ids.forEach((id, i) => { if (!L.some(e => e.id === id)) L.push({ id, pts: mid + (id === 'brLeader' ? 12 : 6 - i * 2), w: 0, l: 0 }); });
}
export function brActivate(c) { const d = c.d, B = brState(d); if (B.stage === 'MET' && d.day >= B.metDay + BR.active) B.stage = 'ACTIVE'; }

// ---- results against them: their record, their mood, their growth (on their own losses, not your level)
export function brAfterMatch(c, id, won, draw) {
  const d = c.d, B = brState(d), R = brRival(d, id), L = brRival(d, 'brLeader'), ch = CHARACTERS[id], out = [];
  if (B.stage === 'MET') B.stage = 'ACTIVE';
  if (draw) { R.d++; R.recent.push('무'); }
  else if (won) {
    R.l++; R.recent.push('패'); R.rivalry = clamp(R.rivalry + 8, 0, 100); R.hostility = clamp(R.hostility + 10, 0, 100); R.affinity = clamp(R.affinity + 2, -50, 50);
    if (id !== 'brLeader') L.hostility = clamp(L.hostility + 5, 0, 100);
    const pool = BR.learn[id] || [];
    if (R.l % 2 === 0 && R.learned.length < pool.length) {
      const [, , mv] = pool[R.learned.length]; R.learned.push(mv);
      out.push(`${ch.name}이(가) 패배를 갚으려고 새 기술 '${MOVES[mv].name}'을(를) 익혔다는 소문이다.`);
    }
  } else {
    R.w++; R.recent.push('승'); R.rivalry = clamp(R.rivalry + 4, 0, 100); R.hostility = clamp(R.hostility - 3, 0, 100); R.affinity = clamp(R.affinity - 2, -50, 50);
  }
  if (R.recent.length > 6) R.recent.shift();
  return out;
}
// what they say after a match with you, by how it went and how it has gone before
export function brAfterLine(d, id, won) {
  const R = brRival(d, id), n = R.w + R.l;
  if (id === 'brLeader') return won
    ? pick(n > 2 ? ['…또냐. 좋아, 인정하지. 하지만 마지막에 웃는 건 나다.', '다음엔 BLACK ROPE 전원이 너를 본다.'] : ['이번에는 네가 운이 좋았던 거야.', '다음에는 이렇게 끝나지 않을 거다.'])
    : pick(['봤냐? 이 도시의 챔피언은 내가 될 거라고 했지.', '소문난 신인도 별거 없군.', 'BLACK ROPE 앞에선 다들 그렇게 누워.']);
  const ch = CHARACTERS[id];
  return won ? ch.lines.lose : ch.lines.win;
}
// stats and moves for a match: grown by their own losses to you (and what they learned)
export function brMods(c, id, stats) {
  const R = brRival(c.d, id), C = CHARACTERS[id], g = Math.min(BR.growthMax, R.learned.length + Math.floor(R.l / 3)), k = 1 + g * BR.growth;
  const base = stats || C.stats, st = Object.assign({}, base, { hp: base.hp * k, stun: base.stun * k, atk: base.atk * (1 + g * BR.growth * .5), grp: base.grp * (1 + g * BR.growth * .5) });
  const moves = deepClone(C.moves);
  (BR.learn[id] || []).forEach(([pos, slot, mv]) => { if (R.learned.includes(mv)) moves[pos][slot] = mv; });
  return { stats: st, moves, growth: g };
}

// ---- the lobby raid (LOBBY BRAWL): a long gap between them, never on a day that already has its event
export function brRaidDue(c) {
  const d = c.d, B = brState(d);
  brActivate(c);
  return B.stage === 'ACTIVE' && B.lobby === 'ok' && d.fame >= BR.raid.fame && brRival(d, 'brLeader').hostility >= BR.raid.hostility &&
    d.day - B.lastRaid >= (d.flags.champion ? BR.raid.gapChamp : BR.raid.gap) && d.day >= B.metDay + BR.active && !busyDay(c, d);
}
export function brRaidLineup(c) {
  const d = c.d, B = brState(d), r = new RNG(d.season * 41 + d.day * 3 + B.raids);
  const others = BR.ids.slice(1).sort((a, b) => brRival(d, b).hostility - brRival(d, a).hostility);
  const two = [others[0], r.pick(others.slice(1))];
  return { who: ['brLeader', two[0]], late: d.flags.champion || B.raids >= 2 ? two[1] : null };
}
export function brRaidResult(c, won) {
  const d = c.d, B = brState(d), L = brRival(d, 'brLeader'), out = { money: 0, fame: 0, loss: 0 };
  B.lastRaid = d.day; B.raids++; B.rematch = 1;
  for (const id of BR.ids) brRival(d, id).raids++;
  if (won) {
    out.money = 40000 + d.season * 10000; out.fame = 6;
    c.earn(out.money); d.fame += out.fame; L.hostility = clamp(L.hostility + 12, 0, 100); L.rivalry = clamp(L.rivalry + 10, 0, 100);
  } else {
    out.loss = Math.min(BR.raid.lossCap, Math.round(d.money * BR.raid.lossK / 1000) * 1000);
    if (out.loss > 0) c.pay(out.loss);
    B.lobby = 'damaged'; B.fixAt = d.day + BR.raid.fixDays; L.hostility = clamp(L.hostility - 4, 0, 100); L.affinity = clamp(L.affinity - 2, -50, 50);
  }
  return out;
}
export function brLobbyFix(c) { const B = brState(c.d); B.lobby = 'ok'; B.fixAt = 0; }

// ---- run-ins on your official matches: not too often, only when the leader is wound up
export function brRunInDue(c, kind, o) {
  const d = c.d, B = brState(d);
  if (B.stage !== 'ACTIVE' || !(kind === 'official' || kind === 'title') || !o || isBR(o.opp)) return null;
  if (d.day - B.lastRunIn < BR.runIn.gap || brRival(d, 'brLeader').hostility < BR.runIn.hostility) return null;
  const r = new RNG(d.season * 97 + d.day * 13 + B.runIns);
  if (!r.chance(BR.runIn.chance)) return null;
  return r.chance(.6) ? 'brLeader' : r.pick(BR.ids.slice(1));
}
export function brRunInMark(c, id) { const d = c.d, B = brState(d); B.lastRunIn = d.day; B.runIns++; brRival(d, id).runIns++; }

// ---- their special match (an offer in the boss's office): after a raid or a run-in, otherwise every few days
export function brOffer(c, mk) {
  const d = c.d, B = brState(d);
  if (B.stage === 'NONE' || d.contract || (!B.rematch && d.day - B.lastOffer < BR.offerGap)) return null;
  const id = B.rematch ? 'brLeader' : BR.ids[(d.day + d.season) % BR.ids.length], R = brRival(d, id), n = R.w + R.l + 1;
  return mk({ id }, 'brmatch', { arena: B.rematch ? 'hall' : 'pier', fame: 10 + Math.min(10, n * 2), reward: Math.round((45000 + n * 9000) * (1 + (d.season - 1) * .3) / 1000) * 1000, br: 1,
    desc: B.rematch ? `${BR.name} 리더 차무진의 재대결 요구. 로비에서의 일, 링 위에서 정리하자.` : `${BR.name} ${BR.role[id]} ${CHARACTERS[id].name}의 도전장. ${n}번째 대결.` });
}
