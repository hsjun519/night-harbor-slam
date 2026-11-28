// Special matches: ladder, steel cage, hell in a cell, best of three falls, iron man, boss phases.
// Run: node tests/special.mjs
import { MatchManager } from '../src/combat/MatchManager.js';
import { CHARACTERS } from '../src/data/characters.js';
import { BALANCE as B0 } from '../src/data/balance.js';
import { caseIn } from '../src/combat/SpecialRules.js';

let fails = 0;
const log = (...a) => console.log(...a);
function sane(m, tag) {
  for (const f of m.fighters) {
    if (!Number.isFinite(f.x) || !Number.isFinite(f.y)) throw new Error(`${tag}: NaN pos ${f.name} st=${f.st}`);
    for (let i = 0; i < 36; i++) if (!Number.isFinite(f.joints.p[i])) throw new Error(`${tag}: NaN joint ${f.name} st=${f.st}`);
  }
  if (m.faults) throw new Error(`${tag}: ${m.faults} faults`);
}
function run(name, cfg, setup, steps, expect, o = {}) {
  const m = new MatchManager(Object.assign({ mode: 'single', arena: 'hall', seed: 5, skipIntro: true, entrants: [{ char: o.me || 'rookie', ctrl: 'human' }, { char: o.foe || 'dohyun', ctrl: o.foeCtrl || 'dummy', difficulty: o.lv || 'normal', boss: !!o.boss }] }, cfg));
  const h = m.fighters[0], v = m.fighters[1];
  if (v.ai && (o.foeCtrl || 'dummy') === 'dummy') v.ai.behavior = 'idle';
  const ev = {};
  for (const k of ['fall', 'fallReset', 'suddenDeath', 'bossPhase', 'ladderClimb', 'ladderRaise', 'ladderUp', 'ladderFold', 'ladderCross', 'caseHit', 'caseMiss', 'caseHang', 'climbHit', 'legPull', 'climbKick', 'climbDive', 'climbFall', 'pullDown', 'cageClimb', 'cageTop', 'cageEscape', 'cageHit', 'end', 'count']) m.on(k, e => { (ev[k] = ev[k] || []).push(e); });
  let t = 0;
  try {
    for (let i = 0; i < 20; i++) m.update(1 / 60);
    if (setup) setup(m, h, v);
    for (const s of steps) {
      const frames = Math.round((s.t || .1) * 60);
      for (let i = 0; i < frames; i++) {
        const I = h.intent; I.mx = 0; I.up = I.down = I.downEdge = I.jump = I.atk = I.grab = I.dodge = I.fin = false;
        if (typeof s.mx === 'function') I.mx = s.mx(m, h, v); else if (s.mx) I.mx = s.mx;
        if (s.hold) for (const k of s.hold) I[k] = true;
        if (i === 0 && s.press) for (const k of s.press) I[k] = true;
        if (s.fn) s.fn(m, h, v, i, I);
        m.update(1 / 60); t += 1 / 60;
        sane(m, `${name} @${t.toFixed(2)}`);
        if (s.until && s.until(m, h, v)) break;
      }
    }
    const r = expect(m, h, v, ev);
    if (r !== true) throw new Error(typeof r === 'string' ? r : 'expectation failed');
    log(`ok   ${name}  (h=${h.st}/${h.side} | v=${v.st}/${v.side} phase=${m.phase} how=${m.result && m.result.how})`);
  } catch (e) { fails++; log(`FAIL ${name}: ${e.message}  h=${h.st}/${h.side} v=${v.st}`); }
  return m;
}
const AR = new MatchManager({ mode: 'single', arena: 'hall', entrants: [{ char: 'rookie', ctrl: 'human' }, { char: 'dohyun', ctrl: 'dummy' }], skipIntro: true }).arena;

