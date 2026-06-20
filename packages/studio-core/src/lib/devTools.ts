import { useChordStore } from '../store/useChordStore';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  module: string;
  source: string;
}

export interface NavigationEntry {
  id: string;
  timestamp: number;
  fromApp: string;
  toApp: string;
  transitionStart?: number;
  transitionComplete?: number;
  hubMounted?: boolean;
  subappUnmounted?: boolean;
  activeAppAfterTransition: string;
  transitionLockState: boolean;
  fallbackRendered: boolean;
}

export interface ErrorEntry {
  timestamp: number;
  message: string;
  stack: string;
  source: string;
  module: string;
}

export interface EventEntry {
  timestamp: number;
  type: string;
  target: string;
  module: string;
}

export interface NetworkEntry {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  headers: Record<string, string>;
  status?: number;
  statusText?: string;
  error?: string;
}

export interface PerfStats {
  renders: number;
  mounts: number;
  unmounts: number;
  lastRenderTime: number;
}

export interface DebugProvider {
  id: string;
  name: string;
  getDebugState: () => Record<string, any>;
  getActions?: () => Array<{ label: string; action: () => void }>;
}

export interface StagexDiagnosticsState {
  iframeMounted: boolean;
  iframeSrc: string;
  iframeLoadFired: boolean;
  contentWindowAvailable: boolean;
  stageCoreReadyReceived: boolean;
  wrapperListenerRegistered: boolean;
  iframeListenerInstalled: boolean;
  messagesSent: number;
  messagesReceived: number;
  ackCount: number;
  timeoutCount: number;
  lastCommandSent: string;
  lastMsgId: string;
  lastAckReceived: string;
  lastTimeout: string;
  lastError: string;
  currentOrigin: string;
  expectedOrigin: string;
  actualEventOrigin: string;
  sentWithTargetOriginWildcard: boolean;
  originRejected: boolean;
  handlerMissing: boolean;
  handlerFailed: boolean;
  nackCount: number;
  lastNack: string;
  lastMissingHandler: string;
  lastFailedHandler: string;
  availableHandlers: string[];
  missingHandlers: string[];
}

const MAX_ITEMS = 150;
const logsBuffer: LogEntry[] = [];
const errorsBuffer: ErrorEntry[] = [];
const eventsBuffer: EventEntry[] = [];
const networkBuffer: NetworkEntry[] = [];
const navBuffer: NavigationEntry[] = [];
const perfRegistry = new Map<string, PerfStats>();
const providers = new Map<string, DebugProvider>();
const listeners = new Set<() => void>();

const stagexDiagnostics: StagexDiagnosticsState = {
  iframeMounted: false,
  iframeSrc: 'N/A',
  iframeLoadFired: false,
  contentWindowAvailable: false,
  stageCoreReadyReceived: false,
  wrapperListenerRegistered: false,
  iframeListenerInstalled: false,
  messagesSent: 0,
  messagesReceived: 0,
  ackCount: 0,
  timeoutCount: 0,
  lastCommandSent: 'none',
  lastMsgId: 'none',
  lastAckReceived: 'none',
  lastTimeout: 'none',
  lastError: 'none',
  currentOrigin: 'N/A',
  expectedOrigin: 'N/A',
  actualEventOrigin: 'N/A',
  sentWithTargetOriginWildcard: false,
  originRejected: false,
  handlerMissing: false,
  handlerFailed: false,
  nackCount: 0,
  lastNack: 'none',
  lastMissingHandler: 'none',
  lastFailedHandler: 'none',
  availableHandlers: ['switchView', 'toggleSCDial', 'toggleGigMode', 'stageGoBack', 'openPresetsPanel', 'exportPDFWithOptions'],
  missingHandlers: []
};

export function updateStagexDiagnostics(updates: Partial<StagexDiagnosticsState>) {
  Object.assign(stagexDiagnostics, updates);
  notifyListeners();
}

export function getStagexDiagnostics() {
  return stagexDiagnostics;
}

