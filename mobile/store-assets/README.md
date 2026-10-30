# App Store screenshots

## Version 1.2.3 multiplayer preview (October 31, 2026)

[The 28-second preview](1.2.3/123-gameplay-preview.mp4) shows 23 seconds of actual
on-device Finger gameplay followed by five seconds of the native online-duel
controller. The multiplayer ending uses two real casting excerpts, with a
short explanatory caption beside the portrait app. Both players joined a real
Firebase room. The second controller and host ran in a browser; only native
iOS app footage appears in the preview.

The six 1.2.2 screenshots are retained, with [a seventh screenshot](1.2.3/123-07-online-duel.png)
showing a real online Expel stroke, opponent score and timer. Native capture
job `67876606-b9eb-476e-9f4a-7486c65bdad1` supplied the multiplayer footage. All
captured views use the standalone 1.2.2 simulator app; the controls and artwork
shown remain the same in the prepared 1.2.3 source.

The final video is 1920 x 886, 30 fps, H.264 High/level 4.0, SDR Rec.709, with
silent AAC stereo at 48 kHz. All final images and representative video frames
were visually checked, including the multiplayer cuts; the entire video decoded
without errors. [The manifest](1.2.3/manifest.json) records checksums, exact cuts
and provenance. No game state, score, target or timing was overridden.

Seven screenshots and the video are uploaded to the editable 1.2.3 version.
Publication is blocked by the Expo build allowance; see [APP-STORE.md](../APP-STORE.md)
for current processing and submission status.

## Version 1.2.2 screenshots and gameplay preview (October 30, 2026)

[The current media set](1.2.2/) contains six screenshots and a 23-second
[gameplay preview](1.2.2/122-gameplay-preview.mp4). The first three images show
actual Finger-mode gameplay; the remaining images show Tilt instructions, the
home options, and offline spell practice.

The footage was captured from the standalone 1.2.2 iOS app on an iPhone 18 Pro
Max simulator running iOS 27.0. Real touch strokes start the game and cast its
runes; no gameplay or scores were overridden. The preview shows a continuous
23-second section of that recording, resized to 1920 x 886 at 30 fps with
H.264 High/level 4.0 encoding and SDR Rec.709 color. Sound was off in the app;
the exported video has a silent AAC stereo track and no added music.

Screenshots are RGB PNGs at 2868 x 1320 or 1320 x 2868. Video frames were used
for the three action screenshots; the other views came from native screenshots.
All six images and representative video frames were visually inspected, and
the complete encoded video decoded successfully. [The manifest](1.2.2/manifest.json)
records dimensions, checksums, capture jobs and the signed production build.

Xcode 27 uses Device Hub in place of Simulator.app. The capture launcher detects
both. The recording uses idb accessibility controls to select Finger mode and
HID touch events to draw. For current upload and review status, see
[APP-STORE.md](../APP-STORE.md).

## Version 1.2.0 capture (October 25, 2026)

Six refreshed portrait screenshots are archived in [screenshots/1.2.0/en-US/6.9-inch](screenshots/1.2.0/en-US/6.9-inch/). They are unedited 1320 x 2868 RGB PNGs from an iPhone 18 Pro Max simulator, captured from the standalone 1.2.0 simulator app compiled by build `dd678cb8-d20d-422d-986b-d06fd0a56098`. Capture job `c283be61-90a9-435b-863a-c61e20ef47e9` reused that app. Provenance is stored with the images.

These images were visually checked but were not uploaded by this session. The landscape image was a blank frame and was discarded. A follow-up capture job was canceled after Apple confirmed version 1.2.0 (9) was already live. The capture workflow now waits for rotation and adds a final simulator screenshot; that final retake remains unverified.

## Original screenshots (September 23, 2026)

Six unedited screenshots from the standalone iOS Release simulator app are in [screenshots/en-US/6.9-inch](screenshots/en-US/6.9-inch/). They were captured and visually checked on September 23, 2026.

- Device: iPhone 17 Pro Max, iOS 26.5.
- Format: 1320 x 2868 pixels, RGB PNG without transparency.
- App: SpellsCast 1.0.0, build 2.
- Bundle identifier: `com.emirhansimsek.spellscast`.
- Locale: English (US).
- Capture order: home, start a game, join a game, Expel practice, Levitate practice, Banish practice.

[Native app build](https://expo.dev/accounts/emirhansimsek_lightning/projects/spellscast/builds/abe0ac39-77f0-4383-86bb-679c29809f7e) compiled and passed screenshot navigation; its final artifact collection failed because of a directory path. [Successful capture job](https://expo.dev/accounts/emirhansimsek_lightning/projects/spellscast/builds/477498db-75ff-4e55-95d6-933f9221d31f) reused that compiled app and collected all six images. The artifact path is corrected in the build configuration.

All six files were uploaded and processed successfully in the 6.9-inch iPhone screenshot slot in App Store Connect on September 23, 2026. Store order is home, Expel practice, start a game, join a game, Levitate practice, Banish practice. The signed production version 1.0.0 build 3 has also been uploaded and attached to the store version; App Review submission is still pending.

See [APP-STORE.md](../APP-STORE.md) for the listing, build and submission steps.
