### Fixed
- Completed the signing reset path for builds where the original production keystore is unavailable.
- Added explicit reinstall-required metadata for APKs signed with the new certificate.
- Improved updater messaging when Android cannot install over an app signed with a different certificate.

### Improved
- Added safer release handling for signing certificate changes.
- Improved AppInstaller diagnostics for reinstall-required builds.
- Preserved strict signature validation for normal future updates.

### Changed
- This build requires a one-time uninstall/reinstall because the original Android signing key is unavailable. After reinstalling this version, future Studio updates can continue using the new signing certificate.
