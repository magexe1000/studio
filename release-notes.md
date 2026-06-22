### Added
- Upgraded StudioHub to mount synchronously and permanently, eliminating Suspense-induced unmounts.
- Improved the failsafe watchdog to run active DOM restoration at T+50ms, T+100ms, T+250ms, and T+500ms checkpoints.
- Added comprehensive report export options to Failed Timeline (Full Report, Timeline JSON, Summary, Checkpoints, and Recovery Log).
- Fixed the header version display to dynamically show both the current runtime and captured timeline versions.
