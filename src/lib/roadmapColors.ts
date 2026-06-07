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
	if (!field || !field.options) return FALLBACK;
	const value = item.values[colorByFieldKey];
	const optionId = Array.isArray(value) ? value[0] : value;
	const option = field.options.find((o) => o.id === optionId);
	return option?.color ?? FALLBACK;
}
