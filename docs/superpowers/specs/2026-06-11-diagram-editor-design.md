# Diagram Editor (Mermaid + PlantUML via Kroki) — Design

**Date:** 2026-06-11
**Status:** Approved (brainstorming)

## Context

ArchStudio's shell spec (#1) left `/diagrams` as a placeholder and planned the diagram tools
as separate specs. This spec delivers the diagram editor: live code-to-diagram editing for
**Mermaid** (client-side rendering) and **PlantUML** (rendered remotely via **Kroki**), with
the same manual/auto version-checkpoint model as roadmaps and public read-only share links.

The AI chat assistant is **Spec B** — a follow-up. This spec only keeps its integration
points open (see "Spec B integration points").

## Decisions (from brainstorming)

- **Scope:** Editor + versioning + sharing now; AI chat is a separate later spec.
- **PlantUML rendering:** public **Kroki** service (`kroki.io`) — encode source, fetch SVG.
  Zero infrastructure. Accepted trade-off: diagram source is sent to a third-party server
  and rendering PlantUML requires internet. The type model is kept open so other Kroki
  diagram types can be added later (not implemented now).
- **Code editor:** **CodeMirror 6** (line numbers, history, theming). Mermaid syntax
  highlighting via `codemirror-lang-mermaid`; PlantUML is plain monospace (no maintained
  CM6 grammar — acceptable).
- **Layout:** split view — code panel left (collapsible to a thin rail), live preview right.
- **Rerender:** debounced auto-render with per-engine timing (Mermaid ~300 ms local,
  Kroki ~800 ms remote with in-flight cancellation) and **last-good-render retention** on
  errors. No per-keystroke rendering, no manual render button.
- **Versioning:** same model as roadmaps — manual named checkpoints plus an automatic
  checkpoint **only before destructive operations** (restore). 25-version cap, oldest
  pruned first. No periodic autosnapshots.
- **Sharing:** separate random `shareToken` honored only when `visibility === "link"`
  (NOT the document ID as the link — tokens are revocable/rotatable, document IDs leak in
  editor URLs, and Convex IDs are not capability tokens). Roadmaps stays as-is.

## Architecture

### Data model (`convex/schema.ts`)

```
diagramTypeValidator = v.union(v.literal("mermaid"), v.literal("plantuml"))
// extend with more Kroki types later — one literal + one engine-registry entry

diagramSnapshotValidator = v.object({
  title: v.string(),
  type: diagramTypeValidator,
  source: v.string(),
})

diagrams: defineTable({
  userId: v.string(),
  title: v.string(),
  type: diagramTypeValidator,
  source: v.string(),
  visibility: v.union(v.literal("private"), v.literal("link")),
  shareToken: v.optional(v.string()),
  archived: v.boolean(),
})
  .index("by_user", ["userId"])
  .index("by_shareToken", ["shareToken"])

diagramVersions: defineTable({
  diagramId: v.id("diagrams"),
  userId: v.string(),
  label: v.string(),
  kind: v.union(v.literal("manual"), v.literal("auto")),
  snapshot: diagramSnapshotValidator,
}).index("by_diagram", ["diagramId"])
```

### Backend (Convex)

- **`convex/diagrams.ts`** — `list` (by_user), `get` (owner-checked), `create` (title +
  type; `source` seeded from the engine's starter template), `update` (partial patch of
  title/source/type), `remove` (deletes the diagram **and its versions**), plus share
  mutations copied from the roadmaps pattern: set visibility, generate/regenerate token
  (`crypto.randomUUID()`).
- **`convex/diagramVersions.ts`** — `list` (metadata only: `_id`, `label`, `kind`,
  `_creationTime`; newest-first), `create` (manual; blank label falls back to a default),
  `restore` (saves an auto "Before restore" checkpoint **first**, then patches
  title/type/source from the snapshot). 25-cap prune, oldest first.
