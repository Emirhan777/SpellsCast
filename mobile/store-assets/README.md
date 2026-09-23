# App Store screenshots

Six unedited screenshots from the standalone iOS Release simulator app are in [screenshots/en-US/6.9-inch](screenshots/en-US/6.9-inch/). They were captured and visually checked on September 23, 2026.

- Device: iPhone 17 Pro Max, iOS 26.5.
- Format: 1320 x 2868 pixels, RGB PNG without transparency.
- App: SpellsCast 1.0.0, build 2.
- Bundle identifier: `com.emirhansimsek.spellscast`.
- Locale: English (US).
- Capture order: home, start a game, join a game, Expel practice, Levitate practice, Banish practice.

[Native app build](https://expo.dev/accounts/emirhansimsek_lightning/projects/spellscast/builds/abe0ac39-77f0-4383-86bb-679c29809f7e) compiled and passed screenshot navigation; its final artifact collection failed because of a directory path. [Successful capture job](https://expo.dev/accounts/emirhansimsek_lightning/projects/spellscast/builds/477498db-75ff-4e55-95d6-933f9221d31f) reused that compiled app and collected all six images. The artifact path is corrected in the build configuration.

These files are ready for the 6.9-inch iPhone screenshot slot in App Store Connect. They have not been uploaded. This simulator build does not replace the signed production build required for submission.

See [APP-STORE.md](../APP-STORE.md) for the listing, build and submission steps.
