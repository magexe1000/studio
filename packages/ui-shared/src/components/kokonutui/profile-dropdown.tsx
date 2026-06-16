import { cn } from '@workspace/studio-core';
import React, { useState, useRef, useEffect, CSSProperties } from "react";

interface AuthUser {
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
}

interface AccentColors {
  from: string;
  to: string;
}

interface ProfileDropdownProps {
  authUser?: AuthUser | null;
  hubUserName?: string;
  accent: AccentColors;
  onProfile: () => void;
  onSettings: () => void;
  onSignOut: () => Promise<void>;
  style?: CSSProperties;
  className?: string;
}

export default function ProfileDropdown({
  authUser,
  hubUserName,
  accent,
  onProfile,
  onSettings,
  onSignOut,
  style,
  className,
}: ProfileDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const name = authUser?.displayName || hubUserName || "Studio";
  const email = authUser?.email || "studio@app";
  const photo = authUser?.photoURL;
  const initial = name[0]?.toUpperCase() ?? "S";

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const menuItems = [
    {
      label: "Profile",
      value: null as string | null,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
      action: () => { onProfile(); setOpen(false); },
      disabled: false,
    },
    {
      label: "Subscription",
      value: "Soon",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <path d="M2 10h20" />
        </svg>
      ),
      action: null as (() => void) | null,
      disabled: true,
    },
    {
      label: "Settings",
      value: null as string | null,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
      action: () => { onSettings(); setOpen(false); },
      disabled: false,
    },
  ];

  return (
    <div ref={ref} style={style} className={cn("relative dark", className)}>
      {/* ── Trigger ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        type="button"
        className={cn(
          "flex items-center gap-4 rounded-2xl border border-zinc-800/60 bg-zinc-900 p-3 transition-all duration-200",
          "hover:border-zinc-700 hover:bg-zinc-800/40 hover:shadow-sm focus:outline-none",
          open && "border-zinc-700 bg-zinc-800/40 shadow-sm"
        )}
      >
        <div className="flex-1 text-left">
          <div className="font-medium text-sm text-zinc-100 leading-tight tracking-tight">
            {name}
          </div>
          <div className="text-xs text-zinc-400 leading-tight tracking-tight">
            {email}
          </div>
        </div>
        <div
          className="h-10 w-10 rounded-full p-0.5 flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
        >
          <div className="h-full w-full overflow-hidden rounded-full bg-zinc-900 flex items-center justify-center">
            {photo ? (
              <img alt={name} className="h-full w-full rounded-full object-cover" src={photo} />
            ) : (
              <span className="text-sm font-bold" style={{ color: accent.from, fontFamily: "Manrope" }}>
                {initial}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Bending line indicator — to the right of the trigger */}
      <div
        className={cn(
          "pointer-events-none absolute top-1/2 -right-3 -translate-y-1/2 transition-all duration-200",
          open ? "opacity-100" : "opacity-60"
        )}
      >
        <svg
          aria-hidden="true"
          className="transition-all duration-200"
          style={open ? { color: accent.from } : { color: "rgb(113 113 122)" }}
          fill="none"
          height="24"
          viewBox="0 0 12 24"
          width="12"
        >
          <path
            d="M2 4C6 8 6 16 2 20"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      {/* ── Panel ── */}
      {open && (
        <div
          className="absolute left-0 top-[calc(100%+6px)] w-64 origin-top-left rounded-2xl border border-zinc-800/60 bg-zinc-900/95 p-2 shadow-xl backdrop-blur-sm"
          style={{ animation: "profile-burst-out 240ms cubic-bezier(0.34,1.45,0.64,1) both" }}
        >
          <div className="space-y-0.5">
            {menuItems.map((item, idx) => (
              <button
                key={item.label}
                onClick={item.action ?? undefined}
                disabled={item.disabled}
                type="button"
                className={cn(
                  "group flex w-full cursor-pointer items-center rounded-xl border border-transparent p-3 transition-all duration-150",
                  "hover:border-zinc-700/50 hover:bg-zinc-800/60 hover:shadow-sm",
                  item.disabled && "cursor-default opacity-50 hover:border-transparent hover:bg-transparent hover:shadow-none"
                )}
                style={{ animation: `profile-dd-item-in 180ms ${idx * 40}ms cubic-bezier(0.22,1,0.36,1) both` }}
              >
                <div className="flex flex-1 items-center gap-2.5">
                  <span className="text-zinc-400 group-hover:text-zinc-300 transition-colors">
                    {item.icon}
                  </span>
                  <span className="font-medium text-sm text-zinc-100 leading-tight tracking-tight">
                    {item.label}
                  </span>
                </div>
                {item.value && (
                  <span
                    className="ml-auto rounded-md px-2 py-0.5 font-medium text-xs tracking-tight border flex-shrink-0"
                    style={{
                      color: accent.from,
                      background: `color-mix(in srgb, ${accent.from} 12%, transparent)`,
                      borderColor: `color-mix(in srgb, ${accent.from} 22%, transparent)`,
                    }}
                  >
                    {item.value}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="my-2 mx-1 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />

          {authUser && (
            <button
              onClick={async () => { await onSignOut(); setOpen(false); }}
              type="button"
              className="group flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-transparent bg-red-500/10 p-3 transition-all duration-150 hover:border-red-500/30 hover:bg-red-500/20"
              style={{ animation: "profile-dd-item-in 180ms 120ms cubic-bezier(0.22,1,0.36,1) both" }}
            >
              <svg
                className="text-red-400 group-hover:text-red-500 transition-colors"
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="font-medium text-red-400 text-sm group-hover:text-red-500 transition-colors">
                Sign out
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
