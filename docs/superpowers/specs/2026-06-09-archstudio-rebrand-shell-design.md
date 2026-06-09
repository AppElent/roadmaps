# ArchStudio — Rebrand + Multi-Tool Shell (Spec #1)

**Date:** 2026-06-09
**Status:** Approved (design)

## Context

The app today is a single-purpose real-time roadmap planner branded "Roadmaps" / "RM".
The owner is an architect and wants it to grow into a broader **architect's workbench**:
roadmaps plus diagram editors (Mermaid, PlantUML), and eventually an AI helper chatbot.

That growth is several independent subsystems, so it is decomposed into a sequence of
specs (see "Roadmap beyond this spec"). **This spec is the first piece only:** rename the
product to **ArchStudio** and restructure the app shell so it can host more than one tool,
with Roadmaps as the first tool and Diagrams as an honest "coming soon" placeholder.

Intended outcome: a coherent multi-tool shell and brand that future tools slot into, with
zero backend changes and no behavior change to the existing roadmaps feature.

## Scope

In scope: brand rename, navigation/route restructure to a Home launcher + per-tool
sections, a reusable tool-card component, and a diagrams placeholder route.

Out of scope: any diagram editor functionality, Convex schema/data changes, the chatbot,
and renaming the internal `--rm-*` CSS tokens / `rm-*` utility classes (roadmap-internal,
not user-visible — renaming is pure churn).

## Design

### 1. Brand surfaces (rename only)

- `package.json` — `"name": "roadmaps"` → `"archstudio"`.
- `src/routes/__root.tsx` — head `<title>` `"Roadmaps"` → `"ArchStudio"`.
- `src/routes/index.tsx` (landing) — logo `RM` → `AS`; heading `Roadmaps` → `ArchStudio`;
  tagline → architect-workbench positioning, e.g.
  *"The architect's workbench — roadmaps, diagrams, and more in one place."*
- `src/components/Sidebar.tsx` — logo badge `RM` → `AS`; name `Roadmaps` → `ArchStudio`.
- **Leave `--rm-*` tokens and `rm-btn-primary` / `rm-panel` / `rm-label` classes
  unchanged.** They are internal and largely roadmap-specific (grid/axis/bar rendering).

### 2. Navigation restructure (Home + per-tool sections)

- **`/dashboard` becomes the Home launcher.** Replace the roadmaps list with a grid of
  `ToolCard`s: *Roadmaps* (status `active`, links to `/roadmaps`) and *Diagrams*
  (status `soon`, disabled, "Soon" badge). Keep the existing `AppShell` wrapper.
- **Roadmaps list moves to a new `/roadmaps/` index route**
  (`src/routes/roadmaps/index.tsx`). The current `DashboardPage` body — the
  `useQuery(api.roadmaps.list)` + `CreateRoadmapDialog` + `RoadmapCard` grid + create →
  `navigate({ to: "/roadmaps/$id" })` flow — relocates here essentially verbatim. The
  editor route `src/routes/roadmaps/$id.tsx` is untouched.
- **New `/diagrams/` placeholder route** (`src/routes/diagrams/index.tsx`) inside
  `AppShell`: a centered empty state ("Diagrams are coming soon"). Exists so the nav link
  is honest.
- **`Sidebar.tsx` and `BottomTabBar.tsx`** gain three nav entries: Home (`/dashboard`),
  Roadmaps (`/roadmaps`), Diagrams (`/diagrams`, with a subtle "soon" treatment). Use
  Lucide icons (e.g. `Home`, `Map`, `Workflow`).

### 3. New component

- `src/components/ToolCard.tsx` — props: `title`, `description`, `icon` (Lucide
  component), `status: "active" | "soon"`, optional `to` (route). Renders as a link when
  active, a dimmed card with a "Soon" badge when `soon`. Styled to match the existing
  `RoadmapCard` / `rm-panel` look. Consumed by the Home launcher.

### 4. No backend / data changes

Convex schema, queries, and mutations are untouched. The diagrams document type and its
table arrive in Spec #2. The only non-frontend edit is the `package.json` name.

### 5. Routing notes

- TanStack file-based routing: adding `src/routes/roadmaps/index.tsx` coexists with the
  existing `$id.tsx`. `src/routeTree.gen.ts` regenerates via `npx convex dev` / `npm run
  dev` / `npx tsr generate` — commit the regenerated output (never hand-edit it).
- Existing links to `/dashboard` (landing "Go to dashboard", sidebar, bottom bar) now land
  on the Home launcher, which is the intended behavior.

## Verification

- `npm run check` (Biome — tabs, double quotes) passes.
- `npx tsc --noEmit` passes.
- `npm run build` succeeds (SSR smoke test).
- `npm run test` — existing Vitest suite still green (it covers roadmap domain logic in
  `src/lib/`, unaffected by shell changes).
- Manual (with `npx convex dev` + `npm run dev`): land on `/` → "ArchStudio" branding;
  sign in → Home launcher; click Roadmaps → `/roadmaps` list → open an editor; Diagrams →
  placeholder; sidebar/bottom bar switch between the three sections.

## Roadmap beyond this spec

- **Spec #2 — Mermaid editor:** first real diagram tool; renders client-side via
  `mermaid`. Introduces a `diagrams` Convex table / document type.
- **Spec #3 — PlantUML editor:** needs a rendering server (Java-based; no good pure-browser
  option), so architecturally heavier.
- **Spec #4 — AI helper chatbot:** Claude-powered; its own subsystem.
