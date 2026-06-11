import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { DEFAULT_STATUS_OPTIONS, STATUS_FIELD_KEY } from "./lib/defaults";
import type { fieldValueValidator } from "./schema";
import type { Infer } from "convex/values";

/**
 * Dev-only seed. Inserts a demo roadmap (fields, lanes, items, milestones) for a
 * single user. NOT auth-gated — meant to be invoked manually via
 *   npx convex run seed:seedDemo '{}'
 * Pass {"userId":"..."} to override the hardcoded demo account.
 */

const DEMO_USER_ID = "user_2tTlbmSTh4kbXmg9v6EN7YW3B4d";

/** Epoch ms for a UTC calendar date in 2026. */
const d = (month: number, day: number): number =>
	Date.UTC(2026, month - 1, day);

type FieldValue = Infer<typeof fieldValueValidator>;

const TEAM_OPTIONS = [
	{ id: "design", label: "Design", color: "#c7a3e0" },
	{ id: "eng", label: "Engineering", color: "#9bc2e0" },
	{ id: "gtm", label: "Go-to-market", color: "#e0c79b" },
];

export const seedDemo = mutation({
	args: { userId: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const userId = args.userId ?? DEMO_USER_ID;

		const roadmapId = await ctx.db.insert("roadmaps", {
			userId,
			name: "Product Roadmap 2026",
			description: "Demo roadmap seeded for local development.",
			startDate: d(1, 1),
			endDate: d(12, 31),
			defaultZoom: "month",
			colorByFieldKey: STATUS_FIELD_KEY,
			visibility: "private",
			archived: false,
		});

		// Fields: system status (reused from defaults) + team select + effort number.
		await ctx.db.insert("fields", {
			roadmapId,
			userId,
			key: STATUS_FIELD_KEY,
			label: "Status",
			type: "select",
			options: DEFAULT_STATUS_OPTIONS,
			order: 0,
			showInTable: true,
			isSystem: true,
		});
		await ctx.db.insert("fields", {
			roadmapId,
			userId,
			key: "team",
			label: "Team",
			type: "select",
			options: TEAM_OPTIONS,
			order: 1,
			showInTable: true,
		});
		await ctx.db.insert("fields", {
			roadmapId,
			userId,
			key: "effort",
			label: "Effort (pts)",
			type: "number",
			order: 2,
			showInTable: true,
		});

		// Lanes: Now / Next / Later.
		const laneNames = ["Now", "Next", "Later"];
		const laneIds: Array<Id<"lanes">> = [];
		for (let i = 0; i < laneNames.length; i++) {
			const laneId = await ctx.db.insert("lanes", {
				roadmapId,
				userId,
				name: laneNames[i],
				order: i,
				isDefault: i === 0,
			});
			laneIds.push(laneId);
		}

		// Items spread across lanes, statuses, teams and the year.
		const items: Array<{
			title: string;
			lane: number;
			start: number;
			end: number;
			description?: string;
			values: Record<string, FieldValue>;
		}> = [
			{
				title: "Design system refresh",
				lane: 0,
				start: d(1, 6),
				end: d(2, 27),
				description: "Token overhaul and component audit.",
				values: { status: "done", team: "design", effort: 8 },
			},
			{
				title: "Auth & onboarding revamp",
				lane: 0,
				start: d(2, 2),
				end: d(3, 20),
				values: { status: "in_progress", team: "eng", effort: 13 },
			},
			{
				title: "Realtime collaboration",
				lane: 0,
				start: d(3, 9),
				end: d(5, 15),
				description: "Multi-cursor editing on shared roadmaps.",
				values: { status: "in_progress", team: "eng", effort: 21 },
			},
			{
				title: "Public share links",
				lane: 1,
				start: d(4, 1),
				end: d(5, 8),
				values: { status: "planned", team: "eng", effort: 5 },
			},
			{
				title: "Pricing & billing",
				lane: 1,
				start: d(5, 4),
				end: d(7, 3),
				description: "Seat-based plans and self-serve upgrade.",
				values: { status: "planned", team: "gtm", effort: 13 },
			},
			{
				title: "Mobile responsive timeline",
				lane: 1,
				start: d(6, 15),
				end: d(8, 14),
				values: { status: "blocked", team: "design", effort: 8 },
			},
			{
				title: "Analytics dashboard",
				lane: 2,
				start: d(8, 3),
				end: d(9, 25),
				values: { status: "planned", team: "eng", effort: 13 },
			},
			{
				title: "Template marketplace",
				lane: 2,
				start: d(9, 14),
				end: d(11, 6),
				description: "Community-shared roadmap templates.",
				values: { status: "planned", team: "gtm", effort: 21 },
			},
			{
				title: "AI roadmap assistant",
				lane: 2,
				start: d(10, 19),
				end: d(12, 18),
				values: { status: "planned", team: "eng", effort: 21 },
			},
		];

		const perLaneOrder = new Map<number, number>();
		for (const it of items) {
			const order = perLaneOrder.get(it.lane) ?? 0;
			perLaneOrder.set(it.lane, order + 1);
			await ctx.db.insert("items", {
				roadmapId,
				laneId: laneIds[it.lane],
				userId,
				title: it.title,
				startDate: it.start,
				endDate: it.end,
				description: it.description,
				values: it.values,
				order,
			});
		}

		// Milestones.
		await ctx.db.insert("milestones", {
			roadmapId,
			userId,
			name: "Q2 Launch",
			date: d(6, 30),
			color: "#9bd5a8",
		});
		await ctx.db.insert("milestones", {
			roadmapId,
			userId,
			name: "GA",
			date: d(11, 15),
			color: "#e0c79b",
		});

		return roadmapId;
	},
});
