// Solo animation data: stances, gaits and state clips. Times are seconds unless a clip says norm.
import { EASE, clamp01 } from '../core/util.js';
import { pose, poseLerp, POSE_N } from './skeleton.js';

// ---- stances -------------------------------------------------------------------------------
export const STANCES = {
  std: { a: 'sp8 hd-4 a18/98 b58/84 t18/18 u-20/14', b: 'sp9 hd-4 a20/94 b60/80 t20/22 u-19/18', dur: .95, walk: 1, open: 0 },
  power: { a: 'sp12 hd-8 a34/58 b58/58 t24/24 u-26/18', b: 'sp14 hd-9 a30/62 b54/62 t26/28 u-25/22', dur: 1.25, walk: 1.05, open: 0 },
  air: { a: 'sp5 hd-3 a34/80 b70/66 t12/16 u-16/18 lift1', b: 'sp7 hd-3 a38/74 b66/72 t18/28 u-12/26', dur: .56, walk: .95, open: 1 },
  tech: { a: 'sp18 hd-12 a52/52 b76/44 t30/40 u-20/26', b: 'sp19 hd-12 a48/58 b72/50 t32/44 u-19/30', dur: 1.1, walk: .95, open: 1 },
  box: { a: 'sp10 hd-2 a44/122 b62/108 t20/22 u-22/16', b: 'sp12 hd-2 a48/116 b66/102 t24/28 u-20/20', dur: .5, walk: .95, open: 0 },
  heavy: { a: 'sp2 hd-2 a26/46 b44/50 t18/12 u-18/10', b: 'sp4 hd-3 a24/50 b42/54 t19/15 u-17/13', dur: 1.4, walk: 1.1, open: 1 },
  dance: { a: 'sp-2 hd2 a-14/70 b92/30 t10/8 u-24/16', b: 'sp6 hd-4 a30/76 b60/70 t24/26 u-10/20', dur: .6, walk: .95, open: 1 },
  fog: { a: 'sp1 hd4 a6/16 b10/18 t8/4 u-9/5', b: 'sp2 hd5 a7/18 b11/20 t8/5 u-9/6', dur: 2.2, walk: 1.15, open: 1 },
  street: { a: 'sp-4 hd0 a-8/34 b20/110 t14/8 u-14/8', b: 'sp-2 hd-1 a-6/38 b22/114 t15/10 u-13/10', dur: 1.1, walk: 1, open: 0 },
  oni: { a: 'sp22 hd-16 a50/30 b30/40 t34/44 u-24/34', b: 'sp26 hd-18 a44/36 b36/36 t38/50 u-22/40', dur: .8, walk: 1, open: 1 },
  // out-of-ring standing poses
  calm: { a: 'sp1 hd0 a4/12 b-2/14 t5/3 u-6/4', b: 'sp2 hd1 a5/14 b-1/16 t5/4 u-6/5', dur: 1.9, walk: 1, open: 0 },
  npcA: { a: 'sp0 hd0 a6/16 b0/14 t4/3 u-5/4', b: 'sp1 hd1 a8/18 b1/16 t4/4 u-5/5', dur: 2.1, walk: 1, open: 0 },
  arms: { a: 'sp-3 hd-2 a30/92 b38/88 t7/4 u-8/5', b: 'sp-2 hd-1 a31/94 b39/90 t7/5 u-8/6', dur: 2.3, walk: 1, open: 0 },
  hips: { a: 'sp-3 hd-1 a-28/70 b26/70 t9/5 u-9/5', b: 'sp-2 hd0 a-27/72 b27/72 t9/6 u-9/6', dur: 1.7, walk: 1, open: 0 },
  lean: { a: 'sp-10 hd6 a-16/30 b20/100 t20/6 u-4/10', b: 'sp-9 hd5 a-15/32 b21/102 t20/7 u-4/11', dur: 2.4, walk: 1, open: 0 },
  elder: { a: 'sp16 hd-12 a-26/40 b-20/44 t8/12 u-10/12', b: 'sp17 hd-12 a-25/42 b-19/46 t8/13 u-10/13', dur: 2.2, walk: .9, open: 0 },
  write: { a: 'sp8 hd12 a30/80 b44/76 t5/4 u-6/4', b: 'sp9 hd13 a32/84 b44/76 t5/5 u-6/5', dur: .7, walk: 1, open: 0 },
  hawk: { a: 'sp2 hd-8 a120/70 b10/40 t8/6 u-10/6', b: 'sp4 hd-4 a96/80 b14/36 t9/8 u-9/8', dur: .7, walk: 1, open: 1 },
};
export function stancePose(name, t, out) {
  const s = STANCES[name] || STANCES.std;
  const k = .5 - .5 * Math.cos((t / s.dur) * Math.PI * 2);
  return poseLerp(pose(s.a), pose(s.b), k, out);
}

