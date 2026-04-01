// Global back navigation stack.
// One handler is active at a time — the visible panel registers its own.
// When the handler returns false (or none registered), App-level logic handles exit.

type BackHandler = () => boolean;

let _handler: BackHandler | null = null;

export function setBackHandler(fn: BackHandler | null): void {
  _handler = fn;
}

export function handleGlobalBack(): boolean {
  return _handler ? _handler() : false;
}
