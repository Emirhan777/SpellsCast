# App Store screenshots

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
