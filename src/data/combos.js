// Follow-ups (연계), in-move upgrades (이어 걸기 / 슈퍼 기술), the Space specials in a hold, the turnbuckle seat,
// and the counters that cost energy. Timelines follow the conventions at the top of moves.js.
// All names are original to this game.
import { MOVES, HOLDS } from './moves.js';
import { ATTACKS } from './balance.js';

const HOLD_A = 'sp22 hd-10 a62/64 b70/58 t26/30 u-22/22';
const HOLD_V = 'sp48 hd16 a30/30 b44/20 t20/30 u-12/30';
const REAR_A = 'sp12 hd-4 a72/44 b78/40 t24/26 u-20/22';
const IDLE = 'sp10 hd-6 a20/90 b55/84 t18/20 u-20/16';
const FLAT = 'sp-8 hd-12 a130/10 b110/20 t24/20 u34/30';
const LYING = 'sp-2 hd-8 a150/14 b120/24 t6/12 u12/24';     // on the back after a slam (R rot 92, head toward the attacker)
const UPSIDE = 'sp4 hd-6 a160/10 b150/14 t12/30 u24/44';
const PIN_A = 'r72 sp18 hd-34 a56/50 b104/36 t30/60 u-10/40 lift9 ox20';
const PIN_V = 'sp-4 hd-8 a120/20 b100/20 t40/30 u16/40';
const CARRY_A = 'sp4 hd-14 a70/92 b76/86 t18/20 u-18/16';
const CARRY_V = 'sp-6 hd6 a80/60 b100/40 t90/80 u86/76';
const SEAT_V = 'sp16 hd18 a40/60 b30/60 t84/70 u90/80';
const DROP_A = 'r62 sp20 hd-20 a70/130 b120/30 t20/30 u0/40 lift6 ox26';
const LAND_A = 'r80 sp14 hd-24 a60/140 b130/20 t10/20 u10/30 lift4 ox30';

