import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AppSpinner from './AppSpinner';
import { Circle, Layers3, BadgeCheck, FlaskConical, ShieldCheck } from 'lucide-react';
import StudioSpinner from './animata/progress/spinner';
import AnimatedActionButton from './animata/container/animated-border-trail';
import StudioAuthCard from './StudioAuthCard';
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
import { subscribeSyncStatus, getSyncStatus, syncNow, retrySync, type SyncStatus, subscribeDevices, deviceId, revokeDeviceSession, resolveMigration, registerDevice, registerCurrentDevice } from '../lib/sync';
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
import { useBackHandler } from '../lib/backStack';
import { logActivity, getActivityEmoji } from '../lib/activityLogger';
import StudioPricingSection from './StudioPricingSection';
import { getFirebaseAuth } from '../lib/firebase';
import { APP_VERSION, APP_COMMIT_SHA, APP_BUILD_TIMESTAMP } from '../lib/appVersion';
import { updateProfile } from 'firebase/auth';

function compressAndResizeImage(file: File, maxWidth = 256, maxHeight = 256): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas conversion failed'));
        }, 'image/jpeg', 0.85);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

async function selectAvatarIcon(user: AuthUser | null, icon: AvatarIcon | null) {
  if (!user?.uid) return;
  setUserAvatar(user.uid, icon);
  try {
    const { syncWriteProfileMain } = await import('../lib/sync');
    await syncWriteProfileMain(user.displayName, user.photoURL, icon);
  } catch (e) {
    console.error('Failed to sync avatar icon selection:', e);
  }
}
import { Capacitor } from '@capacitor/core';
import { Toggle } from './SettingControls';
import {
  subscribeUserProfile,
  isAdminUser,
  isBetaTesterUser,
  hasCoreAccessUser,
  hasProAccessUser,
  type UserProfile,
  type UserRole
} from '../lib/permissions';

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

function renderRoleBadge(role: UserRole | undefined, lang: string, accent: any) {
  const isEs = lang === 'es';
  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 600,
    fontFamily: 'Manrope, sans-serif',
    letterSpacing: '-0.015em',
    boxShadow: 'none',
    border: '1px solid transparent',
  };
  const iconSize = 13;

  switch (role) {
    case 'admin':
      return (
        <div style={{
          ...badgeStyle,
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#ef4444',
        }}>
          <ShieldCheck size={iconSize} style={{ strokeWidth: 2.2 }} />
          <span>Admin</span>
        </div>
      );
    case 'beta_tester':
      return (
        <div style={{
          ...badgeStyle,
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          color: '#f59e0b',
        }}>
          <FlaskConical size={iconSize} style={{ strokeWidth: 2.2 }} />
          <span>{isEs ? 'Probador Beta' : 'Beta Tester'}</span>
        </div>
      );
    case 'pro':
      return (
        <div style={{
          ...badgeStyle,
          background: 'rgba(168, 85, 247, 0.08)',
          border: '1px solid rgba(168, 85, 247, 0.2)',
          color: '#a855f7',
        }}>
          <BadgeCheck size={iconSize} style={{ strokeWidth: 2.2 }} />
          <span>Pro</span>
        </div>
      );
    case 'core':
      return (
        <div style={{
          ...badgeStyle,
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          color: '#3b82f6',
        }}>
          <Layers3 size={iconSize} style={{ strokeWidth: 2.2 }} />
          <span>Core</span>
        </div>
      );
    case 'free':
    default:
      return (
        <div style={{
          ...badgeStyle,
          background: 'rgba(128, 128, 128, 0.08)',
          border: '1px solid rgba(128, 128, 128, 0.2)',
          color: 'var(--c-text-secondary, #94a3b8)',
        }}>
          <Circle size={iconSize} style={{ strokeWidth: 2.2 }} />
          <span>{isEs ? 'Gratis' : 'Free'}</span>
        </div>
      );
  }
}

function getSyncPausedLabel(lang: string): string {
  switch (lang) {
    case 'es': return 'Sincronización pausada';
    case 'de': return 'Synchronisierung pausiert';
    case 'fr': return 'Synchronisation en pause';
    case 'it': return 'Sincronizzazione in pausa';
    case 'pt': return 'Sincronização pausada';
    case 'ja': return '同期は一時停止中';
    case 'ko': return '동기화 일시 중지됨';
    case 'zh': return '同步已暂停';
    default: return 'Sync is paused';
  }
}

/* ─── Privacy & Data Inline SVG Icons ─── */

function DashboardIconSVG({ color = '#a78bfa' }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="8" height="8" rx="2" fill={color} />
      <rect x="13" y="3" width="8" height="8" rx="2" fill={color} opacity="0.5" />
      <rect x="3" y="13" width="8" height="8" rx="2" fill={color} opacity="0.5" />
      <rect x="13" y="13" width="8" height="8" rx="2" fill={color} opacity="0.3" />
    </svg>
  );
}

function BackupSyncIconSVG({ color = '#10b981' }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" fill={color} opacity="0.85" />
      <path d="M12 10l-3 3h2v4h2v-4h2l-3-3z" fill="white" opacity="0.95" />
    </svg>
  );
}

function AnalyticsIconSVG({ color = '#f59e0b' }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="13" width="4" height="7" rx="1" fill={color} opacity="0.5" />
      <rect x="10" y="9" width="4" height="11" rx="1" fill={color} opacity="0.75" />
      <rect x="16" y="4" width="4" height="16" rx="1" fill={color} />
    </svg>
  );
}

function RetentionIconSVG({ color = '#0891b2' }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" fill="none" opacity="0.3" />
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" fill="none" strokeDasharray="57" strokeDashoffset="14" strokeLinecap="round" />
      <path d="M12 7v5l3 3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LinkIconSVG({ color = '#db2777' }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StorageIconSVG({ color = '#14b8a6' }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="12" cy="6" rx="8" ry="3" fill={color} opacity="0.85" />
      <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6" stroke={color} strokeWidth="1.5" fill="none" />
      <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" stroke={color} strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function GoogleIconSVG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107" />
      <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00" />
      <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50" />
      <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2" />
    </svg>
  );
}

function DropboxIconSVG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 6l-10 6.5 10 6.5 10-6.5z" fill="#1E88E5" />
      <path d="M34 6l-10 6.5 10 6.5 10-6.5z" fill="#1E88E5" />
      <path d="M4 25.5l10 6.5 10-6.5-10-6.5z" fill="#1E88E5" />
      <path d="M34 25.5l10-6.5-10-6.5-10 6.5z" fill="#1E88E5" />
      <path d="M14 34l10-6.5-10-6.5-10 6.5z" fill="#1E88E5" opacity="0.7" />
      <path d="M34 34l-10-6.5 10-6.5 10 6.5z" fill="#1E88E5" opacity="0.7" />
    </svg>
  );
}

function OneDriveIconSVG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path d="M28.4 16.6c-1.5-3-4.6-5.1-8.2-5.1-4.1 0-7.5 2.7-8.7 6.4C7.3 18.7 4 22.5 4 27c0 5 4 9 9 9h22c4.4 0 8-3.6 8-8 0-4.2-3.2-7.6-7.3-8l-.1-.1c-.9-2-3.1-3.3-5.5-3.3h-1.7z" fill="#0364B8" />
      <path d="M20.2 11.5c3.6 0 6.7 2.1 8.2 5.1h1.7c2.4 0 4.6 1.3 5.5 3.3l.1.1c4.1.4 7.3 3.8 7.3 8 0 4.4-3.6 8-8 8H17l3.2-24.4z" fill="#0078D4" opacity="0.9" />
    </svg>
  );
}

function GitHubIconSVG() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

function DownloadIconSVG() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function TrashIconSVG() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function ChevronDownIconSVG() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckCircleIconSVG() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="#10b981" opacity="0.15" />
      <circle cx="12" cy="12" r="10" stroke="#10b981" strokeWidth="1.5" fill="none" />
      <path d="M8 12l3 3 5-5" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SyncProblemIconSVG() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="#ef4444" opacity="0.15" />
      <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="1.5" fill="none" />
      <path d="M12 8v4" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1" fill="#ef4444" />
    </svg>
  );
}

function CloudOffIconSVG() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="var(--c-text-secondary)" opacity="0.15" />
      <circle cx="12" cy="12" r="10" stroke="var(--c-text-secondary)" strokeWidth="1.5" fill="none" />
      <path d="M2.5 2.5l19 19" stroke="var(--c-text-secondary)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7.3 7.3A5.5 5.5 0 009 17h6.5a3.5 3.5 0 002.1-6.3 5.5 5.5 0 00-8.1-4" stroke="var(--c-text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── End Privacy & Data SVG Icons ─── */

