import type { Doc, Id } from "@convex/_generated/dataModel";

export interface ItemFilter {
	search: string;
	laneId: Id<"lanes"> | "all";
	fieldKey: string | null;
	optionId: string | "all";
}

export interface SortState {
	/** "title" | "startDate" | "endDate" | "laneId" | a field key */
	key: string;
	dir: 1 | -1;
}

function haystack(item: Doc<"items">): string {
	const values = Object.values(item.values)
		.flatMap((v) => (Array.isArray(v) ? v : [v]))
		.map((v) => String(v ?? ""));
	return [item.title, item.description ?? "", ...values]
		.join(" ")
		.toLowerCase();
}

export function filterItems(
	items: Doc<"items">[],
	filter: ItemFilter,
): Doc<"items">[] {
	const q = filter.search.trim().toLowerCase();
	return items.filter((item) => {
		if (filter.laneId !== "all" && item.laneId !== filter.laneId) return false;
		if (filter.fieldKey && filter.optionId !== "all") {
			const v = item.values[filter.fieldKey];
			const matches = Array.isArray(v)
				? v.includes(filter.optionId)
				: v === filter.optionId;
			if (!matches) return false;
		}
		if (q && !haystack(item).includes(q)) return false;
		return true;
	});
}

function sortKeyValue(item: Doc<"items">, key: string): string | number {
	if (key === "title") return item.title;
	if (key === "startDate") return item.startDate;
	if (key === "endDate") return item.endDate;
	if (key === "laneId") return item.laneId;
	const v = item.values[key];
	if (Array.isArray(v)) return v.join(",");
	if (v === null || v === undefined) return "";
	return v;
}

export function sortItems(
	items: Doc<"items">[],
	sort: SortState,
): Doc<"items">[] {
	return [...items].sort((a, b) => {
		const av = sortKeyValue(a, sort.key);
		const bv = sortKeyValue(b, sort.key);
		if (typeof av === "number" && typeof bv === "number") {
			return (av - bv) * sort.dir;
		}
		return String(av).localeCompare(String(bv)) * sort.dir;
	});
}
