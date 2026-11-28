// Training equipment: four grades a station; each costs more, trains more, tires more and plays a harder game
// (typing, rhythm, snake from the third grade); 백 관장 brings it up once a station has been outgrown.
// Run: node tests/gym.mjs
import { GEAR, tierOf, gainK, tireOf, feeK, outgrown, buyGear, gymOf, gearNext, mechOf, MECH_NAME } from '../src/world/gymGear.js';
import { Career } from '../src/world/CareerManager.js';
import { Save } from '../src/core/SaveManager.js';

let fails = 0;
const check = (ok, what, extra = '') => { if (ok) console.log('ok  ', what); else { fails++; console.log('FAIL', what, extra); } };
for (const k of ['save2', 'save2.chk']) Save.del(k);
const look = { build: 'athletic', skin: 'tan', head: { face: 'square', hair: 'side', hairCol: '#222' }, top: { kind: 'none' }, bottom: { kind: 'tights', c1: '#157f8c', c2: '#ffd65a' }, boots: { c1: '#222' } };
const c = Career.create(2, { name: '파도', style: 'all', look }), d = c.d;
check(Object.values(GEAR).every(T => T.length === 4 && T.every((g, i) => i === 0 || g.price > T[i - 1].price)), 'four grades a station, each dearer than the last');
check(Object.entries(GEAR).every(([id, T]) => new Set(T.map((g, i) => mechOf(id, i))).size === 4), 'every purchase trains a different way: no two grades of a station share a game', JSON.stringify(Object.fromEntries(Object.entries(GEAR).map(([id, T]) => [id, T.map((g, i) => mechOf(id, i))]))));
check(Object.values(GEAR).every(T => T.every((g, i) => !i || MECH_NAME[g.mech])), 'each bought grade names its game');
check(tierOf(d, 'bench') === 0 && gainK(d, 'bench') === 1 && tireOf(d, 'bench') === 14 && feeK(d, 'bench') === 1, 'the gym starts with what it has: normal effect, fatigue +14');
check(!outgrown(d, 'bench', ['atk', 'hp']), 'a rookie has not outgrown anything');
gymOf(d).runs.bench = 3; d.lv.atk = 3; d.lv.hp = 3;
check(outgrown(d, 'bench', ['atk', 'hp']), 'three sessions and level 3 in what it trains: 백 관장 brings up the next one');
d.money = 50000; check(!buyGear(c, 'bench') && tierOf(d, 'bench') === 0, 'not without the money');
d.money = 1000000; check(buyGear(c, 'bench') && tierOf(d, 'bench') === 1 && d.money === 1000000 - GEAR.bench[1].price, 'buying it moves the station up a grade');
check(gainK(d, 'bench') > 1 && tireOf(d, 'bench') > 14 && feeK(d, 'bench') > 1, `harder work: effect ×${gainK(d, 'bench')}, fatigue +${tireOf(d, 'bench')}, a dearer session`);
check(!outgrown(d, 'bench', ['atk', 'hp']), 'the new grade has to be outgrown in turn');
gymOf(d).tier.bench = 3; check(!gearNext(d, 'bench') && !buyGear(c, 'bench'), 'nothing past the fourth grade');
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
