### Added
- Added pre-deploy signature verification check preventing deployment of incorrectly signed or debug-signed APK packages to Firebase Hosting CDN channels.
- Added dynamic authoritative expected signature validation resolving directly from app version configuration files.
- Improved updater checking by validating signature fingerprints in release metadata to block mismatching packages before downloading.
- Added detailed troubleshooting diagnostics fields including certificate subject and issuer, validation stage, exact failing stage, root cause, and suggested fixes in the signature mismatch UI.
