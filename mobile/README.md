# SpellsCast for iPhone

A native Expo / React Native wand controller for the [SpellsCast browser game](https://emirhan777.github.io/SpellsCast/). Expo SDK 58, iOS 16.4 or later.

## Play on this device

Choose **Play on this device** on the home screen or under **Start a game**.
The Classic game fills the landscape screen. There is no separate drawing pad.
Menus and the online wand controller remain portrait.

- **Tilt mode** is selected by default. Hold anywhere on the game screen, allow
  motion if asked, tilt through one of the displayed runes, then release. A valid
  spell starts the round; a tap or incomplete rune does not. There is no start
  button or dedicated cast button. During play, hold anywhere to cast. Use
  **Center wand** to recenter; menu controls remain tappable.
- **Finger mode** draws directly on the game screen. Lift to cast; a recognized spell starts the round. Selecting a
  different mode during a round asks to end the run and reset the score.
- **Tilt best** and **Finger best** are independent. Best scores save as you earn
  points, including when leaving or switching mid-run. Cast another spell after
  game over to play again. The iOS app persists them
  in local device storage; the web preview uses browser storage. Existing Classic
  and online scores are not imported into either mode.

Tap **Mirror** for AirPlay and HDMI instructions. On iOS, open Control Center ?
Screen Mirroring and choose a compatible screen. Return to SpellsCast and tap
**Resume game**. Tilt recenters on resume. The TV mirrors the landscape game;
its borders depend on the TV aspect ratio and mirroring settings. Wireless
mirroring may add display delay. Local play pauses while opening the guide or
leaving the foreground, and interrupted strokes do not cast.

No QR, room, second device or internet is needed for local play. Wizard duel
remains a separate-screen mode. Local play is available in App Store version
**1.2.0 (9)**; version 1.1.0 (6) predates it. Expo Go supports the
required modules. Test both landscape motion and mirroring on a physical iPhone.

After changing game code, run `npm run build:device-game`;
`npm run check:device-game` verifies the generated bundle. Production builds
regenerate the offline bundle automatically.

## Invite a second player online

Connect your wand to an open game, then tap **Invite second player** on the
connected screen or wand controls before a round. The share sheet sends that
room's player link and prepares the screen for **Wizard duel**. The recipient
can play in their browser or choose **Open in SpellsCast** to use the iOS app.
Keep the game screen open; the link joins that room rather than starting a new one.
Once both players connect, choose **Start duel**.

Sharing keeps your wand connected while the share sheet is open. A real network
disconnect still requires reconnecting. Full rooms disable invitations, and
invitations are hidden during a round. If sharing is unavailable, the app offers
a selectable link and **Copy invite link**. The offline on-device game has no
online room to invite players into.

The invite button is in the development source and is not included in published
App Store version **1.2.0 (9)**.

## Try it in Expo Go

From this directory:

```powershell
npm install
npx expo start --go --tunnel
```

1. Update Expo Go from the iPhone App Store. This project uses SDK 58: https://expo.dev/go.
2. Sign in to Expo Go with the same Expo account used by the CLI (`npx expo whoami`).
3. Scan the **terminal QR** with the iPhone Camera to open SpellsCast in Expo Go.
4. Choose **Play on this device** to play locally. For connected play, open the browser game on a **different screen**.
5. Inside SpellsCast, choose **Join an existing game**, then **Scan the game QR** and scan that screen's QR. Or enter the six-digit room code.
6. Choose motion or touch controls. Hold the cast pad, draw a rune, and release.

The Expo QR opens the app. The game QR pairs your wand. The tunnel URL is temporary and works only while Metro is running. `npx expo start --go --lan` is an alternative when the phone and computer share a reachable Wi-Fi network.

Sound and music play on the big screen. Click the big screen once to enable its audio.

For a timed two-player match, select **Wizard duel** and its length on the big
screen, then join the same QR/room from both phones. The updated controller shows
your wizard number, your score, the opponent's score, time remaining and the
winner. Tap **Start duel** once both wizards are connected, or **Rematch** after
the result. The duel HUD is included in version 1.1.0 (6), submitted to Apple and waiting
for review. The published 1.0.1 (5) binary predates the duel HUD.

## Start a game from the app

Choose **Start a game** on the home screen:

- **Create a game link**, then **Send game link** opens the iOS share sheet for Messages, Mail, AirDrop to a Mac, and other installed sharing apps. **Copy game link** is also available.
- Open that link on a computer or TV and select **Open game on this screen**. Return to the iPhone app; it pairs automatically and offers motion or touch controls. Tap **Start game** after choosing controls.
- **Copy website address** and **Share website address** send the ordinary game homepage. Open it on the other screen, then choose **The game is open — join it** for QR/code pairing.
- Expand the TV browser, computer-to-TV HDMI, or Mac AirPlay guides for device-specific steps. The current website address is displayed; no custom short domain is configured.

The automatic link is valid for ten minutes and one screen. Going back or replacing it cancels an unused link; cancelling after a screen claims it does not delete the running game. Returning from the share sheet resumes pairing. Links that have expired or already been used cannot open a second host.

Pending links reserve a room with `status: waiting-screen` and an expiring launch token. The screen claims it atomically, then takes over normal room cleanup. The app removes unused reservations on cancellation or expiry while running; an abrupt app termination can leave an expired reservation in the database. Expiry prevents its use but does not provide server-side garbage collection. Launch tokens distinguish handoffs within the existing anonymous room relay; they are not an authentication boundary.

## Included

- Native camera QR scanner and manual code entry.
- Native Core Motion via Expo DeviceMotion, with the browser game's calibration and gains.
- Hold-to-cast, immediate release packets, haptic feedback, and touch controls.
- Shared spell glyphs and recognition from `../game/spells.js`; no duplicated spellbook.
- Score, lives, spell feedback, Center wand, Start, and Play again.
- Offline practice for all four runes, without a room or camera.
- Room validation, capacity handling, cancelled joins, connection loss, and cleanup on background/leave.
- Original vector app icon, camera/motion permission messages, support and privacy pages.

The app is a native controller. It does not embed the browser player in a WebView.

## Deep links

Standalone and development builds register:

```
spellscast://join?room=123456
```

The browser controller has an **Open in SpellsCast** link for an installed build. Expo Go does not register this custom scheme; use the in-app scanner or manual code there. HTTPS universal links are not configured: those require a verified domain and Apple association file.

## Development

```powershell
npm run typecheck
npm run lint
npm test
npm run test:relay
npx expo-doctor
npx expo export --platform ios --output-dir dist-ios
```

`test:relay` explicitly uses the configured Firebase database, creates an unused temporary room, checks pairing and packets, and removes the room. The other tests run locally. `expo export` validates the iOS JavaScript/Hermes bundle; it is not a signed iOS binary or a substitute for testing the device camera and motion sensors.

Metro watches the parent directory to share the game code and Firebase configuration. Keep `mobile/` inside this repository. Run EAS builds here so the repository's shared files are included.

## App Store

See [APP-STORE.md](APP-STORE.md) for signing, TestFlight, store metadata, review instructions, and remaining device checks.

App identity: `com.emirhansimsek.spellscast` (change before the first store submission if needed).
EAS project: https://expo.dev/accounts/emirhansimsek_lightning/projects/spellscast

No Apple signing credentials are stored in this repository.
