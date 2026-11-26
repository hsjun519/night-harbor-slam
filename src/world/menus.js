// Windows opened in the world: contracts, matches, shop, clinic, food, moves, info (Tab), map, ranking, results.
import { clamp, fmtMoney, fmtTime, josa, RNG } from '../core/util.js';
import { drawText, textWidth, wrapText } from '../render/pixelfont.js';
import { UI, mixHex } from '../render/palette.js';
import { rect, bands } from '../render/painter.js';
import { panel, gauge, icon, keycap, prompt, fade, menuList } from '../render/ui.js';
import { drawPortrait } from '../render/head.js';
import { CHARACTERS } from '../data/characters.js';
import { MOVES, FINISHERS } from '../data/moves.js';
import { ATTACKS } from '../data/balance.js';
import { BALANCE as B } from '../data/balance.js';
import { MODES } from '../combat/MatchManager.js';
import { ARENAS } from '../combat/arena.js';
import { DIFFICULTY } from '../combat/AIController.js';
import { SHOP_ITEMS, STAT_GROWTH, LEARNABLE, SLOT_NAMES, SEASON_DAYS, RARE_ITEMS, saleOn, salePrice, BUFF_NAMES } from './CareerManager.js';

class Menu {
  constructor(W) { this.W = W; this.game = W.game; this.c = W.c; this.sel = 0; this.t = 0; }
  nav(n, opts = {}) {
    const inp = this.game.input, A = this.game.audio;
    if (!n) return;
    if (inp.pressed('up')) { this.sel = (this.sel + n - 1) % n; A.sfx('ui'); }
    if (inp.pressed('down')) { this.sel = (this.sel + 1) % n; A.sfx('ui'); }
    void opts;
  }
  back() { const inp = this.game.input; if (inp.menuPressed('cancel') || inp.pressed('pause') && this.closeOnPause !== false) { this.game.audio.sfx('back'); this.W.closeTop(); return true; } return false; }
  ok() { return this.game.input.menuPressed('confirm'); }
  update(dt) { this.t += dt; }
  frame(u, title, x = 70, y = 40, w = 500, h = 280, col = '#49d6ff') { fade(u, .5); panel(u, x, y, w, h, { accent: col }); drawText(u, title, x + w / 2, y + 8, { align: 'c', color: col, bold: true }); }
  foot(u, text, y = 304) { drawText(u, text, 320, y, { size: 11, align: 'c', color: UI.dim }); }
}

export class Confirm extends Menu {
  constructor(W, text, yes, o = {}) { super(W); this.text = text; this.yes = yes; this.o = o; this.sel = o.danger ? 1 : 0; }   // risky questions start on '아니요'
  update(dt) {
    super.update(dt); const inp = this.game.input;
    if (inp.pressed('left') || inp.pressed('right') || inp.pressed('up') || inp.pressed('down')) { this.sel ^= 1; this.game.audio.sfx('ui'); }
    if (this.back()) return;
    if (this.ok()) { this.W.closeTop(); if (this.sel === 0) { this.game.audio.sfx('ok'); this.yes(); } else this.game.audio.sfx('back'); }
  }
  draw(u) {
    this.frame(u, this.o.danger ? '경고' : '확인', 120, 110, 400, 130, this.o.danger ? '#ff5b5b' : '#ffd65a');
    wrapText(this.text, 360, 14).forEach((l, i) => drawText(u, l, 320, 138 + i * 17, { align: 'c', color: '#ffffff' }));
    ['예', '아니요'].forEach((t, i) => { const x = 270 + i * 100, on = this.sel === i; rect(u, on ? (i === 0 && this.o.danger ? '#7a1f2a' : '#2a3a7a') : '#141a36', x - 36, 200, 72, 20); if (on) rect(u, '#ffd65a', x - 36, 219, 72, 1); drawText(u, (on ? '▶ ' : '') + t, x, 203, { align: 'c', color: on ? '#ffffff' : UI.dim }); });
    drawText(u, '←→ 선택 · Enter/E 결정 · Esc 취소', 320, 226, { size: 11, align: 'c', color: UI.faint });
  }
}

// ---- contract offers (boss) ----
export class OffersMenu extends Menu {
  update(dt) {
    super.update(dt); const d = this.c.d, list = d.offers;
    this.nav(list.length + 1);
    if (this.back()) return;
    if (this.ok()) {
      if (this.sel === list.length) { this.game.audio.sfx('back'); this.W.closeTop(); return; }
      const o = list[this.sel];
      if (d.contract) { this.game.audio.sfx('deny'); this.W.toast('이미 계약한 경기가 있다. 먼저 치르자.', '#ff8a8a'); return; }
      this.W.open(new Confirm(this.W, `${o.oppName} — ${MODES[o.mode].name}, ${o.day}일까지. 보수 ${fmtMoney(o.reward)}. 계약할까요?`, () => { this.c.accept(o); this.W.closeTop(); this.W.toast(`계약 완료! ${o.day}일까지 경기장 대기실로.`, '#6be38a'); this.W.say([{ who: 'boss', text: o.kind === 'title' ? '드디어군. 등대 돔에서 기다리지. 그 안개를 걷어 내게.' : o.kind === 'event' ? '좋아, 이벤트 명단에 올려 두지. 대기실에서 입장하게.' : `좋아. ${josa(o.oppName, '과/와')}의 경기, 기대하지.` }]); }));
    }
  }
  draw(u) {
    const d = this.c.d, list = d.offers;
    this.frame(u, '경기 제안', 40, 26, 560, 304, '#ffd65a');
    if (d.contract) drawText(u, `현재 계약: ${d.contract.oppName} (${d.contract.day}일까지) — 먼저 이 경기를 치러야 새 계약이 가능하다.`, 320, 46, { size: 11, align: 'c', color: '#ffb347' });
    list.forEach((o, i) => {
      const y = 62 + i * 56, on = i === this.sel, ch = CHARACTERS[o.opp];
      rect(u, on ? '#26315f' : '#141a36', 52, y, 536, 52); if (on) rect(u, '#ffd65a', 52, y, 2, 52);
      rect(u, '#05060f', 58, y + 4, 44, 44);
      if (ch) drawPortrait(u, ch.look, 'smug', 58, y + 4, 44, { px: 1, dy: 4 }); else { drawText(u, o.mode === 'rumble' ? '럼블' : '태그', 80, y + 18, { size: 11, align: 'c', color: '#ffd65a' }); }
      const tag = { normal: '일반', challenge: '도전', stip: '특수', event: '이벤트', title: '타이틀', rival: '라이벌' }[o.kind];
      drawText(u, `[${tag}] ${o.oppName}${o.rank ? ` (${o.rank}위)` : ''}`, 110, y + 4, { color: o.kind === 'title' ? '#ffd65a' : '#ffffff' });
      drawText(u, `${MODES[o.mode].name} · ${ARENAS[o.arena].name} · AI ${DIFFICULTY[o.difficulty].name} · ${o.day}일까지`, 110, y + 21, { size: 11, color: UI.dim });
      drawText(u, o.desc, 110, y + 35, { size: 11, color: '#c9d4ff' });
      drawText(u, fmtMoney(o.reward), 580, y + 4, { align: 'r', color: UI.money });
      drawText(u, `명성 +${o.fame}`, 580, y + 21, { size: 11, align: 'r', color: UI.fame });
    });
    const y = 62 + list.length * 56;
    rect(u, this.sel === list.length ? '#26315f' : '#141a36', 52, y, 536, 18); drawText(u, '닫기', 320, y + 2, { size: 11, align: 'c', color: this.sel === list.length ? '#ffffff' : UI.dim });
    this.foot(u, '↑↓ 고르기 · Enter/E 계약 · Esc 닫기', 300);
    drawText(u, '부상과 피로는 경기 결과에 영향을 준다. 무리한 일정은 피하자.', 320, 316, { size: 11, align: 'c', color: UI.faint });
  }
}

