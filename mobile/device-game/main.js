import { createGame, SPELLS } from '../../game/engine.js';
const $ = id => document.getElementById(id);
const validScore = n => Number.isSafeInteger(n) && n >= 0 ? n : 0;
let stored = {};
try { stored = JSON.parse(localStorage.getItem('spellscast.device.bests.v1') || '{}'); } catch {}
const initial = window.__deviceBests || stored;
const bests = { tilt: validScore(initial.tilt), finger: validScore(initial.finger) };
let mode = 'tilt', game, paused = false, pointer = null, sample = { x: .5, y: .5 }, feedbackTimer, pendingMode = null, wasPaused = false, request = 0;
let casting = false, motionEnabled = false, motionPending = false, motionSampleReady = false;
const native = message => {
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message));
  else window.parent.postMessage({ spellscast: true, ...message }, '*');
};
function showBests() { $('tiltBest').textContent = `Tilt best: ${bests.tilt}`; $('fingerBest').textContent = `Finger best: ${bests.finger}`; }
function saveBest(score) {
  if (score <= bests[mode]) return;
  bests[mode] = score; showBests();
  try { localStorage.setItem('spellscast.device.bests.v1', JSON.stringify(bests)); } catch {}
  native({ type: 'best', mode, score });
}
function help() { return mode === 'tilt' ? 'Hold anywhere. Tilt to draw. Release to cast.' : 'Draw directly on the game. Lift to cast.'; }
function createRound() {
  game?.destroy();
  paused = false; pointer = null; casting = false; motionPending = false; motionSampleReady = false;
  document.body.classList.remove('casting');
  $('paused').hidden = true; $('confirm').hidden = true; $('intro').hidden = false;
  $('intro').querySelector('h1').textContent = mode === 'tilt' ? 'Hold anywhere. Cast to begin.' : 'Draw a spell to begin.';
  $('instructions').textContent = mode === 'tilt' ? 'Hold anywhere on the screen. Tilt your phone to draw one of the runes below, then release. Your first spell starts the game.' : 'Draw one of the runes below directly on the game screen. Lift your finger to cast. Your first spell starts the game.';
  $('notice').textContent = ''; $('feedback').textContent = help();
  $('center').hidden = mode !== 'tilt';
  $('mode').value = mode;
  game = createGame($('game'), {
    bestKey: `spellscast.device.best.${mode}`, initialBest: bests[mode],
    onHud(hud) {
      $('score').textContent = hud.score; saveBest(hud.score);
      $('lives').textContent = [0, 1, 2].map(i => i < hud.lives ? '●' : '○').join(' ');
      $('lives').setAttribute('aria-label', `${hud.lives} lives remaining`);
    },
    onState(state) {
      $('pause').disabled = !['playing', 'countdown'].includes(state);
      if (state === 'countdown' || state === 'playing') $('intro').hidden = true;
      if (state === 'over') { cancelStroke(); $('intro').hidden = false; $('intro').querySelector('h1').textContent = 'Wand down · Cast to play again'; }
    },
    onCast(cast) {
      clearTimeout(feedbackTimer);
      const starting = ['lobby', 'over'].includes(game.state) && !!cast.spell;
      $('feedback').textContent = starting ? `${cast.name} ✓ · Game starting` : cast.spell ? `${cast.name}${cast.ok ? ' ✓' : ' · no target'}` : 'Try again — follow the rune.';
      if (starting) {
        // Any recognized spell starts local play, even without a matching demo target.
        // Wait until this cast has finished resolving in the engine.
        const round = game;
        queueMicrotask(() => { if (game === round && !paused && ['lobby', 'over'].includes(game.state)) game.start(); });
      }
      feedbackTimer = setTimeout(() => { $('feedback').textContent = help(); }, 2200);
    },
  });
  game.sound.setMusicTrack('none'); game.sound.setMuted($('sound').textContent === 'Sound off');
  game.addPlayer('device', 0); showBests(); native({ type: 'mode', mode });
}
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
    if (document.documentElement.hasPointerCapture(id)) document.documentElement.releasePointerCapture(id);
  }
  if (casting) {
    casting = false;
    game.removePlayer('device'); game.addPlayer('device', 0);
  }
  document.body.classList.remove('casting');
}
function pause() {
  // An iOS permission prompt can briefly deactivate the app. Keep its reply
  // valid, but discard the held touch so permission approval never casts.
  if (!motionPending) request++;
  cancelStroke();
  if (!['playing', 'countdown'].includes(game.state)) return;
  paused = true; game.setPaused(true); $('paused').hidden = false;
  void game.sound.ctx?.suspend();
}
function resume() {
  paused = false; game.setPaused(false); $('paused').hidden = true;
  if (!game.isMuted()) game.sound.init();
  if (mode === 'tilt') { motionSampleReady = false; native({ type: 'center' }); }
}
function motionReady(allowed, token) {
  if (token !== request || mode !== 'tilt') return;
  motionPending = false; motionEnabled = allowed; motionSampleReady = false;
  if (!allowed) { $('notice').textContent = 'Motion is unavailable. Allow motion in Settings, retry, or choose Finger mode. Each mode has a separate best score.'; return; }
  $('notice').textContent = 'Motion ready. Hold the screen, tilt through a rune, then release.';
}
function motionUnavailable() {
  if (mode !== 'tilt') return;
  motionEnabled = false; motionPending = false; motionSampleReady = false;
  pause(); $('paused').querySelector('p').textContent = 'Motion is unavailable. Enable motion access, or choose Finger mode above.';
  $('notice').textContent = 'Motion is unavailable. Hold to retry, or choose Finger mode.';
}
window.deviceGame = {
  pause, motionReady, motionUnavailable,
  move(point) {
    if (mode !== 'tilt' || paused || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    sample = { x: Math.max(0, Math.min(1, point.x)), y: Math.max(0, Math.min(1, point.y)) };
    motionSampleReady = true;
    if (pointer !== null && motionEnabled && !casting) beginTiltStroke();
    game.inputLocal('device', sample.x, sample.y, casting);
  },
};
window.addEventListener('message', event => {
  if (event.source !== window.parent) return;
  if (event.data === 'pause-device-game') pause();
  const command = event.data?.deviceGameCommand;
  if (['pause', 'motionReady', 'motionUnavailable', 'move'].includes(command) && Array.isArray(event.data.args)) window.deviceGame[command](...event.data.args);
});
$('pause').onclick = pause; $('resume').onclick = resume;
$('mode').onchange = () => {
  const next = $('mode').value; $('mode').value = mode;
  if (next === mode) return;
  if (['playing', 'countdown'].includes(game.state)) {
    wasPaused = paused; pause(); pendingMode = next; $('confirm').hidden = false;
  } else { request++; cancelStroke(); mode = next; createRound(); }
};
$('switch').onclick = () => { if (!pendingMode) return; mode = pendingMode; pendingMode = null; createRound(); };
$('cancel').onclick = () => { pendingMode = null; $('confirm').hidden = true; if (!wasPaused) resume(); };
$('sound').onclick = () => { game.sound.init(); const muted = game.toggleMute(); $('sound').textContent = muted ? 'Sound off' : 'Sound on'; };
$('center').onclick = () => { cancelStroke(); motionSampleReady = false; native({ type: 'center' }); };
$('mirror').onclick = () => { pause(); native({ type: 'mirror' }); };
$('back').onclick = () => { pause(); native({ type: 'back' }); };
function fingerPoint(event, cast) {
  const box = $('game').getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
  const y = Math.max(0, Math.min(1, (event.clientY - box.top) / box.height));
  game.inputLocal('device', x, y, cast);
}
function beginTiltStroke() {
  casting = true; document.body.classList.add('casting');
  game.inputLocal('device', sample.x, sample.y, true);
}
document.addEventListener('pointerdown', event => {
  if (event.target.closest('button,select,option') || pointer !== null || paused || !['lobby', 'playing', 'over'].includes(game.state) || !$('confirm').hidden || innerHeight > innerWidth) return;
  event.preventDefault(); pointer = event.pointerId; document.documentElement.setPointerCapture(pointer);
  if (mode === 'finger') { casting = true; document.body.classList.add('casting'); fingerPoint(event, true); }
  else if (!motionEnabled) {
    if (!motionPending) { motionPending = true; $('notice').textContent = 'Enabling motion…'; native({ type: 'motion', token: ++request }); }
  } else if (motionSampleReady) beginTiltStroke();
});
document.addEventListener('pointermove', event => { if (mode === 'finger' && casting && event.pointerId === pointer) { event.preventDefault(); fingerPoint(event, true); } });
document.addEventListener('pointerup', event => {
  if (event.pointerId !== pointer) return;
  pointer = null;
  const releaseCast = casting; casting = false;
  if (releaseCast) {
    if (mode === 'finger') fingerPoint(event, false);
    else game.inputLocal('device', sample.x, sample.y, false);
  }
  document.body.classList.remove('casting');
});
document.addEventListener('pointercancel', cancelStroke);
document.addEventListener('lostpointercapture', cancelStroke);
// A phone rotating out of landscape must pause rather than lose lives behind the prompt.
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('resize', () => { if (innerHeight > innerWidth) pause(); });
window.addEventListener('pagehide', () => { game.destroy(); game.sound.setMuted(true); });
createRound();
