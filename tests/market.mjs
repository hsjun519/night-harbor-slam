// 상인: prices move day to day within a band and creep up every three days; some goods sell out or come in short;
// a regular gets a discount on some days; a good customer's seller visits the lobby with a gift for the next match;
// 웨이브 상회 opens on day 10. Run: node tests/market.mjs
import { MARKET, price, stock, bought, inflation, loyalToday, marketMorning, visitor, takeGift, waveOpen, waveBooks, marketOf, swing } from '../src/world/market.js';
import { Career } from '../src/world/CareerManager.js';
import { Save } from '../src/core/SaveManager.js';

let fails = 0;
const check = (ok, what, extra = '') => { if (ok) console.log('ok  ', what); else { fails++; console.log('FAIL', what, extra); } };
const D = (season, day, o = {}) => Object.assign({ season, day, flags: {}, buffs: {} }, o);
{
  const ps = []; for (let day = 1; day <= 28; day++) ps.push(swing(D(1, day), 'shop', 'bandage'));
  check(ps.every(k => k >= 1 - MARKET.swing - 1e-9 && k <= 1 + MARKET.swing + 1e-9) && new Set(ps.map(k => k.toFixed(3))).size > 10, `prices move every day, within ±${MARKET.swing * 100}%`, ps.map(k => k.toFixed(2)).join(' '));
  check(price(D(1, 5), 'shop', 'bandage', 9600) === price(D(1, 5), 'shop', 'bandage', 9600), 'the same day, the same price (no rerolling by walking out and in)');
  check(inflation(D(1, 1)) === 1 && inflation(D(1, 3)) === 1 && Math.abs(inflation(D(1, 4)) - 1.02) < 1e-9 && Math.abs(inflation(D(2, 1)) - (1 + MARKET.rise * 9)) < 1e-9, 'everything creeps up 2% every three days, across seasons');
}
{
  let out = 0, short = 0;
  for (let day = 1; day <= 60; day++) { const s = stock(D(1 + Math.floor(day / 28), 1 + day % 28), 'food', '어묵탕'); if (s === 0) out++; else if (s != null) short++; }
  check(out > 0 && short > 0 && out + short < 40, `some days sold out (${out}), some short (${short}), most days plenty`);
  let d = null; for (let day = 1; day <= 60 && !d; day++) { const x = D(1, day); const s = stock(x, 'food', '어묵탕'); if (s && s >= 2) d = x; }
  const s0 = stock(d, 'food', '어묵탕'); bought(d, 'food', '어묵탕');
  check(stock(d, 'food', '어묵탕') === s0 - 1, `a short item counts down as you buy (${s0} → ${s0 - 1})`);
}
{
  const d = D(1, 1); marketOf(d).buys.shop = MARKET.loyal - 1;
  let hits = 0; for (let day = 1; day <= 28; day++) { d.day = day; if (loyalToday(d, 'shop')) hits++; }
  check(hits === 0, 'not a regular yet: no discount');
  marketOf(d).buys.shop = MARKET.loyal; hits = 0;
  for (let day = 1; day <= 28; day++) { d.day = day; if (loyalToday(d, 'shop')) hits++; }
  check(hits > 2 && hits < 20, `a regular gets ${MARKET.loyalCut * 100}% off on some days (${hits} of 28)`);
  d.day = 1; while (!loyalToday(d, 'shop')) d.day++;
  const cut = price(d, 'shop', 'x', 10000) / (10000 * inflation(d) * swing(d, 'shop', 'x'));
  check(Math.abs(cut - (1 - MARKET.loyalCut)) < .02, 'and the discount shows in the price');
}
{
  const d = D(1, 1); marketOf(d).buys.clinic = MARKET.visit;
  let v = null; for (let day = 1; day <= 28 && !v; day++) { d.day = day; marketMorning(d, day - 1); v = visitor(d); }
  check(v && v.id === 'clinic' && v.npc === 'nurse', 'a good customer of the clinic: the nurse comes by the lobby one morning', JSON.stringify(v));
  const g = takeGift(d);
  check(g && d.buffs.guard === .7 && !visitor(d), 'with a gift for the next match (a guard: less injury)');
  d.day++; marketMorning(d, d.day - 1);
  check(!visitor(d), 'not again the very next day');
}
{
  for (const k of ['save2', 'save2.chk']) Save.del(k);
  const look = { build: 'athletic', skin: 'tan', head: { face: 'square', hair: 'side', hairCol: '#222' }, top: { kind: 'none' }, bottom: { kind: 'tights', c1: '#157f8c', c2: '#ffd65a' }, boots: { c1: '#222' } };
  const c = Career.create(2, { name: '파도', style: 'all', look });
  const msgs = []; for (let i = 0; i < 6; i++) msgs.push(...c.sleep());
  check(msgs.filter(m => m.includes('물가가 조금 올랐다')).length === 2, 'the morning says when prices go up (twice in six days)', JSON.stringify(msgs.filter(m => m.includes('물가'))));
  check(!waveOpen(D(1, 9)) && waveOpen(D(1, 10)) && waveOpen(D(2, 1)), '웨이브 상회 opens on day 10 (and from the start of season 2)');
  const books = waveBooks(D(1, 12), ['dawn', 'typhoon']);
  check(books.length === 2 && books.every(b => b.fin !== 'dawn' && b.fin !== 'typhoon'), 'two books of finishers you do not have yet', books.map(b => b.fin).join());
}
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
