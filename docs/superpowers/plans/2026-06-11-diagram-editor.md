# Diagram Editor (Mermaid + PlantUML via Kroki) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A live diagram editor at `/diagrams`: edit Mermaid/PlantUML as code with debounced live preview, manual/auto version checkpoints (roadmaps model), and public read-only share links.

**Architecture:** Two new Convex tables (`diagrams`, `diagramVersions`) mirroring the roadmaps/roadmapVersions pattern; pure logic in `src/lib/` (engine registry, Kroki encoder); a `useDiagramRender` hook owning debounce + last-good-render retention; split-view editor route (CodeMirror left, preview right). Mermaid renders client-side (dynamic import); PlantUML renders via `kroki.io` fetched as an `<img>` object URL.

**Tech Stack:** Convex (convex-test), React 19 + TanStack Start/Router/Form, CodeMirror 6, `mermaid`, browser-native `CompressionStream`, Biome, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-11-diagram-editor-design.md`

**House rules (apply to every task):**
- Biome: **tab** indentation, **double** quotes. Run `npm run check` before each commit; autofix with `npx biome check --write <files>`.
- After editing anything in `convex/`, run `npx convex dev --once` to deploy + regenerate `convex/_generated` (commit regenerated output).
- `convex/tsconfig.json` excludes `*.test.ts`, so TDD tests referencing not-yet-built functions don't break the deploy typecheck — write the failing test first, it works.
- Authed `useQuery` must gate on `useConvexAuth()` with the `"skip"` sentinel (see CLAUDE.md).
- Path aliases: `@/*` → `src/`, `@convex/*` → `convex/`.

---

### Task 1: Schema — `diagrams` and `diagramVersions` tables

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add validators and tables**

In `convex/schema.ts`, add the two validators after `roadmapSnapshotValidator` (before `defineSchema`):

```ts
export const diagramTypeValidator = v.union(
	v.literal("mermaid"),
	v.literal("plantuml"),
);

export const diagramSnapshotValidator = v.object({
	title: v.string(),
	type: diagramTypeValidator,
	source: v.string(),
});
```

Inside `defineSchema({ ... })`, add after the `roadmapVersions` table:

```ts
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
		.index("by_shareToken", ["shareToken"]),

	diagramVersions: defineTable({
		diagramId: v.id("diagrams"),
		userId: v.string(),
		label: v.string(),
		kind: v.union(v.literal("manual"), v.literal("auto")),
		snapshot: diagramSnapshotValidator,
	}).index("by_diagram", ["diagramId"]),
```

- [ ] **Step 2: Deploy + regenerate types**

Run: `npx convex dev --once`
Expected: succeeds; `convex/_generated/` regenerated with the new tables.

- [ ] **Step 3: Verify checks pass**

Run: `npm run check && npx tsc --noEmit`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts convex/_generated
git commit -m "feat(diagrams): add diagrams and diagramVersions tables to schema"
```

---

### Task 2: Backend — `requireDiagramOwner` + diagrams CRUD (TDD)

**Files:**
- Modify: `convex/lib/auth.ts`
- Create: `convex/diagrams.ts`
- Test: `convex/diagrams.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `convex/diagrams.test.ts`:

```ts
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const alex = { subject: "user_alex" };
const mallory = { subject: "user_mallory" };

test("create stores the diagram and get returns it", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await t.withIdentity(alex).mutation(api.diagrams.create, {
		title: "Auth flow",
		type: "mermaid",
		source: "flowchart TD\n A --> B",
	});
	const diagram = await t
		.withIdentity(alex)
		.query(api.diagrams.get, { diagramId });
	expect(diagram.title).toBe("Auth flow");
	expect(diagram.type).toBe("mermaid");
	expect(diagram.source).toBe("flowchart TD\n A --> B");
	expect(diagram.visibility).toBe("private");
	expect(diagram.archived).toBe(false);
});

test("create defaults source to an empty string", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await t.withIdentity(alex).mutation(api.diagrams.create, {
		title: "Blank",
		type: "plantuml",
	});
	const diagram = await t
		.withIdentity(alex)
		.query(api.diagrams.get, { diagramId });
	expect(diagram.source).toBe("");
});

test("list returns only the caller's non-archived diagrams", async () => {
	const t = convexTest(schema, modules);
	await t
		.withIdentity(alex)
		.mutation(api.diagrams.create, { title: "Mine", type: "mermaid" });
	const archivedId = await t
		.withIdentity(alex)
		.mutation(api.diagrams.create, { title: "Old", type: "mermaid" });
	await t
		.withIdentity(mallory)
		.mutation(api.diagrams.create, { title: "Theirs", type: "plantuml" });
	await t.run(async (ctx) => {
		await ctx.db.patch(archivedId, { archived: true });
	});
	const list = await t.withIdentity(alex).query(api.diagrams.list, {});
	expect(list.map((d) => d.title)).toEqual(["Mine"]);
});

test("update patches title, type and source", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await t.withIdentity(alex).mutation(api.diagrams.create, {
		title: "Before",
		type: "mermaid",
		source: "flowchart TD\n A --> B",
	});
	await t.withIdentity(alex).mutation(api.diagrams.update, {
		diagramId,
		title: "After",
		source: "flowchart LR\n A --> B",
	});
	const diagram = await t
		.withIdentity(alex)
		.query(api.diagrams.get, { diagramId });
	expect(diagram.title).toBe("After");
	expect(diagram.type).toBe("mermaid");
	expect(diagram.source).toBe("flowchart LR\n A --> B");
});

test("remove deletes the diagram", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await t
		.withIdentity(alex)
		.mutation(api.diagrams.create, { title: "Doomed", type: "mermaid" });
	await t.withIdentity(alex).mutation(api.diagrams.remove, { diagramId });
	await expect(
		t.withIdentity(alex).query(api.diagrams.get, { diagramId }),
	).rejects.toThrow(/access denied/);
});

test("a non-owner cannot get, update or remove a diagram", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await t
		.withIdentity(alex)
		.mutation(api.diagrams.create, { title: "Private", type: "mermaid" });
	await expect(
		t.withIdentity(mallory).query(api.diagrams.get, { diagramId }),
	).rejects.toThrow(/access denied/);
	await expect(
		t
			.withIdentity(mallory)
			.mutation(api.diagrams.update, { diagramId, title: "Hacked" }),
	).rejects.toThrow(/access denied/);
	await expect(
		t.withIdentity(mallory).mutation(api.diagrams.remove, { diagramId }),
	).rejects.toThrow(/access denied/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run convex/diagrams.test.ts`
Expected: FAIL — "Could not find public function for 'diagrams:create'" (or similar).

- [ ] **Step 3: Add `requireDiagramOwner` to `convex/lib/auth.ts`**

Append to `convex/lib/auth.ts`:

```ts
/** Verifies the caller owns the diagram; returns the user id and the diagram doc. */
export async function requireDiagramOwner(
	ctx: QueryCtx | MutationCtx,
	diagramId: Id<"diagrams">,
): Promise<{ userId: string; diagram: Doc<"diagrams"> }> {
	const userId = await requireUser(ctx);
	const diagram = await ctx.db.get(diagramId);
	if (!diagram || diagram.userId !== userId) {
		throw new Error("Diagram not found or access denied");
	}
	return { userId, diagram };
}
```

- [ ] **Step 4: Implement `convex/diagrams.ts`**

```ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireDiagramOwner, requireUser } from "./lib/auth";
import { diagramTypeValidator } from "./schema";

export const list = query({
	args: {},
	handler: async (ctx) => {
		const userId = await requireUser(ctx);
		const diagrams = await ctx.db
			.query("diagrams")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
		return diagrams.filter((d) => !d.archived);
	},
});

