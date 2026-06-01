// Predictive Back bridge — Android 14+ gesture progress → CSS + JS listeners.
//
// On Android 14+ with our native PredictiveBackPlugin:
//   • As the user drags the back gesture, backStarted / backProgressed fire.
//   • :root gets class `predictive-back-active` and CSS vars are set:
//       --back-progress  : 0.0 – 1.0
//       --back-edge      : -1 (left swipe) or 1 (right swipe)
//   • A translucent dim overlay is injected over the whole screen so the
//     gesture visually "peels" the screen away.
//   • On cancel the overlay fades back; on completion Capacitor fires the
//     normal `backButton` event which the existing back stack handles.
//
// On Android 13 / web / iOS:
//   • The plugin is unavailable → this module silently does nothing.
//   • Android 13 already shows the system-level window-scale predictive back
//     preview thanks to `android:enableOnBackInvokedCallback="true"`.

export interface BackProgressEvent {
  progress: number;
  touchX: number;
  touchY: number;
  edge: 'left' | 'right';
}

type ProgressListener = (e: BackProgressEvent) => void;
type SimpleListener = () => void;

const _startedListeners   = new Set<ProgressListener>();
const _progressListeners  = new Set<ProgressListener>();
const _cancelledListeners = new Set<SimpleListener>();

/** Subscribe to backStarted (user begins the swipe). */
export function onBackStarted(fn: ProgressListener): () => void {
  _startedListeners.add(fn);
  return () => _startedListeners.delete(fn);
}

/** Subscribe to backProgressed (called on every animation frame during swipe). */
export function onBackProgress(fn: ProgressListener): () => void {
  _progressListeners.add(fn);
  return () => _progressListeners.delete(fn);
}

/** Subscribe to backCancelled (user released without completing the gesture). */
export function onBackCancelled(fn: SimpleListener): () => void {
  _cancelledListeners.add(fn);
  return () => _cancelledListeners.delete(fn);
}

// ── Internal helpers ─────────────────────────────────────────────────────────

export function applyCssProgress(progress: number, edge: 'left' | 'right') {
  const root = document.documentElement;
  root.style.setProperty('--back-progress', String(progress));
  root.style.setProperty('--back-edge', edge === 'right' ? '1' : '-1');
  root.classList.add('predictive-back-active');
}

export function clearCssProgress() {
  const root = document.documentElement;
  root.style.removeProperty('--back-progress');
  root.style.removeProperty('--back-edge');
  root.classList.remove('predictive-back-active');
}

function createDimOverlay(): HTMLDivElement {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = [
    'position:fixed',
    'inset:0',
    'background:#000',
    'opacity:0',
    'pointer-events:none',
    'z-index:99998',
  ].join(';');
  document.body.appendChild(el);
  return el;
}

// ── Init ─────────────────────────────────────────────────────────────────────

let _inited = false;

/**
 * Call once on app mount. Loads the native plugin (Android 14+ only) and
 * wires up CSS updates + the dim overlay. Silently no-ops on other platforms.
 */
export async function initPredictiveBack(): Promise<void> {
  if (_inited) return;
  _inited = true;

  try {
    const { PredictiveBack } = await import(/* @vite-ignore */ '../plugins/PredictiveBack');
    const overlay = createDimOverlay();
    let cancelTimer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => {
      if (cancelTimer) { clearTimeout(cancelTimer); cancelTimer = null; }
    };

    await PredictiveBack.addListener('backStarted', (data) => {
      clearTimer();
      const edge = (data.edge ?? 'left') as 'left' | 'right';
      const progress = data.progress ?? 0;
      overlay.style.transition = 'none';
      overlay.style.opacity = String(progress * 0.20);
      applyCssProgress(progress, edge);
      _startedListeners.forEach(fn => fn({ ...data, edge }));
    });

    await PredictiveBack.addListener('backProgressed', (data) => {
      const edge = (data.edge ?? 'left') as 'left' | 'right';
      const progress = data.progress ?? 0;
      overlay.style.opacity = String(progress * 0.20);
      applyCssProgress(progress, edge);
      _progressListeners.forEach(fn => fn({ ...data, edge }));
    });

    await PredictiveBack.addListener('backCancelled', () => {
      // Spring back with a short ease
      overlay.style.transition = 'opacity 260ms cubic-bezier(0.4,0,0.2,1)';
      overlay.style.opacity = '0';
      clearTimer();
      cancelTimer = setTimeout(() => {
        overlay.style.transition = 'none';
        cancelTimer = null;
      }, 280);
      clearCssProgress();
      _cancelledListeners.forEach(fn => fn());
    });
  } catch {
    // Native plugin not available — silently degrade
  }
}
