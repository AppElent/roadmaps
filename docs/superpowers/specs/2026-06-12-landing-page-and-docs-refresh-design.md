# Landing Page + Docs Refresh — Design

**Date:** 2026-06-12
**Status:** Approved (design)

## Context

ArchStudio is now a multi-tool architect's workbench (rebrand spec #1 + the Mermaid/PlantUML
diagram editor are both merged to `master`), but three front-facing surfaces still predate that
reality:

- `src/routes/index.tsx` (the landing page) is a minimal centered sign-in card.
- `README.md` is mostly the default TanStack Start scaffold tutorial, plus custom deploy/Clerk/
  Convex sections.
- `CLAUDE.md` opens by describing the app as "a real-time roadmap-planning web app" and documents
  only the Roadmaps subsystem — it never mentions the multi-tool shell or the Diagrams tool.

This spec covers a tasteful, lightly-marketed landing page and a refresh of both docs. No backend,
schema, or product-behavior changes.

## Scope

In scope:
- Full rewrite of the landing page (`src/routes/index.tsx`) — architect/blueprint tone, theme-aware,
  showcasing the three tools.
- Full rewrite of `README.md` as a real product README.
- Update of `CLAUDE.md` to describe the ArchStudio multi-tool reality (shell + Roadmaps + Diagrams),
  preserving all existing gotchas.

Out of scope:
- Any Convex schema/query/mutation changes.
- New product features, routes, or the AI helper tool itself (it is teased as "Soon" only).
- Renaming the internal `--rm-*` CSS tokens / `rm-*` utility classes (roadmap-internal, deliberately
  unchanged — same decision as the rebrand spec).
- Literal product screenshots of the running app (the showcase uses icons + text, not UI captures).
- New dependencies.

## Design

### 1. Landing page — `src/routes/index.tsx` (full rewrite)

A standalone route (NOT wrapped in `AppShell`), keeping the public/unauthenticated nature of `/`.
Visual tone: **architect / blueprint** — a subtle blueprint grid behind the hero, monospace accents
matching the `AS` mono badge, precise technical feel. Theme-aware: it respects the app's
light/dark CSS variables and reuses the existing `ThemeToggle` component.

**Layout (Direction B — hero + cards, one short scroll):**

1. **Top bar.** Left: `AS` mono badge + "ArchStudio" wordmark. Right: the existing `ThemeToggle`
   (`src/components/ThemeToggle.tsx`, reused as-is) and auth controls:
   - `<SignedOut>`: a `<SignInButton mode="modal">` primary button.
   - `<SignedIn>`: an "Open app" link → `/dashboard` plus `<UserButton />`.
2. **Hero.** A short headline, the existing tagline as subhead, and a primary CTA that mirrors the
   top-bar auth state (Sign in modal when signed out; "Go to dashboard" → `/dashboard` when signed
   in). Behind the hero sits a subtle blueprint grid drawn with a CSS `repeating-linear-gradient`
   using `var(--rm-grid-line)` at low opacity — hero region only, not the whole page. A couple of
   monospace micro-labels reinforce the drafting-table identity.
3. **Tool showcase.** A responsive row of three cards:
   - **Roadmaps** (live) — real-time timeline planner: drag/resize bars, lanes, custom fields,
     milestones, share links.
   - **Diagrams** (live) — live Mermaid + PlantUML editor with instant preview, versioning, share
     links.
   - **AI helper** — a dimmed card with a "Soon" badge teasing the planned Claude-powered assistant.

   Each card has a Lucide icon, title, one-line description, and 2–3 feature bullets. These cards are
   **presentational on the landing** — they do NOT deep-link into authed routes (clicking the CTA /
   signing in is the way in). This is intentionally distinct from the dashboard's `ToolCard`, which
   links into authed tool routes; the landing does not reuse `ToolCard`.
4. **Footer.** Minimal: wordmark + a "built with TanStack Start · Convex · Clerk · Cloudflare" line.

**Styling & structure:**
- Reuse existing design tokens: `var(--rm-accent)` (green) for the primary CTA, `rm-panel` /
  `var(--rm-panel)` for cards, `font-mono` for the badge and micro-labels. Tailwind utility classes
  consistent with the rest of `src/`.
- Implemented as the route file plus a few small **local** function components (e.g. `Hero`,
  `ToolShowcaseCard`) co-located in `index.tsx`. Extract to `src/components/landing/` only if the
  file grows unwieldy — default is to keep it in one file.
- **No new dependencies.** Lucide (`lucide-react`) and `radix-ui` are already present. If a Lucide
  icon collides with a JS global (per the `Map as MapIcon` rebrand gotcha), alias it.
- Accessibility: the theme toggle already carries an `aria-label`; ensure the hero uses a single
  `<h1>`, tool titles use appropriate heading levels, and icons are decorative (`aria-hidden`).

