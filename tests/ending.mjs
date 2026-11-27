// The world stage and the endings: beating 고동 puts up the sign at the broken pier; the pier fund fills from your
// gifts, the league's tenth of every prize, the harbour's morning collection and a sponsor; a full fund rebuilds the
// pier; fame 300 on top of it opens the ship (the world ending). The office talk opens the other endings by what the
// career did; THE FINAL BELL shows only what happened, the script and the six lines as written.
// Run: node tests/ending.mjs
import { Career } from '../src/world/CareerManager.js';
import { Save } from '../src/core/SaveManager.js';
import { HARBOR, harborBroken, harborRepaired, harborFull, harborLeft, worldReady, donate, morningGifts, harborRebuild, signReport, pierStage, leagueShare } from '../src/world/harbor.js';
import { ENDINGS, canFinish, finishOptions, retireKind, mentorOk, highlights, scriptLines, credits, FINAL_LINES, FINAL_QUESTIONS } from '../src/world/endings.js';
import { BEGGAR, beggarState } from '../src/world/beggar.js';
import { ENDING_CINES, newWaveCine, worldCallCine, stayCine } from '../src/world/endingStory.js';
import { LOCATIONS } from '../src/world/locations.js';
import { plankAt, PIER } from '../src/world/liveDecor.js';

let fails = 0;
const check = (ok, what, extra = '') => { if (ok) console.log('ok  ', what); else { fails++; console.log('FAIL', what, extra); } };
const look = { build: 'athletic', skin: 'tan', head: { face: 'square', hair: 'side', hairCol: '#222' }, top: { kind: 'none' }, bottom: { kind: 'tights', c1: '#157f8c', c2: '#ffd65a' }, boots: { c1: '#222' } };
const fresh = n => { for (const k of [`save${n}`, `save${n}.chk`]) Save.del(k); return Career.create(n, { name: '파도', style: 'all', look }); };
const res = (won, o = {}) => ({ human: { dmgTaken: 10, finishersTaken: 0, ko: false, ringOuts: 0, moves: 3, counters: 0, uses: {} }, won, draw: false, result: Object.assign({ how: 'pin', winner: null }, o) });

// ---- the sign and the fund
{
  const c = fresh(1), d = c.d;
  check(!d.harbor && !signReport(d), 'no sign before 선항 레슬링 is beaten');
  d.flags.champion = true; c.owBegin(); d.ow.state = 'CAPTAIN';
  c.owAfterMatch('invasion3', false);
  check(!d.harbor, 'losing to 고동 puts up no sign');
  c.owAfterMatch('invasion3', true);
  check(harborBroken(d) && d.harbor.fund === 0, 'beating 고동 puts up the sign at the broken pier');
  const R = signReport(d);
  check(R.order === '명성을 모으고 부두를 고쳐 세계로 진출하라' && R.fund.includes('₩3,000,000') && R.fame.includes('/ 300'), 'the sign: the order, the fund out of ₩3,000,000, fame out of 300', JSON.stringify(R));
  check(LOCATIONS.street.objects.some(o => o.act === 'dockSign' && o.when(d)) && !LOCATIONS.street.objects.find(o => o.act === 'pierEnd').when(d), 'the sign is there to read; the pier end is closed');
  // gifts from your pocket
  d.money = 250000;
  check(donate(c, 100000) === 100000 && d.money === 150000 && d.harbor.mine === 100000, 'a ₩100,000 gift comes out of your pocket');
  check(donate(c, 1000000) === 150000 && d.money === 0, 'you cannot give more than you have');
  check(donate(c, 5000) === 0, 'and nothing with an empty pocket');
  // the league's tenth: on top of the prize, not out of it
  d.money = 0; d.contract = { opp: 'dohyun', oppName: '서도현', reward: 200000, fame: 5, kind: 'official', day: d.day };
  const before = d.harbor.fund, out = c.applyResult('official', res(true), {});
  check(d.harbor.fund - before === leagueShare(out.money) && leagueShare(out.money) >= 20000 && d.money === out.money, `the league adds a tenth of the prize (+${d.harbor.fund - before}) and you keep it all (${d.money})`);
  check(out.lines.some(l => l.includes('부두 복구 기금')), 'and the result screen says so');
  // the morning: the harbour's people by fame, the sponsor once at fame 200
  d.fame = 150; const f0 = d.harbor.fund, m1 = c.sleep();
  check(d.harbor.fund - f0 === 3000 && m1.some(m => m.includes('항구 사람들')), 'every morning the harbour collects fame × 20 (fame 150: ₩3,000)');
  d.fame = 210; const f1 = d.harbor.fund, m2 = c.sleep();
  check(d.harbor.fund - f1 === HARBOR.sponsor + 4000 && d.harbor.sponsor === HARBOR.sponsor && m2.some(m => m.includes('황 대표')), 'at fame 200 the sponsor gives ₩300,000, once');
  const f2 = d.harbor.fund; c.sleep();
  check(d.harbor.fund - f2 === 4000, 'only once');
  check(d.harbor.mine + d.harbor.league + d.harbor.fans + d.harbor.sponsor === d.harbor.fund, 'every won in the fund is accounted for');
  // fill it up
  d.money = 5000000; const left = harborLeft(d);
  check(donate(c, 5000000) === left && harborFull(d) && d.money === 5000000 - left, 'the last gift only takes what the pier still needs');
  check(harborAdd0(d) === 0, 'a full fund takes nothing more');
  check(pierStage(d) === 3, 'a full fund: the deck is down, waiting for the opening');
  const cine = newWaveCine({ c, toast() {}, player: { x: 0 } });
  cine.find(s => s.act).act();
  check(harborRepaired(d) && pierStage(d) === 4 && !harborFull(d), 'A NEW WAVE rebuilds the pier');
  check(cine.some(s => s.caption === '한때 이 항구는 새로운 적들이 찾아오는 곳이었다.') && cine.some(s => s.caption === '이제는 새로운 가능성이 찾아오는 곳이 되었다.') && cine.some(s => s.title === 'A NEW WAVE' && s.sub === '새로운 파도'), 'A NEW WAVE: the two lines and the title');
  check(LOCATIONS.street.objects.find(o => o.act === 'pierEnd').when(d), 'the pier end opens');
  // fame 300: the ship
  d.fame = 299; check(!worldReady(d), 'fame 299: the world does not take you yet');
  d.fame = 300; check(worldReady(d), 'fame 300 and a pier: the ship to the world');
  const call = worldCallCine({ c, toast() {}, player: { x: 600 } });
  call.find(s => s.act).act();
  check(d.harbor.called === 1, '구만석 사장 brings the invitation (once)');
  check(LOCATIONS.street.objects.find(o => o.act === 'pierEnd').label(d) === '세계로 가는 배', 'the pier end becomes the ship');
  // endings data for this career
  check(finishOptions(d).includes('stay') && retireKind(d) === 'retire', 'a famous champion can stay or retire (not "unknown")');
  check(typeof ENDING_CINES.world === 'function' && ENDING_CINES.world({ c, player: { x: 0 } }).some(s => s.title === ENDINGS.world.en), 'the departure scene ends on its title');
  check(stayCine({ c, player: { x: 0 } }, true).some(s => s.caption && s.caption.includes('혼자 떠났다')), 'staying when the ship is ready says so');
}
function harborAdd0(d) { const f = d.harbor.fund; morningGifts(d); return d.harbor.fund - f; }