// ---- ladder: folded in the middle, K stands it up, both sides can be climbed, the case takes timing hits that stay with it
const L0 = m => m.special.ladder, P0 = m => m.special.prize;
const toX = x => (m, h) => Math.abs(h.x - x) > 4 ? Math.sign(x - h.x) : 0;
// press K only while the needle is on the green arc of the dial (once per frame at most)
const timing = (m, h, v, i, I) => { const c = h.climb || h.hang, M = c && c.meter; if (M && M.fumble <= 0 && caseIn(M, .01) && !(h.lastPress > m.time - .12)) { I.grab = true; h.lastPress = m.time; } };
const setUp = [{ t: 3, mx: toX(AR.mid - 50), until: (m, h) => Math.abs(h.x - (AR.mid - 50)) <= 5 }, { t: .05, press: ['grab'] }, { t: 1.4, until: m => L0(m).state === 'open' }];
const climbUp = [{ t: 1.5, mx: toX(AR.mid - 30), until: (m, h) => Math.abs(h.x - (AR.mid - 30)) <= 5 }, { t: .05, press: ['jump'] }, { t: 2.5, hold: ['up'], until: (m, h) => h.climb && h.climb.p >= 1 }];
run('ladder: lying folded at the start; K unfolds it, W climbs, ten timing hits take the case', { special: 'ladder' }, (m, h, v) => { h.x = AR.mid - 120; v.x = AR.ropeR - 30; },
  [...setUp, ...climbUp, { t: 20, fn: timing, until: m => m.phase === 'end' }],
  (m, h, v, ev) => (m.phase === 'end' && m.result.how === 'ladder' && m.result.winner === h && P0(m).hits === P0(m).need && (ev.caseHit || []).length === P0(m).need) || `phase=${m.phase} how=${m.result && m.result.how} hits=${P0(m).hits} st=${h.st} L=${L0(m).state}`);
run('ladder: the needle speeds up and the zone narrows with every hit', { special: 'ladder' }, (m, h, v) => { h.x = AR.mid - 120; v.x = AR.ropeR - 30; },
  [...setUp, ...climbUp, { t: 6, fn: (m, h, v, i, I) => { timing(m, h, v, i, I); if (P0(m).hits === 0 && !h.z0) h.z0 = h.climb.meter.z[1] - h.climb.meter.z[0]; }, until: m => P0(m).hits >= 6 }],
  (m, h) => { const M = h.climb.meter, w = M.z[1] - M.z[0]; return (P0(m).hits >= 6 && w < h.z0 - .05) || `hits=${P0(m).hits} w=${w} w0=${h.z0}`; });
run('ladder: the count stays with the case — knocked off at 3, the other one carries on from 3', { special: 'ladder' }, (m, h, v) => { h.x = AR.mid - 120; v.x = AR.ropeR - 30; v.ai = null; v.ctrl = 'human'; },
  [...setUp, ...climbUp, { t: 6, fn: timing, until: m => P0(m).hits >= 3 }, { t: .05, fn: (m, h, v, i) => { if (i === 0) m.special.knockOff(h, v, -1); } }, { t: .3 },
   { t: .05, fn: (m, h, v, i) => { if (i === 0) { v.x = m.special.ladder.x + 30; m.special.ladderClimb(v); v.climb.p = 1; } } }, { t: .6, fn: (m, h, v) => { v.intent.up = true; } }],
  (m, h, v) => (P0(m).hits === 3 && v.st === 'LADDER' && v.climb.p >= 1 && h.st === 'DOWN' && h.downTime >= 3) || `hits=${P0(m).hits} v=${v.st} h=${h.st} down=${h.downTime}`);
run('ladder: folded from below while working the case: left hanging from it, a blow drops them', { special: 'ladder' }, (m, h, v) => { h.x = AR.mid - 120; v.x = AR.ropeR - 30; v.ai = null; v.ctrl = 'human'; },
  [...setUp, ...climbUp, { t: 3, fn: timing, until: m => P0(m).hits >= 1 }, { t: .05, fn: (m, h, v, i) => { if (i === 0) { v.x = m.special.ladder.x + 40; v.set('IDLE', { force: true }); v.fin = 100; m.special.ladderGrab(v); } } }, { t: .4 }],
  (m, h, v, ev) => (h.st === 'CASE_HANG' && (ev.caseHang || []).length === 1 && m.special.ladder.state !== 'open') || `h=${h.st} hang=${(ev.caseHang || []).length} L=${m.special.ladder.state}`);