**Headline copy.** The hero subhead keeps the current tagline
("The architect's workbench — roadmaps, diagrams, and more in one place."). The implementer drafts a
punchier top-line headline and offers 2–3 options to the user during build (e.g. "Plan systems, not
just projects."). No copy is hardcoded as final without that quick check.

### 2. README.md (full rewrite)

Replace the scaffold tutorial with a real product README. Section order:

1. **Title + one-line pitch** — ArchStudio, the architect's workbench.
2. **What it is** — short paragraph on the multi-tool workbench and who it's for.
3. **The tools** — Roadmaps, Diagrams, and AI helper (coming soon), each with a one-line feature
   summary.
4. **Tech stack** — React 19 + TanStack Start (SSR), Convex, Clerk, Cloudflare Workers, Tailwind v4,
   Biome, Vitest.
5. **Quick start** — `.env.local` essentials, then the two-terminal flow (`npx convex dev` +
   `npm run dev`) with the explicit note that Convex must be running or `useQuery` never resolves.
6. **Commands** — test / `npm run check` / `tsc --noEmit` / build, condensed.
7. **Deploy** — KEEP the existing multi-environment deploy section (prod/dev/preview, `.env.deploy.*`,
   `scripts/deploy.mjs`), trimmed lightly.
8. **Clerk & Convex setup** — KEEP, trimmed to the essentials.
9. **Architecture pointer** — direct readers to `CLAUDE.md` for the deeper architecture/conventions.

Drop the generic scaffold sections: Tailwind-removal instructions, routing/links tutorial, layout
tutorial, server-functions tutorial, API-routes tutorial, data-fetching/loaders tutorial, T3Env
usage walkthrough, "Demo files" note, and the generic "Learn More" TanStack links. (Keep a brief
mention that the project uses file-based routing, shadcn, and Biome where it aids a new contributor —
but as facts, not tutorials.)

### 3. CLAUDE.md (update to ArchStudio reality)

Targeted edits — preserve the document's structure and **every existing gotcha verbatim**:

- **Intro paragraph:** rewrite from "a real-time roadmap-planning web app" to the multi-tool
  architect's workbench — a shell hosting Roadmaps (real-time timeline planner) and Diagrams (live
  Mermaid + PlantUML editor), with an AI helper planned. Keep the "built phase-by-phase from
  specs/plans" framing.
- **Commands:** add the `npm run seed` / `npx convex run seed:seedDemo` command; verify the rest
  still match `package.json`.
- **Architecture:** document the shell — `/dashboard` is the Home launcher of `ToolCard`s, the
  roadmaps list lives at `/roadmaps/`, the diagrams list/editor at `/diagrams/`, sidebar/bottom-bar
  nav = Home/Roadmaps/Diagrams. Note the landing route `/` is public and standalone (outside
  `AppShell`).
- **New "Diagrams" subsection** mirroring the depth of the existing Roadmaps/custom-fields/timeline
  detail: `diagrams` + `diagramVersions` tables (mirror roadmaps/roadmapVersions); Mermaid renders
  client-side (dynamic `import("mermaid")`, `securityLevel: "strict"`); PlantUML & future types via
  kroki.io (`src/lib/kroki.ts`, deflate+base64url with browser-native `CompressionStream`, SVG shown
  as an `<img>` object URL); engine registry `src/lib/diagramEngines.ts`
  (`DiagramType = Doc<"diagrams">["type"]`); split-view editor `/diagrams/$id` (CodeMirror 6 +
  debounced preview, `useDiagramRender` last-good-render retention); debounced autosave (~1s);
  public share `/share/diagram/$token` via `sharing.getPublicDiagram`; generic `VersionDialog` +
  per-entity wrappers.
- **Preserve unchanged:** the auth-gating-on-`useConvexAuth` note, Biome rules, the `--rm-*`
  non-rename decision, `@convex/*` aliases, generated-file warnings, convex-test conventions,
  jsdom docblock, line-endings/`.gitattributes`, forms/UI/icons/dates conventions, and the
  Environment section.

## Architecture & data flow

No data flow changes. The landing page remains a public SSR route; auth state is read via Clerk's
`<SignedIn>`/`<SignedOut>` (same as today). Theme is applied by `ThemeToggle` writing `light`/`dark`
to `<html>` and persisting to `localStorage` — already wired by `__root.tsx`'s `THEME_INIT_SCRIPT`,
so the landing inherits the no-flash behavior automatically.

## Error handling

Not applicable beyond the existing auth flows — the landing has no data fetching of its own. The CTA
and top-bar auth controls degrade naturally between signed-in and signed-out states via Clerk's
components.

## Testing

The landing page is presentational and adds no logic to `src/lib/` (the project's unit-test surface),
so it gets no new unit tests. Verification is:

- `npm run check` (Biome — tabs, double quotes) passes.
- `npx tsc --noEmit` passes.
- `npm run build` succeeds (SSR smoke test).
- `npm run test` — existing Vitest suite stays green (unaffected by docs/landing changes).
- Manual (with `npx convex dev` + `npm run dev`): load `/` signed-out (Sign in modal works) and
  signed-in (Open app / Go to dashboard → `/dashboard`); toggle light/dark and confirm the blueprint
  hero and tool cards read well in both modes.

## Verification checklist

- [ ] Landing page renders the blueprint hero + 3 tool cards + footer, theme-aware, no console errors.
- [ ] Signed-out and signed-in states both correct (CTA + top-bar auth).
- [ ] `README.md` reads as a product README; no leftover scaffold tutorial sections; deploy/Clerk/
      Convex info preserved.
- [ ] `CLAUDE.md` intro + architecture describe the multi-tool workbench; Diagrams subsection added;
      all prior gotchas intact.
- [ ] `npm run check`, `npx tsc --noEmit`, `npm run build`, `npm run test` all green.
