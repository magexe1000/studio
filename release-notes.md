### Fixed
- Completely eliminated minified React errors from the Engineering Lab and DevTools by implementing an automatic inline React error decoder.
- Upgraded the global Error Boundary to capture full component Fiber contexts, including props, states, and hook dependency stacks.
- Prevented potential TypeError rendering crashes during initial Hub load by adding a robust translation fallback for the settings namespace.
