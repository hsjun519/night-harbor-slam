// Townspeople and what they say. Lines change with progress, results, rank, injuries and past talks.
import { LOOKS } from '../data/looks.js';
import { CHARACTERS } from '../data/characters.js';
import { BALANCE as B } from '../data/balance.js';
import { josa, fmtMoney, pick } from '../core/util.js';
import { merchantOn } from './CareerManager.js';

export const NPCS = {
  boss: { name: '구만석 사장', look: LOOKS.boss, stance: 'arms', voice: .7 },
  trainer: { name: '백 관장', look: LOOKS.trainer, stance: 'hips', voice: 1.1 },
  doctor: { name: '한 선생', look: LOOKS.doctor, stance: 'calm', voice: 1.15 },
  nurse: { name: '간호사 미소', look: LOOKS.nurse, stance: 'calm', voice: 1.3 },
  shop: { name: '리키', look: LOOKS.shop, stance: 'lean', voice: 1 },
  auntie: { name: '순덕 이모', look: LOOKS.auntie, stance: 'hips', voice: 1.2 },
  staff: { name: '진행요원 도진', look: LOOKS.staff, stance: 'write', voice: 1 },
  janitor: { name: '김 반장', look: LOOKS.janitor, stance: 'elder', voice: .8 },
  reporter: { name: '민 기자', look: LOOKS.reporter, stance: 'write', voice: 1.25 },
  foreman: { name: '장 반장', look: LOOKS.foreman, stance: 'arms', voice: .75 },
  fankid: { name: '꼬마 팬 수아', look: LOOKS.fankid, stance: 'cheer', voice: 1.6 },
  busker: { name: '거리 악사', look: LOOKS.busker, stance: 'calm', voice: .95 },
  sponsor: { name: '황 대표', look: LOOKS.sponsor, stance: 'lean', voice: .9 },
  oldman: { name: '등대지기 영감', look: LOOKS.oldman, stance: 'elder', voice: .7 },
  merchant: { name: '떠돌이 상인 보부', look: LOOKS.merchant, stance: 'lean', voice: .9 },
};
for (const id in CHARACTERS) if (id !== 'rookie') NPCS[id] = { name: CHARACTERS[id].name, look: CHARACTERS[id].look, stance: CHARACTERS[id].stance === 'fog' ? 'fog' : 'calm', wrestler: 1, voice: CHARACTERS[id].voice };

// Who stands where today. x in pixels, face -1/1.
export function peopleAt(loc, c) {
  const d = c.d, day = d.day, out = [];
  const add = (id, x, face = -1, o = {}) => out.push(Object.assign({ id, x, face }, o));
  const roster = ['taesan', 'haneul', 'neon', 'mandeok', 'dongsu', 'bokja', 'dueok', 'palcho', 'baeksang', 'bjorn', 'baekpa'];
  switch (loc) {
    case 'lobby':
      add('janitor', 470, -1);
      add(roster[day % roster.length], 760, 1, { wander: 60 });
      if (day % 3 !== 1) add(roster[(day * 3 + 4) % roster.length], 1000, -1, { stance: 'sit', y: -10 });
      if (day % 2 === 0) add('reporter', 860, -1);
      if (d.fame >= 30 && !d.flags.sponsored) add('sponsor', 260, 1);
      if (day % 4 === 0) add('dohyun', 620, 1);
      // a wrestler beaten earlier waits by the stairs to the basement
      if (d.revenge && !d.revenge.invited && day >= d.revenge.day && day <= d.revenge.until) add(d.revenge.opp, 1080, -1, { stance: 'arms', revenge: 1 });
      break;
    case 'basement':
      if (d.revenge && d.revenge.invited && day <= d.revenge.until) add(d.revenge.opp, 430, -1, { stance: 'arms', revenge: 1 });
      break;
    case 'office': add('boss', 400, -1); break;
    case 'gym':
      add('trainer', 290, 1);
      if (day % 4 !== 0) add('dohyun', 930, -1, { stance: 'tech' });
      add(roster[(day + 5) % roster.length], 560, -1, { stance: 'cheer' });
      break;
    case 'arena': add('staff', 600, -1); if (d.contract && CHARACTERS[d.contract.opp]) add(d.contract.opp, 330, 1, { stance: 'arms' }); break;
    case 'street':
      add('auntie', 1010, -1);
      add('fankid', 1330, -1);
      add('busker', 1190, 1);
      add('foreman', 1900, -1);
      add('oldman', 2040, 1);
      if (day % 3 === 0) add('reporter', 1240, 1);
      if (merchantOn(d)) add('merchant', 1470, -1);
      break;
    case 'clinic': add('doctor', 400, -1); add('nurse', 200, 1); break;
    case 'shop': add('shop', 465, -1); break;
    case 'rivalgym': add('ironma', 300, 1, { stance: 'box' }); add('gosu', 470, -1, { stance: 'dance' }); break;
    case 'dome': add('staff', 420, -1); break;
  }
  return out;
}

