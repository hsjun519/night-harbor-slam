// Career state and rules: stats, money, fame, ranking, season calendar, contracts, injuries, saving.
import { RNG, clamp, deepClone, fmtMoney } from '../core/util.js';
import { Save } from '../core/SaveManager.js';
import { CHARACTERS, ROSTER_IDS } from '../data/characters.js';
import { BALANCE as B } from '../data/balance.js';
import { MOVES, FINISHERS } from '../data/moves.js';
import { MASTERY, EVOLVE, MAX_LV, masteryLv, lvText } from '../data/mastery.js';

export const SLOT_NAMES = ['오전', '오후', '저녁'];
export const SEASON_DAYS = 28;
// Growth per trained level (levels go 0..20).
export const STAT_GROWTH = { hp: [2.6, '최대 체력'], stun: [2.3, '최대 기절 저항'], atk: [.022, '기본 공격력'], grp: [.022, '레슬링 기술'], spd: [.012, '이동 속도'], jump: [.016, '점프력'], rec: [.02, '기술 회복'], down: [.02, '기절·다운 회복'], kbr: [.022, '넉백 저항'], fin: [.025, '피니셔 충전'], brk: [.03, '스턴 브레이커'] };
export const STYLE_BASE = {
  all: { label: '올라운더', stats: { hp: 100, stun: 100, atk: 1, grp: 1, spd: 1, jump: 1, rec: 1, down: 1, fin: 1, weight: 94, lift: 1.3, kbr: 1 }, chain: ['jab', 'cross', 'hook'], run: 'lariat', air: 'dropkick', dive: 'diveElbow', stance: 'std', finisher: 'dawn', moves: { front: { n: 'bodySlam', f: 'irishWhip', b: 'suplex', u: 'powerbomb', d: 'ddt' }, rear: { n: 'german', f: 'ringOut', b: 'backdropDriver', u: 'atomic', d: 'bulldog' }, catch: 'backBody', counter: 'hipToss' }, build: 'athletic' },
  power: { label: '파워하우스', stats: { hp: 112, stun: 104, atk: 1.06, grp: 1.08, spd: .92, jump: .9, rec: .96, down: .96, fin: .96, weight: 116, lift: 1.9, kbr: 1.15 }, chain: ['palm', 'elbow', 'overhand'], run: 'shoulder', air: 'flyingElbow', dive: 'diveSplash', stance: 'power', finisher: 'container', moves: { front: { n: 'bodySlam', f: 'irishWhip', b: 'backbreaker', u: 'powerbomb', d: 'chokeslam' }, rear: { n: 'german', f: 'ringOut', b: 'giantSwing', u: 'atomic', d: 'backdropDriver' }, catch: 'spinebuster', counter: 'hipToss' }, build: 'power' },
  air: { label: '하이플라이어', stats: { hp: 88, stun: 94, atk: .95, grp: .94, spd: 1.14, jump: 1.24, rec: 1.08, down: 1.08, fin: 1.1, weight: 74, lift: 1, kbr: .85 }, chain: ['lowkick', 'midkick', 'spinkick'], run: 'flyKnee', air: 'dropkick', dive: 'diveMoon', stance: 'air', finisher: 'typhoon', moves: { front: { n: 'headDrop', f: 'irishWhip', b: 'suplex', u: 'bellyToBelly', d: 'ddt' }, rear: { n: 'bulldog', f: 'ringOut', b: 'backdropDriver', u: 'atomic', d: 'german' }, catch: 'backBody', counter: 'armDrag' }, build: 'lean' },
  tech: { label: '테크니션', stats: { hp: 96, stun: 100, atk: .96, grp: 1.14, spd: 1.02, jump: 1, rec: 1.14, down: 1.04, fin: 1.04, weight: 92, lift: 1.5, kbr: 1 }, chain: ['jab', 'elbow', 'knee'], run: 'bigboot', air: 'dropkick', dive: 'diveElbow', stance: 'tech', finisher: 'anchor', moves: { front: { n: 'suplex', f: 'irishWhip', b: 'bellyToBelly', u: 'backbreaker', d: 'ddt' }, rear: { n: 'german', f: 'ringOut', b: 'anchorHold', u: 'backdropDriver', d: 'atomic' }, catch: 'spinebuster', counter: 'armDrag' }, build: 'athletic' },
  brawl: { label: '브롤러', stats: { hp: 104, stun: 108, atk: 1.14, grp: .95, spd: .99, jump: .96, rec: 1, down: 1, fin: 1, weight: 102, lift: 1.4, kbr: 1.06 }, chain: ['jab', 'cross', 'uppercut'], run: 'lariat', air: 'flyingElbow', dive: 'diveElbow', stance: 'box', finisher: 'weld', moves: { front: { n: 'bodySlam', f: 'irishWhip', b: 'cornerSmash', u: 'slapFest', d: 'ddt' }, rear: { n: 'backdropDriver', f: 'ringOut', b: 'german', u: 'atomic', d: 'bulldog' }, catch: 'spinebuster', counter: 'hipToss' }, build: 'athletic' },
  heavy: { label: '슈퍼 헤비급', stats: { hp: 130, stun: 118, atk: 1.04, grp: 1.02, spd: .82, jump: .76, rec: .9, down: .92, fin: .95, weight: 156, lift: 1.8, kbr: 1.6 }, chain: ['sumoPush', 'sumoPush', 'belly'], run: 'bodyBlock', air: 'buttDrop', dive: 'diveQuake', stance: 'heavy', finisher: 'tsunami', moves: { front: { n: 'bodySlam', f: 'irishWhip', b: 'cornerSmash', u: 'airplane', d: 'gutBuster' }, rear: { n: 'backdropDriver', f: 'ringOut', b: 'giantSwing', u: 'atomic', d: 'bulldog' }, catch: 'spinebuster', counter: 'hipToss' }, build: 'heavy' },
};
// Moves a trainer or rival can teach. cost in won, fame needed.
export const LEARNABLE = [
  { id: 'backbreaker', cost: 30000, fame: 5, by: 'trainer' }, { id: 'bellyToBelly', cost: 30000, fame: 5, by: 'trainer' }, { id: 'atomic', cost: 25000, fame: 0, by: 'trainer' },
  { id: 'piledriver', cost: 60000, fame: 25, by: 'trainer' }, { id: 'chokeslam', cost: 70000, fame: 30, by: 'trainer' }, { id: 'giantSwing', cost: 55000, fame: 20, by: 'trainer' },
  { id: 'airplane', cost: 65000, fame: 35, by: 'rival' }, { id: 'gutBuster', cost: 50000, fame: 30, by: 'rival' }, { id: 'headDrop', cost: 45000, fame: 20, by: 'rival' }, { id: 'anchorHold', cost: 50000, fame: 25, by: 'rival' }, { id: 'slapFest', cost: 40000, fame: 15, by: 'rival' }, { id: 'cornerSmash', cost: 35000, fame: 10, by: 'trainer' }, { id: 'spinebuster', cost: 45000, fame: 20, by: 'rival' },
];
export const SHOP_ITEMS = [
  { id: 'bandage', name: '붕대', price: 9600, desc: '부상 게이지 -9. 언제든 사용할 수 있다.', kind: 'item', inj: 9 },
  { id: 'bigBandage', name: '고급 압박 붕대', price: 24000, desc: '부상 게이지 -23.', kind: 'item', inj: 23 },
  // books: learn a grapple move, or change the move used from the top of the corner
  { id: 'bookDDT', name: '기술의 서: DDT', price: 22000, desc: '정면 잡기 기술을 배운다. Tab → 기술에서 장착.', kind: 'book', learn: 'ddt' },
  { id: 'bookGerman', name: '기술의 서: 저먼 수플렉스', price: 30000, desc: '뒤 잡기 기술을 배운다. Tab → 기술에서 장착.', kind: 'book', learn: 'german' },
  { id: 'bookPowerbomb', name: '기술의 서: 파워밤', price: 38000, desc: '정면 잡기 기술을 배운다. 들어 올릴 힘이 필요하다.', kind: 'book', learn: 'powerbomb' },
  { id: 'bookMissile', name: '기술의 서: 미사일 드롭킥', price: 0, desc: '코너 위에서 서 있는 상대에게: 미사일 드롭킥 (기본).', kind: 'book', top: 'stand', move: 'missileDropkick', free: 1 },
  { id: 'bookCrossbody', name: '기술의 서: 플라잉 크로스바디', price: 26000, desc: '코너 위에서 서 있는 상대에게: 온몸으로 덮친다.', kind: 'book', top: 'stand', move: 'topCrossbody' },
  { id: 'bookMoonsault', name: '기술의 서: 문설트', price: 32000, desc: '코너 위에서 누운 상대에게: 뒤로 돌아 덮친다.', kind: 'book', top: 'down', move: 'diveMoon' },
  { id: 'bookSplash', name: '기술의 서: 바디 스플래시', price: 26000, desc: '코너 위에서 누운 상대에게: 배로 내리찍는다.', kind: 'book', top: 'down', move: 'diveSplash' },
  { id: 'champBandage', name: '챔피언의 붕대', price: 42000, desc: '부상 게이지 -40. 떠돌이 상인만 판다.', kind: 'item', inj: 40, rare: 1 },
  { id: 'drink', name: '이온 음료', price: 4000, desc: '피로 -20.', kind: 'item', fat: 20 },
  { id: 'wristTape', name: '손목 테이프', price: 36000, desc: '레슬링 기술 +3%. 장비.', kind: 'gear', slot: 'wrist', mod: { grp: .03 } },
  { id: 'kneePads', name: '무릎 보호대', price: 42000, desc: '넉백 저항 +5%, 다운 회복 +3%.', kind: 'gear', slot: 'knee', mod: { kbr: .05, down: .03 } },
  { id: 'mouthguard', name: '마우스피스', price: 30000, desc: '최대 기절 저항 +6.', kind: 'gear', slot: 'mouth', mod: { stun: 6 } },
  { id: 'proBoots', name: '프로 부츠', price: 55000, desc: '이동 속도 +3%, 점프력 +3%.', kind: 'gear', slot: 'boots', mod: { spd: .03, jump: .03 } },
  { id: 'luckyCharm', name: '등대 부적', price: 48000, desc: '피니셔 충전 +5%.', kind: 'gear', slot: 'charm', mod: { fin: .05 } },
  { id: 'outfitGold', name: '금빛 타이츠', price: 40000, desc: '의상: 금색과 검정.', kind: 'outfit', look: { bottom: { kind: 'tights', c1: '#1c1424', c2: '#ffd65a', pat: 'flame' }, boots: { c1: '#ffd65a', c2: '#1c1424', h: .78 } } },
  { id: 'outfitSea', name: '파도 트렁크', price: 30000, desc: '의상: 청록 파도무늬.', kind: 'outfit', look: { bottom: { kind: 'trunks', c1: '#1f8fa6', c2: '#e6f6ff', pat: 'bands' }, boots: { c1: '#e6f6ff', c2: '#1f8fa6', h: .7 } } },
  { id: 'outfitNeon', name: '네온 싱글렛', price: 50000, desc: '의상: 분홍 네온 싱글렛.', kind: 'outfit', look: { top: { kind: 'singlet', c1: '#ff4fa3', c2: '#23d5c8' }, bottom: { kind: 'shorts', c1: '#ff4fa3', c2: '#23d5c8', pat: 'side' } } },
  { id: 'maskWave', name: '파도 마스크', price: 60000, desc: '의상: 파도 무늬 복면.', kind: 'outfit', mask: { full: 1, kind: 'wave', c1: '#1f6f7a', c2: '#e6f6ff', c3: '#ffd65a' } },
  { id: 'headband', name: '머리띠', price: 15000, desc: '의상: 붉은 머리띠.', kind: 'outfit', hat: 'band', hatCol: '#d23b5a' },
  { id: 'jacket', name: '입장용 망토', price: 45000, desc: '의상: 입장할 때 휘날리는 망토.', kind: 'outfit', cape: { c1: '#3a59b8', len: 1 } },
];