export function resetStagexDiagnostics() {
  Object.assign(stagexDiagnostics, {
    iframeMounted: false,
    iframeSrc: 'N/A',
    iframeLoadFired: false,
    contentWindowAvailable: false,
    stageCoreReadyReceived: false,
    wrapperListenerRegistered: false,
    iframeListenerInstalled: false,
    messagesSent: 0,
    messagesReceived: 0,
    ackCount: 0,
    timeoutCount: 0,
    lastCommandSent: 'none',
    lastMsgId: 'none',
    lastAckReceived: 'none',
    lastTimeout: 'none',
    lastError: 'none',
    currentOrigin: 'N/A',
    expectedOrigin: 'N/A',
    actualEventOrigin: 'N/A',
    sentWithTargetOriginWildcard: false,
    originRejected: false,
    handlerMissing: false,
    handlerFailed: false,
    nackCount: 0,
    lastNack: 'none',
    lastMissingHandler: 'none',
    lastFailedHandler: 'none',
    availableHandlers: ['switchView', 'toggleSCDial', 'toggleGigMode', 'stageGoBack', 'openPresetsPanel', 'exportPDFWithOptions'],
    missingHandlers: []
  });
  notifyListeners();
}

let initialized = false;
let originalConsole: typeof console | null = null;

// Helpers to notify subscribers
function notifyListeners() {
  listeners.forEach(l => {
    try { l(); } catch (_) {}
  });
}

export function subscribeToDevTools(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getCallerSource(): string {
  const stack = new Error().stack;
  if (!stack) return 'unknown';
  const lines = stack.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (
      line.includes('devTools.ts') ||
      line.includes('devTools.js') ||
      line.includes('getCallerSource') ||
      line.includes('addLog') ||
      line.includes('console.warn') ||
      line.includes('console.error') ||
      line.includes('console.log')
    ) {
      continue;
    }
    const match = line.match(/at\s+(.*?)\s+\((.*?)\)/) || line.match(/at\s+(.*)/);
    if (match) {
      const fullPath = match[2] || match[1];
      const parts = fullPath.split('/');
      const lastPart = parts[parts.length - 1];
      const winParts = lastPart.split('\\');
      return winParts[winParts.length - 1];
    }
  }
  return 'unknown';
}

// ── 1. LOG VIEWER ──
export function addLog(level: 'info' | 'warn' | 'error', module: string, ...args: any[]) {
  const isDevMode = useChordStore.getState().settings.developerMode;
  if (!isDevMode && !initialized) return;

  const msg = args.map(arg => {
    if (arg instanceof Error) return arg.message + '\n' + arg.stack;
    if (typeof arg === 'object') {
      try { return JSON.stringify(arg); } catch (_) { return String(arg); }
    }
    return String(arg);
  }).join(' ');

  let targetLevel = level;
  if (level === 'warn') {
    const isDiagnostics = args.some(arg => {
      if (arg && typeof arg === 'object') {
        return 'appVersion' in arg && 'appName' in arg && 'memory' in arg;
      }
      return false;
    }) || (
      msg.includes('"appVersion"') &&
      msg.includes('"appName"') &&
      msg.includes('"memory"') &&
      msg.includes('"status"')
    );

    if (isDiagnostics) {
      targetLevel = 'info';
    }
  }

  const id = Math.random().toString(36).substring(2, 9);
  const source = getCallerSource();
  const isFirestore = msg.includes('@firebase/firestore') || msg.toLowerCase().includes('firestore');

  logsBuffer.push({
    id,
    timestamp: Date.now(),
    level: targetLevel,
    message: msg,
    module: isFirestore ? 'network' : module,
    source: isFirestore ? 'Firestore' : source
  });

  if (logsBuffer.length > MAX_ITEMS) logsBuffer.shift();
  notifyListeners();
}

export function getLogs() {
  return logsBuffer;
}

export function clearLogs() {
  logsBuffer.length = 0;
  notifyListeners();
}

// ── 1B. NAVIGATION TRACE LOGS ──
export function recordNavigation(entry: Omit<NavigationEntry, 'id' | 'timestamp'>) {
  const isDevMode = useChordStore.getState().settings.developerMode;
  if (!isDevMode && !initialized) return;

  const id = Math.random().toString(36).substring(2, 9);
  navBuffer.push({
    id,
    timestamp: Date.now(),
    ...entry
  });

  if (navBuffer.length > 50) navBuffer.shift();
  notifyListeners();
}

export function getNavigationEntries(): NavigationEntry[] {
  return navBuffer;
}

export function clearNavigationEntries() {
  navBuffer.length = 0;
  notifyListeners();
}

