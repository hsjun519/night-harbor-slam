// Difficulty ladder: the same wrestler at two AI levels. Higher levels should win clearly more often.
import { MatchManager } from '../src/combat/MatchManager.js';
const levels = ['easy', 'normal', 'hard', 'expert'], chars = ['rookie', 'taesan', 'haneul', 'dohyun', 'bokja', 'neon'];
const n = +(process.argv[2] || 6);
for (let a = 0; a < 3; a++) {
  const lo = levels[a], hi = levels[a + 1];
  let hiWins = 0, games = 0, counters = 0, reversals = 0;
  for (let g = 0; g < n; g++) {
    const c = chars[g % chars.length], flip = g % 2;
    const E = [{ char: c, ctrl: 'ai', difficulty: flip ? hi : lo }, { char: c, ctrl: 'ai', difficulty: flip ? lo : hi }];
    const m = new MatchManager({ mode: 'single', arena: 'hall', entrants: E, seed: 500 + g * 17 + a, skipIntro: true });
    m.on('counter', () => counters++); m.on('reversal', () => reversals++);
    for (let i = 0; i < 360 * 60 && m.phase !== 'end'; i++) m.update(1 / 60);
    games++;
    if (m.result && !m.result.draw && m.result.winner.difficulty === hi) hiWins++;
  }
  console.log(`${hi} vs ${lo}: ${hiWins}/${games} wins for ${hi} · counters ${counters} · reversals ${reversals}`);
}
