import React, { useState } from "react";
import AppSpinner from "./AppSpinner";
import AnimatedActionButton from "./animata/container/animated-border-trail";

interface StudioAuthCardProps {
  accent: { from: string; to: string; mid: string };
  t: any; // Translation object
  busy: boolean;
  err: string | null;
  setErr: (err: string | null) => void;
  doGoogle: () => Promise<void>;
  doEmailSubmit: (mode: "email-signin" | "email-register", email: string, pass: string, name?: string) => Promise<void>;
  initialMode?: "idle" | "email-signin" | "email-register";
}

export default function StudioAuthCard({
  accent,
  t,
  busy,
  err,
  setErr,
  doGoogle,
  doEmailSubmit,
  initialMode = "idle",
}: StudioAuthCardProps) {
  const [mode, setMode] = useState<"idle" | "email-signin" | "email-register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const handleModeChange = (newMode: "idle" | "email-signin" | "email-register") => {
    setErr(null);
    setMode(newMode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "idle") return;
    await doEmailSubmit(mode, email, password, mode === "email-register" ? name : undefined);
  };

  return (
    <div
      className="w-full max-w-md mx-auto overflow-hidden transition-all duration-300"
      style={{
        borderRadius: 24,
        background: "var(--app-surface, rgba(20, 20, 24, 0.75))",
        border: "1px solid rgba(128, 128, 128, 0.12)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: "0 12px 40px rgba(0, 0, 0, 0.25)",
      }}
    >
      {/* Header section with brand decoration */}
      <div className="relative p-6 pb-4 flex flex-col gap-1.5 overflow-hidden">
        {/* Subtle decorative mesh background glow behind title */}
        <div
          className="absolute -top-12 -left-12 w-28 h-28 rounded-full filter blur-2xl opacity-20 pointer-events-none"
          style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
        />
        
        <p
          className="font-extrabold text-xl tracking-tight m-0"
          style={{ color: "var(--c-text-primary)" }}
        >
          {mode === "idle"
            ? t.title
            : mode === "email-signin"
            ? t.signIn
            : t.register}
        </p>
        <p
          className="text-xs m-0 leading-relaxed opacity-75 font-medium"
          style={{ color: "var(--c-text-secondary)" }}
        >
          {mode === "idle"
            ? t.subtitle
            : mode === "email-signin"
            ? t.emailPlaceholder
            : t.namePlaceholder}
        </p>
      </div>

      {/* Main Form/Content Section */}
      <div className="p-6 pt-2 flex flex-col gap-5">
        {/* 1. IDLE MODE: Primary Auth Selection */}
        {mode === "idle" && (
          <div className="flex flex-col gap-3.5">
            {/* Continue with Google (Aceternity premium button) */}
            <button
              onClick={doGoogle}
              disabled={busy}
              type="button"
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer outline-none border active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "rgba(128,128,128,0.06)",
                border: "1px solid rgba(128,128,128,0.15)",
                color: "var(--c-text-primary)",
              }}
            >
              {/* SVG Google Icon */}
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {t.continueGoogle}
            </button>

            {/* Divider with "or" */}
            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-[1px] bg-neutral-200 dark:bg-neutral-800 opacity-30" />
              <span className="text-[10px] uppercase font-bold tracking-widest opacity-40" style={{ color: "var(--c-text-secondary)" }}>
                {t.switchToSignIn ? "or" : "o"}
              </span>
              <div className="flex-1 h-[1px] bg-neutral-200 dark:bg-neutral-800 opacity-30" />
            </div>

            {/* Continue with Email */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleModeChange("email-signin");
              }}
              disabled={busy}
              type="button"
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer outline-none border active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                border: "none",
                color: "#fff",
                boxShadow: `0 4px 18px color-mix(in srgb, ${accent.to} 25%, transparent)`,
              }}
            >
              <svg className="w-[18px] h-[18px] opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              {t.continueEmail}
            </button>

            {/* Create One Toggle Link */}
            <button
              onClick={() => handleModeChange("email-register")}
              disabled={busy}
              type="button"
              className="text-xs font-semibold py-2 bg-transparent border-none transition-all duration-200 cursor-pointer outline-none hover:underline"
              style={{ color: "var(--c-text-secondary)", textAlign: "center" }}
            >
              {t.createAccount}
            </button>

            <p
              style={{
                fontSize: 10.5,
                color: "var(--c-text-secondary)",
                opacity: 0.65,
                lineHeight: 1.4,
                textAlign: "center",
                margin: "12px 0 0",
                fontFamily: "Inter, sans-serif",
              }}
            >
              Studio only syncs the data needed to connect and restore your workspace. You can manage{" "}
              <span
                onClick={() => window.dispatchEvent(new CustomEvent("studio:route-to-privacy"))}
                style={{
                  textDecoration: "underline",
                  cursor: "pointer",
                  color: "var(--c-text-primary)",
                  fontWeight: 500,
                }}
              >
                privacy and sync options
              </span>{" "}
              anytime.
            </p>
          </div>
        )}

        {/* 2. EMAIL SIGN-IN / SIGN-UP FORM */}
        {(mode === "email-signin" || mode === "email-register") && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              {/* Name Field (Sign-up only) */}
              {mode === "email-register" && (
                <div className="relative w-full">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.namePlaceholder}
                    autoComplete="name"
                    required
                    disabled={busy}
                    type="text"
                    className="w-full py-3 px-4 rounded-xl border font-semibold text-sm transition-all duration-200 outline-none"
                    style={{
                      background: "rgba(128,128,128,0.06)",
                      border: "1px solid rgba(128,128,128,0.18)",
                      color: "var(--c-text-primary)",
                    }}
                  />
                </div>
              )}

              {/* Email Input */}
              <div className="relative w-full">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  autoComplete="email"
                  required
                  disabled={busy}
                  type="email"
                  className="w-full py-3 px-4 rounded-xl border font-semibold text-sm transition-all duration-200 outline-none"
                  style={{
                    background: "rgba(128,128,128,0.06)",
                    border: "1px solid rgba(128,128,128,0.18)",
                    color: "var(--c-text-primary)",
                  }}
                />
              </div>

              {/* Password Input */}
              <div className="relative w-full">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.passwordPlaceholder}
                  autoComplete={mode === "email-signin" ? "current-password" : "new-password"}
                  required
                  disabled={busy}
                  type="password"
                  className="w-full py-3 px-4 rounded-xl border font-semibold text-sm transition-all duration-200 outline-none"
                  style={{
                    background: "rgba(128,128,128,0.06)",
                    border: "1px solid rgba(128,128,128,0.18)",
                    color: "var(--c-text-primary)",
                  }}
                />
              </div>
            </div>

            {/* Buttons Row */}
            <div className="flex gap-3 mt-1.5">
              <button
                onClick={() => handleModeChange("idle")}
                disabled={busy}
                type="button"
                className="flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer outline-none border active:scale-[0.98]"
                style={{
                  background: "rgba(128,128,128,0.08)",
                  border: "1px solid rgba(128,128,128,0.18)",
                  color: "var(--c-text-primary)",
                }}
              >
                {t.cancel}
              </button>

              <AnimatedActionButton
                type="submit"
                disabled={busy}
                wrapStyle={{ flex: 1.3 }}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 700,
                  background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                  border: "none",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  cursor: "pointer",
                }}
              >
                {busy && <AppSpinner size={14} color="white" strokeWidth={2} />}
                {mode === "email-signin" ? t.signIn : t.register}
              </AnimatedActionButton>
            </div>

            {/* Switch Mode link at footer */}
            <button
              onClick={() => handleModeChange(mode === "email-signin" ? "email-register" : "email-signin")}
              disabled={busy}
              type="button"
              className="text-xs font-semibold py-2 bg-transparent border-none transition-all duration-200 cursor-pointer outline-none hover:underline"
              style={{ color: "var(--c-text-secondary)", textAlign: "center" }}
            >
              {mode === "email-signin" ? t.switchToRegister : t.switchToSignIn}
            </button>
          </form>
        )}

        {/* 3. ERROR OVERLAY / ALERTS */}
        {err && (
          <div
            className="p-3.5 rounded-xl border flex gap-2.5 items-start mt-1 animate-fade-in"
            style={{
              background: "rgba(255, 107, 107, 0.08)",
              border: "1px solid rgba(255, 107, 107, 0.25)",
            }}
          >
            <span className="material-symbols-outlined text-[18px] mt-0.5" style={{ color: "#ff6b6b" }}>
              error
            </span>
            <p className="text-xs m-0 font-semibold leading-normal" style={{ color: "#ff6b6b" }}>
              {err}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