// ---- match list (arena staff) ----
export class ArenaMenu extends Menu {
  constructor(W) {
    super(W);
    const d = this.c.d, r = new RNG(d.season * 500 + d.day * 3 + d.slot);
    const pool = ['taesan', 'haneul', 'neon', 'mandeok', 'dongsu', 'bokja', 'dueok', 'palcho', 'baeksang', 'bjorn', 'baekpa', 'dohyun'];
    this.free = r.shuffle(pool).slice(0, 2).map((id, i) => ({ opp: id, oppName: CHARACTERS[id].name, mode: i ? 'pin' : 'single', arena: r.pick(['hall', 'pier']), reward: 0, fame: 0, kind: 'free', difficulty: d.season >= 2 ? 'hard' : r.pick(['easy', 'normal']), desc: '자유 경기: 기록과 부상은 남지만 랭킹은 그대로.' }));
    this.items = [];
    if (d.contract) this.items.push({ label: `계약 경기: ${d.contract.oppName} 입장`, sub: `${MODES[d.contract.mode].name} · ${ARENAS[d.contract.arena].name} · 보수 ${fmtMoney(d.contract.reward)}`, act: () => this.startOfficial() });
    for (const f of this.free) this.items.push({ label: `자유 경기: ${f.oppName}`, sub: `${MODES[f.mode].name} · ${ARENAS[f.arena].name} · 이기면 소액 보수`, act: () => { this.W.closeTop(); this.W.startMatch('free', f); } });
    this.items.push({ label: '연습 경기 (기록·부상 없음)', sub: '상대 행동을 바꿔 가며 연습', act: () => { this.W.closeTop(); this.W.startMatch('practice', { opp: this.free[0].opp }); } });
    this.items.push({ label: '닫기', act: () => this.W.closeTop() });
  }
  startOfficial() {
    const d = this.c.d, ct = d.contract;
    this.W.closeTop();
    if (ct.title && this.W.loc !== 'dome') { this.W.say([{ who: 'staff', text: '타이틀 매치는 등대 돔에서 열려요! 부둣길 끝의 등대 돔으로 가세요.' }]); return; }
    this.W.startMatch(ct.kind === 'event' ? 'event' : ct.title ? 'title' : 'official', ct);
  }
  update(dt) { super.update(dt); this.nav(this.items.length); if (this.back()) return; if (this.ok()) { this.game.audio.sfx('ok'); this.items[this.sel].act(); } }
  draw(u) {
    this.frame(u, '오늘의 대진', 80, 40, 480, 70 + this.items.length * 34, '#ff5fa2');
    this.items.forEach((it, i) => { const y = 66 + i * 34, on = i === this.sel; rect(u, on ? '#26315f' : '#141a36', 92, y, 456, 30); if (on) rect(u, '#ff5fa2', 92, y, 2, 30); drawText(u, it.label, 100, y + 3, { color: on ? '#ffffff' : '#c9d4ff' }); if (it.sub) drawText(u, it.sub, 100, y + 17, { size: 11, color: UI.dim }); });
    this.foot(u, '↑↓ 고르기 · Enter/E 결정 · Esc 닫기', 40 + 70 + this.items.length * 34 - 16);
  }
}

// ---- shop ----
export class ShopMenu extends Menu {
  constructor(W) { super(W); this.tab = 0; }
  list() { const k = ['item', 'gear', 'outfit', 'book'][this.tab]; return SHOP_ITEMS.filter(i => i.kind === k && !i.rare); }
  price(it) { return it.kind === 'item' ? salePrice(this.c.d, it.price) : it.price; }
  update(dt) {
    super.update(dt);
    const inp = this.game.input, A = this.game.audio, c = this.c, d = c.d, L = this.list();
    if (inp.pressed('left') || inp.pressed('right')) { this.tab = (this.tab + (inp.pressed('left') ? 3 : 1)) % 4; this.sel = 0; A.sfx('ui'); }
    this.nav(L.length);
    if (this.back()) return;
    if (this.ok() && L[this.sel]) {
      const it = L[this.sel];
      if (it.kind === 'book') { this.book(it); return; }
      if (it.kind !== 'item' && d.owned.includes(it.id)) { this.equip(it); return; }
      if (!c.pay(this.price(it))) { A.sfx('deny'); this.W.toast('돈이 모자란다', '#ff8a8a'); return; }
      A.sfx('buy');
      if (it.kind === 'item') { d.items[it.id] = (d.items[it.id] || 0) + 1; this.W.toast(`${it.name} 구입 (소지 ${d.items[it.id]})`, '#9be36b'); }
      else { d.owned.push(it.id); this.equip(it); }
      c.save();
    }
  }
  bookOwned(it) { const d = this.c.d; return it.learn ? d.known.includes(it.learn) : it.free || d.owned.includes(it.id); }
  bookInUse(it) { const m = this.c.d.moves; return it.top === 'stand' ? (m.topStand || 'missileDropkick') === it.move : it.top === 'down' ? m.topDown === it.move : false; }
  book(it) {
    const c = this.c, d = c.d, A = this.game.audio;
    if (it.learn && d.known.includes(it.learn)) { A.sfx('deny'); this.W.toast('이미 배운 기술이다. Tab → 기술에서 장착하자.'); return; }
    if (!this.bookOwned(it)) { if (!c.pay(it.price)) { A.sfx('deny'); this.W.toast('돈이 모자란다', '#ff8a8a'); return; } A.sfx('buy'); if (!it.learn) d.owned.push(it.id); }
    if (it.learn) { c.learn(it.learn); this.W.toast(`${MOVES[it.learn].name} 습득! Tab → 기술에서 장착`, '#6be38a'); }
    else { if (it.top === 'stand') d.moves.topStand = it.move; else d.moves.topDown = it.move; A.sfx('good'); this.W.toast(`코너 기술 변경: ${ATTACKS[it.move].name} (${it.top === 'stand' ? '서 있는 상대' : '누운 상대'})`, '#6be38a'); }
    c.save();
  }
  equip(it) {
    const d = this.c.d, A = this.game.audio;
    if (it.kind === 'gear') { if (d.gear[it.slot] === it.id) { delete d.gear[it.slot]; this.W.toast(`${it.name} 해제`); } else { d.gear[it.slot] = it.id; this.W.toast(`${it.name} 장착!`, '#6be38a'); } }
    else { d.outfit = d.outfit || []; const i = d.outfit.indexOf(it.id); if (i >= 0) { d.outfit.splice(i, 1); this.W.toast(`${it.name} 벗음`); } else { d.outfit.push(it.id); this.W.toast(`${it.name} 착용!`, '#6be38a'); } this.W.player.look = this.c.look(); this.W.player.tails = null; }
    A.sfx('ok'); this.c.save();
  }
  draw(u) {
    const d = this.c.d, L = this.list();
    this.frame(u, '돛대 상회', 60, 30, 520, 296, '#ffb347');
    ['소모품', '장비', '의상', '기술의 서'].forEach((t, i) => { const x = 140 + i * 100, on = i === this.tab; rect(u, on ? '#5a3a1a' : '#1a1a2a', x - 40, 50, 80, 16); drawText(u, t, x, 52, { size: 11, align: 'c', color: on ? '#ffd65a' : UI.dim }); });
    drawText(u, '소지금 ' + this.c.money(), 568, 52, { size: 11, align: 'r', color: UI.money });
    L.forEach((it, i) => {
      const y = 74 + i * 30, on = i === this.sel, own = d.owned.includes(it.id), worn = (d.gear[it.slot] === it.id) || (d.outfit || []).includes(it.id);
      rect(u, on ? '#3a2a1a' : '#141a36', 72, y, 496, 27); if (on) rect(u, '#ffb347', 72, y, 2, 27);
      const bk = it.kind === 'book', bOwn = bk && this.bookOwned(it), bUse = bk && this.bookInUse(it);
      drawText(u, it.name + (it.kind === 'item' ? ` (보유 ${d.items[it.id] || 0})` : bk ? (bUse ? ' [사용 중]' : bOwn ? (it.learn ? ' [습득]' : ' [보유]') : '') : worn ? ' [착용 중]' : own ? ' [보유]' : ''), 80, y + 2, { color: on ? '#ffffff' : '#e6d8c0' });
      drawText(u, it.desc, 80, y + 15, { size: 11, color: UI.dim });
      if (bk) drawText(u, bOwn ? (it.learn ? '' : bUse ? '' : '바꾸기') : fmtMoney(it.price), 560, y + 6, { align: 'r', color: bOwn ? '#6be38a' : UI.money });
      else drawText(u, it.kind !== 'item' && own ? (worn ? '해제' : '착용') : fmtMoney(this.price(it)), 560, y + 6, { align: 'r', color: it.kind !== 'item' && own ? '#6be38a' : this.price(it) < it.price ? '#ff8fc4' : UI.money });
    });
    if (saleOn(d)) drawText(u, '오늘은 항구 대세일! 소모품 30% 할인', 320, 296, { size: 11, align: 'c', color: '#ff8fc4' });
    this.foot(u, this.tab === 3 ? '←→ 분류 · Enter 사기/바꾸기 · 배운 잡기 기술은 Tab → 기술에서 장착' : '←→ 분류 · Enter 구입/착용 · Esc 나가기', 312);
  }
}

