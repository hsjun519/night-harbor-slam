// Create your wrestler: name (Korean input works), style, body, face, hair, mask and colours.
import { VIEW_W, VIEW_H, RNG, clamp } from '../core/util.js';
import { drawText } from '../render/pixelfont.js';
import { UI, SKINS, mixHex } from '../render/palette.js';
import { rect, bands, cone } from '../render/painter.js';
import { panel, prompt, gauge } from '../render/ui.js';
import { Mannequin } from '../scenes/TitleScene.js';
import { STYLE_BASE, hasCareer } from './CareerManager.js';
import { FINISHERS } from '../data/moves.js';
import { STYLES } from '../data/characters.js';

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

export class CreateScene {
  constructor(game, done, slot = 1, confirmed = false) {
    this.game = game; this.done = done; this.slot = slot; this.confirmed = confirmed; this.t = 0; this.row = 0; this.man = new Mannequin(); this.name = '';
    this.v = { style: 'all', build: 'auto', skin: 'tan', face: 'square', hair: 'side', hairCol: '#2b3350', beard: 'none', mask: 'none', top: 'none', bottom: 'tights', c1: '#157f8c', c2: '#ffd65a', boots: '#23263a' };
    game.audio.music('lobby');
    this.input = null; this.cool = 0; this.autoT = .45; this.okT = 0; this.afterName = null; this.ask = null;
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
  // The name is typed into a real text box laid over the name row, so Korean input methods work.
  // Enter must work in every way browsers report it: a plain Enter, an Enter that also commits a Hangul
  // syllable (key "Process"/keyCode 229 while composing, sometimes followed by a second plain Enter),
  // and an Enter that reaches the window because the box lost focus.
  openInput() {
    if (typeof document === 'undefined' || this.input) return;
    const inp = this.game.input;
    const el = this.input = document.createElement('input');
    el.type = 'text'; el.maxLength = 8; el.value = this.name; el.placeholder = '이름 입력 후 Enter';
    el.autocomplete = 'off'; el.spellcheck = false; el.setAttribute('enterkeyhint', 'done'); el.setAttribute('aria-label', '선수 이름 (최대 8자)');
    Object.assign(el.style, { position: 'fixed', boxSizing: 'border-box', background: '#0b0f22', color: '#ffd65a', border: '2px solid #ffd65a', borderRadius: '0', outline: 'none', padding: '0 4px', margin: '0', zIndex: 10, fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif", fontWeight: 'bold' });
    this.placeInput();
    document.body.appendChild(el);
    inp.textMode = true;
    this.composing = false; this.wantDone = false;
    const enterKey = e => e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.keyCode === 13;
    el.addEventListener('compositionstart', () => { this.composing = true; });
    el.addEventListener('compositionend', () => { this.composing = false; if (this.wantDone) setTimeout(() => this.finishInput(), 0); });
    el.addEventListener('keydown', e => {
      e.stopPropagation();
      if (enterKey(e)) {
        if (e.repeat) { e.preventDefault(); return; }
        // still composing a syllable: let the input method commit it first, then close
        if (e.isComposing || e.keyCode === 229 || this.composing) { this.wantDone = true; setTimeout(() => { if (!this.composing) this.finishInput(); }, 40); return; }
        e.preventDefault(); this.finishInput(); return;
      }
      if (e.key === 'Escape' || e.code === 'Escape') { e.preventDefault(); this.finishInput(); }
    });
    el.addEventListener('keyup', e => e.stopPropagation());
    el.addEventListener('blur', () => setTimeout(() => { if (this.input === el && document.activeElement !== el) this.finishInput(); }, 0));
    inp.textHook = (e, down) => {
      if (!down) return;
      if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Escape' || e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); this.finishInput(); }
      else if (document.activeElement !== el) el.focus();
    };
    el.focus();
    setTimeout(() => { if (this.input === el && document.activeElement !== el) el.focus(); }, 30);
  }
  placeInput() {
    const el = this.input, cv = typeof document !== 'undefined' && document.getElementById('game');
    if (!el || !cv) return;
    const r = cv.getBoundingClientRect(), k = r.width / VIEW_W;
    Object.assign(el.style, { left: Math.round(r.left + 116 * k) + 'px', top: Math.round(r.top + 50 * k) + 'px', width: Math.round(222 * k) + 'px', height: Math.round(17 * k) + 'px', fontSize: Math.max(12, Math.round(11 * k)) + 'px' });
  }
  finishInput() {
    const el = this.input;
    if (!el) return;
    const v = (el.value || '').replace(/\s+/g, ' ').trim().slice(0, 8);
    this.input = null; this.wantDone = false; this.composing = false;
    el.remove();
    const inp = this.game.input;
    inp.textMode = false; inp.textHook = null; inp.clear();
    this.cool = .3;   // a second Enter from the same key press must not reopen the box
    const cv = document.getElementById('game'); if (cv) cv.focus();
    if (v) {
      this.name = v; this.okT = 1.6; this.game.audio.sfx('ok');
      this.row = this.afterName === 'start' ? ROWS.indexOf('start') : 1;
    } else this.game.audio.sfx('back');
    this.afterName = null;
  }
  begin() { this.ask = null; this.game.audio.sfx('ok'); this.done({ name: this.name, style: this.v.style, look: this.look() }); }
  update(dt) {
    this.t += dt;
    if (this.okT > 0) this.okT -= dt;
    if (this.input) { this.placeInput(); return; }
    // right after the box closes, ignore Enter/Esc (a trailing Enter must not reopen it), but let the cursor move
    const settling = this.cool > 0;
    if (settling) this.cool = Math.max(0, this.cool - dt);
    const inp = this.game.input, A = this.game.audio;
    // the name comes first: open the box by itself once the screen has faded in
    if (this.autoT > 0) { this.autoT -= dt; if (this.autoT <= 0 && !this.name && this.row === 0) { this.openInput(); return; } }
    if (this.ask) {
      if (inp.pressed('left') || inp.pressed('right') || inp.pressed('up') || inp.pressed('down')) { this.ask.sel ^= 1; A.sfx('ui'); }
      if (inp.menuPressed('cancel')) { this.ask = null; A.sfx('back'); return; }
      if (inp.menuPressed('confirm')) { if (this.ask.sel === 0) this.begin(); else { this.ask = null; A.sfx('back'); } }
      return;
    }
    if (inp.pressed('up')) { this.row = (this.row + ROWS.length - 1) % ROWS.length; A.sfx('ui'); }
    if (inp.pressed('down')) { this.row = (this.row + 1) % ROWS.length; A.sfx('ui'); }
    const k = ROWS[this.row];
    if (OPTS[k] && (inp.pressed('left') || inp.pressed('right'))) { const L = OPTS[k], i = L.indexOf(this.v[k]); this.v[k] = L[(i + (inp.pressed('left') ? -1 : 1) + L.length) % L.length]; A.sfx('ui', { pitch: 1.2 }); }
    if (settling) return;
    if (inp.menuPressed('cancel')) { A.sfx('back'); this.game.toTitle(); return; }
    if (inp.menuPressed('confirm')) {
      if (k === 'name') this.openInput();
      else if (k === 'random') { this.randomize(); A.sfx('ok'); }
      else if (k === 'start') {
        if (!this.name) { this.row = 0; this.afterName = 'start'; this.openInput(); return; }
        if (hasCareer(this.slot) && !this.confirmed) { this.ask = { sel: 1 }; A.sfx('ui'); return; }
        this.begin();
      } else if (OPTS[k]) { this.row = Math.min(ROWS.length - 1, this.row + 1); A.sfx('ui'); }   // Enter on a choice: keep it, go to the next item
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
      if (k === 'name') {
        if (!this.input) drawText(u, this.name || '(Enter를 눌러 입력)', 120, y, { size: 11, color: this.name ? '#ffd65a' : UI.faint });
        if (!this.input && this.name && this.okT > 0) drawText(u, '✓ 확정', 334, y, { size: 11, align: 'r', color: '#6be38a' });
        else if (!this.input && !this.name) drawText(u, '필수', 334, y, { size: 11, align: 'r', color: on ? '#ffb347' : UI.faint });
      }
      else if (OPTS[k]) {
        if (['hairCol', 'c1', 'c2', 'boots'].includes(k)) { rect(u, '#05060f', 199, y, 42, 11); rect(u, this.v[k], 200, y + 1, 40, 9); drawText(u, '◀        ▶', 220, y, { size: 11, align: 'c', color: on ? '#ffd65a' : UI.faint }); }
        else drawText(u, '◀ ' + this.show(k) + ' ▶', 334, y, { size: 11, align: 'r', color: on ? '#ffd65a' : '#c9d4ff' });
      }
    });
    const S = STYLE_BASE[this.v.style], st = S.stats, F = FINISHERS[S.finisher];
    panel(u, 360, 46, 266, 134, { accent: '#ff5fa2', alpha: .9 });
    drawText(u, STYLES[this.v.style].name, 370, 52, { color: '#ffffff', bold: true });
    drawText(u, STYLES[this.v.style].desc, 370, 68, { size: 11, color: '#ff8fc4' });
    [['체력', (st.hp - 60) / 90], ['기절 저항', (st.stun - 60) / 80], ['공격력', (st.atk - .6) / .75], ['잡기', (st.grp - .6) / .75], ['속도', (st.spd - .6) / .75], ['점프', (st.jump - .6) / .75]].forEach(([n, v], i) => { drawText(u, n, 370, 84 + i * 13, { size: 11, color: UI.dim }); gauge(u, 440, 88 + i * 13, 100, 4, clamp(v, .05, 1), 'fin', { col: '#ff8fc4' }); });
    drawText(u, '피니셔: ' + F.name, 370, 164, { size: 11, color: '#ffd65a' });
    if (this.input) {
      rect(u, '#05060f', 14, 334, 612, 18);
      drawText(u, '이름을 입력하세요 (한글·영문 최대 8자)', 20, 338, { size: 11, color: '#ffd65a' });
      prompt(u, ['Enter'], '확정', 300, 338, {}); prompt(u, ['Esc'], '그만두기', 370, 338, {});
    } else {
      const k = ROWS[this.row];
      prompt(u, ['↑↓'], '항목', 20, 338, {}); prompt(u, ['←→'], '바꾸기', 90, 338, {});
      prompt(u, ['Enter'], k === 'name' ? '이름 입력' : k === 'start' ? '시작' : k === 'random' ? '무작위' : '다음 항목', 170, 338, {}); prompt(u, ['Esc'], '타이틀', 280, 338, {});
    }
    if (this.ask) {
      rect(u, 'rgba(5,6,15,.6)', 0, 0, VIEW_W, VIEW_H);
      panel(u, 130, 120, 380, 110, { accent: '#ff5b5b' });
      drawText(u, '저장된 커리어가 있습니다', 320, 130, { align: 'c', color: '#ff8a8a', bold: true });
      drawText(u, '새로 시작하면 이전 커리어 저장이 지워집니다. 시작할까요?', 320, 152, { size: 11, align: 'c', color: '#ffffff' });
      ['예, 새로 시작', '아니요'].forEach((t, i) => { const x = 250 + i * 140, on = this.ask.sel === i; rect(u, on ? (i === 0 ? '#7a1f2a' : '#2a3a7a') : '#141a36', x - 56, 184, 112, 20); drawText(u, t, x, 187, { align: 'c', color: on ? '#ffffff' : UI.dim }); });
      drawText(u, '←→ 선택 · Enter 결정 · Esc 취소', 320, 212, { size: 11, align: 'c', color: UI.dim });
    }
  }
}
