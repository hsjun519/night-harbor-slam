// Chooses a pose for every wrestler each frame: stances, gaits, clips, attack drawings, paired moves, ragdolls.
// Every change of source cross-fades in joint space, so ragdolls and keyframes mix without popping.
import { clamp01, lerp, DEG, sgn } from '../core/util.js';
import { HOLDS } from '../data/moves.js';
import { BALANCE as B } from '../data/balance.js';
import { Joints, JN, POSE_N, J, solveFK, toWorld, pose, poseLerp } from './skeleton.js';
import { STANCES, stancePose, gaitPose, clip, sampleClip, attackPose, hasClip } from './clips.js';
const P3 = new Float32Array(16);
import { evalPaired, pairBuffers } from './paired.js';

const P1 = new Float32Array(POSE_N), P2 = new Float32Array(POSE_N);
const tmpJ = new Joints();
export function pairToWorld(j, face, x, y) {
  const P = j.p;
  for (let i = 0; i < JN; i++) { P[i * 2] = x + P[i * 2] * face; P[i * 2 + 1] += y; }
  j.face *= face;
  if (face < 0) { j.S = -j.S; j.H = -j.H; }
  return j;
}
const CHARGE = { grab: 'sp30 hd-16 a-20/60 b-10/60 t50/70 u10/60', strike: 'sp24 hd-14 a-50/90 b50/110 t46/60 u-6/50', dive: 'sp44 hd-24 a-40/30 b-30/30 t76/104 u40/96', stance: 'sp16 hd-8 a64/40 b84/30 t36/48 u-20/34', quake: 'sp-6 hd-10 a150/30 b156/20 t40/70 u-30/30' };
const LUNGE = { grab: 'sp36 hd-22 a88/4 b94/4 t58/40 u-46/14', strike: 'sp30 hd-16 a-30/80 b80/30 t56/44 u-46/14', quake: 'sp-18 hd-6 a-40/30 b-30/30 t50/40 u-40/10', dive: 'r30 sp20 hd10 a120/40 b130/40 t90/110 u80/110', stance: 'sp16 hd-8 a64/40 b84/30 t36/48 u-20/34' };