// ---- clinic ----
export class ClinicMenu extends Menu {
  opts() {
    const d = this.c.d, inj = d.injury, k = saleOn(d) ? .7 : 1;
    const full = Math.round(Math.max(7000, inj * 1050) * k / 1000) * 1000, part = Math.round(17600 * k / 100) * 100, stay = Math.round(Math.max(13000, inj * 900 + 7500) * k / 1000) * 1000;
    return [
      { label: '응급 처치', sub: `부상 -16 · ${fmtMoney(part)}`, price: part, act: () => this.treat(16, part, 0) },
      { label: '정밀 치료', sub: `부상 전부 · ${fmtMoney(full)} · 시간 1칸`, price: full, act: () => this.treat(100, full, 1) },
      { label: '입원 치료', sub: `부상 전부 + 피로 0 · ${fmtMoney(stay)} · 다음 날 아침까지`, price: stay, act: () => this.hospital(stay) },
      { label: '나가기', act: () => this.W.closeTop() },
    ];
  }
  treat(pts, price, slots) {
    const c = this.c, A = this.game.audio;
    if (c.d.injury <= 0) { this.W.toast('치료할 부상이 없다'); return; }
    if (!c.pay(price)) { A.sfx('deny'); this.W.toast('치료비가 모자란다. 하역장 아르바이트로 벌 수 있다.', '#ff8a8a'); return; }
    const healed = c.healInjury(pts);
    if (slots) c.spendSlot(slots).forEach(m => this.W.toast(m, '#ffb347'));
    A.sfx('heal'); this.W.toast(`부상 -${Math.round(healed)}% (남은 부상 ${Math.round(c.d.injury)}%)`, '#c86bff'); c.save();
  }
  hospital(price) {
    const c = this.c, A = this.game.audio;
    if (!c.pay(price)) { A.sfx('deny'); this.W.toast('입원비가 모자란다', '#ff8a8a'); return; }
    c.healInjury(100); c.d.fatigue = 0;
    this.W.closeTop(); this.W.doSleep(); A.sfx('heal'); this.W.toast('입원 치료를 받았다. 몸이 가볍다!', '#c86bff');
  }
  update(dt) { super.update(dt); const o = this.opts(); this.nav(o.length); if (this.back()) return; if (this.ok()) { this.game.audio.sfx('ok'); o[this.sel].act(); } }
  draw(u) {
    const d = this.c.d, inj = d.injury, lvl = this.c.injuryLevel, col = lvl === 'danger' ? '#ff5b5b' : lvl === 'warn' ? '#ffb347' : UI.inj;
    this.frame(u, '항구의원 — 부상 진료', 80, 34, 480, 290, '#6be3c8');
    icon(u, 'bandage', 104, 64, col, { scale: 2 });
    drawText(u, '부상 게이지', 128, 62, { color: col });
    gauge(u, 128, 82, 300, 12, inj / 100, 'inj', { col, colD: '#3a1450' });
    drawText(u, Math.round(inj) + '%', 436, 80, { color: col, bold: true });
    rect(u, '#ffb347', 128 + 300 * B.injuryWarn / 100, 78, 1, 20); rect(u, '#ff5b5b', 128 + 300 * B.injuryDanger / 100, 78, 1, 20);
    drawText(u, '주의', 128 + 300 * B.injuryWarn / 100, 98, { size: 11, align: 'c', color: '#ffb347' }); drawText(u, '위험', 128 + 300 * B.injuryDanger / 100, 98, { size: 11, align: 'c', color: '#ff5b5b' });
    drawText(u, inj >= 100 ? '…' : lvl === 'danger' ? '위험: 경기에서 100%가 되면 선수 생명이 끝납니다.' : lvl === 'warn' ? '주의: 부상이 쌓였습니다. 치료를 권합니다.' : '경기에서 받은 피해만큼 조금씩 쌓입니다. 쉬어도 낫지 않습니다.', 320, 116, { size: 11, align: 'c', color: '#eef2ff' });
    const o = this.opts();
    o.forEach((it, i) => { const y = 140 + i * 36, on = i === this.sel; rect(u, on ? '#1f4a4a' : '#141a36', 100, y, 440, 32); if (on) rect(u, '#6be3c8', 100, y, 2, 32); drawText(u, it.label, 110, y + 3, { color: on ? '#ffffff' : '#c9e8e0' }); if (it.sub) drawText(u, it.sub, 110, y + 18, { size: 11, color: UI.dim }); });
    drawText(u, '소지금 ' + this.c.money() + `  ·  붕대 ${d.items.bandage || 0} / 고급 붕대 ${d.items.bigBandage || 0} (Tab→소지품)`, 320, 290, { size: 11, align: 'c', color: UI.dim });
    if (saleOn(d)) drawText(u, '오늘은 항구 대세일! 치료비 30% 할인', 320, 126, { size: 11, align: 'c', color: '#ff8fc4' });
    this.foot(u, '↑↓ 고르기 · Enter/E 치료 · Esc 나가기', 306);
  }
}

