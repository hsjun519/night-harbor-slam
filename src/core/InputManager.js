// Keyboard and gamepad mapped to actions. Bindings are data and can be changed in the settings screen.
export const ACTIONS = {
  left: '왼쪽', right: '오른쪽', up: '점프 / 위', down: '방어 / 아래', atk: '공격', grab: '잡기', dodge: '회피 / 반격', fin: '피니셔', interact: '대화 / 조사', door: '문 / 이동', info: '선수 정보', map: '지도', pause: '일시정지',
  mq: '잡기 칸 Q', me: '잡기 칸 E', mr: '잡기 칸 R', mf: '잡기 칸 F',
};
export const DEFAULT_KEYS = {
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
  atk: ['KeyJ'], grab: ['KeyK'], dodge: ['KeyL'], fin: ['Space'], interact: ['KeyE'], door: ['KeyF'], info: ['Tab'], map: ['KeyM'], pause: ['Escape', 'KeyP'],
  mq: ['KeyQ'], me: ['KeyE'], mr: ['KeyR'], mf: ['KeyF'],
};
// Menus also accept these.
const MENU = { confirm: ['Enter', 'Space', 'KeyJ', 'KeyE'], cancel: ['Escape', 'Backspace', 'KeyL'] };
const PAD = { up: [12], down: [13], left: [14], right: [15], atk: [2], grab: [3], dodge: [1], fin: [5, 7], jumpPad: [0], guardPad: [4, 6], pause: [9], info: [8], interact: [0], door: [3], confirm: [0], cancel: [1], map: [8] };
const NAMES = { Space: 'Space', Escape: 'Esc', Enter: 'Enter', Tab: 'Tab', Backspace: '←Bksp', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl', AltLeft: 'Alt', Backquote: '`', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=' };
export function keyLabel(code) { if (!code) return '?'; if (NAMES[code]) return NAMES[code]; if (code.startsWith('Key')) return code.slice(3); if (code.startsWith('Digit')) return code.slice(5); if (code.startsWith('Numpad')) return 'N' + code.slice(6); return code; }

export class InputManager {
  constructor() {
    this.keys = JSON.parse(JSON.stringify(DEFAULT_KEYS));
    this.held = new Set(); this.downNow = new Set(); this.upNow = new Set();
    this.padHeld = new Set(); this.padPrev = new Set(); this.axisX = 0; this.axisY = 0;
    this.device = 'kb'; this.textMode = false; this.textHook = null; this.capture = null; this.any = false; this.lastCode = null;
    this.focusLost = false;
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', e => this.onKey(e, true));
      window.addEventListener('keyup', e => this.onKey(e, false));
      window.addEventListener('blur', () => { this.held.clear(); this.focusLost = true; });
    }
  }
  setBindings(b) { if (b) for (const k in DEFAULT_KEYS) if (Array.isArray(b[k]) && b[k].length) this.keys[k] = b[k].slice(0, 2); }
  onKey(e, d) {
    // A text box is open. Keys typed into it never reach here (it stops them); keys that do arrive mean the
    // box lost focus, so the box decides (Enter/Esc close it, anything else gives it the focus back).
    if (this.textMode) { if (this.textHook) this.textHook(e, d); return; }
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
  // "Do it" outside a match (mini-games, prompts): attack, finisher, interact or any menu confirm key.
  actPressed() { return this.pressed('atk') || this.pressed('fin') || this.pressed('interact') || this.menuPressed('confirm'); }
  actDown() { if (this.down('atk') || this.down('fin') || this.down('interact')) return true; for (const c of MENU.confirm) if (this.held.has(c)) return true; for (const b of PAD.confirm) if (this.padHeld.has(b)) return true; return false; }
  // Fill a fighter intent from the current state.
  fillIntent(I) {
    I.mx = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0);
    I.up = this.down('up'); I.down = this.down('down'); I.downEdge = this.pressed('down');
    I.jump = this.pressed('up'); I.atk = this.pressed('atk'); I.grab = this.pressed('grab'); I.dodge = this.pressed('dodge'); I.fin = this.pressed('fin');
    I.slot = this.down('mq') ? 'q' : this.down('me') ? 'e' : this.down('mr') ? 'r' : this.down('mf') ? 'fk' : null;   // Q/E/R/F + K: the extra grab slots
  }
  label(a) {
    if (this.device === 'pad') { const n = { atk: 'X', grab: 'Y', dodge: 'B', fin: 'RB', up: 'A', down: 'LB', interact: 'A', door: 'Y', pause: 'Start', info: 'Back', map: 'Back', left: '◀', right: '▶', confirm: 'A', cancel: 'B' }; return n[a] || a; }
    if (a === 'confirm') return 'Enter'; if (a === 'cancel') return 'Esc';
    return keyLabel((this.keys[a] || [])[0]);
  }
  captureNext(fn) { this.capture = fn; }
  clear() { this.held.clear(); this.downNow.clear(); this.upNow.clear(); }
}
