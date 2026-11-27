// Ring entrances as data. A tier sets the defaults; a wrestler's own entry changes only what makes them different,
// so a new officer or world champion needs a line here and nothing in the entrance code.
//   tier      normal | known | rival | officer | champion | king | world   (stronger tiers walk out last)
//   theme     music track while they walk out
//   screen    { col, icon, en }: big-screen colour, a small picture (rope | fog | wave | whale | belt | star), an English billing
//   light     { col, dim }: the hall darkens by dim (0..1) and a spotlight in col follows them
//   fog       mist creeping along the floor     flames: 0 | 1 (pyro at the aisle) | 2 (big columns, both sides)
//   cam       follow | close | low              walk: px/s down the aisle      pose: none | taunt | belt | bow | roar
//   crowd     cheer | boo | mixed | sailors | chant | hush (then a roar)          escort: ids who walk out with them
//   titles    lines shown big once they stand in the ring      horn: foghorn blasts      fadeOut: hall music dies first
//   pre       seconds of light and sound before they show       hold: seconds of the pose       skip: Enter skips it
export const TIER_RANK = { normal: 0, known: 1, rival: 2, officer: 3, champion: 4, king: 5, world: 6 };
export const ENTRANCE_TIERS = {
  normal: { theme: 'match', light: null, fog: 0, flames: 0, cam: 'follow', walk: 150, pose: 'none', crowd: 'cheer', pre: .3, hold: .5, skip: 1 },
  known: { theme: 'match', light: { col: '#49d6ff', dim: .25 }, fog: 0, flames: 0, cam: 'follow', walk: 125, pose: 'taunt', crowd: 'cheer', pre: .6, hold: 1, skip: 1 },
  rival: { theme: 'rival', light: { col: '#b066d8', dim: .35 }, fog: 0, flames: 0, cam: 'follow', walk: 115, pose: 'taunt', crowd: 'mixed', pre: .9, hold: 1.3, skip: 1 },
  officer: { theme: 'boss', light: { col: '#e6f2ff', dim: .35 }, fog: 0, flames: 1, cam: 'close', walk: 105, pose: 'bow', crowd: 'cheer', pre: 1.2, hold: 1.3, skip: 1 },
  champion: { theme: 'title', light: { col: '#ffd65a', dim: .3 }, fog: 0, flames: 1, cam: 'close', walk: 110, pose: 'belt', crowd: 'chant', pre: 1, hold: 1.7, skip: 1, belt: 1 },
  king: { theme: 'boss', light: { col: '#5a5aa8', dim: .8 }, fog: 0, flames: 0, cam: 'close', walk: 70, pose: 'roar', crowd: 'hush', pre: 2.2, hold: 2.2, skip: 1 },
  world: { theme: 'title', light: { col: '#ffffff', dim: .5 }, fog: 0, flames: 2, cam: 'close', walk: 95, pose: 'belt', crowd: 'chant', pre: 2, hold: 2.4, skip: 1, belt: 1 },
};
export const ENTRANCES = {
  // 야항 레슬링의 왕: the hall goes dark, mist along the floor, a shape in the fog walking slowly; the fog lifts at the ring
  fogking: { tier: 'king', fog: 1, light: { col: '#6a5ab8', dim: .82 }, screen: { col: '#9aa3c2', icon: 'fog', en: 'KING OF THE FOG' }, silhouette: 1, walk: 60, crowd: 'hush', titles: ['야항 레슬링의 왕', '안개왕'] },
  // 선항 레슬링 간부: a ship's horn, cold white light, waves on the board, pyro on both sides of the aisle, the deckhands cheering
  whiteivory: { tier: 'officer', horn: 1, light: { col: '#e6f2ff', dim: .38 }, screen: { col: '#e6f2ff', icon: 'wave', en: 'WHITE IVORY' }, flames: 1, crowd: 'sailors', pose: 'bow', escort: ['owsailor'], titles: ['WHITE IVORY', '흰상아'] },
  // 선항 레슬링의 왕: everything fades, a low call and the horn, the whale on the board, blue-white light, huge flames,
  // the officers and deckhands react, a slow walk the camera keeps close to, a roar at the ring and three lines of billing
  godong: { tier: 'king', fadeOut: 1, horn: 2, light: { col: '#9fd6ff', dim: .9 }, screen: { col: '#9fd6ff', icon: 'whale', en: 'KING OF THE OCEAN' }, flames: 2, escort: ['whiteivory', 'owsailor'], walk: 52, cam: 'low', crowd: 'hush', pre: 3, hold: 2.8, titles: ['OCEAN WRESTLING', 'KING OF THE OCEAN', '고동 — 흰긴수염고래'] },
  // BLACK ROPE: red-purple light, their theme, the crew's name on the board, boos and cheers at once, a taunt at you
  brLeader: { tier: 'rival', screen: { col: '#b066d8', icon: 'rope', en: 'BLACK ROPE' }, light: { col: '#b066d8', dim: .42 }, escort: ['brPower', 'brShow'], crowd: 'mixed', pose: 'taunt' },
  brPower: { tier: 'rival', screen: { col: '#c2333f', icon: 'rope', en: 'BLACK ROPE' }, light: { col: '#c2333f', dim: .4 }, walk: 95, pose: 'roar' },
  brSpeed: { tier: 'rival', screen: { col: '#d98cff', icon: 'rope', en: 'BLACK ROPE' }, light: { col: '#d98cff', dim: .38 }, walk: 160 },
  brTech: { tier: 'rival', screen: { col: '#9be3ff', icon: 'rope', en: 'BLACK ROPE' }, light: { col: '#9be3ff', dim: .38 }, pose: 'bow' },
  brShow: { tier: 'rival', screen: { col: '#ffd65a', icon: 'star', en: 'BLACK ROPE' }, light: { col: '#ffd65a', dim: .35 }, flames: 1, crowd: 'mixed' },
  // the rest of the league: a few well-known names get their light
  dohyun: { tier: 'rival', theme: 'match', light: { col: '#49d6ff', dim: .3 }, crowd: 'cheer', pose: 'taunt' },
  baekpa: { tier: 'known', light: { col: '#e6e9f2', dim: .3 }, pose: 'bow' },
  bjorn: { tier: 'known', light: { col: '#c9a25a', dim: .3 }, pose: 'roar' },
  taesan: { tier: 'known', light: { col: '#ff8a2b', dim: .25 } },
  ironma: { tier: 'known', light: { col: '#3fd46b', dim: .3 } },
  gosu: { tier: 'known', light: { col: '#3fd46b', dim: .3 } },
};
// the player's entrance grows with the career: 신인 → 지역 유망주 → 유명 선수 → 지역 챔피언 → 전국적인 스타 → 세계 챔피언
export const PLAYER_STAGES = {
  rookie: { tier: 'normal', label: '신인', crowd: 'cheer', pose: 'none' },
  prospect: { tier: 'normal', label: '지역 유망주', crowd: 'cheer', pose: 'taunt', screen: { col: '#49d6ff' } },
  known: { tier: 'known', label: '유명 선수', theme: 'gym', light: { col: '#3fe0d0', dim: .3 } },
  champion: { tier: 'champion', label: '지역 챔피언', screen: { col: '#ffd65a', icon: 'belt' } },
  star: { tier: 'champion', label: '전국적인 스타', flames: 2, screen: { col: '#ffd65a', icon: 'star' }, pre: 1.4, hold: 2 },
  world: { tier: 'world', label: '세계 챔피언', screen: { col: '#ffffff', icon: 'star', en: 'WORLD CHAMPION' } },
};
export function playerStage(d) {
  if (!d) return 'rookie';
  const f = d.flags || {}, titles = (d.titles || []).length;
  if (f.worldChampion) return 'world';
  if (f.champion && (titles >= 2 || d.fame >= 90)) return 'star';
  if (f.champion) return 'champion';
  if (d.fame >= 30) return 'known';
  if (d.fame >= 10) return 'prospect';
  return 'rookie';
}
// one fighter's entrance: tier defaults, then the wrestler's own line (or the player's stage), then the match's say
export function resolveEntrance(id, o = {}) {
  const own = o.player ? PLAYER_STAGES[o.stage || 'rookie'] : ENTRANCES[id] || {};
  let tier = own.tier || 'normal';
  if (o.belt && TIER_RANK[tier] < TIER_RANK.champion) tier = 'champion';   // whoever holds the belt tonight walks out as the champion
  const base = ENTRANCE_TIERS[tier], E = Object.assign({}, base, own, { tier });
  if (o.belt && !own.screen) E.screen = { col: '#ffd65a', icon: 'belt' };
  if (o.belt) E.belt = 1;
  E.screen = Object.assign({ col: '#ffffff', icon: null, en: null }, E.screen || {});
  if (o.seen && tier === 'normal') { E.pre = .15; E.hold = .2; E.walk = Math.max(E.walk, 190); E.pose = 'none'; }   // a familiar face: keep it short
  const k = o.short ? .45 : 1;
  E.pre *= k; E.hold *= k; if (o.short) E.walk *= 1.6;
  return E;
}