export const get = query({
	args: { diagramId: v.id("diagrams") },
	handler: async (ctx, args) => {
		const { diagram } = await requireDiagramOwner(ctx, args.diagramId);
		return diagram;
	},
});

export const create = mutation({
	args: {
		title: v.string(),
		type: diagramTypeValidator,
		source: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = await requireUser(ctx);
		return await ctx.db.insert("diagrams", {
			userId,
			title: args.title,
			type: args.type,
			source: args.source ?? "",
			visibility: "private",
			archived: false,
		});
	},
});

export const update = mutation({
	args: {
		diagramId: v.id("diagrams"),
		title: v.optional(v.string()),
		type: v.optional(diagramTypeValidator),
		source: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await requireDiagramOwner(ctx, args.diagramId);
		const { diagramId, ...patch } = args;
		await ctx.db.patch(diagramId, patch);
	},
});

export const remove = mutation({
	args: { diagramId: v.id("diagrams") },
	handler: async (ctx, args) => {
		await requireDiagramOwner(ctx, args.diagramId);
		const versions = await ctx.db
			.query("diagramVersions")
			.withIndex("by_diagram", (q) => q.eq("diagramId", args.diagramId))
			.collect();
		for (const row of versions) {
			await ctx.db.delete(row._id);
		}
		await ctx.db.delete(args.diagramId);
	},
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run convex/diagrams.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Deploy + checks**

Run: `npx convex dev --once && npm run check && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add convex/lib/auth.ts convex/diagrams.ts convex/diagrams.test.ts convex/_generated
git commit -m "feat(diagrams): diagrams CRUD with server-side ownership checks"
```

---

### Task 3: Backend — share mutations + `getPublicDiagram` (TDD)

**Files:**
- Modify: `convex/diagrams.ts`
- Modify: `convex/sharing.ts`
- Test: `convex/diagrams.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `convex/diagrams.test.ts`:

```ts
test("enableShare issues a token honored by getPublicDiagram", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await t.withIdentity(alex).mutation(api.diagrams.create, {
		title: "Shared",
		type: "mermaid",
		source: "flowchart TD\n A --> B",
	});
	const token = await t
		.withIdentity(alex)
		.mutation(api.diagrams.enableShare, { diagramId });
	expect(token).toBeTruthy();
	const pub = await t.query(api.sharing.getPublicDiagram, {
		shareToken: token,
	});
	expect(pub?.title).toBe("Shared");
	expect(pub?.source).toBe("flowchart TD\n A --> B");
});

test("disableShare revokes public access", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await t
		.withIdentity(alex)
		.mutation(api.diagrams.create, { title: "Shared", type: "mermaid" });
	const token = await t
		.withIdentity(alex)
		.mutation(api.diagrams.enableShare, { diagramId });
	await t.withIdentity(alex).mutation(api.diagrams.disableShare, { diagramId });
	const pub = await t.query(api.sharing.getPublicDiagram, {
		shareToken: token,
	});
	expect(pub).toBeNull();
});

test("regenerateShare invalidates the old token", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await t
		.withIdentity(alex)
		.mutation(api.diagrams.create, { title: "Shared", type: "mermaid" });
	const oldToken = await t
		.withIdentity(alex)
		.mutation(api.diagrams.enableShare, { diagramId });
	const newToken = await t
		.withIdentity(alex)
		.mutation(api.diagrams.regenerateShare, { diagramId });
	expect(newToken).not.toBe(oldToken);
	expect(
		await t.query(api.sharing.getPublicDiagram, { shareToken: oldToken }),
	).toBeNull();
	expect(
		(await t.query(api.sharing.getPublicDiagram, { shareToken: newToken }))
			?.title,
	).toBe("Shared");
});

test("getPublicDiagram returns null for unknown tokens", async () => {
	const t = convexTest(schema, modules);
	expect(
		await t.query(api.sharing.getPublicDiagram, { shareToken: "nope" }),
	).toBeNull();
});

