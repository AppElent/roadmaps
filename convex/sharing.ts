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