const both = (ph, pv) => (m, h, v) => { v.ai = null; v.ctrl = 'human'; const L = m.special.ladder; L.state = 'open'; L.k = 1; h.x = L.x - 30; v.x = L.x + 30; m.special.ladderClimb(h); m.special.ladderClimb(v); h.climb.p = ph; v.climb.p = pv; };
run('ladder: a punch level with you slips them a step down and they wobble — still on it', { special: 'ladder' }, both(.6, .62),
  [{ t: .05, press: ['atk'] }, { t: .2 }],
  (m, h, v, ev) => ((ev.climbHit || []).length === 1 && v.st === 'LADDER' && v.climb.p < .62 - B0.ladderPunchSlip + .01 && v.climb.p > .3 && v.climb.rock > 0) || `hits=${(ev.climbHit || []).length} v=${v.st} p=${v.climb && v.climb.p}`);
run('ladder: blow after blow they slip down step by step; the fourth in a row knocks them off', { special: 'ladder' }, both(.6, .62),
  [{ t: .05, press: ['atk'] }, { t: .3 }, { t: .05, press: ['atk'] }, { t: .3 }, { t: .05, press: ['atk'] }, { t: .3, fn: (m, h, v) => { h.p3 = v.climb ? v.climb.p : -1; } }, { t: .05, press: ['atk'] }, { t: .6 }],
  (m, h, v, ev) => ((ev.climbHit || []).length >= 4 && h.p3 > 0 && h.p3 < .45 && v.st === 'DOWN' && (ev.climbFall || []).length === 1 && h.st === 'LADDER') || `hits=${(ev.climbHit || []).length} p3=${h.p3} v=${v.st} falls=${(ev.climbFall || []).length}`);
run('ladder: a strike from the floor slips a climber high up a step; low on it, it takes them off', { special: 'ladder' }, both(.22, .7),
  [{ t: .05, fn: (m, h, v, i) => { if (i === 0) { m.special.struck(v, h, { lv: 2 }, 1); h.pv = v.climb && v.climb.p; m.special.struck(h, v, { lv: 2 }, -1); } } }, { t: .3 }],
  (m, h, v) => (v.st === 'LADDER' && Math.abs(h.pv - (.7 - B0.ladderFloorSlip)) < .02 && h.st === 'DOWN') || `v=${v.st} pv=${h.pv} h=${h.st}`);
run('ladder: folding it takes energy', { special: 'ladder' }, (m, h, v) => { const L = m.special.ladder; L.state = 'open'; L.k = 1; h.x = L.x - 40; h.fin = 0; },
  [{ t: .05, press: ['grab'] }, { t: .4 }, { t: .05, fn: (m, h, v, i) => { if (i === 0) { h.st0 = m.special.ladder.state; h.fin = B0.ladderFoldCost + 10; } } }, { t: .05, press: ['grab'] }, { t: .8 }],
  (m, h, v, ev) => (h.st0 === 'open' && (ev.ladderFold || []).length === 1 && m.special.ladder.state === 'folded' && Math.abs(h.fin - 10) < 1) || `first=${h.st0} folds=${(ev.ladderFold || []).length} L=${m.special.ladder.state} fin=${h.fin}`);
run('ladder: J at the top with the foe right underneath dives onto them', { special: 'ladder' }, (m, h, v) => { const L = m.special.ladder; L.state = 'open'; L.k = 1; h.x = L.x - 30; m.special.ladderClimb(h); h.climb.p = 1; m.special.place(h); v.x = L.x + 4; v.face = -1; },
  [{ t: .05, press: ['atk'] }, { t: .1 }],
  (m, h, v, ev) => ((ev.climbDive || []).length === 1 && !h.climb) || `dives=${(ev.climbDive || []).length} st=${h.st}`);
run('ladder: the computer thrown out of the ring comes back in while you climb (no count out here)', { special: 'ladder' }, (m, h, v) => { const L = m.special.ladder; L.state = 'open'; L.k = 1; h.x = L.x - 30; m.special.ladderClimb(h); h.climb.p = .4; v.ai.behavior = null; v.side = 'out'; v.x = AR.x1 - 30; v.y = AR.floorY; },
  [{ t: 9, fn: (m, h) => { if (h.climb) h.climb.p = Math.min(.95, h.climb.p); }, until: (m, h, v) => v.side === 'in' }],
  (m, h, v) => (v.side === 'in') || `v=${v.st}/${v.side} x=${v.x | 0} goal=${v.ai && v.ai.goal && v.ai.goal.name}`, { foeCtrl: 'ai', lv: 'hard' });
