// Training mini-games (timing, rhythm, memory, balance, breathing) and the dock part-time job.
import { clamp, fmtMoney, RNG } from '../core/util.js';
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
  job: { name: '하역 아르바이트', kind: '타이밍', stats: [], pose: 'carry', x: 1830, desc: '크레인이 상자를 옮긴다. 쌓인 상자 바로 위에 왔을 때 {y}J{/}(또는 Space·E·Enter)로 내려놓자. 8개.' },
};

export class Training {
  constructor(W, id, cost) {
    this.W = W; this.game = W.game; this.c = W.c; this.id = id; this.G = GAMES[id]; this.mech = GAMES[id].mech || id; this.cost = cost; this.phase = 'intro'; this.t = 0; this.score = 0; this.rng = new RNG(Date.now() & 0xffff); this.fx = [];
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
      case 'rope': this.s = { beats: Array.from({ length: 20 }, (_, i) => 1.4 + i * .5 + (i > 9 ? -(i - 9) * .03 : 0)), idx: 0, good: 0, perfect: 0, hit: [] }; break;
      case 'mitt': this.s = { round: 0, len: 3, seq: [], show: 0, input: [], ok: 0, phase: 'show', st: 0 }; this.newSeq(); break;
      case 'bridge': this.s = { pos: 0, vel: 0, inZone: 0, drift: 0 }; break;
      case 'breath': this.s = { fill: 0, round: 0, good: 0, band: [.72, .86], holding: false, done: [], armed: false }; break;
      case 'job': this.s = { craneX: 0, dir: 1, speed: 120, stack: [], drop: null, n: 0, good: 0, money: 0 }; break;
    }
    void r;
  }
  newZone() { const s = this.s, w = .22 - s.reps * .015, c = .2 + this.rng.next() * .6; s.zone = [clamp(c - w / 2, 0, 1 - w), clamp(c + w / 2, w, 1)]; s.speed = .9 + s.reps * .14; }
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
    else if (this.id === 'job') {
      const pay = Math.round((6000 + this.s.good * 1800 + d.season * 1000) / 500) * 500;
      c.earn(pay); this.pay = pay; d.fatigue = Math.min(100, d.fatigue + 15);
    } else {
      const tb = d.buffs && d.buffs.train || 1;
      const g = { S: 1, A: .7, B: .45, C: .25 }[grade] * fatK * tb;
      if (d.buffs && d.buffs.train) { delete d.buffs.train; this.boosted = 1; }
      for (const k of this.G.stats) { const before = d.lv[k]; d.lv[k] = Math.min(20, d.lv[k] + g); this.gains.push([k, d.lv[k] - before]); }
      d.fatigue = Math.min(100, d.fatigue + 14);
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
    if (this.phase === 'result') { if (this.t > .5 && (inp.menuPressed('confirm') || inp.menuPressed('cancel'))) { (this.msgs || []).forEach(m => this.W.toast(m, '#ffb347')); this.close(); if (this.id === 'scrap') this.W.beggarHelped(this.helpPts || 1); if (this.id === 'cleanup') this.W.brLobbyFixed(); } return; }
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
        const T = this.t;
        s.drift += (this.rng.next() - .5) * dt * 6;
        s.drift = clamp(s.drift, -1.4, 1.4);
        const force = s.drift + Math.sin(T * 1.7) * .9 + Math.sin(T * 3.1 + 1) * .4 + (T / 10) * Math.sign(s.pos || 1) * .6;
        const ctl = (inp.down('right') ? 1 : 0) - (inp.down('left') ? 1 : 0);
        s.vel += (force * .9 + ctl * 2.6 - s.vel * 1.2) * dt;
        s.pos = clamp(s.pos + s.vel * dt, -1, 1);
        if (Math.abs(s.pos) < .25) s.inZone += dt;
        if (Math.abs(s.pos) >= 1) { this.pop('무너졌다!', '#ff8a8a'); this.finish(s.inZone / 10 * .8); break; }
        if (T >= 10) this.finish(s.inZone / 10);
        break;
      }
      case 'breath': {
        if (!s.armed) { if (!inp.actDown()) s.armed = true; break; }   // ignore the press that started the game
        const hold = inp.actDown();
        if (hold) { s.holding = true; s.fill = Math.min(1.05, s.fill + dt * (.55 + s.round * .08)); }
        else if (s.holding) {
          s.holding = false;
          const [a, b] = s.band, ok = s.fill >= a && s.fill <= b;
          if (ok) { s.good++; this.pop('깊은 호흡!', '#6be38a'); A.sfx('good'); } else { this.pop(s.fill < a ? '얕다' : '너무 참았다', '#ff8a8a'); A.sfx('miss'); }
          s.done.push(ok); s.round++; s.fill = 0;
          const w = .14 - s.round * .012, c = .62 + this.rng.next() * .22; s.band = [c - w / 2, c + w / 2];
          if (s.round >= 5) this.finish(s.good / 5);
        }
        if (s.fill >= 1.05) { s.holding = false; s.done.push(false); s.round++; s.fill = 0; this.pop('숨이 막힌다!', '#ff8a8a'); A.sfx('miss'); if (s.round >= 5) this.finish(s.good / 5); }
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
    panel(u, 120, 40, 400, this.phase === 'play' ? 120 : 200, { accent: '#ffd65a', alpha: .94 });
    drawText(u, `${G.name} · ${G.kind}`, 320, 48, { align: 'c', color: '#ffd65a', bold: true });
    if (this.phase === 'intro') {
      drawText(u, G.desc, 320, 76, { size: 11, align: 'c', color: '#eef2ff' });
      if (G.stats.length) drawText(u, '오르는 능력치: ' + G.stats.map(k => STAT_GROWTH[k][1]).join(', '), 320, 98, { size: 11, align: 'c', color: '#6be38a' });
      else drawText(u, this.id === 'cleanup' ? '돈은 안 되지만 로비와 훈련장이 다시 열린다. 시간이 한 칸 지나고 피로가 조금 쌓인다.' : this.id === 'scrap' ? '돈은 안 되지만 영감이 고마워한다. 시간이 한 칸 지나고 피로가 조금 쌓인다.' : '부상 없이 돈을 벌 수 있다. 피로가 쌓이고 시간이 한 칸 지난다.', 320, 98, { size: 11, align: 'c', color: '#9be36b' });
      drawText(u, this.cost ? `훈련비 ${fmtMoney(this.cost)} · 시간 1칸 · 피로 +14` : this.id === 'scrap' || this.id === 'cleanup' ? '시간 1칸 · 피로 +8' : '시간 1칸 · 피로 +15', 320, 116, { size: 11, align: 'c', color: UI.dim });
      if (this.c.d.fatigue > 40) drawText(u, `피로 ${Math.round(this.c.d.fatigue)}: 훈련 효과 ${this.c.d.fatigue > 70 ? '50%' : '80%'}`, 320, 134, { size: 11, align: 'c', color: '#ff8a8a' });
      prompt(u, ['Enter'], '시작', 270, 210, {}); prompt(u, ['Esc'], '그만두기', 350, 210, {});
      return;
    }
    if (this.phase === 'result') {
      drawText(u, this.grade, 320, 74, { scale: 4, align: 'c', color: { S: '#ffd65a', A: '#6be38a', B: '#49d6ff', C: '#c9d4ff' }[this.grade], bold: true, outline: '#05060f' });
      if (this.id === 'scrap') drawText(u, `영감이 고개를 꾸벅 숙였다. (도움 +${this.helpPts})`, 320, 140, { align: 'c', color: '#ffd65a' });
      else if (this.id === 'cleanup') drawText(u, '로비가 다시 반짝인다. 김 반장이 엄지를 들었다.', 320, 140, { align: 'c', color: '#9be36b' });
      else if (this.id === 'job') drawText(u, `일당 ${fmtMoney(this.pay)}을 받았다!`, 320, 140, { align: 'c', color: UI.money });
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
