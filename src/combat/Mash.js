// Mashing to get free: out of a tie-up, off the shoulders, out of a hold on the mat, out of a pin. One key, J. Against
// a stronger foe, a boss, or after a big move, the key to press jumps to K or L now and then without warning, and a
// wrong key costs a little: being up on somebody's shoulders for an electric chair is the hardest of all.
// Getting up, getting down off a corner and the like count J only, with no surprises.
import { BALANCE as B } from '../data/balance.js';
import { clamp } from '../core/util.js';

export const MASH_KEYS = ['atk', 'grab', 'dodge'];   // J K L
// how hard a hold is to read, 0 (J the whole way) .. 1 (the key jumps about every half second)
//   o.carry: up on the shoulders · o.big: a big move or a finisher behind it (the pin after it, its hold)
export function holdStrength(a, v, o = {}) {
  if (!a || !v) return 0;
  const size = clamp(a.maxHp / Math.max(1, v.maxHp) - .95, 0, .6);
  return clamp(size + (a.boss ? B.mashBoss : 0) + (o.big ? B.mashBig : 0) + (o.carry ? B.mashCarry : 0) + (a.char && a.char.champion ? .15 : 0), 0, 1);
}
// one frame of mashing for f: the presses that count (the right key +1, a wrong one -B.mashWrong)
export function mash(f, dt, strength = 0) {
  const m = f.match, now = m.time;
  let M = f.mash;
  if (!M || now - M.last > .5) M = f.mash = { key: 'atk', t: B.mashFirst * (1 - .6 * strength), n: 0, flash: 0, last: now, strength };
  M.last = now; M.strength = strength; M.flash = Math.max(0, M.flash - dt);
  if (strength >= B.mashShiftFrom) {
    M.t -= dt;
    if (M.t <= 0) {
      M.t = (B.mashShiftSlow + (B.mashShiftFast - B.mashShiftSlow) * strength) * (.7 + m.rng.next() * .6);
      const others = MASH_KEYS.filter(k => k !== M.key);
      M.key = others[Math.floor(m.rng.next() * others.length) % others.length]; M.flash = .4; M.n++;
      m.emit('mashKey', { f, key: M.key });
    }
  } else if (M.key !== 'atk') { M.key = 'atk'; M.t = B.mashFirst; }
  let n = 0;
  const wrong = f.ctrl === 'human' ? B.mashWrong : 0;   // the computer's slips just do not count
  for (const k of MASH_KEYS) if (f.buf[k] >= B.inputBuffer - 1e-6) n += k === M.key ? 1 : -wrong;
  return n;
}
// a strong hold also takes longer to break, whoever is mashing
export const holdGrip = s => 1 - B.mashHard * s;
// what the computer manages against the same hold (it reads the key a beat late after it changes)
export const aiMashK = f => (f.mash && f.mash.flash > 0 ? .35 : 1) * (1 - .25 * (f.mash ? f.mash.strength || 0 : 0));
// J only: getting up, off a corner, off the ropes
export const mashJ = f => (f.buf.atk >= B.inputBuffer - 1e-6 ? 1 : 0);
