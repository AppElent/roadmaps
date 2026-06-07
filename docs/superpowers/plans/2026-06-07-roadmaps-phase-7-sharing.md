# Roadmaps Phase 7 — Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owners can publish a roadmap as a read-only link; anyone with the link sees a live, view-only timeline/table without signing in.

**Architecture:** Extract the bundle loader into `convex/lib/bundle.ts` (shared by `getBundle` and the public query). `sharing.getPublicRoadmap({ shareToken })` is a **public** query (no `requireUser`) that returns the bundle only when `visibility === "link"`. A standalone `share/$token` route (outside `AppShell`) renders the read-only view. `ShareDialog` toggles sharing and copies the link.

**Tech Stack:** Convex public query, TanStack Router, `radix-ui` Dialog.

**Depends on:** Phases 0–6.

---

## File structure for this phase

- Create: `convex/lib/bundle.ts` — `loadRoadmapChildren`
- Modify: `convex/roadmaps.ts` — use the shared loader
- Create: `convex/sharing.ts` — `getPublicRoadmap`
- Create: `convex/sharing.test.ts` — public-read guard tests
- Create: `src/components/share/ReadOnlyRoadmap.tsx` — shared read-only renderer
- Create: `src/routes/share/$token.tsx` — public route
- Create: `src/components/share/ShareDialog.tsx`
- Modify: `src/routes/roadmaps/$id.tsx` — "Share" button

---

### Task 1: Extract the bundle loader

**Files:**
- Create: `convex/lib/bundle.ts`
- Modify: `convex/roadmaps.ts`

- [ ] **Step 1: Create `convex/lib/bundle.ts`**

```ts
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

const byOrder = <T extends { order: number }>(rows: T[]): T[] =>
	[...rows].sort((a, b) => a.order - b.order);

export async function loadRoadmapChildren(
	ctx: QueryCtx | MutationCtx,
	roadmapId: Id<"roadmaps">,
) {
	const [fields, lanes, items, milestones] = await Promise.all([
		ctx.db.query("fields").withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmapId)).collect(),
		ctx.db.query("lanes").withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmapId)).collect(),
		ctx.db.query("items").withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmapId)).collect(),
		ctx.db.query("milestones").withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmapId)).collect(),
	]);
	return {
		fields: byOrder(fields),
		lanes: byOrder(lanes),
		items: byOrder(items),
		milestones,
	};
}
```

- [ ] **Step 2: Use it in `convex/roadmaps.ts`**

In `convex/roadmaps.ts`, delete the local `byOrder` and `loadChildren` definitions and `import { loadRoadmapChildren } from "./lib/bundle";`. Replace the two call sites (`getBundle` and `duplicate`) that used `loadChildren(ctx, …)` with `loadRoadmapChildren(ctx, …)`.

- [ ] **Step 3: Verify existing tests still pass**

Run: `npm run test`
Expected: PASS — roadmap/lane/item tests unaffected (same returned shape).

- [ ] **Step 4: Commit**

```bash
git add convex/lib/bundle.ts convex/roadmaps.ts
git commit -m "refactor: share roadmap bundle loader"
```

---

### Task 2: Public share query (TDD)

**Files:**
- Create: `convex/sharing.ts`
- Create: `convex/sharing.test.ts`

- [ ] **Step 1: Write failing tests**

Create `convex/sharing.test.ts`:

```ts
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("getPublicRoadmap returns the bundle for a shared token, no auth required", async () => {
	const t = convexTest(schema, modules);
	const asAlex = t.withIdentity({ subject: "user_alex" });
	const roadmapId = await asAlex.mutation(api.roadmaps.create, {
		name: "Public",
		startDate: 0,
		endDate: 1000,
	});
	const token = await asAlex.mutation(api.roadmaps.enableShare, { roadmapId });
	// No identity on this call — simulates an anonymous visitor.
	const bundle = await t.query(api.sharing.getPublicRoadmap, { shareToken: token });
	expect(bundle?.roadmap.name).toBe("Public");
	expect(bundle?.lanes.length).toBe(1);
});

test("getPublicRoadmap returns null for a private roadmap or wrong token", async () => {
	const t = convexTest(schema, modules);
	const asAlex = t.withIdentity({ subject: "user_alex" });
	const roadmapId = await asAlex.mutation(api.roadmaps.create, {
		name: "Private",
		startDate: 0,
		endDate: 1000,
	});
	const token = await asAlex.mutation(api.roadmaps.enableShare, { roadmapId });
	await asAlex.mutation(api.roadmaps.disableShare, { roadmapId });
	expect(await t.query(api.sharing.getPublicRoadmap, { shareToken: token })).toBeNull();
	expect(
		await t.query(api.sharing.getPublicRoadmap, { shareToken: "bogus" }),
	).toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run convex/sharing.test.ts`
