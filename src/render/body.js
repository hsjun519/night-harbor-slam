// Turns joints + a look into pixels. A look is plain data (see data/characters.js), so new wrestlers need no code.
import { DEG } from '../core/util.js';
import { J } from '../anim/skeleton.js';
import { ramp, skinRamp, packHex } from './palette.js';
import { headTexture } from './head.js';

const U0 = .24; // the body is drawn three-quarter: its centre line sits toward the facing side
export const EMBLEMS = {
  anchor: ['..###..', '..#.#..', '..###..', '...#...', '#..#..#', '##.#.##', '.#####.', '...#...'],
  star: ['...#...', '...#...', '#######', '.#####.', '..###..', '.##.##.', '#.....#'],
  wave: ['.......', '.##....', '#..#.##', '#...#..', '#......', '#######', '.#####.'],
  bolt: ['...##', '..##.', '.##..', '####.', '..##.', '.##..', '##...'],
  gull: ['#.....#', '##...##', '.##.##.', '..###..', '...#...'],
  sun: ['...#...', '.#.#.#.', '..###..', '#######', '..###..', '.#.#.#.', '...#...'],
  hook: ['..##...', '...#...', '...#...', '...##..', '#...##.', '##..##.', '.####..'],
  skull: ['.#####.', '#######', '#.##.##', '#######', '.##.##.', '..###..', '..#.#..'],
  knot: ['.##.##.', '#..#..#', '#.###.#', '.##.##.', '#.###.#', '#..#..#', '.##.##.'],
  eye: ['..###..', '.#...#.', '#..#..#', '#.###.#', '#..#..#', '.#...#.', '..###..'],
  fist: ['.####..', '######.', '#.#.##.', '#######', '######.', '.####..', '.####..'],
  drop: ['...#...', '..###..', '..###..', '.#####.', '.####.#', '.#####.', '..###..'],
  whale: ['#......###.', '##..#######', '.##########', '##..######.', '#.....##...'],
};
function emblemAt(name, x, y) { // x,y in pixels around the emblem centre
  const b = EMBLEMS[name];
  if (!b) return false;
  const r = Math.floor(y + b.length / 2), c = Math.floor(x + b[0].length / 2);
  return r >= 0 && r < b.length && c >= 0 && c < b[0].length && b[r][c] === '#';
}

function muscleDetail(u, v, m, belly, fem) {
  const c = u - U0;
  let d = 0;
  if (belly) {
    const bx = (u - .3) / .52, by = (v - .34) / .24, q = bx * bx + by * by;
    if (q < 1) d += .5 * (1 - q);
    if (v < .13) d -= .9;
    if (Math.abs(c - .06) < .07 && Math.abs(v - .25) < .022) d -= 2.4;
    const line = .61 + .06 * c * c;
    if (Math.abs(v - line) < .018 && Math.abs(c) < .72) d -= 1.1;
    if (Math.abs(c) < .05 && v > .62 && v < .84) d -= .7;
    return d;
  }
  if (fem) {
    if (v < .56 && v > .16) { if (Math.abs(c) < .05) d -= .7 * (m + .3); if (Math.abs(v - .36) < .012 && Math.abs(c) < .36) d -= .5 * m; if (Math.abs(Math.abs(c) - .42) < .05 && v < .5) d -= .4; }
    if (Math.abs(c) < .05 && Math.abs(v - .24) < .015) d -= 1.6;
    if (v > .58 && v < .64) d -= .5;
    if (v > .9 && Math.abs(c) < .6) d -= .3;
    return d;
  }
  if (m <= 0) { if (Math.abs(c) < .04 && v > .6 && v < .86) d -= .4; return d; }
  const k = c < 0 ? c / .85 : c / .62, line = .575 + .095 * k * k;
  if (Math.abs(k) < 1.02) {
    if (Math.abs(v - line) < .02) d -= 1.35 * m;
    else if (v < line && v > line - .05) d -= .5 * m;
    else if (v > line + .02 && v < .88) d += .34 * m * (1 - Math.abs(k));
  }
  if (v > .59 && v < .87 && Math.abs(c) < .05) d -= 1.2 * m;
  if (Math.abs(v - .675) < .016 && (Math.abs(c + .46) < .06 || Math.abs(c - .37) < .06)) d -= 1.7;
  if (v > .885 && v < .91 && Math.abs(c) < .62) d -= .55 * m;
  if (v > .15 && v < .555 && Math.abs(c) < .46) {
    if (Math.abs(c) < .045) d -= .95 * m;
    else if (Math.abs(v - .245) < .014 || Math.abs(v - .345) < .014 || Math.abs(v - .45) < .014) d -= .95 * m;
    else if (Math.abs(Math.abs(c) - .42) < .045) d -= .75 * m;
    else d += .16 * m;
  } else if (v > .2 && v < .56 && c < -.5) { if (Math.abs(((v * 9 + c * 1.6) % 1 + 1) % 1 - .5) < .16) d -= .42 * m; }
  return d;
}

