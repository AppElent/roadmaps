# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

ArchStudio is a real-time **architect's workbench**: a multi-tool app where `/dashboard` is a Home launcher and each tool is its own section. Two tools ship today — **Roadmaps** (timelines of initiatives across lanes and timeframes, with per-roadmap custom fields, a sortable table, milestones, public read-only share links, and JSON import/export) and **Diagrams** (a live Mermaid + PlantUML editor with versioning and public share links) — with a Claude-powered AI helper planned. Built phase-by-phase from specs in `docs/superpowers/specs/` and plans in `docs/superpowers/plans/`.

## Commands

```bash
pnpm exec convex dev        # Start the Convex backend (watch mode). REQUIRED for any data to load.
pnpm dev                    # Vite dev server on :3000. Run alongside `pnpm exec convex dev`.
pnpm exec convex dev --once # Deploy backend once + typecheck convex/ + regenerate convex/_generated. Run after editing anything in convex/.
pnpm run dev:watch          # Both of the above concurrently (uses `concurrently`) — re-pushes Convex functions on every edit.

pnpm test             # Vitest (all). Single file: pnpm exec vitest run src/lib/__tests__/timeline.test.ts
pnpm run check        # Biome lint + format check — MUST pass before committing. Autofix: pnpm exec biome check --write src/
pnpm exec tsc --noEmit # Full type check (Biome does NOT type-check)
pnpm build            # Production/SSR build (also the best smoke test that the app compiles)
pnpm run seed         # Seed demo data (pnpm exec convex run seed:seedDemo)
pnpm run deploy       # Build + wrangler deploy to Cloudflare
```

Package manager is **pnpm** (always — never npm/yarn; see `pnpm-workspace.yaml` for supply-chain hardening settings). `dev:all` pushes Convex functions **once** then starts Vite; use `dev:watch` when actively editing `convex/` so backend changes re-sync.

## Architecture

Two layers in one repo:
- **`src/`** — React 19 + TanStack React Start (SSR), file-based routing, deployed as a Cloudflare Worker.
- **`convex/`** — serverless backend: schema, queries, mutations. Real-time by default.

**The app shell.** `/` is a public, standalone landing route (outside `AppShell`). `/dashboard` is the authed Home launcher — a grid of `ToolCard`s. Each tool lives in its own section: Roadmaps at `/roadmaps/` (list) and `/roadmaps/$id` (editor); Diagrams at `/diagrams/` (list) and `/diagrams/$id` (editor). `Sidebar.tsx` / `BottomTabBar.tsx` nav = Home / Roadmaps / Diagrams. `AppShell` gates the authed sections (`<SignedIn>` / `<RedirectToSignIn>`).

**Data flow:** `Clerk (auth) → JWT → Convex → useQuery subscriptions → React`. The Clerk provider wraps the Convex provider (`src/integrations/convex/provider.tsx` uses `ConvexProviderWithClerk`). `convex/auth.config.ts` reads `CLERK_JWT_ISSUER_DOMAIN` from the Convex backend's own env (set via `pnpm exec convex env set`, not committed) and requires a Clerk JWT template named `convex`.

**The single-subscription bundle.** The editor loads one query — `roadmaps.getBundle({ roadmapId })` — returning `{ roadmap, fields, lanes, items, milestones }` together (loader in `convex/lib/bundle.ts`). The whole editor subscribes to this one query, so any mutation pushes an atomic real-time snapshot. The public share path mirrors it: `sharing.getPublicRoadmap({ shareToken })` returns the same shape with **no auth** (the only unauthenticated function) and only for `visibility === "link"`.

**Auth/ownership is enforced server-side, always.** Every Convex function calls `requireUser(ctx)` (returns the Clerk subject = stored `userId`); every write re-verifies ownership via `requireRoadmapOwner(ctx, roadmapId)` (both in `convex/lib/auth.ts`). Child mutations (lanes/items/fields/milestones) look up the row, then check the parent roadmap's owner.

**Custom fields = embedded values map (Approach A).** Items are NOT one-column-per-field. Structural columns (`title`, `laneId`, `startDate`, `endDate`) are real schema fields; everything else lives in `items.values` — a `Record<string, string | number | string[] | null>` keyed by a field's `key`. Field definitions live in the `fields` table (`type`: text/number/date/select/multiselect; select types carry colored `options`). A roadmap is seeded with a `status` select field and one undeletable default lane on `create`. **`values` is validated app-side, not by the DB:** `src/lib/fields.ts#validateValues` builds a Zod schema from that roadmap's field definitions and runs before every item write.

