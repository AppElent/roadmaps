# Roadmaps Phase 6 — Table & Filtering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A sortable table whose columns follow the custom fields, an expandable description row, and a filter bar that drives both the Timeline and Table tabs.

**Architecture:** Pure `filterItems`/`sortItems` in `src/lib/itemQuery.ts` (Vitest-covered) operate on items + filter state. `displayValue` in `src/lib/fields.ts` formats a value for a cell. `ItemTable` renders structural columns + `showInTable` fields, with click-to-edit and a toggle that expands the long description. The route gains Timeline/Table tabs and shared filter state.

**Tech Stack:** React, Convex `useQuery`, Lucide.

**Depends on:** Phases 0–5.

---

## File structure for this phase

- Create: `src/lib/itemQuery.ts` — `filterItems`, `sortItems`, `ItemFilter`, `SortState`
- Create: `src/lib/__tests__/itemQuery.test.ts`
- Modify: `src/lib/fields.ts` — add `displayValue`
- Modify: `src/lib/__tests__/fields.test.ts` — cover `displayValue`
- Create: `src/components/filters/FilterBar.tsx`
- Create: `src/components/table/ItemTable.tsx`
- Modify: `src/routes/roadmaps/$id.tsx` — view tabs + filter state
- Modify: `convex/roadmaps.ts` — add item counts to `list`

---

### Task 1: Filter & sort logic (TDD)

**Files:**
- Create: `src/lib/itemQuery.ts`
- Create: `src/lib/__tests__/itemQuery.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/itemQuery.test.ts`:

```ts
import { expect, test } from "vitest";
import type { Doc } from "@convex/_generated/dataModel";
import { filterItems, sortItems } from "../itemQuery";

const item = (over: Partial<Doc<"items">>): Doc<"items"> =>
	({
		_id: (over.title ?? "x") as unknown as Doc<"items">["_id"],
		_creationTime: 0,
		roadmapId: "r1" as Doc<"items">["roadmapId"],
		laneId: "lane_a" as Doc<"items">["laneId"],
		userId: "u",
		title: "Untitled",
		startDate: 0,
		endDate: 10,
		values: {},
		order: 0,
		...over,
	}) as Doc<"items">;

const items = [
	item({ title: "Alpha", laneId: "lane_a" as Doc<"items">["laneId"], startDate: 30, values: { status: "done" } }),
	item({ title: "Beta", laneId: "lane_b" as Doc<"items">["laneId"], startDate: 10, values: { status: "planned" } }),
	item({ title: "Gamma", laneId: "lane_a" as Doc<"items">["laneId"], startDate: 20, values: { status: "planned" } }),
];

test("filter by lane", () => {
	const out = filterItems(items, {
		search: "",
		laneId: "lane_a" as Doc<"items">["laneId"],
		fieldKey: null,
		optionId: "all",
	});
	expect(out.map((i) => i.title)).toEqual(["Alpha", "Gamma"]);
});

test("filter by a select field value", () => {
	const out = filterItems(items, {
		search: "",
		laneId: "all",
		fieldKey: "status",
		optionId: "planned",
	});
	expect(out.map((i) => i.title).sort()).toEqual(["Beta", "Gamma"]);
});

test("filter by search across title", () => {
	const out = filterItems(items, {
		search: "alph",
		laneId: "all",
		fieldKey: null,
		optionId: "all",
	});
	expect(out.map((i) => i.title)).toEqual(["Alpha"]);
});

test("sort by startDate ascending and descending", () => {
	const asc = sortItems(items, { key: "startDate", dir: 1 });
	expect(asc.map((i) => i.title)).toEqual(["Beta", "Gamma", "Alpha"]);
	const desc = sortItems(items, { key: "startDate", dir: -1 });
	expect(desc.map((i) => i.title)).toEqual(["Alpha", "Gamma", "Beta"]);
});

test("sort by title", () => {
	const out = sortItems(items, { key: "title", dir: 1 });
	expect(out.map((i) => i.title)).toEqual(["Alpha", "Beta", "Gamma"]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/__tests__/itemQuery.test.ts`