// the same look wearing the championship belt (one copy per look, so its shaders are built once)
const beltCache = new WeakMap();
export function beltLook(look) {
  let b = beltCache.get(look);
  if (!b) { b = Object.assign({}, look, { titleBelt: 1 }); beltCache.set(look, b); }
  return b;
}
const shaderCache = new WeakMap();
function torsoShader(look, dims) {
  let f = shaderCache.get(look);
  if (f && f.dims === dims) return f;
  const skin = skinRamp(look.skin), t = look.top || { kind: 'none' }, b = look.bottom || { kind: 'trunks', c1: '#b8323f' };
  const c1 = t.c1 ? ramp(t.c1) : skin, c2 = t.c2 ? ramp(t.c2) : c1, c3 = t.c3 ? ramp(t.c3) : c2, bot = ramp(b.c1 || '#30406e'), bot2 = ramp(b.c2 || b.c1 || '#30406e');
  const belt = look.belt ? ramp(look.belt) : null, m = dims.mus, belly = dims.belly, fem = dims.fem;
  const hipV = b.kind === 'trunks' ? .15 : b.kind === 'shorts' ? .17 : .18, W = dims.prof[4][2], L = dims.spine * 1.36;
  const emb = t.emblem || look.emblem;
  const shortTop = fem && (t.kind === 'bra' || t.kind === 'none');
  f = (u, v, o) => {
    const c = u - U0;
    let cloth = null, soft = .4;
    switch (t.kind) {
      case 'none': break;
      case 'bra': if (v > .575 && v < .86 && !(v > .8 && Math.abs(c) < .16)) cloth = v < .61 ? c2 : c1; break;
      case 'crop': if (v > .5) cloth = v < .54 ? c2 : c1; if (v > .9 && Math.abs(c) < .25) cloth = null; break;
      case 'singlet': if (v < .56 || (v < .97 && Math.abs(Math.abs(c + .02) - .46) < .16)) cloth = c1; else if (v < .62 && Math.abs(c) > .3) cloth = c1; if (cloth && t.c2 && (Math.abs(Math.abs(c) - .5) < .06 && v < .56)) cloth = c2; break;
      case 'strap': { const q = v - (.2 + (c + .9) * .42); if (Math.abs(q) < .085) cloth = Math.abs(q) > .06 ? c2 : c1; break; }
      case 'xstrap': { const q1 = v - (.2 + (c + .9) * .44), q2 = v - (.94 - (c + .9) * .44); if (Math.abs(q1) < .06 || Math.abs(q2) < .06) cloth = c1; if (Math.abs(c) < .12 && Math.abs(v - .6) < .06) cloth = c2; break; }
      case 'tank': if (v < .68 || Math.abs(Math.abs(c) - .5) < .17) cloth = c1; if (v > .62 && v < .7 && Math.abs(c) < .34) cloth = v > .66 ? c2 : c1; break;
      case 'tee': cloth = c1; if (v > .93 && Math.abs(c) < .3) cloth = c2; if (t.stripe && Math.abs(v - .62) < .06) cloth = c2; if (t.stripe === 2 && Math.abs(v - .46) < .05) cloth = c2; break;
      case 'stripes': cloth = Math.floor(v * 9) % 2 ? c1 : c2; break;
      case 'vest': if (c < -.14 || c > .3) cloth = (c > -.2 && c < -.14) || (c > .3 && c < .36) ? c2 : c1; break;
      case 'jacket': cloth = c1; if (Math.abs(c) < .2) cloth = c2; else if (Math.abs(c) < .26) cloth = c3; if (v > .9) cloth = c3; if (v < .2) cloth = c3; break;
      case 'hoodie': cloth = c1; if (Math.abs(c) < .05 && v > .2) cloth = c2; if (v > .86) cloth = c3; if (v < .34 && v > .16 && Math.abs(c) < .5 && v > .16 + Math.abs(c) * .2) o.dt -= .4; break;
      case 'track': cloth = c1; if (Math.abs(c) < .05) cloth = c2; if (v > .9) cloth = c2; if (Math.abs(v - .74) < .03) cloth = c2; break;
      case 'suit': { cloth = c1; const w = (v - .42) * .62; if (v > .42 && Math.abs(c) < w) { cloth = c2; if (Math.abs(c) < .07) cloth = c3; } else if (v > .42 && Math.abs(c) < w + .12) o.dt -= .8; if (Math.abs(c) < .05 && (Math.abs(v - .32) < .015 || Math.abs(v - .22) < .015)) o.dt -= 2; break; }
      case 'opencoat': { const w = .22 + Math.max(0, v - .3) * .32; if (Math.abs(c + .04) > w || v > .93) cloth = Math.abs(Math.abs(c + .04) - w) < .05 && v <= .93 ? c2 : c1; break; }   // a coat worn open over the bare chest, trimmed
      case 'orca': cloth = c1; if (c > -.12 && c < .5 && v > .2 && v < .74 && v - .2 > Math.abs(c - .19) * .45) cloth = c2; if (v > .9 && Math.abs(c) < .22) cloth = c2; break;   // black with an orca's white belly
      case 'coat': { cloth = c1; const w = (v - .3) * .5; if (v > .3 && Math.abs(c) < w) { cloth = c2; if (Math.abs(c) < .06 && t.c3) cloth = c3; } else if (Math.abs(Math.abs(c) - w) < .05) o.dt -= 1; break; }
      case 'shirt': cloth = c1; if (Math.abs(c) < .035) o.dt -= .9; if (v > .92 && Math.abs(c) < .3) cloth = skin; if (t.c2 && v < .2) cloth = c2; break;
      case 'apron': cloth = c1; if (v < .74 && Math.abs(c) < .62) cloth = c2; if (v >= .74 && Math.abs(Math.abs(c) - .36) < .06) cloth = c2; break;
      case 'overall': cloth = c2; if (v < .62 && Math.abs(c) < .72) cloth = c1; if (v < .3) cloth = c1; if (v >= .62 && Math.abs(Math.abs(c) - .4) < .09) cloth = c1; break;
      case 'hivis': cloth = c1; if (Math.abs(v - .36) < .05 || Math.abs(Math.abs(c) - .5) < .08 && v > .4) cloth = c2; break;
      case 'harness': if (Math.abs(v - .63) < .035 || Math.abs(Math.abs(c) - .5) < .07 && v > .63) cloth = c1; if (Math.abs(c) < .12 && Math.abs(v - .63) < .05) cloth = c2; break;
      case 'fur': if (v > .72) { cloth = c1; o.dt += ((u * 9 + v * 13) % 1 > .5 ? .8 : -.5); } break;
      case 'gi': { cloth = c1; const q = (v - .3) * .7; if (v > .3 && c > -q * .9 - .02 && c < q * .5) { cloth = null; } else if (Math.abs(c + q * .9) < .06 || Math.abs(c - q * .5) < .06) cloth = c2; break; }
    }
    if (emb && Math.abs(c) < .5 && v > .5 && v < .9) { const ex = (c + (t.kind === 'none' ? 0 : 0)) * W, ey = (.72 - v) * L; if ((cloth || look.emblemSkin) && emblemAt(emb, ex, ey)) cloth = t.ce ? ramp(t.ce) : c2; }
    if (v < hipV) { cloth = b.kind === 'pants' ? bot : bot; if (v > hipV - .035 && b.c2) cloth = bot2; soft = .3; }
    if (belt && v > .115 && v < .205) { cloth = belt; if (Math.abs(c) < .34) o.dt += .8; soft = .2; }
    o.ramp = cloth || skin;
    o.dt += muscleDetail(u, v, m, belly, shortTop || fem) * (cloth ? soft : 1);
    if (look.tattoo && !cloth) { const q = look.tattoo; if (q === 'chest' && v > .66 && v < .84 && c < -.12 && ((u * 11 + Math.sin(v * 30) * .5) % 1 + 1) % 1 < .42) o.dt -= 1.5; if (q === 'belly' && emblemAt('wave', c * W, (.36 - v) * L)) o.dt -= 2; }
    if (look.scarBody && !cloth && Math.abs(v - .52 - c * .4) < .016 && Math.abs(c) < .55) o.dt += 1.4;
  };
  f.dims = dims;
  shaderCache.set(look, f);
  return f;
}

