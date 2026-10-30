# App Store release preparation

## Multiplayer preview update: 1.2.3 (build blocked, October 31, 2026)

Version 1.2.2 (11) is live with six refreshed screenshots and a 23-second native
on-device gameplay preview. App Store Connect verified all seven assets as
complete on October 31. Its version ID is `dd8ccfe9-5ccd-4ac7-87c8-0bdbda22f724`.

Version 1.2.3 adds a brief native online-duel view to the preview and an online
duel screenshot. All seven screenshots are uploaded and complete; the 28-second
video has uploaded and is processing. Its editable Apple version is
`a93ce427-2ce9-41e1-ad8f-964557f2f3dc`, configured for automatic release after
approval. **This version has not been submitted or published.**
Apple accepted the preview cover at `00:00:09:06`; its poster image is complete.
Final video transcoding remains `PROCESSING`, without reported errors.

EAS rejected the final production build because this account's monthly free iOS
build allowance is exhausted; its reported reset is November 1, 2026. Build
number 12 is reserved remotely but no valid 1.2.3 binary has been delivered to
Apple. The earlier queued build `213cdc5a-9839-42eb-8f6b-3bdab306ebd7` was canceled;
subsequent attempts failed during upload and then at the allowance check.
After the reset or a plan upgrade, build the current source with the production
profile, verify the resulting IPA's version/build, upload it, attach that exact
build to 1.2.3, and submit. Normal automatic incrementing may choose build 13.
The owner chose **wait for the free reset**, with no plan upgrade. No automatic
build or submission has been scheduled.

Capture QA found sideways strokes could invoke iOS back navigation on a
controller opened through an invitation. The index route now disables that
navigation gesture. This change still needs a new native build and a repeat
invitation/casting check before submission. The final video contains only
visually verified gameplay segments from the existing 1.2.2 native app.
Lint, TypeScript and the offline game bundle consistency check pass.

The repository `.easignore` preserves local credential exclusions and excludes
browser music, store media and Git history from native build uploads. An archive
inspection verified the app source, generated offline game, shared engine and
assets remain present; the compressed upload decreased from 190 MB to 655 KB.

The `store-media` EAS profile builds the standalone iOS simulator app, captures
its screens with Maestro, and records real touch-driven gameplay using idb and
`simctl`. `store-media-reuse` repeats capture from a simulator archive provided
through `SCREENSHOT_APP_ARCHIVE_URL` in that build's environment. Capture tools
do not change gameplay or scores. Inspect all footage before uploading.
`store-duel-reuse` runs a real web host and second controller on the same capture
machine, joins the native app, and records actual online casting. Only native
app footage is included in the App Preview.

## Published update: 1.2.1 (build 10)

**Apple status: READY_FOR_DISTRIBUTION**, verified October 30. Submitted
October 26 at 21:29 Istanbul and released automatically after approval.

