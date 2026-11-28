// 야항 레슬링 (the night harbour): the independent night league 등화 founded in the cellar under the old fish market
// after he gave the harbour belt back twelve years ago. Not a branch of anybody: its own records, its own rules, its
// own king. Two wins over its regulars earn a night with 안개왕; beating him earns 야항's ticket to the harbour
// championship (THE FOG CLEARS) and 등화 takes the mask off. Its story is complete there; you can keep fighting in it.
//   d.yahang = { wins, king, met }
import { CHARACTERS } from '../data/characters.js';
import { LOOKS } from '../data/looks.js';

export const YAHANG = { pool: ['dueok', 'palcho', 'baeksang', 'bokja', 'ironma', 'gosu'], need: 2, reward: 30000, kingReward: 120000 };
export const yahangOf = d => d.yahang || (d.yahang = { wins: 0, king: 0, met: 0 });
export function yahangFoe(d) { const Y = yahangOf(d), P = YAHANG.pool.filter(id => CHARACTERS[id]); return P[(d.day * 7 + Y.wins * 3 + (d.season || 1)) % P.length]; }
const Y_ = text => ({ who: null, name: '야항 레슬링', text });
// the board by the cellar ring
export function yahangSteps(c, W) {
  const d = c.d, Y = yahangOf(d), first = !Y.met;
  Y.met = 1;
  const foe = yahangFoe(d), name = CHARACTERS[foe].name, out = [];
  if (first) out.push(Y_('"야항 레슬링 — 공식 무대가 외면한 레슬러들의 밤." 손때 묻은 게시판에 오늘 밤 대진이 붙어 있다.'), Y_('"여기서는 이름도 공식 랭킹도 소용없다. 이 링에서 보여 준 것만 남는다. 챔피언이었던 자도 여기서는 처음부터다." — 안개왕'));
  out.push(Y_(Y.king ? `야항 전적 ${Y.wins}승. 안개왕을 꺾은 이름이 게시판 맨 위에 적혀 있다.` : `야항 전적 ${Y.wins}승. 야항 정규 선수를 ${YAHANG.need}번 이기면 안개왕이 링에 선다.`));
  const ch = [{ label: `오늘 밤의 상대: ${name} (야항 정규전)`, act: () => W.startMatch('yahang', { opp: foe, oppName: name, kind: 'yahang', arena: 'basement', reward: YAHANG.reward + (d.season || 1) * 10000, fame: 5, difficulty: (d.season || 1) >= 2 ? 'hard' : 'normal' }) }];
  if (!Y.king && Y.wins >= YAHANG.need) ch.unshift({ label: '안개왕에게 도전한다', act: () => W.startMatch('yahangKing', { opp: 'fogking', oppName: '안개왕', kind: 'yahangKing', arena: 'basement', reward: YAHANG.kingReward, fame: 18, difficulty: (d.season || 1) >= 2 ? 'expert' : 'hard' }) });
  if (Y.king) ch.push({ label: '등화와 이야기한다', go: donghwaTalk(d) });
  ch.push({ label: '그만두기', go: [] });
  out.push({ prompt: '야항 레슬링', choice: ch });
  return out;
}
const DH = (text, o = {}) => Object.assign({ who: 'donghwa', text }, o);
// THE FOG CLEARS: 안개가 걷히다. He owns the defeat, hands over the ticket, takes off the mask.
export function fogClearsCine(W) {
  const c = W.c, d = c.d, x = W.player.x, s = x < 380 ? 1 : -1;
  return [
    { bars: 1 }, { music: 'title' },
    { title: 'THE FOG CLEARS', sub: '안개가 걷히다', dur: 2.8 },
    { spawn: 'fogking', x: x + s * 70, face: -s },
    { face: 'me', dir: 'fogking' },
    { say: [
      { who: 'fogking', text: '좋은 경기였다.' },
      { who: 'fogking', text: '오랜만에 왕이 아니라 한 명의 레슬러로서 경기한 기분이군.' },
      { who: 'fogking', text: '받아라. 야항의 문장이 새겨진 항구 챔피언십 출전권이다. 이 지하에서 보여 준 것을 그 위에서도 보여 줘라.' },
      { act: () => { const Y = yahangOf(d); Y.king = 1; if (!d.flags.champion && !d.champ) d.flags.ticket = d.flags.ticket || 'yahang'; c.save(); W.toast('항구 챔피언십 출전권 — 야항 대표', '#c9b6ff'); W.game.audio.sfx('good'); } },
    ] },
    { act: () => { const a = W.npcs.find(n => n.id === 'fogking' && n.cine) || W.npcs.find(n => n.id === 'fogking'); if (a) { a.look = LOOKS.donghwa; a.faceExpr = 'neutral'; } }, with: 0 },
    { flash: [1, 1, 1, .5] }, { sfx: 'whoosh' },
    { caption: '가면이 벗겨지자, 안개 속에서 오래된 얼굴이 드러났다.', dur: 2.6 },
    { say: [
      DH('…이 얼굴을 기억하는 사람이 아직 있을까. 등화. 12년 전, 이 도시의 챔피언이었다.'),
      DH('내 이름 때문에 신인들이 링에 오르지 못했다. 사람들은 내 경기가 아니라 내 이름과 벨트를 보러 왔지.'),
      DH('그래서 벨트를 반납하고, 기회를 얻지 못한 녀석들과 이 지하에 야항을 세웠다. 가면은 이름을 내려놓기 위해서였고.'),
      DH('구 사장은 처음부터 알고 있었을 거다. 그 사람이 내 경기를 잡아 주던 시절이 있었으니.'),
      { prompt: '등화에게', choice: [
        { label: '다른 데서 부른 적은 없었습니까?', go: [DH('예전에 바다를 돌아다니는 거대한 레슬링 단체에서 영입 제안을 받은 적이 있네.'), DH('좋은 조건이었지만 거절했지.'), DH('나는 또다시 누군가의 이름 아래에서 레슬링하고 싶지 않았으니까.')] },
        { label: '(고개를 숙여 인사한다)', go: [DH('됐다. 인사는 결승이 끝나고 받지.')] },
      ] },
    ] },
    { bars: 0 }, { act: () => { d.flags.fogCleared = 1; c.save(); } },
  ];
}
// after the reveal, 등화 at the board
function donghwaTalk(d) {
  return [
    DH(d.flags.champion ? '챔피언이 됐다더군. 벨트가 무겁지? 그 무게에 짓눌리지 마라. 경기가 먼저다.' : d.flags.ticket ? '결승이 남았다. 야항의 이름이 아니라 네 이름으로 싸워라.' : '야항은 계속된다. 기회를 못 얻은 녀석들이 있는 한.'),
    DH('…바다 쪽에서 낮은 뱃고동이 들리는 밤이 있다. 그런 밤엔 마음이 편치 않아.'),
  ];
}
