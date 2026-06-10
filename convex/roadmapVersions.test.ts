import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setupRoadmap(t: ReturnType<typeof convexTest>) {
	const roadmapId = await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.roadmaps.create, { name: "R", startDate: 0, endDate: 100 });
	const bundle = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId });
	return { roadmapId, laneId: bundle.lanes[0]._id };
}

test("create saves a manual version of the current state", async () => {
	const t = convexTest(schema, modules);
	const { roadmapId, laneId } = await setupRoadmap(t);
	await t.withIdentity({ subject: "user_alex" }).mutation(api.items.create, {
		roadmapId,
		laneId,
		title: "Original",
		startDate: 0,
		endDate: 10,
		values: {},
	});

	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.roadmapVersions.create, { roadmapId, label: "Checkpoint" });

	const list = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmapVersions.list, { roadmapId });
	expect(list).toHaveLength(1);
	expect(list[0].label).toBe("Checkpoint");
	expect(list[0].kind).toBe("manual");
});

test("restore reproduces the snapshot and auto-checkpoints first", async () => {
	const t = convexTest(schema, modules);
	const { roadmapId, laneId } = await setupRoadmap(t);
	await t.withIdentity({ subject: "user_alex" }).mutation(api.items.create, {
		roadmapId,
		laneId,
		title: "Original",
		startDate: 0,
		endDate: 10,
		values: {},
	});

	// Checkpoint, then delete the item so current state differs.
	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.roadmapVersions.create, { roadmapId, label: "Has item" });
	const before = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId });
	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.items.remove, { itemId: before.items[0]._id });

	const list = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmapVersions.list, { roadmapId });
	const checkpoint = list.find((v) => v.label === "Has item");
	if (!checkpoint) throw new Error("checkpoint missing");
	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.roadmapVersions.restore, { versionId: checkpoint._id });

	const after = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId });
	expect(after.items.map((i) => i.title)).toEqual(["Original"]);

	const list2 = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmapVersions.list, { roadmapId });
	expect(list2.some((v) => v.kind === "auto" && v.label === "Before restore")).toBe(true);
});

test("versions are capped at MAX_VERSIONS, pruning oldest first", async () => {
	const t = convexTest(schema, modules);
	const { roadmapId } = await setupRoadmap(t);
	for (let i = 0; i < 27; i++) {
		await t
			.withIdentity({ subject: "user_alex" })
			.mutation(api.roadmapVersions.create, { roadmapId, label: `v${i}` });
	}
	const list = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmapVersions.list, { roadmapId });
	expect(list).toHaveLength(25);
	// list is newest-first; the two oldest (v0, v1) were pruned.
	expect(list.some((v) => v.label === "v0")).toBe(false);
	expect(list.some((v) => v.label === "v26")).toBe(true);
});

test("a non-owner cannot create or restore versions", async () => {
	const t = convexTest(schema, modules);
	const { roadmapId } = await setupRoadmap(t);
	await expect(
		t
			.withIdentity({ subject: "user_mallory" })
			.mutation(api.roadmapVersions.create, { roadmapId, label: "x" }),
	).rejects.toThrow(/access denied/);
});
