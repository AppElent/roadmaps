// Generates dist/client/sw.js after `vite build`.
//
// vite-plugin-pwa's in-process generateSW hook never fires under TanStack
// Start's multi-environment Vite build (client + Cloudflare Workers SSR) —
// see https://github.com/TanStack/router/issues/4988 (open, upstream-fix
// needed). Calling workbox-build directly as a plain post-build script
// sidesteps the issue entirely: no Vite plugin lifecycle involved.
//
// Precaches the static app shell only — never Convex/API traffic, since
// this app depends on Convex's real-time websocket sync for live data.
import { generateSW } from "workbox-build";

const { count, size, warnings } = await generateSW({
	globDirectory: "dist/client",
	globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
	swDest: "dist/client/sw.js",
	navigateFallbackDenylist: [/^\/api\//, /^\/convex\//],
	skipWaiting: true,
	clientsClaim: true,
});

for (const warning of warnings) {
	console.warn(warning);
}
console.log(`generate-sw: precached ${count} files, ${(size / 1024).toFixed(1)} KB`);
