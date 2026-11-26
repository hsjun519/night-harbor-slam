// Every tunable number of the fight, in one place. Change values here; no system hard-codes them.
export const BALANCE = {
  // movement
  gravity: 980, walk: 104, run: 196, runAfter: .85, doubleTap: .24, accel: 1250, decel: 1500, airAccel: 520, jump: 322, maxFall: 620,
  ropeBoost: 1.42, ropeBoostTime: .75, ropeLean: .22,
  // tap a direction twice and keep holding: dash (faster than running). K while dashing into a standing foe: the dash move
  dash: 272, dashSigCost: 15, dashSigCd: 6,
  // a chair to the head floors you at once but only briefly, does not add to the down count, and for a moment after
  // getting up another chair only rocks you
  chairDownTime: .9, chairImmune: 3,
  // stun gauge
  stunRegenDelay: 1.8, stunRegen: 8.5, stunAfterDown: .92, stunAfterDownLoss: .05, stunAfterDownMin: .7, stunAfterMove: .62,
  // down state: seconds for the 1st, 2nd ... knock-down, then the cap
  downTimes: [2.0, 3.0, 4.0, 5.0, 6.0], moveDownTime: 1.9, moveChainMax: 3, moveChainScale: .82,
  // moves allowed per down and how long the body stays down after the last one, by the victim's down count:
  // the first down lets in one move and the victim is back up quickly, so one knockdown cannot decide a match
  moveChainByDown: [1, 2, 2, 3], moveDownTimes: [1.05, 1.4, 1.7, 1.9],
  getUpProtect: .95, hitGetUpProtect: .5, mashDown: .07,
  // every wrestler's health is multiplied by this (tuned with tests/sim.mjs so single matches are not over in a minute)
  hpScale: 1.5,
  // injury taken from a match is multiplied by this (raised 20% on 2026-11-26; treatment got cheaper and stronger)
  injuryRate: 1.2,
  // attack bookkeeping
  inputBuffer: .16, comboWindow: 1.0, comboStep: .09, comboMin: .5, comboBreak: 10, staleMemory: 6, staleStep: .1, staleMin: .6, counterHit: 1.25, repeatRecover: 1.25,
  hitstunScale: .94, strikeStun: 1.22,
  // guard, dodge, counter
  guardHp: .18, guardStun: .36, guardPush: .75, perfectGuard: .13, guardBreakStagger: .9, chipMin: 1,
  dodgeTime: .42, dodgeInv: [.03, .27], dodgeSpeed: 250, dodgeCd: .62, backstepTime: .34, counterWindow: .15, counterCd: 1.1,
  // grapple
  grabRange: 50, grabHold: 2.7, grabEscape: 100, mashValue: 7.5, mashDecay: 11, grabStrikeMax: 3, pickup: .32, switchTime: .22, reversalLead: .16, reversalWindow: .17, staggerTime: 1.0, shoveReach: 40,
  grabWalk: 46,
  // emergency escape
  burstCost: 35, burstCd: 18, burstRange: 92,
  // finisher
  finMax: 100, finHit: 2.6, finTaken: .34, finCounter: 10, finPerfect: 6, finTaunt: 9, finMissKeep: .45, tauntTime: 1.0, hypeBonus: .28,
  // ring
  ringOutDamage: 4, countStep: 1.15, countMax: 10, hangTime: 2.2, perchTime: 2.6, wallDamage: 3,
  // pin
  pinStep: .92, pinBase: 34, pinPerHp: 92, pinPerTry: 9, pinMash: 8.5,
  // tag
  tagHeal: 3.2, tagStun: 14, tagRange: 46, tagMaxHeal: .5,
  // rumble
  rumbleInterval: 21, rumbleStart: 2, rumbleMaxInRing: 5,
  // injuries (career only). Points out of 100 for losing a full health bar, plus extras.
  injuryPerBar: 10.5, injuryKO: 3, injuryFinisher: 1.6, injuryRingOut: .8, injuryWarn: 55, injuryDanger: 80,
};

/* Basic attacks. reach/low/high are pixels from the feet. wind-hit-follow are the three key drawings.
   lv: 1 light, 2 medium, 3 heavy, 4 launch. */
