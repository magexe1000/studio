// Capacitor plugin definition for PredictiveBackPlugin (Android 14+).
// On platforms where the native plugin is unavailable (web, iOS, Android < 14),
// the addListener calls resolve to a no-op and no events are ever fired.

import { registerPlugin } from '@capacitor/core';
import type { Plugin } from '@capacitor/core';

export interface BackProgressData {
  /** 0.0 (gesture just started) → 1.0 (fully committed) */
  progress: number;
  /** Touch X position in screen pixels */
  touchX: number;
  /** Touch Y position in screen pixels */
  touchY: number;
  /** Which edge the swipe originated from */
  edge: 'left' | 'right';
}

export interface PredictiveBackPlugin extends Plugin {
  setEnabled(options: { enabled: boolean }): Promise<void>;
  addListener(
    eventName: 'backStarted',
    listenerFunc: (data: BackProgressData) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: 'backProgressed',
    listenerFunc: (data: BackProgressData) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: 'backCancelled',
    listenerFunc: () => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

export const PredictiveBack = registerPlugin<PredictiveBackPlugin>('PredictiveBack');
