// Shared by the native app and browser controller. Keep only the newest pending
// position, and flush it even if the sensor stops before the next update.
export const WAND_INTERVAL_MS = 16;
const KEEPALIVE_MS = 250;
// Ignore tiny sensor movements without the previous 0.5%-of-screen dead zone.
const MIN_MOVE = 0.003;

/**
 * @param {(sample: {x:number,y:number,vx:number,vy:number,c:number,t:number}) => void} write
 * @param {{now?:()=>number, schedule?:(fn:()=>void,ms:number)=>any, cancel?:(id:any)=>void}} options
 */
export function createWandSender(write, {
  now = () => performance.now(),
  schedule = (fn, ms) => setTimeout(fn, ms),
  cancel = id => clearTimeout(id),
} = {}) {
  let last = null, pending = null, timer = null, lastAt = -Infinity, disposed = false;
  function clearPending() {
    if (timer !== null) cancel(timer);
    timer = null; pending = null;
  }
  function flush() {
    timer = null;
    if (disposed || !pending) return;
    const sample = pending;
    pending = null; last = sample; lastAt = now();
    write({ ...sample, t: Date.now() });
  }
  return {
    /** @param {{x:number,y:number,vx?:number,vy?:number,cast?:boolean}} point */
    send(point) {
      if (disposed || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
      const sample = {
        x: Math.max(0, Math.min(1, point.x)), y: Math.max(0, Math.min(1, point.y)),
        vx: Number.isFinite(point.vx) ? point.vx : 0,
        vy: Number.isFinite(point.vy) ? point.vy : 0, c: point.cast ? 1 : 0,
      };
      const edge = !last || sample.c !== last.c;
      const elapsed = now() - lastAt;
      if (!edge && Math.hypot(sample.x - last.x, sample.y - last.y) < MIN_MOVE && elapsed < KEEPALIVE_MS) {
        // A quick out-and-back should not later flush the obsolete outward point.
        clearPending();
        return false;
      }
      pending = sample;
      if (edge || elapsed >= WAND_INTERVAL_MS) {
        if (timer !== null) cancel(timer);
        flush();
        return true;
      }
      if (timer === null) timer = schedule(flush, WAND_INTERVAL_MS - elapsed);
      return false;
    },
    destroy() { disposed = true; clearPending(); },
  };
}
