### Fixed
- Fixed update check hangs by implementing a strict timeout race in version metadata queries.
- Enhanced updater diagnostics by prefixing error messages with the exact failing stage (e.g., Download, SHA Verification, Eligibility, PackageInstaller).
- Replaced JS alert popups with native themed modal states for up-to-date and failure outcomes.
- Upgraded the failed state retry button to dynamically retry update checks or downloads.
