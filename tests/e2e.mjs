// Keyboard-only career run in headless Chrome (node build.mjs first; npm run test:e2e): name entry (IME orders), lobby -> office -> boss -> contract ->
// menus -> arena -> match -> result -> clinic -> gym training. Prints FAIL lines; exit code 1 on any failure.
import { launch, serve } from './cdp.mjs';
const { s, port } = await serve();
const p = await launch({ w: 1280, h: 720 });
const fails = [], log = (...a) => console.log(...a);
const check = (ok, what, extra = '') => { if (ok) log('ok  ', what); else { fails.push(what); log('FAIL', what, extra); } };
const ev = c => p.eval(`(()=>{${c}})()`);
const step = (n = 1) => ev(`__NHS.step(${n},1/60); return 1`);
const VK = { Enter: 13, Escape: 27, Tab: 9, Space: 32, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 };
const KEY = { Enter: 'Enter', Escape: 'Escape', Tab: 'Tab', Space: ' ', ArrowLeft: 'ArrowLeft', ArrowUp: 'ArrowUp', ArrowRight: 'ArrowRight', ArrowDown: 'ArrowDown' };
async function kd(code, o = {}) { await p.send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: o.key || KEY[code] || code.replace(/^Key/, '').toLowerCase(), windowsVirtualKeyCode: o.vk != null ? o.vk : VK[code] || (code.startsWith('Key') ? code.charCodeAt(3) : 0) }); }
async function ku(code, o = {}) { await p.send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: o.key || KEY[code] || code.replace(/^Key/, '').toLowerCase(), windowsVirtualKeyCode: o.vk != null ? o.vk : VK[code] || (code.startsWith('Key') ? code.charCodeAt(3) : 0) }); }
async function tap(code, frames = 2) { await kd(code); await step(frames); await ku(code); await step(frames); }
const st = () => ev(`const g=__NHS.game, sc=g.scene, W=sc; const r={scene:sc&&sc.constructor.name, ov:g.overlays.map(o=>o.constructor.name)};
  if (sc && sc.c && sc.player) { Object.assign(r,{loc:W.loc, x:Math.round(W.player.x), fadeT:W.fadeT, dialog:!!W.dialog, dlg:W.dialog&&W.dialog.cur?(W.dialog.cur.text||(W.dialog.cur.choice?'[choice]':'')).slice(0,30):null, wov:W.overlays.map(o=>o.constructor.name), prompt:W.prompt?(W.prompt.kind+':'+W.prompt.label):null, contract:W.c.d.contract?W.c.d.contract.oppName:null, injury:+W.c.d.injury.toFixed(1), money:W.c.d.money, slot:W.c.d.slot, day:W.c.d.day, metBoss:!!W.c.d.flags.metBoss, guide:W.guide&&W.guide.ob.text}); }
  if (sc && sc.constructor.name==='CreateScene') Object.assign(r,{name:sc.name,row:sc.row,input:!!sc.input,inputVal:sc.input&&sc.input.value,active:document.activeElement&&document.activeElement.tagName,cool:sc.cool,ask:!!sc.ask});
  if (sc && sc.m) Object.assign(r,{phase:sc.m.phase});
  return JSON.stringify(r);`).then(JSON.parse);
async function walk(code, until, max = 900) { await kd(code); let r; for (let i = 0; i < max; i += 6) { await step(6); r = await st(); if (until(r)) break; } await ku(code); await step(3); return st(); }
async function advanceDialog(max = 30) { for (let i = 0; i < max; i++) { const r = await st(); if (!r.dialog) return r; await tap('KeyE', 2); await step(2); } return st(); }