// ---- dialogue scripts -------------------------------------------------------------------------------
const tips = [
  '상대를 계속 때리면 노란 {y}기절 저항{/} 게이지가 줄어. 바닥나면 쓰러지지. 그때 {y}K{/}로 잡는 거야.',
  '공격이 날아오는 순간 {y}L{/}을 누르면 피하면서 그대로 던져 버릴 수 있다더군. 너무 일찍 누르면 그냥 구르기만 하고.',
  '{y}S{/}를 막 누른 바로 그 순간에 맞으면 {y}패리{/}야. 상대가 휘청거리지. 계속 누르고만 있으면 그냥 막기고.',
  '로프 쪽으로 달려가 봐. 반동을 받아서 튕겨 나오면 그때 공격이 훨씬 세지.',
  '잡은 다음엔 방향을 같이 눌러. {y}→+K{/}, {y}←+K{/}, {y}W+K{/}, {y}S+K{/}… 기술이 다 달라. {y}L{/}을 누르면 뒤로 돌아가 잡고.',
  '같은 기술만 쓰면 관중이 금방 질려. 관중이 달아오르면 피니셔 게이지도 빨리 찬다고.',
  '서 있는 상대가 방어만 하면 {y}K{/}로 밀쳐 버려. 가드가 깨진다.',
  '잡혔을 땐 버튼을 마구 눌러. 기술이 시작되는 순간 {y}L!{/} 표시가 뜨면, 그때 누르면 역전이야.',
  '정말 위험하면 {y}S+L{/}. 긴급 탈출이지. 피니셔 게이지를 꽤 먹고 한참 못 써.',
  '코너 앞에서 {y}W{/}를 누르면 턴버클 위로 올라가. 거기서 {y}J{/}면 다이빙이지. 빗나가면… 아프고.',
  '{v}부상 게이지{/}는 경기에서 맞은 만큼 조금씩 쌓여. 쉬어도 안 빠져. 의원에 가거나 붕대를 사서 써야 해.',
  '피곤하면 훈련 효과가 떨어져. 소파에서 쉬거나 밤에 푹 자.',
];
const lastLine = (c, id, list) => { const n = c.rel(id); n.talks = (n.talks || 0) + 1; return list[(n.talks - 1) % list.length]; };

