// The wand: how a jittery, laggy stream of phone samples becomes a point that
// feels like it is attached to your wrist, and how a held thumb turns that
// point into a spell.
//
// Two things happen between the network and the pixel:
//
//   1. EASE. Points land every ~30ms, frames render every ~16ms, and the gap is
//      never even. Each frame eases toward the latest real point instead of
//      snapping, so the tip glides between packets. It never goes past that
//      point: nothing here guesses where the hand is going next.
//   2. TRAIL. Rendered positions go into a short ring buffer and are drawn as a
//      tapering ribbon - the glowing tail behind the wand tip.
//
// On top of that sits the CAST. Holding the thumb on the phone opens a stroke;
// releasing closes it and hands the path to the recogniser in game/spells.js.
//
// The wand keeps two positions, `pos` (what you see) and `inkPos` (what a cast
// is judged on). With prediction off, as it is now, they are the same point.
// They stay separate so that prediction can never again be switched on for the
// display without also bending the casts: the last time it was on, it overshot
// every corner, and Shatter - which is nothing but corners - fell to 50%.

// How the wand trades lag against wobble. Measured, not guessed: section 6 of
// tools/engine-test.mjs drives noisy orientation readings through the phone, the
// wire and this file, and fails if the tip gets shakier or slower.
export const FEEL = {
  // No prediction. PenDrawOnline's screen draws each point exactly where it
  // lands, and that is the behaviour this now copies.
  //
  // The earlier versions extrapolated up to 70ms ahead along a velocity the phone
  // estimated from its own sensor readings. In simulation that hid the network
  // delay. In a real hand it was the main source of the instability: every
  // wobble in the velocity estimate became a jump of the tip. A tip that is a
  // little behind is far easier to aim than one that guesses and overshoots.
  leadMs: 0,
  maxPredictS: 0,
  maxPredictDist: 0,
  // A short ease between packets, only so the tip glides instead of jumping in
  // 30ms steps. It never goes past the last real point.
  smoothTauMs: 16,
};

const TRAIL_MS = 200;          // how much history the ribbon shows
const TRAIL_MAX = 64;

// While casting, only record a point once the tip has actually moved this far.
// Without it a held-still wand packs thousands of identical points into the
// stroke and drags the resampler's arc-length walk down to nothing.
const CAST_MIN_STEP = 0.004;
const CAST_MAX_POINTS = 600;   // ~12s of continuous drawing; a safety valve

// Two slots, two looks. Slot 0 is the classic white-hot tip.
export const BLADE_COLORS = [
  { core: "#ffffff", glow: "#7fdcff", spark: "#d8f6ff" },
  { core: "#ffffff", glow: "#ff9ad5", spark: "#ffd9ef" },
];

