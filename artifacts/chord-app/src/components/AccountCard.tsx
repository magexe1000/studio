import { useEffect, useRef, useState } from 'react';
import {
  isFirebaseConfigured,
  signInGoogle,
  signInEmail,
  registerEmail,
  signOut,
  subscribeAuth,
  deleteAccount,
  type AuthUser,
} from '../lib/auth';
import { subscribeSyncStatus, syncNow, deleteCloudData } from '../lib/sync';
import { useT } from '../lib/useT';
import { useChordStore } from '../store/useChordStore';

type Props = {
  accent: { from: string; to: string; mid: string };
  cardStyle: React.CSSProperties;
  rowStyle: React.CSSProperties;
};

type Mode = 'idle' | 'email-signin' | 'email-register';

function formatRelative(ms: number | null, lang: string): string {
  if (!ms) return '';
  const diff = Math.max(0, Date.now() - ms);
  const sec = Math.floor(diff / 1000);
  if (lang === 'es') {
    if (sec < 5) return 'ahora mismo';
    if (sec < 60) return `hace ${sec}s`;
    if (sec < 3600) return `hace ${Math.floor(sec / 60)}m`;
    if (sec < 86400) return `hace ${Math.floor(sec / 3600)}h`;
    return `hace ${Math.floor(sec / 86400)}d`;
  }
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export default function AccountCard({ accent, cardStyle, rowStyle }: Props) {
  const tRoot = useT();
  const t = tRoot.hub.accountSection;
  const lang = useChordStore((s) => s.settings.language) ?? 'en';
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mode, setMode] = useState<Mode>('idle');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sync, setSync] = useState(() => ({ signedIn: false, syncing: false, lastSyncedMs: null as number | null, error: null as string | null }));
  const [tick, setTick] = useState(0);
  const [justSynced, setJustSynced] = useState(false);
  const prevSyncing = useRef(false);

  useEffect(() => subscribeAuth(setUser), []);
  useEffect(() => subscribeSyncStatus(setSync), []);
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const wasSyncing = prevSyncing.current;
    prevSyncing.current = sync.syncing;
    if (wasSyncing && !sync.syncing && !sync.error) {
      setJustSynced(true);
      const id = setTimeout(() => setJustSynced(false), 1800);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [sync.syncing, sync.error]);
  // Touch tick so eslint sees we use it (drives relative-time refresh)
  void tick;

  if (!isFirebaseConfigured) {
    return (
      <div style={cardStyle}>
        <div style={rowStyle}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-primary)', margin: 0 }}>
              {t.title}
            </p>
            <p style={{ fontSize: 12, color: 'var(--c-text-secondary)', margin: '4px 0 0', lineHeight: 1.4 }}>
              {t.notConfigured}
            </p>
          </div>
        </div>
      </div>
    );
  }

  async function doGoogle() {
    setBusy(true); setErr(null);
    try { await signInGoogle(); }
    catch (e) { setErr(prettyErr(e, lang)); }
    finally { setBusy(false); }
  }

  async function doEmail() {
    if (!email.trim() || !password) { setErr(t.errMissing); return; }
    setBusy(true); setErr(null);
    try {
      if (mode === 'email-signin') await signInEmail(email, password);
      else await registerEmail(email, password, name);
      setMode('idle'); setEmail(''); setPassword(''); setName('');
    } catch (e) { setErr(prettyErr(e, lang)); }
    finally { setBusy(false); }
  }

  async function doSyncNow() {
    setBusy(true);
    try { await syncNow(); }
    finally { setBusy(false); }
  }

  // ── Signed in ──
  if (user) {
    const initial = (user.displayName || user.email || '?').trim().charAt(0).toUpperCase();
    const iconName = sync.syncing ? 'sync' : sync.error ? 'sync_problem' : 'cloud_done';
    const iconColor = sync.syncing ? accent.from : sync.error ? '#ff6b6b' : justSynced ? accent.from : 'var(--c-text-secondary)';
    const statusText = sync.syncing
      ? t.syncing
      : sync.error
        ? t.syncError
        : justSynced
          ? t.syncedJustNow
          : sync.lastSyncedMs
            ? `${t.synced} · ${formatRelative(sync.lastSyncedMs, lang)}`
            : t.notSyncedYet;
    return (
      <div style={cardStyle}>
        <SyncAnimations />
        <div style={{ ...rowStyle, alignItems: 'center', gap: 12 }}>
          {user.photoURL ? (
            <img src={user.photoURL} alt="" style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{
              width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: 18,
            }}>{initial}</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.displayName || user.email}
            </p>
            <p style={{ fontSize: 11, color: 'var(--c-text-secondary)', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.displayName ? user.email : t.signedIn}
            </p>
          </div>
        </div>

        <div style={{ ...rowStyle, alignItems: 'center', gap: 10 }}>
          <span
            className={`material-symbols-outlined sync-icon ${sync.syncing ? 'sync-spin' : justSynced ? 'sync-pop' : ''}`}
            style={{ fontSize: 18, color: iconColor, transition: 'color 250ms ease' }}
          >
            {iconName}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-primary)', margin: 0 }}>
              {statusText}
            </p>
            {sync.error && (
              <p style={{ fontSize: 10, color: '#ff6b6b', margin: '2px 0 0' }}>{sync.error}</p>
            )}
          </div>
          <button
            onClick={doSyncNow}
            disabled={busy || sync.syncing}
            style={pillBtn(accent, false)}
          >{t.syncNow}</button>
        </div>

        <div style={{ ...rowStyle }}>
          <p style={{ fontSize: 12, color: 'var(--c-text-secondary)', margin: 0, flex: 1, lineHeight: 1.4 }}>
            {t.syncedAppsNote}
          </p>
        </div>
      </div>
    );
  }

  // ── Signed out ──
  return (
    <div style={cardStyle}>
      <div style={{ padding: '15px 18px 4px' }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-primary)', margin: 0 }}>{t.title}</p>
        <p style={{ fontSize: 12, color: 'var(--c-text-secondary)', margin: '4px 0 0', lineHeight: 1.4 }}>{t.subtitle}</p>
      </div>

      {mode === 'idle' && (
        <div style={{ padding: '12px 14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={doGoogle} disabled={busy} style={primaryBtn(accent)}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>account_circle</span>
            {t.continueGoogle}
          </button>
          <button onClick={() => { setMode('email-signin'); setErr(null); }} disabled={busy} style={secondaryBtn()}>
            {t.continueEmail}
          </button>
          <button onClick={() => { setMode('email-register'); setErr(null); }} disabled={busy} style={textBtn()}>
            {t.createAccount}
          </button>
        </div>
      )}

      {(mode === 'email-signin' || mode === 'email-register') && (
        <div style={{ padding: '12px 14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mode === 'email-register' && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.namePlaceholder}
              autoComplete="name"
              style={inputStyle(accent)}
            />
          )}
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.emailPlaceholder}
            autoComplete="email"
            type="email"
            style={inputStyle(accent)}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.passwordPlaceholder}
            autoComplete={mode === 'email-signin' ? 'current-password' : 'new-password'}
            type="password"
            style={inputStyle(accent)}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={() => { setMode('idle'); setErr(null); }} disabled={busy} style={{ ...secondaryBtn(), flex: 1 }}>
              {t.cancel}
            </button>
            <button onClick={doEmail} disabled={busy} style={{ ...primaryBtn(accent), flex: 1 }}>
              {mode === 'email-signin' ? t.signIn : t.register}
            </button>
          </div>
          {mode === 'email-signin' ? (
            <button onClick={() => { setMode('email-register'); setErr(null); }} style={textBtn()}>
              {t.switchToRegister}
            </button>
          ) : (
            <button onClick={() => { setMode('email-signin'); setErr(null); }} style={textBtn()}>
              {t.switchToSignIn}
            </button>
          )}
        </div>
      )}

      {err && (
        <div style={{ padding: '0 18px 14px' }}>
          <p style={{ fontSize: 12, color: '#ff6b6b', margin: 0 }}>{err}</p>
        </div>
      )}
    </div>
  );
}

