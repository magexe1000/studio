/**
 * Post-update flow:
 *
 *   When the user opens the app for the first time after an OTA bump,
 *   the changelog sheet opens AUTOMATICALLY — no intermediate "you just
 *   updated" toast, no extra tap. The sheet itself shows the version
 *   pill and the bullet list of changes at the top, which is exactly
 *   what we want the user to land on.
 *
 *   Dismissing the sheet (swipe down, tap backdrop, or close button)
 *   marks the new version as "seen" via `usePostUpdateChangelog`'s
 *   `dismiss()`, so it never re-appears for this version.
 *
 * State is tracked in localStorage by `lib/otaUpdate` (`usePostUpdateChangelog`)
 * so the sheet doesn't re-appear unless the bundle advances again.
 *
 * Mounted at the App root so it overlays whichever sub-app the user
 * is on at launch.
 */

import { usePostUpdateChangelog } from '../lib/otaUpdate';
import ChangelogSheet from './ChangelogSheet';

export default function ChangelogModal() {
  const { show, dismiss } = usePostUpdateChangelog();

  // Drive the sheet's `open` prop directly off `show`. The sheet
  // handles its own mount/unmount animation so we don't need the
  // intermediate "toast" anymore.
  return <ChangelogSheet open={show} onClose={dismiss} />;
}
