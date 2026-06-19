import { signOut, enableAccount, useT, useChordStore } from '@workspace/studio-core';
import { useState } from 'react';

type Props = {
  user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null };
};

export default function DisabledAccountScreen({ user }: Props) {
  const tRoot = useT();
  const t = tRoot.hub.accountSection;
  const lang = useChordStore((s) => s.settings.language) ?? 'en';
  const [busy, setBusy] = useState<'enable' | 'signout' | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const L = lang === 'es' ? {
    title: 'Cuenta deshabilitada',
    body: 'Tu cuenta ha sido deshabilitada. Puedes reactivarla o eliminar tu cuenta.',
    enable: 'Reactivar cuenta',
    signOut: t.signOut,
  } : {
    title: 'Account disabled',
    body: 'Your account has been disabled. You can re-enable it or sign out.',
    enable: 'Re-enable account',
    signOut: t.signOut,
  };

  async function doEnable() {
    if (busy) return;
    setBusy('enable'); setErr(null);
    try {
      await enableAccount(user.uid);
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? 'Something went wrong.';
      setErr(msg);
      setBusy(null);
    }
  }

  async function doSignOut() {
    if (busy) return;
    setBusy('signout');
    try { await signOut(); }
    catch { setBusy(null); }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'var(--app-bg, #0e0e0e)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
      animation: 'sync-fade-in 280ms ease both',
    }}>
      <style>{`@keyframes sync-fade-in { from { opacity:0; transform:translateY(-4px);} to { opacity:1; transform:translateY(0); } }`}</style>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>

        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(245,158,11,0.12)',
          border: '1px solid rgba(245,158,11,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 4,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 38, color: '#f59e0b' }}>block</span>
        </div>

        {/* Title */}
        <p style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 22, color: 'var(--c-text-primary)', margin: 0, textAlign: 'center', lineHeight: 1.2 }}>
          {L.title}
        </p>

        {/* Email badge */}
        {user.email && (
          <div style={{
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 10, padding: '8px 14px',
          }}>
            <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#f59e0b', margin: 0 }}>{user.email}</p>
          </div>
        )}

        {/* Body */}
        <p style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--c-text-secondary)', margin: 0, textAlign: 'center', lineHeight: 1.5 }}>
          {L.body}
        </p>

        {err && <p style={{ fontSize: 12, color: '#ff6b6b', margin: 0, textAlign: 'center' }}>{err}</p>}

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 4 }}>
          <button
            onClick={doEnable}
            disabled={!!busy}
            style={{
              width: '100%', padding: '14px 18px', borderRadius: 12,
              background: busy === 'enable' ? 'rgba(245,158,11,0.4)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#fff', border: 'none',
              fontFamily: 'Manrope', fontWeight: 800, fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy === 'signout' ? 0.6 : 1,
              boxShadow: '0 8px 24px rgba(245,158,11,0.28)',
            }}
          >
            {busy === 'enable'
              ? <span className="material-symbols-outlined" style={{ fontSize: 18, animation: 'spin 1.1s linear infinite', display: 'inline-block' }}>progress_activity</span>
              : <span className="material-symbols-outlined" style={{ fontSize: 18 }}>restart_alt</span>
            }
            {L.enable}
          </button>

          <button
            onClick={doSignOut}
            disabled={!!busy}
            style={{
              width: '100%', padding: '12px 18px', borderRadius: 12,
              background: 'transparent',
              color: 'var(--c-text-secondary)',
              border: '1px solid var(--c-divider, rgba(128,128,128,0.25))',
              fontFamily: 'Manrope', fontWeight: 700, fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy === 'signout' ? 0.6 : 1,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
            {L.signOut}
          </button>
        </div>
      </div>
    </div>
  );
}
