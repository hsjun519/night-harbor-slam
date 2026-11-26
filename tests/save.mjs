// Career saves: one key per save slot, time of day kept apart, and old time-of-day keyed saves moved over.
// Runs in Node: SaveManager falls back to memory without window.localStorage.
import { Save } from '../src/core/SaveManager.js';
import { Career, hasCareer } from '../src/world/CareerManager.js';

const KEYS = ['save1', 'save1.chk', 'career0', 'career1', 'career2', 'career0.chk', 'career1.chk', 'career2.chk'];
const wipe = () => KEYS.forEach(k => Save.del(k));
let fails = 0;
const check = (ok, what, extra = '') => { console.log((ok ? 'ok   ' : 'FAIL ') + what + (ok ? '' : ' ' + extra)); if (!ok) fails++; };
const look = { build: 'athletic', skin: 'tan', head: { face: 'square', hair: 'side', hairCol: '#222' }, top: { kind: 'none' }, bottom: { kind: 'tights', c1: '#157f8c', c2: '#ffd65a' }, boots: { c1: '#23263a' } };
const legacy = (o) => Object.assign({ v: 1, name: '옛선수', style: 'all', created: 100, season: 1, day: 1, slot: 0, injury: 0, money: 60000, fame: 0, items: {}, gear: {}, flags: {}, npc: {}, h2h: {}, league: [], record: { w: 0, l: 0, d: 0, ko: 0, pin: 0, streak: 0 }, lv: {}, history: [], titles: [] }, o);

wipe();
check(!hasCareer(1), 'empty storage has no career');
const c = Career.create(1, { name: '파도', style: 'brawl', look });
check(hasCareer(1) && !!Save.get('save1') && !!Save.get('save1.chk'), 'create writes save1 and its checkpoint');
check(c.d.slot === 0 && c.d.saveSlot === 1, 'new career starts in the morning, save slot 1', JSON.stringify({ slot: c.d.slot, saveSlot: c.d.saveSlot }));
c.spendSlot(1); c.d.money = 12345; c.save();
check(!Save.get('career1') && !Save.get('career0'), 'saving in the afternoon does not write a time-of-day key');
let L = Career.load(1);
check(L && L.d.money === 12345 && L.d.slot === 1, 'load returns the latest save with its time of day', JSON.stringify(L && { m: L.d.money, s: L.d.slot }));
c.spendSlot(2); c.save();
L = Career.load(1);
check(L.d.day === 2 && L.d.slot === 0 && L.d.money === 12345, 'next morning still loads from the same key', JSON.stringify({ day: L.d.day, slot: L.d.slot }));

// old builds: the newest state of the newest career wins
wipe();
Save.set('career0', legacy({ day: 3, slot: 0, money: 1 }));
Save.set('career1', legacy({ day: 2, slot: 1, money: 2 }));
Save.set('career2', legacy({ day: 3, slot: 2, money: 3 }));
Save.set('career0.chk', legacy({ day: 3, slot: 0, money: 9 }));
check(hasCareer(1), 'old saves count as a career');
L = Career.load(1);
check(L && L.d.money === 3 && L.d.day === 3 && L.d.slot === 2, 'old saves: furthest point is loaded', JSON.stringify(L && { m: L.d.money, d: L.d.day, s: L.d.slot }));
check(!Save.get('career0') && !Save.get('career2') && !!Save.get('save1'), 'old keys moved to save1');
const K = Career.loadCheckpoint(1);
check(K && K.d.money === 9, 'old morning checkpoint moved too', JSON.stringify(K && K.d.money));

wipe();
Save.set('career0', legacy({ created: 50, name: '예전', day: 20, money: 1 }));
Save.set('career1', legacy({ created: 100, name: '새로', day: 1, slot: 1, money: 2 }));
L = Career.load(1);
check(L && L.d.name === '새로', 'old saves: a newer career beats an older one with more days', L && L.d.name);

wipe();
Save.set('career2', legacy({ day: 4, slot: 2, injury: 100, money: 1 }));
Save.set('career0', legacy({ day: 4, slot: 0, injury: 40, money: 2 }));
L = Career.load(1);
check(L && L.d.money === 2, 'old saves: a state still able to play beats a retired one', L && String(L.d.money));

wipe();
console.log(fails ? `\n${fails} FAIL` : '\nALL OK');
process.exit(fails ? 1 : 0);
