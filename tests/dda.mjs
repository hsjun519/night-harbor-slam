// The career's rubber band: wins raise the next foes (more on streaks of three and five), losses ease them (more
// on a second loss), the last ten results are pulled toward 62-72% (50-60% against strong foes), and limits keep
// growth worth it: foes ranked below you barely move, every level lowers the cap and eases the band.
// A simulated player whose chance to win falls as the foes are raised settles inside the band. Run: node tests/dda.mjs
import { Career } from '../src/world/CareerManager.js';
import { Save } from '../src/core/SaveManager.js';
import { BALANCE as B } from '../src/data/balance.js';

let fails = 0;
const check = (ok, what, extra = '') => { if (ok) console.log('ok  ', what); else { fails++; console.log('FAIL', what, extra); } };
const look = { build: 'athletic', skin: 'tan', head: { face: 'square', hair: 'side', hairCol: '#222' }, top: { kind: 'none' }, bottom: { kind: 'tights', c1: '#157f8c', c2: '#ffd65a' }, boots: { c1: '#222' } };
const fresh = () => { for (const k of ['save2', 'save2.chk']) Save.del(k); return Career.create(2, { name: '파도', style: 'all', look }); };
const res = won => ({ human: { dmgTaken: 10, ko: false, finishersTaken: 0, ringOuts: 0 }, won, draw: false, result: { how: 'pin', winner: null } });
// steps: the streak sets the size
{
  const c = fresh(), d = c.d, ks = [];
  for (let i = 0; i < 5; i++) { d.record.streak = i; ks.push(c.ddaStep(d.dda, true, false)); d.dda = ks[ks.length - 1]; }
  const inc = ks.map((k, i) => k - (i ? ks[i - 1] : 0));
  check(inc[3] > inc[1] && inc[4] >= inc[3], `three in a row raise it more (${inc.map(x => x.toFixed(2)).join(' ')})`);
  d.record.streak = -1; const a = c.ddaStep(d.dda, false, false); d.record.streak = -2; const b = c.ddaStep(a, false, false);
  check(d.dda - a > 0 && a - b > d.dda - a - 1e-9, 'a loss eases it, a second one more');
}
// the band: a simulated player whose odds fall as the foes are raised
function season(pBase, n = 240, strong = false) {
  const c = fresh(), d = c.d, R = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7), log = [];
  for (let i = 0; i < n; i++) {
    const k = strong ? (d.ddaBoss || 0) * B.ddaStrongK : d.dda || 0, p = Math.max(.05, Math.min(.95, pBase - 1.3 * k)), won = R() < p;
    d.record.streak = won ? Math.max(1, d.record.streak + 1) : Math.min(-1, d.record.streak - 1);
    const key = strong ? 'ddaBoss' : 'dda'; d[key] = c.ddaStep(d[key] || 0, won, strong); log.push(won ? 1 : 0);
  }
  const tail = log.slice(-120); return tail.reduce((s, x) => s + x, 0) / tail.length;
}
{
  const strongPlayer = season(.95), okPlayer = season(.75), bossRate = season(.8, 240, true);
  check(strongPlayer >= .58 && strongPlayer <= .78, `a player who would win 95% settles near the band (${(strongPlayer * 100).toFixed(0)}%)`);
  check(okPlayer >= .58 && okPlayer <= .8, `one who would win 75% too (${(okPlayer * 100).toFixed(0)}%)`);
  check(bossRate >= .45 && bossRate <= .66, `against strong foes the band is lower (${(bossRate * 100).toFixed(0)}%)`);
}
// the limits: growth still pays
{
  const c = fresh(), d = c.d; d.dda = B.ddaMax;
  const L = c.rankList(), meR = c.rank, below = L.find((e, i) => e.id !== 'player' && i + 1 > meR + 2), above = L.find((e, i) => e.id !== 'player' && i + 1 < meR - 2);
  if (below) check(c.ddaFor(below.id).aiBoost <= B.ddaCapBelow + 1e-9, `a foe ranked below you is raised at most ${B.ddaCapBelow * 100}%`);
  if (above) check(c.ddaFor(above.id).aiBoost > B.ddaCapNear, 'a foe above you can be raised more');
  const lv1 = c.ddaFor(above ? above.id : 'dohyun').aiBoost; d.level = 21;
  const lv21 = c.ddaFor(above ? above.id : 'dohyun').aiBoost;
  check(lv21 < lv1 * .7, `at level 21 the same foe is raised less (${(lv1 * 100).toFixed(0)}% → ${(lv21 * 100).toFixed(0)}%)`);
  d.level = 1; d.dda = .3; c.addXp(c.xpNeed());
  check(d.dda < .3, 'a level up eases the band at once');
}
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
