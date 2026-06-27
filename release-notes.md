### Added
- Resolved Android 14+ background activity start block by configuring explicit ActivityOptions in InstallReceiver.
- Prevented double-download and progress thrashes with strict state-transition guards in the update manager.
- Fully validated system update end-to-end and successfully launched native confirmation dialog.