Expected: FAIL — `api.sharing.getPublicRoadmap` undefined.

- [ ] **Step 3: Implement `convex/sharing.ts`**

```ts
import { v } from "convex/values";
import { query } from "./_generated/server";
import { loadRoadmapChildren } from "./lib/bundle";

/** PUBLIC: no auth. Returns the bundle only for link-shared roadmaps. */
export const getPublicRoadmap = query({
	args: { shareToken: v.string() },
	handler: async (ctx, args) => {
		const roadmap = await ctx.db
			.query("roadmaps")
			.withIndex("by_shareToken", (q) => q.eq("shareToken", args.shareToken))
			.unique();
		if (!roadmap || roadmap.visibility !== "link") return null;
		return { roadmap, ...(await loadRoadmapChildren(ctx, roadmap._id)) };
	},
});
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run convex/sharing.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add convex/sharing.ts convex/sharing.test.ts
git commit -m "feat: public read-only roadmap query"
```

---

### Task 3: Read-only renderer + public route

**Files:**
- Create: `src/components/share/ReadOnlyRoadmap.tsx`
- Create: `src/routes/share/$token.tsx`

- [ ] **Step 1: `ReadOnlyRoadmap.tsx`**

Reuses `TimelineView` (no edit callbacks) and `ItemTable` (no-op select), with a zoom + tab switch.

```tsx
import { useState } from "react";
import { ItemTable } from "@/components/table/ItemTable";
import { TimelineView, type TimelineBundle } from "@/components/timeline/TimelineView";
import { ZoomSwitch } from "@/components/timeline/ZoomSwitch";
import { sortItems, type SortState } from "@/lib/itemQuery";
import type { Zoom } from "@/lib/timeline";

export function ReadOnlyRoadmap({ bundle }: { bundle: TimelineBundle }) {
	const [zoom, setZoom] = useState<Zoom>(bundle.roadmap.defaultZoom);
	const [view, setView] = useState<"timeline" | "table">("timeline");
	const [sort, setSort] = useState<SortState>({ key: "startDate", dir: 1 });
	const sortedItems = sortItems(bundle.items, sort);

	return (
		<div className="mx-auto max-w-6xl p-6">
			<header className="mb-4 flex items-center justify-between">
				<div>
					<p className="font-mono text-xs uppercase tracking-wide text-neutral-500">
						Shared roadmap (read-only)
					</p>
					<h1 className="text-2xl font-semibold">{bundle.roadmap.name}</h1>
				</div>
				<div className="flex items-center gap-2">
					{view === "timeline" ? <ZoomSwitch value={zoom} onChange={setZoom} /> : null}
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
				</div>
			</header>
			{view === "timeline" ? (
				<TimelineView bundle={bundle} zoom={zoom} />
			) : (
				<ItemTable
					items={sortedItems}
					fields={bundle.fields}
					lanes={bundle.lanes}
					sort={sort}
					onSortChange={setSort}
					onSelect={() => {}}
				/>
			)}
		</div>
	);
}
```

- [ ] **Step 2: `src/routes/share/$token.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ReadOnlyRoadmap } from "@/components/share/ReadOnlyRoadmap";

export const Route = createFileRoute("/share/$token")({
	ssr: false,
	component: SharePage,
});

function SharePage() {
	const { token } = Route.useParams();
	const bundle = useQuery(api.sharing.getPublicRoadmap, { shareToken: token });

	if (bundle === undefined) {
		return <p className="p-6 text-sm text-neutral-500">Loading…</p>;
	}
	if (bundle === null) {
		return (
			<div className="grid min-h-screen place-items-center p-6 text-center">
				<div>
					<h1 className="text-lg font-semibold">Roadmap not available</h1>
					<p className="text-sm text-neutral-500">
						This link is invalid or sharing was turned off.
					</p>
				</div>
			</div>
		);
	}
	return (
		<div className="min-h-screen bg-neutral-50 text-neutral-900">
			<ReadOnlyRoadmap bundle={bundle} />
		</div>
	);
}
```