export const COMBO_MOVES = {
  // ---------------------------------------------------------------- ground follow-ups (the foe lies on the back)
  fElbow: {
    name: '점프 엘보 드롭', pos: 'ground', hp: 9, stun: 16, gain: 10, lift: 9, self: .3, desc: '바디 슬램으로 눕힌 상대에게 뛰어올라 팔꿈치로 떨어진다.',
    dur: 1.1, rel: .9, vf: -1, vel: [0, -30, 0], land: 'sup', roll: [.26, .56],
    A: [[0, 'sp20 hd10 a30/60 b50/60 t18/20 u-20/16'], [.22, 'sp10 hd-4 a150/120 b40/60 t40/60 u-10/50', 'io'], [.42, 'sp-6 hd-8 a164/130 b30/50 t30/40 u10/40 lift16', 'out'], [.58, DROP_A, 'in'], [.66, LAND_A, 'in'], [1.1, 'r78 sp16 hd-20 a64/120 b120/30 t20/40 u0/40 lift4 ox30']],
    V: [[0, LYING], [.62, LYING], [.68, 'sp12 hd12 a110/40 b90/40 t44/30 u40/40'], [.9, LYING, 'io']],
    R: [[0, 34, 'g', 92], [1.1, 34, 'g', 92]],
    ev: [[.2, 'grunt'], [.5, 'whoosh'], [.66, 'impact', { p: 1, d: 1, word: '퍽!' }]],
  },
  bigElbow: {
    name: '뱃고동 엘보', pos: 'ground', hp: 12, stun: 20, gain: 16, lift: 9, self: .3, hype: 10, desc: '관중에게 손짓하고 로프까지 갔다 와서 떨어뜨리는 과시용 엘보.',
    dur: 2.3, rel: 2.1, vf: -1, vel: [0, -30, 0], land: 'sup', roll: [1.56, 1.8],
    A: [[0, 'sp14 hd10 a20/90 b55/84 t18/20 u-20/16'], [.3, 'sp6 hd-12 a120/100 b120/100 t18/20 u-20/16', 'io'], [.55, 'sp4 hd-16 a172/10 b40/60 t18/20 u-20/16', 'io'], [.75, 'sp26 hd-10 a-20/80 b60/80 t50/40 u-30/30'], [.95, 'sp26 hd-10 a60/80 b-20/80 t-30/30 u50/40'], [1.15, 'sp26 hd-10 a-20/80 b60/80 t50/40 u-30/30'], [1.35, 'sp20 hd-10 a60/80 b-20/80 t-30/30 u50/40'], [1.55, 'sp10 hd-6 a156/124 b30/60 t20/30 u-10/30', 'io'], [1.8, DROP_A, 'in'], [1.88, LAND_A, 'in'], [2.3, 'r78 sp16 hd-20 a64/120 b120/30 t20/40 u0/40 lift4 ox30']],
    V: [[0, LYING], [1.84, LYING], [1.9, 'sp14 hd14 a110/40 b90/40 t46/30 u40/40'], [2.1, LYING, 'io']],
    R: [[0, 34, 'g', 92], [2.3, 34, 'g', 92]],
    ax: [[0, 0, 0], [.62, 0, 0], [.95, 64, 0, 'lin'], [1.2, 64, 0], [1.5, 0, 0, 'io'], [2.3, 0, 0]],
    ev: [[.3, 'cheer'], [.55, 'cheer'], [1.6, 'grunt'], [1.88, 'impact', { p: 1.4, d: 1, word: '뿌우웅!' }]],
  },
  backStretch: {
    name: '등 꺾기 조르기', pos: 'ground', hp: 13, stun: 24, gain: 12, lift: 9, self: .4, desc: '엎어 놓고 두 다리를 겨드랑이에 끼워 허리를 꺾는다. 연타로 버틸 수 있다.',
    dur: 2.8, rel: 2.5, vf: 1, vel: [10, -20, 0], land: 'prone', sub: [.5, 2.4],
    A: [[0, 'sp30 hd10 a60/60 b66/60 t30/40 u-10/30'], [.4, 'sp-14 hd-10 a40/120 b46/110 t40/60 u-20/40', 'io'], [.9, 'sp-24 hd-14 a36/124 b42/114 t30/40 u-26/30', 'io'], [1.5, 'sp-16 hd-8 a40/120 b46/110 t36/50 u-20/36', 'io'], [2.1, 'sp-26 hd-16 a36/124 b42/114 t30/40 u-26/30', 'io'], [2.5, 'sp-16 hd-10 a40/120 b46/110 t30/40 u-20/30'], [2.8, IDLE, 'io']],
    V: [[0, 'sp4 hd-6 a150/30 b140/40 t0/10 u4/10'], [.4, 'sp-30 hd-40 a150/30 b140/40 t-60/70 u-64/66'], [1.2, 'sp-40 hd-50 a160/20 b150/30 t-70/70 u-74/66'], [2.0, 'sp-34 hd-44 a156/26 b146/36 t-64/70 u-68/66'], [2.5, 'sp-30 hd-40 a150/30 b140/40 t-60/70 u-64/66'], [2.8, 'sp4 hd-6 a150/30 b140/40 t0/10 u4/10']],
    R: [[0, 30, 'g', 90], [2.8, 30, 'g', 90]],
    ik: [[.4, 2.5, 'N', 'aN'], [.4, 2.5, 'F', 'aF']],
    ev: [[.3, 'grunt'], [.6, 'hit', { d: .2 }], [1.0, 'cry'], [1.1, 'hit', { d: .2 }], [1.6, 'hit', { d: .2 }], [2.1, 'hit', { d: .2 }], [2.4, 'hit', { d: .2 }]],
  },
  anchorHammer: {
    name: '닻 망치', pos: 'ground', hp: 16, stun: 26, gain: 14, lift: 1.1, self: .5, desc: '쓰러진 상대를 일으켜 거꾸로 세운 채 버티다가 앞으로 내리꽂고 그대로 덮친다.',
    dur: 2.0, rel: 1.74, vf: -1, vel: [10, -40, 0], land: 'sup', toPin: 1,
    A: [[0, 'sp56 hd-20 a50/16 b56/12 t64/90 u20/80'], [.3, HOLD_A, 'io'], [.55, 'sp36 hd-14 a82/58 b86/54 t54/72 u6/62', 'io'], [.85, 'sp-10 hd-22 a150/34 b152/32 t10/8 u-16/10', 'out'], [1.3, 'sp-12 hd-24 a152/30 b154/30 t14/10 u-14/12'], [1.5, 'r40 sp30 hd-20 a110/40 b110/40 t30/40 u-10/30', 'in'], [1.62, PIN_A, 'in'], [2.0, PIN_A]],
    V: [[0, 'sp10 hd20 a20/30 b30/30 t10/30 u20/40'], [.3, HOLD_V, 'io'], [.55, 'sp62 hd30 a40/30 b30/20 t14/24 u-10/24'], [.85, UPSIDE], [1.3, 'sp6 hd-4 a164/10 b154/14 t10/26 u20/40'], [1.62, PIN_V], [2.0, PIN_V]],
    R: [[0, 30, 'g', 70], [.3, 24, 42, -20], [.55, 22, 46, -44], [.85, 10, 112, -176, 'out'], [1.3, 10, 116, -178], [1.62, 34, 'g', -268, 'in'], [2.0, 34, 'g', -268]],
    ik: [[.1, 1.6, 'N', 'pelvis'], [.1, 1.6, 'F', 'chest']],
    ev: [[.2, 'grunt'], [.6, 'lift'], [1.0, 'cheer'], [1.4, 'whoosh'], [1.62, 'impact', { p: 1.6, d: 1, word: '쿠웅!' }]],
  },
  liftUp: {
    name: '끌어올리기', pos: 'chain', hp: 0, stun: 0, gain: 0, lift: 9, self: 0, desc: '', dur: .34, rel: 9, vf: -1, next: 1,
    A: [[0, 'sp56 hd-20 a50/16 b56/12 t64/90 u20/80'], [.18, 'sp44 hd-16 a60/30 b66/26 t50/66 u0/60', 'io'], [.34, HOLD_A, 'io']],
    V: [[0, 'sp10 hd20 a20/30 b30/30 t10/30 u20/40'], [.18, 'sp50 hd30 a30/20 b40/20 t40/70 u20/80', 'io'], [.34, HOLD_V, 'io']],
    R: [[0, 30, 'g', 70], [.18, 26, 'g', 20], [.34, 24, 42, -20]],
    ik: [[0, .34, 'N', 'neck'], [0, .34, 'F', 'chest']],
    ev: [[.05, 'grunt']],
  },
  // ---------------------------------------------------------------- on the shoulders (어깨 메기)
  shoulderLift: {
    name: '어깨 메기', pos: 'special', hp: 0, stun: 4, gain: 4, lift: 1.05, self: 0, toHold: 'carry', desc: '상대를 목말 태우듯 어깨에 올린다. 걸어서 코너로 갈 수 있다.',
    dur: .8, rel: 9, vf: 1,
    A: [[0, HOLD_A], [.22, 'sp44 hd-20 a40/60 b44/60 t84/112 u64/104', 'io'], [.46, 'sp30 hd-24 a60/80 b66/76 t70/96 u50/90', 'io'], [.8, CARRY_A, 'out']],
    V: [[0, 'sp20 hd10 a30/40 b40/40 t20/30 u-10/30'], [.22, 'sp30 hd20 a60/40 b70/40 t40/40 u30/40'], [.46, 'sp10 hd10 a80/50 b90/40 t80/70 u76/70'], [.8, CARRY_V, 'io']],
    R: [[0, 22, 48, 0], [.22, 12, 52, 0], [.46, 2, 60, 0, 'out'], [.8, -2, 76, 0, 'in']],
    ik: [[.4, .8, 'N', 'kN'], [.4, .8, 'F', 'kF']],
    ev: [[.1, 'grunt'], [.5, 'lift']],
  },
  elecChair: {
    name: '일렉트릭 체어 드롭', pos: 'special', hp: 14, stun: 20, gain: 14, lift: 9, self: .5, desc: '어깨 위의 상대와 함께 뒤로 넘어가 등을 바닥에 꽂는다.',
    dur: 1.1, rel: .8, vf: 1, vel: [-20, -60, 0], land: 'sup',
    A: [[0, CARRY_A], [.25, 'sp-16 hd-6 a80/80 b86/76 t30/30 u-10/30', 'io'], [.5, 'r-50 sp-20 hd10 a90/60 b96/60 t70/60 u50/60', 'in'], [.62, 'r-84 sp-6 hd-10 a110/30 b110/30 t50/70 u40/70 ox-6', 'in'], [1.1, 'r-84 sp-6 hd-12 a100/40 b100/40 t40/60 u30/60 ox-6']],
    V: [[0, CARRY_V], [.25, 'sp-20 hd-10 a120/40 b140/30 t80/60 u80/60'], [.5, 'sp-30 hd-30 a150/20 b150/20 t60/40 u60/40'], [.62, 'sp-8 hd-12 a130/10 b110/20 t60/40 u50/40'], [1.1, FLAT]],
    R: [[0, -2, 76, 0], [.25, -6, 80, -20], [.5, -30, 50, -60, 'in'], [.62, -44, 'g', -92, 'in'], [1.1, -46, 'g', -92]],
    ik: [[0, .55, 'N', 'kN'], [0, .55, 'F', 'kF']],
    ev: [[.1, 'grunt'], [.62, 'impact', { p: 1.3, d: 1, word: '콰당!' }]],
  },
  turnbuckleDrop: {
    name: '턴버클 던지기', pos: 'special', hp: 10, stun: 22, gain: 12, lift: 9, self: .3, push: 1, toSeat: 1, desc: '어깨 위의 상대를 앞으로 던져 코너 맨 위에 걸터앉힌다.',
    dur: .9, rel: .86, vf: 1, vel: [0, 0, 0],
    A: [[0, CARRY_A], [.2, 'sp-8 hd-10 a110/60 b116/56 t30/40 u-20/30', 'io'], [.45, 'sp30 hd-10 a150/20 b156/20 t50/40 u-30/20', 'out'], [.6, 'sp24 hd-8 a90/20 b96/20 t30/30 u-20/20'], [.9, IDLE, 'io']],
    V: [[0, CARRY_V], [.2, 'sp-10 hd0 a100/40 b120/30 t90/80 u86/76'], [.45, 'sp40 hd30 a150/40 b150/40 t60/60 u60/60'], [.6, 'sp30 hd24 a60/60 b60/60 t84/70 u90/80'], [.9, SEAT_V]],
    R: [[0, -2, 76, 0], [.2, 0, 80, -6], [.45, 22, 86, 30, 'out'], [.6, 30, 58, 4, 'in'], [.9, 30, 58, 0]],
    ik: [[0, .4, 'N', 'kN'], [0, .4, 'F', 'kF']],
    ev: [[.1, 'grunt'], [.5, 'impact', { p: 1.1, d: 1, word: '쾅!', wall: 1 }]],
  },
  // ---------------------------------------------------------------- from the top turnbuckle (상대가 코너 위에 앉아 있을 때)
  superGerman: {
    name: '슈퍼 저먼', pos: 'super', hp: 24, stun: 40, gain: 0, lift: 9, self: .7, quake: 120, push: 1, desc: '코너 위에 앉은 상대 뒤로 올라가 허리를 감고 높은 곳에서 저먼 수플렉스로 던진다.',
    dur: 1.9, rel: 1.5, vf: 1, vel: [-80, -100, -1.6], land: 'sup',
    A: [[0, 'sp20 hd-10 a60/60 b66/56 t30/40 u-20/30'], [.35, 'sp10 hd-10 a150/40 b140/50 t80/100 u20/40 lift20', 'io'], [.6, REAR_A + ' lift30', 'io'], [.85, 'sp20 hd-4 a78/46 b80/42 t58/74 u8/64 lift30', 'io'], [1.05, 'r-14 sp-30 hd-18 a88/24 b90/22 t22/32 u-12/34 lift34', 'out'], [1.35, 'r-60 sp-50 hd-44 a118/10 b120/10 t72/98 u62/98 ox-12', 'in'], [1.9, 'r-80 sp-10 hd-10 a110/20 b110/20 t50/80 u40/80 ox-12']],
    V: [[0, SEAT_V], [.6, 'sp-4 hd10 a30/60 b40/56 t40/40 u30/40'], [1.05, 'sp-18 hd-20 a90/20 b100/20 t40/30 u30/44'], [1.35, 'sp36 hd50 a150/20 b140/20 t84/24 u96/34'], [1.9, 'sp36 hd50 a140/30 b130/30 t80/30 u92/40']],
    R: [[0, 30, 58, 0], [.6, 24, 82, 0], [.85, 24, 80, -4], [1.05, 10, 132, -66, 'out'], [1.2, -20, 130, -120], [1.35, -56, 'g', -188, 'in'], [1.9, -70, 'g', -262]],
    ik: [[.55, 1.4, 'N', 'pelvis'], [.55, 1.4, 'F', 'pelvis']],
    ev: [[.3, 'grunt'], [.6, 'cry'], [1.0, 'lift'], [1.15, 'whoosh'], [1.35, 'impact', { p: 2.4, d: 1, word: '콰아앙!!' }]],
  },
  cornerBackdrop: {
    name: '턴버클 백드롭', pos: 'special', hp: 14, stun: 24, gain: 12, lift: 9, self: .5, push: 1, desc: '코너 위에 앉은 상대의 허리를 감아 뒤로 잡아당겨 떨어뜨린다.',
    dur: 1.3, rel: 1.0, vf: 1, vel: [-50, -60, -1], land: 'sup',
    A: [[0, 'sp20 hd-10 a60/60 b66/56 t30/40 u-20/30'], [.3, REAR_A, 'io'], [.55, 'r-10 sp-26 hd-14 a90/30 b92/28 t30/40 u-10/40', 'out'], [.8, 'r-60 sp-40 hd-30 a118/10 b120/10 t72/98 u62/98 ox-10', 'in'], [1.3, 'r-80 sp-10 hd-10 a110/20 b110/20 t50/80 u40/80 ox-10']],
    V: [[0, SEAT_V], [.3, 'sp-4 hd10 a30/60 b40/56 t60/50 u60/60'], [.55, 'sp-20 hd-20 a100/20 b110/20 t50/40 u40/44'], [.8, 'sp30 hd40 a150/20 b140/20 t70/30 u80/40'], [1.3, 'sp30 hd40 a140/30 b130/30 t70/30 u80/40']],
    R: [[0, 30, 58, 0], [.3, 22, 62, -4], [.55, 4, 92, -80, 'out'], [.8, -46, 'g', -186, 'in'], [1.3, -60, 'g', -250]],
    ik: [[.25, .9, 'N', 'pelvis'], [.25, .9, 'F', 'pelvis']],
    ev: [[.2, 'grunt'], [.55, 'lift'], [.8, 'impact', { p: 1.4, d: 1, word: '쿵!' }]],
  },
  // ---------------------------------------------------------------- rope swing kick (619형): shove onto the middle rope, swing through, land on the apron
  ropeKick: {
    name: '로프 회전 킥', pos: 'special', hp: 12, stun: 28, gain: 14, lift: 0, self: .2, push: 1, endApron: 1, revMove: 'ropeLariat', revCost: 25, desc: '상대를 가운데 로프에 걸쳐 놓고 달려와 톱로프를 잡고 몸을 돌려 걷어찬다. 끝나면 에이프런에 선다.',
    dur: 1.8, rel: 1.36, vf: -1, vel: [-110, -60, .9], land: 'prone',
    A: [[0, HOLD_A], [.18, 'sp34 hd-14 a70/40 b76/36 t40/50 u-20/30', 'io'], [.36, 'sp40 hd-16 a90/10 b96/10 t50/30 u-40/20', 'out'], [.6, 'sp6 hd-6 a20/90 b55/84 t30/30 u-30/20', 'io'], [.8, 'sp30 hd-10 a-20/80 b60/80 t50/40 u-30/30'], [.95, 'sp30 hd-10 a60/80 b-20/80 t-30/30 u50/40'], [1.08, 'sp16 hd-10 a160/20 b150/30 t50/40 u-10/30 lift8'], [1.2, 'r-40 sp-20 hd-10 a120/0 b116/0 t62/0 u56/0 lift34', 'out'], [1.32, 'r-76 sp-10 hd-6 a94/0 b90/0 t26/0 u20/0 lift46', 'in'], [1.46, 'r-40 sp0 hd-4 a120/0 b116/0 t40/20 u30/20 lift30 ox30'], [1.62, 'sp20 hd-6 a40/60 b40/60 t40/60 u20/50 ox50', 'in'], [1.8, 'sp6 hd-4 a70/50 b40/70 t8/6 u-8/8 ox50', 'io']],
    V: [[0, HOLD_V], [.18, 'sp0 hd0 a60/30 b70/30 t10/30 u-10/30'], [.36, 'sp-30 hd-40 a170/20 b160/30 t-50/10 u-56/14'], [.8, 'sp-34 hd-36 a166/26 b158/34 t-52/12 u-56/14'], [1.3, 'sp-30 hd-40 a170/20 b160/30 t-50/10 u-56/14'], [1.36, 'sp30 hd30 a60/40 b70/40 t20/30 u0/30']],
    R: [[0, 24, 42, -20], [.18, 28, 44, -10], [.36, 36, 40, 58, 'out'], [1.3, 36, 40, 58], [1.36, 30, 46, -20, 'in']],
    revAt: [.95, 1.2],
    ax: [[0, 0, 0], [.4, 0, 0], [.8, -70, 0, 'out'], [1.08, 6, 0, 'in'], [1.32, 14, 0], [1.46, 0, 0], [1.8, 0, 0]],
    ev: [[.16, 'grunt'], [.36, 'smack'], [.9, 'cheer'], [1.2, 'whoosh'], [1.32, 'impact', { p: 1.3, d: 1, word: '빡!!' }]],
  },
  ropeLariat: {
    name: '로프 반격 래리어트', pos: 'counter', hp: 12, stun: 22, gain: 10, lift: 9, self: .3, desc: '로프에 걸린 척하다 달려든 상대의 목을 팔로 걷어 넘긴다.',
    dur: .8, rel: .5, vf: -1, vel: [60, -90, -1.6], land: 'sup',
    A: [[0, IDLE], [.12, 'sp20 hd-10 a-30/40 b60/40 t40/50 u-20/30', 'io'], [.26, 'sp30 hd-14 a100/0 b40/60 t50/40 u-30/20', 'out'], [.5, 'sp24 hd-10 a96/10 b40/60 t40/40 u-20/30'], [.8, IDLE, 'io']],
    V: [[0, 'sp20 hd0 a60/40 b60/40 t20/30 u-10/30'], [.26, 'sp-30 hd-40 a150/20 b140/30 t60/30 u40/30'], [.5, FLAT]],
    R: [[0, 32, 43, 0], [.26, 32, 62, 60, 'out'], [.5, 44, 'g', 92, 'in']],
    ev: [[.1, 'grunt'], [.26, 'impact', { p: 1.3, d: 1, word: '빡!' }]],
  },
  // ---------------------------------------------------------------- powerbomb x3 (슈퍼 파워밤) and a second German (연속 저먼)
  pbAgain: {
    name: '슈퍼 파워밤', pos: 'super', hp: 8, stun: 14, gain: 0, lift: 9, self: 0, desc: '', dur: 2.0, rel: 9, vf: -1, next: 1, quake: 60,
    A: [[0, 'sp50 hd-22 a56/30 b60/28 t50/66 u4/60'], [.5, 'sp-8 hd-6 a150/26 b154/24 t12/10 u-16/10', 'out'], [.95, 'sp-16 hd-14 a164/16 b166/16 t30/50 u0/50', 'io'], [1.25, 'sp-12 hd-10 a168/14 b168/14 t30/50 u10/60 lift40', 'out'], [1.5, 'sp64 hd-18 a56/4 b60/4 t86/60 u78/80', 'in'], [1.7, 'sp56 hd-16 a56/8 b60/8 t54/66 u-14/58'], [2.0, 'sp50 hd-22 a56/30 b60/28 t50/66 u4/60', 'io']],
    V: [[0, 'sp30 hd20 a60/20 b50/20 t60/50 u60/60'], [.5, 'sp-6 hd-4 a60/50 b70/40 t84/60 u90/64'], [.95, 'sp-16 hd-14 a90/30 b100/30 t84/50 u92/56'], [1.5, 'sp26 hd34 a140/20 b130/20 t96/24 u104/34'], [1.7, 'sp20 hd20 a140/20 b130/20 t90/40 u98/50'], [2.0, 'sp30 hd20 a60/20 b50/20 t60/50 u60/60']],
    R: [[0, 22, 50, 40], [.5, 14, 108, 2, 'out'], [.95, 8, 112, -8], [1.25, 8, 150, -8, 'out'], [1.5, 38, 'g', 104, 'in'], [1.7, 34, 16, 100], [2.0, 22, 50, 40]],
    ik: [[0, 2.0, 'N', 'pelvis'], [0, 2.0, 'F', 'pN']],
    ev: [[.4, 'lift'], [1.2, 'whoosh'], [1.5, 'impact', { p: 1.9, d: 1, word: '둘!' }]],
  },
};
// Copies of existing timelines whose ends meet: the first and last powerbombs, the rolling German.
COMBO_MOVES.spb1 = { ...MOVES.fNorth1, name: '슈퍼 파워밤', pos: 'super', hp: 8, stun: 14, gain: 0, desc: '', ev: [[.1, 'cry'], [.56, 'lift'], [1, 'impact', { p: 1.6, d: 1, word: '하나!' }]] };
COMBO_MOVES.spb3 = { ...MOVES.fNorth2, name: '슈퍼 파워밤', pos: 'super', hp: 15, stun: 28, gain: 0, desc: '파워밤을 놓지 않고 세 번. 에너지 50.', ev: [[.4, 'lift'], [1.2, 'whoosh'], [1.5, 'impact', { p: 2.7, d: 1, word: '셋!! 콰아앙!!' }]] };
COMBO_MOVES.gRoll = { ...MOVES.fAnchor1, name: '연속 저먼', pos: 'chain', hp: 7, stun: 12, gain: 6, desc: '', ev: [[.1, 'grunt'], [.4, 'lift'], [.6, 'impact', { p: 1.2, d: 1, word: '하나!' }]] };
Object.assign(MOVES, COMBO_MOVES);
for (const id in COMBO_MOVES) MOVES[id].id = id;