**Pure logic is isolated in `src/lib/` and is the main test surface.** These framework-free modules are reused across the timeline, table, editor, and filters — change them, not the components, for behavior:
- `timeline.ts` — date↔pixel math: `buildPeriods`, `dateToX`/`xToDate`, `itemGeometry`, `snapDate`, `packLanes` (lane stacking), `resolveDrag` (drag/resize → snapped dates).
- `fields.ts` — `validateValues`, `displayValue`, `emptyValue`, ms↔date-input helpers (single source of truth for field handling).
- `itemQuery.ts` — `filterItems` / `sortItems` (drive both timeline and table).
- `roadmapIO.ts` — `serializeRoadmap` / `parseImport` (versioned JSON; items reference lanes by index).

**Timeline rendering.** `TimelineView` is the orchestrator: it computes `axisWidth = periods.length × columnWidth(zoom)` (per-zoom column width from `timeline.ts`), maps the window onto it, packs lanes, and renders. Item dates are day-precision; the zoom level only changes gridlines/labels, not stored data. Drag/resize is optimistic-local during the gesture and snaps to an adaptive grid (`snapGranularity(zoom)`: one tier finer than the visible columns) with a live snapped preview + guide line, committed once on pointer-up via `items.update`; `TimelineView` stays read-only when no `onItemDatesChange` is passed (that's how the share view reuses it). Bars render as a colored left line by default, or a solid fill when `roadmap.barColorMode === "fill"`.

**The Diagrams tool (mirrors Roadmaps' shape).** `diagrams` + `diagramVersions` Convex tables mirror `roadmaps`/`roadmapVersions`. Mermaid renders **client-side** (dynamic `import("mermaid")`, `securityLevel: "strict"`); PlantUML and future engines render via **kroki.io** — `src/lib/kroki.ts` does deflate + base64url with the browser-native `CompressionStream` (no pako), and the SVG is shown as an `<img>` object URL, never inlined. The engine registry `src/lib/diagramEngines.ts` keys off `DiagramType = Doc<"diagrams">["type"]`, so adding a schema literal forces a matching registry entry. The split-view editor `/diagrams/$id` is CodeMirror 6 on the left and a debounced preview on the right (`useDiagramRender` retains the last good render across transient errors). Source autosaves on a ~1s debounce; versions are manual + auto-before-restore only (same policy as roadmaps). Public share is `/share/diagram/$token` via `sharing.getPublicDiagram` (unauthenticated, mirroring `sharing.getPublicRoadmap`). `VersionManager` was generalized into a `VersionDialog` + thin per-entity wrappers.

**The editor route** `src/routes/roadmaps/$id.tsx` is the central orchestrator wiring the bundle to `TimelineView`/`ItemTable`, the slide-over `ItemEditorPanel`, and the manager dialogs (lanes/fields/milestones/settings/share/import-export). `AppShell` gates authed pages (`<SignedIn>` / `<RedirectToSignIn>`).

## Conventions & gotchas

- **Authed `useQuery` must gate on `useConvexAuth()`.** On a cold load (deep link / hard refresh), `ConvexProviderWithClerk` calls `client.setAuth(...)` only *after* Clerk's session resolves, but a `useQuery` at the top of the component fires immediately — so the first query goes out unauthenticated and `requireUser` throws "Not authenticated". `<SignedIn>` in `AppShell` doesn't help (the query runs above that gate). Gate every authed query with the `"skip"` sentinel until auth settles: `const { isAuthenticated } = useConvexAuth(); useQuery(api.x.y, isAuthenticated ? args : "skip")`. The `undefined` return covers the gap via the existing "Loading…" branch. The public share route is exempt (intentionally unauthenticated).
- **Biome** (not ESLint/Prettier): **tab** indentation, **double** quotes. Run `pnpm run check` before every commit. `src/routeTree.gen.ts` and `src/styles.css` are lint-excluded — never add lint-disable comments there. `design files/**` is excluded too.
- **Path aliases:** `@/*` and `#/*` → `src/`; `@convex/*` → `convex/`. Import generated types as `@convex/_generated/api` and `@convex/_generated/dataModel`.
- **`convex/_generated/` and `src/routeTree.gen.ts` are auto-generated** — never edit by hand. They regenerate via `pnpm exec convex dev` and `pnpm exec tsr generate` (or `pnpm dev`). Commit the regenerated output with the change that caused it.
- **Convex backend tests** use `convex-test` and live in `convex/*.test.ts` with `const modules = import.meta.glob("./**/*.ts")`. `convex/tsconfig.json` **excludes `**/*.test.ts`** (so TDD tests referencing not-yet-built functions don't fail the deploy typecheck) and sets `"types": ["node"]` (for `process.env` in `auth.config.ts`).
- **Component tests** opt into the DOM with a top-of-file `// @vitest-environment jsdom` docblock; `vitest.config.ts` defaults to the `node` environment. `test.exclude` also excludes `.claude/worktrees/**` and stray `node_modules_OLD`/`node_modules.*` dirs so parallel Claude Code worktrees don't register as phantom test suites.
- **Line endings:** `.gitattributes` pins `* text=auto eol=lf`. Biome enforces LF; without this, Windows autocrlf breaks `pnpm run check` after branch switches.
- **Forms:** TanStack Form + Zod. **UI primitives:** `radix-ui` (unified package — `import { Dialog } from "radix-ui"`). **Icons:** Lucide only. **Dates:** date-fns. Merge classes with `cn()` from `src/lib/utils.ts`.
- **Theming:** light/dark via CSS variables in `src/styles.css`; `__root.tsx`'s `THEME_INIT_SCRIPT` sets `.light`/`.dark` on `<html>` before paint. Roadmap-specific tokens are `--rm-*`; shared classes `rm-btn-primary` / `rm-panel` / `rm-label`.
- **Convex schema** (from `.cursorrules`): use the `v` validator builder; `_id`/`_creationTime` are automatic system fields (don't declare or index them). Add new shadcn components via `pnpm dlx shadcn@latest add <name>`.
- **`@appelent/auth`** (shared Clerk/Convex auth glue, private GitHub Packages scope `@appelent`) is a direct dependency — `.npmrc` maps the scope to the registry; the auth token itself lives only in the user-level `~/.npmrc` (never commit it) or, in CI, is written per-job from the `NODE_AUTH_TOKEN`/`GITHUB_TOKEN` secret.
- **Package manager tie-breaker:** historical specs/plans may say `npm`/`npx` — always use `pnpm` regardless. If a plan contradicts this CLAUDE.md, CLAUDE.md wins.
- **Doc output convention:** all generated docs go under `docs/` — review notes (from the `review-app`/`review-session` skills) in `docs/review-notes/`, plans in `docs/plans/`, specs in `docs/superpowers/`. No top-level scratch folders.
- **`.claude/skills/review-app`, `.claude/skills/review-session`, `.claude/skills/upgrade-deps`, and `.claude/commands/review-session.md` are project-local copies** of the `appelent` plugin's bundled `skills/review-app`, `skills/review-session`, `skills/upgrade-deps` (source of truth for those three) and the global `~/.claude/commands/custom-review-session.md` template (source of truth for that one, no plugin-bundled equivalent exists). `.claude/commands/upgrade-deps.md` is a separate project-local copy of the global `~/.claude/commands/custom-upgrade-deps.md` command template. Port any non-project-specific fix made locally (not a route/module fact) back to whichever source copy it traces to — the copies should only ever differ by name/frontmatter. `.claude/skills/verify/SKILL.md` is the one exception: it's project-specific by design (route→module map) and has no source-of-truth counterpart.

## Environment

`VITE_CLERK_PUBLISHABLE_KEY`, `VITE_CONVEX_URL`, `CONVEX_DEPLOYMENT` live in `.env.local` (gitignored). `CLERK_JWT_ISSUER_DOMAIN` is set on the **Convex** deployment (`pnpm exec convex env set`; a preview-deployment default is also set via `pnpm exec convex env default set ... --type preview`), not in the repo. Deployed env vars go in `wrangler.jsonc`. `ANTHROPIC_API_KEY` (AI chat) is server-side only — `.dev.vars` locally (gitignored; see `.dev.vars.example`), `pnpm exec wrangler secret put ANTHROPIC_API_KEY` in production (add `--env dev` for `archstudio-dev`) — never in `wrangler.jsonc`.

Deploy target is **Cloudflare Workers**; the wrangler app name is `archstudio` (`archstudio-dev` for the `env.dev` config, `archstudio-pr-<N>` for PR previews — see `.github/workflows/preview.yml`). Package manager is **pnpm**, pinned via `packageManager` in `package.json`.

<!-- appelent-managed:start -->
## Appelent Managed Project

This is an Appelent-managed app. Opted-in features and their options are
recorded in `appelent.json`. Feature definitions live in the `appelent`
plugin (locally installed) or https://github.com/AppElent/appelent-packages
(`skills/<feature>/FEATURE.md`).

Before adding functionality that could apply to multiple apps, check the
feature catalog first. To add or update a feature, use `/appelent`.
<!-- appelent-managed:end -->
