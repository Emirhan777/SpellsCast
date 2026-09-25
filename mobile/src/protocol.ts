export const GAME_URL = 'https://emirhan777.github.io/SpellsCast/';
export const GAME_ID = 'spellscast';
export const MAX_PLAYERS = 2;

export function parseRoom(input: string): string {
  const value = input.trim();
  if (/^\d{6}$/.test(value)) return value;
  try {
    const url = new URL(value);
    const official = url.protocol === 'https:' && url.hostname === 'emirhan777.github.io'
      && url.pathname === '/SpellsCast/play.html';
    const native = url.protocol === 'spellscast:' && url.hostname === 'join' && ['','/'].includes(url.pathname);
    const local = ['http:', 'https:'].includes(url.protocol)
      && ['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname.endsWith('/play.html');
    if ((!official && !native && !local) || url.username || url.password || url.searchParams.getAll('room').length !== 1) throw new Error();
    const room = url.searchParams.get('room') || '';
    if (/^\d{6}$/.test(room)) return room;
  } catch {}
  throw new Error('Scan the QR on the SpellsCast big screen, or enter its six-digit room code.');
}

export type Point = { x: number; y: number; vx?: number; vy?: number; cast?: boolean };
export type Hud = { score?: number; best?: number; lives?: number; combo?: number; spell?: string; castOk?: boolean; status?: string };

// Pure transaction callback; the native controllers cannot claim the same slot.
export function claimPlayer(players: Record<string, { slot: number }> | null, pid: string) {
  const current = players || {};
  if (current[pid]) return current;
  const taken = new Set(Object.values(current).map(p => p?.slot));
  let slot = 0;
  while (taken.has(slot) && slot < MAX_PLAYERS) slot++;
  if (slot >= MAX_PLAYERS) return undefined;
  return { ...current, [pid]: { slot, joinedAt: { '.sv': 'timestamp' } } };
}
