// Entry point: builds the game and wires the top-level flow (title, quick match, career).
import { GameManager } from './core/GameManager.js';
import { TitleScene } from './scenes/TitleScene.js';
import { MatchScene } from './scenes/MatchScene.js';
import { SettingsOverlay } from './scenes/SettingsScene.js';
import { Career, hasCareer } from './world/CareerManager.js';
import { WorldScene } from './world/WorldScene.js';
import { CreateScene } from './world/CreateScene.js';

const canvas = document.getElementById('game');
const game = new GameManager(canvas);
game.toTitle = () => game.go(() => new TitleScene(game, { hasSave: hasCareer(1), onCareer: kind => startCareer(kind) }));
game.playMatch = (cfg, after) => game.go(() => new MatchScene(game, cfg, res => after && after(res)));
game.openSettings = () => game.push(new SettingsOverlay(game));
function startCareer(kind) {
  if (kind === 'continue') { const c = Career.load(1); if (c) { game.career = c; game.go(() => new WorldScene(game, c)); return; } }
  game.go(() => new CreateScene(game, look => { const c = Career.create(1, look); game.career = c; game.go(() => new WorldScene(game, c, { intro: true })); }));
}
game.startCareer = startCareer;
game.toTitle();
game.start();
// Test hook: step the game by hand from the console or a test driver.
window.__NHS = { game, step(n = 1, dt = 1 / 60) { game.manual = true; for (let i = 0; i < n; i++) game.step(dt); }, auto() { game.manual = false; } };