// ---- travelling merchant: rare goods for one day ----
export class MerchantMenu extends Menu {
  stock() { const d = this.c.d, r = new RNG(d.day * 17 + d.season * 3), pool = r.shuffle(RARE_ITEMS.filter(i => !i.many)).slice(0, 4); return [...pool, RARE_ITEMS.find(i => i.many)]; }
  update(dt) {
    super.update(dt); const L = this.stock(), c = this.c, d = c.d, A = this.game.audio;
    this.nav(L.length + 1);
    if (this.back()) return;
    if (this.ok()) {
      if (this.sel === L.length) { this.W.closeTop(); return; }
      const it = L[this.sel], bought = d.flags.merchant && d.flags.merchant.day === d.day ? d.flags.merchant.ids : [];
      if (!it.many && bought.includes(it.id)) { A.sfx('deny'); this.W.toast('이건 오늘 한 개뿐이었어!', '#ff8a8a'); return; }
      if (!c.pay(it.price)) { A.sfx('deny'); this.W.toast('돈이 모자란다', '#ff8a8a'); return; }
      d.flags.merchant = { day: d.day, ids: [...bought, it.id] };
      if (it.buff) Object.assign(d.buffs, it.buff);
      if (it.now) { if (it.now.fat) d.fatigue = Math.max(0, d.fatigue - it.now.fat); if (it.now.inj) c.healInjury(it.now.inj); }
      if (it.give) d.items[it.give] = (d.items[it.give] || 0) + 1;
      if (it.learnMove) c.learn(it.learnMove);
      A.sfx('buy'); this.W.toast(`${it.name} 구입! ${it.desc}`, '#9be36b'); c.save();
    }
  }
  draw(u) {
    const d = this.c.d, L = this.stock(), bought = d.flags.merchant && d.flags.merchant.day === d.day ? d.flags.merchant.ids : [];
    this.frame(u, '떠돌이 상인 보부의 보따리', 60, 30, 520, 300, '#c98aff');
    drawText(u, '오늘만 파는 물건. 내일이면 다음 항구로 떠난다.', 320, 50, { size: 11, align: 'c', color: '#e0c8ff' });
    L.forEach((it, i) => { const y = 70 + i * 36, on = i === this.sel, sold = !it.many && bought.includes(it.id); rect(u, on ? '#3a2a5a' : '#141a36', 72, y, 496, 32); if (on) rect(u, '#c98aff', 72, y, 2, 32); drawText(u, it.name + (sold ? ' [품절]' : ''), 80, y + 3, { color: sold ? UI.faint : on ? '#ffffff' : '#e6d8ff' }); drawText(u, it.desc, 80, y + 18, { size: 11, color: UI.dim }); drawText(u, fmtMoney(it.price), 560, y + 9, { align: 'r', color: UI.money }); });
    const y = 70 + L.length * 36; rect(u, this.sel === L.length ? '#3a2a5a' : '#141a36', 72, y, 496, 18); drawText(u, '나가기', 320, y + 2, { size: 11, align: 'c', color: this.sel === L.length ? '#ffffff' : UI.dim });
    drawText(u, '소지금 ' + this.c.money(), 320, 296, { size: 11, align: 'c', color: UI.money });
    this.foot(u, '↑↓ 고르기 · Enter/E 사기 · Esc 나가기', 312);
  }
}

// ---- vending machine: small, cheap, three a day ----
export class VendingMenu extends Menu {
  opts() {
    return [
      { label: '이온 음료', price: 3000, sub: '피로 -12', fn: d => { d.fatigue = Math.max(0, d.fatigue - 12); } },
      { label: '단백질 셰이크', price: 6000, sub: '피로 -6 · 다음 훈련 효과 +15%', fn: d => { d.fatigue = Math.max(0, d.fatigue - 6); d.buffs.train = 1.15; } },
      { label: '번개 에너지', price: 5000, sub: '다음 경기를 피니셔 게이지 12로 시작 · 피로 +4', fn: d => { d.buffs.finStart = Math.max(d.buffs.finStart || 0, 12); d.fatigue = Math.min(100, d.fatigue + 4); } },
      { label: '나가기', close: 1 },
    ];
  }
  left() { const d = this.c.d, v = d.flags.vend; return 3 - (v && v.day === d.day ? v.n : 0); }
  update(dt) {
    super.update(dt); const o = this.opts(), c = this.c, d = c.d, A = this.game.audio;
    this.nav(o.length);
    if (this.back()) return;
    if (!this.ok()) return;
    const it = o[this.sel];
    if (it.close) { this.W.closeTop(); return; }
    if (this.left() <= 0) { A.sfx('deny'); this.W.toast('오늘은 더 마시면 배탈 난다. (하루 3잔)', '#ff8a8a'); return; }
    if (!c.pay(it.price)) { A.sfx('deny'); this.W.toast('돈이 모자란다', '#ff8a8a'); return; }
    it.fn(d); const v = d.flags.vend; d.flags.vend = { day: d.day, n: (v && v.day === d.day ? v.n : 0) + 1 };
    A.sfx('coin'); this.W.toast(`${it.label}: ${it.sub}`, '#9be36b'); c.save();
  }
  draw(u) {
    this.frame(u, '자판기', 150, 70, 340, 210, '#49d6ff');
    this.opts().forEach((it, i) => { const y = 96 + i * 34, on = i === this.sel; rect(u, on ? '#1f3a5a' : '#141a36', 162, y, 316, 30); drawText(u, it.label, 172, y + 3, { color: on ? '#ffffff' : '#c9e8ff' }); drawText(u, it.sub || '', 172, y + 17, { size: 11, color: UI.dim }); if (it.price) drawText(u, fmtMoney(it.price), 470, y + 8, { align: 'r', color: UI.money }); });
    drawText(u, `오늘 남은 횟수 ${this.left()}/3`, 320, 236, { size: 11, align: 'c', color: this.left() ? '#9be36b' : '#ff8a8a' });
    this.foot(u, '↑↓ 고르기 · Enter/E 사기 · Esc 나가기', 258);
  }
}

