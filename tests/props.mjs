// Chairs, run-ins and the corner dive over the top rope, driven by scripted inputs.
// Run: node tests/props.mjs
import { MatchManager } from '../src/combat/MatchManager.js';

let fails = 0;
const log = (...a) => console.log(...a);
function sane(m, tag) {
  for (const f of m.fighters) {
    if (!Number.isFinite(f.x) || !Number.isFinite(f.y)) throw new Error(`${tag}: NaN pos ${f.name} st=${f.st}`);
    for (let i = 0; i < 36; i++) if (!Number.isFinite(f.joints.p[i])) throw new Error(`${tag}: NaN joint ${f.name} st=${f.st}`);
  }
  for (const p of m.props.list) if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error(`${tag}: NaN chair`);
  if (m.faults) throw new Error(`${tag}: ${m.faults} faults`);
}
// steps: { t, mx, hold:[], press:[], fn(m,h,v,i), until(m,h,v) } ; final expect(m,h,v,ev)
function run(name, cfg, steps, expect, o = {}) {
  const m = new MatchManager(Object.assign({ mode: 'single', arena: 'hall', seed: 11, skipIntro: true, entrants: [{ char: o.me || 'rookie', ctrl: 'human' }, { char: o.foe || 'dohyun', ctrl: o.foeCtrl || 'dummy', difficulty: 'normal' }] }, cfg));
  const h = m.fighters[0], v = m.fighters[1];
  if (v.ai && (o.foeCtrl || 'dummy') === 'dummy') v.ai.behavior = o.behavior || 'idle';
  const ev = {};
  for (const k of ['parry', 'propSnatch', 'propReach', 'chairShrug', 'chairHit', 'propPick', 'propCatch', 'propSteal', 'propThrow', 'chairBreak', 'dive', 'perchDeny', 'cameoIn', 'cameoThrow', 'swing', 'down', 'eliminated', 'deny', 'moveStart', 'dashStart', 'dashSig']) m.on(k, e => { (ev[k] = ev[k] || []).push(e); });
  let t = 0;
  try {
    for (const s of steps) {
      const frames = Math.round((s.t || .1) * 60);
      for (let i = 0; i < frames; i++) {
        const I = h.intent; I.mx = 0; I.up = I.down = I.downEdge = I.jump = I.atk = I.grab = I.dodge = I.fin = false;
        if (s.mx === 'to') { const d = v.x - h.x; I.mx = Math.abs(d) > (s.near || 34) ? Math.sign(d) : 0; } else if (typeof s.mx === 'function') I.mx = s.mx(m, h, v); else if (s.mx) I.mx = s.mx;
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
    log(`ok   ${name}  (h=${h.st} side=${h.side} prop=${!!h.prop} | v=${v.st} downs=${v.downs} hp=${v.hp | 0})`);
  } catch (e) { fails++; log(`FAIL ${name}: ${e.message}  h=${h.st}/${h.side} v=${v.st}`); }
  return m;
}
const AR = new MatchManager({ mode: 'single', arena: 'hall', entrants: [{ char: 'rookie', ctrl: 'human' }, { char: 'dohyun', ctrl: 'dummy' }], skipIntro: true }).arena;
const chairX = AR.ropeL + 170;
const nearChair = (m, h) => { const p = m.props.list[0]; return p && Math.abs(p.x - h.x) < 20; };

// 1. pick a chair up, walk to the foe, chair shot: down at once
// walk to the chair wherever it lies and pick it up (the pick-up takes half a second)
const toChair = (m, h) => { const p = m.props.list.find(q => q.state === 'floor'); return p ? (Math.abs(p.x - h.x) > 14 ? Math.sign(p.x - h.x) : 0) : 0; };
const nearFloorChair = (m, h) => { const p = m.props.list.find(q => q.state === 'floor'); return !!p && Math.abs(p.x - h.x) < 18; };
const pickUp = [{ t: 4, mx: toChair, until: nearFloorChair }, { t: .05, press: ['grab'] }, { t: .62 }];
const hittable = (m, h, v) => Math.abs(v.x - h.x) < 40 && v.inv <= 0 && (v.fsm.is('IDLE', 'MOVE') || (v.st === 'DOWN' && !v.rag && v.protect <= 0));
const blow = [{ t: 5, mx: 'to', near: 30, until: hittable }, { t: .05, press: ['atk'] }, { t: .9 }];
run('pick up and chair shot: down at once, chair falls off', { events: [{ kind: 'chairs', xs: [chairX] }] }, [...pickUp, ...blow, { t: .4 }],
  (m, h, v, ev) => { const p = m.props.list[0]; return (ev.propPick && (ev.down || []).some(e => e.f === v && e.chair) && v.downs === 0 && (ev.chairHit || []).length === 1 && !h.prop && p && p.uses === 2 && p.state !== 'held') || `pick=${!!ev.propPick} chairDown=${(ev.down || []).some(e => e.f === v && e.chair)} downs=${v.downs} hits=${(ev.chairHit || []).length} held=${!!h.prop} uses=${p && p.uses}`; });

// picking up takes half a second, and a blow in the middle of it leaves the chair on the floor
{
  let reachT = -1, pickT = -1;
  run('picking up takes half a second', { events: [{ kind: 'chairs', xs: [chairX] }] }, [
    { t: 4, mx: toChair, until: nearFloorChair },
    { t: 1, fn: (m, h, v, i, I) => { if (!i) I.grab = true; if (reachT < 0 && h.st === 'ATTACK') reachT = m.time; if (pickT < 0 && h.prop) pickT = m.time; } },
  ], (m, h) => (h.prop && pickT - reachT > .28 && pickT - reachT < .4) || `held=${!!h.prop} took=${(pickT - reachT).toFixed(2)}s`);
}
run('a hit while picking up leaves the chair', { events: [{ kind: 'chairs', xs: [chairX] }] }, [
  { t: 4, mx: toChair, until: nearFloorChair },
  { t: .05, press: ['grab'] }, { t: .1, fn: (m, h, v, i) => { if (i === 0) { m.combat.react(v, h, { kb: 80, lv: 2, hs: .4, up: 0 }, 1, false); } } }, { t: .6 },
], (m, h) => (!h.prop && m.props.list[0] && m.props.list[0].state === 'floor') || `held=${!!h.prop} state=${m.props.list[0] && m.props.list[0].state}`);

// three swings use the chair up, picking it up again after each
const upAgain = { t: 5, until: (m, h, v) => v.fsm.is('IDLE', 'MOVE') && v.inv <= 0 };   // K by a downed foe grabs the foe, not the chair
run('chair breaks after three blows', { events: [{ kind: 'chairs', xs: [chairX] }] }, [...pickUp, ...blow, upAgain, ...pickUp, ...blow, upAgain, ...pickUp, ...blow],
  (m, h, v, ev) => (ev.chairBreak && !h.prop && m.props.list.length === 0 && (ev.chairHit || []).length === 3) || `hits=${(ev.chairHit || []).length} break=${!!ev.chairBreak} prop=${!!h.prop}`);
const air = [{ t: .05, fn: (m, h, v) => { v.x = m.arena.ropeR - 30; } }, { t: .05, press: ['atk'] }, { t: .9 }];
run('three swings break the chair, hit or miss', { events: [{ kind: 'chairs', xs: [chairX] }] }, [...pickUp, ...air, ...pickUp, ...air, ...pickUp, ...air],
  (m, h, v, ev) => (ev.chairBreak && !h.prop && !(ev.chairHit || []).length && m.props.list.length === 0) || `break=${!!ev.chairBreak} prop=${!!h.prop} hits=${(ev.chairHit || []).length} left=${m.props.list.map(p => p.uses)}`);

// a chair down is short and does not count as a down; right after getting up another chair only rocks you
{
  let downT = 0;
  run('chair down is short and separate', { events: [{ kind: 'chairs', xs: [chairX] }] }, [
    ...pickUp, { t: 5, mx: 'to', near: 30, until: hittable }, { t: .05, press: ['atk'] },
    { t: 4, fn: (m, h, v) => { if (v.st === 'DOWN') downT += 1 / 60; }, until: (m, h, v) => v.fsm.is('IDLE', 'MOVE') && downT > 0 },
    ...pickUp, { t: 4, mx: 'to', near: 30, until: (m, h, v) => Math.abs(v.x - h.x) < 40 && v.inv <= 0 && v.fsm.is('IDLE', 'MOVE') }, { t: .05, press: ['atk'] }, { t: .9 },
  ], (m, h, v, ev) => {
    const downs = (ev.down || []).filter(e => e.f === v);
    return (downs.length === 1 && downs[0].chair && downT < 2.6 && v.downs === 0 && (ev.chairHit || []).length === 2) || `downs=${downs.length} time=${downT.toFixed(2)} count=${v.downs} hits=${(ev.chairHit || []).length} imm=${v.chairImm}`;
  });
}

// countering a chair swing: K while it comes up, or a timed L, takes the chair
const armed = { t: .05, fn: (m, h, v, i) => { if (!i) { const p = m.props.spawn(v.x, v.y - 50, { state: 'floor' }); m.props.attach(p, v); v.ai.behavior = 'attack'; } } };
run('K during the swing takes the chair', {}, [armed,
  { t: 6, mx: (m, h, v) => (Math.abs(v.x - h.x) > 46 ? Math.sign(v.x - h.x) : 0), fn: (m, h, v, i, I) => { if (v.st === 'ATTACK' && v.atk && v.atk.def.chair && v.atk.t > .1) I.grab = true; }, until: (m, h) => !!h.prop },
  { t: .5 },
], (m, h, v, ev) => (ev.propSnatch && h.prop && !v.prop && !(ev.chairHit || []).length) || `snatch=${!!ev.propSnatch} h=${!!h.prop} v=${!!v.prop} hits=${(ev.chairHit || []).length}`);
run('a timed dodge takes the chair', {}, [armed,
  { t: 6, mx: (m, h, v) => (Math.abs(v.x - h.x) > 46 ? Math.sign(v.x - h.x) : 0), fn: (m, h, v, i, I) => { h.face = Math.sign(v.x - h.x) || 1; if (v.st === 'ATTACK' && v.atk && v.atk.def.chair && v.atk.t > .2 && v.atk.t < .26) I.dodge = true; }, until: (m, h) => !!h.prop },
  { t: .5 },
], (m, h, v, ev) => (ev.propSnatch && h.prop && !v.prop) || `snatch=${!!ev.propSnatch} h=${!!h.prop} v=${!!v.prop} hits=${(ev.chairHit || []).length}`);
// 3. the boss tosses a chair at a player who just stands there
run('boss chair hits a standing player', { events: [{ kind: 'bossChair', at: .3 }] }, [{ t: 7 }],
  (m, h, v, ev) => (ev.cameoIn && ev.cameoThrow && (ev.chairHit || []).some(e => e.v === h) && (ev.down || []).some(e => e.f === h && e.chair)) || `in=${!!ev.cameoIn} thrown=${!!ev.cameoThrow} hits=${(ev.chairHit || []).length} downs=${h.downs}`);

// 4. catch it with K
run('catch the boss chair', { events: [{ kind: 'bossChair', at: .3 }] }, [
  { t: 7, fn: (m, h, v, i, I) => { if (m.props.incoming(h)) I.grab = true; }, until: (m, h) => !!h.prop },
  { t: .5 },
], (m, h, v, ev) => (ev.propCatch && h.prop && h.downs === 0) || `catch=${!!ev.propCatch} prop=${!!h.prop} downs=${h.downs}`);

// 5. or block it facing the chair
run('guard the boss chair', { events: [{ kind: 'bossChair', at: .3 }] }, [
  { t: 7, fn: (m, h, v, i, I) => { const p = m.props.threat(h); if (p) { I.down = true; I.mx = Math.sign(p.x - h.x) || 1; } } },
], (m, h, v, ev) => ((ev.chairHit || []).some(e => e.v === h && e.guarded) && h.downs === 0) || `hits=${JSON.stringify((ev.chairHit || []).map(e => !!e.guarded))} downs=${h.downs}`);

// 6. the opponent's coach slides a chair in and the computer uses it
run('coach chair run-in', { events: [{ kind: 'coachChair', at: .5 }] }, [{ t: 14, mx: (m, h, v) => (Math.abs(v.x - h.x) > 160 ? Math.sign(v.x - h.x) : 0) }],
  (m, h, v, ev) => (ev.cameoIn && (ev.propPick || []).some(e => e.f === v) && (ev.swing || []).some(e => e.f === v && e.def.id === 'chairShot')) || `in=${!!ev.cameoIn} vPick=${(ev.propPick || []).some(e => e.f === v)} swings=${(ev.swing || []).filter(e => e.f === v).map(e => e.def.id).join(',')}`, { foeCtrl: 'ai' });

// 7. take a chair off a foe who holds it
run('steal a chair', {}, [
  { t: .1, fn: (m, h, v, i) => { if (!i) { const p = m.props.spawn(v.x, v.y - 50, { state: 'floor' }); m.props.attach(p, v); } } },
  { t: 3, mx: 'to', near: 36, until: (m, h, v) => Math.abs(v.x - h.x) < 44 }, { t: .05, press: ['grab'] }, { t: .6 },
], (m, h, v, ev) => (ev.propSteal && h.prop && !v.prop) || `steal=${!!ev.propSteal} h=${!!h.prop} v=${!!v.prop}`);

// 8. climb the corner, turn to face out, dive onto a foe standing on the floor outside
run('corner dive over the top rope', {}, [
  { t: .05, fn: (m, h, v, i) => { if (!i) { v.x = m.arena.ropeL - 90; v.side = 'out'; v.y = m.arena.floorY; v.face = 1; } } },
  { t: 3, mx: -1, until: (m, h) => m.arena.nearRope(h.x).dist < 20 }, { t: .05, mx: -1, press: ['jump'] }, { t: .7 },
  { t: .1, mx: -1 }, { t: .2 }, { t: .05, press: ['atk'] }, { t: 2.2 },
], (m, h, v, ev) => ((ev.dive || []).some(e => e.out) && h.side === 'out' && v.dmgTaken > 0) || `dives=${JSON.stringify((ev.dive || []).map(e => !!e.out))} side=${h.side} foeDmg=${v.dmgTaken | 0}`, { me: 'haneul' });

// 9. the same outward dive is refused where going over the top eliminates you
run('outward dive refused in a battle royal', { mode: 'royal' }, [
  { t: 3, mx: -1, until: (m, h) => m.arena.nearRope(h.x).dist < 20 }, { t: .05, mx: -1, press: ['jump'] }, { t: .7 },
  { t: .1, mx: -1 }, { t: .2 }, { t: .05, press: ['atk'] }, { t: 1.5 },
], (m, h, v, ev) => (ev.perchDeny && h.side === 'in' && !h.eliminated) || `deny=${!!ev.perchDeny} side=${h.side} out=${h.eliminated}`, { me: 'haneul' });

// 10. dash: tap, release, tap and hold; K into a standing foe = the dash move
const dashIn = [{ t: .05, mx: 1 }, { t: .05, mx: 0 }, { t: 2.5, mx: 1, until: (m, h, v) => Math.abs(v.x - h.x) < 56 }];
const dashEv = ['dashStart', 'dashSig', 'deny', 'moveStart'];
{
  const ev = {}, m = new MatchManager({ mode: 'single', arena: 'hall', seed: 21, skipIntro: true, entrants: [{ char: 'rookie', ctrl: 'human' }, { char: 'dohyun', ctrl: 'dummy' }] });
  const h = m.fighters[0], v = m.fighters[1]; v.ai.behavior = 'idle'; h.fin = 40;
  for (const k of [...dashEv, 'down']) m.on(k, e => { (ev[k] = ev[k] || []).push(e); });
  let maxV = 0, t = 0;
  const frame = (mx, grab) => { const I = h.intent; I.mx = mx; I.up = I.down = I.downEdge = I.jump = I.atk = I.dodge = I.fin = false; I.grab = !!grab; m.update(1 / 60); t++; sane(m, 'dash'); };
  try {
    for (let i = 0; i < 3; i++) frame(1); for (let i = 0; i < 3; i++) frame(0);
    for (let i = 0; i < 150 && Math.abs(v.x - h.x) > 54; i++) { frame(1); maxV = Math.max(maxV, Math.abs(h.vx)); }
    const wasDash = h.dash; frame(1, true); const spent = h.fin; for (let i = 0; i < 130; i++) frame(0);
    const used = (ev.moveStart || []).find(e => e.a === h);
    const ok = wasDash && maxV > 240 && ev.dashStart && ev.dashSig && used && used.mv.id === 'cutter' && Math.abs(spent - (40 - 15)) < 1 && h.sigCd > 0 && v.dmgTaken > 0;
    if (!ok) { fails++; log(`FAIL dash cutter: dash=${wasDash} maxV=${maxV | 0} start=${!!ev.dashStart} sig=${!!ev.dashSig} move=${used && used.mv.id} finAfterUse=${spent} cd=${h.sigCd} dmg=${v.dmgTaken | 0}`); }
    else log(`ok   dash cutter: top speed ${maxV | 0}, ${used.mv.id}, foe ${v.st} hp-${v.dmgTaken | 0}`);
  } catch (e) { fails++; log('FAIL dash cutter: ' + e.message); }
}
run('dash move refused without gauge', {}, [{ t: .05, fn: (m, h) => { h.fin = 0; } }, ...dashIn, { t: .05, press: ['grab'] }, { t: 1 }],
  (m, h, v, ev) => ((ev.deny || []).length > 0 && !(ev.moveStart || []).some(e => e.a === h)) || `deny=${(ev.deny || []).length}`);
run('heavy wrestlers spear', {}, [{ t: .05, fn: (m, h) => { h.fin = 40; } }, ...dashIn, { t: .05, press: ['grab'] }, { t: 2.2 }],
  (m, h, v, ev) => ((ev.moveStart || []).some(e => e.a === h && e.mv.id === 'spear')) || `moves=${(ev.moveStart || []).map(e => e.mv.id)}`, { me: 'mandeok' });

// 10b. from the top of the corner onto a standing foe: missile dropkick; a guard raised at the last moment parries it
const climbLeft = [{ t: .05, fn: (m, h, v) => { v.x = m.arena.ropeL + 150; } }, { t: 3, mx: -1, until: (m, h) => m.arena.nearRope(h.x).dist < 20 }, { t: .05, mx: -1, press: ['jump'] }, { t: .7 }];
run('missile dropkick onto a standing foe', {}, [...climbLeft, { t: .05, press: ['atk'] }, { t: 1.6 }],
  (m, h, v, ev) => ((ev.dive || []).some(e => e.stand && e.id === 'missileDropkick') && v.dmgTaken > 0) || `dives=${JSON.stringify((ev.dive || []).map(e => e.id || 'plain'))} dmg=${v.dmgTaken | 0}`);
run('a last-moment guard parries the corner dropkick', {}, [...climbLeft, { t: .05, press: ['atk'] },
  { t: 1.6, fn: (m, h, v) => { if (h.st === 'AIR_ATTACK' && Math.abs(h.x - v.x) < 72 && v.ai.behavior !== 'guard') { v.ai.behavior = 'guard'; v.face = Math.sign(h.x - v.x) || 1; v.set('GUARD', { force: true }); v.guardT = 0; } } }],
  (m, h, v, ev) => ((ev.parry || []).length > 0 && v.dmgTaken === 0) || `parry=${(ev.parry || []).length} dmg=${v.dmgTaken | 0}`);
run('dash move parried by a last-moment guard', {}, [{ t: .05, fn: (m, h) => { h.fin = 40; } }, ...dashIn,
  { t: .05, fn: (m, h, v, i, I) => { v.face = Math.sign(h.x - v.x) || 1; v.set('GUARD', { force: true }); v.guardT = 0; I.grab = true; } }, { t: 1 }],
  (m, h, v, ev) => ((ev.parry || []).length > 0 && !(ev.moveStart || []).some(e => e.a === h)) || `parry=${(ev.parry || []).length} moves=${(ev.moveStart || []).map(e => e.mv.id)}`);

// 11. computer vs computer with chairs lying around: they use them and nothing breaks
for (let g = 0; g < 6; g++) {
  const ids = ['dueok', 'bokja', 'taesan', 'neon', 'baeksang', 'ironma'];
  const m = new MatchManager({ mode: 'single', arena: 'hall', seed: 300 + g, skipIntro: true, entrants: [{ char: ids[g], ctrl: 'ai', difficulty: 'hard' }, { char: ids[(g + 2) % 6], ctrl: 'ai', difficulty: 'normal' }], events: [{ kind: 'chairs', xs: [AR.ropeL + 60, AR.ropeR - 60] }] });
  let hits = 0, picks = 0;
  m.on('chairHit', () => hits++); m.on('propPick', () => picks++);
  try {
    for (let i = 0; i < 60 * 300 && m.phase !== 'end'; i++) { m.update(1 / 60); sane(m, `ai chairs #${g}`); }
    log(`${m.phase === 'end' ? 'ok  ' : 'FAIL'} ai chairs #${g}: ${m.phase} ${m.clock.toFixed(0)}s picks=${picks} chairHits=${hits}`);
    if (m.phase !== 'end') fails++;
  } catch (e) { fails++; log(`FAIL ai chairs #${g}: ${e.message}`); }
}
console.log(fails ? `\n${fails} FAIL` : '\nALL OK');
process.exit(fails ? 1 : 0);
