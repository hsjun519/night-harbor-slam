// 시너지 and 연계. A 시너지 chains two different moves (after the first, K goes straight into the second, harder than it
// would hit alone); a 연계 is the same move again. Owning the moves is not enough: 백 관장 teaches a 시너지 for a fee,
// on the dummy in the gym ring; 파식대 학원 sells the 연계 and the special ones (three moves, 골목 영감's moves) as
// books. The computer and quick matches have every one of them (a fighter with no list is not limited).
//   kind: 'syn' 백 관장 · 'chain' 연계 (학원) · 'special' (학원)
//   how a chain runs: catch (after an Irish whip, K on the way back), follow (K right after the first move lets go),
//   upgrade (pressed early in the first move: it turns into the longer one), seq (a three-move chain: the last hits harder)
import { MOVES } from './moves.js';
import { COMBO_MOVES } from './combos.js';

export const SYNERGY = {
  // ---- 백 관장 (two different moves)
  whipBomb: { kind: 'syn', a: 'irishWhip', b: 'powerbomb', run: 'catch', power: 1.35, cost: 45000, name: '파워밤 받아치기', how: '아이리시 휩으로 로프에 보낸 뒤, 튕겨 돌아오는 상대 앞에서 K' },
  whipSlam: { kind: 'syn', a: 'irishWhip', b: 'powerSlam', run: 'catch', power: 1.3, cost: 40000, name: '파워 슬램 받아치기', how: '아이리시 휩 → 돌아오는 상대 앞에서 K' },
  whipChoke: { kind: 'syn', a: 'irishWhip', b: 'chokeslam', run: 'catch', power: 1.3, cost: 50000, name: '초크슬램 받아치기', how: '아이리시 휩 → 돌아오는 상대 목을 잡아 K' },
  whipBelly: { kind: 'syn', a: 'irishWhip', b: 'bellyToBelly', run: 'catch', power: 1.3, cost: 35000, name: '안아 던지기 받아치기', how: '아이리시 휩 → 돌아오는 상대를 안아 K' },
  whipF5: { kind: 'syn', a: 'irishWhip', b: 'f5', run: 'catch', power: 1.3, cost: 60000, name: 'F5 받아치기', how: '아이리시 휩 → 돌아오는 상대를 들쳐 메며 K' },
  slamElbow: { kind: 'syn', a: 'bodySlam', b: 'fElbow', run: 'follow', power: 1.2, cost: 25000, name: '항구의 밤', how: '바디 슬램으로 눕힌 직후 J: 뛰어올라 엘보 드롭' },
  powerSlamElbow: { kind: 'syn', a: 'powerSlam', b: 'fElbow', run: 'follow', power: 1.25, cost: 35000, name: '파워 엘보', how: '파워 슬램 직후 J: 엘보 드롭' },
  busterElbow: { kind: 'syn', a: 'spinebuster', b: 'bigElbow', run: 'follow', power: 1.2, cost: 35000, name: '뱃고동 엘보', how: '스파인버스터 직후 J: 로프까지 갔다 와서 엘보' },
  breakerStretch: { kind: 'syn', a: 'backbreaker', b: 'backStretch', run: 'follow', power: 1.2, cost: 30000, name: '등 꺾기 조르기', how: '백브레이커 직후 K: 엎어 놓고 허리를 꺾는다' },
  cutterHammer: { kind: 'syn', a: 'cutter', b: 'anchorHammer', run: 'follow', power: 1.2, cost: 45000, name: '번개 닻', how: '대시 커터 직후 K: 일으켜 거꾸로 내리꽂는다' },
  spearHammer: { kind: 'syn', a: 'spear', b: 'anchorHammer', run: 'follow', power: 1.2, cost: 45000, name: '닻 내리기', how: '돌파 태클 직후 K: 일으켜 거꾸로 내리꽂는다' },
  chokeElbow: { kind: 'syn', a: 'chokeslam', b: 'bigElbow', run: 'follow', power: 1.25, cost: 45000, name: '목조르고 뱃고동', how: '초크슬램 직후 J: 과시용 엘보' },
  // ---- 파식대 학원: 연계 (the same move again)
  suplex2: { kind: 'chain', a: 'suplex', b: 'suplex', run: 'follow', lift: 1, power: 1.1, cost: 160000, name: '2연속 수플렉스', how: '수플렉스가 끝나면 K: 끌어올려 한 번 더' },
  bomb2: { kind: 'chain', a: 'powerbomb', b: 'powerbomb', run: 'follow', lift: 1, power: 1.15, cost: 260000, name: '2연속 파워밤', how: '파워밤이 끝나면 K: 다시 들어 올려 한 번 더' },
  slam2: { kind: 'chain', a: 'bodySlam', b: 'bodySlam', run: 'follow', lift: 1, power: 1.1, cost: 140000, name: '2연속 바디 슬램', how: '바디 슬램이 끝나면 K: 일으켜 한 번 더' },
  german2: { kind: 'chain', a: 'german', b: 'german', run: 'upgrade', power: 1, cost: 200000, name: '연속 저먼', how: '저먼 수플렉스를 거는 순간 K를 한 번 더' },
  dragon2: { kind: 'chain', a: 'dragonSuplex', b: 'dragonSuplex', run: 'upgrade', power: 1, cost: 240000, name: '저먼에서 드래곤으로', how: '드래곤 수플렉스를 거는 순간 K를 한 번 더' },
  // ---- 파식대 학원: special
  superBomb: { kind: 'special', a: 'powerbomb', b: 'powerbomb', run: 'upgrade', power: 1, cost: 320000, name: '슈퍼 파워밤 · 북해 삼연타', how: '파워밤을 거는 순간 Space (에너지 50): 세 번 내리꽂는다' },
  swingElbow: { kind: 'special', a: 'giantSwing', b: 'fElbow', run: 'follow', power: 1.35, cost: 220000, name: '회오리 엘보', how: '자이언트 스윙이 끝나면 J: 어지러운 상대에게 엘보' },
  pileHammer: { kind: 'special', a: 'piledriver', b: 'anchorHammer', run: 'follow', power: 1.35, cost: 300000, name: '말뚝 닻', how: '파일드라이버가 끝나면 K: 다시 일으켜 거꾸로 내리꽂는다' },
  planeElbow: { kind: 'special', a: 'airplane', b: 'bigElbow', run: 'follow', power: 1.35, cost: 240000, name: '비행기 착륙', how: '에어플레인 스핀이 끝나면 J: 뱃고동 엘보' },
  harborStorm: { kind: 'special', seq: ['irishWhip', 'spinebuster', 'bigElbow'], a: 'spinebuster', b: 'bigElbow', run: 'seq', power: 1.6, cost: 400000, name: '부두의 폭풍', how: '아이리시 휩 → 돌아오는 상대를 K로 스파인버스터(받아치기) → J 뱃고동 엘보: 마지막 엘보가 1.6배' },
};
export const SYN_KIND = { syn: '시너지', chain: '연계', special: '특수 시너지' };
export const fromTrainer = S => S.kind === 'syn';
// moves that only exist inside a chain come with it (점프 엘보 드롭, 뱃고동 엘보, 등 꺾기 조르기, 닻 망치)
export const comboOnly = id => !!COMBO_MOVES[id] && !(MOVES[id] && MOVES[id].pos !== 'ground' && MOVES[id].pos !== 'chain');
export function synMoves(S) { return Array.from(new Set(S.seq ? S.seq : [S.a, S.b])); }
export function needMoves(S) { return synMoves(S).filter(id => !comboOnly(id)); }
export const synReady = (known, S) => needMoves(S).every(id => known.includes(id));
export const synName = id => (MOVES[id] ? MOVES[id].name : COMBO_MOVES[id] ? COMBO_MOVES[id].name : id);
// the 시너지 that a chain from `from` into `to` would be, if any (the computer's follow-ups are left alone)
export function synergyOf(from, to, run) {
  for (const id in SYNERGY) { const S = SYNERGY[id]; if (S.a === from && S.b === to && (!run || S.run === run || (run === 'follow' && S.run === 'seq'))) return id; }
  return null;
}
// whether fighter f may chain from → to (f.syn: the career's learned list; none: every chain)
export function synAllowed(f, from, to, run) {
  const id = synergyOf(from, to, run);
  if (!id) return { ok: true, id: null };
  return { ok: !f.syn || f.syn.has(id), id };
}