// ---- food stall ----
export class FoodMenu extends Menu {
  opts() {
    return [
      { label: '어묵탕', price: 4000, sub: '피로 -15', fn: d => { d.fatigue = Math.max(0, d.fatigue - 15); } },
      { label: '해물파전', price: 9000, sub: '다음 경기: 피니셔 게이지 20으로 시작', fn: d => { d.flags.pajeon = 1; } },
      { label: '돼지국밥', price: 7000, sub: '피로 -32 · 시간 1칸', fn: (d, c) => { d.fatigue = Math.max(0, d.fatigue - 32); c.spendSlot(1).forEach(m => this.W.toast(m, '#ffb347')); } },
      { label: '소문 듣기', price: 0, sub: '공짜', gossip: 1 },
      { label: '나가기', price: 0, close: 1 },
    ];
  }
  update(dt) {
    super.update(dt); const o = this.opts(), c = this.c, d = c.d, A = this.game.audio;
    this.nav(o.length);
    if (this.back()) return;
    if (this.ok()) {
      const it = o[this.sel];
      if (it.close) { this.W.closeTop(); return; }
      if (it.gossip) { this.W.closeTop(); this.W.say([{ who: 'auntie', text: this.gossip() }]); return; }
      if (!c.pay(it.price)) { A.sfx('deny'); this.W.toast('돈이 모자라', '#ff8a8a'); return; }
      it.fn(d, c); A.sfx('coin'); this.W.toast(`${it.label} 맛있게 먹었다! ${it.sub}`, '#9be36b'); c.save();
    }
  }
  gossip() {
    const d = this.c.d, ct = d.contract, r = new RNG(d.day);
    if (ct && CHARACTERS[ct.opp]) { const ch = CHARACTERS[ct.opp], F = FINISHERS[ch.finisher]; return `${ch.name} 말이야? ${F.type === 'grab' ? `그 사람 마지막 기술 "${F.name}"은 붙잡는 기술이래. 게이지가 가득 차면 거리를 둬.` : F.type === 'dive' ? `"${F.name}"은 높이 뛰어서 덮치는 거래. 뛰는 걸 보면 옆으로 빠져.` : F.type === 'strike' ? `"${F.name}"은 달려들며 치는 기술이래. 막을 수 있다더라, S로.` : F.type === 'stance' ? `"${F.name}"은 받아치는 자세래. 그 자세일 때 때리면 안 된대.` : `"${F.name}"… 무거운 몸으로 덮친대. 멀리 피해.`}`; }
    return r.pick(['서도현이 요즘 밤마다 혼자 훈련한대. 너 때문인가 봐.', '안개왕은 경기 전날엔 등대 근처를 걷는대.', '강태산은 원래 부두 크레인 기사였어. 사람도 화물처럼 든다니까.', '네온 제이는 관중이 시끄러울수록 무서워져.', '하역장 장 반장이 요즘 사람을 구하더라.', '의원 한 선생이 레슬러들한테 제일 무서운 사람이야. 잔소리가 아주…']);
  }
  draw(u) {
    this.frame(u, '순덕 포차', 120, 60, 400, 230, '#ff8a9a');
    this.opts().forEach((it, i) => { const y = 88 + i * 34, on = i === this.sel; rect(u, on ? '#4a1a2a' : '#141a36', 134, y, 372, 30); drawText(u, it.label, 144, y + 3, { color: on ? '#ffffff' : '#f0d0d8' }); drawText(u, it.sub || '', 144, y + 17, { size: 11, color: UI.dim }); if (it.price) drawText(u, fmtMoney(it.price), 498, y + 8, { align: 'r', color: UI.money }); });
    drawText(u, '피로가 높으면 훈련 효과가 떨어지고 경기에서 부상이 더 쌓인다.', 320, 262, { size: 11, align: 'c', color: UI.faint });
    this.foot(u, '↑↓ 고르기 · Enter/E 주문 · Esc 나가기', 276);
  }
}

// ---- learning moves ----
export class LearnMenu extends Menu {
  constructor(W, by) { super(W); this.by = by; }
  list() { return LEARNABLE.filter(l => l.by === this.by); }
  update(dt) {
    super.update(dt); const L = this.list(), c = this.c, d = c.d, A = this.game.audio;
    this.nav(L.length);
    if (this.back()) return;
    if (this.ok() && L[this.sel]) {
      const l = L[this.sel];
      if (d.known.includes(l.id)) { this.W.toast('이미 배운 기술. Tab → 기술에서 장착하자.'); return; }
      if (this.by === 'rival' && !(d.flags.dojo_gosu || d.flags.dojo_ironma)) { A.sfx('deny'); this.W.toast('도장 깨기에서 한 번은 이겨야 가르쳐 준다', '#ff8a8a'); return; }
      if (d.fame < l.fame) { A.sfx('deny'); this.W.toast(`명성 ${l.fame} 이상 필요`, '#ff8a8a'); return; }
      if (!c.pay(l.cost)) { A.sfx('deny'); this.W.toast('수업료가 모자란다', '#ff8a8a'); return; }
      c.learn(l.id); A.sfx('good'); this.W.toast(`${MOVES[l.id].name} 습득! Tab → 기술에서 장착`, '#6be38a'); c.save();
    }
  }
  draw(u) {
    const d = this.c.d, L = this.list();
    this.frame(u, this.by === 'rival' ? '철썩 짐의 기술' : '백 관장의 기술 교실', 70, 30, 500, 300, '#6be38a');
    L.forEach((l, i) => { const m = MOVES[l.id], y = 56 + i * 32, on = i === this.sel, has = d.known.includes(l.id); rect(u, on ? '#1f3a2a' : '#141a36', 82, y, 476, 29); drawText(u, m.name + (has ? ' [습득]' : ''), 90, y + 2, { color: has ? UI.faint : on ? '#ffffff' : '#c9e8d0' }); drawText(u, m.desc, 90, y + 16, { size: 11, color: UI.dim }); drawText(u, has ? '' : fmtMoney(l.cost), 550, y + 2, { align: 'r', color: UI.money }); drawText(u, has ? '' : `명성 ${l.fame}`, 550, y + 16, { size: 11, align: 'r', color: d.fame >= l.fame ? UI.fame : '#ff8a8a' }); });
    this.foot(u, '↑↓ 고르기 · Enter/E 배우기 · Esc 나가기 · 배운 기술은 Tab → 기술에서 장착', 312);
  }
}

