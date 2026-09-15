// What comes at you, and what it looks like when the right spell lands.
//
// Every target is bound to exactly one spell in game/spells.js. That binding is
// the whole game: the shape you have to draw is a property of the thing flying
// at you, so reading the board and choosing a gesture are the same act.
//
// Drawn procedurally, with no image files, for the same reason the dev server
// has no dependencies - a game you can serve from a folder never breaks because
// an asset did not load. Each target is drawn around its own origin at a given
// radius, so the engine can scale it freely.
//
// `gravityScale` and `sway` let a thing fall the way it ought to. A feather that
// drops like a crate is not a feather, and no amount of drawing fixes it.

const rand = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------------------
// The four things that come at you
// ---------------------------------------------------------------------------
export const TARGETS = [
  {
    id: "rogue",
    spell: "expel",
    label: "Rogue Mage",
    radius: 1.0,
    weight: 1.0,          // relative spawn frequency
    gravityScale: 1,
    sway: 0,
    aura: "#ff5a4d",
    // A wandering mage with a raised wand. Disarm it.
    draw(ctx, r) {
      const CLOAK = "#29486a";
      const CLOAK_LIT = "#467a97";

      // --- the raised wand arm, behind the body so the shoulder covers its root
      ctx.strokeStyle = CLOAK;
      ctx.lineCap = "round";
      ctx.lineWidth = r * 0.26;
      ctx.beginPath();
      ctx.moveTo(r * 0.34, r * 0.1);
      ctx.quadraticCurveTo(r * 0.82, r * 0.02, r * 0.94, -r * 0.46);
      ctx.stroke();
      // cuff
      ctx.strokeStyle = CLOAK_LIT;
      ctx.lineWidth = r * 0.28;
      ctx.beginPath();
      ctx.moveTo(r * 0.8, -r * 0.28);
      ctx.lineTo(r * 0.9, -r * 0.42);
      ctx.stroke();
      // hand
      ctx.fillStyle = "#cbc3c9";
      ctx.beginPath();
      ctx.ellipse(r * 0.97, -r * 0.52, r * 0.1, r * 0.085, -0.5, 0, Math.PI * 2);
      ctx.fill();
      // the wand you are here to take off it
      ctx.strokeStyle = "#8a6134";
      ctx.lineWidth = r * 0.075;
      ctx.beginPath();
      ctx.moveTo(r * 0.92, -r * 0.44);
      ctx.lineTo(r * 1.34, -r * 0.92);
      ctx.stroke();
      ctx.fillStyle = "#ffd873";
      ctx.shadowColor = "#ffb02e";
      ctx.shadowBlur = r * 0.35;
      ctx.beginPath();
      ctx.arc(r * 1.36, -r * 0.94, r * 0.075, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // --- the other arm, hanging
      ctx.strokeStyle = CLOAK;
      ctx.lineWidth = r * 0.22;
      ctx.beginPath();
      ctx.moveTo(-r * 0.36, r * 0.08);
      ctx.quadraticCurveTo(-r * 0.62, r * 0.34, -r * 0.56, r * 0.72);
      ctx.stroke();

      // --- body: shoulders that slope, a cloak that widens to a hem
      const bodyG = ctx.createLinearGradient(0, -r * 0.2, 0, r);
      bodyG.addColorStop(0, CLOAK_LIT);
      bodyG.addColorStop(1, "#120f1c");
      ctx.fillStyle = bodyG;
      ctx.beginPath();
      ctx.moveTo(-r * 0.44, -r * 0.08);
      ctx.quadraticCurveTo(-r * 0.66, r * 0.16, -r * 0.8, r * 1.0);
      ctx.lineTo(r * 0.8, r * 1.0);
      ctx.quadraticCurveTo(r * 0.66, r * 0.16, r * 0.44, -r * 0.08);
      ctx.closePath();
      ctx.fill();

      // a fold down the front, so the cloak has a direction
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = r * 0.05;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.02);
      ctx.lineTo(-r * 0.06, r * 0.98);
      ctx.stroke();

      // An open face, a copper circlet, and a tall blue travelling hat.
      ctx.fillStyle = "#d9a878";
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.43, r * 0.29, r * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#264c73";
      ctx.beginPath();
      ctx.moveTo(-r * 0.48, -r * 0.62);
      ctx.lineTo(-r * 0.12, -r * 1.22);
      ctx.lineTo(r * 0.18, -r * 1.03);
      ctx.lineTo(r * 0.42, -r * 0.62);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#e8b666";
      ctx.lineWidth = r * 0.075;
      ctx.beginPath();
      ctx.moveTo(-r * 0.46, -r * 0.62);
      ctx.lineTo(r * 0.45, -r * 0.62);
      ctx.stroke();
      ctx.fillStyle = "#302237";
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(side * r * 0.1, -r * 0.43, r * 0.035, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "#8a503a";
      ctx.lineWidth = r * 0.025;
      ctx.beginPath();
      ctx.moveTo(-r * 0.075, -r * 0.25);
      ctx.lineTo(r * 0.075, -r * 0.25);
      ctx.stroke();
    },
  },

  {
    id: "feather",
    spell: "levitate",
    label: "Feather",
    radius: 1.0,
    weight: 1.0,
    // The whole point of the Levitation Charm, so it has to already look like
    // something gravity has barely got hold of: it falls at half speed and
    // drifts sideways the entire way down.
    gravityScale: 0.42,
    sway: 0.14,
    aura: "#7fdcff",
    draw(ctx, r) {
      const tipX = r * 0.1, tipY = -r * 0.95;
      const baseX = -r * 0.12, baseY = r * 0.9;

      const g = ctx.createLinearGradient(-r * 0.5, -r, r * 0.5, r);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.55, "#dff1ff");
      g.addColorStop(1, "#a9cfe6");

      // the wide vane, then the narrow one
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.quadraticCurveTo(r * 0.82, -r * 0.1, r * 0.02, r * 0.68);
      ctx.quadraticCurveTo(r * 0.06, r * 0.1, tipX, tipY);
      ctx.fill();

      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.quadraticCurveTo(-r * 0.55, -r * 0.18, -r * 0.08, r * 0.56);
      ctx.quadraticCurveTo(-r * 0.02, r * 0.05, tipX, tipY);
      ctx.fill();
      ctx.globalAlpha = 1;

      // barbs - a few strokes are enough to stop it reading as a leaf
      ctx.strokeStyle = "rgba(120,160,190,0.5)";
      ctx.lineWidth = r * 0.02;
      for (let i = 1; i <= 7; i++) {
        const t = i / 8;
        const sx = tipX + (baseX - tipX) * t;
        const sy = tipY + (baseY - tipY) * t * 0.86;
        const spread = Math.sin(t * Math.PI) * r * 0.62;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + spread * 0.6, sy - r * 0.14, sx + spread, sy + r * 0.04);
        ctx.stroke();
      }

      // shaft, and the bare quill at the bottom
      ctx.strokeStyle = "#f4f9ff";
      ctx.lineCap = "round";
      ctx.lineWidth = r * 0.055;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.quadraticCurveTo(-r * 0.02, 0, baseX, baseY);
      ctx.stroke();
      ctx.strokeStyle = "#cfe0ee";
      ctx.lineWidth = r * 0.04;
      ctx.beginPath();
      ctx.moveTo(baseX * 0.72, baseY * 0.66);
      ctx.lineTo(baseX, baseY);
      ctx.stroke();
    },
  },

  {
    id: "wisp",
    spell: "banish",
    label: "Wisp",
    radius: 1.12,
    weight: 0.9,
    // It glides rather than falls, and drifts as it comes.
    gravityScale: 0.72,
    sway: 0.07,
    aura: "#cfe4ff",
    draw(ctx, r) {
      // A luminous woodland wisp: a floating core with curling light trails.
      const glow = ctx.createRadialGradient(0, 0, r * 0.05, 0, 0, r);
      glow.addColorStop(0, "rgba(235,255,255,0.95)");
      glow.addColorStop(0.3, "rgba(120,220,255,0.8)");
      glow.addColorStop(1, "rgba(95,145,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(140,210,255,0.65)";
      ctx.lineWidth = r * 0.075;
      ctx.lineCap = "round";
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * r * 0.25, r * 0.18);
        ctx.bezierCurveTo(side * r, r * 0.4, -side * r * 0.65, r * 0.9, side * r * 0.25, r * 1.15);
        ctx.stroke();
      }
      ctx.fillStyle = "#ddfaff";
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.08, r * 0.36, r * 0.43, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#315376";
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(side * r * 0.13, -r * 0.11, r * 0.045, r * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },

  {
    id: "serpent",
    spell: "shatter",
    label: "Serpent",
    radius: 1.08,
    weight: 0.8,          // rarest: worth the most, and the hardest rune to draw
    gravityScale: 1,
    sway: 0,
    aura: "#3ddc84",
    draw(ctx, r) {
      // body coil trailing behind the head
      ctx.strokeStyle = "#183a26";
      ctx.lineCap = "round";
      ctx.lineWidth = r * 0.42;
      ctx.beginPath();
      ctx.moveTo(-r * 0.2, r * 0.2);
      ctx.quadraticCurveTo(-r * 0.95, r * 0.5, -r * 0.7, r * 0.95);
      ctx.stroke();

      // head
      const g = ctx.createLinearGradient(0, -r * 0.7, 0, r * 0.6);
      g.addColorStop(0, "#2f6b46");
      g.addColorStop(1, "#12301f");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(r * 0.95, r * 0.06);                       // snout
      ctx.quadraticCurveTo(r * 0.5, -r * 0.72, -r * 0.25, -r * 0.5);
      ctx.quadraticCurveTo(-r * 0.7, -r * 0.1, -r * 0.2, r * 0.42);
      ctx.quadraticCurveTo(r * 0.35, r * 0.6, r * 0.95, r * 0.06);
      ctx.closePath();
      ctx.fill();

      // scale sheen
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#8fffc4";
      ctx.beginPath();
      ctx.ellipse(r * 0.1, -r * 0.3, r * 0.42, r * 0.14, -0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // slit eye
      ctx.fillStyle = "#ffd12e";
      ctx.beginPath();
      ctx.ellipse(r * 0.3, -r * 0.2, r * 0.16, r * 0.11, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0a0a0a";
      ctx.beginPath();
      ctx.ellipse(r * 0.31, -r * 0.2, r * 0.035, r * 0.095, -0.25, 0, Math.PI * 2);
      ctx.fill();

      // fangs
      ctx.fillStyle = "#f4f7ff";
      for (const dx of [0.58, 0.78]) {
        ctx.beginPath();
        ctx.moveTo(r * dx, r * 0.24);
        ctx.lineTo(r * (dx + 0.08), r * 0.24);
        ctx.lineTo(r * (dx + 0.03), r * 0.58);
        ctx.closePath();
        ctx.fill();
      }
    },
  },
];

export const targetById = (id) => TARGETS.find((t) => t.id === id) || null;
export const targetsForSpell = (spellId) => TARGETS.filter((t) => t.spell === spellId);

// Weighted pick. Kept here rather than in the engine so that adding a target is
// one edit to one file.
export function randomTarget() {
  const total = TARGETS.reduce((t, k) => t + k.weight, 0);
  let r = Math.random() * total;
  for (const k of TARGETS) { r -= k.weight; if (r <= 0) return k; }
  return TARGETS[0];
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

// The aura is the fastest read on the board: its colour is the spell's colour,
// so "which gesture does that one want" is answerable before you have parsed
// what the thing actually is.
export function drawTarget(ctx, kind, x, y, r, rot, opts = {}) {
  const { alpha = 1, aura = 1, hit = 0 } = opts;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);

  if (aura > 0) {
    const ring = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 1.75);
    ring.addColorStop(0, kind.aura + "00");
    ring.addColorStop(0.55, kind.aura + "3a");
    ring.addColorStop(1, kind.aura + "00");
    ctx.globalAlpha = alpha * aura;
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
  }

  ctx.rotate(rot);
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = r * 0.4;
  ctx.shadowOffsetY = r * 0.12;
  kind.draw(ctx, r);
  ctx.restore();

  // A wrong spell flashes the target white rather than doing nothing at all -
  // silence reads as a bug, a flash reads as "that was not it".
  if (hit > 0) {
    ctx.save();
    ctx.globalAlpha = alpha * hit * 0.75;
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Defeat: what the right spell does to each thing
//
// Every target dies differently, and the difference is the reward. A feather
// that simply vanished would make the Levitation Charm feel identical to the
// Killing Curse, which is the opposite of the point.
// ---------------------------------------------------------------------------
export const DEFEATS = {
  // Disarmed: the wand spins away, the figure is flung back.
  rogue: (t) => ({
    mode: "fling",
    vx: t.vx * 0.4 + rand(-0.1, 0.1) * 2,
    vy: -Math.abs(t.vy) * 0.3 - 0.25,
    spin: rand(-9, 9),
    sparks: { color: "#ff8b6b", n: 22, power: 1.15 },
  }),
  // Levitated: gravity lets go entirely and it rises out of the world.
  feather: () => ({
    mode: "float",
    vx: rand(-0.05, 0.05),
    vy: -0.3,
    spin: rand(-0.9, 0.9),
    sparks: { color: "#bfeeff", n: 20, power: 0.45 },
  }),
  // Driven off: it recoils from the light and flees upward, fading fast.
  wisp: (t) => ({
    mode: "banish",
    vx: t.vx * 0.2 + rand(-0.12, 0.12),
    vy: -0.62,
    spin: rand(-1.6, 1.6),
    sparks: { color: "#eaf4ff", n: 30, power: 0.95 },
  }),
  // Cursed: it stops dead, then comes apart.
  serpent: () => ({
    mode: "dissolve",
    vx: 0,
    vy: 0.05,
    spin: rand(-1.2, 1.2),
    sparks: { color: "#5cffa8", n: 34, power: 1.35 },
  }),
  // Incinerated: bursts into embers and flames.
  spider: (t) => ({
    mode: "incinerate",
    vx: t.vx * 0.3 + rand(-0.1, 0.1) * 1.5,
    vy: -0.22,
    spin: rand(-3.5, 3.5),
    sparks: { color: "#ff8400", n: 32, power: 1.25 },
  }),
};

export const defeatFor = (t) => (DEFEATS[t.kind.id] || DEFEATS.rogue)(t);
