# App Store release preparation

## Build and signing

The app is linked to `@emirhansimsek_lightning/spellscast`. EAS profiles are configured in `eas.json`.

```powershell
npx eas-cli@latest login
# Optional development build for a registered iPhone.
npx eas-cli@latest build --platform ios --profile development
# After installing that development build:
npx expo start --dev-client --tunnel

# App Store / TestFlight binary: requires Apple Developer membership and signing.
npx eas-cli@latest build --platform ios --profile production
# Upload the completed binary to App Store Connect / TestFlight.
npx eas-cli@latest submit --platform ios --profile production
```

Run commands from `mobile/`. EAS can build iOS from Windows. Let EAS manage signing, or provide your team's credentials when prompted. The bundle identifier is `com.emirhan777.spellscast`; confirm ownership before your first App Store Connect app record. The production profile increments build numbers automatically.

Submitting a build uploads it; completing metadata and requesting Apple review are separate App Store Connect steps. No signed binary has been built or submitted as part of this source implementation.

## Suggested store listing

- **Name:** SpellsCast
- **Subtitle:** Your phone becomes a wand
- **Primary category:** Games
- **Secondary category:** Entertainment
- **Support URL:** https://emirhan777.github.io/SpellsCast/support.html
- **Privacy policy:** https://emirhan777.github.io/SpellsCast/privacy.html
- **Keywords:** wand,spells,magic,motion,party,controller,runes

### Description

Turn your iPhone into a magic wand. Open SpellsCast on a computer or TV browser, scan its QR code, and cast spells with the movement of your hand.

Start right from the app: send a game link to your computer using your favorite sharing app or AirDrop to a Mac. Open it on your big screen and your iPhone connects automatically. Built-in guides help you set up a TV browser, HDMI connection, or AirPlay from a Mac.

Hold the cast pad, draw a rune in the air, and release. Expel rogue mages, levitate feathers, banish ghosts, and shatter serpents. Your score and lives stay visible on your phone.

Prefer touch controls? Draw the runes directly on the pad. Learn all four spells in offline practice before joining a game.

Features:

- Scan a QR code or enter a room code to connect.
- Aim with motion controls and recenter at any time.
- Feel your casts with haptic feedback.
- Learn the spellbook in offline practice.
- Join a shared game with up to two wands.

Connected play requires an internet connection and another screen with a web browser. Open https://emirhan777.github.io/SpellsCast/ on that screen. No player account is required.

### Review notes

This app controls the companion browser game and includes standalone offline rune practice. No login is required.

1. On a computer, open https://emirhan777.github.io/SpellsCast/ and leave it open.
2. On the iPhone app, choose Join an existing game, then Scan the game QR. Grant camera permission and scan the QR on the computer. Alternatively, enter the six-digit room code.
3. Choose Use motion wand and grant motion access, or choose Use touch controls.
4. Tap Start game. Hold the pad and move the phone through a rune, then release; in touch mode, draw on the pad.
5. To test without another screen or sensors, choose Practice your spells on the home screen.

Audio plays on the computer after clicking its page once. The app's camera is only a QR scanner. The phone and computer can use different internet connections. Rooms expire when the computer page closes.

To test starting from the app, choose Start a game → Create a game link → Send game link (or Copy game link). Open the link on a computer and select Open game on this screen. Return to the iPhone app; it connects without scanning a QR. Choose a control mode and tap Start game. The ordinary website-sharing and TV setup options are also under Start a game.

## Before requesting review

- Test on a real iPhone: scan a real game QR, check motion direction/centering, cast all four spells, verify haptics, deny/re-enable permissions, lock/unlock mid-cast, and disconnect/reconnect the network.
- Test Messages/Mail/AirDrop sharing, cancelling the share sheet, copying both links, returning from another app, backgrounding while the screen claims a link, expiry, and abandoning/replacing a pending link. Confirm that only one screen can claim a link.
- Check the small-screen layout and larger system text sizes on physical devices.
- Create accurate screenshots from the standalone iOS app; browser screenshots in the local verification folder are development evidence, not App Store screenshots.
- Complete age-rating, content-rights, export-compliance, pricing, and availability questions based on the final release. No purchases or ads are implemented.
- Review the published privacy policy and complete Apple's App Privacy questionnaire based on the final app and your Firebase service configuration. The app relays anonymous session identifiers, wand coordinates, cast state, commands and HUD data. It does not upload camera images, record audio, or include analytics/advertising SDKs. Consider backend processing and retention under Apple's definitions when answering.
- Supply an App Review contact in App Store Connect. Support currently uses the repository's public issue tracker; change it if you prefer a support email or site.
- If adding accounts, monetization, analytics, or other services later, revisit the permissions, privacy disclosures, and review requirements.

Apple's approval is a separate review; the configuration and successful JavaScript checks do not guarantee acceptance.

References: https://docs.expo.dev/deploy/build-project/ and https://developer.apple.com/app-store/review/guidelines/