// ---- an old save that had already beaten 고동 gets its sign
{
  for (const k of ['save2', 'save2.chk']) Save.del(k);
  const c = fresh(2); c.d.ow = { state: 'INTERNATIONAL_ROUTE_OPEN', day3: 5 }; delete c.d.harbor; c.d.record.w = 3; c.d.history = [{ won: false, opp: '갈치', day: 1 }, { won: true, opp: '멸치', day: 2 }, { won: true, opp: '갈치', day: 3 }]; delete c.d.story; c.save();
  const k = Career.load(2);
  check(harborBroken(k.d), 'an old save past 고동 gets the sign on load');
  check(k.d.story.firstMatch && k.d.story.firstMatch.opp === '갈치' && k.d.story.firstWin.opp === '멸치', 'and its first match and first win from the history');
  const k2 = fresh(3); k2.d.record.w = 60; k2.d.history = [{ won: true, opp: 'x', day: 9 }]; delete k2.d.story; k2.save();
  const k3 = Career.load(3);
  check(k3.d.story.lost === 1, 'a long old career whose history lost its first days does not invent them');
  k3.markStory({ won: true, opp: 'y', day: 10 });
  check(!k3.d.story.firstWin, 'and does not call a later win its first');
}

// ---- the office talk and which ending fits
{
  const c = fresh(1), d = c.d;
  check(!canFinish(d), 'a rookie cannot end the career on day one');
  d.record.w = 20; d.record.l = 5; check(canFinish(d), 'after 25 matches the boss will talk about it');
  d.record.w = d.record.l = 0; d.season = 2; check(canFinish(d), 'or from season 2');
  d.season = 1; d.titles.push({ name: '야항 헤비급 챔피언', season: 1, day: 9 }); check(canFinish(d), 'or after a belt');
  d.titles = []; d.fame = 40; d.season = 2;
  check(retireKind(d) === 'unknown' && finishOptions(d).join() === 'unknown', 'no belt, little fame: the unknown wrestler');
  d.fame = 130; check(retireKind(d) === 'retire', 'fame 120+: a proper retirement');
  const B = beggarState(d); B.lessons = BEGGAR.lessons.length - 1; check(!mentorOk(d), 'mentor: not before 골목 영감 taught everything');
  B.lessons = BEGGAR.lessons.length; check(mentorOk(d) && finishOptions(d).includes('mentor'), 'once he has, you can teach the next one');
  d.fame = 90; check(!mentorOk(d), 'but only if you were somebody (a belt or fame 100)');
  d.flags.champion = true; d.titles.push({ name: '야항 헤비급 챔피언', season: 2, day: 3 });
  check(finishOptions(d)[0] === 'stay' && finishOptions(d).includes('mentor'), 'the champion can stay (first), or teach');
  d.ending = { id: 'retire' }; check(!canFinish(d) && !worldReady(d), 'a finished career has no more endings to choose');
}

