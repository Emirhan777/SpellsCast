// Does a cast survive the whole pipeline?  npm run test:engine
//
// tools/spell-test.mjs feeds the recogniser clean geometry. That is not what it
// gets in a real game. A real stroke has been through the wand first: sampled at
// whatever rate the phone manages, eased toward its target every frame by the
// smoothing in game/blade.js, clamped to the screen, and recorded only when the
// tip has moved far enough to count. Smoothing in particular ROUNDS CORNERS, and
// corners are what these three gestures are made of - so a gesture set that
// scores perfectly against clean templates can still misfire in the hand.
//
// This runs the actual engine against a stub canvas and a virtual clock, draws
// each rune the way a player would, and checks the right spell comes out.
//
// No browser, no network: everything the engine touches is faked below.

// ---------------------------------------------------------------------------
// A fake browser, in about forty lines
// ---------------------------------------------------------------------------
let clock = 0;                                   // virtual milliseconds
const frameCallbacks = [];

const gradient = { addColorStop() {} };
const ctxProxy = new Proxy({}, {
  get(t, k) {
    if (k === "createLinearGradient" || k === "createRadialGradient") return () => gradient;
    if (k === "measureText") return () => ({ width: 10 });
    if (k === "canvas") return canvas;
    if (k in t) return t[k];
    return () => {};                             // every drawing call is a no-op
  },
  set(t, k, v) { t[k] = v; return true; },
});

const canvas = {
  clientWidth: 1280, clientHeight: 720, width: 1280, height: 720,
  getContext: () => ctxProxy,
};

globalThis.window = {
  addEventListener() {}, removeEventListener() {},
  innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
};
globalThis.devicePixelRatio = 1;
globalThis.localStorage = {
  _v: {},
  getItem(k) { return this._v[k] ?? null; },
  setItem(k, v) { this._v[k] = String(v); },
};
globalThis.performance = { now: () => clock };
globalThis.requestAnimationFrame = (cb) => { frameCallbacks.push(cb); return frameCallbacks.length; };
globalThis.cancelAnimationFrame = () => {};

// Advance the virtual clock one frame and run whatever rAF callbacks are queued.
const FRAME_MS = 16;
function tick(frames = 1) {
  for (let i = 0; i < frames; i++) {
    clock += FRAME_MS;
    const due = frameCallbacks.splice(0, frameCallbacks.length);
    for (const cb of due) cb(clock);
  }
}

const { createGame } = await import("../game/engine.js");
const { SPELLS } = await import("../game/spells.js");

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log("  FAIL  " + msg); } return ok; };

// ---------------------------------------------------------------------------
// A player
// ---------------------------------------------------------------------------
const casts = [];
const game = createGame(canvas, {
  onCast: (c) => casts.push(c),
});
game.addPlayer("p1", 0);
tick(2);

// Draw a glyph the way a hand does: hold, move through the shape over `frames`
// frames, release. Positions go in through the same inputLocal() the mouse uses.
function castGlyph(glyph, { cx = 0.5, cy = 0.5, size = 0.4, frames = 40 } = {}) {
  const pts = glyph.map(([x, y]) => ({ x: cx + (x - 0.5) * size, y: cy + (y - 0.5) * size * 0.8 }));
  const segs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    segs.push({ a: pts[i - 1], b: pts[i], d });
    total += d;
  }
  const at = (u) => {
    let want = u * total;
    for (const s of segs) {
      if (want <= s.d || s === segs[segs.length - 1]) {
        const t = s.d > 0 ? Math.min(want / s.d, 1) : 0;
        return { x: s.a.x + t * (s.b.x - s.a.x), y: s.a.y + t * (s.b.y - s.a.y) };
      }
      want -= s.d;
    }
    return pts[pts.length - 1];
  };

  // Park the wand on the start point and let the smoothing settle, so the
  // stroke does not open with a long slide in from wherever the tip last was.
  for (let i = 0; i < 12; i++) { game.inputLocal("p1", pts[0].x, pts[0].y, false); tick(); }
  for (let i = 0; i <= frames; i++) {
    const p = at(i / frames);
    game.inputLocal("p1", p.x, p.y, true);
    tick();
  }
  // Hold the end for a beat, as a hand does, then release.
  for (let i = 0; i < 3; i++) { game.inputLocal("p1", pts[pts.length - 1].x, pts[pts.length - 1].y, true); tick(); }
  game.inputLocal("p1", pts[pts.length - 1].x, pts[pts.length - 1].y, false);
  tick(2);
}

