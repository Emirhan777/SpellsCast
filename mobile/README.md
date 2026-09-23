# SpellsCast for iPhone

A native Expo / React Native wand controller for the [SpellsCast browser game](https://emirhan777.github.io/SpellsCast/). Expo SDK 57, iOS 16.4 or later.

## Try it in Expo Go

From this directory:

```powershell
npm install
npx expo start --go --tunnel
```

1. Install an Expo Go build compatible with SDK 57 on your iPhone: https://expo.dev/go.
2. Sign in to Expo Go with the same Expo account used by the CLI (`npx expo whoami`).
3. Scan the **terminal QR** with the iPhone Camera to open SpellsCast in Expo Go.
4. Open the browser game on a **different screen**.
5. Inside SpellsCast, choose **Join an existing game**, then **Scan the game QR** and scan that screen's QR. Or enter the six-digit room code.
6. Choose motion or touch controls. Hold the cast pad, draw a rune, and release.

The Expo QR opens the app. The game QR pairs your wand. The tunnel URL is temporary and works only while Metro is running. `npx expo start --go --lan` is an alternative when the phone and computer share a reachable Wi-Fi network.

Sound and music play on the big screen. Click the big screen once to enable its audio.

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

App identity: `com.emirhan777.spellscast` (change before the first store submission if needed).
EAS project: https://expo.dev/accounts/emirhansimsek_lightning/projects/spellscast

No Apple signing credentials are stored in this repository.
