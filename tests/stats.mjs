// The stat rework: 기본 공격력 (strikes) and 스킬 공격력 (moves), 민첩성 (speed and jump in one), 크리티컬 확률 (a chance on
// every hit and move: double damage, a big bite of the stun gauge), and the bonus for slamming a bigger foe onto the
// mat. Old saves turn 이동 속도 + 점프력 into 민첩성. Run: node tests/stats.mjs
import { MatchManager } from '../src/combat/MatchManager.js';
import { Career, STAT_GROWTH, AGI } from '../src/world/CareerManager.js';
import { Save } from '../src/core/SaveManager.js';
import { BALANCE as B } from '../src/data/balance.js';
import { CHARACTERS } from '../src/data/characters.js';

let fails = 0;
const check = (ok, what, extra = '') => { if (ok) console.log('ok  ', what); else { fails++; console.log('FAIL', what, extra); } };
const look = { build: 'athletic', skin: 'tan', head: { face: 'square', hair: 'side', hairCol: '#222' }, top: { kind: 'none' }, bottom: { kind: 'tights', c1: '#157f8c', c2: '#ffd65a' }, boots: { c1: '#222' } };
for (const k of ['save2', 'save2.chk']) Save.del(k);
// ---- the career side
{
  check(STAT_GROWTH.grp[1] === '스킬 공격력' && STAT_GROWTH.atk[1] === '기본 공격력' && STAT_GROWTH.agi && STAT_GROWTH.crit && !STAT_GROWTH.spd && !STAT_GROWTH.jump, 'stats: 기본/스킬 공격력, 민첩성 and 크리티컬 (no separate speed and jump)', Object.keys(STAT_GROWTH).join());
  const c = Career.create(2, { name: '파도', style: 'all', look }), d = c.d, base = c.stats;
  d.lv.agi = 10;
  const s = c.stats;
  check(Math.abs(s.spd / base.spd - (1 + 10 * AGI.spd)) < 1e-9 && Math.abs(s.jump / base.jump - (1 + 10 * AGI.jump)) < 1e-9, '민첩성 raises speed and the jump together');
  check(Math.abs(base.crit - B.critBase) < 1e-9, `the crit chance starts at ${B.critBase * 100}%`);
  d.lv.crit = 20; check(Math.abs(c.stats.crit - (B.critBase + 20 * STAT_GROWTH.crit[0])) < 1e-9, `and grows to ${((B.critBase + 20 * STAT_GROWTH.crit[0]) * 100).toFixed(1)}% at level 20`);
  // an old save
  const old = Career.create(2, { name: '옛 선수', style: 'all', look }); old.d.lv = { hp: 2, stun: 1, atk: 3, grp: 2, spd: 6.5, jump: 4.2, rec: 0, down: 0, kbr: 0, fin: 0, brk: 1 }; old.d.points = 1; old.save();
  const k = Career.load(2);
  check(k.d.lv.agi === 6.5 && k.d.points === 1 + 4 && !k.d.lv.spd && !k.d.lv.jump && k.d.lv.crit === 0, 'an old save: 민첩성 takes the higher of speed and jump, the other comes back as points', JSON.stringify({ agi: k.d.lv.agi, pts: k.d.points }));
  const e = k.entrant('human');
  check(Number.isFinite(e.stats.spd) && Number.isFinite(e.stats.jump) && Number.isFinite(e.stats.crit) && Number.isFinite(e.stats.hp), 'and its fighter has every stat');
}
// ---- crits in a fight
function slam(o = {}) {
  const m = new MatchManager({ mode: 'single', arena: o.arena || 'hall', seed: o.seed || 3, skipIntro: true, entrants: [{ char: 'rookie', ctrl: 'human', stats: Object.assign({}, CHARACTERS.rookie.stats, { crit: o.crit || 0 }) }, { char: 'dohyun', ctrl: 'dummy', stats: Object.assign({}, CHARACTERS.dohyun.stats, o.foeStats || {}) }] });
  const h = m.fighters[0], v = m.fighters[1];
  for (let i = 0; i < 20; i++) m.update(1 / 60);
  h.face = 1; h.x = 400; v.x = 424; v.face = -1;
  const crits = []; m.on('crit', e => crits.push(e)); const bonus = []; m.on('slamBonus', e => bonus.push(e.k));
  const hp0 = v.hp, st0 = v.stun;
  m.wrestle.start(h, v, o.move || 'bodySlam', { noReverse: true });
  for (let t = 0; t < 2.6; t += 1 / 60) m.update(1 / 60);
  return { dmg: hp0 - v.hp, stun: st0 - v.stun, crits: crits.length, bonus, v, h };
}
{
  const a = slam({ crit: 0 }), b = slam({ crit: 1 });
  check(a.crits === 0 && b.crits === 1, 'a critical move is announced once');
  check(Math.abs(b.dmg / a.dmg - B.critMul) < .05, `a critical move does ${B.critMul}x the damage (${a.dmg.toFixed(1)} → ${b.dmg.toFixed(1)})`);
  check(b.stun > a.stun * 2, `and takes far more of the stun gauge (${a.stun.toFixed(1)} → ${b.stun.toFixed(1)})`);
}
{
  // strikes: every J string hit can crit
  const run = crit => {
    const m = new MatchManager({ mode: 'single', arena: 'hall', seed: 4, skipIntro: true, entrants: [{ char: 'rookie', ctrl: 'ai', difficulty: 'expert', stats: Object.assign({}, CHARACTERS.rookie.stats, { crit }) }, { char: 'dohyun', ctrl: 'dummy' }] });
    let n = 0; m.on('crit', () => n++); let hits = 0; m.on('hit', () => hits++);
    for (let t = 0; t < 25 && m.phase !== 'end'; t += 1 / 60) m.update(1 / 60);
    return { n, hits };
  };
  const r0 = run(0), r1 = run(1);
  check(r0.n === 0 && r1.n > 0 && r1.hits > 0, `strikes crit too (${r1.n} crits in ${r1.hits} hits at 100%)`);
}
// ---- the slam bonus: the bigger the foe, the bigger the bonus
{
  const small = slam({ foeStats: { hp: CHARACTERS.rookie.stats.hp * .8 } }), big = slam({ foeStats: { hp: CHARACTERS.rookie.stats.hp * 2 } });
  const k = big.dmg / small.dmg, want = (1 + B.slamBonus + B.slamBonusStrong) / (1 + B.slamBonus);
  check(Math.abs(k - want) < .03, `slamming a foe twice your size hits ${(k * 100 - 100).toFixed(0)}% harder than one smaller than you`, `${small.dmg.toFixed(1)} vs ${big.dmg.toFixed(1)}`);
  check(big.bonus.length === 1 && !small.bonus.length, 'the big bonus is called out ("링 충격!"), the small one is not');
}
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
