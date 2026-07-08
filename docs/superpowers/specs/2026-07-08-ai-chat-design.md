# AI Chat (Diagrams + Roadmaps) — Design

**Date:** 2026-07-08
**Status:** Approved (brainstorming)

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
  Roadmap writes flow through the existing JSON-import path (`saveVersion` +
  `applySnapshot` in `convex/lib/snapshot.ts`), which already auto-versions and remaps
  internal references atomically. Granular per-item tools are a possible later addition
  inside the same architecture, not part of this spec.
- **Persistence:** chat is **ephemeral** — message state lives in React while the editor is
  open; refresh starts fresh. No new tables. The AI's *changes* persist as documents +
  versions.
- **Backend:** **Convex `httpAction` with SSE streaming** (Approach B). The agent loop runs
  server-side in Convex; text deltas stream to the client. A non-streaming plain action is
  the acknowledged fallback if streaming plumbing fights us — same loop, same tools.

## Architecture

```
ChatPanel (React, ephemeral message state)
   │  fetch POST {convex-site-url}/ai/chat   (Clerk JWT in Authorization header)
   ▼
Convex httpAction (convex/http.ts → convex/ai/chat.ts)
   │  ctx.auth.getUserIdentity() → userId (same Clerk issuer config as all functions)
   │  Anthropic tool-use loop (key: Convex env ANTHROPIC_API_KEY)
   │
   ├─ tool read_document  → adapter.read  → ctx.runQuery   (ownership enforced)
   ├─ tool write_document → adapter.write → ctx.runMutation (auto-version, then apply)
   ▼
SSE response stream: text deltas + tool events → ChatPanel
Document writes land via existing live subscriptions → editor updates in real time
```

**Request payload:** `{ docRef: { kind: "roadmap" | "diagram", id }, messages: [...] }`.
The client holds and resends the conversation history (ephemeral chat, stateless server).

**Document adapter registry** (the "designed for global" seam): a map keyed by document
kind, each entry providing `read(ctx, id, userId)` and `write(ctx, id, userId, doc)` plus a
document-schema description for the system prompt. This phase registers `roadmap` and
`diagram` and pins the loop to the single `docRef` document — no list/create/open tools. A
future global assistant adds those tools to the same registry without reworking the loop.

- `roadmap.read` → snapshot via the capture logic in `convex/lib/snapshot.ts`;
  `roadmap.write` → auto-version (`"Before AI edit"`, kind `auto`) + `applySnapshot`.
- `diagram.read` → `{ title, type, source }`; `diagram.write` → auto-version via the
  diagram version machinery, then update.
- **Date transform:** roadmap snapshots store ms epochs; the adapter converts
  ms ↔ `"YYYY-MM-DD"` strings in both directions so the model reads and writes calendar
  dates, never timestamps. Pure module, unit-tested.

**Anthropic client:** `@anthropic-ai/sdk` (fetch-based, works in Convex's default runtime;
`httpAction` cannot use the Node runtime). If the SDK trips on the runtime, fall back to
raw `fetch` against the Messages API — the loop is small. Model: `claude-sonnet-5`,
overridable via Convex env `ANTHROPIC_MODEL`. Key set with
`pnpm exec convex env set ANTHROPIC_API_KEY ...` (plus a preview-deployment default) —
never in the repo.

**System prompt** is composed per document kind: diagram prompts include the engine type
and syntax guidance (Mermaid vs PlantUML); roadmap prompts include the JSON document schema
description (with ISO dates and the lane-index convention) and today's date.

**CORS:** the HTTP action answers preflight and sets `Access-Control-Allow-Origin` for the
app origins (localhost:3000 dev, deployed domain(s)).

## Frontend

