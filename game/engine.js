// The game itself: spawning, physics, casting, scoring, state.
//
// The engine owns the canvas and the requestAnimationFrame loop and knows
// nothing about Firebase. It is fed wand samples through input()/inputLocal()
// and reports back through the callbacks handed to createGame(). That is what
// lets the same engine run off a phone, off a mouse, or off a future WebRTC
// datachannel without noticing the difference.
//
// The loop is: something flies in wearing the rune of the spell that stops it;
// you hold the cast button and draw that rune with the wand; on release the
// stroke goes to game/spells.js, and if it comes back as the right spell a bolt
// leaves your wand tip and finds the target. Draw the wrong rune and the target
// shrugs it off. Let it fall off the bottom and it costs you a life.
//
// Pacing is the one thing that could not be inherited from the game this was
// lifted from. Slicing is instant; drawing a gesture takes the better part of a
// second, and you cannot draw while also tracking something that crosses the
// screen in 1.2s. So gravity is roughly a third of what it was, arcs peak
// higher, and waves are sparser - a target is in the air for about 3.5 seconds,
// which is one comfortable cast and no time to dither.

import { TARGETS, randomTarget, drawTarget, defeatFor } from "./targets.js";
import { SPELLS, recognize, drawGlyph } from "./spells.js";
import { createBlade } from "./blade.js";
import { sound } from "./audio.js";

const BEST_KEY = "spellscast.best";

// --- tuning ----------------------------------------------------------------
const GRAVITY = 0.55;           // in screen-heights per second squared
const TARGET_R = 0.072;         // base radius as a fraction of screen height
const START_LIVES = 3;
const COMBO_MS = 2600;          // a cast takes ~1s, so the combo window is wide
const BOLT_MS = 150;            // wand tip -> target
const POPUP_TTL = 1.5;

const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

