### Added
- Added multi-stage signature mismatch recovery featuring automated cache clearing, session recreation, and PendingIntent resets.
- Added direct GitHub Release package installation with SHA-256 integrity checks and signing certificate verification.
- Added detailed error dialogs containing technical/human explanations, detected cause, and current/latest version comparison.

### Fixed
- Fixed updater state machine overwrite issues to ensure signature mismatch and version checks are preserved.
