### Fixed
- Fixed Android 14+ background PackageInstaller confirmation dialog block by launching the confirmation intent using the BroadcastReceiver context with FLAG_ACTIVITY_NEW_TASK.
- Permanently resolved the background activity launch (BAL) restriction on newer Android versions.
- Fully instrumented the updater pipeline with detailed native and JS telemetry logs.
