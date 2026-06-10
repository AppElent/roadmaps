import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("replaceRoadmap auto-checkpoints the prior state before importing", async () => {
	const t = convexTest(schema, modules);
	const roadmapId = await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.roadmaps.create, { name: "Before", startDate: 0, endDate: 100 });

	await t.withIdentity({ subject: "user_alex" }).mutation(api.io.replaceRoadmap, {
		roadmapId,
		payload: {
			name: "After",
			startDate: 0,
			endDate: 100,
			defaultZoom: "month",
			fields: [],
			lanes: [{ name: "Lane A", order: 0, isDefault: true }],
			items: [],
			milestones: [],
		},
	});

	const bundle = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId });
	expect(bundle.roadmap.name).toBe("After");

	const list = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmapVersions.list, { roadmapId });
	expect(list.some((v) => v.kind === "auto" && v.label === "Before JSON import")).toBe(true);
});
