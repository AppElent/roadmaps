# Roadmaps Phase 4 — Custom Fields & Item Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate custom-field values from a single source of truth, render the right input per field type, and create/edit items through a slide-over editor.

**Architecture:** `src/lib/fields.ts` turns a roadmap's field definitions into per-field Zod schemas and a `validateValues` function (the single validation source used by the editor before every write). `FieldValueInput` renders the correct control per field type. `ItemEditorPanel` is a slide-over composing structural inputs (title, lane, dates, description) + dynamic custom fields, calling `items.create`/`items.update`/`items.remove`.

**Tech Stack:** Zod, React, Convex `useMutation`, date-fns, Lucide.

**Depends on:** Phases 0–3.

---

## File structure for this phase

- Create: `src/lib/fields.ts` — `validateValues`, `emptyValue`, date helpers
- Create: `src/lib/__tests__/fields.test.ts`
- Create: `src/components/fields/FieldValueInput.tsx`
- Create: `src/components/panel/ItemEditorPanel.tsx`
- Modify: `src/routes/roadmaps/$id.tsx` — selection state + "New item" + render panel

---

### Task 1: Field validation module (TDD)

**Files:**
- Create: `src/lib/fields.ts`
- Create: `src/lib/__tests__/fields.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/fields.test.ts`:

```ts
import { expect, test } from "vitest";
import { emptyValue, validateValues, type FieldDef } from "../fields";

const field = (over: Partial<FieldDef>): FieldDef =>
	({
		_id: "f1" as FieldDef["_id"],
		_creationTime: 0,
		roadmapId: "r1" as FieldDef["roadmapId"],
		userId: "u1",
		key: "status",
		label: "Status",
		type: "select",
		options: [
			{ id: "planned", label: "Planned", color: "#000" },
			{ id: "done", label: "Done", color: "#0f0" },
		],
		order: 0,
		showInTable: true,
		...over,
	}) as FieldDef;

test("select accepts a known option id and rejects an unknown one", () => {
	const fields = [field({})];
	expect(validateValues(fields, { status: "done" })).toEqual({ status: "done" });
	expect(() => validateValues(fields, { status: "nope" })).toThrow();
});

test("number rejects non-numeric values", () => {
	const fields = [field({ key: "score", type: "number", options: undefined })];
	expect(validateValues(fields, { score: 42 })).toEqual({ score: 42 });
	expect(() => validateValues(fields, { score: "high" })).toThrow();
});

test("multiselect validates each id and passes arrays through", () => {
	const fields = [field({ key: "tags", type: "multiselect" })];
	expect(validateValues(fields, { tags: ["planned", "done"] })).toEqual({
		tags: ["planned", "done"],
	});
	expect(() => validateValues(fields, { tags: ["planned", "x"] })).toThrow();
});

test("missing, null, and empty-string values are omitted, unknown keys dropped", () => {
	const fields = [field({ key: "note", type: "text", options: undefined })];
	expect(validateValues(fields, { note: "", extra: "ignored" })).toEqual({});
});

test("emptyValue returns [] for multiselect and null otherwise", () => {
	expect(emptyValue(field({ type: "multiselect" }))).toEqual([]);
	expect(emptyValue(field({ type: "text", options: undefined }))).toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/__tests__/fields.test.ts`
Expected: FAIL — cannot find `../fields`.

- [ ] **Step 3: Implement `src/lib/fields.ts`**

