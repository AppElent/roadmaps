# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

A real-time roadmap-planning web app: timelines of initiatives across lanes and timeframes, with per-roadmap custom fields, a sortable table, milestones, public read-only share links, and JSON import/export. Built phase-by-phase from the spec in `docs/superpowers/specs/` and plans in `docs/superpowers/plans/`.

## Commands

```bash
npx convex dev        # Start the Convex backend (watch mode). REQUIRED for any data to load.
npm run dev           # Vite dev server on :3000. Run alongside `npx convex dev`.
npx convex dev --once # Deploy backend once + typecheck convex/ + regenerate convex/_generated. Run after editing anything in convex/.

npm run test          # Vitest (all). Single file: npx vitest run src/lib/__tests__/timeline.test.ts
npm run check         # Biome lint + format check — MUST pass before committing. Autofix: npx biome check --write src/
npx tsc --noEmit      # Full type check (Biome does NOT type-check)
npm run build         # Production/SSR build (also the best smoke test that the app compiles)
npm run deploy        # Build + wrangler deploy to Cloudflare
```

There is no `dev:all` script — run `npx convex dev` and `npm run dev` in two terminals. Without the Convex process, `useQuery` hooks never resolve.

## Architecture

Two layers in one repo:
- **`src/`** — React 19 + TanStack React Start (SSR), file-based routing, deployed as a Cloudflare Worker.
- **`convex/`** — serverless backend: schema, queries, mutations. Real-time by default.

**Data flow:** `Clerk (auth) → JWT → Convex → useQuery subscriptions → React`. The Clerk provider wraps the Convex provider (`src/integrations/convex/provider.tsx` uses `ConvexProviderWithClerk`). `convex/auth.config.ts` reads `CLERK_JWT_ISSUER_DOMAIN` from the Convex backend's own env (set via `npx convex env set`, not committed) and requires a Clerk JWT template named `convex`.

**The single-subscription bundle.** The editor loads one query — `roadmaps.getBundle({ roadmapId })` — returning `{ roadmap, fields, lanes, items, milestones }` together (loader in `convex/lib/bundle.ts`). The whole editor subscribes to this one query, so any mutation pushes an atomic real-time snapshot. The public share path mirrors it: `sharing.getPublicRoadmap({ shareToken })` returns the same shape with **no auth** (the only unauthenticated function) and only for `visibility === "link"`.

**Auth/ownership is enforced server-side, always.** Every Convex function calls `requireUser(ctx)` (returns the Clerk subject = stored `userId`); every write re-verifies ownership via `requireRoadmapOwner(ctx, roadmapId)` (both in `convex/lib/auth.ts`). Child mutations (lanes/items/fields/milestones) look up the row, then check the parent roadmap's owner.

**Custom fields = embedded values map (Approach A).** Items are NOT one-column-per-field. Structural columns (`title`, `laneId`, `startDate`, `endDate`) are real schema fields; everything else lives in `items.values` — a `Record<string, string | number | string[] | null>` keyed by a field's `key`. Field definitions live in the `fields` table (`type`: text/number/date/select/multiselect; select types carry colored `options`). A roadmap is seeded with a `status` select field and one undeletable default lane on `create`. **`values` is validated app-side, not by the DB:** `src/lib/fields.ts#validateValues` builds a Zod schema from that roadmap's field definitions and runs before every item write.

**Pure logic is isolated in `src/lib/` and is the main test surface.** These framework-free modules are reused across the timeline, table, editor, and filters — change them, not the components, for behavior:
- `timeline.ts` — date↔pixel math: `buildPeriods`, `dateToX`/`xToDate`, `itemGeometry`, `snapDate`, `packLanes` (lane stacking), `resolveDrag` (drag/resize → snapped dates).
- `fields.ts` — `validateValues`, `displayValue`, `emptyValue`, ms↔date-input helpers (single source of truth for field handling).
- `itemQuery.ts` — `filterItems` / `sortItems` (drive both timeline and table).
- `roadmapIO.ts` — `serializeRoadmap` / `parseImport` (versioned JSON; items reference lanes by index).

**Timeline rendering.** `TimelineView` is the orchestrator: it computes `axisWidth = periods.length × COLUMN_WIDTH`, maps the window onto it, packs lanes, and renders. Item dates are day-precision; the zoom level only changes gridlines/labels, not stored data. Drag/resize is optimistic-local during the gesture, committed once on pointer-up via `items.update`; `TimelineView` stays read-only when no `onItemDatesChange` is passed (that's how the share view reuses it).

**The editor route** `src/routes/roadmaps/$id.tsx` is the central orchestrator wiring the bundle to `TimelineView`/`ItemTable`, the slide-over `ItemEditorPanel`, and the manager dialogs (lanes/fields/milestones/settings/share/import-export). `AppShell` gates authed pages (`<SignedIn>` / `<RedirectToSignIn>`).

## Conventions & gotchas

- **Biome** (not ESLint/Prettier): **tab** indentation, **double** quotes. Run `npm run check` before every commit. `src/routeTree.gen.ts` and `src/styles.css` are lint-excluded — never add lint-disable comments there. `design files/**` is excluded too.
- **Path aliases:** `@/*` and `#/*` → `src/`; `@convex/*` → `convex/`. Import generated types as `@convex/_generated/api` and `@convex/_generated/dataModel`.
- **`convex/_generated/` and `src/routeTree.gen.ts` are auto-generated** — never edit by hand. They regenerate via `npx convex dev` and `npx tsr generate` (or `npm run dev`). Commit the regenerated output with the change that caused it.
- **Convex backend tests** use `convex-test` and live in `convex/*.test.ts` with `const modules = import.meta.glob("./**/*.ts")`. `convex/tsconfig.json` **excludes `**/*.test.ts`** (so TDD tests referencing not-yet-built functions don't fail the deploy typecheck) and sets `"types": ["node"]` (for `process.env` in `auth.config.ts`).
- **Component tests** opt into the DOM with a top-of-file `// @vitest-environment jsdom` docblock; `vitest.config.ts` defaults to the `node` environment.
- **Line endings:** `.gitattributes` pins `* text=auto eol=lf`. Biome enforces LF; without this, Windows autocrlf breaks `npm run check` after branch switches.
- **Forms:** TanStack Form + Zod. **UI primitives:** `radix-ui` (unified package — `import { Dialog } from "radix-ui"`). **Icons:** Lucide only. **Dates:** date-fns. Merge classes with `cn()` from `src/lib/utils.ts`.
- **Theming:** light/dark via CSS variables in `src/styles.css`; `__root.tsx`'s `THEME_INIT_SCRIPT` sets `.light`/`.dark` on `<html>` before paint. Roadmap-specific tokens are `--rm-*`; shared classes `rm-btn-primary` / `rm-panel` / `rm-label`.
- **Convex schema** (from `.cursorrules`): use the `v` validator builder; `_id`/`_creationTime` are automatic system fields (don't declare or index them). Add new shadcn components via `pnpm dlx shadcn@latest add <name>`.

## Environment

`VITE_CLERK_PUBLISHABLE_KEY`, `VITE_CONVEX_URL`, `CONVEX_DEPLOYMENT` live in `.env.local` (gitignored). `CLERK_JWT_ISSUER_DOMAIN` is set on the **Convex** deployment (`npx convex env set`), not in the repo. Deployed env vars go in `wrangler.jsonc`.
