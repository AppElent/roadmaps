import type { Doc } from "@convex/_generated/dataModel";

export function ItemBar({
	item,
	left,
	width,
	top,
	color,
	onSelect,
}: {
	item: Doc<"items">;
	left: number;
	width: number;
	top: number;
	color: string;
	onSelect?: (id: Doc<"items">["_id"]) => void;
}) {
	return (
		<button
			type="button"
			onClick={() => onSelect?.(item._id)}
			style={{ left, width, top, borderLeftColor: color }}
			className="absolute h-9 overflow-hidden rounded-md border border-l-4 border-neutral-200 bg-white px-2 text-left text-xs shadow-sm hover:border-neutral-400"
		>
			<span className="block truncate font-medium leading-9">{item.title}</span>
		</button>
	);
}
