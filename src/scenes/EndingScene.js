// THE FINAL BELL (cutscene 27 of the design brief). After the last scene of an ending: the career as a sports
// documentary — a reel of what really happened (endings.js highlights; nothing that did not happen), the final
// choice, then the script of the career written as if it had been planned before the first day, six lines read
// slowly (a silence before the two questions; no answer, no buttons), and the credits over the main theme.
// Enter hurries a part along, Esc (held) skips it. The career keeps its ending; a replay comes back here.
import { VIEW_W, VIEW_H, clamp, RNG } from '../core/util.js';
import { drawText, wrapText } from '../render/pixelfont.js';
import { rect, bands } from '../render/painter.js';
import { drawPortrait } from '../render/head.js';
import { mixHex as mix } from '../render/palette.js';
import { CHARACTERS } from '../data/characters.js';
import { NPCS } from '../world/npcs.js';
import { ENDINGS, highlights, scriptLines, credits, FINAL_LINES, FINAL_QUESTIONS } from '../world/endings.js';

const TONE = { story: ['#2a2350', '#c9a8ff'], win: ['#3a2a14', '#ffd65a'], loss: ['#17223a', '#9fb4e0'], rival: ['#3a1420', '#ff6b7a'], gold: ['#4a3410', '#ffe27a'], end: ['#123a3a', '#7fe0ff'] };
const lookOf = id => (id && NPCS[id] ? NPCS[id].look : id && CHARACTERS[id] ? CHARACTERS[id].look : null);
const nameOf = id => (id && NPCS[id] ? NPCS[id].name : id && CHARACTERS[id] ? CHARACTERS[id].name : '');
export const FB = { open: 4.6, card: 3.6, type: 34, scriptHold: 3.2, line: 3.8, silence: 3, qHold: 5, scroll: 20 };
const PAPER = { x: 104, y: 20, w: 432, h: 320, top: 80, lh: 15 };

