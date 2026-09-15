// The spellbook, and the recogniser that decides which spell you just cast.
//
// A cast is a STROKE: the path the wand tip drew between pressing and releasing
// the cast button. Delimiting it that way is the whole trick - a wand that is
// always being waved has no idea where one gesture ends and the next begins, so
// the thumb on the phone is what turns a continuous stream into a sentence.
//
// Matching is the $1 Unistroke Recogniser (Wobbrock et al.), with one change:
// rotation invariance is BOUNDED to +/-ROT_LIMIT instead of being total. $1
// normally rotates a stroke until it best fits a template, which makes an
// upward flick and a downward flick the same gesture - fatal here, where the
// flick direction is most of what separates a Levitation Charm from a lazy
// swipe. A small allowance still absorbs a tilted head or a sloppy wrist.
//
// Scale normalisation is uniform (divide by the longer side of the bounding
// box), not $1's stretch-to-a-square, which would flatten a tall narrow zigzag
// onto a wide flat one and lose the difference between them.
//
// One rule governs the open shapes: NO SPELL IS A STRAIGHT LINE. The first draft
// made Expel a straight thrust, and tools/spell-test.mjs put a number on
// why that was a bad idea - a line is the lowest-entropy stroke there is, so 64%
// of random scribbles landed on it. Every open glyph below has at least one hard
// corner, and the false-cast rate fell to a few percent.
//
// The one closed shape, the Warding ring, pays for its freedom differently -
// see the `closed` flag.

const N = 64;                       // points every stroke is resampled to
const ROT_LIMIT = 18 * Math.PI / 180;
const ROT_STEPS = 14;               // golden-section refinements over the angle
const PHI = 0.5 * (-1 + Math.sqrt(5));

// A stroke shorter than this (in screen heights, summed along the path) is a
// twitch, not a gesture. Rejected before it ever reaches the templates.
export const MIN_STROKE_LEN = 0.22;

// Mean per-point distance below which a match is accepted, in normalised units
// where the stroke's longer side is exactly 1. Calibrated by tools/spell-test.mjs
// against deliberately sloppy strokes - see the numbers it prints.
export const ACCEPT_DIST = 0.24;

// A stroke claiming to be a closed rune must actually come back to where it
// started: the gap between its endpoints, measured after normalisation, has to
// be under this. See the `closed` flag on Banish for why.
const MAX_CLOSE_GAP = 0.38;

// ---------------------------------------------------------------------------
// The spells
//
// `glyph` is both the template and the rune drawn on screen, so the shape you
// are taught is exactly the shape being matched - the two cannot drift apart.
// Coordinates are 0..1 with y pointing DOWN, like the canvas.
// ---------------------------------------------------------------------------
export const SPELLS = [
  {
    id: "expel",
    name: "Expel",
    subtitle: "the Disarming Charm",
    move: "Drive down and snap back up",
    color: "#ff5a4d",
    glow: "#ffb199",
    score: 10,
    // A narrow, deep V. A wide one is close to the shape an aimless swing
    // already makes, and measurably stole casts from the other two.
    glyph: [[0.22, 0], [0.5, 1], [0.78, 0]],
    extra: [],
  },
  {
    id: "levitate",
    name: "Levitate",
    subtitle: "the Levitation Charm",
    move: "Swish across, then flick straight up",
    color: "#7fdcff",
    glow: "#dff5ff",
    score: 15,
    // The flick is deliberately near-vertical rather than a diagonal. Diagonal,
    // it shared its whole second half with the upstroke of Expel and the
    // two spells traded casts; vertical, they separate cleanly.
    glyph: [[0, 0.92], [0.78, 0.92], [0.8, 0]],
    extra: [],
  },
  {
    id: "banish",
    name: "Banish",
    subtitle: "the Warding Charm",
    move: "Sweep a full circle",
    color: "#cfe4ff",
    glow: "#ffffff",
    score: 20,
    // A closed ring, and the only glyph here that does not care where you begin
    // - see loopVariants() below.
    glyph: ring(),
    extra: [],       // filled in after loopVariants is defined
    // Registering the ring at sixteen start points makes it start-agnostic, but
    // it also makes it GREEDY: sixteen chances to be the nearest template pulled
    // a clean Expel V to within 0.235 of it, and the false-cast rate on
    // random scribbles from 7% to 11.5%. This flag buys that back for nothing.
    // A ring returns to where it began and a V does not, so the endpoint gap
    // separates them structurally, before any distance is compared.
    closed: true,
  },
  {
    id: "shatter",
    name: "Shatter",
    subtitle: "the Shattering Spell",
    move: "Tear a lightning zigzag",
    color: "#3ddc84",
    glow: "#b6ffd4",
    score: 25,
    glyph: [[0, 0], [1, 0.14], [0, 0.86], [1, 1]],
    extra: [],
  },
];

