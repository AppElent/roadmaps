# Roadmaps Phase 9 — Polish & Real-time Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the mockup's design language (green accent, mono micro-labels, light/dark) via theme tokens, replace ad-hoc neutral utilities with semantic classes, wire the theme toggle, and verify real-time end-to-end.

**Architecture:** Add roadmap tokens to `src/styles.css` (it already uses Tailwind v4 with `@custom-variant dark`). Introduce a few shared component classes (`.rm-btn-primary`, `.rm-panel`, `.rm-chip`) and swap the most-repeated utility clusters to them. Wire the existing `ThemeToggle`. Finish with multi-tab and signed-out real-time checks and a full test/lint/build gate.

**Tech Stack:** Tailwind CSS v4, CSS custom properties, existing `ThemeToggle`.

**Depends on:** Phases 0–8. `src/styles.css` is **excluded from Biome** — never add lint-disable comments there.

---

## File structure for this phase

- Modify: `src/styles.css` — roadmap tokens (light + dark) + component classes
- Modify: `src/components/Sidebar.tsx` — add `ThemeToggle`
- Modify (focused swaps): primary buttons + panels across `roadmaps/`, `panel/`, `timeline/`, `share/`, `io/`, `lanes/`, `fields/`
- No new tests; this phase is visual + verification

---

### Task 1: Add roadmap theme tokens

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Read the file first**

Open `src/styles.css`. Locate the existing `:root { … }` block (light tokens) and the `.dark { … }` block (dark overrides), and the `@theme inline` mapping. You will add to all three areas.

- [ ] **Step 2: Add roadmap tokens to `:root`**

Inside the existing `:root { … }`, append:

```css
	/* Roadmaps palette (adopt + refine the mockup) */
	--rm-accent: oklch(58% 0.16 145);
	--rm-accent-fg: oklch(99% 0 0);
	--rm-grid-line: oklch(90% 0.008 240);
	--rm-axis-fg: oklch(50% 0.018 240);
	--rm-panel: oklch(100% 0 0);
	--rm-panel-line: oklch(90% 0.008 240);
	--rm-bar-bg: oklch(100% 0 0);
```

- [ ] **Step 3: Add dark overrides to `.dark`**

Inside the existing `.dark { … }`, append:

```css
	--rm-accent: oklch(64% 0.15 145);
	--rm-accent-fg: oklch(18% 0.02 240);
	--rm-grid-line: oklch(30% 0.01 240);
	--rm-axis-fg: oklch(70% 0.02 240);
	--rm-panel: oklch(20% 0.012 250);
	--rm-panel-line: oklch(30% 0.01 240);
	--rm-bar-bg: oklch(26% 0.012 250);
```

- [ ] **Step 4: Add shared component classes**

Append a new block at the end of `src/styles.css`:

```css
@layer components {
	.rm-btn-primary {
		background: var(--rm-accent);
		color: var(--rm-accent-fg);
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		font-weight: 520;
	}
	.rm-btn-primary:hover {
		filter: brightness(0.96);
	}
	.rm-panel {
		background: var(--rm-panel);
		border: 1px solid var(--rm-panel-line);
		border-radius: 0.5rem;
	}
	.rm-label {
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--rm-axis-fg);
	}
}
```

- [ ] **Step 5: Verify the app still builds**

Run: `npm run dev` (boot, then stop). Expected: no CSS errors; pages render.

- [ ] **Step 6: Commit**

```bash
git add src/styles.css
git commit -m "feat: roadmap theme tokens and component classes"
```

---

### Task 2: Apply the accent and panel classes

**Files (focused swaps):**
- `src/components/roadmaps/CreateRoadmapDialog.tsx`
- `src/components/panel/ItemEditorPanel.tsx`
- `src/components/lanes/LaneManager.tsx`
- `src/components/fields/FieldManager.tsx`
- `src/components/share/ShareDialog.tsx`
- `src/components/io/ImportExportDialog.tsx`
- `src/routes/roadmaps/$id.tsx`
- `src/routes/dashboard/index.tsx`

- [ ] **Step 1: Swap primary buttons to `.rm-btn-primary`**

In each file above, replace the primary-button class cluster
`"… rounded-md bg-neutral-900 px-3 py-2 text-sm text-white"` (and the `py-1.5` variant)
with `"rm-btn-primary"` (keep any layout-only classes like `flex items-center gap-1`).

