// Particles and cartoon effects in world space: sparks, dust, shock rings, sweat, comic words, confetti.
import { RNG, clamp, makeCanvas, ctxOf, TAU } from '../core/util.js';
import { drawText, textWidth } from './pixelfont.js';
import { mixHex } from './palette.js';
import { rect, ellipse, line, glow } from './painter.js';

export class Fx {
  constructor() { this.p = []; this.words = []; this.rings = []; this.rng = new RNG(77); this.screenLines = 0; this.lineCol = '#ffffff'; this.time = 0; this.ink = 0; this.dark = 0; this.wordCache = new Map(); }
  clear() { this.p.length = 0; this.words.length = 0; this.rings.length = 0; this.screenLines = 0; this.ink = 0; this.dark = 0; }
  spark(x, y, power = 1, col = '#fff3b0', dir = 0) { if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const r = this.rng, n = 5 + power * 5;
    for (let i = 0; i < n; i++) { const a = (dir ? (dir > 0 ? 0 : Math.PI) : 0) + (r.next() - .5) * (dir ? 2.4 : TAU), s = 90 + r.next() * 200 * power; this.p.push({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, t: 0, life: .16 + r.next() * .14, col: r.next() < .3 ? '#ffffff' : col, g: 300 }); }
    this.p.push({ k: 'flash', x, y, t: 0, life: .07 + power * .02, r: 4 + power * 3.5, col });
    this.p.push({ k: 'star', x, y, t: 0, life: .14 + power * .03, r: 10 + power * 7, col, rot: r.next() * TAU });
  }
  dust(x, y, power = 1, col = '#c9d2e6') { if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const r = this.rng, n = 3 + power * 4;
    for (let i = 0; i < n; i++) { const s = (40 + r.next() * 90) * power * (r.next() < .5 ? -1 : 1); this.p.push({ k: 'dust', x: x + (r.next() - .5) * 16, y: y - 2, vx: s, vy: -10 - r.next() * 40 * power, t: 0, life: .35 + r.next() * .35, r: 3 + r.next() * 4 * power, col, g: 30 }); }
  }
  ring(x, y, r, col = '#ffffff', life = .4) { if (!Number.isFinite(x) || !Number.isFinite(y)) return; this.rings.push({ x, y, r, col, t: 0, life }); }
  sweat(x, y, n = 4) { if (!Number.isFinite(x) || !Number.isFinite(y)) return; const r = this.rng; for (let i = 0; i < n; i++) this.p.push({ k: 'drop', x, y, vx: (r.next() - .5) * 160, vy: -80 - r.next() * 120, t: 0, life: .5, col: '#bfefff', g: 600 }); }
  confetti(x, y, n = 60) { if (!Number.isFinite(x) || !Number.isFinite(y)) return; const r = this.rng, C = ['#ff5fa2', '#49d6ff', '#ffd65a', '#6be38a', '#ffffff', '#c86bff']; for (let i = 0; i < n; i++) this.p.push({ k: 'conf', x: x + (r.next() - .5) * 300, y: y - r.next() * 80, vx: (r.next() - .5) * 60, vy: 20 + r.next() * 60, t: 0, life: 2.5 + r.next(), col: r.pick(C), g: 40, ph: r.next() * 6 }); }
  smoke(x, y, col = '#2a1a3c', n = 14) { if (!Number.isFinite(x) || !Number.isFinite(y)) return; const r = this.rng; for (let i = 0; i < n; i++) this.p.push({ k: 'dust', x: x + (r.next() - .5) * 30, y: y - r.next() * 40, vx: (r.next() - .5) * 120, vy: -20 - r.next() * 40, t: 0, life: .8 + r.next() * .6, r: 6 + r.next() * 8, col, g: -10 }); }
  weld(x, y) { if (!Number.isFinite(x) || !Number.isFinite(y)) return; const r = this.rng; for (let i = 0; i < 16; i++) { const a = r.next() * TAU, s = 120 + r.next() * 260; this.p.push({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, t: 0, life: .3 + r.next() * .3, col: r.pick(['#39e6c0', '#ffffff', '#ffe27a']), g: 500 }); } }
  splash(x, y) { if (!Number.isFinite(x) || !Number.isFinite(y)) return; const r = this.rng; for (let i = 0; i < 18; i++) this.p.push({ k: 'drop', x: x + (r.next() - .5) * 20, y, vx: (r.next() - .5) * 220, vy: -120 - r.next() * 200, t: 0, life: .7, col: r.next() < .5 ? '#9fe0ff' : '#ffffff', g: 700 }); }
  trailDot(x, y, col) { this.p.push({ k: 'dot', x, y, vx: 0, vy: 0, t: 0, life: .3, col, g: 0 }); }
  // Comic onomatopoeia with a pop.
  word(text, x, y, col = '#ffffff', size = 2, rot = 0) { if (!Number.isFinite(x) || !Number.isFinite(y)) return; this.words.push({ text, x, y, col, size, t: 0, life: .7 + size * .1, rot: rot || (this.rng.next() - .5) * .5, vy: -26 }); }
  update(dt) {
    this.time += dt;
    for (const q of this.p) { q.t += dt; if (q.vx != null) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.g || 0) * dt; if (q.k === 'dust') { q.vx *= 1 - dt * 3; } if (q.k === 'conf') { q.x += Math.sin(this.time * 3 + q.ph) * 20 * dt; } } }
    this.p = this.p.filter(q => q.t < q.life);
    for (const w of this.words) { w.t += dt; w.y += w.vy * dt; w.vy *= 1 - dt * 3; }
    this.words = this.words.filter(w => w.t < w.life);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter(r => r.t < r.life);
    this.screenLines = Math.max(0, this.screenLines - dt);
    this.ink = Math.max(0, this.ink - dt * .5);
  }
  draw(g, camX) {
    for (const r of this.rings) { const k = r.t / r.life, R = r.r * (.3 + k * .9); g.globalAlpha = 1 - k; g.strokeStyle = r.col; g.lineWidth = 2; g.beginPath(); g.ellipse(Math.round(r.x - camX), Math.round(r.y), R, R * .22, 0, 0, TAU); g.stroke(); g.globalAlpha = 1; }
    for (const q of this.p) {
      const k = q.t / q.life, x = Math.round(q.x - camX), y = Math.round(q.y);
      switch (q.k) {
        case 'spark': { const L = 3 + (1 - k) * 5; line(g, q.col, x, y, Math.round(x - q.vx * .02 * L / 5), Math.round(y - q.vy * .02 * L / 5)); break; }
        case 'flash': g.globalAlpha = 1 - k; ellipse(g, '#ffffff', x, y, Math.round(q.r * (1 - k * .5)), Math.round(q.r * (1 - k * .5))); g.globalAlpha = 1; glow(g, x, y, q.r * 2.2, q.col, .35 * (1 - k)); break;
        case 'star': { const R = q.r * (.6 + k * .6); g.globalAlpha = 1 - k; for (let i = 0; i < 8; i++) { const a = q.rot + i * TAU / 8, l = i % 2 ? R * .55 : R; line(g, i % 2 ? q.col : '#ffffff', x, y, Math.round(x + Math.cos(a) * l), Math.round(y + Math.sin(a) * l)); } g.globalAlpha = 1; break; }
        case 'dust': g.globalAlpha = (1 - k) * .5; ellipse(g, q.col, x, y, Math.round(q.r * (1 + k)), Math.round(q.r * (1 + k) * .7)); g.globalAlpha = 1; break;
        case 'drop': rect(g, q.col, x, y, 1, 2); break;
        case 'conf': rect(g, q.col, x, y, 2, Math.sin(this.time * 9 + q.ph) > 0 ? 2 : 1); break;
        case 'dot': g.globalAlpha = 1 - k; rect(g, q.col, x - 1, y - 1, 3, 3); g.globalAlpha = 1; break;
      }
    }
    for (const w of this.words) this.drawWord(g, w, camX);
  }
  wordCanvas(text, col, size) {
    const key = text + col + size;
    let c = this.wordCache.get(key);
    if (c) return c;
    const w = textWidth(text, 14, size, true) + 8, h = 14 * size + 10;
    c = makeCanvas(w, h); const g = ctxOf(c);
    drawText(g, text, 4, 6, { scale: size, color: '#0a0614', bold: true });
    drawText(g, text, 2, 3, { scale: size, color: col, bold: true, outline: mixHex(col, '#2a0a20', .75) });
    drawText(g, text, 2, 2, { scale: size, color: mixHex(col, '#ffffff', .5), bold: true, alpha: .35 });
    this.wordCache.set(key, c);
    if (this.wordCache.size > 80) this.wordCache.delete(this.wordCache.keys().next().value);
    return c;
  }
  drawWord(g, w, camX) {
    const c = this.wordCanvas(w.text, w.col, w.size), k = w.t / w.life;
    const pop = k < .12 ? .5 + k / .12 * .75 : k < .2 ? 1.25 - (k - .12) / .08 * .25 : 1;
    g.save();
    g.globalAlpha = k > .75 ? (1 - k) / .25 : 1;
    g.translate(Math.round(w.x - camX), Math.round(w.y));
    g.rotate(w.rot);
    g.scale(pop, pop);
    g.drawImage(c, -c.width / 2, -c.height / 2);
    g.restore();
  }
  // Screen-space speed lines for finishers.
  drawLines(g, W, H, col) {
    if (this.screenLines <= 0) return;
    const r = this.rng, a = clamp(this.screenLines * 2, 0, 1);
    g.globalAlpha = a * .6;
    for (let i = 0; i < 26; i++) { const ang = r.next() * TAU, r0 = 120 + r.next() * 120, r1 = r0 + 40 + r.next() * 120; line(g, col || this.lineCol, W / 2 + Math.cos(ang) * r0, H / 2 + Math.sin(ang) * r0 * .6, W / 2 + Math.cos(ang) * r1, H / 2 + Math.sin(ang) * r1 * .6); }
    g.globalAlpha = 1;
  }
}