try {
  await p.goto(`http://127.0.0.1:${port}/index.html`, 800);
  await ev(`localStorage.clear(); return 1`);
  await p.goto(`http://127.0.0.1:${port}/index.html`, 800);
  await ev(`window.__evs=[]; for (const t of ['keydown','compositionstart','compositionend','input']) document.addEventListener(t, e => __evs.push(t+(e.key?':'+e.key:'')+(e.keyCode?'/'+e.keyCode:'')+(e.isComposing?'/C':'')+(e.data?'='+e.data:'')), true); return 1`);
  await step(10);
  // ---- title -> create
  await tap('Enter'); await step(60);
  let r = await st();
  check(r.scene === 'CreateScene', 'title Enter opens the creator', JSON.stringify(r));
  await step(40); await p.wait(80); await step(2);
  r = await st();
  check(r.input && r.active === 'INPUT', 'name box opens by itself and has focus', JSON.stringify(r));
  await p.shot('e2e_01_namebox');

  // ---- A: Windows Korean IME, Enter arrives as Process/229 while composing, then the commit
  for (const t of ['ㅍ', '파', '팓', '파도']) await p.send('Input.imeSetComposition', { text: t, selectionStart: t.length, selectionEnd: t.length });
  await kd('Enter', { key: 'Process', vk: 229 });
  await p.send('Input.insertText', { text: '파도' });
  await ku('Enter'); await p.wait(120); await step(4);
  r = await st();
  log('   events A:', (await ev(`const a=__evs.slice(); __evs.length=0; return a.join(' ')`)));
  check(r.name === '파도' && !r.input, 'A: IME Enter (Process/229) confirms the name', JSON.stringify(r));
  check(r.row === 1, 'A: cursor moved to the next row', JSON.stringify(r));
  await tap('ArrowDown'); r = await st();
  check(r.row === 2, 'A: arrow keys work right after closing', JSON.stringify(r));
  await tap('ArrowUp'); await step(30); r = await st();
  check(!r.input && r.row === 1, 'A: box stays closed', JSON.stringify(r));

  // ---- B: macOS order, a composing Enter then a second plain Enter
  await tap('ArrowUp'); await tap('Enter'); await p.wait(60); await step(2);
  r = await st(); check(r.input && r.inputVal === '파도', 'B: Enter on the name row reopens with the name', JSON.stringify(r));
  await ev(`__NHS.game.scene.input.select(); return 1`);
  for (const t of ['ㅂ', '바', '바라', '바람']) await p.send('Input.imeSetComposition', { text: t, selectionStart: t.length, selectionEnd: t.length });
  await kd('Enter', { vk: 229 });
  await p.send('Input.insertText', { text: '바람' });
  await kd('Enter'); await ku('Enter'); await p.wait(120); await step(4);
  log('   events B:', (await ev(`const a=__evs.slice(); __evs.length=0; return a.join(' ')`)));
  r = await st(); check(r.name === '바람' && !r.input, 'B: composing Enter + plain Enter gives the name once', JSON.stringify(r));
  await step(30); r = await st(); check(!r.input, 'B: second Enter did not reopen the box', JSON.stringify(r));

  // ---- C: plain Latin + Enter
  await tap('ArrowUp'); await tap('Enter'); await p.wait(60); await step(2);
  await ev(`__NHS.game.scene.input.select(); return 1`);
  await p.send('Input.insertText', { text: 'Wave' });
  await tap('Enter'); await p.wait(60); await step(4);
  r = await st(); check(r.name === 'Wave' && !r.input, 'C: Latin name + Enter', JSON.stringify(r));
  await step(30);

  // ---- D: the box never gets focus; Enter on the page still closes it
  await tap('ArrowUp');
  await ev(`window.__f=HTMLElement.prototype.focus; HTMLElement.prototype.focus=function(){}; return 1`);
  await tap('Enter'); await p.wait(60); await step(2);
  r = await st(); check(r.input && r.active !== 'INPUT', 'D: box open without focus', JSON.stringify(r));
  await tap('Enter'); await p.wait(60); await step(4);
  await ev(`HTMLElement.prototype.focus=window.__f; return 1`);
  r = await st(); check(!r.input && r.name === 'Wave', 'D: Enter without focus closes the box, keeps the name', JSON.stringify(r));
  await step(30);

  // ---- E: Esc while typing keeps what was typed; then the final Korean name
  await tap('ArrowUp'); await tap('Enter'); await p.wait(60); await step(2);
  await ev(`__NHS.game.scene.input.select(); return 1`);
  for (const t of ['ㅍ', '파', '팓', '파도']) await p.send('Input.imeSetComposition', { text: t, selectionStart: t.length, selectionEnd: t.length });
  await p.send('Input.insertText', { text: '파도' });
  await tap('Escape'); await p.wait(60); await step(4);
  r = await st(); check(r.name === '파도' && !r.input && r.scene === 'CreateScene', 'E: Esc closes the box with the typed name, stays on the screen', JSON.stringify(r));
  await p.shot('e2e_02_named');

  // ---- start: go to the last row and press Enter (no save yet: no overwrite question)
  await step(20); await tap('ArrowUp'); await tap('ArrowUp');
  r = await st(); log('   row before start', r.row);
  for (let i = 0; i < 20 && r.row !== 15; i++) { await tap('ArrowDown'); r = await st(); }
  await tap('Enter'); await step(70);
  r = await st(); check(r.scene === 'TutorialOffer', 'a new wrestler is offered the basics', JSON.stringify(r));
  await p.shot('e2e_03a_offer');
  await tap('ArrowDown'); await tap('Enter'); await step(70);
  r = await st();
  check(r.scene === 'WorldScene' && r.loc === 'lobby' && r.dialog, 'skipping the basics -> lobby with the janitor intro', JSON.stringify(r));
  await p.shot('e2e_03_intro');
  r = await advanceDialog();
  check(!r.dialog, 'intro dialogue closes with E', JSON.stringify(r));
  log('   guide:', r.guide);
  await p.shot('e2e_04_lobby_guide');

  // ---- to the office door, F
  r = await walk('KeyD', q => q.prompt && q.prompt.includes('사장실'));
  check(r.prompt && r.prompt.startsWith('door:사장실'), 'walking right reaches the office door prompt', JSON.stringify(r));
  await tap('KeyF'); await step(50);
  r = await st();
  check(r.loc === 'office' && r.fadeT === 0, 'F enters the office and the fade timer ends at 0', JSON.stringify(r));
  // ---- talk to the boss with E
  r = await walk('KeyD', q => q.prompt && q.prompt.startsWith('npc:'));
  check(r.prompt === 'npc:구만석 사장', 'boss prompt appears', JSON.stringify(r));
  await p.shot('e2e_05_boss_prompt');
  await tap('KeyE'); await step(4);
  r = await st(); check(r.dialog, 'E starts the boss conversation', JSON.stringify(r));
  await p.shot('e2e_06_boss_talk');
  for (let i = 0; i < 30; i++) { r = await st(); if (!r.dialog || r.wov.length) break; await tap('KeyE'); await step(2); }
  r = await st(); check(r.wov.includes('OffersMenu'), 'first talk ends in the offers window', JSON.stringify(r));
  await p.shot('e2e_07_offers');
  await tap('Enter'); await step(3);
  r = await st(); check(r.wov.includes('Confirm'), 'Enter on an offer asks to confirm', JSON.stringify(r));
  await tap('Enter'); await step(3);
  r = await st(); check(!!r.contract, 'Enter on the confirm (default 예) signs the contract', JSON.stringify(r));
  r = await advanceDialog();
  check(!r.dialog && !r.wov.length, 'boss reply closes', JSON.stringify(r));
  log('   guide after contract:', r.guide);
  // second talk: choice menu, pick "그만 가 보겠습니다"
  await tap('KeyE'); await step(3);
  for (let i = 0; i < 20; i++) { r = await st(); if (r.dlg === '[choice]') break; await tap('KeyE'); await step(2); }
  check(r.dlg === '[choice]', 'second talk reaches the choice menu', JSON.stringify(r));
  await p.shot('e2e_08_choice');
  await tap('ArrowUp'); await tap('Enter'); await step(3); r = await advanceDialog();
  check(!r.dialog, 'choice "그만 가 보겠습니다" ends the talk', JSON.stringify(r));

  // ---- menus by key: Tab, M, Esc
  await tap('Tab'); r = await st(); check(r.wov.includes('InfoMenu'), 'Tab opens info', JSON.stringify(r));
  await p.shot('e2e_09_info');
  await tap('Tab'); r = await st(); check(!r.wov.length, 'Tab closes info', JSON.stringify(r));
  await tap('KeyM'); r = await st(); check(r.wov.includes('MapMenu'), 'M opens the map', JSON.stringify(r));
  await tap('KeyM'); r = await st(); check(!r.wov.length, 'M closes the map', JSON.stringify(r));
  await tap('Escape'); r = await st(); check(r.wov.includes('PauseMenu'), 'Esc opens the menu', JSON.stringify(r));
  await tap('Escape'); r = await st(); check(!r.wov.length, 'Esc closes the menu', JSON.stringify(r));

  // ---- back to the lobby, jump still works after two doors
  r = await walk('KeyA', q => q.prompt && q.prompt.startsWith('door:'));
  await tap('KeyF'); await step(50);
  r = await st(); check(r.loc === 'lobby' && r.fadeT === 0, 'office door back to the lobby', JSON.stringify(r));
  await kd('KeyW'); await step(2); const vy = await ev(`return __NHS.game.scene.player.vy`); await ku('KeyW'); await step(40);
  check(vy < 0, 'W jumps after going through doors', 'vy=' + vy);

  // ---- arena: walk to the door, E works on doors too
  r = await walk('KeyD', q => q.prompt && q.prompt.includes('경기장'), 2400);
  await tap('KeyE'); await step(50);
  r = await st(); check(r.loc === 'arena', 'E on a door also goes through', JSON.stringify(r));
  for (let i = 0; i < 60 && !r.dialog; i++) { await step(10); r = await st(); }
  check(r.dialog && /상대라고/.test(r.dlg || ''), 'the next opponent walks over in the waiting room', JSON.stringify(r));
  await p.shot('e2e_10a_banter');
  r = await advanceDialog();
  r = await walk('KeyD', q => q.prompt && q.prompt.startsWith('npc:진행요원'), 1200);
  check(r.prompt === 'npc:진행요원 도진', 'staff prompt in the arena', JSON.stringify(r));
  await tap('Enter'); await step(3);
  r = await st(); check(r.dialog, 'Enter also talks', JSON.stringify(r));
  for (let i = 0; i < 20; i++) { r = await st(); if (r.wov.includes('ArenaMenu')) break; await tap('KeyE'); await step(2); }
  check(r.wov.includes('ArenaMenu'), 'staff opens the match list', JSON.stringify(r));
  await p.shot('e2e_10_arena_list');
  await tap('Enter'); await step(80);
  r = await st(); check(r.scene === 'MatchScene', 'contract match starts', JSON.stringify(r));
  // the entrance: somebody walks the aisle before the bell; Enter skips the rest
  let ent = null;
  for (let i = 0; i < 40; i++) { ent = await ev(`const m=__NHS.game.scene.m; return m.entrance ? JSON.stringify({ done: m.entrance.done, walking: m.fighters.some(f => f.side === 'out' && !f.hidden), cur: m.entrance.current && m.entrance.current.f.name }) : null`).then(x => x && JSON.parse(x)); if (ent && ent.walking) break; await step(10); }
  check(ent && ent.walking, 'an entrance: a wrestler walks out of the aisle toward the ring', JSON.stringify(ent));
  await p.shot('e2e_10c_entrance');
  await tap('Enter'); await step(10);
  r = await ev(`const m=__NHS.game.scene.m; return JSON.stringify({ done: m.entrance.done, inside: m.fighters.every(f => f.side === 'in' && !f.hidden) })`).then(JSON.parse);
  check(r.done && r.inside, 'Enter skips the entrances: both stand in the ring', JSON.stringify(r));
  for (let i = 0; i < 40; i++) { if (await ev(`return !!__NHS.game.scene.talk`)) break; await step(10); }
  check(await ev(`return !!__NHS.game.scene.talk`), 'face to face in the ring: the opponent talks before the bell', '');
  await p.shot('e2e_10b_ringtalk');
  for (let i = 0; i < 12; i++) { const c = await ev(`const t=__NHS.game.scene.talk; return t && t.cur && t.cur.choice ? 1 : t ? 0 : -1`); if (c !== 0) break; await tap('KeyE'); await step(2); }
  const fin0 = await ev(`return __NHS.game.scene.m.human.fin`);
  await tap('Enter'); await step(3);
  for (let i = 0; i < 6; i++) { if (!(await ev(`return !!__NHS.game.scene.talk`))) break; await tap('KeyE'); await step(3); }
  const fin1 = await ev(`return __NHS.game.scene.m.human.fin`);
  check(fin1 >= fin0 + 14, 'answering with a taunt fills the gauge', `${fin0} -> ${fin1}`);
  // let an AI play our side
  await ev(`const m=__NHS.game.scene.m, h=m.human; h.ai=new __m['combat/AIController.js'].AIController(h,'expert',m.rng); return 1`);
  for (let i = 0; i < 60; i++) { const q = await ev(`__NHS.step(300,1/60); const sc=__NHS.game.scene; return sc.m ? sc.m.phase+(sc.resultShown?'R':'') : sc.constructor.name`); if (/R$/.test(q)) { await p.shot('e2e_11_match_result'); await tap('Enter'); await step(10); await tap('Enter'); await step(80); break; } if (!/fight|intro|ready|end/.test(q)) break; }
  r = await st();
  check(r.scene === 'WorldScene' && r.wov.includes('ResultMenu'), 'match ends and the world shows the result window', JSON.stringify(r));
  await p.shot('e2e_12_world_result');
  await step(50); await tap('Enter'); await step(6);
  r = await st(); log('   after result', JSON.stringify(r));
  check(!r.wov.length && !r.contract, 'result closes, contract used up', JSON.stringify(r));
  r = await advanceDialog();
  const inj0 = r.injury, money0 = r.money;
  check(inj0 > 0, 'injury rose after the match', 'inj=' + inj0);

  // ---- clinic: arena -> lobby -> street -> clinic, talk to the doctor, first aid
  r = await walk('KeyA', q => q.prompt && q.prompt.startsWith('door:'), 1800); await tap('KeyF'); await step(50);
  r = await walk('KeyA', q => q.prompt && q.prompt.includes('건물 밖'), 3000); await tap('KeyF'); await step(50);
  r = await st(); check(r.loc === 'street', 'lobby -> street', JSON.stringify(r));
  r = await walk('KeyD', q => q.prompt && q.prompt.includes('항구의원'), 1800); await tap('KeyF'); await step(50);
  r = await st(); check(r.loc === 'clinic', 'street -> clinic', JSON.stringify(r));
  r = await walk('KeyD', q => q.prompt && q.prompt.startsWith('npc:한 선생'), 1200);
  await tap('KeyE'); await step(3);
  for (let i = 0; i < 20; i++) { r = await st(); if (r.wov.includes('ClinicMenu')) break; await tap('KeyE'); await step(2); }
  check(r.wov.includes('ClinicMenu'), 'doctor opens the clinic window', JSON.stringify(r));
  await p.shot('e2e_13_clinic');
  await tap('Enter'); await step(3);
  r = await st(); check(r.injury < inj0 && r.money < money0, 'first aid lowers injury for money', `inj ${inj0}->${r.injury} money ${money0}->${r.money}`);
  await tap('Escape'); await step(3);

  // ---- gym training by keys: street -> lobby -> gym -> bench
  r = await walk('KeyA', q => q.prompt && q.prompt.startsWith('door:'), 1200); await tap('KeyF'); await step(50);
  r = await walk('KeyA', q => q.prompt && q.prompt.includes('체육관'), 2400); await tap('KeyF'); await step(50);
  r = await walk('KeyD', q => q.prompt && q.prompt.includes('훈련장'), 2400); await tap('KeyF'); await step(50);
  r = await st(); check(r.loc === 'gym', 'lobby -> gym', JSON.stringify(r));
  r = await walk('KeyD', q => q.prompt && q.prompt.includes('벤치'), 1800);
  const slot0 = r.slot;
  await tap('KeyE'); await step(3);
  r = await st(); check(r.wov.includes('Training'), 'E on the bench opens training', JSON.stringify(r));
  await tap('Enter'); await step(3);
  for (let i = 0; i < 12; i++) { await tap('Enter', 2); await step(8); r = await st(); if (await ev(`const o=__NHS.game.scene.overlays[0]; return o&&o.phase==='result'`)) break; }
  const ph = await ev(`const o=__NHS.game.scene.overlays[0]; return o&&o.phase`);
  check(ph === 'result', 'bench press finished with Enter presses', 'phase=' + ph);
  await p.shot('e2e_14_training');
  await step(40); await tap('Enter'); await step(3);
  r = await st(); check(!r.wov.length && (r.slot !== slot0 || r.day > 1), 'training used a time slot', JSON.stringify(r));
  // ---- breathing: the Enter that starts the game is not read as the first breath
  await ev(`const W=__NHS.game.scene; W.c.d.money=Math.max(W.c.d.money,60000); W.c.d.fatigue=0; W.startTraining('breath'); return 1`); await step(3);
  await kd('Enter'); await step(5); await ku('Enter'); await step(20);
  let br = await ev(`const o=__NHS.game.scene.overlays[0]; return JSON.stringify({ph:o.phase, round:o.s&&o.s.round, done:o.s&&o.s.done})`).then(JSON.parse);
  check(br.ph === 'play' && br.round === 0 && br.done.length === 0, 'breath training: starting with Enter is not a failed breath', JSON.stringify(br));
  await kd('KeyJ'); await step(86); await ku('KeyJ'); await step(4);
  br = await ev(`const o=__NHS.game.scene.overlays[0]; return JSON.stringify({ph:o.phase, round:o.s&&o.s.round, done:o.s&&o.s.done})`).then(JSON.parse);
  check(br.round === 1 && br.done[0] === true, 'breath training: holding J into the green band counts as a good breath', JSON.stringify(br));
  await ev(`const W=__NHS.game.scene; W.overlays[0].close(); return 1`); await step(3);

  // ---- with a save: the first title item continues it
  const saved = await ev(`const c=__NHS.game.scene.c; c.save(); return JSON.stringify({name:c.d.name, day:c.d.day, slot:c.d.slot, money:c.d.money})`).then(JSON.parse);
  await p.goto(`http://127.0.0.1:${port}/index.html`, 800);
  await step(10); await tap('Enter'); await step(80);
  r = await st();
  check(r.scene === 'WorldScene' && r.money === saved.money && r.day === saved.day && r.slot === saved.slot, 'title: 커리어 이어하기 loads the saved career', JSON.stringify(r) + ' saved ' + JSON.stringify(saved));
  // ---- new career: the slot screen; an occupied slot asks first (아니요 first), an empty one starts at once and keeps the other career
  await p.goto(`http://127.0.0.1:${port}/index.html`, 800);
  await step(10); await tap('ArrowDown'); await tap('Enter'); await step(20);
  r = await ev(`const sc=__NHS.game.scene; return JSON.stringify({ scene: sc.constructor.name, sel: sc.sel, info: sc.info && sc.info.map(x => x && x.name) })`).then(JSON.parse);
  check(r.scene === 'SlotScene' && r.info[0] === saved.name && !r.info[1] && r.sel === 1, 'title: 새 커리어 opens the slots on the first empty one', JSON.stringify(r));
  await p.shot('e2e_15_slots');
  await tap('ArrowUp'); await tap('Enter'); r = await ev(`return JSON.stringify(__NHS.game.scene.ask)`).then(JSON.parse);
  check(r && r.kind === 'new' && r.sel === 1, 'an occupied slot asks first, on 아니요', JSON.stringify(r));
  await tap('Enter'); r = await ev(`const sc=__NHS.game.scene; return JSON.stringify({ scene: sc.constructor.name, ask: sc.ask })`).then(JSON.parse);
  const kept = await ev(`return JSON.parse(localStorage.getItem('nhs.save1')).name`);
  check(r.scene === 'SlotScene' && !r.ask && kept === saved.name, 'default 아니요 keeps the old save', JSON.stringify(r) + ' kept=' + kept);
  await tap('ArrowDown'); await tap('Enter'); await step(80); await p.wait(80); await step(2);
  r = await st(); check(r.scene === 'CreateScene' && r.input, 'the empty slot 2 opens the creator with the name box', JSON.stringify(r));
  await p.send('Input.insertText', { text: '등대' }); await tap('Enter'); await p.wait(60); await step(30);
  for (let i = 0; i < 20 && (await st()).row !== 15; i++) await tap('ArrowDown');
  await tap('Enter'); await step(70);
  await tap('ArrowDown'); await tap('Enter'); await step(70);
  r = await st();
  const now = await ev(`return __NHS.game.scene.c && JSON.stringify({ name: __NHS.game.scene.c.d.name, slot: __NHS.game.scene.c.d.saveSlot })`).then(x => x && JSON.parse(x));
  const both = await ev(`return JSON.stringify([JSON.parse(localStorage.getItem('nhs.save1')).name, JSON.parse(localStorage.getItem('nhs.save2')).name])`).then(JSON.parse);
  check(r.scene === 'WorldScene' && now && now.name === '등대' && now.slot === 2 && r.money === 60000, 'the new career lives in slot 2', JSON.stringify(r) + ' now=' + JSON.stringify(now));
  check(both[0] === saved.name && both[1] === '등대', 'slot 1 keeps the old career', JSON.stringify(both));
  check(r.slot === 0, 'a new career starts in the morning', 'slot=' + r.slot);
  r = await advanceDialog();
  // ---- game over -> "마지막 아침부터 다시 하기" restores the morning checkpoint
  await ev(`const W=__NHS.game.scene; W.c.d.injury=100; W.c.save(); W.checkGameOver(); return 1`);
  await step(140);
  r = await st(); check(r.scene === 'GameOverScene', 'injury 100% ends the career', JSON.stringify(r));
  await p.shot('e2e_16_gameover');
  await tap('Enter'); await step(80);
  r = await st();
  check(r.scene === 'WorldScene' && r.injury < 100, 'restart from the last morning checkpoint', JSON.stringify(r));
  const back = await ev(`return JSON.parse(localStorage.getItem('nhs.save1')).injury`);
  check(back < 100, 'the restored state is what is saved now', 'saved injury=' + back);
  r = await advanceDialog();

  // helpers for the town events
  const throughDoor = async (label) => { r = await walk(r.x < 700 ? 'KeyD' : 'KeyA', q => q.prompt && q.prompt.includes(label), 3000); await tap('KeyF'); await step(50); return st(); };
  const aiPlays = async (shot) => {
    await ev(`const m=__NHS.game.scene.m, h=m.human; h.ai=new __m['combat/AIController.js'].AIController(h,'expert',m.rng); const sc=__NHS.game.scene; sc.pre=null; if (sc.talk) { sc.talk.close(); } m.holdIntro=false; return 1`);
    for (let i = 0; i < 80; i++) { const q = await ev(`__NHS.step(240,1/60); const sc=__NHS.game.scene; return sc.m ? sc.m.phase+(sc.resultShown?'R':'') : sc.constructor.name`); if (/R$/.test(q)) { if (shot) await p.shot(shot); await tap('Enter'); await step(90); break; } if (!/fight|intro|ready|end/.test(q)) break; }
    return st();
  };
  // ---- lobby raid: pay them off
  await ev(`const W=__NHS.game.scene; W.c.d.day=3; W.c.d.flags.gangDay=0; W.c.d.flags.gangSeen=0; W.c.d.money=60000; W.c.d.revenge=null; return 1`);
  r = await throughDoor('사장실');
  r = await walk('KeyA', q => q.prompt && q.prompt.startsWith('door:'), 1200); await tap('KeyF'); await step(50);
  r = await st(); check(r.loc === 'lobby', 'back in the lobby for the raid', JSON.stringify(r));
  for (let i = 0; i < 40 && !r.dialog; i++) { await step(10); r = await st(); }
  check(r.dialog, 'the dock gang walks up and talks', JSON.stringify(r));
  await p.shot('e2e_17_gang');
  for (let i = 0; i < 12; i++) { r = await st(); if (r.dlg === '[choice]') break; await tap('KeyE'); await step(2); }
  await tap('ArrowUp'); await tap('Enter'); await step(3); r = await advanceDialog();
  check(r.money === 52000 && !r.dialog, 'paying them off costs money and ends the raid', JSON.stringify(r));
  await step(120);
  const gone = await ev(`return __NHS.game.scene.npcs.filter(n=>n.id==='galchi'||n.id==='myeolchi').length`);
  check(gone === 0, 'the gang leaves the lobby', 'left=' + gone);
  // ---- lobby raid: fight them in the lobby
  await ev(`const W=__NHS.game.scene; W.c.d.flags.gangDay=0; W.c.d.flags.gangSeen=0; return 1`);
  r = await throughDoor('사장실');
  r = await walk('KeyA', q => q.prompt && q.prompt.startsWith('door:'), 1200); await tap('KeyF'); await step(50);
  r = await st(); for (let i = 0; i < 40 && !r.dialog; i++) { await step(10); r = await st(); }
  for (let i = 0; i < 12; i++) { r = await st(); if (r.dlg === '[choice]') break; await tap('KeyE'); await step(2); }
  await tap('Enter'); await step(80);
  r = await st(); check(r.scene === 'MatchScene', 'the lobby turns into a fight', JSON.stringify(r));
  const arena = await ev(`return __NHS.game.scene.m.arenaDef.id + ':' + __NHS.game.scene.m.fighters.length`);
  check(arena === 'lobby:3', 'lobby arena, one against two', arena);
  r = await aiPlays('e2e_18_brawl_result');
  check(r.scene === 'WorldScene' && r.loc === 'lobby', 'after the brawl the lobby is a lobby again', JSON.stringify(r));
  await step(50); await tap('Enter'); await step(6); r = await advanceDialog();
  // ---- revenge in the basement
  await ev(`const W=__NHS.game.scene; W.c.d.revenge={opp:'baeksang', oppName:'백상', day:W.c.d.day, until:W.c.d.day+5, invited:false}; W.c.d.flags.gangDay=W.c.d.day; return 1`);
  r = await throughDoor('사장실');
  r = await walk('KeyA', q => q.prompt && q.prompt.startsWith('door:'), 1200); await tap('KeyF'); await step(50);
  r = await walk('KeyD', q => q.dialog, 3000);
  r = await st(); for (let i = 0; i < 60 && !r.dialog; i++) { await step(10); r = await st(); }
  check(r.dialog, 'a beaten wrestler waits in the lobby and talks', JSON.stringify(r));
  for (let i = 0; i < 12; i++) { r = await st(); if (r.dlg === '[choice]') break; await tap('KeyE'); await step(2); }
  await tap('Enter'); await step(70);
  r = await st(); check(r.loc === 'basement', 'following them down to the basement', JSON.stringify(r));
  await p.shot('e2e_19_basement');
  r = await walk('KeyD', q => q.prompt && q.prompt.startsWith('npc:'), 1200);
  await tap('KeyE'); await step(3);
  for (let i = 0; i < 12; i++) { r = await st(); if (r.dlg === '[choice]') break; await tap('KeyE'); await step(2); }
  await tap('Enter'); await step(80);
  const where = await ev(`const sc=__NHS.game.scene; return sc.m ? sc.m.arenaDef.id : sc.constructor.name`);
  check(where === 'basement', 'the revenge match is in the basement ring', where);
  r = await aiPlays();
  const rv = await ev(`return JSON.stringify(__NHS.game.scene.c.d.revenge)`);
  check(r.scene === 'WorldScene' && r.loc === 'basement' && rv === 'null', 'after the revenge match: back in the basement, revenge settled', JSON.stringify(r) + ' ' + rv);
  await step(50); await tap('Enter'); await step(6); r = await advanceDialog();
  // ---- vending machine: three a day
  r = await walk('KeyA', q => q.prompt && q.prompt.startsWith('door:'), 1500); await tap('KeyF'); await step(50);
  await ev(`const W=__NHS.game.scene; W.c.d.fatigue=60; W.c.d.money=60000; W.c.d.flags.vend=null; return 1`);
  r = await st();
  r = await walk(r.x > 647 ? 'KeyA' : 'KeyD', q => q.prompt && q.prompt.includes('자판기'), 3000);
  await tap('KeyE'); await step(3);
  r = await st(); check(r.wov.includes('VendingMenu'), 'the vending machine has a menu', JSON.stringify(r));
  for (let i = 0; i < 4; i++) { await tap('Enter'); await step(3); }
  const vend = await ev(`const d=__NHS.game.scene.c.d, P=__m['world/market.js'].price(d, 'vending', '이온 음료', 3000); return JSON.stringify({ f: d.fatigue, m: d.money, n: d.flags.vend && d.flags.vend.n, p: P })`).then(JSON.parse);
  check(vend.f === 60 - 36 && vend.m === 60000 - 3 * vend.p && vend.n === 3, 'three drinks a day (at the day's price), the fourth is refused', JSON.stringify(vend));
  await tap('Escape'); await step(3);
  // ---- the travelling merchant
  await ev(`const W=__NHS.game.scene, d=W.c.d; for (let k=0;k<10;k++){ if ((d.day + d.season) % 5 === 2) break; d.day++; } d.money=90000; d.flags.newsDay=0; return d.day`);
  r = await st(); if (r.wov.length) { await tap('Escape'); await step(3); }
  r = await walk('KeyA', q => q.prompt && q.prompt.includes('건물 밖'), 3000); await tap('KeyF'); await step(50);
  // ---- 골목 영감 walks up by the alley once a day and asks for help: a coin counts
  r = await walk('KeyD', q => q.dialog, 3000);
  const asker = await ev(`const W=__NHS.game.scene; return W.dialog && W.dialog.cur ? W.dialog.cur.who : null`);
  check(r.dialog && asker === 'beggar', 'the old man by the alley walks up and asks for help', JSON.stringify(r) + ' ' + asker);
  for (let i = 0; i < 10; i++) { r = await st(); if (r.dlg === '[choice]') break; await tap('KeyE'); await step(2); }
  await tap('Enter'); await step(3); r = await advanceDialog();
  const bh = await ev(`const d=__NHS.game.scene.c.d; return JSON.stringify({ help: d.beggar && d.beggar.help, day: d.beggar && d.beggar.day, today: d.day, money: d.money })`).then(JSON.parse);
  check(bh.help === 1 && bh.day === bh.today && bh.money === 85000 && !r.dialog, 'a coin counts as his help for the day', JSON.stringify(bh));
  r = await walk('KeyD', q => q.prompt && q.prompt.startsWith('npc:떠돌이'), 6000);
  check(r.prompt === 'npc:떠돌이 상인 보부', 'the merchant is on the street today', JSON.stringify(r));
  await tap('KeyE'); await step(3); for (let i = 0; i < 6; i++) { r = await st(); if (r.wov.includes('MerchantMenu')) break; await tap('KeyE'); await step(2); }
  check(r.wov.includes('MerchantMenu'), 'the merchant opens a stall', JSON.stringify(r));
  await p.shot('e2e_20_merchant');
  await tap('Enter'); await step(3);
  const bought = await ev(`const d=__NHS.game.scene.c.d; return JSON.stringify({ m: d.money, ids: d.flags.merchant && d.flags.merchant.ids, buffs: d.buffs, items: d.items })`).then(JSON.parse);
  check(bought.m < 85000 && bought.ids && bought.ids.length === 1, 'bought one rare item', JSON.stringify(bought));
  await tap('Escape'); await step(3);
  // ---- the basics from the title: a few steps by hand, the rest skipped from the pause menu
  await ev(`__NHS.game.toTitle(); return 1`); await step(50);
  const tutAt = await ev(`return __NHS.game.scene.items().findIndex(x => x.label.startsWith('기초 훈련'))`);
  for (let i = 0; i < tutAt; i++) await tap('ArrowDown');
  await tap('Enter'); await step(70);
  const tut = () => ev(`const sc=__NHS.game.scene; return sc.tut ? JSON.stringify({ i: sc.tut.i, n: sc.tut.n }) : JSON.stringify({ scene: sc.constructor.name })`).then(JSON.parse);
  let T = await tut(); check(T.i === 0, 'the basics start from the title', JSON.stringify(T));
  await kd('KeyD'); await step(130); await ku('KeyD'); await step(100);
  T = await tut(); check(T.i === 1, 'basics: moving clears step 1', JSON.stringify(T));
  await kd('KeyA'); await step(3); await ku('KeyA'); await step(3); await kd('KeyA'); await step(120); await ku('KeyA'); await step(110);
  T = await tut(); check(T.i === 2, 'basics: a dash into the ropes clears step 2', JSON.stringify(T));
  await p.shot('e2e_21_basics');
  for (let i = 0; i < 2; i++) { await tap('KeyW'); await step(50); }
  await step(90); T = await tut(); check(T.i === 3, 'basics: two jumps clear step 3', JSON.stringify(T));
  await kd('KeyD'); for (let i = 0; i < 90; i++) { await step(2); if (await ev(`const m=__NHS.game.scene.m; return Math.abs(m.fighters[0].x-m.fighters[1].x) < 46`)) break; } await ku('KeyD');
  for (let k = 0; k < 4; k++) { for (let i = 0; i < 3; i++) { await tap('KeyJ', 2); await step(6); } await step(60); if ((await tut()).i === 4) break; }
  await step(90); T = await tut(); check(T.i === 4, 'basics: a three-hit string clears step 4', JSON.stringify(T));
  const left = await ev(`return __m['scenes/Tutorial.js'].TUTORIAL.length - __NHS.game.scene.tut.i`);   // the basics grow: skip whatever is left
  for (let i = 0; i < left + 1; i++) { await tap('Escape'); await tap('ArrowDown'); await tap('Enter'); await step(4); }
  await step(200);
  r = await st(); check(r.scene === 'TitleScene', 'skipping the rest of the basics returns to the title', JSON.stringify(r));
} catch (e) { fails.push('exception ' + e.message); console.log('ERR', e.stack); }
const errs = p.logs.filter(l => /EXC|error/i.test(l) && !l.includes('favicon'));
if (errs.length) { console.log(errs.slice(0, 10).join('\n')); fails.push('page errors'); }
console.log(fails.length ? `\n${fails.length} FAIL: ${fails.join(' | ')}` : '\nALL OK');
await p.close(); s.close();
process.exit(fails.length ? 1 : 0);