export default function AccountCard({ accent, cardStyle, rowStyle, onAccountSettings }: Props) {
  const tRoot = useT();
  const t = tRoot.hub.accountSection;
  const lang = useChordStore((s) => s.settings.language) ?? 'en';
  const syncAcrossDevices = useChordStore((s) => s.settings.syncAcrossDevices);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncStatus>(() => ({
    signedIn: false,
    phase: 'idle',
    syncing: false,
    lastSyncedMs: null,
    error: null,
    showMigrationPrompt: false,
    migrationChoice: null,
  }));
  const [tick, setTick] = useState(0);
  const [avatarIcon, setAvatarIcon] = useState<AvatarIcon | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerClosing, setPickerClosing] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  useEffect(() => subscribeUserProfile(setProfile), []);
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

  async function doEmailSubmit(submitMode: 'email-signin' | 'email-register', submitEmail: string, submitPassword: string, submitName?: string) {
    if (!submitEmail.trim() || !submitPassword) { setErr(t.errMissing); return; }
    setBusy(true); setErr(null);
    try {
      if (submitMode === 'email-signin') await signInEmail(submitEmail, submitPassword);
      else await registerEmail(submitEmail, submitPassword, submitName || '');
    } catch (e) {
      setErr(prettyErr(e, lang));
      throw e;
    } finally {
      setBusy(false);
    }
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
    // However, if syncAcrossDevices is false, background sync is paused,
    // so we should show a neutral grey cloud_off and "Sync is paused" text.
    const isHealthySynced = syncAcrossDevices && !isSyncing && !isError && (justSynced || sync.lastSyncedMs != null);
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
          : !syncAcrossDevices
            ? getSyncPausedLabel(lang)
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
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.displayName || user.email}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {renderRoleBadge(profile?.role, lang, accent)}
              <span style={{ fontSize: 10, color: 'var(--c-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.displayName ? user.email : t.signedIn}
              </span>
            </div>
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

        {sync.showMigrationPrompt && createPortal(
          <MigrationPromptSheet
            accent={accent}
            lang={lang}
            onClose={(choice) => resolveMigration(choice)}
          />,
          document.body
        )}

        {pickerOpen && createPortal(
          <AvatarPickerSheet
            accent={accent}
            currentIcon={avatarIcon}
            hasGooglePhoto={!!user.photoURL && !photoFailed}
            t={t}
            closing={pickerClosing}
            onPick={(icon) => {
              selectAvatarIcon(user, icon);
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
    <StudioAuthCard
      accent={accent}
      t={t}
      busy={busy}
      err={err}
      setErr={setErr}
      doGoogle={doGoogle}
      doEmailSubmit={doEmailSubmit}
    />
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
    ? 'sheet-down 300ms cubic-bezier(0.16, 1, 0.3, 1) both'
    : 'sheet-up 400ms cubic-bezier(0.16, 1, 0.3, 1) both';

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
          <div className="profile-panel-sheet" style={sheetStyle}>
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
          <div className="profile-panel-sheet" style={sheetStyle}>
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
    ? 'sheet-down 300ms cubic-bezier(0.16, 1, 0.3, 1) both'
    : 'sheet-up 400ms cubic-bezier(0.16, 1, 0.3, 1) both';
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
      <div className="profile-panel-sheet" style={sheetStyle}>
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

function formatLastActive(ms: number, lang: string): string {
  const diff = Date.now() - ms;
  if (diff < 10000) return lang === 'es' ? 'Activo ahora' : 'Active just now';
  const mins = Math.floor(diff / 60000);
  if (mins === 0) return lang === 'es' ? 'Activo hace menos de un minuto' : 'Active less than a minute ago';
  if (mins === 1) return lang === 'es' ? 'Activo hace 1 minuto' : 'Active 1 minute ago';
  if (mins < 60) return lang === 'es' ? `Activo hace ${mins} minutos` : `Active ${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return lang === 'es' ? 'Activo hace 1 hora' : 'Active 1 hour ago';
  if (hours < 24) return lang === 'es' ? `Activo hace ${hours} horas` : `Active ${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return lang === 'es' ? 'Activo ayer' : 'Active yesterday';
  return lang === 'es' ? `Activo hace ${days} días` : `Active ${days} days ago`;
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  useEffect(() => subscribeUserProfile(setProfile), []);
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
  const [devices, setDevices] = useState<any[]>([]);
  const [showDbDiag, setShowDbDiag] = useState(false);
  const [showOlderSessions, setShowOlderSessions] = useState(false);

  const codeBreakStyle = {
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
    whiteSpace: 'pre-wrap',
  } as const;

  useEffect(() => {
    if (!user || sheet !== 'devices-sessions') {
      setDevices([]);
      return;
    }
    void registerCurrentDevice(user.uid, 'open-devices-sheet');
    const unsub = subscribeDevices(user.uid, setDevices);
    return unsub;
  }, [user, sheet]);

  const settings = useChordStore((s) => s.settings);
  const activityLog = useChordStore((s) => s.activityLog ?? []);
  const updateSettings = useChordStore((s) => s.updateSettings);
  const [localUsage, setLocalUsage] = useState<string>('0 KB');
  const [clearingCache, setClearingCache] = useState(false);

  const [sync, setSync] = useState<SyncStatus>(() => ({
    signedIn: false,
    phase: 'idle',
    syncing: false,
    lastSyncedMs: null,
    error: null,
    showMigrationPrompt: false,
    migrationChoice: null,
  }));
  useEffect(() => subscribeSyncStatus(setSync), []);

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

  const refreshStorageSize = async () => {
    let lsBytes = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const val = localStorage.getItem(key) ?? '';
          lsBytes += (key.length + val.length) * 2;
        }
      }
    } catch (e) {
      console.warn(e);
    }

    let dbBytes = 0;
    try {
      const { getCacheSize } = await import('../groovex/stemCache');
      const sizeInfo = await getCacheSize();
      dbBytes = sizeInfo.totalBytes;
    } catch (e) {
      console.warn(e);
    }

    const totalBytes = lsBytes + dbBytes;
    setLocalUsage(formatBytes(totalBytes));
  };

  useEffect(() => {
    if (sheet === 'privacy-data') {
      refreshStorageSize();
    }
  }, [sheet]);

  function formatBytes(b: number): string {
    if (b === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  async function doExportData() {
    try {
      const backup: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          backup[key] = localStorage.getItem(key) ?? '';
        }
      }

      const content = JSON.stringify(backup, null, 2);
      const now = new Date();
      const dateString = now.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const fileName = `studio_backup_${now.toISOString().split('T')[0]}.json`;

      if (Capacitor.isNativePlatform()) {
        try {
          const { AppInstaller } = await import('../lib/apkDownloader');
          await AppInstaller.requestPermissions();
        } catch (e) {
          console.warn('[Export] Permissions request failed:', e);
        }
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const bytes = new TextEncoder().encode(content);
        const binary = Array.from(bytes, b => String.fromCharCode(b)).join('');
        const base64 = btoa(binary);

        try {
          await Filesystem.writeFile({ path: `Download/${fileName}`, data: base64, directory: Directory.ExternalStorage, recursive: true });
          showToast(lang === 'es' ? 'Copia de seguridad guardada' : 'Backup saved successfully');
        } catch {
          try {
            await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.External, recursive: true });
            showToast(lang === 'es' ? 'Copia de seguridad guardada' : 'Backup saved successfully');
          } catch {
            showToast(lang === 'es' ? 'Error al guardar archivo' : 'Failed to save export file');
          }
        }
      } else {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast(lang === 'es' ? 'Datos exportados correctamente' : 'Data exported successfully');
      }

      logActivity('backup', lang === 'es' ? 'Copia de seguridad manual exportada' : 'Manual backup exported', 'Studio');
      updateSettings({ lastExportDate: dateString });
    } catch (e) {
      console.error(e);
      showToast(lang === 'es' ? 'Error al exportar datos' : 'Export failed');
    }
  }

  async function doClearCache() {
    setClearingCache(true);
    try {
      const { clearAllCache } = await import('../groovex/stemCache');
      await clearAllCache();
      showToast(lang === 'es' ? 'Caché de audio eliminada' : 'Audio cache cleared successfully');
      await refreshStorageSize();
    } catch (e) {
      console.error(e);
      showToast(lang === 'es' ? 'Error al borrar caché' : 'Failed to clear cache');
    } finally {
      setClearingCache(false);
    }
  }

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

    const onCoverChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ uid: string; cover: string | null }>).detail;
      if (detail && detail.uid === user.uid) {
        setCustomPhoto(detail.cover);
      }
    };
    window.addEventListener('chordex:user-cover-changed', onCoverChanged);
    return () => {
      window.removeEventListener('chordex:user-cover-changed', onCoverChanged);
    };
  }, [user?.uid]);

  // Register a back handler to close any active sheets when open
  useBackHandler('sheet', () => {
    if (pickerOpen) {
      setPickerClosing(true);
      setTimeout(() => { setPickerOpen(false); setPickerClosing(false); }, 280);
      return true;
    }
    if (sheet !== 'none') {
      closeSheet();
      return true;
    }
    return false;
  }, [sheet, pickerOpen]);

  // When no active sheets/pickers are open, swiping back exits the profile page back to settings tab
  useBackHandler('nested', () => {
    if (sheet === 'none' && !pickerOpen) {
      onBack();
      return true;
    }
    return false;
  }, [sheet, pickerOpen, onBack]);

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
      const { syncWriteProfileMain } = await import('../lib/sync');
      await syncWriteProfileMain(nameInput, user.photoURL, avatarIcon);
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

  async function handlePhotoFile(file: File) {
    if (!user?.uid || !file.type.startsWith('image/')) return;
    setBusy(true);
    setErr(null);
    try {
      showToast(lang === 'es' ? 'Optimizando imagen...' : 'Optimizing image...');
      const blob = await compressAndResizeImage(file);
      
      showToast(lang === 'es' ? 'Subiendo foto de perfil...' : 'Uploading profile photo...');
      const { uploadProfilePhoto, syncWriteProfileMain } = await import('../lib/sync');
      const downloadUrl = await uploadProfilePhoto(user.uid, blob);
      
      const auth = getFirebaseAuth();
      if (auth?.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: downloadUrl });
      }
      
      const { updateLocalAuthUser } = await import('../lib/auth');
      updateLocalAuthUser({ photoURL: downloadUrl });
      
      setUserAvatar(user.uid, null);
      await syncWriteProfileMain(user.displayName, downloadUrl, null);
      
      localStorage.setItem(`chordex_cp_${user.uid}`, downloadUrl);
      setCustomPhoto(downloadUrl);
      window.dispatchEvent(
        new CustomEvent('chordex:user-cover-changed', {
          detail: { uid: user.uid, cover: downloadUrl },
        })
      );
      
      showToast(lang === 'es' ? 'Foto de perfil actualizada con éxito' : 'Profile photo updated successfully');
    } catch (e: any) {
      console.error('[photo upload] failed:', e);
      setErr(prettyErr(e, lang));
      showToast(lang === 'es' ? 'Error al subir la foto' : 'Failed to upload photo');
    } finally {
      setBusy(false);
    }
  }

  async function clearCustomPhoto() {
    if (!user?.uid) return;
    setBusy(true);
    setErr(null);
    try {
      const auth = getFirebaseAuth();
      if (auth?.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: null });
      }
      
      const { updateLocalAuthUser } = await import('../lib/auth');
      updateLocalAuthUser({ photoURL: null });
      
      const { syncWriteProfileMain } = await import('../lib/sync');
      await syncWriteProfileMain(user.displayName, null, null);
      
      localStorage.removeItem(`chordex_cp_${user.uid}`);
      setCustomPhoto(null);
      window.dispatchEvent(
        new CustomEvent('chordex:user-cover-changed', {
          detail: { uid: user.uid, cover: null },
        })
      );
      showToast(lang === 'es' ? 'Foto de perfil eliminada' : 'Profile photo removed');
    } catch (e: any) {
      console.error('[photo clear] failed:', e);
      setErr(prettyErr(e, lang));
    } finally {
      setBusy(false);
    }
  }


  const canConfirmEmail = !busy
    && !!emailToConfirm
    && emailInput.trim().toLowerCase() === emailToConfirm;

  const sheetAnim = sheetClosing
    ? 'sheet-down 300ms cubic-bezier(0.16, 1, 0.3, 1) both'
    : 'sheet-up 400ms cubic-bezier(0.16, 1, 0.3, 1) both';
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
          {/* Dynamic Role Badge */}
          <div style={{ marginTop: 10 }}>
            {renderRoleBadge(profile?.role, lang, accent)}
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

        {/* Activity Timeline Section */}
        <div style={{ marginTop: 24, animation: 'hub-row-fade 380ms ease 85ms both' }}>
          <p style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 11, color: 'var(--c-text-secondary)', letterSpacing: '0.18em', textTransform: 'uppercase', margin: '0 0 10px' }}>
            {lang === 'es' ? 'Línea de Tiempo de Actividad' : 'Activity Timeline'}
          </p>
          <div style={{
            ...cardStyle,
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            background: 'var(--app-surface-high, rgba(128,128,128,0.06))',
            border: '1px solid rgba(128,128,128,0.12)',
          }}>
            <p style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--c-text-secondary)', margin: 0, lineHeight: 1.45 }}>
              {lang === 'es' ? 'Mira tu actividad reciente en el ecosistema Studio.' : 'See your recent activity across Studio.'}
            </p>

            {/* List of activity items */}
            {activityLog && activityLog.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                {activityLog.map((event: any) => {
                  const emoji = getActivityEmoji(event.type, event.subtitle);
                  return (
                    <div key={event.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: 'Manrope', fontWeight: 750, fontSize: 13, color: 'var(--c-text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {event.title}
                        </p>
                        {event.subtitle && (
                          <p style={{ fontFamily: 'Inter', fontSize: 11, color: 'var(--c-text-secondary)', margin: '1px 0 0', opacity: 0.8 }}>
                            {event.subtitle}
                          </p>
                        )}
                      </div>
                      <span style={{ fontFamily: 'Inter', fontSize: 11, color: 'var(--c-text-secondary)', whiteSpace: 'nowrap', opacity: 0.6 }}>
                        {formatElapsedTime(event.timestamp, lang)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--c-text-secondary)', opacity: 0.5 }}>
                  history
                </span>
                <p style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--c-text-secondary)', margin: 0, opacity: 0.7 }}>
                  {lang === 'es' ? 'No hay actividad registrada aún' : 'No recorded activity yet'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Developer / Account Details Card */}
        {user && (
          <div style={{ marginTop: 24, animation: 'hub-row-fade 380ms ease 100ms both' }}>
            <p style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 11, color: 'var(--c-text-secondary)', letterSpacing: '0.18em', textTransform: 'uppercase', margin: '0 0 10px' }}>
              {lang === 'es' ? 'Detalles de Desarrollador / Cuenta' : 'Developer / Account Details'}
            </p>
            <div style={{
              ...cardStyle,
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              background: 'var(--app-surface-high, rgba(128,128,128,0.06))',
              border: '1px solid rgba(128,128,128,0.12)',
            }}>
              {/* UID Row */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontFamily: 'Inter', fontSize: 10.5, fontWeight: 600, color: 'var(--c-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {lang === 'es' ? 'Identificador de Usuario (UID)' : 'User Identifier (UID)'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <code style={{
                    fontFamily: 'monospace',
                    fontSize: 12,
                    color: 'var(--c-text-primary)',
                    background: 'var(--app-surface-lowest, rgba(128,128,128,0.04))',
                    padding: '4px 8px',
                    borderRadius: 6,
                    wordBreak: 'break-all',
                    flex: 1,
                    border: '1px solid rgba(128,128,128,0.08)',
                  }}>
                    {user.uid}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(user.uid);
                      showToast(lang === 'es' ? '¡UID copiado al portapapeles!' : 'UID copied to clipboard!');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 6,
                      borderRadius: 8,
                      cursor: 'pointer',
                      color: accent.from,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background-color 200ms',
                    }}
                    className="hover-bg-surface-lowest"
                    title={lang === 'es' ? 'Copiar UID' : 'Copy UID'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>content_copy</span>
                  </button>
                </div>
              </div>

              {/* Entitlement Role Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontFamily: 'Inter', fontSize: 10.5, fontWeight: 600, color: 'var(--c-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {lang === 'es' ? 'Rol y Privilegios' : 'Entitlement Role'}
                  </span>
                  <span style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--c-text-primary)', fontWeight: 500 }}>
                    {profile?.role ? profile.role.toUpperCase() : 'FREE'}
                  </span>
                </div>
                {renderRoleBadge(profile?.role, lang, accent)}
              </div>

              {/* Authentication Provider Row */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontFamily: 'Inter', fontSize: 10.5, fontWeight: 600, color: 'var(--c-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {lang === 'es' ? 'Proveedor de Autenticación' : 'Authentication Provider'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {getSignInProviders().includes('google.com') ? (
                    <GoogleIconSVG />
                  ) : (
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--c-text-secondary)', opacity: 0.8 }}>
                      lock
                    </span>
                  )}
                  <span style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--c-text-primary)', fontWeight: 500, textTransform: 'capitalize' }}>
                    {getSignInProviders().length > 0
                      ? getSignInProviders().map(p => p.replace('.com', '')).join(', ')
                      : 'Email & Password'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sign Out — prominent red button */}
        <button
          type="button"
          onClick={() => openSheet('signout')}
          style={{
            width: '100%', marginTop: 24, padding: '15px 0',
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

      </div>{/* end settings list */}

      {/* Avatar picker */}
      {pickerOpen && createPortal(
        <AvatarPickerSheet
          accent={accent}
          currentIcon={avatarIcon}
          hasGooglePhoto={!!user.photoURL && !photoFailed}
          t={t}
          closing={pickerClosing}
          onPick={(icon) => { selectAvatarIcon(user, icon); }}
          onClose={() => { setPickerClosing(true); setTimeout(() => { setPickerOpen(false); setPickerClosing(false); }, 280); }}
        />,
        document.body,
      )}

      {/* ── Sign out sheet ── */}
      {sheet === 'signout' && createPortal(
        <div style={overlayStyle}>
          <div style={backdropStyle} onClick={closeSheet} />
          <div className="profile-panel-sheet" style={sheetStyle}>
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
          <div className="profile-panel-sheet" style={sheetStyle}>
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
          <div className="profile-panel-sheet" style={sheetStyle}>
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
          <div className="profile-panel-sheet" style={sheetStyle}>
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
          <div className="profile-panel-sheet" style={sheetStyle}>
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
          <div className="profile-panel-sheet" style={sheetStyle}>
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
          <div className="profile-panel-sheet" style={sheetStyle}>
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
                  onClick={async () => {
                    if (Capacitor.isNativePlatform()) {
                      try {
                        const { AppInstaller } = await import('../lib/apkDownloader');
                        await AppInstaller.requestPermissions();
                      } catch (e) {
                        console.warn('[Profile] Permissions request failed:', e);
                      }
                    }
                    fileInputRef.current?.click();
                  }}
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
                    onClick={() => { clearCustomPhoto(); selectAvatarIcon(user, null); }}
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
          <div className="profile-panel-sheet" style={sheetStyle}>
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
            {/* ── Account actions pill ── */}
            <div style={{ padding: '14px 22px 28px' }}>
              <p style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 11, color: 'var(--c-text-secondary)', letterSpacing: '0.15em', textTransform: 'uppercase' as const, margin: '0 0 8px' }}>
                {lang === 'es' ? 'Zona de riesgo' : 'Danger zone'}
              </p>
              <div style={{ background: 'rgba(128,128,128,0.06)', borderRadius: 14, overflow: 'hidden' }}>
                {/* Disable account */}
                <button
                  onClick={() => { closeSheet(); setTimeout(() => openSheet('disable'), 310); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 13, width: '100%',
                    padding: '13px 16px', background: 'none', border: 'none',
                    borderBottom: '1px solid rgba(128,128,128,0.08)',
                    cursor: 'pointer', textAlign: 'left' as const,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--c-text-secondary)', opacity: 0.65, flexShrink: 0, width: 22, textAlign: 'center' as const }}>block</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: 'Manrope', fontWeight: 600, fontSize: 14.5, color: 'var(--c-text-primary)', margin: 0 }}>{L.disableAccount}</p>
                    <p style={{ fontFamily: 'Inter', fontSize: 11.5, color: 'var(--c-text-secondary)', margin: '2px 0 0' }}>{L.disableAccountDesc}</p>
                  </div>
                  <span className="material-symbols-outlined" style={{ fontSize: 17, color: 'var(--c-text-secondary)', opacity: 0.3 }}>chevron_right</span>
                </button>
                {/* Delete account */}
                <button
                  onClick={() => { closeSheet(); setTimeout(() => openSheet('delete'), 310); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 13, width: '100%',
                    padding: '13px 16px', background: 'none', border: 'none',
                    cursor: 'pointer', textAlign: 'left' as const,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#ff6b6b', opacity: 0.8, flexShrink: 0, width: 22, textAlign: 'center' as const }}>delete_forever</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: 'Manrope', fontWeight: 600, fontSize: 14.5, color: '#ff6b6b', margin: 0 }}>{L.deleteAccount}</p>
                    <p style={{ fontFamily: 'Inter', fontSize: 11.5, color: 'var(--c-text-secondary)', margin: '2px 0 0' }}>
                      {lang === 'es' ? 'Eliminar permanentemente tu cuenta' : 'Permanently remove your account'}
                    </p>
                  </div>
                  <span className="material-symbols-outlined" style={{ fontSize: 17, color: 'var(--c-text-secondary)', opacity: 0.3 }}>chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ── Subscription & Billing sheet ── */}
      {sheet === 'subscription' && createPortal(
        <div style={overlayStyle}>
          <div style={backdropStyle} onClick={closeSheet} />
          <div className="profile-panel-sheet" style={sheetStyle}>
            {dragPill}
            <SheetHeader title={lang === 'es' ? 'Suscripción y facturación' : 'Subscription & Billing'} onClose={closeSheet} />
            <div
              style={{
                padding: '16px 22px 32px',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                maxHeight: 'calc(82vh - env(safe-area-inset-bottom) - 80px)',
                overflowY: 'auto',
                width: '100%',
                boxSizing: 'border-box',
              }}
              className="no-scrollbar animate-fade-in"
            >
              {/* Current plan badge */}
              <div
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: `${accent.from}10`,
                  border: `1px solid ${accent.from}25`,
                  borderRadius: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  boxSizing: 'border-box',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: accent.from, fontVariationSettings: "'FILL' 1" }}>verified</span>
                <div>
                  <p style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: 'var(--c-text-primary)', margin: 0 }}>
                    {lang === 'es'
                      ? `Plan actual · ${profile?.role ? profile.role.toUpperCase() : 'GRATIS'}`
                      : `Current plan · ${profile?.role ? profile.role.toUpperCase() : 'FREE'}`}
                  </p>
                  <p style={{ fontFamily: 'Inter', fontSize: 11, color: 'var(--c-text-secondary)', margin: '2px 0 0' }}>
                    {profile?.role === 'admin'
                      ? (lang === 'es' ? 'Acceso de administrador completo e ilimitado' : 'Full unlimited administrator access bypass')
                      : profile?.role === 'pro'
                      ? (lang === 'es' ? 'Suite de producción profesional activa' : 'Active professional production suite access')
                      : profile?.role === 'core'
                      ? (lang === 'es' ? 'Funciones avanzadas y almacenamiento en la nube activos' : 'Active advanced tools & cloud storage access')
                      : (lang === 'es' ? 'Acceso estándar a las funciones básicas' : 'Standard access to basic creation tools')}
                  </p>
                </div>
              </div>

              {/* Aceternity Pricing Section */}
              <StudioPricingSection
                accent={accent}
                lang={lang}
                profile={profile}
                user={user}
                onShowToast={showToast}
              />
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ── Devices & Sessions sheet ── */}
      {sheet === 'devices-sessions' && createPortal(
        <div style={overlayStyle}>
          <div style={backdropStyle} onClick={closeSheet} />
          <div className="profile-panel-sheet" style={{ ...sheetStyle, maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - 24px)', display: 'flex', flexDirection: 'column' }}>
            {dragPill}
            <SheetHeader title={lang === 'es' ? 'Dispositivos y sesiones' : 'Devices & Sessions'} onClose={closeSheet} />
            <div style={{ padding: '8px 22px 28px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', WebkitOverflowScrolling: 'touch', flex: 1 }} className="no-scrollbar">
              {!user ? (
                <p style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--c-text-secondary)', margin: 0, textAlign: 'center', padding: '20px 0' }}>
                  {lang === 'es' ? 'Inicia sesión para gestionar tus dispositivos.' : 'Sign in to manage your devices.'}
                </p>
              ) : (
                <>
                  {devices.length === 0 ? (
                    <div style={{
                      padding: '16px 20px',
                      background: sync.deviceRegistrationStatus === 'failed' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(128,128,128,0.05)',
                      borderRadius: 14,
                      border: sync.deviceRegistrationStatus === 'failed' ? '1px solid rgba(239, 68, 68, 0.15)' : '1px solid rgba(128,128,128,0.12)',
                      fontFamily: 'Inter',
                      fontSize: '12.5px',
                      color: 'var(--c-text-primary)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="material-symbols-outlined" style={{ color: sync.deviceRegistrationStatus === 'failed' ? '#ff6b6b' : '#f59e0b', fontSize: 20 }}>
                          {sync.deviceRegistrationStatus === 'failed' ? 'error' : sync.deviceRegistrationStatus === 'registered' ? 'sync' : 'hourglass_empty'}
                        </span>
                        <span style={{ fontWeight: 800, fontSize: 14, color: sync.deviceRegistrationStatus === 'failed' ? '#ff6b6b' : 'var(--c-text-primary)', fontFamily: 'Manrope' }}>
                          {sync.deviceRegistrationStatus === 'failed' 
                            ? (lang === 'es' ? 'No se pudo registrar el dispositivo' : 'Studio could not register this device.')
                            : sync.deviceRegistrationStatus === 'registered'
                            ? (lang === 'es' ? 'Buscando dispositivos...' : 'Checking devices...')
                            : (lang === 'es' ? 'El registro del dispositivo no ha terminado' : 'Device registration has not completed yet.')}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.4, color: 'var(--c-text-secondary)' }}>
                        {sync.deviceRegistrationStatus === 'failed'
                          ? (lang === 'es' ? 'Error al registrar el dispositivo. Revise los diagnósticos a continuación.' : 'Failed to register this device. Review the diagnostics below.')
                          : sync.deviceRegistrationStatus === 'registered'
                          ? (lang === 'es' ? 'Se ha registrado el dispositivo, pero no se recibieron documentos de la nube.' : 'Device registered successfully, but no device documents were received.')
                          : (lang === 'es' ? 'Studio está registrando este dispositivo en la nube...' : 'Studio is registering this device to the cloud...')}
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(() => {
                        const DeviceRow = ({ device, isMe }: { device: any; isMe: boolean }) => {
                          const [showDetails, setShowDetails] = useState(false);
                          
                          let title = device.displayName || device.shortName || device.name;
                          if (device.classification === 'legacy' || device.isLegacy || device.isStale) {
                            if (title === 'Unknown Device' || title === 'Chordex App' || title.includes('Chordex')) {
                              title = device.platform === 'web' 
                                ? (lang === 'es' ? 'Sesión web anterior' : 'Previous Web session')
                                : (lang === 'es' ? 'Sesión Android anterior' : 'Previous Android session');
                            } else {
                              title = `${lang === 'es' ? 'Sesión anterior' : 'Previous session'} (${title})`;
                            }
                          }

                          let statusText = '';
                          const nowTime = Date.now();
                          const isRecentlyActive = device.lastActive && (nowTime - device.lastActive < 24 * 60 * 60 * 1000);
                          const isVeryFresh = device.lastActive && (nowTime - device.lastActive < 2 * 60 * 1000);

                          if (!device.signedIn) {
                            statusText = lang === 'es' ? 'Sesión cerrada' : 'Signed out';
                          } else if (isMe) {
                            statusText = `● ${lang === 'es' ? 'Sesión activa' : 'Active session'}`;
                          } else if (device.classification === 'legacy' || device.isLegacy || device.replacedByDeviceId != null) {
                            statusText = lang === 'es' ? 'Sesión anterior' : 'Previous session';
                          } else if (device.classification === 'activeRemote') {
                            statusText = lang === 'es' ? 'Activo ahora' : 'Active now';
                          } else if (device.classification === 'recentRemote') {
                            statusText = formatLastActive(device.lastActive, lang);
                          } else {
                            statusText = lang === 'es' ? 'Inactivo' : 'Idle';
                          }

                          const showVersion = device.appVersion && device.appVersion !== 'Unknown';
                          const isPlatformWeb = device.platform === 'web' || device.buildType === 'Web';
                          const showApk = !isPlatformWeb && device.apkVersion && device.apkVersion !== 'Unknown';

                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <div
                                style={{
                                  background: 'rgba(128,128,128,0.06)',
                                  borderRadius: 14,
                                  padding: '12px 14px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  border: isMe ? `1px solid color-mix(in srgb, var(--accent-to, #a855f7) 20%, transparent)` : '1px solid transparent',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: isMe ? 'var(--accent-to, #a855f7)' : 'var(--c-text-primary)', opacity: isMe ? 1 : 0.7 }}>
                                    {device.platform === 'native' || device.platform === 'android' ? 'smartphone' : 'laptop_mac'}
                                  </span>
                                  <div>
                                    <p style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 13.5, color: 'var(--c-text-primary)', margin: 0 }}>
                                      {title} {isMe && `(${lang === 'es' ? 'Este dispositivo' : 'This device'})`}
                                    </p>
                                    <p style={{ fontFamily: 'Inter', fontSize: 11, color: isMe ? '#10b981' : 'var(--c-text-muted)', margin: '2px 0 0', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                      <span>{statusText}</span>
                                      {showVersion && (
                                        <>
                                          <span style={{ opacity: 0.5 }}>•</span>
                                          <span>{lang === 'es' ? 'Versión' : 'Version'}: {device.appVersion}</span>
                                        </>
                                      )}
                                      {isPlatformWeb ? (
                                        <>
                                          <span style={{ opacity: 0.5 }}>•</span>
                                          <span>{lang === 'es' ? 'Compilación: Web' : 'Build: Web'}</span>
                                        </>
                                      ) : (
                                        <>
                                          {showApk && (
                                            <>
                                              <span style={{ opacity: 0.5 }}>•</span>
                                              <span>APK: {device.apkVersion}</span>
                                            </>
                                          )}
                                          <span style={{ opacity: 0.5 }}>•</span>
                                          <span>{lang === 'es' ? 'Compilación: Versión Nativa' : 'Build: Native Release'}</span>
                                        </>
                                      )}
                                      <span style={{ opacity: 0.5 }}>•</span>
                                      <span style={{ 
                                        color: device.syncStatus === 'success' || device.syncStatus === 'idle' ? '#10b981' : device.syncStatus === 'syncing' ? 'var(--accent-to, #a855f7)' : '#ff6b6b',
                                        fontWeight: 600,
                                        textTransform: 'capitalize'
                                      }}>{device.syncStatus}</span>
                                    </p>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {(device.classification === 'legacy' || device.isLegacy || device.isStale || device.classification === 'signedOut' || device.classification === 'revoked' || device.classification === 'unknown') && (
                                    <button
                                      onClick={() => setShowDetails(!showDetails)}
                                      style={{
                                        background: 'rgba(128,128,128,0.08)',
                                        border: 'none',
                                        color: 'var(--c-text-primary)',
                                        fontSize: 10,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        padding: '4px 8px',
                                        borderRadius: 6,
                                        fontFamily: 'Manrope'
                                      }}
                                    >
                                      {showDetails ? (lang === 'es' ? 'Ocultar' : 'Hide') : (lang === 'es' ? 'Detalles' : 'Details')}
                                    </button>
                                  )}
                                  {!isMe && (
                                    <button
                                      onClick={async () => {
                                        if (confirm(lang === 'es' ? '¿Revocar esta sesión? El dispositivo tendrá que iniciar sesión de nuevo.' : 'Revoke this session? The device will be signed out.')) {
                                          await revokeDeviceSession(user.uid, device.id);
                                        }
                                      }}
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        padding: 6,
                                        borderRadius: 8,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        color: '#ff6b6b',
                                      }}
                                    >
                                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                              {showDetails && (
                                <div style={{
                                  padding: '8px 12px',
                                  background: 'rgba(128,128,128,0.03)',
                                  borderLeft: '2px solid var(--accent-to, #a855f7)',
                                  fontSize: 11,
                                  fontFamily: 'Inter',
                                  color: 'var(--c-text-secondary)',
                                  marginLeft: 14,
                                  borderRadius: '0 8px 8px 0',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 4
                                }}>
                                  <div><strong>Firestore Doc ID:</strong> <code style={{ wordBreak: 'break-all' }}>{device.id}</code></div>
                                  <div><strong>Classification:</strong> <code style={{ textTransform: 'capitalize' }}>{device.classification || 'unknown'}</code></div>
                                  <div><strong>Reason:</strong> <span>{device.classificationReason || 'Stale device session'}</span></div>
                                  <div><strong>Last Active:</strong> <span>{device.lastActive ? new Date(device.lastActive).toLocaleString() : 'Never'}</span></div>
                                </div>
                              )}
                            </div>
                          );
                        };

                        const thisDevice = devices.filter(d => d.classification === 'current' || d.id === deviceId());
                        const activeRemoteDevices = devices.filter(d => d.id !== deviceId() && d.classification === 'activeRemote');
                        const recentlyActiveDevices = devices.filter(d => d.id !== deviceId() && d.classification === 'recentRemote');
                        const olderSessions = devices.filter(d => d.id !== deviceId() && (d.classification === 'signedOut' || d.classification === 'revoked' || d.classification === 'legacy' || d.classification === 'unknown' || !d.classification));

                        return (
                          <>
                            {/* 1. This Device */}
                            {thisDevice.map((d) => <DeviceRow key={d.id} device={d} isMe={true} />)}

                            {/* 2. Other Active Devices */}
                            {activeRemoteDevices.length > 0 && (
                              <>
                                <p style={{ margin: '12px 0 6px', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: 'var(--c-text-secondary)', letterSpacing: '0.05em', fontFamily: 'Manrope' }}>
                                  {lang === 'es' ? 'Otros dispositivos activos' : 'Other active devices'}
                                </p>
                                {activeRemoteDevices.map((d) => <DeviceRow key={d.id} device={d} isMe={false} />)}
                              </>
                            )}

                            {/* 3. Recently Active Devices */}
                            {recentlyActiveDevices.length > 0 && (
                              <>
                                <p style={{ margin: '12px 0 6px', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: 'var(--c-text-secondary)', letterSpacing: '0.05em', fontFamily: 'Manrope' }}>
                                  {lang === 'es' ? 'Dispositivos activos recientemente' : 'Recently active devices'}
                                </p>
                                {recentlyActiveDevices.map((d) => <DeviceRow key={d.id} device={d} isMe={false} />)}
                              </>
                            )}

                            {/* 4. Previous / signed-out / legacy / unknown sessions */}
                            {olderSessions.length > 0 && (
                              <div style={{ marginTop: 12 }}>
                                <button
                                  onClick={() => setShowOlderSessions(!showOlderSessions)}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--c-text-secondary)',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    fontFamily: 'Manrope',
                                    cursor: 'pointer',
                                    padding: '4px 0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                                    {showOlderSessions ? 'expand_less' : 'expand_more'}
                                  </span>
                                  {lang === 'es' 
                                    ? `Sesiones anteriores (${olderSessions.length})` 
                                    : `Previous sessions (${olderSessions.length})`}
                                </button>
                                {showOlderSessions && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                                    {olderSessions.map((d) => <DeviceRow key={d.id} device={d} isMe={false} />)}
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* Sync Diagnostics & Debug section */}
                  <div style={{ marginTop: 6 }}>
                    <button
                      onClick={() => setShowDbDiag(!showDbDiag)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: accent.from,
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: 'Manrope',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                        {showDbDiag ? 'expand_less' : 'expand_more'}
                      </span>
                      {lang === 'es' ? 'Ver diagnósticos de sincronización' : 'View Sync Diagnostics'}
                    </button>
                    {showDbDiag && (
                      <div style={{
                        marginTop: 10,
                        padding: '12px 14px',
                        background: 'rgba(128,128,128,0.05)',
                        borderRadius: 12,
                        border: '1px solid rgba(128,128,128,0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        fontFamily: 'Inter',
                        fontSize: 11,
                        maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - 220px)',
                        overflowY: 'auto',
                        WebkitOverflowScrolling: 'touch',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                      }}>
                        {(!sync.dbAvailable || sync.firebaseProjectId === 'Not Configured') && (
                          <div style={{
                            padding: '10px 12px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: 8,
                            color: '#ff6b6b',
                            fontSize: 11,
                            fontWeight: 600,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                            marginBottom: 8,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error_outline</span>
                              <span>Cloud Sync is not initialized</span>
                            </div>
                            <div style={{ fontSize: 10, opacity: 0.9, marginLeft: 22 }}>
                              <div><strong>Auth Signed In:</strong> {user?.uid ? 'Yes' : 'No'}</div>
                              <div><strong>Firebase Apps Count:</strong> {sync.firebaseAppsCount ?? 0}</div>
                              <div><strong>Firebase App Name:</strong> {sync.firebaseAppName || 'None'}</div>
                              <div><strong>Firestore Db Available:</strong> {sync.dbAvailable ? 'Yes' : 'No'}</div>
                              <div><strong>Firebase Project ID:</strong> {sync.firebaseProjectId || 'Not Configured'}</div>
                              <div><strong>Firebase App ID:</strong> {sync.firebaseAppId || 'Not Configured'}</div>
                              <div><strong>Init Error:</strong> {sync.firebaseInitError || 'None'}</div>
                              <div style={{ marginTop: 6, color: '#ff8787', fontWeight: 700 }}>Next Action: Check build keys or network connection</div>
                            </div>
                          </div>
                        )}

                        <div style={{
                          marginBottom: 8,
                          padding: '6px 8px',
                          background: 'rgba(168, 85, 247, 0.1)',
                          border: '1px solid rgba(168, 85, 247, 0.25)',
                          borderRadius: 8,
                          fontSize: 10,
                          fontWeight: 700,
                          color: 'var(--accent-to, #a855f7)',
                          fontFamily: 'Manrope',
                          ...codeBreakStyle
                        }}>
                          <strong>Build Fingerprint:</strong> {`${APP_VERSION} · code 34 · commit ${APP_COMMIT_SHA} · built ${APP_BUILD_TIMESTAMP} · production · Firebase Hosting · sync-engine-v1`}
                        </div>

                        <button
                          onClick={() => {
                            const diagnosticsReport = {
                              appVersion: APP_VERSION,
                              versionCode: 34,
                              commitSha: APP_COMMIT_SHA,
                              buildTimestamp: APP_BUILD_TIMESTAMP,
                              buildType: Capacitor.isNativePlatform() ? 'Native Release' : 'Web',
                              firebaseProjectId: sync.firebaseProjectId || 'Not Configured',
                              firebaseAppId: sync.firebaseAppId || 'Not Configured',
                              authUid: user?.uid || 'Not signed in',
                              email: user?.email || 'N/A',
                              currentDeviceId: deviceId(),
                              currentPlatform: sync.currentDevicePlatform || 'web',
                              syncEngineVersion: sync.syncEngineVersion || 'sync-engine-v1',
                              devicesLogicVersion: sync.devicesLogicVersion || 'N/A',
                              probeWritePath: sync.probeWritePath || 'N/A',
                              probeListenerPath: sync.probeListenerPath || 'N/A',
                              lastProbeWriteAttempt: sync.lastProbeWriteAttempt || 'Never',
                              lastProbeWriteSuccess: sync.lastProbeWriteSuccess || 'Never',
                              lastProbeWriteError: sync.lastProbeWriteError || 'None',
                              probeDocumentsReceived: sync.probeDocumentsReceived ?? 0,
                              probeDeviceIdsReceived: sync.probeDeviceIdsReceived || [],
                              probeNoncesReceived: sync.probeNoncesReceived || [],
                              androidProbeDetected: sync.androidProbeDetected ? 'Yes' : 'No',
                              webProbeDetected: sync.webProbeDetected ? 'Yes' : 'No',
                              sameUidConfirmed: sync.sameUidConfirmed ? 'Yes' : 'No',
                              sameProjectConfirmed: sync.sameProjectConfirmed ? 'Yes' : 'No',
                              devicesListenerPath: sync.listenerPath || `users/${user?.uid}/devices`,
                              devicesReceived: sync.devicesSnapshotCount ?? 0,
                              deviceIdsReceived: sync.deviceIdsReceived || [],
                              renderedDevices: sync.devicesRenderedCount ?? 0,
                              lastDeviceWriteSuccess: sync.lastDeviceWriteSuccess || 'Never',
                              lastDeviceWriteError: sync.lastDeviceWriteError || 'None',
                              lastHeartbeatSuccess: sync.lastHeartbeatSuccess || 'Never',
                              lastHeartbeatError: sync.lastHeartbeatError || 'None',
                              firebaseAppsCount: sync.firebaseAppsCount ?? 0,
                              firebaseAppName: sync.firebaseAppName || 'None',
                              authDomain: sync.firebaseAuthDomain || 'Not Configured',
                              storageBucket: sync.firebaseStorageBucket || 'Not Configured',
                              dbAvailable: sync.dbAvailable ? 'Yes' : 'No',
                              authAvailable: sync.authAvailable ? 'Yes' : 'No',
                              storageAvailable: sync.storageAvailable ? 'Yes' : 'No',
                              firebaseInitError: sync.firebaseInitError || 'None',
                              syncEngineInitError: sync.syncEngineInitError || 'None',
                              directWritePath: sync.directWritePath || 'N/A',
                              directWriteAttempt: sync.directWriteAttempt || 'Never',
                              directWriteSuccess: sync.directWriteSuccess || 'Never',
                              directWriteError: sync.directWriteError || 'None',
                              directWriteDurationMs: sync.directWriteDurationMs ?? null,
                              directReadBackSuccess: sync.directReadBackSuccess || 'Never',
                              directReadBackError: sync.directReadBackError || 'None',
                              directReadBackData: sync.directReadBackData || 'N/A',
                              directListenerDocumentsReceived: sync.directListenerDocumentsReceived ?? 0,
                              directListenerDeviceIdsReceived: sync.directListenerDeviceIdsReceived || [],
                              lastAction: sync.lastAction || 'None',
                              lastActionAt: sync.lastActionAt || 'Never',
                              buttonActionStatus: sync.buttonActionStatus || 'idle',
                              firestoreTransportMode: sync.firestoreTransportMode || 'default',
                              firestorePersistenceMode: sync.firestorePersistenceMode || 'none',
                              firestoreInitSource: sync.firestoreInitSource || 'not-started',
                              probeListenerStatus: sync.probeListenerStatus || 'idle',
                              probeListenerAttachedAt: sync.probeListenerAttachedAt || 'Never',
                              probeSnapshotFromCache: sync.probeSnapshotFromCache ? 'Yes' : 'No',
                              probeSnapshotHasPendingWrites: sync.probeSnapshotHasPendingWrites ? 'Yes' : 'No',
                              probeListenerError: sync.probeListenerError || 'None',
                              writeStage: sync.writeStage || 'idle',
                              writeStartedAt: sync.writeStartedAt || 'Never',
                              writeTimedOutAt: sync.writeTimedOutAt || 'Never',
                              writeDurationMs: sync.writeDurationMs ?? null,
                              firebaseErrorCode: sync.firebaseErrorCode || 'None',
                              firebaseErrorMessage: sync.firebaseErrorMessage || 'None',
                              onlineState: sync.onlineState || 'Unknown',
                              snapshotFromCache: sync.snapshotFromCache ? 'Yes' : 'No',
                              hasPendingWrites: sync.hasPendingWrites ? 'Yes' : 'No'
                            };

                            navigator.clipboard.writeText(JSON.stringify(diagnosticsReport, null, 2))
                              .then(() => showToast(lang === 'es' ? '¡Diagnósticos copiados!' : 'Diagnostics copied!'))
                              .catch((err) => showToast(`Copy error: ${err.message || String(err)}`));
                          }}
                          style={{
                            marginBottom: 8,
                            padding: '8px 12px',
                            borderRadius: 8,
                            background: 'rgba(128, 128, 128, 0.08)',
                            color: 'var(--c-text-primary)',
                            border: '1px solid rgba(128, 128, 128, 0.15)',
                            fontWeight: 700,
                            fontFamily: 'Manrope',
                            fontSize: 11,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>content_copy</span>
                          {lang === 'es' ? 'Copiar diagnósticos de sync' : 'Copy Sync Diagnostics'}
                        </button>

                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Auth UID:</strong> <code style={codeBreakStyle}>{user.uid}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Firebase Project ID:</strong> <code style={codeBreakStyle}>{sync.firebaseProjectId || 'Not Configured'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Firebase App ID:</strong> <code style={codeBreakStyle}>{sync.firebaseAppId || 'Not Configured'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Auth Domain:</strong> <code style={codeBreakStyle}>{sync.firebaseAuthDomain || 'Not Configured'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Storage Bucket:</strong> <code style={codeBreakStyle}>{sync.firebaseStorageBucket || 'Not Configured'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Firebase Apps Count:</strong> <code style={codeBreakStyle}>{sync.firebaseAppsCount ?? 0}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Firebase App Name:</strong> <code style={codeBreakStyle}>{sync.firebaseAppName || 'None'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Firebase Auth Available:</strong> <code style={codeBreakStyle}>{sync.authAvailable ? 'Yes' : 'No'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Firestore Db Available:</strong> <code style={codeBreakStyle}>{sync.dbAvailable ? 'Yes' : 'No'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Firebase Storage Available:</strong> <code style={codeBreakStyle}>{sync.storageAvailable ? 'Yes' : 'No'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Firebase Init Error:</strong> <code style={{ ...codeBreakStyle, color: sync.firebaseInitError && sync.firebaseInitError !== 'None' ? '#ef4444' : 'inherit' }}>{sync.firebaseInitError || 'None'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Sync Engine Init Error:</strong> <code style={{ ...codeBreakStyle, color: sync.syncEngineInitError && sync.syncEngineInitError !== 'None' ? '#ef4444' : 'inherit' }}>{sync.syncEngineInitError || 'None'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Sync Engine Version:</strong> <code style={codeBreakStyle}>{sync.syncEngineVersion || 'sync-engine-v1'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Current deviceId:</strong> <code style={codeBreakStyle}>{deviceId()}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Current platform:</strong> <code style={codeBreakStyle}>{sync.currentDevicePlatform || 'web'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Device shortName:</strong> <code style={codeBreakStyle}>{sync.shortName || 'N/A'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Device displayName:</strong> <code style={codeBreakStyle}>{sync.displayName || 'N/A'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Device technicalName:</strong> <code style={codeBreakStyle}>{sync.technicalName || 'N/A'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Device write path:</strong> <code style={codeBreakStyle}>{sync.deviceWritePath || 'N/A'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Device listener path:</strong> <code style={codeBreakStyle}>{sync.devicesListenerPath || 'N/A'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Firestore state:</strong> <code style={codeBreakStyle}>{window.navigator.onLine ? 'Online' : 'Offline'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Registration status:</strong> <code style={{ ...codeBreakStyle, textTransform: 'capitalize', color: sync.deviceRegistrationStatus === 'registered' ? '#10b981' : sync.deviceRegistrationStatus === 'failed' ? '#ef4444' : '#f59e0b' }}>{sync.deviceRegistrationStatus || 'pending'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Last write attempted:</strong> <code style={codeBreakStyle}>{sync.lastDeviceWriteAttemptedAt || 'Never'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Last write success:</strong> <code style={codeBreakStyle}>{sync.lastDeviceWriteSuccess || 'Never'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Last write error:</strong> <code style={{ ...codeBreakStyle, color: sync.lastDeviceWriteError && sync.lastDeviceWriteError !== 'None' ? '#ef4444' : 'inherit' }}>{sync.lastDeviceWriteError || 'None'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Last write duration ms:</strong> <code style={codeBreakStyle}>{sync.lastDeviceWriteDurationMs != null ? `${sync.lastDeviceWriteDurationMs}` : 'N/A'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Last snapshot received:</strong> <code style={codeBreakStyle}>{sync.lastDeviceSnapshotAt || 'Never'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Documents received:</strong> <code style={codeBreakStyle}>{sync.devicesSnapshotCount ?? 0}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Device IDs received:</strong> <code style={codeBreakStyle}>{(sync.deviceIdsReceived && sync.deviceIdsReceived.length > 0) ? sync.deviceIdsReceived.join(', ') : 'None'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Devices rendered count:</strong> <code style={codeBreakStyle}>{sync.devicesRenderedCount ?? 0}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Current device matched in snapshot:</strong> <code style={codeBreakStyle}>{sync.currentDeviceMatchedInSnapshot ? 'Yes' : 'No'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Other devices count:</strong> <code style={codeBreakStyle}>{sync.otherDevicesCount ?? 0}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Hidden/filtered devices count:</strong> <code style={codeBreakStyle}>{sync.hiddenDevicesCount ?? 0}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Hidden/filtered device reasons:</strong> <code style={codeBreakStyle}>{sync.hiddenDeviceReasons || 'None'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Manual register button state:</strong> <code style={codeBreakStyle}>{busy ? 'Busy' : 'Idle'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>In-flight write status:</strong> <code style={codeBreakStyle}>{sync.inFlightWriteStatus ? 'Writing...' : 'Idle'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Last registration reason:</strong> <code style={codeBreakStyle}>{sync.lastDeviceRegistrationReason || 'None'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Active devices count:</strong> <code style={codeBreakStyle}>{sync.activeDevicesCount ?? 0}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Stale devices count:</strong> <code style={codeBreakStyle}>{sync.staleDevicesCount ?? 0}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Legacy devices count:</strong> <code style={codeBreakStyle}>{sync.legacyDevicesCount ?? 0}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Grouped device IDs:</strong> <code style={codeBreakStyle}>{sync.groupedDeviceIds || 'None'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Duplicate candidates:</strong> <code style={codeBreakStyle}>{sync.duplicateCandidates || 'None'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Replacement map:</strong> <code style={codeBreakStyle}>{sync.replacementMap || 'None'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Legacy documents detected:</strong> <code style={codeBreakStyle}>{sync.legacyDocumentsDetected ? 'Yes' : 'No'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Device ID storage key:</strong> <code style={codeBreakStyle}>{sync.deviceIdStorageKey || 'N/A'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Stored deviceId:</strong> <code style={codeBreakStyle}>{sync.storedDeviceId || 'N/A'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Old legacy keys found:</strong> <code style={codeBreakStyle}>{sync.oldLegacyDeviceIdKeysFound || 'None'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Last legacy cleanup attempt:</strong> <code style={codeBreakStyle}>{sync.lastLegacyCleanupAttempt || 'Never'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Last legacy cleanup success:</strong> <code style={codeBreakStyle}>{sync.lastLegacyCleanupSuccess || 'Never'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Last legacy cleanup error:</strong> <code style={codeBreakStyle}>{sync.lastLegacyCleanupError || 'None'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Auth ready:</strong> <code style={codeBreakStyle}>{sync.authReady ? 'Yes' : 'No'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Devices logic version:</strong> <code style={codeBreakStyle}>{sync.devicesLogicVersion || 'N/A'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Last heartbeat success:</strong> <code style={codeBreakStyle}>{sync.lastHeartbeatSuccess || 'Never'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Last heartbeat error:</strong> <code style={{ ...codeBreakStyle, color: sync.lastHeartbeatError && sync.lastHeartbeatError !== 'None' ? '#ef4444' : 'inherit' }}>{sync.lastHeartbeatError || 'None'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Profile listener status:</strong> <code style={{ ...codeBreakStyle, textTransform: 'capitalize' }}>{sync.profileListenerStatus || 'inactive'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Appearance listener status:</strong> <code style={{ ...codeBreakStyle, textTransform: 'capitalize' }}>{sync.appearanceListenerStatus || 'inactive'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Preferences listener status:</strong> <code style={{ ...codeBreakStyle, textTransform: 'capitalize' }}>{sync.preferencesListenerStatus || 'inactive'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Last profile write success:</strong> <code style={codeBreakStyle}>{sync.lastProfileWriteSuccess || 'Never'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Last profile write error:</strong> <code style={{ ...codeBreakStyle, color: sync.lastProfileWriteError && sync.lastProfileWriteError !== 'None' ? '#ef4444' : 'inherit' }}>{sync.lastProfileWriteError || 'None'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Last appearance write success:</strong> <code style={codeBreakStyle}>{sync.lastAppearanceWriteSuccess || 'Never'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Last appearance write error:</strong> <code style={{ ...codeBreakStyle, color: sync.lastAppearanceWriteError && sync.lastAppearanceWriteError !== 'None' ? '#ef4444' : 'inherit' }}>{sync.lastAppearanceWriteError || 'None'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Last preferences write success:</strong> <code style={codeBreakStyle}>{sync.lastPreferencesWriteSuccess || 'Never'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Last preferences write error:</strong> <code style={{ ...codeBreakStyle, color: sync.lastPreferencesWriteError && sync.lastPreferencesWriteError !== 'None' ? '#ef4444' : 'inherit' }}>{sync.lastPreferencesWriteError || 'None'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Last photo upload error:</strong> <code style={{ ...codeBreakStyle, color: sync.lastPhotoUploadError && sync.lastPhotoUploadError !== 'None' ? '#ef4444' : 'inherit' }}>{sync.lastPhotoUploadError || 'None'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Cloud Theme:</strong> <code style={codeBreakStyle}>{sync.cloudTheme || 'N/A'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Cloud Accent Color:</strong> <code style={codeBreakStyle}>{sync.cloudAccentColor || 'N/A'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Cloud Display Name:</strong> <code style={codeBreakStyle}>{sync.cloudDisplayName || 'N/A'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Cloud Photo URL:</strong> <code style={codeBreakStyle}>{sync.cloudPhotoURL || 'N/A'}</code>
                        </p>

                        <div style={{ height: 1, background: 'rgba(128,128,128,0.08)', margin: '8px 0' }} />
                        <div style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 11, padding: '4px 0', opacity: 0.75, color: 'var(--c-text-primary)' }}>Action Tracking</div>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Last diagnostics action:</strong> <code style={codeBreakStyle}>{sync.lastAction || 'None'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Action timestamp:</strong> <code style={codeBreakStyle}>{sync.lastActionAt || 'Never'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Button action status:</strong> <code style={{ ...codeBreakStyle, textTransform: 'capitalize', color: sync.buttonActionStatus === 'success' ? '#10b981' : sync.buttonActionStatus === 'error' ? '#ef4444' : '#f59e0b' }}>{sync.buttonActionStatus || 'idle'}</code>
                        </p>

                        <div style={{ height: 1, background: 'rgba(128,128,128,0.08)', margin: '8px 0' }} />
                        <div style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 11, padding: '4px 0', opacity: 0.75, color: 'var(--c-text-primary)' }}>Firestore Transport & Cache</div>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Firestore transport mode:</strong> <code style={codeBreakStyle}>{sync.firestoreTransportMode || 'default'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Firestore persistence mode:</strong> <code style={codeBreakStyle}>{sync.firestorePersistenceMode || 'none'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Firestore initialization source:</strong> <code style={codeBreakStyle}>{sync.firestoreInitSource || 'not-started'}</code>
                        </p>

                        <div style={{ height: 1, background: 'rgba(128,128,128,0.08)', margin: '8px 0' }} />
                        <div style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 11, padding: '4px 0', opacity: 0.75, color: 'var(--c-text-primary)' }}>Timing & Write Stage Tracking</div>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Current write stage:</strong> <code style={codeBreakStyle}>{sync.writeStage || 'idle'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Write started at:</strong> <code style={codeBreakStyle}>{sync.writeStartedAt || 'Never'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Write timed out at:</strong> <code style={codeBreakStyle}>{sync.writeTimedOutAt || 'Never'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Write duration ms:</strong> <code style={codeBreakStyle}>{sync.writeDurationMs != null ? `${sync.writeDurationMs}` : 'N/A'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Firebase error code:</strong> <code style={codeBreakStyle}>{sync.firebaseErrorCode || 'None'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Firebase error message:</strong> <code style={codeBreakStyle}>{sync.firebaseErrorMessage || 'None'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Network online state:</strong> <code style={codeBreakStyle}>{sync.onlineState || 'Unknown'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Snapshot loaded from cache:</strong> <code style={codeBreakStyle}>{sync.snapshotFromCache ? 'Yes' : 'No'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Has pending local writes:</strong> <code style={codeBreakStyle}>{sync.hasPendingWrites ? 'Yes' : 'No'}</code>
                        </p>

                        <div style={{ height: 1, background: 'rgba(128,128,128,0.08)', margin: '8px 0' }} />
                        <div style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 11, padding: '4px 0', opacity: 0.75, color: 'var(--c-text-primary)' }}>Direct Write Test (Bypass Engine)</div>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Direct write path:</strong> <code style={codeBreakStyle}>{sync.directWritePath || 'N/A'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Direct write attempt:</strong> <code style={codeBreakStyle}>{sync.directWriteAttempt || 'Never'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Direct write success:</strong> <code style={codeBreakStyle}>{sync.directWriteSuccess || 'Never'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Direct write error:</strong> <code style={{ ...codeBreakStyle, color: sync.directWriteError && sync.directWriteError !== 'None' ? '#ef4444' : 'inherit' }}>{sync.directWriteError || 'None'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Direct write duration ms:</strong> <code style={codeBreakStyle}>{sync.directWriteDurationMs != null ? `${sync.directWriteDurationMs}` : 'N/A'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Direct read-back success:</strong> <code style={codeBreakStyle}>{sync.directReadBackSuccess || 'Never'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Direct read-back error:</strong> <code style={{ ...codeBreakStyle, color: sync.directReadBackError && sync.directReadBackError !== 'None' ? '#ef4444' : 'inherit' }}>{sync.directReadBackError || 'None'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Direct read-back data:</strong> <code style={codeBreakStyle}>{sync.directReadBackData || 'N/A'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Direct listener docs received:</strong> <code style={codeBreakStyle}>{sync.directListenerDocumentsReceived ?? 0}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Direct listener deviceIds received:</strong> <code style={codeBreakStyle}>{(sync.directListenerDeviceIdsReceived && sync.directListenerDeviceIdsReceived.length > 0) ? sync.directListenerDeviceIdsReceived.join(', ') : 'None'}</code>
                        </p>

                        <div style={{ height: 1, background: 'rgba(128,128,128,0.08)', margin: '8px 0' }} />
                        <div style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 11, padding: '4px 0', opacity: 0.75, color: 'var(--c-text-primary)' }}>Cloud Sync Probe</div>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Probe write path:</strong> <code style={codeBreakStyle}>{sync.probeWritePath || 'N/A'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Probe listener path:</strong> <code style={codeBreakStyle}>{sync.probeListenerPath || 'N/A'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Probe listener status:</strong> <code style={codeBreakStyle}>{sync.probeListenerStatus || 'idle'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Probe listener attached:</strong> <code style={codeBreakStyle}>{sync.probeListenerAttachedAt || 'Never'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Probe snapshot from cache:</strong> <code style={codeBreakStyle}>{sync.probeSnapshotFromCache ? 'Yes' : 'No'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Probe snapshot pending writes:</strong> <code style={codeBreakStyle}>{sync.probeSnapshotHasPendingWrites ? 'Yes' : 'No'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Probe listener error:</strong> <code style={{ ...codeBreakStyle, color: sync.probeListenerError ? '#ef4444' : 'inherit' }}>{sync.probeListenerError || 'None'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Last probe write attempt:</strong> <code style={codeBreakStyle}>{sync.lastProbeWriteAttempt || 'Never'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Last probe write success:</strong> <code style={codeBreakStyle}>{sync.lastProbeWriteSuccess || 'Never'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Last probe write error:</strong> <code style={{ ...codeBreakStyle, color: sync.lastProbeWriteError && sync.lastProbeWriteError !== 'None' ? '#ef4444' : 'inherit' }}>{sync.lastProbeWriteError || 'None'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Probe documents received:</strong> <code style={codeBreakStyle}>{sync.probeDocumentsReceived ?? 0}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Probe deviceIds received:</strong> <code style={codeBreakStyle}>{sync.probeDeviceIdsReceived?.join(', ') || 'None'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Probe nonces received:</strong> <code style={codeBreakStyle}>{sync.probeNoncesReceived?.join(', ') || 'None'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Android probe detected:</strong> <code style={codeBreakStyle}>{sync.androidProbeDetected ? 'Yes' : 'No'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Web probe detected:</strong> <code style={codeBreakStyle}>{sync.webProbeDetected ? 'Yes' : 'No'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Same Auth UID confirmed:</strong> <code style={{ ...codeBreakStyle, color: sync.sameUidConfirmed ? '#10b981' : '#f59e0b' }}>{sync.sameUidConfirmed ? 'Confirmed' : 'Unconfirmed'}</code>
                        </p>
                        <p style={{ margin: 0, color: 'var(--c-text-secondary)' }}>
                          <strong>Same Firebase project confirmed:</strong> <code style={{ ...codeBreakStyle, color: sync.sameProjectConfirmed ? '#10b981' : '#f59e0b' }}>{sync.sameProjectConfirmed ? 'Confirmed' : 'Unconfirmed'}</code>
                        </p>
                        {sync.probeDocs && sync.probeDocs.length > 0 && (
                          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ fontWeight: 800, fontSize: 10, opacity: 0.7, fontFamily: 'Manrope' }}>Probe Documents Received:</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '180px', overflowY: 'auto' }}>
                              {sync.probeDocs.map((docItem: any) => (
                                <div key={docItem.id} style={{ padding: '6px 8px', background: 'rgba(128,128,128,0.06)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10, fontFamily: 'Inter' }}>
                                  <div><strong>Doc ID:</strong> <code>{docItem.id}</code></div>
                                  <div><strong>Device ID:</strong> <code>{docItem.deviceId}</code></div>
                                  <div><strong>Platform:</strong> <code>{docItem.platform}</code></div>
                                  <div><strong>Name:</strong> <span>{docItem.shortName}</span></div>
                                  <div><strong>Version:</strong> <span>{docItem.appVersion}</span></div>
                                  <div><strong>Build:</strong> <span>{docItem.buildType}</span></div>
                                  <div><strong>Commit:</strong> <code>{docItem.commitSha}</code></div>
                                  <div><strong>Nonce:</strong> <code>{docItem.nonce}</code></div>
                                  <div><strong>Written:</strong> <span>{docItem.writtenAt ? new Date(docItem.writtenAt).toLocaleTimeString() : 'N/A'}</span></div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                          <button
                            onClick={async () => {
                              setBusy(true);
                              try {
                                const { runSyncProbe } = await import('../lib/syncEngine');
                                const nonce = await runSyncProbe();
                                showToast(lang === 'es' ? `¡Sonda enviada! Nonce: ${nonce}` : `Probe sent! Nonce: ${nonce}`);
                              } catch (e: any) {
                                showToast(`Error: ${e.message || String(e)}`);
                              } finally {
                                setBusy(false);
                              }
                            }}
                            disabled={busy}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 8,
                              background: 'rgba(168, 85, 247, 0.1)',
                              color: 'var(--accent-to, #a855f7)',
                              border: '1px solid rgba(168, 85, 247, 0.25)',
                              fontWeight: 700,
                              fontFamily: 'Manrope',
                              fontSize: 11,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              opacity: busy ? 0.6 : 1,
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>sensors</span>
                            {lang === 'es' ? 'Enviar sonda de sync' : 'Send Sync Probe'}
                          </button>

                          <button
                            onClick={async () => {
                              setBusy(true);
                              try {
                                const { clearMyProbeOnly } = await import('../lib/syncEngine');
                                await clearMyProbeOnly();
                                showToast(lang === 'es' ? 'Sonda eliminada.' : 'Probe cleared.');
                              } catch (e: any) {
                                showToast(`Error: ${e.message || String(e)}`);
                              } finally {
                                setBusy(false);
                              }
                            }}
                            disabled={busy}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 8,
                              background: 'rgba(239, 68, 68, 0.08)',
                              color: '#ff6b6b',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              fontWeight: 700,
                              fontFamily: 'Manrope',
                              fontSize: 11,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              opacity: busy ? 0.6 : 1,
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                            {lang === 'es' ? 'Borrar mi sonda' : 'Clear My Probe'}
                          </button>

                          <button
                            onClick={async () => {
                              setBusy(true);
                              try {
                                const { runDirectFirestoreWriteTest } = await import('../lib/syncEngine');
                                await runDirectFirestoreWriteTest();
                                showToast(lang === 'es' ? '¡Prueba de escritura completada!' : 'Direct write test complete!');
                              } catch (e: any) {
                                showToast(`Error: ${e.message || String(e)}`);
                              } finally {
                                setBusy(false);
                              }
                            }}
                            disabled={busy}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 8,
                              background: 'rgba(34, 197, 94, 0.1)',
                              color: '#22c55e',
                              border: '1px solid rgba(34, 197, 94, 0.25)',
                              fontWeight: 700,
                              fontFamily: 'Manrope',
                              fontSize: 11,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              opacity: busy ? 0.6 : 1,
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>rate_review</span>
                            {lang === 'es' ? 'Prueba escritura directa' : 'Direct Firestore Write Test'}
                          </button>

                          <button
                            onClick={async () => {
                              if (!sync.dbAvailable) {
                                showToast('Error: Firestore db unavailable');
                                return;
                              }
                              setBusy(true);
                              try {
                                await registerCurrentDevice(user.uid, 'manual-button');
                                const currentStatus = getSyncStatus();
                                if (currentStatus.lastDeviceWriteError && currentStatus.lastDeviceWriteError !== 'None') {
                                  showToast(`Error: ${currentStatus.lastDeviceWriteError}`);
                                } else {
                                  showToast(lang === 'es' ? '¡Registro completado!' : 'Registration complete!');
                                }
                              } catch (e: any) {
                                showToast(`Error: ${e.message || String(e)}`);
                              } finally {
                                setBusy(false);
                              }
                            }}
                            disabled={busy || sync.deviceRegistrationStatus === 'pending' || sync.inFlightWriteStatus}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 8,
                              background: accent.from,
                              color: '#fff',
                              border: 'none',
                              fontWeight: 700,
                              fontFamily: 'Manrope',
                              fontSize: 11,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              opacity: (busy || sync.deviceRegistrationStatus === 'pending' || sync.inFlightWriteStatus) ? 0.6 : 1,
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>app_registration</span>
                            {lang === 'es' ? 'Registrar este dispositivo ahora' : 'Register this device now'}
                          </button>

                          <button
                            onClick={async () => {
                              setBusy(true);
                              try {
                                const { reconnectDevices } = await import('../lib/sync');
                                await reconnectDevices();
                                showToast(lang === 'es' ? '¡Dispositivos reconectados!' : 'Devices reconnected!');
                              } catch (e: any) {
                                showToast(`Error: ${e.message || String(e)}`);
                              } finally {
                                setBusy(false);
                              }
                            }}
                            disabled={busy}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 8,
                              background: 'rgba(128,128,128,0.1)',
                              color: 'var(--c-text-primary)',
                              border: '1px solid rgba(128,128,128,0.15)',
                              fontWeight: 700,
                              fontFamily: 'Manrope',
                              fontSize: 11,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              opacity: busy ? 0.6 : 1,
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>sync</span>
                            {lang === 'es' ? 'Reconectar dispositivos' : 'Reconnect Devices'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ height: 1, background: 'rgba(128,128,128,0.1)', margin: '4px 0' }} />
                  
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
                </>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}


      {/* ── Privacy & Data sheet ── */}
      {sheet === 'privacy-data' && createPortal(
        <div style={overlayStyle}>
          <div style={backdropStyle} onClick={closeSheet} />
          <div className="profile-panel-sheet" style={sheetStyle}>
            {dragPill}
            <SheetHeader title={lang === 'es' ? 'Privacidad y datos' : 'Privacy & Data'} onClose={closeSheet} />
            
            <div
              style={{
                padding: '12px 22px 32px',
                display: 'flex',
                flexDirection: 'column',
                gap: 20, // Clear, separated breathing room
                maxHeight: 'calc(80vh - env(safe-area-inset-bottom) - 80px)',
                overflowY: 'auto',
                width: '100%',
                boxSizing: 'border-box',
              }}
              className="no-scrollbar animate-fade-in"
            >
              {/* Card 1: Privacy Dashboard */}
              <div style={{
                background: 'var(--app-surface-high, rgba(128,128,128,0.05))',
                borderRadius: 16,
                padding: '20px 22px',
                border: '1px solid rgba(128,128,128,0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                boxSizing: 'border-box',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
              }}>
                <p style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 15, color: 'var(--c-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <DashboardIconSVG color={accent.from} />
                  {lang === 'es' ? 'Panel de Privacidad' : 'Privacy Dashboard'}
                </p>
                <p style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--c-text-secondary)', margin: '4px 0 0', lineHeight: 1.5, opacity: 0.8 }}>
                  {lang === 'es' ? 'Resumen rápido de tu configuración de privacidad.' : 'Quick overview of your privacy settings.'}
                </p>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                  marginTop: 12,
                }}>
                  <div style={{ background: 'rgba(128,128,128,0.06)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <p style={{ fontFamily: 'Inter', fontSize: 10, color: 'var(--c-text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{lang === 'es' ? 'Análisis' : 'Analytics'}</p>
                    <p style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 13, margin: 0, color: settings.privacyAnalytics ? '#10b981' : 'var(--c-text-secondary)' }}>
                      {settings.privacyAnalytics ? (lang === 'es' ? 'Activo' : 'Enabled') : (lang === 'es' ? 'Inactivo' : 'Disabled')}
                    </p>
                  </div>
                  <div style={{ background: 'rgba(128,128,128,0.06)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <p style={{ fontFamily: 'Inter', fontSize: 10, color: 'var(--c-text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Backup</p>
                    <p style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 13, margin: 0, color: (settings.autoBackup || sync.signedIn) ? '#10b981' : 'var(--c-text-secondary)' }}>
                      {(settings.autoBackup || sync.signedIn) ? (lang === 'es' ? 'Activo' : 'Enabled') : (lang === 'es' ? 'Backup off' : 'Backup off')}
                    </p>
                  </div>
                  <div style={{ background: 'rgba(128,128,128,0.06)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 3, gridColumn: 'span 2' }}>
                    <p style={{ fontFamily: 'Inter', fontSize: 10, color: 'var(--c-text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{lang === 'es' ? 'Última exportación' : 'Last Export Date'}</p>
                    <p style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 13, margin: 0, color: 'var(--c-text-primary)' }}>
                      {settings.lastExportDate === 'Never exported' ? (lang === 'es' ? 'Nunca exportado' : 'Never exported') : settings.lastExportDate}
                    </p>
                  </div>
                  <div style={{ background: 'rgba(128,128,128,0.06)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 3, gridColumn: 'span 2' }}>
                    <p style={{ fontFamily: 'Inter', fontSize: 10, color: 'var(--c-text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{lang === 'es' ? 'Servicios conectados' : 'Connected Services'}</p>
                    <p style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 13, margin: 0, color: 'var(--c-text-primary)' }}>
                      {isGoogleUser ? (lang === 'es' ? '1 servicio conectado (Google)' : '1 service connected (Google)') : (lang === 'es' ? 'Sin servicios conectados' : 'No services connected')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 2: Backup & Sync */}
              <div style={{
                background: 'var(--app-surface-high, rgba(128,128,128,0.05))',
                borderRadius: 16,
                padding: '20px 22px',
                border: '1px solid rgba(128,128,128,0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                boxSizing: 'border-box',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
              }}>
                <p style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 15, color: 'var(--c-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <BackupSyncIconSVG color="#10b981" />
                  {lang === 'es' ? 'Copia y Sincronización' : 'Backup & Sync'}
                </p>
                <p style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--c-text-secondary)', margin: '4px 0 0', lineHeight: 1.5, opacity: 0.8 }}>
                  {lang === 'es' ? 'Gestiona tus copias en la nube y preferencias de sincronización.' : 'Manage cloud backups and sync preferences.'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 10 }}>
                  <SettingRowUI label={lang === 'es' ? 'Copia automática' : 'Auto Backup'} desc={lang === 'es' ? 'Respaldar automáticamente tus datos.' : 'Automatically back up your Studio data.'}>
                    <Toggle value={settings.autoBackup} onChange={(v) => updateSettings({ autoBackup: v })} accentFrom={accent.from} accentTo={accent.to} />
                  </SettingRowUI>
                  <SettingRowUI label={lang === 'es' ? 'Sincronizar dispositivos' : 'Sync Across Devices'} desc={lang === 'es' ? 'Mantén tus datos sincronizados en todos tus dispositivos.' : 'Keep your Studio data synced across your devices.'}>
                    <Toggle value={settings.syncAcrossDevices} onChange={(v) => updateSettings({ syncAcrossDevices: v })} accentFrom={accent.from} accentTo={accent.to} />
                  </SettingRowUI>
                  <SettingRowUI label={lang === 'es' ? 'Frecuencia de copia' : 'Backup Frequency'}>
                    <SelectControl
                      value={settings.backupFrequency}
                      options={[
                        { value: 'manual', label: 'Manual' },
                        { value: 'daily', label: lang === 'es' ? 'Diario' : 'Daily' },
                        { value: 'weekly', label: lang === 'es' ? 'Semanal' : 'Weekly' },
                        { value: 'monthly', label: lang === 'es' ? 'Mensual' : 'Monthly' },
                      ]}
                      onChange={(v) => updateSettings({ backupFrequency: v })}
                      accent={accent}
                    />
                  </SettingRowUI>
                </div>

                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(128,128,128,0.08)' }}>
                  {!sync.signedIn ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--c-text-secondary)' }}>cloud_off</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-primary)' }}>
                          {lang === 'es' ? 'Sincronización desactivada' : 'Sync is disabled'}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--c-text-secondary)', lineHeight: 1.45, margin: 0 }}>
                        {lang === 'es'
                          ? 'Inicia sesión con tu cuenta para respaldar tus proyectos en la nube automáticamente.'
                          : 'Sign in with your account to back up your projects to the cloud automatically.'}
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {sync.phase === 'syncing' ? (
                          <StudioSpinner outerSize="h-[18px] w-[18px]" childSize="h-[14px] w-[14px]" colorFrom={accent.from} colorTo={accent.to} />
                        ) : (
                          <span
                            className={sync.phase === 'success' ? 'sync-pop' : ''}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            {sync.phase === 'error'
                              ? <SyncProblemIconSVG />
                              : !settings.syncAcrossDevices
                                ? <CloudOffIconSVG />
                                : <CheckCircleIconSVG />
                            }
                          </span>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-primary)' }}>
                            {sync.phase === 'syncing'
                              ? (lang === 'es' ? 'Sincronizando...' : 'Syncing...')
                              : sync.phase === 'error'
                                ? (lang === 'es' ? 'Error al sincronizar' : 'Sync Failed')
                                : !settings.syncAcrossDevices
                                  ? getSyncPausedLabel(lang)
                                  : (lang === 'es' ? 'Sincronizado con la nube' : 'Cloud Sync Active')}
                          </span>
                          <p style={{ fontSize: 11, color: 'var(--c-text-secondary)', margin: '2px 0 0' }}>
                            {sync.phase === 'error' && sync.error
                              ? sync.error
                              : !settings.syncAcrossDevices
                                ? (lang === 'es' ? 'Activa "Sincronizar entre dispositivos" para reanudar.' : 'Enable "Sync across devices" to resume.')
                                : sync.lastSyncedMs
                                  ? `${lang === 'es' ? 'Sincronizado' : 'Synced'} · ${formatRelative(sync.lastSyncedMs, lang)}`
                                  : (lang === 'es' ? 'No sincronizado aún' : 'Not synced yet')}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={sync.phase === 'error' ? doRetry : doSyncNow}
                        disabled={busy || sync.phase === 'syncing'}
                        style={{
                          ...pillBtn(accent, sync.phase === 'error'),
                          width: '100%',
                          padding: '10px 0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          borderRadius: 10,
                        }}
                      >
                        <span className={`material-symbols-outlined ${sync.phase === 'syncing' ? 'sync-spin' : ''}`} style={{ fontSize: 16 }}>
                          sync
                        </span>
                        {sync.phase === 'error' ? (lang === 'es' ? 'Reintentar' : 'Retry') : (lang === 'es' ? 'Sincronizar ahora' : 'Sync Now')}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 3: Analytics & Diagnostics */}
              <div style={{
                background: 'var(--app-surface-high, rgba(128,128,128,0.05))',
                borderRadius: 16,
                padding: '20px 22px',
                border: '1px solid rgba(128,128,128,0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                boxSizing: 'border-box',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
              }}>
                <p style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 15, color: 'var(--c-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AnalyticsIconSVG color="#f59e0b" />
                  {lang === 'es' ? 'Análisis y Diagnósticos' : 'Analytics & Diagnostics'}
                </p>
                <p style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--c-text-secondary)', margin: '4px 0 0', lineHeight: 1.5, opacity: 0.8 }}>
                  {lang === 'es' ? 'Ayuda a mejorar Studio compartiendo estadísticas de uso de forma anónima.' : 'Help improve Studio by sharing anonymous usage data.'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 10 }}>
                  <SettingRowUI label={lang === 'es' ? 'Métricas anónimas' : 'Anonymous Analytics'} desc={lang === 'es' ? 'Compartir estadísticas de uso anónimas.' : 'Share anonymous usage data to improve Studio.'}>
                    <Toggle value={settings.privacyAnalytics} onChange={(v) => updateSettings({ privacyAnalytics: v })} accentFrom={accent.from} accentTo={accent.to} />
                  </SettingRowUI>
                  <SettingRowUI label={lang === 'es' ? 'Reportes de fallos' : 'Crash Reports'} desc={lang === 'es' ? 'Enviar reportes de errores de forma anónima.' : 'Send crash reports to help fix bugs.'}>
                    <Toggle value={settings.privacyCrashReports} onChange={(v) => updateSettings({ privacyCrashReports: v })} accentFrom={accent.from} accentTo={accent.to} />
                  </SettingRowUI>
                  <SettingRowUI label={lang === 'es' ? 'Reportes de rendimiento' : 'Performance Reports'} desc={lang === 'es' ? 'Compartir estadísticas de rendimiento anónimas.' : 'Share anonymous performance data.'}>
                    <Toggle value={settings.privacyPerfReports} onChange={(v) => updateSettings({ privacyPerfReports: v })} accentFrom={accent.from} accentTo={accent.to} />
                  </SettingRowUI>
                </div>
              </div>

              {/* Card 4: Data Retention */}
              <div style={{
                background: 'var(--app-surface-high, rgba(128,128,128,0.05))',
                borderRadius: 16,
                padding: '20px 22px',
                border: '1px solid rgba(128,128,128,0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                boxSizing: 'border-box',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
              }}>
                <p style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 15, color: 'var(--c-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <RetentionIconSVG color="#0891b2" />
                  {lang === 'es' ? 'Retención de Datos' : 'Data Retention'}
                </p>
                <p style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--c-text-secondary)', margin: '4px 0 0', lineHeight: 1.5, opacity: 0.8 }}>
                  {lang === 'es' ? 'Controla cuánto tiempo conserva Studio tus copias de seguridad.' : 'Control how long Studio keeps your data.'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 10 }}>
                  <SettingRowUI label={lang === 'es' ? 'Retención de copias' : 'Backup Retention'}>
                    <SelectControl
                      value={settings.backupRetention}
                      options={[
                        { value: 'forever', label: lang === 'es' ? 'Mantener para siempre' : 'Keep backups forever' },
                        { value: '90days', label: lang === 'es' ? 'Borrar tras 90 días' : 'Delete old backups after 90 days' },
                        { value: '30days', label: lang === 'es' ? 'Borrar tras 30 días' : 'Delete old backups after 30 days' },
                      ]}
                      onChange={(v) => updateSettings({ backupRetention: v })}
                      accent={accent}
                    />
                  </SettingRowUI>
                  <SettingRowUI label={lang === 'es' ? 'Limpieza de temporales' : 'Auto-clean Temp Files'} desc={lang === 'es' ? 'Eliminar caché de archivos de audio no necesarios.' : 'Automatically remove temporary files and cached data.'}>
                    <Toggle value={settings.autoCleanTemp} onChange={(v) => updateSettings({ autoCleanTemp: v })} accentFrom={accent.from} accentTo={accent.to} />
                  </SettingRowUI>
                </div>
              </div>

              {/* Card 5: Connected Services */}
              <div style={{
                background: 'var(--app-surface-high, rgba(128,128,128,0.05))',
                borderRadius: 16,
                padding: '20px 22px',
                border: '1px solid rgba(128,128,128,0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                boxSizing: 'border-box',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
              }}>
                <p style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 15, color: 'var(--c-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <LinkIconSVG color="#db2777" />
                  {lang === 'es' ? 'Servicios Conectados' : 'Connected Services'}
                </p>
                <p style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--c-text-secondary)', margin: '4px 0 0', lineHeight: 1.5, opacity: 0.8 }}>
                  {lang === 'es' ? 'Gestiona los servicios externos vinculados a tu cuenta.' : 'Manage third-party services connected to your account.'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  <div style={{ background: 'rgba(128,128,128,0.06)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                      <GoogleIconSVG />
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--c-text-primary)', fontFamily: 'Manrope' }}>Google</span>
                    </div>
                    <span style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      fontFamily: 'Manrope',
                      color: isGoogleUser ? '#10b981' : 'var(--c-text-secondary)',
                      background: isGoogleUser ? 'rgba(16,185,129,0.12)' : 'rgba(128,128,128,0.1)',
                      border: `1px solid ${isGoogleUser ? 'rgba(16,185,129,0.25)' : 'rgba(128,128,128,0.15)'}`,
                      borderRadius: 6,
                      padding: '3px 8px',
                      textTransform: 'uppercase',
                    }}>
                      {isGoogleUser ? (lang === 'es' ? 'Conectado' : 'Connected') : (lang === 'es' ? 'No conectado' : 'Not connected')}
                    </span>
                  </div>
                  {[
                    { name: 'Dropbox', icon: <DropboxIconSVG /> },
                    { name: 'OneDrive', icon: <OneDriveIconSVG /> },
                    { name: 'GitHub', icon: <GitHubIconSVG /> }
                  ].map((service) => (
                    <div key={service.name} style={{ background: 'rgba(128,128,128,0.06)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: 0.55 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                        {service.icon}
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--c-text-primary)', fontFamily: 'Manrope' }}>{service.name}</span>
                      </div>
                      <span style={{
                        fontSize: 9,
                        fontWeight: 700,
                        fontFamily: 'Manrope',
                        color: 'var(--c-text-secondary)',
                        background: 'rgba(128,128,128,0.12)',
                        border: '1px solid rgba(128,128,128,0.18)',
                        borderRadius: 6,
                        padding: '3px 8px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}>
                        {lang === 'es' ? 'Próximamente' : 'Coming soon'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card 6: Storage & Export */}
              <div style={{
                background: 'var(--app-surface-high, rgba(128,128,128,0.05))',
                borderRadius: 16,
                padding: '20px 22px',
                border: '1px solid rgba(128,128,128,0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                boxSizing: 'border-box',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
              }}>
                <p style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 15, color: 'var(--c-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <StorageIconSVG color="#14b8a6" />
                  {lang === 'es' ? 'Almacenamiento y Copia' : 'Storage & Export'}
                </p>
                <p style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--c-text-secondary)', margin: '4px 0 0', lineHeight: 1.5, opacity: 0.8 }}>
                  {lang === 'es' ? 'Gestiona el uso de almacenamiento local y descarga copias de tus datos.' : 'Manage storage usage and download copies of your data.'}
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 10 }}>
                  <SettingRowUI label={lang === 'es' ? 'Restaurar última sesión' : 'Restore Last Session'} desc={lang === 'es' ? 'Abrir automáticamente la última app y pestaña activa.' : 'Automatically restore last active app, tab, and view on start.'}>
                    <Toggle value={settings.restoreLastSession} onChange={(v) => updateSettings({ restoreLastSession: v })} accentFrom={accent.from} accentTo={accent.to} />
                  </SettingRowUI>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(128,128,128,0.07)' }}>
                    <div>
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--c-text-primary)', fontFamily: 'Manrope', margin: 0 }}>
                        {lang === 'es' ? 'Uso de almacenamiento' : 'Storage Usage'}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--c-text-secondary)', fontFamily: 'Inter', margin: '2px 0 0' }}>
                        {lang === 'es' ? 'Uso total (datos + caché de audio)' : 'Total local usage (data + audio cache)'}
                      </p>
                    </div>
                    <span style={{ fontSize: 13.5, fontWeight: 700, fontFamily: 'Inter', color: 'var(--c-text-primary)' }}>{localUsage}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button
                    onClick={doExportData}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      borderRadius: 12,
                      background: `${accent.from}15`,
                      border: `1px solid ${accent.from}30`,
                      color: accent.from,
                      fontFamily: 'Manrope',
                      fontWeight: 700,
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      cursor: 'pointer',
                    }}
                  >
                    <DownloadIconSVG />
                    {lang === 'es' ? 'Exportar datos' : 'Export Data'}
                  </button>
                  <button
                    onClick={doClearCache}
                    disabled={clearingCache}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      borderRadius: 12,
                      background: 'rgba(255,107,107,0.08)',
                      border: '1px solid rgba(255,107,107,0.20)',
                      color: '#ff6b6b',
                      fontFamily: 'Manrope',
                      fontWeight: 700,
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      cursor: clearingCache ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {clearingCache ? (
                      <span className="material-symbols-outlined sync-spin" style={{ fontSize: 16 }}>progress_activity</span>
                    ) : (
                      <TrashIconSVG />
                    )}
                    {lang === 'es' ? 'Borrar caché' : 'Clear Cache'}
                  </button>
                </div>
              </div>

              {/* Card 7: Activity History */}
              <div style={{
                background: 'var(--app-surface-high, rgba(128,128,128,0.05))',
                borderRadius: 16,
                padding: '20px 22px',
                border: '1px solid rgba(128,128,128,0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                boxSizing: 'border-box',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
              }}>
                <p style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 15, color: 'var(--c-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="material-symbols-outlined" style={{ color: '#ec4899', fontSize: 20 }}>history</span>
                  {lang === 'es' ? 'Historial de Actividad' : 'Activity History'}
                </p>
                <p style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--c-text-secondary)', margin: '4px 0 0', lineHeight: 1.5, opacity: 0.8 }}>
                  {lang === 'es' ? 'Controla el registro local de tu actividad en el ecosistema Studio.' : 'Manage the local log of your activity across the Studio ecosystem.'}
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 10 }}>
                  <SettingRowUI label={lang === 'es' ? 'Habilitar historial' : 'Enable Activity History'} desc={lang === 'es' ? 'Registrar inicios de app, proyectos, exportaciones, etc.' : 'Log app launches, projects, exports, etc.'}>
                    <Toggle value={settings.activityHistoryEnabled !== false} onChange={(v) => updateSettings({ activityHistoryEnabled: v })} accentFrom={accent.from} accentTo={accent.to} />
                  </SettingRowUI>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button
                    onClick={() => {
                      const confirmClear = window.confirm(lang === 'es' ? '¿Estás seguro de que deseas borrar todo el historial de actividad?' : 'Are you sure you want to clear your entire activity history?');
                      if (confirmClear) {
                        useChordStore.setState({ activityLog: [] });
                        showToast(lang === 'es' ? 'Historial borrado' : 'Activity history cleared');
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      borderRadius: 12,
                      background: 'rgba(255,107,107,0.08)',
                      border: '1px solid rgba(255,107,107,0.20)',
                      color: '#ff6b6b',
                      fontFamily: 'Manrope',
                      fontWeight: 700,
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      cursor: 'pointer',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete_sweep</span>
                    {lang === 'es' ? 'Borrar historial' : 'Clear History'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {sync.showMigrationPrompt && createPortal(
        <MigrationPromptSheet
          accent={accent}
          lang={lang}
          onClose={(choice) => resolveMigration(choice)}
        />,
        document.body
      )}
    </>
  );
}

interface MigrationPromptSheetProps {
  accent: { from: string; to: string; mid: string };
  lang: string;
  onClose: (choice: 'merge' | 'upload' | 'download' | 'notNow') => void;
}

export function MigrationPromptSheet({ accent, lang, onClose }: MigrationPromptSheetProps) {
  const isEs = lang === 'es';

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  };

  const backdropStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: 'rgba(9, 9, 11, 0.85)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  };

  const modalStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    maxWidth: 420,
    background: 'rgba(20, 20, 25, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    padding: '24px 24px',
    boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5), 0 2px 10px rgba(255, 255, 255, 0.02)',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    color: '#fff',
    animation: 'sheet-up 300ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
  };

  return (
    <div style={overlayStyle}>
      <div style={backdropStyle} />
      <div style={modalStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: `linear-gradient(135deg, ${accent.from}22, ${accent.to}22)`,
            border: `1px solid ${accent.from}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: accent.from,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 24 }}>cloud_sync</span>
          </div>
          <h3 style={{ fontFamily: 'Manrope', fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            {isEs ? '¿Sincronizar tus datos de Studio?' : 'Sync your existing Studio data?'}
          </h3>
          <p style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--c-text-secondary)', margin: 0, lineHeight: 1.5 }}>
            {isEs 
              ? 'Studio ha encontrado datos guardados localmente en este dispositivo. Puedes subirlos a tu cuenta y sincronizarlos entre todos tus dispositivos.'
              : 'Studio found data stored locally on this device. You can back it up to your account and sync it across devices.'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Merge option (Recommended) */}
          <button
            onClick={() => onClose('merge')}
            style={{
              padding: '12px 16px', borderRadius: 14,
              background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
              border: 'none', color: '#fff',
              fontFamily: 'Manrope', fontWeight: 700, fontSize: 13,
              cursor: 'pointer', textAlign: 'left',
              display: 'flex', flexDirection: 'column', gap: 2,
              boxShadow: `0 4px 12px ${accent.to}33`,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{isEs ? 'Combinar datos locales y de la nube' : 'Merge local and cloud data'}</span>
              <span style={{ fontSize: 9, background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: 99, fontWeight: 800 }}>
                {isEs ? 'RECOMENDADO' : 'RECOMMENDED'}
              </span>
            </span>
            <span style={{ fontSize: 11, opacity: 0.8, fontWeight: 400 }}>
              {isEs ? 'Combina ambos de forma segura sin perder nada.' : 'Safely combines both without losing anything.'}
            </span>
          </button>

          {/* Download option */}
          <button
            onClick={() => onClose('download')}
            style={{
              padding: '12px 16px', borderRadius: 14,
              background: 'rgba(128,128,128,0.06)',
              border: '1px solid rgba(128,128,128,0.1)', color: 'var(--c-text-primary)',
              fontFamily: 'Manrope', fontWeight: 700, fontSize: 13,
              cursor: 'pointer', textAlign: 'left',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}
          >
            <span>{isEs ? 'Descargar datos de la nube' : 'Download cloud data'}</span>
            <span style={{ fontSize: 11, color: 'var(--c-text-secondary)', fontWeight: 400 }}>
              {isEs ? 'Descarga el estado de la nube (sobrescribirá los datos locales).' : 'Downloads cloud state (overwrites local data).'}
            </span>
          </button>

          {/* Backup & Upload option */}
          <button
            onClick={() => onClose('upload')}
            style={{
              padding: '12px 16px', borderRadius: 14,
              background: 'rgba(128,128,128,0.06)',
              border: '1px solid rgba(128,128,128,0.1)', color: 'var(--c-text-primary)',
              fontFamily: 'Manrope', fontWeight: 700, fontSize: 13,
              cursor: 'pointer', textAlign: 'left',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}
          >
            <span>{isEs ? 'Subir y sincronizar este dispositivo' : 'Back up and sync this device'}</span>
            <span style={{ fontSize: 11, color: 'var(--c-text-secondary)', fontWeight: 400 }}>
              {isEs ? 'Sube datos locales a la nube (sobrescribirá los datos de la nube).' : 'Uploads local data to your cloud account (overwrites cloud).'}
            </span>
          </button>

          {/* Cancel/Not now option */}
          <button
            onClick={() => onClose('notNow')}
            style={{
              padding: '12px 16px', borderRadius: 14,
              background: 'transparent',
              border: '1px solid transparent', color: 'var(--c-text-secondary)',
              fontFamily: 'Manrope', fontWeight: 700, fontSize: 13,
              cursor: 'pointer', textAlign: 'center',
            }}
          >
            {isEs ? 'Ahora no' : 'Not now'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingRowUI({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(128,128,128,0.07)' }}>
      <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
        <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--c-text-primary)', fontFamily: 'Manrope', margin: 0 }}>{label}</p>
        {desc && <p style={{ fontSize: 11, marginTop: 2, lineHeight: 1.3, color: 'var(--c-text-secondary)', fontFamily: 'Inter', margin: '2px 0 0' }}>{desc}</p>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function SelectControl<T extends string>({
  value,
  options,
  onChange,
  accent,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  accent: { from: string; to: string };
}) {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          background: 'rgba(128,128,128,0.12)',
          border: '1px solid rgba(128,128,128,0.18)',
          borderRadius: '8px',
          padding: '6px 32px 6px 12px',
          fontSize: '13px',
          fontFamily: 'Manrope',
          fontWeight: 700,
          color: 'var(--c-text-primary)',
          outline: 'none',
          cursor: 'pointer',
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} style={{ background: 'var(--app-surface)', color: 'var(--c-text-primary)' }}>
            {opt.label}
          </option>
        ))}
      </select>
      <div
        style={{
          position: 'absolute',
          right: '10px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--c-text-secondary)',
          pointerEvents: 'none',
          opacity: 0.7,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ChevronDownIconSVG />
      </div>
    </div>
  );
}

function formatElapsedTime(timestamp: number, lang: string): string {
  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return lang === 'es' ? 'ahora mismo' : 'just now';

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return lang === 'es' ? 'hace un momento' : 'just now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return lang === 'es' ? `hace ${diffMin} min` : `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return lang === 'es' ? `hace ${diffHr} h` : `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return lang === 'es' ? 'ayer' : 'yesterday';
  return lang === 'es' ? `hace ${diffDay} d` : `${diffDay}d ago`;
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
