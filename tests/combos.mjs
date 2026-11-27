// Follow-ups (연계), upgrades (연속 저먼, 슈퍼 파워밤), the Space specials (로프 회전 킥, 어깨 메기), the turnbuckle seat,
// rolling away, mashing out of holds on the mat and the energy counters, driven by scripted inputs.
// Run: node tests/combos.mjs
import { MatchManager } from '../src/combat/MatchManager.js';
import { MOVES } from '../src/data/moves.js';
import { ATTACKS } from '../src/data/balance.js';
globalThis.__ATK = ATTACKS;

let fails = 0;
const log = (...a) => console.log(...a);
function sane(m, tag) {
  for (const f of m.fighters) {
    if (!Number.isFinite(f.x) || !Number.isFinite(f.y)) throw new Error(`${tag}: NaN pos ${f.name} st=${f.st}`);
    for (let i = 0; i < 36; i++) if (!Number.isFinite(f.joints.p[i])) throw new Error(`${tag}: NaN joint ${f.name} st=${f.st}`);
  }
  if (m.faults) throw new Error(`${tag}: ${m.faults} faults`);
}
const EVS = ['followOpen', 'followUp', 'upgrade', 'special', 'sCounter', 'signature', 'rollAway', 'subEscape', 'seated', 'carry', 'springboard', 'pinBonus', 'seatKnock', 'deny', 'moveStart', 'release', 'eliminated', 'revFail', 'pin', 'dive', 'landAttack'];
// steps: { t, mx, hold:[], press:[], fn(m,h,v,i,I), until(m,h,v) }; expect(m,h,v,ev) returns true or a reason
function run(name, cfg, setup, steps, expect, o = {}) {
  const m = new MatchManager(Object.assign({ mode: 'single', arena: 'hall', seed: 7, skipIntro: true, entrants: [{ char: o.me || 'rookie', ctrl: o.meCtrl || 'human' }, { char: o.foe || 'dohyun', ctrl: o.foeCtrl || 'dummy', difficulty: o.lv || 'normal' }] }, cfg));
  const h = m.fighters[0], v = m.fighters[1];
  if (v.ai && (o.foeCtrl || 'dummy') === 'dummy') v.ai.behavior = 'idle';
  const ev = {};
  for (const k of EVS) m.on(k, e => { (ev[k] = ev[k] || []).push(e); });
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
        if (h.ctrl !== 'human' && h.ai) { /* AI writes its own intent */ }
        m.update(1 / 60); t += 1 / 60;
        sane(m, `${name} @${t.toFixed(2)}`);
        if (s.until && s.until(m, h, v)) break;
      }
    }
    const r = expect(m, h, v, ev);
    if (r !== true) throw new Error(typeof r === 'string' ? r : 'expectation failed');
    log(`ok   ${name}  (h=${h.st}/${h.side} fin=${h.fin | 0} | v=${v.st} hp=${v.hp | 0})`);
  } catch (e) { fails++; log(`FAIL ${name}: ${e.message}  h=${h.st}/${h.side} v=${v.st}`); }
  return m;
}
const frontHold = (m, h, v, x) => { h.x = x; v.x = x + 24 * h.face; h.face = 1; v.face = -1; m.grapple.beginHold(h, v, 'front'); h.link.phase = 'hold'; };
const rearHold = (m, h, v, x) => { h.x = x; v.x = x + 17; h.face = 1; v.face = 1; m.grapple.beginHold(h, v, 'rear'); h.link.phase = 'hold'; };
const lay = (v, x) => { v.x = x; v.set('DOWN', { force: true }); v.lieClip = 'downSup'; v.downTime = 9; v.downClock = 0; v.postMove = true; v.grabImm = 60; };
const ids = ev => (ev.moveStart || []).map(e => e.mv.id);

