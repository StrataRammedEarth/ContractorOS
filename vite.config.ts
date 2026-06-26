// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// SPA mode: TanStack Start prerenders a static shell (dist/client/index.html) that
// hydrates client-side. This app has no server loaders/functions — all data comes
// from Supabase edge functions called in the browser — so a static SPA deploy on
// Netlify is simpler and more reliable than an SSR serverless runtime.
export default defineConfig({
  tanstackStart: {
    spa: { enabled: true },
  },
});
