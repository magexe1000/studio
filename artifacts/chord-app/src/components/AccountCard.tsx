import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  isFirebaseConfigured,
  signInGoogle,
  signInEmail,
  registerEmail,
  signOut,
  subscribeAuth,
  type AuthUser,
} from '../lib/auth';
import { subscribeSyncStatus, syncNow, retrySync, type SyncStatus } from '../lib/sync';
import { scheduleAccountDeletion } from '../lib/accountStatus';
import { useT } from '../lib/useT';
import { useChordStore } from '../store/useChordStore';
import {
  AVATAR_ICONS,
  getUserAvatar,
  setUserAvatar,
  subscribeUserAvatar,
  type AvatarIcon,
} from '../lib/userAvatar';

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
  const [sync, setSync] = useState<SyncStatus>(() => ({
    signedIn: false,
    phase: 'idle',
    syncing: false,
    lastSyncedMs: null,
    error: null,
  }));
  const [tick, setTick] = useState(0);
  const [avatarIcon, setAvatarIcon] = useState<AvatarIcon | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerClosing, setPickerClosing] = useState(false);

  useEffect(() => subscribeAuth(setUser), []);
  useEffect(() => subscribeSyncStatus(setSync), []);
  // Reset photo-failed flag when the user (or photo URL) changes so a
  // fresh sign-in gets a new shot at loading the picture.
  useEffect(() => { setPhotoFailed(false); }, [user?.uid, user?.photoURL]);
  // Hydrate the per-uid avatar choice and listen for picker changes
  // from anywhere in the app.
  useEffect(() => {
    const refresh = () => setAvatarIcon(getUserAvatar(user?.uid ?? null));
    refresh();
    return subscribeUserAvatar(refresh);
  }, [user?.uid]);
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(id);
  }, []);
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

  async function doRetry() {
    setBusy(true);
    try { await retrySync(); }
    finally { setBusy(false); }
  }

  // ── Signed in ──
  if (user) {
    const initial = (user.displayName || user.email || '?').trim().charAt(0).toUpperCase();
    // Phase-driven UI: the engine is the single source of truth for which
    // visual state we should be in. We never derive "just synced" from a
    // ref-tracked transition any more — the engine fires `phase=success`
    // for SUCCESS_LINGER_MS then auto-fades to `idle`.
    const phase = sync.phase;
    const justSynced = phase === 'success';
    const isSyncing = phase === 'syncing';
    const isError = phase === 'error';
    const iconName = isSyncing ? 'sync' : isError ? 'sync_problem' : 'cloud_done';
    const iconColor = isSyncing ? accent.from : isError ? '#ff6b6b' : justSynced ? accent.from : 'var(--c-text-secondary)';
    const statusText = isSyncing
      ? t.syncing
      : isError
        ? t.syncFailed
        : justSynced
          ? t.syncedJustNow
          : sync.lastSyncedMs
            ? `${t.synced} · ${formatRelative(sync.lastSyncedMs, lang)}`
            : t.notSyncedYet;
    return (
      <div style={cardStyle}>
        <SyncAnimations />
        <div style={{ ...rowStyle, alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={() => { setPickerClosing(false); setPickerOpen(true); }}
            aria-label={t.avatarPickerTitle}
            style={{
              width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
              padding: 0, border: 'none', cursor: 'pointer',
              background: avatarIcon || !user.photoURL || photoFailed
                ? `linear-gradient(135deg, ${accent.from}, ${accent.to})`
                : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: 18,
              overflow: 'hidden', position: 'relative',
            }}
          >
            {avatarIcon ? (
              <span className="material-symbols-outlined" style={{ fontSize: 26, color: '#fff' }}>
                {avatarIcon}
              </span>
            ) : user.photoURL && !photoFailed ? (
              <img
                src={user.photoURL}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setPhotoFailed(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span>{initial}</span>
            )}
          </button>
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
            className={`material-symbols-outlined sync-icon ${isSyncing ? 'sync-spin' : justSynced ? 'sync-pop' : ''}`}
            style={{ fontSize: 18, color: iconColor, transition: 'color 250ms ease' }}
          >
            {iconName}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-primary)', margin: 0 }}>
              {statusText}
            </p>
            {isError && sync.error && (
              <p style={{ fontSize: 10, color: '#ff6b6b', margin: '2px 0 0' }}>{sync.error}</p>
            )}
          </div>
          {isError ? (
            <button
              onClick={doRetry}
              disabled={busy}
              style={pillBtn(accent, true)}
            >{t.retry}</button>
          ) : (
            <button
              onClick={doSyncNow}
              disabled={busy || isSyncing}
              style={pillBtn(accent, false)}
            >{t.syncNow}</button>
          )}
        </div>

        <div style={{ ...rowStyle }}>
          <p style={{ fontSize: 12, color: 'var(--c-text-secondary)', margin: 0, flex: 1, lineHeight: 1.4 }}>
            {t.syncedAppsNote}
          </p>
        </div>

        {pickerOpen && createPortal(
          <AvatarPickerSheet
            accent={accent}
            currentIcon={avatarIcon}
            hasGooglePhoto={!!user.photoURL && !photoFailed}
            t={t}
            closing={pickerClosing}
            onPick={(icon) => {
              setUserAvatar(user.uid, icon);
            }}
            onClose={() => {
              setPickerClosing(true);
              setTimeout(() => { setPickerOpen(false); setPickerClosing(false); }, 280);
            }}
          />,
          document.body,
        )}
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

type DangerSheet = 'none' | 'signout' | 'delete';

export function AccountDangerZone({ accent, cardStyle }: DangerZoneProps) {
  const tRoot = useT();
  const t = tRoot.hub.accountSection;
  const lang = useChordStore((s) => s.settings.language) ?? 'en';
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sheet, setSheet] = useState<DangerSheet>('none');
  const [closing, setClosing] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => subscribeAuth(setUser), []);

  if (!isFirebaseConfigured || !user) return null;

  const emailToConfirm = (user.email ?? '').trim().toLowerCase();
  const canDelete = !deleting && deleteEmail.trim().toLowerCase() === emailToConfirm && !!emailToConfirm;

  function openSheet(s: DangerSheet) {
    setErr(null);
    setDeleteEmail('');
    setClosing(false);
    setSheet(s);
  }

  function closeSheet() {
    setClosing(true);
    setTimeout(() => {
      setSheet('none');
      setClosing(false);
      setDeleteEmail('');
      setErr(null);
    }, 280);
  }

  async function doSignOut() {
    try { await signOut(); }
    catch { /* noop */ }
  }

  async function doDeleteAccount() {
    if (!user || deleting) return;
    setDeleting(true); setErr(null);
    try {
      // Soft-delete: schedule removal, keep all data intact for 7 days,
      // then sign the user out. Re-signing in shows the lockdown / restore
      // screen with a countdown.
      await scheduleAccountDeletion(user.uid);
      closeSheet();
      try { await signOut(); } catch { /* noop */ }
    } catch (e) {
      setErr(prettyErr(e, lang));
    } finally {
      setDeleting(false);
    }
  }

  const sheetAnim = closing
    ? 'sheet-down 280ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both'
    : 'sheet-up 340ms cubic-bezier(0.34, 1.42, 0.64, 1) both';

  const overlayAnim = closing
    ? 'fade-out 280ms ease both'
    : 'sync-fade-in 200ms ease both';

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 9999,
    animation: overlayAnim,
  };

  const backdropStyle: React.CSSProperties = {
    position: 'absolute', inset: 0,
    background: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
  };

  const sheetStyle: React.CSSProperties = {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    background: 'var(--app-surface)',
    borderRadius: '1.5rem 1.5rem 0 0',
    padding: '0 0 max(28px, env(safe-area-inset-bottom)) 0',
    animation: sheetAnim,
  };

  const dragPill = (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
      <div style={{ width: 36, height: 4, borderRadius: 9999, background: 'rgba(128,128,128,0.3)' }} />
    </div>
  );

  return (
    <>
      <SyncAnimations />

      {/* Red section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 12 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#ff6b6b' }}>warning</span>
        <p style={{
          color: '#ff6b6b', fontFamily: 'Manrope', fontWeight: 700,
          fontSize: 'var(--font-xs)', letterSpacing: '0.2em',
          textTransform: 'uppercase', margin: 0,
        }}>{t.dangerZone}</p>
      </div>

      {/* Card */}
      <div style={cardStyle}>
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 12, color: 'var(--c-text-secondary)', margin: 0, lineHeight: 1.4 }}>
            {t.dangerZoneNote}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => openSheet('signout')} style={{ ...dangerOutlineBtn(), flex: 1 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
              {t.signOut}
            </button>
            <button onClick={() => openSheet('delete')} style={{ ...dangerSolidBtn(), flex: 1 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete_forever</span>
              {t.deleteAccount}
            </button>
          </div>
          {err && <p style={{ fontSize: 11, color: '#ff6b6b', margin: 0 }}>{err}</p>}
        </div>
      </div>

      {/* ── Sign-out bottom sheet ── */}
      {sheet === 'signout' && createPortal(
        <div style={overlayStyle}>
          <div style={backdropStyle} onClick={closeSheet} />
          <div style={sheetStyle}>
            {dragPill}
            <div style={{ padding: '8px 22px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 18, color: 'var(--c-text-primary)', margin: 0 }}>
                {t.signOutConfirmTitle}
              </p>
              <button onClick={closeSheet} className="btn-smooth" style={{ color: 'var(--c-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>
            <p style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--c-text-secondary)', lineHeight: 1.5, margin: '8px 22px 20px' }}>
              {t.signOutConfirmBody}
            </p>
            <div style={{ display: 'flex', gap: 10, padding: '0 16px' }}>
              <button onClick={closeSheet} style={{ ...secondaryBtn(), flex: 1, padding: '13px 0' }}>
                {t.cancel}
              </button>
              <button
                onClick={doSignOut}
                style={{ ...dangerOutlineBtn(), flex: 1, padding: '13px 0' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
                {t.signOut}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Delete-account bottom sheet ── */}
      {sheet === 'delete' && createPortal(
        <div style={overlayStyle}>
          <div style={backdropStyle} onClick={closeSheet} />
          <div style={sheetStyle}>
            {dragPill}
            <div style={{ padding: '8px 22px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 18, color: '#ff6b6b', margin: 0 }}>
                {t.deleteAccountConfirmTitle}
              </p>
              <button onClick={closeSheet} className="btn-smooth" style={{ color: 'var(--c-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>
            <div style={{ padding: '8px 22px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--c-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {t.deleteAccountConfirmBody}
              </p>
              <p style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--c-text-secondary)', margin: 0 }}>
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
              {err && <p style={{ fontSize: 11, color: '#ff6b6b', margin: 0 }}>{err}</p>}
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '0 16px' }}>
              <button onClick={closeSheet} disabled={deleting} style={{ ...secondaryBtn(), flex: 1, padding: '13px 0' }}>
                {t.cancel}
              </button>
              <button
                onClick={doDeleteAccount}
                disabled={!canDelete}
                style={{
                  ...dangerSolidBtn(), flex: 1, padding: '13px 0',
                  opacity: canDelete ? 1 : 0.45,
                  cursor: canDelete ? 'pointer' : 'not-allowed',
                }}
              >
                {deleting
                  ? <span className="material-symbols-outlined sync-spin" style={{ fontSize: 16 }}>progress_activity</span>
                  : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete_forever</span>
                }
                {t.deleteAccountFinal}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
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
  // ── Native Google Sign-In codes (Capacitor plugin → GoogleSignInStatusCodes) ──
  if (code === 'auth/native-developer-error') {
    return es
      ? 'Esta build de la app no está autorizada por Google. La huella SHA-1 de esta APK no está registrada en Firebase. Mientras tanto, regístrate o inicia sesión con email aquí abajo — el sync funciona igual.'
      : 'This build is not authorised by Google. The APK\'s SHA-1 fingerprint is not registered in Firebase. In the meantime, sign in with email below — sync works the same way.';
  }
  if (code === 'auth/native-sign-in-failed') {
    return es
      ? 'Google rechazó el inicio de sesión. Revisa que tengas Google Play Services al día e intenta de nuevo, o usa email.'
      : 'Google rejected the sign-in. Make sure Google Play Services is up to date and retry, or use email.';
  }
  if (code === 'auth/native-internal-error') {
    return es ? 'Error interno de Google Sign-In. Intenta de nuevo en un momento.' : 'Google Sign-In internal error. Try again in a moment.';
  }
  if (code === 'auth/native-sign-in-currently-in-progress') {
    return es ? 'Ya hay un inicio de sesión en curso.' : 'A sign-in is already in progress.';
  }
  // Last-ditch: any bare "<status>:" leaking from a path that bypassed
  // auth.ts's normaliser (older code paths, third-party plugins).
  // Common Google Sign-In status codes: 7, 8, 10, 12500, 12501, 12502.
  if (/^\s*10[:\s]/.test(msg) || /DEVELOPER_ERROR/i.test(msg)) {
    return es
      ? 'Esta build no está autorizada por Google (SHA-1 no registrado en Firebase). Usa email para entrar — el sync funciona igual.'
      : 'This build is not authorised by Google (SHA-1 not registered in Firebase). Sign in with email — sync works the same way.';
  }
  if (/^\s*12501[:\s]/.test(msg)) {
    // User cancelled — silent, but if it leaks, show something neutral.
    return es ? 'Cancelado' : 'Cancelled';
  }
  if (/^\s*12500[:\s]/.test(msg) || /SIGN_IN_FAILED/i.test(msg)) {
    return es
      ? 'Google rechazó el inicio de sesión. Revisa Google Play Services o usa email.'
      : 'Google rejected the sign-in. Check Google Play Services or use email.';
  }
  if (/^\s*7[:\s]/.test(msg)) {
    return es ? 'Sin conexión a Google' : 'Network error reaching Google';
  }
  if (/^\s*8[:\s]/.test(msg) || /INTERNAL_ERROR/i.test(msg)) {
    return es ? 'Error interno de Google Sign-In. Intenta de nuevo.' : 'Google Sign-In internal error. Try again.';
  }
  if (/^\s*12502[:\s]/.test(msg)) {
    return es ? 'Ya hay un inicio de sesión en curso.' : 'A sign-in is already in progress.';
  }
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

// ── Avatar picker bottom sheet ───────────────────────────────────────────────

type AvatarPickerSheetProps = {
  accent: { from: string; to: string; mid: string };
  currentIcon: AvatarIcon | null;
  hasGooglePhoto: boolean;
  closing: boolean;
  t: ReturnType<typeof useT>['hub']['accountSection'];
  onPick: (icon: AvatarIcon | null) => void;
  onClose: () => void;
};

function AvatarPickerSheet({ accent, currentIcon, hasGooglePhoto, closing, t, onPick, onClose }: AvatarPickerSheetProps) {
  const sheetAnim = closing
    ? 'sheet-down 280ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both'
    : 'sheet-up 340ms cubic-bezier(0.34, 1.42, 0.64, 1) both';
  const overlayAnim = closing ? 'fade-out 280ms ease both' : 'sync-fade-in 200ms ease both';

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 9999, animation: overlayAnim,
  };
  const backdropStyle: React.CSSProperties = {
    position: 'absolute', inset: 0,
    background: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
  };
  const sheetStyle: React.CSSProperties = {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    background: 'var(--app-surface)',
    borderRadius: '1.5rem 1.5rem 0 0',
    padding: '0 0 max(28px, env(safe-area-inset-bottom)) 0',
    animation: sheetAnim,
  };

  return (
    <div style={overlayStyle}>
      <SheetAnimations />
      <div style={backdropStyle} onClick={onClose} />
      <div style={sheetStyle}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 9999, background: 'rgba(128,128,128,0.3)' }} />
        </div>
        <div style={{ padding: '6px 22px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 18, color: 'var(--c-text-primary)', margin: 0 }}>
            {t.avatarPickerTitle}
          </p>
          <button
            onClick={onClose}
            style={{ color: 'var(--c-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            aria-label="close"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>
        <p style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--c-text-secondary)', lineHeight: 1.5, margin: '4px 22px 14px' }}>
          {t.avatarPickerSubtitle}
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
          padding: '0 16px 12px',
        }}>
          {AVATAR_ICONS.map((icon) => {
            const selected = currentIcon === icon;
            return (
              <button
                key={icon}
                onClick={() => { onPick(icon); onClose(); }}
                style={{
                  aspectRatio: '1 / 1',
                  borderRadius: 14,
                  border: selected ? `2px solid ${accent.from}` : '1px solid rgba(128,128,128,0.18)',
                  background: selected
                    ? `linear-gradient(135deg, ${accent.from}, ${accent.to})`
                    : 'rgba(128,128,128,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', padding: 0,
                  transition: 'transform 150ms ease, background 200ms ease',
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: 30,
                    color: selected ? '#fff' : 'var(--c-text-primary)',
                  }}
                >
                  {icon}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ padding: '4px 16px 4px', display: 'flex', gap: 10 }}>
          <button
            onClick={() => { onPick(null); onClose(); }}
            style={{
              flex: 1, padding: '12px 14px', borderRadius: 12,
              fontSize: 13, fontWeight: 700,
              background: !currentIcon
                ? `${accent.from}1f`
                : 'rgba(128,128,128,0.10)',
              border: !currentIcon
                ? `1px solid ${accent.from}55`
                : '1px solid rgba(128,128,128,0.18)',
              color: !currentIcon ? accent.from : 'var(--c-text-primary)',
              fontFamily: 'Manrope', cursor: 'pointer',
            }}
          >
            {hasGooglePhoto ? t.avatarUseGooglePhoto : t.avatarUseInitial}
          </button>
        </div>
      </div>
    </div>
  );
}

function SheetAnimations() {
  return (
    <style>{`
      @keyframes sheet-up {
        from { transform: translateY(100%); }
        to   { transform: translateY(0); }
      }
      @keyframes sheet-down {
        from { transform: translateY(0); }
        to   { transform: translateY(100%); }
      }
      @keyframes fade-out {
        from { opacity: 1; }
        to   { opacity: 0; }
      }
    `}</style>
  );
}
