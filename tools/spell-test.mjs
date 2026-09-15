// Does the recogniser actually tell the spells apart?  npm run test:spell
//
// No network and no browser: the recogniser is pure geometry, so it can be
// exercised far harder here than by hand with a phone. Every spell is fired
// hundreds of times through a synthetic "sloppy caster" - rotated, squashed,
// jittered, sampled unevenly, started late and finished early - and has to come
// back as itself. Then the same gun is loaded with scribbles that are not
// spells at all, which must NOT be recognised as anything.
//
// The printed margin table is the calibration for ACCEPT_DIST in game/spells.js:
// it wants to sit above the worst sloppy cast and below the best scribble.

import { SPELLS, recognize, recognizeAll, ACCEPT_DIST, MIN_STROKE_LEN, pathLength } from "../game/spells.js";

// Deterministic noise - a test that fails only on Tuesdays is not a test.
let seed = 0x5eed;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const rand = (a, b) => a + rnd() * (b - a);
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 0.7;

let failures = 0;
const check = (ok, msg) => {
  if (!ok) { failures++; console.log("  FAIL  " + msg); }
  return ok;
};

// ---------------------------------------------------------------------------
// A synthetic caster. Takes a glyph and produces the mess a real wand makes.
// ---------------------------------------------------------------------------
function castStroke(glyph, o = {}) {
  const {
    scale = 1, rot = 0, jitter = 0, samples = 40,
    trimStart = 0, trimEnd = 0, speedWarp = 0, aspect = 1,
  } = o;

  // 1. walk the glyph at even arc length, then warp WHERE the samples land so
  //    the stroke has a slow bit and a whipped bit, like a real swing.
  const pts = glyph.map(([x, y]) => ({ x, y }));
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

  const out = [];
  const cos = Math.cos(rot), sin = Math.sin(rot);
  for (let i = 0; i < samples; i++) {
    let u = i / (samples - 1);
    if (speedWarp) u = u + speedWarp * Math.sin(u * Math.PI) * 0.5;   // ease/whip
    u = Math.min(Math.max(trimStart + u * (1 - trimStart - trimEnd), 0), 1);
    const p = at(u);
    // 2. centre, aspect-squash, rotate, scale, jitter, then park it somewhere
    //    other than the middle of the screen.
    let x = (p.x - 0.5) * scale * aspect, y = (p.y - 0.5) * scale;
    out.push({
      x: 0.5 + (x * cos - y * sin) + gauss() * jitter,
      y: 0.5 + (x * sin + y * cos) + gauss() * jitter,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. clean casts
// ---------------------------------------------------------------------------
console.log("\nclean casts");
for (const s of SPELLS) {
  const r = recognize(castStroke(s.glyph, { scale: 0.6 }));
  check(r.spell?.id === s.id, s.name + " -> " + (r.spell?.name || r.reason));
  console.log("  " + s.name.padEnd(20) + "dist " + r.dist.toFixed(3) + "   quality " + (r.quality * 100).toFixed(0) + "%");
}

// ---------------------------------------------------------------------------
// 2. sloppy casts - the real test
// ---------------------------------------------------------------------------
console.log("\nsloppy casts (300 each)");
const worst = new Map();
for (const s of SPELLS) {
  let hits = 0, worstDist = 0, worstWhy = "";
  const tries = 300;
  for (let i = 0; i < tries; i++) {
    const o = {
      scale: rand(0.28, 0.95),
      rot: rand(-0.32, 0.32),          // ~ +/-18 degrees of tilted wrist
      jitter: rand(0, 0.022),
      samples: Math.round(rand(10, 70)),
      trimStart: rand(0, 0.07),
      trimEnd: rand(0, 0.07),
      speedWarp: rand(-0.5, 0.5),
      aspect: rand(0.72, 1.38),        // wider or taller than the rune
    };
    const r = recognize(castStroke(s.glyph, o));
    if (r.spell?.id === s.id) hits++;
    else worstWhy = worstWhy || (r.spell?.id || r.reason);
    if (r.spell?.id === s.id && r.dist > worstDist) worstDist = r.dist;
  }
  worst.set(s.id, worstDist);
  const pct = (hits / tries) * 100;
  console.log("  " + s.name.padEnd(20) + pct.toFixed(1) + "%  worst accepted dist " + worstDist.toFixed(3) +
    (hits < tries ? "   (missed as: " + worstWhy + ")" : ""));
  check(pct >= 97, s.name + " only recognised " + pct.toFixed(1) + "% of sloppy casts");
}

// ---------------------------------------------------------------------------
// 3. cross-talk - every spell against every other template
// ---------------------------------------------------------------------------
// The diagonal must be ~0 and everything off it comfortably past ACCEPT_DIST.
// The smallest off-diagonal number is the pair most likely to trade casts.
console.log("\ncross-talk (a clean cast of A, matched against B)");
const pad = (t) => String(t).padEnd(15);
console.log("  " + pad("") + SPELLS.map((s) => pad(s.id)).join(""));
let tightest = Infinity, tightestPair = "";
for (const a of SPELLS) {
  const ranked = recognizeAll(castStroke(a.glyph, { scale: 0.6 }));
  const row = SPELLS.map((b) => {
    const d = ranked.find((r) => r.spell === b).dist;
    if (a !== b && d < tightest) { tightest = d; tightestPair = a.id + " / " + b.id; }
    return pad(d.toFixed(3));
  });
  console.log("  " + pad(a.id) + row.join(""));
}
console.log("  closest pair: " + tightestPair + " at " + tightest.toFixed(3));
check(tightest > ACCEPT_DIST * 1.5, "spells " + tightestPair + " are only " + tightest.toFixed(3) + " apart");

// ---------------------------------------------------------------------------
// 4. things that are NOT spells
// ---------------------------------------------------------------------------
console.log("\nnon-spells (must not cast anything)");
const spiral = [];
for (let i = 0; i <= 60; i++) {
  const a = (i / 60) * Math.PI * 4, r = 0.03 + (i / 60) * 0.18;
  spiral.push({ x: 0.5 + Math.cos(a) * r, y: 0.5 + Math.sin(a) * r });
}
const twitch = [{ x: 0.5, y: 0.5 }, { x: 0.52, y: 0.51 }, { x: 0.51, y: 0.53 }, { x: 0.5, y: 0.52 }];
const blob = [];
for (let i = 0; i < 30; i++) blob.push({ x: 0.5 + gauss() * 0.02, y: 0.5 + gauss() * 0.02 });

// A three-quarter arc: the same curve as the ring but left hanging open. This is
// the one that proves the `closed` gate is doing something - without it the arc
// is a perfectly good partial circle and casts a Warding.
const arc = [];
for (let i = 0; i <= 30; i++) {
  const a = (i / 30) * Math.PI * 1.5;
  arc.push({ x: 0.5 + Math.cos(a) * 0.2, y: 0.5 + Math.sin(a) * 0.2 });
}

for (const [name, stroke] of [["spiral", spiral], ["twitch", twitch], ["jitter blob", blob], ["open arc", arc]]) {
  const r = recognize(stroke);
  console.log("  " + name.padEnd(20) + (r.spell ? "CAST " + r.spell.id : r.reason) + "  dist " + r.dist.toFixed(3));
  check(!r.spell, name + " was recognised as " + r.spell?.id);
}

// ...and the closed ring, which IS one, however it is drawn. A circle has no
// starting corner, so where the player begins it and which way they go round
// must not matter - the only rune here for which that is true.
console.log("\nthe ring, started anywhere");
let rings = 0, ringTries = 0;
for (const dir of [1, -1]) {
  for (let start = 0; start < 8; start++) {
    const s = [];
    for (let i = 0; i <= 32; i++) {
      const a = ((start / 8) + (i / 32) * dir) * Math.PI * 2;
      s.push({ x: 0.5 + Math.sin(a) * 0.22, y: 0.5 - Math.cos(a) * 0.22 });
    }
    ringTries++;
    if (recognize(s).spell?.id === "banish") rings++;
  }
}
console.log("  " + rings + "/" + ringTries + " start points x directions cast a Warding");
check(rings === ringTries, (ringTries - rings) + " ways of drawing the ring were not recognised");

// A wandering scribble should rarely land on a spell. "Rarely" rather than
// "never" is honest: a random walk that accumulates velocity genuinely does
// draw a smooth V or a zigzag every so often, and there is no threshold that
// rejects those without also rejecting a real cast. Sweeping every candidate
// glyph set put the floor at about 8%, so that is what this guards.
let falseCasts = 0;
const SCRIBBLES = 400;
for (let i = 0; i < SCRIBBLES; i++) {
  const s = [{ x: 0.5, y: 0.5 }];
  let vx = gauss() * 0.05, vy = gauss() * 0.05;
  for (let j = 0; j < 30; j++) {
    vx += gauss() * 0.04; vy += gauss() * 0.04;
    const p = s[s.length - 1];
    s.push({ x: Math.min(Math.max(p.x + vx, 0), 1), y: Math.min(Math.max(p.y + vy, 0), 1) });
  }
  if (pathLength(s) >= MIN_STROKE_LEN && recognize(s).spell) falseCasts++;
}
const falseRate = (falseCasts / SCRIBBLES) * 100;
console.log("  random scribbles     " + falseRate.toFixed(1) + "% cast something (" + falseCasts + "/" + SCRIBBLES + ")");
check(falseRate <= 12, "random scribbles cast a spell " + falseRate.toFixed(1) + "% of the time");

// ---------------------------------------------------------------------------
// 5. the threshold itself
// ---------------------------------------------------------------------------
// ACCEPT_DIST has to sit in the gap between the sloppiest cast worth honouring
// and the nearest a DIFFERENT spell ever comes. Watch the margin, not the
// headroom: "worst accepted" is by definition just under the threshold, so it
// always looks tight and means nothing. If the MARGIN closes, the gesture set
// itself is wrong and no threshold will rescue it - and this is where you find
// that out, rather than by feel with a phone in your hand.
console.log("\ncalibration");
const worstAccepted = Math.max(...worst.values());
console.log("  worst accepted cast  " + worstAccepted.toFixed(3));
console.log("  ACCEPT_DIST          " + ACCEPT_DIST.toFixed(3));
console.log("  nearest rival spell  " + tightest.toFixed(3) + "   (margin " + (tightest - ACCEPT_DIST).toFixed(3) + ")");
check(tightest - ACCEPT_DIST > 0.1,
  "only " + (tightest - ACCEPT_DIST).toFixed(3) + " between the threshold and a rival spell");

console.log(failures === 0 ? "\nspell recogniser OK\n" : "\n" + failures + " failure(s)\n");
process.exit(failures ? 1 : 0);