// One save per career slot, under 'save<n>' (+ '.chk' for the morning checkpoint). Builds before 2026-11-26 keyed
// saves by the time of day by mistake ('career0/1/2' = morning/afternoon/evening): read the newest of those once
// and move it over.
const saveKey = n => 'save' + n;
const LEGACY = ['career0', 'career1', 'career2'];
const lex = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
function legacyNewest(suffix = '') {
  let best = null;
  for (const k of LEGACY) {
    const d = Save.get(k + suffix);
    if (!d || typeof d !== 'object' || !d.name) continue;
    const score = [d.created || 0, (d.injury || 0) < 100 && !d.retired ? 1 : 0, d.season || 1, d.day || 1, d.slot || 0];
    if (!best || lex(score, best.score) > 0) best = { d, score };
  }
  return best && best.d;
}
function migrateLegacy(n) {
  const d = legacyNewest();
  if (!d) return null;
  const chk = legacyNewest('.chk');
  d.saveSlot = n;
  Save.set(saveKey(n), d);
  Save.set(saveKey(n) + '.chk', chk && chk.created === d.created ? Object.assign(chk, { saveSlot: n }) : d);
  for (const k of LEGACY) { Save.del(k); Save.del(k + '.chk'); }
  return d;
}
// Sale days: consumables at the clinic and the shop cost 30% less. Merchant days: a peddler sets up on the street.
export const saleOn = d => d.day > 2 && (d.day + d.season * 2) % 6 === 4;
export const merchantOn = d => d.day > 1 && (d.day + d.season) % 5 === 2;
export const salePrice = (d, price) => (saleOn(d) ? Math.round(price * .7 / 100) * 100 : price);
// The peddler's goods. buff: lasts for the next match (or next training); now: takes effect at once; give: an item.
export const RARE_ITEMS = [
  { id: 'knuckle', name: '황금 너클', price: 25000, desc: '다음 경기 공격력 +20%.', buff: { atk: 1.2 } },
  { id: 'guardSet', name: '강철 보호대', price: 22000, desc: '다음 경기에서 쌓이는 부상 -40%.', buff: { guard: .6 } },
  { id: 'eelTonic', name: '등대 장어즙', price: 18000, desc: '피로 -60, 부상 -6. 바로 마신다.', now: { fat: 60, inj: 6 } },
  { id: 'champBandage', name: '챔피언의 붕대', price: 42000, desc: '부상 -40. 소지품에 넣어 둔다.', give: 'champBandage' },
  { id: 'waveCharm', name: '파도 부적', price: 20000, desc: '다음 경기를 피니셔 게이지 50으로 시작.', buff: { finStart: 50 } },
  { id: 'luckyChair', name: '행운의 접이식 의자', price: 15000, desc: '다음 경기 시작 때 내 옆에 의자가 놓여 있다.', buff: { chair: 1 } },
  { id: 'bookChoke', name: '기술의 서: 초크슬램', price: 40000, desc: '정면 잡기 기술. 떠돌이 상인만 파는 책.', learnMove: 'chokeslam' },
  { id: 'bookPile', name: '기술의 서: 파일드라이버', price: 44000, desc: '정면 잡기 기술. 떠돌이 상인만 파는 책.', learnMove: 'piledriver' },
  { id: 'saleBandage', name: '붕대 (상인 특가 30%)', price: 6700, desc: '항구의원 붕대를 30% 싸게. 부상 -9.', give: 'bandage', many: 1 },
];
export const BUFF_NAMES = { atk: '황금 너클', guard: '강철 보호대', finStart: '시작 게이지', chair: '행운의 의자', train: '훈련 효과 +15%' };
// 부둣가 악동단 in the lobby: weak at first; as you grow (level, and each time you beat them) they come back with
// chairs in hand and then a third man who runs in later (late: seconds, or as soon as one of them is down).
// k scales their health (and a little of their power); wait: seconds the others hang back while one is on you.
export const GANG = [
  { k: .72, ai: 'easy', who: ['galchi', 'myeolchi'], armed: [], wait: 5 },
  { k: .8, ai: 'easy', who: ['galchi', 'myeolchi'], armed: ['galchi'], wait: 4.6 },
  { k: .62, ai: 'easy', who: ['galchi', 'myeolchi', 'kkongchi'], armed: ['galchi'], wait: 5, late: { kkongchi: 60 } },
  { k: .62, ai: 'easy', who: ['galchi', 'myeolchi', 'kkongchi'], armed: ['galchi', 'kkongchi'], wait: 5, late: { kkongchi: 55 } },
];
// 선항 레슬링: a promotion from across the sea. d.ow.state:
//   LOCKED (no belt yet) → SIGNS (the first belt; the invasion exactly OW.delay days later, a foghorn the day after)
//   → INVADED (흰상아 at the pier; the dome is wrecked, title matches move to the basement)
//   → SECOND_WAVE (OW.gap days on: they come back, 서도현 teams up with you) → REGROUP
//   → CAPTAIN (OW.gap days on: 선장 고동, a boss in three phases; lose and he waits for you the next day)
//   → REBUILD (they sail away; the dome is rebuilt in OW.rebuild days) → INTERNATIONAL_ROUTE_OPEN (the dome reopens)
export const OW = { delay: 3, gap: 4, rebuild: 5, damaged: ['INVADED', 'SECOND_WAVE', 'REGROUP', 'CAPTAIN', 'REBUILD'] };
export const SLOTS = 3;
// 주간 파이널: three bonus matches a week (days 2, 4, 6 of each week) against one of the top of the ranking
export const weeklyOn = d => d.day >= 2 && [2, 4, 6].includes(d.day % 7);
// a mastery key: a move id, or 'fin:' + finisher id
// the Tab → 기술 list a move shows up in
export const SLOT_OF = { front: '정면 잡기', rear: '뒤 잡기', any: '정면·뒤 잡기', catch: '받아치기', counter: '반격' };
export const moveSlotName = id => (MOVES[id] && SLOT_OF[MOVES[id].pos]) || '기술';
export const learnedText = id => `${MOVES[id].name} 습득! Tab → 기술 → ${moveSlotName(id)}에서 장착`;
export const moveLabel = k => (k.startsWith('fin:') ? (FINISHERS[k.slice(4)] || {}).name : (MOVES[k] || {}).name);
// Builds before the slots had one career: it counts as slot 1.
export function hasCareer(n) { return !!Save.get(saveKey(n)) || (n === 1 && !!legacyNewest()); }
export function anyCareer() { for (let n = 1; n <= SLOTS; n++) if (hasCareer(n)) return true; return false; }
export function slotInfo(n) {
  const d = Save.get(saveKey(n)) || (n === 1 ? legacyNewest() : null);
  if (!d || typeof d !== 'object' || !d.name) return null;
  const rec = d.record || {};
  return { name: d.name, look: d.look, season: d.season || 1, day: d.day || 1, level: d.level || 1, fame: d.fame || 0, w: rec.w || 0, l: rec.l || 0, champion: !!(d.flags && d.flags.champion), titles: (d.titles || []).length, over: !!d.retired || (d.injury || 0) >= 100, savedAt: d.savedAt || d.created || 0 };
}
// the slot played most recently (for 커리어 이어하기)
export function latestSlot() { let best = 0, at = -1; for (let n = 1; n <= SLOTS; n++) { const I = slotInfo(n); if (I && I.savedAt > at) { at = I.savedAt; best = n; } } return best || 1; }
export function deleteCareer(n) { Save.del(saveKey(n)); Save.del(saveKey(n) + '.chk'); if (n === 1) for (const k of LEGACY) { Save.del(k); Save.del(k + '.chk'); } }

