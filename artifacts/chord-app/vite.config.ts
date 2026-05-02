import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
const rawPort = process.env.PORT ?? "5173";
const port = Number(rawPort);
const basePath = process.env.BASE_PATH ?? "/";

// Expose Firebase web config from process.env (Replit secrets) into
// import.meta.env at build time. The web config is non-sensitive (it goes to
// the client anyway) but we keep it in env vars for portability.
const firebaseEnvKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
] as const;
const firebaseDefines: Record<string, string> = {};
for (const k of firebaseEnvKeys) {
  firebaseDefines[`import.meta.env.${k}`] = JSON.stringify(process.env[k] ?? "");
}

export default defineConfig({
  base: basePath,
  define: firebaseDefines,
  plugins: [
    react(),
    tailwindcss(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    target: "es2020",
    minify: "esbuild",
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (
              id.includes("/react-dom/") ||
              id.includes("/react/") ||
              id.includes("/scheduler/")
            )
              return "react-vendor";
            if (id.includes("/zustand/")) return "zustand";
            if (id.includes("/jspdf/")) return "jspdf";
            if (id.includes("/@capacitor/")) return "capacitor";
            if (id.includes("/@fontsource/")) return "fonts";
            // Isolate the entire Firebase SDK into its own chunk so it
            // never gets pulled into the main bundle. App.tsx loads
            // lib/sync and lib/accountStatus via dynamic import after
            // first paint, so this chunk should only download for
            // users who actually use cloud sync.
            if (
              id.includes("/firebase/") ||
              id.includes("/@firebase/")
            )
              return "firebase";
          }
        },
      },
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    hmr: {
      timeout: 120000,
      overlay: false,
    },
    strictPort: true,
    watch: {
      usePolling: false,
      ignored: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      "/r2-stems": {
        target: "https://pub-b6a593f7d45247389f1accd1a54fec5c.r2.dev",
        changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/r2-stems/, ""),
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