Expected: FAIL — cannot find `../itemQuery`.

- [ ] **Step 3: Implement `src/lib/itemQuery.ts`**

```ts
import type { Doc, Id } from "@convex/_generated/dataModel";

export interface ItemFilter {
	search: string;
	laneId: Id<"lanes"> | "all";
	fieldKey: string | null;
	optionId: string | "all";
}

export interface SortState {
	/** "title" | "startDate" | "endDate" | "laneId" | a field key */
	key: string;
	dir: 1 | -1;
}

function haystack(item: Doc<"items">): string {
	const values = Object.values(item.values)
		.flatMap((v) => (Array.isArray(v) ? v : [v]))
		.map((v) => String(v ?? ""));
	return [item.title, item.description ?? "", ...values].join(" ").toLowerCase();
}

export function filterItems(
	items: Doc<"items">[],
	filter: ItemFilter,
): Doc<"items">[] {
	const q = filter.search.trim().toLowerCase();
	return items.filter((item) => {
		if (filter.laneId !== "all" && item.laneId !== filter.laneId) return false;
		if (filter.fieldKey && filter.optionId !== "all") {
			const v = item.values[filter.fieldKey];
			const matches = Array.isArray(v)
				? v.includes(filter.optionId)
				: v === filter.optionId;
			if (!matches) return false;
		}
		if (q && !haystack(item).includes(q)) return false;
		return true;
	});
}

function sortKeyValue(item: Doc<"items">, key: string): string | number {
	if (key === "title") return item.title;
	if (key === "startDate") return item.startDate;
	if (key === "endDate") return item.endDate;
	if (key === "laneId") return item.laneId;
	const v = item.values[key];
	if (Array.isArray(v)) return v.join(",");
	if (v === null || v === undefined) return "";
	return v;
}

export function sortItems(
	items: Doc<"items">[],
	sort: SortState,
): Doc<"items">[] {
	return [...items].sort((a, b) => {
		const av = sortKeyValue(a, sort.key);
		const bv = sortKeyValue(b, sort.key);
		if (typeof av === "number" && typeof bv === "number") {
			return (av - bv) * sort.dir;
		}
		return String(av).localeCompare(String(bv)) * sort.dir;
	});
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/__tests__/itemQuery.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/itemQuery.ts src/lib/__tests__/itemQuery.test.ts
git commit -m "feat: item filter and sort logic"
```

---

### Task 2: displayValue helper (TDD)

**Files:**
- Modify: `src/lib/fields.ts`
- Modify: `src/lib/__tests__/fields.test.ts`

- [ ] **Step 1: Add failing test**

Append to `src/lib/__tests__/fields.test.ts`:

```ts
import { displayValue } from "../fields";

test("displayValue formats select labels and multiselect joins", () => {
	const select = field({});
	expect(displayValue(select, "done")).toBe("Done");
	const multi = field({ type: "multiselect" });
	expect(displayValue(multi, ["planned", "done"])).toBe("Planned, Done");
	const text = field({ type: "text", options: undefined });
	expect(displayValue(text, null)).toBe("");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/__tests__/fields.test.ts`
Expected: FAIL — `displayValue` not exported.

- [ ] **Step 3: Implement `displayValue` in `src/lib/fields.ts`**

Append:

```ts
import { msToDateInput as _msToDateInput } from "./fields";

export function displayValue(field: FieldDef, value: FieldValue): string {
	if (value === null || value === undefined || value === "") return "";
	if (field.type === "date" && typeof value === "number") {
		return msToDateInput(value);
	}
	const labelOf = (id: string) =>
		field.options?.find((o) => o.id === id)?.label ?? id;
	if (field.type === "select" && typeof value === "string") return labelOf(value);
	if (field.type === "multiselect" && Array.isArray(value)) {
		return value.map(labelOf).join(", ");
	}
	return String(value);
}
```

