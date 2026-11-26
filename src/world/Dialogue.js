// Dialogue box: speaker portrait and name, typewriter text with colour tags, choices, skipping.
import { clamp } from '../core/util.js';
import { drawText, wrapText, sliceTagged, visLen, stripTags } from '../render/pixelfont.js';
import { UI, mixHex } from '../render/palette.js';
import { rect } from '../render/painter.js';
import { panel } from '../render/ui.js';
import { drawPortrait } from '../render/head.js';
import { NPCS } from './npcs.js';

export class Dialogue {
  constructor(game, steps, o = {}) {
    this.game = game; this.queue = steps.slice(); this.cur = null; this.shown = 0; this.t = 0; this.done = false; this.sel = 0; this.onEnd = o.onEnd; this.player = o.player; this.speakerLook = o.look; this.lastWho = null;
    this.next();
  }
  next() {
    while (this.queue.length) {
      let s = this.queue.shift();
      if (typeof s === 'string') s = { who: this.lastWho, text: s };
      if (s.act) { s.act(); if (this.done) return; continue; }
      if (s.if) { const ok = s.if(); this.queue.unshift(...(ok ? s.then || [] : s.else || [])); continue; }
      this.cur = s; this.shown = 0; this.t = 0; this.sel = 0; this.lastWho = s.who || this.lastWho;
      if (s.text) { const w = this.lineWidth(); this.lines = wrapText(s.text, w); this.total = this.lines.reduce((n, l) => n + visLen(l), 0); }
      return;
    }
    this.close();
  }
  lineWidth() { return 452; }
  close() { if (this.done) return; this.done = true; this.cur = null; if (this.onEnd) this.onEnd(); }
  update(dt) {
    if (this.done || !this.cur) return;
    const inp = this.game.input, A = this.game.audio, c = this.cur;
    if (c.choice) {
      const n = c.choice.length;
      if (inp.pressed('up')) { this.sel = (this.sel + n - 1) % n; A.sfx('ui'); }
      if (inp.pressed('down')) { this.sel = (this.sel + 1) % n; A.sfx('ui'); }
      if (inp.menuPressed('confirm')) { const ch = c.choice[this.sel]; A.sfx('ok'); this.cur = null; if (ch.go) this.queue.unshift(...ch.go); if (ch.act) ch.act(); if (!this.done) this.next(); }
      else if (inp.menuPressed('cancel') && c.choice[n - 1].go) { const ch = c.choice[n - 1]; this.cur = null; this.queue.unshift(...ch.go); this.next(); }
      return;
    }
    const speed = 42 * (this.game.settings.typeSpeed || 1);
    const before = Math.floor(this.shown);
    this.shown = Math.min(this.total, this.shown + dt * speed);
    this.t += dt;
    if (Math.floor(this.shown) > before && Math.floor(this.shown) % 2 === 0) A.sfx('type', { pitch: (NPCS[c.who] && NPCS[c.who].voice) || 1 });
    if (inp.menuPressed('confirm') || inp.pressed('atk')) {
      if (this.shown < this.total) this.shown = this.total;
      else { A.sfx('ui'); this.next(); }
    }
    if (inp.menuPressed('cancel') && !this.queue.some(s => s.choice || s.act)) { this.close(); }
  }
  draw(u) {
    if (this.done || !this.cur) return;
    const c = this.cur, x = 14, y = 44, w = 612, h = 100;
    const npc = NPCS[c.who], who = c.who === 'me' ? this.player : npc;
    panel(u, x, y, w, h, { accent: npc && npc.wrestler ? '#ff5fa2' : '#49d6ff', bg: '#0e1330' });
    // portrait
    const look = c.who === 'me' ? this.player && this.player.look : npc ? npc.look : this.speakerLook;
    rect(u, '#05060f', x + 8, y + 10, 82, 82); rect(u, '#1b2450', x + 9, y + 11, 80, 80); rect(u, '#26315f', x + 9, y + 71, 80, 20);
    if (look) drawPortrait(u, look, c.expr || (c.choice ? 'neutral' : Math.floor(this.t * 8) % 2 && this.shown < this.total ? 'talk' : 'neutral'), x + 9, y + 11, 80, { px: 3, dy: 10, flip: false });
    const name = c.who === 'me' ? (this.player ? this.player.name : '나') : npc ? npc.name : c.name || '';
    if (name) { const nw = Math.max(70, name.length * 14 + 14); rect(u, '#05060f', x + 98, y - 9, nw + 2, 17); rect(u, npc && npc.wrestler ? '#7a1f4a' : '#1f4a7a', x + 99, y - 8, nw, 15); drawText(u, name, x + 105, y - 7, { size: 11, color: '#ffffff' }); }
    if (c.choice) {
      drawText(u, c.prompt || '어떻게 할까?', x + 104, y + 12, { color: UI.dim, size: 11 });
      c.choice.forEach((ch, i) => { const yy = y + 28 + i * 16, on = i === this.sel; if (on) rect(u, mixHex(UI.accent, '#0e1330', .5), x + 100, yy - 2, 300, 15); drawText(u, (on ? '▶ ' : '  ') + ch.label, x + 104, yy, { color: on ? '#ffffff' : UI.dim, size: 11 }); });
      return;
    }
    let left = Math.floor(this.shown);
    this.lines.forEach((l, i) => { if (left <= 0) return; const n = visLen(l); drawText(u, n <= left ? l : sliceTagged(l, left), x + 104, y + 14 + i * 18, { color: '#eef2ff' }); left -= n; });
    if (this.shown >= this.total && Math.floor(this.t * 3) % 2) drawText(u, '▼', x + w - 16, y + h - 16, { size: 11, color: '#ffd65a' });
    void clamp; void stripTags;
  }
}