Example (dashboard "New roadmap" trigger in `CreateRoadmapDialog.tsx`):

```tsx
<Dialog.Trigger className="rm-btn-primary">New roadmap</Dialog.Trigger>
```

- [ ] **Step 2: Swap dialog/timeline panels to `.rm-panel`**

Replace the repeated `"… border border-neutral-200 bg-white …"` container cluster on the timeline wrapper (`TimelineView`'s outer `div`), the table wrapper (`ItemTable`), and each `Dialog.Content` card with `rm-panel` plus the remaining layout classes (padding, width, positioning). Keep `shadow-xl`/positioning utilities.

- [ ] **Step 3: Use `.rm-label` for the eyebrow/axis labels**

Replace the eyebrow `<p className="font-mono text-xs uppercase tracking-wide text-neutral-500">` clusters (dashboard, editor, share header) and the `TimeAxis` label class with `rm-label`.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run check`
Expected: no errors. (These swaps are class-string only; no logic changes.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "style: apply accent and panel classes"
```

---

### Task 3: Wire the theme toggle

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Add the existing ThemeToggle to the sidebar footer**

The scaffold ships `src/components/ThemeToggle.tsx` and the root already runs `THEME_INIT_SCRIPT` (toggles `.light`/`.dark` on `<html>`). Import and render it next to the `UserButton`:

```tsx
import ThemeToggle from "./ThemeToggle";
```

In the footer row:

```tsx
<div className="mt-auto flex items-center gap-2 px-1">
	<UserButton />
	<span className="rm-label">Account</span>
	<div className="ml-auto">
		<ThemeToggle />
	</div>
</div>
```

> If `ThemeToggle`'s export is named rather than default, adjust the import to match (`import { ThemeToggle } from "./ThemeToggle";`). Confirm by opening the file.

- [ ] **Step 2: Verify light/dark**

Run: `npm run dev:all`. Toggle the theme. Expected: timeline grid, panels, bars, and the accent flip cleanly between light and dark; no unreadable contrast.

- [ ] **Step 3: Commit**

```bash
npm run check
git add src/components/Sidebar.tsx
git commit -m "feat: theme toggle in sidebar"
```

---

### Task 4: Real-time and end-to-end verification

- [ ] **Step 1: Multi-tab real-time (owner)**

Run: `npm run dev:all`. Open the same roadmap in two browser tabs. In tab A: create an item, drag it, change its status, add a lane. Expected: every change appears in tab B within a moment, with no manual refresh.

- [ ] **Step 2: Share viewer real-time (signed out)**

Enable sharing, open the `share/$token` link in a private window (signed out). Edit the roadmap in the owner tab. Expected: the read-only share view updates live; the viewer cannot edit (no drag handles, item clicks are inert).

- [ ] **Step 3: Custom-field round trip**

Create a `select` field "Team" and a `text` field "Product Owner"; set the roadmap's color-by to a select field. Add items, set values, verify the table columns, filtering, bar colors, and the timeline reflect them. Export → import into a new roadmap → confirm fidelity.

- [ ] **Step 4: Full gate**

Run: `npm run test`
Expected: PASS — all suites (timeline, fields, itemQuery, roadmapIO, convex roadmaps/lanes/items/sharing, RoadmapCard).

Run: `npm run check`
Expected: no Biome errors.

Run: `npm run build`
Expected: production build succeeds.

- [ ] **Step 5: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final verification pass"
```

---

## Self-review notes

- **Spec coverage:** adopt-and-refine visual language with accent + mono labels (§7) ✓; light + dark via tokens and existing toggle (§7) ✓; real-time verified for owner multi-tab and signed-out share viewer (§6, §2) ✓; full MVP exercised end-to-end (§9 build order complete).
- **Scope discipline:** Task 2 swaps only the repeated primary-button / panel / label clusters — it does not restyle every element, keeping the change reviewable. Deeper visual refinement can follow once the MVP is in use.
- **Excluded files:** `src/styles.css` and `src/routeTree.gen.ts` stay out of Biome; no lint-disable comments added.
- **MVP complete** after this phase. Deferred to post-MVP (per spec §1): dependencies + arrows, member/role sharing, comments, image/PDF/CSV export, Recharts reporting, roadmap templates.
