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

// Match the browser relay: cast edges always bypass rate and movement limits.
export function createSampleGate(now = () => performance.now()) {
  let lastAt = -Infinity, lastX = 0.5, lastY = 0.5, lastCast = false;
  return (sample: Point) => {
    if (![sample.x, sample.y].every(Number.isFinite)) return null;
    const time = now(), cast = !!sample.cast;
    const x = Math.min(1, Math.max(0, sample.x)), y = Math.min(1, Math.max(0, sample.y));
    const edge = cast !== lastCast, since = time - lastAt;
    if (!edge && (since < 30 || (Math.hypot(x - lastX, y - lastY) < 0.005 && since < 250))) return null;
    lastAt = time; lastX = x; lastY = y; lastCast = cast;
    return { x, y, vx: 0, vy: 0, c: cast ? 1 : 0, t: Date.now() };
  };
}

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
