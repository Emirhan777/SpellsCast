import assert from 'node:assert/strict';
import { claimPlayerSlot, controllerHud, duelResult } from '../game/match.js';

let clock = 0, frames = [];
const gradient = { addColorStop() {} };
const ctx = new Proxy({}, { get: (_, key) => key === 'createLinearGradient' || key === 'createRadialGradient'
  ? () => gradient : key === 'measureText' ? () => ({ width: 10 }) : () => {}, set: () => true });
const canvas = { clientWidth: 1280, clientHeight: 720, getContext: () => ctx };
globalThis.window = { addEventListener() {}, removeEventListener() {}, devicePixelRatio: 1 };
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.performance = { now: () => clock };
globalThis.requestAnimationFrame = fn => { frames.push(fn); return frames.length; };
globalThis.cancelAnimationFrame = () => {};
Math.random = () => .1; // Every wave supplies an Expel target.
const { createGame, SPELLS } = await import('../game/engine.js');
let hud;
const game = createGame(canvas, { onHud: h => { hud = h; } });
const tick = (count = 1) => { for (let i = 0; i < count; i++) { clock += 16; const callbacks = frames; frames = []; callbacks.forEach(fn => fn(clock)); } };
const jump = milliseconds => { clock += milliseconds; const callbacks = frames; frames = []; callbacks.forEach(fn => fn(clock)); };

// Draw the real spell through both actual blades, leaving their releases pending.
function drawBoth() {
  const glyph = SPELLS[0].glyph;
  for (let i = 1; i < glyph.length; i++) {
    const a = glyph[i - 1], b = glyph[i];
    for (let j = 0; j <= 25; j++) {
      const x = a[0] + (b[0] - a[0]) * j / 25;
      const y = .2 + (a[1] + (b[1] - a[1]) * j / 25) * .6;
      game.inputLocal('a', x, y, true, 0); game.inputLocal('b', x, y, true, 1); tick();
    }
  }
  tick(3);
}
const release = pid => game.inputLocal(pid, .78, .2, false, pid === 'a' ? 0 : 1);

game.configureMatch('duel', 60);
game.addPlayer('a', 0);
assert.equal(game.start(), false, 'one wizard cannot start a duel');
game.addPlayer('b', 1);
assert.equal(game.start(), true);
assert.equal(game.start(), false, 'repeated start cannot reset an active duel');
assert.equal(game.configureMatch('solo', 60), false, 'active mode cannot change');
tick(205); assert.equal(game.state, 'playing'); assert.equal(hud.timeLeft, 60);
tick(35); drawBoth();
release('b'); release('a'); // Slot 1 arrives first in the same rendering frame.
assert.equal(hud.wizards[1].score, 1, 'first arrival earns exactly one point');
assert.equal(hud.wizards[0].score, 0, 'second wizard cannot claim the same target');
assert.equal(game.score, 1);
assert.equal(controllerHud(hud, 'b', 1).score, 1);
assert.equal(controllerHud(hud, 'a', 0).opponentScore, 1);
const lives = game.lives;
tick(1100);
assert.equal(game.lives, lives, 'misses cannot end a timed duel early');
assert.equal(game.state, 'playing');
jump(60000); // A suspended tab must not extend the match.
assert.equal(game.state, 'over'); assert.equal(hud.timeLeft, 0);
assert.equal(hud.result, 'Wizard 2 wins!');
assert.equal(hud.winnerSlot, 1);
const scores = hud.wizards.map(w => w.score);
drawBoth(); release('a'); release('b');
assert.equal(game.state, 'over', 'post-match casts cannot auto-restart a duel');
assert.deepEqual(hud.wizards.map(w => w.score), scores);
assert.equal(game.start(), true); assert.equal(hud.wizards[1].score, 0, 'rematch resets scores');
tick(205); jump(60000);
assert.equal(hud.result, 'Draw!');
const deadline = clock + 3200 + 60000;
game.start(); tick(240); drawBoth(); clock = deadline;
release('a');
assert.equal(game.state, 'over', 'a release at the deadline ends the match before scoring');
assert.deepEqual(hud.wizards.map(w => w.score), [0, 0]);
game.start(); game.removePlayer('b');
assert.equal(game.state, 'lobby', 'disconnect cancels the match');
assert.match(hud.matchNotice, /disconnected/);
assert.equal(hud.matchReady, false);
game.addPlayer('c', 1); assert.equal(game.start(), true, 'replacement wizard can start a fresh match');

assert.equal(duelResult([{slot:0,score:3},{slot:1,score:1}]).winnerSlot, 0);
const first = claimPlayerSlot(null, 'a');
const second = claimPlayerSlot(first, 'b');
assert.equal(second.b.slot, 1); assert.equal(claimPlayerSlot(second, 'c'), undefined);
const personal = controllerHud({mode:'duel',wizards:second,castPid:'b',spell:'Expel'},'a',0);
assert.equal(personal.spell, '', 'another wizard cast cannot trigger your feedback');
game.destroy();
console.log('PASS duel: first arrival, one point per target, separate scores, deadline, tie, rematch, disconnect, player slots and personal HUD.');
