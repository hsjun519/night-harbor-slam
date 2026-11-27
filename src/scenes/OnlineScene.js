// Online 1:1 lobby. The host picks a wrestler, the match and the arena and gets a five-character room code; the
// guest types the code, picks a wrestler and the match starts on both screens from the same seed (see net/Lockstep).
import { VIEW_W, VIEW_H, clamp } from '../core/util.js';
import { drawText } from '../render/pixelfont.js';
import { UI, mixHex } from '../render/palette.js';
import { rect, bands, cone } from '../render/painter.js';
import { panel, prompt } from '../render/ui.js';
import { CHARACTERS, ROSTER_IDS } from '../data/characters.js';
import { ARENAS } from '../combat/arena.js';
import { Mannequin } from './TitleScene.js';
import { Net, NET_V, newCode, cleanCode } from '../net/Net.js';

const PLAY_IDS = ['rookie', ...ROSTER_IDS];
export const NET_TYPES = [
  { id: 'single', name: '싱글 매치', cfg: { mode: 'single' } },
  { id: 'pin', name: '핀폴 매치', cfg: { mode: 'pin' } },
  { id: 'falls', name: '3판 2선승', cfg: { mode: 'single', falls: 2 } },
  { id: 'iron', name: '아이언맨 3분', cfg: { mode: 'single', iron: 180 } },
  { id: 'ladder', name: '래더 매치', cfg: { mode: 'single', special: 'ladder' } },
  { id: 'cage', name: '스틸 케이지', cfg: { mode: 'single', special: 'cage' } },
  { id: 'cell', name: '헬 인 어 셀', cfg: { mode: 'single', special: 'cell', events: [{ kind: 'chairs', xs: [80, 820] }] } },
  { id: 'street', name: '길거리 승부', cfg: { mode: 'street', arena: 'alley' } },
];
const NET_ARENAS = ['hall', 'pier', 'dome', 'gym', 'basement'];
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ', DIGITS = '23456789';

export function onlineConfig(start, localIdx, net) {
  const T = NET_TYPES.find(t => t.id === start.type) || NET_TYPES[0];
  const ent = (i) => ({ char: start.chars[i], ctrl: i === localIdx ? 'human' : 'remote', name: CHARACTERS[start.chars[i]] ? CHARACTERS[start.chars[i]].name : undefined });
  const delay = Math.max(3, Math.min(8, 2 + Math.ceil(((net && net.ping) || 60) / 2 / 16.7)));   // frames of input delay from the measured ping
  return Object.assign({ arena: start.arena }, T.cfg, { seed: start.seed, skipIntro: true, entrants: [ent(0), ent(1)], online: { net, localIdx, delay }, music: 'match', title: `온라인 · ${T.name}` });
}

