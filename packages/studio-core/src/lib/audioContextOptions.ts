import { useChordStore } from '../store/useChordStore';

export function getAudioContextOptions(): AudioContextOptions {
  try {
    const s = useChordStore.getState().settings;
    return s.lowLatencyMode ? { latencyHint: 'interactive' } : { latencyHint: 'balanced' };
  } catch {
    return {};
  }
}

export function createAudioContext(): AudioContext {
  const AC = (window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  return new AC(getAudioContextOptions());
}
