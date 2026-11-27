// 부두 복구와 세계 무대. Once 선장 고동 sails away (선항 레슬링, chapter three) a sign goes up at the old pier past
// the dome: "명성을 모으고 부두를 고쳐 세계로 진출하라". Rebuilding the pier costs HARBOR.need. Most of it is yours to
// give at the sign, but you are not alone in it: the league adds a share of every prize, the harbour's people chip
// in every day by your fame, and a sponsor comes in once you are famous enough. When the fund is full the pier is
// rebuilt (A NEW WAVE); once it stands and your fame reaches HARBOR.fame, 구만석 사장 has a ship and a berth for the
// two of you (the world stage: an ending). Everything here works on the career data, so it is testable in Node.
//   d.harbor = { stage: 'BROKEN' | 'REPAIRED', fund, mine, league, fans, sponsor, since, season, repairedDay, called }
import { fmtMoney as won } from '../core/util.js';

export const HARBOR = {
  need: 3000000,          // the pier
  fame: 300,              // the world will not take a ship of nobodies
  league: .1,             // the league adds 10% of every prize you win (on top of it, not out of it)
  fans: 20,               // the harbour's people give fame × this every morning (rounded to ₩1,000)
  sponsorFame: 200, sponsor: 300000,   // 황 대표's milk company, once
  gifts: [100000, 1000000],            // what the sign offers to give
  x: 2330,                // the barrier across the broken pier (the street's walkable end until it is rebuilt)
  end: 2738,              // the end of the pier
};
export const harborOf = d => d.harbor || null;
export function harborBegin(d) {
  if (!d.harbor) d.harbor = { stage: 'BROKEN', fund: 0, mine: 0, league: 0, fans: 0, sponsor: 0, since: d.day, season: d.season || 1, repairedDay: null, called: 0 };
  return d.harbor;
}
export const harborBroken = d => !!(d.harbor && d.harbor.stage === 'BROKEN');
export const harborRepaired = d => !!(d.harbor && d.harbor.stage === 'REPAIRED');
export const harborRatio = d => (d.harbor ? (d.harbor.stage === 'REPAIRED' ? 1 : Math.min(1, d.harbor.fund / HARBOR.need)) : 0);
export const harborLeft = d => (d.harbor && d.harbor.stage === 'BROKEN' ? Math.max(0, HARBOR.need - d.harbor.fund) : 0);
export const harborFull = d => harborBroken(d) && d.harbor.fund >= HARBOR.need;
export const worldReady = d => harborRepaired(d) && (d.fame || 0) >= HARBOR.fame && !d.ending;
// money into the fund, never past what the pier needs. src: 'mine' (out of your pocket, see donate) or a giver
export function harborAdd(d, src, amount) {
  const H = d.harbor;
  if (!H || H.stage !== 'BROKEN' || !(amount > 0)) return 0;
  const n = Math.min(Math.round(amount), HARBOR.need - H.fund);
  if (n <= 0) return 0;
  H.fund += n; H[src] = (H[src] || 0) + n;
  return n;
}
// you give at the sign: out of your pocket, as much as the pier still needs
export function donate(c, amount) {
  const d = c.d, n = Math.min(Math.round(amount), harborLeft(d), d.money);
  if (!(n > 0) || !c.pay(n)) return 0;
  return harborAdd(d, 'mine', n);
}
// the league's share of a prize (called after every paid match while the pier is broken)
export const leagueShare = money => Math.round(money * HARBOR.league / 1000) * 1000;
// the morning's gifts: the harbour's people every day, the sponsor once
export function morningGifts(d) {
  const msgs = [];
  if (!harborBroken(d)) return msgs;
  const f = harborAdd(d, 'fans', Math.round((d.fame || 0) * HARBOR.fans / 1000) * 1000);
  if (f) msgs.push(`항구 사람들이 부두 복구 기금을 모았다 +${won(f)}`);
  if ((d.fame || 0) >= HARBOR.sponsorFame && !d.harbor.sponsor) { const s = harborAdd(d, 'sponsor', HARBOR.sponsor); if (s) msgs.push(`황 대표의 황금등대 우유가 부두 복구 기금에 ${won(s)}을 냈다!`); }
  return msgs;
}
// the fund is full: the pier is rebuilt
export function harborRebuild(d) { const H = d.harbor; if (H && H.stage === 'BROKEN') { H.stage = 'REPAIRED'; H.fund = HARBOR.need; H.repairedDay = d.day; H.repairedSeason = d.season || 1; } }
// what the sign says: the order, the money, the fame
export function signReport(d) {
  const H = d.harbor;
  if (!H) return null;
  const pct = Math.floor(harborRatio(d) * 100);
  return {
    order: '명성을 모으고 부두를 고쳐 세계로 진출하라',
    fund: `부두 복구 기금 ${won(H.fund)} / ${won(HARBOR.need)} (${pct}%)`,
    fame: `명성 ${d.fame || 0} / ${HARBOR.fame}`,
    givers: `내 기부 ${won(H.mine)} · 연맹 ${won(H.league)} · 항구 사람들 ${won(H.fans)} · 스폰서 ${won(H.sponsor)}`,
    pct,
  };
}
// the pier's look: 0 broken, 1 cleared and scaffolded, 2 half rebuilt, 3 decked, 4 rebuilt with lights and flags
export function pierStage(d) {
  if (!d.harbor) return 0;
  if (d.harbor.stage === 'REPAIRED') return 4;
  const r = harborRatio(d);
  return r >= .75 ? 3 : r >= .5 ? 2 : r >= .2 ? 1 : 0;
}