// ---- 연계: body slam, then J inside the window: the jump elbow drop; then S: a cover that is harder to kick out of
run('body slam -> J: jump elbow drop, then S: a cover with a bonus', { mode: 'pin' }, (m, h, v) => { frontHold(m, h, v, 400); m.wrestle.startFromHold(h.link, 'bodySlam'); },
  [{ t: 2, until: (m, h) => !!h.follow }, { t: .05, press: ['atk'] }, { t: 2.5, until: (m, h) => h.follow && h.follow.from === 'fElbow' }, { t: .05, press: ['downEdge'] }, { t: 1.6, until: m => !!m.pin }],
  (m, h, v, ev) => (ids(ev).join() === 'bodySlam,fElbow' && m.pin && m.pin.bonus > 1 && (ev.signature || []).some(e => e.name === '항구의 밤')) || `moves=${ids(ev)} pin=${!!m.pin} bonus=${m.pin && m.pin.bonus} sig=${(ev.signature || []).map(e => e.name)}`);
run('no press: the window closes and J stomps as usual', {}, (m, h, v) => { frontHold(m, h, v, 400); m.wrestle.startFromHold(h.link, 'bodySlam'); },
  [{ t: 2, until: (m, h) => !!h.follow }, { t: 2.2 }],
  (m, h, v, ev) => (!h.follow && ids(ev).join() === 'bodySlam') || `follow=${!!h.follow} moves=${ids(ev)}`);
run('spinebuster -> J: the long elbow; backbreaker -> K: back stretch', {}, (m, h, v) => { h.x = 400; v.x = 430; h.face = 1; v.face = -1; m.wrestle.start(h, v, 'spinebuster', { noReverse: true }); },
  [{ t: 2, until: (m, h) => !!h.follow }, { t: .05, press: ['atk'] }, { t: 3.2 }],
  (m, h, v, ev) => ids(ev).join() === 'spinebuster,bigElbow' || `moves=${ids(ev)}`);
run('suplex -> K: haul them up and suplex again', {}, (m, h, v) => { frontHold(m, h, v, 400); m.wrestle.startFromHold(h.link, 'suplex'); },
  [{ t: 2.4, until: (m, h) => !!h.follow }, { t: .05, press: ['grab'] }, { t: 2.6 }],
  (m, h, v, ev) => (ids(ev).join() === 'suplex,liftUp') || `moves=${ids(ev)}`);

// ---- 이어 걸기
run('german + K early: a second German without letting go', {}, (m, h, v) => { rearHold(m, h, v, 400); m.wrestle.startFromHold(h.link, 'german'); },
  [{ t: .08 }, { t: .05, press: ['grab'] }, { t: 3 }],
  (m, h, v, ev) => ((ev.upgrade || []).length === 1 && v.st !== 'GRABBED' && (ev.release || []).length === 1) || `upgrades=${(ev.upgrade || []).length} rel=${(ev.release || []).length} v=${v.st}`);
run('powerbomb + Space early with 50 energy: three powerbombs, energy spent', {}, (m, h, v) => { h.fin = 60; frontHold(m, h, v, 400); m.wrestle.startFromHold(h.link, 'powerbomb'); },
  [{ t: .08 }, { t: .05, press: ['fin'] }, { t: .2 }, { t: 6, until: (m, h) => !h.link }],
  (m, h, v, ev) => ((ev.upgrade || []).length === 1 && h.fin < 20 && (ev.release || []).length === 1 && (ev.signature || []).some(e => e.name === '북해 삼연타')) || `upgrades=${(ev.upgrade || []).length} fin=${h.fin | 0} rel=${(ev.release || []).length}`);
run('powerbomb + Space without the energy: denied, a plain powerbomb', {}, (m, h, v) => { h.fin = 20; frontHold(m, h, v, 400); m.wrestle.startFromHold(h.link, 'powerbomb'); },
  [{ t: .08 }, { t: .05, press: ['fin'] }, { t: 2.2 }],
  (m, h, v, ev) => (!(ev.upgrade || []).length && (ev.deny || []).length >= 1 && (ev.release || []).length === 1) || `upgrades=${(ev.upgrade || []).length} deny=${(ev.deny || []).length}`);

