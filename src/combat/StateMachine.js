// Finite state machine. The table states which inputs a state reads, what can be done to a body in it,
// and which states may follow. Illegal transitions are refused and logged.

/* input: actions the state reads. hit: can be struck. grab: can be grabbed. air: gravity body without floor control.
   protect: outside systems may not force a reaction. next: voluntary transitions. */
const NEUTRAL_NEXT = ['IDLE', 'MOVE', 'JUMP', 'FALL', 'ATTACK', 'AIR_ATTACK', 'GUARD', 'DODGE', 'GRAB', 'COUNTER', 'FINISHER', 'TAUNT', 'CLIMB', 'ENTER_RING', 'EXIT_RING', 'ROPE', 'PIN', 'TAGWAIT', 'WRESTLING_MOVE', 'APRON'];
export const STATES = {
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
  SEATED: { ko: '코너 위에 걸터앉음', input: ['mash'], hit: 1, next: ['FALL', 'IDLE'] },
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
export const REACTIONS = new Set(['HITSTUN', 'STAGGER', 'DOWN', 'GRABBED', 'KO', 'WHIPPED', 'PINNED', 'HANG', 'OUT', 'WIN', 'GET_UP', 'FALL', 'INTRO', 'SEATED']);

export class StateMachine {
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