// ---- gaits: overwrite the legs and swing the arms of a stance pose -------------------------
export function gaitPose(p, phase, kind, amt = 1) {
  const n = phase, f = phase + Math.PI, run = kind === 'run';
  const leg = ph => {
    const s = Math.sin(ph), sw = Math.max(0, Math.sin(ph + (run ? 2.25 : 2.2)));
    return run ? [46 * s + 16, 20 + 82 * sw] : [26 * s + 3, 9 + 44 * Math.pow(sw, 1.15)];
  };
  const a = leg(n), b = leg(f);
  for (const [i, v] of [[7, a[0]], [8, a[1]], [9, b[0]], [10, b[1]]]) p[i] = p[i] + (v - p[i]) * amt;
  const sw = Math.sin(phase) * amt;
  if (run) { p[1] += (22 - p[1]) * amt; p[2] += (-12 - p[2]) * amt; p[3] += (-46 * sw + 10 - p[3]) * amt; p[4] += (84 - p[4]) * amt; p[5] += (46 * sw + 10 - p[5]) * amt; p[6] += (84 - p[6]) * amt; p[11] += Math.abs(Math.cos(phase)) * 2.5 * amt; }
  else { p[3] -= 15 * sw; p[5] += 15 * sw; p[1] += 2 * amt; }
  return p;
}

