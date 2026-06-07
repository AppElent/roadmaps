import type { Infer } from "convex/values";
import type { fieldOptionValidator } from "../schema";

export const STATUS_FIELD_KEY = "status";

export const DEFAULT_STATUS_OPTIONS: Array<Infer<typeof fieldOptionValidator>> =
	[
		{ id: "planned", label: "Planned", color: "#9bc2e0" },
		{ id: "in_progress", label: "In progress", color: "#e0c79b" },
		{ id: "blocked", label: "Blocked", color: "#e09b9b" },
		{ id: "done", label: "Done", color: "#9bd5a8" },
	];
