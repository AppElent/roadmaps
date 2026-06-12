import type { MutationCtx } from "../../_generated/server";

/**
 * One seedable object type. Each module owns its demo data, knows its own child
 * tables/indexes, and reports how many top-level rows it created.
 */
export interface Seeder {
	/** Stable key used in the seedDemo counts map. */
	name: string;
	/** Delete every row this seeder owns for the user (rows + children + versions). */
	wipe(ctx: MutationCtx, userId: string): Promise<void>;
	/** Insert this seeder's demo content; returns the number of top-level rows. */
	seed(ctx: MutationCtx, userId: string): Promise<number>;
}