// ---- state clips ---------------------------------------------------------------------------
/* keys: [t, pose, ease]. The ease describes how the previous key travels to this one. */
const CLIP_SRC = {
  jump: { keys: [[0, 'sp16 hd-10 a-30/40 b-20/40 t50/80 u40/80'], [.09, 'sp2 hd-8 a120/40 b130/30 t20/10 u-14/20 lift2', 'out'], [.4, 'sp4 hd-4 a70/60 b90/40 t44/60 u4/50']], air: 1 },
  fall: { keys: [[0, 'sp6 hd-2 a90/40 b100/30 t40/56 u4/44'], [.25, 'sp10 hd4 a130/20 b140/20 t26/30 u-10/34']], air: 1 },
  land: { keys: [[0, 'sp30 hd-16 a30/40 b44/40 t64/84 u34/84 sq.16'], [.16, 'sp12 hd-6 a20/80 b50/80 t26/30 u-16/26', 'out']] },
  guard: { keys: [[0, 'sp14 hd10 a64/128 b72/120 t26/34 u-24/26'], [.4, 'sp15 hd11 a62/130 b70/122 t27/36 u-23/28']], loop: 1 },
  guardHit: { keys: [[0, 'sp-6 hd14 a70/128 b76/124 t30/40 u-30/10'], [.2, 'sp14 hd10 a64/128 b72/120 t26/34 u-24/26', 'out']] },
  parry: { keys: [[0, 'sp4 hd0 a100/60 b60/100 t26/30 u-28/14'], [.1, 'sp-8 hd-6 a130/30 b40/90 t14/16 u-30/10', 'out'], [.34, 'sp10 hd-4 a30/80 b55/90 t18/18 u-20/14', 'io']] },
  hitF: { keys: [[0, 'sp-4 hd-10 a20/60 b40/60 t14/18 u-18/16'], [.06, 'sp-24 hd-26 a-16/50 b4/60 t26/24 u-24/6', 'out'], [.26, 'sp-6 hd-4 a20/80 b50/80 t18/18 u-20/14', 'io']] },
  hitB: { keys: [[0, 'sp10 hd6 a10/50 b30/60 t14/18 u-18/16'], [.06, 'sp34 hd20 a-40/30 b-20/40 t30/30 u-20/20', 'out'], [.26, 'sp12 hd-4 a20/80 b50/80 t18/18 u-20/14', 'io']] },
  hitLow: { keys: [[0, 'sp10 hd6 a10/50 b30/60 t14/18 u-18/16'], [.06, 'sp42 hd10 a20/70 b30/80 t34/44 u-12/40', 'out'], [.28, 'sp12 hd-4 a20/80 b50/80 t18/18 u-20/14', 'io']] },
  hitHeavy: { keys: [[0, 'sp-10 hd-20 a10/40 b20/40 t14/18 u-18/16'], [.08, 'sp-40 hd-30 a40/20 b70/20 t40/20 u-20/6 lift2', 'out'], [.22, 'sp-26 hd-16 a-10/50 b20/60 t36/30 u-26/10', 'io'], [.46, 'sp4 hd2 a10/70 b40/70 t20/22 u-20/16', 'io']] },
  stagger: { keys: [[0, 'sp24 hd24 a-10/20 b6/26 t18/30 u-14/34'], [.3, 'sp-8 hd-14 a10/30 b24/20 t-6/24 u20/28', 'io'], [.6, 'sp26 hd26 a-14/24 b2/20 t20/34 u-16/30', 'io']], loop: 1 },
  downSup: { keys: [[0, 'r-90 hd-6 a56/24 b130/20 t4/10 u12/34'], [.9, 'r-90 hd-2 a60/20 b126/26 t6/14 u10/30', 'io']], loop: 1 },
  downProne: { keys: [[0, 'r90 sp2 hd-12 a160/30 b150/44 t-2/10 u4/6'], [.9, 'r90 sp4 hd-6 a156/36 b146/48 t-4/14 u6/8', 'io']], loop: 1 },
  koSup: { keys: [[0, 'r-90 hd-10 a80/6 b150/6 t2/4 u8/16']], loop: 1 },
  koProne: { keys: [[0, 'r90 sp2 hd-4 a174/4 b120/10 t0/4 u4/8']], loop: 1 },
  getupSup: { keys: [[0, 'r-90 hd-4 a40/30 b60/40 t10/20 u20/40'], [.16, 'r-60 sp36 hd10 a-30/20 b40/60 t70/90 u80/110', 'io'], [.34, 'r-10 sp50 hd-20 a-10/40 b30/60 t80/120 u40/100', 'io'], [.56, 'sp10 hd-6 a20/90 b55/84 t18/20 u-20/16', 'io']] },
  getupProne: { keys: [[0, 'r90 hd-10 a100/70 b96/74 t0/10 u0/10'], [.18, 'r64 sp-6 hd-30 a90/30 b86/30 t60/100 u20/60', 'io'], [.36, 'r10 sp46 hd-30 a40/30 b50/30 t80/110 u0/70', 'io'], [.56, 'sp10 hd-6 a20/90 b55/84 t18/20 u-20/16', 'io']] },
  kipup: { keys: [[0, 'r-100 hd10 a150/60 b150/60 t110/40 u110/40'], [.12, 'r-120 sp20 hd20 a160/40 b160/40 t130/30 u130/30', 'out'], [.3, 'r-20 sp-20 hd-20 a40/30 b50/30 t20/60 u10/70 lift16', 'io'], [.44, 'sp22 hd-10 a30/60 b50/60 t50/70 u20/60', 'in'], [.56, 'sp8 hd-4 a20/90 b55/84 t18/18 u-20/14', 'io']] },
  roll: { keys: [[0, 'sp40 hd10 a60/70 b70/70 t70/90 u40/90'], [.08, 'r60 sp60 hd40 a70/100 b76/100 t110/130 u104/130', 'io'], [.3, 'r360 sp60 hd40 a70/100 b76/100 t110/130 u104/130', 'lin'], [.36, 'r360 sp40 hd-10 a40/60 b50/60 t70/90 u30/90', 'out'], [.44, 'r360 sp12 hd-6 a20/90 b55/84 t20/22 u-20/18', 'io']] },
  backstep: { keys: [[0, 'sp16 hd-8 a30/80 b55/84 t40/50 u10/40'], [.08, 'sp-16 hd-4 a50/70 b80/60 t54/30 u-10/60 lift5', 'out'], [.22, 'sp10 hd-6 a30/80 b60/80 t30/34 u-26/20', 'io'], [.34, 'sp8 hd-4 a20/90 b55/84 t18/18 u-20/14', 'io']] },
  grabReach: { keys: [[0, 'sp10 hd-6 a10/80 b30/80 t18/20 u-20/16'], [.1, 'sp34 hd-18 a80/10 b86/8 t44/34 u-32/10 ox4', 'out'], [.24, 'sp30 hd-12 a66/50 b70/44 t40/36 u-30/12 ox4', 'io'], [.44, 'sp10 hd-6 a20/80 b50/84 t18/18 u-20/14', 'io']] },
  shove: { keys: [[0, 'sp4 hd-4 a10/124 b24/120 t20/26 u-22/18'], [.14, 'sp-2 hd-2 a-10/136 b4/130 t16/28 u-22/24', 'out'], [.2, 'sp30 hd-16 a86/8 b92/6 t42/26 u-34/6 ox6', 'in'], [.32, 'sp28 hd-14 a82/14 b88/10 t40/26 u-32/8 ox6'], [.52, 'sp10 hd-6 a20/80 b50/84 t18/18 u-20/14', 'io']] },
  pickup: { keys: [[0, 'sp50 hd-20 a50/20 b56/16 t60/84 u20/76'], [.3, 'sp30 hd-12 a64/50 b72/44 t34/40 u-18/34', 'io']] },
  hold: { keys: [[0, 'sp22 hd-10 a62/64 b70/58 t26/30 u-22/22'], [.4, 'sp24 hd-9 a60/68 b68/62 t28/34 u-21/26', 'io']], loop: 1 },
  holdRear: { keys: [[0, 'sp12 hd-4 a72/44 b78/40 t24/26 u-20/22'], [.4, 'sp14 hd-4 a70/48 b76/44 t26/30 u-19/24', 'io']], loop: 1 },
  held: { keys: [[0, 'sp48 hd16 a30/30 b44/20 t20/30 u-12/30'], [.34, 'sp44 hd10 a40/20 b30/34 t16/26 u-14/34', 'io']], loop: 1 },
  heldRear: { keys: [[0, 'sp-4 hd10 a30/60 b40/56 t10/18 u-10/20'], [.34, 'sp2 hd-8 a40/50 b30/66 t14/22 u-12/16', 'io']], loop: 1 },
  knee: { keys: [[0, 'sp24 hd-8 a64/60 b70/54 t10/40 u-22/22'], [.1, 'sp14 hd-4 a70/60 b76/54 t100/110 u-14/10 lift2', 'in'], [.26, 'sp22 hd-10 a62/64 b70/58 t26/30 u-22/22', 'io']] },
  taunt: { keys: [[0, 'sp-4 hd-6 a20/60 b40/60 t12/8 u-14/8'], [.2, 'sp-14 hd-14 a150/60 b150/60 t16/10 u-18/8', 'out'], [.45, 'sp-16 hd-16 a140/110 b140/110 t16/10 u-18/8', 'io'], [.75, 'sp-14 hd-12 a150/80 b150/80 t16/10 u-18/8', 'io'], [1, 'sp8 hd-4 a20/90 b55/84 t18/18 u-20/14', 'io']] },
  tauntCall: { keys: [[0, 'sp0 hd0 a20/60 b60/60 t12/8 u-14/8'], [.2, 'sp-4 hd-8 a-30/80 b96/10 t14/8 u-16/8', 'out'], [.35, 'sp-4 hd-4 a-30/80 b92/90 t14/8 u-16/8', 'io'], [.5, 'sp-4 hd-8 a-30/80 b96/10 t14/8 u-16/8', 'io'], [.65, 'sp-4 hd-4 a-30/80 b92/90 t14/8 u-16/8', 'io'], [1, 'sp8 hd-4 a20/90 b55/84 t18/18 u-20/14', 'io']] },
  tauntDance: { keys: [[0, 'sp0 a20/60 b60/60 t12/8 u-14/8'], [.18, 'sp-12 hd-10 a150/20 b-20/80 t30/40 u-10/10', 'io'], [.36, 'sp16 hd6 a-20/80 b150/20 t-10/20 u30/40', 'io'], [.54, 'sp-12 hd-10 a150/20 b-20/80 t30/40 u-10/10', 'io'], [.72, 'sp-20 hd-20 a110/130 b110/130 t20/30 u-20/30', 'io'], [1, 'sp8 hd-4 a20/90 b55/84 t18/18 u-20/14', 'io']] },
  tauntBow: { keys: [[0, 'sp0 a10/30 b20/30 t8/6 u-10/6'], [.3, 'sp50 hd20 a60/60 b-30/80 t14/8 u-16/8', 'io'], [.6, 'sp50 hd24 a60/60 b-30/80 t14/8 u-16/8'], [1, 'sp8 hd-4 a20/90 b55/84 t18/18 u-20/14', 'io']] },
  win: { keys: [[0, 'sp0 hd-6 a20/60 b40/60 t12/8 u-14/8'], [.3, 'sp-8 hd-16 a172/10 b168/12 t12/8 u-14/8', 'back'], [.6, 'sp-8 hd-18 a166/16 b174/6 t14/10 u-14/10', 'io'], [.9, 'sp-8 hd-16 a172/10 b168/12 t12/8 u-14/8', 'io']], loopFrom: .3 },
  winFlex: { keys: [[0, 'sp0 hd-6 a20/60 b40/60 t12/8 u-14/8'], [.3, 'sp-6 hd-8 a92/112 b96/108 t16/10 u-18/8', 'back'], [.7, 'sp-10 hd-14 a96/122 b100/118 t18/12 u-18/10', 'io'], [1.1, 'sp-6 hd-8 a92/112 b96/108 t16/10 u-18/8', 'io']], loopFrom: .3 },
  winFog: { keys: [[0, 'sp0 a6/16 b10/18 t8/4 u-9/5'], [.6, 'sp-6 hd-12 a60/4 b70/4 t8/4 u-9/5', 'io'], [1.6, 'sp-8 hd-14 a64/4 b74/4 t8/4 u-9/5', 'io'], [2.6, 'sp-6 hd-12 a60/4 b70/4 t8/4 u-9/5', 'io']], loopFrom: .6 },
  lose: { keys: [[0, 'sp40 hd20 a20/10 b24/10 t60/110 u60/120'], [1, 'sp44 hd26 a22/12 b26/12 t60/110 u60/120', 'io']], loop: 1 },
  climb: { keys: [[0, 'sp20 hd-16 a140/30 b150/20 t60/80 u10/30'], [.22, 'sp10 hd-10 a150/40 b120/60 t20/30 u70/90', 'io'], [.44, 'sp26 hd-10 a60/60 b66/60 t70/90 u60/84', 'io']] },
  perch: { keys: [[0, 'sp22 hd-12 a30/50 b90/30 t62/86 u50/80'], [.5, 'sp26 hd-14 a36/44 b84/36 t66/92 u54/86', 'io']], loop: 1 },
  hang: { keys: [[0, 'sp4 hd-14 a172/6 b168/8 t14/30 u-6/24'], [.4, 'sp8 hd-10 a168/12 b172/8 t-8/24 u16/34', 'io']], loop: 1 },
  ropeBack: { keys: [[0, 'sp-14 hd10 a-60/20 b-50/24 t24/20 u10/10'], [.12, 'sp-26 hd20 a-76/20 b-70/24 t34/26 u16/14', 'out'], [.24, 'sp14 hd-10 a20/70 b40/70 t30/24 u-30/20', 'in']] },
  pin: { keys: [[0, 'r70 sp16 hd-10 a60/40 b80/30 t30/60 u-10/30'], [.3, 'r76 sp8 hd-18 a50/50 b86/40 t20/40 u-16/24', 'io']] },
  tagReach: { keys: [[0, 'sp10 hd-6 a96/2 b20/60 t18/20 u-24/16'], [.35, 'sp16 hd-8 a104/0 b20/60 t20/24 u-24/16', 'io']], loop: 1 },
  cageClimb: { keys: [[0, 'sp10 hd-12 a150/40 b120/60 t30/40 u76/96'], [.5, 'sp10 hd-12 a120/60 b150/40 t76/96 u30/40', 'io'], [1, 'sp10 hd-12 a150/40 b120/60 t30/40 u76/96', 'io']], loop: 1 },
  seatTop: { keys: [[0, 'sp16 hd18 a40/60 b30/60 t84/70 u90/80'], [.7, 'sp22 hd24 a46/54 b36/56 t86/74 u92/84', 'io']], loop: 1 },
  apron: { keys: [[0, 'sp6 hd-4 a70/50 b40/70 t8/6 u-8/8'], [.5, 'sp8 hd-6 a66/56 b40/70 t8/8 u-8/10', 'io']], loop: 1 },
  stomp: { keys: [[0, 'sp4 hd10 a20/60 b40/60 t30/60 u-10/10'], [.16, 'sp-8 hd14 a60/40 b80/40 t96/100 u-6/6', 'out'], [.24, 'sp22 hd16 a-10/50 b10/60 t26/6 u-18/24', 'in'], [.5, 'sp10 hd-6 a20/90 b55/84 t18/18 u-20/14', 'io']] },
  elbowdrop: { keys: [[0, 'sp10 hd0 a20/60 b40/60 t20/20 u-20/16'], [.18, 'sp-20 hd-10 a150/90 b40/40 t30/20 u-20/10 lift6', 'out'], [.34, 'r66 sp-20 hd10 a60/120 b150/30 t10/40 u-20/30 lift10', 'io'], [.44, 'r84 sp-10 hd0 a70/120 b160/20 t4/30 u-10/20', 'in'], [.62, 'r84 sp-10 hd-6 a70/120 b160/20 t4/30 u-10/20'], [.9, 'sp10 hd-6 a20/90 b55/84 t18/18 u-20/14', 'io']] },
  enterRing: { keys: [[0, 'sp20 hd-10 a150/20 b150/10 t20/30 u10/20'], [.2, 'sp50 hd0 a110/30 b116/30 t80/90 u0/20', 'io'], [.4, 'sp30 hd-14 a40/40 b60/40 t50/60 u-30/40', 'io'], [.55, 'sp10 hd-6 a20/90 b55/84 t18/18 u-20/14', 'io']] },
  talk: { keys: [[0, 'sp2 hd0 a10/30 b40/90 t5/3 u-6/4'], [.3, 'sp4 hd3 a8/26 b60/60 t5/3 u-6/4', 'io'], [.7, 'sp0 hd-2 a14/34 b36/100 t5/3 u-6/4', 'io'], [1.1, 'sp2 hd0 a10/30 b40/90 t5/3 u-6/4', 'io']], loop: 1 },
  interact: { keys: [[0, 'sp6 hd0 a20/40 b30/40 t6/4 u-6/4'], [.18, 'sp16 hd0 a84/20 b30/40 t10/8 u-10/6', 'out'], [.4, 'sp2 hd0 a6/14 b0/14 t5/3 u-6/4', 'io']] },
  sit: { keys: [[0, 'sp-6 hd4 a20/40 b26/40 t86/84 u90/86'], [1.2, 'sp-4 hd6 a22/42 b28/42 t86/84 u90/86', 'io']], loop: 1 },
  bench: { keys: [[0, 'r-90 a90/90 b90/90 t40/90 u46/90'], [1, 'r-90 a92/6 b94/6 t40/90 u46/90', 'io']], loop: 0 },
  bridge: { keys: [[0, 'r-62 sp-44 hd-40 a20/100 b24/100 t74/108 u66/108'], [.6, 'r-60 sp-48 hd-44 a22/104 b26/104 t76/112 u68/112', 'io']], loop: 1 },
  rope: { keys: [[0, 'sp2 hd0 a24/40 b30/40 t8/14 u6/16'], [.2, 'sp0 hd0 a20/50 b26/50 t14/34 u10/36 lift9', 'out'], [.4, 'sp4 hd0 a24/40 b30/40 t14/28 u12/30', 'in']], loop: 1 },
  carry: { keys: [[0, 'sp4 hd-4 a56/60 b62/56 t12/10 u-14/10'], [.6, 'sp5 hd-4 a56/60 b62/56 t13/12 u-13/12', 'io']], loop: 1 },
  mitt: { keys: [[0, 'sp8 hd-4 a70/30 b74/28 t14/14 u-16/12'], [.5, 'sp9 hd-4 a72/28 b76/26 t14/16 u-16/14', 'io']], loop: 1 },
  ref1: { keys: [[0, 'sp8 hd0 a70/30 b60/30 t10/8 u-10/8'], [.4, 'sp20 hd4 a90/6 b60/40 t20/16 u-16/14', 'io']], loop: 1 },
  refSlap: { keys: [[0, 'r50 sp26 hd-30 a150/10 b90/30 t60/90 u20/60'], [.5, 'r50 sp26 hd-30 a104/4 b90/30 t60/90 u20/60', 'in'], [.6, 'r50 sp26 hd-30 a104/4 b90/30 t60/90 u20/60']], loop: 1 },
  refRaise: { keys: [[0, 'sp0 hd-10 a172/4 b10/30 t8/6 u-8/6']], loop: 1 },
  cheer: { keys: [[0, 'sp-4 hd-10 a160/20 b150/30 t8/10 u-8/10'], [.16, 'sp-4 hd-14 a172/10 b168/10 t6/6 u-6/6 lift5', 'out'], [.34, 'sp-4 hd-10 a160/20 b150/30 t8/10 u-8/10', 'in']], loop: 1 },
  sleep: { keys: [[0, 'r-90 hd8 a14/60 b20/70 t8/20 u14/26'], [1.8, 'r-90 hd8 a14/64 b20/74 t8/20 u14/26', 'io']], loop: 1 },
  whipped: { keys: [[0, 'sp28 hd10 a90/10 b70/20 t40/20 u-30/30']], loop: 1 },
  limpAir: { keys: [[0, 'sp-20 hd-20 a120/20 b110/30 t20/30 u40/40']], loop: 1 },
};
const clipMemo = new Map();
export function clip(name) {
  let c = clipMemo.get(name);
  if (c) return c;
  const s = CLIP_SRC[name];
  if (!s) throw new Error('no clip ' + name);
  c = { name, loop: !!s.loop, loopFrom: s.loopFrom != null ? s.loopFrom : -1, air: !!s.air, keys: s.keys.map(k => ({ t: k[0], p: pose(k[1]), e: EASE[k[2] || 'io'] })), dur: s.keys[s.keys.length - 1][0] || .001 };
  clipMemo.set(name, c);
  return c;
}
export const hasClip = name => !!CLIP_SRC[name];
export function sampleClip(c, t, out) {
  const K = c.keys, n = K.length;
  const copy = p => { for (let i = 0; i < POSE_N; i++) out[i] = p[i]; return out; };
  if (n === 1) return copy(K[0].p);
  if (c.loop) {
    if (n === 2) return poseLerp(K[0].p, K[1].p, .5 - .5 * Math.cos((t / c.dur) * Math.PI), out); // two-key loops breathe
    t %= c.dur;
    if (t < 0) t += c.dur;
  } else if (c.loopFrom >= 0 && t > c.dur) t = c.loopFrom + ((t - c.loopFrom) % (c.dur - c.loopFrom));
  if (t <= K[0].t) return copy(K[0].p);
  for (let k = 1; k < n; k++) if (t <= K[k].t) { const u = clamp01((t - K[k - 1].t) / (K[k].t - K[k - 1].t || 1)); return poseLerp(K[k - 1].p, K[k].p, K[k].e(u), out); }
  return copy(K[n - 1].p);
}

/* Attack pose from three drawings (wind, hit, follow) and the attack's own timing. */
export function attackPose(atk, t, stance, out) {
  const S = atk.startup, A = atk.active, R = atk.recover;
  const w = pose(atk.wind), h = pose(atk.hit), f = pose(atk.follow || atk.hit);
  if (t < S * .62) return poseLerp(stance, w, EASE.out(clamp01(t / (S * .62))), out);
  if (t < S) return poseLerp(w, h, EASE.in(clamp01((t - S * .62) / (S * .38))), out);
  if (t < S + A) return poseLerp(h, f, EASE.out(clamp01((t - S) / A)), out);
  const hold = R * (atk.holdR != null ? atk.holdR : .3);
  if (t < S + A + hold) { for (let i = 0; i < POSE_N; i++) out[i] = f[i]; return out; }
  return poseLerp(f, stance, EASE.io(clamp01((t - S - A - hold) / (R - hold || .01))), out);
}