- Production build: [0d1c0a23-5d99-4c10-b74b-41c42041dcfa](https://expo.dev/accounts/emirhansimsek_lightning/projects/spellscast/builds/0d1c0a23-5d99-4c10-b74b-41c42041dcfa), source commit `70f1ec2`.
- The downloaded signed IPA verifies bundle `com.emirhansimsek.spellscast`, version 1.2.1, build 10, landscape-right support and the invitation UI in its JavaScript bundle.
- Apple upload `c863cd45-1f22-4a60-a9f1-f63b9ada4de0` completed without errors or warnings; the build processed as `VALID`. The queued EAS upload job was canceled before using the direct Apple upload API.
- App Store version ID: `6594fd41-7890-4641-9929-2367171d9e29`. Review submission: `abdf20d3-43c3-4f21-baac-939531244779`.
- Updated release notes, description and review instructions; complete review contact and six existing screenshots retained. Promotional text remains **Turn your phone to a magic wand**.

The source adds **Invite second player** to the connected-room screen and online
wand controls between rounds. It shares the existing room's browser/app join
link, prepares Wizard duel on the host, and retains the first wand while sharing.
Full rooms disable invitations; unavailable sharing falls back to a copy-link
dialog. Short screens use one row of spell cards so casting and invite controls
remain accessible. Offline on-device play is still solo.

This feature is included in live version **1.2.1 (10)**. Lint, typecheck, all twelve
native unit tests, the web export, offline bundle consistency, gameplay tests
and live Firebase relay checks passed. Browser integration verified the same-room
second slot, third-player rejection, host closure and share/copy fallbacks. The
app web preview verified share-related background/return behavior and the 320px
layout. Native iOS share extensions still require a physical iPhone check.

## Published release (October 26, 2026)

- **SpellsCast 1.2.0 (build 9) is live.** App Store Connect confirms `READY_FOR_DISTRIBUTION`, and the public Turkey listing reports version 1.2.0, released October 26 at 16:34 Istanbul time. [App Store](https://apps.apple.com/tr/app/spellscast/id6815057736).
- The signed production build is [9623abe3-5bd5-45af-a412-44bcbe8f2e41](https://expo.dev/accounts/emirhansimsek_lightning/projects/spellscast/builds/9623abe3-5bd5-45af-a412-44bcbe8f2e41), from commit `78471d8`. The downloaded IPA's bundle identifier, version, build number and landscape support were verified. Apple upload `33c56955-e412-49ba-9e75-d92d9015cac6` completed without errors or warnings.
- The release includes offline landscape play, hold-anywhere Tilt casting, direct Finger casting, separate local best scores, spell-to-start/restart, mirroring instructions and Expo SDK 58. Listing, review notes, help and privacy content were updated. Promotional text remains **Turn your phone to a magic wand**.
- Eleven native unit tests, lint, typecheck, offline bundle consistency and iOS bundle export passed. Real simulator navigation reached the on-device game's opening instructions. Physical motion direction and AirPlay/HDMI still require device verification.
- Six refreshed portrait screenshots are archived under `store-assets/screenshots/1.2.0/`; they were not uploaded by this session. A blank landscape capture was rejected during visual inspection. The final retake job was canceled when the published release was confirmed. No blank screenshot was uploaded.

## Expo Go compatibility update (October 25, 2026)

Version 1.2.0 uses Expo SDK 58 with matching React Native, React and native module versions. Update Expo Go from the iPhone App Store before scanning a development QR.

## Landscape play (introduced October 20; released in 1.2.0)

**Play on this device** now opens a full-screen landscape game. **Tilt** is the default mode: hold anywhere on the game screen, tilt through a rune, then release; Center wand recalibrates. **Finger** mode draws directly on the game canvas. There is no local start button or dedicated cast button: a recognized spell starts or restarts a round. Permission approval or a tap alone does not start play. Switching modes starts a new round after confirmation. Tilt best and Finger best save independently in local device storage, including points earned before leaving or switching modes. Online Classic/duel scores remain separate.

Mirror opens the AirPlay/HDMI guide. The TV mirrors the landscape game; display borders depend on its aspect ratio and mirroring settings. Backgrounding pauses local play and discards incomplete strokes. The game screen hides the status bar; menus and online controller remain portrait.

This update is included in published version **1.2.0 (9)**. Version 1.1.0 (6) predates these features. Native lint, typecheck, unit tests, iOS bundle export and simulated landscape casting/mode isolation checks passed. Physical iPhone motion direction and AirPlay/HDMI still need verification.

## Historical submission status (October 9, 2026)

- Apple confirms **1.0.1 (5)** is the currently published release.
- Multiplayer update **1.1.0 (6)** built successfully, was verified for bundle `com.emirhansimsek.spellscast`, uploaded without errors or warnings, processed as `VALID`, and attached to version 1.1.0. [EAS production build](https://expo.dev/accounts/emirhansimsek_lightning/projects/spellscast/builds/dc33f3d2-14ab-4bd6-ad75-6b9e2cb97ba9).
- **Submitted October 9, 2026; Apple status: WAITING_FOR_REVIEW.** Review submission ID: `30dd95b0-11c4-4752-a4f4-7115b601104f`. The update will release automatically after approval (`AFTER_APPROVAL`); it is not live yet.
- Saved multiplayer description, release notes, keywords, support URL, review instructions and complete review contact. Promotional text remains **Turn your phone to a magic wand**. Six existing native screenshots are attached.
- Native lint, typecheck, all nine unit tests and live Firebase relay checks passed. The two-phone browser integration verified timed scoring, results, rematches and disconnects. Physical iPhone latency has not been measured for this release.

## Multiplayer update (October 9, 2026)

The browser now offers **Wizard duel** with two separate wizard scores and 60, 90, 120 or 180-second matches. The first correct cast received by the host claims a target for one point; the highest score wins when time expires, with ties shown as draws. The native source displays each player's own score, opponent score, timer and result. Production version **1.1.0 (6)** includes these changes and is waiting for Apple review. Version 1.0.1 (5) predates the duel HUD.

## Wand responsiveness update (September 25, 2026)

The source now shares a 16 ms movement sender with the browser controller, flushes the last pending position when movement stops, and limits link-pairing subscriptions to launch data. Cast press/release events send immediately. Automated steadiness, spell recognition, live Firebase and shared-link checks pass; physical iPhone latency still needs testing.

This fix is included in production version **1.0.1 (5)**. Version 1.0.0 (3) predates the fix.

## Historical release preparation (September 25, 2026)

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

The version 1.1.0 listing and release notes are prepared in `store.config.json`. The promotional text is exactly **Turn your phone to a magic wand**. `store-review-notes.txt` explains the companion-screen requirement and offline review mode.

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
