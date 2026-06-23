// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";
import path from "node:path";

// Load all env vars into process.env for server-side code (e.g. SUPABASE_SERVICE_ROLE_KEY).
// Do NOT add these to envDefine — that would leak server secrets into the client bundle.
const serverEnv = loadEnv(process.env.NODE_ENV || "development", process.cwd(), "");
Object.assign(process.env, serverEnv);

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(__dirname, "node_modules/entities/lib/decode.js"),
        "entities/lib/encode.js": path.resolve(__dirname, "node_modules/entities/lib/encode.js"),
        "entities": path.resolve(__dirname, "node_modules/entities"),
      },
    },
    server: {
      // When the dev server is served through the Lovable preview iframe
      // (https://*.lovableproject.com), Vite's HMR client defaults to
      // ws://localhost:8080 and fails to connect. Route HMR over the same
      // origin the browser used, on the standard HTTPS port, so it works
      // both locally and inside the sandboxed iframe.
      hmr: {
        clientPort: 443,
        protocol: "wss",
      },
    },
  },
});