// ---- Tab: player info ----
const POS_NAMES = { front: '정면 잡기', rear: '뒤 잡기' }, SLOT_KEYS = { n: 'K', f: '→+K', b: '←+K', u: 'W+K', d: 'S+K' };
export class InfoMenu extends Menu {
  constructor(W, tab = 1) { super(W); this.tab = tab; this.pick = null; this.closeOnPause = true; }
  rows() {
    const d = this.c.d;
    if (this.tab === 0) return Object.keys(STAT_GROWTH);
    if (this.tab === 2) { const r = []; for (const pos of ['front', 'rear']) for (const s of ['n', 'f', 'b', 'u', 'd']) r.push({ pos, s }); return r; }
    if (this.tab === 3) return ['bandage', 'bigBandage', 'champBandage', 'drink'].filter(k => (d.items[k] || 0) > 0);
    return [];
  }
  update(dt) {
    super.update(dt);
    const inp = this.game.input, A = this.game.audio, c = this.c, d = c.d;
    if (this.pick) { this.pickUpdate(); return; }
    if (inp.pressed('left') || inp.pressed('right')) { this.tab = (this.tab + (inp.pressed('left') ? 3 : 1)) % 4; this.sel = 0; A.sfx('ui'); }
    const R = this.rows();
    this.nav(R.length);
    if (inp.pressed('info') || this.back()) { if (inp.pressed('info')) this.W.closeTop(); return; }
    if (this.ok() && R.length) {
      if (this.tab === 0) { const k = R[this.sel]; if (d.points <= 0) { A.sfx('deny'); this.W.toast('능력치 포인트가 없다. 경기로 경험치를 모으자.'); return; } if (d.lv[k] >= 20) { A.sfx('deny'); return; } d.points--; d.lv[k] = Math.min(20, d.lv[k] + 1); A.sfx('stat'); c.save(); }
      if (this.tab === 2) { const r = R[this.sel]; this.pick = { pos: r.pos, s: r.s, i: 0, list: d.known.filter(id => MOVES[id] && (MOVES[id].pos === r.pos || MOVES[id].pos === 'any')) }; A.sfx('ok'); }
      if (this.tab === 3) { const k = R[this.sel], it = SHOP_ITEMS.find(i => i.id === k); d.items[k]--; if (it.inj) { const h = c.healInjury(it.inj); this.W.toast(`${it.name} 사용: 부상 -${Math.round(h)}%`, '#c86bff'); } if (it.fat) { d.fatigue = Math.max(0, d.fatigue - it.fat); this.W.toast(`${it.name}: 피로 -${it.fat}`, '#9be36b'); } A.sfx('heal'); c.save(); }
    }
  }
  pickUpdate() {
    const inp = this.game.input, A = this.game.audio, P = this.pick;
    if (inp.pressed('up')) { P.i = (P.i + P.list.length - 1) % P.list.length; A.sfx('ui'); }
    if (inp.pressed('down')) { P.i = (P.i + 1) % P.list.length; A.sfx('ui'); }
    if (inp.menuPressed('cancel')) { this.pick = null; A.sfx('back'); return; }
    if (inp.menuPressed('confirm')) { this.c.equipMove(P.pos, P.s, P.list[P.i]); this.pick = null; A.sfx('good'); this.c.save(); }
  }
  draw(u) {
    const c = this.c, d = c.d;
    fade(u, .55);
    panel(u, 30, 22, 580, 314, { accent: '#49d6ff' });
    ['능력치', '커리어', '기술', '소지품'].forEach((t, i) => { const x = 110 + i * 140, on = i === this.tab; rect(u, on ? '#26315f' : '#141a36', x - 60, 30, 120, 18); drawText(u, t, x, 33, { size: 11, align: 'c', color: on ? '#ffd65a' : UI.dim }); });
    // portrait
    rect(u, '#05060f', 44, 58, 70, 70); rect(u, '#1b2450', 45, 59, 68, 68); drawPortrait(u, c.look(), 'neutral', 45, 59, 68, { px: 2, dy: 8 });
    drawText(u, d.name, 122, 58, { color: '#ffffff', bold: true });
    drawText(u, `${c.styleDef.label} · 레벨 ${d.level}`, 122, 76, { size: 11, color: '#49d6ff' });
    gauge(u, 122, 92, 110, 4, d.xp / c.xpNeed(), 'fin', {}); drawText(u, `경험치 ${d.xp}/${c.xpNeed()}`, 238, 89, { size: 11, color: UI.dim });
    drawText(u, `피니셔: ${FINISHERS[d.finisher].name}`, 122, 104, { size: 11, color: '#ffd65a' });
    const T = this.tab;
    if (T === 0) {
      drawText(u, `능력치 포인트: ${d.points}  (Enter로 1 올리기, 레벨업마다 +2 · 훈련으로도 오른다)`, 44, 136, { size: 11, color: d.points ? '#6be38a' : UI.dim });
      this.rows().forEach((k, i) => { const y = 154 + i * 17, on = i === this.sel; if (on) rect(u, '#26315f', 40, y - 2, 560, 16); drawText(u, STAT_GROWTH[k][1], 50, y, { size: 11, color: on ? '#ffffff' : '#c9d4ff' }); gauge(u, 170, y + 3, 200, 6, d.lv[k] / 20, 'fin', { col: '#49d6ff' }); drawText(u, `Lv ${d.lv[k].toFixed(1)}`, 380, y, { size: 11, color: UI.dim }); const s = c.stats; const v = k === 'hp' || k === 'stun' ? Math.round(s[k]) : Math.round(s[k] * 100) + '%'; drawText(u, String(v), 590, y, { size: 11, align: 'r', color: '#ffffff' }); });
    } else if (T === 1) {
      const inj = d.injury, lvl = c.injuryLevel, col = lvl === 'danger' ? '#ff5b5b' : lvl === 'warn' ? '#ffb347' : UI.inj;
      const L = [[`전적`, `${d.record.w}승 ${d.record.l}패 ${d.record.d}무 (KO ${d.record.ko} · 핀 ${d.record.pin})`], ['랭킹', d.flags.champion ? '챔피언' : `${c.rank}위 / ${c.rankList().length}명`], ['명성', String(d.fame)], ['소지금', c.money()], ['날짜', c.timeText], ['계약', d.contract ? `${d.contract.oppName} (${d.contract.day}일까지)` : '없음'], ['연승', d.record.streak > 0 ? d.record.streak + '연승' : d.record.streak < 0 ? -d.record.streak + '연패' : '-'], ['타이틀', d.titles.length ? d.titles.map(t => t.name).join(', ') : '없음']];
      L.forEach(([k, v], i) => { drawText(u, k, 50, 140 + i * 17, { size: 11, color: UI.dim }); drawText(u, v, 130, 140 + i * 17, { size: 11, color: '#ffffff' }); });
      // injuries: visible here, never in the ring
      panel(u, 340, 136, 252, 92, { accent: col, cut: 2 });
      icon(u, 'bandage', 350, 146, col, { scale: 2 }); drawText(u, `부상 ${Math.round(inj)}%`, 372, 144, { color: col, bold: true });
      gauge(u, 350, 166, 232, 9, inj / 100, 'inj', { col, colD: '#3a1450' });
      drawText(u, lvl === 'danger' ? '위험! 100%가 되면 게임 오버' : lvl === 'warn' ? '주의: 치료를 권합니다' : '경기 피해만큼 조금씩 쌓인다', 350, 182, { size: 11, color: col });
      drawText(u, '치료: 항구의원 · 상점 붕대', 350, 196, { size: 11, color: UI.dim });
      drawText(u, `피로 ${Math.round(d.fatigue)}`, 350, 210, { size: 11, color: d.fatigue > 70 ? '#ff8a8a' : UI.dim }); gauge(u, 420, 213, 160, 4, d.fatigue / 100, 'stun', {});
      const h = d.history.slice(-4).reverse();
      drawText(u, '최근 경기', 344, 236, { size: 11, color: UI.dim });
      h.forEach((r, i) => drawText(u, `${r.day}일 ${r.won ? '승' : r.draw ? '무' : '패'} vs ${r.opp} (부상 +${r.inj})`, 344, 250 + i * 14, { size: 11, color: r.won ? '#6be38a' : r.draw ? UI.dim : '#ff8a8a' }));
    } else if (T === 2) {
      drawText(u, '잡은 뒤 입력별 기술. Enter로 바꾸기 (배운 기술 중에서)', 44, 136, { size: 11, color: UI.dim });
      this.rows().forEach((r, i) => { const x = r.pos === 'front' ? 44 : 330, y = 168 + ['n', 'f', 'b', 'u', 'd'].indexOf(r.s) * 26, on = i === this.sel && !this.pick; if (r.s === 'n') drawText(u, POS_NAMES[r.pos], x, 152, { size: 11, color: '#ffd65a' }); rect(u, on ? '#26315f' : '#141a36', x, y, 268, 22); keycap(u, SLOT_KEYS[r.s], x + 4, y + 5); const m = MOVES[d.moves[r.pos][r.s]]; drawText(u, m ? m.name : '-', x + 60, y + 5, { size: 11, color: on ? '#ffffff' : '#c9d4ff' }); });
      drawText(u, `받아치기: ${MOVES[d.moves.catch].name} · 반격: ${MOVES[d.moves.counter].name}`, 44, 302, { size: 11, color: UI.dim });
      drawText(u, `코너 위 — 서 있는 상대: ${(ATTACKS[d.moves.topStand] || ATTACKS.missileDropkick).name} · 누운 상대: ${(ATTACKS[d.moves.topDown || this.c.styleDef.dive] || {}).name || '-'} (돛대 상회 '기술의 서'로 바꾼다)`, 44, 288, { size: 11, color: '#ffd65a' });
      if (this.pick) { const P = this.pick; panel(u, 180, 100, 280, 210, { accent: '#ffd65a' }); drawText(u, `${POS_NAMES[P.pos]} ${SLOT_KEYS[P.s]}`, 320, 108, { size: 11, align: 'c', color: '#ffd65a' }); P.list.slice(0, 11).forEach((id, i) => { const on = i === P.i; rect(u, on ? '#3a3a7a' : '#141a36', 190, 124 + i * 16, 260, 15); drawText(u, MOVES[id].name, 196, 126 + i * 16, { size: 11, color: on ? '#ffffff' : UI.dim }); }); const m = MOVES[P.list[P.i]]; if (m) drawText(u, m.desc, 320, 300, { size: 11, align: 'c', color: '#c9d4ff' }); }
    } else {
      const R = this.rows();
      if (!R.length) drawText(u, '사용할 수 있는 물건이 없다. 돛대 상회에서 살 수 있다.', 320, 180, { size: 11, align: 'c', color: UI.dim });
      R.forEach((k, i) => { const it = SHOP_ITEMS.find(x => x.id === k), y = 150 + i * 26, on = i === this.sel; rect(u, on ? '#26315f' : '#141a36', 44, y, 550, 22); drawText(u, `${it.name} × ${d.items[k]}`, 52, y + 4, { size: 11, color: on ? '#ffffff' : '#c9d4ff' }); drawText(u, it.desc, 586, y + 4, { size: 11, align: 'r', color: UI.dim }); });
      const g = Object.values(d.gear).map(id => SHOP_ITEMS.find(i => i.id === id).name);
      drawText(u, '장착 중인 장비: ' + (g.length ? g.join(', ') : '없음'), 44, 300, { size: 11, color: UI.dim });
      const bf = Object.keys(d.buffs || {}).map(k => BUFF_NAMES[k] || k);
      if (bf.length) drawText(u, '다음 경기에 적용: ' + bf.join(', '), 44, 286, { size: 11, color: '#ffd65a' });
    }
    drawText(u, '←→ 탭 · Enter 선택 · Tab/Esc 닫기', 320, 322, { size: 11, align: 'c', color: UI.faint });
  }
}

