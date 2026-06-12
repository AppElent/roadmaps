import type { Infer } from "convex/values";
import { DEFAULT_STATUS_OPTIONS, STATUS_FIELD_KEY } from "../defaults";
import { applySnapshot, type RoadmapSnapshot } from "../snapshot";
import type { fieldOptionValidator } from "../../schema";
import type { Seeder } from "./types";

type FieldOption = Infer<typeof fieldOptionValidator>;

export interface RoadmapSeed {
	description?: string;
	visibility: "private" | "link";
	shareToken?: string;
	archived: boolean;
	snapshot: RoadmapSnapshot;
}

/** Epoch ms for a UTC calendar date. */
const d = (year: number, month: number, day: number): number =>
	Date.UTC(year, month - 1, day);

const TEAM_OPTIONS: FieldOption[] = [
	{ id: "design", label: "Design", color: "#c7a3e0" },
	{ id: "eng", label: "Engineering", color: "#9bc2e0" },
	{ id: "gtm", label: "Go-to-market", color: "#e0c79b" },
];

const PRIORITY_OPTIONS: FieldOption[] = [
	{ id: "low", label: "Low", color: "#9bc2e0" },
	{ id: "med", label: "Medium", color: "#e0c79b" },
	{ id: "high", label: "High", color: "#e09b9b" },
];

const CHANNEL_OPTIONS: FieldOption[] = [
	{ id: "email", label: "Email", color: "#9bc2e0" },
	{ id: "social", label: "Social", color: "#c7a3e0" },
	{ id: "seo", label: "SEO", color: "#9bd5a8" },
	{ id: "events", label: "Events", color: "#e0c79b" },
	{ id: "paid", label: "Paid", color: "#e09b9b" },
];

const SEVERITY_OPTIONS: FieldOption[] = [
	{ id: "low", label: "Low", color: "#9bd5a8" },
	{ id: "med", label: "Medium", color: "#e0c79b" },
	{ id: "high", label: "High", color: "#e09b9b" },
	{ id: "critical", label: "Critical", color: "#d46a6a" },
];

const statusField = {
	key: STATUS_FIELD_KEY,
	label: "Status",
	type: "select" as const,
	options: DEFAULT_STATUS_OPTIONS,
	order: 0,
	showInTable: true,
	isSystem: true,
};

const product: RoadmapSnapshot = {
	name: "Product Roadmap 2026",
	startDate: d(2026, 1, 1),
	endDate: d(2026, 12, 31),
	defaultZoom: "month",
	colorByFieldKey: STATUS_FIELD_KEY,
	barColorMode: "left",
	fields: [
		statusField,
		{ key: "team", label: "Team", type: "select", options: TEAM_OPTIONS, order: 1, showInTable: true },
		{ key: "effort", label: "Effort (pts)", type: "number", order: 2, showInTable: true },
	],
	lanes: [
		{ name: "Now", order: 0, isDefault: true },
		{ name: "Next", order: 1 },
		{ name: "Later", order: 2 },
	],
	items: [
		{ title: "Design system refresh", laneIndex: 0, startDate: d(2026, 1, 6), endDate: d(2026, 2, 27), description: "Token overhaul and component audit.", values: { status: "done", team: "design", effort: 8 }, order: 0 },
		{ title: "Auth & onboarding revamp", laneIndex: 0, startDate: d(2026, 2, 2), endDate: d(2026, 3, 20), values: { status: "in_progress", team: "eng", effort: 13 }, order: 1 },
		{ title: "Realtime collaboration", laneIndex: 0, startDate: d(2026, 3, 9), endDate: d(2026, 5, 15), description: "Multi-cursor editing on shared roadmaps.", values: { status: "in_progress", team: "eng", effort: 21 }, order: 2 },
		{ title: "Public share links", laneIndex: 1, startDate: d(2026, 4, 1), endDate: d(2026, 5, 8), values: { status: "planned", team: "eng", effort: 5 }, order: 0 },
		{ title: "Pricing & billing", laneIndex: 1, startDate: d(2026, 5, 4), endDate: d(2026, 7, 3), description: "Seat-based plans and self-serve upgrade.", values: { status: "planned", team: "gtm", effort: 13 }, order: 1 },
		// Edge case: optional number field (effort) omitted, no description.
		{ title: "Mobile responsive timeline", laneIndex: 1, startDate: d(2026, 6, 15), endDate: d(2026, 8, 14), values: { status: "blocked", team: "design" }, order: 2 },
		{ title: "Analytics dashboard", laneIndex: 2, startDate: d(2026, 8, 3), endDate: d(2026, 9, 25), values: { status: "planned", team: "eng", effort: 13 }, order: 0 },
		// Edge case: optional number field (effort) omitted, but has a description.
		{ title: "Template marketplace", laneIndex: 2, startDate: d(2026, 9, 14), endDate: d(2026, 11, 6), description: "Community-shared roadmap templates.", values: { status: "planned", team: "gtm" }, order: 1 },
		{ title: "AI roadmap assistant", laneIndex: 2, startDate: d(2026, 10, 19), endDate: d(2026, 12, 18), values: { status: "planned", team: "eng", effort: 21 }, order: 2 },
	],
	milestones: [
		{ name: "Q2 Launch", date: d(2026, 6, 30), color: "#9bd5a8" },
		{ name: "GA", date: d(2026, 11, 15), color: "#e0c79b" },
	],
};

