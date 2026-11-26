// Entry point: builds the game and wires the top-level flow (title, quick match, career).
import { GameManager } from './core/GameManager.js';
import { TitleScene } from './scenes/TitleScene.js';
import { MatchScene } from './scenes/MatchScene.js';
import { SettingsOverlay } from './scenes/SettingsScene.js';
import { Career, hasCareer } from './world/CareerManager.js';
import { WorldScene } from './world/WorldScene.js';
import { CreateScene } from './world/CreateScene.js';
import { TutorialOffer } from './scenes/Tutorial.js';

const canvas = document.getElementById('game');
const game = new GameManager(canvas);
game.toTitle = () => game.go(() => new TitleScene(game, { hasSave: hasCareer(1), onCareer: kind => startCareer(kind) }));
game.playMatch = (cfg, after) => game.go(() => new MatchScene(game, cfg, res => after && after(res)));
game.openSettings = () => game.push(new SettingsOverlay(game));
// 백 관장's basics in the gym ring; c may be null (from the title, with the rookie)
function playTutorial(c, after) {
  game.playMatch({ mode: 'practice', arena: 'gym', entrants: [c ? c.entrant('human') : { char: 'rookie', ctrl: 'human' }, { char: 'dohyun', ctrl: 'dummy', difficulty: 'normal' }], practice: { infinite: true }, skipIntro: true, tutorial: true, music: 'gym', career: c ? 1 : 0 }, res => after(res));
}
game.playTutorial = playTutorial;
function startCareer(kind, given) {
  if (kind === 'continue') { const c = given || Career.load(1); if (c) { game.career = c; game.go(() => new WorldScene(game, c)); return; } }
  game.go(() => new CreateScene(game, look => {
    const c = Career.create(1, look); game.career = c;
    const toTown = o => game.go(() => new WorldScene(game, c, Object.assign({ intro: true }, o)));
    game.go(() => new TutorialOffer(game, () => playTutorial(c, res => { if (res.completed) { c.d.flags.tutored = 1; c.save(); } toTown({ tutored: res.completed }); }), () => toTown({})));
  }));
}
game.startCareer = startCareer;
game.toTitle();
game.start();
// Test hook: step the game by hand from the console or a test driver.
window.__NHS = { game, step(n = 1, dt = 1 / 60) { game.manual = true; for (let i = 0; i < n; i++) game.step(dt); }, auto() { game.manual = false; } };
