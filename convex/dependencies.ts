import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { requireRoadmapOwner } from "./lib/auth";

/** True if `start` can already reach `target` along existing edges. */
function canReach(
	edges: Doc<"dependencies">[],
	start: Id<"items">,
	target: Id<"items">,
): boolean {
	const adjacency = new Map<string, Id<"items">[]>();
	for (const e of edges) {
		const list = adjacency.get(e.predecessorId);
		if (list) list.push(e.successorId);
		else adjacency.set(e.predecessorId, [e.successorId]);
	}
	const seen = new Set<string>();
	const stack: Id<"items">[] = [start];
	while (stack.length) {
		const node = stack.pop() as Id<"items">;
		if (node === target) return true;
		if (seen.has(node)) continue;
		seen.add(node);
		for (const next of adjacency.get(node) ?? []) stack.push(next);
	}
	return false;
}

export const create = mutation({
	args: {
		roadmapId: v.id("roadmaps"),
		predecessorId: v.id("items"),
		successorId: v.id("items"),
	},
	handler: async (ctx, args) => {
		const { userId } = await requireRoadmapOwner(ctx, args.roadmapId);
		if (args.predecessorId === args.successorId) {
			throw new Error("An item cannot depend on itself");
		}
		const [pred, succ] = await Promise.all([
			ctx.db.get(args.predecessorId),
			ctx.db.get(args.successorId),
		]);
		if (
			!pred ||
			!succ ||
			pred.roadmapId !== args.roadmapId ||
			succ.roadmapId !== args.roadmapId
		) {
			throw new Error("One or both items are not in this roadmap");
		}
		const existing = await ctx.db
			.query("dependencies")
			.withIndex("by_roadmap", (q) => q.eq("roadmapId", args.roadmapId))
			.collect();
		if (
			existing.some(
				(d) =>
					d.predecessorId === args.predecessorId &&
					d.successorId === args.successorId,
			)
		) {
			throw new Error("This dependency already exists");
		}
		// Adding pred -> succ cycles iff succ can already reach pred.
		if (canReach(existing, args.successorId, args.predecessorId)) {
			throw new Error("This dependency would create a cycle");
		}
		return await ctx.db.insert("dependencies", {
			roadmapId: args.roadmapId,
			userId,
			predecessorId: args.predecessorId,
			successorId: args.successorId,
		});
	},
});

export const remove = mutation({
	args: { dependencyId: v.id("dependencies") },
	handler: async (ctx, args) => {
		const dep = await ctx.db.get(args.dependencyId);
		if (!dep) throw new Error("Dependency not found");
		await requireRoadmapOwner(ctx, dep.roadmapId);
		await ctx.db.delete(args.dependencyId);
	},
});
