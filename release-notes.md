### Fixed
- Resolved the "Check for updates" regression that opened the updater dialog prematurely and showed a stuck 0% progress screen.
- Restored the theme-aware, animated top-right update indicator pill/badge z-index so it doesn't render behind other elements.

### Added
- Implemented Version Manager UI under settings, allowing users to downgrade to the previous stable release (v3.7.0) or one version prior (v3.6.99).
- Added Update History tracking, recording all transition states locally in a persistent log.
- Upgraded the PackageInstaller to call setRequestDowngrade(true) to support downgrades with matching signing signatures.
