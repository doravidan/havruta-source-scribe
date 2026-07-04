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

const LOVABLE_CLOUD_SUPABASE_URL = "https://mfqpoclgxuxbnnexzxoq.supabase.co";
const LOVABLE_CLOUD_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcXBvY2xneHV4Ym5uZXh6eG9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMjA2MzQsImV4cCI6MjA5NzY5NjYzNH0.Bx4MocloiuYkdKRn6XPz5AO50dUkFesULRRQpWMBC1c";

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? LOVABLE_CLOUD_SUPABASE_URL;
const supabasePublishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ??
  LOVABLE_CLOUD_SUPABASE_PUBLISHABLE_KEY;

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
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(supabasePublishableKey),
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
