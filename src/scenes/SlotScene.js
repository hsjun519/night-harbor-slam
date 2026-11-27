// Three career save slots: start a new career in an empty slot (or over an old one, after asking), continue any of
// them, or delete one. A finished champion's career can stay in its slot while you start over in another.
import { VIEW_W, VIEW_H, clamp } from '../core/util.js';
import { drawText } from '../render/pixelfont.js';
import { UI, mixHex } from '../render/palette.js';
import { rect, bands } from '../render/painter.js';
import { panel, prompt } from '../render/ui.js';
import { drawPortrait } from '../render/head.js';
import { slotInfo, deleteCareer, SLOTS } from '../world/CareerManager.js';
import { ENDINGS } from '../world/endings.js';

export class SlotScene {
  constructor(game, mode, o = {}) {
    this.game = game; this.mode = mode; this.t = 0; this.ask = null; this.onPick = o.onPick;
    this.refresh();
    // starting new: the first empty slot; otherwise the most recently played
    const empty = this.info.findIndex(x => !x), latest = this.info.reduce((b, x, i) => (x && (b < 0 || x.savedAt > this.info[b].savedAt) ? i : b), -1);
    this.sel = mode === 'new' ? (empty >= 0 ? empty : 0) : Math.max(0, latest);
  }
  refresh() { this.info = Array.from({ length: SLOTS }, (_, i) => slotInfo(i + 1)); }
  update(dt) {
    this.t += dt;
    const inp = this.game.input, A = this.game.audio;
    if (this.ask) {   // 예 / 아니요, 아니요 first
      if (inp.pressed('left') || inp.pressed('right')) { this.ask.sel = 1 - this.ask.sel; A.sfx('ui'); }
      if (inp.menuPressed('cancel')) { this.ask = null; A.sfx('back'); return; }
      if (inp.menuPressed('confirm')) {
        const a = this.ask; this.ask = null;
        if (a.sel !== 0) { A.sfx('back'); return; }
        if (a.kind === 'delete') { deleteCareer(a.n); this.refresh(); A.sfx('deny'); return; }
        A.sfx('ok'); this.onPick && this.onPick('new', a.n, true);
      }
      return;
    }
    const n = SLOTS + 1;
    if (inp.pressed('up')) { this.sel = (this.sel + n - 1) % n; A.sfx('ui'); }
    if (inp.pressed('down')) { this.sel = (this.sel + 1) % n; A.sfx('ui'); }
    if (inp.menuPressed('cancel')) { A.sfx('back'); this.game.toTitle(); return; }
    const i = this.sel, info = this.info[i];
    if (i < SLOTS && info && (inp.rawPressed('Delete') || inp.rawPressed('KeyX'))) { this.ask = { kind: 'delete', n: i + 1, sel: 1 }; A.sfx('ui'); return; }
    if (!inp.menuPressed('confirm')) return;
    if (i === SLOTS) { A.sfx('back'); this.game.toTitle(); return; }
    if (this.mode === 'new') {
      if (info) { this.ask = { kind: 'new', n: i + 1, sel: 1 }; A.sfx('ui'); return; }
      A.sfx('ok'); this.onPick && this.onPick('new', i + 1);
    } else {
      if (!info) { A.sfx('ok'); this.onPick && this.onPick('new', i + 1); return; }
      A.sfx('ok'); this.onPick && this.onPick('continue', i + 1);
    }
  }
  draw(w, u) {
    bands(w, 0, 0, VIEW_W, VIEW_H, ['#0b0f22', '#0e1430', '#111a3a', '#141f44', '#17244c']);
    for (let i = 0; i < 16; i++) rect(w, 'rgba(73,214,255,.05)', 0, i * 24 + ((this.t * 12) % 24), VIEW_W, 1);
    u.clearRect(0, 0, VIEW_W, VIEW_H);
    drawText(u, this.mode === 'new' ? '새 커리어 — 슬롯 고르기' : '세이브 슬롯', 20, 14, { scale: 2, color: '#ffd65a', bold: true, outline: '#05060f' });
    drawText(u, this.mode === 'new' ? '빈 슬롯에서 시작하면 다른 커리어는 그대로 남는다. 찬 슬롯은 덮어쓰기 전에 묻는다.' : '이어 할 커리어를 고르자. 빈 슬롯을 고르면 새로 시작한다.', 20, 46, { size: 11, color: UI.dim });
    for (let i = 0; i < SLOTS; i++) {
      const x = 20, y = 66 + i * 76, on = i === this.sel, I = this.info[i];
      panel(u, x, y, 600, 68, { accent: on ? '#ffd65a' : I ? '#49d6ff' : '#3a4258', alpha: on ? .97 : .85 });
      if (on) rect(u, mixHex(UI.accent, UI.panel, .7), x + 2, y + 2, 596, 64);
      drawText(u, `슬롯 ${i + 1}`, x + 10, y + 8, { size: 11, color: on ? '#ffd65a' : UI.dim });
      if (!I) { drawText(u, '비어 있음', x + 80, y + 26, { color: '#9aa6d6' }); continue; }
      rect(u, '#05060f', x + 70, y + 8, 52, 52); rect(u, '#1b2450', x + 71, y + 9, 50, 50);
      if (I.look) drawPortrait(u, I.look, I.champion ? 'happy' : 'neutral', x + 71, y + 9, 50, { px: 2, dy: 6 });
      drawText(u, I.name + (I.champion ? '  ★ 챔피언' : ''), x + 132, y + 8, { color: I.champion ? '#ffd65a' : '#ffffff', bold: true });
      drawText(u, `시즌 ${I.season} · ${I.day}일차 · 레벨 ${I.level} · 명성 ${I.fame}`, x + 132, y + 28, { size: 11, color: '#c9d4ff' });
      drawText(u, `${I.w}승 ${I.l}패${I.titles ? ` · 타이틀 ${I.titles}개` : ''}${I.over && !I.ending ? ' · 은퇴/부상' : ''}`, x + 132, y + 44, { size: 11, color: UI.dim });
      if (I.ending && ENDINGS[I.ending]) drawText(u, `엔딩: ${ENDINGS[I.ending].name} (고르면 다시 보기)`, x + 590, y + 44, { size: 11, align: 'r', color: ENDINGS[I.ending].col });
      if (I.savedAt) drawText(u, new Date(I.savedAt).toLocaleDateString('ko-KR') + ' 저장', x + 590, y + 8, { size: 11, align: 'r', color: UI.dim });
    }
    const by = 66 + SLOTS * 76, onB = this.sel === SLOTS;
    panel(u, 20, by, 160, 22, { alpha: onB ? .97 : .8, accent: onB ? '#ffd65a' : '#3a4258' });
    drawText(u, '돌아가기', 100, by + 5, { size: 11, align: 'c', color: onB ? '#ffffff' : UI.dim });
    if (this.ask) {
      const a = this.ask;
      panel(u, 150, 140, 340, 80, { accent: '#ff5b5b', alpha: .98 });
      drawText(u, a.kind === 'delete' ? `슬롯 ${a.n}의 커리어를 지울까요? (되돌릴 수 없다)` : `슬롯 ${a.n}의 커리어 위에 새로 시작할까요?`, 320, 152, { size: 11, align: 'c', color: '#ffffff' });
      ['예', '아니요'].forEach((t, k) => { const on = a.sel === k; rect(u, on ? '#26315f' : '#141a36', 230 + k * 100, 184, 80, 20); drawText(u, t, 270 + k * 100, 188, { size: 11, align: 'c', color: on ? '#ffd65a' : UI.dim }); });
    }
    prompt(u, ['↑↓'], '슬롯', 20, 338, {}); prompt(u, ['Enter'], '결정', 90, 338, {}); prompt(u, ['X'], '지우기', 170, 338, {}); prompt(u, ['Esc'], '뒤로', 240, 338, {});
    void clamp;
  }
}
