// Match HUD: portraits, HP / STUN / finisher gauges, timer, rule, downs, grab marks, grapple menu, prompts, banners.
import { clamp, clamp01, fmtTime, sgn } from '../core/util.js';
import { UI, mixHex, shade } from './palette.js';
import { drawText, textWidth } from './pixelfont.js';
import { drawPortrait } from './head.js';
import { rect, ellipse } from './painter.js';
import { panel, gauge, icon, keycap, prompt, banner } from './ui.js';
import { BALANCE as B } from '../data/balance.js';
import { MOVES } from '../data/moves.js';
import { MODES } from '../combat/MatchManager.js';
import { chainAllow } from '../combat/WrestlingMoveSystem.js';
import { topPick } from '../combat/CharacterController.js';
import { ATTACKS } from '../data/balance.js';
import { J } from '../anim/skeleton.js';
import { SPECIALS, COUNTERS } from '../data/combos.js';
import { SPECIAL } from '../combat/SpecialRules.js';

const SLOT_NAMES = { n: '', f: '→', b: '←', u: '↑', d: '↓' };
export class HUD {
  constructor(input) { this.input = input; this.trail = new Map(); this.banners = []; this.t = 0; this.toastList = []; this.card = null; }
  push(text, o = {}) { this.banners.push(Object.assign({ text, t: 0, life: o.life || 1.2, col: o.col || '#ffd65a', scale: o.scale || 3, y: o.y || 120 }, o)); if (this.banners.length > 3) this.banners.shift(); }
  toast(text, col = '#eef2ff') { this.toastList.push({ text, col, t: 0 }); if (this.toastList.length > 4) this.toastList.shift(); }
  finisherCard(f, F) { this.card = { f, F, t: 0 }; }
  update(dt, m) {
    this.t += dt;
    for (const b of this.banners) b.t += dt;
    this.banners = this.banners.filter(b => b.t < b.life);
    for (const t of this.toastList) t.t += dt;
    this.toastList = this.toastList.filter(t => t.t < 2.6);
    if (this.card) { this.card.t += dt; if (this.card.t > 1.6) this.card = null; }
    for (const f of m.fighters) { const tr = this.trail.get(f) || { hp: f.hp, wait: 0 }; if (f.hp < tr.hp) { tr.wait -= dt; if (tr.wait <= 0) tr.hp = Math.max(f.hp, tr.hp - f.maxHp * dt * .6); } else { tr.hp = f.hp; tr.wait = .45; } if (f.hp < tr.last) tr.wait = .45; tr.last = f.hp; this.trail.set(f, tr); }
  }
  draw(g, m, camX, o = {}) {
    if (o.hide) return;
    const two = m.fighters.length === 2 || (m.mode === 'tag' && m.fighters.length === 4);
    if (m.mode === 'tag') this.tagPanels(g, m);
    else if (two) { this.bigPanel(g, m.fighters[0], 6, false, m); this.bigPanel(g, m.fighters[1], 634, true, m); }
    else this.smallPanels(g, m);
    this.center(g, m);
    this.worldMarks(g, m, camX);
    this.human(g, m, camX);
    this.drawBanners(g);
    this.drawCard(g);
    this.toasts(g);
  }
  portrait(g, f, x, y, s, flip) {
    rect(g, '#05060f', x - 1, y - 1, s + 2, s + 2);
    rect(g, mixHex(f.char.color || '#49d6ff', '#0b0f22', .7), x, y, s, s);
    rect(g, mixHex(f.char.color || '#49d6ff', '#0b0f22', .5), x, y + s - 8, s, 8);
    drawPortrait(g, f.look, f.st === 'KO' ? 'ko' : f.hp < f.maxHp * .25 ? 'hurt' : f.st === 'WIN' ? 'happy' : 'neutral', x, y, s, { px: 1, flip, dy: 3 });
    rect(g, f.char.color || '#49d6ff', x, y, s, 1); rect(g, f.char.color || '#49d6ff', x, y + s - 1, s, 1);
  }
  bigPanel(g, f, X, right, m) {
    const w = 236, x = right ? X - w : X, y = 5;
    panel(g, x, y, w, 46, { accent: f.char.color, bg: '#0f1430', alpha: .94 });
    const px = right ? x + w - 37 : x + 5;
    this.portrait(g, f, px, y + 5, 32, right);
    const bx = right ? x + 8 : x + 44, bw = 182;
    const nm = f.name + (f.ctrl === 'human' ? '' : '');
    drawText(g, nm, right ? bx + bw : bx, y + 3, { size: 11, align: right ? 'r' : 'l', color: '#ffffff', outline: '#05060f' });
    // downs as pips
    for (let i = 0; i < Math.min(5, f.downs); i++) { const dx = right ? bx + 4 + i * 8 : bx + bw - 4 - i * 8; icon(g, 'star', dx - 3, y + 5, '#ffb347'); }
    const tr = this.trail.get(f);
    gauge(g, bx, y + 17, bw, 8, f.hp / f.maxHp, 'hp', { trail: tr ? tr.hp / f.maxHp : null, flip: right, icon: 'heart', blink: true, time: this.t });
    gauge(g, bx, y + 29, bw * .78 | 0, 4, Math.max(0, f.stun) / f.maxStun, 'stun', { flip: right, icon: 'stun', blink: true, blinkBelow: .3, time: this.t });
    const fw = 78, fx = right ? x + w - fw - 3 : x + 3;
    gauge(g, right ? fx : fx + 10, y + 50, fw, 5, f.fin / B.finMax, 'fin', { flip: right, icon: 'bolt', full: true, time: this.t });
    if (f.fin >= B.finMax) drawText(g, '피니셔!', right ? fx - 6 : fx + fw + 16, y + 47, { size: 11, align: right ? 'r' : 'l', color: Math.floor(this.t * 6) % 2 ? '#3fe0d0' : '#ffffff', outline: '#05060f' });
    const st = this.chip(f, m);
    if (st) drawText(g, st[0], right ? x + 4 : x + w - 4, y + 35, { size: 11, align: right ? 'l' : 'r', color: st[1], outline: '#05060f' });
    if (f.bossPhase > 1) drawText(g, `${f.bossPhase}페이즈`, right ? x + 4 : x + w - 4, y + 3, { size: 11, align: right ? 'l' : 'r', color: Math.floor(this.t * 3) % 2 ? '#ff5b5b' : '#ffd65a', outline: '#05060f' });
  }
  chip(f, m) {
    if (f.st === 'KO') return ['K.O.', '#ff5b5b'];
    if (f.eliminated) return ['탈락', '#ff5b5b'];
    if (f.st === 'DOWN') return ['다운', '#ffb347'];
    if (f.st === 'STAGGER') return ['비틀', '#ffd65a'];
    if (f.st === 'GRABBED') return ['잡힘', '#ff8fc4'];
    if (f.side === 'out' && m.rules.ringOut === 'count' && f.outCount > .5) return ['링 밖 ' + Math.floor(f.outCount), '#ff8a2b'];
    if (f.st === 'TAGWAIT') return ['대기', UI.dim];
    return null;
  }
  smallPanels(g, m) {
    const list = m.fighters.filter(f => !f.gone);
    // two groups so the clock in the middle stays clear
    const n = list.length, left = Math.ceil(n / 2), right = n - left, per = Math.max(left, right);
    const w = Math.min(126, Math.floor((280 - 4 * (per - 1)) / per));
    list.forEach((f, i) => {
      const side = i < left ? 0 : 1, k = side ? i - left : i, cnt = side ? right : left;
      const x = side ? 634 - (cnt - k) * (w + 4) + 4 : 6 + k * (w + 4), y = 4, dead = f.eliminated || f.st === 'KO';
      panel(g, x, y, w, 30, { accent: f.char.color, alpha: dead ? .5 : .92, cut: 3 });
      this.portrait(g, f, x + 3, y + 3, 24, false);
      drawText(g, f.name, x + 30, y + 2, { size: 11, color: dead ? UI.faint : f.ctrl === 'human' ? '#ffd65a' : '#ffffff' });
      gauge(g, x + 30, y + 15, w - 34, 5, f.hp / f.maxHp, 'hp', {});
      gauge(g, x + 30, y + 23, (w - 34) * .8 | 0, 3, Math.max(0, f.stun) / f.maxStun, 'stun', {});
      if (dead) { drawText(g, f.st === 'KO' ? 'KO' : '탈락', x + w / 2 + 12, y + 9, { color: '#ff5b5b', bold: true, outline: '#05060f' }); }
      if (f.fin >= B.finMax && !dead) rect(g, Math.floor(this.t * 6) % 2 ? '#3fe0d0' : '#ffffff', x + w - 6, y + 3, 3, 3);
    });
  }
  tagPanels(g, m) {
    const F = m.fighters;
    for (const team of [0, 1]) {
      const legal = F.find(f => f.team === team && f.legal) || F.find(f => f.team === team), mate = legal.partner;
      this.bigPanel(g, legal, team ? 634 : 6, !!team, m);
      if (mate) {
        const x = team ? 634 - 120 : 6, y = 64;
        panel(g, x, y, 120, 20, { accent: mate.char.color, alpha: .85, cut: 2, accentBar: false });
        drawText(g, mate.name, x + 4, y + 3, { size: 11, color: UI.dim });
        gauge(g, x + 52, y + 7, 62, 5, mate.hp / mate.maxHp, 'hp', {});
        if (mate.wantTag && Math.floor(this.t * 4) % 2) drawText(g, '교대!', team ? x - 4 : x + 124, y + 3, { size: 11, align: team ? 'r' : 'l', color: '#6be38a', outline: '#05060f' });
      }
    }
  }
  center(g, m) {
    const x = 320, y = 4;
    const lim = m.rules.time, left = lim ? Math.max(0, lim - m.clock) : m.clock;
    panel(g, x - 30, y, 60, 22, { cut: 3, accentBar: false, bg: '#0b0f22' });
    drawText(g, lim || m.mode === 'rumble' || m.mode === 'royal' ? fmtTime(left) : '∞', x, y + 4, { align: 'c', color: lim && left < 30 && Math.floor(this.t * 2) % 2 ? '#ff5b5b' : '#ffffff' });
    let rule = (MODES[m.mode] || {}).name || '';
    if (m.mode === 'rumble') rule += ` · 남은 입장 ${m.queue.length}`;
    if (m.mode === 'royal' || m.mode === 'rumble') rule += ` · 링 위 ${m.alive().length}`;
    const SP = m.special;
    if (SP && SP.type) rule = SPECIAL[SP.type].name;
    if (m.cfg.title) rule = m.cfg.title + (SP && SP.type ? ' · ' + SPECIAL[SP.type].short : '');
    drawText(g, rule, x, y + 28, { size: 11, align: 'c', color: '#c9d4ff', outline: '#05060f' });
    if (SP && SP.multi) { const s0 = SP.score[0] || 0, s1 = SP.score[1] || 0; drawText(g, (SP.sudden ? '서든 데스 · ' : SP.iron ? '아이언맨 · 폴 ' : SP.falls === 2 ? '3판 2선승 · ' : `${SP.falls}폴 선승 · `) + `${s0} : ${s1}`, x, y + 41, { size: 11, align: 'c', color: SP.sudden ? '#ff5b5b' : '#ffd65a', outline: '#05060f' }); }
    if (m.mode === 'rumble' && m.queue.length && m.phase === 'fight') { const s = Math.ceil(m.nextEntry); drawText(g, `다음 입장 ${s}초`, x, y + 41, { size: 11, align: 'c', color: s <= 5 ? '#ffd65a' : UI.dim, outline: '#05060f' }); }
  }
  worldMarks(g, m, camX) {
    const h = m.human;
    for (const f of m.fighters) {
      if (f.gone || !f.alive || f.hidden) continue;
      const hx = Math.round(f.joints.x(J.head) - camX), hy = Math.round(Math.min(f.joints.y(J.head), f.joints.y(J.pelvis) - 20) - 22);
      // grab mark over helpless foes
      if (h && h.isFoe(f) && f.grabbable && f.side === h.side) {
        const near = Math.abs(f.x - h.x) < B.grabRange + 6, bob = Math.round(Math.sin(this.t * 8) * 2);
        const y = f.st === 'DOWN' ? f.y - 34 : hy;
        g.globalAlpha = near ? 1 : .55;
        rect(g, '#05060f', hx - 9, y - 1 + bob, 18, 14); rect(g, near ? '#ffd65a' : '#9aa6d6', hx - 8, y + bob, 16, 12);
        drawText(g, this.input.label('grab'), hx, y + 1 + bob, { size: 11, align: 'c', color: '#141a36' });
        rect(g, near ? '#ffd65a' : '#9aa6d6', hx - 1, y + 12 + bob, 3, 3);
        g.globalAlpha = 1;
      }
      // player marker
      if (f.ctrl === 'human' && m.fighters.length > 1) { const y = hy - 8 + Math.round(Math.sin(this.t * 5)); rect(g, '#05060f', hx - 4, y - 1, 9, 6); rect(g, '#ffd65a', hx - 3, y, 7, 2); rect(g, '#ffd65a', hx - 2, y + 2, 5, 1); rect(g, '#ffd65a', hx - 1, y + 3, 3, 1); }
      if (f.st === 'HANG' && f.ctrl !== 'human') drawText(g, '매달림!', hx, hy - 4, { size: 11, align: 'c', color: '#ff8a2b', outline: '#05060f' });
      if (m.props.threat(f) && Math.floor(this.t * 8) % 2) drawText(g, '!', hx, hy - 30, { scale: 2, align: 'c', color: '#ff5b5b', bold: true, outline: '#05060f' });
      if (f.side === 'out' && m.rules.ringOut === 'count' && f.outCount >= 1 && m.phase === 'fight') drawText(g, String(Math.floor(f.outCount)), hx, hy - 16, { scale: 2, align: 'c', color: f.outCount > 7 ? '#ff5b5b' : '#ffd65a', bold: true, outline: '#05060f' });
    }
    // pin count
    if (m.pin) { const p = m.pin, x = Math.round(p.v.x - camX); drawText(g, p.count ? String(p.count) : '…', x, p.v.y - 92, { scale: 3, align: 'c', color: p.count >= 2 ? '#ff5b5b' : '#ffffff', bold: true, outline: '#05060f' }); }
  }
  human(g, m, camX) {
    const f = m.human;
    if (!f || m.phase !== 'fight') return;
    const L = f.link, inp = this.input;
    // grapple choice
    if (L && L.kind === 'hold' && L.a === f && L.pos === 'carry') { this.carryMenu(g, m, f, L, camX); return; }
    if (L && L.kind === 'hold' && L.a === f) { this.grappleMenu(g, m, f, L, camX); return; }
    if (L && L.v === f) {
      const x = Math.round(f.x - camX), y = f.y - 118;
      if (L.kind === 'hold') {
        const k = Math.floor(this.t * 10) % 3;
        void k; this.mashKey(g, f, x, y, '연타해서 벗어나기!');
        gauge(g, x - 30, y + 14, 60, 4, f.escape / B.grabEscape, 'stun', { col: '#6be38a', colD: '#1f6a3a' });
        if (f.burstCd <= 0 && f.fin >= B.burstCost) prompt(g, [inp.label('down') + '+' + inp.label('dodge')], '긴급 탈출', x, y + 22, { align: 'c' });
      } else if (L.kind === 'move' && L.subOn) {
        const k = Math.floor(this.t * 10) % 3, yy = Math.round(f.y - 70);
        void k; this.mashKey(g, f, x, yy, '연타해서 버티기!');
        gauge(g, x - 30, yy + 14, 60, 4, (L.esc || 0) / 100, 'stun', { col: '#6be38a', colD: '#1f6a3a' });
      } else if (L.kind === 'move' && L.rev && L.rev.open && !L.rev.tried) {
        const mv = L.move, roll = !!mv.roll, cost = mv.revMove ? mv.revCost || 0 : 0, can = !cost || f.fin >= cost;
        const yy = roll ? Math.round(f.y - 60) : y;
        rect(g, '#05060f', x - 13, yy - 3, 26, 22); rect(g, can ? '#ff5fa2' : '#5f6ca6', x - 12, yy - 2, 24, 20); drawText(g, inp.label('dodge') + '!', x, yy + 1, { scale: 1, align: 'c', color: '#ffffff', bold: true });
        if (roll) drawText(g, '굴러서 피하기', x, yy + 22, { size: 11, align: 'c', color: '#ffd65a', outline: '#05060f' });
        else if (cost) drawText(g, can ? `반격 (에너지 ${cost})` : `반격: 에너지 ${cost} 필요`, x, yy + 22, { size: 11, align: 'c', color: can ? '#ffd65a' : '#ff8a8a', outline: '#05060f' });
      }
      return;
    }
    if (m.pin && m.pin.v === f) { const x = Math.round(f.x - camX); this.mashKey(g, f, x, f.y - 84, '연타! 어깨를 들어라!'); gauge(g, x - 34, f.y - 56, 68, 5, m.pin.kick / m.pin.need, 'stun', { col: '#6be38a' }); return; }
    if (m.pin && m.pin.a === f) { prompt(g, [inp.label('dodge')], '핀 풀기', 320, 336, { align: 'c', bg: 1 }); return; }
    // contextual prompts
    const P = [];
    const ar = m.arena;
    if (L && L.kind === 'move' && L.a === f && L.up) for (const o of L.up) if (L.t <= o.until) P.push([[inp.label(o.key === 'down' ? 'down' : o.key)], o.cost ? `${o.name.replace('!', '')} (에너지 ${o.cost})` : o.name]);
    if (f.follow && !f.follow.want) {
      const F = f.follow;
      for (const o of F.opts) P.push([[inp.label(o.key === 'down' ? 'down' : o.key)], '연계: ' + (o.spring ? '스프링보드 문설트' : o.pin ? (o.name || '바로 핀 (보너스)') : (o.name || (MOVES[o.id] && MOVES[o.id].name) || ''))]);
      const fx = Math.round(f.x - camX), fy = Math.round(f.y - 104);
      gauge(g, fx - 20, fy, 40, 3, 1 - F.t / F.life, 'fin', { col: '#ffd65a', colD: '#3a2a10' });
      drawText(g, '연계!', fx, fy - 13, { size: 11, align: 'c', color: '#ffd65a', outline: '#05060f' });
    }
    const sv = !f.link && f.side === 'in' ? m.combo.seatedFoe(f) : null;
    if (sv) P.push([[inp.label('grab')], '턴버클 백드롭'], [[inp.label('fin')], f.fin >= SPECIALS.superGerman ? `슈퍼 저먼 (에너지 ${SPECIALS.superGerman})` : `슈퍼 저먼: 에너지 ${SPECIALS.superGerman} 필요`], [[inp.label('atk')], '밀어 떨어뜨리기']);
    if (f.st === 'SEATED') P.push([[inp.label('atk')], '연타해서 내려오기']);
    const SP = m.special;
    if (SP && SP.ladder) {
      const L = SP.ladder, c = f.climb, P0 = SP.prize;
      if (f.st === 'LADDER' && c) {
        if (c.p >= 1) P.push([[inp.label('grab')], `타이밍! 가방 ${P0.hits}/${P0.need}`], [[inp.label('left') + '/' + inp.label('right')], '내려갈 쪽'], [[inp.label('atk')], '공격·다이빙']);
        else P.push([[inp.label('up')], '오르기'], [[inp.label('atk')], '주먹·발차기'], [[inp.label('grab')], '위 상대 다리 잡기']);
        if (c.meter) this.caseMeter(g, f, c.meter, P0, camX);
      } else if (f.st === 'CASE_HANG' && f.hang) { P.push([[inp.label('grab')], `매달린 채 타이밍! ${P0.hits}/${P0.need}`]); if (f.hang.meter) this.caseMeter(g, f, f.hang.meter, P0, camX); }
      else if (f.side === 'in' && !f.link && Math.abs(f.x - L.x) < 74) {
        const foeOn = m.fighters.find(o => f.isFoe(o) && o.st === 'LADDER');
        if (L.state === 'folded') P.push([[inp.label('grab')], '사다리 펼치기']);
        else if (L.state === 'open') {
          if (foeOn && foeOn.climb && foeOn.climb.p <= B.climbPullMax && Math.abs(foeOn.x - f.x) < 46) P.push([[inp.label('grab')], '끌어내리기!']);
          else if (L.foldCd <= 0) P.push([[inp.label('grab')], foeOn ? '사다리 접기!' : '사다리 접기']);
          P.push([[inp.label('up')], '사다리 오르기']);
        }
      }
    }
    if (m.rules.cage && f.st === 'CAGE_CLIMB' && f.climb) P.push(f.climb.over != null ? [[inp.label('up')], '넘어가는 중!'] : [[inp.label('up')], '계속 눌러 오르기'], [[inp.label('atk')], '주먹·발차기·다이빙'], [[inp.label('grab')], '위 상대 다리 잡기']);
    if (m.rules.cage && f.side === 'in' && !f.climb && m.fighters.some(o => f.isFoe(o) && o.st === 'CAGE_CLIMB' && o.climb && o.climb.p <= B.climbPullMax && Math.abs(o.x - f.x) < 46)) P.push([[inp.label('grab')], '끌어내리기!']);
    if (f.st === 'APRON' && f.nearestFoe(300, o => o.side === 'in' && (o.st === 'DOWN' || o.st === 'GET_UP'))) P.push([[inp.label('atk')], '스프링보드 문설트']);
    const g2 = m.grapple.grabTarget(f), PR = m.props;
    const swinger = !f.prop && f.nearestFoe(64, o => o.prop && o.side === f.side && o.st === 'ATTACK' && o.atk && o.atk.def.chair && o.atk.t < o.atk.def.startup + o.atk.def.active);
    if (swinger) P.push([[inp.label('grab')], '받아쳐서 뺏기!'], [[inp.label('dodge')], '타이밍 반격']);
    else if (PR.threat(f)) P.push([[inp.label('dodge')], '피하기'], [[inp.label('down')], '막기'], [[inp.label('grab')], '받기!']);
    else if (f.prop) P.push([[inp.label('atk')], `체어샷 (남은 ${Math.max(0, f.prop.uses)}회)`], [[inp.label('grab')], g2 ? '의자 놓고 잡기' : '의자 던지기']);
    if (g2 && !f.prop) P.push([[inp.label('grab')], '잡기']);
    else if (!f.prop && PR.loose(f)) P.push([[inp.label('grab')], '의자 줍기']);
    else if (!f.prop && f.nearestFoe(52, o => o.prop && o.side === f.side)) P.push([[inp.label('grab')], '의자 뺏기']);
    if (m.rules.pin && f.side === 'in' && f.nearestFoe(58, o => o.st === 'DOWN' && !o.rag)) P.push([[inp.label('down')], '핀폴']);
    if (f.fin >= B.finMax && f.alive) P.push([[inp.label('fin')], '피니셔']);
    if (f.dash && f.fsm.is('IDLE', 'MOVE') && !f.prop) { const c = m.grapple.dashCheck(f), mv = MOVES[c.id]; P.push([[inp.label('atk')], '돌진 공격'], [[inp.label('grab')], c.ok ? `${mv.name} (게이지 ${B.dashSigCost})` : `${mv.name}: ${c.why}`]); }
    if (f.st === 'PERCH') {
      const out = f.face === (f.climbDir || (f.x < ar.mid ? -1 : 1)), elim = m.rules.ringOut === 'elim';
      let jl = '다이빙';
      if (out) jl = elim ? '장외 다이빙 금지(탈락)' : '장외 다이빙!';
      else { const pk = topPick(f), st = ATTACKS[f.char.topStand] || ATTACKS.missileDropkick, dv = ATTACKS[f.char.dive]; jl = pk.kind === 'stand' ? `${st.name} (서 있는 상대)` : pk.kind === 'down' ? `${dv.name} (누운 상대)` : pk.kind === 'rising' ? `${dv.name} (일어나는 상대: 타이밍!)` : '다이빙 (사거리 밖)'; }
      P.push([[inp.label('left') + '/' + inp.label('right')], out ? '안쪽 보기' : '바깥 보기'], [[inp.label('atk')], jl], [[inp.label('down')], '내려오기']);
    }
    if (f.st === 'HANG') P.push([[inp.label('up')], '연타로 올라가기']);
    if (f.st === 'APRON') P.push([[inp.label('up')], '링 안으로'], [[inp.label('down')], '내려가기']);
    if (ar.hasRing && f.side === 'out' && f.y > ar.matY + 4 && f.st !== 'HANG') { const d = Math.min(Math.abs(f.x - (ar.ropeL - ar.apron)), Math.abs(f.x - (ar.ropeR + ar.apron))); if (d < 46) P.push([[inp.label('up')], '링으로 올라가기']); }
    if (ar.hasRing && f.side === 'in' && f.fsm.is('IDLE', 'MOVE') && ar.nearRope(f.x).dist < 34) P.push([[inp.label('up')], m.rules.cage ? '철창 오르기' : '코너 오르기']);
    if (m.mode === 'tag' && f.legal && f.partner && f.partner.st === 'TAGWAIT' && Math.abs(f.x - (f.team === 0 ? ar.ropeL : ar.ropeR)) < B.tagRange) P.push([[inp.label('down')], '교대']);
    if ((f.st === 'HITSTUN' || f.st === 'DOWN' || f.st === 'STAGGER') && f.burstCd <= 0 && f.fin >= B.burstCost) P.push([[inp.label('down') + '+' + inp.label('dodge')], '긴급 탈출']);
    // laid out by their real widths, centred, so long labels never run into each other
    const PL = P.slice(0, 3), ww = PL.map(([k, t]) => k.reduce((s, kk) => s + Math.max(11, textWidth(kk, 11) + 6) + 2, 0) + textWidth(t, 11) + 14);
    let px = 320 - (ww.reduce((s, w) => s + w, 0) + (PL.length - 1) * 8) / 2;
    PL.forEach(([k, t], i) => { prompt(g, k, t, Math.round(px + ww[i] / 2), 338, { align: 'c', bg: 1 }); px += ww[i] + 8; });
    // status line (bottom left): states only
    const parts = [];
    if (f.downs) parts.push(`다운 ${f.downs}회`);
    if (f.dodgeCd > 0) parts.push('회피 대기');
    if (f.burstCd > 0) parts.push(`긴급탈출 ${Math.ceil(f.burstCd)}초`);
    else if (f.fin < B.burstCost) parts.push('긴급탈출: 게이지 부족');
    if (f.boost > 0) parts.push('로프 가속');
    if (f.exhausted) parts.push('지침');
    if (f.fin >= COUNTERS.heavy.cost && f.counterCd <= 0) parts.push('카운터 준비 (L)');
    drawText(g, parts.join(' · '), 8, PL.length ? 324 : 344, { size: 11, color: UI.dim, outline: '#05060f' });   // above the prompts when there are some
  }
  // the one key to mash (J, or where it has jumped to), big, shaking when it has just changed
  mashKey(g, f, x, y, text) {
    const M = f.mash, key = M ? M.key : 'atk', fl = M && M.flash > 0, lab = this.input.label(key), w = Math.max(18, textWidth(lab, 11) + 10);
    drawText(g, fl ? '키가 바뀌었다!' : text, x, y - 16, { size: 11, align: 'c', color: fl ? '#ff5b5b' : '#ffd65a', outline: '#05060f' });
    const jx = fl ? Math.round(Math.sin(this.t * 60) * 2) : 0, jy = Math.floor(this.t * 12) % 2;
    rect(g, '#05060f', x - w / 2 - 1 + jx, y - 2 - jy, w + 2, 17); rect(g, fl ? '#ff5b5b' : key === 'atk' ? '#ffd65a' : '#49d6ff', x - w / 2 + jx, y - 1 - jy, w, 15);
    drawText(g, lab, x + jx, y - jy, { size: 11, align: 'c', color: '#05060f', bold: true });
  }
  grappleMenu(g, m, f, L, camX) {
    const inp = this.input, v = L.v, x = Math.round((f.x + v.x) / 2 - camX), y = Math.round(f.y - 150);
    const slots = [['u', 0, -26], ['b', -f.face * 70, 0], ['n', 0, 0], ['f', f.face * 70, 0], ['d', 0, 26]];
    panel(g, x - 104, y - 40, 208, 92, { alpha: .82, cut: 3, accent: f.char.color });
    drawText(g, (L.pos === 'front' ? '정면 잡기' : '뒤 잡기') + (v.moveChain ? `  연속 ${v.moveChain + 1}/${chainAllow(v).n}` : ''), x - 98, y - 37, { size: 11, color: v.moveChain ? '#ff8fc4' : '#ffd65a' });
    gauge(g, x + 6, y - 35, 90, 3, L.hold / (B.grabHold * (.8 + .2 * f.stats.grp)), 'fin', { col: '#ffd65a', colD: '#7a5a1a' });
    gauge(g, x + 6, y - 29, 90, 3, v.escape / B.grabEscape, 'hp', { col: '#ff5b5b' });
    for (const [s, dx, dy] of slots) {
      const id = f.moves[L.pos] && f.moves[L.pos][s], mv = MOVES[id];
      if (!mv) continue;
      const c = m.grapple.check(f, v, mv), denied = L.deny && L.deny.slot === s && m.time - L.deny.t < .8;
      const key = (s === 'u' ? inp.label('up') + '+' : s === 'd' ? inp.label('down') + '+' : s === 'f' ? (f.face > 0 ? '→' : '←') + '+' : s === 'b' ? (f.face > 0 ? '←' : '→') + '+' : '') + inp.label('grab');
      const name = mv.name, tw = textWidth(name, 11);
      const cx = x + dx, cy = y + dy;
      const kw = Math.max(11, textWidth(key, 11) + 6);
      const ww = Math.max(tw, kw) + 6;
      rect(g, denied ? '#5a1a2a' : c.ok ? '#1b2450' : '#14172a', cx - ww / 2, cy - 1, ww, 24);
      keycap(g, key, cx - kw / 2, cy, { bg: c.ok ? '#ffd65a' : '#5f6ca6' });
      drawText(g, name, cx, cy + 12, { size: 11, align: 'c', color: c.ok ? '#ffffff' : UI.faint });
      if (!c.ok && denied) drawText(g, c.why, cx, cy + 24, { size: 11, align: 'c', color: '#ff8a8a', outline: '#05060f' });
    }
    // the other keys, along the bottom like every other prompt
    const P = [[[inp.label('atk')], `무릎치기 ${B.grabStrikeMax - L.strikes}`], [[inp.label('dodge')], '위치 바꾸기']];
    if (f.fin >= B.finMax) P.push([[inp.label('fin')], '피니셔']);
    else if (L.pos === 'front') { const id = m.combo.holdSpecialId(f), c = SPECIALS[id]; P.push([[inp.label('fin')], f.fin >= c ? `${MOVES[id].name} (에너지 ${c})` : `${MOVES[id].name}: 에너지 ${c} 필요`]); }
    this.bottomPrompts(g, P);
    void sgn; void clamp;
  }
  // the timing meter for the case: press K while the needle is in the green
  caseMeter(g, f, M, P0, camX) {
    const x = Math.round(f.x - camX) - 34, y = Math.round(Math.min(f.joints.y(J.head), f.y - 90)) - 30, w = 68;
    rect(g, '#05060f', x - 2, y - 2, w + 4, 11); rect(g, '#1b2450', x, y, w, 7);
    rect(g, M.fumble > 0 ? '#5a1a2a' : '#2f8f4e', x + Math.round(M.z[0] * w), y, Math.max(2, Math.round((M.z[1] - M.z[0]) * w)), 7);
    const nx = x + Math.round(M.n * w); rect(g, '#05060f', nx - 2, y - 3, 4, 13); rect(g, '#ffffff', nx - 1, y - 2, 2, 11);
    const n = P0.need, cw = Math.floor((w - 4) / n);
    for (let i = 0; i < n; i++) rect(g, i < P0.hits ? '#ffd65a' : '#3a4258', x + 2 + i * cw, y + 10, cw - 1, 3);
  }
  bottomPrompts(g, P) {
    const ww = P.map(([k, t]) => k.reduce((s, kk) => s + Math.max(11, textWidth(kk, 11) + 6) + 2, 0) + textWidth(t, 11) + 14);
    let px = 320 - (ww.reduce((s, w) => s + w, 0) + (P.length - 1) * 8) / 2;
    P.forEach(([k, t], i) => { prompt(g, k, t, Math.round(px + ww[i] / 2), 338, { align: 'c', bg: 1 }); px += ww[i] + 8; });
  }
  // somebody on the shoulders: walk to a corner, K drops them
  carryMenu(g, m, f, L, camX) {
    const inp = this.input, v = L.v, toC = m.combo.carryToCorner(f), corner = toC <= 74;
    const x = Math.round(f.x - camX), y = Math.round(Math.min(v.joints.y(J.head), f.joints.y(J.head)) - 24);   // over the head of the one on top
    gauge(g, x - 30, y, 60, 3, L.hold / B.carryHold, 'fin', { col: '#ffd65a', colD: '#7a5a1a' });
    gauge(g, x - 30, y + 5, 60, 3, v.escape / B.grabEscape, 'hp', { col: '#ff5b5b' });
    this.bottomPrompts(g, [[[inp.label('left') + '/' + inp.label('right')], corner ? '코너 앞!' : '걸어서 코너로'], [[inp.label('grab')], corner ? '턴버클 던지기' : '일렉트릭 체어 드롭']]);
  }
  drawBanners(g) {
    for (const b of this.banners) {
      const k = b.t / b.life, a = k < .1 ? k / .1 : k > .8 ? (1 - k) / .2 : 1;
      g.globalAlpha = clamp01(a);
      const off = k < .1 ? (1 - k / .1) * 40 : 0;
      g.save(); g.translate(off * (b.from || 1), 0);
      banner(g, b.text, b.y, b.col, { scale: b.scale, sub: b.sub, band: b.band, grad: b.grad });
      g.restore();
      g.globalAlpha = 1;
    }
  }
  drawCard(g) {
    const c = this.card;
    if (!c) return;
    const k = c.t / 1.6, slide = k < .12 ? 1 - k / .12 : k > .85 ? -(k - .85) / .15 : 0, a = k > .85 ? 1 - (k - .85) / .15 : 1;
    const col = c.F.color || '#ffd65a', y = 252;
    g.globalAlpha = a;
    g.save(); g.translate(slide * 640, 0);
    rect(g, '#05060f', 0, y - 2, 640, 50); rect(g, mixHex(col, '#05060f', .6), 0, y, 640, 46); rect(g, col, 0, y, 640, 2); rect(g, col, 0, y + 44, 640, 2);
    for (let i = 0; i < 640; i += 14) rect(g, mixHex(col, '#05060f', .45), i + ((c.t * 200) % 14), y + 2, 5, 42);
    rect(g, '#05060f', 34, y - 10, 58, 58); rect(g, mixHex(col, '#0b0f22', .5), 36, y - 8, 54, 54);
    drawPortrait(g, c.f.look, 'shout', 36, y - 8, 54, { px: 2, dy: 6 });
    drawText(g, c.F.name, 110, y + 5, { scale: 2, color: '#ffffff', bold: true, outline: '#05060f' });
    drawText(g, c.f.name + ' — ' + c.F.line, 112, y + 32, { size: 11, color: mixHex(col, '#ffffff', .6), outline: '#05060f' });
    g.restore();
    g.globalAlpha = 1;
  }
  // top right, under the player panels, on a dark strip so the ring and crowd behind do not swallow them
  toasts(g) { this.toastList.forEach((t, i) => { const a = t.t > 2.2 ? (2.6 - t.t) / .4 : 1, w = textWidth(t.text, 11) + 10, y = 66 + i * 15; g.globalAlpha = clamp01(a); rect(g, 'rgba(5,6,15,.8)', 636 - w, y - 2, w, 14); drawText(g, t.text, 632, y, { size: 11, align: 'r', color: t.col }); g.globalAlpha = 1; }); }
}
export const hudShade = shade;
export const hudEllipse = ellipse;