export class AnimationSystem {
  constructor(match) { this.m = match; this.buf = pairBuffers(); }
  // ---- transitions ----
  freezeBlend(f, dur) {
    const b = f.blend || (f.blend = { from: new Joints(), t: 0, dur: 0, x: 0, y: 0, on: false });
    b.from.copy(f.joints); b.t = 0; b.dur = dur; b.x = f.x; b.y = f.y; b.on = true;
  }
  changed(f, from, to, opt) {
    const soft = { SEATED: .14, IDLE: .1, MOVE: .1, GUARD: .07, ATTACK: .035, AIR_ATTACK: .05, HITSTUN: .03, STAGGER: .1, JUMP: .05, FALL: .1, DODGE: .05, GET_UP: .16, TAUNT: .1, ROPE: .07, WHIPPED: .08, CLIMB: .12, PERCH: .12, ENTER_RING: .12, EXIT_RING: .12, FINISHER: .08, WIN: .2, HANG: .14, APRON: .12, TAGWAIT: .2, PIN: .2, PINNED: .2, KO: .05, INTRO: .1 };
    if (!((from === 'IDLE' && to === 'MOVE') || (from === 'MOVE' && to === 'IDLE'))) f.clipT = 0;
    f.clipName = opt && opt.clip ? opt.clip : null;
    if (soft[to] && !(opt && opt.noBlend)) this.freezeBlend(f, soft[to]);
    f.overlay = null;
    if (to !== 'GRABBED' && to !== 'WRESTLING_MOVE' && to !== 'COUNTER') f.pelvisLink = null;
  }
  kick(f, name, dur) { f.overlay = { name, t: 0, dur }; }
  kickBody(f, dir) { f.bounce = { t: 0, dir }; }
  // ---- per frame ----
  update(dt) {
    const m = this.m, done = new Set();
    for (const L of m.links) { this.link(L, dt); done.add(L.a); if (L.v) done.add(L.v); }
    for (const f of m.fighters) {
      if (f.gone) continue;
      if (f.pin && f.pin.a === f) { this.pin(f.pin, dt); done.add(f.pin.a); done.add(f.pin.v); }
    }
    for (const f of m.fighters) {
      if (f.gone) continue;
      if (!done.has(f)) this.solo(f, dt);
      this.finish(f, dt);
    }
  }
  link(L, dt) {
    const { a } = L, v = L.v, B2 = this.buf;
    let mv, t;
    if (L.kind === 'hold') {
      mv = this.m.grapple.holdDef(L);
      t = mv.loop ? L.t % mv.dur : Math.min(L.t, mv.dur);
    } else { mv = L.move; t = L.t; }
    const jV = v ? v.joints : tmpJ;
    // walking with somebody on the shoulders: the legs step, the arms keep holding
    let modA = null;
    if (L.kind === 'hold' && L.pos === 'carry' && L.walk) {
      a.gait += dt * 4.4 * L.walk * a.face;
      modA = p => { for (let i = 0; i < 16; i++) P3[i] = p[i]; gaitPose(p, a.gait, 'walk', .85); for (const i of [1, 2, 3, 4, 5, 6]) p[i] = P3[i]; };
    }
    evalPaired(mv, t, a.dims, v ? v.dims : L.dV, a.joints, jV, B2.res, modA);
    L.front = B2.res.front;
    if (L.kind === 'hold' && L.strikeT > 0) { // knee strike over the hold pose
      sampleClip(clip('knee'), .26 - L.strikeT, P1); solveFK(P1, a.dims, a.joints, {});
    }
    pairToWorld(a.joints, a.face, a.x, a.y);
    if (v) {
      pairToWorld(jV, a.face, a.x, a.y);
      v.pelvisX = jV.x(0); v.pelvisLink = L; v.face = jV.face;
    }
    if (a.look && mv.swim && t > mv.swim[0] && t < mv.swim[1]) a.hidden = true; else a.hidden = false;
    void dt;
  }
  pin(p) {
    const { a, v } = p, mv = HOLDS.pin;
    evalPaired(mv, p.t % mv.dur, a.dims, v.dims, a.joints, v.joints, this.buf.res);
    if (p.struggle > 0) { const k = Math.sin(p.t * 40) * p.struggle * 3; for (let i = 0; i < JN; i++) { v.joints.p[i * 2 + 1] -= Math.abs(k); a.joints.p[i * 2 + 1] -= Math.abs(k) * .8; } }
    pairToWorld(a.joints, a.face, a.x, a.y); pairToWorld(v.joints, a.face, a.x, a.y);
    v.face = v.joints.face; v.x = v.joints.x(0);
  }
  stance(f, out) { return stancePose(f.char ? f.char.stance : 'calm', f.poseT * (f.exhausted ? 1.5 : 1), out); }
  solo(f, dt) {
    if (f.rag) { f.rag.toJoints(f.joints); return; }
    const p = P1, d = f.dims;
    let yaw = 1, air = false, opt = null, offY = 0;
    const C = (name, t = f.clipT) => { const c = clip(name); sampleClip(c, t, p); if (c.air) air = true; };
    switch (f.st) {
      case 'IDLE': case 'INTRO':
        if (f.landT > .02 && !f.exhaustedLand) { C('land', .12 - f.landT + .02); break; }
        this.stance(f, p);
        if (f.exhausted && f.st === 'IDLE') { p[1] += 14; p[2] += 6; p[3] -= 10; p[5] -= 14; p[8] += 8; p[10] += 8; }
        break;
      case 'MOVE': {
        this.stance(f, p);
        const v = Math.abs(f.vx), run = v > 150;
        f.gait += dt * (run ? 6.2 + v * .031 : 2.6 + v * .071) * (f.vx * f.face >= 0 ? 1 : -1) / Math.sqrt(f.dims.leg / 43);
        gaitPose(p, f.gait, run ? 'run' : 'walk', clamp01(v / 60));
        if (f.dash && v > 200) { p[1] += 14; p[2] -= 6; p[3] = Math.min(p[3], 30); p[5] = Math.max(p[5], 40); }   // dash: lean in, arms back
        break;
      }
      case 'JUMP': C('jump', f.t); break;
      case 'FALL': C('fall', f.t); break;
      case 'ATTACK': {
        const a = f.atk;
        this.stance(f, P2);
        if (!a) { this.stance(f, p); break; }
        if (a.def.clip && hasClip(a.def.clip)) { const c = clip(a.def.clip); sampleClip(c, a.t, p); }
        else attackPose(a.def, a.t, P2, p);
        if (a.def.run && a.t < a.def.startup + a.def.active && a.def.id !== 'slideKick' && !a.def.hop) { f.gait += dt * 13; const save = [p[7], p[8], p[9], p[10]]; gaitPose(p, f.gait, 'walk', .4); if (a.t > a.def.startup) { p[7] = save[0]; p[8] = save[1]; p[9] = save[2]; p[10] = save[3]; } }
        if (a.def.spin) { const k = clamp01(a.t / (a.def.startup + a.def.active * .5)); yaw = Math.cos(k * k * Math.PI * 2); if (Math.abs(yaw) < .12) yaw = .12 * (yaw < 0 ? -1 : 1); }
        if (!f.ground) { air = true; }
        break;
      }
      case 'AIR_ATTACK': {
        const a = f.atk;
        if (!a) { C('fall'); break; }
        poseLerp(pose(a.def.wind), pose(a.def.hit), clamp01((a.t - a.def.startup * .5) / (a.def.startup * .8)), p);
        if (a.def.flip) p[0] += a.def.flip * 0 + lerp(0, a.def.flip, clamp01(a.t / .62)) * 1 - (a.t > .62 ? 0 : 0);
        air = true;
        break;
      }
      case 'GUARD': C('guard'); if (f.overlay) sampleClip(clip(f.overlay.name), f.overlay.t, p); break;
      case 'DODGE': if (f.dodge && f.dodge.back) C('backstep', f.t); else { C('roll', f.t * .44 / B.dodgeTime); } break;
      case 'HITSTUN': {
        const n = f.clipName || 'hitF';
        if (f.hsKind === 'lie') { C(f.lieClip === 'sit' ? 'sit' : f.lieClip || 'downSup', f.t); break; }
        const c = clip(n); sampleClip(c, c.loop ? f.t : f.t * c.dur / Math.max(.12, f.hs), p); if (c.air) air = true;
        break;
      }
      case 'STAGGER': C('stagger', f.t); break;
      case 'DOWN': case 'PINNED': C(f.lieClip || 'downSup', f.t + f.idx); break;
      case 'KO': case 'OUT': C(f.lieClip === 'downProne' ? 'koProne' : 'koSup', 0); break;
      case 'GET_UP': { const g = f.gettingUp; if (g) { const c = clip(g.clip); sampleClip(c, f.clipT * c.dur / g.dur, p); } else this.stance(f, p); break; }
      case 'FINISHER': {
        const P = f.finPhase;
        this.stance(f, P2);
        if (!P) { this.stance(f, p); break; }
        const ty = P.F.type;
        if (P.stage === 'charge') { poseLerp(P2, pose(CHARGE[ty]), clamp01(P.t / .16), p); p[0] += Math.sin(P.t * 70) * 1.2; }
        else if (P.stage === 'leap') { poseLerp(pose(CHARGE.dive), pose(LUNGE.dive), clamp01(P.t / .2), p); p[0] += P.t * 620 * 1; air = true; }
        else if (P.stage === 'stance') { for (let i = 0; i < POSE_N; i++) p[i] = pose(CHARGE.stance)[i]; p[3] += Math.sin(P.t * 9) * 6; p[5] += Math.cos(P.t * 9) * 6; }
        else { poseLerp(pose(CHARGE[ty]), pose(LUNGE[ty]), clamp01(P.t / .08), p); if (ty === 'strike' || ty === 'grab') { f.gait += dt * 16; } }
        break;
      }
      case 'ROPE': C('ropeBack', f.t); break;
      case 'WHIPPED':
        if (f.whip && f.whip.lean > 0) { C('ropeBack', (B.ropeLean - f.whip.lean)); break; }
        this.stance(f, p); f.gait += dt * 13; gaitPose(p, f.gait, 'run', 1); p[3] = 100 + Math.sin(f.poseT * 14) * 20; p[5] = 90 + Math.cos(f.poseT * 12) * 24; p[1] = f.whip && f.whip.back ? 6 : 26; p[2] = -10;
        break;
      case 'CLIMB': C('climb', f.t); opt = { free: 1 }; break;
      case 'PERCH': C('perch', f.t); break;
      case 'HANG': C('hang', f.t); opt = { hang: 1 }; break;
      case 'APRON': C('apron', f.t); break;
      case 'SEATED': C('seatTop', f.t); opt = { seat: 1 }; break;
      case 'TAGWAIT': C(f.wantTag ? 'tagReach' : 'apron', f.poseT); break;
      case 'ENTER_RING': case 'EXIT_RING': C('enterRing', f.t); break;
      case 'TAUNT': C(f.char.taunt || 'taunt', f.t); break;
      case 'WIN': C(f.char.win || 'win', f.t); break;
      default: this.stance(f, p);
    }
    // carrying a chair: arms forward at chest height, or held high for a taunt or a win
    if (f.prop && f.st !== 'ATTACK') { const s = Math.sin(f.poseT * (f.st === 'TAUNT' ? 9 : 3)) * (f.st === 'TAUNT' ? 8 : 3); p[3] = 168 + s; p[4] = 18; p[5] = 162 + s; p[6] = 20; }   // chair held high overhead
    if (f.overlay) { f.overlay.t += dt; if (f.overlay.t > f.overlay.dur) f.overlay = null; }
    const jt = f.joints;
    if (air) {
      // airborne: pelvis floats a little below leg length above the feet point
      solveFK(p, d, jt, { snap: false, px: p[12], py: -(d.leg * .92) - p[11] });
    } else if (opt && opt.seat) solveFK(p, d, jt, { snap: false, px: 0, py: 0, freeFeet: true });   // pelvis on the turnbuckle
    else solveFK(p, d, jt, {});
    if (f.bounce) { f.bounce.t += dt; const k = f.bounce.t / .22; if (k >= 1) f.bounce = null; else offY = -Math.sin(k * Math.PI) * 7; }
    toWorld(jt, f.face, f.x, f.y + offY, yaw);
    if (opt && opt.hang) { // pin the hands to the top rope
      const hx = (jt.x(J.hN) + jt.x(J.hF)) / 2, hy = (jt.y(J.hN) + jt.y(J.hF)) / 2, ar = this.m.arena, tx = f.x < ar.mid ? ar.ropeL - 2 : ar.ropeR + 2, ty = ar.matY - ar.ropeH + 2;
      for (let i = 0; i < JN; i++) { jt.p[i * 2] += tx - hx; jt.p[i * 2 + 1] += ty - hy; }
    }
  }
  finish(f, dt) {
    const b = f.blend;
    if (b && b.on) {
      b.t += dt;
      const k = clamp01(b.t / b.dur);
      if (k >= 1) b.on = false;
      else {
        const s = k * k * (3 - 2 * k), dx = f.x - b.x, dy = f.y - b.y, P = f.joints.p, Q = b.from.p, mv = f.rag ? 0 : 1;
        for (let i = 0; i < JN; i++) { P[i * 2] = lerp(Q[i * 2] + dx * mv, P[i * 2], s); P[i * 2 + 1] = lerp(Q[i * 2 + 1] + dy * mv, P[i * 2 + 1], s); }
        const wrap = a => Math.atan2(Math.sin(a * DEG), Math.cos(a * DEG)) / DEG;
        f.joints.S = b.from.S + wrap(f.joints.S - b.from.S) * s; f.joints.H = b.from.H + wrap(f.joints.H - b.from.H) * s;
      }
    }
    this.face(f, dt);
    updateTails(f, dt, this.m.arena ? this.m.arena.ground(f.x, f.y, f.side) : f.y);
  }
  face(f, dt) {
    f.blinkT = (f.blinkT == null ? 1 + f.idx * .7 : f.blinkT) - dt;
    if (f.blinkT < -.11) f.blinkT = 1.6 + ((f.idx * 37 + (this.m.time * 10 | 0)) % 23) / 10;
    let e = 'neutral';
    if (f.exprT > 0) e = f.expr;
    else if (f.st === 'KO' || f.st === 'OUT') e = 'ko';
    else if (f.st === 'DOWN') e = f.postMove ? 'hurt' : 'dizzy';
    else if (f.st === 'GRABBED' || f.st === 'PINNED') e = 'hurt';
    else if (f.fsm.is('ATTACK', 'AIR_ATTACK')) e = f.atk && f.atk.def.lv >= 3 ? 'shout' : 'fierce';
    else if (f.fsm.is('GRAB', 'WRESTLING_MOVE', 'COUNTER', 'FINISHER', 'GUARD', 'PIN')) e = 'fierce';
    else if (f.st === 'TAUNT') e = 'smug';
    else if (f.st === 'WIN') e = 'happy';
    else if (f.exhausted) e = 'sad';
    else if (f.blinkT < 0) e = 'blink';
    f.faceExpr = e;
  }
}

