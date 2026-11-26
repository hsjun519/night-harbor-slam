// Scripted human inputs against a dummy: checks punches, grabs, every grapple slot, ropes, corners and pins
// for NaN, stuck states and illegal transitions. Run: node tests/scripted.mjs
import { MatchManager } from '../src/combat/MatchManager.js';
import { ROSTER_IDS } from '../src/data/characters.js';

let fails = 0;
const log = (...a) => console.log(...a);
function check(m, tag) {
  for (const f of m.fighters) {
    if (!Number.isFinite(f.x) || !Number.isFinite(f.y)) throw new Error(`${tag}: NaN pos ${f.name} st=${f.st}`);
    for (let i = 0; i < 36; i++) if (!Number.isFinite(f.joints.p[i])) throw new Error(`${tag}: NaN joint ${i} ${f.name} st=${f.st} rag=${!!f.rag} link=${f.link && f.link.kind}`);
  }
  if (m.faults) throw new Error(`${tag}: ${m.faults} faults`);
}
function run(name, me, foe, script, o = {}) {
  const m = new MatchManager({ mode: o.mode || 'single', arena: 'hall', entrants: [{ char: me, ctrl: 'human' }, { char: foe, ctrl: 'dummy' }], seed: 7, skipIntro: true, practice: o.practice });
  const h = m.fighters[0], v = m.fighters[1];
  v.ai.behavior = o.behavior || 'idle';
  const I = h.intent;
  let t = 0;
  try {
    for (const step of script) {
      const frames = Math.round((step.t || .1) * 60);
      for (let i = 0; i < frames; i++) {
        I.mx = 0; I.up = I.down = I.downEdge = I.jump = I.atk = I.grab = I.dodge = I.fin = false;
        const d = v.x - h.x;
        if (step.mx === 'to') I.mx = Math.abs(d) > (step.near || 34) ? Math.sign(d) : 0; else if (step.mx) I.mx = step.mx;
        if (step.hold) for (const k of step.hold) I[k] = true;
        if (i === 0 && step.press) for (const k of step.press) I[k] = true;
        if (step.rate && i % step.rate === 0 && step.tap) for (const k of step.tap) I[k] = true;
        if (step.fn) step.fn(m, h, v, i);
        m.update(1 / 60); t += 1 / 60;
        check(m, `${name} @${t.toFixed(2)}s`);
      }
      if (step.expect) { const ok = step.expect(m, h, v); if (!ok) throw new Error(`${name}: expectation failed after step ${JSON.stringify(Object.keys(step))} h=${h.st} v=${v.st}`); }
    }
    log(`ok   ${name}: h=${h.st} hp${h.hp | 0} | v=${v.st} hp${v.hp | 0} stun${v.stun | 0} downs${v.downs} refused=${h.fsm.refused + v.fsm.refused}${h.fsm.log.length ? ' ' + h.fsm.log.slice(-3) : ''}`);
  } catch (e) { fails++; log(`FAIL ${name}: ${e.message}`); }
  return m;
}
const punchDown = [{ t: .9, mx: 'to' }, { t: 6, mx: 'to', near: 30, tap: ['atk'], rate: 9 }];
const slots = [['n', {}], ['f', { fwd: 1 }], ['b', { back: 1 }], ['u', { up: 1 }], ['d', { down: 1 }]];
for (const me of ['rookie', 'taesan', 'haneul', 'mandeok', 'bokja']) {
  run(`${me} punches`, me, 'dohyun', [...punchDown, { t: .1, expect: (m, h, v) => v.downs >= 1 }]);
  for (const pos of ['front', 'rear']) for (const [slot, dir] of slots) {
    run(`${me} ${pos} ${slot}`, me, 'dohyun', [...punchDown, { t: 1.2, mx: 'to', near: 30 }, { t: .5, press: ['grab'] },
      ...(pos === 'rear' ? [{ t: .35, press: ['dodge'] }] : []),
      { t: .1, fn: (m, h) => { const I = h.intent; if (dir.fwd) I.mx = h.face; if (dir.back) I.mx = -h.face; if (dir.up) I.up = true; if (dir.down) I.down = true; I.grab = true; } },
      { t: 4.5 }, { t: .1, expect: (m, h) => !h.link }]);
  }
}
// air, running, ropes, corner dives
run('dropkick', 'rookie', 'taesan', [{ t: .5, mx: 'to', near: 110 }, { t: .05, press: ['jump'] }, { t: .2, mx: 1 }, { t: .05, press: ['atk'] }, { t: 2 }]);
run('rope run', 'haneul', 'taesan', [{ t: 2.5, mx: -1 }, { t: .8, mx: 1 }, { t: .05, press: ['atk'] }, { t: 2 }]);
run('corner dive', 'haneul', 'taesan', [...punchDown, { t: 2.5, mx: -1 }, { t: .05, mx: -1, press: ['jump'] }, { t: .8 }, { t: .05, press: ['atk'] }, { t: 3 }]);
run('finisher full', 'rookie', 'dohyun', [{ t: .1, fn: (m, h) => { h.fin = 100; } }, ...punchDown, { t: 1.2, mx: 'to', near: 30 }, { t: .5, press: ['grab'] }, { t: .1, press: ['fin'] }, { t: 5 }, { t: .1, expect: (m, h, v) => v.finishersTaken >= 1 || v.st === 'KO' }]);
run('finisher standing', 'bokja', 'dohyun', [{ t: .1, fn: (m, h) => { h.fin = 100; } }, { t: .9, mx: 'to', near: 40 }, { t: .1, press: ['fin'] }, { t: 5 }]);
for (const id of ROSTER_IDS) run(`finisher ${id}`, id, 'dohyun', [{ t: .1, fn: (m, h) => { h.fin = 100; } }, ...punchDown, { t: 1.2, mx: 'to', near: 30 }, { t: .5, press: ['grab'] }, { t: .1, press: ['fin'] }, { t: 6 }]);
run('pin', 'rookie', 'dohyun', [...punchDown, { t: .1, fn: (m, h, v) => { v.hp = 2; } }, { t: 1.2, mx: 'to', near: 40 }, { t: .1, press: ['downEdge'], hold: ['down'] }, { t: 4 }], { mode: 'pin' });
run('guard vs dummy attack', 'rookie', 'bokja', [{ t: .8, mx: 'to', near: 36 }, { t: 3, hold: ['down'] }], { behavior: 'attack' });
run('dodge counter', 'dohyun', 'bokja', [{ t: .8, mx: 'to', near: 36 }, { t: 3, tap: ['dodge'], rate: 20 }], { behavior: 'attack' });
run('burst', 'rookie', 'taesan', [{ t: .1, fn: (m, h) => { h.fin = 60; } }, { t: .8, mx: 'to', near: 36 }, { t: 1.5 }, { t: .05, hold: ['down'], press: ['dodge'] }, { t: 1 }], { behavior: 'attack' });
run('exit ring', 'rookie', 'taesan', [{ t: 3, mx: -1 }, { t: .6, hold: ['down'], mx: -1 }, { t: 1 }, { t: .05, press: ['jump'] }, { t: 1.5 }]);
console.log(fails ? `FAILS ${fails}` : 'ALL OK');
process.exitCode = fails ? 1 : 0;
