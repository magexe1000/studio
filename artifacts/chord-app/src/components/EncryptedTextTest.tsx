import { useState } from "react";
import { EncryptedText } from "./ui/encrypted-text";

export default function EncryptedTextTest() {
  const [inputText, setInputText] = useState("Hello world! Decryption sequence online.");
  const [key, setKey] = useState(0); // For restarting animation
  const [revealDelay, setRevealDelay] = useState(50);
  const [flipDelay, setFlipDelay] = useState(50);
  const [onlyOnce, setOnlyOnce] = useState(false);

  return (
    <div
      style={{
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 20,
        maxWidth: 400,
        margin: "0 auto",
        background: "var(--app-surface)",
        borderRadius: 16,
        border: "1px solid rgba(128,128,128,0.1)",
        color: "var(--c-text-primary)",
        fontFamily: "Manrope, sans-serif",
      }}
    >
      <div>
        <p style={{ fontWeight: 800, fontSize: 18, margin: "0 0 4px" }}>
          EncryptedText — Isolated Test
        </p>
        <p style={{ fontSize: 12, margin: 0, color: "var(--c-text-secondary)" }}>
          Official Aceternity UI Component Manual Harness
        </p>
      </div>

      {/* Under Test component wrapper */}
      <div
        style={{
          background: "var(--app-bg)",
          padding: 20,
          borderRadius: 12,
          minHeight: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          border: "1px solid rgba(128,128,128,0.08)",
        }}
      >
        <p style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>
          <EncryptedText
            key={key}
            text={inputText}
            revealDelayMs={revealDelay}
            flipDelayMs={flipDelay}
            onlyOnce={onlyOnce}
            revealedClassName="text-white dark:text-white"
            encryptedClassName="text-emerald-500 font-mono font-bold dark:text-emerald-400"
          />
        </p>
      </div>

      {/* Control panel */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--c-text-secondary)", marginBottom: 4 }}>
            Test Text
          </label>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 8,
              background: "var(--app-bg)",
              border: "1px solid rgba(128,128,128,0.2)",
              color: "var(--c-text-primary)",
              fontFamily: "inherit",
              fontSize: 13,
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--c-text-secondary)", marginBottom: 4 }}>
              Reveal (ms)
            </label>
            <input
              type="number"
              value={revealDelay}
              onChange={(e) => setRevealDelay(Number(e.target.value))}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                background: "var(--app-bg)",
                border: "1px solid rgba(128,128,128,0.2)",
                color: "var(--c-text-primary)",
                fontFamily: "inherit",
                fontSize: 13,
              }}
            />
          </div>

          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--c-text-secondary)", marginBottom: 4 }}>
              Flip (ms)
            </label>
            <input
              type="number"
              value={flipDelay}
              onChange={(e) => setFlipDelay(Number(e.target.value))}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                background: "var(--app-bg)",
                border: "1px solid rgba(128,128,128,0.2)",
                color: "var(--c-text-primary)",
                fontFamily: "inherit",
                fontSize: 13,
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <input
            type="checkbox"
            id="onlyOnceCheck"
            checked={onlyOnce}
            onChange={(e) => setOnlyOnce(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          <label htmlFor="onlyOnceCheck" style={{ fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            onlyOnce (simulate launch constraints)
          </label>
        </div>

        <button
          type="button"
          onClick={() => setKey((k) => k + 1)}
          style={{
            marginTop: 8,
            padding: "10px 16px",
            borderRadius: 8,
            background: "var(--accent-from, #10b981)",
            color: "white",
            border: "none",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            width: "100%",
            textAlign: "center",
          }}
        >
          Trigger / Restart Decryption
        </button>
      </div>
    </div>
  );
}