// A ring, starting at the top and going clockwise.
function ring(n = 28) {
  const p = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    p.push([0.5 + Math.sin(a) * 0.5, 0.5 - Math.cos(a) * 0.5]);
  }
  return p;
}

// Every other rune has a first corner that tells you where the stroke began. A
// circle has none: two people drawing the same ring, one starting at the top and
// one at the left, produce point sequences that line up nowhere, and the bounded
// rotation search deliberately cannot twist far enough to reconcile them.
//
// So the circle is registered many times over - started at eight points around
// the ring, in both directions. That buys start-agnosticism for this one shape
// without granting it to the others, where the starting corner is exactly the
// information that separates a Levitation Charm from a Disarming Charm.
function loopVariants(loop, starts = 8) {
  const base = loop.slice(0, -1);          // drop the repeated closing point
  const out = [];
  for (const dir of [1, -1]) {
    const seq = dir === 1 ? base : [...base].reverse();
    for (let s = 0; s < starts; s++) {
      const off = Math.round((s * seq.length) / starts) % seq.length;
      const rot = [...seq.slice(off), ...seq.slice(0, off)];
      out.push([...rot, rot[0]]);
    }
  }
  return out;
}

spellById("banish").extra = loopVariants(ring());

export function spellById(id) { return SPELLS.find((s) => s.id === id) || null; }

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------
const pt = (p) => (Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.x, y: p.y });

export function pathLength(pts) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return d;
}

// Walk the path laying down N points at equal arc-length intervals. This is what
// makes matching independent of how FAST the wand moved: a slow start and a
// whipped finish resample to the same shape as one even sweep.
function resample(input, n = N) {
  const pts = input.map(pt);
  const total = pathLength(pts);
  if (!(total > 0)) return null;
  const step = total / (n - 1);
  const out = [pts[0]];
  let carried = 0;
  let prev = pts[0];

  for (let i = 1; i < pts.length; i++) {
    let a = prev;
    const b = pts[i];
    let d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d <= 0) continue;
    // One source segment can be long enough to hold several output points.
    while (carried + d >= step && out.length < n) {
      const t = (step - carried) / d;
      a = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
      out.push(a);
      d = Math.hypot(b.x - a.x, b.y - a.y);
      carried = 0;
    }
    carried += d;
    prev = b;
  }
  // Float error can leave us a point or two short of n.
  while (out.length < n) out.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
  return out;
}

// Centre on the origin and scale so the longer side of the bounding box is 1.
// Uniform, so aspect ratio survives - a wide flat zigzag stays wide and flat.
function normalize(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const size = Math.max(maxX - minX, maxY - minY);
  if (!(size > 1e-9)) return null;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  return pts.map((p) => ({ x: (p.x - cx) / size, y: (p.y - cy) / size }));
}

function rotate(pts, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return pts.map((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c }));
}

function meanDist(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  return d / a.length;
}

// Best fit over a bounded range of rotations, by golden-section search. The
// distance-versus-angle curve is smooth and single-dipped over a window this
// narrow, so a search beats sampling it on a grid.
function bestDist(candidate, template, rotLimit = ROT_LIMIT) {
  let lo = -rotLimit, hi = rotLimit;
  let x1 = hi - PHI * (hi - lo), x2 = lo + PHI * (hi - lo);
  let f1 = meanDist(rotate(candidate, x1), template);
  let f2 = meanDist(rotate(candidate, x2), template);
  for (let i = 0; i < ROT_STEPS; i++) {
    if (f1 < f2) {
      hi = x2; x2 = x1; f2 = f1;
      x1 = hi - PHI * (hi - lo);
      f1 = meanDist(rotate(candidate, x1), template);
    } else {
      lo = x1; x1 = x2; f1 = f2;
      x2 = lo + PHI * (hi - lo);
      f2 = meanDist(rotate(candidate, x2), template);
    }
  }
  return Math.min(f1, f2);
}

/**
 * Build a recogniser over an arbitrary spellbook. The templates are resampled
 * and normalised once, here, rather than on every cast.
 *
 * The game only ever wants the default one below, but tuning a gesture set is
 * a search - swap a glyph, measure the hit rate, the cross-talk and the false
 * casts, repeat - and that search needs to hold several spellbooks at once.
 */
