// Move mastery and evolution: landed uses are counted per move (a finisher once), levels add damage, and at MAX
// bulldog / suplex / body slam / German grow into their bigger versions, learned and swapped into the slots.
// The evolved moves play cleanly, stay inside the ropes and hit harder than a fully mastered original.
// Run: node tests/mastery.mjs
import { MatchManager } from '../src/combat/MatchManager.js';
import { MOVES, FINISHERS } from '../src/data/moves.js';
import { MASTERY, EVOLVE, MAX_LV, masteryLv } from '../src/data/mastery.js';
import { Career } from '../src/world/CareerManager.js';
import { Save } from '../src/core/SaveManager.js';

let fails = 0;
const check = (ok, what, extra = '') => { if (ok) console.log('ok  ', what); else { fails++; console.log('FAIL', what, extra); } };
function sane(m, tag) {
  for (const f of m.fighters) {
    if (!Number.isFinite(f.x) || !Number.isFinite(f.y)) throw new Error(`${tag}: NaN pos ${f.name} st=${f.st}`);
    for (let i = 0; i < 36; i++) if (!Number.isFinite(f.joints.p[i])) throw new Error(`${tag}: NaN joint ${f.name} st=${f.st}`);
  }
  if (m.faults) throw new Error(`${tag}: ${m.faults} faults`);
}
// one move on a standing dummy; o.at: start x, o.face, o.mastery, o.mode, o.press(m, h, v, t)
function moveOnce(id, o = {}) {
  const m = new MatchManager({ mode: o.mode || 'single', arena: 'hall', seed: 3, skipIntro: true, entrants: [{ char: 'rookie', ctrl: 'human', mastery: o.mastery || null }, { char: o.foe || 'dohyun', ctrl: 'dummy' }] });
  const h = m.fighters[0], v = m.fighters[1], mv = MOVES[id] || null, F = o.fin ? FINISHERS[o.fin] : null;
  if (v.ai) v.ai.behavior = 'idle';
  for (let i = 0; i < 20; i++) m.update(1 / 60);
  const face = o.face || 1, rear = mv && mv.pos === 'rear';
  h.face = face; h.x = o.at != null ? o.at : 400; v.x = h.x + face * (rear ? 18 : 24); v.face = rear ? face : -face;
  if (o.setup) o.setup(m, h, v);
  const hp0 = v.hp, ar = m.arena;
  const ok = F ? m.finisher.connect(h, v, F, false) : m.wrestle.start(h, v, id, { noReverse: true });
  let t = 0, out = 0, released = null;
  const dur = F ? F.parts.reduce((s, p) => s + MOVES[p].dur, 0) : mv.dur;
  while (t < dur + 1.4) {
    if (o.press) o.press(m, h, v, t);
    m.update(1 / 60); t += 1 / 60; sane(m, id || o.fin);
    const px = v.joints.x(0);
    if (ar.hasRing && (px < ar.ropeL - 6 || px > ar.ropeR + 6)) out++;
    if (!released && !v.link && h.st !== 'WRESTLING_MOVE' && t > .2) released = { vFace: v.face, hFace: h.face, ahead: Math.sign(v.x - h.x) };
  }
  return { m, h, v, ok, dmg: hp0 - v.hp, uses: Object.assign({}, h.moveUses), out, released, sum: m.summary()[0] };
}

