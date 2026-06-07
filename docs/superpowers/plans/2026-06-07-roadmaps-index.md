# Roadmaps — Implementation Plan Index

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each phase plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Spec: [`../specs/2026-06-07-roadmaps-design.md`](../specs/2026-06-07-roadmaps-design.md)

The MVP is delivered as a sequence of phases. **Each phase produces working, testable software** and ends with the app in a runnable state. Build them in order — later phases depend on earlier ones.

| Phase | File | Delivers |
| --- | --- | --- |
| 0 | `2026-06-07-roadmaps-phase-0-foundation.md` | Clerk↔Convex auth wired, path aliases, Vitest config, scaffold demo code removed, authed query round-trips |
| 1 | `2026-06-07-roadmaps-phase-1-backend.md` | `schema.ts` + `roadmaps`/`fields`/`lanes`/`items`/`milestones` functions + `getBundle` + auth/ownership tests |
| 2 | `2026-06-07-roadmaps-phase-2-dashboard.md` | App shell, roadmap library, create/duplicate/archive |
| 3 | `2026-06-07-roadmaps-phase-3-timeline.md` | `src/lib/timeline.ts` (TDD) + read-only timeline view (axis, lanes, item bars, milestones) |
| 4 | `2026-06-07-roadmaps-phase-4-fields-editor.md` | `src/lib/fields.ts` (TDD) + `FieldValueInput` + slide-over item editor + create/edit |
| 5 | `2026-06-07-roadmaps-phase-5-drag-manage.md` | Drag/resize on item bars + lane management + field manager |
| 6 | `2026-06-07-roadmaps-phase-6-table-filter.md` | Sortable table view (custom columns) + filtering |
| 7 | `2026-06-07-roadmaps-phase-7-sharing.md` | Share token + public `share/$token` read-only route |
| 8 | `2026-06-07-roadmaps-phase-8-import-export.md` | Import/Export JSON |
| 9 | `2026-06-07-roadmaps-phase-9-polish.md` | Theme tokens (light/dark), visual polish, real-time verification |

## Conventions (apply to every phase)

- **Biome:** tab indentation, double quotes. Run `npm run check` before each commit. `src/routeTree.gen.ts` and `src/styles.css` are lint-excluded — never add lint-disable comments there.
- **Imports:** `@/` and `#/` both resolve to `src/`. `@convex/` resolves to `convex/` (alias added in Phase 0). Convex generated code: import from `@convex/_generated/...`.
- **Tests:** Vitest. Pure logic in `src/lib/*` uses the `node` environment; component tests use `jsdom`. Convex functions tested with `convex-test`.
- **Commits:** frequent, one per task. Conventional commit messages.
- **Dev loop:** `npm run dev:all` (Convex + Vite). After schema/function changes, the Convex dev server regenerates `convex/_generated`.
- **Auth:** every Convex query/mutation calls `requireUser(ctx)` except the single public share path. Every write re-verifies roadmap ownership via `requireRoadmapOwner(ctx, roadmapId)`.