export function createBlade(slot = 0, tuning = {}) {
  const colors = BLADE_COLORS[slot % BLADE_COLORS.length];
  const { leadMs, maxPredictS, maxPredictDist, smoothTauMs } = { ...FEEL, ...tuning };

  // Everything below is in normalized 0..1 space; the renderer scales to pixels.
  let target = { x: 0.5, y: 0.5, vx: 0, vy: 0 };
  let pos = { x: 0.5, y: 0.5 };
  let inkPos = { x: 0.5, y: 0.5 };   // un-predicted; what a cast is judged on
  let prev = { x: 0.5, y: 0.5 };
  let lastSampleAt = 0;
  let seen = false;
  const trail = []; // { x, y, t }

  // casting
  let casting = false;          // what the phone last told us
  let stroke = null;            // the path being drawn right now
  let finished = null;          // a completed stroke waiting to be collected
  let castStartedAt = 0;

  function openStroke() {
    stroke = [{ x: inkPos.x, y: inkPos.y }];
    castStartedAt = performance.now();
  }

  function closeStroke() {
    // Hand over whatever was drawn - even a two-point stub. Deciding that a
    // stroke is too short to be a spell is the recogniser's job, not this
    // file's, and it needs to see the stub to say so.
    finished = stroke && stroke.length ? stroke : [];
    stroke = null;
  }

  function setCasting(on) {
    if (on === casting) return;
    casting = on;
    if (on) openStroke(); else closeStroke();
  }

  return {
    slot,
    colors,
    get position() { return pos; },
    // The segment travelled this frame, in normalized space.
    get segment() { return { x0: prev.x, y0: prev.y, x1: pos.x, y1: pos.y }; },
    get alive() { return seen && performance.now() - lastSampleAt < 2500; },
    get idle() { return performance.now() - lastSampleAt > 900; },

    get casting() { return casting; },
    get castPath() { return stroke; },
    get castHeldMs() { return casting ? performance.now() - castStartedAt : 0; },

    // Collect a finished stroke, exactly once. The engine polls this each frame;
    // returning it clears it, so one hold can never fire two spells.
    takeStroke() {
      const s = finished;
      finished = null;
      return s;
    },

    // A sample straight off the wire.
    feed({ x, y, vx = 0, vy = 0, cast = false }) {
      target = { x, y, vx, vy };
      lastSampleAt = performance.now();
      // A finger can start anywhere on the touch pad. Begin at the actual
      // press position, without drawing a line from the previous wand tip.
      if (!seen || (cast && !casting)) { seen = true; pos = { x, y }; inkPos = { x, y }; prev = { x, y }; }
      setCasting(!!cast);
    },

    // Local input (mouse on the screen, or the touch fallback) skips prediction:
    // there is no lag to hide. vx/vy of zero means the lead below multiplies out
    // to nothing, so the same code path is correct for both.
    feedDirect(x, y, cast = false) {
      target = { x, y, vx: 0, vy: 0 };
      lastSampleAt = performance.now();
      if (!seen || (cast && !casting)) { seen = true; pos = { x, y }; inkPos = { x, y }; prev = { x, y }; }
      setCasting(!!cast);
    },

    reset(x = 0.5, y = 0.5) {
      target = { x, y, vx: 0, vy: 0 };
      pos = { x, y }; inkPos = { x, y }; prev = { x, y };
      trail.length = 0;
      casting = false; stroke = null; finished = null;
    },

    // Advance one frame. dt in seconds.
    step(dt, now = performance.now()) {
      prev = { x: pos.x, y: pos.y };
      if (!seen) return;

      // 1. predict — but keep it on a leash. Extrapolation is only ever a guess,
      // and a guess that can throw the tip across the screen is worse than the
      // lag it was meant to hide.
      // Time since this sample arrived, PLUS the time it spent getting here.
      const age = Math.min((now - lastSampleAt + leadMs) / 1000, maxPredictS);
      let ax = target.vx * age, ay = target.vy * age;
      const reach = Math.hypot(ax, ay);
      if (reach > maxPredictDist) {
        const k = maxPredictDist / reach;
        ax *= k; ay *= k;
      }
      const px = target.x + ax;
      const py = target.y + ay;

      // 2. smooth (frame-rate independent exponential approach)
      const k = 1 - Math.exp(-(dt * 1000) / smoothTauMs);
      pos = {
        x: pos.x + (Math.min(Math.max(px, 0), 1) - pos.x) * k,
        y: pos.y + (Math.min(Math.max(py, 0), 1) - pos.y) * k,
      };
      // The same easing with no prediction in it. This is the path a cast is
      // scored on, so it must never contain a guess.
      inkPos = {
        x: inkPos.x + (target.x - inkPos.x) * k,
        y: inkPos.y + (target.y - inkPos.y) * k,
      };

      // 3. trail
      trail.push({ x: pos.x, y: pos.y, t: now });
      while (trail.length && now - trail[0].t > TRAIL_MS) trail.shift();
      while (trail.length > TRAIL_MAX) trail.shift();

      // 4. record the cast, from the honest path
      if (casting && stroke) {
        const last = stroke[stroke.length - 1];
        if (Math.hypot(inkPos.x - last.x, inkPos.y - last.y) >= CAST_MIN_STEP) {
          stroke.push({ x: inkPos.x, y: inkPos.y });
          // Drop from the FRONT if someone holds forever. A gesture is its
          // recent shape; the first ten seconds of a held thumb are not part
          // of it.
          if (stroke.length > CAST_MAX_POINTS) stroke.shift();
        }
      }
    },

    // Speed of the rendered point, in screen-heights per second.
    speed(dt) {
      if (dt <= 0) return 0;
      return Math.hypot(pos.x - prev.x, pos.y - prev.y) / dt;
    },

    draw(ctx, W, H, now = performance.now()) {
      // The stroke so far, drawn under everything else. Without this the player
      // is drawing blind - they can see where the tip IS but not the shape they
      // have made, which is the one thing they need to judge a cast.
      if (casting && stroke && stroke.length > 1) drawCastPath(ctx, stroke, W, H, colors);

      if (!seen || trail.length < 2) {
        if (seen) drawHead(ctx, pos.x * W, pos.y * H, colors, 1, casting);
        return;
      }
      const pts = trail.map((p) => ({ x: p.x * W, y: p.y * H, age: (now - p.t) / TRAIL_MS }));
      const headW = Math.max(8, H * 0.018);

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // glow pass, then a white core on top - two passes is what reads as "hot"
      for (const pass of [0, 1]) {
        ctx.strokeStyle = pass === 0 ? colors.glow : colors.core;
        ctx.shadowColor = pass === 0 ? colors.glow : "transparent";
        ctx.shadowBlur = pass === 0 ? headW * 2.2 : 0;
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i];
          const b = pts[i - 1];
          const life = 1 - Math.min(a.age, 1);          // 0 at the tail, 1 at the head
          const w = headW * life * (pass === 0 ? 1.5 : 0.55);
          if (w < 0.4) continue;
          ctx.globalAlpha = (pass === 0 ? 0.5 : 0.95) * life;
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(b.x, b.y);
          ctx.lineTo(a.x, a.y);
          ctx.stroke();
        }
      }
      ctx.restore();

      drawHead(ctx, pos.x * W, pos.y * H, colors, headW / 8, casting);
    },
  };
}

// The ink of a cast in progress: the whole held stroke, in a steady gold that
// reads as "this is being written down" rather than the wand's own colour.
function drawCastPath(ctx, stroke, W, H, colors) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#ffd873";
  ctx.shadowColor = "#ffb02e";
  ctx.shadowBlur = Math.max(10, H * 0.02);
  ctx.lineWidth = Math.max(3, H * 0.006);
  ctx.globalAlpha = 0.72;
  ctx.beginPath();
  stroke.forEach((p, i) => (i ? ctx.lineTo(p.x * W, p.y * H) : ctx.moveTo(p.x * W, p.y * H)));
  ctx.stroke();
  ctx.restore();
}

// The bright point at the tip - the thing the player actually aims with. While
// casting it wears a ring, so "am I recording?" is answerable at a glance from
// across a room.
function drawHead(ctx, x, y, colors, scale, casting = false) {
  const r = 5 * Math.max(0.8, scale);
  ctx.save();
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.35, (casting ? "#ffd873" : colors.glow) + "88");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (casting) {
    ctx.strokeStyle = "#ffd873";
    ctx.lineWidth = Math.max(1.5, r * 0.4);
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
