import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/** Returns the authenticated user's id (Clerk subject), or throws. */
export async function requireUser(ctx: QueryCtx | MutationCtx): Promise<string> {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throw new Error("Not authenticated");
	}
	return identity.subject;
}

/** Verifies the caller owns the roadmap; returns the user id and the roadmap doc. */
export async function requireRoadmapOwner(
	ctx: QueryCtx | MutationCtx,
	roadmapId: Id<"roadmaps">,
): Promise<{ userId: string; roadmap: Doc<"roadmaps"> }> {
	const userId = await requireUser(ctx);
	const roadmap = await ctx.db.get(roadmapId);
	if (!roadmap || roadmap.userId !== userId) {
		throw new Error("Roadmap not found or access denied");
	}
	return { userId, roadmap };
}
