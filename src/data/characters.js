// Wrestlers. A new wrestler is one entry here plus a look in looks.js.
import { LOOKS } from './looks.js';

/* stats: hp, stun (max values), atk, grp (grapple), spd, jump, rec (move recovery), down (down recovery),
   fin (finisher charge), weight, lift (lifting power), kbr (knockback resist).
   moves: front/rear slots n (K), f (toward+K), b (away+K), u (W+K), d (S+K). */
const front = (n, f, b, u, d) => ({ n, f, b, u, d });
export const STYLES = {
  power: { name: '파워하우스', desc: '높은 체력과 무거운 던지기' },
  air: { name: '하이플라이어', desc: '빠른 발과 공중 공격' },
  tech: { name: '테크니션', desc: '다양한 잡기와 반격' },
  brawl: { name: '브롤러', desc: '강력한 기본 공격' },
  heavy: { name: '슈퍼 헤비급', desc: '밀리지 않는 거구' },
  all: { name: '올라운더', desc: '균형 잡힌 능력' },
};
export const CHARACTERS = {
  rookie: {
    name: '신인', nick: '이름 없는 파도', style: 'all', look: LOOKS.rookie, stance: 'std', color: '#3fe0d0',
    stats: { hp: 100, stun: 100, atk: 1, grp: 1, spd: 1, jump: 1, rec: 1, down: 1, fin: 1, weight: 96, lift: 1.3, kbr: 1 },
    chain: ['jab', 'cross', 'hook'], run: 'lariat', air: 'dropkick', dive: 'diveElbow', ground: 'stomp',
    moves: { front: front('bodySlam', 'irishWhip', 'suplex', 'powerbomb', 'ddt'), rear: front('german', 'ringOut', 'backdropDriver', 'atomic', 'bulldog'), catch: 'backBody', counter: 'hipToss' },
    finisher: 'dawn', taunt: 'taunt', win: 'win', ai: { aggr: .55, air: .4, grab: .55, def: .5, rope: .35, taunt: .2, dirty: .2 }, voice: 1,
    lines: { intro: '여기서부터 시작이야.', win: '좋아, 한 발짝 더!', lose: '…다음엔 다를 거야.' },
  },
  taesan: {
    name: '강태산', nick: '인간 크레인', style: 'power', look: LOOKS.taesan, stance: 'power', color: '#ff8a2b',
    stats: { hp: 118, stun: 108, atk: 1.1, grp: 1.14, spd: .9, jump: .88, rec: .95, down: .95, fin: .96, weight: 122, lift: 2.1, kbr: 1.2 },
    chain: ['palm', 'elbow', 'overhand'], run: 'shoulder', air: 'flyingElbow', dive: 'diveSplash', ground: 'stomp',
    moves: { front: front('bodySlam', 'irishWhip', 'backbreaker', 'powerbomb', 'chokeslam'), rear: front('german', 'ringOut', 'giantSwing', 'atomic', 'backdropDriver'), catch: 'spinebuster', counter: 'hipToss' },
    finisher: 'container', taunt: 'taunt', win: 'winFlex', ai: { aggr: .6, air: .1, grab: .85, def: .45, rope: .25, taunt: .2, dirty: .2 }, voice: .72,
    lines: { intro: '자, 하역 시작한다.', win: '오늘 물량, 끝!', lose: '허리가… 나갔나.' },
  },
  haneul: {
    name: '윤하늘', nick: '갈매기', style: 'air', look: LOOKS.haneul, stance: 'air', color: '#3aa6e8',
    stats: { hp: 86, stun: 92, atk: .94, grp: .92, spd: 1.17, jump: 1.26, rec: 1.1, down: 1.1, fin: 1.12, weight: 70, lift: 1, kbr: .82 },
    chain: ['lowkick', 'midkick', 'spinkick'], run: 'flyKnee', air: 'dropkick', dive: 'diveMoon', ground: 'elbowdrop',
    moves: { front: front('headDrop', 'irishWhip', 'suplex', 'bellyToBelly', 'ddt'), rear: front('bulldog', 'ringOut', 'backdropDriver', 'atomic', 'german'), catch: 'backBody', counter: 'armDrag' },
    finisher: 'typhoon', taunt: 'taunt', win: 'win', ai: { aggr: .6, air: .9, grab: .35, def: .55, rope: .7, taunt: .25, dirty: .05 }, voice: 1.5,
    lines: { intro: '바람이 딱 좋은걸?', win: '높이, 더 높이!', lose: '날개가… 젖었어.' },
  },
  dohyun: {
    name: '서도현', nick: '매듭', style: 'tech', look: LOOKS.dohyun, stance: 'tech', color: '#e9e2c8',
    stats: { hp: 97, stun: 100, atk: .95, grp: 1.18, spd: 1.03, jump: 1, rec: 1.16, down: 1.05, fin: 1.05, weight: 94, lift: 1.5, kbr: 1 },
    chain: ['jab', 'elbow', 'knee'], run: 'bigboot', air: 'dropkick', dive: 'diveElbow', ground: 'stomp',
    moves: { front: front('suplex', 'irishWhip', 'bellyToBelly', 'backbreaker', 'ddt'), rear: front('german', 'ringOut', 'anchorHold', 'backdropDriver', 'atomic'), catch: 'spinebuster', counter: 'armDrag' },
    finisher: 'anchor', taunt: 'tauntCall', win: 'win', ai: { aggr: .5, air: .25, grab: .8, def: .8, rope: .35, taunt: .1, dirty: .1 }, voice: 1,
    lines: { intro: '너와 나, 누가 먼저 올라가나 보자.', win: '매듭은 풀리지 않아.', lose: '…인정하지.' },
  },
  dongsu: {
    name: '마동수', nick: '용접공', style: 'brawl', look: LOOKS.dongsu, stance: 'box', color: '#39e6c0',
    stats: { hp: 106, stun: 110, atk: 1.17, grp: .94, spd: .99, jump: .95, rec: 1, down: 1, fin: 1, weight: 104, lift: 1.4, kbr: 1.08 },
    chain: ['jab', 'cross', 'uppercut'], run: 'lariat', air: 'flyingElbow', dive: 'diveElbow', ground: 'stomp',
    moves: { front: front('bodySlam', 'irishWhip', 'cornerSmash', 'slapFest', 'ddt'), rear: front('backdropDriver', 'ringOut', 'german', 'atomic', 'bulldog'), catch: 'spinebuster', counter: 'hipToss' },
    finisher: 'weld', taunt: 'tauntCall', win: 'winFlex', ai: { aggr: .85, air: .15, grab: .4, def: .4, rope: .3, taunt: .2, dirty: .25 }, voice: .85,
    lines: { intro: '불꽃 튀길 준비됐나?', win: '때웠다. 단단하게.', lose: '용접봉… 떨어졌네.' },
  },
  mandeok: {
    name: '오만덕', nick: '고래', style: 'heavy', look: LOOKS.mandeok, stance: 'heavy', color: '#2aa7b8',
    stats: { hp: 138, stun: 124, atk: 1.06, grp: 1.04, spd: .8, jump: .74, rec: .88, down: .9, fin: .95, weight: 164, lift: 1.9, kbr: 1.7 },
    chain: ['sumoPush', 'sumoPush', 'belly'], run: 'bodyBlock', air: 'buttDrop', dive: 'diveQuake', ground: 'elbowdrop',
    moves: { front: front('bodySlam', 'irishWhip', 'cornerSmash', 'airplane', 'gutBuster'), rear: front('backdropDriver', 'ringOut', 'giantSwing', 'atomic', 'bulldog'), catch: 'spinebuster', counter: 'hipToss' },
    finisher: 'tsunami', taunt: 'taunt', win: 'win', ai: { aggr: .5, air: .2, grab: .6, def: .4, rope: .15, taunt: .3, dirty: .05 }, voice: .6,
    lines: { intro: '밥은 먹고 왔어?', win: '아이고 배 꺼졌다.', lose: '썰물이구먼…' },
  },
  neon: {
    name: '네온 제이', nick: '항구의 조명', style: 'all', look: LOOKS.neon, stance: 'dance', color: '#ff4fa3',
    stats: { hp: 96, stun: 97, atk: 1.02, grp: 1, spd: 1.1, jump: 1.12, rec: 1.06, down: 1.05, fin: 1.22, weight: 80, lift: 1.2, kbr: .94 },
    chain: ['palm', 'spinback', 'capoeira'], run: 'slideKick', air: 'axeKick', dive: 'diveKick', ground: 'elbowdrop',
    moves: { front: front('bellyToBelly', 'irishWhip', 'suplex', 'headDrop', 'ddt'), rear: front('bulldog', 'ringOut', 'german', 'atomic', 'backdropDriver'), catch: 'backBody', counter: 'armDrag' },
    finisher: 'neonspin', taunt: 'tauntDance', win: 'win', ai: { aggr: .6, air: .6, grab: .45, def: .5, rope: .55, taunt: .55, dirty: .15 }, voice: 1.35,
    lines: { intro: '카메라, 나만 잡아!', win: '앙코르는 없어~', lose: '조명 꺼… 창피해.' },
  },
  fogking: {
    name: '안개왕', nick: '등대를 끈 남자', style: 'power', look: LOOKS.fogking, stance: 'fog', color: '#9aa3c2',
    stats: { hp: 128, stun: 120, atk: 1.14, grp: 1.17, spd: .97, jump: .95, rec: 1.1, down: 1.15, fin: 1.1, weight: 126, lift: 2.3, kbr: 1.3 },
    chain: ['palm', 'midkick', 'overhand'], run: 'bigboot', air: 'flyingElbow', dive: 'diveElbow', ground: 'stomp',
    moves: { front: front('chokeslam', 'irishWhip', 'backbreaker', 'powerbomb', 'piledriver'), rear: front('german', 'ringOut', 'anchorHold', 'atomic', 'backdropDriver'), catch: 'spinebuster', counter: 'hipToss' },
    finisher: 'blackout', taunt: 'tauntBow', win: 'winFog', ai: { aggr: .6, air: .2, grab: .75, def: .75, rope: .25, taunt: .15, dirty: .2 }, voice: .55,
    lines: { intro: '……보이지 않는 것이 두려운가.', win: '안개는 걷히지 않는다.', lose: '…빛이군.' },
  },
  bokja: {
    name: '박복자', nick: '어시장 철썩 손', style: 'brawl', look: LOOKS.bokja, stance: 'std', color: '#e0405a',
    stats: { hp: 104, stun: 104, atk: 1.05, grp: 1.06, spd: .95, jump: .88, rec: 1, down: 1.05, fin: 1.1, weight: 90, lift: 1.6, kbr: 1.05 },
    chain: ['slap', 'backhand', 'slap'], run: 'shoulder', air: 'buttDrop', dive: 'diveSplash', ground: 'stomp',
    moves: { front: front('slapFest', 'irishWhip', 'bodySlam', 'airplane', 'ddt'), rear: front('backdropDriver', 'ringOut', 'giantSwing', 'atomic', 'bulldog'), catch: 'backBody', counter: 'hipToss' },
    finisher: 'homerun', taunt: 'tauntCall', win: 'winFlex', ai: { aggr: .75, air: .15, grab: .55, def: .4, rope: .25, taunt: .3, dirty: .3 }, voice: 1.2,
    lines: { intro: '떨이요 떨이! 매가 떨이!', win: '덤으로 하나 더 줄까?', lose: '아이고 내 생선…' },
  },
  dueok: {
    name: '두억', nick: '도깨비', style: 'brawl', look: LOOKS.dueok, stance: 'oni', color: '#f0c24a',
    stats: { hp: 110, stun: 104, atk: 1.14, grp: 1.02, spd: .98, jump: 1, rec: .98, down: 1.05, fin: 1.02, weight: 110, lift: 1.7, kbr: 1.1 },
    chain: ['claw', 'claw2', 'headbutt'], run: 'shoulder', air: 'crossbody', dive: 'diveHead', ground: 'elbowdrop',
    moves: { front: front('gutBuster', 'irishWhip', 'bodySlam', 'piledriver', 'ddt'), rear: front('german', 'ringOut', 'backdropDriver', 'atomic', 'bulldog'), catch: 'spinebuster', counter: 'hipToss' },
    finisher: 'club', taunt: 'tauntDance', win: 'winFlex', ai: { aggr: .8, air: .4, grab: .5, def: .3, rope: .4, taunt: .35, dirty: .5 }, voice: .7,
    lines: { intro: '씨름 한 판 할까, 히히!', win: '혹 떼러 왔다 혹 붙였지!', lose: '방망이… 부러졌다.' },
  },
  palcho: {
    name: '팔초', nick: '문어 박사', style: 'tech', look: LOOKS.palcho, stance: 'tech', color: '#b066d8',
    stats: { hp: 92, stun: 96, atk: .93, grp: 1.14, spd: 1.07, jump: 1.05, rec: 1.12, down: 1.08, fin: 1.1, weight: 78, lift: 1.3, kbr: .95 },
    chain: ['whipA', 'whipA', 'spinback'], run: 'slideKick', air: 'crossbody', dive: 'diveMoon', ground: 'elbowdrop',
    moves: { front: front('bellyToBelly', 'irishWhip', 'suplex', 'backbreaker', 'ddt'), rear: front('anchorHold', 'ringOut', 'german', 'atomic', 'bulldog'), catch: 'backBody', counter: 'armDrag' },
    finisher: 'ink', taunt: 'tauntBow', win: 'win', ai: { aggr: .5, air: .45, grab: .75, def: .6, rope: .45, taunt: .2, dirty: .4 }, voice: 1.25,
    lines: { intro: '자네를 해부해 보지.', win: '논문감이군.', lose: '빨판이… 떨어졌…' },
  },
  baeksang: {
    name: '백상', nick: '상어 이빨', style: 'power', look: LOOKS.baeksang, stance: 'power', color: '#6f93bd',
    stats: { hp: 112, stun: 108, atk: 1.13, grp: 1.08, spd: 1.01, jump: .95, rec: 1, down: 1, fin: 1.05, weight: 116, lift: 1.9, kbr: 1.15 },
    chain: ['cross', 'elbow', 'headbutt'], run: 'lariat', air: 'crossbody', dive: 'diveSplash', ground: 'elbowdrop',
    moves: { front: front('powerbomb', 'irishWhip', 'backbreaker', 'gutBuster', 'ddt'), rear: front('german', 'ringOut', 'giantSwing', 'atomic', 'bulldog'), catch: 'spinebuster', counter: 'hipToss' },
    finisher: 'shark', taunt: 'taunt', win: 'winFlex', ai: { aggr: .9, air: .3, grab: .6, def: .35, rope: .35, taunt: .2, dirty: .35 }, voice: .68,
    lines: { intro: '넌 미끼다.', win: '한입 거리도 안 되는군.', lose: '그물에… 걸렸나.' },
  },
  bjorn: {
    name: '비에른', nick: '북해의 바위', style: 'heavy', look: LOOKS.bjorn, stance: 'power', color: '#c9a25a',
    stats: { hp: 126, stun: 116, atk: 1.12, grp: 1.12, spd: .88, jump: .84, rec: .95, down: .95, fin: 1, weight: 138, lift: 2.3, kbr: 1.35 },
    chain: ['chop', 'elbow', 'overhand'], run: 'bigboot', air: 'flyingElbow', dive: 'diveSplash', ground: 'elbowdrop',
    moves: { front: front('bodySlam', 'irishWhip', 'backbreaker', 'powerbomb', 'chokeslam'), rear: front('german', 'ringOut', 'giantSwing', 'atomic', 'backdropDriver'), catch: 'spinebuster', counter: 'hipToss' },
    finisher: 'north', taunt: 'taunt', win: 'winFlex', ai: { aggr: .6, air: .1, grab: .8, def: .5, rope: .2, taunt: .15, dirty: .1 }, voice: .6,
    lines: { intro: '파도, 작다. 북해, 크다.', win: '좋은 싸움. 맥주 산다.', lose: '…발할라.' },
  },
  baekpa: {
    name: '백파', nick: '늙은 파도', style: 'tech', look: LOOKS.baekpa, stance: 'tech', color: '#e6e9f2',
    stats: { hp: 100, stun: 100, atk: 1.02, grp: 1.22, spd: .99, jump: .97, rec: 1.18, down: .98, fin: 1.1, weight: 96, lift: 1.8, kbr: 1.05 },
    chain: ['chop', 'chop', 'uppercut'], run: 'lariat', air: 'dropkick', dive: 'diveElbow', ground: 'stomp',
    moves: { front: front('suplex', 'irishWhip', 'backbreaker', 'piledriver', 'ddt'), rear: front('german', 'ringOut', 'anchorHold', 'backdropDriver', 'bulldog'), catch: 'backBody', counter: 'armDrag' },
    finisher: 'whitewave', taunt: 'tauntBow', win: 'win', ai: { aggr: .5, air: .2, grab: .85, def: .85, rope: .35, taunt: .1, dirty: .05 }, voice: .8,
    lines: { intro: '파도는 부서져도 다시 오는 법.', win: '아직 쓸 만하지?', lose: '허허, 좋은 파도였네.' },
  },
  gosu: {
    name: '고수', nick: '입담의 왕', style: 'air', look: LOOKS.gosu, stance: 'dance', color: '#ffd65a', rivalGym: 1,
    stats: { hp: 94, stun: 96, atk: 1.02, grp: 1, spd: 1.14, jump: 1.18, rec: 1.08, down: 1.05, fin: 1.15, weight: 80, lift: 1.2, kbr: .95 },
    chain: ['jab', 'spinback', 'spinkick'], run: 'flyKnee', air: 'axeKick', dive: 'diveKick', ground: 'elbowdrop',
    moves: { front: front('headDrop', 'irishWhip', 'bellyToBelly', 'suplex', 'ddt'), rear: front('bulldog', 'ringOut', 'german', 'atomic', 'backdropDriver'), catch: 'backBody', counter: 'armDrag' },
    finisher: 'neonspin', taunt: 'tauntDance', win: 'win', ai: { aggr: .7, air: .7, grab: .45, def: .55, rope: .6, taunt: .6, dirty: .4 }, voice: 1.1,
    lines: { intro: '말로 이기고, 몸으로 또 이기지!', win: '박수는 좌석에서~', lose: '대본에 없던 건데?' },
  },
  ironma: {
    name: '철마', nick: '초록 갈기', style: 'power', look: LOOKS.ironma, stance: 'box', color: '#3fd46b', rivalGym: 1,
    stats: { hp: 114, stun: 112, atk: 1.12, grp: 1.1, spd: 1, jump: .96, rec: 1.02, down: 1.05, fin: 1.02, weight: 104, lift: 1.9, kbr: 1.15 },
    chain: ['elbow', 'knee', 'overhand'], run: 'shoulder', air: 'crossbody', dive: 'diveSplash', ground: 'stomp',
    moves: { front: front('powerbomb', 'irishWhip', 'backbreaker', 'airplane', 'piledriver'), rear: front('german', 'ringOut', 'giantSwing', 'atomic', 'backdropDriver'), catch: 'spinebuster', counter: 'hipToss' },
    finisher: 'north', taunt: 'taunt', win: 'winFlex', ai: { aggr: .75, air: .2, grab: .75, def: .5, rope: .3, taunt: .2, dirty: .25 }, voice: 1,
    lines: { intro: '밟고 지나간다.', win: '길 비켜.', lose: '편자가 빠졌군.' },
  },
};
for (const id in CHARACTERS) CHARACTERS[id].id = id;
export const ROSTER_IDS = Object.keys(CHARACTERS).filter(i => i !== 'rookie');
export const STAT_INFO = [
  ['hp', '최대 체력'], ['stun', '최대 기절 저항'], ['atk', '기본 공격력'], ['grp', '잡기 기술'], ['spd', '이동 속도'], ['jump', '점프력'], ['rec', '기술 회복'], ['down', '다운 회복'], ['fin', '피니셔 충전'], ['weight', '무게'],
];
export function statBar(c, key) { // 0..1 for UI bars
  const s = c.stats;
  switch (key) {
    case 'hp': return (s.hp - 60) / 90;
    case 'stun': return (s.stun - 60) / 80;
    case 'weight': return (s.weight - 50) / 120;
    default: return (s[key] - .6) / .75;
  }
}
