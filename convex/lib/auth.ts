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
