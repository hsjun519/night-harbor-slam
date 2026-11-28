// Training mini-games (timing, rhythm, memory, balance, breathing) and the dock part-time job.
import { clamp, fmtMoney, RNG } from '../core/util.js';
import { GEAR, gearNow, tierOf, gainK, tireOf, gymOf, outgrown, MECH_NAME } from './gymGear.js';
import { drawText } from '../render/pixelfont.js';
import { UI, mixHex } from '../render/palette.js';
import { rect, ellipse } from '../render/painter.js';
import { panel, gauge, keycap, prompt, fade } from '../render/ui.js';
import { STAT_GROWTH } from './CareerManager.js';

const GAMES = {
  bench: { name: '벤치프레스', kind: '타이밍', stats: ['atk', 'hp'], pose: 'bench', x: 420, desc: '바늘이 초록 칸에 들어왔을 때 {y}J{/}(또는 Space·E·Enter). 8번 들어 올리자. 세 번 놓치면 끝.' },
  rope: { name: '줄넘기', kind: '리듬', stats: ['agi'], pose: 'rope', x: 546, desc: '원이 줄어들어 고리에 닿는 순간 {y}W{/}(또는 J·Space). 박자를 타자.' },
  mitt: { name: '미트 치기', kind: '순서 기억', stats: ['grp', 'rec', 'brk'], pose: 'mitt', x: 668, desc: '관장님이 보여 주는 방향 순서를 기억했다가 {y}W A S D{/}(또는 방향키)로 똑같이.' },
  bridge: { name: '목 브릿지', kind: '균형', stats: ['stun', 'kbr'], pose: 'bridge', x: 790, desc: '흔들리는 바늘을 {y}A D{/}(또는 ←→)로 가운데에 붙잡아 두자. 10초.' },
  breath: { name: '호흡 훈련', kind: '타이밍', stats: ['fin', 'down'], pose: 'calm', x: 410, desc: '{y}J{/}(또는 Space)를 누르고 있으면 숨이 찬다. 초록 띠에서 손을 떼자. 5번.' },
  cleanup: { name: '로비 정리', kind: '타이밍', stats: [], pose: 'carry', x: 600, mech: 'job', desc: '부서진 가구 조각을 상자에 차곡차곡. 바로 위에 왔을 때 {y}J{/}(또는 Space·E·Enter). 8개.' },
  scrap: { name: '고물 정리 돕기', kind: '타이밍', stats: [], pose: 'carry', x: 812, mech: 'job', desc: '영감이 주워 온 고물을 수레에 차곡차곡. 바로 위에 왔을 때 {y}J{/}(또는 Space·E·Enter). 8개.' },
  fish: { name: '부두 낚시', kind: '타이밍', stats: [], pose: 'calm', x: 1736, mech: 'fish', desc: '찌가 쑥 들어가는 순간 {y}J{/}(또는 Space·E·Enter). 다섯 번 던진다. 너무 일찍 당기면 놓친다.' },
  job: { name: '하역 아르바이트', kind: '타이밍', stats: [], pose: 'carry', x: 1830, desc: '크레인이 상자를 옮긴다. 쌓인 상자 바로 위에 왔을 때 {y}J{/}(또는 Space·E·Enter)로 내려놓자. 8개.' },
};
// how each game is played, when a station's grade plays it instead of its own game
const MECH_DESC = {
  bench: '바늘이 초록 칸에 들어왔을 때 {y}J{/}. 8번 들어 올리자. 세 번 놓치면 끝.',
  rope: '원이 줄어들어 고리에 닿는 순간 {y}W{/}(또는 J·Space). 박자를 타자.',
  bridge: '흔들리는 바늘을 {y}A D{/}(또는 ←→)로 가운데에 붙잡아 두자.',
  breath: '{y}J{/}(또는 Space)를 누르고 있으면 차오른다. 초록 띠에서 손을 떼자. 5번.',
  typing: '화면의 글자를 순서대로 쳐라. 제한 시간 안에 많이 칠수록 많이 든다.',
  rhythm: '떨어지는 박자가 선에 닿는 순간 그 줄의 키를 눌러라.',
  snake: '{y}W A S D{/}로 방향을 바꿔 목표를 밟아라. 벽이나 내 발에 걸리면 끝.',
  mash: '{y}J{/}를 연타해 게이지를 꼭대기까지 밀어 올려라. 손을 쉬면 내려온다. 3세트.',
  react: '화살표가 뜨는 순간 그 방향({y}W A S D{/})을 눌러라. 빠를수록 좋다. 일찍 누르면 실수.',
};

