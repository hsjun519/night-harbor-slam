// The harbour championship and 야항 레슬링: the belt has stood empty since 등화 gave it back; a ticket from the league's
// qualifier (2nd or better, fame 45) or from 야항 (two wins over its regulars, then 안개왕), then the final in the dome.
// The prologue keeps the answer to the boss's question. Old saves where 안개왕 held the belt find it vacant.
// Run: node tests/yahang.mjs
import { Career } from '../src/world/CareerManager.js';
import { Save } from '../src/core/SaveManager.js';
import { CHARACTERS } from '../src/data/characters.js';
import { YAHANG, yahangOf, yahangFoe, yahangSteps, fogClearsCine } from '../src/world/yahang.js';
import { MOTIVES, prologueCine, bossStory, championshipTalk, CATCHPHRASE } from '../src/world/prologue.js';

let fails = 0;
const check = (ok, what, extra = '') => { if (ok) console.log('ok  ', what); else { fails++; console.log('FAIL', what, extra); } };
const look = { build: 'athletic', skin: 'tan', head: { face: 'square', hair: 'side', hairCol: '#222' }, top: { kind: 'none' }, bottom: { kind: 'tights', c1: '#157f8c', c2: '#ffd65a' }, boots: { c1: '#222' } };
const fresh = () => { for (const k of ['save2', 'save2.chk']) Save.del(k); return Career.create(2, { name: '파도', style: 'all', look }); };
const res = won => ({ human: { dmgTaken: 10, ko: false, finishersTaken: 0, ringOuts: 0 }, won, draw: false, result: { how: 'pin', winner: null } });
{
  const c = fresh(), d = c.d;
  check(c.champion === null && !d.champ, 'a new career: the harbour title is vacant');
  d.day = 9; d.fame = 30; let O = c.makeOffers();
  check(!O.some(o => o.qualifier || o.final), 'no qualifier while you are low and unknown');
  const me = c.rankList().find(e => e.id === 'player'); d.flags.rankPts = c.rankList()[0].pts + 50; d.fame = 50; d.offers = []; d.offersDay = 0;
  O = c.makeOffers(); const q = O.find(o => o.qualifier);
  check(c.rank <= 2 && q && q.kind === 'official' && CHARACTERS[q.opp], 'near the top with fame 45: the boss books the qualifier', q && q.oppName);
  c.applyResult('official', res(true), { offer: q });
  check(d.flags.ticket === 'league', 'winning it is the league ticket');
  d.offers = []; d.offersDay = 0; O = c.makeOffers(); const f = O.find(o => o.final);
  check(f && f.title && f.kind === 'title' && f.opp === c.finalist(), 'with a ticket: the final in the dome against the other finalist', f && f.oppName);
  const d2 = JSON.parse(JSON.stringify(d));
  c.applyResult('title', res(true), { offer: f });
  check(d.flags.champion && d.titles.some(t => t.name === '항구 헤비급 챔피언') && !d.flags.ticket, 'winning the final: 항구 헤비급 챔피언');
  // losing it instead: the other finalist holds the belt, and the old title shot is against them
  const c2 = fresh(); Object.assign(c2.d, d2); c2.applyResult('title', res(false), { offer: f });
  check(c2.d.champ === f.opp && !c2.d.flags.ticket && !c2.d.flags.champion, 'losing the final: the other finalist is champion');
  void me;
}
{
  const c = fresh(), d = c.d, Y = yahangOf(d), W = { c, startMatch() {}, toast() {}, game: { audio: { sfx() {} } }, player: { x: 300 }, npcs: [] };
  let st = yahangSteps(c, W), ch = st[st.length - 1].choice.map(x => x.label);
  check(CHARACTERS[yahangFoe(d)] && YAHANG.pool.includes(yahangFoe(d)) && !ch.some(l => l.includes('안개왕')), '야항: a regular of the cellar tonight; 안개왕 not yet', ch.join(' | '));
  Y.wins = YAHANG.need; st = yahangSteps(c, W); ch = st[st.length - 1].choice.map(x => x.label);
  check(ch[0].includes('안개왕'), `after ${YAHANG.need} wins 안개왕 steps into the ring`);
  const cine = fogClearsCine(W), says = cine.filter(s => s.say).flatMap(s => s.say), texts = says.map(s => s.text || '').join('\n');
  check(texts.includes('좋은 경기였다.') && texts.includes('오랜만에 왕이 아니라 한 명의 레슬러로서 경기한 기분이군.'), 'THE FOG CLEARS: his words');
  check(cine.some(s => s.title === 'THE FOG CLEARS'), 'its title card');
  says.filter(s => s.act).forEach(s => s.act());
  check(d.flags.ticket === 'yahang' && Y.king === 1, 'the 야항 ticket, and the king beaten');
  const ch2 = says.find(s => s.choice), offer = ch2 && ch2.choice[0].go.map(s => s.text).join(' ');
  check(offer && offer.includes('영입 제안') && offer.includes('누군가의 이름 아래에서'), 'asked, 등화 tells of the offer he turned down');
}
{
  const c = fresh(), d = c.d, W = { c, game: { audio: { sfx() {} } } };
  const P = prologueCine(W), titles = P.filter(s => s.title).map(s => s.title), caps = P.filter(s => s.caption).map(s => s.caption).join(' ');
  check(titles.includes('THE BIRTH OF A NEW WRESTLER') && caps.includes('경력 무관. 신인 환영.') && caps.includes('누구에게나 첫 번째 경기는 있다.'), 'the prologue: the title, the flyer');
  const say = P.find(s => s.say).say, q = say.find(s => s.choice);
  check(say.some(s => s.text === '그래, 자네는 왜 레슬러가 되고 싶은 건가?') && q.choice.length === 5 && say.some(s => s.text === '좋아! 그럼 일단 링에 올라가 보라고!'), 'the boss asks why, five answers');
  q.choice[2].go[0].act(); check(d.motive === MOTIVES[2].id, 'the answer is kept');
  check(bossStory(c).some(s => s.text === CATCHPHRASE) && bossStory(c).some(s => s.text.includes(MOTIVES[2].echo)), 'the boss tells his story, ends on "자, 오늘도 멋진 경기 한 번 만들어 보자고!", and remembers the answer');
  championshipTalk(c).forEach(s => s.act && s.act());
  check(d.flags.basementKnown, 'he tells of the two tickets and the stairs down to 야항');
}
{
  const c = fresh(), d = c.d; d.champ = 'fogking'; d.flags.champion = false; c.migrate();
  check(d.champ === null, 'an old save where 안개왕 held the belt: the title is vacant now');
}
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