export class Career {
  static create(n, setup) {
    const c = new Career();
    const S = STYLE_BASE[setup.style] || STYLE_BASE.all;
    Object.assign(c.d, {
      saveSlot: n, name: setup.name || '신인', style: setup.style || 'all', look: setup.look, created: Date.now(),
      lv: { hp: 0, stun: 0, atk: 0, grp: 0, spd: 0, jump: 0, rec: 0, down: 0, kbr: 0, fin: 0, brk: 0 },
      moves: deepClone(S.moves), known: Array.from(new Set(Object.values(S.moves.front).concat(Object.values(S.moves.rear), [S.moves.catch, S.moves.counter]))), finisher: S.finisher,
    });
    c.d.league = c.newLeague(1);
    c.save(true);
    return c;
  }
  static load(n) { const d = Save.get(saveKey(n)) || (n === 1 ? migrateLegacy(n) : null); if (!d) return null; const c = new Career(); Object.assign(c.d, d); c.d.saveSlot = n; c.migrate(); return c; }
  static loadCheckpoint(n) { if (!Save.get(saveKey(n))) migrateLegacy(n); const d = Save.get(saveKey(n) + '.chk'); if (!d) return null; const c = new Career(); Object.assign(c.d, d); c.d.saveSlot = n; c.migrate(); return c; }
  constructor() {
    this.d = {
      v: 2, saveSlot: 1, name: '신인', style: 'all', look: null, money: 60000, fame: 0, xp: 0, level: 1, points: 0, injury: 0, fatigue: 0,
      record: { w: 0, l: 0, d: 0, ko: 0, pin: 0, streak: 0, official: 0 }, season: 1, day: 1, slot: 0, contract: null, offers: [], offersDay: 0,
      items: { bandage: 1, drink: 1 }, gear: {}, owned: [], outfit: null, flags: {}, npc: {}, h2h: {}, league: [], titles: [], history: [], loc: 'lobby', x: 240,
      seasonLog: { w: 0, l: 0, earned: 0, startLv: null, startRank: null, matches: [] }, earnedTotal: 0, lastResult: null, retired: false, events: {},
      dda: 0, mitb: null, champ: 'fogking', mastery: {}, ow: { state: 'LOCKED' },
    };
  }
  migrate() { this.d.items = this.d.items || {}; this.d.gear = this.d.gear || {}; this.d.npc = this.d.npc || {}; this.d.events = this.d.events || {}; this.d.buffs = this.d.buffs || {}; if (this.d.lv && this.d.lv.brk == null) this.d.lv.brk = 0; if (this.d.dda == null) this.d.dda = 0; if (this.d.mitb === undefined) this.d.mitb = null; if (!this.d.champ) this.d.champ = 'fogking'; if (!this.d.mastery) this.d.mastery = {}; if (!this.d.ow) { this.d.ow = { state: 'LOCKED' }; if (this.d.titles && this.d.titles.length) this.owBegin(); } }
  // d.slot is the time of day (0 morning, 1 afternoon, 2 evening); the save slot is d.saveSlot.
  save(checkpoint) {
    const n = this.d.saveSlot || 1;
    this.d.savedAt = Date.now();
    Save.set(saveKey(n), this.d);
    if (checkpoint) Save.set(saveKey(n) + '.chk', this.d);
  }
  // ---- league ----
  newLeague(season) {
    const base = ['baekpa', 'bjorn', 'taesan', 'neon', 'baeksang', 'mandeok', 'haneul', 'dongsu', 'dohyun', 'dueok', 'palcho', 'bokja'];
    if (season >= 2) base.splice(3, 0, 'ironma', 'gosu');
    return base.map((id, i) => ({ id, pts: (base.length - i) * 10, w: 0, l: 0 }));
  }
  get champion() { return this.d.flags.champion ? 'player' : (this.d.champ || 'fogking'); }
  // Win streaks make the other wrestlers sharper and heavier, losses ease them off (B: dda range and steps).
  ddaFor(id) {
    const k = this.d.dda || 0, c = CHARACTERS[id];
    if (!c || Math.abs(k) < .005) return {};
    const s = c.stats;
    return { stats: { hp: s.hp * (1 + k * .8), atk: s.atk * (1 + k * .5), stun: s.stun * (1 + k * .5) }, aiBoost: k };
  }
  // Money in the Bank: the case you hold, or the one somebody holds against you
  get mitbOpen() { const M = this.d.mitb; return !!(M && this.d.day <= M.until); }
  // Player rank: position among the league plus the player (1 = top contender).
  rankList() {
    const L = this.d.league.slice();
    const me = { id: 'player', pts: this.d.flags.rankPts || 0, w: this.d.record.w, l: this.d.record.l };
    L.push(me);
    L.sort((a, b) => b.pts - a.pts || (a.id === 'player' ? 1 : -1));
    return L;
  }
  get rank() { return this.rankList().findIndex(e => e.id === 'player') + 1; }
  rankOf(id) { return this.rankList().findIndex(e => e.id === id) + 1; }
  // ---- stats ----
  get stats() {
    const S = STYLE_BASE[this.d.style] || STYLE_BASE.all, b = Object.assign({}, S.stats), L = this.d.lv;
    b.hp += L.hp * STAT_GROWTH.hp[0]; b.stun += L.stun * STAT_GROWTH.stun[0];
    for (const k of ['atk', 'grp', 'spd', 'jump', 'rec', 'down', 'kbr', 'fin']) b[k] *= 1 + L[k] * STAT_GROWTH[k][0];
    b.brk = 1 + (L.brk || 0) * STAT_GROWTH.brk[0];
    for (const slot in this.d.gear) { const it = SHOP_ITEMS.find(i => i.id === this.d.gear[slot]); if (it && it.mod) for (const k in it.mod) { if (k === 'stun' || k === 'hp') b[k] += it.mod[k]; else b[k] *= 1 + it.mod[k]; } }
    b.lift *= 1 + L.grp * .015 + L.hp * .008;
    return b;
  }
  get styleDef() { return STYLE_BASE[this.d.style] || STYLE_BASE.all; }
  look() {
    const L = deepClone(this.d.look);
    const o = this.d.outfit;
    if (o) for (const id of o) { const it = SHOP_ITEMS.find(i => i.id === id); if (!it) continue; if (it.look) Object.assign(L, deepClone(it.look)); if (it.mask) L.head.mask = deepClone(it.mask); if (it.hat) { L.head.hat = it.hat; L.head.hatCol = it.hatCol; } if (it.cape) L.cape = deepClone(it.cape); }
    return L;
  }
  // Fighter options for a match.
  entrant(ctrl = 'human') {
    const S = this.styleDef, bf = this.d.buffs || {}, st = Object.assign({}, this.stats), fat = this.d.fatigue, mv = this.d.moves;
    if (bf.atk) st.atk *= bf.atk;
    return { char: Object.assign({}, CHARACTERS.rookie, { id: 'player', name: this.d.name, nick: S.label, style: this.d.style, look: this.look(), stance: S.stance, stats: st, chain: S.chain, run: S.run, air: S.air, dive: mv.topDown || S.dive, topStand: mv.topStand || 'missileDropkick', ground: 'stomp', moves: this.d.moves, finisher: this.d.finisher, color: '#3fe0d0', lines: { win: '해냈다!', lose: '다음엔…', intro: '시작이다.' } }), ctrl, name: this.d.name, stats: st, hpStart: fat > 70 ? .9 : 1, fin: Math.max(this.d.flags.pajeon ? 20 : fat < 20 ? 10 : 0, bf.finStart || 0), mastery: this.masteryPower() };
  }
  // ---- time ----
  get timeText() { return `시즌 ${this.d.season} · ${this.d.day}일차 ${SLOT_NAMES[this.d.slot]}`; }
  spendSlot(n = 1) {
    const d = this.d;
    d.slot += n;
    const msgs = [];
    while (d.slot > 2) { d.slot -= 3; msgs.push(...this.nextDay(true)); }
    return msgs;
  }
  sleep() { const d = this.d; d.slot = 0; const m = this.nextDay(false); d.fatigue = Math.max(0, d.fatigue - 70); this.save(true); return m; }
  nextDay(forced) {
    const d = this.d, msgs = [];
    // the case runs out: an unused one is gone; somebody else's they cash in on the champion while you watch
    if (d.mitb && d.day >= d.mitb.until) {
      const M = d.mitb; d.mitb = null;
      if (M.holder === 'player') msgs.push('머니 인 더 뱅크 가방의 기한이 지났다… 도전권이 사라졌다.');
      else if (!d.flags.champion && CHARACTERS[M.holder]) {
        const rr = new RNG(d.season * 77 + d.day);
        if (rr.chance(.45) && M.holder !== d.champ) { msgs.push(`${CHARACTERS[M.holder].name}이(가) 가방을 써서 ${CHARACTERS[d.champ || 'fogking'].name}을(를) 꺾었다! 새 챔피언이다.`); d.champ = M.holder; }
        else msgs.push(`${CHARACTERS[M.holder].name}의 가방 캐시인은 실패로 끝났다.`);
      }
    }
    // as champion you are not in the Money in the Bank: somebody wins the case and comes for you
    if (d.flags.champion && !d.mitb && d.day >= 8 && !d.events['mitb' + d.season]) {
      const rr = new RNG(d.season * 91 + d.day), top = this.rankList().filter(e => e.id !== 'player' && CHARACTERS[e.id] && !CHARACTERS[e.id].thug).slice(0, 4);
      const h = rr.pick(top.length ? top : [{ id: 'dohyun' }]).id;
      d.events['mitb' + d.season] = 'ai';
      d.mitb = { holder: h, until: d.day + 7 };
      msgs.push(`${CHARACTERS[h].name}이(가) 머니 인 더 뱅크 가방을 차지했다. 챔피언, 언제 들이닥칠지 모른다!`);
    }
    // contract deadline passed without a match
    if (d.contract && d.day >= d.contract.day) { msgs.push(`${d.contract.oppName}와의 계약 경기에 나가지 않았다. 명성 -6, 기권패 처리.`); d.fame = Math.max(0, d.fame - 6); d.record.l++; d.record.streak = 0; d.contract = null; d.flags.noShow = (d.flags.noShow || 0) + 1; }
    // the champion's royalties: shirts, posters, a milk advert
    if (d.flags.champion) { const roy = Math.round((8000 + d.fame * 60) / 1000) * 1000; this.earn(roy); msgs.push(`챔피언 굿즈 로열티 +${fmtMoney(roy)}`); }
    d.day++;
    if (forced) d.fatigue = Math.min(100, d.fatigue + 10);
    if (d.day > SEASON_DAYS) { d.flags.seasonEnd = true; }
    // league simulation: others win and lose too
    const r = new RNG(d.season * 100 + d.day);
    for (const e of d.league) { if (r.chance(.35)) { const up = r.chance(.5 + (CHARACTERS[e.id].stats.hp - 100) / 400); e.pts += up ? 4 : -2; up ? e.w++ : e.l++; } }
    return msgs;
  }
  // ---- injuries ----
  get injuryLevel() { const i = this.d.injury; return i >= B.injuryDanger ? 'danger' : i >= B.injuryWarn ? 'warn' : 'ok'; }
  healInjury(pts) { const before = this.d.injury; this.d.injury = Math.max(0, this.d.injury - pts); return before - this.d.injury; }
  // ---- economy ----
  canPay(n) { return this.d.money >= n; }
  pay(n) { if (this.d.money < n) return false; this.d.money -= n; return true; }
  earn(n) { this.d.money += n; this.d.earnedTotal += n; this.d.seasonLog.earned += n; }
  xpNeed() { return 80 + this.d.level * 40; }
  addXp(n) {
    const d = this.d, ups = [];
    d.xp += n;
    while (d.xp >= this.xpNeed()) { d.xp -= this.xpNeed(); d.level++; d.points += 2; ups.push(d.level); }
    return ups;
  }
  // ---- offers ----
  makeOffers() {
    const d = this.d, r = new RNG(d.season * 1000 + d.day * 7 + d.record.w * 3);
    const ranks = this.rankList(), me = this.rank, out = [];
    const others = ranks.filter(e => e.id !== 'player');
    const pick = off => { const i = me - 1 + off, j = i > me - 1 ? i - 1 : i; return others[clamp(j, 0, others.length - 1)]; };
    const lvl = rk => (d.season >= 2 ? ['normal', 'hard', 'hard', 'expert'] : ['easy', 'normal', 'normal', 'hard'])[clamp(Math.floor((14 - rk) / 4), 0, 3)];
    const mk = (opp, kind, extra = {}) => {
      const rk = this.rankOf(opp.id), c = CHARACTERS[opp.id];
      const reward = Math.round((22000 + (15 - rk) * 5200) * (kind === 'challenge' ? 1.4 : 1) * (1 + (d.season - 1) * .3) / 1000) * 1000;
      return Object.assign({ opp: opp.id, oppName: c.name, mode: 'single', arena: 'hall', reward, fame: kind === 'challenge' ? 9 : 6, kind, day: d.day + 1 + r.int(0, 2), difficulty: lvl(rk), rank: rk, desc: '' }, extra);
    };
    out.push(mk(pick(-1), 'normal', { desc: '바로 위 순위. 이기면 순위를 빼앗는다.' }));
    let ch = pick(r.chance(.5) ? -3 : -2);
    if (out.some(o => o.opp === ch.id)) ch = pick(-4);
    out.push(mk(ch, 'challenge', { desc: '한참 위 순위. 위험하지만 보수와 명성이 크다.' }));
    let third = pick(r.int(0, 2));
    for (let k = 1; k < 6 && out.some(o => o.opp === third.id); k++) third = pick(k % 2 ? k : -k - 1);
    const stips = [[1, { mode: 'pin', desc: '핀폴 매치. 체력 0으로는 끝나지 않는다. 눌러야 이긴다.' }], [1, { arena: 'pier', desc: '부두 특설 링. 관중 앞 야외 경기.' }]];
    if (d.day >= 3 || d.season > 1) stips.push([1.3, { special: 'ladder', pay: 1.3, desc: '래더 매치. 링 위에 매달린 계약서 가방을 먼저 떼어 내는 쪽이 이긴다.' }]);
    if (d.day >= 4 || d.season > 1) stips.push([1.1, { falls: 2, pay: 1.4, desc: '3판 2선승제(투 아웃 오브 스리 폴). 두 번 먼저 이겨야 한다.' }]);
    if (d.day >= 5 || d.season > 1) stips.push([1.2, { special: 'cage', pay: 1.3, desc: '스틸 케이지. KO·핀폴, 또는 철창을 넘어 탈출하면 승리.' }]);
    if (d.day >= 8 || d.season > 1) stips.push([1.1, { special: 'cell', pay: 1.5, arena: 'hall', desc: '헬 인 어 셀. 링 밖까지 덮인 철창, 장외 카운트가 없다.' }]);
    const sp = r.weighted(stips, s => s[0])[1], extra = Object.assign({}, sp);
    out.push(mk(third, 'stip', extra));
    if (extra.pay) { const o = out[out.length - 1]; o.reward = Math.round(o.reward * extra.pay / 1000) * 1000; o.fame += 3; }
    // rivalry: 서도현 asks for a match when the two of you sit close in the ranking
    const rivalRank = this.rankOf('dohyun'), lastRival = d.flags.rivalDay || -9;
    if (Math.abs(rivalRank - me) <= 3 && d.day - lastRival >= 5 && !out.some(o => o.opp === 'dohyun')) {
      const n = (d.h2h.dohyun ? d.h2h.dohyun.w + d.h2h.dohyun.l : 0) + 1;
      out.unshift(mk({ id: 'dohyun' }, 'rival', { arena: 'pier', fame: 12, reward: Math.round((40000 + n * 8000) * (1 + (d.season - 1) * .3) / 1000) * 1000, desc: n === 1 ? '라이벌전 1차전. 서도현이 직접 도전장을 냈다. 부두 특설 링.' : n >= 3 ? `라이벌전 ${n}차전. 이번엔 3판 2선승으로 끝을 본다.` : `라이벌전 ${n}차전. 지난 승부를 기억하는 관중이 모인다.`, rival: n, falls: n >= 3 ? 2 : 0 }));
    }
    // events
    if (d.day >= 10 && d.day <= 14 && !d.events['rumble' + d.season]) out.unshift({ opp: 'rumble', oppName: '만선 럼블', mode: 'rumble', arena: 'hall', reward: 90000 + d.season * 30000, fame: 22, kind: 'event', day: 14, difficulty: d.season >= 2 ? 'hard' : 'normal', desc: '10인 로얄럼블. 21초마다 새 선수가 들어온다. 톱로프 너머로 떨어지면 탈락.', event: 'rumble' + d.season });
    if (d.day >= 18 && d.day <= 21 && !d.events['tag' + d.season]) out.unshift({ opp: 'tag', oppName: '항구 태그 대전', mode: 'tag', arena: 'pier', reward: 70000 + d.season * 20000, fame: 15, kind: 'event', day: 21, difficulty: d.season >= 2 ? 'hard' : 'normal', desc: '2대2 태그 매치. 파트너는 서도현.', event: 'tag' + d.season });
    if (!d.flags.champion && d.day >= 6 && d.day <= 10 && !d.events['mitb' + d.season] && !d.mitb) out.unshift({ opp: 'mitb', oppName: '머니 인 더 뱅크', mode: 'royal', special: 'ladder', arena: this.titleVenue.arena, reward: 60000 + d.season * 20000, fame: 18, kind: 'event', day: 10, difficulty: d.season >= 2 ? 'hard' : 'normal', desc: '4인 래더 매치. 가방을 따면 7일 안에 원하는 때 챔피언에게 도전할 수 있다. 상대가 따면 네가 챔피언일 때 노린다.', event: 'mitb' + d.season, mitb: 1 });
    if (d.flags.champion && !d.contract && (d.day % 3 === 0 || !d.flags.lastDefense)) { const ch = others[0] || { id: 'dohyun' }; out.unshift(mk(ch, 'official', { title: 1, defense: 1, arena: this.titleVenue.arena, fame: 14, reward: Math.round((120000 + d.season * 40000) / 1000) * 1000, desc: '챔피언 방어전. 지면 벨트를 내준다.', day: d.day + 2, falls: 0 })); }
    if (me === 1 && d.fame >= 55 && !d.flags.champion && (d.champ || 'fogking') !== 'fogking') out.unshift({ opp: d.champ, oppName: CHARACTERS[d.champ].name, mode: 'single', arena: this.titleVenue.arena, reward: 260000, fame: 36, kind: 'title', day: d.day + 2, difficulty: d.season >= 2 ? 'expert' : 'hard', rank: 0, desc: `챔피언 타이틀 매치 · 3판 2선승. 벨트는 지금 ${CHARACTERS[d.champ].name}의 허리에 있다.`, title: 1, falls: 2, bossPhases: 1 });
    if (me === 1 && d.fame >= 55 && !d.flags.champion && (d.champ || 'fogking') === 'fogking') out.unshift({ opp: 'fogking', oppName: '안개왕', mode: 'single', arena: this.titleVenue.arena, reward: 300000, fame: 40, kind: 'title', day: d.day + 2, difficulty: d.season >= 2 ? 'expert' : 'hard', rank: 0, desc: d.season >= 2 ? '챔피언 타이틀 매치 · 아이언맨 4분. 폴을 더 많이 딴 쪽이 이긴다. 안개왕은 몰릴수록 강해진다.' : '챔피언 타이틀 매치 · 3판 2선승. 안개왕은 폴을 내줄수록 강해진다.', title: 1, falls: d.season >= 2 ? 0 : 2, iron: d.season >= 2 ? 240 : 0, bossPhases: 1 });
    d.offers = out.slice(0, 4); d.offersDay = d.day;
    return d.offers;
  }
  accept(o) { this.d.contract = deepClone(o); this.d.offers = []; if (o.kind === 'rival') this.d.flags.rivalDay = this.d.day; this.save(); }
  // ---- after a match ----
  applyResult(kind, res, info = {}) {
    const d = this.d, h = res.human, won = res.won, draw = res.draw;
    const out = { lines: [], money: 0, fame: 0, xp: 0, injury: 0, ups: [], rankBefore: this.rank, rankAfter: 0 };
    // injuries: proportional to damage actually taken, never from practice
    if (kind !== 'practice' && h) {
      const maxHp = this.stats.hp;
      let inj = (h.dmgTaken / maxHp) * B.injuryPerBar + (h.ko ? B.injuryKO : 0) + h.finishersTaken * B.injuryFinisher + (h.ringOuts ? B.injuryRingOut : 0);
      inj *= (1 + d.fatigue / 250) * (B.injuryRate || 1) * (d.buffs && d.buffs.guard ? d.buffs.guard : 1);
      inj = Math.round(inj * 10) / 10;
      d.injury = Math.min(100, d.injury + inj); out.injury = inj;
    }
    if (kind !== 'practice') { d.flags.pajeon = 0; d.buffs = d.buffs && d.buffs.train ? { train: d.buffs.train } : {}; }   // one-match buffs are used up
    // move mastery: landed grapple moves and the finisher (sparring counts half)
    out.mastery = this.gainMastery(h && h.uses, kind === 'practice' ? MASTERY.practice : 1);
    if (kind === 'practice') { out.lines.push('연습 경기는 기록에 남지 않는다.'); d.fatigue = Math.min(100, d.fatigue + 8); this.save(); return out; }
    if (!draw && !res.result.forfeit) { const k0 = d.dda || 0; d.dda = clamp(k0 + (won ? (d.record.streak >= 2 ? B.ddaWinStreak : B.ddaWin) : -B.ddaLose), B.ddaMin, B.ddaMax); const p = Math.round(d.dda * 100); if (Math.round(k0 * 100) !== p) out.lines.push(won ? `상대 보정 ${p >= 0 ? '+' : ''}${p}% (이길수록 상대가 강해진다)` : `상대 보정 ${p >= 0 ? '+' : ''}${p}% (조금 숨 돌릴 틈이 생겼다)`); }
    d.fatigue = Math.min(100, d.fatigue + (kind === 'official' || kind === 'event' || kind === 'title' ? 24 : 16));
    const c = d.contract && (kind === 'official' || kind === 'event' || kind === 'title') ? d.contract : info.offer;
    if (draw) d.record.d++;
    else if (won) { d.record.w++; d.record.streak = Math.max(1, d.record.streak + 1); d.seasonLog.w++; if (res.result.how === 'ko') d.record.ko++; if (res.result.how === 'pin') d.record.pin++; }
    else { d.record.l++; d.record.streak = Math.min(-1, d.record.streak - 1); d.seasonLog.l++; }
    let money = 0, fame = 0, xp = won ? 60 : draw ? 35 : 25;
    if (c) {
      money = won ? c.reward : Math.round(c.reward * (draw ? .5 : .25) / 1000) * 1000;
      fame = won ? c.fame : draw ? 2 : 1;
      if (res.result.forfeit) { money = 0; fame = -3; }
      if (!won && (kind === 'brawl' || kind === 'revenge')) { money = 0; fame = kind === 'revenge' ? -1 : 0; }
      xp += won ? 20 + (c.kind === 'challenge' ? 30 : 0) : 0;
      if (c.opp && CHARACTERS[c.opp]) { const r = d.h2h[c.opp] || { w: 0, l: 0 }; won ? r.w++ : draw ? 0 : r.l++; d.h2h[c.opp] = r; }
      // ranking points
      if (kind === 'official' || kind === 'title') {
        d.record.official++;
        const opp = d.league.find(e => e.id === c.opp);
        const myPts = d.flags.rankPts || 0;
        if (won && opp && opp.pts >= myPts) { const gain = opp.pts - myPts + 3; d.flags.rankPts = myPts + gain; opp.pts -= 4; opp.l++; }
        else if (won) d.flags.rankPts = myPts + 3;
        else if (opp) { d.flags.rankPts = Math.max(0, myPts - 3); opp.pts += 3; opp.w++; }
        if (c.title && won && !d.flags.champion) { d.flags.champion = true; d.flags.champDay = d.day; this.owBegin(); d.titles.push({ name: '야항 헤비급 챔피언', season: d.season, day: d.day }); out.lines.push(c.cashIn === 'player' ? '가방 캐시인 성공! 새 챔피언이 탄생했다!' : '새 챔피언이 탄생했다!'); }
        else if (c.title && won) { out.lines.push(c.cashIn ? '가방 캐시인을 막아 냈다! 벨트는 그대로다.' : '방어 성공! 벨트를 지켰다.'); d.flags.lastDefense = d.day; }
        else if (c.title && !won && !draw && d.flags.champion) { d.flags.champion = false; d.champ = c.opp; out.lines.push(c.cashIn ? `${c.oppName}이(가) 가방을 써서 벨트를 빼앗아 갔다…` : `벨트를 ${c.oppName}에게 내줬다…`); }
        if (c.cashIn) d.mitb = null;
      }
      if (c.event) { d.events[c.event] = won ? 'win' : 'done'; }
      if (c.mitb) {
        if (won) { d.mitb = { holder: 'player', until: d.day + 7 }; d.flags.mitbWon = (d.flags.mitbWon || 0) + 1; out.lines.push('머니 인 더 뱅크 가방을 땄다! 7일 안에 경기장 대기실에서 언제든 챔피언에게 도전할 수 있다.'); }
        else { const w = res.result && res.result.winner, id = w && w.charId && CHARACTERS[w.charId] ? w.charId : null; if (id) { d.mitb = { holder: id, until: d.day + 7 }; out.lines.push(`${CHARACTERS[id].name}이(가) 가방을 땄다. 네가 챔피언이 되면 노리러 온다.`); } }
      }
      if (c === d.contract) d.contract = null;
    } else { money = won ? 15000 + d.season * 5000 : 3000; fame = won ? 2 : 0; xp = won ? 35 : 18; }
    if (h) { xp += Math.min(30, (h.moves || 0) * 4) + (h.counters || 0) * 3; }
    if (fame > 0 && d.record.streak >= 3) { fame += 2; out.lines.push(`${d.record.streak}연승! 명성 보너스 +2`); }
    // finishing in style
    const fb = won && res.result && res.result.finishBy;
    if (fb === 'finisher') { const bonus = Math.round(Math.max(5000, money * .25) / 1000) * 1000; money += bonus; fame += 3; xp += 25; out.lines.push(`피니셔 마무리! 보너스 +${fmtMoney(bonus)} · 명성 +3`); }
    else if (fb === 'move') { const bonus = Math.round(Math.max(3000, money * .12) / 1000) * 1000; money += bonus; fame += 1; xp += 12; out.lines.push(`기술 마무리! 보너스 +${fmtMoney(bonus)} · 명성 +1`); }
    d.fame = clamp(d.fame + fame, 0, 999);
    this.earn(Math.max(0, money));
    out.money = money; out.fame = fame; out.xp = xp;
    out.ups = this.addXp(xp);
    out.rankAfter = this.rank;
    d.lastResult = { won, draw, opp: c ? c.oppName : '', kind, how: res.result.how, day: d.day, inj: out.injury, rank: out.rankAfter, oppId: c ? c.opp : null };
    d.history.push(d.lastResult); if (d.history.length > 40) d.history.shift();
    d.seasonLog.matches.push(d.lastResult);
    this.save();
    return out;
  }
  // Rival relationship with 서도현.
  rel(id, v) { const n = this.d.npc[id] || (this.d.npc[id] = { talks: 0, rel: 0, seen: 0 }); if (v) n.rel = clamp(n.rel + v, -10, 10); return n; }
  money() { return fmtMoney(this.d.money); }
  learnable(by) { return LEARNABLE.filter(l => l.by === by && !this.d.known.includes(l.id)); }
  learn(id) { if (!this.d.known.includes(id)) this.d.known.push(id); }
  weeklyOffer() {
    const d = this.d, key = 'wf' + d.season + '_' + d.day;
    if (!weeklyOn(d) || d.events[key]) return null;
    const champ = this.champion, all = this.rankList();
    const top = all.filter(e => e.id !== 'player' && e.id !== champ && CHARACTERS[e.id] && !CHARACTERS[e.id].thug).slice(0, 5);
    if (!top.length) return null;
    const e = top[(d.day * 3 + d.season) % top.length], ch = CHARACTERS[e.id];
    return { kind: 'weekly', opp: e.id, oppName: ch.name, rank: all.indexOf(e) + 1, mode: 'single', arena: 'hall', reward: 25000 + d.season * 10000, fame: 4, difficulty: d.season >= 2 ? 'expert' : 'hard', day: d.day, event: key, desc: '주간 파이널: 이기면 상대가 기술을 직접 가르쳐 준다' };
  }
  // what a beaten finalist teaches: one of their grapple moves you lack, else their finisher
  weeklyLesson(opp) {
    const ch = CHARACTERS[opp], d = this.d;
    if (!ch) return null;
    const pool = [...Object.values(ch.moves.front || {}), ...Object.values(ch.moves.rear || {})].filter((id, i, a) => MOVES[id] && !d.known.includes(id) && a.indexOf(id) === i);
    if (pool.length) return { move: pool[(d.day + d.season) % pool.length] };
    if (ch.finisher && FINISHERS[ch.finisher] && !this.finKnown().includes(ch.finisher)) return { fin: ch.finisher };
    return null;
  }
  // where the belt is fought: the lighthouse dome, or the basement once 선항 레슬링 wrecked the dome
  get titleVenue() { return this.d.ow && OW.damaged.includes(this.d.ow.state) ? { arena: 'basement', loc: 'basement', name: '지하 격투장', x: 540 } : { arena: 'dome', loc: 'dome', name: '등대 돔', x: 480 }; }
  // which beat of the story is due when you walk into a place (not on the way back from a match)
  owDue(loc) {
    const d = this.d, o = d.ow;
    if (!o || (loc !== 'lobby' && loc !== 'street')) return null;
    if (o.state === 'SIGNS' && d.day >= o.at) return 'invasion1';
    if (o.state === 'SIGNS' && !o.heard && d.day > o.champDay && loc === 'street') return 'signal';
    if (o.state === 'INVADED' && d.day >= o.day1 + OW.gap) return 'invasion2';
    if (o.state === 'REGROUP' && d.day >= o.day2 + OW.gap) return 'invasion3';
    if (o.state === 'CAPTAIN' && d.day >= o.retry) return 'invasion3';
    if (o.state === 'REBUILD' && d.day >= o.rebuildAt) return 'rebuilt';
    return null;
  }
  owAfterMatch(kind, won) {
    const d = this.d, o = d.ow;
    if (!o) return;
    if (kind === 'invasion') { o.state = 'INVADED'; o.day1 = d.day; o.won1 = !!won; }
    else if (kind === 'invasion2') { o.state = 'REGROUP'; o.day2 = d.day; o.won2 = !!won; }
    else if (kind === 'invasion3') { if (won) { o.state = 'REBUILD'; o.day3 = d.day; o.rebuildAt = d.day + OW.rebuild; } else { o.state = 'CAPTAIN'; o.retry = d.day + 1; o.losses3 = (o.losses3 || 0) + 1; } }
  }
  owRebuilt() { const o = this.d.ow; if (o) { o.state = 'INTERNATIONAL_ROUTE_OPEN'; o.opened = this.d.day; } }
  owBegin() { const d = this.d; if (!d.ow || d.ow.state === 'LOCKED') d.ow = { state: 'SIGNS', champDay: d.day, at: d.day + OW.delay, heard: 0 }; }
  gangTier() { const d = this.d, p = (d.level || 1) + (d.flags.gangBeaten || 0) * 2; return clamp(Math.floor((p - 1) / 4), 0, GANG.length - 1); }
  // the lobby brawl's line-up for the current tier (season 2 sharpens their AI one step)
  gangMatch() {
    const d = this.d, G = GANG[this.gangTier()], up = { easy: 'normal', normal: 'hard', hard: 'hard' };
    const gang = G.who.map(id => { const S = CHARACTERS[id].stats, k = G.k * (id === 'myeolchi' ? .92 : 1), p = .55 + .45 * k; return { char: id, ctrl: 'ai', difficulty: d.season >= 2 ? up[G.ai] : G.ai, team: 1, waitTurn: G.wait, armed: G.armed.includes(id) ? 1 : 0, late: G.late && G.late[id] || 0, stats: { hp: S.hp * k, stun: S.stun * Math.min(1, k + .06), atk: S.atk * p, grp: S.grp * p } }; });
    return { G, gang, events: [] };
  }
  equipMove(pos, slot, id) { if (MOVES[id] && this.d.known.includes(id)) this.d.moves[pos][slot] = id; }
  equipSpecial(kind, id) { if (MOVES[id] && this.d.known.includes(id) && MOVES[id].pos === kind) this.d.moves[kind] = id; }
  // finishers you can switch between (Tab → 기술 → F)
  finKnown() { const d = this.d; if (!d.finKnown) d.finKnown = [d.finisher]; if (!d.finKnown.includes(d.finisher)) d.finKnown.unshift(d.finisher); return d.finKnown; }
  learnFinisher(id) { const L = this.finKnown(); if (FINISHERS[id] && !L.includes(id)) L.push(id); }
  // ---- move mastery ----
  masteryPower() { const o = {}, M = this.d.mastery || {}; for (const k in M) { const lv = masteryLv(M[k]); if (lv) o[k] = lv * MASTERY.bonus; } return o; }
  masteryOf(k) { return (this.d.mastery || {})[k] || 0; }
  gainMastery(uses, rate = 1) {
    const d = this.d, M = d.mastery || (d.mastery = {}), out = { gains: [], ups: [], evolved: [] };
    for (const k in uses || {}) {
      const n = Math.min(MASTERY.cap, uses[k] | 0), name = moveLabel(k);
      if (!n || !name) continue;
      const before = M[k] || 0, add = Math.max(1, Math.round(n * MASTERY.use * rate)), lv0 = masteryLv(before);
      M[k] = before + add;
      const lv = masteryLv(M[k]);
      out.gains.push({ k, name, add, lv });
      if (lv > lv0) out.ups.push({ k, name, lv, text: `${name} ${lvText(lv)} (피해 +${Math.round(lv * MASTERY.bonus * 100)}%)` });
      const evo = EVOLVE[k];
      if (lv >= MAX_LV && evo && MOVES[evo] && !d.known.includes(evo)) { d.known.push(evo); this.swapMove(k, evo); out.evolved.push({ from: k, to: evo, fromName: name, toName: MOVES[evo].name }); }
    }
    out.gains.sort((a, b) => b.add - a.add);
    return out;
  }
  // an evolved move takes the old one's place in every slot it was in
  swapMove(from, to) { const mv = this.d.moves; for (const pos of ['front', 'rear']) for (const s in mv[pos]) if (mv[pos][s] === from) mv[pos][s] = to; }
}
