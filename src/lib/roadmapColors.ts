import type { Doc } from "@convex/_generated/dataModel";

const FALLBACK = "#e5e5e5";

/** Resolves an item's bar color from the roadmap's color-by select field. */
export function barColor(
	item: Doc<"items">,
	fields: Doc<"fields">[],
	colorByFieldKey: string | undefined,
): string {
	if (!colorByFieldKey) return FALLBACK;
	const field = fields.find((f) => f.key === colorByFieldKey);
	if (!field?.options) return FALLBACK;
	const value = item.values[colorByFieldKey];
	const optionId = Array.isArray(value) ? value[0] : value;
	const option = field.options.find((o) => o.id === optionId);
	return option?.color ?? FALLBACK;
}

/** Picks a legible text color (near-black or white) for a solid background `hex`. */
export function readableTextOn(hex: string): string {
	const c = hex.replace("#", "");
	const full =
		c.length === 3
			? c
					.split("")
					.map((x) => x + x)
					.join("")
			: c;
	const r = Number.parseInt(full.slice(0, 2), 16);
	const g = Number.parseInt(full.slice(2, 4), 16);
	const b = Number.parseInt(full.slice(4, 6), 16);
	if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return "#1c1c1c";
	const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return lum > 0.6 ? "#1c1c1c" : "#ffffff";
}
