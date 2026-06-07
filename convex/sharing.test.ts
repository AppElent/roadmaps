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
	const bundle = await t.query(api.sharing.getPublicRoadmap, {
		shareToken: token,
	});
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
	expect(
		await t.query(api.sharing.getPublicRoadmap, { shareToken: token }),
	).toBeNull();
	expect(
		await t.query(api.sharing.getPublicRoadmap, { shareToken: "bogus" }),
	).toBeNull();
});