const segCache = new WeakMap();
function limbSegs(look, dims) {
  let s = segCache.get(look);
  if (s && s.dims === dims) return s;
  const skin = skinRamp(look.skin);
  const one = r => [{ t: 1, ramp: r }];
  const muscArm = dims.mus > .7 ? (t, q, tone) => (t > .18 && t < .3 && q > .1 ? -1 : t > .42 && t < .72 && Math.abs(q + .1) < .16 ? -1 : 0) && tone > 1 ? -1 : 0 : null;
  const ua = [], fa = [], th = [], sh = [];
  const sl = look.sleeve, sR = sl ? ramp(sl.c) : null, sR2 = sl && sl.c2 ? ramp(sl.c2) : null;
  const stripePat = sR2 ? (t, q) => (Math.abs(q) < .22 ? sR2 : null) : null;
  if (sl) { const a = Math.min(1, sl.len); ua.push({ t: a, ramp: sR, pat: stripePat }); if (a < 1) ua.push({ t: 1, ramp: skin, pat: muscArm }); }
  else ua.push({ t: look.elbow ? .84 : 1, ramp: skin, pat: muscArm });
  if (look.elbow && !sl) ua.push({ t: 1, ramp: ramp(look.elbow) });
  if (sl && sl.len > 1) { const a = Math.min(1, sl.len - 1); fa.push({ t: a, ramp: sR, pat: stripePat }); if (a < 1) fa.push({ t: 1, ramp: skin }); }
  else {
    if (look.elbow) fa.push({ t: .2, ramp: ramp(look.elbow) });
    if (look.wrist) { fa.push({ t: 1 - look.wrist.len, ramp: skin }); const wr = ramp(look.wrist.c), w2 = look.wrist.c2 ? ramp(look.wrist.c2) : null; fa.push({ t: 1, ramp: wr, pat: w2 ? t => (Math.floor(t * 14) % 2 ? w2 : null) : t => (Math.floor(t * 18) % 3 === 0 ? -1 : 0) }); }
    else fa.push({ t: 1, ramp: skin });
  }
  const b = look.bottom || { kind: 'trunks', c1: '#b8323f' }, bR = ramp(b.c1 || '#30406e'), b2 = b.c2 ? ramp(b.c2) : null;
  let pat = null;
  if (b.pat === 'side' && b2) pat = (t, q) => (Math.abs(q) < .26 ? b2 : null);
  else if (b.pat === 'bands' && b2) pat = t => (Math.floor(t * 5) % 2 ? b2 : null);
  else if (b.pat === 'flame' && b2) pat = (t, q) => (t > .5 + Math.abs(((q * 3) % 1 + 1) % 1 - .5) * .9 ? b2 : null);
  else if (b.pat === 'scale' && b2) pat = (t, q) => ((Math.floor(t * 8) + Math.floor((q + 1) * 3)) % 2 ? b2 : null);
  else if (b.pat === 'half' && b2) pat = (t, q) => (q > 0 ? b2 : null);
  else if (b.pat === 'spots' && b2) pat = (t, q) => (Math.sin(t * 24 + 1) * Math.sin(q * 7) > .55 ? b2 : null);
  const kneeR = look.knee ? ramp(look.knee) : null;
  const tLen = b.kind === 'trunks' ? .24 : b.kind === 'shorts' ? .62 : b.kind === 'skirt' ? .2 : 1;
  th.push({ t: kneeR ? Math.min(tLen, .86) : tLen, ramp: bR, pat });
  if (tLen < (kneeR ? .86 : 1)) th.push({ t: kneeR ? .86 : 1, ramp: skin, pat: dims.mus > .6 ? (t, q, tone) => (tone > 1 && t > .5 && t < .9 && Math.abs(q - .12) < .12 ? -1 : 0) : null });
  if (kneeR) th.push({ t: 1, ramp: kneeR });
  const bt = look.boots || { c1: '#2a2440', h: .7 }, B1 = ramp(bt.c1), B2 = ramp(bt.c2 || bt.c1), legCover = b.kind === 'tights' || b.kind === 'pants';
  const bootTop = 1 - (bt.h || 0);
  if (kneeR) sh.push({ t: .2, ramp: kneeR });
  if (bootTop > .2) sh.push({ t: bootTop, ramp: legCover ? bR : skin, pat: legCover ? pat : null });
  if (bt.h > 0 && b.kind !== 'pants') { sh.push({ t: Math.min(1, bootTop + .1), ramp: B2 }); sh.push({ t: 1, ramp: B1, pat: bt.plain ? null : (t, q, tone) => (Math.abs(q - .3) < .16 && Math.floor(t * 22) % 2 ? B2 : tone) && Math.abs(q - .3) < .16 && Math.floor(t * 22) % 2 ? B2 : null }); }
  else sh.push({ t: 1, ramp: legCover ? bR : skin, pat: legCover ? pat : null });
  const foot = [{ t: 1, ramp: B1, pat: (t, q) => (q * 1 > .58 ? B2 : null) }];
  const hand = look.glove ? ramp(look.glove) : skin;
  s = { ua, fa, th, sh, foot, hand, skin, B1, B2, one, dims, pants: b.kind === 'pants' };
  segCache.set(look, s);
  return s;
}

