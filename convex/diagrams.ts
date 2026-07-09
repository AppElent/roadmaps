import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { saveDiagramVersion } from "./diagramVersions";
import { requireDiagramOwner, requireUser } from "./lib/auth";
import { diagramTypeValidator } from "./schema";

export const list = query({
	args: {},
	handler: async (ctx) => {
		const userId = await requireUser(ctx);
		const diagrams = await ctx.db
			.query("diagrams")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
		return diagrams.filter((d) => !d.archived);
	},
});

export const get = query({
	args: { diagramId: v.id("diagrams") },
	handler: async (ctx, args) => {
		const { diagram } = await requireDiagramOwner(ctx, args.diagramId);
		return diagram;
	},
});

export const create = mutation({
	args: {
		title: v.string(),
		type: diagramTypeValidator,
		source: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = await requireUser(ctx);
		return await ctx.db.insert("diagrams", {
			userId,
			title: args.title,
			type: args.type,
			source: args.source ?? "",
			visibility: "private",
			archived: false,
		});
	},
});

export const update = mutation({
	args: {
		diagramId: v.id("diagrams"),
		title: v.optional(v.string()),
		type: v.optional(diagramTypeValidator),
		source: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await requireDiagramOwner(ctx, args.diagramId);
		const { diagramId, ...patch } = args;
		await ctx.db.patch(diagramId, patch);
	},
});

export const remove = mutation({
	args: { diagramId: v.id("diagrams") },
	handler: async (ctx, args) => {
		await requireDiagramOwner(ctx, args.diagramId);
		const versions = await ctx.db
			.query("diagramVersions")
			.withIndex("by_diagram", (q) => q.eq("diagramId", args.diagramId))
			.collect();
		for (const row of versions) {
			await ctx.db.delete(row._id);
		}
		await ctx.db.delete(args.diagramId);
	},
});

export const enableShare = mutation({
	args: { diagramId: v.id("diagrams") },
	handler: async (ctx, args) => {
		const { diagram } = await requireDiagramOwner(ctx, args.diagramId);
		const token = diagram.shareToken ?? crypto.randomUUID().replace(/-/g, "");
		await ctx.db.patch(args.diagramId, {
			visibility: "link",
			shareToken: token,
		});
		return token;
	},
});

export const disableShare = mutation({
	args: { diagramId: v.id("diagrams") },
	handler: async (ctx, args) => {
		await requireDiagramOwner(ctx, args.diagramId);
		await ctx.db.patch(args.diagramId, {
			visibility: "private",
			shareToken: undefined,
		});
	},
});

export const regenerateShare = mutation({
	args: { diagramId: v.id("diagrams") },
	handler: async (ctx, args) => {
		const { diagram } = await requireDiagramOwner(ctx, args.diagramId);
		if (diagram.visibility !== "link") {
			throw new Error("Sharing is not enabled");
		}
		const token = crypto.randomUUID().replace(/-/g, "");
		await ctx.db.patch(args.diagramId, { shareToken: token });
		return token;
	},
});

/** Whole-document replace used by the AI chat: checkpoint first, then patch. */
export const replace = mutation({
	args: {
		diagramId: v.id("diagrams"),
		title: v.string(),
		type: diagramTypeValidator,
		source: v.string(),
	},
	handler: async (ctx, { diagramId, ...doc }) => {
		const { diagram } = await requireDiagramOwner(ctx, diagramId);
		await saveDiagramVersion(ctx, diagram, "Before AI edit", "auto");
		await ctx.db.patch(diagramId, doc);
	},
});
