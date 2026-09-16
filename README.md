# SpellsCast

Put a screen up, scan the QR with your phone, and the phone becomes a **wand**.
Point it and a glowing tip moves across the screen. Hold the cast button, **draw
a rune in the air**, and let go — draw the right one and the spell fires.

No app to install, no account, no name to type. Scan and cast.

**Play it:** open **https://emirhan777.github.io/SpellsCast/** on a computer or TV, then scan the QR code with your phone.

**Sound:** click once anywhere on the big screen when it opens. Browsers keep a page silent until someone clicks on it, and all the sound plays on the big screen while you play from the phone, so a prompt at the top asks for that click.

```
 📱 play.html (phone, points + casts) ──wand coords + thumb──▶ 🔥 Firebase RTDB ◀──listen── 🖥️ index.html (big screen)
```

## The spells

Things fly in wearing the rune of the spell that stops them. Draw it.

| Spell | Draw | Stops | |
|-------|------|-------|--|
| **Expel** | Drive down and snap back up — a narrow **V** | Rogue Mages | their wand spins away |
| **Levitate** | Swish across, then flick straight up | Feathers | they drift up and out |
| **Banish** | Sweep a full **circle** | Ghosts | they recoil and flee |
| **Shatter** | Tear a lightning **zigzag** | Serpents | they come apart |

A feather falls at less than half gravity and drifts sideways the whole way down,
so the Levitation Charm gets the gentlest target on the board. A translucent ghost glides.
A Rogue Mage and a serpent drop like anything else.

Draw the wrong rune and the target shrugs it off. Let one fall off the bottom and
it costs a life. Three lives, then the wand goes down.

The runes are on your phone the whole time, and on the big screen whenever nobody
is playing — there is nothing to memorise before you start.

---

## Run it

```bash
npm start
```

Then open **http://localhost:3000/?mouse=1** — the big screen gets its own mouse
wand, and **holding the mouse button** is the cast pad. The whole game is
playable with no phone at all, which is the fastest loop while you are building.

If port 3000 is busy, `PORT=3001 npm start` (and point the tunnel at the same
port).

### On a real phone

Motion sensors only work over **https**, so a plain `http://192.168.…` address
will not do — iOS silently sends no motion data at all. Two terminals:

```bash
npm start          # terminal 1 — serves the game
npm run tunnel     # terminal 2 — puts it on a public https address
```

Terminal 2 prints a URL like `https://something.trycloudflare.com`. **Open that
URL on your computer**, not localhost — the QR is built from whatever address the
page is served from. Then scan it with your phone.

`npm run tunnel` forces cloudflared's HTTP/2 transport, because many university
and corporate networks drop the outbound UDP its default QUIC transport needs.
If you ever see it loop on `Failed to dial a quic connection`, that is why.

### Tests

```bash
npm test           # everything
npm run test:tilt   # wand stability against a smooth swing
npm run test:spell  # can the recogniser tell the runes apart?
npm run test:engine # does a cast survive the wand, the wire and the lag budget?
npm run test:net    # relay round trip + security rules — hits the real database
```

Only `test:net` touches the network. The other three are pure geometry and a
stubbed browser, so they run anywhere, instantly.

---

## How casting works

Three problems sit between a waving phone and a spell. All three are solved here,
and the tests exist because all three are easy to break.

### 1. Where does a gesture start?

A wand that is always being waved has no idea where one gesture ends and the next
begins. So it does not guess: **the thumb delimits the stroke.** Holding the cast
pad opens a stroke, releasing closes it, and only what happened in between is
matched. That single boolean is the difference between a gesture recogniser that
works and one that fires spells while you are scratching your nose.

Both edges of the hold jump the network throttles in `net.js` — drop the opening
edge and the stroke never starts; drop the closing one and it never ends.

### 2. What did they draw?

`game/spells.js` is the $1 Unistroke Recogniser with two deliberate departures:

- **Rotation invariance is bounded** to ±18° instead of total. $1 normally rotates
  a stroke until it best fits, which makes an upward flick and a downward flick
  the same gesture — fatal when the flick direction is most of what separates a
  Levitation Charm from a lazy swipe.
- **Scaling is uniform**, not $1's stretch-to-a-square, which would flatten a tall
  narrow zigzag onto a wide flat one.

