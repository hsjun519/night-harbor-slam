// Training equipment. Every station in the gym has four grades: the one it came with, and three that 백 관장 talks
// you into buying once you have outgrown the last ("강해진 만큼 더 강한 훈련기구를 사야하지 않겠어?"). Each grade
// costs more, tires you more, trains more, and is trained a different way: no two grades of a station share a game.
// d.gym = { tier: { station: n }, runs: { station: n }, pitched: { station: n } }
export const GEAR = {
  bench: [
    { name: '낡은 벤치', price: 0 },
    { name: '올림픽 바벨', price: 90000, mech: 'mash', k: 1 },
    { name: '파워 랙', price: 220000, mech: 'typing', target: 16, time: 12 },
    { name: '크레인 바벨', price: 480000, mech: 'rhythm', lanes: 3, notes: 24, speed: 1.15 },
  ],
  rope: [
    { name: '줄넘기', price: 0 },
    { name: '쇠 손잡이 줄', price: 80000, mech: 'rhythm', lanes: 2, notes: 20, speed: .95 },
    { name: '스텝 사다리', price: 200000, mech: 'snake', step: .14, target: 8 },
    { name: '번개 발판', price: 450000, mech: 'react', win: .7, total: 14 },
  ],
  mitt: [
    { name: '미트', price: 0 },
    { name: '스파링 미트', price: 85000, mech: 'react', win: .85, total: 12 },
    { name: '스텝 매트', price: 210000, mech: 'snake', step: .13, target: 9 },
    { name: '번개 미트', price: 460000, mech: 'rhythm', lanes: 4, notes: 28, speed: 1.3 },
  ],
  bridge: [
    { name: '목 브릿지', price: 0 },
    { name: '무게 조끼', price: 80000, mech: 'mash', k: 1.2 },
    { name: '흔들 발판', price: 190000, mech: 'breath', fill: 1.4, band: .8 },
    { name: '파도 발판', price: 420000, mech: 'react', win: .75, total: 14 },
  ],
  breath: [
    { name: '호흡 훈련', price: 0 },
    { name: '고지대 마스크', price: 75000, mech: 'rope', gap: .42 },
    { name: '잠수 수조', price: 180000, mech: 'bridge', force: 1.5, time: 12 },
    { name: '심해 수조', price: 400000, mech: 'rhythm', lanes: 4, notes: 26, speed: 1.2 },
  ],
};
// the games, by name (the base game of a station is named after the station)
export const MECH_NAME = { bench: '타이밍', rope: '박자', mitt: '순서 기억', bridge: '균형', breath: '호흡', typing: '타자', rhythm: '리듬 발판', snake: '스텝', mash: '연타', react: '반응' };
export const mechOf = (id, tier) => (GEAR[id] && GEAR[id][tier] && GEAR[id][tier].mech) || id;
export const GEAR_GAIN = .4, GEAR_TIRE = .5, GEAR_COST = .5;   // per grade: training effect, fatigue, session fee
export const gymOf = d => d.gym || (d.gym = { tier: {}, runs: {}, pitched: {} });
export const tierOf = (d, id) => (GEAR[id] ? gymOf(d).tier[id] || 0 : 0);
export const gearNow = (d, id) => (GEAR[id] ? GEAR[id][tierOf(d, id)] : null);
export const gearNext = (d, id) => (GEAR[id] ? GEAR[id][tierOf(d, id) + 1] || null : null);
// what one session gives and costs at this grade
export const gainK = (d, id) => 1 + GEAR_GAIN * tierOf(d, id);
export const tireOf = (d, id) => Math.round(14 * (1 + GEAR_TIRE * tierOf(d, id)));
export const feeK = (d, id) => 1 + GEAR_COST * tierOf(d, id);
// has this station been outgrown? enough sessions on it, and the stats it trains caught up with the grade
export function outgrown(d, id, stats) {
  const G = gymOf(d), t = tierOf(d, id), next = gearNext(d, id);
  if (!next) return false;
  const runs = G.runs[id] || 0, lv = stats.length ? stats.reduce((s, k) => s + ((d.lv && d.lv[k]) || 0), 0) / stats.length : 0;
  return runs >= 3 * (t + 1) && lv >= 3 * (t + 1) && (G.pitched[id] || 0) <= t;
}
export function buyGear(c, id) {
  const d = c.d, next = gearNext(d, id);
  if (!next || !c.pay(next.price)) return false;
  gymOf(d).tier[id] = tierOf(d, id) + 1;
  return true;
}
