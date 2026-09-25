# App Store release preparation

## Wand responsiveness update (September 25, 2026)

The source now shares a 16 ms movement sender with the browser controller, flushes the last pending position when movement stops, and limits link-pairing subscriptions to launch data. Cast press/release events send immediately. Automated steadiness, spell recognition, live Firebase and shared-link checks pass; physical iPhone latency still needs testing.

This fix is included in production version **1.0.1 (5)**. Version 1.0.0 (3) predates the fix.

## Current release status (September 25, 2026)

- App Store Connect record: [SpellsCast, Apple ID 6815057736](https://appstoreconnect.apple.com/apps/6815057736/distribution/ios/version/inflight).
- App Store Connect confirms that **1.0.0 (3)** is live (`READY_FOR_DISTRIBUTION`).
- Production version **1.0.1 (5)** has built successfully from commit `fb6bfbb`, uploaded to Apple, processed as `VALID`, and been attached to the 1.0.1 update. It is available to internal TestFlight testers (`IN_BETA_TESTING`). [EAS production build](https://expo.dev/accounts/emirhansimsek_lightning/projects/spellscast/builds/e0ae0e0f-c91a-4a09-8478-6f7fa1826a8f).
- Delivery used Apple's direct Build Upload API after the EAS submission remained queued. That queued EAS submission was canceled. Apple upload `07b2b2a2-3c6a-4ed1-a3ce-ecf3f52aace7` completed with no errors or warnings. The downloaded IPA's bundle identifier, version and build number were verified before upload.
- The 1.0.1 entry has the wand-responsiveness release notes, exact promotional text, six inherited screenshots and a complete private App Review contact.
- The English listing, exact promotional text, six native screenshots, review instructions, categories, content rights and age-rating questionnaire are saved. The primary calculated age rating is **13+**, with regional variations.
- App Privacy responses are published: Gameplay Content for app functionality, not linked to identity; Other Diagnostic Data for app functionality, linked to identity because Firebase retains technical connection information including IP addresses. Neither is used for tracking. See [Firebase's retention information](https://firebase.google.com/support/privacy) and [Apple's disclosure definitions](https://developer.apple.com/app-store/app-privacy-details/).
- Availability is configured for 173 countries or regions. China mainland and Vietnam are excluded pending their game licensing requirements. Apple silicon Mac and Vision Pro distribution are disabled for this phone-controller release.
- Automatic release after Apple approval is selected. **The 1.0.1 update is in Prepare for Submission; this update has not been submitted for review or published.**

## Release assets

The version 1.0.1 listing and release notes are prepared in `store.config.json`. The promotional text is exactly **Turn your phone to a magic wand**. `store-review-notes.txt` explains the companion-screen requirement and offline review mode.

Six verified native iPhone screenshots are available in [store-assets/screenshots/en-US/6.9-inch](store-assets/screenshots/en-US/6.9-inch/). They are 1320 x 2868 RGB PNGs captured from the standalone Release app on an iPhone 17 Pro Max simulator. [Capture details](store-assets/README.md) record the source builds. All six screenshots are uploaded and processed in App Store Connect.

`store.config.js` merges optional review contact details from the ignored `store.local.json` file. Keep the review phone number, email and any Apple credentials out of the public repository. After Apple authentication is configured, upload metadata from this directory with:

```powershell
npx eas-cli@latest metadata:push --profile production
```

Real iOS screenshots are generated with a Release simulator build and Maestro, without altering the app's UI:

```powershell
npx eas-cli@latest build --platform ios --profile screenshots
```

The job selects an available iPhone Pro Max simulator, sets the status bar to 9:41, and captures the home, game setup, joining, and spell-practice screens. Download the build-artifact archive from the build page. Inspect every screenshot and verify its dimensions before uploading to App Store Connect. `screenshots-reuse` can repeat capture using an existing simulator application archive supplied as `SCREENSHOT_APP_ARCHIVE_URL` in that build's environment.

Prepared metadata is not confirmation of submission. Apple authentication, a signed production build, the App Review contact, pricing/availability, current age-rating questions and App Privacy declarations must be completed in the actual App Store Connect record before review can be submitted.

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

Run commands from `mobile/`. EAS can build iOS from Windows. Let EAS manage signing, or provide your team's credentials when prompted. The bundle identifier is `com.emirhansimsek.spellscast`; confirm ownership before your first App Store Connect app record. The production profile increments build numbers automatically.

Submitting a build uploads it; completing metadata and requesting Apple review are separate App Store Connect steps. See the current release status above for the latest build.

## Suggested store listing

- **Name:** SpellsCast
- **Subtitle:** Your phone becomes a wand
- **Promotional text:** Turn your phone to a magic wand
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