// ---- map ----
export class MapMenu extends Menu {
  update(dt) { super.update(dt); const inp = this.game.input; if (inp.pressed('map') || this.back() || this.ok()) { if (inp.pressed('map') || this.ok()) this.W.closeTop(); } }
  draw(u) {
    const W = this.W, here = W.loc;
    this.frame(u, '지도', 40, 30, 560, 300, '#49d6ff');
    // facility box
    rect(u, '#1b2450', 70, 70, 260, 120); drawText(u, '야항 체육관', 200, 74, { size: 11, align: 'c', color: '#ff8fc4' });
    const node = (id, x, y, name, lock) => { const on = id === here; rect(u, '#05060f', x - 31, y - 9, 62, 20); rect(u, on ? '#ffd65a' : lock ? '#2a2a3a' : '#26315f', x - 30, y - 8, 60, 18); drawText(u, name, x, y - 5, { size: 11, align: 'c', color: on ? '#141a36' : lock ? UI.faint : '#ffffff' }); };
    node('office', 110, 110, '사장실'); node('gym', 200, 110, '훈련장'); node('arena', 290, 110, '대기실'); node('lobby', 200, 156, '로비');
    rect(u, '#3a4688', 196, 166, 8, 44);
    // street
    rect(u, '#2a2a3a', 60, 214, 520, 18); drawText(u, '부둣길', 320, 217, { size: 11, align: 'c', color: UI.dim });
    node('street', 200, 222, '정문');
    node('clinic', 150, 258, '항구의원'); node('shop', 230, 258, '돛대 상회');
    rect(u, '#5a2a3a', 300, 250, 50, 16); drawText(u, '포차', 325, 252, { size: 11, align: 'c', color: '#ffd0d8' });
    rect(u, '#2a3a5a', 360, 250, 50, 16); drawText(u, '광장', 385, 252, { size: 11, align: 'c', color: '#c9d4ff' });
    node('rivalgym', 448, 258, '철썩 짐', !W.unlocked('rivalgym'));
    rect(u, '#3a3020', 486, 250, 40, 16); drawText(u, '하역장', 506, 252, { size: 11, align: 'c', color: '#ffd65a' });
    node('dome', 556, 258, '등대 돔', !W.unlocked('dome'));
    drawText(u, '지금 위치: ' + W.L.name, 320, 290, { size: 11, align: 'c', color: '#ffd65a' });
    this.foot(u, '잠긴 곳: 철썩 짐(명성 40) · 등대 돔(타이틀전 계약) · M/Esc 닫기', 306);
  }
}

// ---- ranking ----
export class RankMenu extends Menu {
  update(dt) { super.update(dt); if (this.back() || this.ok()) { if (this.ok()) this.W.closeTop(); } }
  draw(u) {
    const c = this.c, L = c.rankList();
    this.frame(u, '선수 랭킹', 120, 20, 400, 320, '#ffd65a');
    drawText(u, `챔피언: ${c.d.flags.champion ? c.d.name : '안개왕'}`, 320, 40, { color: '#ffd65a', align: 'c' });
    L.forEach((e, i) => { const y = 60 + i * 17, me = e.id === 'player', name = me ? c.d.name : CHARACTERS[e.id].name; if (me) rect(u, '#3a3a1a', 134, y - 2, 372, 16); drawText(u, `${i + 1}`, 150, y, { size: 11, align: 'r', color: me ? '#ffd65a' : UI.dim }); drawText(u, name, 162, y, { size: 11, color: me ? '#ffd65a' : '#ffffff' }); drawText(u, me ? CHARACTERS.rookie.nick : CHARACTERS[e.id].nick, 270, y, { size: 11, color: UI.dim }); drawText(u, `${e.w}승 ${e.l}패`, 496, y, { size: 11, align: 'r', color: UI.dim }); });
    this.foot(u, 'Enter/Esc 닫기', 324);
  }
}

// ---- pause ----
export class PauseMenu extends Menu {
  items() { return [{ label: '계속하기', act: () => this.W.closeTop() }, { label: '저장하기', act: () => { this.c.save(); this.W.toast('저장했다', '#9be36b'); this.W.closeTop(); } }, { label: '조작법', act: () => this.game.showControls() }, { label: '설정', act: () => this.game.openSettings() }, { label: '저장하고 타이틀로', act: () => { this.c.save(); this.game.toTitle(); } }]; }
  update(dt) { super.update(dt); const it = this.items(); this.nav(it.length); if (this.back()) return; if (this.ok()) { this.game.audio.sfx('ok'); it[this.sel].act(); } }
  draw(u) { this.frame(u, '메뉴', 220, 90, 200, 160, '#49d6ff'); menuList(u, this.items(), this.sel, 238, 118, { w: 164, lh: 20 }); this.foot(u, 'Enter 결정 · Esc 닫기', 232); }
}