Banish needed one more idea. A circle has no starting corner, so two
people drawing the same ring from different points produce sequences that line up
nowhere — it is registered at **eight start points in both directions** to fix
that. But sixteen chances to be the nearest template made it greedy: it pulled a
clean Expel V to within 0.235 of itself and raised false casts from 7% to
11.5%. The fix was structural rather than numerical — a ring **returns to where
it began** and a V does not, so a `closed` flag rejects any stroke whose ends are
too far apart before a single distance is compared. Margin restored to 0.163,
false casts back to 8.3%.

And one rule governs the open shapes: **no spell is a straight line.** The first draft
made Expel a straight thrust; `npm run test:spell` reported that 64% of
random scribbles landed on it, because a line is the lowest-entropy stroke there
is. Every open rune now has at least one hard corner and that fell to 7%.

The glyph drawn on screen and the template being matched are the **same array**,
so the shape you are taught cannot drift from the shape being scored.

### 3. Does it survive the wand?

The recogniser scores perfectly against clean geometry, which proves nothing: a
real stroke has been sampled, eased and clamped on the way to the screen,
and smoothing **rounds corners** — which is all these gestures are made of.
`npm run test:engine` runs the actual engine against a stub canvas and draws each
rune the way a hand does, at four speeds and three sizes, on and off centre. All
four survive at 100%.

---

## How the wand works

The phone-to-screen pointer is PenDrawOnline's, ported as-is. It is deliberately
simple, because every clever addition made it less steady in a real hand.

**On the phone** (`game/tilt.js`): two numbers straight off the
`deviceorientation` event and nothing else. Alpha (turning left and right)
drives x; beta (tipping up and down) drives y. Wherever the phone points when you
press PLAY or Center becomes the middle of the screen. The gains are PenDraw's: a
112-degree turn sweeps the screen edge to edge, a 60-degree tip sweeps it top to
bottom. No accelerometer, no velocity, no filter, no rebuilt rotation matrix.

**On the wire** (`game/net.js`): PenDraw's cadence. It sends at most every 30ms,
and only when the point has moved at least half a percent of the screen, because
anything smaller is the sensor dithering rather than your hand moving. The two
edges of a cast always go through, so a stroke never loses its start or its end.

**On the big screen** (`game/blade.js`): each point is drawn where it lands. No
prediction. A short 16ms ease between packets makes the tip glide instead of
stepping every 30ms, and it never goes past the last real point.

### What this replaced, and why

Earlier versions tried to be cleverer. Each step looked better in simulation and
worse in the hand:

- A **high gain** (5.5) made aiming a twitch of the wrist, and multiplied the
  sensor's own dither just as much. Holding still, the tip jumped up to 4.8% of
  the screen in a single frame.
- **Prediction** drew the tip up to 70ms ahead along a velocity the phone
  estimated from its own readings, to hide the network delay. Every wobble in
  that estimate became a jump of the tip.
- A **rebuilt rotation matrix**, aiming along the back of the phone, is steadier
  if you hold the phone straight up like a microphone. Nobody does here: the cast
  pad and the rune card are on the phone screen, so you tip it back to look at
  them. That is PenDraw's pose, and in it the matrix version was the shaky one.

The price of simple is lag. The tip sits about **116ms** behind your hand, and
80ms of that is the network trip. PenDraw makes the same trade: a tip that is a
little behind is much easier to aim than one that guesses and overshoots.

| Measured over a simulated 80ms wire | Now |
|---|---|
| Worst single-frame move while holding still | **0.18%** of the screen |
| Behind the hand while moving | **116ms** |
| Runes recognised over the wire | **12 / 12** |

### The one pose to avoid

`npm run test:tilt` swings the phone through every angle from flat to upright:

| Held... | Worst step | Visible jumps |
|---|---|---|
| Flat on your palm | 0.005 | 0 |
| Tipped back 45 degrees, looking at the pad | 0.005 | 0 |
| Tipped back 75 degrees | 0.012 | 0 |
| **Dead upright, like a microphone** | **0.35** | **304** |

Standing the phone straight up is where alpha and gamma describe the same
rotation, and alpha stops meaning anything. You would have to turn the phone's
screen away from yourself to get there, so in practice you won't. But if a
future version ever asks players to hold the phone upright, this is where it
breaks, and the test prints it on every run so it can't be forgotten.

**There is no sensitivity slider.** There was one; it only ever let a player
pick a worse number than the measured one.

---

## Music

