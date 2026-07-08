# AI Chat (Diagrams + Roadmaps) — Design

**Date:** 2026-07-08
**Status:** Approved (brainstorming; backend revised to TanStack AI after review)

## Context

The diagram editor spec (2026-06-11) reserved integration points for "Spec B": an AI chat
panel docking into the editor. This spec delivers it — broadened to cover **both tools**: a
Claude-powered chat panel in the diagram editor *and* the roadmap editor that can read the
open document and change it directly.

## Decisions (from brainstorming)

- **Scope:** context-scoped chat per editor (diagram + roadmap), but the backend is
  architected so the same engine can later power a global app-wide assistant.
- **Apply model:** the AI **applies changes directly** via tool calls — no preview/apply
  step. Safety comes from an automatic version checkpoint before every AI write plus the
  existing version-restore UI.
- **Interaction model:** **uniform document model.** The AI treats both entities as whole
  documents it reads and rewrites:
  - diagram document = `{ title, type, source }` (the `diagramSnapshotValidator` shape)
  - roadmap document = the roadmap snapshot (`roadmapSnapshotValidator` shape: settings,
    fields, lanes, items, milestones, dependencies — items reference lanes by index)
  Roadmap writes flow through the existing JSON-import path (`io.replaceRoadmap`:
  auto-version + `applySnapshot`), which already remaps internal references atomically.
  Granular per-item tools are a possible later addition inside the same architecture, not
  part of this spec.
- **Persistence:** chat is **ephemeral** — message state lives in React while the editor is
  open; refresh starts fresh. No new tables. The AI's *changes* persist as documents +
  versions.
- **Backend:** **TanStack AI in a TanStack Start server route** (`/api/chat`), using
  `@tanstack/ai` + `@tanstack/ai-anthropic` on the server and `@tanstack/ai-react`'s
  `useChat` on the client. Chosen over a Convex `httpAction` because chat is ephemeral —
  Convex was only providing key custody and auth, which the Start backend also covers —
  and TanStack AI eliminates the custom plumbing (SSE framing, CORS, hand-rolled chat
  hook). Accepted trade-offs: TanStack AI is young (churn risk, consistent with the rest
  of this stack), and each tool call is a Worker→Convex network hop.

## Architecture

```
ChatPanel (React, ephemeral state via useChat from @tanstack/ai-react)
   │  fetchServerSentEvents POST /api/chat   (same-origin, no CORS)
   ▼
TanStack Start server route src/routes/api/chat.ts  (runs on the Cloudflare Worker)
   │  Clerk server-side auth → 401 if unauthenticated
   │  getToken({ template: "convex" }) → ConvexHttpClient.setAuth(jwt)
   │  chat({ adapter: anthropicText(), model, messages, tools }) → SSE response
   │
   ├─ tool read_document  → adapter.read  → Convex query   (ownership enforced by Convex)
   ├─ tool write_document → adapter.write → Convex mutation (auto-version, then apply)
   ▼
SSE stream → useChat renders text deltas + tool events
Document writes land via existing live subscriptions → editor updates in real time
```

**Request payload:** messages plus `docRef: { kind: "roadmap" | "diagram", id }` sent as
request data alongside the history (client holds the conversation; server is stateless).

**Tools** are Zod-typed `toolDefinition`s (`read_document`, `write_document`) whose server
implementations dispatch through a **document adapter registry** — the "designed for
global" seam. Each kind provides `read`/`write` plus a document-schema description for the
system prompt. This phase registers `roadmap` and `diagram` and pins the loop to the single
`docRef` document — no list/create/open tools. A future global assistant adds those tools
to the same registry without reworking the loop.

- `roadmap.read` → `roadmaps.getBundle` + the existing pure serializer
  (`src/lib/roadmapIO.ts#serializeRoadmap`); `roadmap.write` → `io.replaceRoadmap`
  (auto-versions, then `applySnapshot`).
- `diagram.read` → the diagram row (`{ title, type, source }`); `diagram.write` → a **new
  small Convex mutation `diagrams.replace`** that auto-versions ("Before AI edit") then
  updates — mirroring `replaceRoadmap`. Only Convex change in this spec.
- **The AI layer gets no special powers:** every read/write goes through public Convex
  functions with the user's own JWT, so `requireUser`/`requireRoadmapOwner` enforcement
  stays exactly where it is today.
- **Date transform:** roadmap snapshots store ms epochs; the adapter converts
  ms ↔ `"YYYY-MM-DD"` strings in both directions so the model reads and writes calendar
  dates, never timestamps. Pure module in `src/lib/aiDoc.ts`, unit-tested.

