### Added
- Upgraded the root React app tree structure to render EmergencyDebugOverlay at root level.
- Refactored App.tsx layout to keep the outer app-container permanently mounted, preventing root-level unmounts.
- Integrated LifecycleTracker logging to record component mount/unmount stack traces and Suspense fallback states.
- Implemented ROOT_APP_TREE_MISSING and HUB_DOM_NOT_MOUNTED diagnostics to isolate rendering failures.
- Added COPY ROOT LIFECYCLE LOG and COPY MOUNT/UNMOUNT STACKS buttons to Failed Timeline tab.
