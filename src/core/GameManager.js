// Main loop, scene stack, fades, shared services (screen, input, audio, settings).
import { VIEW_W, VIEW_H, clamp } from './util.js';
import { Screen } from '../render/screen.js';
import { InputManager } from './InputManager.js';
import { AudioManager } from './AudioManager.js';
import { loadSettings, saveSettings } from './SaveManager.js';
import { rect } from '../render/painter.js';

export class GameManager {
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
import { drawText } from '../render/pixelfont.js';
import { panel, keycap, fade } from '../render/ui.js';
import { UI } from '../render/palette.js';
export class ControlsOverlay {
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
