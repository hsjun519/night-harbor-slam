// Settings: volumes, screen effects and key bindings (changes are saved).
import { drawText } from '../render/pixelfont.js';
import { UI } from '../render/palette.js';
import { panel, menuList, fade, keycap } from '../render/ui.js';
import { ACTIONS, DEFAULT_KEYS, keyLabel } from '../core/InputManager.js';
import { rect } from '../render/painter.js';

export class SettingsOverlay {
  constructor(game) { this.game = game; this.sel = 0; this.page = 0; this.wait = null; }
  items() {
    const s = this.game.settings, pct = v => Math.round(v * 100) + '%';
    if (this.page === 0) return [
      { label: '전체 음량', value: pct(s.master), k: 'master', step: .1 }, { label: '음악', value: pct(s.music), k: 'music', step: .1 }, { label: '효과음', value: pct(s.sfx), k: 'sfx', step: .1 },
      { label: '화면 흔들림', value: pct(s.shake), k: 'shake', step: .25 }, { label: '번쩍임 효과', value: pct(s.flash), k: 'flash', step: .25 }, { label: '주사선 효과', value: s.scan ? '켬' : '끔', k: 'scan', toggle: 1 },
      { label: '입장 연출', value: s.entrance === 0 ? '끄기' : s.entrance === .5 ? '짧게' : '전체', k: 'entrance', list: [1, .5, 0] },
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