// ---------------------------------------------------------------------------
// 1. every rune, drawn through the real wand, at several speeds and sizes
// ---------------------------------------------------------------------------
console.log("\ncast through the wand (smoothing, clamping and all)");
for (const spell of SPELLS) {
  let ok = 0;
  const trials = [];
  for (const frames of [18, 28, 40, 60])          // a fast flick to a slow draw
    for (const size of [0.3, 0.45, 0.62])         // small and huge
      trials.push({ frames, size });

  for (const t of trials) {
    casts.length = 0;
    castGlyph(spell.glyph, { ...t, cx: 0.5, cy: 0.5 });
    const got = casts.find((c) => c.spell || c.reason === "misfire");
    if (got?.spell === spell.id) ok++;
  }
  const pct = (ok / trials.length) * 100;
  console.log("  " + spell.name.padEnd(20) + pct.toFixed(0) + "%  (" + ok + "/" + trials.length + " speeds x sizes)");
  check(pct === 100, spell.name + " only survived the wand " + pct.toFixed(0) + "% of the time");
}

// ---------------------------------------------------------------------------
// 2. drawn off-centre - the wand does not live in the middle of the screen
// ---------------------------------------------------------------------------
console.log("\ncast away from the centre");
let offCentre = 0, offTotal = 0;
for (const spell of SPELLS) {
  for (const [cx, cy] of [[0.26, 0.3], [0.75, 0.32], [0.3, 0.7], [0.72, 0.68]]) {
    casts.length = 0;
    castGlyph(spell.glyph, { cx, cy, size: 0.34, frames: 30 });
    offTotal++;
    if (casts.find((c) => c.spell === spell.id)) offCentre++;
  }
}
console.log("  " + offCentre + "/" + offTotal + " recognised");
check(offCentre === offTotal, (offTotal - offCentre) + " off-centre casts were lost");

// ---------------------------------------------------------------------------
// 3. a thumb slip is not a spell
// ---------------------------------------------------------------------------
console.log("\nnoise");
casts.length = 0;
for (let i = 0; i < 10; i++) { game.inputLocal("p1", 0.5, 0.5, false); tick(); }
game.inputLocal("p1", 0.5, 0.5, true);
tick(2);
game.inputLocal("p1", 0.507, 0.503, true);
tick(2);
game.inputLocal("p1", 0.507, 0.503, false);
tick(2);
check(casts.length === 0, "a twitch of the thumb reported a cast");
console.log("  thumb twitch          " + (casts.length === 0 ? "ignored" : "CAST " + casts[0]?.spell));

// ---------------------------------------------------------------------------
// 4. a whole run, start to finish, without throwing
// ---------------------------------------------------------------------------
console.log("\na full run");
game.start();
check(game.state === "countdown", "start() did not enter the countdown, got " + game.state);
tick(240);                                        // ~3.8s of virtual time
check(game.state === "playing", "countdown did not reach playing, got " + game.state);

// Ignore everything for a while: three targets should fall past and end it.
let guard = 0;
while (game.state === "playing" && guard++ < 4000) tick();
check(game.state === "over", "a run that was never played did not end (state " + game.state + ")");
check(game.lives === 0, "the run ended with " + game.lives + " lives left");
console.log("  ignored run ended after " + (guard * FRAME_MS / 1000).toFixed(1) + "s with 0 lives");

// And a cast gets you out of the game-over screen.
casts.length = 0;
castGlyph(SPELLS[0].glyph, { size: 0.4, frames: 30 });
check(game.state === "countdown", "casting on the game-over screen did not restart, state " + game.state);
console.log("  cast on game over     restarted");

// ---------------------------------------------------------------------------
// 5. scoring - play properly for a while and make sure points land
// ---------------------------------------------------------------------------
console.log("\nscoring");
tick(240);                                        // through the countdown
const before = game.score;
let scored = 0;
for (let round = 0; round < 40 && game.state === "playing"; round++) {
  const spell = SPELLS[round % SPELLS.length];
  casts.length = 0;
  castGlyph(spell.glyph, { size: 0.34, frames: 26 });
  if (casts.some((c) => c.ok && c.score > 0)) scored++;
}
console.log("  " + scored + " of 40 casts found a matching target and scored");
console.log("  score " + before + " -> " + game.score);
check(scored > 0, "40 correct casts scored nothing at all");
check(game.score > before, "score did not move despite " + scored + " scoring casts");