- **`src/components/ai/ChatPanel.tsx`** — one shared panel taking
  `docRef: { kind, id }`. Docking:
  - Diagram editor: the third, toggleable right-hand panel in the split-view flex row
    (exactly the slot Spec B reserved).
  - Roadmap editor: same panel as a right-hand dock in `src/routes/roadmaps/$id.tsx`
    (slide-in alongside timeline/table, like `ItemEditorPanel`).
  - Toggle: Sparkles icon button in each editor toolbar.
- **`src/hooks/useAiChat.ts`** — ephemeral state (message list, streaming flag,
  `AbortController` for a Stop button). Fetches the HTTP action on the deployment's
  `.convex.site` URL (derived from `VITE_CONVEX_URL`), attaching the Clerk JWT from
  `getToken({ template: "convex" })`, and folds SSE events into the last message.
- **Tool events render as chips**, not JSON — "📖 Read roadmap", "✏️ Updated diagram (version
  checkpoint created)". Because writes arrive through the live subscription, the document
  visibly changes next to the chat.
- Enter sends; Shift+Enter newline; input disabled while streaming.
- Share routes get **no chat** — authed editors only.
- Styling: existing tokens/classes (`rm-*`, `cn()`), Radix primitives, Lucide icons.

## Safety

- **Ownership:** the HTTP action resolves `userId` from the Clerk JWT; every adapter
  read/write goes through Convex functions that enforce owner checks
  (`requireRoadmapOwner` / diagram equivalent). The loop can only touch the pinned document.
- **Auto-version before every AI write.** Same recoverability as JSON import. Accepted
  consequence: the 25-version cap means a long editing session prunes oldest versions —
  same policy as today.
- **Validation errors return to the model as tool results**, so it self-corrects: structure
  via the snapshot validator, plus adapter checks — `values` keys must match field
  definitions (mirroring `validateValues`), select values among options, lane indexes in
  range, `startDate ≤ endDate`. The user never sees a raw validation stack.
- **Loop cap:** 8 tool-use iterations per request; `max_tokens` capped.
- **Size guard:** documents over 100 KB serialized get a clear "too large for AI editing"
  refusal instead of silent truncation.

## Error handling

- API failures / mid-stream drops → SSE `error` event → inline red message with retry;
  client-held history means nothing is lost.
- Stop button aborts the fetch; UI notes an in-flight write may still land (the version
  checkpoint covers recovery).

## Testing

- **Pure units** (primary surface, per project convention): ms↔`YYYY-MM-DD` round-trip;
  roadmap doc validation (bad lane index, unknown field key, reversed dates); SSE frame
  encode/parse.
- **`convex-test`:** adapter read returns the snapshot shape; write creates the
  auto-version then applies; non-owner rejected.
- **Agent loop** with a mocked Anthropic client: tool dispatch, self-correction after a
  tool error, iteration cap honored.
- **ChatPanel** jsdom smoke test: renders messages, disables input while streaming.

## Dependencies (new)

`@anthropic-ai/sdk` (or none, if the raw-fetch fallback is used).

## Files

- `convex/http.ts` — HTTP router, `POST /ai/chat` (+ CORS preflight). **New.**
- `convex/ai/chat.ts` — httpAction handler, agent loop, SSE framing. **New.**
- `convex/ai/adapters.ts` — document adapter registry + backing internal query/mutation
  per kind. **New.**
- `convex/lib/aiDoc.ts` — date transform + roadmap doc validation (pure). **New.**
- `src/components/ai/ChatPanel.tsx`, `src/hooks/useAiChat.ts` — panel + hook. **New.**
- `src/lib/sse.ts` — SSE event parsing (pure, tested). **New.**
- `src/routes/diagrams/$id.tsx`, `src/routes/roadmaps/$id.tsx` — dock + toggle. **Edit.**
- No schema changes.

## Non-goals

- Global app-wide assistant (architecture accommodates it; not built now).
- Chat persistence / conversation history tables.
- Granular per-item roadmap tools.
- Chat on public share views.
- Image/file inputs, multi-document context, cross-tool actions ("make a diagram for this
  roadmap item") — all candidates for the global-assistant follow-up.
