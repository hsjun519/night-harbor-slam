// Output stage. The game draws two 640x360 layers (world, ui); WebGL scales them with sharp-bilinear
// filtering and adds bloom, camera zoom/shake, tint, vignette and flashes. Falls back to plain 2D.
import { VIEW_W, VIEW_H, makeCanvas, ctxOf, clamp, damp } from '../core/util.js';

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

export class Screen {
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