export function talk(id, c, W) {
  const d = c.d, me = d.name, rank = c.rank, inj = d.injury, lr = d.lastResult;
  const S = (text, o = {}) => Object.assign({ who: id, text }, o);
  switch (id) {
    case 'boss': {
      const out = [];
      if (!d.flags.metBoss) {
        d.flags.metBoss = 1;
        return [S(`오, 자네가 ${josa(me, '이/가')}군. 반갑네. 내가 이 야항 레슬링 연맹 사장, 구만석일세.`, { expr: 'happy' }), S('이 항구에선 매주 밤마다 링이 서지. 챔피언은 {v}안개왕{/}. 3년째 아무도 그 벨트를 못 건드렸어.'),
          S(`자네는 지금 이름도 없는 신인이야. 랭킹도 꼴찌, ${c.rank}위지. 경기를 이기면 순위가 오르고, 1위가 되고 명성이 쌓이면… 챔피언에게 도전할 수 있네.`),
          S('경기는 내가 주선하지. 계약을 받아 두고, 준비가 되면 {y}경기장 대기실{/}로 가서 입장하게. 날짜 안에만 가면 돼.'),
          S('아, 그리고. 링에서 받은 충격은 몸에 남아. 그게 {v}부상{/}이지. 쌓이다 쌓이면… 선수 생명 끝이야. 항구의원 한 선생한테 꼭 진찰받고 다니게.', { expr: 'sad' }),
          S('자, 첫 계약을 보여 주지.'), { act: () => W.openOffers() }];
      }
      if (d.flags.noShow && !d.flags.noShowSeen) { d.flags.noShowSeen = 1; out.push(S('계약해 놓고 안 나타나다니! 관객들이 표 값을 돌려 달라고 난리였네. 다신 이러지 말게.', { expr: 'fierce' })); }
      if (lr && d.flags.bossSeen !== d.history.length) {
        d.flags.bossSeen = d.history.length;
        if (lr.kind === 'title' && lr.won) out.push(S('해냈군… 정말 해냈어! 등대 돔이 무너지는 줄 알았다네. 자네가 이 항구의 챔피언이야!', { expr: 'happy' }));
        else if (lr.won && lr.kind === 'event') out.push(S(`${lr.opp} 우승이라니! 신문 1면은 자네 차지야.`, { expr: 'happy' }));
        else if (lr.won) out.push(S(pick([`${lr.opp}에게 이겼다며? 관중석 반응이 좋았어. 그 기세로 가세.`, '어제 경기 봤네. 마지막 기술, 표 값 했어.', `좋아, ${rank}위까지 올라왔군. 이제 슬슬 이름이 알려지겠어.`]), { expr: 'happy' }));
        else if (lr.draw) out.push(S('비겼다고? 관객은 끝장을 보고 싶어 하는 법인데.'));
        else out.push(S(pick(['졌다고 고개 숙이지 말게. 이 바닥은 다시 일어나는 놈이 이기는 거야.', `${lr.opp}은 만만한 상대가 아니었지. 훈련장에 가서 백 관장한테 배우게.`, '지는 날도 있는 거야. 대신 같은 방식으로 두 번 지지는 말게.']), { expr: 'sad' }));
      }
      if (inj >= B.injuryDanger) out.push(S(`이봐, 자네 몸 상태… 부상이 ${Math.round(inj)}%야. 이 상태로 링에 오르면 정말 끝날 수도 있어. 의원부터 가!`, { expr: 'sad' }));
      else if (inj >= B.injuryWarn) out.push(S('표정이 안 좋군. 부상이 꽤 쌓였어. 경기 전에 의원에 들르는 걸 잊지 말게.'));
      if (d.flags.champion) out.push(S('챔피언, 오늘은 무슨 일인가? 방어전 상대는 줄을 섰다네.', { expr: 'happy' }));
      else if (rank === 1) out.push(S(d.fame >= 55 ? '1위에 명성까지. 이제 안개왕에게 도전장을 내밀 때가 됐군.' : `1위라니 대단해. 그런데 명성이 아직 ${d.fame}이야. 55는 넘어야 타이틀전을 잡아 줄 수 있네.`));
      if (d.contract) out.push(S(`계약 경기는 ${josa(d.contract.oppName, '과/와')} ${d.contract.day}일까지야. 준비되면 대기실로 가게.`));
      else if (Math.abs(c.rankOf('dohyun') - rank) <= 3 && d.day - (d.flags.rivalDay || -9) >= 5) out.push(S('그리고… 서도현이 자네와 붙고 싶다더군. 둘이 순위가 붙어 있으니 관중이 좋아할 거야. 제안 목록에 넣어 뒀네.'));
      out.push(S('그래, 무슨 일인가?'));
      out.push({ choice: [
        { label: '경기 제안 보기', act: () => W.openOffers() },
        { label: '랭킹에 대해', go: [S(`지금 자네는 ${rank}위. 위 순위를 이기면 그 자리를 빼앗고, 지면 조금 내려가지. 다른 선수들도 매일 싸우니 순위가 계속 움직여.`), S('1위가 되고 명성이 55를 넘으면 타이틀전이야. 14일엔 {y}만선 럼블{/}, 21일엔 {y}태그 대전{/}이 열리고.')] },
        { label: '조언 듣기', go: [S(pick(['훈련만 하다 굶을 순 없지. 계약 경기는 보수가 커. 꼬박꼬박 잡게.', '도전 경기는 위험하지만 순위를 한 번에 뛰어넘을 수 있어.', '돈이 모자라면 부두 하역장에 가 보게. 장 반장이 일당을 쳐 줄 거야.', '돈 아끼다 몸 버리네. 붕대 값은 아끼지 말게.']))] },
        { label: '그만 가 보겠습니다', go: [S('그래, 몸조심하게.')] },
      ] });
      return out;
    }
    case 'trainer': {
      const weak = Object.entries(d.lv).sort((a, b) => a[1] - b[1])[0][0];
      const names = { hp: '체력', stun: '기절 저항', atk: '공격력', grp: '레슬링 기술', spd: '속도', jump: '점프', rec: '기술 회복', down: '다운 회복', kbr: '넉백 저항', fin: '피니셔 충전' };
      const first = !c.rel('trainer').seen; c.rel('trainer').seen = 1;
      return [
        ...(first ? [S('네가 새로 온 애구나. 백 관장이다. 링 위에선 근육보다 기본기가 먼저야.'), S('벤치프레스는 힘, 줄넘기는 발, 미트는 손기술, 목 브릿지는 맷집. 기구 앞에서 {y}E{/}를 눌러. 훈련 한 번에 시간이 한 칸 지나고, 돈도 조금 든다.')] : []),
        S(d.fatigue > 70 ? '얼굴이 반쪽이네. 오늘은 쉬어. 지친 몸으로 하는 훈련은 반도 안 남아.' : `요즘 보니 ${names[weak]} 쪽이 약하더라. 그쪽 훈련을 해 봐.`),
        { choice: [
          { label: '새 기술 배우기', act: () => W.openLearn('trainer') },
          { label: '기술 장착 바꾸기', act: () => W.openInfo(2) },
          { label: '능력치 포인트 쓰기', act: () => W.openInfo(0) },
          { label: '조언', go: [S(pick(tips))] },
          { label: '고맙습니다', go: [S('가 봐. 땀은 거짓말 안 한다.')] },
        ] },
      ];
    }
    case 'doctor': {
      const first = !c.rel('doctor').seen; c.rel('doctor').seen = 1;
      return [
        ...(first ? [S('항구의원 한 선생입니다. 레슬러들은 다 여기 단골이죠.'), S('링에서 맞은 충격은 {v}부상{/}으로 남아요. 경기에서 받은 피해만큼, 조금씩 쌓입니다. 자고 쉬어도 저절로 낫지는 않아요.'), S('100%가 되면… 다시는 링에 못 섭니다. 55%부터는 조심하고, 80%를 넘으면 경기는 말리고 싶네요.', { expr: 'sad' })] : []),
        S(inj < 10 ? '몸 상태는 괜찮네요. 무리하지만 마세요.' : inj < B.injuryWarn ? `부상 ${Math.round(inj)}%. 아직은 버틸 만하지만 쌓이기 전에 치료하는 게 쌉니다.` : inj < B.injuryDanger ? `부상 ${Math.round(inj)}%. 주의 단계예요. 치료를 권합니다.` : `부상 ${Math.round(inj)}%! 위험합니다. 이대로 경기에 나가면 은퇴할 수도 있어요.`, { expr: inj >= B.injuryWarn ? 'sad' : 'neutral' }),
        { act: () => W.openClinic() },
      ];
    }
    case 'nurse': return [S(lastLine(c, 'nurse', ['붕대는 상점에서도 팔아요. 급할 땐 그거라도 감으세요.', '치료비가 부담되면 하역장 아르바이트라도… 부상 없이 벌 수 있잖아요.', '선생님이 그러는데, 피곤한 상태로 싸우면 부상이 더 쌓인대요.', '입원 치료는 하루가 꼬박 걸리지만 한 번에 많이 나아요.']))];
    case 'shop': {
      const first = !c.rel('shop').seen; c.rel('shop').seen = 1;
      return [...(first ? [S('어서 와! 돛대 상회의 리키야. 붕대부터 반짝이 타이츠까지 다 있지.')] : []), S(d.money < 15000 ? '음… 지갑이 좀 가볍네? 그래도 붕대 하나 정도는 챙겨 둬.' : pick(['오늘 들어온 물건 구경해 봐!', '그 의상, 링 조명 받으면 확 살 거야.', '장비는 착용하면 바로 효과가 있어.'])), { act: () => W.openShop() }];
    }
    case 'auntie': return [S(pick([`아이고 ${me} 왔네! 배고프지? 뭐라도 먹고 가.`, '오늘은 국물이 진하게 우러났어.', '레슬러들 다 여기 와서 떠들고 가. 소문은 내가 제일 빠르지.'])), { act: () => W.openFood() }];
    case 'staff': {
      const ct = d.contract;
      const out = [];
      if (ct) out.push(S(ct.day > d.day ? `계약 경기는 ${josa(ct.oppName, '과/와')} ${ct.day}일까지예요. 지금 바로 해도 되고요.` : `오늘이 ${josa(ct.oppName, '과/와')}의 경기 마감일이에요!`));
      else out.push(S('계약된 경기가 없네요. 사장님께 경기를 받거나, 자유 경기에 나가 보세요.'));
      out.push({ act: () => W.openArenaList() });
      return out;
    }
    case 'janitor': return [S(lastLine(c, 'janitor', ['어이 신인. 내가 30년째 이 체육관 바닥을 닦는데, 보는 눈은 있지.', ...tips]))];
    case 'reporter': {
      if (d.flags.interviewDay === d.day) return [S('오늘 인터뷰는 벌써 했잖아요. 기사 기대하세요!')];
      d.flags.interviewDay = d.day;
      const opp = d.contract ? d.contract.oppName : '다음 상대';
      return [S('주간 항구스포츠 민 기자예요! 잠깐 인터뷰 괜찮죠?'), S(`${opp}에 대해 한마디 해 주세요!`), { choice: [
        { label: '"한 방에 끝내 주지."', go: [S('오, 자신감! 기사 제목 나왔다.'), { act: () => { d.fame += 2; W.toast('명성 +2', '#ffd65a'); } }] },
        { label: '"배울 게 많은 상대입니다."', go: [S('겸손하시네요. 팬들이 좋아할 거예요.'), { act: () => { d.fame += 1; c.rel('trainer', 1); W.toast('명성 +1', '#ffd65a'); } }] },
        { label: '"…(무시하고 지나간다)"', go: [S('에이, 차갑긴…'), { act: () => { d.fame = Math.max(0, d.fame - 1); W.toast('명성 -1', '#ff8a8a'); } }] },
      ] }];
    }
    case 'foreman': return [S(pick(['일손이 모자라. 상자 좀 날라 볼 텐가? 링보다 안전하지.', '오늘 배가 세 척이나 들어왔어. 일당 두둑하게 쳐 주지.'])), { choice: [{ label: '아르바이트 하기 (시간 1칸)', act: () => W.startJob() }, { label: '다음에요', go: [S('언제든 오게.')] }] }];
    case 'fankid': {
      if (d.flags.signDay === d.day) return [S('사인 받은 거 친구들한테 자랑했어요!', { expr: 'happy' })];
      if (d.fame < 5) return [S('아저씨도 레슬러예요? 처음 보는데… 잘하면 사인 받으러 올게요!')];
      d.flags.signDay = d.day; d.fame += 1;
      return [S(`우와, ${me}다! 사인해 주세요!`, { expr: 'happy' }), { act: () => W.toast('명성 +1', '#ffd65a') }, S(d.flags.champion ? '챔피언이다아! 벨트 만져 봐도 돼요?' : rank <= 3 ? '곧 챔피언 되는 거죠? 저 다 알아요!' : '다음 경기 꼭 이겨요! 저 맨 앞줄에 있을게요!', { expr: 'happy' })];
    }
    case 'busker': return [S(pick(['♪ 밤배가 들어오면 링에 불이 켜지고… ♪', '이 항구엔 노래가 두 개 있지. 파도 소리랑, 관중 함성.', '네 입장곡? 내가 하나 만들어 줄까. 공짜는 아니지만.']))];
    case 'sponsor': return [S('황금등대 우유의 황 대표요. 요즘 당신 이름이 자주 들리더군.'), S('우리 우유를 링에서 마셔 주면, 매달 후원금을 드리리다.'), { choice: [{ label: '계약한다', go: [S('좋소! 첫 후원금이오.'), { act: () => { d.flags.sponsored = 1; c.earn(50000); W.toast('후원금 ' + fmtMoney(50000), '#9be36b'); } }] }, { label: '거절한다', go: [S('아쉽군. 마음 바뀌면 연락하시오.')] }] }];
    case 'merchant': {
      const first = !c.rel('merchant').seen; c.rel('merchant').seen = 1;
      return [...(first ? [S('어이쿠, 손님! 바다 건너 온 물건들이야. 오늘만 판다! 내일이면 난 다음 항구에 있거든.', { expr: 'happy' })] : []),
        S(pick(['이 너클? 고래도 한 방에 눕힌다는 전설의 너클이지. …물론 고래는 안 때려 봤어.', '의자는 왜 파냐고? 손님, 레슬링에서 의자보다 좋은 친구는 없어.', '장어즙 한 병이면 밤새 훈련해도 멀쩡해! …낮엔 자야 하지만.', '붕대는 특별히 싸게 줄게. 병원엔 비밀이야.'])), { act: () => W.openMerchant() }];
    }
    case 'oldman': return [S(lastLine(c, 'oldman', ['나는 저 등대를 40년 지켰지. 안개왕이 처음 나타난 날도 기억해.', '안개왕의 마지막 기술은 {v}목을 잡는 기술{/}이야. 잡히기 전에 피하는 수밖에 없어.', '그 친구, 안개 속에서 싸우는 걸 좋아하지. 링 밖으로 끌어내지 말게. 거긴 그의 바다야.', '불이 꺼지면 당황하지 마. 다시 켜질 때 네가 서 있으면 되는 거야.', '파도는 부서져도 다시 와. 진 날엔 그 말을 기억하게.']))];
    case 'dohyun': {
      const r = c.rel('dohyun');
      const h2h = d.h2h.dohyun || { w: 0, l: 0 };
      if (!r.met) { r.met = 1; return [S('…너도 이번에 들어온 신인이지? 서도현이다.'), S('나는 3개월 먼저 왔어. 그러니까 내가 먼저 올라간다.'), S('랭킹에서 보자.', { expr: 'smug' })]; }
      if (h2h.w > h2h.l) return [S(pick(['지난번엔 내가 방심했을 뿐이야. 다음엔 매듭을 세 번 묶어 주지.', '…네 반격 타이밍, 어디서 배웠어? 아니, 대답 안 해도 돼.', '너 때문에 요즘 잠을 못 자. 훈련하느라.']), { expr: 'fierce' })];
      if (h2h.l > h2h.w) return [S(pick(['이게 실력 차이야. 기본기부터 다시 해.', '실망이군. 라이벌이라고 생각했는데.']), { expr: 'smug' })];
      return [S(lastLine(c, 'dohyun', ['훈련 중이야. 방해하지 마.', '백 관장님 미트는 순서를 외우는 게 아니야. 리듬을 타는 거지.', '태그 대전이 있다던데… 파트너가 필요하면, 생각해 보지.', `지금 ${rank}위라고? 흥. 금방 따라잡아 주지.`]))];
    }
    default: {
      const ch = CHARACTERS[id];
      if (!ch) return [S('…')];
      const h2h = d.h2h[id];
      const vsMe = d.contract && d.contract.opp === id;
      if (vsMe) return [S(pick([ch.lines.intro, `네가 내 다음 상대라고? ${ch.lines.intro}`]), { expr: 'smug' }), S('링에서 보자.', { expr: 'fierce' })];
      if (h2h && h2h.w > h2h.l) return [S(pick([`${ch.lines.lose} …다음엔 안 진다.`, '지난번 경기 얘기는 꺼내지 마.', '운이 좋았던 거야.']), { expr: 'sad' })];
      if (h2h && h2h.l > h2h.w) return [S(pick([ch.lines.win, '또 해 보고 싶어? 언제든지.']), { expr: 'smug' })];
      const gossip = {
        taesan: ['부두에서 컨테이너 들던 시절이 그립네. 그래도 링이 더 무겁지.', '내 컨테이너 드롭은 한 번 들리면 끝이야. 무거운 놈일수록 더 높이 올라가.'],
        haneul: ['코너 위에서 보는 링은 바다 같아. 뛰어내리고 싶어지지.', '날 잡으려면 먼저 땅으로 끌어내려야 할걸?'],
        neon: ['조명이 나를 따라오는 게 아니라, 내가 조명을 데려가는 거야.', '도발도 기술이야. 관중을 내 편으로 만들면 게이지가 쭉쭉 차거든.'],
        mandeok: ['밥심이 곧 체력이지. 포차 이모 파전 먹어 봤어?', '나 들어 올리려면 체력부터 깎아 놔야 할걸. 하하!'],
        dongsu: ['용접은 타이밍이야. 주먹도 그렇고.', '보안경 쓰고 싸우는 이유? 불꽃이 튀니까.'],
        bokja: ['새벽 어시장에서 생선 나르다 보면 팔이 저절로 굵어져.', '내 따귀 맞아 봤어? 기절 게이지가 쭉 빠지지.'],
        dueok: ['히히, 도깨비 방망이 맛 좀 볼래?', '밤길 조심해. 뒷골목엔 링도 심판도 없다고.'],
        palcho: ['자네 관절 각도가 흥미롭군. 해부… 아니, 분석해 보고 싶어.', '기술은 여덟 개쯤 외워 둬야 레슬러지.'],
        baeksang: ['링 밖은 피 냄새가 더 진하지.', '물속에서 기다리는 상어처럼, 기회를 기다린다.'],
        bjorn: ['한국 국밥, 최고. 북해엔 없어.', '파도, 바위 이길 수 없다. 그런데 바위, 조금씩 깎인다.'],
        baekpa: ['나도 한때는 챔피언이었지. 안개왕이 오기 전엔.', '반격은 상대를 보는 게 아니라 상대의 어깨를 보는 거야.'],
        galchi: ['부둣가 악동단은 의리로 뭉쳤다! …회비도 걷고.', '오늘은 기분 좋으니까 봐준다! 내일은 몰라!'],
        myeolchi: ['형님이 저보고 내일부터 다이어트래요. 근데 저 이미 멸치인데요?', '저기요, 사인 좀… 아니 아니, 형님 몰래요.'],
        gosu: ['말발도 기술이야, 신인. 경기 전에 이미 반은 이기고 들어가는 거지.', '철썩 짐에 온 걸 환영해. 여기선 도장 깨기 실패하면 청소 당번이야~'],
        ironma: ['여긴 야항 체육관 애들이 오는 데가 아니야.', '도장 깨기? 내 앞을 지나가야 할걸.'],
      }[id] || [ch.lines.intro];
      return [S(lastLine(c, id, gossip))];
    }
  }
}
// ---- before a match ------------------------------------------------------------------------------------
// first: never met; won: they beat me last time; lost: I beat them; ring: one line face to face in the ring.
export const PRE = {
  taesan: { first: '오, 네가 그 신입이구나! 걱정 마, 화물은 정중하게 다루는 게 내 원칙이야. 던질 때만 빼고.', won: '지난번에 한 번 들려 봤지? 오늘은 더 높이 올려 주마. 고소공포증은 없지?', lost: '지난번엔 허리가 삐끗했던 거야. 오늘은 파스를 세 장 붙이고 왔다고!', ring: '자, 하역 시작한다! 무게 좀 재 볼까?' },
  haneul: { first: '안녕, 신인! 오늘 바람 냄새가 좋아. 높이 날기 딱 좋은 날이야.', won: '또 만났네! 지난번처럼 위에서 내려다봐 줄게.', lost: '지난번엔 역풍이었어. 오늘은 순풍이야. …아마도?', ring: '바람이 딱 좋은걸? 목 조심해, 위에서 떨어지거든!' },
  dohyun: { first: '…너구나. 3개월 늦게 들어온 주제에 벌써 나랑 붙어?', won: '실력 차이는 확인했잖아. 오늘은 복습이다.', lost: '지난번은 운이었어. 오늘을 위해 매듭을 세 번 묶고 왔다.', ring: '너와 나, 누가 먼저 올라가나 보자.' },
  dongsu: { first: '신입이냐. 용접은 불꽃이 튀기 전에 끝나는 법이지. 너도 그렇게 끝내 주마.', won: '지난번 땜질 자국은 잘 아물었냐? 오늘 다시 때워 주지.', lost: '지난번엔 용접봉이 눅눅했다. 오늘은 바싹 말려 왔어.', ring: '불꽃 튀길 준비됐나? 보안경은 나만 썼다.' },
  mandeok: { first: '밥은 먹고 왔어? 빈속에 나랑 붙으면 큰일 나. 깔리면 납작해지거든.', won: '지난번에 깔렸던 거 기억하지? 오늘은 점심을 두 그릇 먹고 왔어.', lost: '지난번엔 배가 고파서 그랬어. 오늘은 국밥 세 그릇!', ring: '배 든든하게 채웠다! 오늘은 썰물 없어!' },
  neon: { first: '어머, 신인? 카메라 각도 좀 비켜 줄래? 오늘 주인공은 나거든.', won: '지난번 하이라이트, 내 얼굴만 나왔더라~ 오늘도 잘 부탁해.', lost: '지난번 패배는 편집될 거야. 오늘은 생방송으로 갚아 주지.', ring: '카메라, 나만 잡아! 조명 더 세게!' },
  fogking: { first: '……등대의 불빛이 너를 비추는군. 오래가지는 않을 것이다.', won: '……안개는 같은 자를 두 번 삼킨다.', lost: '……빛이 한 번 이겼다고 밤이 끝나지는 않는다.', ring: '……보이지 않는 것이 두려운가.' },
  bokja: { first: '아이고, 신인이야? 새벽 경매보다 싱싱하네! 오늘 매는 공짜로 줄게!', won: '지난번 따귀 맛 기억하지? 오늘은 덤으로 하나 더!', lost: '지난번엔 비린내 때문에 손이 미끄러졌어! 오늘은 고무장갑 꼈다!', ring: '떨이요 떨이! 매가 떨이!' },
  dueok: { first: '히히, 신인이다! 내 방망이 한 번 맞으면 혹이 두 개 생긴다?', won: '혹 떼러 왔다가 혹 붙인 녀석이네! 히히!', lost: '지난번엔 방망이가 장난을 친 거야. 오늘은 단단히 일러뒀지.', ring: '씨름 한 판 할까? 히히히!' },
  palcho: { first: '흥미로운 표본이군. 관절이 몇 개인지 오늘 직접 세어 보지.', won: '지난번 데이터는 아주 유익했네. 오늘은 2차 실험이야.', lost: '지난번 결과는 측정 오류였네. 오늘은 빨판을 새로 갈았지.', ring: '자네를 해부… 아니, 분석해 보지.' },
  baeksang: { first: '피 냄새가 나는군. 신인이라는 냄새.', won: '지난번엔 한 입 베어 물었지. 오늘은 통째로다.', lost: '상어는 같은 그물에 두 번 걸리지 않는다.', ring: '넌 미끼다.' },
  bjorn: { first: '신인. 작다. 하지만 눈, 좋다. 좋은 싸움 하자.', won: '지난번, 좋은 싸움. 오늘, 또 좋은 싸움. 끝나고 국밥.', lost: '지난번, 졌다. 북해 사람, 그런 거 오래 기억한다.', ring: '파도, 작다. 북해, 크다.' },
  baekpa: { first: '어서 오게, 젊은 파도. 늙은 파도가 아직 얼마나 높은지 보여 주지.', won: '지난번에 배운 건 잊지 않았겠지? 오늘은 심화 과정일세.', lost: '허허, 지난번엔 자네가 한 수 위였네. 오늘은 늙은이가 복습 좀 했지.', ring: '파도는 부서져도 다시 오는 법이지.' },
  gosu: { first: '어이 신인! 내 입담에 이미 반은 졌어. 나머지 반은 지금부터 지면 돼!', won: '또 왔어? 지난번 경기 다시 보기 틀어 놓고 팝콘 먹었다니까~', lost: '지난번은 리허설이었어. 오늘이 본 공연이지!', ring: '말로 이기고, 몸으로 또 이기지!' },
  ironma: { first: '비켜. 아니면 밟고 지나간다.', won: '또 밟힐 준비 됐나.', lost: '…편자를 새로 박았다. 이번엔 안 빠진다.', ring: '밟고 지나간다.' },
  galchi: { first: '이 동네는 우리 구역이야!', won: '또 털리러 왔냐?', lost: '지난번은 연습이었다고!', ring: '이 동네는 우리 구역이야! 얘들아, 쳐라!' },
  myeolchi: { first: '형님 말이 맞아요! 아마도요!', won: '헤헤, 또 이길 거예요. …아마도요.', lost: '형님, 저 사람 또 왔어요!', ring: '형님! 저 사람 진짜 커요! …아, 쳐요? 칠게요!' },
};
export function preFightLine(id, c) {
  const P = PRE[id], ch = CHARACTERS[id];
  if (!P) return ch ? ch.lines.intro : '…';
  const r = c.d.h2h[id];
  return !r || r.w + r.l === 0 ? P.first : r.l > r.w ? P.won : P.lost;
}
// Waiting room: the next opponent walks over for a word before the match.
export function roomBanter(id, c) {
  const d = c.d, me = d.name, ct = d.contract;
  const S = (text, o = {}) => Object.assign({ who: id, text }, o);
  const late = ct && ct.day <= d.day;
  return [S(`${josa(me, '이/가')} 오늘 상대라고? ` + preFightLine(id, c), { expr: 'smug' }),
    S(late ? '오늘이 마감일이다. 도망치면 사장님이 가만 안 있을걸?' : pick(['몸 풀고 와라. 링에서 기다리지.', '오늘 관객 많다더라. 창피 당하기 딱 좋은 날이지.', '대기실 공기가 무겁군. 네 긴장 때문이겠지?']), { expr: 'fierce' })];
}
export const npcPick = pick;
