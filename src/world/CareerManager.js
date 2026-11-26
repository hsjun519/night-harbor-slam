// Career state and rules: stats, money, fame, ranking, season calendar, contracts, injuries, saving.
import { RNG, clamp, deepClone, fmtMoney } from '../core/util.js';
import { Save } from '../core/SaveManager.js';
import { CHARACTERS, ROSTER_IDS } from '../data/characters.js';
import { BALANCE as B } from '../data/balance.js';
import { MOVES } from '../data/moves.js';

export const SLOT_NAMES = ['오전', '오후', '저녁'];
export const SEASON_DAYS = 28;
// Growth per trained level (levels go 0..20).
export const STAT_GROWTH = { hp: [2.6, '최대 체력'], stun: [2.3, '최대 기절 저항'], atk: [.022, '기본 공격력'], grp: [.022, '레슬링 기술'], spd: [.012, '이동 속도'], jump: [.016, '점프력'], rec: [.02, '기술 회복'], down: [.02, '기절·다운 회복'], kbr: [.022, '넉백 저항'], fin: [.025, '피니셔 충전'] };
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
  { id: 'bandage', name: '붕대', price: 12000, desc: '부상 게이지 -7. 언제든 사용할 수 있다.', kind: 'item', inj: 7 },
  { id: 'bigBandage', name: '고급 압박 붕대', price: 30000, desc: '부상 게이지 -18.', kind: 'item', inj: 18 },
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

export function hasCareer(slot) { return !!Save.get('career' + slot); }