// ---- THE FINAL BELL: only what happened
{
  const c = fresh(1), d = c.d;
  d.contract = { opp: 'galchi', oppName: '갈치', reward: 10000, fame: 1, kind: 'official', day: d.day };
  c.applyResult('official', res(false), {});
  const H = highlights(d, 'unknown'), ks = H.map(h => h.k);
  check(ks.join() === 'start,first,end', 'a one-match career: the first step, the first match, the last choice', ks.join());
  check(H[1].sub.includes('갈치') && H[1].tone === 'loss', 'the first match says who and how it went');
  check(!ks.includes('champ') && !ks.includes('ow') && !ks.includes('harbor') && !ks.includes('rival'), 'nothing that did not happen');
  // a long career
  d.contract = { opp: 'myeolchi', oppName: '멸치', reward: 10000, fame: 1, kind: 'official', day: d.day };
  c.applyResult('official', res(true), {});
  d.h2h.dohyun = { w: 3, l: 2 }; d.flags.gangBeaten = 2; d.titles.push({ name: '야항 헤비급 챔피언', season: 1, day: 12 }); d.flags.mitbWon = 1;
  d.ow = { state: 'INTERNATIONAL_ROUTE_OPEN', day1: 15, won1: true, day3: 24, losses3: 1 };
  d.harbor = null; c.d.harbor = { stage: 'BROKEN', fund: 0, mine: 0, league: 0, fans: 0, sponsor: 0 }; d.harbor.fund = HARBOR.need; d.harbor.mine = 2400000; harborRebuild(d);
  d.ending = { id: 'world', season: 3, day: 5 };
  const H2 = highlights(d, 'world'), k2 = H2.map(h => h.k);
  check(['start', 'first', 'win', 'rival', 'raid', 'champ', 'mitb', 'ow', 'ivory', 'godong', 'harbor', 'end'].every(k => k2.includes(k)), 'a full career: every chapter it lived', k2.join());
  check(k2.indexOf('first') < k2.indexOf('win') && k2.indexOf('champ') < k2.indexOf('godong') && k2[k2.length - 1] === 'end', 'in order, the last choice last');
  check(H2.find(h => h.k === 'godong').sub.includes('1번 쓰러진'), '고동: how many times it took');
  check(H2.find(h => h.k === 'end').sub === ENDINGS.world.last, 'the last choice: on the ship with the boss');
  const S = scriptLines(d, 'world'), text = S.map(l => l.h || l.t).join('\n');
  check(S[0].h.startsWith('S#1.') && S[1].t.includes('첫 계약서'), 'the script opens in the office, as written before the first day');
  check(text.includes('챔피언 벨트를 허리에 감는다') && text.includes('선장 고동이 뱃머리를 돌린다') && text.includes(`모두 ${d.record.w + d.record.l}번 링에 오른다`), 'the script: the belt, 고동, the totals, in the present tense');
  check(S[S.length - 1].t === ENDINGS.world.script, 'and ends on the last scene');
  check(FINAL_LINES.join('|') === '당신이 승리한 경기에는 승리하기로 예정된 과거가 있었습니다.|당신이 패배한 경기에는 패배하기로 예정된 과거가 있었습니다.|당신의 미래는 처음부터 정해져 있었을지도 모릅니다.|그러나 당신이 다르게 행동했다면, 그 과거 또한 달랐을 것입니다.', 'the four lines, word for word');
  check(FINAL_QUESTIONS.join('|') === '당신은 미래의 노예입니까?|아니면 미래를 개척하는 선구자입니까?', 'the two questions, word for word');
  const C = credits(d, id => ({ boss: '구만석 사장', trainer: '백 관장' })[id] || null);
  check(C[0].big === '밤항구 슬램' && C.some(l => l.t === '파도') && C.some(l => l.t && l.t.includes('서도현')), 'the credits: the title, you, the people you fought');
  const inj = fresh(2); inj.d.ending = { id: 'unknown', cause: 'injury' };
  check(scriptLines(inj.d, 'unknown').some(l => l.t === '몸이 먼저 링을 떠난다.'), 'an injury ending says the body left first');
}

// ---- the pier's look follows the fund; the barrier holds until it is rebuilt
{
  const holes = st => { let n = 0; for (let x = PIER.x0; x < PIER.x1; x += 6) if (!plankAt(x, st)) n++; return n; };
  check(holes(0) > holes(2) && holes(2) > 0 && holes(3) === 0 && holes(4) === 0, `the deck fills in as the fund grows (${holes(0)} → ${holes(2)} → 0 gaps)`);
  check(HARBOR.x < PIER.gap[0] && HARBOR.end < LOCATIONS.street.w - 18 && HARBOR.end > PIER.far, 'the barrier stands before the collapse; the pier end is inside the street');
}
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
