// Peer-to-peer link for online 1:1, over WebRTC with PeerJS (MIT, inlined by the build as window.Peer). The PeerJS
// cloud server only introduces the two browsers; the match data goes directly between them. A room code is five
// characters; the host's peer id is PREFIX + code.
const PREFIX = 'nhs-slam-v1-', ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const NET_V = 1;
export function newCode() { let s = ''; for (let i = 0; i < 5; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return s; }
export function cleanCode(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); }

export class Net {
  constructor() { this.peer = null; this.conn = null; this.handlers = {}; this.status = 'idle'; this.error = ''; this.role = null; this.code = ''; this.ping = 0; }
  on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); return this; }
  off(ev) { delete this.handlers[ev]; }
  emit(ev, d) { for (const fn of (this.handlers[ev] || []).slice()) fn(d); }
  get available() { return typeof window !== 'undefined' && typeof window.Peer === 'function'; }
  get connected() { return !!(this.conn && this.conn.open); }
  host(code) {
    if (!this.available) return this.fail('온라인 모듈을 불러오지 못했다');
    this.close(); this.role = 'host'; this.code = code; this.setStatus('opening');
    const p = this.peer = new window.Peer(PREFIX + code, { debug: 0 });
    p.on('open', () => this.setStatus('waiting'));
    p.on('connection', c => { if (this.conn && this.conn.open) { try { c.close(); } catch (e) { void e; } return; } this.attach(c); });
    p.on('error', e => this.fail(e && e.type === 'unavailable-id' ? '이미 쓰이는 코드다. 방을 다시 만들자' : e && e.type === 'network' ? '네트워크 오류: 인터넷 연결을 확인하자' : '연결 서버 오류 (' + (e && e.type || e) + ')'));
    p.on('disconnected', () => { if (!this.connected && this.status !== 'error') this.fail('연결 서버와 끊어졌다'); });
  }
  join(code) {
    if (!this.available) return this.fail('온라인 모듈을 불러오지 못했다');
    this.close(); this.role = 'guest'; this.code = code; this.setStatus('opening');
    const p = this.peer = new window.Peer(undefined, { debug: 0 });
    p.on('open', () => { this.setStatus('joining'); this.attach(p.connect(PREFIX + code, { reliable: true, serialization: 'json' })); });
    p.on('error', e => this.fail(e && e.type === 'peer-unavailable' ? '그런 방이 없다. 코드를 확인하자' : e && e.type === 'network' ? '네트워크 오류: 인터넷 연결을 확인하자' : '연결 오류 (' + (e && e.type || e) + ')'));
  }
  attach(c) {
    this.conn = c;
    c.on('open', () => { this.setStatus('connected'); this.emit('open'); });
    c.on('data', d => {
      if (d && d.t === 'png') { this.send({ t: 'pog', s: d.s }); return; }
      if (d && d.t === 'pog') { this.ping = Math.round(performance.now() - d.s); return; }
      this.emit('data', d);
    });
    c.on('close', () => { if (this.status !== 'idle') { this.setStatus('closed'); this.emit('close'); } });
    c.on('error', () => { this.setStatus('closed'); this.emit('close'); });
  }
  send(o) { if (this.conn && this.conn.open) { try { this.conn.send(o); } catch (e) { void e; } } }
  pingNow() { this.send({ t: 'png', s: performance.now() }); }
  setStatus(s) { this.status = s; this.emit('status', s); }
  fail(msg) { this.status = 'error'; this.error = msg; this.emit('error', msg); }
  close() {
    const c = this.conn, p = this.peer;
    this.conn = null; this.peer = null; this.status = 'idle';
    try { if (c) c.close(); } catch (e) { void e; }
    try { if (p) p.destroy(); } catch (e) { void e; }
  }
}