// counters that cost energy: a quick roll-up, two submissions and the cutter
Object.assign(MOVES, {
  rollUp: {
    id: 'rollUp', name: '기습 롤업', pos: 'counter', hp: 4, stun: 10, gain: 6, lift: 9, self: 0, toPin: 1, desc: '큰 주먹을 피해 파고들어 굴려서 그대로 누른다.',
    dur: .8, rel: 9, vf: -1,
    A: [[0, 'sp30 hd-10 a60/60 b60/60 t60/90 u40/80'], [.25, 'sp60 hd-20 a100/40 b100/40 t70/100 u50/90', 'io'], [.5, 'r-40 sp40 hd-10 a90/60 b90/60 t80/100 u60/90', 'out'], [.8, PIN_A, 'in']],
    V: [[0, 'sp30 hd10 a120/10 b40/60 t30/30 u-20/30'], [.25, 'sp60 hd30 a60/40 b60/40 t40/40 u20/40'], [.5, 'sp80 hd40 a80/40 b80/40 t120/60 u120/60'], [.8, PIN_V]],
    R: [[0, 30, 43, 0], [.25, 26, 50, 20], [.5, 20, 52, 120, 'out'], [.8, 34, 'g', 92, 'in']],
    ev: [[.1, 'grunt'], [.5, 'whoosh'], [.78, 'impact', { p: .8, d: 1, word: '롤업!' }]],
  },
  calfLock: {
    id: 'calfLock', name: '종아리 꺾기', pos: 'counter', hp: 12, stun: 22, gain: 10, lift: 9, self: .5, sub: [.7, 2.3], desc: '짓밟으러 든 발목을 잡아 넘어뜨리고 종아리를 꺾는다.',
    dur: 2.6, rel: 2.4, vf: -1, vel: [-10, -20, 0], land: 'prone',
    A: [[0, 'r-90 hd-6 a56/24 b130/20 t4/10 u12/34'], [.2, 'r-70 sp30 hd10 a90/40 b100/40 t60/60 u40/60', 'io'], [.5, 'r-60 sp40 hd0 a70/80 b80/80 t80/100 u60/90 ox10', 'io'], [.8, 'r-40 sp20 hd-10 a60/100 b70/90 t90/120 u70/110 ox16', 'io'], [1.5, 'r-48 sp14 hd-14 a60/104 b70/94 t90/120 u70/110 ox16', 'io'], [2.4, 'r-40 sp20 hd-10 a60/100 b70/90 t90/120 u70/110 ox16'], [2.6, 'r-60 sp30 hd0 a60/60 b60/60 t70/80 u50/80 ox16', 'io']],
    V: [[0, 'sp10 hd-10 a30/40 b40/40 t40/80 u-10/20'], [.3, 'sp30 hd-20 a90/40 b100/40 t30/40 u-20/20'], [.6, 'sp-10 hd-20 a160/30 b150/40 t10/40 u-30/100'], [1.5, 'sp-16 hd-26 a164/26 b154/36 t10/40 u-36/110'], [2.4, 'sp-10 hd-20 a160/30 b150/40 t10/40 u-30/100']],
    R: [[0, 36, 43, 0], [.3, 36, 40, 30, 'out'], [.6, 44, 'g', 88, 'in'], [2.6, 44, 'g', 88]],
    ev: [[.1, 'grunt'], [.6, 'impact', { p: .8, d: .25, word: '털썩!' }], [1.0, 'cry'], [1.2, 'hit', { d: .25 }], [1.8, 'hit', { d: .25 }], [2.3, 'hit', { d: .25 }]],
  },
  netTrip: {
    id: 'netTrip', name: '그물 조르기', pos: 'counter', hp: 4, stun: 10, gain: 4, lift: 9, self: 0, desc: '달려든 상대의 다리를 걸어 엎어뜨리고 그대로 허리를 꺾는다.', dur: .5, rel: 9, vf: 1, next: 1,
    A: [[0, 'sp30 hd-10 a60/60 b60/60 t60/90 u40/80'], [.25, 'sp50 hd-20 a90/40 b90/40 t80/110 u60/100', 'io'], [.5, 'sp30 hd10 a60/60 b66/60 t30/40 u-10/30', 'io']],
    V: [[0, 'sp30 hd10 a-20/60 b60/60 t50/40 u-30/30'], [.25, 'sp40 hd20 a120/40 b110/40 t-10/30 u-30/30'], [.5, 'sp4 hd-6 a150/30 b140/40 t0/10 u4/10']],
    R: [[0, 30, 43, 0], [.25, 34, 46, 40, 'out'], [.5, 30, 'g', 90, 'in']],
    ev: [[.1, 'grunt'], [.45, 'impact', { p: .8, d: 1, word: '털썩!' }]],
  },
});