export const ATTACKS = {
  jab: { name: '잽', startup: .085, active: .05, recover: .15, reach: 38, low: 44, high: 78, hp: 1.3, stun: 9.6, kb: 46, hs: .25, stop: .04, lv: 1, wind: 'sp4 hd-4 a20/100 b10/128 t18/18 u-22/16', hit: 'sp13 hd-8 a14/106 b93/2 t28/20 u-24/8', follow: 'sp11 hd-6 a16/104 b88/10 t26/20 u-23/9', sfx: 'punch1' },
  cross: { name: '스트레이트', startup: .1, active: .06, recover: .2, reach: 42, low: 44, high: 78, hp: 1.8, stun: 12, kb: 66, hs: .28, stop: .05, lv: 1, wind: 'sp0 hd-4 a-34/116 b60/92 t14/18 u-24/18', hit: 'sp20 hd-10 a92/2 b26/116 t36/22 u-32/6 ox3', follow: 'sp18 hd-8 a86/10 b28/112 t34/22 u-30/7 ox3', sfx: 'punch1' },
  hook: { name: '훅', startup: .17, active: .07, recover: .34, reach: 42, low: 42, high: 82, hp: 3.2, stun: 19.5, kb: 150, hs: .42, stop: .085, lv: 3, wind: 'sp-14 hd-4 a-66/64 b60/90 t4/12 u-12/24', hit: 'sp26 hd-14 a84/44 b4/90 t42/28 u-34/8 ox8', follow: 'sp32 hd-16 a104/60 b0/90 t44/30 u-36/10 ox8', sfx: 'punch2' },
  uppercut: { name: '어퍼컷', startup: .19, active: .07, recover: .42, reach: 36, low: 40, high: 96, hp: 3.6, stun: 21, kb: 80, up: 230, hs: .5, stop: .1, lv: 4, wind: 'sp32 hd-14 a-34/64 b50/100 t54/74 u6/64', hit: 'sp-10 hd-16 a146/44 b0/90 t12/6 u-18/12 lift5', follow: 'sp-16 hd-20 a168/24 b-6/80 t8/4 u-20/14 lift7', sfx: 'punch3', holdR: .4 },
  chop: { name: '손날치기', startup: .14, active: .06, recover: .26, reach: 38, low: 42, high: 76, hp: 2.3, stun: 13, kb: 60, hs: .32, stop: .06, lv: 2, hand: 'open', wind: 'sp-10 hd-6 a148/64 b50/80 t12/14 u-22/16', hit: 'sp22 hd-10 a80/14 b10/90 t32/22 u-28/8', follow: 'sp28 hd-12 a52/10 b6/90 t34/24 u-30/8', sfx: 'chop' },
  palm: { name: '장타', step: 60, startup: .13, active: .06, recover: .24, reach: 38, low: 42, high: 78, hp: 2, stun: 12, kb: 120, hs: .3, stop: .055, lv: 2, hand: 'open', wind: 'sp2 hd-6 a-10/130 b50/90 t20/26 u-22/20', hit: 'sp22 hd-12 a92/4 b30/100 t38/24 u-32/6 ox4', sfx: 'punch1' },
  lowkick: { name: '로우킥', startup: .12, active: .06, recover: .22, reach: 40, low: 6, high: 40, hp: 1.9, stun: 11, kb: 40, hs: .28, stop: .05, lv: 1, lowHit: 1, wind: 'sp2 hd-4 a30/90 b56/80 t-24/60 u-4/10', hit: 'sp-10 hd2 a-10/60 b50/80 t54/4 u-8/10', follow: 'sp-8 hd2 a-6/64 b50/80 t62/12 u-8/10', sfx: 'kick1' },
  midkick: { name: '미들킥', startup: .16, active: .07, recover: .28, reach: 46, low: 26, high: 66, hp: 2.7, stun: 15, kb: 130, hs: .36, stop: .07, lv: 2, wind: 'sp-4 hd0 a20/80 b60/80 t70/104 u-8/10', hit: 'sp-24 hd10 a-24/40 b44/80 t94/2 u-8/8', follow: 'sp-22 hd8 a-20/44 b44/80 t90/20 u-8/8', sfx: 'kick2' },
  spinkick: { name: '돌려차기', startup: .23, active: .08, recover: .36, reach: 50, low: 34, high: 88, hp: 3.7, stun: 20, kb: 200, up: 60, hs: .46, stop: .09, lv: 3, spin: 1, wind: 'sp10 hd-6 a30/60 b40/60 t30/60 u-10/20', hit: 'sp-34 hd16 a-30/30 b30/60 t112/2 u-6/8', follow: 'sp-26 hd10 a-24/34 b34/60 t96/10 u-6/8', sfx: 'kick2' },
  knee: { name: '니킥', startup: .13, active: .07, recover: .26, reach: 32, low: 28, high: 64, hp: 2.6, stun: 14, kb: 80, hs: .34, stop: .065, lv: 2, wind: 'sp14 hd-6 a70/40 b76/40 t-10/60 u-6/10', hit: 'sp-2 hd-6 a20/60 b24/60 t96/116 u-12/8 lift3', sfx: 'kick1' },
  headbutt: { name: '박치기', startup: .19, active: .06, recover: .36, reach: 34, low: 50, high: 86, hp: 3.4, stun: 23, kb: 90, hs: .44, stop: .1, lv: 3, armor: 1, wind: 'sp-18 hd-18 a-30/50 b-20/50 t16/14 u-24/16', hit: 'sp40 hd18 a-24/50 b-14/50 t36/34 u-30/10 ox9', sfx: 'punch3' },
  belly: { name: '배치기', step: 120, startup: .2, active: .1, recover: .34, reach: 38, low: 20, high: 70, hp: 2.8, stun: 18, kb: 220, hs: .4, stop: .08, lv: 3, armor: 1, wind: 'sp16 hd-4 a-10/40 b0/40 t26/26 u-20/20', hit: 'sp-22 hd6 a-50/20 b-40/20 t34/20 u-34/6 ox12', sfx: 'belly' },
  slap: { name: '따귀', startup: .11, active: .06, recover: .2, reach: 38, low: 48, high: 82, hp: 1.5, stun: 13.5, kb: 40, hs: .3, stop: .06, lv: 1, hand: 'open', wind: 'sp-8 hd-4 a-64/10 b56/70 t18/18 u-22/16', hit: 'sp14 hd-6 a100/0 b50/70 t26/22 u-24/10', follow: 'sp20 hd-6 a136/16 b46/70 t28/22 u-24/10', sfx: 'slap' },
  backhand: { name: '손등 따귀', startup: .1, active: .06, recover: .24, reach: 38, low: 48, high: 82, hp: 1.7, stun: 14, kb: 60, hs: .3, stop: .06, lv: 1, hand: 'open', wind: 'sp18 hd-6 a140/40 b46/70 t28/22 u-24/10', hit: 'sp4 hd-4 a84/0 b50/70 t22/20 u-22/12', follow: 'sp-6 hd-4 a20/10 b54/70 t18/18 u-22/14', sfx: 'slap' },
  elbow: { name: '팔꿈치', startup: .11, active: .06, recover: .22, reach: 32, low: 46, high: 80, hp: 2.2, stun: 12.5, kb: 70, hs: .32, stop: .06, lv: 2, wind: 'sp-4 hd-4 a20/130 b40/90 t18/18 u-22/16', hit: 'sp24 hd-8 a92/128 b10/90 t36/24 u-30/8 ox5', sfx: 'punch2' },
  overhand: { name: '내려찍기', startup: .23, active: .07, recover: .4, reach: 40, low: 34, high: 90, hp: 4, stun: 21, kb: 120, hs: .5, stop: .1, lv: 3, armor: 1, wind: 'sp-18 hd-10 a168/50 b172/46 t12/12 u-22/14', hit: 'sp38 hd-12 a66/10 b70/10 t44/44 u-24/30 ox4', sfx: 'punch3' },
  claw: { name: '할퀴기', step: 60, startup: .12, active: .07, recover: .22, reach: 42, low: 34, high: 80, hp: 1.9, stun: 11, kb: 56, hs: .28, stop: .05, lv: 1, hand: 'open', wind: 'sp6 hd-12 a150/40 b40/60 t30/40 u-24/34', hit: 'sp34 hd-18 a70/20 b10/50 t46/44 u-32/24 ox4', follow: 'sp42 hd-20 a30/20 b6/50 t48/46 u-34/24 ox4', sfx: 'slash' },
  claw2: { name: '되할퀴기', startup: .11, active: .07, recover: .26, reach: 44, low: 30, high: 84, hp: 2.2, stun: 12, kb: 70, hs: .3, stop: .055, lv: 2, hand: 'open', wind: 'sp40 hd-18 a30/30 b0/60 t46/44 u-32/24', hit: 'sp16 hd-10 a20/40 b100/10 t34/34 u-28/20 ox4', follow: 'sp4 hd-6 a24/40 b140/20 t28/30 u-26/18', sfx: 'slash' },
  whipA: { name: '촉수 채찍', startup: .13, active: .07, recover: .2, reach: 52, low: 30, high: 76, hp: 1.6, stun: 10, kb: 40, hs: .28, stop: .045, lv: 1, hand: 'open', wind: 'sp-6 hd-4 a120/60 b40/60 t18/20 u-22/18', hit: 'sp20 hd-8 a88/0 b20/80 t34/22 u-30/8 ox4', sfx: 'whip' },
  spinback: { name: '스핀 블로', startup: .2, active: .07, recover: .32, reach: 44, low: 46, high: 84, hp: 3, stun: 18, kb: 160, hs: .42, stop: .085, lv: 3, spin: 1, wind: 'sp10 hd-6 a-40/60 b60/60 t20/24 u-20/20', hit: 'sp8 hd-8 a96/0 b-40/40 t30/22 u-28/10 ox4', follow: 'sp2 hd-4 a130/10 b-40/40 t24/20 u-24/12 ox4', sfx: 'punch2' },
  capoeira: { name: '풍차 발차기', startup: .2, active: .1, recover: .32, reach: 50, low: 10, high: 78, hp: 3.2, stun: 19, kb: 170, up: 70, hs: .44, stop: .08, lv: 3, spin: 1, wind: 'sp50 hd-10 a30/60 b40/60 t60/90 u20/70', hit: 'r-90 sp-10 hd0 a160/10 b120/20 t96/4 u40/30', follow: 'r-70 sp-10 hd0 a160/10 b120/20 t80/10 u30/40', sfx: 'kick2' },
  sumoPush: { name: '밀어치기', step: 95, startup: .12, active: .07, recover: .2, reach: 40, low: 36, high: 78, hp: 1.7, stun: 11.5, kb: 70, hs: .28, stop: .05, lv: 1, hand: 'open', wind: 'sp10 hd-6 a10/120 b70/40 t26/30 u-24/26', hit: 'sp20 hd-10 a88/4 b20/110 t34/30 u-28/22 ox5', sfx: 'punch1' },
  // running
  lariat: { name: '래리어트', startup: .09, active: .18, recover: .34, reach: 40, low: 50, high: 86, hp: 4.4, stun: 24, kb: 230, up: 150, hs: .6, stop: .11, lv: 4, run: 1, carry: .9, wind: 'sp6 hd-4 a30/20 b50/60 t40/40 u-30/30', hit: 'sp16 hd-8 a96/4 b-40/60 t46/20 u-40/30', follow: 'sp26 hd-12 a120/10 b-30/60 t50/24 u-40/20', sfx: 'punch3' },
  shoulder: { name: '숄더 태클', startup: .07, active: .2, recover: .34, reach: 32, low: 30, high: 76, hp: 4, stun: 22, kb: 300, up: 110, hs: .55, stop: .1, lv: 4, run: 1, carry: 1, armor: 1, wind: 'sp30 hd-16 a30/100 b30/90 t40/40 u-30/30', hit: 'sp46 hd-32 a34/116 b24/90 t56/44 u-42/20', sfx: 'punch3' },
  bigboot: { name: '빅 부츠', startup: .1, active: .14, recover: .38, reach: 48, low: 40, high: 84, hp: 4.6, stun: 25, kb: 220, up: 140, hs: .6, stop: .11, lv: 4, run: 1, carry: .6, wind: 'sp-2 hd-2 a20/60 b50/60 t80/90 u-10/20', hit: 'sp-30 hd14 a-40/30 b20/60 t108/4 u-16/10', sfx: 'kick2' },
  slideKick: { name: '슬라이딩', startup: .07, active: .24, recover: .3, reach: 44, low: 0, high: 34, hp: 3.2, stun: 18, kb: 120, up: 160, hs: .5, stop: .08, lv: 4, run: 1, carry: 1.1, lowHit: 1, wind: 'sp10 hd-6 a30/60 b40/60 t50/60 u10/50', hit: 'r-66 sp16 hd20 a-30/20 b40/60 t64/4 u30/70', sfx: 'kick1' },
  bodyBlock: { name: '몸통 박치기', startup: .08, active: .22, recover: .42, reach: 34, low: 10, high: 78, hp: 4.8, stun: 26, kb: 340, up: 120, hs: .6, stop: .12, lv: 4, run: 1, carry: 1, armor: 2, wind: 'sp10 hd-6 a40/60 b50/60 t40/40 u-30/30', hit: 'sp-10 hd-10 a70/60 b80/50 t40/30 u-40/20', sfx: 'belly' },
  flyKnee: { name: '플라잉 니', startup: .09, active: .2, recover: .34, reach: 36, low: 24, high: 80, hp: 4.2, stun: 23, kb: 200, up: 130, hs: .56, stop: .1, lv: 4, run: 1, carry: 1.05, hop: 150, wind: 'sp20 hd-8 a50/60 b60/50 t50/70 u0/40', hit: 'sp-4 hd-8 a20/60 b30/60 t104/122 u-20/50 lift2', sfx: 'kick2' },
  // air
  dropkick: { name: '드롭킥', startup: .07, active: .5, recover: .46, reach: 44, low: -6, high: 52, hp: 4, stun: 23, kb: 250, up: 120, hs: .55, stop: .1, lv: 4, air: 1, push: 120, wind: 'sp30 hd0 a40/60 b50/60 t100/110 u96/110', hit: 'r-78 sp14 hd24 a34/40 b60/40 t78/4 u84/10', sfx: 'kick2', fallBack: 1 },
  flyingElbow: { name: '플라잉 엘보', startup: .08, active: .5, recover: .4, reach: 34, low: -10, high: 60, hp: 3.8, stun: 21, kb: 150, up: 40, hs: .5, stop: .1, lv: 3, air: 1, push: 80, ground: 1, wind: 'sp-14 hd-6 a150/90 b40/50 t30/50 u-10/60', hit: 'r34 sp16 hd-10 a96/120 b120/20 t0/40 u-30/30', sfx: 'punch3' },
  crossbody: { name: '크로스보디', startup: .08, active: .5, recover: .5, reach: 36, low: -16, high: 46, hp: 4.2, stun: 24, kb: 120, up: 60, hs: .6, stop: .1, lv: 4, air: 1, push: 150, ground: 1, wind: 'sp10 hd-6 a120/30 b130/30 t40/50 u20/60', hit: 'r84 sp-8 hd-20 a150/10 b156/10 t-6/20 u6/40', sfx: 'belly', fallFront: 1 },
  axeKick: { name: '공중 뒤꿈치찍기', startup: .1, active: .4, recover: .28, reach: 40, low: -14, high: 60, hp: 3.6, stun: 20, kb: 90, hs: .5, stop: .09, lv: 3, air: 1, push: 60, ground: 1, wind: 'sp-10 hd-6 a30/60 b60/60 t130/10 u-10/50', hit: 'sp24 hd-6 a-20/50 b20/60 t60/2 u-16/50', sfx: 'kick2' },
  buttDrop: { name: '엉덩이 찍기', startup: .09, active: .6, recover: .5, reach: 30, low: -14, high: 40, hp: 5, stun: 24, kb: 100, up: 40, hs: .6, stop: .12, lv: 4, air: 1, push: 20, ground: 1, quake: 70, wind: 'sp10 hd-6 a60/60 b70/60 t70/60 u66/60', hit: 'sp-6 hd-6 a100/20 b110/20 t96/30 u100/36', sfx: 'belly', fallSit: 1 },
  // from the top turnbuckle
  diveElbow: { name: '다이빙 엘보', startup: .1, active: 1.2, recover: .5, reach: 34, low: -20, high: 40, hp: 9, stun: 30, kb: 80, up: 70, hs: .7, stop: .13, lv: 4, air: 1, dive: 1, ground: 1, wind: 'sp-14 hd-8 a160/60 b150/40 t30/40 u0/50', hit: 'r70 sp-10 hd0 a96/124 b150/20 t0/20 u-20/30', sfx: 'punch3', fallFront: 1 },
  diveSplash: { name: '바디 스플래시', startup: .1, active: 1.2, recover: .62, reach: 40, low: -20, high: 36, hp: 10, stun: 32, kb: 60, up: 70, hs: .7, stop: .14, lv: 4, air: 1, dive: 1, ground: 1, wind: 'sp20 hd-10 a60/60 b66/60 t60/90 u50/90', hit: 'r88 sp-10 hd-26 a150/10 b156/10 t-10/14 u0/24', sfx: 'belly', fallFront: 1 },
  diveMoon: { name: '문설트', startup: .1, active: 1.3, recover: .5, reach: 38, low: -20, high: 40, hp: 11, stun: 32, kb: 60, up: 80, hs: .7, stop: .14, lv: 4, air: 1, dive: 1, ground: 1, flip: -450, wind: 'sp-20 hd-14 a160/20 b160/20 t40/60 u30/60', hit: 'r-90 sp-10 hd-20 a150/20 b150/20 t0/30 u10/30', sfx: 'belly', fallFront: 1 },
  diveHead: { name: '다이빙 헤드벗', startup: .1, active: 1.2, recover: .7, reach: 34, low: -20, high: 40, hp: 11, stun: 36, kb: 60, up: 50, hs: .7, stop: .15, lv: 4, air: 1, dive: 1, ground: 1, wind: 'sp30 hd-10 a-20/60 b-10/60 t60/90 u50/90', hit: 'r100 sp6 hd10 a-10/20 b-4/20 t0/10 u6/16', sfx: 'punch3', fallFront: 1 },
  diveQuake: { name: '낙하 방석', startup: .12, active: 1.2, recover: .8, reach: 42, low: -20, high: 40, hp: 13, stun: 40, kb: 100, up: 120, hs: .8, stop: .18, lv: 4, air: 1, dive: 1, ground: 1, quake: 110, wind: 'sp0 hd-10 a150/20 b156/20 t60/90 u50/90', hit: 'sp-6 hd-6 a120/10 b126/10 t96/20 u100/26', sfx: 'belly', fallSit: 1 },
  diveKick: { name: '다이빙 킥', startup: .1, active: 1.2, recover: .5, reach: 42, low: -14, high: 50, hp: 9, stun: 30, kb: 260, up: 100, hs: .7, stop: .13, lv: 4, air: 1, dive: 1, ground: 1, wind: 'sp30 hd0 a40/60 b50/60 t100/110 u96/110', hit: 'r-50 sp10 hd14 a-20/40 b60/40 t96/2 u30/80', sfx: 'kick2', fallBack: 1 },
  // against a downed body
  // from the top of the corner onto a standing foe (topStand); a perfectly timed guard parries them
  missileDropkick: { name: '미사일 드롭킥', startup: .08, active: 1.1, recover: .5, reach: 40, low: 8, high: 74, hp: 9, stun: 36, kb: 300, up: 120, hs: .6, stop: .14, lv: 4, air: 1, dive: 1, topStand: 1, wind: 'sp-8 hd-6 a110/40 b100/40 t50/30 u40/30', hit: 'r-70 sp-24 hd-10 a150/20 b140/20 t100/4 u96/8', sfx: 'kick2', fallBack: 1 },
  topCrossbody: { name: '플라잉 크로스바디', startup: .08, active: 1.1, recover: .55, reach: 44, low: 0, high: 72, hp: 10, stun: 40, kb: 210, up: 90, hs: .7, stop: .15, lv: 4, air: 1, dive: 1, topStand: 1, wind: 'sp-10 hd-6 a150/30 b140/30 t40/40 u30/40', hit: 'r-84 sp0 hd-6 a90/20 b100/20 t20/10 u14/10', sfx: 'belly', fallFront: 1 },
  stomp: { name: '짓밟기', startup: .24, active: .07, recover: .26, reach: 34, low: -8, high: 30, hp: 1.8, stun: 0, kb: 0, hs: .2, stop: .06, lv: 1, ground: 1, floorOnly: 1, clip: 'stomp', sfx: 'kick1' },
  elbowdrop: { name: '엘보 드롭', startup: .42, active: .08, recover: .42, reach: 38, low: -8, high: 30, hp: 3.6, stun: 0, kb: 0, hs: .25, stop: .09, lv: 2, ground: 1, floorOnly: 1, clip: 'elbowdrop', sfx: 'belly' },
};
for (const id in ATTACKS) ATTACKS[id].id = id;