// ── 2. ERROR VIEWER ──
export function addError(err: Omit<ErrorEntry, 'timestamp'>) {
  const isDevMode = useChordStore.getState().settings.developerMode;
  if (!isDevMode) return;

  const isFirestore = err.message.includes('@firebase/firestore') || err.message.toLowerCase().includes('firestore');

  errorsBuffer.push({
    ...err,
    module: isFirestore ? 'network' : err.module,
    source: isFirestore ? 'Firestore' : err.source,
    timestamp: Date.now()
  });

  if (errorsBuffer.length > MAX_ITEMS) errorsBuffer.shift();
  notifyListeners();
}

export function getErrors() {
  return errorsBuffer;
}

export function clearErrors() {
  errorsBuffer.length = 0;
  notifyListeners();
}

// ── 3. EVENT INSPECTOR ──
export function recordEvent(type: string, target: string, module = 'general') {
  const isDevMode = useChordStore.getState().settings.developerMode;
  if (!isDevMode) return;

  eventsBuffer.push({
    timestamp: Date.now(),
    type,
    target,
    module
  });

  if (eventsBuffer.length > MAX_ITEMS) eventsBuffer.shift();
  notifyListeners();
}

export function getEvents() {
  return eventsBuffer;
}

export function clearEvents() {
  eventsBuffer.length = 0;
  notifyListeners();
}

// ── 4. NETWORK INSPECTOR ──
function stripSensitiveHeaders(headers: HeadersInit | undefined): Record<string, string> {
  const stripped: Record<string, string> = {};
  if (!headers) return stripped;

  const sanitize = (key: string, val: string) => {
    const k = key.toLowerCase();
    if (k.includes('authorization') || k.includes('token') || k.includes('key') || k.includes('cookie') || k.includes('credential')) {
      stripped[key] = '********';
    } else {
      stripped[key] = val;
    }
  };

  if (headers instanceof Headers) {
    headers.forEach((val, key) => sanitize(key, val));
  } else if (Array.isArray(headers)) {
    headers.forEach(([key, val]) => sanitize(key, val));
  } else {
    Object.entries(headers).forEach(([key, val]) => sanitize(key, String(val)));
  }
  return stripped;
}

export function recordNetworkRequest(method: string, url: string, init?: RequestInit): string {
  const id = Math.random().toString(36).substring(2, 9);
  const isDevMode = useChordStore.getState().settings.developerMode;
  if (!isDevMode) return id;

  networkBuffer.push({
    id,
    timestamp: Date.now(),
    method,
    url,
    headers: stripSensitiveHeaders(init?.headers)
  });

  if (networkBuffer.length > MAX_ITEMS) networkBuffer.shift();
  notifyListeners();
  return id;
}

const STATUS_TEXTS: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout'
};

export function recordNetworkResponse(id: string, status: number, statusText: string) {
  const req = networkBuffer.find(n => n.id === id);
  if (req) {
    req.status = status;
    let actualStatusText = statusText;
    if (status === 404) {
      actualStatusText = 'Not Found';
    } else if (!actualStatusText) {
      actualStatusText = STATUS_TEXTS[status] || `HTTP ${status}`;
    }
    req.statusText = actualStatusText;
    notifyListeners();
  }
}

export function recordNetworkFailure(id: string, error: string) {
  const req = networkBuffer.find(n => n.id === id);
  if (req) {
    req.error = error;
    notifyListeners();
  }
}

export function getNetworkRequests() {
  return networkBuffer;
}

export function clearNetworkRequests() {
  networkBuffer.length = 0;
  notifyListeners();
}

// ── 5. PERFORMANCE INSPECTOR ──
export function recordPerfEvent(componentName: string, type: 'mount' | 'unmount' | 'render', renderCount = 0) {
  const isDevMode = useChordStore.getState().settings.developerMode;
  if (!isDevMode) return;

  let stats = perfRegistry.get(componentName);
  if (!stats) {
    stats = { renders: 0, mounts: 0, unmounts: 0, lastRenderTime: Date.now() };
    perfRegistry.set(componentName, stats);
  }

  if (type === 'mount') stats.mounts += 1;
  else if (type === 'unmount') stats.unmounts += 1;
  else {
    stats.renders = renderCount;
    stats.lastRenderTime = Date.now();
  }
  notifyListeners();
}

export function getPerfStats() {
  return perfRegistry;
}

export function clearPerfStats() {
  perfRegistry.clear();
  notifyListeners();
}

// ── 6. DEBUG PROVIDERS REGISTRY ──
export function registerDebugProvider(provider: DebugProvider) {
  providers.set(provider.id, provider);
  notifyListeners();
}

export function unregisterDebugProvider(id: string) {
  providers.delete(id);
  notifyListeners();
}