test("a non-owner cannot manage sharing", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await t
		.withIdentity(alex)
		.mutation(api.diagrams.create, { title: "Private", type: "mermaid" });
	await expect(
		t.withIdentity(mallory).mutation(api.diagrams.enableShare, { diagramId }),
	).rejects.toThrow(/access denied/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run convex/diagrams.test.ts`
Expected: the 5 new tests FAIL ("Could not find public function"); the 6 from Task 2 still PASS.

- [ ] **Step 3: Add share mutations to `convex/diagrams.ts`**

Append (mirrors `roadmaps.enableShare`/`disableShare`):

```ts
export const enableShare = mutation({
	args: { diagramId: v.id("diagrams") },
	handler: async (ctx, args) => {
		const { diagram } = await requireDiagramOwner(ctx, args.diagramId);
		const token = diagram.shareToken ?? crypto.randomUUID().replace(/-/g, "");
		await ctx.db.patch(args.diagramId, {
			visibility: "link",
			shareToken: token,
		});
		return token;
	},
});

export const disableShare = mutation({
	args: { diagramId: v.id("diagrams") },
	handler: async (ctx, args) => {
		await requireDiagramOwner(ctx, args.diagramId);
		await ctx.db.patch(args.diagramId, {
			visibility: "private",
			shareToken: undefined,
		});
	},
});

export const regenerateShare = mutation({
	args: { diagramId: v.id("diagrams") },
	handler: async (ctx, args) => {
		const { diagram } = await requireDiagramOwner(ctx, args.diagramId);
		if (diagram.visibility !== "link") {
			throw new Error("Sharing is not enabled");
		}
		const token = crypto.randomUUID().replace(/-/g, "");
		await ctx.db.patch(args.diagramId, { shareToken: token });
		return token;
	},
});
```

- [ ] **Step 4: Add `getPublicDiagram` to `convex/sharing.ts`**

Append:

```ts
/** PUBLIC: no auth. Returns the diagram only when link-shared. */
export const getPublicDiagram = query({
	args: { shareToken: v.string() },
	handler: async (ctx, args) => {
		const diagram = await ctx.db
			.query("diagrams")
			.withIndex("by_shareToken", (q) => q.eq("shareToken", args.shareToken))
			.unique();
		if (!diagram || diagram.visibility !== "link") return null;
		return diagram;
	},
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run convex/diagrams.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 6: Deploy + checks**

Run: `npx convex dev --once && npm run check && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add convex/diagrams.ts convex/sharing.ts convex/diagrams.test.ts convex/_generated
git commit -m "feat(diagrams): share-token sharing and public read-only query"
```

---

### Task 4: Backend — diagram versions (TDD)

**Files:**
- Create: `convex/diagramVersions.ts`
- Test: `convex/diagramVersions.test.ts`
- Test: `convex/diagrams.test.ts` (append one test)

- [ ] **Step 1: Write the failing tests**

Create `convex/diagramVersions.test.ts`:

```ts
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const alex = { subject: "user_alex" };
const mallory = { subject: "user_mallory" };

async function setupDiagram(t: ReturnType<typeof convexTest>) {
	return await t.withIdentity(alex).mutation(api.diagrams.create, {
		title: "Flow",
		type: "mermaid",
		source: "flowchart TD\n A --> B",
	});
}

test("create saves a manual version of the current state", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await setupDiagram(t);
	await t
		.withIdentity(alex)
		.mutation(api.diagramVersions.create, { diagramId, label: "Checkpoint" });
	const list = await t
		.withIdentity(alex)
		.query(api.diagramVersions.list, { diagramId });
	expect(list).toHaveLength(1);
	expect(list[0].label).toBe("Checkpoint");
	expect(list[0].kind).toBe("manual");
});

test("blank labels fall back to a numbered default", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await setupDiagram(t);
	await t
		.withIdentity(alex)
		.mutation(api.diagramVersions.create, { diagramId, label: "  " });
	const list = await t
		.withIdentity(alex)
		.query(api.diagramVersions.list, { diagramId });
	expect(list[0].label).toBe("Version 1");
});

test("restore reproduces the snapshot and auto-checkpoints first", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await setupDiagram(t);
	await t
		.withIdentity(alex)
		.mutation(api.diagramVersions.create, { diagramId, label: "Original" });
	await t.withIdentity(alex).mutation(api.diagrams.update, {
		diagramId,
		title: "Changed",
		source: "flowchart LR\n X --> Y",
	});

	const list = await t
		.withIdentity(alex)
		.query(api.diagramVersions.list, { diagramId });
	const checkpoint = list.find((v) => v.label === "Original");
	if (!checkpoint) throw new Error("checkpoint missing");
	await t
		.withIdentity(alex)
		.mutation(api.diagramVersions.restore, { versionId: checkpoint._id });

	const diagram = await t
		.withIdentity(alex)
		.query(api.diagrams.get, { diagramId });
	expect(diagram.title).toBe("Flow");
	expect(diagram.source).toBe("flowchart TD\n A --> B");

	const list2 = await t
		.withIdentity(alex)
		.query(api.diagramVersions.list, { diagramId });
	expect(
		list2.some((v) => v.kind === "auto" && v.label === "Before restore"),
	).toBe(true);
});

test("versions are capped at 25, pruning oldest first", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await setupDiagram(t);
	for (let i = 0; i < 27; i++) {
		await t
			.withIdentity(alex)
			.mutation(api.diagramVersions.create, { diagramId, label: `v${i}` });
	}
	const list = await t
		.withIdentity(alex)
		.query(api.diagramVersions.list, { diagramId });
	expect(list).toHaveLength(25);
	expect(list.some((v) => v.label === "v0")).toBe(false);
	expect(list.some((v) => v.label === "v26")).toBe(true);
});

test("a non-owner cannot list, create or restore versions", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await setupDiagram(t);
	await expect(
		t
			.withIdentity(mallory)
			.mutation(api.diagramVersions.create, { diagramId, label: "x" }),
	).rejects.toThrow(/access denied/);
	await expect(
		t.withIdentity(mallory).query(api.diagramVersions.list, { diagramId }),
	).rejects.toThrow(/access denied/);
});
```

Append to `convex/diagrams.test.ts`:

```ts
test("remove deletes the diagram's versions too", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await t
		.withIdentity(alex)
		.mutation(api.diagrams.create, { title: "Doomed", type: "mermaid" });
	await t
		.withIdentity(alex)
		.mutation(api.diagramVersions.create, { diagramId, label: "v1" });
	await t.withIdentity(alex).mutation(api.diagrams.remove, { diagramId });
	const orphans = await t.run(async (ctx) => {
		return await ctx.db.query("diagramVersions").collect();
	});
	expect(orphans).toHaveLength(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run convex/diagramVersions.test.ts convex/diagrams.test.ts`
Expected: the new tests FAIL ("Could not find public function for 'diagramVersions:create'"); previous tests PASS.

- [ ] **Step 3: Implement `convex/diagramVersions.ts`**

```ts
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { requireDiagramOwner } from "./lib/auth";

export const MAX_DIAGRAM_VERSIONS = 25;

/** Snapshots the diagram into a diagramVersions row, then prunes to the cap (oldest first). */
async function saveDiagramVersion(
	ctx: MutationCtx,
	diagram: Doc<"diagrams">,
	label: string,
	kind: "manual" | "auto",
): Promise<void> {
	await ctx.db.insert("diagramVersions", {
		diagramId: diagram._id,
		userId: diagram.userId,
		label,
		kind,
		snapshot: {
			title: diagram.title,
			type: diagram.type,
			source: diagram.source,
		},
	});
	const all = await ctx.db
		.query("diagramVersions")
		.withIndex("by_diagram", (q) => q.eq("diagramId", diagram._id))
		.collect();
	if (all.length > MAX_DIAGRAM_VERSIONS) {
		const oldest = [...all]
			.sort((a, b) => a._creationTime - b._creationTime)
			.slice(0, all.length - MAX_DIAGRAM_VERSIONS);
		for (const row of oldest) {
			await ctx.db.delete(row._id);
		}
	}
}

export const list = query({
	args: { diagramId: v.id("diagrams") },
	handler: async (ctx, { diagramId }) => {
		await requireDiagramOwner(ctx, diagramId);
		const versions = await ctx.db
			.query("diagramVersions")
			.withIndex("by_diagram", (q) => q.eq("diagramId", diagramId))
			.collect();
		return versions
			.sort((a, b) => b._creationTime - a._creationTime)
			.map((row) => ({
				_id: row._id,
				label: row.label,
				kind: row.kind,
				_creationTime: row._creationTime,
			}));
	},
});

export const create = mutation({
	args: { diagramId: v.id("diagrams"), label: v.string() },
	handler: async (ctx, { diagramId, label }) => {
		const { diagram } = await requireDiagramOwner(ctx, diagramId);
		const existing = await ctx.db
			.query("diagramVersions")
			.withIndex("by_diagram", (q) => q.eq("diagramId", diagramId))
			.collect();
		const finalLabel = label.trim() || `Version ${existing.length + 1}`;
		await saveDiagramVersion(ctx, diagram, finalLabel, "manual");
	},
});

export const restore = mutation({
	args: { versionId: v.id("diagramVersions") },
	handler: async (ctx, { versionId }) => {
		const version = await ctx.db.get(versionId);
		if (!version) throw new Error("Version not found");
		const { diagram } = await requireDiagramOwner(ctx, version.diagramId);
		await saveDiagramVersion(ctx, diagram, "Before restore", "auto");
		await ctx.db.patch(diagram._id, {
			title: version.snapshot.title,
			type: version.snapshot.type,
			source: version.snapshot.source,
		});
	},
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run convex/diagramVersions.test.ts convex/diagrams.test.ts`
Expected: PASS (17 tests total across both files).

- [ ] **Step 5: Deploy + checks**

Run: `npx convex dev --once && npm run check && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add convex/diagramVersions.ts convex/diagramVersions.test.ts convex/diagrams.test.ts convex/_generated
git commit -m "feat(diagrams): version checkpoints with restore and 25-cap pruning"
```

---

### Task 5: Engine registry — `src/lib/diagramEngines.ts` (TDD)

**Files:**
- Create: `src/lib/diagramEngines.ts`
- Test: `src/lib/__tests__/diagramEngines.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/diagramEngines.test.ts`:

```ts
import { expect, test } from "vitest";
import { DIAGRAM_ENGINES, DIAGRAM_TYPES } from "../diagramEngines";

test("every diagram type has an engine with a starter and sane debounce", () => {
	expect(DIAGRAM_TYPES.length).toBeGreaterThan(0);
	for (const type of DIAGRAM_TYPES) {
		const engine = DIAGRAM_ENGINES[type];
		expect(engine.id).toBe(type);
		expect(engine.label.length).toBeGreaterThan(0);
		expect(engine.starterSource.trim().length).toBeGreaterThan(0);
		expect(engine.debounceMs).toBeGreaterThanOrEqual(100);
		expect(engine.debounceMs).toBeLessThanOrEqual(5000);
	}
});

test("kroki engines declare a kroki type", () => {
	for (const type of DIAGRAM_TYPES) {
		const engine = DIAGRAM_ENGINES[type];
		if (engine.strategy === "kroki") {
			expect(engine.krokiType).toBeTruthy();
		}
	}
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/diagramEngines.test.ts`
Expected: FAIL — cannot resolve `../diagramEngines`.

- [ ] **Step 3: Implement `src/lib/diagramEngines.ts`**

`DiagramType` derives from the generated Convex types, so adding a literal to
`diagramTypeValidator` in the schema forces a compile error here until the
registry gets an entry — that is the "one schema literal + one registry entry"
extension path from the spec.

```ts
import type { Doc } from "@convex/_generated/dataModel";

export type DiagramType = Doc<"diagrams">["type"];

export interface DiagramEngine {
	id: DiagramType;
	label: string;
	/** "client-mermaid" renders locally; "kroki" fetches SVG from kroki.io. */
	strategy: "client-mermaid" | "kroki";
	/** Kroki diagram type segment in the URL; required when strategy is "kroki". */
	krokiType?: string;
	/** Debounce before re-rendering after the last keystroke. */
	debounceMs: number;
	/** Source seeded into newly created diagrams. */
	starterSource: string;
}

export const DIAGRAM_ENGINES: Record<DiagramType, DiagramEngine> = {
	mermaid: {
		id: "mermaid",
		label: "Mermaid",
		strategy: "client-mermaid",
		debounceMs: 300,
		starterSource: [
			"flowchart TD",
			"\tA[Start] --> B{Working?}",
			"\tB -->|Yes| C[Ship it]",
			"\tB -->|No| D[Debug]",
			"\tD --> B",
		].join("\n"),
	},
	plantuml: {
		id: "plantuml",
		label: "PlantUML",
		strategy: "kroki",
		krokiType: "plantuml",
		debounceMs: 800,
		starterSource: [
			"@startuml",
			"Alice -> Bob: Hello",
			"Bob --> Alice: Hi!",
			"@enduml",
		].join("\n"),
	},
};

export const DIAGRAM_TYPES = Object.keys(DIAGRAM_ENGINES) as DiagramType[];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/diagramEngines.test.ts`
Expected: PASS.

- [ ] **Step 5: Checks + commit**

Run: `npm run check && npx tsc --noEmit`
Expected: pass.

```bash
git add src/lib/diagramEngines.ts src/lib/__tests__/diagramEngines.test.ts
git commit -m "feat(diagrams): diagram engine registry"
```

---

### Task 6: Kroki encoder — `src/lib/kroki.ts` (TDD)

**Files:**
- Create: `src/lib/kroki.ts`
- Test: `src/lib/__tests__/kroki.test.ts`

Node ≥ 18 ships `CompressionStream`/`DecompressionStream`/`btoa`/`atob` globally, so these tests run in the default vitest `node` environment.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/kroki.test.ts`:

```ts
import { expect, test, vi } from "vitest";
import { buildKrokiUrl, encodeKrokiSource, renderKroki } from "../kroki";

async function decode(encoded: string): Promise<string> {
	const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
	const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
	const stream = new Blob([bytes])
		.stream()
		.pipeThrough(new DecompressionStream("deflate"));
	return await new Response(stream).text();
}

test("encodeKrokiSource round-trips through deflate + base64url", async () => {
	const source = "@startuml\nAlice -> Bob: Hello\n@enduml";
	expect(await decode(await encodeKrokiSource(source))).toBe(source);
});

test("encoded output is URL-safe", async () => {
	const encoded = await encodeKrokiSource("flowchart TD\n A-->B & C?");
	expect(encoded).toMatch(/^[A-Za-z0-9\-_=]+$/);
});

test("buildKrokiUrl targets the kroki.io SVG endpoint", async () => {
	const url = await buildKrokiUrl("plantuml", "@startuml\n@enduml");
	expect(url).toMatch(
		/^https:\/\/kroki\.io\/plantuml\/svg\/[A-Za-z0-9\-_=]+$/,
	);
});

test("renderKroki surfaces the Kroki error body on failure", async () => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response("Syntax error in line 2", { status: 400 })),
	);
	try {
		await expect(renderKroki("plantuml", "bad input")).rejects.toThrow(
			"Syntax error in line 2",
		);
	} finally {
		vi.unstubAllGlobals();
	}
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/kroki.test.ts`
Expected: FAIL — cannot resolve `../kroki`.

- [ ] **Step 3: Implement `src/lib/kroki.ts`**

```ts
export const KROKI_BASE_URL = "https://kroki.io";

/** Deflate + base64url, the encoding Kroki expects in GET URLs. */
export async function encodeKrokiSource(source: string): Promise<string> {
	const stream = new Blob([source])
		.stream()
		.pipeThrough(new CompressionStream("deflate"));
	const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_");
}

export async function buildKrokiUrl(
	krokiType: string,
	source: string,
): Promise<string> {
	return `${KROKI_BASE_URL}/${krokiType}/svg/${await encodeKrokiSource(source)}`;
}

/**
 * Fetches the rendered SVG and returns an object URL for use as an <img> src.
 * Kroki returns its parse errors as a 4xx text body; surface that as the
 * Error message. Callers own revoking the returned object URL.
 */
export async function renderKroki(
	krokiType: string,
	source: string,
	signal?: AbortSignal,
): Promise<string> {
	const res = await fetch(await buildKrokiUrl(krokiType, source), { signal });
	if (!res.ok) {
		const message = (await res.text()).trim();
		throw new Error(message || `Kroki request failed (${res.status})`);
	}
	return URL.createObjectURL(await res.blob());
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/kroki.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Checks + commit**

Run: `npm run check && npx tsc --noEmit`
Expected: pass.

```bash
git add src/lib/kroki.ts src/lib/__tests__/kroki.test.ts
git commit -m "feat(diagrams): kroki deflate+base64url encoder and fetch helper"
```

---

### Task 7: Install frontend dependencies

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install**

Run: `npm install mermaid codemirror codemirror-lang-mermaid`
Expected: succeeds; `mermaid`, `codemirror` (CodeMirror 6 meta package re-exporting `basicSetup` and the `@codemirror/*` core), and `codemirror-lang-mermaid` land in `dependencies`.

- [ ] **Step 2: Smoke-check the build still works**

Run: `npm run build`
Expected: succeeds (nothing imports the new packages yet).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(diagrams): add mermaid and codemirror dependencies"
```

---

### Task 8: Rendering hook + preview + code editor components

**Files:**
- Create: `src/hooks/useDiagramRender.ts`
- Create: `src/components/diagrams/DiagramPreview.tsx`
- Create: `src/components/diagrams/CodeEditorPanel.tsx`

These are browser-behavior components (timers, dynamic import, fetch, CodeMirror DOM). The pure parts were tested in Tasks 5–6; these are verified by `tsc`/`build` here and manually in Task 12.

- [ ] **Step 1: Implement `src/hooks/useDiagramRender.ts`**

```ts
import { useEffect, useRef, useState } from "react";
import { DIAGRAM_ENGINES, type DiagramType } from "@/lib/diagramEngines";
import { renderKroki } from "@/lib/kroki";

let mermaidLoader: Promise<typeof import("mermaid").default> | null = null;

function loadMermaid() {
	if (!mermaidLoader) {
		mermaidLoader = import("mermaid").then((mod) => {
			mod.default.initialize({
				startOnLoad: false,
				securityLevel: "strict",
				theme: "neutral",
			});
			return mod.default;
		});
	}
	return mermaidLoader;
}

/**
 * Debounced diagram rendering with last-good-render retention: on a
 * parse/render error the previous svg/imgUrl is kept and `error` is set.
 * Exactly one of svg (mermaid) and imgUrl (kroki object URL) is non-null
 * after a successful render.
 */
export function useDiagramRender(type: DiagramType, source: string) {
	const engine = DIAGRAM_ENGINES[type];
	const [svg, setSvg] = useState<string | null>(null);
	const [imgUrl, setImgUrl] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [rendering, setRendering] = useState(false);
	const abortRef = useRef<AbortController | null>(null);
	const seqRef = useRef(0);

	useEffect(() => {
		const seq = ++seqRef.current;
		const replaceImgUrl = (next: string | null) => {
			setImgUrl((prev) => {
				if (prev) URL.revokeObjectURL(prev);
				return next;
			});
		};
		if (!source.trim()) {
			setSvg(null);
			replaceImgUrl(null);
			setError(null);
			return;
		}
		const timer = setTimeout(async () => {
			setRendering(true);
			try {
				if (engine.strategy === "client-mermaid") {
					const mermaid = await loadMermaid();
					await mermaid.parse(source);
					const { svg: out } = await mermaid.render(`diagram-${seq}`, source);
					if (seq !== seqRef.current) return;
					setSvg(out);
					replaceImgUrl(null);
					setError(null);
				} else {
					abortRef.current?.abort();
					const controller = new AbortController();
					abortRef.current = controller;
					const url = await renderKroki(
						engine.krokiType ?? type,
						source,
						controller.signal,
					);
					if (seq !== seqRef.current) {
						URL.revokeObjectURL(url);
						return;
					}
					replaceImgUrl(url);
					setSvg(null);
					setError(null);
				}
			} catch (e) {
				if (e instanceof DOMException && e.name === "AbortError") return;
				if (seq !== seqRef.current) return;
				setError(e instanceof Error ? e.message : String(e));
			} finally {
				if (seq === seqRef.current) setRendering(false);
			}
		}, engine.debounceMs);
		return () => clearTimeout(timer);
	}, [engine, type, source]);

	return { svg, imgUrl, error, rendering };
}
```

- [ ] **Step 2: Implement `src/components/diagrams/DiagramPreview.tsx`**

```tsx
import type { DiagramType } from "@/lib/diagramEngines";
import { useDiagramRender } from "@/hooks/useDiagramRender";

export function DiagramPreview({
	type,
	source,
}: {
	type: DiagramType;
	source: string;
}) {
	const { svg, imgUrl, error, rendering } = useDiagramRender(type, source);
	return (
		<div className="relative h-full overflow-auto">
			{error ? (
				<div className="absolute inset-x-2 top-2 z-10 whitespace-pre-wrap rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
					{error}
				</div>
			) : null}
			{rendering ? (
				<span className="absolute bottom-2 right-2 z-10 text-[11px] text-neutral-400">
					Rendering…
				</span>
			) : null}
			<div className="grid min-h-full place-items-center p-4">
				{svg ? (
					// biome-ignore lint/security/noDangerouslySetInnerHtml: mermaid output is generated locally with securityLevel "strict"
					<div dangerouslySetInnerHTML={{ __html: svg }} />
				) : imgUrl ? (
					<img src={imgUrl} alt="Diagram preview" className="max-w-full" />
				) : (
					<p className="text-sm text-neutral-400">
						Start typing to render the diagram.
					</p>
				)}
			</div>
		</div>
	);
}
```

- [ ] **Step 3: Implement `src/components/diagrams/CodeEditorPanel.tsx`**

```tsx
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { mermaid as mermaidLang } from "codemirror-lang-mermaid";
import { useEffect, useRef } from "react";
import type { DiagramType } from "@/lib/diagramEngines";

export function CodeEditorPanel({
	value,
	language,
	onChange,
}: {
	value: string;
	language: DiagramType;
	onChange: (next: string) => void;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const viewRef = useRef<EditorView | null>(null);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	// biome-ignore lint/correctness/useExhaustiveDependencies: the editor is created once per language; value sync is handled by the effect below
	useEffect(() => {
		if (!containerRef.current) return;
		const extensions = [
			basicSetup,
			EditorView.updateListener.of((update) => {
				if (update.docChanged) {
					onChangeRef.current(update.state.doc.toString());
				}
			}),
			EditorView.theme({
				"&": { height: "100%", fontSize: "13px" },
				".cm-scroller": { fontFamily: "ui-monospace, monospace" },
			}),
		];
		if (language === "mermaid") {
			extensions.push(mermaidLang());
		}
		const view = new EditorView({
			state: EditorState.create({ doc: value, extensions }),
			parent: containerRef.current,
		});
		viewRef.current = view;
		return () => {
			view.destroy();
			viewRef.current = null;
		};
	}, [language]);

	useEffect(() => {
		const view = viewRef.current;
		if (!view) return;
		const current = view.state.doc.toString();
		if (value !== current) {
			view.dispatch({
				changes: { from: 0, to: current.length, insert: value },
			});
		}
	}, [value]);

	return <div ref={containerRef} className="h-full overflow-hidden" />;
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npm run check && npx tsc --noEmit && npm run build`
Expected: all pass (components are not yet routed, but must compile).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDiagramRender.ts src/components/diagrams/DiagramPreview.tsx src/components/diagrams/CodeEditorPanel.tsx
git commit -m "feat(diagrams): rendering hook, preview and CodeMirror editor panel"
```

---

### Task 9: Extract a generic `VersionDialog` (refactor, behavior-preserving)

**Files:**
- Create: `src/components/versions/VersionDialog.tsx`
- Modify: `src/components/versions/VersionManager.tsx`

The current `VersionManager` UI is generic; only its three `api.roadmapVersions.*` bindings are roadmap-specific. Move the JSX into a presentational `VersionDialog`; `VersionManager` keeps its exact public props (`roadmapId`/`open`/`onOpenChange`) so `src/routes/roadmaps/$id.tsx` is untouched.

- [ ] **Step 1: Create `src/components/versions/VersionDialog.tsx`**

```tsx
import { formatDistanceToNow } from "date-fns";
import { History, Plus } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState } from "react";

export interface VersionRow {
	_id: string;
	label: string;
	kind: "manual" | "auto";
	_creationTime: number;
}

export function VersionDialog({
	open,
	onOpenChange,
	entityNoun,
	versions,
	onCreate,
	onRestore,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	entityNoun: string;
	versions: VersionRow[] | undefined;
	onCreate: (label: string) => Promise<void>;
	onRestore: (versionId: string) => Promise<void>;
}) {
	const [label, setLabel] = useState("");
	const [confirmId, setConfirmId] = useState<string | null>(null);

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
				<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(480px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
					<Dialog.Title className="text-base font-semibold">
						Versions
					</Dialog.Title>
					<Dialog.Description className="mt-1 text-xs text-neutral-500">
						Save a checkpoint of the current {entityNoun}, or restore an
						earlier one. A safety checkpoint is saved automatically before any
						restore.
					</Dialog.Description>

					<div className="mt-4 flex gap-2">
						<input
							className="flex-1 rounded-md border border-neutral-200 px-2 py-1.5 text-sm"
							placeholder="Version name (optional)"
							value={label}
							onChange={(e) => setLabel(e.target.value)}
						/>
						<button
							type="button"
							onClick={async () => {
								await onCreate(label.trim());
								setLabel("");
							}}
							className="flex items-center gap-1 rm-btn-primary"
						>
							<Plus size={14} /> Save
						</button>
					</div>

					<div className="mt-4 max-h-72 space-y-2 overflow-auto">
						{versions === undefined ? (
							<p className="text-sm text-neutral-500">Loading…</p>
						) : versions.length === 0 ? (
							<p className="text-sm text-neutral-500">
								No versions yet. Save one to create a restore point.
							</p>
						) : (
							versions.map((version) => (
								<div
									key={version._id}
									className="flex items-center gap-2 rounded-md border border-neutral-200 p-2"
								>
									<History size={15} className="shrink-0 text-neutral-400" />
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<span className="truncate text-sm font-medium">
												{version.label}
											</span>
											<span
												className={
													version.kind === "manual"
														? "rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-white"
														: "rounded border border-neutral-300 px-1.5 py-0.5 text-[10px] text-neutral-500"
												}
											>
												{version.kind === "manual" ? "Manual" : "Auto"}
											</span>
										</div>
										<span className="block text-[11px] text-neutral-500">
											{formatDistanceToNow(version._creationTime, {
												addSuffix: true,
											})}
										</span>
									</div>
									{confirmId === version._id ? (
										<div className="flex shrink-0 items-center gap-1">
											<button
												type="button"
												onClick={async () => {
													await onRestore(version._id);
													setConfirmId(null);
													onOpenChange(false);
												}}
												className="rounded-md bg-red-600 px-2 py-1 text-xs text-white"
											>
												Confirm
											</button>
											<button
												type="button"
												onClick={() => setConfirmId(null)}
												className="rounded-md border border-neutral-200 px-2 py-1 text-xs"
											>
												Cancel
											</button>
										</div>
									) : (
										<button
											type="button"
											onClick={() => setConfirmId(version._id)}
											className="shrink-0 rounded-md border border-neutral-200 px-2 py-1 text-xs hover:bg-neutral-100"
										>
											Restore
										</button>
									)}
								</div>
							))
						)}
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
```

- [ ] **Step 2: Rewrite `src/components/versions/VersionManager.tsx` as a thin wrapper**

Replace the whole file with:

```tsx
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { VersionDialog } from "./VersionDialog";

export function VersionManager({
	roadmapId,
	open,
	onOpenChange,
}: {
	roadmapId: Id<"roadmaps">;
	open: boolean;
	onOpenChange: (v: boolean) => void;
}) {
	const versions = useQuery(
		api.roadmapVersions.list,
		open ? { roadmapId } : "skip",
	);
	const createVersion = useMutation(api.roadmapVersions.create);
	const restoreVersion = useMutation(api.roadmapVersions.restore);

	return (
		<VersionDialog
			open={open}
			onOpenChange={onOpenChange}
			entityNoun="roadmap"
			versions={versions}
			onCreate={async (label) => {
				await createVersion({ roadmapId, label });
			}}
			onRestore={async (versionId) => {
				await restoreVersion({
					versionId: versionId as Id<"roadmapVersions">,
				});
			}}
		/>
	);
}
```

- [ ] **Step 3: Verify nothing broke**

Run: `npm run check && npx tsc --noEmit && npm run test && npm run build`
Expected: all pass (full suite — this touches roadmaps code).

- [ ] **Step 4: Commit**

```bash
git add src/components/versions/VersionDialog.tsx src/components/versions/VersionManager.tsx
git commit -m "refactor(versions): extract presentational VersionDialog from VersionManager"
```

---

### Task 10: Diagram dialogs — versions, share, create

**Files:**
- Create: `src/components/diagrams/DiagramVersionManager.tsx`
- Create: `src/components/diagrams/DiagramShareDialog.tsx`
- Create: `src/components/diagrams/CreateDiagramDialog.tsx`

- [ ] **Step 1: Create `src/components/diagrams/DiagramVersionManager.tsx`**

```tsx
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { VersionDialog } from "@/components/versions/VersionDialog";

export function DiagramVersionManager({
	diagramId,
	open,
	onOpenChange,
}: {
	diagramId: Id<"diagrams">;
	open: boolean;
	onOpenChange: (v: boolean) => void;
}) {
	const versions = useQuery(
		api.diagramVersions.list,
		open ? { diagramId } : "skip",
	);
	const createVersion = useMutation(api.diagramVersions.create);
	const restoreVersion = useMutation(api.diagramVersions.restore);

	return (
		<VersionDialog
			open={open}
			onOpenChange={onOpenChange}
			entityNoun="diagram"
			versions={versions}
			onCreate={async (label) => {
				await createVersion({ diagramId, label });
			}}
			onRestore={async (versionId) => {
				await restoreVersion({
					versionId: versionId as Id<"diagramVersions">,
				});
			}}
		/>
	);
}
```

- [ ] **Step 2: Create `src/components/diagrams/DiagramShareDialog.tsx`**

Modeled on `src/components/share/ShareDialog.tsx` (which stays roadmap-specific), plus the regenerate action:

```tsx
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { Copy, RefreshCw } from "lucide-react";
import { Dialog } from "radix-ui";

export function DiagramShareDialog({
	diagram,
	open,
	onOpenChange,
}: {
	diagram: Doc<"diagrams">;
	open: boolean;
	onOpenChange: (v: boolean) => void;
}) {
	const enableShare = useMutation(api.diagrams.enableShare);
	const disableShare = useMutation(api.diagrams.disableShare);
	const regenerateShare = useMutation(api.diagrams.regenerateShare);
	const shared = diagram.visibility === "link" && Boolean(diagram.shareToken);
	const link =
		shared && typeof window !== "undefined"
			? `${window.location.origin}/share/diagram/${diagram.shareToken}`
			: "";

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
				<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(480px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
					<Dialog.Title className="text-base font-semibold">
						Share diagram
					</Dialog.Title>
					<p className="mt-1 text-sm text-neutral-500">
						Anyone with the link can view this diagram (read-only).
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
							<div className="flex items-center gap-4">
								<button
									type="button"
									onClick={() => regenerateShare({ diagramId: diagram._id })}
									className="flex items-center gap-1 text-sm text-neutral-600"
								>
									<RefreshCw size={14} /> Regenerate link
								</button>
								<button
									type="button"
									onClick={() => disableShare({ diagramId: diagram._id })}
									className="text-sm text-red-600"
								>
									Turn off sharing
								</button>
							</div>
						</div>
					) : (
						<button
							type="button"
							onClick={() => enableShare({ diagramId: diagram._id })}
							className="mt-4 rm-btn-primary"
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

- [ ] **Step 3: Create `src/components/diagrams/CreateDiagramDialog.tsx`**

Modeled on `CreateRoadmapDialog` (TanStack Form + Zod). Seeds `source` from the engine's starter template — this is where "source seeded from the starter" happens.

```tsx
import { useForm } from "@tanstack/react-form";
import { Dialog } from "radix-ui";
import { useState } from "react";
import { z } from "zod";
import {
	DIAGRAM_ENGINES,
	DIAGRAM_TYPES,
	type DiagramType,
} from "@/lib/diagramEngines";

const schema = z.object({
	title: z.string().min(1, "Title is required"),
});

export interface CreateDiagramDialogProps {
	onCreate: (input: {
		title: string;
		type: DiagramType;
		source: string;
	}) => Promise<void>;
}

export function CreateDiagramDialog({ onCreate }: CreateDiagramDialogProps) {
	const [open, setOpen] = useState(false);
	const [type, setType] = useState<DiagramType>("mermaid");
	const form = useForm({
		defaultValues: { title: "" },
		validators: { onSubmit: schema },
		onSubmit: async ({ value }) => {
			await onCreate({
				title: value.title,
				type,
				source: DIAGRAM_ENGINES[type].starterSource,
			});
			setOpen(false);
			form.reset();
		},
	});

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger className="rm-btn-primary">New diagram</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
				<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(440px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
					<Dialog.Title className="text-base font-semibold">
						New diagram
					</Dialog.Title>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							form.handleSubmit();
						}}
						className="mt-4 flex flex-col gap-3"
					>
						<form.Field name="title">
							{(field) => (
								<label className="flex flex-col gap-1 text-sm">
									Title
									<input
										className="rounded-md border border-neutral-200 px-2 py-2"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
									{field.state.meta.errors[0] ? (
										<span className="text-xs text-red-600">
											{String(
												field.state.meta.errors[0]?.message ??
													field.state.meta.errors[0],
											)}
										</span>
									) : null}
								</label>
							)}
						</form.Field>
						<label className="flex flex-col gap-1 text-sm">
							Type
							<select
								className="rounded-md border border-neutral-200 px-2 py-2"
								value={type}
								onChange={(e) => setType(e.target.value as DiagramType)}
							>
								{DIAGRAM_TYPES.map((t) => (
									<option key={t} value={t}>
										{DIAGRAM_ENGINES[t].label}
									</option>
								))}
							</select>
						</label>
						<button type="submit" className="mt-2 rm-btn-primary">
							Create
						</button>
					</form>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npm run check && npx tsc --noEmit`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/diagrams/DiagramVersionManager.tsx src/components/diagrams/DiagramShareDialog.tsx src/components/diagrams/CreateDiagramDialog.tsx
git commit -m "feat(diagrams): version, share and create dialogs"
```

---

### Task 11: Editor route `/diagrams/$id`

**Files:**
- Create: `src/routes/diagrams/$id.tsx`
- Modify: `src/routeTree.gen.ts` (auto-regenerated — never hand-edit)

- [ ] **Step 1: Create `src/routes/diagrams/$id.tsx`**

```tsx
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ArrowLeft, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CodeEditorPanel } from "@/components/diagrams/CodeEditorPanel";
import { DiagramPreview } from "@/components/diagrams/DiagramPreview";
import { DiagramShareDialog } from "@/components/diagrams/DiagramShareDialog";
import { DiagramVersionManager } from "@/components/diagrams/DiagramVersionManager";

export const Route = createFileRoute("/diagrams/$id")({
	ssr: false,
	component: DiagramEditor,
});

const toolbarBtn =
	"rounded-md border border-neutral-200 px-2.5 py-2 text-sm hover:bg-neutral-100";

const SAVE_DEBOUNCE_MS = 1000;

function DiagramEditor() {
	const { id } = Route.useParams();
	const diagramId = id as Id<"diagrams">;
	const { isAuthenticated } = useConvexAuth();
	const diagram = useQuery(
		api.diagrams.get,
		isAuthenticated ? { diagramId } : "skip",
	);
	const update = useMutation(api.diagrams.update);

	const [source, setSource] = useState<string | null>(null);
	const sourceRef = useRef<string | null>(null);
	const [dirty, setDirty] = useState(false);
	const [saving, setSaving] = useState(false);
	const [codeOpen, setCodeOpen] = useState(true);
	const [versionsOpen, setVersionsOpen] = useState(false);
	const [shareOpen, setShareOpen] = useState(false);

	// Adopt remote source when there are no unsaved local edits (covers the
	// initial load, restores, and edits arriving from another tab).
	useEffect(() => {
		if (diagram && !dirty) {
			setSource(diagram.source);
			sourceRef.current = diagram.source;
		}
	}, [diagram, dirty]);

	// Debounced save; only clears the dirty flag if nothing was typed while
	// the save was in flight.
	useEffect(() => {
		if (!dirty || source === null) return;
		const timer = setTimeout(async () => {
			const snapshot = source;
			setSaving(true);
			try {
				await update({ diagramId, source: snapshot });
			} finally {
				setSaving(false);
				if (sourceRef.current === snapshot) {
					setDirty(false);
				}
			}
		}, SAVE_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [dirty, source, diagramId, update]);

	if (diagram === undefined || source === null) {
		return (
			<AppShell>
				<p className="p-6 text-sm text-neutral-500">Loading…</p>
			</AppShell>
		);
	}

	const handleSourceChange = (next: string) => {
		sourceRef.current = next;
		setSource(next);
		setDirty(true);
	};

	return (
		<AppShell>
			<div className="flex h-full flex-col p-4">
				<header className="mb-3 flex flex-wrap items-center gap-2">
					<Link
						to="/diagrams"
						className={toolbarBtn}
						aria-label="Back to diagrams"
					>
						<ArrowLeft size={16} />
					</Link>
					<input
						key={diagram.title}
						defaultValue={diagram.title}
						onBlur={(e) => {
							const title = e.target.value.trim();
							if (title && title !== diagram.title) {
								update({ diagramId, title });
							}
						}}
						className="min-w-0 flex-1 rounded-md border border-transparent px-2 py-1.5 text-lg font-semibold hover:border-neutral-200 focus:border-neutral-200 focus:outline-none"
					/>
					<span className="rounded-full border border-neutral-200 px-2 py-0.5 text-[11px] uppercase tracking-wide text-neutral-500">
						{diagram.type}
					</span>
					<span className="w-16 text-right text-xs text-neutral-400">
						{saving ? "Saving…" : dirty ? "Unsaved" : "Saved"}
					</span>
					<button
						type="button"
						className={toolbarBtn}
						onClick={() => setVersionsOpen(true)}
					>
						Versions
					</button>
					<button
						type="button"
						className={toolbarBtn}
						onClick={() => setShareOpen(true)}
					>
						Share
					</button>
					<button
						type="button"
						className={toolbarBtn}
						onClick={() => setCodeOpen((v) => !v)}
						aria-label={codeOpen ? "Collapse code panel" : "Expand code panel"}
					>
						{codeOpen ? (
							<PanelLeftClose size={16} />
						) : (
							<PanelLeftOpen size={16} />
						)}
					</button>
				</header>

				<div className="flex h-[calc(100dvh-180px)] min-h-[320px] overflow-hidden rounded-lg border border-neutral-200 bg-white">
					{codeOpen ? (
						<div className="w-[38%] min-w-[260px] border-r border-neutral-200">
							<CodeEditorPanel
								value={source}
								language={diagram.type}
								onChange={handleSourceChange}
							/>
						</div>
					) : null}
					<div className="min-w-0 flex-1">
						<DiagramPreview type={diagram.type} source={source} />
					</div>
				</div>
			</div>

			<DiagramVersionManager
				diagramId={diagramId}
				open={versionsOpen}
				onOpenChange={setVersionsOpen}
			/>
			<DiagramShareDialog
				diagram={diagram}
				open={shareOpen}
				onOpenChange={setShareOpen}
			/>
		</AppShell>
	);
}
```

- [ ] **Step 2: Regenerate the route tree**

Run: `npm run generate-routes`
Expected: `src/routeTree.gen.ts` regenerated with `/diagrams/$id`.

- [ ] **Step 3: Verify it compiles**

Run: `npm run check && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/routes/diagrams/\$id.tsx src/routeTree.gen.ts
git commit -m "feat(diagrams): split-view editor route with debounced autosave"
```

(On PowerShell, quote the path instead: `git add 'src/routes/diagrams/$id.tsx' src/routeTree.gen.ts`.)

---

### Task 12: List page + navigation + manual editor verification

**Files:**
- Modify: `src/routes/diagrams/index.tsx` (placeholder → list page)
- Modify: `src/routes/dashboard/index.tsx` (ToolCard `soon` → `active`)
- Modify: `src/components/Sidebar.tsx` (remove "Soon" badge)

- [ ] **Step 1: Replace `src/routes/diagrams/index.tsx`**

```tsx
import { api } from "@convex/_generated/api";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Trash2, Workflow } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CreateDiagramDialog } from "@/components/diagrams/CreateDiagramDialog";
import { DIAGRAM_ENGINES } from "@/lib/diagramEngines";

export const Route = createFileRoute("/diagrams/")({
	ssr: false,
	component: DiagramsPage,
});

function DiagramsPage() {
	const navigate = useNavigate();
	const { isAuthenticated } = useConvexAuth();
	const diagrams = useQuery(api.diagrams.list, isAuthenticated ? {} : "skip");
	const create = useMutation(api.diagrams.create);
	const remove = useMutation(api.diagrams.remove);

	return (
		<AppShell>
			<div className="mx-auto max-w-5xl p-6">
				<header className="mb-6 flex items-center justify-between">
					<div>
						<p className="rm-label">Diagrams</p>
						<h1 className="text-2xl font-semibold">Your diagrams</h1>
					</div>
					<CreateDiagramDialog
						onCreate={async (input) => {
							const id = await create(input);
							await navigate({ to: "/diagrams/$id", params: { id } });
						}}
					/>
				</header>

				{diagrams === undefined ? (
					<p className="text-sm text-neutral-500">Loading…</p>
				) : diagrams.length === 0 ? (
					<p className="text-sm text-neutral-500">
						No diagrams yet. Create your first one.
					</p>
				) : (
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{diagrams.map((d) => (
							<div
								key={d._id}
								className="rounded-lg border border-neutral-200 bg-white p-4"
							>
								<button
									type="button"
									onClick={() =>
										navigate({ to: "/diagrams/$id", params: { id: d._id } })
									}
									className="flex w-full items-start gap-2 text-left"
								>
									<Workflow size={18} className="mt-0.5 text-neutral-400" />
									<span className="min-w-0">
										<span className="block truncate font-medium">
											{d.title}
										</span>
										<span className="block text-xs text-neutral-500">
											{DIAGRAM_ENGINES[d.type].label} ·{" "}
											{new Date(d._creationTime).toLocaleDateString()}
										</span>
									</span>
								</button>
								<div className="mt-3 flex justify-end">
									<button
										type="button"
										onClick={async () => {
											if (window.confirm(`Delete "${d.title}"?`)) {
												await remove({ diagramId: d._id });
											}
										}}
										className="flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-xs text-red-600 hover:bg-neutral-100"
									>
										<Trash2 size={12} /> Delete
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</AppShell>
	);
}
```

- [ ] **Step 2: Activate the dashboard ToolCard**

In `src/routes/dashboard/index.tsx`, replace the Diagrams `ToolCard`:

```tsx
						<ToolCard
							title="Diagrams"
							description="Live Mermaid and PlantUML editing."
							icon={Workflow}
							status="active"
							onOpen={() => navigate({ to: "/diagrams" })}
						/>
```

- [ ] **Step 3: Remove the "Soon" badge from the sidebar**

In `src/components/Sidebar.tsx`, replace the Diagrams link with:

```tsx
				<Link to="/diagrams" className={navLinkClass}>
					<Workflow size={16} /> Diagrams
				</Link>
```

(`src/components/BottomTabBar.tsx` has no "soon" treatment — leave it.)

- [ ] **Step 4: Verify it compiles**

Run: `npm run check && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 5: Manual verification of the full editor flow**

With `npx convex dev` and `npm run dev` running, in the browser:
1. Dashboard → Diagrams card is active → `/diagrams` list.
2. Create a Mermaid diagram → lands in the editor with the starter flowchart rendered.
3. Type — preview re-renders ~300 ms after pausing; status flips Unsaved → Saving… → Saved.
4. Introduce a syntax error (e.g. delete `}`) — last good diagram stays visible with a red error banner; fix it — banner clears.
5. Collapse/expand the code panel.
6. Create a PlantUML diagram — starter sequence diagram renders via Kroki (needs internet); errors from bad PlantUML show the Kroki message.
7. Versions: save a manual checkpoint, change the code, restore — editor updates live and an auto "Before restore" entry appears.
8. Reload `/diagrams/$id` directly (deep link) — no "Not authenticated" error.

Expected: all behave as described. Fix anything that doesn't before committing.

- [ ] **Step 6: Commit**

```bash
git add src/routes/diagrams/index.tsx src/routes/dashboard/index.tsx src/components/Sidebar.tsx
git commit -m "feat(diagrams): diagrams list page and live navigation entry"
```

---

### Task 13: Public share route `/share/diagram/$token`

**Files:**
- Create: `src/routes/share/diagram.$token.tsx`
- Modify: `src/routeTree.gen.ts` (auto-regenerated)

- [ ] **Step 1: Create `src/routes/share/diagram.$token.tsx`**

Dot-notation nests the path: this file serves `/share/diagram/$token`, coexisting with the roadmap route `/share/$token`.

```tsx
import { api } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { DiagramPreview } from "@/components/diagrams/DiagramPreview";

export const Route = createFileRoute("/share/diagram/$token")({
	ssr: false,
	component: ShareDiagramPage,
});

function ShareDiagramPage() {
	const { token } = Route.useParams();
	const diagram = useQuery(api.sharing.getPublicDiagram, {
		shareToken: token,
	});

	if (diagram === undefined) {
		return <p className="p-6 text-sm text-neutral-500">Loading…</p>;
	}
	if (diagram === null) {
		return (
			<div className="grid min-h-screen place-items-center p-6 text-center">
				<div>
					<h1 className="text-lg font-semibold">Diagram not available</h1>
					<p className="text-sm text-neutral-500">
						This link is invalid or sharing was turned off.
					</p>
				</div>
			</div>
		);
	}
	return (
		<div className="min-h-screen bg-neutral-50 text-neutral-900">
			<div className="mx-auto max-w-5xl p-6">
				<p className="rm-label">Shared diagram</p>
				<h1 className="mb-4 text-2xl font-semibold">{diagram.title}</h1>
				<div className="h-[calc(100dvh-160px)] min-h-[320px] overflow-hidden rounded-lg border border-neutral-200 bg-white">
					<DiagramPreview type={diagram.type} source={diagram.source} />
				</div>
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Regenerate routes + verify it compiles**

Run: `npm run generate-routes && npm run check && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 3: Manual verification**

With both dev processes running: open a diagram → Share → Create share link → copy → open in a private/incognito window (not signed in).
Expected: the diagram renders read-only. Then: Regenerate link → old URL shows "Diagram not available", new URL works. Turn off sharing → new URL also shows "Diagram not available".

- [ ] **Step 4: Commit**

```bash
git add src/routes/share/diagram.\$token.tsx src/routeTree.gen.ts
git commit -m "feat(diagrams): public read-only share route"
```

(On PowerShell: `git add 'src/routes/share/diagram.$token.tsx' src/routeTree.gen.ts`.)

---

### Task 14: Final verification gates

**Files:** none (verification only; fix-up commits if anything fails)

- [ ] **Step 1: Run every gate**

```bash
npm run check
npx tsc --noEmit
npx convex dev --once
npm run test
npm run build
```

Expected: all pass. `npm run test` runs the full suite — roadmaps tests must still be green (Task 9 touched shared code).

- [ ] **Step 2: Full manual pass (both dev processes running)**

1. Create one diagram of each type; edit both; verify debounced rendering and last-good-render retention with intentional errors in each syntax.
2. Save/restore versions on a diagram; verify the auto "Before restore" entry and live editor update.
3. Roadmaps regression: open a roadmap → Versions dialog still works (save + restore).
4. Share a diagram; verify in incognito; regenerate + disable.
5. Deep-link reload of `/diagrams` and `/diagrams/$id` while signed in.
6. Mobile width (devtools): list page and editor are usable; code panel toggle works.

- [ ] **Step 3: Commit any fixes, then mark the plan complete**

```bash
git add -A
git commit -m "fix(diagrams): final verification fixes"
```

(Skip the commit if there were no fixes.)