const marketing: RoadmapSnapshot = {
	name: "Marketing & GTM 2026",
	startDate: d(2026, 1, 1),
	endDate: d(2026, 12, 31),
	defaultZoom: "month",
	colorByFieldKey: "priority",
	barColorMode: "fill",
	fields: [
		{ key: "priority", label: "Priority", type: "select", options: PRIORITY_OPTIONS, order: 0, showInTable: true },
		{ key: "channel", label: "Channels", type: "multiselect", options: CHANNEL_OPTIONS, order: 1, showInTable: true },
		{ key: "owner", label: "Owner", type: "text", order: 2, showInTable: true },
		{ key: "budget", label: "Budget ($)", type: "number", order: 3, showInTable: true },
	],
	lanes: [
		{ name: "Campaigns", order: 0, isDefault: true },
		{ name: "Content", order: 1 },
		{ name: "Events", order: 2 },
	],
	items: [
		{ title: "Spring brand campaign", laneIndex: 0, startDate: d(2026, 2, 1), endDate: d(2026, 4, 15), description: "Cross-channel brand push.", values: { priority: "high", channel: ["email", "social", "paid"], owner: "Dana", budget: 25000 }, order: 0 },
		{ title: "Lifecycle email revamp", laneIndex: 0, startDate: d(2026, 3, 1), endDate: d(2026, 5, 1), values: { priority: "med", channel: ["email"], owner: "Priya", budget: 8000 }, order: 1 },
		// Edge cases: blank text (owner) + number 0 (budget).
		{ title: "SEO content refresh", laneIndex: 1, startDate: d(2026, 1, 15), endDate: d(2026, 6, 30), values: { priority: "med", channel: ["seo"], owner: "", budget: 0 }, order: 0 },
		// Edge case: empty multiselect (channel).
		{ title: "Customer story series", laneIndex: 1, startDate: d(2026, 4, 1), endDate: d(2026, 9, 30), values: { priority: "low", channel: [], owner: "Lee", budget: 5000 }, order: 1 },
		{ title: "User conference 2026", laneIndex: 2, startDate: d(2026, 8, 1), endDate: d(2026, 9, 18), description: "Annual flagship event.", values: { priority: "high", channel: ["events", "social"], owner: "Sam", budget: 60000 }, order: 0 },
		{ title: "Webinar series", laneIndex: 2, startDate: d(2026, 5, 1), endDate: d(2026, 11, 30), values: { priority: "med", channel: ["events", "email"], owner: "Sam", budget: 12000 }, order: 1 },
	],
	milestones: [{ name: "Conference", date: d(2026, 9, 15), color: "#c7a3e0" }],
};