// ---- Space in a front hold
const AR = new MatchManager({ mode: 'single', arena: 'hall', entrants: [{ char: 'rookie', ctrl: 'human' }, { char: 'dohyun', ctrl: 'dummy' }], skipIntro: true }).arena;
run('near the ropes, Space: rope swing kick, standing on the apron after; J springboards onto them, S covers', { mode: 'pin' }, (m, h, v) => { h.fin = 40; frontHold(m, h, v, AR.ropeR - 110); },
  [{ t: .05, press: ['fin'] }, { t: 3, until: (m, h) => h.st === 'APRON' }, { t: .5, until: (m, h, v) => v.st === 'DOWN' && !v.rag }, { t: .2 }, { t: .05, press: ['atk'] }, { t: 2, until: (m, h) => !!h.follow && h.follow.from === 'springMoon' }, { t: .05, press: ['downEdge'] }, { t: 1.6, until: m => !!m.pin }],
  (m, h, v, ev) => ((ev.special || []).some(e => e.id === 'ropeKick') && (ev.springboard || []).length === 1 && m.pin && (ev.signature || []).some(e => e.name === '파도 넘기')) || `special=${(ev.special || []).map(e => e.id)} spring=${(ev.springboard || []).length} pin=${!!m.pin} sig=${(ev.signature || []).map(e => e.name)} fin=${h.fin | 0}`);
run('away from the ropes, Space: on the shoulders; walk to the corner; K there seats them on the turnbuckle', {}, (m, h, v) => { h.fin = 20; frontHold(m, h, v, AR.mid); },
  [{ t: .05, press: ['fin'] }, { t: 1.5, until: (m, h) => h.link && h.link.pos === 'carry' }, { t: 4, mx: 1, until: (m, h) => m.combo.carryToCorner(h) < 60 }, { t: .05, press: ['grab'] }, { t: 2, until: (m, h, v) => v.st === 'SEATED' }],
  (m, h, v, ev) => ((ev.carry || []).length === 1 && v.st === 'SEATED' && v.seat && Math.abs(v.x - AR.ropeR) < 12) || `carry=${(ev.carry || []).length} v=${v.st} x=${v.x | 0} rope=${AR.ropeR}`);
run('on the shoulders in the middle, K: electric chair drop', {}, (m, h, v) => { h.fin = 20; frontHold(m, h, v, AR.mid); },
  [{ t: .05, press: ['fin'] }, { t: 1.5, until: (m, h) => h.link && h.link.pos === 'carry' }, { t: .3 }, { t: .05, press: ['grab'] }, { t: 1.6 }],
  (m, h, v, ev) => (ids(ev).join() === 'shoulderLift,elecChair' && v.st === 'DOWN') || `moves=${ids(ev)} v=${v.st}`);
run('carried, mashing gets you off behind them', {}, (m, h, v) => { h.fin = 20; v.ai = null; v.ctrl = 'human'; frontHold(m, h, v, AR.mid); },
  [{ t: .05, press: ['fin'] }, { t: 1.5, until: (m, h) => h.link && h.link.pos === 'carry' }, { t: 3, fn: (m, h, v, i) => { const J = v.intent; J.atk = J.grab = J.jump = i % 2 === 0; }, until: (m, h, v) => !v.link }],
  (m, h, v) => (!v.link && v.st === 'IDLE' && Math.sign(v.x - h.x) === -h.face) || `v=${v.st} link=${!!v.link} side=${Math.sign(v.x - h.x)} face=${h.face}`);