// Budgets sit just above the measured values (0.18% step, 0.006 crawl, 116ms),
// so a future change that makes the pointer shakier or slower fails here.
// History, so nobody loosens them without knowing what they cost:
//   gain 5.5, 70ms prediction            4.81% step - "jumps from point to point"
//   gain 1.6, filter + 70ms prediction   0.11% step, 40ms - steady in simulation,
//                                         still reported shaky in a real hand
//   PenDraw: gain 1.6, no prediction      0.18% step, 116ms - what ships now
const STILL_STEP_BUDGET = 0.004, STILL_CRAWL_BUDGET = 0.02, FOLLOW_LAG_BUDGET = 140;

// ---------------------------------------------------------------------------
// 6. a real orientation stream, over a laggy wire
//
// Everything above feeds the engine through inputLocal(), which skips the phone
// entirely. This drives the chain the way a phone does: noisy deviceorientation
// angles into game/tilt.js, the actual shared sender (cast edges always sent),
// 80ms of flight time
// with jitter, and the wand on the other end. It measures how still the tip is
// when the hand is, how far behind it sits when the hand moves, and whether the
// runes still read.
// ---------------------------------------------------------------------------
const { createBlade } = await import("../game/blade.js");
const { createTracker, YAW_GAIN, PITCH_GAIN } = await import("../game/tilt.js");
const { recognize } = await import("../game/spells.js");

const NET_MS = 80, JITTER_MS = 25;
const { createWandSender } = await import("../game/wand-stream.js");
const NOISE_DEG = 0.18;          // dither a real fusion output carries, per angle
// Tipped back about 45 degrees: the pose you hold a phone in while looking at the
// cast pad on it. It is PenDraw's pose too.
const BETA0 = 45;

let nseed = 4242;
const nrnd = () => ((nseed = (nseed * 1664525 + 1013904223) >>> 0) / 4294967296);
const ngauss = () => (nrnd() + nrnd() + nrnd() + nrnd() - 2) * 0.7;

// Drive the whole chain from wrist angles. `hand(ms) -> {yaw, pitch}` degrees.
function overTheWire(hand, durMs, castWindow = null) {
  nseed = 4242;
  clock = 0;
  const tracker = createTracker();
  const blade = createBlade(0);
  const inflight = [];
  let senderTime = 0, timer = null, lastArrival = 0;
  const sender = createWandSender(s => {
    lastArrival = Math.max(lastArrival, senderTime + NET_MS + (nrnd() - 0.5) * 2 * JITTER_MS);
    inflight.push({ at: lastArrival, s, c: !!s.c });
  }, { now: () => senderTime,
    schedule: (fn, ms) => { timer = { fn, at: senderTime + ms }; return timer; },
    cancel: () => { timer = null; } });
  let nextSampleAt = 0, stroke = null;
  const rendered = [];

  for (let t = 0; t <= durMs; t += FRAME_MS) {
    clock = t;
    while (nextSampleAt <= t) {
      const h = hand(nextSampleAt);
      const s = tracker.push(h.yaw + ngauss() * NOISE_DEG, BETA0 + h.pitch + ngauss() * NOISE_DEG);
      if (s) {
        if (timer && timer.at <= nextSampleAt) {
          senderTime = timer.at; const fn = timer.fn; timer = null; fn();
        }
        senderTime = nextSampleAt;
        const cast = !!(castWindow && nextSampleAt >= castWindow[0] && nextSampleAt <= castWindow[1]);
        sender.send({ ...s, cast });
      }
      nextSampleAt += 1000 / 60;
    }
    // In arrival order: a "thumb up" packet must never overtake a "thumb down".
    inflight.sort((a, b) => a.at - b.at);
    while (inflight.length && inflight[0].at <= t) {
      const d = inflight.shift();
      blade.feed({ ...d.s, cast: d.c });
    }
    blade.step(FRAME_MS / 1000, t);
    rendered.push({ t, x: blade.position.x, y: blade.position.y });
    const st = blade.takeStroke();
    if (st && st.length > 4) stroke = st;
  }
  sender.destroy();
  return { rendered, stroke };
}

