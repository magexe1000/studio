### Added
- Added Paint Verification using html2canvas to Navigation Forensics.
- Added Force WebView Repaint recovery action with multiple visual repaint cycles.
- Added Force Full Hub Rebuild recovery action to remount the Hub subtree with a new React key.
- Added Force WebView Refresh Layer compositor invalidation recovery action.
- Added automated timing forensic snapshots at LEAVING_CHORDEX, ENTERING_HUB, T+500ms, and T+2000ms.
- Integrated paint validation into the 1200ms return watchdog to detect and record compositor freeze errors automatically.