export function getDebugProviders() {
  return Array.from(providers.values());
}

// ── 7. SHIELDED STORAGE VALUES ──
export function maskSensitiveValue(key: string, value: string): string {
  const k = key.toLowerCase();
  if (k.includes('token') || k.includes('password') || k.includes('key') || k.includes('secret') || k.includes('auth') || k.includes('jwt') || k.includes('credential')) {
    return '********';
  }
  return value;
}

// ── 8. GLOBAL INITIALIZATION ──
export function initDevToolsFramework() {
  if (initialized) return;
  initialized = true;

  // Intercept Global Console logs
  originalConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console)
  } as any;

  console.log = (...args: any[]) => {
    originalConsole!.log(...args);
    // Infer module from bracket prefixes like [Stagex]
    let module = 'general';
    let cleanArgs = args;
    if (typeof args[0] === 'string' && args[0].startsWith('[')) {
      const closeIdx = args[0].indexOf(']');
      if (closeIdx > 0) {
        module = args[0].slice(1, closeIdx);
        const rest = args[0].slice(closeIdx + 1).trim();
        cleanArgs = rest ? [rest, ...args.slice(1)] : args.slice(1);
      }
    }
    addLog('info', module, ...cleanArgs);
  };

  console.warn = (...args: any[]) => {
    originalConsole!.warn(...args);
    let module = 'general';
    let cleanArgs = args;
    if (typeof args[0] === 'string' && args[0].startsWith('[')) {
      const closeIdx = args[0].indexOf(']');
      if (closeIdx > 0) {
        module = args[0].slice(1, closeIdx);
        const rest = args[0].slice(closeIdx + 1).trim();
        cleanArgs = rest ? [rest, ...args.slice(1)] : args.slice(1);
      }
    }
    addLog('warn', module, ...cleanArgs);
  };

  console.error = (...args: any[]) => {
    originalConsole!.error(...args);
    let module = 'general';
    let cleanArgs = args;
    if (typeof args[0] === 'string' && args[0].startsWith('[')) {
      const closeIdx = args[0].indexOf(']');
      if (closeIdx > 0) {
        module = args[0].slice(1, closeIdx);
        const rest = args[0].slice(closeIdx + 1).trim();
        cleanArgs = rest ? [rest, ...args.slice(1)] : args.slice(1);
      }
    }
    addLog('error', module, ...cleanArgs);
    
    // Add to error viewer automatically
    const msg = cleanArgs.map(c => typeof c === 'object' ? JSON.stringify(c) : String(c)).join(' ');
    addError({
      message: msg,
      stack: new Error().stack || '',
      source: 'console.error',
      module
    });
  };

  // Intercept Global Errors & Unhandled Rejections
  window.addEventListener('error', (e) => {
    addError({
      message: e.message || String(e.error),
      stack: e.error?.stack || '',
      source: e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : 'window.onerror',
      module: 'general'
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    addError({
      message: reason?.message || String(reason),
      stack: reason?.stack || '',
      source: 'unhandledrejection',
      module: 'general'
    });
  });

  // Intercept fetch network calls
  const originalFetch = window.fetch;
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    const method = init?.method || 'GET';
    const reqId = recordNetworkRequest(method, url, init);
    try {
      const response = await originalFetch(input, init);
      recordNetworkResponse(reqId, response.status, response.statusText);
      return response;
    } catch (error: any) {
      recordNetworkFailure(reqId, error.message || String(error));
      throw error;
    }
  };

  // Intercept clicks/gestures for Event Inspecting
  const handleGlobalTouch = (e: Event) => {
    const isDevMode = useChordStore.getState().settings.developerMode;
    if (!isDevMode) return;

    let targetDesc = '';
    const target = e.target as HTMLElement | null;
    if (target) {
      targetDesc = target.tagName.toLowerCase();
      if (target.id) targetDesc += `#${target.id}`;
      if (target.className) {
        const cls = typeof target.className === 'string' ? target.className.split(' ')[0] : '';
        if (cls) targetDesc += `.${cls}`;
      }
    }
    
    // Attempt to infer active application key
    const store = useChordStore.getState();
    const app = store.settings.appMode || 'hub';
    recordEvent(e.type, targetDesc || 'unknown', app);
  };

  const capturedEvents = ['click', 'touchstart', 'touchend', 'pointerdown', 'pointerup'];
  capturedEvents.forEach(evt => {
    window.addEventListener(evt, handleGlobalTouch, { capture: true, passive: true });
  });
}
