# ArchStudio — Feature Opportunity Report

**Date:** 2026-07-08

---

## Overview

ArchStudio is your work tool — a multi-tool architect's workbench with two shipped tools (Roadmaps, Diagrams) and an AI helper planned. This report covers (1) what you've already discussed/deferred, (2) what comparable products offer, and (3) what I'd prioritize given how you use it.

## 1. What you've already put on the table

**Explicitly deferred at MVP time** (from the 2026-06-07 design spec):

| Feature | Status |
|---|---|
| Item dependencies + arrows | ✅ **Shipped** (visual-only edges, 2026-06-20 spec) |
| Member/role sharing | Still deferred — biggest remaining gap |
| Comments on items | Still deferred |
| Image / PDF / CSV export | Still deferred (only JSON export exists) |
| Recharts-based reporting | Still deferred |
| Roadmap templates | Still deferred |

**Planned next per your own notes:** the **Claude-powered AI helper** (spec "#4") — a chat panel docking into the diagram editor's flex row; integration points were deliberately left open.

**Known loose ends you accepted but never closed:**
- Diagram preview/error banner doesn't follow dark mode.
- `diagrams` has unused `archived` plumbing (hard delete, unlike roadmaps' soft archive).
- Dependencies are visual-only — no typed edges (FS/SS/FF/SF), no cross-roadmap links, no "violation" highlighting (all explicit non-goals at the time, but natural upgrades later).
- Deploy config: `deploy:preview` referenced a nonexistent `env.preview`; `scripts/deploy.mjs` is dead code (you declared package.json canonical, fix deferred).

## 2. What comparable products have that you don't

### Roadmap tools (ProductPlan, Roadmunk/Tempus, Aha!, airfocus)

- **Multiple views of the same data** — you have Timeline + Table; they add **swimlane-by-field** (group timeline by status/team, not just lanes), **portfolio roll-ups** (one master timeline combining several roadmaps), and **board/kanban** views.
- **Image/PDF export** — the single most-used feature in these tools, because the roadmap's job is to be pasted into a slide deck. You currently can't get a roadmap out of the app except as JSON or a live link.
- **Filtered/scoped share links** — share a view filtered to one lane/status, not the whole roadmap.
- **Prioritization scoring** (RICE/value-effort) — probably overkill for architecture roadmaps, low priority.
- **Progress/health on items** — % complete or R/A/G status rendered on the bar.
- **"Today" marker & horizon banding** — a now-line on the timeline; trivially cheap, high signal.
- **Integrations** (Jira/ADO sync) — big lift, only worth it if your initiatives live in a ticket system at work.

### Diagram tools (Mermaid Live, draw.io, Eraser, IcePanel, Structurizr)

- **Export to SVG/PNG** — same slide-deck story; you render SVG already, you just don't offer a download button.
- **Multi-diagram documents / folders & tags** — organization beyond a flat list.
- **Embeddable share** (iframe/`<img>` URL of the live diagram) — lets Confluence/Notion pages stay current.
- **More engines via Kroki** — you built the registry + Kroki pipeline precisely so this is cheap: **Structurizr/C4, D2, Graphviz, Excalidraw, BPMN** are one schema literal + registry entry each. For an architect, **C4/Structurizr and D2 are the standouts**.
- **Diagram templates/snippets** — starter sources per type (C4 context, sequence, ERD).
- **Diff between versions** — you store versions; showing a source diff (CodeMirror merge view) is a modest add.

### Cross-cutting (Notion, Confluence, most SaaS)

- Comments/annotations, global search across tools, keyboard palette (⌘K), activity history, workspace-level organization (projects/folders that group a roadmap *and* its diagrams).

## 3. What you actually need (prioritized for a work tool)

### Tier 1 — do these; they compound with how you already work

1. **PNG/SVG/PDF export for both tools.** As a working architect, the artifact you hand to stakeholders is a picture in a deck or doc. This is the highest-leverage gap. Timeline is DOM-rendered so it needs an SVG-serialization or html-to-image pass; diagrams are already SVG — that half is nearly free.

2. **The AI helper — but scoped to diagrams first**, as you already planned. "Describe the system, get Mermaid/PlantUML" and "explain/modify this diagram" are the highest-value AI features and your editor architecture already left the docking point open. A Convex action calling the Claude API keeps the key server-side.

3. **More Kroki engines: C4/Structurizr, D2, Graphviz.** Cheapest feature on this list relative to value — your own registry design makes each one a small PR. C4 in particular is *the* architect's diagram language.

4. **Today marker + "fit to window" on the timeline.** Tiny, and every roadmap conversation starts with "where are we now."

### Tier 2 — real value, moderate effort

5. **Roadmap ↔ diagram linking (a "project" grouping).** This is where ArchStudio becomes more than two tools in a shell: attach diagrams to a roadmap item ("this initiative's target architecture"), or a workspace folder holding both. No competitor in either category does this well — it's your differentiator.

6. **Group-timeline-by-field** (swimlanes by status/any select field) — you get this almost free since `itemQuery.ts` already isolates the logic.

7. **Item progress/health field rendered on bars** — a built-in % or R/A/G that shows on the timeline, since status colors already flow through `colorByFieldKey`.

8. **Roadmap templates** (already on your deferred list) — "duplicate as template" is 80% of it and duplication logic exists.

9. **Version diff view** for diagrams (and roadmap snapshots).

### Tier 3 — only when the trigger arrives

10. **Member/role sharing + comments.** Deferred for good reason: you're the only editor today. The moment a colleague needs to *edit* rather than view, this jumps to Tier 1 — Clerk organizations give you the membership model, and every Convex function already funnels through `requireRoadmapOwner`, so there's a single choke point to generalize.

11. **CSV export / Jira import** — if your work initiatives live in Jira/ADO, a one-way import beats full sync.

12. **Typed/cross-roadmap dependencies, scheduling enforcement** — skip unless you feel the pain; your visual-only decision was right.

### Also worth clearing (hygiene, from your own review backlog)

- Diagram dark-mode preview
- Diagrams soft-archive parity
- Broken `deploy:preview`/`deploy.mjs` reconciliation

---

## Sequencing recommendation

The theme across everything is *getting work out of the app* — exports, AI-assisted authoring, and richer architect-specific diagram languages — plus one differentiator nobody else has: linking roadmap initiatives to the architecture diagrams that realize them.

**Suggested sequence:**
1. **Exports** (PNG/SVG/PDF) → most immediate ROI
2. **C4/D2 engines** → amplify diagram tool utility
3. **AI helper** → planned already; docks easily
4. **Roadmap-diagram linking** → your unique advantage