- **`convex/sharing.ts`** — add `getPublicDiagram({ shareToken })`: the second
  unauthenticated query; returns the diagram only when `visibility === "link"`.
- **`convex/lib/auth.ts`** — add `requireDiagramOwner(ctx, diagramId)` beside
  `requireRoadmapOwner`. Every function calls `requireUser` / owner checks server-side,
  as everywhere else.

### Saving model

The editor saves `source` through a **debounced `diagrams.update`** (~1 s after typing
pauses, flushed on blur/navigation). The document is the live state; versions are created
only manually or automatically before a restore.

**Two-tab rule:** remote `source` changes (other tab, restore) apply only when the local
editor has no pending unsaved changes; while typing, local wins (last-write-wins on save).
Single-user app — this simple guard is enough.

## Frontend

### Routes (all `ssr: false`, authed queries gated on `useConvexAuth()`)

- **`src/routes/diagrams/index.tsx`** — placeholder becomes a real list page mirroring
  `/roadmaps/`: card grid from `diagrams.list`, create dialog (title + type picker),
  click-through to the editor.
- **`src/routes/diagrams/$id.tsx`** — the editor (orchestrator, like `roadmaps/$id.tsx`).
  Header: back link, inline-editable title, type badge, save-status indicator
  ("Saving…"/"Saved"), Versions and Share buttons. Body: CodeMirror panel left
  (collapsible via chevron toggle), live preview right.
- **`src/routes/share/diagram.$token.tsx`** — public read-only view (title + rendered
  diagram), powered by `sharing.getPublicDiagram`; reuses the preview component with no
  editor around it.
- Sidebar/bottom-bar: remove the "soon" treatment from the Diagrams nav entry.

### Engine registry — `src/lib/diagramEngines.ts` (pure, testable)

One entry per type:

```ts
{ id: "mermaid",  label: "Mermaid",  strategy: "client-mermaid",
  debounceMs: 300, starterSource: "flowchart TD\n..." }
{ id: "plantuml", label: "PlantUML", strategy: "kroki", krokiType: "plantuml",
  debounceMs: 800, starterSource: "@startuml\n...\n@enduml" }
```

Adding another Kroki type later = one registry entry + one schema literal.

### Rendering

- **Mermaid:** client-side via dynamic `import("mermaid")` (keeps ~1 MB out of the initial
  bundle and out of SSR). `mermaid.parse()` validates; `mermaid.render()` produces SVG,
  injected with Mermaid's default `securityLevel: "strict"` sanitization.
- **Kroki:** `src/lib/kroki.ts` — `encodeKrokiSource(source)` uses browser-native
  `CompressionStream("deflate")` + base64url (**no pako dependency**) →
  `https://kroki.io/{type}/svg/{encoded}`. The preview **fetches** that URL with an
  `AbortController` (cancels stale in-flight renders) so Kroki's 400-with-message
  responses surface as readable errors; successful SVG is displayed via `<img>` + object
  URL — third-party SVG is never inlined into the DOM.
- **`src/hooks/useDiagramRender.ts`** owns: per-engine debounce, in-flight cancellation,
  and **last-good-render retention** — on a parse/render error the previous diagram stays
  visible with a compact error banner (message + line where available). A subtle
  "rendering…" indicator shows during Kroki round-trips.

### Components (`src/components/diagrams/`)

- `CodeEditorPanel.tsx` — thin CodeMirror 6 wrapper (basic setup: line numbers, history,
  bracket matching; dark theme keyed off the existing theme class).
- `DiagramPreview.tsx` — renders the hook's output (SVG / img / error banner / spinner).
- `CreateDiagramDialog.tsx`, `DiagramShareDialog.tsx`, `DiagramVersionManager.tsx`.

### Versioning UI (targeted refactor)

