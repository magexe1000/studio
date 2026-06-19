import { usePostUpdateChangelog } from '@workspace/studio-core';
/**
 * What's New sheet — shown automatically only after an OTA update.
 * Uses usePostUpdateChangelog to compare the stored last-seen version
 * against the current bundle; the sheet is skipped entirely on every
 * normal launch and only appears when the bundle has actually advanced.
 */

import ChangelogSheet from './ChangelogSheet';

export default function ChangelogModal() {
  const { show, dismiss } = usePostUpdateChangelog();
  return <ChangelogSheet open={show} onClose={dismiss} />;
}
