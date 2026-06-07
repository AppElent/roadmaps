import { query } from "./_generated/server";
import { requireUser } from "./lib/auth";

/** Round-trip probe: returns the caller's id, or throws if unauthenticated. */
export const me = query({
	args: {},
	handler: async (ctx) => {
		const userId = await requireUser(ctx);
		return { userId };
	},
});