// ── Standalone Danger Zone (rendered in StudioHub below Language) ────────────

type DangerZoneProps = {
  accent: { from: string; to: string; mid: string };
  cardStyle: React.CSSProperties;
};

export function AccountDangerZone({ accent, cardStyle }: DangerZoneProps) {
  const tRoot = useT();
  const t = tRoot.hub.accountSection;
  const lang = useChordStore((s) => s.settings.language) ?? 'en';
  const [user, setUser] = useState<AuthUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => subscribeAuth(setUser), []);

  if (!isFirebaseConfigured || !user) return null;

  const emailToConfirm = (user.email ?? '').trim().toLowerCase();
  const canDelete = !deleting && deleteEmail.trim().toLowerCase() === emailToConfirm && !!emailToConfirm;

  async function doSignOut() {
    setBusy(true);
    try { await signOut(); }
    finally { setBusy(false); }
  }

  async function doDeleteAccount() {
    if (!user || deleting) return;
    setDeleting(true); setErr(null);
    try {
      await deleteCloudData();
      await deleteAccount();
      setShowDelete(false);
      setDeleteEmail('');
    } catch (e) {
      const code = (e as { code?: string })?.code ?? '';
      if (code === 'auth/requires-recent-login') {
        setErr(t.deleteAccountReauth);
        setShowDelete(false);
        setDeleteEmail('');
        try { await signOut(); } catch { /* noop */ }
      } else {
        setErr(prettyErr(e, lang));
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={cardStyle}>
      <SyncAnimations />
      <div style={{
        margin: '14px 14px',
        padding: '12px 14px',
        borderRadius: 14,
        background: 'rgba(255,107,107,0.06)',
        border: '1px solid rgba(255,107,107,0.22)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#ff6b6b' }}>warning</span>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#ff6b6b', margin: 0 }}>{t.dangerZone}</p>
        </div>
        <p style={{ fontSize: 11, color: 'var(--c-text-secondary)', margin: 0, lineHeight: 1.4 }}>
          {t.dangerZoneNote}
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={doSignOut} disabled={busy} style={{ ...dangerOutlineBtn(), flex: 1 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
            {t.signOut}
          </button>
          {!showDelete && (
            <button
              onClick={() => { setShowDelete(true); setErr(null); setDeleteEmail(''); }}
              disabled={busy}
              style={{ ...dangerSolidBtn(), flex: 1 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete_forever</span>
              {t.deleteAccount}
            </button>
          )}
        </div>

        {showDelete && (
          <div style={{
            marginTop: 4, padding: 12, borderRadius: 10,
            background: 'rgba(255,107,107,0.10)',
            border: '1px solid rgba(255,107,107,0.3)',
            display: 'flex', flexDirection: 'column', gap: 8,
            animation: 'sync-fade-in 200ms ease',
          }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#ff6b6b', margin: 0 }}>
              {t.deleteAccountConfirmTitle}
            </p>
            <p style={{ fontSize: 11, color: 'var(--c-text-secondary)', margin: 0, lineHeight: 1.4 }}>
              {t.deleteAccountConfirmBody}
            </p>
            <p style={{ fontSize: 11, color: 'var(--c-text-secondary)', margin: 0 }}>
              {t.deleteAccountTypeEmail}: <strong style={{ color: 'var(--c-text-primary)' }}>{user.email}</strong>
            </p>
            <input
              value={deleteEmail}
              onChange={(e) => setDeleteEmail(e.target.value)}
              placeholder={user.email ?? ''}
              autoComplete="off"
              spellCheck={false}
              style={{
                ...inputStyle(accent),
                borderColor: canDelete ? '#ff6b6b' : 'rgba(255,107,107,0.3)',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setShowDelete(false); setDeleteEmail(''); setErr(null); }}
                disabled={deleting}
                style={{ ...secondaryBtn(), flex: 1 }}
              >
                {t.cancel}
              </button>
              <button
                onClick={doDeleteAccount}
                disabled={!canDelete}
                style={{
                  ...dangerSolidBtn(),
                  flex: 1,
                  opacity: canDelete ? 1 : 0.5,
                  cursor: canDelete ? 'pointer' : 'not-allowed',
                }}
              >
                {deleting ? (
                  <span className="material-symbols-outlined sync-spin" style={{ fontSize: 16 }}>progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete_forever</span>
                )}
                {t.deleteAccountFinal}
              </button>
            </div>
          </div>
        )}

        {err && (
          <p style={{ fontSize: 11, color: '#ff6b6b', margin: 0 }}>{err}</p>
        )}
      </div>
    </div>
  );
}

function prettyErr(e: unknown, lang: string): string {
  const code = (e as { code?: string })?.code ?? '';
  const msg  = (e as { message?: string })?.message ?? 'Unknown error';
  const es = lang === 'es';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return es ? 'Email o contraseña incorrectos' : 'Wrong email or password';
  }
  if (code === 'auth/email-already-in-use') return es ? 'Ese email ya está registrado' : 'Email already registered';
  if (code === 'auth/weak-password') return es ? 'La contraseña es muy débil (mín. 6)' : 'Password too weak (min 6 chars)';
  if (code === 'auth/invalid-email') return es ? 'Email no válido' : 'Invalid email';
  if (code === 'auth/network-request-failed') return es ? 'Sin conexión' : 'Network error';
  if (code === 'auth/unauthorized-domain') return es ? 'Este dominio no está autorizado en Firebase' : 'This domain is not authorized in Firebase';
  return msg;
}

function pillBtn(accent: { from: string; to: string }, danger: boolean): React.CSSProperties {
  return {
    padding: '7px 14px', borderRadius: 9999, fontSize: 12, fontWeight: 700,
    background: danger ? 'rgba(255,107,107,0.12)' : `${accent.from}1f`,
    border: `1px solid ${danger ? 'rgba(255,107,107,0.3)' : accent.from + '55'}`,
    color: danger ? '#ff6b6b' : accent.from,
    fontFamily: 'Manrope', cursor: 'pointer',
    whiteSpace: 'nowrap', flexShrink: 0,
  };
}

function primaryBtn(accent: { from: string; to: string }): React.CSSProperties {
  return {
    padding: '12px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700,
    background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
    border: 'none', color: '#fff',
    fontFamily: 'Manrope', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  };
}

function secondaryBtn(): React.CSSProperties {
  return {
    padding: '12px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700,
    background: 'rgba(128,128,128,0.10)',
    border: '1px solid rgba(128,128,128,0.18)',
    color: 'var(--c-text-primary)',
    fontFamily: 'Manrope', cursor: 'pointer',
  };
}

function textBtn(): React.CSSProperties {
  return {
    padding: '6px 8px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    background: 'transparent', border: 'none',
    color: 'var(--c-text-secondary)',
    fontFamily: 'Manrope', cursor: 'pointer', textAlign: 'center' as const,
  };
}

function dangerOutlineBtn(): React.CSSProperties {
  return {
    padding: '10px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700,
    background: 'rgba(255,107,107,0.06)',
    border: '1px solid rgba(255,107,107,0.35)',
    color: '#ff6b6b',
    fontFamily: 'Manrope', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  };
}

function dangerSolidBtn(): React.CSSProperties {
  return {
    padding: '10px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700,
    background: 'linear-gradient(135deg, #ff6b6b, #ee5253)',
    border: '1px solid rgba(255,107,107,0.6)',
    color: '#fff',
    fontFamily: 'Manrope', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    boxShadow: '0 2px 8px rgba(238,82,83,0.25)',
  };
}

function SyncAnimations() {
  return (
    <style>{`
      @keyframes sync-spin-kf {
        from { transform: rotate(360deg); }
        to   { transform: rotate(0deg); }
      }
      @keyframes sync-pop-kf {
        0%   { transform: scale(0.6); opacity: 0.4; }
        50%  { transform: scale(1.25); opacity: 1; }
        100% { transform: scale(1);   opacity: 1; }
      }
      @keyframes sync-fade-in {
        from { opacity: 0; transform: translateY(-4px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .sync-icon { display: inline-block; transform-origin: center; }
      .sync-spin { animation: sync-spin-kf 1.1s linear infinite; }
      .sync-pop  { animation: sync-pop-kf 600ms cubic-bezier(0.34, 1.56, 0.64, 1); }
    `}</style>
  );
}

function inputStyle(accent: { from: string }): React.CSSProperties {
  return {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(128,128,128,0.08)',
    border: `1px solid rgba(128,128,128,0.15)`,
    borderRadius: 10, padding: '10px 12px',
    fontSize: 13, fontWeight: 500,
    color: 'var(--c-text-primary)',
    fontFamily: 'Manrope', outline: 'none',
    transition: 'border-color 200ms ease',
    accentColor: accent.from,
  };
}
