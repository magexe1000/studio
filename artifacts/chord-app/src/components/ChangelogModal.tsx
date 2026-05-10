/**
 * What's New sheet — opens on every app launch.
 * Dismissing it closes it for the current session only;
 * it will reappear the next time the app is opened.
 */

import { useState } from 'react';
import ChangelogSheet from './ChangelogSheet';

export default function ChangelogModal() {
  const [open, setOpen] = useState(true);
  return <ChangelogSheet open={open} onClose={() => setOpen(false)} />;
}