export function createRecognizer(spells, opts = {}) {
  const rotLimit = opts.rotLimit ?? ROT_LIMIT;
  const accept = opts.accept ?? ACCEPT_DIST;
  const minLen = opts.minLen ?? MIN_STROKE_LEN;

  const templates = spells.flatMap((spell) =>
    [spell.glyph, ...(spell.extra || [])].map((g) => ({ spell, pts: normalize(resample(g)) }))
  );

  function all(stroke) {
    if (!stroke || stroke.length < 4) return null;
    const raw = stroke.map(pt);
    if (pathLength(raw) < minLen) return null;

    const pts = resample(raw);
    const cand = pts && normalize(pts);
    if (!cand) return null;

    // How far the stroke finished from where it started, in the same normalised
    // units as every distance below.
    const a = cand[0], z = cand[cand.length - 1];
    const endGap = Math.hypot(z.x - a.x, z.y - a.y);

    const bySpell = new Map();
    for (const t of templates) {
      // A closed rune drawn open is not a near miss, it is a different gesture.
      // Rejecting it here rather than leaning on the distance keeps the ring
      // from quietly widening into a catch-all.
      if (t.spell.closed && endGap > MAX_CLOSE_GAP) { bySpell.set(t.spell, Infinity); continue; }
      const d = bestDist(cand, t.pts, rotLimit);
      // A spell may own several templates (a mirrored variant, say); it scores
      // the best of them, not the last one tried.
      if (d < (bySpell.get(t.spell) ?? Infinity)) bySpell.set(t.spell, d);
    }
    return [...bySpell].map(([spell, dist]) => ({ spell, dist })).sort((a, b) => a.dist - b.dist);
  }

  return {
    accept,
    all,
    match(stroke) {
      const ranked = all(stroke);
      if (!ranked) return { spell: null, runnerUp: null, dist: Infinity, quality: 0, reason: "too short" };
      const [best, second] = ranked;
      // Quality is only ever shown to the player; the accept/reject decision is
      // the raw distance, so tightening the threshold never touches this.
      const quality = Math.max(0, Math.min(1, 1 - best.dist / (accept * 1.6)));
      if (best.dist > accept) {
        return { spell: null, runnerUp: best.spell, dist: best.dist, quality, reason: "misfire" };
      }
      return { spell: best.spell, runnerUp: second?.spell || null, dist: best.dist, quality, reason: "ok" };
    },
  };
}

const DEFAULT = createRecognizer(SPELLS);

/**
 * Match a raw stroke against the spellbook.
 *
 * @param  {Array} stroke  wand path in normalised screen space, {x,y} or [x,y]
 * @return {{spell, runnerUp, dist, quality, reason}} - `spell` is null when
 *         nothing matched and `reason` says why, which is what the screen tells
 *         you: "too short" means you barely moved, "misfire" means you moved
 *         plenty but drew nothing the spellbook knows.
 */
export const recognize = (stroke) => DEFAULT.match(stroke);

/**
 * Distance from a stroke to EVERY spell, nearest first. The runner-up is worth
 * knowing: it lets the screen say "that was nearly Levitate" instead
 * of reporting a bare failure.
 */
export const recognizeAll = (stroke) => DEFAULT.all(stroke);

// ---------------------------------------------------------------------------
// Drawing a rune - the hint over a target, and the spellbook on both screens.
// The path drawn here is the glyph the recogniser matches, not a lookalike.
// ---------------------------------------------------------------------------
export function glyphPath(ctx, glyph, x, y, w, h) {
  ctx.beginPath();
  glyph.forEach((g, i) => {
    const px = x + g[0] * w, py = y + g[1] * h;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
}

// A rune centred on (cx, cy) and sized to fit `size`, with an arrowhead so the
// DIRECTION of the stroke is never in doubt.
//
// `size` is both the width AND the height unless the spell overrides `aspect`.
// Drawing the glyph square is not a style choice: the recogniser normalises by
// the longer side of the bounding box, so squashing the rune on screen would
// teach a different shape from the one being matched - which is the exact drift
// that keeping glyph and template in one array was meant to prevent.
export function drawGlyph(ctx, spell, cx, cy, size, alpha = 1, lineWidth = 0) {
  const g = spell.glyph;
  const w = size, h = size * (spell.aspect ?? 1);
  const x = cx - w / 2, y = cy - h / 2;
  const lw = lineWidth || Math.max(2, size * 0.075);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = spell.color;
  ctx.shadowBlur = size * 0.3;
  ctx.strokeStyle = spell.color;
  ctx.lineWidth = lw;
  glyphPath(ctx, g, x, y, w, h);
  ctx.stroke();

  // arrowhead on the final leg
  const a = g[g.length - 2], b = g[g.length - 1];
  const ang = Math.atan2((b[1] - a[1]) * h, (b[0] - a[0]) * w);
  const hx = x + b[0] * w, hy = y + b[1] * h;
  const s = lw * 2.6;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(hx - s * Math.cos(ang - 0.42), hy - s * Math.sin(ang - 0.42));
  ctx.lineTo(hx - s * Math.cos(ang + 0.42), hy - s * Math.sin(ang + 0.42));
  ctx.closePath();
  ctx.fillStyle = spell.color;
  ctx.fill();
  ctx.restore();
}