const infra: RoadmapSnapshot = {
	name: "Platform & Infra 2026",
	startDate: d(2026, 1, 1),
	endDate: d(2026, 12, 31),
	defaultZoom: "quarter",
	colorByFieldKey: STATUS_FIELD_KEY,
	fields: [
		statusField,
		{ key: "severity", label: "Severity", type: "select", options: SEVERITY_OPTIONS, order: 1, showInTable: true },
		{ key: "targetDate", label: "Target date", type: "date", order: 2, showInTable: true },
	],
	lanes: [
		{ name: "Reliability", order: 0, isDefault: true },
		{ name: "Security", order: 1 },
		{ name: "Cost", order: 2 },
	],
	items: [
		{ title: "Multi-region failover", laneIndex: 0, startDate: d(2026, 1, 6), endDate: d(2026, 6, 30), description: "Active-active across two regions.", values: { status: "in_progress", severity: "critical", targetDate: d(2026, 6, 30) }, order: 0 },
		{ title: "Observability revamp", laneIndex: 0, startDate: d(2026, 4, 1), endDate: d(2026, 9, 1), values: { status: "planned", severity: "high", targetDate: d(2026, 9, 1) }, order: 1 },
		// Edge case: empty date value (null).
		{ title: "Zero-downtime deploys", laneIndex: 0, startDate: d(2026, 7, 1), endDate: d(2026, 10, 15), values: { status: "planned", severity: "med", targetDate: null }, order: 2 },
		{ title: "Secrets rotation", laneIndex: 1, startDate: d(2026, 2, 1), endDate: d(2026, 5, 15), values: { status: "planned", severity: "high", targetDate: d(2026, 5, 15) }, order: 0 },
		{ title: "Pen-test remediation", laneIndex: 1, startDate: d(2026, 1, 20), endDate: d(2026, 4, 1), description: "Fix findings from Q4 audit.", values: { status: "blocked", severity: "critical", targetDate: d(2026, 4, 1) }, order: 1 },
		// Edge case: null select value (severity).
		{ title: "Compute cost audit", laneIndex: 2, startDate: d(2026, 5, 1), endDate: d(2026, 8, 1), values: { status: "planned", severity: null, targetDate: d(2026, 8, 1) }, order: 0 },
	],
	// Edge case: no milestones.
	milestones: [],
};

const okrs: RoadmapSnapshot = {
	name: "Personal OKRs 2025",
	startDate: d(2025, 1, 1),
	endDate: d(2025, 12, 31),
	defaultZoom: "month",
	colorByFieldKey: STATUS_FIELD_KEY,
	fields: [statusField],
	// Edge case: single default lane only.
	lanes: [{ name: "Goals", order: 0, isDefault: true }],
	items: [
		{ title: "Run a half marathon", laneIndex: 0, startDate: d(2025, 1, 1), endDate: d(2025, 4, 30), description: "Sub-2:00 target.", values: { status: "done" }, order: 0 },
		{ title: "Read 20 books", laneIndex: 0, startDate: d(2025, 1, 1), endDate: d(2025, 12, 31), values: { status: "in_progress" }, order: 1 },
		{ title: "Learn Spanish", laneIndex: 0, startDate: d(2025, 3, 1), endDate: d(2025, 12, 31), values: { status: "planned" }, order: 2 },
	],
	milestones: [],
};

export const DEMO_ROADMAPS: RoadmapSeed[] = [
	{
		description: "Demo roadmap seeded for local development.",
		visibility: "link",
		shareToken: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
		archived: false,
		snapshot: product,
	},
	{
		description: "Cross-channel marketing and go-to-market plan.",
		visibility: "private",
		archived: false,
		snapshot: marketing,
	},
	{
		description: "Reliability, security and cost initiatives.",
		visibility: "private",
		archived: false,
		snapshot: infra,
	},
	{
		description: "Archived personal goals from last year.",
		visibility: "private",
		archived: true,
		snapshot: okrs,
	},
];

export const roadmapSeeder: Seeder = {
	name: "roadmaps",
	async wipe(ctx, userId) {
		const roadmaps = await ctx.db
			.query("roadmaps")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
		for (const roadmap of roadmaps) {
			const fields = await ctx.db
				.query("fields")
				.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmap._id))
				.collect();
			for (const row of fields) await ctx.db.delete(row._id);

			const lanes = await ctx.db
				.query("lanes")
				.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmap._id))
				.collect();
			for (const row of lanes) await ctx.db.delete(row._id);

			const items = await ctx.db
				.query("items")
				.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmap._id))
				.collect();
			for (const row of items) await ctx.db.delete(row._id);

			const milestones = await ctx.db
				.query("milestones")
				.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmap._id))
				.collect();
			for (const row of milestones) await ctx.db.delete(row._id);

			const versions = await ctx.db
				.query("roadmapVersions")
				.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmap._id))
				.collect();
			for (const row of versions) await ctx.db.delete(row._id);

			await ctx.db.delete(roadmap._id);
		}
	},
	async seed(ctx, userId) {
		for (const spec of DEMO_ROADMAPS) {
			const { snapshot } = spec;
			const roadmapId = await ctx.db.insert("roadmaps", {
				userId,
				name: snapshot.name,
				description: spec.description,
				startDate: snapshot.startDate,
				endDate: snapshot.endDate,
				defaultZoom: snapshot.defaultZoom,
				colorByFieldKey: snapshot.colorByFieldKey,
				barColorMode: snapshot.barColorMode,
				visibility: spec.visibility,
				shareToken: spec.shareToken,
				archived: spec.archived,
			});
			await applySnapshot(ctx, roadmapId, userId, snapshot);
		}
		return DEMO_ROADMAPS.length;
	},
};
