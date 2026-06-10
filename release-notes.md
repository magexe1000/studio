### Fixed
- Fixed issue where the web application would get stuck on old versions and fail to load updates.
- Implemented auto-cleanup of legacy push service worker instances to clear stale browser caches.
- Optimized Firebase Hosting caching configuration to prevent caching of index.html and service workers.
