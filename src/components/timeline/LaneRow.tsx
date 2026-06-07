import type { Doc } from "@convex/_generated/dataModel";
import { ItemBar } from "./ItemBar";

export function LaneRow({
	lane,
	items,
	rows,
	geometries,
	colors,
	rowHeight,
	rowGap,
	labelWidth,
	axisWidth,
	onSelect,
}: {
	lane: Doc<"lanes">;
	items: Doc<"items">[];
	rows: number[];
	geometries: Array<{ left: number; width: number }>;
	colors: string[];
	rowHeight: number;
	rowGap: number;
	labelWidth: number;
	axisWidth: number;
	onSelect?: (id: Doc<"items">["_id"]) => void;
}) {
	const depth = items.length ? Math.max(...rows) + 1 : 1;
	const height = depth * (rowHeight + rowGap) + rowGap;
	return (
		<div className="flex border-b border-neutral-200" style={{ height }}>
			<div
				style={{ width: labelWidth }}
				className="shrink-0 border-r border-neutral-200 bg-white p-2"
			>
				<strong className="text-[13px]">{lane.name}</strong>
				<span className="block font-mono text-[11px] text-neutral-500">
					{items.length} items
				</span>
			</div>
			<div className="relative" style={{ width: axisWidth }}>
				{items.map((item, i) => (
					<ItemBar
						key={item._id}
						item={item}
						left={geometries[i].left}
						width={geometries[i].width}
						top={rows[i] * (rowHeight + rowGap) + rowGap}
						color={colors[i]}
						onSelect={onSelect}
					/>
				))}
			</div>
		</div>
	);
}