```ts
import { z } from "zod";
import type { Doc } from "@convex/_generated/dataModel";

export type FieldDef = Doc<"fields">;
export type FieldValue = string | number | string[] | null;

function optionIds(field: FieldDef): string[] {
	return (field.options ?? []).map((o) => o.id);
}

function schemaForField(field: FieldDef): z.ZodTypeAny {
	switch (field.type) {
		case "text":
			return z.string();
		case "number":
			return z.number();
		case "date":
			return z.number();
		case "select": {
			const ids = optionIds(field);
			return z
				.string()
				.refine((v) => ids.includes(v), `Invalid option for ${field.label}`);
		}
		case "multiselect": {
			const ids = optionIds(field);
			return z.array(
				z
					.string()
					.refine((v) => ids.includes(v), `Invalid option for ${field.label}`),
			);
		}
	}
}

/** Validates and cleans an item's custom values against the roadmap's fields. */
export function validateValues(
	fields: FieldDef[],
	values: Record<string, unknown>,
): Record<string, FieldValue> {
	const out: Record<string, FieldValue> = {};
	for (const field of fields) {
		const raw = values[field.key];
		if (raw === undefined || raw === null || raw === "") continue;
		out[field.key] = schemaForField(field).parse(raw) as FieldValue;
	}
	return out;
}

export function emptyValue(field: FieldDef): FieldValue {
	return field.type === "multiselect" ? [] : null;
}

/** ms timestamp -> "yyyy-MM-dd" for <input type="date">. */
export function msToDateInput(ms: number): string {
	const d = new Date(ms);
	const p = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "yyyy-MM-dd" -> ms timestamp (local midnight). */
export function dateInputToMs(value: string): number {
	const [y, m, d] = value.split("-").map(Number);
	return new Date(y, m - 1, d).getTime();
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/__tests__/fields.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fields.ts src/lib/__tests__/fields.test.ts
git commit -m "feat: dynamic field validation from definitions"
```

---

### Task 2: FieldValueInput

**Files:**
- Create: `src/components/fields/FieldValueInput.tsx`

- [ ] **Step 1: Implement**

```tsx
import type { FieldDef, FieldValue } from "@/lib/fields";
import { dateInputToMs, msToDateInput } from "@/lib/fields";

export function FieldValueInput({
	field,
	value,
	onChange,
}: {
	field: FieldDef;
	value: FieldValue;
	onChange: (next: FieldValue) => void;
}) {
	const base =
		"w-full rounded-md border border-neutral-200 px-2 py-2 text-sm";

	if (field.type === "text") {
		return (
			<input
				className={base}
				value={typeof value === "string" ? value : ""}
				onChange={(e) => onChange(e.target.value || null)}
			/>
		);
	}
	if (field.type === "number") {
		return (
			<input
				type="number"
				className={base}
				value={typeof value === "number" ? value : ""}
				onChange={(e) =>
					onChange(e.target.value === "" ? null : Number(e.target.value))
				}
			/>
		);
	}
	if (field.type === "date") {
		return (
			<input
				type="date"
				className={base}
				value={typeof value === "number" ? msToDateInput(value) : ""}
				onChange={(e) =>
					onChange(e.target.value ? dateInputToMs(e.target.value) : null)
				}
			/>
		);
	}
	if (field.type === "select") {
		return (
			<select
				className={base}
				value={typeof value === "string" ? value : ""}
				onChange={(e) => onChange(e.target.value || null)}
			>
				<option value="">—</option>
				{(field.options ?? []).map((o) => (
					<option key={o.id} value={o.id}>
						{o.label}
					</option>
				))}
			</select>
		);
	}
	// multiselect
	const selected = Array.isArray(value) ? value : [];
	return (
		<div className="flex flex-wrap gap-1">
			{(field.options ?? []).map((o) => {
				const on = selected.includes(o.id);
				return (
					<button
						key={o.id}
						type="button"
						onClick={() =>
							onChange(
								on ? selected.filter((id) => id !== o.id) : [...selected, o.id],
							)
						}
						style={{ borderColor: o.color }}
						className={`rounded-full border px-2 py-0.5 text-xs ${
							on ? "bg-neutral-100" : "opacity-60"
						}`}
					>
						{o.label}
					</button>
				);
			})}
		</div>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/fields/FieldValueInput.tsx
git commit -m "feat: per-type custom field input"
```

---

### Task 3: ItemEditorPanel slide-over

