import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { SEEDERS } from "./lib/seed";

/**
 * Dev-only seed. Wipes the demo account's data, then re-populates it with multiple
 * roadmaps and sample diagrams. Idempotent — safe to re-run locally and in CI.
 * NOT auth-gated — invoke manually:
 *   npx convex run seed:seedDemo '{}'
 * Pass {"userId":"..."} to target a different account.
 */
const DEMO_USER_ID = "user_2tTlbmSTh4kbXmg9v6EN7YW3B4d";

export const seedDemo = mutation({
	args: { userId: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const userId = args.userId ?? DEMO_USER_ID;
		// Wipe everything first, then seed everything — keeps cross-type references
		// clean if any are ever introduced.
		for (const seeder of SEEDERS) {
			await seeder.wipe(ctx, userId);
		}
		const counts: Record<string, number> = {};
		for (const seeder of SEEDERS) {
			counts[seeder.name] = await seeder.seed(ctx, userId);
		}
		return counts;
	},
});
