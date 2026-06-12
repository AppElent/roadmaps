import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const USER = "user_seed_test";

test("seedDemo inserts the expected roadmaps and diagrams", async () => {
	const t = convexTest(schema, modules);
	const counts = await t.mutation(api.seed.seedDemo, { userId: USER });
	expect(counts).toEqual({ roadmaps: 4, diagrams: 7 });

	const { roadmaps, diagrams } = await t.run(async (ctx) => {
		const roadmaps = await ctx.db
			.query("roadmaps")
			.withIndex("by_user", (q) => q.eq("userId", USER))
			.collect();
		const diagrams = await ctx.db
			.query("diagrams")
			.withIndex("by_user", (q) => q.eq("userId", USER))
			.collect();
		return { roadmaps, diagrams };
	});
	expect(roadmaps).toHaveLength(4);
	expect(diagrams).toHaveLength(7);
});

test("seeded items carry their custom field values", async () => {
	const t = convexTest(schema, modules);
	await t.mutation(api.seed.seedDemo, { userId: USER });

	const items = await t.run(async (ctx) => {
		const all = await ctx.db
			.query("roadmaps")
			.withIndex("by_user", (q) => q.eq("userId", USER))
			.collect();
		const marketing = all.find((r) => r.name === "Marketing & GTM 2026");
		if (!marketing) throw new Error("Marketing roadmap not seeded");
		return await ctx.db
			.query("items")
			.withIndex("by_roadmap", (q) => q.eq("roadmapId", marketing._id))
			.collect();
	});

	// Edge case: at least one item has an empty multiselect channel value.
	expect(
		items.some(
			(it) => Array.isArray(it.values.channel) && it.values.channel.length === 0,
		),
	).toBe(true);
	// Edge case: at least one item has a budget of 0.
	expect(items.some((it) => it.values.budget === 0)).toBe(true);
});

test("seedDemo is idempotent across re-runs", async () => {
	const t = convexTest(schema, modules);
	await t.mutation(api.seed.seedDemo, { userId: USER });
	await t.mutation(api.seed.seedDemo, { userId: USER });

	const counts = await t.run(async (ctx) => ({
		roadmaps: (await ctx.db.query("roadmaps").collect()).length,
		diagrams: (await ctx.db.query("diagrams").collect()).length,
		items: (await ctx.db.query("items").collect()).length,
		lanes: (await ctx.db.query("lanes").collect()).length,
		fields: (await ctx.db.query("fields").collect()).length,
	}));

	// Two runs must equal one run — the wipe removed the first run's rows.
	expect(counts.roadmaps).toBe(4);
	expect(counts.diagrams).toBe(7);
	expect(counts.items).toBeGreaterThan(0);
	expect(counts.lanes).toBeGreaterThan(0);
	expect(counts.fields).toBeGreaterThan(0);
});
