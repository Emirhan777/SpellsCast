import { createGame, SPELLS } from '../../game/engine.js';
const $ = id => document.getElementById(id);
let paused = false, pointer = null, trace = [], feedbackTimer;
// Synthesized effects are local; this mode never requests music recordings.
const game = createGame($('game'), {
  onHud(hud) {
    $('score').textContent = hud.score;
    $('lives').textContent = Array.from({ length: 3 }, (_, i) => i < hud.lives ? '●' : '○').join(' ');
    $('lives').setAttribute('aria-label', `${hud.lives} lives remaining`);
  },
  onState(state) {
    $('pause').disabled = !['playing', 'countdown'].includes(state);
    if (state === 'over') { $('intro').hidden = false; $('intro').querySelector('h1').textContent = 'Wand down'; $('play').textContent = 'Play again'; }
  },
  onCast(cast) {
    clearTimeout(feedbackTimer);
    $('feedback').textContent = cast.spell ? `${cast.name}${cast.ok ? ' ✓' : ' · no target'}` : 'Try again — follow the rune.';
    feedbackTimer = setTimeout(() => { $('feedback').textContent = 'Draw on the pad. Lift to cast.'; }, 2200);
  },
});
game.sound.setMusicTrack('none');
game.sound.setMuted(true);
game.addPlayer('device', 0);
for (const spell of SPELLS) {
  const node = document.createElement('div'); node.className = 'rune'; node.style.color = spell.color;
  const points = spell.glyph.map(([x, y]) => `${10 + 80 * x},${10 + 80 * y}`).join(' ');
  const a = spell.glyph.at(-2), b = spell.glyph.at(-1), angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const x = 10 + 80 * b[0], y = 10 + 80 * b[1];
  node.innerHTML = `<svg viewBox="0 0 100 100"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/><path d="M${x - 13 * Math.cos(angle - .5)},${y - 13 * Math.sin(angle - .5)} L${x},${y} L${x - 13 * Math.cos(angle + .5)},${y - 13 * Math.sin(angle + .5)}" fill="none" stroke="currentColor" stroke-width="5"/></svg><span>${spell.name}</span>`;
  $('runes').append(node);
}
function cancelStroke() {
  if (pointer !== null) {
    const id = pointer; pointer = null;
    if ($('pad').hasPointerCapture(id)) $('pad').releasePointerCapture(id);
    // Discard interrupted strokes rather than casting when Control Center opens.
    game.removePlayer('device'); game.addPlayer('device', 0);
  }
  $('pad').classList.remove('casting'); $('trace').setAttribute('points', '');
}
function pause() {
  cancelStroke();
  if (!['playing', 'countdown'].includes(game.state)) return;
  paused = true; game.setPaused(true); $('paused').hidden = false;
  void game.sound.ctx?.suspend();
}
function resume() {
  paused = false; game.setPaused(false); $('paused').hidden = true;
  if (!game.isMuted()) game.sound.init();
}
window.deviceGame = { pause };
window.addEventListener('message', event => { if (event.source === window.parent && event.data === 'pause-device-game') pause(); });
$('pause').onclick = pause;
$('resume').onclick = resume;
$('play').onclick = () => { resume(); $('intro').hidden = true; game.start(); };
$('sound').onclick = () => {
  game.sound.init(); const muted = game.toggleMute();
  $('sound').textContent = muted ? 'Sound off' : 'Sound on';
  $('sound').setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
};
function point(event) {
  const box = $('pad').getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
  const y = Math.max(0, Math.min(1, (event.clientY - box.top) / box.height));
  if (trace.length < 600) trace.push([x, y]);
  $('trace').setAttribute('points', trace.map(([x, y]) => `${x * 100},${y * 100}`).join(' '));
  game.inputLocal('device', x, y, true);
}
$('pad').addEventListener('pointerdown', event => {
  if (pointer !== null || paused || game.state !== 'playing') return;
  event.preventDefault(); pointer = event.pointerId; trace = [];
  $('pad').setPointerCapture(pointer); $('pad').classList.add('casting'); point(event);
});
$('pad').addEventListener('pointermove', event => { if (event.pointerId === pointer) { event.preventDefault(); point(event); } });
$('pad').addEventListener('pointerup', event => {
  if (event.pointerId !== pointer) return;
  point(event); const [x, y] = trace.at(-1); pointer = null;
  game.inputLocal('device', x, y, false); $('pad').classList.remove('casting');
});
$('pad').addEventListener('pointercancel', cancelStroke);
$('pad').addEventListener('lostpointercapture', cancelStroke);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { game.destroy(); game.sound.setMuted(true); });
new ResizeObserver(() => window.dispatchEvent(new Event('resize'))).observe($('arena'));