> Remove the self-import line if your linter flags it — `msToDateInput` is already in this module; call it directly. The import above is shown only to make the dependency explicit and should be deleted.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/__tests__/fields.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fields.ts src/lib/__tests__/fields.test.ts
git commit -m "feat: displayValue formatter for field values"
```

---

### Task 3: FilterBar

**Files:**
- Create: `src/components/filters/FilterBar.tsx`

- [ ] **Step 1: Implement**

```tsx
import type { Doc } from "@convex/_generated/dataModel";
import type { ItemFilter } from "@/lib/itemQuery";

export function FilterBar({
	lanes,
	fields,
	filter,
	onChange,
}: {
	lanes: Doc<"lanes">[];
	fields: Doc<"fields">[];
	filter: ItemFilter;
	onChange: (next: ItemFilter) => void;
}) {
	const selectFields = fields.filter(
		(f) => f.type === "select" || f.type === "multiselect",
	);
	const activeField = selectFields.find((f) => f.key === filter.fieldKey);
	const base = "rounded-md border border-neutral-200 px-2 py-2 text-sm";

	return (
		<div className="flex flex-wrap items-end gap-2 border-b border-neutral-200 bg-white p-3">
			<input
				className={`${base} min-w-48 flex-1`}
				placeholder="Search items"
				value={filter.search}
				onChange={(e) => onChange({ ...filter, search: e.target.value })}
			/>
			<select
				className={base}
				value={filter.laneId}
				onChange={(e) =>
					onChange({
						...filter,
						laneId: e.target.value as ItemFilter["laneId"],
					})
				}
			>
				<option value="all">All lanes</option>
				{lanes.map((l) => (
					<option key={l._id} value={l._id}>
						{l.name}
					</option>
				))}
			</select>
			<select
				className={base}
				value={filter.fieldKey ?? ""}
				onChange={(e) =>
					onChange({
						...filter,
						fieldKey: e.target.value || null,
						optionId: "all",
					})
				}
			>
				<option value="">No field filter</option>
				{selectFields.map((f) => (
					<option key={f._id} value={f.key}>
						{f.label}
					</option>
				))}
			</select>
			{activeField ? (
				<select
					className={base}
					value={filter.optionId}
					onChange={(e) => onChange({ ...filter, optionId: e.target.value })}
				>
					<option value="all">Any {activeField.label}</option>
					{(activeField.options ?? []).map((o) => (
						<option key={o.id} value={o.id}>
							{o.label}
						</option>
					))}
				</select>
			) : null}
			<button
				type="button"
				onClick={() =>
					onChange({ search: "", laneId: "all", fieldKey: null, optionId: "all" })
				}
				className="text-xs text-neutral-500"
			>
				Clear
			</button>
		</div>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/filters/FilterBar.tsx
git commit -m "feat: filter bar"
```

---

### Task 4: ItemTable

**Files:**
- Create: `src/components/table/ItemTable.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Doc } from "@convex/_generated/dataModel";
import { displayValue, msToDateInput } from "@/lib/fields";
import type { SortState } from "@/lib/itemQuery";

export function ItemTable({
	items,
	fields,
	lanes,
	sort,
	onSortChange,
	onSelect,
}: {
	items: Doc<"items">[];
	fields: Doc<"fields">[];
	lanes: Doc<"lanes">[];
	sort: SortState;
	onSortChange: (next: SortState) => void;
	onSelect: (id: Doc<"items">["_id"]) => void;
}) {
	const [expanded, setExpanded] = useState<Set<string>>(new Set());
	const tableFields = fields
		.filter((f) => f.showInTable)
		.sort((a, b) => a.order - b.order);
	const laneName = (id: Doc<"items">["laneId"]) =>
		lanes.find((l) => l._id === id)?.name ?? "";

	const toggleSort = (key: string) =>
		onSortChange({ key, dir: sort.key === key ? (sort.dir === 1 ? -1 : 1) : 1 });

	const Th = ({ k, label }: { k: string; label: string }) => (
		<th className="border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wide text-neutral-500">
			<button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1">
				{label}
				{sort.key === k ? <span>{sort.dir === 1 ? "▲" : "▼"}</span> : null}
			</button>
		</th>
	);

	const colCount = 4 + tableFields.length;

	return (
		<div className="overflow-auto rounded-lg border border-neutral-200 bg-white">
			<table className="w-full border-collapse text-sm">
				<thead>
					<tr>
						<th className="w-8 border-b border-neutral-200 bg-neutral-50" />
						<Th k="title" label="Item" />
						<Th k="laneId" label="Lane" />
						{tableFields.map((f) => (
							<Th key={f._id} k={f.key} label={f.label} />
						))}
						<Th k="startDate" label="Start" />
						<Th k="endDate" label="End" />
					</tr>
				</thead>
				<tbody>
					{items.map((item) => {
						const isOpen = expanded.has(item._id);
						return (
							<>
								<tr key={item._id} className="hover:bg-neutral-50">
									<td className="px-2">
										{item.description ? (
											<button
												type="button"
												aria-label="Toggle description"
												onClick={() =>
													setExpanded((prev) => {
														const next = new Set(prev);
														next.has(item._id)
															? next.delete(item._id)
															: next.add(item._id);
														return next;
													})
												}
											>
												{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
											</button>
										) : null}
									</td>
									<td className="border-b border-neutral-100 px-3 py-2">
										<button
											type="button"
											onClick={() => onSelect(item._id)}
											className="text-left font-medium hover:underline"
										>
											{item.title}
										</button>
									</td>
									<td className="border-b border-neutral-100 px-3 py-2">
										{laneName(item.laneId)}
									</td>
									{tableFields.map((f) => (
										<td key={f._id} className="border-b border-neutral-100 px-3 py-2">
											{displayValue(f, item.values[f.key] ?? null)}
										</td>
									))}
									<td className="border-b border-neutral-100 px-3 py-2 font-mono text-xs">
										{msToDateInput(item.startDate)}
									</td>
									<td className="border-b border-neutral-100 px-3 py-2 font-mono text-xs">
										{msToDateInput(item.endDate)}
									</td>
								</tr>
								{isOpen ? (
									<tr key={`${item._id}-desc`}>
										<td />
										<td
											colSpan={colCount - 1}
											className="border-b border-neutral-100 px-3 pb-3 text-sm text-neutral-600"
										>
											{item.description}
										</td>
									</tr>
								) : null}
							</>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
```

> Replace the `next.has(...) ? next.delete(...) : next.add(...)` expression-statement with an `if/else` if Biome's `noUnusedExpressions`/`useless` rules flag it; behavior is identical.

- [ ] **Step 2: Commit**

```bash
git add src/components/table/ItemTable.tsx
git commit -m "feat: sortable item table with expandable description"
```

---

### Task 5: View tabs + shared filter in the route

**Files:**
- Modify: `src/routes/roadmaps/$id.tsx`

- [ ] **Step 1: Add state, filter the items, render tabs**

Add imports:

```tsx
import { FilterBar } from "@/components/filters/FilterBar";
import { ItemTable } from "@/components/table/ItemTable";
import { filterItems, sortItems, type ItemFilter, type SortState } from "@/lib/itemQuery";
```

Inside `RoadmapEditor`, after the existing state hooks:

```tsx
const [view, setView] = useState<"timeline" | "table">("timeline");
const [filter, setFilter] = useState<ItemFilter>({
	search: "",
	laneId: "all",
	fieldKey: null,
	optionId: "all",
});
const [sort, setSort] = useState<SortState>({ key: "startDate", dir: 1 });
```

After computing `bundle`, derive the visible items:

```tsx
const visibleItems = sortItems(filterItems(bundle.items, filter), sort);
const visibleBundle = { ...bundle, items: visibleItems };
```

Add a tab switch in the header (next to `ZoomSwitch`):

```tsx
<div className="inline-flex overflow-hidden rounded-md border border-neutral-200">
	{(["timeline", "table"] as const).map((v) => (
		<button
			key={v}
			type="button"
			onClick={() => setView(v)}
			className={`border-r border-neutral-200 px-3 py-1.5 text-xs capitalize last:border-r-0 ${
				v === view ? "bg-neutral-100 text-neutral-900" : "text-neutral-500"
			}`}
		>
			{v}
		</button>
	))}
</div>
```

Render the filter bar and the active view:

```tsx
<div className="mb-3">
	<FilterBar
		lanes={bundle.lanes}
		fields={bundle.fields}
		filter={filter}
		onChange={setFilter}
	/>
</div>
{view === "timeline" ? (
	<TimelineView
		bundle={visibleBundle}
		zoom={activeZoom}
		onSelectItem={(itemId) => setEditing(itemId)}
		onItemDatesChange={(itemId, startDate, endDate) =>
			updateItem({ itemId, startDate, endDate })
		}
	/>
) : (
	<ItemTable
		items={visibleItems}
		fields={bundle.fields}
		lanes={bundle.lanes}
		sort={sort}
		onSortChange={setSort}
		onSelect={(itemId) => setEditing(itemId)}
	/>
)}
```

(Only show `ZoomSwitch` when `view === "timeline"`.)

- [ ] **Step 2: Verify manually**

Run: `npm run dev:all`. Toggle Timeline/Table. Filter by lane and by Status → both views update. Sort the table by clicking headers, including a custom field column. Expand a row with a description.

- [ ] **Step 3: Lint + commit**

```bash
npm run check
git add src/routes/roadmaps/$id.tsx
git commit -m "feat: timeline/table tabs with shared filtering"
```

---

### Task 6: Item counts on the dashboard

**Files:**
- Modify: `convex/roadmaps.ts`
- Modify: `src/routes/dashboard/index.tsx`

- [ ] **Step 1: Return counts from `list`**

Replace the `list` handler body in `convex/roadmaps.ts`:

```ts
handler: async (ctx) => {
	const userId = await requireUser(ctx);
	const roadmaps = await ctx.db
		.query("roadmaps")
		.withIndex("by_user_archived", (q) => q.eq("userId", userId).eq("archived", false))
		.collect();
	return await Promise.all(
		roadmaps.map(async (roadmap) => {
			const items = await ctx.db
				.query("items")
				.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmap._id))
				.collect();
			return { ...roadmap, itemCount: items.length };
		}),
	);
},
```

- [ ] **Step 2: Use the count in the dashboard**

In `src/routes/dashboard/index.tsx`, change `itemCount={0}` to `itemCount={r.itemCount}`.

- [ ] **Step 3: Run tests + lint + commit**

Run: `npm run test` (the existing roadmap tests still pass — `list` shape gained a field but tests don't assert on `list`).

```bash
npm run check
git add convex/roadmaps.ts src/routes/dashboard/index.tsx
git commit -m "feat: show item counts on dashboard"
```

---

## Self-review notes

- **Spec coverage:** sortable table with custom columns (§1, §5) ✓; filtering by lane/field/search across both views (§1) ✓; inline expandable description row (§1) ✓; tab switch Timeline/Table (§5 layout B) ✓.
- **Type consistency:** `ItemFilter`/`SortState` are shared by `FilterBar`, `ItemTable`, and the route. `displayValue` reuses `FieldDef`/`FieldValue` from `fields.ts`. Filtered items flow into `TimelineView` via `visibleBundle` (same `TimelineBundle` shape).
- **Note:** the self-import comment in Task 2 Step 3 is a documentation cue — the final code must call `msToDateInput` directly without re-importing it.
