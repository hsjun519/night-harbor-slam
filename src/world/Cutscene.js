// Timeline cutscenes played inside the town scene: people walk on, talk and react, the camera pans, letterbox bars
// and title cards frame it, the screen shakes or flashes. A script is a list of steps run one after another; a step
// with `with: 1` starts together with the one before it. Esc skips to the end: every remaining step that changes
// the story (`act`, `spawn` with keep, `at`) still runs, the rest is dropped. Cutscenes queue (WorldScene.cine).
//
//   { at: 'street', x }          move to a place (instantly, under the bars)
//   { cam: x, dur }              pan the camera to x (world pixels, left edge of the view) over dur seconds; { cam: null } follows the player again
//   { spawn: id, x, face, stance, look, keep }   put somebody there (npc id or a CHARACTERS id); keep: stays after the scene
//   { walk: id, to, speed }      walk somebody (or 'me') to x and wait until they arrive
//   { face: id, dir }            turn somebody (dir -1/1 or another id to look at)
//   { say: [steps] }             a dialogue (Dialogue steps); waits until it closes
//   { title: text, sub, dur }    a big title card;  { caption: text, dur } a line at the bottom
//   { shake: k } { flash: [r, g, b, a] } { sfx: name } { music: name } { wait: t } { bars: 0|1 } { act: fn } { remove: id }
import { VIEW_W, VIEW_H, clamp } from '../core/util.js';
import { drawText } from '../render/pixelfont.js';
import { rect } from '../render/painter.js';
import { Actor } from './Actor.js';
import { NPCS } from './npcs.js';
import { CHARACTERS } from '../data/characters.js';

