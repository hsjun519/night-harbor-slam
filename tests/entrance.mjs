// Ring entrances: the data resolves per tier and per wrestler; in a match each one is hidden behind the curtain,
// walks the aisle on their own feet, climbs in at the apron, reaches their corner and poses, weakest first; nobody
// is hurt on the way; Enter skips everything; the bell still rings and the match plays. Run: node tests/entrance.mjs
import { MatchManager } from '../src/combat/MatchManager.js';
import { resolveEntrance, ENTRANCES, ENTRANCE_TIERS, playerStage, TIER_RANK } from '../src/data/entrances.js';
import { CHARACTERS } from '../src/data/characters.js';

let fails = 0;
const check = (ok, what, extra = '') => { if (ok) console.log('ok  ', what); else { fails++; console.log('FAIL', what, extra); } };
// ---- data
const G = resolveEntrance('godong'), F = resolveEntrance('fogking'), W = resolveEntrance('whiteivory'), L = resolveEntrance('brLeader'), N = resolveEntrance('galchi');
check(G.tier === 'king' && G.titles.length === 2 && G.flames === 2 && G.escort.includes('simyeon') && G.horn === 1 && G.fadeOut && G.fx === 'heartbeat' && G.screen.icon === 'whale', '고동: the hall goes quiet, three heartbeats and the horn, the whale, blue and gold fire, the vice captain at his side');
check(F.tier === 'king' && F.fog && F.light.dim > .7 && F.screen.icon === 'fog', '안개왕: dark hall, mist, a slow walk');
check(W.tier === 'officer' && W.screen.en === 'SWAEPA · GREAT WHITE' && W.horn === 1 && W.crowd === 'sailors' && W.fx === 'shark', '쇄파: horn, white light, a fin cutting the floor');
const OFF = ['haemu', 'heungnin', 'jeokgap', 'cheongchang', 'whiteivory', 'heugik', 'baegan', 'mukhae', 'simyeon', 'godong'].map(id => [id, resolveEntrance(id)]);
check(OFF.every(([id, E]) => E.fx && E.screen.icon && E.titles && E.titles.length === 2) && new Set(OFF.map(([id, E]) => E.fx)).size === OFF.length, 'every officer of 선항 has an entrance of their own (light, picture, billing)', OFF.map(([id, E]) => id + ':' + E.fx).join(' '));
check(OFF.every(([id, E]) => id === 'godong' || E.pre < G.pre), 'and nobody builds up longer than the captain');
check(L.tier === 'rival' && L.screen.en === 'BLACK ROPE' && L.crowd === 'mixed' && L.escort.length === 2, 'BLACK ROPE leader: purple light, logo, boos and cheers, the crew');
check(N.tier === 'normal' && N.pose === 'none' && N.pre < .5, 'an ordinary wrestler: short and plain');
check(G.pre > F.pre && F.pre > W.pre && W.pre > N.pre, 'the bigger the name, the longer the build-up');
check(resolveEntrance('dohyun', { belt: 'dohyun' }).belt && resolveEntrance('dohyun', { belt: 'dohyun' }).tier === 'champion', 'whoever holds the belt walks out as the champion');
check(resolveEntrance('galchi', { seen: 1 }).pre <= .15 && resolveEntrance('godong', { short: 1 }).pre < G.pre, 'a familiar face, or the short setting, keeps it brief');
const stages = [[{ fame: 0, flags: {} }, 'rookie'], [{ fame: 12, flags: {} }, 'prospect'], [{ fame: 40, flags: {} }, 'known'], [{ fame: 50, flags: { champion: 1 }, titles: [1] }, 'champion'], [{ fame: 95, flags: { champion: 1 }, titles: [1] }, 'star']];
check(stages.every(([d, s]) => playerStage(d) === s), 'the player grows from rookie to star');
const P1 = resolveEntrance('player', { player: 1, stage: 'rookie' }), P4 = resolveEntrance('player', { player: 1, stage: 'champion' });
check(P1.tier === 'normal' && P4.tier === 'champion' && P4.belt && P4.flames >= 1, "a champion's entrance has the belt and pyro");
check(Object.keys(ENTRANCES).every(id => CHARACTERS[id] && ENTRANCE_TIERS[ENTRANCES[id].tier]), 'every entrance names a real wrestler and tier');
// ---- in a match
function run(foe, opt, frames = 60 * 40) {
  const m = new MatchManager({ mode: 'single', arena: 'hall', seed: 5, career: 1, entrances: opt, introTime: 3.2, entrants: [{ char: 'rookie', ctrl: 'human' }, { char: foe, ctrl: 'ai', difficulty: 'normal' }] });
  const h = m.fighters[0], v = m.fighters[1], log = [], seen = { hiddenAtStart: h.hidden && v.hidden, outside: new Set(), entered: new Set(), maxHurt: 0 };
  for (const k of ['entranceStart', 'entranceAppear', 'entranceInRing', 'entrancePose', 'entrancesDone', 'bell']) m.on(k, e => log.push(k + (e && e.f ? ':' + e.f.charId : '')));
  const hp0 = [h.hp, v.hp];
  let t = 0;
  for (; t < frames / 60 && m.phase !== 'fight'; t += 1 / 60) {
    m.update(1 / 60);
    for (const f of m.fighters) { if (f.side === 'out' && !f.hidden) seen.outside.add(f.charId); if (f.st === 'ENTER_RING') seen.entered.add(f.charId); }
  }
  seen.maxHurt = Math.max(hp0[0] - h.hp, hp0[1] - v.hp);
  return { m, h, v, log, seen, t };
}
{
  const r = run('dohyun', { player: { stage: 'rookie' } });
  const order = r.log.filter(x => x.startsWith('entranceStart')).map(x => x.split(':')[1]);
  check(r.seen.hiddenAtStart, 'both wait behind the curtain at the start');
  check(r.seen.outside.has('dohyun') && r.seen.outside.has('rookie') && r.seen.entered.has('dohyun') && r.seen.entered.has('rookie'), 'each walks the aisle and climbs in at the apron', JSON.stringify([...r.seen.outside, ...r.seen.entered]));
  check(order[0] === 'rookie' && order[1] === 'dohyun', 'the rookie walks out first, the rival (stronger tier) last', JSON.stringify(order));
  check(r.log.includes('entrancesDone') && r.log.includes('bell') && r.m.phase === 'fight', `then the bell (after ${r.t.toFixed(1)} s)`);
  check(r.seen.maxHurt === 0, 'nobody is hurt on the way to the ring');
  check(r.m.fighters.every(f => f.side === 'in' && !f.hidden), 'both stand in the ring at the bell');
  let t = 0; while (r.m.phase !== 'end' && t < 200) { r.m.update(1 / 60); t += 1 / 60; }
  check(r.m.phase === 'end' && !r.m.faults, 'and the match plays to the end', r.m.phase);
}
{
  const r = run('godong', { player: { stage: 'champion' }, belt: 'player' });
  const order = r.log.filter(x => x.startsWith('entranceStart')).map(x => x.split(':')[1]);
  check(order[0] === 'rookie' && order[1] === 'godong', 'the king of the ocean walks out after the champion', JSON.stringify(order));
  const esc = r.m.events.cameos.filter(c => c.who === 'escort').length;
  check(r.t > 8, `고동's entrance takes its time (${r.t.toFixed(1)} s)`);
  for (let i = 0; i < 300; i++) r.m.update(1 / 60);
  check(!r.m.events.cameos.some(c => c.who === 'escort' && c.act !== 'leave' && !c.gone), 'his escorts leave the ringside at the bell', `escorts ${esc}`);
}
{
  const m = new MatchManager({ mode: 'single', arena: 'hall', seed: 5, career: 1, entrances: { player: { stage: 'rookie' } }, entrants: [{ char: 'rookie', ctrl: 'human' }, { char: 'fogking', ctrl: 'ai' }] });
  for (let i = 0; i < 90; i++) m.update(1 / 60);
  m.entrance.skipAll();
  let t = 0; while (m.phase !== 'fight' && t < 10) { m.update(1 / 60); t += 1 / 60; }
  check(m.entrance.done && m.phase === 'fight' && m.fighters.every(f => f.side === 'in' && !f.hidden) && t < 5, 'Enter skips straight to the corners and the bell');
}
{
  const m = new MatchManager({ mode: 'single', arena: 'hall', seed: 5, special: 'cage', career: 1, entrances: { player: { stage: 'rookie' } }, entrants: [{ char: 'rookie', ctrl: 'human' }, { char: 'taesan', ctrl: 'ai' }] });
  check(!m.entrance, 'a cage match starts with both inside');
  const q = new MatchManager({ mode: 'single', arena: 'hall', seed: 5, skipIntro: true, entrances: {}, entrants: [{ char: 'rookie', ctrl: 'human' }, { char: 'taesan', ctrl: 'ai' }] });
  check(!q.entrance && q.phase === 'fight', 'a match that skips its intro (online, practice) has none');
}
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
