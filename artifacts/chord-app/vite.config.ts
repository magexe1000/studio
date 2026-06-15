import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { execSync } from "child_process";
import fs from "fs";
const rawPort = process.env.PORT ?? "5173";
const port = Number(rawPort);
const basePath = process.env.BASE_PATH ?? "/";

// Expose Firebase web config from process.env (environment secrets) into
// import.meta.env at build time. The web config is non-sensitive (it goes to
// the client anyway) but we keep it in env vars for portability.
const injectEnvKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_SYNC_BACKEND_PROVIDER",
] as const;

export default defineConfig(async ({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const envDefines: Record<string, string> = {};
  for (const k of injectEnvKeys) {
    const val = (process.env[k] ?? env[k] ?? "").trim();
    envDefines[`import.meta.env.${k}`] = JSON.stringify(val);
  }

  // Get current git commit SHA and build timestamp dynamically
  let gitCommitSha = 'unknown';
  let isDirty = false;
  try {
    gitCommitSha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
    if (status) {
      isDirty = true;
    }
  } catch (e: any) {
    console.warn('Vite Config: ⚠ Could not get git commit SHA:', e.message);
  }
  const buildTimestamp = new Date().toLocaleString('en-US', { timeZoneName: 'short' });

  envDefines['import.meta.env.VITE_GIT_COMMIT_SHA'] = JSON.stringify(gitCommitSha);
  envDefines['import.meta.env.VITE_BUILD_TIMESTAMP'] = JSON.stringify(buildTimestamp);

  // Hard gate validation during vite build
  if (command === "build") {
    console.log(`\x1b[32mVite Build: Bundling Git Commit SHA: ${gitCommitSha}\x1b[0m`);

    // Check if Git working tree is clean
    if (isDirty) {
      console.warn("\x1b[33mVite Build: ⚠ WARNING: Git working tree is dirty. Staged or unstaged changes exist. The build provenance might be inconsistent.\x1b[0m");
    }

    // Compare fallback commit SHA in appVersion.ts
    try {
      const appVersionPath = path.resolve(import.meta.dirname, "src/lib/appVersion.ts");
      if (fs.existsSync(appVersionPath)) {
        const content = fs.readFileSync(appVersionPath, "utf8");
        const match = content.match(/export\s+const\s+APP_COMMIT_SHA\s*=\s*.*?['"]([^'"]+)['"]/);
        if (match) {
          const fallbackSha = match[1];
          if (gitCommitSha !== 'unknown' && fallbackSha !== gitCommitSha) {
            console.warn(`\x1b[33mVite Build: ⚠ WARNING: Fallback commit SHA in appVersion.ts ('${fallbackSha}') does not match actual Git HEAD SHA ('${gitCommitSha}').\x1b[0m`);
            console.warn(`\x1b[33mPlease update appVersion.ts with the correct commit SHA before final release to avoid stale defaults.\x1b[0m`);
          }
        }
      }
    } catch (err) {
      // ignore
    }

    const url = (process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? "").trim();
    const key = (process.env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? "").trim();
    const provider = (process.env.VITE_SYNC_BACKEND_PROVIDER ?? env.VITE_SYNC_BACKEND_PROVIDER ?? "").trim();

    if (!url || !key || provider !== "supabase-realtime") {
      console.error("\x1b[31mVite Build: ✗ Supabase config missing. Refusing to build a Supabase sync release.\x1b[0m");
      console.error(`VITE_SUPABASE_URL: ${url ? "Configured" : "Missing"}`);
      console.error(`VITE_SUPABASE_ANON_KEY: ${key ? "Configured" : "Missing"}`);
      console.error(`VITE_SYNC_BACKEND_PROVIDER: ${provider}`);
      throw new Error("Supabase config missing. Refusing to build a Supabase sync release.");
    }
  }

  return {
    base: basePath,
    define: envDefines,
    plugins: [
      react(),
      tailwindcss(),
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
};
});