// Loose strands (ribbons, mask tails, sashes): short verlet ropes hung on the head or waist.
export function updateTails(f, dt, groundY) {
  const defs = f.look.tails;
  if (!defs) return;
  const jt = f.joints;
  const H = jt.H * DEG, S = jt.S * DEG, fc = jt.face;
  const anchor = t => {
    if (t.at === 'waist') return [jt.x(0) - Math.cos(S) * fc * 8, jt.y(0) - Math.sin(S) * fc * 8 - 3];
    const hx = jt.x(J.head), hy = jt.y(J.head);
    return [hx - Math.cos(H) * fc * 9.5 * (f.look.scale || 1), hy - Math.sin(H) * fc * 9.5 - 2];
  };
  if (!f.tails) f.tails = defs.map((t, k) => { const [ax, ay] = anchor(t), n = t.n; const o = { def: t, w: t.w, c: t.c, front: !!t.front, pts: new Float32Array(n * 2), prev: new Float32Array(n * 2), k }; for (let i = 0; i < n; i++) { o.pts[i * 2] = o.prev[i * 2] = ax - i * 2; o.pts[i * 2 + 1] = o.prev[i * 2 + 1] = ay + i * t.len; } return o; });
  const h = Math.min(dt, 1 / 30);
  for (const T of f.tails) {
    const [ax, ay] = anchor(T.def), n = T.def.n, p = T.pts, q = T.prev;
    if (Math.abs(p[0] - ax) + Math.abs(p[1] - ay) > 90) for (let i = 0; i < n; i++) { p[i * 2] = q[i * 2] = ax; p[i * 2 + 1] = q[i * 2 + 1] = ay + i * T.def.len; }
    if (h > 0) for (let i = 1; i < n; i++) {
      const vx = (p[i * 2] - q[i * 2]) * .9, vy = (p[i * 2 + 1] - q[i * 2 + 1]) * .9;
      q[i * 2] = p[i * 2]; q[i * 2 + 1] = p[i * 2 + 1];
      p[i * 2] += vx - fc * 26 * h * h * 60 * .1 + Math.sin((f.poseT || 0) * 3 + T.k + i) * .05; p[i * 2 + 1] += vy + 520 * h * h;
    }
    for (let it = 0; it < 3; it++) {
      p[0] = ax; p[1] = ay + T.k * 2;
      for (let i = 1; i < n; i++) {
        const dx = p[i * 2] - p[i * 2 - 2], dy = p[i * 2 + 1] - p[i * 2 - 1], D = Math.hypot(dx, dy) || 1, k = (D - T.def.len) / D;
        if (i === 1) { p[i * 2] -= dx * k; p[i * 2 + 1] -= dy * k; } else { p[i * 2] -= dx * k * .5; p[i * 2 + 1] -= dy * k * .5; p[i * 2 - 2] += dx * k * .5; p[i * 2 - 1] += dy * k * .5; }
        if (p[i * 2 + 1] > groundY - 1) p[i * 2 + 1] = groundY - 1;
      }
    }
  }
}
export const faceSign = sgn;
