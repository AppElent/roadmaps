import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRoadmapOwner } from "./lib/auth";
import { applySnapshot, saveVersion } from "./lib/snapshot";

export const list = query({
	args: { roadmapId: v.id("roadmaps") },
	handler: async (ctx, { roadmapId }) => {
		await requireRoadmapOwner(ctx, roadmapId);
		const versions = await ctx.db
			.query("roadmapVersions")
			.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmapId))
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
	args: { roadmapId: v.id("roadmaps"), label: v.string() },
	handler: async (ctx, { roadmapId, label }) => {
		const { userId } = await requireRoadmapOwner(ctx, roadmapId);
		const existing = await ctx.db
			.query("roadmapVersions")
			.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmapId))
			.collect();
		const finalLabel = label.trim() || `Version ${existing.length + 1}`;
		await saveVersion(ctx, roadmapId, userId, finalLabel, "manual");
	},
});

export const restore = mutation({
	args: { versionId: v.id("roadmapVersions") },
	handler: async (ctx, { versionId }) => {
		const version = await ctx.db.get(versionId);
		if (!version) throw new Error("Version not found");
		const { userId } = await requireRoadmapOwner(ctx, version.roadmapId);
		await saveVersion(ctx, version.roadmapId, userId, "Before restore", "auto");
		await applySnapshot(ctx, version.roadmapId, userId, version.snapshot);
	},
});
