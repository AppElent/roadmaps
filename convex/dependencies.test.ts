import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setup(t: ReturnType<typeof convexTest>) {
	const roadmapId = await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.roadmaps.create, { name: "R", startDate: 0, endDate: 100 });
	const bundle = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId });
	const laneId = bundle.lanes[0]._id;
	const mkItem = (title: string) =>
		t.withIdentity({ subject: "user_alex" }).mutation(api.items.create, {
			roadmapId,
			laneId,
			title,
			startDate: 0,
			endDate: 10,
			values: {},
		});
	return { roadmapId, laneId, mkItem };
}

test("getBundle includes an empty dependencies array", async () => {
	const t = convexTest(schema, modules);
	const { roadmapId } = await setup(t);
	const bundle = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId });
	expect(bundle.dependencies).toEqual([]);
});

test("create adds a dependency visible in the bundle", async () => {
	const t = convexTest(schema, modules);
	const { roadmapId, mkItem } = await setup(t);
	const a = await mkItem("A");
	const b = await mkItem("B");
	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.dependencies.create, {
			roadmapId,
			predecessorId: a,
			successorId: b,
		});
	const bundle = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId });
	expect(bundle.dependencies).toHaveLength(1);
	expect(bundle.dependencies[0].predecessorId).toBe(a);
	expect(bundle.dependencies[0].successorId).toBe(b);
});

test("create rejects self-links, duplicates, cycles, and non-owners", async () => {
	const t = convexTest(schema, modules);
	const { roadmapId, mkItem } = await setup(t);
	const a = await mkItem("A");
	const b = await mkItem("B");
	const call = (predecessorId: typeof a, successorId: typeof b) =>
		t
			.withIdentity({ subject: "user_alex" })
			.mutation(api.dependencies.create, {
				roadmapId,
				predecessorId,
				successorId,
			});

	await expect(call(a, a)).rejects.toThrow(/self/i);
	await call(a, b);
	await expect(call(a, b)).rejects.toThrow(/already exists/i);
	await expect(call(b, a)).rejects.toThrow(/cycle/i);
	await expect(
		t
			.withIdentity({ subject: "user_mallory" })
			.mutation(api.dependencies.create, {
				roadmapId,
				predecessorId: a,
				successorId: b,
			}),
	).rejects.toThrow(/access denied/);
});

test("create rejects items from a different roadmap", async () => {
	const t = convexTest(schema, modules);
	const first = await setup(t);
	const second = await setup(t);
	const a = await first.mkItem("A");
	const foreign = await second.mkItem("Foreign");
	await expect(
		t
			.withIdentity({ subject: "user_alex" })
			.mutation(api.dependencies.create, {
				roadmapId: first.roadmapId,
				predecessorId: a,
				successorId: foreign,
			}),
	).rejects.toThrow(/not in this roadmap/i);
});

test("remove deletes a dependency", async () => {
	const t = convexTest(schema, modules);
	const { roadmapId, mkItem } = await setup(t);
	const a = await mkItem("A");
	const b = await mkItem("B");
	const depId = await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.dependencies.create, {
			roadmapId,
			predecessorId: a,
			successorId: b,
		});
	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.dependencies.remove, { dependencyId: depId });
	const bundle = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId });
	expect(bundle.dependencies).toEqual([]);
});

test("deleting an item removes dependencies referencing it", async () => {
	const t = convexTest(schema, modules);
	const { roadmapId, mkItem } = await setup(t);
	const a = await mkItem("A");
	const b = await mkItem("B");
	const c = await mkItem("C");
	// a -> b (b is successor), b -> c (b is predecessor)
	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.dependencies.create, {
			roadmapId,
			predecessorId: a,
			successorId: b,
		});
	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.dependencies.create, {
			roadmapId,
			predecessorId: b,
			successorId: c,
		});
	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.items.remove, { itemId: b });
	const bundle = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId });
	expect(bundle.dependencies).toEqual([]);
});

test("dependencies survive a version snapshot + restore", async () => {
	const t = convexTest(schema, modules);
	const { roadmapId, mkItem } = await setup(t);
	const a = await mkItem("A");
	const b = await mkItem("B");
	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.dependencies.create, {
			roadmapId,
			predecessorId: a,
			successorId: b,
		});
	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.roadmapVersions.create, { roadmapId, label: "snap" });
	// Mutate current state: delete the dependency.
	const mid = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId });
	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.dependencies.remove, {
			dependencyId: mid.dependencies[0]._id,
		});
	const versions = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmapVersions.list, { roadmapId });
	const snap = versions.find((v) => v.label === "snap");
	if (!snap) throw new Error("snapshot missing");
	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.roadmapVersions.restore, { versionId: snap._id });
	const after = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId });
	expect(after.dependencies).toHaveLength(1);
	const itemTitle = (id: typeof a) =>
		after.items.find((i) => i._id === id)?.title;
	expect(itemTitle(after.dependencies[0].predecessorId)).toBe("A");
	expect(itemTitle(after.dependencies[0].successorId)).toBe("B");
});

test("duplicate clones dependencies onto the new items", async () => {
	const t = convexTest(schema, modules);
	const { roadmapId, mkItem } = await setup(t);
	const a = await mkItem("A");
	const b = await mkItem("B");
	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.dependencies.create, {
			roadmapId,
			predecessorId: a,
			successorId: b,
		});
	const newId = await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.roadmaps.duplicate, { roadmapId });
	const copy = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId: newId });
	expect(copy.dependencies).toHaveLength(1);
	const title = (id: (typeof copy.items)[number]["_id"]) =>
		copy.items.find((i) => i._id === id)?.title;
	expect(title(copy.dependencies[0].predecessorId)).toBe("A");
	expect(title(copy.dependencies[0].successorId)).toBe("B");
	// The clone references the NEW items, not the originals.
	expect(copy.dependencies[0].predecessorId).not.toBe(a);
});
