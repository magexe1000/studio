import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AppSpinner from './AppSpinner';
import StudioSpinner from './animata/progress/spinner';
import AnimatedActionButton from './animata/container/animated-border-trail';
import {
  isFirebaseConfigured,
  signInGoogle,
  signInEmail,
  registerEmail,
  signOut,
  subscribeAuth,
  updateDisplayName,
  sendPasswordReset,
  sendVerificationEmail,
  isEmailVerified,
  getSignInProviders,
  type AuthUser,
} from '../lib/auth';
import { subscribeSyncStatus, syncNow, retrySync, type SyncStatus } from '../lib/sync';
import { scheduleAccountDeletion, disableAccount } from '../lib/accountStatus';
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
  onAccountSettings?: () => void;
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

export default function AccountCard({ accent, cardStyle, rowStyle, onAccountSettings }: Props) {
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
    // v3.0.57: When sync is healthy (just synced OR previously synced and
    // sitting idle), show a green check_circle to make "everything is
    // backed up" visually obvious — much friendlier than the neutral
    // cloud icon, which read as ambient/inactive.
    const isHealthySynced = !isSyncing && !isError && (justSynced || sync.lastSyncedMs != null);
    const iconName = isSyncing
      ? 'sync'
      : isError
        ? 'sync_problem'
        : isHealthySynced
          ? 'check_circle'
          : 'cloud_off';
    const iconColor = isSyncing
      ? accent.from
      : isError
        ? '#ff6b6b'
        : isHealthySynced
          ? '#10b981'
          : 'var(--c-text-secondary)';
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
          {onAccountSettings && (
            <button
              type="button"
              onClick={onAccountSettings}
              aria-label="Account settings"
              style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                padding: 0, border: '1px solid rgba(128,128,128,0.15)',
                background: 'rgba(128,128,128,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--c-text-secondary)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>settings</span>
            </button>
          )}
        </div>

        <div style={{ ...rowStyle, alignItems: 'center', gap: 10 }}>
          {isSyncing ? (
            <StudioSpinner outerSize="h-[18px] w-[18px]" childSize="h-[14px] w-[14px]" colorFrom={iconColor} colorTo={iconColor} />
          ) : (
            <span
              className={`material-symbols-outlined sync-icon ${justSynced ? 'sync-pop' : ''}`}
              style={{ fontSize: 18, color: iconColor, transition: 'color 250ms ease' }}
            >
              {iconName}
            </span>
          )}
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
        <div style={{ padding: '10px 14px 16px', display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Card header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px',
            background: `linear-gradient(135deg, ${accent.from}14, ${accent.to}0c)`,
            border: `1px solid ${accent.from}28`,
            borderRadius: '14px 14px 0 0',
            borderBottom: 'none',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: `linear-gradient(135deg, ${accent.from}30, ${accent.to}20)`,
              border: `1px solid ${accent.from}35`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 17, color: accent.from }}>mail</span>
            </div>
            <div>
              <p style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 13, color: 'var(--c-text-primary)', margin: 0 }}>
                {mode === 'email-signin' ? t.signIn : t.register}
              </p>
              <p style={{ fontFamily: 'Inter', fontSize: 10.5, color: 'var(--c-text-secondary)', margin: '1px 0 0' }}>
                {mode === 'email-signin' ? t.emailPlaceholder : t.namePlaceholder}
              </p>
            </div>
          </div>

          {/* Card body */}
          <div style={{
            background: 'var(--app-surface-high)',
            border: `1px solid ${accent.from}20`,
            borderRadius: '0 0 14px 14px',
            padding: '14px 14px 12px',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
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
              <AnimatedActionButton
                onClick={doEmail}
                disabled={busy}
                wrapStyle={{ flex: 1 }}
                style={{
                  ...primaryBtn(accent),
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {busy ? <AppSpinner size={14} color="white" strokeWidth={2} /> : null}
                {mode === 'email-signin' ? t.signIn : t.register}
              </AnimatedActionButton>
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

// ── Reusable sheet header ────────────────────────────────────────────────────
function SheetHeader({ title, onClose, titleColor }: {
  title: string; onClose: () => void; accent?: { from: string; to: string }; titleColor?: string;
}) {
  return (
    <div style={{ padding: '6px 22px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <p style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 18, color: titleColor ?? 'var(--c-text-primary)', margin: 0 }}>
        {title}
      </p>
      <button
        onClick={onClose}
        style={{ color: 'var(--c-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        aria-label="close"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
      </button>
    </div>
  );
}

// ── Account Settings Page ────────────────────────────────────────────────────
type AccountActiveSheet = 'none' | 'signout' | 'disable' | 'delete' | 'editname' | 'password' | 'verifyemail'
  | 'personal-info' | 'security-login' | 'subscription' | 'devices-sessions' | 'privacy-data';

export function AccountSettingsPage({ accent, cardStyle, onBack }: {
  accent: { from: string; to: string; mid: string };
  cardStyle: React.CSSProperties;
  onBack: () => void;
}) {
  const tRoot = useT();
  const t = tRoot.hub.accountSection;
  const lang        = useChordStore((s) => s.settings.language) ?? 'en';
  const favCount    = useChordStore(s => s.favorites?.length    ?? 0);
  const progCount   = useChordStore(s => s.progressions?.length ?? 0);
  const presetCount = useChordStore(s => s.presets?.length      ?? 0);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [avatarIcon, setAvatarIcon] = useState<AvatarIcon | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerClosing, setPickerClosing] = useState(false);
  const [customPhoto, setCustomPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<AccountActiveSheet>('none');
  const [sheetClosing, setSheetClosing] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => subscribeAuth(setUser), []);
  useEffect(() => {
    const refresh = () => setAvatarIcon(getUserAvatar(user?.uid ?? null));
    refresh();
    return subscribeUserAvatar(refresh);
  }, [user?.uid]);
  useEffect(() => { setPhotoFailed(false); }, [user?.uid, user?.photoURL]);
  useEffect(() => {
    if (!user?.uid) { setCustomPhoto(null); return; }
    try {
      const stored = localStorage.getItem(`chordex_cp_${user.uid}`);
      setCustomPhoto(stored || null);
    } catch { setCustomPhoto(null); }
  }, [user?.uid]);

  if (!user || !isFirebaseConfigured) return null;

  const initial = (user.displayName || user.email || '?').trim().charAt(0).toUpperCase();
  const effectivePhoto = customPhoto || (user.photoURL && !photoFailed ? user.photoURL : null);
  const providers = getSignInProviders();
  const isEmailUser = providers.includes('password');
  const isGoogleUser = providers.includes('google.com');
  const emailVerified = isEmailVerified();
  const emailToConfirm = (user.email ?? '').trim().toLowerCase();

  const L = lang === 'es' ? {
    profile: 'Perfil',
    displayName: 'Nombre de usuario',
    email: 'Email',
    signInMethod: 'Inicio de sesión',
    google: 'Google',
    emailPass: 'Email',
    emailVerified: 'Email verificado',
    emailNotVerified: 'Email sin verificar',
    security: 'Seguridad',
    changePassword: 'Cambiar contraseña',
    changePasswordDesc: 'Te enviaremos un enlace de restablecimiento',
    verifyEmail: 'Verificar email',
    verifyEmailDesc: 'Te enviaremos un email de verificación',
    session: 'Sesión',
    signOut: t.signOut,
    signOutDesc: 'Cerrar sesión en este dispositivo',
    dangerZone: t.dangerZone,
    disableAccount: 'Deshabilitar cuenta',
    disableAccountDesc: 'Desactiva tu cuenta temporalmente',
    deleteAccount: t.deleteAccount,
    deleteAccountDesc: 'Eliminar permanentemente',
    signOutTitle: t.signOutConfirmTitle,
    signOutBody: t.signOutConfirmBody,
    editNameTitle: 'Editar nombre',
    namePlaceholder: 'Tu nombre',
    saveBtn: 'Guardar',
    passwordTitle: 'Cambiar contraseña',
    passwordBody: (email: string) => `Te enviaremos un enlace a ${email}`,
    sendBtn: 'Enviar enlace',
    verifyTitle: 'Verificar email',
    verifyBody: (email: string) => `Te enviaremos verificación a ${email}`,
    sendVerifyBtn: 'Enviar verificación',
    disableTitle: '¿Deshabilitar cuenta?',
    disableBody: 'Tu cuenta quedará deshabilitada. Podrás reactivarla al volver a iniciar sesión.',
    disableTypeEmail: 'Escribe tu email para confirmar',
    disableBtn: 'Deshabilitar',
    deleteTitle: t.deleteAccountConfirmTitle,
    deleteBody: t.deleteAccountConfirmBody,
    deleteTypeEmail: t.deleteAccountTypeEmail,
    deleteBtn: t.deleteAccountFinal,
    cancel: t.cancel,
    nameSaved: 'Nombre actualizado',
    passwordResetSent: 'Email de restablecimiento enviado',
    verificationSent: 'Email de verificación enviado',
  } : {
    profile: 'Profile',
    displayName: 'Display name',
    email: 'Email',
    signInMethod: 'Sign-in method',
    google: 'Google',
    emailPass: 'Email & password',
    emailVerified: 'Email verified',
    emailNotVerified: 'Email not verified',
    security: 'Security',
    changePassword: 'Change password',
    changePasswordDesc: "We'll send a reset link to your inbox",
    verifyEmail: 'Verify email',
    verifyEmailDesc: "We'll send a verification link",
    session: 'Session',
    signOut: t.signOut,
    signOutDesc: 'Sign out of this device',
    dangerZone: t.dangerZone,
    disableAccount: 'Disable account',
    disableAccountDesc: 'Temporarily deactivate your account',
    deleteAccount: t.deleteAccount,
    deleteAccountDesc: 'Permanently remove your account',
    signOutTitle: t.signOutConfirmTitle,
    signOutBody: t.signOutConfirmBody,
    editNameTitle: 'Edit display name',
    namePlaceholder: 'Your name',
    saveBtn: 'Save',
    passwordTitle: 'Change password',
    passwordBody: (email: string) => `We'll send a reset link to ${email}`,
    sendBtn: 'Send reset link',
    verifyTitle: 'Verify your email',
    verifyBody: (email: string) => `We'll send a verification link to ${email}`,
    sendVerifyBtn: 'Send verification',
    disableTitle: 'Disable account?',
    disableBody: 'Your account will be disabled. You can re-enable it by signing back in.',
    disableTypeEmail: 'Type your email to confirm',
    disableBtn: 'Disable account',
    deleteTitle: t.deleteAccountConfirmTitle,
    deleteBody: t.deleteAccountConfirmBody,
    deleteTypeEmail: t.deleteAccountTypeEmail,
    deleteBtn: t.deleteAccountFinal,
    cancel: t.cancel,
    nameSaved: 'Display name updated',
    passwordResetSent: 'Password reset email sent',
    verificationSent: 'Verification email sent',
  };

  function openSheet(s: AccountActiveSheet) {
    setErr(null);
    setEmailInput('');
    setNameInput(user?.displayName ?? '');
    setSheetClosing(false);
    setSheet(s);
  }

  function closeSheet() {
    setSheetClosing(true);
    setTimeout(() => { setSheet('none'); setSheetClosing(false); setEmailInput(''); setErr(null); }, 280);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function doSignOut() {
    try { await signOut(); }
    catch { /* noop */ }
  }

  async function doDisable() {
    if (!user || busy) return;
    setBusy(true); setErr(null);
    try {
      await disableAccount(user.uid);
      closeSheet();
      try { await signOut(); } catch { /* noop */ }
    } catch (e) {
      setErr(prettyErr(e, lang));
    } finally { setBusy(false); }
  }

  async function doDelete() {
    if (!user || busy) return;
    setBusy(true); setErr(null);
    try {
      await scheduleAccountDeletion(user.uid);
      closeSheet();
      try { await signOut(); } catch { /* noop */ }
    } catch (e) {
      setErr(prettyErr(e, lang));
    } finally { setBusy(false); }
  }

  async function doSaveName() {
    if (!user || busy) return;
    setBusy(true); setErr(null);
    try {
      await updateDisplayName(nameInput);
      closeSheet();
      showToast(L.nameSaved);
    } catch (e) {
      setErr(prettyErr(e, lang));
    } finally { setBusy(false); }
  }

  async function doSendPasswordReset() {
    if (!user?.email || busy) return;
    setBusy(true); setErr(null);
    try {
      await sendPasswordReset(user.email);
      closeSheet();
      showToast(L.passwordResetSent);
    } catch (e) {
      setErr(prettyErr(e, lang));
    } finally { setBusy(false); }
  }

  async function doSendVerification() {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      await sendVerificationEmail();
      closeSheet();
      showToast(L.verificationSent);
    } catch (e) {
      setErr(prettyErr(e, lang));
    } finally { setBusy(false); }
  }

  function handlePhotoFile(file: File) {
    if (!user?.uid || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      try { localStorage.setItem(`chordex_cp_${user!.uid}`, dataUrl); } catch { /* quota */ }
      setCustomPhoto(dataUrl);
      setUserAvatar(user!.uid, null);
    };
    reader.readAsDataURL(file);
  }

  function clearCustomPhoto() {
    if (!user?.uid) return;
    localStorage.removeItem(`chordex_cp_${user.uid}`);
    setCustomPhoto(null);
  }

  const canConfirmEmail = !busy
    && !!emailToConfirm
    && emailInput.trim().toLowerCase() === emailToConfirm;

  const sheetAnim = sheetClosing
    ? 'sheet-down 280ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both'
    : 'sheet-up 340ms cubic-bezier(0.34, 1.42, 0.64, 1) both';
  const overlayAnim = sheetClosing ? 'fade-out 280ms ease both' : 'sync-fade-in 200ms ease both';
  const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 9999, animation: overlayAnim };
  const backdropStyle: React.CSSProperties = {
    position: 'absolute', inset: 0,
    background: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
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

  function SettingsRow({ icon, label, badge, onPress, last = false }: {
    icon: string; label: string; badge?: string; onPress: () => void; last?: boolean;
  }) {
    const [pressed, setPressed] = useState(false);
    return (
      <button
        onClick={onPress}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          width: '100%', padding: '15px 16px',
          background: pressed ? 'rgba(128,128,128,0.06)' : 'transparent',
          border: 'none', outline: 'none',
          borderBottom: last ? 'none' : '1px solid rgba(128,128,128,0.07)',
          cursor: 'pointer', textAlign: 'left' as const,
          transform: pressed ? 'scale(0.99)' : 'scale(1)',
          transition: 'background 100ms ease, transform 140ms ease',
          boxSizing: 'border-box' as const,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--c-text-primary)', opacity: 0.7, flexShrink: 0 }}>{icon}</span>
        <span style={{ flex: 1, fontFamily: 'Manrope', fontWeight: 600, fontSize: 15, color: 'var(--c-text-primary)' }}>{label}</span>
        {badge && (
          <span style={{
            fontFamily: 'Manrope', fontWeight: 700, fontSize: 9,
            color: 'var(--c-text-secondary)',
            background: 'rgba(128,128,128,0.12)',
            border: '1px solid rgba(128,128,128,0.15)',
            borderRadius: 6, padding: '3px 8px',
            textTransform: 'uppercase' as const, letterSpacing: '0.04em',
          }}>{badge}</span>
        )}
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--c-text-secondary)', opacity: 0.35, flexShrink: 0 }}>chevron_right</span>
      </button>
    );
  }

  return (
    <>
      <SyncAnimations />
      <SheetAnimations />

      {/* Hidden file input for custom photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handlePhotoFile(file);
          e.target.value = '';
        }}
      />

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: 'max(52px, calc(env(safe-area-inset-top) + 12px))',
          left: '50%', transform: 'translateX(-50%)',
          background: '#10b981', color: '#fff',
          padding: '8px 18px', borderRadius: 999,
          fontFamily: 'Manrope', fontWeight: 700, fontSize: 13,
          boxShadow: '0 4px 16px rgba(16,185,129,0.4)',
          zIndex: 10001, whiteSpace: 'nowrap',
          animation: 'sync-fade-in 250ms ease both',
          pointerEvents: 'none',
        }}>
          {toast}
        </div>
      )}

      {/* ── Profile header ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '22px 20px 24px', animation: 'hub-row-fade 350ms ease both' }}>
        {/* Avatar — tap to open Personal Information */}
        <button
          type="button"
          onClick={() => openSheet('personal-info')}
          aria-label="Edit profile"
          style={{
            width: 84, height: 84, borderRadius: '50%',
            padding: 0, border: `3px solid ${accent.from}50`, cursor: 'pointer',
            background: effectivePhoto && !avatarIcon
              ? 'transparent'
              : `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 34, overflow: 'hidden',
            boxShadow: `0 8px 28px ${accent.to}55`,
            position: 'relative',
          }}
        >
          {avatarIcon ? (
            <span className="material-symbols-outlined" style={{ fontSize: 44, color: '#fff' }}>{avatarIcon}</span>
          ) : effectivePhoto ? (
            <img src={effectivePhoto} alt="" referrerPolicy="no-referrer"
              onError={() => { if (effectivePhoto === user.photoURL) setPhotoFailed(true); }}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span>{initial}</span>
          )}
        </button>

        {/* Identity */}
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <p style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 20, color: 'var(--c-text-primary)', margin: 0, letterSpacing: '-0.025em' }}>
            {user.displayName || user.email}
          </p>
          {user.displayName && (
            <p style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--c-text-secondary)', margin: '4px 0 0' }}>
              {user.email}
            </p>
          )}
          {/* Free Member badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            marginTop: 10, padding: '4px 12px 4px 10px',
            borderRadius: 9999,
            background: `${accent.from}18`,
            border: `1px solid ${accent.from}35`,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13, color: accent.from, fontVariationSettings: "'FILL' 1" }}>verified</span>
            <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 11, color: accent.from, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {lang === 'es' ? 'Miembro Gratis' : 'Free Member'}
            </span>
          </div>
        </div>

        {/* On-device stats */}
        <div style={{ display: 'flex', gap: 8, marginTop: 20, width: '100%' }}>
          {([
            { label: lang === 'es' ? 'Favoritos' : 'Favorites', value: favCount,    icon: 'favorite',    color: accent.from   },
            { label: lang === 'es' ? 'Progres.'  : 'Progressions', value: progCount, icon: 'queue_music', color: '#10b981'     },
            { label: lang === 'es' ? 'Presets'   : 'Presets',   value: presetCount, icon: 'grid_view',   color: '#f59e0b'     },
          ] as { label: string; value: number; icon: string; color: string }[]).map(({ label, value, icon, color }) => (
            <div key={label} style={{
              flex: 1, background: 'var(--app-surface)',
              border: '1px solid rgba(128,128,128,0.09)', borderRadius: 16,
              padding: '13px 8px 11px', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 5,
              boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 17, color, fontVariationSettings: "'FILL' 1" }}>{icon}</span>
              <p style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 22, color: 'var(--c-text-primary)', margin: 0, lineHeight: 1 }}>{value}</p>
              <p style={{ fontFamily: 'Inter', fontSize: 9.5, color: 'var(--c-text-secondary)', margin: 0, fontWeight: 600, textAlign: 'center', lineHeight: 1.3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main settings list ── */}
      <div style={{ padding: '0 16px' }}>

        {/* Section label */}
        <p style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 11, color: 'var(--c-text-secondary)', letterSpacing: '0.18em', textTransform: 'uppercase', margin: '0 0 10px', animation: 'hub-row-fade 380ms ease 50ms both' }}>
          {lang === 'es' ? 'Preferencias y cuenta' : 'Preferences & Account'}
        </p>

        {/* Grouped settings card — all 5 options in one rectangle */}
        <div style={{ ...cardStyle, animation: 'hub-row-fade 380ms ease 70ms both' }}>
          <SettingsRow icon="person" label={lang === 'es' ? 'Información personal' : 'Personal Information'} onPress={() => openSheet('personal-info')} />
          <SettingsRow icon="lock" label={lang === 'es' ? 'Seguridad y acceso' : 'Security & Login'} onPress={() => openSheet('security-login')} />
          <SettingsRow icon="workspace_premium" label={lang === 'es' ? 'Suscripción y facturación' : 'Subscription & Billing'} badge={lang === 'es' ? 'Próximamente' : 'Coming soon'} onPress={() => openSheet('subscription')} />
          <SettingsRow icon="devices" label={lang === 'es' ? 'Dispositivos y sesiones' : 'Devices & Sessions'} onPress={() => openSheet('devices-sessions')} />
          <SettingsRow icon="shield" label={lang === 'es' ? 'Privacidad y datos' : 'Privacy & Data'} onPress={() => openSheet('privacy-data')} last />
        </div>

        {/* Sign Out — prominent red button */}
        <button
          type="button"
          onClick={() => openSheet('signout')}
          style={{
            width: '100%', marginTop: 16, padding: '15px 0',
            borderRadius: '1.25rem',
            background: 'rgba(255,107,107,0.07)',
            border: '1px solid rgba(255,107,107,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            color: '#ff6b6b', fontFamily: 'Manrope', fontWeight: 700, fontSize: 15,
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            animation: 'hub-row-fade 380ms ease 160ms both',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 19 }}>logout</span>
          {L.signOut}
        </button>

        {/* Delete Account — destructive section at bottom */}
        <div style={{
          marginTop: 28, marginBottom: 40,
          padding: '18px 18px 16px',
          background: 'rgba(255,107,107,0.04)',
          border: '1px solid rgba(255,107,107,0.11)',
          borderRadius: '1.25rem',
          animation: 'hub-row-fade 380ms ease 200ms both',
        }}>
          <p style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 14, color: '#ff6b6b', margin: '0 0 6px' }}>
            {L.deleteAccount}
          </p>
          <p style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--c-text-secondary)', margin: '0 0 16px', lineHeight: 1.6 }}>
            {lang === 'es'
              ? 'Tu cuenta entrará en un período de recuperación de 7 días antes de la eliminación permanente. Iniciar sesión durante este período restaura la cuenta.'
              : 'Your account will enter a 7-day recovery period before permanent deletion. Logging back in during this period restores the account.'}
          </p>
          <button
            type="button"
            onClick={() => openSheet('delete')}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 12,
              background: 'rgba(255,107,107,0.09)',
              border: '1px solid rgba(255,107,107,0.28)',
              color: '#ff6b6b', fontFamily: 'Manrope', fontWeight: 700, fontSize: 13,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete_forever</span>
            {L.deleteAccount}
          </button>
        </div>

      </div>{/* end settings list */}

      {/* Avatar picker */}
      {pickerOpen && createPortal(
        <AvatarPickerSheet
          accent={accent}
          currentIcon={avatarIcon}
          hasGooglePhoto={!!user.photoURL && !photoFailed}
          t={t}
          closing={pickerClosing}
          onPick={(icon) => { setUserAvatar(user.uid, icon); }}
          onClose={() => { setPickerClosing(true); setTimeout(() => { setPickerOpen(false); setPickerClosing(false); }, 280); }}
        />,
        document.body,
      )}

      {/* ── Sign out sheet ── */}
      {sheet === 'signout' && createPortal(
        <div style={overlayStyle}>
          <div style={backdropStyle} onClick={closeSheet} />
          <div style={sheetStyle}>
            {dragPill}
            <SheetHeader title={L.signOutTitle} onClose={closeSheet} />
            <p style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--c-text-secondary)', lineHeight: 1.5, margin: '8px 22px 20px' }}>{L.signOutBody}</p>
            <div style={{ display: 'flex', gap: 10, padding: '0 16px' }}>
              <button onClick={closeSheet} style={{ ...secondaryBtn(), flex: 1, padding: '13px 0' }}>{L.cancel}</button>
              <button onClick={doSignOut} style={{ ...dangerOutlineBtn(), flex: 1, padding: '13px 0' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
                {L.signOut}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ── Edit display name sheet ── */}
      {sheet === 'editname' && createPortal(
        <div style={overlayStyle}>
          <div style={backdropStyle} onClick={closeSheet} />
          <div style={sheetStyle}>
            {dragPill}
            <SheetHeader title={L.editNameTitle} onClose={closeSheet} />
            <div style={{ padding: '8px 22px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') doSaveName(); }}
                placeholder={L.namePlaceholder}
                autoFocus
                style={inputStyle(accent)}
              />
              {err && <p style={{ fontSize: 11, color: '#ff6b6b', margin: 0 }}>{err}</p>}
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '0 16px' }}>
              <button onClick={closeSheet} disabled={busy} style={{ ...secondaryBtn(), flex: 1, padding: '13px 0' }}>{L.cancel}</button>
              <button onClick={doSaveName} disabled={busy} style={{ ...primaryBtn(accent), flex: 1, padding: '13px 0' }}>
                {busy ? <span className="material-symbols-outlined sync-spin" style={{ fontSize: 16 }}>progress_activity</span> : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span>}
                {L.saveBtn}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ── Change password sheet ── */}
      {sheet === 'password' && createPortal(
        <div style={overlayStyle}>
          <div style={backdropStyle} onClick={closeSheet} />
          <div style={sheetStyle}>
            {dragPill}
            <SheetHeader title={L.passwordTitle} onClose={closeSheet} />
            <div style={{ padding: '8px 22px 20px' }}>
              <p style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--c-text-secondary)', lineHeight: 1.5, margin: 0 }}>{L.passwordBody(user.email ?? '')}</p>
              {err && <p style={{ fontSize: 11, color: '#ff6b6b', margin: '10px 0 0' }}>{err}</p>}
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '0 16px' }}>
              <button onClick={closeSheet} disabled={busy} style={{ ...secondaryBtn(), flex: 1, padding: '13px 0' }}>{L.cancel}</button>
              <button onClick={doSendPasswordReset} disabled={busy} style={{ ...primaryBtn(accent), flex: 1, padding: '13px 0' }}>
                {busy ? <span className="material-symbols-outlined sync-spin" style={{ fontSize: 16 }}>progress_activity</span> : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>}
                {L.sendBtn}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ── Verify email sheet ── */}
      {sheet === 'verifyemail' && createPortal(
        <div style={overlayStyle}>
          <div style={backdropStyle} onClick={closeSheet} />
          <div style={sheetStyle}>
            {dragPill}
            <SheetHeader title={L.verifyTitle} onClose={closeSheet} />
            <div style={{ padding: '8px 22px 20px' }}>
              <p style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--c-text-secondary)', lineHeight: 1.5, margin: 0 }}>{L.verifyBody(user.email ?? '')}</p>
              {err && <p style={{ fontSize: 11, color: '#ff6b6b', margin: '10px 0 0' }}>{err}</p>}
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '0 16px' }}>
              <button onClick={closeSheet} disabled={busy} style={{ ...secondaryBtn(), flex: 1, padding: '13px 0' }}>{L.cancel}</button>
              <button onClick={doSendVerification} disabled={busy} style={{ ...primaryBtn(accent), flex: 1, padding: '13px 0' }}>
                {busy ? <span className="material-symbols-outlined sync-spin" style={{ fontSize: 16 }}>progress_activity</span> : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>mark_email_read</span>}
                {L.sendVerifyBtn}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ── Disable account sheet ── */}
      {sheet === 'disable' && createPortal(
        <div style={overlayStyle}>
          <div style={backdropStyle} onClick={closeSheet} />
          <div style={sheetStyle}>
            {dragPill}
            <SheetHeader title={L.disableTitle} onClose={closeSheet} titleColor="#f59e0b" />
            <div style={{ padding: '8px 22px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--c-text-secondary)', lineHeight: 1.5, margin: 0 }}>{L.disableBody}</p>
              <p style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--c-text-secondary)', margin: 0 }}>
                {L.disableTypeEmail}: <strong style={{ color: 'var(--c-text-primary)' }}>{user.email}</strong>
              </p>
              <input
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder={user.email ?? ''}
                autoComplete="off"
                spellCheck={false}
                style={{ ...inputStyle(accent), borderColor: canConfirmEmail ? '#f59e0b66' : 'rgba(245,158,11,0.2)' }}
              />
              {err && <p style={{ fontSize: 11, color: '#ff6b6b', margin: 0 }}>{err}</p>}
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '0 16px' }}>
              <button onClick={closeSheet} disabled={busy} style={{ ...secondaryBtn(), flex: 1, padding: '13px 0' }}>{L.cancel}</button>
              <button
                onClick={doDisable}
                disabled={!canConfirmEmail}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: 12, fontSize: 13, fontWeight: 700,
                  background: canConfirmEmail ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(245,158,11,0.12)',
                  border: '1px solid rgba(245,158,11,0.35)',
                  color: canConfirmEmail ? '#fff' : '#f59e0b',
                  fontFamily: 'Manrope', cursor: canConfirmEmail ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: canConfirmEmail ? 1 : 0.5,
                }}
              >
                {busy ? <span className="material-symbols-outlined sync-spin" style={{ fontSize: 16 }}>progress_activity</span> : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>block</span>}
                {L.disableBtn}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ── Delete account sheet ── */}
      {sheet === 'delete' && createPortal(
        <div style={overlayStyle}>
          <div style={backdropStyle} onClick={closeSheet} />
          <div style={sheetStyle}>
            {dragPill}
            <SheetHeader title={L.deleteTitle} onClose={closeSheet} titleColor="#ff6b6b" />
            <div style={{ padding: '8px 22px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--c-text-secondary)', lineHeight: 1.5, margin: 0 }}>{L.deleteBody}</p>
              <p style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--c-text-secondary)', margin: 0 }}>
                {L.deleteTypeEmail}: <strong style={{ color: 'var(--c-text-primary)' }}>{user.email}</strong>
              </p>
              <input
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder={user.email ?? ''}
                autoComplete="off"
                spellCheck={false}
                style={{ ...inputStyle(accent), borderColor: canConfirmEmail ? '#ff6b6b66' : 'rgba(255,107,107,0.2)' }}
              />
              {err && <p style={{ fontSize: 11, color: '#ff6b6b', margin: 0 }}>{err}</p>}
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '0 16px' }}>
              <button onClick={closeSheet} disabled={busy} style={{ ...secondaryBtn(), flex: 1, padding: '13px 0' }}>{L.cancel}</button>
              <button
                onClick={doDelete}
                disabled={!canConfirmEmail}
                style={{ ...dangerSolidBtn(), flex: 1, padding: '13px 0', opacity: canConfirmEmail ? 1 : 0.45, cursor: canConfirmEmail ? 'pointer' : 'not-allowed' }}
              >
                {busy ? <span className="material-symbols-outlined sync-spin" style={{ fontSize: 16 }}>progress_activity</span> : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete_forever</span>}
                {L.deleteBtn}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ── Personal Information sheet ── */}
      {sheet === 'personal-info' && createPortal(
        <div style={overlayStyle}>
          <div style={backdropStyle} onClick={closeSheet} />
          <div style={sheetStyle}>
            {dragPill}
            <SheetHeader title={lang === 'es' ? 'Información personal' : 'Personal Information'} onClose={closeSheet} />
            {/* Avatar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 22px 20px', borderBottom: '1px solid rgba(128,128,128,0.08)' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: effectivePhoto && !avatarIcon
                  ? 'transparent'
                  : `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 800, fontSize: 28, overflow: 'hidden',
                border: `2px solid ${accent.from}40`,
              }}>
                {avatarIcon ? (
                  <span className="material-symbols-outlined" style={{ fontSize: 38, color: '#fff' }}>{avatarIcon}</span>
                ) : effectivePhoto ? (
                  <img src={effectivePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span>{initial}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                    background: `${accent.from}18`, border: `1px solid ${accent.from}30`,
                    color: accent.from, fontFamily: 'Manrope', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>photo_camera</span>
                  {lang === 'es' ? 'Subir foto' : 'Upload photo'}
                </button>
                <button
                  onClick={() => { setPickerClosing(false); setPickerOpen(true); closeSheet(); }}
                  style={{
                    padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                    background: 'rgba(128,128,128,0.10)', border: '1px solid rgba(128,128,128,0.18)',
                    color: 'var(--c-text-primary)', fontFamily: 'Manrope', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>emoji_emotions</span>
                  {lang === 'es' ? 'Elegir icono' : 'Choose icon'}
                </button>
                {(customPhoto || avatarIcon) && (
                  <button
                    onClick={() => { clearCustomPhoto(); setUserAvatar(user.uid, null); }}
                    style={{
                      padding: '8px 10px', borderRadius: 10,
                      background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)',
                      color: '#ff6b6b', cursor: 'pointer', display: 'flex', alignItems: 'center',
                    }}
                    aria-label="Reset photo"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                  </button>
                )}
              </div>
            </div>
            {/* Display name row */}
            <button
              onClick={() => { closeSheet(); setTimeout(() => openSheet('editname'), 310); }}
              style={{
                display: 'flex', alignItems: 'center', width: '100%',
                padding: '15px 22px', background: 'none', border: 'none',
                borderBottom: '1px solid rgba(128,128,128,0.07)', cursor: 'pointer', textAlign: 'left' as const,
              }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: 'Inter', fontSize: 11, color: 'var(--c-text-secondary)', margin: 0, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{lang === 'es' ? 'Nombre' : 'Display name'}</p>
                <p style={{ fontFamily: 'Manrope', fontWeight: 600, fontSize: 15, color: 'var(--c-text-primary)', margin: '3px 0 0' }}>{user.displayName || '—'}</p>
              </div>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--c-text-secondary)', opacity: 0.35 }}>chevron_right</span>
            </button>
            {/* Email row */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '15px 22px' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: 'Inter', fontSize: 11, color: 'var(--c-text-secondary)', margin: 0, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Email</p>
                <p style={{ fontFamily: 'Manrope', fontWeight: 600, fontSize: 15, color: 'var(--c-text-primary)', margin: '3px 0 0' }}>{user.email || '—'}</p>
              </div>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: emailVerified ? '#10b981' : '#f59e0b', fontVariationSettings: "'FILL' 1" }}>
                {emailVerified ? 'check_circle' : 'warning'}
              </span>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ── Security & Login sheet ── */}
      {sheet === 'security-login' && createPortal(
        <div style={overlayStyle}>
          <div style={backdropStyle} onClick={closeSheet} />
          <div style={sheetStyle}>
            {dragPill}
            <SheetHeader title={lang === 'es' ? 'Seguridad y acceso' : 'Security & Login'} onClose={closeSheet} />
            <div style={{ padding: '6px 22px 0' }}>
              <p style={{ fontFamily: 'Inter', fontSize: 11, color: 'var(--c-text-secondary)', margin: '0 0 8px', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                {lang === 'es' ? 'Método de inicio de sesión' : 'Sign-in method'}
              </p>
              <div style={{ background: 'rgba(128,128,128,0.06)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--c-text-primary)', opacity: 0.7, fontVariationSettings: "'FILL' 1" }}>
                  {isGoogleUser ? 'account_circle' : 'mail'}
                </span>
                <div>
                  <p style={{ fontFamily: 'Manrope', fontWeight: 600, fontSize: 14, color: 'var(--c-text-primary)', margin: 0 }}>
                    {isGoogleUser ? 'Google' : L.emailPass}
                  </p>
                  <p style={{ fontFamily: 'Inter', fontSize: 11.5, color: 'var(--c-text-secondary)', margin: '2px 0 0' }}>{user.email}</p>
                </div>
              </div>
            </div>
            <div style={{ padding: '10px 22px 0' }}>
              <div style={{ background: 'rgba(128,128,128,0.06)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: emailVerified ? '#10b981' : '#f59e0b', fontVariationSettings: "'FILL' 1" }}>
                  {emailVerified ? 'check_circle' : 'warning'}
                </span>
                <p style={{ flex: 1, fontFamily: 'Manrope', fontWeight: 600, fontSize: 14, color: 'var(--c-text-primary)', margin: 0 }}>
                  {emailVerified ? (lang === 'es' ? 'Email verificado' : 'Email verified') : (lang === 'es' ? 'Email sin verificar' : 'Email not verified')}
                </p>
                {!emailVerified && isEmailUser && (
                  <button
                    onClick={() => { closeSheet(); setTimeout(() => openSheet('verifyemail'), 310); }}
                    style={{
                      padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                      background: `${accent.from}18`, border: `1px solid ${accent.from}30`,
                      color: accent.from, fontFamily: 'Manrope', cursor: 'pointer',
                    }}
                  >
                    {lang === 'es' ? 'Verificar' : 'Verify'}
                  </button>
                )}
              </div>
            </div>
            {isEmailUser && (
              <button
                onClick={() => { closeSheet(); setTimeout(() => openSheet('password'), 310); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  padding: '15px 22px', background: 'none', border: 'none',
                  borderTop: '1px solid rgba(128,128,128,0.07)', marginTop: 10,
                  cursor: 'pointer', textAlign: 'left' as const,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--c-text-primary)', opacity: 0.65 }}>lock_reset</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: 'Manrope', fontWeight: 600, fontSize: 15, color: 'var(--c-text-primary)', margin: 0 }}>{L.changePassword}</p>
                  <p style={{ fontFamily: 'Inter', fontSize: 11.5, color: 'var(--c-text-secondary)', margin: '2px 0 0' }}>{L.changePasswordDesc}</p>
                </div>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--c-text-secondary)', opacity: 0.35 }}>chevron_right</span>
              </button>
            )}
            <button
              onClick={() => { closeSheet(); setTimeout(() => openSheet('disable'), 310); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '15px 22px', background: 'none', border: 'none',
                borderTop: '1px solid rgba(128,128,128,0.07)',
                cursor: 'pointer', textAlign: 'left' as const,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#f59e0b', opacity: 0.85 }}>block</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: 'Manrope', fontWeight: 600, fontSize: 15, color: '#f59e0b', margin: 0 }}>{L.disableAccount}</p>
                <p style={{ fontFamily: 'Inter', fontSize: 11.5, color: 'var(--c-text-secondary)', margin: '2px 0 0' }}>{L.disableAccountDesc}</p>
              </div>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--c-text-secondary)', opacity: 0.35 }}>chevron_right</span>
            </button>
          </div>
        </div>,
        document.body,
      )}

      {/* ── Subscription & Billing sheet ── */}
      {sheet === 'subscription' && createPortal(
        <div style={overlayStyle}>
          <div style={backdropStyle} onClick={closeSheet} />
          <div style={sheetStyle}>
            {dragPill}
            <SheetHeader title={lang === 'es' ? 'Suscripción y facturación' : 'Subscription & Billing'} onClose={closeSheet} />
            <div style={{ padding: '16px 22px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: `${accent.from}18`, border: `1px solid ${accent.from}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 28, color: accent.from, fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 20, color: 'var(--c-text-primary)', margin: 0 }}>
                  {lang === 'es' ? 'Próximamente' : 'Coming soon'}
                </p>
                <p style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--c-text-secondary)', margin: '10px 0 0', lineHeight: 1.7 }}>
                  {lang === 'es'
                    ? 'Estamos preparando planes premium con funciones exclusivas. Por ahora, disfruta del plan gratuito.'
                    : "We're working on premium plans with exclusive features. For now, enjoy the free plan."}
                </p>
              </div>
              <div style={{
                width: '100%', padding: '14px 16px',
                background: `${accent.from}10`, border: `1px solid ${accent.from}25`,
                borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: accent.from, fontVariationSettings: "'FILL' 1" }}>verified</span>
                <div>
                  <p style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: 'var(--c-text-primary)', margin: 0 }}>
                    {lang === 'es' ? 'Plan actual · Gratis' : 'Current plan · Free'}
                  </p>
                  <p style={{ fontFamily: 'Inter', fontSize: 11, color: 'var(--c-text-secondary)', margin: '2px 0 0' }}>
                    {lang === 'es' ? 'Acceso completo a las funciones básicas' : 'Full access to core features'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ── Devices & Sessions sheet ── */}
      {sheet === 'devices-sessions' && createPortal(
        <div style={overlayStyle}>
          <div style={backdropStyle} onClick={closeSheet} />
          <div style={sheetStyle}>
            {dragPill}
            <SheetHeader title={lang === 'es' ? 'Dispositivos y sesiones' : 'Devices & Sessions'} onClose={closeSheet} />
            <div style={{ padding: '8px 22px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'rgba(128,128,128,0.06)', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--c-text-primary)', opacity: 0.7 }}>smartphone</span>
                  <div>
                    <p style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: 'var(--c-text-primary)', margin: 0 }}>
                      {lang === 'es' ? 'Este dispositivo' : 'This device'}
                    </p>
                    <p style={{ fontFamily: 'Inter', fontSize: 11.5, color: '#10b981', margin: '2px 0 0', fontWeight: 600 }}>
                      ● {lang === 'es' ? 'Sesión activa' : 'Active session'}
                    </p>
                  </div>
                </div>
              </div>
              <p style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--c-text-secondary)', margin: 0, lineHeight: 1.6 }}>
                {lang === 'es'
                  ? 'La gestión de múltiples dispositivos estará disponible próximamente.'
                  : 'Multi-device session management is coming soon.'}
              </p>
              <button
                onClick={() => { closeSheet(); setTimeout(() => openSheet('signout'), 310); }}
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 12,
                  background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.20)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  color: '#ff6b6b', fontFamily: 'Manrope', fontWeight: 700, fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
                {lang === 'es' ? 'Cerrar sesión' : 'Sign out of this device'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ── Privacy & Data sheet ── */}
      {sheet === 'privacy-data' && createPortal(
        <div style={overlayStyle}>
          <div style={backdropStyle} onClick={closeSheet} />
          <div style={sheetStyle}>
            {dragPill}
            <SheetHeader title={lang === 'es' ? 'Privacidad y datos' : 'Privacy & Data'} onClose={closeSheet} />
            <div style={{ padding: '8px 22px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: 'rgba(128,128,128,0.06)', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--c-text-primary)', opacity: 0.65, fontVariationSettings: "'FILL' 1" }}>download</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: 'var(--c-text-primary)', margin: 0 }}>
                    {lang === 'es' ? 'Exportar mis datos' : 'Export my data'}
                  </p>
                  <p style={{ fontFamily: 'Inter', fontSize: 11.5, color: 'var(--c-text-secondary)', margin: '2px 0 0' }}>
                    {lang === 'es' ? 'Próximamente' : 'Coming soon'}
                  </p>
                </div>
              </div>
              <p style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--c-text-secondary)', margin: 0, lineHeight: 1.7 }}>
                {lang === 'es'
                  ? 'Tus datos se almacenan de forma segura. Nunca compartimos tu información con terceros sin tu consentimiento.'
                  : 'Your data is stored securely. We never share your information with third parties without your consent.'}
              </p>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
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