**Files:**
- Create: `src/components/panel/ItemEditorPanel.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { Trash2, X } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { FieldValueInput } from "@/components/fields/FieldValueInput";
import {
	dateInputToMs,
	emptyValue,
	msToDateInput,
	validateValues,
	type FieldValue,
} from "@/lib/fields";

type ItemDraft = {
	title: string;
	laneId: Id<"lanes">;
	startMs: number;
	endMs: number;
	description: string;
	values: Record<string, FieldValue>;
};

function draftFromItem(
	item: Doc<"items"> | null,
	fields: Doc<"fields">[],
	defaultLaneId: Id<"lanes">,
	windowStart: number,
): ItemDraft {
	if (item) {
		return {
			title: item.title,
			laneId: item.laneId,
			startMs: item.startDate,
			endMs: item.endDate,
			description: item.description ?? "",
			values: { ...item.values },
		};
	}
	const values: Record<string, FieldValue> = {};
	for (const f of fields) values[f.key] = emptyValue(f);
	const day = 24 * 60 * 60 * 1000;
	return {
		title: "",
		laneId: defaultLaneId,
		startMs: windowStart,
		endMs: windowStart + 30 * day,
		description: "",
		values,
	};
}

export function ItemEditorPanel({
	roadmapId,
	item,
	fields,
	lanes,
	windowStart,
	onClose,
}: {
	roadmapId: Id<"roadmaps">;
	item: Doc<"items"> | null;
	fields: Doc<"fields">[];
	lanes: Doc<"lanes">[];
	windowStart: number;
	onClose: () => void;
}) {
	const createItem = useMutation(api.items.create);
	const updateItem = useMutation(api.items.update);
	const removeItem = useMutation(api.items.remove);
	const [draft, setDraft] = useState<ItemDraft>(() =>
		draftFromItem(item, fields, lanes[0]._id, windowStart),
	);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setDraft(draftFromItem(item, fields, lanes[0]._id, windowStart));
		setError(null);
	}, [item, fields, lanes, windowStart]);

	async function save() {
		setError(null);
		let cleanValues: Record<string, FieldValue>;
		try {
			cleanValues = validateValues(fields, draft.values);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Invalid field value");
			return;
		}
		if (!draft.title.trim()) {
			setError("Title is required");
			return;
		}
		if (draft.endMs <= draft.startMs) {
			setError("End must be after start");
			return;
		}
		const payload = {
			title: draft.title.trim(),
			laneId: draft.laneId,
			startDate: draft.startMs,
			endDate: draft.endMs,
			description: draft.description || undefined,
			values: cleanValues,
		};
		if (item) {
			await updateItem({ itemId: item._id, ...payload });
		} else {
			await createItem({ roadmapId, ...payload });
		}
		onClose();
	}

	const set = <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) =>
		setDraft((d) => ({ ...d, [key]: value }));

	return (
		<div className="fixed inset-y-0 right-0 z-40 flex w-[min(420px,100vw)] flex-col border-l border-neutral-200 bg-white shadow-xl sm:inset-y-0">
			<div className="flex items-center justify-between border-b border-neutral-200 p-4">
				<h2 className="text-sm font-semibold">
					{item ? "Edit item" : "New item"}
				</h2>
				<button type="button" onClick={onClose} aria-label="Close">
					<X size={18} />
				</button>
			</div>

			<div className="flex-1 space-y-3 overflow-auto p-4">
				<label className="block text-sm">
					Title
					<input
						className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-2"
						value={draft.title}
						onChange={(e) => set("title", e.target.value)}
					/>
				</label>

				<label className="block text-sm">
					Lane
					<select
						className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-2"
						value={draft.laneId}
						onChange={(e) => set("laneId", e.target.value as Id<"lanes">)}
					>
						{lanes.map((l) => (
							<option key={l._id} value={l._id}>
								{l.name}
							</option>
						))}
					</select>
				</label>

				<div className="grid grid-cols-2 gap-2">
					<label className="block text-sm">
						Start
						<input
							type="date"
							className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-2"
							value={msToDateInput(draft.startMs)}
							onChange={(e) => set("startMs", dateInputToMs(e.target.value))}
						/>
					</label>
					<label className="block text-sm">
						End
						<input
							type="date"
							className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-2"
							value={msToDateInput(draft.endMs)}
							onChange={(e) => set("endMs", dateInputToMs(e.target.value))}
						/>
					</label>
				</div>

				{fields.map((f) => (
					<label key={f._id} className="block text-sm">
						{f.label}
						<div className="mt-1">
							<FieldValueInput
								field={f}
								value={draft.values[f.key] ?? emptyValue(f)}
								onChange={(next) =>
									setDraft((d) => ({
										...d,
										values: { ...d.values, [f.key]: next },
									}))
								}
							/>
						</div>
					</label>
				))}

				<label className="block text-sm">
					Description
					<textarea
						className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-2"
						rows={4}
						value={draft.description}
						onChange={(e) => set("description", e.target.value)}
					/>
				</label>

				{error ? <p className="text-xs text-red-600">{error}</p> : null}
			</div>

			<div className="flex items-center justify-between border-t border-neutral-200 p-4">
				{item ? (
					<button
						type="button"
						onClick={async () => {
							await removeItem({ itemId: item._id });
							onClose();
						}}
						className="flex items-center gap-1 text-xs text-red-600"
					>
						<Trash2 size={14} /> Delete
					</button>
				) : (
					<span />
				)}
				<button
					type="button"
					onClick={save}
					className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white"
				>
					{item ? "Save" : "Create"}
				</button>
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/panel/ItemEditorPanel.tsx
git commit -m "feat: slide-over item editor panel"
```

