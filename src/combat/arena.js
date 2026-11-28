// Arena geometry and the elastic side ropes. Pure simulation; ArenaRenderer draws it.
import { clamp } from '../core/util.js';

export class Arena {
  constructor(def = {}) {
    this.id = def.id || 'hall';
    this.x0 = def.x0 != null ? def.x0 : 34; this.x1 = def.x1 != null ? def.x1 : 866;
    this.width = def.width || 900;
    this.ropeL = def.ropeL || 206; this.ropeR = def.ropeR || 694;
    this.matY = def.matY || 258; this.floorY = def.floorY || 312;
    this.apron = 16; this.ropeH = 50; this.hasRing = def.hasRing !== false;
    if (!this.hasRing) { this.matY = this.floorY; this.ropeL = this.x0; this.ropeR = this.x1; }
    this.ropes = { L: { d: 0, v: 0, p: 0 }, R: { d: 0, v: 0, p: 0 } };
    this.shake = 0; this.matWave = [];
  }
  press(side, amt) { const r = this.ropes[side]; r.p = Math.max(r.p, Math.min(26, amt)); }
  twang(side, v) { this.ropes[side].v += v; }
  update(dt) {
    for (const k of ['L', 'R']) {
      const r = this.ropes[k];
      if (r.p > 0) { r.d += (r.p - r.d) * Math.min(1, dt * 26); r.v = 0; r.p = Math.max(0, r.p - dt * 160); }
      else { r.v += (-r.d * 520 - r.v * 9) * dt; r.d += r.v * dt; r.d = clamp(r.d, -22, 28); }
    }
    this.shake = Math.max(0, this.shake - dt * 3);
    for (const w of this.matWave) w.t += dt;
    if (this.matWave.length && this.matWave[0].t > .6) this.matWave.shift();
  }
  slam(x, p) { this.shake = Math.min(1.4, this.shake + p * .6); this.matWave.push({ x, t: 0, p }); this.twang('L', 120 * p); this.twang('R', 120 * p); }
  inside(x) { return !this.hasRing || (x > this.ropeL && x < this.ropeR); }
  overMat(x) { return this.hasRing && x > this.ropeL - this.apron && x < this.ropeR + this.apron; }
  // Ground height for a body whose feet are at (x, y).
  ground(x, y, side) {
    if (!this.hasRing) return this.floorY;
    if (side === 'in') return this.matY;
    return this.overMat(x) && y <= this.matY + 3 ? this.matY : this.floorY;
  }
  nearRope(x) { // {side, dist} to the closest rope from inside
    const l = x - this.ropeL, r = this.ropeR - x;
    return l < r ? { side: 'L', dist: l, dir: -1, x: this.ropeL } : { side: 'R', dist: r, dir: 1, x: this.ropeR };
  }
  get mid() { return (this.ropeL + this.ropeR) / 2; }
}
export const ARENAS = {
  hall: { id: 'hall', name: '항구 체육관', desc: '옛 어시장을 고친 연맹의 본거지', crowd: 1, rim: '#4fd6ff', light: 0, tint: [1, 1, 1] },
  gym: { id: 'gym', name: '훈련장 링', desc: '땀 냄새 밴 연습용 링', crowd: 0, rim: '#ffcf8a', light: .04, tint: [1.02, 1, .96] },
  pier: { id: 'pier', name: '부두 특설 링', desc: '네온과 파도가 관객인 야외 링', crowd: .7, rim: '#ff5fa2', light: -.02, tint: [.98, 1, 1.05] },
  dome: { id: 'dome', name: '등대 돔', desc: '챔피언십이 열리는 거대한 돔', crowd: 1.3, rim: '#ffd65a', light: .03, tint: [1.03, 1.01, .98] },
  lobby: { id: 'lobby', name: '체육관 로비', desc: '로비가 그대로 싸움판이 됐다', crowd: .4, rim: '#ffcf8a', light: .02, tint: [1.03, 1, .96], hasRing: false, x0: 60, x1: 840 },
  basement: { id: 'basement', name: '지하 격투장', desc: '로비 아래, 아는 사람만 아는 링', crowd: .55, rim: '#ff8a2b', light: -.05, tint: [1.06, .96, .9] },
  alley: { id: 'alley', name: '부둣길 뒷골목', desc: '링도 종도 없는 길거리 승부', crowd: .25, rim: '#39e6c0', light: -.06, tint: [.95, 1, 1.05], hasRing: false, x0: 60, x1: 840 },
};
