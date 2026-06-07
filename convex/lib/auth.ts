import type { MutationCtx, QueryCtx } from "../_generated/server";

/** Returns the authenticated user's id (Clerk subject), or throws. */
export async function requireUser(ctx: QueryCtx | MutationCtx): Promise<string> {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throw new Error("Not authenticated");
	}
	return identity.subject;
}
