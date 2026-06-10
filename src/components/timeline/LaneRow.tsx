import type { Doc } from "@convex/_generated/dataModel";
import type { DragMode } from "@/lib/timeline";
import { ItemBar } from "./ItemBar";

export function LaneRow({
	lane,
	items,
	rows,
	geometries,
	colors,
	colorMode,
	rowHeight,
	rowGap,
	labelWidth,
	axisWidth,
	unitWidth,
	onSelect,
	onItemDrag,
	onItemDragMove,
	previewGeometryFor,
	onAddItem,
	onAddItemAt,
}: {
	lane: Doc<"lanes">;
	items: Doc<"items">[];
	rows: number[];
	geometries: Array<{ left: number; width: number }>;
	colors: string[];
	colorMode: "left" | "fill";
	rowHeight: number;
	rowGap: number;
	labelWidth: number;
	axisWidth: number;
	unitWidth: number;
	onSelect?: (id: Doc<"items">["_id"]) => void;
	onItemDrag?: (
		item: Doc<"items">,
		mode: DragMode,
		deltaX: number,
		clientY: number,
	) => void;
	onItemDragMove?: (item: Doc<"items">, mode: DragMode, deltaX: number) => void;
	previewGeometryFor?: (
		item: Doc<"items">,
		mode: DragMode,
		deltaX: number,
	) => { left: number; width: number };
	onAddItem?: (laneId: Doc<"lanes">["_id"]) => void;
	onAddItemAt?: (laneId: Doc<"lanes">["_id"], localX: number) => void;
}) {
	const depth = items.length ? Math.max(...rows) + 1 : 1;
	const height = depth * (rowHeight + rowGap) + rowGap;
	return (
		<div className="flex border-b border-neutral-200" style={{ height }}>
			<div
				style={{ width: labelWidth }}
				className="group/lane relative shrink-0 border-r border-neutral-200 bg-white p-2"
			>
				<strong className="text-[13px]">{lane.name}</strong>
				<span className="block font-mono text-[11px] text-neutral-500">
					{items.length} items
				</span>
				{onAddItem ? (
					<button
						type="button"
						aria-label={`Add item to ${lane.name}`}
						onClick={() => onAddItem(lane._id)}
						className="absolute right-2 top-2 hidden rounded border border-neutral-200 px-1.5 text-sm leading-5 text-neutral-500 hover:bg-neutral-100 group-hover/lane:block"
					>
						+
					</button>
				) : null}
			</div>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: double-click-to-add is a pointer-only convenience affordance over the timeline canvas */}
			<div
				className="relative"
				style={{ width: axisWidth }}
				onDoubleClick={(e) => {
					if (!onAddItemAt || e.target !== e.currentTarget) return;
					const rect = e.currentTarget.getBoundingClientRect();
					onAddItemAt(lane._id, e.clientX - rect.left);
				}}
			>
				{items.map((item, i) => (
					<ItemBar
						key={item._id}
						item={item}
						left={geometries[i].left}
						width={geometries[i].width}
						top={rows[i] * (rowHeight + rowGap) + rowGap}
						color={colors[i]}
						colorMode={colorMode}
						unitWidth={unitWidth}
						onSelect={onSelect}
						onDragCommit={
							onItemDrag
								? (mode, deltaX, clientY) =>
										onItemDrag(item, mode, deltaX, clientY)
								: undefined
						}
						onDragMove={
							onItemDragMove
								? (mode, deltaX) => onItemDragMove(item, mode, deltaX)
								: undefined
						}
						previewGeometry={
							previewGeometryFor
								? (mode, deltaX) => previewGeometryFor(item, mode, deltaX)
								: undefined
						}
					/>
				))}
			</div>
		</div>
	);
}
