// Headless AI-vs-AI matches. Checks that matches finish and nothing breaks: no NaN, no illegal states,
// no stuck bodies, everybody inside the hall. Run: node tests/sim.mjs [games] [mode]
import { MatchManager } from '../src/combat/MatchManager.js';
import { ROSTER_IDS } from '../src/data/characters.js';
import { STATES } from '../src/combat/StateMachine.js';

const games = +(process.argv[2] || 24), onlyMode = process.argv[3];
const levels = ['easy', 'normal', 'hard', 'expert'];
const ids = ROSTER_IDS.concat(['rookie']);
let fails = 0;
const stats = { ko: 0, pin: 0, countout: 0, decision: 0, draw: 0, ringout: 0, timeouts: 0, len: 0, n: 0, finishers: 0, moves: 0, reversals: 0, counters: 0, downs: 0, refused: 0, faults: 0, wins: {} };
function entrants(mode, seed) {
  const pick = k => ids[(seed * 7 + k * 5) % ids.length];
  const lv = k => levels[(seed + k) % 4];
  const n = mode === 'rumble' ? 6 : mode === 'royal' ? 4 : mode === 'tag' ? 4 : 2;
  return Array.from({ length: n }, (_, k) => ({ char: pick(k), ctrl: 'ai', difficulty: lv(k) }));
}
const modes = onlyMode ? [onlyMode] : ['single', 'single', 'pin', 'tag', 'royal', 'rumble'];
for (let g = 0; g < games; g++) {
  const mode = modes[g % modes.length];
  const E = entrants(mode, g + 1);
  const m = new MatchManager({ mode, arena: 'hall', entrants: E, seed: 1000 + g, skipIntro: true });
  let stuck = new Map(), err = null, frames = 0;
  m.on('finisherHit', () => stats.finishers++); m.on('moveStart', () => stats.moves++); m.on('reversal', () => stats.reversals++); m.on('counter', () => stats.counters++); m.on('down', () => stats.downs++);
  const cap = mode === 'rumble' ? 600 : 420;
  try {
    for (; frames < cap * 60 && m.phase !== 'end'; frames++) {
      m.update(1 / 60);
      for (const f of m.fighters) {
        if (!Number.isFinite(f.x) || !Number.isFinite(f.y) || !Number.isFinite(f.hp)) throw new Error('NaN on ' + f.name + ' in ' + f.st);
        for (let i = 0; i < 36; i++) if (!Number.isFinite(f.joints.p[i])) throw new Error('NaN joint on ' + f.name + ' in ' + f.st + ' clip ' + f.clipName);
        if (!STATES[f.st]) throw new Error('bad state ' + f.st);
        if (f.x < m.arena.x0 || f.x > m.arena.x1) throw new Error('outside hall ' + f.name + ' x=' + f.x);
        if (f.link && f.st !== 'GRAB' && f.st !== 'GRABBED' && f.st !== 'WRESTLING_MOVE' && f.st !== 'COUNTER' && f.st !== 'FINISHER') throw new Error('link in state ' + f.st + ' ' + f.name);
        // same state for too long?
        const key = f.st + (f.st === 'IDLE' || f.st === 'MOVE' || f.st === 'KO' || f.st === 'OUT' || f.st === 'TAGWAIT' || f.st === 'GUARD' ? '' : '');
        const s = stuck.get(f) || { k: '', t: 0 };
        if (s.k === key) s.t += 1 / 60; else { s.k = key; s.t = 0; }
        stuck.set(f, s);
        const free = ['IDLE', 'MOVE', 'KO', 'OUT', 'TAGWAIT', 'GUARD', 'HANG'];
        if (!free.includes(f.st) && s.t > 12) throw new Error('stuck ' + f.name + ' in ' + f.st + ' for 12s');
      }
    }
  } catch (e) { err = e; }
  const r = m.result;
  stats.n++; stats.len += m.clock; stats.refused += m.fighters.reduce((s, f) => s + f.fsm.refused, 0); stats.faults += m.faults;
  if (err) { fails++; console.log(`#${g} ${mode} ERROR at ${m.clock.toFixed(1)}s: ${err.message}\n${err.stack.split('\n').slice(1, 4).join('\n')}`); continue; }
  if (!r) { stats.timeouts++; console.log(`#${g} ${mode} no result after ${m.clock.toFixed(0)}s: ` + m.fighters.map(f => `${f.name}(${f.difficulty}) ${f.st} hp${f.hp | 0} out${f.eliminated ? 1 : 0}`).join(', ')); continue; }
  if (r.draw) stats.draw++; else { stats[r.how] = (stats[r.how] || 0) + 1; const w = r.winner; stats.wins[w.charId] = (stats.wins[w.charId] || 0) + 1; }
  const refusals = m.fighters.flatMap(f => f.fsm.log).slice(-4);
  console.log(`#${g} ${mode.padEnd(6)} ${m.clock.toFixed(0).padStart(3)}s ${r.draw ? 'DRAW ' + r.how : (r.winner.name + '(' + r.winner.difficulty + ') ' + r.how)} | ` + m.fighters.map(f => `${f.name}:${f.difficulty[0]} hp${f.hp | 0} d${f.downs}`).join(' ') + (refusals.length ? '  refused:' + refusals.join(',') : ''));
}
console.log('\nsummary', JSON.stringify({ ...stats, avgLen: +(stats.len / stats.n).toFixed(1) }), fails ? `FAILS ${fails}` : 'OK');
process.exitCode = fails ? 1 : 0;
