import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { execSync } from "child_process";
import fs from "fs";

const rawPort = process.env.PORT ?? "5173";
const port = Number(rawPort);
const basePath = process.env.BASE_PATH ?? "/";

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

  if (command === "build") {
    console.log(`\x1b[32mVite Build (Web): Bundling Git Commit SHA: ${gitCommitSha}\x1b[0m`);

    if (isDirty) {
      console.warn("\x1b[33mVite Build (Web): ⚠ WARNING: Git working tree is dirty.\x1b[0m");
    }

    const url = (process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? "").trim();
    const key = (process.env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? "").trim();
    const provider = (process.env.VITE_SYNC_BACKEND_PROVIDER ?? env.VITE_SYNC_BACKEND_PROVIDER ?? "").trim();

    if (!url || !key || provider !== "supabase-realtime") {
      console.error("\x1b[31mVite Build (Web): ✗ Supabase config missing.\x1b[0m");
      throw new Error("Supabase config missing.");
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
        "@/lib": path.resolve(import.meta.dirname, "../../packages/studio-core/src/lib"),
        "@/store": path.resolve(import.meta.dirname, "../../packages/studio-core/src/store"),
        "@/hooks": path.resolve(import.meta.dirname, "../../packages/studio-core/src/hooks"),
        "@/data": path.resolve(import.meta.dirname, "../../packages/studio-core/src/data"),
        "@/i18n": path.resolve(import.meta.dirname, "../../packages/studio-core/src/i18n"),
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "../../dist/web"),
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
              if (id.includes("/@fontsource/")) return "fonts";
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
