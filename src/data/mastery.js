// Move mastery. Every landed use of a grapple move or the finisher in a career match gives that move experience.
// Each level adds a little damage; a few moves grow into a bigger version when the bar is full (MAX).
export const MASTERY = {
  levels: [0, 20, 50, 90, 140, 200],   // experience where Lv1..Lv5 start (Lv5 = MAX)
  bonus: .03,                           // damage per level: +15% at MAX
  use: 10,                              // experience per landed use
  cap: 4,                               // uses counted per move per match
  practice: .5,                         // sparring counts half
};
export const MAX_LV = MASTERY.levels.length - 1;
// at MAX the move evolves: it is learned and takes the old one's place in every slot (the old one stays learned)
export const EVOLVE = { bulldog: 'runningBulldog', suplex: 'f5', bodySlam: 'powerSlam', german: 'dragonSuplex' };
export const EVOLVED_FROM = Object.fromEntries(Object.entries(EVOLVE).map(([a, b]) => [b, a]));
export const finKey = id => 'fin:' + id;
export function masteryLv(xp = 0) { const L = MASTERY.levels; let lv = 0; while (lv < MAX_LV && xp >= L[lv + 1]) lv++; return lv; }
export function masteryInfo(xp = 0) {
  const L = MASTERY.levels, lv = masteryLv(xp), max = lv >= MAX_LV;
  return { lv, max, xp, from: L[lv], to: max ? L[lv] : L[lv + 1], k: max ? 1 : (xp - L[lv]) / (L[lv + 1] - L[lv]), bonus: lv * MASTERY.bonus };
}
export const lvText = lv => (lv >= MAX_LV ? 'MAX' : 'Lv' + lv);
