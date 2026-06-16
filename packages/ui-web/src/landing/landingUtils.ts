export function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return `(${mb.toFixed(1)} MB)`;
}

export const SPRING_CONFIGS = {
  slow: { stiffness: 80, damping: 20 },
  normal: { stiffness: 120, damping: 18 },
  fast: { stiffness: 150, damping: 15 }
};
