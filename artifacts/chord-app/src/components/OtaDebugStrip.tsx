import { useEffect, useState } from 'react';
import { APP_VERSION } from '../lib/appVersion';
import { isNative } from '../lib/capgoUpdater';

interface UrlResult {
  url: string;
  status: string;
  version: string | null;
}

interface DiagState {
  local: string;
  remoteBase: string;
  isNative: boolean;
  results: UrlResult[];
  dismissed: string;
  autoOpened: string;
  notified: string;
  computedRemote: string | null;
  updateAvailable: boolean;
}

async function probe(url: string): Promise<UrlResult> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { url, status: `HTTP ${res.status}`, version: null };
    const j = await res.json();
    return { url, status: 'OK', version: typeof j?.version === 'string' ? j.version : null };
  } catch (e: any) {
    return { url, status: `ERR ${String(e?.message || e).slice(0, 60)}`, version: null };
  }
}

export default function OtaDebugStrip() {
  const [state, setState] = useState<DiagState | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const t = Date.now();
      const remoteBase = (import.meta.env.VITE_OTA_BASE_URL as string | undefined)?.trim() || '';
      const urls: string[] = [];
      const m = remoteBase.match(/^https:\/\/([^.]+)\.github\.io(?:\/([^/?#]+))?$/i);
      if (m) {
        const user = m[1];
        const repo = m[2] ?? `${user}.github.io`;
        urls.push(`https://raw.githubusercontent.com/${user}/${repo}/main/docs/version.json?t=${t}`);
      }
      if (remoteBase) urls.push(`${remoteBase.replace(/\/$/, '')}/version.json?t=${t}`);

      const results = await Promise.all(urls.map(probe));
      let computed: string | null = null;
      for (const r of results) {
        if (r.version && (!computed || r.version > computed)) computed = r.version;
      }
      const updateAvailable = !!computed && computed !== APP_VERSION && computed > APP_VERSION;

      let dismissed = '(empty)';
      let autoOpened = '(empty)';
      let notified = '(empty)';
      try { dismissed = localStorage.getItem('studio:dismissedUpdateVersion') || '(empty)'; } catch {}
      try { autoOpened = sessionStorage.getItem('studio:autoOpenedUpdateVersion') || localStorage.getItem('studio:autoOpenedUpdateVersion') || '(empty)'; } catch {}
      try { notified = localStorage.getItem('studio:notifiedUpdateVersion') || '(empty)'; } catch {}

      setState({
        local: APP_VERSION,
        remoteBase: remoteBase || '(NOT SET)',
        isNative: isNative(),
        results,
        dismissed,
        autoOpened,
        notified,
        computedRemote: computed,
        updateAvailable,
      });
    })();
  }, []);

  const tap = () => setOpen((o) => !o);

  if (!state) {
    return (
      <div onClick={tap} style={stripBase}>
        OTA DIAG: probing… (tap to expand)
      </div>
    );
  }

  if (!open) {
    return (
      <div onClick={tap} style={{ ...stripBase, background: state.updateAvailable ? '#16a34a' : '#dc2626' }}>
        OTA DIAG v{state.local} → remote {state.computedRemote ?? '?'} {state.updateAvailable ? '(UPDATE!)' : '(no update)'} — tap
      </div>
    );
  }

  return (
    <div onClick={tap} style={{ ...stripBase, height: 'auto', whiteSpace: 'normal', padding: '8px 10px', textAlign: 'left', fontSize: 10, lineHeight: 1.35 }}>
      <div><b>local:</b> {state.local}</div>
      <div><b>native:</b> {state.isNative ? 'yes' : 'no'}</div>
      <div><b>VITE_OTA_BASE_URL:</b> {state.remoteBase}</div>
      <div><b>computed remote:</b> {state.computedRemote ?? 'NULL'}</div>
      <div><b>updateAvailable:</b> {state.updateAvailable ? 'TRUE' : 'FALSE'}</div>
      <div><b>dismissed (LS):</b> {state.dismissed}</div>
      <div><b>autoOpened:</b> {state.autoOpened}</div>
      <div><b>notified (LS):</b> {state.notified}</div>
      <div style={{ marginTop: 4 }}><b>fetches:</b></div>
      {state.results.map((r, i) => (
        <div key={i} style={{ marginLeft: 6 }}>
          • {r.status} → v={r.version ?? '?'}<br />
          <span style={{ opacity: 0.7, fontSize: 9 }}>{r.url}</span>
        </div>
      ))}
      <div style={{ marginTop: 4, opacity: 0.7 }}>(tap to collapse)</div>
    </div>
  );
}

const stripBase: React.CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 99999,
  background: '#1f2937',
  color: 'white',
  fontFamily: 'monospace',
  fontSize: 11,
  padding: '6px 10px',
  textAlign: 'center',
  borderTop: '1px solid rgba(255,255,255,0.2)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