// ---- the evolved moves themselves
for (const [from, to] of Object.entries(EVOLVE)) {
  const a = moveOnce(from, { mastery: { [from]: MAX_LV * MASTERY.bonus } }), b = moveOnce(to);
  check(b.ok && b.dmg > 0 && b.out === 0, `${MOVES[to].name}: plays cleanly inside the ring (damage ${b.dmg.toFixed(1)})`, JSON.stringify({ ok: b.ok, dmg: b.dmg, out: b.out }));
  check(b.dmg > a.dmg * 1.08, `${MOVES[to].name} hits harder than ${MOVES[from].name} at MAX (${b.dmg.toFixed(1)} > ${a.dmg.toFixed(1)})`);
  const near = moveOnce(to, { at: 600, face: 1 });   // started next to the ropes: the pair slides back first
  check(near.ok && near.out === 0, `${MOVES[to].name} started by the ropes stays inside`, 'frames outside ' + near.out);
  const left = moveOnce(to, { at: 240, face: -1 });
  check(left.ok && left.out === 0 && left.dmg > 0, `${MOVES[to].name} facing left`, JSON.stringify({ out: left.out, dmg: left.dmg }));
}
{
  const r = moveOnce('f5');
  check(r.released && r.released.vFace === r.released.hFace && r.released.ahead === r.released.hFace, 'F5: spun half way round, the foe lands face down in front, facing away', JSON.stringify(r.released));
}
// ---- damage bonus and counting
{
  const a = moveOnce('bodySlam'), b = moveOnce('bodySlam', { mastery: { bodySlam: .09 } });
  const k = b.dmg / a.dmg;
  check(Math.abs(k - 1.09) < .02, `mastery Lv3 adds 9% damage (x${k.toFixed(3)})`);
  check(a.uses.bodySlam === 1 && a.sum.uses.bodySlam === 1, 'a landed body slam counts one use, and the summary carries it', JSON.stringify(a.sum.uses));
  const f = moveOnce(null, { fin: 'anchor' });
  check(f.ok && f.uses['fin:anchor'] === 1 && !f.uses.fAnchor1, 'a three-part finisher counts once, under its own name', JSON.stringify(f.uses));
  const g = moveOnce('german', { press: (m, h, v, t) => { if (t > .05 && t < .08) { h.intent.grab = true; } else h.intent.grab = false; } });
  check(g.uses.german >= 1, 'a German that turns into 연속 저먼 still counts', JSON.stringify(g.uses));
}
// ---- power slam: S during it covers straight away
{
  const r = moveOnce('powerSlam', { mode: 'pin', press: (m, h, v, t) => { const on = t > .92 && t < .95; h.intent.down = on; h.intent.downEdge = on; } });
  check(!!(r.m.pin || r.m.result), 'power slam: S covers straight out of it', JSON.stringify({ pin: !!r.m.pin, st: [r.h.st, r.v.st] }));
}
// ---- slammed onto a chair lying on the mat: the chair breaks, the move does twice the damage
for (const [id, dx] of [['suplex', -40], ['german', -36], ['bodySlam', 40]]) {
  let slams = 0;
  const plain = moveOnce(id), onChair = moveOnce(id, { setup: (m, h, v) => { m.props.spawn(h.x + dx, 0, { side: 'in', state: 'floor' }); m.on('chairSlam', () => slams++); } });
  const k = onChair.dmg / plain.dmg, left = onChair.m.props.list.filter(p => !p.gone).length;
  check(slams === 1 && Math.abs(k - 2) < .05 && left === 0, `${MOVES[id].name} onto a chair: it breaks and the damage doubles (x${k.toFixed(2)})`, JSON.stringify({ slams, left }));
}
{
  const far = moveOnce('suplex', { setup: (m, h) => { m.props.spawn(h.x + 150, 0, { side: 'in', state: 'floor' }); } });
  check(far.m.props.list.filter(p => !p.gone).length === 1, 'a chair that is not under the body stays whole');
}
// ---- career: experience, levels, the cap, evolution
{
  for (const k of ['save1', 'save1.chk']) Save.del(k);
  const look = { build: 'athletic', skin: 'tan', head: { face: 'square', hair: 'side', hairCol: '#222' }, top: { kind: 'none' }, bottom: { kind: 'tights', c1: '#157f8c', c2: '#ffd65a' }, boots: { c1: '#222' } };
  const c = Career.create(1, { name: '파도', style: 'all', look });
  check(c.d.moves.rear.d === 'bulldog' && c.d.moves.front.b === 'suplex', 'the all-rounder starts with bulldog and suplex');
  let g = c.gainMastery({ bulldog: 9, suplex: 1 });
  check(c.d.mastery.bulldog === MASTERY.cap * MASTERY.use && c.d.mastery.suplex === MASTERY.use, `at most ${MASTERY.cap} uses a match count`, JSON.stringify(c.d.mastery));
  check(g.ups.some(u => u.k === 'bulldog' && u.lv === 1), 'bulldog went up to Lv1', JSON.stringify(g.ups));
  g = c.gainMastery({ suplex: 4 }, MASTERY.practice);
  check(c.d.mastery.suplex === MASTERY.use + 20, 'sparring counts half', String(c.d.mastery.suplex));
  for (let i = 0; i < 3; i++) g = c.gainMastery({ bulldog: 4 });
  check(masteryLv(c.d.mastery.bulldog) === 4 && !g.evolved.length, 'Lv4 is not yet MAX', String(c.d.mastery.bulldog));
  g = c.gainMastery({ bulldog: 4 });
  check(g.evolved.length === 1 && g.evolved[0].to === 'runningBulldog', 'MAX: bulldog evolves', JSON.stringify(g.evolved));
  check(c.d.known.includes('runningBulldog') && c.d.known.includes('bulldog') && c.d.moves.rear.d === 'runningBulldog', 'the evolved move is learned and takes the slot; the old one stays learned', JSON.stringify(c.d.moves.rear));
  g = c.gainMastery({ bulldog: 4 });
  check(!g.evolved.length && c.d.known.filter(x => x === 'runningBulldog').length === 1, 'it evolves only once');
  const e = c.entrant();
  check(Math.abs(e.mastery.bulldog - .15) < 1e-9 && !e.mastery.runningBulldog, 'the match entrant carries the damage bonus per move', JSON.stringify(e.mastery));
  // a career match result: the summary's uses reach the career
  const res = { human: { dmgTaken: 10, finishersTaken: 0, ko: false, ringOuts: 0, moves: 2, counters: 0, uses: { german: 2, 'fin:dawn': 1 } }, won: true, draw: false, result: { how: 'pin', winner: null } };
  const out = c.applyResult('brawl', res, {});
  check(out.mastery && out.mastery.gains.length === 2 && c.d.mastery.german === 20 && c.d.mastery['fin:dawn'] === 10, 'a career match adds its uses', JSON.stringify(out.mastery && out.mastery.gains));
  const L = Career.load(1);
  check(L.d.mastery.german === 20 && L.d.moves.rear.d === 'runningBulldog', 'mastery and the evolved slot are saved', JSON.stringify(L.d.mastery));
}
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
