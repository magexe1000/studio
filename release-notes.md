### Fixed
- Fixed Android 14+ background PackageInstaller confirmation dialog launch block by routing confirmation intents through the active foreground MainActivity.
- Added automatic re-prompt resume logic on app resume to restore blocked confirmation screens.
- Enforced strict installation locks in the JS updater to prevent background polling or resume events from resetting the update state.
- Fixed horizontal layout shifting in DevTools tabs and resolved GSAP animation console warnings.