export class Cutscene {
  constructor(W, script, o = {}) {
    this.W = W; this.q = script.slice(); this.run = []; this.t = 0; this.bars = 0; this.barsWant = o.bars === false ? 0 : 1;
    this.card = null; this.cap = null; this.cam = null; this.camFrom = 0; this.camT = 0; this.camDur = 0; this.cast = {}; this.done = false;
    this.onEnd = o.onEnd || null; this.id = o.id || ''; this.skipT = 0; this.borrowed = [];
  }
  actor(id) { if (id === 'me') return this.W.player; return this.cast[id] || this.W.npcs.find(a => a.id === id) || null; }
  start() { this.next(); }
  next() {
    this.run = [];
    while (this.q.length) {
      const s = this.q.shift();
      this.begin(s);
      this.run.push(s);
      if (!(this.q[0] && this.q[0].with)) break;
    }
    if (!this.run.length) this.finish();
  }
  begin(s) {
    const W = this.W, A = W.game.audio;
    s.t = 0;
    if (s.at) { W.enter(s.at, s.x != null ? s.x : W.player.x, true); this.cast = {}; }
    if (s.cam !== undefined) { if (s.cam === null) this.cam = null; else { this.camFrom = W.camX; this.cam = s.cam; this.camT = 0; this.camDur = s.dur || .01; } }
    // somebody already standing in this place is borrowed (moved for the scene, put back after) instead of doubled
    if (s.spawn && W.npcs.some(n => n.id === s.spawn && !n.cine && !n.gone)) {
      const a = W.npcs.find(n => n.id === s.spawn && !n.cine && !n.gone);
      this.borrowed.push({ a, x: a.x, face: a.face, stance: a.stance });
      a.x = s.x; a.face = s.face || a.face; if (s.stance) a.stance = s.stance; a.scripted = true; a.vx = 0;
      this.cast[s.spawn] = a;
    } else if (s.spawn) {
      const N = NPCS[s.spawn], C = CHARACTERS[s.spawn], look = s.look || (N && N.look) || (C && C.look);
      const a = new Actor(look, { x: s.x, face: s.face || 1, stance: s.stance || (N && N.stance) || 'calm', id: s.spawn });
      a.idx = W.npcs.length + 1; a.cine = !s.keep; a.scripted = true;
      W.npcs.push(a); this.cast[s.spawn] = a;
    }
    if (s.remove) { const a = this.actor(s.remove); if (a && a !== W.player) a.gone = true; }
    if (s.face) { const a = this.actor(s.face), o = typeof s.dir === 'string' ? this.actor(s.dir) : null; if (a) a.face = o ? Math.sign(o.x - a.x) || a.face : s.dir; }
    if (s.walk) { const a = this.actor(s.walk); if (a) { a.scripted = true; s.a = a; } }
    if (s.say) { W.say(s.say.slice()); s.waiting = true; }
    if (s.title) { this.card = { text: s.title, sub: s.sub || '', t: 0, dur: s.dur || 2.6 }; }
    if (s.caption) { this.cap = { text: s.caption, t: 0, dur: s.dur || 2.4 }; }
    if (s.shake) W.game.screen.shake(s.shake);
    if (s.flash) W.game.screen.flash(...s.flash);
    if (s.sfx) A.sfx(s.sfx);
    if (s.music) A.music(s.music);
    if (s.bars != null) this.barsWant = s.bars ? 1 : 0;
    if (s.act) s.act(W);
  }
  // true when the step is over
  tick(s, dt) {
    const W = this.W;
    s.t += dt;
    if (s.walk) {
      const a = s.a; if (!a) return true;
      const d = s.to - a.x, sp = s.speed || 90;
      if (Math.abs(d) <= 3) { a.x = s.to; a.vx = 0; if (a !== W.player) a.scripted = !!a.cine; return true; }
      a.vx = Math.sign(d) * sp; a.face = Math.sign(d); a.x += a.vx * dt; if (Math.abs(s.to - a.x) < 3 || Math.sign(s.to - a.x) !== Math.sign(d)) { a.x = s.to; a.vx = 0; return true; }
      return false;
    }
    if (s.say) return !W.dialog;
    if (s.cam !== undefined && s.cam !== null) return s.t >= (s.dur || 0);
    if (s.title) return s.t >= (s.dur || 2.6);
    if (s.caption) return s.t >= (s.dur || 2.4) * .6;
    if (s.wait) return s.t >= s.wait;
    return true;
  }
  update(dt) {
    const W = this.W, inp = W.game.input;
    this.t += dt;
    this.bars += (this.barsWant - this.bars) * Math.min(1, dt * 6);
    if (this.card) { this.card.t += dt; if (this.card.t > this.card.dur) this.card = null; }
    if (this.cap) { this.cap.t += dt; if (this.cap.t > this.cap.dur) this.cap = null; }
    if (this.cam != null) { this.camT += dt; const k = clamp(this.camT / this.camDur, 0, 1), e = k * k * (3 - 2 * k); W.camX = this.camFrom + (this.cam - this.camFrom) * e; }
    // Esc (held a moment) skips: story changes still happen
    if (inp.down && inp.down('pause')) { this.skipT += dt; if (this.skipT > .45) { this.skip(); return; } } else this.skipT = 0;
    if (W.dialog) { W.dialog.update(dt); }
    let all = true;
    for (const s of this.run) if (!s.over) { if (this.tick(s, dt)) s.over = true; else all = false; }
    if (all) this.next();
  }
  skip() {
    const W = this.W;
    W.dialog = null;
    for (const s of this.run.concat(this.q)) {
      if (s.over) continue;
      if (s.say) for (const st of s.say) if (st && st.act) st.act();   // dialogue side effects
      if (s.walk && s.a) { s.a.x = s.to; s.a.vx = 0; }
      if (this.q.includes(s) && (s.act || s.at || (s.spawn && s.keep) || s.remove || s.music)) this.begin(s);
    }
    this.q = []; this.run = []; this.finish();
  }
  finish() {
    if (this.done) return;
    this.done = true;
    const W = this.W;
    for (const a of W.npcs) if (a.cine) a.gone = true;
    for (const id in this.cast) this.cast[id].scripted = false;
    for (const b of this.borrowed) { b.a.x = b.x; b.a.face = b.face; b.a.stance = b.stance; b.a.vx = 0; }
    W.player.scripted = false;
    if (this.onEnd) this.onEnd(W);
  }
  draw(u) {
    const b = Math.round(this.bars * 34);
    if (b > 0) { rect(u, '#000000', 0, 0, VIEW_W, b); rect(u, '#000000', 0, VIEW_H - b, VIEW_W, b); }
    if (this.card) {
      const k = this.card.t, a = Math.min(1, k * 2, (this.card.dur - k) * 2);
      u.globalAlpha = Math.max(0, a);
      rect(u, 'rgba(5,6,15,.78)', 0, 132, VIEW_W, 70);
      drawText(u, this.card.text, VIEW_W / 2, 142, { scale: 2, align: 'c', color: '#ffd65a', bold: true, outline: '#05060f' });
      if (this.card.sub) drawText(u, this.card.sub, VIEW_W / 2, 180, { size: 11, align: 'c', color: '#c9d4ff' });
      u.globalAlpha = 1;
    }
    if (this.cap && !this.W.dialog) {
      const k = this.cap.t, a = Math.min(1, k * 3, (this.cap.dur - k) * 3);
      u.globalAlpha = Math.max(0, a);
      drawText(u, this.cap.text, VIEW_W / 2, VIEW_H - 28, { size: 11, align: 'c', color: '#ffffff', outline: '#05060f' });
      u.globalAlpha = 1;
    }
    if (this.t > .6 && !this.W.dialog) drawText(u, 'Esc 길게: 건너뛰기', VIEW_W - 8, b + 4, { size: 11, align: 'r', color: 'rgba(255,255,255,.45)' });
  }
}