export class OnlineScene {
  constructor(game, keep) {
    this.game = game; this.t = 0; this.row = 0; this.man = new Mannequin();
    const last = game.settings.lastOnline || {};
    this.v = Object.assign({ me: 'rookie', type: 'single', arena: 'hall' }, last);
    this.state = 'menu'; this.code = ''; this.msg = ''; this.room = null; this.foe = null; this.ready = false; this.after = null;
    this.net = keep && keep.net && keep.net.connected ? keep.net : new Net();
    if (keep && keep.after) { this.after = keep.after; this.room = keep.room; this.foe = keep.foe; this.state = 'after'; }
    this.bind();
    game.audio.music('lobby');
  }
  bind() {
    const n = this.net;
    n.off('status'); n.off('error'); n.off('close'); n.off('open'); n.off('data');
    n.on('error', e => { this.state = 'error'; this.msg = e; this.game.audio.sfx('deny'); });
    n.on('close', () => { if (this.state !== 'menu' && this.state !== 'error') { this.state = 'error'; this.msg = '상대와 연결이 끊겼다.'; } });
    n.on('open', () => {
      this.game.audio.sfx('ok');
      if (n.role === 'host') { this.state = 'hostWait'; n.send({ t: 'room', v: NET_V, type: this.v.type, arena: this.v.arena, char: this.v.me }); }
      else { this.state = 'guestPick'; this.row = 0; }
    });
    n.on('data', d => this.onData(d));
  }
  onData(d) {
    const n = this.net, A = this.game.audio;
    if (d.t === 'room') {
      if (d.v !== NET_V) { this.state = 'error'; this.msg = '게임 버전이 다르다. 둘 다 같은 주소에서 새로 고침하자.'; n.close(); return; }
      this.room = { type: d.type, arena: d.arena }; this.foe = d.char; A.sfx('ui');
    } else if (d.t === 'pick' && n.role === 'host') {
      this.foe = d.char; A.sfx('ok');
      if (this.state === 'after') return;   // between matches: the host presses 다시 하기
      this.start({ seed: (Math.random() * 0x7fffffff) | 0, type: this.v.type, arena: NET_TYPES.find(t => t.id === this.v.type).cfg.arena || this.v.arena, chars: [this.v.me, d.char] });
    } else if (d.t === 'start' && n.role === 'guest') {
      this.launch(d.start, 1);
    } else if (d.t === 'bye') { this.state = 'error'; this.msg = '상대가 방을 나갔다.'; }
  }
  start(s) { this.net.send({ t: 'start', start: s }); this.launch(s, 0); }
  launch(s, localIdx) {
    const g = this.game, net = this.net, room = { type: s.type, arena: s.arena }, foe = s.chars[1 - localIdx];
    g.playMatch(onlineConfig(s, localIdx, net), res => g.go(() => new OnlineScene(g, { net, after: res, room, foe })));
  }
  // ---- the menus
  rows() {
    const v = this.v;
    if (this.state === 'menu') return [{ k: 'host', label: '방 만들기 (호스트)' }, { k: 'join', label: '코드로 참가' }, { k: 'back', label: '돌아가기' }];
    if (this.state === 'host') return [
      { k: 'me', label: '내 선수', list: PLAY_IDS, show: x => CHARACTERS[x].name },
      { k: 'type', label: '경기 종류', list: NET_TYPES.map(t => t.id), show: x => NET_TYPES.find(t => t.id === x).name },
      ...(v.type === 'street' ? [] : [{ k: 'arena', label: '경기장', list: NET_ARENAS, show: x => ARENAS[x].name }]),
      { k: 'open', label: '방 만들기' }, { k: 'back', label: '돌아가기' }];
    if (this.state === 'guestPick') return [{ k: 'me', label: '내 선수', list: PLAY_IDS, show: x => CHARACTERS[x].name }, { k: 'pick', label: this.ready ? '준비 완료 — 호스트를 기다리는 중' : '준비 완료' }, { k: 'leave', label: '나가기' }];
    if (this.state === 'after') return this.net.role === 'host' ? [{ k: 'again', label: '다시 하기' }, { k: 'me', label: '내 선수', list: PLAY_IDS, show: x => CHARACTERS[x].name }, { k: 'type', label: '경기 종류', list: NET_TYPES.map(t => t.id), show: x => NET_TYPES.find(t => t.id === x).name }, { k: 'arena', label: '경기장', list: NET_ARENAS, show: x => ARENAS[x].name }, { k: 'leave', label: '나가기' }] : [{ k: 'me', label: '내 선수 (다음 경기)', list: PLAY_IDS, show: x => CHARACTERS[x].name }, { k: 'pick', label: this.ready ? '준비 완료 — 호스트를 기다리는 중' : '다음 경기 준비 완료' }, { k: 'leave', label: '나가기' }];
    if (this.state === 'hostWait') return [{ k: 'leave', label: '방 닫기' }];
    return [{ k: 'leave', label: '돌아가기' }];
  }
  update(dt) {
    this.t += dt;
    const inp = this.game.input, A = this.game.audio, v = this.v;
    if (this.net.connected) { this.pingT = (this.pingT || 0) + dt; if (this.pingT > 1) { this.pingT = 0; this.net.pingNow(); } }
    if (this.state === 'join') { this.typeCode(inp, A); return; }
    const R = this.rows();
    this.row = clamp(this.row, 0, R.length - 1);
    if (inp.pressed('up')) { this.row = (this.row + R.length - 1) % R.length; A.sfx('ui'); }
    if (inp.pressed('down')) { this.row = (this.row + 1) % R.length; A.sfx('ui'); }
    const r = R[this.row];
    if (r.list && (inp.pressed('left') || inp.pressed('right'))) { const d = inp.pressed('left') ? -1 : 1, i = r.list.indexOf(v[r.k]); v[r.k] = r.list[(i + d + r.list.length) % r.list.length]; A.sfx('ui', { pitch: 1.2 }); if (this.state === 'guestPick') this.ready = false; }
    if (inp.menuPressed('cancel')) { A.sfx('back'); this.leave(); return; }
    if (!inp.menuPressed('confirm')) return;
    A.sfx('ok');
    switch (r.k) {
      case 'host': this.state = 'host'; this.row = 0; break;
      case 'join': this.state = 'join'; this.code = ''; this.msg = ''; break;
      case 'back': case 'leave': this.leave(); break;
      case 'open': this.game.settings.lastOnline = Object.assign({}, v); this.game.saveSettings(); this.code = newCode(); this.net.host(this.code); this.state = 'hostOpen'; this.msg = ''; break;
      case 'pick': this.ready = true; this.net.send({ t: 'pick', char: v.me }); this.game.settings.lastOnline = Object.assign({}, v); this.game.saveSettings(); break;
      case 'again': { const T = NET_TYPES.find(t => t.id === v.type); this.game.settings.lastOnline = Object.assign({}, v); this.game.saveSettings(); this.start({ seed: (Math.random() * 0x7fffffff) | 0, type: v.type, arena: T.cfg.arena || v.arena, chars: [v.me, this.foe] }); break; }
      default: if (r.list) { const i = r.list.indexOf(v[r.k]); v[r.k] = r.list[(i + 1) % r.list.length]; }
    }
  }
  typeCode(inp, A) {
    if (inp.menuPressed('cancel') && !this.code) { A.sfx('back'); this.state = 'menu'; this.row = 1; return; }
    if (inp.rawPressed('Backspace') || (inp.menuPressed('cancel') && this.code)) { this.code = this.code.slice(0, -1); A.sfx('type'); return; }
    for (const ch of LETTERS + DIGITS) {
      const code = /\d/.test(ch) ? 'Digit' + ch : 'Key' + ch;
      if (inp.rawPressed(code) || inp.rawPressed('Numpad' + ch)) { if (this.code.length < 5) { this.code += ch; A.sfx('type'); } }
    }
    if (inp.rawPressed('Enter') || inp.rawPressed('NumpadEnter')) {
      const c = cleanCode(this.code);
      if (c.length !== 5) { A.sfx('deny'); this.msg = '코드는 다섯 글자다'; return; }
      A.sfx('ok'); this.msg = ''; this.state = 'joining'; this.net.join(c);
    }
  }
  leave() {
    if (this.state === 'menu') { this.net.close(); this.game.toTitle(); return; }
    if (this.net.connected) this.net.send({ t: 'bye' });
    this.net.close(); this.net = new Net(); this.bind();
    this.state = 'menu'; this.row = 0; this.room = null; this.foe = null; this.ready = false; this.after = null;
  }
  // ---- drawing
  draw(w, u) {
    const v = this.v, net = this.net;
    bands(w, 0, 0, VIEW_W, VIEW_H, ['#0b0f22', '#0e1430', '#111a3a', '#141f44', '#17244c']);
    for (let i = 0; i < 16; i++) rect(w, 'rgba(73,214,255,.05)', 0, i * 24 + ((this.t * 12) % 24), VIEW_W, 1);
    cone(w, 430, 0, 20, 140, 330, '#ff5fa2', .1); cone(w, 560, 0, 20, 140, 330, '#49d6ff', .1);
    rect(w, '#1b2450', 340, 300, 300, 60);
    const me = CHARACTERS[v.me];
    if (me) this.man.draw(w, me.look, me.stance, 430, 300, 1, this.t, { env: { rim: '#ff5fa2' } });
    const foe = this.foe && CHARACTERS[this.foe];
    if (foe) this.man.draw(w, foe.look, foe.stance, 560, 300, -1, this.t + 1, { env: { rim: '#49d6ff' } });
    u.clearRect(0, 0, VIEW_W, VIEW_H);
    drawText(u, '온라인 대전 · 1:1', 20, 14, { scale: 2, color: '#ffd65a', bold: true, outline: '#05060f' });
    const sub = { menu: '친구와 방 코드로 1:1. 방을 만든 쪽이 경기 종류와 경기장을 정한다.', host: '선수와 경기를 고르고 방을 만들면 다섯 글자 코드가 나온다.', hostOpen: this.net.status === 'waiting' ? '상대가 코드를 입력하면 연결된다.' : '방을 여는 중…', hostWait: '상대가 코드를 입력하면 연결된다.', join: '받은 코드 다섯 글자를 입력하고 Enter.', joining: '방을 찾는 중…', guestPick: '선수를 고르고 준비 완료를 누르면 시작된다.', after: this.net.role === 'host' ? '바꿀 것이 있으면 바꾸고 다시 하기.' : '다음 선수를 고르고 준비 완료.', error: '' }[this.state] || '';
    drawText(u, sub, 20, 46, { size: 11, color: UI.dim });
    if (this.state === 'hostOpen' || this.state === 'hostWait') {
      panel(u, 20, 70, 290, 120, { accent: '#ffd65a', alpha: .94 });
      drawText(u, '방 코드', 34, 80, { size: 11, color: UI.dim });
      drawText(u, net.status === 'opening' ? '…' : this.code.split('').join(' '), 165, 102, { scale: 3, align: 'c', color: '#ffffff', bold: true, outline: '#05060f' });
      drawText(u, net.status === 'waiting' ? '상대에게 이 코드를 알려 주자' : net.status === 'connected' ? '연결됨! 상대가 선수를 고르는 중' : '연결 서버에 방을 여는 중…', 165, 150, { size: 11, align: 'c', color: net.status === 'connected' ? '#6be38a' : '#ffd65a' });
      const T = NET_TYPES.find(t => t.id === v.type);
      drawText(u, `${T.name} · ${ARENAS[T.cfg.arena || v.arena].name}`, 165, 168, { size: 11, align: 'c', color: '#c9d4ff' });
    }
    if (this.state === 'join' || this.state === 'joining') {
      panel(u, 20, 70, 290, 110, { accent: '#49d6ff', alpha: .94 });
      drawText(u, '방 코드 입력', 34, 80, { size: 11, color: UI.dim });
      const s = (this.code + '_____').slice(0, 5);
      drawText(u, s.split('').join(' '), 165, 104, { scale: 3, align: 'c', color: this.state === 'joining' ? '#9aa6d6' : '#ffffff', bold: true, outline: '#05060f' });
      drawText(u, this.state === 'joining' ? '방을 찾는 중…' : this.msg || '영문·숫자 다섯 글자 · Backspace 지우기 · Esc 뒤로', 165, 152, { size: 11, align: 'c', color: this.msg ? '#ff8a8a' : UI.dim });
    }
    if (this.state === 'guestPick' && this.room) { const T = NET_TYPES.find(t => t.id === this.room.type); drawText(u, `호스트가 정한 경기: ${T ? T.name : this.room.type} · ${ARENAS[(T && T.cfg.arena) || this.room.arena].name}`, 20, 60, { size: 11, color: '#ffd65a' }); }
    if (this.state === 'after' && this.after) { const r = this.after; drawText(u, r.quit ? '경기를 중단했다.' : r.draw ? '무승부!' : r.won ? '승리!' : '패배…', 165, 76, { scale: 2, align: 'c', color: r.won ? '#ffd65a' : '#c9d4ff', bold: true, outline: '#05060f' }); }
    if (this.state === 'error') { panel(u, 20, 70, 300, 60, { accent: '#ff5b5b', alpha: .94 }); drawText(u, this.msg || '연결 오류', 34, 90, { size: 11, color: '#ff8a8a' }); }
    const R = this.rows(), y0 = this.state === 'hostOpen' || this.state === 'hostWait' || this.state === 'join' || this.state === 'joining' ? 200 : this.state === 'error' ? 140 : this.state === 'after' ? 110 : 76;
    if (this.state !== 'join' && this.state !== 'joining' && this.state !== 'hostOpen') {
      panel(u, 14, y0 - 8, 300, R.length * 19 + 14, { alpha: .92 });
      R.forEach((r, i) => {
        const y = y0 + i * 19, on = i === this.row;
        if (on) rect(u, mixHex(UI.accent, UI.panel, .55), 18, y - 2, 292, 17);
        drawText(u, r.label, 26, y, { color: on ? '#ffffff' : UI.dim });
        if (r.list) drawText(u, '◀ ' + r.show(v[r.k]) + ' ▶', 302, y, { align: 'r', color: on ? '#ffd65a' : '#c9d4ff' });
      });
    }
    if (net.connected) drawText(u, `연결됨 · 핑 ${net.ping || '-'}ms`, 630, 14, { size: 11, align: 'r', color: '#6be38a', outline: '#05060f' });
    if (!net.available) drawText(u, '이 브라우저에서는 온라인 모듈을 불러오지 못했다', 630, 30, { size: 11, align: 'r', color: '#ff8a8a', outline: '#05060f' });
    prompt(u, ['↑↓'], '항목', 20, 338, {}); prompt(u, ['←→'], '바꾸기', 90, 338, {}); prompt(u, ['Enter'], '결정', 170, 338, {}); prompt(u, ['Esc'], '뒤로', 250, 338, {});
  }
}
