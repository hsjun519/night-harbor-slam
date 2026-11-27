// Lockstep for two players. Both browsers run the same match from the same seed and feed it the same inputs: every
// frame each side sends its input for a frame `delay` ticks ahead, and a frame runs only when both inputs for it are in.
// One input is one number: eight buttons and the stick (-1, 0, 1). A checksum every two seconds spots a split.
const KEYS = ['up', 'down', 'downEdge', 'jump', 'atk', 'grab', 'dodge', 'fin'];
const EDGES = ['downEdge', 'jump', 'atk', 'grab', 'dodge', 'fin'];
export function pack(I) { let b = 0; KEYS.forEach((k, i) => { if (I[k]) b |= 1 << i; }); const mx = I.mx > .3 ? 2 : I.mx < -.3 ? 0 : 1; return b | (mx << 8); }
export function unpack(b, I) { KEYS.forEach((k, i) => { I[k] = !!(b & (1 << i)); }); I.mx = ((b >> 8) & 3) - 1; return I; }
const IDLE = 1 << 8;

export class Lockstep {
  constructor(net, localIdx, delay = 4) {
    this.net = net; this.local = localIdx; this.delay = delay; this.frame = 0;
    this.mine = new Map(); this.theirs = new Map(); this.sums = new Map(); this.desync = false;
    this.pend = { mx: 0, up: false, down: false, downEdge: false, jump: false, atk: false, grab: false, dodge: false, fin: false };
    for (let f = 0; f < delay; f++) { this.mine.set(f, IDLE); this.theirs.set(f, IDLE); }   // the first frames: nobody presses anything
    this.onData = d => {
      if (d.t === 'in') for (let i = 0; i < d.b.length; i++) this.theirs.set(d.f + i, d.b[i]);
      else if (d.t === 'sum') this.check(d.f, d.s, false);
    };
    net.on('data', this.onData);
  }
  // This real frame's input. Presses are kept until they go out, so a press during a stall is never lost.
  input(I) {
    const P = this.pend;
    P.mx = I.mx; P.up = I.up; P.down = I.down;
    for (const k of EDGES) if (I[k]) P[k] = true;
  }
  // Send the input for the frame `delay` ahead of the one about to run (once per frame).
  push() {
    const f = this.frame + this.delay;
    if (this.mine.has(f)) return;
    const b = pack(this.pend);
    this.mine.set(f, b);
    for (const k of EDGES) this.pend[k] = false;
    this.net.send({ t: 'in', f, b: [b] });
  }
  ready() { return this.mine.has(this.frame) && this.theirs.has(this.frame); }
  // Write both inputs of this frame into the fighters (index 0 is the host's, 1 the guest's) and move on.
  apply(fighters) {
    const a = this.mine.get(this.frame), b = this.theirs.get(this.frame);
    const by = this.local === 0 ? [a, b] : [b, a];
    for (let i = 0; i < 2; i++) if (fighters[i]) unpack(by[i], fighters[i].intent);
    this.mine.delete(this.frame - 60); this.theirs.delete(this.frame - 60);
    this.frame++;
  }
  sum(m) {
    if (this.frame % 120 !== 0) return;
    let s = 7;
    for (const f of m.fighters) s = (s * 31 + Math.round(f.x * 4) * 7 + Math.round(f.y * 4) * 3 + Math.round(f.hp * 10) + (f.st.length * 13)) % 1000000007;
    this.net.send({ t: 'sum', f: this.frame, s });
    this.check(this.frame, s, true);
  }
  check(f, s, mine) {
    const o = this.sums.get(f);
    if (!o) { this.sums.set(f, { s, mine }); return; }
    if (o.mine !== mine && o.s !== s) this.desync = true;
    this.sums.delete(f);
  }
  dispose() { const H = this.net.handlers.data; if (H) { const i = H.indexOf(this.onData); if (i >= 0) H.splice(i, 1); } }
}
