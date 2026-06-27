### Added
- Implemented smart HTTP resume and partial downloadRange writing for interrupted updates.
- Added prioritized mirror failovers (GitHub Release -> Firebase Hosting -> Official Mirror).
- Created Failsafe Direct intent installer bypass using FileProvider URIs to override PackageInstaller session blocks.
- Added Recovery Mode overlay displaying version details, diagnostics log compile, and manual copy/share actions.

### Fixed
- Resolved checking for updates regression where modal would show stuck 0% download progress.
- Aligned Hub bottom navigation auto-hide animation with the rest of Studio.
