type BackFn = () => void;
type Listener = (fn: BackFn | null) => void;

let _handler: BackFn | null = null;
const _listeners = new Set<Listener>();

export function setVocalexBack(fn: BackFn | null): void {
  _handler = fn;
  _listeners.forEach(l => l(_handler));
}

export function subscribeVocalexBack(l: Listener): () => void {
  _listeners.add(l);
  l(_handler);
  return () => { _listeners.delete(l); };
}