// --- 6a. holding still. This is the "it jumps from point to point" number.
console.log("\nholding the phone still (noisy sensor)");
{
  const { rendered } = overTheWire(() => ({ yaw: 0, pitch: 0 }), 2600);
  const settled = rendered.filter((r) => r.t > 700);
  let travel = 0, worstStep = 0;
  for (let i = 1; i < settled.length; i++) {
    const d = Math.hypot(settled[i].x - settled[i - 1].x, settled[i].y - settled[i - 1].y);
    travel += d;
    worstStep = Math.max(worstStep, d);
  }
  const crawl = travel / ((settled[settled.length - 1].t - settled[0].t) / 1000);
  console.log("  crawl              " + crawl.toFixed(4) + " screens/sec");
  console.log("  worst frame step   " + (worstStep * 100).toFixed(3) + "% of the screen");
  check(worstStep <= STILL_STEP_BUDGET,
    "worst frame step is " + (worstStep * 100).toFixed(3) + "% (budget " + (STILL_STEP_BUDGET * 100) + "%)");
  check(crawl <= STILL_CRAWL_BUDGET,
    "the tip crawls " + crawl.toFixed(4) + " screens/sec while still (budget " + STILL_CRAWL_BUDGET + ")");
}

// --- 6b. following a real wrist movement
console.log("\nfollowing the hand");
{
  const dur = 700;
  // a 30-degree turn of the forearm, eased like a real arm
  const hand = (ms) => ({ yaw: (1 - Math.pow(1 - Math.min(ms / dur, 1), 3)) * 30, pitch: 0 });
  const { rendered } = overTheWire(hand, dur + 500);

  // Where a noise-free tracker would put each pose - the honest target.
  const clean = createTracker();
  clean.push(0, BETA0);
  const truth = [];
  for (let t = 0; t <= dur; t += FRAME_MS) {
    const h = hand(t);
    truth.push({ t, ...clean.push(h.yaw, BETA0 + h.pitch) });
  }
  const truthAt = (ms) => truth.reduce((a, b) => (Math.abs(b.t - ms) < Math.abs(a.t - ms) ? b : a));

  let bestLag = 0, bestCost = Infinity;
  for (let lag = 0; lag <= 300; lag += 2) {
    let c = 0, n = 0;
    for (const r of rendered) {
      const tt = r.t - lag;
      if (tt < 0 || tt > dur) continue;
      const p = truthAt(tt);
      c += Math.hypot(r.x - p.x, r.y - p.y); n++;
    }
    if (n > 10 && c / n < bestCost) { bestCost = c / n; bestLag = lag; }
  }
  console.log("  behind the hand    " + bestLag + "ms  (" + NET_MS + "ms of that is the wire)");
  check(bestLag <= FOLLOW_LAG_BUDGET, "the tip is " + bestLag + "ms behind the hand (budget " + FOLLOW_LAG_BUDGET + "ms)");
}

// --- 6c. the runes, over the same noisy wire
console.log("\ncasting over the same wire");
{
  for (const spell of SPELLS) {
    let ok = 0;
    const speeds = [600, 900, 1300];
    for (const drawMs of speeds) {
      const pts = spell.glyph.map(([x, y]) => ({ x: 0.5 + (x - 0.5) * 0.4, y: 0.5 + (y - 0.5) * 0.4 }));
      const segs = []; let len = 0;
      for (let i = 1; i < pts.length; i++) {
        const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        segs.push({ a: pts[i - 1], b: pts[i], d }); len += d;
      }
      const at = (u) => {
        let want = u * len;
        for (const sg of segs) {
          if (want <= sg.d || sg === segs[segs.length - 1]) {
            const k = sg.d > 0 ? Math.min(want / sg.d, 1) : 0;
            return { x: sg.a.x + k * (sg.b.x - sg.a.x), y: sg.a.y + k * (sg.b.y - sg.a.y) };
          }
          want -= sg.d;
        }
        return pts[pts.length - 1];
      };
      // The mapping is linear, so the wrist angles that draw a shape are just
      // the screen offsets divided back out by the gains.
      const start = 420;
      const hand = (ms) => {
        const p = at(Math.min(Math.max((ms - start) / drawMs, 0), 1));
        return {
          yaw: (-(p.x - 0.5) * 180) / YAW_GAIN,
          pitch: (-(p.y - 0.5) * 180) / PITCH_GAIN,
        };
      };
      const { stroke } = overTheWire(hand, start + drawMs + 500, [start, start + drawMs + 60]);
      if (stroke && recognize(stroke).spell?.id === spell.id) ok++;
    }
    console.log("  " + spell.name.padEnd(20) + ok + "/" + speeds.length);
    check(ok === speeds.length, spell.name + " survived only " + ok + "/" + speeds.length + " casts over the wire");
  }
}


console.log(failures === 0 ? "\nengine OK\n" : "\n" + failures + " failure(s)\n");
process.exit(failures ? 1 : 0);