// Carried on the shoulders: the victim sits facing the same way, the attacker holds the knees and can walk.
HOLDS.carry = {
  id: 'carry', dur: 1.0, loop: 1, vf: 1, rel: 99, ev: [],
  A: [[0, CARRY_A], [.5, 'sp6 hd-12 a72/90 b78/84 t20/22 u-16/18', 'io'], [1.0, CARRY_A, 'io']],
  V: [[0, CARRY_V], [.5, 'sp4 hd-4 a130/40 b150/30 t92/84 u88/80', 'io'], [1.0, CARRY_V, 'io']],
  R: [[0, -2, 76, 0], [1.0, -2, 76, 0]],
  ik: [[-1, 9, 'N', 'kN'], [-1, 9, 'F', 'kF']],
};

// Springboard off the top rope from the apron onto a foe lying in the ring.
ATTACKS.springMoon = { ...ATTACKS.diveMoon, id: 'springMoon', name: '스프링보드 문설트', hp: 11, stun: 34, spring: 1 };

// ---------------------------------------------------------------- tables
// What can follow a move once it lets go (or, with `direct`, straight out of its last pose).
//   key: atk | grab | down | fin. id: a move started on the foe where they lie. lift: haul them up first (liftUp + id).
//   pin: start a cover at once; the number multiplies how hard it is to kick out. spring: springboard from the apron.
export const FOLLOW = {
  bodySlam: [{ key: 'atk', id: 'fElbow' }],
  spinebuster: [{ key: 'atk', id: 'bigElbow' }],
  backbreaker: [{ key: 'grab', id: 'backStretch' }],
  suplex: [{ key: 'grab', id: 'suplex', lift: 1, name: '끌어올려 한 번 더' }],
  ddt: [{ key: 'down', pin: 1.3 }],
  powerbomb: [{ key: 'down', pin: 1.35 }],
  piledriver: [{ key: 'down', pin: 1.35 }],
  chokeslam: [{ key: 'down', pin: 1.3 }],
  german: [{ key: 'down', pin: 1.2 }],
  runningBulldog: [{ key: 'down', pin: 1.25 }],
  f5: [{ key: 'down', pin: 1.4 }],
  powerSlam: [{ key: 'down', pin: 1.4, direct: 1, name: '그대로 누르기' }],
  dragonSuplex: [{ key: 'down', pin: 1.5 }],
  cutter: [{ key: 'grab', id: 'anchorHammer' }, { key: 'down', pin: 1.2 }],
  spear: [{ key: 'grab', id: 'anchorHammer' }, { key: 'down', pin: 1.2 }],
  anchorHammer: [{ key: 'down', pin: 1.45, direct: 1, name: '그대로 누르기' }],
  rollUp: [],
  fElbow: [{ key: 'down', pin: 1.15, direct: 1 }],
  bigElbow: [{ key: 'down', pin: 1.3, direct: 1 }],
  elecChair: [{ key: 'down', pin: 1.25 }],
  superGerman: [{ key: 'down', pin: 1.45 }],
  cornerBackdrop: [{ key: 'down', pin: 1.2 }],
  spb3: [{ key: 'down', pin: 1.5 }],
  ropeKick: [{ key: 'atk', spring: 1, name: '스프링보드 문설트' }],
  springMoon: [{ key: 'down', pin: 1.35 }],
};
// Pressed early in a move, these turn it into a longer one. to: the parts that replace it. cost: energy (finisher gauge).
export const UPGRADE = {
  german: [{ key: 'grab', to: ['gRoll', 'german'], until: .22, name: '연속 저먼!' }],
  dragonSuplex: [{ key: 'grab', to: ['gRoll', 'dragonSuplex'], until: .22, name: '저먼에서 드래곤으로!' }],
  powerbomb: [{ key: 'fin', to: ['spb1', 'pbAgain', 'spb3'], until: .24, cost: 50, name: '슈퍼 파워밤!' }],
};
// L at the right moment with enough energy: these replace the plain counter.
//   dash: dash moves and dives at a standing body; run: running strikes; heavy: big standing strikes; stomp: stomps on you while down.
export const COUNTERS = {
  dash: { id: 'cutter', cost: 25, name: '번개 커터 반격' },
  run: { id: 'netTrip', parts: ['netTrip', 'backStretch'], cost: 25, name: '그물 조르기' },
  heavy: { id: 'rollUp', cost: 20, name: '기습 롤업' },
  stomp: { id: 'calfLock', cost: 20, name: '종아리 꺾기' },
};
// Space in a front hold when the finisher gauge is not full: the specials.
export const SPECIALS = { ropeKick: 20, shoulderLift: 10, superGerman: 50 };
// Named chains: the moves in order, ending with the last one.
export const SIGNATURES = [
  { name: '파도 넘기', seq: ['ropeKick', 'springMoon'] },
  { name: '닻 내리기', seq: ['spear', 'anchorHammer'] },
  { name: '번개 닻', seq: ['cutter', 'anchorHammer'] },
  { name: '항구의 밤', seq: ['bodySlam', 'fElbow'] },
  { name: '북해 삼연타', seq: ['spb1', 'pbAgain', 'spb3'] },
  { name: '코너 폭격', seq: ['turnbuckleDrop', 'superGerman'] },
];
export const COMBO = { window: 1.5, springWindow: 2.2, counterWindow: .16 };