const loadBest = () => { try { return parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch { return 0; } };
const saveBest = (v) => { try { localStorage.setItem(BEST_KEY, String(v)); } catch {} };

export function createGame(canvas, { onHud, onState, onCast } = {}) {
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1;

  let state = "lobby";          // lobby | countdown | playing | over
  let score = 0, lives = START_LIVES, best = loadBest();
  let combo = 0, lastCastAt = 0;
  let countdownLeft = 0;
  let waveTimer = 0, waveNo = 0;
  let shake = 0, flash = 0, flashColor = "255,240,210";
  let raf = 0, lastFrame = 0;
  let lastCast = null;          // what the HUD echoes to the phone
  let lastCountN = -1;

  const blades = new Map();     // pid -> blade
  const targets = [];
  const bolts = [];             // a spell in flight
  const bits = [];              // sparks
  const popups = [];            // "EXPEL  +20"
  const pending = [];           // staggered spawns waiting for their moment

  // -------------------------------------------------------------------------
  // canvas sizing
  // -------------------------------------------------------------------------
  function resize() {
    const oldW = W, oldH = H;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Everything in flight is stored in pixels, so carry it across the resize.
    if (oldW > 0 && oldH > 0 && (oldW !== W || oldH !== H)) {
      const sx = W / oldW, sy = H / oldH;
      for (const list of [targets, bits, bolts]) {
        for (const o of list) {
          o.x *= sx; o.y *= sy;
          if (o.vx != null) { o.vx *= sx; o.vy *= sy; }
        }
      }
      for (const p of popups) { p.x *= sx; p.y *= sy; }
    }
  }
  const onResize = () => resize();
  window.addEventListener("resize", onResize);
  resize();

  // -------------------------------------------------------------------------
  // wands
  // -------------------------------------------------------------------------
  function ensureBlade(pid, slot = 0) {
    let b = blades.get(pid);
    if (!b) { b = createBlade(slot); blades.set(pid, b); }
    return b;
  }

  // -------------------------------------------------------------------------
  // spawning
  //
  // Rather than guessing a launch velocity, aim: pick the height the arc should
  // peak at and solve for the launch speed that gets there under gravity. Aiming
  // a point ALONG the arc instead overshoots wildly on the way up and the target
  // spends half its life off the top of the screen.
  // -------------------------------------------------------------------------
  function difficulty() { return clamp(score / 900, 0, 1); }

  function launch(kind) {
    // Each kind falls under its own gravity, and the arc is solved with it - so
    // a feather at 0.42g does not just drift down slowly, it is thrown gently
    // and hangs. Solving with full gravity and scaling afterwards would send it
    // straight off the top of the screen.
    const gs = kind.gravityScale ?? 1;
    const g = GRAVITY * H * gs;
    const r = TARGET_R * H * kind.radius;
    const side = Math.random();
    let x0, y0;
    if (side < 0.68) {                      // up from the bottom
      x0 = rand(W * 0.14, W * 0.86);
      y0 = H + r;
    } else if (side < 0.84) {               // in from the left
      x0 = -r;
      y0 = rand(H * 0.6, H * 0.95);
    } else {                                // in from the right
      x0 = W + r;
      y0 = rand(H * 0.6, H * 0.95);
    }

    const apexY = rand(H * 0.12, H * 0.3);
    const rise = Math.max(H * 0.3, y0 - apexY);
    const vy = -Math.sqrt(2 * g * rise);
    const tApex = -vy / g;
    const apexX = x0 < 0 ? rand(W * 0.35, W * 0.85)
                : x0 > W ? rand(W * 0.15, W * 0.65)
                : x0 + rand(-W * 0.18, W * 0.18);

    targets.push({
      kind,
      spell: kind.spell,
      r,
      x: x0, y: y0,
      vx: (clamp(apexX, r, W - r) - x0) / tApex,
      vy,
      rot: rand(-0.25, 0.25),
      av: rand(-0.9, 0.9),
      gs,
      sway: kind.sway || 0,
      swayRate: rand(1.7, 2.6),
      swayPhase: rand(0, Math.PI * 2),
      age: 0,
      dead: false,
      defeat: null,
      life: 0,
      alpha: 1,
      hitFlash: 0,
      scale: 1,
    });
  }

  function scheduleWave(now) {
    waveNo++;
    const playing = state === "playing";
    const d = difficulty();
    // Two on screen at once is already a real decision - which rune first? -
    // and three is most people's ceiling while they are still learning the
    // gestures. This is deliberately far below what the slicing game threw.
    const count = playing ? clamp(Math.round(lerp(1.15, 2.5, d) * rand(0.8, 1.2)), 1, 3) : 1;
    for (let i = 0; i < count; i++) {
      pending.push({ at: now + i * rand(420, 900), kind: randomTarget() });
    }
    waveTimer = playing ? lerp(2.7, 1.35, d) * rand(0.9, 1.1) : rand(2.2, 3.4);
  }

  // -------------------------------------------------------------------------
  // casting
  // -------------------------------------------------------------------------

  // Which target should this spell hit? The one it CAN hit that is nearest to
  // where the stroke finished. Seeking rather than requiring a precise overlap
  // is deliberate: the hard part is meant to be drawing the rune, not also
  // landing an air-drawn gesture on top of a moving object. Aim still decides
  // between two valid targets, which is as much as it should decide.
  function pickTarget(spellId, fromX, fromY) {
    let best = null, bestD = Infinity;
    for (const t of targets) {
      if (t.dead || t.spell !== spellId) continue;
      const d = Math.hypot(t.x - fromX, t.y - fromY);
      if (d < bestD) { bestD = d; best = t; }
    }
    return best;
  }

  // A wrong rune should say so on the thing you aimed at, not in the abstract.
  function nearestAny(fromX, fromY) {
    let best = null, bestD = Infinity;
    for (const t of targets) {
      if (t.dead) continue;
      const d = Math.hypot(t.x - fromX, t.y - fromY);
      if (d < bestD) { bestD = d; best = t; }
    }
    return best;
  }

  function resolveCast(blade, stroke, now) {
    const res = recognize(stroke);
    const end = stroke && stroke.length ? stroke[stroke.length - 1] : blade.position;
    const ex = end.x * W, ey = end.y * H;

    // Game over: any spell you can actually cast starts the next run. Making
    // the player draw a PARTICULAR rune to retry punishes the exact mistake
    // they just made.
    if (state === "over") {
      // Report before restarting. A cast that silently works looks exactly like
      // a cast that silently failed, and this is the one screen where the player
      // is already suspicious that their gestures are not landing.
      if (res.spell) {
        report({ ok: true, spell: res.spell.id, name: res.spell.name, score: 0 });
        start();
      } else if (res.reason === "misfire") {
        report({ ok: false, reason: "misfire", near: res.runnerUp?.name || null });
      }
      return;
    }

    if (!res.spell) {
      // "too short" is a thumb slip and deserves no feedback at all; a misfire
      // is a real attempt and deserves to be named.
      if (res.reason === "misfire") {
        announce(null, "MISFIRE", ex, ey, "#ff8a8a");
        report({ ok: false, reason: "misfire", near: res.runnerUp?.name || null });
        combo = 0;
        publishHud();
      }
      return;
    }

    const spell = res.spell;
    const hit = pickTarget(spell.id, ex, ey);

    if (!hit) {
      // The rune was right; there was just nothing on the board that answers to
      // it. Name the spell anyway - the player got that part right.
      const wrong = nearestAny(ex, ey);
      if (wrong) wrong.hitFlash = 1;
      announce(spell, spell.name.toUpperCase(), ex, ey, spell.color, "no target");
      report({ ok: false, reason: "no-target", spell: spell.id, name: spell.name });
      if (state === "playing") { combo = 0; publishHud(); }
      sound.castBolt(spell.id);
      return;
    }

    bolts.push({
      x: blade.position.x * W, y: blade.position.y * H,
      target: hit, spell, t: 0, dur: BOLT_MS / 1000,
      color: spell.color, glow: spell.glow,
    });
    hit.dead = true;              // claimed now, so two wands cannot both take it
    sound.castBolt(spell.id);

    if (state !== "playing") {
      announce(spell, spell.name.toUpperCase(), hit.x, hit.y - hit.r, spell.color);
      report({ ok: true, spell: spell.id, name: spell.name, score: 0 });
      // One successful cast in the lobby IS the start button. It is a better
      // gate than a button: it proves the wand is tracking, that the player has
      // found a rune, and that the phone's cast pad is wired up - all the things
      // that otherwise go wrong silently in the first ten seconds of a run.
      if (state === "lobby") start();
      return;
    }

    combo = now - lastCastAt < COMBO_MS ? combo + 1 : 1;
    lastCastAt = now;
    const mult = Math.min(combo, 5);
    const gained = spell.score * mult;
    score += gained;
    if (mult > 1) sound.combo(mult);
    announce(spell, spell.name.toUpperCase(), hit.x, hit.y - hit.r, spell.color,
      "+" + gained + (mult > 1 ? "   x" + mult : ""));
    report({ ok: true, spell: spell.id, name: spell.name, score: gained, combo: mult });
    publishHud();
  }

  function announce(spell, text, x, y, color, sub = "") {
    popups.push({
      spell, text, sub, color,
      x: clamp(x, W * 0.16, W * 0.84),
      y: clamp(y, H * 0.12, H * 0.86),
      life: 0, ttl: POPUP_TTL,
    });
  }

  function report(o) {
    lastCast = { ...o, at: performance.now() };
    onCast?.(lastCast);
  }

  function landBolt(b) {
    const t = b.target;
    const d = defeatFor(t);
    t.defeat = d;
    t.life = 0;
    t.vx = d.vx * H;
    t.vy = d.vy * H;
    t.av = d.spin;
    burst(t.x, t.y, d.sparks.color, d.sparks.n, d.sparks.power);
    flash = 0.5;
    flashColor = hexToRgb(b.spell.color);
    shake = Math.max(shake, t.kind.id === "serpent" || t.kind.id === "spider" ? 0.5 : 0.28);
    sound.defeat(d.mode);
  }

  function burst(x, y, color, n, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(0.1, 0.5) * H * power;
      bits.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - rand(0, 0.14) * H,
        r: rand(0.004, 0.012) * H,
        color, life: 0, ttl: rand(0.5, 1.05),
      });
    }
  }

  // -------------------------------------------------------------------------
  // state
  // -------------------------------------------------------------------------
  function publishHud() {
    onHud?.({
      score, best: Math.max(best, score), lives, combo, status: state,
      spell: lastCast?.name || "", castOk: lastCast?.ok ?? null,
    });
  }
  function setState(s) {
    if (state === s) return;
    state = s;
    onState?.(s);
    publishHud();
  }

  function clearBoard() {
    targets.length = 0; bolts.length = 0; bits.length = 0;
    popups.length = 0; pending.length = 0;
  }

  function start() {
    clearBoard();
    score = 0; lives = START_LIVES; combo = 0; lastCast = null;
    waveNo = 0; waveTimer = 0.4; countdownLeft = 3.2;
    shake = 0; flash = 0;
    for (const b of blades.values()) b.reset();
    setState("countdown");
  }

  function gameOver() {
    if (state === "over") return;
    if (score > best) { best = score; saveBest(best); }
    setState("over");
    sound.gameOver();
  }

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------
  function update(dt, now) {
    const g = GRAVITY * H;

    for (const b of blades.values()) {
      b.step(dt, now);
      const stroke = b.takeStroke();
      if (stroke) resolveCast(b, stroke, now);
    }

    if (state === "countdown") {
      const n = Math.ceil(countdownLeft - 0.2);
      if (n !== lastCountN && n >= 0 && n <= 3) {
        lastCountN = n;
        sound.countdown(n);
      }
      countdownLeft -= dt;
      if (countdownLeft <= 0) setState("playing");
    }

    if (state === "playing" || state === "lobby") {
      waveTimer -= dt;
      if (waveTimer <= 0) scheduleWave(now);
    }
    for (let i = pending.length - 1; i >= 0; i--) {
      if (now >= pending[i].at) { launch(pending[i].kind); pending.splice(i, 1); }
    }

    // bolts
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.t += dt;
      if (b.t >= b.dur) { landBolt(b); bolts.splice(i, 1); }
    }

    // targets
    for (let i = targets.length - 1; i >= 0; i--) {
      const t = targets[i];
      t.hitFlash = Math.max(0, t.hitFlash - dt * 3.2);

      if (t.defeat) {
        t.life += dt;
        // Levitation is the whole point of one of these spells, so a levitated
        // feather must visibly stop obeying gravity rather than just fading.
        const gg = t.defeat.mode === "float" ? -g * 0.12
                 : t.defeat.mode === "banish" ? -g * 0.5
                 : t.defeat.mode === "dissolve" ? g * 0.1
                 : t.defeat.mode === "incinerate" ? -g * 0.08
                 : g * t.gs;
        t.vy += gg * dt;
        t.x += t.vx * dt; t.y += t.vy * dt;
        t.rot += t.av * dt;
        if (t.defeat.mode === "dissolve") { t.alpha = clamp(1 - t.life / 0.55, 0, 1); t.scale = 1 + t.life * 0.7; }
        // A wisp does not die, it flees - gone quickly, and shrinking away
        // rather than coming apart.
        else if (t.defeat.mode === "banish") { t.alpha = clamp(1 - t.life / 0.7, 0, 1); t.scale = 1 - t.life * 0.35; }
        else if (t.defeat.mode === "incinerate") { t.alpha = clamp(1 - t.life / 0.65, 0, 1); t.scale = 1 + t.life * 0.5; }
        else t.alpha = clamp(1.6 - t.life / 0.9, 0, 1);
        if (t.alpha <= 0.01 || t.life > 2.2) targets.splice(i, 1);
        continue;
      }

      if (t.dead) continue;       // claimed by a bolt still in flight

      t.age += dt;
      t.vy += g * t.gs * dt;
      t.x += t.vx * dt; t.y += t.vy * dt;
      // A feather does not fall in a straight line. The drift is applied to the
      // position rather than the velocity so it wanders and returns instead of
      // slowly accelerating off the side of the screen.
      if (t.sway) t.x += Math.sin(t.age * t.swayRate + t.swayPhase) * t.sway * H * dt;
      t.rot += t.av * dt;

      const belowBottom = t.y - t.r > H + t.r * 2 && t.vy > 0;
      const offSide = t.x < -t.r * 4 || t.x > W + t.r * 4;
      if (belowBottom || offSide) {
        targets.splice(i, 1);
        if (belowBottom && state === "playing") {
          lives--;
          combo = 0;
          shake = Math.max(shake, 0.5);
          flash = 0.35;
          flashColor = "255,90,90";
          sound.lifeLost();
          if (lives <= 0) gameOver(); else publishHud();
        }
      }
    }

    // sparks
    for (let i = bits.length - 1; i >= 0; i--) {
      const p = bits[i];
      p.vy += g * 0.8 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life += dt;
      if (p.life > p.ttl) bits.splice(i, 1);
    }

    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].life += dt;
      popups[i].y -= 22 * dt;
      if (popups[i].life > popups[i].ttl) popups.splice(i, 1);
    }

    if (combo && now - lastCastAt > COMBO_MS) { combo = 0; publishHud(); }
    shake = Math.max(0, shake - dt * 2.4);
    flash = Math.max(0, flash - dt * 2.6);
  }

  // -------------------------------------------------------------------------
  // render
  // -------------------------------------------------------------------------
  function render(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (shake > 0) {
      const m = shake * shake * H * 0.03;
      ctx.translate(rand(-m, m), rand(-m, m));
    }

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#141026");
    bg.addColorStop(0.55, "#0d0b1a");
    bg.addColorStop(1, "#07060f");
    ctx.fillStyle = bg;
    ctx.fillRect(-H, -H, W + H * 2, H * 3);

    for (const t of targets) {
      drawTarget(ctx, t.kind, t.x, t.y, t.r * t.scale, t.rot, {
        alpha: t.alpha,
        aura: t.defeat ? 0 : 1,
        hit: t.hitFlash,
      });
      // The rune it wants, floating above it. This is the game's only real
      // instruction and it is attached to the thing it describes.
      if (!t.defeat && !t.dead) {
        const spell = SPELLS.find((s) => s.id === t.spell);
        if (spell) {
          const bob = Math.sin(now / 420 + t.x * 0.01) * t.r * 0.06;
          drawGlyph(ctx, spell, t.x, t.y - t.r * 1.62 + bob, t.r * 1.15, 0.92 * t.alpha);
        }
      }
    }

    for (const b of bolts) drawBolt(ctx, b);

    for (const p of bits) {
      const k = 1 - p.life / p.ttl;
      ctx.globalAlpha = k;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.4 + k * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const b of blades.values()) b.draw(ctx, W, H, now);

    for (const p of popups) drawPopup(ctx, p);

    if (state === "lobby") drawSpellbook(now);
    if (state === "countdown") drawCountdown();
    if (state === "over") drawGameOver();

    if (flash > 0) {
      ctx.fillStyle = "rgba(" + flashColor + "," + (flash * 0.5) + ")";
      ctx.fillRect(-H, -H, W + H * 2, H * 3);
    }
  }

  // A bolt homes on its target, so it lands even on something still moving.
  function drawBolt(ctx, b) {
    const k = clamp(b.t / b.dur, 0, 1);
    const tx = b.target.x, ty = b.target.y;
    const hx = lerp(b.x, tx, k), hy = lerp(b.y, ty, k);
    const trail = 0.34;
    const sx = lerp(b.x, tx, Math.max(0, k - trail));
    const sy = lerp(b.y, ty, Math.max(0, k - trail));

    ctx.save();
    ctx.lineCap = "round";
    ctx.shadowColor = b.color;
    ctx.shadowBlur = H * 0.05;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = H * 0.016;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = H * 0.006;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.restore();
  }

  function drawPopup(ctx, p) {
    const k = 1 - p.life / p.ttl;
    const pop = Math.min(1, p.life / 0.12);
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 1.7);
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 12;
    ctx.font = "900 " + Math.round(H * 0.036 * (0.8 + pop * 0.2)) + "px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
    if (p.sub) {
      ctx.font = "800 " + Math.round(H * 0.026) + "px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.fillStyle = "#fff";
      ctx.fillText(p.sub, p.x, p.y + H * 0.036);
    }
    ctx.restore();
  }

  // The lobby doubles as the reference card: three runes, named, always there
  // while nobody is playing. Learning happens here, not in a manual.
  function drawSpellbook(now) {
    const cw = W / (SPELLS.length + 1);
    const size = Math.min(cw * 0.5, H * 0.115);
    const y = H * 0.79;
    ctx.save();
    ctx.textAlign = "center";
    SPELLS.forEach((s, i) => {
      const x = cw * (i + 1);
      const bob = Math.sin(now / 700 + i) * H * 0.004;
      drawGlyph(ctx, s, x, y + bob, size, 0.95);
      ctx.font = "800 " + Math.round(H * 0.022) + "px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.fillStyle = s.color;
      ctx.fillText(s.name, x, y + size * 0.62);
      ctx.font = "600 " + Math.round(H * 0.016) + "px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillText(s.move, x, y + size * 0.62 + H * 0.026);
    });
    ctx.restore();
  }

  function drawCountdown() {
    const n = Math.ceil(countdownLeft - 0.2);
    const label = n <= 0 ? "CAST!" : String(Math.min(n, 3));
    const frac = 1 - ((countdownLeft - 0.2) % 1);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = clamp(1.25 - frac * 0.6, 0, 1);
    ctx.font = "900 " + Math.round(H * (0.18 + frac * 0.04)) + "px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(0,0,0,0.75)";
    ctx.shadowBlur = 26;
    ctx.fillText(label, W / 2, H * 0.42);
    ctx.restore();
  }

  function drawGameOver() {
    ctx.save();
    ctx.fillStyle = "rgba(6,5,12,0.74)";
    ctx.fillRect(-H, -H, W + H * 2, H * 3);
    ctx.textAlign = "center";

    ctx.fillStyle = "#fff";
    ctx.font = "900 " + Math.round(H * 0.09) + "px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText("WAND DOWN", W / 2, H * 0.26);

    ctx.fillStyle = "#ffe27a";
    ctx.font = "800 " + Math.round(H * 0.07) + "px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText(String(score), W / 2, H * 0.37);

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "600 " + Math.round(H * 0.024) + "px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText(score >= best ? "NEW BEST" : "BEST  " + best, W / 2, H * 0.43);

    ctx.fillStyle = "#fff";
    ctx.font = "800 " + Math.round(H * 0.026) + "px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText("Cast any spell to play again", W / 2, H * 0.55);
    ctx.restore();

    // Show the runes again on the way out - the run you just lost is the moment
    // you most want to be reminded which shape you kept fluffing.
    const cw = W / (SPELLS.length + 1);
    const size = Math.min(cw * 0.4, H * 0.1);
    ctx.save();
    ctx.textAlign = "center";
    SPELLS.forEach((s, i) => {
      const x = cw * (i + 1);
      drawGlyph(ctx, s, x, H * 0.71, size, 0.85);
      ctx.font = "700 " + Math.round(H * 0.019) + "px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.fillStyle = s.color;
      ctx.fillText(s.name, x, H * 0.71 + size * 0.72);
    });
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // loop
  // -------------------------------------------------------------------------
  function frame(now) {
    raf = requestAnimationFrame(frame);
    // A backgrounded tab hands back a huge dt; cap it so nothing teleports.
    const dt = Math.min((now - lastFrame) / 1000 || 0, 0.05);
    lastFrame = now;
    update(dt, now);
    render(now);
  }
  raf = requestAnimationFrame((t) => { lastFrame = t; frame(t); });

  publishHud();

  return {
    get state() { return state; },
    get score() { return score; },
    get lives() { return lives; },
    get best() { return best; },
    get width() { return W; },
    get height() { return H; },
    get lastCast() { return lastCast; },

    addPlayer(pid, slot) { ensureBlade(pid, slot); },
    removePlayer(pid) { blades.delete(pid); },
    hasPlayer(pid) { return blades.has(pid); },
    get playerCount() { return blades.size; },

    // A sample off the wire: carries velocity, so it gets extrapolated, and the
    // cast flag, which is what opens and closes a stroke.
    input(pid, sample, slot = 0) { ensureBlade(pid, slot).feed(sample); },
    // Local input (the screen's own mouse): no lag, no prediction.
    inputLocal(pid, x, y, cast = false, slot = 0) { ensureBlade(pid, slot).feedDirect(x, y, cast); },

    start,
    gameOver,
    restart: start,
    // Back to the QR screen - the last phone hung up.
    lobby() {
      clearBoard();
      combo = 0; lastCast = null;
      waveTimer = 0.6; waveNo = 0;
      setState("lobby");
    },

    sound,
    toggleMute() { return sound.toggleMute(); },
    isMuted() { return sound.isMuted(); },

    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    },
  };
}

// "#3ddc84" -> "61,220,132", for the rgba() screen flash.
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(",");
}

export { TARGETS, SPELLS };
