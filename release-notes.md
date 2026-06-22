### Fixed
- Prevented the visible RootApp ErrorBoundary crash panel from flashing during recoverable Chordex to Hub return transitions.
- Configured RootApp ErrorBoundary to render a neutral dark layout during return sequences, recovering silently.
- Added detailed telemetry logging for RootApp ErrorBoundary catches, recorded under local storage logs.
- Added COPY ROOTAPP ERROR LOG and COPY LAST RECOVERABLE ERROR buttons to Failed Timeline tab.
- Integrated RootApp Error counts, suppression status, and recovery duration diagnostics in Emergency Debug Overlay.