export class Career {
  static create(slot, setup) {
    const c = new Career();
    const S = STYLE_BASE[setup.style] || STYLE_BASE.all;
    Object.assign(c.d, {
      slot, name: setup.name || '신인', style: setup.style || 'all', look: setup.look, created: Date.now(),
      lv: { hp: 0, stun: 0, atk: 0, grp: 0, spd: 0, jump: 0, rec: 0, down: 0, kbr: 0, fin: 0 },
      moves: deepClone(S.moves), known: Array.from(new Set(Object.values(S.moves.front).concat(Object.values(S.moves.rear), [S.moves.catch, S.moves.counter]))), finisher: S.finisher,
    });
    c.d.league = c.newLeague(1);
    c.save(true);
    return c;
  }
  static load(slot) { const d = Save.get('career' + slot); if (!d) return null; const c = new Career(); Object.assign(c.d, d); c.migrate(); return c; }
  static loadCheckpoint(slot) { const d = Save.get('career' + slot + '.chk'); if (!d) return null; const c = new Career(); Object.assign(c.d, d); c.migrate(); return c; }
  constructor() {
    this.d = {
      v: 1, slot: 1, name: '신인', style: 'all', look: null, money: 60000, fame: 0, xp: 0, level: 1, points: 0, injury: 0, fatigue: 0,
      record: { w: 0, l: 0, d: 0, ko: 0, pin: 0, streak: 0, official: 0 }, season: 1, day: 1, slot: 0, contract: null, offers: [], offersDay: 0,
      items: { bandage: 1, drink: 1 }, gear: {}, owned: [], outfit: null, flags: {}, npc: {}, h2h: {}, league: [], titles: [], history: [], loc: 'lobby', x: 240,
      seasonLog: { w: 0, l: 0, earned: 0, startLv: null, startRank: null, matches: [] }, earnedTotal: 0, lastResult: null, retired: false, events: {},
    };
  }
  migrate() { this.d.items = this.d.items || {}; this.d.gear = this.d.gear || {}; this.d.npc = this.d.npc || {}; this.d.events = this.d.events || {}; }
  save(checkpoint) {
    Save.set('career' + this.d.slot, this.d);
    if (checkpoint) Save.set('career' + this.d.slot + '.chk', this.d);
  }
  // ---- league ----
  newLeague(season) {
    const base = ['baekpa', 'bjorn', 'taesan', 'neon', 'baeksang', 'mandeok', 'haneul', 'dongsu', 'dohyun', 'dueok', 'palcho', 'bokja'];
    if (season >= 2) base.splice(3, 0, 'ironma', 'gosu');
    return base.map((id, i) => ({ id, pts: (base.length - i) * 10, w: 0, l: 0 }));
  }
  get champion() { return this.d.flags.champion ? 'player' : 'fogking'; }
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
    const S = this.styleDef, st = this.stats, fat = this.d.fatigue;
    return { char: Object.assign({}, CHARACTERS.rookie, { id: 'player', name: this.d.name, nick: S.label, style: this.d.style, look: this.look(), stance: S.stance, stats: st, chain: S.chain, run: S.run, air: S.air, dive: S.dive, ground: 'stomp', moves: this.d.moves, finisher: this.d.finisher, color: '#3fe0d0', lines: { win: '해냈다!', lose: '다음엔…', intro: '시작이다.' } }), ctrl, name: this.d.name, stats: st, hpStart: fat > 70 ? .9 : 1, fin: this.d.flags.pajeon ? 20 : fat < 20 ? 10 : 0 };
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
    // contract deadline passed without a match
    if (d.contract && d.day >= d.contract.day) { msgs.push(`${d.contract.oppName}와의 계약 경기에 나가지 않았다. 명성 -6, 기권패 처리.`); d.fame = Math.max(0, d.fame - 6); d.record.l++; d.record.streak = 0; d.contract = null; d.flags.noShow = (d.flags.noShow || 0) + 1; }
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
    out.push(mk(third, 'stip', r.chance(.5) ? { mode: 'pin', desc: '핀폴 매치. 체력 0으로는 끝나지 않는다. 눌러야 이긴다.' } : { arena: 'pier', desc: '부두 특설 링. 관중 앞 야외 경기.' }));
    // events
    if (d.day >= 10 && d.day <= 14 && !d.events['rumble' + d.season]) out.unshift({ opp: 'rumble', oppName: '만선 럼블', mode: 'rumble', arena: 'hall', reward: 90000 + d.season * 30000, fame: 22, kind: 'event', day: 14, difficulty: d.season >= 2 ? 'hard' : 'normal', desc: '10인 로얄럼블. 21초마다 새 선수가 들어온다. 톱로프 너머로 떨어지면 탈락.', event: 'rumble' + d.season });
    if (d.day >= 18 && d.day <= 21 && !d.events['tag' + d.season]) out.unshift({ opp: 'tag', oppName: '항구 태그 대전', mode: 'tag', arena: 'pier', reward: 70000 + d.season * 20000, fame: 15, kind: 'event', day: 21, difficulty: d.season >= 2 ? 'hard' : 'normal', desc: '2대2 태그 매치. 파트너는 서도현.', event: 'tag' + d.season });
    if (me === 1 && d.fame >= 55 && !d.flags.champion) out.unshift({ opp: 'fogking', oppName: '안개왕', mode: 'single', arena: 'dome', reward: 300000, fame: 40, kind: 'title', day: d.day + 2, difficulty: d.season >= 2 ? 'expert' : 'hard', rank: 0, desc: '챔피언 타이틀 매치. 등대 돔에서 열린다.', title: 1 });
    d.offers = out.slice(0, 4); d.offersDay = d.day;
    return d.offers;
  }
  accept(o) { this.d.contract = deepClone(o); this.d.offers = []; this.save(); }
  // ---- after a match ----
  applyResult(kind, res, info = {}) {
    const d = this.d, h = res.human, won = res.won, draw = res.draw;
    const out = { lines: [], money: 0, fame: 0, xp: 0, injury: 0, ups: [], rankBefore: this.rank, rankAfter: 0 };
    // injuries: proportional to damage actually taken, never from practice
    if (kind !== 'practice' && h) {
      const maxHp = this.stats.hp;
      let inj = (h.dmgTaken / maxHp) * B.injuryPerBar + (h.ko ? B.injuryKO : 0) + h.finishersTaken * B.injuryFinisher + (h.ringOuts ? B.injuryRingOut : 0);
      inj *= 1 + d.fatigue / 250;
      inj = Math.round(inj * 10) / 10;
      d.injury = Math.min(100, d.injury + inj); out.injury = inj;
    }
    if (kind !== 'practice') d.flags.pajeon = 0;
    if (kind === 'practice') { out.lines.push('연습 경기는 기록에 남지 않는다.'); d.fatigue = Math.min(100, d.fatigue + 8); return out; }
    d.fatigue = Math.min(100, d.fatigue + (kind === 'official' || kind === 'event' || kind === 'title' ? 24 : 16));
    const c = d.contract && kind !== 'free' ? d.contract : info.offer;
    if (draw) d.record.d++;
    else if (won) { d.record.w++; d.record.streak = Math.max(1, d.record.streak + 1); d.seasonLog.w++; if (res.result.how === 'ko') d.record.ko++; if (res.result.how === 'pin') d.record.pin++; }
    else { d.record.l++; d.record.streak = Math.min(-1, d.record.streak - 1); d.seasonLog.l++; }
    let money = 0, fame = 0, xp = won ? 60 : draw ? 35 : 25;
    if (c) {
      money = won ? c.reward : Math.round(c.reward * (draw ? .5 : .25) / 1000) * 1000;
      fame = won ? c.fame : draw ? 2 : 1;
      if (res.result.forfeit) { money = 0; fame = -3; }
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
        if (c.title && won) { d.flags.champion = true; d.titles.push({ name: '야항 헤비급 챔피언', season: d.season, day: d.day }); out.lines.push('새 챔피언이 탄생했다!'); }
      }
      if (c.event) { d.events[c.event] = won ? 'win' : 'done'; }
      if (kind !== 'free') d.contract = null;
    } else { money = won ? 15000 + d.season * 5000 : 3000; fame = won ? 2 : 0; xp = won ? 35 : 18; }
    if (h) { xp += Math.min(30, (h.moves || 0) * 4) + (h.counters || 0) * 3; }
    if (fame > 0 && d.record.streak >= 3) { fame += 2; out.lines.push(`${d.record.streak}연승! 명성 보너스 +2`); }
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
  equipMove(pos, slot, id) { if (MOVES[id] && this.d.known.includes(id)) this.d.moves[pos][slot] = id; }
}