export class EndingScene {
  constructor(game, career, o = {}) {
    this.game = game; this.c = career;
    const d = career.d;
    this.id = o.id || (d.ending && d.ending.id) || 'retire';
    this.E = ENDINGS[this.id] || ENDINGS.retire;
    this.replay = !!o.replay;
    this.reel = highlights(d, this.id);
    this.lines = [];   // the script, wrapped to the paper
    for (const L of scriptLines(d, this.id)) {
      if (L.h) this.lines.push({ h: 1, s: L.h });
      else for (const s of wrapText(L.t, PAPER.w - 56, 11)) this.lines.push({ s });
    }
    this.chars = this.lines.reduce((n, L) => n + [...L.s].length, 0);
    this.cred = credits(d, id => (NPCS[id] ? NPCS[id].name : null));
    this.look = career.look();
    this.phase = 'open'; this.t = 0; this.pt = 0; this.i = 0; this.skipT = 0; this.typed = 0; this.scroll = 0; this.credY = 0; this.done = false;
    this.grain = new RNG(7);
    game.audio.music(null); game.audio.sfx('bell3');
  }
  go(phase) {
    this.phase = phase; this.pt = 0;
    const A = this.game.audio;
    if (phase === 'reel') { this.i = 0; A.music('wave'); }
    if (phase === 'lines') A.music(null);
    if (phase === 'credits') { A.music('ending'); this.credY = 0; }
  }
  finish() {
    if (this.done) return;
    this.done = true;
    const d = this.c.d;
    if (d.ending && !this.replay) { d.ending.seen = 1; this.c.save(); }
    this.game.audio.music(null);
    this.game.toTitle();
  }
  // seconds the lines part runs: four lines, a silence, two questions
  get linesDur() { return FINAL_LINES.length * FB.line + 1.6 + FB.silence + FINAL_QUESTIONS.length * FB.line + FB.qHold; }
  update(dt) {
    this.t += dt; this.pt += dt;
    const inp = this.game.input, A = this.game.audio, ok = inp.menuPressed('confirm');
    // Esc held: skip this part
    if (inp.down('pause')) { this.skipT += dt; if (this.skipT > .5) { this.skipT = -9; this.skipPart(); return; } } else this.skipT = 0;
    switch (this.phase) {
      case 'open':
        if (this.pt >= FB.open || (ok && this.pt > 1)) this.go('reel');
        break;
      case 'reel':
        if (this.pt >= FB.card || (ok && this.pt > .6)) { this.i++; this.pt = 0; if (ok) A.sfx('ui'); if (this.i >= this.reel.length) this.go('script'); }
        break;
      case 'script': {
        const all = this.typed >= this.chars;
        if (ok) { if (!all) this.typed = this.chars; else { this.go('lines'); break; } }
        if (!all) { const n0 = Math.floor(this.typed); this.typed = Math.min(this.chars, this.typed + dt * FB.type); if (Math.floor(this.typed) > n0 && Math.floor(this.typed) % 3 === 0) A.sfx('type'); this.pt = 0; }
        else if (this.pt >= FB.scriptHold) this.go('lines');
        break;
      }
      case 'lines':
        if (this.pt >= this.linesDur || (ok && this.pt > this.linesDur - FB.qHold + 1)) this.go('credits');
        break;
      case 'credits':
        this.credY += dt * FB.scroll * (inp.down('down') || inp.down('right') ? 4 : 1);
        if (this.credY > this.credH() + 40 && ok) this.finish();
        break;
    }
  }
  skipPart() {
    if (this.phase === 'open' || this.phase === 'reel') this.go('script');
    else if (this.phase === 'script') this.go('lines');
    else if (this.phase === 'lines') this.go('credits');
    else this.finish();
  }
  credH() { return this.cred.reduce((h, L) => h + (L.big ? 40 : L.gap ? 18 * L.gap : L.h ? 22 : 18), 0) + VIEW_H / 2; }
  // ---- draw ----
  draw(w, u) {
    u.clearRect(0, 0, VIEW_W, VIEW_H);
    if (this.phase === 'script') this.drawPaperBg(w);
    else bands(w, 0, 0, VIEW_W, VIEW_H, this.phase === 'credits' ? ['#05060f', '#070914', '#0a0c1c'] : ['#05060f', '#090b1a', '#0c0f22', '#0e1126']);
    if (this.phase === 'open') this.drawOpen(u);
    else if (this.phase === 'reel') this.drawReel(w, u);
    else if (this.phase === 'script') this.drawScript(u);
    else if (this.phase === 'lines') this.drawLines(u);
    else this.drawCredits(u);
    if (this.t > 1.2 && this.phase !== 'credits') drawText(u, 'Enter: 넘기기 · Esc 길게: 건너뛰기', VIEW_W - 8, VIEW_H - 16, { size: 11, align: 'r', color: 'rgba(255,255,255,.35)' });
  }
  drawOpen(u) {
    const t = this.pt, a = k => clamp((t - k) / .8, 0, 1) * clamp((FB.open - t) / .6, 0, 1);
    u.globalAlpha = a(.5); drawText(u, 'THE FINAL BELL', VIEW_W / 2, 128, { scale: 3, align: 'c', color: '#ffd65a', bold: true, outline: '#05060f' });
    u.globalAlpha = a(1.3); drawText(u, '마지막 벨', VIEW_W / 2, 182, { scale: 2, align: 'c', color: '#eef2ff', bold: true });
    u.globalAlpha = a(2.2); drawText(u, `— ${this.E.name} —`, VIEW_W / 2, 222, { size: 11, align: 'c', color: this.E.col });
    u.globalAlpha = 1;
  }
  // film grain and a light leak behind the cards
  grainFx(w) {
    const r = this.grain;
    for (let i = 0; i < 3; i++) if (r.next() < .5) rect(w, 'rgba(255,255,255,.05)', (r.next() * VIEW_W) | 0, 0, 1, VIEW_H);
    for (let i = 0; i < 40; i++) rect(w, r.next() < .5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.2)', (r.next() * VIEW_W) | 0, (r.next() * VIEW_H) | 0, 1, 1);
  }
  drawReel(w, u) {
    this.grainFx(w);
    const h = this.reel[Math.min(this.i, this.reel.length - 1)];
    if (!h) return;
    const T = TONE[h.tone] || TONE.story, k = this.pt, inA = clamp(k / .35, 0, 1), outA = clamp((FB.card - k) / .3, 0, 1), a = Math.min(inA, outA);
    const slide = Math.round((1 - inA) * 40);
    u.globalAlpha = a;
    const px = 150 + slide, py = 44, pw = 340, ph = 136;
    // the photo
    rect(u, '#05060f', px - 6, py - 6, pw + 12, ph + 12); rect(u, '#e6e0cc', px - 4, py - 4, pw + 8, ph + 8);
    bands(u, px, py, pw, ph, [T[0], mix(T[0], '#000000', .2), mix(T[0], '#000000', .35)]);
    for (let y = py + 2; y < py + ph; y += 4) for (let x = px + ((y >> 2) & 1) * 2; x < px + pw; x += 4) rect(u, 'rgba(255,255,255,.035)', x, y, 1, 1);
    const other = lookOf(h.other), S = 92;
    if (other) {
      drawPortrait(u, this.look, h.expr || 'neutral', px + 40, py + 20, S, { px: 3, dy: 10 });
      drawPortrait(u, other, h.tone === 'win' ? 'hurt' : h.tone === 'loss' ? 'smug' : 'neutral', px + pw - 40 - S, py + 20, S, { px: 3, dy: 10 });
      drawText(u, nameOf(h.other), px + pw - 40 - S / 2, py + ph - 16, { size: 11, align: 'c', color: '#eef2ff', outline: '#05060f' });
      drawText(u, this.c.d.name, px + 40 + S / 2, py + ph - 16, { size: 11, align: 'c', color: '#eef2ff', outline: '#05060f' });
    } else {
      drawPortrait(u, this.look, h.expr || 'neutral', px + pw / 2 - S / 2, py + 18, S, { px: 3, dy: 10 });
      if (h.belt) { rect(u, '#120c1e', px + pw / 2 - 47, py + 108, 94, 16); rect(u, '#c9a22e', px + pw / 2 - 46, py + 109, 92, 14); rect(u, '#ffe9a8', px + pw / 2 - 14, py + 107, 28, 18); rect(u, '#c9a22e', px + pw / 2 - 10, py + 110, 20, 12); }
    }
    if (h.when) drawText(u, h.when, px + pw - 8, py + 6, { size: 11, align: 'r', color: '#ff9a3a' });
    // the caption
    drawText(u, h.title, VIEW_W / 2 + slide / 2, py + ph + 22, { scale: 2, align: 'c', color: T[1], bold: true, outline: '#05060f' });
    const sub = wrapText(h.sub, 520, 11);
    sub.forEach((s, i) => drawText(u, s, VIEW_W / 2 + slide / 2, py + ph + 58 + i * 16, { size: 11, align: 'c', color: '#eef2ff' }));
    u.globalAlpha = 1;
    // where in the reel
    for (let i = 0; i < this.reel.length; i++) rect(u, i === this.i ? '#ffd65a' : i < this.i ? '#6a6f8a' : '#2a2f4a', VIEW_W / 2 - this.reel.length * 6 + i * 12, 20, 8, 3);
  }
  drawPaperBg(w) {
    bands(w, 0, 0, VIEW_W, VIEW_H, ['#0a0c1c', '#0c0f22', '#0e1126']);
    const P = PAPER;
    rect(w, '#05060f', P.x - 3, P.y - 3, P.w + 6, P.h + 6); rect(w, '#efe6cf', P.x, P.y, P.w, P.h);
    for (let y = P.y + P.top - 4; y < P.y + P.h - 6; y += P.lh) rect(w, 'rgba(120,96,60,.12)', P.x + 18, y + 12, P.w - 36, 1);
    rect(w, 'rgba(180,40,40,.35)', P.x + 30, P.y, 1, P.h);
  }
  drawScript(u) {
    const P = PAPER, d = this.c.d;
    drawText(u, '각본', VIEW_W / 2, P.y + 10, { scale: 2, align: 'c', color: '#2a2418', bold: true });
    drawText(u, `"${d.name}"`, VIEW_W / 2, P.y + 42, { size: 11, align: 'c', color: '#4a3a24' });
    drawText(u, '작성: 시즌 1 · 1일차 이전', P.x + P.w - 14, P.y + 58, { size: 11, align: 'r', color: '#8a6a44' });
    // typed so far, scrolled so the newest line stays on the page
    let left = Math.floor(this.typed), last = 0;
    const out = [];
    for (let i = 0; i < this.lines.length && left > 0; i++) { const L = this.lines[i], n = [...L.s].length, s = n <= left ? L.s : [...L.s].slice(0, left).join(''); out.push({ L, s }); left -= n; last = i; }
    const rows = Math.floor((P.h - P.top - 12) / P.lh), first = Math.max(0, last - rows + 1);
    out.slice(first).forEach((o, k) => drawText(u, o.s, P.x + (o.L.h ? 40 : 56), P.y + P.top + k * P.lh, { size: 11, color: o.L.h ? '#7a1f1f' : '#2a2418', bold: !!o.L.h }));
    if (this.typed >= this.chars) { const k = clamp(this.pt / .5, 0, 1); u.globalAlpha = k; drawText(u, '— 끝 —', VIEW_W / 2, P.y + P.h - 22, { size: 11, align: 'c', color: '#4a3a24' }); u.globalAlpha = 1; }
  }
  drawLines(u) {
    const t = this.pt, L = FINAL_LINES, Q = FINAL_QUESTIONS, lineEnd = L.length * FB.line + 1.6;
    if (t < lineEnd) {
      const out = clamp((lineEnd - t) / 1.2, 0, 1);
      L.forEach((s, i) => { const a = clamp((t - i * FB.line) / 1.4, 0, 1) * out; if (a <= 0) return; u.globalAlpha = a; drawText(u, s, VIEW_W / 2, 104 + i * 36, { size: 11, align: 'c', color: '#eef2ff' }); });
    } else if (t >= lineEnd + FB.silence) {
      const q = t - lineEnd - FB.silence, end = Q.length * FB.line + FB.qHold, out = clamp((end - q) / 1.4, 0, 1);
      Q.forEach((s, i) => { const a = clamp((q - i * FB.line) / 1.6, 0, 1) * out; if (a <= 0) return; u.globalAlpha = a; drawText(u, s, VIEW_W / 2, 150 + i * 44, { scale: 2, align: 'c', color: i ? '#ffd65a' : '#eef2ff', bold: true }); });
    }
    u.globalAlpha = 1;
  }
  drawCredits(u) {
    let y = VIEW_H + 10 - this.credY;
    for (const L of this.cred) {
      if (L.big) { if (y > -40 && y < VIEW_H) drawText(u, L.big, VIEW_W / 2, y, { scale: 3, align: 'c', color: '#ffd65a', bold: true, outline: '#05060f' }); y += 40; continue; }
      if (L.gap) { y += 18 * L.gap; continue; }
      if (y > -20 && y < VIEW_H) drawText(u, L.h || L.sub || L.t, VIEW_W / 2, y, { size: 11, align: 'c', color: L.h ? '#49d6ff' : L.sub ? '#c9d4ff' : '#eef2ff', bold: !!L.h });
      y += L.h ? 22 : 18;
    }
    if (y < VIEW_H / 2 + 20) {
      const a = clamp((VIEW_H / 2 + 20 - y) / 60, 0, 1);
      u.globalAlpha = a;
      drawText(u, '끝', VIEW_W / 2, VIEW_H / 2 - 20, { scale: 2, align: 'c', color: '#eef2ff', bold: true });
      drawText(u, `${this.E.en} · ${this.E.name}`, VIEW_W / 2, VIEW_H / 2 + 16, { size: 11, align: 'c', color: this.E.col });
      drawText(u, 'Enter: 타이틀로', VIEW_W / 2, VIEW_H / 2 + 52, { size: 11, align: 'c', color: 'rgba(255,255,255,.6)' });
      u.globalAlpha = 1;
    }
  }
}