run('ladder: the one below grabs the leg of the one above and pulls them off', { special: 'ladder' }, (m, h, v) => { v.ai = null; v.ctrl = 'human'; const L = m.special.ladder; L.state = 'open'; L.k = 1; h.x = L.x - 30; v.x = L.x + 30; m.special.ladderClimb(h); m.special.ladderClimb(v); h.climb.p = .45; v.climb.p = .85; },
  [{ t: .05, press: ['grab'] }, { t: .5 }],
  (m, h, v, ev) => ((ev.legPull || []).length === 1 && v.st === 'DOWN') || `pull=${(ev.legPull || []).length} v=${v.st}`);
run('ladder: low on it, J kicks a foe standing underneath', { special: 'ladder' }, (m, h, v) => { const L = m.special.ladder; L.state = 'open'; L.k = 1; h.x = L.x - 30; m.special.ladderClimb(h); h.climb.p = .35; m.special.place(h); v.x = h.x - 18; v.face = 1; },
  [{ t: .05, press: ['atk'] }, { t: .4 }],
  (m, h, v, ev) => ((ev.climbKick || []).length === 1 && v.st !== 'IDLE') || `kick=${(ev.climbKick || []).length} v=${v.st}`);
run('ladder: at the top A/D picks the side, S climbs down the other side', { special: 'ladder' }, (m, h, v) => { const L = m.special.ladder; L.state = 'open'; L.k = 1; h.x = L.x - 30; m.special.ladderClimb(h); h.climb.p = 1; v.x = AR.ropeR - 30; },
  [{ t: .1, mx: 1 }, { t: 1.2, hold: ['down'], until: (m, h) => h.st === 'IDLE' }],
  (m, h, v, ev) => (h.st === 'IDLE' && h.x > m.special.ladder.x && (ev.ladderCross || []).length === 1) || `st=${h.st} x=${h.x | 0} lx=${m.special.ladder.x}`);
run('ladder: a dive from the top onto a downed foe hurts far more than from the corner', { special: 'ladder' }, (m, h, v) => { const L = m.special.ladder; L.state = 'open'; L.k = 1; h.x = L.x - 30; m.special.ladderClimb(h); h.climb.p = 1; v.x = L.x - 140; v.set('DOWN', { force: true }); v.downTime = 9; v.hp0 = v.hp; },
  [{ t: .1, mx: -1 }, { t: .05, press: ['atk'] }, { t: 1.6 }],
  (m, h, v) => { const dmg = v.hp0 - v.hp; return (dmg > 13) || `dmg=${dmg.toFixed(1)}`; });
run('ladder: no pins, no KOs', { special: 'ladder' }, null, [{ t: .1 }], m => (m.rules.pin === false && m.rules.ko === false) || 'rules');
for (const lv of ['normal', 'hard']) {
  let cases = 0, done = 0, len = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const m = new MatchManager({ mode: 'single', arena: 'hall', special: 'ladder', seed, skipIntro: true, entrants: [{ char: 'taesan', ctrl: 'ai', difficulty: lv }, { char: 'haneul', ctrl: 'ai', difficulty: lv }] });
    let t = 0; while (m.phase !== 'end' && t < 480) { m.update(1 / 60); t += 1 / 60; }
    if (m.phase === 'end') { done++; len += t; } if (m.result && m.result.how === 'ladder') cases++;
  }
  const ok = cases >= 4; if (!ok) fails++;
  log(`${ok ? 'ok  ' : 'FAIL'} ladder (${lv}): the computer fights over the ladder and takes the case (${cases}/6 by the case, ${done}/6 finished, avg ${(len / Math.max(1, done)).toFixed(0)} s)`);
}
// ---- cage: climb the wall from the mat; punch, kick and pull on the wall; over the top takes a moment; the floored one rallies
run('cage: W at the ropes climbs the wall, over the top after a moment: win by escape', { special: 'cage' }, (m, h, v) => { h.x = AR.ropeR - 24; h.face = 1; v.x = AR.ropeL + 60; },
  [{ t: .05, press: ['jump'], mx: 1 }, { t: 10, hold: ['up'], until: m => m.phase === 'end' }],
  (m, h, v, ev) => (m.phase === 'end' && m.result.how === 'escape' && m.result.winner === h && (ev.cageClimb || []).length === 1 && (ev.cageTop || []).length === 1 && m.time > B0.cageClimb) || `phase=${m.phase} how=${m.result && m.result.how} st=${h.st}`);