---

### Task 4: Wire selection + creation into the route

**Files:**
- Modify: `src/routes/roadmaps/$id.tsx`

- [ ] **Step 1: Add panel state and the New-item button**

Update `RoadmapEditor` so it tracks an editor target (`"new"`, an item id, or `null`), passes `onSelectItem` to the timeline, and renders the panel. Replace the component body with:

```tsx
function RoadmapEditor() {
	const { id } = Route.useParams();
	const roadmapId = id as Id<"roadmaps">;
	const bundle = useQuery(api.roadmaps.getBundle, { roadmapId });
	const [zoom, setZoom] = useState<Zoom | null>(null);
	const [editing, setEditing] = useState<"new" | Id<"items"> | null>(null);

	if (bundle === undefined) {
		return (
			<AppShell>
				<p className="p-6 text-sm text-neutral-500">Loading…</p>
			</AppShell>
		);
	}

	const activeZoom: Zoom = zoom ?? bundle.roadmap.defaultZoom;
	const periodsStart = bundle.roadmap.startDate;
	const editingItem =
		editing && editing !== "new"
			? (bundle.items.find((i) => i._id === editing) ?? null)
			: null;

	return (
		<AppShell>
			<div className="p-6">
				<header className="mb-4 flex items-center justify-between">
					<div>
						<p className="font-mono text-xs uppercase tracking-wide text-neutral-500">
							Roadmap
						</p>
						<h1 className="text-2xl font-semibold">{bundle.roadmap.name}</h1>
					</div>
					<div className="flex items-center gap-2">
						<ZoomSwitch value={activeZoom} onChange={setZoom} />
						<button
							type="button"
							onClick={() => setEditing("new")}
							className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white"
						>
							New item
						</button>
					</div>
				</header>
				<TimelineView
					bundle={bundle}
					zoom={activeZoom}
					onSelectItem={(itemId) => setEditing(itemId)}
				/>
			</div>

			{editing !== null ? (
				<ItemEditorPanel
					roadmapId={roadmapId}
					item={editingItem}
					fields={bundle.fields}
					lanes={bundle.lanes}
					windowStart={periodsStart}
					onClose={() => setEditing(null)}
				/>
			) : null}
		</AppShell>
	);
}
```

Add the imports at the top:

```tsx
import { ItemEditorPanel } from "@/components/panel/ItemEditorPanel";
```

- [ ] **Step 2: Verify manually**

Run: `npm run dev:all`. Click "New item" → panel opens → fill title, lane, dates, status → Create → bar appears in real time. Click an existing bar → panel pre-fills → edit status → bar color updates → Save. Delete removes the bar.

- [ ] **Step 3: Lint + commit**

```bash
npm run check
git add src/routes/roadmaps/$id.tsx
git commit -m "feat: create and edit items via slide-over"
```

---

## Self-review notes

- **Spec coverage:** `src/lib/fields.ts` dynamic Zod validation (§3, §5) ✓; `FieldValueInput` shared control (§5) ✓; slide-over editor with dynamic fields (§5) ✓; create/edit/delete items (§4) ✓.
- **Type consistency:** `validateValues(fields, values)` is called in the panel before every write, matching the backend's stored `values` shape. `FieldValue` is the same union used in the timeline color helper. Date inputs convert via `msToDateInput`/`dateInputToMs` consistently.
- **Deferred:** drag/resize on bars and lane/field management UIs are Phase 5; the inline expandable description row is Phase 6 (table) / can also appear under bars — see Phase 6 self-review.