**Model & key:** `claude-sonnet-5`, overridable via `ANTHROPIC_MODEL`. `ANTHROPIC_API_KEY`
is read server-side only — from `.env.local` in dev (gitignored) and a **Cloudflare secret
(`wrangler secret put ANTHROPIC_API_KEY`)** in production. Never in `wrangler.jsonc` (it is
committed) and never exposed to the client.

**System prompt** is composed per document kind: diagram prompts include the engine type
and syntax guidance (Mermaid vs PlantUML); roadmap prompts include the JSON document schema
description (with ISO dates and the lane-index convention) and today's date.

## Frontend

- **`src/components/ai/ChatPanel.tsx`** — one shared panel taking
  `docRef: { kind, id }`, built on `useChat` +
  `fetchServerSentEvents("/api/chat")`. Docking:
  - Diagram editor: the third, toggleable right-hand panel in the split-view flex row
    (exactly the slot Spec B reserved).
  - Roadmap editor: same panel as a right-hand dock in `src/routes/roadmaps/$id.tsx`
    (slide-in alongside timeline/table, like `ItemEditorPanel`).
  - Toggle: Sparkles icon button in each editor toolbar.
- **Tool events render as chips**, not JSON — "📖 Read roadmap", "✏️ Updated diagram (version
  checkpoint created)". Because writes arrive through the live subscription, the document
  visibly changes next to the chat.
- Enter sends; Shift+Enter newline; input disabled while streaming; Stop button aborts.
- Share routes get **no chat** — authed editors only.
- Styling: existing tokens/classes (`rm-*`, `cn()`), Radix primitives, Lucide icons.

## Safety

- **Ownership:** the route handler 401s without a Clerk session; all document access uses
  the user's own Convex JWT against existing owner-checked functions. The loop can only
  touch the pinned document.
- **Auto-version before every AI write** (roadmaps via `replaceRoadmap`, diagrams via the
  new `diagrams.replace`). Roadmap checkpoints keep `replaceRoadmap`'s existing
  "Before JSON import" label (accepted — no mutation change); diagram checkpoints are
  labeled "Before AI edit". Same recoverability as JSON import. Accepted consequence: the
  25-version cap means a long editing session prunes oldest versions — same policy as
  today.
- **Validation errors return to the model as tool results**, so it self-corrects: Zod
  input schemas on the tools, plus roadmap semantic checks in `aiDoc.ts` — `values` keys
  must match field definitions (mirroring `validateValues`), select values among options,
  lane indexes in range, `startDate ≤ endDate`. The user never sees a raw validation stack.
- **Loop cap:** 8 tool-use iterations per request; `max_tokens` capped.
- **Size guard:** documents over 100 KB serialized get a clear "too large for AI editing"
  refusal instead of silent truncation.

## Error handling

- API failures / mid-stream drops surface through `useChat`'s error state → inline red
  message with retry; client-held history means nothing is lost.
- Stop button aborts the fetch; UI notes an in-flight write may still land (the version
  checkpoint covers recovery).

## Testing

- **Pure units** (primary surface, per project convention): `src/lib/aiDoc.ts` —
  ms↔`YYYY-MM-DD` round-trip; roadmap doc validation (bad lane index, unknown field key,
  reversed dates); system-prompt composition per kind.
- **Tool implementations** unit-tested with a mocked Convex client: read returns the
  document shape; write dispatches to the right mutation; validation failure returns an
  error result instead of throwing.
- **`convex-test`:** the new `diagrams.replace` mutation — creates the auto-version then
  applies; non-owner rejected.
- **ChatPanel** jsdom smoke test: renders messages, disables input while streaming.

## Dependencies (new)

`@tanstack/ai`, `@tanstack/ai-anthropic`, `@tanstack/ai-react` (Zod already present).

## Files

- `src/routes/api/chat.ts` — Start server route: Clerk auth, TanStack AI chat loop, SSE
  response. **New.**
- `src/lib/ai/adapters.ts` — document adapter registry + tool definitions. **New.**
- `src/lib/aiDoc.ts` — date transform + roadmap doc validation + prompt schema text
  (pure). **New.**
- `src/components/ai/ChatPanel.tsx` — shared chat panel on `useChat`. **New.**
- `convex/diagrams.ts` — add `replace` mutation (auto-version + update). **Edit.**
- `src/routes/diagrams/$id.tsx`, `src/routes/roadmaps/$id.tsx` — dock + toggle. **Edit.**
- No schema changes.

## Non-goals

- Global app-wide assistant (architecture accommodates it; not built now).
- Chat persistence / conversation history tables.
- Granular per-item roadmap tools.
- Chat on public share views.
- Image/file inputs, multi-document context, cross-tool actions ("make a diagram for this
  roadmap item") — all candidates for the global-assistant follow-up.