// ---- after a match ----
export class ResultMenu extends Menu {
  constructor(W, sum, res, kind, offer) { super(W); this.sum = sum; this.res = res; this.kind = kind; this.offer = offer; this.shownInj = this.c.d.injury - sum.injury; }
  update(dt) {
    super.update(dt);
    this.shownInj = Math.min(this.c.d.injury, this.shownInj + dt * 12);
    if (this.t > .6 && (this.ok() || this.game.input.menuPressed('cancel'))) {
      this.W.closeTop();
      if (this.W.checkGameOver()) return;
      const d = this.c.d;
      if (this.sum.ups.length) this.W.toast(`레벨 업! Lv ${d.level} — 능력치 포인트 +${this.sum.ups.length * 2} (Tab)`, '#6be38a');
      if (this.W.lesson && this.c.injuryLevel !== 'danger') { const L = this.W.lesson; this.W.lesson = null; this.W.say(L); }
      if (this.c.injuryLevel === 'danger') this.W.say([{ who: 'me', text: `몸이 비명을 지른다… 부상 ${Math.round(d.injury)}%. 이대로는 위험하다. 항구의원에 가야 해.`, expr: 'hurt' }]);
      else if (this.c.injuryLevel === 'warn' && this.sum.injury > 0) this.W.toast(`부상 주의: ${Math.round(d.injury)}%`, '#ffb347');
    }
  }
  draw(u) {
    const s = this.sum, r = this.res, c = this.c, d = c.d, won = r.won;
    this.frame(u, this.kind === 'practice' || this.kind === 'spar' ? '연습 종료' : won ? '승리!' : r.draw ? '무승부' : '패배', 100, 30, 440, 296, won ? '#ffd65a' : r.draw ? '#c9d4ff' : '#ff5b5b');
    const rows = [];
    if (s.money) rows.push(['상금', fmtMoney(s.money), UI.money]);
    if (s.fame) rows.push(['명성', (s.fame > 0 ? '+' : '') + s.fame, UI.fame]);
    if (s.xp) rows.push(['경험치', '+' + s.xp, '#49d6ff']);
    if (s.rankBefore !== s.rankAfter) rows.push(['랭킹', `${s.rankBefore}위 → ${s.rankAfter}위`, s.rankAfter < s.rankBefore ? '#6be38a' : '#ff8a8a']);
    if (s.ups.length) rows.push(['레벨 업', `Lv ${d.level} (포인트 +${s.ups.length * 2})`, '#6be38a']);
    rows.forEach(([k, v, col], i) => { drawText(u, k, 130, 64 + i * 18, { color: UI.dim }); drawText(u, v, 510, 64 + i * 18, { align: 'r', color: col }); });
    s.lines.forEach((l, i) => drawText(u, l, 320, 64 + rows.length * 18 + 6 + i * 16, { size: 11, align: 'c', color: '#ffd65a' }));
    // injury: shown only here, after leaving the ring
    if (this.kind !== 'practice' && this.kind !== 'spar') {
      const y = 210, inj = this.shownInj, lvl = inj >= B.injuryDanger ? 'danger' : inj >= B.injuryWarn ? 'warn' : 'ok', col = lvl === 'danger' ? '#ff5b5b' : lvl === 'warn' ? '#ffb347' : UI.inj;
      icon(u, 'bandage', 130, y + 2, col, { scale: 2 });
      drawText(u, `부상 +${s.injury}`, 152, y, { color: col });
      gauge(u, 152, y + 18, 300, 9, inj / 100, 'inj', { col, colD: '#3a1450', trail: d.injury / 100 });
      drawText(u, Math.round(inj) + '%', 460, y + 15, { color: col, bold: true });
      drawText(u, d.injury >= 100 ? '…몸이 더는 버티지 못한다.' : lvl === 'danger' ? '위험! 치료하지 않고 다음 경기에서 100%가 되면 은퇴(게임 오버)' : lvl === 'warn' ? '주의: 항구의원이나 붕대로 치료하자' : '받은 피해만큼 부상이 쌓였다', 320, y + 34, { size: 11, align: 'c', color: col });
    }
    prompt(u, [this.game.input.label('confirm')], '계속', 320, 300, { align: 'c' });
  }
}

// ---- season end ----
export class SeasonEndMenu extends Menu {
  update(dt) {
    super.update(dt);
    if (this.t > .8 && this.ok()) {
      const c = this.c, d = c.d;
      d.season++; d.day = 1; d.slot = 0; d.league = c.newLeague(d.season); d.flags.rankPts = Math.round((d.flags.rankPts || 0) * .6); d.seasonLog = { w: 0, l: 0, earned: 0, matches: [] }; d.events = {};
      c.save(true);
      this.W.closeTop();
      this.W.say([{ who: 'boss', text: `시즌 ${d.season}이 시작됐네! 새 얼굴들도 들어왔어. 철썩 짐 녀석들까지 리그에 합류했지.` }, { who: 'boss', text: '상대들도 한 해 동안 단단해졌을 거야. 방심하지 말게.' }]);
    }
  }
  draw(u) {
    const c = this.c, d = c.d, L = d.seasonLog;
    this.frame(u, `시즌 ${d.season} 결산`, 90, 30, 460, 296, '#ffd65a');
    const rows = [['전적', `${L.w}승 ${L.l}패`], ['최종 랭킹', d.flags.champion ? '챔피언' : c.rank + '위'], ['획득한 타이틀', d.titles.filter(t => t.season === d.season).map(t => t.name).join(', ') || '없음'], ['총수입', fmtMoney(L.earned)], ['레벨', `Lv ${d.level}`], ['명성', String(d.fame)], ['부상', Math.round(d.injury) + '%']];
    rows.forEach(([k, v], i) => { drawText(u, k, 120, 62 + i * 20, { color: UI.dim }); drawText(u, v, 520, 62 + i * 20, { align: 'r', color: '#ffffff' }); });
    const riv = Object.entries(d.h2h).sort((a, b) => (b[1].w + b[1].l) - (a[1].w + a[1].l)).slice(0, 3);
    drawText(u, '주요 라이벌: ' + (riv.length ? riv.map(([id, r]) => `${CHARACTERS[id].name} ${r.w}-${r.l}`).join(' · ') : '없음'), 320, 210, { size: 11, align: 'c', color: '#c9d4ff' });
    const best = L.matches.filter(m => m.won).slice(-1)[0];
    if (best) drawText(u, `기억에 남는 경기: ${best.day}일 vs ${best.opp}`, 320, 228, { size: 11, align: 'c', color: '#ffd65a' });
    prompt(u, ['Enter'], '다음 시즌으로', 320, 296, { align: 'c' });
  }
}

// ---- career over ----
export class GameOverScene {
  constructor(game, career) { this.game = game; this.c = career; this.t = 0; this.sel = 0; game.audio.music(null); game.audio.jingle('gameover'); career.d.retired = true; }
  items() { return [{ label: '마지막 아침부터 다시 하기', act: () => { const k = this.c.constructor.loadCheckpoint(this.c.d.saveSlot || 1); if (k && k.d.injury < 100) { k.d.retired = false; k.save(); this.game.career = k; this.game.startCareer('continue', k); } else this.game.toTitle(); } }, { label: '타이틀로', act: () => this.game.toTitle() }]; }
  update(dt) { this.t += dt; const inp = this.game.input, it = this.items(); if (inp.pressed('up') || inp.pressed('down')) { this.sel ^= 1; this.game.audio.sfx('ui'); } if (this.t > 1.5 && inp.menuPressed('confirm')) { this.game.audio.sfx('ok'); it[this.sel].act(); } }
  draw(w, u) {
    const d = this.c.d;
    bands(w, 0, 0, 640, 360, ['#05060f', '#0a0b18', '#0e1022', '#120f26']);
    u.clearRect(0, 0, 640, 360);
    const a = clamp(this.t / 1.5, 0, 1);
    u.globalAlpha = a;
    drawText(u, '선수 생명 종료', 320, 60, { scale: 3, align: 'c', color: '#ff5b5b', bold: true, outline: '#05060f' });
    drawText(u, '부상 게이지가 100%에 도달했다. 더는 링에 설 수 없다.', 320, 116, { align: 'c', color: '#eef2ff' });
    drawPortrait(u, this.c.look(), 'sad', 280, 140, 80, { px: 3, dy: 10 });
    drawText(u, `${d.name} · 시즌 ${d.season} ${d.day}일 · ${d.record.w}승 ${d.record.l}패 · 최고 랭킹 ${this.c.rank}위`, 320, 230, { size: 11, align: 'c', color: UI.dim });
    menuList(u, this.items(), this.sel, 230, 262, { w: 180 });
    u.globalAlpha = 1;
  }
}
export const menuSlots = SLOT_NAMES;
export const menuDays = SEASON_DAYS;
export const menuTime = fmtTime;
export const menuTW = textWidth;
export const menuMix = mixHex;