run('cage: K under a low climber pulls them down; they stay down a long while', { special: 'cage' }, (m, h, v) => { v.ai = null; v.ctrl = 'human'; v.x = AR.ropeR - 20; v.face = 1; m.special.cageClimbStart(v, { mx: 1 }); v.climb.p = .3; h.x = AR.ropeR - 50; h.face = 1; },
  [{ t: .1, fn: (m, h, v) => { v.intent.up = true; } }, { t: .05, press: ['grab'] }, { t: 1 }],
  (m, h, v, ev) => ((ev.pullDown || []).length === 1 && v.st === 'DOWN' && v.downTime > 2) || `pull=${(ev.pullDown || []).length} v=${v.st} down=${v.downTime}`);
run('cage: two on one wall — the lower one grabs the leg of the higher one', { special: 'cage' }, (m, h, v) => { v.ai = null; v.ctrl = 'human'; h.x = AR.ropeR - 20; v.x = AR.ropeR - 20; h.face = v.face = 1; m.special.cageClimbStart(v, { mx: 1 }); m.special.cageClimbStart(h, { mx: 1 }); v.climb.p = .75; h.climb.p = .45; },
  [{ t: .05, press: ['grab'] }, { t: .5 }],
  (m, h, v, ev) => ((ev.legPull || []).length === 1 && v.st === 'DOWN' && h.st === 'CAGE_CLIMB') || `pull=${(ev.legPull || []).length} v=${v.st} h=${h.st}`);
run('cage: the one knocked down gets up sooner while the other one is getting away', { special: 'cage' }, (m, h, v) => { v.ai = null; v.ctrl = 'human'; v.set('DOWN', { force: true }); v.downTime = 4; v.downClock = 0; h.x = AR.ropeR - 20; h.face = 1; m.special.cageClimbStart(h, { mx: 1 }); h.climb.p = .5; },
  [{ t: 1, hold: ['up'] }],
  (m, h, v) => (v.downClock > 1.4) || `clock=${v.downClock}`);
run('cage: nobody is counted out and nobody goes over the top', { special: 'cage' }, (m, h, v) => { v.x = AR.ropeR - 20; v.hp = 1; },
  [{ t: .05, fn: m => m.combat.launch(m.fighters[1], 420, -300, 3, m.fighters[0]) }, { t: 3 }],
  (m, h, v) => (v.side === 'in' && m.rules.ringOut === 'none' && m.rules.leave === false) || `side=${v.side}`);
{
  let ends = {}, n = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const m = new MatchManager({ mode: 'single', arena: 'hall', special: 'cage', seed, skipIntro: true, entrants: [{ char: 'taesan', ctrl: 'ai', difficulty: 'hard' }, { char: 'haneul', ctrl: 'ai', difficulty: 'hard' }] });
    let t = 0; while (m.phase !== 'end' && t < 480) { m.update(1 / 60); t += 1 / 60; }
    if (m.phase === 'end') { n++; ends[m.result.how] = (ends[m.result.how] || 0) + 1; }
  }
  const ok = n >= 5; if (!ok) fails++;
  log(`${ok ? 'ok  ' : 'FAIL'} cage: the computer fights it out on the walls (${n}/6 finished ${JSON.stringify(ends)})`);
}
// ---- cell
run('hell in a cell: outside the ring as long as you like, no count', { special: 'cell' }, (m, h, v) => { h.x = AR.x0 + 40; h.side = 'out'; h.y = AR.floorY; v.x = AR.x1 - 40; v.side = 'out'; v.y = AR.floorY; },
  [{ t: 14 }],
  (m, h, v, ev) => (m.phase === 'fight' && !(ev.count || []).some(e => e.out)) || `phase=${m.phase} counts=${(ev.count || []).length}`);