The existing `VersionManager` UI is generic; only its three `api.roadmapVersions.*`
references are roadmap-specific. Extract the presentation into
`src/components/versions/VersionDialog.tsx` (props: `versions`, `onCreate(label)`,
`onRestore(id)`, entity noun for copy); `VersionManager` (roadmaps) and
`DiagramVersionManager` become thin wrappers binding their Convex functions. Roadmaps
behavior unchanged.

### Share UI

Mirrors roadmaps: visibility toggle, share URL (`/share/diagram/{token}`) with copy
button, regenerate-link action. If the roadmaps `ShareDialog` parameterizes as cleanly as
`VersionManager`, reuse it the same wrapper way; otherwise a small sibling component —
decided during implementation.

## Spec B (AI chat) integration points — sketched only

- **Layout slot:** the split view is a flex row; the chat docks later as a third,
  toggleable right-hand panel.
- **Contract:** the chat needs to *read* the current `source`/`type` and *propose* a new
  `source`, which flows through the same debounced save + render path (optionally
  checkpointed via the existing manual-version mutation before applying). Source state
  lives in the route orchestrator where a chat panel can reach it. No hooks or props are
  added preemptively.
- Backend (Anthropic key handling, streaming, chat persistence) is entirely Spec B.

## Testing

- **`convex/diagrams.test.ts`** — create seeds starter source; ownership enforced on
  get/update/remove; remove deletes that diagram's versions; share mutations (enable →
  token resolves, regenerate → old token stops resolving); `getPublicDiagram` returns
  data only for `visibility === "link"`.
- **`convex/diagramVersions.test.ts`** — mirrors the roadmapVersions suite: manual create
  captures state; restore writes an auto "Before restore" version then reproduces the
  snapshot (round-trip); 25-cap prunes oldest first; ownership enforced.
- **`src/lib/__tests__/kroki.test.ts`** — `encodeKrokiSource` against a known vector
  (Node ≥ 18 ships `CompressionStream`, so it runs in the default vitest node env);
  URL building per type.
- **`src/lib/__tests__/diagramEngines.test.ts`** — registry completeness: every schema
  type has an entry, starter sources non-empty, sane debounce values.
- Debounce/retention logic lives in the hook; pure parts unit-tested, browser behavior
  verified manually.

## Dependencies (new)

`mermaid`, `codemirror` (+ the `@codemirror/*` packages basic setup pulls in),
`codemirror-lang-mermaid`. Kroki needs nothing (`CompressionStream` + `fetch`).

## Files

**New:** `convex/diagrams.ts`, `convex/diagramVersions.ts`, `convex/diagrams.test.ts`,
`convex/diagramVersions.test.ts`, `src/lib/diagramEngines.ts`, `src/lib/kroki.ts`,
`src/lib/__tests__/kroki.test.ts`, `src/lib/__tests__/diagramEngines.test.ts`,
`src/hooks/useDiagramRender.ts`, `src/components/diagrams/*` (CodeEditorPanel,
DiagramPreview, CreateDiagramDialog, DiagramShareDialog, DiagramVersionManager),
`src/components/versions/VersionDialog.tsx`, `src/routes/diagrams/$id.tsx`,
`src/routes/share/diagram.$token.tsx`.

**Modified:** `convex/schema.ts` (two tables + validators), `convex/lib/auth.ts`
(`requireDiagramOwner`), `convex/sharing.ts` (`getPublicDiagram`),
`src/components/versions/VersionManager.tsx` (thin wrapper), `src/routes/diagrams/index.tsx`
(placeholder → list page), sidebar/bottom-bar nav, regenerated `src/routeTree.gen.ts` and
`convex/_generated/`.

## Verification gates

`npm run check`, `npx tsc --noEmit`, `npx convex dev --once`, `npm run test`,
`npm run build`, plus a manual pass: create both diagram types; type and watch debounced
rendering with an intentional syntax error (last-good retention); save/restore versions;
open a share link in an incognito window; collapse/expand the code panel.