/* Draw a body.
   o.layer: 'all' | 'back' (everything but the near arm) | 'front' (near arm only)
   o.hand: 'fist' | 'open', o.expr, o.flash, o.tails: array of strand polylines in screen space, o.prop */
export function drawBody(bc, jt, dims, look, o = {}) {
  const P = jt.p, X = i => P[i * 2], Y = i => P[i * 2 + 1];
  const seg = limbSegs(look, dims), face = jt.face, layer = o.layer || 'all';
  const S = jt.S * DEG, cS = Math.cos(S), sS = Math.sin(S);
  const front = face;
  const fxv = cS * face, fyv = sS * face; // body-forward vector (screen)
  const upx = sS, upy = -cS;
  const open = o.hand === 'open';
  const arm = (si, far, g) => {
    const dk = far ? .2 : 0;
    bc.capsule(X(si), Y(si), dims.uaR[0], X(si + 1), Y(si + 1), dims.uaR[1], seg.ua, g, dims.uaR[2], dims.uaR[0] * .9, dk);
    bc.capsule(X(si + 1), Y(si + 1), dims.faR[0], X(si + 2), Y(si + 2), dims.faR[1], seg.fa, g + 1, dims.faR[2], dims.faR[0] * 1.35, dk);
    const dx = X(si + 2) - X(si + 1), dy = Y(si + 2) - Y(si + 1), L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, r = dims.hR;
    const hx = X(si + 2) + ux * r * .45, hy = Y(si + 2) + uy * r * .45;
    if (open) {
      bc.capsule(hx, hy, r * .82, hx + ux * r * .8, hy + uy * r * .8, r * .78, [{ t: 1, ramp: seg.hand }], g + 2, 0, r * 1.2, dk);
      const nx = -uy * face, ny = ux * face;
      bc.capsule(hx + nx * r * .5, hy + ny * r * .5, r * .34, hx + ux * r * .9 + nx * r * 1.1, hy + uy * r * .9 + ny * r * 1.1, r * .3, [{ t: 1, ramp: seg.hand }], g + 2, 0, 0, dk);
    } else {
      bc.capsule(hx - ux * .6, hy - uy * .6, r, hx + ux * r * .5, hy + uy * r * .5, r * .96, [{ t: 1, ramp: seg.hand }], g + 2, 0, r * 1.15, dk);
      const nx = -uy * face, ny = ux * face;
      bc.capsule(hx + ux * r * .2 - nx * r * .1, hy + uy * r * .2 - ny * r * .1, .6, hx + ux * r * .9 - nx * r * .1, hy + uy * r * .9 - ny * r * .1, .6, [{ t: 1, ramp: seg.hand }], g + 2, 0, 0, .75);
    }
  };
  const leg = (li, far, g) => {
    const dk = far ? .2 : 0, loose = seg.pants ? 1.1 : 0;
    bc.capsule(X(li), Y(li), dims.thR[0], X(li + 1), Y(li + 1), dims.thR[1] + loose * .6, seg.th, g, dims.thR[2], far ? 0 : dims.thR[0] * 1.25, dk);
    bc.capsule(X(li + 1), Y(li + 1), dims.shR[0] + loose * .5, X(li + 2), Y(li + 2), dims.shR[1] + loose, seg.sh, g + 1, dims.shR[2], dims.shR[0] * 1.3, dk);
    bc.capsule(X(li + 2), Y(li + 2), dims.ftR, X(li + 3), Y(li + 3), dims.ftR * .78, seg.foot, g + 2, 0, dims.ftR * 1.5, dk);
  };
  // epaulettes: a pad on the shoulder with gold fringe, or a spined pauldron (armor)
  const epa = (si, g) => {
    const E = look.epaulet; if (!E) return;
    const er = EPA.get(E) || EPA.set(E, { c: ramp(E.c), fr: E.fr ? ramp(E.fr) : null }).get(E), r = (E.armor ? 1.3 : 1) * dims.uaR[0] * .62;
    const x = X(si) + upx * dims.uaR[0] * .45, y = Y(si) + upy * dims.uaR[0] * .45;
    bc.capsule(x - fxv * r, y - fyv * r, r * .66, x + fxv * r, y + fyv * r, r * .66, [{ t: 1, ramp: er.c }], g, 0, 0, 0);
    if (E.armor) for (let k = -1; k <= 1; k++) { const bx = x + fxv * k * r * .7, by = y + fyv * k * r * .7; bc.poly([[bx - 1.6, by + upy * r * .4], [bx + upx * (r * .5 + 4.5), by + upy * (r * .5 + 4.5)], [bx + 1.6, by + upy * r * .4]], er.c, g); }
    if (er.fr) for (let k = -1; k <= 1; k++) { const bx = x + fxv * k * r * .72, by = y + fyv * k * r * .72; bc.capsule(bx - upx * r * .45, by - upy * r * .45, .8, bx - upx * (r * .45 + 4), by - upy * (r * .45 + 4), .7, [{ t: 1, ramp: er.fr }], g, 0, 0, 0); }
  };
  const tail = (T, g) => {
    for (let i = 0; i < T.pts.length - 2; i += 2) { const k = i / (T.pts.length - 2); bc.capsule(T.pts[i], T.pts[i + 1], T.w * (1 - k * .55), T.pts[i + 2], T.pts[i + 3], T.w * (1 - (k + .1) * .55), [{ t: 1, ramp: ramp(T.c) }], g, 0, 0, k * .1); }
  };
  if (layer !== 'front') {
    if (o.tails) for (const T of o.tails) if (!T.front) tail(T, 40);
    if (look.cape && o.cape !== false) {
      const a = 3 + (o.sway || 0), c = look.cape, x = X(J.neck), y = Y(J.neck), w = dims.prof[4][1] * .9, hem = (c.len || 1) * (dims.spine + dims.th);
      if (c.wing) bc.poly([[x - fxv * 2, y + 1], [x - fxv * (w + 26 + a), y + 8], [x - fxv * (w + 18), y + hem * .75], [x + fxv * (w * .4), y + hem * .55], [x + fxv * (w + 20 + a * .5), y + hem * .35], [x + fxv * (w + 12), y + 4]], ramp(c.c1), 41, { folds: 3, phase: (o.sway || 0) * .4 });   // 흑익: a manta's wings
      else bc.poly([[x - fxv * 2 - 1, y + 2], [x - fxv * (w + 2), y + 6], [x - fxv * (w + 7 + a) , y + hem], [x - fxv * (w * .1 - 3 + a * .5), y + hem + 2]], ramp(c.c1), 41, { folds: 2, phase: (o.sway || 0) * .4 });
    }
    arm(7, true, 1); epa(7, 2); leg(14, true, 4);
    const bx = X(0) - upx * dims.thR[0] * .55, by = Y(0) - upy * dims.thR[0] * .55, tx = X(1) + upx * (dims.nk * .7 + 2), ty = Y(1) + upy * (dims.nk * .7 + 2);
    if (look.skirtBack || look.coat) skirt(bc, P, dims, look.coat || look.skirtBack, fxv, fyv, upx, upy, 9, true, o);
    bc.torso(bx, by, tx, ty, fxv, fyv, dims.prof, torsoShader(look, dims), 10, 0);
    leg(10, false, 11);
    if (look.titleBelt || look.wearBelt) titleBelt(bc, P, dims, fxv, fyv, upx, upy, look.titleBelt ? 'gold' : look.wearBelt);
    if (look.coat || look.skirt) skirt(bc, P, dims, look.coat || look.skirt, fxv, fyv, upx, upy, 19, false, o);
    if (look.sash) { const x = X(J.pN), y = Y(J.pN) - 4; bc.poly([[x - 3, y], [x + 3, y], [x + 3.5 + (o.sway || 0), y + 14], [x - 2 + (o.sway || 0), y + 15]], ramp(look.sash), 21, { folds: 1 }); }
    bc.capsule(X(1) + upx * 1, Y(1) + upy * 1, dims.nkR, X(2) + upx * 3, Y(2) + upy * 3, dims.nkR * .92, [{ t: 1, ramp: look.neckCol ? ramp(look.neckCol) : seg.skin }], 14, 0, dims.nkR * 1.6, .12);
    if (look.scarf) bc.capsule(X(2) - fxv * 4, Y(2) + 1, 4, X(2) + fxv * 5, Y(2) + 2, 4.4, [{ t: 1, ramp: ramp(look.scarf) }], 15);
    const tx2 = headTexture(look, o.expr || 'neutral'), H = jt.H * DEG;
    bc.sprite(tx2.tex, tx2.w, tx2.h, tx2.ts, tx2.cx, tx2.cy, X(3), Y(3), Math.cos(H), Math.sin(H), front < 0, 16, dims.head);
    if (o.tails) for (const T of o.tails) if (T.front) tail(T, 42);
  }
  if (layer !== 'back') {
    if (o.prop && o.prop.draw) o.prop.draw(bc, jt, dims);
    arm(4, false, 24);
    epa(4, 27);
  }
}
// The championship belt, worn: drawn after the near leg (the thighs would cover a belt painted on the torso) and
// before the near arm, as a band round the waist on the body's own axes, so it turns, leans and shades with the body:
// leather strap with gold edges, a side plate toward the back, the big bevelled plate with a red stone on the front.
let TBR = null;
const EPA = new WeakMap();
// style: 'gold' (the championship belt) or 'captain' (고동's own: navy leather, the gold plate holds a blue stone, the sea)
function titleBelt(bc, P, dims, fx, fy, ux, uy, style = 'gold') {
  const all = TBR || (TBR = { gold: { gold: ramp('#d6aa32'), deep: ramp('#a67c1e'), strap: ramp('#2a2034'), gem: ramp('#d8334a') }, captain: { gold: ramp('#c9a22e'), deep: ramp('#8a6a1a'), strap: ramp('#16213e'), gem: ramp('#3f78c0') } });
  const R = all[style] || all.gold;
  const back = dims.prof[1][1] + 1.2, front = dims.prof[1][2] + 1.4, cx = P[0] + ux * 5, cy = P[1] + uy * 5;
  const at = (a, b) => [cx + fx * a + ux * b, cy + fy * a + uy * b];   // a: toward the front, b: up
  const band = (a0, a1, b0, b1, r, g, o) => bc.poly([at(a0, b1), at(a1, b1), at(a1, b0), at(a0, b0)], r, g, o);
  band(-back, front, -3, 3, R.strap, 20, { mid: .7 });
  band(-back, front, 1.9, 3, R.gold, 20, { mid: .7, noOutline: true }); band(-back, front, -3, -1.9, R.gold, 20, { mid: .7, noOutline: true });
  band(-back * .8, -back * .44, -4, 4, R.gold, 21, { mid: .5 });
  const pc = front * .3, pw = 7.4;
  band(pc - pw, pc + pw, -6.4, 6.4, R.gold, 22, { mid: .25 });
  band(pc - pw + 1.6, pc + pw - 1.6, -4.8, 4.8, R.deep, 22, { flat: .35, noOutline: true });
  band(pc - pw + 2.6, pc + pw - 2.6, -3.8, 3.8, R.gold, 22, { mid: .2, noOutline: true });
  const [gx, gy] = at(pc, 0); bc.ball(gx, gy, 1.8, R.gem, 23);
}
function skirt(bc, P, dims, sk, fx, fy, ux, uy, grp, back, o) {
  const hx = P[0], hy = P[1], len = (sk.len || .5);
  const kn = [P[J.kN * 2], P[J.kN * 2 + 1]], kf = [P[J.kF * 2], P[J.kF * 2 + 1]];
  const w = dims.prof[1][2] + 1, wb = dims.prof[1][1] + 1;
  const fdx = (kn[0] + kf[0]) / 2 - hx, fdy = (kn[1] + kf[1]) / 2 - hy;
  const sw = (o.sway || 0) * .6;
  const spread = Math.abs(kn[0] - kf[0]) * .35 + (sk.open ? 4 : 1.5);
  const top = [hx + ux * 6, hy + uy * 6];
  const hem = [hx + fdx * len * 1.9, hy + fdy * len * 1.9 + 2];
  const pts = [[top[0] - fx * wb, top[1] - fy * wb], [top[0] + fx * w, top[1] + fy * w], [hem[0] + fx * (w * .62 + spread) + sw, hem[1] + fy * 4], [hem[0] - fx * (wb * .62 + spread) + sw, hem[1] - fy * 4]];
  if (back) { if (!sk.open) return; bc.poly(pts, ramp(sk.c1), grp, { folds: 2, dark: .35 }); return; }
  if (sk.open) { // coat flaps: only the near half, leaving the legs visible
    const m = [(pts[0][0] * .45 + pts[1][0] * .55), (pts[0][1] + pts[1][1]) / 2], mh = [(pts[3][0] * .62 + pts[2][0] * .38), (pts[2][1] + pts[3][1]) / 2];
    bc.poly([pts[0], m, mh, pts[3]], ramp(sk.c1), grp, { folds: 1.5, clearTop: true });
    return;
  }
  bc.poly(pts, ramp(sk.c1), grp, { folds: 2.5, phase: sw, clearTop: true });
}
export const FLASH_WHITE = packHex('#ffffff');