run('seated foe: Space with 50 energy is the super German, K the turnbuckle backdrop', {}, (m, h, v) => { v.x = AR.ropeR - 8; m.combo.seat(v, h); h.x = AR.ropeR - 46; h.face = 1; h.fin = 60; },
  [{ t: .05, press: ['fin'] }, { t: 2.4, until: (m, h) => !h.link }],
  (m, h, v, ev) => ((ev.special || []).some(e => e.id === 'superGerman') && h.fin < 20 && v.st === 'DOWN') || `special=${(ev.special || []).map(e => e.id)} fin=${h.fin | 0} v=${v.st}`);
run('seated foe in a battle royal: J pushes them off to the floor, eliminated', { mode: 'royal', entrants: [{ char: 'rookie', ctrl: 'human' }, { char: 'dohyun', ctrl: 'dummy' }, { char: 'neon', ctrl: 'dummy' }] }, (m, h, v) => { for (const f of m.fighters) if (f.ai) f.ai.behavior = 'idle'; m.fighters[2].x = AR.ropeL + 60; v.x = AR.ropeR - 8; m.combo.seat(v, h); h.x = AR.ropeR - 40; h.face = 1; },
  [{ t: .05, press: ['atk'] }, { t: 3, until: (m, h, v) => v.eliminated }],
  (m, h, v, ev) => (v.eliminated && (ev.seatKnock || []).length === 1) || `elim=${v.eliminated} knock=${(ev.seatKnock || []).length} v=${v.st}/${v.side}`);

// ---- on the mat: roll out of the way, mash out of a hold
run('jump elbow drop: L in the window rolls away, the attacker hits the mat', {}, (m, h, v) => { h.x = 400; lay(v, 440); m.combo.run(h, v, { id: 'fElbow' }); },
  [{ t: .3 }, { t: .3, fn: (m, h, v, i) => { if (i === 0) v.buf.dodge = .16; } }, { t: 1 }],
  (m, h, v, ev) => ((ev.rollAway || []).length === 1 && v.hp >= v.maxHp - .01) || `roll=${(ev.rollAway || []).length} hp=${v.hp}/${v.maxHp}`, {});
run('back stretch: mashing breaks out early', {}, (m, h, v) => { h.x = 400; v.ai = null; v.ctrl = 'human'; lay(v, 440); m.combo.run(h, v, { id: 'backStretch' }); },
  [{ t: 2.4, fn: (m, h, v, i) => { const J = v.intent; J.atk = J.grab = J.jump = i % 2 === 0; }, until: (m, h, v) => !v.link }],
  (m, h, v, ev) => ((ev.subEscape || []).length === 1) || `escape=${(ev.subEscape || []).length}`);

// ---- energy counters
run('stomp coming, L with 20 energy: the calf lock', {}, (m, h, v) => { lay(h, 420); h.fin = 30; v.x = 446; v.face = -1; v.ai = null; v.ctrl = 'human'; },
  [{ t: .05, fn: (m, h, v) => { m.combat && v.set('IDLE', { force: true }); __startStomp(m, v); } }, { t: .16 }, { t: .05, press: ['dodge'] }, { t: 1.2 }],
  (m, h, v, ev) => ((ev.sCounter || []).some(e => e.name === '종아리 꺾기' && e.cost === 20)) || `counter=${(ev.sCounter || []).map(e => e.name)} fin=${h.fin}`);
run('rope swing kick: L in its window with 25 energy turns it into a lariat', {}, (m, h, v) => { h.fin = 40; v.fin = 30; frontHold(m, h, v, AR.ropeR - 110); },
  [{ t: .05, press: ['fin'] }, { t: 1.5, fn: (m, h, v) => { const L = v.link; if (L && L.move && L.move.id === 'ropeKick' && L.t > 1.0 && L.t < 1.05) v.buf.dodge = .16; } }],
  (m, h, v, ev) => ((ev.sCounter || []).some(e => e.name === '로프 반격 래리어트') && ids(ev).includes('ropeLariat')) || `counter=${(ev.sCounter || []).map(e => e.name)} moves=${ids(ev)}`);