run('hell in a cell: the computer out on the floor comes back in to the one in the ring', { special: 'cell' }, (m, h, v) => { h.x = AR.mid; v.ai.behavior = null; v.side = 'out'; v.x = AR.x1 - 40; v.y = AR.floorY; },
  [{ t: 10, until: (m, h, v) => v.side === 'in' }],
  (m, h, v) => (v.side === 'in') || `v=${v.st}/${v.side} goal=${v.ai && v.ai.goal && v.ai.goal.name}`, { foeCtrl: 'ai', lv: 'normal' });
// ---- falls
const koFoe = (m, h, v) => { v.hp = 0; m.knockOut(v, h, 100, -100, 1); };
run('best of three falls: the first KO is a fall, the match goes on; the second wins it', { falls: 2 }, null,
  [{ t: .05, fn: (m, h, v, i) => { if (i === 0) koFoe(m, h, v); } }, { t: 3.5, until: m => m.phase === 'fight' && m.special.score[0] === 1 && m.time > 2 }, { t: .3 }, { t: .05, fn: (m, h, v, i) => { if (i === 0) koFoe(m, h, v); } }, { t: 1 }],
  (m, h, v, ev) => (m.phase === 'end' && (ev.fall || []).length === 2 && m.result.winner === h && m.result.score[0] === 2) || `phase=${m.phase} falls=${(ev.fall || []).length} score=${JSON.stringify(m.result && m.result.score)}`);
run('after a fall both start again on their feet, the match clock waits', { falls: 2 }, null,
  [{ t: .05, fn: (m, h, v, i) => { if (i === 0) koFoe(m, h, v); } }, { t: 1 }],
  (m, h, v) => (m.phase === 'ready' && v.alive && v.st === 'IDLE' && h.st === 'IDLE' && v.hp > 0) || `phase=${m.phase} v=${v.st} hp=${v.hp}`);
run('iron man: time up with 1:0 wins on falls', { iron: 30 }, null,
  [{ t: .05, fn: (m, h, v, i) => { if (i === 0) koFoe(m, h, v); } }, { t: 40, until: m => m.phase === 'end' }],
  (m, h) => (m.phase === 'end' && m.result.how === 'iron' && m.result.winner === h) || `phase=${m.phase} how=${m.result && m.result.how}`);
run('iron man: level at the bell goes to sudden death, the next fall ends it', { iron: 20 }, null,
  [{ t: 24, until: m => m.special.sudden }, { t: .5 }, { t: .05, fn: (m, h, v, i) => { if (i === 0) koFoe(m, h, v); } }, { t: 1 }],
  (m, h, v, ev) => ((ev.suddenDeath || []).length === 1 && m.phase === 'end' && m.result.winner === h) || `sudden=${(ev.suddenDeath || []).length} phase=${m.phase}`);
// ---- boss phases
run('boss: a lost fall and a kick-out each raise the phase (max 3), the boss hits harder', { falls: 3, bossPhases: true }, (m, h, v) => { v.atk0 = v.stats.atk; },
  [{ t: .05, fn: (m, h, v, i) => { if (i === 0) koFoe(m, h, v); } }, { t: 3.5, until: m => m.phase === 'fight' && m.time > 2.5 }, { t: .05, fn: (m, h, v, i) => { if (i === 0) { v.set('DOWN', { force: true }); v.dropRag(); m.startPin(h, v); m.pin.kick = m.pin.need; } } }, { t: .5 }],
  (m, h, v, ev) => (v.bossPhase === 3 && (ev.bossPhase || []).length === 2 && v.stats.atk > v.atk0 * 1.2) || `phase=${v.bossPhase} ev=${(ev.bossPhase || []).length} atk=${v.stats.atk}/${v.atk0}`, { boss: true });
run('boss by health: 70% and 35% mark the phases', { bossPhases: { by: ['hp'], max: 3 } }, null,
  [{ t: .05, fn: (m, h, v, i) => { if (i === 0) v.hp = v.maxHp * .6; } }, { t: .2 }, { t: .05, fn: (m, h, v, i) => { if (i === 0) v.hp = v.maxHp * .3; } }, { t: .2 }],
  (m, h, v, ev) => (v.bossPhase === 3 && (ev.bossPhase || []).length === 2) || `phase=${v.bossPhase}`, { boss: true });
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
void CHARACTERS;
