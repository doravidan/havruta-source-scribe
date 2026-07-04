// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config/dist/index.js";
import { loadEnv } from "vite";
import path from "node:path";

// Load all env vars into process.env for server-side code (e.g. SUPABASE_SERVICE_ROLE_KEY).
// Do NOT add these to envDefine — that would leak server secrets into the client bundle.
const serverEnv = loadEnv(process.env.NODE_ENV || "development", process.cwd(), "");
Object.assign(process.env, serverEnv);

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY;

if (!process.env.SUPABASE_URL && supabaseUrl) {
  process.env.SUPABASE_URL = supabaseUrl;
}

if (!process.env.SUPABASE_PUBLISHABLE_KEY && supabasePublishableKey) {
  process.env.SUPABASE_PUBLISHABLE_KEY = supabasePublishableKey;
}

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    define: {
      ...(supabaseUrl ? { "process.env.SUPABASE_URL": JSON.stringify(supabaseUrl) } : {}),
      ...(supabasePublishableKey
        ? { "process.env.SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey) }
        : {}),
    },
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(__dirname, "node_modules/entities/lib/decode.js"),
        "entities/lib/encode.js": path.resolve(__dirname, "node_modules/entities/lib/encode.js"),
        "entities": path.resolve(__dirname, "node_modules/entities"),
      },
    },
    server: {
      // Local dev uses default HMR; Lovable iframe preview overrides via env if needed.
      ...(process.env.LOVABLE_PREVIEW_HOST
        ? {
            hmr: {
              clientPort: 443,
              protocol: "wss",
            },
          }
        : {}),
    },
  },
});