export class Training {
  constructor(W, id, cost) {
    this.W = W; this.game = W.game; this.c = W.c; this.id = id; this.G = GAMES[id]; this.tier = GEAR[id] ? tierOf(W.c.d, id) : 0; this.T = (GEAR[id] && gearNow(W.c.d, id)) || {}; this.mech = this.T.mech || GAMES[id].mech || id; this.cost = cost; this.phase = 'intro'; this.t = 0; this.score = 0; this.rng = new RNG(Date.now() & 0xffff); this.fx = [];
    this.savedStance = W.player.stance; this.savedX = W.player.x;
    W.player.x = this.G.x + (id === 'bench' ? 0 : 0);
    if (id === 'mitt') { W.player.x = this.G.x - 30; W.player.face = 1; }
  }
  close() { this.W.player.stance = this.savedStance; this.W.closeTop(); }
  start() {
    const c = this.c;
    if (this.cost && !c.pay(this.cost)) { this.W.toast('돈이 모자란다', '#ff8a8a'); this.close(); return; }
    this.phase = 'play'; this.t = 0; this.W.player.stance = this.G.pose;
    const r = this.rng;
    switch (this.mech) {
      case 'bench': this.s = { needle: 0, dir: 1, speed: .9, zone: [.4, .62], reps: 0, miss: 0, hits: 0, perfect: 0, lift: 0 }; this.newZone(); break;
      case 'rope': { const gp = this.T.gap || .5; this.s = { beats: Array.from({ length: 20 }, (_, i) => 1.4 + i * gp + (i > 9 ? -(i - 9) * .03 : 0)), idx: 0, good: 0, perfect: 0, hit: [] }; break; }
      case 'mitt': this.s = { round: 0, len: this.T.len || 3, seq: [], show: 0, input: [], ok: 0, phase: 'show', st: 0 }; this.newSeq(); break;
      case 'bridge': this.s = { pos: 0, vel: 0, inZone: 0, drift: 0, force: this.T.force || 1, time: this.T.time || 10 }; break;
      case 'breath': this.s = { fill: 0, round: 0, good: 0, band: [.72, .86], holding: false, done: [], armed: false, k: this.T.fill || 1 }; break;
      case 'typing': this.s = { word: this.newWord(), pos: 0, typed: 0, miss: 0, left: this.T.time || 12, target: this.T.target || 16 }; break;
      case 'rhythm': { const n = this.T.notes || 22, gp = .58 / (this.T.speed || 1), lanes = this.T.lanes || 3; this.s = { lanes, keys: lanes === 4 ? ['left', 'down', 'atk', 'grab'] : ['atk', 'grab', 'dodge'], notes: Array.from({ length: n }, (_, i) => ({ t: 1.8 + i * gp + (r.next() < .2 ? gp * .5 : 0), lane: r.int(0, lanes - 1), done: 0 })), fall: 1.3 / (this.T.speed || 1), good: 0, perfect: 0, miss: 0 }; break; }
      case 'snake': { this.s = { w: 22, h: 9, body: [[5, 4], [4, 4], [3, 4]], dir: [1, 0], want: [1, 0], step: this.T.step || .15, st: 0, eaten: 0, target: this.T.target || 8, left: 30, dead: 0 }; this.newFood(); break; }
      case 'job': this.s = { craneX: 0, dir: 1, speed: 120, stack: [], drop: null, n: 0, good: 0, money: 0 }; break;
      case 'fish': this.s = { cast: 0, wait: 1.2 + r.next() * 2.4, bite: 0, st: 0, small: 0, big: 0, log: [], state: 'wait' }; break;
      case 'mash': { const k = this.T.k || 1; this.s = { fill: 0, set: 0, sets: 3, done: 0, left: 4.5, decay: .5 * k, add: .085 / k, best: 0, armed: false }; break; }
      case 'react': this.s = { n: 0, total: this.T.total || 12, cue: null, wait: .8 + r.next() * .8, win: this.T.win || .8, hits: 0, fast: 0, miss: 0 }; break;
    }
    void r;
  }
  newZone() { const s = this.s, w = (.22 - s.reps * .015) * (this.T.zone || 1), c = .2 + this.rng.next() * .6; s.zone = [clamp(c - w / 2, 0, 1 - w), clamp(c + w / 2, w, 1)]; s.speed = (.9 + s.reps * .14) * (this.T.speed || 1); }
  // typing: a word of letters to type, as many letters as you can before the time runs out
  nextCast() { const s = this.s; s.cast++; s.state = 'wait'; s.st = 0; s.wait = 1.2 + this.rng.next() * 2.4; }
  newWord() { const A = 'ABCDFGHIJKLNORSTUVXYZ', n = this.T.len || 4 + Math.floor(this.rng.next() * 2); return Array.from({ length: n }, () => A[Math.floor(this.rng.next() * A.length)]).join(''); }
  // snake: a mitt somewhere off the body
  newFood() { const s = this.s; for (let k = 0; k < 50; k++) { const f = [1 + Math.floor(this.rng.next() * (s.w - 2)), 1 + Math.floor(this.rng.next() * (s.h - 2))]; if (!s.body.some(b => b[0] === f[0] && b[1] === f[1])) { s.food = f; return; } } s.food = [1, 1]; }
  newSeq() { const s = this.s; s.seq = Array.from({ length: s.len }, () => this.rng.pick(['up', 'left', 'down', 'right'])); s.show = 0; s.input = []; s.phase = 'show'; s.st = 0; }
  pop(text, col, x = 320, y = 150) { this.fx.push({ text, col, x, y, t: 0 }); }
  finish(score) {
    this.score = clamp(score, 0, 1); this.phase = 'result'; this.t = 0;
    const c = this.c, d = c.d;
    const grade = this.score >= .9 ? 'S' : this.score >= .75 ? 'A' : this.score >= .5 ? 'B' : 'C';
    this.grade = grade;
    const fatK = d.fatigue > 70 ? .5 : d.fatigue > 40 ? .8 : 1;
    this.gains = [];
    if (this.id === 'scrap') { this.helpPts = { S: 3, A: 3, B: 2, C: 1 }[grade]; d.fatigue = Math.min(100, d.fatigue + 8); }
    else if (this.id === 'cleanup') { d.fatigue = Math.min(100, d.fatigue + 8); }
    else if (this.id === 'fish') { d.items.fish = (d.items.fish || 0) + this.s.small; d.items.bigFish = (d.items.bigFish || 0) + this.s.big; d.fatigue = Math.min(100, d.fatigue + 4); }
    else if (this.id === 'job') {
      const pay = Math.round((6000 + this.s.good * 1800 + d.season * 1000) / 500) * 500;
      c.earn(pay); this.pay = pay; d.fatigue = Math.min(100, d.fatigue + 15);
    } else {
      const tb = d.buffs && d.buffs.train || 1;
      const g = { S: 1, A: .7, B: .45, C: .25 }[grade] * fatK * tb * gainK(d, this.id);
      const G2 = gymOf(d); G2.runs[this.id] = (G2.runs[this.id] || 0) + 1;
      if (d.buffs && d.buffs.train) { delete d.buffs.train; this.boosted = 1; }
      for (const k of this.G.stats) { const before = d.lv[k]; d.lv[k] = Math.min(20, d.lv[k] + g); this.gains.push([k, d.lv[k] - before]); }
      d.fatigue = Math.min(100, d.fatigue + tireOf(d, this.id));
      this.fatK = fatK;
    }
    this.msgs = c.spendSlot(1);
    c.save();
    this.game.audio.sfx(grade === 'S' || grade === 'A' ? 'good' : 'ok');
  }
  update(dt) {
    this.t += dt;
    const inp = this.game.input, A = this.game.audio;
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter(f => f.t < .8);
    if (this.phase === 'intro') { if (inp.menuPressed('confirm')) { A.sfx('ok'); this.start(); } else if (inp.menuPressed('cancel')) { A.sfx('back'); this.close(); } return; }
    if (this.phase === 'result') { if (this.t > .5 && (inp.menuPressed('confirm') || inp.menuPressed('cancel'))) { (this.msgs || []).forEach(m => this.W.toast(m, '#ffb347')); this.close(); if (GEAR[this.id] && outgrown(this.c.d, this.id, this.G.stats)) this.W.gearPitch(this.id); if (this.id === 'scrap') this.W.beggarHelped(this.helpPts || 1); if (this.id === 'cleanup') this.W.brLobbyFixed(); } return; }
    const s = this.s;
    switch (this.mech) {
      case 'bench': {
        s.needle += s.dir * s.speed * dt; if (s.needle > 1) { s.needle = 1; s.dir = -1; } if (s.needle < 0) { s.needle = 0; s.dir = 1; }
        s.lift = Math.max(0, s.lift - dt * 2);
        if (inp.actPressed()) {
          const [a, b] = s.zone, inZ = s.needle >= a && s.needle <= b, mid = (a + b) / 2;
          if (inZ) { s.hits++; s.reps++; s.lift = 1; const p = Math.abs(s.needle - mid) < (b - a) * .18; if (p) s.perfect++; this.pop(p ? '완벽!' : '좋아!', p ? '#ffd65a' : '#6be38a'); A.sfx(p ? 'good' : 'stat'); this.newZone(); }
          else { s.miss++; s.reps++; this.pop('놓쳤다…', '#ff8a8a'); A.sfx('miss'); }
          if (s.reps >= 8 || s.miss >= 3) this.finish((s.hits + s.perfect * .25) / 8);
        }
        break;
      }
      case 'rope': {
        const T = this.t, b = s.beats[s.idx];
        if (b == null) { this.finish((s.good + s.perfect * .3) / s.beats.length); break; }
        if (inp.pressed('up') || inp.actPressed()) {
          const e = Math.abs(T - b);
          if (e < .07) { s.perfect++; s.good++; this.pop('완벽!', '#ffd65a', 320, 130); A.sfx('good'); s.idx++; this.W.player.vy = -160; this.W.player.ground = false; }
          else if (e < .15) { s.good++; this.pop('좋아', '#6be38a', 320, 130); A.sfx('tick'); s.idx++; this.W.player.vy = -140; this.W.player.ground = false; }
          else if (T < b - .15) { this.pop('너무 빨라', '#ff8a8a', 320, 130); A.sfx('miss'); }
        }
        if (T > b + .15) { this.pop('걸렸다!', '#ff8a8a', 320, 130); A.sfx('miss'); s.idx++; }
        if (Math.floor(T * 2) !== Math.floor((T - dt) * 2)) A.sfx('tick');
        break;
      }
      case 'mitt': {
        s.st += dt;
        if (s.phase === 'show') { if (s.st > .55) { s.st = 0; s.show++; if (s.show >= s.seq.length) { s.phase = 'input'; s.st = 0; } else A.sfx('ui', { pitch: 1 + s.show * .1 }); } }
        else if (s.phase === 'input') {
          for (const k of ['up', 'left', 'down', 'right']) if (inp.pressed(k)) {
            const ok = s.seq[s.input.length] === k;
            s.input.push(k);
            this.W.player.stance = 'mitt'; this.W.player.exprT = .2; this.W.player.expr = 'fierce';
            A.sfx(ok ? 'punch1' : 'miss');
            if (!ok) { this.pop('틀렸다!', '#ff8a8a'); s.phase = 'wait'; s.st = 0; s.fail = 1; break; }
            if (s.input.length === s.seq.length) { s.ok++; this.pop('정확해!', '#6be38a'); s.phase = 'wait'; s.st = 0; s.fail = 0; }
          }
          if (s.st > 6) { s.phase = 'wait'; s.st = 0; s.fail = 1; this.pop('시간 초과', '#ff8a8a'); }
        } else if (s.phase === 'wait' && s.st > .7) {
          s.round++;
          if (s.round >= 5) { this.finish(s.ok / 5); break; }
          if (!s.fail) s.len = Math.min(7, s.len + 1);
          this.newSeq();
        }
        break;
      }
      case 'bridge': {
        const T = this.t * s.force;
        s.drift += (this.rng.next() - .5) * dt * 6;
        s.drift = clamp(s.drift, -1.4, 1.4);
        const force = s.drift + Math.sin(T * 1.7) * .9 + Math.sin(T * 3.1 + 1) * .4 + (T / 10) * Math.sign(s.pos || 1) * .6;
        const ctl = (inp.down('right') ? 1 : 0) - (inp.down('left') ? 1 : 0);
        s.vel += (force * .9 + ctl * 2.6 - s.vel * 1.2) * dt;
        s.pos = clamp(s.pos + s.vel * dt, -1, 1);
        if (Math.abs(s.pos) < .25) s.inZone += dt;
        if (Math.abs(s.pos) >= 1) { this.pop('무너졌다!', '#ff8a8a'); this.finish(s.inZone / s.time * .8); break; }
        if (this.t >= s.time) this.finish(s.inZone / s.time);
        break;
      }
      case 'breath': {
        if (!s.armed) { if (!inp.actDown()) s.armed = true; break; }   // ignore the press that started the game
        const hold = inp.actDown();
        if (hold) { s.holding = true; s.fill = Math.min(1.05, s.fill + dt * (.55 + s.round * .08) * s.k); }
        else if (s.holding) {
          s.holding = false;
          const [a, b] = s.band, ok = s.fill >= a && s.fill <= b;
          if (ok) { s.good++; this.pop('깊은 호흡!', '#6be38a'); A.sfx('good'); } else { this.pop(s.fill < a ? '얕다' : '너무 참았다', '#ff8a8a'); A.sfx('miss'); }
          s.done.push(ok); s.round++; s.fill = 0;
          const w = (.14 - s.round * .012) * (this.T.band || 1), c = .62 + this.rng.next() * .22; s.band = [c - w / 2, c + w / 2];
          if (s.round >= 5) this.finish(s.good / 5);
        }
        if (s.fill >= 1.05) { s.holding = false; s.done.push(false); s.round++; s.fill = 0; this.pop('숨이 막힌다!', '#ff8a8a'); A.sfx('miss'); if (s.round >= 5) this.finish(s.good / 5); }
        break;
      }
      case 'typing': {
        s.left -= dt;
        for (let i = 0; i < 26; i++) { const ch = String.fromCharCode(65 + i); if (!inp.rawPressed('Key' + ch)) continue;
          if (ch === s.word[s.pos]) { s.pos++; s.typed++; A.sfx('type'); this.W.player.vy = -60; if (s.pos >= s.word.length) { this.pop('들어 올렸다!', '#6be38a', 320, 132); A.sfx('stat'); s.word = this.newWord(); s.pos = 0; } }
          else { s.miss++; s.pos = 0; this.pop('삐끗!', '#ff8a8a', 320, 132); A.sfx('miss'); } }
        if (s.left <= 0) this.finish(s.typed / s.target - s.miss * .02);
        break;
      }
      case 'rhythm': {
        const T = this.t;
        s.keys.forEach((k, lane) => { if (!inp.pressed(k)) return; const n = s.notes.filter(o => !o.done && o.lane === lane).sort((a, b) => Math.abs(a.t - T) - Math.abs(b.t - T))[0]; const e = n ? Math.abs(n.t - T) : 9;
          if (e < .07) { n.done = 2; s.perfect++; s.good++; this.pop('완벽!', '#ffd65a', 232 + lane * 176 / (s.lanes - 1), 150); A.sfx('good'); this.W.player.vy = -150; this.W.player.ground = false; }
          else if (e < .15) { n.done = 1; s.good++; this.pop('좋아', '#6be38a', 232 + lane * 176 / (s.lanes - 1), 150); A.sfx('tick'); }
          else { s.miss++; A.sfx('miss'); } });
        for (const n of s.notes) if (!n.done && T > n.t + .15) { n.done = -1; s.miss++; }
        if (s.notes.every(n => n.done)) this.finish((s.good + s.perfect * .3) / s.notes.length - s.miss * .01);
        break;
      }
      case 'snake': {
        s.left -= dt;
        const turn = inp.pressed('up') ? [0, -1] : inp.pressed('down') ? [0, 1] : inp.pressed('left') ? [-1, 0] : inp.pressed('right') ? [1, 0] : null;
        if (turn && !(turn[0] === -s.dir[0] && turn[1] === -s.dir[1])) s.want = turn;
        s.st += dt;
        while (s.st >= s.step && !s.dead) {
          s.st -= s.step; s.dir = s.want;
          const h = [s.body[0][0] + s.dir[0], s.body[0][1] + s.dir[1]];
          if (h[0] < 0 || h[1] < 0 || h[0] >= s.w || h[1] >= s.h || s.body.some(b => b[0] === h[0] && b[1] === h[1])) { s.dead = 1; this.pop('발이 꼬였다!', '#ff8a8a'); A.sfx('miss'); break; }
          s.body.unshift(h);
          if (h[0] === s.food[0] && h[1] === s.food[1]) { s.eaten++; this.pop('퍽!', '#ffd65a', 160 + h[0] * 15, 70 + h[1] * 15); A.sfx('punch1'); this.newFood(); } else s.body.pop();
        }
        if (s.dead || s.left <= 0 || s.eaten >= s.target) this.finish(s.eaten / s.target);
        break;
      }
      case 'fish': {
        s.st += dt;
        if (s.state === 'wait') { if (inp.actPressed()) { this.pop('너무 일찍 당겼다', '#ff8a8a', 320, 120); A.sfx('miss'); s.log.push('-'); this.nextCast(); } else if (s.st >= s.wait) { s.state = 'bite'; s.st = 0; A.sfx('splash'); } }
        else if (s.state === 'bite') { if (inp.actPressed()) { const k = this.rng.next(), big = k > .93, name = big ? '참치' : k > .65 ? '도미' : '고등어'; if (big) s.big++; else s.small++; s.log.push(name); this.pop(`${name}!`, big ? '#ffd65a' : '#6be38a', 320, 120); A.sfx(big ? 'good' : 'stat'); this.nextCast(); } else if (s.st > .45) { this.pop('놓쳤다…', '#ff8a8a', 320, 120); A.sfx('miss'); s.log.push('-'); this.nextCast(); } }
        if (s.cast >= 5) this.finish((s.small + s.big * 2) / 5);
        break;
      }
      case 'mash': {   // three sets: push the bar to the top before the clock runs out; it sinks when you rest
        if (!s.armed) { if (!inp.actDown()) s.armed = true; break; }
        s.left -= dt; s.fill = Math.max(0, s.fill - s.decay * dt);
        if (inp.actPressed()) { s.fill += s.add; this.W.player.vy = -40; A.sfx('tick', { pitch: .8 + s.fill * .6 }); }
        s.best = Math.max(s.best, s.fill);
        const next = ok => { if (ok) s.done++; s.set++; s.fill = 0; s.best = 0; s.left = 4.5; if (s.set >= s.sets) this.finish(s.done / s.sets + (ok ? 0 : s.part || 0)); };
        if (s.fill >= 1) { this.pop('들어 올렸다!', '#6be38a'); A.sfx('stat'); next(true); }
        else if (s.left <= 0) { s.part = s.best / s.sets * .5; this.pop('힘이 빠졌다…', '#ff8a8a'); A.sfx('miss'); next(false); }
        break;
      }
      case 'react': {   // an arrow, then the same direction as fast as you can; pressing before it shows is a slip
        const keys = ['up', 'left', 'down', 'right'], pressed = keys.find(k => inp.pressed(k));
        if (!s.cue) {
          s.wait -= dt;
          if (pressed) { s.miss++; this.pop('너무 빨라', '#ff8a8a', 320, 128); A.sfx('miss'); }
          if (s.wait <= 0) { s.cue = { dir: this.rng.pick(keys), t: 0 }; A.sfx('ui', { pitch: 1.3 }); }
        } else {
          s.cue.t += dt;
          const end = msg => { s.n++; s.cue = null; s.wait = .45 + this.rng.next() * .9; if (msg) this.pop(msg[0], msg[1], 320, 128); if (s.n >= s.total) this.finish((s.hits + s.fast * .25) / s.total - s.miss * .03); };
          if (pressed) {
            if (pressed === s.cue.dir) { const quick = s.cue.t < s.win * .5; s.hits++; if (quick) s.fast++; this.W.player.stance = 'mitt'; this.W.player.expr = 'fierce'; this.W.player.exprT = .2; A.sfx(quick ? 'punch2' : 'punch1'); end(quick ? ['번개!', '#ffd65a'] : ['좋아', '#6be38a']); }
            else { s.miss++; A.sfx('miss'); end(['반대야!', '#ff8a8a']); }
          } else if (s.cue.t > s.win) { A.sfx('miss'); end(['늦었다', '#ff8a8a']); }
        }
        break;
      }
      case 'job': {
        if (!s.drop) {
          s.craneX += s.dir * s.speed * dt; if (s.craneX > 140) { s.craneX = 140; s.dir = -1; } if (s.craneX < -140) { s.craneX = -140; s.dir = 1; }
          if (inp.actPressed()) { s.drop = { x: s.craneX, y: 0, vy: 0 }; A.sfx('whoosh'); }
        } else {
          s.drop.vy += 900 * dt; s.drop.y += s.drop.vy * dt;
          const top = 150 - s.stack.length * 18;
          if (s.drop.y >= top) {
            const base = s.stack.length ? s.stack[s.stack.length - 1] : 0, off = Math.abs(s.drop.x - base);
            if (off < 34) { s.stack.push(s.drop.x); s.good += off < 10 ? 1.3 : 1; this.pop(off < 10 ? '딱 맞다!' : '좋아', off < 10 ? '#ffd65a' : '#6be38a', 320 + s.drop.x, 120); A.sfx('thud'); }
            else { this.pop('떨어졌다!', '#ff8a8a', 320 + s.drop.x, 120); A.sfx('miss'); }
            s.drop = null; s.n++; s.speed += 18;
            if (s.n >= 8 || s.stack.length >= 7) this.finish(s.good / 8);
          }
        }
        break;
      }
    }
  }
  draw(u) {
    const G = this.G, s = this.s;
    fade(u, this.phase === 'play' ? .25 : .5);
    const big = this.phase === 'play' && (this.mech === 'rhythm' || this.mech === 'snake');
    panel(u, 120, 40, 400, this.phase === 'play' ? (big ? 210 : 120) : 200, { accent: this.tier ? '#49d6ff' : '#ffd65a', alpha: .94 });
    drawText(u, `${G.name} · ${this.T.name && this.tier ? this.T.name + ' · ' : ''}${(GEAR[this.id] && MECH_NAME[this.mech]) || G.kind}`, 320, 48, { align: 'c', color: this.tier ? '#49d6ff' : '#ffd65a', bold: true });
    if (this.phase === 'intro') {
      const own = this.mech === this.id || !MECH_DESC[this.mech];
      if (!own) drawText(u, `${MECH_NAME[this.mech]} 훈련 — 이 기구는 방식이 다르다`, 320, 62, { size: 11, align: 'c', color: '#9be3ff' });
      drawText(u, own ? G.desc : MECH_DESC[this.mech], 320, 78, { size: 11, align: 'c', color: '#eef2ff' });
      if (G.stats.length) drawText(u, '오르는 능력치: ' + G.stats.map(k => STAT_GROWTH[k][1]).join(', '), 320, 98, { size: 11, align: 'c', color: '#6be38a' });
      else if (this.id === 'fish') drawText(u, '잡은 생선은 레슬러에게 선물하면 호감도가 오른다. 시간 1칸 · 피로 +4', 320, 98, { size: 11, align: 'c', color: '#6be38a' });
      else drawText(u, this.id === 'cleanup' ? '돈은 안 되지만 로비와 훈련장이 다시 열린다. 시간이 한 칸 지나고 피로가 조금 쌓인다.' : this.id === 'scrap' ? '돈은 안 되지만 영감이 고마워한다. 시간이 한 칸 지나고 피로가 조금 쌓인다.' : '부상 없이 돈을 벌 수 있다. 피로가 쌓이고 시간이 한 칸 지난다.', 320, 98, { size: 11, align: 'c', color: '#9be36b' });
      drawText(u, this.cost ? `훈련비 ${fmtMoney(this.cost)} · 시간 1칸 · 피로 +${tireOf(this.c.d, this.id)}${this.tier ? ` · 효과 ×${gainK(this.c.d, this.id).toFixed(1)}` : ''}` : this.id === 'scrap' || this.id === 'cleanup' ? '시간 1칸 · 피로 +8' : '시간 1칸 · 피로 +15', 320, 116, { size: 11, align: 'c', color: UI.dim });
      if (this.c.d.fatigue > 40) drawText(u, `피로 ${Math.round(this.c.d.fatigue)}: 훈련 효과 ${this.c.d.fatigue > 70 ? '50%' : '80%'}`, 320, 134, { size: 11, align: 'c', color: '#ff8a8a' });
      prompt(u, ['Enter'], '시작', 270, 210, {}); prompt(u, ['Esc'], '그만두기', 350, 210, {});
      return;
    }
    if (this.phase === 'result') {
      drawText(u, this.grade, 320, 74, { scale: 4, align: 'c', color: { S: '#ffd65a', A: '#6be38a', B: '#49d6ff', C: '#c9d4ff' }[this.grade], bold: true, outline: '#05060f' });
      if (this.id === 'scrap') drawText(u, `영감이 고개를 꾸벅 숙였다. (도움 +${this.helpPts})`, 320, 140, { align: 'c', color: '#ffd65a' });
      else if (this.id === 'cleanup') drawText(u, '로비가 다시 반짝인다. 김 반장이 엄지를 들었다.', 320, 140, { align: 'c', color: '#9be36b' });
      else if (this.id === 'job') drawText(u, `일당 ${fmtMoney(this.pay)}을 받았다!`, 320, 140, { align: 'c', color: UI.money });
      else if (this.id === 'fish') drawText(u, `생선 ${this.s.small + this.s.big}마리${this.s.big ? ` (참치 ${this.s.big})` : ''} — 레슬러에게 선물할 수 있다`, 320, 140, { align: 'c', color: '#9be3ff' });
      else this.gains.forEach(([k, g], i) => drawText(u, `${STAT_GROWTH[k][1]} Lv +${g.toFixed(2)}  (Lv ${this.c.d.lv[k].toFixed(1)})`, 320, 136 + i * 16, { size: 11, align: 'c', color: '#6be38a' }));
      if (this.fatK && this.fatK < 1) drawText(u, '피곤해서 효과가 줄었다…', 320, 172, { size: 11, align: 'c', color: '#ff8a8a' });
      if (this.boosted) drawText(u, '단백질 셰이크 효과 +15%!', 320, 186, { size: 11, align: 'c', color: '#6be38a' });
      prompt(u, ['Enter'], '확인', 320, 212, { align: 'c' });
      return;
    }
    switch (this.mech) {
      case 'bench': {
        const x = 160, y = 90, w = 320;
        rect(u, '#05060f', x - 1, y - 1, w + 2, 18); rect(u, '#1a1d33', x, y, w, 16);
        rect(u, '#2a8a4a', x + w * s.zone[0], y, w * (s.zone[1] - s.zone[0]), 16); rect(u, '#6be38a', x + w * (s.zone[0] + s.zone[1]) / 2 - 1, y, 2, 16);
        rect(u, '#ffffff', x + w * s.needle - 1, y - 4, 3, 24);
        drawText(u, `반복 ${s.reps}/8 · 놓침 ${s.miss}/3`, 320, 118, { size: 11, align: 'c', color: UI.dim });
        keycap(u, 'J', 314, 134);
        break;
      }
      case 'rope': {
        const b = s.beats[s.idx];
        if (b != null) { const k = clamp((b - this.t) / .9, 0, 1), r = 8 + k * 40; u.strokeStyle = '#ffd65a'; u.lineWidth = 2; u.beginPath(); u.arc(320, 100, 8, 0, 7); u.stroke(); u.strokeStyle = mixHex('#49d6ff', '#ffffff', 1 - k); u.beginPath(); u.arc(320, 100, r, 0, 7); u.stroke(); }
        drawText(u, `${s.idx}/${s.beats.length} · 성공 ${s.good}`, 320, 134, { size: 11, align: 'c', color: UI.dim });
        keycap(u, 'W', 380, 92);
        break;
      }
      case 'mitt': {
        const A2 = { up: '↑', left: '←', down: '↓', right: '→' };
        if (s.phase === 'show') { const k = s.seq[Math.min(s.show, s.seq.length - 1)]; if (s.st < .4) drawText(u, A2[k], 320, 78, { scale: 3, align: 'c', color: '#ffd65a', bold: true }); drawText(u, '순서를 기억하라!', 320, 128, { size: 11, align: 'c', color: UI.dim }); }
        else { s.seq.forEach((k, i) => { const x = 320 - (s.seq.length - 1) * 16 + i * 32; const done = i < s.input.length; rect(u, done ? (s.input[i] === k ? '#2a6a3a' : '#7a1f2a') : '#1a1d33', x - 13, 80, 26, 26); drawText(u, done ? A2[s.input[i]] : '?', x, 86, { align: 'c', color: '#ffffff' }); }); drawText(u, `라운드 ${s.round + 1}/5 · W A S D로 입력`, 320, 128, { size: 11, align: 'c', color: UI.dim }); }
        break;
      }
      case 'bridge': {
        const x = 160, w = 320, y = 92;
        rect(u, '#1a1d33', x, y, w, 14); rect(u, '#2a8a4a', x + w * .375, y, w * .25, 14);
        rect(u, '#ffffff', x + w * (s.pos + 1) / 2 - 1, y - 5, 3, 24);
        gauge(u, 200, 124, 240, 5, this.t / 10, 'fin', {});
        drawText(u, `버틴 시간 ${s.inZone.toFixed(1)}초`, 320, 134, { size: 11, align: 'c', color: UI.dim });
        break;
      }
      case 'breath': {
        const x = 300, y = 66, h = 80;
        rect(u, '#1a1d33', x, y, 40, h); rect(u, '#2a8a4a', x, y + h * (1 - s.band[1]), 40, h * (s.band[1] - s.band[0]));
        rect(u, '#49d6ff', x + 4, y + h * (1 - Math.min(1, s.fill)), 32, h * Math.min(1, s.fill));
        drawText(u, `${s.round}/5 · 성공 ${s.good}`, 400, 100, { size: 11, color: UI.dim }); keycap(u, 'J', 250, 100);
        break;
      }
      case 'typing': {
        const w = s.word, cw = 26, x0 = 320 - (w.length - 1) * cw / 2;
        for (let i = 0; i < w.length; i++) { const done = i < s.pos; rect(u, '#05060f', x0 + i * cw - 12, 70, 24, 26); rect(u, done ? '#2a6a3a' : i === s.pos ? '#3a4a8a' : '#1a1d33', x0 + i * cw - 11, 71, 22, 24); drawText(u, w[i], x0 + i * cw, 76, { align: 'c', color: done ? '#9be36b' : '#ffffff', bold: true }); }
        gauge(u, 200, 104, 240, 5, Math.max(0, s.left) / (this.T.time || 12), 'fin', {});
        drawText(u, `${s.typed}/${s.target}자 · 틀림 ${s.miss} · 남은 ${Math.max(0, s.left).toFixed(1)}초`, 320, 116, { size: 11, align: 'c', color: UI.dim });
        break;
      }
      case 'rhythm': {
        const L = s.lanes, x0 = 232, gapX = 176 / (L - 1), line = 214, top = 68, T = this.t;
        for (let i = 0; i < L; i++) { const x = x0 + i * gapX; rect(u, '#141a36', x - 18, top, 36, line - top + 12); rect(u, '#2a3150', x - 18, line - 1, 36, 3); keycap(u, this.game.input.label(s.keys[i]), x - 6, line + 8); }
        for (const n of s.notes) { if (n.done) continue; const k = (n.t - T) / s.fall; if (k < 0 || k > 1) continue; const x = x0 + n.lane * gapX, y = line - k * (line - top); rect(u, '#05060f', x - 15, y - 5, 30, 10); rect(u, ['#ffd65a', '#49d6ff', '#ff8fc4', '#6be38a'][n.lane], x - 14, y - 4, 28, 8); }
        drawText(u, `성공 ${s.good} · 놓침 ${s.miss}`, 320, 238, { size: 11, align: 'c', color: UI.dim });
        break;
      }
      case 'snake': {
        const c = 15, x0 = 320 - s.w * c / 2, y0 = 66;
        rect(u, '#05060f', x0 - 2, y0 - 2, s.w * c + 4, s.h * c + 4); rect(u, '#141a36', x0, y0, s.w * c, s.h * c);
        for (let x = 0; x < s.w; x++) for (let y = 0; y < s.h; y++) if ((x + y) % 2) rect(u, '#171e3e', x0 + x * c, y0 + y * c, c, c);
        rect(u, '#c2333f', x0 + s.food[0] * c + 2, y0 + s.food[1] * c + 2, c - 4, c - 4); rect(u, '#ffd65a', x0 + s.food[0] * c + 5, y0 + s.food[1] * c + 5, c - 10, c - 10);
        s.body.forEach((b, i) => rect(u, i ? '#3fb0c0' : '#9be3ff', x0 + b[0] * c + 1, y0 + b[1] * c + 1, c - 2, c - 2));
        drawText(u, `미트 ${s.eaten}/${s.target} · 남은 ${Math.max(0, s.left).toFixed(0)}초 · W A S D로 방향`, 320, y0 + s.h * c + 6, { size: 11, align: 'c', color: UI.dim });
        break;
      }
      case 'fish': {
        rect(u, '#10204a', 160, 92, 320, 40); for (let x = 160; x < 480; x += 8) rect(u, '#2a4a8a', x + Math.round(Math.sin(this.t * 2 + x) * 2), 96 + (x % 3) * 9, 5, 1);
        const bob = s.state === 'bite' ? 10 : Math.round(Math.sin(this.t * 3) * 1.5); rect(u, '#05060f', 317, 96 + bob, 7, 9); rect(u, '#ff5b5b', 318, 97 + bob, 5, 4); rect(u, '#ffffff', 318, 101 + bob, 5, 3);
        if (s.state === 'bite') drawText(u, '지금!', 320, 70, { align: 'c', color: '#ffd65a', bold: true });
        drawText(u, `${s.cast}/5 · ${s.log.join(' ')}`, 320, 138, { size: 11, align: 'c', color: UI.dim });
        break;
      }
      case 'mash': {
        const x = 304, y = 62, h = 84, k = Math.min(1, s.fill);
        rect(u, '#05060f', x - 2, y - 2, 36, h + 4); rect(u, '#1a1d33', x, y, 32, h); rect(u, '#ffd65a', x, y, 32, 2);
        rect(u, k > .8 ? '#6be38a' : '#49d6ff', x + 3, y + h * (1 - k), 26, h * k);
        drawText(u, `세트 ${Math.min(s.set + 1, s.sets)}/${s.sets} · 성공 ${s.done}`, 400, 86, { size: 11, color: UI.dim });
        drawText(u, `남은 ${Math.max(0, s.left).toFixed(1)}초`, 400, 102, { size: 11, color: s.left < 1.5 ? '#ff8a8a' : UI.dim });
        keycap(u, 'J', 262, 96); drawText(u, '연타!', 250, 80, { size: 11, color: '#ffd65a' });
        break;
      }
      case 'react': {
        const A2 = { up: '↑', left: '←', down: '↓', right: '→' };
        rect(u, '#05060f', 292, 66, 56, 56); rect(u, s.cue ? '#26315f' : '#141a36', 294, 68, 52, 52);
        if (s.cue) { drawText(u, A2[s.cue.dir], 320, 76, { scale: 3, align: 'c', color: '#ffd65a', bold: true }); gauge(u, 294, 124, 52, 3, 1 - s.cue.t / s.win, 'fin', { col: '#ffd65a' }); }
        else drawText(u, '…', 320, 86, { align: 'c', color: UI.dim });
        drawText(u, `${s.n}/${s.total} · 성공 ${s.hits} (번개 ${s.fast}) · 실수 ${s.miss}`, 320, 142, { size: 11, align: 'c', color: UI.dim });
        break;
      }
      case 'job': {
        const base = 320, gy = 150;
        rect(u, '#3a3a52', base - 160, 64, 320, 3);
        const cx = base + (s.drop ? s.drop.x : s.craneX);
        rect(u, '#ffb52e', base + s.craneX - 6, 60, 12, 8);
        if (!s.drop) { rect(u, '#1a1d33', base + s.craneX, 68, 1, 10); rect(u, '#c2333f', base + s.craneX - 16, 78, 32, 16); }
        else { rect(u, '#c2333f', cx - 16, 78 + s.drop.y - 16, 32, 16); }
        const pal = this.id === 'scrap' ? ['#7a7a8a', '#8a6a4a', '#5a5a66', '#9a8a6a'] : ['#1f8fa6', '#d8a62e', '#35a07a', '#c2333f']; s.stack.forEach((x, i) => { rect(u, '#05060f', base + x - 17, gy - i * 18 - 1, 34, 18); rect(u, pal[i % 4], base + x - 16, gy - i * 18, 32, 16); });
        drawText(u, `${s.n}/8`, 500, 130, { size: 11, color: UI.dim });
        break;
      }
    }
    for (const f of this.fx) { u.globalAlpha = 1 - f.t / .8; drawText(u, f.text, f.x, f.y - f.t * 20, { align: 'c', color: f.col, bold: true, outline: '#05060f' }); u.globalAlpha = 1; }
    void ellipse;
  }
}
export const TRAINING_GAMES = GAMES;