Open **Music** on the big screen to choose between eight classical recordings,
adjust music volume, or select **No music** while keeping spell effects.
Your track and volume are saved in this browser. Use the arrows to compare tracks,
or open [the listening room and credits](https://emirhan777.github.io/SpellsCast/credits.html).

All included recordings are by Kevin MacLeod (incompetech.com), licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). This permits commercial
use, including monetized games, with attribution. Keep `credits.html`,
`MUSIC-LICENSES.md`, and the `licenses/` notices with distributions. These are
licensed recordings, not a claim that all recordings of these compositions are
public domain. See [MUSIC-LICENSES.md](MUSIC-LICENSES.md) for exact sources.

## The files

| File | What it does |
|------|--------------|
| `game/net.js` | Rooms, join codes, the Firebase relay. **The only file that imports Firebase.** |
| `game/audio.js` | Sound: spell effects synthesised in code, plus eight selectable classical recordings. |
| `game/tilt.js` | Phone orientation → a point on screen: PenDraw's mapping and gains. |
| `game/blade.js` | Easing, the trailing ribbon, and stroke capture. |
| `game/spells.js` | The spellbook and the gesture recogniser. Runes live here. |
| `game/targets.js` | What flies at you, how it falls, and what each spell does to it. |
| `game/engine.js` | The game loop: spawning, physics, cast resolution, scoring, states. |
| `play.html` | The phone: permissions, calibration, the cast pad, the rune card. |
| `index.html` | The big screen: HUD, lobby, QR. |
| `tools/` | Dev server and four test suites. |

### Adding a spell

One edit to `game/spells.js` (a `glyph`, a colour, a score) and one to
`game/targets.js` (something that answers to it). Both screens' rune cards, the
on-target hint and the recogniser all read from the same array, so nothing else
needs touching.

Then run `npm run test:spell`. It prints a cross-talk table; the new rune needs to
sit at least `0.1` past `ACCEPT_DIST` from every existing one, or the two will
trade casts. `createRecognizer()` exists so you can hold several candidate
spellbooks at once and measure them against each other before committing.

### The seam

`engine.js` knows nothing about Firebase. It is fed positions and reports back:

```js
const game = createGame(canvas, { onHud, onState, onCast });
game.addPlayer(pid, slot);                     // a phone connected
game.input(pid, { x, y, vx, vy, cast });       // a sample off the wire
game.inputLocal(pid, x, y, cast);              // a local sample (mouse)
game.start(); game.lobby();
```

`cast` is the thumb. Everything else is unchanged from the platform this was
built on.

---

## First things to change

1. **`GAME_ID` in `game/net.js`** is `"spells"`. Every room is stamped with it and
   controllers refuse rooms belonging to another game, so this project cannot
   collide with anything else sharing the database. It is the only place the name
   lives.

2. **`firebase-config.js` still points at a shared database.** It works today
   with zero setup, but you are sharing a free-tier quota with two other
   projects. Make your own when convenient: Firebase console → new project →
   Realtime Database → paste the config here → publish `firebase-rules.json` to
   it. Nothing else changes.

3. **`localStorage` key** is `spells.best`. That is the only one.

---

## Data model

Everything lives under `rooms/{6-digit code}`:

```
game:          GAME_ID                      # "spells"
status:        "lobby" | "playing" | "over"
players/{pid}: { joinedAt, slot }           # slot 0|1 -> wand colour
input/{pid}:   { x, y, vx, vy, c, t }       # set() ~50Hz, overwritten, never grows
cmd/{pid}:     { type, at }                 # "start" | "again" | "center"
hud:           { score, best, lives, combo, status, spell, castOk }
```

`c` is the cast button: 1 while the thumb is down. It rides on the same node as
the position rather than travelling as its own message, because the screen has to
know exactly *where* the wand was when the stroke opened and closed — a separate
message would arrive out of step and clip the ends off every gesture.

The wand is a cursor, not a log: one node per player, overwritten forever, so an
hour-long session costs the same as a one-minute one.

The room deletes itself when the big screen closes (`onDisconnect`), and each
phone removes its own nodes when it disconnects. Nothing here ever enumerates or
garbage-collects `rooms/`, because other projects live in that tree too.

## Two players

The wire format is already per-player and the engine renders one wand per slot in
a second colour. `MAX_SLOTS` in `game/net.js` is 2, so a second phone scanning the
same QR gets its own wand — and its own casts. A target is claimed the instant a
bolt is fired at it, so two wands cannot both score the same Rogue Mage.

## Deploy

Push to GitHub → **Settings → Pages → deploy from the repo root**. Pages is
https, so the wand works there with nothing running locally — no `npm start`, no
tunnel.

---

Built on the engine from
[FruitNinjaOnline](https://github.com/Emirhan777/FruitNinjaOnline).