- [ ] **Step 3: Commit**

```bash
npm run check
git add src/components/share/ReadOnlyRoadmap.tsx src/routes/share/$token.tsx
git commit -m "feat: public read-only share route"
```

---

### Task 4: ShareDialog in the editor

**Files:**
- Create: `src/components/share/ShareDialog.tsx`
- Modify: `src/routes/roadmaps/$id.tsx`

- [ ] **Step 1: `ShareDialog.tsx`**

```tsx
import { Dialog } from "radix-ui";
import { useMutation } from "convex/react";
import { Copy } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";

export function ShareDialog({
	roadmap,
	open,
	onOpenChange,
}: {
	roadmap: Doc<"roadmaps">;
	open: boolean;
	onOpenChange: (v: boolean) => void;
}) {
	const enableShare = useMutation(api.roadmaps.enableShare);
	const disableShare = useMutation(api.roadmaps.disableShare);
	const shared = roadmap.visibility === "link" && Boolean(roadmap.shareToken);
	const link =
		shared && typeof window !== "undefined"
			? `${window.location.origin}/share/${roadmap.shareToken}`
			: "";

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
				<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(480px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
					<Dialog.Title className="text-base font-semibold">Share roadmap</Dialog.Title>
					<p className="mt-1 text-sm text-neutral-500">
						Anyone with the link can view this roadmap (read-only).
					</p>
					{shared ? (
						<div className="mt-4 space-y-3">
							<div className="flex gap-2">
								<input
									readOnly
									value={link}
									className="flex-1 rounded-md border border-neutral-200 px-2 py-2 text-sm"
								/>
								<button
									type="button"
									onClick={() => navigator.clipboard.writeText(link)}
									className="flex items-center gap-1 rounded-md border border-neutral-200 px-3 text-sm"
								>
									<Copy size={14} /> Copy
								</button>
							</div>
							<button
								type="button"
								onClick={() => disableShare({ roadmapId: roadmap._id as Id<"roadmaps"> })}
								className="text-sm text-red-600"
							>
								Turn off sharing
							</button>
						</div>
					) : (
						<button
							type="button"
							onClick={() => enableShare({ roadmapId: roadmap._id as Id<"roadmaps"> })}
							className="mt-4 rounded-md bg-neutral-900 px-3 py-2 text-sm text-white"
						>
							Create share link
						</button>
					)}
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
```

- [ ] **Step 2: Add a "Share" button in the editor**

In `src/routes/roadmaps/$id.tsx`, add `const [shareOpen, setShareOpen] = useState(false);`, a header button opening it, and render:

```tsx
<ShareDialog
	roadmap={bundle.roadmap}
	open={shareOpen}
	onOpenChange={setShareOpen}
/>
```

with `import { ShareDialog } from "@/components/share/ShareDialog";`.

- [ ] **Step 3: Verify manually**

Run: `npm run dev:all`. Open a roadmap → Share → Create share link → copy it. Open the link in a private/incognito window (signed out) → the read-only roadmap renders and updates live when you edit in the owner window. Turn off sharing → the link shows "not available".

- [ ] **Step 4: Lint + commit**

```bash
npm run check
git add src/components/share/ShareDialog.tsx src/routes/roadmaps/$id.tsx
git commit -m "feat: share dialog with link toggle"
```

---

## Self-review notes

- **Spec coverage:** public `getPublicRoadmap` returning nothing for private/wrong token (§4) ✓; public `share/$token` read-only route (§5) ✓; share token mint/clear via dialog (§4) ✓; real-time updates to viewers (Convex subscription on the public query) ✓.
- **Type consistency:** `getPublicRoadmap` returns the same shape as `getBundle`, so `ReadOnlyRoadmap` consumes `TimelineBundle` unchanged. `TimelineView`/`ItemTable` are reused read-only (no edit callbacks).
- **Security:** the public query is the *only* function without `requireUser`; it gates on `visibility === "link"`. All mutations remain owner-guarded.
