### Fixed
- Fixed Android 14+ background PackageInstaller confirmation dialog launch block by routing the session callback through a Broadcast PendingIntent targeting InstallReceiver.
- Prevented duplicate update checks by implementing a synchronous promise-reuse lock in checkForUpdate.
- Enhanced native and JS updater tracing to log full stack traces, threads, callers, and timestamps.
- Fixed horizontal layout shifting in DevTools tabs and resolved GSAP animation console warnings.
