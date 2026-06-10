import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireRoadmapOwner } from "./lib/auth";
import { applySnapshot, saveVersion } from "./lib/snapshot";
import { roadmapSnapshotValidator } from "./schema";

export const replaceRoadmap = mutation({
	args: {
		roadmapId: v.id("roadmaps"),
		payload: roadmapSnapshotValidator,
	},
	handler: async (ctx, { roadmapId, payload }) => {
		const { userId } = await requireRoadmapOwner(ctx, roadmapId);
		await saveVersion(ctx, roadmapId, userId, "Before JSON import", "auto");
		await applySnapshot(ctx, roadmapId, userId, payload);
	},
});