run('the same L without the energy fails', {}, (m, h, v) => { h.fin = 40; v.fin = 5; frontHold(m, h, v, AR.ropeR - 110); },
  [{ t: .05, press: ['fin'] }, { t: 1.5, fn: (m, h, v) => { const L = v.link; if (L && L.move && L.move.id === 'ropeKick' && L.t > 1.0 && L.t < 1.05) v.buf.dodge = .16; } }],
  (m, h, v, ev) => (!(ev.sCounter || []).length && (ev.revFail || []).length === 1) || `counter=${(ev.sCounter || []).length} fail=${(ev.revFail || []).length}`);
run('a heavy blow, L with 20 energy: roll-up straight into a cover', { mode: 'pin' }, (m, h, v) => { h.x = 400; v.x = 412; h.face = 1; v.face = -1; h.fin = 30; v.ai = null; v.ctrl = 'human'; },
  [{ t: .02, fn: (m, h, v, i) => { if (i === 0) __startAttack(m, v, 'uppercut'); } }, { t: .03 }, { t: .05, press: ['dodge'] }, { t: 1.6 }],
  (m, h, v, ev) => ((ev.sCounter || []).some(e => e.name === '기습 롤업') && !!(m.pin || (ev.pin || []).length)) || `counter=${(ev.sCounter || []).map(e => e.name)} pin=${!!m.pin}`);

// ---- moves whose blow comes just after the throw still hurt
for (const id of ['giantSwing', 'ringOut', 'fHomerun']) {
  run(`${MOVES[id].name}: the blow after the throw lands`, {}, (m, h, v) => { h.x = 400; v.x = 424; h.face = 1; v.face = -1; v.hp0 = v.hp; m.wrestle.start(h, v, id, { noReverse: true, fin: id === 'fHomerun' ? { name: 'x', color: '#fff' } : null }); },
    [{ t: 3.6 }],
    (m, h, v) => ((v.hp0 - v.hp) >= MOVES[id].hp * .6) || `damage=${(v.hp0 - v.hp).toFixed(1)} of ${MOVES[id].hp}`);
}
// ---- the computer uses all of it
{
  const C = {};
  for (let seed = 1; seed <= 14; seed++) {
    const m = new MatchManager({ mode: seed % 2 ? 'single' : 'pin', arena: 'hall', seed, skipIntro: true, entrants: [{ char: ['rookie', 'taesan', 'haneul', 'dueok'][seed % 4], ctrl: 'ai', difficulty: 'hard' }, { char: ['dohyun', 'neon', 'gosu', 'ironma'][seed % 4], ctrl: 'ai', difficulty: 'hard' }] });
    for (const k of ['followUp', 'special', 'carry', 'sCounter', 'springboard', 'seated', 'upgrade']) m.on(k, () => { C[k] = (C[k] || 0) + 1; });
    let t = 0;
    try { while (m.phase !== 'end' && t < 240) { m.update(1 / 60); t += 1 / 60; if ((t * 60 | 0) % 30 === 0) sane(m, 'ai #' + seed); } } catch (e) { fails++; log('FAIL ai #' + seed + ': ' + e.message); }
  }
  const ok = C.followUp > 3 && C.special > 3 && C.carry > 1 && C.sCounter > 1;
  if (!ok) fails++;
  log(`${ok ? 'ok  ' : 'FAIL'} the computer uses follow-ups, specials and counters ${JSON.stringify(C)}`);
}
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);

function __startStomp(m, v) { const C = m.fighters[0]; void C; v.face = -1; v.set('ATTACK', { force: true }); v.atk = { def: globalThis.__ATK.stomp, t: 0, hit: new Set(), connected: false, chain: -1, boost: 1, done: false }; }
function __startAttack(m, v, id) { v.set('ATTACK', { force: true }); v.atk = { def: globalThis.__ATK[id] || globalThis.__ATK.lariat, t: 0, hit: new Set(), connected: false, chain: -1, boost: 1, done: false }; }
