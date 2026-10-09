export const DUEL_DURATIONS = [60, 90, 120, 180];
export const DEFAULT_DUEL_SECONDS = 90;

// Shared transaction callback for browser and native players.
export function claimPlayerSlot(players, pid) {
  const current = players || {};
  if (current[pid]) return current;
  const taken = new Set(Object.values(current).map(p => p?.slot));
  const slot = [0, 1].find(s => !taken.has(s));
  if (slot === undefined || Object.keys(current).length >= 2) return undefined;
  return { ...current, [pid]: { slot, joinedAt: { '.sv': 'timestamp' } } };
}

export function duelResult(players) {
  if (players[0].score === players[1].score) return { winnerSlot: -1, result: 'Draw!' };
  const winner = players[0].score > players[1].score ? players[0] : players[1];
  return { winnerSlot: winner.slot, result: `Wizard ${winner.slot + 1} wins!` };
}

export function controllerHud(hud, pid, slot) {
  if (hud.mode !== 'duel') return hud;
  const players = Object.values(hud.wizards || {});
  const own = players.find(p => p.pid === pid);
  const opponent = players.find(p => p.pid !== pid);
  return { ...hud, score: own?.score ?? 0, opponentScore: opponent?.score ?? 0,
    wizardNumber: slot + 1,
    spell: hud.castPid === pid ? hud.spell : '',
    castOk: hud.castPid === pid ? hud.castOk : null };
}
