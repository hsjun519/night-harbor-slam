"use strict";
const __m = {};
// ---- core/util.js
__m["core/util.js"] = (function () {
// Shared math, easing, RNG and event helpers. No DOM access, so the simulation can run in Node tests.
const VIEW_W = 640, VIEW_H = 360;
const TAU = Math.PI * 2, DEG = Math.PI / 180;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const invLerp = (a, b, v) => (b === a ? 0 : clamp01((v - a) / (b - a)));
const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const damp = (v, t, rate, dt) => lerp(v, t, 1 - Math.exp(-rate * dt));
const sgn = v => (v < 0 ? -1 : 1);
const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length) % arr.length];
const wrapAngle = a => { a = (a + 180) % 360; if (a < 0) a += 360; return a - 180; };

const EASE = {
  lin: t => t,
  in: t => t * t,
  in3: t => t * t * t,
  out: t => 1 - (1 - t) * (1 - t),
  out3: t => 1 - Math.pow(1 - t, 3),
  io: t => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  io3: t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  elastic: t => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (TAU / 3)) + 1),
  bounce: t => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375;
    return n * (t -= 2.625 / d) * t + .984375;
  },
  hold: () => 0,
};

// Small deterministic generator. Every system that needs randomness takes one of these.
class RNG {
  constructor(seed = 1) { this.s = seed >>> 0 || 1; }
  next() {
    let t = (this.s += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length) % arr.length]; }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  weighted(list, w) {
    let sum = 0;
    for (const e of list) sum += Math.max(0, w(e));
    let r = this.next() * sum;
    for (const e of list) { r -= Math.max(0, w(e)); if (r <= 0) return e; }
    return list[list.length - 1];
  }
}

class Emitter {
  constructor() { this.map = new Map(); }
  on(type, fn) { if (!this.map.has(type)) this.map.set(type, []); this.map.get(type).push(fn); return () => this.off(type, fn); }
  off(type, fn) { const l = this.map.get(type); if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } }
  emit(type, data) { const l = this.map.get(type); if (l) for (const fn of l.slice()) fn(data); }
}

const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const deepClone = o => JSON.parse(JSON.stringify(o));
const fmtMoney = n => '₩' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const fmtTime = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

// Korean particle helper: josa('철수','이/가') -> '철수가'
function josa(word, pair) {
  const [a, b] = pair.split('/');
  const c = word.charCodeAt(word.length - 1);
  let has;
  if (c >= 0xAC00 && c <= 0xD7A3) {
    const jong = (c - 0xAC00) % 28;
    has = jong !== 0;
    if (pair === '으로/로' && jong === 8) has = false;
  } else has = /[013678LMNR]$/i.test(word);
  return word + (has ? a : b);
}

// Canvas factory. Returns null outside the browser.
function makeCanvas(w, h) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
  return c;
}
function ctxOf(c, opts) { const g = c.getContext('2d', opts); g.imageSmoothingEnabled = false; return g; }

return { VIEW_W, TAU, clamp, clamp01, lerp, invLerp, approach, damp, sgn, pick, wrapAngle, EASE, RNG, Emitter, hashStr, deepClone, fmtMoney, fmtTime, josa, makeCanvas, ctxOf };
})();
// ---- render/screen.js
__m["render/screen.js"] = (function () {
// Output stage. The game draws two 640x360 layers (world, ui); WebGL scales them with sharp-bilinear
// filtering and adds bloom, camera zoom/shake, tint, vignette and flashes. Falls back to plain 2D.
const { VIEW_W, VIEW_H, makeCanvas, ctxOf, clamp, damp } = __m["core/util.js"];
const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
const FS_BRIGHT = `precision mediump float;varying vec2 v;uniform sampler2D T;uniform vec2 px;
void main(){vec3 c=vec3(0.);for(int i=0;i<2;i++)for(int j=0;j<2;j++){vec3 s=texture2D(T,v+vec2(float(i)-.5,float(j)-.5)*px*2.).rgb;float m=max(s.r,max(s.g,s.b));float n=min(s.r,min(s.g,s.b));float w=smoothstep(.62,1.,m)*(.35+.65*smoothstep(.1,.6,m-n))+smoothstep(.93,1.,n)*.5;c+=s*w;}gl_FragColor=vec4(c*.25,1.);}`;
const FS_BLUR = `precision mediump float;varying vec2 v;uniform sampler2D T;uniform vec2 d;
void main(){vec3 c=texture2D(T,v).rgb*.227;c+=(texture2D(T,v+d*1.385).rgb+texture2D(T,v-d*1.385).rgb)*.316;c+=(texture2D(T,v+d*3.231).rgb+texture2D(T,v-d*3.231).rgb)*.07;gl_FragColor=vec4(c,1.);}`;
const FS_FINAL = `precision mediump float;varying vec2 v;uniform sampler2D W,U,B;uniform vec2 res;uniform vec4 cam;uniform vec2 shake;uniform vec4 flash;uniform vec3 tint;uniform float chroma,sat,vig,bloom,scan,radial,time;
const vec2 T=vec2(640.,360.);
vec2 sharp(vec2 uv,float k){vec2 t=uv*T;vec2 f=floor(t);vec2 s=t-f;float r=.5-.5/max(k,1.);vec2 c=s-.5;vec2 q=(c-clamp(c,-r,r))*max(k,1.)+.5;return (f+q)/T;}
vec3 world(vec2 uv,float k){return texture2D(W,sharp(clamp(uv,vec2(.001),vec2(.999)),k)).rgb;}
void main(){
 vec2 p=v-.5;float cs=cos(cam.w),sn=sin(cam.w);p.x*=1.7778;p=mat2(cs,-sn,sn,cs)*p;p.x/=1.7778;
 vec2 uv=p/cam.z+cam.xy+shake;float k=res.x/640.*cam.z;
 vec3 c;
 if(radial>.001){c=vec3(0.);for(int i=0;i<6;i++){float t=float(i)/6.*radial;c+=world(mix(uv,cam.xy,t*.12),k);}c/=6.;}
 else if(chroma>.001){vec2 o=(v-.5)*chroma*.02;c=vec3(world(uv+o,k).r,world(uv,k).g,world(uv-o,k).b);}
 else c=world(uv,k);
 c+=texture2D(B,clamp(uv,0.,1.)).rgb*bloom;
 float g=dot(c,vec3(.3,.59,.11));c=mix(vec3(g),c,sat)*tint;
 float d=length((v-.5)*vec2(1.,.8));c*=1.-vig*smoothstep(.32,.78,d);
 c=mix(c,flash.rgb,flash.a);
 if(scan>.001){float y=v.y*360.;c*=1.-scan*.22*smoothstep(.25,.5,abs(fract(y)-.5));}
 vec4 u=texture2D(U,sharp(v,res.x/640.));
 c=c*(1.-u.a)+u.rgb;
 gl_FragColor=vec4(c,1.);}`;

class Screen {
  constructor(canvas) {
    this.canvas = canvas;
    this.world = makeCanvas(VIEW_W, VIEW_H); this.ui = makeCanvas(VIEW_W, VIEW_H);
    this.w = ctxOf(this.world, { alpha: false }); this.u = ctxOf(this.ui);
    // Camera and post values, eased every frame by update().
    this.fx = { zoom: 1, cx: .5, cy: .5, rot: 0, sx: 0, sy: 0, chroma: 0, radial: 0, sat: 1, vig: .32, bloom: .85, scan: 0, flash: [1, 1, 1, 0], tint: [1, 1, 1] };
    this.goal = { zoom: 1, cx: .5, cy: .5, rot: 0, sat: 1, vig: .32, bloom: .85, tint: [1, 1, 1] };
    this.trauma = 0; this.time = 0; this.zoomRate = 9; this.shakeScale = 1; this.flashScale = 1;
    this.gl = null;
    this.initGL();
    this.resize();
  }
  initGL() {
    const gl = this.canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) { this.g2 = ctxOf(this.canvas); return; }
    const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = fs => {
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
      return { p, u };
    };
    try {
      this.pBright = prog(FS_BRIGHT); this.pBlur = prog(FS_BLUR); this.pFinal = prog(FS_FINAL);
    } catch (e) { console.warn('WebGL unavailable, using 2D output', e); const c2 = makeCanvas(1, 1); void c2; this.gl = null; this.replaceWith2D(); return; }
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const tex = (w, h, linear) => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
      if (w) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      return t;
    };
    this.tW = tex(0, 0, true); this.tU = tex(0, 0, true);
    this.bw = 160; this.bh = 90;
    this.fA = { t: tex(this.bw, this.bh, true), f: gl.createFramebuffer() }; this.fB = { t: tex(this.bw, this.bh, true), f: gl.createFramebuffer() };
    for (const f of [this.fA, this.fB]) { gl.bindFramebuffer(gl.FRAMEBUFFER, f.f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, f.t, 0); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    this.gl = gl;
    this.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true; });
    this.canvas.addEventListener('webglcontextrestored', () => { this.lost = false; this.gl = null; this.initGL(); });
  }
  replaceWith2D() {
    const n = this.canvas.cloneNode(); this.canvas.replaceWith(n); this.canvas = n; this.g2 = ctxOf(n);
  }
  resize() {
    const W = Math.max(320, window.innerWidth), H = Math.max(180, window.innerHeight), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const s = Math.min(W / VIEW_W, H / VIEW_H);
    let cw = Math.round(VIEW_W * s), ch = Math.round(VIEW_H * s);
    this.canvas.style.width = cw + 'px'; this.canvas.style.height = ch + 'px';
    // Cap the backing store at 1920 wide: the source is 640x360, more pixels only cost fill rate.
    const pw = Math.min(Math.round(cw * dpr), 1920), ph = Math.round(pw * VIEW_H / VIEW_W);
    if (this.canvas.width !== pw || this.canvas.height !== ph) { this.canvas.width = pw; this.canvas.height = ph; }
    this.scale = s;
  }
  shake(a) { this.trauma = Math.min(1, Math.max(this.trauma, a * this.shakeScale)); }
  flash(r, g, b, a) { const f = this.fx.flash; f[0] = r; f[1] = g; f[2] = b; f[3] = Math.max(f[3], a * this.flashScale); }
  // Focus in view pixels.
  focus(x, y, zoom) { this.goal.zoom = zoom; const m = .5 / zoom; this.goal.cx = clamp(x / VIEW_W, m, 1 - m); this.goal.cy = clamp(1 - y / VIEW_H, m, 1 - m); }
  unfocus() { this.goal.zoom = 1; this.goal.cx = .5; this.goal.cy = .5; this.goal.rot = 0; }
  resetFx() {
    this.unfocus(); this.trauma = 0;
    Object.assign(this.goal, { sat: 1, vig: .32, bloom: .85, tint: [1, 1, 1] });
    Object.assign(this.fx, { zoom: 1, cx: .5, cy: .5, rot: 0, chroma: 0, radial: 0, sat: 1 });
    this.fx.flash[3] = 0;
  }
  update(dt) {
    const f = this.fx, g = this.goal;
    this.time += dt;
    for (const k of ['zoom', 'cx', 'cy', 'rot']) f[k] = damp(f[k], g[k], this.zoomRate, dt);
    for (const k of ['sat', 'vig', 'bloom']) f[k] = damp(f[k], g[k], 6, dt);
    for (let i = 0; i < 3; i++) f.tint[i] = damp(f.tint[i], g.tint[i], 6, dt);
    f.chroma = damp(f.chroma, 0, 7, dt); f.radial = damp(f.radial, 0, 6, dt); f.flash[3] = damp(f.flash[3], 0, 8, dt);
    if (f.flash[3] < .01) f.flash[3] = 0;
    this.trauma = Math.max(0, this.trauma - dt * 1.9);
    const s = this.trauma * this.trauma, t = this.time * 38;
    f.sx = s * .014 * (Math.sin(t * 1.3) + Math.sin(t * 2.17 + 1)) * .7; f.sy = s * .022 * (Math.sin(t * 1.7 + 2) + Math.sin(t * 2.9)) * .7;
  }
  present() {
    const gl = this.gl, f = this.fx;
    if (!gl) {
      const g = this.g2, W = this.canvas.width, H = this.canvas.height;
      if (!g) return;
      g.imageSmoothingEnabled = false;
      const z = f.zoom, sw = VIEW_W / z, sh = VIEW_H / z, sx = clamp((f.cx + f.sx) * VIEW_W - sw / 2, 0, VIEW_W - sw), sy = clamp((1 - f.cy - f.sy) * VIEW_H - sh / 2, 0, VIEW_H - sh);
      g.drawImage(this.world, sx, sy, sw, sh, 0, 0, W, H);
      if (f.flash[3] > 0) { g.fillStyle = `rgba(${f.flash[0] * 255},${f.flash[1] * 255},${f.flash[2] * 255},${f.flash[3]})`; g.fillRect(0, 0, W, H); }
      g.drawImage(this.ui, 0, 0, W, H);
      return;
    }
    if (this.lost) return;
    const up = (unit, t, c) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); };
    up(0, this.tW, this.world); up(1, this.tU, this.ui);
    const draw = (fb, w, h) => { gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, w, h); gl.drawArrays(gl.TRIANGLES, 0, 3); };
    const bind = (unit, t) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); };
    gl.useProgram(this.pBright.p); gl.uniform1i(this.pBright.u.T, 0); gl.uniform2f(this.pBright.u.px, 1 / VIEW_W, 1 / VIEW_H); draw(this.fA.f, this.bw, this.bh);
    gl.useProgram(this.pBlur.p); gl.uniform1i(this.pBlur.u.T, 2);
    for (let i = 0; i < 2; i++) {
      bind(2, this.fA.t); gl.uniform2f(this.pBlur.u.d, (1 + i) / this.bw, 0); draw(this.fB.f, this.bw, this.bh);
      bind(2, this.fB.t); gl.uniform2f(this.pBlur.u.d, 0, (1 + i) / this.bh); draw(this.fA.f, this.bw, this.bh);
    }
    const P = this.pFinal, u = P.u;
    gl.useProgram(P.p); bind(2, this.fA.t);
    gl.uniform1i(u.W, 0); gl.uniform1i(u.U, 1); gl.uniform1i(u.B, 2);
    gl.uniform2f(u.res, this.canvas.width, this.canvas.height); gl.uniform4f(u.cam, f.cx, f.cy, f.zoom, f.rot); gl.uniform2f(u.shake, f.sx, f.sy);
    gl.uniform4f(u.flash, f.flash[0], f.flash[1], f.flash[2], f.flash[3]); gl.uniform3f(u.tint, f.tint[0], f.tint[1], f.tint[2]);
    gl.uniform1f(u.chroma, f.chroma); gl.uniform1f(u.sat, f.sat); gl.uniform1f(u.vig, f.vig); gl.uniform1f(u.bloom, f.bloom); gl.uniform1f(u.scan, f.scan); gl.uniform1f(u.radial, f.radial);
    if (u.time) gl.uniform1f(u.time, this.time);
    draw(null, this.canvas.width, this.canvas.height);
  }
  // View-space mouse position helper.
  toView(clientX, clientY) { const r = this.canvas.getBoundingClientRect(); return [(clientX - r.left) / r.width * VIEW_W, (clientY - r.top) / r.height * VIEW_H]; }
}

return { Screen };
})();
// ---- core/InputManager.js
__m["core/InputManager.js"] = (function () {
// Keyboard and gamepad mapped to actions. Bindings are data and can be changed in the settings screen.
const ACTIONS = {
  left: '왼쪽', right: '오른쪽', up: '점프 / 위', down: '방어 / 아래', atk: '공격', grab: '잡기', dodge: '회피 / 반격', fin: '피니셔', interact: '대화 / 조사', door: '문 / 이동', info: '선수 정보', map: '지도', pause: '일시정지',
};
const DEFAULT_KEYS = {
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
  atk: ['KeyJ'], grab: ['KeyK'], dodge: ['KeyL'], fin: ['Space'], interact: ['KeyE'], door: ['KeyF'], info: ['Tab'], map: ['KeyM'], pause: ['Escape', 'KeyP'],
};
// Menus also accept these.
const MENU = { confirm: ['Enter', 'Space', 'KeyJ', 'KeyE'], cancel: ['Escape', 'Backspace', 'KeyL'] };
const PAD = { up: [12], down: [13], left: [14], right: [15], atk: [2], grab: [3], dodge: [1], fin: [5, 7], jumpPad: [0], guardPad: [4, 6], pause: [9], info: [8], interact: [0], door: [3], confirm: [0], cancel: [1], map: [8] };
const NAMES = { Space: 'Space', Escape: 'Esc', Enter: 'Enter', Tab: 'Tab', Backspace: '←Bksp', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl', AltLeft: 'Alt', Backquote: '`', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=' };
function keyLabel(code) { if (!code) return '?'; if (NAMES[code]) return NAMES[code]; if (code.startsWith('Key')) return code.slice(3); if (code.startsWith('Digit')) return code.slice(5); if (code.startsWith('Numpad')) return 'N' + code.slice(6); return code; }

class InputManager {
  constructor() {
    this.keys = JSON.parse(JSON.stringify(DEFAULT_KEYS));
    this.held = new Set(); this.downNow = new Set(); this.upNow = new Set();
    this.padHeld = new Set(); this.padPrev = new Set(); this.axisX = 0; this.axisY = 0;
    this.device = 'kb'; this.textMode = false; this.capture = null; this.any = false; this.lastCode = null;
    this.focusLost = false;
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', e => this.onKey(e, true));
      window.addEventListener('keyup', e => this.onKey(e, false));
      window.addEventListener('blur', () => { this.held.clear(); this.focusLost = true; });
    }
  }
  setBindings(b) { if (b) for (const k in DEFAULT_KEYS) if (Array.isArray(b[k]) && b[k].length) this.keys[k] = b[k].slice(0, 2); }
  onKey(e, d) {
    if (this.textMode) return;
    const c = e.code;
    if (this.capture && d) { e.preventDefault(); const fn = this.capture; this.capture = null; fn(c); return; }
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace'].includes(c) || (c === 'F3')) e.preventDefault();
    if (d) { if (!e.repeat && !this.held.has(c)) this.downNow.add(c); this.held.add(c); this.device = 'kb'; this.any = true; this.lastCode = c; }
    else { this.held.delete(c); this.upNow.add(c); }
  }
  // Call once per frame after reading: clears the edges.
  endFrame() { this.downNow.clear(); this.upNow.clear(); this.padPrev = new Set(this.padHeld); this.any = false; }
  poll() {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    this.padHeld.clear(); this.axisX = 0; this.axisY = 0;
    for (const p of pads || []) {
      if (!p || !p.connected) continue;
      p.buttons.forEach((b, i) => { if (b.pressed || b.value > .5) this.padHeld.add(i); });
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (Math.abs(ax) > .35) this.axisX = ax; if (Math.abs(ay) > .5) this.axisY = ay;
      if (this.padHeld.size || Math.abs(ax) > .35 || Math.abs(ay) > .5) this.device = 'pad';
      break;
    }
    if (this.axisX < -.35) this.padHeld.add(14); if (this.axisX > .35) this.padHeld.add(15); if (this.axisY < -.5) this.padHeld.add(12); if (this.axisY > .5) this.padHeld.add(13);
    for (const b of this.padHeld) if (!this.padPrev.has(b)) this.any = true;
  }
  codes(a) { return this.keys[a] || MENU[a] || []; }
  padBtns(a) { const r = (PAD[a] || []).slice(); if (a === 'up') r.push(...PAD.jumpPad); if (a === 'down') r.push(...PAD.guardPad); return r; }
  down(a) { for (const c of this.codes(a)) if (this.held.has(c)) return true; for (const b of this.padBtns(a)) if (this.padHeld.has(b)) return true; return false; }
  pressed(a) { for (const c of this.codes(a)) if (this.downNow.has(c)) return true; for (const b of this.padBtns(a)) if (this.padHeld.has(b) && !this.padPrev.has(b)) return true; return false; }
  // menu helpers
  menuPressed(a) {
    if (a === 'confirm' || a === 'cancel') { for (const c of MENU[a]) if (this.downNow.has(c)) return true; for (const b of PAD[a]) if (this.padHeld.has(b) && !this.padPrev.has(b)) return true; return false; }
    return this.pressed(a);
  }
  rawPressed(code) { return this.downNow.has(code); }
  // Fill a fighter intent from the current state.
  fillIntent(I) {
    I.mx = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0);
    I.up = this.down('up'); I.down = this.down('down'); I.downEdge = this.pressed('down');
    I.jump = this.pressed('up'); I.atk = this.pressed('atk'); I.grab = this.pressed('grab'); I.dodge = this.pressed('dodge'); I.fin = this.pressed('fin');
  }
  label(a) {
    if (this.device === 'pad') { const n = { atk: 'X', grab: 'Y', dodge: 'B', fin: 'RB', up: 'A', down: 'LB', interact: 'A', door: 'Y', pause: 'Start', info: 'Back', map: 'Back', left: '◀', right: '▶', confirm: 'A', cancel: 'B' }; return n[a] || a; }
    if (a === 'confirm') return 'Enter'; if (a === 'cancel') return 'Esc';
    return keyLabel((this.keys[a] || [])[0]);
  }
  captureNext(fn) { this.capture = fn; }
  clear() { this.held.clear(); this.downNow.clear(); this.upNow.clear(); }
}

return { ACTIONS, DEFAULT_KEYS, keyLabel, InputManager };
})();
// ---- core/AudioManager.js
__m["core/AudioManager.js"] = (function () {
// All sound is synthesised with WebAudio: hits, slams, ropes, bell, crowd and an original chiptune soundtrack.
const NOTE = n => { const m = /^([A-G])(#|b)?(-?\d)$/.exec(n); if (!m) return 0; const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); return 440 * Math.pow(2, (base + (+m[3] + 1) * 12 - 69) / 12); };
const CHORD = { M: [0, 4, 7], m: [0, 3, 7], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], '7': [0, 4, 7, 10], m9: [0, 3, 7, 10, 14], M9: [0, 4, 7, 11, 14], sus: [0, 5, 7], dim: [0, 3, 6], add9: [0, 4, 7, 14] };
const midiF = n => 440 * Math.pow(2, (n - 69) / 12);
const rootMidi = r => { const m = /^([A-G])(#|b)?$/.exec(r); return 48 + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };

/* Tracks: bpm, swing, chords (one per bar, 'Root:quality'), lead (16 steps per bar, note or '.' or '-' to hold),
   bass pattern over chord tones, drums (k kick, s snare, h hat, o open hat per 16 steps). All original. */
const TRACKS = {
  title: { bpm: 92, chords: ['A:m9', 'F:M7', 'C:add9', 'G:sus', 'A:m9', 'F:M7', 'D:m7', 'E:7'], lead: ['E5 - - . A5 - G5 . E5 - D5 . C5 - . .', 'A4 - - . C5 - D5 . E5 - - . G5 - E5 .', 'G5 - - . E5 - D5 . C5 - D5 . E5 - . .', 'D5 - - - - . B4 . D5 - E5 . D5 - . .', 'E5 - - . A5 - B5 . C6 - B5 . A5 - . .', 'A5 - G5 . F5 - E5 . F5 - G5 . A5 - . .', 'F5 - E5 . D5 - C5 . D5 - E5 . F5 - . .', 'E5 - - - G#5 - - - B5 - - - E5 - . .'], bass: '1 . . 1 . . 5 . 1 . . 1 . 3 5 .', drums: 'k . . . s . . . k . k . s . . h', pad: 1, lead2: 'pulse' },
  lobby: { bpm: 84, swing: .14, chords: ['F:M7', 'E:m7', 'D:m7', 'G:7', 'C:M7', 'A:m7', 'D:m7', 'G:7'], lead: ['A5 . C6 . E6 - - . D6 . C6 . A5 - . .', 'G5 . B5 . D6 - - . C6 . B5 . G5 - . .', 'F5 . A5 . C6 - - . A5 . G5 . F5 - . .', 'G5 - - . B5 - - . D6 - C6 . B5 - . .', 'E5 . G5 . B5 - - . A5 . G5 . E5 - . .', 'C6 - - . A5 . . . G5 . E5 . C5 - . .', 'D5 . F5 . A5 . C6 . A5 - F5 . D5 - . .', 'B4 . D5 . F5 . G5 - - - . . . . . .'], bass: '1 . . . 5 . . . 1 . . 3 . . 5 .', drums: 'k . h . s . h k . . h . s . h .', pad: 1, keys: 1 },
  office: { bpm: 104, chords: ['C:M', 'A:m', 'F:M', 'G:M', 'C:M', 'E:m', 'F:M', 'G:sus'], lead: ['E5 . G5 . C6 - - . B5 . G5 . E5 - . .', 'C5 . E5 . A5 - - . G5 . E5 . C5 - . .', 'F5 . A5 . C6 - - . A5 . F5 . A5 - . .', 'G5 - - . F5 . E5 . D5 - - . . . . .', 'E5 . G5 . C6 - - . D6 . E6 . C6 - . .', 'B5 - - . G5 . E5 . G5 - - . . . . .', 'A5 . C6 . A5 . F5 . A5 . C6 . F6 - . .', 'G5 - - - - . D5 . G5 - - - . . . .'], bass: '1 . 5 . 1 . 5 . 1 . 5 . 3 . 5 .', drums: 'k . h . s . h . k . h k s . h .', brass: 1 },
  gym: { bpm: 128, chords: ['E:m', 'C:M', 'D:M', 'B:m', 'E:m', 'C:M', 'A:m', 'B:7'], lead: ['E5 . E5 . G5 . A5 . B5 - - . A5 . G5 .', 'E5 . . . G5 . E5 . C5 - - . . . . .', 'F#5 . F#5 . A5 . B5 . D6 - - . B5 . A5 .', 'F#5 . . . D5 . F#5 . B4 - - . . . . .', 'E5 . E5 . G5 . A5 . B5 - - . E6 . D6 .', 'C6 . B5 . G5 . E5 . G5 - - . . . . .', 'A5 . G5 . E5 . C5 . E5 . G5 . A5 . . .', 'B5 - - . D#6 - - . F#6 - - . B5 . . .'], bass: '1 1 . 1 1 . 1 . 1 1 . 1 5 . 3 .', drums: 'k . h . s . h k k . h . s . h h', lead2: 'square' },
  street: { bpm: 76, swing: .2, chords: ['D:m9', 'G:7', 'C:M9', 'A:7', 'D:m9', 'G:7', 'E:m7', 'A:7'], lead: ['F5 - A5 . C6 - - . D6 . C6 . A5 - - .', 'B5 . A5 . G5 - F5 . D5 - - - . . . .', 'E5 - G5 . B5 - - . D6 . B5 . G5 - - .', 'C#6 - - . A5 . G5 . E5 - - - . . . .', 'F5 - A5 . C6 - - . E6 - D6 . C6 - - .', 'B5 - - . G5 . F5 . D5 - F5 . G5 - - .', 'G5 - B5 . D6 - - . B5 . A5 . G5 - - .', 'A5 - - - G5 - - - E5 - - - C#5 - - -'], bass: '1 . . 5 . . 1 . 3 . . 5 . . 6 .', drums: 'k . . h s . . h k . k h s . . h', pad: 1, keys: 1 },
  clinic: { bpm: 70, chords: ['C:M7', 'F:M7', 'A:m7', 'G:sus', 'C:M7', 'F:M7', 'D:m7', 'G:M'], lead: ['E5 - - - G5 - - - B5 - - - A5 - - -', 'A5 - - - G5 - - - F5 - - - E5 - - -', 'C5 - - - E5 - - - G5 - - - A5 - - -', 'G5 - - - - - - - D5 - - - - - - -', 'E5 - - - G5 - - - C6 - - - B5 - - -', 'A5 - - - C6 - - - A5 - - - G5 - - -', 'F5 - - - A5 - - - D6 - - - C6 - - -', 'B5 - - - - - - - G5 - - - - - - -'], bass: '1 . . . . . . . 5 . . . . . . .', drums: '. . . . . . . . . . . . . . . .', pad: 1, soft: 1 },
  shop: { bpm: 112, chords: ['G:M', 'E:m', 'C:M', 'D:M', 'G:M', 'B:m', 'C:M', 'D:7'], lead: ['B5 . D6 . B5 . G5 . A5 . B5 . G5 - . .', 'G5 . B5 . G5 . E5 . F#5 . G5 . E5 - . .', 'E5 . G5 . C6 . E6 . D6 . C6 . G5 - . .', 'F#5 - A5 . D6 - - . C6 . A5 . F#5 - . .', 'B5 . D6 . G6 . D6 . B5 . G5 . B5 - . .', 'D6 . B5 . F#5 . D5 . F#5 . B5 . D6 - . .', 'E6 . C6 . G5 . E5 . G5 . C6 . E6 - . .', 'F#6 - - . D6 . A5 . F#5 . A5 . D6 - . .'], bass: '1 . 5 . 1 . 5 . 1 . 5 . 1 . 5 .', drums: 'k . h . s . h . k k h . s . h .', lead2: 'pulse' },
  match: { bpm: 142, chords: ['E:m', 'C:M', 'D:M', 'B:M', 'E:m', 'C:M', 'A:m', 'B:7'], lead: ['E5 . G5 . B5 . E6 . D6 . B5 . G5 . A5 .', 'G5 - - . E5 . G5 . C6 - - . B5 . G5 .', 'F#5 . A5 . D6 . F#6 . E6 . D6 . A5 . B5 .', 'D#6 - - . B5 . F#5 . D#5 - - . . . . .', 'E5 . G5 . B5 . E6 . G6 . F#6 . E6 . D6 .', 'C6 - - . G5 . E5 . G5 - C6 . E6 - - .', 'A5 . C6 . E6 . A6 . G6 . E6 . C6 . A5 .', 'B5 - - - D#6 - - - F#6 - - - B6 - - -'], bass: '1 1 1 . 1 1 5 . 1 1 1 . 8 . 5 .', drums: 'k . h . s . h . k k h . s . h o', lead2: 'square', drive: 1 },
  boss: { bpm: 152, chords: ['C:m', 'Ab:M', 'Bb:M', 'G:M', 'C:m', 'F:m', 'D:dim', 'G:7'], lead: ['C5 . Eb5 . G5 . C6 . B5 . G5 . Eb5 . D5 .', 'C5 - - . Eb5 . Ab5 . C6 - - . Ab5 . Eb5 .', 'D5 . F5 . Bb5 . D6 . C6 . Bb5 . F5 . D5 .', 'B4 - - . D5 . G5 . B5 - - . . . . .', 'C6 . G5 . Eb5 . C5 . Eb5 . G5 . C6 . Eb6 .', 'F6 - - . C6 . Ab5 . F5 - - . Ab5 . C6 .', 'D6 . Ab5 . F5 . D5 . F5 . Ab5 . B5 . D6 .', 'G6 - - - F6 - - - D6 - - - B5 - - -'], bass: '1 1 . 1 1 . 1 . 1 1 . 1 5 . 8 .', drums: 'k k h . s . h k k . h k s . h o', lead2: 'square', drive: 1 },
  rumble: { bpm: 160, chords: ['A:m', 'F:M', 'G:M', 'E:M', 'A:m', 'F:M', 'D:m', 'E:7'], lead: ['A5 . C6 . E6 . A6 . G6 . E6 . C6 . E6 .', 'F6 - - . C6 . A5 . C6 - - . F6 . E6 .', 'D6 . G5 . B5 . D6 . G6 . F6 . D6 . B5 .', 'G#5 - - . B5 . E6 . G#6 - - . . . . .', 'A5 . C6 . E6 . A6 . C7 . B6 . A6 . E6 .', 'F6 - - . A6 . F6 . C6 - - . A5 . C6 .', 'D6 . F6 . A6 . F6 . D6 . A5 . F5 . A5 .', 'B5 - - - D6 - - - E6 - - - G#6 - - -'], bass: '1 1 1 1 1 1 5 5 1 1 1 1 8 8 5 5', drums: 'k . h k s . h k k . h k s . h o', lead2: 'square', drive: 1 },
};
const JINGLES = {
  win: { bpm: 150, notes: 'C5 E5 G5 C6 - - G5 C6 E6 - - - - - - -', chord: 'C:M' },
  lose: { bpm: 90, notes: 'G4 - F4 - E4 - D4 - C4 - - - - - - -', chord: 'C:m' },
  fanfare: { bpm: 132, notes: 'G4 - C5 - E5 - G5 - - - E5 G5 C6 - - - - -', chord: 'C:M' },
  gameover: { bpm: 70, notes: 'E4 - - D#4 - - D4 - - C#4 - - - - - - -', chord: 'E:m' },
  level: { bpm: 180, notes: 'C5 E5 G5 C6 E6 G6 C7 - -', chord: 'C:M' },
  title: { bpm: 120, notes: 'A4 C5 E5 A5 - - G5 - E5 - - -', chord: 'A:m' },
};

class AudioManager {
  constructor() {
    this.ctx = null; this.vol = { master: .8, music: .55, sfx: .85 }; this.muted = false;
    this.track = null; this.nextTime = 0; this.step = 0; this.timer = null; this.crowdLevel = 0; this.crowdNode = null; this.voices = 0;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.vol.master; this.master.connect(c.destination);
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(this.master);
    this.out = comp;
    this.mus = c.createGain(); this.mus.gain.value = this.vol.music; this.mus.connect(comp);
    this.fx = c.createGain(); this.fx.gain.value = this.vol.sfx; this.fx.connect(comp);
    const len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    let p = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; p = .97 * p + .03 * w; d[i] = w * .6 + p * 2.2; }
    this.noise = b;
    const pw = (duty) => { const n = 32, re = new Float32Array(n), im = new Float32Array(n); for (let k = 1; k < n; k++) re[k] = 2 / (k * Math.PI) * Math.sin(k * Math.PI * duty); return c.createPeriodicWave(re, im); };
    this.pulse25 = pw(.25); this.pulse12 = pw(.125);
    this.startCrowd();
    if (this.pendingTrack) { const t = this.pendingTrack; this.pendingTrack = null; this.music(t); }
  }
  setVolume(k, v) { this.vol[k] = v; if (!this.ctx) return; const n = k === 'master' ? this.master : k === 'music' ? this.mus : this.fx; n.gain.setTargetAtTime(this.muted && k === 'master' ? 0 : v, this.ctx.currentTime, .05); }
  // ---- primitives ----
  env(g, t, a, peak, d, end = .0001) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(end, t + a + d); }
  tone(type, f0, f1, dur, vol, t = 0, dest = this.fx, opts = {}) {
    const c = this.ctx; if (!c) return;
    const T = c.currentTime + t, o = c.createOscillator(), g = c.createGain();
    if (type === 'pulse') o.setPeriodicWave(this.pulse25); else if (type === 'thin') o.setPeriodicWave(this.pulse12); else o.type = type;
    o.frequency.setValueAtTime(f0, T); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), T + dur);
    if (opts.detune) o.detune.value = opts.detune;
    this.env(g, T, opts.a || .004, vol, dur);
    let node = o;
    if (opts.lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = opts.lp; fl.Q.value = opts.q || .7; node.connect(fl); node = fl; }
    node.connect(g); g.connect(dest);
    o.start(T); o.stop(T + (opts.a || .004) + dur + .05);
  }
  burst(dur, vol, type, freq, q, t = 0, dest = this.fx, f1) {
    const c = this.ctx; if (!c) return;
    const T = c.currentTime + t, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.loop = true;
    f.type = type; f.frequency.setValueAtTime(freq, T); if (f1) f.frequency.exponentialRampToValueAtTime(f1, T + dur); f.Q.value = q;
    this.env(g, T, .002, vol, dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(T, Math.random() * 1.5); s.stop(T + dur + .05);
  }
  // ---- effects ----
  sfx(name, o = {}) {
    if (!this.ctx || this.muted) return;
    const p = o.p != null ? o.p : 1, pitch = o.pitch || 1, R = () => .92 + Math.random() * .16;
    switch (name) {
      case 'punch1': this.burst(.05, .5, 'bandpass', 1100 * R(), 1.4); this.tone('sine', 150 * R(), 60, .07, .55); break;
      case 'punch2': this.burst(.08, .6, 'bandpass', 800 * R(), 1.2); this.tone('sine', 120 * R(), 45, .12, .7); this.burst(.02, .3, 'highpass', 3000, .7); break;
      case 'punch3': this.burst(.12, .7, 'lowpass', 1400 * R(), 1); this.tone('sine', 110 * R(), 38, .18, .85); this.tone('square', 90, 40, .06, .12); this.burst(.025, .4, 'highpass', 3500, .7); break;
      case 'kick1': this.burst(.06, .45, 'bandpass', 700 * R(), 1.2); this.tone('sine', 130 * R(), 55, .08, .55); break;
      case 'kick2': this.burst(.1, .6, 'bandpass', 600 * R(), 1); this.tone('sine', 115 * R(), 42, .14, .75); break;
      case 'slap': this.burst(.06, .55, 'highpass', 2200 * R(), .9); this.burst(.03, .35, 'bandpass', 4200, 2); this.tone('triangle', 900, 500, .03, .15); break;
      case 'chop': this.burst(.07, .55, 'bandpass', 1800 * R(), 1.5); this.tone('sine', 160, 70, .08, .45); break;
      case 'belly': this.tone('sine', 90 * R(), 40, .22, .7); this.burst(.12, .35, 'lowpass', 500, .8); this.tone('triangle', 200, 120, .1, .15); break;
      case 'slash': this.burst(.09, .4, 'bandpass', 2500, 2, 0, this.fx, 900); this.tone('sine', 140, 60, .06, .35); break;
      case 'whip': this.burst(.07, .4, 'bandpass', 3000, 3, 0, this.fx, 1200); this.tone('sine', 120, 60, .05, .3); break;
      case 'block': this.burst(.05, .4, 'bandpass', 1500, 2); this.tone('square', 380, 300, .05, .1); break;
      case 'parry': this.tone('square', 1320, 1320, .12, .18); this.tone('square', 1760, 1760, .18, .14, .05); this.burst(.05, .3, 'highpass', 4000, .7); break;
      case 'whoosh': this.burst(.18 * pitch, .32, 'bandpass', 500, 1.4, 0, this.fx, 2400); break;
      case 'swing': this.burst(.09, .14, 'bandpass', 900, 1.2, 0, this.fx, 2200); break;
      case 'jump': this.burst(.05, .14, 'lowpass', 400, .7); break;
      case 'land': this.tone('sine', 90, 50, .06, .25 * p); this.burst(.05, .15 * p, 'lowpass', 600, .7); break;
      case 'step': this.burst(.03, .05, 'lowpass', 300 + Math.random() * 200, .7); break;
      case 'slam': {
        const k = Math.min(2.6, p);
        this.tone('sine', 72, 30, .32 + k * .1, .9); this.tone('triangle', 110, 40, .18, .4);
        this.burst(.28 + k * .08, .65, 'lowpass', 700, .8); this.burst(.07, .5, 'bandpass', 1300, 1.2);
        for (let i = 0; i < 3; i++) this.tone('square', 520 + i * 137 + Math.random() * 40, 400 + i * 90, .16 + k * .05, .035 * k, .01 * i);
        if (k > 1.6) { this.tone('sine', 50, 25, .6, .6, .02); this.burst(.5, .35, 'lowpass', 300, .7, .03); }
        break;
      }
      case 'thud': this.tone('sine', 85, 40, .12, .4 * p); this.burst(.08, .25 * p, 'lowpass', 500, .7); break;
      case 'rope': { const c = this.ctx, T = c.currentTime, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.setValueAtTime(95, T); o.frequency.linearRampToValueAtTime(140, T + .05); o.frequency.exponentialRampToValueAtTime(70, T + .45); f.type = 'lowpass'; f.frequency.setValueAtTime(1600, T); f.frequency.exponentialRampToValueAtTime(260, T + .45); f.Q.value = 6; this.env(g, T, .005, .28 * p, .45); o.connect(f); f.connect(g); g.connect(this.fx); o.start(T); o.stop(T + .55); break; }
      case 'bell': for (const [m, v] of [[1, .4], [2.76, .18], [5.4, .1], [8.93, .05]]) this.tone('sine', 820 * m, 820 * m, 1.6 / Math.sqrt(m), v); break;
      case 'bell3': for (let i = 0; i < 3; i++) for (const [m, v] of [[1, .35], [2.76, .15], [5.4, .08]]) this.tone('sine', 820 * m, 820 * m, .9 / Math.sqrt(m), v, i * .32); break;
      case 'count': this.burst(.06, .5, 'bandpass', 900, 1.1); this.tone('sine', 140, 70, .08, .5); this.tone('square', 660 + (o.n || 1) * 110, 660 + (o.n || 1) * 110, .09, .08, .02); break;
      case 'grip': this.burst(.06, .25, 'bandpass', 600, 2); this.tone('sine', 180, 140, .05, .2); break;
      case 'grunt': this.voice(o.voice || 1, 'hup'); break;
      case 'cry': this.voice(o.voice || 1, 'yah'); break;
      case 'hurt': this.voice(o.voice || 1, 'ugh'); break;
      case 'lift': this.voice(o.voice || 1, 'hnn'); this.burst(.2, .1, 'bandpass', 400, 1, .05, this.fx, 900); break;
      case 'spin': this.burst(.16, .22, 'bandpass', 700, 2, 0, this.fx, 1800); break;
      case 'charge': { for (let i = 0; i < 6; i++) this.tone('square', 220 * Math.pow(1.19, i), 220 * Math.pow(1.19, i), .07, .07, i * .05); this.burst(.4, .15, 'bandpass', 500, 2, 0, this.fx, 3000); break; }
      case 'finisher': this.tone('sawtooth', 110, 110, .6, .22, 0, this.fx, { lp: 900 }); this.tone('sawtooth', 165, 165, .6, .18, 0, this.fx, { lp: 900 }); this.tone('square', 440, 880, .5, .1); this.burst(.5, .25, 'bandpass', 300, 1.2, 0, this.fx, 3000); break;
      case 'ko': this.tone('sine', 60, 25, 1, .8); this.burst(.8, .4, 'lowpass', 400, .7); this.tone('square', 220, 55, .8, .12); break;
      case 'counter': this.tone('square', 880, 1760, .08, .15); this.tone('square', 1320, 1320, .14, .12, .06); break;
      case 'reversal': this.tone('square', 660, 1320, .1, .16); this.tone('square', 990, 1980, .14, .12, .05); this.burst(.1, .25, 'highpass', 3000, .8); break;
      case 'down': this.tone('triangle', 330, 160, .25, .12); break;
      case 'deny': this.tone('square', 200, 160, .1, .12); this.tone('square', 150, 120, .12, .1, .08); break;
      case 'ui': this.tone('square', 880 * pitch, 880 * pitch, .03, .07); break;
      case 'ok': this.tone('square', 988, 988, .05, .08); this.tone('square', 1319, 1319, .08, .08, .05); break;
      case 'back': this.tone('square', 660, 440, .08, .08); break;
      case 'type': this.tone('square', (1000 + Math.random() * 300) * pitch, 0, .018, .03); break;
      case 'coin': this.tone('square', 988, 988, .06, .09); this.tone('square', 1319, 1319, .22, .09, .06); break;
      case 'buy': this.tone('square', 784, 784, .06, .09); this.tone('square', 1047, 1047, .06, .09, .06); this.tone('square', 1319, 1319, .16, .09, .12); break;
      case 'heal': [523, 659, 784, 1047].forEach((f, i) => this.tone('sine', f, f, .18, .14, i * .07)); break;
      case 'warn': for (let i = 0; i < 2; i++) { this.tone('square', 740, 740, .12, .1, i * .26); this.tone('square', 554, 554, .12, .1, i * .26 + .13); } break;
      case 'door': this.burst(.14, .3, 'lowpass', 500, .8); this.tone('sine', 110, 70, .12, .3); this.tone('triangle', 300, 520, .2, .05, .06); break;
      case 'stat': this.tone('square', 523, 523, .05, .08); this.tone('square', 784, 784, .1, .08, .05); break;
      case 'good': this.tone('square', 784, 784, .06, .08); this.tone('square', 1175, 1175, .1, .08, .06); break;
      case 'miss': this.tone('square', 300, 200, .12, .09); break;
      case 'tick': this.tone('square', 1500, 1500, .02, .05); break;
      case 'splash': this.burst(.35, .4, 'bandpass', 900, .8, 0, this.fx, 300); this.tone('sine', 300, 80, .2, .2); break;
      case 'crowdBoom': this.cheer(1.2 * p); break;
      case 'boo': this.boo(p); break;
      case 'clap': for (let i = 0; i < 8; i++) this.burst(.03, .05 + Math.random() * .05, 'bandpass', 1400 + Math.random() * 900, 1.5, Math.random() * .25); break;
      case 'ink': this.burst(.3, .3, 'lowpass', 600, 2, 0, this.fx, 200); this.tone('sine', 200, 60, .3, .3); break;
      case 'lightsOff': this.tone('square', 200, 50, .2, .2); this.burst(.1, .3, 'lowpass', 400, 1); break;
    }
  }
  voice(v, kind) {
    const c = this.ctx; if (!c || this.voices > 3) return;
    this.voices++; setTimeout(() => this.voices--, 300);
    const T = c.currentTime, base = 130 * v * (.92 + Math.random() * .16);
    const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth';
    const shapes = { hup: [1.15, .8, .12, [700, 1200]], yah: [1.2, 1, .28, [800, 1300]], ugh: [.95, .7, .2, [500, 900]], hnn: [1, .92, .3, [400, 1900]] }[kind];
    o.frequency.setValueAtTime(base * shapes[0], T); o.frequency.exponentialRampToValueAtTime(base * shapes[1], T + shapes[2]);
    this.env(g, T, .02, .22, shapes[2]);
    o.connect(g);
    for (const fq of shapes[3]) { const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fq * (v > 1.1 ? 1.15 : 1); f.Q.value = 5; g.connect(f); const g2 = c.createGain(); g2.gain.value = .55; f.connect(g2); g2.connect(this.fx); }
    o.start(T); o.stop(T + shapes[2] + .1);
  }
  // ---- crowd bed ----
  startCrowd() {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), f2 = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    s.buffer = this.noise; s.loop = true; f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = .6; f2.type = 'lowpass'; f2.frequency.value = 1800;
    g.gain.value = 0; lfo.frequency.value = .37; lg.gain.value = .02; lfo.connect(lg); lg.connect(g.gain);
    s.connect(f); f.connect(f2); f2.connect(g); g.connect(this.fx); s.start(); lfo.start();
    this.crowdNode = g;
  }
  crowd(level) { // 0..1 murmur level, eased
    this.crowdLevel = level;
    if (!this.ctx || !this.crowdNode) return;
    this.crowdNode.gain.setTargetAtTime(Math.min(.32, level * .28), this.ctx.currentTime, .4);
  }
  cheer(k = 1) {
    if (!this.ctx) return;
    const c = this.ctx, T = c.currentTime;
    for (const [fq, q] of [[750, 2], [1150, 3], [2400, 4]]) {
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noise; s.loop = true; f.type = 'bandpass'; f.frequency.value = fq * (.9 + Math.random() * .2); f.Q.value = q;
      g.gain.setValueAtTime(.0001, T); g.gain.exponentialRampToValueAtTime(.18 * k, T + .12); g.gain.exponentialRampToValueAtTime(.06 * k, T + .7); g.gain.exponentialRampToValueAtTime(.0001, T + 1.8);
      s.connect(f); f.connect(g); g.connect(this.fx); s.start(T, Math.random()); s.stop(T + 1.9);
    }
    for (let i = 0; i < 3 * k; i++) { const st = Math.random() * .6; this.tone('sine', 2200 + Math.random() * 800, 3000 + Math.random() * 600, .25, .03, st); }
    this.sfx('clap');
  }
  boo(k = 1) {
    if (!this.ctx) return;
    const c = this.ctx, T = c.currentTime;
    for (const fq of [320, 860]) { const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noise; s.loop = true; f.type = 'bandpass'; f.frequency.value = fq; f.Q.value = 4; g.gain.setValueAtTime(.0001, T); g.gain.exponentialRampToValueAtTime(.16 * k, T + .25); g.gain.exponentialRampToValueAtTime(.0001, T + 1.5); s.connect(f); f.connect(g); g.connect(this.fx); s.start(T); s.stop(T + 1.6); }
  }
  // ---- music ----
  music(id) {
    if (this.trackId === id) return;
    if (!this.ctx) { this.pendingTrack = id; return; }
    this.trackId = id;
    this.track = id ? TRACKS[id] : null;
    this.step = 0; this.nextTime = this.ctx.currentTime + .08;
    if (this.timer) clearInterval(this.timer);
    if (!this.track) return;
    this.prepare(this.track);
    this.timer = setInterval(() => this.schedule(), 25);
  }
  prepare(tr) {
    if (tr._p) return;
    tr._p = { lead: tr.lead.map(b => b.split(' ')), bass: tr.bass.split(' '), drums: tr.drums.split(' '), chords: tr.chords.map(s => { const [r, q] = s.split(':'); return { root: rootMidi(r), q: CHORD[q] || CHORD.M }; }) };
  }
  schedule() {
    const c = this.ctx, tr = this.track;
    if (!c || !tr) return;
    const sp = 60 / tr.bpm / 4;
    while (this.nextTime < c.currentTime + .14) {
      this.playStep(tr, this.step, this.nextTime);
      const sw = tr.swing && this.step % 2 === 0 ? sp * tr.swing : tr.swing ? -sp * tr.swing : 0;
      this.nextTime += sp + sw; this.step++;
    }
  }
  playStep(tr, n, T) {
    const P = tr._p, bar = Math.floor(n / 16) % P.chords.length, s = n % 16, ch = P.chords[bar], sp = 60 / tr.bpm / 4, M = this.mus, c = this.ctx;
    const at = T - c.currentTime;
    // drums
    const d = P.drums[s];
    if (d === 'k') { this.tone('sine', 140, 42, .16, tr.soft ? .2 : .55, at, M); }
    if (d === 's') { this.burst(.12, tr.soft ? .1 : .26, 'bandpass', 1800, .8, at, M); this.tone('triangle', 220, 140, .08, .12, at, M); }
    if (d === 'h' || (d === '.' && !tr.soft && s % 2 === 0 && tr.drive)) this.burst(.03, .07, 'highpass', 7000, .7, at, M);
    if (d === 'o') this.burst(.14, .08, 'highpass', 6500, .7, at, M);
    // bass
    const b = P.bass[s];
    if (b !== '.') { const deg = +b, iv = deg === 8 ? 12 : deg === 5 ? 7 : deg === 3 ? ch.q[1] : deg === 6 ? 9 : 0; const f = midiF(ch.root - 12 + iv); this.tone(tr.drive ? 'square' : 'triangle', f, f, sp * (tr.drive ? .8 : 1.7), tr.drive ? .13 : .24, at, M, { lp: tr.drive ? 700 : 1200 }); }
    // pad / keys: chord on beats
    if ((tr.pad || tr.keys || tr.brass) && s % (tr.keys ? 8 : 16) === 0) {
      for (const iv of ch.q.slice(0, 4)) { const f = midiF(ch.root + 12 + iv); this.tone(tr.brass ? 'sawtooth' : 'triangle', f, f, sp * (tr.keys ? 7 : 15), tr.brass ? .03 : .045, at, M, { a: tr.pad ? .3 : .01, lp: tr.brass ? 1600 : 2400 }); if (tr.pad && !tr.soft) this.tone('sawtooth', f * 1.003, f * 1.003, sp * 15, .015, at, M, { a: .4, lp: 900 }); }
    }
    if (tr.drive && s % 4 === 2) for (const iv of ch.q.slice(0, 3)) { const f = midiF(ch.root + 12 + iv); this.tone('square', f, f, sp * .9, .025, at, M, { lp: 2000 }); }
    // lead
    const L = P.lead[bar % P.lead.length], note = L[s];
    if (note && note !== '.' && note !== '-') {
      let len = 1; for (let k = s + 1; k < 16 && L[k] === '-'; k++) len++;
      const f = NOTE(note);
      this.tone(tr.lead2 === 'square' ? 'square' : 'pulse', f, f, sp * len * .92, tr.soft ? .05 : .075, at, M, { lp: 3200 });
      if (!tr.soft) this.tone('thin', f * 2, f * 2, sp * len * .5, .018, at + sp * .5, M, { lp: 4000 });
    }
  }
  jingle(id) {
    const j = JINGLES[id];
    if (!j || !this.ctx) return;
    const prev = this.trackId; this.music(null); this.trackId = null;
    const sp = 60 / j.bpm / 2;
    j.notes.split(' ').forEach((n, i, arr) => { if (n === '-' || n === '.') return; let len = 1; for (let k = i + 1; k < arr.length && arr[k] === '-'; k++) len++; const f = NOTE(n); this.tone('pulse', f, f, sp * len * .95, .1, i * sp, this.mus, { lp: 3500 }); this.tone('triangle', f / 2, f / 2, sp * len, .1, i * sp, this.mus); });
    return prev;
  }
}

return { TRACKS, JINGLES, AudioManager };
})();
// ---- core/SaveManager.js
__m["core/SaveManager.js"] = (function () {
// LocalStorage with a memory fallback (private windows and sandboxed pages may refuse storage).
const PREFIX = 'nhs.';
const memory = new Map();
function store() { try { const s = window.localStorage, k = PREFIX + 'probe'; s.setItem(k, '1'); s.removeItem(k); return s; } catch { return null; } }
const Save = {
  ok: null,
  get(key, fallback = null) {
    const s = store(); this.ok = !!s;
    try { const v = s ? s.getItem(PREFIX + key) : memory.get(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, val) {
    const s = store(); this.ok = !!s;
    const str = JSON.stringify(val);
    try { if (s) s.setItem(PREFIX + key, str); else memory.set(key, str); return true; } catch { memory.set(key, str); return false; }
  },
  del(key) { const s = store(); try { if (s) s.removeItem(PREFIX + key); } catch { } memory.delete(key); },
};
const DEFAULT_SETTINGS = { master: .8, music: .55, sfx: .85, shake: 1, flash: 1, scan: 0, keys: null, hints: 1, typeSpeed: 1, career: 'normal' };
function loadSettings() { return Object.assign({}, DEFAULT_SETTINGS, Save.get('settings', {})); }
function saveSettings(s) { Save.set('settings', s); }

return { Save, DEFAULT_SETTINGS, loadSettings, saveSettings };
})();
// ---- render/palette.js
__m["render/palette.js"] = (function () {
// Colour ramps. Shadows lean to violet and lights lean to warm, so every material shares the harbour-night mood.
const { clamp01, lerp } = __m["core/util.js"];
function hexRGB(h) {
  if (h[0] === '#') h = h.slice(1);
  if (h.length === 3) h = h.replace(/./g, '$&$&');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbHex(r, g, b) { return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join(''); }
const packRGB = (r, g, b, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
function packHex(h, a = 255) { const [r, g, b] = hexRGB(h); return packRGB(r, g, b, a); }
function mixHex(a, b, t) { const A = hexRGB(a), B = hexRGB(b); return rgbHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)); }
function shade(h, k) { return k < 0 ? mixHex(h, '#160b2a', -k) : mixHex(h, '#fff0cf', k); }

const rampCache = new Map();
// Five tones, dark to light, as hex strings.
function rampHex(base) {
  if (rampCache.has(base)) return rampCache.get(base);
  const r = [mixHex(base, '#1b0d33', .68), mixHex(base, '#2a1445', .42), mixHex(base, '#3a1c50', .16), mixHex(base, '#ffe2b0', .10), mixHex(base, '#fff3d6', .42)];
  rampCache.set(base, r);
  return r;
}
const packedCache = new Map();
function ramp(base) {
  if (packedCache.has(base)) return packedCache.get(base);
  const r = Uint32Array.from(rampHex(base), h => packHex(h));
  r.base = base;
  packedCache.set(base, r);
  return r;
}
// Skin is hand tuned: the generated ramps read too grey.
const SKINS = {
  pale: ['#5a3350', '#a3646c', '#dc9c8e', '#f6c7ad', '#ffe6cf'],
  light: ['#572c44', '#9c574f', '#d58c6a', '#f2b68a', '#ffdcb5'],
  tan: ['#4a2440', '#834343', '#b9714f', '#dc9b69', '#f7c795'],
  brown: ['#37193a', '#5f3039', '#8c5240', '#b5784f', '#dba56f'],
  dark: ['#24122f', '#422336', '#64393b', '#8a5947', '#b5825b'],
  ash: ['#2b2644', '#56506f', '#86819a', '#b3b0bd', '#dedbd8'],
};
const skinPacked = {};
function skinRamp(name) {
  if (!skinPacked[name]) {
    skinPacked[name] = Uint32Array.from(SKINS[name] || SKINS.tan, h => packHex(h));
    skinPacked[name].base = (SKINS[name] || SKINS.tan)[2];
  }
  return skinPacked[name];
}
const skinHex = name => SKINS[name] || SKINS.tan;
const OUTLINE_HEX = '#140a22';
const OUTLINE = packHex(OUTLINE_HEX);

// Game-wide UI colours.
const UI = {
  ink: '#0b0f22', panel: '#121834', panel2: '#1b2450', edge: '#3a4a8c', line: '#26315f', text: '#eef2ff', dim: '#9aa6d6', faint: '#5f6ca6',
  hp: '#ff4f6d', hpD: '#8c1f48', stun: '#ffc23d', stunD: '#8a5a1a', fin: '#3fe0d0', finD: '#116a7a', inj: '#c86bff', injD: '#51257a',
  good: '#6be38a', bad: '#ff5b5b', warn: '#ffb347', accent: '#ff5fa2', accent2: '#49d6ff', gold: '#ffd65a', money: '#9be36b', fame: '#ffd65a',
};
function lightness(hex) { const [r, g, b] = hexRGB(hex); return clamp01((r * .3 + g * .59 + b * .11) / 255); }

return { hexRGB, rgbHex, packRGB, packHex, mixHex, shade, rampHex, ramp, SKINS, skinRamp, skinHex, OUTLINE_HEX, OUTLINE, UI, lightness };
})();
// ---- render/pixelfont.js
__m["render/pixelfont.js"] = (function () {
// Original pixel font. Hangul syllables are composed from stroke rules (no font files are used),
// Latin glyphs are stroke lists on a 5x9 grid, and symbols are small bitmaps.
const { makeCanvas, ctxOf } = __m["core/util.js"];
const { UI } = __m["render/palette.js"];
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄱㅅ', 'ㄴ', 'ㄴㅈ', 'ㄴㅎ', 'ㄷ', 'ㄹ', 'ㄹㄱ', 'ㄹㅁ', 'ㄹㅂ', 'ㄹㅅ', 'ㄹㅌ', 'ㄹㅍ', 'ㄹㅎ', 'ㅁ', 'ㅂ', 'ㅂㅅ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const DOUBLE = { 'ㄲ': 'ㄱ', 'ㄸ': 'ㄷ', 'ㅃ': 'ㅂ', 'ㅆ': 'ㅅ', 'ㅉ': 'ㅈ' };

class Bits {
  constructor(w, h) { this.w = w; this.h = h; this.b = new Uint8Array(w * h); }
  set(x, y) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.b[y * this.w + x] = 1; }
  hl(y, a, b) { for (let x = a; x <= b; x++) this.set(x, y); }
  vl(x, a, b) { for (let y = a; y <= b; y++) this.set(x, y); }
  line(x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (; ;) {
      this.set(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  runs() {
    const out = [];
    for (let y = 0; y < this.h; y++) {
      let s = -1;
      for (let x = 0; x <= this.w; x++) {
        const on = x < this.w && this.b[y * this.w + x];
        if (on && s < 0) s = x;
        if (!on && s >= 0) { out.push([s, y, x - s]); s = -1; }
      }
    }
    return out;
  }
}

// One consonant inside a box.
function cons(g, j, x, y, w, h) {
  if (j.length === 2 || DOUBLE[j]) {
    const a = DOUBLE[j] || j[0], b = DOUBLE[j] || j[1];
    const hw = (w - 1) >> 1;
    cons(g, a, x, y, hw, h); cons(g, b, x + w - hw, y, hw, h);
    return;
  }
  const X = x + w - 1, Y = y + h - 1, mid = y + ((h - 1) >> 1);
  const siot = (y0, h0) => {
    // Two legs meeting near the top. Left leg starts at the centre, right leg leaves it a third of the way down.
    const c = x + ((w - 1) >> 1), n = h0 - 1;
    for (let r = 0; r <= n; r++) {
      const k = n ? r / n : 1;
      const top = n >= 4 ? Math.max(0, (r - 1) / (n - 1)) : k;
      g.set(Math.round(c - (c - x) * Math.max(0, top)), y0 + r);
      const rk = n >= 3 ? Math.max(0, (r - Math.floor(n * .34)) / (n - Math.floor(n * .34))) : k;
      if (r >= Math.floor(n * .34)) g.set(Math.round(c + (X - c) * rk), y0 + r);
    }
    for (let r = 1; r <= n; r++) { // close gaps on flat slopes
      const k0 = n >= 4 ? Math.max(0, (r - 2) / (n - 1)) : (r - 1) / n, k1 = n >= 4 ? Math.max(0, (r - 1) / (n - 1)) : r / n;
      const a = Math.round(c - (c - x) * Math.max(0, k1)), b = Math.round(c - (c - x) * Math.max(0, k0));
      for (let i = a; i < b - 1; i++) g.set(i + 1, y0 + r - (i + 1 > (a + b) / 2 ? 1 : 0));
    }
  };
  const ring = (y0, h0) => {
    const W = w > h0 + 3 ? Math.min(w, h0 + 4) : w, ox = x + ((w - W) >> 1), oX = ox + W - 1, oY = y0 + h0 - 1;
    if (h0 <= 2) { g.set(ox, y0); g.set(oX, y0); g.hl(oY, ox + 1, oX - 1); return; }
    const cut = W >= 6 && h0 >= 6 ? 2 : 1;
    g.hl(y0, ox + cut, oX - cut); g.hl(oY, ox + cut, oX - cut);
    g.vl(ox, y0 + cut, oY - cut); g.vl(oX, y0 + cut, oY - cut);
    if (cut === 2) { g.set(ox + 1, y0 + 1); g.set(oX - 1, y0 + 1); g.set(ox + 1, oY - 1); g.set(oX - 1, oY - 1); }
  };
  switch (j) {
    case 'ㄱ': g.hl(y, x, X); g.vl(X, y, Y); if (h >= 7) { g.b[Y * g.w + X] = 0; g.set(X - 1, Y); } break;
    case 'ㄴ': g.vl(x, y, Y); g.hl(Y, x, X); break;
    case 'ㄷ': g.hl(y, x, X); g.vl(x, y, Y); g.hl(Y, x, X); break;
    case 'ㄹ': { const m = y + Math.round((h - 1) / 2); g.hl(y, x, X); g.vl(X, y, m); g.hl(m, x, X); g.vl(x, m, Y); g.hl(Y, x, X); break; }
    case 'ㅁ': g.hl(y, x, X); g.hl(Y, x, X); g.vl(x, y, Y); g.vl(X, y, Y); break;
    case 'ㅂ': { const m = y + (h >= 5 ? Math.floor((h - 1) / 2) : 1); g.vl(x, y, Y); g.vl(X, y, Y); g.hl(m, x, X); g.hl(Y, x, X); break; }
    case 'ㅅ': siot(y, h); break;
    case 'ㅇ': ring(y, h); break;
    case 'ㅈ': g.hl(y, x, X); siot(y + (h >= 6 ? 1 : 1), h - 1); break;
    case 'ㅊ': { const c = x + ((w - 1) >> 1); g.hl(y, c - (w > 5 ? 1 : 0), c + 1); const t = h >= 7 ? y + 2 : y + 1; g.hl(t, x, X); siot(t + 1, Y - t); break; }
    case 'ㅋ': g.hl(y, x, X); g.vl(X, y, Y); g.hl(mid, x, X); if (h >= 7) { g.b[Y * g.w + X] = 0; g.set(X - 1, Y); } break;
    case 'ㅌ': { const m = y + Math.round((h - 1) / 2); g.hl(y, x, X); g.hl(m, x, X); g.hl(Y, x, X); g.vl(x, y, Y); break; }
    case 'ㅍ': { const a = x + Math.max(1, Math.round(w * .24)), b = X - Math.max(1, Math.round(w * .24)); g.hl(y, x, X); g.hl(Y, x, X); g.vl(a, y, Y); g.vl(b, y, Y); break; }
    case 'ㅎ': { const c = x + ((w - 1) >> 1); g.hl(y, c - (w > 5 ? 1 : 0), c + 1); const t = h >= 8 ? y + 2 : y + 1; g.hl(t, x, X); ring(t + 1 + (h >= 9 ? 1 : 0), Y - t - (h >= 9 ? 1 : 0)); break; }
  }
}

// Vowel columns: verticals, bar span, number of bars, and the widest initial that fits next to it.
const VCOL = {
  14: { 'ㅏ': { v: [9], b: [10, 12], n: 1, w: 7 }, 'ㅑ': { v: [9], b: [10, 12], n: 2, w: 7 }, 'ㅣ': { v: [10], n: 0, w: 8 }, 'ㅐ': { v: [8, 11], b: [9, 10], n: 1, w: 6 }, 'ㅒ': { v: [8, 11], b: [9, 10], n: 2, w: 6 }, 'ㅓ': { v: [11], b: [8, 10], n: 1, w: 7 }, 'ㅕ': { v: [11], b: [8, 10], n: 2, w: 7 }, 'ㅔ': { v: [9, 12], b: [7, 8], n: 1, w: 6 }, 'ㅖ': { v: [9, 12], b: [7, 8], n: 2, w: 6 } },
  11: { 'ㅏ': { v: [7], b: [8, 9], n: 1, w: 5 }, 'ㅑ': { v: [7], b: [8, 9], n: 2, w: 5 }, 'ㅣ': { v: [8], n: 0, w: 6 }, 'ㅐ': { v: [6, 9], b: [7, 8], n: 1, w: 5 }, 'ㅒ': { v: [6, 9], b: [7, 8], n: 2, w: 5 }, 'ㅓ': { v: [9], b: [7, 8], n: 1, w: 6 }, 'ㅕ': { v: [9], b: [7, 8], n: 2, w: 6 }, 'ㅔ': { v: [7, 9], b: [6, 6], n: 1, w: 5 }, 'ㅖ': { v: [7, 9], b: [6, 6], n: 2, w: 5 } },
};
const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅗㅏ', 'ㅗㅐ', 'ㅗㅣ', 'ㅛ', 'ㅜ', 'ㅜㅓ', 'ㅜㅔ', 'ㅜㅣ', 'ㅠ', 'ㅡ', 'ㅡㅣ', 'ㅣ'];
const tallIni = c => c === 'ㅎ' || c === 'ㅊ';

function vertVowel(g, spec, y0, y1, bars) {
  for (const x of spec.v) g.vl(x, y0, y1);
  if (spec.n === 1) g.hl(bars[0], spec.b[0], spec.b[1]);
  if (spec.n === 2) { g.hl(bars[1], spec.b[0], spec.b[1]); g.hl(bars[2], spec.b[0], spec.b[1]); }
}

function composeHangul(code, S) {
  const i = code - 0xAC00, ci = Math.floor(i / 588), vi = Math.floor((i % 588) / 28), fi = i % 28;
  const c = CHO[ci], v = JUNG[vi], f = JONG[fi];
  const big = S === 14, W = big ? 13 : 10, g = new Bits(W, S);
  const vc = VCOL[S];
  const horiz = v[0] === 'ㅗ' || v[0] === 'ㅛ' || v[0] === 'ㅜ' || v[0] === 'ㅠ' || v[0] === 'ㅡ';
  if (!horiz) {
    const sp = vc[v];
    if (!f) {
      if (big) { const t = tallIni(c); cons(g, c, 0, t ? 1 : 2, sp.w, t ? 10 : 9); vertVowel(g, sp, 0, 13, [6, 4, 8]); }
      else { cons(g, c, 0, 1, sp.w, 8); vertVowel(g, sp, 0, 10, [5, 3, 6]); }
    } else if (big) {
      cons(g, c, 0, 0, sp.w, 6); vertVowel(g, sp, 0, 6, [3, 2, 4]); cons(g, f, 2, 8, 10, 6);
    } else {
      cons(g, c, 0, 0, sp.w, 5); vertVowel(g, sp, 0, 4, [2, 1, 3]); cons(g, f, 1, 6, 8, 5);
    }
    return g;
  }
  if (v.length === 1) {
    const mid = big ? 6 : 5, a = big ? 4 : 3, b = big ? 8 : 6;
    const stems = v === 'ㅛ' || v === 'ㅠ' ? [a, b] : v === 'ㅡ' ? [] : [mid];
    const up = v === 'ㅗ' || v === 'ㅛ';
    const ix = big ? 2 : 1, iw = big ? 9 : 8;
    if (!f) {
      if (big) {
        if (v === 'ㅡ') { cons(g, c, ix, 1, iw, 7); g.hl(11, 0, 12); }
        else if (up) { cons(g, c, ix, 0, iw, 7); for (const x of stems) g.vl(x, 8, 10); g.hl(11, 0, 12); }
        else { cons(g, c, ix, 0, iw, 7); g.hl(8, 0, 12); for (const x of stems) g.vl(x, 9, 13); }
      } else {
        if (v === 'ㅡ') { cons(g, c, ix, 1, iw, 6); g.hl(9, 0, 9); }
        else if (up) { cons(g, c, ix, 0, iw, 6); for (const x of stems) g.vl(x, 7, 8); g.hl(9, 0, 9); }
        else { cons(g, c, ix, 0, iw, 5); g.hl(6, 0, 9); for (const x of stems) g.vl(x, 7, 10); }
      }
    } else if (big) {
      if (v === 'ㅡ') { cons(g, c, ix, 0, iw, 5); g.hl(6, 0, 12); cons(g, f, 2, 8, 9, 6); }
      else if (up) { cons(g, c, ix, 0, iw, 5); for (const x of stems) g.vl(x, 5, 6); g.hl(7, 0, 12); cons(g, f, 2, 9, 9, 5); }
      else { cons(g, c, ix, 0, iw, 5); g.hl(6, 0, 12); for (const x of stems) g.vl(x, 7, 7); cons(g, f, 2, 9, 9, 5); }
    } else {
      const ih = tallIni(c) || c === 'ㄹ' || c === 'ㅌ' ? 4 : 3;
      if (v === 'ㅡ') { cons(g, c, ix, 0, iw, ih); g.hl(4 + (ih > 3 ? 0 : 0), 0, 9); cons(g, f, 1, 6, 8, 5); }
      else if (up) { cons(g, c, ix, 0, iw, 3 + (ih > 3 ? 1 : 0)); for (const x of stems) g.vl(x, ih > 3 ? 4 : 3, 4); g.hl(5, 0, 9); cons(g, f, 1, 7, 8, 4); }
      else { cons(g, c, ix, 0, iw, 3 + (ih > 3 ? 0 : 0)); g.hl(4, 0, 9); for (const x of stems) g.vl(x, 5, 5); cons(g, f, 1, 7, 8, 4); }
    }
    return g;
  }
  // Mixed vowels.
  const h0 = v[0], sp = vc[v[1]];
  if (big) {
    const sx = 3, lx = 7;
    if (!f) {
      cons(g, c, 0, 0, 7, 6);
      if (h0 === 'ㅗ') { g.vl(sx, 7, 8); g.hl(9, 0, lx); vertVowel(g, sp, 0, 13, [5, 4, 7]); }
      else if (h0 === 'ㅜ') { g.hl(8, 0, lx); g.vl(sx, 9, 12); vertVowel(g, sp, 0, 13, [10, 4, 7]); }
      else { g.hl(9, 0, lx); vertVowel(g, sp, 0, 13, [5, 4, 7]); }
    } else {
      cons(g, c, 0, 0, 6, h0 === 'ㅜ' ? 4 : 5);
      if (h0 === 'ㅗ') { g.vl(sx, 5, 5); g.hl(6, 0, lx); vertVowel(g, sp, 0, 6, [3, 2, 4]); cons(g, f, 2, 8, 10, 6); }
      else if (h0 === 'ㅜ') { g.hl(5, 0, lx - 1); g.vl(sx, 6, 7); vertVowel(g, sp, 0, 7, [6, 2, 4]); cons(g, f, 2, 9, 10, 5); }
      else { g.hl(6, 0, lx); vertVowel(g, sp, 0, 6, [3, 2, 4]); cons(g, f, 2, 8, 10, 6); }
    }
  } else {
    const sx = 2, lx = 5;
    if (!f) {
      cons(g, c, 0, 0, 5, 5);
      if (h0 === 'ㅗ') { g.vl(sx, 6, 6); g.hl(7, 0, lx); vertVowel(g, sp, 0, 10, [4, 3, 5]); }
      else if (h0 === 'ㅜ') { g.hl(6, 0, lx); g.vl(sx, 7, 9); vertVowel(g, sp, 0, 10, [8, 3, 5]); }
      else { g.hl(7, 0, lx); vertVowel(g, sp, 0, 10, [4, 3, 5]); }
    } else {
      cons(g, c, 0, 0, 5, 3);
      if (h0 === 'ㅗ') { g.set(sx, 3); g.hl(4, 0, lx); vertVowel(g, sp, 0, 5, [2, 1, 3]); cons(g, f, 1, 7, 8, 4); }
      else if (h0 === 'ㅜ') { g.hl(4, 0, lx - 1); g.set(sx, 5); vertVowel(g, sp, 0, 5, [5, 1, 3]); cons(g, f, 1, 7, 8, 4); }
      else { g.hl(4, 0, lx); vertVowel(g, sp, 0, 5, [2, 1, 3]); cons(g, f, 1, 7, 8, 4); }
    }
  }
  return g;
}

// Latin strokes: each group of four hex digits is x0 y0 x1 y1 on a 5x9 grid (rows 9-10 are descenders).
const LATIN = {
  A: '0802 0220 2042 4248 0545', B: '0008 0030 3041 4143 4334 0434 3445 4547 4738 3808', C: '4130 3010 1001 0107 0718 1838 3847', D: '0008 0030 3041 4147 4738 3808', E: '4000 0008 0848 0434', F: '4000 0008 0434', G: '4130 3010 1001 0107 0718 1838 3847 4744 4424', H: '0008 4048 0444', I: '1030 2028 1838', J: '4047 4738 3818 1807 0706', K: '0008 4004 0448', L: '0008 0848', M: '0008 0022 2240 4048', N: '0008 0147 4048', O: '1030 3041 4147 4738 3818 1807 0701 0110', P: '0008 0030 3041 4143 4334 3404', Q: '1030 3041 4147 4738 3818 1807 0701 0110 2648', R: '0008 0030 3041 4143 4334 3404 2448', S: '4130 3010 1001 0103 0314 1434 3445 4547 4738 3818 1807', T: '0040 2028', U: '0007 0718 1838 3847 4740', V: '0005 0528 2845 4540', W: '0007 0718 1826 2638 3847 4740', X: '0048 4008', Y: '0024 4024 2428', Z: '0040 4008 0848',
  0: '1030 3041 4147 4738 3818 1807 0701 0110 2425', 1: '1120 2028 1838', 2: '0110 1030 3041 4143 4308 0848', 3: '0110 1030 3041 4143 4334 3424 3445 4547 4738 3818 1807', 4: '3006 0646 3038', 5: '4000 0004 0434 3445 4547 4738 3818 1807', 6: '4130 3010 1001 0107 0718 1838 3847 4745 4534 3404', 7: '0040 4042 4225 2528', 8: '1030 3041 4143 4334 3414 1403 0301 0110 3445 4547 4738 3818 1807 0705 0514', 9: '0718 1838 3847 4741 4130 3010 1001 0103 0314 1444',
  a: '1333 3344 4448 4818 1807 0706 0615 1545', b: '0008 0413 1333 3344 4447 4738 3818 1807', c: '4433 3313 1304 0407 0718 1838 3847', d: '4048 4433 3313 1304 0407 0718 1838 3847', e: '0545 4544 4433 3313 1304 0407 0718 1848', f: '4030 3021 2128 0343', g: '4433 3313 1304 0406 0617 1737 3746 4349 493a 3a1a', h: '0008 0413 1333 3344 4448', i: '2121 2328', j: '3131 3339 392a 2a1a', k: '0008 4306 1648', l: '2027 2738', m: '0308 0313 1324 2428 2433 3344 4448', n: '0308 0413 1333 3344 4448', o: '1333 3344 4447 4738 3818 1807 0704 0413', p: '030a 0413 1333 3344 4446 4637 3717 1706', q: '434a 4433 3313 1304 0406 0617 1737 3746', r: '0308 0413 1333 3344', s: '4313 1304 0415 1535 3546 4647 4738 3808', t: '1117 1728 2838 0333', u: '0307 0718 1838 3847 4348', v: '0305 0528 2845 4543', w: '0306 0618 1825 2538 3846 4643', x: '0348 4308', y: '0306 0617 1747 4349 493a 3a1a', z: '0343 4308 0848',
  '.': '2828', ',': '2829 2919', '!': '2025 2828', '?': '0110 1030 3041 4142 4224 2425 2828', ':': '2323 2727', ';': '2323 2729', '-': '1434', '+': '0444 2226', '=': '0343 0646', '/': '4008', '\\': '0048', '(': '3021 2127 2738', ')': '1021 2127 2718', '[': '3010 1018 1838', ']': '1030 3038 3818', '<': '3105 0538', '>': '1145 4518', '*': '2226 0444 1335 3315', '%': '4008 0001 1011 3738 4748', '#': '1018 3038 0343 0646', "'": '2022', '"': '1012 3032', '_': '0848', '~': '0514 1425 2534', '^': '0220 2042', '|': '2028', '&': '1030 3012 1248 3807 0705 0514', '@': '4838 3818 1807 0701 0110 1030 3041 4146 4636 3634 2434 2426 2636', '$': '4130 3010 1001 0103 0314 1434 3445 4547 4738 3818 1807 2028', '`': '1021',
};
const NARROW = { '.': 2, ',': 2, '!': 2, ':': 2, ';': 2, "'": 2, '|': 2, i: 2, l: 3, I: 3, '(': 3, ')': 3, '[': 3, ']': 3, 1: 4, j: 3, t: 4, '`': 2 };
// Symbols as bitmaps: rows of '.' and '#'.
const SYMBOLS = {
  '…': ['......#.', '........', '#..#..#.'.replace(/#\.\.#\.\.#\./, '#..#..#.')],
  '·': ['##', '##'],
  '★': ['....#....', '....#....', '...###...', '#########', '.#######.', '..#####..', '..#####..', '.###.###.', '.#.....#.'],
  '☆': ['....#....', '....#....', '...#.#...', '####.####', '.#.....#.', '..#...#..', '..#.#.#..', '.#.#.#.#.', '.##...##.'],
  '♥': ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'],
  '●': ['..###..', '.#####.', '#######', '#######', '#######', '.#####.', '..###..'],
  '○': ['..###..', '.#...#.', '#.....#', '#.....#', '#.....#', '.#...#.', '..###..'],
  '■': ['#######', '#######', '#######', '#######', '#######', '#######', '#######'],
  '□': ['#######', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '#######'],
  '▶': ['##....', '####..', '######', '######', '####..', '##....'],
  '◀': ['....##', '..####', '######', '######', '..####', '....##'],
  '▲': ['...#...', '...#...', '..###..', '..###..', '.#####.', '#######'],
  '▼': ['#######', '.#####.', '..###..', '..###..', '...#...', '...#...'],
  '→': ['.....#..', '......#.', '########', '......#.', '.....#..'],
  '←': ['..#.....', '.#......', '########', '.#......', '..#.....'],
  '↑': ['..#..', '.###.', '#.#.#', '..#..', '..#..', '..#..', '..#..'],
  '↓': ['..#..', '..#..', '..#..', '..#..', '#.#.#', '.###.', '..#..'],
  '×': ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  '♪': ['..##.', '..#.#', '..#..', '..#..', '###..', '###..'],
  '₩': ['#...#...#', '#...#...#', '#########', '.#.#.#.#.', '#########', '.#.#.#.#.', '..#...#..', '..#...#..'],
  '—': ['##########'],
  '「': ['####', '#...', '#...', '#...', '#...'],
  '」': ['...#', '...#', '...#', '...#', '####'],
  '※': ['#..#..#', '.#...#.', '..#.#..', '#..#..#', '..#.#..', '.#...#.', '#..#..#'],
};
SYMBOLS['…'] = ['#...#...#', '#...#...#'];

const glyphCache = { 14: new Map(), 11: new Map() };
function makeGlyph(ch, S) {
  const code = ch.codePointAt(0), big = S === 14;
  if (code >= 0xAC00 && code <= 0xD7A3) { const g = composeHangul(code, S); return { runs: g.runs(), w: g.w, adv: big ? 14 : 11 }; }
  if (code >= 0x3131 && code <= 0x3163) {
    const g = new Bits(big ? 12 : 9, S);
    const list = 'ㄱㄲㄳㄴㄵㄶㄷㄸㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅃㅄㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
    const k = code - 0x3131;
    if (k < list.length) cons(g, list[k], big ? 1 : 0, big ? 2 : 1, big ? 9 : 8, big ? 9 : 8);
    return { runs: g.runs(), w: g.w, adv: big ? 12 : 10 };
  }
  if (SYMBOLS[ch]) {
    const rows = SYMBOLS[ch], w = Math.max(...rows.map(r => r.length)), g = new Bits(w, Math.max(S, rows.length));
    const oy = ch === '…' ? S - 5 : Math.max(0, Math.floor((S - rows.length) / 2) + (ch === '·' || ch === '—' ? 0 : 0));
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === '#') g.set(x, y + oy); });
    return { runs: g.runs(), w, adv: w + 2 };
  }
  if (ch === ' ') return { runs: [], w: 0, adv: big ? 6 : 5 };
  const st = LATIN[ch] || LATIN['?'];
  const gw = big ? 6 : 5, g = new Bits(gw + 1, S + 2);
  const sx = big ? 1.25 : 1, sy = big ? 10 / 8 : 7 / 8, oy = big ? 2 : 2;
  const nar = NARROW[ch];
  for (const s of st.split(' ')) {
    const [x0, y0, x1, y1] = [...s].map(d => parseInt(d, 16));
    const f = (x, y) => [Math.round(x * (nar ? 1 : sx)), Math.round(y * sy) + oy];
    const a = f(x0, y0), b = f(x1, y1);
    g.line(a[0], a[1], b[0], b[1]);
  }
  let runs = g.runs();
  if (nar) { let m = 99; for (const r of runs) m = Math.min(m, r[0]); runs = runs.map(r => [r[0] - m, r[1], r[2]]); }
  let mw = 0;
  for (const r of runs) mw = Math.max(mw, r[0] + r[2]);
  return { runs, w: mw, adv: mw + 2 };
}
function glyph(ch, S) {
  const m = glyphCache[S];
  let g = m.get(ch);
  if (!g) { g = makeGlyph(ch, S); m.set(ch, g); }
  return g;
}

const COLOR_TAGS = { y: '#ffd65a', r: '#ff6b78', g: '#7be88f', b: '#62d7ff', p: '#ff8fc4', o: '#ffa14d', d: '#9aa6d6', v: '#d29bff' };
const TAG_RE = /\{([a-z\/])\}/g;
const stripTags = s => s.replace(TAG_RE, '');

function textWidth(str, size = 14, scale = 1, bold = false) {
  let w = 0;
  for (const ch of stripTags(str)) w += glyph(ch, size).adv + (bold ? 1 : 0);
  return Math.max(0, w - (size === 14 ? 1 : 1)) * scale;
}

const textCache = new Map();
function stringCanvas(str, size, scale, color, outline, bold, grad, shadow) {
  const key = str + '\u0001' + size + scale + color + (outline || '') + (bold ? 'b' : '') + (grad || '') + (shadow || '');
  let c = textCache.get(key);
  if (c) { textCache.delete(key); textCache.set(key, c); return c; }
  const pad = 2, w = textWidth(str, size, 1, bold) + pad * 2 + 2, h = size + 3 + pad * 2;
  c = makeCanvas(w, h);
  const g = ctxOf(c);
  const put = (ox, oy, col) => {
    g.fillStyle = col;
    let x = pad + ox;
    for (const ch of str) {
      const gl = glyph(ch, size);
      for (const r of gl.runs) g.fillRect(x + r[0], pad + oy + r[1], r[2] + (bold ? 1 : 0), 1);
      x += gl.adv + (bold ? 1 : 0);
    }
  };
  if (shadow) { put(1, 1, shadow); }
  if (outline) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) put(dx, dy, outline);
  if (grad) {
    // Two-tone face: draw once, then recolour the lower half.
    put(0, 0, color);
    const t = makeCanvas(w, h), tg = ctxOf(t);
    tg.fillStyle = grad;
    let x = pad;
    for (const ch of str) {
      const gl = glyph(ch, size);
      for (const r of gl.runs) if (r[1] >= size * .55) tg.fillRect(x + r[0], pad + r[1], r[2] + (bold ? 1 : 0), 1);
      x += gl.adv + (bold ? 1 : 0);
    }
    g.drawImage(t, 0, 0);
  } else put(0, 0, color);
  let out = c;
  if (scale !== 1) { out = makeCanvas(w * scale, h * scale); const og = ctxOf(out); og.drawImage(c, 0, 0, w * scale, h * scale); }
  out.pad = pad * scale;
  textCache.set(key, out);
  if (textCache.size > 900) textCache.delete(textCache.keys().next().value);
  return out;
}

// Draws one line. Options: color, size (14|11), scale, outline, bold, align (l|c|r), alpha, grad, shadow.
function drawText(g, str, x, y, o = {}) {
  str = String(str);
  if (!str) return 0;
  const size = o.size || 14, scale = o.scale || 1, color = o.color || UI.text, bold = !!o.bold;
  const w = textWidth(str, size, scale, bold);
  let px = Math.round(o.align === 'c' ? x - w / 2 : o.align === 'r' ? x - w : x);
  const py = Math.round(y);
  const old = g.globalAlpha;
  if (o.alpha != null) g.globalAlpha = old * o.alpha;
  if (str.indexOf('{') < 0) {
    const c = stringCanvas(str, size, scale, color, o.outline, bold, o.grad, o.shadow);
    g.drawImage(c, px - c.pad, py - c.pad);
  } else {
    const re = new RegExp(TAG_RE.source, 'g');
    let col = color, last = 0, m;
    const seg = s => { if (!s) return; const c = stringCanvas(s, size, scale, col, o.outline, bold, o.grad, o.shadow); g.drawImage(c, px - c.pad, py - c.pad); for (const ch of s) px += (glyph(ch, size).adv + (bold ? 1 : 0)) * scale; };
    while ((m = re.exec(str))) { seg(str.slice(last, m.index)); col = m[1] === '/' ? color : COLOR_TAGS[m[1]] || color; last = m.index + m[0].length; }
    seg(str.slice(last));
  }
  g.globalAlpha = old;
  return w;
}

// Splits text into lines. Tags stay attached and reopen on the next line when a colour spans a wrap.
function wrapText(str, width, size = 14, bold = false) {
  const out = [];
  for (const para of String(str).split('\n')) {
    let line = '', lw = 0, open = '';
    const tokens = para.split(/( )/);
    const push = () => { out.push(line.replace(/ +$/, '') + (open ? '{/}' : '')); line = open ? '{' + open + '}' : ''; lw = 0; };
    const tagScan = s => { const re = new RegExp(TAG_RE.source, 'g'); let m; while ((m = re.exec(s))) open = m[1] === '/' ? '' : m[1]; };
    for (const tk of tokens) {
      if (!tk) continue;
      const w = textWidth(tk, size, 1, bold) + 1;
      if (lw + w > width && lw > 0 && tk !== ' ') push();
      if (w > width) {
        for (const ch of tk) { const cw = glyph(ch, size).adv + (bold ? 1 : 0); if (lw + cw > width) push(); line += ch; lw += cw; }
      } else if (!(tk === ' ' && lw === 0)) { line += tk; lw += w; }
      tagScan(tk);
    }
    out.push(line);
  }
  return out;
}

// Draws the first n visible characters of a tagged line (typewriter).
function sliceTagged(str, n) {
  let out = '', k = 0, i = 0;
  while (i < str.length && k < n) {
    if (str[i] === '{' && str[i + 2] === '}') { out += str.slice(i, i + 3); i += 3; continue; }
    const ch = String.fromCodePoint(str.codePointAt(i));
    out += ch; i += ch.length; k++;
  }
  return out;
}
const visLen = s => [...stripTags(s)].length;

return { stripTags, textWidth, drawText, wrapText, sliceTagged, visLen };
})();
// ---- render/painter.js
__m["render/painter.js"] = (function () {
// Pixel-art painting helpers shared by the arenas and the town: walls, windows, neon, lamps, props.
const { makeCanvas, ctxOf, RNG } = __m["core/util.js"];
const { rampHex, mixHex, shade } = __m["render/palette.js"];
const { drawText, textWidth } = __m["render/pixelfont.js"];
function canvas(w, h) { const c = makeCanvas(w, h); return [c, ctxOf(c)]; }
function rect(g, c, x, y, w, h) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function vgrad(g, x, y, w, h, stops) { const gr = g.createLinearGradient(0, y, 0, y + h); stops.forEach(([t, c]) => gr.addColorStop(t, c)); g.fillStyle = gr; g.fillRect(x, y, w, h); }
// Banded vertical gradient: hard colour steps read as pixel art.
function bands(g, x, y, w, h, cols) { const n = cols.length; for (let i = 0; i < n; i++) { const y0 = Math.round(y + h * i / n), y1 = Math.round(y + h * (i + 1) / n); rect(g, cols[i], x, y0, w, y1 - y0); } }
function dither(g, x, y, w, h, c, density = .5, seed = 1) { const r = new RNG(seed); g.fillStyle = c; for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (((xx + yy) & 1) === 0 && r.next() < density) g.fillRect(x + xx, y + yy, 1, 1); }
function checker(g, x, y, w, h, c) { g.fillStyle = c; for (let yy = 0; yy < h; yy++) for (let xx = (yy & 1); xx < w; xx += 2) g.fillRect(x + xx, y + yy, 1, 1); }
function line(g, c, x0, y0, x1, y1, w = 1) {
  g.fillStyle = c;
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  dx = Math.abs(x1 - x0); dy = -Math.abs(y1 - y0); e = dx + dy;
  for (let i = 0; i < 2000; i++) { g.fillRect(x0, y0, w, w); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
function ellipse(g, c, cx, cy, rx, ry) { g.fillStyle = c; for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)))); g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); } }
function poly(g, c, pts) { g.fillStyle = c; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill(); }
// Soft light: radial glow added on top (used on a separate light layer).
function glow(g, x, y, r, col, a = .5) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.save(); g.globalAlpha = a; g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore(); }
function cone(g, x, y, w0, w1, h, col, a = .22) { const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.save(); g.globalAlpha = a; g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.beginPath(); g.moveTo(x - w0 / 2, y); g.lineTo(x + w0 / 2, y); g.lineTo(x + w1 / 2, y + h); g.lineTo(x - w1 / 2, y + h); g.closePath(); g.fill(); g.restore(); }
// Neon text: dark tube shadow, glow halo, bright core.
function neon(g, text, x, y, col, o = {}) {
  const sc = o.scale || 2, w = textWidth(text, 14, sc, true);
  const px = o.align === 'c' ? x - w / 2 : x;
  drawText(g, text, px + 1, y + 2, { scale: sc, color: '#0a0716', bold: true });
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawText(g, text, px + dx, y + dy, { scale: sc, color: mixHex(col, '#000000', .45), bold: true, alpha: .9 });
  drawText(g, text, px, y, { scale: sc, color: o.off ? mixHex(col, '#1a1030', .6) : col, bold: true });
  if (!o.off) drawText(g, text, px, y - 1, { scale: sc, color: mixHex(col, '#ffffff', .55), bold: true, alpha: .5 });
  return w;
}
function brick(g, x, y, w, h, base, o = {}) {
  const R = rampHex(base), r = new RNG(o.seed || 7);
  rect(g, R[1], x, y, w, h);
  const bw = o.bw || 12, bh = o.bh || 5;
  for (let yy = 0, row = 0; yy < h; yy += bh, row++) for (let xx = -(row % 2) * bw / 2; xx < w; xx += bw) {
    const c = r.next() < .2 ? R[3] : r.next() < .5 ? R[2] : mixHex(R[2], R[1], .4);
    rect(g, c, x + Math.max(0, xx) + 1, y + yy + 1, Math.min(bw - 1, w - Math.max(0, xx) - 1), bh - 1);
  }
}
function planks(g, x, y, w, h, base, o = {}) {
  const R = rampHex(base), r = new RNG(o.seed || 3), ph = o.ph || 6;
  for (let yy = 0, i = 0; yy < h; yy += ph, i++) { rect(g, i % 2 ? R[2] : mixHex(R[2], R[3], .3), x, y + yy, w, ph - 1); rect(g, R[0], x, y + yy + ph - 1, w, 1); for (let k = 0; k < w / 30; k++) { const sx = x + ((r.next() * w) | 0); rect(g, R[1], sx, y + yy + 1, 1, ph - 2); } }
}
function tiles(g, x, y, w, h, a, b, s = 8) { for (let yy = 0; yy < h; yy += s) for (let xx = 0; xx < w; xx += s) rect(g, ((xx / s + yy / s) & 1) ? a : b, x + xx, y + yy, Math.min(s, w - xx), Math.min(s, h - yy)); }
function windowPane(g, x, y, w, h, o = {}) {
  const frame = o.frame || '#2a2f4a', sky = o.sky || ['#1b2a5c', '#30407a', '#5b4a8a'];
  rect(g, frame, x - 2, y - 2, w + 4, h + 4);
  bands(g, x, y, w, h, sky);
  if (o.city) { const r = new RNG(o.seed || 11); for (let i = 0; i < w; i += 6 + (r.next() * 6 | 0)) { const bh = 6 + r.next() * h * .55, bw = 5 + (r.next() * 5 | 0); rect(g, '#141a33', x + i, y + h - bh, bw, bh); for (let k = 0; k < 4; k++) if (r.next() < .6) rect(g, r.next() < .5 ? '#ffd27a' : '#7fe0ff', x + i + 1 + (r.next() * (bw - 2) | 0), y + h - bh + 2 + (r.next() * (bh - 3) | 0), 1, 1); } }
  if (o.bars !== false) { rect(g, frame, x + w / 2 - 1, y, 2, h); rect(g, frame, x, y + h / 2 - 1, w, 2); }
  rect(g, 'rgba(255,255,255,.12)', x + 2, y + 2, 2, h - 4);
}
function lamp(g, x, y, col = '#ffcf7a', o = {}) {
  const L = o.len || 14;
  rect(g, '#1a1d33', x, y, 1, L);
  poly(g, o.shade || '#2b3156', [[x - 7, y + L + 6], [x + 8, y + L + 6], [x + 4, y + L], [x - 3, y + L]]);
  rect(g, col, x - 4, y + L + 6, 9, 2);
}
function poster(g, x, y, w, h, col, title, o = {}) {
  rect(g, '#120c1e', x - 1, y - 1, w + 2, h + 2);
  bands(g, x, y, w, h, [col, shade(col, -.2), shade(col, -.38)]);
  if (o.figure) { const cx = x + w / 2; ellipse(g, shade(col, -.6), cx, y + h * .42, w * .22, h * .16); rect(g, shade(col, -.6), cx - w * .3, y + h * .55, w * .6, h * .28); }
  if (title) drawText(g, title, x + w / 2, y + h - 13, { size: 11, align: 'c', color: o.tc || '#fff6dc', outline: '#120c1e' });
  if (o.top) drawText(g, o.top, x + w / 2, y + 2, { size: 11, align: 'c', color: o.tc2 || '#ffe27a' });
}
function plant(g, x, y, o = {}) {
  rect(g, o.pot || '#8a4a3a', x - 6, y - 10, 12, 10); rect(g, shade(o.pot || '#8a4a3a', -.3), x - 6, y - 2, 12, 2);
  const R = rampHex(o.leaf || '#3f9a5a');
  for (const [dx, dy, r] of [[-5, -18, 6], [4, -20, 6], [0, -27, 6], [-2, -14, 5], [6, -13, 4]]) ellipse(g, R[2], x + dx, y + dy, r, r - 1);
  for (const [dx, dy] of [[-6, -20], [3, -23], [0, -29]]) ellipse(g, R[3], x + dx, y + dy, 2, 1);
}
function box(g, x, y, w, h, col, o = {}) {
  const R = rampHex(col);
  rect(g, R[0], x - 1, y - 1, w + 2, h + 2); rect(g, R[2], x, y, w, h); rect(g, R[3], x, y, w, 2); rect(g, R[1], x, y + h - 2, w, 2);
  if (o.tape) rect(g, shade(col, .3), x + w / 2 - 2, y, 4, h);
  if (o.label) drawText(g, o.label, x + w / 2, y + h / 2 - 5, { size: 11, align: 'c', color: R[4] });
}
function shelf(g, x, y, w, rows, col = '#6a4a3a', items) {
  const R = rampHex(col), r = new RNG(x + y);
  rect(g, R[0], x - 1, y - 1, w + 2, rows * 16 + 3);
  for (let i = 0; i < rows; i++) {
    const yy = y + i * 16;
    rect(g, R[1], x, yy, w, 15); rect(g, R[3], x, yy + 13, w, 2);
    if (items) for (let k = 2; k < w - 6; k += 5 + (r.next() * 4 | 0)) { const c = items[(r.next() * items.length) | 0], hh = 5 + (r.next() * 7 | 0); rect(g, shade(c, -.4), k + x, yy + 13 - hh, 4, hh); rect(g, c, k + x, yy + 13 - hh, 3, hh - 1); }
  }
}
function truss(g, x, y, w, col = '#283052') {
  const R = rampHex(col);
  rect(g, R[1], x, y, w, 2); rect(g, R[1], x, y + 10, w, 2);
  for (let xx = 0; xx < w; xx += 12) { line(g, R[2], x + xx, y + 2, x + xx + 6, y + 10); line(g, R[2], x + xx + 6, y + 10, x + xx + 12, y + 2); }
  rect(g, R[3], x, y, w, 1);
}
function sofa(g, x, y, w, col) {
  const R = rampHex(col);
  rect(g, R[0], x - 1, y - 23, w + 2, 25);
  rect(g, R[1], x, y - 22, w, 12); rect(g, R[2], x + 4, y - 12, w - 8, 7); rect(g, R[3], x + 4, y - 12, w - 8, 1);
  rect(g, R[2], x, y - 22, 6, 18); rect(g, R[2], x + w - 6, y - 22, 6, 18); rect(g, R[3], x + 1, y - 22, 4, 1); rect(g, R[3], x + w - 5, y - 22, 4, 1);
  rect(g, R[1], x + 2, y - 5, w - 4, 4);
  for (let i = 1; i < 3; i++) rect(g, R[1], x + (w * i) / 3, y - 12, 1, 6);
  rect(g, '#1a1424', x + 3, y - 1, 3, 2); rect(g, '#1a1424', x + w - 6, y - 1, 3, 2);
}
function door(g, x, y, w, h, col, o = {}) {
  const R = rampHex(col);
  rect(g, '#120c1e', x - 3, y - 3, w + 6, h + 3);
  rect(g, o.frame || '#3a3150', x - 2, y - 2, w + 4, h + 2);
  rect(g, R[1], x, y, w, h);
  rect(g, R[2], x + 3, y + 3, w - 6, h * .42); rect(g, R[2], x + 3, y + h * .5, w - 6, h * .44);
  rect(g, R[3], x + 3, y + 3, w - 6, 1);
  if (o.glass) { rect(g, '#22355f', x + 5, y + 6, w - 10, h * .3); rect(g, 'rgba(160,220,255,.25)', x + 6, y + 7, 2, h * .26); }
  rect(g, '#ffd65a', x + w - 6, y + h * .52, 2, 3);
  if (o.sign) { const sw = textWidth(o.sign, 11) + 8; rect(g, '#120c1e', x + w / 2 - sw / 2 - 1, y - 18, sw + 2, 14); rect(g, o.signCol || '#26315f', x + w / 2 - sw / 2, y - 17, sw, 12); drawText(g, o.sign, x + w / 2, y - 16, { size: 11, align: 'c', color: o.signText || '#eef2ff' }); }
}
function board(g, x, y, w, h, title, lines, o = {}) {
  rect(g, '#120c1e', x - 2, y - 2, w + 4, h + 4); rect(g, o.frame || '#7a5236', x - 1, y - 1, w + 2, h + 2); rect(g, o.bg || '#2c3b30', x, y, w, h);
  dither(g, x, y, w, h, 'rgba(255,255,255,.05)', .3, x);
  if (title) drawText(g, title, x + w / 2, y + 3, { size: 11, align: 'c', color: o.tc || '#ffe9a8' });
  (lines || []).forEach((l, i) => drawText(g, l, x + 5, y + 17 + i * 12, { size: 11, color: '#d9e6dc' }));
}
function frameArt(g, x, y, w, h, fn) { rect(g, '#120c1e', x - 3, y - 3, w + 6, h + 6); rect(g, '#c9a25a', x - 2, y - 2, w + 4, h + 4); rect(g, '#8a6a3c', x - 1, y - 1, w + 2, h + 2); g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); fn(); g.restore(); }
function trophy(g, x, y, col = '#ffd65a') {
  const R = rampHex(col);
  rect(g, '#3a2a1a', x - 6, y - 4, 12, 4); rect(g, R[1], x - 2, y - 10, 4, 6);
  ellipse(g, R[2], x, y - 15, 6, 5); rect(g, R[2], x - 6, y - 20, 12, 5); rect(g, R[4], x - 4, y - 19, 2, 6);
  rect(g, R[1], x - 9, y - 18, 3, 6); rect(g, R[1], x + 6, y - 18, 3, 6);
}
function wave(g, x, y, w, col, amp = 2, ph = 0) { for (let xx = 0; xx < w; xx++) rect(g, col, x + xx, y + Math.round(Math.sin((xx + ph) * .2) * amp), 1, 1); }

return { canvas, rect, vgrad, bands, dither, checker, line, ellipse, poly, glow, cone, neon, brick, planks, tiles, windowPane, lamp, poster, plant, box, shelf, truss, sofa, door, board, frameArt, trophy, wave };
})();
// ---- render/ui.js
__m["render/ui.js"] = (function () {
// UI widgets: panels, gauges (told apart by colour, shape and icon), key caps, icons, menus, toasts.
const { clamp, clamp01 } = __m["core/util.js"];
const { UI, mixHex, shade } = __m["render/palette.js"];
const { drawText, textWidth, wrapText } = __m["render/pixelfont.js"];
const { rect } = __m["render/painter.js"];
const ICONS = {
  heart: ['.aa.aa.', 'acaaaaa', 'aaaaaaa', 'aaaaaaa', '.aaaaa.', '..aaa..', '...a...'],
  stun: ['..aaa..', '.a...a.', 'a..a..a', 'a.a.a.a', 'a..aa.a', '.a....a', '..aaaa.'],
  bolt: ['...aa', '..aa.', '.aa..', 'aaaa.', '..aa.', '.aa..', 'aa...'],
  bandage: ['.aaaaaa.', 'aabaabaa', 'aaccccaa', 'aaccccaa', 'aabaabaa', '.aaaaaa.'],
  coin: ['..aaa..', '.acaaa.', 'acabaaa', 'aaabaaa', 'aaabaaa', '.aaaaa.', '..aaa..'],
  star: ['...a...', '...a...', 'aaacaaa', '.aaaaa.', '..aaa..', '.aa.aa.', 'a.....a'],
  skull: ['.aaaaa.', 'aaaaaaa', 'a.aa.aa', 'aaaaaaa', '.aa.aa.', '..aaa..'],
  bell: ['...a...', '..aaa..', '.aaaaa.', '.aaaaa.', 'aaaaaaa', '...a...'],
  clock: ['.aaaaa.', 'a..a..a', 'a..a..a', 'a..aa.a', 'a.....a', '.aaaaa.'],
  trophy: ['aaaaaaa', 'aaaaaaa', '.aaaaa.', '..aaa..', '...a...', '..aaa..'],
  rank: ['aaaaaaa', 'a.....a', 'a.aaa.a', 'a.....a', 'a.aa..a', 'aaaaaaa'],
  fatigue: ['..aa...', '.a..a..', '...a...', '..a....', '.aaaa..', '.......', '..a.a.a'],
  cal: ['a.a.a.a', 'aaaaaaa', 'a.....a', 'a.a.a.a', 'a.....a', 'aaaaaaa'],
  pin: ['..aaa..', '.aaaaa.', '.aaaaa.', '..aaa..', '...a...', '...a...'],
  door: ['aaaaa', 'a...a', 'a...a', 'a..ca', 'a...a', 'aaaaa'],
  talk: ['aaaaaaa', 'a.....a', 'a.a.a.a', 'a.....a', 'aaa.aaa', '..aa...'],
  shield: ['aaaaaaa', 'acccaaa', 'aaaaaaa', '.aaaaa.', '..aaa..', '...a...'],
  arrow: ['...a...', '..aaa..', '.aaaaa.', '...a...', '...a...'],
  hp: ['.aa.aa.', 'aaaaaaa', 'aaaaaaa', '.aaaaa.', '..aaa..', '...a...'],
};
function icon(g, name, x, y, col, o = {}) {
  const b = ICONS[name];
  if (!b) return;
  const s = o.scale || 1, dark = o.dark || shade(col, -.55), light = o.light || mixHex(col, '#ffffff', .6);
  for (let r = 0; r < b.length; r++) for (let c = 0; c < b[r].length; c++) {
    const ch = b[r][c];
    if (ch === '.') continue;
    g.fillStyle = ch === 'a' ? col : ch === 'b' ? dark : light;
    g.fillRect(Math.round(x + c * s), Math.round(y + r * s), s, s);
  }
  if (o.outline) { /* small drop shadow */ }
}
function panel(g, x, y, w, h, o = {}) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  const bg = o.bg || UI.panel, edge = o.edge || UI.edge, acc = o.accent || UI.accent, cut = o.cut != null ? o.cut : 4;
  g.globalAlpha = o.alpha != null ? o.alpha : 1;
  rect(g, '#05060f', x - 1, y - 1, w + 2, h + 2);
  rect(g, bg, x, y, w, h);
  rect(g, mixHex(bg, '#ffffff', .05), x, y, w, Math.min(h, 10));
  rect(g, edge, x, y, w, 1); rect(g, shade(edge, -.4), x, y + h - 1, w, 1); rect(g, edge, x, y, 1, h); rect(g, shade(edge, -.4), x + w - 1, y, 1, h);
  if (cut) { for (let i = 0; i < cut; i++) { rect(g, '#05060f', x + w - cut + i, y + i, cut - i, 1); } rect(g, acc, x + w - cut - 10, y, 10, 1); }
  if (o.accentBar !== false) rect(g, acc, x, y + 2, 2, Math.min(h - 4, 12));
  g.globalAlpha = 1;
}
// Gauge. style: 'hp' (thick, segmented, heart), 'stun' (thin, chain dashes, spiral), 'fin' (wave cells, bolt), 'inj' (bandage, stripes).
function gauge(g, x, y, w, h, v, style, o = {}) {
  v = clamp01(v);
  const col = o.col || UI[style] || UI.hp, colD = o.colD || UI[style + 'D'] || shade(col, -.5), back = '#0a0b18';
  x = Math.round(x); y = Math.round(y);
  rect(g, '#05060f', x - 1, y - 1, w + 2, h + 2); rect(g, back, x, y, w, h);
  const fw = Math.round(w * v), flip = o.flip;
  const X = n => (flip ? x + w - n : x);
  if (o.trail != null && o.trail > v) { const tw = Math.round(w * clamp01(o.trail)); rect(g, '#fff4e0', flip ? x + w - tw : x, y, tw, h); }
  if (fw > 0) {
    rect(g, colD, X(fw), y, fw, h);
    rect(g, col, X(fw), y, fw, Math.max(1, h - (h > 4 ? 2 : 1)));
    rect(g, mixHex(col, '#ffffff', .45), X(fw), y, fw, 1);
  }
  if (style === 'hp') for (let i = 1; i < 10; i++) rect(g, back, x + Math.round(w * i / 10), y, 1, h);
  else if (style === 'stun') for (let i = 3; i < w; i += 6) rect(g, back, x + i, y, 1, h);
  else if (style === 'fin') for (let i = 1; i < 5; i++) rect(g, back, x + Math.round(w * i / 5), y, 2, h);
  else if (style === 'inj') for (let i = 2; i < w; i += 5) rect(g, 'rgba(0,0,0,.35)', x + i, y + 1, 2, h - 2);
  if (o.blink && v < (o.blinkBelow || .25) && Math.floor((o.time || 0) * 6) % 2) rect(g, 'rgba(255,255,255,.35)', X(fw), y, fw, h);
  if (o.full && v >= 1) { const k = .5 + .5 * Math.sin((o.time || 0) * 10); g.globalAlpha = .35 + k * .4; rect(g, '#ffffff', x, y, w, h); g.globalAlpha = 1; }
  if (o.icon) icon(g, o.icon, flip ? x + w + 3 : x - 10, y + Math.round(h / 2) - 3, o.iconCol || col);
}
function keycap(g, label, x, y, o = {}) {
  const w = Math.max(11, textWidth(label, 11) + 6), h = 12;
  x = Math.round(x); y = Math.round(y);
  rect(g, '#05060f', x - 1, y - 1, w + 2, h + 2); rect(g, o.bg || '#d8def5', x, y, w, h - 1); rect(g, '#8a93b8', x, y + h - 2, w, 1); rect(g, '#ffffff', x, y, w, 1);
  drawText(g, label, x + w / 2, y + 1, { size: 11, align: 'c', color: o.color || '#141a36' });
  return w;
}
// "[K] 잡기" style prompt. Returns width.
function prompt(g, keys, text, x, y, o = {}) {
  let cx = x;
  const parts = [];
  for (const k of keys) parts.push(k);
  const total = parts.reduce((s, k) => s + Math.max(11, textWidth(k, 11) + 6) + 2, 0) + textWidth(text, 11) + 4;
  if (o.align === 'c') cx = x - total / 2; else if (o.align === 'r') cx = x - total;
  if (o.bg) panel(g, cx - 5, y - 3, total + 10, 18, { cut: 2, accentBar: false, alpha: .9 });
  for (const k of parts) cx += keycap(g, k, cx, y) + 2;
  drawText(g, text, cx + 2, y, { size: 11, color: o.color || UI.text, outline: o.bg ? null : '#05060f' });
  return total;
}
function menuList(g, items, sel, x, y, o = {}) {
  const lh = o.lh || 18, w = o.w || 200;
  items.forEach((it, i) => {
    const yy = y + i * lh, on = i === sel, dis = it.disabled;
    if (on) { rect(g, mixHex(UI.accent, UI.panel, .55), x - 6, yy - 2, w + 12, lh - 2); rect(g, UI.accent, x - 6, yy - 2, 2, lh - 2); }
    const label = typeof it === 'string' ? it : it.label;
    drawText(g, (on ? '▶ ' : '  ') + label, x, yy, { color: dis ? UI.faint : on ? '#ffffff' : UI.dim, size: o.size || 14 });
    if (it.value != null) drawText(g, String(it.value), x + w, yy, { align: 'r', color: on ? '#ffd65a' : UI.dim, size: o.size || 14 });
  });
}
function wrapped(g, text, x, y, w, o = {}) { const lines = wrapText(text, w, o.size || 14); lines.forEach((l, i) => drawText(g, l, x, y + i * (o.lh || 17), o)); return lines.length; }
function fade(g, a, col = '#05060f') { if (a <= 0) return; g.globalAlpha = clamp(a, 0, 1); rect(g, col, 0, 0, 640, 360); g.globalAlpha = 1; }
function banner(g, text, y, col, o = {}) {
  const sc = o.scale || 3, w = textWidth(text, 14, sc, true);
  const x = 320 - w / 2;
  if (o.band) { g.globalAlpha = o.bandAlpha != null ? o.bandAlpha : .78; rect(g, o.band, 0, y - 8, 640, 14 * sc + 16); g.globalAlpha = 1; rect(g, col, 0, y - 9, 640, 1); rect(g, col, 0, y + 14 * sc + 8, 640, 1); }
  drawText(g, text, x + 2, y + 3, { scale: sc, color: '#05060f', bold: true });
  drawText(g, text, x, y, { scale: sc, color: col, bold: true, outline: '#05060f', grad: o.grad });
  if (o.sub) drawText(g, o.sub, 320, y + 14 * sc + 4, { align: 'c', color: o.subCol || '#eef2ff', outline: '#05060f' });
}

return { icon, panel, gauge, keycap, prompt, menuList, wrapped, fade, banner };
})();
// ---- core/GameManager.js
__m["core/GameManager.js"] = (function () {
// Main loop, scene stack, fades, shared services (screen, input, audio, settings).
const { VIEW_W, VIEW_H, clamp } = __m["core/util.js"];
const { Screen } = __m["render/screen.js"];
const { InputManager } = __m["core/InputManager.js"];
const { AudioManager } = __m["core/AudioManager.js"];
const { loadSettings, saveSettings } = __m["core/SaveManager.js"];
const { rect } = __m["render/painter.js"];
class GameManager {
  constructor(canvas) {
    this.screen = new Screen(canvas);
    this.input = new InputManager();
    this.audio = new AudioManager();
    this.settings = loadSettings();
    this.applySettings();
    this.scene = null; this.overlays = []; this.trans = null; this.fps = 60; this.time = 0; this.last = 0; this.frames = 0; this.fpsT = 0; this.manual = false;
    window.addEventListener('resize', () => this.screen.resize());
    const wake = () => this.audio.init();
    window.addEventListener('keydown', wake); window.addEventListener('pointerdown', wake);
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.scene && this.scene.m && !this.scene.paused && this.scene.m.phase === 'fight' && !this.manual) this.scene.paused = true; });
  }
  applySettings() {
    const s = this.settings;
    this.audio.vol.master = s.master; this.audio.vol.music = s.music; this.audio.vol.sfx = s.sfx;
    for (const k of ['master', 'music', 'sfx']) this.audio.setVolume(k, s[k]);
    this.screen.shakeScale = s.shake; this.screen.flashScale = s.flash; this.screen.fx.scan = s.scan ? .6 : 0;
    this.input.setBindings(s.keys);
  }
  saveSettings() { this.settings.keys = this.input.keys; saveSettings(this.settings); }
  // Swap the scene with a fade.
  go(make, o = {}) {
    const dur = o.fade != null ? o.fade : .28;
    if (!this.scene || dur <= 0) { this.scene = typeof make === 'function' ? make() : make; this.overlays = []; this.input.clear(); return; }
    this.trans = { t: 0, dur, make, swapped: false };
  }
  push(o) { this.overlays.push(o); this.input.clear(); }
  pop() { this.overlays.pop(); this.input.clear(); }
  start() { const loop = ts => { if (!this.manual) this.frame(ts); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  frame(ts) {
    const dt = this.last ? clamp((ts - this.last) / 1000, 0, 1 / 20) : 1 / 60;
    this.last = ts;
    this.step(dt);
  }
  step(dt) {
    this.time += dt; this.frames++; this.fpsT += dt;
    if (this.fpsT >= .5) { this.fps = this.frames / this.fpsT; this.frames = 0; this.fpsT = 0; }
    this.input.poll();
    const tr = this.trans;
    if (tr) {
      tr.t += dt;
      if (!tr.swapped && tr.t >= tr.dur) { tr.swapped = true; this.scene = typeof tr.make === 'function' ? tr.make() : tr.make; this.overlays = []; this.input.clear(); }
      if (tr.t >= tr.dur * 2) this.trans = null;
    }
    const top = this.overlays[this.overlays.length - 1];
    if (!tr || tr.swapped) { if (top) top.update(dt); else if (this.scene) this.scene.update(dt); }
    this.render(dt);
    this.input.endFrame();
  }
  render(dt) {
    const S = this.screen;
    S.update(dt);
    S.w.imageSmoothingEnabled = false; S.u.imageSmoothingEnabled = false;
    if (this.scene) this.scene.draw(S.w, S.u);
    for (const o of this.overlays) o.draw(S.w, S.u);
    const tr = this.trans;
    if (tr) { const a = tr.swapped ? 1 - (tr.t - tr.dur) / tr.dur : tr.t / tr.dur; this.fadeOver(S.u, clamp(a, 0, 1)); }
    S.present();
  }
  fadeOver(u, a) {
    // iris-like band wipe so scene changes feel like a curtain on a stage
    const n = 12;
    for (let i = 0; i < n; i++) { const k = clamp(a * 1.6 - (i / n) * .6, 0, 1); rect(u, '#05060f', 0, Math.floor(i * VIEW_H / n), VIEW_W, Math.ceil(VIEW_H / n * k)); }
  }
  showControls(back) { this.push(new ControlsOverlay(this, back)); }
}

// Controls list shown from title and pause.
const { drawText } = __m["render/pixelfont.js"];
const { panel, keycap, fade } = __m["render/ui.js"];
const { UI } = __m["render/palette.js"];
class ControlsOverlay {
  constructor(game) { this.game = game; this.page = 0; }
  update() { const i = this.game.input; if (i.menuPressed('cancel') || i.menuPressed('confirm') || i.pressed('pause')) { this.game.audio.sfx('back'); this.game.pop(); } if (i.pressed('left') || i.pressed('right')) this.page ^= 1; }
  draw(w, u) {
    const i = this.game.input;
    fade(u, .7);
    panel(u, 60, 24, 520, 312, { accent: '#49d6ff' });
    drawText(u, this.page ? '조작법 — 탐험' : '조작법 — 경기', 320, 34, { align: 'c', color: '#49d6ff', bold: true });
    const L = this.page ? [
      [['left', 'right'], '이동'], [['up'], '점프'], [['interact'], 'NPC 대화 · 물건 조사'], [['door'], '문으로 이동'], [['info'], '선수 · 커리어 정보 (부상 게이지)'], [['map'], '지도'], [['pause'], '일시정지 · 저장'],
    ] : [
      [['left', 'right'], '이동 (두 번 누르거나 계속 누르면 달리기)'], [['up'], '점프 · 로프 앞에서 코너 오르기 · 링 밖에서 링으로'], [['down'], '방어 (막 누른 순간 = 패리) · 핀폴 · 태그'], [['atk'], '공격 (연타 3단) · 공중에서 드롭킥 · 쓰러진 상대 짓밟기'],
      [['grab'], '쓰러지거나 비틀거리는 상대 잡기 · 서 있는 상대 밀치기(가드 깨기)'], [['grab'], '잡은 뒤: 방향 + K = 기술 선택, J 무릎치기, L 뒤로 돌기'], [['dodge'], '회피 · 공격 직전에 누르면 반격 던지기'], [['dodge'], '기술에 걸린 순간 L! 표시에 맞춰 누르면 역전'], [['down', 'dodge'], '긴급 탈출 (피니셔 게이지 35 소모, 18초 대기)'], [['fin'], '피니셔 (게이지 가득) · 게이지가 덜 찼으면 도발'],
    ];
    L.forEach(([acts, text], k) => {
      let x = 84; const y = 60 + k * 25;
      acts.forEach((a, n) => { if (n) { drawText(u, '+', x + 1, y, { size: 11, color: UI.dim }); x += 9; } x += keycap(u, i.label(a), x, y) + 3; });
      drawText(u, text, 180, y, { size: 11, color: '#eef2ff' });
    });
    drawText(u, '← → 페이지 · Esc 닫기 · 키는 설정에서 바꿀 수 있습니다', 320, 318, { size: 11, align: 'c', color: UI.dim });
  }
}

return { GameManager, ControlsOverlay };
})();
// ---- render/raster.js
__m["render/raster.js"] = (function () {
// Software pixel rasterizer for bodies. Every limb is a lit capsule written straight to pixels, so rotated
// limbs keep one light direction, a clean one-pixel contour and no rotated-sprite jaggies.
const { makeCanvas, ctxOf } = __m["core/util.js"];
const { OUTLINE, packHex } = __m["render/palette.js"];
const BODY_W = 288, BODY_H = 240;
const BAYER = new Float32Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v / 16 - .47)));

class BodyCanvas {
  constructor(w = BODY_W, h = BODY_H) {
    this.w = w; this.h = h;
    this.canvas = makeCanvas(w, h); this.g = ctxOf(this.canvas, { willReadFrequently: true });
    this.img = this.g.createImageData(w, h);
    this.px = new Uint32Array(this.img.data.buffer);
    this.gid = new Uint8Array(w * h);
    this.lx = -.36; this.ly = -.72; this.lz = .59;
    this.rx = .86; this.ry = -.3; this.rim = 0; this.rimAmt = .46;
    this.dither = .16; this.light = 0;
    this.ox = 0; this.oy = 0;
    this.clear();
  }
  setLight(env) {
    this.rim = env && env.rim ? packHex(env.rim) : 0;
    this.light = env && env.light ? env.light : 0;
    if (env && env.rimX != null) this.rx = env.rimX;
  }
  // (cx, cy) is the world point that lands on the middle of the buffer.
  begin(cx, cy) { this.ox = Math.round(cx) - (this.w >> 1); this.oy = Math.round(cy) - (this.h >> 1); this.clear(); }
  clear() { this.px.fill(0); this.gid.fill(0); this.x0 = this.w; this.y0 = this.h; this.x1 = 0; this.y1 = 0; }
  grow(a, b, c, d) { if (a < this.x0) this.x0 = a; if (b < this.y0) this.y0 = b; if (c > this.x1) this.x1 = c; if (d > this.y1) this.y1 = d; }
  tone(lum, x, y) {
    const l = lum + this.light + BAYER[(y & 3) * 4 + (x & 3)] * this.dither;
    return l < -.34 ? 0 : l < .08 ? 1 : l < .58 ? 2 : l < .9 ? 3 : 4;
  }
  /* segs: [{t, ramp, pat?}] along the axis. jr>0 keeps the contour away from the joint circle (jx, jy). */
  capsule(ax, ay, ra, bx, by, rb, segs, grp, bulge = 0, jr = 0, dark = 0, jx = ax, jy = ay) {
    ax -= this.ox; ay -= this.oy; bx -= this.ox; by -= this.oy; jx -= this.ox; jy -= this.oy;
    const m = Math.max(ra, rb) + Math.max(0, bulge) + 2;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - m)), x1 = Math.min(this.w - 1, Math.ceil(Math.max(ax, bx) + m));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - m)), y1 = Math.min(this.h - 1, Math.ceil(Math.max(ay, by) + m));
    if (x1 < x0 || y1 < y0) return;
    this.grow(x0, y0, x1, y1);
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy + 1e-6, iL2 = 1 / L2, L = Math.sqrt(L2);
    const ux = dx / L, uy = dy / L; // axis
    const px = this.px, gid = this.gid, W = this.w, j2 = jr * jr;
    const lx = this.lx, ly = this.ly, lz = this.lz, rimC = this.rim, rrx = this.rx, rry = this.ry, rimT = this.rimAmt;
    const n = segs.length;
    for (let y = y0; y <= y1; y++) {
      const py = y + .5 - ay;
      for (let x = x0; x <= x1; x++) {
        const qx = x + .5 - ax;
        let t = (qx * dx + py * dy) * iL2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const r = ra + (rb - ra) * t + bulge * 4 * t * (1 - t);
        const ex = qx - dx * t, ey = py - dy * t, d2 = ex * ex + ey * ey;
        const i = y * W + x;
        if (d2 <= r * r) {
          const inv = 1 / r, nx = ex * inv, ny = ey * inv, q = 1 - nx * nx - ny * ny, nz = q > 0 ? Math.sqrt(q) : 0;
          let k = 0;
          while (k < n - 1 && t > segs[k].t) k++;
          const seg = segs[k];
          let rp = seg.ramp;
          const lum = nx * lx + ny * ly + nz * lz - dark;
          let tone = this.tone(lum, x, y);
          if (seg.pat) {
            const s = -nx * uy + ny * ux; // signed across
            const alt = seg.pat(t, s, tone);
            if (alt) { if (alt.length) rp = alt; else tone = Math.max(0, Math.min(4, tone + alt)); }
          }
          let c = rp[tone];
          if (rimC && nz < rimT && nx * rrx + ny * rry > .62 && tone > 0) c = rimC;
          px[i] = c; gid[i] = grp;
        } else if (gid[i] && gid[i] !== grp) {
          const r1 = r + 1;
          if (d2 <= r1 * r1) {
            if (j2 > 0) { const jdx = x + .5 - jx, jdy = y + .5 - jy; if (jdx * jdx + jdy * jdy < j2) continue; }
            px[i] = OUTLINE; gid[i] = 254;
          }
        }
      }
    }
  }
  ball(x, y, r, rampC, grp, jr = 0, dark = 0) { this.capsule(x, y, r, x + .01, y, r, [{ t: 1, ramp: rampC }], grp, 0, jr, dark); }
  /* Torso: a profile swept along the spine. prof rows are [v, back, front]. shadeFn(u, v, d) returns {ramp, dt} via fields. */
  torso(ax, ay, bx, by, fx, fy, prof, shader, grp, dark = 0) {
    ax -= this.ox; ay -= this.oy; bx -= this.ox; by -= this.oy;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy + 1e-6, iL2 = 1 / L2;
    let m = 0;
    for (const p of prof) m = Math.max(m, p[1], p[2]);
    m += 2;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - m)), x1 = Math.min(this.w - 1, Math.ceil(Math.max(ax, bx) + m));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - m)), y1 = Math.min(this.h - 1, Math.ceil(Math.max(ay, by) + m));
    if (x1 < x0 || y1 < y0) return;
    this.grow(x0, y0, x1, y1);
    const L = Math.sqrt(L2), ux = dx / L, uy = dy / L, px = this.px, gid = this.gid, W = this.w;
    const lx = this.lx, ly = this.ly, lz = this.lz, rimC = this.rim, rrx = this.rx, rry = this.ry;
    const np = prof.length;
    const out = { ramp: null, dt: 0 };
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const qx = x + .5 - ax, qy = y + .5 - ay;
      let v = (qx * dx + qy * dy) * iL2;
      if (v < -.04 || v > 1.04) continue;
      const vc = v < 0 ? 0 : v > 1 ? 1 : v;
      let k = 1;
      while (k < np - 1 && vc > prof[k][0]) k++;
      const p0 = prof[k - 1], p1 = prof[k];
      let t = (vc - p0[0]) / (p1[0] - p0[0] || 1);
      t = t < 0 ? 0 : t > 1 ? 1 : t; t = t * t * (3 - 2 * t);
      const d = qx * fx + qy * fy;
      let w = d >= 0 ? p0[2] + (p1[2] - p0[2]) * t : p0[1] + (p1[1] - p0[1]) * t;
      if (v < 0) w *= Math.sqrt(Math.max(0, 1 + v / .04)); else if (v > 1) w *= Math.sqrt(Math.max(0, 1 - (v - 1) / .04));
      const i = y * W + x, ad = d < 0 ? -d : d;
      if (w > .3 && ad <= w) {
        const u = d / w, q = 1 - u * u, nzc = q > 0 ? Math.sqrt(q) : 0;
        // slope of the outline tilts the normal up or down the body
        const sl = ((d >= 0 ? p1[2] - p0[2] : p1[1] - p0[1]) / ((p1[0] - p0[0] || 1) * L)) * -.55;
        const nx = fx * u + ux * sl * .7, ny = fy * u + uy * sl * .7;
        out.ramp = null; out.dt = 0;
        shader(u, vc, out);
        const lum = nx * lx + ny * ly + nzc * lz - dark;
        let tn = this.tone(lum + out.dt * .3, x, y);
        let c = out.ramp[tn];
        if (rimC && ad > w - 1.1 && (fx * u) * rrx + (fy * u) * rry > .55 && tn > 0) c = rimC;
        px[i] = c; gid[i] = grp;
      } else if (gid[i] && gid[i] !== grp && w > .3 && ad <= w + 1) { px[i] = OUTLINE; gid[i] = 254; }
    }
  }
  /* Convex quad or polygon with a per-pixel cloth ramp. pts: [[x,y],...]. */
  poly(pts, rampC, grp, opt = {}) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const P = pts.map(p => [p[0] - this.ox, p[1] - this.oy]);
    for (const p of P) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    x0 = Math.max(0, Math.floor(x0) - 1); y0 = Math.max(0, Math.floor(y0) - 1); x1 = Math.min(this.w - 1, Math.ceil(x1) + 1); y1 = Math.min(this.h - 1, Math.ceil(y1) + 1);
    if (x1 < x0 || y1 < y0) return;
    this.grow(x0, y0, x1, y1);
    const W = this.w, px = this.px, gid = this.gid, n = P.length;
    const inside = (x, y) => { let c = false; for (let a = 0, b = n - 1; a < n; b = a++) { const A = P[a], B = P[b]; if ((A[1] > y) !== (B[1] > y) && x < (B[0] - A[0]) * (y - A[1]) / (B[1] - A[1]) + A[0]) c = !c; } return c; };
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (inside(x + .5, y + .5)) {
        const fx = (x - x0) / (x1 - x0 || 1);
        let lum = opt.flat != null ? opt.flat : .62 - Math.abs(fx - (opt.mid ?? .38)) * 1.1;
        if (opt.folds) lum += Math.sin(fx * opt.folds * 6.28 + (opt.phase || 0)) * .28;
        px[i] = (opt.pat ? opt.pat(fx, (y - y0) / (y1 - y0 || 1)) || rampC : rampC)[this.tone(lum - (opt.dark || 0), x, y)]; gid[i] = grp;
      }
    }
    if (opt.noOutline) return;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (gid[i] === grp || !gid[i]) continue;
      if ((x > 0 && gid[i - 1] === grp) || (x < W - 1 && gid[i + 1] === grp) || (y > 0 && gid[i - W] === grp) || (y < this.h - 1 && gid[i + W] === grp)) { if (opt.clearTop && y <= y0 + 2) continue; px[i] = OUTLINE; gid[i] = 254; }
    }
  }
  /* Rotated texture (Uint32, tw x th, ts texels per pixel). cxT, cyT: texture origin. */
  sprite(tex, tw, th, ts, cxT, cyT, x, y, ca, sa, flip, grp, scale = 1, shadeLow = 0) {
    x -= this.ox; y -= this.oy;
    const R = Math.ceil(Math.hypot(tw, th) / ts / 2 * scale) + 4;
    const X = Math.round(x), Y = Math.round(y);
    const x0 = Math.max(1, X - R), x1 = Math.min(this.w - 2, X + R), y0 = Math.max(1, Y - R), y1 = Math.min(this.h - 2, Y + R);
    if (x1 < x0 || y1 < y0) return;
    this.grow(x0, y0, x1, y1);
    const W = this.w, px = this.px, gid = this.gid, k = ts / scale;
    for (let pass = 0; pass < 2; pass++) for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
      const dx = xx + .5 - x, dy = yy + .5 - y;
      let u = dx * ca + dy * sa;
      const v = -dx * sa + dy * ca;
      if (flip) u = -u;
      const tx = Math.floor(u * k + cxT), ty = Math.floor(v * k + cyT);
      if (tx < 0 || ty < 0 || tx >= tw || ty >= th) continue;
      const c = tex[ty * tw + tx];
      if ((c >>> 24) < 128) continue;
      const i = yy * W + xx;
      if (pass === 0) {
        for (const o of [i - 1, i + 1, i - W, i + W]) if (gid[o] && gid[o] !== grp) { px[o] = OUTLINE; gid[o] = 254; }
      } else { px[i] = (c | 0xff000000) >>> 0; gid[i] = grp; }
    }
    void shadeLow;
  }
  /* Outer contour, optional whole-body recolour, then upload. */
  finish(opts = {}) {
    const W = this.w, H = this.h, px = this.px, gid = this.gid;
    const x0 = Math.max(1, this.x0 - 1), y0 = Math.max(1, this.y0 - 1), x1 = Math.min(W - 2, this.x1 + 1), y1 = Math.min(H - 2, this.y1 + 1);
    const out = opts.outline != null ? opts.outline : OUTLINE;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (gid[i]) continue;
      if ((gid[i - 1] && gid[i - 1] !== 255) || (gid[i + 1] && gid[i + 1] !== 255) || (gid[i - W] && gid[i - W] !== 255) || (gid[i + W] && gid[i + W] !== 255)) { px[i] = out; gid[i] = 255; }
    }
    if (opts.flat) { const f = opts.flat; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x; if (gid[i] && gid[i] !== 255) px[i] = f; } }
    this.bx = x0; this.by = y0; this.bw = Math.max(1, x1 - x0 + 1); this.bh = Math.max(1, y1 - y0 + 1);
    this.g.clearRect(0, 0, W, H);
    this.g.putImageData(this.img, 0, 0, x0, y0, this.bw, this.bh);
  }
  drawTo(g, camX = 0, camY = 0, alpha = 1) {
    if (alpha !== 1) g.globalAlpha = alpha;
    g.drawImage(this.canvas, this.bx, this.by, this.bw, this.bh, this.ox + this.bx - camX, this.oy + this.by - camY, this.bw, this.bh);
    if (alpha !== 1) g.globalAlpha = 1;
  }
}

return { BODY_W, BodyCanvas };
})();
// ---- anim/skeleton.js
__m["anim/skeleton.js"] = (function () {
// Poses, body proportions, forward kinematics and two-bone IK.
// Poses are written facing right. Angles in degrees. Arms: 0 hangs along the torso, 90 points forward, 180 up.
// Forearm flex is positive toward the front. Thigh: 0 straight down, 90 forward. Knee flex is positive (shin goes back).
const { DEG, clamp, lerp } = __m["core/util.js"];
const PF = { r: 0, sp: 1, hd: 2, a1: 3, a2: 4, b1: 5, b2: 6, t1: 7, t2: 8, u1: 9, u2: 10, lift: 11, ox: 12, f1: 13, f2: 14, sq: 15 };
const POSE_N = 16;
const PAIRS = { a: [3, 4], b: [5, 6], t: [7, 8], u: [9, 10], f: [13, 14] };
const SINGLES = { r: 0, sp: 1, hd: 2, lift: 11, ox: 12, sq: 15 };
const poseMemo = new Map();
// 'sp10 hd-5 a60/90 b70/80 t15/20 u-15/20 lift4'
function pose(str) {
  let p = poseMemo.get(str);
  if (p) return p;
  p = new Float32Array(POSE_N);
  for (const tk of str.trim().split(/\s+/)) {
    if (!tk) continue;
    const m = /^([a-z]+)(-?[\d.]+)(?:\/(-?[\d.]+))?$/.exec(tk);
    if (!m) throw new Error('bad pose token ' + tk + ' in ' + str);
    if (PAIRS[m[1]]) { p[PAIRS[m[1]][0]] = +m[2]; p[PAIRS[m[1]][1]] = m[3] != null ? +m[3] : 0; }
    else if (m[1] in SINGLES) p[SINGLES[m[1]]] = +m[2];
    else throw new Error('bad pose key ' + tk);
  }
  poseMemo.set(str, p);
  return p;
}
function poseLerp(a, b, t, out) { for (let i = 0; i < POSE_N; i++) out[i] = a[i] + (b[i] - a[i]) * t; return out; }
function poseAdd(p, q, k = 1) { for (let i = 0; i < POSE_N; i++) p[i] += q[i] * k; return p; }

// Joint indices (x,y pairs).
const J = { pelvis: 0, chest: 1, neck: 2, head: 3, sN: 4, eN: 5, hN: 6, sF: 7, eF: 8, hF: 9, pN: 10, kN: 11, aN: 12, tN: 13, pF: 14, kF: 15, aF: 16, tF: 17 };
const JN = 18;

// Body builds. prof rows: [v, back, front] half widths of the torso at scale 1.
const BUILDS = {
  athletic: { spine: 23, nk: 4, hd: 12, ua: 16, fa: 15, th: 20, sh: 19, ft: 4, fl: 10, sx: [-10, 8.5], hx: [-4.2, 4.2], uaR: [7.2, 5.6, .7], faR: [5.7, 4.1, .9], hR: 4.6, thR: [9, 6.6, .9], shR: [6.5, 4.4, 1.2], ftR: 4.4, nkR: 5, head: 1, mus: 1, prof: [[0, 8.5, 8.5], [.14, 10.2, 10.2], [.36, 9.6, 9.8], [.56, 12, 11.4], [.76, 14.6, 13.6], [.9, 12.6, 12], [1, 7, 7]] },
  power: { spine: 24, nk: 3, hd: 12, ua: 17, fa: 16, th: 19, sh: 18, ft: 4, fl: 11, sx: [-13.5, 11], hx: [-5, 5], uaR: [9, 7, 1.2], faR: [7.2, 5, 1.2], hR: 5.4, thR: [10.6, 7.6, 1], shR: [7.4, 5, 1.3], ftR: 5, nkR: 6.4, head: .98, mus: 1.2, prof: [[0, 9.5, 9.5], [.14, 11.5, 11.5], [.36, 11.5, 11.5], [.56, 15, 13.6], [.76, 18.4, 16.4], [.9, 16, 14.4], [1, 8.5, 8.5]] },
  lean: { spine: 22, nk: 4, hd: 12, ua: 15.5, fa: 15, th: 21, sh: 20, ft: 4, fl: 9.5, sx: [-8.4, 7.4], hx: [-3.4, 3.4], uaR: [5.8, 4.6, .6], faR: [4.8, 3.6, .7], hR: 4.1, thR: [7.8, 5.6, .9], shR: [5.6, 3.9, 1], ftR: 4, nkR: 4.3, head: 1, mus: .9, prof: [[0, 7, 7], [.14, 8.2, 8.4], [.36, 7.4, 7.8], [.56, 9.4, 9.2], [.76, 11.6, 11], [.9, 10, 9.8], [1, 6, 6]] },
  heavy: { spine: 24, nk: 3, hd: 12, ua: 16, fa: 15, th: 18, sh: 17, ft: 4, fl: 11, sx: [-13.5, 11], hx: [-5.6, 5.6], uaR: [9, 7.2, .6], faR: [7, 5, .6], hR: 5.2, thR: [11.6, 8, .5], shR: [7.6, 5.4, .8], ftR: 5, nkR: 7, head: 1.02, mus: 0, belly: 1, prof: [[0, 11, 12], [.12, 13.4, 16], [.3, 14, 20.5], [.5, 15.4, 19], [.74, 17.4, 16.4], [.9, 14.6, 13.4], [1, 8, 8]] },
  giant: { spine: 27, nk: 4, hd: 12.5, ua: 19, fa: 18, th: 23, sh: 22, ft: 5, fl: 12, sx: [-12.5, 10.5], hx: [-4.8, 4.8], uaR: [8.4, 6.6, .9], faR: [6.8, 4.9, .9], hR: 5.6, thR: [10.4, 7.6, .8], shR: [7.2, 5, 1], ftR: 5.2, nkR: 6, head: 1.02, mus: .9, prof: [[0, 9.4, 9.4], [.14, 11.4, 11.4], [.36, 11, 11.4], [.56, 13.6, 13], [.76, 17, 15.6], [.9, 14.6, 13.6], [1, 8, 8]] },
  fem: { spine: 21, nk: 4, hd: 12, ua: 14.5, fa: 14, th: 20.5, sh: 19.5, ft: 4, fl: 9, sx: [-7.6, 6.6], hx: [-3.8, 3.8], uaR: [5, 4, .5], faR: [4.3, 3.3, .6], hR: 3.9, thR: [8.6, 5.8, .8], shR: [5.7, 3.8, 1.1], ftR: 3.9, nkR: 3.9, head: 1, mus: .55, fem: 1, prof: [[0, 8.6, 8], [.14, 9.8, 9.2], [.36, 7.2, 7.4], [.56, 8.4, 8.6], [.74, 9.4, 11.2], [.88, 8.6, 8.8], [1, 5.2, 5.2]] },
  femPower: { spine: 22, nk: 4, hd: 12, ua: 15.5, fa: 15, th: 20, sh: 19, ft: 4, fl: 10, sx: [-9, 7.8], hx: [-4.4, 4.4], uaR: [6.6, 5.2, .9], faR: [5.4, 4, .9], hR: 4.4, thR: [10, 6.8, .9], shR: [6.5, 4.3, 1.2], ftR: 4.3, nkR: 4.6, head: 1, mus: .9, fem: 1, prof: [[0, 9.6, 9], [.14, 11, 10.4], [.36, 8.8, 8.8], [.56, 10.4, 10.2], [.74, 12, 12.6], [.88, 10.8, 10.4], [1, 6.2, 6.2]] },
  slim: { spine: 22, nk: 4, hd: 12, ua: 15, fa: 14.5, th: 20, sh: 19, ft: 4, fl: 9.5, sx: [-7.6, 6.6], hx: [-3.2, 3.2], uaR: [5.2, 4.4, .3], faR: [4.5, 3.6, .4], hR: 4, thR: [7.4, 5.4, .5], shR: [5.2, 4, .6], ftR: 4, nkR: 4, head: 1, mus: 0, prof: [[0, 7.6, 7.6], [.14, 8.4, 8.6], [.36, 8, 8.4], [.56, 9, 9], [.76, 10.6, 10], [.9, 9.4, 9], [1, 5.6, 5.6]] },
  stout: { spine: 21, nk: 3, hd: 12, ua: 14, fa: 13, th: 16, sh: 15, ft: 4, fl: 10, sx: [-9, 8], hx: [-4.4, 4.4], uaR: [6.8, 5.6, .3], faR: [5.4, 4.2, .3], hR: 4.4, thR: [9, 6.8, .3], shR: [6, 4.6, .5], ftR: 4.4, nkR: 5.4, head: 1.04, mus: 0, belly: 1, prof: [[0, 9, 10], [.14, 11, 13.6], [.32, 11.4, 16.4], [.54, 12, 14.6], [.76, 12.8, 12], [.9, 11, 10], [1, 6.4, 6.4]] },
  elder: { spine: 20, nk: 3, hd: 12, ua: 14, fa: 13, th: 17, sh: 16, ft: 4, fl: 9, sx: [-6.6, 6], hx: [-3.2, 3.2], uaR: [4.8, 4, .3], faR: [4.2, 3.4, .3], hR: 3.8, thR: [7, 5.2, .4], shR: [5, 3.8, .5], ftR: 3.9, nkR: 3.8, head: 1.02, mus: 0, prof: [[0, 8, 8], [.14, 9, 9.4], [.36, 8.6, 9.4], [.56, 8.8, 9], [.76, 9.4, 9.2], [.9, 8.4, 8.2], [1, 5, 5]] },
};
const dimsMemo = new Map();
function dimsFor(build, scale = 1) {
  const key = build + scale;
  let d = dimsMemo.get(key);
  if (d) return d;
  const b = BUILDS[build] || BUILDS.athletic, s = scale, m = a => a.map(v => v * s);
  d = {
    build, scale, spine: b.spine * s, nk: b.nk * s, hd: b.hd * s, ua: b.ua * s, fa: b.fa * s, th: b.th * s, sh: b.sh * s, ft: b.ft * s, fl: b.fl * s,
    sx: m(b.sx), hx: m(b.hx), uaR: m(b.uaR), faR: m(b.faR), hR: b.hR * s, thR: m(b.thR), shR: m(b.shR), ftR: b.ftR * s, nkR: b.nkR * s, head: b.head * Math.pow(s, .6), mus: b.mus, belly: b.belly || 0, fem: b.fem || 0,
    prof: b.prof.map(p => [p[0], p[1] * s, p[2] * s]),
  };
  d.leg = d.th + d.sh + d.ft;
  d.height = d.leg + d.spine + d.nk + d.hd + 12 * d.head;
  d.reach = d.ua + d.fa + d.hR;
  // radius used for ground contact per joint
  d.gr = new Float32Array(JN);
  d.gr[J.pelvis] = d.thR[0] * .95; d.gr[J.chest] = d.uaR[0] + 1.5; d.gr[J.neck] = 3; d.gr[J.head] = 10 * d.head;
  for (const k of ['eN', 'eF']) d.gr[J[k]] = d.faR[0] * .8;
  for (const k of ['hN', 'hF']) d.gr[J[k]] = d.hR * .7;
  for (const k of ['kN', 'kF']) d.gr[J[k]] = d.shR[0] * .8;
  for (const k of ['aN', 'aF']) d.gr[J[k]] = d.ft;
  for (const k of ['tN', 'tF']) d.gr[J[k]] = d.ft * .6;
  d.gr[J.sN] = d.gr[J.sF] = 2; d.gr[J.pN] = d.gr[J.pF] = 4;
  dimsMemo.set(key, d);
  return d;
}

class Joints {
  constructor() { this.p = new Float32Array(JN * 2); this.S = 0; this.H = 0; this.face = 1; this.yaw = 1; }
  x(i) { return this.p[i * 2]; }
  y(i) { return this.p[i * 2 + 1]; }
  set(i, x, y) { this.p[i * 2] = x; this.p[i * 2 + 1] = y; }
  copy(o) { this.p.set(o.p); this.S = o.S; this.H = o.H; this.face = o.face; this.yaw = o.yaw; return this; }
  lerp(a, b, t) {
    for (let i = 0; i < JN * 2; i++) this.p[i] = a.p[i] + (b.p[i] - a.p[i]) * t;
    const da = Math.atan2(Math.sin((b.S - a.S) * DEG), Math.cos((b.S - a.S) * DEG)) / DEG; this.S = a.S + da * t;
    const dh = Math.atan2(Math.sin((b.H - a.H) * DEG), Math.cos((b.H - a.H) * DEG)) / DEG; this.H = a.H + dh * t;
    this.face = t < .5 ? a.face : b.face; this.yaw = lerp(a.yaw, b.yaw, t);
    return this;
  }
}

/* Forward kinematics in facing-right local space.
   snap: put the lowest contact point on y=0 (feet origin). Otherwise the pelvis lands on (px, py). */
function solveFK(p, d, out, opt = {}) {
  const r = p[0] * DEG, S = (p[0] + p[1]) * DEG, H = (p[0] + p[1] + p[2]) * DEG;
  const P = out.p;
  const set = (i, x, y) => { P[i * 2] = x; P[i * 2 + 1] = y; };
  let X = 0, Y = 0;
  set(0, 0, 0);
  const sS = Math.sin(S), cS = Math.cos(S), sq = 1 - clamp(p[15], -.4, .6) * .5;
  const cx = sS * d.spine * sq, cy = -cS * d.spine * sq;
  set(1, cx, cy);
  const nx = cx + sS * d.nk, ny = cy - cS * d.nk;
  set(2, nx, ny);
  set(3, nx + Math.sin(H) * d.hd, ny - Math.cos(H) * d.hd);
  const arm = (si, ox, u, f) => {
    const sx = cx + cS * ox + sS * -1.5, sy = cy + sS * ox + cS * 1.5;
    const a = u * DEG - S, b = (u + f) * DEG - S;
    const ex = sx + Math.sin(a) * d.ua, ey = sy + Math.cos(a) * d.ua;
    set(si, sx, sy); set(si + 1, ex, ey); set(si + 2, ex + Math.sin(b) * d.fa, ey + Math.cos(b) * d.fa);
  };
  arm(4, d.sx[0], p[3], p[4]); arm(7, d.sx[1], p[5], p[6]);
  const cr = Math.cos(r), sr = Math.sin(r);
  const leg = (li, ox, t, k, fa) => {
    const lx = cr * ox, ly = sr * ox;
    const a = t * DEG - r, b = (t - k) * DEG - r;
    const kx = lx + Math.sin(a) * d.th, ky = ly + Math.cos(a) * d.th;
    const ax = kx + Math.sin(b) * d.sh, ay = ky + Math.cos(b) * d.sh;
    const c = b + (90 - 0) * DEG + fa * DEG; // foot points forward of the shin
    set(li, lx, ly); set(li + 1, kx, ky); set(li + 2, ax, ay); set(li + 3, ax + Math.sin(c) * d.fl * .8, ay + Math.cos(c) * d.fl * .8);
  };
  leg(10, d.hx[0], p[7], p[8], p[13]); leg(14, d.hx[1], p[9], p[10], p[14]);
  out.S = (p[0] + p[1]); out.H = (p[0] + p[1] + p[2]); out.face = 1; out.yaw = 1;
  if (opt.snap !== false) {
    // flatten feet that touch the floor, then drop the body onto its lowest point
    let low = -1e9;
    for (let i = 0; i < JN; i++) { if (i === 13 || i === 17) continue; const v = P[i * 2 + 1] + d.gr[i]; if (v > low) low = v; }
    Y = -low - p[11]; X = p[12];
    for (let i = 0; i < JN; i++) { P[i * 2] += X; P[i * 2 + 1] += Y; }
    for (const a of [12, 16]) {
      const ay = P[a * 2 + 1];
      if (ay > -d.ft - 5 && !opt.freeFeet) { // near the floor: sole goes flat
        const k = clamp((ay + d.ft + 5) / 5, 0, 1), dirx = 1;
        P[(a + 1) * 2] = lerp(P[(a + 1) * 2], P[a * 2] + dirx * d.fl * .8, k);
        P[(a + 1) * 2 + 1] = lerp(P[(a + 1) * 2 + 1], ay + d.ft * .45, k);
      }
    }
  } else {
    X = opt.px || 0; Y = (opt.py || 0);
    for (let i = 0; i < JN; i++) { P[i * 2] += X; P[i * 2 + 1] += Y; }
  }
  return out;
}

// Local facing-right joints -> world. yaw (cosine) squashes the body around its root for fake 3D spins.
function toWorld(j, face, x, y, yaw = 1) {
  const P = j.p, k = face * yaw, f = yaw < 0 ? -face : face;
  for (let i = 0; i < JN; i++) { P[i * 2] = x + P[i * 2] * k; P[i * 2 + 1] = y + P[i * 2 + 1]; }
  j.face = f; j.yaw = Math.abs(yaw);
  const m = Math.max(.25, Math.abs(yaw));
  if (m < 1) { j.S *= m; j.H *= m; }
  if (f < 0) { j.S = -j.S; j.H = -j.H; }
  return j;
}

// Puts joint chain (root, mid, end) so that end reaches (tx, ty). bend: +1/-1 picks the elbow side.
function ik2(P, ri, mi, ei, tx, ty, L1, L2, bend) {
  const rx = P[ri * 2], ry = P[ri * 2 + 1];
  let dx = tx - rx, dy = ty - ry, D = Math.hypot(dx, dy) || 1e-4;
  const max = (L1 + L2) * .998, min = Math.abs(L1 - L2) + .5;
  const c = clamp(D, min, max);
  dx *= c / D; dy *= c / D; D = c;
  const a = Math.acos(clamp((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1)), base = Math.atan2(dy, dx);
  const an = base + a * bend;
  P[mi * 2] = rx + Math.cos(an) * L1; P[mi * 2 + 1] = ry + Math.sin(an) * L1;
  P[ei * 2] = rx + dx; P[ei * 2 + 1] = ry + dy;
}

return { PF, POSE_N, pose, poseLerp, poseAdd, J, JN, BUILDS, dimsFor, Joints, solveFK, toWorld, ik2 };
})();
// ---- render/head.js
__m["render/head.js"] = (function () {
// Head painter. Faces, hair, masks and hats are drawn once per expression at 4x and then sampled by the rasterizer.
const { makeCanvas, ctxOf } = __m["core/util.js"];
const { rampHex, skinHex, mixHex, OUTLINE_HEX } = __m["render/palette.js"];
const TS = 4, HW = 152, HH = 152, HCX = 72, HCY = 84;
const headCache = new Map();
const EXPRS = ['neutral', 'fierce', 'shout', 'hurt', 'dizzy', 'ko', 'happy', 'talk', 'blink', 'smug', 'sad'];

function painter(g) {
  const path = (pts, curve) => {
    g.beginPath();
    if (!curve) { pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); }
    else {
      const n = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      let m = mid(pts[n - 1], pts[0]);
      g.moveTo(m[0], m[1]);
      for (let i = 0; i < n; i++) { const e = mid(pts[i], pts[(i + 1) % n]); g.quadraticCurveTo(pts[i][0], pts[i][1], e[0], e[1]); }
    }
    g.closePath();
  };
  return {
    g,
    poly(c, pts, curve = false) { g.fillStyle = c; path(pts, curve); g.fill(); },
    blob(c, pts) { g.fillStyle = c; path(pts, true); g.fill(); },
    ell(c, x, y, rx, ry = rx, rot = 0) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill(); },
    rect(c, x, y, w, h) { g.fillStyle = c; g.fillRect(x, y, w, h); },
    line(c, w, pts) { g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'butt'; g.lineJoin = 'round'; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); },
    clip(pts, curve, fn) { g.save(); path(pts, curve); g.clip(); fn(); g.restore(); },
  };
}

const FACE = {
  square: [[-8.4, -10], [0, -12.4], [6.4, -11], [9.4, -6.4], [9.6, -2.8], [9.8, 4], [9.6, 8.8], [7, 11.8], [0.6, 11.4], [-4.6, 7.2], [-6.4, 1.6], [-10.4, -0.6], [-10.8, -6]],
  round: [[-8.6, -10], [0, -12.4], [6.4, -11], [9.6, -6], [10, -1], [10, 4.6], [8.6, 8.8], [5, 11.4], [0, 10.6], [-4.8, 7], [-6.8, 1.4], [-10.6, -0.6], [-11, -6]],
  long: [[-8.2, -10.4], [0, -12.8], [6, -11.4], [9, -6.8], [9.2, -2.8], [9.4, 4], [9, 10], [6.4, 13.2], [1.4, 12.2], [-3.8, 7.6], [-6, 1.6], [-10, -0.6], [-10.6, -6]],
  slim: [[-8.2, -10], [0, -12.4], [6, -11], [8.9, -6.4], [9, -2.4], [9.2, 3.4], [8, 8.4], [5.8, 11.2], [1.6, 9.8], [-3.8, 6], [-5.8, 1.4], [-9.8, -0.6], [-10.4, -6]],
  jaw: [[-8.6, -9.6], [0, -12], [6.4, -10.6], [9.4, -6.2], [9.8, -2.4], [10.4, 4], [11, 9.4], [8.4, 12.6], [0.2, 12.4], [-5.4, 8], [-6.8, 1.8], [-10.6, -0.4], [-11, -5.8]],
  fat: [[-8.8, -9.8], [0, -12.2], [6.6, -10.8], [9.8, -6], [10.2, -1.4], [11, 4.6], [10.4, 10.4], [6.6, 13.4], [-0.6, 13], [-6.8, 8.8], [-8, 2], [-11, -0.4], [-11.4, -6]],
};

function paintEyes(p, h, ex, S) {
  const line = S[0], fem = h.lashes;
  const W = '#fbf7ee', eye = h.eye || '#3a2436';
  const nx = 3.4, fx = 8.2, y = -1.2;
  const closed = (x, w, up) => p.line(line, 1.1, up ? [[x - w, y + .9], [x, y - .9], [x + w, y + .9]] : [[x - w, y + .2], [x, y + .9], [x + w, y + .2]]);
  if (ex === 'ko') { for (const [x, w] of [[nx, 1.9], [fx, 1.5]]) { p.line(line, 1.1, [[x - w, y - 1.6], [x + w, y + 1.8]]); p.line(line, 1.1, [[x + w, y - 1.6], [x - w, y + 1.8]]); } return; }
  if (ex === 'hurt') { p.line(line, 1.15, [[nx - 2, y - 1.4], [nx + 1.6, y + .2], [nx - 2, y + 1.6]]); p.line(line, 1.15, [[fx + 1.6, y - 1.4], [fx - 1, y + .2], [fx + 1.6, y + 1.6]]); return; }
  if (ex === 'blink') { closed(nx, 2.1, false); closed(fx, 1.5, false); return; }
  if (ex === 'happy') { closed(nx, 2.1, true); closed(fx, 1.5, true); return; }
  if (ex === 'dizzy') { for (const [x, r] of [[nx, 2.7], [fx, 2.2]]) { p.ell(line, x, y, r + .6, r + .7); p.ell(W, x, y, r, r + .1); p.ell(line, x + .5, y + .5, .8, .8); p.line(line, .5, [[x - 1, y + .4], [x - .4, y - 1], [x + 1, y - .9]]); } return; }
  const squint = ex === 'fierce' || ex === 'smug' || ex === 'shout' ? .55 : 0;
  const one = (x, rx, ry, px) => {
    p.ell(line, x, y - .1, rx + .55, ry + .55);
    p.ell(W, x, y + .1, rx, ry);
    p.ell(eye, x + px, y + .15, Math.min(1.25, rx * .62), ry * .92);
    p.rect('#ffffff', x + px + .1, y - .9, .7, .7);
    if (squint) p.rect(S[2], x - rx - .8, y - ry - 1, rx * 2 + 1.6, ry * squint + 1);
    if (squint) p.rect(line, x - rx - .4, y - ry + ry * squint - .5, rx * 2 + .8, .8);
    if (fem) { p.line(line, 1, [[x - rx - 1, y - ry - .2], [x - rx * .2, y - ry - .5], [x + rx + .2, y - ry + .2]]); p.line(line, .8, [[x - rx - 1.6, y - ry - .9], [x - rx, y - ry + .3]]); }
  };
  one(nx, fem ? 2.1 : 1.9, fem ? 2.1 : 1.7, .55); one(fx, 1.5, fem ? 2 : 1.6, .45);
}
function paintBrows(p, h, ex, S) {
  if (h.noBrow) return;
  const c = h.browCol || mixHex(h.hairCol || '#2a1a2a', '#140a22', .35), w = h.browW || (h.lashes ? 1 : 1.5);
  const k = ex === 'fierce' || ex === 'shout' ? 1.5 : ex === 'hurt' || ex === 'sad' || ex === 'dizzy' ? -1.4 : ex === 'smug' ? .5 : ex === 'happy' ? -.5 : (h.browTilt || .35);
  p.line(c, w, [[.9, -4.5 - k * .55], [5.6, -3.9 + k * .6]]);
  p.line(c, w, [[7, -3.9 + k * .55], [10, -4.6 - k * .45]]);
}
function paintMouth(p, h, ex, S) {
  const line = S[0], y = 6.5 + (h.face === 'long' ? .8 : h.face === 'slim' ? -.3 : 0);
  const lip = h.lips;
  switch (ex) {
    case 'fierce': p.rect(line, 3.4, y - 1.5, 5.8, 3); p.rect('#f6f2e6', 4, y - .9, 4.6, 1.8); p.line(line, .5, [[4, y], [8.6, y]]); p.line(line, .5, [[6.2, y - .9], [6.2, y + .9]]); break;
    case 'shout': p.ell(line, 6.4, y + .2, 3.1, 2.8); p.ell('#7c1a3a', 6.4, y + .5, 2.3, 2); p.rect('#f6f2e6', 4.8, y - 1.9, 3.4, 1); p.ell('#ff7a8c', 6.6, y + 1.7, 1.4, .8); break;
    case 'hurt': p.poly(line, [[3.2, y + 1.4], [4.4, y - 1.4], [8.6, y - 1.2], [9.2, y + 1.6]]); p.rect('#f6f2e6', 4.5, y - .7, 4, 1); p.rect('#7c1a3a', 4.4, y + .3, 4.2, .8); break;
    case 'dizzy': p.line(line, 1, [[3.4, y], [4.8, y + 1], [6.2, y - .4], [7.6, y + 1], [9, y]]); break;
    case 'ko': p.ell(line, 6.2, y + .3, 2.6, 1.9); p.ell('#7c1a3a', 6.2, y + .4, 1.8, 1.2); p.ell('#ff7a8c', 6.8, y + 1.7, 1.2, 1.7); break;
    case 'happy': p.poly(line, [[3, y - 1], [9.4, y - 1.2], [8.6, y + 1.6], [6.2, y + 2.4], [4, y + 1.4]]); p.poly('#f6f2e6', [[3.8, y - .4], [8.8, y - .6], [8.3, y + .7], [4.3, y + .8]]); break;
    case 'talk': p.ell(line, 6.6, y, 2, 1.7); p.ell('#8c2346', 6.6, y + .3, 1.3, 1); break;
    case 'smug': p.line(line, 1.1, [[4, y + .4], [7, y + .3], [9.2, y - 1.1]]); break;
    case 'sad': p.line(line, 1.1, [[4, y + .9], [6.4, y - .1], [8.8, y + .9]]); break;
    default: if (lip) { p.ell(lip, 6.8, y + .1, 2.3, 1.1); p.line(line, .7, [[4.6, y], [9, y - .1]]); } else { p.line(line, 1.1, [[4.2, y + .2], [8.8, y - .1]]); p.line(S[1], .7, [[5.2, y + 1.6], [7.6, y + 1.5]]); }
  }
}

const HAIR = {
  bald(p, h, H, S) { p.ell(S[4], 1.6, -9, 2.6, 1.3, -.3); },
  buzz(p, h, H, S) { p.blob(mixHex(H[1], S[1], .35), [[-10.6, -1], [-11.2, -7], [-7, -11.8], [0, -13], [6.6, -11.4], [9.4, -7], [7, -7.2], [1, -8], [-3, -5], [-5.4, -1], [-7, 1.4]]); p.blob(mixHex(H[2], S[2], .3), [[-7, -10.6], [0, -12.4], [6, -10.8], [3, -9.2], [-5, -8.4]]); },
  short(p, h, H) {
    p.blob(H[1], [[-11, 0], [-12, -7], [-8, -13], [0, -14.8], [7, -13], [10.4, -8], [9, -5.4], [5, -8], [0, -8.4], [-3.6, -5], [-5, -1], [-7, 2]]);
    p.blob(H[2], [[-10.6, -5], [-8.4, -12], [0, -14], [6.8, -12.4], [9.6, -8.2], [4.6, -9.4], [-3, -8.8], [-7, -4.4]]); p.blob(H[3], [[-6.6, -11], [-1, -13.4], [4.6, -12.2], [1, -11], [-4, -9.6]]);
  },
  spiky(p, h, H) {
    const a = [[-11.6, 1], [-14.4, -4], [-11.4, -5], [-14.6, -10.6], [-9.8, -10], [-10.6, -16.2], [-5, -12.8], [-3.2, -18.6], [0.8, -13.4], [5, -17.8], [6, -12], [10.8, -13.2], [9, -8], [11, -6.6], [7.6, -7], [5, -8.6], [2.4, -6], [0, -8.8], [-3, -5.4], [-5, -1], [-7.4, 2]];
    p.poly(H[1], a); p.poly(H[2], a.map(q => [q[0] * .9 + .6, q[1] * .92 - .8])); p.poly(H[3], [[-7.6, -10.6], [-5, -12.4], [-3.2, -16], [-1, -12.6], [1, -12.4], [4.4, -15], [4.8, -11.6], [0, -10.4]]);
  },
  mohawk(p, h, H, S) {
    p.blob(mixHex(S[1], H[1], .35), [[-10.6, -1], [-11, -7], [-7, -11.6], [0, -12.8], [6.4, -11.4], [9, -7.4], [2, -8.4], [-4, -4], [-6.6, .6]]);
    p.poly(H[1], [[-11.6, -2], [-15, -6], [-13.6, -11], [-14.4, -15], [-9.8, -15.4], [-8.6, -19.6], [-4, -17.4], [-.6, -21], [2.8, -17], [7.4, -18.4], [8, -13.4], [10.4, -11.4], [7.4, -9.4], [0, -11], [-6, -9], [-9.4, -4]]);
    p.poly(H[2], [[-11.6, -6], [-12.4, -13.6], [-8.4, -13.8], [-7.4, -17.6], [-3.6, -15.8], [-.6, -19], [2.2, -15.6], [6.4, -16.6], [6.8, -12.6], [0, -12.6], [-7, -10.4]]);
    p.poly(H[3], [[-8, -12.6], [-6.4, -15.6], [-3.4, -14], [-.6, -17], [1.8, -13.8], [-3, -12.6]]);
  },
  slick(p, h, H) {
    p.blob(H[1], [[-11, 4], [-13.6, -2], [-12.6, -9], [-7.6, -13.8], [0, -14.6], [7, -12.6], [9.8, -7.6], [6, -8.6], [0, -8], [-4, -4.6], [-5.4, 0], [-7.6, 4.4]]);
    p.blob(H[2], [[-12, -3], [-10.6, -9.6], [-5, -13.2], [1, -13.8], [7, -11.6], [9, -8.4], [2, -9.6], [-5, -6.4], [-8.6, 0]]); p.line(H[3], 1, [[7.2, -10.4], [0, -12], [-7, -9.2], [-10, -4]]); p.line(H[1], .8, [[6, -9.2], [-1, -10], [-7, -6.6], [-9.4, -1]]);
  },
  side(p, h, H) {
    HAIR.short(p, h, H);
    p.blob(H[1], [[-2, -13], [7, -13.4], [11.4, -8], [11.6, -2], [10, 1.6], [8.6, -3], [5, -6.8], [0, -8]]); p.blob(H[2], [[-2, -12.6], [6.6, -12.6], [10.4, -8], [10.4, -3.4], [8, -6.4], [3, -8.8]]); p.line(H[3], .9, [[1, -12], [6.6, -10.6], [9.4, -6.4]]);
  },
  afro(p, h, H) { for (const [x, y, r] of [[-8, -7, 7], [-2, -12, 8.4], [5.4, -11.6, 6], [-10, 0, 5], [0, -10, 9]]) p.ell(H[1], x, y, r); for (const [x, y, r] of [[-7, -9, 5], [-1, -13.4, 6], [5, -12.6, 4.2]]) p.ell(H[2], x, y, r); for (const [x, y] of [[-6, -13], [0, -16.6], [4.6, -14], [-9.6, -7], [-3, -11.6], [2, -12]]) p.ell(H[3], x, y, 1.2); },
  curly(p, h, H) { for (const [x, y, r] of [[-9.4, -1, 3.6], [-10.8, -6, 3.8], [-8, -11, 4], [-3, -13.4, 4], [2.4, -13.8, 3.8], [7, -11.4, 3.6], [9, -8, 2.6], [-4, -8, 4]]) p.ell(H[1], x, y, r); for (const [x, y, r] of [[-10, -6.6, 2.4], [-7.6, -11.6, 2.6], [-2.6, -14, 2.6], [2.6, -14.2, 2.4], [6.8, -12, 2.2]]) p.ell(H[2], x, y, r); for (const [x, y] of [[-8, -12.4], [-3, -15], [2.4, -15], [6.6, -12.8]]) p.ell(H[3], x, y, .9); },
  topknot(p, h, H) { HAIR.slick(p, h, H); p.ell(H[1], -3, -16.6, 4.2, 3.8); p.ell(H[2], -2.6, -17.2, 2.9, 2.6); p.rect(h.bandCol || '#d23b5a', -5.4, -14.6, 5, 1.6); },
  bun(p, h, H) { HAIR.slick(p, h, H); p.ell(H[1], -12, -8.6, 4.8, 4.8); p.ell(H[2], -11.8, -9.4, 3.4, 3.4); p.line(H[3], .8, [[-14, -10.4], [-11.4, -12], [-9.4, -10.4]]); },
  bob(p, h, H) {
    p.blob(H[1], [[-12.6, 8], [-13.4, -4], [-9, -13], [0, -15], [7, -13], [10.4, -8], [9.6, -4.4], [4.6, -7.6], [0, -6.6], [-1.6, 0], [-2, 8.4], [-7, 11]]);
    p.blob(H[2], [[-11.4, 5], [-12, -4], [-8, -12], [0, -14], [6.6, -12.2], [9.4, -8], [3.6, -9], [-2, -7], [-4, 0], [-5, 8]]); p.line(H[3], 1.1, [[5.6, -11.6], [-1, -12.4], [-7.4, -9], [-9.6, -2]]);
  },
  wave(p, h, H) {
    p.blob(H[1], [[-12, 12], [-15, 4], [-13.4, -4], [-9, -13.2], [0, -15.4], [7.4, -13.4], [10.6, -8], [9.4, -5], [4.4, -8], [-1, -6.8], [-3, 0], [-3.4, 8], [-6, 13]]);
    p.blob(H[2], [[-11.6, 8], [-13, 2], [-11.4, -5], [-7.6, -12], [0, -14.4], [6.8, -12.6], [9.6, -8.2], [3, -9.4], [-4, -6], [-5.6, 1], [-6.4, 9]]); p.line(H[3], 1.1, [[5.8, -11.6], [-1, -12.8], [-7.4, -9], [-10, -2], [-9, 5]]);
  },
  mullet(p, h, H) { HAIR.short(p, h, H); p.blob(H[1], [[-7, -3], [-12, -4], [-14.4, 4], [-13, 11], [-9, 9.6], [-6.4, 6], [-5.4, 1]]); p.blob(H[2], [[-8, -2], [-11.6, -2], [-13, 4], [-11.4, 8.6], [-8, 5]]); },
  flat(p, h, H) { p.poly(H[1], [[-10.6, 0], [-11, -8], [-10, -16.4], [7.6, -17], [10, -9], [8.6, -6.6], [2, -8], [-3.6, -5], [-5.4, 0], [-7, 2]]); p.poly(H[2], [[-9.6, -8], [-9, -15], [6.8, -15.8], [8.8, -9.2], [0, -9.6]]); p.poly(H[3], [[-8, -14], [6, -14.8], [6.4, -13.2], [-7.6, -12.4]]); },
  horns(p, h, H) { HAIR.slick(p, h, H); for (const sx of [0, 1]) { p.poly(H[1], sx ? [[2, -12], [6, -20.6], [8.6, -11.6]] : [[-9, -11], [-7.6, -20], [-3, -13]]); p.poly(H[3], sx ? [[3.6, -12.6], [6, -18], [6.8, -12]] : [[-7.4, -12], [-7, -17.6], [-5, -13]]); } },
};

const BEARD = {
  stubble(p, h, H, S) { p.blob(mixHex(S[2], h.hairCol || '#2a1a2a', .28), [[-4.6, 4], [-1, 5.4], [3, 4.6], [9.6, 4.4], [9.8, 9], [6.6, 11.8], [.4, 11.2], [-4, 7.6]]); },
  goatee(p, h, H) { p.blob(H[1], [[4, 7.4], [9.6, 7.2], [9.6, 11], [7.4, 14], [5, 12.4]]); p.blob(H[2], [[5, 9], [9, 8.6], [8.6, 11], [7.2, 12.6]]); p.line(H[1], 1.3, [[4, 5], [6.6, 4.4], [9.6, 5]]); },
  mustache(p, h, H) { p.blob(H[1], [[2.4, 6.4], [6.4, 3.6], [11.4, 5.4], [10.4, 6.8], [6.8, 5.6], [3.4, 7.6]]); p.line(H[3], .7, [[4, 5.4], [6.6, 4.4], [9.8, 5]]); },
  handlebar(p, h, H) { p.blob(H[1], [[1.2, 8.6], [2.6, 4.8], [6.6, 3.4], [11, 4.6], [12.6, 8], [10.6, 6.6], [6.8, 5.8], [3.8, 6.8], [2.6, 10]]); p.line(H[3], .7, [[3.4, 5.6], [6.6, 4.3], [10, 5]]); },
  full(p, h, H) { p.blob(H[1], [[-6, 1], [-3.6, 3.6], [1, 4.4], [4, 4], [6.6, 3.4], [10.4, 4.4], [11, 9.6], [8.4, 14.4], [2, 14.6], [-4, 10.4]]); p.blob(H[2], [[-3.4, 5], [1, 6], [3.6, 8], [9, 8.6], [9.4, 10.6], [7, 13], [1.6, 12.6], [-2.6, 9]]); p.line(H[3], .9, [[0, 8.6], [4, 11], [8, 11]]); },
  long(p, h, H) { BEARD.full(p, h, H); p.poly(H[1], [[-2.6, 10], [10, 11], [8.6, 18], [5.4, 22], [2.4, 18.4]]); p.poly(H[2], [[0, 12], [8.4, 12.6], [7, 17], [5, 19.4], [3, 16]]); p.line(H[3], .8, [[3, 13], [5, 17]]); },
  chops(p, h, H) { p.blob(H[1], [[-6.4, -2], [-3, -1], [-1, 4], [3.4, 6.6], [3, 10], [-1.4, 10.6], [-5, 6.6]]); p.blob(H[2], [[-5, 0], [-3, 1], [-1.6, 5], [1.6, 7.6], [0, 9], [-3.6, 6]]); },
  sideburn(p, h, H) { p.blob(H[1], [[-6.2, -3], [-3, -3], [-2.8, 4], [-4.6, 5]]); },
};

// Masks cover the head and leave eye holes; every design is a harbour motif.
const MASK = {
  plain(p, o) { p.blob(o.c1R[2], o.outline); p.clip(o.outline, true, () => { p.blob(o.c1R[1], [[-12, -2], [-3, 0], [-1, 13], [-12, 13]]); p.blob(o.c1R[3], [[-4, -13], [7, -12], [8, -8], [-3, -9]]); }); },
  gull(p, o) {
    MASK.plain(p, o);
    p.clip(o.outline, true, () => { p.blob(o.c2R[2], [[-12, -3], [-4, -8], [4, -5], [10.6, -5.4], [10.6, 1.4], [6, 2.6], [0, 2], [-6, 1.4]]); p.poly(o.c2R[3], [[-8, -3.4], [-2, -6.4], [4, -4.2], [0, -3]]); });
    p.poly(o.c3R[2], [[7.4, .4], [14.4, 3.6], [8.6, 5]]); p.poly(o.c3R[1], [[8.2, 3.4], [14.4, 3.6], [8.6, 5]]);
    p.poly(o.c1R[3], [[-8.8, -8], [-17, -13.4], [-13, -8.6], [-17.6, -7], [-12, -4.6], [-15.4, -1.4], [-9, -2]]); p.poly(o.c1R[1], [[-9, -5], [-14, -6], [-10, -3.4]]);
  },
  wave(p, o) { MASK.plain(p, o); p.clip(o.outline, true, () => { p.blob(o.c2R[2], [[-12, -4], [-6, -9], [0, -6], [-2, -2], [4, -8], [11, -9], [11, -14], [-12, -14]]); p.line(o.c2R[4], 1.2, [[-11, -3], [-6, -7.6], [-1, -5], [-2.4, -1.4], [4, -6.8], [10, -8]]); p.blob(o.c2R[2], [[-8, 8], [0, 6], [4, 9], [10, 8], [10, 14], [-8, 14]]); }); },
  shark(p, o) {
    MASK.plain(p, o);
    p.poly(o.c1R[1], [[-6, -11], [-7.6, -20], [2, -12]]); p.poly(o.c1R[3], [[-5, -12], [-6.4, -17], [0, -12.4]]);
    p.clip(o.outline, true, () => { p.blob(o.c2R[3], [[-6, 14], [-2, 4], [4, 2.4], [11, 3], [11, 14]]); });
    for (let i = 0; i < 5; i++) p.poly('#fff8e6', [[1.6 + i * 1.9, 3.2], [3.4 + i * 1.9, 3.2], [2.5 + i * 1.9, 5.4]]);
    for (let i = 0; i < 3; i++) p.line(o.c1R[0], .8, [[-5.4 + i * 1.6, 1], [-4.4 + i * 1.6, 4]]);
  },
  octo(p, o) { MASK.plain(p, o); p.blob(o.c1R[2], [[-10, -8], [-9, -17], [0, -20], [8, -16], [9, -8]]); p.blob(o.c1R[3], [[-6, -14], [0, -18], [5, -15], [0, -13]]); for (const [x, y] of [[-6, -10], [-1, -15], [4, -11]]) p.ell(o.c2R[3], x, y, 1.3); for (const x of [-7, -3, 1]) { p.blob(o.c1R[1], [[x, 6], [x + 3, 6], [x + 2.4, 14], [x + .4, 14]]); } },
  fog(p, o) { MASK.plain(p, o); p.clip(o.outline, true, () => { p.line(o.c2R[2], 1.1, [[6.8, -13], [6, 13]]); p.poly(o.c2R[1], [[-.4, -2.8], [6, -1], [5.6, .6], [0, -.6]]); p.poly(o.c2R[1], [[7.4, -1], [11, -2.6], [10.8, -.6], [7.6, .6]]); p.line(o.c1R[1], .9, [[4.4, 6], [9, 6]]); }); },
  oni(p, o) { MASK.plain(p, o); for (const pts of [[[0, -11], [-1, -19], [5, -12]], [[6, -11], [9.4, -18], [9.6, -9.4]]]) { p.poly(o.c3R[1], pts); p.poly(o.c3R[3], pts.map(q => [q[0] * .8 + 1, q[1] * .9 - 1])); } p.clip(o.outline, true, () => { p.poly(o.c2R[2], [[-1, -5.4], [5.4, -2.6], [5, -4.6], [0, -7]]); p.poly(o.c2R[2], [[7.4, -2.8], [11, -5.6], [10.6, -3.8]]); p.poly('#fff3d8', [[3.6, 7.6], [5, 7.6], [4.2, 4.4]]); p.poly('#fff3d8', [[8, 7.4], [9.4, 7.4], [8.9, 4.4]]); }); },
  anchor(p, o) { MASK.plain(p, o); p.clip(o.outline, true, () => { p.line(o.c2R[2], 1.5, [[6.6, -11], [6.4, 10]]); p.line(o.c2R[2], 1.4, [[2, -8], [10.4, -8]]); p.line(o.c2R[2], 1.6, [[-1, 5], [2, 9], [6.4, 10.4], [10, 8.6]]); }); },
  visor(p, o) { p.blob(o.c1R[1], [[-10, -9], [0, -14.4], [8, -13], [11.4, -7], [12, 5], [10, 12], [2, 13], [-4, 9], [-9, 2]]); p.blob(o.c1R[2], [[-7, -9], [0, -13], [7.6, -11.6], [10.4, -6], [10.8, 4], [8, 10], [2, 10]]); p.poly('#1a1030', [[.4, -4.4], [11.4, -5.2], [11.6, .8], [.6, 1.4]]); p.poly(o.c2R[3], [[1.4, -3.4], [10.4, -4.2], [10.6, -.4], [1.6, .4]]); p.poly('#ffffff', [[2.4, -2.8], [5, -3.2], [4, -.6], [2.6, -.4]]); for (const [x, y] of [[-6, -6], [-6, 4], [3, 10]]) p.ell(o.c1R[4], x, y, .9); p.line(o.c1R[3], .9, [[1, 4], [10, 3.4]]); p.line(o.c1R[3], .9, [[1.4, 6.4], [9.6, 5.8]]); },
};

const HAT = {
  captain(p, h) { p.blob('#f3f0e4', [[-12, -9], [-11, -16], [0, -20], [9, -17], [11.4, -10], [0, -11]]); p.blob('#cfc9d6', [[-12, -9], [-11, -13], [-6, -11.4], [0, -11]]); p.poly('#1d2547', [[-11.4, -11.6], [11.4, -12.4], [11.6, -8.6], [-11.4, -7.8]]); p.poly('#0e1330', [[4, -9], [14.6, -8], [14.8, -6.4], [6, -6.8]]); p.ell('#ffd65a', 5, -13, 2.2); p.ell('#c98a1a', 5, -13, 1); },
  beanie(p, h) { const R = rampHex(h.hatCol || '#c2453f'); p.blob(R[1], [[-11.6, -4], [-12, -12], [-6, -17], [2, -17.6], [9, -14], [10.6, -6.6], [0, -8]]); p.blob(R[2], [[-9, -9], [-5, -15.4], [2, -16.2], [8, -13], [8.6, -9]]); p.poly(R[3], [[-11.8, -3.6], [-11.4, -7.4], [10.6, -9.4], [10.8, -5.8]]); for (let i = -9; i < 10; i += 2.6) p.line(R[1], .7, [[i, -4], [i, -8.6]]); },
  cap(p, h) { const R = rampHex(h.hatCol || '#2d63b8'); p.blob(R[1], [[-11, -5], [-11.4, -11], [-5, -16], [3, -16], [9, -12], [10.4, -7], [0, -7.6]]); p.blob(R[2], [[-8, -10], [-4, -14.6], [3, -14.6], [8, -11], [8.4, -8.6]]); p.poly(R[3], [[5, -9.4], [16, -7], [16, -5.4], [6, -6.4]]); p.ell(R[4], 6.4, -11.4, 1.6); },
  hard(p, h) { const R = rampHex(h.hatCol || '#ffb52e'); p.blob(R[1], [[-12.4, -5], [-12, -12], [-6, -18], [2, -18.6], [9, -15], [11.6, -7]]); p.blob(R[2], [[-9, -11], [-5, -16.6], [2, -17.2], [8, -14], [9.4, -9]]); p.poly(R[3], [[-3, -18.4], [1.4, -18.8], [2.4, -9], [-2.6, -9]]); p.poly(R[1], [[-13, -7], [13.4, -9], [14, -6], [-13, -4.4]]); p.poly(R[3], [[-12, -6.6], [13, -8.4], [13, -7.6], [-12, -5.8]]); },
  band(p, h) { const R = rampHex(h.hatCol || '#d23b5a'); p.poly(R[2], [[-11, -4.6], [-10.6, -8.8], [0, -9.8], [9.8, -8.6], [9.8, -5], [0, -6.4]]); p.line(R[3], .9, [[-10.4, -8], [0, -9.2], [9.4, -8]]); p.line(R[1], .9, [[-10.6, -5.2], [0, -6.8], [9.4, -5.6]]); },
  bandana(p, h) { const R = rampHex(h.hatCol || '#d23b5a'); p.blob(R[1], [[-11.6, -2], [-11.8, -10], [-6, -14.6], [2, -15], [8.6, -12], [10.4, -6.6], [0, -8]]); p.blob(R[2], [[-8.6, -9], [-5, -13.4], [2, -13.8], [8, -11], [9, -8], [0, -9.4]]); p.poly(R[2], [[-11, -4], [-17, -1], [-14, 3], [-10.4, -1]]); for (const [x, y] of [[-5, -11], [1, -12], [5, -10]]) p.ell(R[4], x, y, .9); },
  headset(p) { p.line('#1a2148', 1.8, [[-5, -12.4], [-6.6, -6], [-5, -1]]); p.line('#1a2148', 1.6, [[-5.4, -12], [0, -14.4], [4, -13.6]]); p.ell('#1a2148', -4.8, .4, 3, 3.6); p.ell('#49d6ff', -4.8, .4, 1.4, 1.8); p.line('#1a2148', 1, [[-4, 3], [1, 8], [5.6, 8.4]]); p.ell('#1a2148', 6, 8.2, 1.2); },
  nurse(p) { p.poly('#f5f7ff', [[-6, -12], [-5, -18], [5, -18.6], [6.4, -12.6]]); p.rect('#ff4f6d', -.9, -17.4, 1.6, 4.4); p.rect('#ff4f6d', -2.3, -16, 4.4, 1.6); },
  crown(p) { p.poly('#e0a32e', [[-8, -10], [-9.6, -18], [-5, -14], [-1, -20], [2.6, -14.4], [7.6, -18.6], [7.6, -10.6]]); p.poly('#ffe07a', [[-6.6, -11.4], [-7.4, -15.4], [-4.4, -12.8], [-1, -17.4], [2, -13], [5.8, -15.8], [6, -11.6]]); p.ell('#ff4f6d', -1, -12.4, 1.3); },
};
const GLASS = {
  shades(p) { p.poly('#140a22', [[-.4, -3.4], [6.2, -3.4], [5.4, 1.2], [1, 1.2]]); p.poly('#140a22', [[6.8, -3.4], [11.2, -3.2], [10.6, 1], [7.4, 1]]); p.line('#140a22', 1.1, [[-5, -2], [1, -2.8]]); p.poly('#4b5a9c', [[1, -2.6], [3.6, -2.6], [2.4, -.4], [1.4, -.4]]); p.poly('#4b5a9c', [[7.6, -2.6], [9, -2.6], [8.4, -.6]]); },
  round(p) { p.line('#f0c24a', .9, [[-5, -2], [0, -1.8]]); for (const [x, r] of [[3.4, 3], [8.6, 2.5]]) { p.g.strokeStyle = '#f0c24a'; p.g.lineWidth = .9; p.g.beginPath(); p.g.ellipse(x, -1, r, r, 0, 0, 7); p.g.stroke(); } },
  square(p) { p.line('#1d1433', 1, [[-5, -2], [.4, -2]]); for (const [x, w] of [[.6, 5.6], [6.9, 4]]) { p.g.strokeStyle = '#1d1433'; p.g.lineWidth = 1; p.g.strokeRect(x, -3.4, w, 4.6); } },
  eyepatch(p) { p.poly('#140a22', [[.4, -3.8], [6, -3.6], [5.4, 1.6], [2, 2]]); p.line('#140a22', 1, [[-9, -6], [2, -3.4]]); p.line('#140a22', 1, [[5.6, -3.4], [9, -6]]); },
};

function headTexture(look, expr = 'neutral') {
  const h = look.head;
  const key = JSON.stringify(h) + look.skin + '|' + expr;
  let t = headCache.get(key);
  if (t) return t;
  const c = makeCanvas(HW, HH), g = ctxOf(c, { willReadFrequently: true }), p = painter(g);
  g.setTransform(TS, 0, 0, TS, HCX, HCY);
  const S = skinHex(look.skin), H = rampHex(h.hairCol || '#3a2636'), outline = FACE[h.face] || FACE.square;
  const hairFn = HAIR[h.hair];
  // Back volume first so the skull covers it.
  if (h.backHair) { const b = h.backHair; p.blob(H[1], [[-6, -10], [-13, -8], [-14.6, 0], [-13.4, b], [-6, b + 1.5], [-2, 6], [0, -4]]); p.blob(H[2], [[-7, -9], [-12, -6], [-13, 0], [-11.6, b - 2], [-7, b - 1], [-4, 4]]); }
  if (h.mask && h.mask.full) {
    const m = h.mask, o = { outline, c1R: rampHex(m.c1), c2R: rampHex(m.c2 || '#ffffff'), c3R: rampHex(m.c3 || '#ffb52e') };
    if (h.maskHair && hairFn) hairFn(p, h, H, S);
    (MASK[m.kind] || MASK.plain)(p, o);
    if (m.kind !== 'visor' && m.kind !== 'fog') {
      const rim = o.c3R[2];
      p.ell(rim, 3.5, -1.1, 3.6, 3); p.ell(rim, 8.5, -1.1, 2.7, 2.8);
      p.ell(S[2], 3.5, -1.1, 2.7, 2.2); p.ell(S[2], 8.5, -1.1, 1.9, 2.1);
      paintEyes(p, h, expr, S);
      if (!m.noMouth) { p.blob(rim, [[2, 4.6], [6, 3.8], [10, 4.6], [10, 9], [6.4, 10.4], [2.4, 8.8]]); p.blob(S[2], [[3, 5.2], [6, 4.6], [9.4, 5.2], [9.4, 8.4], [6.4, 9.4], [3.2, 8.2]]); paintMouth(p, h, expr, S); }
    }
    if (m.kind === 'fog') { const col = expr === 'fierce' || expr === 'shout' ? '#ff5fa2' : expr === 'ko' ? '#5a5f7a' : '#49d6ff'; p.poly(col, [[.8, -1.9], [5.2, -.6], [4.8, .2], [1.2, -.8]]); p.poly(col, [[8, -.6], [10.4, -1.7], [10.2, -.8], [8.2, .2]]); }
  } else {
    p.blob(S[2], outline);
    p.clip(outline, true, () => {
      p.blob(S[1], [[-12, -4], [-5, -3], [-3.6, 4], [1, 8.4], [7, 9.6], [8.4, 14], [-12, 15]]);
      p.blob(S[3], [[-1, -10], [6, -10.6], [9.4, -6], [9.4, -4.4], [4, -5.4], [-1, -5.8]]);
      p.blob(S[3], [[5, 1.4], [9.6, .6], [9.8, 4.4], [6.6, 4.8]]);
      p.ell(S[4], 4.6, -8, 2.2, 1);
      if (h.blush) { p.ell(mixHex(S[2], '#ff5f7a', .45), 2.4, 3.2, 1.9, 1.1); p.ell(mixHex(S[2], '#ff5f7a', .45), 9, 3, 1, 1); }
    });
    // ear
    if (!h.noEar) { p.ell(S[0], -5.2, .4, 3, 3.9); p.ell(S[2], -5, .3, 2.2, 3.1); p.ell(S[1], -4.7, .8, 1.1, 1.8); }
    if (h.earring) p.ell(h.earring, -5, 4.2, 1.1);
    if (h.beard && BEARD[h.beard]) BEARD[h.beard](p, h, H, S);
    if (h.paint) h.paint === 'stripe' ? p.poly(h.paintCol, [[-1, -3.6], [10.4, -3.6], [10.2, .8], [-1, .8]]) : h.paint === 'lines' ? (p.line(h.paintCol, 1.1, [[1.6, 2.4], [1.2, 6]]), p.line(h.paintCol, 1.1, [[3.6, 2.8], [3.4, 6.4]]), p.line(h.paintCol, 1.1, [[9.6, 2.6], [9.6, 5.4]])) : h.paint === 'star' ? p.poly(h.paintCol, [[3.4, -6], [4.6, -2.6], [8, -1.4], [4.6, 0], [3.4, 4], [2.2, 0], [-1.4, -1.4], [2.2, -2.6]]) : h.paint === 'wave' ? p.line(h.paintCol, 1.6, [[-3, 4], [0, 2], [2, 4], [4.4, 2.2], [6.4, 4], [9.6, 2.2]]) : 0;
    paintEyes(p, h, expr, S);
    // nose
    p.blob(S[3], [[6.6, -.6], [8.4, -.4], [11.6, 2.6], [10.6, 4], [7.4, 3.8]]);
    p.line(S[0], .9, [[9.2, -.4], [11.9, 2.9], [10.6, 4.3], [7.6, 4.2]]); p.ell(S[4], 10, 2, .8);
    if (h.noseRed) p.ell(mixHex(S[2], '#ff4f4f', .5), 10.4, 2.8, 1.6, 1.5);
    paintMouth(p, h, expr, S);
    if (h.scar) p.line('#f6b7a0', .9, [[1, -6.6], [5.6, 3.4]]);
    if (h.wrinkle) { p.line(S[1], .7, [[1, 2.4], [4.4, 3]]); p.line(S[1], .7, [[2, -7], [7, -7.2]]); p.line(S[1], .7, [[3, 4.4], [3.4, 6.4]]); }
    if (hairFn) hairFn(p, h, H, S);
    if (!h.mask) paintBrows(p, h, expr, S);
    if (h.mask) { // half mask over the eyes
      const R = rampHex(h.mask.c1);
      p.blob(R[2], [[-10, -5.6], [0, -6.4], [10.6, -5.8], [11, -.6], [9, 2.2], [7, 1], [5, 2.6], [0, 2], [-9, -1]]); p.line(R[3], .9, [[-8, -4.6], [0, -5.4], [10, -4.8]]);
      p.ell(S[2], 3.5, -1.2, 2.5, 2); p.ell(S[2], 8.5, -1.2, 1.8, 1.9); paintEyes(p, h, expr, S);
    }
    if (h.tear && (expr === 'hurt' || expr === 'sad')) p.ell('#7fd8ff', 1.6, 2, 1, 1.4);
  }
  if (h.glass && GLASS[h.glass]) GLASS[h.glass](p, h);
  if (h.hat && HAT[h.hat]) HAT[h.hat](p, h);
  if (expr === 'hurt' || expr === 'dizzy') { p.ell('#8fe0ff', -2, -7, .9, 1.3); }
  const d = g.getImageData(0, 0, HW, HH), tex = new Uint32Array(d.data.buffer.slice(0));
  // Hard alpha, and a dark rim so hair and hats keep a contour against the body.
  for (let i = 0; i < tex.length; i++) if ((tex[i] >>> 24) < 120) tex[i] = 0; else tex[i] = (tex[i] | 0xff000000) >>> 0;
  t = { tex, w: HW, h: HH, ts: TS, cx: HCX, cy: HCY, canvas: c };
  headCache.set(key, t);
  if (headCache.size > 420) headCache.delete(headCache.keys().next().value);
  return t;
}
const HAIR_STYLES = Object.keys(HAIR), BEARD_STYLES = Object.keys(BEARD), MASK_STYLES = Object.keys(MASK), HAT_STYLES = Object.keys(HAT), FACE_STYLES = Object.keys(FACE);

// Flat portrait for HUD and dialogue, drawn with the same head texture at an integer scale.
function drawPortrait(g, look, expr, x, y, size, opt = {}) {
  const t = headTexture(look, expr), key = look;
  void key;
  const px = opt.px || 1; // screen pixels per head pixel
  const w = Math.round(HW / TS), h = Math.round(HH / TS);
  const tmp = portraitCanvas(t, w, h);
  g.save();
  g.beginPath(); g.rect(x, y, size, size); g.clip();
  const ox = x + size / 2 + (opt.dx || 0), oy = y + size * .56 + (opt.dy || 0);
  if (opt.flip) { g.translate(ox, oy); g.scale(-1, 1); g.drawImage(tmp, -(HCX / TS) * px, -(HCY / TS) * px, w * px, h * px); }
  else g.drawImage(tmp, ox - (HCX / TS) * px, oy - (HCY / TS) * px, w * px, h * px);
  g.restore();
}
function portraitCanvas(t, w, h) {
  if (t.small) return t.small;
  const c = makeCanvas(w, h), g = ctxOf(c), im = g.createImageData(w, h), d = new Uint32Array(im.data.buffer);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = t.tex[Math.min(t.h - 1, y * TS + 2) * t.w + Math.min(t.w - 1, x * TS + 2)]; d[y * w + x] = v; }
  // contour
  const out = d.slice(), ol = 0xff220a14 >>> 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (!d[i] && (d[i - 1] || d[i + 1] || d[i - w] || d[i + w])) out[i] = ol; }
  d.set(out);
  g.putImageData(im, 0, 0);
  t.small = c;
  return c;
}
void OUTLINE_HEX;

return { EXPRS, headTexture, HAIR_STYLES, drawPortrait };
})();
// ---- render/body.js
__m["render/body.js"] = (function () {
// Turns joints + a look into pixels. A look is plain data (see data/characters.js), so new wrestlers need no code.
const { DEG } = __m["core/util.js"];
const { J } = __m["anim/skeleton.js"];
const { ramp, skinRamp, packHex } = __m["render/palette.js"];
const { headTexture } = __m["render/head.js"];
const U0 = .24; // the body is drawn three-quarter: its centre line sits toward the facing side
const EMBLEMS = {
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
function drawBody(bc, jt, dims, look, o = {}) {
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
  const tail = (T, g) => {
    for (let i = 0; i < T.pts.length - 2; i += 2) { const k = i / (T.pts.length - 2); bc.capsule(T.pts[i], T.pts[i + 1], T.w * (1 - k * .55), T.pts[i + 2], T.pts[i + 3], T.w * (1 - (k + .1) * .55), [{ t: 1, ramp: ramp(T.c) }], g, 0, 0, k * .1); }
  };
  if (layer !== 'front') {
    if (o.tails) for (const T of o.tails) if (!T.front) tail(T, 40);
    if (look.cape && o.cape !== false) {
      const a = 3 + (o.sway || 0), c = look.cape, x = X(J.neck), y = Y(J.neck), w = dims.prof[4][1] * .9, hem = (c.len || 1) * (dims.spine + dims.th);
      bc.poly([[x - fxv * 2 - 1, y + 2], [x - fxv * (w + 2), y + 6], [x - fxv * (w + 7 + a) , y + hem], [x - fxv * (w * .1 - 3 + a * .5), y + hem + 2]], ramp(c.c1), 41, { folds: 2, phase: (o.sway || 0) * .4 });
    }
    arm(7, true, 1); leg(14, true, 4);
    const bx = X(0) - upx * dims.thR[0] * .55, by = Y(0) - upy * dims.thR[0] * .55, tx = X(1) + upx * (dims.nk * .7 + 2), ty = Y(1) + upy * (dims.nk * .7 + 2);
    if (look.skirtBack || look.coat) skirt(bc, P, dims, look.coat || look.skirtBack, fxv, fyv, upx, upy, 9, true, o);
    bc.torso(bx, by, tx, ty, fxv, fyv, dims.prof, torsoShader(look, dims), 10, 0);
    leg(10, false, 11);
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
  }
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
const FLASH_WHITE = packHex('#ffffff');

return { EMBLEMS, drawBody, FLASH_WHITE };
})();
// ---- anim/clips.js
__m["anim/clips.js"] = (function () {
// Solo animation data: stances, gaits and state clips. Times are seconds unless a clip says norm.
const { EASE, clamp01 } = __m["core/util.js"];
const { pose, poseLerp, POSE_N } = __m["anim/skeleton.js"];
// ---- stances -------------------------------------------------------------------------------
const STANCES = {
  std: { a: 'sp8 hd-4 a18/98 b58/84 t18/18 u-20/14', b: 'sp9 hd-4 a20/94 b60/80 t20/22 u-19/18', dur: .95, walk: 1, open: 0 },
  power: { a: 'sp12 hd-8 a34/58 b58/58 t24/24 u-26/18', b: 'sp14 hd-9 a30/62 b54/62 t26/28 u-25/22', dur: 1.25, walk: 1.05, open: 0 },
  air: { a: 'sp5 hd-3 a34/80 b70/66 t12/16 u-16/18 lift1', b: 'sp7 hd-3 a38/74 b66/72 t18/28 u-12/26', dur: .56, walk: .95, open: 1 },
  tech: { a: 'sp18 hd-12 a52/52 b76/44 t30/40 u-20/26', b: 'sp19 hd-12 a48/58 b72/50 t32/44 u-19/30', dur: 1.1, walk: .95, open: 1 },
  box: { a: 'sp10 hd-2 a44/122 b62/108 t20/22 u-22/16', b: 'sp12 hd-2 a48/116 b66/102 t24/28 u-20/20', dur: .5, walk: .95, open: 0 },
  heavy: { a: 'sp2 hd-2 a26/46 b44/50 t18/12 u-18/10', b: 'sp4 hd-3 a24/50 b42/54 t19/15 u-17/13', dur: 1.4, walk: 1.1, open: 1 },
  dance: { a: 'sp-2 hd2 a-14/70 b92/30 t10/8 u-24/16', b: 'sp6 hd-4 a30/76 b60/70 t24/26 u-10/20', dur: .6, walk: .95, open: 1 },
  fog: { a: 'sp1 hd4 a6/16 b10/18 t8/4 u-9/5', b: 'sp2 hd5 a7/18 b11/20 t8/5 u-9/6', dur: 2.2, walk: 1.15, open: 1 },
  street: { a: 'sp-4 hd0 a-8/34 b20/110 t14/8 u-14/8', b: 'sp-2 hd-1 a-6/38 b22/114 t15/10 u-13/10', dur: 1.1, walk: 1, open: 0 },
  oni: { a: 'sp22 hd-16 a50/30 b30/40 t34/44 u-24/34', b: 'sp26 hd-18 a44/36 b36/36 t38/50 u-22/40', dur: .8, walk: 1, open: 1 },
  // out-of-ring standing poses
  calm: { a: 'sp1 hd0 a4/12 b-2/14 t5/3 u-6/4', b: 'sp2 hd1 a5/14 b-1/16 t5/4 u-6/5', dur: 1.9, walk: 1, open: 0 },
  npcA: { a: 'sp0 hd0 a6/16 b0/14 t4/3 u-5/4', b: 'sp1 hd1 a8/18 b1/16 t4/4 u-5/5', dur: 2.1, walk: 1, open: 0 },
  arms: { a: 'sp-3 hd-2 a30/92 b38/88 t7/4 u-8/5', b: 'sp-2 hd-1 a31/94 b39/90 t7/5 u-8/6', dur: 2.3, walk: 1, open: 0 },
  hips: { a: 'sp-3 hd-1 a-28/70 b26/70 t9/5 u-9/5', b: 'sp-2 hd0 a-27/72 b27/72 t9/6 u-9/6', dur: 1.7, walk: 1, open: 0 },
  lean: { a: 'sp-10 hd6 a-16/30 b20/100 t20/6 u-4/10', b: 'sp-9 hd5 a-15/32 b21/102 t20/7 u-4/11', dur: 2.4, walk: 1, open: 0 },
  elder: { a: 'sp16 hd-12 a-26/40 b-20/44 t8/12 u-10/12', b: 'sp17 hd-12 a-25/42 b-19/46 t8/13 u-10/13', dur: 2.2, walk: .9, open: 0 },
  write: { a: 'sp8 hd12 a30/80 b44/76 t5/4 u-6/4', b: 'sp9 hd13 a32/84 b44/76 t5/5 u-6/5', dur: .7, walk: 1, open: 0 },
  hawk: { a: 'sp2 hd-8 a120/70 b10/40 t8/6 u-10/6', b: 'sp4 hd-4 a96/80 b14/36 t9/8 u-9/8', dur: .7, walk: 1, open: 1 },
};
function stancePose(name, t, out) {
  const s = STANCES[name] || STANCES.std;
  const k = .5 - .5 * Math.cos((t / s.dur) * Math.PI * 2);
  return poseLerp(pose(s.a), pose(s.b), k, out);
}

// ---- gaits: overwrite the legs and swing the arms of a stance pose -------------------------
function gaitPose(p, phase, kind, amt = 1) {
  const n = phase, f = phase + Math.PI, run = kind === 'run';
  const leg = ph => {
    const s = Math.sin(ph), sw = Math.max(0, Math.sin(ph + (run ? 2.25 : 2.2)));
    return run ? [46 * s + 16, 20 + 82 * sw] : [26 * s + 3, 9 + 44 * Math.pow(sw, 1.15)];
  };
  const a = leg(n), b = leg(f);
  for (const [i, v] of [[7, a[0]], [8, a[1]], [9, b[0]], [10, b[1]]]) p[i] = p[i] + (v - p[i]) * amt;
  const sw = Math.sin(phase) * amt;
  if (run) { p[1] += (22 - p[1]) * amt; p[2] += (-12 - p[2]) * amt; p[3] += (-46 * sw + 10 - p[3]) * amt; p[4] += (84 - p[4]) * amt; p[5] += (46 * sw + 10 - p[5]) * amt; p[6] += (84 - p[6]) * amt; p[11] += Math.abs(Math.cos(phase)) * 2.5 * amt; }
  else { p[3] -= 15 * sw; p[5] += 15 * sw; p[1] += 2 * amt; }
  return p;
}

// ---- state clips ---------------------------------------------------------------------------
/* keys: [t, pose, ease]. The ease describes how the previous key travels to this one. */
const CLIP_SRC = {
  jump: { keys: [[0, 'sp16 hd-10 a-30/40 b-20/40 t50/80 u40/80'], [.09, 'sp2 hd-8 a120/40 b130/30 t20/10 u-14/20 lift2', 'out'], [.4, 'sp4 hd-4 a70/60 b90/40 t44/60 u4/50']], air: 1 },
  fall: { keys: [[0, 'sp6 hd-2 a90/40 b100/30 t40/56 u4/44'], [.25, 'sp10 hd4 a130/20 b140/20 t26/30 u-10/34']], air: 1 },
  land: { keys: [[0, 'sp30 hd-16 a30/40 b44/40 t64/84 u34/84 sq.16'], [.16, 'sp12 hd-6 a20/80 b50/80 t26/30 u-16/26', 'out']] },
  guard: { keys: [[0, 'sp14 hd10 a64/128 b72/120 t26/34 u-24/26'], [.4, 'sp15 hd11 a62/130 b70/122 t27/36 u-23/28']], loop: 1 },
  guardHit: { keys: [[0, 'sp-6 hd14 a70/128 b76/124 t30/40 u-30/10'], [.2, 'sp14 hd10 a64/128 b72/120 t26/34 u-24/26', 'out']] },
  parry: { keys: [[0, 'sp4 hd0 a100/60 b60/100 t26/30 u-28/14'], [.1, 'sp-8 hd-6 a130/30 b40/90 t14/16 u-30/10', 'out'], [.34, 'sp10 hd-4 a30/80 b55/90 t18/18 u-20/14', 'io']] },
  hitF: { keys: [[0, 'sp-4 hd-10 a20/60 b40/60 t14/18 u-18/16'], [.06, 'sp-24 hd-26 a-16/50 b4/60 t26/24 u-24/6', 'out'], [.26, 'sp-6 hd-4 a20/80 b50/80 t18/18 u-20/14', 'io']] },
  hitB: { keys: [[0, 'sp10 hd6 a10/50 b30/60 t14/18 u-18/16'], [.06, 'sp34 hd20 a-40/30 b-20/40 t30/30 u-20/20', 'out'], [.26, 'sp12 hd-4 a20/80 b50/80 t18/18 u-20/14', 'io']] },
  hitLow: { keys: [[0, 'sp10 hd6 a10/50 b30/60 t14/18 u-18/16'], [.06, 'sp42 hd10 a20/70 b30/80 t34/44 u-12/40', 'out'], [.28, 'sp12 hd-4 a20/80 b50/80 t18/18 u-20/14', 'io']] },
  hitHeavy: { keys: [[0, 'sp-10 hd-20 a10/40 b20/40 t14/18 u-18/16'], [.08, 'sp-40 hd-30 a40/20 b70/20 t40/20 u-20/6 lift2', 'out'], [.22, 'sp-26 hd-16 a-10/50 b20/60 t36/30 u-26/10', 'io'], [.46, 'sp4 hd2 a10/70 b40/70 t20/22 u-20/16', 'io']] },
  stagger: { keys: [[0, 'sp24 hd24 a-10/20 b6/26 t18/30 u-14/34'], [.3, 'sp-8 hd-14 a10/30 b24/20 t-6/24 u20/28', 'io'], [.6, 'sp26 hd26 a-14/24 b2/20 t20/34 u-16/30', 'io']], loop: 1 },
  downSup: { keys: [[0, 'r-90 hd-6 a56/24 b130/20 t4/10 u12/34'], [.9, 'r-90 hd-2 a60/20 b126/26 t6/14 u10/30', 'io']], loop: 1 },
  downProne: { keys: [[0, 'r90 sp2 hd-12 a160/30 b150/44 t-2/10 u4/6'], [.9, 'r90 sp4 hd-6 a156/36 b146/48 t-4/14 u6/8', 'io']], loop: 1 },
  koSup: { keys: [[0, 'r-90 hd-10 a80/6 b150/6 t2/4 u8/16']], loop: 1 },
  koProne: { keys: [[0, 'r90 sp2 hd-4 a174/4 b120/10 t0/4 u4/8']], loop: 1 },
  getupSup: { keys: [[0, 'r-90 hd-4 a40/30 b60/40 t10/20 u20/40'], [.16, 'r-60 sp36 hd10 a-30/20 b40/60 t70/90 u80/110', 'io'], [.34, 'r-10 sp50 hd-20 a-10/40 b30/60 t80/120 u40/100', 'io'], [.56, 'sp10 hd-6 a20/90 b55/84 t18/20 u-20/16', 'io']] },
  getupProne: { keys: [[0, 'r90 hd-10 a100/70 b96/74 t0/10 u0/10'], [.18, 'r64 sp-6 hd-30 a90/30 b86/30 t60/100 u20/60', 'io'], [.36, 'r10 sp46 hd-30 a40/30 b50/30 t80/110 u0/70', 'io'], [.56, 'sp10 hd-6 a20/90 b55/84 t18/20 u-20/16', 'io']] },
  kipup: { keys: [[0, 'r-100 hd10 a150/60 b150/60 t110/40 u110/40'], [.12, 'r-120 sp20 hd20 a160/40 b160/40 t130/30 u130/30', 'out'], [.3, 'r-20 sp-20 hd-20 a40/30 b50/30 t20/60 u10/70 lift16', 'io'], [.44, 'sp22 hd-10 a30/60 b50/60 t50/70 u20/60', 'in'], [.56, 'sp8 hd-4 a20/90 b55/84 t18/18 u-20/14', 'io']] },
  roll: { keys: [[0, 'sp40 hd10 a60/70 b70/70 t70/90 u40/90'], [.08, 'r60 sp60 hd40 a70/100 b76/100 t110/130 u104/130', 'io'], [.3, 'r360 sp60 hd40 a70/100 b76/100 t110/130 u104/130', 'lin'], [.36, 'r360 sp40 hd-10 a40/60 b50/60 t70/90 u30/90', 'out'], [.44, 'r360 sp12 hd-6 a20/90 b55/84 t20/22 u-20/18', 'io']] },
  backstep: { keys: [[0, 'sp16 hd-8 a30/80 b55/84 t40/50 u10/40'], [.08, 'sp-16 hd-4 a50/70 b80/60 t54/30 u-10/60 lift5', 'out'], [.22, 'sp10 hd-6 a30/80 b60/80 t30/34 u-26/20', 'io'], [.34, 'sp8 hd-4 a20/90 b55/84 t18/18 u-20/14', 'io']] },
  grabReach: { keys: [[0, 'sp10 hd-6 a10/80 b30/80 t18/20 u-20/16'], [.1, 'sp34 hd-18 a80/10 b86/8 t44/34 u-32/10 ox4', 'out'], [.24, 'sp30 hd-12 a66/50 b70/44 t40/36 u-30/12 ox4', 'io'], [.44, 'sp10 hd-6 a20/80 b50/84 t18/18 u-20/14', 'io']] },
  shove: { keys: [[0, 'sp4 hd-4 a10/124 b24/120 t20/26 u-22/18'], [.14, 'sp-2 hd-2 a-10/136 b4/130 t16/28 u-22/24', 'out'], [.2, 'sp30 hd-16 a86/8 b92/6 t42/26 u-34/6 ox6', 'in'], [.32, 'sp28 hd-14 a82/14 b88/10 t40/26 u-32/8 ox6'], [.52, 'sp10 hd-6 a20/80 b50/84 t18/18 u-20/14', 'io']] },
  pickup: { keys: [[0, 'sp50 hd-20 a50/20 b56/16 t60/84 u20/76'], [.3, 'sp30 hd-12 a64/50 b72/44 t34/40 u-18/34', 'io']] },
  hold: { keys: [[0, 'sp22 hd-10 a62/64 b70/58 t26/30 u-22/22'], [.4, 'sp24 hd-9 a60/68 b68/62 t28/34 u-21/26', 'io']], loop: 1 },
  holdRear: { keys: [[0, 'sp12 hd-4 a72/44 b78/40 t24/26 u-20/22'], [.4, 'sp14 hd-4 a70/48 b76/44 t26/30 u-19/24', 'io']], loop: 1 },
  held: { keys: [[0, 'sp48 hd16 a30/30 b44/20 t20/30 u-12/30'], [.34, 'sp44 hd10 a40/20 b30/34 t16/26 u-14/34', 'io']], loop: 1 },
  heldRear: { keys: [[0, 'sp-4 hd10 a30/60 b40/56 t10/18 u-10/20'], [.34, 'sp2 hd-8 a40/50 b30/66 t14/22 u-12/16', 'io']], loop: 1 },
  knee: { keys: [[0, 'sp24 hd-8 a64/60 b70/54 t10/40 u-22/22'], [.1, 'sp14 hd-4 a70/60 b76/54 t100/110 u-14/10 lift2', 'in'], [.26, 'sp22 hd-10 a62/64 b70/58 t26/30 u-22/22', 'io']] },
  taunt: { keys: [[0, 'sp-4 hd-6 a20/60 b40/60 t12/8 u-14/8'], [.2, 'sp-14 hd-14 a150/60 b150/60 t16/10 u-18/8', 'out'], [.45, 'sp-16 hd-16 a140/110 b140/110 t16/10 u-18/8', 'io'], [.75, 'sp-14 hd-12 a150/80 b150/80 t16/10 u-18/8', 'io'], [1, 'sp8 hd-4 a20/90 b55/84 t18/18 u-20/14', 'io']] },
  tauntCall: { keys: [[0, 'sp0 hd0 a20/60 b60/60 t12/8 u-14/8'], [.2, 'sp-4 hd-8 a-30/80 b96/10 t14/8 u-16/8', 'out'], [.35, 'sp-4 hd-4 a-30/80 b92/90 t14/8 u-16/8', 'io'], [.5, 'sp-4 hd-8 a-30/80 b96/10 t14/8 u-16/8', 'io'], [.65, 'sp-4 hd-4 a-30/80 b92/90 t14/8 u-16/8', 'io'], [1, 'sp8 hd-4 a20/90 b55/84 t18/18 u-20/14', 'io']] },
  tauntDance: { keys: [[0, 'sp0 a20/60 b60/60 t12/8 u-14/8'], [.18, 'sp-12 hd-10 a150/20 b-20/80 t30/40 u-10/10', 'io'], [.36, 'sp16 hd6 a-20/80 b150/20 t-10/20 u30/40', 'io'], [.54, 'sp-12 hd-10 a150/20 b-20/80 t30/40 u-10/10', 'io'], [.72, 'sp-20 hd-20 a110/130 b110/130 t20/30 u-20/30', 'io'], [1, 'sp8 hd-4 a20/90 b55/84 t18/18 u-20/14', 'io']] },
  tauntBow: { keys: [[0, 'sp0 a10/30 b20/30 t8/6 u-10/6'], [.3, 'sp50 hd20 a60/60 b-30/80 t14/8 u-16/8', 'io'], [.6, 'sp50 hd24 a60/60 b-30/80 t14/8 u-16/8'], [1, 'sp8 hd-4 a20/90 b55/84 t18/18 u-20/14', 'io']] },
  win: { keys: [[0, 'sp0 hd-6 a20/60 b40/60 t12/8 u-14/8'], [.3, 'sp-8 hd-16 a172/10 b168/12 t12/8 u-14/8', 'back'], [.6, 'sp-8 hd-18 a166/16 b174/6 t14/10 u-14/10', 'io'], [.9, 'sp-8 hd-16 a172/10 b168/12 t12/8 u-14/8', 'io']], loopFrom: .3 },
  winFlex: { keys: [[0, 'sp0 hd-6 a20/60 b40/60 t12/8 u-14/8'], [.3, 'sp-6 hd-8 a92/112 b96/108 t16/10 u-18/8', 'back'], [.7, 'sp-10 hd-14 a96/122 b100/118 t18/12 u-18/10', 'io'], [1.1, 'sp-6 hd-8 a92/112 b96/108 t16/10 u-18/8', 'io']], loopFrom: .3 },
  winFog: { keys: [[0, 'sp0 a6/16 b10/18 t8/4 u-9/5'], [.6, 'sp-6 hd-12 a60/4 b70/4 t8/4 u-9/5', 'io'], [1.6, 'sp-8 hd-14 a64/4 b74/4 t8/4 u-9/5', 'io'], [2.6, 'sp-6 hd-12 a60/4 b70/4 t8/4 u-9/5', 'io']], loopFrom: .6 },
  lose: { keys: [[0, 'sp40 hd20 a20/10 b24/10 t60/110 u60/120'], [1, 'sp44 hd26 a22/12 b26/12 t60/110 u60/120', 'io']], loop: 1 },
  climb: { keys: [[0, 'sp20 hd-16 a140/30 b150/20 t60/80 u10/30'], [.22, 'sp10 hd-10 a150/40 b120/60 t20/30 u70/90', 'io'], [.44, 'sp26 hd-10 a60/60 b66/60 t70/90 u60/84', 'io']] },
  perch: { keys: [[0, 'sp22 hd-12 a30/50 b90/30 t62/86 u50/80'], [.5, 'sp26 hd-14 a36/44 b84/36 t66/92 u54/86', 'io']], loop: 1 },
  hang: { keys: [[0, 'sp4 hd-14 a172/6 b168/8 t14/30 u-6/24'], [.4, 'sp8 hd-10 a168/12 b172/8 t-8/24 u16/34', 'io']], loop: 1 },
  ropeBack: { keys: [[0, 'sp-14 hd10 a-60/20 b-50/24 t24/20 u10/10'], [.12, 'sp-26 hd20 a-76/20 b-70/24 t34/26 u16/14', 'out'], [.24, 'sp14 hd-10 a20/70 b40/70 t30/24 u-30/20', 'in']] },
  pin: { keys: [[0, 'r70 sp16 hd-10 a60/40 b80/30 t30/60 u-10/30'], [.3, 'r76 sp8 hd-18 a50/50 b86/40 t20/40 u-16/24', 'io']] },
  tagReach: { keys: [[0, 'sp10 hd-6 a96/2 b20/60 t18/20 u-24/16'], [.35, 'sp16 hd-8 a104/0 b20/60 t20/24 u-24/16', 'io']], loop: 1 },
  apron: { keys: [[0, 'sp6 hd-4 a70/50 b40/70 t8/6 u-8/8'], [.5, 'sp8 hd-6 a66/56 b40/70 t8/8 u-8/10', 'io']], loop: 1 },
  stomp: { keys: [[0, 'sp4 hd10 a20/60 b40/60 t30/60 u-10/10'], [.16, 'sp-8 hd14 a60/40 b80/40 t96/100 u-6/6', 'out'], [.24, 'sp22 hd16 a-10/50 b10/60 t26/6 u-18/24', 'in'], [.5, 'sp10 hd-6 a20/90 b55/84 t18/18 u-20/14', 'io']] },
  elbowdrop: { keys: [[0, 'sp10 hd0 a20/60 b40/60 t20/20 u-20/16'], [.18, 'sp-20 hd-10 a150/90 b40/40 t30/20 u-20/10 lift6', 'out'], [.34, 'r66 sp-20 hd10 a60/120 b150/30 t10/40 u-20/30 lift10', 'io'], [.44, 'r84 sp-10 hd0 a70/120 b160/20 t4/30 u-10/20', 'in'], [.62, 'r84 sp-10 hd-6 a70/120 b160/20 t4/30 u-10/20'], [.9, 'sp10 hd-6 a20/90 b55/84 t18/18 u-20/14', 'io']] },
  enterRing: { keys: [[0, 'sp20 hd-10 a150/20 b150/10 t20/30 u10/20'], [.2, 'sp50 hd0 a110/30 b116/30 t80/90 u0/20', 'io'], [.4, 'sp30 hd-14 a40/40 b60/40 t50/60 u-30/40', 'io'], [.55, 'sp10 hd-6 a20/90 b55/84 t18/18 u-20/14', 'io']] },
  talk: { keys: [[0, 'sp2 hd0 a10/30 b40/90 t5/3 u-6/4'], [.3, 'sp4 hd3 a8/26 b60/60 t5/3 u-6/4', 'io'], [.7, 'sp0 hd-2 a14/34 b36/100 t5/3 u-6/4', 'io'], [1.1, 'sp2 hd0 a10/30 b40/90 t5/3 u-6/4', 'io']], loop: 1 },
  interact: { keys: [[0, 'sp6 hd0 a20/40 b30/40 t6/4 u-6/4'], [.18, 'sp16 hd0 a84/20 b30/40 t10/8 u-10/6', 'out'], [.4, 'sp2 hd0 a6/14 b0/14 t5/3 u-6/4', 'io']] },
  sit: { keys: [[0, 'sp-6 hd4 a20/40 b26/40 t86/84 u90/86'], [1.2, 'sp-4 hd6 a22/42 b28/42 t86/84 u90/86', 'io']], loop: 1 },
  bench: { keys: [[0, 'r-90 a90/90 b90/90 t40/90 u46/90'], [1, 'r-90 a92/6 b94/6 t40/90 u46/90', 'io']], loop: 0 },
  bridge: { keys: [[0, 'r-62 sp-44 hd-40 a20/100 b24/100 t74/108 u66/108'], [.6, 'r-60 sp-48 hd-44 a22/104 b26/104 t76/112 u68/112', 'io']], loop: 1 },
  rope: { keys: [[0, 'sp2 hd0 a24/40 b30/40 t8/14 u6/16'], [.2, 'sp0 hd0 a20/50 b26/50 t14/34 u10/36 lift9', 'out'], [.4, 'sp4 hd0 a24/40 b30/40 t14/28 u12/30', 'in']], loop: 1 },
  carry: { keys: [[0, 'sp4 hd-4 a56/60 b62/56 t12/10 u-14/10'], [.6, 'sp5 hd-4 a56/60 b62/56 t13/12 u-13/12', 'io']], loop: 1 },
  mitt: { keys: [[0, 'sp8 hd-4 a70/30 b74/28 t14/14 u-16/12'], [.5, 'sp9 hd-4 a72/28 b76/26 t14/16 u-16/14', 'io']], loop: 1 },
  ref1: { keys: [[0, 'sp8 hd0 a70/30 b60/30 t10/8 u-10/8'], [.4, 'sp20 hd4 a90/6 b60/40 t20/16 u-16/14', 'io']], loop: 1 },
  refSlap: { keys: [[0, 'r50 sp26 hd-30 a150/10 b90/30 t60/90 u20/60'], [.5, 'r50 sp26 hd-30 a104/4 b90/30 t60/90 u20/60', 'in'], [.6, 'r50 sp26 hd-30 a104/4 b90/30 t60/90 u20/60']], loop: 1 },
  refRaise: { keys: [[0, 'sp0 hd-10 a172/4 b10/30 t8/6 u-8/6']], loop: 1 },
  cheer: { keys: [[0, 'sp-4 hd-10 a160/20 b150/30 t8/10 u-8/10'], [.16, 'sp-4 hd-14 a172/10 b168/10 t6/6 u-6/6 lift5', 'out'], [.34, 'sp-4 hd-10 a160/20 b150/30 t8/10 u-8/10', 'in']], loop: 1 },
  sleep: { keys: [[0, 'r-90 hd8 a14/60 b20/70 t8/20 u14/26'], [1.8, 'r-90 hd8 a14/64 b20/74 t8/20 u14/26', 'io']], loop: 1 },
  whipped: { keys: [[0, 'sp28 hd10 a90/10 b70/20 t40/20 u-30/30']], loop: 1 },
  limpAir: { keys: [[0, 'sp-20 hd-20 a120/20 b110/30 t20/30 u40/40']], loop: 1 },
};
const clipMemo = new Map();
function clip(name) {
  let c = clipMemo.get(name);
  if (c) return c;
  const s = CLIP_SRC[name];
  if (!s) throw new Error('no clip ' + name);
  c = { name, loop: !!s.loop, loopFrom: s.loopFrom != null ? s.loopFrom : -1, air: !!s.air, keys: s.keys.map(k => ({ t: k[0], p: pose(k[1]), e: EASE[k[2] || 'io'] })), dur: s.keys[s.keys.length - 1][0] || .001 };
  clipMemo.set(name, c);
  return c;
}
const hasClip = name => !!CLIP_SRC[name];
function sampleClip(c, t, out) {
  const K = c.keys, n = K.length;
  const copy = p => { for (let i = 0; i < POSE_N; i++) out[i] = p[i]; return out; };
  if (n === 1) return copy(K[0].p);
  if (c.loop) {
    if (n === 2) return poseLerp(K[0].p, K[1].p, .5 - .5 * Math.cos((t / c.dur) * Math.PI), out); // two-key loops breathe
    t %= c.dur;
    if (t < 0) t += c.dur;
  } else if (c.loopFrom >= 0 && t > c.dur) t = c.loopFrom + ((t - c.loopFrom) % (c.dur - c.loopFrom));
  if (t <= K[0].t) return copy(K[0].p);
  for (let k = 1; k < n; k++) if (t <= K[k].t) { const u = clamp01((t - K[k - 1].t) / (K[k].t - K[k - 1].t || 1)); return poseLerp(K[k - 1].p, K[k].p, K[k].e(u), out); }
  return copy(K[n - 1].p);
}

/* Attack pose from three drawings (wind, hit, follow) and the attack's own timing. */
function attackPose(atk, t, stance, out) {
  const S = atk.startup, A = atk.active, R = atk.recover;
  const w = pose(atk.wind), h = pose(atk.hit), f = pose(atk.follow || atk.hit);
  if (t < S * .62) return poseLerp(stance, w, EASE.out(clamp01(t / (S * .62))), out);
  if (t < S) return poseLerp(w, h, EASE.in(clamp01((t - S * .62) / (S * .38))), out);
  if (t < S + A) return poseLerp(h, f, EASE.out(clamp01((t - S) / A)), out);
  const hold = R * (atk.holdR != null ? atk.holdR : .3);
  if (t < S + A + hold) { for (let i = 0; i < POSE_N; i++) out[i] = f[i]; return out; }
  return poseLerp(f, stance, EASE.io(clamp01((t - S - A - hold) / (R - hold || .01))), out);
}

return { STANCES, stancePose, gaitPose, clip, hasClip, sampleClip, attackPose };
})();
// ---- data/looks.js
__m["data/looks.js"] = (function () {
// Appearance data for wrestlers and townspeople. Pure data: renderers read it, nothing here draws.
const LOOKS = {
  // ---- wrestlers ----
  rookie: { build: 'athletic', scale: 1, skin: 'tan', head: { face: 'square', hair: 'side', hairCol: '#2b3350', browTilt: .5 }, top: { kind: 'none' }, bottom: { kind: 'tights', c1: '#157f8c', c2: '#ffb347', pat: 'side' }, boots: { c1: '#22294d', c2: '#ffb347', h: .75 }, wrist: { c: '#f2efe4', len: .34 }, elbow: null, knee: '#22294d' },
  taesan: { build: 'power', scale: 1.06, skin: 'tan', head: { face: 'jaw', hair: 'buzz', hairCol: '#2a2030', beard: 'chops', hat: 'bandana', hatCol: '#ff8a2b', browW: 1.9 }, top: { kind: 'xstrap', c1: '#ff8a2b', c2: '#ffd65a' }, bottom: { kind: 'shorts', c1: '#2d3348', c2: '#ffc233', pat: 'bands' }, boots: { c1: '#7a4a28', c2: '#ffc233', h: .7 }, wrist: { c: '#7a4a28', len: .3 }, knee: null, emblem: null },
  haneul: { build: 'fem', scale: .95, skin: 'light', head: { face: 'slim', hair: 'slick', hairCol: '#e8eef7', lashes: 1, eye: '#1d7fc4', mask: { full: 1, kind: 'gull', c1: '#eef3fb', c2: '#3aa6e8', c3: '#ff9a2e' } }, top: { kind: 'crop', c1: '#eef3fb', c2: '#3aa6e8' }, bottom: { kind: 'tights', c1: '#eef3fb', c2: '#3aa6e8', pat: 'flame' }, boots: { c1: '#ff9a2e', c2: '#eef3fb', h: .6 }, wrist: { c: '#3aa6e8', len: .5 }, tails: [{ at: 'head', n: 5, len: 5.2, w: 2.6, c: '#3aa6e8' }, { at: 'head', n: 5, len: 4.6, w: 2.2, c: '#ffffff' }] },
  dohyun: { build: 'athletic', scale: 1.01, skin: 'light', head: { face: 'slim', hair: 'slick', hairCol: '#1d1a2c', browTilt: .7, eye: '#2c2440' }, top: { kind: 'singlet', c1: '#22306e', c2: '#e9e2c8', emblem: 'knot', ce: '#e9e2c8' }, bottom: { kind: 'shorts', c1: '#22306e', c2: '#e9e2c8', pat: 'side' }, boots: { c1: '#e9e2c8', c2: '#22306e', h: .72 }, wrist: { c: '#b98d55', c2: '#e2bf86', len: .3 }, knee: '#1a2148' },
  dongsu: { build: 'athletic', scale: 1.04, skin: 'brown', head: { face: 'jaw', hair: 'buzz', hairCol: '#20182a', mask: { full: 1, kind: 'visor', c1: '#6d7688', c2: '#39e6c0' } }, top: { kind: 'harness', c1: '#4b3524', c2: '#c9c2b0' }, bottom: { kind: 'pants', c1: '#3b4a78', c2: '#5d6ea6' }, boots: { c1: '#4b3524', c2: '#c9a25a', h: .4 }, glove: '#c98432', wrist: { c: '#c98432', len: .42 }, scarBody: 1 },
  mandeok: { build: 'heavy', scale: 1.06, skin: 'tan', head: { face: 'fat', hair: 'topknot', hairCol: '#1e1a28', beard: 'sideburn', bandCol: '#2aa7b8' }, top: { kind: 'none' }, bottom: { kind: 'trunks', c1: '#1f8fa6', c2: '#f3ead2' }, boots: { c1: '#f3ead2', c2: '#1f8fa6', h: .35, plain: 1 }, wrist: { c: '#f3ead2', len: .24 }, belt: '#1f6f8c', tattoo: 'belly', sash: '#f3ead2' },
  neon: { build: 'femPower', scale: .99, skin: 'brown', head: { face: 'slim', hair: 'curly', hairCol: '#ff4fa3', lashes: 1, eye: '#3a1a30', lips: '#c22e62', earring: '#ffd65a', browCol: '#7a1f52' }, top: { kind: 'bra', c1: '#23d5c8', c2: '#ff4fa3' }, bottom: { kind: 'tights', c1: '#2b1a52', c2: '#ff4fa3', pat: 'spots' }, boots: { c1: '#23d5c8', c2: '#ff4fa3', h: .55 }, wrist: { c: '#ff4fa3', c2: '#23d5c8', len: .3 }, sash: '#23d5c8' },
  fogking: { build: 'giant', scale: 1.03, skin: 'ash', head: { face: 'long', hair: 'bald', hairCol: '#c9cbd8', mask: { full: 1, kind: 'fog', c1: '#dfe3ee', c2: '#30364f' } }, top: { kind: 'none' }, bottom: { kind: 'tights', c1: '#23263a', c2: '#7f89b0', pat: 'side' }, boots: { c1: '#14162a', c2: '#7f89b0', h: .8 }, wrist: { c: '#c6ccdf', len: .55 }, belt: '#e0b23c', tails: [{ at: 'head', n: 7, len: 6, w: 2.8, c: '#c6ccdf' }, { at: 'head', n: 6, len: 6, w: 2.2, c: '#9aa3c2' }], cape: { c1: '#4a5078', len: 1 } },
  bokja: { build: 'femPower', scale: .98, skin: 'tan', head: { face: 'round', hair: 'curly', hairCol: '#3a2030', lashes: 0, blush: 1, hat: 'bandana', hatCol: '#e0405a', lips: '#c23a4a' }, top: { kind: 'apron', c1: '#5c7fc2', c2: '#f0e9d8' }, bottom: { kind: 'pants', c1: '#b04a8c', c2: '#e49acb', pat: 'spots' }, boots: { c1: '#e0405a', c2: '#ffd65a', h: .5, plain: 1 }, sleeve: { c: '#5c7fc2', len: .6 }, glove: '#ff7aa8', wrist: { c: '#ff7aa8', len: .5 } },
  dueok: { build: 'power', scale: 1, skin: 'brown', head: { face: 'jaw', hair: 'spiky', hairCol: '#1c1424', mask: { full: 1, kind: 'oni', c1: '#c2332f', c2: '#1c1424', c3: '#f0c24a' }, maskHair: 1 }, top: { kind: 'fur', c1: '#6b4a2c' }, bottom: { kind: 'shorts', c1: '#c98a2e', c2: '#2c1c12', pat: 'spots' }, boots: { c1: '#3a2418', c2: '#f0c24a', h: .45 }, wrist: { c: '#6b4a2c', len: .4 }, tattoo: 'chest' },
  palcho: { build: 'lean', scale: .99, skin: 'pale', head: { face: 'slim', hair: 'bald', mask: { full: 1, kind: 'octo', c1: '#8b3fb8', c2: '#f7a8d8', c3: '#f7d154' } }, top: { kind: 'strap', c1: '#8b3fb8', c2: '#f7a8d8' }, bottom: { kind: 'tights', c1: '#5b2a86', c2: '#f7a8d8', pat: 'spots' }, boots: { c1: '#f7a8d8', c2: '#5b2a86', h: .5 }, wrist: { c: '#f7a8d8', len: .3 }, tails: [{ at: 'waist', n: 4, len: 5, w: 2.4, c: '#8b3fb8' }, { at: 'waist', n: 5, len: 5, w: 2.2, c: '#b066d8' }] },
  baeksang: { build: 'power', scale: 1.04, skin: 'ash', head: { face: 'jaw', hair: 'bald', mask: { full: 1, kind: 'shark', c1: '#4f6b8c', c2: '#dfe8f0', c3: '#d23b4a', noMouth: 1 } }, top: { kind: 'none' }, bottom: { kind: 'trunks', c1: '#d23b4a', c2: '#dfe8f0' }, boots: { c1: '#2c3f5c', c2: '#dfe8f0', h: .78 }, wrist: { c: '#2c3f5c', len: .4 }, knee: '#2c3f5c', scarBody: 1 },
  bjorn: { build: 'giant', scale: 1.0, skin: 'pale', head: { face: 'jaw', hair: 'mullet', hairCol: '#d9a23c', beard: 'long', eye: '#2d7fc4', hat: 'band', hatCol: '#3b2a52' }, top: { kind: 'fur', c1: '#6f5640' }, bottom: { kind: 'trunks', c1: '#3b2a52', c2: '#c9a25a' }, boots: { c1: '#6f5640', c2: '#d8c7a4', h: .9 }, wrist: { c: '#6f5640', c2: '#a8845c', len: .5 }, belt: '#8a6a3c', knee: null },
  baekpa: { build: 'athletic', scale: 1.0, skin: 'light', head: { face: 'long', hair: 'slick', hairCol: '#e6e9f2', beard: 'full', wrinkle: 1, browCol: '#cfd4e2', browW: 1.8 }, top: { kind: 'none' }, bottom: { kind: 'tights', c1: '#30365c', c2: '#e6e9f2', pat: 'flame' }, boots: { c1: '#e6e9f2', c2: '#30365c', h: .75 }, wrist: { c: '#e6e9f2', len: .28 }, knee: '#30365c', tattoo: 'chest' },
  // ---- career-only wrestlers ----
  gosu: { build: 'lean', scale: 1.02, skin: 'dark', head: { face: 'long', hair: 'flat', hairCol: '#1c1420', glass: 'shades', beard: 'goatee' }, top: { kind: 'vest', c1: '#7c2a8c', c2: '#ffd65a' }, bottom: { kind: 'tights', c1: '#2a1a3c', c2: '#ffd65a', pat: 'side' }, boots: { c1: '#ffd65a', c2: '#7c2a8c', h: .5 }, wrist: { c: '#ffd65a', len: .22 } },
  ironma: { build: 'femPower', scale: 1.05, skin: 'light', head: { face: 'square', hair: 'mohawk', hairCol: '#3fd46b', lashes: 1, paint: 'lines', paintCol: '#3fd46b' }, top: { kind: 'singlet', c1: '#23262f', c2: '#3fd46b' }, bottom: { kind: 'shorts', c1: '#23262f', c2: '#3fd46b', pat: 'side' }, boots: { c1: '#3fd46b', c2: '#23262f', h: .7 }, wrist: { c: '#3fd46b', len: .34 }, knee: '#3fd46b' },
  // ---- townspeople ----
  boss: { build: 'stout', scale: 1.0, skin: 'tan', head: { face: 'fat', hair: 'buzz', hairCol: '#8a8494', beard: 'handlebar', hat: 'captain', wrinkle: 1, noseRed: 1, browW: 1.8 }, top: { kind: 'suit', c1: '#23396e', c2: '#f2efe4', c3: '#c2333f' }, bottom: { kind: 'pants', c1: '#e6ddc6' }, boots: { c1: '#5a3420', c2: '#8a5a34', h: 0 }, sleeve: { c: '#23396e', len: 1.82 } },
  trainer: { build: 'elder', scale: 1.0, skin: 'tan', head: { face: 'round', hair: 'bun', hairCol: '#c9c6d4', lashes: 0, wrinkle: 1, glass: null }, top: { kind: 'track', c1: '#c2333f', c2: '#f6f2e6' }, bottom: { kind: 'pants', c1: '#c2333f', c2: '#f6f2e6', pat: 'side' }, boots: { c1: '#f6f2e6', c2: '#c2333f', h: 0 }, sleeve: { c: '#c2333f', c2: '#f6f2e6', len: 1.85 } },
  doctor: { build: 'slim', scale: .98, skin: 'light', head: { face: 'slim', hair: 'bob', hairCol: '#4a2f3a', lashes: 1, glass: 'round', eye: '#2a4a3a' }, top: { kind: 'coat', c1: '#eef3fb', c2: '#5fc2b0', c3: null }, bottom: { kind: 'pants', c1: '#3b4668' }, boots: { c1: '#3b2a38', c2: '#6a4a5a', h: 0 }, sleeve: { c: '#eef3fb', len: 1.85 }, coat: { c1: '#eef3fb', len: .62, open: 1 } },
  shop: { build: 'slim', scale: 1.0, skin: 'dark', head: { face: 'slim', hair: 'afro', hairCol: '#5a2c6a', glass: 'square', earring: '#ffd65a', beard: 'goatee' }, top: { kind: 'stripes', c1: '#ffb347', c2: '#d2456a' }, bottom: { kind: 'pants', c1: '#2d4f5c' }, boots: { c1: '#ffd65a', c2: '#8a5a1a', h: 0 }, sleeve: { c: '#ffb347', len: 1.1 }, scarf: '#35c2c2' },
  auntie: { build: 'stout', scale: .92, skin: 'tan', head: { face: 'round', hair: 'curly', hairCol: '#2a1c28', blush: 1, wrinkle: 1 }, top: { kind: 'apron', c1: '#d2456a', c2: '#ffe6b0' }, bottom: { kind: 'pants', c1: '#6a3f8a', c2: '#d9a6e8', pat: 'spots' }, boots: { c1: '#e8e2d0', c2: '#8a8494', h: 0 }, sleeve: { c: '#d2456a', len: 1.0 } },
  staff: { build: 'slim', scale: 1.0, skin: 'light', head: { face: 'square', hair: 'short', hairCol: '#33263a', hat: 'headset' }, top: { kind: 'tee', c1: '#23263a', c2: '#49d6ff', stripe: 1 }, bottom: { kind: 'pants', c1: '#3a3550' }, boots: { c1: '#e6e9f2', c2: '#49d6ff', h: 0 }, sleeve: { c: '#23263a', len: .6 } },
  referee: { build: 'slim', scale: .96, skin: 'tan', head: { face: 'long', hair: 'buzz', hairCol: '#2a2030', beard: 'mustache' }, top: { kind: 'stripes', c1: '#f2f4fa', c2: '#1f6f8c' }, bottom: { kind: 'pants', c1: '#1b2038' }, boots: { c1: '#10121f', c2: '#3a4a6a', h: 0 }, sleeve: { c: '#f2f4fa', len: .7 } },
  reporter: { build: 'fem', scale: .96, skin: 'light', head: { face: 'slim', hair: 'wave', hairCol: '#b4502e', lashes: 1, eye: '#5a3a1a', lips: '#c23a4a' }, top: { kind: 'jacket', c1: '#35a07a', c2: '#f6f2e6', c3: '#35a07a' }, bottom: { kind: 'tights', c1: '#2b2a44' }, boots: { c1: '#5a3420', c2: '#8a5a34', h: .2 }, sleeve: { c: '#35a07a', len: 1.8 }, skirt: { c1: '#2b2a44', len: .42 } },
  janitor: { build: 'elder', scale: 1.02, skin: 'brown', head: { face: 'long', hair: 'buzz', hairCol: '#c9c6d4', hat: 'cap', hatCol: '#3f6f5a', beard: 'mustache', wrinkle: 1 }, top: { kind: 'overall', c1: '#3f6f5a', c2: '#d8cfb8' }, bottom: { kind: 'pants', c1: '#3f6f5a' }, boots: { c1: '#2c2a30', c2: '#6a6672', h: 0 }, sleeve: { c: '#d8cfb8', len: 1.2 } },
  foreman: { build: 'power', scale: 1.0, skin: 'brown', head: { face: 'jaw', hair: 'buzz', hairCol: '#2a2030', hat: 'hard', hatCol: '#ffb52e', beard: 'stubble' }, top: { kind: 'hivis', c1: '#ff7a2b', c2: '#f3f0a8' }, bottom: { kind: 'pants', c1: '#3b4668' }, boots: { c1: '#7a5a34', c2: '#c9a25a', h: 0 }, sleeve: { c: '#4a566e', len: 1.5 }, glove: '#d8cfb8' },
  sponsor: { build: 'slim', scale: 1.03, skin: 'pale', head: { face: 'long', hair: 'slick', hairCol: '#4a3a2a', glass: 'shades' }, top: { kind: 'suit', c1: '#5a2c6a', c2: '#ffe6b0', c3: '#23d5c8' }, bottom: { kind: 'pants', c1: '#5a2c6a' }, boots: { c1: '#1c1424', c2: '#5a2c6a', h: 0 }, sleeve: { c: '#5a2c6a', len: 1.85 } },
  fankid: { build: 'elder', scale: .74, skin: 'light', head: { face: 'round', hair: 'bob', hairCol: '#2a2030', blush: 1, lashes: 0 }, top: { kind: 'hoodie', c1: '#ffd65a', c2: '#e0405a', c3: '#e0405a' }, bottom: { kind: 'shorts', c1: '#2d63b8' }, boots: { c1: '#e0405a', c2: '#ffffff', h: 0 }, sleeve: { c: '#ffd65a', len: 1.8 } },
  oldman: { build: 'elder', scale: .96, skin: 'tan', head: { face: 'long', hair: 'bald', beard: 'long', hairCol: '#e6e9f2', hat: 'beanie', hatCol: '#3a5a8c', wrinkle: 1 }, top: { kind: 'coat', c1: '#d8a62e', c2: '#3b4668' }, bottom: { kind: 'pants', c1: '#3b4668' }, boots: { c1: '#2c3f5c', c2: '#d8a62e', h: 0 }, sleeve: { c: '#d8a62e', len: 1.8 }, coat: { c1: '#d8a62e', len: .5, open: 1 } },
  nurse: { build: 'fem', scale: .95, skin: 'light', head: { face: 'round', hair: 'bun', hairCol: '#5a3a2a', lashes: 1, hat: 'nurse', blush: 1 }, top: { kind: 'shirt', c1: '#9fe0d0' }, bottom: { kind: 'pants', c1: '#9fe0d0' }, boots: { c1: '#f2f4fa', c2: '#9fe0d0', h: 0 }, sleeve: { c: '#9fe0d0', len: .7 } },
  busker: { build: 'slim', scale: .99, skin: 'brown', head: { face: 'slim', hair: 'mullet', hairCol: '#1c1424', beard: 'goatee', hat: 'beanie', hatCol: '#d2456a' }, top: { kind: 'jacket', c1: '#3b5a3f', c2: '#d8cfb8', c3: '#c98432' }, bottom: { kind: 'pants', c1: '#2d3348' }, boots: { c1: '#7a4a28', c2: '#c98432', h: 0 }, sleeve: { c: '#3b5a3f', len: 1.8 } },
  bear: { build: 'power', scale: 1.1, skin: 'brown', head: { face: 'fat', hair: 'horns', hairCol: '#6b4a2c', beard: 'full' }, top: { kind: 'tank', c1: '#23262f', c2: '#c98432' }, bottom: { kind: 'pants', c1: '#3a2e28' }, boots: { c1: '#2c2420', c2: '#c98432', h: 0 }, wrist: { c: '#c98432', len: .2 } },
};

return { LOOKS };
})();
// ---- data/characters.js
__m["data/characters.js"] = (function () {
// Wrestlers. A new wrestler is one entry here plus a look in looks.js.
const { LOOKS } = __m["data/looks.js"];
/* stats: hp, stun (max values), atk, grp (grapple), spd, jump, rec (move recovery), down (down recovery),
   fin (finisher charge), weight, lift (lifting power), kbr (knockback resist).
   moves: front/rear slots n (K), f (toward+K), b (away+K), u (W+K), d (S+K). */
const front = (n, f, b, u, d) => ({ n, f, b, u, d });
const STYLES = {
  power: { name: '파워하우스', desc: '높은 체력과 무거운 던지기' },
  air: { name: '하이플라이어', desc: '빠른 발과 공중 공격' },
  tech: { name: '테크니션', desc: '다양한 잡기와 반격' },
  brawl: { name: '브롤러', desc: '강력한 기본 공격' },
  heavy: { name: '슈퍼 헤비급', desc: '밀리지 않는 거구' },
  all: { name: '올라운더', desc: '균형 잡힌 능력' },
};
const CHARACTERS = {
  rookie: {
    name: '신인', nick: '이름 없는 파도', style: 'all', look: LOOKS.rookie, stance: 'std', color: '#3fe0d0',
    stats: { hp: 100, stun: 100, atk: 1, grp: 1, spd: 1, jump: 1, rec: 1, down: 1, fin: 1, weight: 96, lift: 1.3, kbr: 1 },
    chain: ['jab', 'cross', 'hook'], run: 'lariat', air: 'dropkick', dive: 'diveElbow', ground: 'stomp',
    moves: { front: front('bodySlam', 'irishWhip', 'suplex', 'powerbomb', 'ddt'), rear: front('german', 'ringOut', 'backdropDriver', 'atomic', 'bulldog'), catch: 'backBody', counter: 'hipToss' },
    finisher: 'dawn', taunt: 'taunt', win: 'win', ai: { aggr: .55, air: .4, grab: .55, def: .5, rope: .35, taunt: .2, dirty: .2 }, voice: 1,
    lines: { intro: '여기서부터 시작이야.', win: '좋아, 한 발짝 더!', lose: '…다음엔 다를 거야.' },
  },
  taesan: {
    name: '강태산', nick: '인간 크레인', style: 'power', look: LOOKS.taesan, stance: 'power', color: '#ff8a2b',
    stats: { hp: 118, stun: 108, atk: 1.1, grp: 1.14, spd: .9, jump: .88, rec: .95, down: .95, fin: .96, weight: 122, lift: 2.1, kbr: 1.2 },
    chain: ['palm', 'elbow', 'overhand'], run: 'shoulder', air: 'flyingElbow', dive: 'diveSplash', ground: 'stomp',
    moves: { front: front('bodySlam', 'irishWhip', 'backbreaker', 'powerbomb', 'chokeslam'), rear: front('german', 'ringOut', 'giantSwing', 'atomic', 'backdropDriver'), catch: 'spinebuster', counter: 'hipToss' },
    finisher: 'container', taunt: 'taunt', win: 'winFlex', ai: { aggr: .6, air: .1, grab: .85, def: .45, rope: .25, taunt: .2, dirty: .2 }, voice: .72,
    lines: { intro: '자, 하역 시작한다.', win: '오늘 물량, 끝!', lose: '허리가… 나갔나.' },
  },
  haneul: {
    name: '윤하늘', nick: '갈매기', style: 'air', look: LOOKS.haneul, stance: 'air', color: '#3aa6e8',
    stats: { hp: 86, stun: 92, atk: .94, grp: .92, spd: 1.17, jump: 1.26, rec: 1.1, down: 1.1, fin: 1.12, weight: 70, lift: 1, kbr: .82 },
    chain: ['lowkick', 'midkick', 'spinkick'], run: 'flyKnee', air: 'dropkick', dive: 'diveMoon', ground: 'elbowdrop',
    moves: { front: front('headDrop', 'irishWhip', 'suplex', 'bellyToBelly', 'ddt'), rear: front('bulldog', 'ringOut', 'backdropDriver', 'atomic', 'german'), catch: 'backBody', counter: 'armDrag' },
    finisher: 'typhoon', taunt: 'taunt', win: 'win', ai: { aggr: .6, air: .9, grab: .35, def: .55, rope: .7, taunt: .25, dirty: .05 }, voice: 1.5,
    lines: { intro: '바람이 딱 좋은걸?', win: '높이, 더 높이!', lose: '날개가… 젖었어.' },
  },
  dohyun: {
    name: '서도현', nick: '매듭', style: 'tech', look: LOOKS.dohyun, stance: 'tech', color: '#e9e2c8',
    stats: { hp: 97, stun: 100, atk: .95, grp: 1.18, spd: 1.03, jump: 1, rec: 1.16, down: 1.05, fin: 1.05, weight: 94, lift: 1.5, kbr: 1 },
    chain: ['jab', 'elbow', 'knee'], run: 'bigboot', air: 'dropkick', dive: 'diveElbow', ground: 'stomp',
    moves: { front: front('suplex', 'irishWhip', 'bellyToBelly', 'backbreaker', 'ddt'), rear: front('german', 'ringOut', 'anchorHold', 'backdropDriver', 'atomic'), catch: 'spinebuster', counter: 'armDrag' },
    finisher: 'anchor', taunt: 'tauntCall', win: 'win', ai: { aggr: .5, air: .25, grab: .8, def: .8, rope: .35, taunt: .1, dirty: .1 }, voice: 1,
    lines: { intro: '너와 나, 누가 먼저 올라가나 보자.', win: '매듭은 풀리지 않아.', lose: '…인정하지.' },
  },
  dongsu: {
    name: '마동수', nick: '용접공', style: 'brawl', look: LOOKS.dongsu, stance: 'box', color: '#39e6c0',
    stats: { hp: 106, stun: 110, atk: 1.17, grp: .94, spd: .99, jump: .95, rec: 1, down: 1, fin: 1, weight: 104, lift: 1.4, kbr: 1.08 },
    chain: ['jab', 'cross', 'uppercut'], run: 'lariat', air: 'flyingElbow', dive: 'diveElbow', ground: 'stomp',
    moves: { front: front('bodySlam', 'irishWhip', 'cornerSmash', 'slapFest', 'ddt'), rear: front('backdropDriver', 'ringOut', 'german', 'atomic', 'bulldog'), catch: 'spinebuster', counter: 'hipToss' },
    finisher: 'weld', taunt: 'tauntCall', win: 'winFlex', ai: { aggr: .85, air: .15, grab: .4, def: .4, rope: .3, taunt: .2, dirty: .25 }, voice: .85,
    lines: { intro: '불꽃 튀길 준비됐나?', win: '때웠다. 단단하게.', lose: '용접봉… 떨어졌네.' },
  },
  mandeok: {
    name: '오만덕', nick: '고래', style: 'heavy', look: LOOKS.mandeok, stance: 'heavy', color: '#2aa7b8',
    stats: { hp: 138, stun: 124, atk: 1.06, grp: 1.04, spd: .8, jump: .74, rec: .88, down: .9, fin: .95, weight: 164, lift: 1.9, kbr: 1.7 },
    chain: ['sumoPush', 'sumoPush', 'belly'], run: 'bodyBlock', air: 'buttDrop', dive: 'diveQuake', ground: 'elbowdrop',
    moves: { front: front('bodySlam', 'irishWhip', 'cornerSmash', 'airplane', 'gutBuster'), rear: front('backdropDriver', 'ringOut', 'giantSwing', 'atomic', 'bulldog'), catch: 'spinebuster', counter: 'hipToss' },
    finisher: 'tsunami', taunt: 'taunt', win: 'win', ai: { aggr: .5, air: .2, grab: .6, def: .4, rope: .15, taunt: .3, dirty: .05 }, voice: .6,
    lines: { intro: '밥은 먹고 왔어?', win: '아이고 배 꺼졌다.', lose: '썰물이구먼…' },
  },
  neon: {
    name: '네온 제이', nick: '항구의 조명', style: 'all', look: LOOKS.neon, stance: 'dance', color: '#ff4fa3',
    stats: { hp: 96, stun: 97, atk: 1.02, grp: 1, spd: 1.1, jump: 1.12, rec: 1.06, down: 1.05, fin: 1.22, weight: 80, lift: 1.2, kbr: .94 },
    chain: ['palm', 'spinback', 'capoeira'], run: 'slideKick', air: 'axeKick', dive: 'diveKick', ground: 'elbowdrop',
    moves: { front: front('bellyToBelly', 'irishWhip', 'suplex', 'headDrop', 'ddt'), rear: front('bulldog', 'ringOut', 'german', 'atomic', 'backdropDriver'), catch: 'backBody', counter: 'armDrag' },
    finisher: 'neonspin', taunt: 'tauntDance', win: 'win', ai: { aggr: .6, air: .6, grab: .45, def: .5, rope: .55, taunt: .55, dirty: .15 }, voice: 1.35,
    lines: { intro: '카메라, 나만 잡아!', win: '앙코르는 없어~', lose: '조명 꺼… 창피해.' },
  },
  fogking: {
    name: '안개왕', nick: '등대를 끈 남자', style: 'power', look: LOOKS.fogking, stance: 'fog', color: '#9aa3c2',
    stats: { hp: 128, stun: 120, atk: 1.14, grp: 1.17, spd: .97, jump: .95, rec: 1.1, down: 1.15, fin: 1.1, weight: 126, lift: 2.3, kbr: 1.3 },
    chain: ['palm', 'midkick', 'overhand'], run: 'bigboot', air: 'flyingElbow', dive: 'diveElbow', ground: 'stomp',
    moves: { front: front('chokeslam', 'irishWhip', 'backbreaker', 'powerbomb', 'piledriver'), rear: front('german', 'ringOut', 'anchorHold', 'atomic', 'backdropDriver'), catch: 'spinebuster', counter: 'hipToss' },
    finisher: 'blackout', taunt: 'tauntBow', win: 'winFog', ai: { aggr: .6, air: .2, grab: .75, def: .75, rope: .25, taunt: .15, dirty: .2 }, voice: .55,
    lines: { intro: '……보이지 않는 것이 두려운가.', win: '안개는 걷히지 않는다.', lose: '…빛이군.' },
  },
  bokja: {
    name: '박복자', nick: '어시장 철썩 손', style: 'brawl', look: LOOKS.bokja, stance: 'std', color: '#e0405a',
    stats: { hp: 104, stun: 104, atk: 1.05, grp: 1.06, spd: .95, jump: .88, rec: 1, down: 1.05, fin: 1.1, weight: 90, lift: 1.6, kbr: 1.05 },
    chain: ['slap', 'backhand', 'slap'], run: 'shoulder', air: 'buttDrop', dive: 'diveSplash', ground: 'stomp',
    moves: { front: front('slapFest', 'irishWhip', 'bodySlam', 'airplane', 'ddt'), rear: front('backdropDriver', 'ringOut', 'giantSwing', 'atomic', 'bulldog'), catch: 'backBody', counter: 'hipToss' },
    finisher: 'homerun', taunt: 'tauntCall', win: 'winFlex', ai: { aggr: .75, air: .15, grab: .55, def: .4, rope: .25, taunt: .3, dirty: .3 }, voice: 1.2,
    lines: { intro: '떨이요 떨이! 매가 떨이!', win: '덤으로 하나 더 줄까?', lose: '아이고 내 생선…' },
  },
  dueok: {
    name: '두억', nick: '도깨비', style: 'brawl', look: LOOKS.dueok, stance: 'oni', color: '#f0c24a',
    stats: { hp: 110, stun: 104, atk: 1.14, grp: 1.02, spd: .98, jump: 1, rec: .98, down: 1.05, fin: 1.02, weight: 110, lift: 1.7, kbr: 1.1 },
    chain: ['claw', 'claw2', 'headbutt'], run: 'shoulder', air: 'crossbody', dive: 'diveHead', ground: 'elbowdrop',
    moves: { front: front('gutBuster', 'irishWhip', 'bodySlam', 'piledriver', 'ddt'), rear: front('german', 'ringOut', 'backdropDriver', 'atomic', 'bulldog'), catch: 'spinebuster', counter: 'hipToss' },
    finisher: 'club', taunt: 'tauntDance', win: 'winFlex', ai: { aggr: .8, air: .4, grab: .5, def: .3, rope: .4, taunt: .35, dirty: .5 }, voice: .7,
    lines: { intro: '씨름 한 판 할까, 히히!', win: '혹 떼러 왔다 혹 붙였지!', lose: '방망이… 부러졌다.' },
  },
  palcho: {
    name: '팔초', nick: '문어 박사', style: 'tech', look: LOOKS.palcho, stance: 'tech', color: '#b066d8',
    stats: { hp: 92, stun: 96, atk: .93, grp: 1.14, spd: 1.07, jump: 1.05, rec: 1.12, down: 1.08, fin: 1.1, weight: 78, lift: 1.3, kbr: .95 },
    chain: ['whipA', 'whipA', 'spinback'], run: 'slideKick', air: 'crossbody', dive: 'diveMoon', ground: 'elbowdrop',
    moves: { front: front('bellyToBelly', 'irishWhip', 'suplex', 'backbreaker', 'ddt'), rear: front('anchorHold', 'ringOut', 'german', 'atomic', 'bulldog'), catch: 'backBody', counter: 'armDrag' },
    finisher: 'ink', taunt: 'tauntBow', win: 'win', ai: { aggr: .5, air: .45, grab: .75, def: .6, rope: .45, taunt: .2, dirty: .4 }, voice: 1.25,
    lines: { intro: '자네를 해부해 보지.', win: '논문감이군.', lose: '빨판이… 떨어졌…' },
  },
  baeksang: {
    name: '백상', nick: '상어 이빨', style: 'power', look: LOOKS.baeksang, stance: 'power', color: '#6f93bd',
    stats: { hp: 112, stun: 108, atk: 1.13, grp: 1.08, spd: 1.01, jump: .95, rec: 1, down: 1, fin: 1.05, weight: 116, lift: 1.9, kbr: 1.15 },
    chain: ['cross', 'elbow', 'headbutt'], run: 'lariat', air: 'crossbody', dive: 'diveSplash', ground: 'elbowdrop',
    moves: { front: front('powerbomb', 'irishWhip', 'backbreaker', 'gutBuster', 'ddt'), rear: front('german', 'ringOut', 'giantSwing', 'atomic', 'bulldog'), catch: 'spinebuster', counter: 'hipToss' },
    finisher: 'shark', taunt: 'taunt', win: 'winFlex', ai: { aggr: .9, air: .3, grab: .6, def: .35, rope: .35, taunt: .2, dirty: .35 }, voice: .68,
    lines: { intro: '넌 미끼다.', win: '한입 거리도 안 되는군.', lose: '그물에… 걸렸나.' },
  },
  bjorn: {
    name: '비에른', nick: '북해의 바위', style: 'heavy', look: LOOKS.bjorn, stance: 'power', color: '#c9a25a',
    stats: { hp: 126, stun: 116, atk: 1.12, grp: 1.12, spd: .88, jump: .84, rec: .95, down: .95, fin: 1, weight: 138, lift: 2.3, kbr: 1.35 },
    chain: ['chop', 'elbow', 'overhand'], run: 'bigboot', air: 'flyingElbow', dive: 'diveSplash', ground: 'elbowdrop',
    moves: { front: front('bodySlam', 'irishWhip', 'backbreaker', 'powerbomb', 'chokeslam'), rear: front('german', 'ringOut', 'giantSwing', 'atomic', 'backdropDriver'), catch: 'spinebuster', counter: 'hipToss' },
    finisher: 'north', taunt: 'taunt', win: 'winFlex', ai: { aggr: .6, air: .1, grab: .8, def: .5, rope: .2, taunt: .15, dirty: .1 }, voice: .6,
    lines: { intro: '파도, 작다. 북해, 크다.', win: '좋은 싸움. 맥주 산다.', lose: '…발할라.' },
  },
  baekpa: {
    name: '백파', nick: '늙은 파도', style: 'tech', look: LOOKS.baekpa, stance: 'tech', color: '#e6e9f2',
    stats: { hp: 100, stun: 100, atk: 1.02, grp: 1.22, spd: .99, jump: .97, rec: 1.18, down: .98, fin: 1.1, weight: 96, lift: 1.8, kbr: 1.05 },
    chain: ['chop', 'chop', 'uppercut'], run: 'lariat', air: 'dropkick', dive: 'diveElbow', ground: 'stomp',
    moves: { front: front('suplex', 'irishWhip', 'backbreaker', 'piledriver', 'ddt'), rear: front('german', 'ringOut', 'anchorHold', 'backdropDriver', 'bulldog'), catch: 'backBody', counter: 'armDrag' },
    finisher: 'whitewave', taunt: 'tauntBow', win: 'win', ai: { aggr: .5, air: .2, grab: .85, def: .85, rope: .35, taunt: .1, dirty: .05 }, voice: .8,
    lines: { intro: '파도는 부서져도 다시 오는 법.', win: '아직 쓸 만하지?', lose: '허허, 좋은 파도였네.' },
  },
  gosu: {
    name: '고수', nick: '입담의 왕', style: 'air', look: LOOKS.gosu, stance: 'dance', color: '#ffd65a', rivalGym: 1,
    stats: { hp: 94, stun: 96, atk: 1.02, grp: 1, spd: 1.14, jump: 1.18, rec: 1.08, down: 1.05, fin: 1.15, weight: 80, lift: 1.2, kbr: .95 },
    chain: ['jab', 'spinback', 'spinkick'], run: 'flyKnee', air: 'axeKick', dive: 'diveKick', ground: 'elbowdrop',
    moves: { front: front('headDrop', 'irishWhip', 'bellyToBelly', 'suplex', 'ddt'), rear: front('bulldog', 'ringOut', 'german', 'atomic', 'backdropDriver'), catch: 'backBody', counter: 'armDrag' },
    finisher: 'neonspin', taunt: 'tauntDance', win: 'win', ai: { aggr: .7, air: .7, grab: .45, def: .55, rope: .6, taunt: .6, dirty: .4 }, voice: 1.1,
    lines: { intro: '말로 이기고, 몸으로 또 이기지!', win: '박수는 좌석에서~', lose: '대본에 없던 건데?' },
  },
  ironma: {
    name: '철마', nick: '초록 갈기', style: 'power', look: LOOKS.ironma, stance: 'box', color: '#3fd46b', rivalGym: 1,
    stats: { hp: 114, stun: 112, atk: 1.12, grp: 1.1, spd: 1, jump: .96, rec: 1.02, down: 1.05, fin: 1.02, weight: 104, lift: 1.9, kbr: 1.15 },
    chain: ['elbow', 'knee', 'overhand'], run: 'shoulder', air: 'crossbody', dive: 'diveSplash', ground: 'stomp',
    moves: { front: front('powerbomb', 'irishWhip', 'backbreaker', 'airplane', 'piledriver'), rear: front('german', 'ringOut', 'giantSwing', 'atomic', 'backdropDriver'), catch: 'spinebuster', counter: 'hipToss' },
    finisher: 'north', taunt: 'taunt', win: 'winFlex', ai: { aggr: .75, air: .2, grab: .75, def: .5, rope: .3, taunt: .2, dirty: .25 }, voice: 1,
    lines: { intro: '밟고 지나간다.', win: '길 비켜.', lose: '편자가 빠졌군.' },
  },
};
for (const id in CHARACTERS) CHARACTERS[id].id = id;
const ROSTER_IDS = Object.keys(CHARACTERS).filter(i => i !== 'rookie');
const STAT_INFO = [
  ['hp', '최대 체력'], ['stun', '최대 기절 저항'], ['atk', '기본 공격력'], ['grp', '잡기 기술'], ['spd', '이동 속도'], ['jump', '점프력'], ['rec', '기술 회복'], ['down', '다운 회복'], ['fin', '피니셔 충전'], ['weight', '무게'],
];
function statBar(c, key) { // 0..1 for UI bars
  const s = c.stats;
  switch (key) {
    case 'hp': return (s.hp - 60) / 90;
    case 'stun': return (s.stun - 60) / 80;
    case 'weight': return (s.weight - 50) / 120;
    default: return (s[key] - .6) / .75;
  }
}

return { STYLES, CHARACTERS, ROSTER_IDS, STAT_INFO, statBar };
})();
// ---- data/balance.js
__m["data/balance.js"] = (function () {
// Every tunable number of the fight, in one place. Change values here; no system hard-codes them.
const BALANCE = {
  // movement
  gravity: 980, walk: 104, run: 196, runAfter: .42, doubleTap: .24, accel: 1250, decel: 1500, airAccel: 520, jump: 322, maxFall: 620,
  ropeBoost: 1.42, ropeBoostTime: .75, ropeLean: .22,
  // stun gauge
  stunRegenDelay: 1.8, stunRegen: 8.5, stunAfterDown: .92, stunAfterDownLoss: .05, stunAfterDownMin: .7, stunAfterMove: .62,
  // down state: seconds for the 1st, 2nd ... knock-down, then the cap
  downTimes: [1.5, 2.0, 2.5, 3.0, 3.5], moveDownTime: 1.05, getUpProtect: .95, hitGetUpProtect: .5, mashDown: .07,
  // attack bookkeeping
  inputBuffer: .16, comboWindow: 1.0, comboStep: .1, comboMin: .5, comboBreak: 7, staleMemory: 6, staleStep: .13, staleMin: .52, counterHit: 1.25, repeatRecover: 1.25,
  hitstunScale: .94,
  // guard, dodge, counter
  guardHp: .18, guardStun: .36, guardPush: .75, perfectGuard: .13, guardBreakStagger: .9, chipMin: 1,
  dodgeTime: .42, dodgeInv: [.03, .27], dodgeSpeed: 250, dodgeCd: .62, backstepTime: .34, counterWindow: .15, counterCd: 1.1,
  // grapple
  grabRange: 50, grabHold: 2.7, grabEscape: 100, mashValue: 7.5, mashDecay: 11, grabStrikeMax: 3, pickup: .32, switchTime: .22, reversalLead: .16, reversalWindow: .17, staggerTime: 1.0, shoveReach: 40,
  grabWalk: 46,
  // emergency escape
  burstCost: 35, burstCd: 18, burstRange: 92,
  // finisher
  finMax: 100, finHit: 2.6, finTaken: .34, finCounter: 10, finPerfect: 6, finTaunt: 9, finMissKeep: .45, tauntTime: 1.0, hypeBonus: .28,
  // ring
  ringOutDamage: 4, countStep: 1.15, countMax: 10, hangTime: 2.2, perchTime: 2.6, wallDamage: 3,
  // pin
  pinStep: .92, pinBase: 34, pinPerHp: 92, pinPerTry: 9, pinMash: 8.5,
  // tag
  tagHeal: 3.2, tagStun: 14, tagRange: 46, tagMaxHeal: .5,
  // rumble
  rumbleInterval: 21, rumbleStart: 2, rumbleMaxInRing: 5,
  // injuries (career only). Points out of 100 for losing a full health bar, plus extras.
  injuryPerBar: 10.5, injuryKO: 3, injuryFinisher: 1.6, injuryRingOut: .8, injuryWarn: 55, injuryDanger: 80,
};

/* Basic attacks. reach/low/high are pixels from the feet. wind-hit-follow are the three key drawings.
   lv: 1 light, 2 medium, 3 heavy, 4 launch. */
const ATTACKS = {
  jab: { name: '잽', startup: .085, active: .05, recover: .15, reach: 38, low: 44, high: 78, hp: 1.3, stun: 8.5, kb: 46, hs: .25, stop: .04, lv: 1, wind: 'sp4 hd-4 a20/100 b10/128 t18/18 u-22/16', hit: 'sp13 hd-8 a14/106 b93/2 t28/20 u-24/8', follow: 'sp11 hd-6 a16/104 b88/10 t26/20 u-23/9', sfx: 'punch1' },
  cross: { name: '스트레이트', startup: .1, active: .06, recover: .2, reach: 42, low: 44, high: 78, hp: 1.8, stun: 10.5, kb: 66, hs: .28, stop: .05, lv: 1, wind: 'sp0 hd-4 a-34/116 b60/92 t14/18 u-24/18', hit: 'sp20 hd-10 a92/2 b26/116 t36/22 u-32/6 ox3', follow: 'sp18 hd-8 a86/10 b28/112 t34/22 u-30/7 ox3', sfx: 'punch1' },
  hook: { name: '훅', startup: .17, active: .07, recover: .34, reach: 42, low: 42, high: 82, hp: 3.2, stun: 18, kb: 170, hs: .42, stop: .085, lv: 3, wind: 'sp-14 hd-4 a-66/64 b60/90 t4/12 u-12/24', hit: 'sp26 hd-14 a84/44 b4/90 t42/28 u-34/8 ox8', follow: 'sp32 hd-16 a104/60 b0/90 t44/30 u-36/10 ox8', sfx: 'punch2' },
  uppercut: { name: '어퍼컷', startup: .19, active: .07, recover: .42, reach: 36, low: 40, high: 96, hp: 3.6, stun: 21, kb: 80, up: 230, hs: .5, stop: .1, lv: 4, wind: 'sp32 hd-14 a-34/64 b50/100 t54/74 u6/64', hit: 'sp-10 hd-16 a146/44 b0/90 t12/6 u-18/12 lift5', follow: 'sp-16 hd-20 a168/24 b-6/80 t8/4 u-20/14 lift7', sfx: 'punch3', holdR: .4 },
  chop: { name: '손날치기', startup: .14, active: .06, recover: .26, reach: 38, low: 42, high: 76, hp: 2.3, stun: 13, kb: 60, hs: .32, stop: .06, lv: 2, hand: 'open', wind: 'sp-10 hd-6 a148/64 b50/80 t12/14 u-22/16', hit: 'sp22 hd-10 a80/14 b10/90 t32/22 u-28/8', follow: 'sp28 hd-12 a52/10 b6/90 t34/24 u-30/8', sfx: 'chop' },
  palm: { name: '장타', startup: .13, active: .06, recover: .24, reach: 38, low: 42, high: 78, hp: 2, stun: 12, kb: 120, hs: .3, stop: .055, lv: 2, hand: 'open', wind: 'sp2 hd-6 a-10/130 b50/90 t20/26 u-22/20', hit: 'sp22 hd-12 a92/4 b30/100 t38/24 u-32/6 ox4', sfx: 'punch1' },
  lowkick: { name: '로우킥', startup: .12, active: .06, recover: .22, reach: 40, low: 6, high: 40, hp: 1.9, stun: 11, kb: 40, hs: .28, stop: .05, lv: 1, lowHit: 1, wind: 'sp2 hd-4 a30/90 b56/80 t-24/60 u-4/10', hit: 'sp-10 hd2 a-10/60 b50/80 t54/4 u-8/10', follow: 'sp-8 hd2 a-6/64 b50/80 t62/12 u-8/10', sfx: 'kick1' },
  midkick: { name: '미들킥', startup: .16, active: .07, recover: .28, reach: 46, low: 26, high: 66, hp: 2.7, stun: 15, kb: 130, hs: .36, stop: .07, lv: 2, wind: 'sp-4 hd0 a20/80 b60/80 t70/104 u-8/10', hit: 'sp-24 hd10 a-24/40 b44/80 t94/2 u-8/8', follow: 'sp-22 hd8 a-20/44 b44/80 t90/20 u-8/8', sfx: 'kick2' },
  spinkick: { name: '돌려차기', startup: .23, active: .08, recover: .36, reach: 50, low: 34, high: 88, hp: 3.7, stun: 20, kb: 200, up: 60, hs: .46, stop: .09, lv: 3, spin: 1, wind: 'sp10 hd-6 a30/60 b40/60 t30/60 u-10/20', hit: 'sp-34 hd16 a-30/30 b30/60 t112/2 u-6/8', follow: 'sp-26 hd10 a-24/34 b34/60 t96/10 u-6/8', sfx: 'kick2' },
  knee: { name: '니킥', startup: .13, active: .07, recover: .26, reach: 32, low: 28, high: 64, hp: 2.6, stun: 14, kb: 80, hs: .34, stop: .065, lv: 2, wind: 'sp14 hd-6 a70/40 b76/40 t-10/60 u-6/10', hit: 'sp-2 hd-6 a20/60 b24/60 t96/116 u-12/8 lift3', sfx: 'kick1' },
  headbutt: { name: '박치기', startup: .19, active: .06, recover: .36, reach: 34, low: 50, high: 86, hp: 3.4, stun: 23, kb: 90, hs: .44, stop: .1, lv: 3, armor: 1, wind: 'sp-18 hd-18 a-30/50 b-20/50 t16/14 u-24/16', hit: 'sp40 hd18 a-24/50 b-14/50 t36/34 u-30/10 ox9', sfx: 'punch3' },
  belly: { name: '배치기', startup: .2, active: .1, recover: .34, reach: 36, low: 20, high: 70, hp: 2.8, stun: 17, kb: 300, hs: .4, stop: .08, lv: 3, armor: 1, wind: 'sp16 hd-4 a-10/40 b0/40 t26/26 u-20/20', hit: 'sp-22 hd6 a-50/20 b-40/20 t34/20 u-34/6 ox12', sfx: 'belly' },
  slap: { name: '따귀', startup: .11, active: .06, recover: .2, reach: 38, low: 48, high: 82, hp: 1.5, stun: 13.5, kb: 40, hs: .3, stop: .06, lv: 1, hand: 'open', wind: 'sp-8 hd-4 a-64/10 b56/70 t18/18 u-22/16', hit: 'sp14 hd-6 a100/0 b50/70 t26/22 u-24/10', follow: 'sp20 hd-6 a136/16 b46/70 t28/22 u-24/10', sfx: 'slap' },
  backhand: { name: '손등 따귀', startup: .1, active: .06, recover: .24, reach: 38, low: 48, high: 82, hp: 1.7, stun: 14, kb: 60, hs: .3, stop: .06, lv: 1, hand: 'open', wind: 'sp18 hd-6 a140/40 b46/70 t28/22 u-24/10', hit: 'sp4 hd-4 a84/0 b50/70 t22/20 u-22/12', follow: 'sp-6 hd-4 a20/10 b54/70 t18/18 u-22/14', sfx: 'slap' },
  elbow: { name: '팔꿈치', startup: .11, active: .06, recover: .22, reach: 32, low: 46, high: 80, hp: 2.2, stun: 12.5, kb: 70, hs: .32, stop: .06, lv: 2, wind: 'sp-4 hd-4 a20/130 b40/90 t18/18 u-22/16', hit: 'sp24 hd-8 a92/128 b10/90 t36/24 u-30/8 ox5', sfx: 'punch2' },
  overhand: { name: '내려찍기', startup: .23, active: .07, recover: .4, reach: 40, low: 34, high: 90, hp: 4, stun: 21, kb: 120, hs: .5, stop: .1, lv: 3, armor: 1, wind: 'sp-18 hd-10 a168/50 b172/46 t12/12 u-22/14', hit: 'sp38 hd-12 a66/10 b70/10 t44/44 u-24/30 ox4', sfx: 'punch3' },
  claw: { name: '할퀴기', startup: .12, active: .07, recover: .22, reach: 42, low: 34, high: 80, hp: 1.9, stun: 11, kb: 56, hs: .28, stop: .05, lv: 1, hand: 'open', wind: 'sp6 hd-12 a150/40 b40/60 t30/40 u-24/34', hit: 'sp34 hd-18 a70/20 b10/50 t46/44 u-32/24 ox4', follow: 'sp42 hd-20 a30/20 b6/50 t48/46 u-34/24 ox4', sfx: 'slash' },
  claw2: { name: '되할퀴기', startup: .11, active: .07, recover: .26, reach: 44, low: 30, high: 84, hp: 2.2, stun: 12, kb: 70, hs: .3, stop: .055, lv: 2, hand: 'open', wind: 'sp40 hd-18 a30/30 b0/60 t46/44 u-32/24', hit: 'sp16 hd-10 a20/40 b100/10 t34/34 u-28/20 ox4', follow: 'sp4 hd-6 a24/40 b140/20 t28/30 u-26/18', sfx: 'slash' },
  whipA: { name: '촉수 채찍', startup: .13, active: .07, recover: .2, reach: 52, low: 30, high: 76, hp: 1.6, stun: 10, kb: 40, hs: .28, stop: .045, lv: 1, hand: 'open', wind: 'sp-6 hd-4 a120/60 b40/60 t18/20 u-22/18', hit: 'sp20 hd-8 a88/0 b20/80 t34/22 u-30/8 ox4', sfx: 'whip' },
  spinback: { name: '스핀 블로', startup: .2, active: .07, recover: .32, reach: 44, low: 46, high: 84, hp: 3, stun: 18, kb: 160, hs: .42, stop: .085, lv: 3, spin: 1, wind: 'sp10 hd-6 a-40/60 b60/60 t20/24 u-20/20', hit: 'sp8 hd-8 a96/0 b-40/40 t30/22 u-28/10 ox4', follow: 'sp2 hd-4 a130/10 b-40/40 t24/20 u-24/12 ox4', sfx: 'punch2' },
  capoeira: { name: '풍차 발차기', startup: .2, active: .1, recover: .32, reach: 50, low: 10, high: 78, hp: 3.2, stun: 19, kb: 170, up: 70, hs: .44, stop: .08, lv: 3, spin: 1, wind: 'sp50 hd-10 a30/60 b40/60 t60/90 u20/70', hit: 'r-90 sp-10 hd0 a160/10 b120/20 t96/4 u40/30', follow: 'r-70 sp-10 hd0 a160/10 b120/20 t80/10 u30/40', sfx: 'kick2' },
  sumoPush: { name: '밀어치기', startup: .12, active: .07, recover: .2, reach: 38, low: 36, high: 78, hp: 1.7, stun: 11, kb: 130, hs: .28, stop: .05, lv: 1, hand: 'open', wind: 'sp10 hd-6 a10/120 b70/40 t26/30 u-24/26', hit: 'sp20 hd-10 a88/4 b20/110 t34/30 u-28/22 ox5', sfx: 'punch1' },
  // running
  lariat: { name: '래리어트', startup: .09, active: .18, recover: .34, reach: 40, low: 50, high: 86, hp: 4.4, stun: 24, kb: 230, up: 150, hs: .6, stop: .11, lv: 4, run: 1, carry: .9, wind: 'sp6 hd-4 a30/20 b50/60 t40/40 u-30/30', hit: 'sp16 hd-8 a96/4 b-40/60 t46/20 u-40/30', follow: 'sp26 hd-12 a120/10 b-30/60 t50/24 u-40/20', sfx: 'punch3' },
  shoulder: { name: '숄더 태클', startup: .07, active: .2, recover: .34, reach: 32, low: 30, high: 76, hp: 4, stun: 22, kb: 300, up: 110, hs: .55, stop: .1, lv: 4, run: 1, carry: 1, armor: 1, wind: 'sp30 hd-16 a30/100 b30/90 t40/40 u-30/30', hit: 'sp46 hd-32 a34/116 b24/90 t56/44 u-42/20', sfx: 'punch3' },
  bigboot: { name: '빅 부츠', startup: .1, active: .14, recover: .38, reach: 48, low: 40, high: 84, hp: 4.6, stun: 25, kb: 220, up: 140, hs: .6, stop: .11, lv: 4, run: 1, carry: .6, wind: 'sp-2 hd-2 a20/60 b50/60 t80/90 u-10/20', hit: 'sp-30 hd14 a-40/30 b20/60 t108/4 u-16/10', sfx: 'kick2' },
  slideKick: { name: '슬라이딩', startup: .07, active: .24, recover: .3, reach: 44, low: 0, high: 34, hp: 3.2, stun: 18, kb: 120, up: 160, hs: .5, stop: .08, lv: 4, run: 1, carry: 1.1, lowHit: 1, wind: 'sp10 hd-6 a30/60 b40/60 t50/60 u10/50', hit: 'r-66 sp16 hd20 a-30/20 b40/60 t64/4 u30/70', sfx: 'kick1' },
  bodyBlock: { name: '몸통 박치기', startup: .08, active: .22, recover: .42, reach: 34, low: 10, high: 78, hp: 4.8, stun: 26, kb: 340, up: 120, hs: .6, stop: .12, lv: 4, run: 1, carry: 1, armor: 2, wind: 'sp10 hd-6 a40/60 b50/60 t40/40 u-30/30', hit: 'sp-10 hd-10 a70/60 b80/50 t40/30 u-40/20', sfx: 'belly' },
  flyKnee: { name: '플라잉 니', startup: .09, active: .2, recover: .34, reach: 36, low: 24, high: 80, hp: 4.2, stun: 23, kb: 200, up: 130, hs: .56, stop: .1, lv: 4, run: 1, carry: 1.05, hop: 150, wind: 'sp20 hd-8 a50/60 b60/50 t50/70 u0/40', hit: 'sp-4 hd-8 a20/60 b30/60 t104/122 u-20/50 lift2', sfx: 'kick2' },
  // air
  dropkick: { name: '드롭킥', startup: .07, active: .5, recover: .46, reach: 44, low: -6, high: 52, hp: 4, stun: 23, kb: 250, up: 120, hs: .55, stop: .1, lv: 4, air: 1, push: 120, wind: 'sp30 hd0 a40/60 b50/60 t100/110 u96/110', hit: 'r-78 sp14 hd24 a34/40 b60/40 t78/4 u84/10', sfx: 'kick2', fallBack: 1 },
  flyingElbow: { name: '플라잉 엘보', startup: .08, active: .5, recover: .4, reach: 34, low: -10, high: 60, hp: 3.8, stun: 21, kb: 150, up: 40, hs: .5, stop: .1, lv: 3, air: 1, push: 80, ground: 1, wind: 'sp-14 hd-6 a150/90 b40/50 t30/50 u-10/60', hit: 'r34 sp16 hd-10 a96/120 b120/20 t0/40 u-30/30', sfx: 'punch3' },
  crossbody: { name: '크로스보디', startup: .08, active: .5, recover: .5, reach: 36, low: -16, high: 46, hp: 4.2, stun: 24, kb: 120, up: 60, hs: .6, stop: .1, lv: 4, air: 1, push: 150, ground: 1, wind: 'sp10 hd-6 a120/30 b130/30 t40/50 u20/60', hit: 'r84 sp-8 hd-20 a150/10 b156/10 t-6/20 u6/40', sfx: 'belly', fallFront: 1 },
  axeKick: { name: '공중 뒤꿈치찍기', startup: .1, active: .4, recover: .28, reach: 40, low: -14, high: 60, hp: 3.6, stun: 20, kb: 90, hs: .5, stop: .09, lv: 3, air: 1, push: 60, ground: 1, wind: 'sp-10 hd-6 a30/60 b60/60 t130/10 u-10/50', hit: 'sp24 hd-6 a-20/50 b20/60 t60/2 u-16/50', sfx: 'kick2' },
  buttDrop: { name: '엉덩이 찍기', startup: .09, active: .6, recover: .5, reach: 30, low: -14, high: 40, hp: 5, stun: 24, kb: 100, up: 40, hs: .6, stop: .12, lv: 4, air: 1, push: 20, ground: 1, quake: 70, wind: 'sp10 hd-6 a60/60 b70/60 t70/60 u66/60', hit: 'sp-6 hd-6 a100/20 b110/20 t96/30 u100/36', sfx: 'belly', fallSit: 1 },
  // from the top turnbuckle
  diveElbow: { name: '다이빙 엘보', startup: .1, active: 1.2, recover: .5, reach: 34, low: -20, high: 40, hp: 9, stun: 30, kb: 80, up: 70, hs: .7, stop: .13, lv: 4, air: 1, dive: 1, ground: 1, wind: 'sp-14 hd-8 a160/60 b150/40 t30/40 u0/50', hit: 'r70 sp-10 hd0 a96/124 b150/20 t0/20 u-20/30', sfx: 'punch3', fallFront: 1 },
  diveSplash: { name: '바디 스플래시', startup: .1, active: 1.2, recover: .62, reach: 40, low: -20, high: 36, hp: 10, stun: 32, kb: 60, up: 70, hs: .7, stop: .14, lv: 4, air: 1, dive: 1, ground: 1, wind: 'sp20 hd-10 a60/60 b66/60 t60/90 u50/90', hit: 'r88 sp-10 hd-26 a150/10 b156/10 t-10/14 u0/24', sfx: 'belly', fallFront: 1 },
  diveMoon: { name: '문설트', startup: .1, active: 1.3, recover: .5, reach: 38, low: -20, high: 40, hp: 11, stun: 32, kb: 60, up: 80, hs: .7, stop: .14, lv: 4, air: 1, dive: 1, ground: 1, flip: -450, wind: 'sp-20 hd-14 a160/20 b160/20 t40/60 u30/60', hit: 'r-90 sp-10 hd-20 a150/20 b150/20 t0/30 u10/30', sfx: 'belly', fallFront: 1 },
  diveHead: { name: '다이빙 헤드벗', startup: .1, active: 1.2, recover: .7, reach: 34, low: -20, high: 40, hp: 11, stun: 36, kb: 60, up: 50, hs: .7, stop: .15, lv: 4, air: 1, dive: 1, ground: 1, wind: 'sp30 hd-10 a-20/60 b-10/60 t60/90 u50/90', hit: 'r100 sp6 hd10 a-10/20 b-4/20 t0/10 u6/16', sfx: 'punch3', fallFront: 1 },
  diveQuake: { name: '낙하 방석', startup: .12, active: 1.2, recover: .8, reach: 42, low: -20, high: 40, hp: 13, stun: 40, kb: 100, up: 120, hs: .8, stop: .18, lv: 4, air: 1, dive: 1, ground: 1, quake: 110, wind: 'sp0 hd-10 a150/20 b156/20 t60/90 u50/90', hit: 'sp-6 hd-6 a120/10 b126/10 t96/20 u100/26', sfx: 'belly', fallSit: 1 },
  diveKick: { name: '다이빙 킥', startup: .1, active: 1.2, recover: .5, reach: 42, low: -14, high: 50, hp: 9, stun: 30, kb: 260, up: 100, hs: .7, stop: .13, lv: 4, air: 1, dive: 1, ground: 1, wind: 'sp30 hd0 a40/60 b50/60 t100/110 u96/110', hit: 'r-50 sp10 hd14 a-20/40 b60/40 t96/2 u30/80', sfx: 'kick2', fallBack: 1 },
  // against a downed body
  stomp: { name: '짓밟기', startup: .24, active: .07, recover: .26, reach: 34, low: -8, high: 30, hp: 1.8, stun: 0, kb: 0, hs: .2, stop: .06, lv: 1, ground: 1, floorOnly: 1, clip: 'stomp', sfx: 'kick1' },
  elbowdrop: { name: '엘보 드롭', startup: .42, active: .08, recover: .42, reach: 38, low: -8, high: 30, hp: 3.6, stun: 0, kb: 0, hs: .25, stop: .09, lv: 2, ground: 1, floorOnly: 1, clip: 'elbowdrop', sfx: 'belly' },
};
for (const id in ATTACKS) ATTACKS[id].id = id;

return { BALANCE, ATTACKS };
})();
// ---- combat/arena.js
__m["combat/arena.js"] = (function () {
// Arena geometry and the elastic side ropes. Pure simulation; ArenaRenderer draws it.
const { clamp } = __m["core/util.js"];
class Arena {
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
const ARENAS = {
  hall: { id: 'hall', name: '야항 체육관', desc: '옛 어시장을 고친 연맹의 본거지', crowd: 1, rim: '#4fd6ff', light: 0, tint: [1, 1, 1] },
  gym: { id: 'gym', name: '훈련장 링', desc: '땀 냄새 밴 연습용 링', crowd: 0, rim: '#ffcf8a', light: .04, tint: [1.02, 1, .96] },
  pier: { id: 'pier', name: '부두 특설 링', desc: '네온과 파도가 관객인 야외 링', crowd: .7, rim: '#ff5fa2', light: -.02, tint: [.98, 1, 1.05] },
  dome: { id: 'dome', name: '등대 돔', desc: '챔피언십이 열리는 거대한 돔', crowd: 1.3, rim: '#ffd65a', light: .03, tint: [1.03, 1.01, .98] },
  alley: { id: 'alley', name: '부둣길 뒷골목', desc: '링도 종도 없는 길거리 승부', crowd: .25, rim: '#39e6c0', light: -.06, tint: [.95, 1, 1.05], hasRing: false, x0: 60, x1: 840 },
};

return { Arena, ARENAS };
})();
// ---- data/moves.js
__m["data/moves.js"] = (function () {
// Wrestling moves. One entry = gameplay numbers + a two-person timeline. Add a move by adding an entry.
/* Timeline conventions (attacker faces right, feet at 0,0):
   A  attacker poses   [t, pose, ease]
   V  victim poses     [t, pose, ease]   (victim drawn with facing vf: -1 faces the attacker, 1 same way)
   R  victim pelvis    [t, x, y, rot, ease]  x forward, y up from the mat ('g' = resting on the mat), rot clockwise degrees
   yaw [t, deg] fake spin around the attacker, ax [t, x, y] attacker travel, ik [t0, t1, arm, joint of the victim]
   ev  timed events; hit events carry d = share of the damage. rel = moment the victim is let go. vel = [vx, vy, spin] */
const HOLD_A = 'sp22 hd-10 a62/64 b70/58 t26/30 u-22/22';
const HOLD_V = 'sp48 hd16 a30/30 b44/20 t20/30 u-12/30';
const REAR_A = 'sp12 hd-4 a72/44 b78/40 t24/26 u-20/22';
const REAR_V = 'sp-4 hd10 a30/60 b40/56 t10/18 u-10/20';
const FLAT = 'sp-8 hd-12 a130/10 b110/20 t24/20 u34/30';
const LIMP = 'sp-12 hd-20 a150/20 b140/30 t20/30 u34/40';
const UPSIDE = 'sp4 hd-6 a160/10 b150/14 t12/30 u24/44';
const IDLE = 'sp10 hd-6 a20/90 b55/84 t18/20 u-20/16';

const MOVES = {
  // ------------------------------------------------------------------ common: front
  bodySlam: {
    name: '바디 슬램', pos: 'front', hp: 12, stun: 14, gain: 12, lift: 1, self: .28, desc: '들어 올려 등으로 내리꽂는 기본기. 어느 상황에서나 안정적.',
    dur: 1.16, rel: .92, vf: -1, vel: [40, -120, -1.2], land: 'sup',
    A: [[0, HOLD_A], [.18, 'sp46 hd-22 a52/36 b60/30 t62/84 u18/74', 'io'], [.46, 'sp-8 hd2 a66/74 b74/66 t18/18 u-18/14', 'out'], [.68, 'sp-16 hd-8 a124/46 b128/44 t10/6 u-12/8', 'io'], [.9, 'sp54 hd-14 a58/8 b64/8 t52/62 u-12/52', 'in'], [1.16, IDLE, 'io']],
    V: [[0, HOLD_V], [.18, 'sp24 hd0 a40/20 b60/20 t30/30 u20/30'], [.46, FLAT], [.68, 'sp-14 hd-18 a150/10 b120/10 t30/16 u40/36'], [.9, 'sp-4 hd-10 a140/10 b100/20 t30/20 u20/34']],
    R: [[0, 24, 42, -20], [.18, 22, 40, 10], [.46, 16, 62, 88, 'out'], [.68, 10, 90, 94], [.9, 32, 'g', 92, 'in'], [1.16, 34, 'g', 92]],
    ik: [[.08, .88, 'N', 'pelvis'], [.08, .88, 'F', 'chest']],
    ev: [[.14, 'grunt'], [.42, 'lift'], [.7, 'whoosh'], [.9, 'impact', { p: 1, d: 1, word: '쿵!' }]],
  },
  suplex: {
    name: '수플렉스', pos: 'front', hp: 13, stun: 16, gain: 13, lift: 1.2, self: .42, desc: '뒤로 넘겨 위치를 바꾼다. 로프를 등졌을 때 유용.',
    dur: 1.62, rel: 1.2, vf: -1, vel: [-60, -90, -1], land: 'sup',
    A: [[0, HOLD_A], [.3, 'sp36 hd-14 a82/58 b86/54 t54/72 u6/62', 'io'], [.68, 'sp-10 hd-22 a150/34 b152/32 t10/8 u-16/10', 'out'], [.92, 'sp-16 hd-26 a158/26 b160/26 t14/16 u-18/18', 'io'], [1.18, 'r-84 sp-6 hd-12 a162/8 b162/8 t30/44 u18/54 ox-10', 'in'], [1.62, 'r-88 hd-6 a150/20 b150/20 t24/50 u16/56 ox-10']],
    V: [[0, 'sp62 hd30 a40/30 b30/20 t14/24 u-10/24'], [.3, 'sp66 hd30 a36/40 b30/30 t10/30 u-14/36'], [.68, UPSIDE], [.92, 'sp-4 hd-6 a150/20 b150/10 t4/10 u14/24'], [1.18, FLAT]],
    R: [[0, 24, 42, -30], [.3, 22, 46, -44], [.68, 10, 112, -176, 'out'], [.92, 2, 114, -186], [1.18, -58, 'g', -268, 'in'], [1.62, -60, 'g', -270]],
    ik: [[0, 1.16, 'N', 'neck'], [.2, 1.16, 'F', 'pelvis']],
    ev: [[.26, 'grunt'], [.62, 'lift'], [.96, 'whoosh'], [1.18, 'impact', { p: 1.15, d: 1, word: '쿠당!' }]],
  },
  ddt: {
    name: 'DDT', pos: 'front', hp: 11, stun: 20, gain: 11, lift: 0, self: .34, desc: '발동이 가장 빠른 머리 찍기. 무거운 상대에게도 통한다.',
    dur: 1.1, rel: .74, vf: -1, vel: [10, -50, -2.4], land: 'prone',
    A: [[0, 'sp28 hd-8 a84/74 b86/66 t26/30 u-22/22'], [.18, 'sp10 hd-10 a80/80 b84/74 t40/30 u-10/30', 'io'], [.42, 'r-84 sp-4 hd10 a80/74 b76/66 t28/34 u8/46 ox-8', 'in'], [.8, 'r-88 hd-6 a60/60 b60/50 t24/44 u12/50 ox-8'], [1.1, 'r-88 hd-6 a60/60 b60/50 t24/44 u12/50 ox-8']],
    V: [[0, 'sp70 hd26 a30/30 b20/30 t12/22 u-10/22'], [.18, 'sp72 hd26 a36/30 b26/30 t10/24 u-12/24'], [.42, 'sp24 hd30 a130/20 b120/24 t-6/20 u6/30'], [.62, 'sp10 hd20 a140/14 b130/20 t-10/20 u0/34'], [.9, 'sp4 hd-6 a150/20 b140/20 t0/10 u4/8']],
    R: [[0, 24, 42, -20], [.18, 24, 44, -26], [.42, 18, 'g', -138, 'in'], [.62, 20, 'g', -156, 'out'], [.9, 40, 'g', -92, 'in'], [1.1, 40, 'g', -90]],
    ik: [[0, .74, 'N', 'neck'], [0, .74, 'F', 'head']],
    ev: [[.16, 'whoosh'], [.42, 'impact', { p: 1, d: 1, word: '콱!' }]],
  },
  piledriver: {
    name: '파일드라이버', pos: 'front', hp: 19, stun: 22, gain: 16, lift: 1.5, self: .6, desc: '거꾸로 세워 꽂는다. 피해가 크지만 회복이 길다.',
    dur: 1.86, rel: 1.46, vf: -1, vel: [30, -70, 1.6], land: 'sup',
    A: [[0, HOLD_A], [.28, 'sp54 hd-24 a52/30 b58/28 t46/58 u0/52', 'io'], [.66, 'sp-2 hd-2 a52/66 b58/60 t16/14 u-16/14', 'out'], [.92, 'sp-8 hd-10 a54/70 b60/62 t12/8 u-14/8', 'io'], [1.08, 'sp6 hd-6 a52/66 b58/60 t60/80 u50/90 lift18', 'out'], [1.24, 'sp4 hd0 a50/66 b56/60 t88/8 u94/12', 'in'], [1.6, 'sp8 hd4 a44/60 b50/56 t88/10 u94/14'], [1.86, 'sp8 hd4 a30/60 b40/56 t84/16 u90/20']],
    V: [[0, HOLD_V], [.28, 'sp70 hd20 a30/20 b20/20 t6/20 u-10/26'], [.66, UPSIDE], [.92, 'sp2 hd-4 a158/14 b148/20 t6/24 u20/40'], [1.24, 'sp16 hd24 a120/20 b110/30 t20/40 u40/60'], [1.6, 'sp20 hd30 a110/30 b100/40 t30/30 u50/50']],
    R: [[0, 24, 42, -24], [.28, 22, 44, -96], [.66, 17, 66, -180, 'out'], [.92, 16, 68, -180], [1.08, 16, 84, -180], [1.24, 18, 'g', -180, 'in'], [1.6, 24, 'g', -170], [1.86, 40, 'g', -110]],
    ik: [[.2, 1.4, 'N', 'pelvis'], [.2, 1.4, 'F', 'chest']],
    ev: [[.24, 'grunt'], [.58, 'lift'], [1.06, 'whoosh'], [1.24, 'impact', { p: 1.5, d: 1, word: '쾅!' }]],
  },
  powerbomb: {
    name: '파워밤', pos: 'front', hp: 18, stun: 18, gain: 16, lift: 1.5, self: .46, desc: '어깨까지 들어 올려 내리꽂는다. 충돌 충격이 주위에 퍼진다.',
    dur: 1.56, rel: 1.16, vf: -1, vel: [90, -130, -1], land: 'sup', quake: 46,
    A: [[0, HOLD_A], [.26, 'sp50 hd-22 a56/30 b60/28 t50/66 u4/60', 'io'], [.66, 'sp-8 hd-6 a150/26 b154/24 t12/10 u-16/10', 'out'], [.9, 'sp-14 hd-12 a156/22 b160/20 t12/8 u-16/8', 'io'], [1.12, 'sp58 hd-16 a56/6 b60/6 t54/66 u-14/58', 'in'], [1.34, 'sp50 hd-12 a52/14 b56/14 t50/60 u-12/54'], [1.56, IDLE, 'io']],
    V: [[0, HOLD_V], [.26, 'sp66 hd20 a30/20 b20/20 t10/20 u-10/24'], [.66, 'sp-6 hd-4 a60/50 b70/40 t84/60 u90/64'], [.9, 'sp-16 hd-14 a90/30 b100/30 t84/50 u92/56'], [1.12, 'sp26 hd34 a140/20 b130/20 t96/24 u104/34'], [1.34, 'sp10 hd10 a140/20 b130/20 t60/40 u70/50']],
    R: [[0, 24, 42, -30], [.26, 20, 46, -104], [.46, 22, 80, -60], [.66, 14, 108, 2, 'out'], [.9, 10, 112, -6], [1.12, 36, 'g', 104, 'in'], [1.56, 40, 'g', 92]],
    ik: [[.2, 1.14, 'N', 'pelvis'], [.2, 1.14, 'F', 'pN']],
    ev: [[.2, 'grunt'], [.6, 'lift'], [.94, 'whoosh'], [1.12, 'impact', { p: 1.5, d: 1, word: '콰앙!' }]],
  },
  chokeslam: {
    name: '초크슬램', pos: 'front', hp: 17, stun: 18, gain: 15, lift: 1.7, self: .4, desc: '한 손으로 들어 올려 내리친다. 큰 선수일수록 높이 올라간다.',
    dur: 1.5, rel: 1.14, vf: -1, vel: [70, -150, -1], land: 'sup',
    A: [[0, 'sp10 hd-6 a84/10 b20/60 t20/20 u-20/16'], [.3, 'sp16 hd-4 a86/14 b30/50 t30/36 u-18/30', 'io'], [.62, 'sp-12 hd-14 a146/4 b110/30 t10/6 u-14/8', 'out'], [.9, 'sp-14 hd-16 a150/4 b116/26 t10/6 u-14/8', 'io'], [1.1, 'sp62 hd-18 a52/2 b20/50 t58/66 u-18/62', 'in'], [1.3, 'sp54 hd-12 a50/8 b20/50 t54/62 u-16/58'], [1.5, IDLE, 'io']],
    V: [[0, 'sp-8 hd-18 a72/96 b80/92 t6/8 u-6/10'], [.3, 'sp-4 hd-20 a74/100 b82/96 t10/14 u-4/16'], [.62, 'sp-8 hd-16 a66/104 b70/100 t14/40 u-4/30'], [.9, 'sp-10 hd-18 a66/104 b70/100 t-4/30 u16/44'], [1.1, FLAT]],
    R: [[0, 32, 43, 0], [.3, 32, 43, 2], [.62, 30, 88, 8, 'out'], [.9, 28, 92, 10], [1.1, 42, 'g', 94, 'in'], [1.5, 44, 'g', 92]],
    ik: [[0, 1.1, 'N', 'neck']], ikV: [[.06, 1.0, 'both', 'A:hN']],
    ev: [[.1, 'grip'], [.56, 'lift'], [.92, 'whoosh'], [1.1, 'impact', { p: 1.4, d: 1, word: '쾅!' }]],
  },
  irishWhip: {
    name: '아이리시 휩', pos: 'front', hp: 0, stun: 6, gain: 4, lift: 0, self: .1, desc: '상대를 로프로 보낸다. 튕겨 돌아올 때 반격할 기회.', tags: ['whip'],
    dur: .62, rel: .4, vf: -1, vel: [300, 0, 0], whip: 1,
    A: [[0, 'sp14 hd-8 a80/20 b60/40 t26/30 u-22/22'], [.2, 'sp-18 hd-6 a40/60 b30/70 t10/24 u-30/10', 'io'], [.4, 'sp30 hd-14 a98/0 b20/60 t44/30 u-34/8', 'in'], [.62, IDLE, 'io']],
    V: [[0, 'sp20 hd6 a84/10 b20/40 t20/24 u-16/24'], [.2, 'sp34 hd10 a96/0 b30/40 t30/30 u-20/40'], [.4, 'sp10 hd0 a-30/10 b20/30 t-30/30 u40/20']],
    R: [[0, 34, 43, 0], [.2, 24, 43, -8], [.4, 44, 43, 10, 'in'], [.62, 60, 43, 10]],
    ik: [[0, .4, 'N', 'hN']],
    ev: [[.22, 'whoosh'], [.4, 'release']],
  },
  ringOut: {
    name: '링아웃 던지기', pos: 'any', hp: 8, stun: 22, gain: 12, lift: 1.4, self: .3, desc: '로프 가까이에서 상대를 톱로프 너머로 던진다.', need: 'rope', tags: ['ringout'],
    dur: 1.2, rel: .84, vf: -1, vel: [300, -250, 5], toRope: 1,
    A: [[0, HOLD_A], [.2, 'sp46 hd-22 a52/36 b60/30 t62/84 u18/74', 'io'], [.52, 'sp-8 hd-14 a168/8 b164/10 t12/10 u-14/10', 'out'], [.68, 'sp-22 hd-18 a178/10 b174/12 t20/20 u-20/20', 'io'], [.84, 'sp34 hd-14 a118/0 b122/0 t44/26 u-34/8', 'in'], [1.2, IDLE, 'io']],
    V: [[0, HOLD_V], [.2, 'sp24 hd0 a40/20 b60/20 t30/30 u20/30'], [.52, 'sp-10 hd-16 a140/20 b100/40 t30/20 u50/40'], [.84, 'sp-16 hd-18 a160/10 b140/20 t40/20 u10/40']],
    R: [[0, 24, 42, -20], [.2, 22, 40, 10], [.52, 4, 104, 88, 'out'], [.68, -2, 106, 86], [.84, 34, 100, 100, 'in']],
    ik: [[.1, .84, 'N', 'pelvis'], [.1, .84, 'F', 'chest']],
    ev: [[.16, 'grunt'], [.46, 'lift'], [.82, 'whoosh'], [.84, 'release'], [.86, 'hit', { d: 1 }]],
  },
  giantSwing: {
    name: '자이언트 스윙', pos: 'front', hp: 14, stun: 24, gain: 15, lift: 1.5, self: .5, desc: '발을 잡고 돌린다. 휘말린 다른 선수도 쓰러진다.', sweep: 64, tags: ['swing'],
    dur: 2.5, rel: 2.14, vf: -1, vel: [340, -170, -6], land: 'sup',
    A: [[0, HOLD_A], [.26, 'sp52 hd-20 a50/20 b54/20 t46/58 u6/56', 'io'], [.56, 'sp-18 hd-6 a84/8 b88/8 t28/34 u-14/34', 'io'], [2.0, 'sp-22 hd-8 a86/6 b90/6 t28/34 u-14/34'], [2.14, 'sp24 hd-10 a100/0 b104/0 t40/24 u-32/8', 'in'], [2.5, IDLE, 'io']],
    V: [[0, HOLD_V], [.26, 'sp0 hd-6 a120/20 b100/20 t10/10 u6/12'], [.56, 'sp-6 hd-14 a158/8 b150/10 t2/4 u6/6'], [2.1, 'sp-10 hd-20 a166/4 b160/6 t0/2 u4/4']],
    R: [[0, 24, 42, 0], [.26, 52, 18, 80], [.56, 66, 34, 82], [1.2, 70, 50, 84], [2.0, 72, 58, 86], [2.14, 72, 60, 90]],
    yaw: [[.56, 0], [2.14, 1440, 'in']],
    ik: [[.2, 2.12, 'N', 'aN'], [.2, 2.12, 'F', 'aF']],
    ev: [[.2, 'grunt'], [.7, 'spin'], [1.1, 'spin'], [1.4, 'spin'], [1.65, 'spin'], [1.85, 'spin'], [2.02, 'spin'], [2.14, 'release'], [2.16, 'hit', { d: 1 }]],
  },
  // ------------------------------------------------------------------ common: rear
  german: {
    name: '저먼 수플렉스', pos: 'rear', hp: 18, stun: 20, gain: 16, lift: 1.3, self: .5, desc: '뒤에서 허리를 감아 넘긴다. 높은 피해.',
    dur: 1.44, rel: 1.02, vf: 1, vel: [-70, -80, -1.4], land: 'sup',
    A: [[0, REAR_A], [.26, 'sp20 hd-4 a78/46 b80/42 t58/74 u8/64', 'io'], [.5, 'r-14 sp-30 hd-18 a88/24 b90/22 t22/32 u-12/34', 'out'], [.74, 'r-60 sp-50 hd-44 a118/10 b120/10 t72/98 u62/98 ox-12', 'in'], [1.1, 'r-60 sp-50 hd-46 a118/12 b120/12 t72/98 u62/98 ox-12'], [1.44, 'r-80 sp-10 hd-10 a110/20 b110/20 t50/80 u40/80 ox-12']],
    V: [[0, REAR_V], [.26, 'sp6 hd6 a40/60 b50/50 t20/40 u6/44'], [.5, 'sp-18 hd-20 a90/20 b100/20 t40/30 u30/44'], [.74, 'sp36 hd50 a150/20 b140/20 t84/24 u96/34'], [1.1, 'sp36 hd50 a140/30 b130/30 t80/30 u92/40']],
    R: [[0, 17, 44, 0], [.26, 17, 42, -4], [.5, 6, 88, -66, 'out'], [.62, -18, 92, -120], [.74, -50, 'g', -188, 'in'], [1.1, -52, 'g', -190], [1.44, -72, 'g', -262]],
    ik: [[0, 1.02, 'N', 'pelvis'], [0, 1.02, 'F', 'pelvis']],
    ev: [[.2, 'grunt'], [.48, 'lift'], [.58, 'whoosh'], [.74, 'impact', { p: 1.35, d: 1, word: '콰당!' }]],
  },
  bulldog: {
    name: '불도그', pos: 'rear', hp: 11, stun: 18, gain: 11, lift: 0, self: .3, desc: '뒤에서 머리를 잡고 뛰어 얼굴을 찍는다. 빠르다.',
    dur: .98, rel: .72, vf: 1, vel: [40, -60, 1], land: 'prone',
    A: [[0, REAR_A], [.2, 'sp10 hd-4 a110/60 b70/50 t40/60 u-20/40', 'io'], [.38, 'sp26 hd-10 a96/60 b60/60 t60/50 u30/70 lift16 ox10', 'out'], [.56, 'sp30 hd-14 a70/50 b30/60 t88/20 u84/40 ox26', 'in'], [.98, 'sp20 hd-10 a50/50 b30/60 t84/30 u80/50 ox26']],
    V: [[0, REAR_V], [.2, 'sp20 hd10 a20/40 b30/40 t14/24 u-10/24'], [.38, 'sp34 hd20 a60/20 b70/20 t-10/30 u10/40'], [.56, 'sp4 hd-10 a160/20 b150/30 t-4/10 u4/14'], [.98, 'sp4 hd-6 a156/30 b146/40 t0/8 u4/8']],
    R: [[0, 17, 44, 0], [.2, 22, 44, 10], [.38, 30, 52, 44], [.56, 46, 'g', 90, 'in'], [.98, 46, 'g', 90]],
    ik: [[.1, .66, 'N', 'head']],
    ev: [[.18, 'whoosh'], [.56, 'impact', { p: .95, d: 1, word: '퍽!' }]],
  },
  backdropDriver: {
    name: '백드롭', pos: 'rear', hp: 15, stun: 18, gain: 13, lift: 1.1, self: .4, desc: '옆구리에 끼고 뒤로 젖혀 넘긴다. 균형형.',
    dur: 1.3, rel: .92, vf: 1, vel: [-60, -70, -1], land: 'sup',
    A: [[0, REAR_A], [.24, 'sp26 hd-8 a70/50 b60/50 t54/70 u4/60', 'io'], [.5, 'sp-16 hd-14 a100/30 b96/30 t16/16 u-18/14', 'out'], [.74, 'r-84 sp-4 hd-10 a110/10 b108/10 t30/40 u16/50 ox-8', 'in'], [1.3, 'r-88 hd-6 a90/20 b90/20 t24/46 u14/52 ox-8']],
    V: [[0, REAR_V], [.24, 'sp10 hd6 a40/50 b50/40 t20/40 u6/44'], [.5, 'sp-10 hd-10 a80/30 b100/20 t60/30 u40/50'], [.74, FLAT]],
    R: [[0, 17, 44, 0], [.24, 18, 44, -6], [.5, 14, 92, -58, 'out'], [.74, -46, 'g', -100, 'in'], [1.3, -48, 'g', -90]],
    ik: [[0, .9, 'N', 'pelvis'], [0, .9, 'F', 'kN']],
    ev: [[.2, 'grunt'], [.46, 'lift'], [.74, 'impact', { p: 1.15, d: 1, word: '쿵!' }]],
  },
  atomic: {
    name: '꼬리뼈 떨구기', pos: 'rear', hp: 10, stun: 24, gain: 11, lift: .9, self: .24, desc: '들어 올려 무릎에 떨어뜨린다. 기절 피해가 크고 회복이 빠르다.',
    dur: 1.0, rel: .72, vf: 1, vel: [110, -60, 0], land: 'prone', stagger: 1,
    A: [[0, REAR_A], [.22, 'sp24 hd-6 a70/50 b66/50 t50/66 u4/60', 'io'], [.46, 'sp-12 hd-12 a104/40 b100/40 t14/14 u-16/14', 'out'], [.6, 'sp8 hd-4 a76/60 b72/60 t84/100 u-16/16', 'in'], [1.0, IDLE, 'io']],
    V: [[0, REAR_V], [.22, 'sp8 hd6 a40/50 b50/40 t30/50 u20/54'], [.46, 'sp-8 hd-10 a60/60 b70/50 t60/70 u50/74'], [.6, 'sp-20 hd-30 a120/30 b126/30 t60/40 u30/60'], [.9, 'sp20 hd10 a-20/40 b-30/40 t20/30 u-20/30']],
    R: [[0, 17, 44, 0], [.22, 17, 44, 0], [.46, 16, 84, -8, 'out'], [.6, 24, 52, 4, 'in'], [.72, 30, 58, 8], [.9, 46, 43, 6]],
    ik: [[0, .66, 'N', 'pelvis'], [0, .66, 'F', 'pF']],
    ev: [[.2, 'grunt'], [.42, 'lift'], [.6, 'impact', { p: .9, d: 1, word: '빡!' }]],
  },
  // ------------------------------------------------------------------ catches and counters
  backBody: {
    name: '백 바디 드롭', pos: 'catch', hp: 13, stun: 18, gain: 12, lift: .8, self: .3, desc: '달려오는 상대를 등 너머로 넘긴다.',
    dur: 1.0, rel: .7, vf: -1, vel: [-70, -60, -2], land: 'sup',
    A: [[0, 'sp30 hd-10 a40/40 b50/40 t40/50 u0/50'], [.14, 'sp66 hd0 a20/30 b30/30 t56/70 u10/64', 'io'], [.34, 'sp-10 hd-10 a120/30 b126/26 t12/10 u-16/12', 'out'], [1.0, IDLE, 'io']],
    V: [[0, 'sp30 hd0 a60/30 b40/30 t40/30 u-30/30'], [.14, 'sp50 hd10 a90/20 b80/20 t20/30 u-10/40'], [.36, 'sp-10 hd-20 a140/20 b150/20 t30/40 u50/50'], [.7, FLAT]],
    R: [[0, 22, 43, -10], [.14, 10, 58, -60], [.36, -14, 112, -160, 'out'], [.7, -64, 'g', -268, 'in'], [1.0, -64, 'g', -270]],
    ev: [[.12, 'grunt'], [.3, 'lift'], [.4, 'whoosh'], [.7, 'impact', { p: 1.1, d: 1, word: '쿵!' }]],
  },
  spinebuster: {
    name: '스파인버스터', pos: 'catch', hp: 15, stun: 18, gain: 13, lift: 1.2, self: .34, desc: '달려오는 상대를 끌어안아 그대로 메다꽂는다.',
    dur: 1.02, rel: .7, vf: -1, vel: [50, -90, -1], land: 'sup',
    A: [[0, 'sp24 hd-8 a70/40 b76/36 t40/50 u0/40'], [.16, 'sp14 hd-6 a72/56 b78/50 t30/40 u-18/30', 'io'], [.36, 'sp-12 hd-8 a88/52 b92/48 t14/10 u-18/10', 'out'], [.62, 'sp62 hd-20 a56/10 b60/10 t70/90 u-20/76', 'in'], [1.02, IDLE, 'io']],
    V: [[0, 'sp24 hd0 a60/30 b40/30 t40/30 u-30/30'], [.16, 'sp20 hd0 a70/40 b60/40 t60/60 u40/60'], [.36, 'sp-4 hd-10 a80/30 b90/30 t80/60 u70/66'], [.62, 'sp-4 hd-10 a140/10 b120/20 t60/50 u50/60']],
    R: [[0, 24, 43, 0], [.16, 17, 54, 6], [.36, 16, 78, 4, 'out'], [.62, 34, 'g', 96, 'in'], [1.02, 36, 'g', 92]],
    ik: [[.08, .62, 'N', 'pelvis'], [.08, .62, 'F', 'pelvis']],
    ev: [[.1, 'grunt'], [.32, 'lift'], [.62, 'impact', { p: 1.2, d: 1, word: '콰쾅!' }]],
  },
  hipToss: {
    name: '힙 토스', pos: 'counter', hp: 8, stun: 18, gain: 12, lift: 0, self: .2, desc: '공격을 흘려 허리 너머로 던지는 반격기.',
    dur: .78, rel: .52, vf: -1, vel: [-120, -90, -3], land: 'sup',
    A: [[0, 'sp14 hd-8 a90/10 b70/40 t24/24 u-22/20'], [.14, 'sp20 hd-10 a100/40 b60/60 t40/40 u-16/40', 'io'], [.34, 'sp50 hd-10 a40/50 b20/60 t46/54 u0/50', 'io'], [.78, IDLE, 'io']],
    V: [[0, 'sp24 hd0 a96/0 b30/60 t34/20 u-26/10'], [.14, 'sp40 hd10 a100/0 b50/40 t20/30 u-20/40'], [.32, 'sp0 hd-10 a140/10 b130/20 t40/40 u60/50'], [.52, FLAT]],
    R: [[0, 30, 43, 0], [.14, 18, 54, -40], [.32, -2, 92, -150, 'out'], [.52, -52, 'g', -262, 'in'], [.78, -56, 'g', -270]],
    ik: [[0, .4, 'N', 'hN']],
    ev: [[.1, 'whoosh'], [.52, 'impact', { p: .85, d: 1, word: '철퍽!' }]],
  },
  armDrag: {
    name: '암 드래그', pos: 'counter', hp: 6, stun: 14, gain: 10, lift: 0, self: .12, desc: '팔을 감아 굴리는 빠른 반격기.',
    dur: .7, rel: .46, vf: -1, vel: [-150, -70, -4], land: 'sup',
    A: [[0, 'sp20 hd-8 a90/20 b80/30 t30/40 u-20/30'], [.16, 'r-30 sp-10 hd-6 a100/30 b90/30 t60/70 u40/80 ox-4', 'io'], [.34, 'r-80 sp0 hd-10 a130/10 b120/20 t60/60 u40/70 ox-10', 'io'], [.7, 'sp24 hd-10 a30/70 b50/70 t60/80 u10/70 ox-10', 'io']],
    V: [[0, 'sp24 hd0 a96/0 b30/60 t34/20 u-26/10'], [.16, 'sp40 hd10 a110/0 b70/20 t20/30 u-10/50'], [.32, 'sp10 hd20 a130/10 b130/20 t60/40 u70/60'], [.46, FLAT]],
    R: [[0, 30, 43, 0], [.16, 14, 52, -50], [.32, -16, 66, -170, 'out'], [.46, -58, 'g', -270, 'in']],
    ik: [[0, .38, 'N', 'hN'], [0, .38, 'F', 'eN']],
    ev: [[.08, 'whoosh'], [.46, 'impact', { p: .7, d: 1, word: '휙!' }]],
  },
  // ------------------------------------------------------------------ learnable / signature
  backbreaker: {
    name: '백브레이커', pos: 'front', hp: 14, stun: 22, gain: 13, lift: 1.1, self: .34, desc: '무릎 위로 등을 떨어뜨린다. 기절 피해가 크다.',
    dur: 1.22, rel: .96, vf: -1, vel: [50, -40, .6], land: 'sup',
    A: [[0, HOLD_A], [.18, 'sp46 hd-22 a52/36 b60/30 t62/84 u18/74', 'io'], [.48, 'sp-12 hd-4 a96/60 b100/54 t16/14 u-18/14', 'out'], [.74, 'sp26 hd-8 a52/40 b58/36 t92/96 u-10/96', 'in'], [1.0, 'sp24 hd-8 a50/40 b56/36 t92/96 u-10/96'], [1.22, IDLE, 'io']],
    V: [[0, HOLD_V], [.18, 'sp24 hd0 a40/20 b60/20 t30/30 u20/30'], [.48, FLAT], [.74, 'sp-34 hd-30 a150/10 b130/20 t-10/50 u0/60'], [1.0, 'sp-30 hd-26 a150/20 b130/30 t-6/60 u4/66']],
    R: [[0, 24, 42, -20], [.18, 22, 40, 10], [.48, 14, 78, 90, 'out'], [.74, 20, 32, 92, 'in'], [1.0, 22, 32, 92], [1.22, 34, 'g', 92]],
    ik: [[.08, 1.0, 'N', 'pelvis'], [.08, 1.0, 'F', 'chest']],
    ev: [[.16, 'grunt'], [.44, 'lift'], [.74, 'impact', { p: 1.1, d: 1, word: '우둑!' }]],
  },
  airplane: {
    name: '에어플레인 스핀', pos: 'front', hp: 13, stun: 28, gain: 14, lift: 1.6, self: .6, desc: '어깨에 메고 돌린다. 상대는 어질어질.', sweep: 40, tags: ['swing'],
    dur: 2.24, rel: 1.92, vf: -1, vel: [80, -100, 1], land: 'sup',
    A: [[0, HOLD_A], [.22, 'sp50 hd-22 a54/30 b60/28 t60/82 u16/72', 'io'], [.56, 'sp4 hd10 a140/60 b144/56 t16/16 u-18/16', 'out'], [1.6, 'sp2 hd12 a142/58 b146/54 t16/16 u-18/16'], [1.9, 'sp40 hd-10 a80/10 b84/10 t40/44 u-20/40', 'in'], [2.24, IDLE, 'io']],
    V: [[0, HOLD_V], [.22, 'sp30 hd0 a40/20 b60/20 t30/30 u20/30'], [.56, 'sp30 hd20 a100/20 b110/20 t40/30 u50/40'], [1.6, 'sp30 hd20 a110/10 b120/10 t44/24 u54/34'], [1.9, FLAT]],
    R: [[0, 24, 42, -20], [.22, 20, 46, -60], [.56, 0, 88, -90, 'out'], [1.6, 0, 88, -90], [1.9, 40, 'g', 92, 'in']],
    yaw: [[.5, 0], [1.62, 1080, 'io']],
    ik: [[.2, 1.8, 'N', 'kN'], [.2, 1.8, 'F', 'chest']],
    ev: [[.2, 'grunt'], [.7, 'spin'], [.95, 'spin'], [1.15, 'spin'], [1.35, 'spin'], [1.9, 'impact', { p: 1, d: 1, word: '쿵!' }]],
  },
  bellyToBelly: {
    name: '안아 던지기', pos: 'front', hp: 14, stun: 16, gain: 13, lift: 1.1, self: .3, desc: '가슴을 맞대고 옆으로 던진다.',
    dur: 1.1, rel: .74, vf: -1, vel: [-90, -110, -2], land: 'sup',
    A: [[0, HOLD_A], [.24, 'sp14 hd-6 a76/56 b80/52 t44/60 u0/50', 'io'], [.5, 'sp-26 hd-20 a110/30 b112/30 t20/20 u-20/18', 'out'], [.72, 'r-70 sp-10 hd-10 a130/10 b130/10 t40/40 u20/50 ox-8', 'in'], [1.1, 'r-84 hd-6 a110/20 b110/20 t30/50 u16/56 ox-8']],
    V: [[0, HOLD_V], [.24, 'sp10 hd0 a60/60 b70/50 t10/20 u-6/24'], [.5, 'sp-4 hd-10 a90/20 b100/20 t30/30 u20/40'], [.72, FLAT]],
    R: [[0, 24, 42, -20], [.24, 18, 46, -6], [.5, 4, 92, -80, 'out'], [.74, -56, 'g', -262, 'in'], [1.1, -58, 'g', -270]],
    ik: [[0, .7, 'N', 'pelvis'], [0, .7, 'F', 'chest']],
    ev: [[.2, 'grunt'], [.46, 'lift'], [.74, 'impact', { p: 1.1, d: 1, word: '쿵!' }]],
  },
  cornerSmash: {
    name: '코너 들이받기', pos: 'any', hp: 12, stun: 20, gain: 12, lift: .6, self: .24, desc: '로프 앞에서 상대를 턴버클에 들이받는다.', need: 'rope', toRope: 1,
    dur: .96, rel: .66, vf: -1, vel: [-60, -70, 1], land: 'prone', stagger: 1, push: 1,
    A: [[0, HOLD_A], [.16, 'sp34 hd-14 a70/40 b76/36 t40/50 u-20/30', 'io'], [.46, 'sp50 hd-24 a76/20 b80/18 t60/40 u-44/10', 'in'], [.6, 'sp52 hd-20 a78/16 b82/14 t62/40 u-46/8'], [.96, IDLE, 'io']],
    V: [[0, HOLD_V], [.16, 'sp0 hd0 a60/30 b70/30 t10/30 u-10/30'], [.46, 'sp-20 hd-24 a120/20 b130/20 t30/40 u10/40'], [.6, 'sp-16 hd-30 a90/30 b100/30 t20/40 u0/44']],
    R: [[0, 24, 42, 0], [.16, 22, 46, 0], [.46, 26, 48, 6], [.66, 26, 46, 4], [.96, 30, 43, 0]],
    ik: [[.06, .5, 'N', 'pelvis'], [.06, .5, 'F', 'chest']],
    ev: [[.1, 'grunt'], [.46, 'impact', { p: 1.1, d: 1, word: '쾅!', wall: 1 }]],
  },
  slapFest: {
    name: '왕복 따귀', pos: 'front', hp: 12, stun: 26, gain: 14, lift: 0, self: .2, desc: '철썩철썩 왕복으로 때린다. 기절 피해 최고.',
    dur: 1.36, rel: 1.16, vf: -1, vel: [150, -120, -2], land: 'sup',
    A: [[0, 'sp10 hd-6 a70/30 b60/60 t24/26 u-20/22'], [.18, 'sp-8 hd-6 a-40/10 b60/60 t20/22 u-22/20', 'out'], [.28, 'sp18 hd-8 a104/0 b50/60 t26/26 u-22/18', 'in'], [.46, 'sp20 hd-8 a150/20 b50/60 t26/26 u-22/18', 'out'], [.56, 'sp8 hd-6 a80/0 b50/60 t24/24 u-22/18', 'in'], [.74, 'sp-8 hd-6 a-40/10 b60/60 t20/22 u-22/20', 'out'], [.84, 'sp18 hd-8 a104/0 b50/60 t26/26 u-22/18', 'in'], [1.0, 'sp-20 hd-10 a-70/20 b60/60 t14/22 u-26/16', 'out'], [1.12, 'sp30 hd-12 a120/0 b20/60 t42/26 u-32/8', 'in'], [1.36, IDLE, 'io']],
    V: [[0, 'sp0 hd0 a20/40 b30/40 t10/14 u-10/16'], [.28, 'sp-10 hd-30 a30/40 b40/40 t14/18 u-12/14'], [.5, 'sp0 hd10 a20/40 b30/40 t10/14 u-10/16'], [.57, 'sp10 hd30 a20/40 b30/40 t12/18 u-12/18'], [.78, 'sp0 hd0 a20/40 b30/40 t10/14 u-10/16'], [.85, 'sp-12 hd-34 a30/40 b40/40 t16/18 u-12/14'], [1.06, 'sp4 hd4 a10/30 b20/30 t10/20 u-10/20'], [1.14, 'sp-24 hd-36 a60/30 b80/20 t30/20 u-20/10']],
    R: [[0, 36, 43, 0], [1.1, 36, 43, 0], [1.16, 42, 50, 14]],
    ev: [[.28, 'smack', { d: .2, word: '찰싹!' }], [.56, 'smack', { d: .2, word: '철썩!' }], [.84, 'smack', { d: .2, word: '찰싹!' }], [1.12, 'impact', { p: 1, d: .4, word: '철썩!!' }]],
  },
  anchorHold: {
    name: '닻줄 조르기', pos: 'rear', hp: 13, stun: 20, gain: 14, lift: 0, self: .24, desc: '뒤에서 감아 조인다. 지속 피해 후 놓아준다.',
    dur: 1.9, rel: 1.66, vf: 1, vel: [40, -30, .6], land: 'prone',
    A: [[0, REAR_A], [.3, 'r-40 sp20 hd0 a90/80 b96/70 t80/60 u60/80', 'io'], [1.5, 'r-44 sp18 hd-6 a92/86 b98/76 t84/60 u64/80'], [1.9, 'sp30 hd-10 a30/70 b50/70 t60/90 u20/80', 'io']],
    V: [[0, REAR_V], [.3, 'sp0 hd-20 a60/90 b66/90 t60/40 u40/60'], [.7, 'sp-6 hd-24 a80/90 b86/90 t50/60 u60/30'], [1.1, 'sp0 hd-18 a60/90 b66/90 t64/30 u40/70'], [1.5, 'sp-4 hd-24 a70/90 b76/90 t50/60 u56/40']],
    R: [[0, 17, 44, 0], [.3, 14, 'g', -20], [1.5, 14, 'g', -22], [1.9, 30, 'g', 60]],
    ik: [[.1, 1.6, 'N', 'neck'], [.1, 1.6, 'F', 'neck']],
    ev: [[.3, 'grip'], [.6, 'squeeze', { d: .25 }], [.95, 'squeeze', { d: .25 }], [1.3, 'squeeze', { d: .25 }], [1.6, 'squeeze', { d: .25, word: '으윽!' }]],
  },
  gutBuster: {
    name: '파도 방아', pos: 'front', hp: 15, stun: 18, gain: 14, lift: 1.3, self: .4, desc: '거꾸로 들어 파도처럼 앞으로 무너뜨린다.',
    dur: 1.3, rel: 1.0, vf: -1, vel: [50, -80, 1], land: 'sup',
    A: [[0, HOLD_A], [.24, 'sp52 hd-22 a52/30 b58/28 t50/64 u4/58', 'io'], [.6, 'sp-6 hd-4 a56/70 b62/64 t14/12 u-16/12', 'out'], [.78, 'sp-14 hd-8 a60/70 b66/64 t10/8 u-16/8 lift4', 'io'], [.98, 'sp70 hd-30 a60/50 b66/44 t80/100 u60/100', 'in'], [1.3, IDLE, 'io']],
    V: [[0, HOLD_V], [.24, 'sp70 hd20 a30/20 b20/20 t6/20 u-10/26'], [.6, UPSIDE], [.98, FLAT]],
    R: [[0, 24, 42, -24], [.24, 22, 44, -96], [.6, 18, 70, -180, 'out'], [.78, 14, 74, -184], [.98, 38, 'g', -268, 'in'], [1.3, 40, 'g', -270]],
    ik: [[.2, .96, 'N', 'pelvis'], [.2, .96, 'F', 'chest']],
    ev: [[.2, 'grunt'], [.56, 'lift'], [.98, 'impact', { p: 1.25, d: 1, word: '철푸덕!' }]],
  },
  headDrop: {
    name: '방아깨비', pos: 'front', hp: 13, stun: 22, gain: 13, lift: .6, self: .3, desc: '뛰어올라 목을 감고 함께 떨어진다.',
    dur: 1.06, rel: .74, vf: -1, vel: [30, -70, -2], land: 'prone',
    A: [[0, HOLD_A], [.18, 'sp30 hd-10 a84/60 b88/56 t60/80 u20/70', 'io'], [.4, 'r-30 sp10 hd-6 a90/70 b94/66 t80/70 u60/80 lift22', 'out'], [.58, 'r-86 sp0 hd0 a88/60 b90/60 t40/40 u30/50', 'in'], [1.06, 'r-88 hd-6 a60/60 b60/50 t24/44 u12/50']],
    V: [[0, HOLD_V], [.18, 'sp60 hd24 a30/30 b20/30 t14/24 u-10/24'], [.4, 'sp70 hd30 a60/20 b50/20 t0/30 u-10/40'], [.58, 'sp16 hd20 a140/20 b130/20 t-6/24 u4/34'], [.9, 'sp4 hd-6 a150/20 b140/20 t0/10 u4/8']],
    R: [[0, 24, 42, -20], [.18, 24, 44, -30], [.4, 24, 54, -70], [.58, 24, 'g', -130, 'in'], [.74, 28, 'g', -140], [.95, 46, 'g', -92, 'in'], [1.06, 46, 'g', -90]],
    ik: [[0, .7, 'N', 'neck'], [0, .7, 'F', 'head']],
    ev: [[.16, 'whoosh'], [.58, 'impact', { p: 1.1, d: 1, word: '쿵!' }]],
  },
  // ------------------------------------------------------------------ finisher parts
  fDawn: {
    name: '새벽 파도', pos: 'fin', hp: 34, stun: 60, gain: 0, lift: 0, self: .5, desc: '등을 돌려 목을 걸고 뛰어올라 그대로 내리꽂는다.',
    dur: 2.1, rel: 1.5, vf: 1, vel: [20, -150, 2], land: 'prone',
    A: [[0, HOLD_A], [.2, 'sp-10 hd-6 a-40/60 b96/10 t20/20 u-30/10', 'out'], [.5, 'sp10 hd-10 a120/80 b60/60 t30/40 u-20/30', 'io'], [.8, 'sp30 hd-14 a150/70 b120/60 t60/84 u20/80', 'io'], [1.06, 'sp-10 hd-10 a160/60 b140/50 t20/20 u-10/40 lift56', 'out'], [1.26, 'r-30 sp-10 hd-6 a150/60 b140/50 t50/30 u40/40 lift44', 'io'], [1.44, 'r-86 sp4 hd0 a140/50 b130/50 t20/20 u10/30', 'in'], [2.1, 'r-88 hd-6 a130/50 b120/50 t20/40 u12/46']],
    V: [[0, 'sp20 hd10 a20/30 b30/30 t14/24 u-12/24'], [.5, 'sp30 hd14 a40/20 b30/30 t16/30 u-14/30'], [.8, 'sp40 hd10 a50/30 b40/30 t20/40 u-10/40'], [1.06, 'sp20 hd10 a90/20 b80/20 t-10/30 u10/40'], [1.26, 'sp10 hd10 a120/20 b110/20 t-20/30 u0/40'], [1.44, 'sp4 hd-6 a150/20 b140/20 t0/10 u4/14'], [2.1, 'sp4 hd-6 a150/20 b140/20 t0/8 u4/8']],
    R: [[0, 26, 43, 0], [.5, -20, 43, 8], [.8, -20, 42, 18], [1.06, -22, 92, 30, 'out'], [1.26, -24, 84, 64], [1.44, -30, 'g', 90, 'in'], [2.1, -30, 'g', 90]],
    ik: [[.5, 1.4, 'N', 'head'], [.5, 1.4, 'F', 'neck']],
    ev: [[.1, 'cry'], [.78, 'charge'], [1.0, 'whoosh'], [1.44, 'impact', { p: 2.2, d: 1, word: '쏴아— 쾅!!' }]],
  },
  fContainer: {
    name: '컨테이너 드롭', pos: 'fin', hp: 38, stun: 60, gain: 0, lift: 9, self: .6, desc: '크레인처럼 한 바퀴 돌려 들어 올린 뒤 바닥에 내려놓는다… 세게.',
    dur: 3.0, rel: 2.5, vf: -1, vel: [60, -190, -2], land: 'sup', quake: 110,
    A: [[0, HOLD_A], [.3, 'sp50 hd-22 a52/30 b58/28 t62/84 u18/74', 'io'], [.8, 'sp-8 hd-14 a174/4 b168/6 t12/10 u-14/10', 'out'], [1.9, 'sp-10 hd-16 a176/4 b170/6 t12/10 u-14/10'], [2.1, 'sp-18 hd-18 a178/8 b174/8 t20/30 u-10/30 lift10', 'io'], [2.3, 'sp-10 hd-12 a170/6 b166/8 t30/50 u10/60 lift34', 'out'], [2.46, 'sp70 hd-24 a56/4 b60/4 t88/60 u80/80', 'in'], [3.0, 'sp50 hd-14 a50/14 b54/14 t84/60 u76/80']],
    V: [[0, HOLD_V], [.3, 'sp24 hd0 a40/20 b60/20 t30/30 u20/30'], [.8, LIMP], [1.9, 'sp-18 hd-24 a160/10 b150/10 t20/20 u34/30'], [2.46, FLAT]],
    R: [[0, 24, 42, -20], [.3, 22, 40, 10], [.8, 4, 106, 88, 'out'], [1.9, 2, 108, 88], [2.1, 0, 112, 86], [2.3, 4, 130, 88, 'out'], [2.46, 44, 'g', 94, 'in'], [3.0, 46, 'g', 92]],
    yaw: [[.9, 0], [1.9, 720, 'io']],
    ik: [[.1, 2.44, 'N', 'pelvis'], [.1, 2.44, 'F', 'chest']],
    ev: [[.1, 'cry'], [.7, 'lift'], [1.0, 'spin'], [1.5, 'spin'], [2.2, 'whoosh'], [2.46, 'impact', { p: 2.5, d: 1, word: '콰아앙!!' }]],
  },
  fTyphoon: {
    name: '태풍의 눈', pos: 'fin', hp: 35, stun: 60, gain: 0, lift: 0, self: .5, desc: '걷어차 띄우고 더 높이 솟구쳐 회전하며 내리꽂는다.',
    dur: 2.5, rel: 1.92, vf: -1, vel: [40, -160, 3], land: 'sup',
    A: [[0, HOLD_A], [.22, 'sp30 hd-10 a40/60 b50/60 t70/90 u40/80', 'io'], [.4, 'r-120 sp-10 hd-10 a150/20 b150/20 t40/20 u80/10 lift40', 'out'], [.62, 'r-330 sp20 hd10 a60/80 b60/80 t70/90 u60/90 lift22', 'lin'], [.8, 'r-360 sp30 hd-10 a-30/40 b-20/40 t60/84 u40/84', 'in'], [1.06, 'r-360 sp-6 hd-14 a160/20 b164/10 t10/10 u0/30 lift70', 'out'], [1.4, 'r-360 sp30 hd10 a70/100 b70/100 t100/120 u96/120 lift120', 'out'], [1.7, 'r-1440 sp30 hd10 a70/100 b70/100 t100/120 u96/120 lift124', 'lin'], [1.9, 'r-1440 sp30 hd0 a-20/20 b-30/20 t90/6 u84/8 lift6 ox26', 'in'], [2.2, 'r-1440 sp30 hd-14 a30/60 b50/60 t70/90 u30/80 ox26', 'out'], [2.5, 'r-1440 sp10 hd-6 a20/90 b55/84 t18/20 u-20/16 ox26', 'io']],
    V: [[0, HOLD_V], [.36, 'sp20 hd0 a30/30 b40/30 t14/24 u-10/24'], [.44, 'sp-30 hd-40 a120/20 b130/20 t20/30 u40/40'], [1.0, LIMP], [1.86, 'sp-14 hd-20 a150/10 b140/10 t30/30 u50/40'], [1.94, FLAT]],
    R: [[0, 24, 42, 0], [.36, 28, 44, 0], [.42, 30, 60, 10], [1.0, 40, 128, 250, 'out'], [1.5, 40, 120, 440], [1.84, 40, 64, 452, 'in'], [1.92, 40, 'g', 452, 'in'], [2.5, 42, 'g', 452]],
    ev: [[.1, 'cry'], [.4, 'smack', { d: .2, word: '팡!' }], [1.06, 'whoosh'], [1.45, 'spin'], [1.6, 'spin'], [1.74, 'spin'], [1.92, 'impact', { p: 2.3, d: .8, word: '휘이잉— 쾅!!' }]],
  },
  fAnchor1: {
    name: '닻내림', pos: 'fin', hp: 10, stun: 20, gain: 0, lift: 9, self: 0, desc: '', dur: 1.0, rel: 9, vf: 1, next: 1,
    A: [[0, REAR_A], [.2, 'sp20 hd-4 a78/46 b80/42 t58/74 u8/64', 'io'], [.4, 'r-14 sp-30 hd-18 a88/24 b90/22 t22/32 u-12/34', 'out'], [.6, 'r-60 sp-50 hd-44 a118/10 b120/10 t72/98 u62/98 ox-12', 'in'], [.76, 'r-30 sp-10 hd-10 a100/30 b100/30 t80/100 u40/90 ox-30', 'io'], [1.0, 'sp14 hd-4 a74/44 b78/40 t40/50 u0/50 ox-46', 'io']],
    V: [[0, REAR_V], [.2, 'sp6 hd6 a40/60 b50/50 t20/40 u6/44'], [.4, 'sp-18 hd-20 a90/20 b100/20 t40/30 u30/44'], [.6, 'sp36 hd50 a150/20 b140/20 t84/24 u96/34'], [.78, 'sp30 hd40 a130/30 b120/30 t60/60 u70/70'], [1.0, REAR_V]],
    R: [[0, 17, 44, 0], [.2, 17, 42, -4], [.4, 6, 88, -66, 'out'], [.5, -18, 90, -120], [.6, -50, 'g', -188, 'in'], [.78, -48, 'g', -250], [1.0, -29, 44, -360]],
    ik: [[0, 1.0, 'N', 'pelvis'], [0, 1.0, 'F', 'pelvis']],
    ev: [[.1, 'cry'], [.4, 'lift'], [.6, 'impact', { p: 1.3, d: 1, word: '하나!' }]],
  },
  fAnchor3: {
    name: '삼연 닻내림', pos: 'fin', hp: 18, stun: 40, gain: 0, lift: 9, self: .5, desc: '저먼 수플렉스를 세 번 이어 마지막에 다리로 누른다.',
    dur: 1.9, rel: 1.5, vf: 1, vel: [-60, -90, -1], land: 'sup',
    A: [[0, REAR_A], [.34, 'sp24 hd-4 a78/46 b80/42 t62/80 u10/70', 'io'], [.66, 'r-14 sp-34 hd-20 a92/22 b94/20 t14/20 u-16/24 lift10', 'out'], [.92, 'r-60 sp-54 hd-46 a120/10 b122/10 t74/100 u64/100 ox-14', 'in'], [1.6, 'r-60 sp-54 hd-48 a120/12 b122/12 t74/100 u64/100 ox-14'], [1.9, 'r-80 sp-10 hd-10 a110/20 b110/20 t50/80 u40/80 ox-14']],
    V: [[0, REAR_V], [.34, 'sp6 hd6 a40/60 b50/50 t20/40 u6/44'], [.66, 'sp-18 hd-20 a100/20 b110/20 t40/30 u30/44'], [.92, 'sp36 hd50 a150/20 b140/20 t84/24 u96/34'], [1.6, 'sp36 hd50 a140/30 b130/30 t80/30 u92/40']],
    R: [[0, 17, 44, 0], [.34, 17, 42, -4], [.66, 6, 102, -66, 'out'], [.8, -20, 104, -124], [.92, -52, 'g', -190, 'in'], [1.6, -54, 'g', -192], [1.9, -74, 'g', -262]],
    ik: [[0, 1.5, 'N', 'pelvis'], [0, 1.5, 'F', 'pelvis']],
    ev: [[.3, 'cry'], [.62, 'lift'], [.92, 'impact', { p: 2.2, d: 1, word: '셋!! 쾅!!' }]],
  },
  fWeld: {
    name: '불꽃 용접', pos: 'fin', hp: 36, stun: 60, gain: 0, lift: 0, self: .5, desc: '불꽃 튀는 연타 끝에 어퍼컷으로 하늘까지 띄운다.',
    dur: 2.6, rel: 1.86, vf: -1, vel: [70, -420, -7], land: 'sup', high: 1,
    A: [[0, HOLD_A], [.2, 'sp0 a-40/110 b60/100 t20/24 u-24/16', 'out'], [.28, 'sp22 a84/6 b30/120 t34/26 u-28/10', 'in'], [.4, 'sp2 a20/120 b-20/110 t20/24 u-24/16', 'out'], [.48, 'sp22 a20/120 b88/4 t34/26 u-28/10', 'in'], [.58, 'sp0 a-40/110 b60/100 t20/24 u-24/16', 'out'], [.65, 'sp22 a84/6 b30/120 t34/26 u-28/10', 'in'], [.74, 'sp2 a20/120 b-20/110 t20/24 u-24/16', 'out'], [.81, 'sp22 a20/120 b88/4 t34/26 u-28/10', 'in'], [.9, 'sp0 a-40/110 b60/100 t20/24 u-24/16', 'out'], [.97, 'sp22 a84/6 b30/120 t34/26 u-28/10', 'in'], [1.3, 'sp40 hd-20 a-50/70 b50/100 t66/90 u20/80', 'out'], [1.62, 'sp44 hd-22 a-56/80 b50/100 t70/94 u22/84'], [1.82, 'sp-18 hd-24 a160/20 b-20/60 t10/6 u-20/10 lift14', 'in'], [2.2, 'sp-12 hd-16 a150/30 b0/60 t14/10 u-18/10', 'out'], [2.6, IDLE, 'io']],
    V: [[0, HOLD_V], [.2, 'sp10 hd4 a20/40 b30/40 t14/20 u-12/20'], [.28, 'sp30 hd10 a40/40 b50/40 t20/30 u-10/24'], [.42, 'sp14 hd6 a30/40 b40/40 t16/24 u-12/22'], [.48, 'sp32 hd10 a44/40 b54/40 t22/32 u-8/26'], [.6, 'sp14 hd6 a30/40 b40/40 t16/24 u-12/22'], [.65, 'sp32 hd10 a44/40 b54/40 t22/32 u-8/26'], [.81, 'sp34 hd14 a46/40 b56/40 t24/34 u-6/28'], [.97, 'sp38 hd16 a50/40 b60/40 t26/36 u-4/30'], [1.3, 'sp30 hd24 a10/20 b16/20 t16/30 u-10/30'], [1.8, 'sp34 hd26 a6/16 b12/16 t18/34 u-8/34'], [1.86, 'sp-34 hd-50 a120/20 b130/20 t20/20 u-10/30']],
    R: [[0, 26, 43, 0], [.97, 32, 43, 0], [1.3, 34, 43, 0], [1.8, 32, 43, 0], [1.86, 34, 62, 10, 'in']],
    ev: [[.06, 'cry'], [.28, 'smack', { d: .08, spark: 1 }], [.48, 'smack', { d: .08, spark: 1 }], [.65, 'smack', { d: .08, spark: 1 }], [.81, 'smack', { d: .08, spark: 1 }], [.97, 'smack', { d: .1, spark: 1 }], [1.36, 'charge'], [1.84, 'impact', { p: 2.3, d: .58, word: '치이익— 펑!!', spark: 1, body: 1 }]],
  },
  fTsunami: {
    name: '해일 프레스', pos: 'fin', hp: 38, stun: 60, gain: 0, lift: 0, self: .9, desc: '배로 튕겨 눕히고 화면 밖까지 뛰어올라 덮친다.',
    dur: 3.1, rel: 2.36, vf: -1, vel: [0, -150, 0], land: 'sup', quake: 150,
    A: [[0, HOLD_A], [.26, 'sp-30 hd10 a-40/20 b-30/20 t20/30 u-20/20', 'io'], [.4, 'sp-20 hd0 a-60/20 b-50/20 t40/30 u-40/10 ox10', 'in'], [.7, 'sp2 hd-4 a20/50 b30/50 t16/12 u-16/12', 'io'], [1.0, 'sp40 hd-20 a-30/30 b-20/30 t80/110 u50/110', 'io'], [1.3, 'sp-4 hd-10 a170/10 b170/10 t10/10 u0/20 lift150 ox10', 'out'], [1.9, 'r70 sp-8 hd-20 a140/10 b146/10 t-10/20 u0/30 lift240 ox30', 'out'], [2.3, 'r88 sp-10 hd-24 a150/10 b156/10 t-10/20 u0/30 ox44', 'in'], [2.7, 'r88 sp-6 hd-20 a150/10 b156/10 t-6/20 u4/30 ox44'], [3.1, 'r60 sp10 hd-20 a90/30 b90/30 t60/90 u30/60 ox44']],
    V: [[0, HOLD_V], [.36, 'sp0 hd0 a30/40 b40/40 t10/14 u-10/14'], [.44, 'sp-30 hd-30 a90/20 b100/20 t30/20 u10/40'], [.7, FLAT], [2.28, FLAT], [2.36, 'sp20 hd20 a140/20 b130/20 t40/40 u50/50'], [3.1, FLAT]],
    R: [[0, 26, 43, 0], [.4, 30, 43, 0], [.5, 48, 56, 40, 'out'], [.7, 70, 'g', 94, 'in'], [3.1, 70, 'g', 92]],
    ev: [[.1, 'cry'], [.42, 'smack', { d: .15, word: '출렁!' }], [.72, 'dust'], [1.0, 'charge'], [1.2, 'whoosh'], [2.3, 'impact', { p: 2.7, d: .85, word: '콰과광!!' }]],
  },
  fNeon: {
    name: '네온 스핀', pos: 'fin', hp: 34, stun: 60, gain: 0, lift: 0, self: .4, desc: '바닥을 쓸며 도는 발차기 폭풍, 마지막은 공중 가위차기.',
    dur: 2.7, rel: 2.06, vf: -1, vel: [170, -230, -6], land: 'sup', trail: 1,
    A: [[0, HOLD_A], [.24, 'sp60 hd-10 a30/60 b40/60 t80/110 u60/100', 'io'], [.44, 'r-100 sp10 hd0 a170/10 b150/30 t50/10 u120/20', 'io'], [1.4, 'r-110 sp14 hd0 a170/10 b150/30 t40/20 u130/10'], [1.6, 'sp30 hd-10 a40/60 b50/60 t70/90 u40/90', 'io'], [1.8, 'r-20 sp-10 hd-6 a-30/30 b60/40 t110/10 u-10/70 lift40', 'out'], [2.02, 'r-60 sp-20 hd-10 a-40/20 b40/40 t120/4 u40/20 lift44', 'in'], [2.3, 'r-20 sp40 hd-16 a30/60 b50/60 t80/100 u40/90', 'in'], [2.7, IDLE, 'io']],
    V: [[0, HOLD_V], [.4, 'sp6 hd0 a20/30 b30/30 t10/14 u-10/14'], [.6, 'sp-16 hd-20 a40/30 b50/30 t20/20 u-14/10'], [.8, 'sp14 hd20 a20/30 b30/30 t14/24 u-10/24'], [1.0, 'sp-18 hd-24 a50/30 b60/30 t24/20 u-14/10'], [1.2, 'sp14 hd20 a20/30 b30/30 t14/24 u-10/24'], [1.4, 'sp-20 hd-26 a50/30 b60/30 t24/20 u-14/10'], [1.7, 'sp20 hd24 a6/16 b12/16 t14/30 u-10/30'], [2.0, 'sp20 hd24 a6/16 b12/16 t14/30 u-10/30'], [2.06, 'sp-34 hd-44 a120/20 b130/20 t30/20 u0/30']],
    R: [[0, 28, 43, 0], [.5, 34, 43, 0], [1.4, 42, 43, 0], [2.0, 38, 43, 0], [2.06, 44, 56, 16]],
    yaw: [[.44, 0, 'lin', 'A'], [1.4, 1800, 'lin', 'A'], [1.5, 1800, 'lin', 'A']],
    ev: [[.06, 'cry'], [.56, 'smack', { d: .1 }], [.74, 'smack', { d: .1 }], [.94, 'smack', { d: .1 }], [1.14, 'smack', { d: .1 }], [1.34, 'smack', { d: .1 }], [1.78, 'whoosh'], [2.04, 'impact', { p: 2.1, d: .5, word: '번쩍!!', body: 1 }]],
  },
  fBlackout: {
    name: '등화관제', pos: 'fin', hp: 42, stun: 70, gain: 0, lift: 9, self: .5, desc: '불이 꺼진다. 다시 켜졌을 때는 이미 늦었다.',
    dur: 3.2, rel: 2.6, vf: -1, vel: [60, -200, -1.6], land: 'sup', quake: 120, dark: [.4, 2.5],
    A: [[0, 'sp2 hd4 a84/10 b6/16 t12/8 u-12/8'], [.5, 'sp4 hd2 a88/10 b10/20 t14/12 u-14/10', 'io'], [1.2, 'sp-10 hd-14 a150/2 b20/20 t10/6 u-12/6', 'io'], [2.1, 'sp-12 hd-16 a152/2 b24/20 t10/6 u-12/6'], [2.3, 'sp-20 hd-18 a164/4 b120/20 t10/6 u-14/8', 'out'], [2.5, 'sp66 hd-20 a50/0 b20/50 t62/70 u-20/66', 'in'], [2.9, 'sp50 hd-10 a46/8 b20/50 t54/62 u-16/58'], [3.2, 'sp2 hd5 a7/18 b11/20 t8/5 u-9/6', 'io']],
    V: [[0, 'sp-8 hd-18 a72/96 b80/92 t6/8 u-6/10'], [.5, 'sp-4 hd-20 a74/100 b82/96 t10/14 u-4/16'], [1.2, 'sp-8 hd-16 a66/104 b70/100 t14/40 u-4/30'], [1.7, 'sp-8 hd-20 a60/104 b66/100 t-6/30 u18/44'], [2.1, 'sp-8 hd-16 a66/104 b70/100 t14/40 u-4/30'], [2.5, FLAT]],
    R: [[0, 34, 43, 0], [.5, 34, 44, 2], [1.2, 32, 98, 6, 'io'], [2.1, 30, 104, 8], [2.3, 26, 116, 2], [2.5, 46, 'g', 94, 'in'], [3.2, 48, 'g', 92]],
    ik: [[0, 2.5, 'N', 'neck']], ikV: [[.06, 2.3, 'both', 'A:hN']],
    ev: [[.2, 'grip'], [.4, 'blackout'], [1.1, 'lift'], [2.3, 'whoosh'], [2.5, 'impact', { p: 2.7, d: 1, word: '…쾅.' }]],
  },
  fHomerun: {
    name: '대방어 풀스윙', pos: 'fin', hp: 35, stun: 60, gain: 0, lift: 9, self: .5, desc: '다리를 잡고 다섯 바퀴. 대방어 나가신다!', sweep: 70, tags: ['swing'],
    dur: 3.1, rel: 2.72, vf: -1, vel: [400, -330, -9], land: 'sup', high: 1,
    A: [[0, HOLD_A], [.26, 'sp52 hd-20 a50/20 b54/20 t46/58 u6/56', 'io'], [.56, 'sp-18 hd-6 a84/8 b88/8 t28/34 u-14/34', 'io'], [2.6, 'sp-26 hd-10 a92/4 b96/4 t28/34 u-14/34'], [2.72, 'sp24 hd-10 a130/0 b134/0 t40/24 u-32/8', 'in'], [3.1, IDLE, 'io']],
    V: [[0, HOLD_V], [.26, 'sp0 hd-6 a120/20 b100/20 t10/10 u6/12'], [.56, 'sp-6 hd-14 a158/8 b150/10 t2/4 u6/6'], [2.6, 'sp-10 hd-20 a166/4 b160/6 t0/2 u4/4']],
    R: [[0, 24, 42, 0], [.26, 52, 18, 80], [.56, 66, 34, 82], [1.4, 72, 56, 84], [2.6, 74, 70, 84], [2.72, 70, 84, 80]],
    yaw: [[.56, 0], [2.72, 2160, 'in']],
    ik: [[.2, 2.7, 'N', 'aN'], [.2, 2.7, 'F', 'aF']],
    ev: [[.1, 'cry'], [.7, 'spin'], [1.1, 'spin'], [1.4, 'spin'], [1.65, 'spin'], [1.85, 'spin'], [2.02, 'spin'], [2.18, 'spin'], [2.32, 'spin'], [2.45, 'spin'], [2.58, 'spin'], [2.72, 'release'], [2.74, 'impact', { p: 2, d: 1, word: '홈런!!', body: 1 }]],
  },
  fClub: {
    name: '방망이 타작', pos: 'fin', hp: 36, stun: 60, gain: 0, lift: 9, self: .5, desc: '양주먹 내려찍기 세 번, 마무리는 거꾸로 꽂기.',
    dur: 3.0, rel: 2.6, vf: -1, vel: [30, -120, 1.6], land: 'sup', quake: 80,
    A: [[0, HOLD_A], [.2, 'sp-14 hd-10 a170/40 b172/40 t14/14 u-18/12', 'out'], [.34, 'sp40 hd-10 a70/10 b74/10 t40/40 u-20/30', 'in'], [.54, 'sp-14 hd-10 a170/40 b172/40 t14/14 u-18/12', 'out'], [.68, 'sp40 hd-10 a70/10 b74/10 t40/40 u-20/30', 'in'], [.88, 'sp-16 hd-12 a172/44 b174/44 t14/14 u-18/12 lift6', 'out'], [1.04, 'sp44 hd-10 a66/10 b70/10 t46/46 u-20/36', 'in'], [1.3, 'sp54 hd-24 a52/30 b58/28 t46/58 u0/52', 'io'], [1.7, 'sp-2 hd-2 a52/66 b58/60 t16/14 u-16/14', 'out'], [2.0, 'sp-6 hd-8 a54/68 b60/62 t40/50 u20/60 lift54', 'out'], [2.2, 'sp4 hd0 a50/66 b56/60 t88/8 u94/12', 'in'], [2.7, 'sp8 hd4 a44/60 b50/56 t88/10 u94/14'], [3.0, 'sp8 hd4 a30/60 b40/56 t84/16 u90/20']],
    V: [[0, HOLD_V], [.36, 'sp60 hd40 a20/20 b30/20 t24/40 u-6/40'], [.54, 'sp40 hd20 a20/20 b30/20 t20/30 u-10/30'], [.7, 'sp62 hd42 a20/20 b30/20 t24/44 u-6/44'], [.88, 'sp40 hd20 a20/20 b30/20 t20/30 u-10/30'], [1.06, 'sp66 hd44 a20/20 b30/20 t30/56 u0/56'], [1.3, 'sp70 hd20 a30/20 b20/20 t6/20 u-10/26'], [1.7, UPSIDE], [2.2, 'sp16 hd24 a120/20 b110/30 t20/40 u40/60'], [3.0, FLAT]],
    R: [[0, 28, 42, 0], [1.04, 28, 40, 0], [1.3, 22, 44, -96], [1.7, 17, 66, -180, 'out'], [2.0, 16, 118, -180, 'out'], [2.2, 18, 'g', -180, 'in'], [2.6, 26, 'g', -166], [3.0, 44, 'g', -96]],
    ik: [[1.2, 2.5, 'N', 'pelvis'], [1.2, 2.5, 'F', 'chest']],
    ev: [[.06, 'cry'], [.34, 'smack', { d: .12, word: '뚝!' }], [.68, 'smack', { d: .12, word: '딱!' }], [1.04, 'smack', { d: .14, word: '쾅!' }], [1.6, 'lift'], [2.0, 'whoosh'], [2.2, 'impact', { p: 2.4, d: .62, word: '쿠쿵!!' }]],
  },
  fInk: {
    name: '먹물 문어발', pos: 'fin', hp: 34, stun: 60, gain: 0, lift: 9, self: .5, desc: '먹물을 뿌리고 휘감아 여덟 번 두들긴 뒤 뒤로 넘긴다.',
    dur: 3.0, rel: 2.6, vf: 1, vel: [-60, -90, -1], land: 'sup', ink: [.2, 1.6],
    A: [[0, REAR_A], [.2, 'sp30 hd-10 a90/40 b96/40 t30/40 u-20/30', 'out'], [.4, 'sp6 hd-4 a100/60 b70/80 t30/34 u-20/24', 'io'], [.5, 'sp14 hd-4 a60/90 b110/40 t30/34 u-20/24', 'io'], [.6, 'sp6 hd-4 a110/40 b60/90 t30/34 u-20/24', 'io'], [.7, 'sp14 hd-4 a50/90 b110/40 t30/34 u-20/24', 'io'], [.8, 'sp6 hd-4 a110/40 b60/90 t30/34 u-20/24', 'io'], [.9, 'sp14 hd-4 a60/90 b110/40 t30/34 u-20/24', 'io'], [1.0, 'sp6 hd-4 a110/40 b60/90 t30/34 u-20/24', 'io'], [1.2, 'sp14 hd-4 a78/46 b80/42 t30/34 u-20/24', 'io'], [1.6, 'sp22 hd-4 a78/46 b80/42 t62/80 u10/70', 'io'], [1.9, 'r-14 sp-34 hd-20 a92/22 b94/20 t14/20 u-16/24 lift8', 'out'], [2.16, 'r-60 sp-54 hd-46 a120/10 b122/10 t74/100 u64/100 ox-14', 'in'], [3.0, 'r-60 sp-50 hd-46 a118/12 b120/12 t74/100 u64/100 ox-14']],
    V: [[0, REAR_V], [.4, 'sp10 hd10 a30/60 b40/60 t14/24 u-12/24'], [.55, 'sp-10 hd-20 a40/60 b50/60 t10/20 u-14/20'], [.7, 'sp16 hd16 a30/60 b40/60 t16/28 u-10/28'], [.85, 'sp-12 hd-22 a40/60 b50/60 t10/20 u-14/20'], [1.0, 'sp18 hd18 a30/60 b40/60 t16/28 u-10/28'], [1.2, REAR_V], [1.6, 'sp6 hd6 a40/60 b50/50 t20/40 u6/44'], [1.9, 'sp-18 hd-20 a100/20 b110/20 t40/30 u30/44'], [2.16, 'sp36 hd50 a150/20 b140/20 t84/24 u96/34'], [3.0, 'sp36 hd50 a140/30 b130/30 t80/30 u92/40']],
    R: [[0, 18, 44, 0], [1.2, 18, 44, 0], [1.6, 17, 42, -4], [1.9, 6, 100, -66, 'out'], [2.04, -20, 102, -124], [2.16, -52, 'g', -190, 'in'], [3.0, -54, 'g', -192]],
    ik: [[1.2, 2.6, 'N', 'pelvis'], [1.2, 2.6, 'F', 'pelvis']],
    ev: [[.1, 'cry'], [.2, 'ink'], [.5, 'smack', { d: .06 }], [.6, 'smack', { d: .06 }], [.7, 'smack', { d: .06 }], [.8, 'smack', { d: .06 }], [.9, 'smack', { d: .06 }], [1.0, 'smack', { d: .06 }], [1.86, 'lift'], [2.16, 'impact', { p: 2.2, d: .64, word: '푸확— 쾅!!' }]],
  },
  fShark: {
    name: '상어 이빨', pos: 'fin', hp: 37, stun: 60, gain: 0, lift: 9, self: .5, desc: '매트 아래로 헤엄쳐 들어가 솟구치며 물어 채고, 머리부터 꽂는다.',
    dur: 3.0, rel: 2.5, vf: -1, vel: [20, -100, -2.4], land: 'prone', swim: [.36, 1.2],
    A: [[0, HOLD_A], [.2, 'sp-10 hd-6 a60/40 b70/40 t10/14 u-14/12', 'out'], [.36, 'r60 sp20 hd-10 a150/10 b156/10 t-10/10 u-6/14 lift8 ox-20', 'io'], [.46, 'r92 sp0 hd-10 a172/4 b170/4 t0/6 u4/8 lift-46 ox-10', 'in'], [1.16, 'r92 sp0 hd-10 a172/4 b170/4 t0/6 u4/8 lift-46 ox14'], [1.34, 'r-4 sp-10 hd-14 a160/10 b150/20 t10/10 u-6/20 lift40 ox10', 'out'], [1.6, 'sp16 hd-10 a84/74 b86/66 t20/20 u-14/20 lift50 ox8', 'io'], [1.9, 'sp10 hd-8 a84/76 b88/70 t40/40 u10/60 lift60 ox4', 'out'], [2.1, 'r-84 sp-4 hd10 a80/74 b76/66 t28/34 u8/46', 'in'], [2.5, 'r-88 hd-6 a60/60 b60/50 t24/44 u12/50'], [3.0, 'r-88 hd-6 a60/60 b60/50 t24/44 u12/50']],
    V: [[0, HOLD_V], [.3, 'sp-6 hd-6 a20/40 b30/40 t10/14 u-10/14'], [.8, 'sp-4 hd10 a30/60 b40/60 t12/16 u-12/16'], [1.2, 'sp-4 hd16 a40/60 b50/60 t14/20 u-14/20'], [1.36, 'sp-20 hd-30 a120/30 b130/30 t20/50 u40/60'], [1.6, 'sp70 hd26 a30/30 b20/30 t20/30 u0/40'], [1.9, 'sp72 hd26 a60/30 b50/30 t0/30 u-10/40'], [2.1, 'sp24 hd30 a130/20 b120/24 t-6/20 u6/30'], [2.5, 'sp4 hd-6 a150/20 b140/20 t0/10 u4/8']],
    R: [[0, 30, 43, 0], [.4, 40, 43, 0], [1.22, 34, 43, 0], [1.36, 30, 84, 10, 'out'], [1.6, 30, 94, -20], [1.9, 28, 104, -40], [2.1, 22, 'g', -138, 'in'], [2.4, 26, 'g', -150], [2.7, 44, 'g', -92, 'in'], [3.0, 44, 'g', -90]],
    ik: [[1.5, 2.4, 'N', 'neck'], [1.5, 2.4, 'F', 'head']],
    ev: [[.1, 'cry'], [.42, 'splash'], [.7, 'fin'], [.95, 'fin'], [1.22, 'splash'], [1.3, 'smack', { d: .25, word: '덥썩!' }], [1.9, 'whoosh'], [2.1, 'impact', { p: 2.4, d: .75, word: '첨벙— 쾅!!' }]],
  },
  fNorth1: {
    name: '북해 파워밤', pos: 'fin', hp: 14, stun: 20, gain: 0, lift: 9, self: 0, desc: '', dur: 1.5, rel: 9, vf: -1, next: 1, quake: 60,
    A: [[0, HOLD_A], [.26, 'sp50 hd-22 a56/30 b60/28 t50/66 u4/60', 'io'], [.62, 'sp-8 hd-6 a150/26 b154/24 t12/10 u-16/10', 'out'], [.8, 'sp-14 hd-12 a156/22 b160/20 t12/8 u-16/8', 'io'], [1.0, 'sp58 hd-16 a56/6 b60/6 t54/66 u-14/58', 'in'], [1.2, 'sp56 hd-16 a56/8 b60/8 t54/66 u-14/58'], [1.5, 'sp50 hd-22 a56/30 b60/28 t50/66 u4/60', 'io']],
    V: [[0, HOLD_V], [.26, 'sp66 hd20 a30/20 b20/20 t10/20 u-10/24'], [.62, 'sp-6 hd-4 a60/50 b70/40 t84/60 u90/64'], [.8, 'sp-16 hd-14 a90/30 b100/30 t84/50 u92/56'], [1.0, 'sp26 hd34 a140/20 b130/20 t96/24 u104/34'], [1.2, 'sp20 hd20 a140/20 b130/20 t90/40 u98/50'], [1.5, 'sp30 hd20 a60/20 b50/20 t60/50 u60/60']],
    R: [[0, 24, 42, -30], [.26, 20, 46, -104], [.44, 22, 80, -60], [.62, 14, 108, 2, 'out'], [.8, 10, 112, -6], [1.0, 36, 'g', 104, 'in'], [1.2, 34, 16, 100], [1.5, 22, 50, 40]],
    ik: [[.2, 1.5, 'N', 'pelvis'], [.2, 1.5, 'F', 'pN']],
    ev: [[.1, 'cry'], [.56, 'lift'], [1.0, 'impact', { p: 1.6, d: 1, word: '쾅!' }]],
  },
  fNorth2: {
    name: '북해 폭풍밤', pos: 'fin', hp: 26, stun: 50, gain: 0, lift: 9, self: .6, desc: '파워밤을 놓지 않고 한 번 더. 북해의 겨울은 두 번 온다.',
    dur: 2.0, rel: 1.6, vf: -1, vel: [60, -210, -1.5], land: 'sup', quake: 140,
    A: [[0, 'sp50 hd-22 a56/30 b60/28 t50/66 u4/60'], [.5, 'sp-8 hd-6 a150/26 b154/24 t12/10 u-16/10', 'out'], [.95, 'sp-16 hd-14 a164/16 b166/16 t30/50 u0/50', 'io'], [1.25, 'sp-12 hd-10 a168/14 b168/14 t30/50 u10/60 lift52', 'out'], [1.5, 'sp64 hd-18 a56/4 b60/4 t86/60 u78/80', 'in'], [2.0, 'sp50 hd-12 a50/14 b54/14 t82/60 u74/80']],
    V: [[0, 'sp30 hd20 a60/20 b50/20 t60/50 u60/60'], [.5, 'sp-6 hd-4 a60/50 b70/40 t84/60 u90/64'], [.95, 'sp-16 hd-14 a90/30 b100/30 t84/50 u92/56'], [1.5, 'sp26 hd34 a140/20 b130/20 t96/24 u104/34'], [2.0, FLAT]],
    R: [[0, 22, 50, 40], [.5, 14, 108, 2, 'out'], [.95, 8, 112, -8], [1.25, 8, 160, -8, 'out'], [1.5, 38, 'g', 104, 'in'], [2.0, 42, 'g', 92]],
    ik: [[0, 1.5, 'N', 'pelvis'], [0, 1.5, 'F', 'pN']],
    ev: [[.4, 'lift'], [1.2, 'whoosh'], [1.5, 'impact', { p: 2.6, d: 1, word: '콰아앙!!' }]],
  },
  fWhitewave: {
    name: '백파 수플렉스', pos: 'fin', hp: 37, stun: 60, gain: 0, lift: 9, self: .5, desc: '거꾸로 세운 채 멈춘 시간. 파도가 부서지는 순간 넘긴다.',
    dur: 3.0, rel: 2.4, vf: -1, vel: [-60, -140, -1], land: 'sup', quake: 60,
    A: [[0, HOLD_A], [.3, 'sp36 hd-14 a82/58 b86/54 t54/72 u6/62', 'io'], [.8, 'sp-8 hd-20 a152/30 b154/28 t10/8 u-16/10', 'out'], [1.9, 'sp-10 hd-22 a154/30 b156/28 t11/9 u-16/11'], [2.1, 'sp-18 hd-26 a158/26 b160/26 t14/16 u-18/18 lift12', 'io'], [2.36, 'r-84 sp-6 hd-12 a162/8 b162/8 t30/44 u18/54 ox-12', 'in'], [3.0, 'r-88 hd-6 a150/20 b150/20 t24/50 u16/56 ox-12']],
    V: [[0, 'sp62 hd30 a40/30 b30/20 t14/24 u-10/24'], [.3, 'sp66 hd30 a36/40 b30/30 t10/30 u-14/36'], [.8, 'sp0 hd-4 a30/20 b20/20 t0/4 u4/8'], [1.9, 'sp0 hd-4 a30/24 b20/24 t-4/8 u10/14'], [2.36, FLAT]],
    R: [[0, 24, 42, -30], [.3, 22, 46, -44], [.8, 9, 112, -178, 'out'], [1.9, 8, 113, -182], [2.1, 2, 122, -186], [2.36, -60, 'g', -268, 'in'], [3.0, -62, 'g', -270]],
    ik: [[0, 2.36, 'N', 'neck'], [.2, 2.36, 'F', 'pelvis']],
    ev: [[.1, 'cry'], [.7, 'lift'], [1.0, 'charge'], [2.12, 'whoosh'], [2.36, 'impact', { p: 2.5, d: 1, word: '쏴아— 쾅!!' }]],
  },
};
for (const id in MOVES) MOVES[id].id = id;

// Looping tie-ups used while nobody has chosen a move yet, and the pinfall cover.
const HOLDS = {
  front: { id: 'holdF', dur: .8, loop: 1, vf: -1, rel: 99, ev: [], A: [[0, HOLD_A], [.4, 'sp24 hd-9 a60/68 b68/62 t28/34 u-21/26', 'io'], [.8, HOLD_A, 'io']], V: [[0, HOLD_V], [.4, 'sp44 hd10 a40/20 b30/34 t16/26 u-14/34', 'io'], [.8, HOLD_V, 'io']], R: [[0, 24, 42, -20], [.8, 24, 42, -20]], ik: [[-1, 9, 'N', 'neck'], [-1, 9, 'F', 'chest']] },
  rear: { id: 'holdR', dur: .8, loop: 1, vf: 1, rel: 99, ev: [], A: [[0, REAR_A], [.4, 'sp14 hd-4 a70/48 b76/44 t26/30 u-19/24', 'io'], [.8, REAR_A, 'io']], V: [[0, REAR_V], [.4, 'sp2 hd-8 a40/50 b30/66 t14/22 u-12/16', 'io'], [.8, REAR_V, 'io']], R: [[0, 17, 44, 0], [.8, 17, 44, 0]], ik: [[-1, 9, 'N', 'pelvis'], [-1, 9, 'F', 'pelvis']] },
  pickup: { id: 'pickup', dur: .32, vf: -1, rel: 99, ev: [], A: [[0, 'sp56 hd-20 a50/16 b56/12 t64/90 u20/80'], [.18, 'sp44 hd-16 a60/30 b66/26 t50/66 u0/60', 'io'], [.32, HOLD_A, 'io']], V: [[0, 'sp10 hd20 a20/30 b30/30 t10/30 u20/40'], [.18, 'sp50 hd30 a30/20 b40/20 t40/70 u20/80', 'io'], [.32, HOLD_V, 'io']], R: [[0, 30, 'g', 70], [.18, 26, 'g', 20], [.32, 24, 42, -20]], ik: [[-1, 9, 'N', 'neck'], [-1, 9, 'F', 'chest']] },
  pin: { id: 'pin', dur: 1.2, loop: 1, vf: -1, rel: 99, ev: [], A: [[0, 'r72 sp18 hd-34 a56/50 b104/36 t30/60 u-10/40 lift9 ox20'], [.6, 'r73 sp18 hd-30 a58/50 b106/36 t31/62 u-9/42 lift9 ox20', 'io'], [1.2, 'r72 sp18 hd-34 a56/50 b104/36 t30/60 u-10/40 lift9 ox20', 'io']], V: [[0, 'sp-4 hd-8 a120/20 b100/20 t40/30 u16/40'], [.6, 'sp-2 hd-2 a116/26 b104/16 t44/34 u12/44', 'io'], [1.2, 'sp-4 hd-8 a120/20 b100/20 t40/30 u16/40', 'io']], R: [[0, 34, 'g', 92], [1.2, 34, 'g', 92]], ik: [[-1, 9, 'F', 'kN']] },
};

/* Finishers. type: grab (short lunge), strike (dashing blow), dive (leap), stance (counter stance).
   parts run one after another without letting go. */
const FINISHERS = {
  dawn: { name: '새벽 파도', type: 'grab', parts: ['fDawn'], reach: 44, color: '#3fe0d0', line: '밤을 밀어내는 첫 파도!' },
  container: { name: '컨테이너 드롭', type: 'grab', parts: ['fContainer'], reach: 46, armor: 1, color: '#ff8a2b', line: '화물, 하역합니다!' },
  typhoon: { name: '태풍의 눈', type: 'dive', parts: ['fTyphoon'], reach: 170, color: '#3aa6e8', line: '바람이 나를 밀어준다!' },
  anchor: { name: '삼연 닻내림', type: 'stance', parts: ['fAnchor1', 'fAnchor1', 'fAnchor3'], reach: 40, rear: 1, color: '#e9e2c8', line: '매듭은 세 번 묶는다.' },
  weld: { name: '불꽃 용접', type: 'strike', parts: ['fWeld'], reach: 70, armor: 1, color: '#39e6c0', line: '보안경 써라!' },
  tsunami: { name: '해일 프레스', type: 'quake', parts: ['fTsunami'], reach: 60, color: '#2aa7b8', line: '물 들어온다아—!' },
  neonspin: { name: '네온 스핀', type: 'strike', parts: ['fNeon'], reach: 84, color: '#ff4fa3', line: '조명 켜! 쇼타임!' },
  blackout: { name: '등화관제', type: 'grab', parts: ['fBlackout'], reach: 54, armor: 1, color: '#9aa3c2', line: '……불을 꺼라.' },
  homerun: { name: '대방어 풀스윙', type: 'grab', parts: ['fHomerun'], reach: 42, color: '#e0405a', line: '싱싱한 놈으로 골라잡아!' },
  club: { name: '방망이 타작', type: 'strike', parts: ['fClub'], reach: 60, armor: 1, color: '#f0c24a', line: '뚝딱! 혼 좀 나 볼까!' },
  ink: { name: '먹물 문어발', type: 'stance', parts: ['fInk'], reach: 40, rear: 1, color: '#b066d8', line: '다리는 여덟, 팔도 여덟.' },
  shark: { name: '상어 이빨', type: 'dive', parts: ['fShark'], reach: 190, color: '#6f93bd', line: '피 냄새가 나는군.' },
  north: { name: '북해 폭풍밤', type: 'grab', parts: ['fNorth1', 'fNorth2'], reach: 48, armor: 1, color: '#c9a25a', line: '북쪽 바다를 보여주지!' },
  whitewave: { name: '백파 수플렉스', type: 'grab', parts: ['fWhitewave'], reach: 46, color: '#e6e9f2', line: '파도는 늙지 않는다.' },
};
for (const id in FINISHERS) FINISHERS[id].id = id;

return { MOVES, HOLDS, FINISHERS };
})();
// ---- anim/ragdoll.js
__m["anim/ragdoll.js"] = (function () {
// Verlet ragdoll for big hits, throws and ring-outs. It keeps limb lengths and joint sides, collides with the
// arena and hands back joints, so the renderer and the animation blender treat it like any other pose.
const { clamp } = __m["core/util.js"];
const { J } = __m["anim/skeleton.js"];
// point order: 0 pelvis 1 chest 2 head 3 elbowN 4 handN 5 elbowF 6 handF 7 kneeN 8 ankleN 9 kneeF 10 ankleF
const SRC = [J.pelvis, J.chest, J.head, J.eN, J.hN, J.eF, J.hF, J.kN, J.aN, J.kF, J.aF];
const N = 11;
class Ragdoll {
  constructor(joints, dims, face) {
    this.d = dims; this.face = face;
    this.x = new Float32Array(N); this.y = new Float32Array(N); this.px = new Float32Array(N); this.py = new Float32Array(N);
    this.r = Float32Array.from([dims.thR[0] * .95, dims.uaR[0] + 1.5, 9.5 * dims.head, dims.faR[0] * .8, dims.hR * .8, dims.faR[0] * .8, dims.hR * .8, dims.shR[0] * .8, dims.ft, dims.shR[0] * .8, dims.ft]);
    this.m = Float32Array.from([.5, .45, .9, 1.4, 1.8, 1.4, 1.8, 1.1, 1.5, 1.1, 1.5]); // inverse masses
    const P = joints.p;
    for (let i = 0; i < N; i++) { this.x[i] = this.px[i] = P[SRC[i] * 2]; this.y[i] = this.py[i] = P[SRC[i] * 2 + 1]; }
    const d = dims;
    this.con = [[0, 1, d.spine], [1, 2, d.nk + d.hd], [1, 3, d.ua], [3, 4, d.fa], [1, 5, d.ua], [5, 6, d.fa], [0, 7, d.th], [7, 8, d.sh], [0, 9, d.th], [9, 10, d.sh]];
    this.t = 0; this.still = 0; this.ground = false; this.over = false; this.side = 'in'; this.hitGround = 0; this.hitWall = 0; this.ropeHit = 0; this.lastDt = 1 / 60; this.maxT = 2.4;
    this.dragT = 0;
  }
  // vx, vy in px/s, spin in rad/s around the chest-pelvis middle.
  kick(vx, vy, spin = 0, dt = 1 / 60) {
    const cx = (this.x[0] + this.x[1]) / 2, cy = (this.y[0] + this.y[1]) / 2;
    for (let i = 0; i < N; i++) {
      const rx = this.x[i] - cx, ry = this.y[i] - cy;
      this.px[i] = this.x[i] - (vx - ry * spin) * dt; this.py[i] = this.y[i] - (vy + rx * spin) * dt;
    }
    this.lastDt = dt;
  }
  push(i, vx, vy) { this.px[i] -= vx * this.lastDt; this.py[i] -= vy * this.lastDt; }
  vel(i = 0) { return [(this.x[i] - this.px[i]) / this.lastDt, (this.y[i] - this.py[i]) / this.lastDt]; }
  step(dt, arena, gravity) {
    if (dt <= 0) return;
    const steps = dt > 1 / 90 ? 2 : 1, h = dt / steps;
    for (let s = 0; s < steps; s++) this.sub(h, arena, gravity);
    this.t += dt;
    let mv = 0;
    for (let i = 0; i < N; i++) mv = Math.max(mv, Math.abs(this.x[i] - this.px[i]) + Math.abs(this.y[i] - this.py[i]));
    if (mv / this.lastDt < 46 && this.ground) this.still += dt; else this.still = 0;
  }
  sub(h, arena, G) {
    const { x, y, px, py, r, m } = this;
    const k = h / this.lastDt; this.lastDt = h;
    const damp = this.ground ? .985 : .998;
    for (let i = 0; i < N; i++) {
      const vx = (x[i] - px[i]) * k * damp, vy = (y[i] - py[i]) * k * damp;
      px[i] = x[i]; py[i] = y[i];
      x[i] += vx; y[i] += vy + G * h * h;
    }
    const f = this.face, d = this.d;
    for (let it = 0; it < 6; it++) {
      for (const c of this.con) this.link(c[0], c[1], c[2], 1);
      // keep the head off the hips and the knees off the chest
      this.minDist(2, 0, d.spine * .86 + d.hd * .5, .5); this.minDist(7, 1, d.spine * .62, .4); this.minDist(9, 1, d.spine * .62, .4);
      this.minDist(2, 7, d.hd * .8, .2); this.minDist(2, 9, d.hd * .8, .2);
      this.limit(0, 7, 8, f); this.limit(0, 9, 10, f); this.limit(1, 3, 4, -f); this.limit(1, 5, 6, -f);
      if (it > 2) this.collide(arena, h);
    }
    void m; void r;
  }
  link(a, b, L, k) {
    const { x, y, m } = this, dx = x[b] - x[a], dy = y[b] - y[a], D = Math.hypot(dx, dy) || 1e-4, w = m[a] + m[b], q = (D - L) / D / w * k;
    x[a] += dx * q * m[a]; y[a] += dy * q * m[a]; x[b] -= dx * q * m[b]; y[b] -= dy * q * m[b];
  }
  minDist(a, b, L, k) { const { x, y } = this, dx = x[b] - x[a], dy = y[b] - y[a]; if (dx * dx + dy * dy < L * L) this.link(a, b, L, k); }
  // Keeps the joint b of a-b-c bending to one side (sign of the cross product).
  limit(a, b, c, s) {
    const { x, y } = this, ux = x[b] - x[a], uy = y[b] - y[a], vx = x[c] - x[b], vy = y[c] - y[b], cr = (ux * vy - uy * vx) * s;
    if (cr >= 0) return;
    const L = Math.hypot(ux, uy) || 1, V = Math.hypot(vx, vy) || 1, tx = x[b] + ux / L * V, ty = y[b] + uy / L * V;
    x[c] += (tx - x[c]) * .35; y[c] += (ty - y[c]) * .35;
  }
  collide(ar, h) {
    const { x, y, px, py, r } = this;
    this.ground = false;
    const pelvisIn = x[0] > ar.ropeL && x[0] < ar.ropeR;
    if (ar.hasRing) {
      if (this.side === 'in' && !pelvisIn) { if (y[0] < ar.matY - ar.ropeH + 14 || this.over) this.side = 'out'; }
      else if (this.side === 'out' && pelvisIn && y[0] < ar.matY - 2) this.side = 'in';
    } else this.side = 'in';
    for (let i = 0; i < N; i++) {
      let g = ar.floorY;
      if (ar.hasRing) {
        const overMat = x[i] > ar.ropeL - ar.apron && x[i] < ar.ropeR + ar.apron;
        if (overMat && (this.side === 'in' || y[i] < ar.matY + 3)) g = ar.matY;
        if (this.side === 'out' && !overMat) g = ar.floorY;
        // ropes hold bodies that are not flying over them
        if (this.side === 'in' && !this.over) {
          const hgt = ar.matY - y[i];
          if (hgt < ar.ropeH + 6) {
            const lo = ar.ropeL + r[i] * .3, hi = ar.ropeR - r[i] * .3;
            if (x[i] < lo) { const p = lo - x[i]; x[i] += p * .5; if (px[i] > x[i]) px[i] = x[i] + (x[i] - px[i]) * .25; ar.press('L', p * 1.4); this.ropeHit = 1; }
            else if (x[i] > hi) { const p = x[i] - hi; x[i] -= p * .5; if (px[i] < x[i]) px[i] = x[i] + (x[i] - px[i]) * .25; ar.press('R', p * 1.4); this.ropeHit = 1; }
          }
        }
        if (this.side === 'out' && y[i] > ar.matY + 6) { // apron face
          const mid = (ar.ropeL + ar.ropeR) / 2, L = ar.ropeL - ar.apron - r[i], R = ar.ropeR + ar.apron + r[i];
          if (x[i] > L && x[i] < mid) { x[i] = L; px[i] = L + (L - px[i]) * .3; } else if (x[i] < R && x[i] >= mid) { x[i] = R; px[i] = R + (R - px[i]) * .3; }
        }
      }
      const lo = ar.x0 + r[i], hi = ar.x1 - r[i];
      if (x[i] < lo) { const v = (x[i] - px[i]) / h; x[i] = lo; px[i] = lo + (x[i] - px[i]) * 0 + v * h * .35; if (v < -120) this.hitWall = Math.max(this.hitWall, -v); }
      else if (x[i] > hi) { const v = (x[i] - px[i]) / h; x[i] = hi; px[i] = hi + v * h * .35; if (v > 120) this.hitWall = Math.max(this.hitWall, v); }
      const gy = g - r[i];
      if (y[i] > gy) {
        const vy = (y[i] - py[i]) / h, vx = x[i] - px[i];
        y[i] = gy;
        if (vy > 90) { this.hitGround = Math.max(this.hitGround, vy); py[i] = gy + vy * h * (i < 3 ? .3 : .2); } else py[i] = gy;
        px[i] = x[i] - vx * (i < 2 ? .82 : .7);
        if (i < 3) this.ground = true;
      }
    }
  }
  done() { return (this.still > .14 && this.t > .3) || this.t > this.maxT; }
  // Writes joints with exact limb lengths.
  toJoints(j) {
    const { x, y, d, face: f } = this, P = j.p;
    const set = (i, a, b) => { P[i * 2] = a; P[i * 2 + 1] = b; };
    let sx = x[1] - x[0], sy = y[1] - y[0];
    const L = Math.hypot(sx, sy) || 1; sx /= L; sy /= L;
    const fx = -sy * f, fy = sx * f; // facing normal of the torso
    set(J.pelvis, x[0], y[0]); set(J.chest, x[1], y[1]);
    set(J.neck, x[1] + sx * d.nk, y[1] + sy * d.nk);
    set(J.head, x[2], y[2]);
    const limb = (root, mid, end, rx, ry, a, b, L1, L2) => {
      let ux = x[a] - rx, uy = y[a] - ry, q = Math.hypot(ux, uy) || 1;
      const mx = rx + ux / q * L1, my = ry + uy / q * L1;
      ux = x[b] - mx; uy = y[b] - my; q = Math.hypot(ux, uy) || 1;
      set(root, rx, ry); set(mid, mx, my); set(end, mx + ux / q * L2, my + uy / q * L2);
    };
    limb(J.sN, J.eN, J.hN, x[1] + fx * d.sx[0] - sx * 1.5, y[1] + fy * d.sx[0] - sy * 1.5, 3, 4, d.ua, d.fa);
    limb(J.sF, J.eF, J.hF, x[1] + fx * d.sx[1] - sx * 1.5, y[1] + fy * d.sx[1] - sy * 1.5, 5, 6, d.ua, d.fa);
    limb(J.pN, J.kN, J.aN, x[0] + fx * d.hx[0], y[0] + fy * d.hx[0], 7, 8, d.th, d.sh);
    limb(J.pF, J.kF, J.aF, x[0] + fx * d.hx[1], y[0] + fy * d.hx[1], 9, 10, d.th, d.sh);
    for (const [k, a, t] of [[J.kN, J.aN, J.tN], [J.kF, J.aF, J.tF]]) {
      let vx = P[a * 2] - P[k * 2], vy = P[a * 2 + 1] - P[k * 2 + 1];
      const q = Math.hypot(vx, vy) || 1; vx /= q; vy /= q;
      set(t, P[a * 2] + vy * f * d.fl * .8, P[a * 2 + 1] - vx * f * d.fl * .8);
    }
    const ang = Math.atan2(sx, -sy) * 180 / Math.PI, hx = x[2] - P[J.neck * 2], hy = y[2] - P[J.neck * 2 + 1];
    j.S = ang; j.face = f; j.yaw = 1;
    const ha = Math.atan2(hx, -hy) * 180 / Math.PI;
    j.H = ha;
    return j;
  }
  // Which way is the chest pointing when the body rests?
  faceUp() { const sx = this.x[1] - this.x[0], sy = this.y[1] - this.y[0]; void sy; return sx * this.face < 0; }
  get cx() { return this.x[0]; }
  get cy() { return this.y[0]; }
  speed() { const v = this.vel(0); return Math.hypot(v[0], v[1]); }
}
const clampRag = clamp;

return { Ragdoll, clampRag };
})();
// ---- combat/StateMachine.js
__m["combat/StateMachine.js"] = (function () {
// Finite state machine. The table states which inputs a state reads, what can be done to a body in it,
// and which states may follow. Illegal transitions are refused and logged.

/* input: actions the state reads. hit: can be struck. grab: can be grabbed. air: gravity body without floor control.
   protect: outside systems may not force a reaction. next: voluntary transitions. */
const NEUTRAL_NEXT = ['IDLE', 'MOVE', 'JUMP', 'FALL', 'ATTACK', 'AIR_ATTACK', 'GUARD', 'DODGE', 'GRAB', 'COUNTER', 'FINISHER', 'TAUNT', 'CLIMB', 'ENTER_RING', 'EXIT_RING', 'ROPE', 'PIN', 'TAGWAIT', 'WRESTLING_MOVE', 'APRON'];
const STATES = {
  IDLE: { ko: '대기', input: ['move', 'jump', 'attack', 'grab', 'guard', 'dodge', 'fin'], hit: 1, next: NEUTRAL_NEXT },
  MOVE: { ko: '이동', input: ['move', 'jump', 'attack', 'grab', 'guard', 'dodge', 'fin'], hit: 1, next: NEUTRAL_NEXT },
  JUMP: { ko: '점프', input: ['move', 'attack'], hit: 1, air: 1, next: ['FALL', 'AIR_ATTACK', 'IDLE', 'MOVE', 'APRON'] },
  FALL: { ko: '낙하', input: ['move', 'attack'], hit: 1, air: 1, next: ['IDLE', 'MOVE', 'AIR_ATTACK', 'APRON'] },
  ATTACK: { ko: '공격', input: ['attack'], hit: 1, next: ['IDLE', 'MOVE', 'ATTACK', 'DODGE', 'FALL', 'FINISHER', 'GRAB'] },
  AIR_ATTACK: { ko: '공중 공격', input: [], hit: 1, air: 1, next: ['IDLE', 'GET_UP', 'FALL'] },
  GUARD: { ko: '방어', input: ['move', 'grab', 'dodge', 'guard', 'attack'], hit: 1, next: ['IDLE', 'MOVE', 'DODGE', 'GRAB', 'ATTACK', 'COUNTER', 'EXIT_RING', 'FALL', 'PIN', 'TAGWAIT', 'WRESTLING_MOVE'] },
  DODGE: { ko: '회피', input: [], hit: 1, next: ['IDLE', 'MOVE', 'COUNTER', 'FALL', 'WRESTLING_MOVE'] },
  HITSTUN: { ko: '피격 경직', input: ['burst'], hit: 1, next: ['IDLE', 'GET_UP', 'FALL', 'DOWN', 'JUMP'] },
  STAGGER: { ko: '비틀거림', input: ['burst', 'mash'], hit: 1, grab: 1, next: ['IDLE', 'JUMP'] },
  DOWN: { ko: '다운', input: ['burst', 'mash'], hit: 0, grab: 1, next: ['GET_UP', 'JUMP'] },
  GET_UP: { ko: '기상', input: [], hit: 0, next: ['IDLE', 'MOVE'] },
  GRAB: { ko: '잡기', input: ['move', 'grab', 'attack', 'dodge', 'fin'], hit: 1, next: ['IDLE', 'WRESTLING_MOVE', 'FINISHER', 'STAGGER'] },
  GRABBED: { ko: '잡힘', input: ['mash', 'burst', 'reverse'], hit: 0, next: ['IDLE', 'COUNTER', 'JUMP', 'STAGGER', 'WRESTLING_MOVE'] },
  WRESTLING_MOVE: { ko: '기술 발동', input: [], hit: 0, protect: 1, next: ['IDLE', 'GET_UP', 'STAGGER', 'GRABBED'] },
  COUNTER: { ko: '반격', input: [], hit: 0, protect: 1, next: ['IDLE', 'WRESTLING_MOVE'] },
  FINISHER: { ko: '피니셔', input: [], hit: 1, next: ['IDLE', 'GET_UP', 'WRESTLING_MOVE', 'FALL', 'STAGGER'] },
  KO: { ko: '패배', input: [], hit: 0, protect: 1, next: [] },
  // ring interaction
  ROPE: { ko: '로프 반동', input: ['attack', 'jump'], hit: 1, next: ['MOVE', 'IDLE', 'ATTACK', 'JUMP'] },
  WHIPPED: { ko: '로프행', input: ['dodge'], hit: 1, grab: 1, next: ['IDLE', 'ATTACK', 'MOVE', 'STAGGER'] },
  CLIMB: { ko: '코너 오르기', input: [], hit: 1, next: ['PERCH', 'FALL'] },
  PERCH: { ko: '코너 위', input: ['attack', 'jump', 'guard', 'move'], hit: 1, next: ['AIR_ATTACK', 'FALL', 'JUMP'] },
  HANG: { ko: '로프 매달림', input: ['jump', 'move', 'guard'], hit: 1, next: ['ENTER_RING', 'FALL'] },
  APRON: { ko: '에이프런', input: ['jump', 'move', 'guard', 'attack'], hit: 1, next: ['ENTER_RING', 'FALL', 'JUMP', 'TAGWAIT'] },
  ENTER_RING: { ko: '링 진입', input: [], hit: 1, next: ['IDLE'] },
  EXIT_RING: { ko: '링 밖으로', input: [], hit: 1, next: ['IDLE', 'APRON', 'TAGWAIT'] },
  // rules
  PIN: { ko: '핀폴', input: ['dodge', 'grab'], hit: 1, next: ['IDLE', 'GET_UP'] },
  PINNED: { ko: '핀 당함', input: ['mash'], hit: 0, next: ['GET_UP', 'DOWN'] },
  TAUNT: { ko: '도발', input: ['dodge'], hit: 1, next: ['IDLE', 'DODGE'] },
  TAGWAIT: { ko: '태그 대기', input: [], hit: 0, protect: 1, next: ['ENTER_RING', 'IDLE'] },
  INTRO: { ko: '입장', input: [], hit: 0, protect: 1, next: ['IDLE', 'ENTER_RING'] },
  OUT: { ko: '탈락', input: [], hit: 0, protect: 1, next: [] },
  WIN: { ko: '승리', input: [], hit: 0, protect: 1, next: ['IDLE'] },
};
// Reactions other systems may force on any unprotected body.
const REACTIONS = new Set(['HITSTUN', 'STAGGER', 'DOWN', 'GRABBED', 'KO', 'WHIPPED', 'PINNED', 'HANG', 'OUT', 'WIN', 'GET_UP', 'FALL', 'INTRO']);

class StateMachine {
  constructor(owner) { this.owner = owner; this.cur = 'IDLE'; this.prev = 'IDLE'; this.t = 0; this.refused = 0; this.log = []; this.onChange = null; }
  get def() { return STATES[this.cur]; }
  can(to, force) {
    if (!STATES[to]) return false;
    if (force) return true;
    const d = STATES[this.cur];
    if (REACTIONS.has(to)) return !d.protect;
    return d.next.includes(to);
  }
  // Returns false (and changes nothing) when the table does not allow it.
  set(to, opt = {}) {
    if (!this.can(to, opt.force)) {
      this.refused++;
      this.log.push(this.cur + '->' + to);
      if (this.log.length > 40) this.log.shift();
      return false;
    }
    const from = this.cur;
    this.prev = from; this.cur = to; this.t = 0;
    if (this.onChange) this.onChange(from, to, opt);
    return true;
  }
  is(...names) { return names.includes(this.cur); }
  reads(action) { return this.def.input.includes(action); }
}

return { STATES, REACTIONS, StateMachine };
})();
// ---- combat/CharacterController.js
__m["combat/CharacterController.js"] = (function () {
// One wrestler: stats, gauges, input buffer and the per-state control code. The same code drives humans and AI;
// both only write an Intent.
const { clamp, approach, sgn } = __m["core/util.js"];
const { BALANCE: B, ATTACKS } = __m["data/balance.js"];
const { FINISHERS } = __m["data/moves.js"];
const { dimsFor, Joints } = __m["anim/skeleton.js"];
const { Ragdoll } = __m["anim/ragdoll.js"];
const { StateMachine, STATES } = __m["combat/StateMachine.js"];
function newIntent() { return { mx: 0, up: false, down: false, downEdge: false, jump: false, atk: false, grab: false, dodge: false, fin: false }; }
const BUF_KEYS = ['jump', 'atk', 'grab', 'dodge', 'fin', 'downEdge'];

class Fighter {
  constructor(match, char, o = {}) {
    this.match = match; this.idx = o.idx || 0; this.team = o.team != null ? o.team : this.idx; this.char = char; this.charId = char.id;
    this.name = o.name || char.name; this.look = o.look || char.look; this.ctrl = o.ctrl || 'ai'; this.difficulty = o.difficulty || 'normal';
    this.dims = dimsFor(this.look.build, this.look.scale || 1);
    const s = this.stats = Object.assign({}, char.stats, o.stats || {});
    this.maxHp = s.hp; this.maxStun = s.stun; this.hp = this.maxHp * (o.hpStart != null ? o.hpStart : 1); this.stun = this.maxStun; this.fin = o.fin || 0;
    this.moves = o.moves || char.moves; this.chain = o.chain || char.chain; this.finisherId = o.finisher || char.finisher; this.equip = o.equip || null;
    this.downs = 0; this.falls = 0; this.dmgTaken = 0; this.dmgDealt = 0; this.finishersTaken = 0; this.ringOuts = 0; this.kills = 0; this.hitsLanded = 0; this.movesDone = new Set(); this.counters = 0;
    this.x = o.x || 450; this.y = o.y || 0; this.vx = 0; this.vy = 0; this.face = o.face || 1; this.side = o.side || 'in'; this.ground = true; this.lane = o.lane || 0;
    this.fsm = new StateMachine(this);
    this.fsm.onChange = (a, b, opt) => this.onState(a, b, opt);
    this.intent = newIntent(); this.buf = {}; for (const k of BUF_KEYS) this.buf[k] = 0;
    this.joints = new Joints(); this.poseT = 0; this.gait = 0; this.clipName = null; this.clipT = 0; this.blend = null;
    this.rag = null; this.link = null; this.atk = null; this.target = null;
    this.inv = 0; this.grabImm = 0; this.dodgeCd = 0; this.counterCd = 0; this.burstCd = 0; this.regenDelay = 0; this.flash = 0; this.hitShake = 0; this.landT = 0; this.boost = 0; this.staleList = []; this.moveStale = {};
    this.combo = { n: 0, t: 0, dmg: 0 }; this.chainN = 0; this.chainT = 0; this.holdT = 0; this.running = false; this.lastTap = { dir: 0, t: -9 }; this.prevMx = 0; this.guardT = 0; this.whip = null; this.expr = 'neutral'; this.exprT = 0; this.mash = 0; this.escape = 0; this.protect = 0;
    this.outCount = 0; this.eliminated = false; this.tagged = true; this.partner = null; this.legal = true; this.ai = null; this.tails = null; this.sweat = 0; this.touchRope = null; this.gettingUp = null; this.pinTries = 0; this.tagRecover = 0; this.kills = 0; this.perfects = 0;
    this.cpuTime = 0;
  }
  get st() { return this.fsm.cur; }
  get t() { return this.fsm.t; }
  get arena() { return this.match.arena; }
  get h() { return this.dims.height; }
  get alive() { return !this.eliminated && this.st !== 'KO' && this.st !== 'OUT'; }
  get airborne() { return !this.ground; }
  get standing() { return this.fsm.is('IDLE', 'MOVE', 'GUARD', 'ATTACK', 'TAUNT', 'DODGE', 'ROPE'); }
  get exhausted() { return this.hp <= this.maxHp * .22; }
  get grabbable() { return this.alive && this.grabImm <= 0 && !this.link && ((this.st === 'DOWN' && (!this.rag || this.rag.ground)) || this.st === 'STAGGER' || (this.st === 'WHIPPED' && this.whip && this.whip.back)) && this.ground !== false; }
  get finisher() { return FINISHERS[this.finisherId]; }
  isFoe(o) { return o !== this && o.team !== this.team; }
  // ---- state changes ----
  set(to, opt) { return this.fsm.set(to, opt); }
  onState(from, to, opt) {
    this.match.anim.changed(this, from, to, opt);
    if (to !== 'ATTACK' && to !== 'AIR_ATTACK' && to !== 'FINISHER') this.atk = null;
    if (to !== 'HITSTUN' && to !== 'DOWN' && to !== 'KO' && to !== 'OUT' && to !== 'PINNED') this.dropRag();
    if (to === 'IDLE' || to === 'MOVE') this.whip = null;
    if (to !== 'GUARD') this.guardT = 0;
    this.match.emit('state', { f: this, from, to });
  }
  dropRag() { if (this.rag) { this.match.anim.freezeBlend(this, .16); this.rag = null; } }
  ragdoll(vx, vy, spin = 0, over = false) {
    const r = new Ragdoll(this.joints, this.dims, this.face);
    r.side = this.side; r.over = over;
    r.kick(vx, vy, spin);
    this.rag = r; this.ground = false;
    return r;
  }
  // ---- input ----
  readIntent(dt) {
    const I = this.intent;
    for (const k of BUF_KEYS) { if (I[k]) this.buf[k] = B.inputBuffer; else if (this.buf[k] > 0) this.buf[k] -= dt; }
    const m = Math.abs(I.mx) > .3 ? sgn(I.mx) : 0;
    if (m !== 0 && m !== this.prevMx) {
      if (this.lastTap.dir === m && this.match.time - this.lastTap.t < B.doubleTap) this.running = true;
      this.lastTap = { dir: m, t: this.match.time };
      this.holdT = 0;
    }
    if (m === 0) { this.holdT = 0; if (this.prevMx !== 0) this.runStop = this.match.time; if (this.match.time - (this.runStop || 0) > .1) this.running = false; } else { this.holdT += dt; if (this.holdT > B.runAfter) this.running = true; if (m !== this.prevMx && this.prevMx !== 0) this.running = false; }
    this.prevMx = m;
  }
  has(k) { return this.buf[k] > 0; }
  consume(k) { if (this.buf[k] > 0) { this.buf[k] = 0; return true; } return false; }
  clearBuf() { for (const k of BUF_KEYS) this.buf[k] = 0; }
  // ---- targeting ----
  nearestFoe(max = 1e9, test) {
    let best = null, bd = max;
    for (const o of this.match.fighters) {
      if (!this.isFoe(o) || !o.alive || o.st === 'TAGWAIT' || o.st === 'INTRO') continue;
      if (test && !test(o)) continue;
      const d = Math.abs(o.x - this.x) + Math.abs(o.y - this.y) * .6;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  updateTarget() {
    const cur = this.target;
    if (cur && cur.alive && this.isFoe(cur) && cur.st !== 'TAGWAIT' && this.ctrl === 'ai') { const n = this.nearestFoe(); if (n && n !== cur && Math.abs(n.x - this.x) + 60 < Math.abs(cur.x - this.x)) this.target = n; return; }
    this.target = this.nearestFoe();
  }
  faceFoe(range = 90) { const n = this.nearestFoe(range, o => o.side === this.side || Math.abs(o.x - this.x) < 60); if (n && Math.abs(n.x - this.x) > 4) this.face = sgn(n.x - this.x); }
  // ---- per frame ----
  tick(dt) {
    this.fsm.t += dt; this.clipT += dt; this.poseT += dt;
    for (const k of ['inv', 'grabImm', 'dodgeCd', 'counterCd', 'burstCd', 'regenDelay', 'flash', 'hitShake', 'landT', 'boost', 'exprT', 'protect']) if (this[k] > 0) this[k] = Math.max(0, this[k] - dt);
    if (this.chainT > 0) { this.chainT -= dt; if (this.chainT <= 0) this.chainN = 0; }
    if (this.standing) { this.freeT = (this.freeT || 0) + dt; if (this.freeT > 1.6) this.grabCount = 0; } else this.freeT = 0;
    if (this.combo.t > 0) { this.combo.t -= dt; if (this.combo.t <= 0) { this.combo.n = 0; this.combo.dmg = 0; } }
    this.readIntent(dt);
    this.updateTarget();
    if (this.rag) { this.x = this.rag.cx; this.side = this.rag.side; }
    const fn = CONTROL[this.st];
    if (fn) fn(this, this.intent, dt);
  }
}

// ---- shared pieces -------------------------------------------------------------------------------------
function groundMove(f, I, dt, scale = 1) {
  const run = f.running && Math.abs(I.mx) > .3;
  const spd = (run ? B.run : B.walk) * f.stats.spd * scale * (f.boost > 0 ? B.ropeBoost : 1) * (f.exhausted ? .9 : 1);
  const want = Math.abs(I.mx) > .3 ? sgn(I.mx) * spd : 0;
  f.vx = approach(f.vx, want, (want ? B.accel : B.decel) * dt);
  if (want && scale > 0) f.face = sgn(want);
}
function friction(f, dt, k = 1) { f.vx = approach(f.vx, 0, B.decel * k * dt); }
function toFall(f) { if (!f.ground && !f.rag && !f.link) { f.set('FALL'); return true; } return false; }
function recover(f) { f.set(f.ground ? 'IDLE' : 'FALL'); }

function startAttack(f, def, o = {}) {
  if (!f.set(def.air ? 'AIR_ATTACK' : 'ATTACK')) return false;
  f.atk = { def, t: 0, hit: new Set(), connected: false, chain: o.chain != null ? o.chain : -1, boost: f.boost > 0 ? 1.25 : 1, done: false };
  f.match.emit('swing', { f, def });
  return true;
}
function chooseAttack(f, I) {
  const dirHeld = Math.abs(I.mx) > .3;
  // a downed foe in reach and nobody standing closer: ground attack
  const downed = f.nearestFoe(54, o => (o.st === 'DOWN' || o.st === 'PINNED') && o.side === f.side && Math.abs(o.y - f.y) < 30);
  const standing = f.nearestFoe(62, o => o.st !== 'DOWN' && o.st !== 'PINNED');
  if (dirHeld) f.face = sgn(I.mx);
  else if (standing && Math.abs(standing.x - f.x) < 62) f.face = sgn(standing.x - f.x) || f.face;
  else if (downed) f.face = sgn(downed.x - f.x) || f.face;
  if ((f.running || f.boost > 0) && Math.abs(f.vx) > 110 && sgn(f.vx) === f.face) { const d = ATTACKS[f.char.run]; f.vx = f.face * Math.max(Math.abs(f.vx), B.run * f.stats.spd) * (f.boost > 0 ? 1.1 : 1); if (startAttack(f, d)) { if (d.hop) { f.vy = -d.hop; f.ground = false; } } return; }
  if (downed && !(standing && Math.abs(standing.x - f.x) < Math.abs(downed.x - f.x) + 8)) { startAttack(f, ATTACKS[f.char.ground || 'stomp']); f.vx = clamp((downed.x - f.x) * 2.4, -90, 90); return; }
  const n = f.chainT > 0 ? f.chainN : 0;
  const def = ATTACKS[f.chain[Math.min(n, f.chain.length - 1)]];
  if (startAttack(f, def, { chain: Math.min(n, f.chain.length - 1) })) {
    f.chainN = n + 1 >= f.chain.length ? 0 : n + 1; f.chainT = B.comboWindow;
    if (dirHeld) f.vx = Math.max(Math.abs(f.vx), 60 * f.stats.spd) * f.face * (def.lv >= 3 ? 1.5 : 1.1); else f.vx *= .4;
  }
}
function startJump(f, I) {
  const ar = f.arena, m = f.match;
  // contextual W: climb the corner, enter the ring
  if (ar.hasRing && f.side === 'in') {
    const nr = ar.nearRope(f.x);
    if (nr.dist < 34 && sgn(I.mx || f.face) === nr.dir && m.rules.climb !== false) { f.climbDir = nr.dir; f.face = nr.dir; if (f.set('CLIMB')) { f.vx = 0; m.emit('climb', { f }); return; } }
  }
  if (ar.hasRing && f.side === 'out' && f.y > ar.matY + 4) {
    const dl = Math.abs(f.x - (ar.ropeL - ar.apron)), dr = Math.abs(f.x - (ar.ropeR + ar.apron));
    if (Math.min(dl, dr) < 46) { beginEnter(f); return; }
  }
  f.vy = -B.jump * Math.sqrt(f.stats.jump) * (f.boost > 0 ? 1.06 : 1); f.ground = false;
  // Vaulting over the top rope is a choice: running at the ropes and jumping, where the rules allow leaving.
  f.vault = false;
  if (ar.hasRing && f.side === 'in' && m.rules.ringOut === 'count' && Math.abs(f.vx) > 120) { const nr = ar.nearRope(f.x); if (nr.dist < 70 && sgn(f.vx) === nr.dir) f.vault = true; }
  f.set('JUMP');
  m.emit('jump', { f });
}
function beginEnter(f) {
  const ar = f.arena, left = f.x < ar.mid;
  f.enter = { x0: f.x, y0: f.y, x1: left ? ar.ropeL + 26 : ar.ropeR - 26, left };
  f.face = left ? 1 : -1; f.vx = f.vy = 0;
  f.set('ENTER_RING', { force: f.st === 'INTRO' || f.st === 'TAGWAIT' });
}
function beginExit(f, dir) {
  const ar = f.arena;
  f.enter = { x0: f.x, y0: f.y, x1: dir < 0 ? ar.ropeL - ar.apron - 18 : ar.ropeR + ar.apron + 18, left: dir < 0 };
  f.face = dir; f.vx = f.vy = 0;
  f.set('EXIT_RING');
}
function startDodge(f, I) {
  if (f.dodgeCd > 0) return false;
  const dir = Math.abs(I.mx) > .3 ? sgn(I.mx) : 0;
  if (!dir) f.faceFoe(140); // facing the danger makes the counter possible
  if (!f.set('DODGE')) return false;
  f.dodge = { dir, dodged: false, back: !dir };
  f.dodgeCd = B.dodgeCd;
  f.vx = dir ? dir * B.dodgeSpeed * (.85 + .15 * f.stats.spd) : -f.face * 190;
  if (dir) f.face = dir;
  f.match.emit('dodgeStart', { f });
  return true;
}
// S + L: burst out of trouble. Costs finisher gauge and has a long cooldown.
function tryBurst(f) {
  if (f.burstCd > 0 || f.fin < B.burstCost || f.st === 'KO') return false;
  if (f.link && f.link.kind === 'move') return false;
  f.fin -= B.burstCost; f.burstCd = B.burstCd;
  const m = f.match;
  if (f.link) m.grapple.breakLink(f.link, 'burst');
  if (f.rag) { f.x = f.rag.cx; f.y = f.arena.ground(f.x, f.rag.cy, f.side); f.dropRag(); }
  f.inv = .9; f.grabImm = 1; f.stun = Math.max(f.stun, f.maxStun * .35);
  f.set('JUMP', { force: true });
  f.ground = false; f.vy = -190; f.vx = 0;
  for (const o of m.fighters) if (f.isFoe(o) && o.alive && !o.link && Math.abs(o.x - f.x) < B.burstRange && Math.abs(o.y - f.y) < 70 && STATES[o.st].hit) m.combat.knock(o, sgn(o.x - f.x) * 260, -150, 3, f);
  m.emit('burst', { f });
  return true;
}
function burstInput(f, I) { return I.down && f.has('dodge'); }
function mashInput(f) { let n = 0; for (const k of ['atk', 'grab', 'dodge', 'jump']) if (f.buf[k] >= B.inputBuffer - 1e-6) n++; return n; }

// ---- state control table -------------------------------------------------------------------------------
const CONTROL = {
  IDLE: neutral, MOVE: neutral,
  JUMP(f, I, dt) { air(f, I, dt); if (f.vy > 0 && f.st === 'JUMP') f.set('FALL'); },
  FALL: air,
  ATTACK(f, I, dt) {
    const a = f.atk;
    if (!a) { recover(f); return; }
    const d = a.def;
    a.t += dt;
    if (d.run) { const k = d.carry || .8; if (a.t < d.startup + d.active) f.vx = f.face * Math.max(Math.abs(f.vx) * (1 - dt * .9), 120 * k); else friction(f, dt, .55); }
    else if (a.t > d.startup * .6) friction(f, dt, .6);
    let rec = d.recover;
    const repeats = f.staleList.filter(x => x === d.id).length;
    if (repeats >= 3 && !d.run) rec *= B.repeatRecover;
    if (!a.connected && d.lv >= 3) rec *= 1.18;
    const total = d.startup + d.active + rec;
    if (a.connected && a.chain >= 0 && a.t > d.startup + d.active + .03 && a.chain < f.chain.length - 1 && f.has('atk')) { f.consume('atk'); f.set('IDLE', { force: true }); chooseAttack(f, I); return; }
    if (a.connected && a.t > d.startup + d.active + .02) {
      if (f.has('fin') && f.fin >= B.finMax && f.match.finisher.start(f)) { f.consume('fin'); return; }
      if (f.has('dodge') && !I.down && startDodge(f, I)) { f.consume('dodge'); return; }
    }
    if (a.t >= total) recover(f);
  },
  AIR_ATTACK(f, I, dt) {
    const a = f.atk;
    if (!a) { f.set('FALL', { force: true }); return; }
    a.t += dt;
    if (f.ground && a.t > .05) { landAttack(f, a); return; }
  },
  GUARD(f, I, dt) {
    f.guardT += dt; friction(f, dt, 1.2);
    if (toFall(f)) return;
    if (Math.abs(I.mx) > .3) f.face = sgn(I.mx);
    if (f.consume('dodge')) { if (startDodge(f, I)) return; }
    if (f.consume('grab')) { if (f.match.grapple.tryGrab(f, I)) return; }
    if (f.consume('atk')) { chooseAttack(f, Object.assign({}, I, { mx: 0 })); return; }
    const ar = f.arena;
    if (ar.hasRing && f.side === 'in' && Math.abs(I.mx) > .3) { const nr = ar.nearRope(f.x); if (nr.dist < 30 && sgn(I.mx) === nr.dir && f.guardT > .22 && f.match.rules.leave !== false) { beginExit(f, nr.dir); return; } }
    if (!I.down) f.set('IDLE');
  },
  DODGE(f, I, dt) {
    const T = f.dodge.back ? B.backstepTime : B.dodgeTime;
    const [a, b] = B.dodgeInv;
    f.invDodge = f.t >= a && f.t <= b;
    if (f.t > T * .62) friction(f, dt, .8);
    if (f.t >= T) { f.invDodge = false; recover(f); }
  },
  HITSTUN(f, I, dt) {
    if (burstInput(f, I) && tryBurst(f)) { f.clearBuf(); return; }
    const k = f.hsKind;
    if (k === 'launch') {
      if (f.rag && f.rag.done()) { settle(f); standUp(f, f.hp <= 0 ? .5 : 0); }
      else if (!f.rag) standUp(f, 0);
      return;
    }
    friction(f, dt, k === 'lie' ? .7 : .45);
    if (f.t >= f.hs) { if (k === 'lie') standUp(f, 0, f.lieClip); else recover(f); }
  },
  STAGGER(f, I, dt) {
    if (burstInput(f, I) && tryBurst(f)) { f.clearBuf(); return; }
    friction(f, dt, .5);
    f.hs -= mashInput(f) * .035;
    if (f.t >= f.hs) { f.grabImm = .6; recover(f); }
  },
  DOWN(f, I, dt) {
    if (f.rag) {
      if (f.rag.done()) { settle(f); f.downClock = 0; }
      else if (f.rag.t > .5 && burstInput(f, I) && tryBurst(f)) f.clearBuf();
      return;
    }
    if (burstInput(f, I) && tryBurst(f)) { f.clearBuf(); return; }
    friction(f, dt, 1);
    f.downClock = (f.downClock || 0) + dt * (.75 + .25 * f.stats.down) + mashInput(f) * B.mashDown;
    if (f.downClock >= f.downTime) standUp(f, 0);
  },
  GET_UP(f, I, dt) {
    friction(f, dt, 1.5);
    if (f.gettingUp.wait > 0) { f.gettingUp.wait -= dt; f.clipT = 0; return; }
    if (f.clipT >= f.gettingUp.dur) { f.inv = Math.max(f.inv, f.gettingUp.prot); f.protect = f.gettingUp.prot; f.gettingUp = null; recover(f); }
  },
  GRAB(f, I, dt) { f.match.grapple.holdControl(f, I, dt); },
  GRABBED(f, I, dt) { f.match.grapple.heldControl(f, I, dt); },
  FINISHER(f, I, dt) { f.match.finisher.control(f, I, dt); },
  ROPE(f, I, dt) {
    const r = f.ropeRun;
    const k = clamp(f.t / B.ropeLean, 0, 1);
    f.x = r.x + r.dir * Math.sin(k * Math.PI) * 13;
    f.arena.press(r.dir < 0 ? 'L' : 'R', Math.sin(k * Math.PI) * 17);
    f.vx = 0; f.face = f.t > B.ropeLean * .5 ? -r.dir : r.dir;
    if (f.t >= B.ropeLean) {
      f.x = r.x; f.face = -r.dir; f.vx = -r.dir * B.run * f.stats.spd * B.ropeBoost; f.boost = B.ropeBoostTime; f.running = true;
      f.arena.twang(r.dir < 0 ? 'L' : 'R', -190);
      f.match.emit('rope', { f, side: r.dir < 0 ? 'L' : 'R' });
      f.set('MOVE');
      f.ropeGo = { dir: -r.dir, t: .34 };
    }
  },
  WHIPPED(f, I, dt) {
    const w = f.whip;
    if (!w) { recover(f); return; }
    w.t += dt;
    f.vx = w.dir * w.speed; f.face = w.dir;
    if (w.lean > 0) {
      w.lean -= dt; const k = 1 - w.lean / B.ropeLean;
      f.vx = 0; f.x = w.rx + w.rd * Math.sin(clamp(k, 0, 1) * Math.PI) * 15;
      f.arena.press(w.rd < 0 ? 'L' : 'R', Math.sin(clamp(k, 0, 1) * Math.PI) * 19);
      if (w.lean <= 0) { w.dir = -w.rd; w.back = true; w.t = 0; w.speed = 262; f.x = w.rx; f.arena.twang(w.rd < 0 ? 'L' : 'R', -200); f.match.emit('rope', { f, side: w.rd < 0 ? 'L' : 'R', whip: true }); }
      return;
    }
    if (!w.back && f.touchRope) { w.lean = B.ropeLean; w.rd = f.touchRope === 'L' ? -1 : 1; w.rx = f.x; return; }
    if (!w.back && w.t > 1.6) { recover(f); return; }
    if (w.back) {
      if (w.t > .2 && f.consume('dodge')) { f.grabImm = .5; recover(f); return; }
      if (w.t > .3 && f.consume('atk')) { f.running = true; f.set('IDLE', { force: true }); f.vx = w.dir * 230; startAttack(f, ATTACKS[f.char.run]); return; }
      if (w.t > w.max || (f.touchRope && w.t > .2)) { f.grabImm = .3; f.vx *= .4; recover(f); }
    }
  },
  CLIMB(f, I, dt) {
    const ar = f.arena, k = clamp(f.t / .44, 0, 1), d = f.climbDir;
    const tx = d < 0 ? ar.ropeL + 4 : ar.ropeR - 4;
    f.x = f.x + (tx - f.x) * Math.min(1, dt * 9); f.y = ar.matY - (ar.ropeH + 3) * k; f.vx = f.vy = 0; f.ground = true;
    if (f.t >= .44) { f.face = -d; f.x = tx; f.set('PERCH'); }
  },
  PERCH(f, I, dt) {
    const ar = f.arena;
    f.vx = f.vy = 0; f.y = ar.matY - ar.ropeH - 3; f.ground = true;
    if (f.t < .12) return;
    if (f.consume('atk')) { dive(f, I); return; }
    if (f.consume('jump')) { f.vy = -B.jump * .8; f.vx = f.face * 120; f.ground = false; f.set('JUMP'); f.match.emit('jump', { f }); return; }
    if (I.down || f.t > B.perchTime || f.consume('grab') || f.consume('dodge')) { f.vy = -60; f.vx = f.face * 60; f.ground = false; f.set('FALL', { force: true }); }
  },
  HANG(f, I, dt) {
    const ar = f.arena, left = f.x < ar.mid;
    f.x = left ? ar.ropeL - 9 : ar.ropeR + 9; f.y = ar.matY + 26; f.vx = f.vy = 0; f.ground = true; f.face = left ? 1 : -1;
    f.hangT -= dt;
    f.hangMash = (f.hangMash || 0) + mashInput(f) * .14 + ((I.up || sgn(I.mx) === f.face && Math.abs(I.mx) > .3) ? dt * .9 : 0);
    if (f.t > .25 && f.hangMash >= 1) { f.hangMash = 0; beginEnter(f); return; }
    if (f.hangT <= 0 || (I.down && f.t > .4)) { f.hangMash = 0; f.ground = false; f.vy = 20; f.side = 'out'; f.set('FALL', { force: true }); f.match.emit('hangFail', { f }); }
  },
  APRON(f, I, dt) {
    const ar = f.arena, left = f.x < ar.mid, inward = left ? 1 : -1;
    f.vx = f.vy = 0; f.y = ar.matY; f.ground = true; f.face = inward;
    if (f.t < .1) return;
    if (f.consume('jump') || sgn(I.mx) === inward && Math.abs(I.mx) > .3 && f.t > .18) { beginEnter(f); return; }
    if (I.down || (sgn(I.mx) === -inward && Math.abs(I.mx) > .3)) { f.ground = false; f.vx = -inward * 90; f.vy = -60; f.set('FALL'); }
  },
  ENTER_RING(f, I, dt) {
    const ar = f.arena, e = f.enter, k = clamp(f.t / .55, 0, 1), s = k * k * (3 - 2 * k);
    f.x = e.x0 + (e.x1 - e.x0) * s; f.y = e.y0 + (ar.matY - e.y0) * Math.min(1, s * 1.7) - Math.sin(k * Math.PI) * 14; f.vx = f.vy = 0; f.ground = true; f.side = k > .5 ? 'in' : f.side;
    if (k >= 1) { f.side = 'in'; f.y = ar.matY; f.x = e.x1; f.inv = Math.max(f.inv, .25); f.enter = null; f.set('IDLE'); }
  },
  EXIT_RING(f, I, dt) {
    const ar = f.arena, e = f.enter, k = clamp(f.t / .5, 0, 1), s = k * k * (3 - 2 * k);
    const ty = f.exitTo === 'apron' ? ar.matY : ar.floorY;
    f.x = e.x0 + (e.x1 - e.x0) * s; f.y = e.y0 + (ty - e.y0) * Math.max(0, s * 2 - 1) - Math.sin(k * Math.PI) * 16; f.vx = f.vy = 0; f.ground = true; f.side = k > .45 ? 'out' : f.side;
    if (k >= 1) { f.side = 'out'; f.y = ty; f.x = e.x1; f.enter = null; if (f.exitTo === 'apron') { f.exitTo = null; f.set('TAGWAIT', { force: true }); } else f.set('IDLE'); }
  },
  PIN(f, I, dt) { f.match.pinControl(f, I, dt); },
  PINNED(f, I, dt) { },
  TAUNT(f, I, dt) {
    friction(f, dt, 1.2);
    if (f.t > .15 && f.has('dodge') && !I.down) { f.consume('dodge'); if (startDodge(f, I)) return; }
    if (f.t >= B.tauntTime) { f.match.combat.addFin(f, B.finTaunt); f.match.addHype(7); f.match.emit('tauntDone', { f }); recover(f); }
  },
  TAGWAIT(f, I, dt) { const ar = f.arena; f.vx = f.vy = 0; f.y = ar.matY; f.ground = true; f.face = f.x < ar.mid ? 1 : -1; },
  KO(f, I, dt) { if (f.rag && f.rag.done()) settle(f); else if (!f.rag) friction(f, dt, 1); },
  OUT(f, I, dt) { if (f.rag && f.rag.done()) settle(f); },
};
function neutral(f, I, dt) {
  const m = f.match;
  if (toFall(f)) return;
  if (f.ropeGo) { // carried by the rope for a moment
    f.ropeGo.t -= dt;
    f.vx = f.ropeGo.dir * Math.max(Math.abs(f.vx), B.run * f.stats.spd * 1.1); f.face = f.ropeGo.dir; f.running = true;
    if (f.consume('atk')) { f.ropeGo = null; chooseAttack(f, Object.assign({}, I, { mx: 0 })); return; }
    if (f.consume('jump')) { f.ropeGo = null; startJump(f, I); return; }
    if (f.consume('dodge')) { f.ropeGo = null; startDodge(f, I); return; }
    if (f.consume('grab')) { f.ropeGo = null; if (m.grapple.tryGrab(f, I)) return; }
    if (f.ropeGo && (f.ropeGo.t <= 0 || f.touchRope || sgn(I.mx) === -f.ropeGo.dir && Math.abs(I.mx) > .3)) f.ropeGo = null;
    return;
  }
  if (f.landT > 0) { friction(f, dt, 1); if (f.landT > .06) return; }
  if (m.phase !== 'fight') { friction(f, dt, 1); if (f.st === 'MOVE') f.set('IDLE'); return; }
  if (f.has('fin')) { f.consume('fin'); if (f.fin >= B.finMax) { if (m.finisher.start(f)) return; } else if (Math.abs(f.vx) < 60) { if (f.set('TAUNT')) { f.vx = 0; m.emit('taunt', { f }); return; } } }
  if (f.has('dodge') && !I.down) { f.consume('dodge'); if (startDodge(f, I)) return; }
  if (f.has('grab')) { f.consume('grab'); if (m.grapple.tryGrab(f, I)) return; }
  if (f.has('atk')) { f.consume('atk'); chooseAttack(f, I); return; }
  if (f.has('jump')) { f.consume('jump'); startJump(f, I); return; }
  if (f.has('downEdge') && m.contextS(f, I)) { f.consume('downEdge'); return; }
  if (I.down) { f.faceFoe(120); if (f.set('GUARD')) { f.running = false; return; } }
  groundMove(f, I, dt);
  if (f.touchRope && f.side === 'in' && f.arena.hasRing) {
    const dir = f.touchRope === 'L' ? -1 : 1;
    if (Math.abs(f.lastVx || 0) > 150 && sgn(f.lastVx) === dir && f.running) { f.ropeRun = { dir, x: f.x }; if (f.set('ROPE')) { m.emit('ropeHit', { f, side: f.touchRope }); return; } }
    else if (Math.abs(I.mx) > .3 && sgn(I.mx) === dir) f.arena.press(f.touchRope, 5);
  }
  if (Math.abs(f.vx) > 8) { if (f.st !== 'MOVE') f.set('MOVE'); } else if (f.st !== 'IDLE') f.set('IDLE');
}
function air(f, I, dt) {
  const want = Math.abs(I.mx) > .3 ? sgn(I.mx) * B.walk * 1.35 * f.stats.spd : 0;
  if (want) f.vx = approach(f.vx, Math.abs(f.vx) > Math.abs(want) && sgn(f.vx) === sgn(want) ? f.vx : want, B.airAccel * dt);
  if (f.ground) {
    f.landT = .12; f.match.emit('land', { f });
    if (f.arena.hasRing && f.side === 'out' && f.y <= f.arena.matY + 2 && f.arena.overMat(f.x)) { f.set('APRON', { force: true }); return; }
    f.set('IDLE');
    return;
  }
  if (f.has('atk') && f.match.phase === 'fight') {
    f.consume('atk');
    if (Math.abs(I.mx) > .3) f.face = sgn(I.mx);
    else { const n = f.nearestFoe(150); if (n && Math.abs(n.x - f.x) > 10) f.face = sgn(n.x - f.x); }
    const d = ATTACKS[f.char.air];
    if (startAttack(f, d)) { f.vx = f.face * Math.max(Math.abs(f.vx), d.push * 1.1) + f.face * d.push * .35; f.vy = Math.min(f.vy, -60) + (f.vy > 60 ? 0 : -30); }
  }
}
function dive(f, I) {
  const d = ATTACKS[f.char.dive], n = f.nearestFoe(330, o => Math.abs(o.x - f.x) > 20 && sgn(o.x - f.x) === f.face);
  const dx = n ? Math.abs(n.x - f.x) : 130;
  const T = .69;
  f.vy = -250; f.vx = f.face * clamp(dx / T * (Math.abs(I.mx) > .3 ? 1.12 : 1), 70, 330); f.ground = false;
  if (startAttack(f, d)) f.match.emit('dive', { f });
}
function landAttack(f, a) {
  const d = a.def, ok = a.connected;
  f.match.emit('landAttack', { f, def: d, ok });
  if (d.quake && !ok) { for (const o of f.match.fighters) if (f.isFoe(o) && o.alive && o.ground && Math.abs(o.x - f.x) < d.quake * .5 && STATES[o.st].hit && o.inv <= 0 && !o.link) f.match.combat.stunOnly(o, 8, f); }
  f.hs = d.recover * (ok ? .62 : d.dive ? 1.5 : 1.1);
  const lie = d.fallBack ? 'downSup' : d.fallFront ? 'downProne' : d.fallSit ? 'sit' : null;
  f.vx *= .5;
  if (lie) { f.lieClip = lie; f.hsKind = 'lie'; } else { f.hsKind = 'landlag'; f.hs = Math.min(f.hs, .22); }
  f.set('HITSTUN', { force: true, clip: lie || 'land' });
}
// Ragdoll came to rest: hand the body back to animation.
function settle(f) {
  const r = f.rag;
  f.x = r.cx; f.side = r.side; f.y = f.arena.ground(f.x, r.cy, f.side); f.ground = true; f.vx = f.vy = 0;
  f.lieClip = r.faceUp() ? 'downSup' : 'downProne';
  f.match.anim.freezeBlend(f, .22);
  f.rag = null;
}
function standUp(f, wait = 0, lie) {
  const L = lie || f.lieClip || 'downSup', pro = L === 'downProne';
  const quick = f.stats.spd * f.stats.jump > 1.25 && !pro && L !== 'sit';
  f.gettingUp = { wait, dur: .56, prot: f.st === 'DOWN' ? B.getUpProtect : B.hitGetUpProtect, clip: L === 'sit' ? 'getupProne' : quick ? 'kipup' : pro ? 'getupProne' : 'getupSup' };
  const wasDown = f.st === 'DOWN' || f.st === 'PINNED';
  f.set('GET_UP', { force: true });
  f.inv = Math.max(f.inv, .6);
  if (wasDown) { f.stun = Math.max(f.stun, f.maxStun * Math.max(B.stunAfterDownMin, B.stunAfterDown - B.stunAfterDownLoss * (f.downs - 1))); f.grabImm = 0; f.combo.n = 0; f.grabCount = 0; f.postMove = false; }
}

return { newIntent, Fighter, startAttack, beginEnter, tryBurst, CONTROL, settle, standUp };
})();
// ---- combat/PhysicsSystem.js
__m["combat/PhysicsSystem.js"] = (function () {
// Gravity, floors, ropes, walls, body separation and ragdolls. Linked pairs are positioned by the grapple systems.
const { clamp, sgn } = __m["core/util.js"];
const { BALANCE: B } = __m["data/balance.js"];
const NO_PHYS = new Set(['CLIMB', 'PERCH', 'HANG', 'APRON', 'ENTER_RING', 'EXIT_RING', 'TAGWAIT', 'ROPE']);
class PhysicsSystem {
  constructor(match) { this.m = match; }
  update(dt) {
    const m = this.m, ar = m.arena;
    for (const f of m.fighters) {
      f.touchRope = null;
      f.lastVx = f.vx;
      if (f.eliminated && f.st === 'OUT' && !f.rag && f.gone) continue;
      if (f.rag) { this.ragdoll(f, dt, ar); continue; }
      if (f.link) continue;
      if (NO_PHYS.has(f.st)) continue;
      this.body(f, dt, ar);
    }
    this.separate(dt);
    for (const f of m.fighters) this.safety(f, ar);
  }
  body(f, dt, ar) {
    if (!f.ground) f.vy = Math.min(B.maxFall, f.vy + B.gravity * dt * (f.st === 'FINISHER' && f.floatT > 0 ? .4 : 1));
    const px = f.x;
    f.x += f.vx * dt; f.y += f.vy * dt;
    if (ar.hasRing) {
      const hgt = ar.matY - f.y; // feet height above the mat
      if (f.side === 'in') {
        const pad = 11, over = hgt > ar.ropeH - 6 && (f.vault || f.st === 'ENTER_RING');
        if (!over) {
          if (f.x < ar.ropeL + pad) { f.x = ar.ropeL + pad; f.touchRope = 'L'; if (f.vx < 0) { if (Math.abs(f.vx) > 60) ar.press('L', Math.min(14, Math.abs(f.vx) * .05)); f.vx = 0; } }
          else if (f.x > ar.ropeR - pad) { f.x = ar.ropeR - pad; f.touchRope = 'R'; if (f.vx > 0) { if (Math.abs(f.vx) > 60) ar.press('R', Math.min(14, Math.abs(f.vx) * .05)); f.vx = 0; } }
        } else if (f.x < ar.ropeL - 2 || f.x > ar.ropeR + 2) { f.side = 'out'; f.vault = false; this.m.emit('overRope', { f }); }
      } else {
        const inX = f.x > ar.ropeL + 2 && f.x < ar.ropeR - 2;
        if (inX && hgt > ar.ropeH - 10) f.side = 'in';
        else if (f.y > ar.matY + 3) { // beside the apron
          const L = ar.ropeL - ar.apron - 10, R = ar.ropeR + ar.apron + 10, mid = ar.mid;
          if (f.x > L && f.x < mid) { f.x = Math.min(px > L ? L : f.x, L); if (f.vx > 0) f.vx = 0; }
          else if (f.x < R && f.x >= mid) { f.x = Math.max(px < R ? R : f.x, R); if (f.vx < 0) f.vx = 0; }
        } else { // above the apron but below the top rope: the ropes block the way in
          if (f.x > ar.ropeL - 9 && f.x < ar.mid) { f.x = ar.ropeL - 9; if (f.vx > 0) { f.vx = 0; ar.press('L', 6); } }
          else if (f.x < ar.ropeR + 9 && f.x >= ar.mid) { f.x = ar.ropeR + 9; if (f.vx < 0) { f.vx = 0; ar.press('R', 6); } }
        }
      }
    }
    f.x = clamp(f.x, ar.x0 + 14, ar.x1 - 14);
    const g = ar.ground(f.x, f.y, f.side);
    if (f.y >= g) {
      if (!f.ground && f.vy > 0) { f.landV = f.vy; f.y = g; f.vy = 0; f.ground = true; f.vault = false; }
      else { f.y = g; f.vy = 0; f.ground = true; }
    } else if (f.y < g - .5) f.ground = false;
    else { f.y = g; f.ground = true; }
  }
  ragdoll(f, dt, ar) {
    const r = f.rag;
    r.hitGround = 0; r.hitWall = 0; r.ropeHit = 0;
    const wasOut = r.side;
    r.step(dt, ar, B.gravity);
    if (r.hitGround > 130) this.m.emit('thud', { f, v: r.hitGround, x: r.cx, y: ar.ground(r.cx, r.cy, r.side) });
    if (r.hitWall > 220 && !f.wallHit) { f.wallHit = true; this.m.combat.damage(f, B.wallDamage, 8, null, { src: 'wall' }); this.m.emit('wall', { f, x: r.cx, y: r.cy }); }
    if (r.ropeHit && Math.abs(r.vel(0)[0]) > 60) this.m.emit('ropeBody', { f });
    if (wasOut === 'in' && r.side === 'out') this.m.emit('overRope', { f, thrown: true });
    f.x = r.cx; f.side = r.side;
    const g = ar.ground(f.x, r.cy, r.side);
    f.y = Math.min(g, r.cy + f.dims.leg * .9);
    f.ground = r.ground;
    if (!f.rag) return;
    if (f.st !== 'HITSTUN' && f.st !== 'DOWN' && f.st !== 'KO' && f.st !== 'OUT') { f.dropRag(); }
  }
  // Standing bodies do not share one spot.
  separate(dt) {
    const L = this.m.fighters;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j];
      if (a.link || b.link || a.rag || b.rag || !a.alive || !b.alive || !a.ground || !b.ground || a.side !== b.side || Math.abs(a.y - b.y) > 20) continue;
      const ok = f => f.fsm.is('IDLE', 'MOVE', 'GUARD', 'ATTACK', 'TAUNT', 'HITSTUN', 'STAGGER');
      if (!ok(a) || !ok(b) || (a.hsKind === 'lie' && a.st === 'HITSTUN') || (b.hsKind === 'lie' && b.st === 'HITSTUN')) continue;
      const dx = b.x - a.x, need = (a.dims.prof[4][2] + b.dims.prof[4][2]) * .9 + 6, d = Math.abs(dx);
      if (d < need) {
        const p = (need - d) * Math.min(1, dt * 10) * .5, s = dx === 0 ? (a.idx < b.idx ? 1 : -1) : sgn(dx), wa = b.stats.weight / (a.stats.weight + b.stats.weight);
        a.x -= s * p * 2 * wa; b.x += s * p * 2 * (1 - wa);
      }
    }
  }
  // Last line of defence: no NaN, nobody outside the hall, nobody under the floor.
  safety(f, ar) {
    if (!Number.isFinite(f.x) || !Number.isFinite(f.y)) { this.m.emit('fault', { f, why: 'nan' }); f.rag = null; f.x = ar.mid; f.y = ar.matY; f.vx = f.vy = 0; f.side = 'in'; if (!f.link) f.set('IDLE', { force: true }); }
    f.x = clamp(f.x, ar.x0 + 8, ar.x1 - 8);
    if (f.y > ar.floorY) f.y = ar.floorY;
  }
}

return { PhysicsSystem };
})();
// ---- combat/CombatSystem.js
__m["combat/CombatSystem.js"] = (function () {
// Strikes: hit boxes, guard, dodge, counter, combo scaling, knockback. StunSystem owns the stun gauge and downs.
const { clamp, sgn } = __m["core/util.js"];
const { BALANCE: B } = __m["data/balance.js"];
const { STATES } = __m["combat/StateMachine.js"];
class CombatSystem {
  constructor(match) { this.m = match; }
  addFin(f, v) { if (!f.alive) return; const before = f.fin; f.fin = clamp(f.fin + v * f.stats.fin * (1 + B.hypeBonus * (this.m.hype / 100)), 0, B.finMax); if (before < B.finMax && f.fin >= B.finMax) this.m.emit('finReady', { f }); }
  hurtbox(f) {
    const w = f.dims.prof[4][2] * .9 + 2, h = f.dims.height;
    if (f.rag) { const r = f.rag; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const i of [0, 1, 2, 8, 10]) { x0 = Math.min(x0, r.x[i]); x1 = Math.max(x1, r.x[i]); y0 = Math.min(y0, r.y[i]); y1 = Math.max(y1, r.y[i]); } return { x0: x0 - 6, x1: x1 + 6, y0: y0 - 6, y1: y1 + 6 }; }
    if (f.st === 'DOWN' || f.st === 'PINNED' || (f.st === 'HITSTUN' && f.hsKind === 'lie')) return { x0: f.x - h * .48, x1: f.x + h * .48, y0: f.y - 24, y1: f.y };
    if (f.st === 'DODGE') return { x0: f.x - w, x1: f.x + w, y0: f.y - h * .55, y1: f.y };
    if (f.st === 'PERCH' || f.st === 'CLIMB') return { x0: f.x - w, x1: f.x + w, y0: f.y - h * .8, y1: f.y + 6 };
    if (f.st === 'ATTACK' && f.atk && f.atk.def.id === 'slideKick') return { x0: f.x - 30, x1: f.x + 30, y0: f.y - 36, y1: f.y };
    return { x0: f.x - w, x1: f.x + w, y0: f.y - h * .95, y1: f.y };
  }
  hitbox(f) {
    const a = f.atk;
    if (!a) return null;
    const d = a.def, s = f.look.scale || 1, k = f.dims.reach / 35;
    if (a.t < d.startup || a.t > d.startup + d.active) return null;
    const reach = d.reach * (.4 + .6 * k), front = f.x + f.face * reach, back = f.x - f.face * (d.air ? 12 : 4);
    return { x0: Math.min(front, back), x1: Math.max(front, back), y0: f.y - d.high * s, y1: f.y - d.low * s };
  }
  update() {
    const m = this.m;
    for (const a of m.fighters) {
      if (!a.atk || a.link || !a.alive) continue;
      const hb = this.hitbox(a);
      if (!hb) continue;
      const d = a.atk.def;
      for (const v of m.fighters) {
        if (!a.atk || a.atk.def !== d) break;
        if (!a.isFoe(v) || !v.alive || a.atk.hit.has(v)) continue;
        const sd = STATES[v.st];
        const floorHit = d.ground && (v.st === 'DOWN' || v.st === 'PINNED') && v.downClock !== undefined && !(v.rag && !v.rag.ground) && v.protect <= 0;
        const helpOut = (v.st === 'GRAB' || v.st === 'PIN') && !(v.link && v.link.kind === 'move' && v.link.committed);
        if (!sd.hit && !floorHit && !helpOut) continue;
        if (d.floorOnly && !floorHit) continue;
        if (v.st === 'HITSTUN' && v.hsKind === 'lie' && !d.ground && !d.lowHit && !d.air) continue;
        const b = this.hurtbox(v);
        if (hb.x1 < b.x0 || hb.x0 > b.x1 || hb.y1 < b.y0 || hb.y0 > b.y1) continue;
        a.atk.hit.add(v);
        this.resolve(a, v, d, clamp((Math.max(hb.x0, b.x0) + Math.min(hb.x1, b.x1)) / 2, b.x0, b.x1), clamp((Math.max(hb.y0, b.y0) + Math.min(hb.y1, b.y1)) / 2, b.y0, b.y1));
      }
    }
  }
  resolve(a, v, d, hx, hy) {
    const m = this.m, dir = sgn(v.x - a.x) || a.face, facing = v.face === -dir;
    if (v.inv > 0) { m.emit('immune', { a, v }); return 'inv'; }
    if (v.st === 'DODGE' && v.invDodge) {
      const tech = v.char.style === 'tech';
      if (v.t <= B.counterWindow * (tech ? 1.25 : 1) && v.counterCd <= 0 && !d.air && !d.dive && (!d.run || tech) && (facing || v.dodge.back) && !v.dodge.dir && m.phase === 'fight') { if (m.grapple.startCounter(v, a)) return 'counter'; }
      if (!v.dodge.dodged) { v.dodge.dodged = true; this.addFin(v, 2.5); m.emit('dodge', { f: v, a }); }
      return 'dodge';
    }
    const boost = a.atk ? a.atk.boost : 1;
    if (v.st === 'FINISHER' && v.finPhase && v.finPhase.stage === 'stance' && facing && !d.air && a.ground) { m.finisher.connect(v, a, v.finPhase.F, false); return 'stance'; }
    if (d.shove && v.st === 'GUARD') {
      a.atk.connected = true;
      v.stun -= 22; v.regenDelay = B.stunRegenDelay;
      m.hitstop(.07);
      m.emit('guardBreak', { a, v, shove: true });
      if (v.stun <= 0) m.stun.breakStun(v, a, dir * 140, -120, dir); else { this.stagger(v, B.guardBreakStagger * .8, a); v.vx = dir * 120; }
      return 'crush';
    }
    // guard
    if (v.st === 'GUARD' && facing && !d.unblock && !d.floorOnly) {
      if (v.guardT <= B.perfectGuard && !d.dive) {
        a.atk.connected = false;
        this.addFin(v, B.finPerfect); v.perfects++;
        if (d.run || d.air) this.launch(a, -dir * 190, -130, dir * 4, null);
        else { a.hs = .44; a.hsKind = 'stand'; a.set('HITSTUN', { force: true, clip: 'hitHeavy' }); a.vx = -dir * 90; }
        m.hitstop(.11); m.emit('parry', { a, v, x: hx, y: hy });
        return 'parry';
      }
      const chip = Math.max(0, d.hp * B.guardHp * a.stats.atk), st = d.stun * B.guardStun * boost * (d.lv >= 3 ? 1.25 : 1);
      this.damage(v, Math.min(chip, Math.max(0, v.hp - B.chipMin)), 0, a, { chip: true });
      v.stun -= st; v.regenDelay = B.stunRegenDelay;
      a.atk.connected = true; a.atk.blocked = true;
      v.vx = dir * d.kb * B.guardPush * .6 / v.stats.kbr; a.vx -= dir * 26;
      m.hitstop(d.stop * .6);
      m.emit('block', { a, v, d, x: hx, y: hy });
      if (v.stun <= 0) { v.stun = v.maxStun * .3; this.stagger(v, B.guardBreakStagger, a); m.emit('guardBreak', { a, v }); }
      else m.anim.kick(v, 'guardHit', .2);
      return 'block';
    }
    // hit
    const counterHit = (v.st === 'ATTACK' || v.st === 'AIR_ATTACK' || v.st === 'TAUNT' || v.st === 'FINISHER') && !(v.atk && v.atk.t > v.atk.def.startup + v.atk.def.active);
    if (v.combo.t <= 0) v.combo.n = 0;
    v.combo.n++; v.combo.t = B.comboWindow; v.combo.by = a;
    const scale = Math.max(B.comboMin, 1 - B.comboStep * (v.combo.n - 1));
    const stale = this.stale(a, d.id);
    const pow = scale * stale * boost * (counterHit ? B.counterHit : 1) * (v.st === 'DOWN' ? .85 : 1);
    const hp = d.hp * a.stats.atk * pow, st = d.stun * (.5 + .5 * a.stats.atk) * pow;
    a.atk.connected = true; a.hitsLanded++; v.combo.dmg += hp;
    // super armour
    const armored = v.atk && v.atk.def.armor && v.atk.t < v.atk.def.startup + v.atk.def.active && d.lv <= v.atk.def.armor * 2 && !d.run && !d.air;
    const finArmor = v.st === 'FINISHER' && v.finPhase && v.finPhase.armor && d.lv < 4;
    this.damage(v, armored || finArmor ? hp * .8 : hp, st * (armored ? .7 : 1), a, { def: d });
    this.addFin(a, B.finHit + d.hp * .35);
    if (counterHit) this.addFin(a, 2);
    m.addHype((d.lv >= 3 ? 1.6 : .5) * stale);
    m.hitstop(d.stop * (counterHit ? 1.3 : 1));
    m.emit('hit', { a, v, d, x: hx, y: hy, dir, counterHit, hp, combo: v.combo.n, armored: armored || finArmor });
    if (v.st === 'KO') return 'ko';
    // break someone else's grapple or pin
    if (v.link && v.link.kind !== 'move') m.grapple.breakLink(v.link, 'hit');
    if (v.link && v.link.kind === 'move' && v.link.a === v && !v.link.committed) m.wrestle.cancel(v.link, 'hit');
    if (v.st === 'PIN') m.breakPin('hit');
    if (armored || finArmor) { v.hitShake = .12; v.flash = .08; return 'hit'; }
    if (v.st === 'DOWN' || v.st === 'PINNED') { v.hitShake = .14; v.flash = .1; if (d.quake || d.dive) { v.vx = 0; } m.anim.kickBody(v, dir); return 'hit'; }
    if (v.stun <= 0) { m.stun.breakStun(v, a, dir * Math.max(120, d.kb * 1.05) / v.stats.kbr, -Math.max(130, d.up || 0), dir); return 'hit'; }
    this.react(a, v, d, dir, counterHit);
    return 'hit';
  }
  react(a, v, d, dir, counterHit) {
    const kb = d.kb / v.stats.kbr * (100 / (60 + v.stats.weight * .4)), m = this.m;
    v.flash = .1; v.hitShake = .12 + d.lv * .03; v.expr = 'hurt'; v.exprT = .5;
    const onPerch = v.st === 'PERCH' || v.st === 'CLIMB' || v.st === 'HANG' || v.st === 'APRON';
    if (v.st === 'HANG' || v.st === 'APRON') { v.side = 'out'; this.launch(v, (v.x < v.arena.mid ? -1 : 1) * 120, -60, dir * 2, a); return; }
    if (d.lv >= 4 || !v.ground || onPerch || v.combo.n >= B.comboBreak || (v.rag && v.st === 'HITSTUN')) {
      this.launch(v, dir * kb * (onPerch ? .9 : 1), -(d.up || 90) / Math.sqrt(v.stats.kbr), dir * (d.up > 180 ? 5.5 : 3.2), a);
      if (v.combo.n >= B.comboBreak) v.inv = .7;
      return;
    }
    v.hs = d.hs * B.hitstunScale * (counterHit ? 1.2 : 1) * Math.max(.72, 1 - (v.combo.n - 1) * .05);
    v.hsKind = 'stand';
    const front = v.face === -dir;
    const clipN = d.lv >= 3 ? 'hitHeavy' : d.lowHit ? 'hitLow' : front ? 'hitF' : 'hitB';
    v.set('HITSTUN', { force: v.st === 'HITSTUN', clip: clipN });
    v.vx = dir * kb; v.face = v.combo.n > 1 || front ? v.face : v.face;
    void m;
  }
  launch(v, vx, vy, spin, a) {
    if (v.st === 'KO' || !v.alive) return;
    v.hsKind = 'launch'; v.hs = 9;
    v.set('HITSTUN', { force: true, clip: 'limpAir' });
    v.ragdoll(vx, vy, spin);
    v.wallHit = false;
    v.expr = 'hurt'; v.exprT = 1;
    if (a) v.lastHitBy = a;
  }
  // Used by shockwaves, bursts and thrown bodies.
  knock(v, vx, vy, stun, a, hp = 0) {
    if (!v.alive || v.inv > 0 || v.link) return;
    this.damage(v, hp, stun, a, {});
    if (v.st === 'KO') return;
    if (v.stun <= 0) { this.m.stun.breakStun(v, a, vx, vy, sgn(vx)); return; }
    this.launch(v, vx / Math.sqrt(v.stats.kbr), vy, sgn(vx) * 3, a);
  }
  stunOnly(v, stun, a) { v.stun -= stun; v.regenDelay = B.stunRegenDelay; if (v.stun <= 0) this.m.stun.breakStun(v, a, 0, -120, 1); else { v.hs = .22; v.hsKind = 'stand'; v.set('HITSTUN', { force: true, clip: 'hitLow' }); } }
  stagger(v, t, a) { v.hs = t; v.set('STAGGER', { force: true }); v.vx *= .3; v.expr = 'dizzy'; v.exprT = t; if (a) v.lastHitBy = a; this.m.emit('stagger', { f: v }); }
  stale(a, id) {
    const n = a.staleList.filter(x => x === id).length;
    a.staleList.push(id);
    if (a.staleList.length > B.staleMemory) a.staleList.shift();
    return Math.max(B.staleMin, 1 - Math.max(0, n - 1) * B.staleStep);
  }
  damage(v, hp, stun, a, o = {}) {
    if (!v.alive) return;
    const real = Math.min(v.hp, hp);
    v.hp = Math.max(0, v.hp - hp); v.dmgTaken += real;
    if (a) { a.dmgDealt += real; v.lastHitBy = a; }
    if (stun > 0) { v.stun -= stun; v.regenDelay = B.stunRegenDelay; }
    if (real > 0) this.addFin(v, real * B.finTaken);
    if (v.hp <= 0 && !o.noKO) this.m.onZeroHp(v, a);
  }
}

class StunSystem {
  constructor(match) { this.m = match; }
  update(dt) {
    for (const f of this.m.fighters) {
      if (!f.alive || f.regenDelay > 0) continue;
      if (f.fsm.is('HITSTUN', 'DOWN', 'GRABBED', 'PINNED', 'KO', 'STAGGER')) continue;
      f.stun = Math.min(f.maxStun, f.stun + B.stunRegen * f.stats.down * dt * (f.st === 'GUARD' ? .4 : 1));
    }
  }
  downTime(f) { const n = Math.min(f.downs, B.downTimes.length) - 1; return B.downTimes[Math.max(0, n)]; }
  // STUN hit zero: knock the body down.
  breakStun(v, a, vx, vy, dir) {
    if (!v.alive || v.st === 'DOWN') return;
    v.stun = 0; v.downs++;
    v.downTime = this.downTime(v); v.downClock = 0; v.postMove = false;
    v.set('DOWN', { force: true });
    v.ragdoll(vx, vy, dir * 4.2);
    v.wallHit = false; v.grabImm = 0; v.combo.n = 0; v.expr = 'dizzy'; v.exprT = v.downTime + 1;
    if (a) { this.m.combat.addFin(a, 5); }
    this.m.addHype(4);
    this.m.hitstop(.12);
    this.m.emit('down', { f: v, a, n: v.downs });
  }
}

return { CombatSystem, StunSystem };
})();
// ---- combat/GrappleSystem.js
__m["combat/GrappleSystem.js"] = (function () {
// Grapple tie-up: pick-up, holding, direction choice, switching sides, escapes, shoves and counter throws.
const { clamp, sgn } = __m["core/util.js"];
const { BALANCE: B, ATTACKS } = __m["data/balance.js"];
const { MOVES, HOLDS } = __m["data/moves.js"];
const { startAttack, tryBurst } = __m["combat/CharacterController.js"];
ATTACKS.shove = { id: 'shove', name: '밀치기', startup: .14, active: .07, recover: .32, reach: 42, low: 30, high: 80, hp: .6, stun: 7, kb: 190, hs: .34, stop: .05, lv: 2, shove: 1, unblock: 1, clip: 'shove', hand: 'open', sfx: 'grip', noCounter: 0 };

class GrappleSystem {
  constructor(match) { this.m = match; }
  canReach(f, v) { return Math.abs(v.x - f.x) <= B.grabRange + (v.st === 'DOWN' ? 8 : 0) && Math.abs(v.y - f.y) < 30 && v.side === f.side; }
  grabTarget(f) {
    let best = null, bd = 1e9;
    for (const v of this.m.fighters) {
      if (!f.isFoe(v) || !v.grabbable || !this.canReach(f, v)) continue;
      const d = Math.abs(v.x - f.x) + (sgn(v.x - f.x) === f.face ? 0 : 14);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }
  tryGrab(f, I) {
    const m = this.m;
    // catch somebody flying back from the ropes
    const run = f.nearestFoe(66, o => o.st === 'WHIPPED' && o.whip && o.whip.back && o.inv <= 0 && sgn(f.x - o.x) === o.whip.dir);
    if (run && f.ground) { f.face = sgn(run.x - f.x) || f.face; return m.wrestle.start(f, run, f.moves.catch || 'backBody', { noReverse: true }); }
    const v = this.grabTarget(f);
    if (v) return this.beginHold(f, v);
    if (Math.abs(I.mx) > .3) f.face = sgn(I.mx); else f.faceFoe(80);
    return startAttack(f, ATTACKS.shove);
  }
  beginHold(f, v, pos) {
    const m = this.m;
    if (!f.set('GRAB')) return false;
    f.face = sgn(v.x - f.x) || f.face;
    const rear = pos ? pos === 'rear' : v.st === 'STAGGER' && v.face === f.face;
    const down = v.st === 'DOWN';
    v.dropRag();
    v.set('GRABBED', { force: true });
    const link = { kind: 'hold', a: f, v, pos: rear ? 'rear' : 'front', t: 0, phase: 'pickup', pick: down ? B.pickup : .14, hold: B.grabHold * (.8 + .2 * f.stats.grp), strikes: 0, strikeT: 0, switches: 0, switchT: 0, fromDown: down };
    f.link = v.link = link;
    v.escape = Math.max(0, (v.grabCount || 0) * 5); v.grabCount = (v.grabCount || 0) + 1;
    v.inv = 0; f.vx = v.vx = 0; v.y = f.y; v.side = f.side; v.ground = true;
    m.links.push(link);
    m.emit('grab', { a: f, v, link });
    return true;
  }
  update(dt) {
    for (const L of this.m.links.slice()) if (L.kind === 'hold') this.updateHold(L, dt);
  }
  updateHold(L, dt) {
    const { a, v } = L, ar = this.m.arena;
    L.t += dt;
    if (L.phase === 'pickup' && L.t >= L.pick) { L.phase = 'hold'; L.t = 0; }
    if (L.switchT > 0) L.switchT -= dt;
    if (L.strikeT > 0) L.strikeT -= dt;
    if (L.phase === 'hold') L.hold -= dt;
    if (!a.alive || !v.alive || a.st !== 'GRAB' || v.st !== 'GRABBED') { this.breakLink(L, 'state'); return; }
    // keep the pair on this side of the ropes
    const off = (L.pos === 'front' ? 24 : 17) * a.face;
    if (ar.hasRing && a.side === 'in') { const lo = ar.ropeL + 14, hi = ar.ropeR - 14; a.x = clamp(a.x, Math.max(lo, lo - off), Math.min(hi, hi - off)); } else a.x = clamp(a.x, ar.x0 + 40, ar.x1 - 40);
    v.x = a.x + off; v.y = a.y; v.side = a.side; v.face = L.pos === 'front' ? -a.face : a.face;
    if (v.escape >= B.grabEscape) { this.m.emit('escape', { a, v }); this.breakLink(L, 'escape'); return; }
    if (L.hold <= 0) this.breakLink(L, 'timeout');
  }
  holdDef(L) { return L.phase === 'pickup' && L.fromDown ? HOLDS.pickup : L.pos === 'front' ? HOLDS.front : HOLDS.rear; }
  // Which move would this direction give, and is it usable right now?
  slotFor(f, I) { if (I.up) return 'u'; if (I.down) return 'd'; if (Math.abs(I.mx) > .3) return sgn(I.mx) === f.face ? 'f' : 'b'; return 'n'; }
  moveInSlot(f, L, slot) { return f.moves[L.pos] && f.moves[L.pos][slot]; }
  liftNeed(mv, v) { return mv.lift * v.stats.weight / 100; }
  liftPower(a, v) { return a.stats.lift * (1 + (1 - v.hp / v.maxHp) * .55); }
  check(f, v, mv) {
    if (!mv) return { ok: false, why: '기술 없음' };
    if (mv.lift < 9 && this.liftNeed(mv, v) > this.liftPower(f, v)) return { ok: false, why: '너무 무겁다' };
    if (mv.need === 'rope') { const ar = this.m.arena; if (!ar.hasRing || f.side !== 'in') return { ok: false, why: '링 안에서만' }; if (ar.nearRope(f.x).dist > 120) return { ok: false, why: '로프가 멀다' }; if (mv.tags && mv.tags.includes('ringout') && this.m.rules.ringOutThrow === false) return { ok: false, why: '규칙상 불가' }; }
    if (mv.tags && mv.tags.includes('whip') && !this.m.arena.hasRing) return { ok: false, why: '로프 없음' };
    if (mv.tags && mv.tags.includes('whip') && f.side !== 'in') return { ok: false, why: '링 안에서만' };
    return { ok: true, why: '' };
  }
  holdControl(f, I, dt) {
    const L = f.link, m = this.m;
    if (!L || L.kind !== 'hold' || L.a !== f) { f.set('IDLE'); return; }
    if (L.phase === 'pickup' || L.switchT > 0 || L.strikeT > 0) return;
    if (f.has('fin') && f.fin >= B.finMax) { f.consume('fin'); if (m.finisher.fromHold(f, L)) return; }
    if (f.has('grab')) {
      f.consume('grab');
      const slot = this.slotFor(f, I), id = this.moveInSlot(f, L, slot), mv = MOVES[id], c = this.check(f, L.v, mv);
      if (c.ok) { m.wrestle.startFromHold(L, id); return; }
      m.emit('deny', { f, why: c.why, mv });
      L.deny = { slot, t: m.time, why: c.why };
    }
    if (f.has('dodge') && !I.down) { f.consume('dodge'); if (L.switches < 2) { L.switches++; L.pos = L.pos === 'front' ? 'rear' : 'front'; L.switchT = B.switchTime; L.hold -= .2; m.anim.freezeBlend(f, .18); m.anim.freezeBlend(L.v, .18); m.emit('switch', { a: f, v: L.v }); } }
    if (f.has('atk')) {
      f.consume('atk');
      if (L.strikes < B.grabStrikeMax) { L.strikes++; L.strikeT = .26; L.strikeAt = L.t; m.combat.damage(L.v, 1.5 * f.stats.atk, 0, f, {}); m.combat.addFin(f, 2.4); L.v.escape = Math.max(0, L.v.escape - 8); L.v.hitShake = .16; L.v.flash = .08; m.hitstop(.06); m.emit('grabStrike', { a: f, v: L.v }); }
    }
    if (Math.abs(I.mx) > .3) f.x += sgn(I.mx) * B.grabWalk * f.stats.spd * dt * (sgn(I.mx) === f.face ? .85 : 1);
  }
  heldControl(v, I, dt) {
    const L = v.link, m = this.m;
    if (!L) { v.set('IDLE', { force: true }); return; }
    if (L.kind === 'move') return; // WrestlingMoveSystem reads the reversal input
    if (I.down && v.has('dodge')) { if (tryBurst(v)) { v.clearBuf(); return; } }
    let n = 0;
    for (const k of ['atk', 'grab', 'dodge', 'jump']) if (v.buf[k] >= B.inputBuffer - 1e-6) n++;
    const power = v.stats.grp / L.a.stats.grp * (.62 + .38 * v.hp / v.maxHp);
    v.escape = Math.max(0, v.escape + n * B.mashValue * power - B.mashDecay * dt * (L.phase === 'pickup' ? 0 : .6));
  }
  breakLink(L, why) {
    const m = this.m, { a, v } = L, i = m.links.indexOf(L);
    if (i >= 0) m.links.splice(i, 1);
    if (a.link === L) a.link = null;
    if (v && v.link === L) v.link = null;
    if (v) { m.anim.freezeBlend(v, .16); v.y = m.arena.ground(v.x, v.y, v.side); v.ground = true; }
    m.anim.freezeBlend(a, .16);
    if (a.alive && a.st === 'GRAB') {
      if (why === 'escape' || why === 'burst') { a.hs = .4; a.hsKind = 'stand'; a.set('HITSTUN', { force: true, clip: 'hitF' }); a.vx = -a.face * 120; }
      else if (why === 'timeout') { a.hs = .3; a.hsKind = 'stand'; a.set('HITSTUN', { force: true, clip: 'hitLow' }); }
      else a.set('IDLE', { force: true });
    }
    if (v && v.alive && v.st === 'GRABBED') {
      v.grabImm = Math.max(v.grabImm, 1.2); v.stun = Math.max(v.stun, v.maxStun * (why === 'escape' ? .5 : .42)); v.inv = Math.max(v.inv, .5);
      v.vx = -v.face * 60;
      v.set('IDLE', { force: true });
    }
    m.emit('unlink', { a, v, why });
  }
  // L at the right moment turns a strike into a throw.
  startCounter(v, a) {
    const m = this.m;
    v.counterCd = B.counterCd;
    v.face = sgn(a.x - v.x) || v.face;
    if (!v.set('COUNTER', { force: true })) return false;
    a.atk = null;
    const id = v.moves.counter || 'hipToss';
    const ok = m.wrestle.begin(v, a, [id], { state: 'COUNTER', noReverse: true, counter: true });
    if (!ok) { v.set('IDLE', { force: true }); return false; }
    m.combat.addFin(v, B.finCounter); v.counters++;
    m.addHype(6);
    m.hitstop(.14);
    m.emit('counter', { f: v, a });
    return true;
  }
}

return { GrappleSystem };
})();
// ---- anim/paired.js
__m["anim/paired.js"] = (function () {
// Evaluates two-person move timelines into joints for both wrestlers, keeping hands attached by IK.
const { DEG, EASE, clamp01, lerp } = __m["core/util.js"];
const { pose, poseLerp, POSE_N, solveFK, ik2, J, JN, Joints } = __m["anim/skeleton.js"];
const compiledMoves = new WeakMap();
function compileMove(m) {
  let c = compiledMoves.get(m);
  if (c) return c;
  const tr = list => list.map(k => ({ t: k[0], p: pose(k[1]), e: EASE[k[2] || 'io'] }));
  c = {
    A: tr(m.A), V: tr(m.V),
    R: m.R.map(k => ({ t: k[0], x: k[1], y: k[2], r: k[3], e: EASE[k[4] || 'io'] })),
    yaw: m.yaw ? m.yaw.map(k => ({ t: k[0], v: k[1], e: EASE[k[2] || 'lin'] })) : null,
    yawA: !!(m.yaw && m.yaw[0][3] === 'A'),
    ax: m.ax ? m.ax.map(k => ({ t: k[0], x: k[1], y: k[2], e: EASE[k[3] || 'io'] })) : null,
    ik: (m.ik || []).map(k => ({ t0: k[0], t1: k[1], arm: k[2], j: J[k[3]] })),
    ikV: (m.ikV || []).map(k => ({ t0: k[0], t1: k[1], arm: k[2], j: J[k[3].replace('A:', '')] })),
  };
  compiledMoves.set(m, c);
  return c;
}
const tmpA = new Float32Array(POSE_N), tmpV = new Float32Array(POSE_N);
function trackPose(K, t, out) {
  if (t <= K[0].t) { out.set(K[0].p); return out; }
  for (let i = 1; i < K.length; i++) if (t <= K[i].t) return poseLerp(K[i - 1].p, K[i].p, K[i].e(clamp01((t - K[i - 1].t) / (K[i].t - K[i - 1].t || 1))), out);
  out.set(K[K.length - 1].p);
  return out;
}
function trackVal(K, t) {
  if (t <= K[0].t) return K[0].v;
  for (let i = 1; i < K.length; i++) if (t <= K[i].t) return lerp(K[i - 1].v, K[i].v, K[i].e(clamp01((t - K[i - 1].t) / (K[i].t - K[i - 1].t || 1))));
  return K[K.length - 1].v;
}
function yawAt(m, t) { const c = compileMove(m); return c.yaw ? trackVal(c.yaw, t) : 0; }

const REF_H = 94;
/* res: {front} front=true when the victim should be drawn over the attacker. Joints come out in attacker-local
   space: attacker feet at (0,0), facing right, y down. */
function evalPaired(m, t, dA, dV, outA, outV, res) {
  const c = compileMove(m), kA = dA.height / REF_H;
  trackPose(c.A, t, tmpA);
  // A lift written for a 94px body scales with the attacker.
  solveFK(tmpA, dA, outA, {});
  let axx = 0, axy = 0;
  if (c.ax) { const K = c.ax; let i = 1; while (i < K.length - 1 && t > K[i].t) i++; const u = K[i].e(clamp01((t - K[i - 1].t) / (K[i].t - K[i - 1].t || 1))); axx = lerp(K[i - 1].x, K[i].x, u); axy = -lerp(K[i - 1].y, K[i].y, u); }
  if (axx || axy) for (let i = 0; i < JN; i++) { outA.p[i * 2] += axx; outA.p[i * 2 + 1] += axy; }
  trackPose(c.V, t, tmpV);
  const K = c.R;
  let i = 1;
  while (i < K.length - 1 && t > K[i].t) i++;
  const k0 = K[Math.max(0, i - 1)], k1 = K[Math.min(i, K.length - 1)];
  const u = k1.t === k0.t ? 1 : k1.e(clamp01((t - k0.t) / (k1.t - k0.t)));
  const rot = lerp(k0.r, k1.r, u), vf = m.vf;
  const saveR = tmpV[0];
  tmpV[0] = saveR + rot * vf;
  solveFK(tmpV, dV, outV, { snap: false, px: 0, py: 0 });
  const P = outV.p;
  if (vf < 0) { for (let j = 0; j < JN; j++) P[j * 2] = -P[j * 2]; outV.face = -1; outV.S = -outV.S; outV.H = -outV.H; }
  let low = -1e9;
  for (let j = 0; j < JN; j++) { const v = P[j * 2 + 1] + dV.gr[j]; if (v > low) low = v; }
  const groundY = -low; // pelvis offset that rests the body on the mat
  const yOf = k => {
    if (k.y === 'g') return groundY;
    if (k.y >= 40 && k.y <= 46 && Math.abs(k.r) <= 46) return groundY;
    return -k.y * kA;
  };
  let py = lerp(yOf(k0), yOf(k1), u);
  if (py > groundY) py = groundY;
  const px = lerp(k0.x, k1.x, u) * (kA * .75 + .25);
  for (let j = 0; j < JN; j++) { P[j * 2] += px; P[j * 2 + 1] += py; }
  res.front = false;
  if (c.yaw) {
    const a = trackVal(c.yaw, t) * DEG, cs = Math.cos(a), sn = Math.sin(a);
    const apply = (jt, doY) => {
      for (let j = 0; j < JN; j++) { jt.p[j * 2] *= cs; if (doY) jt.p[j * 2 + 1] += sn * 7; }
      if (cs < 0) { jt.face = -jt.face; jt.S = -jt.S; jt.H = -jt.H; }
      const mm = Math.max(.2, Math.abs(cs)); jt.S *= mm; jt.H = jt.H * mm; jt.yaw = Math.abs(cs);
    };
    apply(outA, false);
    if (!c.yawA) apply(outV, true);
    res.front = sn > .05;
    res.yaw = a;
  } else res.yaw = 0;
  const dirA = outA.face;
  for (const k of c.ik) {
    if (t < k.t0 || t > k.t1) continue;
    const w = Math.min(clamp01((t - k.t0) / .08), clamp01((k.t1 - t) / .05));
    const tx = P[k.j * 2], ty = P[k.j * 2 + 1];
    const s = k.arm === 'N' ? 4 : 7, ap = outA.p;
    const ex = ap[(s + 1) * 2], ey = ap[(s + 1) * 2 + 1], hx = ap[(s + 2) * 2], hy = ap[(s + 2) * 2 + 1];
    ik2(ap, s, s + 1, s + 2, tx, ty, dA.ua, dA.fa, dirA);
    if (w < 1) { ap[(s + 1) * 2] = lerp(ex, ap[(s + 1) * 2], w); ap[(s + 1) * 2 + 1] = lerp(ey, ap[(s + 1) * 2 + 1], w); ap[(s + 2) * 2] = lerp(hx, ap[(s + 2) * 2], w); ap[(s + 2) * 2 + 1] = lerp(hy, ap[(s + 2) * 2 + 1], w); }
  }
  for (const k of c.ikV) {
    if (t < k.t0 || t > k.t1) continue;
    const tx = outA.p[k.j * 2], ty = outA.p[k.j * 2 + 1];
    for (const s of k.arm === 'both' ? [4, 7] : k.arm === 'N' ? [4] : [7]) ik2(P, s, s + 1, s + 2, tx, ty, dV.ua, dV.fa, outV.face);
  }
  return res;
}
function pairBuffers() { return { A: new Joints(), V: new Joints(), res: { front: false, yaw: 0 } }; }
// Furthest forward and backward reach of the victim during a move, for keeping pairs inside the ring.
const extentMemo = new WeakMap();
function moveExtent(m) {
  let e = extentMemo.get(m);
  if (e) return e;
  let lo = 0, hi = 0;
  for (const k of m.R) { lo = Math.min(lo, k[1]); hi = Math.max(hi, k[1]); }
  e = { lo: lo - 16, hi: hi + 16 };
  extentMemo.set(m, e);
  return e;
}

return { compileMove, yawAt, evalPaired, pairBuffers, moveExtent };
})();
// ---- combat/WrestlingMoveSystem.js
__m["combat/WrestlingMoveSystem.js"] = (function () {
// Plays two-person moves: timing, position lock, timed damage, reversals, release into ragdoll. Data driven.
const { clamp, clamp01, sgn } = __m["core/util.js"];
const { BALANCE: B } = __m["data/balance.js"];
const { MOVES } = __m["data/moves.js"];
const { STATES } = __m["combat/StateMachine.js"];
const { moveExtent, yawAt, compileMove } = __m["anim/paired.js"];
class WrestlingMoveSystem {
  constructor(match) { this.m = match; }
  startFromHold(L, id) {
    const { a, v } = L, i = this.m.links.indexOf(L);
    if (i >= 0) this.m.links.splice(i, 1);
    a.link = v.link = null;
    return this.begin(a, v, [id], {});
  }
  start(a, v, id, o = {}) { return this.begin(a, v, [id], o); }
  // parts: move ids run back to back without letting go.
  begin(a, v, parts, o = {}) {
    const m = this.m, mv = MOVES[parts[0]];
    if (!mv || !v.alive || v.link && v.link.kind === 'move') return false;
    if (v.link) m.grapple.breakLink(v.link, 'move');
    if (!a.fsm.is(o.state || 'WRESTLING_MOVE') && !a.set(o.state || 'WRESTLING_MOVE', { force: a.fsm.is('GRAB', 'IDLE', 'MOVE', 'FINISHER', 'COUNTER', 'DODGE', 'GUARD') })) return false;
    v.dropRag(); v.atk = null;
    v.set('GRABBED', { force: true });
    if (mv.need === 'rope' || mv.toRope) { const nr = m.arena.nearRope(a.x); a.face = nr.dir; }
    const stale = this.stale(a, parts[parts.length - 1], o.fin);
    const L = {
      kind: 'move', a, v, dV: v.dims, vName: v.name, move: mv, parts: parts.slice(), part: 0, t: 0, evI: 0, committed: !!o.noReverse, noReverse: !!o.noReverse, fin: o.fin || null, counter: !!o.counter,
      power: a.stats.grp * stale * (o.power || 1), stunAlive: v.stun > 0, released: false, x0: a.x, shift: 0, rev: { tried: false, done: false }, swept: new Set(), front: false, mirror: o.mirror,
    };
    a.link = v.link = L;
    m.links.push(L);
    a.vx = a.vy = v.vx = v.vy = 0; v.y = a.y; v.side = a.side; v.ground = true; a.ground = true;
    v.expr = 'hurt'; v.exprT = mv.dur + 1; a.expr = 'fierce'; a.exprT = mv.dur;
    this.planShift(L);
    m.anim.freezeBlend(a, .14); m.anim.freezeBlend(v, .18);
    m.emit('moveStart', { a, v, mv, L, fin: L.fin });
    return true;
  }
  stale(a, id, fin) {
    if (fin) return 1;
    for (const k in a.moveStale) if (k !== id) a.moveStale[k] = Math.max(0, a.moveStale[k] - .5);
    const n = a.moveStale[id] || 0;
    a.moveStale[id] = n + 1;
    if (!a.movesDone.has(id)) { a.movesDone.add(id); this.m.addHype(5); } else this.m.addHype(Math.max(0, 3 - n));
    return Math.max(.6, 1 - n * .12);
  }
  // Slide the pair so the whole move stays inside the ring.
  planShift(L) {
    const ar = this.m.arena, { a, move } = L;
    L.shift = 0;
    if (move.tags && move.tags.includes('ringout')) { // stand where the throw clears the rope
      const tx = a.face > 0 ? ar.ropeR - 40 : ar.ropeL + 40;
      L.shift = tx - a.x;
      return;
    }
    if (move.push) { const tx = a.face > 0 ? ar.ropeR - 38 : ar.ropeL + 38; L.shift = tx - a.x; return; }
    const e = moveExtent(move), k = a.dims.height / 94;
    const lo = ar.hasRing && a.side === 'in' ? ar.ropeL + 8 : ar.x0 + 12, hi = ar.hasRing && a.side === 'in' ? ar.ropeR - 8 : ar.x1 - 12;
    let x0 = a.x + (a.face > 0 ? e.lo : -e.hi) * k, x1 = a.x + (a.face > 0 ? e.hi : -e.lo) * k;
    if (move.yaw) { const r = Math.min(120, Math.max(Math.abs(e.lo), e.hi) * k); x0 = a.x - r; x1 = a.x + r; }
    if (ar.hasRing && a.side === 'out') return;
    if (x0 < lo) L.shift = lo - x0; else if (x1 > hi) L.shift = hi - x1;
  }
  update(dt) {
    for (const L of this.m.links.slice()) if (L.kind === 'move') this.tick(L, dt);
  }
  tick(L, dt) {
    const m = this.m, { a } = L;
    let mv = L.move;
    const before = L.t;
    L.t += dt;
    // eased slide into position
    if (L.shift) { const T = mv.push ? .46 : .4, k = clamp01(L.t / T), s = k * k * (3 - 2 * k); a.x = L.x0 + L.shift * s; if (k >= 1) { L.x0 = a.x; L.shift = 0; } }
    if (L.v) this.placeVictim(L);
    this.reversal(L, dt);
    if (a.link !== L) return; // reversed or cancelled
    while (L.evI < mv.ev.length && mv.ev[L.evI][0] <= L.t) { const e = mv.ev[L.evI++]; this.event(L, e[0], e[1], e[2] || {}); if (a.link !== L) return; }
    if (mv.sweep && mv.yaw && L.t > mv.yaw[0][0] && L.t < mv.rel) this.sweep(L, mv);
    if (L.v && !L.released && L.t >= mv.rel) this.release(L);
    if (a.link !== L) return;
    if (L.t >= mv.dur) {
      if (L.part < L.parts.length - 1) {
        const c = compileMove(mv), last = c.A[c.A.length - 1].p;
        a.x += a.face * last[12];
        L.part++; L.move = mv = MOVES[L.parts[L.part]]; L.t = 0; L.evI = 0; L.x0 = a.x; L.committed = true;
        this.planShift(L);
        m.anim.freezeBlend(a, .1); if (L.v) m.anim.freezeBlend(L.v, .1);
        return;
      }
      if (L.v && !L.released) this.release(L);
      this.finish(L);
    }
    void before;
  }
  placeVictim(L) {
    const { a, v } = L;
    if (!v) return;
    // rough body position for cameras and targeting; the drawing uses the exact pose
    const j = v.joints; void j;
    v.x = clamp(v.pelvisX != null && v.pelvisLink === L ? v.pelvisX : a.x + a.face * 24, this.m.arena.x0, this.m.arena.x1);
    v.y = a.y; v.side = a.side;
  }
  reversal(L, dt) {
    const v = L.v;
    if (!v || L.committed || L.released) return;
    const n = v.reversals || 0, lead = L.fin ? .2 : B.reversalLead, win = B.reversalWindow * Math.max(.5, 1 - n * .14) * (L.fin ? .7 : 1) * (v.char.style === 'tech' ? 1.2 : 1);
    L.rev.open = L.t >= lead && L.t <= lead + win;
    if (L.t > lead + win) { L.committed = true; L.rev.open = false; return; }
    if (v.has('dodge') && !L.rev.tried) {
      v.consume('dodge');
      L.rev.tried = true;
      if (L.rev.open) this.reverse(L); else this.m.emit('revFail', { v });
    }
    void dt;
  }
  reverse(L) {
    const m = this.m, { a, v } = L;
    v.reversals = (v.reversals || 0) + 1;
    this.unlink(L);
    const id = v.moves.counter || 'hipToss';
    v.face = sgn(a.x - v.x) || -a.face; v.side = a.side; v.y = a.y; v.ground = true;
    v.stun = Math.max(v.stun, v.maxStun * .45);
    v.set('IDLE', { force: true });
    m.combat.addFin(v, B.finCounter); v.counters++;
    if (L.fin) a.fin = Math.max(a.fin, B.finMax * .3);
    m.addHype(9);
    m.hitstop(.16);
    m.emit('reversal', { f: v, a, fin: L.fin });
    this.begin(v, a, [id], { noReverse: true, counter: true });
  }
  unlink(L) {
    const i = this.m.links.indexOf(L);
    if (i >= 0) this.m.links.splice(i, 1);
    if (L.a.link === L) L.a.link = null;
    if (L.v && L.v.link === L) L.v.link = null;
  }
  cancel(L, why) {
    const { a, v } = L;
    this.unlink(L);
    if (v) { this.m.anim.freezeBlend(v, .15); v.y = this.m.arena.ground(v.x, v.y, v.side); v.ground = true; v.grabImm = 1; v.inv = .4; v.stun = Math.max(v.stun, v.maxStun * .3); if (v.alive) v.set('IDLE', { force: true }); }
    if (a.alive && a.st === 'WRESTLING_MOVE') a.set('IDLE', { force: true });
    this.m.emit('moveCancel', { a, v, why });
  }
  event(L, t, k, o) {
    const m = this.m, { a, v, move } = L;
    if (o.d && v) {
      const hp = move.hp * L.power * o.d, st = move.stun * o.d;
      m.combat.damage(v, hp, st, a, { move });
      if (!L.fin) m.combat.addFin(a, move.gain * o.d); else if (v) v.finishersTaken += o.d > .4 ? 1 : 0;
      v.combo.n = Math.max(1, v.combo.n); v.flash = .12; v.hitShake = .2;
    }
    const pos = this.contactPoint(L, o);
    m.emit('moveEvent', { L, a, v, move, k, o, x: pos[0], y: pos[1], fin: L.fin });
    if (k === 'impact') {
      m.hitstop(L.fin ? .16 + .03 * o.p : .06 + .04 * o.p);
      m.addHype(2 + o.p * 2);
      if (move.quake) this.quake(L, move.quake);
    } else if (k === 'smack') m.hitstop(.07);
  }
  contactPoint(L, o) {
    const v = L.v || L.a;
    if (v.joints) { const j = v.joints, i = o.body ? 1 : 0; return [j.x(i), o.body || L.move.vf === undefined ? j.y(i) : L.a.y]; }
    return [v.x, v.y];
  }
  quake(L, r) {
    const m = this.m, cx = L.v ? L.v.x : L.a.x;
    for (const o of m.fighters) if (o !== L.a && o !== L.v && L.a.isFoe(o) && o.alive && !o.link && o.ground && o.inv <= 0 && Math.abs(o.x - cx) < r && STATES[o.st].hit && Math.abs(o.y - L.a.y) < 24) m.combat.knock(o, sgn(o.x - cx) * 150, -150, 14, L.a, 2);
  }
  sweep(L, mv) {
    const m = this.m, { a } = L, y = yawAt(mv, L.t) * Math.PI / 180, reach = mv.sweep + 34, vx = a.x + a.face * Math.cos(y) * reach;
    for (const o of m.fighters) {
      if (o === a || o === L.v || !a.isFoe(o) || !o.alive || o.link || o.inv > 0 || L.swept.has(o) || !STATES[o.st].hit) continue;
      const lo = Math.min(a.x, vx), hi = Math.max(a.x, vx);
      if (o.x > lo - 8 && o.x < hi + 8 && Math.abs(o.y - a.y) < 40) { L.swept.add(o); m.combat.knock(o, sgn(o.x - a.x) * 260, -170, 20, a, 4); m.hitstop(.08); m.emit('sweep', { a, o }); }
    }
  }
  release(L) {
    const m = this.m, { a, v, move } = L;
    L.released = true; L.committed = true;
    if (!v) return;
    v.link = null; L.v = null;
    v.side = a.side; v.ground = false; v.face = a.face * move.vf * (L.faceFlip || 1);
    const vel = move.vel || [0, -60, 0], k = 1 / Math.sqrt(v.stats.kbr);
    if (move.whip) {
      const dir = a.face;
      v.face = dir; v.ground = true; v.y = a.y;
      v.whip = { dir, t: 0, speed: 290, back: false, lean: 0, max: .85, by: a };
      v.set('WHIPPED', { force: true }); v.stun = Math.max(v.stun, v.maxStun * .34); v.vx = dir * 290;
      m.emit('whip', { a, v });
      return;
    }
    if (move.stagger && v.hp > 0 && (v.grabCount || 0) < 2 && L.part === L.parts.length - 1) { v.ground = true; v.y = a.y; v.stun = Math.max(6, v.stun); m.combat.stagger(v, 1.0, a); v.vx = a.face * 110; v.face = move.vf > 0 ? a.face : -a.face; m.emit('release', { a, v, move }); return; }
    const ringout = move.tags && move.tags.includes('ringout');
    if (v.hp <= 0 && m.koAllowed(v)) m.knockOut(v, a, a.face * vel[0] * k, vel[1], vel[2] * a.face);
    else {
      const broke = L.stunAlive && v.stun <= 0;
      v.downClock = 0;
      if (broke && !L.fin) { v.downs++; v.downTime = m.stun.downTime(v); v.grabImm = 0; v.postMove = false; }
      else { v.postMove = true; v.grabImm = 60; v.downTime = B.moveDownTime * (1 + .07 * Math.max(0, v.downs - 1)) * (L.fin ? 2.1 : 1); if (L.fin) v.downs++; }
      v.set('DOWN', { force: true });
      v.ragdoll(a.face * vel[0] * k, vel[1], vel[2] * a.face, ringout);
      if (ringout) { v.rag.over = true; v.thrownOut = { by: a, t: m.time }; }
      m.emit('down', { f: v, a, n: v.downs, quiet: !broke, fin: !!L.fin });
    }
    v.expr = 'dizzy'; v.exprT = 1.6;
    m.emit('release', { a, v, move });
  }
  finish(L) {
    const { a, move } = L, m = this.m;
    this.unlink(L);
    if (!a.alive) return;
    const c = compileMove(move), last = c.A[c.A.length - 1].p;
    m.anim.freezeBlend(a, .12);
    a.x += a.face * last[12];
    a.ground = true; a.y = m.arena.ground(a.x, a.y, a.side);
    const selfT = (move.self || .2) / a.stats.rec * .5;
    if (last[0] < -45 || last[0] > 45) { a.gettingUp = { wait: selfT * .5, dur: .5 / a.stats.rec, prot: .25, clip: last[0] < 0 ? 'getupSup' : 'getupProne' }; a.set('GET_UP', { force: true }); }
    else { a.landT = Math.max(.07, selfT * .6); a.set('IDLE', { force: true }); }
    m.emit('moveEnd', { a, move });
  }
}

return { WrestlingMoveSystem };
})();
// ---- combat/FinisherSystem.js
__m["combat/FinisherSystem.js"] = (function () {
// Finishers: start-up, the attempt (which can miss, be blocked or interrupted) and the hand-off to the move player.
const { clamp, sgn } = __m["core/util.js"];
const { BALANCE: B } = __m["data/balance.js"];
const { STATES } = __m["combat/StateMachine.js"];
class FinisherSystem {
  constructor(match) { this.m = match; }
  start(f) {
    const F = f.finisher, m = this.m;
    if (!F || f.fin < B.finMax) return false;
    // a helpless foe in reach: no need for the attempt phase
    const g = m.grapple.grabTarget(f);
    f.faceFoe(220);
    if (!f.set('FINISHER')) return false;
    f.vx = 0;
    f.finPhase = { F, t: 0, stage: 'charge', armor: !!F.armor, target: g, direct: !!g, tx: 0, hit: false };
    f.expr = 'fierce'; f.exprT = 3;
    m.emit('finisherStart', { f, F, direct: !!g });
    return true;
  }
  fromHold(f, L) {
    const m = this.m, F = f.finisher, v = L.v;
    const i = m.links.indexOf(L);
    if (i >= 0) m.links.splice(i, 1);
    f.link = v.link = null;
    f.fin = 0;
    m.emit('finisherStart', { f, F, direct: true, hold: true });
    this.connect(f, v, F, true);
    return true;
  }
  connect(f, v, F, canReverse) {
    const m = this.m;
    f.fin = 0; f.finPhase = null;
    f.face = sgn(v.x - f.x) || f.face;
    const ok = m.wrestle.begin(f, v, F.parts, { fin: F, noReverse: !canReverse });
    if (ok) { m.emit('finisherHit', { f, v, F }); m.addHype(22); }
    else f.set('IDLE', { force: true });
    return ok;
  }
  miss(f, why) {
    const F = f.finPhase.F;
    f.fin = B.finMax * B.finMissKeep; f.finPhase = null;
    this.m.emit('finisherMiss', { f, F, why });
    this.m.addHype(-6);
    if (why === 'crash') { f.hsKind = 'lie'; f.hs = 1.0; f.lieClip = 'downProne'; f.set('HITSTUN', { force: true, clip: 'downProne' }); }
    else if (why === 'blocked') { f.hsKind = 'stand'; f.hs = .75; f.set('HITSTUN', { force: true, clip: 'hitHeavy' }); f.vx = -f.face * 140; }
    else this.m.combat.stagger(f, .8, null);
  }
  catchable(v, strike) { return v.alive && !v.link && v.inv <= 0 && !(v.st === 'DODGE' && v.invDodge) && (STATES[v.st].hit || v.st === 'STAGGER' || (v.st === 'DOWN' && !v.rag && v.grabImm <= 0)) && (!v.rag || strike) && v.st !== 'PERCH'; }
  control(f, I, dt) {
    const P = f.finPhase, m = this.m;
    if (!P) { f.set('IDLE', { force: true }); return; }
    P.t += dt;
    const F = P.F;
    if (P.stage === 'charge') {
      f.vx = 0;
      const T = P.direct ? .34 : F.type === 'quake' ? .55 : F.type === 'stance' ? .2 : .42;
      if (P.t < T * .8) { const n = f.nearestFoe(400); if (n) f.face = sgn(n.x - f.x) || f.face; }
      if (P.t >= T) {
        if (P.direct) { const v = P.target; if (v && v.alive && !v.link && m.grapple.canReach(f, v) && (v.grabbable || this.catchable(v))) { this.connect(f, v, F, false); return; } this.miss(f, 'gone'); return; }
        P.stage = F.type === 'stance' ? 'stance' : F.type === 'dive' ? 'leap' : F.type === 'quake' ? 'lunge' : 'lunge'; P.t = 0;
        const n = f.nearestFoe(420);
        P.tx = n ? n.x : f.x + f.face * 120;
        if (P.stage === 'leap') { f.ground = false; f.vy = -330; f.vx = clamp((P.tx - f.x) / .72, -F.reach * 1.9, F.reach * 1.9); f.floatT = 0; }
        m.emit('finisherGo', { f, F });
      }
      return;
    }
    if (P.stage === 'lunge') {
      const T = F.type === 'strike' ? .36 : F.type === 'quake' ? .3 : .3;
      f.vx = f.face * (F.type === 'strike' ? 330 : 270) * (1 - P.t / T * .4);
      for (const v of m.fighters) {
        if (!f.isFoe(v) || !this.catchable(v, F.type === 'strike')) continue;
        const dx = (v.x - f.x) * f.face;
        if (dx > -14 && dx < 40 && Math.abs(v.y - f.y) < (F.type === 'strike' ? 46 : 30)) {
          if (v.st === 'GUARD' && v.face === -f.face && F.type === 'strike') { m.combat.damage(v, 4, 20, f, { chip: true }); m.hitstop(.12); m.emit('block', { a: f, v, d: { lv: 3 }, x: v.x, y: v.y - 50 }); this.miss(f, 'blocked'); return; }
          if (v.atk && v.atk.def.armor >= 2) continue;
          if (v.rag) { v.dropRag(); v.y = f.y; }
          this.connect(f, v, F, true);
          return;
        }
      }
      if (P.t >= T || f.touchRope) { f.vx *= .3; this.miss(f, 'whiff'); }
      return;
    }
    if (P.stage === 'leap') {
      const down = f.vy > 0;
      for (const v of m.fighters) {
        if (!f.isFoe(v) || !this.catchable(v, true)) continue;
        if (Math.abs(v.x - f.x) < 38 && down && f.y > v.y - 74) { f.y = v.ground ? v.y : f.y; f.ground = true; f.vx = f.vy = 0; f.y = m.arena.ground(f.x, f.y, f.side); if (v.rag) { v.dropRag(); v.y = f.y; } this.connect(f, v, F, true); return; }
      }
      if (f.ground && P.t > .1) this.miss(f, 'crash');
      return;
    }
    if (P.stage === 'stance') {
      f.vx = 0;
      // strikes landing on the stance are read in stanceCatch()
      for (const v of m.fighters) if (f.isFoe(v) && this.catchable(v) && Math.abs(v.x - f.x) < F.reach && P.t > .1 && (v.st === 'STAGGER' || v.st === 'ATTACK' || v.st === 'GRAB')) { this.connect(f, v, F, false); return; }
      if (P.t > 1.35) this.miss(f, 'stance');
    }
  }
}

return { FinisherSystem };
})();
// ---- anim/AnimationSystem.js
__m["anim/AnimationSystem.js"] = (function () {
// Chooses a pose for every wrestler each frame: stances, gaits, clips, attack drawings, paired moves, ragdolls.
// Every change of source cross-fades in joint space, so ragdolls and keyframes mix without popping.
const { clamp01, lerp, DEG, sgn } = __m["core/util.js"];
const { HOLDS } = __m["data/moves.js"];
const { BALANCE: B } = __m["data/balance.js"];
const { Joints, JN, POSE_N, J, solveFK, toWorld, pose, poseLerp } = __m["anim/skeleton.js"];
const { STANCES, stancePose, gaitPose, clip, sampleClip, attackPose, hasClip } = __m["anim/clips.js"];
const { evalPaired, pairBuffers } = __m["anim/paired.js"];
const P1 = new Float32Array(POSE_N), P2 = new Float32Array(POSE_N);
const tmpJ = new Joints();
function pairToWorld(j, face, x, y) {
  const P = j.p;
  for (let i = 0; i < JN; i++) { P[i * 2] = x + P[i * 2] * face; P[i * 2 + 1] += y; }
  j.face *= face;
  if (face < 0) { j.S = -j.S; j.H = -j.H; }
  return j;
}
const CHARGE = { grab: 'sp30 hd-16 a-20/60 b-10/60 t50/70 u10/60', strike: 'sp24 hd-14 a-50/90 b50/110 t46/60 u-6/50', dive: 'sp44 hd-24 a-40/30 b-30/30 t76/104 u40/96', stance: 'sp16 hd-8 a64/40 b84/30 t36/48 u-20/34', quake: 'sp-6 hd-10 a150/30 b156/20 t40/70 u-30/30' };
const LUNGE = { grab: 'sp36 hd-22 a88/4 b94/4 t58/40 u-46/14', strike: 'sp30 hd-16 a-30/80 b80/30 t56/44 u-46/14', quake: 'sp-18 hd-6 a-40/30 b-30/30 t50/40 u-40/10', dive: 'r30 sp20 hd10 a120/40 b130/40 t90/110 u80/110', stance: 'sp16 hd-8 a64/40 b84/30 t36/48 u-20/34' };

class AnimationSystem {
  constructor(match) { this.m = match; this.buf = pairBuffers(); }
  // ---- transitions ----
  freezeBlend(f, dur) {
    const b = f.blend || (f.blend = { from: new Joints(), t: 0, dur: 0, x: 0, y: 0, on: false });
    b.from.copy(f.joints); b.t = 0; b.dur = dur; b.x = f.x; b.y = f.y; b.on = true;
  }
  changed(f, from, to, opt) {
    const soft = { IDLE: .1, MOVE: .1, GUARD: .07, ATTACK: .035, AIR_ATTACK: .05, HITSTUN: .03, STAGGER: .1, JUMP: .05, FALL: .1, DODGE: .05, GET_UP: .16, TAUNT: .1, ROPE: .07, WHIPPED: .08, CLIMB: .12, PERCH: .12, ENTER_RING: .12, EXIT_RING: .12, FINISHER: .08, WIN: .2, HANG: .14, APRON: .12, TAGWAIT: .2, PIN: .2, PINNED: .2, KO: .05, INTRO: .1 };
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
    evalPaired(mv, t, a.dims, v ? v.dims : L.dV, a.joints, jV, B2.res);
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
      case 'TAGWAIT': C(f.wantTag ? 'tagReach' : 'apron', f.poseT); break;
      case 'ENTER_RING': case 'EXIT_RING': C('enterRing', f.t); break;
      case 'TAUNT': C(f.char.taunt || 'taunt', f.t); break;
      case 'WIN': C(f.char.win || 'win', f.t); break;
      default: this.stance(f, p);
    }
    if (f.overlay) { f.overlay.t += dt; if (f.overlay.t > f.overlay.dur) f.overlay = null; }
    const jt = f.joints;
    if (air) {
      // airborne: pelvis floats a little below leg length above the feet point
      solveFK(p, d, jt, { snap: false, px: p[12], py: -(d.leg * .92) - p[11] });
    } else solveFK(p, d, jt, {});
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
function updateTails(f, dt, groundY) {
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
const faceSign = sgn;

return { pairToWorld, AnimationSystem, updateTails, faceSign };
})();
// ---- combat/AIController.js
__m["combat/AIController.js"] = (function () {
// Computer wrestler. It only writes an Intent, sees the world through a reaction delay, and picks goals by
// utility. Difficulty changes reaction time, accuracy and variety, not health or damage.
const { clamp, sgn } = __m["core/util.js"];
const { BALANCE: B, ATTACKS } = __m["data/balance.js"];
const { MOVES } = __m["data/moves.js"];
const DIFFICULTY = {
  easy: { name: '쉬움', react: .44, err: .34, guard: .14, dodge: .05, counter: 0, rev: .03, mash: 3.4, hang: .12, plan: .78, aggr: .72, combo: .35, pick: .45, pinKick: .55, spacing: 1.25 },
  normal: { name: '보통', react: .3, err: .18, guard: .32, dodge: .13, counter: .04, rev: .1, mash: 5.6, hang: .32, plan: .5, aggr: .9, combo: .65, pick: .7, pinKick: .75, spacing: 1.05 },
  hard: { name: '어려움', react: .2, err: .09, guard: .5, dodge: .24, counter: .14, rev: .22, mash: 8, hang: .55, plan: .34, aggr: 1, combo: .85, pick: .88, pinKick: .88, spacing: 1 },
  expert: { name: '전문가', react: .145, err: .04, guard: .62, dodge: .34, counter: .3, rev: .36, mash: 10.5, hang: .74, plan: .24, aggr: 1.06, combo: .95, pick: .97, pinKick: .95, spacing: .95 },
};

class AIController {
  constructor(f, level, rng) {
    this.f = f; this.level = level; this.D = DIFFICULTY[level] || DIFFICULTY.normal; this.rng = rng;
    this.tr = f.char.ai || {};
    this.goal = null; this.goalT = 0; this.planT = .2 + rng.next() * .3; this.mem = new Map(); this.note = '';
    this.guardT = 0; this.wait = 0; this.comboWant = 0; this.lastSeenAtk = null; this.dodgeT = 0; this.mashT = 0; this.revPlanned = null; this.climbPlan = 0; this.behavior = null;
  }
  // ---- perception with reaction delay ----
  observe() {
    const now = this.f.match.time;
    for (const o of this.f.match.fighters) {
      if (o === this.f) continue;
      let h = this.mem.get(o);
      if (!h) { h = []; this.mem.set(o, h); }
      h.push({ t: now, x: o.x, y: o.y, st: o.st, face: o.face, atk: o.atk ? { id: o.atk.def.id, t: o.atk.t, d: o.atk.def } : null, vx: o.vx, side: o.side, fin: o.fin, finPhase: o.finPhase ? o.finPhase.stage : null });
      while (h.length > 2 && now - h[1].t > this.D.react) h.shift();
    }
  }
  seen(o) { const h = this.mem.get(o); if (!h || !h.length) return { t: 0, x: o.x, y: o.y, st: o.st, face: o.face, atk: null, vx: 0, side: o.side }; return h[0]; }
  update(dt) {
    const f = this.f, I = f.intent, m = f.match;
    I.mx = 0; I.up = I.down = I.downEdge = I.jump = I.atk = I.grab = I.dodge = I.fin = false;
    this.observe();
    if (f.ctrl === 'dummy' || this.behavior) { this.dummy(dt); return; }
    if (f.st === 'INTRO') return;
    this.goalT += dt; this.planT -= dt;
    if (this.wait > 0) { this.wait -= dt; }
    // situations that are not choices
    if (f.st === 'GRABBED') { this.grabbed(dt); return; }
    if (f.st === 'PINNED' || f.st === 'KO' || f.st === 'OUT' || f.st === 'TAGWAIT') return;
    if (f.st === 'DOWN' || f.st === 'STAGGER' || f.st === 'HITSTUN') { this.mash(dt, .55); this.burstCheck(); return; }
    if (f.st === 'HANG') { if (this.rng.chance(dt * (2 + this.D.mash * .3))) I.up = true; this.mash(dt, .8); return; }
    if (f.st === 'APRON') { if (f.t > .2 + this.D.react) I.jump = true; return; }
    if (f.st === 'PERCH') { this.perch(dt); return; }
    if (f.st === 'WHIPPED') { this.whipped(); return; }
    if (f.st === 'GRAB') { this.holdThink(dt); return; }
    if (f.st === 'PIN') { return; }
    if (f.entering) { this.enterRing(); return; }
    // defence reads the delayed picture
    if (this.defend(dt)) return;
    if (this.planT <= 0 || !this.goal) this.plan();
    this.execute(dt);
  }
  tap(k) { this.f.intent[k] = true; }
  // ---- defence ----
  defend(dt) {
    const f = this.f, D = this.D;
    if (this.guardT > 0) { this.guardT -= dt; f.intent.down = true; this.faceTo(this.lastThreat); if (this.guardT <= 0) this.lastThreat = null; return true; }
    if (!f.fsm.is('IDLE', 'MOVE', 'GUARD')) return false;
    for (const o of f.match.fighters) {
      if (!f.isFoe(o) || !o.alive) continue;
      const s = this.seen(o);
      if (!s.atk || s.atk.d.ground || s.side !== f.side) continue;
      const d = s.atk.d, dist = Math.abs(s.x - f.x), toward = sgn(f.x - s.x) === s.face;
      if (!toward || dist > d.reach + 40 + (d.run ? 120 : 0) + (d.air ? 60 : 0)) continue;
      const key = o.idx + ':' + s.atk.id + ':' + Math.round((f.match.time - s.atk.t) * 4);
      if (this.lastSeenAtk === key) continue;
      this.lastSeenAtk = key;
      const r = this.rng.next(), lowSt = f.stun < f.maxStun * .35;
      const left = d.startup - s.atk.t - D.react * .0;
      if (r < D.counter * (f.char.style === 'tech' ? 1.4 : 1) && !d.air && !d.run && left > -.02 && f.dodgeCd <= 0) { this.faceTo(o); this.tap('dodge'); this.note = '반격 노림'; return true; }
      if (r < D.counter + D.dodge * (lowSt ? 1.3 : 1) && f.dodgeCd <= 0) { f.intent.mx = sgn(f.x - o.x) * (this.rng.chance(.5) ? 1 : -1); if (d.run || d.air) f.intent.mx = 0; this.tap('dodge'); this.note = '회피'; return true; }
      if (r < D.counter + D.dodge + D.guard * (lowSt ? .7 : 1) * (.6 + (this.tr.def || .5) * .8)) { this.guardT = d.startup + d.active + .12 + this.rng.next() * .2; this.lastThreat = o; f.intent.down = true; this.faceTo(o); this.note = '방어'; return true; }
    }
    // finisher coming in
    for (const o of f.match.fighters) {
      if (!f.isFoe(o) || !o.finPhase) continue;
      const s = this.seen(o);
      if (s.finPhase === 'charge' || s.finPhase === 'lunge' || s.finPhase === 'leap') {
        const dist = Math.abs(o.x - f.x);
        if (dist < 160 && this.rng.chance(this.D.dodge * 2.2 * dt * 10)) { if (o.finisher.type === 'strike' && this.rng.chance(.5)) { this.guardT = .5; this.lastThreat = o; } else { f.intent.mx = sgn(f.x - o.x); this.tap('dodge'); } this.note = '피니셔 피하기'; return true; }
      }
    }
    return false;
  }
  faceTo(o) { if (o && Math.abs(o.x - this.f.x) > 4) this.f.intent.mx = 0, this.f.face = sgn(o.x - this.f.x); }
  burstCheck() {
    const f = this.f;
    if (f.burstCd > 0 || f.fin < B.burstCost) return;
    const danger = f.hp < f.maxHp * .35 || f.combo.n >= 4;
    if (danger && this.rng.chance(this.D.rev * .05)) { f.intent.down = true; this.tap('dodge'); this.note = '긴급 탈출'; }
  }
  mash(dt, k) {
    this.mashT -= dt;
    if (this.mashT <= 0) { this.mashT = 1 / (this.D.mash * k * (.8 + this.rng.next() * .4)); this.tap(this.rng.pick(['atk', 'grab', 'jump'])); }
  }
  grabbed(dt) {
    const f = this.f, L = f.link;
    if (!L) return;
    if (L.kind === 'hold') {
      this.mash(dt, 1);
      if (L.a && L.a.fin >= B.finMax && f.fin >= B.burstCost && this.rng.chance(this.D.rev * .04)) { f.intent.down = true; this.tap('dodge'); }
      return;
    }
    // reversal: press L inside the window if we noticed it in time
    if (!L.rev.tried && !L.committed && !L.noReverse) {
      if (this.revPlanned == null) this.revPlanned = this.rng.chance(this.D.rev * (L.fin ? .5 : 1) * (f.char.style === 'tech' ? 1.3 : 1)) ? B.reversalLead + this.D.react * .4 + this.rng.next() * B.reversalWindow * .8 : -1;
      if (this.revPlanned > 0 && L.t >= this.revPlanned) { this.tap('dodge'); this.revPlanned = null; }
    } else this.revPlanned = null;
  }
  onPinned(p) { this.kickAt = this.rng.chance(this.D.pinKick * (p.v.hp / p.v.maxHp * .5 + .62)) ? .6 + this.rng.next() * 1.6 : 99; }
  pinMash(p, dt) { if (p.t > (this.kickAt || 99)) return this.rng.chance(dt * this.D.mash * 1.4) ? 1 : 0; return this.rng.chance(dt * this.D.mash * .25) ? 1 : 0; }
  wantsHang() { return this.rng.chance(this.D.hang * .25); }
  // ---- goals ----
  plan() {
    const f = this.f, m = f.match, D = this.D, tr = this.tr;
    this.planT = D.plan * (.6 + this.rng.next() * .8);
    const t = this.pickTarget();
    f.target = t || f.target;
    const opts = [];
    const add = (name, w, data) => { if (w > 0) opts.push({ name, w, data }); };
    if (!t) { this.goal = { name: 'idle' }; return; }
    const dist = Math.abs(t.x - f.x), ar = m.arena;
    const tDown = t.st === 'DOWN' && !t.rag, tGrab = t.grabbable && t.side === f.side;
    const hpK = f.hp / f.maxHp, stK = f.stun / f.maxStun;
    if (f.side === 'out' && ar.hasRing && m.rules.ringOut !== 'none') add('return', 3 + (f.outCount > 5 ? 6 : 0), null);
    if (tGrab) add('grab', 4 * (.6 + (tr.grab || .5)) * D.pick, t);
    if (tDown && !tGrab) {
      add('stomp', 1.2 * (tr.dirty || .2) * 3 + .4, t);
      if (m.rules.pin && t.hp < t.maxHp * .45 && t.side === 'in') add('pin', 2.5 + (1 - t.hp / t.maxHp) * 3, t);
      if (ar.hasRing && f.side === 'in' && (tr.air || 0) > .3 && dist > 90 && m.rules.climb !== false) add('climb', (tr.air || .3) * 2.2, t);
      add('taunt', (tr.taunt || .2) * 1.5, t);
    }
    if (f.fin >= B.finMax) add('finisher', 5 * D.pick, t);
    if (!tDown) {
      add('pressure', 3 * (tr.aggr || .5) * D.aggr * (.5 + stK * .7), t);
      if (dist > 110) add('approach', 1.5, t);
      if (stK < .4 || hpK < .25) add('retreat', (1 - stK) * 2.5 * (tr.def || .5) * (D.plan > .4 ? .6 : 1), t);
      if (dist > 70 && dist < 170) add('jumpAttack', (tr.air || .3) * 1.4, t);
      if (ar.hasRing && f.side === 'in' && dist > 110 && (tr.rope || .3) > .2) add('ropeRun', (tr.rope || .3) * 1.6, t);
      if (t.st === 'GUARD' && dist < 70) add('shove', 3 * D.pick, t);
    }
    if (m.mode === 'tag' && f.legal && f.partner && f.partner.st === 'TAGWAIT' && (hpK < .38 || stK < .2)) add('tagOut', 5 * (1 - hpK), null);
    if (m.mode === 'tag' && m.pin && m.pin.v.team === f.team && m.pin.v !== f) add('save', 9, m.pin.a);
    if (!opts.length) add('approach', 1, t);
    // easier levels pick more randomly
    const temp = 1 + D.err * 3;
    const pickd = this.rng.weighted(opts, o => Math.pow(o.w, 1 / temp));
    if (!this.goal || this.goal.name !== pickd.name || this.goal.data !== pickd.data) { this.goal = { name: pickd.name, data: pickd.data, t: 0 }; this.goalT = 0; }
    this.note = { pressure: '압박', approach: '접근', retreat: '후퇴', grab: '잡기', stomp: '짓밟기', pin: '핀폴', climb: '코너 다이브', taunt: '도발', finisher: '피니셔', jumpAttack: '공중 공격', ropeRun: '로프 반동', shove: '가드 깨기', return: '링 복귀', tagOut: '교대', save: '핀 끊기', idle: '대기' }[this.goal.name] || this.goal.name;
  }
  pickTarget() {
    const f = this.f, m = f.match;
    let best = null, bs = -1e9;
    for (const o of m.fighters) {
      if (!f.isFoe(o) || !o.alive || o.st === 'TAGWAIT' || o.eliminated || o.entering) continue;
      let s = -Math.abs(o.x - f.x) * .02 - Math.abs(o.y - f.y) * .03;
      if (o.side !== f.side) s -= 1.5;
      if (o.grabbable) s += 1.6;
      if (o === f.lastHitBy) s += .8;
      s += (1 - o.hp / o.maxHp) * .9;
      if (m.rules.ringOut === 'elim' && m.arena.nearRope(o.x).dist < 80) s += .9;
      if (o === f.target) s += .5;
      if (s > bs) { bs = s; best = o; }
    }
    return best;
  }
  move(to, stopAt = 4, run = false) {
    const f = this.f, d = to - f.x;
    if (Math.abs(d) <= stopAt) return true;
    f.intent.mx = sgn(d) * (Math.abs(d) < 26 ? .6 : 1);
    if (run && Math.abs(d) > 120 && !f.running && this.rng.chance(.05)) f.running = true;
    return false;
  }
  execute(dt) {
    const f = this.f, g = this.goal, m = f.match, ar = m.arena, D = this.D;
    if (!g) return;
    g.t = (g.t || 0) + dt;
    const t = g.data && g.data.alive ? g.data : f.target;
    if (!t && g.name !== 'return' && g.name !== 'tagOut') { this.goal = null; return; }
    const dist = t ? Math.abs(t.x - f.x) : 0, dir = t ? sgn(t.x - f.x) : f.face;
    const reach = ATTACKS[f.chain[0]].reach * (f.dims.reach / 35);
    switch (g.name) {
      case 'approach': this.move(t.x, reach + 14, true); if (dist < reach + 20) this.planT = 0; break;
      case 'pressure': {
        if (t.side !== f.side) { this.goal = null; break; }
        const want = reach * .85 * D.spacing;
        if (dist > want + 6) this.move(t.x - dir * want, 3, dist > 160);
        else if (dist < want * .55) f.intent.mx = -dir * .7;
        else { f.face = dir; }
        if (dist < reach + 4 && this.wait <= 0 && f.fsm.is('IDLE', 'MOVE', 'ATTACK')) {
          if (this.rng.chance(D.combo) || f.st !== 'ATTACK') this.tap('atk');
          this.wait = (f.st === 'ATTACK' ? .12 : .18) + this.rng.next() * .25 * (1 + D.err * 2);
          if (f.chainN === 0 && this.rng.chance(.35 * (1 - D.combo))) this.wait += .4; // breathe between strings
        }
        if (g.t > 2.6) this.planT = 0;
        break;
      }
      case 'retreat': {
        const away = clamp(f.x - dir * 140, ar.ropeL + 40, ar.ropeR - 40);
        this.move(away, 8);
        if (dist < 60 && this.rng.chance(.08)) this.guardT = .4;
        if (g.t > 1.6 || f.stun > f.maxStun * .65) this.planT = 0;
        break;
      }
      case 'grab':
        if (!t.grabbable) { this.planT = 0; break; }
        if (dist > B.grabRange - 10) this.move(t.x - dir * 30, 4, dist > 120);
        else if (this.wait <= 0) { f.face = dir; this.tap('grab'); this.wait = .3; }
        break;
      case 'stomp':
        if (t.st !== 'DOWN') { this.planT = 0; break; }
        if (dist > 40) this.move(t.x - dir * 30, 3); else if (this.wait <= 0) { f.face = dir; this.tap('atk'); this.wait = .55 + this.rng.next() * .4; }
        break;
      case 'pin':
        if (t.st !== 'DOWN' || t.rag) { this.planT = 0; break; }
        if (dist > 50) this.move(t.x - dir * 34, 3); else { f.intent.down = true; f.intent.downEdge = true; this.goal = null; }
        break;
      case 'climb': {
        const nr = ar.nearRope(f.x), side = Math.abs(t.x - ar.ropeL) > Math.abs(t.x - ar.ropeR) ? -1 : 1, cx = side < 0 ? ar.ropeL + 20 : ar.ropeR - 20;
        if (t.st !== 'DOWN' && t.st !== 'STAGGER') { this.planT = 0; break; }
        if (this.move(cx, 8, true)) { f.intent.mx = side; this.tap('jump'); this.goal = null; }
        void nr;
        break;
      }
      case 'taunt': if (dist > 90 && f.fsm.is('IDLE', 'MOVE') && f.fin < B.finMax) { this.tap('fin'); this.goal = null; } else if (dist <= 90) f.intent.mx = -dir; break;
      case 'finisher': this.finisher(t, dist, dir); break;
      case 'jumpAttack':
        if (dist < 150 && dist > 60 && f.ground && f.fsm.is('IDLE', 'MOVE')) { f.intent.mx = dir; this.tap('jump'); g.jumped = 1; }
        else if (!f.ground && g.jumped && Math.abs(t.x - f.x) < 90) { this.tap('atk'); this.goal = null; }
        else if (dist >= 150) this.move(t.x - dir * 120, 6);
        else if (g.t > 1.2) this.planT = 0;
        break;
      case 'ropeRun': {
        const away = -dir, rx = away < 0 ? ar.ropeL + 12 : ar.ropeR - 12;
        if (!g.go) { f.intent.mx = away; f.running = true; if (f.st === 'ROPE') g.go = 1; if (g.t > 2) this.planT = 0; }
        else { f.intent.mx = dir; if (dist < 60) { this.tap(this.rng.chance(.25 + (this.tr.air || 0) * .4) ? 'jump' : 'atk'); if (!f.ground) this.tap('atk'); this.goal = null; } }
        void rx;
        break;
      }
      case 'shove': if (dist > 34) this.move(t.x - dir * 30, 3); else { f.face = dir; this.tap('grab'); this.goal = null; } break;
      case 'return': {
        if (f.side === 'in') { this.goal = null; break; }
        const tx = f.x < ar.mid ? ar.ropeL - ar.apron - 14 : ar.ropeR + ar.apron + 14;
        if (this.move(tx, 20)) { this.tap('jump'); }
        break;
      }
      case 'tagOut': {
        const cx = f.team === 0 ? ar.ropeL + 24 : ar.ropeR - 24;
        if (this.move(cx, 14, true)) { f.intent.down = true; f.intent.downEdge = true; this.goal = null; }
        break;
      }
      case 'save': {
        const p = m.pin;
        if (!p) { this.goal = null; break; }
        if (f.st === 'TAGWAIT') break;
        if (Math.abs(p.a.x - f.x) > 30) this.move(p.a.x, 20, true); else { this.tap('atk'); }
        break;
      }
      default: this.move(t ? t.x - dir * 60 : f.x, 6);
    }
    // in elimination modes, a foe at the ropes is a chance
    void dt;
  }
  finisher(t, dist, dir) {
    const f = this.f, F = f.finisher;
    if (!F || f.fin < B.finMax) { this.goal = null; return; }
    if (t.grabbable && dist < B.grabRange) { f.face = dir; this.tap('fin'); this.goal = null; return; }
    const want = F.type === 'dive' ? 120 : F.type === 'strike' ? 50 : F.type === 'quake' ? 40 : F.type === 'stance' ? 60 : 32;
    if (F.type === 'stance') { if (dist < 90 && t.fsm.is('ATTACK', 'MOVE')) { this.tap('fin'); this.goal = null; } else this.move(t.x - dir * want, 10); return; }
    if (Math.abs(dist - want) < 18 && t.fsm.is('IDLE', 'MOVE', 'ATTACK', 'GUARD', 'STAGGER', 'TAUNT', 'HITSTUN') && (F.type !== 'grab' || t.st !== 'DODGE')) { f.face = dir; this.tap('fin'); this.goal = null; }
    else this.move(t.x - dir * want, 6, dist > 140);
  }
  holdThink(dt) {
    const f = this.f, L = f.link, m = f.match, D = this.D;
    if (!L || L.kind !== 'hold' || L.phase !== 'hold' || L.switchT > 0 || L.strikeT > 0) return;
    if (!this.holdPlan) {
      const v = L.v, ar = m.arena;
      const choices = [];
      if (f.fin >= B.finMax && this.rng.chance(D.pick)) { this.holdPlan = { fin: 1, at: .25 + this.rng.next() * .3 }; return; }
      const slots = ['n', 'f', 'b', 'u', 'd'];
      for (const pos of ['front', 'rear']) for (const s of slots) {
        const id = f.moves[pos] && f.moves[pos][s], mv = MOVES[id];
        if (!mv) continue;
        const ok = m.grapple.check(f, v, mv).ok;
        if (!ok) continue;
        let w = 1 + mv.hp * .08;
        if (mv.tags && mv.tags.includes('ringout')) w = m.rules.ringOut === 'elim' ? 8 : m.rules.ringOut === 'count' ? .4 : .1;
        if (mv.tags && mv.tags.includes('whip')) w = (this.tr.rope || .3) * 2;
        if (pos === 'rear') w *= .8;
        w *= 1 / (1 + (f.moveStale[id] || 0) * 1.2);
        if (mv.lift > f.stats.lift) w *= .5;
        choices.push({ pos, s, id, w });
      }
      if (!choices.length) { this.holdPlan = { strike: 1, at: .3 }; return; }
      const c = this.rng.weighted(choices, o => Math.pow(o.w, 1 + D.pick));
      this.holdPlan = Object.assign(c, { at: .2 + this.rng.next() * .45 * (1 + D.err * 2), strikes: this.rng.chance(.35) ? this.rng.int(1, 2) : 0 });
      void ar;
    }
    const P = this.holdPlan;
    if (L.t < P.at) return;
    if (P.fin) { this.tap('fin'); this.holdPlan = null; return; }
    if (P.strikes > 0 && L.strikes < P.strikes) { this.tap('atk'); P.at = L.t + .3; return; }
    if (P.strike) { this.tap('atk'); this.holdPlan = null; return; }
    if (P.pos !== L.pos) { if (L.switches < 2) this.tap('dodge'); else this.holdPlan = null; P.at = L.t + .28; return; }
    const I = f.intent;
    if (P.s === 'u') I.up = true; else if (P.s === 'd') I.down = true; else if (P.s === 'f') I.mx = f.face; else if (P.s === 'b') I.mx = -f.face;
    if (P.id === 'ringOut' || P.id === 'cornerSmash') { const nr = m.arena.nearRope(f.x); I.mx = P.s === 'f' ? f.face : P.s === 'b' ? -f.face : I.mx; void nr; }
    this.tap('grab');
    this.holdPlan = null;
  }
  perch() {
    const f = this.f;
    const n = f.nearestFoe(320, o => sgn(o.x - f.x) === f.face);
    if (n && f.t > .3 + this.D.react && (n.st === 'DOWN' || n.st === 'STAGGER' || this.rng.chance(.3))) this.tap('atk');
    else if (f.t > 1.4) this.tap('atk');
  }
  whipped() {
    const f = this.f, w = f.whip;
    if (!w || !w.back) return;
    const a = w.by;
    if (a && Math.abs(a.x - f.x) < 80 && w.t > .3) {
      if (this.rng.chance(this.D.dodge * .6)) this.tap('dodge');
      else if (this.rng.chance(this.D.counter * 1.2 + .05)) this.tap('atk');
    }
  }
  enterRing() {
    const f = this.f, ar = f.match.arena;
    if (f.side === 'in') { f.entering = null; return; }
    if (f.st === 'ENTER_RING') return;
    const tx = f.entering.left ? ar.ropeL - ar.apron - 16 : ar.ropeR + ar.apron + 16;
    if (this.move(tx, 16)) this.tap('jump');
    else f.running = true;
  }
  // Practice-mode dummies.
  dummy(dt) {
    const f = this.f, b = this.behavior || 'idle', I = f.intent, t = f.nearestFoe();
    if (f.st === 'GRABBED') { if (b === 'escape') this.grabbed(dt); return; }
    if (f.st === 'DOWN' || f.st === 'STAGGER') { if (b === 'escape') this.mash(dt, .6); return; }
    if (b === 'guard') { I.down = true; if (t) f.face = sgn(t.x - f.x) || f.face; }
    else if (b === 'attack') { if (t && Math.abs(t.x - f.x) < 60) { f.face = sgn(t.x - f.x); if (this.rng.chance(dt * 3)) this.tap('atk'); } }
    else if (b === 'dodge') { if (this.defend(dt)) return; }
    else if (b === 'ai') { this.behavior = null; }
  }
}

return { DIFFICULTY, AIController };
})();
// ---- combat/MatchManager.js
__m["combat/MatchManager.js"] = (function () {
// One match: owns the fighters and systems, runs the rules of each mode, the referee and the win conditions.
const { Emitter, RNG, clamp, sgn } = __m["core/util.js"];
const { BALANCE: B } = __m["data/balance.js"];
const { CHARACTERS } = __m["data/characters.js"];
const { Arena, ARENAS } = __m["combat/arena.js"];
const { Fighter, beginEnter, standUp } = __m["combat/CharacterController.js"];
const { PhysicsSystem } = __m["combat/PhysicsSystem.js"];
const { CombatSystem, StunSystem } = __m["combat/CombatSystem.js"];
const { GrappleSystem } = __m["combat/GrappleSystem.js"];
const { WrestlingMoveSystem } = __m["combat/WrestlingMoveSystem.js"];
const { FinisherSystem } = __m["combat/FinisherSystem.js"];
const { AnimationSystem } = __m["anim/AnimationSystem.js"];
const { AIController } = __m["combat/AIController.js"];
const MODES = {
  single: { name: '싱글 매치', desc: '1대1. 상대의 체력을 0으로 만들면 KO 승리.', rules: { ko: true, pin: false, ringOut: 'count', time: 300 } },
  pin: { name: '핀폴 매치', desc: '다운된 상대를 S로 눌러 3카운트를 세면 승리. 체력이 0이 되어도 끝나지 않는다.', rules: { ko: false, pin: true, ringOut: 'count', time: 360 } },
  rumble: { name: '로얄럼블', desc: '일정 시간마다 새 선수가 입장. 톱로프 너머로 떨어지면 탈락, 마지막 1명이 승리.', rules: { ko: false, pin: false, ringOut: 'elim', time: 0 } },
  tag: { name: '태그팀 매치', desc: '2대2. 자기 코너에서 S로 동료와 교대. KO 또는 핀폴로 승리.', rules: { ko: true, pin: true, ringOut: 'count', time: 420 } },
  royal: { name: '배틀로얄', desc: '모두가 처음부터 링에. KO 또는 톱로프 너머로 떨어지면 탈락.', rules: { ko: true, pin: false, ringOut: 'elim', time: 0 } },
  practice: { name: '연습 모드', desc: '상대 행동과 체력을 바꿔 가며 기술을 시험한다. 기록에 남지 않는다.', rules: { ko: false, pin: true, ringOut: 'none', time: 0 } },
  street: { name: '길거리 승부', desc: '링 없는 뒷골목. 쓰러뜨리면 끝.', rules: { ko: true, pin: false, ringOut: 'none', time: 240 } },
};

class MatchManager extends Emitter {
  constructor(cfg) {
    super();
    this.cfg = cfg; this.mode = cfg.mode || 'single';
    const M = MODES[this.mode] || MODES.single;
    this.rules = Object.assign({}, M.rules, cfg.rules || {});
    const ad = ARENAS[cfg.arena || 'hall'] || ARENAS.hall;
    this.arenaDef = ad; this.arena = new Arena(ad);
    if (!this.arena.hasRing) { this.rules.ringOut = 'none'; this.rules.climb = false; }
    this.rng = new RNG(cfg.seed || (Date.now() & 0xffffff));
    this.physics = new PhysicsSystem(this); this.combat = new CombatSystem(this); this.stun = new StunSystem(this);
    this.grapple = new GrappleSystem(this); this.wrestle = new WrestlingMoveSystem(this); this.finisher = new FinisherSystem(this); this.anim = new AnimationSystem(this);
    this.fighters = []; this.links = []; this.queue = []; this.time = 0; this.clock = 0; this.phase = 'intro'; this.result = null;
    this.freeze = 0; this.slowT = 0; this.slowK = 1; this.hype = 25; this.pin = null; this.endT = 0; this.introT = 0;
    this.ref = { x: this.arena.mid, y: this.arena.matY, face: 1, act: 'watch', t: 0, count: 0, target: null, vx: 0, gait: 0, raise: null };
    this.practice = cfg.practice || null;
    this.log = []; this.faults = 0; this.stats = { finishers: 0, reversals: 0, counters: 0, moves: 0 };
    this.on('fault', () => this.faults++);
    this.on('overRope', e => this.onOverRope(e.f));
    this.setup();
  }
  // ---- creation ----
  addFighter(e, i, pos) {
    const c = typeof e.char === 'string' ? CHARACTERS[e.char] : e.char;
    const f = new Fighter(this, c, Object.assign({ idx: this.fighters.length, team: e.team != null ? e.team : i }, e, pos));
    if (f.ctrl === 'ai' || f.ctrl === 'dummy') f.ai = new AIController(f, e.difficulty || 'normal', this.rng);
    this.fighters.push(f);
    this.anim.solo(f, 0);
    return f;
  }
  setup() {
    const ar = this.arena, E = this.cfg.entrants || [];
    const L = ar.ropeL + 110, R = ar.ropeR - 110;
    if (this.mode === 'rumble') {
      const n = Math.min(B.rumbleStart, E.length);
      E.forEach((e, i) => { e.team = e.team != null ? e.team : i; });
      for (let i = 0; i < n; i++) this.addFighter(E[i], i, { x: i ? R : L, y: ar.matY, face: i ? -1 : 1, side: 'in' });
      this.queue = E.slice(n);
      this.nextEntry = this.cfg.interval || B.rumbleInterval;
      this.total = E.length;
    } else if (this.mode === 'tag') {
      // entrants: [p, partner, foe, foePartner]
      const spots = [{ x: L, face: 1 }, { x: ar.ropeL - 9, face: 1, apron: 1 }, { x: R, face: -1 }, { x: ar.ropeR + 9, face: -1, apron: 1 }];
      E.slice(0, 4).forEach((e, i) => {
        const s = spots[i], f = this.addFighter(Object.assign({}, e, { team: i < 2 ? 0 : 1 }), i, { x: s.x, y: ar.matY, face: s.face, side: s.apron ? 'out' : 'in' });
        f.legal = !s.apron;
        if (s.apron) { f.fsm.set('TAGWAIT', { force: true }); f.y = ar.matY; }
      });
      const F = this.fighters;
      if (F.length === 4) { F[0].partner = F[1]; F[1].partner = F[0]; F[2].partner = F[3]; F[3].partner = F[2]; }
    } else {
      const n = E.length;
      const xs = n === 2 ? [L, R] : Array.from({ length: n }, (_, i) => ar.ropeL + 60 + (ar.ropeR - ar.ropeL - 120) * (n === 1 ? .5 : i / (n - 1)));
      E.forEach((e, i) => this.addFighter(e, i, { x: xs[i], y: ar.matY, face: xs[i] < ar.mid ? 1 : -1, side: 'in', lane: n > 2 ? (i % 3) * 3 - 3 : 0 }));
    }
    for (const f of this.fighters) { if (f.st !== 'TAGWAIT') f.fsm.set('INTRO', { force: true }); }
    if (this.cfg.skipIntro) this.beginFight(true);
  }
  get human() { return this.fighters.find(f => f.ctrl === 'human' && (f.legal || this.mode !== 'tag')) || this.fighters.find(f => f.ctrl === 'human'); }
  beginFight(instant) {
    this.phase = instant ? 'fight' : 'ready'; this.introT = 0;
    for (const f of this.fighters) if (f.st === 'INTRO') f.set('IDLE', { force: true });
    if (instant) this.emit('bell', { start: true });
  }
  // ---- feedback hooks ----
  hitstop(s) { this.freeze = Math.max(this.freeze, Math.min(.2, s)); }
  slowmo(k, t) { this.slowK = Math.min(this.slowK, k); this.slowT = Math.max(this.slowT, t); }
  addHype(v) { this.hype = clamp(this.hype + v, 0, 100); }
  // ---- per frame ----
  update(dtReal) {
    dtReal = Math.min(dtReal, 1 / 20);
    if (this.freeze > 0) { this.freeze -= dtReal; this.emit('frozen', dtReal); this.anim.update(0); return; }
    if (this.slowT > 0) { this.slowT -= dtReal; if (this.slowT <= 0) this.slowK = 1; }
    const dt = dtReal * this.slowK;
    this.time += dt;
    this.arena.update(dt);
    if (this.phase === 'intro' || this.phase === 'ready') this.introTick(dt);
    if (this.phase === 'fight') { this.clock += dt; this.hype = Math.max(10, this.hype - dt * .8); }
    for (const f of this.fighters) {
      if (f.gone) continue;
      if (f.ai && (this.phase === 'fight' || f.st === 'INTRO')) f.ai.update(dt);
      else if (f.ctrl !== 'human' || this.phase !== 'fight') this.blankIntent(f);
      if (this.practice && f.ctrl !== 'human') this.practiceTick(f, dt);
      f.tick(dt);
    }
    this.grapple.update(dt);
    this.wrestle.update(dt);
    this.physics.update(dt);
    this.combat.update();
    this.stun.update(dt);
    if (this.pin) this.pinTick(dt);
    this.rulesTick(dt);
    this.refTick(dt);
    this.anim.update(dt);
  }
  blankIntent(f) { const I = f.intent; I.mx = 0; I.up = I.down = I.downEdge = I.jump = I.atk = I.grab = I.dodge = I.fin = false; }
  introTick(dt) {
    this.introT += dt;
    if (this.phase === 'intro' && this.introT > (this.cfg.introTime || 3.2)) { this.phase = 'ready'; this.introT = 0; this.emit('ready', {}); }
    if (this.phase === 'ready' && this.introT > 1.3) { this.phase = 'fight'; for (const f of this.fighters) if (f.st === 'INTRO') f.set('IDLE', { force: true }); this.emit('bell', { start: true }); }
  }
  practiceTick(f, dt) {
    const P = this.practice;
    if (P.infinite) { f.hp = Math.max(f.hp, f.maxHp * .05); if (f.st === 'IDLE' && f.t > 1) f.hp = Math.min(f.maxHp, f.hp + f.maxHp * dt * .5); }
    if (P.stunLock) f.stun = Math.min(f.stun, f.maxStun * .02 + (f.st === 'DOWN' ? 0 : f.stun));
    const h = this.human;
    if (P.fullFin && h) h.fin = B.finMax;
    void dt;
  }
  // S pressed on the ground: pin, tag, or nothing.
  contextS(f, I) {
    const ar = this.arena;
    if (this.rules.pin && f.side === 'in') {
      const v = f.nearestFoe(58, o => o.st === 'DOWN' && !o.rag && o.side === 'in' && (!this.mode === 'tag' || o.legal));
      if (v && !this.pin && !(this.mode === 'tag' && !v.legal)) { this.startPin(f, v); return true; }
    }
    if (this.mode === 'tag' && f.legal && f.partner && f.partner.st === 'TAGWAIT') {
      const cx = f.team === 0 ? ar.ropeL : ar.ropeR;
      if (Math.abs(f.x - cx) < B.tagRange) { this.tag(f); return true; }
    }
    void I;
    return false;
  }
  // ---- pinfall ----
  startPin(a, v) {
    if (!a.set('PIN')) return;
    v.set('PINNED', { force: true });
    a.face = sgn(v.x - a.x) || a.face; a.x = v.x - a.face * 34; a.vx = 0;
    v.pinTries = (v.pinTries || 0) + 1;
    const need = B.pinBase + B.pinPerHp * (1 - v.hp / v.maxHp) + B.pinPerTry * (v.pinTries - 1);
    this.pin = { a, v, t: 0, count: 0, next: .55, kick: 0, need, struggle: 0 };
    a.pin = v.pin = this.pin;
    this.ref.act = 'count'; this.ref.target = v;
    if (v.ai) v.ai.onPinned(this.pin);
    this.emit('pin', { a, v });
  }
  pinControl(a, I, dt) {
    const p = this.pin;
    if (!p || p.a !== a) { a.set('IDLE', { force: true }); return; }
    if (a.consume('dodge') || a.consume('grab')) this.breakPin('let');
    void I; void dt;
  }
  pinTick(dt) {
    const p = this.pin, { a, v } = p;
    p.t += dt;
    if (!a.alive || !v.alive || a.st !== 'PIN' || v.st !== 'PINNED') { this.breakPin('state'); return; }
    let n = 0;
    for (const k of ['atk', 'grab', 'dodge', 'jump']) if (v.buf[k] >= B.inputBuffer - 1e-6) n++;
    if (v.ai) n += v.ai.pinMash(p, dt);
    p.kick += n * B.pinMash * (.7 + .3 * v.stats.down) - dt * 6;
    p.kick = Math.max(0, p.kick);
    p.struggle = Math.max(0, p.struggle - dt * 4) + n * .35;
    if (p.kick >= p.need) { this.emit('kickout', { a, v, count: p.count }); this.breakPin('kickout'); return; }
    if (p.t >= p.next) {
      p.count++; p.next += B.pinStep;
      this.emit('count', { n: p.count, pin: true, a, v });
      if (p.count >= 3) { this.end({ winner: a, loser: v, how: 'pin', team: a.team }); }
    }
  }
  breakPin(why) {
    const p = this.pin;
    if (!p) return;
    this.pin = null; p.a.pin = p.v.pin = null;
    this.ref.act = 'watch'; this.ref.target = null;
    if (this.phase === 'end') return;
    const { a, v } = p;
    if (v.alive && v.st === 'PINNED') { v.stun = Math.max(v.stun, v.maxStun * .3); v.downClock = 0; v.downTime = why === 'kickout' ? .25 : .5; v.set('DOWN', { force: true }); v.grabImm = 60; v.postMove = true; }
    if (a.alive && a.st === 'PIN') { a.lieClip = 'downProne'; standUp(a, 0, 'downProne'); a.inv = .3; if (why === 'kickout') a.vx = -a.face * 40; }
    this.emit('pinBreak', { a, v, why });
  }
  // ---- tag team ----
  tag(f) {
    const p = f.partner, ar = this.arena;
    f.legal = false; p.legal = true;
    if (f.ctrl === 'human') { p.ctrl = 'human'; f.ctrl = 'ai'; if (!f.ai) f.ai = new AIController(f, 'normal', this.rng); p.ai = null; }
    else if (p.ctrl === 'ai' && !p.ai) p.ai = new AIController(p, this.cfg.entrants[p.idx].difficulty || 'normal', this.rng);
    f.exitTo = 'apron';
    f.enter = { x0: f.x, y0: f.y, x1: f.team === 0 ? ar.ropeL - 9 : ar.ropeR + 9, left: f.team === 0 };
    f.set('EXIT_RING', { force: true });
    p.inv = .8;
    beginEnter(p);
    p.wantTag = false;
    this.addHype(10);
    this.emit('tag', { f, p });
  }
  // ---- rules ----
  koAllowed() { return !!this.rules.ko; }
  onZeroHp(v, a) {
    if (this.phase === 'end') return;
    if (this.practice) { v.hp = this.practice.infinite ? v.maxHp * .05 : 0; return; }
    if (!this.rules.ko) { v.hp = 0; return; }
    if (v.link) { v.koPending = a; return; }
    if (v.rag && (v.st === 'HITSTUN' || v.st === 'DOWN')) { v.set('KO', { force: true }); v.koBy = a; this.afterKO(v, a); return; }
    this.knockOut(v, a, (a ? sgn(v.x - a.x) : 1) * 140, -160, 3);
  }
  knockOut(v, a, vx, vy, spin) {
    if (v.st === 'KO') return;
    if (v.link) { v.koPending = a; return; }
    v.set('KO', { force: true });
    if (!v.rag) v.ragdoll(vx, vy, spin);
    v.koBy = a;
    this.afterKO(v, a);
  }
  afterKO(v, a) {
    v.expr = 'ko'; v.exprT = 99;
    this.emit('ko', { v, a });
    if (a) a.kills++;
    if (this.mode === 'royal' || this.mode === 'tag' && false) this.eliminate(v, 'ko');
    this.checkWin();
  }
  eliminate(f, how) {
    if (f.eliminated) return;
    f.eliminated = true; f.outHow = how; f.outAt = this.clock;
    if (f.st !== 'KO') f.set('OUT', { force: true });
    if (f.lastHitBy && f.lastHitBy !== f) f.lastHitBy.kills++;
    if (f.link) { if (f.link.kind === 'hold') this.grapple.breakLink(f.link, 'out'); }
    this.emit('eliminated', { f, how, left: this.alive().length });
    this.checkWin();
  }
  alive() { return this.fighters.filter(f => !f.eliminated && f.st !== 'KO'); }
  rulesTick(dt) {
    const ar = this.arena;
    for (const f of this.fighters) {
      if (f.gone) continue;
      // over the top rope and onto the floor
      if (ar.hasRing && f.side === 'out' && !f.eliminated && this.phase === 'fight') {
        const onFloor = f.y >= ar.floorY - 2 && (f.ground || (f.rag && f.rag.ground));
        if (this.rules.ringOut === 'elim' && onFloor && f.wasIn && f.st !== 'ENTER_RING' && f.st !== 'TAGWAIT') { f.ringOuts++; this.eliminate(f, 'ringout'); continue; }
        if (this.rules.ringOut === 'count' && onFloor && this.mode !== 'practice' && f.st !== 'TAGWAIT' && (this.mode !== 'tag' || f.legal)) {
          f.outCount += dt / B.countStep;
          if (Math.floor(f.outCount) !== Math.floor(f.outCount - dt / B.countStep)) this.emit('count', { n: Math.floor(f.outCount), out: true, f });
          if (f.outCount >= B.countMax) this.countOut(f);
        }
      } else if (f.side === 'in') { f.outCount = Math.max(0, f.outCount - dt * 4); f.wasIn = true; }
      // a ragdoll flying over the ropes may grab the top rope
      if (f.ropeChance > 0) { f.ropeChance -= dt; if (f.rag && f.has('dodge') && f.hp > 0) { f.ropeChance = 0; this.toHang(f); } else if (f.rag && f.ai && f.ai.wantsHang()) { f.ropeChance = 0; this.toHang(f); } }
    }
    // rumble entries
    if (this.mode === 'rumble' && this.phase === 'fight' && this.queue.length) {
      this.nextEntry -= dt;
      const inRing = this.alive().length;
      if (this.nextEntry <= 0 && inRing < B.rumbleMaxInRing || inRing < 2) { this.nextEntry = this.cfg.interval || B.rumbleInterval; this.rumbleEntry(); }
    }
    // tag partners heal on the apron
    if (this.mode === 'tag') for (const f of this.fighters) if (f.st === 'TAGWAIT' && f.alive) {
      const cap = f.maxHp * (1 - B.tagMaxHeal * 0) - 0;
      f.hp = Math.min(cap, f.hp + B.tagHeal * dt * (f.hp < f.maxHp * .5 ? 1.3 : 1) * .5); f.stun = Math.min(f.maxStun, f.stun + B.tagStun * dt);
      const mate = f.partner;
      f.wantTag = mate && mate.legal && mate.alive && Math.abs(mate.x - f.x) < 90;
    }
    if (this.rules.time && this.phase === 'fight' && this.clock >= this.rules.time) this.timeUp();
  }
  toHang(f) {
    const ar = this.arena;
    f.x = f.x < ar.mid ? ar.ropeL - 9 : ar.ropeR + 9;
    f.dropRag(); f.side = 'out'; f.hangT = B.hangTime; f.hangMash = 0;
    f.set('HANG', { force: true });
    this.emit('hang', { f });
  }
  onOverRope(f) { if (this.rules.ringOut === 'elim' && f.rag && !f.eliminated) f.ropeChance = .32; }
  rumbleEntry() {
    const e = this.queue.shift(), ar = this.arena;
    const left = this.rng.chance(.5);
    const f = this.addFighter(e, this.fighters.length, { x: left ? ar.x0 + 30 : ar.x1 - 30, y: ar.floorY, face: left ? 1 : -1, side: 'out' });
    f.inv = 1.5;
    f.fsm.set('IDLE', { force: true });
    f.entering = { left, t: 0 };
    this.emit('entry', { f, left: this.queue.length });
  }
  countOut(f) {
    if (this.phase === 'end') return;
    const foes = this.fighters.filter(o => o.isFoe(f) && !o.eliminated && o.st !== 'KO');
    const inside = foes.filter(o => o.side === 'in');
    if (!inside.length && foes.every(o => o.outCount >= B.countMax - .05)) { this.end({ draw: true, how: 'double countout' }); return; }
    const w = inside[0] || foes[0];
    this.end({ winner: w, loser: f, how: 'countout', team: w ? w.team : null });
  }
  timeUp() {
    // decision: health percentage
    const teams = new Map();
    for (const f of this.fighters) { const t = teams.get(f.team) || { s: 0, f }; t.s += f.eliminated ? 0 : f.hp / f.maxHp; teams.set(f.team, t); }
    const list = [...teams.values()].sort((a, b) => b.s - a.s);
    if (list.length < 2 || Math.abs(list[0].s - list[1].s) < .04) { this.end({ draw: true, how: 'time' }); return; }
    const w = list[0].f;
    this.end({ winner: w, loser: list[1].f, how: 'decision', team: w.team });
  }
  checkWin() {
    if (this.phase === 'end' || this.practice) return;
    if (this.mode === 'tag') {
      for (const f of this.fighters) if (f.st === 'KO' && f.legal) { const w = this.fighters.find(o => o.team !== f.team && o.legal) || this.fighters.find(o => o.team !== f.team); this.end({ winner: w, loser: f, how: 'ko', team: w.team }); return; }
      return;
    }
    const alive = this.alive();
    if (this.mode === 'rumble' && this.queue.length) return;
    const teams = new Set(alive.map(f => f.team));
    if (teams.size <= 1) {
      const w = alive[0] || null, loser = this.fighters.filter(f => f !== w).sort((a, b) => (b.outAt || 9999) - (a.outAt || 9999))[0];
      const how = loser ? (loser.st === 'KO' ? 'ko' : loser.outHow || 'ko') : 'ko';
      this.end({ winner: w, loser, how, team: w ? w.team : null });
    }
  }
  end(r) {
    if (this.phase === 'end') return;
    this.phase = 'end'; this.result = r; this.endT = 0;
    if (this.pin) this.breakPin('end');
    this.slowmo(.3, 1.3);
    this.emit('end', r);
    this.ref.act = 'raise'; this.ref.raise = r.winner || null;
  }
  // ---- referee ----
  refTick(dt) {
    const r = this.ref, ar = this.arena;
    if (!ar.hasRing) return;
    r.t += dt;
    let tx = r.x;
    if (r.act === 'count' && r.target) tx = r.target.x + (r.target.x < ar.mid ? 40 : -40);
    else if (r.act === 'raise' && r.raise) tx = r.raise.x + (r.raise.x < ar.mid ? 30 : -30);
    else {
      const act = this.fighters.filter(f => f.alive && f.side === 'in');
      if (act.length) {
        const cx = act.reduce((s, f) => s + f.x, 0) / act.length;
        // stand clear of the action, on the emptier side
        const left = cx - ar.ropeL, right = ar.ropeR - cx;
        tx = Math.abs(r.x - (cx - 100)) < Math.abs(r.x - (cx + 100)) && left > 120 ? cx - 100 : right > 120 ? cx + 100 : cx - 100;
        for (let it = 0; it < 3; it++) for (const f of act) if (Math.abs(f.x - tx) < 46) tx = f.x + (tx >= f.x ? 48 : -48);
      }
    }
    tx = clamp(tx, ar.ropeL + 22, ar.ropeR - 22);
    const d = tx - r.x;
    const crowded = this.fighters.some(f => f.alive && f.side === 'in' && Math.abs(f.x - r.x) < 36);
    r.vx = Math.abs(d) > 6 ? sgn(d) * Math.min(crowded ? 210 : 150, Math.abs(d) * 4) : 0;
    r.x += r.vx * dt;
    if (r.vx) r.face = sgn(r.vx); else if (r.target) r.face = sgn(r.target.x - r.x) || r.face;
    r.gait += Math.abs(r.vx) * dt * .07;
  }
  summary() {
    return this.fighters.map(f => ({ name: f.name, char: f.charId, team: f.team, hp: f.hp, maxHp: f.maxHp, dmgTaken: f.dmgTaken, dmgDealt: f.dmgDealt, downs: f.downs, ko: f.st === 'KO', out: f.eliminated, finishersTaken: f.finishersTaken, ringOuts: f.ringOuts, kills: f.kills, perfects: f.perfects, counters: f.counters, hits: f.hitsLanded, moves: f.movesDone.size }));
  }
}

return { MODES, MatchManager };
})();
// ---- scenes/TitleScene.js
__m["scenes/TitleScene.js"] = (function () {
// Title screen and quick-match setup.
const { VIEW_W, VIEW_H, RNG, clamp, damp } = __m["core/util.js"];
const { drawText, textWidth } = __m["render/pixelfont.js"];
const { UI, mixHex } = __m["render/palette.js"];
const { canvas, rect, bands, ellipse, line, poly, glow, cone, neon, windowPane } = __m["render/painter.js"];
const { panel, menuList, prompt, gauge, fade } = __m["render/ui.js"];
const { BodyCanvas } = __m["render/raster.js"];
const { drawBody } = __m["render/body.js"];
const { Joints, dimsFor, solveFK, toWorld, JN } = __m["anim/skeleton.js"];
const { stancePose } = __m["anim/clips.js"];
const { CHARACTERS, ROSTER_IDS, STYLES, STAT_INFO, statBar } = __m["data/characters.js"];
const { MODES } = __m["combat/MatchManager.js"];
const { ARENAS } = __m["combat/arena.js"];
const { DIFFICULTY } = __m["combat/AIController.js"];
const { FINISHERS } = __m["data/moves.js"];
const P = new Float32Array(16);
// A wrestler standing in a stance, drawn outside any match (menus, title, town portraits).
class Mannequin {
  constructor() { this.bc = new BodyCanvas(); this.j = new Joints(); }
  draw(g, look, stance, x, y, face, t, o = {}) {
    const d = dimsFor(look.build, look.scale || 1);
    stancePose(stance, t, P);
    if (o.pose) for (let i = 0; i < 16; i++) P[i] = o.pose[i];
    solveFK(P, d, this.j, {});
    toWorld(this.j, face, x, y);
    this.bc.setLight(o.env || { rim: '#4fd6ff' });
    this.bc.begin(this.j.x(0), this.j.y(0) - 4);
    drawBody(this.bc, this.j, d, look, { expr: o.expr || 'neutral', cape: o.cape, hand: o.hand });
    this.bc.finish({ outline: o.outline });
    this.bc.drawTo(g, 0, 0, o.alpha != null ? o.alpha : 1);
  }
}

function titleBackdrop() {
  const [c, g] = canvas(VIEW_W, VIEW_H), r = new RNG(21);
  bands(g, 0, 0, VIEW_W, 230, ['#070a1e', '#0c1230', '#111a42', '#18224f', '#22285c', '#2f2a62', '#43306a', '#5a356c']);
  for (let i = 0; i < 120; i++) rect(g, r.next() < .3 ? '#ffffff' : '#9fb0ff', (r.next() * VIEW_W) | 0, (r.next() * 140) | 0, 1, 1);
  ellipse(g, '#fff3cf', 520, 60, 16, 16); ellipse(g, '#ffe39a', 524, 57, 14, 14); ellipse(g, '#1c2456', 531, 52, 12, 12);
  for (let x = 0; x < VIEW_W; x += 7 + (r.next() * 12 | 0)) { const h = 26 + r.next() * 70, w = 9 + (r.next() * 14 | 0); rect(g, '#121633', x, 210 - h, w, h + 20); for (let k = 0; k < h / 5; k++) if (r.next() < .45) rect(g, r.pick(['#ffd27a', '#ff8fc4', '#7fe0ff', '#ffd27a']), x + 2 + (r.next() * (w - 4) | 0), 210 - h + 3 + k * 5, 1, 2); }
  // lighthouse on a cape
  poly(g, '#0d1128', [[40, 230], [120, 196], [200, 230]]);
  rect(g, '#e6e9f2', 108, 132, 14, 66); rect(g, '#c2333f', 108, 146, 14, 8); rect(g, '#c2333f', 108, 170, 14, 8); rect(g, '#2a2f4a', 104, 124, 22, 8); rect(g, '#ffe9a8', 110, 126, 10, 5);
  // cranes and ships
  for (const cx of [300, 410]) { rect(g, '#1d2148', cx, 110, 4, 100); rect(g, '#1d2148', cx - 50, 110, 86, 4); line(g, '#2a3066', cx - 40, 114, cx - 40, 160); rect(g, '#ff5f5f', cx - 51, 108, 2, 2); }
  poly(g, '#161a3c', [[460, 214], [600, 214], [586, 230], [470, 230]]); rect(g, '#161a3c', 500, 196, 40, 18); rect(g, '#ffd27a', 506, 202, 3, 2); rect(g, '#ffd27a', 514, 202, 3, 2);
  // sea
  bands(g, 0, 230, VIEW_W, 130, ['#1a2152', '#161e4a', '#121a40', '#0f1638', '#0c1230', '#0a0e28']);
  for (let i = 0; i < 90; i++) rect(g, r.pick(['#ff8fc4', '#7fe0ff', '#ffd27a', '#3a4688']), (r.next() * VIEW_W) | 0, 234 + (r.next() * 120 | 0), 3 + (r.next() * 9 | 0), 1);
  // pier deck
  rect(g, '#2a1e2c', 0, 300, VIEW_W, 60); for (let x = 0; x < VIEW_W; x += 16) rect(g, '#3a2a36', x, 300, 15, 60); rect(g, '#120c18', 0, 298, VIEW_W, 3);
  return c;
}

class TitleScene {
  constructor(game, o = {}) {
    this.game = game; this.t = 0; this.sel = 0; this.bg = titleBackdrop(); this.man = new Mannequin(); this.rain = []; const r = new RNG(5);
    for (let i = 0; i < 80; i++) this.rain.push({ x: r.next() * VIEW_W, y: r.next() * VIEW_H, s: 180 + r.next() * 120 });
    this.onCareer = o.onCareer; this.hasSave = o.hasSave; this.onNew = o.onNew;
    game.audio.music('title');
    game.screen.resetFx();
  }
  items() {
    return [
      { label: this.hasSave ? '커리어 이어하기' : '커리어 시작', act: () => this.onCareer && this.onCareer(this.hasSave ? 'continue' : 'new') },
      ...(this.hasSave ? [{ label: '새 커리어', act: () => this.onCareer && this.onCareer('new') }] : []),
      { label: '빠른 경기', act: () => this.game.go(() => new QuickScene(this.game, 'quick')) },
      { label: '연습 모드', act: () => this.game.go(() => new QuickScene(this.game, 'practice')) },
      { label: '설정', act: () => this.game.openSettings && this.game.openSettings() },
      { label: '조작법', act: () => this.game.showControls() },
    ];
  }
  update(dt) {
    this.t += dt;
    const inp = this.game.input, it = this.items(), A = this.game.audio;
    if (inp.pressed('up')) { this.sel = (this.sel + it.length - 1) % it.length; A.sfx('ui'); }
    if (inp.pressed('down')) { this.sel = (this.sel + 1) % it.length; A.sfx('ui'); }
    if (inp.menuPressed('confirm')) { A.init(); A.sfx('ok'); it[this.sel].act(); }
    for (const d of this.rain) { d.y += d.s * dt; d.x -= d.s * .25 * dt; if (d.y > VIEW_H) { d.y = -6; d.x = Math.random() * (VIEW_W + 60); } }
  }
  draw(w, u) {
    w.drawImage(this.bg, 0, 0);
    // lighthouse beam
    const a = this.t * .6, bx = 115, by = 128;
    w.save(); w.globalCompositeOperation = 'lighter'; w.globalAlpha = .1 + .05 * Math.sin(this.t * 2);
    const gr = w.createLinearGradient(bx, by, bx + Math.cos(a) * 640, by);
    gr.addColorStop(0, '#fff6c8'); gr.addColorStop(1, 'rgba(0,0,0,0)'); w.fillStyle = gr;
    w.beginPath(); w.moveTo(bx, by); w.lineTo(bx + Math.cos(a) * 700, by - 40 - Math.sin(a) * 30); w.lineTo(bx + Math.cos(a) * 700, by + 30 + Math.sin(a) * 30); w.closePath(); w.fill(); w.restore();
    glow(w, bx + 4, by, 26, '#fff3c0', .7);
    // two wrestlers on the pier
    this.man.draw(w, CHARACTERS.rookie.look, 'std', 220, 302, 1, this.t, { env: { rim: '#ff5fa2' } });
    this.man.draw(w, CHARACTERS.fogking.look, 'fog', 430, 302, -1, this.t, { env: { rim: '#49d6ff' }, cape: true });
    // rain
    w.fillStyle = 'rgba(170,200,255,.45)';
    for (const d of this.rain) w.fillRect(Math.round(d.x), Math.round(d.y), 1, 4);
    u.clearRect(0, 0, VIEW_W, VIEW_H);
    // logo
    const bob = Math.round(Math.sin(this.t * 1.3) * 2);
    neon(u, '밤항구 슬램', 320, 34 + bob, '#ff5fa2', { scale: 4, align: 'c' });
    drawText(u, 'NIGHT  HARBOR  SLAM', 320, 96 + bob, { align: 'c', color: '#49d6ff', bold: true, outline: '#05060f' });
    drawText(u, '항구 도시 프로레슬링 커리어', 320, 112 + bob, { size: 11, align: 'c', color: '#c9d4ff', outline: '#05060f' });
    const it = this.items();
    panel(u, 236, 196, 168, it.length * 18 + 14, { alpha: .88, accent: '#ff5fa2' });
    menuList(u, it, this.sel, 250, 204, { w: 140, lh: 18 });
    drawText(u, '↑↓ 선택 · Enter 결정', 320, 348, { size: 11, align: 'c', color: UI.dim, outline: '#05060f' });
    drawText(u, 'v0.9 · 오리지널 게임', 634, 348, { size: 11, align: 'r', color: UI.faint });
  }
}

// ---- quick match / practice setup ----------------------------------------------------------------
const PLAY_IDS = ['rookie', ...ROSTER_IDS];
class QuickScene {
  constructor(game, kind) {
    this.game = game; this.kind = kind; this.t = 0; this.row = 0; this.man = new Mannequin();
    const last = game.settings.lastQuick || {};
    this.v = Object.assign({ mode: kind === 'practice' ? 'practice' : 'single', me: 'rookie', foe: 'taesan', mate: 'dohyun', foe2: 'bjorn', level: 'normal', arena: 'hall', count: 6 }, kind === 'practice' ? { mode: 'practice', me: last.me || 'rookie', foe: last.foe || 'taesan' } : last);
    if (kind === 'practice') this.v.mode = 'practice';
    game.audio.music('lobby');
  }
  rows() {
    const v = this.v, M = this.kind === 'practice' ? ['practice'] : ['single', 'pin', 'tag', 'royal', 'rumble', 'street'];
    const R = [{ k: 'mode', label: '경기 방식', list: M, show: x => MODES[x].name }, { k: 'me', label: '내 선수', list: PLAY_IDS, show: x => CHARACTERS[x].name }];
    if (v.mode === 'tag') R.push({ k: 'mate', label: '내 파트너', list: PLAY_IDS, show: x => CHARACTERS[x].name });
    if (v.mode !== 'royal' && v.mode !== 'rumble') R.push({ k: 'foe', label: '상대', list: PLAY_IDS, show: x => CHARACTERS[x].name });
    if (v.mode === 'tag') R.push({ k: 'foe2', label: '상대 파트너', list: PLAY_IDS, show: x => CHARACTERS[x].name });
    if (v.mode === 'royal' || v.mode === 'rumble') R.push({ k: 'count', label: '참가 인원', list: v.mode === 'royal' ? [3, 4, 5, 6] : [4, 6, 8, 10], show: x => x + '명' });
    if (this.kind !== 'practice') R.push({ k: 'level', label: 'AI 난이도', list: ['easy', 'normal', 'hard', 'expert'], show: x => DIFFICULTY[x].name });
    if (v.mode !== 'street') R.push({ k: 'arena', label: '경기장', list: ['hall', 'pier', 'dome', 'gym'], show: x => ARENAS[x].name });
    R.push({ k: 'start', label: this.kind === 'practice' ? '연습 시작' : '경기 시작' }, { k: 'back', label: '돌아가기' });
    return R;
  }
  update(dt) {
    this.t += dt;
    const inp = this.game.input, A = this.game.audio, R = this.rows();
    this.row = clamp(this.row, 0, R.length - 1);
    if (inp.pressed('up')) { this.row = (this.row + R.length - 1) % R.length; A.sfx('ui'); }
    if (inp.pressed('down')) { this.row = (this.row + 1) % R.length; A.sfx('ui'); }
    const r = R[this.row];
    if (r.list && (inp.pressed('left') || inp.pressed('right'))) { const d = inp.pressed('left') ? -1 : 1, i = r.list.indexOf(this.v[r.k]); this.v[r.k] = r.list[(i + d + r.list.length) % r.list.length]; A.sfx('ui', { pitch: 1.2 }); }
    if (inp.menuPressed('cancel')) { A.sfx('back'); this.game.toTitle(); return; }
    if (inp.menuPressed('confirm')) {
      if (r.k === 'start') { A.sfx('ok'); this.start(); }
      else if (r.k === 'back') { A.sfx('back'); this.game.toTitle(); }
      else if (r.list) { const i = r.list.indexOf(this.v[r.k]); this.v[r.k] = r.list[(i + 1) % r.list.length]; A.sfx('ui'); }
    }
  }
  start() {
    const v = this.v, lv = v.level, rng = new RNG(Date.now() & 0xffff);
    this.game.settings.lastQuick = Object.assign({}, v); this.game.saveSettings();
    const me = { char: v.me, ctrl: 'human' };
    let E;
    if (v.mode === 'tag') E = [me, { char: v.mate, ctrl: 'ai', difficulty: lv }, { char: v.foe, ctrl: 'ai', difficulty: lv }, { char: v.foe2, ctrl: 'ai', difficulty: lv }];
    else if (v.mode === 'royal' || v.mode === 'rumble') { const pool = rng.shuffle(PLAY_IDS.filter(x => x !== v.me)); E = [me, ...pool.slice(0, v.count - 1).map(c => ({ char: c, ctrl: 'ai', difficulty: lv }))]; if (v.mode === 'rumble') E = [E[0], ...rng.shuffle(E.slice(1))]; }
    else E = [me, { char: v.foe, ctrl: this.kind === 'practice' ? 'dummy' : 'ai', difficulty: this.kind === 'practice' ? 'normal' : lv }];
    const cfg = { mode: v.mode, arena: v.mode === 'street' ? 'alley' : v.arena, entrants: E, practice: this.kind === 'practice' ? { infinite: true, fullFin: false } : null, skipIntro: this.kind === 'practice' };
    this.game.playMatch(cfg, () => this.game.go(() => new QuickScene(this.game, this.kind)));
  }
  draw(w, u) {
    const v = this.v;
    bands(w, 0, 0, VIEW_W, VIEW_H, ['#0b0f22', '#0e1430', '#111a3a', '#141f44', '#17244c']);
    for (let i = 0; i < 16; i++) rect(w, 'rgba(73,214,255,.05)', 0, i * 24 + ((this.t * 12) % 24), VIEW_W, 1);
    // previews
    const me = CHARACTERS[v.me], foe = v.mode === 'royal' || v.mode === 'rumble' ? null : CHARACTERS[v.foe];
    cone(w, 420, 0, 20, 140, 330, '#ff5fa2', .1); cone(w, 560, 0, 20, 140, 330, '#49d6ff', .1);
    rect(w, '#1b2450', 340, 300, 300, 60);
    this.man.draw(w, me.look, me.stance, 430, 300, 1, this.t, { env: { rim: '#ff5fa2' } });
    if (foe) this.man.draw(w, foe.look, foe.stance, 560, 300, -1, this.t + 1, { env: { rim: '#49d6ff' } });
    u.clearRect(0, 0, VIEW_W, VIEW_H);
    drawText(u, this.kind === 'practice' ? '연습 모드' : '빠른 경기', 20, 14, { scale: 2, color: '#ffd65a', bold: true, outline: '#05060f' });
    drawText(u, MODES[v.mode].desc, 20, 46, { size: 11, color: UI.dim });
    const R = this.rows();
    panel(u, 14, 66, 300, R.length * 19 + 14, { alpha: .92 });
    R.forEach((r, i) => {
      const y = 74 + i * 19, on = i === this.row;
      if (on) rect(u, mixHex(UI.accent, UI.panel, .55), 18, y - 2, 292, 17);
      drawText(u, r.label, 26, y, { color: on ? '#ffffff' : UI.dim });
      if (r.list) drawText(u, '◀ ' + r.show(this.v[r.k]) + ' ▶', 302, y, { align: 'r', color: on ? '#ffd65a' : '#c9d4ff' });
    });
    // stat card for my pick
    this.card(u, me, 330, 16, '#ff5fa2');
    if (foe) this.card(u, foe, 486, 16, '#49d6ff');
    prompt(u, ['↑↓'], '항목', 20, 338, {}); prompt(u, ['←→'], '바꾸기', 90, 338, {}); prompt(u, ['Enter'], '결정', 170, 338, {}); prompt(u, ['Esc'], '뒤로', 250, 338, {});
  }
  card(u, c, x, y, col) {
    panel(u, x, y, 148, 124, { accent: col, alpha: .9 });
    drawText(u, c.name, x + 6, y + 4, { color: '#ffffff', bold: true });
    drawText(u, c.nick + ' · ' + STYLES[c.style].name, x + 6, y + 20, { size: 11, color: col });
    const keys = ['hp', 'stun', 'atk', 'grp', 'spd', 'jump'];
    keys.forEach((k, i) => { const info = STAT_INFO.find(s => s[0] === k); drawText(u, info[1], x + 6, y + 36 + i * 12, { size: 11, color: UI.dim }); gauge(u, x + 74, y + 40 + i * 12, 66, 4, clamp(statBar(c, k), .05, 1), 'fin', { col }); });
    drawText(u, '피니셔: ' + FINISHERS[c.finisher].name, x + 6, y + 108, { size: 11, color: '#ffd65a' });
  }
}
const titleDamp = damp;
const titleJN = JN;
const titleTW = textWidth;
const titleWin = windowPane;
const titleFade = fade;

return { Mannequin, TitleScene, QuickScene, titleDamp, titleJN, titleTW, titleWin, titleFade };
})();
// ---- render/ArenaRenderer.js
__m["render/ArenaRenderer.js"] = (function () {
// Arena drawing: baked background layers, a living crowd, the ring with elastic ropes, and a light pass.
const { VIEW_W, VIEW_H, RNG, clamp } = __m["core/util.js"];
const { rampHex, mixHex, shade } = __m["render/palette.js"];
const { drawText } = __m["render/pixelfont.js"];
const { canvas, rect, bands, dither, line, ellipse, poly, glow, cone, neon, truss, lamp, poster, brick, planks, windowPane, box } = __m["render/painter.js"];
const W = 900;
const SKIN = ['#f2c7a4', '#dca27a', '#b97a52', '#8a5a3e', '#5e3b2c'];
const HAIR = ['#1b1420', '#3a2630', '#5a3a2a', '#c9b07a', '#d26a3a', '#e8e4ee', '#3a3f6a', '#ff6fb0'];
const SHIRT = ['#d2456a', '#35a07a', '#2d63b8', '#ffd65a', '#ff8a2b', '#7c5ab8', '#e6e9f2', '#23263a', '#3fe0d0', '#c2333f', '#8fc94a', '#f2a6c8'];

// A strip of tiny spectators: v variants x 3 frames (sit, bob, arms up).
function crowdAtlas(seed) {
  const n = 36, cw = 12, ch = 18, [c, g] = canvas(n * cw, ch * 3), r = new RNG(seed);
  for (let i = 0; i < n; i++) {
    const sk = r.pick(SKIN), hr = r.pick(HAIR), sh = r.pick(SHIRT), hat = r.next() < .18, sign = r.next() < .12, R = rampHex(sh);
    for (let fr = 0; fr < 3; fr++) {
      const x = i * cw + 6, y = fr * ch + (fr === 1 ? 4 : 5);
      // body
      rect(g, '#0e0a18', x - 5, y + 7, 10, 12); rect(g, R[2], x - 4, y + 8, 8, 10); rect(g, R[3], x - 4, y + 8, 8, 1); rect(g, R[1], x - 4, y + 15, 8, 3);
      // arms
      if (fr === 2) { rect(g, '#0e0a18', x - 7, y - 3, 3, 11); rect(g, '#0e0a18', x + 4, y - 3, 3, 11); rect(g, R[2], x - 6, y - 2, 1, 9); rect(g, R[2], x + 5, y - 2, 1, 9); rect(g, sk, x - 7, y - 4, 2, 2); rect(g, sk, x + 5, y - 4, 2, 2); }
      // head
      ellipse(g, '#0e0a18', x, y + 3, 4, 4); ellipse(g, sk, x, y + 3, 3, 3); rect(g, shade(sk, -.25), x - 3, y + 5, 6, 1);
      rect(g, hr, x - 3, y - 1, 6, 2); rect(g, hr, x - 3, y, 1, 3);
      if (hat) { rect(g, r.pick(SHIRT), x - 4, y - 2, 8, 2); }
      if (fr === 2) { rect(g, '#0e0a18', x - 1, y + 4, 2, 2); }
      if (sign && fr === 2) { rect(g, '#0e0a18', x - 8, y - 9, 16, 7); rect(g, r.pick(['#fff6dc', '#ffd65a', '#ff8fc4']), x - 7, y - 8, 14, 5); rect(g, '#c2333f', x - 5, y - 7, 2, 3); rect(g, '#2d63b8', x - 1, y - 7, 5, 1); rect(g, '#2d63b8', x - 1, y - 5, 4, 1); }
    }
  }
  return { c, n, cw, ch };
}

class ArenaRenderer {
  constructor(arena, def) {
    this.ar = arena; this.def = def; this.t = 0; this.cheer = 0; this.flashes = []; this.screen = { text: '', sub: '', col: '#49d6ff', t: 0 };
    this.atlas = crowdAtlas(def.id.length * 31 + 5);
    this.rows = [];
    this.bake();
  }
  bake() {
    const id = this.def.id;
    const [far, gf] = canvas(820, VIEW_H), [near, gn] = canvas(W, VIEW_H);
    this.far = far; this.near = near;
    if (id === 'pier') this.bakePier(gf, gn); else if (id === 'gym') this.bakeGym(gf, gn); else if (id === 'alley') this.bakeAlley(gf, gn); else this.bakeHall(gf, gn, id === 'dome');
    if (this.ar.hasRing) this.bakeRing(gn);
    // crowd seats
    const r = new RNG(9), crowdK = this.def.crowd != null ? this.def.crowd : 1;
    const rows = id === 'pier' ? [[188, .78, 34, .5], [204, .86, 30, .62]] : id === 'gym' ? [] : id === 'alley' ? [[210, .9, 70, .25]] : [[128, .62, 18, .55], [148, .7, 17, .62], [168, .78, 16, .72], [190, .86, 15, .82], [212, .94, 14, .92]];
    for (const [y, par, step, light] of rows) for (let x = -20; x < W + 40; x += step * (1 + (1 - crowdK) * 2)) {
      if (r.next() < .12 * (2 - crowdK)) continue;
      this.rows.push({ x: x + r.next() * step * .6, y, par, light, v: (r.next() * this.atlas.n) | 0, ph: r.next() * 6.28, sp: .8 + r.next() * .6, fan: r.next() });
    }
  }
  bakeHall(g, n, dome) {
    const wallA = dome ? '#2a2246' : '#152036', wallB = dome ? '#3b2d5a' : '#1c2a44';
    bands(g, 0, 0, 820, 130, dome ? ['#0b0a1c', '#151330', '#1f1a40', '#29204c', '#33275a'] : ['#070b16', '#0b1220', '#0f182b', '#132037', '#172742']);
    // corrugated back wall
    for (let x = 0; x < 820; x += 4) { rect(g, x % 8 ? wallA : wallB, x, 40, 4, 90); }
    rect(g, '#0a0f1c', 0, 128, 820, 3);
    for (let x = 30; x < 820; x += 160) truss(g, x - 40, 24, 120, dome ? '#4a3d70' : '#28324f');
    truss(g, 0, 26, 820, dome ? '#4a3d70' : '#28324f');
    if (dome) { for (let i = 0; i < 9; i++) { const x = 40 + i * 92; rect(g, '#5a4a80', x, 0, 3, 40); ellipse(g, '#ffe9a8', x + 1, 40, 4, 2); } for (let x = 0; x < 820; x += 24) rect(g, '#463a6a', x, 0, 1, 24); }
    // banners
    const ban = [['안개왕', '#4a5078'], ['강태산', '#c25a20'], ['윤하늘', '#2a7fc4'], ['네온 제이', '#c2337a'], ['백파', '#5a6688'], ['비에른', '#8a6a3c']];
    ban.forEach(([name, col], i) => { const x = [20, 112, 286, 516, 690, 776][i], R = rampHex(col); rect(g, '#0a0716', x - 1, 44, 30, 66); bands(g, x, 45, 28, 60, [R[2], R[1], R[0]]); poly(g, R[1], [[x, 105], [x + 28, 105], [x + 14, 112]]); ellipse(g, R[0], x + 14, 66, 7, 8); rect(g, R[0], x + 6, 74, 16, 16); drawText(g, name.slice(0, 3), x + 14, 92, { size: 11, align: 'c', color: R[4] }); });
    // neon sign
    neon(g, dome ? '등대 돔' : '야항', 196, 64, dome ? '#ffd65a' : '#ff5fa2', { align: 'c', scale: 2 });
    neon(g, dome ? '챔피언십' : '레슬링', 626, 64, dome ? '#ffd65a' : '#49d6ff', { align: 'c', scale: 2 });
    drawText(g, 'NIGHT HARBOR WRESTLING', 410, 106, { size: 11, align: 'c', color: dome ? '#ffe9a8' : '#49d6ff' });
    // stands
    bands(g, 0, 118, 820, 116, ['#0c1222', '#0e1526', '#10182b', '#121b30', '#141e35']);
    for (let i = 0; i < 6; i++) rect(g, '#1b2540', 0, 140 + i * 21, 820, 2);
    // near: floor and barricade
    bands(n, 0, 226, W, 134, ['#121a2c', '#141d31', '#172136', '#19253b', '#1b2840', '#1d2a44']);
    for (let x = 0; x < W; x += 40) rect(n, '#152036', x, 240, 1, 120);
    for (let y = 252; y < VIEW_H; y += 22) rect(n, '#152036', 0, y, W, 1);
    // barricade with ads
    rect(n, '#06070e', 0, 224, W, 16);
    const ads = [['만선수산', '#1f8fa6'], ['돛대상회', '#c2333f'], ['항구의원', '#35a07a'], ['순덕포차', '#ffb347'], ['야항운수', '#7c5ab8'], ['등대우유', '#e6e9f2']];
    for (let x = 4, i = 0; x < W; x += 74, i++) { const [t, c] = ads[i % ads.length]; rect(n, c, x, 226, 70, 12); rect(n, shade(c, .3), x, 226, 70, 1); drawText(n, t, x + 35, 226, { size: 11, align: 'c', color: shade(c, -.7) }); }
    rect(n, '#3a4466', 0, 224, W, 1);
    // side barricades and ring steps
    for (const x of [this.ar.x0 - 6, this.ar.x1 + 2]) { rect(n, '#06070e', x, 240, 6, 90); rect(n, '#3a4466', x + 1, 244, 4, 2); rect(n, '#3a4466', x + 1, 270, 4, 2); rect(n, '#3a4466', x + 1, 296, 4, 2); }
  }
  bakePier(g, n) {
    bands(g, 0, 0, 820, 200, ['#0a0f2a', '#121a3e', '#1b2552', '#263066', '#352f6a', '#4a3570', '#5f3a72']);
    const r = new RNG(5);
    for (let i = 0; i < 80; i++) rect(g, r.next() < .3 ? '#ffffff' : '#9fb0ff', (r.next() * 820) | 0, (r.next() * 100) | 0, 1, 1);
    ellipse(g, '#fff3cf', 640, 46, 13, 13); ellipse(g, '#ffe39a', 644, 44, 11, 11); ellipse(g, '#2a2f60', 650, 40, 9, 9);
    // skyline
    for (let x = 0; x < 820; x += 8 + (r.next() * 12 | 0)) { const h = 30 + r.next() * 60, w = 10 + (r.next() * 14 | 0); rect(g, '#141836', x, 160 - h, w, h + 20); for (let k = 0; k < h / 5; k++) if (r.next() < .45) rect(g, r.pick(['#ffd27a', '#ff8fc4', '#7fe0ff']), x + 2 + (r.next() * (w - 4) | 0), 160 - h + 3 + k * 5, 1, 2); }
    neon(g, '야항', 120, 92, '#ff5fa2', { scale: 2 }); neon(g, '부두 특설 링', 560, 100, '#49d6ff', { scale: 1 });
    // cranes
    for (const cx of [300, 700]) { rect(g, '#22264a', cx, 60, 4, 120); rect(g, '#22264a', cx - 60, 60, 100, 4); line(g, '#22264a', cx, 64, cx - 50, 64); line(g, '#353a66', cx - 50, 64, cx - 50, 120); rect(g, '#ff5f5f', cx - 61, 58, 2, 2); }
    // sea
    bands(g, 0, 178, 820, 50, ['#1a2150', '#16204a', '#121a40', '#0f1636']);
    for (let i = 0; i < 40; i++) rect(g, r.pick(['#ff8fc4', '#7fe0ff', '#ffd27a']), (r.next() * 820) | 0, 182 + (r.next() * 40 | 0), 3 + (r.next() * 6 | 0), 1);
    // containers for the crowd
    for (let x = 0; x < 820; x += 70) box(g, x, 200, 66, 28, r.pick(['#c2333f', '#1f8fa6', '#d8a62e', '#35a07a']));
    // string lights
    for (let x = 0; x < 820; x += 6) { const y = 130 + Math.round(Math.sin(x * .025) * 6); rect(g, '#2a2440', x, y, 1, 1); if (x % 18 === 0) rect(g, r.pick(['#ffd27a', '#ff8fc4', '#7fe0ff']), x, y + 1, 2, 2); }
    // pier deck
    planks(n, 0, 228, W, 132, '#5a4636', { ph: 7 });
    rect(n, '#20182a', 0, 226, W, 3);
  }
  bakeGym(g, n) {
    brick(g, 0, 0, 820, 230, '#6a4a5a', { seed: 4 });
    for (let x = 60; x < 820; x += 180) windowPane(g, x, 30, 70, 60, { city: 1, seed: x });
    poster(g, 300, 110, 40, 54, '#c2333f', '훈련!', { figure: 1 }); poster(g, 520, 112, 40, 54, '#2d63b8', '집중', { figure: 1 });
    neon(g, '백 관장 체육관', 410, 8, '#ffcf8a', { scale: 1, align: 'c' });
    planks(n, 0, 226, W, 134, '#8a6a4a', { ph: 8 });
    rect(n, '#3a2a2a', 0, 224, W, 3);
  }
  bakeAlley(g, n) {
    bands(g, 0, 0, 820, 60, ['#090d1c', '#0e1428', '#121a33']);
    brick(g, 0, 40, 820, 190, '#3a2c44', { seed: 8 });
    for (let x = 30; x < 820; x += 200) { windowPane(g, x, 60, 34, 40, { sky: ['#ffd27a', '#ffb347', '#d27a3a'], bars: true }); }
    neon(g, '노래방', 160, 110, '#ff5fa2', { scale: 1 }); neon(g, '24시 국밥', 520, 96, '#49d6ff', { scale: 1 }); neon(g, '당구', 700, 130, '#8fe36b', { scale: 1 });
    for (const x of [90, 420, 760]) { box(n, x, 196, 44, 30, '#2f5a46', { tape: 0 }); rect(n, '#1d3a2c', x - 2, 194, 48, 4); }
    bands(n, 0, 226, W, 134, ['#1a1f30', '#1c2234', '#1e2438', '#20263c']);
    const r = new RNG(3);
    for (let i = 0; i < 12; i++) ellipse(n, 'rgba(90,120,200,.18)', r.next() * W, 280 + r.next() * 60, 14 + r.next() * 20, 2);
  }
  bakeRing(g) {
    const a = this.ar, L = a.ropeL, R = a.ropeR, my = a.matY, back = my - 22, front = my + 16;
    const dome = this.def.id === 'dome', pier = this.def.id === 'pier', gym = this.def.id === 'gym';
    const matCol = dome ? '#2a3f8c' : gym ? '#7a2f3a' : pier ? '#2a5f86' : '#1f6f7a', M = rampHex(matCol);
    // shadow under the ring
    ellipse(g, 'rgba(0,0,0,.35)', (L + R) / 2, front + 40, (R - L) / 2 + 40, 8);
    // apron face
    const skirt = dome ? '#14143a' : '#0e1224';
    rect(g, '#06070e', L - a.apron - 1, front, R - L + a.apron * 2 + 2, a.floorY - front + 2);
    bands(g, L - a.apron, front + 1, R - L + a.apron * 2, a.floorY - front - 1, [skirt, shade(skirt, .08), skirt, shade(skirt, -.2)]);
    rect(g, dome ? '#ffd65a' : '#ff5fa2', L - a.apron, front + 4, R - L + a.apron * 2, 2);
    rect(g, dome ? '#e0a32e' : '#49d6ff', L - a.apron, a.floorY - 6, R - L + a.apron * 2, 1);
    const title = dome ? '등대 돔 · 챔피언십' : gym ? '백 관장 체육관' : '야항 레슬링 연맹';
    drawText(g, title, (L + R) / 2, front + 12, { scale: 2, align: 'c', color: dome ? '#ffe9a8' : '#eef2ff', bold: true, outline: '#06070e' });
    for (const x of [L + 30, R - 30]) { ellipse(g, dome ? '#e0a32e' : '#49d6ff', x, front + 21, 7, 7); ellipse(g, skirt, x, front + 21, 4, 4); }
    // mat surface (trapezoid)
    const top = [[L + 14, back], [R - 14, back], [R + a.apron, front], [L - a.apron, front]];
    poly(g, M[0], [[top[0][0] - 1, back - 1], [top[1][0] + 1, back - 1], [top[2][0] + 1, front + 1], [top[3][0] - 1, front + 1]]);
    for (let y = back; y < front; y++) { const k = (y - back) / (front - back), x0 = L + 14 + (L - a.apron - L - 14) * k, x1 = R - 14 + (R + a.apron - R + 14) * k; rect(g, k < .2 ? M[1] : k < .75 ? M[2] : M[3], x0, y, x1 - x0, 1); }
    // canvas seams and logo
    for (const k of [.33, .66]) { const y = Math.round(back + (front - back) * k); rect(g, M[1], L, y, R - L, 1); }
    const cx = (L + R) / 2, cy = my - 3;
    ellipse(g, M[1], cx, cy, 34, 9); ellipse(g, M[3], cx, cy, 30, 7);
    drawText(g, dome ? 'CHAMPION' : 'N H W', cx, cy - 6, { size: 11, align: 'c', color: M[1] });
    // apron edge
    rect(g, M[4], L - a.apron, front - 1, R - L + a.apron * 2, 1);
    // back posts
    this.post(g, L + 14, back, dome); this.post(g, R - 14, back, dome);
    // steps
    for (const sx of [L - 40, R + 26]) { for (let i = 0; i < 3; i++) { rect(g, '#06070e', sx, a.floorY - 10 - i * 10, 14, 11); rect(g, '#2c3456', sx + 1, a.floorY - 9 - i * 10, 12, 9); rect(g, '#4a557e', sx + 1, a.floorY - 9 - i * 10, 12, 1); } }
  }
  post(g, x, base, gold) {
    const c = gold ? '#e0a32e' : '#b9c2dc', R = rampHex(c);
    rect(g, '#06070e', x - 3, base - 62, 7, 63); rect(g, R[2], x - 2, base - 61, 5, 61); rect(g, R[4], x - 1, base - 61, 1, 61); rect(g, R[1], x + 2, base - 61, 1, 61);
    rect(g, '#06070e', x - 3, base - 64, 7, 3); rect(g, R[3], x - 2, base - 64, 5, 2);
  }
  // ---- per frame ----
  update(dt, hype) {
    this.t += dt;
    this.cheer = Math.max(this.cheer - dt * .6, hype / 100 * .75);
    for (const f of this.flashes) f.t -= dt;
    this.flashes = this.flashes.filter(f => f.t > 0);
    if (Math.random() < dt * (2 + this.cheer * 14)) this.flashes.push({ x: Math.random() * W, y: 120 + Math.random() * 100, t: .08 });
    this.screen.t += dt;
  }
  boost(k) { this.cheer = Math.min(1, this.cheer + k); }
  drawBack(g, camX) {
    const a = this.ar;
    g.drawImage(this.far, Math.round(-camX * .6), 0);
    this.drawScreen(g, camX);
    // crowd
    const A = this.atlas, ch = this.cheer;
    for (const p of this.rows) {
      const sx = Math.round(p.x - camX * p.par);
      if (sx < -14 || sx > VIEW_W + 14) continue;
      const bob = Math.sin(this.t * (3 + ch * 6) * p.sp + p.ph);
      const up = ch > .45 && bob > .55 - ch * .5 ? 2 : (ch > .15 && bob > .4) ? 1 : 0;
      g.drawImage(A.c, p.v * A.cw, up * A.ch, A.cw, A.ch, sx - 6, p.y - (up ? Math.round(bob * 2 * ch) : 0), A.cw, A.ch);
    }
    // darker back rows
    if (this.rows.length) { g.fillStyle = 'rgba(6,8,20,.35)'; g.fillRect(0, 110, VIEW_W, 40); g.fillStyle = 'rgba(6,8,20,.18)'; g.fillRect(0, 150, VIEW_W, 30); }
    for (const f of this.flashes) { const sx = f.x - camX * .8; rect(g, '#ffffff', sx, f.y, 2, 2); glow(g, sx + 1, f.y + 1, 9, '#ffffff', .5); }
    g.drawImage(this.near, Math.round(-camX), 0);
    if (a.hasRing) { this.backRopes(g, camX); this.sideRopes(g, camX, false); }
  }
  ropeColors() { return this.def.id === 'dome' ? ['#ffd65a', '#f6f1e6', '#e0a32e'] : this.def.id === 'gym' ? ['#e6e9f2', '#c2333f', '#e6e9f2'] : ['#ff5fa2', '#f6f1e6', '#49d6ff']; }
  backRopes(g, camX) {
    const a = this.ar, L = a.ropeL + 14 - camX, R = a.ropeR - 14 - camX, back = a.matY - 22, cols = this.ropeColors();
    const wob = a.shake * 2;
    for (let i = 0; i < 3; i++) {
      const h = [18, 34, 50][i], y = back - h, c = cols[2 - i];
      for (let x = Math.floor(L); x < R; x += 2) { const k = (x - L) / (R - L), sag = Math.sin(k * Math.PI) * (2 + wob * Math.sin(this.t * 30 + i)); rect(g, shade(c, -.25), x, y + sag, 2, 1); rect(g, shade(c, -.55), x, y + sag + 1, 2, 1); }
      for (const px of [L, R]) { rect(g, '#06070e', px - 3, y - 2, 7, 5); rect(g, this.def.id === 'dome' ? '#c2333f' : '#3a59b8', px - 2, y - 1, 5, 3); }
    }
  }
  // Side ropes run from a front post to a back post; the half nearer the viewer is drawn over the wrestlers.
  sideRopes(g, camX, front) {
    const a = this.ar, cols = this.ropeColors(), my = a.matY, back = my - 22, fr = my + 16;
    for (const side of ['L', 'R']) {
      const d = a.ropes[side].d, dir = side === 'L' ? -1 : 1;
      const xb = (side === 'L' ? a.ropeL + 14 : a.ropeR - 14) - camX, xf = (side === 'L' ? a.ropeL - 10 : a.ropeR + 10) - camX;
      for (let i = 0; i < 3; i++) {
        const h = [18, 34, 50][i], c = cols[2 - i];
        const yb = back - h, yf = fr - h - 2, mx = (xb + xf) / 2 + dir * d * (1 - i * .12), myy = (yb + yf) / 2 + Math.abs(d) * .15;
        if (!front) { line(g, shade(c, -.5), xb, yb + 1, mx, myy + 1, 1); line(g, c, xb, yb, mx, myy, 1); }
        else { line(g, shade(c, -.5), mx, myy + 1, xf, yf + 1, 2); line(g, c, mx, myy, xf, yf, 2); rect(g, mixHex(c, '#ffffff', .4), (mx + xf) / 2, (myy + yf) / 2 - 1, 2, 1); }
      }
      if (front) {
        this.post(g, xf, fr + 2, this.def.id === 'dome');
        for (let i = 0; i < 3; i++) { const y = fr - [18, 34, 50][i] - 2; rect(g, '#06070e', xf - 4, y - 3, 9, 7); rect(g, this.def.id === 'dome' ? '#c2333f' : '#3a59b8', xf - 3, y - 2, 7, 5); rect(g, '#8aa4ff', xf - 3, y - 2, 7, 1); }
      }
    }
  }
  drawFront(g, camX) { if (this.ar.hasRing) this.sideRopes(g, camX, true); }
  drawScreen(g, camX) {
    if (this.def.id === 'gym' || this.def.id === 'alley' || this.def.id === 'pier') return;
    const x = Math.round(410 - camX * .6) - 78, y = 58, w = 156, h = 40;
    rect(g, '#1a1d33', x + 30, 0, 2, y); rect(g, '#1a1d33', x + w - 32, 0, 2, y);
    rect(g, '#06070e', x - 3, y - 3, w + 6, h + 6); rect(g, '#2a3150', x - 2, y - 2, w + 4, h + 4); rect(g, '#05060c', x, y, w, h);
    const s = this.screen;
    if (s.text) {
      const blink = s.blink && Math.floor(s.t * 4) % 2;
      drawText(g, s.text, x + w / 2, y + 5, { align: 'c', color: blink ? '#ffffff' : s.col, bold: true });
      if (s.sub) drawText(g, s.sub, x + w / 2, y + 24, { size: 11, align: 'c', color: '#c9d4ff' });
    }
    for (let yy = 0; yy < h; yy += 2) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, y + yy, w, 1); }
  }
  setScreen(text, sub = '', col = '#49d6ff', blink = false) { this.screen = { text, sub, col, t: 0, blink }; }
  // Light pass after the bodies.
  drawLights(g, camX, focus) {
    const id = this.def.id;
    if (id === 'hall' || id === 'dome') {
      const cx = (this.ar.ropeL + this.ar.ropeR) / 2 - camX;
      cone(g, cx - 140, 30, 18, 160, 250, id === 'dome' ? '#ffe39a' : '#ffcf8a', .08);
      cone(g, cx + 140, 30, 18, 160, 250, id === 'dome' ? '#ffe39a' : '#a8d8ff', .08);
      if (focus != null) cone(g, focus - camX, 20, 14, 120, 260, '#ffffff', .05 + this.cheer * .05);
      for (let i = 0; i < 6; i++) glow(g, 60 + i * 150 - camX * .6, 34, 26, id === 'dome' ? '#ffe9a8' : '#ffcf7a', .25);
    } else if (id === 'pier') {
      glow(g, 640 - camX * .6, 46, 60, '#fff0c0', .15);
      for (let x = 0; x < 900; x += 54) glow(g, x - camX * .6, 134, 12, '#ff8fc4', .2);
    } else if (id === 'alley') {
      glow(g, 180 - camX * .6, 116, 50, '#ff5fa2', .22); glow(g, 540 - camX * .6, 102, 50, '#49d6ff', .2);
    } else glow(g, 410 - camX * .6, 20, 120, '#ffe0b0', .12);
  }
}
const clampCam = (x, w = W) => clamp(x - VIEW_W / 2, 0, w - VIEW_W);

return { ArenaRenderer, clampCam };
})();
// ---- render/FighterRenderer.js
__m["render/FighterRenderer.js"] = (function () {
// Draws wrestlers (and the referee) in depth order, keeping grapple layering, flashes, shadows and after-images.
const { Joints, JN, J, dimsFor, solveFK, toWorld, pose } = __m["anim/skeleton.js"];
const { clip, sampleClip, stancePose, gaitPose } = __m["anim/clips.js"];
const { BodyCanvas } = __m["render/raster.js"];
const { drawBody } = __m["render/body.js"];
const { packHex } = __m["render/palette.js"];
const { LOOKS } = __m["data/looks.js"];
const { makeCanvas, ctxOf, TAU } = __m["core/util.js"];
const { ellipse, rect, poly } = __m["render/painter.js"];
const tmp = new Joints();
const WHITE = packHex('#ffffff');
const P = new Float32Array(16);
class FighterRenderer {
  constructor() {
    this.bc = new BodyCanvas(); this.trails = []; this.pool = []; this.frame = 0;
    for (let i = 0; i < 18; i++) { const c = makeCanvas(this.bc.w, this.bc.h); this.pool.push({ c, g: ctxOf(c), used: false }); }
    this.refLook = LOOKS.referee; this.refDims = dimsFor(this.refLook.build, this.refLook.scale); this.refJ = new Joints();
  }
  setEnv(env) { this.bc.setLight(env); }
  shift(j, camX) { tmp.copy(j); for (let i = 0; i < JN; i++) tmp.p[i * 2] -= camX; return tmp; }
  body(g, f, camX, layer, extra = {}) {
    const bc = this.bc, jt = this.shift(f.joints, camX);
    if (f.hitShake > 0) { const s = (this.frame & 1 ? 1 : -1) * Math.ceil(f.hitShake * 8); for (let i = 0; i < JN; i++) tmp.p[i * 2] += s; }
    bc.begin(jt.x(0), jt.y(0) - 4);
    const tails = f.tails ? f.tails.map(T => ({ pts: Array.from(T.pts, (v, i) => (i % 2 ? v : v - camX)), w: T.w, c: T.c, front: T.front })) : null;
    drawBody(bc, jt, f.dims, f.look, { expr: f.faceExpr || 'neutral', layer, hand: f.handOpen ? 'open' : 'fist', tails, cape: f.st === 'INTRO' || f.st === 'WIN', sway: Math.sin((f.poseT || 0) * 2) * 2 });
    bc.finish({ flat: f.flash > .05 ? WHITE : extra.flat });
    const blink = f.inv > 0 && f.protect > 0 && (this.frame >> 2) & 1;
    bc.drawTo(g, 0, 0, extra.alpha != null ? extra.alpha : blink ? .55 : 1);
    return bc;
  }
  shadow(g, f, camX, ground) {
    const x = f.joints.x(0) - camX, h = Math.max(0, ground - f.joints.y(0) - f.dims.leg * .8), k = Math.max(.35, 1 - h / 140);
    const w = Math.round((f.dims.prof[4][2] + 8) * k * (f.st === 'DOWN' || f.st === 'KO' || f.hsKind === 'lie' ? 2.2 : 1.1));
    g.globalAlpha = .38 * k; ellipse(g, '#04030a', Math.round(x), Math.round(ground + 1), w, 3); g.globalAlpha = 1;
  }
  // Grab the current body pixels as a fading after-image.
  trail(f, col, life = .22) {
    const slot = this.pool.find(s => !s.used);
    if (!slot) return;
    const bc = this.bc;
    slot.used = true; slot.g.clearRect(0, 0, slot.c.width, slot.c.height);
    slot.g.drawImage(bc.canvas, bc.bx, bc.by, bc.bw, bc.bh, 0, 0, bc.bw, bc.bh);
    slot.g.globalCompositeOperation = 'source-atop'; slot.g.fillStyle = col; slot.g.globalAlpha = .75; slot.g.fillRect(0, 0, bc.bw, bc.bh); slot.g.globalAlpha = 1; slot.g.globalCompositeOperation = 'source-over';
    this.trails.push({ slot, x: bc.ox + bc.bx, y: bc.oy + bc.by, w: bc.bw, h: bc.bh, t: 0, life, camX: this.camX });
  }
  drawAll(g, m, camX, opts = {}) {
    this.frame++; this.camX = camX;
    const ar = m.arena;
    // after-images behind everything
    for (const t of this.trails) { t.t += opts.dt || 0; g.globalAlpha = Math.max(0, .5 * (1 - t.t / t.life)); g.drawImage(t.slot.c, 0, 0, t.w, t.h, Math.round(t.x - (camX - t.camX)), t.y, t.w, t.h); }
    g.globalAlpha = 1;
    for (const t of this.trails) if (t.t >= t.life) t.slot.used = false;
    this.trails = this.trails.filter(t => t.t < t.life);
    // shadows
    for (const f of m.fighters) if (!f.gone && !f.hidden) this.shadow(g, f, camX, ar.ground(f.joints.x(0), f.y, f.side) + (f.side === 'in' ? f.lane : 0));
    if (ar.hasRing && m.ref) this.refShadow(g, m, camX);
    // depth order: back row first. Linked pairs are drawn together.
    const items = [];
    const seen = new Set();
    for (const L of m.links) { if (L.a.gone) continue; items.push({ z: L.a.y + L.a.lane + .5, pair: L }); seen.add(L.a); if (L.v) seen.add(L.v); }
    if (m.pin) { items.push({ z: m.pin.a.y + .4, pin: m.pin }); seen.add(m.pin.a); seen.add(m.pin.v); }
    for (const f of m.fighters) if (!seen.has(f) && !f.gone) items.push({ z: f.y + (f.side === 'in' ? f.lane : 6) + (f.st === 'DOWN' || f.st === 'KO' ? -1 : 0) + (f.ctrl === 'human' ? .2 : 0), f });
    if (ar.hasRing && m.ref && m.ref.visible !== false) items.push({ z: ar.matY - 6, ref: 1 });
    items.sort((a, b) => a.z - b.z);
    for (const it of items) {
      if (it.ref) { this.drawRef(g, m, camX); continue; }
      if (it.pin) { this.body(g, it.pin.v, camX, 'all'); this.body(g, it.pin.a, camX, 'all'); continue; }
      if (it.pair) {
        const L = it.pair, a = L.a, v = L.v;
        if (!v) { this.body(g, a, camX, 'all'); this.fxFor(a, opts); continue; }
        if (L.front || (L.kind === 'move' && L.move.vf > 0 && !L.front)) {
          if (L.front) { if (!a.hidden) this.body(g, a, camX, 'all'); this.body(g, v, camX, 'all'); }
          else { this.body(g, v, camX, 'all'); if (!a.hidden) this.body(g, a, camX, 'all'); }
        } else {
          if (!a.hidden) this.body(g, a, camX, 'back');
          this.body(g, v, camX, 'all');
          if (!a.hidden) this.body(g, a, camX, 'front');
        }
        this.fxFor(a, opts);
        continue;
      }
      const f = it.f;
      if (f.hidden) continue;
      this.body(g, f, camX, 'all');
      this.fxFor(f, opts);
      this.overlays(g, f, camX, m);
    }
  }
  fxFor(f, opts) {
    const want = (f.st === 'ATTACK' && f.atk && f.atk.def.run) || f.st === 'DODGE' || (f.st === 'FINISHER') || (f.link && f.link.fin) || f.boost > 0 || (f.st === 'AIR_ATTACK' && f.atk && f.atk.def.dive);
    if (want && (this.frame % 3 === 0) && opts.trails !== false) this.trail(f, f.link && f.link.fin ? (f.finisher ? f.finisher.color : '#ffffff') : f.char.color || '#49d6ff', f.st === 'DODGE' ? .18 : .26);
  }
  overlays(g, f, camX, m) {
    // dizzy stars
    if ((f.st === 'STAGGER' || (f.st === 'DOWN' && !f.postMove && !f.rag)) && f.alive) {
      const hx = f.joints.x(J.head) - camX, hy = f.joints.y(J.head) - 14, t = m.time * 5;
      for (let i = 0; i < 3; i++) { const a = t + i * TAU / 3, x = Math.round(hx + Math.cos(a) * 9), y = Math.round(hy + Math.sin(a) * 3); poly(g, i === 1 ? '#7fe0ff' : '#ffd65a', [[x, y - 3], [x + 1, y - 1], [x + 3, y], [x + 1, y + 1], [x, y + 3], [x - 1, y + 1], [x - 3, y], [x - 1, y - 1]]); }
    }
    if (f.sweatT > 0 || f.exhausted && (this.frame % 40 === 0)) { const hx = f.joints.x(J.head) - camX, hy = f.joints.y(J.head); rect(g, '#bfefff', hx + f.face * 6, hy - 6 + (this.frame % 40) / 4, 1, 2); }
  }
  refShadow(g, m, camX) { g.globalAlpha = .3; ellipse(g, '#04030a', Math.round(m.ref.x - camX), m.arena.matY + 1 - 8, 12, 2); g.globalAlpha = 1; }
  drawRef(g, m, camX) {
    const r = m.ref, d = this.refDims, j = this.refJ;
    let p;
    if (r.act === 'count' && m.pin) { const k = (m.pin.t % .92) / .92; p = sampleClip(clip('refSlap'), k * .6, P); }
    else if (r.act === 'raise' && r.raise) p = sampleClip(clip('refRaise'), 0, P);
    else if (Math.abs(r.vx) > 5) { stancePose('npcA', m.time, P); p = gaitPose(P, r.gait * 6, 'walk', 1); }
    else p = sampleClip(clip('ref1'), m.time, P);
    solveFK(p, d, j, {});
    toWorld(j, r.face, r.x, m.arena.matY - 8);
    const bc = this.bc;
    for (let i = 0; i < JN; i++) j.p[i * 2] -= camX;
    bc.begin(j.x(0), j.y(0) - 4);
    drawBody(bc, j, d, this.refLook, { expr: r.act === 'count' ? 'shout' : 'neutral', hand: 'open' });
    bc.finish();
    bc.drawTo(g);
    void pose;
  }
}

return { FighterRenderer };
})();
// ---- render/Fx.js
__m["render/Fx.js"] = (function () {
// Particles and cartoon effects in world space: sparks, dust, shock rings, sweat, comic words, confetti.
const { RNG, clamp, makeCanvas, ctxOf, TAU } = __m["core/util.js"];
const { drawText, textWidth } = __m["render/pixelfont.js"];
const { mixHex } = __m["render/palette.js"];
const { rect, ellipse, line, glow } = __m["render/painter.js"];
class Fx {
  constructor() { this.p = []; this.words = []; this.rings = []; this.rng = new RNG(77); this.screenLines = 0; this.lineCol = '#ffffff'; this.time = 0; this.ink = 0; this.dark = 0; this.wordCache = new Map(); }
  clear() { this.p.length = 0; this.words.length = 0; this.rings.length = 0; this.screenLines = 0; this.ink = 0; this.dark = 0; }
  spark(x, y, power = 1, col = '#fff3b0', dir = 0) {
    const r = this.rng, n = 5 + power * 5;
    for (let i = 0; i < n; i++) { const a = (dir ? (dir > 0 ? 0 : Math.PI) : 0) + (r.next() - .5) * (dir ? 2.4 : TAU), s = 90 + r.next() * 200 * power; this.p.push({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, t: 0, life: .16 + r.next() * .14, col: r.next() < .3 ? '#ffffff' : col, g: 300 }); }
    this.p.push({ k: 'flash', x, y, t: 0, life: .07 + power * .02, r: 4 + power * 3.5, col });
    this.p.push({ k: 'star', x, y, t: 0, life: .14 + power * .03, r: 10 + power * 7, col, rot: r.next() * TAU });
  }
  dust(x, y, power = 1, col = '#c9d2e6') {
    const r = this.rng, n = 3 + power * 4;
    for (let i = 0; i < n; i++) { const s = (40 + r.next() * 90) * power * (r.next() < .5 ? -1 : 1); this.p.push({ k: 'dust', x: x + (r.next() - .5) * 16, y: y - 2, vx: s, vy: -10 - r.next() * 40 * power, t: 0, life: .35 + r.next() * .35, r: 3 + r.next() * 4 * power, col, g: 30 }); }
  }
  ring(x, y, r, col = '#ffffff', life = .4) { this.rings.push({ x, y, r, col, t: 0, life }); }
  sweat(x, y, n = 4) { const r = this.rng; for (let i = 0; i < n; i++) this.p.push({ k: 'drop', x, y, vx: (r.next() - .5) * 160, vy: -80 - r.next() * 120, t: 0, life: .5, col: '#bfefff', g: 600 }); }
  confetti(x, y, n = 60) { const r = this.rng, C = ['#ff5fa2', '#49d6ff', '#ffd65a', '#6be38a', '#ffffff', '#c86bff']; for (let i = 0; i < n; i++) this.p.push({ k: 'conf', x: x + (r.next() - .5) * 300, y: y - r.next() * 80, vx: (r.next() - .5) * 60, vy: 20 + r.next() * 60, t: 0, life: 2.5 + r.next(), col: r.pick(C), g: 40, ph: r.next() * 6 }); }
  smoke(x, y, col = '#2a1a3c', n = 14) { const r = this.rng; for (let i = 0; i < n; i++) this.p.push({ k: 'dust', x: x + (r.next() - .5) * 30, y: y - r.next() * 40, vx: (r.next() - .5) * 120, vy: -20 - r.next() * 40, t: 0, life: .8 + r.next() * .6, r: 6 + r.next() * 8, col, g: -10 }); }
  weld(x, y) { const r = this.rng; for (let i = 0; i < 16; i++) { const a = r.next() * TAU, s = 120 + r.next() * 260; this.p.push({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, t: 0, life: .3 + r.next() * .3, col: r.pick(['#39e6c0', '#ffffff', '#ffe27a']), g: 500 }); } }
  splash(x, y) { const r = this.rng; for (let i = 0; i < 18; i++) this.p.push({ k: 'drop', x: x + (r.next() - .5) * 20, y, vx: (r.next() - .5) * 220, vy: -120 - r.next() * 200, t: 0, life: .7, col: r.next() < .5 ? '#9fe0ff' : '#ffffff', g: 700 }); }
  trailDot(x, y, col) { this.p.push({ k: 'dot', x, y, vx: 0, vy: 0, t: 0, life: .3, col, g: 0 }); }
  // Comic onomatopoeia with a pop.
  word(text, x, y, col = '#ffffff', size = 2, rot = 0) { this.words.push({ text, x, y, col, size, t: 0, life: .7 + size * .1, rot: rot || (this.rng.next() - .5) * .5, vy: -26 }); }
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

return { Fx };
})();
// ---- render/HUD.js
__m["render/HUD.js"] = (function () {
// Match HUD: portraits, HP / STUN / finisher gauges, timer, rule, downs, grab marks, grapple menu, prompts, banners.
const { clamp, clamp01, fmtTime, sgn } = __m["core/util.js"];
const { UI, mixHex, shade } = __m["render/palette.js"];
const { drawText, textWidth } = __m["render/pixelfont.js"];
const { drawPortrait } = __m["render/head.js"];
const { rect, ellipse } = __m["render/painter.js"];
const { panel, gauge, icon, keycap, prompt, banner } = __m["render/ui.js"];
const { BALANCE: B } = __m["data/balance.js"];
const { MOVES } = __m["data/moves.js"];
const { MODES } = __m["combat/MatchManager.js"];
const { J } = __m["anim/skeleton.js"];
const SLOT_NAMES = { n: '', f: '→', b: '←', u: '↑', d: '↓' };
class HUD {
  constructor(input) { this.input = input; this.trail = new Map(); this.banners = []; this.t = 0; this.toastList = []; this.card = null; }
  push(text, o = {}) { this.banners.push(Object.assign({ text, t: 0, life: o.life || 1.2, col: o.col || '#ffd65a', scale: o.scale || 3, y: o.y || 120 }, o)); if (this.banners.length > 3) this.banners.shift(); }
  toast(text, col = '#eef2ff') { this.toastList.push({ text, col, t: 0 }); if (this.toastList.length > 4) this.toastList.shift(); }
  finisherCard(f, F) { this.card = { f, F, t: 0 }; }
  update(dt, m) {
    this.t += dt;
    for (const b of this.banners) b.t += dt;
    this.banners = this.banners.filter(b => b.t < b.life);
    for (const t of this.toastList) t.t += dt;
    this.toastList = this.toastList.filter(t => t.t < 2.6);
    if (this.card) { this.card.t += dt; if (this.card.t > 1.6) this.card = null; }
    for (const f of m.fighters) { const tr = this.trail.get(f) || { hp: f.hp, wait: 0 }; if (f.hp < tr.hp) { tr.wait -= dt; if (tr.wait <= 0) tr.hp = Math.max(f.hp, tr.hp - f.maxHp * dt * .6); } else { tr.hp = f.hp; tr.wait = .45; } if (f.hp < tr.last) tr.wait = .45; tr.last = f.hp; this.trail.set(f, tr); }
  }
  draw(g, m, camX, o = {}) {
    if (o.hide) return;
    const two = m.fighters.length === 2 || (m.mode === 'tag' && m.fighters.length === 4);
    if (m.mode === 'tag') this.tagPanels(g, m);
    else if (two) { this.bigPanel(g, m.fighters[0], 6, false, m); this.bigPanel(g, m.fighters[1], 634, true, m); }
    else this.smallPanels(g, m);
    this.center(g, m);
    this.worldMarks(g, m, camX);
    this.human(g, m, camX);
    this.drawBanners(g);
    this.drawCard(g);
    this.toasts(g);
  }
  portrait(g, f, x, y, s, flip) {
    rect(g, '#05060f', x - 1, y - 1, s + 2, s + 2);
    rect(g, mixHex(f.char.color || '#49d6ff', '#0b0f22', .7), x, y, s, s);
    rect(g, mixHex(f.char.color || '#49d6ff', '#0b0f22', .5), x, y + s - 8, s, 8);
    drawPortrait(g, f.look, f.st === 'KO' ? 'ko' : f.hp < f.maxHp * .25 ? 'hurt' : f.st === 'WIN' ? 'happy' : 'neutral', x, y, s, { px: 1, flip, dy: 3 });
    rect(g, f.char.color || '#49d6ff', x, y, s, 1); rect(g, f.char.color || '#49d6ff', x, y + s - 1, s, 1);
  }
  bigPanel(g, f, X, right, m) {
    const w = 236, x = right ? X - w : X, y = 5;
    panel(g, x, y, w, 46, { accent: f.char.color, bg: '#0f1430', alpha: .94 });
    const px = right ? x + w - 37 : x + 5;
    this.portrait(g, f, px, y + 5, 32, right);
    const bx = right ? x + 8 : x + 44, bw = 182;
    const nm = f.name + (f.ctrl === 'human' ? '' : '');
    drawText(g, nm, right ? bx + bw : bx, y + 3, { size: 11, align: right ? 'r' : 'l', color: '#ffffff', outline: '#05060f' });
    // downs as pips
    for (let i = 0; i < Math.min(5, f.downs); i++) { const dx = right ? bx + 4 + i * 8 : bx + bw - 4 - i * 8; icon(g, 'star', dx - 3, y + 5, '#ffb347'); }
    const tr = this.trail.get(f);
    gauge(g, bx, y + 17, bw, 8, f.hp / f.maxHp, 'hp', { trail: tr ? tr.hp / f.maxHp : null, flip: right, icon: 'heart', blink: true, time: this.t });
    gauge(g, bx, y + 29, bw * .78 | 0, 4, Math.max(0, f.stun) / f.maxStun, 'stun', { flip: right, icon: 'stun', blink: true, blinkBelow: .3, time: this.t });
    const fw = 78, fx = right ? x + w - fw - 3 : x + 3;
    gauge(g, right ? fx : fx + 10, y + 50, fw, 5, f.fin / B.finMax, 'fin', { flip: right, icon: 'bolt', full: true, time: this.t });
    if (f.fin >= B.finMax) drawText(g, '피니셔!', right ? fx - 6 : fx + fw + 16, y + 47, { size: 11, align: right ? 'r' : 'l', color: Math.floor(this.t * 6) % 2 ? '#3fe0d0' : '#ffffff', outline: '#05060f' });
    const st = this.chip(f, m);
    if (st) drawText(g, st[0], right ? x + 4 : x + w - 4, y + 35, { size: 11, align: right ? 'l' : 'r', color: st[1], outline: '#05060f' });
  }
  chip(f, m) {
    if (f.st === 'KO') return ['K.O.', '#ff5b5b'];
    if (f.eliminated) return ['탈락', '#ff5b5b'];
    if (f.st === 'DOWN') return ['다운', '#ffb347'];
    if (f.st === 'STAGGER') return ['비틀', '#ffd65a'];
    if (f.st === 'GRABBED') return ['잡힘', '#ff8fc4'];
    if (f.side === 'out' && m.rules.ringOut === 'count' && f.outCount > .5) return ['링 밖 ' + Math.floor(f.outCount), '#ff8a2b'];
    if (f.st === 'TAGWAIT') return ['대기', UI.dim];
    return null;
  }
  smallPanels(g, m) {
    const list = m.fighters.filter(f => !f.gone);
    const n = list.length, w = Math.min(126, Math.floor((628 - 4 * (n - 1)) / n));
    list.forEach((f, i) => {
      const x = 6 + i * (w + 4), y = 4, dead = f.eliminated || f.st === 'KO';
      panel(g, x, y, w, 30, { accent: f.char.color, alpha: dead ? .5 : .92, cut: 3 });
      this.portrait(g, f, x + 3, y + 3, 24, false);
      drawText(g, f.name, x + 30, y + 2, { size: 11, color: dead ? UI.faint : f.ctrl === 'human' ? '#ffd65a' : '#ffffff' });
      gauge(g, x + 30, y + 15, w - 34, 5, f.hp / f.maxHp, 'hp', {});
      gauge(g, x + 30, y + 23, (w - 34) * .8 | 0, 3, Math.max(0, f.stun) / f.maxStun, 'stun', {});
      if (dead) { drawText(g, f.st === 'KO' ? 'KO' : '탈락', x + w / 2 + 12, y + 9, { color: '#ff5b5b', bold: true, outline: '#05060f' }); }
      if (f.fin >= B.finMax && !dead) rect(g, Math.floor(this.t * 6) % 2 ? '#3fe0d0' : '#ffffff', x + w - 6, y + 3, 3, 3);
    });
  }
  tagPanels(g, m) {
    const F = m.fighters;
    for (const team of [0, 1]) {
      const legal = F.find(f => f.team === team && f.legal) || F.find(f => f.team === team), mate = legal.partner;
      this.bigPanel(g, legal, team ? 634 : 6, !!team, m);
      if (mate) {
        const x = team ? 634 - 120 : 6, y = 64;
        panel(g, x, y, 120, 20, { accent: mate.char.color, alpha: .85, cut: 2, accentBar: false });
        drawText(g, mate.name, x + 4, y + 3, { size: 11, color: UI.dim });
        gauge(g, x + 52, y + 7, 62, 5, mate.hp / mate.maxHp, 'hp', {});
        if (mate.wantTag && Math.floor(this.t * 4) % 2) drawText(g, '교대!', team ? x - 4 : x + 124, y + 3, { size: 11, align: team ? 'r' : 'l', color: '#6be38a', outline: '#05060f' });
      }
    }
  }
  center(g, m) {
    const x = 320, y = 4;
    const lim = m.rules.time, left = lim ? Math.max(0, lim - m.clock) : m.clock;
    panel(g, x - 30, y, 60, 22, { cut: 3, accentBar: false, bg: '#0b0f22' });
    drawText(g, lim || m.mode === 'rumble' || m.mode === 'royal' ? fmtTime(left) : '∞', x, y + 4, { align: 'c', color: lim && left < 30 && Math.floor(this.t * 2) % 2 ? '#ff5b5b' : '#ffffff' });
    let rule = (MODES[m.mode] || {}).name || '';
    if (m.mode === 'rumble') rule += ` · 남은 입장 ${m.queue.length}`;
    if (m.mode === 'royal' || m.mode === 'rumble') rule += ` · 링 위 ${m.alive().length}`;
    if (m.cfg.title) rule = m.cfg.title;
    drawText(g, rule, x, y + 28, { size: 11, align: 'c', color: '#c9d4ff', outline: '#05060f' });
    if (m.mode === 'rumble' && m.queue.length && m.phase === 'fight') { const s = Math.ceil(m.nextEntry); drawText(g, `다음 입장 ${s}초`, x, y + 41, { size: 11, align: 'c', color: s <= 5 ? '#ffd65a' : UI.dim, outline: '#05060f' }); }
  }
  worldMarks(g, m, camX) {
    const h = m.human;
    for (const f of m.fighters) {
      if (f.gone || !f.alive || f.hidden) continue;
      const hx = Math.round(f.joints.x(J.head) - camX), hy = Math.round(Math.min(f.joints.y(J.head), f.joints.y(J.pelvis) - 20) - 22);
      // grab mark over helpless foes
      if (h && h.isFoe(f) && f.grabbable && f.side === h.side) {
        const near = Math.abs(f.x - h.x) < B.grabRange + 6, bob = Math.round(Math.sin(this.t * 8) * 2);
        const y = f.st === 'DOWN' ? f.y - 34 : hy;
        g.globalAlpha = near ? 1 : .55;
        rect(g, '#05060f', hx - 9, y - 1 + bob, 18, 14); rect(g, near ? '#ffd65a' : '#9aa6d6', hx - 8, y + bob, 16, 12);
        drawText(g, this.input.label('grab'), hx, y + 1 + bob, { size: 11, align: 'c', color: '#141a36' });
        rect(g, near ? '#ffd65a' : '#9aa6d6', hx - 1, y + 12 + bob, 3, 3);
        g.globalAlpha = 1;
      }
      // player marker
      if (f.ctrl === 'human' && m.fighters.length > 1) { const y = hy - 8 + Math.round(Math.sin(this.t * 5)); rect(g, '#05060f', hx - 4, y - 1, 9, 6); rect(g, '#ffd65a', hx - 3, y, 7, 2); rect(g, '#ffd65a', hx - 2, y + 2, 5, 1); rect(g, '#ffd65a', hx - 1, y + 3, 3, 1); }
      if (f.st === 'HANG' && f.ctrl !== 'human') drawText(g, '매달림!', hx, hy - 4, { size: 11, align: 'c', color: '#ff8a2b', outline: '#05060f' });
      if (f.side === 'out' && m.rules.ringOut === 'count' && f.outCount >= 1 && m.phase === 'fight') drawText(g, String(Math.floor(f.outCount)), hx, hy - 16, { scale: 2, align: 'c', color: f.outCount > 7 ? '#ff5b5b' : '#ffd65a', bold: true, outline: '#05060f' });
    }
    // pin count
    if (m.pin) { const p = m.pin, x = Math.round(p.v.x - camX); drawText(g, p.count ? String(p.count) : '…', x, p.v.y - 92, { scale: 3, align: 'c', color: p.count >= 2 ? '#ff5b5b' : '#ffffff', bold: true, outline: '#05060f' }); }
  }
  human(g, m, camX) {
    const f = m.human;
    if (!f || m.phase !== 'fight') return;
    const L = f.link, inp = this.input;
    // grapple choice
    if (L && L.kind === 'hold' && L.a === f) { this.grappleMenu(g, m, f, L, camX); return; }
    if (L && L.v === f) {
      const x = Math.round(f.x - camX), y = f.y - 118;
      if (L.kind === 'hold') {
        const k = Math.floor(this.t * 10) % 3;
        drawText(g, '연타해서 벗어나기!', x, y - 14, { size: 11, align: 'c', color: '#ffd65a', outline: '#05060f' });
        ['atk', 'grab', 'dodge'].forEach((a, i) => keycap(g, inp.label(a), x - 22 + i * 16, y - (i === k ? 2 : 0)));
        gauge(g, x - 30, y + 14, 60, 4, f.escape / B.grabEscape, 'stun', { col: '#6be38a', colD: '#1f6a3a' });
        if (f.burstCd <= 0 && f.fin >= B.burstCost) prompt(g, [inp.label('down') + '+' + inp.label('dodge')], '긴급 탈출', x, y + 22, { align: 'c' });
      } else if (L.kind === 'move' && L.rev && L.rev.open && !L.rev.tried) {
        rect(g, '#05060f', x - 13, y - 3, 26, 22); rect(g, '#ff5fa2', x - 12, y - 2, 24, 20); drawText(g, inp.label('dodge') + '!', x, y + 1, { scale: 1, align: 'c', color: '#ffffff', bold: true });
      }
      return;
    }
    if (m.pin && m.pin.v === f) { const x = Math.round(f.x - camX); drawText(g, '연타! 어깨를 들어라!', x, f.y - 70, { size: 11, align: 'c', color: '#ffd65a', outline: '#05060f' }); gauge(g, x - 34, f.y - 56, 68, 5, m.pin.kick / m.pin.need, 'stun', { col: '#6be38a' }); return; }
    if (m.pin && m.pin.a === f) { prompt(g, [inp.label('dodge')], '핀 풀기', 320, 336, { align: 'c', bg: 1 }); return; }
    // contextual prompts
    const P = [];
    const ar = m.arena;
    const g2 = m.grapple.grabTarget(f);
    if (g2) P.push([[inp.label('grab')], '잡기']);
    if (m.rules.pin && f.side === 'in' && f.nearestFoe(58, o => o.st === 'DOWN' && !o.rag)) P.push([[inp.label('down')], '핀폴']);
    if (f.fin >= B.finMax && f.alive) P.push([[inp.label('fin')], '피니셔']);
    if (f.st === 'PERCH') P.push([[inp.label('atk')], '다이빙'], [[inp.label('down')], '내려오기']);
    if (f.st === 'HANG') P.push([[inp.label('up')], '연타로 올라가기']);
    if (f.st === 'APRON') P.push([[inp.label('up')], '링 안으로'], [[inp.label('down')], '내려가기']);
    if (ar.hasRing && f.side === 'out' && f.y > ar.matY + 4 && f.st !== 'HANG') { const d = Math.min(Math.abs(f.x - (ar.ropeL - ar.apron)), Math.abs(f.x - (ar.ropeR + ar.apron))); if (d < 46) P.push([[inp.label('up')], '링으로 올라가기']); }
    if (ar.hasRing && f.side === 'in' && f.fsm.is('IDLE', 'MOVE') && ar.nearRope(f.x).dist < 34) P.push([[inp.label('up')], '코너 오르기']);
    if (m.mode === 'tag' && f.legal && f.partner && f.partner.st === 'TAGWAIT' && Math.abs(f.x - (f.team === 0 ? ar.ropeL : ar.ropeR)) < B.tagRange) P.push([[inp.label('down')], '교대']);
    if ((f.st === 'HITSTUN' || f.st === 'DOWN' || f.st === 'STAGGER') && f.burstCd <= 0 && f.fin >= B.burstCost) P.push([[inp.label('down') + '+' + inp.label('dodge')], '긴급 탈출']);
    let px = 320 - (P.length - 1) * 60;
    for (const [k, t] of P.slice(0, 3)) { prompt(g, k, t, px, 338, { align: 'c', bg: 1 }); px += 120; }
    // status line (bottom left): states only
    const parts = [];
    if (f.downs) parts.push(`다운 ${f.downs}회`);
    if (f.dodgeCd > 0) parts.push('회피 대기');
    if (f.burstCd > 0) parts.push(`긴급탈출 ${Math.ceil(f.burstCd)}초`);
    else if (f.fin < B.burstCost) parts.push('긴급탈출: 게이지 부족');
    if (f.boost > 0) parts.push('로프 가속');
    if (f.exhausted) parts.push('지침');
    drawText(g, parts.join(' · '), 8, 344, { size: 11, color: UI.dim, outline: '#05060f' });
  }
  grappleMenu(g, m, f, L, camX) {
    const inp = this.input, v = L.v, x = Math.round((f.x + v.x) / 2 - camX), y = Math.round(f.y - 150);
    const slots = [['u', 0, -26], ['b', -f.face * 70, 0], ['n', 0, 0], ['f', f.face * 70, 0], ['d', 0, 26]];
    panel(g, x - 104, y - 40, 208, 92, { alpha: .82, cut: 3, accent: f.char.color });
    drawText(g, L.pos === 'front' ? '정면 잡기' : '뒤 잡기', x - 98, y - 37, { size: 11, color: '#ffd65a' });
    gauge(g, x + 6, y - 35, 90, 3, L.hold / (B.grabHold * (.8 + .2 * f.stats.grp)), 'fin', { col: '#ffd65a', colD: '#7a5a1a' });
    gauge(g, x + 6, y - 29, 90, 3, v.escape / B.grabEscape, 'hp', { col: '#ff5b5b' });
    for (const [s, dx, dy] of slots) {
      const id = f.moves[L.pos] && f.moves[L.pos][s], mv = MOVES[id];
      if (!mv) continue;
      const c = m.grapple.check(f, v, mv), denied = L.deny && L.deny.slot === s && m.time - L.deny.t < .8;
      const key = (s === 'u' ? inp.label('up') + '+' : s === 'd' ? inp.label('down') + '+' : s === 'f' ? (f.face > 0 ? '→' : '←') + '+' : s === 'b' ? (f.face > 0 ? '←' : '→') + '+' : '') + inp.label('grab');
      const name = mv.name, tw = textWidth(name, 11);
      const cx = x + dx, cy = y + dy;
      const kw = Math.max(11, textWidth(key, 11) + 6);
      const ww = Math.max(tw, kw) + 6;
      rect(g, denied ? '#5a1a2a' : c.ok ? '#1b2450' : '#14172a', cx - ww / 2, cy - 1, ww, 24);
      keycap(g, key, cx - kw / 2, cy, { bg: c.ok ? '#ffd65a' : '#5f6ca6' });
      drawText(g, name, cx, cy + 12, { size: 11, align: 'c', color: c.ok ? '#ffffff' : UI.faint });
      if (!c.ok && denied) drawText(g, c.why, cx, cy + 24, { size: 11, align: 'c', color: '#ff8a8a', outline: '#05060f' });
    }
    drawText(g, `${inp.label('atk')} 무릎치기 ${B.grabStrikeMax - L.strikes}  ${inp.label('dodge')} 위치 바꾸기` + (f.fin >= B.finMax ? `  ${inp.label('fin')} 피니셔` : ''), x, y + 40, { size: 11, align: 'c', color: UI.dim });
    void sgn; void clamp;
  }
  drawBanners(g) {
    for (const b of this.banners) {
      const k = b.t / b.life, a = k < .1 ? k / .1 : k > .8 ? (1 - k) / .2 : 1;
      g.globalAlpha = clamp01(a);
      const off = k < .1 ? (1 - k / .1) * 40 : 0;
      g.save(); g.translate(off * (b.from || 1), 0);
      banner(g, b.text, b.y, b.col, { scale: b.scale, sub: b.sub, band: b.band, grad: b.grad });
      g.restore();
      g.globalAlpha = 1;
    }
  }
  drawCard(g) {
    const c = this.card;
    if (!c) return;
    const k = c.t / 1.6, slide = k < .12 ? 1 - k / .12 : k > .85 ? -(k - .85) / .15 : 0, a = k > .85 ? 1 - (k - .85) / .15 : 1;
    const col = c.F.color || '#ffd65a', y = 252;
    g.globalAlpha = a;
    g.save(); g.translate(slide * 640, 0);
    rect(g, '#05060f', 0, y - 2, 640, 50); rect(g, mixHex(col, '#05060f', .6), 0, y, 640, 46); rect(g, col, 0, y, 640, 2); rect(g, col, 0, y + 44, 640, 2);
    for (let i = 0; i < 640; i += 14) rect(g, mixHex(col, '#05060f', .45), i + ((c.t * 200) % 14), y + 2, 5, 42);
    rect(g, '#05060f', 34, y - 10, 58, 58); rect(g, mixHex(col, '#0b0f22', .5), 36, y - 8, 54, 54);
    drawPortrait(g, c.f.look, 'shout', 36, y - 8, 54, { px: 2, dy: 6 });
    drawText(g, c.F.name, 110, y + 5, { scale: 2, color: '#ffffff', bold: true, outline: '#05060f' });
    drawText(g, c.f.name + ' — ' + c.F.line, 112, y + 32, { size: 11, color: mixHex(col, '#ffffff', .6), outline: '#05060f' });
    g.restore();
    g.globalAlpha = 1;
  }
  toasts(g) { this.toastList.forEach((t, i) => { const a = t.t > 2.2 ? (2.6 - t.t) / .4 : 1; g.globalAlpha = a; drawText(g, t.text, 632, 300 - i * 14, { size: 11, align: 'r', color: t.col, outline: '#05060f' }); g.globalAlpha = 1; }); }
}
const hudShade = shade;
const hudEllipse = ellipse;

return { HUD, hudShade, hudEllipse };
})();
// ---- scenes/MatchScene.js
__m["scenes/MatchScene.js"] = (function () {
// A match on screen: simulation + camera + effects + sound + HUD + pause + results.
const { VIEW_W, VIEW_H, clamp, damp, fmtTime, sgn, josa } = __m["core/util.js"];
const { MatchManager, MODES } = __m["combat/MatchManager.js"];
const { ArenaRenderer } = __m["render/ArenaRenderer.js"];
const { FighterRenderer } = __m["render/FighterRenderer.js"];
const { Fx } = __m["render/Fx.js"];
const { HUD } = __m["render/HUD.js"];
const { UI } = __m["render/palette.js"];
const { drawText } = __m["render/pixelfont.js"];
const { rect } = __m["render/painter.js"];
const { panel, menuList, fade, prompt } = __m["render/ui.js"];
const { BALANCE: B } = __m["data/balance.js"];
const { DIFFICULTY } = __m["combat/AIController.js"];
const { J } = __m["anim/skeleton.js"];
const { drawPortrait } = __m["render/head.js"];
const HOW = { ko: 'K.O.', pin: '핀폴', countout: '링아웃 카운트', ringout: '링아웃 탈락', decision: '판정', time: '시간 종료', 'double countout': '양자 링아웃' };
class MatchScene {
  constructor(game, cfg, onEnd) {
    this.game = game; this.cfg = cfg; this.onEnd = onEnd;
    this.m = new MatchManager(cfg);
    this.ar = new ArenaRenderer(this.m.arena, this.m.arenaDef);
    this.fr = new FighterRenderer(); this.fr.setEnv({ rim: this.m.arenaDef.rim, light: this.m.arenaDef.light });
    this.fx = new Fx(); this.hud = new HUD(game.input);
    this.camX = clamp(this.m.arena.mid - VIEW_W / 2, 0, this.m.arena.width - VIEW_W);
    this.paused = false; this.sel = 0; this.debug = false; this.t = 0; this.endT = 0; this.resultShown = false; this.dark = 0; this.darkGoal = 0; this.focusPair = null; this.focusT = 0;
    this.introStep = -1; this.practiceSel = 0;
    this.wire();
    const tint = this.m.arenaDef.tint || [1, 1, 1];
    game.screen.resetFx(); game.screen.goal.tint = tint.slice(); game.screen.fx.tint = tint.slice();
    game.audio.music(cfg.music || (cfg.mode === 'rumble' || cfg.mode === 'royal' ? 'rumble' : cfg.boss ? 'boss' : 'match'));
    this.ar.setScreen(this.titleText(), MODES[this.m.mode].name, '#ffd65a');
  }
  titleText() { const F = this.m.fighters; if (F.length === 2) return F[0].name + ' VS ' + F[1].name; return (MODES[this.m.mode] || {}).name || ''; }
  get human() { return this.m.human; }
  // ---- events to effects ----
  wire() {
    const m = this.m, A = this.game.audio, fx = this.fx, S = this.game.screen, hud = this.hud, ar = this.ar;
    const isH = f => f && f.ctrl === 'human';
    const cheer = k => { ar.boost(k * .3); if (k > .5) A.cheer(Math.min(1.4, k)); };
    m.on('swing', e => { if (e.def.lv >= 2) A.sfx('swing'); });
    m.on('hit', e => {
      const d = e.d, p = d.lv >= 4 ? 1.6 : d.lv >= 3 ? 1.2 : d.lv >= 2 ? .8 : .5;
      fx.spark(e.x, e.y, p, e.counterHit ? '#ff8fc4' : '#fff3b0', e.dir);
      A.sfx(d.sfx || 'punch1');
      if (d.lv >= 3) { S.shake(.18 + p * .1); A.sfx('hurt', { voice: e.v.char.voice }); }
      if (d.lv >= 4) fx.sweat(e.x, e.y, 5);
      if (e.counterHit) fx.word('카운터!', e.x, e.y - 18, '#ff8fc4', 2);
      else if (d.lv >= 3) fx.word(d.lv >= 4 ? '콰직!' : e.combo > 2 ? '퍽퍽!' : '퍽!', e.x + e.dir * 6, e.y - 14, '#ffffff', 2);
      else if (d.lv === 1 && Math.random() < .25) fx.word(['팍', '탁', '퍽'][(Math.random() * 3) | 0], e.x, e.y - 10, '#ffe9a8', 1);
      if (e.armored) fx.word('버텼다!', e.v.x, e.v.y - 100, '#ffd65a', 1);
      if (d.lv >= 3) cheer(.4);
    });
    m.on('block', e => { fx.spark(e.x, e.y, .5, '#9fd6ff', sgn(e.v.x - e.a.x)); A.sfx('block'); });
    m.on('parry', e => { fx.spark(e.x, e.y, 1.4, '#ffffff'); fx.ring(e.x, e.v.y, 50, '#9fd6ff'); fx.word('패리!', e.x, e.y - 20, '#9fd6ff', 2); A.sfx('parry'); S.flash(.6, .9, 1, .35); cheer(.6); });
    m.on('guardBreak', e => { fx.word(e.shove ? '가드 깨기!' : '가드 크래시!', e.v.x, e.v.y - 96, '#ffb347', 2); A.sfx('punch3'); S.shake(.25); });
    m.on('dodge', e => { if (isH(e.f) || isH(e.a)) fx.word('회피', e.f.x, e.f.y - 96, '#9fd6ff', 1); });
    m.on('counter', e => { fx.word('반격!', e.f.x, e.f.y - 100, '#ff5fa2', 3); A.sfx('counter'); m.slowmo(.4, .3); S.flash(1, .6, .8, .25); cheer(.8); });
    m.on('reversal', e => { fx.word(e.fin ? '피니셔 역전!!' : '역전!', e.f.x, e.f.y - 104, '#ff5fa2', 3); A.sfx('reversal'); m.slowmo(.35, .45); S.flash(1, .5, .8, .4); cheer(1.2); });
    m.on('revFail', e => { if (isH(e.v)) fx.word('너무 일찍!', e.v.x, e.v.y - 100, '#9aa6d6', 1); });
    m.on('down', e => { if (!e.quiet) { A.sfx('down'); cheer(.6); if (e.n >= 2 && isH(e.a)) hud.toast(`${e.f.name} 다운 ${e.n}회 — 다음 다운이 더 길다`, '#ffb347'); } });
    m.on('grab', e => { A.sfx('grip'); });
    m.on('escape', e => { fx.word('탈출!', e.v.x, e.v.y - 100, '#6be38a', 2); A.sfx('whoosh'); });
    m.on('switch', () => A.sfx('grip'));
    m.on('grabStrike', e => { fx.spark(e.v.x, e.v.y - 50, .6); A.sfx('kick1'); });
    m.on('deny', e => { A.sfx('deny'); if (isH(e.f)) hud.toast(`${e.mv ? e.mv.name : '기술'}: ${e.why}`, '#ff8a8a'); });
    m.on('moveStart', e => {
      A.sfx(e.fin ? 'cry' : 'grunt', { voice: e.a.char.voice });
      if (e.fin) { this.finisherCam(e.a, e.v, e.fin); }
    });
    m.on('moveEvent', e => this.moveEvent(e));
    m.on('thud', e => { if (e.v > 220) { fx.dust(e.x, e.y, Math.min(1.4, e.v / 400)); A.sfx('thud', { p: Math.min(1, e.v / 500) }); } });
    m.on('wall', e => { S.shake(.35); A.sfx('punch3'); fx.word('쾅!', e.x, e.y - 30, '#ffffff', 2); fx.spark(e.x, e.y, 1); });
    m.on('rope', e => { A.sfx('rope'); });
    m.on('ropeHit', () => A.sfx('rope', { p: .7 }));
    m.on('ropeBody', () => A.sfx('rope', { p: .5 }));
    m.on('land', e => { const v = e.f.landV || 0; if (v > 200) { A.sfx('land', { p: Math.min(1, v / 500) }); fx.dust(e.f.x, e.f.y, .35); } });
    m.on('jump', () => A.sfx('jump'));
    m.on('dive', e => { A.sfx('whoosh', { pitch: 1.6 }); cheer(.6); });
    m.on('landAttack', e => { A.sfx('thud', { p: .8 }); fx.dust(e.f.x, e.f.y, e.def.quake ? 1.5 : .6); if (e.def.quake) { S.shake(.4); fx.ring(e.f.x, e.f.y, e.def.quake, '#ffffff'); } if (!e.ok && e.def.dive) fx.word('아야야!', e.f.x, e.f.y - 40, '#9aa6d6', 1); });
    m.on('finisherStart', e => { A.sfx('charge'); fx.ring(e.f.x, e.f.y, 60, e.F.color); hud.push('피니셔!', { col: e.F.color, scale: 2, y: 90, life: .9 }); cheer(.8); S.flash(1, 1, 1, .15); });
    m.on('finisherHit', e => { A.sfx('finisher'); hud.finisherCard(e.f, e.F); this.ar.setScreen(e.F.name, e.f.name, e.F.color, true); cheer(1.4); });
    m.on('finisherMiss', e => { fx.word(e.why === 'blocked' ? '막혔다!' : e.why === 'crash' ? '헛디뎠다!' : '빗나감!', e.f.x, e.f.y - 100, '#9aa6d6', 2); A.boo(.6); A.sfx('miss'); });
    m.on('finReady', e => { if (isH(e.f)) { hud.toast(`피니셔 준비! [${this.game.input.label('fin')}]`, '#3fe0d0'); A.sfx('good'); } });
    m.on('taunt', e => { cheer(.5); });
    m.on('burst', e => { fx.ring(e.f.x, e.f.y, 110, '#ffffff', .5); fx.spark(e.f.x, e.f.y - 50, 1.5, '#9fe0ff'); S.flash(.8, .95, 1, .3); A.sfx('parry'); fx.word('긴급 탈출!', e.f.x, e.f.y - 104, '#9fe0ff', 2); });
    m.on('stagger', e => { fx.word('어질…', e.f.x, e.f.y - 100, '#ffd65a', 1); });
    m.on('overRope', e => { if (m.rules.ringOut === 'elim') cheer(.7); });
    m.on('eliminated', e => { A.sfx('bell'); hud.push('탈락!', { col: '#ff5b5b', sub: e.f.name, y: 110, life: 1.4 }); cheer(1); });
    m.on('entry', e => { hud.push('입장!', { col: e.f.char.color, sub: e.f.name + ' — ' + e.f.char.nick, y: 100, life: 1.8 }); A.sfx('bell'); cheer(1); this.ar.setScreen(e.f.name, '입장!', e.f.char.color, true); });
    m.on('hang', e => { fx.word('매달렸다!', e.f.x, e.f.y - 70, '#ffb347', 2); cheer(.8); });
    m.on('pin', () => { A.sfx('grip'); cheer(.6); });
    m.on('count', e => { if (e.pin) { A.sfx('count', { n: e.n }); cheer(.3 * e.n); this.ar.setScreen(String(e.n), '카운트', e.n >= 3 ? '#ff5b5b' : '#ffffff'); } else A.sfx('tick'); });
    m.on('kickout', e => { fx.word('킥아웃!', e.v.x, e.v.y - 60, '#6be38a', 3); cheer(1.3); this.ar.setScreen('킥아웃!', String(e.count), '#6be38a', true); });
    m.on('tag', e => { fx.word('교대!', e.f.x, e.f.y - 90, '#6be38a', 2); A.sfx('slap'); cheer(.9); });
    m.on('ko', e => { A.sfx('ko'); A.sfx('bell3'); S.shake(.5); m.slowmo(.25, 1.2); this.ar.setScreen('K.O.!', e.v.name, '#ff5b5b', true); cheer(1.5); });
    m.on('ready', () => { hud.push('준비…', { col: '#ffffff', y: 140, life: 1.2, scale: 3 }); this.ar.setScreen('준비', this.titleText(), '#ffffff'); });
    m.on('bell', () => { A.sfx('bell'); hud.push('파이트!', { col: '#ffd65a', y: 140, life: 1, scale: 4, grad: '#ff8a2b' }); this.ar.setScreen(this.titleText(), MODES[m.mode].name, '#49d6ff'); cheer(1); });
    m.on('end', r => this.onMatchEnd(r));
    m.on('whip', () => A.sfx('whoosh'));
    m.on('sweep', e => { A.sfx('punch2'); fx.spark(e.o.x, e.o.y - 40, 1); });
    m.on('fault', e => console.warn('fault', e.why, e.f && e.f.name));
  }
  moveEvent(e) {
    const { k, o, a, v, move } = e, A = this.game.audio, fx = this.fx, S = this.game.screen, fin = e.fin;
    const gx = v ? v.joints.x(J.pelvis) : a.x, gy = this.m.arena.ground(gx, a.y, a.side);
    switch (k) {
      case 'impact': {
        const p = o.p || 1;
        S.shake(Math.min(1, .25 + p * .22)); A.sfx('slam', { p });
        fx.dust(gx, gy, p * .9); fx.ring(gx, gy, 40 + p * 30, '#ffffff', .35 + p * .1);
        if (v) { const hx = v.joints.x(J.head), hy = v.joints.y(J.head); fx.spark(hx, hy, Math.min(2, p), fin ? fin.color : '#fff3b0'); fx.sweat(hx, hy, 4 + p * 2); }
        if (o.word) fx.word(o.word, gx, gy - 60 - p * 8, fin ? fin.color : '#ffffff', fin ? 3 : 2);
        this.m.arena.slam(gx, p);
        if (fin) { S.flash(1, 1, 1, .45); S.goal.zoom = Math.max(S.goal.zoom, 1.42); this.focusT = Math.max(this.focusT, .6); S.fx.chroma = 1; fx.screenLines = .5; fx.lineCol = fin.color; }
        if (o.spark) fx.weld(gx, gy - 60);
        this.ar.boost(.3 + p * .15); if (p >= 1) A.cheer(Math.min(1.5, p * .7));
        break;
      }
      case 'smack': { const x = v ? v.joints.x(J.head) : a.x, y = v ? v.joints.y(J.head) : a.y - 60; fx.spark(x, y, 1, fin ? fin.color : '#fff3b0'); A.sfx(o.spark ? 'punch2' : 'slap'); if (o.spark) fx.weld(x, y); if (o.word) fx.word(o.word, x, y - 16, '#ffffff', 2); S.shake(.18); break; }
      case 'squeeze': if (v) { fx.sweat(v.joints.x(J.head), v.joints.y(J.head), 3); if (o.word) fx.word(o.word, v.x, v.y - 90, '#ff8fc4', 2); A.sfx('hurt', { voice: v.char.voice }); } break;
      case 'whoosh': A.sfx('whoosh'); break;
      case 'spin': A.sfx('spin'); break;
      case 'lift': A.sfx('lift', { voice: a.char.voice }); break;
      case 'grunt': A.sfx('grunt', { voice: a.char.voice }); break;
      case 'cry': A.sfx('cry', { voice: a.char.voice }); fx.word(fin ? fin.line || '' : '', a.x, a.y - 120, '#ffffff', 1); break;
      case 'charge': A.sfx('charge'); fx.ring(a.x, a.y, 50, fin ? fin.color : '#ffffff'); break;
      case 'grip': A.sfx('grip'); break;
      case 'dust': fx.dust(gx, gy, 1); break;
      case 'splash': fx.splash(a.x, a.y); A.sfx('splash'); break;
      case 'fin': fx.splash(a.x + a.face * 20, a.y); break;
      case 'ink': fx.smoke(v ? v.x : a.x, a.y - 50, '#2a1440', 22); A.sfx('ink'); this.fx.ink = 1.4; break;
      case 'blackout': this.darkGoal = .86; A.sfx('lightsOff'); this.darkUntil = this.m.time + 2.1; break;
    }
  }
  finisherCam(a, v) { this.focusPair = { a, v }; this.focusT = 2.2; this.m.slowmo(.5, .45); this.fx.screenLines = .8; }
  onMatchEnd(r) {
    this.endT = 0;
    const h = this.human, win = h && r.winner && r.team === h.team;
    const A = this.game.audio;
    setTimeout(() => A.jingle(r.draw ? 'lose' : !h ? 'win' : win ? 'win' : 'lose'), 900);
    this.hud.push(r.draw ? '무승부' : win || !h ? '승리!' : '패배…', { col: r.draw ? '#c9d4ff' : win || !h ? '#ffd65a' : '#ff5b5b', sub: r.draw ? HOW[r.how] : `${r.winner ? r.winner.name : ''} · ${HOW[r.how] || r.how}`, y: 120, life: 3, scale: 4 });
    if (r.winner) { this.fx.confetti(r.winner.x, 140, 90); }
    this.ar.setScreen(r.draw ? '무승부' : (r.winner ? r.winner.name : ''), HOW[r.how] || '', '#ffd65a', true);
  }
  // ---- per frame ----
  update(dt) {
    const g = this.game, inp = g.input, m = this.m;
    this.t += dt;
    if (inp.rawPressed('F3') || inp.rawPressed('Backquote')) this.debug = !this.debug;
    if (this.resultShown) { if (inp.menuPressed('confirm')) this.finish(); return; }
    if (this.paused) { this.pauseInput(); return; }
    if (inp.pressed('pause') && m.phase !== 'end') { this.paused = true; this.sel = 0; g.audio.sfx('ui'); return; }
    // human input
    const h = this.human;
    if (h && m.phase === 'fight') inp.fillIntent(h.intent);
    if (m.phase === 'intro' && (inp.menuPressed('confirm') || inp.pressed('atk'))) { m.introT = 99; }
    m.update(dt);
    if (m.phase === 'end') { this.endT += dt; if (h && h.st !== 'KO' && h.alive && m.result && m.result.team === h.team && h.st !== 'WIN' && this.endT > 1.2 && !h.link && h.ground) h.set('WIN', { force: true }); if (this.endT > 1.4) for (const f of m.fighters) if (f.alive && f.st !== 'WIN' && m.result && m.result.team === f.team && !f.link && f.ground && f.st !== 'KO' && !h) f.set('WIN', { force: true }); if (this.endT > 3.4) this.resultShown = true; }
    this.fx.update(m.freeze > 0 ? dt * .3 : dt * m.slowK);
    this.ar.update(dt, m.hype);
    this.hud.update(dt, m);
    g.audio.crowd(.3 + m.hype / 100 * .7);
    this.camera(dt);
    // lights out
    if (this.darkUntil && m.time > this.darkUntil) { this.darkGoal = 0; this.darkUntil = 0; }
    this.dark = damp(this.dark, this.darkGoal, 9, dt);
  }
  camera(dt) {
    const m = this.m, S = this.game.screen, ar = m.arena;
    let tx;
    const act = m.fighters.filter(f => !f.gone && (f.alive || f.st === 'KO') && f.st !== 'TAGWAIT');
    if (m.phase === 'intro') {
      const F = m.fighters.filter(f => f.st === 'INTRO'), n = F.length, step = n ? Math.min(n - 1, Math.floor(m.introT / ((m.cfg.introTime || 3.2) / n))) : -1;
      if (step !== this.introStep && F[step]) { this.introStep = step; const f = F[step]; this.hud.push(f.name, { col: f.char.color, sub: f.char.nick + ' · ' + (DIFFICULTY[f.difficulty] && f.ctrl !== 'human' ? DIFFICULTY[f.difficulty].name : '플레이어'), y: 188, life: (m.cfg.introTime || 3.2) / n, scale: 3, from: f.x < ar.mid ? -1 : 1 }); for (const o of F) o.spot = o === f; this.game.audio.cheer(.7); }
      const f = F[Math.max(0, step)];
      tx = f ? f.x : ar.mid;
      if (f) { S.focus(f.x - this.camX, f.y - 60, 1.3); }
    } else {
      for (const f of m.fighters) f.spot = false;
      const h = this.human;
      let sum = 0, wsum = 0;
      for (const f of act) { const w = f === h ? 2.2 : f.side === 'in' ? 1 : .6; sum += f.x * w; wsum += w; }
      tx = wsum ? sum / wsum : ar.mid;
      if (h && act.length > 1) { const lo = h.x - VIEW_W / 2 + 70, hi = h.x + VIEW_W / 2 - 70; tx = clamp(tx, lo, hi); }
      if (this.focusT > 0 && this.focusPair) {
        this.focusT -= dt;
        const { a, v } = this.focusPair, fx = (a.x + v.x) / 2, fy = Math.min(a.y, v.y) - 60;
        S.focus(fx - this.camX, fy, this.focusT > 1.6 ? 1.32 : 1.18);
        if (this.focusT <= 0) { this.focusPair = null; S.unfocus(); }
      } else if (m.phase === 'end' && m.result && m.result.loser && this.endT < 2.4) { const l = m.result.loser; S.focus(l.x - this.camX, l.y - 40, 1.35); }
      else S.unfocus();
    }
    const want = clamp(tx - VIEW_W / 2, 0, ar.width - VIEW_W);
    this.camX = damp(this.camX, want, m.phase === 'intro' ? 4 : 5.5, dt);
  }
  pauseInput() {
    const inp = this.game.input, A = this.game.audio, items = this.pauseItems();
    if (inp.pressed('up')) { this.sel = (this.sel + items.length - 1) % items.length; A.sfx('ui'); }
    if (inp.pressed('down')) { this.sel = (this.sel + 1) % items.length; A.sfx('ui'); }
    const it = items[this.sel];
    if ((inp.pressed('left') || inp.pressed('right')) && it.cycle) { it.cycle(inp.pressed('left') ? -1 : 1); A.sfx('ui'); }
    if (inp.menuPressed('cancel') || inp.pressed('pause')) { this.paused = false; A.sfx('back'); this.game.input.clear(); return; }
    if (inp.menuPressed('confirm')) { A.sfx('ok'); if (it.act) it.act(); }
  }
  pauseItems() {
    const P = this.m.practice;
    const items = [{ label: '계속하기', act: () => { this.paused = false; this.game.input.clear(); } }, { label: '조작법', act: () => this.game.showControls(this) }, { label: '디버그 표시', value: this.debug ? '켬' : '끔', act: () => { this.debug = !this.debug; }, cycle: () => { this.debug = !this.debug; } }];
    if (P) {
      const beh = ['idle', 'guard', 'attack', 'dodge', 'escape', 'ai'], names = { idle: '가만히', guard: '방어만', attack: '공격', dodge: '회피·반격', escape: '탈출 연타', ai: '일반 AI' };
      const foe = this.m.fighters.find(f => f.ctrl !== 'human');
      const cur = foe && foe.ai ? (foe.ai.behavior || 'ai') : 'idle';
      items.push({ label: '상대 행동', value: names[cur], cycle: d => { const i = (beh.indexOf(cur) + d + beh.length) % beh.length; if (foe && foe.ai) { foe.ai.behavior = beh[i] === 'ai' ? null : beh[i]; foe.ctrl = beh[i] === 'ai' ? 'ai' : 'dummy'; } }, act: () => items[3].cycle(1) });
      items.push({ label: '상대 체력 무한', value: P.infinite ? '켬' : '끔', cycle: () => { P.infinite = !P.infinite; }, act: () => { P.infinite = !P.infinite; } });
      items.push({ label: '내 피니셔 가득', value: P.fullFin ? '켬' : '끔', cycle: () => { P.fullFin = !P.fullFin; }, act: () => { P.fullFin = !P.fullFin; } });
      items.push({ label: '상대 기절 저항 0', value: P.stunLock ? '켬' : '끔', cycle: () => { P.stunLock = !P.stunLock; }, act: () => { P.stunLock = !P.stunLock; } });
      items.push({ label: '상대 회복', act: () => { for (const f of this.m.fighters) { f.hp = f.maxHp; f.stun = f.maxStun; } } });
      items.push({ label: '연습 끝내기', act: () => this.finish(true) });
    } else items.push({ label: this.cfg.career ? '기권 (패배 처리)' : '경기 포기', act: () => { this.paused = false; const h = this.human; const w = this.m.fighters.find(f => h && f.team !== h.team); this.m.end({ winner: w, loser: h, how: 'forfeit', team: w ? w.team : null, forfeit: true }); } });
    return items;
  }
  finish(quit) {
    if (this.done) return;
    this.done = true;
    this.game.screen.resetFx();
    const r = this.m.result || { forfeit: true, quit };
    const summary = this.m.summary(), h = this.human;
    if (this.onEnd) this.onEnd({ result: r, summary, human: h ? summary[h.idx] : null, won: !!(h && r.winner && r.team === h.team), draw: !!r.draw, time: this.m.clock, quit: !!quit, match: this.m });
  }
  // ---- drawing ----
  draw(w, u) {
    const m = this.m, cam = Math.round(this.camX);
    this.ar.drawBack(w, cam);
    this.fr.drawAll(w, m, cam, { dt: 1 / 60 });
    this.ar.drawFront(w, cam);
    this.fx.draw(w, cam);
    const h = this.human;
    this.ar.drawLights(w, cam, h ? h.x : null);
    if (this.fx.ink > 0) { w.globalAlpha = Math.min(.55, this.fx.ink * .4); rect(w, '#14081e', 0, 0, VIEW_W, VIEW_H); w.globalAlpha = 1; }
    if (this.dark > .02) { w.globalAlpha = this.dark; rect(w, '#020208', 0, 0, VIEW_W, VIEW_H); w.globalAlpha = 1; const L = m.links.find(l => l.fin); if (L) for (const f of [L.a, L.v]) if (f) { rect(w, '#ffffff', Math.round(f.joints.x(J.head) - cam) + f.face * 3, Math.round(f.joints.y(J.head)) - 1, 2, 1); } }
    this.fx.drawLines(w, VIEW_W, VIEW_H);
    if (this.debug) this.drawDebug(w, cam);
    u.clearRect(0, 0, VIEW_W, VIEW_H);
    this.hud.draw(u, m, cam, { hide: m.phase === 'intro' && false });
    if (m.phase === 'intro') { drawText(u, `${this.game.input.label('confirm')} 건너뛰기`, 632, 346, { size: 11, align: 'r', color: UI.dim, outline: '#05060f' }); }
    if (this.paused) this.drawPause(u);
    if (this.resultShown) this.drawResult(u);
  }
  drawPause(u) {
    fade(u, .55);
    panel(u, 210, 70, 220, 220, { accent: '#ffd65a' });
    drawText(u, '일시정지', 320, 80, { align: 'c', color: '#ffd65a', bold: true });
    menuList(u, this.pauseItems(), this.sel, 228, 108, { w: 184, lh: 19 });
    drawText(u, '←→ 값 바꾸기  Enter 선택  Esc 닫기', 320, 272, { size: 11, align: 'c', color: UI.dim });
  }
  drawResult(u) {
    const m = this.m, r = m.result, h = this.human;
    fade(u, .62);
    const win = h && r && r.winner && r.team === h.team;
    panel(u, 130, 40, 380, 270, { accent: win ? '#ffd65a' : '#ff5b5b' });
    drawText(u, r.draw ? '무승부' : !h ? '경기 종료' : win ? '승리!' : '패배', 320, 52, { scale: 2, align: 'c', color: r.draw ? '#c9d4ff' : win || !h ? '#ffd65a' : '#ff5b5b', bold: true, outline: '#05060f' });
    drawText(u, `${HOW[r.how] || (r.forfeit ? '기권' : r.how || '')} · 경기 시간 ${fmtTime(m.clock)}`, 320, 84, { size: 11, align: 'c', color: UI.dim });
    if (r.winner) { u.fillStyle = '#05060f'; drawPortrait(u, r.winner.look, 'happy', 150, 104, 44, { px: 2, dy: 6 }); drawText(u, josa(r.winner.name, '이/가') + ' 이겼다', 204, 108, { color: '#ffffff' }); drawText(u, r.winner.char.lines.win, 204, 126, { size: 11, color: r.winner.char.color }); }
    if (h) {
      const S = m.summary()[h.idx];
      const rows = [['준 피해', S.dmgDealt.toFixed(0)], ['받은 피해', S.dmgTaken.toFixed(0)], ['다운 시킨 횟수', String(m.fighters.filter(f => f.isFoe(h)).reduce((s, f) => s + f.downs, 0))], ['다운 당한 횟수', String(S.downs)], ['사용한 기술 종류', String(S.moves)], ['반격·역전', String(S.counters)], ['패리', String(S.perfects)]];
      rows.forEach(([k, v], i) => { drawText(u, k, 160, 162 + i * 16, { size: 11, color: UI.dim }); drawText(u, v, 480, 162 + i * 16, { size: 11, align: 'r', color: '#ffffff' }); });
    }
    prompt(u, [this.game.input.label('confirm')], '계속', 320, 290, { align: 'c' });
  }
  drawDebug(g, cam) {
    const m = this.m;
    for (const f of m.fighters) {
      if (f.gone) continue;
      const hb = m.combat.hurtbox(f);
      g.strokeStyle = '#6be38a'; g.lineWidth = 1; g.strokeRect(Math.round(hb.x0 - cam) + .5, Math.round(hb.y0) + .5, Math.round(hb.x1 - hb.x0), Math.round(hb.y1 - hb.y0));
      const a = m.combat.hitbox(f);
      if (a) { g.strokeStyle = '#ff5b5b'; g.strokeRect(Math.round(a.x0 - cam) + .5, Math.round(a.y0) + .5, Math.round(a.x1 - a.x0), Math.round(a.y1 - a.y0)); }
      const x = Math.round(f.x - cam), y = Math.round(hb.y0 - 34);
      drawText(g, `${f.st}${f.hsKind && f.st === 'HITSTUN' ? ':' + f.hsKind : ''}`, x, y, { size: 11, align: 'c', color: '#ffffff', outline: '#05060f' });
      drawText(g, `HP${f.hp.toFixed(0)} ST${Math.max(0, f.stun).toFixed(0)} v${f.vx.toFixed(0)},${f.vy.toFixed(0)}`, x, y + 11, { size: 11, align: 'c', color: '#ffd65a', outline: '#05060f' });
      if (f.ai) drawText(g, `AI:${f.ai.note}`, x, y + 22, { size: 11, align: 'c', color: '#7fe0ff', outline: '#05060f' });
      rect(g, '#ff5fa2', x, Math.round(f.y), 1, 1);
    }
    drawText(g, `fps ${this.game.fps.toFixed(0)}  links ${m.links.length}  hype ${m.hype.toFixed(0)}  slow ${m.slowK.toFixed(2)}`, 6, 320, { size: 11, color: '#ffffff', outline: '#05060f' });
  }
}
const matchHow = HOW;
const balanceRef = B;

return { MatchScene, matchHow, balanceRef };
})();
// ---- scenes/SettingsScene.js
__m["scenes/SettingsScene.js"] = (function () {
// Settings: volumes, screen effects and key bindings (changes are saved).
const { drawText } = __m["render/pixelfont.js"];
const { UI } = __m["render/palette.js"];
const { panel, menuList, fade, keycap } = __m["render/ui.js"];
const { ACTIONS, DEFAULT_KEYS, keyLabel } = __m["core/InputManager.js"];
const { rect } = __m["render/painter.js"];
class SettingsOverlay {
  constructor(game) { this.game = game; this.sel = 0; this.page = 0; this.wait = null; }
  items() {
    const s = this.game.settings, pct = v => Math.round(v * 100) + '%';
    if (this.page === 0) return [
      { label: '전체 음량', value: pct(s.master), k: 'master', step: .1 }, { label: '음악', value: pct(s.music), k: 'music', step: .1 }, { label: '효과음', value: pct(s.sfx), k: 'sfx', step: .1 },
      { label: '화면 흔들림', value: pct(s.shake), k: 'shake', step: .25 }, { label: '번쩍임 효과', value: pct(s.flash), k: 'flash', step: .25 }, { label: '주사선 효과', value: s.scan ? '켬' : '끔', k: 'scan', toggle: 1 },
      { label: '대화 속도', value: ['느림', '보통', '빠름'][Math.round(s.typeSpeed * 2) - 1] || '보통', k: 'typeSpeed', list: [.5, 1, 1.5] },
      { label: '키 설정 →', act: () => { this.page = 1; this.sel = 0; } }, { label: '닫기', act: () => this.close() },
    ];
    const keys = this.game.input.keys;
    return [...Object.keys(ACTIONS).map(a => ({ label: ACTIONS[a], value: (keys[a] || []).map(keyLabel).join(' / '), bind: a })), { label: '기본값으로', act: () => { this.game.input.keys = JSON.parse(JSON.stringify(DEFAULT_KEYS)); this.game.saveSettings(); } }, { label: '← 돌아가기', act: () => { this.page = 0; this.sel = 0; } }];
  }
  close() { this.game.saveSettings(); this.game.applySettings(); this.game.audio.sfx('back'); this.game.pop(); }
  update() {
    const inp = this.game.input, A = this.game.audio, it = this.items(), s = this.game.settings;
    if (this.wait) return;
    if (inp.pressed('up')) { this.sel = (this.sel + it.length - 1) % it.length; A.sfx('ui'); }
    if (inp.pressed('down')) { this.sel = (this.sel + 1) % it.length; A.sfx('ui'); }
    const cur = it[this.sel];
    if (inp.menuPressed('cancel') && !this.wait) { if (this.page) { this.page = 0; this.sel = 0; A.sfx('back'); } else this.close(); return; }
    const d = inp.pressed('left') ? -1 : inp.pressed('right') ? 1 : 0;
    if (cur.k && (d || inp.menuPressed('confirm'))) {
      const dd = d || 1;
      if (cur.toggle) s[cur.k] = s[cur.k] ? 0 : 1;
      else if (cur.list) { const i = cur.list.indexOf(s[cur.k]); s[cur.k] = cur.list[(Math.max(0, i) + dd + cur.list.length) % cur.list.length]; }
      else s[cur.k] = Math.round(Math.min(1, Math.max(0, s[cur.k] + dd * cur.step)) * 100) / 100;
      this.game.applySettings(); A.sfx('ui');
      return;
    }
    if (inp.menuPressed('confirm')) {
      if (cur.act) { A.sfx('ok'); cur.act(); }
      else if (cur.bind) {
        this.wait = cur.bind; A.sfx('ok');
        inp.captureNext(code => {
          const a = this.wait; this.wait = null;
          if (code === 'Escape') return;
          const keys = this.game.input.keys;
          for (const k in keys) keys[k] = keys[k].filter(c => c !== code);
          keys[a] = [code, ...(keys[a] || [])].slice(0, 2);
          this.game.saveSettings(); A.sfx('good');
        });
      }
    }
  }
  draw(w, u) {
    fade(u, .72);
    panel(u, 130, 30, 380, 300, { accent: '#49d6ff' });
    drawText(u, this.page ? '키 설정' : '설정', 320, 40, { align: 'c', color: '#49d6ff', bold: true });
    menuList(u, this.items(), this.sel, 150, 66, { w: 340, lh: this.page ? 17 : 22, size: this.page ? 11 : 14 });
    if (this.wait) { rect(u, '#05060f', 200, 150, 240, 50); panel(u, 202, 152, 236, 46, { accent: '#ffd65a' }); drawText(u, `'${ACTIONS[this.wait]}'에 쓸 키를 누르세요`, 320, 162, { align: 'c', color: '#ffffff' }); drawText(u, 'Esc 취소', 320, 180, { size: 11, align: 'c', color: UI.dim }); }
    drawText(u, '←→ 값 바꾸기 · Enter 선택 · Esc 닫기', 320, 314, { size: 11, align: 'c', color: UI.dim });
    void keycap;
  }
}

return { SettingsOverlay };
})();
// ---- world/CareerManager.js
__m["world/CareerManager.js"] = (function () {
// Career state and rules: stats, money, fame, ranking, season calendar, contracts, injuries, saving.
const { RNG, clamp, deepClone, fmtMoney } = __m["core/util.js"];
const { Save } = __m["core/SaveManager.js"];
const { CHARACTERS, ROSTER_IDS } = __m["data/characters.js"];
const { BALANCE: B } = __m["data/balance.js"];
const { MOVES } = __m["data/moves.js"];
const SLOT_NAMES = ['오전', '오후', '저녁'];
const SEASON_DAYS = 28;
// Growth per trained level (levels go 0..20).
const STAT_GROWTH = { hp: [2.6, '최대 체력'], stun: [2.3, '최대 기절 저항'], atk: [.022, '기본 공격력'], grp: [.022, '레슬링 기술'], spd: [.012, '이동 속도'], jump: [.016, '점프력'], rec: [.02, '기술 회복'], down: [.02, '기절·다운 회복'], kbr: [.022, '넉백 저항'], fin: [.025, '피니셔 충전'] };
const STYLE_BASE = {
  all: { label: '올라운더', stats: { hp: 100, stun: 100, atk: 1, grp: 1, spd: 1, jump: 1, rec: 1, down: 1, fin: 1, weight: 94, lift: 1.3, kbr: 1 }, chain: ['jab', 'cross', 'hook'], run: 'lariat', air: 'dropkick', dive: 'diveElbow', stance: 'std', finisher: 'dawn', moves: { front: { n: 'bodySlam', f: 'irishWhip', b: 'suplex', u: 'powerbomb', d: 'ddt' }, rear: { n: 'german', f: 'ringOut', b: 'backdropDriver', u: 'atomic', d: 'bulldog' }, catch: 'backBody', counter: 'hipToss' }, build: 'athletic' },
  power: { label: '파워하우스', stats: { hp: 112, stun: 104, atk: 1.06, grp: 1.08, spd: .92, jump: .9, rec: .96, down: .96, fin: .96, weight: 116, lift: 1.9, kbr: 1.15 }, chain: ['palm', 'elbow', 'overhand'], run: 'shoulder', air: 'flyingElbow', dive: 'diveSplash', stance: 'power', finisher: 'container', moves: { front: { n: 'bodySlam', f: 'irishWhip', b: 'backbreaker', u: 'powerbomb', d: 'chokeslam' }, rear: { n: 'german', f: 'ringOut', b: 'giantSwing', u: 'atomic', d: 'backdropDriver' }, catch: 'spinebuster', counter: 'hipToss' }, build: 'power' },
  air: { label: '하이플라이어', stats: { hp: 88, stun: 94, atk: .95, grp: .94, spd: 1.14, jump: 1.24, rec: 1.08, down: 1.08, fin: 1.1, weight: 74, lift: 1, kbr: .85 }, chain: ['lowkick', 'midkick', 'spinkick'], run: 'flyKnee', air: 'dropkick', dive: 'diveMoon', stance: 'air', finisher: 'typhoon', moves: { front: { n: 'headDrop', f: 'irishWhip', b: 'suplex', u: 'bellyToBelly', d: 'ddt' }, rear: { n: 'bulldog', f: 'ringOut', b: 'backdropDriver', u: 'atomic', d: 'german' }, catch: 'backBody', counter: 'armDrag' }, build: 'lean' },
  tech: { label: '테크니션', stats: { hp: 96, stun: 100, atk: .96, grp: 1.14, spd: 1.02, jump: 1, rec: 1.14, down: 1.04, fin: 1.04, weight: 92, lift: 1.5, kbr: 1 }, chain: ['jab', 'elbow', 'knee'], run: 'bigboot', air: 'dropkick', dive: 'diveElbow', stance: 'tech', finisher: 'anchor', moves: { front: { n: 'suplex', f: 'irishWhip', b: 'bellyToBelly', u: 'backbreaker', d: 'ddt' }, rear: { n: 'german', f: 'ringOut', b: 'anchorHold', u: 'backdropDriver', d: 'atomic' }, catch: 'spinebuster', counter: 'armDrag' }, build: 'athletic' },
  brawl: { label: '브롤러', stats: { hp: 104, stun: 108, atk: 1.14, grp: .95, spd: .99, jump: .96, rec: 1, down: 1, fin: 1, weight: 102, lift: 1.4, kbr: 1.06 }, chain: ['jab', 'cross', 'uppercut'], run: 'lariat', air: 'flyingElbow', dive: 'diveElbow', stance: 'box', finisher: 'weld', moves: { front: { n: 'bodySlam', f: 'irishWhip', b: 'cornerSmash', u: 'slapFest', d: 'ddt' }, rear: { n: 'backdropDriver', f: 'ringOut', b: 'german', u: 'atomic', d: 'bulldog' }, catch: 'spinebuster', counter: 'hipToss' }, build: 'athletic' },
  heavy: { label: '슈퍼 헤비급', stats: { hp: 130, stun: 118, atk: 1.04, grp: 1.02, spd: .82, jump: .76, rec: .9, down: .92, fin: .95, weight: 156, lift: 1.8, kbr: 1.6 }, chain: ['sumoPush', 'sumoPush', 'belly'], run: 'bodyBlock', air: 'buttDrop', dive: 'diveQuake', stance: 'heavy', finisher: 'tsunami', moves: { front: { n: 'bodySlam', f: 'irishWhip', b: 'cornerSmash', u: 'airplane', d: 'gutBuster' }, rear: { n: 'backdropDriver', f: 'ringOut', b: 'giantSwing', u: 'atomic', d: 'bulldog' }, catch: 'spinebuster', counter: 'hipToss' }, build: 'heavy' },
};
// Moves a trainer or rival can teach. cost in won, fame needed.
const LEARNABLE = [
  { id: 'backbreaker', cost: 30000, fame: 5, by: 'trainer' }, { id: 'bellyToBelly', cost: 30000, fame: 5, by: 'trainer' }, { id: 'atomic', cost: 25000, fame: 0, by: 'trainer' },
  { id: 'piledriver', cost: 60000, fame: 25, by: 'trainer' }, { id: 'chokeslam', cost: 70000, fame: 30, by: 'trainer' }, { id: 'giantSwing', cost: 55000, fame: 20, by: 'trainer' },
  { id: 'airplane', cost: 65000, fame: 35, by: 'rival' }, { id: 'gutBuster', cost: 50000, fame: 30, by: 'rival' }, { id: 'headDrop', cost: 45000, fame: 20, by: 'rival' }, { id: 'anchorHold', cost: 50000, fame: 25, by: 'rival' }, { id: 'slapFest', cost: 40000, fame: 15, by: 'rival' }, { id: 'cornerSmash', cost: 35000, fame: 10, by: 'trainer' }, { id: 'spinebuster', cost: 45000, fame: 20, by: 'rival' },
];
const SHOP_ITEMS = [
  { id: 'bandage', name: '붕대', price: 12000, desc: '부상 게이지 -7. 언제든 사용할 수 있다.', kind: 'item', inj: 7 },
  { id: 'bigBandage', name: '고급 압박 붕대', price: 30000, desc: '부상 게이지 -18.', kind: 'item', inj: 18 },
  { id: 'drink', name: '이온 음료', price: 4000, desc: '피로 -20.', kind: 'item', fat: 20 },
  { id: 'wristTape', name: '손목 테이프', price: 36000, desc: '레슬링 기술 +3%. 장비.', kind: 'gear', slot: 'wrist', mod: { grp: .03 } },
  { id: 'kneePads', name: '무릎 보호대', price: 42000, desc: '넉백 저항 +5%, 다운 회복 +3%.', kind: 'gear', slot: 'knee', mod: { kbr: .05, down: .03 } },
  { id: 'mouthguard', name: '마우스피스', price: 30000, desc: '최대 기절 저항 +6.', kind: 'gear', slot: 'mouth', mod: { stun: 6 } },
  { id: 'proBoots', name: '프로 부츠', price: 55000, desc: '이동 속도 +3%, 점프력 +3%.', kind: 'gear', slot: 'boots', mod: { spd: .03, jump: .03 } },
  { id: 'luckyCharm', name: '등대 부적', price: 48000, desc: '피니셔 충전 +5%.', kind: 'gear', slot: 'charm', mod: { fin: .05 } },
  { id: 'outfitGold', name: '금빛 타이츠', price: 40000, desc: '의상: 금색과 검정.', kind: 'outfit', look: { bottom: { kind: 'tights', c1: '#1c1424', c2: '#ffd65a', pat: 'flame' }, boots: { c1: '#ffd65a', c2: '#1c1424', h: .78 } } },
  { id: 'outfitSea', name: '파도 트렁크', price: 30000, desc: '의상: 청록 파도무늬.', kind: 'outfit', look: { bottom: { kind: 'trunks', c1: '#1f8fa6', c2: '#e6f6ff', pat: 'bands' }, boots: { c1: '#e6f6ff', c2: '#1f8fa6', h: .7 } } },
  { id: 'outfitNeon', name: '네온 싱글렛', price: 50000, desc: '의상: 분홍 네온 싱글렛.', kind: 'outfit', look: { top: { kind: 'singlet', c1: '#ff4fa3', c2: '#23d5c8' }, bottom: { kind: 'shorts', c1: '#ff4fa3', c2: '#23d5c8', pat: 'side' } } },
  { id: 'maskWave', name: '파도 마스크', price: 60000, desc: '의상: 파도 무늬 복면.', kind: 'outfit', mask: { full: 1, kind: 'wave', c1: '#1f6f7a', c2: '#e6f6ff', c3: '#ffd65a' } },
  { id: 'headband', name: '머리띠', price: 15000, desc: '의상: 붉은 머리띠.', kind: 'outfit', hat: 'band', hatCol: '#d23b5a' },
  { id: 'jacket', name: '입장용 망토', price: 45000, desc: '의상: 입장할 때 휘날리는 망토.', kind: 'outfit', cape: { c1: '#3a59b8', len: 1 } },
];

function hasCareer(slot) { return !!Save.get('career' + slot); }

class Career {
  static create(slot, setup) {
    const c = new Career();
    const S = STYLE_BASE[setup.style] || STYLE_BASE.all;
    Object.assign(c.d, {
      slot, name: setup.name || '신인', style: setup.style || 'all', look: setup.look, created: Date.now(),
      lv: { hp: 0, stun: 0, atk: 0, grp: 0, spd: 0, jump: 0, rec: 0, down: 0, kbr: 0, fin: 0 },
      moves: deepClone(S.moves), known: Array.from(new Set(Object.values(S.moves.front).concat(Object.values(S.moves.rear), [S.moves.catch, S.moves.counter]))), finisher: S.finisher,
    });
    c.d.league = c.newLeague(1);
    c.save(true);
    return c;
  }
  static load(slot) { const d = Save.get('career' + slot); if (!d) return null; const c = new Career(); Object.assign(c.d, d); c.migrate(); return c; }
  static loadCheckpoint(slot) { const d = Save.get('career' + slot + '.chk'); if (!d) return null; const c = new Career(); Object.assign(c.d, d); c.migrate(); return c; }
  constructor() {
    this.d = {
      v: 1, slot: 1, name: '신인', style: 'all', look: null, money: 60000, fame: 0, xp: 0, level: 1, points: 0, injury: 0, fatigue: 0,
      record: { w: 0, l: 0, d: 0, ko: 0, pin: 0, streak: 0, official: 0 }, season: 1, day: 1, slot: 0, contract: null, offers: [], offersDay: 0,
      items: { bandage: 1, drink: 1 }, gear: {}, owned: [], outfit: null, flags: {}, npc: {}, h2h: {}, league: [], titles: [], history: [], loc: 'lobby', x: 240,
      seasonLog: { w: 0, l: 0, earned: 0, startLv: null, startRank: null, matches: [] }, earnedTotal: 0, lastResult: null, retired: false, events: {},
    };
  }
  migrate() { this.d.items = this.d.items || {}; this.d.gear = this.d.gear || {}; this.d.npc = this.d.npc || {}; this.d.events = this.d.events || {}; }
  save(checkpoint) {
    Save.set('career' + this.d.slot, this.d);
    if (checkpoint) Save.set('career' + this.d.slot + '.chk', this.d);
  }
  // ---- league ----
  newLeague(season) {
    const base = ['baekpa', 'bjorn', 'taesan', 'neon', 'baeksang', 'mandeok', 'haneul', 'dongsu', 'dohyun', 'dueok', 'palcho', 'bokja'];
    if (season >= 2) base.splice(3, 0, 'ironma', 'gosu');
    return base.map((id, i) => ({ id, pts: (base.length - i) * 10, w: 0, l: 0 }));
  }
  get champion() { return this.d.flags.champion ? 'player' : 'fogking'; }
  // Player rank: position among the league plus the player (1 = top contender).
  rankList() {
    const L = this.d.league.slice();
    const me = { id: 'player', pts: this.d.flags.rankPts || 0, w: this.d.record.w, l: this.d.record.l };
    L.push(me);
    L.sort((a, b) => b.pts - a.pts || (a.id === 'player' ? 1 : -1));
    return L;
  }
  get rank() { return this.rankList().findIndex(e => e.id === 'player') + 1; }
  rankOf(id) { return this.rankList().findIndex(e => e.id === id) + 1; }
  // ---- stats ----
  get stats() {
    const S = STYLE_BASE[this.d.style] || STYLE_BASE.all, b = Object.assign({}, S.stats), L = this.d.lv;
    b.hp += L.hp * STAT_GROWTH.hp[0]; b.stun += L.stun * STAT_GROWTH.stun[0];
    for (const k of ['atk', 'grp', 'spd', 'jump', 'rec', 'down', 'kbr', 'fin']) b[k] *= 1 + L[k] * STAT_GROWTH[k][0];
    for (const slot in this.d.gear) { const it = SHOP_ITEMS.find(i => i.id === this.d.gear[slot]); if (it && it.mod) for (const k in it.mod) { if (k === 'stun' || k === 'hp') b[k] += it.mod[k]; else b[k] *= 1 + it.mod[k]; } }
    b.lift *= 1 + L.grp * .015 + L.hp * .008;
    return b;
  }
  get styleDef() { return STYLE_BASE[this.d.style] || STYLE_BASE.all; }
  look() {
    const L = deepClone(this.d.look);
    const o = this.d.outfit;
    if (o) for (const id of o) { const it = SHOP_ITEMS.find(i => i.id === id); if (!it) continue; if (it.look) Object.assign(L, deepClone(it.look)); if (it.mask) L.head.mask = deepClone(it.mask); if (it.hat) { L.head.hat = it.hat; L.head.hatCol = it.hatCol; } if (it.cape) L.cape = deepClone(it.cape); }
    return L;
  }
  // Fighter options for a match.
  entrant(ctrl = 'human') {
    const S = this.styleDef, st = this.stats, fat = this.d.fatigue;
    return { char: Object.assign({}, CHARACTERS.rookie, { id: 'player', name: this.d.name, nick: S.label, style: this.d.style, look: this.look(), stance: S.stance, stats: st, chain: S.chain, run: S.run, air: S.air, dive: S.dive, ground: 'stomp', moves: this.d.moves, finisher: this.d.finisher, color: '#3fe0d0', lines: { win: '해냈다!', lose: '다음엔…', intro: '시작이다.' } }), ctrl, name: this.d.name, stats: st, hpStart: fat > 70 ? .9 : 1, fin: this.d.flags.pajeon ? 20 : fat < 20 ? 10 : 0 };
  }
  // ---- time ----
  get timeText() { return `시즌 ${this.d.season} · ${this.d.day}일차 ${SLOT_NAMES[this.d.slot]}`; }
  spendSlot(n = 1) {
    const d = this.d;
    d.slot += n;
    const msgs = [];
    while (d.slot > 2) { d.slot -= 3; msgs.push(...this.nextDay(true)); }
    return msgs;
  }
  sleep() { const d = this.d; d.slot = 0; const m = this.nextDay(false); d.fatigue = Math.max(0, d.fatigue - 70); this.save(true); return m; }
  nextDay(forced) {
    const d = this.d, msgs = [];
    // contract deadline passed without a match
    if (d.contract && d.day >= d.contract.day) { msgs.push(`${d.contract.oppName}와의 계약 경기에 나가지 않았다. 명성 -6, 기권패 처리.`); d.fame = Math.max(0, d.fame - 6); d.record.l++; d.record.streak = 0; d.contract = null; d.flags.noShow = (d.flags.noShow || 0) + 1; }
    d.day++;
    if (forced) d.fatigue = Math.min(100, d.fatigue + 10);
    if (d.day > SEASON_DAYS) { d.flags.seasonEnd = true; }
    // league simulation: others win and lose too
    const r = new RNG(d.season * 100 + d.day);
    for (const e of d.league) { if (r.chance(.35)) { const up = r.chance(.5 + (CHARACTERS[e.id].stats.hp - 100) / 400); e.pts += up ? 4 : -2; up ? e.w++ : e.l++; } }
    return msgs;
  }
  // ---- injuries ----
  get injuryLevel() { const i = this.d.injury; return i >= B.injuryDanger ? 'danger' : i >= B.injuryWarn ? 'warn' : 'ok'; }
  healInjury(pts) { const before = this.d.injury; this.d.injury = Math.max(0, this.d.injury - pts); return before - this.d.injury; }
  // ---- economy ----
  canPay(n) { return this.d.money >= n; }
  pay(n) { if (this.d.money < n) return false; this.d.money -= n; return true; }
  earn(n) { this.d.money += n; this.d.earnedTotal += n; this.d.seasonLog.earned += n; }
  xpNeed() { return 80 + this.d.level * 40; }
  addXp(n) {
    const d = this.d, ups = [];
    d.xp += n;
    while (d.xp >= this.xpNeed()) { d.xp -= this.xpNeed(); d.level++; d.points += 2; ups.push(d.level); }
    return ups;
  }
  // ---- offers ----
  makeOffers() {
    const d = this.d, r = new RNG(d.season * 1000 + d.day * 7 + d.record.w * 3);
    const ranks = this.rankList(), me = this.rank, out = [];
    const others = ranks.filter(e => e.id !== 'player');
    const pick = off => { const i = me - 1 + off, j = i > me - 1 ? i - 1 : i; return others[clamp(j, 0, others.length - 1)]; };
    const lvl = rk => (d.season >= 2 ? ['normal', 'hard', 'hard', 'expert'] : ['easy', 'normal', 'normal', 'hard'])[clamp(Math.floor((14 - rk) / 4), 0, 3)];
    const mk = (opp, kind, extra = {}) => {
      const rk = this.rankOf(opp.id), c = CHARACTERS[opp.id];
      const reward = Math.round((22000 + (15 - rk) * 5200) * (kind === 'challenge' ? 1.4 : 1) * (1 + (d.season - 1) * .3) / 1000) * 1000;
      return Object.assign({ opp: opp.id, oppName: c.name, mode: 'single', arena: 'hall', reward, fame: kind === 'challenge' ? 9 : 6, kind, day: d.day + 1 + r.int(0, 2), difficulty: lvl(rk), rank: rk, desc: '' }, extra);
    };
    out.push(mk(pick(-1), 'normal', { desc: '바로 위 순위. 이기면 순위를 빼앗는다.' }));
    let ch = pick(r.chance(.5) ? -3 : -2);
    if (out.some(o => o.opp === ch.id)) ch = pick(-4);
    out.push(mk(ch, 'challenge', { desc: '한참 위 순위. 위험하지만 보수와 명성이 크다.' }));
    let third = pick(r.int(0, 2));
    for (let k = 1; k < 6 && out.some(o => o.opp === third.id); k++) third = pick(k % 2 ? k : -k - 1);
    out.push(mk(third, 'stip', r.chance(.5) ? { mode: 'pin', desc: '핀폴 매치. 체력 0으로는 끝나지 않는다. 눌러야 이긴다.' } : { arena: 'pier', desc: '부두 특설 링. 관중 앞 야외 경기.' }));
    // events
    if (d.day >= 10 && d.day <= 14 && !d.events['rumble' + d.season]) out.unshift({ opp: 'rumble', oppName: '만선 럼블', mode: 'rumble', arena: 'hall', reward: 90000 + d.season * 30000, fame: 22, kind: 'event', day: 14, difficulty: d.season >= 2 ? 'hard' : 'normal', desc: '10인 로얄럼블. 21초마다 새 선수가 들어온다. 톱로프 너머로 떨어지면 탈락.', event: 'rumble' + d.season });
    if (d.day >= 18 && d.day <= 21 && !d.events['tag' + d.season]) out.unshift({ opp: 'tag', oppName: '항구 태그 대전', mode: 'tag', arena: 'pier', reward: 70000 + d.season * 20000, fame: 15, kind: 'event', day: 21, difficulty: d.season >= 2 ? 'hard' : 'normal', desc: '2대2 태그 매치. 파트너는 서도현.', event: 'tag' + d.season });
    if (me === 1 && d.fame >= 55 && !d.flags.champion) out.unshift({ opp: 'fogking', oppName: '안개왕', mode: 'single', arena: 'dome', reward: 300000, fame: 40, kind: 'title', day: d.day + 2, difficulty: d.season >= 2 ? 'expert' : 'hard', rank: 0, desc: '챔피언 타이틀 매치. 등대 돔에서 열린다.', title: 1 });
    d.offers = out.slice(0, 4); d.offersDay = d.day;
    return d.offers;
  }
  accept(o) { this.d.contract = deepClone(o); this.d.offers = []; this.save(); }
  // ---- after a match ----
  applyResult(kind, res, info = {}) {
    const d = this.d, h = res.human, won = res.won, draw = res.draw;
    const out = { lines: [], money: 0, fame: 0, xp: 0, injury: 0, ups: [], rankBefore: this.rank, rankAfter: 0 };
    // injuries: proportional to damage actually taken, never from practice
    if (kind !== 'practice' && h) {
      const maxHp = this.stats.hp;
      let inj = (h.dmgTaken / maxHp) * B.injuryPerBar + (h.ko ? B.injuryKO : 0) + h.finishersTaken * B.injuryFinisher + (h.ringOuts ? B.injuryRingOut : 0);
      inj *= 1 + d.fatigue / 250;
      inj = Math.round(inj * 10) / 10;
      d.injury = Math.min(100, d.injury + inj); out.injury = inj;
    }
    if (kind !== 'practice') d.flags.pajeon = 0;
    if (kind === 'practice') { out.lines.push('연습 경기는 기록에 남지 않는다.'); d.fatigue = Math.min(100, d.fatigue + 8); return out; }
    d.fatigue = Math.min(100, d.fatigue + (kind === 'official' || kind === 'event' || kind === 'title' ? 24 : 16));
    const c = d.contract && kind !== 'free' ? d.contract : info.offer;
    if (draw) d.record.d++;
    else if (won) { d.record.w++; d.record.streak = Math.max(1, d.record.streak + 1); d.seasonLog.w++; if (res.result.how === 'ko') d.record.ko++; if (res.result.how === 'pin') d.record.pin++; }
    else { d.record.l++; d.record.streak = Math.min(-1, d.record.streak - 1); d.seasonLog.l++; }
    let money = 0, fame = 0, xp = won ? 60 : draw ? 35 : 25;
    if (c) {
      money = won ? c.reward : Math.round(c.reward * (draw ? .5 : .25) / 1000) * 1000;
      fame = won ? c.fame : draw ? 2 : 1;
      if (res.result.forfeit) { money = 0; fame = -3; }
      xp += won ? 20 + (c.kind === 'challenge' ? 30 : 0) : 0;
      if (c.opp && CHARACTERS[c.opp]) { const r = d.h2h[c.opp] || { w: 0, l: 0 }; won ? r.w++ : draw ? 0 : r.l++; d.h2h[c.opp] = r; }
      // ranking points
      if (kind === 'official' || kind === 'title') {
        d.record.official++;
        const opp = d.league.find(e => e.id === c.opp);
        const myPts = d.flags.rankPts || 0;
        if (won && opp && opp.pts >= myPts) { const gain = opp.pts - myPts + 3; d.flags.rankPts = myPts + gain; opp.pts -= 4; opp.l++; }
        else if (won) d.flags.rankPts = myPts + 3;
        else if (opp) { d.flags.rankPts = Math.max(0, myPts - 3); opp.pts += 3; opp.w++; }
        if (c.title && won) { d.flags.champion = true; d.titles.push({ name: '야항 헤비급 챔피언', season: d.season, day: d.day }); out.lines.push('새 챔피언이 탄생했다!'); }
      }
      if (c.event) { d.events[c.event] = won ? 'win' : 'done'; }
      if (kind !== 'free') d.contract = null;
    } else { money = won ? 15000 + d.season * 5000 : 3000; fame = won ? 2 : 0; xp = won ? 35 : 18; }
    if (h) { xp += Math.min(30, (h.moves || 0) * 4) + (h.counters || 0) * 3; }
    if (fame > 0 && d.record.streak >= 3) { fame += 2; out.lines.push(`${d.record.streak}연승! 명성 보너스 +2`); }
    d.fame = clamp(d.fame + fame, 0, 999);
    this.earn(Math.max(0, money));
    out.money = money; out.fame = fame; out.xp = xp;
    out.ups = this.addXp(xp);
    out.rankAfter = this.rank;
    d.lastResult = { won, draw, opp: c ? c.oppName : '', kind, how: res.result.how, day: d.day, inj: out.injury, rank: out.rankAfter, oppId: c ? c.opp : null };
    d.history.push(d.lastResult); if (d.history.length > 40) d.history.shift();
    d.seasonLog.matches.push(d.lastResult);
    this.save();
    return out;
  }
  // Rival relationship with 서도현.
  rel(id, v) { const n = this.d.npc[id] || (this.d.npc[id] = { talks: 0, rel: 0, seen: 0 }); if (v) n.rel = clamp(n.rel + v, -10, 10); return n; }
  money() { return fmtMoney(this.d.money); }
  learnable(by) { return LEARNABLE.filter(l => l.by === by && !this.d.known.includes(l.id)); }
  learn(id) { if (!this.d.known.includes(id)) this.d.known.push(id); }
  equipMove(pos, slot, id) { if (MOVES[id] && this.d.known.includes(id)) this.d.moves[pos][slot] = id; }
}

return { SLOT_NAMES, SEASON_DAYS, STAT_GROWTH, STYLE_BASE, LEARNABLE, SHOP_ITEMS, hasCareer, Career };
})();
// ---- world/locations.js
__m["world/locations.js"] = (function () {
// The town: every place is data (size, doors, things to use, who stands where) plus a painter for its backdrop.
const { RNG } = __m["core/util.js"];
const { rampHex, shade, mixHex } = __m["render/palette.js"];
const { drawText } = __m["render/pixelfont.js"];
const { canvas, rect, bands, dither, line, ellipse, poly, neon, truss, lamp, poster, brick, planks, tiles, windowPane, box, shelf, sofa, door, board, frameArt, trophy, plant, wave } = __m["render/painter.js"];
const FLOOR = 300;
// Sky colours by time of day for windows and the street.
const SKY = [
  ['#7fb8e8', '#9fcbef', '#c3def5', '#e7f0f7'],
  ['#e88a5a', '#f0a86a', '#f6c98a', '#fbe3b0'],
  ['#0b1230', '#141c44', '#1f2656', '#352f6a'],
];
function cityStrip(seed, w, h) {
  const [c, g] = canvas(w, h), r = new RNG(seed);
  for (let x = 0; x < w; x += 5 + (r.next() * 9 | 0)) { const bh = 8 + r.next() * h * .7, bw = 5 + (r.next() * 8 | 0); rect(g, '#141a33', x, h - bh, bw, bh); for (let k = 0; k < 5; k++) if (r.next() < .55) rect(g, r.next() < .5 ? '#ffd27a' : '#7fe0ff', x + 1 + (r.next() * (bw - 2) | 0), h - bh + 2 + (r.next() * (bh - 3) | 0), 1, 1); }
  return c;
}
const CITY = { strip: null };
function drawWindows(g, loc, camX, slot) {
  if (!loc.windows) return;
  if (!CITY.strip) CITY.strip = cityStrip(4, 260, 60);
  for (const [x, y, w, h] of loc.windows) {
    const sx = Math.round(x - camX);
    if (sx > 640 || sx + w < 0) continue;
    bands(g, sx, y, w, h, SKY[slot]);
    g.save(); g.beginPath(); g.rect(sx, y, w, h); g.clip();
    if (loc.sea) { rect(g, slot === 2 ? '#141c44' : '#3a6aa8', sx, y + h * .62, w, h * .38); for (let i = 0; i < w; i += 7) rect(g, slot === 2 ? '#ff8fc4' : '#e6f6ff', sx + i + ((x * 3) % 7), y + h * .7 + (i % 3) * 3, 3, 1); }
    g.globalAlpha = slot === 2 ? 1 : .7; g.drawImage(CITY.strip, (x * 7) % 200, 0, w, 60, sx, y + h - Math.min(h, 40), w, Math.min(h, 40)); g.globalAlpha = 1;
    if (slot === 0) rect(g, 'rgba(255,255,255,.18)', sx + 3, y + 3, 3, h - 6);
    g.restore();
    rect(g, '#2a2f4a', sx + w / 2 - 1, y, 2, h); rect(g, '#2a2f4a', sx, y + h / 2 - 1, w, 2);
  }
}

// ---- backdrops ----------------------------------------------------------------------------------
function wallBase(g, W, top, wall, wain, floor, o = {}) {
  bands(g, 0, 0, W, top, o.ceil || ['#0a0d1c', '#0e1226', '#121730']);
  const R = rampHex(wall);
  rect(g, R[2], 0, top, W, FLOOR - top);
  dither(g, 0, top, W, FLOOR - top, R[1], .12, W);
  rect(g, R[1], 0, top, W, 3); rect(g, R[3], 0, top + 3, W, 1);
  if (wain) { const Q = rampHex(wain); rect(g, Q[2], 0, FLOOR - 52, W, 52); rect(g, Q[3], 0, FLOOR - 52, W, 2); rect(g, Q[1], 0, FLOOR - 4, W, 4); for (let x = 0; x < W; x += 40) rect(g, Q[1], x, FLOOR - 50, 1, 46); }
  const F = rampHex(floor);
  if (o.planks) planks(g, 0, FLOOR, W, 60, floor, { ph: 6 }); else if (o.tiles) tiles(g, 0, FLOOR, W, 60, F[2], F[1], 10); else { rect(g, F[2], 0, FLOOR, W, 60); for (let y = FLOOR + 6; y < 360; y += 9) rect(g, F[1], 0, y, W, 1); }
  rect(g, '#05060f', 0, FLOOR, W, 2); rect(g, F[3], 0, FLOOR + 2, W, 1);
}
const PAINT = {
  lobby(g, L) {
    const W = L.w;
    wallBase(g, W, 40, '#2f3a5e', '#5a3a3a', '#3a3046', { tiles: 1 });
    for (let x = 0; x < W; x += 150) truss(g, x, 14, 150, '#2a3256');
    L.windows = [[150, 70, 60, 70], [960, 70, 60, 70]];
    for (const [x, y, w, h] of L.windows) { rect(g, '#120c1e', x - 3, y - 3, w + 6, h + 6); g.clearRect(x, y, w, h); }
    neon(g, '야항 체육관', 560, 50, '#ff5fa2', { scale: 2, align: 'c' });
    drawText(g, '로비 · 휴게실', 560, 82, { size: 11, align: 'c', color: '#49d6ff' });
    // posters of the roster
    [['안개왕', '#4a5078'], ['강태산', '#c25a20'], ['윤하늘', '#2a7fc4'], ['네온 제이', '#c2337a'], ['비에른', '#8a6a3c']].forEach(([n, c], i) => poster(g, 250 + i * 46, 104, 36, 50, c, n.slice(0, 3), { figure: 1, top: i === 0 ? '챔피언' : '' }));
    // trophy case
    rect(g, '#120c1e', 40, 160, 70, 92); rect(g, '#2a2440', 42, 162, 66, 88); rect(g, 'rgba(150,200,255,.12)', 44, 164, 62, 84); for (const [x, y] of [[56, 196], [76, 196], [94, 196], [66, 236], [88, 236]]) trophy(g, x, y, x % 2 ? '#e6e9f2' : '#ffd65a'); rect(g, '#4a3a5a', 42, 198, 66, 2); rect(g, '#4a3a5a', 42, 238, 66, 2);
    // vending machine
    box(g, 630, 196, 34, 104, '#c2333f'); rect(g, '#120c1e', 634, 202, 20, 54); for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) rect(g, ['#49d6ff', '#ffd65a', '#6be38a'][i], 637 + k * 9, 206 + i * 16, 6, 10); rect(g, '#ffd65a', 656, 240, 5, 8); drawText(g, '음료', 647, 262, { size: 11, align: 'c', color: '#ffe6e6' });
    // boards
    board(g, 690, 150, 88, 74, '경기 일정', ['오늘의 대진', '계약 확인', '이벤트 공지']);
    board(g, 790, 150, 88, 74, '선수 랭킹', ['1~13위', '챔피언', '안개왕'], { bg: '#22304a' });
    // sofa and lounge
    rect(g, '#3a2a40', 880, 290, 170, 10);
    sofa(g, 900, 300, 92, '#3a6a8c'); plant(g, 1010, 300, {}); plant(g, 870, 300, { leaf: '#5aa06a' });
    rect(g, '#5a3a2a', 920, 262, 40, 4); rect(g, '#3a2418', 924, 266, 4, 20); rect(g, '#3a2418', 952, 266, 4, 20);
    // reception desk
    rect(g, '#120c1e', 404, 236, 92, 66); rect(g, '#6a4a3a', 406, 238, 88, 62); rect(g, '#8a6a4a', 406, 238, 88, 4); drawText(g, '안내', 450, 254, { size: 11, align: 'c', color: '#ffe9a8' });
    // doors
    door(g, 64, 196, 34, 104, '#3a4a6a', { sign: '정문', glass: 1 });
    door(g, 320, 196, 34, 104, '#6a3a2a', { sign: '사장실' });
    door(g, 1092, 196, 40, 104, '#2a2a3a', { sign: '경기장', signCol: '#7a1f3a' });
    door(g, 564, 196, 36, 104, '#2a4a3a', { sign: '훈련장' });
    lamp(g, 200, 40, '#ffcf7a', { len: 18 }); lamp(g, 560, 40, '#ffcf7a', { len: 10 }); lamp(g, 940, 40, '#ffcf7a', { len: 18 });
  },
  office(g, L) {
    const W = L.w;
    wallBase(g, W, 36, '#3b3048', '#4a2e2a', '#5a3a30', { planks: 1 });
    // ship-cabin panels and portholes
    for (let x = 0; x < W; x += 52) rect(g, '#33283e', x, 36, 2, FLOOR - 88);
    L.windows = [[150, 80, 40, 40], [450, 80, 40, 40]]; L.sea = 1;
    for (const [x, y, w] of L.windows) { ellipse(g, '#120c1e', x + w / 2, y + w / 2, w / 2 + 5, w / 2 + 5); ellipse(g, '#c9a25a', x + w / 2, y + w / 2, w / 2 + 3, w / 2 + 3); ellipse(g, '#8a6a3c', x + w / 2, y + w / 2, w / 2 + 1, w / 2 + 1); g.save(); g.globalCompositeOperation = 'destination-out'; ellipse(g, '#000', x + w / 2, y + w / 2, w / 2 - 1, w / 2 - 1); g.restore(); }
    frameArt(g, 286, 70, 64, 46, () => { bands(g, 286, 70, 64, 46, ['#1b2a5c', '#30407a', '#5b4a8a']); poly(g, '#e6e9f2', [[300, 104], [336, 104], [330, 110], [306, 110]]); rect(g, '#e6e9f2', 316, 82, 2, 22); poly(g, '#f2efe4', [[318, 82], [332, 98], [318, 98]]); });
    drawText(g, '구만석 사장실', 318, 44, { size: 11, align: 'c', color: '#ffe9a8' });
    // trophy shelf
    shelf(g, 40, 150, 70, 3, '#5a3a2a', ['#ffd65a', '#e6e9f2', '#c98a2e']);
    // rank and schedule boards
    board(g, 214, 150, 66, 60, '랭킹', ['안개왕', '1. 백파', '2. 비에른']);
    board(g, 520, 150, 80, 60, '이번 주', ['계약 경기', '럼블 14일', '태그 21일'], { bg: '#22304a' });
    // desk and model ship
    rect(g, '#120c1e', 330, 236, 140, 66); rect(g, '#7a4a2a', 332, 238, 136, 62); rect(g, '#9a6a3a', 332, 238, 136, 5); rect(g, '#5a3420', 340, 250, 120, 44);
    rect(g, '#e6e9f2', 344, 226, 16, 12); rect(g, '#2d63b8', 346, 228, 12, 2); rect(g, '#ffd65a', 446, 230, 10, 8);
    poly(g, '#8a5a34', [[380, 236], [420, 236], [414, 230], [386, 230]]); rect(g, '#d8cfb8', 398, 212, 2, 18); poly(g, '#f2efe4', [[400, 212], [414, 226], [400, 226]]);
    // aquarium and sofa
    rect(g, '#120c1e', 560, 220, 56, 40); rect(g, '#1f6f8c', 562, 222, 52, 36); rect(g, '#2a8fa6', 562, 222, 52, 6); rect(g, '#5a3a2a', 556, 260, 64, 40); for (const [x, y, c] of [[574, 236, '#ff8a2b'], [596, 244, '#ffd65a'], [588, 230, '#ff5fa2']]) { ellipse(g, c, x, y, 3, 2); rect(g, c, x - 5, y - 1, 2, 3); }
    sofa(g, 100, 300, 90, '#2f6a4a');
    lamp(g, 400, 36, '#ffcf7a', { len: 26 });
  },
  gym(g, L) {
    const W = L.w;
    wallBase(g, W, 40, '#5a4048', '#3a3a52', '#8a6a4a', { planks: 1 });
    brick(g, 0, 40, W, 208, '#6a4a5a', { seed: 12 });
    L.windows = [[120, 70, 64, 56], [880, 70, 64, 56]];
    for (const [x, y, w, h] of L.windows) { rect(g, '#120c1e', x - 3, y - 3, w + 6, h + 6); g.clearRect(x, y, w, h); }
    neon(g, '백 관장 체육관', 520, 56, '#ffcf8a', { scale: 1, align: 'c' });
    poster(g, 230, 90, 40, 54, '#c2333f', '근성', { figure: 1 }); poster(g, 760, 90, 40, 54, '#2d63b8', '기본기', { figure: 1 });
    // mirror wall
    rect(g, '#120c1e', 330, 92, 120, 120); rect(g, '#9ab0d8', 332, 94, 116, 116); rect(g, '#c9d8f0', 336, 98, 20, 108); dither(g, 332, 94, 116, 116, '#7a90b8', .2, 4);
    // equipment
    const eq = (x, label) => { drawText(g, label, x, 268, { size: 11, align: 'c', color: '#ffe9a8', outline: '#120c1e' }); };
    rect(g, '#1a1a2a', 390, 280, 60, 6); rect(g, '#3a3a4a', 398, 262, 4, 18); rect(g, '#3a3a4a', 438, 262, 4, 18); rect(g, '#888ea8', 382, 256, 76, 3); ellipse(g, '#2a2a3a', 384, 257, 4, 9); ellipse(g, '#2a2a3a', 456, 257, 4, 9); eq(420, '벤치프레스');
    rect(g, '#2a5a8a', 512, 294, 70, 6); eq(546, '줄넘기');
    rect(g, '#5a3a2a', 646, 230, 4, 70); rect(g, '#c2333f', 640, 226, 16, 22); eq(670, '미트 치기');
    rect(g, '#3a6a4a', 760, 292, 60, 8); eq(790, '목 브릿지');
    // practice ring
    const rx = 880, rw = 200;
    rect(g, '#120c1e', rx - 2, 252, rw + 4, 50); rect(g, '#7a2f3a', rx, 254, rw, 16); rect(g, '#3a2430', rx, 270, rw, 30); drawText(g, '연습 링', rx + rw / 2, 276, { size: 11, align: 'c', color: '#ffe9a8' });
    for (const px of [rx + 4, rx + rw - 6]) { rect(g, '#c9d2e6', px, 196, 3, 60); }
    for (const h of [214, 228, 242]) rect(g, '#e6e9f2', rx + 6, h, rw - 10, 1);
    lamp(g, 420, 40, '#ffe0b0', { len: 14 }); lamp(g, 700, 40, '#ffe0b0', { len: 14 }); lamp(g, 980, 40, '#ffe0b0', { len: 14 });
    door(g, 46, 196, 34, 104, '#2a4a3a', { sign: '로비' });
  },
  arena(g, L) {
    const W = L.w;
    wallBase(g, W, 40, '#262a40', '#1a1d2e', '#2a2a36', {});
    for (let x = 0; x < W; x += 6) rect(g, x % 12 ? '#22263a' : '#262b44', x, 40, 6, 208);
    neon(g, '선수 대기실', 300, 54, '#49d6ff', { scale: 1, align: 'c' });
    // lockers
    for (let i = 0; i < 6; i++) { const x = 110 + i * 26; rect(g, '#120c1e', x - 1, 168, 26, 132); rect(g, '#3a5a7a', x, 170, 24, 130); rect(g, '#5a7a9a', x, 170, 24, 2); for (let k = 0; k < 3; k++) rect(g, '#2a4a6a', x + 5, 180 + k * 6, 14, 2); rect(g, '#ffd65a', x + 19, 230, 2, 6); }
    // bench
    rect(g, '#120c1e', 300, 268, 100, 8); rect(g, '#8a6a4a', 302, 268, 96, 5); rect(g, '#5a3a2a', 310, 276, 4, 24); rect(g, '#5a3a2a', 386, 276, 4, 24);
    // card board
    board(g, 450, 132, 110, 92, '오늘의 대진', ['계약 경기', '자유 경기', '특별 이벤트'], { bg: '#1c2238', frame: '#3a59b8' });
    // curtain to the ring
    rect(g, '#120c1e', 668, 120, 112, 182); bands(g, 670, 122, 108, 178, ['#7a1f3a', '#8a2a46', '#7a1f3a', '#6a1830']); for (let x = 674; x < 776; x += 9) rect(g, '#5a1428', x, 122, 2, 178); rect(g, '#ffd65a', 670, 122, 108, 3);
    neon(g, '입장', 724, 96, '#ff5fa2', { scale: 1, align: 'c' });
    lamp(g, 300, 40, '#ffcf7a', { len: 20 }); lamp(g, 560, 40, '#ffcf7a', { len: 20 });
    door(g, 40, 196, 34, 104, '#2a2a3a', { sign: '로비' });
  },
  clinic(g, L) {
    const W = L.w;
    wallBase(g, W, 40, '#d8e4e8', '#8fc4c0', '#c9d2d8', { tiles: 1, ceil: ['#c9d2d8', '#d8e0e4', '#e6ecef'] });
    L.windows = [[270, 76, 56, 56]];
    rect(g, '#5a6a7a', 267, 73, 62, 62); g.clearRect(270, 76, 56, 56);
    drawText(g, '항구의원', 400, 50, { scale: 2, align: 'c', color: '#2a6a6a', bold: true });
    rect(g, '#ff4f6d', 474, 52, 6, 18); rect(g, '#ff4f6d', 468, 58, 18, 6);
    // beds
    for (const x of [470, 560]) { rect(g, '#5a6a7a', x, 270, 70, 4); rect(g, '#f2f4fa', x, 258, 70, 12); rect(g, '#9fe0d0', x + 44, 254, 26, 6); rect(g, '#8a96a8', x + 2, 274, 3, 26); rect(g, '#8a96a8', x + 65, 274, 3, 26); rect(g, '#bfefff', x, 200, 2, 58); }
    // chairs and cabinet
    for (let i = 0; i < 3; i++) { const x = 90 + i * 26; rect(g, '#2a6a8a', x, 270, 20, 6); rect(g, '#2a6a8a', x, 252, 3, 20); rect(g, '#1a4a6a', x + 2, 276, 2, 24); rect(g, '#1a4a6a', x + 16, 276, 2, 24); }
    shelf(g, 186, 160, 60, 3, '#e6ecef', ['#ff4f6d', '#6be38a', '#49d6ff', '#ffd65a']);
    board(g, 340, 160, 76, 56, '진료 안내', ['부상 치료', '응급 처치', '입원 치료'], { bg: '#2a4a4a' });
    door(g, 30, 196, 34, 104, '#5a7a8a', { sign: '나가기', glass: 1 });
  },
  shop(g, L) {
    const W = L.w;
    wallBase(g, W, 40, '#4a3a2a', '#6a4a2a', '#5a4a3a', { planks: 1 });
    neon(g, '돛대 상회', 330, 50, '#ffb347', { scale: 2, align: 'c' });
    // racks of costumes
    for (let i = 0; i < 4; i++) { const x = 90 + i * 44; rect(g, '#2a1e14', x, 140, 2, 120); rect(g, '#2a1e14', x - 14, 140, 30, 2); for (let k = 0; k < 3; k++) { const c = ['#ff5fa2', '#49d6ff', '#ffd65a', '#6be38a', '#c86bff', '#ff8a2b'][(i * 3 + k) % 6]; rect(g, shade(c, -.3), x - 12 + k * 8, 142, 7, 34); rect(g, c, x - 12 + k * 8, 142, 6, 32); } }
    // masks wall
    for (let i = 0; i < 5; i++) { const x = 300 + i * 22, c = ['#c2333f', '#2d63b8', '#e6e9f2', '#3fe0d0', '#7c5ab8'][i]; ellipse(g, shade(c, -.4), x, 120, 8, 10); ellipse(g, c, x, 119, 7, 9); rect(g, '#120c1e', x - 4, 117, 3, 2); rect(g, '#120c1e', x + 1, 117, 3, 2); }
    // counter
    rect(g, '#120c1e', 380, 236, 170, 66); rect(g, '#8a5a34', 382, 238, 166, 62); rect(g, '#b07a44', 382, 238, 166, 5);
    box(g, 396, 214, 22, 22, '#e6e9f2', { tape: 1 }); box(g, 520, 220, 18, 16, '#ff4f6d', { label: '' }); rect(g, '#ff4f6d', 527, 223, 4, 10); rect(g, '#ff4f6d', 524, 226, 10, 4);
    shelf(g, 560, 150, 60, 4, '#5a3a2a', ['#49d6ff', '#ffd65a', '#ff4f6d', '#e6e9f2']);
    board(g, 230, 160, 60, 50, '오늘 특가', ['붕대', '음료', '장비'], { bg: '#3a2a1a' });
    door(g, 30, 196, 34, 104, '#6a4a2a', { sign: '나가기' });
  },
  rivalgym(g, L) {
    const W = L.w;
    wallBase(g, W, 40, '#1e2a24', '#3a2a22', '#3a3a3a', {});
    for (let x = 0; x < W; x += 10) rect(g, x % 20 ? '#1a2620' : '#22302a', x, 40, 10, 208);
    neon(g, '철썩 짐', 360, 52, '#3fd46b', { scale: 2, align: 'c' });
    poster(g, 180, 100, 40, 54, '#3fd46b', '철마', { figure: 1 }); poster(g, 520, 100, 40, 54, '#ffd65a', '고수', { figure: 1 });
    rect(g, '#120c1e', 260, 250, 200, 52); rect(g, '#3a5a3a', 262, 252, 196, 18); rect(g, '#1a2a1a', 262, 270, 196, 30); drawText(g, '도장 깨기 링', 360, 276, { size: 11, align: 'c', color: '#c9f0c0' });
    for (const px of [266, 452]) rect(g, '#9aa6b8', px, 196, 3, 58);
    for (const h of [212, 226, 240]) rect(g, '#3fd46b', 268, h, 186, 1);
    door(g, 30, 196, 34, 104, '#2a3a2a', { sign: '나가기' });
  },
  dome(g, L) {
    const W = L.w;
    wallBase(g, W, 40, '#2a2246', '#3b2d5a', '#2a2440', { tiles: 1, ceil: ['#0b0a1c', '#151330', '#1f1a40'] });
    neon(g, '등대 돔', 320, 50, '#ffd65a', { scale: 2, align: 'c' });
    drawText(g, '챔피언십 로비', 320, 84, { size: 11, align: 'c', color: '#ffe9a8' });
    for (let i = 0; i < 4; i++) trophy(g, 140 + i * 30, 200, '#ffd65a');
    rect(g, '#120c1e', 420, 120, 120, 182); bands(g, 422, 122, 116, 178, ['#ffd65a', '#e0a32e', '#c98a1a']); for (let x = 426; x < 536; x += 9) rect(g, '#a8721a', x, 122, 2, 178);
    door(g, 30, 196, 34, 104, '#4a3d70', { sign: '나가기' });
  },
};
function paintStreet(g, L) {
  // the street is drawn in two layers: far (parallax) and near (buildings)
  const W = L.w;
  rect(g, '#05060f', 0, FLOOR, W, 60);
  bands(g, 0, FLOOR, W, 60, ['#2a2a3a', '#26263a', '#222236', '#1e1e32']);
  for (let x = 0; x < W; x += 36) rect(g, '#3a3a52', x, FLOOR + 22, 18, 2);
  rect(g, '#4a4a62', 0, FLOOR, W, 3);
  const bld = (x, w, h, col, sign, sc, o = {}) => {
    const R = rampHex(col);
    rect(g, '#05060f', x - 1, FLOOR - h - 1, w + 2, h + 1); rect(g, R[2], x, FLOOR - h, w, h); rect(g, R[3], x, FLOOR - h, w, 2); rect(g, R[1], x, FLOOR - 10, w, 10);
    if (o.brick) brick(g, x, FLOOR - h, w, h - 10, col, { seed: x });
    for (let wy = FLOOR - h + 14; wy < FLOOR - 70; wy += 26) for (let wx = x + 10; wx < x + w - 20; wx += 30) { rect(g, '#120c1e', wx - 1, wy - 1, 18, 14); rect(g, o.lit !== false && ((wx + wy) % 3) ? '#ffd27a' : '#2a3150', wx, wy, 16, 12); }
    if (sign) neon(g, sign, x + w / 2, FLOOR - h + (o.signY || 8), sc, { scale: o.big ? 2 : 1, align: 'c' });
  };
  bld(60, 300, 200, '#2f3a5e', '야항 체육관', '#ff5fa2', { big: 1, signY: 10 });
  door(g, 192, 196, 36, 104, '#3a4a6a', { glass: 1 });
  bld(400, 180, 150, '#cfd9df', '항구의원', '#2a8a8a', { lit: false }); rect(g, '#ff4f6d', 480, FLOOR - 120, 6, 18); rect(g, '#ff4f6d', 474, FLOOR - 114, 18, 6);
  door(g, 470, 210, 34, 90, '#5a7a8a', { glass: 1 });
  bld(640, 190, 160, '#6a4a2a', '돛대 상회', '#ffb347', { brick: 1 });
  door(g, 720, 210, 34, 90, '#6a4a2a', {});
  // pojangmacha tent
  const tx = 900;
  poly(g, '#c2333f', [[tx, FLOOR - 92], [tx + 150, FLOOR - 92], [tx + 166, FLOOR - 60], [tx - 16, FLOOR - 60]]);
  rect(g, '#e0405a', tx - 16, FLOOR - 60, 182, 6); for (let x = tx - 10; x < tx + 160; x += 22) rect(g, '#ff8a9a', x, FLOOR - 88, 8, 26);
  rect(g, 'rgba(255,200,150,.35)', tx - 10, FLOOR - 54, 170, 54); rect(g, '#5a3a2a', tx + 20, FLOOR - 26, 110, 6); rect(g, '#3a2418', tx + 26, FLOOR - 20, 4, 20); rect(g, '#3a2418', tx + 120, FLOOR - 20, 4, 20);
  drawText(g, '순덕 포차', tx + 75, FLOOR - 84, { size: 11, align: 'c', color: '#fff3cf', outline: '#5a1020' });
  // plaza
  const px = 1260;
  rect(g, '#3a3a52', px - 80, FLOOR - 4, 220, 4); ellipse(g, '#2a3a5a', px + 30, FLOOR - 16, 40, 10); ellipse(g, '#4a6a9a', px + 30, FLOOR - 20, 34, 7); rect(g, '#8aa4c8', px + 28, FLOOR - 56, 4, 36); ellipse(g, '#bfefff', px + 30, FLOOR - 58, 8, 4);
  drawText(g, '등대 광장', px + 30, FLOOR - 110, { size: 11, align: 'c', color: '#c9d4ff' });
  // rival gym
  bld(1460, 200, 170, '#1e2a24', '철썩 짐', '#3fd46b', { brick: 1 });
  door(g, 1546, 210, 34, 90, '#2a3a2a', {});
  // dock and the dome
  rect(g, '#5a4636', 1720, FLOOR - 6, 300, 6);
  for (let x = 1730; x < 2020; x += 40) rect(g, '#3a2a22', x, FLOOR - 36, 6, 30);
  box(g, 1760, FLOOR - 40, 60, 34, '#1f8fa6', { tape: 1 }); box(g, 1830, FLOOR - 30, 44, 24, '#d8a62e', {}); box(g, 1800, FLOOR - 64, 40, 24, '#c2333f', {});
  drawText(g, '하역장', 1820, FLOOR - 120, { size: 11, align: 'c', color: '#ffd65a', outline: '#120c1e' });
  bld(2060, 220, 220, '#2a2246', '등대 돔', '#ffd65a', { big: 1 });
  door(g, 2150, 196, 40, 104, '#4a3d70', {});
  // street lamps
  for (let x = 30; x < W; x += 260) { rect(g, '#1a1d33', x, FLOOR - 120, 3, 120); rect(g, '#1a1d33', x - 8, FLOOR - 122, 14, 3); rect(g, '#ffe0a0', x - 6, FLOOR - 119, 10, 2); }
}
function streetFar(L, slot) {
  const [c, g] = canvas(1500, FLOOR), r = new RNG(9);
  bands(g, 0, 0, 1500, FLOOR, slot === 2 ? ['#070a1e', '#0c1230', '#111a42', '#18224f', '#22285c', '#2f2a62', '#43306a'] : slot === 1 ? ['#3a4a8a', '#7a5a8a', '#c26a6a', '#e88a5a', '#f0a86a', '#f6c98a', '#fbe3b0'] : ['#5f9ad8', '#7fb8e8', '#9fcbef', '#b8d8f2', '#cfe4f5', '#e1edf7', '#eef4f9']);
  if (slot === 2) { for (let i = 0; i < 100; i++) rect(g, '#ffffff', (r.next() * 1500) | 0, (r.next() * 120) | 0, 1, 1); ellipse(g, '#fff3cf', 1100, 50, 14, 14); ellipse(g, '#1c2456', 1106, 46, 12, 12); }
  else ellipse(g, slot === 1 ? '#ffd08a' : '#fff6d0', 1100, slot === 1 ? 150 : 50, 16, 16);
  // far skyline and harbour
  for (let x = 0; x < 1500; x += 8 + (r.next() * 14 | 0)) { const h = 30 + r.next() * 80, w = 12 + (r.next() * 16 | 0); rect(g, slot === 2 ? '#141836' : slot === 1 ? '#5a3a5a' : '#7a90b0', x, 210 - h, w, h + 40); if (slot === 2) for (let k = 0; k < h / 6; k++) if (r.next() < .4) rect(g, r.pick(['#ffd27a', '#ff8fc4', '#7fe0ff']), x + 2 + (r.next() * (w - 4) | 0), 210 - h + 3 + k * 6, 1, 2); }
  for (const cx of [300, 760, 1240]) { rect(g, slot === 2 ? '#1d2148' : '#4a5a7a', cx, 120, 4, 120); rect(g, slot === 2 ? '#1d2148' : '#4a5a7a', cx - 60, 120, 96, 4); rect(g, '#ff5f5f', cx - 61, 118, 2, 2); }
  rect(g, slot === 2 ? '#e6e9f2' : '#f2f4fa', 1380, 130, 12, 80); rect(g, '#c2333f', 1380, 146, 12, 8); rect(g, '#c2333f', 1380, 172, 12, 8); rect(g, '#ffe9a8', 1382, 124, 8, 6);
  bands(g, 0, 232, 1500, 68, slot === 2 ? ['#1a2152', '#161e4a', '#121a40'] : ['#3a6aa8', '#2f5a96', '#264a80']);
  for (let i = 0; i < 70; i++) rect(g, slot === 2 ? r.pick(['#ff8fc4', '#7fe0ff', '#ffd27a']) : '#e6f6ff', (r.next() * 1500) | 0, 236 + (r.next() * 60 | 0), 3 + (r.next() * 8 | 0), 1);
  return c;
}

/* Location data. npcs(c) returns who is here today; objects have an action key handled by WorldScene. */
const LOCATIONS = {
  lobby: { name: '로비 · 휴게실', w: 1180, music: 'lobby', rim: '#ffcf8a', light: .02,
    doors: [{ x: 82, to: 'street', at: 210, label: '건물 밖으로' }, { x: 337, to: 'office', at: 60, label: '사장실' }, { x: 582, to: 'gym', at: 80, label: '훈련장' }, { x: 1112, to: 'arena', at: 70, label: '경기장 대기실' }],
    objects: [{ x: 647, w: 30, act: 'vending', label: '자판기' }, { x: 734, w: 80, act: 'schedule', label: '경기 일정판' }, { x: 834, w: 80, act: 'ranking', label: '랭킹 보드' }, { x: 946, w: 90, act: 'rest', label: '소파에서 쉬기' }, { x: 75, w: 60, act: 'trophy', label: '트로피 진열장' }, { x: 380, w: 220, act: 'poster', label: '선수 포스터' }] },
  office: { name: '사장실', w: 640, music: 'office', rim: '#ffcf8a', light: .03, doors: [{ x: 20, to: 'lobby', at: 337, label: '로비', edge: 1 }], objects: [{ x: 75, w: 60, act: 'trophy', label: '트로피 선반' }, { x: 247, w: 60, act: 'ranking', label: '랭킹 보드' }, { x: 560, w: 70, act: 'schedule', label: '이번 주 일정' }, { x: 588, w: 50, act: 'fish', label: '수족관' }] },
  gym: { name: '훈련장', w: 1100, music: 'gym', rim: '#ffcf8a', light: .04, doors: [{ x: 63, to: 'lobby', at: 582, label: '로비' }],
    objects: [{ x: 420, w: 70, act: 'train', game: 'bench', label: '벤치프레스' }, { x: 546, w: 70, act: 'train', game: 'rope', label: '줄넘기' }, { x: 668, w: 50, act: 'train', game: 'mitt', label: '미트 치기' }, { x: 790, w: 60, act: 'train', game: 'bridge', label: '목 브릿지' }, { x: 980, w: 180, act: 'spar', label: '연습 링 (연습 경기)' }, { x: 390, w: 110, act: 'train', game: 'breath', label: '거울 앞 호흡 훈련' }] },
  arena: { name: '경기장 대기실', w: 820, music: 'gym', rim: '#49d6ff', light: 0, doors: [{ x: 57, to: 'lobby', at: 1112, label: '로비' }],
    objects: [{ x: 505, w: 110, act: 'card', label: '오늘의 대진표' }, { x: 724, w: 110, act: 'enter', label: '입장 통로' }, { x: 190, w: 150, act: 'locker', label: '사물함' }, { x: 350, w: 100, act: 'bench', label: '벤치에 앉기' }] },
  street: { name: '부둣길', w: 2300, music: 'street', rim: '#ff5fa2', light: -.02, street: 1,
    doors: [{ x: 210, to: 'lobby', at: 82, label: '야항 체육관' }, { x: 487, to: 'clinic', at: 60, label: '항구의원' }, { x: 737, to: 'shop', at: 60, label: '돛대 상회' }, { x: 1563, to: 'rivalgym', at: 60, label: '철썩 짐', lock: 'rivalgym' }, { x: 2170, to: 'dome', at: 60, label: '등대 돔', lock: 'dome' }],
    objects: [{ x: 980, w: 150, act: 'pojang', label: '순덕 포차' }, { x: 1290, w: 120, act: 'plaza', label: '등대 광장' }, { x: 1830, w: 140, act: 'job', label: '하역장 아르바이트' }, { x: 1390, w: 40, act: 'fountain', label: '분수' }] },
  clinic: { name: '항구의원', w: 640, music: 'clinic', rim: '#bfefff', light: .08, doors: [{ x: 47, to: 'street', at: 487, label: '부둣길' }], objects: [{ x: 378, w: 80, act: 'clinicBoard', label: '진료 안내판' }, { x: 520, w: 150, act: 'bed', label: '병상' }] },
  shop: { name: '돛대 상회', w: 640, music: 'shop', rim: '#ffcf8a', light: .03, doors: [{ x: 47, to: 'street', at: 737, label: '부둣길' }], objects: [{ x: 150, w: 160, act: 'racks', label: '의상 행거' }, { x: 260, w: 60, act: 'sale', label: '오늘 특가판' }] },
  rivalgym: { name: '철썩 짐', w: 700, music: 'gym', rim: '#3fd46b', light: 0, doors: [{ x: 47, to: 'street', at: 1563, label: '부둣길' }], objects: [{ x: 360, w: 200, act: 'dojo', label: '도장 깨기 링' }] },
  dome: { name: '등대 돔', w: 640, music: 'boss', rim: '#ffd65a', light: .03, doors: [{ x: 47, to: 'street', at: 2170, label: '부둣길' }], objects: [{ x: 480, w: 120, act: 'domeGate', label: '챔피언십 입장구' }, { x: 180, w: 120, act: 'trophy', label: '역대 챔피언' }] },
};
function bakeLocation(id) {
  const L = LOCATIONS[id];
  const [c, g] = canvas(L.w, 360);
  if (L.street) paintStreet(g, L); else PAINT[id](g, L);
  L.bg = c;
  return L;
}
const locMix = mixHex;
const locLine = line;
const locWave = wave;
const locWin = windowPane;

return { FLOOR, SKY, drawWindows, streetFar, LOCATIONS, bakeLocation, locMix, locLine, locWave, locWin };
})();
// ---- world/npcs.js
__m["world/npcs.js"] = (function () {
// Townspeople and what they say. Lines change with progress, results, rank, injuries and past talks.
const { LOOKS } = __m["data/looks.js"];
const { CHARACTERS } = __m["data/characters.js"];
const { BALANCE: B } = __m["data/balance.js"];
const { josa, fmtMoney, pick } = __m["core/util.js"];
const NPCS = {
  boss: { name: '구만석 사장', look: LOOKS.boss, stance: 'arms', voice: .7 },
  trainer: { name: '백 관장', look: LOOKS.trainer, stance: 'hips', voice: 1.1 },
  doctor: { name: '한 선생', look: LOOKS.doctor, stance: 'calm', voice: 1.15 },
  nurse: { name: '간호사 미소', look: LOOKS.nurse, stance: 'calm', voice: 1.3 },
  shop: { name: '리키', look: LOOKS.shop, stance: 'lean', voice: 1 },
  auntie: { name: '순덕 이모', look: LOOKS.auntie, stance: 'hips', voice: 1.2 },
  staff: { name: '진행요원 도진', look: LOOKS.staff, stance: 'write', voice: 1 },
  janitor: { name: '김 반장', look: LOOKS.janitor, stance: 'elder', voice: .8 },
  reporter: { name: '민 기자', look: LOOKS.reporter, stance: 'write', voice: 1.25 },
  foreman: { name: '장 반장', look: LOOKS.foreman, stance: 'arms', voice: .75 },
  fankid: { name: '꼬마 팬 수아', look: LOOKS.fankid, stance: 'cheer', voice: 1.6 },
  busker: { name: '거리 악사', look: LOOKS.busker, stance: 'calm', voice: .95 },
  sponsor: { name: '황 대표', look: LOOKS.sponsor, stance: 'lean', voice: .9 },
  oldman: { name: '등대지기 영감', look: LOOKS.oldman, stance: 'elder', voice: .7 },
};
for (const id in CHARACTERS) if (id !== 'rookie') NPCS[id] = { name: CHARACTERS[id].name, look: CHARACTERS[id].look, stance: CHARACTERS[id].stance === 'fog' ? 'fog' : 'calm', wrestler: 1, voice: CHARACTERS[id].voice };

// Who stands where today. x in pixels, face -1/1.
function peopleAt(loc, c) {
  const d = c.d, day = d.day, out = [];
  const add = (id, x, face = -1, o = {}) => out.push(Object.assign({ id, x, face }, o));
  const roster = ['taesan', 'haneul', 'neon', 'mandeok', 'dongsu', 'bokja', 'dueok', 'palcho', 'baeksang', 'bjorn', 'baekpa'];
  switch (loc) {
    case 'lobby':
      add('janitor', 470, -1);
      add(roster[day % roster.length], 760, 1, { wander: 60 });
      if (day % 3 !== 1) add(roster[(day * 3 + 4) % roster.length], 1000, -1, { stance: 'sit', y: -10 });
      if (day % 2 === 0) add('reporter', 860, -1);
      if (d.fame >= 30 && !d.flags.sponsored) add('sponsor', 260, 1);
      if (day % 4 === 0) add('dohyun', 620, 1);
      break;
    case 'office': add('boss', 400, -1); break;
    case 'gym':
      add('trainer', 290, 1);
      if (day % 4 !== 0) add('dohyun', 930, -1, { stance: 'tech' });
      add(roster[(day + 5) % roster.length], 560, -1, { stance: 'cheer' });
      break;
    case 'arena': add('staff', 600, -1); if (d.contract && CHARACTERS[d.contract.opp]) add(d.contract.opp, 330, 1, { stance: 'arms' }); break;
    case 'street':
      add('auntie', 1010, -1);
      add('fankid', 1330, -1);
      add('busker', 1190, 1);
      add('foreman', 1900, -1);
      add('oldman', 2040, 1);
      if (day % 3 === 0) add('reporter', 1240, 1);
      break;
    case 'clinic': add('doctor', 400, -1); add('nurse', 200, 1); break;
    case 'shop': add('shop', 465, -1); break;
    case 'rivalgym': add('ironma', 300, 1, { stance: 'box' }); add('gosu', 470, -1, { stance: 'dance' }); break;
    case 'dome': add('staff', 420, -1); break;
  }
  return out;
}

// ---- dialogue scripts -------------------------------------------------------------------------------
const tips = [
  '상대를 계속 때리면 노란 {y}기절 저항{/} 게이지가 줄어. 바닥나면 쓰러지지. 그때 {y}K{/}로 잡는 거야.',
  '공격이 날아오는 순간 {y}L{/}을 누르면 피하면서 그대로 던져 버릴 수 있다더군. 너무 일찍 누르면 그냥 구르기만 하고.',
  '{y}S{/}를 막 누른 바로 그 순간에 맞으면 {y}패리{/}야. 상대가 휘청거리지. 계속 누르고만 있으면 그냥 막기고.',
  '로프 쪽으로 달려가 봐. 반동을 받아서 튕겨 나오면 그때 공격이 훨씬 세지.',
  '잡은 다음엔 방향을 같이 눌러. {y}→+K{/}, {y}←+K{/}, {y}W+K{/}, {y}S+K{/}… 기술이 다 달라. {y}L{/}을 누르면 뒤로 돌아가 잡고.',
  '같은 기술만 쓰면 관중이 금방 질려. 관중이 달아오르면 피니셔 게이지도 빨리 찬다고.',
  '서 있는 상대가 방어만 하면 {y}K{/}로 밀쳐 버려. 가드가 깨진다.',
  '잡혔을 땐 버튼을 마구 눌러. 기술이 시작되는 순간 {y}L!{/} 표시가 뜨면, 그때 누르면 역전이야.',
  '정말 위험하면 {y}S+L{/}. 긴급 탈출이지. 피니셔 게이지를 꽤 먹고 한참 못 써.',
  '코너 앞에서 {y}W{/}를 누르면 턴버클 위로 올라가. 거기서 {y}J{/}면 다이빙이지. 빗나가면… 아프고.',
  '{v}부상 게이지{/}는 경기에서 맞은 만큼 조금씩 쌓여. 쉬어도 안 빠져. 의원에 가거나 붕대를 사서 써야 해.',
  '피곤하면 훈련 효과가 떨어져. 소파에서 쉬거나 밤에 푹 자.',
];
const lastLine = (c, id, list) => { const n = c.rel(id); n.talks = (n.talks || 0) + 1; return list[(n.talks - 1) % list.length]; };

function talk(id, c, W) {
  const d = c.d, me = d.name, rank = c.rank, inj = d.injury, lr = d.lastResult;
  const S = (text, o = {}) => Object.assign({ who: id, text }, o);
  switch (id) {
    case 'boss': {
      const out = [];
      if (!d.flags.metBoss) {
        d.flags.metBoss = 1;
        return [S(`오, 자네가 ${josa(me, '이/가')}군. 반갑네. 내가 이 야항 레슬링 연맹 사장, 구만석일세.`, { expr: 'happy' }), S('이 항구에선 매주 밤마다 링이 서지. 챔피언은 {v}안개왕{/}. 3년째 아무도 그 벨트를 못 건드렸어.'),
          S(`자네는 지금 이름도 없는 신인이야. 랭킹도 꼴찌, ${c.rank}위지. 경기를 이기면 순위가 오르고, 1위가 되고 명성이 쌓이면… 챔피언에게 도전할 수 있네.`),
          S('경기는 내가 주선하지. 계약을 받아 두고, 준비가 되면 {y}경기장 대기실{/}로 가서 입장하게. 날짜 안에만 가면 돼.'),
          S('아, 그리고. 링에서 받은 충격은 몸에 남아. 그게 {v}부상{/}이지. 쌓이다 쌓이면… 선수 생명 끝이야. 항구의원 한 선생한테 꼭 진찰받고 다니게.', { expr: 'sad' }),
          S('자, 첫 계약을 보여 주지.'), { act: () => W.openOffers() }];
      }
      if (d.flags.noShow && !d.flags.noShowSeen) { d.flags.noShowSeen = 1; out.push(S('계약해 놓고 안 나타나다니! 관객들이 표 값을 돌려 달라고 난리였네. 다신 이러지 말게.', { expr: 'fierce' })); }
      if (lr && d.flags.bossSeen !== d.history.length) {
        d.flags.bossSeen = d.history.length;
        if (lr.kind === 'title' && lr.won) out.push(S('해냈군… 정말 해냈어! 등대 돔이 무너지는 줄 알았다네. 자네가 이 항구의 챔피언이야!', { expr: 'happy' }));
        else if (lr.won && lr.kind === 'event') out.push(S(`${lr.opp} 우승이라니! 신문 1면은 자네 차지야.`, { expr: 'happy' }));
        else if (lr.won) out.push(S(pick([`${lr.opp}에게 이겼다며? 관중석 반응이 좋았어. 그 기세로 가세.`, '어제 경기 봤네. 마지막 기술, 표 값 했어.', `좋아, ${rank}위까지 올라왔군. 이제 슬슬 이름이 알려지겠어.`]), { expr: 'happy' }));
        else if (lr.draw) out.push(S('비겼다고? 관객은 끝장을 보고 싶어 하는 법인데.'));
        else out.push(S(pick(['졌다고 고개 숙이지 말게. 이 바닥은 다시 일어나는 놈이 이기는 거야.', `${lr.opp}은 만만한 상대가 아니었지. 훈련장에 가서 백 관장한테 배우게.`, '지는 날도 있는 거야. 대신 같은 방식으로 두 번 지지는 말게.']), { expr: 'sad' }));
      }
      if (inj >= B.injuryDanger) out.push(S(`이봐, 자네 몸 상태… 부상이 ${Math.round(inj)}%야. 이 상태로 링에 오르면 정말 끝날 수도 있어. 의원부터 가!`, { expr: 'sad' }));
      else if (inj >= B.injuryWarn) out.push(S('표정이 안 좋군. 부상이 꽤 쌓였어. 경기 전에 의원에 들르는 걸 잊지 말게.'));
      if (d.flags.champion) out.push(S('챔피언, 오늘은 무슨 일인가? 방어전 상대는 줄을 섰다네.', { expr: 'happy' }));
      else if (rank === 1) out.push(S(d.fame >= 55 ? '1위에 명성까지. 이제 안개왕에게 도전장을 내밀 때가 됐군.' : `1위라니 대단해. 그런데 명성이 아직 ${d.fame}이야. 55는 넘어야 타이틀전을 잡아 줄 수 있네.`));
      if (d.contract) out.push(S(`계약 경기는 ${josa(d.contract.oppName, '과/와')} ${d.contract.day}일까지야. 준비되면 대기실로 가게.`));
      out.push(S('그래, 무슨 일인가?'));
      out.push({ choice: [
        { label: '경기 제안 보기', act: () => W.openOffers() },
        { label: '랭킹에 대해', go: [S(`지금 자네는 ${rank}위. 위 순위를 이기면 그 자리를 빼앗고, 지면 조금 내려가지. 다른 선수들도 매일 싸우니 순위가 계속 움직여.`), S('1위가 되고 명성이 55를 넘으면 타이틀전이야. 14일엔 {y}만선 럼블{/}, 21일엔 {y}태그 대전{/}이 열리고.')] },
        { label: '조언 듣기', go: [S(pick(['훈련만 하다 굶을 순 없지. 계약 경기는 보수가 커. 꼬박꼬박 잡게.', '도전 경기는 위험하지만 순위를 한 번에 뛰어넘을 수 있어.', '돈이 모자라면 부두 하역장에 가 보게. 장 반장이 일당을 쳐 줄 거야.', '돈 아끼다 몸 버리네. 붕대 값은 아끼지 말게.']))] },
        { label: '그만 가 보겠습니다', go: [S('그래, 몸조심하게.')] },
      ] });
      return out;
    }
    case 'trainer': {
      const weak = Object.entries(d.lv).sort((a, b) => a[1] - b[1])[0][0];
      const names = { hp: '체력', stun: '기절 저항', atk: '공격력', grp: '레슬링 기술', spd: '속도', jump: '점프', rec: '기술 회복', down: '다운 회복', kbr: '넉백 저항', fin: '피니셔 충전' };
      const first = !c.rel('trainer').seen; c.rel('trainer').seen = 1;
      return [
        ...(first ? [S('네가 새로 온 애구나. 백 관장이다. 링 위에선 근육보다 기본기가 먼저야.'), S('벤치프레스는 힘, 줄넘기는 발, 미트는 손기술, 목 브릿지는 맷집. 기구 앞에서 {y}E{/}를 눌러. 훈련 한 번에 시간이 한 칸 지나고, 돈도 조금 든다.')] : []),
        S(d.fatigue > 70 ? '얼굴이 반쪽이네. 오늘은 쉬어. 지친 몸으로 하는 훈련은 반도 안 남아.' : `요즘 보니 ${names[weak]} 쪽이 약하더라. 그쪽 훈련을 해 봐.`),
        { choice: [
          { label: '새 기술 배우기', act: () => W.openLearn('trainer') },
          { label: '기술 장착 바꾸기', act: () => W.openInfo(2) },
          { label: '능력치 포인트 쓰기', act: () => W.openInfo(0) },
          { label: '조언', go: [S(pick(tips))] },
          { label: '고맙습니다', go: [S('가 봐. 땀은 거짓말 안 한다.')] },
        ] },
      ];
    }
    case 'doctor': {
      const first = !c.rel('doctor').seen; c.rel('doctor').seen = 1;
      return [
        ...(first ? [S('항구의원 한 선생입니다. 레슬러들은 다 여기 단골이죠.'), S('링에서 맞은 충격은 {v}부상{/}으로 남아요. 경기에서 받은 피해만큼, 조금씩 쌓입니다. 자고 쉬어도 저절로 낫지는 않아요.'), S('100%가 되면… 다시는 링에 못 섭니다. 55%부터는 조심하고, 80%를 넘으면 경기는 말리고 싶네요.', { expr: 'sad' })] : []),
        S(inj < 10 ? '몸 상태는 괜찮네요. 무리하지만 마세요.' : inj < B.injuryWarn ? `부상 ${Math.round(inj)}%. 아직은 버틸 만하지만 쌓이기 전에 치료하는 게 쌉니다.` : inj < B.injuryDanger ? `부상 ${Math.round(inj)}%. 주의 단계예요. 치료를 권합니다.` : `부상 ${Math.round(inj)}%! 위험합니다. 이대로 경기에 나가면 은퇴할 수도 있어요.`, { expr: inj >= B.injuryWarn ? 'sad' : 'neutral' }),
        { act: () => W.openClinic() },
      ];
    }
    case 'nurse': return [S(lastLine(c, 'nurse', ['붕대는 상점에서도 팔아요. 급할 땐 그거라도 감으세요.', '치료비가 부담되면 하역장 아르바이트라도… 부상 없이 벌 수 있잖아요.', '선생님이 그러는데, 피곤한 상태로 싸우면 부상이 더 쌓인대요.', '입원 치료는 하루가 꼬박 걸리지만 한 번에 많이 나아요.']))];
    case 'shop': {
      const first = !c.rel('shop').seen; c.rel('shop').seen = 1;
      return [...(first ? [S('어서 와! 돛대 상회의 리키야. 붕대부터 반짝이 타이츠까지 다 있지.')] : []), S(d.money < 15000 ? '음… 지갑이 좀 가볍네? 그래도 붕대 하나 정도는 챙겨 둬.' : pick(['오늘 들어온 물건 구경해 봐!', '그 의상, 링 조명 받으면 확 살 거야.', '장비는 착용하면 바로 효과가 있어.'])), { act: () => W.openShop() }];
    }
    case 'auntie': return [S(pick([`아이고 ${me} 왔네! 배고프지? 뭐라도 먹고 가.`, '오늘은 국물이 진하게 우러났어.', '레슬러들 다 여기 와서 떠들고 가. 소문은 내가 제일 빠르지.'])), { act: () => W.openFood() }];
    case 'staff': {
      const ct = d.contract;
      const out = [];
      if (ct) out.push(S(ct.day > d.day ? `계약 경기는 ${josa(ct.oppName, '과/와')} ${ct.day}일까지예요. 지금 바로 해도 되고요.` : `오늘이 ${josa(ct.oppName, '과/와')}의 경기 마감일이에요!`));
      else out.push(S('계약된 경기가 없네요. 사장님께 경기를 받거나, 자유 경기에 나가 보세요.'));
      out.push({ act: () => W.openArenaList() });
      return out;
    }
    case 'janitor': return [S(lastLine(c, 'janitor', ['어이 신인. 내가 30년째 이 체육관 바닥을 닦는데, 보는 눈은 있지.', ...tips]))];
    case 'reporter': {
      if (d.flags.interviewDay === d.day) return [S('오늘 인터뷰는 벌써 했잖아요. 기사 기대하세요!')];
      d.flags.interviewDay = d.day;
      const opp = d.contract ? d.contract.oppName : '다음 상대';
      return [S('주간 항구스포츠 민 기자예요! 잠깐 인터뷰 괜찮죠?'), S(`${opp}에 대해 한마디 해 주세요!`), { choice: [
        { label: '"한 방에 끝내 주지."', go: [S('오, 자신감! 기사 제목 나왔다.'), { act: () => { d.fame += 2; W.toast('명성 +2', '#ffd65a'); } }] },
        { label: '"배울 게 많은 상대입니다."', go: [S('겸손하시네요. 팬들이 좋아할 거예요.'), { act: () => { d.fame += 1; c.rel('trainer', 1); W.toast('명성 +1', '#ffd65a'); } }] },
        { label: '"…(무시하고 지나간다)"', go: [S('에이, 차갑긴…'), { act: () => { d.fame = Math.max(0, d.fame - 1); W.toast('명성 -1', '#ff8a8a'); } }] },
      ] }];
    }
    case 'foreman': return [S(pick(['일손이 모자라. 상자 좀 날라 볼 텐가? 링보다 안전하지.', '오늘 배가 세 척이나 들어왔어. 일당 두둑하게 쳐 주지.'])), { choice: [{ label: '아르바이트 하기 (시간 1칸)', act: () => W.startJob() }, { label: '다음에요', go: [S('언제든 오게.')] }] }];
    case 'fankid': {
      if (d.flags.signDay === d.day) return [S('사인 받은 거 친구들한테 자랑했어요!', { expr: 'happy' })];
      if (d.fame < 5) return [S('아저씨도 레슬러예요? 처음 보는데… 잘하면 사인 받으러 올게요!')];
      d.flags.signDay = d.day; d.fame += 1;
      return [S(`우와, ${me}다! 사인해 주세요!`, { expr: 'happy' }), { act: () => W.toast('명성 +1', '#ffd65a') }, S(d.flags.champion ? '챔피언이다아! 벨트 만져 봐도 돼요?' : rank <= 3 ? '곧 챔피언 되는 거죠? 저 다 알아요!' : '다음 경기 꼭 이겨요! 저 맨 앞줄에 있을게요!', { expr: 'happy' })];
    }
    case 'busker': return [S(pick(['♪ 밤배가 들어오면 링에 불이 켜지고… ♪', '이 항구엔 노래가 두 개 있지. 파도 소리랑, 관중 함성.', '네 입장곡? 내가 하나 만들어 줄까. 공짜는 아니지만.']))];
    case 'sponsor': return [S('황금등대 우유의 황 대표요. 요즘 당신 이름이 자주 들리더군.'), S('우리 우유를 링에서 마셔 주면, 매달 후원금을 드리리다.'), { choice: [{ label: '계약한다', go: [S('좋소! 첫 후원금이오.'), { act: () => { d.flags.sponsored = 1; c.earn(50000); W.toast('후원금 ' + fmtMoney(50000), '#9be36b'); } }] }, { label: '거절한다', go: [S('아쉽군. 마음 바뀌면 연락하시오.')] }] }];
    case 'oldman': return [S(lastLine(c, 'oldman', ['나는 저 등대를 40년 지켰지. 안개왕이 처음 나타난 날도 기억해.', '안개왕의 마지막 기술은 {v}목을 잡는 기술{/}이야. 잡히기 전에 피하는 수밖에 없어.', '그 친구, 안개 속에서 싸우는 걸 좋아하지. 링 밖으로 끌어내지 말게. 거긴 그의 바다야.', '불이 꺼지면 당황하지 마. 다시 켜질 때 네가 서 있으면 되는 거야.', '파도는 부서져도 다시 와. 진 날엔 그 말을 기억하게.']))];
    case 'dohyun': {
      const r = c.rel('dohyun');
      const h2h = d.h2h.dohyun || { w: 0, l: 0 };
      if (!r.met) { r.met = 1; return [S('…너도 이번에 들어온 신인이지? 서도현이다.'), S('나는 3개월 먼저 왔어. 그러니까 내가 먼저 올라간다.'), S('랭킹에서 보자.', { expr: 'smug' })]; }
      if (h2h.w > h2h.l) return [S(pick(['지난번엔 내가 방심했을 뿐이야. 다음엔 매듭을 세 번 묶어 주지.', '…네 반격 타이밍, 어디서 배웠어? 아니, 대답 안 해도 돼.', '너 때문에 요즘 잠을 못 자. 훈련하느라.']), { expr: 'fierce' })];
      if (h2h.l > h2h.w) return [S(pick(['이게 실력 차이야. 기본기부터 다시 해.', '실망이군. 라이벌이라고 생각했는데.']), { expr: 'smug' })];
      return [S(lastLine(c, 'dohyun', ['훈련 중이야. 방해하지 마.', '백 관장님 미트는 순서를 외우는 게 아니야. 리듬을 타는 거지.', '태그 대전이 있다던데… 파트너가 필요하면, 생각해 보지.', `지금 ${rank}위라고? 흥. 금방 따라잡아 주지.`]))];
    }
    default: {
      const ch = CHARACTERS[id];
      if (!ch) return [S('…')];
      const h2h = d.h2h[id];
      const vsMe = d.contract && d.contract.opp === id;
      if (vsMe) return [S(pick([ch.lines.intro, `네가 내 다음 상대라고? ${ch.lines.intro}`]), { expr: 'smug' }), S('링에서 보자.', { expr: 'fierce' })];
      if (h2h && h2h.w > h2h.l) return [S(pick([`${ch.lines.lose} …다음엔 안 진다.`, '지난번 경기 얘기는 꺼내지 마.', '운이 좋았던 거야.']), { expr: 'sad' })];
      if (h2h && h2h.l > h2h.w) return [S(pick([ch.lines.win, '또 해 보고 싶어? 언제든지.']), { expr: 'smug' })];
      const gossip = {
        taesan: ['부두에서 컨테이너 들던 시절이 그립네. 그래도 링이 더 무겁지.', '내 컨테이너 드롭은 한 번 들리면 끝이야. 무거운 놈일수록 더 높이 올라가.'],
        haneul: ['코너 위에서 보는 링은 바다 같아. 뛰어내리고 싶어지지.', '날 잡으려면 먼저 땅으로 끌어내려야 할걸?'],
        neon: ['조명이 나를 따라오는 게 아니라, 내가 조명을 데려가는 거야.', '도발도 기술이야. 관중을 내 편으로 만들면 게이지가 쭉쭉 차거든.'],
        mandeok: ['밥심이 곧 체력이지. 포차 이모 파전 먹어 봤어?', '나 들어 올리려면 체력부터 깎아 놔야 할걸. 하하!'],
        dongsu: ['용접은 타이밍이야. 주먹도 그렇고.', '보안경 쓰고 싸우는 이유? 불꽃이 튀니까.'],
        bokja: ['새벽 어시장에서 생선 나르다 보면 팔이 저절로 굵어져.', '내 따귀 맞아 봤어? 기절 게이지가 쭉 빠지지.'],
        dueok: ['히히, 도깨비 방망이 맛 좀 볼래?', '밤길 조심해. 뒷골목엔 링도 심판도 없다고.'],
        palcho: ['자네 관절 각도가 흥미롭군. 해부… 아니, 분석해 보고 싶어.', '기술은 여덟 개쯤 외워 둬야 레슬러지.'],
        baeksang: ['링 밖은 피 냄새가 더 진하지.', '물속에서 기다리는 상어처럼, 기회를 기다린다.'],
        bjorn: ['한국 국밥, 최고. 북해엔 없어.', '파도, 바위 이길 수 없다. 그런데 바위, 조금씩 깎인다.'],
        baekpa: ['나도 한때는 챔피언이었지. 안개왕이 오기 전엔.', '반격은 상대를 보는 게 아니라 상대의 어깨를 보는 거야.'],
        gosu: ['말발도 기술이야, 신인. 경기 전에 이미 반은 이기고 들어가는 거지.', '철썩 짐에 온 걸 환영해. 여기선 도장 깨기 실패하면 청소 당번이야~'],
        ironma: ['여긴 야항 체육관 애들이 오는 데가 아니야.', '도장 깨기? 내 앞을 지나가야 할걸.'],
      }[id] || [ch.lines.intro];
      return [S(lastLine(c, id, gossip))];
    }
  }
}
const npcPick = pick;

return { NPCS, peopleAt, talk, npcPick };
})();
// ---- world/Dialogue.js
__m["world/Dialogue.js"] = (function () {
// Dialogue box: speaker portrait and name, typewriter text with colour tags, choices, skipping.
const { clamp } = __m["core/util.js"];
const { drawText, wrapText, sliceTagged, visLen, stripTags } = __m["render/pixelfont.js"];
const { UI, mixHex } = __m["render/palette.js"];
const { rect } = __m["render/painter.js"];
const { panel } = __m["render/ui.js"];
const { drawPortrait } = __m["render/head.js"];
const { NPCS } = __m["world/npcs.js"];
class Dialogue {
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

return { Dialogue };
})();
// ---- world/menus.js
__m["world/menus.js"] = (function () {
// Windows opened in the world: contracts, matches, shop, clinic, food, moves, info (Tab), map, ranking, results.
const { clamp, fmtMoney, fmtTime, josa, RNG } = __m["core/util.js"];
const { drawText, textWidth, wrapText } = __m["render/pixelfont.js"];
const { UI, mixHex } = __m["render/palette.js"];
const { rect, bands } = __m["render/painter.js"];
const { panel, gauge, icon, keycap, prompt, fade, menuList } = __m["render/ui.js"];
const { drawPortrait } = __m["render/head.js"];
const { CHARACTERS } = __m["data/characters.js"];
const { MOVES, FINISHERS } = __m["data/moves.js"];
const { BALANCE: B } = __m["data/balance.js"];
const { MODES } = __m["combat/MatchManager.js"];
const { ARENAS } = __m["combat/arena.js"];
const { DIFFICULTY } = __m["combat/AIController.js"];
const { SHOP_ITEMS, STAT_GROWTH, LEARNABLE, SLOT_NAMES, SEASON_DAYS } = __m["world/CareerManager.js"];
class Menu {
  constructor(W) { this.W = W; this.game = W.game; this.c = W.c; this.sel = 0; this.t = 0; }
  nav(n, opts = {}) {
    const inp = this.game.input, A = this.game.audio;
    if (!n) return;
    if (inp.pressed('up')) { this.sel = (this.sel + n - 1) % n; A.sfx('ui'); }
    if (inp.pressed('down')) { this.sel = (this.sel + 1) % n; A.sfx('ui'); }
    void opts;
  }
  back() { const inp = this.game.input; if (inp.menuPressed('cancel') || inp.pressed('pause') && this.closeOnPause !== false) { this.game.audio.sfx('back'); this.W.closeTop(); return true; } return false; }
  ok() { return this.game.input.menuPressed('confirm'); }
  update(dt) { this.t += dt; }
  frame(u, title, x = 70, y = 40, w = 500, h = 280, col = '#49d6ff') { fade(u, .5); panel(u, x, y, w, h, { accent: col }); drawText(u, title, x + w / 2, y + 8, { align: 'c', color: col, bold: true }); }
  foot(u, text, y = 304) { drawText(u, text, 320, y, { size: 11, align: 'c', color: UI.dim }); }
}

class Confirm extends Menu {
  constructor(W, text, yes, o = {}) { super(W); this.text = text; this.yes = yes; this.o = o; this.sel = 1; }
  update(dt) {
    super.update(dt); const inp = this.game.input;
    if (inp.pressed('left') || inp.pressed('right') || inp.pressed('up') || inp.pressed('down')) { this.sel ^= 1; this.game.audio.sfx('ui'); }
    if (this.back()) return;
    if (this.ok()) { this.W.closeTop(); if (this.sel === 0) { this.game.audio.sfx('ok'); this.yes(); } else this.game.audio.sfx('back'); }
  }
  draw(u) {
    this.frame(u, this.o.danger ? '경고' : '확인', 120, 110, 400, 130, this.o.danger ? '#ff5b5b' : '#ffd65a');
    wrapText(this.text, 360, 14).forEach((l, i) => drawText(u, l, 320, 138 + i * 17, { align: 'c', color: '#ffffff' }));
    ['예', '아니요'].forEach((t, i) => { const x = 270 + i * 100, on = this.sel === i; rect(u, on ? (i === 0 && this.o.danger ? '#7a1f2a' : '#2a3a7a') : '#141a36', x - 36, 206, 72, 20); drawText(u, t, x, 209, { align: 'c', color: on ? '#ffffff' : UI.dim }); });
  }
}

// ---- contract offers (boss) ----
class OffersMenu extends Menu {
  update(dt) {
    super.update(dt); const d = this.c.d, list = d.offers;
    this.nav(list.length + 1);
    if (this.back()) return;
    if (this.ok()) {
      if (this.sel === list.length) { this.game.audio.sfx('back'); this.W.closeTop(); return; }
      const o = list[this.sel];
      if (d.contract) { this.game.audio.sfx('deny'); this.W.toast('이미 계약한 경기가 있다. 먼저 치르자.', '#ff8a8a'); return; }
      this.W.open(new Confirm(this.W, `${o.oppName} — ${MODES[o.mode].name}, ${o.day}일까지. 보수 ${fmtMoney(o.reward)}. 계약할까요?`, () => { this.c.accept(o); this.W.closeTop(); this.W.toast(`계약 완료! ${o.day}일까지 경기장 대기실로.`, '#6be38a'); this.W.say([{ who: 'boss', text: o.kind === 'title' ? '드디어군. 등대 돔에서 기다리지. 그 안개를 걷어 내게.' : o.kind === 'event' ? '좋아, 이벤트 명단에 올려 두지. 대기실에서 입장하게.' : `좋아. ${josa(o.oppName, '과/와')}의 경기, 기대하지.` }]); }));
    }
  }
  draw(u) {
    const d = this.c.d, list = d.offers;
    this.frame(u, '경기 제안', 40, 26, 560, 304, '#ffd65a');
    if (d.contract) drawText(u, `현재 계약: ${d.contract.oppName} (${d.contract.day}일까지) — 먼저 이 경기를 치러야 새 계약이 가능하다.`, 320, 46, { size: 11, align: 'c', color: '#ffb347' });
    list.forEach((o, i) => {
      const y = 62 + i * 56, on = i === this.sel, ch = CHARACTERS[o.opp];
      rect(u, on ? '#26315f' : '#141a36', 52, y, 536, 52); if (on) rect(u, '#ffd65a', 52, y, 2, 52);
      rect(u, '#05060f', 58, y + 4, 44, 44);
      if (ch) drawPortrait(u, ch.look, 'smug', 58, y + 4, 44, { px: 1, dy: 4 }); else { drawText(u, o.mode === 'rumble' ? '럼블' : '태그', 80, y + 18, { size: 11, align: 'c', color: '#ffd65a' }); }
      const tag = { normal: '일반', challenge: '도전', stip: '특수', event: '이벤트', title: '타이틀' }[o.kind];
      drawText(u, `[${tag}] ${o.oppName}${o.rank ? ` (${o.rank}위)` : ''}`, 110, y + 4, { color: o.kind === 'title' ? '#ffd65a' : '#ffffff' });
      drawText(u, `${MODES[o.mode].name} · ${ARENAS[o.arena].name} · AI ${DIFFICULTY[o.difficulty].name} · ${o.day}일까지`, 110, y + 21, { size: 11, color: UI.dim });
      drawText(u, o.desc, 110, y + 35, { size: 11, color: '#c9d4ff' });
      drawText(u, fmtMoney(o.reward), 580, y + 4, { align: 'r', color: UI.money });
      drawText(u, `명성 +${o.fame}`, 580, y + 21, { size: 11, align: 'r', color: UI.fame });
    });
    const y = 62 + list.length * 56;
    rect(u, this.sel === list.length ? '#26315f' : '#141a36', 52, y, 536, 18); drawText(u, '닫기', 320, y + 2, { size: 11, align: 'c', color: this.sel === list.length ? '#ffffff' : UI.dim });
    this.foot(u, '부상과 피로는 경기 결과에 영향을 준다. 무리한 일정은 피하자.', 316);
  }
}

// ---- match list (arena staff) ----
class ArenaMenu extends Menu {
  constructor(W) {
    super(W);
    const d = this.c.d, r = new RNG(d.season * 500 + d.day * 3 + d.slot);
    const pool = ['taesan', 'haneul', 'neon', 'mandeok', 'dongsu', 'bokja', 'dueok', 'palcho', 'baeksang', 'bjorn', 'baekpa', 'dohyun'];
    this.free = r.shuffle(pool).slice(0, 2).map((id, i) => ({ opp: id, oppName: CHARACTERS[id].name, mode: i ? 'pin' : 'single', arena: r.pick(['hall', 'pier']), reward: 0, fame: 0, kind: 'free', difficulty: d.season >= 2 ? 'hard' : r.pick(['easy', 'normal']), desc: '자유 경기: 기록과 부상은 남지만 랭킹은 그대로.' }));
    this.items = [];
    if (d.contract) this.items.push({ label: `계약 경기: ${d.contract.oppName} 입장`, sub: `${MODES[d.contract.mode].name} · ${ARENAS[d.contract.arena].name} · 보수 ${fmtMoney(d.contract.reward)}`, act: () => this.startOfficial() });
    for (const f of this.free) this.items.push({ label: `자유 경기: ${f.oppName}`, sub: `${MODES[f.mode].name} · ${ARENAS[f.arena].name} · 이기면 소액 보수`, act: () => { this.W.closeTop(); this.W.startMatch('free', f); } });
    this.items.push({ label: '연습 경기 (기록·부상 없음)', sub: '상대 행동을 바꿔 가며 연습', act: () => { this.W.closeTop(); this.W.startMatch('practice', { opp: this.free[0].opp }); } });
    this.items.push({ label: '닫기', act: () => this.W.closeTop() });
  }
  startOfficial() {
    const d = this.c.d, ct = d.contract;
    this.W.closeTop();
    if (ct.title && this.W.loc !== 'dome') { this.W.say([{ who: 'staff', text: '타이틀 매치는 등대 돔에서 열려요! 부둣길 끝의 등대 돔으로 가세요.' }]); return; }
    this.W.startMatch(ct.kind === 'event' ? 'event' : ct.title ? 'title' : 'official', ct);
  }
  update(dt) { super.update(dt); this.nav(this.items.length); if (this.back()) return; if (this.ok()) { this.game.audio.sfx('ok'); this.items[this.sel].act(); } }
  draw(u) {
    this.frame(u, '오늘의 대진', 80, 40, 480, 70 + this.items.length * 34, '#ff5fa2');
    this.items.forEach((it, i) => { const y = 66 + i * 34, on = i === this.sel; rect(u, on ? '#26315f' : '#141a36', 92, y, 456, 30); if (on) rect(u, '#ff5fa2', 92, y, 2, 30); drawText(u, it.label, 100, y + 3, { color: on ? '#ffffff' : '#c9d4ff' }); if (it.sub) drawText(u, it.sub, 100, y + 17, { size: 11, color: UI.dim }); });
  }
}

// ---- shop ----
class ShopMenu extends Menu {
  constructor(W) { super(W); this.tab = 0; }
  list() { const k = ['item', 'gear', 'outfit'][this.tab]; return SHOP_ITEMS.filter(i => i.kind === k); }
  update(dt) {
    super.update(dt);
    const inp = this.game.input, A = this.game.audio, c = this.c, d = c.d, L = this.list();
    if (inp.pressed('left') || inp.pressed('right')) { this.tab = (this.tab + (inp.pressed('left') ? 2 : 1)) % 3; this.sel = 0; A.sfx('ui'); }
    this.nav(L.length);
    if (this.back()) return;
    if (this.ok() && L[this.sel]) {
      const it = L[this.sel];
      if (it.kind !== 'item' && d.owned.includes(it.id)) { this.equip(it); return; }
      if (!c.pay(it.price)) { A.sfx('deny'); this.W.toast('돈이 모자란다', '#ff8a8a'); return; }
      A.sfx('buy');
      if (it.kind === 'item') { d.items[it.id] = (d.items[it.id] || 0) + 1; this.W.toast(`${it.name} 구입 (소지 ${d.items[it.id]})`, '#9be36b'); }
      else { d.owned.push(it.id); this.equip(it); }
      c.save();
    }
  }
  equip(it) {
    const d = this.c.d, A = this.game.audio;
    if (it.kind === 'gear') { if (d.gear[it.slot] === it.id) { delete d.gear[it.slot]; this.W.toast(`${it.name} 해제`); } else { d.gear[it.slot] = it.id; this.W.toast(`${it.name} 장착!`, '#6be38a'); } }
    else { d.outfit = d.outfit || []; const i = d.outfit.indexOf(it.id); if (i >= 0) { d.outfit.splice(i, 1); this.W.toast(`${it.name} 벗음`); } else { d.outfit.push(it.id); this.W.toast(`${it.name} 착용!`, '#6be38a'); } this.W.player.look = this.c.look(); this.W.player.tails = null; }
    A.sfx('ok'); this.c.save();
  }
  draw(u) {
    const d = this.c.d, L = this.list();
    this.frame(u, '돛대 상회', 60, 30, 520, 296, '#ffb347');
    ['소모품', '장비', '의상'].forEach((t, i) => { const x = 170 + i * 100, on = i === this.tab; rect(u, on ? '#5a3a1a' : '#1a1a2a', x - 40, 50, 80, 16); drawText(u, t, x, 52, { size: 11, align: 'c', color: on ? '#ffd65a' : UI.dim }); });
    drawText(u, '소지금 ' + this.c.money(), 568, 52, { size: 11, align: 'r', color: UI.money });
    L.forEach((it, i) => {
      const y = 74 + i * 30, on = i === this.sel, own = d.owned.includes(it.id), worn = (d.gear[it.slot] === it.id) || (d.outfit || []).includes(it.id);
      rect(u, on ? '#3a2a1a' : '#141a36', 72, y, 496, 27); if (on) rect(u, '#ffb347', 72, y, 2, 27);
      drawText(u, it.name + (it.kind === 'item' ? ` (보유 ${d.items[it.id] || 0})` : worn ? ' [착용 중]' : own ? ' [보유]' : ''), 80, y + 2, { color: on ? '#ffffff' : '#e6d8c0' });
      drawText(u, it.desc, 80, y + 15, { size: 11, color: UI.dim });
      drawText(u, it.kind !== 'item' && own ? (worn ? '해제' : '착용') : fmtMoney(it.price), 560, y + 6, { align: 'r', color: it.kind !== 'item' && own ? '#6be38a' : UI.money });
    });
    this.foot(u, '←→ 분류 · Enter 구입/착용 · Esc 나가기', 312);
  }
}

// ---- clinic ----
class ClinicMenu extends Menu {
  opts() {
    const d = this.c.d, inj = d.injury, full = Math.max(10000, Math.round(inj * 1500 / 1000) * 1000), part = 22000, stay = Math.max(18000, Math.round((inj * 1200 + 10000) / 1000) * 1000);
    return [
      { label: '응급 처치', sub: `부상 -12 · ${fmtMoney(part)}`, price: part, act: () => this.treat(12, part, 0) },
      { label: '정밀 치료', sub: `부상 전부 · ${fmtMoney(full)} · 시간 1칸`, price: full, act: () => this.treat(100, full, 1) },
      { label: '입원 치료', sub: `부상 전부 + 피로 0 · ${fmtMoney(stay)} · 다음 날 아침까지`, price: stay, act: () => this.hospital(stay) },
      { label: '나가기', act: () => this.W.closeTop() },
    ];
  }
  treat(pts, price, slots) {
    const c = this.c, A = this.game.audio;
    if (c.d.injury <= 0) { this.W.toast('치료할 부상이 없다'); return; }
    if (!c.pay(price)) { A.sfx('deny'); this.W.toast('치료비가 모자란다. 하역장 아르바이트로 벌 수 있다.', '#ff8a8a'); return; }
    const healed = c.healInjury(pts);
    if (slots) c.spendSlot(slots).forEach(m => this.W.toast(m, '#ffb347'));
    A.sfx('heal'); this.W.toast(`부상 -${Math.round(healed)}% (남은 부상 ${Math.round(c.d.injury)}%)`, '#c86bff'); c.save();
  }
  hospital(price) {
    const c = this.c, A = this.game.audio;
    if (!c.pay(price)) { A.sfx('deny'); this.W.toast('입원비가 모자란다', '#ff8a8a'); return; }
    c.healInjury(100); c.d.fatigue = 0;
    this.W.closeTop(); this.W.doSleep(); A.sfx('heal'); this.W.toast('입원 치료를 받았다. 몸이 가볍다!', '#c86bff');
  }
  update(dt) { super.update(dt); const o = this.opts(); this.nav(o.length); if (this.back()) return; if (this.ok()) { this.game.audio.sfx('ok'); o[this.sel].act(); } }
  draw(u) {
    const d = this.c.d, inj = d.injury, lvl = this.c.injuryLevel, col = lvl === 'danger' ? '#ff5b5b' : lvl === 'warn' ? '#ffb347' : UI.inj;
    this.frame(u, '항구의원 — 부상 진료', 80, 34, 480, 290, '#6be3c8');
    icon(u, 'bandage', 104, 64, col, { scale: 2 });
    drawText(u, '부상 게이지', 128, 62, { color: col });
    gauge(u, 128, 82, 300, 12, inj / 100, 'inj', { col, colD: '#3a1450' });
    drawText(u, Math.round(inj) + '%', 436, 80, { color: col, bold: true });
    rect(u, '#ffb347', 128 + 300 * B.injuryWarn / 100, 78, 1, 20); rect(u, '#ff5b5b', 128 + 300 * B.injuryDanger / 100, 78, 1, 20);
    drawText(u, '주의', 128 + 300 * B.injuryWarn / 100, 98, { size: 11, align: 'c', color: '#ffb347' }); drawText(u, '위험', 128 + 300 * B.injuryDanger / 100, 98, { size: 11, align: 'c', color: '#ff5b5b' });
    drawText(u, inj >= 100 ? '…' : lvl === 'danger' ? '위험: 경기에서 100%가 되면 선수 생명이 끝납니다.' : lvl === 'warn' ? '주의: 부상이 쌓였습니다. 치료를 권합니다.' : '경기에서 받은 피해만큼 조금씩 쌓입니다. 쉬어도 낫지 않습니다.', 320, 116, { size: 11, align: 'c', color: '#eef2ff' });
    const o = this.opts();
    o.forEach((it, i) => { const y = 140 + i * 36, on = i === this.sel; rect(u, on ? '#1f4a4a' : '#141a36', 100, y, 440, 32); if (on) rect(u, '#6be3c8', 100, y, 2, 32); drawText(u, it.label, 110, y + 3, { color: on ? '#ffffff' : '#c9e8e0' }); if (it.sub) drawText(u, it.sub, 110, y + 18, { size: 11, color: UI.dim }); });
    drawText(u, '소지금 ' + this.c.money() + `  ·  붕대 ${d.items.bandage || 0} / 고급 붕대 ${d.items.bigBandage || 0} (Tab→소지품)`, 320, 290, { size: 11, align: 'c', color: UI.dim });
  }
}

// ---- food stall ----
class FoodMenu extends Menu {
  opts() {
    return [
      { label: '어묵탕', price: 4000, sub: '피로 -15', fn: d => { d.fatigue = Math.max(0, d.fatigue - 15); } },
      { label: '해물파전', price: 9000, sub: '다음 경기: 피니셔 게이지 20으로 시작', fn: d => { d.flags.pajeon = 1; } },
      { label: '돼지국밥', price: 7000, sub: '피로 -32 · 시간 1칸', fn: (d, c) => { d.fatigue = Math.max(0, d.fatigue - 32); c.spendSlot(1).forEach(m => this.W.toast(m, '#ffb347')); } },
      { label: '소문 듣기', price: 0, sub: '공짜', gossip: 1 },
      { label: '나가기', price: 0, close: 1 },
    ];
  }
  update(dt) {
    super.update(dt); const o = this.opts(), c = this.c, d = c.d, A = this.game.audio;
    this.nav(o.length);
    if (this.back()) return;
    if (this.ok()) {
      const it = o[this.sel];
      if (it.close) { this.W.closeTop(); return; }
      if (it.gossip) { this.W.closeTop(); this.W.say([{ who: 'auntie', text: this.gossip() }]); return; }
      if (!c.pay(it.price)) { A.sfx('deny'); this.W.toast('돈이 모자라', '#ff8a8a'); return; }
      it.fn(d, c); A.sfx('coin'); this.W.toast(`${it.label} 맛있게 먹었다! ${it.sub}`, '#9be36b'); c.save();
    }
  }
  gossip() {
    const d = this.c.d, ct = d.contract, r = new RNG(d.day);
    if (ct && CHARACTERS[ct.opp]) { const ch = CHARACTERS[ct.opp], F = FINISHERS[ch.finisher]; return `${ch.name} 말이야? ${F.type === 'grab' ? `그 사람 마지막 기술 "${F.name}"은 붙잡는 기술이래. 게이지가 가득 차면 거리를 둬.` : F.type === 'dive' ? `"${F.name}"은 높이 뛰어서 덮치는 거래. 뛰는 걸 보면 옆으로 빠져.` : F.type === 'strike' ? `"${F.name}"은 달려들며 치는 기술이래. 막을 수 있다더라, S로.` : F.type === 'stance' ? `"${F.name}"은 받아치는 자세래. 그 자세일 때 때리면 안 된대.` : `"${F.name}"… 무거운 몸으로 덮친대. 멀리 피해.`}`; }
    return r.pick(['서도현이 요즘 밤마다 혼자 훈련한대. 너 때문인가 봐.', '안개왕은 경기 전날엔 등대 근처를 걷는대.', '강태산은 원래 부두 크레인 기사였어. 사람도 화물처럼 든다니까.', '네온 제이는 관중이 시끄러울수록 무서워져.', '하역장 장 반장이 요즘 사람을 구하더라.', '의원 한 선생이 레슬러들한테 제일 무서운 사람이야. 잔소리가 아주…']);
  }
  draw(u) {
    this.frame(u, '순덕 포차', 120, 60, 400, 230, '#ff8a9a');
    this.opts().forEach((it, i) => { const y = 88 + i * 34, on = i === this.sel; rect(u, on ? '#4a1a2a' : '#141a36', 134, y, 372, 30); drawText(u, it.label, 144, y + 3, { color: on ? '#ffffff' : '#f0d0d8' }); drawText(u, it.sub || '', 144, y + 17, { size: 11, color: UI.dim }); if (it.price) drawText(u, fmtMoney(it.price), 498, y + 8, { align: 'r', color: UI.money }); });
    this.foot(u, '피로가 높으면 훈련 효과가 떨어지고 경기에서 부상이 더 쌓인다.', 272);
  }
}

// ---- learning moves ----
class LearnMenu extends Menu {
  constructor(W, by) { super(W); this.by = by; }
  list() { return LEARNABLE.filter(l => l.by === this.by); }
  update(dt) {
    super.update(dt); const L = this.list(), c = this.c, d = c.d, A = this.game.audio;
    this.nav(L.length);
    if (this.back()) return;
    if (this.ok() && L[this.sel]) {
      const l = L[this.sel];
      if (d.known.includes(l.id)) { this.W.toast('이미 배운 기술. Tab → 기술에서 장착하자.'); return; }
      if (this.by === 'rival' && !(d.flags.dojo_gosu || d.flags.dojo_ironma)) { A.sfx('deny'); this.W.toast('도장 깨기에서 한 번은 이겨야 가르쳐 준다', '#ff8a8a'); return; }
      if (d.fame < l.fame) { A.sfx('deny'); this.W.toast(`명성 ${l.fame} 이상 필요`, '#ff8a8a'); return; }
      if (!c.pay(l.cost)) { A.sfx('deny'); this.W.toast('수업료가 모자란다', '#ff8a8a'); return; }
      c.learn(l.id); A.sfx('good'); this.W.toast(`${MOVES[l.id].name} 습득! Tab → 기술에서 장착`, '#6be38a'); c.save();
    }
  }
  draw(u) {
    const d = this.c.d, L = this.list();
    this.frame(u, this.by === 'rival' ? '철썩 짐의 기술' : '백 관장의 기술 교실', 70, 30, 500, 300, '#6be38a');
    L.forEach((l, i) => { const m = MOVES[l.id], y = 56 + i * 32, on = i === this.sel, has = d.known.includes(l.id); rect(u, on ? '#1f3a2a' : '#141a36', 82, y, 476, 29); drawText(u, m.name + (has ? ' [습득]' : ''), 90, y + 2, { color: has ? UI.faint : on ? '#ffffff' : '#c9e8d0' }); drawText(u, m.desc, 90, y + 16, { size: 11, color: UI.dim }); drawText(u, has ? '' : fmtMoney(l.cost), 550, y + 2, { align: 'r', color: UI.money }); drawText(u, has ? '' : `명성 ${l.fame}`, 550, y + 16, { size: 11, align: 'r', color: d.fame >= l.fame ? UI.fame : '#ff8a8a' }); });
  }
}

// ---- Tab: player info ----
const POS_NAMES = { front: '정면 잡기', rear: '뒤 잡기' }, SLOT_KEYS = { n: 'K', f: '→+K', b: '←+K', u: 'W+K', d: 'S+K' };
class InfoMenu extends Menu {
  constructor(W, tab = 1) { super(W); this.tab = tab; this.pick = null; this.closeOnPause = true; }
  rows() {
    const d = this.c.d;
    if (this.tab === 0) return Object.keys(STAT_GROWTH);
    if (this.tab === 2) { const r = []; for (const pos of ['front', 'rear']) for (const s of ['n', 'f', 'b', 'u', 'd']) r.push({ pos, s }); return r; }
    if (this.tab === 3) return ['bandage', 'bigBandage', 'drink'].filter(k => (d.items[k] || 0) > 0);
    return [];
  }
  update(dt) {
    super.update(dt);
    const inp = this.game.input, A = this.game.audio, c = this.c, d = c.d;
    if (this.pick) { this.pickUpdate(); return; }
    if (inp.pressed('left') || inp.pressed('right')) { this.tab = (this.tab + (inp.pressed('left') ? 3 : 1)) % 4; this.sel = 0; A.sfx('ui'); }
    const R = this.rows();
    this.nav(R.length);
    if (inp.pressed('info') || this.back()) { if (inp.pressed('info')) this.W.closeTop(); return; }
    if (this.ok() && R.length) {
      if (this.tab === 0) { const k = R[this.sel]; if (d.points <= 0) { A.sfx('deny'); this.W.toast('능력치 포인트가 없다. 경기로 경험치를 모으자.'); return; } if (d.lv[k] >= 20) { A.sfx('deny'); return; } d.points--; d.lv[k] = Math.min(20, d.lv[k] + 1); A.sfx('stat'); c.save(); }
      if (this.tab === 2) { const r = R[this.sel]; this.pick = { pos: r.pos, s: r.s, i: 0, list: d.known.filter(id => MOVES[id] && (MOVES[id].pos === r.pos || MOVES[id].pos === 'any')) }; A.sfx('ok'); }
      if (this.tab === 3) { const k = R[this.sel], it = SHOP_ITEMS.find(i => i.id === k); d.items[k]--; if (it.inj) { const h = c.healInjury(it.inj); this.W.toast(`${it.name} 사용: 부상 -${Math.round(h)}%`, '#c86bff'); } if (it.fat) { d.fatigue = Math.max(0, d.fatigue - it.fat); this.W.toast(`${it.name}: 피로 -${it.fat}`, '#9be36b'); } A.sfx('heal'); c.save(); }
    }
  }
  pickUpdate() {
    const inp = this.game.input, A = this.game.audio, P = this.pick;
    if (inp.pressed('up')) { P.i = (P.i + P.list.length - 1) % P.list.length; A.sfx('ui'); }
    if (inp.pressed('down')) { P.i = (P.i + 1) % P.list.length; A.sfx('ui'); }
    if (inp.menuPressed('cancel')) { this.pick = null; A.sfx('back'); return; }
    if (inp.menuPressed('confirm')) { this.c.equipMove(P.pos, P.s, P.list[P.i]); this.pick = null; A.sfx('good'); this.c.save(); }
  }
  draw(u) {
    const c = this.c, d = c.d;
    fade(u, .55);
    panel(u, 30, 22, 580, 314, { accent: '#49d6ff' });
    ['능력치', '커리어', '기술', '소지품'].forEach((t, i) => { const x = 110 + i * 140, on = i === this.tab; rect(u, on ? '#26315f' : '#141a36', x - 60, 30, 120, 18); drawText(u, t, x, 33, { size: 11, align: 'c', color: on ? '#ffd65a' : UI.dim }); });
    // portrait
    rect(u, '#05060f', 44, 58, 70, 70); rect(u, '#1b2450', 45, 59, 68, 68); drawPortrait(u, c.look(), 'neutral', 45, 59, 68, { px: 2, dy: 8 });
    drawText(u, d.name, 122, 58, { color: '#ffffff', bold: true });
    drawText(u, `${c.styleDef.label} · 레벨 ${d.level}`, 122, 76, { size: 11, color: '#49d6ff' });
    gauge(u, 122, 92, 110, 4, d.xp / c.xpNeed(), 'fin', {}); drawText(u, `경험치 ${d.xp}/${c.xpNeed()}`, 238, 89, { size: 11, color: UI.dim });
    drawText(u, `피니셔: ${FINISHERS[d.finisher].name}`, 122, 104, { size: 11, color: '#ffd65a' });
    const T = this.tab;
    if (T === 0) {
      drawText(u, `능력치 포인트: ${d.points}  (Enter로 1 올리기, 레벨업마다 +2 · 훈련으로도 오른다)`, 44, 136, { size: 11, color: d.points ? '#6be38a' : UI.dim });
      this.rows().forEach((k, i) => { const y = 154 + i * 17, on = i === this.sel; if (on) rect(u, '#26315f', 40, y - 2, 560, 16); drawText(u, STAT_GROWTH[k][1], 50, y, { size: 11, color: on ? '#ffffff' : '#c9d4ff' }); gauge(u, 170, y + 3, 200, 6, d.lv[k] / 20, 'fin', { col: '#49d6ff' }); drawText(u, `Lv ${d.lv[k].toFixed(1)}`, 380, y, { size: 11, color: UI.dim }); const s = c.stats; const v = k === 'hp' || k === 'stun' ? Math.round(s[k]) : Math.round(s[k] * 100) + '%'; drawText(u, String(v), 590, y, { size: 11, align: 'r', color: '#ffffff' }); });
    } else if (T === 1) {
      const inj = d.injury, lvl = c.injuryLevel, col = lvl === 'danger' ? '#ff5b5b' : lvl === 'warn' ? '#ffb347' : UI.inj;
      const L = [[`전적`, `${d.record.w}승 ${d.record.l}패 ${d.record.d}무 (KO ${d.record.ko} · 핀 ${d.record.pin})`], ['랭킹', d.flags.champion ? '챔피언' : `${c.rank}위 / ${c.rankList().length}명`], ['명성', String(d.fame)], ['소지금', c.money()], ['날짜', c.timeText], ['계약', d.contract ? `${d.contract.oppName} (${d.contract.day}일까지)` : '없음'], ['연승', d.record.streak > 0 ? d.record.streak + '연승' : d.record.streak < 0 ? -d.record.streak + '연패' : '-'], ['타이틀', d.titles.length ? d.titles.map(t => t.name).join(', ') : '없음']];
      L.forEach(([k, v], i) => { drawText(u, k, 50, 140 + i * 17, { size: 11, color: UI.dim }); drawText(u, v, 130, 140 + i * 17, { size: 11, color: '#ffffff' }); });
      // injuries: visible here, never in the ring
      panel(u, 340, 136, 252, 92, { accent: col, cut: 2 });
      icon(u, 'bandage', 350, 146, col, { scale: 2 }); drawText(u, `부상 ${Math.round(inj)}%`, 372, 144, { color: col, bold: true });
      gauge(u, 350, 166, 232, 9, inj / 100, 'inj', { col, colD: '#3a1450' });
      drawText(u, lvl === 'danger' ? '위험! 100%가 되면 게임 오버' : lvl === 'warn' ? '주의: 치료를 권합니다' : '경기 피해만큼 조금씩 쌓인다', 350, 182, { size: 11, color: col });
      drawText(u, '치료: 항구의원 · 상점 붕대', 350, 196, { size: 11, color: UI.dim });
      drawText(u, `피로 ${Math.round(d.fatigue)}`, 350, 210, { size: 11, color: d.fatigue > 70 ? '#ff8a8a' : UI.dim }); gauge(u, 420, 213, 160, 4, d.fatigue / 100, 'stun', {});
      const h = d.history.slice(-4).reverse();
      drawText(u, '최근 경기', 344, 236, { size: 11, color: UI.dim });
      h.forEach((r, i) => drawText(u, `${r.day}일 ${r.won ? '승' : r.draw ? '무' : '패'} vs ${r.opp} (부상 +${r.inj})`, 344, 250 + i * 14, { size: 11, color: r.won ? '#6be38a' : r.draw ? UI.dim : '#ff8a8a' }));
    } else if (T === 2) {
      drawText(u, '잡은 뒤 입력별 기술. Enter로 바꾸기 (배운 기술 중에서)', 44, 136, { size: 11, color: UI.dim });
      this.rows().forEach((r, i) => { const x = r.pos === 'front' ? 44 : 330, y = 168 + ['n', 'f', 'b', 'u', 'd'].indexOf(r.s) * 26, on = i === this.sel && !this.pick; if (r.s === 'n') drawText(u, POS_NAMES[r.pos], x, 152, { size: 11, color: '#ffd65a' }); rect(u, on ? '#26315f' : '#141a36', x, y, 268, 22); keycap(u, SLOT_KEYS[r.s], x + 4, y + 5); const m = MOVES[d.moves[r.pos][r.s]]; drawText(u, m ? m.name : '-', x + 60, y + 5, { size: 11, color: on ? '#ffffff' : '#c9d4ff' }); });
      drawText(u, `받아치기: ${MOVES[d.moves.catch].name} · 반격: ${MOVES[d.moves.counter].name}`, 44, 302, { size: 11, color: UI.dim });
      if (this.pick) { const P = this.pick; panel(u, 180, 100, 280, 210, { accent: '#ffd65a' }); drawText(u, `${POS_NAMES[P.pos]} ${SLOT_KEYS[P.s]}`, 320, 108, { size: 11, align: 'c', color: '#ffd65a' }); P.list.slice(0, 11).forEach((id, i) => { const on = i === P.i; rect(u, on ? '#3a3a7a' : '#141a36', 190, 124 + i * 16, 260, 15); drawText(u, MOVES[id].name, 196, 126 + i * 16, { size: 11, color: on ? '#ffffff' : UI.dim }); }); const m = MOVES[P.list[P.i]]; if (m) drawText(u, m.desc, 320, 300, { size: 11, align: 'c', color: '#c9d4ff' }); }
    } else {
      const R = this.rows();
      if (!R.length) drawText(u, '사용할 수 있는 물건이 없다. 돛대 상회에서 살 수 있다.', 320, 180, { size: 11, align: 'c', color: UI.dim });
      R.forEach((k, i) => { const it = SHOP_ITEMS.find(x => x.id === k), y = 150 + i * 26, on = i === this.sel; rect(u, on ? '#26315f' : '#141a36', 44, y, 550, 22); drawText(u, `${it.name} × ${d.items[k]}`, 52, y + 4, { size: 11, color: on ? '#ffffff' : '#c9d4ff' }); drawText(u, it.desc, 586, y + 4, { size: 11, align: 'r', color: UI.dim }); });
      const g = Object.values(d.gear).map(id => SHOP_ITEMS.find(i => i.id === id).name);
      drawText(u, '장착 중인 장비: ' + (g.length ? g.join(', ') : '없음'), 44, 300, { size: 11, color: UI.dim });
    }
    drawText(u, '←→ 탭 · Enter 선택 · Tab/Esc 닫기', 320, 322, { size: 11, align: 'c', color: UI.faint });
  }
}

// ---- map ----
class MapMenu extends Menu {
  update(dt) { super.update(dt); const inp = this.game.input; if (inp.pressed('map') || this.back() || this.ok()) { if (inp.pressed('map') || this.ok()) this.W.closeTop(); } }
  draw(u) {
    const W = this.W, here = W.loc;
    this.frame(u, '지도', 40, 30, 560, 300, '#49d6ff');
    // facility box
    rect(u, '#1b2450', 70, 70, 260, 120); drawText(u, '야항 체육관', 200, 74, { size: 11, align: 'c', color: '#ff8fc4' });
    const node = (id, x, y, name, lock) => { const on = id === here; rect(u, '#05060f', x - 31, y - 9, 62, 20); rect(u, on ? '#ffd65a' : lock ? '#2a2a3a' : '#26315f', x - 30, y - 8, 60, 18); drawText(u, name, x, y - 5, { size: 11, align: 'c', color: on ? '#141a36' : lock ? UI.faint : '#ffffff' }); };
    node('office', 110, 110, '사장실'); node('gym', 200, 110, '훈련장'); node('arena', 290, 110, '대기실'); node('lobby', 200, 156, '로비');
    rect(u, '#3a4688', 196, 166, 8, 44);
    // street
    rect(u, '#2a2a3a', 60, 214, 520, 18); drawText(u, '부둣길', 320, 217, { size: 11, align: 'c', color: UI.dim });
    node('street', 200, 222, '정문');
    node('clinic', 150, 258, '항구의원'); node('shop', 230, 258, '돛대 상회');
    rect(u, '#5a2a3a', 300, 250, 50, 16); drawText(u, '포차', 325, 252, { size: 11, align: 'c', color: '#ffd0d8' });
    rect(u, '#2a3a5a', 360, 250, 50, 16); drawText(u, '광장', 385, 252, { size: 11, align: 'c', color: '#c9d4ff' });
    node('rivalgym', 448, 258, '철썩 짐', !W.unlocked('rivalgym'));
    rect(u, '#3a3020', 486, 250, 40, 16); drawText(u, '하역장', 506, 252, { size: 11, align: 'c', color: '#ffd65a' });
    node('dome', 556, 258, '등대 돔', !W.unlocked('dome'));
    drawText(u, '지금 위치: ' + W.L.name, 320, 290, { size: 11, align: 'c', color: '#ffd65a' });
    this.foot(u, '잠긴 곳: 철썩 짐(명성 40) · 등대 돔(타이틀전 계약)', 306);
  }
}

// ---- ranking ----
class RankMenu extends Menu {
  update(dt) { super.update(dt); if (this.back() || this.ok()) { if (this.ok()) this.W.closeTop(); } }
  draw(u) {
    const c = this.c, L = c.rankList();
    this.frame(u, '선수 랭킹', 120, 20, 400, 320, '#ffd65a');
    drawText(u, `챔피언: ${c.d.flags.champion ? c.d.name : '안개왕'}`, 320, 40, { color: '#ffd65a', align: 'c' });
    L.forEach((e, i) => { const y = 60 + i * 17, me = e.id === 'player', name = me ? c.d.name : CHARACTERS[e.id].name; if (me) rect(u, '#3a3a1a', 134, y - 2, 372, 16); drawText(u, `${i + 1}`, 150, y, { size: 11, align: 'r', color: me ? '#ffd65a' : UI.dim }); drawText(u, name, 162, y, { size: 11, color: me ? '#ffd65a' : '#ffffff' }); drawText(u, me ? CHARACTERS.rookie.nick : CHARACTERS[e.id].nick, 270, y, { size: 11, color: UI.dim }); drawText(u, `${e.w}승 ${e.l}패`, 496, y, { size: 11, align: 'r', color: UI.dim }); });
  }
}

// ---- pause ----
class PauseMenu extends Menu {
  items() { return [{ label: '계속하기', act: () => this.W.closeTop() }, { label: '저장하기', act: () => { this.c.save(); this.W.toast('저장했다', '#9be36b'); this.W.closeTop(); } }, { label: '조작법', act: () => this.game.showControls() }, { label: '설정', act: () => this.game.openSettings() }, { label: '저장하고 타이틀로', act: () => { this.c.save(); this.game.toTitle(); } }]; }
  update(dt) { super.update(dt); const it = this.items(); this.nav(it.length); if (this.back()) return; if (this.ok()) { this.game.audio.sfx('ok'); it[this.sel].act(); } }
  draw(u) { this.frame(u, '메뉴', 220, 90, 200, 150, '#49d6ff'); menuList(u, this.items(), this.sel, 238, 118, { w: 164, lh: 20 }); }
}

// ---- after a match ----
class ResultMenu extends Menu {
  constructor(W, sum, res, kind, offer) { super(W); this.sum = sum; this.res = res; this.kind = kind; this.offer = offer; this.shownInj = this.c.d.injury - sum.injury; }
  update(dt) {
    super.update(dt);
    this.shownInj = Math.min(this.c.d.injury, this.shownInj + dt * 12);
    if (this.t > .6 && (this.ok() || this.game.input.menuPressed('cancel'))) {
      this.W.closeTop();
      if (this.W.checkGameOver()) return;
      const d = this.c.d;
      if (this.sum.ups.length) this.W.toast(`레벨 업! Lv ${d.level} — 능력치 포인트 +${this.sum.ups.length * 2} (Tab)`, '#6be38a');
      if (this.c.injuryLevel === 'danger') this.W.say([{ who: 'me', text: `몸이 비명을 지른다… 부상 ${Math.round(d.injury)}%. 이대로는 위험하다. 항구의원에 가야 해.`, expr: 'hurt' }]);
      else if (this.c.injuryLevel === 'warn' && this.sum.injury > 0) this.W.toast(`부상 주의: ${Math.round(d.injury)}%`, '#ffb347');
    }
  }
  draw(u) {
    const s = this.sum, r = this.res, c = this.c, d = c.d, won = r.won;
    this.frame(u, this.kind === 'practice' || this.kind === 'spar' ? '연습 종료' : won ? '승리!' : r.draw ? '무승부' : '패배', 100, 30, 440, 296, won ? '#ffd65a' : r.draw ? '#c9d4ff' : '#ff5b5b');
    const rows = [];
    if (s.money) rows.push(['상금', fmtMoney(s.money), UI.money]);
    if (s.fame) rows.push(['명성', (s.fame > 0 ? '+' : '') + s.fame, UI.fame]);
    if (s.xp) rows.push(['경험치', '+' + s.xp, '#49d6ff']);
    if (s.rankBefore !== s.rankAfter) rows.push(['랭킹', `${s.rankBefore}위 → ${s.rankAfter}위`, s.rankAfter < s.rankBefore ? '#6be38a' : '#ff8a8a']);
    if (s.ups.length) rows.push(['레벨 업', `Lv ${d.level} (포인트 +${s.ups.length * 2})`, '#6be38a']);
    rows.forEach(([k, v, col], i) => { drawText(u, k, 130, 64 + i * 18, { color: UI.dim }); drawText(u, v, 510, 64 + i * 18, { align: 'r', color: col }); });
    s.lines.forEach((l, i) => drawText(u, l, 320, 64 + rows.length * 18 + 6 + i * 16, { size: 11, align: 'c', color: '#ffd65a' }));
    // injury: shown only here, after leaving the ring
    if (this.kind !== 'practice' && this.kind !== 'spar') {
      const y = 210, inj = this.shownInj, lvl = inj >= B.injuryDanger ? 'danger' : inj >= B.injuryWarn ? 'warn' : 'ok', col = lvl === 'danger' ? '#ff5b5b' : lvl === 'warn' ? '#ffb347' : UI.inj;
      icon(u, 'bandage', 130, y + 2, col, { scale: 2 });
      drawText(u, `부상 +${s.injury}`, 152, y, { color: col });
      gauge(u, 152, y + 18, 300, 9, inj / 100, 'inj', { col, colD: '#3a1450', trail: d.injury / 100 });
      drawText(u, Math.round(inj) + '%', 460, y + 15, { color: col, bold: true });
      drawText(u, d.injury >= 100 ? '…몸이 더는 버티지 못한다.' : lvl === 'danger' ? '위험! 치료하지 않고 다음 경기에서 100%가 되면 은퇴(게임 오버)' : lvl === 'warn' ? '주의: 항구의원이나 붕대로 치료하자' : '받은 피해만큼 부상이 쌓였다', 320, y + 34, { size: 11, align: 'c', color: col });
    }
    prompt(u, [this.game.input.label('confirm')], '계속', 320, 300, { align: 'c' });
  }
}

// ---- season end ----
class SeasonEndMenu extends Menu {
  update(dt) {
    super.update(dt);
    if (this.t > .8 && this.ok()) {
      const c = this.c, d = c.d;
      d.season++; d.day = 1; d.slot = 0; d.league = c.newLeague(d.season); d.flags.rankPts = Math.round((d.flags.rankPts || 0) * .6); d.seasonLog = { w: 0, l: 0, earned: 0, matches: [] }; d.events = {};
      c.save(true);
      this.W.closeTop();
      this.W.say([{ who: 'boss', text: `시즌 ${d.season}이 시작됐네! 새 얼굴들도 들어왔어. 철썩 짐 녀석들까지 리그에 합류했지.` }, { who: 'boss', text: '상대들도 한 해 동안 단단해졌을 거야. 방심하지 말게.' }]);
    }
  }
  draw(u) {
    const c = this.c, d = c.d, L = d.seasonLog;
    this.frame(u, `시즌 ${d.season} 결산`, 90, 30, 460, 296, '#ffd65a');
    const rows = [['전적', `${L.w}승 ${L.l}패`], ['최종 랭킹', d.flags.champion ? '챔피언' : c.rank + '위'], ['획득한 타이틀', d.titles.filter(t => t.season === d.season).map(t => t.name).join(', ') || '없음'], ['총수입', fmtMoney(L.earned)], ['레벨', `Lv ${d.level}`], ['명성', String(d.fame)], ['부상', Math.round(d.injury) + '%']];
    rows.forEach(([k, v], i) => { drawText(u, k, 120, 62 + i * 20, { color: UI.dim }); drawText(u, v, 520, 62 + i * 20, { align: 'r', color: '#ffffff' }); });
    const riv = Object.entries(d.h2h).sort((a, b) => (b[1].w + b[1].l) - (a[1].w + a[1].l)).slice(0, 3);
    drawText(u, '주요 라이벌: ' + (riv.length ? riv.map(([id, r]) => `${CHARACTERS[id].name} ${r.w}-${r.l}`).join(' · ') : '없음'), 320, 210, { size: 11, align: 'c', color: '#c9d4ff' });
    const best = L.matches.filter(m => m.won).slice(-1)[0];
    if (best) drawText(u, `기억에 남는 경기: ${best.day}일 vs ${best.opp}`, 320, 228, { size: 11, align: 'c', color: '#ffd65a' });
    prompt(u, ['Enter'], '다음 시즌으로', 320, 296, { align: 'c' });
  }
}

// ---- career over ----
class GameOverScene {
  constructor(game, career) { this.game = game; this.c = career; this.t = 0; this.sel = 0; game.audio.music(null); game.audio.jingle('gameover'); career.d.retired = true; }
  items() { return [{ label: '마지막 아침부터 다시 하기', act: () => { const k = this.c.constructor.loadCheckpoint(this.c.d.slot); if (k && k.d.injury < 100) { k.save(); this.game.career = k; this.game.startCareer('continue'); } else this.game.toTitle(); } }, { label: '타이틀로', act: () => this.game.toTitle() }]; }
  update(dt) { this.t += dt; const inp = this.game.input, it = this.items(); if (inp.pressed('up') || inp.pressed('down')) { this.sel ^= 1; this.game.audio.sfx('ui'); } if (this.t > 1.5 && inp.menuPressed('confirm')) { this.game.audio.sfx('ok'); it[this.sel].act(); } }
  draw(w, u) {
    const d = this.c.d;
    bands(w, 0, 0, 640, 360, ['#05060f', '#0a0b18', '#0e1022', '#120f26']);
    u.clearRect(0, 0, 640, 360);
    const a = clamp(this.t / 1.5, 0, 1);
    u.globalAlpha = a;
    drawText(u, '선수 생명 종료', 320, 60, { scale: 3, align: 'c', color: '#ff5b5b', bold: true, outline: '#05060f' });
    drawText(u, '부상 게이지가 100%에 도달했다. 더는 링에 설 수 없다.', 320, 116, { align: 'c', color: '#eef2ff' });
    drawPortrait(u, this.c.look(), 'sad', 280, 140, 80, { px: 3, dy: 10 });
    drawText(u, `${d.name} · 시즌 ${d.season} ${d.day}일 · ${d.record.w}승 ${d.record.l}패 · 최고 랭킹 ${this.c.rank}위`, 320, 230, { size: 11, align: 'c', color: UI.dim });
    menuList(u, this.items(), this.sel, 230, 262, { w: 180 });
    u.globalAlpha = 1;
  }
}
const menuSlots = SLOT_NAMES;
const menuDays = SEASON_DAYS;
const menuTime = fmtTime;
const menuTW = textWidth;
const menuMix = mixHex;

return { Confirm, OffersMenu, ArenaMenu, ShopMenu, ClinicMenu, FoodMenu, LearnMenu, InfoMenu, MapMenu, RankMenu, PauseMenu, ResultMenu, SeasonEndMenu, GameOverScene, menuSlots, menuDays, menuTime, menuTW, menuMix };
})();
// ---- world/Training.js
__m["world/Training.js"] = (function () {
// Training mini-games (timing, rhythm, memory, balance, breathing) and the dock part-time job.
const { clamp, fmtMoney, RNG } = __m["core/util.js"];
const { drawText } = __m["render/pixelfont.js"];
const { UI, mixHex } = __m["render/palette.js"];
const { rect, ellipse } = __m["render/painter.js"];
const { panel, gauge, keycap, prompt, fade } = __m["render/ui.js"];
const { STAT_GROWTH } = __m["world/CareerManager.js"];
const GAMES = {
  bench: { name: '벤치프레스', kind: '타이밍', stats: ['atk', 'hp'], pose: 'bench', x: 420, desc: '바늘이 초록 칸에 들어왔을 때 {y}J{/}. 8번 들어 올리자. 세 번 놓치면 끝.' },
  rope: { name: '줄넘기', kind: '리듬', stats: ['spd', 'jump'], pose: 'rope', x: 546, desc: '원이 줄어들어 고리에 닿는 순간 {y}W{/}. 박자를 타자.' },
  mitt: { name: '미트 치기', kind: '순서 기억', stats: ['grp', 'rec'], pose: 'mitt', x: 668, desc: '관장님이 보여 주는 방향 순서를 기억했다가 {y}W A S D{/}로 똑같이.' },
  bridge: { name: '목 브릿지', kind: '균형', stats: ['stun', 'kbr'], pose: 'bridge', x: 790, desc: '흔들리는 바늘을 {y}A D{/}로 가운데에 붙잡아 두자. 10초.' },
  breath: { name: '호흡 훈련', kind: '타이밍', stats: ['fin', 'down'], pose: 'calm', x: 410, desc: '{y}J{/}를 누르고 있으면 숨이 찬다. 초록 띠에서 손을 떼자. 5번.' },
  job: { name: '하역 아르바이트', kind: '타이밍', stats: [], pose: 'carry', x: 1830, desc: '크레인이 상자를 옮긴다. 쌓인 상자 바로 위에 왔을 때 {y}J{/}로 내려놓자. 8개.' },
};

class Training {
  constructor(W, id, cost) {
    this.W = W; this.game = W.game; this.c = W.c; this.id = id; this.G = GAMES[id]; this.cost = cost; this.phase = 'intro'; this.t = 0; this.score = 0; this.rng = new RNG(Date.now() & 0xffff); this.fx = [];
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
    switch (this.id) {
      case 'bench': this.s = { needle: 0, dir: 1, speed: .9, zone: [.4, .62], reps: 0, miss: 0, hits: 0, perfect: 0, lift: 0 }; this.newZone(); break;
      case 'rope': this.s = { beats: Array.from({ length: 20 }, (_, i) => 1.4 + i * .5 + (i > 9 ? -(i - 9) * .03 : 0)), idx: 0, good: 0, perfect: 0, hit: [] }; break;
      case 'mitt': this.s = { round: 0, len: 3, seq: [], show: 0, input: [], ok: 0, phase: 'show', st: 0 }; this.newSeq(); break;
      case 'bridge': this.s = { pos: 0, vel: 0, inZone: 0, drift: 0 }; break;
      case 'breath': this.s = { fill: 0, round: 0, good: 0, band: [.72, .86], holding: false, done: [] }; break;
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
    if (this.id === 'job') {
      const pay = Math.round((6000 + this.s.good * 1800 + d.season * 1000) / 500) * 500;
      c.earn(pay); this.pay = pay; d.fatigue = Math.min(100, d.fatigue + 15);
    } else {
      const g = { S: 1, A: .7, B: .45, C: .25 }[grade] * fatK;
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
    if (this.phase === 'result') { if (this.t > .5 && (inp.menuPressed('confirm') || inp.menuPressed('cancel'))) { (this.msgs || []).forEach(m => this.W.toast(m, '#ffb347')); this.close(); } return; }
    const s = this.s;
    switch (this.id) {
      case 'bench': {
        s.needle += s.dir * s.speed * dt; if (s.needle > 1) { s.needle = 1; s.dir = -1; } if (s.needle < 0) { s.needle = 0; s.dir = 1; }
        s.lift = Math.max(0, s.lift - dt * 2);
        if (inp.pressed('atk') || inp.pressed('fin')) {
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
        if (inp.pressed('up') || inp.pressed('atk')) {
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
        const hold = inp.down('atk') || inp.down('fin');
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
          if (inp.pressed('atk') || inp.pressed('fin')) { s.drop = { x: s.craneX, y: 0, vy: 0 }; A.sfx('whoosh'); }
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
      else drawText(u, '부상 없이 돈을 벌 수 있다. 피로가 쌓이고 시간이 한 칸 지난다.', 320, 98, { size: 11, align: 'c', color: '#9be36b' });
      drawText(u, this.cost ? `훈련비 ${fmtMoney(this.cost)} · 시간 1칸 · 피로 +14` : '시간 1칸 · 피로 +15', 320, 116, { size: 11, align: 'c', color: UI.dim });
      if (this.c.d.fatigue > 40) drawText(u, `피로 ${Math.round(this.c.d.fatigue)}: 훈련 효과 ${this.c.d.fatigue > 70 ? '50%' : '80%'}`, 320, 134, { size: 11, align: 'c', color: '#ff8a8a' });
      prompt(u, ['Enter'], '시작', 270, 210, {}); prompt(u, ['Esc'], '그만두기', 350, 210, {});
      return;
    }
    if (this.phase === 'result') {
      drawText(u, this.grade, 320, 74, { scale: 4, align: 'c', color: { S: '#ffd65a', A: '#6be38a', B: '#49d6ff', C: '#c9d4ff' }[this.grade], bold: true, outline: '#05060f' });
      if (this.id === 'job') drawText(u, `일당 ${fmtMoney(this.pay)}을 받았다!`, 320, 140, { align: 'c', color: UI.money });
      else this.gains.forEach(([k, g], i) => drawText(u, `${STAT_GROWTH[k][1]} Lv +${g.toFixed(2)}  (Lv ${this.c.d.lv[k].toFixed(1)})`, 320, 136 + i * 16, { size: 11, align: 'c', color: '#6be38a' }));
      if (this.fatK && this.fatK < 1) drawText(u, '피곤해서 효과가 줄었다…', 320, 172, { size: 11, align: 'c', color: '#ff8a8a' });
      prompt(u, ['Enter'], '확인', 320, 212, { align: 'c' });
      return;
    }
    switch (this.id) {
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
        s.stack.forEach((x, i) => { rect(u, '#05060f', base + x - 17, gy - i * 18 - 1, 34, 18); rect(u, ['#1f8fa6', '#d8a62e', '#35a07a', '#c2333f'][i % 4], base + x - 16, gy - i * 18, 32, 16); });
        drawText(u, `${s.n}/8`, 500, 130, { size: 11, color: UI.dim });
        break;
      }
    }
    for (const f of this.fx) { u.globalAlpha = 1 - f.t / .8; drawText(u, f.text, f.x, f.y - f.t * 20, { align: 'c', color: f.col, bold: true, outline: '#05060f' }); u.globalAlpha = 1; }
    void ellipse;
  }
}
const TRAINING_GAMES = GAMES;

return { Training, TRAINING_GAMES };
})();
// ---- world/WorldScene.js
__m["world/WorldScene.js"] = (function () {
// Exploration: walk the facility and the harbour street, talk, use things, go through doors, start matches.
const { VIEW_W, VIEW_H, clamp, damp, sgn, fmtMoney, josa, RNG } = __m["core/util.js"];
const { drawText, textWidth } = __m["render/pixelfont.js"];
const { UI, mixHex } = __m["render/palette.js"];
const { rect, glow } = __m["render/painter.js"];
const { panel, gauge, icon, keycap, prompt, fade } = __m["render/ui.js"];
const { BodyCanvas } = __m["render/raster.js"];
const { drawBody } = __m["render/body.js"];
const { Joints, dimsFor, solveFK, toWorld, JN, J } = __m["anim/skeleton.js"];
const { STANCES, stancePose, gaitPose, clip, hasClip, sampleClip } = __m["anim/clips.js"];
const { updateTails } = __m["anim/AnimationSystem.js"];
const { BALANCE: B } = __m["data/balance.js"];
const { CHARACTERS } = __m["data/characters.js"];
const { LOCATIONS, bakeLocation, drawWindows, streetFar, FLOOR } = __m["world/locations.js"];
const { NPCS, peopleAt, talk } = __m["world/npcs.js"];
const { Dialogue } = __m["world/Dialogue.js"];
const { SLOT_NAMES } = __m["world/CareerManager.js"];
const Menus = __m["world/menus.js"];
const { Training } = __m["world/Training.js"];
const P = new Float32Array(16);
class Actor {
  constructor(look, o = {}) { this.look = look; this.dims = dimsFor(look.build, look.scale || 1); this.x = o.x || 100; this.y = FLOOR + (o.y || 0); this.vx = 0; this.vy = 0; this.face = o.face || 1; this.ground = true; this.stance = o.stance || 'calm'; this.gait = 0; this.t = Math.random() * 3; this.poseT = this.t; this.joints = new Joints(); this.expr = 'neutral'; this.exprT = 0; this.tails = null; this.idx = 0; this.id = o.id; this.home = this.x; this.wander = o.wander || 0; this.wT = 2; this.talkT = 0; this.y0 = this.y; }
  pose(dt) {
    this.t += dt; this.poseT = this.t;
    const moving = Math.abs(this.vx) > 6;
    if (!this.ground) sampleClip(clip(this.vy < 0 ? 'jump' : 'fall'), .2, P);
    else if (this.talkT > 0) sampleClip(clip('talk'), this.t, P);
    else if (STANCES[this.stance]) { stancePose(this.stance, this.t, P); if (moving) { this.gait += dt * (2.6 + Math.abs(this.vx) * .07) * (this.vx * this.face >= 0 ? 1 : -1); gaitPose(P, this.gait, Math.abs(this.vx) > 150 ? 'run' : 'walk', 1); } }
    else if (hasClip(this.stance)) sampleClip(clip(this.stance), this.t, P);
    else stancePose('calm', this.t, P);
    if (!this.ground) solveFK(P, this.dims, this.joints, { snap: false, py: -this.dims.leg * .92 });
    else solveFK(P, this.dims, this.joints, {});
    toWorld(this.joints, this.face, this.x, this.y);
    this.faceExpr = this.exprT > 0 ? this.expr : (Math.floor(this.t * .7) % 5 === 0 && (this.t % 1.43) < .12 ? 'blink' : this.talkT > 0 ? (Math.floor(this.t * 8) % 2 ? 'talk' : 'neutral') : 'neutral');
    if (this.exprT > 0) this.exprT -= dt;
    if (this.talkT > 0) this.talkT -= dt;
    updateTails(this, dt, this.y);
  }
}

class WorldScene {
  constructor(game, career, o = {}) {
    this.game = game; this.c = career; this.t = 0; this.bc = new BodyCanvas(); this.overlays = []; this.dialog = null; this.toasts = []; this.prompt = null; this.camX = 0; this.farCache = {};
    this.player = new Actor(career.look(), { x: career.d.x || 240, face: 1, id: 'me' });
    this.player.name = career.d.name;
    this.enter(career.d.loc || 'lobby', career.d.x || 240, true);
    if (o.intro) this.say([{ who: 'janitor', text: `어이, 거기! 네가 오늘 온다던 신인 ${josa(career.d.name, '이/가')}구나. 여긴 야항 체육관 로비야.` }, { who: 'janitor', text: '사장님 방은 저기 왼쪽 문이야. {y}F{/}를 누르면 들어갈 수 있어. 사람한테는 {y}E{/}로 말을 걸고.' }, { who: 'janitor', text: '{y}Tab{/}을 누르면 네 상태를 볼 수 있다. 특히 {v}부상 게이지{/}는 자주 확인하라고.' }]);
    if (o.after) this.afterMatch(o.after);
    game.screen.resetFx();
  }
  get L() { return LOCATIONS[this.loc]; }
  enter(id, x, instant) {
    const L = LOCATIONS[id];
    if (!L.bg) bakeLocation(id);
    this.loc = id; this.c.d.loc = id; this.player.x = clamp(x, 30, L.w - 30); this.player.y = FLOOR; this.player.vx = 0; this.player.vy = 0;
    const r = new RNG(this.c.d.day * 13 + id.length);
    this.npcs = peopleAt(id, this.c).map((p, i) => { const N = NPCS[p.id]; const a = new Actor(N.look, { x: p.x, face: p.face, stance: p.stance || N.stance, id: p.id, y: p.y || 0, wander: p.wander }); a.idx = i + 1; a.t = r.next() * 4; return a; });
    this.camX = clamp(this.player.x - VIEW_W / 2, 0, Math.max(0, L.w - VIEW_W));
    this.game.audio.music(L.music);
    this.game.screen.goal.tint = this.c.d.slot === 2 ? [.92, .95, 1.08] : this.c.d.slot === 1 ? [1.06, .98, .92] : [1, 1, 1];
    this.bc.setLight({ rim: L.rim, light: L.light });
    if (id === 'lobby' && this.c.injuryLevel !== 'ok' && this.c.d.flags.injWarnDay !== this.c.d.day) { this.c.d.flags.injWarnDay = this.c.d.day; setTimeout(() => this.toast(this.c.injuryLevel === 'danger' ? `부상 위험 ${Math.round(this.c.d.injury)}% — 당장 치료가 필요하다!` : `부상 주의 ${Math.round(this.c.d.injury)}% — 의원에 들르자`, this.c.injuryLevel === 'danger' ? '#ff5b5b' : '#ffb347'), 400); }
    if (!instant) this.c.save();
  }
  goDoor(d) {
    const A = this.game.audio;
    if (d.lock && !this.unlocked(d.lock)) { A.sfx('deny'); this.toast(d.lock === 'rivalgym' ? '문이 잠겨 있다. "명성 40 이상만 도장 깨기 접수" ' : '"챔피언십 관계자 외 출입 금지"', '#ff8a8a'); return; }
    A.sfx('door');
    this.fadeT = .45; this.fadeTo = () => { this.enter(d.to, d.at); };
  }
  unlocked(k) { const d = this.c.d; if (k === 'rivalgym') return d.fame >= 40 || d.flags.champion; if (k === 'dome') return (d.contract && d.contract.title) || d.flags.champion; return true; }
  say(steps, o = {}) { this.dialog = new Dialogue(this.game, steps, Object.assign({ player: this.player, onEnd: () => { this.dialog = null; if (o.after) o.after(); } }, o)); }
  toast(text, col = '#eef2ff') { this.toasts.push({ text, col, t: 0 }); if (this.toasts.length > 4) this.toasts.shift(); }
  open(o) { this.overlays.push(o); this.game.input.clear(); }
  closeTop() { this.overlays.pop(); this.game.input.clear(); }
  // ---- actions used by dialogues and objects ----
  openOffers() { if (!this.c.d.offers.length || this.c.d.offersDay !== this.c.d.day) this.c.makeOffers(); this.open(new Menus.OffersMenu(this)); }
  openArenaList() { this.open(new Menus.ArenaMenu(this)); }
  openShop() { this.open(new Menus.ShopMenu(this)); }
  openClinic() { this.open(new Menus.ClinicMenu(this)); }
  openFood() { this.open(new Menus.FoodMenu(this)); }
  openLearn(by) { this.open(new Menus.LearnMenu(this, by)); }
  openInfo(tab = 1) { this.open(new Menus.InfoMenu(this, tab)); }
  startJob() { this.startTraining('job'); }
  startTraining(game) {
    const c = this.c, d = c.d;
    if (game !== 'job' && d.slot === 2 && false) return;
    const cost = game === 'job' ? 0 : 6000 + d.season * 2000;
    if (!c.canPay(cost)) { this.toast(`훈련비 ${fmtMoney(cost)}이(가) 부족하다`, '#ff8a8a'); this.game.audio.sfx('deny'); return; }
    this.open(new Training(this, game, cost));
  }
  // Start a match: kind official|free|practice|event|title|spar|dojo
  startMatch(kind, offer) {
    const c = this.c, d = c.d;
    const go = () => {
      const cfg = this.matchConfig(kind, offer);
      d.x = this.player.x;
      c.save();
      const here = this.loc, px = this.player.x;
      this.game.playMatch(cfg, res => {
        const W2 = new WorldScene(this.game, c, {});
        W2.enter(here, px, true);
        this.game.go(() => { W2.afterMatch({ kind, offer, res }); return W2; });
      });
    };
    if (kind !== 'practice' && kind !== 'spar' && d.injury >= B.injuryDanger) {
      this.open(new Menus.Confirm(this, `부상이 ${Math.round(d.injury)}%입니다. 이 경기에서 100%가 되면 선수 생명이 끝납니다(게임 오버). 그래도 나갈까요?`, go, { danger: 1 }));
      return;
    }
    go();
  }
  matchConfig(kind, o) {
    const c = this.c, d = c.d, me = c.entrant('human');
    const lv = o && o.difficulty || 'normal';
    const foe = id => ({ char: id, ctrl: 'ai', difficulty: lv });
    if (kind === 'practice' || kind === 'spar') return { mode: 'practice', arena: 'gym', entrants: [me, { char: o && o.opp || 'dohyun', ctrl: 'dummy', difficulty: 'normal' }], practice: { infinite: true }, skipIntro: true, career: 1, music: 'gym' };
    if (o && o.mode === 'rumble') { const pool = ['taesan', 'haneul', 'neon', 'mandeok', 'dongsu', 'bokja', 'dueok', 'palcho', 'baeksang', 'bjorn', 'baekpa', 'dohyun'], r = new RNG(d.day * 31); return { mode: 'rumble', arena: 'hall', entrants: [me, ...r.shuffle(pool).slice(0, 9).map(foe)], career: 1, title: '만선 럼블' }; }
    if (o && o.mode === 'tag') return { mode: 'tag', arena: o.arena || 'pier', entrants: [me, { char: 'dohyun', ctrl: 'ai', difficulty: 'hard' }, foe('dueok'), foe('baeksang')], career: 1, title: '항구 태그 대전' };
    return { mode: o && o.mode || 'single', arena: o && o.arena || 'hall', entrants: [me, foe(o ? o.opp : 'dohyun')], career: 1, boss: o && (o.title || o.opp === 'fogking'), title: o && o.title ? '챔피언 타이틀 매치' : o && o.kind === 'dojo' ? '도장 깨기' : null };
  }
  afterMatch(info) {
    const c = this.c, { kind, offer, res } = info;
    if (res.quit && kind === 'practice') { this.toast('연습을 마쳤다.'); return; }
    const sum = c.applyResult(kind === 'spar' ? 'practice' : kind, res, { offer });
    if (offer && offer.kind === 'dojo' && res.won) { c.d.flags['dojo_' + offer.opp] = 1; }
    if (kind === 'free' || kind === 'dojo') { const msgs = c.spendSlot(1); msgs.forEach(m => this.toast(m, '#ffb347')); }
    else if (kind === 'official' || kind === 'event' || kind === 'title') { const msgs = c.spendSlot(1); msgs.forEach(m => this.toast(m, '#ffb347')); }
    c.save();
    this.open(new Menus.ResultMenu(this, sum, res, kind, offer));
  }
  checkGameOver() { if (this.c.d.injury >= 100) { this.game.go(() => new Menus.GameOverScene(this.game, this.c)); return true; } return false; }
  // ---- update ----
  update(dt) {
    this.t += dt;
    const inp = this.game.input, A = this.game.audio, p = this.player, L = this.L;
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter(t => t.t < 3.4);
    if (this.fadeT > 0) { this.fadeT -= dt; if (this.fadeT <= .22 && this.fadeTo) { const f = this.fadeTo; this.fadeTo = null; f(); } }
    for (const a of this.npcs) this.npcThink(a, dt);
    if (this.overlays.length) { this.overlays[this.overlays.length - 1].update(dt); this.physics(p, dt, 0); p.pose(dt); for (const a of this.npcs) a.pose(dt); return; }
    if (this.dialog) { this.dialog.update(dt); this.physics(p, dt, 0); p.pose(dt); for (const a of this.npcs) a.pose(dt); return; }
    if (this.c.d.flags.seasonEnd && !this.fadeT) { this.c.d.flags.seasonEnd = false; this.open(new Menus.SeasonEndMenu(this)); return; }
    let mx = (inp.down('right') ? 1 : 0) - (inp.down('left') ? 1 : 0);
    if (this.fadeT > 0) mx = 0;
    this.physics(p, dt, mx);
    if (inp.pressed('up') && p.ground && !this.fadeT) { p.vy = -250; p.ground = false; A.sfx('jump'); }
    p.pose(dt);
    for (const a of this.npcs) a.pose(dt);
    // what is near?
    this.prompt = this.findPrompt();
    if (!this.fadeT) {
      if (inp.pressed('interact') && this.prompt && this.prompt.kind !== 'door') this.use(this.prompt);
      else if (inp.pressed('door') && this.prompt && this.prompt.kind === 'door') this.goDoor(this.prompt.door);
      else if (inp.pressed('interact') && this.prompt && this.prompt.kind === 'door') this.goDoor(this.prompt.door);
      if (inp.pressed('info')) { A.sfx('ui'); this.openInfo(1); }
      if (inp.pressed('map')) { A.sfx('ui'); this.open(new Menus.MapMenu(this)); }
      if (inp.pressed('pause')) { A.sfx('ui'); this.open(new Menus.PauseMenu(this)); }
    }
    const want = clamp(p.x - VIEW_W / 2 + p.face * 40, 0, Math.max(0, L.w - VIEW_W));
    this.camX = damp(this.camX, want, 5, dt);
  }
  physics(a, dt, mx) {
    const L = this.L, spd = 108;
    const want = mx * spd;
    a.vx = Math.abs(want) > 0 ? a.vx + clamp(want - a.vx, -1200 * dt, 1200 * dt) : a.vx * Math.max(0, 1 - dt * 14);
    if (mx) a.face = mx;
    a.vy += 900 * dt;
    a.x += a.vx * dt; a.y += a.vy * dt;
    if (a.y >= a.y0) { if (!a.ground && a.vy > 200) this.game.audio.sfx('land', { p: .4 }); a.y = a.y0; a.vy = 0; a.ground = true; }
    a.x = clamp(a.x, 18, L.w - 18);
    if (a.ground && Math.abs(a.vx) > 30) { a.stepT = (a.stepT || 0) + dt; if (a.stepT > .3) { a.stepT = 0; this.game.audio.sfx('step'); } }
  }
  npcThink(a, dt) {
    const p = this.player, d = Math.abs(a.x - p.x);
    if (d < 90) a.face = sgn(p.x - a.x) || a.face;
    if (a.wander && d > 120) {
      a.wT -= dt;
      if (a.wT <= 0) { a.wT = 2 + Math.random() * 3; a.target = a.home + (Math.random() * 2 - 1) * a.wander; }
      if (a.target != null && Math.abs(a.target - a.x) > 4) { a.vx = sgn(a.target - a.x) * 40; a.face = sgn(a.vx); } else a.vx = 0;
      a.x += a.vx * dt;
    } else a.vx = 0;
  }
  findPrompt() {
    const p = this.player, L = this.L;
    let best = null, bd = 34;
    for (const a of this.npcs) { const d = Math.abs(a.x - p.x); if (d < bd) { bd = d; best = { kind: 'npc', a, x: a.x, label: NPCS[a.id].name, verb: '대화' }; } }
    for (const d of L.doors) { const dd = Math.abs(d.x - p.x); if (dd < Math.min(bd, 26)) { bd = dd; best = { kind: 'door', door: d, x: d.x, label: d.label, verb: d.lock && !this.unlocked(d.lock) ? '잠김' : '들어가기' }; } }
    for (const o of L.objects) { const dd = Math.abs(o.x - p.x); if (dd < Math.max(18, o.w / 2) && dd < bd + 6) { bd = dd; best = { kind: 'obj', o, x: o.x, label: o.label, verb: '조사' }; } }
    return best;
  }
  use(pr) {
    const A = this.game.audio, c = this.c, d = c.d;
    if (pr.kind === 'npc') {
      const a = pr.a; a.face = sgn(this.player.x - a.x) || a.face; this.player.face = -a.face; a.talkT = 1.5; A.sfx('ui');
      this.say(talk(a.id, c, this));
      return;
    }
    const o = pr.o;
    switch (o.act) {
      case 'train': this.startTraining(o.game); break;
      case 'spar': this.say([{ who: 'trainer', text: '연습 링이다. 상대 행동, 체력을 바꿔 가며 기술을 시험해 봐. 기록도 부상도 남지 않아.' }, { choice: [{ label: '연습 경기 시작', act: () => this.startMatch('practice', { opp: 'dohyun' }) }, { label: '그만두기', go: [] }] }]); break;
      case 'vending': if (c.pay(3000)) { d.fatigue = Math.max(0, d.fatigue - 8); A.sfx('coin'); this.toast('이온 음료를 마셨다. 피로 -8 (₩3,000)', '#9be36b'); } else { A.sfx('deny'); this.toast('돈이 모자란다', '#ff8a8a'); } break;
      case 'schedule': this.say(this.scheduleLines()); break;
      case 'ranking': this.open(new Menus.RankMenu(this)); break;
      case 'rest': this.restMenu(); break;
      case 'trophy': this.say([{ who: null, name: '트로피', text: d.titles.length ? `진열장에 네 이름이 새겨진 트로피가 있다: ${d.titles.map(t => t.name).join(', ')}` : '역대 챔피언들의 트로피. 맨 위 칸은 3년째 안개왕의 것이다. 언젠가 저기에 내 이름을…' }]); break;
      case 'poster': this.say([{ who: null, name: '포스터', text: d.flags.champion ? '포스터 한가운데에 새 챔피언, 내 얼굴이 붙어 있다!' : c.rank <= 5 ? '구석에 작게, 내 얼굴이 들어간 포스터가 생겼다.' : '연맹 선수들의 포스터. 아직 내 얼굴은 없다.' }]); break;
      case 'card': this.openArenaList(); break;
      case 'enter': if (d.contract) this.openArenaList(); else this.say([{ who: 'staff', text: '계약된 경기가 없으면 입장할 수 없어요. 사장님께 먼저 가 보세요.' }]); break;
      case 'locker': this.say([{ who: null, name: '사물함', text: `네 사물함이다. 붕대 ${d.items.bandage || 0}개, 음료 ${d.items.drink || 0}개가 들어 있다. (Tab → 소지품에서 사용)` }]); break;
      case 'bench': this.say([{ who: null, name: '벤치', text: '경기 전 긴장이 몰려온다. 숨을 고르자.' }]); break;
      case 'mirror': this.say([{ who: 'me', text: c.rank <= 3 ? '…이제 제법 챔피언 같은 얼굴이다.' : '거울 속의 나. 아직 갈 길이 멀다.' }]); break;
      case 'fish': this.say([{ who: 'boss', text: '그 물고기들 이름은 다 전 챔피언 이름일세. 저 큰 놈이 "백파"야.' }]); break;
      case 'pojang': this.openFood(); break;
      case 'plaza': this.say(this.plazaLines()); break;
      case 'fountain': if (c.pay(500)) { A.sfx('coin'); this.say([{ who: 'me', text: '동전을 던졌다. "챔피언이 되게 해 주세요."' }]); d.flags.wish = (d.flags.wish || 0) + 1; } break;
      case 'job': this.say(talk('foreman', c, this)); break;
      case 'clinicBoard': this.openClinic(); break;
      case 'bed': this.openClinic(); break;
      case 'racks': this.openShop(); break;
      case 'sale': this.openShop(); break;
      case 'dojo': this.dojoMenu(); break;
      case 'domeGate': if (d.contract && d.contract.title) this.startMatch('title', d.contract); else this.say([{ who: 'staff', text: '타이틀 매치가 있는 날에만 열립니다.' }]); break;
      default: this.toast(o.label);
    }
  }
  restMenu() {
    const c = this.c, d = c.d;
    this.say([{ who: null, name: '소파', text: `지금은 ${SLOT_NAMES[d.slot]}. 피로 ${Math.round(d.fatigue)}. (부상은 쉬어도 낫지 않는다)` }, { choice: [
      { label: '잠깐 쉬기 (시간 1칸, 피로 -30)', act: () => { if (d.slot === 2) { this.sleepNow(); return; } d.fatigue = Math.max(0, d.fatigue - 30); c.spendSlot(1).forEach(m => this.toast(m, '#ffb347')); this.toast('푹 쉬었다. 피로 -30'); c.save(); } },
      { label: '자고 다음 날로 (피로 -70, 저장)', act: () => this.sleepNow() },
      { label: '그만두기', go: [] },
    ] }]);
  }
  sleepNow() {
    const c = this.c, d = c.d;
    if (d.contract && d.contract.day <= d.day) { this.open(new Menus.Confirm(this, `오늘이 ${josa(d.contract.oppName, '과/와')}의 계약 경기 마감일입니다. 자면 기권패가 됩니다. 그래도 잘까요?`, () => this.doSleep())); return; }
    this.doSleep();
  }
  doSleep() { const msgs = this.c.sleep(); this.fadeT = .9; this.fadeTo = () => { this.enter(this.loc, this.player.x); msgs.forEach(m => this.toast(m, '#ffb347')); this.toast(`${this.c.d.day}일차 아침. 자동 저장했다.`, '#9be36b'); }; this.game.audio.sfx('heal'); }
  scheduleLines() {
    const d = this.c.d, out = [];
    out.push({ who: null, name: '경기 일정판', text: `오늘은 시즌 ${d.season}, ${d.day}일차 ${SLOT_NAMES[d.slot]}. 시즌은 ${28}일까지.` });
    out.push(d.contract ? `{y}계약 경기{/}: ${d.contract.oppName} — ${d.contract.day}일까지 (보수 ${fmtMoney(d.contract.reward)})` : '계약 경기 없음. 사장실에서 제안을 받자.');
    out.push('14일: {y}만선 럼블{/} · 21일: {y}항구 태그 대전{/} · 28일: 시즌 결산');
    return out;
  }
  plazaLines() {
    const d = this.c.d;
    if (d.day % 7 === 3 && d.flags.plazaDay !== d.day) { d.flags.plazaDay = d.day; this.c.d.fame += 2; return [{ who: null, name: '광장', text: '광장에서 팬 사인회가 열리고 있다! 사람들이 몰려와 사인을 받아 갔다. (명성 +2)' }]; }
    return [{ who: null, name: '등대 광장', text: '바닷바람이 분다. 멀리 등대 돔의 불빛이 보인다.' }];
  }
  dojoMenu() {
    const c = this.c, d = c.d;
    const list = ['gosu', 'ironma'].filter(id => !d.flags['dojo_' + id]);
    if (!list.length) { this.say([{ who: 'gosu', text: '이미 우리 둘 다 이겼잖아. 도장은 네 거야… 청소는 우리가 할게.' }, { choice: [{ label: '기술 배우기', act: () => this.openLearn('rival') }, { label: '그만두기', go: [] }] }]); return; }
    const id = list[0], ch = CHARACTERS[id];
    this.say([{ who: id, text: `도장 깨기? 좋아. 상대는 ${ch.name}. 이기면 ${fmtMoney(45000)}, 그리고 우리 기술을 가르쳐 주지.` }, { choice: [
      { label: '도전한다', act: () => this.startMatch('dojo', { opp: id, oppName: ch.name, reward: 45000, fame: 8, kind: 'dojo', difficulty: d.season >= 2 ? 'expert' : 'hard', arena: 'gym' }) },
      { label: '기술만 배우기', act: () => this.openLearn('rival') },
      { label: '그만두기', go: [] },
    ] }]);
  }
  // ---- draw ----
  draw(w, u) {
    const L = this.L, cam = Math.round(this.camX), d = this.c.d;
    if (L.street) {
      const key = 'far' + d.slot;
      if (!this.farCache[key]) this.farCache[key] = streetFar(L, d.slot);
      w.drawImage(this.farCache[key], Math.round(-cam * .4), 0);
    } else rect(w, '#05060f', 0, 0, VIEW_W, VIEW_H);
    drawWindows(w, L, cam, d.slot);
    w.drawImage(L.bg, -cam, 0);
    drawWindows.after && drawWindows.after(w);
    // people
    const all = [...this.npcs, this.player].sort((a, b) => a.y - b.y);
    for (const a of all) this.drawActor(w, a, cam);
    // lights
    this.lights(w, cam);
    if (d.slot === 2 && L.street) { w.globalAlpha = .18; rect(w, '#0a0830', 0, 0, VIEW_W, VIEW_H); w.globalAlpha = 1; }
    u.clearRect(0, 0, VIEW_W, VIEW_H);
    this.hud(u);
    if (this.prompt && !this.dialog && !this.overlays.length) this.drawPrompt(u, cam);
    if (this.dialog) this.dialog.draw(u);
    for (const o of this.overlays) o.draw(u, w);
    this.drawToasts(u);
    if (this.fadeT > 0) fade(u, clamp(this.fadeT > .22 ? (.45 - this.fadeT) / .22 : this.fadeT / .22, 0, 1));
  }
  drawActor(g, a, cam) {
    const bc = this.bc, j = a.joints;
    const tmp = this.tmp || (this.tmp = new Joints());
    tmp.copy(j); for (let i = 0; i < JN; i++) tmp.p[i * 2] -= cam;
    g.globalAlpha = .35; rect(g, '#04030a', Math.round(tmp.x(0) - 12), Math.round(a.y0) - 1, 24, 3); g.globalAlpha = 1;
    bc.begin(tmp.x(0), tmp.y(0) - 4);
    const tails = a.tails ? a.tails.map(T => ({ pts: Array.from(T.pts, (v, i) => (i % 2 ? v : v - cam)), w: T.w, c: T.c, front: T.front })) : null;
    drawBody(bc, tmp, a.dims, a.look, { expr: a.faceExpr, hand: 'fist', tails, cape: false });
    bc.finish();
    bc.drawTo(g);
  }
  lights(w, cam) {
    const L = this.L, d = this.c.d;
    if (this.loc === 'lobby') { for (const x of [200, 560, 940]) glow(w, x - cam, 66, 60, '#ffcf7a', .18); glow(w, 560 - cam, 60, 90, '#ff5fa2', .12); }
    else if (this.loc === 'gym') for (const x of [420, 700, 980]) glow(w, x - cam, 62, 70, '#ffe0b0', .16);
    else if (this.loc === 'office') glow(w, 400 - cam, 70, 90, '#ffcf7a', .2);
    else if (this.loc === 'arena') { glow(w, 724 - cam, 110, 70, '#ff5fa2', .2); glow(w, 300 - cam, 64, 60, '#ffcf7a', .16); }
    else if (L.street) { if (d.slot === 2) for (let x = 30; x < L.w; x += 260) glow(w, x - cam, FLOOR - 118, 50, '#ffe0a0', .3); glow(w, 210 - cam, 110, 90, '#ff5fa2', .15); }
  }
  hud(u) {
    const c = this.c, d = c.d, t = this.t;
    panel(u, 4, 4, 632, 26, { alpha: .9, cut: 3, accent: '#49d6ff' });
    drawText(u, this.L.name, 12, 9, { color: '#ffffff', bold: true });
    drawText(u, c.timeText, 126, 10, { size: 11, color: UI.dim });
    icon(u, 'coin', 258, 13, '#ffd65a'); drawText(u, c.money(), 268, 10, { size: 11, color: UI.money });
    icon(u, 'star', 340, 13, '#ffd65a'); drawText(u, '명성 ' + d.fame, 350, 10, { size: 11, color: UI.fame });
    icon(u, 'rank', 404, 13, '#c9d4ff'); drawText(u, d.flags.champion ? '챔피언' : c.rank + '위', 414, 10, { size: 11, color: '#c9d4ff' });
    // injury gauge: only shown out of the ring
    const lvl = c.injuryLevel, col = lvl === 'danger' ? '#ff5b5b' : lvl === 'warn' ? '#ffb347' : UI.inj;
    icon(u, 'bandage', 456, 13, col);
    drawText(u, '부상', 467, 10, { size: 11, color: col });
    gauge(u, 492, 13, 70, 6, d.injury / 100, 'inj', { col, colD: '#3a1450', blink: lvl !== 'ok', blinkBelow: 2, time: t });
    drawText(u, Math.round(d.injury) + '%', 566, 10, { size: 11, color: col });
    drawText(u, '피로 ' + Math.round(d.fatigue), 630, 10, { size: 11, align: 'r', color: d.fatigue > 70 ? '#ff8a8a' : UI.dim });
    if (lvl !== 'ok' && Math.floor(t * 2) % 2) drawText(u, lvl === 'danger' ? '! 부상 위험: 항구의원에서 치료하세요' : '! 부상 주의', 632, 34, { size: 11, align: 'r', color: col, outline: '#05060f' });
    if (d.contract) drawText(u, `계약: ${d.contract.oppName} (~${d.contract.day}일)`, 8, 34, { size: 11, color: d.contract.day <= d.day ? '#ffb347' : '#c9d4ff', outline: '#05060f' });
    if (d.points > 0) drawText(u, `능력치 포인트 ${d.points} (Tab)`, 8, 47, { size: 11, color: '#6be38a', outline: '#05060f' });
    const inp = this.game.input;
    drawText(u, `${inp.label('interact')} 대화/조사 · ${inp.label('door')} 문 · ${inp.label('info')} 정보 · ${inp.label('map')} 지도 · ${inp.label('pause')} 메뉴`, 632, 348, { size: 11, align: 'r', color: UI.faint, outline: '#05060f' });
  }
  drawPrompt(u, cam) {
    const pr = this.prompt, inp = this.game.input;
    const x = Math.round(pr.x - cam), y = pr.kind === 'npc' ? Math.round(pr.a.joints.y(J.head) - 34) : FLOOR - 128;
    const key = pr.kind === 'door' ? inp.label('door') : inp.label('interact');
    const text = `${pr.verb}: ${pr.label}`, w = textWidth(text, 11) + 26;
    const bob = Math.round(Math.sin(this.t * 6) * 1.5);
    rect(u, '#05060f', x - w / 2 - 1, y - 1 + bob, w + 2, 17); rect(u, pr.verb === '잠김' ? '#5a1a2a' : '#1b2450', x - w / 2, y + bob, w, 15);
    keycap(u, key, x - w / 2 + 2, y + 1 + bob);
    drawText(u, text, x - w / 2 + 20, y + 2 + bob, { size: 11, color: '#ffffff' });
    rect(u, '#1b2450', x - 2, y + 15 + bob, 4, 3);
  }
  drawToasts(u) { this.toasts.forEach((t, i) => { const a = t.t > 2.9 ? (3.4 - t.t) / .5 : 1; u.globalAlpha = clamp(a, 0, 1); const w = textWidth(t.text, 11) + 12; rect(u, 'rgba(5,6,15,.8)', 320 - w / 2, 60 + i * 18, w, 15); drawText(u, t.text, 320, 62 + i * 18, { size: 11, align: 'c', color: t.col }); u.globalAlpha = 1; }); }
}
const worldMix = mixHex;
const worldPrompt = prompt;
const worldVH = VIEW_H;

return { WorldScene, worldMix, worldPrompt, worldVH };
})();
// ---- world/CreateScene.js
__m["world/CreateScene.js"] = (function () {
// Create your wrestler: name (Korean input works), style, body, face, hair, mask and colours.
const { VIEW_W, VIEW_H, RNG, clamp } = __m["core/util.js"];
const { drawText } = __m["render/pixelfont.js"];
const { UI, SKINS, mixHex } = __m["render/palette.js"];
const { rect, bands, cone } = __m["render/painter.js"];
const { panel, prompt, gauge } = __m["render/ui.js"];
const { Mannequin } = __m["scenes/TitleScene.js"];
const { STYLE_BASE } = __m["world/CareerManager.js"];
const { FINISHERS } = __m["data/moves.js"];
const { STYLES } = __m["data/characters.js"];
const COLORS = ['#157f8c', '#c2333f', '#2d63b8', '#ffd65a', '#ff8a2b', '#7c5ab8', '#e6e9f2', '#23263a', '#3fe0d0', '#ff4fa3', '#35a07a', '#8a5a34', '#5a6688', '#1c1424', '#b8323f', '#6be38a'];
const HAIRCOL = ['#1b1420', '#3a2630', '#5a3a2a', '#c9b07a', '#d26a3a', '#e8e4ee', '#3a3f6a', '#ff6fb0', '#3fd46b', '#49d6ff'];
const OPTS = {
  style: ['all', 'power', 'air', 'tech', 'brawl', 'heavy'],
  build: ['auto', 'athletic', 'power', 'lean', 'heavy', 'fem', 'femPower'],
  skin: Object.keys(SKINS),
  face: ['square', 'round', 'long', 'slim', 'jaw', 'fat'],
  hair: ['side', 'short', 'buzz', 'spiky', 'mohawk', 'slick', 'afro', 'curly', 'topknot', 'bob', 'wave', 'mullet', 'bald', 'flat'],
  hairCol: HAIRCOL,
  beard: ['none', 'stubble', 'goatee', 'mustache', 'full', 'chops'],
  mask: ['none', 'half', 'wave', 'gull', 'shark', 'anchor', 'oni'],
  top: ['none', 'singlet', 'strap', 'tank', 'vest', 'bra', 'harness'],
  bottom: ['tights', 'trunks', 'shorts', 'pants'],
  c1: COLORS, c2: COLORS, boots: COLORS,
};
const LABEL = {
  style: ['올라운더', '파워하우스', '하이플라이어', '테크니션', '브롤러', '슈퍼 헤비급'], build: ['스타일에 맞춤', '탄탄', '근육', '날렵', '거구', '여성 · 날렵', '여성 · 근육'],
  face: ['각진', '둥근', '긴', '갸름', '턱', '통통'], hair: ['옆가르마', '짧은 머리', '삭발', '뾰족', '모히칸', '올백', '아프로', '곱슬', '상투', '단발', '긴 웨이브', '멀릿', '대머리', '각진 머리'],
  beard: ['없음', '거뭇', '염소', '콧수염', '덥수룩', '구레나룻'], mask: ['없음', '반가면', '파도', '갈매기', '상어', '닻', '도깨비'], top: ['맨몸', '싱글렛', '한쪽 끈', '민소매', '조끼', '스포츠 브라', '하네스'], bottom: ['타이츠', '트렁크', '반바지', '바지'],
  skin: ['아주 밝음', '밝음', '보통', '갈색', '어두움', '회색'],
};
const ROWS = ['name', 'style', 'build', 'skin', 'face', 'hair', 'hairCol', 'beard', 'mask', 'top', 'bottom', 'c1', 'c2', 'boots', 'random', 'start'];
const ROWNAME = { name: '이름', style: '스타일', build: '체격', skin: '피부', face: '얼굴형', hair: '머리 모양', hairCol: '머리 색', beard: '수염', mask: '마스크', top: '상의', bottom: '하의', c1: '주 색', c2: '보조 색', boots: '부츠 색', random: '무작위로 만들기', start: '이 선수로 시작' };

class CreateScene {
  constructor(game, done) {
    this.game = game; this.done = done; this.t = 0; this.row = 0; this.man = new Mannequin(); this.name = '';
    this.v = { style: 'all', build: 'auto', skin: 'tan', face: 'square', hair: 'side', hairCol: '#2b3350', beard: 'none', mask: 'none', top: 'none', bottom: 'tights', c1: '#157f8c', c2: '#ffd65a', boots: '#23263a' };
    game.audio.music('lobby');
    this.input = null;
  }
  look() {
    const v = this.v, S = STYLE_BASE[v.style];
    const build = v.build === 'auto' ? S.build : v.build;
    const fem = build.startsWith('fem');
    const head = { face: v.face, hair: v.hair, hairCol: v.hairCol, beard: v.beard === 'none' ? null : v.beard, lashes: fem ? 1 : 0, lips: fem ? '#c23a4a' : null };
    if (v.mask === 'half') head.mask = { c1: v.c1 };
    else if (v.mask !== 'none') head.mask = { full: 1, kind: v.mask, c1: v.c1, c2: v.c2, c3: '#ffd65a' };
    const top = v.top === 'bra' && !fem ? { kind: 'none' } : { kind: v.top, c1: v.c1, c2: v.c2 };
    return { build, scale: build === 'heavy' ? 1.05 : 1, skin: v.skin, head, top, bottom: { kind: v.bottom, c1: v.c1, c2: v.c2, pat: v.bottom === 'tights' ? 'side' : v.bottom === 'trunks' ? 'bands' : null }, boots: { c1: v.boots, c2: v.c2, h: v.bottom === 'pants' ? 0 : .72 }, wrist: { c: '#f2efe4', len: .32 }, knee: v.bottom === 'pants' ? null : v.boots };
  }
  randomize() {
    const r = new RNG(Date.now() & 0xffffff), v = this.v;
    for (const k of ['skin', 'face', 'hair', 'hairCol', 'beard', 'top', 'bottom', 'c1', 'c2', 'boots']) v[k] = r.pick(OPTS[k]);
    v.mask = r.chance(.25) ? r.pick(OPTS.mask.slice(1)) : 'none';
    if (v.c1 === v.c2) v.c2 = r.pick(COLORS);
  }
  openInput() {
    if (typeof document === 'undefined') return;
    const el = this.input = document.createElement('input');
    el.maxLength = 8; el.value = this.name; el.placeholder = '이름 (최대 8자)';
    const cv = document.getElementById('game'), r = cv.getBoundingClientRect(), k = r.width / VIEW_W;
    Object.assign(el.style, { position: 'fixed', left: r.left + 120 * k + 'px', top: r.top + 74 * k + 'px', width: 170 * k + 'px', height: 16 * k + 'px', fontSize: 11 * k + 'px', background: '#0b0f22', color: '#ffffff', border: '2px solid #ffd65a', outline: 'none', padding: '0 4px', zIndex: 10, fontFamily: 'sans-serif' });
    document.body.appendChild(el);
    this.game.input.textMode = true;
    const finish = () => { if (!this.input) return; this.name = el.value.trim().slice(0, 8); el.remove(); this.input = null; this.game.input.textMode = false; this.game.input.clear(); this.game.audio.sfx('ok'); };
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); finish(); } e.stopPropagation(); });
    el.addEventListener('blur', finish);
    setTimeout(() => el.focus(), 30);
  }
  update(dt) {
    this.t += dt;
    if (this.input) return;
    const inp = this.game.input, A = this.game.audio;
    if (inp.pressed('up')) { this.row = (this.row + ROWS.length - 1) % ROWS.length; A.sfx('ui'); }
    if (inp.pressed('down')) { this.row = (this.row + 1) % ROWS.length; A.sfx('ui'); }
    const k = ROWS[this.row];
    if (OPTS[k] && (inp.pressed('left') || inp.pressed('right'))) { const L = OPTS[k], i = L.indexOf(this.v[k]); this.v[k] = L[(i + (inp.pressed('left') ? -1 : 1) + L.length) % L.length]; A.sfx('ui', { pitch: 1.2 }); }
    if (inp.menuPressed('cancel')) { A.sfx('back'); this.game.toTitle(); return; }
    if (inp.menuPressed('confirm')) {
      if (k === 'name') this.openInput();
      else if (k === 'random') { this.randomize(); A.sfx('ok'); }
      else if (k === 'start') {
        if (!this.name) { this.row = 0; this.openInput(); return; }
        A.sfx('ok');
        this.done({ name: this.name, style: this.v.style, look: this.look() });
      } else if (OPTS[k]) { const L = OPTS[k], i = L.indexOf(this.v[k]); this.v[k] = L[(i + 1) % L.length]; A.sfx('ui'); }
    }
  }
  show(k) {
    const v = this.v[k], L = OPTS[k];
    if (LABEL[k]) return LABEL[k][L.indexOf(v)] || v;
    return '';
  }
  draw(w, u) {
    bands(w, 0, 0, VIEW_W, VIEW_H, ['#0b0f22', '#0e1430', '#111a3a', '#141f44', '#17244c']);
    cone(w, 470, 0, 30, 170, 340, '#ffd65a', .12);
    rect(w, '#1b2450', 360, 300, 280, 60); rect(w, '#26315f', 360, 300, 280, 2);
    const look = this.look();
    this.man.draw(w, look, STYLE_BASE[this.v.style].stance, 470, 300, Math.sin(this.t * .5) > -.6 ? 1 : -1, this.t, { env: { rim: '#ff5fa2' } });
    u.clearRect(0, 0, VIEW_W, VIEW_H);
    drawText(u, '선수 만들기', 20, 12, { scale: 2, color: '#ffd65a', bold: true, outline: '#05060f' });
    panel(u, 14, 46, 330, ROWS.length * 17 + 12, { alpha: .92 });
    ROWS.forEach((k, i) => {
      const y = 53 + i * 17, on = i === this.row;
      if (on) rect(u, mixHex(UI.accent, UI.panel, .55), 18, y - 2, 322, 16);
      drawText(u, ROWNAME[k], 26, y, { size: 11, color: on ? '#ffffff' : UI.dim });
      if (k === 'name') drawText(u, this.input ? '' : (this.name || '(Enter로 입력)'), 120, y, { size: 11, color: this.name ? '#ffd65a' : UI.faint });
      else if (OPTS[k]) {
        if (['hairCol', 'c1', 'c2', 'boots'].includes(k)) { rect(u, '#05060f', 199, y, 42, 11); rect(u, this.v[k], 200, y + 1, 40, 9); drawText(u, '◀        ▶', 220, y, { size: 11, align: 'c', color: on ? '#ffd65a' : UI.faint }); }
        else drawText(u, '◀ ' + this.show(k) + ' ▶', 334, y, { size: 11, align: 'r', color: on ? '#ffd65a' : '#c9d4ff' });
      }
    });
    const S = STYLE_BASE[this.v.style], st = S.stats, F = FINISHERS[S.finisher];
    panel(u, 360, 46, 266, 120, { accent: '#ff5fa2', alpha: .9 });
    drawText(u, STYLES[this.v.style].name, 370, 52, { color: '#ffffff', bold: true });
    drawText(u, STYLES[this.v.style].desc, 370, 68, { size: 11, color: '#ff8fc4' });
    [['체력', (st.hp - 60) / 90], ['기절 저항', (st.stun - 60) / 80], ['공격력', (st.atk - .6) / .75], ['잡기', (st.grp - .6) / .75], ['속도', (st.spd - .6) / .75], ['점프', (st.jump - .6) / .75]].forEach(([n, v], i) => { drawText(u, n, 370, 84 + i * 11, { size: 11, color: UI.dim }); gauge(u, 440, 88 + i * 11, 100, 4, clamp(v, .05, 1), 'fin', { col: '#ff8fc4' }); });
    drawText(u, '피니셔: ' + F.name, 370, 152, { size: 11, color: '#ffd65a' });
    prompt(u, ['↑↓'], '항목', 20, 338, {}); prompt(u, ['←→'], '바꾸기', 90, 338, {}); prompt(u, ['Enter'], '결정', 170, 338, {}); prompt(u, ['Esc'], '타이틀', 250, 338, {});
  }
}

return { CreateScene };
})();
// ---- main.js
__m["main.js"] = (function () {
// Entry point: builds the game and wires the top-level flow (title, quick match, career).
const { GameManager } = __m["core/GameManager.js"];
const { TitleScene } = __m["scenes/TitleScene.js"];
const { MatchScene } = __m["scenes/MatchScene.js"];
const { SettingsOverlay } = __m["scenes/SettingsScene.js"];
const { Career, hasCareer } = __m["world/CareerManager.js"];
const { WorldScene } = __m["world/WorldScene.js"];
const { CreateScene } = __m["world/CreateScene.js"];
const canvas = document.getElementById('game');
const game = new GameManager(canvas);
game.toTitle = () => game.go(() => new TitleScene(game, { hasSave: hasCareer(1), onCareer: kind => startCareer(kind) }));
game.playMatch = (cfg, after) => game.go(() => new MatchScene(game, cfg, res => after && after(res)));
game.openSettings = () => game.push(new SettingsOverlay(game));
function startCareer(kind) {
  if (kind === 'continue') { const c = Career.load(1); if (c) { game.career = c; game.go(() => new WorldScene(game, c)); return; } }
  game.go(() => new CreateScene(game, look => { const c = Career.create(1, look); game.career = c; game.go(() => new WorldScene(game, c, { intro: true })); }));
}
game.startCareer = startCareer;
game.toTitle();
game.start();
// Test hook: step the game by hand from the console or a test driver.
window.__NHS = { game, step(n = 1, dt = 1 / 60) { game.manual = true; for (let i = 0; i < n; i++) game.step(dt); }, auto() { game.manual = false; } };

return {  };
})();
