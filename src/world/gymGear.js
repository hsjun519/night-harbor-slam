// Training equipment. Every station in the gym has four grades: the one it came with, and three that 백 관장 talks
// you into buying once you have outgrown the last ("강해진 만큼 더 강한 훈련기구를 사야하지 않겠어?"). Each grade
// costs more, plays harder (faster, or a new game: typing for the bench, a rhythm game for the rope, snake for the
// mitts), tires you more, and trains more. d.gym = { tier: { station: n }, runs: { station: n }, pitched: { station: n } }
export const GEAR = {
  bench: [
    { name: '낡은 벤치', price: 0 },
    { name: '올림픽 바벨', price: 90000, speed: 1.4, zone: .8 },
    { name: '파워 랙', price: 220000, mech: 'typing', target: 16, time: 12 },
    { name: '크레인 바벨', price: 480000, mech: 'typing', target: 22, time: 11, len: 6 },
  ],
  rope: [
    { name: '줄넘기', price: 0 },
    { name: '쇠 손잡이 줄', price: 80000, gap: .38 },
    { name: '박자 발판', price: 200000, mech: 'rhythm', lanes: 3, notes: 22, speed: 1 },
    { name: '번개 발판', price: 450000, mech: 'rhythm', lanes: 4, notes: 30, speed: 1.35 },
  ],
  mitt: [
    { name: '미트', price: 0 },
    { name: '스파링 미트', price: 85000, len: 4 },
    { name: '스텝 매트', price: 210000, mech: 'snake', step: .15, target: 8 },
    { name: '번개 스텝 매트', price: 460000, mech: 'snake', step: .1, target: 10 },
  ],
  bridge: [
    { name: '목 브릿지', price: 0 },
    { name: '무게 조끼', price: 80000, force: 1.35 },
    { name: '흔들 발판', price: 190000, force: 1.7, time: 12 },
    { name: '파도 발판', price: 420000, force: 2.1, time: 14 },
  ],
  breath: [
    { name: '호흡 훈련', price: 0 },
    { name: '고지대 마스크', price: 75000, fill: 1.35, band: .8 },
    { name: '잠수 수조', price: 180000, fill: 1.7, band: .65 },
    { name: '심해 수조', price: 400000, fill: 2.1, band: .55 },
  ],
};
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
