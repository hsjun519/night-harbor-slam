// Create your wrestler: name (Korean input works), style, body, face, hair, mask and colours.
import { VIEW_W, VIEW_H, RNG, clamp } from '../core/util.js';
import { drawText } from '../render/pixelfont.js';
import { UI, SKINS, mixHex } from '../render/palette.js';
import { rect, bands, cone } from '../render/painter.js';
import { panel, prompt, gauge } from '../render/ui.js';
import { Mannequin } from '../scenes/TitleScene.js';
import { STYLE_BASE } from './CareerManager.js';
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
